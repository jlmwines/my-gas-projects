/**
 * Inventory.gs — Grouped Inventory Task Controller (v2025-07-18.2)
 *
 * Manages the inventory counting workflow for tasks assigned in TaskQ.
 * Submission logic is based on the presence of data, not edit monitoring.
 */

// --- CONSTANTS ---
const INV_COL = {
    NAME: 1, ID: 2, SKU: 3, STOCK: 4, DIFF: 5, TOTAL: 6,
    BRURYA: 7, STORAGE: 8, OFFICE: 9, SHOP: 10
};
const EDITABLE_INV_COLS = [INV_COL.STORAGE, INV_COL.OFFICE, INV_COL.SHOP];

// --- DATA POPULATION ---

function populateInventorySheetFromTasks() {
    const ui = SpreadsheetApp.getUi();
    const selectedUser = getActiveUser(); // Assumes getActiveUser() exists elsewhere
    if (!selectedUser) {
        ui.alert('Please select a user from the Dashboard first.');
        return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(G.SHEET_NAMES.INVENTORY); // Assumes G.SHEET_NAMES.INVENTORY exists
    if (!sheet) {
        ui.alert(`Sheet "${G.SHEET_NAMES.INVENTORY}" not found.`);
        return;
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
            sheet.getRange("A2").setValue("No open inventory tasks assigned to you.");
            updateInventoryProtection();
            return;
        }

        const requiredSkus = new Set(inventoryTasks.map(task => task[G.COLUMN_INDICES.TASKQ.RELATED_ENTITY - 1].toString().trim().toLowerCase()));

        const comaxMap = new Map(comaxData.slice(1).map(r => {
            const sku = r[1]?.toString().trim().toLowerCase();
            if (sku) return [sku, { id: r[0], name: r[2], stock: r[15] || 0 }];
            return null;
        }).filter(Boolean));
        
        const auditMap = new Map(auditData.slice(1).map(r => {
            const sku = r[G.COLUMN_INDICES.AUDIT.SKU - 1]?.toString().trim().toLowerCase();
            if (sku) return [sku, { brurya: r[G.COLUMN_INDICES.AUDIT.BRURYA_QTY - 1] || 0 }];
            return null;
        }).filter(Boolean));

        let rowsToWrite = Array.from(requiredSkus).map(sku => {
            const comaxProduct = comaxMap.get(sku);
            const auditInfo = auditMap.get(sku);
            if (!comaxProduct) return null;
            return [
                comaxProduct.name, comaxProduct.id, sku, comaxProduct.stock,
                '', '', auditInfo?.brurya || 0, '', '', ''
            ];
        }).filter(Boolean);

        rowsToWrite.sort((a, b) => a[0].localeCompare(b[0]));

        if (rowsToWrite.length > 0) {
            const numRows = rowsToWrite.length;
            const numCols = rowsToWrite[0].length;
            
            sheet.getRange(2, 1, numRows, numCols).setValues(rowsToWrite);
            for (let i = 2; i < numRows + 2; i++) {
                sheet.getRange(i, INV_COL.TOTAL).setFormula(`=SUM(G${i}:J${i})`);
                sheet.getRange(i, INV_COL.DIFF).setFormula(`=F${i}-D${i}`);
            }

            for (let i = 0; i < numRows; i++) {
                if (i % 2 === 1) { 
                    sheet.getRange(i + 2, 1, 1, numCols).setBackground("#f3f3f3");
                }
            }
            const editableRange = sheet.getRange(2, INV_COL.STORAGE, numRows, 3);
            editableRange.setBorder(true, true, true, true, true, true, '#666666', SpreadsheetApp.BorderStyle.SOLID);
            const printRange = sheet.getRange(1, 1, numRows + 1, numCols);
            ss.setNamedRange('Print_Area', printRange);

        } else {
            sheet.getRange("A2").setValue("Tasks were found, but their products could not be located in ComaxM.");
        }

        updateInventoryProtection();
        SpreadsheetApp.flush();

    } catch (e) {
        ui.alert(`Failed to populate inventory sheet: ${e.message}\n${e.stack}`);
    }
}

/**
 * Placeholder for a function that might manage sheet protections.
 */
function updateInventoryProtection() {
    Logger.log("updateInventoryProtection called.");
}


// --- SUBMISSION LOGIC ---

