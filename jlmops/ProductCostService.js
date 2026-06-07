/**
 * @file ProductCostService.js
 * @description Vendor-cost import + profit-rate computation (BUNDLE_PLAN Stage 2).
 *
 *   Flow (settled 2026-06-06):
 *     1. Read the Comax vendor-cost file by name from its Drive folder — a DIRECT
 *        DriveApp read, NOT the import-job pipeline (the pipeline exists only for the
 *        per-sync product CSV upload). File cols: A internal code, B SKU, C ex-VAT cost.
 *     2. Write cost into CmxProdM.cpm_Cost, overwriting ONLY the SKUs present in the
 *        file — manual backfills for SKUs absent from the file survive.
 *     3. Compute the ex-VAT profit rate from the STORED cost (all CmxProdM costs, file
 *        + backfills) joined to the WebProdM web price by SKU, and write the fraction
 *        into WebProdM.wpm_ProfitRate. rate = (exVat - cost) / exVat,
 *        exVat = wpm_RegularPrice / system.pricing.vat_divisor. Web price includes VAT;
 *        the file cost is already ex-VAT. A web product with no stored cost or no price
 *        gets a BLANK rate (missing — excluded from profit sorts; never rendered 0%).
 *
 *   On-demand; monthly baseline. Driven by a card on AdminInventoryView (controller in
 *   WebAppInventory.js). The rate is cached on the web row so the constant consumer
 *   (getEligibleProducts / bundle revising) reads it join-free; both new columns are
 *   master-only (append-only) and survive the daily sync via the existing preserve
 *   paths (ProductImportService _upsertComaxData :385 truthiness branch for cpm_Cost;
 *   _upsertWebProductsData :740 update-only-by-mapping for wpm_ProfitRate).
 */
