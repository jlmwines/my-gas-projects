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

  // --- TEMPORARY WORKAROUND ---
  // Force the user to be admin to unblock frontend development.
  // This will be removed once role-switching is fully debugged.
  if (!e.parameter.test_user) {
    PropertiesService.getUserProperties().setProperty('impersonated_user', 'accounts@jlmwines.com');
  }

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
  const adminViews = ['SystemHealth', 'SystemHealthWidget', 'AdminOrders', 'AdminOrdersWidget', 'AdminInventory', 'AdminInventoryWidget', 'AdminProducts', 'AdminProductsWidget', 'Development', 'Comax', 'Web', 'ProductDetails'];
  const managerViews = ['ManagerInventory'];

  // Basic security check
  const role = AuthService.getActiveUserRole();
  if (role !== 'admin' && adminViews.includes(viewName)) {
    return '<div>You do not have permission to view this page.</div>';
  }
  if (role !== 'manager' && role !== 'admin' && managerViews.includes(viewName)) {
     return '<div>You do not have permission to view this page.</div>';
  }

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

function getSystemHealthMetrics() {
  const allConfig = ConfigService.getAllConfig();
  const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
  const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
  const sheetNames = allConfig['system.sheet_names'];

  const taskSheet = logSpreadsheet.getSheetByName(sheetNames.SysTasks);
  const taskData = taskSheet.getLastRow() > 1 ? taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues() : [];
  const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
  const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));

  let translationMissing = 0;
  let skuNotInComax = 0;
  let notOnWebInComax = 0;

  taskData.forEach(row => {
    const status = row[taskHeaderMap['st_Status']];
    const typeId = row[taskHeaderMap['st_TaskTypeId']];
    if (status !== 'Done' && status !== 'Cancelled') {
      if (typeId === 'task.validation.translation_missing') {
        translationMissing++;
      }
      if (typeId === 'task.validation.sku_not_in_comax') {
        skuNotInComax++;
      }
      if (typeId === 'task.validation.not_on_web_in_comax') {
        notOnWebInComax++;
      }
    }
  });

  const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
  const jobStatuses = jobQueueSheet.getRange('C2:C').getValues().flat();
  const quarantinedJobs = jobStatuses.filter(s => s === 'QUARANTINED').length;

  const logSheet = logSpreadsheet.getSheetByName(sheetNames.SysLog);
  const logData = logSheet.getLastRow() > 1 ? logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logSheet.getLastColumn()).getValues() : [];
  const logHeaders = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
  const logHeaderMap = Object.fromEntries(logHeaders.map((h, i) => [h, i]));
  
  let recentErrors = 0;
  let lastValidationTime = 'N/A';
  const twentyFourHoursAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));

  for (let i = logData.length - 1; i >= 0; i--) {
    const row = logData[i];
    const timestamp = new Date(row[logHeaderMap['sl_Timestamp']]);
    const level = row[logHeaderMap['sl_LogLevel']];
    const service = row[logHeaderMap['sl_ServiceName']];
    const func = row[logHeaderMap['sl_FunctionName']];

    if (level === 'ERROR' && timestamp > twentyFourHoursAgo) {
      recentErrors++;
    }
    if (lastValidationTime === 'N/A' && service === 'ProductService' && func === '_runMasterValidation') {
      lastValidationTime = timestamp.toLocaleString();
    }
  }

  return {
    translationMissing,
    skuNotInComax,
    notOnWebInComax,
    quarantinedJobs,
    recentErrors,
    lastValidationTime
  };
}

