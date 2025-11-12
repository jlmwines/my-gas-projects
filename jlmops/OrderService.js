/**
 * @file OrderService.js
 * @description This service manages orders.
 */

/**
 * OrderService provides methods for managing order data.
 * @param {ProductService} productService An instance of the ProductService.
 */
function OrderService(productService) {
  const _productService = productService;

  /**
   * Retrieves all orders from the order sheet.
   * @returns {Array<Object>} An array of order objects.
   */
  this.getAllOrders = function() {
    try {
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const ORDER_SHEET_NAME = sheetNames.WebOrdM;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(ORDER_SHEET_NAME);

      if (!sheet) {
        logger.error(`Order sheet '${ORDER_SHEET_NAME}' not found.`);
        return [];
      }

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length === 0) {
        logger.info(`No data found in order sheet '${ORDER_SHEET_NAME}'.`);
        return [];
      }

      const headers = values[0];
      const orders = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const order = {};
        headers.forEach((header, index) => {
          order[header] = row[index];
        });
        orders.push(order);
      }

      logger.info(`Successfully retrieved ${orders.length} orders from '${ORDER_SHEET_NAME}'.`);
      return orders;

    } catch (e) {
      logger.error(`Error getting all orders: ${e.message}`, e);
      return [];
    }
  };

  /**
   * Retrieves a single order by its ID.
   * @param {string} orderId The ID of the order to retrieve.
   * @returns {Object|null} The order object if found, otherwise null.
   */
  this.getOrderById = function(orderId) {
    try {
      const orders = this.getAllOrders(); // For simplicity, fetch all and filter
      const order = orders.find(o => o.ID === orderId || o.OrderNumber === orderId); // Assuming 'ID' or 'OrderNumber' as identifier

      if (order) {
        logger.info(`Found order with ID/OrderNumber: ${orderId}`);
      } else {
        logger.warn(`Order with ID/OrderNumber: ${orderId} not found.`);
      }
      return order || null;

    } catch (e) {
      logger.error(`Error getting order by ID ${orderId}: ${e.message}`, e);
      return null;
    }
  };

  /**
   * Retrieves order items for a given order ID.
   * This is a placeholder and needs full implementation.
   * @param {string} orderId The ID of the order whose items to retrieve.
   * @returns {Array<Object>} An array of order item objects.
   */
  this.getOrderItems = function(orderId) {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const ORDER_ITEMS_SHEET_NAME = sheetNames.WebOrdItemsM;
    logger.info(`Attempting to retrieve items for order ID: ${orderId}. (Placeholder: Full implementation needed)`);
    // TODO: Implement logic to fetch order items from ORDER_ITEMS_SHEET_NAME
    // Filter by orderId
    return [];
  };

  // TODO: Add methods for updating order status, creating new orders, etc.
  // this.updateOrderStatus = function(orderId, newStatus) { ... };
  // this.createOrder = function(orderData) { ... };

  /**
   * Processes an order-related job from the job queue.
   * @param {string} jobType The type of job to process.
   * @param {number} rowNumber The row number of the job in the queue.
   */
  this.processJob = function(jobType, rowNumber, productService) {    logger.info(`OrderService processing job '${jobType}' on row ${rowNumber}`);
    try {
      const allConfig = ConfigService.getAllConfig();
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
      const archiveFileIdColIdx = jobQueueHeaders.indexOf('archive_file_id');
      const archiveFileId = jobQueueSheet.getRange(rowNumber, archiveFileIdColIdx + 1).getValue();

      if (jobType === 'import.drive.web_orders') {
        const ordersWithLineItems = this.importWebOrdersToStaging(archiveFileId);
        this.processStagedOrders(ordersWithLineItems, productService);
      }
      jobQueueSheet.getRange(rowNumber, jobQueueHeaders.indexOf('status') + 1).setValue('COMPLETED');
    } catch (e) {
      logger.error(`Failed to process job on row ${rowNumber}: ${e.message}`);
      const allConfig = ConfigService.getAllConfig();
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
      const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
      jobQueueSheet.getRange(rowNumber, jobQueueHeaders.indexOf('status') + 1).setValue('FAILED');
      jobQueueSheet.getRange(rowNumber, jobQueueHeaders.indexOf('error_message') + 1).setValue(e.message);
    }
  };

  /**
   * Imports the content of a given CSV file into the WebOrdS staging sheet.
   * @param {string} archiveFileId The ID of the file in the archive to import.
   */
  this.importWebOrdersToStaging = function(archiveFileId) {
    const functionName = 'importWebOrdersToStaging';
    logger.info(`Starting ${functionName} for file ID: ${archiveFileId}`);

    try {
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];

      // 1. Parse raw CSV into structured objects
      const file = DriveApp.getFileById(archiveFileId);
      const csvContent = file.getBlob().getDataAsString(ConfigService.getConfig('import.drive.web_orders').file_encoding);
      const ordersWithLineItems = WebAdapter.processOrderCsv(csvContent, 'map.web.order_columns', 'web.order.line_item_schema');

      if (ordersWithLineItems.length === 0) {
        logger.warn('Web orders file is empty or contains no valid orders. Nothing to import.');
        return []; // Return empty array if no orders
      }
      logger.info(`Successfully parsed ${ordersWithLineItems.length} web orders with line items.`);

      // 2. Write the structured data to the WebOrdS staging sheet
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const stagingSheet = spreadsheet.getSheetByName(sheetNames.WebOrdS);
      if (!stagingSheet) {
          throw new Error("Sheet 'WebOrdS' not found in the JLMops_Data spreadsheet.");
      }
      
      const stagingHeaders = stagingSheet.getRange(1, 1, 1, stagingSheet.getLastColumn()).getValues()[0];
      const stagingData = ordersWithLineItems.map(order => {
        return stagingHeaders.map(header => order[header] || '');
      });

      // Clear only data rows
      if (stagingSheet.getMaxRows() > 1) {
        stagingSheet.getRange(2, 1, stagingSheet.getMaxRows() - 1, stagingSheet.getMaxColumns()).clearContent();
      }
      
      // Write new data
      if (stagingData.length > 0) {
        stagingSheet.getRange(2, 1, stagingData.length, stagingData[0].length).setValues(stagingData);
        logger.info(`Successfully wrote ${stagingData.length} processed orders to the WebOrdS staging sheet.`);
      }

      // 3. Return the in-memory object for immediate processing
      return ordersWithLineItems;

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
      throw e; // Re-throw to be caught by processJob
    }
  };



  this.exportOrdersToComax = function() {
    const functionName = 'exportOrdersToComax';
    logger.info(`Starting ${functionName}...`);

    try {
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
      const masterItemSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);

      if (!logSheet || !masterItemSheet) {
        throw new Error("One or more required sheets (SysOrdLog, WebOrdItemsM) not found.");
      }

      // 1. Get order statuses from WebOrdM for filtering
      const masterOrderSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
      if (!masterOrderSheet) {
        throw new Error("Sheet 'WebOrdM' not found.");
      }
      const webOrdMData = masterOrderSheet.getDataRange().getValues();
      const webOrdMHeaders = webOrdMData.shift();
      const womOrderIdCol = webOrdMHeaders.indexOf('wom_OrderId');
      const womStatusCol = webOrdMHeaders.indexOf('wom_Status');

      if (womOrderIdCol === -1 || womStatusCol === -1) {
        throw new Error("Could not find 'wom_OrderId' or 'wom_Status' in WebOrdM sheet.");
      }

      const orderStatusMap = new Map();
      webOrdMData.forEach(row => {
        const orderId = row[womOrderIdCol];
        const status = String(row[womStatusCol] || '').trim().toLowerCase();
        if (orderId) {
          orderStatusMap.set(String(orderId), status);
        }
      });
      logger.info(`Created status map for ${orderStatusMap.size} orders from WebOrdM.`);

      // 2. Find orders to export from SysOrdLog
      const logData = logSheet.getDataRange().getValues();
      const logHeaders = logData.shift();
      const comaxExportStatusCol = logHeaders.indexOf('sol_ComaxExportStatus');
      const orderIdCol = logHeaders.indexOf('sol_OrderId');

      if (comaxExportStatusCol === -1 || orderIdCol === -1) {
        throw new Error("Could not find required columns 'sol_ComaxExportStatus' or 'sol_OrderId' in SysOrdLog sheet. Please check sheet headers.");
      }
      
      logger.info(`Found ${logData.length} total logs in SysOrdLog.`);

      const ordersToExport = logData.filter(row => {
        const orderId = String(row[orderIdCol]);
        const exportStatus = String(row[comaxExportStatusCol] || '').trim().toLowerCase();
        const orderStatus = orderStatusMap.get(orderId);

        const isNotExported = exportStatus !== 'exported';
        const isEligibleStatus = orderStatus === 'processing' || orderStatus === 'completed';
        
        return isNotExported && isEligibleStatus;
      });
      
      logger.info(`Found ${ordersToExport.length} orders with eligible status ('processing' or 'completed') that have not been exported.`);

      const orderIdsToExport = new Set(ordersToExport.map(row => row[orderIdCol]));

      if (orderIdsToExport.size === 0) {
        logger.info("No orders to export to Comax.");
        return;
      }

      // 2. Aggregate line items
      const itemData = masterItemSheet.getDataRange().getValues();
      const itemHeaders = itemData.shift();
      const itemOrderIdCol = itemHeaders.indexOf('woi_OrderId');
      const itemSkuCol = itemHeaders.indexOf('woi_SKU');
      const itemQuantityCol = itemHeaders.indexOf('woi_Quantity');

      const comaxExportData = {}; // { SKU: quantity }

      for (const itemRow of itemData) {
        const orderId = itemRow[itemOrderIdCol];
        if (orderIdsToExport.has(orderId)) {
          const sku = itemRow[itemSkuCol];
          const quantity = parseFloat(itemRow[itemQuantityCol]);
          if (!isNaN(quantity)) {
            comaxExportData[sku] = (comaxExportData[sku] || 0) + quantity;
          }
        }
      }

      // 3. Generate CSV
      const csvRows = [['SKU', 'Quantity']];
      for (const sku in comaxExportData) {
        csvRows.push([sku, comaxExportData[sku]]);
      }
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      logger.info(`Generated CSV content:\n${csvContent}`);

      // 4. Save CSV to Drive
      const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
      logger.info(`Using export folder ID: ${exportFolderId}`);

      const exportFolder = DriveApp.getFolderById(exportFolderId);
      if (!exportFolder) {
        throw new Error(`Failed to find export folder with ID: ${exportFolderId}. Please check configuration and folder permissions.`);
      }
      logger.info(`Successfully retrieved export folder: ${exportFolder.getName()}`);

      const fileName = `ComaxExport_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm')}.csv`;
      const file = exportFolder.createFile(fileName, csvContent, MimeType.CSV);
      logger.info(`Comax export file created: ${file.getName()} (ID: ${file.getId()})`);

      // 5. Update SysOrdLog
      const now = new Date();
      const comaxExportTimestampCol = logHeaders.indexOf('sol_ComaxExportTimestamp');
      
      for (const row of ordersToExport) {
        const rowIndex = logData.indexOf(row) + 2; // +2 for header and 1-based index
        logSheet.getRange(rowIndex, comaxExportStatusCol + 1).setValue('Exported');
        logSheet.getRange(rowIndex, comaxExportTimestampCol + 1).setValue(now);
      }
      
      logger.info(`Updated ${ordersToExport.length} orders in SysOrdLog to 'Exported'.`);

      // Create a task for admin confirmation
      const taskTitle = 'Confirm Comax Order Export';
      const taskNotes = `Comax order export file ${file.getName()} has been generated. Please confirm that Comax has processed this file before the next product update.`;
      TaskService.createTask('task.confirmation.comax_export', file.getId(), taskTitle, taskNotes);

      logger.info(`${functionName} completed successfully.`);

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
      throw e;
    }
  };

  this.prepareInitialPackingData = function(orderIds) {
    const functionName = 'prepareInitialPackingData';
    logger.info(`Starting ${functionName} for ${orderIds.length} orders...`);

    try {
        if (!orderIds || orderIds.length === 0) {
            logger.info('No order IDs provided for initial packing data preparation. Exiting.');
            return;
        }

        const allConfig = ConfigService.getAllConfig();
        const sheetNames = allConfig['system.sheet_names'];
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

        const masterItemSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
        const cacheSheet = spreadsheet.getSheetByName(sheetNames.SysPackingCache);
        const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);

        if (!masterItemSheet || !cacheSheet || !logSheet) {
            throw new Error('One or more required sheets for initial packing data preparation are missing.');
        }

        const eligibleOrderIds = new Set(orderIds.map(String));

        // 1. Get all items for the eligible orders
        const allItems = masterItemSheet.getDataRange().getValues();
        const itemHeaders = allItems.shift();
        const woiOrderIdCol = itemHeaders.indexOf('woi_OrderId');
        const woiWebIdEnCol = itemHeaders.indexOf('woi_WebIdEn');
        const woiSkuCol = itemHeaders.indexOf('woi_SKU');
        const woiQuantityCol = itemHeaders.indexOf('woi_Quantity');

        const itemsForEligibleOrders = allItems.filter(itemRow => eligibleOrderIds.has(String(itemRow[woiOrderIdCol])));

        // 2. Prepare the basic data for the cache
        const cacheHeaders = cacheSheet.getRange(1, 1, 1, cacheSheet.getLastColumn()).getValues()[0];
        const headerMap = Object.fromEntries(cacheHeaders.map((h, i) => [h, i]));
        
        const newCacheRows = itemsForEligibleOrders.map(item => {
            const newRow = new Array(cacheHeaders.length).fill('');
            newRow[headerMap['spc_OrderId']] = item[woiOrderIdCol];
            newRow[headerMap['spc_WebIdEn']] = item[woiWebIdEnCol];
            newRow[headerMap['spc_SKU']] = item[woiSkuCol];
            newRow[headerMap['spc_Quantity']] = item[woiQuantityCol];
            return newRow;
        });

        // 3. Perform an "upsert" into the cache sheet
        const existingCacheData = cacheSheet.getLastRow() > 1 ? cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, cacheSheet.getLastColumn()).getValues() : [];
        const spcOrderIdColIdx = headerMap['spc_OrderId'];

        const otherOrdersCacheData = existingCacheData.filter(row => !eligibleOrderIds.has(String(row[spcOrderIdColIdx])));
        const finalCacheData = otherOrdersCacheData.concat(newCacheRows);

        if (cacheSheet.getLastRow() > 1) {
            cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, cacheSheet.getMaxColumns()).clearContent();
        }
        if (finalCacheData.length > 0) {
            cacheSheet.getRange(2, 1, finalCacheData.length, finalCacheData[0].length).setValues(finalCacheData);
        }
        logger.info(`Upserted ${newCacheRows.length} item rows for ${eligibleOrderIds.size} orders into SysPackingCache.`);

        // 4. Now, call the PackingSlipService to enrich this data
        PackingSlipService.preparePackingData(orderIds);
        logger.info(`Successfully triggered PackingSlipService to enrich data for ${orderIds.length} orders.`);

    } catch (e) {
        logger.error(`Error in ${functionName}: ${e.message}`, e);
        throw e;
    }
  };

  this.processStagedOrders = function(ordersWithLineItems, productService) {
    const functionName = 'processStagedOrders';
    logger.info(`Starting ${functionName}...`);

    try {
        const allConfig = ConfigService.getAllConfig();
        const sheetNames = allConfig['system.sheet_names'];
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
        const masterOrderSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
        const masterItemSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
        const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);

        if (!ordersWithLineItems || ordersWithLineItems.length === 0) {
            logger.warn('No staged orders to process.');
            return;
        }

        // --- 1. Load Schemas and Existing Data into Memory ---
        const webOrdMHeaders = allConfig['schema.data.WebOrdM'].headers.split(',');
        const webOrdItemsMHeaders = allConfig['schema.data.WebOrdItemsM'].headers.split(',');
        const logHeaders = allConfig['schema.data.SysOrdLog'].headers.split(',');
        const stagingToMasterMap = allConfig['map.staging_to_master.web_orders'];
        const masterOrderIdHeader = allConfig['order.master_order_id_header'].header;
        const masterStatusHeader = allConfig['order.master_status_header'].header;
        const MUTABLE_STATUSES = allConfig['order.mutable_statuses'].statuses.split(',');
        const INELIGIBLE_ORDER_STATUSES = ['pending', 'cancelled', 'refunded', 'failed', 'trash'];
        const LOCKED_PACKING_STATUSES = ['processing', 'completed'];

        const masterOrderData = masterOrderSheet.getDataRange().getValues();
        const masterHeaderMap = Object.fromEntries(masterOrderData[0].map((h, i) => [h, i]));
        const masterOrderMap = new Map();
        masterOrderData.slice(1).forEach((row, index) => {
            const orderId = String(row[masterHeaderMap[masterOrderIdHeader]]);
            if (orderId) {
                masterOrderMap.set(orderId, { rowIndex: index + 2, status: String(row[masterHeaderMap[masterStatusHeader]]).toLowerCase() });
            }
        });

        const logData = logSheet.getLastRow() > 1 ? logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logHeaders.length).getValues() : [];
        const logHeaderMap = Object.fromEntries(logHeaders.map((h, i) => [h, i]));
        const logOrderMap = new Map();
        logData.forEach((row, index) => {
            const orderId = String(row[logHeaderMap['sol_OrderId']]);
            if (orderId) {
                logOrderMap.set(orderId, { rowIndex: index, data: row });
            }
        });

        // --- 2. Transform and Categorize Staged Orders ---
        const masterOrders = ordersWithLineItems.map(stagedOrder => {
            const masterOrder = { lineItems: stagedOrder.lineItems };
            for (const sKey in stagingToMasterMap) {
                if (stagedOrder.hasOwnProperty(sKey)) {
                    masterOrder[stagingToMasterMap[sKey]] = stagedOrder[sKey];
                }
            }
            return masterOrder;
        });

        const newOrders = [];
        const ordersToFullUpdate = [];
        const ordersToStatusOnlyUpdate = [];
        const orderIdsToRefresh = new Set();

        for (const order of masterOrders) {
            const orderId = String(order[masterOrderIdHeader]).trim();
            if (!orderId) continue;

            const masterOrderEntry = masterOrderMap.get(orderId);
            const foundInMaster = !!masterOrderEntry;
            const currentMasterStatus = foundInMaster ? masterOrderEntry.status : '';
            const stagedStatus = (order[masterStatusHeader] || '').toLowerCase();

            const existingLogEntry = logOrderMap.get(orderId);
            const priorOrderStatusInLog = existingLogEntry ? existingLogEntry.data[logHeaderMap['sol_OrderStatus']] : '';

            let shouldUpdatePackingStatus = true;
            // Rule A: Lock-in Rule
            if (LOCKED_PACKING_STATUSES.includes(priorOrderStatusInLog)) {
                shouldUpdatePackingStatus = false;
            }

            // Categorize order for master sheet update
            if (!foundInMaster) {
                newOrders.push({ data: order, orderId: orderId, lineItems: order.lineItems });
            } else {
                // Rule B (On-Hold) and general updates trigger a full update of line items
                if (currentMasterStatus !== stagedStatus || MUTABLE_STATUSES.includes(currentMasterStatus) || priorOrderStatusInLog === 'on-hold') {
                    ordersToFullUpdate.push({ data: order, masterRowIndex: masterOrderEntry.rowIndex, orderId: orderId, lineItems: order.lineItems });
                } else {
                    ordersToStatusOnlyUpdate.push({ data: order, masterRowIndex: masterOrderEntry.rowIndex, orderId: orderId, lineItems: order.lineItems });
                }
            }

            // Create or update log entry in memory
            if (shouldUpdatePackingStatus) {
                const isEligibleForPacking = !INELIGIBLE_ORDER_STATUSES.includes(stagedStatus);
                const newPackingStatus = isEligibleForPacking ? 'Eligible' : 'Ineligible';

                if (existingLogEntry) {
                    const logRowIndex = existingLogEntry.rowIndex;
                    logData[logRowIndex][logHeaderMap['sol_OrderStatus']] = stagedStatus;
                    logData[logRowIndex][logHeaderMap['sol_PackingStatus']] = newPackingStatus;
                }
                else {
                    const newLog = new Array(logHeaders.length).fill('');
                    newLog[logHeaderMap['sol_OrderId']] = orderId;
                    newLog[logHeaderMap['sol_OrderDate']] = order['wom_OrderDate'];
                    newLog[logHeaderMap['sol_OrderStatus']] = stagedStatus;
                    newLog[logHeaderMap['sol_PackingStatus']] = newPackingStatus;
                    newLog[logHeaderMap['sol_ComaxExportStatus']] = 'Pending';
                    logData.push(newLog);
                }
                if (isEligibleForPacking) {
                    orderIdsToRefresh.add(orderId);
                }
            } else if (existingLogEntry) {
                // Still update the order status in the log, even if packing status is locked
                const logRowIndex = existingLogEntry.rowIndex;
                logData[logRowIndex][logHeaderMap['sol_OrderStatus']] = stagedStatus;
            }
        }

        // --- 3. Perform Batch Updates (Master and Items) ---
        const orderIdsToClearItems = new Set();
        newOrders.forEach(o => orderIdsToClearItems.add(o.orderId));
        ordersToFullUpdate.forEach(o => orderIdsToClearItems.add(o.orderId));
        ordersToStatusOnlyUpdate.forEach(o => orderIdsToClearItems.add(o.orderId));

        if (orderIdsToClearItems.size > 0) {
            const masterItemsData = masterItemSheet.getDataRange().getValues();
            const masterItemsHeader = masterItemsData.shift() || [];
            const woiOrderIdCol = masterItemsHeader.indexOf('woi_OrderId');
            const itemsToKeep = woiOrderIdCol === -1 ? masterItemsData : masterItemsData.filter(row => !orderIdsToClearItems.has(String(row[woiOrderIdCol]).trim()));
            if (masterItemSheet.getLastRow() > 1) {
                masterItemSheet.getRange(2, 1, masterItemSheet.getLastRow() - 1, masterItemSheet.getMaxColumns()).clearContent();
            }
            if (itemsToKeep.length > 0) {
                masterItemSheet.getRange(2, 1, itemsToKeep.length, itemsToKeep[0].length).setValues(itemsToKeep);
            }
        }

        let itemMasterIdCounter = masterItemSheet.getLastRow();
        const allNewOrderItems = [];
        const processLineItems = (order) => {
            if (!order.lineItems) return;
            for (const item of order.lineItems) {
                if (!item.SKU) {
                    continue; 
                }
                const webIdEn = productService.getProductWebIdBySku(item.SKU) || '';
                if (!webIdEn) {
                    logger.warn(`OrderService:processLineItems`, `SKU-to-WebIdEn lookup failed for SKU [${item.SKU}] in Order ID [${order.orderId}].`);
                }
                const newItemData = { woi_OrderItemId: ++itemMasterIdCounter, woi_OrderId: order.orderId, woi_WebIdEn: webIdEn, woi_SKU: item.SKU, woi_Name: item.Name, woi_Quantity: item.Quantity, woi_ItemTotal: item.Total };
                allNewOrderItems.push(webOrdItemsMHeaders.map(header => newItemData[header] !== undefined ? newItemData[header] : ''));
            }
        };
        newOrders.forEach(processLineItems);
        ordersToFullUpdate.forEach(processLineItems);
        ordersToStatusOnlyUpdate.forEach(processLineItems);

        if (ordersToFullUpdate.length > 0) {
            const range = masterOrderSheet.getRange(2, 1, masterOrderSheet.getLastRow() - 1, masterOrderSheet.getMaxColumns());
            const values = range.getValues();
            ordersToFullUpdate.forEach(order => {
                const rowIndex = order.masterRowIndex - 2;
                webOrdMHeaders.forEach((mHeader, mIndex) => {
                    if (order.data[mHeader] !== undefined) {
                        values[rowIndex][mIndex] = (mHeader === 'wom_OrderDate' && order.data[mHeader]) ? "'" + order.data[mHeader] : order.data[mHeader];
                    }
                });
            });
            range.setValues(values);
        }
        if (ordersToStatusOnlyUpdate.length > 0) {
            const range = masterOrderSheet.getRange(2, 1, masterOrderSheet.getLastRow() - 1, masterOrderSheet.getMaxColumns());
            const values = range.getValues();
            ordersToStatusOnlyUpdate.forEach(order => {
                const rowIndex = order.masterRowIndex - 2;
                values[rowIndex][masterHeaderMap[masterStatusHeader]] = order.data[masterStatusHeader];
            });
            range.setValues(values);
        }
        if (newOrders.length > 0) {
            const newOrderRows = newOrders.map(order => webOrdMHeaders.map(header => (header === 'wom_OrderDate' && order.data[header]) ? "'" + order.data[header] : order.data[header] || ''));
            masterOrderSheet.getRange(masterOrderSheet.getLastRow() + 1, 1, newOrderRows.length, newOrderRows[0].length).setValues(newOrderRows);
        }
        if (allNewOrderItems.length > 0) {
            masterItemSheet.getRange(masterItemSheet.getLastRow() + 1, 1, allNewOrderItems.length, allNewOrderItems[0].length).setValues(allNewOrderItems);
        }
        SpreadsheetApp.flush(); // Force all pending spreadsheet changes to be written.

        // --- 4. Batch Write to SysOrdLog ---
        if (logSheet.getLastRow() > 1) {
            logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logHeaders.length).clearContent();
        }
        if (logData.length > 0) {
            logSheet.getRange(2, 1, logData.length, logHeaders.length).setValues(logData);
            logger.info(`Upserted ${logData.length} total logs in SysOrdLog.`);
        }

        // --- 5. Trigger Enrichment for Eligible Orders ---
        if (orderIdsToRefresh.size > 0) {
            logger.info(`Triggering packing data preparation for ${orderIdsToRefresh.size} orders.`);
            this.prepareInitialPackingData(Array.from(orderIdsToRefresh));
        }

        logger.info(`${functionName} completed successfully.`);

    } catch (e) {
        logger.error(`Error in ${functionName}: ${e.message}`, e);
        throw e;
        }
      };
    
      this.getComaxExportOrderCount = function() {
        const functionName = 'getComaxExportOrderCount';
        try {
          const allConfig = ConfigService.getAllConfig();
          const sheetNames = allConfig['system.sheet_names'];
          const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
          const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
          const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
          const masterOrderSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    
          if (!logSheet || !masterOrderSheet) {
            throw new Error("One or more required sheets (SysOrdLog, WebOrdM) not found.");
          }
    
          const webOrdMData = masterOrderSheet.getDataRange().getValues();
          const webOrdMHeaders = webOrdMData.shift();
          const womOrderIdCol = webOrdMHeaders.indexOf('wom_OrderId');
          const womStatusCol = webOrdMHeaders.indexOf('wom_Status');
          const orderStatusMap = new Map();
          webOrdMData.forEach(row => {
            const orderId = row[womOrderIdCol];
            const status = String(row[womStatusCol] || '').trim().toLowerCase();
            if (orderId) {
              orderStatusMap.set(String(orderId), status);
            }
          });
    
          const logData = logSheet.getDataRange().getValues();
          const logHeaders = logData.shift();
          const comaxExportStatusCol = logHeaders.indexOf('sol_ComaxExportStatus');
          const orderIdCol = logHeaders.indexOf('sol_OrderId');
    
          const ordersToExport = logData.filter(row => {
            const orderId = String(row[orderIdCol]);
            const exportStatus = String(row[comaxExportStatusCol] || '').trim().toLowerCase();
            const orderStatus = orderStatusMap.get(orderId);
            const isNotExported = exportStatus !== 'exported';
            const isEligibleStatus = orderStatus === 'processing' || orderStatus === 'completed';
            return isNotExported && isEligibleStatus;
          });
          
          return ordersToExport.length;
    
        } catch (e) {
          logger.error(`Error in ${functionName}: ${e.message}`, e);
          return -1; // Return -1 to indicate an error to the frontend
        }
      };
    } // Closing for OrderService
    
    /**
     * Wrapper function to allow manual execution of the Comax export from the Apps Script editor.
 */
function run_exportOrdersToComax() {
  // ProductService is a global singleton object, so we pass it directly.
  const orderService = new OrderService(ProductService);
  orderService.exportOrdersToComax();
}

