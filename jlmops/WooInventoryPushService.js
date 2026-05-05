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

  return {
    processJob: processJob
  };
})();
