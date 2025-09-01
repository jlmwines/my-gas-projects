/**
 * @file updatePackingDisplay.gs
 * @description All server-side functions for the packing slip workflow.
 */

// --- CLIENT-CALLABLE FUNCTIONS ---

/**
 * Quickly gets the count of open orders without fetching all the display data.
 * Used to initialize the sidebar. Reuses the core logic from _server_getPackingDisplayData.
 */
function _server_getOpenOrderCount() {
    try {
        const referenceSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const ordersM_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDERS_M);
        const orderLog_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDER_LOG);
        const packingQueue_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.PACKING_QUEUE);
        if (!ordersM_sheet || !orderLog_sheet || !packingQueue_sheet) throw new Error("One or more required sheets are missing in the Reference file.");

        const ordersData = ordersM_sheet.getDataRange().getValues();
        const ordersHeaders = ordersData.shift();
        const orderLogData = orderLog_sheet.getDataRange().getValues();
        const logHeaders = orderLogData.shift();
        const logMap = new Map(orderLogData.map(row => [String(row[logHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim(), row]));
        
        const packingQueueData = packingQueue_sheet.getDataRange().getValues();
        const queueHeaders = packingQueueData.shift();
        const packingQueueMap = new Map(packingQueueData.map(row => [String(row[queueHeaders.indexOf(G.HEADERS.PACKING_QUEUE_ORDER_NUMBER)]).trim(), row]));

        const ttlDays = 7;
        const now = new Date().getTime();
        let openOrderCount = 0; // Use a simple counter instead of building a large array

        ordersData.forEach(orderMRow => {
            const orderId = String(orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim();
            const orderNumber = String(orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_NUMBER)]).trim();
            const orderStatus = String(orderMRow[ordersHeaders.indexOf("status")]).toLowerCase().trim();
            
            if (!packingQueueMap.has(orderNumber)) { return; }

            let displayOrder = false;
            const logEntry = logMap.get(orderId);

            if (orderStatus === 'on-hold') { displayOrder = true; } 
            else if (orderStatus === 'processing' || orderStatus === 'completed') {
                if (!logEntry) { displayOrder = true; } 
                else {
                    const packingSlipStatus = String(logEntry[logHeaders.indexOf('packing_slip_status')]).trim().toLowerCase() || '';
                    const printDate = logEntry[logHeaders.indexOf('packing_print_date')];
                    if (packingSlipStatus !== 'printed') { displayOrder = true; } 
                    else if (printDate instanceof Date && ((now - printDate.getTime()) / (1000 * 60 * 60 * 24)) < ttlDays) {
                        displayOrder = true;
                    }
                }
            }
            if (displayOrder) { openOrderCount++; } // If it meets the criteria, just increment the counter
        });

        return { status: 'success', data: { count: openOrderCount } };
    } catch (e) {
        Logger.log(`_server_getOpenOrderCount Error: ${e.message}`);
        return { status: 'error', message: e.message, data: { count: 0 } };
    }
}

/**
 * Gets packing data from Reference and writes it to the local display sheet in one operation.
 * Called by the "Refresh Orders" button in the sidebar.
 */
function refreshAndWritePackingListServer() {
  try {
    const result = _server_getPackingDisplayData(); 
    if (result.status !== 'success') {
        throw new Error(result.message);
    }
    _client_writePackingDisplayDataToSheet(result.data);
    return { status: 'success', message: 'Packing list refreshed.' };
  } catch (e) {
    Logger.log(`Error in refreshAndWritePackingListServer: ${e.message}`);
    throw new Error(`Failed to refresh and write packing list: ${e.message}`);
  }
}

/**
 * Reads the data from the local PackingDisplay sheet so the client can see which boxes are checked.
 * Called by the "Create Selected" button in the sidebar.
 */
