/**
 * @file PackingSlipConsolidated.gs
 * @description Client-side functions for triggering packing slip generation via the Web App.
 * @version 2025-07-27-1032
 * @environment Frontend
 */

// --- CLIENT-SIDE FUNCTIONS ---
function generateSelectedPackingDocs() {
    const ui = SpreadsheetApp.getUi();
    const frontendSS = SpreadsheetApp.getActiveSpreadsheet();
    const displaySheet = frontendSS.getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY);
    if (!displaySheet) {
        ui.alert("PackingDisplay sheet not found. Please run 'Refresh List' first.");
        return;
    }
    const displayData = displaySheet.getDataRange().getValues();
    const displayHeaders = displayData.shift();
    const selectColIndex = displayHeaders.indexOf("Select");
    const orderNumColIndex = displayHeaders.indexOf("Order Number");
    if (selectColIndex === -1 || orderNumColIndex === -1) {
        ui.alert("Could not find 'Select' or 'Order Number' columns in the PackingDisplay sheet.");
        return;
    }
    const selectedOrderNumbers = displayData
        .filter(row => row[selectColIndex] === true)
        .map(row => String(row[orderNumColIndex]).trim());
    if (selectedOrderNumbers.length === 0) {
        ui.alert("No orders selected. Please check the boxes for the orders you wish to generate documents for.");
        return;
    }
    callPackingDocsWebApp(selectedOrderNumbers);
}

function createConsolidatedPackingDocs() {
    callPackingDocsWebApp([]);
}

function callPackingDocsWebApp(orderNumbers) {
    const ui = SpreadsheetApp.getUi();
    ui.showModalDialog(HtmlService.createHtmlOutput('<b>Processing...</b><br>Please wait.'), 'Generating Documents');
    try {
        const payload = { command: 'generatePackingDocs', data: orderNumbers };
        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
            muteHttpExceptions: true
        };
        const apiResponse = UrlFetchApp.fetch(G.WEB_APP_URL, options);
        const result = JSON.parse(apiResponse.getContentText());
        if (result.status === 'success') {
            const htmlOutput = HtmlService.createHtmlOutput(result.message).setWidth(400).setHeight(result.height || 150);
            ui.showModalDialog(htmlOutput, 'Documents Created');
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        Logger.log(`callPackingDocsWebApp client-side error: ${err.message}`);
        SpreadsheetApp.getUi().alert(`An error occurred: ${err.message}`);
    }
}

