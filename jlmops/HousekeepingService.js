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
 * A global function to manually trigger order archiving.
 * Archives completed orders older than 1 year to WebOrdM_Archive.
 */
function runOrderArchiving() {
    housekeepingService.archiveCompletedOrders();
}

/**
 * A global function to manually trigger data sheet formatting.
 * Applies standard formatting (top align, wrapped text, 21px rows) to all data sheets.
 */
function runFormatDataSheets() {
    housekeepingService.formatDataSheets();
}

/**
 * Backfill order totals by calculating from order items.
 * This ensures wom_OrderTotal and woma_OrderTotal are always accurate.
 * Run after initial setup or if totals are missing/incorrect.
 */
function backfillOrderTotals() {
  const fnName = 'backfillOrderTotals';
  const allConfig = ConfigService.getAllConfig();
  const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
  const ss = SpreadsheetApp.openById(dataSpreadsheetId);

  // Build order totals from order items (authoritative source)
  const totalsByOrderId = {};

  // Sum from WebOrdItemsM
  const itemsSheet = ss.getSheetByName(allConfig['system.sheet_names'].WebOrdItemsM);
  if (itemsSheet && itemsSheet.getLastRow() > 1) {
    const itemsData = itemsSheet.getDataRange().getValues();
    const itemHeaders = itemsData[0];
    const orderIdIdx = itemHeaders.indexOf('woi_OrderId');
    const itemTotalIdx = itemHeaders.indexOf('woi_ItemTotal');

    for (let i = 1; i < itemsData.length; i++) {
      const orderId = String(itemsData[i][orderIdIdx] || '').trim();
      const itemTotal = parseFloat(itemsData[i][itemTotalIdx]) || 0;
      if (orderId) {
        totalsByOrderId[orderId] = (totalsByOrderId[orderId] || 0) + itemTotal;
      }
    }
    console.log(`Summed items from WebOrdItemsM: ${Object.keys(totalsByOrderId).length} orders`);
  }

  // Sum from WebOrdItemsM_Archive (only for orders NOT already in master)
  const itemsArchiveSheet = ss.getSheetByName('WebOrdItemsM_Archive');
  if (itemsArchiveSheet && itemsArchiveSheet.getLastRow() > 1) {
    const archiveData = itemsArchiveSheet.getDataRange().getValues();
    const archiveHeaders = archiveData[0];
    const orderIdIdx = archiveHeaders.indexOf('woia_OrderId');
    const itemTotalIdx = archiveHeaders.indexOf('woia_ItemTotal');

    // Track which orders are archive-only
    const archiveOnlyOrders = new Set();
    for (let i = 1; i < archiveData.length; i++) {
      const orderId = String(archiveData[i][orderIdIdx] || '').trim();
      if (orderId && !totalsByOrderId[orderId]) {
        archiveOnlyOrders.add(orderId);
      }
    }

    // Only sum items for archive-only orders
    for (let i = 1; i < archiveData.length; i++) {
      const orderId = String(archiveData[i][orderIdIdx] || '').trim();
      const itemTotal = parseFloat(archiveData[i][itemTotalIdx]) || 0;
      if (orderId && archiveOnlyOrders.has(orderId)) {
        totalsByOrderId[orderId] = (totalsByOrderId[orderId] || 0) + itemTotal;
      }
    }
    console.log(`Added ${archiveOnlyOrders.size} orders from WebOrdItemsM_Archive`);
  }

  console.log(`Total orders with calculated totals: ${Object.keys(totalsByOrderId).length}`);

  // Round all totals to whole numbers
  Object.keys(totalsByOrderId).forEach(orderId => {
    totalsByOrderId[orderId] = Math.round(totalsByOrderId[orderId]);
  });

  // Update WebOrdM
  const masterSheet = ss.getSheetByName(allConfig['system.sheet_names'].WebOrdM);
  if (masterSheet && masterSheet.getLastRow() > 1) {
    const masterData = masterSheet.getDataRange().getValues();
    const masterHeaders = masterData[0];
    const momOrderIdIdx = masterHeaders.indexOf('wom_OrderId');
    const momTotalIdx = masterHeaders.indexOf('wom_OrderTotal');

    if (momTotalIdx === -1) {
      console.log('wom_OrderTotal column not found in WebOrdM');
    } else {
      let updated = 0;
      for (let i = 1; i < masterData.length; i++) {
        const orderId = String(masterData[i][momOrderIdIdx] || '').trim();
        const existingTotal = Math.round(parseFloat(masterData[i][momTotalIdx]) || 0);
        const calculatedTotal = totalsByOrderId[orderId] || 0;

        // Update if different (fixes empty AND incorrect values)
        if (orderId && calculatedTotal !== existingTotal) {
          masterSheet.getRange(i + 1, momTotalIdx + 1).setValue(calculatedTotal);
          updated++;
        }
      }
      console.log(`Updated ${updated} order totals in WebOrdM`);
    }
  }

  // Also update Archive
  const archiveSheet = ss.getSheetByName('WebOrdM_Archive');
  if (archiveSheet && archiveSheet.getLastRow() > 1) {
    const archiveData = archiveSheet.getDataRange().getValues();
    const archiveHeaders = archiveData[0];
    const archiveOrderIdIdx = archiveHeaders.indexOf('woma_OrderId');
    const archiveTotalIdx = archiveHeaders.indexOf('woma_OrderTotal');

    if (archiveTotalIdx === -1) {
      console.log('woma_OrderTotal column not found in WebOrdM_Archive');
    } else {
      let archiveUpdated = 0;
      for (let i = 1; i < archiveData.length; i++) {
        const orderId = String(archiveData[i][archiveOrderIdIdx] || '').trim();
        const existingTotal = Math.round(parseFloat(archiveData[i][archiveTotalIdx]) || 0);
        const calculatedTotal = totalsByOrderId[orderId] || 0;

        // Update if different (fixes empty AND incorrect values)
        if (orderId && calculatedTotal !== existingTotal) {
          archiveSheet.getRange(i + 1, archiveTotalIdx + 1).setValue(calculatedTotal);
          archiveUpdated++;
        }
      }
      console.log(`Updated ${archiveUpdated} order totals in WebOrdM_Archive`);
    }
  }
}

