/**
 * @file ValidationOrchestratorService.js
 * @description Orchestrates validation jobs, bridging ValidationLogic and TaskService.
 */

const ValidationOrchestratorService = (function() {

  function processValidationResults(analysisResult, sessionId) {
    let quarantineTriggered = false;
    let failureCount = 0;

    analysisResult.results.forEach(result => {
        if (result.status === 'FAILED') {
            failureCount++;
            const rule = result.rule;
            const discrepancies = result.discrepancies;

            // Aggregation Logic
            // Some task types require individual tasks per entity (e.g., inventory tasks need SKU for export)
            const noSummaryTypes = ['task.validation.comax_internal_audit'];
            const allowSummary = !noSummaryTypes.includes(rule.on_failure_task_type);

            if (discrepancies.length > 10 && allowSummary) {
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

    return { quarantineTriggered, failureCount };
  }

  function processJob(executionContext) {
    const serviceName = 'ValidationOrchestratorService';
    const functionName = 'processJob';
    const { jobType, jobQueueSheetRowNumber, sessionId } = executionContext;

    logger.info(serviceName, functionName, `Starting validation job: ${jobType}`, { sessionId: sessionId });

    // Validation runs silently - no UI status update
    // This prevents validation from conflicting with visible import/export steps

    // 1. Determine Suite Name based on Job Type
    let suiteName = '';
    if (jobType === 'manual.validation.master' || jobType === 'periodic.validation.master' || jobType === 'job.periodic.validation.master') {
        suiteName = 'master_master';
    } else {
        throw new Error(`Unknown validation job type: ${jobType}`);
    }

    // 2. Run Validation Logic (Pure Analysis)
    const analysisResult = ValidationLogic.runValidationSuite(suiteName, sessionId);

    if (!analysisResult.success) {
        throw new Error('Validation suite execution failed.');
    }

    // 3. Process Results & Create Tasks (Refactored)
    const processingOutcome = processValidationResults(analysisResult, sessionId);
    const { quarantineTriggered, failureCount } = processingOutcome;

    // 4. Determine Job Status
    let finalStatus = 'COMPLETED';
    if (quarantineTriggered) {
        finalStatus = 'QUARANTINED';

        // Report quarantine through unified notification system
        NotificationService.reportFailure(
          `validation.${suiteName}`,
          `Quarantine triggered: ${failureCount} critical validation issues`,
          'Critical',
          { suiteName: suiteName, failureCount: failureCount, sessionId: sessionId },
          sessionId
        );
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

    // Validation runs silently - no UI status update
    // Quarantine status is still logged, but doesn't update visible step display

    return { finalStatus, failureCount, quarantineTriggered };
  }

  function runValidationSuite(suiteName, sessionId) {
    const analysisResult = ValidationLogic.runValidationSuite(suiteName, sessionId);
    
    if (!analysisResult.success) {
        throw new Error('Validation suite execution failed.');
    }

    const { quarantineTriggered, failureCount } = processValidationResults(analysisResult, sessionId);
    
    return { quarantineTriggered, failureCount };
  }

  function formatString(template, dataRow) {
    if (!template) return '';
    return template.replace(/\${(.*?)}/g, (match, key) => {
      const val = dataRow[key.trim()];
      return val !== undefined && val !== null ? val : '';
    });
  }

  function _createSummaryTask(rule, discrepancies, sessionId) {
      const cleanedTitle = rule.on_failure_title.replace(/\${.*?}/g, '').trim(); 
      const title = `${cleanedTitle} (Summary: ${discrepancies.length} Items)`;
      
      // Clean notes as well
      let cleanedNotes = rule.on_failure_notes.replace(/\${.*?}/g, '[Variable]').trim();
      const notes = `${cleanedNotes}\nSummary of ${discrepancies.length} failures.\nSee SysLog for details.\nFirst few: ${discrepancies.slice(0,5).map(d => d.key).join(', ')}`;
      
      // Create a system-level task
      TaskService.createTask(rule.on_failure_task_type, 'SYSTEM', 'System', title, notes, sessionId);
  }

  function _createIndividualTask(rule, discrepancy, sessionId) {
      // Merge data and key for template context
      const contextData = { ...(discrepancy.data || {}), key: discrepancy.key };

      // Extract SKU explicitly for product-related tasks
      let entityId = discrepancy.key;
      if (rule.on_failure_task_type.includes('product') ||
          rule.on_failure_task_type.includes('vintage') ||
          rule.on_failure_task_type.includes('onboarding') ||
          rule.on_failure_task_type.includes('internal_audit')) {
          // Try to get SKU from data - prioritize SKU fields
          const data = discrepancy.data || {};
          entityId = data.cpm_SKU || data.cps_SKU || data.wdm_SKU || data.wds_SKU || discrepancy.key;
      }

      const title = formatString(rule.on_failure_title, contextData);
      // Fallback if title ends up empty or just whitespace because of missing data (though unlikely)
      const finalTitle = title.trim() || rule.on_failure_title;

      const baseNotes = formatString(rule.on_failure_notes, contextData);
      const notes = `${baseNotes}\nDetails: ${discrepancy.details}`;
      const entityName = discrepancy.name || '';

      TaskService.createTask(rule.on_failure_task_type, entityId, entityName, finalTitle, notes, sessionId);
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
    processJob: processJob,
    processValidationResults: processValidationResults,
    runValidationSuite: runValidationSuite
  };

})();
