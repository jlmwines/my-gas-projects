/**
 * @file OrderProcessing.gs
 * @description Handles merging orders, updating logs, and exporting for Comax.
 * @version 2025-07-27-1425
 */

/**
 * Merges staging orders to the master sheet, updates the OrderLog,
 * and then triggers the preparation of packing data.
 */
function mergeOrders() {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const backendSS = SpreadsheetApp.getActiveSpreadsheet();

    const ordersS_sheet = backendSS.getSheetByName("OrdersS");
    const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
    const orderLog_sheet = referenceSS.getSheetByName("OrderLog");

    const ordersS_data = ordersS_sheet.getDataRange().getValues();
    if (ordersS_data.length < 2) {
        return "Staging sheet 'OrdersS' is empty. No orders to merge.";
    }

    // --- Merge OrdersS into OrdersM ---
    const ordersM_data = ordersM_sheet.getDataRange().getValues();
    const s_headers = ordersS_data.shift();
    const m_headers = ordersM_data.shift();
    const s_orderIdCol = s_headers.indexOf('order_id');
    const m_orderIdCol = m_headers.indexOf('order_id');
    const masterMap = new Map(ordersM_data.map(row => [row[m_orderIdCol], row]));
    ordersS_data.forEach(row => {
        masterMap.set(row[s_orderIdCol], row);
    });
    const finalMasterData = [m_headers, ...Array.from(masterMap.values())];
    ordersM_sheet.getRange(1, 1, finalMasterData.length, finalMasterData[0].length).setValues(finalMasterData);

    // --- Update OrderLog with new orders ---
    const orderLog_data = orderLog_sheet.getDataRange().getValues();
    const log_headers = orderLog_data.shift();
    const log_orderIdCol = log_headers.indexOf('order_id');
    const log_orderDateCol = log_headers.indexOf('order_date'); // Assuming 'order_date' exists for new entries

    const existingLogIds = new Set(orderLog_data.map(row => row[log_orderIdCol]));
    const newLogEntries = [];

    ordersS_data.forEach(s_row => {
        const orderId = s_row[s_orderIdCol];
        if (!existingLogIds.has(orderId)) {
            const orderDate = s_row[s_headers.indexOf('order_date')];
            const newEntry = Array(log_headers.length).fill('');
            newEntry[log_orderIdCol] = orderId;
            newEntry[log_orderDateCol] = orderDate;
            newLogEntries.push(newEntry);
        }
    });

    if (newLogEntries.length > 0) {
        orderLog_sheet.getRange(orderLog_sheet.getLastRow() + 1, 1, newLogEntries.length, newLogEntries[0].length).setValues(newLogEntries);
    }

    // --- Trigger subsequent processes ---
    try {
        preparePackingData(); // This function prepares data for the frontend
        Logger.log("Packing slip data prepared successfully.");
    } catch (e) {
        Logger.log(`Failed to prepare packing slip data: ${e.message}`);
        SpreadsheetApp.getUi().alert("Warning: Order merge succeeded, but failed to prepare packing slip data.");
    }

    return `Merge complete. ${ordersS_data.length} orders processed. ${newLogEntries.length} new entries added to OrderLog.`;
}


/**
 * Aggregates and exports orders that have not been previously exported for Comax.
 */
function exportOrdersForComax() {
    try {
        const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
        const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
        const orderLog_sheet = referenceSS.getSheetByName("OrderLog");

        const orderLog_data = orderLog_sheet.getDataRange().getValues();
        const log_headers = orderLog_data.shift();
        const log_orderIdCol = log_headers.indexOf('order_id');
        const log_exportStatusCol = log_headers.indexOf('comax_export_status');

        if (log_exportStatusCol === -1) {
            throw new Error("Missing 'comax_export_status' column in OrderLog.");
        }

        const eligibleLogEntries = orderLog_data.filter(row => row[log_exportStatusCol] === '');
        const eligibleOrderIdSet = new Set(eligibleLogEntries.map(row => row[log_orderIdCol]));

        if (eligibleOrderIdSet.size === 0) {
            SpreadsheetApp.getUi().alert("No new orders are ready for export.");
            return;
        }

        const ordersM_data = ordersM_sheet.getDataRange().getValues();
        const m_headers = ordersM_data.shift();
        const m_orderIdCol = m_headers.indexOf('order_id');
        const m_statusCol = m_headers.indexOf('status');

        const ordersToExport = ordersM_data.filter(row => {
            const status = row[m_statusCol];
            const isEligible = eligibleOrderIdSet.has(row[m_orderIdCol]);
            return isEligible && (status === 'processing' || status === 'completed');
        });

        if (ordersToExport.length === 0) {
            SpreadsheetApp.getUi().alert("No new orders with status 'processing' or 'completed' to export.");
            return;
        }

        const ui = SpreadsheetApp.getUi();
        const response = ui.alert('Confirm Comax Export',`This will export a summary for ${ordersToExport.length} orders. Continue?`, ui.ButtonSet.YES_NO);
        if (response !== ui.Button.YES) return "User cancelled export.";

        const skuTotals = new Map();
        const skuQtyCols = [];
        for (let i = 1; i <= 24; i++) {
            const skuCol = m_headers.indexOf(`Product Item ${i} SKU`);
            const qtyCol = m_headers.indexOf(`Product Item ${i} Quantity`);
            if (skuCol > -1 && qtyCol > -1) {
                skuQtyCols.push({ sku: skuCol, qty: qtyCol });
            }
        }

        ordersToExport.forEach(order => {
            skuQtyCols.forEach(cols => {
                const sku = order[cols.sku];
                const quantity = parseInt(order[cols.qty], 10);
                if (sku && !isNaN(quantity) && quantity > 0) {
                    skuTotals.set(sku, (skuTotals.get(sku) || 0) + quantity);
                }
            });
        });

        if (skuTotals.size === 0) throw new Error("No valid line items found in the eligible orders.");

        const csvData = [["SKU", "Quantity"]];
        skuTotals.forEach((qty, sku) => csvData.push([sku, qty]));
        const csvContent = csvData.map(e => e.join(",")).join("\n");
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd-HH-mm");
        const filename = `OrderEx-${timestamp}.csv`;
        const exportFolder = DriveApp.getFolderById(activeConfig.comaxExportFolderId);
        exportFolder.createFile(filename, csvContent, MimeType.CSV);

        // Update the OrderLog in memory
        const exportedIdsThisRun = new Set(ordersToExport.map(row => row[m_orderIdCol]));
        const now = new Date();
        orderLog_data.forEach(row => {
            if (exportedIdsThisRun.has(row[log_orderIdCol])) {
                row[log_exportStatusCol] = now;
            }
        });

        // Write the entire updated log back to the sheet
        orderLog_sheet.getRange(2, 1, orderLog_data.length, log_headers.length).setValues(orderLog_data);

        return `Export successful. ${ordersToExport.length} orders aggregated into ${filename}.`;

    } catch (e) {
        Logger.log(`exportOrdersForComax failed: ${e.message}`);
        SpreadsheetApp.getUi().alert(`Export failed: ${e.message}`);
    }
}