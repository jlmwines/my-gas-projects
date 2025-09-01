/**
 * @file Utilities.gs
 * @description Handles onOpen/onEdit installable triggers and general sheet utilities.
 * @version 2025-07-28-1115 // Updated version number for this correction
 */

// --- UI AND TRIGGER FUNCTIONS ---
/**
 * Installable onOpen trigger to automatically open the custom HTML sidebar,
 * create a menu item for manual reopening, and switch to the Dashboard sheet.
 */
function onOpenInstallable() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();

    // 1. Create the custom menu first.
    ui.createMenu('JLM Wines')
        .addItem('Open Dashboard', 'openDashboardSidebar')
        .addItem('Open Sidebar', 'openTaskPanelSidebar')
        .addToUi();

    // 2. Start opening the sidebar. This is the slow operation.
    openDashboardSidebar();

    // 3. Activate the Home sheet LAST to ensure it has focus.
    const homeSheet = ss.getSheetByName('Home');
    if (homeSheet) {
        homeSheet.activate();
    }
}

/**
 * Handles all spreadsheet edit events and routes them to the correct function
 * based on the sheet that was edited.
 * @param {object} e The event object passed by the onEdit trigger.
 */
function handleEdit(e) { // RENAMED
  // Exit if the event object is not valid (e.g., no range information)
  if (!e || !e.range) {
    return;
  }

  const sheetName = e.range.getSheet().getName();

  // --- onEdit Router ---
  // This checks the name of the edited sheet and calls the appropriate function.
  switch (sheetName) {
    case G.SHEET_NAMES.BRURYA:
      handleBruryaEdit(e);
      break;

    default:
      // If the edited sheet is not in the list above, do nothing.
      return;
  }
}
function forceReAuth() {
  // This function just triggers a permissions check.
  DriveApp.getFiles();
}
/**
 * Opens the new Dashboard sidebar.
 */
function openDashboardSidebar() {
    const htmlOutput = HtmlService.createHtmlOutputFromFile('Dashboard.html')
        .setTitle('Dashboard');
    SpreadsheetApp.getUi().showSidebar(htmlOutput);
}