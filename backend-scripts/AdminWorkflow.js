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
    return `An error occurred: ${e.message}`;
    }
}

/**
 * Marks all checkboxes in the 'Approve' column of the specified sheet as true.
 * @param {string} sheetName The name of the sheet to operate on.
 */
function markAllApprovedForCurrentReviewType(sheetName) {
    const ui = SpreadsheetApp.getUi();
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            ui.alert(`Error: Sheet "${sheetName}" not found.`);
            return;
        }

        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();

        if (values.length < 2) {
            ui.alert(`No data found in sheet "${sheetName}" to select.`);
            return;
        }

        const headers = values[0];
        const approveColIndex = headers.indexOf('Approve');

        if (approveColIndex === -1) {
            ui.alert(`Error: 'Approve' column not found in sheet "${sheetName}".`);
            return;
        }

        // Start from the second row (after headers)
        for (let i = 1; i < values.length; i++) {
            values[i][approveColIndex] = true; // Set checkbox to true
        }

        dataRange.setValues(values);
        ui.alert(`All items in "${sheetName}" have been marked for approval.`);

    } catch (e) {
        Logger.log(`Error in markAllApprovedForCurrentReviewType: ${e.message}`);
        ui.alert(`An error occurred while selecting all items: ${e.message}`);
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
    finalizeProductData();
    exportInventoryAdjustments();

    return "Product processing steps were called successfully.";
  } catch (e) {
    throw new Error('Product processing failed or was cancelled: ' + e.message);
  }
}

/**
 * Gets the last updated dates for the primary import files (WebProducts.csv and ComaxProducts.csv).
 * This function is used to check for file date mismatches before import.
 * @returns {object} An object containing the formatted dates, e.g., { webDate: 'YYYY-MM-DD', comaxDate: 'YYYY-MM-DD' }.
 * Returns 'Not found' if a file is missing or inaccessible.
 */
function getImportFileDates() {
    const timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const webFileName = activeConfig.importFileNames.webProducts;
    const comaxFileName = activeConfig.importFileNames.comaxProducts;

    let webDate = 'Not found';
    let comaxDate = 'Not found';

    // Safely try to get the date for the web products file
    try {
        const webFile = getFileFromImportFolder(webFileName);
        webDate = Utilities.formatDate(webFile.getLastUpdated(), timeZone, 'yyyy-MM-dd');
    } catch (e) {
        Logger.log(`Could not find or access ${webFileName}: ${e.message}`);
    }

    // Safely try to get the date for the Comax products file
    try {
        const comaxFile = getFileFromImportFolder(comaxFileName);
        comaxDate = Utilities.formatDate(comaxFile.getLastUpdated(), timeZone, 'yyyy-MM-dd');
    } catch (e) {
        Logger.log(`Could not find or access ${comaxFileName}: ${e.message}`);
    }

    return { webDate, comaxDate };
}
// --- Sidebar Data Functions ---

/**
 * Main data endpoint for the Operations Hub sidebar.
 * Fetches all necessary data in a single server call.
 * @returns {object} An object containing data for all sidebar panels.
 */
function getSidebarData() {
    return {
        invoiceFileCount: getInvoiceFileCount_(),
        adminTasks: getAdminTaskCounts_(),
        taskPanel: getTaskPanelInfo(),
        bwTasks: getTaskCountsForAssignee_('BW')
    };
}

/**
 * Counts the number of specific file types in the designated invoice folder, ignoring shortcuts.
 * @returns {number} The count of relevant files in the folder.
 */
