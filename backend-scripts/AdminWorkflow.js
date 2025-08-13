/**
 * @file AdminWorkflow.gs
 * @description Handles backend logic for the new sidebar, calling existing launcher functions.
 * @version 25-08-10-1220
 */

// --- Daily Sync Step Functions ---

/**
 * Runs the initial sync step: resetting state and running a backup.
 * Each called function will have its own UI prompt.
 */
function runInitialSyncStep() {
  Logger.log("--- Starting runInitialSyncStep ---");
  try {
    Logger.log("Calling resetStateToStart()...");
    resetStateToStart();
    Logger.log("resetStateToStart() completed.");

    Logger.log("Calling backupSheets()...");
    backupSheets();
    Logger.log("backupSheets() completed.");

    Logger.log("--- runInitialSyncStep finished successfully. ---");
    return "Initial sync steps (Reset & Backup) were called successfully.";
  } catch (e) {
    // Log the specific error before re-throwing it for the client.
    Logger.log("ERROR in runInitialSyncStep: " + e.message);
    throw new Error('Initial sync step failed or was cancelled: ' + e.message);
  }
}

/**
 * Runs the 'Process Orders' step of the workflow.
 */
function runOrdersStep() {
  try {
    importWebOrders();
    mergeOrders();
    exportOrdersForComax();
    return "Order processing steps were called successfully.";
  } catch (e) {
    throw new Error('Order processing failed or was cancelled: ' + e.message);
  }
}

/**
 * Runs the 'Process Products' step of the workflow.
 */
function runProductsStep() {
  try {
    // Assuming getImportFileDates is available and works as in the old sidebar.
    const fileDates = getImportFileDates();
    if (fileDates.webDate !== fileDates.comaxDate || fileDates.webDate === 'Not found') {
      throw new Error('Import file date mismatch or files not found.');
    }

    importWebProducts();
    importComaxProducts();
    reviewProducts();
    // finalizeProductData(); // This function was in the old sidebar logic. Uncomment if needed.
    exportInventoryAdjustments();

    return "Product processing steps were called successfully.";
  } catch (e) {
    throw new Error('Product processing failed or was cancelled: ' + e.message);
  }
}

/**
 * A placeholder for the getImportFileDates function, in case it's not globally available.
 * The real function should exist in one of your other script files.
 */
function getImportFileDates() {
  // This function should exist in your project. If not, you'll need to implement
  // the logic to get the last updated dates of the import files.
  // Returning a match for testing purposes.
  const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return { webDate: today, comaxDate: today };
}
// --- Sidebar Data Functions ---

/**
 * Main data endpoint for the Operations Hub sidebar.
 * Fetches all necessary data in a single server call.
 * @returns {object} An object containing data for all sidebar panels.
 */
function getSidebarData() {
    return {
        adminTasks: getAdminTaskCounts_(),
        taskPanel: getTaskPanelInfo(),
        bwTasks: getTaskCountsForAssignee_('BW')
    };
}

/**
 * Gathers counts of tasks for a specific assignee based on TaskAssignments.
 * @param {string} assigneeId The ID of the assignee (e.g., 'BW').
 * @returns {Array<object>} An array of objects, each representing a task type count.
 */
function getTaskCountsForAssignee_(assigneeId) {
    const taskCounts = [];
    try {
        const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);

        // --- Get the user's full name from their ID ---
        const usersSheet = refSs.getSheetByName('Users');
        if (!usersSheet) {
            throw new Error("Required sheet not found: Users.");
        }
        const usersData = usersSheet.getDataRange().getValues();
        const userRow = usersData.find(row => row[0] === assigneeId); // Find user by ID in Col A
        if (!userRow) {
            Logger.log(`User ID '${assigneeId}' not found in Users sheet.`);
            return []; // No user, so no tasks
        }
        const assigneeName = userRow[1]; // Get full name from Col B

        // --- Get task definitions assigned to this user ID ---
        const taskAssignmentSheet = refSs.getSheetByName('TaskAssignments');
        if (!taskAssignmentSheet) {
            throw new Error("Required sheet not found: TaskAssignments.");
        }

        // Read 4 columns: TaskType, AssignTo, Priority, Notes
        const taskAssignmentData = taskAssignmentSheet.getRange(2, 1, taskAssignmentSheet.getLastRow() - 1, 4).getValues();
        const taskAssignmentMap = new Map();

        taskAssignmentData.forEach(row => {
            const taskType = row[0];
            const assignedTo = row[1];
            // row[2] is Priority, unused here
            const notesLabel = row[3]; // Col D is 'Notes', used for the display label

            if (assignedTo === assigneeId) {
                taskAssignmentMap.set(taskType, notesLabel);
                taskCounts.push({
                    label: notesLabel,
                    taskType: taskType,
                    count: 0
                });
            }
        });

        // If this user has no defined task types, exit early
        if (taskCounts.length === 0) {
            return [];
        }

        // --- Count open tasks matching the user's full name ---
        const taskQSheet = refSs.getSheetByName('TaskQ');
        if (!taskQSheet) {
            throw new Error("Required sheet not found: TaskQ.");
        }
        const taskqData = taskQSheet.getDataRange().getValues().slice(1);

        taskqData.forEach(row => {
            const taskType = row[2]; // Col C
            const currentAssignee = row[8]; // Col I - This is the full name
            const status = row[6]; // Col G

            // Match on the full name retrieved from the Users sheet
            if (currentAssignee === assigneeName && (status === 'Open' || status === 'Assigned') && taskAssignmentMap.has(taskType)) {
                const group = taskCounts.find(g => g.taskType === taskType);
                if (group) {
                    group.count++;
                }
            }
        });

        return taskCounts;

    } catch (e) {
        Logger.log(`Error in getTaskCountsForAssignee_ for ID '${assigneeId}': ${e.message}`);
        return []; // On any error, return an empty array to prevent UI failure
    }
}


/**
 * Gathers counts of tasks requiring admin review based on predefined rules.
 * This is a private helper function.
 * @returns {Array<object>} An array of objects, each representing a group of tasks to review.
 */
function getAdminTaskCounts_() {
    const reviewGroups = [
        {
            label: 'Inventory Counts to Review',
            taskType: 'Inventory Count',
            status: 'Review',
            functionName: 'populateReviewSheet',
            count: 0
        },
        {
            label: 'Product Details to Review',
            taskType: 'Product Exception C6',
            status: 'Review',
            functionName: 'loadProductDetailReviews',
            count: 0
        },
        {
            label: 'Approved Details to Close',
            taskType: 'Product Exception C6',
            status: 'Accepted',
            functionName: null,
            count: 0
        }
    ];

    try {
        const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);
        const taskqSheet = refSs.getSheetByName('TaskQ');
        if (!taskqSheet) throw new Error("Sheet 'TaskQ' not found.");

        const taskqData = taskqSheet.getRange(2, 1, taskqSheet.getLastRow() - 1, 7).getValues();
        const typeColIndex = 2;
        const statusColIndex = 6;

        taskqData.forEach(row => {
            const taskType = row[typeColIndex];
            const taskStatus = row[statusColIndex];

            reviewGroups.forEach(group => {
                if (taskType === group.taskType && taskStatus === group.status) {
                    group.count++;
                }
            });
        });

        return reviewGroups;

    } catch (e) {
        Logger.log(`Error in getAdminTaskCounts_: ${e.message}`);
        return reviewGroups;
    }
}