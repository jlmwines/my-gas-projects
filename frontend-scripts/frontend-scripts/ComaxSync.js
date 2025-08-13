/**
 * Calls the web app to get filtered Comax data and writes it to the local sheet.
 */
function syncComaxDirectory() {
    const ui = SpreadsheetApp.getUi();
    ui.showModalDialog(HtmlService.createHtmlOutput('<b>Syncing...</b>'), 'Updating Comax Directory'); // <-- CORRECTED

    try {
        const payload = { command: 'syncComax' };
        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
            muteHttpExceptions: true
        };

        const apiResponse = UrlFetchApp.fetch(G.WEB_APP_URL, options);
        const result = JSON.parse(apiResponse.getContentText());

        if (result.status !== 'success') {
            throw new Error(result.message);
        }

        const frontendSS = SpreadsheetApp.getActiveSpreadsheet();
        const comaxSheet = frontendSS.getSheetByName(G.SHEET_NAMES.COMAX_DIRECTORY);
        if (!comaxSheet) throw new Error('Frontend sheet "Comax" not found.');

        comaxSheet.clearContents();
        comaxSheet.getRange(1, 1, 1, 2).setValues([['CMX NAME', 'CMX SKU']]);

        const rows = result.data;
        if (rows.length > 0) {
            comaxSheet.getRange(2, 1, rows.length, 2).setValues(rows);
            frontendSS.setActiveSheet(comaxSheet);
        }
        
        ui.showModalDialog(HtmlService.createHtmlOutput('<b>Sync Complete!</b>'), 'Finished'); // <-- CORRECTED

    } catch (err) {
        SpreadsheetApp.getUi().alert(`Could not sync Comax directory: ${err.message}`);
    }
}
/**
 * Server-side worker to get filtered and sorted data from the reference ComaxM sheet.
 * @returns {ContentService.TextOutput} JSON response with data or an error.
 */
function _server_getComaxData() {
    try {
        const refSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const data = refSheet.getDataRange().getValues();

        const CMX_SKU_COL = 1;      // Col B
        const CMX_NAME_COL = 2;     // Col C
        const CMX_ARCHIVE_COL = 12; // Col M

        const rows = data.slice(1)
            .filter(row => row[CMX_ARCHIVE_COL] === '')
            .map(row => [row[CMX_NAME_COL], row[CMX_SKU_COL]])
            .sort((a, b) => a[0].localeCompare(b[0]));

        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: rows })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
}