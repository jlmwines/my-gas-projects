/**
 * @file PackingSlipProcessor.gs
 * @description Creates packing slips for all eligible orders.
 * @version 25-07-22-1621
 */
function generatePackingSlipsAll() {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const backendSS = SpreadsheetApp.getActiveSpreadsheet();

    const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
    const detailsM_sheet = referenceSS.getSheetByName("DetailsM");
    const detailsC_sheet = referenceSS.getSheetByName("DetailsC");
    const orderLog_sheet = referenceSS.getSheetByName("OrderLog");
    const packingQueue_sheet = backendSS.getSheetByName('PackingQueue') || backendSS.insertSheet('PackingQueue');
    const packingRows_sheet = backendSS.getSheetByName('PackingRows') || backendSS.insertSheet('PackingRows');

    if (!ordersM_sheet || !detailsM_sheet || !detailsC_sheet || !orderLog_sheet) {
        Logger.log("Error: A required sheet was not found in the Reference File.");
        return;
    }

    // --- Robustly read OrderLog data ---
    const orderLog_headers_data = orderLog_sheet.getRange(1, 1, 1, orderLog_sheet.getLastColumn()).getValues();
    const orderLog_headers = orderLog_headers_data[0].map(h => String(h).trim().replace(/^\ufeff/, ''));
    const numLogColumns = orderLog_headers.length;
    
    let orderLog_data = [];
    if (orderLog_sheet.getLastRow() > 1) {
        orderLog_data = orderLog_sheet.getRange(2, 1, orderLog_sheet.getLastRow() - 1, numLogColumns).getValues();
    }
    
    const logOrderIdCol = orderLog_headers.indexOf("order_id");
    const logStatusCol = orderLog_headers.indexOf("packing_slip_status"); // UPDATED
    const logDocIdCol = orderLog_headers.indexOf("packing_slip_doc_id");
    const logNoteDocIdCol = orderLog_headers.indexOf("customer_note_doc_id"); // NEW

    if ([logOrderIdCol, logStatusCol, logDocIdCol, logNoteDocIdCol].includes(-1)) {
        throw new Error("A required header was not found in the OrderLog sheet. Check: order_id, packing_slip_status, packing_slip_doc_id, customer_note_doc_id.");
    }

    const orderLogMap = new Map();
    orderLog_data.forEach((row, index) => {
        const orderId = String(row[logOrderIdCol]);
        if (orderId) orderLogMap.set(orderId, { rowIndex: index + 2, data: row });
    });

    const ordersM_data = ordersM_sheet.getDataRange().getValues();
    const ordersM_headers = ordersM_data.shift();
    const colStatus = ordersM_headers.indexOf("status");
    const colOrderId = ordersM_headers.indexOf("order_id");
    // ... (other column mappings are assumed to be present and correct)
    
    const skuToDetailMap = new Map();
    // ... (skuToDetailMap building logic is unchanged)
    const detailsM_data = detailsM_sheet.getDataRange().getValues();
    detailsM_data.shift();
    detailsM_data.forEach(row => { const sku = (row[0] || "").toString().trim(); if(sku) skuToDetailMap.set(sku, { nameEN: (row[2] || ""), nameHE: (row[1] || ""), shortEN: (row[4] || ""), shortHE: (row[3] || ""), intensity: (row[9] || ""), complexity: (row[10] || ""), acidity: (row[11] || ""), decant: (row[20] || "") }); });
    const detailsC_data = detailsC_sheet.getDataRange().getValues();
    detailsC_data.shift();
    detailsC_data.forEach(row => { const sku = (row[0] || "").toString().trim(); if(sku) { const existing = skuToDetailMap.get(sku) || {}; skuToDetailMap.set(sku, { ...existing, harmonizeEN: (row[3] || ""), contrastEN: (row[4] || ""), harmonizeHE: (row[5] || ""), contrastHE: (row[6] || "") }); } });


    const ordersToProcessForDocs = [];
    ordersM_data.forEach(orderM_row => {
        const orderId = String(orderM_row[colOrderId]);
        const status = (orderM_row[colStatus] || "").toString().toLowerCase().trim();
        const logEntry = orderLogMap.get(orderId);
        const hasExistingPackingSlip = logEntry ? (logEntry.data[logStatusCol] !== null && logEntry.data[logStatusCol] !== '') : false;

        if (!(["on-hold", "processing", "completed"].includes(status) && !hasExistingPackingSlip)) {
            return;
        }

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
                currentOrderProductRows.push([orderNumber, orderDate, sku, qty, detail.nameEN || '', detail.shortEN || '', detail.intensity || '', detail.complexity || '', detail.acidity || '', detail.decant || '', detail.harmonizeEN || '', detail.contrastEN || '', detail.nameHE || '', detail.shortHE || '', detail.harmonizeHE || '', detail.contrastHE || '']);
            }
        }
        ordersToProcessForDocs.push({ queueEntry: queueEntry, rowsEntries: currentOrderProductRows });
    });

    const orderLogUpdates = [];
    ordersToProcessForDocs.forEach(orderData => {
        const orderId = String(orderData.queueEntry[7]);
        try {
            const packingSlipId = createPackingSlipPDF(orderData.queueEntry, orderData.rowsEntries);
            const customerNoteId = createCustomerNotePDF(orderData.queueEntry);

            const existingLog = orderLogMap.get(orderId);
            if (existingLog) {
                const rowToUpdate = existingLog.data;
                rowToUpdate[logStatusCol] = "Created";
                rowToUpdate[logDocIdCol] = packingSlipId;
                rowToUpdate[logNoteDocIdCol] = customerNoteId; // NEW
                orderLogUpdates.push({ rowIndex: existingLog.rowIndex, rowData: rowToUpdate });
            } else {
                const newLogEntry = new Array(numLogColumns).fill('');
                newLogEntry[logOrderIdCol] = orderId;
                newLogEntry[logStatusCol] = "Created";
                newLogEntry[logDocIdCol] = packingSlipId;
                newLogEntry[logNoteDocIdCol] = customerNoteId; // NEW
                orderLogUpdates.push({ rowIndex: -1, rowData: newLogEntry });
            }
        } catch (e) {
            Logger.log(`Error processing Order ID ${orderId}: ${e.stack}`);
        }
    });

    // Apply OrderLog updates
    if (orderLogUpdates.length > 0) {
        const newRowsToAppend = orderLogUpdates.filter(e => e.rowIndex === -1).map(e => e.rowData);
        const existingRowsToUpdate = orderLogUpdates.filter(e => e.rowIndex !== -1);
        if (newRowsToAppend.length > 0) {
            orderLog_sheet.getRange(orderLog_sheet.getLastRow() + 1, 1, newRowsToAppend.length, numLogColumns).setValues(newRowsToAppend);
        }
        existingRowsToUpdate.forEach(entry => {
            orderLog_sheet.getRange(entry.rowIndex, 1, 1, numLogColumns).setValues([entry.rowData]);
        });
        Logger.log(`Updated/appended ${orderLogUpdates.length} entries in OrderLog.`);
    }

    SpreadsheetApp.getUi().alert("Packing data and document generation complete!");
}