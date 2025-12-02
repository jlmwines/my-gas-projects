/**
 * @file ValidationOrchestratorService.js
 * @description Orchestrates validation jobs, bridging ValidationLogic and TaskService.
 */

const ValidationOrchestratorService = (function() {

  function processJob(executionContext) {
    const serviceName = 'ValidationOrchestratorService';
    const functionName = 'processJob';
    const { jobType, jobQueueSheetRowNumber, sessionId } = executionContext;

    logger.info(serviceName, functionName, `Starting validation job: ${jobType}`, { sessionId: sessionId });

    // 1. Determine Suite Name based on Job Type
    let suiteName = '';
    if (jobType === 'manual.validation.master' || jobType === 'periodic.validation.master') {
        suiteName = 'master_master';
    } else {
        throw new Error(`Unknown validation job type: ${jobType}`);
    }

    // 2. Run Validation Logic (Pure Analysis)
    const analysisResult = ValidationLogic.runValidationSuite(suiteName, sessionId);

    if (!analysisResult.success) {
        throw new Error('Validation suite execution failed.');
    }

    // 3. Process Results & Create Tasks
    let quarantineTriggered = false;
    let failureCount = 0;

    analysisResult.results.forEach(result => {
        if (result.status === 'FAILED') {
            failureCount++;
            const rule = result.rule;
            const discrepancies = result.discrepancies;

            // Aggregation Logic
            if (discrepancies.length > 10) {
                // Create Summary Task
                _createSummaryTask(rule, discrepancies, sessionId);
            } else {
                // Create Individual Tasks
                discrepancies.forEach(discrepancy => {
                    _createIndividualTask(rule, discrepancy, sessionId);
                });
            }

            if (String(rule.on_failure_quarantine).toUpperCase() === 'TRUE') {
                quarantineTriggered = true;
            }
        }
    });

    // 4. Determine Job Status
    let finalStatus = 'COMPLETED';
    if (quarantineTriggered) {
        finalStatus = 'QUARANTINED';
    } else if (failureCount > 0) {
        // Use COMPLETED with warnings? or separate status?
        // Current convention is COMPLETED unless critical quarantine
        finalStatus = 'COMPLETED'; 
    }

    logger.info(serviceName, functionName, `Validation complete. Failures: ${failureCount}. Quarantine: ${quarantineTriggered}.`, { sessionId: sessionId, finalStatus: finalStatus });
    
    // 5. Update Job Status (Helper internal to this or ProductService?)
    // Ideally Orchestrator handles this, but currently ProductService does it.
    // We need to update the SysJobQueue status.
    _updateJobStatus(executionContext, finalStatus, failureCount > 0 ? `${failureCount} rules failed.` : '');
  }

  function _createSummaryTask(rule, discrepancies, sessionId) {
      const title = `${rule.on_failure_title} (Summary: ${discrepancies.length} Items)`;
      const notes = `${rule.on_failure_notes}\n\nSummary of ${discrepancies.length} failures.\nSee SysLog for details.\nFirst few: ${discrepancies.slice(0,5).map(d => d.key).join(', ')}`;
      
      // Create a system-level task
      TaskService.createTask(rule.on_failure_task_type, 'SYSTEM', title, notes); // TODO: Add sessionId support to TaskService
  }

  function _createIndividualTask(rule, discrepancy, sessionId) {
      // Simple template replacement for now
      const title = rule.on_failure_title.replace('${key}', discrepancy.key); 
      const notes = `${rule.on_failure_notes}\n\nDetails: ${discrepancy.details}`;
      
      TaskService.createTask(rule.on_failure_task_type, discrepancy.key, title, notes);
  }

  // Duplicate from ProductService for now, ideally shared utility
  function _updateJobStatus(executionContext, status, errorMessage = '') {
    const { jobQueueSheetRowNumber, jobQueueHeaders, jobId } = executionContext;
    try {
      const allConfig = ConfigService.getAllConfig();
      const logSpreadsheet = SpreadsheetApp.openById(allConfig['system.spreadsheet.logs'].id);
      const jobQueueSheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysJobQueue);

      const statusColIdx = jobQueueHeaders.indexOf('status');
      const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');
      const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');

      jobQueueSheet.getRange(jobQueueSheetRowNumber, statusColIdx + 1).setValue(status);
      jobQueueSheet.getRange(jobQueueSheetRowNumber, processedTsColIdx + 1).setValue(new Date());
      if (errorMessage) {
        jobQueueSheet.getRange(jobQueueSheetRowNumber, errorMsgColIdx + 1).setValue(errorMessage);
      }
    } catch (e) {
      console.error(`Failed to update job status: ${e.message}`);
    }
  }

  return {
    processJob: processJob
  };

})();
