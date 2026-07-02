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
 * Read-only preview of the pending-payment follow-up email. Composes the exact
 * subject + body (Doc-sourced via LibraryService.getEntityContent, same path as
 * the live send) with sample values for all four variants (EN/HE x first-time/
 * returning) and logs them. Sends nothing. Run from the Apps Script editor to
 * verify formatting — especially the first-time addendum block — before the live
 * sweep fires.
 */
function previewPendingPaymentEmail() {
    ['en', 'he'].forEach(function(lang) {
        [true, false].forEach(function(isFirstTime) {
            var emailContent = LibraryService.getEntityContent({ entityId: 'template-pending-payment-email-' + lang });
            Logger.log('===== ' + lang.toUpperCase() + (isFirstTime ? ' / first-time' : ' / returning') + ' =====');
            if (!emailContent) { Logger.log('MISSING email template for ' + lang); return; }
            var addendumContent = isFirstTime
                ? LibraryService.getEntityContent({ entityId: 'template-pending-payment-addendum-' + lang })
                : null;
            var firstTimeBlock = (addendumContent && addendumContent.body) ? ('\n\n' + addendumContent.body) : '';
            var body = String(emailContent.body || '')
                .replace(/\{name\}/g, 'Dani')
                .replace(/\{first_time_block\}/g, firstTimeBlock)
                .replace(/\{order_pay_url\}/g, 'https://www.jlmwines.com/checkout/order-pay/12345/?pay_for_order=true&key=SAMPLE');
            Logger.log('Subject: ' + (emailContent.subject || '(none)'));
            Logger.log('Source: email=' + emailContent.source + (addendumContent ? ', addendum=' + addendumContent.source : ''));
            Logger.log('Body:\n' + body);
        });
    });
    return 'Logged 4 variants (EN/HE x first-time/returning) — check the Executions log.';
}

/**
 * A global function intended for high-frequency triggers (e.g., every 20 minutes
 * during business hours). Runs only the maintenance tasks that need near-real-time
 * cadence — currently the pending-payment follow-up sweep. Other phase3 tasks
 * (Mailchimp pulls, CRM refresh, welcome trigger, bundle housekeeping, etc.) stay
 * in runDailyMaintenance because they are not time-sensitive at the same granularity.
 */
