/**
 * @file WebAppOrders.js
 * @description This script acts as a Data Provider for all order-related data.
 * It contains reusable functions for fetching and preparing order data from the
 * backend services (e.g., OrderService) for consumption by UI View Controllers.
 */

/**
 * Gets all data required for the Admin Orders Widget.
 * @returns {Object} An object containing counts and tasks for the orders widget.
 */
function WebAppOrders_getOrdersWidgetData() {
  try {
    const orderService = new OrderService(ProductService);
    const comaxExportOrderCount = orderService.getComaxExportOrderCount();
    const onHoldCount = orderService.getOnHoldOrderCount();
    const processingCount = orderService.getProcessingOrderCount();
    const packingSlipsReadyCount = orderService.getPackingSlipsReadyCount();

    const openComaxConfirmationTasks = WebAppTasks.getOpenTasksByTypeId('task.confirmation.comax_order_export').map(task => ({
      id: task.st_TaskId,
      title: task.st_Title,
      notes: task.st_Notes
    }));

    return {
      comaxExportOrderCount: comaxExportOrderCount,
      onHoldCount: onHoldCount,
      processingCount: processingCount,
      packingSlipsReadyCount: packingSlipsReadyCount,
      openComaxConfirmationTasks: openComaxConfirmationTasks
    };
  } catch (e) {
    LoggerService.error('WebAppOrders', 'getOrdersWidgetData', e.message, e);
    return { error: 'Could not load order data.' };
  }
}

/**
 * Gets a list of open orders (on-hold or processing) with detailed information for the manager view.
 * @returns {Array<Object>} An array of open orders, each with orderId, orderDate, billing/shipping names, and shippingCity.
 */
function WebAppOrders_getOpenOrdersForManager() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const orderLogSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
    const orderMasterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);

    if (!orderLogSheet || !orderMasterSheet) {
      throw new Error('One or more required sheets are missing (SysOrdLog, WebOrdM).');
    }

    const orderLogData = orderLogSheet.getDataRange().getValues();
    const orderLogHeaders = orderLogData.shift();
    const solHeaderMap = Object.fromEntries(orderLogHeaders.map((h, i) => [h, i]));

    const orderMasterData = orderMasterSheet.getDataRange().getValues();
    const orderMasterHeaders = orderMasterData.shift();
    const womHeaderMap = Object.fromEntries(orderMasterHeaders.map((h, i) => [h, i]));
    // Create a map for quick lookup of WebOrdM data by OrderId
    const orderMasterMap = new Map(orderMasterData.map(row => [String(row[womHeaderMap['wom_OrderId']]), row]));

    const openOrders = [];
    const statusesToInclude = ['on-hold', 'processing']; // Case-sensitive as per data model

    orderLogData.forEach(row => {
      const orderId = String(row[solHeaderMap['sol_OrderId']]);
      const orderStatus = String(row[solHeaderMap['sol_OrderStatus']]).toLowerCase(); // Ensure case-insensitive comparison

      if (statusesToInclude.includes(orderStatus)) {
        const orderInfo = orderMasterMap.get(orderId);
        if (orderInfo) {
          const orderDate = orderInfo[womHeaderMap['wom_OrderDate']];
          const billingFirstName = orderInfo[womHeaderMap['wom_BillingFirstName']] || '';
          const billingLastName = orderInfo[womHeaderMap['wom_BillingLastName']] || '';
          const shippingFirstName = orderInfo[womHeaderMap['wom_ShippingFirstName']] || '';
          const shippingLastName = orderInfo[womHeaderMap['wom_ShippingLastName']] || '';
          const shippingCity = orderInfo[womHeaderMap['wom_ShippingCity']];

          openOrders.push({
            orderId: orderId,
            orderDate: Utilities.formatDate(new Date(orderDate), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
            billingName: `${billingFirstName} ${billingLastName}`.trim(),
            shippingName: `${shippingFirstName} ${shippingLastName}`.trim(),
            shippingCity: shippingCity,
            status: orderStatus // Add status for display
          });
        }
      }
    });

    // Sort orders by orderId numerically in descending order (high to low), with a fallback to string comparison
    openOrders.sort((a, b) => {
        const idA = parseInt(a.orderId, 10);
        const idB = parseInt(b.orderId, 10);

        if (isNaN(idA) || isNaN(idB)) {
            // If not purely numeric, fall back to string comparison (descending)
            return String(b.orderId).localeCompare(String(a.orderId));
        }
        return idB - idA; // Numerical descending
    });

    return openOrders;

  } catch (error) {
    LoggerService.error('WebAppOrders', 'getOpenOrdersForManager', error.message, error);
    return [];
  }
}

/**
 * Wraps the global run_exportOrdersToComax function so it can be called from the UI.
 * @returns {string} A success message.
 */
function WebAppOrders_runComaxOrderExport() {
  run_exportOrdersToComax();
  return "Comax order export initiated successfully. A confirmation task has been created.";
}

/**
 * Gets a list of orders that are ready to be packed.
 * An order is ready if it has data in SysPackingCache and has not been printed.
 * Sorted: unprinted orders first (newest order number first), then printed orders (newest first).
 * @returns {Array<Object>} A list of orders with their IDs, statuses, and customer names.
 */
