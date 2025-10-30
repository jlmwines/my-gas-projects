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
  const ORDER_SHEET_NAME = "WebOrdM"; // Assuming WebOrdM is the master order sheet
  const ORDER_ITEMS_SHEET_NAME = "WebOrdItemsM"; // Assuming WebOrdItemsM for order line items

  /**
   * Retrieves all orders from the order sheet.
   * @returns {Array<Object>} An array of order objects.
   */
  this.getAllOrders = function() {
    try {
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
        this.importWebOrdersToStaging(archiveFileId);
        this.processStagedOrders(productService);
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
      const file = DriveApp.getFileById(archiveFileId);
      const csvContent = file.getBlob().getDataAsString(ConfigService.getConfig('import.drive.web_orders').file_encoding);
      const data = Utilities.parseCsv(csvContent);

      if (data.length === 0) {
        logger.warn('Web orders file is empty. Nothing to import.');
        return;
      }

      const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const stagingSheet = spreadsheet.getSheetByName('WebOrdS');

      // Clear existing data and write new data
      stagingSheet.getRange(2, 1, stagingSheet.getMaxRows() -1, stagingSheet.getMaxColumns()).clearContent();
      const headers = data.shift();
      stagingSheet.getRange(2, 1, data.length, data[0].length).setValues(data);

      logger.info(`Successfully imported ${data.length - 1} web orders into WebOrdS.`);

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
      throw e; // Re-throw to be caught by processJob
    }
  };

  /**
   * Processes the staged orders from WebOrdS and upserts them into the master sheets.
   */
  this.processStagedOrders = function(productService) {
    const functionName = 'processStagedOrders';
    logger.info(`Starting ${functionName}...`);

    try {
      const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const stagingSheet = spreadsheet.getSheetByName('WebOrdS');
      const masterOrderSheet = spreadsheet.getSheetByName('WebOrdM');
      const masterItemSheet = spreadsheet.getSheetByName('WebOrdItemsM');
      const logSheet = spreadsheet.getSheetByName('SysOrdLog');

      // 1. Load Schemas and the new Explicit Mapping from SysConfig
      const allConfig = ConfigService.getAllConfig();
      const webOrdMHeaders = allConfig['schema.data.WebOrdM'].headers.split(',');
      const webOrdItemsMHeaders = allConfig['schema.data.WebOrdItemsM'].headers.split(',');
      const stagingToMasterMap = allConfig['map.staging_to_master.web_orders'];

      if (!stagingToMasterMap) {
        throw new Error('Configuration for \'map.staging_to_master.web_orders\' not found in SysConfig.');
      }

      // 2. Find the staging header for the Order ID from the explicit map
      let orderIdStagingHeader;
      for (const key in stagingToMasterMap) {
        if (stagingToMasterMap[key] === 'wom_OrderId') {
          orderIdStagingHeader = key;
          break;
        }
      }
      if (!orderIdStagingHeader) {
        throw new Error('Could not find staging header for \'wom_OrderId\' in the SysConfig map.');
      }
      logger.info(functionName, `Identified Order ID staging header as: ${orderIdStagingHeader}`);

      // 3. Create Header-to-Index Maps for both sheets from their live headers
      const stagingSheetHeaders = stagingSheet.getRange(1, 1, 1, stagingSheet.getLastColumn()).getValues()[0];
      const stagingHeaderMap = Object.fromEntries(stagingSheetHeaders.map((h, i) => [h, i]));
      
      const masterOrderRange = masterOrderSheet.getDataRange();
      const masterOrderData = masterOrderRange.getValues();
      const masterHeaderMap = Object.fromEntries(masterOrderData[0].map((h, i) => [h, i]));

      // 4. Prepare for Upsert
      const stagingData = stagingSheet.getDataRange().getValues();
      stagingData.shift(); // Remove header row
      logger.info(functionName, `Found ${stagingData.length} rows in the staging sheet.`);

      const orderIdCol = masterHeaderMap['wom_OrderId'];
      const masterOrderMap = new Map();
      masterOrderData.slice(1).forEach((row, index) => {
        masterOrderMap.set(String(row[orderIdCol]), index + 1); // Map ID to 1-based row index
      });
      logger.info(functionName, `Found ${masterOrderMap.size} existing orders in the master sheet.`);
      logger.info(functionName, `Master Order ID Map created. Sample IDs: ${Array.from(masterOrderMap.keys()).slice(0, 5).join(', ')}`);

      const newOrders = [];
      const newOrderLogs = [];
      const allNewOrderItems = [];
      let updatedOrderCount = 0;
      let itemMasterIdCounter = masterItemSheet.getLastRow();

      // 5. Clear existing line items for all orders in the current import batch
      const orderIdStagingCol = stagingHeaderMap[orderIdStagingHeader];
      const stagingOrderIds = new Set(stagingData.map(row => String(row[orderIdStagingCol])).filter(id => id));
      
      const masterItemsRange = masterItemSheet.getDataRange();
      const masterItemsData = masterItemsRange.getValues();
      const masterItemsHeader = masterItemsData.shift() || [];
      const woiOrderIdCol = masterItemsHeader.indexOf('woi_OrderId');
      
      const itemsToKeep = woiOrderIdCol === -1 ? masterItemsData : masterItemsData.filter(row => !stagingOrderIds.has(String(row[woiOrderIdCol])));
      if (masterItemSheet.getLastRow() > 1) {
        masterItemSheet.getRange(2, 1, masterItemSheet.getLastRow() - 1, masterItemSheet.getLastColumn()).clearContent();
      }
      if (itemsToKeep.length > 0) {
        masterItemSheet.getRange(2, 1, itemsToKeep.length, itemsToKeep[0].length).setValues(itemsToKeep);
      }
      itemMasterIdCounter = masterItemSheet.getLastRow(); // Recalculate after clearing

      logger.info(functionName, 'Starting to process staged orders...');
      for (const row of stagingData) {
        const orderId = row[orderIdStagingCol];
        const foundInMaster = masterOrderMap.has(String(orderId));
        logger.info(functionName, `Processing Staging Row. Order ID found: '${orderId}' (Type: ${typeof orderId}). Found in master map: ${foundInMaster}.`);

        if (!orderId) continue;

        // 6. Process Line Items using case-insensitive header search
        for (let i = 1; i <= 24; i++) {
            const skuHeader = Object.keys(stagingHeaderMap).find(h => h.toLowerCase() === `wos_product_item_${i}_sku`);
            const qtyHeader = Object.keys(stagingHeaderMap).find(h => h.toLowerCase() === `wos_product_item_${i}_quantity`);
            if (!skuHeader || !qtyHeader) continue;

            const sku = row[stagingHeaderMap[skuHeader]];
            const quantity = Number(row[stagingHeaderMap[qtyHeader]]);
            
            if (sku && quantity > 0) {
              const totalHeader = Object.keys(stagingHeaderMap).find(h => h.toLowerCase() === `wos_product_item_${i}_total`);
              const nameHeader = Object.keys(stagingHeaderMap).find(h => h.toLowerCase() === `wos_product_item_${i}_name`);
              const total = row[stagingHeaderMap[totalHeader]];
              const name = row[stagingHeaderMap[nameHeader]];
              const webIdEn = productService.getProductWebIdBySku(sku) || '';

              const newItemData = {
                woi_OrderItemId: ++itemMasterIdCounter,
                woi_OrderId: orderId,
                woi_WebIdEn: webIdEn,
                woi_SKU: sku,
                woi_Name: name,
                woi_Quantity: quantity,
                woi_ItemTotal: total
              };
              const itemRow = webOrdItemsMHeaders.map(header => newItemData[header] !== undefined ? newItemData[header] : '');
              allNewOrderItems.push(itemRow);
            }
        }

        // 7. Segregate New vs. Update
        const masterRowIndex = masterOrderMap.get(String(orderId));
        if (masterRowIndex) {
          // UPDATE: Surgically update the master data array in memory using the explicit map
          const rowToUpdate = masterOrderData[masterRowIndex];
          for (const sHeader in stagingToMasterMap) {
            const mHeader = stagingToMasterMap[sHeader];
            const mIndex = masterHeaderMap[mHeader];
            const sIndex = stagingHeaderMap[sHeader];
            if (mIndex !== undefined && sIndex !== undefined) {
                rowToUpdate[mIndex] = row[sIndex];
            }
          }
          updatedOrderCount++;
        } else {
          // NEW ORDER: Build the row using the explicit map
          const newOrderData = {};
          for (const sHeader in stagingToMasterMap) {
            const mHeader = stagingToMasterMap[sHeader];
            const sIndex = stagingHeaderMap[sHeader];
            if (sIndex !== undefined) {
                newOrderData[mHeader] = row[sIndex];
            }
          }
          const orderRow = webOrdMHeaders.map(header => newOrderData[header] || '');
          newOrders.push(orderRow);
          newOrderLogs.push([orderId, 'Pending', null, 'Pending', null]);
        }
      }

      logger.info(functionName, `Found ${newOrders.length} new orders to add.`);
      logger.info(functionName, `Found ${updatedOrderCount} orders to update.`);
      logger.info(functionName, `Found ${allNewOrderItems.length} new order items to add.`);
      logger.info(functionName, `Found ${newOrderLogs.length} new order logs to add.`);

      // 8. Perform Batch Writes
      if (updatedOrderCount > 0) {
        masterOrderRange.setValues(masterOrderData);
        logger.info(`Updated ${updatedOrderCount} orders in WebOrdM.`);
      }
      if (newOrders.length > 0) {
        masterOrderSheet.getRange(masterOrderSheet.getLastRow() + 1, 1, newOrders.length, newOrders[0].length).setValues(newOrders);
        logger.info(`Added ${newOrders.length} new orders to WebOrdM.`);
      }
      if (allNewOrderItems.length > 0) {
        masterItemSheet.getRange(masterItemSheet.getLastRow() + 1, 1, allNewOrderItems.length, allNewOrderItems[0].length).setValues(allNewOrderItems);
        logger.info(`Added ${allNewOrderItems.length} new order items to WebOrdItemsM.`);
      }
      if (newOrderLogs.length > 0) {
        logSheet.getRange(logSheet.getLastRow() + 1, 1, newOrderLogs.length, newOrderLogs[0].length).setValues(newOrderLogs);
        logger.info(`Added ${newOrderLogs.length} new order logs to SysOrdLog.`);
      }

      logger.info(`${functionName} completed successfully.`);

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
      throw e; // Re-throw to be caught by processJob
    }
  };
}