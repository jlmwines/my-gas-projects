/**
 * @file WebApp.js
 * @description Handles web app requests for the JLMops system.
 */

const VERSION = {
  built: '2026-06-02 07:16',
  commit: 'Product verification surface (read-only batch review). New task.product.verify (manager_direct). ProductService gains getVerifyPlanningData / getVerifyDetail / createVerifyTasksBulk / getOpenVerifyTasks / completeVerifyTask / updateLastDetailAudit (stamps pa_LastDetailAudit only, never pa_LastCount). AdminProducts adds a Create Verification Tasks card (collapsed, populate-on-expand). ManagerProducts verifyMode modal: read-only render, live-image tile, Comax-vs-web on Specs, Division/Group empty-value flags, footer Confirm and close / Revert to admin (findings to task notes then reassign), batch-walks the open queue advancing after each action. Manager dashboard Verify button deep-links into the walk via sessionStorage. Count flow untouched (strip deferred per plan). After deploy, run rebuildSysConfigFromSource to load the new task template.'
};

function getVersion() {
  return VERSION;
}

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
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, shrink-to-fit=no');
}

function getDashboardForRole(role) {
  switch (role) {
    case 'admin':
    case 'manager':
      // Both roles now use the unified V2 dashboard
      return include('AdminDashboardView_v2.html');
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
    'AdminDashboard': 'AdminDashboardView_v2',
    'AdminDashboardV2': 'AdminDashboardView_v2',
    'ManagerDashboard': 'ManagerDashboardView_v2',
    'AdminOrders': 'OrdersView',
    'ManagerOrders': 'OrdersView',
    'AdminInventory': 'AdminInventoryView',
    'ManagerInventory': 'ManagerInventoryView',
    'ManagerProducts': 'ManagerProductsView',
    'AdminProducts': 'AdminProductsView',
    'AdminDailySyncWidget': 'AdminDailySyncWidget_v2',
    'AdminSyncView': 'AdminSyncView', // NEW SYNC VIEW
    'AdminBundles': 'AdminBundlesView',
    'AdminProjects': 'AdminProjectsView',
    'AdminTasks': 'AdminTasksView', // ADMIN_TASK_UI Deploy B — live (nav entry after Dashboard); AdminProjects kept as soak fallback
    'AdminCampaigns': 'AdminCampaignsView',
    'AdminContacts': 'AdminContactsView',
    'ManagerContacts': 'ManagerContactView',
    'Library': 'LibraryView',
    'Development': 'DevelopmentView'
  };

  if (viewMap[viewName]) {
    // Use template evaluation so views can use scriptlets like `<?!= include('TaskWidgets') ?>`.
    // Audited 2026-05-25: only AppView (rendered separately) and LibraryView use `<?` scriptlets;
    // other views render unchanged through template evaluation (no false matches).
    return HtmlService.createTemplateFromFile(viewMap[viewName]).evaluate().getContent();
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
 * Sorted: unprinted orders first (newest order number first), then printed orders (newest first).
 * @returns {Array<Object>} A list of orders with their IDs, statuses, and customer names.
 */
function getPackableOrders() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();
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
    const jobQueueSheetName = allConfig['system.sheet_names'].SysJobQueue;
    const jobQueueSheet = SheetAccessor.getLogSheet(jobQueueSheetName);
    if (!jobQueueSheet) {
      throw new Error(`Sheet '${jobQueueSheetName}' not found in log spreadsheet.`);
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
