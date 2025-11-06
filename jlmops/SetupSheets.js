/**
 * @file SetupSheets.js
 * @description Contains functions for creating and updating headers for all system sheets.
 */

function createWebXltHeaders() {
    const functionName = 'createWebXltHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetNames = ['WebXltS', 'WebXltM'];
        
        // This assumes that rebuildSysConfigFromSource has been run and the config is available.
        const allConfig = ConfigService.getAllConfig();

        sheetNames.forEach(sheetName => {
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

            sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
            console.log(`Headers written to '${sheetName}'.`);
        });

        SpreadsheetApp.getUi().alert('Headers for WebXltS and WebXltM have been synchronized.');

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
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

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

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

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}'.`);

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

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysFileRegistry';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
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

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysJobQueue';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
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

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetName = 'SysLog';
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        const allConfig = ConfigService.getAllConfig();
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

function createJlmopsSystemSheets() {
    createWebXltHeaders();
    createComaxStagingHeaders();
    createWebOrdSHeaders();
    createWebOrdMHeaders();
    createWebOrdItemsMHeaders();
    createSysInventoryOnHoldHeaders();
    createSysOrdLogHeaders();
    createSysPackingCacheHeaders();
    createOrderLogArchiveHeaders();
    createWebDetMHeaders();
    createCmxProdMHeaders();
    createWebProdMHeaders();
    createWebProdSEnHeaders();
    createSysFileRegistryHeaders();
    createSysJobQueueHeaders();
    createSysLogHeaders();
    createSysTasksHeaders();
    createWebOrdMArchiveHeaders();
    createWebOrdItemsMArchiveHeaders();
    createLookupSheets(); // Add new function to the main setup call
}

function createLookupSheets() {
    const functionName = 'createLookupSheets';
    try {
        console.log(`Running ${functionName}...`);
        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());

        const sheetsToCreate = {
            'SysLkp_Grapes': ['slg_Code', 'slg_TextEN', 'slg_TextHE'],
            'SysLkp_Kashrut': ['slk_Type', 'slk_Code', 'slk_TextEN', 'slk_TextHE'],
            'SysLkp_Texts': ['slt_Code', 'slt_TextEN', 'slt_TextHE', 'slt_Note']
        };

        for (const sheetName in sheetsToCreate) {
            let sheet = spreadsheet.getSheetByName(sheetName);
            if (!sheet) {
                sheet = spreadsheet.insertSheet(sheetName);
                console.log(`Sheet '${sheetName}' was not found and has been created.`);
            }
            const headers = sheetsToCreate[sheetName];
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
            console.log(`Headers written to '${sheetName}'.`);
        }

        console.log('Lookup sheets have been created/verified.');

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        throw error;
    }
}
