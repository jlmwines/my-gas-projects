/**
 * @file TaskCreator.gs
 * @purpose Handles the programmatic creation of inventory tasks based on stock levels and periodic checks, including a user confirmation step.
 * @version 2025-07-29T18:00:00 (Final attempt to correctly apply all 3 config parameters without hardcoding)
 */

// NOTE: To enable testing, add a menu to your onOpen(e) function in your primary script file.
/*
function onOpen(e) {
    // ... your existing onOpen() code ...
    SpreadsheetApp.getUi()
        .createMenu('Admin')
        .addItem('Run Task Creator...', 'runTaskCreatorWorkflow')
        .addToUi();
}
*/

/**
 * Manages the full user-facing workflow for creating tasks with confirmation.
 */
function runTaskCreatorWorkflow() {
    const ui = SpreadsheetApp.getUi();

    // Ask user for task type
    const typeResponse = ui.prompt('Select Task Type', 'Enter "Low Stock" or "Periodic Review":', ui.ButtonSet.OK_CANCEL);
    if (typeResponse.getSelectedButton() !== ui.Button.OK || !typeResponse.getResponseText()) {
        ui.alert('Task creation cancelled.');
        return;
    }
    const type = typeResponse.getResponseText().trim();
    if (type !== 'Low Stock' && type !== 'Periodic Review') {
        ui.alert('Invalid task type entered. Please enter "Low Stock" or "Periodic Review".');
        return;
    }

    // Pass the type to createTasks. createTasks will handle all config reading and limiting.
    const reviewOptions = { type: type, stage: 'review' };
    const reviewResult = createTasks(reviewOptions);

    if (reviewResult.status === 'error' || reviewResult.status === 'done') {
        ui.alert(reviewResult.message);
        return;
    }

    // Stage 2: Show confirmation prompt
    const confirmResponse = ui.prompt('Confirm Task Creation', reviewResult.message + '\n\nType "YES" to proceed.', ui.ButtonSet.OK_CANCEL);
    if (confirmResponse.getSelectedButton() !== ui.Button.OK || confirmResponse.getResponseText().toUpperCase() !== 'YES') {
        ui.alert('Task creation cancelled.');
        return;
    }

    // Stage 3: Execute task creation
    const executeOptions = {
        assignee: reviewResult.assignee, // Pass the default assignee determined in the review stage
        tasksPayload: reviewResult.tasksPayload,
        stage: 'execute'
    };
    const finalResult = createTasks(executeOptions);
    ui.alert(finalResult.message);
}


/**
 * Creates inventory tasks. Operates in two stages: 'review' and 'execute'.
 * This function now explicitly retrieves and validates all 3 config parameters.
 * @param {object} options An object specifying the task creation parameters (type, stage).
 * @returns {object} A result object with a status, message, and sometimes a payload.
 */
