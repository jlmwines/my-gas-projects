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
   * Sets the inventory count for a given SKU in a specified quantity column in SysProductAudit.
   * If the product does not exist in SysProductAudit, it will create a new entry (from CmxProdM).
   * @param {string} sku The SKU of the product to update.
   * @param {number} quantity The new quantity to set.
   * @param {string} countColumnName The name of the quantity column to update (e.g., 'pa_OfficeQty').
   * @returns {Object} A result object from the service { success: true, sku, quantity, action: 'updated'|'created' }.
   */
  function setInventoryCount(sku, quantity, countColumnName) {
    const serviceName = 'InventoryManagementService';
    const functionName = 'setInventoryCount';
    LoggerService.info(serviceName, functionName, `Setting quantity for SKU ${sku} to ${quantity} in column ${countColumnName}.`);

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
        const auditCountColIdx = auditHeaders.indexOf(countColumnName);

        if (auditSkuColIdx === -1 || auditCountColIdx === -1) {
            throw new Error(`Required columns 'pa_SKU' or '${countColumnName}' not found in '${auditSheetName}'.`);
        }

        const rowIndex = auditData.findIndex((row, index) => index > 0 && row[auditSkuColIdx] === sku);

        if (rowIndex !== -1) {
            // Item exists, update it.
            auditSheet.getRange(rowIndex + 1, auditCountColIdx + 1).setValue(quantity);
            LoggerService.info(serviceName, functionName, `Successfully updated SKU ${sku} to quantity ${quantity} in ${countColumnName}.`);
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
                newRow[auditHeaders.indexOf('pa_SKU')] = sku;
                newRow[auditHeaders.indexOf('pa_ProdId')] = comaxProductRow[comaxHeaders.indexOf('cpm_ProdId')];
                newRow[auditHeaders.indexOf('pa_NameHe')] = comaxProductRow[comaxHeaders.indexOf('cpm_NameHe')];
                newRow[auditCountColIdx] = quantity; // Set the quantity in the specified column

                auditSheet.appendRow(newRow);
                LoggerService.info(serviceName, functionName, `Successfully created new entry for SKU ${sku} with quantity ${quantity} in ${countColumnName}.`);
                return { success: true, sku: sku, quantity: quantity, action: 'created' };
            } else {
                throw new Error(`Product with SKU '${sku}' was not found in the Comax product list.`);
            }
        }
    } catch (e) {
        LoggerService.error(serviceName, functionName, `Error setting quantity for SKU ${sku} in ${countColumnName}: ${e.message}`, e);
        throw e;
    }
  }

  /**
   * Updates the physical count quantities for a given SKU in SysProductAudit.
   * @param {Object} counts - An object containing sku, storageQty, officeQty, and shopQty.
   * @returns {Object} A result object.
   */
  function updatePhysicalCounts(counts) {
    const serviceName = 'InventoryManagementService';
    const functionName = 'updatePhysicalCounts';
    const { sku, storageQty, officeQty, shopQty } = counts;
    LoggerService.info(serviceName, functionName, `Updating counts for SKU ${sku}.`);

    try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const sheetNames = allConfig['system.sheet_names'];
        const auditSheetName = sheetNames.SysProductAudit;

        const ss = SpreadsheetApp.openById(dataSpreadsheetId);
        const auditSheet = ss.getSheetByName(auditSheetName);

        if (!auditSheet) {
            throw new Error(`Sheet not found: '${auditSheetName}'.`);
        }

        const auditData = auditSheet.getDataRange().getValues();
        const auditHeaders = auditData[0];
        const skuColIdx = auditHeaders.indexOf('pa_SKU');
        const storageColIdx = auditHeaders.indexOf('pa_StorageQty');
        const officeColIdx = auditHeaders.indexOf('pa_OfficeQty');
        const shopColIdx = auditHeaders.indexOf('pa_ShopQty');

        if ([skuColIdx, storageColIdx, officeColIdx, shopColIdx].includes(-1)) {
            throw new Error(`One or more required columns not found in '${auditSheetName}'.`);
        }

        const rowIndex = auditData.findIndex((row, index) => {
            if (index === 0) return false; // Skip header row
            const sheetSku = String(row[skuColIdx]).trim().toLowerCase();
            const searchSku = String(sku).trim().toLowerCase();
            if (sheetSku === searchSku) {
                LoggerService.info(serviceName, functionName, `SKU '${sku}' found at row index ${index}.`);
                return true;
            }
            return false;
        });

        if (rowIndex !== -1) {
            const sheetRow = rowIndex + 1; // Convert 0-based array index to 1-based sheet row index
            
            const bruryaQtyColIdx = auditHeaders.indexOf('pa_BruryaQty');
            const newQtyColIdx = auditHeaders.indexOf('pa_NewQty');

            if (bruryaQtyColIdx === -1) {
              throw new Error(`Required column 'pa_BruryaQty' not found in '${auditSheetName}'.`);
            }
            if (newQtyColIdx === -1) {
              throw new Error(`Required column 'pa_NewQty' not found in '${auditSheetName}'.`);
            }
            
            const currentBruryaQty = parseFloat(auditData[sheetRow -1][bruryaQtyColIdx]) || 0; // Get from in-memory data

            // Treat nulls as 0 for calculation
            const calcStorage = storageQty === null ? 0 : storageQty;
            const calcOffice = officeQty === null ? 0 : officeQty;
            const calcShop = shopQty === null ? 0 : shopQty;

            const totalNewQty = currentBruryaQty + calcStorage + calcOffice + calcShop;

            // Helper to set value or clear content if null
            const setOrClear = (range, val) => {
                if (val === null) {
                    range.clearContent();
                } else {
                    range.setValue(val);
                }
            };

            setOrClear(auditSheet.getRange(sheetRow, storageColIdx + 1), storageQty);
            setOrClear(auditSheet.getRange(sheetRow, officeColIdx + 1), officeQty);
            setOrClear(auditSheet.getRange(sheetRow, shopColIdx + 1), shopQty);
            
            auditSheet.getRange(sheetRow, newQtyColIdx + 1).setValue(totalNewQty); // Update pa_NewQty
            LoggerService.info(serviceName, functionName, `Successfully updated counts for SKU '${sku}'. New Total: ${totalNewQty}.`);
            return { success: true, sku: sku, action: 'updated' };
        } else {
            LoggerService.warn(serviceName, functionName, `SKU '${sku}' not found in '${auditSheetName}'. Creating a new row (this should ideally not happen for existing tasks).`);
            
            const currentHeaders = auditSheet.getRange(1, 1, 1, auditSheet.getLastColumn()).getValues()[0];
            const newRow = Array(currentHeaders.length).fill('');
            const bruryaQtyColIdx = currentHeaders.indexOf('pa_BruryaQty'); // Moved this line up
            const newQtyColIdx = currentHeaders.indexOf('pa_NewQty'); 
            
            // Treat nulls as 0 for calculation
            const calcStorage = storageQty === null ? 0 : storageQty;
            const calcOffice = officeQty === null ? 0 : officeQty;
            const calcShop = shopQty === null ? 0 : shopQty;
            
            const totalNewQty = (parseFloat(newRow[bruryaQtyColIdx] || 0)) + calcStorage + calcOffice + calcShop;

            newRow[skuColIdx] = sku;
            newRow[storageColIdx] = storageQty === null ? '' : storageQty;
            newRow[officeColIdx] = officeQty === null ? '' : officeQty;
            newRow[shopColIdx] = shopQty === null ? '' : shopQty;
            if (newQtyColIdx !== -1) {
              newRow[newQtyColIdx] = totalNewQty;
            }
            auditSheet.appendRow(newRow);
            LoggerService.info(serviceName, functionName, `SKU '${sku}' created a new row in '${auditSheetName}'. New Total: ${totalNewQty}.`);
            return { success: true, sku: sku, action: 'updated' };
        }
    } catch (e) {
        LoggerService.error(serviceName, functionName, `Error updating counts for SKU '${sku}': ${e.message}`, e);
        throw e;
    }
  }

  /**
   * Updates the pa_LastCount for a given SKU in SysProductAudit.
   * @param {string} sku The SKU of the product to update.
   * @param {Date} timestamp The timestamp to set for pa_LastCount.
   * @returns {Object} A result object { success: true, sku }.
   */
  function updateLastCount(sku, timestamp) {
    const serviceName = 'InventoryManagementService';
    const functionName = 'updateLastCount';
    LoggerService.info(serviceName, functionName, `Updating pa_LastCount for SKU '${sku}' to ${timestamp}.`);

    try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const sheetNames = allConfig['system.sheet_names'];
        const auditSheetName = sheetNames.SysProductAudit;

        const ss = SpreadsheetApp.openById(dataSpreadsheetId);
        const auditSheet = ss.getSheetByName(auditSheetName);

        if (!auditSheet) {
            throw new Error(`Sheet not found: '${auditSheetName}'.`);
        }

        const auditData = auditSheet.getDataRange().getValues();
        const auditHeaders = auditData[0];
        const skuColIdx = auditHeaders.indexOf('pa_SKU');
        const lastCountColIdx = auditHeaders.indexOf('pa_LastCount');

        if (skuColIdx === -1 || lastCountColIdx === -1) {
            throw new Error(`Required columns 'pa_SKU' or 'pa_LastCount' not found in '${auditSheetName}'.`);
        }

        const rowIndex = auditData.findIndex((row, index) => {
            if (index === 0) return false; // Skip header row
            const sheetSku = String(row[skuColIdx]).trim().toLowerCase();
            const searchSku = String(sku).trim().toLowerCase();
            return sheetSku === searchSku;
        });

        if (rowIndex !== -1) {
            const sheetRow = rowIndex + 1; // Convert 0-based array index to 1-based sheet row index
            auditSheet.getRange(sheetRow, lastCountColIdx + 1).setValue(timestamp);
            LoggerService.info(serviceName, functionName, `Successfully updated pa_LastCount for SKU '${sku}'.`);
            return { success: true, sku: sku };
        } else {
            LoggerService.warn(serviceName, functionName, `SKU '${sku}' not found in '${auditSheetName}'. Cannot update pa_LastCount.`);
            return { success: false, sku: sku, message: `SKU '${sku}' not found.` };
        }
    } catch (e) {
        LoggerService.error(serviceName, functionName, `Error updating pa_LastCount for SKU '${sku}': ${e.message}`, e);
        throw e;
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
                // Count tasks with 'Accepted' status for inventory count types
                // We check both standard counts and validation counts (negative inventory)
                const acceptedCounts = _getOpenTaskCountByTypeIdAndStatus('task.inventory.count', 'Accepted');
                const acceptedValidations = _getOpenTaskCountByTypeIdAndStatus('task.validation.comax_internal_audit', 'Accepted');
                
                return acceptedCounts + acceptedValidations;
              } catch (e) {
                LoggerService.error(serviceName, functionName, `Error getting Comax inventory export count: ${e.message}`, e);
                return 0;
              }
            }

            /**
             * Retrieves detailed information for tasks with 'Accepted' status that are ready for Comax export.
             * @returns {Array<Object>} List of objects { sku, name, bruryaQty, storageQty, officeQty, shopQty, totalQty, taskId }
             */
            function getAcceptedSyncTasks() {
              const serviceName = 'InventoryManagementService';
              const functionName = 'getAcceptedSyncTasks';
              try {
                const allConfig = ConfigService.getAllConfig();
                const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
                const ss = SpreadsheetApp.openById(dataSpreadsheetId);
                const sheetNames = allConfig['system.sheet_names'];
                const productAuditSheet = ss.getSheetByName(sheetNames.SysProductAudit);
                const taskSheet = ss.getSheetByName(sheetNames.SysTasks);

                if (!productAuditSheet || !taskSheet) {
                  throw new Error(`Required sheets not found.`);
                }

                // 1. Find all 'Accepted' tasks to identify SKUs
                const taskData = taskSheet.getDataRange().getValues();
                const taskHeaders = taskData[0];
                const tStatusCol = taskHeaders.indexOf('st_Status');
                const tTypeCol = taskHeaders.indexOf('st_TaskTypeId');
                const tEntityCol = taskHeaders.indexOf('st_LinkedEntityId');
                const tNameCol = taskHeaders.indexOf('st_LinkedEntityName');
                const tIdCol = taskHeaders.indexOf('st_TaskId');

                const relevantTypes = ['task.inventory.count', 'task.validation.comax_internal_audit'];
                const acceptedItems = []; // [{sku, taskId, name}]

                for (let i = 1; i < taskData.length; i++) {
                  const row = taskData[i];
                  if (row[tStatusCol] === 'Accepted' && relevantTypes.includes(row[tTypeCol])) {
                    const sku = String(row[tEntityCol]).trim();
                    if (sku) {
                        const name = (tNameCol > -1) ? row[tNameCol] : '';
                        acceptedItems.push({ sku: sku, taskId: row[tIdCol], name: name });
                    }
                  }
                }

                if (acceptedItems.length === 0) return [];

                // 2. SysProductAudit for Quantities
                const auditData = productAuditSheet.getDataRange().getValues();
                const auditHeaders = auditData[0];
                const paSkuCol = auditHeaders.indexOf('pa_SKU');
                const paBruryaCol = auditHeaders.indexOf('pa_BruryaQty');
                const paStorageCol = auditHeaders.indexOf('pa_StorageQty');
                const paOfficeCol = auditHeaders.indexOf('pa_OfficeQty');
                const paShopCol = auditHeaders.indexOf('pa_ShopQty');
                const paComaxCol = auditHeaders.indexOf('pa_ComaxQty');

                const auditMap = new Map();
                for(let i=1; i<auditData.length; i++) {
                    const row = auditData[i];
                    const sku = String(row[paSkuCol]).trim();
                    auditMap.set(sku, {
                        brurya: parseFloat(row[paBruryaCol]) || 0,
                        storage: parseFloat(row[paStorageCol]) || 0,
                        office: parseFloat(row[paOfficeCol]) || 0,
                        shop: parseFloat(row[paShopCol]) || 0,
                        comax: parseFloat(row[paComaxCol]) || 0
                    });
                }

                // 3. Build Result Array
                const results = acceptedItems.map(item => {
                    const sku = item.sku;
                    const name = item.name || 'Unknown Product';
                    const stock = auditMap.get(sku) || { brurya: 0, storage: 0, office: 0, shop: 0, comax: 0 };
                    const total = stock.brurya + stock.storage + stock.office + stock.shop;

                    return {
                        taskId: item.taskId,
                        sku: sku,
                        productName: name,
                        comaxQty: stock.comax,
                        bruryaQty: stock.brurya,
                        storageQty: stock.storage,
                        officeQty: stock.office,
                        shopQty: stock.shop,
                        totalQty: total
                    };
                });

                // Sort by Name
                results.sort((a, b) => a.productName.localeCompare(b.productName));
                return results;

              } catch (e) {
                LoggerService.error(serviceName, functionName, `Error: ${e.message}`, e);
                return [];
              }
            }

            /**
             * Generates a CSV file for Comax Inventory Export based on 'Accepted' tasks.
             * @returns {Object} Result with file URL and task info.
             */
            function generateComaxInventoryExport() {
              const serviceName = 'InventoryManagementService';
              const functionName = 'generateComaxInventoryExport';
              LoggerService.info(serviceName, functionName, 'Starting Comax Inventory Export generation.');

              try {
                const allConfig = ConfigService.getAllConfig();
                const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
                const ss = SpreadsheetApp.openById(dataSpreadsheetId);
                const sheetNames = allConfig['system.sheet_names'];
                const productAuditSheet = ss.getSheetByName(sheetNames.SysProductAudit);
                const taskSheet = ss.getSheetByName(sheetNames.SysTasks);

                if (!productAuditSheet || !taskSheet) {
                  throw new Error(`Required sheets not found.`);
                }

                // 1. Find all 'Accepted' tasks to identify SKUs to export
                const taskData = taskSheet.getDataRange().getValues();
                const taskHeaders = taskData[0];
                const tStatusCol = taskHeaders.indexOf('st_Status');
                const tTypeCol = taskHeaders.indexOf('st_TaskTypeId');
                const tEntityCol = taskHeaders.indexOf('st_LinkedEntityId');
                const tIdCol = taskHeaders.indexOf('st_TaskId');

                const acceptedTaskIndices = [];
                const skusToExport = new Set();
                const relevantTypes = ['task.inventory.count', 'task.validation.comax_internal_audit'];

                // Start from 1 to skip header
                for (let i = 1; i < taskData.length; i++) {
                  const row = taskData[i];
                  if (row[tStatusCol] === 'Accepted' && relevantTypes.includes(row[tTypeCol])) {
                    const sku = String(row[tEntityCol]).trim();
                    if (sku) {
                        skusToExport.add(sku);
                        acceptedTaskIndices.push(i); // Store row index (0-based relative to data array)
                    }
                  }
                }

                if (skusToExport.size === 0) {
                    return { success: false, message: 'No accepted inventory counts found to export.' };
                }

                LoggerService.info(serviceName, functionName, `Found ${skusToExport.size} SKUs from ${acceptedTaskIndices.length} accepted tasks.`);

                // 2. Get Stock Levels from SysProductAudit for these SKUs
                const auditData = productAuditSheet.getDataRange().getValues();
                const auditHeaders = auditData[0];
                const skuColIdx = auditHeaders.indexOf('pa_SKU');
                const qtyCols = ['pa_BruryaQty', 'pa_StorageQty', 'pa_OfficeQty', 'pa_ShopQty'];
                const qtyColIndices = qtyCols.map(col => auditHeaders.indexOf(col));

                // Map SKU -> TotalQuantity
                const stockMap = new Map();
                
                for (let i = 1; i < auditData.length; i++) {
                    const row = auditData[i];
                    const sku = String(row[skuColIdx]).trim();
                    
                    if (skusToExport.has(sku)) {
                        let totalStock = 0;
                        for (const colIdx of qtyColIndices) {
                            if (colIdx !== -1) {
                                const qty = parseFloat(row[colIdx]);
                                if (!isNaN(qty)) {
                                    totalStock += qty;
                                }
                            }
                        }
                        stockMap.set(sku, totalStock);
                    }
                }

                // 3. Generate CSV Content
                let csvContent = 'SKU,Quantity\n';
                let exportedCount = 0;
                
                stockMap.forEach((qty, sku) => {
                    csvContent += `${sku},${qty}\n`; // Include all, even if qty is 0
                    exportedCount++;
                });

                // 4. Save File
                const namePattern = allConfig['system.files.output_names']?.comax_inventory_export || 'Inv-Cmx-{timestamp}.csv';
                const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
                const fileName = namePattern.replace('{timestamp}', timestamp);
                
                const exportFolderId = allConfig['system.folder.jlmops_exports']; 
                
                let folder;
                if (exportFolderId && exportFolderId.id) { // Check for .id property as some configs are objects
                   try {
                     folder = DriveApp.getFolderById(exportFolderId.id);
                   } catch (e) {
                     LoggerService.warn(serviceName, functionName, `Configured export folder not found using .id. Error: ${e.message}`);
                     folder = DriveApp.getRootFolder();
                   }
                } else if (exportFolderId) { // Fallback if it's just a string
                   try {
                     folder = DriveApp.getFolderById(exportFolderId);
                   } catch (e) {
                     LoggerService.warn(serviceName, functionName, `Configured export folder not found. Using root. Error: ${e.message}`);
                     folder = DriveApp.getRootFolder();
                   }
                } else {
                   folder = DriveApp.getRootFolder();
                }

                const file = folder.createFile(fileName, csvContent, 'text/csv');
                LoggerService.info(serviceName, functionName, `Created export file: ${fileName} with ${exportedCount} items.`);

                // 5. Update Tasks to 'Done' AND Reset WIP Counts in SysProductAudit
                const tStatusColIdx = tStatusCol + 1; 
                const tDoneDateColIdx = taskHeaders.indexOf('st_DoneDate') + 1;
                const now = new Date();

                // Prepare Audit Sheet updates
                const auditDataForReset = productAuditSheet.getDataRange().getValues();
                const auditHeadersForReset = auditDataForReset[0];
                const paSkuColIdx = auditHeadersForReset.indexOf('pa_SKU');
                const paStorageColIdx = auditHeadersForReset.indexOf('pa_StorageQty');
                const paOfficeColIdx = auditHeadersForReset.indexOf('pa_OfficeQty');
                const paShopColIdx = auditHeadersForReset.indexOf('pa_ShopQty');
                const paBruryaColIdx = auditHeadersForReset.indexOf('pa_BruryaQty');
                const paNewQtyColIdx = auditHeadersForReset.indexOf('pa_NewQty');

                const skuToRowIndexMap = new Map();
                for (let i = 1; i < auditDataForReset.length; i++) {
                    skuToRowIndexMap.set(String(auditDataForReset[i][paSkuColIdx]).trim(), i + 1); // 1-based row
                }

                // Updates array to minimize API calls (batching not strictly necessary for small sets but good practice)
                // However, for simplicity and readability in this mix, we'll iterate.
                // Actually, we should batch updates if possible, but random access makes it hard.
                // Let's do direct updates for now as export volume is typically manageable (<100 items).
                
                acceptedTaskIndices.forEach(rowIndex => {
                    // A. Update Task
                    const taskSheetRow = rowIndex + 1;
                    taskSheet.getRange(taskSheetRow, tStatusColIdx).setValue('Done');
                    if (tDoneDateColIdx > 0) {
                        taskSheet.getRange(taskSheetRow, tDoneDateColIdx).setValue(now);
                    }

                    // B. Reset SysProductAudit WIP Counts
                    // We need the SKU from the task data we already loaded
                    const sku = String(taskData[rowIndex][tEntityCol]).trim();
                    if (skuToRowIndexMap.has(sku)) {
                        const auditSheetRow = skuToRowIndexMap.get(sku);
                        
                        // 1. Reset partial counts to 0
                        if (paStorageColIdx > -1) productAuditSheet.getRange(auditSheetRow, paStorageColIdx + 1).setValue(0);
                        if (paOfficeColIdx > -1) productAuditSheet.getRange(auditSheetRow, paOfficeColIdx + 1).setValue(0);
                        if (paShopColIdx > -1) productAuditSheet.getRange(auditSheetRow, paShopColIdx + 1).setValue(0);
                        
                        // 2. Reset NewQty to match BruryaQty (Base)
                        if (paNewQtyColIdx > -1 && paBruryaColIdx > -1) {
                            const bruryaQty = productAuditSheet.getRange(auditSheetRow, paBruryaColIdx + 1).getValue();
                            productAuditSheet.getRange(auditSheetRow, paNewQtyColIdx + 1).setValue(bruryaQty);
                        }
                    }
                });
                
                SpreadsheetApp.flush(); 

                // 6. Create Confirmation Task
                const taskTitle = `Export Comax adjustments (${fileName})`;
                const taskNotes = `Comax adjustments exported (${exportedCount} items). Please verify import to Comax and close this task.`;
                const taskTypeId = 'task.confirmation.comax_inventory_export'; 
                
                const newTask = TaskService.createTask(taskTypeId, file.getId(), file.getName(), taskTitle, taskNotes);

                return { 
                  success: true, 
                  message: `Export Comax adjustments created.`,
                  fileUrl: file.getUrl(),
                  taskId: newTask.st_TaskId
                };

              } catch (e) {
                LoggerService.error(serviceName, functionName, `Export failed: ${e.message}`, e);
                throw e;
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

            /**
             * Helper function to get count of tasks by type ID and Status.
             */
            function _getOpenTaskCountByTypeIdAndStatus(taskTypeId, status) {
              const serviceName = 'InventoryManagementService';
              const functionName = '_getOpenTaskCountByTypeIdAndStatus';
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
                  if (row[taskTypeCol] === taskTypeId && row[statusCol] === status) {
                    count++;
                  }
                }
                return count;
              } catch (e) {
                LoggerService.error(serviceName, functionName, `Error getting task count for type ${taskTypeId} status ${status}: ${e.message}`, e);
                return 0;
              }
            }
        
                        /**
                         * PRIVATE Helper to identify candidates for bulk task creation.
                         * @param {Object} criteria { daysSinceLastCount, maxStockLevel, isWebOnly, isWineOnly, includeZeroStock }
                         * @returns {Array<Object>} List of candidate objects { sku, name, reason }
                         */
                        function _getBulkCandidates(criteria) {
                            const { daysSinceLastCount, maxStockLevel, isWebOnly, isWineOnly, includeZeroStock } = criteria;
                            const candidates = [];
            
                            // Validation: At least one trigger condition must be present
                            if ((daysSinceLastCount === null || daysSinceLastCount === '') && (maxStockLevel === null || maxStockLevel === '')) {
                                throw new Error("At least one condition (Days or Stock) must be specified.");
                            }
            
                            const allConfig = ConfigService.getAllConfig();
                            const cmxProdMHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
                            const sysProductAuditHeaders = allConfig['schema.data.SysProductAudit'].headers.split(',');
            
                            // Load Data
                            const cmxDataObj = ConfigService._getSheetDataAsMap('CmxProdM', cmxProdMHeaders, 'cpm_SKU');
                            // We need rows to iterate efficiently. Use map.values() to get the row objects.
                            const cmxRows = cmxDataObj.map.values();
            
                            // Audit Data (Last Count)
                            const auditDataObj = ConfigService._getSheetDataAsMap('SysProductAudit', sysProductAuditHeaders, 'pa_SKU');
                            const auditMap = auditDataObj.map;
            
                            // Open Tasks (Deduplication)
                            const taskTypeId = 'task.inventory.count';
                            const openTasks = WebAppTasks.getOpenTasksByTypeId(taskTypeId);
                            const openTaskSkus = new Set(openTasks.map(t => String(t.st_LinkedEntityId).trim()));
            
                            const today = new Date();
            
                            for (const row of cmxRows) {
                                const sku = String(row.cpm_SKU).trim();
                                
                                // A. Base Filter: Active Only
                                if (row.cpm_IsArchived) continue;
            
                                // B. Deduplication
                                if (openTaskSkus.has(sku)) continue;
            
                                // C. "Web Only" Filter
                                if (isWebOnly && !row.cpm_IsWeb) continue;
            
                                // D. "Wine Only" Filter
                                if (isWineOnly && String(row.cpm_Division) !== '1') continue;
            
                                // E. Trigger Conditions (Strict AND if provided)
                                let stockConditionMet = true;
                                if (maxStockLevel !== null && maxStockLevel !== '') {
                                    const stock = parseFloat(row.cpm_Stock);
                                    
                                    // Zero Stock Handling
                                    if (!includeZeroStock && (isNaN(stock) || stock <= 0)) {
                                         stockConditionMet = false; // Exclude zero stock if flag is false
                                    } else if (isNaN(stock) || stock >= maxStockLevel) {
                                         stockConditionMet = false; // Standard max threshold check
                                    }
                                    // Implicitly: if includeZeroStock is true and stock <= 0, it meets the condition (as 0 < maxStockLevel)
                                }
                    let daysConditionMet = true;
                    if (daysSinceLastCount !== null && daysSinceLastCount !== '') {
                        const auditEntry = auditMap.get(sku);
                        const lastCount = auditEntry ? new Date(auditEntry.pa_LastCount) : null;
                        
                        if (lastCount && !isNaN(lastCount.getTime())) {
                            const diffTime = Math.abs(today - lastCount);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                            if (diffDays <= daysSinceLastCount) {
                                daysConditionMet = false;
                            }
                        } else {
                            // Never counted? Treat as condition met
                            daysConditionMet = true;
                        }
                    }

                    if (stockConditionMet && daysConditionMet) {
                        candidates.push({
                            sku: sku,
                            name: row.cpm_NameHe,
                            reason: `Bulk Gen: ${daysConditionMet ? 'Stale Count' : ''} ${stockConditionMet ? 'Low Stock' : ''}`.trim()
                        });
                    }
                }
                return candidates;
            }

            /**
             * Previews the number of tasks that would be created by a bulk generation.
             * @param {Object} criteria 
             * @returns {Object} { success: true, candidates: Array<Object> }
             */
            function previewBulkCountTasks(criteria) {
                const serviceName = 'InventoryManagementService';
                const functionName = 'previewBulkCountTasks';
                try {
                    const candidates = _getBulkCandidates(criteria);
                    return { success: true, candidates: candidates };
                } catch (e) {
                    LoggerService.error(serviceName, functionName, `Error: ${e.message}`, e);
                    throw e;
                }
            }

            /**
             * Generates inventory count tasks in bulk based on criteria.
             * @param {Object} criteria 
             * @returns {Object} { success: true, count: number }
             */
            function generateBulkCountTasks(criteria) {
                const serviceName = 'InventoryManagementService';
                const functionName = 'generateBulkCountTasks';
                LoggerService.info(serviceName, functionName, `Starting bulk generation with criteria: ${JSON.stringify(criteria)}`);

                try {
                    const candidates = _getBulkCandidates(criteria);
                    const taskTypeId = 'task.inventory.count';
                    let createdCount = 0;

                    for (const item of candidates) {
                       try {
                           TaskService.createTask(
                               taskTypeId, 
                               item.sku, 
                               item.name,
                               `Verify Count: ${item.name}`, 
                               `Auto-generated. Reason: ${item.reason}`
                           );
                           createdCount++;
                       } catch (err) {
                           LoggerService.error(serviceName, functionName, `Failed to create task for ${item.sku}: ${err.message}`);
                       }
                    }

                    return { success: true, count: createdCount };

                } catch (e) {
                    LoggerService.error(serviceName, functionName, `Error: ${e.message}`, e);
                    throw e;
                }
            }

            /**
             * Creates a single spot-check task.
             * @param {string} sku 
             * @param {string} note 
             * @returns {Object} { success: true, taskId: string }
             */
            function createSpotCheckTask(sku, note) {
                const serviceName = 'InventoryManagementService';
                const functionName = 'createSpotCheckTask';
                
                try {
                    const cleanSku = String(sku).trim();
                    if (!cleanSku) throw new Error("SKU is required.");

                    // 1. Verify Product Exists
                    const allConfig = ConfigService.getAllConfig();
                    const cmxProdMHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
                    const cmxDataObj = ConfigService._getSheetDataAsMap('CmxProdM', cmxProdMHeaders, 'cpm_SKU');
                    
                    if (!cmxDataObj.map.has(cleanSku)) {
                        return { success: false, message: `Product with SKU '${cleanSku}' not found in Master List.` };
                    }
                    const productData = cmxDataObj.map.get(cleanSku);

                    // 2. Check Duplicates
                    const taskTypeId = 'task.inventory.count';
                    const openTasks = WebAppTasks.getOpenTasksByTypeId(taskTypeId);
                    const isDuplicate = openTasks.some(t => String(t.st_LinkedEntityId).trim() === cleanSku);

                    if (isDuplicate) {
                        return { success: false, message: `An open inventory task already exists for SKU '${cleanSku}'.` };
                    }

                    // 3. Create Task
                    const title = `Spot Check: ${productData.cpm_NameHe}`;
                    const finalNote = note ? `Spot Check. Note: ${note}` : `Spot Check requested manually.`;
                    
                    const newTask = TaskService.createTask(taskTypeId, cleanSku, productData.cpm_NameHe, title, finalNote);

                    return { success: true, taskId: newTask.st_TaskId };

                } catch (e) {
                    LoggerService.error(serviceName, functionName, `Error: ${e.message}`, e);
                    throw e;
                }
            }
        
            return {
                getStockLevel: getStockLevel,
                updateStock: updateStock,
                calculateOnHoldInventory: calculateOnHoldInventory,
                getBruryaStockList: getBruryaStockList,
                setBruryaQuantity: setBruryaQuantity,
                updateBruryaInventory: updateBruryaInventory,
                setInventoryCount: setInventoryCount,
                updatePhysicalCounts: updatePhysicalCounts,
                getBruryaSummaryStatistic: getBruryaSummaryStatistic,
                getOpenNegativeInventoryTasksCount: getOpenNegativeInventoryTasksCount,
                getOpenInventoryCountTasksCount: getOpenInventoryCountTasksCount,
                getOpenInventoryCountReviewTasksCount: getOpenInventoryCountReviewTasksCount,
                getComaxInventoryExportCount: getComaxInventoryExportCount,
                getAcceptedSyncTasks: getAcceptedSyncTasks,
                generateComaxInventoryExport: generateComaxInventoryExport,
                updateLastCount: updateLastCount,
                previewBulkCountTasks: previewBulkCountTasks,
                generateBulkCountTasks: generateBulkCountTasks,
                createSpotCheckTask: createSpotCheckTask
            };
        })();
