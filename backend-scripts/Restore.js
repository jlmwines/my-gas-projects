/**
 * @file Restore.gs
 * @description Manages restores from "Latest" & "Previous" backup sets.
 * @version 25-07-06-1101
 */

// --- CONFIGURATION ---
// Sheets to restore in the Backend file during a CORE restore
const CORE_BACKEND_SHEETS = ['WebS', 'ComaxS', 'OrdersS', 'TaskQ']; 
// Sheets to restore in the Reference file during a CORE restore
const CORE_REFERENCE_SHEETS = ['WebM', 'ComaxM', 'OrdersM', 'TaskQ'];

/**
 * Shows the custom HTML dialog for restore options.
 */
function showAdvancedRestoreDialog() {
  const html = HtmlService.createHtmlOutputFromFile('RestoreDialog')
      .setWidth(400)
      .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Select Restore Options');
}

/**
 * The main restore engine, called from the HTML dialog.
 * @param {string} profile The chosen restore profile ('CORE' or 'COMPLETE').
 * @param {string} version The chosen backup version ('LATEST' or 'PREVIOUS').
 */
function executeRestore(profile, version) {
  const ui = SpreadsheetApp.getUi();
  const liveSS = SpreadsheetApp.getActiveSpreadsheet();
  
  const confirm = ui.alert(
    `Confirm Restore: ${profile} - ${version}`,
    'Are you sure? This action cannot be undone. This may take several minutes for a complete restore.',
    ui.ButtonSet.OK_CANCEL
  );

  if (confirm !== ui.Button.OK) {
    throw new Error('Restore canceled by user.');
  }

  try {
    liveSS.toast(`Starting ${version} ${profile} restore...`, 'Restore in Progress', 60);
    const backupFolder = DriveApp.getFolderById(activeConfig.backupFolderId);

    // Determine filenames based on version
    const backendBackupName = version === 'LATEST' ? 'Latest Backend Backup' : 'Previous Backend Backup';
    const referenceBackupName = version === 'LATEST' ? 'Latest Reference Backup' : 'Previous Reference Backup';
    
    // Find the backup files
    const backendBackupFile = getFileByName(backupFolder, backendBackupName);
    const referenceBackupFile = getFileByName(backupFolder, referenceBackupName);

    const backendBackupSS = SpreadsheetApp.open(backendBackupFile);
    const referenceBackupSS = SpreadsheetApp.open(referenceBackupFile);
    const liveReferenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);

    if (profile === 'CORE') {
        liveSS.toast('Restoring CORE sheets to Backend file...', 'Restore in Progress', 60);
        restoreSheetsToFile(backendBackupSS, liveSS, CORE_BACKEND_SHEETS);

        liveSS.toast('Restoring CORE sheets to Reference file...', 'Restore in Progress', 60);
        restoreSheetsToFile(referenceBackupSS, liveReferenceSS, CORE_REFERENCE_SHEETS);

    } else if (profile === 'COMPLETE') {
        liveSS.toast('Performing COMPLETE restore on Backend file...', 'Restore in Progress', 120);
        restoreSheetsToFile(backendBackupSS, liveSS, null); // null restores all sheets

        liveSS.toast('Performing COMPLETE restore on Reference file...', 'Restore in Progress', 120);
        restoreSheetsToFile(referenceBackupSS, liveReferenceSS, null); // null restores all sheets
    }
    
    resetUiState();
    SpreadsheetApp.flush();
    ui.alert('Restore Complete', `The ${version} ${profile} data has been successfully restored.`, ui.ButtonSet.OK);

  } catch (e) {
    Logger.log(e);
    ui.alert('Restore Failed', `An error occurred: ${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Reusable helper function to restore sheets from a source spreadsheet to a destination spreadsheet.
 * @param {Spreadsheet} sourceSS The backup spreadsheet to copy from.
 * @param {Spreadsheet} destinationSS The live spreadsheet to restore to.
 * @param {string[]|null} sheetNames An array of sheet names to restore. If null, all sheets are restored.
 */
/**
 * Reusable helper function to restore sheets from a source spreadsheet to a destination spreadsheet.
 * @param {Spreadsheet} sourceSS The backup spreadsheet to copy from.
 * @param {Spreadsheet} destinationSS The live spreadsheet to restore to.
 * @param {string[]|null} sheetNames An array of sheet names to restore. If null, all sheets are restored.
 */
function restoreSheetsToFile(sourceSS, destinationSS, sheetNames) {
  let sheetsToRestore = sheetNames;
  
  if (!sheetsToRestore) {
    // --- COMPLETE RESTORE LOGIC ---
    // Get all sheet names from the source backup
    sheetsToRestore = sourceSS.getSheets().map(s => s.getName());
    
    // 1. Add a temporary placeholder sheet to prevent "cannot delete all sheets" error.
    const tempSheet = destinationSS.insertSheet('_temp_restore_');
    
    // 2. Delete all original sheets.
    destinationSS.getSheets().forEach(sheet => {
      if (sheet.getName() !== '_temp_restore_') {
        destinationSS.deleteSheet(sheet);
      }
    });

    // 3. Copy all sheets from the backup.
    sheetsToRestore.forEach(name => {
      const backupSheet = sourceSS.getSheetByName(name);
      if (backupSheet) {
        backupSheet.copyTo(destinationSS).setName(name);
      }
    });

    // 4. Delete the temporary placeholder sheet.
    destinationSS.deleteSheet(tempSheet);

  } else {
    // --- CORE RESTORE LOGIC (Unchanged) ---
    const sheetPositions = {};
    sheetNames.forEach(name => {
      const sheet = destinationSS.getSheetByName(name);
      if (sheet) sheetPositions[name] = sheet.getIndex();
    });
    
    sheetsToRestore.forEach(sheetName => {
      const backupSheet = sourceSS.getSheetByName(sheetName);
      if (!backupSheet) {
        Logger.log(`- Skipping: Sheet "${sheetName}" not found in source backup file.`);
        return;
      }
      
      const liveSheet = destinationSS.getSheetByName(sheetName);
      if (liveSheet) destinationSS.deleteSheet(liveSheet);
      
      const newSheet = backupSheet.copyTo(destinationSS).setName(sheetName);

      if (sheetPositions[sheetName]) {
        destinationSS.setActiveSheet(newSheet);
        destinationSS.moveActiveSheet(sheetPositions[sheetName]);
      }
    });
  }
}

/**
 * Finds a file in a folder by name and returns it. Throws an error if not found.
 */
function getFileByName(folder, fileName) {
    const files = folder.getFilesByName(fileName);
    if (!files.hasNext()) {
        throw new Error(`Required backup file not found: "${fileName}" in folder "${folder.getName()}"`);
    }
    return files.next();
}