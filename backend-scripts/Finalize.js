/**
 * @file Finalize.gs
 * @version 25-07-14-0715
 * @description Accepts staging product data by overwriting Reference master sheets.
 * This version includes a dedicated test function to sync new products in isolation
 * and updates existing product stock in the Audit sheet from the correct column (P).
 */

// =================================================================
// TEST FUNCTION - Select this function in the editor and click "Run"
// =================================================================

/**
 * A standalone test function to run ONLY syncNewProductsToAudit.
 * This will not perform any of the other finalization steps.
 */
function testSyncOnly() {
    Logger.log('Running isolated sync test...');
    try {
        // This ID is used only for this isolated test.
        const refIdForTesting = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc';
        const referenceSS = SpreadsheetApp.openById(refIdForTesting);

        if (referenceSS) {
            syncNewProductsToAudit(referenceSS);
            Logger.log('Isolated sync test finished. Check the logs and the Audit sheet for results.');
            SpreadsheetApp.getUi().alert('Sync Test Complete', 'The sync process has finished. Check the Audit sheet and Execution Logs for details.', SpreadsheetApp.getUi().ButtonSet.OK);
        } else {
            const msg = 'Could not open the reference spreadsheet. Please check the ID inside the testSyncOnly function.';
            Logger.log(msg);
            SpreadsheetApp.getUi().alert('Error', msg, SpreadsheetApp.getUi().ButtonSet.OK);
        }
    } catch (e) {
        Logger.log(`A critical error occurred during testSyncOnly: ${e.message}`);
        SpreadsheetApp.getUi().alert('Critical Error', `An error occurred: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
}


// =================================================================
// PRODUCTION CODE
// =================================================================

/**
 * Finalizes all product data. This function is for live use.
 * For testing only the sync part, run testSyncOnly().
 */
function finalizeProductData() {
    const ui = SpreadsheetApp.getUi();
    const confirm = ui.alert(
        'Confirm Finalize',
        'Finalize will update master product files with the latest staging data and commit the current product state. Continue?',
        ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return false;

    try {
        const backendSS = SpreadsheetApp.getActiveSpreadsheet();
        let refId;

        if (typeof activeConfig !== 'undefined' && activeConfig.referenceFileId) {
            refId = activeConfig.referenceFileId;
        } else {
            Logger.log('NOTICE: Running in test mode. `activeConfig` not found. Using a hardcoded Reference File ID.');
            refId = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc';
        }

        const referenceSS = SpreadsheetApp.openById(refId);

        const stagingPairs = [
            { source: 'WebS', target: 'WebM' },
            { source: 'ComaxS', target: 'ComaxM' }
        ];

        stagingPairs.forEach(pair => {
            const sourceSheet = backendSS.getSheetByName(pair.source);
            const targetSheet = referenceSS.getSheetByName(pair.target);
            if (!sourceSheet || !targetSheet) {
                throw new Error(`Missing sheet: ${pair.source} or ${pair.target}`);
            }

            const sourceData = sourceSheet.getDataRange().getValues();
            targetSheet.clearContents();
            targetSheet.getRange(1, 1, sourceData.length, sourceData[0].length).setValues(sourceData);
        });

        syncNewProductsToAudit(referenceSS);

        
        return true;
    } catch (err) {
        ui.alert('Finalize Failed', `An error occurred: ${err.message}`, ui.ButtonSet.OK);
        Logger.log(`Finalize error: ${err.message}`);
    }
}

/**
 * Syncs ComaxM to Audit by updating existing rows and adding new ones.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} referenceSS The reference spreadsheet object.
 */
function syncNewProductsToAudit(referenceSS) {
    try {
        const comaxSheet = referenceSS.getSheetByName('ComaxM');
        const auditSheet = referenceSS.getSheetByName('Audit');

        if (!comaxSheet || !auditSheet) {
            Logger.log('syncNewProductsToAudit skipped: ComaxM or Audit sheet not found.');
            return;
        }

        if (comaxSheet.getLastRow() < 2) {
            Logger.log('No data in ComaxM to sync.');
            return;
        }

        // --- PART 1: UPDATE EXISTING PRODUCTS ---
        // CORRECTED: Read data up to Column P (16th column)
        const comaxData = comaxSheet.getRange('A2:P' + comaxSheet.getLastRow()).getValues();
        
        // CORRECTED: Map ID to stock from Column P (index 15). Handle empty cells.
        const comaxStockMap = new Map(comaxData.map(row => [row[0], row[15] || 0]));

        const lastAuditRow = auditSheet.getLastRow();
        if (lastAuditRow >= 2) {
            const auditRange = auditSheet.getRange(2, 1, lastAuditRow - 1, 9);
            const auditData = auditRange.getValues();
            let updatesMade = false;

            auditData.forEach(row => {
                const id = row[0];
                if (comaxStockMap.has(id)) {
                    const newComaxQty = comaxStockMap.get(id);
                    // Update only if the value is different to avoid unnecessary writes
                    if (row[3] !== newComaxQty) {
                        row[3] = newComaxQty; // Column D (index 3) is ComaxQty
                        updatesMade = true;
                    }
                }
            });

            if (updatesMade) {
                auditRange.setValues(auditData);
                Logger.log('Updated ComaxQty for existing products in the Audit sheet.');
            } else {
                Logger.log('No updates needed for existing products.');
            }
        }

        // --- PART 2: ADD NEW PRODUCTS ---
        const auditIds = new Set(auditSheet.getRange('A2:A' + auditSheet.getLastRow()).getValues().flat());
        const newProducts = comaxData.filter(row => row[0] && !auditIds.has(row[0]));

        if (newProducts.length > 0) {
            const newRows = newProducts.map(product => {
                // CORRECTED: Get stock from Column P (index 15) for new products
                // ID, SKU, LastCount, ComaxQty, NewQty, BruryaQty, StorageQty, OfficeQty, ShopQty
                return [product[0], product[1], '', product[15] || 0, '', '', '', '', ''];
            });
            auditSheet.getRange(auditSheet.getLastRow() + 1, 1, newRows.length, 9).setValues(newRows);
            Logger.log(`Added ${newRows.length} new products to the Audit sheet.`);
        } else {
            Logger.log('No new products to add to Audit sheet.');
        }
    } catch (e) {
        Logger.log(`Error during Audit sync: ${e.message}`);
    }
}
