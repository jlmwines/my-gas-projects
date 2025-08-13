/**
 * @file InventoryReview.gs
 * @description Backend script to populate the review sheet and process accepted/rejected inventory counts.
 * @version 25-07-16-1518
 */

// --- LOCAL CONSTANTS FOR TESTING ---
// In production, these would typically be in a global configuration file.
const C_SHEETS = {
    REVIEW: 'Inventory Review',
    TASKQ: 'TaskQ',
    AUDIT: 'Audit',
    COMAX_M: 'ComaxM'
};

const C_COLS = {
    REVIEW: { ID: 1, NAME: 2, SKU: 3, COMAX_QTY: 4, NEW_QTY: 5, BRURYA: 6, STORAGE: 7, OFFICE: 8, SHOP: 9, ACCEPT: 10, NOTES: 11 },
    TASKQ: { TYPE: 3, RELATED_ENTITY: 6, STATUS: 7, DONE_DATE: 12, NOTES: 13 },
    AUDIT: { SKU: 2, LAST_COUNT: 3, COMAX_QTY: 4, NEW_QTY: 5 },
    COMAX_M: { ID: 1, SKU: 2, NAME: 3, STOCK: 16 }
};


// --- 1. POPULATE REVIEW SHEET ---

/**
 * Creates or retrieves the inventory review sheet.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The review sheet object.
 */
function getOrCreateReviewSheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(C_SHEETS.REVIEW);

    if (!sheet) {
        sheet = ss.insertSheet(C_SHEETS.REVIEW);
        const headers = ["ID", "Name", "SKU", "ComaxQty", "NewQty", "BruryaQty", "StorageQty", "OfficeQty", "ShopQty", "Accept", "Notes"];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.setFrozenColumns(2); // Freeze Name and SKU
    }
    return sheet;
}

/**
 * Populates the Inventory Review sheet with items from TaskQ that need verification.
 */
function populateReviewSheet() {
    const ui = SpreadsheetApp.getUi();
    try {
        const reviewSheet = getOrCreateReviewSheet_();
        reviewSheet.getRange(2, 1, reviewSheet.getMaxRows() - 1, reviewSheet.getMaxColumns()).clearContent().clearDataValidations();

        const taskqSheet = getReferenceSheet_(C_SHEETS.TASKQ);
        const auditSheet = getReferenceSheet_(C_SHEETS.AUDIT);
        const comaxSheet = getReferenceSheet_(C_SHEETS.COMAX_M);

        const taskqData = taskqSheet.getDataRange().getValues();
        const auditData = auditSheet.getDataRange().getValues();
        const comaxData = comaxSheet.getDataRange().getValues();
        
        const auditMap = new Map(auditData.slice(1).map(r => [r[C_COLS.AUDIT.SKU - 1], r]));
        const comaxMap = new Map(comaxData.slice(1).map(r => [r[C_COLS.COMAX_M.SKU - 1], r]));

        const reviewTasks = taskqData.filter(row => row[C_COLS.TASKQ.STATUS - 1] === 'Review' && row[C_COLS.TASKQ.TYPE - 1] === 'Inventory Count');

        if (reviewTasks.length === 0) {
          reviewSheet.getRange("A2").setValue("No items are currently awaiting review.");
          SpreadsheetApp.setActiveSheet(reviewSheet);
          ui.alert('No items are currently awaiting review.');
          return;
      }

        const rowsToWrite = reviewTasks.map(taskRow => {
            const sku = taskRow[C_COLS.TASKQ.RELATED_ENTITY - 1];
            const notes = taskRow[C_COLS.TASKQ.NOTES - 1];
            const comaxRow = comaxMap.get(sku);
            const auditRow = auditMap.get(sku);
            if (!comaxRow || !auditRow) return null;

            return [
                comaxRow[C_COLS.COMAX_M.ID - 1], comaxRow[C_COLS.COMAX_M.NAME - 1], sku,
                auditRow[C_COLS.AUDIT.COMAX_QTY - 1], auditRow[C_COLS.AUDIT.NEW_QTY - 1],
                auditRow[5], auditRow[6], auditRow[7], auditRow[8], // Brurya, Storage, Office, Shop
                'Pending', notes
            ];
        }).filter(Boolean);

        if (rowsToWrite.length > 0) {
            reviewSheet.getRange(2, 1, rowsToWrite.length, rowsToWrite[0].length).setValues(rowsToWrite);
            const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Accepted', 'Rejected', 'Pending'], true).build();
            reviewSheet.getRange(2, C_COLS.REVIEW.ACCEPT, rowsToWrite.length).setDataValidation(rule);
        }
        
        SpreadsheetApp.setActiveSheet(reviewSheet);
        ui.alert('Inventory Review sheet is ready.');

    } catch (e) {
        ui.alert(`Failed to build the review sheet: ${e.message}`);
    }
}

