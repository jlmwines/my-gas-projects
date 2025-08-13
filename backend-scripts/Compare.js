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
        assignedTo = assignmentRules[type].assignee;
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

    // --- Task Type Constants (Declared once at the beginning to fix syntax error) ---
    const TASK_TYPE_A1 = 'Product Exception A1';
    const TASK_TYPE_A2 = 'Product Exception A2';
    const TASK_TYPE_A3 = 'Product Exception A3';
    const TASK_TYPE_A4 = 'Product Exception A4';
    const TASK_TYPE_A5 = 'Product Exception A5';
    const TASK_TYPE_C1 = 'Product Exception C1';
    const TASK_TYPE_C2 = 'Product Exception C2';
    const TASK_TYPE_C3 = 'Product Exception C3';
    const TASK_TYPE_C4 = 'Product Exception C4';
    const TASK_TYPE_C5 = 'Product Exception C5';
    const TASK_TYPE_C6 = 'Product Exception C6';
    const TASK_TYPE_D1 = 'Data Integrity Exception D1';
    const TASK_TYPE_D2 = 'Inventory Exception D2';
    const TASK_TYPE_D3 = 'Inventory Exception D3';
    const TASK_TYPE_E1 = 'Cross-File Exception E1';
    const TASK_TYPE_E2 = 'Cross-File Exception E2';
    const TASK_TYPE_E3 = 'Cross-File Exception E3';

    try {
        const backendSS = SpreadsheetApp.openById(backendId);
        const referenceSS = SpreadsheetApp.openById(referenceId);
        const taskQueueSheet = referenceSS.getSheetByName('TaskQ');

        // Get all data sheets
        const webSSheet = backendSS.getSheetByName('WebS');
        const webMSheet = referenceSS.getSheetByName('WebM');
        const comaxSSheet = backendSS.getSheetByName('ComaxS');
        const comaxMSheet = referenceSS.getSheetByName('ComaxM');
        const assignmentSheet = referenceSS.getSheetByName('TaskAssignments');
        const usersSheet = referenceSS.getSheetByName('Users');

        if (!webSSheet || !webMSheet || !comaxSSheet || !comaxMSheet || !taskQueueSheet || !assignmentSheet || !usersSheet) {
            ui.alert('Error: One of the required sheets could not be found. Please check: WebS, WebM, ComaxS, ComaxM, TaskQ, TaskAssignments, Users.');
            return;
        }

        const userIdToNameMap = new Map();
        if (usersSheet.getLastRow() > 1) {
            const usersData = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, 2).getValues();
            usersData.forEach(row => {
                const userId = row[0];
                const userName = row[1];
                if (userId && userName) {
                    userIdToNameMap.set(String(userId).trim(), String(userName).trim());
                }
            });
        }

        const assignmentRules = {};
        if (assignmentSheet.getLastRow() > 1) {
            // Now read 3 columns: TaskType, AssignTo, and Priority
            const assignmentData = assignmentSheet.getRange(2, 1, assignmentSheet.getLastRow() - 1, 3).getValues();
            assignmentData.forEach(row => {
                const taskType = row[0];
                const userId = row[1];
                const priority = row[2];
                if (taskType && userId && String(taskType).trim()) {
                    const userName = userIdToNameMap.get(String(userId).trim()) || String(userId).trim();
                    assignmentRules[String(taskType).trim()] = {
                        assignee: userName,
                        priority: priority
                    };
                }
            });
        }

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

        const webSDataById = getSheetData(webSSheet, 0);
        const webMDataById = getSheetData(webMSheet, 0);
        const comaxSDataBySku = getSheetData(comaxSSheet, 1);
        const comaxMDataBySku = getSheetData(comaxMSheet, 1);
        const webSDataBySku = getSheetData(webSSheet, 1);

        // --- WEB COMPARISON (A) ---
        for (const id in webSDataById) {
            const entity = webSDataById[id][1] || id;
            if (!webMDataById[id.trim()] && !existingOpenExceptions.has(`${entity.toString().trim()}-${TASK_TYPE_A1}`)) {
                logException(taskQueueSheet, sessionId, entity, 'WebS', TASK_TYPE_A1, 'High', `ID ${id} (${String(webSDataById[id][2]||'').substring(0,40)}...) found in staging, not in master.`, assignmentRules);
            }
        }
        for (const id in webMDataById) {
            const entity = webMDataById[id][1] || id;
            if (!webSDataById[id.trim()] && !existingOpenExceptions.has(`${entity.toString().trim()}-${TASK_TYPE_A2}`)) {
                logException(taskQueueSheet, sessionId, entity, 'WebM', TASK_TYPE_A2, 'High', `Found in master, missing from staging. ${String(webMDataById[id][2]||'').substring(0,40)}...`, assignmentRules);
            }
        }
        for (const id in webMDataById) {
            const cleanId = id.trim();
            if (webSDataById[cleanId]) {
                const masterRow = webMDataById[cleanId],
                    stagingRow = webSDataById[cleanId],
                    entity = masterRow[1] || cleanId,
                    name = String(masterRow[2] || '').substring(0, 40);
                const entityKey = entity.toString().trim();

                if (String(masterRow[1] || '').trim() !== String(stagingRow[1] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_A3}`)) logException(taskQueueSheet, sessionId, entity, 'WebS', TASK_TYPE_A3, 'High', `ID ${cleanId} (${name}...): Master/Staging SKU mismatch.`, assignmentRules);
                if (String(masterRow[2] || '').trim() !== String(stagingRow[2] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_A4}`)) logException(taskQueueSheet, sessionId, entity, 'WebS', TASK_TYPE_A4, 'Medium', `ID ${cleanId} (${name}...): Master/Staging name mismatch.`, assignmentRules);
                if (String(masterRow[3] || '').trim() !== String(stagingRow[3] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_A5}`)) logException(taskQueueSheet, sessionId, entity, 'WebS', TASK_TYPE_A5, 'High', `ID ${cleanId} (${name}...): Master/Staging publish status mismatch.`, assignmentRules);
            }
        }

        // --- COMAX COMPARISON (C) ---
        for (const sku in comaxMDataBySku) {
            const masterRow = comaxMDataBySku[sku];
            if (String(masterRow[16] || '').trim() === 'כן' && !comaxSDataBySku[sku.trim()] && !existingOpenExceptions.has(`${sku.trim()}-${TASK_TYPE_C1}`)) {
                logException(taskQueueSheet, sessionId, sku, 'ComaxM', TASK_TYPE_C1, 'Medium', `SKU ${sku} (${String(masterRow[2]||'').substring(0,40)}...) found in master, not in staging.`, assignmentRules);
            }
        }
        for (const sku in comaxSDataBySku) {
            const cleanSku = sku.trim();
            const stagingRow = comaxSDataBySku[cleanSku],
                masterRow = comaxMDataBySku[cleanSku],
                isSellOnline = String(stagingRow[16] || '').trim() === 'כן';

            if (!masterRow && isSellOnline && !webSDataBySku[cleanSku] && !existingOpenExceptions.has(`${cleanSku}-${TASK_TYPE_E1}`)) {
                logException(taskQueueSheet, sessionId, cleanSku, 'ComaxS', TASK_TYPE_E1, 'High', `New SKU ${cleanSku} (${String(stagingRow[2]||'').substring(0,40)}...) is 'sell online' but not found in WebS.`, assignmentRules);
            }

            if (masterRow) {
                if (isSellOnline || String(masterRow[16] || '').trim() === 'כן') {
                    const masterName = String(masterRow[2] || '').substring(0, 40);
                    const entity = cleanSku;
                    const entityKey = entity;

                    if (String(stagingRow[0] || '').trim() !== String(masterRow[0] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_C2}`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', TASK_TYPE_C2, 'High', `SKU ${cleanSku} (${masterName}...): Master/Staging ID mismatch.`, assignmentRules);
                    if (String(stagingRow[2] || '').trim() !== String(masterRow[2] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_C3}`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', TASK_TYPE_C3, 'Medium', `SKU ${cleanSku} (${masterName}...): Master/Staging name mismatch.`, assignmentRules);
                    if (String(stagingRow[4] || '').trim() !== String(masterRow[4] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_C4}`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', TASK_TYPE_C4, 'Medium', `SKU ${cleanSku} (${masterName}...): Master/Staging group mismatch.`, assignmentRules);
                    if (String(stagingRow[8] || '').trim() !== String(masterRow[8] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_C5}`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', TASK_TYPE_C5, 'Medium', `SKU ${cleanSku} (${masterName}...): Master/Staging size mismatch.`, assignmentRules);
                    if (String(stagingRow[10] || '').trim() !== String(masterRow[10] || '').trim() && !existingOpenExceptions.has(`${entityKey}-${TASK_TYPE_C6}`)) logException(taskQueueSheet, sessionId, entity, 'ComaxS', TASK_TYPE_C6, 'Medium', `Master/Staging vintage mismatch. ${masterName}`, assignmentRules);
                }
            }
        }

        // --- DATA AUDITS (D) ---
        for (const sku in comaxSDataBySku) {
            const row = comaxSDataBySku[sku];
            const skuKey = sku.trim();

            if (String(row[17] || '').trim() && String(row[16] || '').trim() !== 'כן' && !existingOpenExceptions.has(`${skuKey}-${TASK_TYPE_D1}`)) logException(taskQueueSheet, sessionId, sku, 'ComaxS', TASK_TYPE_D1, 'Low', `SKU ${sku} (${String(row[2]||'').substring(0,40)}...) is Excluded but not marked Sell Online.`, assignmentRules);
            if (Number(row[15]) < 0 && !existingOpenExceptions.has(`${skuKey}-${TASK_TYPE_D2}`)) logException(taskQueueSheet, sessionId, sku, 'ComaxS', TASK_TYPE_D2, 'Medium', `Negative Inventory. ${String(row[2]||'').substring(0,40)}...`, assignmentRules);
            if (String(row[12] || '').trim() && Number(row[15]) > 0 && !existingOpenExceptions.has(`${skuKey}-${TASK_TYPE_D3}`)) {
                const priority = String(row[16] || '').trim() === 'כן' ? 'High' : 'Medium';
                logException(taskQueueSheet, sessionId, sku, 'ComaxS', TASK_TYPE_D3, priority, `Archived item with stock. ${String(row[2]||'').substring(0,40)}...`, assignmentRules);
            }
        }

        // --- CROSS-FILE VALIDATION (E) ---
        for (const sku in webSDataBySku) {
            const cleanSku = sku.trim();
            const webRow = webSDataBySku[cleanSku],
                comaxRow = comaxSDataBySku[cleanSku];

            if (!comaxRow) {
                if (!existingOpenExceptions.has(`${cleanSku}-${TASK_TYPE_E2}`)) logException(taskQueueSheet, sessionId, cleanSku, 'WebS', TASK_TYPE_E2, 'High', `SKU ${cleanSku} (${String(webRow[2]||'').substring(0,40)}...) exists in WebS but is missing from ComaxS.`, assignmentRules);
            } else {
                const webMRow = webMDataById[webRow[0]];
                if (webMRow && String(webMRow[3] || '').trim() === 'published' && String(comaxRow[16] || '').trim() !== 'כן') {
                    if (!existingOpenExceptions.has(`${cleanSku}-${TASK_TYPE_E3}`)) logException(taskQueueSheet, sessionId, cleanSku, 'WebS/ComaxS', TASK_TYPE_E3, 'Medium', `SKU ${cleanSku} (${String(webRow[2]||'').substring(0,40)}...) is Published on Web but not marked Sell Online in Comax.`, assignmentRules);
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