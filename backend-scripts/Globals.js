/**
 * @file Globals.gs
 * @description Holds global configuration and constants for the entire project.
 * @version 25-07-23-0947
 * @environment Backend
 */

// ---  ENVIRONMENT CONFIGURATION ---
// Set to 'false' for the LIVE production environment.
const IS_TEST_ENVIRONMENT = false;

const CONFIG = {
    live: {
        referenceFileId: '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc',
        importFolderId: '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j',
        backupFolderId: '18BXSaYp7SOQauMpXJ9AWCpE1SDcsgyGQ',
        comaxExportFolderId: "1ZNCnL6ryYOyhFaErbZlGW_eTKoR6nUU5",
        invoiceFolderId: '1VNKUGl1tgrV-cdj0KiM5SQ8Kvsw9WoNb',
        packingSlipFolderId: '1iVX07R1qK0aEGz1x2smZYAbaXRneyowA',
        packingSlipTemplateId: '1QmdebRD-vk0gsbN5jRz5klE8ttW5KUjSbfl9ql-9VqU',
        customerNoteTemplateId: '1muXXF2gQUeIM1MALbkZINwZPcS2SXXbiGqKL3841gPw',
        importFileNames: {
            comaxProducts: 'ComaxProducts.csv',
            webProducts: 'WebProducts.csv',
            webOrders: 'WebOrders.csv'
        }
    },
    test: {
        referenceFileId: '1D-zMEuAJQ3ATR0edIZKDSf71KkF3h7EgXrfTRaRQ8FU',
        backupFolderId: '1L9f7o1RSIxDGQjJ6L5BsszEtK2zYQEFD',
        comaxExportFolderId: "YOUR_TEST_COMAX_EXPORT_FOLDER_ID",
        invoiceFolderId: 'YOUR_TEST_INVOICE_FOLDER_ID',
        packingSlipFolderId: 'YOUR_TEST_PACKING_SLIP_FOLDER_ID',
        packingSlipTemplateId: 'YOUR_TEST_PACKING_SLIP_TEMPLATE_ID',
        customerNoteTemplateId: 'YOUR_TEST_CUSTOMER_NOTE_TEMPLATE_ID',
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
const SHEET_REFERENCE_CONFIG = 'Config';
const SETTING_PACKING_DATA_CREATED = 'PackingDataCreated';
const SHEET_ORDER_LOG = 'OrderLog';
const SHEET_ORDER_LOG_ARCHIVE = 'OrderLogArchive';
const SETTING_LAST_HOUSEKEEPING_RUN = 'LastHousekeepingRun';

const HEADERS = {
    ORDER_ID: 'order_id',
    ORDER_NUMBER: 'Order Number'
};

const COLUMN_INDICES_ORDERLOG = {
    ORDER_ID: 1,
    ORDER_DATE: 2,
    PACKING_PRINT_DATE: 3,
    CUSTOMER_NOTE_DOC_ID: 4,
    EXPORT_DATE: 5
};

// --- MODULE VERSION TRACKING ---
const MODULE_VERSION = {
    globals:      '25-07-23-0947',
    packingSlips: '25-07-21-0721'
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

    try {
        const packingSlipFolder = DriveApp.getFolderById(activeConfig.packingSlipFolderId);
        Logger.log(`SUCCESS: Accessed Packing Slips Folder. Name: "${packingSlipFolder.getName()}"`);
    } catch (e) {
        Logger.log(`ERROR accessing Packing Slips Folder (ID ending in ...${activeConfig.packingSlipFolderId.slice(-4)}): ${e.message}`);
    }

    try {
        const packingSlipTemplate = DriveApp.getFileById(activeConfig.packingSlipTemplateId);
        Logger.log(`SUCCESS: Accessed Packing Slip Template. Name: "${packingSlipTemplate.getName()}"`);
    } catch (e) {
        Logger.log(`ERROR accessing Packing Slip Template (ID ending in ...${activeConfig.packingSlipTemplateId.slice(-4)}): ${e.message}`);
    }
}