function _client_getPackingDisplaySheetData() {
  try {
    Logger.log("--- Starting _client_getPackingDisplaySheetData (Final Debug Version) ---");
    Logger.log(`Is the global 'G' object available? ${typeof G !== 'undefined'}`);
    
    if (typeof G === 'undefined' || !G.SHEET_NAMES || !G.SHEET_NAMES.PACKING_DISPLAY) {
        Logger.log("CRITICAL: The global 'G' object or its properties are not defined in this context.");
        return null;
    }

    const sheetName = G.SHEET_NAMES.PACKING_DISPLAY;
    Logger.log(`Attempting to get sheet with name: "${sheetName}"`);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(` -> Decision: Sheet "${sheetName}" NOT FOUND. Returning empty array [].`);
      return [];
    }
    
    if (sheet.getLastRow() < 2) {
      Logger.log(" -> Decision: Sheet is empty. Returning empty array [].");
      return [];
    }

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    Logger.log(` -> Decision: Found ${data.length} rows. Returning the data array.`);
    return data;

  } catch (e) {
    Logger.log(` -> FATAL ERROR in _client_getPackingDisplaySheetData: ${e.message} Stack: ${e.stack}`);
    return null; 
  }
}

// --- WORKER & HELPER FUNCTIONS ---

/**
 * Writes data to the local PackingDisplay sheet. A helper for refreshAndWritePackingListServer.
 * @param {Array<Array>} data The array of order data to write.
 */
function _client_writePackingDisplayDataToSheet(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const displaySheet = ss.getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY) || ss.insertSheet(G.SHEET_NAMES.PACKING_DISPLAY);
    displaySheet.clearContents();
    if (displaySheet.getMaxRows() > 1) {
      displaySheet.getRange(2, 1, displaySheet.getMaxRows() - 1, 1).clearDataValidations();
    }
    const headers = ["Select", "Order Date", "Order Number", "Status", "Packing Slip", "Print Date", "Customer Name", "Customer Note"];
    displaySheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    if (data && data.length > 0) {
        displaySheet.getRange(2, 1, data.length, headers.length).setValues(data);
        displaySheet.getRange(2, 1, data.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    } else {
        displaySheet.getRange(2, 1).setValue("No orders to display.");
    }
    displaySheet.autoResizeColumns(2, headers.length);
    ss.setActiveSheet(displaySheet).getRange('A2').activate();
    SpreadsheetApp.flush();
}

/**
 * The core worker that fetches and filters order data from the Reference file. Helper for refreshAndWritePackingListServer.
 * @returns {object} A result object with status and a data array.
 */
