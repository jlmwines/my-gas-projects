/**
 * @file migration.js
 * @description One-time script to migrate data from the old system to the new system.
 */

const OLD_SYSTEM_CONFIG = {
    referenceFileId: '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc', // This is the OLD Reference spreadsheet
    sheetMappings: {
        'ComaxM': 'CmxProdM',
        'OrdersM': 'WebOrdM',
        'WebM': 'WebProdM'
    }
};

/**
 * Main function to orchestrate the data migration.
 */
function migrateSysOrdLog() {
    const functionName = 'migrateSysOrdLog';
    try {
        console.log(`Running ${functionName}...`);

        const oldSpreadsheet = SpreadsheetApp.openById(OLD_SYSTEM_CONFIG.referenceFileId);
        const oldSheet = oldSpreadsheet.getSheetByName('OrderLog'); // Assuming the old sheet is named 'OrderLog'
        if (!oldSheet) {
            throw new Error('Sheet \'OrderLog\' not found in the old spreadsheet.');
        }

        const newSpreadsheetId = PropertiesService.getScriptProperties().getProperty("spreadsheetId");
        if (!newSpreadsheetId) {
            throw new Error("New spreadsheet ID not found in script properties.");
        }
        const newSpreadsheet = SpreadsheetApp.openById(newSpreadsheetId);
        const newSheet = newSpreadsheet.getSheetByName('SysOrdLog');
        if (!newSheet) {
            throw new Error('Sheet \'SysOrdLog\' not found in the new spreadsheet.');
        }

        const oldData = oldSheet.getDataRange().getValues();
        const oldHeaders = oldData.shift(); // Remove headers

        const orderIdIndex = oldHeaders.indexOf('order_id');
        const orderDateIndex = oldHeaders.indexOf('order_date');
        const packingStatusIndex = oldHeaders.indexOf('packing_slip_status');
        const packingPrintDateIndex = oldHeaders.indexOf('packing_print_date');
        const comaxExportStatusIndex = oldHeaders.indexOf('comax_export_status');

        const newData = oldData.map(row => {
            const legacyComaxExportValue = row[comaxExportStatusIndex];
            const solComaxExportStatus = legacyComaxExportValue ? 'Exported' : 'Pending';
            const solComaxExportTimestamp = legacyComaxExportValue || null;

            return [
                row[orderIdIndex],
                row[orderDateIndex],
                row[packingStatusIndex],
                row[packingPrintDateIndex],
                solComaxExportStatus,
                solComaxExportTimestamp
            ];
        });

        newSheet.getRange(2, 1, newData.length, newData[0].length).setValues(newData);

        console.log(`Successfully migrated ${newData.length} rows to 'SysOrdLog'.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}
