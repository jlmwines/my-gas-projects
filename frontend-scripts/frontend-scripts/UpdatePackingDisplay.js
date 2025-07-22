/**
 * @file updatePackingDisplay.gs
 * @description Displays orders marked 'Created', adds a checkbox column, and provides links to the generated PDF documents.
 * @version 2025-07-22-1649
 */

function updatePackingDisplay() {
    const frontendSS = SpreadsheetApp.getActiveSpreadsheet();
    const displaySheet = frontendSS.getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY) || frontendSS.insertSheet(G.SHEET_NAMES.PACKING_DISPLAY);

    const ordersM_sheet = getReferenceSheet("OrdersM");
    const orderLog_sheet = getReferenceSheet("OrderLog");

    if (!ordersM_sheet || !orderLog_sheet) {
        SpreadsheetApp.getUi().alert("Error: Could not find OrdersM or OrderLog sheets in the Reference file.");
        return;
    }

    const ordersData = ordersM_sheet.getDataRange().getValues();
    const headers = ordersData.shift();

    const orderLogData = orderLog_sheet.getDataRange().getValues();
    const logHeaders = orderLogData.shift().map(h => String(h).trim().replace(/\uFEFF/g, ''));

    const logOrderIdIndex = logHeaders.indexOf("order_id");
    const logStatusIndex = logHeaders.indexOf("packing_slip_status");
    const logSlipIdIndex = logHeaders.indexOf("packing_slip_doc_id");
    const logNoteIdIndex = logHeaders.indexOf("customer_note_doc_id");

    const createdOrdersMap = new Map();
    orderLogData.forEach(row => {
        const orderId = String(row[logOrderIdIndex]).trim();
        const statusText = String(row[logStatusIndex] || "").trim().toLowerCase();
        if (orderId && statusText === "created") {
            createdOrdersMap.set(orderId, {
                slipId: row[logSlipIdIndex] || null,
                noteId: row[logNoteIdIndex] || null
            });
        }
    });

    const outputHeaders = [
        "Select", "Order Date", "Order Number", "Order Status", "Packing Slip", "Customer Note",
        "Shipping City", "Shipping Name", "Shipping Address 1", "Shipping Address 2",
        "Shipping Phone", "Customer Note Text"
    ];
    const outputRows = [outputHeaders];

    const indices = {
        orderId: headers.indexOf("order_id"),
        orderDate: headers.indexOf("order_date"),
        orderNumber: headers.indexOf("order_number"),
        status: headers.indexOf("status"),
        shippingCity: headers.indexOf("shipping_city"),
        firstName: headers.indexOf("shipping_first_name"),
        lastName: headers.indexOf("shipping_last_name"),
        address1: headers.indexOf("shipping_address_1"),
        address2: headers.indexOf("shipping_address_2"),
        billingPhone: headers.indexOf("billing_phone"),
        customerNote: headers.indexOf("customer_note")
    };

    ordersData.forEach(row => {
        const orderId = String(row[indices.orderId]).trim();
        if (!createdOrdersMap.has(orderId)) return;

        const docInfo = createdOrdersMap.get(orderId);
        const slipLink = docInfo.slipId ? `=HYPERLINK("https://docs.google.com/open?id=${docInfo.slipId}", "Open Slip")` : '';
        const noteLink = docInfo.noteId ? `=HYPERLINK("https://docs.google.com/open?id=${docInfo.noteId}", "Open Note")` : '';
        const shippingName = `${row[indices.firstName]} ${row[indices.lastName]}`.trim();

        const outputRow = [
            false, // Value for checkbox
            row[indices.orderDate],
            row[indices.orderNumber],
            row[indices.status],
            slipLink,
            noteLink,
            row[indices.shippingCity],
            shippingName,
            row[indices.address1],
            row[indices.address2],
            row[indices.billingPhone],
            row[indices.customerNote]
        ];
        outputRows.push(outputRow);
    });

    displaySheet.clear();
    displaySheet.getRange(1, 1, outputRows.length, outputHeaders.length).setValues(outputRows);

    if (outputRows.length > 1) { // Only add validation if there are data rows
        const checkboxRange = displaySheet.getRange(2, 1, outputRows.length - 1, 1);
        checkboxRange.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    }
    
    displaySheet.autoResizeColumns(2, 11); // Auto-resize all columns except the checkbox
    displaySheet.setColumnWidth(1, 35); // Set a fixed width for the checkbox column
    
    displaySheet.activate(); // Set the focus to this sheet
    SpreadsheetApp.getActiveSpreadsheet().toast("PackingDisplay updated.", "Ready to Print", 3);
}

/**
 * Initiates the process to print selected documents from the PackingDisplay sheet.
 * This function will gather the document IDs of selected packing slips and customer notes,
 * create shortcuts to these documents in the predetermined folder, and then log the folder ID.
 */
