/**
 * @file LoggerService.js
 * @description This service provides logging functionality.
 */

/**
 * LoggerService provides methods for logging messages at different levels.
 */
const LoggerService = (function() {
  const LOG_SHEET_NAME = "SysLog";
  let sessionId = null;

  function getSessionId() {
    if (!sessionId) {
      sessionId = Utilities.getUuid();
    }
    return sessionId;
  }

  /**
   * Internal method to handle the actual logging.
   * @private
   * @param {string} level The log level (e.g., 'INFO', 'WARN', 'ERROR').
   * @param {string} serviceName The name of the service calling the logger.
   * @param {string} functionName The name of the function calling the logger.
   * @param {string} message The message to log.
   * @param {string} [stackTrace] Optional error stack trace.
   */
  function _log(level, serviceName, functionName, message, stackTrace = '') {
    const timestamp = new Date();
    const sessionId = getSessionId();
    const logEntry = [
      timestamp,
      sessionId,
      level,
      serviceName,
      functionName,
      message,
      stackTrace
    ];

    // Log to Apps Script execution log for immediate debugging
    console.log(logEntry);

    try {
      const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
      const sheetNames = ConfigService.getConfig('system.sheet_names');

      if (!logSheetConfig || !logSheetConfig.id) {
        console.error("Log Spreadsheet ID not found in SysConfig. Cannot log to sheet.");
        return;
      }
      
      const ss = SpreadsheetApp.openById(logSheetConfig.id);
      const logSheetName = sheetNames.SysLog;
      const sheet = ss.getSheetByName(logSheetName);

      if (sheet) {
        sheet.appendRow(logEntry);
      } else {
        console.warn(`Log sheet '${logSheetName}' not found.`);
      }
    } catch (e) {
      // Use console.error for logging failures to avoid an infinite loop
      console.error(`Failed to write to log sheet: ${e.message}`, e.stack);
    }
  }

  return {
    info: function(serviceName, functionName, message) {
      _log('INFO', serviceName, functionName, message);
    },
    warn: function(serviceName, functionName, message) {
      _log('WARN', serviceName, functionName, message);
    },
    error: function(serviceName, functionName, message, error) {
      const stackTrace = error && error.stack ? error.stack : '';
      _log('ERROR', serviceName, functionName, message, stackTrace);
    },

    /**
     * Temporary diagnostic function to test log sheet access.
     * @returns {boolean} True if access is successful, false otherwise.
     */
    testLogSheetAccess: function() {
      try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const expectedHeaders = ['sl_Timestamp', 'sl_SessionId', 'sl_LogLevel', 'sl_ServiceName', 'sl_FunctionName', 'sl_Message', 'sl_StackTrace'];

        if (!logSheetConfig || !logSheetConfig.id) {
          console.error("ConfigService: Log Spreadsheet ID not found.");
          return false;
        }
        console.log(`Attempting to open spreadsheet with ID: ${logSheetConfig.id}`);
        const ss = SpreadsheetApp.openById(logSheetConfig.id);
        console.log(`Spreadsheet opened successfully: ${ss.getName()}`);

        console.log(`Attempting to get sheet with name: ${sheetNames.SysLog}`);
        const sheet = ss.getSheetByName(sheetNames.SysLog);
        if (!sheet) {
          console.error(`Sheet '${sheetNames.SysLog}' not found in spreadsheet.`);
          return false;
        }
        console.log(`Sheet '${sheetNames.SysLog}' found successfully.`);

        // Test column access by reading headers
        const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        console.log(`Header row: ${headerRow}`);

        const missingHeaders = expectedHeaders.filter(header => !headerRow.includes(header));
        if (missingHeaders.length > 0) {
          console.error(`Missing expected headers in SysLog sheet: ${missingHeaders.join(', ')}`);
          return false;
        }
        console.log("All expected headers found in SysLog sheet.");

        return true;
      } catch (e) {
        console.error(`Error during log sheet access test: ${e.message}`);
        return false;
      }
    }
  };
})();

// Global instance for easy access throughout the project
const logger = LoggerService;

/**
 * Global function to test log sheet access, executable from Apps Script editor.
 * @returns {boolean} True if access is successful, false otherwise.
 */
function testLoggerServiceAccess() {
  return LoggerService.testLogSheetAccess();
}
