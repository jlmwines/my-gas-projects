/**
 * @file BundleService.js
 * @description This service manages product bundles.
 */

/**
 * BundleService provides methods for managing product bundles.
 */
function BundleService() {
  const BUNDLE_SHEET_NAME = "WebBundles"; // Assuming WebBundles is the master bundle sheet

  /**
   * Retrieves all product bundles from the bundle sheet.
   * @returns {Array<Object>} An array of bundle objects.
   */
  this.getAllBundles = function() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(BUNDLE_SHEET_NAME);

      if (!sheet) {
        logger.error(`Bundle sheet '${BUNDLE_SHEET_NAME}' not found.`);
        return [];
      }

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length === 0) {
        logger.info(`No data found in bundle sheet '${BUNDLE_SHEET_NAME}'.`);
        return [];
      }

      const headers = values[0];
      const bundles = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const bundle = {};
        headers.forEach((header, index) => {
          bundle[header] = row[index];
        });
        bundles.push(bundle);
      }

      logger.info(`Successfully retrieved ${bundles.length} bundles from '${BUNDLE_SHEET_NAME}'.`);
      return bundles;

    } catch (e) {
      logger.error(`Error getting all bundles: ${e.message}`, e);
      return [];
    }
  };

  /**
   * Retrieves a single bundle by its ID or SKU.
   * @param {string} bundleIdentifier The ID or SKU of the bundle to retrieve.
   * @returns {Object|null} The bundle object if found, otherwise null.
   */
  this.getBundleByIdentifier = function(bundleIdentifier) {
    try {
      const bundles = this.getAllBundles(); // For simplicity, fetch all and filter
      const bundle = bundles.find(b => b.ID === bundleIdentifier || b.SKU === bundleIdentifier); // Assuming 'ID' or 'SKU' as identifier

      if (bundle) {
        logger.info(`Found bundle with ID/SKU: ${bundleIdentifier}`);
      } else {
        logger.warn(`Bundle with ID/SKU: ${bundleIdentifier} not found.`);
      }
      return bundle || null;

    } catch (e) {
      logger.error(`Error getting bundle by identifier ${bundleIdentifier}: ${e.message}`, e);
      return null;
    }
  };

  // TODO: Add methods for managing bundle components, calculating prices, etc.
  // this.getBundleComponents = function(bundleId) { ... };
  // this.calculateBundlePrice = function(bundleId) { ... };
}

// Global instance for easy access throughout the project
const bundleService = new BundleService();