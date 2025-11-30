/**
 * @file WebAppProducts.js
 * @description This file contains functions for the products widget.
 */

/**
 * Gets the counts of various product-related tasks.
 *
 * @returns {object} An object containing the counts of product tasks.
 */
function WebAppProducts_getProductsWidgetData() {
  const productTaskTypes = [
    'task.validation.sku_not_in_comax',
    'task.validation.translation_missing',
    'task.validation.comax_internal_audit',
    'task.validation.field_mismatch', // This includes vintage mismatch
    'task.validation.name_mismatch',
    'task.validation.web_master_discrepancy',
    'task.validation.comax_master_discrepancy',
    'task.validation.row_count_decrease',
    'task.validation.comax_not_web_product'
  ];

  try {
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = dataSpreadsheet.getSheetByName('SysTasks');

    if (!sheet) {
      throw new Error("Sheet 'SysTasks' not found");
    }

    const headers = taskSchema.headers.split(',');
    const typeIdCol = headers.indexOf('st_TaskTypeId');
    const statusCol = headers.indexOf('st_Status');
    const titleCol = headers.indexOf('st_Title');

    const taskCounts = {};
    productTaskTypes.forEach(taskType => {
      taskCounts[taskType] = 0;
    });
    taskCounts['vintage_mismatch_tasks'] = 0; // Specific count for vintage mismatch

    if (sheet.getLastRow() > 1) {
      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      existingRows.forEach(row => {
        const taskType = row[typeIdCol];
        const status = row[statusCol];
        const title = String(row[titleCol] || '');

        if (productTaskTypes.includes(taskType) && status !== 'Done' && status !== 'Closed') {
          taskCounts[taskType]++;
          if (taskType === 'task.validation.field_mismatch' && title.toLowerCase().includes('vintage mismatch')) {
            taskCounts['vintage_mismatch_tasks']++;
          }
        }
      });
    }

    return {
      error: null,
      data: taskCounts
    };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getProductsWidgetData', `Error getting products widget data: ${e.message}`);
    return {
      error: `Error getting products widget data: ${e.message}`,
      data: null
    };
  }
}

/**
 * Gets a list of product detail update tasks for the admin to review.
 * Filters for 'task.validation.field_mismatch' tasks with 'Vintage Mismatch' in the title
 * and 'Review' status.
 *
 * @returns {Array<Object>} A list of product detail update tasks.
 */
function WebAppProducts_getAdminReviewTasks() {
  try {
    LoggerService.info('WebAppProducts', 'getAdminReviewTasks', 'Starting task fetch...');
    
    // Emulate inventory method: Use getOpenTasksByTypeIdAndStatus
    const tasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.field_mismatch', 'Review');
    LoggerService.info('WebAppProducts', 'getAdminReviewTasks', `Fetched ${tasks.length} raw tasks with status 'Review'.`);
    
    // Filter for Vintage Mismatch safely
    const reviewTasks = tasks.filter(t => {
        const title = String(t.st_Title || '');
        const isMatch = title.toLowerCase().includes('vintage mismatch');
        if (!isMatch) {
             LoggerService.info('WebAppProducts', 'getAdminReviewTasks', `Filtering out task ${t.st_TaskId}: Title '${title}' does not contain 'vintage mismatch'.`);
        }
        return isMatch;
    });
    
    LoggerService.info('WebAppProducts', 'getAdminReviewTasks', `Returning ${reviewTasks.length} filtered review tasks.`);
    
    return reviewTasks.map(t => ({
        taskId: t.st_TaskId,
        sku: t.st_LinkedEntityId,
        title: t.st_Title,
        status: t.st_Status,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate),
        assignedTo: t.st_AssignedTo
    }));
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getAdminReviewTasks', `Error getting admin review tasks: ${e.message}`, e);
    throw e;
  }
}

/**
 * Gets a list of accepted product detail tasks ready for export.
 * Filters for 'task.validation.field_mismatch' tasks with 'Vintage Mismatch' in the title
 * and 'Accepted' status.
 *
 * @returns {Array<Object>} A list of accepted tasks.
 */
