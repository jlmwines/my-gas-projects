/**
 * @file PackingSlipData.gs
 * @description Gathers order and product data for eligible orders and writes it to the PackingQueue and PackingRows sheets in the Reference file.
 * @version 25-07-25-1415 // Updated version number for this critical fix
 * @environment Backend
 */

/**
 * Prepares data for packing slip generation by populating the packing-related sheets.
 * This function does not create any documents.
 */
function preparePackingData() {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);

    // Get all necessary sheets from the Reference file
    const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
    const detailsM_sheet = referenceSS.getSheetByName("DetailsM");
    const detailsC_sheet = referenceSS.getSheetByName("DetailsC");
    const orderLog_sheet = referenceSS.getSheetByName(SHEET_ORDER_LOG); // Use constant
    const orderLogArchive_sheet = referenceSS.getSheetByName(SHEET_ORDER_LOG_ARCHIVE); // Get archive sheet

    const packingQueue_sheet = referenceSS.getSheetByName(SHEET_PACKING_QUEUE) || referenceSS.insertSheet(SHEET_PACKING_QUEUE);
    const packingRows_sheet = referenceSS.getSheetByName(SHEET_PACKING_ROWS) || referenceSS.insertSheet(SHEET_PACKING_ROWS);
    
    // Clear existing data from the packing sheets to prepare for new data
    packingQueue_sheet.clear();
    packingRows_sheet.clear();

    if (!ordersM_sheet || !detailsM_sheet || !detailsC_sheet || !orderLog_sheet || !orderLogArchive_sheet) {
        throw new Error("Error: One or more required sheets (OrdersM, DetailsM, DetailsC, OrderLog, OrderLogArchive) not found in the Reference File.");
    }

    // --- Read OrderLog data and determine its headers/indices ---
    const orderLog_headers_range = orderLog_sheet.getRange(1, 1, 1, orderLog_sheet.getLastColumn());
    const orderLog_headers = orderLog_headers_range.getValues()[0].map(h => String(h).trim().replace(/^\ufeff/, ''));
    const logOrderIdCol = orderLog_headers.indexOf("order_id");
    const logPrintedDateCol = orderLog_headers.indexOf("packing_print_date");

    if ([logOrderIdCol, logPrintedDateCol].includes(-1)) {
        throw new Error("A required header was not found in the OrderLog sheet. Check: order_id, packing_print_date.");
    }
    
    let currentOrderLog_data = [];
    if (orderLog_sheet.getLastRow() > 1) {
        currentOrderLog_data = orderLog_sheet.getRange(2, 1, orderLog_sheet.getLastRow() - 1, orderLog_headers.length).getValues();
    }
    
    // --- START CRITICAL FIX: Build a single Set of all printed Order IDs from both sources ---
    const allPrintedOrderIds = new Set(); // This set will hold all IDs that have been printed (current or archived)

    // 1. Add printed IDs from the current (active) OrderLog sheet
    currentOrderLog_data.forEach(row => {
        if (row[logPrintedDateCol] !== null && String(row[logPrintedDateCol]).trim() !== '') {
            allPrintedOrderIds.add(String(row[logOrderIdCol]));
        }
    });

    // 2. Add printed IDs from the OrderLogArchive sheet
    if (orderLogArchive_sheet.getLastRow() > 1) { // Check if archive has data beyond headers
        const archiveHeadersData = orderLogArchive_sheet.getRange(1, 1, 1, orderLogArchive_sheet.getLastColumn()).getValues();
        const archiveHeaders = archiveHeadersData[0].map(h => String(h).trim().replace(/^\ufeff/, ''));
        const archiveOrderIdCol = archiveHeaders.indexOf("order_id");
        const archivePrintedDateCol = archiveHeaders.indexOf("packing_print_date");

        if (archiveOrderIdCol !== -1 && archivePrintedDateCol !== -1) {
            const archivedData = orderLogArchive_sheet.getRange(2, 1, orderLogArchive_sheet.getLastRow() - 1, archiveHeaders.length).getValues();
            archivedData.forEach(row => {
                if (row[archivePrintedDateCol] !== null && String(row[archivePrintedDateCol]).trim() !== '') {
                    allPrintedOrderIds.add(String(row[archiveOrderIdCol]));
                }
            });
        } else {
            Logger.log("Warning: OrderLogArchive headers missing expected columns ('order_id' or 'packing_print_date'). Skipping archive check for this run.");
        }
    }

    const ordersM_data = ordersM_sheet.getDataRange().getValues();
    const ordersM_headers = ordersM_data.shift();
    const colStatus = ordersM_headers.indexOf("status");
    const colOrderId = ordersM_headers.indexOf("order_id");
    
    // Build SKU details map
    const skuToDetailMap = new Map();
    const detailsM_data = detailsM_sheet.getDataRange().getValues();
    detailsM_data.shift();
    detailsM_data.forEach(row => {
        const sku = (row[0] || "").toString().trim();
        if(sku) {
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
        if(sku) {
            const existing = skuToDetailMap.get(sku) || {};
            skuToDetailMap.set(sku, { ...existing,
                harmonizeEN: (row[3] || ""), contrastEN: (row[4] || ""),
                harmonizeHE: (row[5] || ""), contrastHE: (row[6] || "")
            });
        }
    });

    const ordersToProcessForDocs = [];
    ordersM_data.forEach(orderM_row => {
        const orderId = String(orderM_row[colOrderId]);
        const status = (orderM_row[colStatus] || "").toString().toLowerCase().trim();

        // Eligibility check now uses the comprehensive allPrintedOrderIds set
        if (status === "on-hold" || (["processing", "completed"].includes(status) && !allPrintedOrderIds.has(orderId))) {
            const colOrderNumber = ordersM_headers.indexOf("order_number");
            const colOrderDate = ordersM_headers.indexOf("order_date");
            const colShippingFirstName = ordersM_headers.indexOf("shipping_first_name");
            const colShippingLastName = ordersM_headers.indexOf("shipping_last_name");
            const colBillingPhone = ordersM_headers.indexOf("billing_phone");
            const colBillingEmail = ordersM_headers.indexOf("billing_email");
            const colShippingCompany = ordersM_headers.indexOf("shipping_company");
            const colShippingAddress1 = ordersM_headers.indexOf("shipping_address_1");
            const colShippingAddress2 = ordersM_headers.indexOf("shipping_address_2");
            const colShippingCity = ordersM_headers.indexOf("shipping_city");
            const colCustomerNote = ordersM_headers.indexOf("customer_note");

            const orderNumber = orderM_row[colOrderNumber];
            const orderDate = orderM_row[colOrderDate];
            const customerName = `${orderM_row[colShippingFirstName] || ""} ${orderM_row[colShippingLastName] || ""}`.trim();
            const phone = orderM_row[colBillingPhone] || "";
            const email = orderM_row[colBillingEmail] || "";
            const addressLines = [orderM_row[colShippingCompany] || "", orderM_row[colShippingAddress1] || "", orderM_row[colShippingAddress2] || "", orderM_row[colShippingCity] || ""].filter(x => x && String(x).trim()).join('\n');
            const customerNote = orderM_row[colCustomerNote] || "";
            
            const queueEntry = [orderNumber, orderDate, customerName, phone, email, addressLines, customerNote, orderId];
            
            const currentOrderProductRows = [];
            for (let j = 1; j <= 24; j++) {
                const sku = (orderM_row[ordersM_headers.indexOf(`Product Item ${j} SKU`)] || "").toString().trim();
                const qty = Number(orderM_row[ordersM_headers.indexOf(`Product Item ${j} Quantity`)]);
                if (sku && qty > 0) {
                    const detail = skuToDetailMap.get(sku) || {};
                    currentOrderProductRows.push([
                        orderNumber, orderDate, sku, qty,
                        detail.nameEN || '', detail.shortEN || '',
                        detail.intensity || '', detail.complexity || '', detail.acidity || '', detail.decant || '',
                        detail.harmonizeEN || '', detail.contrastEN || '',
                        detail.nameHE || '', detail.shortHE || '',
                        detail.harmonizeHE || '', detail.contrastHE || ''
                    ]);
                }
            }
            if (currentOrderProductRows.length > 0) {
                ordersToProcessForDocs.push({ queueEntry: queueEntry, rowsEntries: currentOrderProductRows });
            }
        }
    });

    // Write all data to the packing sheets
    const queueRows = ordersToProcessForDocs.map(o => o.queueEntry);
    const rowsRows = ordersToProcessForDocs.flatMap(o => o.rowsEntries);

    if (queueRows.length > 0) {
        packingQueue_sheet.appendRow(["Order Number", "Order Date", "Customer Name", "Phone", "Email", "Address", "Customer Note", "order_id"]);
        packingQueue_sheet.getRange(2, 1, queueRows.length, queueRows[0].length).setValues(queueRows);
    }

    if (rowsRows.length > 0) {
        packingRows_sheet.appendRow(["Order Number", "Order Date", "SKU", "Quantity", "Name EN", "Short EN", "Intensity", "Complexity", "Acidity", "Decant", "Harmonize EN", "Contrast EN", "Name HE", "Short HE", "Harmonize HE", "Contrast HE"]);
        packingRows_sheet.getRange(2, 1, rowsRows.length, rowsRows[0].length).setValues(rowsRows);
    }

    // Record the completion timestamp in the Reference Config sheet
    setReferenceSetting(SETTING_PACKING_DATA_CREATED, new Date());
}

/**
 * Sets a specific setting value in the Reference Config sheet.
 * This is a helper function for the backend to communicate state.
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