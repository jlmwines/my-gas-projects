/**
 * @file WebAdapter.js
 * @description This adapter handles the cleaning and transformation of raw data from WooCommerce product exports.
 */

const WebAdapter = (function() {

  /**
   * Parses the raw CSV content of a Web Products file.
   * @param {string} csvContent The raw string content of the CSV file.
   * @param {string} mapName The name of the configuration map to use (e.g., 'map.web.product_columns').
   * @returns {Array<Object>} An array of clean, standardized product objects.
   */
  function processProductCsv(csvContent, mapName) {
    console.log(`WebAdapter: Starting product CSV processing using map: ${mapName}`);

    const columnMap = ConfigService.getConfig(mapName);
    if (!columnMap) {
        throw new Error(`Web product column map '${mapName}' not found in configuration. Please run setup.`);
    }

    const parsedData = Utilities.parseCsv(csvContent);
    if (parsedData.length < 2) {
      console.warn('WebAdapter: File is empty or contains only a header.');
      return [];
    }
    
    const headerRow = parsedData[0].map(h => String(h).trim().toLowerCase()); // Convert CSV headers to lowercase for case-insensitive matching
    const productObjects = [];

    // Start from row 1 to skip the header
    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (row.join('').trim() === '') continue; // Skip empty rows

      const product = {};
      Object.keys(columnMap).forEach(csvHeader => {
        const internalFieldName = columnMap[csvHeader];
        // Convert csvHeader from config to lowercase for comparison
        const columnIndex = headerRow.indexOf(csvHeader.toLowerCase());
        
        if (columnIndex !== -1) {
          product[internalFieldName] = row[columnIndex];
        }
      });
      productObjects.push(product);
    }

    console.log(`WebAdapter: Successfully processed ${productObjects.length} products.`);
    return productObjects;
  }

  // Public interface for the adapter
  return {
    processProductCsv: processProductCsv
  };

})();