function getSystemHealthData() {
  if (AuthService.getActiveUserRole() !== 'admin') {
    throw new Error('Permission denied.');
  }
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const twentyFourHoursAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));

    // Get Job Queue data from the LOGS spreadsheet
    const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
    const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
    
    const jobQueueSheetName = sheetNames.SysJobQueue;
    const jobQueueSheet = logSpreadsheet.getSheetByName(jobQueueSheetName);
    if (!jobQueueSheet) {
      throw new Error(`Sheet '${jobQueueSheetName}' not found in spreadsheet with ID '${logSpreadsheetId}'.`);
    }
    
    const jobQueueData = jobQueueSheet.getLastRow() > 1 ? jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueSheet.getLastColumn()).getValues() : [];
    const jobQueueHeaders = jobQueueSheet.getRange(1, 1, 1, jobQueueSheet.getLastColumn()).getValues()[0];
    const jobStatusCol = jobQueueHeaders.indexOf('sjq_Status');
    const jobTimestampCol = jobQueueHeaders.indexOf('sjq_Created');

    let recentFailedJobs = 0;
    let recentQuarantinedJobs = 0;
    jobQueueData.forEach(row => {
      const timestamp = new Date(row[jobTimestampCol]);
      if (timestamp > twentyFourHoursAgo) {
        if (row[jobStatusCol] === 'FAILED') {
          recentFailedJobs++;
        }
        if (row[jobStatusCol] === 'QUARANTINED') {
          recentQuarantinedJobs++;
        }
      }
    });

    // Get Task data from the DATA spreadsheet
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    const taskSheetName = sheetNames.SysTasks;
    const taskSheet = dataSpreadsheet.getSheetByName(taskSheetName);
    if (!taskSheet) {
      throw new Error(`Sheet '${taskSheetName}' not found in spreadsheet with ID '${dataSpreadsheetId}'.`);
    }

    let translationMissing = 0;
    let skuNotInComax = 0;
    let notOnWebInComax = 0;

    if (taskSheet.getLastRow() > 1) {
      const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
      
      taskData.forEach(row => {
        const status = row[taskHeaderMap['st_Status']];
        const typeId = row[taskHeaderMap['st_TaskTypeId']];
        if (status !== 'Done' && status !== 'Cancelled') {
          if (typeId === 'task.validation.translation_missing') {
            translationMissing++;
          }
          if (typeId === 'task.validation.sku_not_in_comax') {
            skuNotInComax++;
          }
          if (typeId === 'task.validation.not_on_web_in_comax') {
            notOnWebInComax++;
          }
        }
      });
    }

    return {
      recentFailedJobs,
      recentQuarantinedJobs,
      translationMissing,
      skuNotInComax,
      notOnWebInComax
    };
  } catch (e) {
    LoggerService.error('WebApp', 'getSystemHealthData', e.message, e);
    return { error: `Could not load system health data: ${e.message}` };
  }
}

function getAdminOrdersData() {
  if (AuthService.getActiveUserRole() !== 'admin') throw new Error('Permission denied.');
  try {
    const orderService = new OrderService(ProductService);
    const comaxExportOrderCount = orderService.getComaxExportOrderCount();

    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSheet = dataSpreadsheet.getSheetByName(ConfigService.getConfig('system.sheet_names').SysTasks);
    const taskData = taskSheet.getLastRow() > 1 ? taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues() : [];
    const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
    const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
    
    const openComaxConfirmationTasks = [];
    taskData.forEach(row => {
      const status = row[taskHeaderMap['st_Status']];
      const typeId = row[taskHeaderMap['st_TaskTypeId']];
      if (status !== 'Done' && status !== 'Cancelled' && typeId === 'task.confirmation.comax_export') {
        openComaxConfirmationTasks.push({
          id: row[taskHeaderMap['st_TaskId']],
          title: row[taskHeaderMap['st_Title']],
          notes: row[taskHeaderMap['st_Notes']]
        });
      }
    });

    return {
      comaxExportOrderCount: comaxExportOrderCount,
      openComaxConfirmationTasks: openComaxConfirmationTasks
    };
  } catch (e) {
    LoggerService.error('WebApp', 'getAdminOrdersData', e.message, e);
    return { error: 'Could not load order data.' };
  }
}

