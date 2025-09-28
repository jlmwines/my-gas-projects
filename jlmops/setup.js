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
 * - Sorts the sheet by setting name.
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

        const data = sheet.getDataRange().getValues();
        const versionRow = data.find(row => row[0] === 'sys.schema.version');
        const currentVersion = versionRow ? Number(versionRow[3]) : 0;

        if (currentVersion !== REQUIRED_VERSION) {
            throw new Error(`Prerequisite failed. Current schema version is ${currentVersion}, but this migration requires version ${REQUIRED_VERSION}.`);
        }

        // --- Step 1: Add section headers ---
        const sectionHeaders = [
            ['_section.01_System', 'High-level system settings and versioning.'],
            ['_section.02_Imports', 'Configurations for importing data from external sources.'],
            ['_section.03_Schemas', 'Schema definitions for staging and master sheets.'],
            ['_section.04_Mappings', 'Header and value mappings for data transformation.'],
            ['_section.05_Validation', 'Rules for the data validation engine.'],
        ];
        sheet.getRange(sheet.getLastRow() + 1, 1, sectionHeaders.length, 2).setValues(sectionHeaders);
        console.log(`Added ${sectionHeaders.length} section header rows.`);

        // --- Step 2: Sort the sheet ---
        const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
        range.sort({ column: 1, ascending: true });
        console.log('Sorted SysConfig sheet by setting name.');

        // --- Step 3: Update schema version ---
        const newVersionRowIndex = sheet.createTextFinder('sys.schema.version').findNext().getRow();
        sheet.getRange(newVersionRowIndex, 4).setValue(TARGET_VERSION);
        console.log(`Updated sys.schema.version to ${TARGET_VERSION}.`);

        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
    }
}