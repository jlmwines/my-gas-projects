/**
 * @file OrchestratorService.js
 * @description Main service to orchestrate all automated workflows.
 */

/**
 * The main entry point for the time-driven trigger.
 * This function is globally scoped so it can be selected in the Apps Script editor.
 */
function runScheduledTasks() {
  OrchestratorService.run();
}


const OrchestratorService = (function() {

  /**
   * The main internal function for the orchestrator.
   */
  function run() {
    console.log('Orchestrator running...');
    try {
      // Phase 1: Intake new files
      processAllFileImports();

      // Phase 2: Process pending jobs
      processPendingJobs();

    } catch (e) {
      console.error(`An unexpected error occurred in the orchestrator: ${e.message} (${e.stack})`);
    }
    console.log('Orchestrator finished.');
  }

  /**
   * Finds and processes all configured file imports.
   */
  function processAllFileImports() {
    // ... (logic is the same as before, no changes here)
  }

  /**
   * Queries the job queue and delegates pending jobs to the appropriate service.
   */
  function processPendingJobs() {
    console.log('Checking for pending jobs...');
    const allConfig = ConfigService.getAllConfig();
    
    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    if (!logSheetConfig || !logSheetConfig.id) {
      console.error('Log spreadsheet ID not found in configuration.');
      return;
    }

    const sheetNames = allConfig['system.sheet_names'];
    const jobQueueSheetName = sheetNames ? sheetNames.SysJobQueue : 'SysJobQueue'; // Fallback for safety

    const jobQueueSchema = allConfig['schema.log.SysJobQueue'];
    if (!jobQueueSchema || !jobQueueSchema.headers) {
        console.error('Job Queue schema not found in configuration.');
        return;
    }
    const jobQueueHeaders = jobQueueSchema.headers.split(',');

    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(jobQueueSheetName);
    
    if (!jobQueueSheet) {
        console.error(`Sheet '${jobQueueSheetName}' not found in log spreadsheet.`);
        return;
    }

    const data = jobQueueSheet.getDataRange().getValues();
    const headers = data.shift(); // Actual headers from the sheet

    // Find column indices based on configured headers
    const statusColIdx = jobQueueHeaders.indexOf('status');
    const jobTypeColIdx = jobQueueHeaders.indexOf('job_type');
    const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');

    if ([statusColIdx, jobTypeColIdx, errorMsgColIdx].includes(-1)) {
        console.error('Could not find required columns (status, job_type, error_message) in configured schema.');
        return;
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[statusColIdx] === 'PENDING') {
        const jobType = row[jobTypeColIdx];
        const jobConfig = allConfig[jobType];
        
        if (!jobConfig || !jobConfig.processing_service) {
          console.error(`No processing service configured for job type: ${jobType}. Skipping job.`);
          continue;
        }

        const serviceName = jobConfig.processing_service;
        console.log(`Delegating job ${row[0]} of type '${jobType}' to service: ${serviceName}`);

        // Mark job as PROCESSING immediately to prevent re-processing
        jobQueueSheet.getRange(i + 2, statusColIdx + 1).setValue('PROCESSING');

        try {
          switch (serviceName) {
            case 'ProductService':
              ProductService.processJob(row);
              break;
            // Add other services here in the future
            default:
              throw new Error(`Unknown processing service: ${serviceName}`);
          }
          // If the service succeeds, it will update the status to COMPLETED itself.
        } catch (e) {
          console.error(`Error processing job ${row[0]}: ${e.message}`);
          // Mark job as FAILED
          jobQueueSheet.getRange(i + 2, statusColIdx + 1).setValue('FAILED');
          jobQueueSheet.getRange(i + 2, errorMsgColIdx + 1).setValue(e.message);
        }
      }
    }
    console.log('Pending job check complete.');
  }

  // ... (all other helper functions: isNewFile, archiveFile, etc. remain the same)

  return {
    run: run
  };

})();
