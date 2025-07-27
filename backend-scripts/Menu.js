/**
 * @file Menu.gs
 * @description Creates the main menu, shows the sidebar, and includes a sub-menu for state management.
 * @version 25-07-16-1521
 */
function createMenuAndShowSidebar() {
    const ui = SpreadsheetApp.getUi();

    // Create the sub-menu for the new Inventory Review workflow
    const reviewMenu = ui.createMenu('Inventory Review')
        .addItem('1. Load Inventory for Review', 'populateReviewSheet')
        .addSeparator()
        .addItem('2. Mark All as Accepted', 'markAllAsAccepted')
        .addItem('3. Update & Export Reviewed Items', 'processAndExportReviewedInventory');

    // Create the sub-menu for resetting the workflow state
    const resetMenu = ui.createMenu('Reset Workflow To...')
        .addItem('Start of Workflow', 'resetStateToStart')
        .addSeparator()
        .addItem('After Backup', 'resetStatePostBackup')
        .addItem('After Imports & Orders', 'resetStatePostImportsAndOrders')
        .addItem('After Review', 'resetStatePostReview')
        .addItem('After Finalize', 'resetStatePostFinalize');

    // Create the main menu and add all sub-menus
    ui.createMenu('VinSync')
        .addItem('Show Workflow Sidebar', 'showWorkflowSidebar')
        .addSeparator()
        .addSubMenu(reviewMenu) // Add the new Inventory Review sub-menu
        .addSeparator()
        .addItem('Run Finalize Now', 'finalizeProductData')
        .addSeparator()
        .addItem('Export Inventory to CSV', 'exportInventoryAdjustments')
        .addItem('Audit Low Inventory', 'AuditLowProducts')
        .addSeparator()
        .addSubMenu(resetMenu) // Add the reset sub-menu
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
        .setTitle('VinSync Workflow');
    SpreadsheetApp.getUi().showSidebar(html);
}