// --- SERVER-SIDE WORKER ---
function _server_generatePackingDocs(orderNumbersToProcess) {
    const IS_TEST_RUN = true;
    const MAX_PRODUCTS_PER_PAGE = 7;
    const isValidLine = (line) => line && line.trim().replace(/\u200E|\u200F/g, '').length > 0;

    try {
        const referenceSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const ordersM_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDERS_M);
        const packingQueue_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.PACKING_QUEUE);
        const packingRows_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.PACKING_ROWS);
        const orderLog_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDER_LOG);
        const detailsM_sheet = referenceSS.getSheetByName("DetailsM");
        const detailsC_sheet = referenceSS.getSheetByName("DetailsC");
        if (!ordersM_sheet || !packingQueue_sheet || !packingRows_sheet || !orderLog_sheet || !detailsM_sheet || !detailsC_sheet) throw new Error("One or more required sheets are missing in the Reference file.");

        let selectedOrderNumbers = [];
        if (orderNumbersToProcess && orderNumbersToProcess.length > 0) {
            selectedOrderNumbers = orderNumbersToProcess;
        } else {
            const packingQueueData = packingQueue_sheet.getDataRange().getValues();
            const packingQueueHeaders = packingQueueData.shift();
            const col = packingQueueHeaders.indexOf(G.HEADERS.PACKING_QUEUE_ORDER_NUMBER);
            selectedOrderNumbers = packingQueueData.map(row => String(row[col]).trim()).filter(Boolean);
        }
        if (selectedOrderNumbers.length === 0) return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'No orders were found to process.' })).setMimeType(ContentService.MimeType.JSON);

        const ordersMData = ordersM_sheet.getDataRange().getValues();
        const ordersMHeaders = ordersMData.shift();
        const ordersMMap = new Map(ordersMData.map(row => [String(row[ordersMHeaders.indexOf(G.HEADERS.ORDER_NUMBER)]).trim(), row]));
        const packingRowsData = packingRows_sheet.getDataRange().getValues();
        const packingRowsHeaders = packingRowsData.shift();
        const packingRowsByOrder = new Map();
        packingRowsData.forEach(row => {
            const orderNum = String(row[packingRowsHeaders.indexOf("Order Number")]).trim();
            if (!packingRowsByOrder.has(orderNum)) packingRowsByOrder.set(orderNum, []);
            packingRowsByOrder.get(orderNum).push(row);
        });

        const skuToDetailMap = new Map();
        detailsM_sheet.getDataRange().getValues().slice(1).forEach(row => {
            const sku = (row[0] || "").toString().trim();
            if (sku) skuToDetailMap.set(sku, {
                nameEN: (row[2] || ""), nameHE: (row[1] || ""), intensity: (row[9] || ""), complexity: (row[10] || ""),
                acidity: (row[11] || ""), decant: (row[20] || "")
            });
        });
        detailsC_sheet.getDataRange().getValues().slice(1).forEach(row => {
            const sku = (row[0] || "").toString().trim();
            if (sku) {
                const existing = skuToDetailMap.get(sku) || {};
                skuToDetailMap.set(sku, { ...existing, harmonizeEN: (row[3] || ""), contrastEN: (row[4] || ""),
                    harmonizeHE: (row[5] || ""), contrastHE: (row[6] || "")
                });
            }
        });

        const getProductDetails = (sku) => {
            const detail = skuToDetailMap.get(sku) || {};
            const hebrewDetails = [detail.nameHE || '',
                [ detail.intensity ? `עוצמה (1-5): ${detail.intensity}` : null,
                  detail.complexity ? `מורכבות (1-5): ${detail.complexity}` : null,
                  (detail.acidity && detail.acidity !== '') ? `חומציות (1-5): ${detail.acidity}` : null
                ].filter(p => p).join(', '),
                detail.harmonizeHE ? `הרמוניה עם: טעמי ${String(detail.harmonizeHE).trim()}` : '',
                detail.contrastHE ? `קונטרסט עם: טעמי ${String(detail.contrastHE).trim()}` : '',
                detail.decant ? `מומלץ לאוורור - ${detail.decant} דקות` : ''
            ].filter(isValidLine).join('\n');
            const englishDetails = [detail.nameEN || '',
                [ detail.intensity ? `Intensity (1-5): ${detail.intensity}` : null,
                  detail.complexity ? `Complexity (1-5): ${detail.complexity}` : null,
                  (detail.acidity && detail.acidity !== '') ? `Acidity (1-5): ${detail.acidity}` : null
                ].filter(p => p).join(', '),
                detail.harmonizeEN ? `Harmonize with ${String(detail.harmonizeEN).trim()} flavors` : '',
                detail.contrastEN ? `Contrast with ${String(detail.contrastEN).trim()} flavors` : '',
                detail.decant ? `Recommended decanting – ${detail.decant} minutes.` : ''
            ].filter(isValidLine).join('\n');
            return { englishDetails, hebrewDetails };
        };

        const ordersPageSplits = new Map();
        selectedOrderNumbers.forEach(orderNumber => {
            const allProductsForOrder = packingRowsByOrder.get(orderNumber) || [];
            const orderPages = [];
            for (let i = 0; i < allProductsForOrder.length; i += MAX_PRODUCTS_PER_PAGE) {
                orderPages.push(allProductsForOrder.slice(i, i + MAX_PRODUCTS_PER_PAGE));
            }
            if (orderPages.length === 0) orderPages.push([]);
            ordersPageSplits.set(orderNumber, orderPages);
        });

        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd-HHmm");
        const newPackingSlipFile = DriveApp.getFileById(G.FILE_IDS.PACKING_SLIP_TEMPLATE).makeCopy(`Packing Slips ${timestamp}`);
        const packingSlipDoc = DocumentApp.openById(newPackingSlipFile.getId());
        const packingSlipBody = packingSlipDoc.getBody(); // <-- ADD THIS LINE
        packingSlipBody.clear();
        
        let notesDocUrl = null;
        const ordersWithNotes = selectedOrderNumbers.filter(orderNum => ordersMMap.get(orderNum) && String(ordersMMap.get(orderNum)[ordersMHeaders.indexOf("customer_note")] || "").trim());
        if (ordersWithNotes.length > 0) {
            const notesDoc = DocumentApp.create(`Order Notes ${timestamp}`);
            const notesDocBody = notesDoc.getBody();
            notesDocUrl = notesDoc.getUrl();
            notesDocBody.appendParagraph("Consolidated Customer Notes").setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
            ordersWithNotes.forEach(orderNumber => {
                const orderRow = ordersMMap.get(orderNumber);
                const customerNote = String(orderRow[ordersMHeaders.indexOf("customer_note")] || "").trim();
                const shippingName = `${orderRow[ordersMHeaders.indexOf("shipping_first_name")] || ""} ${orderRow[ordersMHeaders.indexOf("shipping_last_name")] || ""}`.trim();
                notesDocBody.appendParagraph(`\nOrder: ${orderNumber} - ${shippingName}`).setBold(true);
                notesDocBody.appendParagraph(customerNote).setBold(false);
                notesDocBody.appendHorizontalRule();
            });
            const notesFile = DriveApp.getFileById(notesDoc.getId());
            const printFolder = DriveApp.getFolderById(G.FILE_IDS.PRINT_FOLDER);
            printFolder.addFile(notesFile);
            DriveApp.getRootFolder().removeFile(notesFile);
        }

        const ordersProcessedForLog = [];
        selectedOrderNumbers.forEach((orderNumber, orderIndex) => {
            const ordersMRow = ordersMMap.get(orderNumber);
            const orderPageSplits = ordersPageSplits.get(orderNumber);
            if (!ordersMRow || !orderPageSplits || orderPageSplits.length === 0) return;
            orderPageSplits.forEach((productsForThisPage, pageNumIndex) => {
                if (orderIndex > 0 || pageNumIndex > 0) packingSlipBody.appendPageBreak();
                const firstName = ordersMRow[ordersMHeaders.indexOf("shipping_first_name")] || "";
                const lastName = ordersMRow[ordersMHeaders.indexOf("shipping_last_name")] || "";
                const shippingName = `${firstName} ${lastName}`.trim();
                packingSlipBody.appendParagraph(`  ${shippingName}  `).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true).setFontSize(13);
                packingSlipBody.appendParagraph(`${ordersMRow[ordersMHeaders.indexOf("shipping_address_1")] || ""}` + (ordersMRow[ordersMHeaders.indexOf("shipping_address_2")] ? `, ${ordersMRow[ordersMHeaders.indexOf("shipping_address_2")]}` : '') + `, ${ordersMRow[ordersMHeaders.indexOf("shipping_city")] || ""}`).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(false).setFontSize(null);
                packingSlipBody.appendParagraph(`Phone: ${ordersMRow[ordersMHeaders.indexOf("shipping_phone")] || ""}`).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                packingSlipBody.appendParagraph(`Order: ${orderNumber} הזמנה`).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                packingSlipBody.appendParagraph(`Date: ${Utilities.formatDate(new Date(ordersMRow[ordersMHeaders.indexOf("order_date")]), Session.getScriptTimeZone(), "yyyy-MM-dd")} תאריך`).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                packingSlipBody.appendParagraph("");
                const table = packingSlipBody.appendTable([["Item", "Qty.כמ", "פריט"]]);
                table.setBorderWidth(0).setColumnWidth(0, 240).setColumnWidth(1, 55).setColumnWidth(2, 240);
                const headerRow = table.getRow(0).setBold(true);
                headerRow.getCell(0).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.LEFT);
                headerRow.getCell(1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                headerRow.getCell(2).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
                productsForThisPage.forEach((productRow) => {
                    const sku = String(productRow[packingRowsHeaders.indexOf("SKU")]).trim();
                    const { englishDetails, hebrewDetails } = getProductDetails(sku);
                    const quantity = Number(productRow[packingRowsHeaders.indexOf("Quantity")]).toFixed(0);
                    const newRow = table.appendTableRow();
                    const cellEN = newRow.appendTableCell();
                    const cellQTY = newRow.appendTableCell();
                    const cellHE = newRow.appendTableCell();
                    cellEN.getChild(0).asParagraph().setFontSize(1);
                    const enLines = englishDetails.trim().split('\n').filter(isValidLine);
                    if (enLines.length > 0) {
                        cellEN.appendParagraph(enLines[0]).setFontSize(null).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setBold(true);
                        enLines.slice(1).forEach(line => cellEN.appendParagraph(line).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setBold(false));
                    }
                    cellQTY.clear().appendParagraph(quantity).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                    cellHE.getChild(0).asParagraph().setFontSize(1);
                    const heLines = hebrewDetails.trim().split('\n').filter(isValidLine);
                    if (heLines.length > 0) {
                        cellHE.appendParagraph(heLines[0]).setFontSize(null).setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setBold(true);
                        heLines.slice(1).forEach(line => cellHE.appendParagraph(line).setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setBold(false));
                    }
                });
                if (pageNumIndex + 1 === orderPageSplits.length) {
                    const totalQuantity = (packingRowsByOrder.get(orderNumber) || []).reduce((sum, r) => sum + (Number(r[packingRowsHeaders.indexOf("Quantity")]) || 0), 0);
                    const totalsRow = table.appendTableRow();
                    totalsRow.appendTableCell().appendParagraph(`Total`).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setBold(true);
                    totalsRow.appendTableCell().appendParagraph(totalQuantity.toFixed(0)).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);
                    totalsRow.appendTableCell().appendParagraph("סה\"כ").setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setBold(true);
                }
            });
            ordersProcessedForLog.push({ orderId: String(ordersMMap.get(orderNumber)[ordersMHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim() });
        });

        const printFolder = DriveApp.getFolderById(G.FILE_IDS.PRINT_FOLDER);
        printFolder.addFile(newPackingSlipFile);
        DriveApp.getRootFolder().removeFile(newPackingSlipFile);

        if (!IS_TEST_RUN) {
            const orderLogData = orderLog_sheet.getDataRange().getValues();
            const orderLogHeaders = orderLogData.shift();
            const idCol = orderLogHeaders.indexOf(G.HEADERS.ORDER_ID);
            const printedDateCol = orderLogHeaders.indexOf("packing_print_date");
            const statusCol = orderLogHeaders.indexOf("packing_slip_status");
            const now = new Date();
            const updatedOrderLogData = orderLogData.map(row => {
                if (ordersProcessedForLog.find(p => p.orderId === String(row[idCol]).trim())) {
                    row[printedDateCol] = now;
                    row[statusCol] = 'Printed';
                }
                return row;
            });
            orderLog_sheet.getRange(2, 1, updatedOrderLogData.length, orderLogHeaders.length).setValues(updatedOrderLogData);
        }

        let htmlMessage = `Packing Slips created for ${selectedOrderNumbers.length} orders.<br><br><a href="${packingSlipDoc.getUrl()}" target="_blank">Open Packing Slips</a>`;
        if (notesDocUrl) {
            htmlMessage += `<br><br>Customer notes document also created.<br><a href="${notesDocUrl}" target="_blank">Open Order Notes</a>`;
        }
        
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: htmlMessage, height: notesDocUrl ? 200 : 150 })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        Logger.log(`_server_generatePackingDocs Error: ${e.message} Stack: ${e.stack}`);
        throw new Error(`Server-side error creating docs: ${e.message}`);
    }
}