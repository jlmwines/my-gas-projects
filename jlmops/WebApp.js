/**
 * @file WebApp.js
 * @description Handles web app requests for the JLMops system.
 */

/**
 * Includes an HTML file's content.
 * @param {string} filename - The name of the HTML file to include.
 * @returns {string} The content of the HTML file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Main entry point for the web app. Serves the HTML UI.
 * @param {Object} e - The event parameter from the Apps Script trigger.
 * @returns {HtmlOutput} The HTML output to be served.
 */
function doGet(e) {
  const initialRole = AuthService.getActiveUserRole();

  if (initialRole === 'viewer') {
    return HtmlService.createHtmlOutputFromFile('AccessDenied.html')
      .setTitle('JLMops - Access Denied')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  }

  const template = HtmlService.createTemplateFromFile('AppView.html');
  
  let effectiveRole = initialRole;
  // If the initial role is not 'admin' (and not 'viewer' as that's handled), default to 'manager'.
  if (effectiveRole !== 'admin') {
    effectiveRole = 'manager';
  }
  template.initialRole = effectiveRole;
  template.availableRoles = AuthService.getAvailableRoles();
  
  return template.evaluate()
    .setTitle('JLMops Dashboard')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function getDashboardForRole(role) {
  switch (role) {
    case 'admin':
      return include('AdminDashboardView.html');
    case 'manager':
      return include('ManagerDashboardView.html');
    default:
      return '<div>Invalid role selected.</div>';
  }
}


/**
 * Gets the HTML content for a specific view.
 * @param {string} viewName - The name of the view to get.
 * @returns {string} The HTML content of the view.
 */
function getView(viewName) {
  const viewMap = {
    'AdminDashboard': 'AdminDashboardView',
    'ManagerDashboard': 'ManagerDashboardView',
    'SystemHealth': 'SystemHealthView',
    'SystemHealthWidget': 'SystemHealthWidget',
    'AdminOrders': 'AdminOrdersView',
    'AdminOrdersWidget': 'AdminOrdersWidget',
    'ManagerOrders': 'ManagerOrdersView',
    'ManagerOrdersWidget': 'ManagerOrdersWidget',
    'AdminInventory': 'AdminInventoryView',
    'AdminInventoryWidget': 'AdminInventoryWidget',
    'ManagerInventory': 'ManagerInventoryView',
    'ManagerInventoryWidget': 'ManagerInventoryWidget',
    'ManagerProducts': 'ManagerProductsView',
    'ManagerProductsWidget': 'ManagerProductsWidget',
    'AdminProducts': 'AdminProductsView',
    'AdminProductsWidget': 'AdminProductsWidget',
    'AdminDailySyncWidget': 'AdminDailySyncWidget',
    'AdminSyncView': 'AdminSyncView', // NEW SYNC VIEW
    'Development': 'DevelopmentView',
    'Comax': 'ComaxView',
    'Web': 'WebView'
  };

  if (viewMap[viewName]) {
    return HtmlService.createHtmlOutputFromFile(viewMap[viewName]).getContent();
  }

  return `<div>View not found: ${viewName}</div>`;
}

/**
 * Gets the raw HTML content for a specific file.
 * This is used for dynamically loading widget HTML into views.
 * @param {string} filename - The name of the HTML file to get.
 * @returns {string} The raw HTML content of the file.
 */
function getHtmlOutput(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    LoggerService.error('WebApp', 'getHtmlOutput', `Failed to get HTML content for ${filename}: ${e.message}`, e);
    throw new Error(`Failed to load HTML content for ${filename}.`);
  }
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
    LoggerService.error('WebApp', 'getPackableOrders', error.message, error);
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
    LoggerService.error('WebApp', 'generatePackingSlips', error.message, error);
    throw error; // Re-throw to be caught by the client-side error handler
  }
}

/**
 * Creates a new Google Doc with the provided gift message content.
 * @param {string} orderId - The ID of the order.
 * @param {string} noteContent - The content of the gift message.
 * @returns {string} The URL of the newly created Google Doc.
 */
function createGiftMessageDoc(orderId, noteContent) {
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
    LoggerService.error('WebApp', 'createGiftMessageDoc', error.message, error);
    throw error;
  }
}



/**
 * Retrieves product names for a given list of SKUs.
 * @param {Array<string>} skus - An array of SKUs.
 * @returns {Object} A map where keys are SKUs and values are product names.
 */
