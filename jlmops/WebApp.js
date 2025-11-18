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
  template.initialRole = initialRole;
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
    'PackingSlips': 'PackingSlipView',
    'BruryaInventory': 'BruryaInventoryView',
    'SystemHealth': 'SystemHealthView',
    'SystemHealthWidget': 'SystemHealthWidget',
    'AdminOrders': 'AdminOrdersView',
    'AdminOrdersWidget': 'AdminOrdersWidget',
    'AdminInventory': 'AdminInventoryView',
    'AdminInventoryWidget': 'AdminInventoryWidget',
    'AdminProducts': 'AdminProductsView',
    'AdminProductsWidget': 'AdminProductsWidget',
    'ManagerInventory': 'ManagerInventoryView',
    'Development': 'DevelopmentView',
    'ProductDetails': 'ProductDetailsView',
    'Comax': 'ComaxView',
    'Web': 'WebView'
  };

  if (viewMap[viewName]) {
    return HtmlService.createHtmlOutputFromFile(viewMap[viewName]).getContent();
  }

  return `<div>View not found: ${viewName}</div>`;
}

// =================================================================
// View-Specific Data Functions
// =================================================================

/**
 * Retrieves all data for the admin dashboard in a single call.
 * This function is the single source of truth for all dashboard widgets.
 * It delegates the call to the WebAppDashboard view controller.
 * @returns {Object} An object containing all data for the admin dashboard.
 */
function getDashboardData() {
  try {
    return WebAppDashboard.getDashboardData();
  } catch (e) {
    logger.error('WebApp', 'getDashboardData', e.message, e);
    return { error: `A critical error occurred while loading dashboard data: ${e.message}` };
  }
}

function createMasterValidationJob() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
    const jobQueueSheetName = allConfig['system.sheet_names'].SysJobQueue;
    const jobQueueSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(jobQueueSheetName);
    if (!jobQueueSheet) {
      throw new Error(`Sheet '${jobQueueSheetName}' not found in spreadsheet with ID '${logSpreadsheetId}'.`);
    }

    const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
    const newJobRow = {};
    jobQueueHeaders.forEach(header => newJobRow[header] = ''); // Initialize all columns

    newJobRow.job_id = Utilities.getUuid();
    newJobRow.job_type = 'manual.validation.master';
    newJobRow.status = 'PENDING';
    newJobRow.created_timestamp = new Date();

    const rowValues = jobQueueHeaders.map(header => newJobRow[header]);
    jobQueueSheet.appendRow(rowValues);
    
    // Get the row number of the newly appended job
    const newJobRowNumber = jobQueueSheet.getLastRow();

    logger.info('WebApp', 'createMasterValidationJob', `Created new job: ${newJobRow.job_id} of type ${newJobRow.job_type} at row ${newJobRowNumber}`);

    // Directly process the validation job
    ValidationService.runCriticalValidations(newJobRow.job_type, newJobRowNumber);

    return { success: true, message: `Validation job ${newJobRow.job_id} created and processed.` };

  } catch (e) {
    logger.error('WebApp', 'createMasterValidationJob', e.message, e);
    return { success: false, error: `Failed to create validation job: ${e.message}` };
  }
}

// =================================================================
// Original Functions (Packable Orders, etc.)
// =================================================================

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
    logger.error('WebApp', 'getPackableOrders', error.message, error);
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
    logger.error('WebApp', 'generatePackingSlips', error.message, error);
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
    logger.error('WebApp', 'createGiftMessageDoc', error.message, error);
    throw error;
  }
}

/**
 * Retrieves Brurya stock data along with product names for display in the UI.
 * @returns {Array<Object>} An array of stock items, each with SKU, quantity, and product name.
 */
function getBruryaStockData() {
  try {
    const bruryaStock = inventoryManagementService.getBruryaStock();
    const skus = bruryaStock.map(item => item.sku);
    const products = ProductService.getProductsBySkus(skus); // Assuming ProductService has this method
    const productMap = new Map(products.map(p => [p.sku, p.name])); // Assuming product objects have 'sku' and 'name'

    return bruryaStock.map(item => ({
      sku: item.sku,
      bruryaQty: item.bruryaQty,
      productName: productMap.get(item.sku) || 'N/A'
    }));
  } catch (error) {
    logger.error('WebApp', 'getBruryaStockData', error.message, error);
    throw error;
  }
}

/**
 * Saves changes to Brurya inventory.
 * @param {Array<Object>} changes - An array of objects, each with 'sku' and 'quantity'.
 * @returns {boolean} True if all changes were saved successfully.
 */
