/**
 * @file ImportWebOrders.gs
 * @description This script is exclusively for importing Web Order data from the designated CSV file.
 * It is designed to be called from a UI controller (like a sidebar).
 * @version 25-07-17-1105
 */

/**
 * Helper function to find a file by name within a specific "Import" folder.
 * This function is a shared utility.
 * @param {string} fileName The name of the file to find.
 * @returns {GoogleAppsScript.Drive.File} The Google Drive file object.
 * @throws {Error} If the folder or file is not found.
 */
function getFileFromImportFolder(fileName) {
    const folders = DriveApp.getFoldersByName('Import');
    if (!folders.hasNext()) {
        throw new Error("The 'Import' folder was not found in your Google Drive.");
    }
    const importFolder = folders.next();

    const files = importFolder.getFilesByName(fileName);
    if (!files.hasNext()) {
        throw new Error(`The file "${fileName}" was not found inside the "Import" folder.`);
    }
    return files.next();
}

/**
 * LAUNCHER: Called by the sidebar. Confirms with the user, then runs the Web Orders import process
 * and returns a status object.
 * @returns {object} An object with status and a message, e.g., {status: 'success', message: '...'}
 * @throws {Error} Throws an error if the user cancels or if the import fails.
 */
function importWebOrders() {
    const ui = SpreadsheetApp.getUi();
    const sourceFileName = activeConfig.importFileNames.webOrders; // Get filename from Globals

    try {
        const response = ui.alert(
            'Confirm Web Orders Import',
            `This will replace all data in the 'OrdersS' sheet with the contents of '${sourceFileName}'.\n\nAre you sure you want to continue?`,
            ui.ButtonSet.YES_NO
        );

        if (response !== ui.Button.YES) {
            throw new Error("User cancelled the import.");
        }

        const successMessage = executeWebOrdersImport(sourceFileName, ui);
        // On success, return a status object for the sidebar to handle.
        return { status: 'success', message: successMessage };
    } catch (e) {
        Logger.log(`ImportWebOrders failed: ${e.message}`);
        // Re-throwing the error allows the sidebar's .withFailureHandler to catch it.
        throw new Error(e.message);
    }
}

/**
 * WORKER: Imports web order data from the specified CSV file into 'OrdersS'.
 * No sorting is applied.
 * @param {string} sourceFileName The name of the file to import.
 * @param {GoogleAppsScript.Base.Ui} ui The active Spreadsheet UI for alerts.
 * @returns {string} The success message.
 * @throws {Error} Propagates errors up to the launcher function.
 */
function executeWebOrdersImport(sourceFileName, ui) {
    const targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("OrdersS");
    if (!targetSheet) throw new Error("Sheet 'OrdersS' not found.");

    // --- 1. Locate the file and validate its modification date ---
    const sourceFile = getFileFromImportFolder(sourceFileName);
    const timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const today = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
    const fileLastUpdated = Utilities.formatDate(sourceFile.getLastUpdated(), timeZone, 'yyyy-MM-dd');

    if (today !== fileLastUpdated) {
        const dateResponse = ui.alert(
            'File Date Mismatch ⚠️',
            `The import file "${sourceFileName}" was last updated on ${fileLastUpdated}, not today (${today}).\n\nDo you want to proceed anyway?`,
            ui.ButtonSet.OK_CANCEL
        );
        if (dateResponse !== ui.Button.OK) {
            throw new Error("User cancelled import due to file date mismatch.");
        }
    }

    // --- 2. Use DriveV2 to convert CSV to a temporary Google Sheet for robust parsing ---
    const csvBlob = sourceFile.getBlob();
    const tempSpreadsheetResource = { title: `[TEMP] Web Orders Import - ${new Date().toISOString()}` };
    const tempSheetFile = DriveV2.Files.insert(tempSpreadsheetResource, csvBlob, { convert: true });
    let allData;

    try {
        const tempSpreadsheet = SpreadsheetApp.openById(tempSheetFile.id);
        allData = tempSpreadsheet.getSheets()[0].getDataRange().getValues();
    } finally {
        // Ensure temporary file is always deleted
        DriveApp.getFileById(tempSheetFile.id).setTrashed(true);
    }

    if (!allData || allData.length < 2) {
        throw new Error(`The file "${sourceFileName}" appears to be empty or contains only a header.`);
    }

    // --- 3. Process and write data to the target sheet ---
    const dataRowsOnly = allData.slice(1); // Exclude header
    const numCols = dataRowsOnly[0] ? dataRowsOnly[0].length : 0;

    // Clear existing content (from row 2 down) and write the new data
    targetSheet.getRange(2, 1, targetSheet.getMaxRows() - 1, targetSheet.getMaxColumns()).clearContent();

    if (dataRowsOnly.length > 0 && numCols > 0) {
        targetSheet.getRange(2, 1, dataRowsOnly.length, numCols).setValues(dataRowsOnly);
    }

    SpreadsheetApp.flush(); // Apply all pending changes

    return `Successfully imported ${dataRowsOnly.length} rows from "${sourceFileName}" into OrdersS.`;
}
