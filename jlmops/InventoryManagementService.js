const InventoryManagementService = (function() {
  // Assuming product stock is managed within the ProductService's sheet (WebProdM)
  // or a dedicated inventory sheet. For simplicity, we'll interact with ProductService.
  const PRODUCT_SHEET_NAME = "WebProdM"; // Or a dedicated "Inventory" sheet

  /**
   * Retrieves the current stock level for a given product ID or SKU.
   * @param {string} productIdentifier The ID or SKU of the product.
   * @returns {number|null} The current stock level, or null if product not found.
   */
  function getStockLevel(productIdentifier) {
    const serviceName = 'InventoryManagementService';
    const functionName = 'getStockLevel';
    try {
      const product = ProductService.getProductById(productIdentifier); // Reusing ProductService
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
  }

  /**
   * Updates the stock level for a given product ID or SKU.
   * This is a basic implementation and needs to be expanded for transactional safety.
   * @param {string} productIdentifier The ID or SKU of the product.
   * @param {number} quantityChange The amount to change the stock by (positive for increase, negative for decrease).
   * @returns {boolean} True if stock was updated, false otherwise.
   */
  function updateStock(productIdentifier, quantityChange) {
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
  }

  /**
   * Calculates the total quantity of each SKU committed to 'On-Hold' orders
   * and populates the SysInventoryOnHold sheet.
   */
  function calculateOnHoldInventory() {
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
  }

  function getBruryaStockList() {
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
  }

  function setBruryaQuantity(sku, quantity) {
    const serviceName = 'InventoryManagementService';
    const functionName = 'setBruryaQuantity';
    LoggerService.info(serviceName, functionName, `Setting quantity for SKU ${sku} to ${quantity}.`);

    try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const sheetNames = allConfig['system.sheet_names'];
        const auditSheetName = sheetNames.SysProductAudit;
        const comaxSheetName = sheetNames.CmxProdM;

        const ss = SpreadsheetApp.openById(dataSpreadsheetId);
        const auditSheet = ss.getSheetByName(auditSheetName);
        const comaxSheet = ss.getSheetByName(comaxSheetName);

        if (!auditSheet || !comaxSheet) {
            throw new Error(`One or more required sheets not found: '${auditSheetName}', '${comaxSheetName}'.`);
        }

        const auditData = auditSheet.getDataRange().getValues();
        const auditHeaders = auditData[0];
        const auditSkuColIdx = auditHeaders.indexOf('pa_SKU');
        const auditBruryaQtyColIdx = auditHeaders.indexOf('pa_BruryaQty');

        if (auditSkuColIdx === -1 || auditBruryaQtyColIdx === -1) {
            throw new Error(`Required columns 'pa_SKU' or 'pa_BruryaQty' not found in '${auditSheetName}'.`);
        }

        const rowIndex = auditData.findIndex((row, index) => index > 0 && row[auditSkuColIdx] === sku);

        if (rowIndex !== -1) {
            // Item exists, update it.
            auditSheet.getRange(rowIndex + 1, auditBruryaQtyColIdx + 1).setValue(quantity);
            LoggerService.info(serviceName, functionName, `Successfully updated SKU ${sku} to quantity ${quantity}.`);
            return { success: true, sku: sku, quantity: quantity, action: 'updated' };
        } else {
            // Item does not exist, create it.
            LoggerService.info(serviceName, functionName, `SKU '${sku}' not found in '${auditSheetName}'. Attempting to create new entry.`);
            
            const comaxData = comaxSheet.getDataRange().getValues();
            const comaxHeaders = comaxData.shift();
            const comaxSkuIndex = comaxHeaders.indexOf('cpm_SKU');
            
            const comaxProductRow = comaxData.find(row => row[comaxSkuIndex] === sku);

            if (comaxProductRow) {
                const newRow = Array(auditHeaders.length).fill('');
                // Map fields from comax to product audit
                // This is a basic mapping, more may be needed depending on the sheet structure
                newRow[auditHeaders.indexOf('pa_SKU')] = sku;
                newRow[auditHeaders.indexOf('pa_ProdId')] = comaxProductRow[comaxHeaders.indexOf('cpm_ProdId')];
                newRow[auditHeaders.indexOf('pa_NameHe')] = comaxProductRow[comaxHeaders.indexOf('cpm_NameHe')];
                newRow[auditBruryaQtyColIdx] = quantity;

                auditSheet.appendRow(newRow);
                LoggerService.info(serviceName, functionName, `Successfully created new entry for SKU ${sku}.`);
                return { success: true, sku: sku, quantity: quantity, action: 'created' };
            } else {
                throw new Error(`Product with SKU '${sku}' was not found in the Comax product list.`);
            }
        }
    } catch (e) {
        LoggerService.error(serviceName, functionName, `Error setting quantity for SKU ${sku}: ${e.message}`, e);
        throw e;
    }
  }

  function updateBruryaInventory(inventoryData) {
    const serviceName = 'InventoryManagementService';
    const functionName = 'updateBruryaInventory';
    LoggerService.info(serviceName, functionName, `Starting update with ${inventoryData.length} items.`);
    
    try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const sheetNames = allConfig['system.sheet_names'];
        const auditSheetName = sheetNames.SysProductAudit;
        
        const ss = SpreadsheetApp.openById(dataSpreadsheetId);
        const sheet = ss.getSheetByName(auditSheetName);
        if (!sheet) {
            throw new Error(`Sheet '${auditSheetName}' not found.`);
        }

        const data = sheet.getDataRange().getValues();
        const headers = data.shift(); // data now only contains rows

        const skuColIdx = headers.indexOf('pa_SKU');
        const bruryaQtyColIdx = headers.indexOf('pa_BruryaQty');

        if (skuColIdx === -1 || bruryaQtyColIdx === -1) {
            throw new Error(`Required columns 'pa_SKU' or 'pa_BruryaQty' not found in '${auditSheetName}'.`);
        }

        // Create a map of SKU to its row index in the 'data' array (0-based)
        const skuToRowIndexMap = new Map(data.map((row, index) => [row[skuColIdx], index]));
        
        let updatedCount = 0;
        inventoryData.forEach(item => {
            const rowIndex = skuToRowIndexMap.get(item.sku);
            if (rowIndex !== undefined) {
                // Update the quantity in our in-memory 'data' array
                data[rowIndex][bruryaQtyColIdx] = item.quantity;
                updatedCount++;
            } else {
                LoggerService.warn(serviceName, functionName, `SKU '${item.sku}' not found in '${auditSheetName}'. Cannot update quantity.`);
            }
        });

        // If any updates were made, write the entire BruryaQty column back to the sheet
        if (updatedCount > 0) {
            const bruryaQtyColumn = data.map(row => [row[bruryaQtyColIdx]]);
            // range is +2 because data array is 0-based and sheet is 1-based with a header row
            sheet.getRange(2, bruryaQtyColIdx + 1, bruryaQtyColumn.length, 1).setValues(bruryaQtyColumn);
            LoggerService.info(serviceName, functionName, `Successfully updated ${updatedCount} items in '${auditSheetName}'.`);
        } else {
            LoggerService.info(serviceName, functionName, 'No items were updated.');
        }

        return { success: true, updated: updatedCount };

    } catch (e) {
        LoggerService.error(serviceName, functionName, `Error updating Brurya inventory: ${e.message}`, e);
        // Re-throw the error to be caught by the client-side failure handler
        throw new Error(`Failed to update Brurya inventory. Reason: ${e.message}`);
    }
}

  /**
   * Calculates the total number of products and the total stock quantity at Brurya.
   * @returns {Object} An object `{ productCount: Number, totalStock: Number }`.
   */
    function getBruryaSummaryStatistic() {
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
    }
  
    /**
     * Retrieves the count of open 'Negative Inventory' tasks.
     * @returns {number} The count of open tasks.
     */
    function getOpenNegativeInventoryTasksCount() {
      return _getOpenTaskCountByTypeId('task.inventory.negative');
    }
  
    /**
     * Retrieves the count of open 'Inventory Count' tasks.
     * @returns {number} The count of open tasks.
     */
    function getOpenInventoryCountTasksCount() {
      return _getOpenTaskCountByTypeId('task.inventory.count');
    }
  
    /**
     * Retrieves the count of open 'Inventory Count Review' tasks.
     * @returns {number} The count of open tasks.
     */
    function getOpenInventoryCountReviewTasksCount() {
      return _getOpenTaskCountByTypeId('task.inventory.count_review');
    }
  
    /**
     * Retrieves the count of items with stock ready for Comax Inventory Export.
     * @returns {number} The count of items with stock > 0.
     */
    function getComaxInventoryExportCount() {
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
    }
  
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

    return {
        getStockLevel: getStockLevel,
        updateStock: updateStock,
        calculateOnHoldInventory: calculateOnHoldInventory,
        getBruryaStockList: getBruryaStockList,
        setBruryaQuantity: setBruryaQuantity,
        updateBruryaInventory: updateBruryaInventory,
        getBruryaSummaryStatistic: getBruryaSummaryStatistic,
        getOpenNegativeInventoryTasksCount: getOpenNegativeInventoryTasksCount,
        getOpenInventoryCountTasksCount: getOpenInventoryCountTasksCount,
        getOpenInventoryCountReviewTasksCount: getOpenInventoryCountReviewTasksCount,
        getComaxInventoryExportCount: getComaxInventoryExportCount
    };
})();
