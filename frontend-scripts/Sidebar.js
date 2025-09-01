/**
 * @file Sidebar.gs
 * @description Functions to open and manage the HTML sidebar. This file now contains UI-related helpers.
 * @version 2025-07-29-1730 // Updated version number
 * @environment Frontend
 */

/**
 * Opens the custom HTML sidebar for the user tasks.
 */
function openTaskPanelSidebar() {
    const htmlOutput = HtmlService.createHtmlOutputFromFile('Display')
        .setTitle('JLManage')
        .setWidth(300);
    SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

/**
 * Server-side function to get the list of users for the sidebar.
 */
function getUsersForSidebar() {
    try {
        const usersSheet = getReferenceSheet(G.SHEET_NAMES.USERS);
        const names = usersSheet
            .getRange(2, G.COLUMN_INDICES.USERS.NAME + 1, usersSheet.getLastRow() - 1, 1)
            .getValues()
            .flat()
            .map(name => name.toString().trim())
            .filter(name => name)
            .sort();
        return names;
    } catch (err) {
        Logger.log(`Error in getUsersForSidebar: ${err.message}`);
        throw new Error(`Failed to load users: ${err.message}`);
    }
}

// --- SERVER-SIDE DELEGATOR FUNCTIONS (Called by client, delegate to worker scripts) ---

function loadInventoryTasksServer(selectedFilterUser) {
    return server_populateInventory(selectedFilterUser); // CORRECTED: Calls public function
}

// In Sidebar.gs
function submitInventoryCountsServer(data, selectedFilterUser) {
    // The 'selectedFilterUser' parameter is received but no longer passed along.
    return server_submitInventory(data); // NEW
}

function loadBruryaSheetServer() {
    return _server_populateBruryaSheet();
}

function submitBruryaCountsServer(data) {
    return _server_submitBruryaWithCheck(data);
}

function submitBruryaCountsViaUrlFetchServer(dataToSubmit) {
    try {
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
        return result; // Return the parsed result from doPost
    } catch (err) {
        return { status: 'error', message: `UrlFetch Error: ${err.message}` };
    }
}

// --- DATA READ/WRITE FUNCTIONS (Called by client) ---

/**
 * Writes data to the Inventory sheet and applies formatting/protections.
 */
function writeInventoryDataToSheet(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(G.SHEET_NAMES.INVENTORY);
    if (!sheet) throw new Error(`Sheet "${G.SHEET_NAMES.INVENTORY}" not found.`);

    ss.setActiveSheet(sheet);
    sheet.clear();
    
    const headers = ["Name", "ID", "SKU", "Stock", "Difference", "TotalQty", "BruryaQty", "StorageQty", "OfficeQty", "ShopQty"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

    if (data && data.length > 0) {
        const numRows = data.length;
        const numCols = headers.length;
        
        sheet.getRange(2, 1, numRows, data[0].length).setValues(data); // Use data's actual width
        for (let i = 2; i < numRows + 2; i++) {
            sheet.getRange(i, G.INV_COL.TOTAL).setFormula(`=SUM(H${i}:J${i})`);
            sheet.getRange(i, G.INV_COL.DIFF).setFormula(`=F${i}-D${i}`);
        }
    } else {
        sheet.getRange("A2").setValue("No inventory tasks to display.");
    }

    updateInventoryProtection(); // This function is now in this file
    SpreadsheetApp.flush();
}

/**
 * Reads data from the Inventory sheet for submission.
 */
function getInventorySheetData() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.INVENTORY);
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, G.INV_COL.SHOP).getValues();
}

// --- HELPER FUNCTIONS MOVED HERE TO FIX SCOPE ---

function updateInventoryProtection() {
    // This function can be expanded later to apply sheet protections.
    Logger.log("updateInventoryProtection called from Sidebar.gs.");
}

/**
 * Checks for a property flag indicating a modal task was completed.
 * This is used by the client-side poller to trigger a UI refresh.
 * @returns {boolean} True if the flag was present.
 */
