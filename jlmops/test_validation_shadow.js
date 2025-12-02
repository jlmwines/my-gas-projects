/**
 * @file test_validation_shadow.js
 * @description Test script to verify the new Validation Shadow Stack.
 */

function testShadowValidation() {
  const sessionId = 'TEST-SESSION-' + new Date().getTime();
  console.log('Starting Shadow Validation Test. Session ID: ' + sessionId);

  // 1. Setup: Create a dummy job in SysJobQueue
  const allConfig = ConfigService.getAllConfig();
  const logSheetConfig = allConfig['system.spreadsheet.logs'];
  const sheetNames = allConfig['system.sheet_names'];
  const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
  const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
  
  const jobId = 'TEST-JOB-' + Utilities.getUuid();
  const jobType = 'manual.validation.master';
  const now = new Date();
  
  // Append dummy row: job_id, session_id, job_type, status...
  jobQueueSheet.appendRow([jobId, sessionId, jobType, 'PENDING', '', now, '', '', 0, '', '']);
  const rowNumber = jobQueueSheet.getLastRow();
  
  console.log(`Created dummy job on row ${rowNumber}`);

  // 2. Create Execution Context
  const executionContext = {
      sessionId: sessionId,
      jobId: jobId,
      jobType: jobType,
      jobQueueSheetRowNumber: rowNumber,
      jobQueueHeaders: allConfig['schema.log.SysJobQueue'].headers.split(',')
  };

  // 3. Execute Service
  try {
      ValidationOrchestratorService.processJob(executionContext);
      console.log('ValidationOrchestratorService executed successfully.');
  } catch (e) {
      console.error('ValidationOrchestratorService failed: ' + e.message + '\n' + e.stack);
  }

  // 4. Verification (Manual Check recommended)
  console.log('Check SysLog for Session ID: ' + sessionId);
  console.log('Check SysTasks for new tasks created with Session ID.');
  console.log('Check SysJobQueue row ' + rowNumber + ' for status update.');
}