function getInventoryWidgetData() {
  if (AuthService.getActiveUserRole() !== 'admin') throw new Error('Permission denied.');
  try {
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSheetName = ConfigService.getConfig('system.sheet_names').SysTasks;
    const taskSheet = dataSpreadsheet.getSheetByName(taskSheetName);

    if (!taskSheet) {
      throw new Error(`Sheet '${taskSheetName}' not found in spreadsheet with ID '${dataSpreadsheetId}'.`);
    }

    const taskCounts = {};
    const inventoryTaskPrefix = 'task.validation.';

    if (taskSheet.getLastRow() > 1) {
      const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
      
      const typeIdCol = taskHeaderMap['st_TaskTypeId'];
      const statusCol = taskHeaderMap['st_Status'];

      taskData.forEach(row => {
        const status = row[statusCol];
        const typeId = row[typeIdCol];
        if (status !== 'Done' && status !== 'Cancelled' && typeId.startsWith(inventoryTaskPrefix)) {
          if (!taskCounts[typeId]) {
            taskCounts[typeId] = 0;
          }
          taskCounts[typeId]++;
        }
      });
    }

    return { data: taskCounts };
  } catch (e) {
    LoggerService.error('WebApp', 'getInventoryWidgetData', e.message, e);
    return { error: `Could not load inventory widget data: ${e.message}` };
  }
}

function getProductsWidgetData() {
  if (AuthService.getActiveUserRole() !== 'admin') throw new Error('Permission denied.');
  try {
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSheetName = ConfigService.getConfig('system.sheet_names').SysTasks;
    const taskSheet = dataSpreadsheet.getSheetByName(taskSheetName);

    if (!taskSheet) {
      throw new Error(`Sheet '${taskSheetName}' not found in spreadsheet with ID '${dataSpreadsheetId}'.`);
    }

    const taskCounts = {};
    const productTaskPrefix = 'task.validation.'; // Assuming product tasks also use this prefix

    if (taskSheet.getLastRow() > 1) {
      const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
      
      const typeIdCol = taskHeaderMap['st_TaskTypeId'];
      const statusCol = taskHeaderMap['st_Status'];

      taskData.forEach(row => {
        const status = row[statusCol];
        const typeId = row[typeIdCol];
        if (status !== 'Done' && status !== 'Cancelled' && typeId.startsWith(productTaskPrefix)) {
          if (!taskCounts[typeId]) {
            taskCounts[typeId] = 0;
          }
          taskCounts[typeId]++;
        }
      });
    }

    return { data: taskCounts };
  } catch (e) {
    LoggerService.error('WebApp', 'getProductsWidgetData', e.message, e);
    return { error: `Could not load products widget data: ${e.message}` };
  }
}

function getAdminInventoryData() {
  if (AuthService.getActiveUserRole() !== 'admin') throw new Error('Permission denied.');
  try {
    const taskSheet = SpreadsheetApp.openById(ConfigService.getConfig('system.spreadsheet.logs').id).getSheetByName(ConfigService.getConfig('system.sheet_names').SysTasks);
    const taskData = taskSheet.getLastRow() > 1 ? taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues() : [];
    const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
    const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));

    const openProductCountConfirmationTasks = [];
    taskData.forEach(row => {
      const status = row[taskHeaderMap['st_Status']];
      const typeId = row[taskHeaderMap['st_TaskTypeId']];
      if (status !== 'Done' && status !== 'Cancelled' && typeId === 'task.confirmation.product_count_export') {
        openProductCountConfirmationTasks.push({
          id: row[taskHeaderMap['st_TaskId']],
          title: row[taskHeaderMap['st_Title']],
          notes: row[taskHeaderMap['st_Notes']]
        });
      }
    });
    return { openProductCountConfirmationTasks };
  } catch (e) {
    LoggerService.error('WebApp', 'getAdminInventoryData', e.message, e);
    return { error: 'Could not load inventory data.' };
  }
}

