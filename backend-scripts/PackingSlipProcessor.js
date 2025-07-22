/**
 * @file PackingSlipProcessor.gs
 * @description Creates packing slips for all eligible orders from OrdersM, pulls product names from DetailsM and DetailsC, and generates Google Docs packing slips.
 * @version 25-07-21-1645 // RESTORED
 */

function generatePackingSlipsAll() {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const backendSS = SpreadsheetApp.getActiveSpreadsheet();

    const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
    const detailsM_sheet = referenceSS.getSheetByName("DetailsM");
    const detailsC_sheet = referenceSS.getSheetByName("DetailsC");
    const orderLog_sheet = referenceSS.getSheetByName("OrderLog");
    const packingQueue_sheet = backendSS.getSheetByName(SHEET_PACKING_QUEUE) || backendSS.insertSheet(SHEET_PACKING_QUEUE);
    const packingRows_sheet = backendSS.getSheetByName(SHEET_PACKING_ROWS) || backendSS.insertSheet(SHEET_PACKING_ROWS);
    const packingText_sheet = backendSS.getSheetByName(SHEET_PACKING_TEXT) || backendSS.insertSheet(SHEET_PACKING_TEXT);

    if (!ordersM_sheet) { Logger.log("Error: 'OrdersM' sheet not found in Reference File."); return; }
    if (!detailsM_sheet) { Logger.log("Error: 'DetailsM' sheet not found in Reference File."); return; }
    if (!detailsC_sheet) { Logger.log("Error: 'DetailsC' sheet not found in Reference File."); return; }
    if (!orderLog_sheet) { Logger.log("Error: 'OrderLog' sheet not found in Reference File."); return; }

    const ordersM_data = ordersM_sheet.getDataRange().getValues();
    const ordersM_headers = ordersM_data.shift();

    const orderLog_data = orderLog_sheet.getDataRange().getValues();
    const rawOrderLog_headers = orderLog_data.shift();
    const orderLog_headers = rawOrderLog_headers.map(h => String(h).trim().replace(/^\ufeff/, ''));
    const logOrderIdCol = orderLog_headers.indexOf("order_id");
    const logPrintedStatusCol = orderLog_headers.indexOf("packing_slip_printed"); // Ensure this is defined and accessible
    const logDocIdCol = orderLog_headers.indexOf("packing_slip_doc_id");

    // Map existing OrderLog entries by order_id for quick lookup, storing the printed status as well
    const orderLogMap = new Map();
    orderLog_data.forEach((row, index) => {
        const orderId = row[logOrderIdCol];
        if (orderId) {
            orderLogMap.set(orderId, {
                rowIndex: index + 1, // Store 0-based row index + 1 for 1-based sheet range
                data: row,
                printedStatus: row[logPrintedStatusCol] // Store printed status directly for easy access
            });
        }
    });

    const colStatus = ordersM_headers.indexOf("status");
    const colOrderNumber = ordersM_headers.indexOf("order_number");
    const colOrderDate = ordersM_headers.indexOf("order_date");
    const colOrderId = ordersM_headers.indexOf("order_id");
    const colShippingFirstName = ordersM_headers.indexOf("shipping_first_name");
    const colShippingLastName = ordersM_headers.indexOf("shipping_last_name");
    const colBillingPhone = ordersM_headers.indexOf("billing_phone");
    const colBillingEmail = ordersM_headers.indexOf("billing_email");
    const colShippingCompany = ordersM_headers.indexOf("shipping_company");
    const colShippingAddress1 = ordersM_headers.indexOf("shipping_address_1");
    const colShippingAddress2 = ordersM_headers.indexOf("shipping_address_2");
    const colShippingCity = ordersM_headers.indexOf("shipping_city");
    const colCustomerNote = ordersM_headers.indexOf("customer_note");

    const essentialOrdersCols = [colStatus, colOrderNumber, colOrderDate, colOrderId, colShippingFirstName, colShippingLastName, colBillingPhone, colBillingEmail, colShippingAddress1, colShippingCity, colCustomerNote];
    const essentialOrdersColNames = ["status", "order_number", "order_date", "order_id", "shipping_first_name", "shipping_last_name", "billing_phone", "billing_email", "shipping_address_1", "shipping_city", "customer_note"];
    for (let i = 0; i < essentialOrdersCols.length; i++) {
        if (essentialOrdersCols[i] === -1) {
            Logger.log(`Error: Essential column '${essentialOrdersColNames[i]}' not found in OrdersM.`);
            SpreadsheetApp.getUi().alert(`Error: Essential column '${essentialOrdersColNames[i]}' not found in OrdersM.`);
            return;
        }
    }

    // --- Build skuToDetailMap from DetailsM and DetailsC ---
    const skuToDetailMap = new Map();

    // Process DetailsM data
    const detailsM_data = detailsM_sheet.getDataRange().getValues();
    detailsM_data.shift(); // Remove headers

    const dmSkuCol = 0;
    const dmNameHECol = 1;
    const dmNameENCol = 2;
    const dmShortHECol = 3;
    const dmShortENCol = 4;
    const dmIntensityCol = 9;
    const dmComplexityCol = 10;
    const dmAcidityCol = 11;
    const dmDecantCol = 20;

    detailsM_data.forEach(row => {
        const sku = (row[dmSkuCol] || "").toString().trim();
        if (!sku) return;

        skuToDetailMap.set(sku, {
            nameEN: (row[dmNameENCol] || ""),
            nameHE: (row[dmNameHECol] || ""),
            shortEN: (row[dmShortENCol] || ""),
            shortHE: (row[dmShortHECol] || ""),
            intensity: (row[dmIntensityCol] || ""),
            complexity: (row[dmComplexityCol] || ""),
            acidity: (row[dmAcidityCol] || ""),
            decant: (row[dmDecantCol] || "")
        });
    });

    // Process DetailsC data and merge into skuToDetailMap
    const detailsC_data = detailsC_sheet.getDataRange().getValues();
    detailsC_data.shift(); // Remove headers

    const dcSkuCol = 0;
    const dcHarmonizeENCol = 3;
    const dcContrastENCol = 4;
    const dcHarmonizeHECol = 5;
    const dcContrastHECol = 6;

    detailsC_data.forEach(row => {
        const sku = (row[dcSkuCol] || "").toString().trim();
        if (!sku) return;

        const existing = skuToDetailMap.get(sku) || {};
        skuToDetailMap.set(sku, {
            ...existing,
            harmonizeEN: (row[dcHarmonizeENCol] || ""),
            contrastEN: (row[dcContrastENCol] || ""),
            harmonizeHE: (row[dcHarmonizeHECol] || ""),
            contrastHE: (row[dcContrastHECol] || "")
        });
    });


    // --- Prepare Output Arrays for Sheets and Doc Generation ---
    const queueOutput = [["Order Number", "Order Date", "Customer Name", "Phone", "Email", "Address", "Customer Note", "Order ID"]];
    const rowsOutput = [
        ["Order Number", "Order Date", "SKU", "Quantity",
         "Name EN", "Short EN", "Intensity", "Complexity", "Acidity", "Decant",
         "Harmonize EN", "Contrast EN", "Name HE", "Short HE", "Harmonize HE", "Contrast HE"]
    ];
    const packingTextOutput = [["Order Number", "SKU", "Product Description EN", "Product Description HE"]];

    const ordersToProcessForDocs = []; // Collect data for doc generation

    ordersM_data.forEach(orderM_row => {
        const orderId = orderM_row[colOrderId];
        const status = (orderM_row[colStatus] || "").toString().toLowerCase().trim();

        // Check OrderLog for existing packing slip status
        const logEntry = orderLogMap.get(orderId);
        // Access printedStatus directly from the mapped entry's property
        const hasExistingPackingSlip = logEntry ? (logEntry.printedStatus !== null && logEntry.printedStatus !== '') : false;

        const isEligibleForPackingSlip = (
            ["on-hold", "processing", "completed"].includes(status) &&
            !hasExistingPackingSlip // Only if no existing packing slip (null or empty)
        );

        if (!isEligibleForPackingSlip) {
            return;
        }

        const orderNumber = orderM_row[colOrderNumber];
        const orderDate = orderM_row[colOrderDate];
        const customerFirstName = orderM_row[colShippingFirstName] || "";
        const customerLastName = orderM_row[colShippingLastName] || "";
        const customerName = `${customerFirstName} ${customerLastName}`.trim();
        const phone = orderM_row[colBillingPhone] || "";
        const email = orderM_row[colBillingEmail] || "";
        const shippingCompany = orderM_row[colShippingCompany] || "";
        const shippingAddress1 = orderM_row[colShippingAddress1] || "";
        const shippingAddress2 = orderM_row[colShippingAddress2] || "";
        const shippingCity = orderM_row[colShippingCity] || "";
        const customerNote = orderM_row[colCustomerNote] || ""; // Get customer note

        const addressLines = [
            shippingCompany,
            shippingAddress1,
            shippingAddress2,
            shippingCity
        ].filter(x => x && String(x).trim()).join('\n'); // Multi-line address

        // Push to PackingQueue output array (includes Customer Note and Order ID for doc generation)
        queueOutput.push([orderNumber, orderDate, customerName, phone, email, addressLines, customerNote, orderId]);

        const currentOrderProductRows = []; // Collect product rows for this order
        const currentOrderProductText = []; // Collect product text for this order

        for (let j = 1; j <= 24; j++) {
            const skuColIndex = ordersM_headers.indexOf(`Product Item ${j} SKU`);
            const qtyColIndex = ordersM_headers.indexOf(`Product Item ${j} Quantity`);

            if (skuColIndex === -1 || qtyColIndex === -1) {
                break;
            }

            const sku = (orderM_row[skuColIndex] || "").toString().trim();
            const qty = Number(orderM_row[qtyColIndex]);

            if (sku && qty > 0) {
                const detail = skuToDetailMap.get(sku) || {};

                // Push to PackingRows output array
                const rowForPackingRows = [
                    orderNumber, orderDate, sku, qty,
                    detail.nameEN || '', detail.shortEN || '', detail.intensity || '', detail.complexity || '', detail.acidity || '', detail.decant || '',
                    detail.harmonizeEN || '', detail.contrastEN || '', detail.nameHE || '', detail.shortHE || '', detail.harmonizeHE || '', detail.contrastHE || ''
                ];
                rowsOutput.push(rowForPackingRows);
                currentOrderProductRows.push(rowForPackingRows); // Collect for doc generation

                // --- English Product Description for PackingText ---
                const productDescriptionLinesEN = [];
                if (detail.nameEN) productDescriptionLinesEN.push(detail.nameEN);
                if (detail.shortEN) productDescriptionLinesEN.push(detail.shortEN);
                const combinedAttributesEN = [];
                if (detail.intensity) combinedAttributesEN.push(`Intensity (1-5): ${detail.intensity}`);
                if (detail.complexity) combinedAttributesEN.push(`Complexity (1-5): ${detail.complexity}`);
                if (detail.acidity) combinedAttributesEN.push(`Acidity (1-5): ${detail.acidity}`);
                if (combinedAttributesEN.length > 0) productDescriptionLinesEN.push(combinedAttributesEN.join(', '));
                if (detail.decant) productDescriptionLinesEN.push(`Recommended decanting ${detail.decant} minutes.`);
                if (detail.harmonizeEN) {
                    const harmonizeTextEN = String(detail.harmonizeEN).trim();
                    const finalHarmonizeEN = harmonizeTextEN.toLowerCase().includes('flavors') ? harmonizeTextEN : `${harmonizeTextEN} flavors`;
                    productDescriptionLinesEN.push(`Harmonize with ${finalHarmonizeEN}.`);
                }
                if (detail.contrastEN) {
                    const contrastTextEN = String(detail.contrastEN).trim();
                    const finalContrastEN = contrastTextEN.toLowerCase().includes('flavors') ? contrastTextEN : `${contrastTextEN} flavors`;
                    productDescriptionLinesEN.push(`Contrast with ${finalContrastEN}.`);
                }

                // --- Hebrew Product Description for PackingText ---
                const productDescriptionLinesHE = [];
                if (detail.nameHE) productDescriptionLinesHE.push(detail.nameHE);
                if (detail.shortHE) productDescriptionLinesHE.push(detail.shortHE);
                const combinedAttributesHE = [];
                if (detail.intensity) combinedAttributesHE.push(`עוצמה (1-5): ${detail.intensity}`);
                if (detail.complexity) combinedAttributesHE.push(`מורכבות (1-5): ${detail.complexity}`);
                if (detail.acidity) combinedAttributesHE.push(`חומציות (1-5): ${detail.acidity}`);
                if (combinedAttributesHE.length > 0) combinedAttributesHE.push(combinedAttributesHE.join(', '));
                if (detail.decant) productDescriptionLinesHE.push(`Recommended decanting ${detail.decant} minutes.`);
                if (detail.harmonizeHE) {
                    const harmonizeTextHE = String(detail.harmonizeHE).trim();
                    const finalHarmonizeHE = harmonizeTextHE.toLowerCase().includes('טעמים') ? harmonizeTextHE : `${harmonizeTextHE} טעמים`;
                    productDescriptionLinesHE.push(`הרמוניה עם ${finalHarmonizeHE}.`);
                }
                if (detail.contrastHE) {
                    const contrastTextHE = String(detail.contrastHE).trim();
                    const finalContrastHE = contrastTextHE.toLowerCase().includes('טעמים') ? contrastTextHE : `${contrastTextHE} טעמים`;
                    productDescriptionLinesHE.push(`קונטרסט עם ${finalContrastHE}.`);
                }

                // Push to PackingText output array
                const rowForPackingText = [
                    orderNumber,
                    sku,
                    productDescriptionLinesEN.filter(Boolean).join('\n'),
                    productDescriptionLinesHE.filter(Boolean).join('\n')
                ];
                packingTextOutput.push(rowForPackingText);
                currentOrderProductText.push(rowForPackingText); // Collect for doc generation
            }
        }
        // Collect data for this eligible order to pass to createPackingSlipDoc
        ordersToProcessForDocs.push({
            queueEntry: [orderNumber, orderDate, customerName, phone, email, addressLines, customerNote, orderId],
            rowsEntries: currentOrderProductRows
        });
    });

    // --- Write Data to Sheets ---
    packingQueue_sheet.clearContents();
    if (queueOutput.length > 1) {
        packingQueue_sheet.getRange(1, 1, queueOutput.length, queueOutput[0].length).setValues(queueOutput);
        Logger.log(`PackingQueue updated with ${queueOutput.length - 1} entries.`);
    } else {
        packingQueue_sheet.getRange(1, 1, 1, queueOutput[0].length).setValues([queueOutput[0]]);
        Logger.log("No eligible orders for PackingQueue.");
    }

    packingRows_sheet.clearContents();
    if (rowsOutput.length > 1) {
        packingRows_sheet.getRange(1, 1, rowsOutput.length, rowsOutput[0].length).setValues(rowsOutput);
        Logger.log(`PackingRows updated with ${rowsOutput.length - 1} entries.`);
    } else {
        packingRows_sheet.getRange(1, 1, 1, rowsOutput[0].length).setValues([rowsOutput[0]]);
        Logger.log("No product rows for PackingRows.");
    }

    packingText_sheet.clearContents();
    if (packingTextOutput.length > 1) {
        packingText_sheet.getRange(1, 1, packingTextOutput.length, packingTextOutput[0].length).setValues(packingTextOutput);
        Logger.log(`PackingText updated with ${packingTextOutput.length - 1} entries.`);
    } else {
        packingText_sheet.getRange(1, 1, 1, packingTextOutput[0].length).setValues([packingTextOutput[0]]);
        Logger.log("No product descriptions for PackingText.");
    }

    // --- Generate Google Docs Packing Slips and Update OrderLog ---
    const orderLogUpdates = []; // To collect rows that need updating/appending in OrderLog

    ordersToProcessForDocs.forEach(orderData => {
        const orderId = orderData.queueEntry[7]; // Order ID is now last element in queueEntry
        const currentOrderNumber = orderData.queueEntry[0];

        let docId = null;
        try {
            // Call createPackingSlipDoc for this order
            docId = createPackingSlipDoc(orderData.queueEntry, orderData.rowsEntries);
            Logger.log(`Generated packing slip for Order ${currentOrderNumber}. Doc ID: ${docId}`);

            // Prepare OrderLog update/new entry
            const existingLog = orderLogMap.get(orderId);
            if (existingLog) {
                // Update existing row
                const rowToUpdate = existingLog.data;
                rowToUpdate[logPrintedStatusCol] = "Created"; // Set status to 'Created'
                rowToUpdate[logDocIdCol] = docId; // Store doc ID
                orderLogUpdates.push({ rowIndex: existingLog.rowIndex, rowData: rowToUpdate });
            } else {
                // Create new log entry
                const newLogEntry = new Array(orderLog_headers.length).fill('');
                newLogEntry[logOrderIdCol] = orderId;
                newLogEntry[logPrintedStatusCol] = "Created";
                newLogEntry[logDocIdCol] = docId;
                orderLogUpdates.push({ rowIndex: -1, rowData: newLogEntry }); // Use -1 for new row
            }

        } catch (e) {
            Logger.log(`Failed to generate packing slip for Order ${currentOrderNumber}: ${e.message}`);
            SpreadsheetApp.getUi().alert(`Warning: Failed to generate packing slip for Order ${currentOrderNumber}. Error: ${e.message}`);
        }
    });

    // Apply all OrderLog updates/appends in batches
    if (orderLogUpdates.length > 0) {
        const newRowsToAppend = orderLogUpdates.filter(entry => entry.rowIndex === -1).map(entry => entry.rowData);
        const existingRowsToUpdate = orderLogUpdates.filter(entry => entry.rowIndex !== -1);

        if (newRowsToAppend.length > 0) {
            orderLog_sheet.getRange(orderLog_sheet.getLastRow() + 1, 1, newRowsToAppend.length, newRowsToAppend[0].length).setValues(newRowsToAppend);
            Logger.log(`Appended ${newRowsToAppend.length} new entries to OrderLog.`);
        }

        existingRowsToUpdate.forEach(entry => {
            orderLog_sheet.getRange(entry.rowIndex, 1, 1, entry.rowData.length).setValues([entry.rowData]);
        });
        Logger.log(`Updated ${existingRowsToUpdate.length} existing entries in OrderLog.`);
    }

    SpreadsheetApp.getUi().alert("Packing data and document generation complete!");
}