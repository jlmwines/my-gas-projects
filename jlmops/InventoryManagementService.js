/**
 * @file InventoryManagementService.js
 * @description This service manages inventory.
 * It handles stock levels, updates, and reservations.
 */

/**
 * InventoryManagementService provides methods for managing product inventory.
 */
function InventoryManagementService() {
  // Assuming product stock is managed within the ProductService's sheet (WebProdM)
  // or a dedicated inventory sheet. For simplicity, we'll interact with ProductService.
  const PRODUCT_SHEET_NAME = "WebProdM"; // Or a dedicated "Inventory" sheet

  /**
   * Retrieves the current stock level for a given product ID or SKU.
   * @param {string} productIdentifier The ID or SKU of the product.
   * @returns {number|null} The current stock level, or null if product not found.
   */
  this.getStockLevel = function(productIdentifier) {
    try {
      const product = productService.getProductById(productIdentifier); // Reusing ProductService
      if (product && product.Stock !== undefined) {
        logger.info(`Stock level for ${productIdentifier}: ${product.Stock}`);
        return product.Stock;
      } else {
        logger.warn(`Product ${productIdentifier} not found or stock information missing.`);
        return null;
      }
    } catch (e) {
      logger.error(`Error getting stock level for ${productIdentifier}: ${e.message}`, e);
      return null;
    }
  };

  /**
   * Updates the stock level for a given product ID or SKU.
   * This is a basic implementation and needs to be expanded for transactional safety.
   * @param {string} productIdentifier The ID or SKU of the product.
   * @param {number} quantityChange The amount to change the stock by (positive for increase, negative for decrease).
   * @returns {boolean} True if stock was updated, false otherwise.
   */
  this.updateStock = function(productIdentifier, quantityChange) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(PRODUCT_SHEET_NAME);

      if (!sheet) {
        logger.error(`Product sheet '${PRODUCT_SHEET_NAME}' not found for stock update.`);
        return false;
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const idColumnIndex = headers.indexOf('ID');
      const skuColumnIndex = headers.indexOf('SKU');
      const stockColumnIndex = headers.indexOf('Stock');

      if (stockColumnIndex === -1 || (idColumnIndex === -1 && skuColumnIndex === -1)) {
        logger.error("Required 'ID'/'SKU' or 'Stock' column not found in product sheet.");
        return false;
      }

      const data = sheet.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) { // Start from 1 to skip headers
        const currentId = data[i][idColumnIndex];
        const currentSku = data[i][skuColumnIndex];

        if (currentId === productIdentifier || currentSku === productIdentifier) {
          let currentStock = data[i][stockColumnIndex];
          if (typeof currentStock !== 'number') {
            currentStock = parseFloat(currentStock) || 0; // Ensure it's a number
          }
          const newStock = currentStock + quantityChange;

          sheet.getRange(i + 1, stockColumnIndex + 1).setValue(newStock);
          logger.info(`Stock for ${productIdentifier} updated from ${currentStock} to ${newStock}.`);
          updated = true;
          break;
        }
      }

      if (!updated) {
        logger.warn(`Product with ID/SKU ${productIdentifier} not found for stock update.`);
      }
      return updated;

    } catch (e) {
      logger.error(`Error updating stock for ${productIdentifier}: ${e.message}`, e);
      return false;
    }
  };

  // TODO: Add methods for:
  // - Reserving stock (e.g., for pending orders)
  // - Releasing reserved stock
  // - Handling low stock alerts
  // - Syncing inventory with external systems (e.g., Comax)
}

// Global instance for easy access throughout the project
const inventoryManagementService = new InventoryManagementService();