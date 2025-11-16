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
    const logEntry = [
      `${timestamp.toLocaleString()} | ${getSessionId()}`,
      level,
      serviceName,
      functionName,
      message,
      stackTrace
    ];

    // Log to Apps Script execution log for immediate debugging
    console.log(logEntry.join(" | "));

    // Only write ERROR level logs to the persistent sheet, per user request.
    if (level !== 'ERROR') {
      return;
    }

    try {
      const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
      const sheetNames = ConfigService.getConfig('system.sheet_names');

      if (!logSheetConfig || !logSheetConfig.id) {
        console.error("Log Spreadsheet ID not found in SysConfig. Cannot log to sheet.");
        return;
      }
      const ss = SpreadsheetApp.openById(logSheetConfig.id);
      const sheet = ss.getSheetByName(sheetNames.SysLog);
      if (sheet) {
        // Reconstruct the log entry to match the schema
        const sheetLogEntry = [timestamp, getSessionId(), level, serviceName, functionName, message, stackTrace];
        sheet.appendRow(sheetLogEntry);
      } else {
        console.warn(`Log sheet '${sheetNames.SysLog}' not found.`);
      }
    } catch (e) {
      // Use console.error for logging failures to avoid an infinite loop
      console.error(`Failed to write to log sheet: ${e.message}`);
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
    }
  };
})();

// Global instance for easy access throughout the project
const logger = LoggerService;
