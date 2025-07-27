/**
 * @file Dashboard.gs — Core UI and State Controller
 * @description Handles onOpen triggers, menu creation, and user selection.
 * @version 2025-07-24-0731
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
      const match = data.find(row =>
        row[G.COLUMN_INDICES.USERS.NAME]?.toString().trim().toLowerCase() === selectedName.toLowerCase());
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
    const names = usersSheet
      .getRange(2, G.COLUMN_INDICES.USERS.NAME + 1, usersSheet.getLastRow() - 1, 1)
      .getValues()
      .flat()
      .map(name => name.toString().trim())
      .filter(name => name)
      .sort();
    const dashboard = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.DASHBOARD);
    const cell = dashboard.getRange(G.CELL_REFS.USER_DROPDOWN);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(names, true)
      .setAllowInvalid(false)
      .build();
    cell.setDataValidation(rule);
  } catch (err) {
    console.error(`Could not populate user list: ${err.message}`);
  }
}

function selectAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const range = sheet.getRange(2, 1, lastRow - 1, 1);
    range.setValue(true);
  }
}

function clearAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const range = sheet.getRange(2, 1, lastRow - 1, 1);
    range.setValue(false);
  }
}
