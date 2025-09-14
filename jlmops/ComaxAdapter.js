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
    console.log('ComaxAdapter: Starting product CSV processing.');

    const columnMap = ConfigService.getConfig('map.comax.product_columns');
    if (!columnMap) {
        throw new Error('Comax product column map not found in configuration. Please run setup.');
    }

    // 1. Fix the blank header issue
    const lines = csvContent.split('\n');
    if (lines.length < 2) {
      console.warn('ComaxAdapter: File is empty or contains only a header.');
      return [];
    }

    const headerCells = lines[0].split(',');
    if (headerCells.length > 14 && (headerCells[14] === '' || headerCells[14] === undefined)) {
      headerCells[14] = 'cpm_Price'; // Use our internal name to patch the header
      lines[0] = headerCells.join(',');
      console.log('ComaxAdapter: Successfully patched blank header in column O.');
    }
    const patchedContent = lines.join('\n');

    // 2. Parse CSV and convert to clean objects
    const parsedData = Utilities.parseCsv(patchedContent);
    const productObjects = [];

    // Start from row 1 to skip the header
    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (row.join('').trim() === '') continue; // Skip empty rows

      const product = {};
      Object.keys(columnMap).forEach(colIndex => {
        // Skip description property
        if (colIndex === 'description') return;

        const fieldName = columnMap[colIndex];
        const value = row[parseInt(colIndex, 10)]; // Ensure colIndex is treated as a number
        if (fieldName) {
            product[fieldName] = value;
        }
      });
      productObjects.push(product);
    }

    console.log(`ComaxAdapter: Successfully processed ${productObjects.length} products.`);
    return productObjects;
  }


  // Public interface for the adapter
  return {
    processProductCsv: processProductCsv
  };

})();
