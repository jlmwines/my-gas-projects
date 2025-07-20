/**
 * @file OpenSidebar.gs
 * @description Contains functions to launch and support the main workflow sidebar.
 * @version 25-07-17-1125
 */

/**
 * Creates and displays the main workflow sidebar in the UI.
 */
function showWorkflowSidebar() {
    const html = HtmlService.createHtmlOutputFromFile('Sidebar')
        .setTitle('Workflow Dashboard');
    SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * HELPER: Locate CSV file in "Import" folder.
 * This is a shared helper function required by getImportFileDates.
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
 * Gets the last updated dates for the primary import files.
 * This function is called by the sidebar to display file status.
 * @returns {object} An object containing the formatted dates, e.g., { webDate: 'YYYY-MM-DD', comaxDate: 'YYYY-MM-DD' }.
 * Returns 'Not found' if a file is missing.
 */
function getImportFileDates() {
    const timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const webFileName = activeConfig.importFileNames.webProducts;
    const comaxFileName = activeConfig.importFileNames.comaxProducts;

    let webDate = 'Not found';
    let comaxDate = 'Not found';

    // Safely try to get the date for the web products file
    try {
        const webFile = getFileFromImportFolder(webFileName);
        webDate = Utilities.formatDate(webFile.getLastUpdated(), timeZone, 'yyyy-MM-dd');
    } catch (e) {
        Logger.log(`Could not find or access ${webFileName}: ${e.message}`);
    }

    // Safely try to get the date for the Comax products file
    try {
        const comaxFile = getFileFromImportFolder(comaxFileName);
        comaxDate = Utilities.formatDate(comaxFile.getLastUpdated(), timeZone, 'yyyy-MM-dd');
    } catch (e) {
        Logger.log(`Could not find or access ${comaxFileName}: ${e.message}`);
    }

    return { webDate, comaxDate };
}
