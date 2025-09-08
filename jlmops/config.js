/**
 * @file config.js
 * @description This file manages the application configuration.
 */

const ConfigService = (function() {
  let configCache = null;
  const SCRIPT_PROPERTY_KEY = 'spreadsheetId';

  /**
   * Loads the configuration from the SysConfig sheet into an in-memory cache.
   */
  function loadConfig() {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_KEY);
    if (!spreadsheetId) {
      console.error("Spreadsheet ID not found in script properties. Please run saveInitialConfig() first.");
      return;
    }

    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName("SysConfig");
      const data = sheet.getDataRange().getValues();
      configCache = {};

      data.forEach(row => {
        const key = row[0];
        const value = row[1];
        if (key) {
          configCache[key] = value;
        }
      });

      console.log("Configuration loaded successfully.");
    } catch (e) {
      console.error(`Failed to load configuration: ${e.message}`);
    }
  }

  /**
   * Saves the initial configuration.
   * @param {string} spreadsheetId The ID of the spreadsheet to be used for configuration.
   */
  function saveInitialConfig(spreadsheetId) {
    if (!spreadsheetId) {
      console.error("Spreadsheet ID is required to save initial configuration.");
      return;
    }
    PropertiesService.getScriptProperties().setProperty(SCRIPT_PROPERTY_KEY, spreadsheetId);
    console.log(`Initial configuration saved. Spreadsheet ID: ${spreadsheetId}`);
    // Attempt to load the configuration immediately after saving
    loadConfig();
  }

  /**
   * Gets a configuration value by key.
   * @param {string} key The key of the configuration value to retrieve.
   * @returns {any} The configuration value, or null if not found.
   */
  function get(key) {
    if (!configCache) {
      loadConfig();
    }
    return configCache ? configCache[key] : null;
  }

  /**
   * Gets the entire configuration object.
   * @returns {object} The entire configuration object.
   */
  function getAll() {
    if (!configCache) {
      loadConfig();
    }
    return configCache;
  }

  return {
    saveInitialConfig,
    get,
    getAll
  };
})();

// Global instance for easy access
const config = ConfigService;
