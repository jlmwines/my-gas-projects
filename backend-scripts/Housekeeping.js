/**
 * @file Housekeeping.gs
 * @description Manages scheduled maintenance tasks, starting with archiving old records from OrderLog.
 * @version 25-07-25-1200
 * @environment Backend
 */

// Define the threshold for archiving: records older than this many days will be moved.
const ARCHIVE_THRESHOLD_DAYS = 60;

/**
 * Archives old records from the OrderLog sheet to OrderLogArchive.
 * Records are considered old if their 'packing_print_date' is older than ARCHIVE_THRESHOLD_DAYS.
 * This function is intended to be run on a time-driven trigger.
 */
function archiveOldOrderLogRecords() {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const orderLog_sheet = referenceSS.getSheetByName(SHEET_ORDER_LOG);
    const orderLogArchive_sheet = referenceSS.getSheetByName(SHEET_ORDER_LOG_ARCHIVE);
    const configSheet = referenceSS.getSheetByName(SHEET_REFERENCE_CONFIG);

    if (!orderLog_sheet || !orderLogArchive_sheet || !configSheet) {
        Logger.log("Housekeeping Error: One or more required sheets (OrderLog, OrderLogArchive, Config) not found.");
        return; // Exit if sheets are missing
    }

    // Get headers from OrderLog for consistent column mapping
    const orderLog_headers_range = orderLog_sheet.getRange(1, 1, 1, orderLog_sheet.getLastColumn());
    const orderLog_headers = orderLog_headers_range.getValues()[0].map(h => String(h).trim().replace(/^\ufeff/, ''));

    const logOrderIdCol = orderLog_headers.indexOf(HEADERS.ORDER_ID);
    const logPrintedDateCol = orderLog_headers.indexOf("packing_print_date"); // Using string literal as per your sheet's header

    if (logOrderIdCol === -1 || logPrintedDateCol === -1) {
        Logger.log("Housekeeping Error: Required headers 'order_id' or 'packing_print_date' not found in OrderLog.");
        return;
    }

    let orderLog_data = [];
    if (orderLog_sheet.getLastRow() > 1) {
        orderLog_data = orderLog_sheet.getRange(2, 1, orderLog_sheet.getLastRow() - 1, orderLog_headers.length).getValues();
    } else {
        Logger.log("OrderLog is empty or only contains headers. No records to archive.");
        setReferenceSetting(SETTING_LAST_HOUSEKEEPING_RUN, new Date()); // Update timestamp even if nothing to archive
        return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_THRESHOLD_DAYS); // Calculate the date X days ago

    const rowsToArchive = [];
    const rowsToKeep = [];

    orderLog_data.forEach(row => {
        const printDate = row[logPrintedDateCol];
        // Check if printDate is a valid Date object and older than cutoffDate
        if (printDate instanceof Date && printDate < cutoffDate) {
            rowsToArchive.push(row);
        } else {
            rowsToKeep.push(row);
        }
    });

    if (rowsToArchive.length === 0) {
        Logger.log("No old records found in OrderLog to archive.");
        setReferenceSetting(SETTING_LAST_HOUSEKEEPING_RUN, new Date()); // Update timestamp even if nothing to archive
        return;
    }

    // --- Archive Records ---
    // Ensure archive sheet has headers if it's empty
    if (orderLogArchive_sheet.getLastRow() === 0) {
        orderLogArchive_sheet.appendRow(orderLog_headers);
    }
    // Append archived rows to the archive sheet
    orderLogArchive_sheet.getRange(orderLogArchive_sheet.getLastRow() + 1, 1, rowsToArchive.length, rowsToArchive[0].length).setValues(rowsToArchive);
    Logger.log(`Archived ${rowsToArchive.length} records to OrderLogArchive.`);

    // --- Update Original OrderLog ---
    // Clear existing data (excluding headers)
    orderLog_sheet.getRange(2, 1, orderLog_sheet.getLastRow() - 1, orderLog_headers.length).clearContent();
    // Write back only the rows to keep
    if (rowsToKeep.length > 0) {
        orderLog_sheet.getRange(2, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }
    Logger.log(`Updated OrderLog with ${rowsToKeep.length} active records.`);

    // Record the completion timestamp in the Reference Config sheet
    setReferenceSetting(SETTING_LAST_HOUSEKEEPING_RUN, new Date());
    Logger.log("OrderLog archiving completed successfully.");
}

/**
 * Sets a specific setting value in the Reference Config sheet.
 * This is a helper function for the backend to communicate state.
 * (Copied here for self-containment, but can be removed if in a shared utility file)
 * @param {string} settingName - The name of the setting to set.
 * @param {any} value - The value to set.
 */
function setReferenceSetting(settingName, value) {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    let configSheet = referenceSS.getSheetByName(SHEET_REFERENCE_CONFIG);
    if (!configSheet) {
        configSheet = referenceSS.insertSheet(SHEET_REFERENCE_CONFIG);
        configSheet.getRange(1, 1, 1, 3).setValues([["Setting", "Value", "Notes"]]);
    }
    
    const data = configSheet.getDataRange().getValues();
    const headers = data[0];
    const settingCol = headers.indexOf("Setting");
    const valueCol = headers.indexOf("Value");

    if (settingCol === -1 || valueCol === -1) {
        throw new Error("The Config sheet headers are incorrect. Expected 'Setting' and 'Value'.");
    }

    let found = false;
    for (let i = 1; i < data.length; i++) {
        if (data[i][settingCol] === settingName) {
            configSheet.getRange(i + 1, valueCol + 1).setValue(value);
            found = true;
            break;
        }
    }

    if (!found) {
        configSheet.appendRow([settingName, value, ""]);
    }
}