/**
 * @file LoggerService.js
 * @description This service provides logging functionality.
 */

/**
 * LoggerService provides methods for logging messages at different levels.
 */
function LoggerService() {
  const LOG_SHEET_NAME = "SysLog"; // Placeholder for a dedicated log sheet

  /**
   * Logs a message at the INFO level.
   * @param {string} message The message to log.
   * @param {object} [data] Optional data to log alongside the message.
   */
  this.info = function(message, data) {
    this._log('INFO', message, data);
  };

  /**
   * Logs a message at the WARNING level.
   * @param {string} message The message to log.
   * @param {object} [data] Optional data to log alongside the message.
   */
  this.warn = function(message, data) {
    this._log('WARN', message, data);
  };

  /**
   * Logs a message at the ERROR level.
   * @param {string} message The message to log.
   * @param {Error} [error] The error object to log.
   * @param {object} [data] Optional data to log alongside the message.
   */
  this.error = function(message, error, data) {
    this._log('ERROR', message, data, error);
  };

  /**
   * Internal method to handle the actual logging.
   * @private
   * @param {string} level The log level (e.g., 'INFO', 'WARN', 'ERROR').
   * @param {string} message The message to log.
   * @param {object} [data] Optional data to log.
   * @param {Error} [error] Optional error object.
   */
  this._log = function(level, message, data, error) {
    const timestamp = new Date().toISOString();
    let logEntry = `${timestamp} [${level}] ${message}`;

    if (data) {
      logEntry += ` Data: ${JSON.stringify(data)}`;
    }
    if (error) {
      logEntry += ` Error: ${error.message} Stack: ${error.stack}`;
    }

    // Log to Apps Script execution log
    console.log(logEntry);

    // TODO: Implement logging to a Google Sheet (e.g., LOG_SHEET_NAME)
    // Example:
    // try {
    //   const ss = SpreadsheetApp.getActiveSpreadsheet();
    //   const sheet = ss.getSheetByName(LOG_SHEET_NAME);
    //   if (sheet) {
    //     sheet.appendRow([timestamp, level, message, data ? JSON.stringify(data) : '', error ? error.message : '', error ? error.stack : '']);
    //   } else {
    //     console.warn(`Log sheet '${LOG_SHEET_NAME}' not found.`);
    //   }
    // } catch (e) {
    //   console.error(`Failed to write to log sheet: ${e.message}`);
    // }
  };
}

// Global instance for easy access throughout the project
const logger = new LoggerService();