function printSelectedDocuments() {
    const ui = SpreadsheetApp.getUi();
    const displaySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
    if (!displaySheet) {
        ui.alert("Error: 'PackingDisplay' sheet not found.");
        return;
    }

    const dataRange = displaySheet.getDataRange();
    // Get formulas to correctly parse the HYPERLINK function
    const formulas = dataRange.getFormulas(); 
    const values = dataRange.getValues(); // Still need values for the checkbox column

    const headers = values[0]; // Headers are the same for values and formulas
    const dataRowsValues = values.slice(1);
    const dataRowsFormulas = formulas.slice(1);

    const selectColIndex = headers.indexOf("Select");
    const packingSlipColIndex = headers.indexOf("Packing Slip");
    const customerNoteColIndex = headers.indexOf("Customer Note");

    if (selectColIndex === -1 || packingSlipColIndex === -1 || customerNoteColIndex === -1) {
        ui.alert("Error: Required columns ('Select', 'Packing Slip', 'Customer Note') not found.");
        return;
    }

    const selectedDocIds = [];
    dataRowsValues.forEach((rowValues, index) => {
        const rowFormulas = dataRowsFormulas[index];

        const checkboxRawValue = rowValues[selectColIndex];
        // The previous debug logs can be removed now, as the core issue has been identified.
        // Logger.log(`[DEBUG] Raw checkbox value: ${checkboxRawValue}, Type: ${typeof checkboxRawValue}`); 
        // Logger.log(`[DEBUG] Boolean conversion result: ${Boolean(checkboxRawValue)}`); 

        if (Boolean(checkboxRawValue)) { 
            // Logger.log(`[DEBUG] Checkbox IS selected for row data: ${JSON.stringify(rowValues)}`); 
            
            // Get the formula for the link cells
            const packingSlipFormula = rowFormulas[packingSlipColIndex];
            const customerNoteFormula = rowFormulas[customerNoteColIndex];

            // Logger.log(`[DEBUG] Raw Packing Slip Formula: ${packingSlipFormula}, Type: ${typeof packingSlipFormula}`); 
            // Logger.log(`[DEBUG] Raw Customer Note Formula: ${customerNoteFormula}, Type: ${typeof customerNoteFormula}`); 

            const packingSlipId = extractFileIdFromHyperlink(packingSlipFormula);
            const customerNoteId = extractFileIdFromHyperlink(customerNoteFormula);
            
            // Logger.log(`[DEBUG] Extracted Packing Slip ID: ${packingSlipId}`); 
            // Logger.log(`[DEBUG] Extracted Customer Note ID: ${customerNoteId}`); 

            if (packingSlipId) selectedDocIds.push(packingSlipId);
            if (customerNoteId) selectedDocIds.push(customerNoteId);
        } else {
            // Logger.log(`[DEBUG] Checkbox is NOT selected for row data (value was falsy): ${JSON.stringify(rowValues)}`); 
        }
    });

    if (selectedDocIds.length === 0) {
        ui.alert("No documents selected for printing. Please check the 'Select' checkboxes.");
        return;
    }

    const printFolderId = G.FILE_IDS.PRINT_FOLDER; // Use the predetermined folder ID from Globals.gs
    let printFolderUrl = '';

    try {
        const printFolder = DriveApp.getFolderById(printFolderId);
        printFolderUrl = printFolder.getUrl(); // Get the URL of the print folder
        const logSheet = getReferenceSheet("OrderLog"); // Assuming OrderLog is used for general logging
        
        selectedDocIds.forEach(docId => {
            try {
                const file = DriveApp.getFileById(docId);
                printFolder.addFile(file); // Adds a shortcut to the file in the folder
                logToSheet(logSheet, `Added shortcut for document ID: ${docId} to print folder: ${printFolder.getName()} (${printFolderId})`);
            } catch (e) {
                logToSheet(logSheet, `ERROR: Could not add shortcut for document ID: ${docId}. Reason: ${e.message}`);
            }
        });

        // Use a modal dialog to provide the link
        const htmlOutput = HtmlService.createHtmlOutput(
            `Shortcuts to ${selectedDocIds.length} documents have been added to the print folder. ` +
            `You can now open the folder and print them. <br><br>` +
            `<a href="${printFolderUrl}" target="_blank" style="font-weight: bold;">Click here to open the print folder</a>.`
        )
        .setWidth(450)
        .setHeight(150);
        
        SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Print Preparation Complete!');

    } catch (e) {
        ui.alert("Error accessing print folder: " + e.message + ". Please ensure the folder exists and you have access, and that the ID in Globals.gs is correct.");
    }
}

/**
 * Extracts the Google Drive file ID from a Google Sheets HYPERLINK formula.
 * @param {string} formula The HYPERLINK formula string (e.g., '=HYPERLINK("https://docs.google.com/open?id=FILE_ID", "Open Slip")').
 * @returns {string|null} The extracted file ID or null if not found.
 */
function extractFileIdFromHyperlink(formula) {
    const match = formula.match(/id=([a-zA-Z0-9_-]+)"/);
    return match ? match[1] : null;
}

/**
 * Gets a sheet from the reference spreadsheet by its name.
 * @param {string} name - The name of the sheet to retrieve.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} - The requested sheet object.
 */
function getReferenceSheet(name) {
    const refSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
    const sheet = refSS.getSheetByName(name);
    if (!sheet) {
        throw new Error(`Reference sheet "${name}" not found.`);
    }
    return sheet;
}

/**
 * Logs a message to a specified sheet.
 * This is a placeholder for a more robust logging mechanism.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to log to.
 * @param {string} message The message to log.
 */
function logToSheet(sheet, message) {
    if (sheet) {
        sheet.appendRow([new Date(), message]);
    } else {
        Logger.log(`LOGGING FAILED: ${message}`);
    }
}