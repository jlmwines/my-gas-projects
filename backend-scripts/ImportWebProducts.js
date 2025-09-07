/**
 * @file ImportWebProducts.gs
 * @description This script is exclusively for importing Web Product data from the designated CSV file.
 * It is designed to be called from a UI controller (like a sidebar).
 * @version 25-07-17-1110
 */

/**
 * Helper function to find a file by name within a specific "Import" folder.
 * This function is a shared utility.
 * @param {string} fileName The name of the file to find.
 * @returns {GoogleAppsScript.Drive.File} The Google Drive file object.
 * @throws {Error} If the folder or file is not found.
 */
function getFileFromImportFolder(fileName) {
    // Use the specific Folder ID from Globals.js for reliability
    const importFolderId = activeConfig.importFolderId;
    if (!importFolderId) {
        throw new Error("The 'Import' folder ID is not defined in Globals.js.");
    }
    let importFolder;
    try {
        importFolder = DriveApp.getFolderById(importFolderId);
    } catch (e) {
        Logger.log(`Failed to get folder by ID. Error: ${e.message}`);
        throw new Error(`Could not access the 'Import' folder. Please check that the folder with ID "${importFolderId}" exists and you have access to it.`);
    }

    const files = importFolder.getFilesByName(fileName);
    if (!files.hasNext()) {
        throw new Error(`The file "${fileName}" was not found in the 'Import' folder with ID "${importFolderId}".`);
    }
    return files.next();
}

/**
 * LAUNCHER: Called by the sidebar. Confirms with the user, then runs the Web import process
 * and returns a status object.
 * @returns {object} An object with status and a message, e.g., {status: 'success', message: '...'}
 * @throws {Error} Throws an error if the user cancels or if the import fails.
 */
function importWebProducts() {
    const ui = SpreadsheetApp.getUi();
    const sourceFileName = activeConfig.importFileNames.webProducts; // Get filename from Globals

    try {
        

        const successMessage = executeWebImport(sourceFileName, ui);
        // On success, return a status object for the sidebar to handle.
        return { status: 'success', message: successMessage };
    } catch (e) {
        Logger.log(`ImportWebProducts failed: ${e.message}`);
        // Re-throwing the error allows the sidebar's .withFailureHandler to catch it.
        throw new Error(e.message);
    }
}

/**
 * WORKER: Performs the robust Web import and then sorts the sheet.
 * Imports data into the 'WebS' sheet (columns A-F) and sorts products by their 'Name' column.
 * @param {string} sourceFileName The name of the file to import.
 * @param {GoogleAppsScript.Base.Ui} ui The active Spreadsheet UI for alerts.
 * @returns {string} The success message.
 * @throws {Error} Propagates errors up to the launcher function.
 */
function executeWebImport(sourceFileName, ui) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = ss.getSheetByName("WebS");
    if (!targetSheet) throw new Error("Sheet 'WebS' not found.");

    // --- 1. Locate the file and validate its modification date ---
    const sourceFile = getFileFromImportFolder(sourceFileName);
    const timeZone = ss.getSpreadsheetTimeZone();
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

    // --- 2. Use DriveV2 to convert CSV to a temporary Google Sheet ---
    const csvBlob = sourceFile.getBlob();
    const tempSpreadsheetResource = { title: `[TEMP] Web Import - ${new Date().toISOString()}` };
    const tempSheetFile = DriveV2.Files.insert(tempSpreadsheetResource, csvBlob, { convert: true });
    let allData;

    try {
        const tempSpreadsheet = SpreadsheetApp.openById(tempSheetFile.id);
        allData = tempSpreadsheet.getSheets()[0].getDataRange().getValues();
    } finally {
        DriveApp.getFileById(tempSheetFile.id).setTrashed(true);
    }

    if (!allData || allData.length < 2) {
        throw new Error(`The file "${sourceFileName}" appears to be empty or contains only a header.`);
    }

    // --- 3. Validate header and prepare for in-memory sort ---
    const webCsvHeader = allData[0];
    const webCsvNameCol = webCsvHeader.indexOf('Name');

    if (webCsvNameCol === -1) {
        throw new Error(`Required column 'Name' not found in '${sourceFileName}' header. Ensure exact case-sensitive match.`);
    }

    const dataRowsOnly = allData.slice(1);
    // Limit import to the first 6 columns (A-F)
    const numColsToImport = Math.min(dataRowsOnly[0].length, 6);

    // Sort the data in memory by 'Name' before writing to the sheet
    dataRowsOnly.sort((a, b) => {
        const nameA = String(a[webCsvNameCol] || '');
        const nameB = String(b[webCsvNameCol] || '');
        return nameA.localeCompare(nameB);
    });

    // Extract only the columns needed after sorting
    const finalDataToWrite = dataRowsOnly.map(row => row.slice(0, numColsToImport));

    // --- 4. Write sorted data to the sheet ---
    targetSheet.getRange("A2:F").clearContent();
    if (finalDataToWrite.length > 0) {
        targetSheet.getRange(2, 1, finalDataToWrite.length, numColsToImport).setValues(finalDataToWrite);
    }

    SpreadsheetApp.flush();

    return `Successfully imported and processed ${finalDataToWrite.length} rows from "${sourceFileName}".`;
}
