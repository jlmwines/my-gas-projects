/**
 * @file psSheetTest.gs
 * @description Creates packing slips and optional customer notes as separate PDFs from a Google Sheet template.
 * @version 25-07-22-1613
 */

/**
 * A test harness to simulate the full process of creating a packing slip and an optional note.
 */
function runFullProcess_TEST() {
    // --- Get Test Data ---
    const SHEET_PACKING_QUEUE = 'PackingQueue';
    const SHEET_PACKING_ROWS = 'PackingRows';
    const TEST_ORDER_ROW_IN_QUEUE = 2;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const packingQueueSheet = ss.getSheetByName(SHEET_PACKING_QUEUE);
    const packingRowsSheet = ss.getSheetByName(SHEET_PACKING_ROWS);

    if (!packingQueueSheet || !packingRowsSheet) {
        SpreadsheetApp.getUi().alert(`Error: Could not find ${SHEET_PACKING_QUEUE} or ${SHEET_PACKING_ROWS} sheet.`);
        return;
    }
    const orderQueueEntry = packingQueueSheet.getRange(TEST_ORDER_ROW_IN_QUEUE, 1, 1, packingQueueSheet.getLastColumn()).getValues()[0];
    const orderNumberForFilter = orderQueueEntry[0];
    const orderRowsEntries = packingRowsSheet.getDataRange().getValues().filter(row => row[0] === orderNumberForFilter);

    if (!orderQueueEntry || orderRowsEntries.length === 0) {
        SpreadsheetApp.getUi().alert(`Test Aborted: No data found for test.`);
        return;
    }

    // --- Run Process ---
    createPackingSlipPDF(orderQueueEntry, orderRowsEntries);
    createCustomerNotePDF(orderQueueEntry);
}


/**
 * Creates the main packing slip PDF from the 'DefaultTemplate' sheet.
 */
function createPackingSlipPDF(orderQueueEntry, orderRowsEntries) {
    const TEMPLATE_SPREADSHEET_ID = '1O78ecsvwG21YzwhB4-ujYY5yOgXIy8vW0qlaWK7wAVg';
    const TEMPLATE_SHEET_NAME = 'DefaultTemplate';
    const TABLE_START_ROW = 9;

    let tempSheet;
    try {
        const orderNumber = orderQueueEntry[0];
        const totalItemCount = orderRowsEntries.reduce((sum, item) => sum + (Number(item[3]) || 0), 0);

        const templateSpreadsheet = SpreadsheetApp.openById(TEMPLATE_SPREADSHEET_ID);
        const templateSheet = templateSpreadsheet.getSheetByName(TEMPLATE_SHEET_NAME);
        const tempSheetName = `SLIP_${orderNumber}_${new Date().getTime()}`;
        tempSheet = templateSheet.copyTo(templateSpreadsheet).setName(tempSheetName);

        // Populate Placeholders
        tempSheet.createTextFinder('{{ORDER_NUMBER}}').replaceAllWith(orderNumber || '');
        tempSheet.createTextFinder('{{ORDER_DATE}}').replaceAllWith(Utilities.formatDate(new Date(orderQueueEntry[1]), Session.getScriptTimeZone(), "yyyy-MM-dd") || '');
        tempSheet.createTextFinder('{{SHIPPING_NAME}}').replaceAllWith(orderQueueEntry[2] || '');
        tempSheet.createTextFinder('{{SHIPPING_ADDRESS}}').replaceAllWith(orderQueueEntry[5] || '');
        tempSheet.createTextFinder('{{SHIPPING_PHONE}}').replaceAllWith(orderQueueEntry[3] || '');

        // Prepare and Write Product Table Data
        const productData = [];
        orderRowsEntries.forEach(itemRow => {
            const englishDetails = [itemRow[5] || '', [itemRow[6] ? `Intensity (1-5): ${itemRow[6]}` : null, itemRow[7] ? `Complexity (1-5): ${itemRow[7]}` : null, itemRow[8] ? `Acidity (1-5): ${itemRow[8]}` : null].filter(p => p).join(', '), itemRow[10] ? `Harmonize with ${String(itemRow[10]).trim()} flavors` : '', itemRow[11] ? `Contrast with ${String(itemRow[11]).trim()} flavors` : '', itemRow[9] ? `Recommended decanting – ${itemRow[9]} minutes.` : ''].filter(line => line && line.trim()).join('\n');
            const hebrewDetails = [itemRow[13] || '', [itemRow[6] ? `עוצמה (1-5): ${itemRow[6]}` : null, itemRow[7] ? `מורכבות (1-5): ${itemRow[7]}` : null, itemRow[8] ? `חומציות (1-5): ${itemRow[8]}` : null].filter(p => p).join(', '), itemRow[14] ? `הרמוניה עם: טעמי ${String(itemRow[14]).trim()}` : '', itemRow[15] ? `קונטרסט עם: טעמי ${String(itemRow[15]).trim()}` : '', itemRow[9] ? `מומלץ לאוורור - ${itemRow[9]} דקות` : ''].filter(line => line && line.trim()).join('\n');
            productData.push([itemRow[4] || '', itemRow[3]?.toString() || '1', itemRow[12] || '']);
            productData.push([englishDetails, '', hebrewDetails]);
        });
        if (productData.length > 0) {
            tempSheet.getRange(TABLE_START_ROW, 1, productData.length, productData[0].length).setValues(productData);
            for (let i = 0; i < productData.length; i += 2) {
                tempSheet.getRange(TABLE_START_ROW + i, 1, 1, tempSheet.getLastColumn()).setFontWeight('bold');
            }
        }

        // Add Totals Row
        const tableEndRow = (TABLE_START_ROW - 1) + productData.length;
        tempSheet.getRange(tableEndRow + 2, 1, 1, 3).setValues([['Total', totalItemCount, 'סה"כ']]);

        // Final Cleanup and PDF Generation
        const lastRowWithContent = tempSheet.getLastRow();
        const maxRows = tempSheet.getMaxRows();
        if (maxRows > lastRowWithContent) {
            tempSheet.deleteRows(lastRowWithContent + 1, maxRows - lastRowWithContent);
        }
        SpreadsheetApp.flush();

        const outputFolder = DriveApp.getFolderById(activeConfig.packingSlipFolderId);
        const pdfFileName = `PackingSlip_${orderNumber}.pdf`;
        const url = `https://docs.google.com/spreadsheets/d/${TEMPLATE_SPREADSHEET_ID}/export?gid=${tempSheet.getSheetId()}&format=pdf&portrait=true&fitw=true&sheetnames=false&printtitle=false&gridlines=false`;
        const response = UrlFetchApp.fetch(url, { headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() } });
        const pdfFile = outputFolder.createFile(response.getBlob()).setName(pdfFileName);
        Logger.log(`Created Packing Slip: ${pdfFile.getName()}`);
        return pdfFile.getId(); // THIS LINE SHOULD NOW SUCCEED

    } catch (e) {
        Logger.log(`Error in createPackingSlipPDF: ${e.toString()}\n${e.stack}`);
        throw e; // Re-throw the error
    } finally {
        // --- CLEANUP DISABLED FOR TESTING ---
        // if (tempSheet) {
        //     SpreadsheetApp.openById(TEMPLATE_SPREADSHEET_ID).deleteSheet(tempSheet);
        // }
    }
}

