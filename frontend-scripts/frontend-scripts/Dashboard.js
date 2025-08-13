/**
 * @file Dashboard.gs — Core UI and State Controller
 * @description Handles onOpen triggers, menu creation, and user selection.
 * @version 2025-07-27-1032
 */

// --- UI AND TRIGGER FUNCTIONS ---
function onOpenInstallable() {
    clearActiveUser();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dashboard = ss.getSheetByName(G.SHEET_NAMES.DASHBOARD);
    if (dashboard) {
        ss.setActiveSheet(dashboard);
        dashboard.getRange(G.CELL_REFS.USER_DROPDOWN).clearContent();
    }
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('JLM Wines')
        .addSubMenu(ui.createMenu('Packing Slips')
            .addItem('Refresh Display List', 'updatePackingDisplay')
            .addItem('Select All Rows', 'selectAllRows')
            .addItem('Clear All Rows', 'clearAllRows')
            .addSeparator()
            .addItem('Generate Docs for ALL in Queue', 'createConsolidatedPackingDocs')
            .addItem('Generate Docs for SELECTED', 'generateSelectedPackingDocs'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Inventory')
            .addItem('Load Inventory Tasks', 'populateInventorySheetFromTasks')
            .addItem('Submit Inventory Counts', 'submitInventoryToAudit'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Brurya')
            .addItem('Load Brurya Sheet', 'populateBruryaSheetFromAudit')
            .addItem('Submit Brurya Counts', 'submitBruryaToAudit'))
        .addSeparator()
        .addItem('Comax Refresh', 'syncComaxDirectory')
        .addToUi();
    populateUserDropdown();
}

function onEditInstallable(e) {
    if (!e || !e.range) return;

    const sheetName = e.range.getSheet().getName();

    // Route the edit event to the correct handler based on the sheet name
    if (sheetName === G.SHEET_NAMES.DASHBOARD && e.range.getA1Notation() === G.CELL_REFS.USER_DROPDOWN) {
        handleDashboardEdit(e);
    } else if (sheetName === G.SHEET_NAMES.BRURYA) {
        handleBruryaEdit(e); // This will now call the auto-populate handler
    }
}

function selectAllRows() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 1).setValue(true);
    }
}

function clearAllRows() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 1).setValue(false);
    }
}

// --- CLIENT-SIDE FUNCTIONS ---
function handleDashboardEdit(e) {
    const selectedName = e.range.getValue()?.toString().trim();
    setActiveUser(selectedName);
    try {
        const payload = { command: 'getBruryaAccess', data: selectedName };
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
        if (selectedName) {
            PropertiesService.getUserProperties().setProperty('bruryaAccess', result.data);
        } else {
            PropertiesService.getUserProperties().deleteProperty('bruryaAccess');
        }
    } catch (err) {
        SpreadsheetApp.getUi().alert(`Could not set user permissions: ${err.message}`);
    }
}

function populateUserDropdown() {
    try {
        const payload = { command: 'getUsers' };
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
        const names = result.data;
        if (names && names.length > 0) {
            const dashboard = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.DASHBOARD);
            const cell = dashboard.getRange(G.CELL_REFS.USER_DROPDOWN);
            const rule = SpreadsheetApp.newDataValidation().requireValueInList(names, true).setAllowInvalid(false).build();
            cell.setDataValidation(rule);
        }
    } catch (err) {
        SpreadsheetApp.getUi().alert(`Could not load user list: ${err.message}`);
    }
}

// --- SERVER-SIDE WORKERS ---
function _server_getUsers() {
    try {
        const usersSheet = getReferenceSheet(G.SHEET_NAMES.USERS);
        const names = usersSheet.getRange(2, G.COLUMN_INDICES.USERS.NAME + 1, usersSheet.getLastRow() - 1, 1).getValues()
            .flat().map(name => name.toString().trim()).filter(name => name).sort();
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: names })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

function _server_getBruryaAccess(userName) {
    try {
        let accessFlag = 'n';
        if (userName) {
            const usersSheet = getReferenceSheet(G.SHEET_NAMES.USERS);
            const data = usersSheet.getRange(2, 1, usersSheet.getLastRow(), G.COLUMN_INDICES.USERS.BRURYA_ACCESS + 1).getValues();
            const match = data.find(row => row[G.COLUMN_INDICES.USERS.NAME]?.toString().trim().toLowerCase() === userName.toLowerCase());
            accessFlag = match ? match[G.COLUMN_INDICES.USERS.BRURYA_ACCESS]?.toString().trim().toLowerCase() : 'n';
        }
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: accessFlag })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
}