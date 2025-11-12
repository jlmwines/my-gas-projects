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

  /**
   * Calculates the total quantity of each SKU committed to 'On-Hold' orders
   * and populates the SysInventoryOnHold sheet.
   */
  this.calculateOnHoldInventory = function() {
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const ss = SpreadsheetApp.openById(dataSpreadsheetId);
      const sheetNames = allConfig['system.sheet_names'];
      const webOrdMSheet = ss.getSheetByName(sheetNames['WebOrdM']);
      const webOrdItemsMSheet = ss.getSheetByName(sheetNames['WebOrdItemsM']);
      const sysInventoryOnHoldSheet = ss.getSheetByName(sheetNames['SysInventoryOnHold']);

      if (!webOrdMSheet || !webOrdItemsMSheet || !sysInventoryOnHoldSheet) {
        logger.error("One or more required sheets (WebOrdM, WebOrdItemsM, SysInventoryOnHold) not found.");
        return;
      }

      // Get headers for WebOrdM
      const webOrdMHeaders = webOrdMSheet.getRange(1, 1, 1, webOrdMSheet.getLastColumn()).getValues()[0];
      const womOrderIdCol = webOrdMHeaders.indexOf("wom_OrderId");
      const womStatusCol = webOrdMHeaders.indexOf("wom_Status");

      if (womOrderIdCol === -1 || womStatusCol === -1) {
        logger.error("Required columns (wom_OrderId, wom_Status) not found in WebOrdM.");
        return;
      }

      // Get WebOrdM data
      const webOrdMData = webOrdMSheet.getDataRange().getValues();
      const onHoldOrderIds = new Set();

      // Identify 'On-Hold' order IDs
      for (let i = 1; i < webOrdMData.length; i++) { // Skip header row
        const row = webOrdMData[i];
        if (row[womStatusCol] === 'On-Hold') {
          onHoldOrderIds.add(row[womOrderIdCol]);
        }
      }

      if (onHoldOrderIds.size === 0) {
        logger.info("No 'On-Hold' orders found. Clearing SysInventoryOnHold sheet.");
        // Clear existing content in SysInventoryOnHold (except headers)
        if (sysInventoryOnHoldSheet.getLastRow() > 1) {
          sysInventoryOnHoldSheet.getRange(2, 1, sysInventoryOnHoldSheet.getLastRow() - 1, sysInventoryOnHoldSheet.getLastColumn()).clearContent();
        }
        return;
      }

      // Get headers for WebOrdItemsM
      const webOrdItemsMHeaders = webOrdItemsMSheet.getRange(1, 1, 1, webOrdItemsMSheet.getLastColumn()).getValues()[0];
      const woiOrderIdCol = webOrdItemsMHeaders.indexOf("woi_OrderId");
      const woiSkuCol = webOrdItemsMHeaders.indexOf("woi_SKU");
      const woiQuantityCol = webOrdItemsMHeaders.indexOf("woi_Quantity");

      if (woiOrderIdCol === -1 || woiSkuCol === -1 || woiQuantityCol === -1) {
        logger.error("Required columns (woi_OrderId, woi_SKU, woi_Quantity) not found in WebOrdItemsM.");
        return;
      }

      // Get WebOrdItemsM data
      const webOrdItemsMData = webOrdItemsMSheet.getDataRange().getValues();
      const onHoldInventory = {}; // { SKU: quantity }

      // Aggregate quantities for 'On-Hold' items
      for (let i = 1; i < webOrdItemsMData.length; i++) { // Skip header row
        const row = webOrdItemsMData[i];
        const orderId = row[woiOrderIdCol];
        if (onHoldOrderIds.has(orderId)) {
          const sku = row[woiSkuCol];
          const quantity = parseFloat(row[woiQuantityCol]); // Ensure quantity is a number
          if (!isNaN(quantity)) {
            onHoldInventory[sku] = (onHoldInventory[sku] || 0) + quantity;
          }
        }
      }

      // Prepare data for SysInventoryOnHold
      const onHoldData = [];
      for (const sku in onHoldInventory) {
        onHoldData.push([sku, onHoldInventory[sku]]);
      }

      // Clear existing content in SysInventoryOnHold (except headers)
      if (sysInventoryOnHoldSheet.getLastRow() > 1) {
        sysInventoryOnHoldSheet.getRange(2, 1, sysInventoryOnHoldSheet.getLastRow() - 1, sysInventoryOnHoldSheet.getLastColumn()).clearContent();
      }

      // Write new aggregated data to SysInventoryOnHold
      if (onHoldData.length > 0) {
        sysInventoryOnHoldSheet.getRange(2, 1, onHoldData.length, onHoldData[0].length).setValues(onHoldData);
      }

      logger.info("SysInventoryOnHold sheet updated successfully with on-hold inventory.");

    } catch (e) {
      logger.error("Error calculating on-hold inventory: " + e.message, e);
    }
  };

  /**
   * Retrieves all products with their current Brurya stock from the SysProductAudit sheet.
   * @returns {Array<Object>} An array of objects, each with 'sku' and 'bruryaQty'.
   */
  this.getBruryaStock = function() {
    const functionName = 'getBruryaStock';
    logger.info(`Starting ${functionName}...`);
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const ss = SpreadsheetApp.openById(dataSpreadsheetId);
      const sheetNames = allConfig['system.sheet_names'];
      const productAuditSheet = ss.getSheetByName(sheetNames.SysProductAudit);

      if (!productAuditSheet) {
        logger.error(`Sheet '${sheetNames.SysProductAudit}' not found.`);
        return [];
      }

      const headers = productAuditSheet.getRange(1, 1, 1, productAuditSheet.getLastColumn()).getValues()[0];
      const skuColIdx = headers.indexOf('pa_SKU');
      const bruryaQtyColIdx = headers.indexOf('pa_BruryaQty');

      if (skuColIdx === -1 || bruryaQtyColIdx === -1) {
        logger.error("Required columns 'pa_SKU' or 'pa_BruryaQty' not found in SysProductAudit sheet.");
        return [];
      }

      const data = productAuditSheet.getDataRange().getValues();
      const bruryaStock = [];

      // Start from 1 to skip headers
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const sku = row[skuColIdx];
        const bruryaQty = parseFloat(row[bruryaQtyColIdx]);

        if (sku && !isNaN(bruryaQty) && bruryaQty > 0) {
          bruryaStock.push({ sku: sku, bruryaQty: bruryaQty });
        }
      }
      logger.info(`Successfully retrieved ${bruryaStock.length} Brurya stock entries.`);
      return bruryaStock;

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
      return [];
    }
  };

  /**
   * Performs an upsert operation for Brurya stock in the SysProductAudit sheet.
   * Updates pa_BruryaQty and pa_LastCount for a given SKU, or creates a new entry.
   * @param {string} sku The SKU of the product.
   * @param {number} quantity The new quantity for Brurya stock.
   * @param {string} userEmail The email of the user performing the update.
   * @returns {boolean} True if the operation was successful, false otherwise.
   */
  this.setBruryaStock = function(sku, quantity, userEmail) {
    const functionName = 'setBruryaStock';
    logger.info(`Starting ${functionName} for SKU: ${sku}, Quantity: ${quantity}, User: ${userEmail}`);
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const ss = SpreadsheetApp.openById(dataSpreadsheetId);
      const sheetNames = allConfig['system.sheet_names'];
      const productAuditSheet = ss.getSheetByName(sheetNames.SysProductAudit);

      if (!productAuditSheet) {
        logger.error(`Sheet '${sheetNames.SysProductAudit}' not found.`);
        return false;
      }

      const headers = productAuditSheet.getRange(1, 1, 1, productAuditSheet.getLastColumn()).getValues()[0];
      const skuColIdx = headers.indexOf('pa_SKU');
      const bruryaQtyColIdx = headers.indexOf('pa_BruryaQty');
      const lastCountColIdx = headers.indexOf('pa_LastCount');

      if (skuColIdx === -1 || bruryaQtyColIdx === -1 || lastCountColIdx === -1) {
        logger.error("Required columns 'pa_SKU', 'pa_BruryaQty', or 'pa_LastCount' not found in SysProductAudit sheet.");
        return false;
      }

      const data = productAuditSheet.getDataRange().getValues();
      let skuFound = false;
      const now = new Date();

      // Iterate from 1 to skip headers
      for (let i = 1; i < data.length; i++) {
        if (data[i][skuColIdx] === sku) {
          // SKU found, update existing row
          productAuditSheet.getRange(i + 1, bruryaQtyColIdx + 1).setValue(quantity);
          productAuditSheet.getRange(i + 1, lastCountColIdx + 1).setValue(now);
          logger.info(`Updated Brurya stock for SKU ${sku} to ${quantity}.`);
          skuFound = true;
          break;
        }
      }

      if (!skuFound) {
        // SKU not found, create new row
        const newRow = new Array(headers.length).fill('');
        newRow[skuColIdx] = sku;
        newRow[bruryaQtyColIdx] = quantity;
        newRow[lastCountColIdx] = now;
        // Optionally set other qty columns to 0 or empty if they are not part of this update
        // newRow[headers.indexOf('pa_StorageQty')] = 0;
        // newRow[headers.indexOf('pa_OfficeQty')] = 0;
        // newRow[headers.indexOf('pa_ShopQty')] = 0;

        productAuditSheet.appendRow(newRow);
        logger.info(`Added new entry for SKU ${sku} with Brurya stock ${quantity}.`);
      }
      return true;

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
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