function getInvoiceFileCount_() {
    try {
        const folder = DriveApp.getFolderById(activeConfig.invoiceFolderId);
        const files = folder.getFiles();
        let count = 0;

        const allowedMimeTypes = [
            // Documents
            MimeType.GOOGLE_DOCS,
            MimeType.MICROSOFT_WORD,
            MimeType.PDF,
            // Spreadsheets
            MimeType.GOOGLE_SHEETS,
            MimeType.MICROSOFT_EXCEL,
            // Images
            MimeType.BMP,
            MimeType.GIF,
            MimeType.JPEG,
            MimeType.PNG
        ];

        while (files.hasNext()) {
            const file = files.next();
            const mimeType = file.getMimeType();

            // Skip shortcuts entirely
            if (mimeType === MimeType.SHORTCUT) {
                continue;
            }

            // Check if the file is one of the allowed types
            if (allowedMimeTypes.includes(mimeType)) {
                count++;
            }
        }
        return count;
    } catch (e) {
        Logger.log(`Error counting invoice files: ${e.message}`);
        return 0; // Return 0 on error to prevent breaking the sidebar
    }
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
            label: 'New Product Suggestions',
            taskType: 'New Product',
            status: 'New',
            functionName: 'showNewProductSuggestions',
            processFunctionName: 'processNewProductApprovals',
            sheetName: 'ProductsNew',
            count: 0
        },
        {
            label: 'Product Review Tasks', // Combined label for both New Product and Product Exception C6
            taskType: ['New Product', 'Product Exception C6'], // Combined task types
            status: 'Review',
            functionName: 'loadProductDetailReviews', // Function to load the combined review sheet
            processFunctionName: 'processProductDetailApprovals', // Function to process approvals for both
            sheetName: 'Product Detail Review', // The sheet where both are reviewed
            count: 0
        },
        {
            label: 'Inventory Counts to Review',
            taskType: ['Inventory Count', 'Inventory Exception D2'], // Now an array
            status: 'Review',
            functionName: 'populateReviewSheet',
            processFunctionName: 'processAndExportReviewedInventory',
            sheetName: 'Inventory Review',
            count: 0
        },
        {
            label: 'Approved Details to Close',
            taskType: 'Product Exception C6',
            status: 'Accepted',
            functionName: 'loadAcceptedDetailReviews',
            processFunctionName: 'processFinalDetailClosures',
            sheetName: 'CloseAccepted',
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
                const taskTypeMatch = Array.isArray(group.taskType) ? group.taskType.includes(taskType) : taskType === group.taskType;
                if (taskTypeMatch && taskStatus === group.status) {
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

/**
 * Displays a sheet with new product suggestions for admin approval, enriched with ComaxM data.
 */
function showNewProductSuggestions() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'ProductsNew';
    let sheet = ss.getSheetByName(sheetName);

    const headers = ["Approve", "SKU", "NAME", "DIV", "GROUP", "PRICE", "STOCK", "NAME HE", "NAME EN"];

    if (!sheet) {
        sheet = ss.insertSheet(sheetName, 0);
    } else {
        sheet.clear();
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);


    ss.setActiveSheet(sheet);

    try {
        const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);

        // 1. Get ComaxM data and create a lookup map
        const comaxMSheet = refSs.getSheetByName('ComaxM');
        if (!comaxMSheet) throw new Error("Sheet 'ComaxM' not found.");
        const comaxMData = comaxMSheet.getDataRange().getValues();
        const comaxMHeaders = comaxMData.shift();
        const comaxSkuCol = comaxMHeaders.indexOf('CMX SKU');
        const comaxNameCol = comaxMHeaders.indexOf('CMX NAME');
        const comaxDivCol = comaxMHeaders.indexOf('CMX DIV');
        const comaxGroupCol = comaxMHeaders.indexOf('CMX GROUP');
        const comaxPriceCol = comaxMHeaders.indexOf('CMX PRICE');
        const comaxStockCol = comaxMHeaders.indexOf('CMX STOCK');
        const comaxMMap = new Map(comaxMData.map(row => [row[comaxSkuCol], row]));

        // 2. Get New Product tasks
        const taskqSheet = refSs.getSheetByName('TaskQ');
        if (!taskqSheet) throw new Error("Sheet 'TaskQ' not found.");
        const taskqData = taskqSheet.getDataRange().getValues();
        const taskqHeaders = taskqData.shift();
        const typeCol = taskqHeaders.indexOf('Type');
        const statusCol = taskqHeaders.indexOf('Status');
        const entityCol = taskqHeaders.indexOf('RelatedEntity');
        const detailsCol = taskqHeaders.indexOf('Details');

        const suggestions = taskqData.filter(row => row[typeCol] === 'New Product' && row[statusCol] === 'New');

        if (suggestions.length === 0) {
            sheet.getRange(2, 1).setValue("No new product suggestions found.");
            SpreadsheetApp.flush();
            ui.alert("No new product suggestions found.");
            return;
        }

        const outputData = suggestions.map(taskRow => {
            const sku = taskRow[entityCol];
            const comaxData = comaxMMap.get(sku) || [];
            return [
                false, // A: Approve
                sku, // B: SKU
                comaxData[comaxNameCol] || 'N/A', // C: NAME
                comaxData[comaxDivCol] || 'N/A', // D: DIV
                comaxData[comaxGroupCol] || 'N/A', // E: GROUP
                comaxData[comaxPriceCol] || 'N/A', // F: PRICE
                comaxData[comaxStockCol] || 'N/A', // G: STOCK
                '', // H: NAME HE (for user input)
                '' // I: NAME EN (for user input)
            ];
        });

        // Sort by Division (column D, index 3), then by Name (column C, index 2)
        outputData.sort((a, b) => {
            const divA = a[3];
            const divB = b[3];
            const nameA = a[2];
            const nameB = b[2];

            if (divA < divB) return -1;
            if (divA > divB) return 1;
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });

        const range = sheet.getRange(2, 1, outputData.length, outputData[0].length);
        range.setValues(outputData);

        sheet.getRange(2, 1, outputData.length).insertCheckboxes();
        sheet.autoResizeColumns(1, headers.length);
        ss.setActiveSheet(sheet);

        return "New product suggestions sheet is ready.";

    } catch (e) {
        Logger.log(`Error in showNewProductSuggestions: ${e.message}`);
        ui.alert(`An error occurred while loading suggestions: ${e.message}`);
    }
}