function WebAppOrders_getPackableOrders() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const orderLogSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
    const orderMasterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);

    if (!orderLogSheet || !orderMasterSheet) {
      throw new Error('One or more required sheets are missing.');
    }

    const orderLogData = orderLogSheet.getDataRange().getValues();
    const orderLogHeaders = orderLogData.shift();
    const logHeaderMap = Object.fromEntries(orderLogHeaders.map((h, i) => [h, i]));

    const orderMasterData = orderMasterSheet.getDataRange().getValues();
    const orderMasterHeaders = orderMasterData.shift();
    const womHeaderMap = Object.fromEntries(orderMasterHeaders.map((h, i) => [h, i]));
    const orderMasterMap = new Map(orderMasterData.map(row => [String(row[womHeaderMap['wom_OrderId']]), row]));

    const packableOrders = [];
    const readyStatus = 'Ready';

    orderLogData.forEach(row => {
      const orderId = row[logHeaderMap['sol_OrderId']];
      const packingStatus = row[logHeaderMap['sol_PackingStatus']];
      const printedTimestamp = row[logHeaderMap['sol_PackingPrintedTimestamp']];

      if (packingStatus === readyStatus) {
        const orderInfo = orderMasterMap.get(String(orderId));
        const customerNote = orderInfo ? orderInfo[womHeaderMap['wom_CustomerNote']] : '';
        const billingFirstName = orderInfo ? orderInfo[womHeaderMap['wom_BillingFirstName']] || '' : '';
        const billingLastName = orderInfo ? orderInfo[womHeaderMap['wom_BillingLastName']] || '' : '';
        const shippingFirstName = orderInfo ? orderInfo[womHeaderMap['wom_ShippingFirstName']] || '' : '';
        const shippingLastName = orderInfo ? orderInfo[womHeaderMap['wom_ShippingLastName']] || '' : '';
        const orderNumber = orderInfo ? orderInfo[womHeaderMap['wom_OrderNumber']] || orderId : orderId;

        packableOrders.push({
          orderId: orderId,
          orderNumber: orderNumber,
          status: printedTimestamp ? 'Ready (Reprint)' : 'Ready to Print',
          isReprint: !!printedTimestamp,
          customerNote: customerNote,
          billingName: `${billingFirstName} ${billingLastName}`.trim(),
          shippingName: `${shippingFirstName} ${shippingLastName}`.trim()
        });
      }
    });

    // Sort: unprinted first, then by order number descending (newest first)
    packableOrders.sort((a, b) => {
      // First: unprinted (isReprint=false) before printed (isReprint=true)
      if (a.isReprint !== b.isReprint) {
        return a.isReprint ? 1 : -1;
      }
      // Then: by order number descending (newest first)
      const numA = parseInt(a.orderNumber, 10) || 0;
      const numB = parseInt(b.orderNumber, 10) || 0;
      return numB - numA;
    });

    return packableOrders;

  } catch (error) {
    LoggerService.error('WebAppOrders', 'getPackableOrders', error.message, error);
    return [];
  }
}

/**
 * Triggers the PrintService to generate packing slips for the selected order IDs.
 * @param {Array<string>} orderIds - The IDs of the orders to print.
 * @returns {string} The URL of the generated Google Doc.
 */
function WebAppOrders_generatePackingSlips(orderIds) {
  try {
    if (!orderIds || orderIds.length === 0) {
      throw new Error('No order IDs were provided.');
    }
    const docUrl = PrintService.printPackingSlips(orderIds);
    return docUrl;
  } catch (error) {
    LoggerService.error('WebAppOrders', 'generatePackingSlips', error.message, error);
    throw error; // Re-throw to be caught by the client-side error handler
  }
}

/**
 * Creates a new Google Doc with the provided gift message content.
 * @param {string} orderId - The ID of the order.
 * @param {string} noteContent - The content of the gift message.
 * @returns {string} The URL of the newly created Google Doc.
 */
function WebAppOrders_createGiftMessageDoc(orderId, noteContent) {
  try {
    if (!orderId || !noteContent) {
      throw new Error('Order ID and note content are required.');
    }

    const allConfig = ConfigService.getAllConfig();
    const outputFolderId = allConfig['printing.output.folder_id'].id;
    const outputFolder = DriveApp.getFolderById(outputFolderId);

    const doc = DocumentApp.create(`Gift Message for Order ${orderId}`);
    doc.getBody().setText(noteContent);
    const file = DriveApp.getFileById(doc.getId());
    outputFolder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);

    return doc.getUrl();
  } catch (error) {
    LoggerService.error('WebAppOrders', 'createGiftMessageDoc', error.message, error);
    throw error;
  }
}

/**
 * Triggers the processing of new Web Order files and immediately processes any pending jobs.
 * This is intended for manual admin control to expedite packing slip production.
 * @returns {object} A success message.
 */
function WebAppOrders_triggerWebOrderImport() {
  const serviceName = 'WebAppOrders';
  const functionName = 'triggerWebOrderImport';
  LoggerService.info(serviceName, functionName, 'Admin manually triggering Web Order import.');

  try {
    OrchestratorService.triggerWebOrderFileProcessing(); // Discover and queue new files
    OrchestratorService.processPendingJobs(); // Immediately process the queued jobs

    return { success: true, message: 'Web Order import triggered and processing initiated.' };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Error triggering Web Order import: ${e.message}`, e);
    throw e;
  }
}

