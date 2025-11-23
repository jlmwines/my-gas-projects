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
 * @returns {Array<Object>} A list of orders with their IDs and statuses.
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
        packableOrders.push({
          orderId: orderId,
          status: printedTimestamp ? 'Ready (Reprint)' : 'Ready to Print',
          isReprint: !!printedTimestamp,
          customerNote: customerNote
        });
      }
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
