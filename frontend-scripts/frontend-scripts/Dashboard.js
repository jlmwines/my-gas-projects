/**
 * Dashboard.gs — Core UI and State Controller (v2025-07-16)
 * Change: Simplified to only handle user selection. All dashboard
 * rendering has been disabled to ensure stability.
 */

function onOpenInstallable() {
    clearActiveUser();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dashboard = ss.getSheetByName(G.SHEET_NAMES.DASHBOARD);
    if (dashboard) {
        ss.setActiveSheet(dashboard);
        dashboard.getRange(G.CELL_REFS.USER_DROPDOWN).clearContent();
    }
    
    SpreadsheetApp.getUi().createMenu('JLM Wines')
        .addSubMenu(SpreadsheetApp.getUi().createMenu('Inventory')
            .addItem('Load Inventory Tasks', 'populateInventorySheetFromTasks')
            .addItem('Submit Inventory Counts', 'submitInventoryToAudit'))
        .addSeparator()
        .addSubMenu(SpreadsheetApp.getUi().createMenu('Brurya')
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
    // This function now ONLY sets the active user in the Config sheet.
    const selectedName = e.range.getValue()?.toString().trim();
    setActiveUser(selectedName);
    
    // Also update Brurya access rights in the background
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
        // Fail silently on open to avoid disruptive errors for user.
        console.error(`Could not populate user list: ${err.message}`);
    }
}