/**
 * @file ComaxAdapter.js
 * @description This adapter handles the cleaning and transformation of raw data from the Comax ERP.
 */

const ComaxAdapter = (function() {

  /**
   * Parses the raw CSV content of a Comax Products file.
   * @param {string} csvContent The raw string content of the CSV file.
   * @returns {Array<Object>} An array of clean, standardized product objects.
   */
  function processProductCsv(fileBlob) {
    const serviceName = 'ComaxAdapter';
    const functionName = 'processProductCsv';
    logger.info(serviceName, functionName, 'Starting transformation using Google Sheets conversion engine...');

    const indexMap = ConfigService.getConfig('map.comax.product_columns');
    if (!indexMap) {
        throw new Error('Comax product column map not found in configuration.');
    }

    // NEW: Get expected schema for validation
    const expectedSchema = ConfigService.getConfig('schema.data.CmxProdS');
    if (!expectedSchema) {
        throw new Error('CmxProdS schema not found in configuration.');
    }
    const expectedHeaders = expectedSchema.headers.split(',');

    let allData;
    const tempFile = Drive.Files.insert({ title: `[TEMP] Comax Import - ${new Date().toISOString()}` }, fileBlob, { convert: true });

    try {
        const tempSpreadsheet = SpreadsheetApp.openById(tempFile.id);
        allData = tempSpreadsheet.getSheets()[0].getDataRange().getValues();
    } finally {
        DriveApp.getFileById(tempFile.id).setTrashed(true);
    }

    if (!allData || allData.length < 2) {
      logger.error(serviceName, functionName, 'File is empty or contains only a header after conversion.');
      throw new Error('INVALID FILE: Comax file is empty or contains only a header. Cannot import.');
    }

    const dataRows = allData.slice(1); // Skip header row

    // NEW: Validate file has enough columns for mapping
    const maxColumnIndex = Math.max(...Object.keys(indexMap).map(k => parseInt(k, 10)));
    const fileColumnCount = dataRows.length > 0 ? dataRows[0].length : 0;

    if (fileColumnCount <= maxColumnIndex) {
        const errorMsg = `SCHEMA MISMATCH: Comax file has ${fileColumnCount} columns, but mapping expects at least ${maxColumnIndex + 1}. File schema may have changed. HALTING import.`;
        logger.error(serviceName, functionName, errorMsg);
        throw new Error(errorMsg);
    }

    const productObjects = [];
    const mappingErrors = [];
    const criticalFields = ['cps_CmxId', 'cps_SKU', 'cps_NameHe', 'cps_Stock', 'cps_Price'];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.join('').trim() === '') continue; // Skip empty rows

      const product = {};
      const rowMissingFields = [];

      Object.keys(indexMap).forEach(index => {
        const internalFieldName = indexMap[index];
        const colIndex = parseInt(index, 10);

        if (colIndex < row.length) {
          const targetFieldName = internalFieldName.replace('cpm_', 'cps_');
          let cellValue = row[colIndex];

          if (targetFieldName === 'cps_CmxId' && typeof cellValue === 'number') {
            cellValue = new Number(cellValue).toFixed(0);
          } else if (cellValue instanceof Date) {
            cellValue = Utilities.formatDate(cellValue, "UTC", "dd/MM/yyyy");
          }

          product[targetFieldName] = String(cellValue || '').trim();
        } else {
          // NEW: Track missing columns
          rowMissingFields.push(`Column ${colIndex} (${internalFieldName})`);
        }
      });

      // COMAX BUSINESS RULE: Null/empty stock is treated as zero (out of stock)
      if (product.cps_Stock === '' || product.cps_Stock === null || product.cps_Stock === undefined) {
          product.cps_Stock = '0';
      }

      // COMAX BUSINESS RULE: Null/empty price is treated as zero (no price set)
      if (product.cps_Price === '' || product.cps_Price === null || product.cps_Price === undefined) {
          product.cps_Price = '0';
      }

      // NEW: Validate all expected fields are present in product object
      const missingExpectedFields = expectedHeaders.filter(header => !product.hasOwnProperty(header));
      if (missingExpectedFields.length > 0) {
          mappingErrors.push(`Row ${i + 2}: Missing expected fields: ${missingExpectedFields.join(', ')}`);
      }

      // NEW: Validate critical fields are not empty
      // Note: cps_Stock is already normalized to '0' if empty, so it will pass validation
      const emptyCriticalFields = criticalFields.filter(field => !product[field] || String(product[field]).trim() === '');
      if (emptyCriticalFields.length > 0) {
          mappingErrors.push(`Row ${i + 2}: Empty critical fields: ${emptyCriticalFields.join(', ')}`);
      }

      if (rowMissingFields.length > 0) {
          mappingErrors.push(`Row ${i + 2}: ${rowMissingFields.join(', ')}`);
      }

      productObjects.push(product);
    }

    // NEW: Fail if any mapping errors detected
    if (mappingErrors.length > 0) {
        const errorSummary = mappingErrors.slice(0, 10).join('\n');
        const totalErrors = mappingErrors.length;
        const errorMsg = `MAPPING ERRORS DETECTED (${totalErrors} total):\n${errorSummary}\n${totalErrors > 10 ? `... and ${totalErrors - 10} more` : ''}\nCheck if Comax export format changed. HALTING import.`;
        logger.error(serviceName, functionName, errorMsg);
        throw new Error(errorMsg);
    }

    logger.info(serviceName, functionName, `Successfully processed ${productObjects.length} products with complete schema validation.`);

    return productObjects;
  }

  // Public interface for the adapter
  return {
    processProductCsv: processProductCsv
  };

})();
