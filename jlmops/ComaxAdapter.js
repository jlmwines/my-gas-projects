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
    console.log('ComaxAdapter: Starting transformation with header patch and robust parsing...');

    const sourceMap = ConfigService.getConfig('map.comax.product_columns');
    const targetSchema = ConfigService.getConfig('schema.data.CmxProdS');

    if (!sourceMap || !targetSchema || !targetSchema.headers) {
        throw new Error('Required source map or target schema not found in configuration.');
    }

    // Step 1: Replicate legacy script's header patch for stability
    const lines = csvContent.split('\n');
    if (lines.length > 0) {
        const headerCells = lines[0].split(',');
        if (headerCells.length < 15 || !headerCells[14].trim()) {
            headerCells[14] = 'CMX_PRICE_PATCHED';
            lines[0] = headerCells.join(',');
            console.log('ComaxAdapter: Patched corrupt header at index 14.');
        }
    }
    const patchedContent = lines.join('\n');
    const cleanBlob = Utilities.newBlob(patchedContent, MimeType.CSV, 'temp-comax-import.csv');

    // Step 2: Replicate legacy script's robust parsing method
    const tempSheetFile = Drive.Files.insert({ title: `[TEMP] Comax Import - ${new Date().toISOString()}` }, cleanBlob, { convert: true });
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

    // Step 3: Map data using the reliable index map
    const targetHeaders = targetSchema.headers.split(',');
    const dataRows = allData.slice(1);

    const sourceIndexMap = {};
    Object.keys(sourceMap).forEach(index => {
        const fieldName = sourceMap[index];
        if (fieldName) sourceIndexMap[fieldName] = parseInt(index, 10);
    });

    const finalData = dataRows.map(sourceRow => {
      if (sourceRow.join('').trim() === '') return null;
      return targetHeaders.map(targetHeader => {
        const sourceFieldName = targetHeader.replace('cps_', 'cpm_');
        const sourceIndex = sourceIndexMap[sourceFieldName];
        if (typeof sourceIndex === 'number' && sourceIndex < sourceRow.length) {
          return sourceRow[sourceIndex] || '';
        }
        return '';
      });
    }).filter(row => row !== null);

    console.log(`ComaxAdapter: Successfully transformed ${finalData.length} products.`);
    return finalData;
}


  // Public interface for the adapter
  return {
    processProductCsv: processProductCsv
  };

})();
