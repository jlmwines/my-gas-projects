/**
 * @file TaskCreator.gs
 * @purpose Handles the programmatic creation of inventory tasks based on stock levels and periodic checks, including a user confirmation step.
 * @version 2025-07-17T19:42:02
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

    // Stage 1: Get the review data
    const reviewOptions = { type: type, limit: 10, stage: 'review' };
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
 * @param {object} options An object specifying the task creation parameters.
 * @returns {object} A result object with a status, message, and sometimes a payload.
 */
function createTasks(options) {
    const logCollector = ['--- Task Creation Log ---'];

    try {
        const config = getConfig_();
        const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);

        // --- Get User Map ---
        const usersSheet = refSs.getSheetByName('Users');
        const userData = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, 2).getValues();
        const userMap = new Map(userData.map(row => [row[0], row[1]])); // Map of ID -> Name

        // --- STAGE 1: REVIEW ---
        if (options.stage === 'review') {
            logCollector.push(`Starting 'review' stage for type: ${options.type}`);
            const { TaskCreator_DefaultLimit, TaskCreator_LowStockThreshold, TaskCreator_PeriodicDays, TaskCreator_DefaultAssignee } = config;
            const requiredConfigs = { TaskCreator_DefaultLimit, TaskCreator_LowStockThreshold, TaskCreator_PeriodicDays, TaskCreator_DefaultAssignee };
            for (const key in requiredConfigs) {
                if (!requiredConfigs[key]) throw new Error(`Required setting '${key}' is missing from the Config sheet.`);
            }

            const assigneeKey = options.assignee || TaskCreator_DefaultAssignee;
            const assigneeName = userMap.get(assigneeKey) || assigneeKey;

            const taskQSheet = refSs.getSheetByName('TaskQ');
            const openInventoryTasks = taskQSheet.getDataRange().getValues().filter(r => (r[6] === 'Open' || r[6] === 'Assigned') && r[5]);
            const totalTaskCap = parseInt(TaskCreator_DefaultLimit, 10);

            if (openInventoryTasks.length >= totalTaskCap) {
                return { status: 'done', message: 'No new tasks created. Task queue is at capacity.' };
            }

            const comaxMSheet = refSs.getSheetByName('ComaxM');
            const comaxMData = comaxMSheet.getRange('A2:R' + comaxMSheet.getLastRow()).getValues(); // Read to column R
            const openTaskSkus = new Set(openInventoryTasks.map(r => r[5]));
            const activeProducts = comaxMData.filter(r => !r[12] && !r[17] && !openTaskSkus.has(r[1]));

            const auditSheet = refSs.getSheetByName('Audit');
            const auditData = auditSheet.getRange('A2:C' + auditSheet.getLastRow()).getValues();
            const auditMap = new Map(auditData.map(r => [r[1], r[2]]));
            
            const comaxWebIndex = 16; // Column Q for CMX WEB

            let candidateProducts = [];
            if (options.type === 'Low Stock') {
                candidateProducts = activeProducts
                    .filter(r => r[15] > 0 && r[15] <= TaskCreator_LowStockThreshold)
                    // **UPDATED LOGIC**: Map products to an object including their web status for sorting.
                    .map(p => ({
                        sku: p[1],
                        name: p[2],
                        isWeb: p[comaxWebIndex] === 'כן', // Check CMX WEB status for 'Yes' in Hebrew
                        lastCount: auditMap.get(p[1]) || null
                    }))
                    // **UPDATED LOGIC**: Apply two-level sort to prioritize web items.
                    .sort((a, b) => (b.isWeb - a.isWeb) || (a.lastCount || 0) - (b.lastCount || 0));

            } else { // Periodic Review
                const periodicCutoff = new Date(new Date().setDate(new Date().getDate() - TaskCreator_PeriodicDays));
                candidateProducts = activeProducts
                    .filter(r => !auditMap.get(r[1]) || new Date(auditMap.get(r[1])) < periodicCutoff)
                    .map(p => ({ sku: p[1], name: p[2], lastCount: auditMap.get(p[1]) || null }))
                    .sort((a, b) => (a.lastCount || 0) - (b.lastCount || 0));
            }

            if (candidateProducts.length === 0) {
                return { status: 'done', message: `No products matching the criteria for '${options.type}' tasks.` };
            }

            const limit = options.limit || 10;
            const availableSlots = totalTaskCap - openInventoryTasks.length;
            const actualLimit = Math.min(limit, availableSlots, candidateProducts.length);
            const tasksPayload = candidateProducts.slice(0, actualLimit);

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
            const session = new Date().toTimeString().slice(0, 8).replace(/:/g, '') + new Date().getMilliseconds();
            
            const newTasks = tasksPayload.map(product => {
                const details = `Check low stock for SKU ${product.sku}: ${product.name}.`;
                return [new Date(), session, 'Inventory Count', 'ComaxM', details, product.sku, 'Assigned', 'Medium', assigneeName, new Date(), '', '', `Last Count: ${product.lastCount ? new Date(product.lastCount).toLocaleDateString() : 'N/A'}`];
            });

            taskQSheet.getRange(taskQSheet.getLastRow() + 1, 1, newTasks.length, newTasks[0].length).setValues(newTasks);
            
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
 */
function getConfig_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet) throw new Error("Sheet 'Config' not found.");
    const data = configSheet.getRange('A2:B' + configSheet.getLastRow()).getValues();
    const config = {};
    for (const row of data) {
        if (row[0]) config[row[0]] = row[1];
    }
    return config;
}
/**
 * Handles the task creation workflow initiated from the sidebar.
 * This version uses ui.alert() for confirmation.
 * @param {string} type The type of task to create ('Low Stock' or 'Periodic Review').
 * @returns {string} A final status message for the user.
 */
