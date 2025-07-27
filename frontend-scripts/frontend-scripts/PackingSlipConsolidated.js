/**
 * @file PackingSlipConsolidated.gs
 * @description Creates a single Google Doc with packing slips for multiple selected orders, and a separate Google Doc for all customer notes.
 * * @version 25-07-25-1410 start of major refactoring
 * @environment Frontend
 */

// --- PAGE LAYOUT CONSTANT ---
const MAX_PRODUCTS_PER_PAGE = 7; // Set the maximum number of products that can fit on a single page.

// --- TEST RUN FLAG ---
const IS_TEST_RUN = true; // Hardcoded TRUE for testing. Set to FALSE for production to update OrderLog.

/**
 * Checks if a line of text has visible content after trimming, ignoring BiDi control characters.
 * @param {string} line The line to check.
 * @returns {boolean} True if the line has content.
 */
const isValidLine = (line) => line && line.trim().replace(/\u200E|\u200F/g, '').length > 0;

/**
 * Creates a consolidated packing slip document and a separate customer note document for selected orders.
 * This is triggered by a menu item or button.
 */
/**
 * Creates a consolidated packing slip document and a separate customer note document.
 * This function can process either a specific list of orders or all orders from the PackingQueue.
 * @param {string[]} [orderNumbersToProcess] - An optional array of order numbers to process. If not provided, all orders from PackingQueue are processed.
 */
/**
 * Gathers selected orders from the PackingDisplay sheet and calls the main document creation function.
 * This function is meant to be called from the custom menu.
 */
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
        .filter(row => row[selectColIndex] === true) // Filter for rows where the checkbox is ticked
        .map(row => String(row[orderNumColIndex]).trim());

    if (selectedOrderNumbers.length === 0) {
        ui.alert("No orders selected. Please check the boxes for the orders you wish to generate documents for.");
        return;
    }

    // Call the main function with the specific list of selected orders
    createConsolidatedPackingDocs(selectedOrderNumbers);
}

