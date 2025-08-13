/**
 * @file Inventory.gs — Grouped Inventory Task Controller
 * @description Manages the inventory counting workflow for tasks assigned in TaskQ.
 * @version 2025-07-27-1032
 */

// --- CONSTANTS ---
const INV_COL = { NAME: 1, ID: 2, SKU: 3, STOCK: 4, DIFF: 5, TOTAL: 6, BRURYA: 7, STORAGE: 8, OFFICE: 9, SHOP: 10 };

// --- CLIENT-SIDE FUNCTIONS ---
/**
 * Client-side function to populate the inventory sheet by calling the web app.
 */
function populateInventorySheetFromTasks() {
    const ui = SpreadsheetApp.getUi();
    const selectedUser = getActiveUser();
    if (!selectedUser) {
        ui.alert('Please select a user from the Dashboard first.');
        return;
    }

    ui.showModalDialog(HtmlService.createHtmlOutput('<b>Loading Tasks...</b>'), 'Fetching Data'); // <-- CORRECTED

    try {
        const payload = { command: 'populateInventory', data: selectedUser };
        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
            muteHttpExceptions: true
        };

        const apiResponse = UrlFetchApp.fetch(G.WEB_APP_URL, options);
        const result = JSON.parse(apiResponse.getContentText());

        if (result.status !== 'success') {
            throw new Error(result.message);
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(G.SHEET_NAMES.INVENTORY);
        if (!sheet) {
            throw new Error(`Sheet "${G.SHEET_NAMES.INVENTORY}" not found.`);
        }

        ss.setActiveSheet(sheet);
        sheet.clear();
        const oldPrintArea = ss.getRangeByName('Print_Area');
        if (oldPrintArea && oldPrintArea.getSheet().getName() === sheet.getName()) {
            ss.removeNamedRange('Print_Area');
        }

        sheet.getRange("A1:J1").setValues([
            ["Name", "ID", "SKU", "Stock", "Difference", "TotalQty", "BruryaQty", "StorageQty", "OfficeQty", "ShopQty"]
        ]).setFontWeight("bold");

        const rowsToWrite = result.data;

        if (rowsToWrite.length > 0) {
            const numRows = rowsToWrite.length;
            const numCols = rowsToWrite[0].length;
            
            sheet.getRange(2, 1, numRows, numCols).setValues(rowsToWrite);
            for (let i = 2; i < numRows + 2; i++) {
                sheet.getRange(i, INV_COL.TOTAL).setFormula(`=SUM(H${i}:J${i})`);
                sheet.getRange(i, INV_COL.DIFF).setFormula(`=F${i}-D${i}`);
            }

            for (let i = 0; i < numRows; i++) {
                if (i % 2 === 1) { 
                    sheet.getRange(i + 2, 1, 1, numCols).setBackground("#f3f3f3");
                }
            }
            sheet.getRange(2, INV_COL.STORAGE, numRows, 3).setBorder(true, true, true, true, true, true, '#666666', SpreadsheetApp.BorderStyle.SOLID);
            const printRange = sheet.getRange(1, 1, numRows + 1, numCols);
            ss.setNamedRange('Print_Area', printRange);
        } else {
            sheet.getRange("A2").setValue(result.message || "No open inventory tasks assigned to you.");
        }

        updateInventoryProtection();
        SpreadsheetApp.flush();
        ui.showModalDialog(HtmlService.createHtmlOutput('<b>Done!</b>'), 'Update Complete'); // <-- CORRECTED

    } catch (e) {
        ui.alert(`Failed to populate inventory sheet: ${e.message}`);
    }
}

/**
 * Client-side function to submit inventory counts by calling the web app.
 */
function submitInventoryToAudit() {
    const ui = SpreadsheetApp.getUi();
    const confirmation = ui.alert('Submit Inventory Counts?', 'This action cannot be undone.', ui.ButtonSet.YES_NO);
    if (confirmation !== ui.Button.YES) return;

    const activeUser = getActiveUser();
    if (!activeUser) {
        ui.alert("Cannot identify active user. Please re-select your name on the Dashboard.");
        return;
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const inventorySheet = ss.getSheetByName(G.SHEET_NAMES.INVENTORY);
        const inventoryData = inventorySheet.getRange(2, 1, inventorySheet.getLastRow() - 1, INV_COL.SHOP).getValues();

        // CORRECTED: Filter now only looks at user-editable quantity columns.
        const inventoryUpdates = inventoryData.map(row => ({
            sku: row[INV_COL.SKU - 1],
            brurya: row[INV_COL.BRURYA - 1], // Still sent, but not used for filtering
            storage: row[INV_COL.STORAGE - 1],
            office: row[INV_COL.OFFICE - 1],
            shop: row[INV_COL.SHOP - 1]
        })).filter(item => item.sku && (item.storage !== '' || item.office !== '' || item.shop !== ''));

        if (inventoryUpdates.length === 0) {
            ui.alert("No new quantities were entered in the Storage, Office, or Shop columns. Submission cancelled.");
            return;
        }

        const payload = {
            command: 'submitInventory',
            data: inventoryUpdates,
            user: activeUser
        };
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

        if (result.status === 'success') {
            populateInventorySheetFromTasks(); // Refresh the sheet
        }

    } catch (e) {
        ui.alert(`Submission Error: ${e.message}`);
    }
}