function WebAppProducts_getAcceptedTasks() {
  LoggerService.warn('WebAppProducts', 'getAcceptedTasks', 'Function disabled per user instruction.');
  return []; // Disabled per user instruction
}

/**
 * Triggers the export of accepted product details to a CSV.
 * @returns {Object} Result with success status and message.
 */
function WebAppProducts_exportAcceptedUpdates() {
    return ProductService.generateDetailExport();
}

/**
 * Confirms that the web updates have been performed, marking accepted tasks as Completed.
 * @returns {Object} Result with success status and message.
 */
function WebAppProducts_confirmWebUpdates() {
    return ProductService.confirmWebUpdates();
}

/**
 * Generates HTML previews for the product editor.
 * @param {string} sku The product SKU.
 * @param {Object} formData The current form data.
 * @param {Object} comaxData The Comax master data.
 * @returns {Object} { htmlEn, htmlHe }
 */
function WebAppProducts_getPreview(sku, formData, comaxData) {
    const allConfig = ConfigService.getAllConfig();
    const lookupMaps = {
        texts: LookupService.getLookupMap('map.text_lookups'),
        grapes: LookupService.getLookupMap('map.grape_lookups'),
        kashrut: LookupService.getLookupMap('map.kashrut_lookups')
    };
    return ProductService.getProductHtmlPreview(sku, formData, comaxData, 'EN', lookupMaps, false); // Assuming EN for preview, pass comaxData
}

/**
 * Gets a list of product detail update tasks for the manager.
 * Filters for 'task.validation.field_mismatch' tasks with 'Vintage Mismatch' in the title
 * and 'New' or 'Assigned' status.
 *
 * @returns {Array<Object>} A list of product detail update tasks.
 */
