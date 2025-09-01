/**
 * @file Brurya.gs — Sheet Controller
 * @description Manages the Brurya counting workflow using a client/server model.
 * @version 2025-07-30-1645 // Final stable version
 */

// --- TRIGGERS & HELPERS ---

function handleBruryaEdit(e) {
    // This lock prevents this onEdit trigger from running during a script-led data load.
    const lock = PropertiesService.getScriptProperties().getProperty('BRURYA_EDIT_LOCK');
    if (lock) return;

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
                e.range.offset(0, -2).setValue(result.data.id);
                e.range.offset(0, -1).setValue(result.data.name);
            }
        } catch (err) {
            SpreadsheetApp.getActiveSpreadsheet().toast(`Could not find details for SKU ${sku}: ${err.message}`, "Error", 5);
        }
    }
}

/**
 * Reads data from the Brurya sheet for submission.
 */
function getBruryaSheetData() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.BRURYA);
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
}

/**
 * Writes data to the Brurya sheet.
 */
function writeBruryaDataToSheet(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
    if (!sheet) throw new Error(`Sheet "${G.SHEET_NAMES.BRURYA}" not found.`);

    ss.setActiveSheet(sheet);

    // --- FIX: Clear all previous data and formatting below the header ---
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent().setBackground(null);
    }
    // --- END FIX ---
 
    if (data && data.length > 0) {
        sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    } else {
        sheet.getRange(2, 1).setValue("No items with Brurya quantity > 0 found.");
    }
    updateBruryaProtection();
    SpreadsheetApp.flush();
}
function updateBruryaProtection() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
    if (!sheet) return;

    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());

    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        const rangeToProtect = sheet.getRange(2, 1, lastRow - 1, 3); // Columns A, B, C
        rangeToProtect.protect().setWarningOnly(true);
        rangeToProtect.setBackground("#e0e0e0"); // Add this line for light gray background
    }
}

// --- SERVER-SIDE WORKERS ---

function _server_populateBruryaSheet() {
    const lock = PropertiesService.getScriptProperties();
    lock.setProperty('BRURYA_EDIT_LOCK', 'true');

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

        writeBruryaDataToSheet(rows);

        return { status: 'success', message: `${rows.length} Brurya items loaded.` };
    } catch (err) {
        return { status: 'error', message: err.message };
    } finally {
        lock.deleteProperty('BRURYA_EDIT_LOCK');
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
            if (!currentId) return;
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
            return { status: 'success', message: 'No pending changes to submit.', submissionOccurred: false };
        }

        if (auditData.length > 0) {
            auditSheet.getRange(2, 1, auditData.length, auditData[0].length).setValues(auditData);
        }
        if (newRowsToAdd.length > 0) {
            auditSheet.getRange(auditSheet.getLastRow() + 1, 1, newRowsToAdd.length, newRowsToAdd[0].length).setValues(newRowsToAdd);
        }
        return { status: 'success', message: 'DEBUG_TEST_OK', submissionOccurred: true };
    } catch (err) {
        return { status: 'error', message: err.message, stack: err.stack };
    }
}

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
            return { status: 'success', data: details };
        } else {
            return { status: 'success', data: null };
        }
    } catch (err) {
        return { status: 'error', message: err.message };
    }
}