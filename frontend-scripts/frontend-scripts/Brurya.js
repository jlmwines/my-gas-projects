/**
 * @file Brurya.gs — Sheet Controller
 * @description Manages the Brurya counting workflow using a client/server model.
 * @version 2025-07-27-1321
 */

// --- CLIENT-SIDE FUNCTIONS (Called from Menu or Triggers) ---

function populateBruryaSheetFromAudit() {
    const ui = SpreadsheetApp.getUi();
    if (!getActiveUser()) {
        ui.alert('Please select a user from the Dashboard first.');
        return;
    }
    ui.showModalDialog(HtmlService.createHtmlOutput('<b>Loading...</b>'), 'Fetching Data');
    try {
        const payload = { command: 'populateBrurya' };
        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
            muteHttpExceptions: true
        };
        const apiResponse = UrlFetchApp.fetch(G.WEB_APP_URL, options);
        const result = JSON.parse(apiResponse.getContentText());
        if (result.status !== 'success') throw new Error(result.message);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
        if (!sheet) throw new Error(`Sheet "${G.SHEET_NAMES.BRURYA}" not found.`);
        
        ss.setActiveSheet(sheet);
        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent().setBackground(null);
        }
        const rows = result.data;
        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 4).setValues(rows);
        } else {
            sheet.getRange(2, 1).setValue("No items with Brurya quantity > 0 found in the Audit sheet.");
        }
        updateBruryaProtection();
        SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<b>Done!</b>'), 'Update Complete');
    } catch (err) {
        SpreadsheetApp.getUi().alert(`Could not populate Brurya sheet: ${err.message}`);
    }
}

function submitBruryaToAudit() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Submit Brurya Counts to Audit?', 'This action cannot be undone.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
        if (!sheet || sheet.getLastRow() < 2) {
            ui.alert('Nothing to submit.');
            return;
        }
        const dataToSubmit = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
        const payload = { command: 'submitBruryaWithCheck', data: dataToSubmit };
        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
            muteHttpExceptions: true
        };
        const apiResponse = UrlFetchApp.fetch(G.WEB_APP_URL, options);
        const result = JSON.parse(apiResponse.getContentText());
        ui.alert(result.message);
        if (result.submissionOccurred) {
            populateBruryaSheetFromAudit();
        }
    } catch (err) {
        ui.alert(`An error occurred: ${err.message}`);
    }
}

/**
 * Handles the onEdit trigger for the Brurya sheet to auto-populate new rows.
 * @param {object} e The event object from the onEdit trigger.
 */
function handleBruryaEdit(e) {
    if (!e || !e.value || !e.range) return;

    const sheet = e.range.getSheet();
    const row = e.range.getRow();
    const col = e.range.getColumn();
    const sku = e.value.toString().trim();

    // Trigger only when adding a new SKU in Column C
    if (sheet.getName() === G.SHEET_NAMES.BRURYA && row > 1 && col === 3 && sku !== '') {
        try {
            const payload = { command: 'getItemDetailsBySku', data: sku };
            const options = {
                method: 'post',
                contentType: 'application/json',
                payload: JSON.stringify(payload),
                headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
                muteHttpExceptions: true
            };
            const apiResponse = UrlFetchApp.fetch(G.WEB_APP_URL, options);
            const result = JSON.parse(apiResponse.getContentText());

            if (result.status === 'success' && result.data) {
                // Set ID in Column A and Name in Column B
                e.range.offset(0, -2).setValue(result.data.id);
                e.range.offset(0, -1).setValue(result.data.name);
            }
        } catch (err) {
            SpreadsheetApp.getActiveSpreadsheet().toast(`Could not find details for SKU ${sku}: ${err.message}`, "Error", 5);
        }
    }
}


// --- UI/LOCAL HELPER ---

function updateBruryaProtection() {
    const ENABLE_PROTECTION = true;
    if (!ENABLE_PROTECTION) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
    if (!sheet || sheet.getLastRow() < 2) return;
    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());
    const dataRangeHeight = sheet.getLastRow() - 1;
    sheet.getRange(2, 1, dataRangeHeight, 3).setBackground("#f3f3f3").protect().setWarningOnly(true);
}


// --- SERVER-SIDE WORKERS (Called by WebApp.gs) ---

function _server_populateBruryaSheet() {
    try {
        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const auditData = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, 6).getValues();
        const comaxData = comaxSheet.getRange(2, 1, comaxSheet.getLastRow() - 1, 3).getValues();
        const nameMap = new Map(comaxData.map(row => [row[0]?.toString().trim(), row[2]?.toString().trim()]).filter(([id]) => id));
        const rows = auditData.reduce((acc, row) => {
            const id = row[0]?.toString().trim();
            const sku = row[1]?.toString().trim();
            const qty = parseFloat(row[5]);
            const name = nameMap.get(id) || '';
            if (id && qty > 0) acc.push([id, name, sku, qty]);
            return acc;
        }, []);
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: rows })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

function _server_submitBruryaWithCheck(currentData) {
    try {
        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const auditData = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, auditSheet.getLastColumn()).getValues();
        const auditMap = new Map(auditData.map((row, index) => [row[0]?.toString().trim(), { rowData: row, index: index }]));
        let changesFound = false;
        const newRowsToAdd = [];

        currentData.forEach(currentRow => {
            const currentId = currentRow[0]?.toString().trim();
            if (!currentId) return; // Skip rows that might not have an ID yet
            const currentSku = currentRow[2];
            const currentQty = (currentRow[3] === '' || currentRow[3] === null) ? 0 : parseFloat(currentRow[3]);
            const existingEntry = auditMap.get(currentId);
            if (existingEntry) {
                const originalQty = parseFloat(existingEntry.rowData[5]) || 0;
                if (originalQty !== currentQty) {
                    auditData[existingEntry.index][5] = currentQty;
                    changesFound = true;
                }
            } else {
                changesFound = true;
                const newAuditRow = Array(auditSheet.getLastColumn()).fill('');
                newAuditRow[0] = currentId;
                newAuditRow[1] = currentSku;
                newAuditRow[2] = new Date();
                newAuditRow[5] = currentQty;
                newRowsToAdd.push(newAuditRow);
            }
        });

        if (!changesFound) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'No pending changes to submit.', submissionOccurred: false })).setMimeType(ContentService.MimeType.JSON);
        }

        if (auditData.length > 0) {
            auditSheet.getRange(2, 1, auditData.length, auditData[0].length).setValues(auditData);
        }
        if (newRowsToAdd.length > 0) {
            auditSheet.getRange(auditSheet.getLastRow() + 1, 1, newRowsToAdd.length, newRowsToAdd[0].length).setValues(newRowsToAdd);
        }
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Brurya submission complete.', submissionOccurred: true })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message, stack: err.stack })).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * Server-side worker to look up an item's details by its SKU.
 * @param {string} sku The SKU to look up in the ComaxM sheet.
 */
function _server_getItemDetailsBySku(sku) {
    try {
        if (!sku) throw new Error("SKU was not provided.");
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const data = comaxSheet.getDataRange().getValues();
        const skuCol = 1; // Column B
        const idCol = 0; // Column A
        const nameCol = 2; // Column C

        const foundRow = data.find(row => row[skuCol]?.toString().trim() === sku);

        if (foundRow) {
            const details = {
                id: foundRow[idCol],
                name: foundRow[nameCol]
            };
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: details })).setMimeType(ContentService.MimeType.JSON);
        } else {
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: null })).setMimeType(ContentService.MimeType.JSON);
        }
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
}