function _server_getPackingDisplayData() {
    try {
        const referenceSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const ordersM_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDERS_M);
        const orderLog_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDER_LOG);
        const packingQueue_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.PACKING_QUEUE);
        if (!ordersM_sheet || !orderLog_sheet || !packingQueue_sheet) throw new Error("One or more required sheets are missing in the Reference file.");

        const ordersData = ordersM_sheet.getDataRange().getValues();
        const ordersHeaders = ordersData.shift();
        const orderLogData = orderLog_sheet.getDataRange().getValues();
        const logHeaders = orderLogData.shift();
        const logMap = new Map(orderLogData.map(row => [String(row[logHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim(), row]));
        
        const packingQueueData = packingQueue_sheet.getDataRange().getValues();
        const queueHeaders = packingQueueData.shift();
        const packingQueueMap = new Map(packingQueueData.map(row => [String(row[queueHeaders.indexOf(G.HEADERS.PACKING_QUEUE_ORDER_NUMBER)]).trim(), row]));

        const ttlDays = 7;
        const now = new Date().getTime();
        const filteredOrders = [];

        ordersData.forEach(orderMRow => {
            const orderId = String(orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim();
            const orderNumber = String(orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_NUMBER)]).trim();
            const orderStatus = String(orderMRow[ordersHeaders.indexOf("status")]).toLowerCase().trim();
            
            if (!packingQueueMap.has(orderNumber)) { return; }

            let displayOrder = false;
            const logEntry = logMap.get(orderId);

            if (orderStatus === 'on-hold') { displayOrder = true; } 
            else if (orderStatus === 'processing' || orderStatus === 'completed') {
                if (!logEntry) { displayOrder = true; } 
                else {
                    const packingSlipStatus = String(logEntry[logHeaders.indexOf('packing_slip_status')]).trim().toLowerCase() || '';
                    const printDate = logEntry[logHeaders.indexOf('packing_print_date')];
                    if (packingSlipStatus !== 'printed') { displayOrder = true; } 
                    else if (printDate instanceof Date && ((now - printDate.getTime()) / (1000 * 60 * 60 * 24)) < ttlDays) {
                        displayOrder = true;
                    }
                }
            }
            if (displayOrder) { filteredOrders.push({ order: orderMRow, log: logEntry }); }
        });

        const outputRows = filteredOrders.map(entry => {
            const orderMRow = entry.order;
            const logEntry = entry.log;
            const orderNumber = orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_NUMBER)];
            const orderDateRaw = orderMRow[ordersHeaders.indexOf("order_date")];
            const orderDate = (orderDateRaw instanceof Date) ? Utilities.formatDate(orderDateRaw, Session.getScriptTimeZone(), "yyyy-MM-dd") : orderDateRaw;
            const status = orderMRow[ordersHeaders.indexOf("status")];
            const customerName = `${orderMRow[ordersHeaders.indexOf("shipping_first_name")]} ${orderMRow[ordersHeaders.indexOf("shipping_last_name")]}`.trim();
            const customerNote = orderMRow[ordersHeaders.indexOf("customer_note")];
            const packingSlipStatus = logEntry ? logEntry[logHeaders.indexOf('packing_slip_status')] : '';
            const printDate = logEntry ? logEntry[logHeaders.indexOf('packing_print_date')] : '';
            const printDateString = (printDate instanceof Date) ? Utilities.formatDate(printDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : printDate;
            return [false, orderDate, orderNumber, status, packingSlipStatus, printDateString, customerName, customerNote];
        });

        outputRows.sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime());
        return { status: 'success', data: outputRows };
    } catch (e) {
        return { status: 'error', message: `Server-side error getting packing data: ${e.message}` };
    }
}

/**
 * Reads the PackingDisplay sheet, finds selected orders, and generates documents.
 * This is a single, robust server-side operation.
 */
function processSelectedOrdersServer() {
  try {
    Logger.log("--- Starting processSelectedOrdersServer ---");

    // Step 1: Read the data from the local sheet.
    const sheetData = _client_getPackingDisplaySheetData();
    Logger.log(` -> Step 1: Read display sheet. Found ${Array.isArray(sheetData) ? sheetData.length : 'null/undefined'} rows.`);

    if (!Array.isArray(sheetData) || sheetData.length === 0) {
      throw new Error("Could not find any data in the PackingDisplay sheet.");
    }
    
    // Step 2: Find the selected rows.
    const selectedRows = sheetData.filter(row => row[0] === true);
    Logger.log(` -> Step 2: Filtered for selected rows. Found ${selectedRows.length} selected.`);

    if (selectedRows.length === 0) {
      Logger.log(" -> Decision: No rows were selected. Returning success message to client.");
      return { status: 'success', message: 'No orders were selected.' };
    }
    const ordersToProcess = selectedRows.map(row => String(row[2]).trim()); // Column C is the Order Number
    Logger.log(` -> Orders to process: [${ordersToProcess.join(', ')}]`);

    // Step 3: Call the existing document generation worker.
    Logger.log(" -> Step 3: Calling document generator (_server_generatePackingDocs)...");
    const result = _server_generatePackingDocs(ordersToProcess);
    Logger.log(" -> Document generator finished. Returning its result to the client.");
    
    // Step 4: Return the final result to the client.
    return result;

  } catch (e) {
    Logger.log(` -> FATAL ERROR in processSelectedOrdersServer: ${e.message}`);
    throw new Error(`Server Error: ${e.message}`);
  }
}