function runFrequentMaintenance() {
    housekeepingService.performFrequentMaintenance();
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
  const archiveSheet = SheetAccessor.getDataSheet('WebOrdM_Archive', false);

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
  const ss = SheetAccessor.getDataSpreadsheet();

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
  const PRINTME_RETENTION_DAYS = 7; // Days to keep packing slips before trashing
  const MIN_LOG_ROWS = 1000; // Keep this many recent log rows regardless of age
  const IMPORT_FILE_RETENTION_DAYS = 2; // Days to keep timestamped import files

  /**
   * Gets a threshold date for comparisons, normalized to midnight Israel time.
   * This prevents off-by-one errors when comparing dates created at different times of day.
   */
  function _getThresholdDate(daysAgo) {
    const tz = Session.getScriptTimeZone(); // Asia/Jerusalem
    const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    const todayMidnight = new Date(todayStr + 'T00:00:00');
    todayMidnight.setDate(todayMidnight.getDate() - daysAgo);
    return todayMidnight;
  }

  /**
   * Gets current date at midnight Israel time (for task creation dates).
   */
  function _getIsraelDate() {
    const tz = Session.getScriptTimeZone(); // Asia/Jerusalem
    const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    return new Date(todayStr + 'T00:00:00');
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
      // Build keyed config from getMasterConfiguration() (2D array from SetupConfig.js)
      const masterRows = getMasterConfiguration();
      const masterConfig = {};
      for (let i = 1; i < masterRows.length; i++) { // skip header
        const settingName = masterRows[i][0];
        if (!settingName || String(settingName).startsWith('_section.')) continue;
        const p01 = masterRows[i][3];
        if (!masterConfig[settingName]) masterConfig[settingName] = {};
        if (p01 !== null && p01 !== undefined && String(p01).trim() !== '') {
          masterConfig[settingName][String(p01).trim()] = masterRows[i][4];
        }
      }
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
        // system.users has special array handling in ConfigService — skip property-level check
        if (settingName === 'system.users') continue;
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

      const logsSpreadsheet = SheetAccessor.getLogSpreadsheet();
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
  /**
   * Frequent maintenance — pulls fresh orders from Woo and runs the housekeeping
   * sweeps that benefit from sub-hourly cadence. Intended for a single 20-min
   * trigger fired 24x7; a code-side cadence guard restricts productive work to
   * Israeli business hours: Sun-Thu 08:00–20:00, Fri 08:00–13:00, Sat off.
   * Fires outside that window return immediately. A sync-state guard skips when
   * the daily 12-state sync is mid-flight to avoid racing its writes to WebOrdM.
   * See `jlmops/plans/FREQUENT_PIPELINE_PLAN.md`.
   */
  this.performFrequentMaintenance = function() {
    const functionName = 'performFrequentMaintenance';
    logger.info('HousekeepingService', functionName, "Starting frequent maintenance.");

    // Sync-state guard: skip if the daily 12-state sync is mid-flight.
    const session = SyncStateService.getActiveSession();
    const stage = session && session.stage;
    if (stage && stage !== 'IDLE' && stage !== 'COMPLETE' && stage !== 'FAILED') {
      logger.info('HousekeepingService', functionName,
        `Daily sync in progress (${stage}). Skipping.`);
      return;
    }

    // Cadence guard: Israeli business hours. Apps Script trigger API can't
    // combine 20-min interval with day-of-week, so we gate in code.
    //   Sun-Thu: 08:00-20:00 IL (12 hours, ~36 productive fires/day)
    //   Fri:     08:00-13:00 IL (5 hours, ~15 productive fires/day)
    //   Sat:     off
    const dayName = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'EEE');
    const hour = parseInt(Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'H'), 10);
    const isSunThu = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].indexOf(dayName) >= 0;
    const isFri = dayName === 'Fri';
    const inWindow = (isSunThu && hour >= 8 && hour < 20) || (isFri && hour >= 8 && hour < 13);
    if (!inWindow) {
      logger.info('HousekeepingService', functionName,
        `Outside business window (${dayName} ${hour}h). Skipping.`);
      return;
    }

    // Order pull with forward cursor. The cursor (`crm.frequent_pipeline.last_modified_floor`)
    // advances to run-start ISO timestamp only after a successful pull, so a failed run
    // re-pulls the same window next time. First run (no cursor) falls back to pullOrders'
    // default 30-day window, then advances forward.
    const runStart = new Date().toISOString();
    let pullSucceeded = false;
    try {
      const cursorCfg = ConfigService.getConfig('crm.frequent_pipeline.last_modified_floor');
      const modifiedAfter = (cursorCfg && cursorCfg.value) ? cursorCfg.value : null;
      const result = WooOrderPullService.pullOrders(
        modifiedAfter ? { modifiedAfter: modifiedAfter } : undefined
      );
      pullSucceeded = !!(result && result.success);
    } catch (e) {
      logger.error('HousekeepingService', functionName, `pullOrders failed: ${e.message}`);
    }
    if (pullSucceeded) {
      ConfigService.setConfig('crm.frequent_pipeline.last_modified_floor', 'value', runStart);
    }

    const tasks = [
      { name: 'createWelcomeOutreachTasks', fn: () => this.createWelcomeOutreachTasks() },
      { name: 'createPendingPaymentFollowups', fn: () => this.createPendingPaymentFollowups() }
    ];

    for (const task of tasks) {
      try {
        task.fn();
      } catch (e) {
        logger.error('HousekeepingService', functionName, `${task.name} failed: ${e.message}`);
      }
    }

    // Refresh the flat-file status export (reliability audit 3.2). Never throws —
    // a reporting-surface failure must not affect frequent maintenance.
    try {
      StatusReportService.refreshLiveBlocks(Utilities.getUuid());
    } catch (e) {
      logger.error('HousekeepingService', functionName, `Status export refresh failed: ${e.message}`);
    }

    logger.info('HousekeepingService', functionName, "Frequent maintenance completed.");
  };

  this.performDailyMaintenance = function() {
    const functionName = 'performDailyMaintenance';
    logger.info('HousekeepingService', functionName, "Starting daily maintenance.");

    const sessionId = Utilities.getUuid(); // CCP-2: correlation id for this run

    // Sweep FAILED jobs BEFORE purgeOldJobs removes aged terminal rows (reliability audit 2.2).
    const phase1Failures = [];
    let failedJobsSummary = null;
    try {
      failedJobsSummary = this.checkFailedJobs(sessionId);
    } catch (e) {
      phase1Failures.push('checkFailedJobs');
      logger.error('HousekeepingService', functionName, `checkFailedJobs failed: ${e.message}`);
    }

    // Phase 1: Cleanup (wrapped to prevent single failure from stopping all tasks)
    const phase1Tasks = [
      { name: 'cleanOldLogs', fn: () => this.cleanOldLogs() },
      { name: 'archiveCompletedTasks', fn: () => this.archiveCompletedTasks() },
      { name: 'archiveCompletedOrders', fn: () => this.archiveCompletedOrders() },
      { name: 'purgeOldJobs', fn: () => this.purgeOldJobs() },
      { name: 'manageFileLifecycle', fn: () => this.manageFileLifecycle() },
      { name: 'cleanupImportFiles', fn: () => this.cleanupImportFiles() },
      { name: 'formatDataSheets', fn: () => this.formatDataSheets() }
    ];

    for (const task of phase1Tasks) {
      try {
        task.fn();
      } catch (e) {
        phase1Failures.push(task.name);
        logger.error('HousekeepingService', functionName, `${task.name} failed: ${e.message}`);
      }
    }

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

    // Guard against pass-by-default (reliability audit 2.3): a null result (suite
    // threw) or total === 0 (no suites registered / all errored before asserting)
    // would otherwise leave Phase 2 silently green. Surface it as a real failure.
    if (!testResult || testResult.total === 0) {
      NotificationService.reportFailure('tests.empty_or_null_result',
        'Unit test suite returned no results (null or total=0) — Phase 2 cannot be trusted green.',
        'High', { passed: testResult ? testResult.passed : null, total: testResult ? testResult.total : null }, sessionId);
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
      { name: 'refreshBundleComposition', fn: () => WebAppBundles_reimportAllBundles() },
      { name: 'refreshBundlePushStatus', fn: () => this.refreshBundlePushStatus() },
      { name: 'checkBundleHealth', fn: () => this.checkBundleHealth() },
      { name: 'pullMailchimpSubscribers', fn: () => ContactImportService.importFromMailchimpApi() },
      { name: 'pullMailchimpCampaigns', fn: () => CampaignService.pullRecentCampaigns() },
      { name: 'checkBruryaReminder', fn: () => this.checkBruryaReminder() },
      { name: 'checkCouponsReminder', fn: () => this.checkCouponsReminder() },
      { name: 'refreshCrmContacts', fn: () => this.refreshCrmContacts() },
      { name: 'recomputeKpiSummary', fn: () => { KPISummaryService.recomputeCurrent(); KPISummaryService.maybeCloseMonth(); } },
      { name: 'createWelcomeOutreachTasks', fn: () => this.createWelcomeOutreachTasks() },
      { name: 'runLibraryIntegrityReport', fn: () => this.runLibraryIntegrityReport() },
      { name: 'reconcileLibraryDuplicates', fn: () => LibraryService.reconcileLibraryDuplicates() },
      { name: 'maintainCityLookup', fn: () => this.maintainCityLookup() },
      { name: 'backfillActivities', fn: () => this.backfillActivities() },
      { name: 'runCrmIntelligence', fn: () => this.runCrmIntelligence() },
      { name: 'refreshKpiBlock', fn: () => StatusReportService.refreshKpiBlock(sessionId) },
      { name: 'refreshCalendarExport', fn: () => StatusReportService.refreshCalendarExport(sessionId) }
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
    const allFailures = [...phase1Failures, ...phase3Failures];
    try {
      const phase1Passed = phase1Failures.length === 0;
      const phase2Passed = validationResult && testResult && schemaResult;
      const phase3Passed = phase3Failures.length === 0;
      const allPassed = phase1Passed && phase2Passed && phase3Passed;
      const criticalSchemaIssues = schemaResult
        ? schemaResult.discrepancies.filter(d => d.severity === 'CRITICAL').length
        : -1;

      let status = 'success';
      if (!allPassed) {
        status = allFailures.length > 0 ? 'failed' : 'partial';
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
            phase1_failures: phase1Failures.length > 0 ? phase1Failures : null,
            phase3_failures: phase3Failures.length > 0 ? phase3Failures : null,
            failed_job_count: failedJobsSummary ? failedJobsSummary.failedJobCount : null,
            failed_job_oldest_age_days: failedJobsSummary ? failedJobsSummary.oldestAgeDays : null
          }
        }
      );
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Could not update health task: ${e.message}`);
    }

    logger.info('HousekeepingService', functionName,
      allFailures.length > 0
        ? `Daily maintenance completed with failures: ${allFailures.join(', ')}`
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

      // Keep order.placed activity current — new orders log an activity row on
      // the same cadence as the aggregate update above (ongoing counterpart to
      // the run-once backfillOrderActivity). Idempotent.
      if (typeof ActivityBackfillService !== 'undefined' && ActivityBackfillService.syncRecentOrderActivity) {
        const activityResult = ActivityBackfillService.syncRecentOrderActivity();
        logger.info('HousekeepingService', functionName,
          `Order activity sync: ${activityResult.created} created, ${activityResult.skipped} skipped`);
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
      ConfigService.setConfig('system.crm.last_refresh', 'value', new Date().toISOString());

      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `CRM refresh failed: ${e.message}`);
      return false;
    }
  };

  /**
   * Creates welcome outreach tasks for customers whose first completed-status order
   * has been observed. One task per customer; TaskService.createTask handles dedupe
   * by (taskTypeId + linkedEntityId), so re-runs are idempotent.
   *
   * Source signal: SysContacts.sc_FirstCompletedDate, populated by
   * ContactImportService._aggregateOrdersByEmail when iterating order rows.
   * Runs after refreshCrmContacts so the field is fresh.
   */
  this.createWelcomeOutreachTasks = function() {
    const functionName = 'createWelcomeOutreachTasks';

    try {
      // No-backfill guard. First sweep stamps the floor and creates zero tasks;
      // subsequent sweeps only fire for first-completed orders dated on/after the floor.
      const floorConfig = ConfigService.getConfig('system.crm.welcome_floor_date');
      let floorDate;
      if (!floorConfig || !floorConfig.value) {
        floorDate = new Date();
        ConfigService.setConfig('system.crm.welcome_floor_date', 'value', floorDate.toISOString());
        logger.info('HousekeepingService', functionName,
          `Welcome floor initialized to ${floorDate.toISOString()}. No tasks created on first run (backfill skipped).`);
        return true;
      }
      floorDate = new Date(floorConfig.value);

      // Read WebOrdM directly so the welcome sweep doesn't depend on the daily
      // refreshCrmContacts pass populating sc_FirstCompletedDate. Lets the
      // frequent pipeline fire welcome tasks within 20 min of a new completed
      // order rather than waiting until next daily.
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
      const orderSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
      if (!orderSheet || orderSheet.getLastRow() < 2) {
        logger.info('HousekeepingService', functionName, 'No order data. Skipping.');
        return true;
      }

      const womHeaders = allConfig['schema.data.WebOrdM'].headers.split(',');
      const idx = {};
      womHeaders.forEach((h, i) => idx[h] = i);

      const orderData = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, womHeaders.length).getValues();

      // Group completed orders by email, find earliest completed order date per email.
      const earliestCompletedByEmail = {};
      orderData.forEach(row => {
        const status = String(row[idx.wom_Status] || '').toLowerCase().trim();
        if (status !== 'completed') return;
        const email = String(row[idx.wom_BillingEmail] || '').toLowerCase().trim();
        if (!email) return;
        const d = new Date(row[idx.wom_OrderDate]);
        if (isNaN(d.getTime())) return;
        if (!earliestCompletedByEmail[email] || d < earliestCompletedByEmail[email]) {
          earliestCompletedByEmail[email] = d;
        }
      });

      // Filter to emails whose earliest completed order is on/after the floor.
      const eligibleEmails = Object.keys(earliestCompletedByEmail).filter(
        email => earliestCompletedByEmail[email] >= floorDate
      );

      // Auto-populate start (today) + due (today + 4 days) so the welcome task
      // surfaces to the manager as immediately actionable rather than sitting
      // in an unstarted limbo. TaskService.createTask's normal date-pattern
      // logic only stamps dates when due_pattern === 'immediate'; we want this
      // task to be ready to action right away.
      const todayMidnight = (function() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();
      const dueDate = new Date(todayMidnight.getTime() + 4 * 24 * 60 * 60 * 1000);

      let created = 0;
      eligibleEmails.forEach(email => {
        const fcd = earliestCompletedByEmail[email];
        const contact = ContactService.getContactByEmail(email);
        const name = (contact && contact.sc_Name) || email;
        const language = (contact && contact.sc_Language) || 'en';

        const notesJson = JSON.stringify({
          topic: 'Welcome — first order',
          firstCompletedDate: fcd.toISOString(),
          language: language
        });
        try {
          const result = TaskService.createTask(
            'task.contact.outreach',
            email,
            name,
            'Welcome — first order',
            notesJson,
            null,
            {
              topic: 'Welcome — first order',
              startDate: todayMidnight,
              dueDate: dueDate
            }
          );
          if (result) created++;
        } catch (taskError) {
          logger.warn('HousekeepingService', functionName,
            `Could not create welcome task for ${email}: ${taskError.message}`);
        }
      });

      logger.info('HousekeepingService', functionName,
        `Welcome outreach sweep: ${eligibleEmails.length} eligible, ${created} new (existing skipped via dedupe).`);
      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Welcome outreach sweep failed: ${e.message}`);
      return false;
    }
  };

  /**
   * Detects pending-payment orders that have been pending for 2+ sweeps and
   * auto-sends a friendly follow-up email via GmailApp. Writes a SysContactActivity
   * row (type comm.email) for visibility. No task is created — fully automated.
   *
   * Gates:
   *  - crm.pending_payment_followup.enabled === 'true' (kill switch)
   *  - Order status === 'pending' in current pull AND was pending in previous sweep
   *  - Contact has both email and a phone (billing or shipping)
   *  - Order has not already been sent (deduped via sent_order_ids)
   *  - Same email has no later order in [processing, on-hold, completed, pending]
   *    (i.e., the customer hasn't progressed or placed a fresh attempt; if they
   *    did, this one is stale and they're already moving forward)
   *
   * First-time customers (zero completed orders for the email) get the NEW50
   * coupon mention appended; existing customers do not.
   */
  this.createPendingPaymentFollowups = function() {
    const functionName = 'createPendingPaymentFollowups';

    try {
      const allConfig = ConfigService.getAllConfig();
      const enabledCfg = allConfig['crm.pending_payment_followup.enabled'];
      const enabled = enabledCfg && String(enabledCfg.value).toLowerCase() === 'true';
      if (!enabled) {
        logger.info('HousekeepingService', functionName, 'Disabled via config. Skipping.');
        return true;
      }

      const sheetNames = allConfig['system.sheet_names'];

      // Peer-realignment guard per CONTENT_LIBRARY_PLAN §14: if any open
      // `task.content.realign` task is attached to a pending_payment family
      // template entity, pause the whole sweep until the realign closes.
      const familySlugs = [
        'template-pending-payment-email-en',
        'template-pending-payment-email-he',
        'template-pending-payment-addendum-en',
        'template-pending-payment-addendum-he'
      ];
      try {
        const tasksSheet = SheetAccessor.getDataSpreadsheet().getSheetByName(sheetNames.SysTasks);
        if (tasksSheet && tasksSheet.getLastRow() > 1) {
          const tasksValues = tasksSheet.getDataRange().getValues();
          const tasksHeaders = tasksValues[0] || [];
          const typeIdIdx = tasksHeaders.indexOf('st_TaskTypeId');
          const entityIdIdx = tasksHeaders.indexOf('st_EntityId');
          const statusIdx = tasksHeaders.indexOf('st_Status');
          if (typeIdIdx > -1 && entityIdIdx > -1 && statusIdx > -1) {
            for (let i = 1; i < tasksValues.length; i++) {
              const tType = String(tasksValues[i][typeIdIdx] || '');
              const tEntity = String(tasksValues[i][entityIdIdx] || '');
              const tStatus = String(tasksValues[i][statusIdx] || '');
              if (tType === 'task.content.realign' &&
                  familySlugs.indexOf(tEntity) > -1 &&
                  tStatus !== 'Done') {
                logger.info('HousekeepingService', functionName,
                  `Open peer-realignment task on pending_payment family (entity=${tEntity}); skipping sweep.`);
                return true;
              }
            }
          }
        }
      } catch (guardErr) {
        logger.warn('HousekeepingService', functionName,
          `Peer-realignment guard read failed (proceeding anyway): ${guardErr.message}`);
      }

      const spreadsheet = SheetAccessor.getDataSpreadsheet();
      const orderSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
      if (!orderSheet || orderSheet.getLastRow() < 2) {
        logger.info('HousekeepingService', functionName, 'No order data. Skipping.');
        return true;
      }

      const womHeaders = allConfig['schema.data.WebOrdM'].headers.split(',');
      const idx = {};
      womHeaders.forEach((h, i) => idx[h] = i);

      const orderData = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, womHeaders.length).getValues();

      // Bucket orders by status + email for fast self-resolution checks
      const allOrders = orderData.map(row => ({
        orderId: String(row[idx.wom_OrderId]).trim(),
        orderKey: String(row[idx.wom_OrderKey] || '').trim(),
        orderDate: row[idx.wom_OrderDate],
        status: String(row[idx.wom_Status] || '').toLowerCase().trim(),
        email: String(row[idx.wom_BillingEmail] || '').toLowerCase().trim(),
        phone: row[idx.wom_BillingPhone] || row[idx.wom_ShippingPhone] || '',
        firstName: row[idx.wom_BillingFirstName] || '',
        lastName: row[idx.wom_BillingLastName] || '',
        language: String(row[idx.wom_MetaWpmlLanguage] || '').toLowerCase().trim() || 'en'
      })).filter(o => o.orderId);

      // Forward-only floor: stamp on first run, skip everything that round.
      const floorCfg = allConfig['crm.pending_payment_followup.floor_date'];
      let floorDate;
      if (!floorCfg || !floorCfg.value) {
        floorDate = new Date();
        ConfigService.setConfig('crm.pending_payment_followup.floor_date', 'value', floorDate.toISOString());
        // Also seed last_pending_ids so the next run starts comparing cleanly.
        const seedIds = allOrders.filter(o => o.status === 'pending').map(o => o.orderId);
        ConfigService.setConfig('crm.pending_payment_followup.last_pending_ids', 'value', JSON.stringify(seedIds));
        logger.info('HousekeepingService', functionName,
          `Pending-followup floor initialized to ${floorDate.toISOString()}. Seeded ${seedIds.length} pending IDs. No emails on first run.`);
        return true;
      }
      floorDate = new Date(floorCfg.value);

      const currentlyPending = allOrders.filter(o =>
        o.status === 'pending' && new Date(o.orderDate) >= floorDate
      );
      const currentPendingIds = currentlyPending.map(o => o.orderId);

      // Read previous sweep's pending IDs + already-sent IDs
      let lastPendingIds = [];
      let sentOrderIds = [];
      try {
        const lastCfg = allConfig['crm.pending_payment_followup.last_pending_ids'];
        if (lastCfg && lastCfg.value) lastPendingIds = JSON.parse(lastCfg.value);
        const sentCfg = allConfig['crm.pending_payment_followup.sent_order_ids'];
        if (sentCfg && sentCfg.value) sentOrderIds = JSON.parse(sentCfg.value);
      } catch (parseErr) {
        logger.warn('HousekeepingService', functionName, `Could not parse tracking config: ${parseErr.message}. Resetting.`);
        lastPendingIds = [];
        sentOrderIds = [];
      }

      const lastSet = new Set(lastPendingIds);
      const sentSet = new Set(sentOrderIds);

      // Orders eligible for follow-up: pending in both this sweep and the previous,
      // not already sent.
      const eligible = currentlyPending.filter(o =>
        lastSet.has(o.orderId) && !sentSet.has(o.orderId)
      );

      // Read each template's content once per sweep (Doc-first via
      // LibraryService.getEntityContent; falls back to inline fields). Keyed by
      // slug so the per-order loop doesn't re-open the same Doc.
      const templateContentCache = {};
      const getTemplateContent = (slug) => {
        if (!(slug in templateContentCache)) {
          templateContentCache[slug] = LibraryService.getEntityContent({ entityId: slug });
        }
        return templateContentCache[slug];
      };

      let sent = 0;
      eligible.forEach(o => {
        try {
          if (!o.email || !o.phone) return;

          // Self-resolution check: any later order from same email in a non-cancelled state
          const laterOrder = allOrders.find(other =>
            other.email === o.email &&
            other.orderId !== o.orderId &&
            new Date(other.orderDate) > new Date(o.orderDate) &&
            ['processing', 'on-hold', 'completed', 'pending'].indexOf(other.status) >= 0
          );
          if (laterOrder) return;

          // First-time check: zero completed orders for this email
          const completedCount = allOrders.filter(other =>
            other.email === o.email && other.status === 'completed'
          ).length;
          const isFirstTime = completedCount === 0;

          // Compose — content sourced from the entity's Doc (slb_DocUrl) when
          // present, else inline fields (LibraryService.getEntityContent). The Doc
          // is the editable source of truth; the email Doc carries the subject as
          // a leading "Subject:" line + the body, the addendum Doc is body-only.
          const lang = (o.language === 'he') ? 'he' : 'en';
          const emailSlug = `template-pending-payment-email-${lang}`;
          const addendumSlug = `template-pending-payment-addendum-${lang}`;
          const emailContent = getTemplateContent(emailSlug);
          if (!emailContent) {
            logger.warn('HousekeepingService', functionName, `Missing library template ${emailSlug}. Skipping ${o.orderId}.`);
            return;
          }
          const subject = emailContent.subject || '';
          const addendumContent = isFirstTime ? getTemplateContent(addendumSlug) : null;
          const addendumText = (addendumContent && addendumContent.body) || '';
          // Prepend a paragraph break so the addendum reads as its own block (the
          // Doc parser strips the addendum's own leading whitespace). Empty for
          // returning customers.
          const firstTimeBlock = addendumText ? ('\n\n' + addendumText) : '';
          const name = String(o.firstName || '').trim() || 'there';

          // Order-pay URL: prefer the guest-pay link with the captured key
          // (one-tap payment, no login); fall back to the my-account view if
          // the key isn't available (e.g., order pulled before @111).
          const orderPayUrl = o.orderKey
            ? `https://www.jlmwines.com/checkout/order-pay/${o.orderId}/?pay_for_order=true&key=${o.orderKey}`
            : `https://www.jlmwines.com/my-account/view-order/${o.orderId}/`;

          const body = String(emailContent.body || '')
            .replace(/\{name\}/g, name)
            .replace(/\{first_time_block\}/g, firstTimeBlock)
            .replace(/\{order_pay_url\}/g, orderPayUrl);

          // Send
          GmailApp.sendEmail(o.email, subject, body);

          // Log activity — both contact-side (existing) and library-side (phase 10).
          if (typeof ContactService !== 'undefined' && ContactService.createActivity) {
            ContactService.createActivity({
              sca_Email: o.email,
              sca_Timestamp: new Date(),
              sca_Type: 'comm.email',
              sca_Summary: `Pending-payment follow-up sent (order ${o.orderId})${isFirstTime ? ' — first-time' : ''}`,
              sca_Details: {
                automated: true,
                trigger: 'pending_payment_followup',
                orderId: o.orderId,
                isFirstTime: isFirstTime,
                language: lang
              },
              sca_CreatedBy: 'system'
            });
          }
          try {
            LibraryService.logEntityActivity({
              entityId: emailSlug,
              actionType: 'template_send',
              summary: `Sent to ${o.email} (order ${o.orderId})${isFirstTime ? ' — first-time' : ''}`,
              details: {
                contactEmail: o.email,
                orderId: o.orderId,
                language: lang,
                isFirstTime: isFirstTime
              },
              referencedEntities: [o.email]
            });
          } catch (logErr) {
            logger.warn('HousekeepingService', functionName, `Library activity log failed: ${logErr.message}`);
          }

          sentSet.add(o.orderId);
          sent++;
        } catch (orderErr) {
          logger.warn('HousekeepingService', functionName,
            `Failed to follow up on order ${o.orderId}: ${orderErr.message}`);
        }
      });

      // Persist updated tracking state
      ConfigService.setConfig('crm.pending_payment_followup.last_pending_ids', 'value',
        JSON.stringify(currentPendingIds));
      ConfigService.setConfig('crm.pending_payment_followup.sent_order_ids', 'value',
        JSON.stringify(Array.from(sentSet)));

      logger.info('HousekeepingService', functionName,
        `Pending-payment follow-up sweep: ${currentlyPending.length} currently pending, ${eligible.length} eligible (2+ pulls), ${sent} emails sent.`);
      return true;
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Sweep failed: ${e.message}`);
      return false;
    }
  };

  /**
   * Orphan-content integrity report for the content library
   * (CONTENT_LIBRARY_PLAN §17 phase 6). Reads SysLibrary + walks the canonical
   * Drive folder tree under `system.folder.library`. Writes two SysLog rows:
   *   - `library_integrity.orphan_entities`: SysLibrary rows whose `slb_DocUrl`
   *     points at a Drive file ID that no longer resolves.
   *   - `library_integrity.orphan_files`: Drive files under the library root
   *     whose base name (extension-stripped) doesn't match any `slb_Slug`.
   *
   * No email, no task spawn, no remediation — admin reads SysLog on demand.
   */
  this.runLibraryIntegrityReport = function() {
    const functionName = 'runLibraryIntegrityReport';

    try {
      const folderCfg = ConfigService.getConfig('system.folder.library');
      const libraryFolderId = folderCfg && folderCfg.id ? String(folderCfg.id).trim() : '';
      if (!libraryFolderId) {
        logger.warn('HousekeepingService', functionName, 'system.folder.library not configured; skipping.');
        return true;
      }

      // Read SysLibrary entries.
      const librarySheet = SheetAccessor.getLibrarySheet('SysLibrary');
      const libraryValues = librarySheet.getDataRange().getValues();
      const headers = libraryValues[0] || [];
      const slugColIdx = headers.indexOf('slb_Slug');
      const docUrlColIdx = headers.indexOf('slb_DocUrl');
      if (slugColIdx === -1 || docUrlColIdx === -1) {
        logger.warn('HousekeepingService', functionName, 'SysLibrary missing slb_Slug or slb_DocUrl; skipping.');
        return true;
      }

      const slugSet = new Set();
      const entitiesWithDoc = [];
      for (let i = 1; i < libraryValues.length; i++) {
        const slug = libraryValues[i][slugColIdx];
        const docUrl = libraryValues[i][docUrlColIdx];
        if (!slug) continue;
        slugSet.add(String(slug).trim());
        if (docUrl) {
          const match = String(docUrl).match(/[-\w]{25,}/);
          if (match) {
            entitiesWithDoc.push({ slug: String(slug).trim(), fileId: match[0] });
          }
        }
      }

      // Orphan entities — slb_DocUrl set but Drive file ID doesn't resolve.
      const orphanEntities = [];
      entitiesWithDoc.forEach(e => {
        try {
          DriveApp.getFileById(e.fileId);
        } catch (err) {
          orphanEntities.push({ slug: e.slug, fileId: e.fileId });
        }
      });

      // Walk Drive folder tree, collect every file under library root.
      function walkFolder(folder, pathPrefix, out) {
        const files = folder.getFiles();
        while (files.hasNext()) {
          const file = files.next();
          out.push({ name: file.getName(), fileId: file.getId(), path: pathPrefix });
        }
        const subfolders = folder.getFolders();
        while (subfolders.hasNext()) {
          const sub = subfolders.next();
          // Skip the supersede archive — its copies are deliberate version
          // history, not orphans (Decision 7, Plan B).
          if (sub.getName() === '_archive') continue;
          walkFolder(sub, pathPrefix + '/' + sub.getName(), out);
        }
      }
      const libraryFolder = DriveApp.getFolderById(libraryFolderId);
      const driveFiles = [];
      walkFolder(libraryFolder, '', driveFiles);

      // Orphan files — Drive files whose slug (version suffix + extension
      // stripped) doesn't match a SysLibrary slug. Active files now carry a
      // `<slug> <ts>` suffix (Decision 7, Plan B), so strip it before matching.
      const orphanFiles = [];
      driveFiles.forEach(f => {
        const baseName = LibraryService.slugFromFileName(f.name);
        if (!slugSet.has(baseName)) {
          orphanFiles.push({ name: f.name, fileId: f.fileId, path: f.path });
        }
      });

      logger.info('HousekeepingService', 'library_integrity.orphan_entities',
        `Orphan entities: ${orphanEntities.length}`,
        { count: orphanEntities.length, entries: orphanEntities });
      logger.info('HousekeepingService', 'library_integrity.orphan_files',
        `Orphan files: ${orphanFiles.length}`,
        { count: orphanFiles.length, entries: orphanFiles });

      // Return counts for the Dev-view button; the daily batch ignores the value.
      return { orphanEntities: orphanEntities.length, orphanFiles: orphanFiles.length };
    } catch (e) {
      logger.warn('HousekeepingService', functionName, `Report failed: ${e.message}`);
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
   * Recompute + cache the bundle export status (ADMIN_BUNDLES_UI_PLAN Phase 1). Runs daily
   * right after refreshBundleComposition so the ops≠web diff is maximally fresh. Recomputed,
   * never recorded — cached in system.bundles.push_status only so the Bundles view + dashboard
   * mount instantly. Stores {count, bundleIds, ts}.
   */
  this.refreshBundlePushStatus = function() {
    const functionName = 'refreshBundlePushStatus';
    try {
      const result = BundleService.buildExportTable();
      const bundleIds = (result.rows || []).map(function (r) { return String(r.bundleId); });
      const payload = JSON.stringify({
        count: result.exportCount || 0,
        bundleIds: bundleIds,
        ts: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      });
      ConfigService.setConfig('system.bundles.push_status', 'value', payload);

      // Surface the batch task (ADMIN_BUNDLES_UI_PLAN Phase 1a-ii): ONE singleton task
      // when count > 0 (never per-bundle), closed primarily by the Export action; here we
      // open/update on count > 0 and safety-close if the diff resolved to 0 by other means.
      const pushCount = result.exportCount || 0;
      try {
        if (pushCount > 0) {
          TaskService.upsertSingletonTask(
            'task.bundles.push_pending',
            '_SYSTEM',
            'Bundle Export Queue',
            `${pushCount} bundle(s) need export to web`,
            { count: pushCount, bundleIds: bundleIds, ts: JSON.parse(payload).ts }
          );
        } else {
          TaskService.completeTaskByTypeAndEntity('task.bundles.push_pending', '_SYSTEM');
        }
      } catch (taskError) {
        logger.warn('HousekeepingService', functionName, `Could not sync push-pending task: ${taskError.message}`);
      }

      logger.info('HousekeepingService', functionName, `Bundle push status cached: ${pushCount} of ${result.total || 0} need export.`);
      return { count: pushCount };
    } catch (e) {
      logger.error('HousekeepingService', functionName, `refreshBundlePushStatus failed: ${e.message}`, e);
      throw e;
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

      // Stage 7 rev 2.2: the deficiency gate is the RICHER signal — stock ∨ criteria-miss ∨ over
      // slot.priceMax ∨ bundle base total outside [sb_MinTotal, sb_MaxTotal] — not stock alone
      // (BundleService.getBundleDeficiencies). Maintain fixes only the deficient slots.
      const bundlesWithIssues = BundleService.getBundleDeficiencies();

      // Stage 7: per-bundle critical/low inventory tasks are RETIRED (user 2026-06-08). The
      // generator (Maintain) handles the swaps, so the actionable signal is a single "bundles need
      // update" prompt — never per-bundle noise. Recomputed each run (open on count>0, safety-close
      // on 0); self-corrects once the operator runs Maintain + the deficiencies clear.
      const affectedCount = bundlesWithIssues.length;
      const affectedIds = bundlesWithIssues.map(bd => bd.bundle.bundleId);
      try {
        if (affectedCount > 0) {
          TaskService.upsertSingletonTask(
            'task.bundles.needs_update',
            '_SYSTEM',
            'Bundles Need Update',
            `${affectedCount} bundle(s) need attention (stock, criteria, or price band) — run Maintain to refresh`,
            { count: affectedCount, bundleIds: affectedIds }
          );
        } else {
          TaskService.completeTaskByTypeAndEntity('task.bundles.needs_update', '_SYSTEM');
        }
      } catch (taskError) {
        logger.warn('HousekeepingService', functionName, `Could not sync bundles-need-update task: ${taskError.message}`);
      }

      // Cache the deficient bundle-ids so the Bundles list can flag "Needs attention" per row (parallel
      // to system.bundles.push_status). Recomputed-not-recorded; refreshed here (housekeeping) + on
      // on-demand Review. Empty default.
      try {
        ConfigService.setConfig('system.bundles.needs_update_status', 'value',
          JSON.stringify({ count: affectedCount, bundleIds: affectedIds, ts: new Date().toISOString() }));
      } catch (cacheError) {
        logger.warn('HousekeepingService', functionName, `Could not cache needs-update status: ${cacheError.message}`);
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
      ConfigService.setConfig('system.bundle_health.last_check', 'value', new Date().toISOString());

      logger.info('HousekeepingService', functionName, `Bundle health check complete. Bundles needing update: ${affectedCount}`);
      return { success: true, bundlesNeedingUpdate: affectedCount, bundleIds: affectedIds };
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

      const dataSpreadsheet = SheetAccessor.getDataSpreadsheet();
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

      const dataSpreadsheet = SheetAccessor.getDataSpreadsheet();
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
        return (status === 'Done' || status === 'Cancelled') && createdDate < thresholdDate;
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
   * Sweeps SysJobQueue for accumulating FAILED rows so they surface in the daily
   * health snapshot instead of rotting silently (reliability audit 2.2).
   *
   * Severity laddering (only failures within the recent window drive alerts;
   * older ones are legacy noise — counted in the notes total but not alarmed):
   *   - count > 0                                  -> Normal
   *   - any recent FAILED older than 7 days        -> High
   *   - any recent FAILED whose job_type is still  -> Critical (zombie killer
   *     in the PROCESSING set                          never fired)
   *
   * MUST run before purgeOldJobs (which deletes aged terminal rows) or aged
   * FAILEDs vanish before being counted. Read-once (CCP-3). On High/Critical,
   * reportFailure with the stable context 'queue.failed_job_sweep' so daily runs
   * update one deduped task (CCP-1). Never throws — daily run must continue.
   *
   * @param {string} sessionId - correlation id (CCP-2).
   * @returns {{failedJobCount:number, oldestAgeDays:?number, severity:?string}|null}
   */
  this.checkFailedJobs = function(sessionId) {
    const functionName = 'checkFailedJobs';
    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn('HousekeepingService', functionName, 'Configuration not available. Skipping failed-job sweep.');
        return null;
      }
      const sheetNames = allConfig['system.sheet_names'];
      const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue, false);
      if (!jobQueueSheet) {
        logger.warn('HousekeepingService', functionName, 'SysJobQueue sheet not found. Skipping failed-job sweep.');
        return null;
      }
      const jobSchema = allConfig['schema.log.SysJobQueue'];
      if (!jobSchema?.headers) {
        logger.error('HousekeepingService', functionName, 'SysJobQueue schema not found.');
        return null;
      }

      const headers = jobSchema.headers.split(',');
      const statusCol = headers.indexOf('status');
      const processedCol = headers.indexOf('processed_timestamp');
      const createdCol = headers.indexOf('created_timestamp');
      const jobTypeCol = headers.indexOf('job_type');
      if (statusCol === -1 || jobTypeCol === -1) {
        logger.error('HousekeepingService', functionName, 'Required columns (status/job_type) not found in SysJobQueue schema.');
        return null;
      }

      const jobData = jobQueueSheet.getDataRange().getValues();
      if (jobData.length <= 1) {
        return { failedJobCount: 0, oldestAgeDays: 0, severity: null };
      }

      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const RECENT_WINDOW_DAYS = 30; // failures older than this are legacy noise: counted, not alarmed
      const HIGH_AGE_DAYS = 7;
      const now = new Date();

      const processingJobTypes = new Set();
      const failed = []; // { ageDays:?number, jobType:string }

      for (let i = 1; i < jobData.length; i++) {
        const row = jobData[i];
        const status = String(row[statusCol]).toLowerCase();
        const jobType = String(row[jobTypeCol] || '');
        if (status === 'processing') {
          processingJobTypes.add(jobType);
          continue;
        }
        if (status === 'failed') {
          const tsRaw = (processedCol !== -1 && row[processedCol]) ? row[processedCol]
                      : (createdCol !== -1 ? row[createdCol] : null);
          const ts = tsRaw ? new Date(tsRaw) : null;
          const ageDays = (ts && !isNaN(ts)) ? (now - ts) / MS_PER_DAY : null;
          failed.push({ ageDays: ageDays, jobType: jobType });
        }
      }

      const failedJobCount = failed.length;
      if (failedJobCount === 0) {
        return { failedJobCount: 0, oldestAgeDays: 0, severity: null };
      }

      const agesKnown = failed.filter(f => f.ageDays !== null).map(f => f.ageDays);
      const oldestAgeDays = agesKnown.length ? Math.round(Math.max.apply(null, agesKnown)) : null;

      const recent = failed.filter(f => f.ageDays === null || f.ageDays <= RECENT_WINDOW_DAYS);
      const anyRecentOverHigh = recent.some(f => f.ageDays !== null && f.ageDays > HIGH_AGE_DAYS);
      const zombieJobTypes = recent.filter(f => processingJobTypes.has(f.jobType)).map(f => f.jobType);
      const anyZombie = zombieJobTypes.length > 0;

      let severity = 'Normal';
      if (anyZombie) severity = 'Critical';
      else if (anyRecentOverHigh) severity = 'High';

      if (severity === 'High' || severity === 'Critical') {
        const msg = `${failedJobCount} FAILED job(s) in SysJobQueue (oldest ${oldestAgeDays}d)` +
          (anyZombie ? `; zombie job_type still PROCESSING: ${zombieJobTypes.join(', ')}` : '');
        NotificationService.reportFailure('queue.failed_job_sweep', msg, severity,
          { failedJobCount: failedJobCount, oldestAgeDays: oldestAgeDays, zombieJobTypes: zombieJobTypes }, sessionId);
      }

      logger.info('HousekeepingService', functionName,
        `Failed-job sweep: ${failedJobCount} FAILED (oldest ${oldestAgeDays}d), severity ${severity}.`);
      return { failedJobCount: failedJobCount, oldestAgeDays: oldestAgeDays, severity: severity };

    } catch (e) {
      logger.error('HousekeepingService', functionName, `Failed-job sweep error: ${e.message}`, e);
      return null;
    }
  };

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

      const sheetNames = allConfig['system.sheet_names'];
      const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue, false);

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
   * 4. Trashes old packing slips from the printme folder.
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
        let skippedArchiveFiles = 0;
        while (archiveFiles.hasNext()) {
          const file = archiveFiles.next();
          if (file.getLastUpdated() < archiveThresholdDate) {
            try {
              file.setTrashed(true);
              trashedArchiveFiles++;
            } catch (fileError) {
              skippedArchiveFiles++;
            }
          }
        }
        if (trashedArchiveFiles > 0 || skippedArchiveFiles > 0) {
          logger.info('HousekeepingService', 'manageFileLifecycle', `Archive cleanup: ${trashedArchiveFiles} trashed, ${skippedArchiveFiles} skipped (no permission).`);
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
        let skippedMoveFiles = 0;
        let trashedOldExportFiles = 0;
        let skippedTrashFiles = 0;

        // Move files from the main exports folder to the old_exports folder if they are older than EXPORT_RETENTION_DAYS
        const currentExportFiles = exportsFolder.getFiles();
        while (currentExportFiles.hasNext()) {
          const file = currentExportFiles.next();
          if (file.getLastUpdated() < exportMoveThresholdDate) {
            try {
              file.moveTo(oldExportsFolder);
              movedExportFiles++;
            } catch (fileError) {
              skippedMoveFiles++;
            }
          }
        }
        if (movedExportFiles > 0 || skippedMoveFiles > 0) {
          logger.info('HousekeepingService', 'manageFileLifecycle', `Exports move: ${movedExportFiles} moved, ${skippedMoveFiles} skipped (no permission).`);
        }

        // Trash files from the old_exports folder if they are older than OLD_EXPORTS_RETENTION_DAYS
        const oldExportedFiles = oldExportsFolder.getFiles();
        while (oldExportedFiles.hasNext()) {
          const file = oldExportedFiles.next();
          if (file.getLastUpdated() < oldExportTrashThresholdDate) {
            try {
              file.setTrashed(true);
              trashedOldExportFiles++;
            } catch (fileError) {
              skippedTrashFiles++;
            }
          }
        }
        if (trashedOldExportFiles > 0 || skippedTrashFiles > 0) {
          logger.info('HousekeepingService', 'manageFileLifecycle', `Old exports cleanup: ${trashedOldExportFiles} trashed, ${skippedTrashFiles} skipped (no permission).`);
        }

      } else {
        logger.warn('HousekeepingService', 'manageFileLifecycle', "System setting 'system.folder.jlmops_exports' not found. Skipping export folder management.");
      }

      // 4. Trashing old packing slips from the printme folder
      const printmeFolderId = allConfig['printing.output.folder_id']?.id;
      if (printmeFolderId) {
        const printmeFolder = DriveApp.getFolderById(printmeFolderId);
        const printmeFiles = printmeFolder.getFiles();
        const printmeThresholdDate = _getThresholdDate(PRINTME_RETENTION_DAYS);
        let trashedPrintmeFiles = 0;
        let skippedFiles = 0;
        while (printmeFiles.hasNext()) {
          const file = printmeFiles.next();
          if (file.getLastUpdated() < printmeThresholdDate) {
            try {
              file.setTrashed(true);
              trashedPrintmeFiles++;
            } catch (fileError) {
              skippedFiles++;
            }
          }
        }
        if (trashedPrintmeFiles > 0 || skippedFiles > 0) {
          logger.info('HousekeepingService', 'manageFileLifecycle', `Printme cleanup: ${trashedPrintmeFiles} trashed, ${skippedFiles} skipped (no permission).`);
        }
      } else {
        logger.warn('HousekeepingService', 'manageFileLifecycle', "System setting 'printing.output.folder_id' not found. Skipping printme folder cleanup.");
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
        /^he_product_export.*\.csv$/i,    // he_product_export_2025-12-10-06-21-01.csv
        /^order_export_.*\.csv$/i         // order_export_2025-12-10-06-21-01.csv
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
      ConfigService.setConfig('system.crm_intelligence.last_run', 'value', new Date().toISOString());

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

      const spreadsheet = SheetAccessor.getDataSpreadsheet();
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

/**
 * Editor entry point for the content-library orphan-integrity report. Runs the
 * same check the daily maintenance batch runs (HousekeepingService.js:727), but
 * standalone so it can be invoked from the Apps Script editor. Writes the
 * `library_integrity.orphan_entities` / `library_integrity.orphan_files` SysLog
 * rows; returns true on success.
 */
function runLibraryIntegrityReport() {
  return housekeepingService.runLibraryIntegrityReport();
}