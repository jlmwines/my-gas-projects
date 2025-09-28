// Forcing a change for git detection.
/**
 * @file setup.js
 * @description Contains functions for setup, migration, and diagnostics of the SysConfig sheet.
 */

// =================================================================
// DIAGNOSTIC FUNCTIONS
// =================================================================

/**
 * A permanent, safe, read-only function to check the current health and schema version of the live SysConfig sheet.
 * @returns {void} Logs status to the Apps Script console.
 */
function getSysConfigStatus() {
  const functionName = 'getSysConfigStatus';
  try {
    console.log(`Running ${functionName}...`);
    const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = spreadsheet.getSheetByName('SysConfig');
    if (!sheet) {
      throw new Error('SysConfig sheet not found.');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const versionRow = data.find(row => row[0] === 'sys.schema.version');
    const liveVersion = versionRow ? versionRow[3] : 0;

    console.log(`--- SysConfig Status Report ---`);
    console.log(`Schema Version: ${liveVersion}`);
    console.log(`Total Rows: ${data.length}`);
    console.log(`Headers: ${headers.join(', ')}`);
    console.log(`-----------------------------`);

  } catch (error) {
    console.error(`Error in ${functionName}: ${error.message}`);
  }
}


// =================================================================
// MIGRATION FUNCTIONS
// =================================================================

/**
 * Migrates SysConfig from schema v0 to v1.
 * - Adds the scf_status column.
 * - Populates existing rows with a 'stable' status.
 * - Adds the sys.schema.version setting and sets it to 1.
 */
function runMigration_v1() {
  const functionName = 'runMigration_v1';
  const TARGET_VERSION = 1;

  try {
    console.log(`Running ${functionName}...`);
    const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = spreadsheet.getSheetByName('SysConfig');
    if (!sheet) throw new Error('SysConfig sheet not found.');

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const versionRow = data.find(row => row[0] === 'sys.schema.version');
    const currentVersion = versionRow ? Number(versionRow[3]) : 0;

    if (currentVersion >= TARGET_VERSION) {
      console.log(`Current schema version (${currentVersion}) is already at or beyond the target version (${TARGET_VERSION}). Migration not needed.`);
      return;
    }

    // --- Step 1: Add scf_status column if it doesn't exist ---
    const statusColumnIndex = headers.indexOf('scf_status');
    if (statusColumnIndex === -1) {
      sheet.insertColumnAfter(2); // After scf_Description
      sheet.getRange(1, 3).setValue('scf_status');
      const numRows = sheet.getLastRow();
      if (numRows > 1) {
        const statusValues = Array(numRows - 1).fill(['stable']);
        sheet.getRange(2, 3, numRows - 1, 1).setValues(statusValues);
      }
      console.log('Added scf_status column and populated with "stable".');
    } else {
      console.log('scf_status column already exists, skipping creation.');
    }

    // --- Step 2: Add or update schema version setting ---
    if (versionRow) {
        const versionRowIndex = data.findIndex(row => row[0] === 'sys.schema.version') + 1;
        sheet.getRange(versionRowIndex, 4).setValue(TARGET_VERSION);
        console.log(`Updated sys.schema.version to ${TARGET_VERSION}.`);
    } else {
        sheet.appendRow(['sys.schema.version', 'The current schema version of the SysConfig sheet.', 'value', TARGET_VERSION]);
        console.log(`Created sys.schema.version and set to ${TARGET_VERSION}.`);
    }

    console.log(`${functionName} completed successfully.`);

  } catch (error) {
    console.error(`A critical error occurred in ${functionName}: ${error.message}`);
  }
}


/**
 * Migrates SysConfig from schema v1 to v2.
 * - Adds section headers for readability.
 * - Explicitly groups existing records into the new sections.
 * - Sets the sys.schema.version setting to 2.
 */
function runMigration_v2() {
    const functionName = 'runMigration_v2';
    const REQUIRED_VERSION = 1;
    const TARGET_VERSION = 2;

    try {
        console.log(`Running ${functionName}...`);
        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheet = spreadsheet.getSheetByName('SysConfig');
        if (!sheet) throw new Error('SysConfig sheet not found.');

        const dataRange = sheet.getDataRange();
        const allData = dataRange.getValues();
        const headers = allData.shift();
        
        const versionRow = allData.find(row => row[0] === 'sys.schema.version');
        const currentVersion = versionRow ? Number(versionRow[3]) : 0;

        if (currentVersion !== REQUIRED_VERSION) {
            throw new Error(`Prerequisite failed. Current schema version is ${currentVersion}, but this migration requires version ${REQUIRED_VERSION}.`);
        }

        // --- Step 1: Define sections and categorize existing data ---
        const sectionMap = {
            '_section.01_System': { prefix: 'sys.', rows: [] },
            '_section.02_Imports': { prefix: 'import.', rows: [] },
            '_section.03_Schemas': { prefix: 'schema.', rows: [] },
            '_section.04_Mappings': { prefix: 'map.', rows: [] },
            '_section.05_Validation': { prefix: 'validation.', rows: [] }
        };
        const otherRows = [];

        allData.forEach(row => {
            const settingName = row[0];
            if (!settingName || settingName.startsWith('_section.')) return; // Ignore old section headers

            const sectionKey = Object.keys(sectionMap).find(key => settingName.startsWith(sectionMap[key].prefix));
            
            if (sectionKey) {
                sectionMap[sectionKey].rows.push(row);
            } else {
                otherRows.push(row);
            }
        });

        // --- Step 2: Clear the sheet and write back in order ---
        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
            console.log('Cleared existing data for reorganization.');
        }

        const newSheetData = [];
        const sectionDescriptions = {
            '_section.01_System': 'High-level system settings and versioning.',
            '_section.02_Imports': 'Configurations for importing data from external sources.',
            '_section.03_Schemas': 'Schema definitions for staging and master sheets.',
            '_section.04_Mappings': 'Header and value mappings for data transformation.',
            '_section.05_Validation': 'Rules for the data validation engine.'
        };

        Object.keys(sectionMap).sort().forEach(sectionName => {
            const headerRow = new Array(headers.length).fill('');
            headerRow[0] = sectionName;
            headerRow[1] = sectionDescriptions[sectionName];
            newSheetData.push(headerRow);

            const sortedRows = sectionMap[sectionName].rows.sort((a, b) => a[0].localeCompare(b[0]));
            newSheetData.push(...sortedRows);
        });

        if (otherRows.length > 0) {
            const otherHeader = new Array(headers.length).fill('');
            otherHeader[0] = '_section.99_Other';
            otherHeader[1] = 'Uncategorized settings.';
            newSheetData.push(otherHeader);
            newSheetData.push(...otherRows.sort((a, b) => a[0].localeCompare(b[0])));
        }
        
        if (newSheetData.length > 0) {
            sheet.getRange(2, 1, newSheetData.length, newSheetData[0].length).setValues(newSheetData);
            console.log(`Reorganized and wrote ${newSheetData.length} rows to the sheet.`);
        }

        // --- Step 3: Update schema version ---
        const finalData = sheet.getDataRange().getValues();
        const newVersionRowIndex = finalData.findIndex(row => row[0] === 'sys.schema.version') + 1;
        
        if (newVersionRowIndex > 0) {
            sheet.getRange(newVersionRowIndex, 4).setValue(TARGET_VERSION);
            console.log(`Updated sys.schema.version to ${TARGET_VERSION}.`);
        } else {
            throw new Error('Could not find sys.schema.version row to update after reorganization.');
        }

        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
    }
}

