/**
 * @file Menu.gs
 * @description Creates the main menu, shows the sidebar, and includes a sub-menu for state management.
 * @version 25-08-10-0940
 */
function createMenuAndShowSidebar() {
    const ui = SpreadsheetApp.getUi();

    // Create the sub-menu for Backup/Restore
    const backupMenu = ui.createMenu('Backup')
        .addItem('Snapshot', 'createManualSnapshot')
        .addItem('Restore Snapshot', 'showAdvancedRestoreDialog');

    // Create the sub-menu for resetting the workflow state
    const resetMenu = ui.createMenu('Reset Workflow To...')
        .addItem('Start of Workflow', 'resetStateToStart')
        .addSeparator()
        .addItem('After Backup', 'resetStatePostBackup')
        .addItem('After Imports & Orders', 'resetStatePostImportsAndOrders')
        .addItem('After Review', 'resetStatePostReview')
        .addItem('After Finalize', 'resetStatePostFinalize');

    // Create the main menu and add all items and sub-menus
    ui.createMenu('JLM Wines')
        .addItem('Show Sidebar', 'showWorkflowSidebar')
        .addItem('Admin Sidebar', 'showAdminSidebar') // <-- NEW ITEM ADDED HERE
        .addSeparator()
        .addItem('Review Product Details', 'loadProductDetailReviews')
        .addItem('Approve Selected Details', 'processProductDetailApprovals')
        .addSeparator()
        .addSubMenu(backupMenu)
        .addSeparator()
        .addSubMenu(resetMenu)
        .addToUi();

    // Show the sidebar on open
    try {
        showWorkflowSidebar();
    } catch (err) {
        Logger.log('Could not open sidebar automatically: ' + err.message);
    }
}

/**
 * Opens the main workflow sidebar.
 */
function showWorkflowSidebar() {
    const html = HtmlService.createHtmlOutputFromFile('Sidebar')
        .setTitle('JLM Wines Workflow');
    SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Opens the new admin workflow sidebar.
 */
function showAdminSidebar() {
    const html = HtmlService.createHtmlOutputFromFile('AdminSidebar')
        .setTitle('Operations Hub');
    SpreadsheetApp.getUi().showSidebar(html);
}
