/**
 * @file Inventory.gs — Grouped Inventory Task Controller
 * @description Manages the inventory counting workflow for tasks assigned in TaskQ.
 * @version 2025-07-29-1730 // Updated version number
 */

/**
 * Populates the Inventory sheet with tasks from TaskQ.
 * RENAMED: Removed leading underscore to make it callable from the client.
 */
function server_populateInventory(selectedFilterUser) {
    try {
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);

        const taskqData = taskqSheet.getDataRange().getValues();
        const comaxData = comaxSheet.getDataRange().getValues();
        const auditData = auditSheet.getDataRange().getValues();

        const inventoryTasks = taskqData.filter(taskRow => {
            const assignedTo = String(taskRow[G.COLUMN_INDICES.TASKQ.ASSIGNED_TO - 1] || '').trim().toLowerCase();
            const status = String(taskRow[G.COLUMN_INDICES.TASKQ.STATUS - 1] || '').trim().toLowerCase();
            const type = String(taskRow[G.COLUMN_INDICES.TASKQ.TYPE - 1] || '').trim().toLowerCase();

            const userMatch = (selectedFilterUser && selectedFilterUser.toLowerCase() !== 'all users') ?
                (assignedTo === selectedFilterUser.toLowerCase()) : true;

            const relevantTypes = ['inventory count', 'inventory exception d2'];
            const typeMatch = relevantTypes.includes(type);

            return userMatch && status === 'assigned' && typeMatch;
        });

        if (inventoryTasks.length === 0) {
            return { status: 'success', data: [], message: `No open inventory tasks assigned to ${selectedFilterUser || 'all users'}.` };
        }

        const requiredSkus = new Set(inventoryTasks.map(task => String(task[G.COLUMN_INDICES.TASKQ.RELATED_ENTITY - 1] || '').trim().toLowerCase()));
        const comaxMap = new Map(comaxData.slice(1).map(r => {
            const sku = String(r[1] || '').trim().toLowerCase();
            return sku ? [sku, { id: r[0], name: r[2], stock: r[15] || 0 }] : null;
        }).filter(Boolean));

        const auditMap = new Map(auditData.slice(1).map(r => {
            const sku = String(r[G.COLUMN_INDICES.AUDIT.SKU - 1] || '').trim().toLowerCase();
            return sku ? [sku, { brurya: r[G.COLUMN_INDICES.AUDIT.BRURYA_QTY - 1] || 0 }] : null;
        }).filter(Boolean));

        let rowsToWrite = Array.from(requiredSkus).map(sku => {
            const comaxProduct = comaxMap.get(sku);
            const auditInfo = auditMap.get(sku);
            if (comaxProduct) {
                // Headers: ["Name", "ID", "SKU", "Stock", "Difference", "TotalQty", "BruryaQty", "StorageQty", "OfficeQty", "ShopQty"]
                // We provide data for: Name, ID, SKU, Stock, (skip 3), BruryaQty, (skip 3)
                return [comaxProduct.name, comaxProduct.id, sku, comaxProduct.stock, '', '', auditInfo?.brurya || 0, '', '', ''];
            }
            return null;
        }).filter(Boolean);

        rowsToWrite.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

        return { status: 'success', data: rowsToWrite };
    } catch (e) {
        Logger.log(`[ERROR] server_populateInventory: ${e.message} Stack: ${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Submits inventory counts and updates task statuses.
 * LOGIC UPDATED: No longer depends on activeUser. Updates any matching assigned task.
 */
function server_submitInventory(inventoryUpdates) {
    try {
        if (!inventoryUpdates || inventoryUpdates.length === 0) throw new Error('No Inventory data was provided.');

        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);

        // --- 1. Update Audit Sheet ---
        const submittedSkus = new Set(inventoryUpdates.map(item => String(item.sku).trim().toLowerCase()));
        const auditData = auditSheet.getDataRange().getValues();
        const auditSkuMap = new Map(auditData.slice(1).map((row, i) => [String(row[G.COLUMN_INDICES.AUDIT.SKU - 1]).trim().toLowerCase(), i + 1]));

        inventoryUpdates.forEach(update => {
            const skuLower = String(update.sku).trim().toLowerCase();
            if (auditSkuMap.has(skuLower)) {
                const rowIndex = auditSkuMap.get(skuLower);
                const newTotalQty = (Number(update.brurya) || 0) + (Number(update.storage) || 0) + (Number(update.office) || 0) + (Number(update.shop) || 0);
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.BRURYA_QTY - 1] = Number(update.brurya) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.STORAGE_QTY - 1] = Number(update.storage) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.OFFICE_QTY - 1] = Number(update.office) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.SHOP_QTY - 1] = Number(update.shop) || 0;
                auditData[rowIndex][G.COLUMN_INDICES.AUDIT.NEW_QTY - 1] = newTotalQty;
            }
        });
        auditSheet.getRange(1, 1, auditData.length, auditData[0].length).setValues(auditData);
        Logger.log('Audit sheet updated successfully.');

        // --- 2. Update TaskQ Sheet ---
        const taskqData = taskqSheet.getDataRange().getValues();
        let tasksUpdated = false;

        for (let i = 1; i < taskqData.length; i++) {
            const taskRow = taskqData[i];
            const assignedTo = String(taskRow[G.COLUMN_INDICES.TASKQ.ASSIGNED_TO - 1] || '').trim().toLowerCase();
            const relatedSku = String(taskRow[G.COLUMN_INDICES.TASKQ.RELATED_ENTITY - 1] || '').trim().toLowerCase();
            const status = String(taskRow[G.COLUMN_INDICES.TASKQ.STATUS - 1] || '').trim().toLowerCase();

            if (submittedSkus.has(relatedSku)) {
                Logger.log(`Checking TaskQ row ${i + 1}: SKU='${relatedSku}', AssignedTo='${assignedTo}', Status='${status}'`);
                // UPDATED CONDITION: Only checks for status, ignoring the user.
                if (status === 'assigned') {
                    taskRow[G.COLUMN_INDICES.TASKQ.STATUS - 1] = 'Review';
                    tasksUpdated = true;
                    Logger.log(`  ✅ SUCCESS: Matched SKU and status. Updated status to 'Review'.`);
                } else {
                    Logger.log(`  ⚠️ MISMATCH: SKU matched, but status was not 'assigned'.`);
                }
            }
        }

        if (tasksUpdated) {
            taskqSheet.getRange(1, 1, taskqData.length, taskqData[0].length).setValues(taskqData);
            Logger.log('TaskQ sheet updated successfully.');
            return { status: 'success', message: 'Inventory counts submitted and tasks moved to Review.' };
        } else {
            Logger.log('No matching tasks were found in TaskQ to update.');
            return { status: 'success', message: 'Counts submitted, but no open tasks were found for this user and these products.' };
        }

    } catch (e) {
        Logger.log(`[ERROR] server_submitInventory: ${e.message} Stack: ${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Quickly gets the count of available product count tasks for all users.
 * Used to initialize the sidebar. This is a lightweight wrapper.
 */
function _server_getProductCountTasks() {
    try {
        // This calls the main server function that gathers the full list of inventory tasks for all users.
        const fullTaskList = server_populateInventory('All Users'); 

        // We check the 'data' property of the returned object...
        const count = fullTaskList.data ? fullTaskList.data.length : 0;
        
        // ...and only return the count, not the full dataset.
        return { status: 'success', data: { count: count } };

    } catch (e) {
        Logger.log(`_server_getProductCountTasks Error: ${e.message}`);
        return { status: 'error', message: e.message, data: { count: 0 } };
    }
}
