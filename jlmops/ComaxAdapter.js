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
  function processProductCsv(csvContent) {
    console.log('ComaxAdapter: Starting robust, single-step transformation...');

    // 1. Get the necessary configurations
    const sourceMap = ConfigService.getConfig('map.comax.product_columns');
    const targetSchema = ConfigService.getConfig('schema.data.CmxProdS');

    if (!sourceMap || !targetSchema || !targetSchema.headers) {
        throw new Error('Required source map or target schema not found in configuration.');
    }

    // 2. Use Drive API to convert CSV to a temporary Sheet for robust parsing
    const patchedContent = csvContent; // No patching needed here as we remap everything.
    const cleanBlob = Utilities.newBlob(patchedContent, MimeType.CSV, 'temp-comax-import.csv');
    const tempSpreadsheetResource = { title: `[TEMP] Comax Import - ${new Date().toISOString()}` };
    const tempSheetFile = Drive.Files.insert(tempSpreadsheetResource, cleanBlob, { convert: true });
    let allData;

    try {
        const tempSpreadsheet = SpreadsheetApp.openById(tempSheetFile.id);
        allData = tempSpreadsheet.getSheets()[0].getDataRange().getValues();
    } finally {
        DriveApp.getFileById(tempSheetFile.id).setTrashed(true);
    }

    if (!allData || allData.length < 2) {
      console.warn('ComaxAdapter: File is empty or contains only a header after conversion.');
      return [];
    }

    // 3. Remap the data to match the target schema order in a single step
    const targetHeaders = targetSchema.headers.split(',');
    const dataRows = allData.slice(1);

    // Create an inverted map for efficient lookup: { cpm_SKU: 1, cpm_Price: 14, ... }
    const sourceIndexMap = {};
    Object.keys(sourceMap).forEach(index => {
        const fieldName = sourceMap[index];
        if (fieldName) sourceIndexMap[fieldName] = parseInt(index, 10);
    });

    const finalData = dataRows.map(sourceRow => {
      if (sourceRow.join('').trim() === '') return null;
      // For each header in the target sheet, find the corresponding value in the source row
      return targetHeaders.map(targetHeader => {
        const sourceHeader = targetHeader.replace('cps_', 'cpm_');
        const sourceIndex = sourceIndexMap[sourceHeader];
        return sourceRow[sourceIndex] || ''; // Return the value from the source row at the correct index
      });
    }).filter(row => row !== null); // Filter out any empty rows that were skipped

    console.log(`ComaxAdapter: Successfully transformed ${finalData.length} products.`);
    return finalData; // Return the 2D array
  }


  // Public interface for the adapter
  return {
    processProductCsv: processProductCsv
  };

})();
