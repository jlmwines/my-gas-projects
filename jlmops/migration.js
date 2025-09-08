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
function migrateData() {
    console.log("Starting data migration...");

    try {
        const oldSpreadsheet = SpreadsheetApp.openById(OLD_SYSTEM_CONFIG.referenceFileId);
        const newSpreadsheetId = PropertiesService.getScriptProperties().getProperty("spreadsheetId");
        if (!newSpreadsheetId) {
            throw new Error("New spreadsheet ID not found in script properties.");
        }
        const newSpreadsheet = SpreadsheetApp.openById(newSpreadsheetId);

        for (const oldSheetName in OLD_SYSTEM_CONFIG.sheetMappings) {
            const newSheetName = OLD_SYSTEM_CONFIG.sheetMappings[oldSheetName];
            console.log(`Migrating data from '${oldSheetName}' to '${newSheetName}'...`);

            const oldSheet = oldSpreadsheet.getSheetByName(oldSheetName);
            if (!oldSheet) {
                console.warn(`Sheet '${oldSheetName}' not found in the old spreadsheet. Skipping.`);
                continue;
            }

            const newData = oldSheet.getDataRange().getValues();

            const newSheet = newSpreadsheet.getSheetByName(newSheetName);
            if (!newSheet) {
                console.warn(`Sheet '${newSheetName}' not found in the new spreadsheet. Skipping.`);
                continue;
            }

            newSheet.clearContents();
            newSheet.getRange(1, 1, newData.length, newData[0].length).setValues(newData);

            console.log(`Successfully migrated ${newData.length} rows to '${newSheetName}'.`);
        }

        console.log("Data migration completed successfully.");

    } catch (e) {
        console.error(`Data migration failed: ${e.message}`);
        throw e;
    }
}
