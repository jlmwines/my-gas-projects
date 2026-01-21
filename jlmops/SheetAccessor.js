/**
 * @file SheetAccessor.js
 * @description Centralized utility for accessing spreadsheets and sheets.
 * Eliminates repeated openById/getSheetByName patterns across services.
 * Caches spreadsheet objects for performance.
 */

const SheetAccessor = (function() {
  'use strict';

  // Cached spreadsheet objects
  let dataSpreadsheet = null;
  let logSpreadsheet = null;

  /**
   * Gets the data spreadsheet, caching it for reuse.
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The data spreadsheet
   */
  function getDataSpreadsheet() {
    if (!dataSpreadsheet) {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig || !allConfig['system.spreadsheet.data']) {
        throw new Error('SheetAccessor: system.spreadsheet.data config not found');
      }
      const id = allConfig['system.spreadsheet.data'].id;
      dataSpreadsheet = SpreadsheetApp.openById(id);
    }
    return dataSpreadsheet;
  }

  /**
   * Gets the log spreadsheet, caching it for reuse.
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The log spreadsheet
   */
  function getLogSpreadsheet() {
    if (!logSpreadsheet) {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig || !allConfig['system.spreadsheet.log']) {
        throw new Error('SheetAccessor: system.spreadsheet.log config not found');
      }
      const id = allConfig['system.spreadsheet.log'].id;
      logSpreadsheet = SpreadsheetApp.openById(id);
    }
    return logSpreadsheet;
  }

  /**
   * Gets a sheet from the data spreadsheet by name.
   * @param {string} sheetName - The name of the sheet
   * @param {boolean} [throwIfMissing=true] - Whether to throw if sheet not found
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null} The sheet, or null if not found and throwIfMissing is false
   */
  function getDataSheet(sheetName, throwIfMissing = true) {
    const spreadsheet = getDataSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet && throwIfMissing) {
      throw new Error(`SheetAccessor: Sheet '${sheetName}' not found in data spreadsheet`);
    }
    return sheet;
  }

  /**
   * Gets a sheet from the log spreadsheet by name.
   * @param {string} sheetName - The name of the sheet
   * @param {boolean} [throwIfMissing=true] - Whether to throw if sheet not found
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null} The sheet, or null if not found and throwIfMissing is false
   */
  function getLogSheet(sheetName, throwIfMissing = true) {
    const spreadsheet = getLogSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet && throwIfMissing) {
      throw new Error(`SheetAccessor: Sheet '${sheetName}' not found in log spreadsheet`);
    }
    return sheet;
  }

  /**
   * Clears cached spreadsheet references.
   * Call this if spreadsheet IDs change or after config reload.
   */
  function clearCache() {
    dataSpreadsheet = null;
    logSpreadsheet = null;
  }

  return {
    getDataSpreadsheet: getDataSpreadsheet,
    getLogSpreadsheet: getLogSpreadsheet,
    getDataSheet: getDataSheet,
    getLogSheet: getLogSheet,
    clearCache: clearCache
  };
})();