/**
 * Creates a separate customer note PDF from the 'MessageDefault' sheet, if a note exists.
 */
function createCustomerNotePDF(orderQueueEntry) {
    const customerNote = orderQueueEntry[6];
    if (!customerNote || String(customerNote).trim() === '') {
        return;
    }

    const TEMPLATE_SPREADSHEET_ID = '1O78ecsvwG21YzwhB4-ujYY5yOgXIy8vW0qlaWK7wAVg';
    const TEMPLATE_SHEET_NAME = 'MessageDefault';
    
    let tempSheet;
    try {
        const orderNumber = orderQueueEntry[0];
        const templateSpreadsheet = SpreadsheetApp.openById(TEMPLATE_SPREADSHEET_ID);
        const templateSheet = templateSpreadsheet.getSheetByName(TEMPLATE_SHEET_NAME);
        const tempSheetName = `NOTE_${orderNumber}_${new Date().getTime()}`;
        tempSheet = templateSheet.copyTo(templateSpreadsheet).setName(tempSheetName);

        // Populate Placeholders
        tempSheet.createTextFinder('{{ORDER_NUMBER}}').replaceAllWith(orderNumber || '');
        tempSheet.createTextFinder('{{ORDER_DATE}}').replaceAllWith(Utilities.formatDate(new Date(orderQueueEntry[1]), Session.getScriptTimeZone(), "yyyy-MM-dd") || '');
        tempSheet.createTextFinder('{{SHIPPING_NAME}}').replaceAllWith(orderQueueEntry[2] || '');
        tempSheet.createTextFinder('{{SHIPPING_ADDRESS}}').replaceAllWith(orderQueueEntry[5] || '');
        tempSheet.createTextFinder('{{SHIPPING_PHONE}}').replaceAllWith(orderQueueEntry[3] || '');
        tempSheet.createTextFinder('{{CUSTOMER_NOTE}}').replaceAllWith(customerNote);

        // Final Cleanup and PDF Generation
        const lastRowWithContent = tempSheet.getLastRow();
        const maxRows = tempSheet.getMaxRows();
        if (maxRows > lastRowWithContent) {
            tempSheet.deleteRows(lastRowWithContent + 1, maxRows - lastRowWithContent);
        }
        SpreadsheetApp.flush();

        const outputFolder = DriveApp.getFolderById(activeConfig.packingSlipFolderId);
        const pdfFileName = `CustomerNote_${orderNumber}.pdf`;
        const url = `https://docs.google.com/spreadsheets/d/${TEMPLATE_SPREADSHEET_ID}/export?gid=${tempSheet.getSheetId()}&format=pdf&portrait=true&fitw=true&sheetnames=false&printtitle=false&gridlines=false`;
        const response = UrlFetchApp.fetch(url, { headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() } });
        const pdfFile = outputFolder.createFile(response.getBlob()).setName(pdfFileName);
        Logger.log(`Created Customer Note: ${pdfFile.getName()}`);
        return pdfFile.getId(); // THIS LINE SHOULD NOW SUCCEED

    } catch (e) {
        Logger.log(`Error in createCustomerNotePDF: ${e.toString()}\n${e.stack}`);
        throw e; // Re-throw the error
    } finally {
        // --- CLEANUP DISABLED FOR TESTING ---
        // if (tempSheet) {
        //     SpreadsheetApp.openById(TEMPLATE_SPREADSHEET_ID).deleteSheet(tempSheet);
        // }
    }
}