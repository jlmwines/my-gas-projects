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
    // today and isToday are defined at the top.

    // Step 1: Invoices (Automated Count)
    const invoiceCount = OrchestratorService.getInvoiceFileCount();
    let invoiceStatus = 'DONE';
    let invoiceMessage = 'No invoices waiting.';

    if (invoiceCount > 0) {
      invoiceStatus = 'WARNING';
      invoiceMessage = `${invoiceCount} invoices waiting to be entered.`;
    }

    inventoryCycle.push({
      step: 1,
      name: 'Comax Invoice Entry',
      status: invoiceStatus,
      message: invoiceMessage,
      timestamp: null
    });

    // --- Optimize: Read Job Queue Once ---
    // Variables (logSpreadsheetId, jobQueueSheet, jobData, jobHeaders, jobTypeCol, jobStatusCol, jobProcessedCol)
    // are now declared at the top of the function.

    // Helper to parse job data from the bulk read
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

    // Step 2: Web Translations
    const transJobType = 'import.drive.web_translations_he';
    const transData = getJobStatusSummary(transJobType);
    const lastTransImport = transData.lastSuccess;
    const isTransRunning = transData.isRunning;
    
    let transStatus = 'WARNING';
    let transMessage = 'Import required.';
    if (isToday(lastTransImport)) {
      transStatus = 'DONE';
      transMessage = 'Completed today.';
    } else if (isTransRunning) {
      transStatus = 'PENDING';
      transMessage = 'Job is running...';
    }

    inventoryCycle.push({
      step: 2,
      name: 'Web Translations Import',
      status: transStatus,
      message: transMessage,
      timestamp: lastTransImport ? Utilities.formatDate(lastTransImport, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null
    });

    // Step 3: Web Products
    const webProdJobType = 'import.drive.web_products_en';
    const webProdData = getJobStatusSummary(webProdJobType);
    const lastWebProdImport = webProdData.lastSuccess;
    const isWebProdRunning = webProdData.isRunning;

    let webProdStatus = 'WARNING';
    let webProdMessage = 'Import required.';

    if (transStatus !== 'DONE' && transStatus !== 'PENDING') {
        // Blocked by Step 2
        webProdStatus = 'BLOCKED';
        webProdMessage = 'Waiting for Translations.';
    } else if (isToday(lastWebProdImport)) {
        webProdStatus = 'DONE';
        webProdMessage = 'Completed today.';
    } else if (isWebProdRunning) {
        webProdStatus = 'PENDING';
        webProdMessage = 'Job is running...';
    }

    inventoryCycle.push({
      step: 3,
      name: 'Web Products Import',
      status: webProdStatus,
      message: webProdMessage,
      timestamp: lastWebProdImport ? Utilities.formatDate(lastWebProdImport, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null
    });

    // Step 4: Order Synchronization
    const webOrderJobType = 'import.drive.web_orders';
    const webOrderData = getJobStatusSummary(webOrderJobType);
    const lastWebOrderImport = webOrderData.lastSuccess;

    // Get unexported order count
    const orderService = new OrderService(ProductService);
    const unexportedCount = orderService.getComaxExportOrderCount();
    
    let orderSyncStatus = 'DONE';
    let orderSyncMessage = 'All orders exported.';
    
    if (unexportedCount > 0) {
        orderSyncStatus = 'ERROR'; // Red Lock
        orderSyncMessage = `${unexportedCount} unexported orders. Export required.`;
    } else if (!isToday(lastWebOrderImport)) {
        // Maybe warning if import is stale? For now, trust the count.
        // orderSyncStatus = 'WARNING';
        // orderSyncMessage = 'Order import might be stale.';
    }

    inventoryCycle.push({
      step: 4,
      name: 'Order Synchronization',
      status: orderSyncStatus,
      message: orderSyncMessage,
      timestamp: lastWebOrderImport ? Utilities.formatDate(lastWebOrderImport, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null,
      data: { unexportedCount: unexportedCount }
    });

    // Step 5: Comax Product Import & Final Safety Lock
    const comaxProdJobType = 'import.drive.comax_products';
    const comaxProdData = getJobStatusSummary(comaxProdJobType);
    const lastComaxImport = comaxProdData.lastSuccess;
    const isComaxRunning = comaxProdData.isRunning;
    const lastOrderExport = orderService.getLastComaxOrderExportTimestamp();

    let comaxStatus = 'WARNING';
    let comaxMessage = 'Import required.';

    if (webProdStatus !== 'DONE' && webProdStatus !== 'PENDING') {
        comaxStatus = 'BLOCKED';
        comaxMessage = 'Waiting for Web Products.';
    } else if (orderSyncStatus === 'ERROR') {
        comaxStatus = 'BLOCKED';
        comaxMessage = 'Blocked by Unexported Orders.';
    } else if (isToday(lastComaxImport)) {
        // Check Yellow Lock: Comax Import must be NEWER than Last Order Export
        if (lastOrderExport && lastComaxImport <= lastOrderExport) {
             comaxStatus = 'WARNING'; // Yellow Lock
             comaxMessage = 'Stale: Import newer file (post-order export).';
        } else {
             comaxStatus = 'DONE';
             comaxMessage = 'Completed today & Fresh.';
        }
    } else if (isComaxRunning) {
        comaxStatus = 'PENDING';
        comaxMessage = 'Job is running...';
    }

    inventoryCycle.push({
      step: 5,
      name: 'Comax Product Import',
      status: comaxStatus,
      message: comaxMessage,
      timestamp: lastComaxImport ? Utilities.formatDate(lastComaxImport, Session.getScriptTimeZone(), 'MM/dd HH:mm') : null
    });
    
    // Step 6: Web Inventory Export (Final Goal)
    // Check if a confirmation task was completed TODAY
    // Since tasks don't have a 'completed_timestamp' easily accessible here without reading SysTasks again or checking `st_DoneDate`
    // We will infer it from `canWebInventoryExport` logic or check for an open task.
    
    let webExportStatus = 'BLOCKED';
    let webExportMessage = 'Complete previous steps.';
    let webExportTimestamp = null; // We don't track the export timestamp easily here yet, unless we add a job type for it.

    // Check for open confirmation task
    const confirmTaskType = 'task.confirmation.web_inventory_export';
    const confirmTasks = WebAppTasks.getOpenTasksByTypeId(confirmTaskType);
    
    // Check if the previous steps are all DONE
    const previousStepsDone = inventoryCycle.every(s => s.status === 'DONE');

    if (lastWebExportConfirmation) {
        webExportStatus = 'DONE';
        webExportMessage = 'Completed today.';
        webExportTimestamp = Utilities.formatDate(lastWebExportConfirmation, Session.getScriptTimeZone(), 'MM/dd HH:mm');
    } else if (confirmTasks.length > 0) {
        webExportStatus = 'PENDING';
        webExportMessage = 'Waiting for confirmation.';
    } else if (previousStepsDone) {
        // If all steps are done and no confirmation is pending, we are ready to export OR already exported.
        // Ideally we would check the last time the export function was run.
        // For now, if everything is green, we show READY.
        webExportStatus = 'READY';
        webExportMessage = 'Ready to export.';
    }

    inventoryCycle.push({
      step: 6,
      name: 'Web Inventory Export',
      status: webExportStatus,
      message: webExportMessage,
      timestamp: webExportTimestamp
    });

    // Final Export Ready Status
    const isInventoryExportReady = previousStepsDone; // Simple check: are 1-5 done?


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