function createTasks(options) {
    const logCollector = ['--- Task Creation Log ---'];

    try {
        const config = getConfig_(); // Read config values

        // --- Validate and Parse Config Values ---
        const totalTaskCap = parseInt(config.TaskCreator_DefaultLimit, 10);
        if (isNaN(totalTaskCap) || totalTaskCap <= 0) {
            throw new Error("Config error: 'TaskCreator_DefaultLimit' is missing or not a positive number.");
        }

        const lowStockThreshold = parseInt(config.TaskCreator_LowStockThreshold, 10);
        if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
            throw new Error("Config error: 'TaskCreator_LowStockThreshold' is missing or not a valid non-negative number.");
        }

        const periodicDays = parseInt(config.TaskCreator_PeriodicDays, 10);
        if (isNaN(periodicDays) || periodicDays <= 0) {
            throw new Error("Config error: 'TaskCreator_PeriodicDays' is missing or not a positive number.");
        }

        const defaultAssignee = config.TaskCreator_DefaultAssignee;
        if (!defaultAssignee) {
            throw new Error("Config error: 'TaskCreator_DefaultAssignee' is missing.");
        }
        // --- End Config Validation ---


        const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);
        if (!refSs) throw new Error("Reference file not found or accessible.");

        // --- Get User Map ---
        const usersSheet = refSs.getSheetByName('Users');
        if (!usersSheet) throw new Error("Sheet 'Users' not found in Reference file.");
        const userData = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, 2).getValues();
        const userMap = new Map(userData.map(row => [row[0], row[1]])); // Map of ID -> Name

        // --- STAGE 1: REVIEW ---
        if (options.stage === 'review') {
            logCollector.push(`Starting 'review' stage for type: ${options.type}`);

            const assigneeKey = options.assignee || defaultAssignee;
            const assigneeName = userMap.get(assigneeKey) || assigneeKey;

            const taskQSheet = refSs.getSheetByName('TaskQ');
            if (!taskQSheet) throw new Error("Sheet 'TaskQ' not found in Reference file.");
            // Filter out empty rows and ensure SKU is present for open tasks
            const openInventoryTasks = taskQSheet.getDataRange().getValues().filter(r =>
                r[5] && // Ensure SKU exists (Column F, index 5)
                (r[6] === 'Open' || r[6] === 'Assigned') && // Status is Open or Assigned (Column G, index 6)
                r[2] === 'Inventory Count' && // Task Type is 'Inventory Count' (Column C, index 2)
                r[3] === 'ComaxM' && // Source is 'ComaxM' (Column D, index 3)
                r[8] === assigneeName // Assignee matches the default assignee from config (Column I, index 8)
            );

            // The core capacity check based on config
            if (openInventoryTasks.length >= totalTaskCap) {
                return { status: 'done', message: `No new tasks created. Task queue (${openInventoryTasks.length}) is at or above capacity (${totalTaskCap}).` };
            }

            const comaxMSheet = refSs.getSheetByName('ComaxM');
            if (!comaxMSheet) throw new Error("Sheet 'ComaxM' not found in Reference file.");
            // Read all relevant columns. Assuming fixed columns are consistent.
            // Using getRange to only read relevant columns from the original scope.
            const comaxMData = comaxMSheet.getRange(2, 1, comaxMSheet.getLastRow() - 1, 17).getValues(); // Read to column Q (index 16), which includes CMX WEB

            // Original Column Indices (based on the first script you provided)
            const CMX_DIV_COL = 3;      // Column D (index 3)
            const CMX_SKU_COL = 1;      // Column B (index 1)
            const CMX_PRODUCT_NAME_COL = 2; // Column C (index 2)
            const CMX_ARCHIVE_COL = 12; // Column M (index 12)
            const CMX_STOCK_COL = 15;   // Column P (index 15)
            const CMX_WEB_COL = 16;     // Column Q (index 16)


            const openTaskSkus = new Set(openInventoryTasks.map(r => r[5])); // r[5] is SKU from TaskQ

            // Filter for Division 1 (as in original AuditLowProducts), not archived, and not already in an open task
            const allEligibleProducts = comaxMData.filter(row => {
                const division = row[CMX_DIV_COL];
                const archived = String(row[CMX_ARCHIVE_COL]).trim(); // Ensure string and trim
                const sku = row[CMX_SKU_COL];

                return archived === '' && sku && !openTaskSkus.has(sku) && String(row[CMX_WEB_COL]).trim() === 'כן';
            });

            const auditSheet = refSs.getSheetByName('Audit');
            if (!auditSheet) throw new Error("Sheet 'Audit' not found in Reference file.");
            const auditData = auditSheet.getRange('A2:C' + auditSheet.getLastRow()).getValues();
            const auditMap = new Map(auditData.map(r => [r[1], r[2]])); // Map of SKU -> Last Audit Date

            let candidateProducts = [];
            const periodicCutoff = new Date(new Date().setDate(new Date().getDate() - periodicDays)); // Uses periodicDays

            if (options.type === 'Low Stock') {
                candidateProducts = allEligibleProducts
                    .filter(r => {
                        const lastCountDate = auditMap.get(r[CMX_SKU_COL]);
                        const stock = r[CMX_STOCK_COL];
                        const isLowStock = stock !== '' && stock !== 0 && stock < lowStockThreshold;
                        const isPastCutoff = !lastCountDate || (lastCountDate instanceof Date && lastCountDate < periodicCutoff);
                        return isLowStock && isPastCutoff;
                    })
                    .map(p => ({
                        sku: p[CMX_SKU_COL],
                        name: p[CMX_PRODUCT_NAME_COL],
                        isWeb: String(p[CMX_WEB_COL]).trim() === 'כן', // Check CMX WEB status for 'Yes' in Hebrew
                        lastCount: auditMap.get(p[CMX_SKU_COL]) || null
                    }))
                    .sort((a, b) => (b.isWeb - a.isWeb) || (a.lastCount || 0) - (b.lastCount || 0));

            } else { // Periodic Review
                candidateProducts = allEligibleProducts
                    .filter(r => {
                        const lastCountDate = auditMap.get(r[CMX_SKU_COL]);
                        // If no audit date, or if audit date is older than cutoff
                        return !lastCountDate || (lastCountDate instanceof Date && lastCountDate < periodicCutoff);
                    })
                    .map(p => ({
                        sku: p[CMX_SKU_COL],
                        name: p[CMX_PRODUCT_NAME_COL],
                        lastCount: auditMap.get(p[CMX_SKU_COL]) || null
                    }))
                    .sort((a, b) => (a.lastCount || 0) - (b.lastCount || 0));
            }

            if (candidateProducts.length === 0) {
                return { status: 'done', message: `No products matching the criteria for '${options.type}' tasks.` };
            }

            // Calculate actual tasks to offer based on totalTaskCap and candidates
            const availableSlots = totalTaskCap - openInventoryTasks.length;
            // The number of tasks offered will be the MINIMUM of:
            // 1. The remaining capacity in the TaskQ (totalTaskCap - openInventoryTasks.length)
            // 2. The number of eligible candidate products found.
            const actualTasksToOffer = Math.min(availableSlots, candidateProducts.length);

            // This is the array of tasks that will actually be created/offered
            const tasksPayload = candidateProducts.slice(0, actualTasksToOffer);

            return {
                status: 'review',
                message: `Ready to create ${tasksPayload.length} '${options.type}' task(s) and assign them to '${assigneeName}'.`,
                tasksPayload: tasksPayload,
                assignee: assigneeKey
            };
        }

        // --- STAGE 2: EXECUTE ---
        if (options.stage === 'execute') {
            logCollector.push(`Starting 'execute' stage.`);
            const { tasksPayload, assignee } = options;
            if (!tasksPayload || tasksPayload.length === 0) {
                return { status: 'done', message: 'No tasks to create.' };
            }

            const assigneeName = userMap.get(assignee) || assignee;
            logCollector.push(`Assigning ${tasksPayload.length} tasks to ${assigneeName} (${assignee})`);

            const taskQSheet = refSs.getSheetByName('TaskQ');
            const session = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HHmmssSSS');

            const newTasks = tasksPayload.map(product => {
                const details = `Check inventory for SKU ${product.sku}: ${product.name}. Type: ${options.type}.`;
                const lastCountDisplay = product.lastCount ? Utilities.formatDate(new Date(product.lastCount), Session.getScriptTimeZone(), 'MM/dd/yyyy') : 'N/A';
                return [
                    new Date(), // Timestamp (Col A)
                    session,    // Session ID (Col B)
                    'Inventory Count', // Task Type (Col C)
                    'ComaxM',   // Source (Col D)
                    details,    // Details (Col E)
                    product.sku, // SKU (Col F)
                    'Assigned', // Status (Col G)
                    'Medium',   // Priority (Col H)
                    assigneeName, // Assignee Name (Col I)
                    new Date(), // Assigned Date (Col J)
                    '',         // Due Date (Col K - optional)
                    '',         // Completion Date (Col L - optional)
                    `Last Count: ${lastCountDisplay}` // Notes (Col M)
                ];
            });

            // Append new tasks to TaskQ
            if (newTasks.length > 0) {
                taskQSheet.getRange(taskQSheet.getLastRow() + 1, 1, newTasks.length, newTasks[0].length).setValues(newTasks);
            }

            const finalMessage = `Successfully created and assigned ${newTasks.length} task(s) to '${assigneeName}'.`;
            logCollector.push(finalMessage);
            Logger.log(logCollector.join('\n'));
            return { status: 'done', message: finalMessage };
        }

    } catch (e) {
        logCollector.push(`--- ERROR ---`, `Message: ${e.message}`, `Stack: ${e.stack}`);
        Logger.log(logCollector.join('\n'));
        return { status: 'error', message: `An error occurred: ${e.message}. Check execution logs for details.` };
    }
}

