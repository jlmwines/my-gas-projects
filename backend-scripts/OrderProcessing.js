/**
 * @file OrderProcessing.gs
 * @description Handles merging of staging orders, on-hold inventory calculation, and aggregated export for Comax.
 * @version 25-07-23-0627
 */

/**
 * Merges orders from the staging sheet (OrdersS) to the master sheet (OrdersM),
 * then updates the on-hold inventory summary.
 *
 * @returns {string} A summary of the operation.
 */
function mergeOrders() {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const backendSS = SpreadsheetApp.getActiveSpreadsheet();
    const ordersS_sheet = backendSS.getSheetByName("OrdersS");
    const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
    const sRange = ordersS_sheet.getDataRange();
    const mRange = ordersM_sheet.getDataRange();
    const ordersS_data = sRange.getValues();
    const ordersM_data = mRange.getValues();

    if (ordersS_data.length < 2) {
        return "Staging sheet 'OrdersS' is empty. No orders to merge.";
    }

    const s_headers = ordersS_data.shift();
    const m_headers = ordersM_data.shift();
    const s_orderIdCol = s_headers.indexOf('order_id');
    const s_orderNumCol = s_headers.indexOf('order_number');
    const m_orderIdCol = m_headers.indexOf('order_id');
    const m_orderNumCol = m_headers.indexOf('order_number');
    const m_statusCol = m_headers.indexOf('status');

    const stagingOrderNumbers = ordersS_data.map(row => row[s_orderNumCol]).filter(n => n);
    const stagingIdSet = new Set(ordersS_data.map(row => row[s_orderIdCol]));

    if (stagingOrderNumbers.length === 0) {
        return "No valid order numbers found in staging sheet.";
    }

    const minOrderNum = Math.min(...stagingOrderNumbers);
    const maxOrderNum = Math.max(...stagingOrderNumbers);
    const masterMap = new Map();

    ordersM_data.forEach(row => {
        const masterOrderNum = row[m_orderNumCol];
        const masterOrderId = row[m_orderIdCol];
        if (masterOrderNum >= minOrderNum && masterOrderNum <= maxOrderNum && !stagingIdSet.has(masterOrderId)) {
            let newRow = [...row];
            newRow[m_statusCol] = 'deleted';
            masterMap.set(masterOrderId, newRow);
        } else {
            masterMap.set(masterOrderId, row);
        }
    });

    ordersS_data.forEach(row => {
        const stagingOrderId = row[s_orderIdCol];
        masterMap.set(stagingOrderId, row);
    });
    
    const finalMasterData = [m_headers, ...Array.from(masterMap.values())];
    mRange.clearContent();
    ordersM_sheet.getRange(1, 1, finalMasterData.length, finalMasterData[0].length).setValues(finalMasterData);
    
    // --- NEW: Update the On-Hold Inventory Summary ---
    try {
        updateOnHoldInventorySummary();
        Logger.log("On-hold inventory summary updated successfully.");
    } catch(e) {
        Logger.log(`Failed to update on-hold inventory summary: ${e.message}`);
        SpreadsheetApp.getUi().alert("Warning: Order merge succeeded, but failed to update the on-hold inventory summary.");
    }
    // REVISED: Call the new data preparation function instead of the old generation function
    try {
        preparePackingData();
        Logger.log("Packing slip data prepared successfully.");
    } catch (e) {
        Logger.log(`Failed to prepare packing slip data: ${e.message}`);
        SpreadsheetApp.getUi().alert("Warning: Order merge succeeded, but failed to prepare packing slip data.");
    }
    
    return `Merge complete. Master sheet ('OrdersM') now contains ${masterMap.size} records.`;
}

/**
 * Scans the master orders sheet, aggregates all items from 'on-hold' orders,
 * and overwrites the 'OnHoldInventory' sheet with the summary.
 */