/**
 * Backfills order totals in WebOrdM_Archive from CSV file.
 * @param {string} fileName - CSV filename (default: order_history_2025-12-16.csv)
 */
function backfillArchiveOrderTotalsFromCsv(fileName) {
  fileName = fileName || 'order_history_2025-12-16.csv';

  // Find the CSV file
  const files = DriveApp.getFilesByName(fileName);
  if (!files.hasNext()) {
    console.log('File not found: ' + fileName);
    return;
  }
  const file = files.next();
  const csvContent = file.getBlob().getDataAsString();

  // Parse CSV and build OrderId -> OrderTotal lookup
  const rows = Utilities.parseCsv(csvContent);
  const headers = rows[0];
  const orderIdIdx = headers.indexOf('order_id');
  const orderTotalIdx = headers.indexOf('order_total');

  if (orderIdIdx === -1 || orderTotalIdx === -1) {
    console.log('CSV missing order_id or order_total columns');
    return;
  }

  const totalsByOrderId = {};
  for (let i = 1; i < rows.length; i++) {
    const orderId = String(rows[i][orderIdIdx]).trim();
    const total = parseFloat(rows[i][orderTotalIdx]) || 0;
    if (orderId) {
      totalsByOrderId[orderId] = total;
    }
  }
  console.log(`Loaded ${Object.keys(totalsByOrderId).length} order totals from CSV`);

  // Get archive sheet
  const allConfig = ConfigService.getAllConfig();
  const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
  const ss = SpreadsheetApp.openById(dataSpreadsheetId);
  const archiveSheet = ss.getSheetByName('WebOrdM_Archive');

  if (!archiveSheet) {
    console.log('WebOrdM_Archive not found');
    return;
  }

  const archiveData = archiveSheet.getDataRange().getValues();
  const archiveHeaders = archiveData[0];
  const archiveOrderIdIdx = archiveHeaders.indexOf('woma_OrderId');
  const archiveTotalIdx = archiveHeaders.indexOf('woma_OrderTotal');

  if (archiveTotalIdx === -1) {
    console.log('woma_OrderTotal column not found in archive');
    return;
  }

  let updated = 0;
  for (let i = 1; i < archiveData.length; i++) {
    const orderId = String(archiveData[i][archiveOrderIdIdx]).trim();
    const existingTotal = archiveData[i][archiveTotalIdx];

    if (orderId && totalsByOrderId[orderId] !== undefined && !existingTotal) {
      archiveSheet.getRange(i + 1, archiveTotalIdx + 1).setValue(totalsByOrderId[orderId]);
      updated++;
    }
  }

  console.log(`Backfilled ${updated} order totals in WebOrdM_Archive`);
}

/**
 * Calculate and store spend for all contacts.
 * @param {number} year - Optional calendar year (e.g., 2024). If omitted, uses rolling 12 months.
 */