/**
 * Reads the 'Config' sheet and returns a key-value object.
 * This is unchanged, as it was already correct.
 */
function getConfig_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet) throw new Error("Sheet 'Config' not found in the active spreadsheet.");
    const data = configSheet.getRange('A2:B' + configSheet.getLastRow()).getValues();
    const config = {};
    for (const row of data) {
        if (row[0]) config[row[0]] = row[1];
    }
    return config;
}

/**
 * Handles the task creation workflow initiated from the sidebar.
 * This function is also simplified to let createTasks handle the limit.
 * @param {string} type The type of task to create ('Low Stock' or 'Periodic Review').
 * @returns {string} A final status message for the user.
 */
function createTasksFromSidebar(type) {
    const ui = SpreadsheetApp.getUi();

    try {
        // No need to get config or pass 'limit' here. createTasks will handle it.
        const reviewOptions = { type: type, stage: 'review' };
        const reviewResult = createTasks(reviewOptions);

        // If there's an error or no tasks to create, stop here.
        if (reviewResult.status === 'error' || reviewResult.status === 'done') {
            ui.alert(reviewResult.message);
            return reviewResult.message;
        }

        // Stage 2: Show the working `ui.alert` for confirmation
        const confirmResponse = ui.alert('Confirm Task Creation', reviewResult.message, ui.ButtonSet.YES_NO);
        if (confirmResponse !== ui.Button.YES) {
            return 'Task creation cancelled by user.';
        }

        // Stage 3: Execute the task creation
        const executeOptions = {
            stage: 'execute',
            tasksPayload: reviewResult.tasksPayload,
            assignee: reviewResult.assignee
        };
        const finalResult = createTasks(executeOptions);

        // Show and return the final message
        ui.alert(finalResult.message);
        return finalResult.message;

    } catch (e) {
        const errorMessage = `An error occurred: ${e.message}`;
        ui.alert(errorMessage);
        return errorMessage;
    }
}

