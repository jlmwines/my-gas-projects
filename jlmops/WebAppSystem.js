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

    if (taskSheet.getLastRow() > 1) {
      const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));
      
      taskData.forEach(row => {
        const status = row[taskHeaderMap['st_Status']];
        const priority = row[taskHeaderMap['st_Priority']];
        const typeId = row[taskHeaderMap['st_TaskTypeId']];

        if (status !== 'Done' && status !== 'Cancelled' && priority === 'High' && criticalTaskTypes.has(typeId)) {
          openHighPriorityTaskTypes.add(typeId);
          const suite = taskTypeToSuiteMap.get(typeId) || 'General';
          alertsBySuite.set(suite, (alertsBySuite.get(suite) || 0) + 1);
        }
      });
    }

    const alerts = Array.from(alertsBySuite.entries()).map(([suite, count]) => {
        const suiteName = suite.charAt(0).toUpperCase() + suite.slice(1).replace(/_/g, ' ');
        return `${suiteName}: ${count}`;
    });

    // --- Analyze SysJobQueue for Last Validation Timestamp ---
    const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
    const jobQueueSheet = SpreadsheetApp.openById(logSpreadsheetId).getSheetByName(sheetNames.SysJobQueue);
    if (!jobQueueSheet) throw new Error(`Sheet '${sheetNames.SysJobQueue}' not found.`);

    let lastMasterValidation = 'N/A';
    let recentErrors = 0; // Still need to check SysLog for recent errors

    const jobQueueData = jobQueueSheet.getLastRow() > 1 ? jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueSheet.getLastColumn()).getValues() : [];
    const jobQueueHeaders = jobQueueSheet.getRange(1, 1, 1, jobQueueSheet.getLastColumn()).getValues()[0];
    const jobTypeCol = jobQueueHeaders.indexOf('job_type');
    const jobStatusCol = jobQueueHeaders.indexOf('status');
    const processedTimestampCol = jobQueueHeaders.indexOf('processed_timestamp');

    for (let i = jobQueueData.length - 1; i >= 0; i--) {
      const row = jobQueueData[i];
      if (row[jobTypeCol] === 'manual.validation.master' && row[jobStatusCol] === 'COMPLETED') {
        lastMasterValidation = new Date(row[processedTimestampCol]);
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

    return {
      isHealthy,
      alerts,
      lastValidationTimestamp: lastMasterValidation === 'N/A' ? 'N/A' : lastMasterValidation.toLocaleString(),
      isValidationRecent,
      passedValidations
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
