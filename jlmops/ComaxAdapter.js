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
      return [];
    }
    
    const productObjects = [];
    const dataRows = allData.slice(1); // Skip header row

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.join('').trim() === '') continue; // Skip empty rows

      const product = {};
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
        }
      });
      productObjects.push(product);
    }

    logger.info(serviceName, functionName, `Successfully processed ${productObjects.length} products.`);

    return productObjects;
  }

  // Public interface for the adapter
  return {
    processProductCsv: processProductCsv
  };

})();