function updateInventoryProtection() {
    Logger.log("updateInventoryProtection called.");
}

// --- SERVER-SIDE WORKERS ---
function _server_populateInventory(selectedUser) {
    try {
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const taskqData = taskqSheet.getDataRange().getValues();
        const comaxData = comaxSheet.getDataRange().getValues();
        const auditData = auditSheet.getDataRange().getValues();
        const inventoryTasks = taskqData.filter(taskRow => {
            const assignedTo = taskRow[G.COLUMN_INDICES.TASKQ.ASSIGNED_TO - 1]?.toString().trim().toLowerCase();
            const status = taskRow[G.COLUMN_INDICES.TASKQ.STATUS - 1]?.toString().trim().toLowerCase();
            const type = taskRow[G.COLUMN_INDICES.TASKQ.TYPE - 1]?.toString().trim().toLowerCase();
            return (assignedTo === selectedUser.toLowerCase() && status === 'assigned' && type.startsWith('inventory'));
        });
        if (inventoryTasks.length === 0) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [], message: "No open inventory tasks assigned to you."})).setMimeType(ContentService.MimeType.JSON);
        }
        const requiredSkus = new Set(inventoryTasks.map(task => task[G.COLUMN_INDICES.TASKQ.RELATED_ENTITY - 1].toString().trim().toLowerCase()));
        const comaxMap = new Map(comaxData.slice(1).map(r => {
            const sku = r[1]?.toString().trim().toLowerCase();
            return sku ? [sku, { id: r[0], name: r[2], stock: r[15] || 0 }] : null;
        }).filter(Boolean));
        const auditMap = new Map(auditData.slice(1).map(r => {
            const sku = r[G.COLUMN_INDICES.AUDIT.SKU - 1]?.toString().trim().toLowerCase();
            return sku ? [sku, { brurya: r[G.COLUMN_INDICES.AUDIT.BRURYA_QTY - 1] || 0 }] : null;
        }).filter(Boolean));
        let rowsToWrite = Array.from(requiredSkus).map(sku => {
            const comaxProduct = comaxMap.get(sku);
            const auditInfo = auditMap.get(sku);
            return comaxProduct ? [comaxProduct.name, comaxProduct.id, sku, comaxProduct.stock, '', '', auditInfo?.brurya || 0, '', '', ''] : null;
        }).filter(Boolean);
        rowsToWrite.sort((a, b) => a[0].localeCompare(b[0]));
        if (rowsToWrite.length === 0) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [], message: "Tasks were found, but their products could not be located in ComaxM."})).setMimeType(ContentService.MimeType.JSON);
        }
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: rowsToWrite })).setMimeType(ContentService.MimeType.JSON);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

function _server_submitInventory(inventoryUpdates, activeUser) {
    try {
        if (!inventoryUpdates || inventoryUpdates.length === 0) throw new Error('No Inventory data was provided.');
        if (!activeUser) throw new Error('Active user was not specified.');
        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const submittedSkus = new Set(inventoryUpdates.map(item => item.sku.toString().toLowerCase()));
        const auditData = auditSheet.getDataRange().getValues();
        const auditSkuMap = new Map(auditData.slice(1).map((row, i) => [row[G.COLUMN_INDICES.AUDIT.SKU - 1].toString().toLowerCase(), i + 1]));
        inventoryUpdates.forEach(update => {
            const skuLower = update.sku.toString().toLowerCase();
            if (auditSkuMap.has(skuLower)) {
                const rowIndex = auditSkuMap.get(skuLower);
                const newTotalQty = (Number(update.brurya) || 0) + (Number(update.storage) || 0) + (Number(update.office) || 0) + (Number(update.shop) || 0);
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.BRURYA_QTY - 1] = Number(update.brurya) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.STORAGE_QTY - 1] = Number(update.storage) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.OFFICE_QTY - 1] = Number(update.office) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.SHOP_QTY - 1] = Number(update.shop) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.NEW_QTY - 1] = newTotalQty;
            }
        });
        auditSheet.getRange(1, 1, auditData.length, auditData[0].length).setValues(auditData);
        const taskqData = taskqSheet.getDataRange().getValues();
        let tasksUpdated = false;
        for (let i = 1; i < taskqData.length; i++) {
            const assignedTo = taskqData[i][G.COLUMN_INDICES.TASKQ.ASSIGNED_TO - 1]?.toString().toLowerCase();
            const relatedSku = taskqData[i][G.COLUMN_INDICES.TASKQ.RELATED_ENTITY - 1]?.toString().toLowerCase();
            const status = taskqData[i][G.COLUMN_INDICES.TASKQ.STATUS - 1]?.toString().toLowerCase();
            if (assignedTo === activeUser.toLowerCase() && status === 'assigned' && submittedSkus.has(relatedSku)) {
                taskqData[i][G.COLUMN_INDICES.TASKQ.STATUS - 1] = 'Review';
                tasksUpdated = true;
            }
        }
        if (tasksUpdated) {
            taskqSheet.getRange(1, 1, taskqData.length, taskqData[0].length).setValues(taskqData);
        }
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Inventory counts submitted for review.' })).setMimeType(ContentService.MimeType.JSON);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.message })).setMimeType(ContentService.MimeType.JSON);
    }
}