// --- 2. ACCEPT ALL UTILITY ---

/**
 * Marks all items on the Inventory Review sheet as 'Accepted'.
 */
function markAllAsAccepted() {
    const ui = SpreadsheetApp.getUi();
    const reviewSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(C_SHEETS.REVIEW);
    if (!reviewSheet || reviewSheet.getLastRow() < 2) {
        ui.alert('Review sheet is not open or has no items.');
        return;
    }
    const range = reviewSheet.getRange(2, C_COLS.REVIEW.ACCEPT, reviewSheet.getLastRow() - 1, 1);
    const values = range.getValues();
    for (let i = 0; i < values.length; i++) {
        values[i][0] = 'Accepted';
    }
    range.setValues(values);
    ui.alert('All items have been marked as "Accepted".');
}


// --- 3. PROCESS AND EXPORT ---

/**
 * Processes accepted items, updates related sheets, and creates a CSV export.
 */
function processAndExportReviewedInventory() {
    const ui = SpreadsheetApp.getUi();
    const confirmation = ui.alert('Update & Export?', 'This will process all "Accepted" items, update records, and create an export file. This action cannot be undone.', ui.ButtonSet.YES_NO);
    if (confirmation !== ui.Button.YES) return;

    try {
        const reviewSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(C_SHEETS.REVIEW);
        if (!reviewSheet) throw new Error("Inventory Review sheet not found.");

        const reviewData = reviewSheet.getDataRange().getValues();
        const acceptedItems = reviewData.slice(1).filter(r => r[C_COLS.REVIEW.ACCEPT - 1] === 'Accepted');

        if (acceptedItems.length === 0) {
            ui.alert('No items were marked as "Accepted". Nothing to process.');
            return;
        }

        const taskqSheet = getReferenceSheet_(C_SHEETS.TASKQ);
        const auditSheet = getReferenceSheet_(C_SHEETS.AUDIT);
        const taskqData = taskqSheet.getDataRange().getValues();
        const auditData = auditSheet.getDataRange().getValues();

        const acceptedSkus = new Set(acceptedItems.map(item => item[C_COLS.REVIEW.SKU - 1]));
        const csvData = [['sku', 'quantity']];
        const today = new Date();
        
        acceptedItems.forEach(item => csvData.push([item[C_COLS.REVIEW.SKU - 1], item[C_COLS.REVIEW.NEW_QTY - 1]]));

        // Batch update Audit sheet
        for (let i = 1; i < auditData.length; i++) {
            if (acceptedSkus.has(auditData[i][C_COLS.AUDIT.SKU - 1])) {
                auditData[i][C_COLS.AUDIT.LAST_COUNT - 1] = today;
            }
        }
        auditSheet.getRange(1, 1, auditData.length, auditData[0].length).setValues(auditData);

        // Batch update TaskQ sheet
        for (let i = 1; i < taskqData.length; i++) {
            if (taskqData[i][C_COLS.TASKQ.STATUS - 1] === 'Review' && acceptedSkus.has(taskqData[i][C_COLS.TASKQ.RELATED_ENTITY - 1])) {
                taskqData[i][C_COLS.TASKQ.STATUS - 1] = 'Closed';
                taskqData[i][C_COLS.TASKQ.DONE_DATE - 1] = today;
            }
        }
        taskqSheet.getRange(1, 1, taskqData.length, taskqData[0].length).setValues(taskqData);

        // Create CSV export file
        const timestamp = Utilities.formatDate(today, "GMT+3", "MM-dd-HH-mm");
        const fileName = `CMXADJ-${timestamp}.csv`;
        const csvContent = csvData.map(r => r.join(',')).join('\n');
        const exportFolder = DriveApp.getFolderById(activeConfig.comaxExportFolderId);
        exportFolder.createFile(fileName, csvContent, MimeType.CSV);

        // Cleanup and report
        const rangeToClear = reviewSheet.getRange(2, 1, reviewSheet.getMaxRows() - 1, reviewSheet.getMaxColumns());
        rangeToClear.clearContent().clearDataValidations();
        reviewSheet.getRange("A2").setValue("Processed items have been cleared.");
        
        ui.alert('Processing Complete', `${acceptedItems.length} items were accepted and exported.\nThe export file "${fileName}" has been created.`, ui.ButtonSet.OK);

    } catch (e) {
        ui.alert(`Processing Failed: ${e.message}`);
    }
}


// --- HELPER FUNCTIONS ---

/**
 * Gets a sheet from the reference spreadsheet by its name.
 * Uses the activeConfig from Globals.gs.
 * @param {string} name The name of the sheet to retrieve.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The requested sheet object.
 */
function getReferenceSheet_(name) {
    const refSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const sheet = refSS.getSheetByName(name);
if (!sheet) throw new Error(`Reference sheet "${name}" not found.`);
    return sheet;
}