function createConsolidatedPackingDocs(orderNumbersToProcess) {
    const ui = SpreadsheetApp.getUi();
    let selectedOrderNumbers = [];

    try {
        const referenceSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const ordersM_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDERS_M);
        const packingQueue_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.PACKING_QUEUE);
        const packingRows_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.PACKING_ROWS);
        const orderLog_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDER_LOG);

        if (!ordersM_sheet || !packingQueue_sheet || !packingRows_sheet || !orderLog_sheet) {
            throw new Error("One or more required sheets are missing in the Reference file.");
        }

        // --- Determine which orders to process based on the parameter ---
        if (orderNumbersToProcess && orderNumbersToProcess.length > 0) {
            // Frontend Path: A specific list of orders was provided.
            Logger.log(`Processing ${orderNumbersToProcess.length} orders passed as a parameter.`);
            selectedOrderNumbers = orderNumbersToProcess;
        } else {
            // Backend Path: No list provided, so process everything in the PackingQueue.
            Logger.log("No order list provided; processing all orders from PackingQueue.");
            const packingQueueData = packingQueue_sheet.getDataRange().getValues();
            const packingQueueHeaders = packingQueueData.shift();
            const packingQueueOrderNumberCol = packingQueueHeaders.indexOf(G.HEADERS.PACKING_QUEUE_ORDER_NUMBER);

            if (packingQueueOrderNumberCol === -1) {
                throw new Error("'Order Number' column not found in PackingQueue sheet.");
            }
            selectedOrderNumbers = packingQueueData.map(row => String(row[packingQueueOrderNumberCol]).trim()).filter(Boolean);
        }

        if (selectedOrderNumbers.length === 0) {
            Logger.log("No orders found to process.");
            // Only show a UI alert if the script was run from a context that has a UI.
            if (SpreadsheetApp.getUi()) {
                ui.alert("No orders were found to process (either selected or in the queue).");
            }
            return;
        }

        // --- The rest of the script continues below, using the populated 'selectedOrderNumbers' array ---

        const ordersMData = ordersM_sheet.getDataRange().getValues();
        const ordersMHeaders = ordersMData.shift();
        const ordersMMap = new Map(ordersMData.map(row => [String(row[ordersMHeaders.indexOf(G.HEADERS.ORDER_NUMBER)]).trim(), row]));

        const packingRowsData = packingRows_sheet.getDataRange().getValues();
        const packingRowsHeaders = packingRowsData.shift();
        const packingRowsQtyCol = packingRowsHeaders.indexOf("Quantity");
        const packingRowsByOrder = new Map();
        packingRowsData.forEach(row => {
            const orderNum = String(row[packingRowsHeaders.indexOf("Order Number")]).trim();
            if (!packingRowsByOrder.has(orderNum)) {
                packingRowsByOrder.set(orderNum, []);
            }
            packingRowsByOrder.get(orderNum).push(row);
        });

        const detailsM_sheet = referenceSS.getSheetByName("DetailsM");
        const detailsC_sheet = referenceSS.getSheetByName("DetailsC");
        if (!detailsM_sheet || !detailsC_sheet) {
            throw new Error("Error: DetailsM or DetailsC sheet not found for SKU mapping.");
        }
        const skuToDetailMap = new Map();
        const detailsM_data = detailsM_sheet.getDataRange().getValues();
        detailsM_data.shift();
        detailsM_data.forEach(row => {
            const sku = (row[0] || "").toString().trim();
            if (sku) {
                skuToDetailMap.set(sku, {
                    nameEN: (row[2] || ""), nameHE: (row[1] || ""), shortEN: (row[4] || ""), shortHE: (row[3] || ""),
                    intensity: (row[9] || ""), complexity: (row[10] || ""), acidity: (row[11] || ""), decant: (row[20] || "")
                });
            }
        });
        const detailsC_data = detailsC_sheet.getDataRange().getValues();
        detailsC_data.shift();
        detailsC_data.forEach(row => {
            const sku = (row[0] || "").toString().trim();
            if (sku) {
                const existing = skuToDetailMap.get(sku) || {};
                skuToDetailMap.set(sku, { ...existing,
                    harmonizeEN: (row[3] || ""), contrastEN: (row[4] || ""),
                    harmonizeHE: (row[5] || ""), contrastHE: (row[6] || "")
                });
            }
        });

        const getProductDetails = (sku) => {
            const detail = skuToDetailMap.get(sku) || {};
            const hebrewDetails = [
                detail.nameHE || '',
                [
                    detail.intensity ? `עוצמה (1-5): ${detail.intensity}` : null,
                    detail.complexity ? `מורכבות (1-5): ${detail.complexity}` : null,
                    (detail.acidity && detail.acidity !== '') ? `חומציות (1-5): ${detail.acidity}` : null
                ].filter(p => p).join(', '),
                detail.harmonizeHE ? `הרמוניה עם: טעמי ${String(detail.harmonizeHE).trim()}` : '',
                detail.contrastHE ? `קונטרסט עם: טעמי ${String(detail.contrastHE).trim()}` : '',
                detail.decant ? `מומלץ לאוורור - ${detail.decant} דקות` : ''
            ].filter(line => line && line.trim()).join('\n');
            const englishDetails = [
                detail.nameEN || '',
                [
                    detail.intensity ? `Intensity (1-5): ${detail.intensity}` : null,
                    detail.complexity ? `Complexity (1-5): ${detail.complexity}` : null,
                    (detail.acidity && detail.acidity !== '') ? `Acidity (1-5): ${detail.acidity}` : null
                ].filter(p => p).join(', '),
                detail.harmonizeEN ? `Harmonize with ${String(detail.harmonizeEN).trim()} flavors` : '',
                detail.contrastEN ? `Contrast with ${String(detail.contrastEN).trim()} flavors` : '',
                detail.decant ? `Recommended decanting – ${detail.decant} minutes.` : ''
            ].filter(line => line && line.trim()).join('\n');
            return { englishDetails, hebrewDetails };
        };

        const ordersPageSplits = new Map();
        selectedOrderNumbers.forEach(orderNumber => {
            const allProductsForOrder = packingRowsByOrder.get(orderNumber) || [];
            const orderPages = [];
            if (allProductsForOrder.length === 0) {
                orderPages.push([]);
            } else {
                for (let i = 0; i < allProductsForOrder.length; i += MAX_PRODUCTS_PER_PAGE) {
                    const pageOfProducts = allProductsForOrder.slice(i, i + MAX_PRODUCTS_PER_PAGE);
                    orderPages.push(pageOfProducts);
                }
            }
            ordersPageSplits.set(orderNumber, orderPages);
        });

        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd-HHmm");
        const packingSlipTemplateFile = DriveApp.getFileById(G.FILE_IDS.PACKING_SLIP_TEMPLATE);
        const newPackingSlipFile = packingSlipTemplateFile.makeCopy(`Packing Slips ${timestamp}`);
        const packingSlipDoc = DocumentApp.openById(newPackingSlipFile.getId());
        const packingSlipBody = packingSlipDoc.getBody();
        packingSlipBody.clear();

        const consolidatedDocId = packingSlipDoc.getId();
        const consolidatedDocUrl = packingSlipDoc.getUrl();
        const now = new Date();

        let notesDoc = null;
        let notesDocBody = null;
        let notesDocId = null;
        let notesDocUrl = null;
        const ordersWithNotes = selectedOrderNumbers.filter(orderNum => {
            const orderRow = ordersMMap.get(orderNum);
            return orderRow && String(orderRow[ordersMHeaders.indexOf("customer_note")] || "").trim();
        });

        if (ordersWithNotes.length > 0) {
            const notesDocName = `Order Notes ${timestamp}`;
            notesDoc = DocumentApp.create(notesDocName);
            notesDocBody = notesDoc.getBody();
            notesDocId = notesDoc.getId();
            notesDocUrl = notesDoc.getUrl();
        }

        const ordersProcessedForLog = [];

        selectedOrderNumbers.forEach((orderNumber, orderIndex) => {
            const ordersMRow = ordersMMap.get(orderNumber);
            const orderPageSplits = ordersPageSplits.get(orderNumber);

            if (!ordersMRow || !orderPageSplits || orderPageSplits.length === 0) {
                Logger.log(`Skipping order ${orderNumber} in Pass 2: Data or page split info missing or no products to display.`);
                return;
            }

            orderPageSplits.forEach((productsForThisPage, pageNumIndex) => {
                if (orderIndex > 0 || pageNumIndex > 0) {
                    packingSlipBody.appendPageBreak();
                }

                const firstName = ordersMRow[ordersMHeaders.indexOf("shipping_first_name")] || "";
                const lastName = ordersMRow[ordersMHeaders.indexOf("shipping_last_name")] || "";
                const shippingName = `${firstName} ${lastName}`.trim();
                packingSlipBody.appendParagraph(`   ${shippingName} `).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true).setFontSize(13);
                packingSlipBody.appendParagraph(`${ordersMRow[ordersMHeaders.indexOf("shipping_address_1")] || ""}` +
                    (ordersMRow[ordersMHeaders.indexOf("shipping_address_2")] ? `, ${ordersMRow[ordersMHeaders.indexOf("shipping_address_2")]}` : '') +
                    `, ${ordersMRow[ordersMHeaders.indexOf("shipping_city")] || ""}`
                ).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(false).setFontSize(null);
                packingSlipBody.appendParagraph(`Phone: ${ordersMRow[ordersMHeaders.indexOf("shipping_phone")] || ""}`).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                packingSlipBody.appendParagraph(`Order: ${orderNumber} הזמנה`).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                packingSlipBody.appendParagraph(`Date: ${Utilities.formatDate(new Date(ordersMRow[ordersMHeaders.indexOf("order_date")]), Session.getScriptTimeZone(), "yyyy-MM-dd")} תאריך`).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                packingSlipBody.appendParagraph("");

                const tableHeaders = [["Item", "Qty.כמ", "פריט"]];
                const currentProductTable = packingSlipBody.appendTable(tableHeaders);
                currentProductTable.setBorderWidth(0);
                const headerRow = currentProductTable.getRow(0);
                headerRow.setBold(true);
                headerRow.getCell(0).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.LEFT);
                headerRow.getCell(1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                headerRow.getCell(2).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
                currentProductTable.setColumnWidth(0, 240);
                currentProductTable.setColumnWidth(1, 55);
                currentProductTable.setColumnWidth(2, 240);

                productsForThisPage.forEach((productRow) => {
                    const sku = String(productRow[packingRowsHeaders.indexOf("SKU")]).trim();
                    const { englishDetails, hebrewDetails } = getProductDetails(sku);
                    const quantity = Number(productRow[packingRowsHeaders.indexOf("Quantity")]).toFixed(0);
                    const newRow = currentProductTable.appendTableRow();
                    const cellEN = newRow.appendTableCell();
                    const cellQTY = newRow.appendTableCell();
                    const cellHE = newRow.appendTableCell();
                    cellEN.getChild(0).asParagraph().setFontSize(1);
                    const enLines = englishDetails.trim().split('\n').filter(isValidLine);
                    if (enLines.length > 0) {
                        cellEN.appendParagraph(enLines[0]).setFontSize(null).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setBold(true);
                        enLines.slice(1).forEach(line => {
                            cellEN.appendParagraph(line).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setBold(false);
                        });
                    }
                    cellQTY.clear();
                    cellQTY.appendParagraph(quantity).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                    cellHE.getChild(0).asParagraph().setFontSize(1);
                    const heLines = hebrewDetails.trim().split('\n').filter(isValidLine);
                    if (heLines.length > 0) {
                        cellHE.appendParagraph(heLines[0]).setFontSize(null).setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setBold(true);
                        heLines.slice(1).forEach(line => {
                            cellHE.appendParagraph(line).setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setBold(false);
                        });
                    }
                });

                if (pageNumIndex + 1 === orderPageSplits.length) {
                    const allProductsForOrder = packingRowsByOrder.get(orderNumber) || [];
                    const totalQuantity = allProductsForOrder.reduce((sum, productRow) => {
                        const quantity = Number(productRow[packingRowsQtyCol]) || 0;
                        return sum + quantity;
                    }, 0);
                    const totalsRow = currentProductTable.appendTableRow();
                    totalsRow.appendTableCell().appendParagraph(`Total`).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setBold(true);
                    totalsRow.appendTableCell().appendParagraph(totalQuantity.toFixed(0)).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);
                    totalsRow.appendTableCell().appendParagraph("סה\"כ").setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setBold(true);
                }
            });

            ordersProcessedForLog.push({
                orderId: String(ordersMRow[ordersMHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim(),
                orderNumber: orderNumber,
                orderDate: new Date(ordersMRow[ordersMHeaders.indexOf("order_date")])
            });
        });

        if (notesDocBody) {
            notesDocBody.appendParagraph("Consolidated Customer Notes").setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
            notesDocBody.appendParagraph("");
            ordersWithNotes.forEach(orderNumber => {
                const orderRow = ordersMMap.get(orderNumber);
                const customerNote = String(orderRow[ordersMHeaders.indexOf("customer_note")] || "").trim();
                const shippingName = `${orderRow[ordersMHeaders.indexOf("shipping_first_name")] || ""} ${orderRow[ordersMHeaders.indexOf("shipping_last_name")] || ""}`.trim();
                notesDocBody.appendParagraph(`Order: ${orderNumber} - ${shippingName}`).setBold(true);
                notesDocBody.appendParagraph(customerNote);
                notesDocBody.appendHorizontalRule();
            });
        }

        const printFolder = DriveApp.getFolderById(G.FILE_IDS.PRINT_FOLDER);
        printFolder.addFile(newPackingSlipFile);
        DriveApp.getRootFolder().removeFile(newPackingSlipFile);

        if (notesDoc) {
            const notesFile = DriveApp.getFileById(notesDocId);
            printFolder.addFile(notesFile);
            DriveApp.getRootFolder().removeFile(notesFile);
        }

        if (!IS_TEST_RUN) {
            const orderLogRange = orderLog_sheet.getDataRange();
            const orderLogData = orderLogRange.getValues();
            const orderLogHeaders = orderLogData.shift();
            const idCol = orderLogHeaders.indexOf(G.HEADERS.ORDER_ID);
            const printedDateCol = orderLogHeaders.indexOf("packing_print_date");
            const statusCol = orderLogHeaders.indexOf("packing_slip_status");
            
            const updatedOrderLogData = orderLogData.map(row => {
                const orderIdInLog = String(row[idCol]).trim();
                const processedOrder = ordersProcessedForLog.find(p => p.orderId === orderIdInLog);
                if (processedOrder) {
                    row[printedDateCol] = now;
                    row[statusCol] = 'Printed';
                }
                return row;
            });
            orderLog_sheet.getRange(2, 1, updatedOrderLogData.length, orderLogHeaders.length).setValues(updatedOrderLogData);
            Logger.log("OrderLog updated for production run.");
        } else {
            Logger.log("IS_TEST_RUN is TRUE. OrderLog status NOT updated.");
        }

        if (SpreadsheetApp.getUi()) {
            let htmlMessage = `Packing Slips created for ${selectedOrderNumbers.length} orders.<br><br>` +
                `<a href="${consolidatedDocUrl}" target="_blank">Open Packing Slips</a>`;
            if (notesDocUrl) {
                htmlMessage += `<br><br>Customer notes document also created.<br>` +
                    `<a href="${notesDocUrl}" target="_blank">Open Order Notes</a>`;
            }
            const htmlOutput = HtmlService.createHtmlOutput(htmlMessage)
                .setWidth(400)
                .setHeight(notesDocUrl ? 200 : 150);
            ui.showModalDialog(htmlOutput, 'Documents Created');
        }

    } catch (e) {
        Logger.log(`Error creating consolidated packing slips: ${e.message} Stack: ${e.stack}`);
        if (SpreadsheetApp.getUi()) {
            ui.alert(`An error occurred: ${e.message}`);
        }
    }
}


// --- Helper functions for PackingSlipConsolidated.gs (LOCAL COPIES) ---

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
 * Sets a specific setting value in the Reference Config sheet.
 * @param {string} settingName - The name of the setting to set.
 * @param {any} value - The value to set.
 */
function setReferenceSetting(settingName, value) {
    const configSheet = getReferenceSheet(G.SHEET_NAMES.REFERENCE_CONFIG);

    const data = configSheet.getDataRange().getValues();
    const headers = data[0];
    const settingCol = headers.indexOf("Setting");
    const valueCol = headers.indexOf("Value");

    if (settingCol === -1 || valueCol === -1) {
        throw new Error("The Reference Config sheet headers are incorrect. Expected 'Setting' and 'Value'.");
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