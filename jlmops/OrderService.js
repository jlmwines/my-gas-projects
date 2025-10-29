/**
 * @file OrderService.js
 * @description This service manages orders.
 */

/**
 * OrderService provides methods for managing order data.
 */
function OrderService() {
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
  this.processJob = function(jobType, rowNumber) {
    logger.info(`OrderService processing job '${jobType}' on row ${rowNumber}`);
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
        this.processStagedOrders();
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
      stagingSheet.clear();
      stagingSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

      // Format header
      stagingSheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');

      logger.info(`Successfully imported ${data.length - 1} web orders into WebOrdS.`);

    } catch (e) {
      logger.error(`Error in ${functionName}: ${e.message}`, e);
      throw e; // Re-throw to be caught by processJob
    }
  };

  /**
   * Processes the staged orders from WebOrdS and upserts them into the master sheets.
   */
  this.processStagedOrders = function() {
    const functionName = 'processStagedOrders';
    logger.info(`Starting ${functionName}...`);

    try {
      const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const stagingSheet = spreadsheet.getSheetByName('WebOrdS');
      const masterOrderSheet = spreadsheet.getSheetByName('WebOrdM');
      const masterItemSheet = spreadsheet.getSheetByName('WebOrdItemsM');
      const logSheet = spreadsheet.getSheetByName('SysOrdLog');

      const stagingData = stagingSheet.getDataRange().getValues();
      const stagingHeaders = stagingData.shift();
      logger.info(functionName, `Found ${stagingData.length} rows in the staging sheet.`);

      // Get all config at once
      const allConfig = ConfigService.getAllConfig();
      const webOrdMHeaders = allConfig['schema.data.WebOrdM'].headers.split(',');
      const webOrdItemsMHeaders = allConfig['schema.data.WebOrdItemsM'].headers.split(',');
      const sysOrdLogHeaders = allConfig['schema.data.SysOrdLog'].headers.split(',');

      // Create header maps for easy column index lookup
      const stagingHeaderMap = Object.fromEntries(stagingHeaders.map((h, i) => [h, i]));
      const masterOrderHeaderMap = Object.fromEntries(webOrdMHeaders.map((h, i) => [h, i]));

      // Get existing order NUMBERS from WebOrdM to check for updates
      const masterOrderData = masterOrderSheet.getDataRange().getValues();
      const masterOrderNumbers = new Set(masterOrderData.slice(1).map(row => String(row[masterOrderHeaderMap['wom_OrderNumber']])));
      logger.info(functionName, `Found ${masterOrderNumbers.size} existing orders in the master sheet.`);

      const newOrders = [];
      const newOrderItems = [];
      const newOrderLogs = [];
      let itemMasterIdCounter = masterItemSheet.getLastRow(); // Start from the last row + 1

      logger.info(functionName, 'Starting to process staged orders...');
      for (const row of stagingData) {
        const orderNumber = row[stagingHeaderMap['wos_OrderNumber']];

        // Ensure the staging ID is also a string before comparison
        if (orderNumber && !masterOrderNumbers.has(String(orderNumber))) {
          // This is a new order, so we add it.
          const orderId = row[stagingHeaderMap['wos_OrderId']];
          
          const newOrderData = {
            wom_OrderId: orderId,
            wom_OrderNumber: orderNumber,
            wom_OrderDate: row[stagingHeaderMap['wos_OrderDate']],
            wom_Status: row[stagingHeaderMap['wos_Status']],
            wom_CustomerNote: row[stagingHeaderMap['wos_CustomerNote']],
            wom_BillingFirstName: row[stagingHeaderMap['wos_BillingFirstName']],
            wom_BillingLastName: row[stagingHeaderMap['wos_BillingLastName']],
            wom_BillingEmail: row[stagingHeaderMap['wos_BillingEmail']],
            wom_BillingPhone: row[stagingHeaderMap['wos_BillingPhone']],
            wom_ShippingFirstName: row[stagingHeaderMap['wos_ShippingFirstName']],
            wom_ShippingLastName: row[stagingHeaderMap['wos_ShippingLastName']],
            wom_ShippingAddress1: row[stagingHeaderMap['wos_ShippingAddress1']],
            wom_ShippingAddress2: row[stagingHeaderMap['wos_ShippingAddress2']],
            wom_ShippingCity: row[stagingHeaderMap['wos_ShippingCity']],
            wom_ShippingPhone: row[stagingHeaderMap['wos_ShippingPhone']]
          };
          const orderRow = webOrdMHeaders.map(header => newOrderData[header] || '');
          newOrders.push(orderRow);

          // Create log entry
          newOrderLogs.push([orderId, 'Pending', null, 'Pending', null]);

          // Process line items
          for (let i = 1; i <= 24; i++) {
            const sku = row[stagingHeaderMap[`wos_ProductItem${i}SKU`]];
            const quantity = row[stagingHeaderMap[`wos_ProductItem${i}Quantity`]];
            const total = row[stagingHeaderMap[`wos_ProductItem${i}Total`]];
            const name = row[stagingHeaderMap[`wos_ProductItem${i}Name`]];
            const webIdEn = productService.getProductWebIdBySku(sku) || '';
            
            if (sku && quantity > 0) {
              const newItemData = {
                woi_OrderItemId: itemMasterIdCounter++,
                woi_OrderId: orderId,
                woi_WebIdEn: webIdEn,
                woi_SKU: sku,
                woi_Name: name,
                woi_Quantity: quantity,
                woi_ItemTotal: total
              };
              const itemRow = webOrdItemsMHeaders.map(header => newItemData[header] !== undefined ? newItemData[header] : '');
              newOrderItems.push(itemRow);
            }
          }
        } else if (orderNumber) {
          logger.info(functionName, `Skipping order number ${orderNumber} as it already exists in the master sheet.`);
        }
      }

      logger.info(functionName, `Found ${newOrders.length} new orders to add.`);
      logger.info(functionName, `Found ${newOrderItems.length} new order items to add.`);
      logger.info(functionName, `Found ${newOrderLogs.length} new order logs to add.`);

      // Write new data to sheets
      if (newOrders.length > 0) {
        masterOrderSheet.getRange(masterOrderSheet.getLastRow() + 1, 1, newOrders.length, newOrders[0].length).setValues(newOrders);
        logger.info(`Added ${newOrders.length} new orders to WebOrdM.`);
      }
      if (newOrderItems.length > 0) {
        masterItemSheet.getRange(masterItemSheet.getLastRow() + 1, 1, newOrderItems.length, newOrderItems[0].length).setValues(newOrderItems);
        logger.info(`Added ${newOrderItems.length} new order items to WebOrdItemsM.`);
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

// Global instance for easy access throughout the project
const orderService = new OrderService();