/**
 * @file ProductDetails.gs
 * @description Handles the Product Detail Update workflow.
 */

/**
 * Server-side worker to get product detail tasks from TaskQ and write them to the sheet.
 * @param {string} selectedFilterUser The user name to filter by, or 'All Users'.
 * @returns {object} A result object with status and data.
 */
function _server_getProductDetailTasks(selectedFilterUser) {
    try {
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const taskqData = taskqSheet.getDataRange().getValues();
        const headers = taskqData.shift();

        const typeCol = headers.indexOf('Type');
        const statusCol = headers.indexOf('Status');
        const assignedToCol = headers.indexOf('AssignedTo');
        const skuCol = headers.indexOf('RelatedEntity');
        const detailsCol = headers.indexOf('Details');
        
        if ([typeCol, statusCol, assignedToCol, skuCol, detailsCol].includes(-1)) {
            throw new Error("Could not find required columns (Type, Status, SKU, etc.) in TaskQ.");
        }

        const detailTasks = taskqData.filter(row => {
            const type = row[typeCol]?.toString().trim();
            const status = row[statusCol]?.toString().trim().toLowerCase();
            const assignedTo = row[assignedToCol]?.toString().trim().toLowerCase();
            
            const userMatch = (selectedFilterUser && selectedFilterUser.toLowerCase() !== 'all users') 
                ? (assignedTo === selectedFilterUser.toLowerCase()) 
                : true;

            return type === 'Product Exception C6' && status === 'assigned' && userMatch;
        });
        
        const sheetName = 'ProductDetails';
        
        const outputData = detailTasks.map(row => [
            row[skuCol],
            row[detailsCol]
        ]);

        writeProductDetailsToSheet(outputData, sheetName);

        if (detailTasks.length === 0) {
            return { status: 'success', data: [], message: `No open product detail tasks found for ${selectedFilterUser}.`};
        }

        return { status: 'success', data: outputData, message: `${outputData.length} task(s) loaded.` };

    } catch (e) {
        Logger.log(`_server_getProductDetailTasks Error: ${e.message}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Server-side worker to get NEW PRODUCT tasks from TaskQ and write them to the sheet.
 * @param {string} selectedFilterUser The user name to filter by, or 'All Users'.
 * @returns {object} A result object with status and data.
 */
function _server_getNewProductTasks(selectedFilterUser) {
    try {
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const taskqData = taskqSheet.getDataRange().getValues();
        const headers = taskqData.shift();

        const typeCol = headers.indexOf('Type');
        const statusCol = headers.indexOf('Status');
        const assignedToCol = headers.indexOf('AssignedTo');
        const skuCol = headers.indexOf('RelatedEntity');
        const detailsCol = headers.indexOf('Details');
        
        if ([typeCol, statusCol, assignedToCol, skuCol, detailsCol].includes(-1)) {
            throw new Error("Could not find required columns (Type, Status, SKU, etc.) in TaskQ.");
        }

        const newProductTasks = taskqData.filter(row => {
            const type = row[typeCol]?.toString().trim();
            const status = row[statusCol]?.toString().trim().toLowerCase();
            const assignedTo = row[assignedToCol]?.toString().trim().toLowerCase();
            
            const userMatch = (selectedFilterUser && selectedFilterUser.toLowerCase() !== 'all users') 
                ? (assignedTo === selectedFilterUser.toLowerCase()) 
                : true;

            return type === 'New Product' && status === 'assigned' && userMatch;
        });
        
        const sheetName = 'ProductDetails';
        
        const outputData = newProductTasks.map(row => [
            row[skuCol],
            row[detailsCol]
        ]);

        writeProductDetailsToSheet(outputData, sheetName);

        if (newProductTasks.length === 0) {
            return { status: 'success', data: [], message: `No open new product tasks found for ${selectedFilterUser}.`};
        }

        return { status: 'success', data: outputData, message: `${outputData.length} new product task(s) loaded.` };

    } catch (e) {
        Logger.log(`_server_getNewProductTasks Error: ${e.message}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Writes the fetched product detail tasks to the frontend sheet.
 * @param {Array<Array<string>>} data The rows of task data to write.
 * @param {string} sheetName The name of the sheet to write to.
 */
function writeProductDetailsToSheet(data, sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    }
    
    sheet.clear();
    ss.setActiveSheet(sheet);

    const headers = ["SKU", "Details"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    
    if (data && data.length > 0) {
        sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    } else {
        sheet.getRange(2, 1).setValue("No tasks to display.");
    }
    
    sheet.autoResizeColumns(1, headers.length);
    SpreadsheetApp.flush();
}

/**
 * Server-side function to launch the modal dialog for editing details.
 * @param {string} sku The SKU of the product to edit.
 * @param {string} selectedUser The currently selected user from the sidebar filter.
 */
function showDetailsForm(sku, selectedUser) {
    if (!sku) {
        throw new Error("Please select a product from the list first.");
    }

    try {
        const htmlTemplate = HtmlService.createTemplateFromFile('DetailsForm.html');
        htmlTemplate.sku = sku;
        htmlTemplate.selectedUser = selectedUser || 'All Users';
        
        const htmlOutput = htmlTemplate.evaluate().setWidth(700).setHeight(600);
        SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Product Detail Editor');
    } catch (e) {
        throw new Error(`Could not open form. Please ensure 'DetailsForm.html' exists. Original error: ${e.message}`);
    }
}

/**
 * Gets the SKU from the currently active cell in the ProductDetails sheet.
 * Defaults to the first data row if selection is invalid.
 * @returns {object} A result object with the status and SKU.
 */
function _server_getSkuFromActiveCell() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('ProductDetails');
        if (!sheet) {
            throw new Error("Sheet 'ProductDetails' not found. Please click 'List Updates' first.");
        }

        // If no products are listed (only a header row), throw error.
        if (sheet.getLastRow() < 2) {
            throw new Error("No products are available in the list.");
        }
        
        let rowToUse = sheet.getActiveCell().getRow();
        // If the selected row is the header or invalid, default to the first data row.
        if (rowToUse < 2) {
            rowToUse = 2;
        }
        
        const sku = sheet.getRange(rowToUse, 1).getValue();
        if (!sku) {
            throw new Error("Could not find a SKU in the selected row.");
        }
        
        return { status: 'success', sku: sku };

    } catch (e) {
        Logger.log(`_server_getSkuFromActiveCell Error: ${e.message}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Fetches all data needed for the product detail form.
 * @param {string} sku The SKU of the product to fetch details for.
 * @returns {object} An object containing product data, lookup lists, and all SKUs for navigation.
 */
function _server_getProductDetailsForForm(sku) {
    try {
        const refSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const detailsMSheet = refSS.getSheetByName('DetailsM');
        const comaxMSheet = refSS.getSheetByName('ComaxM');
        const grapesSheet = refSS.getSheetByName('Grapes');
        const kashrutSheet = refSS.getSheetByName('Kashrut');
        const textsSheet = refSS.getSheetByName('Texts');

        if (!detailsMSheet || !comaxMSheet || !grapesSheet || !kashrutSheet || !textsSheet) {
            throw new Error("A required master data or reference sheet could not be found.");
        }

        // --- Fetch Lookup Data ---
        const grapesData = grapesSheet.getRange("A2:C").getValues().filter(row => row[0]);
        const kashrutData = kashrutSheet.getRange("A2:D").getValues().filter(row => row[0]);
        const textsData = textsSheet.getDataRange().getValues(); // This is already fetched
        const regionsData = textsData.filter(row => row[3] === 'Region');

        // --- Fetch List of All SKUs for Navigation ---
        const frontendSS = SpreadsheetApp.getActiveSpreadsheet();
        const productListSheet = frontendSS.getSheetByName('ProductDetails');
        const allSkus = productListSheet.getLastRow() > 1 ? productListSheet.getRange(2, 1, productListSheet.getLastRow() - 1, 1).getValues().flat() : [];

        // --- Fetch Product-Specific Data ---
        const detailsMData = detailsMSheet.getDataRange().getValues();
        const detailsMHeaders = detailsMData.shift();
        const skuColM = detailsMHeaders.indexOf('SKU');
        const productRowM = detailsMData.find(row => row[skuColM]?.toString().trim() === sku);
        if (!productRowM) throw new Error(`Product with SKU '${sku}' not found in DetailsM.`);
        
        const productData = {};
        detailsMHeaders.forEach((header, index) => {
            const value = productRowM[index];
            productData[header] = (typeof value === 'string') ? value.trim() : value;
        });

        const comaxMData = comaxMSheet.getDataRange().getValues();
        const comaxMHeaders = comaxMData.shift();
        const skuColCmx = comaxMHeaders.indexOf('CMX SKU');
        const productRowCmx = comaxMData.find(row => row[skuColCmx]?.toString().trim() === sku);
        if (productRowCmx) {
            productData['CMX GROUP'] = productRowCmx[comaxMHeaders.indexOf('CMX GROUP')];
            productData['CMX YEAR'] = productRowCmx[comaxMHeaders.indexOf('CMX YEAR')];
            productData['CMX DIV'] = productRowCmx[comaxMHeaders.indexOf('CMX DIV')];
            productData['CMX SIZE'] = productRowCmx[comaxMHeaders.indexOf('CMX SIZE')];
        }

        return {
            status: 'success',
            productData: productData,
            allSkus: allSkus,
            lookupData: {
                grapes: grapesData,
                kashrut: kashrutData,
                regions: regionsData,
                texts: textsData // <<< ADD THIS LINE
            }
        };

    } catch (e) {
        Logger.log(`_server_getProductDetailsForForm Error: ${e.message} Stack: ${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * @function _server_submitProductDetails
 * @description Merges edits with original data, cleans types, upserts into DetailsS, updates the task, and refreshes the frontend.
 * @param {string} sku The SKU of the product being edited.
 * @param {object} editedData An object containing only the fields that were changed by the user.
 * @param {string} selectedUser The user filter from the sidebar, used for the refresh step.
 * @returns {object} A status object.
 */
function _server_submitProductDetails(sku, editedData, selectedUser) {
    Logger.log(`Submission started. SKU: ${sku}, User Filter: ${selectedUser}`);
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const refSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
        const taskqSheet = refSS.getSheetByName(G.SHEET_NAMES.TASKQ);
        const detailsSSheet = refSS.getSheetByName(G.SHEET_NAMES.DETAILS_S);
        const detailsMSheet = refSS.getSheetByName(G.SHEET_NAMES.DETAILS_M);

        // --- Part 1: Create the complete, clean proposed record ---
        const detailsMData = detailsMSheet.getDataRange().getValues();
        const detailsMHeaders = detailsMData.shift();
        const skuColM = detailsMHeaders.indexOf('SKU');
        
        const originalRow = detailsMData.find(r => r[skuColM] == sku);
        if (!originalRow) throw new Error(`Could not find original record for SKU ${sku} in DetailsM.`);

        const completeRecord = {};
        detailsMHeaders.forEach((header, i) => {
            // Start with the original value
            let value = originalRow[i];
            // If the user submitted an edit for this header, overwrite it
            if (editedData.hasOwnProperty(header)) {
                let submittedValue = editedData[header];
                // Clean and type-cast the submitted value
                if (typeof submittedValue === 'string') submittedValue = submittedValue.trim();
                if (submittedValue === '') {
                    value = null; // Use null for empty fields
                } else if (header === 'ABV' && !isNaN(parseFloat(submittedValue))) {
                    value = `${parseFloat(submittedValue)}%`;
                } else if (['Intensity', 'Complexity', 'Acidity', 'Decant'].includes(header) && !isNaN(parseInt(submittedValue))) {
                    value = parseInt(submittedValue); // Ensure ratings are integers
                } else {
                    value = submittedValue;
                }
            }
            completeRecord[header] = value;
        });
        const newRowArray = detailsMHeaders.map(header => completeRecord[header]);

        // --- Part 2: Upsert (Update or Insert) into DetailsS ---
        const detailsSData = detailsSSheet.getDataRange().getValues();
        const detailsSHeaders = detailsSData.shift() || detailsMHeaders; // Use M headers if S is empty
        const skuColS = detailsSHeaders.indexOf('SKU');
        let existingRowIndex = -1;
        if(skuColS > -1) {
            existingRowIndex = detailsSData.findIndex(r => r[skuColS] == sku);
        }

        if (existingRowIndex !== -1) {
            const sheetRow = existingRowIndex + 2; // +1 for 1-based index, +1 for header
            detailsSSheet.getRange(sheetRow, 1, 1, newRowArray.length).setValues([newRowArray]);
            Logger.log(`Updated existing submission for SKU ${sku} in DetailsS at row ${sheetRow}.`);
        } else {
            detailsSSheet.appendRow(newRowArray);
            Logger.log(`Appended new submission for SKU ${sku} to DetailsS.`);
        }

        // --- Part 3: Update TaskQ status ---
        const taskqData = taskqSheet.getDataRange().getValues();
        const tqHeaders = taskqData[0];
        const statusColIdx = tqHeaders.indexOf('Status');
        const entityColIdx = tqHeaders.indexOf('RelatedEntity');
        const typeColIdx = tqHeaders.indexOf('Type');

        for (let i = 1; i < taskqData.length; i++) {
            const taskType = taskqData[i][typeColIdx];
            if (taskqData[i][entityColIdx] == sku && 
                (taskType == 'Product Exception C6' || taskType == 'New Product') && 
                taskqData[i][statusColIdx].toLowerCase() == 'assigned') {
                taskqSheet.getRange(i + 1, statusColIdx + 1).setValue('Review');
                Logger.log(`Task for SKU ${sku} of type ${taskType} status updated to 'Review'.`);
                break; // Assuming one open task per SKU
            }
        }
        
        SpreadsheetApp.flush();

        // --- Part 4: Refresh the user-facing sheet automatically ---
        Logger.log(`Calling _server_getProductDetailTasks to refresh sheet for user: ${selectedUser}.`);
        _server_getProductDetailTasks(selectedUser);

        return { status: 'success', message: 'Submission and refresh successful.' };

    } catch (e) {
        Logger.log(`ERROR in _server_submitProductDetails: ${e.message}\nStack: ${e.stack}`);
        return { status: 'error', message: `Submission failed: ${e.message}` };
    } finally {
        lock.releaseLock();
        Logger.log(`Submission process finished for SKU: ${sku}. Lock released.`);
    }
}