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

    // --- Optimization: Fetch SysTasks ONCE ---
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const taskSheet = SpreadsheetApp.openById(dataSpreadsheetId).getSheetByName(sheetNames.SysTasks);
    if (!taskSheet) throw new Error(`Sheet '${sheetNames.SysTasks}' not found.`);

    let allOpenTasks = [];
    let lastWebExportConfirmation = null;

    if (taskSheet.getLastRow() > 1) {
      const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));

      // Filter and map in one pass
      taskData.forEach(row => {
         const status = String(row[taskHeaderMap['st_Status']]).trim();
         const typeId = String(row[taskHeaderMap['st_TaskTypeId']]).trim();
         const doneDate = row[taskHeaderMap['st_DoneDate']];
         
         // Check for completed Web Inventory Export tasks (needed for Inventory Cycle)
         if (typeId === 'task.confirmation.web_inventory_export' && (status === 'Done' || status === 'Completed')) {
            const doneTs = doneDate ? new Date(doneDate) : null;
            if (doneTs && isToday(doneTs)) {
                if (!lastWebExportConfirmation || doneTs > lastWebExportConfirmation) {
                    lastWebExportConfirmation = doneTs;
                }
            }
         }

         if (status !== 'Done' && status !== 'Cancelled') {
             allOpenTasks.push({
                 id: row[taskHeaderMap['st_TaskId']],
                 typeId: typeId,
                 status: status,
                 priority: row[taskHeaderMap['st_Priority']],
                 title: row[taskHeaderMap['st_Title']],
                 notes: row[taskHeaderMap['st_Notes']],
                 createdDate: row[taskHeaderMap['st_CreatedDate']]
             });
         }
      });
    }

    // --- Job Queue Data - Read Last 500 Rows ---
    const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
    const jobQueueSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(sheetNames.SysJobQueue);
    if (!jobQueueSheet) throw new Error(`Sheet '${sheetNames.SysJobQueue}' not found.`);

    const lastJobRow = jobQueueSheet.getLastRow();
    const startJobRow = Math.max(2, lastJobRow - 499);
    const numJobRows = lastJobRow - startJobRow + 1;

    let jobData = [];
    if (numJobRows > 0) {
        jobData = jobQueueSheet.getRange(startJobRow, 1, numJobRows, jobQueueSheet.getLastColumn()).getValues();
    }
    // Read headers from the first row
    const jobHeaders = jobQueueSheet.getRange(1, 1, 1, jobQueueSheet.getLastColumn()).getValues()[0];
    
    const jobTypeCol = jobHeaders.indexOf('job_type');
    const jobStatusCol = jobHeaders.indexOf('status');
    const jobProcessedCol = jobHeaders.indexOf('processed_timestamp');

    // --- Dynamically determine Critical Validations ---
    const criticalTaskDefinitions = Object.keys(allConfig)
      .filter(key => key.startsWith('task.validation.') &&
                     String(allConfig[key].default_priority).toUpperCase() === 'HIGH')
      .map(key => ({
        taskTypeId: key,
        description: allConfig[key].scf_Description
      }));

    const criticalTaskTypes = new Set(criticalTaskDefinitions.map(def => def.taskTypeId));
    const criticalValidationDisplayNames = new Map(criticalTaskDefinitions.map(def => [def.taskTypeId, def.description]));

    // --- Analyze Tasks for Alerts (In-Memory) ---
    const alertsBySuite = new Map();
    const openHighPriorityTaskTypes = new Set();
    const activeFailureTasks = [];

    allOpenTasks.forEach(task => {
        if (task.priority === 'High' && criticalTaskTypes.has(task.typeId)) {
            openHighPriorityTaskTypes.add(task.typeId);
            // Suite logic was placeholder, using 'General' for now
            const suite = 'General'; 
            alertsBySuite.set(suite, (alertsBySuite.get(suite) || 0) + 1);

            activeFailureTasks.push({
                id: task.id,
                title: task.title,
                notes: task.notes,
                type: task.typeId
            });
        }
    });

    const alerts = Array.from(alertsBySuite.entries()).map(([suite, count]) => {
        const suiteName = suite.charAt(0).toUpperCase() + suite.slice(1).replace(/_/g, ' ');
        return `${suiteName}: ${count}`;
    });

    // --- Analyze SysJobQueue for Last Validation Timestamp ---
    for (let i = jobData.length - 1; i >= 0; i--) {
      const row = jobData[i];
      if (row[jobTypeCol] === 'manual.validation.master' && row[jobStatusCol] === 'COMPLETED') {
        lastMasterValidation = new Date(row[jobProcessedCol]);
        break;
      }
    }

    // --- Generate Passed Validations List ---
    const passedValidations = [];
    for (const taskType of criticalTaskTypes) {
      if (!openHighPriorityTaskTypes.has(taskType)) {
        const displayName = criticalValidationDisplayNames.get(taskType);
        if (displayName) {
          passedValidations.push(displayName);
        }
      }
    }

    const isValidationRecent = lastMasterValidation !== 'N/A' && lastMasterValidation > twentyFourHoursAgo;
    const isHealthy = alerts.length === 0;


    // --- Inventory Cycle Checklist Logic (Optimized) ---
    const inventoryCycle = [];

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

    // Job Types
    const webOrderImportJobType = 'import.drive.web_orders';
    const transJobType = 'import.drive.web_translations_he';
    const webProdJobType = 'import.drive.web_products_en';
    const comaxProdJobType = 'import.drive.comax_products';
    const comaxOrderExportTaskType = 'task.export.comax_orders_ready';

    // Get Job Summaries
    const webOrderImportData = getJobStatusSummary(webOrderImportJobType);
    const transData = getJobStatusSummary(transJobType);
    const webProdData = getJobStatusSummary(webProdJobType);
    const comaxProdData = getJobStatusSummary(comaxProdJobType);
    
    // --- Optimized Order Metrics Fetch (One call to OrderService) ---
    const orderService = new OrderService(ProductService);
    const dashboardStats = orderService.getDashboardStats();
    
    const unexportedOrdersCount = dashboardStats.unexportedOrdersCount;
    const lastComaxOrderExportTimestamp = dashboardStats.lastComaxOrderExportTimestamp;

    // --- Step 1: Comax Invoice Entry ---
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
    let comaxOrderExportStatus = 'DONE';
    let comaxOrderExportMessage = 'All orders exported.';
    
    // Use in-memory filtered tasks
    const openComaxExportTasksCount = allOpenTasks.filter(t => t.typeId === comaxOrderExportTaskType).length;

    if (webOrderImportStatus !== 'DONE' && webOrderImportStatus !== 'PENDING') {
      comaxOrderExportStatus = 'BLOCKED';
      comaxOrderExportMessage = 'Waiting for Web Order Import.';
    } else if (unexportedOrdersCount > 0) {
        comaxOrderExportStatus = 'ERROR'; // Red Lock
        comaxOrderExportMessage = `${unexportedOrdersCount} unexported orders. Export required.`;
    } else if (openComaxExportTasksCount > 0) {
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

    // --- Step 4: Web Translations Import ---
    let transStatus = 'NEUTRAL';
    let transMessage = 'Not run today.';
    if (isToday(transData.lastSuccess)) {
        transStatus = 'DONE';
        transMessage = 'Completed today.';
    } else if (transData.isRunning) {
        transStatus = 'PENDING';
        transMessage = 'Job is running...';
    } else if (transData.lastSuccess) {
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
    let webProdStatus = 'PENDING';
    let webProdMessage = 'Not run today.';
    if (comaxOrderExportStatus === 'ERROR') {
      webProdStatus = 'BLOCKED';
      webProdMessage = 'Blocked by unexported orders.';
    } else if (isToday(webProdData.lastSuccess)) {
      webProdStatus = 'DONE';
      webProdMessage = 'Completed today.';
    } else if (webProdData.isRunning) {
      webProdStatus = 'PENDING';
      webProdMessage = 'Job is running...';
    } else if (webProdData.lastSuccess) {
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
    let comaxStatus = 'PENDING';
    let comaxMessage = 'Not run today.';
    if (comaxOrderExportStatus === 'ERROR') {
      comaxStatus = 'BLOCKED';
      comaxMessage = 'Blocked by unexported orders.';
    } else if (isToday(comaxProdData.lastSuccess)) {
        if (lastComaxOrderExportTimestamp && comaxProdData.lastSuccess <= lastComaxOrderExportTimestamp) {
             comaxStatus = 'WARNING';
             comaxMessage = 'Stale: Import newer file (post-order export).';
        } else {
             comaxStatus = 'DONE';
             comaxMessage = 'Completed today & Fresh.';
        }
    } else if (comaxProdData.isRunning) {
      comaxStatus = 'PENDING';
      comaxMessage = 'Job is running...';
    } else if (comaxProdData.lastSuccess) {
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
    
    // --- Step 7: Web Inventory Export ---
    let webExportStatus = 'BLOCKED';
    let webExportMessage = 'Resolve Red Locks.';
    let webExportTimestamp = null;
    const confirmTaskType = 'task.confirmation.web_inventory_export';
    
    // Use in-memory filtered tasks
    const confirmTasksCount = allOpenTasks.filter(t => t.typeId === confirmTaskType).length;
    const isRedLocked = (comaxOrderExportStatus === 'ERROR');

    if (lastWebExportConfirmation) {
        webExportStatus = 'DONE';
        webExportMessage = 'Completed today.';
        webExportTimestamp = Utilities.formatDate(lastWebExportConfirmation, Session.getScriptTimeZone(), 'MM/dd HH:mm');
    } else if (confirmTasksCount > 0) {
        webExportStatus = 'PENDING';
        webExportMessage = 'Waiting for confirmation.';
    } else if (!isRedLocked) {
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

    const isInventoryExportReady = (
        webExportStatus === 'READY' || webExportStatus === 'DONE' || webExportStatus === 'PENDING'
    );

    // --- Daily Sync Summary ---
    // Valid step statuses: DONE, PENDING, ERROR, BLOCKED, WARNING, NEUTRAL, READY
    let syncStatusSummary = 'Daily Sync: Idle';
    let syncStatusColor = 'text-muted';

    if (inventoryCycle.some(step => step.status === 'ERROR' || step.status === 'BLOCKED')) {
        syncStatusSummary = 'Daily Sync: Attention Needed';
        syncStatusColor = 'text-danger';
    } else if (inventoryCycle.some(step => step.status === 'WARNING')) {
        syncStatusSummary = 'Daily Sync: Review Required';
        syncStatusColor = 'text-warning-dark';
    } else if (inventoryCycle.some(step => step.status === 'PENDING')) {
        syncStatusSummary = 'Daily Sync: In Progress';
        syncStatusColor = 'text-primary';
    } else if (inventoryCycle.some(step => step.status === 'READY')) {
        // READY means step is actionable (e.g., Web Inventory Export ready to run)
        syncStatusSummary = 'Daily Sync: Ready to Complete';
        syncStatusColor = 'text-info';
    } else if (inventoryCycle.every(step => step.status === 'DONE' || step.status === 'NEUTRAL')) {
        syncStatusSummary = 'Daily Sync: Up to Date';
        syncStatusColor = 'text-success';
    }

    return {
      isHealthy,
      alerts,
      lastValidationTimestamp: lastMasterValidation === 'N/A' ? 'N/A' : Utilities.formatDate(lastMasterValidation, Session.getScriptTimeZone(), 'MM/dd HH:mm'),
      isValidationRecent,
      passedValidations,
      inventoryCycle,
      isInventoryExportReady,
      activeFailureTasks,
      syncStatusSummary: {
        text: syncStatusSummary,
        color: syncStatusColor
      }
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

    const executionContext = {
        jobId: newJobRow.job_id,
        jobType: newJobRow.job_type,
        sessionId: newJobRow.job_id, // Using job_id as session_id for manual runs
        jobQueueSheetRowNumber: newJobRowNumber,
        jobQueueHeaders: jobQueueHeaders
    };

    const result = ValidationOrchestratorService.processJob(executionContext);
    finalOverallStatus = result.finalStatus;
    finalErrorMessage = result.failureCount > 0 ? `${result.failureCount} rules failed.` : '';

    return {
      success: finalOverallStatus !== 'FAILED' && finalOverallStatus !== 'QUARANTINED',
      message: finalErrorMessage || 'Validation completed.',
      results: [] // Detailed results are now tasks, UI should fetch tasks if needed or we can enhance Orchestrator return
    };

  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    finalErrorMessage = `Failed to run validation: ${e.message}`;
    
    // Update job status to FAILED on catch, as Orchestrator might have thrown before updating
    if (newJobRowNumber) {
        try {
             const allConfig = ConfigService.getAllConfig();
             const logSpreadsheet = SpreadsheetApp.openById(allConfig['system.spreadsheet.logs'].id);
             const jobQueueSheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysJobQueue);
             const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
             const statusColIdx = jobQueueHeaders.indexOf('status');
             const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');
             const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');

             jobQueueSheet.getRange(newJobRowNumber, statusColIdx + 1).setValue('FAILED');
             jobQueueSheet.getRange(newJobRowNumber, processedTsColIdx + 1).setValue(new Date());
             jobQueueSheet.getRange(newJobRowNumber, errorMsgColIdx + 1).setValue(finalErrorMessage);
        } catch (updateError) {
             LoggerService.error(serviceName, functionName, `Failed to update job status on error: ${updateError.message}`);
        }
    }

    return { success: false, error: finalErrorMessage };
  }
}

/**
 * Executes the automated unit test suite.
 * @returns {Object} The test results.
 */
function WebAppSystem_runUnitTests() {
  const serviceName = 'WebAppSystem';
  const functionName = 'runUnitTests';
  LoggerService.info(serviceName, functionName, 'Starting unit tests...');

  try {
    const results = TestRunner.runAllTests();
    LoggerService.info(serviceName, functionName, `Unit tests completed. Passed: ${results.passed}, Failed: ${results.failed}`);
    return { success: true, results: results };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Error running unit tests: ${e.message}`, e);
    return { success: false, error: e.message };
  }
}

