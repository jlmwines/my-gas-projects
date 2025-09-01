/**
 * @file StockHealth.gs
 * @description Handles the logic for the "New Products" section of the dashboard.
 * @version 2025-08-11-1650-FINAL
 */

/**
 * Main server-side function to check product stock levels against configured 'MinCat' rules.
 * This is the engine for the "New Products" sidebar section.
 * @returns {object} A result object with the status and an array of deficiency data.
 */
function _server_getStockHealthNeeds() {
    try {
        // --- 1. Fetch all necessary data ---
        const configSheet = getReferenceSheet(G.SHEET_NAMES.CONFIG);
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);

        const configData = configSheet.getDataRange().getValues();
        const comaxData = comaxSheet.getDataRange().getValues();
        const taskqData = taskqSheet.getDataRange().getValues();

        const comaxHeaders = comaxData.shift();
        const taskqHeaders = taskqData.shift();

        // --- 2. Pre-process data for efficiency ---
        const stockHealthRules = configData.filter(row =>
            String(row[0] || '').trim() === 'StockHealth' &&
            String(row[1] || '').trim() === 'MinCat'
        );

        const CMX = {
            SKU: comaxHeaders.indexOf('CMX SKU'),
            GROUP: comaxHeaders.indexOf('CMX GROUP'),
            STOCK: comaxHeaders.indexOf('CMX STOCK'),
            WEB: comaxHeaders.indexOf('CMX WEB'),
            ARCHIVE: comaxHeaders.indexOf('CMX ARCHIVE')
        };

        const TQ = {
            TYPE: taskqHeaders.indexOf('Type'),
            ENTITY: taskqHeaders.indexOf('RelatedEntity'),
            STATUS: taskqHeaders.indexOf('Status')
        };

        const inFlightCandidateSkus = new Set(
            taskqData
            .filter(row =>
                String(row[TQ.TYPE] || '').trim() === 'New Product' &&
                String(row[TQ.STATUS] || '').trim() !== 'Closed'
            )
            .map(row => String(row[TQ.ENTITY] || '').trim())
        );

        const deficiencies = [];

        // --- 3. Evaluate each 'MinCat' rule ---
        stockHealthRules.forEach(rule => {
            const category = String(rule[3] || '').trim();
            const requiredCount = parseInt(rule[4], 10);

            if (!category || isNaN(requiredCount)) return;

            // Find all products in the target category first
            const productsInCategory = comaxData.filter(p => String(p[CMX.GROUP] || '').trim() === category);

            // Count products that are currently live and in stock
            const currentInStockCount = productsInCategory.filter(p =>
                String(p[CMX.WEB] || '').trim() === 'כן' &&
                (parseInt(p[CMX.STOCK], 10) || 0) > 0 &&
                String(p[CMX.ARCHIVE] || '').trim() === ''
            ).length;

            // Count products that are "in-flight" candidates
            const inFlightCandidateCount = productsInCategory.filter(p => {
                const sku = String(p[CMX.SKU] || '').trim();
                return String(p[CMX.WEB] || '').trim() !== 'כן' &&
                       String(p[CMX.ARCHIVE] || '').trim() === '' &&
                       inFlightCandidateSkus.has(sku);
            }).length;

            const finalCount = currentInStockCount + inFlightCandidateCount;

            if (finalCount < requiredCount) {
                const deficiency = requiredCount - finalCount;
                deficiencies.push({
                    description: `'${category}'`,
                    deficiency: deficiency,
                    filter: {
                        category: category
                    }
                });
            }
        });

        return { status: 'success', data: deficiencies };

    } catch (e) {
        Logger.log(`_server_getStockHealthNeeds Error: ${e.message} Stack: ${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Creates/clears the NewProducts sheet and populates it with a pre-filtered
 * list of eligible products that match a specific 'MinCat' need.
 * @param {object} filter An object containing {category}.
 * @returns {object} A result object with status and message.
 */
function _server_populateAndFilterNewProducts(filter) {
    try {
const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'NewProducts';

    // --- 1. Delete and recreate the sheet for a guaranteed clean slate ---
    let oldSheet = ss.getSheetByName(sheetName);
    if (oldSheet) {
        ss.deleteSheet(oldSheet);
    }
    const sheet = ss.insertSheet(sheetName);
    
    // --- 2. Set Sheet Properties ---
    sheet.setRightToLeft(true);
    const headers = ["Suggest", "SKU", "Category", "Name", "Price", "Stock"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);

        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);

        const comaxData = comaxSheet.getDataRange().getValues();
        const taskqData = taskqSheet.getDataRange().getValues();

        const comaxHeaders = comaxData.shift();
        const taskqHeaders = taskqData.shift();

        const CMX = {
            SKU: comaxHeaders.indexOf('CMX SKU'),
            GROUP: comaxHeaders.indexOf('CMX GROUP'),
            NAME: comaxHeaders.indexOf('CMX NAME'),
            PRICE: comaxHeaders.indexOf('CMX PRICE'),
            STOCK: comaxHeaders.indexOf('CMX STOCK'),
            WEB: comaxHeaders.indexOf('CMX WEB'),
            ARCHIVE: comaxHeaders.indexOf('CMX ARCHIVE')
        };
        
        const TQ = {
            TYPE: taskqHeaders.indexOf('Type'),
            ENTITY: taskqHeaders.indexOf('RelatedEntity'),
            STATUS: taskqHeaders.indexOf('Status')
        };

        const inFlightCandidateSkus = new Set(
            taskqData
            .filter(row =>
                String(row[TQ.TYPE] || '').trim() === 'New Product' &&
                String(row[TQ.STATUS] || '').trim() !== 'Closed'
            )
            .map(row => String(row[TQ.ENTITY] || '').trim())
        );
        
        const eligibleProducts = comaxData.filter(p => {
            const sku = String(p[CMX.SKU] || '').trim();
            if (!sku) return false;

            // --- Core Eligibility Criteria ---
            const isCorrectCategory = String(p[CMX.GROUP] || '').trim() === filter.category;
            const hasStock = (parseInt(p[CMX.STOCK], 10) || 0) > 0;
            const isNotOnWeb = String(p[CMX.WEB] || '').trim() !== 'כן';
            const isNotArchived = String(p[CMX.ARCHIVE] || '').trim() === '';
            const isNotAlreadyCandidate = !inFlightCandidateSkus.has(sku);

            return isCorrectCategory && hasStock && isNotOnWeb && isNotArchived && isNotAlreadyCandidate;
        });
        
        eligibleProducts.sort((a, b) => String(a[CMX.NAME]).localeCompare(String(b[CMX.NAME])));

        const rowsToWrite = eligibleProducts.map(p => [false, p[CMX.SKU], p[CMX.GROUP], p[CMX.NAME], p[CMX.PRICE], p[CMX.STOCK]]);

        if (rowsToWrite.length === 0) {
            sheet.getRange(2, 1).setValue(`No new eligible products found for category '${filter.category}'.`);
        } else {
            sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
            const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
            sheet.getRange(2, 1, rowsToWrite.length).setDataValidation(rule);
        }
        
        sheet.autoResizeColumns(1, headers.length);
        sheet.activate();

        return { status: 'success', message: `Sheet populated for category: ${filter.category}.` };

    } catch (e) {
        Logger.log(`_server_populateAndFilterNewProducts Error: ${e.message} Stack: ${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Populates the NewProducts sheet with a list of optional wines to add,
 * based on specific business criteria (Division 1, not on web, price > 34, etc.).
 * @returns {object} A result object with status and message.
 */
function _server_populateOptionalWines() {
    try {
const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'NewProducts';

    // --- 1. Delete and recreate the sheet for a guaranteed clean slate ---
    let oldSheet = ss.getSheetByName(sheetName);
    if (oldSheet) {
        ss.deleteSheet(oldSheet);
    }
    const sheet = ss.insertSheet(sheetName);
    
    // --- 2. Set Sheet Properties ---
    sheet.setRightToLeft(true);
    const headers = ["Suggest", "SKU", "Category", "Name", "Price", "Stock"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);

        // --- 3. Fetch Data ---
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const comaxData = comaxSheet.getDataRange().getValues();
        const taskqData = taskqSheet.getDataRange().getValues();
        const comaxHeaders = comaxData.shift();
        const taskqHeaders = taskqData.shift();

        const CMX = {
            SKU: comaxHeaders.indexOf('CMX SKU'),
            GROUP: comaxHeaders.indexOf('CMX GROUP'),
            NAME: comaxHeaders.indexOf('CMX NAME'),
            PRICE: comaxHeaders.indexOf('CMX PRICE'),
            STOCK: comaxHeaders.indexOf('CMX STOCK'),
            WEB: comaxHeaders.indexOf('CMX WEB'),
            ARCHIVE: comaxHeaders.indexOf('CMX ARCHIVE'),
            DIV: comaxHeaders.indexOf('CMX DIV')
        };
        
        const TQ = {
            TYPE: taskqHeaders.indexOf('Type'),
            ENTITY: taskqHeaders.indexOf('RelatedEntity'),
            STATUS: taskqHeaders.indexOf('Status')
        };

        const inFlightCandidateSkus = new Set(
            taskqData
            .filter(row => String(row[TQ.TYPE] || '').trim() === 'New Product' && String(row[TQ.STATUS] || '').trim() !== 'Closed')
            .map(row => String(row[TQ.ENTITY] || '').trim())
        );
        
        // --- 4. Filter for Eligible Optional Wines ---
        const eligibleProducts = comaxData.filter(p => {
            const sku = String(p[CMX.SKU] || '').trim();
            if (!sku) return false;

            const isWine = String(p[CMX.DIV] || '').trim() === '1';
            const hasStock = (parseInt(p[CMX.STOCK], 10) || 0) > 0;
            const isNotOnWeb = String(p[CMX.WEB] || '').trim() !== 'כן';
            const isNotArchived = String(p[CMX.ARCHIVE] || '').trim() === '';
            const meetsMinPrice = (parseFloat(p[CMX.PRICE]) || 0) > 34;
            const isNotAlreadyCandidate = !inFlightCandidateSkus.has(sku);

            return isWine && hasStock && isNotOnWeb && isNotArchived && meetsMinPrice && isNotAlreadyCandidate;
        });
        
        // --- 5. Sort the results: Price (Low to High) -> Name ---
        eligibleProducts.sort((a, b) => {
            const priceA = parseFloat(a[CMX.PRICE]) || 0;
            const priceB = parseFloat(b[CMX.PRICE]) || 0;
            if (priceA !== priceB) {
                return priceA - priceB; // Primary sort: Price, low to high
            }

            return String(a[CMX.NAME]).localeCompare(String(b[CMX.NAME])); // Secondary sort: Name, alphabetical
        });

        // --- 6. Limit results and write to sheet ---
        const rowsToWrite = eligibleProducts.slice(0, 100).map(p => [false, p[CMX.SKU], p[CMX.GROUP], p[CMX.NAME], p[CMX.PRICE], p[CMX.STOCK]]);

        if (rowsToWrite.length === 0) {
            sheet.getRange(2, 1).setValue('No optional wines meeting the criteria were found.');
        } else {
            sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
            const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
            sheet.getRange(2, 1, rowsToWrite.length).setDataValidation(rule);
        }
        
        sheet.autoResizeColumns(1, headers.length);
        sheet.activate();

        return { status: 'success', message: `Sheet populated with ${rowsToWrite.length} optional wines.` };

    } catch (e) {
        Logger.log(`_server_populateOptionalWines Error: ${e.message} Stack: ${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Populates the NewProducts sheet with a list of optional "other" products
 * based on their division number.
 * @returns {object} A result object with status and message.
 */
function _server_populateOtherProducts() {
    try {
const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'NewProducts';

    // --- 1. Delete and recreate the sheet for a guaranteed clean slate ---
    let oldSheet = ss.getSheetByName(sheetName);
    if (oldSheet) {
        ss.deleteSheet(oldSheet);
    }
    const sheet = ss.insertSheet(sheetName);
    
    // --- 2. Set Sheet Properties ---
    sheet.setRightToLeft(true);
    const headers = ["Suggest", "SKU", "Category", "Name", "Price", "Stock"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);

        // --- 3. Fetch Data ---
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const comaxData = comaxSheet.getDataRange().getValues();
        const taskqData = taskqSheet.getDataRange().getValues();
        const comaxHeaders = comaxData.shift();
        const taskqHeaders = taskqData.shift();

        const CMX = {
            SKU: comaxHeaders.indexOf('CMX SKU'),
            GROUP: comaxHeaders.indexOf('CMX GROUP'),
            NAME: comaxHeaders.indexOf('CMX NAME'),
            PRICE: comaxHeaders.indexOf('CMX PRICE'),
            STOCK: comaxHeaders.indexOf('CMX STOCK'),
            WEB: comaxHeaders.indexOf('CMX WEB'),
            ARCHIVE: comaxHeaders.indexOf('CMX ARCHIVE'),
            DIV: comaxHeaders.indexOf('CMX DIV')
        };
        
        const TQ = {
            TYPE: taskqHeaders.indexOf('Type'),
            ENTITY: taskqHeaders.indexOf('RelatedEntity'),
            STATUS: taskqHeaders.indexOf('Status')
        };

        const inFlightCandidateSkus = new Set(
            taskqData
            .filter(row => String(row[TQ.TYPE] || '').trim() === 'New Product' && String(row[TQ.STATUS] || '').trim() !== 'Closed')
            .map(row => String(row[TQ.ENTITY] || '').trim())
        );
        
        // --- 4. Filter for Eligible Optional Products ---
        const eligibleProducts = comaxData.filter(p => {
            const sku = String(p[CMX.SKU] || '').trim();
            if (!sku) return false;

            // --- THIS IS THE MODIFIED LOGIC ---
            const allowedDivs = ['3', '5', '7', '9'];
            const isOtherProduct = allowedDivs.includes(String(p[CMX.DIV] || '').trim());
            // --- END MODIFIED LOGIC ---

            const hasStock = (parseInt(p[CMX.STOCK], 10) || 0) > 0;
            const isNotOnWeb = String(p[CMX.WEB] || '').trim() !== 'כן';
            const isNotArchived = String(p[CMX.ARCHIVE] || '').trim() === '';
            const meetsMinPrice = (parseFloat(p[CMX.PRICE]) || 0) > 34;
            const isNotAlreadyCandidate = !inFlightCandidateSkus.has(sku);

            return isOtherProduct && hasStock && isNotOnWeb && isNotArchived && meetsMinPrice && isNotAlreadyCandidate;
        });
        
        // --- 5. Sort the results: Price (Low to High) -> Name ---
        eligibleProducts.sort((a, b) => {
            const priceA = parseFloat(a[CMX.PRICE]) || 0;
            const priceB = parseFloat(b[CMX.PRICE]) || 0;
            if (priceA !== priceB) {
                return priceA - priceB;
            }
            return String(a[CMX.NAME]).localeCompare(String(b[CMX.NAME]));
        });

        // --- 6. Limit results and write to sheet ---
        const rowsToWrite = eligibleProducts.slice(0, 100).map(p => [false, p[CMX.SKU], p[CMX.GROUP], p[CMX.NAME], p[CMX.PRICE], p[CMX.STOCK]]);

        if (rowsToWrite.length === 0) {
            sheet.getRange(2, 1).setValue('No other products meeting the criteria were found.');
        } else {
            sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
            const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
            sheet.getRange(2, 1, rowsToWrite.length).setDataValidation(rule);
        }
        
        sheet.autoResizeColumns(1, headers.length);
        sheet.activate();

        return { status: 'success', message: `Sheet populated with ${rowsToWrite.length} other products.` };

    } catch (e) {
        Logger.log(`_server_populateOtherProducts Error: ${e.message} Stack: ${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Reads checked items from the NewProducts sheet and creates 'New Product' tasks
 * in the taskq sheet. This is called by the 'Submit Suggestions' button.
 * @returns {object} A result object with status and message.
 */
function _sidebar_createNewProductTasks() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const newProductsSheet = ss.getSheetByName('NewProducts');

        if (!newProductsSheet) {
            return { status: 'error', message: 'NewProducts sheet not found.' };
        }

        const data = newProductsSheet.getDataRange().getValues();
        if (data.length < 2) {
             return { status: 'error', message: 'No products were found on the sheet to suggest.' };
        }

        const headers = data.shift();
        const suggestCol = headers.indexOf('Suggest');
        const skuCol = headers.indexOf('SKU');
        const nameCol = headers.indexOf('Name');

        if (suggestCol === -1 || skuCol === -1 || nameCol === -1) {
            return { status: 'error', message: 'Could not find required columns (Suggest, SKU, Name) in NewProducts sheet.' };
        }

        const productsToSubmit = data
            .filter(row => row[suggestCol] === true)
            .map(row => ({
                sku: row[skuCol],
                name: row[nameCol]
            }));

        if (productsToSubmit.length === 0) {
            return { status: 'error', message: 'No products were selected to suggest.' };
        }

        const taskqSheet = getReferenceSheet(G.SHEET_NAMES.TASKQ);
        const taskqHeaders = taskqSheet.getRange(1, 1, 1, taskqSheet.getLastColumn()).getValues()[0];
        
        const colMap = {
            Timestamp: taskqHeaders.indexOf('Timestamp'),
            SessionID: taskqHeaders.indexOf('SessionID'),
            Type: taskqHeaders.indexOf('Type'),
            Source: taskqHeaders.indexOf('Source'),
            RelatedEntity: taskqHeaders.indexOf('RelatedEntity'),
            Status: taskqHeaders.indexOf('Status'),
            Priority: taskqHeaders.indexOf('Priority'),
            Details: taskqHeaders.indexOf('Details')
        };
        
        const timestamp = new Date();
        const sessionId = timestamp.getTime(); // CHANGED: Removed "SUBMIT-" prefix

        const newTasks = productsToSubmit.map(product => {
            // CHANGED: Initialize a full-width array to prevent errors
            let taskRow = Array(taskqHeaders.length).fill(''); 
            
            taskRow[colMap.Timestamp] = timestamp;
            taskRow[colMap.SessionID] = sessionId;
            taskRow[colMap.Type] = 'New Product';
            taskRow[colMap.Source] = 'ComaxM';
            taskRow[colMap.RelatedEntity] = product.sku;
            taskRow[colMap.Status] = 'New';
            taskRow[colMap.Priority] = 'Medium';
            taskRow[colMap.Details] = product.name;
            return taskRow;
        });
        
        taskqSheet.getRange(taskqSheet.getLastRow() + 1, 1, newTasks.length, newTasks[0].length).setValues(newTasks);

        newProductsSheet.clear();
        const newProductsHeaders = ["Suggest", "SKU", "Category", "Name", "Price", "Stock"];
        newProductsSheet.getRange(1, 1, 1, newProductsHeaders.length).setValues([newProductsHeaders]).setFontWeight('bold');
        newProductsSheet.setFrozenRows(1);

        return { status: 'success', message: `Successfully created ${productsToSubmit.length} suggestion task(s).` };

    } catch (e) {
        Logger.log(`_sidebar_createNewProductTasks Error: ${e.message} 
${e.stack}`);
        return { status: 'error', message: e.message };
    }
}

/**
 * Public-facing function for the sidebar to call.
 */
function populateOtherProducts() {
  return _server_populateOtherProducts();
}