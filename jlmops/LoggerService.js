/**
 * @file LoggerService.js
 * @description This service provides logging functionality.
 */

/**
 * LoggerService provides methods for logging messages at different levels.
 */
const LoggerService = (function() {
  const LOG_SHEET_NAME = "SysLog";
  let internalSessionId = null; // Renamed to avoid confusion with context.sessionId

  function getInternalSessionId() {
    if (!internalSessionId) {
      internalSessionId = 'INTERNAL-' + Utilities.getUuid();
    }
    return internalSessionId;
  }

  /**
   * Internal method to handle the actual logging.
   * @private
   * @param {string} level The log level (e.g., 'INFO', 'WARN', 'ERROR').
   * @param {string} serviceName The name of the service calling the logger.
   * @param {string} functionName The name of the function calling the logger.
   * @param {string} message The message to log.
   * @param {object} [context={}] Optional context object containing sessionId and data.
   * @param {string} [stackTrace] Optional error stack trace.
   */
  function _log(level, serviceName, functionName, message, context = {}, stackTrace = '') {
    const timestamp = new Date();
    let currentSessionId = context.sessionId;
    
    if (!currentSessionId) {
        currentSessionId = getInternalSessionId();
        // Strict Context Enforcement: Warn on ERROR logs if no session ID was provided
        if (level === 'ERROR') {
            console.warn(`[Context Warning] ERROR log generated without explicit Session ID in ${serviceName}.${functionName}`);
        }
    }
    
    const logData = context.data ? JSON.stringify(context.data) : '';

    const logEntry = [
      timestamp,
      currentSessionId,
      level,
      serviceName,
      functionName,
      message,
      logData, // New sl_Data column
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
    info: function(serviceName, functionName, message, context = {}) {
      _log('INFO', serviceName, functionName, message, context);
    },
    warn: function(serviceName, functionName, message, context = {}) {
      _log('WARN', serviceName, functionName, message, context);
    },
    error: function(serviceName, functionName, message, error, context = {}) {
      const stackTrace = error && error.stack ? error.stack : '';
      _log('ERROR', serviceName, functionName, message, context, stackTrace);
    },

    /**
     * Retrieves the most recent log message for a given session ID.
     * @param {string} sessionId The session ID to filter by.
     * @returns {object|null} The log object { timestamp, message, level } or null if not found.
     */
    getLatestLogForSession: function(sessionId) {
      if (!sessionId) return null;
      try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        // Avoid full openById if we can, but LoggerService usually needs it. 
        // We assume this is called sparingly by the UI polling.
        const ss = SpreadsheetApp.openById(logSheetConfig.id);
        const sheet = ss.getSheetByName(sheetNames.SysLog);
        
        if (!sheet || sheet.getLastRow() < 2) return null;
        
        // Read only the last 100 rows for performance
        const lastRow = sheet.getLastRow();
        const startRow = Math.max(2, lastRow - 100); 
        const numRows = lastRow - startRow + 1;
        
        const data = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
        
        // Fetch headers to be safe about column indices
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const tsIdx = headers.indexOf('sl_Timestamp');
        const sessionIdx = headers.indexOf('sl_SessionId');
        const msgIdx = headers.indexOf('sl_Message');
        const levelIdx = headers.indexOf('sl_LogLevel');

        if (tsIdx === -1 || sessionIdx === -1 || msgIdx === -1) return null;

        // Iterate backwards to find the latest
        for (let i = data.length - 1; i >= 0; i--) {
            const row = data[i];
            if (row[sessionIdx] === sessionId) {
                return {
                    timestamp: row[tsIdx],
                    message: row[msgIdx],
                    level: row[levelIdx]
                };
            }
        }
        return null;
      } catch (e) {
        console.error(`Error fetching latest log: ${e.message}`);
        return null;
      }
    },

    /**
     * Temporary diagnostic function to test log sheet access.
     * @returns {boolean} True if access is successful, false otherwise.
     */
    testLogSheetAccess: function() {
      try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const expectedHeaders = ['sl_Timestamp', 'sl_SessionId', 'sl_LogLevel', 'sl_ServiceName', 'sl_FunctionName', 'sl_Message', 'sl_Data', 'sl_StackTrace'];

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
