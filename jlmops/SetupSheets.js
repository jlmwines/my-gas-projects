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
    createLookupSheets();
    // CRM sheets
    createSysContactsHeaders();
    createSysContactActivityHeaders();
    createSysCouponsHeaders();
    createSysCampaignsHeaders();
    createSysCouponUsageHeaders();
    // Protection and freeze
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

        const sheetSchemas = Object.keys(allConfig).filter(key =>
            key.startsWith('schema.data.') || key.startsWith('schema.log.')
        );

        let protectedCount = 0;
        let skippedCount = 0;

        for (const schemaKey of sheetSchemas) {
            const schema = allConfig[schemaKey];
            if (!schema || !schema.headers) {
                console.warn(`Skipping ${schemaKey}: schema or headers not found.`);
                skippedCount++;
                continue;
            }

            const sheetName = schemaKey.replace('schema.data.', '').replace('schema.log.', '');
            const targetSpreadsheet = schemaKey.startsWith('schema.data.')
                ? dataSpreadsheet
                : logSpreadsheet;

            const sheet = targetSpreadsheet.getSheetByName(sheetName);
            if (!sheet) {
                console.warn(`Sheet '${sheetName}' not found. Skipping.`);
                skippedCount++;
                continue;
            }

            // Freeze row 1
            sheet.setFrozenRows(1);

            // Remove ALL existing header row protections first to prevent stacking
            const existingProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
            for (const p of existingProtections) {
                const range = p.getRange();
                if (range.getRow() === 1 && range.getNumRows() === 1) {
                    p.remove();
                }
            }

            // Apply new protection with WARNING ONLY mode
            // This shows a confirmation dialog for ALL users including the spreadsheet owner
            const lastCol = Math.max(1, sheet.getLastColumn());
            const protection = sheet.getRange(1, 1, 1, lastCol).protect();
            protection.setDescription(`Header protection: ${sheetName}`);
            protection.setWarningOnly(true);

            protectedCount++;
            console.log(`Protected header row for: ${sheetName}`);
        }

        console.log(`${functionName} complete: ${protectedCount} protected, ${skippedCount} skipped.`);
        return { protected: protectedCount, skipped: skippedCount };

    } catch (error) {
        console.error(`Error in ${functionName}: ${error.message}`);
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

// ============================================================================
// CRM Sheet Creation Functions
// ============================================================================

function createSysContactsHeaders() {
    const functionName = 'createSysContactsHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysContacts';

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

        // Clear the entire header row first
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

function createSysContactActivityHeaders() {
    const functionName = 'createSysContactActivityHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysContactActivity';

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

        // Clear the entire header row first
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

function createSysCouponsHeaders() {
    const functionName = 'createSysCouponsHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysCoupons';

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

        // Clear the entire header row first
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

function createSysCampaignsHeaders() {
    const functionName = 'createSysCampaignsHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysCampaigns';

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

        // Clear the entire header row first
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

function createSysCouponUsageHeaders() {
    const functionName = 'createSysCouponUsageHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysCouponUsage';

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

        // Clear the entire header row first
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

/**
 * Creates all CRM sheets with headers.
 * Run this to set up CRM data storage.
 */
function createCrmSheets() {
    console.log('Creating CRM sheets...');
    createSysContactsHeaders();
    createSysContactActivityHeaders();
    createSysCouponsHeaders();
    createSysCampaignsHeaders();
    createSysCouponUsageHeaders();
    console.log('CRM sheets created successfully.');
}

// ============================================================================
// Lookup Sheet Creation Functions
// ============================================================================

function createSysLkpCitiesHeaders() {
    const functionName = 'createSysLkpCitiesHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysLkp_Cities';

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

        // Clear the entire header row first
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

/**
 * Creates all lookup sheets with headers.
 * Run this to set up lookup tables.
 */
function createLookupSheets() {
    console.log('Creating lookup sheets...');
    createSysLkpCitiesHeaders();
    console.log('Lookup sheets created successfully.');
}

