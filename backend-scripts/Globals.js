/**
 * @file Globals.gs
 * @description Holds global configuration and constants for the entire project.
 * @version 25-07-17-1042
 */

// ---  ENVIRONMENT CONFIGURATION ---
// Set to 'false' for the LIVE production environment.
const IS_TEST_ENVIRONMENT = false;

const CONFIG = {
    live: {
        referenceFileId: '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc', // Live Reference file
        backupFolderId: '18BXSaYp7SOQauMpXJ9AWCpE1SDcsgyGQ', // Live Backups folder
        comaxExportFolderId: "1ZNCnL6ryYOyhFaErbZlGW_eTKoR6nUU5", // Comax Order Export folder
        importFileNames: {
            comaxProducts: 'ComaxProducts.csv',
            webProducts: 'WebProducts.csv',
            webOrders: 'WebOrders.csv'
        }
    },
    test: {
        referenceFileId: '1D-zMEuAJQ3ATR0edIZKDSf71KkF3h7EgXrfTRaRQ8FU',
        backupFolderId: '1L9f7o1RSIxDGQjJ6L5BsszEtK2zYQEFD',
        importFileNames: {
            comaxProducts: 'ComaxProducts.csv',
            webProducts: 'WebProducts.csv',
            webOrders: 'WebOrders.csv'
        }
    }
};

// Automatically select the correct configuration based on the switch
const activeConfig = IS_TEST_ENVIRONMENT ? CONFIG.test : CONFIG.live;

/**
 * FOR DEBUGGING ONLY
 * This can be left here or removed. It is not used by the main application.
 */
function testFileAccess() {
    const backendId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const referenceId = activeConfig.referenceFileId;

    Logger.log('--- Testing File Access ---');

    try {
        const backendFile = SpreadsheetApp.openById(backendId);
        Logger.log(`SUCCESS: Opened Backend File. Name: "${backendFile.getName()}"`);
    } catch (e) {
        Logger.log(`ERROR accessing Backend File (ID ending in ...${backendId.slice(-4)}): ${e.message}`);
    }

    try {
        const referenceFile = SpreadsheetApp.openById(referenceId);
        Logger.log(`SUCCESS: Opened Reference File. Name: "${referenceFile.getName()}"`);
    } catch (e) {
        Logger.log(`ERROR accessing Reference File (ID ending in ...${referenceId.slice(-4)}): ${e.message}`);
    }
}