function WebAppProducts_getManagerProductTasks() {
  try {
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Opening spreadsheet ID: ${dataSpreadsheetId}`);
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = dataSpreadsheet.getSheetByName('SysTasks');

    if (!sheet) {
      throw new Error("Sheet 'SysTasks' not found");
    }

    const headers = taskSchema.headers.split(',');
    const typeIdCol = headers.indexOf('st_TaskTypeId');
    const statusCol = headers.indexOf('st_Status');
    const titleCol = headers.indexOf('st_Title');
    
    LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Indices: Type=${typeIdCol}, Status=${statusCol}, Title=${titleCol}`);
    const linkedEntityIdCol = headers.indexOf('st_LinkedEntityId');
    const taskIdCol = headers.indexOf('st_TaskId');
    const createdDateCol = headers.indexOf('st_CreatedDate');
    const assignedToCol = headers.indexOf('st_AssignedTo');

    const tasks = [];
    if (sheet.getLastRow() > 1) {
      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      if (existingRows.length > 0) {
         LoggerService.info('WebAppProducts', 'getManagerProductTasks', `First row sample: ${JSON.stringify(existingRows[0])}`);
      }
      existingRows.forEach((row, index) => {
        const taskType = String(row[typeIdCol] || '').trim();
        const status = String(row[statusCol] || '').trim();
        const title = String(row[titleCol] || '');

        if (index === 0) {
             const typeMatch = taskType === 'task.validation.field_mismatch';
             const titleMatch = title.toLowerCase().includes('vintage mismatch');
             const statusMatch = (status === 'New' || status === 'Assigned');
             LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Row 0 Analysis: TypeMatch=${typeMatch}, TitleMatch=${titleMatch}, StatusMatch=${statusMatch}`);
        }

        if (taskType === 'task.validation.field_mismatch' && title.toLowerCase().includes('vintage mismatch') && (status === 'New' || status === 'Assigned')) {
          tasks.push({
            taskId: row[taskIdCol],
            sku: row[linkedEntityIdCol], // Assuming LinkedEntityId is SKU
            title: title,
            status: status,
            createdDate: String(row[createdDateCol]),
            assignedTo: row[assignedToCol]
          });
        }
      });
    }
    LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Returning ${tasks.length} tasks.`);
    return tasks;
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getManagerProductTasks', `Error getting manager product tasks: ${e.message}`, e);
    throw e;
  }
}

/**
 * Fetches product details (master and staging) for the editor.
 * @param {string} taskId The ID of the task.
 * @returns {object} An object containing master and staging product data, and the SKU.
 */
function WebAppProducts_loadProductEditorData(taskId) {
  try {
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = dataSpreadsheet.getSheetByName('SysTasks');
    if (!sheet) throw new Error("Sheet 'SysTasks' not found");

    const headers = taskSchema.headers.split(',');
    const taskIdCol = headers.indexOf('st_TaskId');
    const linkedEntityIdCol = headers.indexOf('st_LinkedEntityId');

    const allTasks = ConfigService._getSheetDataAsMap('SysTasks', headers, 'st_TaskId').map;
    const task = allTasks.get(taskId);

    if (!task) throw new Error(`Task with ID ${taskId} not found.`);
    const sku = task.st_LinkedEntityId;

    // Parse the JSON string returned by ProductService
    const productDetailsJson = ProductService.getProductDetails(sku); 
    const productDetails = JSON.parse(productDetailsJson);

    return {
      sku: sku,
      taskId: taskId,
      masterData: productDetails.master,
      stagingData: productDetails.staging,
      comaxData: productDetails.comax,
      regions: productDetails.regions,
      abvOptions: productDetails.abvOptions,
      grapes: productDetails.grapes,
      kashrut: productDetails.kashrut
    };

  } catch (e) {
    LoggerService.error('WebAppProducts', 'loadProductEditorData', `Error loading product editor data for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

/**
 * Handles the submission of product details by a manager to the staging area.
 * @param {string} taskId The ID of the task.
 * @param {string} sku The SKU of the product being edited.
 * @param {Object} formData The form data submitted by the manager.
 * @returns {Object} Success status.
 */
function WebAppProducts_handleManagerSubmit(taskId, sku, formData) {
  try {
    const result = ProductService.submitProductDetails(taskId, sku, formData);
    return { success: true, message: "Product details submitted for review." };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'handleManagerSubmit', `Error submitting manager edits for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

/**
 * Handles the acceptance of product details by an admin.
 * @param {string} taskId The ID of the task.
 * @param {string} sku The SKU of the product.
 * @param {Object} finalData The final data approved by the admin.
 * @returns {Object} Success status.
 */
function WebAppProducts_handleAdminAccept(taskId, sku, finalData) {
  try {
    const result = ProductService.acceptProductDetails(taskId, sku, finalData);
    return { success: true, message: "Product details accepted and updated in master." };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'handleAdminAccept', `Error accepting admin edits for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

/**
 * Handles the confirmation by an admin that web updates have been made.
 * @param {string} taskId The ID of the task.
 * @returns {Object} Success status.
 */
function WebAppProducts_handleAdminConfirmWebUpdate(taskId) {
  try {
    TaskService.updateTaskStatus(taskId, 'Done');
    return { success: true, message: "Task marked as 'Done' (Web update confirmed)." };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'handleAdminConfirmWebUpdate', `Error confirming web update for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

function test_loadProductEditorData() {
  const taskId = '61c0e9c4-6a04-44eb-8a9a-1dbf255eec64'; // Task ID from previous logs
  Logger.log(`Testing loadProductEditorData for Task ID: ${taskId}`);

  try {
    const result = WebAppProducts_loadProductEditorData(taskId);
    Logger.log('Result received:');
    Logger.log(JSON.stringify(result, null, 2));
    
    if (result.masterData) {
        Logger.log('Master Data present.');
        Logger.log(`NameEn: ${result.masterData.wdm_NameEn}`);
    } else {
        Logger.log('Master Data MISSING.');
    }

    if (result.comaxData) {
        Logger.log('Comax Data present.');
        Logger.log(`Vintage: ${result.comaxData.cpm_Vintage}`);
    } else {
        Logger.log('Comax Data MISSING.');
    }

  } catch (e) {
    Logger.log(`Error: ${e.message}`);
    Logger.log(e.stack);
  }
}