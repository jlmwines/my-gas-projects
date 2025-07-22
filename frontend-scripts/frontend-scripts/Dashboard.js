/**
 * @file Dashboard.gs — Core UI and State Controller (v2025-07-22)
 * @description Handles onOpen triggers, menu creation, and user selection.
 */

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
        .addSubMenu(ui.createMenu('Orders')
            .addItem('Display Orders', 'updatePackingDisplay')
            .addSeparator()
            .addItem('Select All', 'selectAllRows')
            .addItem('Clear All', 'clearAllRows')
            .addSeparator()
            .addItem('Create Print Batch', 'createPrintBatch'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Inventory')
            .addItem('Load Inventory Tasks', 'populateInventorySheetFromTasks')
            .addItem('Submit Inventory Counts', 'submitInventoryToAudit'))
        .addSeparator()
        .addSubMenu(ui.createMenu('Brurya')
            .addItem('Load Brurya Sheet', 'populateBruryaSheetFromAudit')
            .addItem('Submit Brurya Counts', 'submitBruryaToAudit'))
        .addToUi();

    populateUserDropdown();
}

function onEditInstallable(e) {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() === G.SHEET_NAMES.DASHBOARD && e.range.getA1Notation() === G.CELL_REFS.USER_DROPDOWN) {
        handleDashboardEdit(e);
    }
}

function handleDashboardEdit(e) {
    const selectedName = e.range.getValue()?.toString().trim();
    setActiveUser(selectedName);
    
    try {
        if (selectedName) {
            const refSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
            const usersSheet = refSS.getSheetByName(G.SHEET_NAMES.USERS);
            const data = usersSheet.getRange(2, 1, usersSheet.getLastRow(), G.COLUMN_INDICES.USERS.BRURYA_ACCESS + 1).getValues();
            const match = data.find(row => row[G.COLUMN_INDICES.USERS.NAME]?.toString().trim().toLowerCase() === selectedName.toLowerCase());
            const accessFlag = match ? match[G.COLUMN_INDICES.USERS.BRURYA_ACCESS]?.toString().trim().toLowerCase() : 'n';
            PropertiesService.getUserProperties().setProperty('bruryaAccess', accessFlag);
        } else {
            PropertiesService.getUserProperties().deleteProperty('bruryaAccess');
        }
    } catch (err) {
        console.error(`Could not set Brurya access: ${err.message}`);
    }
}

function populateUserDropdown() {
    try {
        const refSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const usersSheet = refSS.getSheetByName(G.SHEET_NAMES.USERS);
        if (!usersSheet) return;
        const names = usersSheet.getRange(2, G.COLUMN_INDICES.USERS.NAME + 1, usersSheet.getLastRow() - 1, 1).getValues().flat().map(name => name.toString().trim()).filter(name => name).sort();
        const dashboard = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.DASHBOARD);
        const cell = dashboard.getRange(G.CELL_REFS.USER_DROPDOWN);
        const rule = SpreadsheetApp.newDataValidation().requireValueInList(names, true).setAllowInvalid(false).build();
        cell.setDataValidation(rule);
    } catch (err) {
        console.error(`Could not populate user list: ${err.message}`);
    }
}

// --- Implemented functions for the Orders menu ---

/**
 * Selects all checkboxes in the 'PackingDisplay' sheet.
 */
function selectAllRows() {
    const ui = SpreadsheetApp.getUi();
    const displaySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
    if (!displaySheet) {
        ui.alert("Error: 'PackingDisplay' sheet not found.");
        return;
    }

    const lastRow = displaySheet.getLastRow();
    if (lastRow <= 1) { // Only header row or empty
        ui.alert("No orders to select.");
        return;
    }

    // Assuming checkbox is always in column A (index 1)
    const checkboxRange = displaySheet.getRange(2, 1, lastRow - 1, 1);
    checkboxRange.setValue(true);
    SpreadsheetApp.getActiveSpreadsheet().toast("All orders selected.", "", 2);
}

/**
 * Clears all checkboxes in the 'PackingDisplay' sheet.
 */
function clearAllRows() {
    const ui = SpreadsheetApp.getUi();
    const displaySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
    if (!displaySheet) {
        ui.alert("Error: 'PackingDisplay' sheet not found.");
        return;
    }

    const lastRow = displaySheet.getLastRow();
    if (lastRow <= 1) { // Only header row or empty
        ui.alert("No orders to clear.");
        return;
    }

    // Assuming checkbox is always in column A (index 1)
    const checkboxRange = displaySheet.getRange(2, 1, lastRow - 1, 1);
    checkboxRange.setValue(false);
    SpreadsheetApp.getActiveSpreadsheet().toast("All selections cleared.", "", 2);
}

/**
 * Calls the printSelectedDocuments function from updatePackingDisplay.gs.
 */
function createPrintBatch() {
    printSelectedDocuments();
}