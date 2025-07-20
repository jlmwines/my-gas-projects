/**
 * @file ImportComaxProducts.gs
 * @description Imports Comax Product data from the designated CSV file into ComaxS, applying preprocessing and validation rules.
 * @version 25-07-17-1100
 */

/**
 * HELPER: Locate CSV file in "Import" folder.
 * This is a shared helper function.
 * @param {string} fileName The name of the file to locate.
 * @returns {GoogleAppsScript.Drive.File} The found file object.
 * @throws {Error} If the 'Import' folder or the specified file cannot be found.
 */
function getFileFromImportFolder(fileName) {
    const folders = DriveApp.getFoldersByName('Import');
    if (!folders.hasNext()) throw new Error("The 'Import' folder was not found in your Google Drive.");

    const importFolder = folders.next();
    const files = importFolder.getFilesByName(fileName);
    if (!files.hasNext()) throw new Error(`The file "${fileName}" was not found in the 'Import' folder.`);

    return files.next();
}

/**
 * LAUNCHER: Called from the sidebar or a custom menu.
 * This function orchestrates the import process, including user confirmations.
 * @returns {object} A status object for the sidebar UI, e.g., {status: 'success', message: '...'}.
 * @throws {Error} Throws an error if the user cancels or if the import fails, to be caught by the calling UI.
 */
function importComaxProducts() {
    const ui = SpreadsheetApp.getUi();
    const sourceFileName = activeConfig.importFileNames.comaxProducts; // Get filename from Globals

    try {
        const response = ui.alert(
            'Confirm Comax Import',
            `This will replace all data in 'ComaxS' with the contents of '${sourceFileName}'.\n\nContinue?`,
            ui.ButtonSet.YES_NO
        );

        if (response !== ui.Button.YES) {
            throw new Error("User cancelled the import.");
        }

        // --- Execute the main import logic ---
        const message = executeComaxImport(sourceFileName, ui);
        return { status: 'success', message: message };

    } catch (e) {
        Logger.log(`ImportComaxProducts failed: ${e.message}`);
        // Re-throw the error so the sidebar's error handler can catch it
        throw new Error(e.message);
    }
}

/**
 * WORKER: Contains the main import logic.
 * Handles file date validation, data patching, conversion via DriveV2, and writing to the sheet.
 * @param {string} sourceFileName The name of the file to import.
 * @param {GoogleAppsScript.Base.Ui} ui The active Spreadsheet UI for alerts.
 * @returns {string} A success message detailing the outcome.
 * @throws {Error} Propagates errors up to the launcher function.
 */
function executeComaxImport(sourceFileName, ui) {
    const targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ComaxS");
    if (!targetSheet) throw new Error("Sheet 'ComaxS' not found.");

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

    // --- 2. Read file and patch header ---
    const originalBlob = sourceFile.getBlob();
    const rawContent = originalBlob.getDataAsString('Windows-1255'); // Use specified Hebrew encoding

    const lines = rawContent.split('\n');
    if (lines.length > 0) {
        const headerCells = lines[0].split(',');
        // Ensure column O (index 14) has a header if it's blank or missing
        if (headerCells.length < 15 || !headerCells[14].trim()) {
            headerCells[14] = 'CMX_PRICE'; // Patch the header
            lines[0] = headerCells.join(',');
        }
    }
    const patchedContent = lines.join('\n');
    const cleanBlob = Utilities.newBlob(patchedContent, MimeType.CSV, sourceFileName);

    // --- 3. Use DriveV2 to convert CSV to a temporary Google Sheet for robust parsing ---
    const tempSpreadsheetResource = { title: `[TEMP] Comax Import - ${new Date().toISOString()}` };
    const tempSheetFile = DriveV2.Files.insert(tempSpreadsheetResource, cleanBlob, { convert: true });
    let allData;

    try {
        const tempSpreadsheet = SpreadsheetApp.openById(tempSheetFile.id);
        const sourceSheet = tempSpreadsheet.getSheets()[0];
        allData = sourceSheet.getDataRange().getValues();
    } finally {
        // Ensure the temporary file is always deleted, even if errors occur
        DriveApp.getFileById(tempSheetFile.id).setTrashed(true);
    }

    if (!allData || allData.length < 2) {
        throw new Error(`The file "${sourceFileName}" appears to be empty or contains only a header row.`);
    }

    // --- 4. Process and write data to the target sheet ---
    const dataRowsOnly = allData.slice(1); // Exclude header row

    // Clear previous content (from row 2 downwards) and write new data
    targetSheet.getRange(2, 1, targetSheet.getMaxRows() - 1, targetSheet.getMaxColumns()).clearContent();
    if (dataRowsOnly.length > 0 && dataRowsOnly[0].length > 0) {
        targetSheet.getRange(2, 1, dataRowsOnly.length, dataRowsOnly[0].length).setValues(dataRowsOnly);
    }

    // --- 5. Sort the data in the sheet ---
    const sortRange = targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, targetSheet.getLastColumn());
    if (sortRange.getNumRows() > 0) {
        // Sort by column 3 (CMX NAME), then by column 2 (CMX SKU)
        sortRange.sort([{ column: 3, ascending: true }, { column: 2, ascending: true }]);
    }

    SpreadsheetApp.flush(); // Apply all pending changes
    return `Successfully imported, processed, and sorted ${dataRowsOnly.length} rows from "${sourceFileName}".`;
}