/**
 * Gathers all necessary information for the Task Panel display.
 * This function also retrieves config directly.
 * @returns {object} An object containing settings, task count, and a list of users.
 */
function getTaskPanelInfo() {
    try {
        // Get settings from the Config sheet
        const config = getConfig_();
        const settings = {
            defaultLimit: config.TaskCreator_DefaultLimit, // Now includes DefaultLimit for panel display
            lowStock: config.TaskCreator_LowStockThreshold,
            periodicDays: config.TaskCreator_PeriodicDays,
            defaultAssignee: config.TaskCreator_DefaultAssignee
        };

        const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);
        if (!refSs) throw new Error("Reference file not found or accessible.");

        // Get user list to find the default assignee's name
        const usersSheet = refSs.getSheetByName('Users');
        if (!usersSheet) throw new Error("Sheet 'Users' not found in Reference file.");
        const userList = usersSheet.getRange('A2:B' + usersSheet.getLastRow()).getValues();
        const userMap = new Map(userList.map(row => [row[0], row[1]])); // Map of ID -> Name
        const defaultAssigneeName = userMap.get(settings.defaultAssignee);

        // Get inventory task count FOR THE DEFAULT ASSIGNEE
        const taskQSheet = refSs.getSheetByName('TaskQ');
        if (!taskQSheet) throw new Error("Sheet 'TaskQ' not found in Reference file.");
        const taskData = taskQSheet.getRange('G2:I' + taskQSheet.getLastRow()).getValues(); // Get Status (G) and Assignee (I)

        const assignedTaskCount = taskData.filter(row => {
            const status = row[0];  // Column G
            const assignee = row[2]; // Column I
            return status === 'Assigned' && assignee === defaultAssigneeName;
        }).length;

        const formattedUserList = userList.map(row => ({ id: row[0], name: row[1] }));

        return { settings, assignedTaskCount, userList: formattedUserList };
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Saves updated settings from the sidebar to the Config sheet.
 * This is unchanged, as it was already correct.
 * @param {object} newSettings An object with the settings to update.
 */
function saveTaskSettings(newSettings) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const configSheet = ss.getSheetByName('Config');
        if (!configSheet) throw new Error("Sheet 'Config' not found.");
        const data = configSheet.getRange("A2:B" + configSheet.getLastRow()).getValues();

        // Create a map of setting name to its row index (2-based)
        const settingRowMap = new Map();
        data.forEach((row, index) => {
            if (row[0]) settingRowMap.set(row[0], index + 2);
        });

        // Update values based on the map
        if (newSettings.lowStock !== undefined && settingRowMap.has('TaskCreator_LowStockThreshold')) {
            configSheet.getRange(settingRowMap.get('TaskCreator_LowStockThreshold'), 2).setValue(newSettings.lowStock);
        }
        if (newSettings.periodicDays !== undefined && settingRowMap.has('TaskCreator_PeriodicDays')) {
            configSheet.getRange(settingRowMap.get('TaskCreator_PeriodicDays'), 2).setValue(newSettings.periodicDays);
        }
        if (newSettings.defaultAssignee !== undefined && settingRowMap.has('TaskCreator_DefaultAssignee')) {
            configSheet.getRange(settingRowMap.get('TaskCreator_DefaultAssignee'), 2).setValue(newSettings.defaultAssignee);
        }
        if (newSettings.defaultLimit !== undefined && settingRowMap.has('TaskCreator_DefaultLimit')) {
            configSheet.getRange(settingRowMap.get('TaskCreator_DefaultLimit'), 2).setValue(newSettings.defaultLimit);
        }

        return { success: true, message: "Settings saved successfully." };
    } catch (e) {
        return { success: false, message: e.message };
    }
}