/**
 * @file config.js
 * @description Provides a centralized service for reading and accessing system configuration.
 */

const ConfigService = (function() {
  let configCache = null;
  const DATA_SPREADSHEET_NAME = 'JLMops_Data';
  const REQUIRED_SCHEMA_VERSION = 2; // The schema version this code is built for.

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
   * This function performs a critical schema version check on load.
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
      
      // 1. Ignore section headers and invalid rows
      if (!settingName || String(settingName).startsWith('_section.')) {
        return;
      }

      const propName = row[2]; 
      const propValue = row[3];

      if (propName === null || propName === undefined || propName === '') {
        return;
      }

      if (!parsedConfig[settingName]) {
        parsedConfig[settingName] = {};
      }

      parsedConfig[settingName][propName] = propValue;
    });

    // 2. Perform Fail-Fast Schema Version Check
    const liveVersionSetting = parsedConfig['sys.schema.version'];
    // The property name for the version setting is 'value'.
    const liveVersion = liveVersionSetting ? Number(liveVersionSetting['value']) : 0;

    if (liveVersion !== REQUIRED_SCHEMA_VERSION) {
        throw new Error(`Fatal Error: SysConfig schema mismatch. Live version is ${liveVersion}, but code requires version ${REQUIRED_SCHEMA_VERSION}. Please run migration scripts.`);
    }

    configCache = parsedConfig;
    console.log(`Configuration loaded. Schema version ${liveVersion} validated.`);
  }

  /**
   * Returns a snapshot of the current SysConfig as an array of objects.
   * This is for planning and diagnostics by the development agent.
   * @returns {Array<Object> | null}
   */
  function getSysConfigSnapshot() {
    try {
      const spreadsheet = findDataSpreadsheet();
      const sheet = spreadsheet.getSheetByName('SysConfig');
      if (!sheet) {
        throw new Error("Sheet 'SysConfig' not found for snapshot.");
      }
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();

      const snapshot = data.map(row => {
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header] = row[index];
        });
        return rowObject;
      });
      return snapshot;
    } catch (e) {
      console.error(`Could not generate SysConfig snapshot: ${e.message}`);
      return null;
    }
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
    forceReload: forceReload,
    getSysConfigSnapshot: getSysConfigSnapshot // Expose the new function
  };
})();