function createTasksFromSidebar(type) {
  const ui = SpreadsheetApp.getUi();

  try {
    // Stage 1: Get the review data from your existing core function
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
 * @returns {object} An object containing settings, task count, and a list of users.
 */
/**
 * Gathers all necessary information for the Task Panel display.
 * @returns {object} An object containing settings, task count, and a list of users.
 */
/**
 * Gathers all necessary information for the Task Panel display.
 * @returns {object} An object containing settings, task count, and a list of users.
 */
function getTaskPanelInfo() {
  try {
    // Get settings from the Config sheet
    const config = getConfig_();
    const settings = {
      lowStock: config.TaskCreator_LowStockThreshold,
      periodicDays: config.TaskCreator_PeriodicDays,
      defaultAssignee: config.TaskCreator_DefaultAssignee
    };

    const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);

    // Get user list to find the default assignee's name
    const usersSheet = refSs.getSheetByName('Users');
    const userList = usersSheet.getRange('A2:B' + usersSheet.getLastRow()).getValues();
    const userMap = new Map(userList.map(row => [row[0], row[1]])); // Map of ID -> Name
    const defaultAssigneeName = userMap.get(settings.defaultAssignee);

    // Get inventory task count FOR THE DEFAULT ASSIGNEE
    const taskQSheet = refSs.getSheetByName('TaskQ');
    const taskData = taskQSheet.getRange('G2:I' + taskQSheet.getLastRow()).getValues(); // Get Status (G) and Assignee (I)
    
    const assignedTaskCount = taskData.filter(row => {
      const status = row[0];   // Column G
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
 * @param {object} newSettings An object with the settings to update.
 */
function saveTaskSettings(newSettings) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    const data = configSheet.getRange("A2:B" + configSheet.getLastRow()).getValues();

    // Create a map of setting name to its row index (2-based)
    const settingRowMap = new Map();
    data.forEach((row, index) => {
      if (row[0]) settingRowMap.set(row[0], index + 2);
    });

    // Update values based on the map
    if (newSettings.lowStock && settingRowMap.has('TaskCreator_LowStockThreshold')) {
      configSheet.getRange(settingRowMap.get('TaskCreator_LowStockThreshold'), 2).setValue(newSettings.lowStock);
    }
    if (newSettings.periodicDays && settingRowMap.has('TaskCreator_PeriodicDays')) {
      configSheet.getRange(settingRowMap.get('TaskCreator_PeriodicDays'), 2).setValue(newSettings.periodicDays);
    }
    if (newSettings.defaultAssignee && settingRowMap.has('TaskCreator_DefaultAssignee')) {
      configSheet.getRange(settingRowMap.get('TaskCreator_DefaultAssignee'), 2).setValue(newSettings.defaultAssignee);
    }

    return { success: true, message: "Settings saved successfully." };
  } catch (e) {
    return { success: false, message: e.message };
  }
}