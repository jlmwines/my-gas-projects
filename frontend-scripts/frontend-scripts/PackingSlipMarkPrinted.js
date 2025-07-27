/**
 * @file PackingSlipMarkPrinted.gs
 * @description Marks orders as printed in the OrderLog after the user confirms printing of a consolidated document.
 * @version 25-07-23-0754
 * @environment Frontend
 */

/**
 * Marks a batch of orders as printed by updating their entry in the OrderLog.
 * This function is called via the confirmation button in the consolidated document dialog.
 *
 * @param {string[]} orderIds An array of order IDs to be marked as printed.
 * @returns {boolean} True if the update was successful, otherwise false.
 */
function markOrdersAsPrinted(orderIds) {
    if (!orderIds || orderIds.length === 0) {
        return false;
    }

    try {
        const orderLog_sheet = getReferenceSheet(G.SHEET_NAMES.ORDERLOG);
        
        // Get all data and headers in one go for efficiency
        const orderLogRange = orderLog_sheet.getDataRange();
        const orderLogData = orderLogRange.getValues();
        const headers = orderLogData.shift();

        const orderIdIndex = headers.indexOf("order_id");
        const printedDateIndex = headers.indexOf("packing_print_date");
        const statusIndex = headers.indexOf("packing_slip_status");
        
        if (orderIdIndex === -1 || printedDateIndex === -1 || statusIndex === -1) {
            throw new Error("OrderLog headers are missing 'order_id', 'packing_print_date', or 'packing_slip_status'.");
        }

        const now = new Date();
        let ordersUpdatedCount = 0;
        
        const updatedData = orderLogData.map(row => {
            const currentOrderId = String(row[orderIdIndex]).trim();
            // Check if the current row's order ID is in the list of orders to update
            if (orderIds.includes(currentOrderId)) {
                row[printedDateIndex] = now;
                row[statusIndex] = 'Printed';
                ordersUpdatedCount++;
            }
            return row;
        });

        // Write the entire updated data array back to the sheet in one batch operation
        orderLogRange.setValues([headers, ...updatedData]);

        SpreadsheetApp.getActiveSpreadsheet().toast(`Successfully marked ${ordersUpdatedCount} orders as printed.`, "Update Complete", 5);
        return true;

    } catch (e) {
        Logger.log(`Failed to mark orders as printed: ${e.message}`);
        SpreadsheetApp.getUi().alert("Error: Failed to mark orders as printed. Check logs for details.");
        return false;
    }
}