function _server_checkModalStatus() {
    const userProperties = PropertiesService.getUserProperties();
    const flag = userProperties.getProperty('modalTaskComplete');
    if (flag) {
        userProperties.deleteProperty('modalTaskComplete'); // Consume the flag
        return true;
    }
    return false;
}

/**
 * Displays a native Google Sheets confirmation dialog with Yes/No buttons.
 * @param {string} prompt The question to ask the user.
 * @returns {string} The button clicked by the user, as a string ('YES' or 'NO').
 */
function _server_showConfirmationDialog(prompt) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(prompt, ui.ButtonSet.YES_NO);
  return response.toString();
}

// --- NEW DELEGATOR FUNCTIONS for the new sidebar ---

function getOpenOrderCount() {
    return _server_getOpenOrderCount();
}

function getProductCountTasks() {
    return _server_getProductCountTasks();
}

function getComaxData() {
    return _server_getComaxData();
}

function getStockHealthNeeds() {
    return _server_getStockHealthNeeds();
}

function populateAndFilterNewProducts(filter) {
    return _server_populateAndFilterNewProducts(filter);
}

function populateOptionalWines() {
    return _server_populateOptionalWines();
}

function populateOtherProducts() {
    return _server_populateOtherProducts();
}

function createNewProductTasks() {
    return _sidebar_createNewProductTasks();
}

/**
 * Quickly gets the count of open "Update Product Details" tasks from TaskQ.
 * Used to initialize the sidebar.
 */
function _server_getProductDetailTaskCount() {
    try {
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const data = taskqSheet.getDataRange().getValues();
        const headers = data.shift();
        
        const typeCol = headers.indexOf('Type');
        const statusCol = headers.indexOf('Status');

        if (typeCol === -1 || statusCol === -1) {
            throw new Error("Required columns ('Type', 'Status') not found in TaskQ sheet.");
        }

        // Filter for tasks of the correct type and status.
        const openTasks = data.filter(row => 
            String(row[typeCol]).trim() === 'Product Exception C6' && 
            String(row[statusCol]).trim().toLowerCase() === 'assigned'
        );

        return { status: 'success', data: { count: openTasks.length } };

    } catch (e) {
        Logger.log(`_server_getProductDetailTaskCount Error: ${e.message}`);
        return { status: 'error', message: e.message, data: { count: 0 } };
    }
}

/**
 * Quickly gets the count of open "New Product" tasks from TaskQ.
 * Used to initialize the sidebar.
 */
function _server_getNewProductTaskCount() {
    try {
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const data = taskqSheet.getDataRange().getValues();
        const headers = data.shift();
        
        const typeCol = headers.indexOf('Type');
        const statusCol = headers.indexOf('Status');

        if (typeCol === -1 || statusCol === -1) {
            throw new Error("Required columns ('Type', 'Status') not found in TaskQ sheet.");
        }

        // Filter for tasks of the correct type and status.
        const openTasks = data.filter(row => 
            String(row[typeCol]).trim() === 'New Product' && 
            String(row[statusCol]).trim().toLowerCase() === 'assigned'
        );

        return { status: 'success', data: { count: openTasks.length } };

    } catch (e) {
        Logger.log(`_server_getNewProductTaskCount Error: ${e.message}`);
        return { status: 'error', message: e.message, data: { count: 0 } };
    }
}

// --- DELEGATOR FUNCTIONS ---

function getNewProductTaskCount() {
    return _server_getNewProductTaskCount();
}

function getProductDetailTaskCount() {
    return _server_getProductDetailTaskCount();
}

function getNewProductTasks(user) {
    return _server_getNewProductTasks(user);
}

function getProductDetailTasks(user) {
    // This assumes the worker function is named _server_getProductDetailTasks
    return _server_getProductDetailTasks(user);
}

function getSkuFromActiveCell() {
    // This assumes the worker function is named _server_getSkuFromActiveCell
    return _server_getSkuFromActiveCell();
}