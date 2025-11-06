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

    Logger.log(`SysConfig sheet dimensions: ${sheet.getLastRow()} rows, ${sheet.getLastColumn()} columns.`);

    const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    Logger.log(`SysConfig data read by getDataRange(): ${data.length} rows.`);
    data.shift(); // Remove header row

    const parsedConfig = {};

    data.forEach(row => {
      const settingName = row[0];
      const status = row[2]; // scf_status
      
      // 1. Ignore section headers and invalid rows
      if (!settingName || String(settingName).startsWith('_section.')) {
        return;
      }

      // Only load 'stable', 'locked', or 'testing_phase2_part1' records, 
      // but ALWAYS load 'sys.schema.version'
      if (settingName !== 'sys.schema.version' && settingName !== 'system.spreadsheet.logs' && status !== 'stable' && status !== 'locked' && status !== 'testing_phase2_part1') {
          return;
      }

      if (String(settingName).startsWith('template.')) {
        // This is a template setting, so we treat it as an array of full rows.
        if (!parsedConfig[settingName]) {
            parsedConfig[settingName] = [];
        }
        // We push the entire row so the consumer can access any 'P' column.
        parsedConfig[settingName].push(row);
      } else {
        // This is a standard key-value setting.
        const propKey = row[3]; // scf_P01
        const propValue = row[4]; // scf_P02

        if (propKey === null || propKey === undefined || propKey === '') {
            return;
        }

        if (!parsedConfig[settingName]) {
            parsedConfig[settingName] = {};
        }
        parsedConfig[settingName][propKey] = propValue;
      }
    });

    // 2. Perform Fail-Fast Schema Version Check
    const liveVersionSetting = parsedConfig['sys.schema.version'];
    console.log('Debug: liveVersionSetting:', liveVersionSetting);
    // The property name for the version setting is 'value'.
    const liveVersion = liveVersionSetting ? Number(liveVersionSetting['value']) : 0;
    console.log('Debug: liveVersion:', liveVersion);

    if (liveVersion !== REQUIRED_SCHEMA_VERSION) {
        throw new Error(`Fatal Error: SysConfig schema mismatch. Live version is ${liveVersion}, but code requires version ${REQUIRED_SCHEMA_VERSION}. Please run migration scripts.`);
    }

    configCache = parsedConfig;
    console.log(`Configuration loaded. Schema version ${liveVersion} validated.`);
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
