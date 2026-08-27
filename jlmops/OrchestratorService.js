/**
 * @file OrchestratorService.js
 * @description Main service to orchestrate all automated workflows.
 */

function generateSessionId() {
  const tz = Session.getScriptTimeZone();
  const timestamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  const uuidPart = Utilities.getUuid().substring(0, 8).toUpperCase();
  return `SYNC-${timestamp}-${uuidPart}`;
}

function resolveSessionIdForJob(jobType, jobConfig, allConfig) {
  const serviceName = 'OrchestratorService';
  const functionName = 'resolveSessionIdForJob';

  const dependencyJobType = jobConfig.depends_on;

  // If it's a root job (no dependency) or a job that needs a new session
  if (!dependencyJobType) {
      logger.info(serviceName, functionName, `Job type '${jobType}' is a root job or has no direct dependency. Generating new session ID.`, { data: { jobType: jobType } });
      return generateSessionId();
  }

  // Check for the most recent completed job of the dependency type to inherit its session ID
  const logSheetConfig = allConfig['system.spreadsheet.logs'];
  const sheetNames = allConfig['system.sheet_names'];
  const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
  const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
  
  if (!jobQueueSheet || jobQueueSheet.getLastRow() < 2) {
      logger.warn(serviceName, functionName, `Job queue is empty. Cannot resolve session ID for dependent job '${jobType}'. Generating new session ID.`, { data: { jobType: jobType, dependency: dependencyJobType } });
      return generateSessionId();
  }

  const jobQueueSchema = allConfig['schema.log.SysJobQueue'];
  const jobQueueHeaders = jobQueueSchema.headers.split(',');

  const data = jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueHeaders.length).getValues();

  const jobTypeColIdx = jobQueueHeaders.indexOf('job_type');
  const statusColIdx = jobQueueHeaders.indexOf('status');
  const sessionIdColIdx = jobQueueHeaders.indexOf('session_id');
  const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');


  let lastDependencySessionId = null;
  let lastDependencyProcessedTime = 0;

  // Iterate backwards to find the most recent completed dependency
  for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      if (row[jobTypeColIdx] === dependencyJobType && row[statusColIdx] === 'COMPLETED') {
          const processedTimestamp = new Date(row[processedTsColIdx]).getTime();
          if (!isNaN(processedTimestamp) && processedTimestamp > lastDependencyProcessedTime) {
              lastDependencySessionId = row[sessionIdColIdx];
              lastDependencyProcessedTime = processedTimestamp;
              break; // Found the most recent, break the loop
          }
      }
  }

  if (lastDependencySessionId) {
      logger.info(serviceName, functionName, `Found session ID '${lastDependencySessionId}' from completed dependency job '${dependencyJobType}' for job '${jobType}'.`, { data: { jobType: jobType, dependency: dependencyJobType, resolvedSessionId: lastDependencySessionId } });
      return lastDependencySessionId;
  } else {
      logger.warn(serviceName, functionName, `Could not find a completed session ID for dependency '${dependencyJobType}'. Generating new session ID for job '${jobType}'.`, { data: { jobType: jobType, dependency: dependencyJobType } });
      return generateSessionId();
  }
}

/**
 * Gets files from a folder that match a glob-style pattern.
 * Supports * as wildcard (matches any characters).
 * @param {GoogleAppsScript.Drive.Folder} folder - The folder to search in
 * @param {string} pattern - The pattern to match (e.g., "product_export_*.csv")
 * @returns {GoogleAppsScript.Drive.FileIterator} - Iterator of matching files (wrapped in array for compatibility)
 */
function getFilesByPattern(folder, pattern) {
  // If pattern has no wildcards, use the native getFilesByName
  if (!pattern.includes('*')) {
    return folder.getFilesByName(pattern);
  }

  // Convert glob pattern to regex: escape special chars, replace * with .*
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars (except *)
    .replace(/\*/g, '.*');                    // Replace * with .*
  const regex = new RegExp('^' + regexPattern + '$', 'i');

  // Get all files and filter by pattern (only .csv files)
  const matchingFiles = [];
  const allFiles = folder.getFiles();
  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const fileName = file.getName();
    if (regex.test(fileName) && fileName.toLowerCase().endsWith('.csv')) {
      matchingFiles.push(file);
    }
  }

  // Return an iterator-like object for compatibility with existing code
  let index = 0;
  return {
    hasNext: function() { return index < matchingFiles.length; },
    next: function() { return matchingFiles[index++]; }
  };
}

/**
 * The main entry point for the hourly time-driven trigger.
 */
function runHourlyTrigger() {
  OrchestratorService.run('hourly');
}

/**
 * The main entry point for the daily time-driven trigger.
 */
function runDailyTrigger() {
  OrchestratorService.run('daily');
}