/**
 * Sets the scf_status for all records matching a given settingName.
 * @param {string} settingName The scf_SettingName to update.
 * @param {string} newStatus The new status to set (e.g., 'stable', 'locked', 'testing_phase2_part1').
 */
function setRecordStatus(settingName, newStatus) {
    const functionName = 'setRecordStatus';
    try {
        console.log(`Running ${functionName} for setting: ${settingName} to status: ${newStatus}...`);
        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheet = spreadsheet.getSheetByName('SysConfig');
        if (!sheet) throw new Error('SysConfig sheet not found.');

        const dataRange = sheet.getDataRange();
        const allData = dataRange.getValues();
        const headers = allData[0];
        const settingNameColIndex = headers.indexOf('scf_SettingName');
        const statusColIndex = headers.indexOf('scf_status');

        if (settingNameColIndex === -1) throw new Error('scf_SettingName column not found.');
        if (statusColIndex === -1) throw new Error('scf_status column not found.');

        let updatedCount = 0;
        for (let i = 1; i < allData.length; i++) { // Start from 1 to skip headers
            if (allData[i][settingNameColIndex] === settingName) {
                allData[i][statusColIndex] = newStatus;
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            dataRange.setValues(allData);
            console.log(`Successfully updated ${updatedCount} records for '${settingName}' to status '${newStatus}'.`);
        } else {
            console.warn(`No records found for '${settingName}'. No updates made.`);
        }

    } catch (error) {
        console.error(`Error in ${functionName}: ${error.message}`);
    }
}

/**
 * Orchestrates the update of SysConfig records for Phase 2, Part 1 testing.
 * Sets the scf_status for relevant import, schema, and validation rules to 'testing_phase2_part1'.
 */
function updateSysConfigForPhase2Part1Testing() {
    const newStatus = 'testing_phase2_part1';
    console.log(`Updating SysConfig records to status: ${newStatus}...`);

    // Update import.drive.web_products_en
    setRecordStatus('import.drive.web_products_en', newStatus);

    // Update schema.data.WebProdS_EN
    setRecordStatus('schema.data.WebProdS_EN', newStatus);

    // Update all validation.rule.* entries
    // This is a comprehensive list based on the SysConfigSnapshot.csv provided earlier.
    setRecordStatus('validation.rule.A1_WebS_NotIn_WebM', newStatus);
    setRecordStatus('validation.rule.A2_WebM_NotIn_WebS', newStatus);
    setRecordStatus('validation.rule.A3_Web_SkuMismatch', newStatus);
    setRecordStatus('validation.rule.A4_Web_NameMismatch', newStatus);
    setRecordStatus('validation.rule.A5_Web_PublishStatusMismatch', newStatus);
    setRecordStatus('validation.rule.C1_ComaxM_NotIn_ComaxS', newStatus);
    setRecordStatus('validation.rule.C2_Comax_IdMismatch', newStatus);
    setRecordStatus('validation.rule.C3_Comax_NameMismatch', newStatus);
    setRecordStatus('validation.rule.C4_Comax_GroupMismatch', newStatus);
    setRecordStatus('validation.rule.C5_Comax_SizeMismatch', newStatus);
    setRecordStatus('validation.rule.C6_Comax_VintageMismatch', newStatus);
    setRecordStatus('validation.rule.D1_Comax_ExcludedNotSellOnline', newStatus);
    setRecordStatus('validation.rule.D2_ComaxS_NegativeStock', newStatus);
    setRecordStatus('validation.rule.D3_ComaxS_ArchivedWithStock', newStatus);
    setRecordStatus('validation.rule.E1_NewComaxOnline_NotIn_WebS', newStatus);
    setRecordStatus('validation.rule.E2_WebS_SKU_NotIn_ComaxS', newStatus);
    setRecordStatus('validation.rule.E3_WebPublished_ComaxNotOnline', newStatus);

    console.log('All specified SysConfig records updated for Phase 2, Part 1 testing.');
}

/**
 * Corrects the naming inconsistency for web product price mapping in SysConfig.
 * Changes 'wps_Price' to 'wps_RegularPrice' in relevant configuration records.
 */
function fixWebProductPriceMapping() {
    const functionName = 'fixWebProductPriceMapping';
    try {
        console.log(`Running ${functionName}...`);
        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheet = spreadsheet.getSheetByName('SysConfig');
        if (!sheet) throw new Error('SysConfig sheet not found.');

        const dataRange = sheet.getDataRange();
        const allData = dataRange.getValues();
        const headers = allData[0];
        const settingNameColIndex = headers.indexOf('scf_SettingName');
        const p01ColIndex = headers.indexOf('scf_P01');
        const p02ColIndex = headers.indexOf('scf_P02');

        if (settingNameColIndex === -1) throw new Error('scf_SettingName column not found.');
        if (p01ColIndex === -1) throw new Error('scf_P01 column not found.');
        if (p02ColIndex === -1) throw new Error('scf_P02 column not found.');

        let updatedCount = 0;
        for (let i = 1; i < allData.length; i++) { // Start from 1 to skip headers
            const settingName = allData[i][settingNameColIndex];
            const p01Value = allData[i][p01ColIndex];
            let p02Value = allData[i][p02ColIndex];

            // Update map.web.product_columns
            if (settingName === 'map.web.product_columns' && p01Value === 'Regular Price' && p02Value === 'wps_Price') {
                allData[i][p02ColIndex] = 'wps_RegularPrice';
                updatedCount++;
                console.log(`Updated map.web.product_columns: wps_Price -> wps_RegularPrice`);
            }
            // Update schema.data.WebProdS_EN
            else if (settingName === 'schema.data.WebProdS_EN' && p01Value === 'headers') {
                if (typeof p02Value === 'string' && p02Value.includes('wps_Price')) {
                    allData[i][p02ColIndex] = p02Value.replace('wps_Price', 'wps_RegularPrice');
                    updatedCount++;
                    console.log(`Updated schema.data.WebProdS_EN headers: wps_Price -> wps_RegularPrice`);
                }
            }
        }

        if (updatedCount > 0) {
            dataRange.setValues(allData);
            console.log(`${functionName} completed successfully. ${updatedCount} records updated.`);
        } else {
            console.warn(`No relevant records found for price mapping fix. No updates made.`);
        }

    } catch (error) {
        console.error(`Error in ${functionName}: ${error.message}`);
    }
}