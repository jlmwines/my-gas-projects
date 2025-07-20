/**
 * @file Compare.gs
 * @description Implements the complete, user-defined comparison logic for VinSync,
 * including automatic task assignment based on rules in the 'TaskAssignments' sheet.
 * @version 25-07-17-1115
 */

// ======================= HELPER FUNCTIONS =======================

/**
 * Retrieves all data from a sheet (excluding the header) and maps it by a key column.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to read from.
 * @param {number} [keyColumnIndex=0] The zero-based index of the column to use as the key.
 * @returns {Object.<string, Array>} An object mapping keys to their corresponding row data.
 */
function getSheetData(sheet, keyColumnIndex = 0) {
    if (!sheet || sheet.getLastRow() < 2) return {}; // Handles empty or header-only sheets
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const dataMap = {};
    data.forEach(row => {
        const key = row[keyColumnIndex];
        if (key && String(key).trim()) {
            dataMap[String(key).trim()] = row;
        }
    });
    return dataMap;
}

/**
 * Logs an exception to the TaskQ sheet, automatically assigning it if a rule exists.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The 'TaskQ' sheet object.
 * @param {string} sessionId The unique ID for the current review session.
 * @param {string|number} entity The primary identifier of the item causing the exception (e.g., SKU).
 * @param {string} source The source sheet/system of the exception.
 * @param {string} type The specific exception code (e.g., 'Product Exception C6').
 * @param {string} priority The priority level ('High', 'Medium', 'Low').
 * @param {string} details A descriptive message explaining the exception.
 * @param {Object.<string, string>} assignmentRules A map of {ExceptionType: UserID} for auto-assignment.
 */
function logException(sheet, sessionId, entity, source, type, priority, details, assignmentRules) {
    const timestamp = new Date();
    let assignedTo = '';
    let status = 'Open';

    // Check if an assignment rule exists for this exception type
    if (assignmentRules && assignmentRules[type]) {
        assignedTo = assignmentRules[type];
        status = 'Assigned';
    }

    const rowData = [
        timestamp, sessionId, type, source, details, entity, status,
        priority, assignedTo, '', '', '', '' // status @ index 6, assignedTo @ index 8
    ];
    sheet.appendRow(rowData);
}

// ======================= MAIN COMPARISON FUNCTION =======================

/**
 * The main launcher for the entire product data review process.
 * Fetches data, compares it, and logs exceptions using the defined logic.
 * @returns {boolean} Returns true on success, false on user cancellation.
 */
