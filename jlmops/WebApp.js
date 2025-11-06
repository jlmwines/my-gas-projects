/**
 * @file WebApp.js
 * @description Handles web app requests for the JLMops system.
 */

/**
 * Main entry point for the web app. Serves the HTML UI.
 * @param {Object} e - The event parameter from the Apps Script trigger.
 * @returns {HtmlOutput} The HTML output to be served.
 */
function doGet(e) {
  // Handle impersonation first, if a test_user is specified in the URL.
  AuthService.handleImpersonation(e);

  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('JLMops Dashboard')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/**
 * Gets the HTML content for a specific view.
 * @param {string} viewName - The name of the view to get.
 * @returns {string} The HTML content of the view.
 */
function getView(viewName) {
  if (viewName === 'PackingSlips') {
    return HtmlService.createHtmlOutputFromFile('PackingSlipView').getContent();
  } else if (viewName === 'DisplayOrders') {
    return HtmlService.createHtmlOutputFromFile('DisplayOrdersView').getContent();
  }
  // Add more views here in the future
  return '<div>View not found</div>';
}

/**
 * Gets a list of orders that are ready to be packed.
 * An order is ready if it has data in SysPackingCache and has not been printed.
 * @returns {Array<Object>} A list of orders with their IDs and statuses.
 */
function getPackableOrders() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const orderLogSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);

    if (!orderLogSheet) {
      throw new Error('Sheet SysOrdLog not found.');
    }

    const orderLogData = orderLogSheet.getDataRange().getValues();
    const orderLogHeaders = orderLogData.shift();
    const headerMap = Object.fromEntries(orderLogHeaders.map((h, i) => [h, i]));

    const packableOrders = [];
    const readyStatus = 'Ready';

    orderLogData.forEach(row => {
      const orderId = row[headerMap['sol_OrderId']];
      const packingStatus = row[headerMap['sol_PackingStatus']];
      const printedTimestamp = row[headerMap['sol_PackingPrintedTimestamp']];

      if (packingStatus === readyStatus) {
        packableOrders.push({
          orderId: orderId,
          status: printedTimestamp ? 'Ready (Reprint)' : 'Ready to Print',
          isReprint: !!printedTimestamp
        });
      }
    });

    return packableOrders;

  } catch (error) {
    LoggerService.logError('getPackableOrders', error.message, error.stack);
    return [];
  }
}

/**
 * Triggers the PrintService to generate packing slips for the selected order IDs.
 * @param {Array<string>} orderIds - The IDs of the orders to print.
 * @returns {string} The URL of the generated Google Doc.
 */
function generatePackingSlips(orderIds) {
  try {
    if (!orderIds || orderIds.length === 0) {
      throw new Error('No order IDs were provided.');
    }
    const docUrl = PrintService.printPackingSlips(orderIds);
    return docUrl;
  } catch (error) {
    LoggerService.logError('generatePackingSlips', error.message, error.stack);
    throw error; // Re-throw to be caught by the client-side error handler
  }
}

/**
 * [NEW] Fetches packable orders for the test display view.
 * @returns {Array<Object>} A list of orders with their IDs and statuses.
 */
function displayPackableOrders() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const orderLogSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);

    if (!orderLogSheet) {
      throw new Error('Sheet SysOrdLog not found.');
    }

    const orderLogData = orderLogSheet.getDataRange().getValues();

    // Robustness check for an empty sheet
    if (!orderLogData || orderLogData.length === 0) {
      logger.info('displayPackableOrders', 'SysOrdLog sheet is empty. No orders to process.', '');
      return [];
    }

    const orderLogHeaders = orderLogData.shift();
    const headerMap = Object.fromEntries(orderLogHeaders.map((h, i) => [h, i]));

    const packableOrders = [];
    const readyStatus = 'Ready';

    orderLogData.forEach(row => {
      const orderId = row[headerMap['sol_OrderId']];
      const packingStatus = row[headerMap['sol_PackingStatus']];
      const printedTimestamp = row[headerMap['sol_PackingPrintedTimestamp']];

      if (packingStatus === readyStatus) {
        packableOrders.push({
          orderId: orderId,
          status: printedTimestamp ? 'Ready (Reprint)' : 'Ready to Print',
          isReprint: !!printedTimestamp
        });
      }
    });

    return packableOrders;

  } catch (error) {
    logger.error('displayPackableOrders', error.message, error);
    return [];
  }
}