const ProductCostService = (function() {

  const SERVICE_NAME = 'ProductCostService';

  /**
   * Imports vendor cost and recomputes profit rate end-to-end.
   * @returns {Object} Summary counts for the AdminInventory card.
   */
  function recomputeProductCosts() {
    const fn = 'recomputeProductCosts';
    logger.info(SERVICE_NAME, fn, 'Starting vendor-cost import + profit-rate recompute.');

    const fileCfg = ConfigService.getConfig('system.product_costs');
    if (!fileCfg || !fileCfg.source_folder_id || !fileCfg.file_pattern) {
      throw new Error('system.product_costs config missing (source_folder_id / file_pattern). Run rebuildSysConfigFromSource().');
    }
    const vatCfg = ConfigService.getConfig('system.pricing');
    const vatDivisor = (vatCfg && vatCfg.vat_divisor) ? Number(vatCfg.vat_divisor) : NaN;
    if (!isFinite(vatDivisor) || vatDivisor <= 0) {
      throw new Error('system.pricing.vat_divisor missing or invalid: ' + (vatCfg && vatCfg.vat_divisor));
    }

    // 1. Read the cost file (direct Drive read by name; Windows-1255). File SKUs only.
    const costBySku = _readCostFile(fileCfg);
    logger.info(SERVICE_NAME, fn, `Cost file parsed: ${costBySku.size} SKUs carry a cost.`);

    // 2. Write cpm_Cost into CmxProdM (overwrite file SKUs; preserve manual backfills).
    const cmx = _writeComaxCost(costBySku);

    // 3. Compute + write wpm_ProfitRate from the full stored cost set x web price.
    const web = _writeWebProfitRate(cmx.costBySkuFull, vatDivisor);

    // 4. Stamp last recompute (script timezone = Israel per appsscript.json).
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    ConfigService.setConfig('system.product_costs.last_recompute', 'value', stamp);

    const summary = {
      costsInFile: costBySku.size,
      cmxUpdated: cmx.updated,
      cmxMissingCost: cmx.missingCost,   // unarchived CmxProdM rows still without a cost (backfill list size)
      webRatesComputed: web.computed,    // overwritten from a stored cost
      webRatesPreserved: web.preserved,  // no cost -> kept existing manual/assumed rate
      webStillBlank: web.stillBlank,     // no cost and no existing rate
      lastRecompute: stamp
    };
    logger.info(SERVICE_NAME, fn, 'Recompute complete: ' + JSON.stringify(summary));
    return summary;
  }

  /**
   * Reads the vendor-cost CSV from its folder by name. Cols: A internal code, B SKU,
   * C ex-VAT cost. Header row skipped. Rows with a blank cost are skipped (missing
   * cost is the norm — handled as manual backfill, never defaulted).
   * @returns {Map<string, number>} sku -> ex-VAT cost.
   */
  function _readCostFile(fileCfg) {
    const fn = '_readCostFile';
    const folder = DriveApp.getFolderById(fileCfg.source_folder_id);
    const files = folder.getFilesByName(fileCfg.file_pattern);
    if (!files.hasNext()) {
      throw new Error(`Cost file '${fileCfg.file_pattern}' not found in folder ${fileCfg.source_folder_id}.`);
    }
    const file = files.next();
    const encoding = fileCfg.file_encoding || 'UTF-8';
    const csvText = file.getBlob().getDataAsString(encoding);
    const rows = Utilities.parseCsv(csvText);

    const costBySku = new Map();
    let skippedBlank = 0;
    let skippedBadNumber = 0;
    for (let i = 1; i < rows.length; i++) {   // i=1: skip the (Hebrew) header row
      const row = rows[i];
      if (!row || row.join('').trim() === '') continue;
      const sku = String(row[1] || '').trim();
      const rawCost = String(row[2] || '').trim();
      if (!sku) continue;
      if (rawCost === '') { skippedBlank++; continue; }   // missing cost -> backfill case
      const cost = Number(rawCost);
      if (!isFinite(cost) || cost < 0) { skippedBadNumber++; continue; }
      costBySku.set(sku, cost);
    }
    logger.info(SERVICE_NAME, fn,
      `Parsed ${rows.length - 1} data rows: ${costBySku.size} with cost, ${skippedBlank} blank-cost, ${skippedBadNumber} unparseable.`);
    if (skippedBadNumber > 0) {
      logger.warn(SERVICE_NAME, fn, `${skippedBadNumber} cost cells could not be parsed as numbers — check the export's number format (decimal separator).`);
    }
    return costBySku;
  }

  /**
   * Writes cpm_Cost into CmxProdM via a targeted single-column update. Only SKUs present
   * in the file are overwritten; any other existing value (manual backfill) is preserved.
   * @returns {{updated:number, missingCost:number, costBySkuFull:Map<string,number>}}
   *   costBySkuFull = every SKU that now carries a stored cost (file + backfills).
   */
  function _writeComaxCost(costBySku) {
    const fn = '_writeComaxCost';
    const sheet = SheetAccessor.getDataSpreadsheet().getSheetByName('CmxProdM');
    const headers = ConfigService.getConfig('schema.data.CmxProdM').headers.split(',');
    const skuIdx = headers.indexOf('cpm_SKU');
    const costIdx = headers.indexOf('cpm_Cost');
    const archIdx = headers.indexOf('cpm_IsArchived');
    if (skuIdx < 0 || costIdx < 0) {
      throw new Error('CmxProdM is missing cpm_SKU or cpm_Cost — run syncAllHeaders().');
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { updated: 0, missingCost: 0, costBySkuFull: new Map() };
    const numRows = lastRow - 1;

    const skuCol = sheet.getRange(2, skuIdx + 1, numRows, 1).getValues();
    const costCol = sheet.getRange(2, costIdx + 1, numRows, 1).getValues();
    const archCol = archIdx >= 0 ? sheet.getRange(2, archIdx + 1, numRows, 1).getValues() : null;

    let updated = 0, missingCost = 0;
    const costBySkuFull = new Map();

    const newCostCol = costCol.map((r, i) => {
      const sku = String(skuCol[i][0] || '').trim();
      const existing = r[0];
      let cost;
      if (sku && costBySku.has(sku)) {
        cost = costBySku.get(sku);
        if (String(existing) !== String(cost)) updated++;
      } else {
        // preserve existing (manual backfill) when the file has no cost for this SKU
        cost = (existing === '' || existing === null || existing === undefined) ? '' : existing;
      }

      const hasCost = cost !== '' && cost !== null && cost !== undefined && isFinite(Number(cost));
      if (sku && hasCost) {
        costBySkuFull.set(sku, Number(cost));
      } else if (!_isArchived(archCol ? archCol[i][0] : '')) {
        missingCost++;   // actionable: an unarchived product with no cost
      }
      return [cost];
    });

    sheet.getRange(2, costIdx + 1, numRows, 1).setValues(newCostCol);
    logger.info(SERVICE_NAME, fn, `CmxProdM cpm_Cost written: ${updated} changed, ${costBySkuFull.size} now have cost, ${missingCost} unarchived still missing.`);
    return { updated, missingCost, costBySkuFull };
  }

  /**
   * Computes and writes wpm_ProfitRate into WebProdM via a targeted single-column update.
   * rate = (exVat - cost) / exVat, exVat = wpm_RegularPrice / vatDivisor. Stored as a
   * fraction (0.25 = 25%).
   *
   * Rate is the DURABLE field (settled 2026-06-07): where a stored cost exists, the
   * computed rate OVERWRITES (a real cost flowing in from a Comax stock receipt replaces
   * any prior assumed value); where there's no cost (or no price), the EXISTING rate is
   * PRESERVED — manual / assumed backfills survive recompute. Cost is never backfilled
   * by hand; it flows in via the cost file when a product is received.
   * @returns {{computed:number, preserved:number, stillBlank:number}}
   */
  function _writeWebProfitRate(costBySkuFull, vatDivisor) {
    const fn = '_writeWebProfitRate';
    const sheet = SheetAccessor.getDataSpreadsheet().getSheetByName('WebProdM');
    const headers = ConfigService.getConfig('schema.data.WebProdM').headers.split(',');
    const skuIdx = headers.indexOf('wpm_SKU');
    const priceIdx = headers.indexOf('wpm_RegularPrice');
    const rateIdx = headers.indexOf('wpm_ProfitRate');
    if (skuIdx < 0 || priceIdx < 0 || rateIdx < 0) {
      throw new Error('WebProdM is missing wpm_SKU / wpm_RegularPrice / wpm_ProfitRate — run syncAllHeaders().');
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { computed: 0, preserved: 0, stillBlank: 0 };
    const numRows = lastRow - 1;

    const skuCol = sheet.getRange(2, skuIdx + 1, numRows, 1).getValues();
    const priceCol = sheet.getRange(2, priceIdx + 1, numRows, 1).getValues();
    const rateColExisting = sheet.getRange(2, rateIdx + 1, numRows, 1).getValues();

    let computed = 0, preserved = 0, stillBlank = 0;
    const rateCol = skuCol.map((r, i) => {
      const sku = String(r[0] || '').trim();
      const price = Number(priceCol[i][0]);
      if (sku && costBySkuFull.has(sku) && isFinite(price) && price > 0) {
        const exVat = price / vatDivisor;
        const rate = (exVat - costBySkuFull.get(sku)) / exVat;
        computed++;
        return [Math.round(rate * 10000) / 10000];   // 4dp fraction — overwrites
      }
      // no stored cost (or no price): preserve the existing rate (manual / assumed backfill)
      const existing = rateColExisting[i][0];
      if (existing !== '' && existing !== null && existing !== undefined) {
        preserved++;
        return [existing];
      }
      stillBlank++;
      return [''];
    });

    sheet.getRange(2, rateIdx + 1, numRows, 1).setValues(rateCol);
    logger.info(SERVICE_NAME, fn, `WebProdM wpm_ProfitRate: ${computed} computed, ${preserved} preserved, ${stillBlank} blank.`);
    return { computed, preserved, stillBlank };
  }

  function _isArchived(v) {
    const s = String(v || '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }

  return {
    recomputeProductCosts: recomputeProductCosts
  };

})();

/**
 * Editor wrapper — run from the Apps Script editor to smoke-test the cost import
 * before the AdminInventory card is wired (BUNDLE_PLAN Stage 2).
 */
function runRecomputeProductCosts() {
  return ProductCostService.recomputeProductCosts();
}