function reviewProducts() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Confirm Data Review', 'Run data review and add new exceptions to the queue?', ui.ButtonSet.YES_NO);
    if (response != ui.Button.YES) return false;

    // Use activeConfig from Globals.gs to get file IDs
    const backendId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const referenceId = activeConfig.referenceFileId;
    const sessionId = new Date().toISOString().slice(11, 23).replace(/:/g, '').replace('T', '');

    try {
        const backendSS = SpreadsheetApp.openById(backendId);
        const referenceSS = SpreadsheetApp.openById(referenceId);
        const taskQueueSheet = referenceSS.getSheetByName('TaskQ');

        // Get all data sheets
        const webSSheet = backendSS.getSheetByName('WebS');
        const webMSheet = referenceSS.getSheetByName('WebM');
        const comaxSSheet = backendSS.getSheetByName('ComaxS');
        const comaxMSheet = referenceSS.getSheetByName('ComaxM');
        
        // --- NEW: Read the Task Assignment rules ---
        const assignmentSheet = referenceSS.getSheetByName('TaskAssignments');

        if (!webSSheet || !webMSheet || !comaxSSheet || !comaxMSheet || !taskQueueSheet || !assignmentSheet) {
            ui.alert('Error: One of the required sheets could not be found. Please check: WebS, WebM, ComaxS, ComaxM, TaskQ, TaskAssignments.');
            return;
        }

        // --- NEW: Create the assignment rules map ---
        const assignmentRules = {};
        if (assignmentSheet.getLastRow() > 1) {
            const assignmentData = assignmentSheet.getRange(2, 1, assignmentSheet.getLastRow() - 1, 2).getValues();
            assignmentData.forEach(row => {
                const taskType = row[0];
                const assignTo = row[1];
                if (taskType && assignTo && String(taskType).trim()) {
                    assignmentRules[String(taskType).trim()] = String(assignTo).trim();
                }
            });
        }

        // --- Read existing open exceptions to prevent duplicates ---
        const existingOpenExceptions = new Set();
        if (taskQueueSheet.getLastRow() >= 2) {
            const taskQueueData = taskQueueSheet.getRange(2, 1, taskQueueSheet.getLastRow() - 1, 7).getValues();
            taskQueueData.forEach(row => {
                const exceptionType = row[2];
                const entity = row[5];
                const status = row[6];
                if (status !== 'Closed' && entity) {
                    existingOpenExceptions.add(`${entity.toString().trim()}-${exceptionType}`);
                }
            });
        }

        // Get all data maps
        const webSDataById = getSheetData(webSSheet, 0);
        const webMDataById = getSheetData(webMSheet, 0);
        const comaxSDataBySku = getSheetData(comaxSSheet, 1);
        const comaxMDataBySku = getSheetData(comaxMSheet, 1);
        const webSDataBySku = getSheetData(webSSheet, 1);

        // --- WEB COMPARISON (A) ---
        for (const id in webSDataById) {
            const exceptionKey = `${(webSDataById[id][1] || id).toString().trim()}-Product Exception A1`;
            if (!webMDataById[id.trim()] && !existingOpenExceptions.has(exceptionKey)) logException(taskQueueSheet, sessionId, webSDataById[id][1] || id, 'WebS', 'Product Exception A1', 'High', `ID ${id} (${String(webSDataById[id][2]||'').substring(0,40)}...) found in staging, not in master.`, assignmentRules);
        }
        for (const id in webMDataById) {
            const exceptionKey = `${(webMDataById[id][1] || id).toString().trim()}-Product Exception A2`;
            if (!webSDataById[id.trim()] && !existingOpenExceptions.has(exceptionKey)) logException(taskQueueSheet, sessionId, webMDataById[id][1] || id, 'WebM', 'Product Exception A2', 'High', `ID ${id} (${String(webMDataById[id][2]||'').substring(0,40)}...) found in master, not in staging.`, assignmentRules);
        }
        for (const id in webMDataById) {
            const cleanId = id.trim();
            if (webSDataById[cleanId]) {
                const masterRow = webMDataById[cleanId],
                    stagingRow = webSDataById[cleanId],
                    entity = masterRow[1] || cleanId,
                    name = String(masterRow[2] || '').substring(0, 40);
                const entityKey = entity.toString().trim();

                if (String(masterRow[1] || '').trim() !== String(stagingRow[1] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception A3`)) logException(taskQueueSheet, sessionId, entity, 'WebS', 'Product Exception A3', 'High', `ID ${cleanId} (${name}...): Master/Staging SKU mismatch.`, assignmentRules);
                if (String(masterRow[2] || '').trim() !== String(stagingRow[2] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception A4`)) logException(taskQueueSheet, sessionId, entity, 'WebS', 'Product Exception A4', 'Medium', `ID ${cleanId} (${name}...): Master/Staging name mismatch.`, assignmentRules);
                if (String(masterRow[3] || '').trim() !== String(stagingRow[3] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception A5`)) logException(taskQueueSheet, sessionId, entity, 'WebS', 'Product Exception A5', 'High', `ID ${cleanId} (${name}...): Master/Staging publish status mismatch.`, assignmentRules);
            }
        }

        // --- COMAX COMPARISON (C) ---
        for (const sku in comaxMDataBySku) {
            const masterRow = comaxMDataBySku[sku];
            const exceptionKey = `${sku.trim()}-Product Exception C1`;
            if (String(masterRow[16] || '').trim() === 'כן' && !comaxSDataBySku[sku.trim()] && !existingOpenExceptions.has(exceptionKey)) logException(taskQueueSheet, sessionId, sku, 'ComaxM', 'Product Exception C1', 'Medium', `SKU ${sku} (${String(masterRow[2]||'').substring(0,40)}...) found in master, not in staging.`, assignmentRules);
        }
        for (const sku in comaxSDataBySku) {
            const cleanSku = sku.trim();
            const stagingRow = comaxSDataBySku[cleanSku],
                masterRow = comaxMDataBySku[cleanSku],
                isSellOnline = String(stagingRow[16] || '').trim() === 'כן';

            const crossFileKey = `${cleanSku}-Cross-File Exception E1`;
            if (!masterRow && isSellOnline && !webSDataBySku[cleanSku] && !existingOpenExceptions.has(crossFileKey)) logException(taskQueueSheet, sessionId, cleanSku, 'ComaxS', 'Cross-File Exception E1', 'High', `New SKU ${cleanSku} (${String(stagingRow[2]||'').substring(0,40)}...) is 'sell online' but not found in WebS.`, assignmentRules);

            if (masterRow) {
                if (isSellOnline || String(masterRow[16] || '').trim() === 'כן') {
                    const masterName = String(masterRow[2] || '').substring(0, 40);
                    const entity = cleanSku;
                    const entityKey = entity;

                    if (String(stagingRow[0] || '').trim() !== String(masterRow[0] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception C2`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', 'Product Exception C2', 'High', `SKU ${cleanSku} (${masterName}...): Master/Staging ID mismatch.`, assignmentRules);
                    if (String(stagingRow[2] || '').trim() !== String(masterRow[2] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception C3`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', 'Product Exception C3', 'Medium', `SKU ${cleanSku} (${masterName}...): Master/Staging name mismatch.`, assignmentRules);
                    if (String(stagingRow[4] || '').trim() !== String(masterRow[4] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception C4`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', 'Product Exception C4', 'Medium', `SKU ${cleanSku} (${masterName}...): Master/Staging group mismatch.`, assignmentRules);
                    if (String(stagingRow[8] || '').trim() !== String(masterRow[8] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception C5`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', 'Product Exception C5', 'Medium', `SKU ${cleanSku} (${masterName}...): Master/Staging size mismatch.`, assignmentRules);
                    if (String(stagingRow[10] || '').trim() !== String(masterRow[10] || '').trim() && !existingOpenExceptions.has(`${entityKey}-Product Exception C6`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', 'Product Exception C6', 'Medium', `SKU ${cleanSku} (${masterName}...): Master/Staging vintage mismatch.`, assignmentRules);
                }
            }
        }

        // --- DATA AUDITS (D) ---
        for (const sku in comaxSDataBySku) {
            const row = comaxSDataBySku[sku];
            const skuKey = sku.trim();

            if (String(row[17] || '').trim() && String(row[16] || '').trim() !== 'כן' && !existingOpenExceptions.has(`${skuKey}-Data Integrity Exception D1`)) logException(taskQueueSheet, sessionId, sku, 'ComaxS', 'Data Integrity Exception D1', 'Low', `SKU ${sku} (${String(row[2]||'').substring(0,40)}...) is Excluded but not marked Sell Online.`, assignmentRules);
            if (Number(row[15]) < 0 && !existingOpenExceptions.has(`${skuKey}-Inventory Exception D2`)) logException(taskQueueSheet, sessionId, sku, 'ComaxS', 'Inventory Exception D2', 'Medium', `Negative Inventory for SKU ${sku} (${String(row[2]||'').substring(0,40)}...).`, assignmentRules);
            if (String(row[12] || '').trim() && Number(row[15]) > 0 && !existingOpenExceptions.has(`${skuKey}-Inventory Exception D3`)) {
                const priority = String(row[16] || '').trim() === 'כן' ? 'High' : 'Medium';
                logException(taskQueueSheet, sessionId, sku, 'ComaxS', 'Inventory Exception D3', priority, `Archived item with stock for SKU ${sku} (${String(row[2]||'').substring(0,40)}...).`, assignmentRules);
            }
        }

        // --- CROSS-FILE VALIDATION (E) ---
        for (const sku in webSDataBySku) {
            const cleanSku = sku.trim();
            const webRow = webSDataBySku[cleanSku],
                comaxRow = comaxSDataBySku[cleanSku];

            const e2Key = `${cleanSku}-Cross-File Exception E2`;
            if (!comaxRow) {
                if (!existingOpenExceptions.has(e2Key)) logException(taskQueueSheet, sessionId, cleanSku, 'WebS', 'Cross-File Exception E2', 'High', `SKU ${cleanSku} (${String(webRow[2]||'').substring(0,40)}...) exists in WebS but is missing from ComaxS.`, assignmentRules);
            } else {
                const webMRow = webMDataById[webRow[0]];
                const e3Key = `${cleanSku}-Cross-File Exception E3`;
                if (webMRow && String(webMRow[3] || '').trim() === 'published' && String(comaxRow[16] || '').trim() !== 'כן') {
                    if (!existingOpenExceptions.has(e3Key)) logException(taskQueueSheet, sessionId, cleanSku, 'WebS/ComaxS', 'Cross-File Exception E3', 'Medium', `SKU ${cleanSku} (${String(webRow[2]||'').substring(0,40)}...) is Published on Web but not marked Sell Online in Comax.`, assignmentRules);
                }
            }
        }

        SpreadsheetApp.flush();
        ui.alert('Product review is complete.');
        return true;

    } catch (e) {
        Logger.log(e);
        ui.alert('An error occurred during product review: ' + e.message);
    }
}