function saveBruryaInventoryChanges(changes) {
  try {
    const userEmail = AuthService.getActiveUserEmail();
    let allSuccessful = true;
    changes.forEach(change => {
      const success = inventoryManagementService.setBruryaStock(change.sku, change.quantity, userEmail);
      if (!success) {
        allSuccessful = false;
        logger.warn('WebApp', 'saveBruryaInventoryChanges', `Failed to save stock for SKU: ${change.sku}`);
      }
    });
    return allSuccessful;
  } catch (error) {
    logger.error('WebApp', 'saveBruryaInventoryChanges', error.message, error);
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
    logger.error('WebApp', 'getProductNamesBySkus', error.message, error);
    throw error;
  }
}

// --- Admin & Developer Tools Functions ---

function getAdminProductData() {
  // Placeholder: In the future, this could query WebDetM for products needing verification.
  return {
    productsToVerify: 5, 
    newProducts: 2
  };
}



/**
 * Wraps the global run_exportOrdersToComax function so it can be called from the UI.
 * @returns {string} A success message.
 */
function runComaxOrderExport() {
  try {
    const pendingTask = WebAppTasks.getOpenTaskByTypeId('task.confirmation.comax_export');
    if (pendingTask) {
      return { success: false, error: `An open Comax order export is already awaiting confirmation. Please complete the existing task before creating a new one.` };
    }
    run_exportOrdersToComax();
    return { success: true, message: "Comax order export initiated successfully. A confirmation task has been created." };
  } catch (e) {
    logger.error('WebApp', 'runComaxOrderExport', e.message, e);
    return { success: false, error: `Error initiating Comax order export: ${e.message}` };
  }
}

/**
 * Confirms a Comax import by completing the associated task.
 * @param {string} taskId The ID of the task to complete.
 * @returns {boolean} True if successful.
 */
function confirmComaxImport(taskId) {
  return WebAppTasks.completeTask(taskId);
}

/**
 * Placeholder function to trigger the product count export.
 * @returns {string} A success message.
 */
function runProductCountExport() {
  // This is a placeholder. In the future, it would generate a CSV.
  const taskTitle = 'Confirm Product Count Export';
  const taskNotes = 'Product count export file has been generated. Please confirm that Comax has been updated.';
  WebAppTasks.createTask('task.confirmation.product_count_export', 'product_count_export_' + new Date().getTime(), taskTitle, taskNotes);
  return "Product count export initiated. A confirmation task has been created.";
}

/**
 * Confirms a Product Count import by completing the associated task.
 * @param {string} taskId The ID of the task to complete.
 * @returns {boolean} True if successful.
 */
function confirmProductCountImport(taskId) {
  return WebAppTasks.completeTask(taskId);
}

/**
 * Initiates the Comax inventory export process.
 * @returns {string} A success or error message.
 */
function runComaxInventoryExport() {
  try {
    const pendingTask = WebAppTasks.getOpenTaskByTypeId('task.confirmation.comax_inventory_export');
    if (pendingTask) {
      return `Error: A Comax inventory export is already awaiting confirmation (Task ID: ${pendingTask.id}). Please confirm or cancel the existing task before generating a new export.`;
    }
    InventoryManagementService.exportComaxInventory();
    return "Comax inventory export initiated successfully. A confirmation task has been created.";
  } catch (e) {
    logger.error('WebApp', 'runComaxInventoryExport', e.message, e);
    return `Error initiating Comax inventory export: ${e.message}`;
  }
}

/**
 * Confirms a Comax inventory import by completing the associated task.
 * @param {string} taskId The ID of the task to complete.
 * @returns {boolean} True if successful.
 */
function confirmComaxInventoryImport(taskId) {
  return WebAppTasks.completeTask(taskId);
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
    logger.error('WebApp', 'getSysConfigCsvAsBase64', error.message, error);
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

    logger.info('WebApp', 'runDailyCriticalValidations', `Created new daily critical validation job: ${newJobRow.job_id} of type ${newJobRow.job_type} at row ${newJobRowNumber}`);

    // Directly process the validation job
    ValidationService.runCriticalValidations(newJobRow.job_type, newJobRowNumber);

  } catch (e) {
    logger.error('WebApp', 'runDailyCriticalValidations', `Failed to run daily critical validations: ${e.message}`, e);
    // Note: Since this is a scheduled job, we don't return success/failure to a UI.
    // The status update in SysJobQueue and logging handle the reporting.
  }
}
