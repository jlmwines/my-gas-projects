/**
 * @file WebAppSystem.js
 * @description Provides backend functions for the System Health dashboard widget and view.
 */

/**
 * Gathers various system health metrics.
 * @returns {Object} An object containing system health metrics.
 */
function WebAppSystem_getSystemHealthMetrics() {
  const logSpreadsheetId = ConfigService.getConfig('system.spreadsheet.logs').id;
  const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
  const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
  const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

  // --- Task-related metrics ---
  const taskSheetName = ConfigService.getConfig('system.sheet_names').SysTasks;
  const taskSheet = dataSpreadsheet.getSheetByName(taskSheetName);
  if (!taskSheet) throw new Error(`Sheet not found: ${taskSheetName}`);
  const taskData = taskSheet.getLastRow() > 1 ? taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues() : [];
  const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
  const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));

  let translationMissing = 0;
  let skuNotInComax = 0;
  let notOnWebInComax = 0; // This will now be populated from tasks

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
      if (typeId === 'task.validation.comax_not_web_product') { // New task type
        notOnWebInComax++;
      }
    }
  });

  // --- Job Queue metrics ---
  const jobQueueSheet = logSpreadsheet.getSheetByName('SysJobQueue');
  if (!jobQueueSheet) throw new Error(`Sheet not found: SysJobQueue`);
  const jobStatuses = jobQueueSheet.getRange('C2:C').getValues().flat();
  const quarantinedJobs = jobStatuses.filter(s => s === 'QUARANTINED').length;

  return {
    translationMissing,
    skuNotInComax,
    notOnWebInComax,
    quarantinedJobs
  };
}


/**
 * Gathers various system health metrics for the dashboard display.
 * @returns {Object} An object containing system health metrics including alerts, validation status, and passed validations.
 */