function updateContactSpend12Month(year) {
  const fnName = 'updateContactSpend12Month';
  const allConfig = ConfigService.getAllConfig();
  const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
  const ss = SpreadsheetApp.openById(dataSpreadsheetId);

  // Date range: calendar year or rolling 12 months
  let startDate, endDate;
  if (year) {
    startDate = new Date(year, 0, 1);  // Jan 1 of year
    endDate = new Date(year, 11, 31, 23, 59, 59);  // Dec 31 of year
    console.log(`Calculating spend for calendar year ${year}`);
  } else {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    endDate = new Date();
    console.log(`Calculating spend since ${startDate.toISOString().split('T')[0]}`);
  }

  const spendByEmail = {};

  // Helper to process order sheet
  function processOrderSheet(sheet, dateCol, emailCol, totalCol, statusCol, orderIdCol, processedOrderIds) {
    if (!sheet || sheet.getLastRow() < 2) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dateIdx = headers.indexOf(dateCol);
    const emailIdx = headers.indexOf(emailCol);
    const totalIdx = headers.indexOf(totalCol);
    const statusIdx = headers.indexOf(statusCol);
    const orderIdIdx = headers.indexOf(orderIdCol);

    if (dateIdx === -1 || emailIdx === -1 || totalIdx === -1 || orderIdIdx === -1) {
      console.log(`Missing columns in ${sheet.getName()}: date=${dateIdx}, email=${emailIdx}, total=${totalIdx}, orderId=${orderIdIdx}`);
      return;
    }

    let counted = 0;
    let skipped = 0;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const orderId = String(row[orderIdIdx] || '').trim();
      const orderDate = row[dateIdx];
      const email = (row[emailIdx] || '').toLowerCase().trim();
      const total = parseFloat(row[totalIdx]) || 0;
      const status = statusIdx >= 0 ? (row[statusIdx] || '').toLowerCase() : 'completed';

      // Skip if already processed (prevents double-counting across sheets)
      if (orderId && processedOrderIds.has(orderId)) {
        skipped++;
        continue;
      }

      // Skip non-completed orders
      if (status !== 'completed' && status !== 'processing') continue;

      // Check date is within range
      if (!orderDate) continue;
      const date = orderDate instanceof Date ? orderDate : new Date(orderDate);
      if (isNaN(date.getTime()) || date < startDate || date > endDate) continue;

      // Mark as processed and sum spend
      if (orderId) processedOrderIds.add(orderId);
      if (email && total > 0) {
        spendByEmail[email] = (spendByEmail[email] || 0) + total;
        counted++;
      }
    }
    console.log(`${sheet.getName()}: ${counted} orders counted, ${skipped} duplicates skipped`);
  }

  // Track order IDs to prevent double-counting
  const processedOrderIds = new Set();

  // Process WebOrdM
  const masterSheet = ss.getSheetByName(allConfig['system.sheet_names'].WebOrdM);
  processOrderSheet(masterSheet, 'wom_OrderDate', 'wom_BillingEmail', 'wom_OrderTotal', 'wom_Status', 'wom_OrderId', processedOrderIds);

  // Process WebOrdM_Archive (only orders not in master)
  const archiveSheet = ss.getSheetByName('WebOrdM_Archive');
  processOrderSheet(archiveSheet, 'woma_OrderDate', 'woma_BillingEmail', 'woma_OrderTotal', 'woma_Status', 'woma_OrderId', processedOrderIds);

  console.log(`Total: ${Object.keys(spendByEmail).length} emails with spend`);

  // Update SysContacts
  const contactsSheet = ss.getSheetByName(allConfig['system.sheet_names'].SysContacts);
  if (!contactsSheet) {
    console.log('SysContacts not found');
    return;
  }

  const contactData = contactsSheet.getDataRange().getValues();
  const contactHeaders = contactData[0];
  const emailIdx = contactHeaders.indexOf('sc_Email');
  const spend12Idx = contactHeaders.indexOf('sc_Spend12Month');
  const tierIdx = contactHeaders.indexOf('sc_Tier');

  if (spend12Idx === -1) {
    console.log('sc_Spend12Month column not found - add column to sheet first');
    return;
  }
  if (tierIdx === -1) {
    console.log('sc_Tier column not found - add column to sheet first');
    return;
  }

  // Helper to calculate tier from spend (matches CampaignService._assignRewardTier)
  function getTier(spend) {
    if (spend >= 4000) return 'fgr03';
    if (spend >= 2000) return 'fgr02';
    if (spend >= 1000) return 'fgr01';
    return '';
  }

  let updatedSpend = 0;
  let updatedTier = 0;
  for (let i = 1; i < contactData.length; i++) {
    const email = (contactData[i][emailIdx] || '').toLowerCase().trim();
    const spend = Math.round(spendByEmail[email] || 0);
    const currentSpend = Math.round(parseFloat(contactData[i][spend12Idx]) || 0);
    const tier = getTier(spend);
    const currentTier = contactData[i][tierIdx] || '';

    // Update spend if different
    if (spend !== currentSpend) {
      contactsSheet.getRange(i + 1, spend12Idx + 1).setValue(spend);
      updatedSpend++;
    }

    // Update tier if different
    if (tier !== currentTier) {
      contactsSheet.getRange(i + 1, tierIdx + 1).setValue(tier);
      updatedTier++;
    }
  }

  console.log(`Updated ${updatedSpend} contacts with 12-month spend, ${updatedTier} with tier`);
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

    // === DATA SAFETY: Atomic-like archive operation ===
    // Step 1: Record archive state before write
    const archiveRowsBefore = archiveSheet.getLastRow();

    // Step 2: Append to archive sheet
    const archiveStartRow = archiveRowsBefore + 1;
    archiveSheet.getRange(archiveStartRow, 1, truncatedRows.length, truncatedRows[0].length)
                 .setValues(truncatedRows);

    // Step 3: Flush and verify archive write succeeded
    SpreadsheetApp.flush();
    const archiveRowsAfter = archiveSheet.getLastRow();
    const expectedArchiveRows = archiveRowsBefore + truncatedRows.length;

    if (archiveRowsAfter < expectedArchiveRows) {
      // Archive write failed or incomplete - DO NOT modify source
      throw new Error(`Archive write verification failed: expected ${expectedArchiveRows} rows, found ${archiveRowsAfter}. Source data preserved.`);
    }

    // Step 4: Only now safe to modify source - archive has the data
    sourceSheet.clearContents();
    if (rowsToKeep.length > 0) {
      sourceSheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }
    SpreadsheetApp.flush();

    return rowsToArchive.length;
  }

  /**
   * Applies standard formatting to a data sheet: top-align cells, single row height, and wrapped text.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to format.
   * @param {number} dataRowCount - Number of data rows (excluding header). If 0, uses sheet's last row.
   */
  function _applySheetFormatting(sheet, dataRowCount, schemaHeaders) {
    const sheetName = sheet.getName();

    // Restore headers from schema if provided
    if (schemaHeaders && schemaHeaders.length > 0) {
      const headerRange = sheet.getRange(1, 1, 1, schemaHeaders.length);
      headerRange.setValues([schemaHeaders]);
      headerRange.setFontWeight('bold');
      headerRange.setVerticalAlignment('middle');
      console.log(`${sheetName}: Restored ${schemaHeaders.length} headers from schema`);
    }
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
    this.archiveCompletedOrders();
    this.purgeOldJobs();
    this.manageFileLifecycle();
    this.cleanupImportFiles();
    this.formatDataSheets();

    // Phase 2: Validation & Testing
    let validationResult = null;
    let testResult = null;
    let schemaResult = null;

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

    try {
      schemaResult = ValidationLogic.validateDatabaseSchema('housekeeping_' + Date.now());
      const criticalCount = schemaResult.discrepancies.filter(d => d.severity === 'CRITICAL').length;
      logger.info('HousekeepingService', functionName,
        `Schema validation: ${schemaResult.status}, ${criticalCount} critical issues`);
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Schema validation failed: ${e.message}`);
    }

    // Phase 3: Service Data Updates (wrapped to track failures)
    const phase3Failures = [];
    const phase3Tasks = [
      { name: 'checkBundleHealth', fn: () => this.checkBundleHealth() },
      { name: 'checkBruryaReminder', fn: () => this.checkBruryaReminder() },
      { name: 'checkSubscribersReminder', fn: () => this.checkSubscribersReminder() },
      { name: 'checkCampaignsReminder', fn: () => this.checkCampaignsReminder() },
      { name: 'checkCouponsReminder', fn: () => this.checkCouponsReminder() },
      { name: 'refreshCrmContacts', fn: () => this.refreshCrmContacts() },
      { name: 'maintainCityLookup', fn: () => this.maintainCityLookup() },
      { name: 'backfillActivities', fn: () => this.backfillActivities() },
      { name: 'runCrmIntelligence', fn: () => this.runCrmIntelligence() }
    ];

    for (const task of phase3Tasks) {
      try {
        task.fn();
      } catch (e) {
        phase3Failures.push(task.name);
        logger.error('HousekeepingService', functionName, `${task.name} failed: ${e.message}`);
      }
    }

    // Update system health singleton task (AFTER all phases complete)
    try {
      const phase2Passed = validationResult && testResult && schemaResult;
      const phase3Passed = phase3Failures.length === 0;
      const allPassed = phase2Passed && phase3Passed;
      const criticalSchemaIssues = schemaResult
        ? schemaResult.discrepancies.filter(d => d.severity === 'CRITICAL').length
        : -1;

      let status = 'success';
      if (!allPassed) {
        status = phase3Failures.length > 0 ? 'failed' : 'partial';
      }

      TaskService.upsertSingletonTask(
        'task.system.health_status',
        '_SYSTEM',
        'System Health',
        'System Health Status',
        {
          updated: new Date().toISOString(),
          last_housekeeping: {
            timestamp: new Date().toISOString(),
            status: status,
            unit_tests: testResult ? `${testResult.passed}/${testResult.total}` : 'error',
            validation_issues: validationResult ? validationResult.failureCount : -1,
            schema_status: schemaResult ? schemaResult.status : 'error',
            schema_critical: criticalSchemaIssues,
            phase3_failures: phase3Failures.length > 0 ? phase3Failures : null
          }
        }
      );
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Could not update health task: ${e.message}`);
    }

    logger.info('HousekeepingService', functionName,
      phase3Failures.length > 0
        ? `Daily maintenance completed with failures: ${phase3Failures.join(', ')}`
        : "Daily maintenance completed.");
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
        TaskService.updateTaskNotes(existingTask.id, notesJson);
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
        TaskService.updateTaskNotes(existingTask.id, notesJson);
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
        TaskService.updateTaskNotes(existingTask.id, notesJson);
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
        TaskService.updateTaskNotes(existingTask.id, notesJson);
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

    try {
      // Check if ContactService exists (CRM may not be fully deployed yet)
      if (typeof ContactService === 'undefined' || !ContactService.refreshAllContacts) {
        logger.info('HousekeepingService', functionName, 'ContactService not available yet. Skipping.');
        return true;
      }

      // Skip if no sync completed since last CRM refresh
      const lastRefreshConfig = ConfigService.getConfig('system.crm.last_refresh');
      const lastRefresh = lastRefreshConfig?.value ? new Date(lastRefreshConfig.value) : null;

      const syncSession = SyncStateService.getActiveSession();
      const lastSync = syncSession?.lastUpdated ? new Date(syncSession.lastUpdated) : null;

      if (lastRefresh && lastSync && syncSession.currentStage === 'COMPLETE') {
        if (lastSync <= lastRefresh) {
          logger.info('HousekeepingService', functionName, 'No sync since last refresh, skipping CRM contacts');
          return true;
        }
      }

      logger.info('HousekeepingService', functionName, "Starting CRM contact refresh.");

      // Import/update contacts from orders (creates new contacts, updates existing)
      if (typeof ContactImportService !== 'undefined' && ContactImportService.updateContactsFromOrders) {
        const importResult = ContactImportService.updateContactsFromOrders();
        logger.info('HousekeepingService', functionName,
          `Contact import: ${importResult.created} created, ${importResult.updated} updated`);
      }

      ContactService.refreshAllContacts();
      logger.info('HousekeepingService', functionName, "CRM contact refresh completed.");

      // Enrich contact preferences from order history
      if (typeof ContactEnrichmentService !== 'undefined' && ContactEnrichmentService.enrichAllContacts) {
        const enrichResult = ContactEnrichmentService.enrichAllContacts();
        logger.info('HousekeepingService', functionName, `CRM enrichment: ${enrichResult.enriched} enriched, ${enrichResult.skipped} skipped`);
      }

      // Update 12-month spend and tier for all contacts
      updateContactSpend12Month();

      // Update last refresh timestamp
      ConfigService.setConfig('system.crm.last_refresh', new Date().toISOString());

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

    try {
      // Skip if no sync completed since last bundle health check
      const lastCheckConfig = ConfigService.getConfig('system.bundle_health.last_check');
      const lastCheck = lastCheckConfig?.value ? new Date(lastCheckConfig.value) : null;

      const syncSession = SyncStateService.getActiveSession();
      const lastSync = syncSession?.lastUpdated ? new Date(syncSession.lastUpdated) : null;

      if (lastCheck && lastSync && syncSession.currentStage === 'COMPLETE') {
        if (lastSync <= lastCheck) {
          logger.info('HousekeepingService', functionName, 'No sync since last check, skipping bundle health');
          return;
        }
      }

      logger.info('HousekeepingService', functionName, "Starting bundle health check.");

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

      // Update last check timestamp
      ConfigService.setConfig('system.bundle_health.last_check', new Date().toISOString());

      logger.info('HousekeepingService', functionName, `Bundle health check complete. Critical: ${criticalTasksCreated}, Low inventory: ${lowInventoryTasksCreated}`);
      return true;
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Error during bundle health check: ${e.message}`, e);
      return false;
    }
  };

  const ORDER_ARCHIVE_THRESHOLD_DAYS = 365; // 1 year

  /**
   * Archives completed orders older than ORDER_ARCHIVE_THRESHOLD_DAYS.
   * Moves data from:
   *   - WebOrdM → WebOrdM_Archive
   *   - WebOrdItemsM → WebOrdItemsM_Archive
   *   - SysOrdLog → OrderLogArchive
   * Also cleans SysPackingCache (removes entries for archived orders).
   * Uses data-safe pattern: verify archive write before modifying source.
   */
  this.archiveCompletedOrders = function() {
    const functionName = 'archiveCompletedOrders';
    logger.info('HousekeepingService', functionName, 'Starting archiving of old completed orders.');

    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', functionName, 'Configuration not available.');
        return false;
      }

      const dataSpreadsheet = SpreadsheetApp.openById(allConfig['system.spreadsheet.data'].id);
      const sheetNames = allConfig['system.sheet_names'];

      // Get all required sheets
      const orderSheet = dataSpreadsheet.getSheetByName(sheetNames.WebOrdM);
      const orderArchiveSheet = dataSpreadsheet.getSheetByName(sheetNames.WebOrdM_Archive);
      const itemsSheet = dataSpreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
      const itemsArchiveSheet = dataSpreadsheet.getSheetByName(sheetNames.WebOrdItemsM_Archive);
      const ordLogSheet = dataSpreadsheet.getSheetByName(sheetNames.SysOrdLog);
      const ordLogArchiveSheet = dataSpreadsheet.getSheetByName(sheetNames.OrderLogArchive);
      const packingCacheSheet = dataSpreadsheet.getSheetByName(sheetNames.SysPackingCache);

      if (!orderSheet || !orderArchiveSheet || !itemsSheet || !itemsArchiveSheet) {
        logger.warn('HousekeepingService', functionName, 'One or more order sheets not found. Skipping order archiving.');
        return false;
      }

      // Get schemas
      const orderSchema = allConfig['schema.data.WebOrdM'];
      const itemsSchema = allConfig['schema.data.WebOrdItemsM'];
      const ordLogSchema = allConfig['schema.data.SysOrdLog'];
      const ordLogArchiveSchema = allConfig['schema.data.OrderLogArchive'];
      if (!orderSchema?.headers || !itemsSchema?.headers) {
        logger.error('HousekeepingService', functionName, 'Order schemas not found in configuration.');
        return false;
      }

      const orderHeaders = orderSchema.headers.split(',');
      const itemsHeaders = itemsSchema.headers.split(',');
      const orderIdCol = orderHeaders.indexOf('wom_OrderId');
      const orderDateCol = orderHeaders.indexOf('wom_OrderDate');
      const orderStatusCol = orderHeaders.indexOf('wom_Status');
      const itemOrderIdCol = itemsHeaders.indexOf('woi_OrderId');

      if (orderIdCol === -1 || orderDateCol === -1 || orderStatusCol === -1 || itemOrderIdCol === -1) {
        logger.error('HousekeepingService', functionName, 'Required columns not found in schemas.');
        return false;
      }

      // Read all order data
      const orderData = orderSheet.getDataRange().getValues();
      if (orderData.length <= 1) {
        logger.info('HousekeepingService', functionName, 'No orders to process.');
        return true;
      }

      const thresholdDate = _getThresholdDate(ORDER_ARCHIVE_THRESHOLD_DAYS);

      // Identify orders to archive
      const ordersToArchive = [];
      const ordersToKeep = [orderData[0]]; // Keep headers
      const orderIdsToArchive = new Set();

      for (let i = 1; i < orderData.length; i++) {
        const row = orderData[i];
        const orderId = String(row[orderIdCol]);
        const orderDate = new Date(row[orderDateCol]);
        const status = String(row[orderStatusCol]).toLowerCase();

        // Archive if: completed AND older than threshold
        if (status === 'completed' && orderDate < thresholdDate) {
          ordersToArchive.push(row);
          orderIdsToArchive.add(orderId);
        } else {
          ordersToKeep.push(row);
        }
      }

      if (ordersToArchive.length === 0) {
        logger.info('HousekeepingService', functionName, 'No orders eligible for archiving.');
        return true;
      }

      // Read all items data and separate by order ID
      const itemsData = itemsSheet.getDataRange().getValues();
      const itemsToArchive = [];
      const itemsToKeep = [itemsData[0]]; // Keep headers

      for (let i = 1; i < itemsData.length; i++) {
        const row = itemsData[i];
        const itemOrderId = String(row[itemOrderIdCol]);
        if (orderIdsToArchive.has(itemOrderId)) {
          itemsToArchive.push(row);
        } else {
          itemsToKeep.push(row);
        }
      }

      // Read SysOrdLog data and separate by order ID
      let ordLogToArchive = [];
      let ordLogToKeep = [];
      let ordLogArchiveRows = [];
      if (ordLogSheet && ordLogArchiveSheet && ordLogSchema?.headers && ordLogArchiveSchema?.headers) {
        const ordLogHeaders = ordLogSchema.headers.split(',');
        const ordLogArchiveHeaders = ordLogArchiveSchema.headers.split(',');
        const ordLogOrderIdCol = ordLogHeaders.indexOf('sol_OrderId');

        if (ordLogOrderIdCol !== -1) {
          const ordLogData = ordLogSheet.getDataRange().getValues();
          ordLogToKeep = [ordLogData[0]]; // Keep headers

          // Build column mapping from source to archive
          // Archive: sol_OrderId,sol_PackingStatus,sol_PackingPrintedTimestamp,sol_ComaxExportStatus,sol_ComaxExportTimestamp
          const archiveColMap = ordLogArchiveHeaders.map(h => ordLogHeaders.indexOf(h));

          for (let i = 1; i < ordLogData.length; i++) {
            const row = ordLogData[i];
            const orderId = String(row[ordLogOrderIdCol]);
            if (orderIdsToArchive.has(orderId)) {
              ordLogToArchive.push(row);
              // Map to archive format
              const archiveRow = archiveColMap.map(srcIdx => srcIdx >= 0 ? row[srcIdx] : '');
              ordLogArchiveRows.push(archiveRow);
            } else {
              ordLogToKeep.push(row);
            }
          }
        }
      }

      // Read SysPackingCache and filter out archived order entries
      let packingCacheToKeep = [];
      let packingCacheRemoved = 0;
      if (packingCacheSheet) {
        const packingSchema = allConfig['schema.data.SysPackingCache'];
        if (packingSchema?.headers) {
          const packingHeaders = packingSchema.headers.split(',');
          const packingOrderIdCol = packingHeaders.indexOf('spc_OrderId');

          if (packingOrderIdCol !== -1) {
            const packingData = packingCacheSheet.getDataRange().getValues();
            packingCacheToKeep = [packingData[0]]; // Keep headers

            for (let i = 1; i < packingData.length; i++) {
              const row = packingData[i];
              const orderId = String(row[packingOrderIdCol]);
              if (orderIdsToArchive.has(orderId)) {
                packingCacheRemoved++;
              } else {
                packingCacheToKeep.push(row);
              }
            }
          }
        }
      }

      // === DATA SAFETY: Archive orders first ===
      const orderArchiveRowsBefore = orderArchiveSheet.getLastRow();
      orderArchiveSheet.getRange(orderArchiveRowsBefore + 1, 1, ordersToArchive.length, ordersToArchive[0].length)
                       .setValues(ordersToArchive);
      SpreadsheetApp.flush();

      const orderArchiveRowsAfter = orderArchiveSheet.getLastRow();
      if (orderArchiveRowsAfter < orderArchiveRowsBefore + ordersToArchive.length) {
        throw new Error('Order archive write verification failed. Source data preserved.');
      }

      // === DATA SAFETY: Archive items ===
      if (itemsToArchive.length > 0) {
        const itemsArchiveRowsBefore = itemsArchiveSheet.getLastRow();
        itemsArchiveSheet.getRange(itemsArchiveRowsBefore + 1, 1, itemsToArchive.length, itemsToArchive[0].length)
                         .setValues(itemsToArchive);
        SpreadsheetApp.flush();

        const itemsArchiveRowsAfter = itemsArchiveSheet.getLastRow();
        if (itemsArchiveRowsAfter < itemsArchiveRowsBefore + itemsToArchive.length) {
          throw new Error('Items archive write verification failed. Source data preserved.');
        }
      }

      // === DATA SAFETY: Archive order log ===
      if (ordLogArchiveRows.length > 0 && ordLogArchiveSheet) {
        const ordLogArchiveRowsBefore = ordLogArchiveSheet.getLastRow();
        ordLogArchiveSheet.getRange(ordLogArchiveRowsBefore + 1, 1, ordLogArchiveRows.length, ordLogArchiveRows[0].length)
                          .setValues(ordLogArchiveRows);
        SpreadsheetApp.flush();

        const ordLogArchiveRowsAfter = ordLogArchiveSheet.getLastRow();
        if (ordLogArchiveRowsAfter < ordLogArchiveRowsBefore + ordLogArchiveRows.length) {
          throw new Error('Order log archive write verification failed. Source data preserved.');
        }
      }

      // === Only now safe to modify source sheets ===
      orderSheet.clearContents();
      orderSheet.getRange(1, 1, ordersToKeep.length, ordersToKeep[0].length).setValues(ordersToKeep);

      itemsSheet.clearContents();
      itemsSheet.getRange(1, 1, itemsToKeep.length, itemsToKeep[0].length).setValues(itemsToKeep);

      if (ordLogToKeep.length > 0 && ordLogSheet) {
        ordLogSheet.clearContents();
        ordLogSheet.getRange(1, 1, ordLogToKeep.length, ordLogToKeep[0].length).setValues(ordLogToKeep);
      }

      if (packingCacheToKeep.length > 0 && packingCacheSheet) {
        packingCacheSheet.clearContents();
        packingCacheSheet.getRange(1, 1, packingCacheToKeep.length, packingCacheToKeep[0].length).setValues(packingCacheToKeep);
      }

      SpreadsheetApp.flush();

      logger.info('HousekeepingService', functionName,
        `Archived ${ordersToArchive.length} orders, ${itemsToArchive.length} items, ${ordLogToArchive.length} order logs. Removed ${packingCacheRemoved} packing cache entries.`);
      return true;

    } catch (e) {
      logger.error('HousekeepingService', functionName, `Error during order archiving: ${e.message}`, e);
      return false;
    }
  };

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

  const JOB_QUEUE_RETENTION_DAYS = 30;

  /**
   * Purges old completed/failed jobs from SysJobQueue.
   * Removes jobs older than JOB_QUEUE_RETENTION_DAYS.
   */
  this.purgeOldJobs = function() {
    const functionName = 'purgeOldJobs';
    logger.info('HousekeepingService', functionName, 'Starting purge of old job queue entries.');

    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', functionName, 'Configuration not available.');
        return false;
      }

      const logsSpreadsheet = SpreadsheetApp.openById(allConfig['system.spreadsheet.logs'].id);
      const sheetNames = allConfig['system.sheet_names'];
      const jobQueueSheet = logsSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (!jobQueueSheet) {
        logger.warn('HousekeepingService', functionName, 'SysJobQueue sheet not found. Skipping job purge.');
        return false;
      }

      const jobSchema = allConfig['schema.log.SysJobQueue'];
      if (!jobSchema?.headers) {
        logger.error('HousekeepingService', functionName, 'SysJobQueue schema not found.');
        return false;
      }

      const headers = jobSchema.headers.split(',');
      const statusCol = headers.indexOf('status');
      const processedCol = headers.indexOf('processed_timestamp');

      if (statusCol === -1 || processedCol === -1) {
        logger.error('HousekeepingService', functionName, 'Required columns not found in SysJobQueue schema.');
        return false;
      }

      const jobData = jobQueueSheet.getDataRange().getValues();
      if (jobData.length <= 1) {
        logger.info('HousekeepingService', functionName, 'No jobs to process.');
        return true;
      }

      const thresholdDate = _getThresholdDate(JOB_QUEUE_RETENTION_DAYS);
      const jobsToKeep = [jobData[0]]; // Keep headers
      let purgedCount = 0;

      for (let i = 1; i < jobData.length; i++) {
        const row = jobData[i];
        const status = String(row[statusCol]).toLowerCase();
        const processedDate = row[processedCol] ? new Date(row[processedCol]) : null;

        // Purge if: (completed or failed) AND processed > threshold days ago
        const isTerminal = ['completed', 'failed'].includes(status);
        const isOld = processedDate && processedDate < thresholdDate;

        if (isTerminal && isOld) {
          purgedCount++;
        } else {
          jobsToKeep.push(row);
        }
      }

      if (purgedCount === 0) {
        logger.info('HousekeepingService', functionName, 'No old jobs to purge.');
        return true;
      }

      // Rewrite sheet with kept jobs only
      jobQueueSheet.clearContents();
      if (jobsToKeep.length > 0) {
        jobQueueSheet.getRange(1, 1, jobsToKeep.length, jobsToKeep[0].length).setValues(jobsToKeep);
      }
      SpreadsheetApp.flush();

      logger.info('HousekeepingService', functionName, `Purged ${purgedCount} old job queue entries.`);
      return true;

    } catch (e) {
      logger.error('HousekeepingService', functionName, `Error during job queue purge: ${e.message}`, e);
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
   * DISABLED: One-time migration completed. New activities are created through normal order/subscription flows.
   */
  this.backfillActivities = function() {
    // One-time backfill completed - no longer needed
    return true;
  };

  /**
   * Runs CRM intelligence analysis to detect campaign opportunities.
   * Creates suggestion tasks when thresholds are met (cooling customers, unconverted subscribers, etc.).
   */
  this.runCrmIntelligence = function() {
    const functionName = 'runCrmIntelligence';

    try {
      if (typeof CrmIntelligenceService === 'undefined' || !CrmIntelligenceService.runAnalysis) {
        logger.info('HousekeepingService', functionName, 'CrmIntelligenceService not available. Skipping.');
        return true;
      }

      // Skip if no contacts refreshed since last intelligence run
      const lastRunConfig = ConfigService.getConfig('system.crm_intelligence.last_run');
      const lastRun = lastRunConfig?.value ? new Date(lastRunConfig.value) : null;

      const lastRefreshConfig = ConfigService.getConfig('system.crm.last_refresh');
      const lastRefresh = lastRefreshConfig?.value ? new Date(lastRefreshConfig.value) : null;

      if (lastRun && lastRefresh && lastRefresh <= lastRun) {
        logger.info('HousekeepingService', functionName, 'No contact refresh since last run, skipping CRM intelligence');
        return true;
      }

      logger.info('HousekeepingService', functionName, 'Starting CRM intelligence analysis');

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

      // Update last run timestamp
      ConfigService.setConfig('system.crm_intelligence.last_run', new Date().toISOString());

      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `CRM intelligence failed: ${e.message}`);
      return false;
    }
  };

  /**
   * Applies standard formatting to all staging and master data sheets.
   * Sets: top alignment, wrapped text, 21px row height.
   * Targets: WebOrdM, WebOrdS, WebOrdItemsM, SysOrdLog, CmxProdM, CmxProdS, WebProdM, WebProdS_EN, WebXltM, WebXltS
   */
  this.formatDataSheets = function() {
    const functionName = 'formatDataSheets';
    logger.info('HousekeepingService', functionName, 'Starting data sheet formatting');

    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', functionName, 'Configuration not available.');
        return false;
      }

      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const sheetNames = allConfig['system.sheet_names'];

      // Sheets that need formatting
      const sheetsToFormat = [
        'WebOrdM', 'WebOrdS', 'WebOrdItemsM', 'SysOrdLog',
        'CmxProdM', 'CmxProdS', 'WebProdM', 'WebProdS_EN',
        'WebXltM', 'WebXltS', 'WebDetM', 'WebDetS'
      ];

      let formattedCount = 0;
      const formattedSheets = [];
      const skippedSheets = [];

      for (const sheetKey of sheetsToFormat) {
        const sheetName = sheetNames[sheetKey];
        if (!sheetName) {
          skippedSheets.push(`${sheetKey}: no config`);
          continue;
        }

        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
          skippedSheets.push(`${sheetKey}: sheet not found`);
          continue;
        }

        // Get schema headers for this sheet
        const schemaKey = `schema.data.${sheetKey}`;
        const schema = allConfig[schemaKey];
        let schemaHeaders = null;
        if (schema && schema.headers) {
          schemaHeaders = schema.headers.split(',').map(h => h.trim());
        }

        const rowCount = Math.max(0, sheet.getLastRow() - 1);
        try {
          _applySheetFormatting(sheet, rowCount, schemaHeaders);
          formattedSheets.push(sheetName);
          formattedCount++;
        } catch (formatError) {
          skippedSheets.push(`${sheetName}: ${formatError.message}`);
        }
      }

      logger.info('HousekeepingService', functionName, `Formatted ${formattedCount} sheets: ${formattedSheets.join(', ')}`);
      if (skippedSheets.length > 0) {
        logger.warn('HousekeepingService', functionName, `Skipped sheets: ${skippedSheets.join('; ')}`);
      }
      return true;
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Error formatting sheets: ${e.message}`, e);
      return false;
    }
  };
}

// Global instance for easy access throughout the project
const housekeepingService = new HousekeepingService();