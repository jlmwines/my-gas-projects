/**
 * @file ComaxAdapter.js
 * @description This adapter handles the cleaning and transformation of raw data from the Comax ERP.
 * It is designed to be a self-contained module that understands the quirks of Comax source files.
 */

const ComaxAdapter = (function() {

  const SERVICE_NAME = "ComaxAdapter";

  // This map defines the relationship between the CSV column index and our standard data model.
  // This is the single source of truth for interpreting a raw Comax Product CSV.
  const COMAX_PRODUCT_COLUMN_MAP = {
    0: 'cpm_CmxId',
    1: 'cpm_SKU',
    2: 'cpm_NameHe',
    3: 'cpm_Division',
    4: 'cpm_Group',
    5: 'cpm_Vendor',
    6: 'cpm_Brand',
    7: 'cpm_Color',
    8: 'cpm_Size',
    9: 'cpm_Dryness',
    10: 'cpm_Vintage',
    // Columns 11, 12, 13 are ignored based on old system logic
    14: 'cpm_Price', // This is the column with the blank header issue
    15: 'cpm_Stock',
    16: 'cpm_IsNew',
    17: 'cpm_IsArchived',
    18: 'cpm_IsActive',
    19: 'cpm_IsWeb',
    20: 'cpm_Exclude'
  };

  /**
   * Processes the Comax Products CSV file found in the designated import folder.
   * It handles finding the file, fixing known data issues, and converting it to clean objects.
   * @param {string} fileId The ID of the specific file to process.
   * @returns {Array<Object>} An array of clean, standardized product objects.
   */
  function processComaxProductFile(fileId) {
    const FUNCTION_NAME = "processComaxProductFile";
    logger.info(SERVICE_NAME, FUNCTION_NAME, `Processing file ID: ${fileId}`);

    try {
      // 1. Get configuration from the central config service
      const encoding = config.get("comax.products.encoding");
      if (!encoding) {
        throw new Error("Configuration for 'comax.products.encoding' not found in SysConfig.");
      }

      // 2. Get the file by its ID
      const file = DriveApp.getFileById(fileId);

      // 3. Read file and fix the blank header issue
      const rawContent = file.getBlob().getDataAsString(encoding);
      const lines = rawContent.split('\n');
      if (lines.length < 2) {
        logger.warn(SERVICE_NAME, FUNCTION_NAME, `File ${file.getName()} is empty or contains only a header.`);
        return [];
      }

      const headerCells = lines[0].split(',');
      if (headerCells.length > 14 && (headerCells[14] === '' || headerCells[14] === undefined)) {
        headerCells[14] = 'cpm_Price'; // Use our internal name to patch the header
        lines[0] = headerCells.join(',');
        logger.info(SERVICE_NAME, FUNCTION_NAME, "Successfully patched blank header in column O.");
      }
      const patchedContent = lines.join('\n');

      // 4. Parse CSV and convert to clean objects
      const parsedData = Utilities.parseCsv(patchedContent);
      const productObjects = [];

      // Start from row 1 to skip the header
      for (let i = 1; i < parsedData.length; i++) {
        const row = parsedData[i];
        if (row.join('').trim() === '') continue; // Skip empty rows

        const product = {};
        Object.keys(COMAX_PRODUCT_COLUMN_MAP).forEach(colIndex => {
          const fieldName = COMAX_PRODUCT_COLUMN_MAP[colIndex];
          const value = row[colIndex];
          product[fieldName] = value;
        });
        productObjects.push(product);
      }

      logger.info(SERVICE_NAME, FUNCTION_NAME, `Successfully processed ${productObjects.length} products from ${file.getName()}.`);
      return productObjects;

    } catch (e) {
      logger.error(SERVICE_NAME, FUNCTION_NAME, `Error processing Comax product file: ${e.message}`, e);
      return []; // Return empty array on failure
    }
  }

  // Public interface for the adapter
  return {
    processComaxProductFile: processComaxProductFile
  };

})();
