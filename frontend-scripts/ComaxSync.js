/**
 * @file ComaxSync.gs
 * @description Server-side logic for getting filtered Comax data and writing to a sheet.
 * @version 2025-08-11-1001 // Added report enhancements (filters, columns, freeze, activate).
 */

/**
 * Server-side worker to get filtered Comax data, write it to a sheet, and return status.
 * @returns {object} A JavaScript object with status and a message.
 */
function _server_getComaxData() {
    try {
        const refSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const data = refSheet.getDataRange().getValues();

        const CMX_SKU_COL = 1;      // Col B in a 0-indexed array
        const CMX_NAME_COL = 2;     // Col C in a 0-indexed array
        const CMX_ARCHIVE_COL = 12; // Col M in a 0-indexed array

        const rows = data.slice(1)
            .filter(row => {
                // Filter out archived items (where archive column is not blank)
                return String(row[CMX_ARCHIVE_COL] || '').trim() === '';
            })
            .map(row => {
                // Map to an array of [Name, SKU]
                return [String(row[CMX_NAME_COL] || '').trim(), String(row[CMX_SKU_COL] || '').trim()];
            })
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

        // Write the data to a sheet in the active spreadsheet
        const sheetName = 'ComaxSyncDisplay';
        const headers = ["Name", "SKU"];
        _writeReportToSheet(sheetName, headers, rows, { rtl: true, activate: true });

        // Return a success message WITHOUT the large data array
        return { status: 'success', message: `${rows.length} Comax items synced.` };

    } catch (err) {
        Logger.log(`[ERROR] _server_getComaxData caught error: ${err.message} Stack: ${err.stack}`);
        return { status: 'error', message: err.message };
    }
}

/**
 * Server-side worker to get "Vintage Check" data and write it to a sheet.
 * Filters for active wine products sold online.
 * @returns {object} A JavaScript object with status and a message.
 */
function _server_getVintageCheckData() {
    try {
        const refSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const data = refSheet.getDataRange().getValues();

        // Column indices (0-based) from ComaxM sheet
        const CMX_SKU_COL = 1;      // Col B
        const CMX_NAME_COL = 2;     // Col C
        const CMX_DIV_COL = 3;      // Col D
        const CMX_YEAR_COL = 10;    // Col K
        const CMX_ARCHIVE_COL = 12; // Col M
        const CMX_WEB_COL = 16;     // Col Q
        const CMX_EXCLUDED_COL = 17;// Col R

        const rows = data.slice(1) // Skip header row
            .filter(row => {
                const isWine = String(row[CMX_DIV_COL] || '').trim() === '1';
                const isNotArchived = String(row[CMX_ARCHIVE_COL] || '').trim() === '';
                const isWeb = String(row[CMX_WEB_COL] || '').trim() === 'כן';
                const isNotExcluded = String(row[CMX_EXCLUDED_COL] || '').trim() === '';
                return isWine && isNotArchived && isWeb && isNotExcluded;
            })
            .map(row => {
                // Map to an array of [SKU, Name, Year]
                const sku = String(row[CMX_SKU_COL] || '').trim();
                const name = String(row[CMX_NAME_COL] || '').trim();
                const year = String(row[CMX_YEAR_COL] || '').trim();
                return [sku, name, year];
            })
            .sort((a, b) => {
                // Sort by Name (index 1 in the mapped array)
                return String(a[1]).localeCompare(String(b[1]));
            });

        // Write the data to the dedicated sheet
        const sheetName = 'VintageCheckDisplay';
        const headers = ["SKU", "Name", "Year"];
        _writeReportToSheet(sheetName, headers, rows, { rtl: true, activate: true });

        return { status: 'success', message: `${rows.length} items found for Vintage Check.` };

    } catch (err) {
        Logger.log(`[ERROR] _server_getVintageCheckData caught error: ${err.message} Stack: ${err.stack}`);
        return { status: 'error', message: err.message };
    }
}

/**
 * Server-side worker to get "Wines to Add" data and write it to a sheet.
 * Filters for active wine products NOT sold online with stock > 11 and price >= 35.
 * @returns {object} A JavaScript object with status and a message.
 */
function _server_getWinesToAddData() {
    try {
        const refSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const data = refSheet.getDataRange().getValues();

        // Column indices (0-based) from ComaxM sheet
        const CMX_SKU_COL = 1;      // Col B
        const CMX_NAME_COL = 2;     // Col C
        const CMX_DIV_COL = 3;      // Col D
        const CMX_YEAR_COL = 10;    // Col K
        const CMX_ARCHIVE_COL = 12; // Col M
        const CMX_PRICE_COL = 14;   // Col O
        const CMX_STOCK_COL = 15;   // Col P
        const CMX_WEB_COL = 16;     // Col Q

        const rows = data.slice(1) // Skip header row
            .filter(row => {
                const isWine = String(row[CMX_DIV_COL] || '').trim() === '1';
                const isNotArchived = String(row[CMX_ARCHIVE_COL] || '').trim() === '';
                const isNotWeb = String(row[CMX_WEB_COL] || '').trim() === 'לא';
                const hasStock = (Number(row[CMX_STOCK_COL]) || 0) > 11;
                const hasMinPrice = (Number(row[CMX_PRICE_COL]) || 0) >= 35;
                return isWine && isNotArchived && isNotWeb && hasStock && hasMinPrice;
            })
            .map(row => {
                // Map to an array of [SKU, Name, Year, Price]
                const sku = String(row[CMX_SKU_COL] || '').trim();
                const name = String(row[CMX_NAME_COL] || '').trim();
                const year = String(row[CMX_YEAR_COL] || '').trim();
                const price = Number(row[CMX_PRICE_COL]) || 0;
                return [sku, name, year, price];
            })
            .sort((a, b) => {
                // Sort by Price (index 3 in the mapped array), ascending
                return a[3] - b[3];
            });

        // Write the data to the dedicated sheet
        const sheetName = 'WinesToAddDisplay';
        const headers = ["SKU", "Name", "Year", "Price"];
        _writeReportToSheet(sheetName, headers, rows, { rtl: true, activate: true });

        return { status: 'success', message: `${rows.length} wines found to add.` };

    } catch (err) {
        Logger.log(`[ERROR] _server_getWinesToAddData caught error: ${err.message} Stack: ${err.stack}`);
        return { status: 'error', message: err.message };
    }
}


/**
 * Generic helper function to write report data to a dedicated sheet.
 * @param {string} sheetName The name of the sheet to write to.
 * @param {Array<string>} headers The header row.
 * @param {Array<Array<any>>} data The rows of data to write.
 * @param {object} [options={}] Optional settings. e.g., { rtl: false, activate: false }
 */
function _writeReportToSheet(sheetName, headers, data, options = {}) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    }

    // Apply options
    if (options.rtl) {
        sheet.setRightToLeft(true);
    } else {
        sheet.setRightToLeft(false);
    }

    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1); // Freeze the header row

    if (data && data.length > 0) {
        sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
        sheet.autoResizeColumns(1, headers.length);
    } else {
        sheet.getRange(2, 1).setValue("No matching items found.");
    }

    if (options.activate) {
        sheet.activate();
    }
    
    SpreadsheetApp.flush();
}
