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

  this.preparePackingData = function() {
    const functionName = 'preparePackingData';
    logger.info(`Starting ${functionName}...`);

    try {
        const allConfig = ConfigService.getAllConfig();
        const sheetNames = allConfig['system.sheet_names'];
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

        const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
        const logArchiveSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM_Archive);
        const masterOrderSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
        const masterItemSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
        const detailSheet = spreadsheet.getSheetByName(sheetNames.WebDetM);
        const cacheSheet = spreadsheet.getSheetByName(sheetNames.SysPackingCache);

        if (!logSheet || !masterOrderSheet || !masterItemSheet || !detailSheet || !cacheSheet) {
            throw new Error('One or more required sheets for packing data preparation are missing.');
        }

        // 1. Get all printed order IDs from SysOrdLog and WebOrdM_Archive
        const allPrintedOrderIds = new Set();
        const logData = logSheet.getDataRange().getValues();
        const logHeaders = logData.shift();
        const logOrderIdCol = logHeaders.indexOf('sol_OrderId');
        const logPrintedDateCol = logHeaders.indexOf('sol_PackingPrintedTimestamp');

        logData.forEach(row => {
            if (row[logPrintedDateCol] !== null && String(row[logPrintedDateCol]).trim() !== '') {
                allPrintedOrderIds.add(String(row[logOrderIdCol]));
            }
        });

        if (logArchiveSheet && logArchiveSheet.getLastRow() > 1) {
            const logArchiveData = logArchiveSheet.getDataRange().getValues();
            const logArchiveHeaders = logArchiveData.shift();
            const archiveOrderIdCol = logArchiveHeaders.indexOf('woma_OrderId');
            if (archiveOrderIdCol !== -1) {
                logArchiveData.forEach(row => {
                    allPrintedOrderIds.add(String(row[archiveOrderIdCol]));
                });
            }
        }
        logger.info(`Found ${allPrintedOrderIds.size} printed order IDs.`);

        // 2. Find eligible orders
        const webOrdMData = masterOrderSheet.getDataRange().getValues();
        const webOrdMHeaders = webOrdMData.shift();
        const womOrderIdCol = webOrdMHeaders.indexOf('wom_OrderId');
        const womStatusCol = webOrdMHeaders.indexOf('wom_Status');
        logger.info(`Evaluating ${webOrdMData.length} orders from WebOrdM.`);

        const eligibleOrders = webOrdMData.filter(row => {
            const orderId = String(row[womOrderIdCol]);
            const status = (row[womStatusCol] || '').toLowerCase().trim();
            return status === 'on-hold' || (['processing', 'completed'].includes(status) && !allPrintedOrderIds.has(orderId));
        });

        logger.info(`Found ${eligibleOrders.length} eligible orders.`);
        if (eligibleOrders.length === 0) {
            logger.info('No eligible orders to prepare for packing. Exiting.');
            return;
        }
        
        const eligibleOrderIds = new Set(eligibleOrders.map(row => row[womOrderIdCol]));

        // 3. Get data from other sheets
        const webOrdItemsMData = masterItemSheet.getDataRange().getValues();
        const webOrdItemsMHeaders = webOrdItemsMData.shift();

        const webDetMData = detailSheet.getDataRange().getValues();
        const webDetMHeaders = webDetMData.shift();
        const webDetMMap = webDetMData.reduce((map, row) => {
            map.set(row[webDetMHeaders.indexOf('wdm_WebIdEn')], row);
            return map;
        }, new Map());
        logger.info(`webDetMMap keys: ${Array.from(webDetMMap.keys())}`);

        // 4. Prepare cache data
        const cacheData = [];
        const cacheHeaders = cacheSheet.getRange(1, 1, 1, cacheSheet.getLastColumn()).getValues()[0];

        // Get WebDetM headers for column indexing
        const wdmWebIdEnCol = webDetMHeaders.indexOf('wdm_WebIdEn');
        const wdmNameEnCol = webDetMHeaders.indexOf('wdm_NameEn');
        const wdmNameHeCol = webDetMHeaders.indexOf('wdm_NameHe');
        const wdmIntensityCol = webDetMHeaders.indexOf('wdm_Intensity');
        const wdmComplexityCol = webDetMHeaders.indexOf('wdm_Complexity');
        const wdmAcidityCol = webDetMHeaders.indexOf('wdm_Acidity');
        const wdmDecantCol = webDetMHeaders.indexOf('wdm_Decant');
        const wdmPairHarMildCol = webDetMHeaders.indexOf('wdm_PairHarMild');
        const wdmPairHarRichCol = webDetMHeaders.indexOf('wdm_PairHarRich');
        const wdmPairHarIntenseCol = webDetMHeaders.indexOf('wdm_PairHarIntense');
        const wdmPairHarSweetCol = webDetMHeaders.indexOf('wdm_PairHarSweet');
        const wdmPairConMildCol = webDetMHeaders.indexOf('wdm_PairConMild');
        const wdmPairConRichCol = webDetMHeaders.indexOf('wdm_PairConRich');
        const wdmPairConIntenseCol = webDetMHeaders.indexOf('wdm_PairConIntense');
        const wdmPairConSweetCol = webDetMHeaders.indexOf('wdm_PairConSweet');


        eligibleOrderIds.forEach(orderId => {
            const orderItems = webOrdItemsMData.filter(item => String(item[webOrdItemsMHeaders.indexOf('woi_OrderId')]) === String(orderId));
            logger.info(`Found ${orderItems.length} items for order ${orderId}.`);
            orderItems.forEach(item => {
                const webIdEn = item[webOrdItemsMHeaders.indexOf('woi_WebIdEn')];
                logger.info(`Processing item with webIdEn: ${webIdEn}`);
                const sku = item[webOrdItemsMHeaders.indexOf('woi_SKU')];
                const quantity = item[webOrdItemsMHeaders.indexOf('woi_Quantity')];

                const productDetails = webDetMMap.get(webIdEn) || []; // Get the full WebDetM row

                const newRow = cacheHeaders.map(header => {
                    switch (header) {
                        case 'spc_OrderId': return orderId;
                        case 'spc_WebIdEn': return webIdEn;
                        case 'spc_SKU': return sku;
                        case 'spc_Quantity': return quantity;
                        case 'spc_NameEn': return productDetails[wdmNameEnCol] || '';
                        case 'spc_NameHe': return productDetails[wdmNameHeCol] || '';
                        case 'spc_Intensity': return productDetails[wdmIntensityCol] || '';
                        case 'spc_Complexity': return productDetails[wdmComplexityCol] || '';
                        case 'spc_Acidity': return productDetails[wdmAcidityCol] || '';
                        case 'spc_Decant': return productDetails[wdmDecantCol] || '';
                        case 'spc_PairHarMild': return productDetails[wdmPairHarMildCol] || '';
                        case 'spc_PairHarRich': return productDetails[wdmPairHarRichCol] || '';
                        case 'spc_PairHarIntense': return productDetails[wdmPairHarIntenseCol] || '';
                        case 'spc_PairHarSweet': return productDetails[wdmPairHarSweetCol] || '';
                        case 'spc_PairConMild': return productDetails[wdmPairConMildCol] || '';
                        case 'spc_PairConRich': return productDetails[wdmPairConRichCol] || '';
                        case 'spc_PairConIntense': return productDetails[wdmPairConIntenseCol] || '';
                        case 'spc_PairConSweet': return productDetails[wdmPairConSweetCol] || '';
                        default: return '';
                    }
                });
                cacheData.push(newRow);
            });
        });
        logger.info(`Prepared ${cacheData.length} rows for SysPackingCache.`);

        // 5. Populate cache sheet
        if (cacheSheet.getLastRow() > 1) {
            cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, cacheSheet.getMaxColumns()).clearContent();
        }
        if (cacheData.length > 0) {
            cacheSheet.getRange(2, 1, cacheData.length, cacheData[0].length).setValues(cacheData);
        }

        logger.info(`Successfully prepared packing data for ${eligibleOrders.length} orders.`);

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

      // 1. Load Schemas and Mapping from SysConfig
      const webOrdMHeaders = allConfig['schema.data.WebOrdM'].headers.split(',');
      const webOrdItemsMHeaders = allConfig['schema.data.WebOrdItemsM'].headers.split(',');
      const stagingToMasterMap = allConfig['map.staging_to_master.web_orders'];

      if (!stagingToMasterMap) {
        throw new Error("Configuration for 'map.staging_to_master.web_orders' not found.");
      }

      // 2. Transform staged orders (wos_ keys) to master orders (wom_ keys)
      const masterOrders = ordersWithLineItems.map(stagedOrder => {
        const masterOrder = { lineItems: stagedOrder.lineItems }; // Preserve line items
        for (const sKey in stagingToMasterMap) {
          if (stagedOrder.hasOwnProperty(sKey)) {
            const mKey = stagingToMasterMap[sKey];
            let value = stagedOrder[sKey];

            // Force string format for date to prevent auto-formatting
            if (mKey === 'wom_OrderDate' && value) {
              value = "'" + value;
            }

            masterOrder[mKey] = value;
          }
        }
        return masterOrder;
      });

      if (masterOrders.length > 0) {
        // No longer logging transformed keys, as it's not needed for production
      }

      // 3. Prepare for Upsert
      const masterOrderIdHeader = allConfig['order.master_order_id_header'].header;
      const masterStatusHeader = allConfig['order.master_status_header'].header;

      const MUTABLE_STATUSES = allConfig['order.mutable_statuses'].statuses.split(',');
      const STATUS_ONLY_UPDATE_STATUSES = allConfig['order.status_only_update_statuses'].statuses.split(',');

      const masterOrderRange = masterOrderSheet.getDataRange();
      const masterOrderData = masterOrderRange.getValues();
      const masterHeaderMap = Object.fromEntries(masterOrderData[0].map((h, i) => [h, i]));

      const orderIdCol = masterHeaderMap[masterOrderIdHeader];
      const statusCol = masterHeaderMap[masterStatusHeader];
      const masterOrderMap = new Map();
      masterOrderData.slice(1).forEach((row, index) => {
        const orderId = row[orderIdCol];
        if (orderId) {
          masterOrderMap.set(String(orderId), { rowIndex: index + 2, status: String(row[statusCol]).toLowerCase() });
        }
      });

      const newOrders = [];
      const ordersToFullUpdate = [];
      const ordersToStatusOnlyUpdate = [];
      const newOrderLogs = [];
      const allNewOrderItems = [];
      let itemMasterIdCounter = masterItemSheet.getLastRow();

      // 4. Categorize staged orders
      logger.info(functionName, 'Starting to categorize staged orders...');
      for (const order of masterOrders) {
        const orderId = String(order[masterOrderIdHeader]).trim();
        if (!orderId) {
          continue;
        }

        const masterOrderEntry = masterOrderMap.get(orderId);
        const foundInMaster = masterOrderEntry !== undefined;
        const currentMasterStatus = foundInMaster ? masterOrderEntry.status : '';
        const stagedStatus = (order[masterStatusHeader] || '').toLowerCase();

        if (!foundInMaster) {
          const orderRow = webOrdMHeaders.map(header => order[header] || '');
          newOrders.push({ data: order, masterRow: orderRow, orderId: orderId, lineItems: order.lineItems });
          newOrderLogs.push([orderId, order['wom_OrderDate'], 'Pending', null, 'Pending', null]);
        } else if (currentMasterStatus === stagedStatus) {
            // Skipping order as status has not changed
        } else if (MUTABLE_STATUSES.includes(currentMasterStatus)) {
          ordersToFullUpdate.push({ data: order, masterRowIndex: masterOrderEntry.rowIndex, orderId: orderId, lineItems: order.lineItems });
        } else if (STATUS_ONLY_UPDATE_STATUSES.includes(stagedStatus)){
          ordersToStatusOnlyUpdate.push({ data: order, masterRowIndex: masterOrderEntry.rowIndex, orderId: orderId });
        } else {
          // Log unhandled status combinations for debugging if needed
        }
      }

      // 5. Clear existing line items for orders that are new or fully mutable
      const orderIdsToClearItems = new Set();
      newOrders.forEach(o => orderIdsToClearItems.add(o.orderId));
      ordersToFullUpdate.forEach(o => orderIdsToClearItems.add(o.orderId));
      
      if (orderIdsToClearItems.size > 0) {
        const masterItemsRange = masterItemSheet.getDataRange();
        const masterItemsData = masterItemsRange.getValues();
        const masterItemsHeader = masterItemsData.shift() || [];
        const woiOrderIdCol = masterItemsHeader.indexOf('woi_OrderId');
        
        const itemsToKeep = woiOrderIdCol === -1 ? masterItemsData : masterItemsData.filter(row => !orderIdsToClearItems.has(String(row[woiOrderIdCol]).trim()));
        
        if (masterItemSheet.getLastRow() > 1) {
          masterItemSheet.getRange(2, 1, masterItemSheet.getLastRow() - 1, masterItemSheet.getMaxColumns()).clearContent();
        }
        if (itemsToKeep.length > 0) {
          masterItemSheet.getRange(2, 1, itemsToKeep.length, itemsToKeep[0].length).setValues(itemsToKeep);
        }
        itemMasterIdCounter = masterItemSheet.getLastRow();
      }

      // 6. Process line items for new and fully mutable orders
      const processLineItems = (order) => {
        if (!order.lineItems) return;
        for (const item of order.lineItems) {
          const webIdEn = productService.getProductWebIdBySku(item.SKU) || '';
          const newItemData = {
            woi_OrderItemId: ++itemMasterIdCounter,
            woi_OrderId: order.orderId,
            woi_WebIdEn: webIdEn,
            woi_SKU: item.SKU,
            woi_Name: item.Name,
            woi_Quantity: item.Quantity,
            woi_ItemTotal: item.Total
          };
          allNewOrderItems.push(webOrdItemsMHeaders.map(header => newItemData[header] !== undefined ? newItemData[header] : ''));
        }
      };

      newOrders.forEach(processLineItems);
      ordersToFullUpdate.forEach(processLineItems);

      // 7. Perform Batch Writes
      const statusOnlyLogUpdates = [];
      if (ordersToFullUpdate.length > 0) {
          const range = masterOrderSheet.getRange(2, 1, masterOrderSheet.getLastRow() -1, masterOrderSheet.getMaxColumns());
          const values = range.getValues();
          ordersToFullUpdate.forEach(order => {
              const rowIndex = order.masterRowIndex - 2;
              webOrdMHeaders.forEach((mHeader, mIndex) => {
                  if (order.data[mHeader] !== undefined) {
                      values[rowIndex][mIndex] = order.data[mHeader];
                  }
              });
          });
          range.setValues(values);
          logger.info(`Batch updated ${ordersToFullUpdate.length} full-update orders in WebOrdM.`);
      }
      if (ordersToStatusOnlyUpdate.length > 0) {
          const range = masterOrderSheet.getRange(2, 1, masterOrderSheet.getLastRow() -1, masterOrderSheet.getMaxColumns());
          const values = range.getValues();
           ordersToStatusOnlyUpdate.forEach(order => {
              const rowIndex = order.masterRowIndex - 2;
              const newStatus = order.data[masterStatusHeader];
              const statusColIdx = masterHeaderMap[masterStatusHeader];
              if (statusColIdx !== undefined && newStatus !== undefined) {
                  values[rowIndex][statusColIdx] = newStatus;
              }
              statusOnlyLogUpdates.push([order.orderId, order.data['wom_OrderDate'], newStatus, null, newStatus, null]);
          });
          range.setValues(values);
          logger.info(`Batch updated ${ordersToStatusOnlyUpdate.length} status-only orders in WebOrdM.`);
      }

      if (newOrders.length > 0) {
        const newOrderRows = newOrders.map(order => order.masterRow);
        masterOrderSheet.getRange(masterOrderSheet.getLastRow() + 1, 1, newOrderRows.length, newOrderRows[0].length).setValues(newOrderRows);
        logger.info(`Added ${newOrders.length} new orders to WebOrdM.`);
      }

      if (allNewOrderItems.length > 0) {
        masterItemSheet.getRange(masterItemSheet.getLastRow() + 1, 1, allNewOrderItems.length, allNewOrderItems[0].length).setValues(allNewOrderItems);
        logger.info(`Added ${allNewOrderItems.length} items to WebOrdItemsM.`);
      }

      const logsToAdd = [...newOrderLogs, ...statusOnlyLogUpdates];
      if (logsToAdd.length > 0) {
        logSheet.getRange(logSheet.getLastRow() + 1, 1, logsToAdd.length, logsToAdd[0].length).setValues(logsToAdd);
        logger.info(`Added ${logsToAdd.length} logs to SysOrdLog.`);
      }

      logger.info(`${functionName} completed successfully.`);

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
      throw e;
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

