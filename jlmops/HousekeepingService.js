/**
 * @file HousekeepingService.js
 * @description This service performs housekeeping tasks.
 * It handles maintenance routines like cleaning up old data, archiving, and optimizing resources.
 */

/**
 * A global function to allow manual triggering of the configuration health check from the Apps Script editor.
 */
function runHealthCheck() {
    housekeepingService.validateCurrentConfig();
}

/**
 * HousekeepingService provides methods for performing various maintenance tasks.
 */
function HousekeepingService() {
  // Configuration for what constitutes "old" data (e.g., 30 days)
  const OLD_DATA_THRESHOLD_DAYS = 30;

  /**
   * Validates the live SysConfig sheet against the master schema in setup.js.
   * @returns {{isValid: boolean, errors: Array<string>}} A report object.
   */
  this.validateCurrentConfig = function() {
    console.log("--- Starting Configuration Health Check ---");
    let isValid = true;
    const errors = [];

    try {
      // Get the master schema and the live config
      const masterConfig = SYS_CONFIG_DEFINITIONS; // Global constant from setup.js
      const liveConfig = ConfigService.getAllConfig();

      if (!liveConfig) {
        throw new Error("Could not load live configuration from SysConfig sheet.");
      }

      // Check that all master settings exist in the live config
      for (const settingName in masterConfig) {
        if (!liveConfig[settingName]) {
          isValid = false;
          errors.push(`Missing setting: The entire block for '${settingName}' is missing.`);
          continue;
        }

        // Check that all properties in the master setting exist in the live setting
        for (const propName in masterConfig[settingName]) {
          if (!liveConfig[settingName].hasOwnProperty(propName)) {
            isValid = false;
            errors.push(`Missing property: '${propName}' is missing from '${settingName}'.`);
          }
        }
      }

      if (isValid) {
        console.log("✅ SUCCESS: Live configuration is valid and matches the master schema.");
      } else {
        console.error("❌ FAILED: Configuration has errors. See details below:");
        errors.forEach(error => console.error(`- ${error}`));
      }

    } catch (e) {
      isValid = false;
      errors.push(e.message);
      console.error(`❌ FAILED: An unexpected error occurred during the health check: ${e.message}`);
    }

    console.log("--- Configuration Health Check Complete ---");
    return { isValid: isValid, errors: errors };
  };

  /**
   * Cleans up old log entries from the system log sheet.
   * This is a placeholder and needs full implementation.
   * @returns {boolean} True if cleanup was attempted, false otherwise.
   */
  this.cleanOldLogs = function() {
    logger.info(`Initiating cleanup of logs older than ${OLD_DATA_THRESHOLD_DAYS} days. (Placeholder: Full implementation needed)`);
    try {
      // TODO: Implement logic to:
      // 1. Access the log sheet (e.g., "SysLog").
      // 2. Identify rows older than OLD_DATA_THRESHOLD_DAYS.
      // 3. Delete or archive those rows.
      // Example:
      // const ss = SpreadsheetApp.getActiveSpreadsheet();
      // const logSheet = ss.getSheetByName("SysLog");
      // if (logSheet) {
      //   const data = logSheet.getDataRange().getValues();
      //   const rowsToDelete = [];
      //   const today = new Date();
      //   for (let i = 1; i < data.length; i++) { // Skip header
      //     const timestamp = new Date(data[i][0]); // Assuming timestamp is in the first column
      //     const diffTime = Math.abs(today - timestamp);
      //     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      //     if (diffDays > OLD_DATA_THRESHOLD_DAYS) {
      //       rowsToDelete.push(i + 1); // +1 for 1-based indexing
      //     }
      //   }
      //   // Delete rows from bottom up to avoid index issues
      //   for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      //     logSheet.deleteRow(rowsToDelete[i]);
      //   }
      //   logger.info(`Cleaned up ${rowsToDelete.length} old log entries.`);
      // } else {
      //   logger.warn("SysLog sheet not found for cleanup.");
      // }
      return true;
    } catch (e) {
      logger.error(`Error during old log cleanup: ${e.message}`, e);
      return false;
    }
  };

  /**
   * Performs a set of daily maintenance tasks.
   * This can be triggered by a time-driven trigger.
   */
  this.performDailyMaintenance = function() {
    logger.info("Starting daily maintenance tasks.");
    this.cleanOldLogs();
    // TODO: Add other daily tasks here, e.g.:
    // - Archive completed orders/tasks
    // - Optimize specific sheets
    // - Run data integrity checks
    logger.info("Daily maintenance tasks completed.");
  };

  // TODO: Add more specific housekeeping methods as needed.
  // this.archiveCompletedOrders = function() { ... };
  // this.optimizeSheet = function(sheetName) { ... };
}

// Global instance for easy access throughout the project
const housekeepingService = new HousekeepingService();