/**
 * @file WebAppSystem.js
 * @description Provides backend functions for the System Health dashboard widget and view.
 */


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
    const jobQueueSheetName = allConfig['system.sheet_names'].SysJobQueue;
    const jobQueueSheet = SheetAccessor.getLogSheet(jobQueueSheetName);
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
             const jobQueueSheet = SheetAccessor.getLogSheet(allConfig['system.sheet_names'].SysJobQueue);
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

/**
 * On-demand refresh of the flat-file status export (reliability audit 3.2 /
 * OPS_SESSION_BRIDGE_PLAN). Pushes BOTH the health and KPI sections of
 * jlmops-status.md now, instead of waiting for the 15-min / daily cadences.
 * Also applies any pending calendar staging updates now, instead of waiting
 * for the daily housekeeping cadence (CALENDAR_LIBRARY_LOOP_PLAN Phase 1 —
 * replaces the old wipe-and-rebuild refreshCalendarExport).
 * Driven by the Developer screen "Push Status Export" button.
 * @returns {Object} { success, fileId } or { success:false, error }.
 */
function WebAppSystem_refreshStatusExport() {
  const serviceName = 'WebAppSystem';
  const functionName = 'refreshStatusExport';
  const sessionId = Utilities.getUuid();
  LoggerService.info(serviceName, functionName, 'On-demand status export refresh (health + KPI)...');

  try {
    const health = StatusReportService.refreshLiveBlocks(sessionId);
    const kpi = StatusReportService.refreshKpiBlock(sessionId);
    const cal = StatusReportService.applyPendingCalendarUpdates(sessionId);
    if (!health.success || !kpi.success) {
      return { success: false, error: 'health: ' + (health.error || 'ok') + ' · kpi: ' + (kpi.error || 'ok') };
    }
    return { success: true, fileId: kpi.fileId, calFilesProcessed: cal.filesProcessed, calRowsMerged: cal.rowsMerged };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Error refreshing status export: ${e.message}`, e);
    return { success: false, error: e.message };
  }
}

/**
 * Returns sorted list of sheet names discoverable from schema config keys
 * (schema.data.* + schema.library.*). Used to populate the Dev view Sync Headers picker.
 * @returns {string[]}
 */
function WebAppSystem_getSchemaSheetNames() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const names = Object.keys(allConfig)
      .filter(k => k.startsWith('schema.data.') || k.startsWith('schema.library.'))
      .map(k => k.replace('schema.data.', '').replace('schema.library.', ''))
      .sort();
    return names;
  } catch (e) {
    return [];
  }
}

/**
 * Syncs the header row of a single sheet from its schema config entry.
 * Driven by the Developer screen "Sync Headers" picker.
 * @param {string} sheetName
 * @returns {Object} { success, columns } or { success:false, error }.
 */
function WebAppSystem_syncHeaders(sheetName) {
  const serviceName = 'WebAppSystem';
  const functionName = 'syncHeaders';
  try {
    if (!sheetName) return { success: false, error: 'No sheet name provided.' };
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig[`schema.data.${sheetName}`] || allConfig[`schema.library.${sheetName}`];
    const columns = schema && schema.headers ? schema.headers.split(',').length : null;
    syncHeaders(sheetName);
    LoggerService.info(serviceName, functionName, `Headers synced on ${sheetName}.`);
    return { success: true, columns: columns };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Error syncing headers on ${sheetName}: ${e.message}`, e);
    return { success: false, error: e.message };
  }
}

