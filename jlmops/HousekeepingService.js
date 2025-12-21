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
 * A global function to trigger daily maintenance tasks manually or via trigger.
 */
function runDailyMaintenance() {
    housekeepingService.performDailyMaintenance();
}

/**
 * HousekeepingService provides methods for performing various maintenance tasks.
 */
function HousekeepingService() {
  const OLD_DATA_THRESHOLD_DAYS = 30; // Default for logs/tasks if not in SysConfig
  const EXPORT_RETENTION_DAYS = 7;
  const OLD_EXPORTS_RETENTION_DAYS = 90;
  const ARCHIVE_FOLDER_RETENTION_DAYS = 365;
  const MIN_LOG_ROWS = 1000; // Keep this many recent log rows regardless of age
  const IMPORT_FILE_RETENTION_DAYS = 2; // Days to keep timestamped import files

  function _getThresholdDate(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  /**
   * Generic helper to move rows from a source sheet to an archive sheet.
   * Assumes both sheets have identical headers.
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sourceSheet The sheet to move rows from.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} archiveSheet The sheet to move rows to.
   * @param {function(Array<any>, number): boolean} filterFunction A function that takes a row (array) and its 0-based index,
   *   and returns true if the row should be moved to archive.
   * @param {function(Array<Array<any>>): Array<Array<any>>} [postProcessFunction] Optional function to process rows before moving.
   * @returns {number} The number of rows moved.
   */
  function _moveRowsToArchive(sourceSheet, archiveSheet, filterFunction, postProcessFunction = (rows) => rows) {
    const dataRange = sourceSheet.getDataRange();
    const allData = dataRange.getValues();
    if (allData.length <= 1) { // Only headers or empty
      return 0;
    }

    const headers = allData[0];
    const dataRows = allData.slice(1); // Exclude headers

    const rowsToArchive = [];
    const rowsToKeep = [headers]; // Always keep headers

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (filterFunction(row, i)) {
        rowsToArchive.push(row);
      } else {
        rowsToKeep.push(row);
      }
    }

    if (rowsToArchive.length === 0) {
      return 0;
    }

    // Process rows if a postProcessFunction is provided
    const processedRowsToArchive = postProcessFunction(rowsToArchive);

    // Truncate any cell values exceeding Google Sheets' 50,000 character limit
    const MAX_CELL_LENGTH = 49000; // Leave margin below 50,000 limit
    const truncatedRows = processedRowsToArchive.map(row =>
      row.map(cell => {
        if (typeof cell === 'string' && cell.length > MAX_CELL_LENGTH) {
          return cell.substring(0, MAX_CELL_LENGTH) + '... [TRUNCATED]';
        }
        return cell;
      })
    );

    // Append to archive sheet
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, truncatedRows.length, truncatedRows[0].length)
                 .setValues(truncatedRows);

    // Overwrite source sheet with kept rows
    sourceSheet.clearContents();
    if (rowsToKeep.length > 0) {
      sourceSheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }
    SpreadsheetApp.flush(); // Ensure changes are written

    return rowsToArchive.length;
  }


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
          if (propName === '_description') continue; // Don't validate the description itself

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
   * Archives logs older than retention period, keeping MIN_LOG_ROWS most recent.
   * @returns {boolean} True if cleanup was attempted, false otherwise.
   */
  this.cleanOldLogs = function() {
    logger.info('HousekeepingService', 'cleanOldLogs', "Starting cleanup of old log entries.");
    let movedCount = 0;
    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', 'cleanOldLogs', "Configuration not available. Run rebuildSysConfigFromSource.");
        return false;
      }

      const logsSpreadsheet = SpreadsheetApp.openById(allConfig['system.spreadsheet.logs'].id);
      const logSheetName = allConfig['system.sheet_names'].SysLog;
      const logArchiveSheetName = allConfig['system.sheet_names'].SysLog_Archive;
      const logSheet = logsSpreadsheet.getSheetByName(logSheetName);
      const logArchiveSheet = logsSpreadsheet.getSheetByName(logArchiveSheetName);

      if (!logSheet || !logArchiveSheet) {
        logger.warn('HousekeepingService', 'cleanOldLogs', "SysLog or SysLog_Archive sheet not found. Skipping log cleanup.");
        return false;
      }

      // Get schema-defined headers for timestamp column
      const logSchema = allConfig['schema.log.SysLog'];
      if (!logSchema || !logSchema.headers) {
        logger.error('HousekeepingService', 'cleanOldLogs', "SysLog schema not found in configuration.");
        return false;
      }
      const headers = logSchema.headers.split(',');
      const timestampCol = headers.indexOf('sl_Timestamp');

      if (timestampCol === -1) {
        logger.error('HousekeepingService', 'cleanOldLogs', "sl_Timestamp column not found in schema.");
        return false;
      }

      const totalDataRows = logSheet.getLastRow() - 1; // Exclude header

      // Calculate the index from which to keep rows
      // dataRows are in chronological order (oldest first from sheet)
      // We want to keep the LAST MIN_LOG_ROWS rows, archive everything before that
      const keepStartIndex = Math.max(0, totalDataRows - MIN_LOG_ROWS);

      // Filter function: archive all rows before keepStartIndex (regardless of age)
      const filterLogs = (row, index) => {
        return index < keepStartIndex;
      };

      movedCount = _moveRowsToArchive(logSheet, logArchiveSheet, filterLogs);
      logger.info('HousekeepingService', 'cleanOldLogs', `Cleaned up ${movedCount} old log entries from SysLog (keeping ${MIN_LOG_ROWS} recent).`);
      return true;
    } catch (e) {
      logger.error('HousekeepingService', 'cleanOldLogs', `Error during old log cleanup: ${e.message}`, e);
      return false;
    }
  };

  /**
   * Performs a set of daily maintenance tasks in 3 phases.
   * This can be triggered by a time-driven trigger.
   *
   * Phase 1: Cleanup - logs, tasks, files
   * Phase 2: Validation & Testing - master_master suite, unit tests
   * Phase 3: Service Updates - bundle health, Brurya reminder
   */
  this.performDailyMaintenance = function() {
    const functionName = 'performDailyMaintenance';
    logger.info('HousekeepingService', functionName, "Starting daily maintenance.");

    // Phase 1: Cleanup
    this.cleanOldLogs();
    this.archiveCompletedTasks();
    this.manageFileLifecycle();
    this.cleanupImportFiles();

    // Phase 2: Validation & Testing
    let validationResult = null;
    let testResult = null;

    try {
      validationResult = ValidationOrchestratorService.runValidationSuite('master_master', null);
      logger.info('HousekeepingService', functionName,
        `Master validation: ${validationResult.failureCount} issues found.`);
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Validation failed: ${e.message}`);
    }

    try {
      testResult = TestRunner.runAllTests();
      logger.info('HousekeepingService', functionName,
        `Unit tests: ${testResult.passed}/${testResult.total} passed`);
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Tests failed: ${e.message}`);
    }

    // Update system health singleton task
    try {
      TaskService.upsertSingletonTask(
        'task.system.health_status',
        '_SYSTEM',
        'System Health',
        'System Health Status',
        {
          updated: new Date().toISOString(),
          last_housekeeping: {
            timestamp: new Date().toISOString(),
            status: (validationResult && testResult) ? 'success' : 'partial',
            unit_tests: testResult ? `${testResult.passed}/${testResult.total}` : 'error',
            validation_issues: validationResult ? validationResult.failureCount : -1
          }
        }
      );
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Could not update health task: ${e.message}`);
    }

    // Phase 3: Service Data Updates
    this.checkBundleHealth();
    this.checkBruryaReminder();
    this.checkSubscribersReminder();
    this.checkCampaignsReminder();
    this.checkCouponsReminder();
    this.refreshCrmContacts();
    this.maintainCityLookup();
    this.backfillActivities();
    this.runCrmIntelligence();

    logger.info('HousekeepingService', functionName, "Daily maintenance completed.");
  };

  /**
   * Checks if Brurya warehouse inventory needs updating.
   * Creates/updates task.inventory.brurya_update with daysSinceUpdate in notes.
   * Task created if > 7 days since last update, but notes always updated.
   */
  this.checkBruryaReminder = function() {
    const functionName = 'checkBruryaReminder';

    try {
      const allConfig = ConfigService.getAllConfig();
      const bruryaConfig = allConfig['system.brurya.last_update'];
      const lastUpdate = bruryaConfig?.value ? new Date(bruryaConfig.value) : null;

      let daysSinceUpdate = lastUpdate
        ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
        : 999; // No update ever = needs attention

      const notesJson = JSON.stringify({ daysSinceUpdate: daysSinceUpdate });

      // Check if task already exists
      const existingTask = TaskService.findOpenTaskByType('task.inventory.brurya_update', 'BRURYA');

      if (existingTask) {
        // Update existing task notes with current days count
        TaskService.updateTaskNotes(existingTask.st_TaskId, notesJson);
        logger.info('HousekeepingService', functionName, `Updated Brurya task notes (${daysSinceUpdate} days).`);
      } else if (daysSinceUpdate >= 7) {
        // Create new task if overdue
        try {
          TaskService.createTask(
            'task.inventory.brurya_update',
            'BRURYA',
            'Brurya Warehouse',
            'Update Brurya Inventory',
            notesJson,
            null
          );
          logger.info('HousekeepingService', functionName, `Created Brurya reminder task (${daysSinceUpdate} days since last update).`);
        } catch (taskError) {
          if (!taskError.message.includes('already exists')) {
            logger.warn('HousekeepingService', functionName, `Could not create Brurya reminder: ${taskError.message}`);
          }
        }
      }
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Brurya reminder check failed: ${e.message}`);
    }
  };

  /**
   * Checks if Mailchimp subscribers data needs updating.
   * Creates task if > 14 days since last update.
   */
  this.checkSubscribersReminder = function() {
    const functionName = 'checkSubscribersReminder';

    try {
      const allConfig = ConfigService.getAllConfig();
      const config = allConfig['system.mailchimp.subscribers_last_update'];
      const lastUpdate = config?.value ? new Date(config.value) : null;

      let daysSinceUpdate = lastUpdate
        ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const notesJson = JSON.stringify({ daysSinceUpdate: daysSinceUpdate });
      const existingTask = TaskService.findOpenTaskByType('task.data.subscribers_update', 'DATA');

      if (existingTask) {
        TaskService.updateTaskNotes(existingTask.st_TaskId, notesJson);
        logger.info('HousekeepingService', functionName, `Updated subscribers task notes (${daysSinceUpdate} days).`);
      } else if (daysSinceUpdate >= 14) {
        try {
          TaskService.createTask(
            'task.data.subscribers_update',
            'DATA',
            'Data Import',
            'Update Mailchimp Subscribers',
            notesJson,
            null
          );
          logger.info('HousekeepingService', functionName, `Created subscribers reminder task (${daysSinceUpdate} days since last update).`);
        } catch (taskError) {
          if (!taskError.message.includes('already exists')) {
            logger.warn('HousekeepingService', functionName, `Could not create subscribers reminder: ${taskError.message}`);
          }
        }
      }
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Subscribers reminder check failed: ${e.message}`);
    }
  };

  /**
   * Checks if Mailchimp campaigns data needs updating.
   * Creates task if > 14 days since last update.
   */
  this.checkCampaignsReminder = function() {
    const functionName = 'checkCampaignsReminder';

    try {
      const allConfig = ConfigService.getAllConfig();
      const config = allConfig['system.mailchimp.campaigns_last_update'];
      const lastUpdate = config?.value ? new Date(config.value) : null;

      let daysSinceUpdate = lastUpdate
        ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const notesJson = JSON.stringify({ daysSinceUpdate: daysSinceUpdate });
      const existingTask = TaskService.findOpenTaskByType('task.data.campaigns_update', 'DATA');

      if (existingTask) {
        TaskService.updateTaskNotes(existingTask.st_TaskId, notesJson);
        logger.info('HousekeepingService', functionName, `Updated campaigns task notes (${daysSinceUpdate} days).`);
      } else if (daysSinceUpdate >= 14) {
        try {
          TaskService.createTask(
            'task.data.campaigns_update',
            'DATA',
            'Data Import',
            'Update Mailchimp Campaigns',
            notesJson,
            null
          );
          logger.info('HousekeepingService', functionName, `Created campaigns reminder task (${daysSinceUpdate} days since last update).`);
        } catch (taskError) {
          if (!taskError.message.includes('already exists')) {
            logger.warn('HousekeepingService', functionName, `Could not create campaigns reminder: ${taskError.message}`);
          }
        }
      }
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Campaigns reminder check failed: ${e.message}`);
    }
  };

  /**
   * Checks if WooCommerce coupons data needs updating.
   * Creates task if > 14 days since last update.
   */
  this.checkCouponsReminder = function() {
    const functionName = 'checkCouponsReminder';

    try {
      const allConfig = ConfigService.getAllConfig();
      const config = allConfig['system.woocommerce.coupons_last_update'];
      const lastUpdate = config?.value ? new Date(config.value) : null;

      let daysSinceUpdate = lastUpdate
        ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const notesJson = JSON.stringify({ daysSinceUpdate: daysSinceUpdate });
      const existingTask = TaskService.findOpenTaskByType('task.data.coupons_update', 'DATA');

      if (existingTask) {
        TaskService.updateTaskNotes(existingTask.st_TaskId, notesJson);
        logger.info('HousekeepingService', functionName, `Updated coupons task notes (${daysSinceUpdate} days).`);
      } else if (daysSinceUpdate >= 14) {
        try {
          TaskService.createTask(
            'task.data.coupons_update',
            'DATA',
            'Data Import',
            'Update WooCommerce Coupons',
            notesJson,
            null
          );
          logger.info('HousekeepingService', functionName, `Created coupons reminder task (${daysSinceUpdate} days since last update).`);
        } catch (taskError) {
          if (!taskError.message.includes('already exists')) {
            logger.warn('HousekeepingService', functionName, `Could not create coupons reminder: ${taskError.message}`);
          }
        }
      }
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Coupons reminder check failed: ${e.message}`);
    }
  };

  /**
   * Refreshes CRM contact calculated fields (lifecycle status, churn risk, etc.)
   * Should run daily to keep DaysSinceOrder and status calculations current.
   */
  this.refreshCrmContacts = function() {
    const functionName = 'refreshCrmContacts';
    logger.info('HousekeepingService', functionName, "Starting CRM contact refresh.");

    try {
      // Check if ContactService exists (CRM may not be fully deployed yet)
      if (typeof ContactService === 'undefined' || !ContactService.refreshAllContacts) {
        logger.info('HousekeepingService', functionName, 'ContactService not available yet. Skipping CRM refresh.');
        return true;
      }

      ContactService.refreshAllContacts();
      logger.info('HousekeepingService', functionName, "CRM contact refresh completed.");

      // Enrich contact preferences from order history
      if (typeof ContactEnrichmentService !== 'undefined' && ContactEnrichmentService.enrichAllContacts) {
        const enrichResult = ContactEnrichmentService.enrichAllContacts();
        logger.info('HousekeepingService', functionName, `CRM enrichment: ${enrichResult.enriched} enriched, ${enrichResult.skipped} skipped`);
      }

      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `CRM refresh failed: ${e.message}`);
      return false;
    }
  };

  /**
   * Checks for new cities that passed the order threshold.
   * Auto-adds them to SysLkp_Cities and creates a task to categorize.
   */
  this.maintainCityLookup = function() {
    const functionName = 'maintainCityLookup';

    try {
      if (typeof ContactAnalysisService === 'undefined' || !ContactAnalysisService.maintainCityLookup) {
        logger.info('HousekeepingService', functionName, 'ContactAnalysisService not available. Skipping city maintenance.');
        return true;
      }

      const result = ContactAnalysisService.maintainCityLookup();
      if (result.added > 0) {
        logger.info('HousekeepingService', functionName, `Added ${result.added} new cities: ${result.cities.join(', ')}`);
      } else {
        logger.info('HousekeepingService', functionName, 'No new cities to add.');
      }
      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `City lookup maintenance failed: ${e.message}`);
      return false;
    }
  };

  /**
   * Checks bundle health and creates tasks for inventory issues.
   * Creates task.bundle.critical_inventory for bundles with zero-stock members.
   * Creates task.bundle.low_inventory for bundles with low (but not zero) stock.
   */
  this.checkBundleHealth = function() {
    const functionName = 'checkBundleHealth';
    logger.info('HousekeepingService', functionName, "Starting bundle health check.");

    try {
      // Get bundles with low inventory (BundleService uses system.inventory.minimum_stock)
      const bundlesWithIssues = BundleService.getBundlesWithLowInventory();

      let criticalTasksCreated = 0;
      let lowInventoryTasksCreated = 0;

      for (const bundleData of bundlesWithIssues) {
        const bundle = bundleData.bundle;

        // Separate zero-stock (critical) from low-stock (normal)
        const zeroStockSlots = bundleData.lowStockSlots.filter(s => s.stock === 0);
        const lowStockSlots = bundleData.lowStockSlots.filter(s => s.stock > 0);

        // Create critical inventory task for zero-stock
        if (zeroStockSlots.length > 0) {
          const skuList = zeroStockSlots.map(s => s.currentSKU).join(', ');
          try {
            TaskService.createTask(
              'task.bundle.critical_inventory',
              bundle.bundleId,
              bundle.nameEn || bundle.nameHe || bundle.bundleId,
              `Critical: Bundle has zero-stock products`,
              `Bundle "${bundle.nameEn || bundle.nameHe}" has ${zeroStockSlots.length} product(s) with zero inventory: ${skuList}`,
              null
            );
            criticalTasksCreated++;
          } catch (taskError) {
            logger.warn('HousekeepingService', functionName, `Could not create critical bundle task: ${taskError.message}`);
          }
        }

        // Create low inventory task for non-zero low stock (only if no critical task for same bundle)
        if (lowStockSlots.length > 0 && zeroStockSlots.length === 0) {
          const skuList = lowStockSlots.map(s => `${s.currentSKU}(${s.stock})`).join(', ');
          try {
            TaskService.createTask(
              'task.bundle.low_inventory',
              bundle.bundleId,
              bundle.nameEn || bundle.nameHe || bundle.bundleId,
              `Bundle has low-stock products`,
              `Bundle "${bundle.nameEn || bundle.nameHe}" has ${lowStockSlots.length} product(s) with low inventory: ${skuList}`,
              null
            );
            lowInventoryTasksCreated++;
          } catch (taskError) {
            logger.warn('HousekeepingService', functionName, `Could not create low inventory bundle task: ${taskError.message}`);
          }
        }
      }

      // Monthly review task - create on the 1st of each month
      const today = new Date();
      if (today.getDate() === 1) {
        const stats = BundleService.getBundleStats();
        if (stats.active > 0) {
          try {
            TaskService.createTask(
              'task.bundle.monthly_review',
              `review-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
              'Monthly Bundle Review',
              `Monthly Bundle Review - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              `Active bundles: ${stats.active}, Needs attention: ${stats.needsAttention}, Low inventory slots: ${stats.lowInventoryCount}`,
              null
            );
            logger.info('HousekeepingService', functionName, 'Created monthly bundle review task.');
          } catch (taskError) {
            logger.warn('HousekeepingService', functionName, `Could not create monthly review task: ${taskError.message}`);
          }
        }
      }

      logger.info('HousekeepingService', functionName, `Bundle health check complete. Critical: ${criticalTasksCreated}, Low inventory: ${lowInventoryTasksCreated}`);
      return true;
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Error during bundle health check: ${e.message}`, e);
      return false;
    }
  };

  // TODO: Add more specific housekeeping methods as needed.
  // this.archiveCompletedOrders = function() { ... };
  // this.optimizeSheet = function(sheetName) { ... };
  this.archiveCompletedTasks = function() {
    logger.info('HousekeepingService', 'archiveCompletedTasks', "Starting archiving of completed/cancelled tasks.");
    let movedCount = 0;
    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', 'archiveCompletedTasks', "Configuration not available. Run rebuildSysConfigFromSource.");
        return false;
      }

      const dataSpreadsheet = SpreadsheetApp.openById(allConfig['system.spreadsheet.data'].id);
      const taskSheetName = allConfig['system.sheet_names'].SysTasks;
      const taskArchiveSheetName = allConfig['system.sheet_names'].SysTasks_Archive;
      const taskSheet = dataSpreadsheet.getSheetByName(taskSheetName);
      const taskArchiveSheet = dataSpreadsheet.getSheetByName(taskArchiveSheetName);

      if (!taskSheet || !taskArchiveSheet) {
        logger.warn('HousekeepingService', 'archiveCompletedTasks', "SysTasks or SysTasks_Archive sheet not found. Skipping task archiving.");
        return false;
      }

      // Get schema-defined headers
      const taskSchema = allConfig['schema.data.SysTasks'];
      if (!taskSchema || !taskSchema.headers) {
        logger.error('HousekeepingService', 'archiveCompletedTasks', "SysTasks schema not found in configuration.");
        return false;
      }
      const headers = taskSchema.headers.split(',');
      const statusCol = headers.indexOf('st_Status');
      const createdDateCol = headers.indexOf('st_CreatedDate');

      if (statusCol === -1 || createdDateCol === -1) {
        logger.error('HousekeepingService', 'archiveCompletedTasks', `Required columns not found in schema. st_Status: ${statusCol}, st_CreatedDate: ${createdDateCol}`);
        return false;
      }

      const taskRetentionDays = parseInt(allConfig['system.housekeeping']?.task_retention_days || OLD_DATA_THRESHOLD_DAYS);
      const thresholdDate = _getThresholdDate(taskRetentionDays);

      const filterTasks = (row) => {
        const status = row[statusCol];
        const createdDate = new Date(row[createdDateCol]);
        return (status === 'Completed' || status === 'Cancelled') && createdDate < thresholdDate;
      };

      movedCount = _moveRowsToArchive(taskSheet, taskArchiveSheet, filterTasks);
      logger.info('HousekeepingService', 'archiveCompletedTasks', `Archived ${movedCount} completed or cancelled tasks from SysTasks.`);
      return true;
    } catch (e) {
      logger.error('HousekeepingService', 'archiveCompletedTasks', `Error during completed task archiving: ${e.message}`, e);
      return false;
    }
  };

  /**
   * Manages the lifecycle of files in Google Drive:
   * 1. Source files are exempt (kept for manual re-processing).
   * 2. Trashes old files from the dedicated Archive folder.
   * 3. Moves old export files to a separate '_Old_Exports' folder and then trashes very old files from there.
   */
  this.manageFileLifecycle = function() {
    logger.info('HousekeepingService', 'manageFileLifecycle', "Starting file lifecycle management.");
    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', 'manageFileLifecycle', "Configuration not available. Run rebuildSysConfigFromSource.");
        return false;
      }

      // 1. SOURCE FILES ARE EXEMPT FROM HOUSEKEEPING
      // Source files in import folders should be kept for manual re-processing
      // Only archived copies and exports are subject to lifecycle management
      logger.info('HousekeepingService', 'manageFileLifecycle', 'Source import files are exempt from housekeeping. Skipping source file cleanup.');

      // 2. Trashing old files from the dedicated Archive folder
      const archiveFolderId = allConfig['system.folder.archive']?.id;
      if (archiveFolderId) {
        const archiveFolder = DriveApp.getFolderById(archiveFolderId);
        const archiveFiles = archiveFolder.getFiles();
        const archiveThresholdDate = _getThresholdDate(ARCHIVE_FOLDER_RETENTION_DAYS);
        let trashedArchiveFiles = 0;
        while (archiveFiles.hasNext()) {
          const file = archiveFiles.next();
          if (file.getLastUpdated() < archiveThresholdDate) {
            file.setTrashed(true);
            trashedArchiveFiles++;
          }
        }
        if (trashedArchiveFiles > 0) {
          logger.info('HousekeepingService', 'manageFileLifecycle', `Trashed ${trashedArchiveFiles} old files from Archive folder.`);
        }
      } else {
        logger.warn('HousekeepingService', 'manageFileLifecycle', "System setting 'system.folder.archive' not found. Skipping archive folder cleanup.");
      }

      // 3. Managing Export files (move to old_exports, then trash from old_exports)
      const exportsFolderId = allConfig['system.folder.jlmops_exports']?.id;

      if (exportsFolderId) {
        const exportsFolder = DriveApp.getFolderById(exportsFolderId);
        
        // Self-manage _Old_Exports subfolder
        const oldExportsFolderName = '_Old_Exports';
        let oldExportsFolder;
        const folders = exportsFolder.getFoldersByName(oldExportsFolderName);
        if (folders.hasNext()) {
            oldExportsFolder = folders.next();
        } else {
            oldExportsFolder = exportsFolder.createFolder(oldExportsFolderName);
        }

        const exportMoveThresholdDate = _getThresholdDate(EXPORT_RETENTION_DAYS);
        const oldExportTrashThresholdDate = _getThresholdDate(OLD_EXPORTS_RETENTION_DAYS);

        let movedExportFiles = 0;
        let trashedOldExportFiles = 0;

        // Move files from the main exports folder to the old_exports folder if they are older than EXPORT_RETENTION_DAYS
        const currentExportFiles = exportsFolder.getFiles();
        while (currentExportFiles.hasNext()) {
          const file = currentExportFiles.next();
          // Avoid moving the _Old_Exports folder itself (though getFiles shouldn't pick it up)
          // and verify it's not a folder
          if (file.getLastUpdated() < exportMoveThresholdDate) {
            file.moveTo(oldExportsFolder);
            movedExportFiles++;
          }
        }
        if (movedExportFiles > 0) {
          logger.info('HousekeepingService', 'manageFileLifecycle', `Moved ${movedExportFiles} files from Exports to _Old_Exports folder.`);
        }

        // Trash files from the old_exports folder if they are older than OLD_EXPORTS_RETENTION_DAYS
        const oldExportedFiles = oldExportsFolder.getFiles();
        while (oldExportedFiles.hasNext()) {
          const file = oldExportedFiles.next();
          if (file.getLastUpdated() < oldExportTrashThresholdDate) {
            file.setTrashed(true);
            trashedOldExportFiles++;
          }
        }
        if (trashedOldExportFiles > 0) {
          logger.info('HousekeepingService', 'manageFileLifecycle', `Trashed ${trashedOldExportFiles} very old files from _Old_Exports folder.`);
        }

      } else {
        logger.warn('HousekeepingService', 'manageFileLifecycle', "System setting 'system.folder.jlmops_exports' not found. Skipping export folder management.");
      }
      return true;
    } catch (e) {
      logger.error('HousekeepingService', 'manageFileLifecycle', `Error during file lifecycle management: ${e.message}`, e);
      return false;
    }
  };

  /**
   * Cleans up timestamped import files from the import folder.
   * Files matching patterns like 'product_export_*.csv' and 'he_product_export*.csv'
   * older than IMPORT_FILE_RETENTION_DAYS are moved to archive.
   * Legacy files (ComaxProducts.csv, WebOrders.csv, wehe.csv) are retained.
   */
  this.cleanupImportFiles = function() {
    const functionName = 'cleanupImportFiles';
    logger.info('HousekeepingService', functionName, "Starting cleanup of old timestamped import files.");

    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', functionName, "Configuration not available. Run rebuildSysConfigFromSource.");
        return false;
      }

      const importFolderId = allConfig['import.drive.web_products_en']?.source_folder_id;
      if (!importFolderId) {
        logger.warn('HousekeepingService', functionName, "Import folder ID not found in configuration. Skipping import file cleanup.");
        return false;
      }

      const archiveFolderId = allConfig['system.folder.archive']?.id;
      if (!archiveFolderId) {
        logger.warn('HousekeepingService', functionName, "Archive folder ID not found. Skipping import file cleanup.");
        return false;
      }

      const importFolder = DriveApp.getFolderById(importFolderId);
      const archiveFolder = DriveApp.getFolderById(archiveFolderId);
      const thresholdDate = _getThresholdDate(IMPORT_FILE_RETENTION_DAYS);

      // Patterns for timestamped files that should be cleaned up
      const cleanupPatterns = [
        /^product_export_.*\.csv$/i,      // product_export_2025-12-10-06-21-01.csv
        /^he_product_export.*\.csv$/i     // he_product_export_2025-12-10-06-21-01.csv
      ];

      // Files to always keep (legacy format)
      const keepFiles = [
        'comaxproducts.csv',
        'weborders.csv',
        'wehe.csv'
      ];

      const files = importFolder.getFiles();
      let movedCount = 0;

      while (files.hasNext()) {
        const file = files.next();
        const fileName = file.getName();
        const fileNameLower = fileName.toLowerCase();

        // Skip files that should always be kept
        if (keepFiles.includes(fileNameLower)) {
          continue;
        }

        // Check if file matches cleanup patterns and is old enough
        const matchesPattern = cleanupPatterns.some(pattern => pattern.test(fileName));
        const isOldEnough = file.getLastUpdated() < thresholdDate;

        if (matchesPattern && isOldEnough) {
          file.moveTo(archiveFolder);
          movedCount++;
          logger.info('HousekeepingService', functionName, `Moved old import file to archive: ${fileName}`);
        }
      }

      logger.info('HousekeepingService', functionName, `Cleaned up ${movedCount} old import files.`);
      return true;
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Error during import file cleanup: ${e.message}`, e);
      return false;
    }
  };

  /**
   * Backfills activity records from order history and subscriptions.
   * Runs ActivityBackfillService.runFullBackfill() to ensure activities are current.
   * This is idempotent - existing activities are skipped.
   */
  this.backfillActivities = function() {
    const functionName = 'backfillActivities';
    logger.info('HousekeepingService', functionName, 'Starting activity backfill');

    try {
      const result = ActivityBackfillService.runFullBackfill();

      if (result.totalCreated > 0) {
        logger.info('HousekeepingService', functionName,
          `Activity backfill complete: ${result.totalCreated} created, ${result.totalSkipped} skipped`);
      } else {
        logger.info('HousekeepingService', functionName, 'Activity backfill complete: no new activities');
      }

      if (result.totalErrors > 0) {
        logger.warn('HousekeepingService', functionName, `Activity backfill had ${result.totalErrors} errors`);
      }

      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Activity backfill failed: ${e.message}`);
      return false;
    }
  };

  /**
   * Runs CRM intelligence analysis to detect campaign opportunities.
   * Creates suggestion tasks when thresholds are met (cooling customers, unconverted subscribers, etc.).
   */
  this.runCrmIntelligence = function() {
    const functionName = 'runCrmIntelligence';
    logger.info('HousekeepingService', functionName, 'Starting CRM intelligence analysis');

    try {
      if (typeof CrmIntelligenceService === 'undefined' || !CrmIntelligenceService.runAnalysis) {
        logger.info('HousekeepingService', functionName, 'CrmIntelligenceService not available. Skipping intelligence analysis.');
        return true;
      }

      const result = CrmIntelligenceService.runAnalysis();

      if (result.tasksCreated > 0) {
        logger.info('HousekeepingService', functionName,
          `CRM intelligence: ${result.suggestions.length} insights, ${result.tasksCreated} tasks created`);
      } else if (result.suggestions.length > 0) {
        logger.info('HousekeepingService', functionName,
          `CRM intelligence: ${result.suggestions.length} insights (tasks already exist)`);
      } else {
        logger.info('HousekeepingService', functionName, 'CRM intelligence: no campaign opportunities detected');
      }

      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `CRM intelligence failed: ${e.message}`);
      return false;
    }
  };
}

// Global instance for easy access throughout the project
const housekeepingService = new HousekeepingService();