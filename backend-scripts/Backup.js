/**
 * @file Backup.gs
 * @description Manages "Latest" and "Previous" backup sets and manual snapshots.
 * @version 25-07-07-1415
 */

// --- CONFIGURATION ---
const LATEST_BACKEND_NAME = 'Latest Backend Backup';
const LATEST_REFERENCE_NAME = 'Latest Reference Backup';
const PREVIOUS_BACKEND_NAME = 'Previous Backend Backup';
const PREVIOUS_REFERENCE_NAME = 'Previous Reference Backup';

/**
 * Main backup function that rotates the backup sets.
 */
function backupSheets() {
  const ui = SpreadsheetApp.getUi();
  const confirmationResponse = ui.alert(
    'Confirm Backup',
    'This will create a new "Latest" backup and rotate the existing "Latest" to "Previous". The old "Previous" backup will be deleted. Proceed?',
    ui.ButtonSet.YES_NO
  );

  if (confirmationResponse !== ui.Button.YES) {
    throw new Error("User cancelled the backup.");
  }

  try {
    const backupFolder = DriveApp.getFolderById(activeConfig.backupFolderId);
    if (!backupFolder) {
      throw new Error(`Backup folder with ID "${activeConfig.backupFolderId}" not found.`);
    }
    
    SpreadsheetApp.getActiveSpreadsheet().toast('Starting backup rotation...', 'Backup', 30);

    // 1. Delete the "Previous" backup files
    deleteFileByName(backupFolder, PREVIOUS_BACKEND_NAME);
    deleteFileByName(backupFolder, PREVIOUS_REFERENCE_NAME);
    
    // 2. Rename "Latest" files to "Previous"
    renameFile(backupFolder, LATEST_BACKEND_NAME, PREVIOUS_BACKEND_NAME);
    renameFile(backupFolder, LATEST_REFERENCE_NAME, PREVIOUS_REFERENCE_NAME);
    
    // 3. Create new "Latest" backups
    const backendFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
    backendFile.makeCopy(LATEST_BACKEND_NAME, backupFolder);

    const referenceFile = DriveApp.getFileById(activeConfig.referenceFileId);
    referenceFile.makeCopy(LATEST_REFERENCE_NAME, backupFolder);
    
    Logger.log('Backup rotation complete.');
    return "Backup rotation completed successfully.";

  } catch (e) {
    Logger.log(e);
    SpreadsheetApp.getUi().alert('Backup Failed', `An error occurred: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    throw e; // Re-throw to allow sidebar to catch it
  }
}

/**
 * Creates a one-time, timestamped snapshot of the core files.
 * This does not interfere with the regular backup rotation.
 */
function createManualSnapshot() {
  const ui = SpreadsheetApp.getUi();
  try {
    const backupFolder = DriveApp.getFolderById(activeConfig.backupFolderId);
    if (!backupFolder) {
      throw new Error(`Backup folder with ID "${activeConfig.backupFolderId}" not found.`);
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('Creating manual snapshot...', 'Snapshot', 30);

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm.ss');
    
    // Create timestamped snapshot of the Backend file
    const backendFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
    const backendSnapshotName = `[Snapshot] Backend - ${timestamp}`;
    backendFile.makeCopy(backendSnapshotName, backupFolder);

    // Create timestamped snapshot of the Reference file
    const referenceFile = DriveApp.getFileById(activeConfig.referenceFileId);
    const referenceSnapshotName = `[Snapshot] Reference - ${timestamp}`;
    referenceFile.makeCopy(referenceSnapshotName, backupFolder);

    ui.alert('Snapshot Created', 'A manual snapshot has been successfully saved to your backups folder.', ui.ButtonSet.OK);
    Logger.log(`Created manual snapshot: ${backendSnapshotName}`);

  } catch (e) {
    Logger.log(e);
    ui.alert('Snapshot Failed', `An error occurred: ${e.message}`, ui.ButtonSet.OK);
  }
}


// --- HELPER FUNCTIONS ---

function deleteFileByName(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    const file = files.next();
    file.setTrashed(true);
    Logger.log(`Deleted old backup: "${fileName}"`);
  }
}

function renameFile(folder, oldName, newName) {
  const files = folder.getFilesByName(oldName);
  if (files.hasNext()) {
    const file = files.next();
    file.setName(newName);
    Logger.log(`Renamed "${oldName}" to "${newName}"`);
  }
}