function updateOnHoldInventorySummary() {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
    const onHoldSheet = referenceSS.getSheetByName("OnHoldInventory");

    if (!onHoldSheet) {
        throw new Error("The 'OnHoldInventory' summary sheet was not found.");
    }

    const ordersM_data = ordersM_sheet.getDataRange().getValues();
    const m_headers = ordersM_data.shift();

    const statusCol = m_headers.indexOf('status');
    
    // Find all orders with 'on-hold' status
    const onHoldOrders = ordersM_data.filter(row => row[statusCol] === 'on-hold');

    const skuTotals = new Map();
    // Find SKU and Quantity column indices dynamically
    const skuQtyCols = [];
    for (let i = 1; i <= 24; i++) {
        const skuCol = m_headers.indexOf(`Product Item ${i} SKU`);
        const qtyCol = m_headers.indexOf(`Product Item ${i} Quantity`);
        if (skuCol > -1 && qtyCol > -1) {
            skuQtyCols.push({ sku: skuCol, qty: qtyCol });
        }
    }

    // Aggregate quantities for each SKU from on-hold orders
    onHoldOrders.forEach(order => {
        skuQtyCols.forEach(cols => {
            const sku = order[cols.sku];
            const quantity = parseInt(order[cols.qty], 10);
            if (sku && !isNaN(quantity) && quantity > 0) {
                skuTotals.set(sku, (skuTotals.get(sku) || 0) + quantity);
            }
        });
    });

    const summaryData = [["SKU", "OnHoldQuantity"]];
    skuTotals.forEach((qty, sku) => {
        summaryData.push([sku, qty]);
    });
    
    // Overwrite the summary sheet with the new data
    onHoldSheet.clear();
    onHoldSheet.getRange(1, 1, summaryData.length, 2).setValues(summaryData);
}

// The export function remains unchanged, but is included for completeness
function exportOrdersForComax() {
    try {
        const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
        const ordersM_sheet = referenceSS.getSheetByName("OrdersM");
        const orderLog_sheet = referenceSS.getSheetByName("OrderLog");
        const ordersM_data = ordersM_sheet.getDataRange().getValues();
        const orderLog_data = orderLog_sheet.getDataRange().getValues();
        const m_headers = ordersM_data.shift();
        const exportedOrderIdSet = new Set(orderLog_data.slice(1).map(row => row[0]));
        const statusCol = m_headers.indexOf('status');
        const orderIdCol = m_headers.indexOf('order_id');
        const orderDateCol = m_headers.indexOf('order_date');

        const eligibleOrders = ordersM_data.filter(row => {
            const isProcessOrComp = row[statusCol] === 'processing' || row[statusCol] === 'completed';
            const notExported = !exportedOrderIdSet.has(row[orderIdCol]);
            return isProcessOrComp && notExported;
        });

        if (eligibleOrders.length === 0) {
            SpreadsheetApp.getUi().alert("No new orders are ready for export.");
            return "No new orders with status 'processing' or 'completed' to export.";
        }

        const ui = SpreadsheetApp.getUi();
        const response = ui.alert(
            'Confirm Comax Export',
            `This will export a summary for ${eligibleOrders.length} orders and mark them as exported. Are you sure you want to continue?`,
            ui.ButtonSet.YES_NO
        );

        if (response !== ui.Button.YES) {
            throw new Error("User cancelled the export.");
        }

        const skuTotals = new Map();
        const skuQtyCols = [];
        for (let i = 1; i <= 24; i++) {
            const skuCol = m_headers.indexOf(`Product Item ${i} SKU`);
            const qtyCol = m_headers.indexOf(`Product Item ${i} Quantity`);
            if (skuCol > -1 && qtyCol > -1) {
                skuQtyCols.push({ sku: skuCol, qty: qtyCol });
            }
        }

        eligibleOrders.forEach(order => {
            skuQtyCols.forEach(cols => {
                const sku = order[cols.sku];
                const quantity = parseInt(order[cols.qty], 10);
                if (sku && !isNaN(quantity) && quantity > 0) {
                    skuTotals.set(sku, (skuTotals.get(sku) || 0) + quantity);
                }
            });
        });

        if (skuTotals.size === 0) {
            throw new Error("No valid line items with quantity found in the eligible orders.");
        }

        const csvData = [["SKU", "Quantity"]];
        skuTotals.forEach((qty, sku) => {
            csvData.push([sku, qty]);
        });
        const csvContent = csvData.map(e => e.join(",")).join("\n");
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM-dd-HH-mm");
        const filename = `OrderEx-${timestamp}.csv`;
        const exportFolder = DriveApp.getFolderById(activeConfig.comaxExportFolderId);
        exportFolder.createFile(filename, csvContent, MimeType.CSV);

        const newLogEntries = eligibleOrders.map(order => {
            const orderId = order[orderIdCol];
            const orderDate = order[orderDateCol];
            return [orderId, orderDate, null, null, new Date()];
        });

        orderLog_sheet.getRange(orderLog_sheet.getLastRow() + 1, 1, newLogEntries.length, newLogEntries[0].length).setValues(newLogEntries);

        return `Export successful. ${eligibleOrders.length} orders aggregated into ${filename}.`;

    } catch (e) {
        Logger.log(`exportOrdersForComax failed: ${e.message}`);
        throw new Error(e.message);
    }
}