const OrchestratorService = (function() {

  function run(taskType) {
    const serviceName = 'OrchestratorService';
    const functionName = 'run';
    logger.info(serviceName, functionName, `Orchestrator running for task type: ${taskType}...`);
    const allConfig = ConfigService.getAllConfig();
    if (!allConfig) {
      logger.error(serviceName, functionName, 'Could not load configuration. Halting.');
      return;
    }
    try {
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (taskType === 'hourly') {
        _processWebOrdersFiles(); // Dedicated to orders
        processPendingJobs();
        _checkAndAdvanceSyncState();
      }
      // REMOVED: else if (taskType === 'daily') { ... } 
      // PERIODIC SYNC IS NOW UI-DRIVEN, NOT A SIMPLE CRON JOB
      
    } catch (e) {
      logger.error(serviceName, functionName, `An unexpected error occurred: ${e.message}`, e);
    }
    logger.info(serviceName, functionName, `Orchestrator finished for task type: ${taskType}.`);
  }

  // --- ORDER RIVER: Hourly Process Web Orders ---
  function _processWebOrdersFiles() {
    const serviceName = 'OrchestratorService';
    const functionName = '_processWebOrdersFiles';
    logger.info(serviceName, functionName, 'Checking for new Web Order files...');
    const allConfig = ConfigService.getAllConfig();
    if (!allConfig) {
      logger.error(serviceName, functionName, 'Could not load configuration. Halting Web Order file processing.');
      return;
    }

    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const archiveFolderConfig = allConfig['system.folder.archive'];
    const sheetNames = allConfig['system.sheet_names'];

    if (!logSheetConfig || !logSheetConfig.id || !archiveFolderConfig || !archiveFolderConfig.id || !sheetNames) {
      logger.error(serviceName, functionName, 'Essential system configuration is missing (log spreadsheet, archive folder, or sheet names).');
      return;
    }

    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    const fileRegistrySheet = logSpreadsheet.getSheetByName(sheetNames.SysFileRegistry);
    const archiveFolder = DriveApp.getFolderById(archiveFolderConfig.id);

    const registry = getRegistryMap(fileRegistrySheet);
    
    const configName = 'import.drive.web_orders'; // Only process web orders here
    const config = allConfig[configName];
    
    if (!config || !config.source_folder_id || !config.file_pattern) {
      const errorMessage = `Configuration for '${configName}' is incomplete or missing. Halting Web Order file processing.`;
      logger.error(serviceName, functionName, errorMessage);
      return;
    }

    const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
    const files = getFilesByPattern(sourceFolder, config.file_pattern);

    // Find the NEWEST file matching the pattern (not all files)
    let newestFile = null;
    let newestDate = new Date(0);
    while (files.hasNext()) {
        const file = files.next();
        const lastUpdated = file.getLastUpdated();
        if (lastUpdated > newestDate) {
            newestFile = file;
            newestDate = lastUpdated;
        }
    }

    if (newestFile && isNewFile(newestFile, registry)) {
        logger.info(serviceName, functionName, `Discovered new Web Order file: ${newestFile.getName()} (${newestDate.toISOString()})`);
        const archivedFile = archiveFile(newestFile, archiveFolder);
        // Web Orders have no dependencies, so always generate a new session ID for them
        const sessionIdForNewJob = generateSessionId();
        createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId(), 'PENDING', newestFile.getId(), newestFile.getLastUpdated(), sessionIdForNewJob);
        logger.info(serviceName, functionName, 'Web Order file queued for processing.');
    } else if (newestFile) {
        logger.info(serviceName, functionName, `Newest Web Order file (${newestFile.getName()}) already processed.`);
    } else {
        logger.info(serviceName, functionName, 'No Web Order files found in import folder.');
    }
    logger.info(serviceName, functionName, 'Web Order file discovery complete.');
  }

  /**
   * Public function to trigger the processing of Web Order files.
   * Discovers new files and queues jobs.
   */
  function triggerWebOrderFileProcessing() {
    const serviceName = 'OrchestratorService';
    const functionName = 'triggerWebOrderFileProcessing';
    logger.info(serviceName, functionName, 'Manually triggering Web Order file processing.');
    _processWebOrdersFiles();
  }

  // --- PERIODIC SYNC: UI-DRIVEN STAGE 1 ---
  function queueWebFilesForSync(sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'queueWebFilesForSync';
    logger.info(serviceName, functionName, `Queuing Web files for Periodic Sync Session: ${sessionId}`);
    const allConfig = ConfigService.getAllConfig();

    const importConfigs = [
        'import.drive.web_products_en',
        'import.drive.web_translations_he', // Translations are now independent
        'import.drive.web_orders' // Web Orders also part of sync for stock accuracy
    ];

    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysJobQueue);
    const fileRegistrySheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysFileRegistry);
    const archiveFolder = DriveApp.getFolderById(allConfig['system.folder.archive'].id);

    const registry = getRegistryMap(fileRegistrySheet);

    const requiredFiles = {
        'import.drive.web_products_en': false,
        'import.drive.web_translations_he': false,
        'import.drive.web_orders': false
    };

    importConfigs.forEach(configName => {
        const config = allConfig[configName];
        if (!config || !config.source_folder_id || !config.file_pattern) {
            throw new Error(`Configuration for '${configName}' is incomplete or missing.`);
        }

        const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
        const files = getFilesByPattern(sourceFolder, config.file_pattern);
        
        // Find latest file for this configName
        let latestFile = null;
        let latestDate = new Date(0);

        while (files.hasNext()) {
            const file = files.next();
            const lastUpdated = file.getLastUpdated();
            if (lastUpdated > latestDate) {
                latestFile = file;
                latestDate = lastUpdated;
            }
        }

        if (latestFile) {
            // Check if this file has already been processed in the current session
            const alreadyProcessedInSession = getPendingOrProcessingJob(configName, sessionId) ||
                                              getLastJobSuccess(configName, sessionId);

            if (alreadyProcessedInSession) {
                logger.info(serviceName, functionName, `File for ${configName} already processed or pending in session ${sessionId}. Skipping.`, { sessionId: sessionId, configName: configName });
            } else {
                // Translation freshness check: only import if file has changed since last import
                if (configName === 'import.drive.web_translations_he') {
                    if (!isNewFile(latestFile, registry)) {
                        logger.info(serviceName, functionName,
                            'Translations file unchanged since last import. Skipping.',
                            { sessionId: sessionId, configName: configName });
                        return; // Skip to next config in forEach
                    }
                }

                const archivedFile = archiveFile(latestFile, archiveFolder);
                createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId(), 'PENDING', latestFile.getId(), latestFile.getLastUpdated(), sessionId);
                requiredFiles[configName] = true;
            }
        } else {
            logger.warn(serviceName, functionName, `No new file found for ${configName} in input folder.`, { sessionId: sessionId, configName: configName });
        }
    });

    // Pre-flight check: Ensure all required files were found/queued
    // We loosen this slightly: Translations are optional, but Products and Orders are mandatory for Sync.
    if (!requiredFiles['import.drive.web_products_en']) throw new Error("Missing required file: product_export_*.csv");
    if (!requiredFiles['import.drive.web_orders']) throw new Error("Missing required file: WebOrders.csv");
    
    SpreadsheetApp.flush(); // Ensure jobs are written to the sheet
    logger.info(serviceName, functionName, `Web files queued for Session: ${sessionId}.`);
  }

  // --- PERIODIC SYNC: UI-DRIVEN STAGE 2 ---
  function queueComaxFileForSync(sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'queueComaxFileForSync';
    logger.info(serviceName, functionName, `Queuing Comax file for Periodic Sync Session: ${sessionId}`);
    const allConfig = ConfigService.getAllConfig();

    const configName = 'import.drive.comax_products';
    const config = allConfig[configName];
    
    if (!config || !config.source_folder_id || !config.file_pattern) {
        throw new Error(`Configuration for '${configName}' is incomplete or missing.`);
    }

    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysJobQueue);
    const fileRegistrySheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysFileRegistry);
    const archiveFolder = DriveApp.getFolderById(allConfig['system.folder.archive'].id);
    const registry = getRegistryMap(fileRegistrySheet);

    const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
    const files = getFilesByPattern(sourceFolder, config.file_pattern);
    
    let latestFile = null;
    let latestDate = new Date(0);

    while (files.hasNext()) {
        const file = files.next();
        const lastUpdated = file.getLastUpdated();
        if (lastUpdated > latestDate) {
            latestFile = file;
            latestDate = lastUpdated;
        }
    }

    if (!latestFile) {
        throw new Error(`Required file for ${configName} was not found. Please ensure it is in the input folder.`);
    }

    // Check if this file has already been processed in the current session
    const alreadyProcessedInSession = getPendingOrProcessingJob(configName, sessionId) ||
                                      getLastJobSuccess(configName, sessionId);
    
    if (alreadyProcessedInSession) {
        logger.info(serviceName, functionName, `File for ${configName} already processed or pending in session ${sessionId}. Skipping.`, { sessionId: sessionId, configName: configName });
    } else {
        const archivedFile = archiveFile(latestFile, archiveFolder);
        // Comax import depends on web_products_en for sequencing, but in the UI flow, we know Web is done.
        // However, for safety, we can keep it PENDING and let Orchestrator pick it up.
        // NOTE: We removed the dependency in jobs.json, so PENDING is correct. It will run immediately.
        createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId(), 'PENDING', latestFile.getId(), latestFile.getLastUpdated(), sessionId);
    }
    
    SpreadsheetApp.flush(); // Ensure job is written
    logger.info(serviceName, functionName, `Comax file queued for Session: ${sessionId}.`);
  }

  // --- PERIODIC SYNC: UI-DRIVEN STAGE 3 ---
  function finalizeSync(sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'finalizeSync';
    logger.info(serviceName, functionName, `Finalizing Periodic Sync Session: ${sessionId}`);
    const allConfig = ConfigService.getAllConfig();

    const jobQueueSheet = SheetAccessor.getLogSheet(allConfig['system.sheet_names'].SysJobQueue);
    
    // 1. Queue Master Validation
    const validationJobType = 'job.periodic.validation.master';
    const validationJobConfig = allConfig[validationJobType];
    const existingValidationJob = getPendingOrProcessingJob(validationJobType, sessionId);

    if (!existingValidationJob) {
        createJob(jobQueueSheet, validationJobType, validationJobConfig.processing_service, '', 'PENDING', '', '', sessionId);
        logger.info(serviceName, functionName, `Queued Master Validation job for Session: ${sessionId}`, { sessionId: sessionId });
    } else {
        logger.info(serviceName, functionName, `Master Validation job already pending/processing for Session: ${sessionId}. Skipping queueing.`, { sessionId: sessionId });
    }

    // Export Web Inventory is now user-initiated after validation succeeds. Not auto-queued here.
    
    SpreadsheetApp.flush(); // Ensure jobs are written
    logger.info(serviceName, functionName, `Periodic Sync finalization steps (validation only) queued for Session: ${sessionId}.`);
  }

  /**
   * Queue the API push job (alternate route to manual CSV upload).
   * Triggered when the user clicks "API Push" at WAITING_WEB_CONFIRM.
   */
  function queueWebInventoryPush(sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'queueWebInventoryPush';

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

    logger.info(serviceName, functionName, `Queuing Web Inventory Push job for Session: ${sessionId}`);

    const pushJobType = 'export.web.inventory.api';
    const pushJobConfig = allConfig[pushJobType];
    const existingPushJob = getPendingOrProcessingJob(pushJobType, sessionId);

    if (!pushJobConfig) {
      throw new Error(`Configuration for '${pushJobType}' is missing.`);
    }

    if (!existingPushJob) {
        createJob(jobQueueSheet, pushJobType, pushJobConfig.processing_service, '', 'PENDING', '', '', sessionId);
        logger.info(serviceName, functionName, `Queued Web Inventory Push job for Session: ${sessionId}`, { sessionId: sessionId });
    } else {
        logger.info(serviceName, functionName, `Web Inventory Push job already pending/processing for Session: ${sessionId}. Skipping queueing.`, { sessionId: sessionId });
    }
    SpreadsheetApp.flush();
  }

  // --- HELPER FUNCTIONS ---

  function isNewFile(file, registry) {
    const fileId = file.getId();
    const lastUpdated = file.getLastUpdated();
    const registryEntry = registry.get(fileId);

    if (!registryEntry) {
      return true; // It's new if it's not in the registry.
    }

    // Compare timestamps at the second level to avoid precision issues with Sheets.
    const liveSeconds = Math.floor(lastUpdated.getTime() / 1000);
    const registeredSeconds = Math.floor(new Date(registryEntry.lastUpdated).getTime() / 1000);

    return liveSeconds > registeredSeconds;
  }

  function archiveFile(file, archiveFolder) {
    const now = new Date();
    const year = now.getFullYear();
    const month = ('0' + (now.getMonth() + 1)).slice(-2);
    // Day folder level removed per user request

    let yearFolder = getOrCreateFolder(archiveFolder, year.toString());
    let monthFolder = getOrCreateFolder(yearFolder, month);

    const timestamp = now.toISOString().replace(/:/g, '-');
    const newFileName = `${file.getName()}_${timestamp}`;

    const newFile = file.makeCopy(newFileName, monthFolder);
    logger.info('OrchestratorService', 'archiveFile', `Archived file as: ${newFile.getName()}`);

    // Original file is NOT trashed here - it stays in place until job completes successfully.
    // This allows examination of quarantined/failed files.
    // Cleanup happens in finalizeJobCompletion() for COMPLETED jobs only.

    return newFile;
  }

  function createJob(sheet, configName, serviceName, archiveFileId, status, originalFileId, originalFileLastUpdated, sessionId) {
    const jobId = Utilities.getUuid();
    const now = new Date();
    // Corresponds to: job_id, session_id, job_type, status, archive_file_id, created_timestamp, processed_timestamp, error_message, retry_count, original_file_id, original_file_last_updated
    // Default retry_count to 0 for new jobs
    sheet.appendRow([jobId, sessionId, configName, status, archiveFileId, now, '', '', 0, originalFileId, originalFileLastUpdated]);
    logger.info('OrchestratorService', 'createJob', `Created new job ${jobId} (Session: ${sessionId}) for ${configName} with status: ${status}`);
  }

  function getRegistryMap(sheet) {
    if (sheet.getLastRow() < 2) return new Map();
    // Read all 3 columns: id, name, timestamp
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    const map = new Map();
    data.forEach(row => {
      const fileId = row[0];
      const fileName = row[1];
      const timestamp = row[2];
      if (fileId && timestamp) {
        map.set(fileId, { name: fileName, lastUpdated: new Date(timestamp) });
      }
    });
    return map;
  }

  function updateRegistrySheet(sheet, registry, schema) {
    sheet.clear(); // Clear the sheet to rewrite the entire registry
    const headers = schema.headers.split(',');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    
    if (registry.size > 0) {
      // Create an array of arrays from the map, matching the sheet columns
      const data = Array.from(registry, ([fileId, entry]) => {
        return [fileId, entry.name, entry.lastUpdated];
      });
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
    logger.info('OrchestratorService', 'updateRegistrySheet', 'SysFileRegistry updated.');
  }

  function getOrCreateFolder(parentFolder, folderName) {
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      return folders.next();
    }
    return parentFolder.createFolder(folderName);
  }

  // --- PHASE 2: JOB EXECUTION ---

  /**
   * Locked claim of the next PENDING job matching filterFn. Job-queue analog
   * of Bug 5's mutateSyncState -- re-reads fresh inside a short (5s) lock
   * hold, marks PROCESSING, releases. Reports contention rather than looping
   * internally (D1 point 1) -- callers own the bounded retry policy via
   * _claimNextPendingJobWithRetry below.
   * @param {Sheet} jobQueueSheet
   * @param {string[]} jobQueueHeaders
   * @param {function(object): boolean} filterFn - header-keyed row object -> claim it?
   * @returns {{claimed:true, jobId, jobType, jobQueueSheetRowNumber}|{claimed:false, contended:boolean}}
   */
  function _claimNextPendingJob(jobQueueSheet, jobQueueHeaders, filterFn) {
    const NOT_FOUND = { claimed: false, contended: false };
    const outcome = LockHelpers.withScriptLock('job-queue-claim', 5000, function() {
      if (jobQueueSheet.getLastRow() < 2) return NOT_FOUND;
      const statusColIdx = jobQueueHeaders.indexOf('status');
      const jobIdColIdx = jobQueueHeaders.indexOf('job_id');
      const jobTypeColIdx = jobQueueHeaders.indexOf('job_type');
      const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');
      const data = jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueHeaders.length).getValues();
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row[statusColIdx] !== 'PENDING') continue;
        const rowObj = {};
        jobQueueHeaders.forEach(function(h, idx) { rowObj[h] = row[idx]; });
        if (!filterFn(rowObj)) continue;
        const sheetRow = i + 2;
        const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');
        jobQueueSheet.getRange(sheetRow, statusColIdx + 1).setValue('PROCESSING');
        jobQueueSheet.getRange(sheetRow, processedTsColIdx + 1).setValue(new Date());
        // Clear any stale error_message from a prior attempt of this same row,
        // so a later failure handler can trust "non-empty" to mean "written
        // during this run" (2026-08-21 precedent, generalized to every claim).
        if (errorMsgColIdx !== -1) jobQueueSheet.getRange(sheetRow, errorMsgColIdx + 1).setValue('');
        SpreadsheetApp.flush();
        return { claimed: true, jobId: row[jobIdColIdx], jobType: row[jobTypeColIdx], jobQueueSheetRowNumber: sheetRow };
      }
      return NOT_FOUND;
    });
    return outcome === null ? { claimed: false, contended: true } : outcome;
  }

  /**
   * Bounded retry wrapper around _claimNextPendingJob -- up to 2 additional
   * attempts, ~3s apart, matching WooInventoryPushService's existing
   * auto-retry precedent. Persistent contention after that is treated as
   * "nothing claimable this run," not looped indefinitely.
   */
  function _claimNextPendingJobWithRetry(jobQueueSheet, jobQueueHeaders, filterFn) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = _claimNextPendingJob(jobQueueSheet, jobQueueHeaders, filterFn);
      if (result.claimed || !result.contended) return result;
      if (attempt < 3) Utilities.sleep(3000);
    }
    return { claimed: false, contended: true };
  }

  /**
   * Fresh scan for the job queue row currently matching jobId -- never a
   * remembered row number, per D1's governing rule (a job's row number is
   * only valid for the single write that claimed it; purgeOldJobs' unlocked
   * rewrite can shift every row after that).
   * @returns {{found:true, row:object, sheetRow:number}|{found:false}}
   */
  function _getJobRowByJobId(jobQueueSheet, jobQueueHeaders, jobId) {
    if (jobQueueSheet.getLastRow() < 2) return { found: false };
    const jobIdColIdx = jobQueueHeaders.indexOf('job_id');
    const data = jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueHeaders.length).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][jobIdColIdx] === jobId) {
        const rowObj = {};
        jobQueueHeaders.forEach(function(h, idx) { rowObj[h] = data[i][idx]; });
        return { found: true, row: rowObj, sheetRow: i + 2 };
      }
    }
    return { found: false };
  }

  /**
   * Same not-found retry as D1's read-side completeness check: purgeOldJobs'
   * clearContents()+setValues() rewrite is two separate calls, not atomic, so
   * an unlocked scan can land in the momentary gap and see the whole sheet
   * empty even though the row wasn't actually lost. One short retry resolves
   * this without pulling Stage C's locking forward.
   * @returns {{found:true, row:object, sheetRow:number}|{found:false}}
   */
  function _getJobRowByJobIdWithRetry(jobQueueSheet, jobQueueHeaders, jobId) {
    const first = _getJobRowByJobId(jobQueueSheet, jobQueueHeaders, jobId);
    if (first.found) return first;
    Utilities.sleep(1000);
    return _getJobRowByJobId(jobQueueSheet, jobQueueHeaders, jobId);
  }

  /**
   * Locked, job_id-keyed job-row mutation -- job-queue analog of Bug 5's
   * mutateSyncState. Re-reads the row fresh by job_id, calls fn(currentRow)
   * which returns the fields to write, or undefined/nothing to signal "my
   * precondition no longer holds, don't apply." Must-apply: retries up to 2x
   * (~3s apart) on lock contention, throws if still contended after that --
   * for a job processor's own terminal write, where losing it silently would
   * misreport a job that actually succeeded.
   * @param {function(object): (object|undefined)} fn - header-keyed row -> {header: value, ...} to write, or undefined to abort
   * @returns {{applied:boolean}}
   */
  function setJobRowStatus(jobQueueSheet, jobQueueHeaders, jobId, fn) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const outcome = LockHelpers.withScriptLock('job-queue-status:' + jobId, 5000, function() {
        const lookup = _getJobRowByJobId(jobQueueSheet, jobQueueHeaders, jobId);
        if (!lookup.found) return { applied: false };
        const updates = fn(lookup.row);
        if (!updates) return { applied: false };
        Object.keys(updates).forEach(function(header) {
          const colIdx = jobQueueHeaders.indexOf(header);
          if (colIdx === -1) return;
          jobQueueSheet.getRange(lookup.sheetRow, colIdx + 1).setValue(updates[header]);
        });
        SpreadsheetApp.flush();
        return { applied: true };
      });
      if (outcome !== null) return outcome;
      if (attempt < 3) Utilities.sleep(3000);
    }
    throw new Error(`Could not acquire job-queue lock for job ${jobId} after 3 attempts.`);
  }

  /**
   * Same fn contract as setJobRowStatus, but never throws: for opportunistic
   * sweeps (the zombie killer, _reapStuckJobInSession, Phase 2's unblock
   * step) where "someone else already handled this row" is a normal,
   * expected outcome, not a failure.
   * @returns {{applied:boolean}}
   */
  function setJobRowStatusBestEffort(jobQueueSheet, jobQueueHeaders, jobId, fn) {
    try {
      return setJobRowStatus(jobQueueSheet, jobQueueHeaders, jobId, fn);
    } catch (e) {
      logger.warn('OrchestratorService', 'setJobRowStatusBestEffort', `No-applying for job ${jobId}: ${e.message}`);
      return { applied: false };
    }
  }

  function processPendingJobs() {
    const serviceName = 'OrchestratorService';
    const functionName = 'processPendingJobs';
    logger.info(serviceName, functionName, 'Checking for pending jobs...');
    const allConfig = ConfigService.getAllConfig();
    
    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    if (!logSheetConfig || !logSheetConfig.id) {
      logger.error(serviceName, functionName, 'Log spreadsheet ID not found in configuration.');
      return;
    }

    const sheetNames = allConfig['system.sheet_names'];
    const jobQueueSheetName = sheetNames.SysJobQueue;

    const jobQueueSchema = allConfig['schema.log.SysJobQueue'];
    if (!jobQueueSchema || !jobQueueSchema.headers) {
        logger.error(serviceName, functionName, 'Job Queue schema not found in configuration.');
        return;
    }
    const jobQueueHeaders = jobQueueSchema.headers.split(',');

    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(jobQueueSheetName);
    
    if (!jobQueueSheet) {
        logger.error(serviceName, functionName, `Sheet '${jobQueueSheetName}' not found in log spreadsheet.`);
        return;
    }

    if (jobQueueSheet.getLastRow() < 2) {
        logger.info(serviceName, functionName, 'No jobs found in the queue.');
        logger.info(serviceName, functionName, 'Pending job check complete.');
        return;
    }

    let data = jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueHeaders.length).getValues();

    const jobIdColIdx = jobQueueHeaders.indexOf('job_id');
    const statusColIdx = jobQueueHeaders.indexOf('status');
    const jobTypeColIdx = jobQueueHeaders.indexOf('job_type');
    const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');
    const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');

    // --- Zombie Killer: Check for stuck PROCESSING jobs ---
    // Unlocked scan is fine for SELECTING candidates (a stale read just means
    // a stuck job is caught next run instead); the WRITE for each candidate
    // goes through the locked, job_id-keyed setJobRowStatusBestEffort so it
    // can never clobber a real completion recorded in the meantime.
    const fifteenMinutesAgo = new Date(new Date().getTime() - 15 * 60 * 1000);
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row[statusColIdx] === 'PROCESSING') {
            const processedTimestamp = new Date(row[processedTsColIdx]);
            if (!isNaN(processedTimestamp.getTime()) && processedTimestamp < fifteenMinutesAgo) {
                const jobId = row[jobIdColIdx];
                const jobType = row[jobTypeColIdx];
                const sessionId = row[jobQueueHeaders.indexOf('session_id')]; // Assuming sessionId is always present

                logger.error(serviceName, functionName, `Zombie Killer: Job ${jobId} (type: ${jobType}) was stuck in PROCESSING for over 15 minutes. Marking as FAILED.`, null, {
                    sessionId: sessionId,
                    jobId: jobId,
                    jobType: jobType,
                    stuckSince: processedTimestamp.toISOString()
                });

                const zombieResult = setJobRowStatusBestEffort(jobQueueSheet, jobQueueHeaders, jobId, function(currentRow) {
                  if (currentRow.status !== 'PROCESSING') return undefined; // someone already handled it
                  return {
                    status: 'FAILED',
                    error_message: 'Job stuck in PROCESSING state for too long (>15min).',
                    processed_timestamp: new Date()
                  };
                });

                // Only the execution that actually won the race notifies -- avoids
                // duplicate failure notifications for one underlying stuck job.
                if (zombieResult.applied) {
                  NotificationService.reportFailure(
                    `job.${jobType}`,
                    `Job stuck in PROCESSING for >15min (zombie killed)`,
                    'High',
                    { jobId: jobId, jobType: jobType, stuckSince: processedTimestamp.toISOString() },
                    sessionId
                  );
                }
            }
        }
    }
    // --- End Zombie Killer ---

    let jobsProcessedCount = 0;
    const MAX_JOBS_PER_RUN = 5; // Safety limit

    while (jobsProcessedCount < MAX_JOBS_PER_RUN) {
      const claim = _claimNextPendingJobWithRetry(jobQueueSheet, jobQueueHeaders, function() { return true; });
      if (!claim.claimed) break; // nothing left to claim, or persistent contention this run

      const jobId = claim.jobId;
      const jobType = claim.jobType;
      const jobQueueSheetRowNumber = claim.jobQueueSheetRowNumber;
      const jobConfig = allConfig[jobType];

      if (!jobConfig || !jobConfig.processing_service) {
        logger.error(serviceName, functionName, `No processing service configured for job type: ${jobType}. Setting job ${jobId} to FAILED.`, { jobId: jobId, jobType: jobType });
        setJobRowStatus(jobQueueSheet, jobQueueHeaders, jobId, function(currentRow) {
          if (currentRow.status !== 'PROCESSING') return undefined;
          return { status: 'FAILED', error_message: 'No processing service configured.' };
        });
        jobsProcessedCount++; // count as processed so we don't loop infinitely on the same bad job
        continue;
      }

      const processingServiceName = jobConfig.processing_service;
      logger.info(serviceName, functionName, `Delegating job ${jobId} of type '${jobType}' to service: ${processingServiceName}`, { jobId: jobId, jobType: jobType });

      // Create execution context to pass to the processing service. Re-read
      // fresh by job_id rather than trusting the row values from the claim
      // scan, which are already a moment stale by the time we get here.
      const jobRowLookup = _getJobRowByJobId(jobQueueSheet, jobQueueHeaders, jobId);
      const executionContext = {
          sessionId: jobRowLookup.found ? jobRowLookup.row['session_id'] : null,
          jobId: jobId,
          jobType: jobType,
          jobQueueSheetRowNumber: jobQueueSheetRowNumber, // legacy field; real-work functions must not use this for later reads -- see D1
          jobQueueHeaders: jobQueueHeaders // Pass headers for service to find column indices
      };

      try {
        switch (processingServiceName) {
          case 'ProductService':
            // Legacy routing - ProductService import jobs now handled by ProductImportService
            ProductImportService.processJob(executionContext);
            break;
          case 'ProductImportService':
            ProductImportService.processJob(executionContext);
            break;
          case 'OrderService':
            const orderServiceInstance = new OrderService(ProductService);
            orderServiceInstance.processJob(executionContext);
            break;
          case 'ValidationOrchestratorService':
            ValidationOrchestratorService.processJob(executionContext);
            break;
          case 'WooInventoryPushService':
            WooInventoryPushService.processJob(executionContext);
            break;
          default:
            throw new Error(`Unknown processing service: ${processingServiceName}`);
        }
        jobsProcessedCount++;
      } catch (e) {
        logger.error(serviceName, functionName, `Critical error in Orchestrator while delegating job ${jobId}: ${e.message}`, e, executionContext);
        // If service failed to update status, Orchestrator catches and sets FAILED
        setJobRowStatus(jobQueueSheet, jobQueueHeaders, jobId, function(currentRow) {
          if (currentRow.status !== 'PROCESSING') return undefined;
          return { status: 'FAILED', error_message: `Orchestrator delegation failed: ${e.message}` };
        });
        jobsProcessedCount++;
      }
    }

    if (jobsProcessedCount === 0) {
      logger.info(serviceName, functionName, 'No PENDING jobs found in the queue to process in this run.');
    } else {
      logger.info(serviceName, functionName, `Processed ${jobsProcessedCount} jobs in this run.`);
      // Check if any job completions should advance sync state
      _checkAndAdvanceSyncState();
    }
    SpreadsheetApp.flush(); // Ensure status updates are written
    logger.info(serviceName, functionName, 'Pending job check complete.');
  }


  function createPeriodicValidationJob(jobQueueSheet, allConfig) {
    const serviceName = 'OrchestratorService';
    const functionName = 'createPeriodicValidationJob';
    const jobQueueSchema = allConfig['schema.log.SysJobQueue'];
    const jobQueueHeaders = jobQueueSchema.headers.split(',');
    const jobTypeColIdx = jobQueueHeaders.indexOf('job_type');
    const statusColIdx = jobQueueHeaders.indexOf('status');

    if (jobQueueSheet.getLastRow() > 1) {
      const data = jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueHeaders.length).getValues();
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row[jobTypeColIdx] === 'periodic.validation.master' && (row[statusColIdx] === 'PENDING' || row[statusColIdx] === 'PROCESSING')) {
          logger.info(serviceName, functionName, 'Periodic validation job already pending or processing. Skipping creation.');
          return;
        }
      }
    }

    // Resolve session ID for the periodic validation job
    const jobConfig = allConfig['job.periodic.validation.master'];
    const sessionIdForNewJob = resolveSessionIdForJob('periodic.validation.master', jobConfig, allConfig);
    createJob(jobQueueSheet, 'periodic.validation.master', jobConfig.processing_service, '', 'PENDING', '', '', sessionIdForNewJob);
    logger.info(serviceName, functionName, 'Created new periodic validation job.');
  }

  function _createTaskIfNotOpen(taskTypeId, entityId, linkedEntityName, title, notes) {
    const serviceName = 'OrchestratorService';
    const functionName = '_createTaskIfNotOpen';
    try {
      if (!TaskService.hasOpenTasks(taskTypeId)) {
        logger.info(serviceName, functionName, `No open task of type '${taskTypeId}' found. Creating one.`);
        TaskService.createTask(taskTypeId, entityId, linkedEntityName, title, notes);
      } else {
        logger.info(serviceName, functionName, `An open task of type '${taskTypeId}' already exists. Skipping creation.`);
      }
    } catch (e) {
      logger.error(serviceName, functionName, `Error during task creation for type '${taskTypeId}': ${e.message}`, e);
    }
  }

  function _handleCompletedWebOrderImport(completedJobSessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = '_handleCompletedWebOrderImport';
    try {
      logger.info(serviceName, functionName, 'Handling completed web order import...', { sessionId: completedJobSessionId });
      const orderService = new OrderService(ProductService);
      const ordersToExportCount = orderService.getComaxExportOrderCount();

      if (ordersToExportCount > 0) {
        logger.info(serviceName, functionName, `${ordersToExportCount} orders are ready for Comax export. Creating task.`, { sessionId: completedJobSessionId });
        _createTaskIfNotOpen(
          'task.export.comax_orders_ready',
          'SYSTEM',
          'System',
          `Comax Export Ready: ${ordersToExportCount} Orders`,
          `The web order import has completed, and ${ordersToExportCount} orders are now ready for export to Comax.`
        );
      } else {
        logger.info(serviceName, functionName, 'No orders are currently ready for Comax export.', { sessionId: completedJobSessionId });
      }
    } catch (e) {
      logger.error(serviceName, functionName, `Error checking for pending Comax exports: ${e.message}`, e, { sessionId: completedJobSessionId });
    }
  }

  function _handleCompletedProductImport(completedJobSessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = '_handleCompletedProductImport';
    try {
      logger.info(serviceName, functionName, 'Handling completed product import, checking for pair...', { sessionId: completedJobSessionId });

      const allConfig = ConfigService.getAllConfig();
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (!jobQueueSheet || jobQueueSheet.getLastRow() < 2) {
        logger.info(serviceName, functionName, 'Job queue is empty, cannot check for pairs.', { sessionId: completedJobSessionId });
        return;
      }
      
      const data = jobQueueSheet.getDataRange().getValues();
      const headers = data.shift();
      const jobTypeCol = headers.indexOf('job_type');
      const statusCol = headers.indexOf('status');
      const processedTsCol = headers.indexOf('processed_timestamp');
      const sessionIdCol = headers.indexOf('session_id');

      let lastWebProdTimestamp, lastCmxProdTimestamp;

      for (const row of data) {
        const jobType = row[jobTypeCol];
        const status = row[statusCol];
        const timestamp = new Date(row[processedTsCol]);
        const jobSessionId = row[sessionIdCol];

        if (status === 'COMPLETED' && timestamp.getTime() && jobSessionId === completedJobSessionId) { // Only consider jobs from the same session
          if (jobType === 'import.drive.web_products_en') { // Corrected job type
            if (!lastWebProdTimestamp || timestamp > lastWebProdTimestamp) {
              lastWebProdTimestamp = timestamp;
            }
          } else if (jobType === 'import.drive.comax_products') {
            if (!lastCmxProdTimestamp || timestamp > lastCmxProdTimestamp) {
              lastCmxProdTimestamp = timestamp;
            }
          }
        }
      }

      if (lastWebProdTimestamp && lastCmxProdTimestamp) {
        // Here we still check the time difference, but ensure both completed in the same session.
        const timeDiffHours = Math.abs(lastWebProdTimestamp.getTime() - lastCmxProdTimestamp.getTime()) / 36e5;
        logger.info(serviceName, functionName, `Found last web prod at ${lastWebProdTimestamp.toLocaleString()} and last comax prod at ${lastCmxProdTimestamp.toLocaleString()} within session ${completedJobSessionId}. Time difference: ${timeDiffHours.toFixed(2)} hours.`, { sessionId: completedJobSessionId });
        
        if (timeDiffHours <= 2) { // 2-hour window to be considered a pair
          logger.info(serviceName, functionName, 'Product import pair confirmed. Creating web inventory export task.', { sessionId: completedJobSessionId });
          _createTaskIfNotOpen(
            'task.export.web_inventory_ready',
            'SYSTEM',
            'System',
            'Web Inventory Export Ready',
            'The Web and Comax product imports have both completed successfully. The web inventory export is now ready to be generated.'
          );
        } else {
          logger.info(serviceName, functionName, 'Product imports are not a recent pair within the same session. No task will be created.', { sessionId: completedJobSessionId });
        }
      } else {
        logger.info(serviceName, functionName, 'One or both product imports have not completed yet within the current session. Cannot form a pair.', { sessionId: completedJobSessionId });
      }

    } catch (e) {
      logger.error(serviceName, functionName, `Error during paired product import check: ${e.message}`, e, { sessionId: completedJobSessionId });
    }
  }

  function _recordFileInRegistry(originalFileId, originalFileName, originalFileLastUpdated) {
    const serviceName = 'OrchestratorService';
    const functionName = '_recordFileInRegistry';
    try {
      logger.info(serviceName, functionName, `Recording file in registry: ${originalFileName} (ID: ${originalFileId})`);
      const allConfig = ConfigService.getAllConfig();
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];

      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const fileRegistrySheet = logSpreadsheet.getSheetByName(sheetNames.SysFileRegistry);

      const registry = getRegistryMap(fileRegistrySheet);
      registry.set(originalFileId, { name: originalFileName, lastUpdated: new Date(originalFileLastUpdated) });
      
      updateRegistrySheet(fileRegistrySheet, registry, allConfig['schema.log.SysFileRegistry']);

    } catch (e) {
      logger.error(serviceName, functionName, `Failed to record file ${originalFileId} in registry: ${e.message}`, e);
      // Do not re-throw; we don't want this to crash the parent process.
    }
  }

  function finalizeJobCompletion(jobId) { // Keyed by job_id, not row number -- see D1's governing rule
    const serviceName = 'OrchestratorService';
    const functionName = 'finalizeJobCompletion';
    logger.info(serviceName, functionName, `Finalizing job completion for job ${jobId}.`);

    const allConfig = ConfigService.getAllConfig();
    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const sheetNames = allConfig['system.sheet_names'];
    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');

    // Single fresh lookup, reused by Phase 1 below instead of a second,
    // separate row-number-keyed read.
    const jobLookup = _getJobRowByJobIdWithRetry(jobQueueSheet, jobQueueHeaders, jobId);
    if (!jobLookup.found) {
        logger.error(serviceName, functionName, `Could not retrieve details for completed job ${jobId}.`);
        return;
    }
    const completedJobDetails = jobLookup.row;
    const completedJobType = completedJobDetails.job_type;
    const completedJobSessionId = completedJobDetails.session_id;

    // --- Phase 1: Record file in registry (or defer if sync session active) ---
    try {
      {
        const archiveFileId = completedJobDetails.archive_file_id;
        const originalFileId = completedJobDetails.original_file_id;
        const originalFileLastUpdated = completedJobDetails.original_file_last_updated;

        if (originalFileId && originalFileLastUpdated) {
          const archiveFile = DriveApp.getFileById(archiveFileId);
          const archiveFileName = archiveFile.getName();
          const originalFileName = archiveFileName.substring(0, archiveFileName.lastIndexOf('_'));

          // Cheap unlocked pre-check to skip the lock entirely for the common case
          // (a job completing outside any active sync session) -- register
          // immediately doesn't touch sync state, so no race exists on that path.
          const preCheckState = SyncStateService.getSyncState();
          const looksLikeSyncSession = preCheckState.sessionId && completedJobSessionId === preCheckState.sessionId &&
                                preCheckState.stage !== 'IDLE' && preCheckState.stage !== 'COMPLETE';

          if (!looksLikeSyncSession) {
            _recordFileInRegistry(originalFileId, originalFileName, originalFileLastUpdated);
          } else {
            // Re-verify fresh inside the lock -- the session could have started
            // or ended between the pre-check above and now. Non-stage-changing
            // write (only touches archiveFileIds/lastUpdated) -- best-effort.
            const applyResult = SyncStateService.mutateSyncStateBestEffort(function(state) {
              const isSyncSession = state.sessionId && completedJobSessionId === state.sessionId &&
                                    state.stage !== 'IDLE' && state.stage !== 'COMPLETE';
              if (!isSyncSession) {
                throw new SyncStateService.SyncStageStaleError('Sync session ended before this deferred write could apply.', state);
              }
              if (!state.archiveFileIds) state.archiveFileIds = {};
              state.archiveFileIds[completedJobType] = {
                originalFileId: originalFileId,
                originalFileName: originalFileName,
                originalFileLastUpdated: originalFileLastUpdated,
                archiveFileId: archiveFileId
              };
              state.lastUpdated = new Date().toISOString();
            });

            if (applyResult.applied) {
              logger.info(serviceName, functionName, `Deferred file registration for ${originalFileName} (sync session active).`);
            } else {
              // Session ended (or lock contention) between the pre-check and the
              // locked write -- register immediately as a safe fallback rather
              // than silently lose it.
              _recordFileInRegistry(originalFileId, originalFileName, originalFileLastUpdated);
            }
          }
        }
      }
    } catch(e) {
      logger.error(serviceName, functionName, `Error during file registry/cleanup phase: ${e.message}`, e, { sessionId: completedJobSessionId, jobType: completedJobType });
    }
    
    // --- Phase 2: Unblock dependent jobs in the queue ---
    // Dead-by-code-path today (grep-confirmed: nothing ever writes 'BLOCKED'),
    // but the guard below handles a real BLOCKED row correctly regardless of
    // how it got there -- migrated for consistency, per D1.
    try {
      if (jobQueueSheet.getLastRow() > 1) {
        const data = jobQueueSheet.getDataRange().getValues();
        const headers = data.shift();
        const jobIdCol = headers.indexOf('job_id');
        const jobTypeCol = headers.indexOf('job_type');
        const statusCol = headers.indexOf('status');
        const sessionIdCol = headers.indexOf('session_id');

        data.forEach((row) => {
          if (row[statusCol] === 'BLOCKED') {
            const blockedJobId = row[jobIdCol];
            const blockedJobType = row[jobTypeCol];
            const blockedJobConfig = allConfig[blockedJobType];
            const blockedJobSessionId = row[sessionIdCol];

            if (blockedJobConfig && blockedJobConfig.depends_on === completedJobType && blockedJobSessionId === completedJobSessionId) {
              const unblockResult = setJobRowStatusBestEffort(jobQueueSheet, jobQueueHeaders, blockedJobId, function(currentRow) {
                if (currentRow.status !== 'BLOCKED') return undefined; // already unblocked/handled
                return { status: 'PENDING' };
              });
              if (unblockResult.applied) {
                logger.info(serviceName, functionName, `Unblocked job ${blockedJobId} (type: ${blockedJobType}, Session: ${blockedJobSessionId}) because its dependency '${completedJobType}' was completed in the same session.`, { sessionId: completedJobSessionId, unblockedJobId: blockedJobId, unblockedJobType: blockedJobType });
              }
            }
          }
        });
      }
    } catch(e) {
      logger.error(serviceName, functionName, `Error during job unblocking phase: ${e.message}`, e, { sessionId: completedJobSessionId, jobType: completedJobType });
    }

    // --- Phase 3: Immediately process any newly unblocked jobs ---
    try {
      logger.info(serviceName, functionName, 'Checking for newly unblocked jobs to process.');
      processPendingJobs(); // This call needs to be session-aware in the next step
    } catch (e) {
      logger.error(serviceName, functionName, `Error during immediate processing of unblocked jobs: ${e.message}`, e, { sessionId: completedJobSessionId, jobType: completedJobType });
    }

    // --- Phase 4: Fire state-based triggers ---
    try {
      switch (completedJobType) {
        case 'import.drive.web_orders':
          _handleCompletedWebOrderImport(completedJobSessionId); // Pass session ID
          break;
        case 'import.drive.web_products_en':
        case 'import.drive.comax_products':
          _handleCompletedProductImport(completedJobSessionId); // Pass session ID
          break;
        default:
          logger.info(serviceName, functionName, `No specific state-based triggers to run for completed job type: '${completedJobType}'.`, { sessionId: completedJobSessionId, jobType: completedJobType });
          break;
      }
    } catch(e) {
      logger.error(serviceName, functionName, `Error during state-based trigger phase: ${e.message}`, e, { sessionId: completedJobSessionId, jobType: completedJobType });
    }
  }

  /**
   * Helper function to get job details by row number
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The job queue sheet
   * @param {number} rowNumber The 1-based row number
   * @param {string[]} jobQueueHeaders Array of headers
   * @returns {object|null} An object with job details or null if not found
   */
  function getJobDetailsByRow(sheet, rowNumber, jobQueueHeaders) {
      if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
          return null;
      }
      const row = sheet.getRange(rowNumber, 1, 1, jobQueueHeaders.length).getValues()[0];
      const jobDetails = {};
      jobQueueHeaders.forEach((header, index) => {
          jobDetails[header] = row[index];
      });
      return jobDetails;
  }

  /**
   * Retrieves the timestamp of the last successful job of a specific type.
   * @param {string} jobType The type of job to check.
   * @param {string} [sessionId=null] Optional session ID to filter by.
   * @returns {Date|null} The timestamp of the last success, or null if not found.
   */
  function getLastJobSuccess(jobType, sessionId = null) {
    const serviceName = 'OrchestratorService';
    const functionName = 'getLastJobSuccess';
    try {
      const allConfig = ConfigService.getAllConfig();
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (!jobQueueSheet || jobQueueSheet.getLastRow() < 2) {
        return null;
      }

      const data = jobQueueSheet.getDataRange().getValues();
      const headers = data.shift();
      const jobTypeCol = headers.indexOf('job_type');
      const statusCol = headers.indexOf('status');
      const processedTsCol = headers.indexOf('processed_timestamp');
      const sessionIdCol = headers.indexOf('session_id'); // New index

      let lastSuccess = null;

      for (const row of data) {
        // Filter by session ID if provided
        if ((sessionId === null || row[sessionIdCol] === sessionId) &&
            row[jobTypeCol] === jobType &&
            row[statusCol] === 'COMPLETED') {
          const timestamp = new Date(row[processedTsCol]);
          if (!isNaN(timestamp.getTime())) {
             if (!lastSuccess || timestamp > lastSuccess) {
               lastSuccess = timestamp;
             }
          }
        }
      }
      return lastSuccess;

    } catch (e) {
      logger.error(serviceName, functionName, `Error checking last job success for ${jobType}: ${e.message}`, e, { jobType: jobType, sessionId: sessionId });
      return null;
    }
  }

  /**
   * Checks if a job of a specific type is currently pending or processing.
   * @param {string} jobType The type of job to check.
   * @param {string} [sessionId=null] Optional session ID to filter by.
   * @returns {boolean} True if such a job exists, false otherwise.
   */
  function getPendingOrProcessingJob(jobType, sessionId = null) {
    const serviceName = 'OrchestratorService';
    const functionName = 'getPendingOrProcessingJob';
    try {
      const allConfig = ConfigService.getAllConfig();
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (!jobQueueSheet || jobQueueSheet.getLastRow() < 2) {
        return false;
      }

      const data = jobQueueSheet.getDataRange().getValues();
      const headers = data.shift();
      const jobTypeCol = headers.indexOf('job_type');
      const statusCol = headers.indexOf('status');
      const sessionIdCol = headers.indexOf('session_id'); // New index

      for (const row of data) {
        // Filter by session ID if provided
        if ((sessionId === null || row[sessionIdCol] === sessionId) &&
            row[jobTypeCol] === jobType) {
          if (row[statusCol] === 'PENDING' || row[statusCol] === 'PROCESSING') {
            return true;
          }
        }
      }
      return false;

    } catch (e) {
      logger.error(serviceName, functionName, `Error checking pending job for ${jobType}: ${e.message}`, e, { jobType: jobType, sessionId: sessionId });
      return false;
    }
  }

  /**
   * Inline reaper for jobs stuck in PROCESSING. The full zombie killer in
   * processPendingJobs (line ~567) only fires when the hourly trigger runs,
   * so a stuck job can leave the sync state machine paused for up to an hour.
   * This helper runs on every poll-driven _checkAndAdvanceSyncState and reaps
   * its specific (jobType, sessionId) so the FAILED branch picks it up next.
   *
   * Threshold is tighter than the hourly zombie killer (8 min vs 15 min)
   * because Apps Script's hard execution limit is 6 min — any job stuck
   * longer than 8 is dead by definition.
   */
  function _reapStuckJobInSession(jobType, sessionId, thresholdMinutes) {
    const serviceName = 'OrchestratorService';
    const functionName = '_reapStuckJobInSession';
    try {
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (!jobQueueSheet || jobQueueSheet.getLastRow() < 2) {
        return false;
      }

      const data = jobQueueSheet.getDataRange().getValues();
      const headers = data[0];
      const jobIdCol      = headers.indexOf('job_id');
      const jobTypeCol    = headers.indexOf('job_type');
      const statusCol     = headers.indexOf('status');
      const sessionIdCol  = headers.indexOf('session_id');
      const processedTsCol = headers.indexOf('processed_timestamp');
      const errorMsgCol   = headers.indexOf('error_message');

      const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[sessionIdCol] !== sessionId) continue;
        if (row[jobTypeCol] !== jobType) continue;
        if (row[statusCol] !== 'PROCESSING') continue;

        const processedTs = new Date(row[processedTsCol]);
        if (isNaN(processedTs.getTime()) || processedTs >= cutoff) continue;

        const jobId = row[jobIdCol];

        logger.error(serviceName, functionName, `Reaping stuck job ${jobId} (type: ${jobType}) in session ${sessionId}. Stuck since ${processedTs.toISOString()} (>${thresholdMinutes}min).`, null, {
          sessionId: sessionId,
          jobId: jobId,
          jobType: jobType,
          stuckSince: processedTs.toISOString(),
          thresholdMinutes: thresholdMinutes
        });

        const reapResult = setJobRowStatusBestEffort(jobQueueSheet, headers, jobId, function(currentRow) {
          if (currentRow.status !== 'PROCESSING') return undefined; // someone already handled it
          return {
            status: 'FAILED',
            error_message: `Job stuck in PROCESSING for >${thresholdMinutes}min (reaped on poll).`,
            processed_timestamp: new Date()
          };
        });

        if (reapResult.applied) {
          NotificationService.reportFailure(
            `job.${jobType}`,
            `Job stuck in PROCESSING for >${thresholdMinutes}min (reaped on poll)`,
            'High',
            { jobId: jobId, jobType: jobType, stuckSince: processedTs.toISOString() },
            sessionId
          );
        }

        return reapResult.applied;
      }
      return false;

    } catch (e) {
      logger.error(serviceName, functionName, `Error reaping stuck job: ${e.message}`, e, { jobType: jobType, sessionId: sessionId });
      return false;
    }
  }

  function _checkAndAdvanceSyncState() {
    const serviceName = 'OrchestratorService';
    const functionName = '_checkAndAdvanceSyncState';

    // Threshold for the inline stuck-job reaper. Apps Script hard limit is
    // 6 min, so 8 leaves a small buffer for clock skew while still catching
    // stuck jobs much faster than the hourly zombie killer.
    const STUCK_JOB_THRESHOLD_MIN = 8;

    try {
      const state = SyncStateService.getSyncState();
      if (!state || !state.sessionId || state.stage === 'IDLE' || state.stage === 'COMPLETE' || state.stage === 'FAILED') {
        return; // Nothing to do
      }

      // --- IMPORTING_COMAX -> VALIDATING ---
      // All three branches below use mutateSyncStateBestEffort with their own
      // idempotency re-check (no-op if this session already advanced past the
      // target stage) -- this is what stops Bug 5's duplicate "Advancing to..."
      // log line when multiple concurrent pollers observe the same terminal job
      // status. Every side effect (not just NotificationService.reportFailure)
      // fires only when the write's result has applied:true, since only the
      // execution that actually won the race should notify/advance downstream.
      if (state.stage === 'IMPORTING_COMAX') {
          const jobType = 'import.drive.comax_products';
          _reapStuckJobInSession(jobType, state.sessionId, STUCK_JOB_THRESHOLD_MIN);
          const jobStatus = getJobStatusInSession(jobType, state.sessionId);
          const sessionId = state.sessionId;

          if (jobStatus === 'COMPLETED') {
              const advanceResult = SyncStateService.mutateSyncStateBestEffort(function(s) {
                if (s.stage !== 'IMPORTING_COMAX') {
                  throw new SyncStateService.SyncStageStaleError('Already advanced past IMPORTING_COMAX.', s);
                }
                s.stage = 'VALIDATING';
                s.lastUpdated = new Date().toISOString();
                s.errorMessage = null;
                if (!s.steps) s.steps = {};
                s.steps.step4 = { status: 'completed', message: 'Comax product data imported successfully' };
              });

              if (advanceResult.applied) {
                logger.info(serviceName, functionName, `Comax import completed for session ${sessionId}. Advancing to VALIDATING.`);
                // Queue validation job and process immediately
                finalizeSync(sessionId);
                processPendingJobs();
              }

          } else if (jobStatus === 'FAILED' || jobStatus === 'QUARANTINED') {
              const failResult = SyncStateService.mutateSyncStateBestEffort(function(s) {
                if (s.stage !== 'IMPORTING_COMAX') {
                  throw new SyncStateService.SyncStageStaleError('Already advanced past IMPORTING_COMAX.', s);
                }
                s.stage = 'FAILED';
                s.failedAtStage = 'IMPORTING_COMAX';
                s.errorMessage = `Comax import job failed. Status: ${jobStatus}`;
                s.lastUpdated = new Date().toISOString();
                if (!s.steps) s.steps = {};
                s.steps.step4 = { status: 'failed', message: `Import failed: ${jobStatus}` };
              });

              if (failResult.applied) {
                logger.error(serviceName, functionName, `Comax import failed for session ${sessionId}.`);
                NotificationService.reportFailure(
                  'sync.comax_product_import',
                  `Comax import failed: ${jobStatus}`,
                  jobStatus === 'QUARANTINED' ? 'Critical' : 'High',
                  { sessionId: sessionId, jobStatus: jobStatus },
                  sessionId
                );
              }
          }
      }

      // --- VALIDATING -> WAITING_WEB_EXPORT ---
      if (state.stage === 'VALIDATING') {
        const jobType = 'job.periodic.validation.master';
        _reapStuckJobInSession(jobType, state.sessionId, STUCK_JOB_THRESHOLD_MIN);
        const jobStatus = getJobStatusInSession(jobType, state.sessionId);
        const sessionId = state.sessionId;

        if (jobStatus === 'FAILED' || jobStatus === 'QUARANTINED') {
           const failResult = SyncStateService.mutateSyncStateBestEffort(function(s) {
             if (s.stage !== 'VALIDATING') {
               throw new SyncStateService.SyncStageStaleError('Already advanced past VALIDATING.', s);
             }
             s.stage = 'FAILED';
             s.failedAtStage = 'VALIDATING';
             s.errorMessage = `Master Validation job failed. Status: ${jobStatus}`;
             s.lastUpdated = new Date().toISOString();
           });

           if (failResult.applied) {
             logger.error(serviceName, functionName, `Validation failed for session ${sessionId}.`);
             NotificationService.reportFailure(
               'validation.master_master',
               `Master Validation failed: ${jobStatus}`,
               'High',
               { sessionId: sessionId },
               sessionId
             );
           }
        } else if (jobStatus === 'COMPLETED') {
           const advanceResult = SyncStateService.mutateSyncStateBestEffort(function(s) {
             if (s.stage !== 'VALIDATING') {
               throw new SyncStateService.SyncStageStaleError('Already advanced past VALIDATING.', s);
             }
             s.stage = 'WAITING_WEB_EXPORT';
             s.lastUpdated = new Date().toISOString();
             s.errorMessage = null;
             if (!s.steps) s.steps = {};
             s.steps.step5 = { status: 'waiting', message: 'Ready to generate web inventory export' };
           });

           if (advanceResult.applied) {
             logger.info(serviceName, functionName, `Validation completed for session ${sessionId}. Advancing to WAITING_WEB_EXPORT.`);
           }
        }
      }

      // Note: WAITING_WEB_EXPORT → WAITING_WEB_CONFIRM (or COMPLETE on no-changes)
      // is handled synchronously by WebAppSync.generateWebExportBackend, not here.

      // --- PUSHING_WEB_INVENTORY -> COMPLETE (or FAILED) ---
      if (state.stage === 'PUSHING_WEB_INVENTORY') {
          const jobType = 'export.web.inventory.api';
          _reapStuckJobInSession(jobType, state.sessionId, STUCK_JOB_THRESHOLD_MIN);
          const jobStatus = getJobStatusInSession(jobType, state.sessionId);
          const sessionId = state.sessionId;

          if (jobStatus === 'COMPLETED') {
              const advanceResult = SyncStateService.mutateSyncStateBestEffort(function(s) {
                if (s.stage !== 'PUSHING_WEB_INVENTORY') {
                  throw new SyncStateService.SyncStageStaleError('Already advanced past PUSHING_WEB_INVENTORY.', s);
                }
                if (!s.steps) s.steps = {};
                s.stage = 'COMPLETE';
                s.steps.step5 = { status: 'completed', message: 'Inventory pushed via API' };
                s.lastUpdated = new Date().toISOString();
                s.errorMessage = null;
              });

              if (advanceResult.applied) {
                try {
                  TaskService.completeTaskByTypeAndEntity('task.sync.daily_session', sessionId);
                } catch (taskError) {
                  logger.warn(serviceName, functionName, `Could not complete sync session task: ${taskError.message}`);
                }

                // Close the manual-confirm signal task (same task type the manual path closes)
                try {
                  const confirmTasks = WebAppTasks.getOpenTasksByTypeId('task.confirmation.web_inventory_export');
                  if (confirmTasks && confirmTasks.length > 0) {
                    confirmTasks.forEach(function(task) {
                      TaskService.completeTask(task.st_TaskId);
                    });
                  }
                } catch (taskError) {
                  logger.warn(serviceName, functionName, `Could not complete web inventory confirmation task: ${taskError.message}`);
                }

                // Register the CSV file for audit (same as the no-changes auto-complete path)
                _registerSessionFilesFromOrchestrator(advanceResult.state);
              }

          } else if (jobStatus === 'FAILED' || jobStatus === 'QUARANTINED') {
              // Prefer the job's own recorded reason (e.g. WooInventoryPushService's
              // per-SKU detail) over a generic status string -- same fix as the
              // 2026-08-21 Comax-import error-clobbering fix.
              const jobErrorMessage = getJobErrorMessageInSession(jobType, sessionId);
              const reason = jobErrorMessage || `Status: ${jobStatus}`;

              const failResult = SyncStateService.mutateSyncStateBestEffort(function(s) {
                if (s.stage !== 'PUSHING_WEB_INVENTORY') {
                  throw new SyncStateService.SyncStageStaleError('Already advanced past PUSHING_WEB_INVENTORY.', s);
                }
                s.stage = 'FAILED';
                s.failedAtStage = 'PUSHING_WEB_INVENTORY';
                s.errorMessage = `Inventory API push job failed. ${reason}`;
                s.lastUpdated = new Date().toISOString();
                if (!s.steps) s.steps = {};
                s.steps.step5 = { status: 'failed', message: `Push failed: ${reason}` };
              });

              if (failResult.applied) {
                logger.error(serviceName, functionName, `Inventory API push failed for session ${sessionId}: ${reason}`);
                NotificationService.reportFailure(
                  'sync.web_inventory_push',
                  `Inventory API push failed: ${jobStatus}`,
                  jobStatus === 'QUARANTINED' ? 'Critical' : 'High',
                  { sessionId: sessionId, jobStatus: jobStatus, reason: reason },
                  sessionId
                );
              }
          }
      }

    } catch (e) {
      logger.error(serviceName, functionName, `Error checking sync state: ${e.message}`, e);
    }
  }

  /**
   * Helper: register session files from orchestrator context.
   * Mirrors _registerSessionFiles in WebAppSync.js for the auto-complete path.
   */
  function _registerSessionFilesFromOrchestrator(state) {
    const serviceName = 'OrchestratorService';
    const functionName = '_registerSessionFilesFromOrchestrator';

    if (!state.archiveFileIds || Object.keys(state.archiveFileIds).length === 0) {
      return;
    }

    try {
      const allConfig = ConfigService.getAllConfig();
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const fileRegistrySheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysFileRegistry);
      const registry = getRegistryMap(fileRegistrySheet);

      for (const configName in state.archiveFileIds) {
        const fileInfo = state.archiveFileIds[configName];
        if (fileInfo && fileInfo.originalFileId && fileInfo.originalFileLastUpdated) {
          registry.set(fileInfo.originalFileId, {
            name: fileInfo.originalFileName || configName,
            lastUpdated: new Date(fileInfo.originalFileLastUpdated)
          });
        }
      }

      updateRegistrySheet(fileRegistrySheet, registry, allConfig['schema.log.SysFileRegistry']);
      logger.info(serviceName, functionName, `Registered ${Object.keys(state.archiveFileIds).length} files.`);
    } catch (e) {
      logger.error(serviceName, functionName, `Error registering session files: ${e.message}`, e);
    }
  }

  // Note: getPendingOrProcessingJob is defined above (lines ~969-1004). Duplicate removed.

  /**
   * Shared scan: latest (status, error_message) per job type for a session,
   * by processed/created timestamp. getJobStatusesBatch and
   * getJobErrorMessageInSession both read off this single pass so the two
   * never disagree on which row is "latest".
   */
  function _getJobInfoBatch(jobTypes, sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = '_getJobInfoBatch';
    const latestInfo = {};
    jobTypes.forEach(jt => latestInfo[jt] = { status: 'NOT_FOUND', errorMessage: '', timestamp: new Date(0), foundFinal: false });

    try {
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (!jobQueueSheet || jobQueueSheet.getLastRow() < 2) {
        return latestInfo;
      }

      const data = jobQueueSheet.getDataRange().getValues();
      const headers = data.shift();
      const jobTypeCol = headers.indexOf('job_type');
      const statusCol = headers.indexOf('status');
      const sessionIdCol = headers.indexOf('session_id');
      const processedTsCol = headers.indexOf('processed_timestamp');
      const createdTsCol = headers.indexOf('created_timestamp');
      const errorMsgCol = headers.indexOf('error_message');

      for (const row of data) {
        const rowJobType = row[jobTypeCol];
        const rowSessionId = row[sessionIdCol];

        if (jobTypes.includes(rowJobType) && rowSessionId === sessionId) {
          let effectiveTimestamp = new Date(row[processedTsCol]);
          if (isNaN(effectiveTimestamp.getTime())) {
            effectiveTimestamp = new Date(row[createdTsCol]);
          }
          if (isNaN(effectiveTimestamp.getTime())) continue;

          const currentStatus = row[statusCol];
          const currentErrorMessage = errorMsgCol >= 0 ? row[errorMsgCol] : '';
          const info = latestInfo[rowJobType];

          const isFinal = currentStatus === 'COMPLETED' || currentStatus === 'FAILED' || currentStatus === 'QUARANTINED';
          if (isFinal) {
            if (!info.foundFinal || effectiveTimestamp >= info.timestamp) {
              info.status = currentStatus;
              info.errorMessage = currentErrorMessage;
              info.timestamp = effectiveTimestamp;
              info.foundFinal = true;
            }
          } else if (!info.foundFinal && effectiveTimestamp >= info.timestamp) {
            info.status = currentStatus;
            info.errorMessage = currentErrorMessage;
            info.timestamp = effectiveTimestamp;
          }
        }
      }

      return latestInfo;

    } catch (e) {
      logger.error(serviceName, functionName, `Error scanning job info: ${e.message}`, e, { sessionId });
      return latestInfo;
    }
  }

  /**
   * Gets statuses for multiple job types in a session with a single sheet read.
   * @param {Array<string>} jobTypes - Array of job type strings to check
   * @param {string} sessionId - The session ID to filter by
   * @returns {Object} Map of jobType -> status
   */
  function getJobStatusesBatch(jobTypes, sessionId) {
    const info = _getJobInfoBatch(jobTypes, sessionId);
    const results = {};
    jobTypes.forEach(jt => results[jt] = info[jt].status);
    return results;
  }

  /**
   * Retrieves the most recent status of a specific job type within a given session.
   * @param {string} jobType The type of job to check.
   * @param {string} sessionId The session ID to filter by.
   * @returns {string} The status ('PENDING', 'PROCESSING', 'COMPLETED', 'QUARANTINED', 'FAILED', 'NOT_FOUND').
   */
  function getJobStatusInSession(jobType, sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'getJobStatusInSession';
    try {
      // Use batch function for single job (maintains compatibility)
      const results = getJobStatusesBatch([jobType], sessionId);
      return results[jobType];

    } catch (e) {
      logger.error(serviceName, functionName, `Error getting job status for ${jobType} in session ${sessionId}: ${e.message}`, e, { jobType: jobType, sessionId: sessionId });
      return 'ERROR'; // Indicate an error occurred
    }
  }

  /**
   * The latest job's own error_message for a (jobType, sessionId) pair --
   * e.g. WooInventoryPushService's "Pushed 2/4 products; 2 failed... SKU X:
   * reason" -- so callers can surface the real reason instead of a generic
   * "Status: FAILED" string (2026-08-25, same class of fix as the
   * Comax-import error-clobbering fix on 2026-08-21).
   */
  function getJobErrorMessageInSession(jobType, sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'getJobErrorMessageInSession';
    try {
      const info = _getJobInfoBatch([jobType], sessionId);
      return info[jobType].errorMessage || '';
    } catch (e) {
      logger.error(serviceName, functionName, `Error getting job error message for ${jobType} in session ${sessionId}: ${e.message}`, e, { jobType: jobType, sessionId: sessionId });
      return '';
    }
  }

  /**
   * Counts the number of specific file types in the designated invoice folder, ignoring shortcuts.
   * Replicates logic from legacy AdminWorkflow.js.
   * @returns {number} The count of relevant files in the folder.
   */
  function getInvoiceFileCount() {
    const serviceName = 'OrchestratorService';
    const functionName = 'getInvoiceFileCount';
    try {
      const allConfig = ConfigService.getAllConfig();
      if (!allConfig) {
        logger.warn(serviceName, functionName, 'Configuration not available. Run rebuildSysConfigFromSource.');
        return 0;
      }
      const invoiceFolderConfig = allConfig['system.folder.invoices'];

      if (!invoiceFolderConfig || !invoiceFolderConfig.id) {
        logger.warn(serviceName, functionName, 'Invoice folder ID not found in configuration.');
        return 0;
      }

      const folder = DriveApp.getFolderById(invoiceFolderConfig.id);
      const files = folder.getFiles();
      let count = 0;

      const allowedMimeTypes = [
          // Documents
          MimeType.GOOGLE_DOCS,
          MimeType.MICROSOFT_WORD,
          MimeType.PDF,
          // Spreadsheets
          MimeType.GOOGLE_SHEETS,
          MimeType.MICROSOFT_EXCEL,
          // Images
          MimeType.BMP,
          MimeType.GIF,
          MimeType.JPEG,
          MimeType.PNG
      ];

      while (files.hasNext()) {
          const file = files.next();
          const mimeType = file.getMimeType();

          // Skip shortcuts entirely
          if (mimeType === MimeType.SHORTCUT) {
              continue;
          }

          // Check if the file is one of the allowed types
          if (allowedMimeTypes.includes(mimeType)) {
              count++;
          }
      }
      return count;
    } catch (e) {
      logger.error(serviceName, functionName, `Error counting invoice files: ${e.message}`, e);
      return 0;
    }
  }

  // --- NEW SYNC V2 HELPERS ---

  /**
   * Queues only web products import (translations + products, no orders).
   * Translations are queued first as they may be needed for product display.
   * @param {string} sessionId - The sync session ID
   */
  function queueWebProductsImport(sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'queueWebProductsImport';
    logger.info(serviceName, functionName, `Queuing web products for Session: ${sessionId}`);
    const allConfig = ConfigService.getAllConfig();

    // Queue translations first (if changed), then products
    const importConfigs = [
      'import.drive.web_translations_he',
      'import.drive.web_products_en'
    ];

    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysJobQueue);
    const fileRegistrySheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysFileRegistry);
    const archiveFolder = DriveApp.getFolderById(allConfig['system.folder.archive'].id);
    const registry = getRegistryMap(fileRegistrySheet);

    importConfigs.forEach(configName => {
      const config = allConfig[configName];
      if (!config || !config.source_folder_id || !config.file_pattern) {
        logger.warn(serviceName, functionName, `Configuration for '${configName}' is incomplete. Skipping.`);
        return;
      }

      const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
      const files = getFilesByPattern(sourceFolder, config.file_pattern);

      // Find latest file
      let latestFile = null;
      let latestDate = new Date(0);
      while (files.hasNext()) {
        const file = files.next();
        if (file.getLastUpdated() > latestDate) {
          latestFile = file;
          latestDate = file.getLastUpdated();
        }
      }

      if (latestFile) {
        // Translation freshness check: only import if file has changed
        if (configName === 'import.drive.web_translations_he') {
          if (!isNewFile(latestFile, registry)) {
            logger.info(serviceName, functionName, 'Translations file unchanged since last import. Skipping.', { sessionId });
            return; // Skip to next config
          }
        }

        const archivedFile = archiveFile(latestFile, archiveFolder);
        createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId(), 'PENDING', latestFile.getId(), latestFile.getLastUpdated(), sessionId);
        logger.info(serviceName, functionName, `Queued ${configName} for session ${sessionId}`);
      } else {
        logger.warn(serviceName, functionName, `No file found for ${configName}`);
      }
    });

    SpreadsheetApp.flush();
  }

  /**
   * Queues only web orders import.
   * @param {string} sessionId - The sync session ID
   */
  function queueWebOrdersImport(sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'queueWebOrdersImport';
    logger.info(serviceName, functionName, `Queuing web orders for Session: ${sessionId}`);
    const allConfig = ConfigService.getAllConfig();

    const configName = 'import.drive.web_orders';
    const config = allConfig[configName];

    if (!config || !config.source_folder_id || !config.file_pattern) {
      throw new Error(`Configuration for '${configName}' is incomplete or missing.`);
    }

    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysJobQueue);
    const archiveFolder = DriveApp.getFolderById(allConfig['system.folder.archive'].id);

    const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
    const files = getFilesByPattern(sourceFolder, config.file_pattern);

    // Find latest file
    let latestFile = null;
    let latestDate = new Date(0);
    while (files.hasNext()) {
      const file = files.next();
      if (file.getLastUpdated() > latestDate) {
        latestFile = file;
        latestDate = file.getLastUpdated();
      }
    }

    if (latestFile) {
      const archivedFile = archiveFile(latestFile, archiveFolder);
      createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId(), 'PENDING', latestFile.getId(), latestFile.getLastUpdated(), sessionId);
      logger.info(serviceName, functionName, `Queued orders for session ${sessionId}`);
    } else {
      throw new Error('No web orders file found in import folder');
    }

    SpreadsheetApp.flush();
  }

  /**
   * Gets the file registry as a Map for freshness checking.
   * @returns {Map} Map of fileId -> { name, lastUpdated }
   */
  function getFileRegistry() {
    const allConfig = ConfigService.getAllConfig();
    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const fileRegistrySheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysFileRegistry);
    return getRegistryMap(fileRegistrySheet);
  }

      return {
      run: run,
      finalizeJobCompletion: finalizeJobCompletion,
      getLastJobSuccess: getLastJobSuccess,
      getPendingOrProcessingJob: getPendingOrProcessingJob,
      getInvoiceFileCount: getInvoiceFileCount,
      queueWebFilesForSync: queueWebFilesForSync,
      queueComaxFileForSync: queueComaxFileForSync,
      finalizeSync: finalizeSync,
      queueWebInventoryPush: queueWebInventoryPush,
      getJobStatusInSession: getJobStatusInSession,
      generateSessionId: generateSessionId,
      triggerWebOrderFileProcessing: triggerWebOrderFileProcessing,
      processPendingJobs: processPendingJobs,
      checkAndAdvanceSyncState: _checkAndAdvanceSyncState,
      // New v2 helpers
      queueWebProductsImport: queueWebProductsImport,
      queueWebOrdersImport: queueWebOrdersImport,
      getFileRegistry: getFileRegistry,
      isNewFile: isNewFile,
      getFilesByPattern: getFilesByPattern,
      processSessionJobs: processSessionJobs,
      // D1: job-queue locking primitives, for job-processor services' own
      // terminal writes and real-work functions' archive_file_id lookups.
      setJobRowStatus: setJobRowStatus,
      setJobRowStatusBestEffort: setJobRowStatusBestEffort,
      getJobRowByJobId: _getJobRowByJobId,
      getJobRowByJobIdWithRetry: _getJobRowByJobIdWithRetry
    };

  /**
   * Processes jobs for a specific session, stopping on first failure.
   * Used for user-driven imports (not the hourly automated flow).
   * @param {string} sessionId - The session ID to process jobs for
   * @returns {object} { success: boolean, jobsProcessed: number, error?: string }
   */
  function processSessionJobs(sessionId) {
    const serviceName = 'OrchestratorService';
    const functionName = 'processSessionJobs';
    logger.info(serviceName, functionName, `Processing jobs for session: ${sessionId}`);

    const allConfig = ConfigService.getAllConfig();
    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const sheetNames = allConfig['system.sheet_names'];
    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

    const jobQueueHeaders = jobQueueSheet.getDataRange().getValues()[0];

    let jobsProcessed = 0;

    // Find and process PENDING jobs for this session in order. Only the claim
    // step is shared with processPendingJobs (_claimNextPendingJobWithRetry);
    // the stop-immediately-on-first-failure control flow below is this
    // function's own deliberate, different contract -- a single *Backend
    // call's own jobs, not a background sweep that should keep working
    // through unrelated jobs.
    while (true) {
      const claim = _claimNextPendingJobWithRetry(jobQueueSheet, jobQueueHeaders, function(row) {
        return row['session_id'] === sessionId;
      });
      if (!claim.claimed) break; // nothing left for this session, or persistent contention

      const jobId = claim.jobId;
      const jobType = claim.jobType;
      const jobQueueSheetRowNumber = claim.jobQueueSheetRowNumber; // legacy field on executionContext only

      logger.info(serviceName, functionName, `Processing job ${jobId} (${jobType}) for session ${sessionId}`);

      // Get job config
      const jobConfig = allConfig[jobType];
      if (!jobConfig || !jobConfig.processing_service) {
        logger.error(serviceName, functionName, `No processing service configured for job type: ${jobType}`);
        setJobRowStatus(jobQueueSheet, jobQueueHeaders, jobId, function(currentRow) {
          if (currentRow.status !== 'PROCESSING') return undefined;
          return { status: 'FAILED', error_message: 'No processing service configured.' };
        });
        return { success: false, jobsProcessed, error: `No processing service for ${jobType}` };
      }

      const processingServiceName = jobConfig.processing_service;
      const executionContext = {
        sessionId: sessionId,
        jobId: jobId,
        jobType: jobType,
        jobQueueSheetRowNumber: jobQueueSheetRowNumber, // legacy field; real-work functions must not use this for later reads -- see D1
        jobQueueHeaders: jobQueueHeaders
      };

      try {
        switch (processingServiceName) {
          case 'ProductService':
          case 'ProductImportService':
            ProductImportService.processJob(executionContext);
            break;
          case 'OrderService':
            const orderServiceInstance = new OrderService(ProductService);
            orderServiceInstance.processJob(executionContext);
            break;
          default:
            throw new Error(`Unknown processing service: ${processingServiceName}`);
        }

        jobsProcessed++;
        finalizeJobCompletion(jobId);
        logger.info(serviceName, functionName, `Job ${jobId} completed successfully`);

      } catch (e) {
        // The sub-processor (e.g. ProductImportService.processJob) may have
        // already recorded the real, specific reason in error_message before
        // throwing a generic relay error to signal failure up here — prefer
        // that over e.message (which is just the generic relay text) if
        // present. Falls back to e.message for failures that never reach a
        // sub-processor (e.g. "Unknown processing service" above) — the
        // claim-time clear guarantees a non-empty cell here was written
        // during this run, not stale from a prior attempt.
        const freshLookup = _getJobRowByJobIdWithRetry(jobQueueSheet, jobQueueHeaders, jobId);
        const recordedReason = freshLookup.found ? String(freshLookup.row.error_message || '').trim() : '';
        const errorMessage = recordedReason || e.message;

        logger.error(serviceName, functionName, `Job ${jobId} failed: ${errorMessage}`, e);
        setJobRowStatus(jobQueueSheet, jobQueueHeaders, jobId, function(currentRow) {
          if (currentRow.status !== 'PROCESSING') return undefined;
          return { status: 'FAILED', error_message: errorMessage };
        });
        return { success: false, jobsProcessed, error: errorMessage };
      }
    }

    logger.info(serviceName, functionName, `Session ${sessionId}: ${jobsProcessed} jobs processed successfully`);
    return { success: true, jobsProcessed };
  }

})();