function getDashboardOrdersSummaryData() {
  if (AuthService.getActiveUserRole() !== 'admin') throw new Error('Permission denied.');
  try {
    const ordersWidgetData = WebAppOrders.getOrdersWidgetData();

    // Also retrieve open Comax confirmation tasks
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSheet = dataSpreadsheet.getSheetByName(ConfigService.getConfig('system.sheet_names').SysTasks);

    if (!taskSheet) {
      LoggerService.warn('WebApp', 'getDashboardOrdersSummaryData', "Required sheet 'SysTasks' not found in logs spreadsheet. Returning empty tasks array.");
      return {
        ...ordersWidgetData,
        openComaxConfirmationTasks: []
      };
    }

    const taskData = taskSheet.getLastRow() > 1 ? taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues() : [];
    const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
    const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
    
    const openComaxConfirmationTasks = [];
    taskData.forEach(row => {
      const status = row[taskHeaderMap['st_Status']];
      const typeId = row[taskHeaderMap['st_TaskTypeId']];
      if (status !== 'Done' && status !== 'Cancelled' && typeId === 'task.confirmation.comax_export') {
        openComaxConfirmationTasks.push({
          id: row[taskHeaderMap['st_TaskId']],
          title: row[taskHeaderMap['st_Title']],
          notes: row[taskHeaderMap['st_Notes']]
        });
      }
    });

    return {
      ...ordersWidgetData,
      openComaxConfirmationTasks: openComaxConfirmationTasks
    };
  } catch (e) {
    LoggerService.error('WebApp', 'getDashboardOrdersSummaryData', e.message, e);
    return { error: 'Could not load dashboard orders summary data.' };
  }
}

