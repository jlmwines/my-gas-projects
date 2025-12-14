/**
 * @file SetupSheets.js
 * @description Contains functions for creating and updating headers for all system sheets.
 */

function createWebXltSHeaders() {
    const functionName = 'createWebXltSHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebXltS';

        const allConfig = ConfigService.getAllConfig();

        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // Clear the entire header row first (handles schema changes with different column counts)
        const maxCols = sheet.getMaxColumns();
        if (maxCols > 0) {
            sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
        }

        // Write new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebXltMHeaders() {
    const functionName = 'createWebXltMHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebXltM';

        const allConfig = ConfigService.getAllConfig();

        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // Clear the entire header row first (handles schema changes with different column counts)
        const maxCols = sheet.getMaxColumns();
        if (maxCols > 0) {
            sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
        }

        // Write new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}



function createComaxStagingHeaders() {
    const functionName = 'createComaxStagingHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'CmxProdS';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebOrdSHeaders() {
    const functionName = 'createWebOrdSHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebOrdS';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebOrdMHeaders() {
    const functionName = 'createWebOrdMHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebOrdM';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebOrdItemsMHeaders() {
    const functionName = 'createWebOrdItemsMHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebOrdItemsM';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysInventoryOnHoldHeaders() {
    const functionName = 'createSysInventoryOnHoldHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysInventoryOnHold';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysOrdLogHeaders() {
    const functionName = 'createSysOrdLogHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysOrdLog';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        } else {
            sheet.clear();
            console.log(`Cleared existing content from '${sheetName}'.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysPackingCacheHeaders() {
    const functionName = 'createSysPackingCacheHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysPackingCache';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createOrderLogArchiveHeaders() {
    const functionName = 'createOrderLogArchiveHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'OrderLogArchive';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebDetMHeaders() {
    const functionName = 'createWebDetMHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebDetM';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebDetSHeaders() {
    const functionName = 'createWebDetSHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebDetS';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createCmxProdMHeaders() {
    const functionName = 'createCmxProdMHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'CmxProdM';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebProdMHeaders() {
    const functionName = 'createWebProdMHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebProdM';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // Clear the entire header row first (handles schema changes with different column counts)
        const maxCols = sheet.getMaxColumns();
        if (maxCols > 0) {
            sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
        }

        // Write new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebProdSEnHeaders() {
    const functionName = 'createWebProdSEnHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebProdS_EN';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // Clear the entire header row first (handles schema changes with different column counts)
        const maxCols = sheet.getMaxColumns();
        if (maxCols > 0) {
            sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
        }

        // Write new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysFileRegistryHeaders() {
    const functionName = 'createSysFileRegistryHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const allConfig = ConfigService.getAllConfig();
        const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
        if (!logSpreadsheetId) {
            throw new Error("Log spreadsheet ID not found in configuration ('system.spreadsheet.logs').");
        }
        const spreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
        console.log(`Opened log spreadsheet: ${spreadsheet.getName()}`);

        const sheetName = 'SysFileRegistry';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const schema = allConfig[`schema.log.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysJobQueueHeaders() {
    const functionName = 'createSysJobQueueHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const allConfig = ConfigService.getAllConfig();
        const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
        if (!logSpreadsheetId) {
            throw new Error("Log spreadsheet ID not found in configuration ('system.spreadsheet.logs').");
        }
        const spreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
        console.log(`Opened log spreadsheet: ${spreadsheet.getName()}`);

        const sheetName = 'SysJobQueue';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const schema = allConfig[`schema.log.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysLogHeaders() {
    const functionName = 'createSysLogHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const allConfig = ConfigService.getAllConfig();
        const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
        if (!logSpreadsheetId) {
            throw new Error("Log spreadsheet ID not found in configuration ('system.spreadsheet.logs').");
        }
        const spreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
        console.log(`Opened log spreadsheet: ${spreadsheet.getName()}`);

        const sheetName = 'SysLog';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const schema = allConfig[`schema.log.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysTasksHeaders() {
    const functionName = 'createSysTasksHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysTasks';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebOrdMArchiveHeaders() {
    const functionName = 'createWebOrdMArchiveHeaders';
    try {
        console.log(`Running ${functionName}...`);
        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebOrdM_Archive';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }
        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration.`);
        }
        const headers = schema.headers.split(',');
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);
    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createWebOrdItemsMArchiveHeaders() {
    const functionName = 'createWebOrdItemsMArchiveHeaders';
    try {
        console.log(`Running ${functionName}...`);
        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'WebOrdItemsM_Archive';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }
        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration.`);
        }
        const headers = schema.headers.split(',');
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);
    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysBundlesHeaders() {
    const functionName = 'createSysBundlesHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysBundles';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // Clear the entire header row first (handles schema changes with different column counts)
        const maxCols = sheet.getMaxColumns();
        if (maxCols > 0) {
            sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
        }

        // Write new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysBundleSlotsHeaders() {
    const functionName = 'createSysBundleSlotsHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysBundleSlots';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // Clear the entire header row first (handles schema changes with different column counts)
        const maxCols = sheet.getMaxColumns();
        if (maxCols > 0) {
            sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
        }

        // Write new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createJlmopsSystemSheets() {
    createWebXltSHeaders();
    createWebXltMHeaders();
    createComaxStagingHeaders();
    createWebOrdSHeaders();
    createWebOrdMHeaders();
    createWebOrdItemsMHeaders();
    createSysInventoryOnHoldHeaders();
    createSysOrdLogHeaders();
    createSysPackingCacheHeaders();
    createOrderLogArchiveHeaders();
    createWebDetMHeaders();
    createWebDetSHeaders();
    createCmxProdMHeaders();
    createWebProdMHeaders();
    createWebProdSEnHeaders();
    createSysFileRegistryHeaders();
    createSysJobQueueHeaders();
    createSysLogHeaders();
    createSysTasksHeaders();
    createWebOrdMArchiveHeaders();
    createWebOrdItemsMArchiveHeaders();
    createSysBundlesHeaders();
    createSysBundleSlotsHeaders();
    createLookupSheets(); // Add new function to the main setup call
    protectAllSheetHeaders();
}

/**
 * Public function to be called from the UI to protect all sheet headers.
 * @returns {string} A success message or throws an error.
 */
function protectAllSheetHeadersFromUI() {
    try {
        protectAllSheetHeaders();
        return 'All sheet headers have been protected.';
    } catch (error) {
        console.error('Error protecting all sheet headers from UI: ' + error.message);
        throw new Error('Failed to protect sheet headers: ' + error.message);
    }
}


function createSysProductAuditHeaders() {
    const functionName = 'createSysProductAuditHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysProductAudit';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // This will only overwrite the first row, leaving other data intact.
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

        console.log(`Headers for ${sheetName} have been synchronized.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}


function protectAllSheetHeaders() {
    const functionName = 'protectAllSheetHeaders';
    try {
        console.log(`Running ${functionName}...`);
        const allConfig = ConfigService.getAllConfig();

        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;

        const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
        const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);

        const sheetSchemas = Object.keys(allConfig).filter(key => key.startsWith('schema.data.') || key.startsWith('schema.log.'));

        for (const schemaKey of sheetSchemas) {
            const schema = allConfig[schemaKey];
            if (!schema || !schema.headers) {
                console.warn(`Skipping protection for ${schemaKey}: schema or headers not found.`);
                continue;
            }

            const sheetName = schemaKey.replace('schema.data.', '').replace('schema.log.', '');
            let targetSpreadsheet;
            if (schemaKey.startsWith('schema.data.')) {
                targetSpreadsheet = dataSpreadsheet;
            } else if (schemaKey.startsWith('schema.log.')) {
                targetSpreadsheet = logSpreadsheet;
            } else {
                continue; // Should not happen with the filter, but good for safety
            }

            const sheet = targetSpreadsheet.getSheetByName(sheetName);
            if (!sheet) {
                console.warn(`Sheet '${sheetName}' not found in ${targetSpreadsheet.getName()}. Skipping protection.`);
                continue;
            }

            const protection = sheet.getRange(1, 1, 1, sheet.getLastColumn()).protect();
            protection.setDescription(`Header row protection for ${sheetName}`);
            
            // Ensure only the owner can edit the protected range
            const editors = protection.getEditors();
            if (editors.length > 0) {
                protection.removeEditors(editors);
            }
            // ScriptApp.getProjectOwner() is not available in Web App context, rely on deployment execution user
            protection.addEditor(Session.getActiveUser()); // Add current user too for testing/dev

            console.log(`Protected header row for sheet: '${sheetName}' in '${targetSpreadsheet.getName()}'.`);
        }
        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

function createSysProjectsHeaders() {
    const functionName = 'createSysProjectsHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysProjects';

        const allConfig = ConfigService.getAllConfig();

        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
        }
        const headers = schema.headers.split(',');

        // Clear the entire header row first (handles schema changes with different column counts)
        const maxCols = sheet.getMaxColumns();
        if (maxCols > 0) {
            sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
        }

        // Write new headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}

