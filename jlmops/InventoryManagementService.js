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
    const serviceName = 'InventoryManagementService';
    const functionName = 'getStockLevel';
    try {
      const product = productService.getProductById(productIdentifier); // Reusing ProductService
      if (product && product.Stock !== undefined) {
        logger.info(serviceName, functionName, `Stock level for ${productIdentifier}: ${product.Stock}`);
        return product.Stock;
      } else {
        logger.warn(serviceName, functionName, `Product ${productIdentifier} not found or stock information missing.`);
        return null;
      }
    } catch (e) {
      logger.error(serviceName, functionName, `Error getting stock level for ${productIdentifier}: ${e.message}`, e);
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
    const serviceName = 'InventoryManagementService';
    const functionName = 'updateStock';
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(PRODUCT_SHEET_NAME);

      if (!sheet) {
        logger.error(serviceName, functionName, `Product sheet '${PRODUCT_SHEET_NAME}' not found for stock update.`);
        return false;
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const idColumnIndex = headers.indexOf('ID');
      const skuColumnIndex = headers.indexOf('SKU');
      const stockColumnIndex = headers.indexOf('Stock');

      if (stockColumnIndex === -1 || (idColumnIndex === -1 && skuColumnIndex === -1)) {
        logger.error(serviceName, functionName, "Required 'ID'/'SKU' or 'Stock' column not found in product sheet.");
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
          logger.info(serviceName, functionName, `Stock for ${productIdentifier} updated from ${currentStock} to ${newStock}.`);
          updated = true;
          break;
        }
      }

      if (!updated) {
        logger.warn(serviceName, functionName, `Product with ID/SKU ${productIdentifier} not found for stock update.`);
      }
      return updated;

    } catch (e) {
      logger.error(serviceName, functionName, `Error updating stock for ${productIdentifier}: ${e.message}`, e);
      return false;
    }
  };

  /**
   * Calculates the total quantity of each SKU committed to 'On-Hold' orders
   * and populates the SysInventoryOnHold sheet.
   */
  this.calculateOnHoldInventory = function() {
    const serviceName = 'InventoryManagementService';
    const functionName = 'calculateOnHoldInventory';
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const ss = SpreadsheetApp.openById(dataSpreadsheetId);
      const sheetNames = allConfig['system.sheet_names'];
      const webOrdMSheet = ss.getSheetByName(sheetNames['WebOrdM']);
      const webOrdItemsMSheet = ss.getSheetByName(sheetNames['WebOrdItemsM']);
      const sysInventoryOnHoldSheet = ss.getSheetByName(sheetNames['SysInventoryOnHold']);

      if (!webOrdMSheet || !webOrdItemsMSheet || !sysInventoryOnHoldSheet) {
        logger.error(serviceName, functionName, "One or more required sheets (WebOrdM, WebOrdItemsM, SysInventoryOnHold) not found.");
        return;
      }

      // Get headers for WebOrdM
      const webOrdMHeaders = webOrdMSheet.getRange(1, 1, 1, webOrdMSheet.getLastColumn()).getValues()[0];
      const womOrderIdCol = webOrdMHeaders.indexOf("wom_OrderId");
      const womStatusCol = webOrdMHeaders.indexOf("wom_Status");

      if (womOrderIdCol === -1 || womStatusCol === -1) {
        logger.error(serviceName, functionName, "Required columns (wom_OrderId, wom_Status) not found in WebOrdM.");
        return;
      }

      // Get WebOrdM data
      const webOrdMData = webOrdMSheet.getDataRange().getValues();
      const onHoldOrderIds = new Set();

      // Identify 'On-Hold' order IDs
      for (let i = 1; i < webOrdMData.length; i++) { // Skip header row
        const row = webOrdMData[i];
        if (String(row[womStatusCol] || '').trim().toLowerCase() === 'on-hold') {
          onHoldOrderIds.add(row[womOrderIdCol]);
        }
      }

      if (onHoldOrderIds.size === 0) {
        logger.info(serviceName, functionName, "No 'On-Hold' orders found. Clearing SysInventoryOnHold sheet.");
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
        logger.error(serviceName, functionName, "Required columns (woi_OrderId, woi_SKU, woi_Quantity) not found in WebOrdItemsM.");
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

      logger.info(serviceName, functionName, "SysInventoryOnHold sheet updated successfully with on-hold inventory.");

    } catch (e) {
      logger.error(serviceName, functionName, "Error calculating on-hold inventory: " + e.message, e);
    }
  };

  this.getBruryaStockList = function() {
    const serviceName = 'InventoryManagementService';
    const functionName = 'getBruryaStockList';
    LoggerService.info(serviceName, functionName, `Starting ${functionName}...`);
    try {
        const allConfig = ConfigService.getAllConfig();
        if (!allConfig) throw new Error("Could not load system configuration.");
        
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        if (!dataSpreadsheetId) throw new Error("Data spreadsheet ID not found in configuration.");
        
        const ss = SpreadsheetApp.openById(dataSpreadsheetId);
        const sheetNames = allConfig['system.sheet_names'];
        if (!sheetNames) throw new Error("Sheet name configuration not found.");

        // --- 1. Get Brurya Stock ---
        const auditSheetName = sheetNames.SysProductAudit;
        if (!auditSheetName) throw new Error("SysProductAudit sheet name not found in configuration.");
        const productAuditSheet = ss.getSheetByName(auditSheetName);
        if (!productAuditSheet) throw new Error(`Sheet '${auditSheetName}' not found.`);

        const paData = productAuditSheet.getDataRange().getValues();
        const paHeaders = paData.shift();
        const paSkuColIdx = paHeaders.indexOf('pa_SKU');
        const paBruryaQtyColIdx = paHeaders.indexOf('pa_BruryaQty');
        if (paSkuColIdx === -1 || paBruryaQtyColIdx === -1) {
            throw new Error("Required columns 'pa_SKU' or 'pa_BruryaQty' not found in SysProductAudit sheet.");
        }

        const bruryaStock = paData.map(row => ({
            sku: row[paSkuColIdx],
            bruryaQty: parseFloat(row[paBruryaQtyColIdx]) || 0
        })).filter(item => item.sku && item.bruryaQty > 0);
        
        LoggerService.info(serviceName, functionName, `Found ${bruryaStock.length} entries with positive quantity.`);

        // --- 2. Get Comax Product Names (Manual) ---
        const comaxSheetName = sheetNames.CmxProdM;
        if (!comaxSheetName) throw new Error("CmxProdM sheet name not found in configuration.");
        const comaxProdSheet = ss.getSheetByName(comaxSheetName);
        if (!comaxProdSheet) throw new Error(`Sheet '${comaxSheetName}' not found.`);

        const cpmData = comaxProdSheet.getDataRange().getValues();
        const cpmHeaders = cpmData.shift();
        const cpmSkuColIdx = cpmHeaders.indexOf('cpm_SKU');
        const cpmNameHeColIdx = cpmHeaders.indexOf('cpm_NameHe');
        
        if (cpmSkuColIdx === -1 || cpmNameHeColIdx === -1) {
            throw new Error("Required columns 'cpm_SKU' or 'cpm_NameHe' not found in ComaxProdM sheet.");
        }
        
        const comaxNamesMap = new Map(cpmData.map(row => [row[cpmSkuColIdx], row[cpmNameHeColIdx]]));
        LoggerService.info(serviceName, functionName, `Created a map of ${comaxNamesMap.size} Comax product names.`);

        // --- 3. Combine ---
        const combinedData = bruryaStock.map(item => ({
            sku: item.sku,
            bruryaQty: item.bruryaQty,
            Name: comaxNamesMap.get(item.sku) || ''
        }));
        
        // --- 4. Sort (Now enabled with robust string conversion) ---
        combinedData.sort((a, b) => {
            const nameA = String(a.Name || '');
            const nameB = String(b.Name || '');
            return nameA.localeCompare(nameB);
        });

        LoggerService.info(serviceName, functionName, `Returning ${combinedData.length} combined and sorted entries.`);
        return combinedData;

    } catch (e) {
        LoggerService.error(serviceName, functionName, `Error in ${functionName}: ${e.message}`, e);
        throw e; // Re-throw the error to be caught by the client
    }
  };

  /**
   * Calculates the total number of products and the total stock quantity at Brurya.
   * @returns {Object} An object `{ productCount: Number, totalStock: Number }`.
   */
    this.getBruryaSummaryStatistic = function() {
      const serviceName = 'InventoryManagementService';
      const functionName = 'getBruryaSummaryStatistic';
      logger.info(serviceName, functionName, `Starting ${functionName}...`);
      try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const ss = SpreadsheetApp.openById(dataSpreadsheetId);
        const sheetNames = allConfig['system.sheet_names'];
        const productAuditSheet = ss.getSheetByName(sheetNames.SysProductAudit);
  
        if (!productAuditSheet) {
          logger.error(serviceName, functionName, `Sheet '${sheetNames.SysProductAudit}' not found.`);
          return { productCount: 0, totalStock: 0 };
        }
  
        const headers = productAuditSheet.getRange(1, 1, 1, productAuditSheet.getLastColumn()).getValues()[0];
        const bruryaQtyColIdx = headers.indexOf('pa_BruryaQty');
  
        if (bruryaQtyColIdx === -1) {
          logger.error(serviceName, functionName, "Required column 'pa_BruryaQty' not found in SysProductAudit sheet.");
          return { productCount: 0, totalStock: 0 };
        }
  
        const data = productAuditSheet.getDataRange().getValues();
        let productCount = 0;
        let totalStock = 0;
  
        // Start from 1 to skip headers
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const bruryaQty = parseFloat(row[bruryaQtyColIdx]);
  
          if (!isNaN(bruryaQty) && bruryaQty > 0) {
            productCount++;
            totalStock += bruryaQty;
          }
        }
        logger.info(serviceName, functionName, `Brurya Summary: Products: ${productCount}, Total Stock: ${totalStock}.`);
        return { productCount: productCount, totalStock: totalStock };
  
      } catch (e) {
        logger.error(serviceName, functionName, `Error in ${functionName}: ${e.message}`, e);
        return { productCount: 0, totalStock: 0 };
      }
    };
  
    /**
     * Retrieves the count of open 'Negative Inventory' tasks.
     * @returns {number} The count of open tasks.
     */
    this.getOpenNegativeInventoryTasksCount = function() {
      return _getOpenTaskCountByTypeId('task.inventory.negative');
    };
  
    /**
     * Retrieves the count of open 'Inventory Count' tasks.
     * @returns {number} The count of open tasks.
     */
    this.getOpenInventoryCountTasksCount = function() {
      return _getOpenTaskCountByTypeId('task.inventory.count');
    };
  
    /**
     * Retrieves the count of open 'Inventory Count Review' tasks.
     * @returns {number} The count of open tasks.
     */
    this.getOpenInventoryCountReviewTasksCount = function() {
      return _getOpenTaskCountByTypeId('task.inventory.count_review');
    };
  
    /**
     * Retrieves the count of items with stock ready for Comax Inventory Export.
     * @returns {number} The count of items with stock > 0.
     */
    this.getComaxInventoryExportCount = function() {
      const serviceName = 'InventoryManagementService';
      const functionName = 'getComaxInventoryExportCount';
      try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const ss = SpreadsheetApp.openById(dataSpreadsheetId);
        const sheetNames = allConfig['system.sheet_names'];
        const productAuditSheet = ss.getSheetByName(sheetNames.SysProductAudit);
  
        if (!productAuditSheet || productAuditSheet.getLastRow() <= 1) {
          return 0;
        }
  
        const headers = productAuditSheet.getRange(1, 1, 1, productAuditSheet.getLastColumn()).getValues()[0];
        const qtyCols = ['pa_BruryaQty', 'pa_StorageQty', 'pa_OfficeQty', 'pa_ShopQty'];
        const qtyColIndices = qtyCols.map(col => headers.indexOf(col));
  
        const data = productAuditSheet.getRange(2, 1, productAuditSheet.getLastRow() - 1, productAuditSheet.getLastColumn()).getValues();
        
        let exportableItemCount = 0;
        for (let i = 0; i < data.length; i++) {
          let totalStock = 0;
          for (const colIdx of qtyColIndices) {
            if (colIdx !== -1) {
              const qty = parseFloat(data[i][colIdx]);
              if (!isNaN(qty)) {
                totalStock += qty;
              }
            }
          }
          if (totalStock > 0) {
            exportableItemCount++;
          }
        }
        return exportableItemCount;
      } catch (e) {
        LoggerService.error(serviceName, functionName, `Error getting Comax inventory export count: ${e.message}`, e);
        return 0;
      }
    };
  
    /**
     * Helper function to get count of open tasks by type ID.
     * @param {string} taskTypeId The ID of the task type to count.
     * @returns {number} The count of open tasks.
     */
    function _getOpenTaskCountByTypeId(taskTypeId) {
      const serviceName = 'InventoryManagementService';
      const functionName = '_getOpenTaskCountByTypeId';
      try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const sheetNames = allConfig['system.sheet_names'];
        const taskSheet = SpreadsheetApp.openById(dataSpreadsheetId).getSheetByName(sheetNames.SysTasks);
  
        if (!taskSheet || taskSheet.getLastRow() <= 1) {
          return 0;
        }
  
        const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
        const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
        const taskTypeCol = taskHeaders.indexOf('st_TaskTypeId');
        const statusCol = taskHeaders.indexOf('st_Status');
  
        let count = 0;
        for (let i = 0; i < taskData.length; i++) {
          const row = taskData[i];
          if (row[taskTypeCol] === taskTypeId && row[statusCol] !== 'Done' && row[statusCol] !== 'Cancelled') {
            count++;
          }
        }
        return count;
      } catch (e) {
        LoggerService.error(serviceName, functionName, `Error getting task count for type ${taskTypeId}: ${e.message}`, e);
        return 0;
      }
    }
  
    // TODO: Add methods for:
    // - Reserving stock (e.g., for pending orders)
    // - Releasing reserved stock
    // - Handling low stock alerts
    // - Syncing inventory with external systems (e.g., Comax)
  }
  
  // Global instance for easy access throughout the project
  const inventoryManagementService = new InventoryManagementService();

