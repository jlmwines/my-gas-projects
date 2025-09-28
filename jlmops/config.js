/**
 * @file config.js
 * @description Provides a centralized service for reading and accessing system configuration.
 */

const ConfigService = (function() {
  let configCache = null;

  const DATA_SPREADSHEET_NAME = 'JLMops_Data';

  /**
   * Finds the JLMops_Data spreadsheet by name.
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet object.
   */
  function findDataSpreadsheet() {
    console.log(`Searching for spreadsheet named '${DATA_SPREADSHEET_NAME}'...`);
    const files = DriveApp.getFilesByName(DATA_SPREADSHEET_NAME);
    if (!files.hasNext()) {
      throw new Error(`No spreadsheet found with the name '${DATA_SPREADSHEET_NAME}'.`);
    }
    const file = files.next();
    if (files.hasNext()) {
      console.warn(`Multiple spreadsheets found with the name '${DATA_SPREADSHEET_NAME}'. Using the first one found.`);
    }
    console.log(`Found spreadsheet with ID: ${file.getId()}`);
    return SpreadsheetApp.open(file);
  }

  /**
   * Reads the SysConfig sheet and parses it into a structured cache.
   */
  function loadConfig() {
    if (configCache) {
      return;
    }

    const spreadsheet = findDataSpreadsheet();
    const sheet = spreadsheet.getSheetByName('SysConfig');
    if (!sheet) {
      throw new Error("Sheet 'SysConfig' not found in the JLMops_Data spreadsheet.");
    }

    const data = sheet.getDataRange().getValues();
    data.shift(); // Remove header row

    const parsedConfig = {};

    data.forEach(row => {
      const settingName = row[0];
      // Per the documented schema:
      // row[0] is scf_SettingName
      // row[1] is scf_Description (ignored by parser)
      // row[2] is scf_P01 (the property name)
      // row[3] is scf_P02 (the property value)
      const propName = row[2]; 
      const propValue = row[3];

      // A row must have at least a setting name and a property name to be valid.
      if (!settingName || propName === null || propName === undefined || propName === '') {
        return;
      }

      if (!parsedConfig[settingName]) {
        parsedConfig[settingName] = {};
      }

      parsedConfig[settingName][propName] = propValue;
    });

    configCache = parsedConfig;
    console.log('Configuration loaded and parsed successfully.');
  }

  /**
   * Public method to get a configuration block.
   * @param {string} settingName The name of the configuration block to retrieve.
   * @returns {object} The configuration object, or null if not found.
   */
  function getConfig(settingName) {
    if (!configCache) {
      try {
        loadConfig();
      } catch (e) {
        console.error(`Failed to load configuration: ${e.message}`);
        return null;
      }
    }
    return configCache[settingName] || null;
  }
  
  /**
   * Public method to get all configurations.
   * @returns {object} The entire configuration object.
   */
  function getAllConfig() {
    if (!configCache) {
      try {
        loadConfig();
      } catch (e) {
        console.error(`Failed to load configuration: ${e.message}`);
        return null;
      }
    }
    return configCache;
  }

  /**
   * Public method to invalidate the cache, forcing a reload on next access.
   */
  function forceReload() {
    configCache = null;
    console.log('Configuration cache invalidated.');
  }

  return {
    getConfig: getConfig,
    getAllConfig: getAllConfig,
    forceReload: forceReload
  };
})();