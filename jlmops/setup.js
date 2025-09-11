/**
 * @file setup.js
 * @description Contains a one-time setup function to create log sheets.
 */

/**
 * Creates all necessary log sheets in the dedicated JLMops_Logs spreadsheet.
 * This function reads the required spreadsheet ID from the SysConfig sheet.
 */
function setupLogSheets() {
  const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
  if (!logSheetConfig || !logSheetConfig.id) {
    console.error("Log Spreadsheet ID not found in SysConfig. Please ensure the 'system.spreadsheet.logs' configuration is correct.");
    return;
  }
  
  const logSpreadsheetId = logSheetConfig.id;
  console.log(`Attempting to set up log sheets in spreadsheet ID: ${logSpreadsheetId}`);

  try {
    const spreadsheet = SpreadsheetApp.openById(logSpreadsheetId);

    // Sheet: SysJobQueue
    const jobQueueSheetName = 'SysJobQueue';
    let jobQueueSheet = spreadsheet.getSheetByName(jobQueueSheetName);
    if (!jobQueueSheet) {
      jobQueueSheet = spreadsheet.insertSheet(jobQueueSheetName);
      console.log(`Sheet '${jobQueueSheetName}' created.`);
    }
    ensureHeaderRow(jobQueueSheet, ['job_id', 'job_type', 'status', 'archive_file_id', 'created_timestamp', 'processed_timestamp', 'error_message']);

    // Sheet: SysFileRegistry
    const fileRegistrySheetName = 'SysFileRegistry';
    let fileRegistrySheet = spreadsheet.getSheetByName(fileRegistrySheetName);
    if (!fileRegistrySheet) {
      fileRegistrySheet = spreadsheet.insertSheet(fileRegistrySheetName);
      console.log(`Sheet '${fileRegistrySheetName}' created.`);
    }
    ensureHeaderRow(fileRegistrySheet, ['source_file_id', 'source_file_name', 'last_processed_timestamp']);

    // Sheet: SysLog
    const logSheetName = 'SysLog';
    let logSheet = spreadsheet.getSheetByName(logSheetName);
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet(logSheetName);
      console.log(`Sheet '${logSheetName}' created.`);
    }
    ensureHeaderRow(logSheet, ['timestamp', 'level', 'service', 'function', 'message', 'details']);
    
    console.log("Log sheets setup completed successfully.");

  } catch (e) {
    console.error(`Failed to open or modify the log spreadsheet. Please verify the ID in SysConfig is correct and you have access. Error: ${e.message}`);
  }
}

/**
 * Ensures the header row for a given sheet exists and matches the expected headers.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to check.
 * @param {Array<string>} expectedHeaders An array of the expected header strings.
 */
function ensureHeaderRow(sheet, expectedHeaders) {
  try {
    const currentHeaders = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
    let needsUpdate = false;
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (currentHeaders[i] !== expectedHeaders[i]) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      console.log(`Header row for sheet '${sheet.getName()}' has been updated.`);
    }
  } catch (e) {
    // This error is expected if the sheet is completely empty
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    console.log(`Header row for sheet '${sheet.getName()}' has been set.`);
  }
}