function getProductNamesBySkus(skus) {
  try {
    const products = ProductService.getProductsBySkus(skus); // Assuming ProductService has this method
    const productNamesMap = {};
    products.forEach(p => {
      productNamesMap[p.sku] = p.name; // Assuming product objects have 'sku' and 'name'
    });
    return productNamesMap;
  } catch (error) {
    LoggerService.error('WebApp', 'getProductNamesBySkus', error.message, error);
    throw error;
  }
}

// --- Admin & Developer Tools Functions ---

/**
 * Functions for the Development View Wishlist.
 * Reads content from a hard-coded Google Sheet cell.
 * @returns {string} The content of the wishlist.
 */
function getDevWishlistContent() {
  try {
    const spreadsheetId = '1ESV9fJHKykPzy3kS88S9FWF46YodTuJ35O8MvfVModM';
    const sheetName = 'Wishlist';
    const cell = 'A2'; // Hard-coded cell for the single block of text.
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (!sheet) {
      return `Sheet "${sheetName}" not found.`;
    }
    return sheet.getRange(cell).getValue();
  } catch (e) {
    return 'Error loading wishlist: ' + e.message;
  }
}

/**
 * Saves content to a hard-coded Google Sheet cell.
 * @param {string} content - The content to save.
 * @returns {string} A success message.
 */
function saveDevWishlistContent(content) {
  try {
    const spreadsheetId = '1ESV9fJHKykPzy3kS88S9FWF46YodTuJ35O8MvfVModM';
    const sheetName = 'Wishlist';
    const cell = 'A2'; // Hard-coded cell
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange('A1').setValue('Wish'); // Add a header
    }
    sheet.getRange(cell).setValue(content);
    return 'Wishlist saved successfully.';
  } catch (e) {
    throw new Error('Failed to save wishlist: ' + e.message);
  }
}



















/**
 * Wraps the global rebuildSysConfigFromSource function so it can be called from the UI.
 * @returns {string} A success message.
 */
function runRebuildSysConfigFromSource() {
  rebuildSysConfigFromSource();
  return "SysConfig rebuild initiated successfully. It may take a moment to complete.";
}

/**
 * Reads the SysConfigSnapshot.csv file and returns it as a Base64 encoded string.
 * @returns {Object} An object with the filename and Base64 content.
 */
function getSysConfigCsvAsBase64() {
  try {
    const fileName = 'SysConfigSnapshot.csv';
    const file = DriveApp.getFilesByName(fileName).next();
    const blob = file.getBlob();
    const content = Utilities.base64Encode(blob.getBytes());
    return {
      filename: fileName,
      content: content
    };
  } catch (error) {
    LoggerService.error('WebApp', 'getSysConfigCsvAsBase64', error.message, error);
    throw new Error('Could not retrieve SysConfig snapshot file.');
  }
}

/**
 * Global function to be called by a daily Apps Script trigger for critical validations.
 * It creates a job in SysJobQueue and then delegates to ValidationService.runCriticalValidations.
 */
function runDailyCriticalValidations() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
    const jobQueueSheetName = allConfig['system.sheet_names'].SysJobQueue;
    const jobQueueSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(jobQueueSheetName);
    if (!jobQueueSheet) {
      throw new Error(`Sheet '${jobQueueSheetName}' not found in spreadsheet with ID '${logSpreadreadId}'.`);
    }

    const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
    const newJobRow = {};
    jobQueueHeaders.forEach(header => newJobRow[header] = ''); // Initialize all columns

    newJobRow.job_id = Utilities.getUuid();
    newJobRow.job_type = 'daily.validation.critical'; // A new job type for daily critical validations
    newJobRow.status = 'PENDING';
    newJobRow.created_timestamp = new Date();

    const rowValues = jobQueueHeaders.map(header => newJobRow[header]);
    jobQueueSheet.appendRow(rowValues);
    
    // Get the row number of the newly appended job
    const newJobRowNumber = jobQueueSheet.getLastRow();

    LoggerService.info('WebApp', 'runDailyCriticalValidations', `Created new daily critical validation job: ${newJobRow.job_id} of type ${newJobRow.job_type} at row ${newJobRowNumber}`);

    // Directly process the validation job
    ValidationService.runCriticalValidations(newJobRow.job_type, newJobRowNumber);

  } catch (e) {
    LoggerService.error('WebApp', 'runDailyCriticalValidations', `Failed to run daily critical validations: ${e.message}`, e);
    // Note: Since this is a scheduled job, we don't return success/failure to a UI.
    // The status update in SysJobQueue and logging handle the reporting.
  }
}