function getManagerInventoryData() {
  if (AuthService.getActiveUserRole() !== 'manager' && AuthService.getActiveUserRole() !== 'admin') throw new Error('Permission denied.');
  return { isInventoryCountNeeded: true }; // Placeholder
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
 * Gets the initial data needed to bootstrap the web application.
 * This includes user information like email and role.
 * @returns {Object} An object containing the user's email and role.
 */
function getAppBootstrapData() {
  return {
    email: AuthService.getActiveUserEmail(),
    role: AuthService.getActiveUserRole()
  };
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
    LoggerService.error('WebApp', 'getBruryaStockData', error.message, error);
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
        LoggerService.warn('WebApp', 'saveBruryaInventoryChanges', `Failed to save stock for SKU: ${change.sku}`);
      }
    });
    return allSuccessful;
  } catch (error) {
    LoggerService.error('WebApp', 'saveBruryaInventoryChanges', error.message, error);
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

function getAdminProductData() {
  // Placeholder: In the future, this could query WebDetM for products needing verification.
  return {
    productsToVerify: 5, 
    newProducts: 2
  };
}

/**
 * Retrieves key health and status metrics for the admin dashboard.
 * @returns {Object} An object containing system health data.
 */
function getDashboardData() {
  const role = AuthService.getActiveUserRole();
  
  if (role === 'admin') {
    try {
      const allConfig = ConfigService.getAllConfig();
      const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
      const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
      const sheetNames = allConfig['system.sheet_names'];
      const orderService = new OrderService(ProductService);

      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
      const jobStatuses = jobQueueSheet.getRange('C2:C').getValues().flat();
      const failedJobs = jobStatuses.filter(s => s === 'FAILED').length;
      const quarantinedJobs = jobStatuses.filter(s => s === 'QUARANTINED').length;

      const taskSheet = logSpreadsheet.getSheetByName(sheetNames.SysTasks);
      const taskData = taskSheet.getLastRow() > 1 ? taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues() : [];
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
      
      let highPriorityTasks = 0;
      const openComaxConfirmationTasks = [];
      const openProductCountConfirmationTasks = [];

      taskData.forEach(row => {
        const status = row[taskHeaderMap['st_Status']];
        const typeId = row[taskHeaderMap['st_TaskTypeId']];
        const priority = row[taskHeaderMap['st_Priority']];

        if (status !== 'Done' && status !== 'Cancelled') {
          if (priority === 'High') {
            highPriorityTasks++;
          }
          if (typeId === 'task.confirmation.comax_export') {
            openComaxConfirmationTasks.push({
              id: row[taskHeaderMap['st_TaskId']],
              title: row[taskHeaderMap['st_Title']],
              notes: row[taskHeaderMap['st_Notes']]
            });
          }
          if (typeId === 'task.confirmation.product_count_export') {
            openComaxConfirmationTasks.push({
              id: row[taskHeaderMap['st_TaskId']],
              title: row[taskHeaderMap['st_Title']],
              notes: row[taskHaderMap['st_Notes']]
            });
          }
        }
      });

      const productData = getAdminProductData();

      return {
        role: role,
        failedJobs: failedJobs,
        quarantinedJobs: quarantinedJobs,
        highPriorityTasks: highPriorityTasks,
        comaxExportOrderCount: orderService.getComaxExportOrderCount(),
        openComaxConfirmationTasks: openComaxConfirmationTasks,
        openProductCountConfirmationTasks: openProductCountConfirmationTasks,
        productData: productData
      };
    } catch (error) {
      LoggerService.error('WebApp', 'getDashboardData (admin)', error.message, error);
      return { role: role, error: 'Error loading admin data.' };
    }
  } else if (role === 'manager') {
    return {
      role: role,
      isInventoryCountNeeded: true // Placeholder
    };
  }

  return { role: role }; // Default for other roles
}

/**
 * Wraps the global run_exportOrdersToComax function so it can be called from the UI.
 * @returns {string} A success message.
 */
function runComaxOrderExport() {
  if (AuthService.getActiveUserRole() !== 'admin') {
    throw new Error('You do not have permission to perform this action.');
  }
  run_exportOrdersToComax();
  return "Comax order export initiated successfully. A confirmation task has been created.";
}

/**
 * Confirms a Comax import by completing the associated task.
 * @param {string} taskId The ID of the task to complete.
 * @returns {boolean} True if successful.
 */
function confirmComaxImport(taskId) {
  if (AuthService.getActiveUserRole() !== 'admin') {
    throw new Error('You do not have permission to perform this action.');
  }
  return TaskService.completeTask(taskId);
}

/**
 * Placeholder function to trigger the product count export.
 * @returns {string} A success message.
 */
function runProductCountExport() {
  if (AuthService.getActiveUserRole() !== 'admin') {
    throw new Error('You do not have permission to perform this action.');
  }
  // This is a placeholder. In the future, it would generate a CSV.
  const taskTitle = 'Confirm Product Count Export';
  const taskNotes = 'Product count export file has been generated. Please confirm that Comax has been updated.';
  TaskService.createTask('task.confirmation.product_count_export', 'product_count_export_' + new Date().getTime(), taskTitle, taskNotes);
  return "Product count export initiated. A confirmation task has been created.";
}

/**
 * Confirms a Product Count import by completing the associated task.
 * @param {string} taskId The ID of the task to complete.
 * @returns {boolean} True if successful.
 */
function confirmProductCountImport(taskId) {
  if (AuthService.getActiveUserRole() !== 'admin') {
    throw new Error('You do not have permission to perform this action.');
  }
  return TaskService.completeTask(taskId);
}

/**
 * Wraps the global rebuildSysConfigFromSource function so it can be called from the UI.
 * @returns {string} A success message.
 */
function runRebuildSysConfigFromSource() {
  // Add an explicit check for admin role for security.
  if (AuthService.getActiveUserRole() !== 'admin') {
    throw new Error('You do not have permission to perform this action.');
  }
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