function WebAppSystem_getSystemHealthDashboardData() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const twentyFourHoursAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
    let recentErrors = 0;
    let lastMasterValidation = 'N/A';

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Helper to check if a date is today
    const isToday = (date) => {
      if (!date) return false;
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    };

    // --- Job Queue Data - Read Once (Moved for optimization) ---
    const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
    const jobQueueSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(sheetNames.SysJobQueue);
    if (!jobQueueSheet) throw new Error(`Sheet '${sheetNames.SysJobQueue}' not found.`);

    const jobData = jobQueueSheet.getLastRow() > 1 ? jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueSheet.getLastColumn()).getValues() : [];
    const jobHeaders = jobQueueSheet.getRange(1, 1, 1, jobQueueSheet.getLastColumn()).getValues()[0];
    
    const jobTypeCol = jobHeaders.indexOf('job_type');
    const jobStatusCol = jobHeaders.indexOf('status');
    const jobProcessedCol = jobHeaders.indexOf('processed_timestamp');

    // --- Dynamically determine Critical Validations and their confirmation texts from task definitions ---
    const criticalTaskDefinitions = Object.keys(allConfig)
      .filter(key => key.startsWith('task.validation.') &&
                     String(allConfig[key].default_priority).toUpperCase() === 'HIGH')
      .map(key => ({
        taskTypeId: key,
        description: allConfig[key].scf_Description // Assuming scf_Description holds the human-friendly text
      }));

    const criticalTaskTypes = new Set(criticalTaskDefinitions.map(def => def.taskTypeId));
    const criticalValidationDisplayNames = new Map(criticalTaskDefinitions.map(def => [def.taskTypeId, def.description]));

    // --- Build a map of task types to their validation suites (this part remains, but might be less relevant now) ---
    const taskTypeToSuiteMap = new Map();
    // This map was originally built from validation.rule.*. If still needed, it would require a different source.
    // For now, it will remain empty or be populated differently if validation_suite is needed for task.validation.*
    // For the purpose of passedValidations, it's not directly used.

    // --- Analyze Tasks for Alerts ---
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const taskSheet = SpreadsheetApp.openById(dataSpreadsheetId).getSheetByName(sheetNames.SysTasks);
    if (!taskSheet) throw new Error(`Sheet '${sheetNames.SysTasks}' not found.`);

    const alertsBySuite = new Map();
    const openHighPriorityTaskTypes = new Set();

    let lastWebExportConfirmation = null;

    if (taskSheet.getLastRow() > 1) {
      const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
      
      taskData.forEach(row => {
        const status = row[taskHeaderMap['st_Status']];
        const priority = row[taskHeaderMap['st_Priority']];
        const typeId = row[taskHeaderMap['st_TaskTypeId']];
        const doneDate = row[taskHeaderMap['st_DoneDate']];

        if (status !== 'Done' && status !== 'Cancelled' && priority === 'High' && criticalTaskTypes.has(typeId)) {
          openHighPriorityTaskTypes.add(typeId);
          const suite = taskTypeToSuiteMap.get(typeId) || 'General';
          alertsBySuite.set(suite, (alertsBySuite.get(suite) || 0) + 1);
        }

        // Check for completed Web Inventory Export tasks
        if (typeId === 'task.confirmation.web_inventory_export' && (status === 'Done' || status === 'Completed')) {
            const doneTs = doneDate ? new Date(doneDate) : null;
            if (doneTs && isToday(doneTs)) {
                if (!lastWebExportConfirmation || doneTs > lastWebExportConfirmation) {
                    lastWebExportConfirmation = doneTs;
                }
            }
        }
      });
    }

    const alerts = Array.from(alertsBySuite.entries()).map(([suite, count]) => {
        const suiteName = suite.charAt(0).toUpperCase() + suite.slice(1).replace(/_/g, ' ');
        return `${suiteName}: ${count}`;
    });

    // --- Analyze SysJobQueue for Last Validation Timestamp ---
    // logSpreadsheetId is already declared at the top.
    // jobQueueSheet is already declared at the top.
    // jobData, jobHeaders etc. are already declared at the top.

    for (let i = jobData.length - 1; i >= 0; i--) {
      const row = jobData[i];
      if (row[jobTypeCol] === 'manual.validation.master' && row[jobStatusCol] === 'COMPLETED') {
        lastMasterValidation = new Date(row[jobProcessedCol]);
        break;
      }
    }

    // --- Analyze SysLog for Recent Errors ---
    const logSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(sheetNames.SysLog);
    if (!logSheet) throw new Error(`Sheet '${sheetNames.SysLog}' not found.`);

    if (logSheet.getLastRow() > 1) {
      const logData = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logSheet.getLastColumn()).getValues();
      const logHeaders = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
      const logHeaderMap = Object.fromEntries(logHeaders.map((h, i) => [h, i]));

      for (let i = logData.length - 1; i >= 0; i--) {
        const row = logData[i];
        const timestamp = new Date(row[logHeaderMap['sl_Timestamp']]);
        if (timestamp < twentyFourHoursAgo) break; // Optimization

        if (row[logHeaderMap['sl_LogLevel']] === 'ERROR') {
          recentErrors++;
        }
      }
    }
    
    // --- Generate Passed Validations List ---
    const passedValidations = [];
    if (recentErrors === 0) {
      passedValidations.push('No Recent Errors');
    }
    for (const taskType of criticalTaskTypes) {
      if (!openHighPriorityTaskTypes.has(taskType)) {
        const displayName = criticalValidationDisplayNames.get(taskType);
        if (displayName) {
          passedValidations.push(displayName);
        }
      }
    }

    // --- Final Health Summary ---
    const isValidationRecent = lastMasterValidation !== 'N/A' && lastMasterValidation > twentyFourHoursAgo;
    const isHealthy = alerts.length === 0;


    // --- Inventory Cycle Checklist Logic (New) ---
    const inventoryCycle = [];

    // Helper to parse job data from the bulk read (moved to top of this block for clarity)
    const getJobStatusSummary = (targetType) => {
      let lastSuccess = null;
      let isRunning = false;

      for (const row of jobData) {
        const type = row[jobTypeCol];
        const status = row[jobStatusCol];
        
        if (type === targetType) {
          if (status === 'PENDING' || status === 'PROCESSING') {
            isRunning = true;
          } else if (status === 'COMPLETED') {
            const ts = new Date(row[jobProcessedCol]);
            if (!isNaN(ts.getTime())) {
              if (!lastSuccess || ts > lastSuccess) {
                lastSuccess = ts;
              }
            }
          }
        }
      }
      return { lastSuccess, isRunning };
    };

    // --- Define Job Types ---
    const webOrderImportJobType = 'import.drive.web_orders';
    const transJobType = 'import.drive.web_translations_he';
    const webProdJobType = 'import.drive.web_products_en';
    const comaxProdJobType = 'import.drive.comax_products';
    const comaxOrderExportTaskType = 'task.export.comax_orders_ready'; // Defined in OrchestratorService.js

    // --- Get Job Summaries ---
    const webOrderImportData = getJobStatusSummary(webOrderImportJobType);
    const transData = getJobStatusSummary(transJobType);
    const webProdData = getJobStatusSummary(webProdJobType);
    const comaxProdData = getJobStatusSummary(comaxProdJobType);
    
    // --- Get Task Statuses ---
    const orderService = new OrderService(ProductService);
    const unexportedOrdersCount = orderService.getComaxExportOrderCount();
    const lastComaxOrderExportTimestamp = orderService.getLastComaxOrderExportTimestamp(); // For Comax Products Yellow Lock

    // --- Step 1: Comax Invoice Entry (Optional) ---
    const invoiceCount = OrchestratorService.getInvoiceFileCount();
    let invoiceStatus = 'DONE';
    let invoiceMessage = 'No invoices waiting.';
    let invoiceFolderUrl = null;
    const invoiceFolderId = allConfig['system.folder.invoices'];
    if (invoiceFolderId) {
        const folderId = invoiceFolderId.id || invoiceFolderId;
        invoiceFolderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    }
    if (invoiceCount > 0) {
      invoiceStatus = 'WARNING';
      invoiceMessage = `${invoiceCount} invoices waiting to be entered.`;
    }
    inventoryCycle.push({
      step: 1,
      name: 'Comax Invoice Entry',
      status: invoiceStatus,
      message: invoiceMessage,
      timestamp: null,
      data: { folderUrl: invoiceFolderUrl }
    });

    // --- Step 2: Web Order Import ---
    let webOrderImportStatus = 'WARNING';
    let webOrderImportMessage = 'Import required.';
    if (isToday(webOrderImportData.lastSuccess)) {
      webOrderImportStatus = 'DONE';
      webOrderImportMessage = 'Completed today.';
    } else if (webOrderImportData.isRunning) {
      webOrderImportStatus = 'PENDING';
      webOrderImportMessage = 'Job is running...';
    }
    inventoryCycle.push({
      step: 2,
      name: 'Web Order Import',
      status: webOrderImportStatus,
      message: webOrderImportMessage,
      timestamp: webOrderImportData.lastSuccess ? Utilities.formatDate(webOrderImportData.lastSuccess, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null
    });

    // --- Step 3: Comax Order Export (Safety Lock) ---
    // This step is driven by unexported orders count and the 'task.export.comax_orders_ready' task.
    let comaxOrderExportStatus = 'DONE';
    let comaxOrderExportMessage = 'All orders exported.';
    const openComaxExportTasks = WebAppTasks.getOpenTasksByTypeId(comaxOrderExportTaskType);

    if (webOrderImportStatus !== 'DONE' && webOrderImportStatus !== 'PENDING') {
      comaxOrderExportStatus = 'BLOCKED';
      comaxOrderExportMessage = 'Waiting for Web Order Import.';
    } else if (unexportedOrdersCount > 0) {
        comaxOrderExportStatus = 'ERROR'; // Red Lock
        comaxOrderExportMessage = `${unexportedOrdersCount} unexported orders. Export required.`;
    } else if (openComaxExportTasks.length > 0) {
        comaxOrderExportStatus = 'WARNING'; // Task exists, needs attention
        comaxOrderExportMessage = 'Export task is open.';
    }
    inventoryCycle.push({
      step: 3,
      name: 'Comax Order Export',
      status: comaxOrderExportStatus,
      message: comaxOrderExportMessage,
      timestamp: lastComaxOrderExportTimestamp ? Utilities.formatDate(lastComaxOrderExportTimestamp, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null,
      data: { unexportedOrdersCount: unexportedOrdersCount }
    });

    // --- Step 4: Web Translations Import (Conditional) ---
    let transStatus = 'NEUTRAL'; // Default to NEUTRAL
    let transMessage = 'Not run today.';

    if (isToday(transData.lastSuccess)) {
        transStatus = 'DONE';
        transMessage = 'Completed today.';
    } else if (transData.isRunning) {
        transStatus = 'PENDING';
        transMessage = 'Job is running...';
    } else if (transData.lastSuccess) { // Job ran, but not today
        transStatus = 'NEUTRAL';
        transMessage = `Last run: ${Utilities.formatDate(transData.lastSuccess, Session.getScriptTimeZone(), 'MM/dd HH:mm')}`;
    }

    inventoryCycle.push({
      step: 4,
      name: 'Web Translations Import',
      status: transStatus,
      message: transMessage,
      timestamp: transData.lastSuccess ? Utilities.formatDate(transData.lastSuccess, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null
    });

    // --- Step 5: Web Products Import ---
    let webProdStatus = 'PENDING'; // Default to PENDING (Neutral)
    let webProdMessage = 'Not run today.';
    if (comaxOrderExportStatus === 'ERROR') {
      webProdStatus = 'BLOCKED';
      webProdMessage = 'Blocked by unexported orders.';
    } else if (isToday(webProdData.lastSuccess)) {
      webProdStatus = 'DONE';
      webProdMessage = 'Completed today.';
    } else if (webProdData.isRunning) {
      webProdStatus = 'PENDING'; // Active pending
      webProdMessage = 'Job is running...';
    } else if (webProdData.lastSuccess) { // Job ran, but not today
      webProdStatus = 'NEUTRAL';
      webProdMessage = `Last run: ${Utilities.formatDate(webProdData.lastSuccess, Session.getScriptTimeZone(), 'MM/dd HH:mm')}`;
    }

    inventoryCycle.push({
      step: 5,
      name: 'Web Products Import',
      status: webProdStatus,
      message: webProdMessage,
      timestamp: webProdData.lastSuccess ? Utilities.formatDate(webProdData.lastSuccess, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null
    });

    // --- Step 6: Comax Product Import ---
    let comaxStatus = 'PENDING'; // Default to PENDING (Neutral)
    let comaxMessage = 'Not run today.';
    if (comaxOrderExportStatus === 'ERROR') {
      comaxStatus = 'BLOCKED';
      comaxMessage = 'Blocked by unexported orders.';
    } else if (isToday(comaxProdData.lastSuccess)) {
        // Yellow Lock: Comax Import must be NEWER than Last Comax Order Export
        if (lastComaxOrderExportTimestamp && comaxProdData.lastSuccess <= lastComaxOrderExportTimestamp) {
             comaxStatus = 'WARNING';
             comaxMessage = 'Stale: Import newer file (post-order export).';
        } else {
             comaxStatus = 'DONE';
             comaxMessage = 'Completed today & Fresh.';
        }
    } else if (comaxProdData.isRunning) {
      comaxStatus = 'PENDING'; // Active pending
      comaxMessage = 'Job is running...';
    } else if (comaxProdData.lastSuccess) { // Job ran, but not today
      comaxStatus = 'NEUTRAL';
      comaxMessage = `Last run: ${Utilities.formatDate(comaxProdData.lastSuccess, Session.getScriptTimeZone(), 'MM/dd HH:mm')}`;
    }
    inventoryCycle.push({
      step: 6,
      name: 'Comax Product Import',
      status: comaxStatus,
      message: comaxMessage,
      timestamp: comaxProdData.lastSuccess ? Utilities.formatDate(comaxProdData.lastSuccess, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null
    });
    
    // --- Step 7: Web Inventory Export (Final Goal) ---
    let webExportStatus = 'BLOCKED';
    let webExportMessage = 'Resolve Red Locks.';
    let webExportTimestamp = null;
    const confirmTaskType = 'task.confirmation.web_inventory_export';
    const confirmTasks = WebAppTasks.getOpenTasksByTypeId(confirmTaskType);
    
    // Check for Red Lock ONLY
    const isRedLocked = (comaxOrderExportStatus === 'ERROR');

    if (lastWebExportConfirmation) {
        webExportStatus = 'DONE';
        webExportMessage = 'Completed today.';
        webExportTimestamp = Utilities.formatDate(lastWebExportConfirmation, Session.getScriptTimeZone(), 'MM/dd HH:mm');
    } else if (confirmTasks.length > 0) {
        webExportStatus = 'PENDING';
        webExportMessage = 'Waiting for confirmation.';
    } else if (!isRedLocked) { // Only if NOT red locked
        webExportStatus = 'READY';
        webExportMessage = 'Ready to export.';
    }

    inventoryCycle.push({
      step: 7,
      name: 'Web Inventory Export',
      status: webExportStatus,
      message: webExportMessage,
      timestamp: webExportTimestamp
    });

    // Final Export Ready Status for the main return object
    const isInventoryExportReady = (
        webExportStatus === 'READY' || webExportStatus === 'DONE' || webExportStatus === 'PENDING'
    );


    return {
      isHealthy,
      alerts,
      lastValidationTimestamp: lastMasterValidation === 'N/A' ? 'N/A' : Utilities.formatDate(lastMasterValidation, Session.getScriptTimeZone(), 'MM/dd HH:mm'),
      isValidationRecent,
      passedValidations,
      inventoryCycle, // Add the cycle data
      isInventoryExportReady
    };

  } catch (e) {
    LoggerService.error('WebApp', 'getSystemHealthData', e.message, e);
    return { error: `Could not load system health data: ${e.message}` };
  }
}

/**
 * Creates a master validation job in the SysJobQueue and processes it.
 * @returns {Object} An object indicating success or failure.
 */
function WebAppSystem_runMasterValidationAndReturnResults() {
  const serviceName = 'WebAppSystem';
  const functionName = 'runMasterValidationAndReturnResults';
  LoggerService.info(serviceName, functionName, 'Entering WebAppSystem_runMasterValidationAndReturnResults.');
  let newJobRow = {};
  let newJobRowNumber = null;
  let finalOverallStatus = 'FAILED'; // Default to FAILED
  let finalErrorMessage = '';
  
  try {
    const allConfig = ConfigService.getAllConfig();
    const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
    const jobQueueSheetName = allConfig['system.sheet_names'].SysJobQueue;
    const jobQueueSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(jobQueueSheetName);
    if (!jobQueueSheet) {
      throw new Error(`Sheet '${jobQueueSheetName}' not found in spreadsheet with ID '${logSpreadsheetId}'.`);
    }

    const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
    newJobRow = {};
    jobQueueHeaders.forEach(header => newJobRow[header] = '');

    newJobRow.job_id = Utilities.getUuid();
    newJobRow.job_type = 'manual.validation.master';
    newJobRow.status = 'PENDING';
    newJobRow.created_timestamp = new Date();

    const rowValues = jobQueueHeaders.map(header => newJobRow[header]);
    jobQueueSheet.appendRow(rowValues);
    newJobRowNumber = jobQueueSheet.getLastRow();

    LoggerService.info(serviceName, functionName, `Created new job: ${newJobRow.job_id} of type ${newJobRow.job_type} at row ${newJobRowNumber}`);

    const validationResult = ValidationService.runCriticalValidations(newJobRow.job_type, newJobRowNumber);
    finalOverallStatus = validationResult.overallStatus;
    finalErrorMessage = validationResult.errorMessage;

    return {
      success: finalOverallStatus !== 'FAILED',
      message: finalErrorMessage || 'Validation completed.',
      results: validationResult.results
    };

  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    finalErrorMessage = `Failed to run validation: ${e.message}`;
    return { success: false, error: finalErrorMessage };
  } finally {
      if (newJobRowNumber) {
          try {
              const allConfig = ConfigService.getAllConfig();
              const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
              const jobQueueSheetName = allConfig['system.sheet_names'].SysJobQueue;
              const jobQueueSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(jobQueueSheetName);
              
              const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
              const statusCol = jobQueueHeaders.indexOf('status') + 1;
              const messageCol = jobQueueHeaders.indexOf('error_message') + 1;
              const timestampCol = jobQueueHeaders.indexOf('processed_timestamp') + 1;

              if (statusCol > 0) jobQueueSheet.getRange(newJobRowNumber, statusCol).setValue(finalOverallStatus);
              if (messageCol > 0) jobQueueSheet.getRange(newJobRowNumber, messageCol).setValue(finalErrorMessage);
              if (timestampCol > 0) jobQueueSheet.getRange(newJobRowNumber, timestampCol).setValue(new Date());

              LoggerService.info(serviceName, functionName, `Job ${newJobRow.job_id} status updated to ${finalOverallStatus}`);
          } catch (updateError) {
              LoggerService.error(serviceName, functionName, `Failed to update final job status for ${newJobRow.job_id}: ${updateError.message}`, updateError);
          }
      }
  }
}
