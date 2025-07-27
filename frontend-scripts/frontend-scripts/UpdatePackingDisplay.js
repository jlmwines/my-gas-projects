/**
 * @file updatePackingDisplay.gs
 * @description Updates the PackingDisplay sheet with a filtered list of orders ready for consolidation or reprint.
 * @version 25-07-23-1140
 * @environment Frontend
 */

/**
 * Updates the PackingDisplay sheet with a list of orders that are
 * either on-hold or recently created but not yet marked as printed.
 */
function updatePackingDisplay() {
    const ui = SpreadsheetApp.getUi();
    const frontendSS = SpreadsheetApp.getActiveSpreadsheet();
    const displaySheet = frontendSS.getSheetByName(G.SHEET_NAMES.PACKING_DISPLAY) || frontendSS.insertSheet(G.SHEET_NAMES.PACKING_DISPLAY);

    displaySheet.clearContents();
    const allDataRange = displaySheet.getRange('A1:Z1000');
    allDataRange.clearDataValidations();

    try {
        const referenceSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const ordersM_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDERS_M);
        const orderLog_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.ORDER_LOG);
        const packingQueue_sheet = referenceSS.getSheetByName(G.SHEET_NAMES.PACKING_QUEUE);

        if (!ordersM_sheet || !orderLog_sheet || !packingQueue_sheet) {
            ui.alert("Error: One or more required sheets are missing in the Reference file.");
            SpreadsheetApp.flush();
            return;
        }

        const ordersData = ordersM_sheet.getDataRange().getValues();
        const ordersHeaders = ordersData.shift();
        Logger.log(`Found ${ordersData.length} rows in OrdersM.`);
        Logger.log(`OrdersM Headers: ${ordersHeaders.join(', ')}`);

        const orderLogData = orderLog_sheet.getDataRange().getValues();
        const logHeaders = orderLogData.shift();
        Logger.log(`Found ${orderLogData.length} rows in OrderLog.`);
        Logger.log(`OrderLog Headers: ${logHeaders.join(', ')}`);
        const logMap = new Map(orderLogData.map(row => [String(row[logHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim(), row]));

        const packingQueueData = packingQueue_sheet.getDataRange().getValues();
        const queueHeaders = packingQueueData.shift();
        Logger.log(`Found ${packingQueueData.length} rows in PackingQueue.`);
        Logger.log(`PackingQueue Headers: ${queueHeaders.join(', ')}`);
        const packingQueueMap = new Map(packingQueueData.map(row => [String(row[queueHeaders.indexOf(G.HEADERS.PACKING_QUEUE_ORDER_NUMBER)]).trim(), row]));

        const ttlDays = 7;
        const now = new Date().getTime();

        const filteredOrders = [];

        ordersData.forEach(orderMRow => {
            const orderId = String(orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_ID)]).trim();
            const orderNumber = String(orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_NUMBER)]).trim();
            const orderStatus = String(orderMRow[ordersHeaders.indexOf("status")]).toLowerCase().trim();

            Logger.log(`--- Processing Order ID: ${orderId}, Order Number: ${orderNumber}, Status: ${orderStatus} ---`);

            const packingEntry = packingQueueMap.get(orderNumber);
            if (!packingEntry) {
                Logger.log(`Skipping order ${orderNumber}: No entry found in PackingQueue.`);
                return;
            } else {
                 Logger.log(`Found packing entry for order ${orderNumber}.`);
            }

            const logEntry = logMap.get(orderId);
            if (!logEntry) {
                Logger.log(`No log entry found for order ${orderNumber}. It's a new order.`);
            } else {
                 Logger.log(`Found log entry for order ${orderNumber}.`);
            }

            let displayOrder = false;

            if (orderStatus === 'on-hold') {
                displayOrder = true;
                Logger.log(`Order ${orderNumber} included because status is 'on-hold'.`);
            } else if (orderStatus === 'processing' || orderStatus === 'completed') {
                if (!logEntry) {
                    displayOrder = true;
                    Logger.log(`Order ${orderNumber} included because no log entry exists.`);
                } else {
                    const packingSlipStatus = String(logEntry[logHeaders.indexOf('packing_slip_status')]).trim().toLowerCase() || '';
                    const printDate = logEntry[logHeaders.indexOf('packing_print_date')];
                    Logger.log(`Log data for ${orderNumber}: Status='${packingSlipStatus}', Print Date='${printDate}'`);

                    if (packingSlipStatus !== 'printed') {
                        displayOrder = true;
                        Logger.log(`Order ${orderNumber} included because packing_slip_status is not 'printed'.`);
                    } else if (printDate instanceof Date) {
                        const daysSincePrint = (now - printDate.getTime()) / (1000 * 60 * 60 * 24);
                        if (daysSincePrint < ttlDays) {
                            displayOrder = true;
                            Logger.log(`Order ${orderNumber} included because it was printed within the last ${ttlDays} days.`);
                        } else {
                            Logger.log(`Order ${orderNumber} excluded: Printed more than ${ttlDays} days ago.`);
                        }
                    } else {
                         Logger.log(`Order ${orderNumber} excluded: Print date is not a valid date object.`);
                    }
                }
            } else {
                 Logger.log(`Order ${orderNumber} excluded due to status: ${orderStatus}`);
            }

            if (displayOrder) {
                filteredOrders.push({ order: orderMRow, log: logEntry, queue: packingEntry });
            }
        });

        Logger.log(`Final count of filtered orders: ${filteredOrders.length}`);

        const outputHeaders = ["Select", "Order Date", "Order Number", "Status", "Packing Slip", "Print Date", "Customer Name", "Customer Note"];
        const outputRows = filteredOrders.map(entry => {
            const orderMRow = entry.order;
            const logEntry = entry.log;

            // Corrected this line to get order number and date correctly
            const orderNumber = orderMRow[ordersHeaders.indexOf(G.HEADERS.ORDER_NUMBER)];
            const orderDate = orderMRow[ordersHeaders.indexOf("order_date")];
            const status = orderMRow[ordersHeaders.indexOf("status")];
            const customerName = `${orderMRow[ordersHeaders.indexOf("shipping_first_name")]} ${orderMRow[ordersHeaders.indexOf("shipping_last_name")]}`.trim();
            const customerNote = orderMRow[ordersHeaders.indexOf("customer_note")];

            const packingSlipStatus = logEntry ? logEntry[logHeaders.indexOf('packing_slip_status')] : '';
            const printDate = logEntry ? logEntry[logHeaders.indexOf('packing_print_date')] : '';
            const printDateString = (printDate instanceof Date) ? Utilities.formatDate(printDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : printDate;

            return [false, orderDate, orderNumber, status, packingSlipStatus, printDateString, customerName, customerNote];
        });

        outputRows.sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime());

        if (outputRows.length > 0) {
            displaySheet.getRange(1, 1, 1, outputHeaders.length).setValues([outputHeaders]);
            displaySheet.getRange(2, 1, outputRows.length, outputHeaders.length).setValues(outputRows);
            const checkboxRange = displaySheet.getRange(2, 1, outputRows.length, 1);
            checkboxRange.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
        } else {
            displaySheet.getRange(1, 1, 1, outputHeaders.length).setValues([outputHeaders]);
            displaySheet.getRange(2, 5).setValue("No orders to display.");
        }

        displaySheet.autoResizeColumns(2, outputHeaders.length);
        displaySheet.setColumnWidth(1, 35);
        displaySheet.setColumnWidth(8, 100);
        frontendSS.setActiveSheet(displaySheet);
        displaySheet.getRange('A2').activate();

        SpreadsheetApp.flush();
        ui.alert("Packing Display updated.");

    } catch (e) {
        Logger.log(`Error updating PackingDisplay: ${e.message}`);
        ui.alert(`An error occurred: ${e.message}`);
    }
}