/**
 * Processes approved new product suggestions, creating new tasks for them and populating DetailsM.
 */
function processNewProductApprovals(expectedSheetName) {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(expectedSheetName);

    if (!sheet) {
        ui.alert(`Error: The expected sheet "${expectedSheetName}" was not found. Please re-run the report.`);
        return;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const approveCol = headers.indexOf("Approve");
    const skuCol = headers.indexOf("SKU");
    const heNameCol = headers.indexOf("NAME HE");
    const enNameCol = headers.indexOf("NAME EN");

    if ([approveCol, skuCol, heNameCol, enNameCol].includes(-1)) {
        ui.alert("Error: Could not find one of the required columns: Approve, SKU, NAME HE, NAME EN.");
        return;
    }

    const approvedItems = data.filter(row => row[approveCol] === true);

    if (approvedItems.length === 0) {
        ui.alert("No products were marked for approval.");
        return;
    }

    // --- Validation Step ---
    const invalidItems = approvedItems.filter(item => !item[heNameCol] || !item[enNameCol]);
    if (invalidItems.length > 0) {
        const invalidSkus = invalidItems.map(item => item[skuCol]).join(', ');
        ui.alert(`Error: The following approved SKUs are missing required names: ${invalidSkus}. Please fill in both 'NAME HE' and 'NAME EN' for all approved products.`);
        return;
    }

    try {
        // --- Get Config for Assignee ---
        const configSheet = ss.getSheetByName('Config');
        if (!configSheet) throw new Error("Sheet 'Config' not found.");
        const configData = configSheet.getRange('A2:B' + configSheet.getLastRow()).getValues();
        const config = {};
        for (const row of configData) {
            if (row[0]) config[row[0]] = row[1];
        }
        const defaultAssigneeId = config.TaskCreator_DefaultAssignee;
        if (!defaultAssigneeId) {
            throw new Error("Config error: 'TaskCreator_DefaultAssignee' is missing.");
        }

        const refSs = SpreadsheetApp.openById(activeConfig.referenceFileId);

        const usersSheet = refSs.getSheetByName('Users');
        if (!usersSheet) throw new Error("Sheet 'Users' not found in Reference file.");
        const userData = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, 2).getValues();
        const userMap = new Map(userData.map(row => [row[0], row[1]])); // Map of ID -> Name
        const assigneeName = userMap.get(defaultAssigneeId) || defaultAssigneeId;

        // --- 1. Update DetailsM ---
        const detailsMSheet = refSs.getSheetByName('DetailsM');
        if (!detailsMSheet) {
            throw new Error("DetailsM sheet not found in reference file.");
        }
        const detailsMHeaders = detailsMSheet.getRange(1, 1, 1, detailsMSheet.getLastColumn()).getValues()[0];
        const detailsMSkuCol = detailsMHeaders.indexOf('SKU');
        const detailsMHeNameCol = detailsMHeaders.indexOf('שם היין');
        const detailsMEnNameCol = detailsMHeaders.indexOf('NAME');

        const newDetailsMRows = approvedItems.map(item => {
            const newRow = Array(detailsMHeaders.length).fill('');
            newRow[detailsMSkuCol] = item[skuCol];
            newRow[detailsMHeNameCol] = item[heNameCol];
            newRow[detailsMEnNameCol] = item[enNameCol];
            return newRow;
        });

        if (newDetailsMRows.length > 0) {
            detailsMSheet.getRange(detailsMSheet.getLastRow() + 1, 1, newDetailsMRows.length, newDetailsMRows[0].length).setValues(newDetailsMRows);
        }

        // --- 2. Update TaskQ ---
        const taskqSheet = refSs.getSheetByName('TaskQ');
        const taskqData = taskqSheet.getDataRange().getValues();
        const taskqHeaders = taskqData[0];
        const typeCol = taskqHeaders.indexOf('Type');
        const statusCol = taskqHeaders.indexOf('Status');
        const entityCol = taskqHeaders.indexOf('RelatedEntity');
        const detailsCol = taskqHeaders.indexOf('Details');
        const assignedToCol = taskqHeaders.indexOf('AssignedTo');

        const approvedSkus = new Set(approvedItems.map(item => item[skuCol]));
        const originalTaskDetails = new Map();

        // Close original 'New Product' tasks and get their details
        for (let i = 1; i < taskqData.length; i++) {
            const row = taskqData[i];
            const sku = row[entityCol];
            if (row[typeCol] === 'New Product' && row[statusCol] === 'New' && approvedSkus.has(sku)) {
                taskqSheet.getRange(i + 1, statusCol + 1).setValue('Closed');
                originalTaskDetails.set(sku, row[detailsCol]);
            }
        }

        const timestamp = new Date();
        const sessionId = timestamp.getTime();
        let newTasks = [];

        // Create new 'New Product' tasks with status 'Assigned'
        approvedItems.forEach(item => {
            const sku = item[skuCol];
            let newTaskRow = Array(taskqHeaders.length).fill('');
            newTaskRow[taskqHeaders.indexOf('Timestamp')] = timestamp;
            newTaskRow[taskqHeaders.indexOf('SessionID')] = sessionId;
            newTaskRow[taskqHeaders.indexOf('Type')] = 'New Product';
            newTaskRow[taskqHeaders.indexOf('Source')] = 'Admin';
            newTaskRow[taskqHeaders.indexOf('RelatedEntity')] = sku;
            newTaskRow[taskqHeaders.indexOf('Status')] = 'Assigned';
            newTaskRow[taskqHeaders.indexOf('Priority')] = 'Medium';
            newTaskRow[detailsCol] = originalTaskDetails.get(sku) || ''; // Use original details
            newTaskRow[assignedToCol] = assigneeName;
            newTasks.push(newTaskRow);
        });

        if (newTasks.length > 0) {
            taskqSheet.getRange(taskqSheet.getLastRow() + 1, 1, newTasks.length, newTasks[0].length).setValues(newTasks);
        }

        // --- 3. Clean up ---
        sheet.clearContents().getRange(1,1,1,headers.length).setValues([headers]);
        sheet.getRange("A2").setValue("Processed items have been cleared.");

        return `Successfully processed ${approvedItems.length} new product suggestion(s).`;

    } catch (e) {
        Logger.log(`Error in processNewProductApprovals: ${e.message}`);
        ui.alert(`An error occurred: ${e.message}`);
    }
}