function submitInventoryToAudit() {
    const ui = SpreadsheetApp.getUi();

    const confirmation = ui.alert('Submit Inventory Counts?', 'Are you sure you want to submit these counts? This action cannot be undone.', ui.ButtonSet.YES_NO);
    if (confirmation !== ui.Button.YES) {
        ui.alert('Submission cancelled.');
        return;
    }

    const activeUser = getActiveUser();
    if (!activeUser) {
        ui.alert("Cannot identify active user. Please re-select your name on the Dashboard.");
        return;
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const inventorySheet = ss.getSheetByName(G.SHEET_NAMES.INVENTORY);
        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);

        const AUDIT_COLS = G.COLUMN_INDICES.AUDIT;
        const TQ_COLS = G.COLUMN_INDICES.TASKQ;

        const inventoryData = inventorySheet.getRange(2, 1, inventorySheet.getLastRow() - 1, INV_COL.SHOP).getValues();

        // **UPDATED LOGIC**: Map now includes BruryaQty, and filter checks all four quantity columns.
        const inventoryUpdates = inventoryData.map(row => ({
            sku: row[INV_COL.SKU - 1],
            brurya: row[INV_COL.BRURYA - 1],
            storage: row[INV_COL.STORAGE - 1],
            office: row[INV_COL.OFFICE - 1],
            shop: row[INV_COL.SHOP - 1]
        })).filter(item => item.sku && (item.brurya !== '' || item.storage !== '' || item.office !== '' || item.shop !== ''));

        if (inventoryUpdates.length === 0) {
            ui.alert("No new quantities were entered. Submission cancelled.");
            return;
        }

        const submittedSkus = new Set(inventoryUpdates.map(item => item.sku.toString().toLowerCase()));

        const auditData = auditSheet.getDataRange().getValues();
        const auditSkuMap = new Map(auditData.slice(1).map((row, i) => [row[AUDIT_COLS.SKU - 1].toString().toLowerCase(), i + 1]));

        inventoryUpdates.forEach(update => {
            const skuLower = update.sku.toString().toLowerCase();
            if (auditSkuMap.has(skuLower)) {
                const rowIndex = auditSkuMap.get(skuLower);
                
                // **UPDATED LOGIC**: Coerce blank values to 0 for calculation and writing.
                const bruryaQty = Number(update.brurya) || 0;
                const storageQty = Number(update.storage) || 0;
                const officeQty = Number(update.office) || 0;
                const shopQty = Number(update.shop) || 0;

                // **NEW**: Calculate the total new quantity.
                const newTotalQty = bruryaQty + storageQty + officeQty + shopQty;

                // Update all individual location counts AND the total NewQty in the Audit sheet data array.
                auditData[rowIndex][AUDIT_COLS.BRURYA_QTY - 1] = bruryaQty;
                auditData[rowIndex][AUDIT_COLS.STORAGE_QTY - 1] = storageQty;
                auditData[rowIndex][AUDIT_COLS.OFFICE_QTY - 1] = officeQty;
                auditData[rowIndex][AUDIT_COLS.SHOP_QTY - 1] = shopQty;
                auditData[rowIndex][AUDIT_COLS.NEW_QTY - 1] = newTotalQty; // Write the new total.
            }
        });
        auditSheet.getRange(1, 1, auditData.length, auditData[0].length).setValues(auditData);

        // Update TaskQ Sheet
        const taskqData = taskqSheet.getDataRange().getValues();
        let tasksUpdated = false;
        for (let i = 1; i < taskqData.length; i++) {
            const assignedTo = taskqData[i][TQ_COLS.ASSIGNED_TO - 1]?.toString().toLowerCase();
            const relatedSku = taskqData[i][TQ_COLS.RELATED_ENTITY - 1]?.toString().toLowerCase();
            const status = taskqData[i][TQ_COLS.STATUS - 1]?.toString().toLowerCase();

            if (assignedTo === activeUser.toLowerCase() && status === 'assigned' && submittedSkus.has(relatedSku)) {
                taskqData[i][TQ_COLS.STATUS - 1] = 'Review';
                tasksUpdated = true;
            }
        }

        if (tasksUpdated) {
            taskqSheet.getRange(1, 1, taskqData.length, taskqData[0].length).setValues(taskqData);
        }

        // Finalize and Cleanup
        populateInventorySheetFromTasks();

        ui.alert('Success', "Inventory counts have been submitted for review.");

    } catch (e) {
        ui.alert('Submission Error', `An error occurred: ${e.message}\n${e.stack}`);
    }
}