
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, 'config');
const outputFile = path.join(__dirname, 'SetupConfig.js');

function processTemplates(data) {
    const output = [];
    for (const row of data) {
        const settingName = row[0] || '';

        if (settingName.startsWith('map.web.order_columns.template')) {
            // Existing mapping template logic
            const nameTemplate = row[3];
            const valueTemplate = row[4];
            const range = row[5].split('-').map(Number);
            const fields = row[6].split(',');

            for (let i = range[0]; i <= range[1]; i++) {
                for (const field of fields) {
                    const newRow = JSON.parse(JSON.stringify(row)); // Deep copy
                    newRow[0] = settingName.replace('.template', '');
                    newRow[3] = nameTemplate.replace('{i}', i).replace('{field}', field);
                    newRow[4] = valueTemplate.replace('{i}', i).replace('{field}', field.replace(/ /g, ''));
                    newRow[5] = ''; // Clear template-specific fields
                    newRow[6] = ''; // Clear template-specific fields
                    output.push(newRow);
                }
            }
                    } else if (settingName.startsWith('validation.rule.template') || settingName.startsWith('task.template')) {
                        const ruleName = row[1];
                        const description = row[2];
                        const status = row[3];
        
                        let finalSettingName = '';
                        if (settingName.startsWith('validation.rule.template')) {
                            finalSettingName = 'validation.rule.' + ruleName;
                        } else if (settingName.startsWith('task.template')) {
                            finalSettingName = ruleName; // ruleName already contains the full prefix
                        }
        
                        for (let i = 4; i < row.length; i += 2) {
                            const key = row[i];
                            const value = row[i + 1];
        
                            if (key === undefined || value === undefined) {
                                break;
                            }
        
                            const newRow = [finalSettingName, description, status, key, value];
                            // Ensure the newRow has enough empty strings to match the expected column count
                            while (newRow.length < 13) { // Assuming max 13 columns in SysConfig
                                newRow.push('');
                            }
                            output.push(newRow);
                        }        } else {
            // This is a regular row, just add it
            output.push(row);
        }
    }
    return output;
}

function generateSetupConfig() {
    const configOrder = [
        'headers', 'system', 'crm', 'jobs', 'schemas', 'mappings', 'validation',
        'taskDefinitions', 'migrationColumnMapping', 'orders', 'migrationSyncTasks',
        'printing', 'users', 'otherSettings'
    ];

    let masterConfigArray = [];

    try {
        // First pass: collect all rows and find max column count
        let allRows = [];
        for (const fileName of configOrder) {
            const filePath = path.join(inputDir, `${fileName}.json`);
            const rawData = fs.readFileSync(filePath, 'utf8');
            let jsonData = JSON.parse(rawData);
            const processedData = processTemplates(jsonData);
            allRows.push(...processedData);
        }

        // Find max column count
        const maxCols = Math.max(...allRows.map(row => row.length));
        console.log(`Max column count: ${maxCols}`);

        // Second pass: pad all rows to max column count
        masterConfigArray = allRows.map(row => {
            const newRow = [...row];
            while (newRow.length < maxCols) {
                newRow.push('');
            }
            return newRow;
        });
    } catch (error) {
        console.error(`Error reading or parsing JSON files from ${inputDir}:`, error);
        process.exit(1);
    }

    // Convert the JavaScript array to a string representation for the file
    const arrayString = JSON.stringify(masterConfigArray, null, 4);

    // Create the content for the new SetupConfig.js file
    const fileContent = `/**
 * @file SetupConfig.js
 * @description Contains functions for managing the master SysConfig sheet.
 * IMPORTANT: This file is auto-generated. Do not edit it manually.
 * Instead, edit the JSON files in the /config directory and run generate-config.js.
 */

// =================================================================
//  MASTER CONFIGURATION FUNCTION
// =================================================================

/**
 * Overwrites the live SysConfig sheet with the master configuration defined in this script.
 * This is the authoritative source of truth for the system configuration.
 */
function rebuildSysConfigFromSource() {
    const functionName = 'rebuildSysConfigFromSource';
    const masterConfig = getMasterConfiguration();

    try {
        console.log('Running ' + functionName + '...');

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheet = spreadsheet.getSheetByName('SysConfig');
        if (!sheet) {
            throw new Error('SysConfig sheet not found in JLMops_Data spreadsheet.');
        }
        console.log('Target SysConfig sheet located.');

        // Clear and write data
        sheet.clear();
        console.log('Cleared existing content from SysConfig sheet.');

        const numRows = masterConfig.length;
        const numCols = masterConfig[0].length;
        sheet.getRange(1, 1, numRows, numCols).setValues(masterConfig);
        console.log('Wrote ' + numRows + ' rows and ' + numCols + ' columns to SysConfig.');

        // Format header
        sheet.getRange(1, 1, 1, numCols).setFontWeight('bold');
        console.log('Formatted header row.');

        ConfigService.forceReload(); // Invalidate the cache

        console.log(functionName + ' completed successfully.');

    } catch (error) {
        console.error('A critical error occurred in ' + functionName + ': ' + error.message);
        try {
            SpreadsheetApp.getUi().alert('Error: ' + error.message);
        } catch (e) {
            // getUi() fails in web app context - error already logged above
        }
    }
}

/**
 * Contains the master source of truth for the SysConfig sheet.
 * @returns {Array<Array<string>>} A 2D array representing the SysConfig data.
 */
function getMasterConfiguration() {
    return ${arrayString};
}
`;

    try {
        fs.writeFileSync(outputFile, fileContent, 'utf8');
        console.log(`Successfully generated ${outputFile}`);
    } catch (error) {
        console.error(`Error writing to ${outputFile}:`, error);
        process.exit(1);
    }
}

generateSetupConfig();
