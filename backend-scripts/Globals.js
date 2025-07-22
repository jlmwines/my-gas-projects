/**
 * @file Globals.gs
 * @description Holds global configuration and constants for the entire project.
 * @version 25-07-21-1608 // Updated version
 */

// ---  ENVIRONMENT CONFIGURATION ---
// Set to 'false' for the LIVE production environment.
const IS_TEST_ENVIRONMENT = false;

const CONFIG = {
    live: {
        referenceFileId: '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc', // Live Reference file
        backupFolderId: '18BXSaYp7SOQauMpXJ9AWCpE1SDcsgyGQ', // Live Backups folder
        comaxExportFolderId: "1ZNCnL6ryYOyhFaErbZlGW_eTKoR6nUU5", // Comax Order Export folder
        packingSlipFolderId: '1iVX07R1qK0aEGz1x2smZYAbaXRneyowA', // Live Packing Slips folder
        packingSlipTemplateId: '1A-LJ5zPzxtoqIDS2fyRPF-EKIz8TXhVGZMyk94gmVAk', // NEW: Live Packing Slip Template ID
        importFileNames: {
            comaxProducts: 'ComaxProducts.csv',
            webProducts: 'WebProducts.csv',
            webOrders: 'WebOrders.csv'
        }
    },
    test: {
        referenceFileId: '1D-zMEuAJQ3ATR0edIZKDSf71KkF3h7EgXrfTRaRQ8FU',
        backupFolderId: '1L9f7o1RSIxDGQjJ6L5BsszEtK2zYQEFD',
        comaxExportFolderId: "YOUR_TEST_COMAX_EXPORT_FOLDER_ID", // IMPORTANT: Add your test Comax export folder ID here
        packingSlipFolderId: 'YOUR_TEST_PACKING_SLIP_FOLDER_ID', // IMPORTANT: Replace with your actual test folder ID here
        packingSlipTemplateId: 'YOUR_TEST_PACKING_SLIP_TEMPLATE_ID', // IMPORTANT: Replace with your actual test template ID here
        importFileNames: {
            comaxProducts: 'ComaxProducts.csv',
            webProducts: 'WebProducts.csv',
            webOrders: 'WebOrders.csv'
        }
    }
};

// Automatically select the correct configuration based on the switch
const activeConfig = IS_TEST_ENVIRONMENT ? CONFIG.test : CONFIG.live;

// --- PACKING SLIP MODULE CONSTANTS ---
const SHEET_PACKING_QUEUE = 'PackingQueue';
const SHEET_PACKING_ROWS = 'PackingRows';
const SHEET_PACKING_TEXT = 'PackingText';

// --- MODULE VERSION TRACKING ---
const MODULE_VERSION = {
    globals:      '25-07-21-1608', // Updated version
    packingSlips: '25-07-21-0721' // Keep current module version
};

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

    // NEW: Test Packing Slips Folder Access
    try {
        const packingSlipFolder = DriveApp.getFolderById(activeConfig.packingSlipFolderId);
        Logger.log(`SUCCESS: Accessed Packing Slips Folder. Name: "${packingSlipFolder.getName()}"`);
    } catch (e) {
        Logger.log(`ERROR accessing Packing Slips Folder (ID ending in ...${activeConfig.packingSlipFolderId.slice(-4)}): ${e.message}`);
    }

    // NEW: Test Packing Slip Template Access
    try {
        const packingSlipTemplate = DriveApp.getFileById(activeConfig.packingSlipTemplateId);
        Logger.log(`SUCCESS: Accessed Packing Slip Template. Name: "${packingSlipTemplate.getName()}"`);
    } catch (e) {
        Logger.log(`ERROR accessing Packing Slip Template (ID ending in ...${activeConfig.packingSlipTemplateId.slice(-4)}): ${e.message}`);
    }
}