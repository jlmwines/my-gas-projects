/**
 * @file setup.js
 * @description Contains one-time setup functions for the JLM Operations Hub.
 */

/**
 * Ensures the header row for a given sheet exists and matches the expected headers.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to check.
 * @param {Array<string>} expectedHeaders An array of the expected header strings.
 */
function ensureHeaderRow(sheet, expectedHeaders) {
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    console.log(`Header row for sheet '${sheet.getName()}' has been set.`);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
  let needsUpdate = false;
  for (let i = 0; i < expectedHeaders.length; i++) {
    if (currentHeaders[i] !== expectedHeaders[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    console.log(`Header row for sheet '${sheet.getName()}' has been updated.`);
  }
}

/**
 * Populates the SysConfig sheet with initial, essential configuration using the structured format.
 * This function should be run once after the project is set up.
 */
function setupSysConfig() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("spreadsheetId");
  if (!spreadsheetId) {
    console.error("Spreadsheet ID not found. Please run saveInitialConfig() first.");
    return;
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName("SysConfig");
  if (!sheet) {
    console.error("Sheet 'SysConfig' not found. Please ensure it exists.");
    return;
  }

  // Define headers as per DATA_MODEL.md, including all 10 parameter columns
  const expectedHeaders = [
    "scf_SettingName", "scf_Description", 
    "scf_P01", "scf_P02", "scf_P03", "scf_P04", "scf_P05", 
    "scf_P06", "scf_P07", "scf_P08", "scf_P09", "scf_P10"
  ];
  ensureHeaderRow(sheet, expectedHeaders);

  // Define the configuration rows
  const configRows = [
    {
      SettingName: "comax.products.import",
      Description: "Configuration for the Comax Products CSV import.",
      P01: "1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j", // folderId
      P02: "ComaxProducts.csv", // fileName
      P03: "Windows-1255" // encoding
    },
    {
      SettingName: "comax.products.processedFolder",
      Description: "Folder where processed Comax product files are moved.",
      P01: "1NRmJ08UxLoWt9lHy5s51ATR_oCp8ygmQ" // folderId
    }
  ];

  const data = sheet.getDataRange().getValues();
  const settingNameColIdx = 0; // Index for scf_SettingName

  configRows.forEach(configRow => {
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) { // Start from 1 to skip header
      if (data[i][settingNameColIdx] === configRow.SettingName) {
        rowIndex = i;
        break;
      }
    }

    const rowValues = [
      configRow.SettingName, configRow.Description, 
      configRow.P01 || "", configRow.P02 || "", configRow.P03 || "", 
      configRow.P04 || "", configRow.P05 || "", configRow.P06 || "", 
      configRow.P07 || "", configRow.P08 || "", configRow.P09 || "", 
      configRow.P10 || ""
    ];

    if (rowIndex !== -1) {
      // Update existing row
      sheet.getRange(rowIndex + 1, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      // Append new row
      sheet.appendRow(rowValues);
    }
  });

  console.log("SysConfig sheet populated successfully with full structured data.");
}

/**
 * Creates the SysFileRegistry sheet if it doesn't already exist.
 * This sheet is crucial for preventing duplicate file processing.
 */
function createFileRegistrySheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("spreadsheetId");
  if (!spreadsheetId) {
    console.error("Spreadsheet ID not found in script properties. Please run saveInitialConfig() first.");
    return;
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheetName = "SysFileRegistry";

  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    console.log(`Sheet '${sheetName}' created successfully.`);
  }

  // Define headers as per DATA_MODEL.md
  const expectedHeaders = ["sfr_FileID", "sfr_ProcessedTimestamp"];
  ensureHeaderRow(sheet, expectedHeaders);
}