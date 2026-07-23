/**
 * @file WooInventoryPushService.js
 * @description Push price + stock updates to WooCommerce via REST API.
 *
 * Reads the same CSV that the existing CSV export path generates (named in
 * sync state as `webExportFilename`) and PUTs each row to /wc/v3/products/{ID}.
 * Touches only `regular_price` and `stock_quantity` — never title, taxonomy,
 * description, or any other field. SKU is informational (the WC product ID
 * is in the CSV directly).
 *
 * Design rationale: see jlmops/plans/INVENTORY_API_PUSH_PLAN.md.
 *
 * Per-job semantics: atomic. Any per-product PUT failure marks the whole job
 * FAILED with an error_message listing failed SKUs + reasons. Retry from the
 * widget returns the user to WAITING_WEB_CONFIRM where they can either run
 * the push again or fall back to manual upload of the same CSV.
 */

const WooInventoryPushService = (function() {
  const SERVICE_NAME = 'WooInventoryPushService';

  // WooCommerce global-attribute taxonomy IDs -- confirmed live 2026-07-22 against
  // two real product pulls (WOO_API_PUSH_PLAN.md item 3). These are WC-side
  // constants, not per-product data, so they're hardcoded here rather than
  // captured off the regular product pull.
  const ATTR_TAXONOMY_ID = {
    Winery: 1,
    Intensity: 9,
    Complexity: 10,
    Acidity: 11
  };

  /**
   * Entry point invoked by OrchestratorService.processPendingJobs.
   * @param {object} executionContext - { sessionId, jobId, jobType, jobQueueSheetRowNumber, jobQueueHeaders }
   */
  function processJob(executionContext) {
    const { jobType, jobQueueSheetRowNumber, sessionId } = executionContext;
    logger.info(SERVICE_NAME, 'processJob', `Starting job: ${jobType} (Row: ${jobQueueSheetRowNumber})`, { sessionId: sessionId, jobType: jobType });

    try {
      const result = _runPush(sessionId);
      _updateJobStatus(executionContext, result.status, result.message);
      logger.info(SERVICE_NAME, 'processJob', `Job ${jobType} ${result.status}: ${result.message}`, { sessionId: sessionId });
    } catch (e) {
      logger.error(SERVICE_NAME, 'processJob', `Job ${jobType} failed: ${e.message}`, e, { sessionId: sessionId, jobType: jobType });
      _updateJobStatus(executionContext, 'FAILED', e.message);
      throw e; // Re-throw so orchestrator's outer catch also runs
    }
  }

  /**
   * Read the CSV from Drive, PUT each row, return { status, message }.
   */
  function _runPush(sessionId) {
    const state = SyncStateService.getSyncState();

    if (state.sessionId !== sessionId) {
      throw new Error(`Session mismatch: state has ${state.sessionId}, job has ${sessionId}.`);
    }

    const filename = state.webExportFilename;
    if (!filename || filename === 'No Changes Detected') {
      return { status: 'COMPLETED', message: 'No CSV file to push (no changes detected this cycle).' };
    }

    const allConfig = ConfigService.getAllConfig();
    const exportFolderConfig = allConfig['system.folder.jlmops_exports'];
    if (!exportFolderConfig || !exportFolderConfig.id) {
      throw new Error('system.folder.jlmops_exports not configured.');
    }

    const folder = DriveApp.getFolderById(exportFolderConfig.id);
    const filesIter = folder.getFilesByName(filename);
    if (!filesIter.hasNext()) {
      throw new Error(`CSV file not found in exports folder: ${filename}`);
    }
    const file = filesIter.next();
    const csvText = file.getBlob().getDataAsString('UTF-8');

    const rows = Utilities.parseCsv(csvText);
    if (rows.length < 2) {
      return { status: 'COMPLETED', message: 'CSV has no data rows.' };
    }

    const headers = rows[0];
    const idIdx    = headers.indexOf('ID');
    const skuIdx   = headers.indexOf('SKU');
    const stockIdx = headers.indexOf('Stock');
    const priceIdx = headers.indexOf('Regular Price');
    if (idIdx < 0 || skuIdx < 0 || stockIdx < 0 || priceIdx < 0) {
      throw new Error(`CSV headers missing expected columns. Got: ${headers.join(',')}`);
    }

    const dataRows = rows.slice(1);
    const total = dataRows.length;
    let succeeded = 0;
    const failures = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const wcId  = String(row[idIdx]).trim();
      const sku   = String(row[skuIdx]).trim();
      const stock = row[stockIdx];
      const price = row[priceIdx];

      if (!wcId) {
        failures.push(`Row ${i + 2} (SKU ${sku}): missing WC product ID`);
        continue;
      }

      const payload = {
        regular_price:  String(price),
        stock_quantity: parseInt(stock, 10) || 0
      };

      try {
        WooApiService._fetch('PUT', '/wc/v3/products/' + wcId, {}, payload);
        succeeded++;
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        failures.push(`SKU ${sku} (id ${wcId}): ${msg}`);
      }
    }

    const summary = `Pushed ${succeeded}/${total} products`;
    if (failures.length === 0) {
      return { status: 'COMPLETED', message: `${summary} successfully. Source CSV: ${filename}` };
    }
    return {
      status: 'FAILED',
      message: `${summary}; ${failures.length} failed. Source CSV: ${filename}\n${failures.join('\n')}`
    };
  }

  /**
   * Mirror of OrderService._updateJobStatus — write the terminal status,
   * timestamp, and (optionally) error message into the SysJobQueue row.
   */
  function _updateJobStatus(executionContext, status, errorMessage) {
    const { jobQueueSheetRowNumber, jobQueueHeaders, jobId, jobType, sessionId } = executionContext;
    try {
      const allConfig = ConfigService.getAllConfig();
      const jobQueueSheet = SheetAccessor.getLogSheet(allConfig['system.sheet_names'].SysJobQueue);

      const statusColIdx = jobQueueHeaders.indexOf('status');
      const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');
      const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');

      if (statusColIdx === -1 || errorMsgColIdx === -1 || processedTsColIdx === -1) {
        logger.error(SERVICE_NAME, '_updateJobStatus', 'Missing required columns in SysJobQueue headers.', null, { sessionId: sessionId, jobId: jobId, jobType: jobType });
        return;
      }

      jobQueueSheet.getRange(jobQueueSheetRowNumber, statusColIdx + 1).setValue(status);
      jobQueueSheet.getRange(jobQueueSheetRowNumber, processedTsColIdx + 1).setValue(new Date());
      if (errorMessage) {
        jobQueueSheet.getRange(jobQueueSheetRowNumber, errorMsgColIdx + 1).setValue(errorMessage);
      }
      logger.info(SERVICE_NAME, '_updateJobStatus', `Job ${jobId} status updated to ${status}.`, { sessionId: sessionId, jobId: jobId, jobType: jobType, newStatus: status });
    } catch (e) {
      logger.error(SERVICE_NAME, '_updateJobStatus', `Failed to update job status for ${jobId}: ${e.message}`, e, { sessionId: sessionId, jobId: jobId, jobType: jobType });
    }
  }

  /**
   * Push description/category/attribute fields from a product-detail export
   * Sheet (ProductService._buildProductDetailExport) to WooCommerce -- the
   * on-demand "Push via API" trigger (WOO_API_PUSH_PLAN.md items 5-6), distinct
   * from the automated daily price/stock push above (_runPush). Reads the Sheet
   * directly, not a CSV.
   *
   * Each row is EN + HE combined: both PUTs must succeed for the row to count
   * as pushed. If either fails, the whole row is reported failed and neither
   * side is retried separately -- every PUT here is a full-field replace, so
   * simply re-running the push for that row (both EN and HE again) is safe and
   * idempotent even if one side already succeeded last time.
   *
   * @param {string} fileId - Drive file ID of the export Sheet.
   * @param {string} sessionId
   * @returns {{success: boolean, message: string}}
   */
  function pushProductDetails(fileId, sessionId) {
    const functionName = 'pushProductDetails';
    logger.info(SERVICE_NAME, functionName, `Starting product-detail push from file ${fileId}`, { sessionId: sessionId });

    const spreadsheet = SpreadsheetApp.openById(fileId);
    const sheet = spreadsheet.getSheets()[0];
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return { success: false, message: 'Export sheet has no data rows.' };
    }

    const headers = values[0];
    const col = name => headers.indexOf(name);
    const idx = {
      sku: col('SKU'),
      wcIdEn: col('WC ID EN'),
      wcIdHe: col('WC ID HE'),
      categoryWcId: col('Category WC ID'),
      manageStock: col('Manage Stock'),
      qty: col('Qty'),
      winery: col('Winery'), wineryVisible: col('Winery Visible'), wineryPosition: col('Winery Position'),
      intensity: col('Intensity'), intensityVisible: col('Intensity Visible'), intensityPosition: col('Intensity Position'),
      complexity: col('Complexity'), complexityVisible: col('Complexity Visible'), complexityPosition: col('Complexity Position'),
      acidity: col('Acidity'), acidityVisible: col('Acidity Visible'), acidityPosition: col('Acidity Position'),
      titleEn: col('Product Title EN'),
      titleHe: col('Product Title HE'),
      shortEn: col('Short Description EN'),
      shortHe: col('Short Description HE'),
      longEn: col('Long Description EN'),
      longHe: col('Long Description HE')
    };
    const required = ['sku', 'wcIdEn', 'categoryWcId', 'manageStock', 'qty'];
    for (let i = 0; i < required.length; i++) {
      if (idx[required[i]] < 0) {
        throw new Error(`Export sheet missing expected column for '${required[i]}'. Got headers: ${headers.join(', ')}`);
      }
    }

    const dataRows = values.slice(1);
    const total = dataRows.length;
    let succeeded = 0;
    const failures = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const sku = String(row[idx.sku]).trim();
      const wcIdEn = String(row[idx.wcIdEn]).trim();
      const wcIdHe = idx.wcIdHe >= 0 ? String(row[idx.wcIdHe]).trim() : '';

      if (!wcIdEn) {
        failures.push(`Row ${i + 2} (SKU ${sku}): missing WC ID EN`);
        continue;
      }

      // Fail-safe, not expected to trigger (WOO_API_PUSH_PLAN.md Category section):
      // every Comax product carries a category, so this guards against ever
      // pushing an empty categories array, which would wipe the product's
      // existing WC category assignment via full-replace.
      const categoryWcId = String(row[idx.categoryWcId]).trim();
      if (!categoryWcId) {
        failures.push(`SKU ${sku} (id ${wcIdEn}): blank Category WC ID -- refusing to push an empty category`);
        continue;
      }

      const attributes = _buildAttributesPayload(row, idx);
      const manageStock = row[idx.manageStock] === true || row[idx.manageStock] === 'true';
      const qty = parseInt(row[idx.qty], 10) || 0;

      const basePayload = {
        categories: [{ id: parseInt(categoryWcId, 10) }],
        attributes: attributes,
        manage_stock: manageStock,
        stock_quantity: qty
      };

      const enPayload = Object.assign({}, basePayload, {
        name: row[idx.titleEn] || '',
        short_description: row[idx.shortEn] || '',
        description: row[idx.longEn] || ''
      });
      const hePayload = Object.assign({}, basePayload, {
        name: row[idx.titleHe] || '',
        short_description: row[idx.shortHe] || '',
        description: row[idx.longHe] || ''
      });

      try {
        WooApiService._fetch('PUT', '/wc/v3/products/' + wcIdEn, {}, enPayload);
        if (wcIdHe) {
          WooApiService._fetch('PUT', '/wc/v3/products/' + wcIdHe, {}, hePayload);
        }
        succeeded++;
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        failures.push(`SKU ${sku} (EN id ${wcIdEn}, HE id ${wcIdHe || 'none'}): ${msg}`);
      }
    }

    const summary = `Pushed ${succeeded}/${total} products`;
    logger.info(SERVICE_NAME, functionName, `${summary}${failures.length ? '; ' + failures.length + ' failed' : ''}`, { sessionId: sessionId });
    if (failures.length === 0) {
      return { success: true, message: `${summary} successfully.` };
    }
    return {
      success: false,
      message: `${summary}; ${failures.length} failed.\n${failures.join('\n')}`
    };
  }

  /**
   * Build the WooCommerce `attributes` array for one export row. Only includes
   * attributes with a non-blank value.
   *
   * NOTE (confirmed live 2026-07-22, WOO_API_PUSH_PLAN.md): the `attributes`
   * array is NOT full-replace on product PUT -- attributes omitted here (Region/
   * Grape/Harmonize/Contrast, never sent by this export; a blank Intensity/
   * Complexity/Acidity on a non-wine SKU) are left untouched on the product, not
   * cleared. Any product already carrying those stays that way indefinitely.
   * Owner OK'd leaving as-is for now (not urgent) -- do not assume this array
   * prunes anything it doesn't explicitly include.
   *
   * `visible` must be sent explicitly -- WooCommerce's write API defaults it to
   * `false` when omitted (confirmed against the official REST API docs,
   * 2026-07-22), which would silently hide these attributes from the product
   * page's "Additional information" tab on every push. Read from the sheet's
   * per-attribute Visible/Position columns (owner decision, 2026-07-22: these
   * must be reviewable/editable before a push, not hardcoded invisibly in the
   * push code) -- default to visible=true/position=append-order only when the
   * sheet cell itself is blank, so an explicit edit in the sheet always wins.
   */
  function _buildAttributesPayload(row, idx) {
    const attrs = [];
    const addIfPresent = (label, colIdx, visibleIdx, positionIdx) => {
      if (colIdx < 0) return;
      const value = row[colIdx];
      if (value === '' || value === null || value === undefined) return;
      const visibleCell = visibleIdx >= 0 ? row[visibleIdx] : '';
      const positionCell = positionIdx >= 0 ? row[positionIdx] : '';
      attrs.push({
        id: ATTR_TAXONOMY_ID[label],
        options: [String(value)],
        visible: visibleCell === '' ? true : (visibleCell === true || visibleCell === 'true'),
        variation: false,
        position: positionCell === '' ? attrs.length : parseInt(positionCell, 10)
      });
    };
    addIfPresent('Winery', idx.winery, idx.wineryVisible, idx.wineryPosition);
    addIfPresent('Intensity', idx.intensity, idx.intensityVisible, idx.intensityPosition);
    addIfPresent('Complexity', idx.complexity, idx.complexityVisible, idx.complexityPosition);
    addIfPresent('Acidity', idx.acidity, idx.acidityVisible, idx.acidityPosition);
    return attrs;
  }

  return {
    processJob: processJob,
    pushProductDetails: pushProductDetails
  };
})();
