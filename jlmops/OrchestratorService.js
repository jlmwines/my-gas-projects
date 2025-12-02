
  function generateSessionId() {
      const now = new Date();
      const year = now.getFullYear();
      const month = ('0' + (now.getMonth() + 1)).slice(-2);
      const day = ('0' + now.getDate()).slice(-2);
      const hours = ('0' + now.getHours()).slice(-2);
      const minutes = ('0' + now.getMinutes()).slice(-2);
      const seconds = ('0' + now.getSeconds()).slice(-2);
      const uuidPart = Utilities.getUuid().substring(0, 8).toUpperCase(); // Take a short part of UUID
      return `SYNC-${year}${month}${day}-${hours}${minutes}${seconds}-${uuidPart}`;
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
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
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
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (taskType === 'hourly') {
        processAllFileImports();
        processPendingJobs();
      } else if (taskType === 'daily') {
        // For daily jobs, we might want to resolve a common session ID for the entire daily run
        // For now, let's allow createPeriodicValidationJob to resolve its own session.
        createPeriodicValidationJob(jobQueueSheet, allConfig);
      }
      
    } catch (e) {
      logger.error(serviceName, functionName, `An unexpected error occurred: ${e.message}`, e);
    }
    logger.info(serviceName, functionName, `Orchestrator finished for task type: ${taskType}.`);
  }

  // --- PHASE 1: FILE INTAKE ---

  function processAllFileImports() {
    const serviceName = 'OrchestratorService';
    const functionName = 'processAllFileImports';
    logger.info(serviceName, functionName, 'Checking for new files...');
    const allConfig = ConfigService.getAllConfig();
    if (!allConfig) {
      logger.error(serviceName, functionName, 'Could not load configuration. Halting file import processing.');
      return;
    }

    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const archiveFolderConfig = allConfig['system.folder.archive'];
    const sheetNames = allConfig['system.sheet_names'];

    if (!logSheetConfig || !logSheetConfig.id || !archiveFolderConfig || !archiveFolderConfig.id || !sheetNames) {
      logger.error(serviceName, functionName, 'Essential system configuration is missing (log spreadsheet, archive folder, or sheet names).');
      return;
    }

    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    const fileRegistrySheet = logSpreadsheet.getSheetByName(sheetNames.SysFileRegistry);
    const archiveFolder = DriveApp.getFolderById(archiveFolderConfig.id);

    const registry = getRegistryMap(fileRegistrySheet);
    
    const processingOrderConfig = allConfig['system.import.processing_order'];
    if (!processingOrderConfig || !processingOrderConfig.order) {
      logger.error(serviceName, functionName, 'system.import.processing_order is not defined in SysConfig. Halting.');
      return;
    }
    const importConfigs = processingOrderConfig.order.split(',');

    // --- Pass 1: Discovery ---
    const batchManifest = [];
    logger.info(serviceName, functionName, 'Pass 1: Discovering all new files...');
    importConfigs.forEach(configName => {
      const config = allConfig[configName];
      if (!config || !config.source_folder_id || !config.file_pattern) {
        const errorMessage = `Configuration for '${configName}' is incomplete or missing. Halting file import processing.`;
        logger.error(serviceName, functionName, errorMessage);
        throw new Error(errorMessage);
      }

      const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
      const files = sourceFolder.getFilesByName(config.file_pattern);

      while (files.hasNext()) {
        const file = files.next();
        if (isNewFile(file, registry)) {
          logger.info(serviceName, functionName, `Discovered new file for batch: ${file.getName()} (for job ${configName})`);
          batchManifest.push({ configName: configName, file: file, config: config });
        }
      }
    });

    if (batchManifest.length === 0) {
      logger.info(serviceName, functionName, 'No new files found in this run.');
      return;
    }

    // --- Pass 2: Queuing with Dependency Checks ---
    logger.info(serviceName, functionName, `Pass 2: Queuing ${batchManifest.length} jobs with dependency checks...`);
    const batchConfigNames = new Set(batchManifest.map(item => item.configName));

    batchManifest.forEach(item => {
      const { configName, file, config } = item;

      // Workflow Gate for Comax Products
      if (configName === 'import.drive.comax_products') {
        if (TaskService.hasOpenTasks('task.confirmation.comax_export')) {
          logger.warn(serviceName, functionName, `A new Comax product file was found, but it will not be processed because an administrator has not yet confirmed the previous Comax order export. Please complete the open 'Confirm Comax Export' task.`);
          return; // Skip queuing this job
        }
      }

      // Conditional Dependency Check
      let initialStatus = 'PENDING';
      const dependency = config.depends_on;

      if (dependency && batchConfigNames.has(dependency)) {
        initialStatus = 'BLOCKED';
        logger.info(serviceName, functionName, `Job for ${configName} will be BLOCKED because its dependency '${dependency}' is also in this batch.`);
      }

      const archivedFile = archiveFile(file, archiveFolder);
      // Resolve session ID for the new job
      const sessionIdForNewJob = resolveSessionIdForJob(configName, config, allConfig);
      // Pass original file metadata to the job queue instead of updating the registry here.
      createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId(), initialStatus, file.getId(), file.getLastUpdated(), sessionIdForNewJob);
    });

    logger.info(serviceName, functionName, 'File import check complete.');
  }

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
    const day = ('0' + now.getDate()).slice(-2);

    let yearFolder = getOrCreateFolder(archiveFolder, year.toString());
    let monthFolder = getOrCreateFolder(yearFolder, month);
    let dayFolder = getOrCreateFolder(monthFolder, day);

    const timestamp = now.toISOString().replace(/:/g, '-');
    const newFileName = `${file.getName()}_${timestamp}`;
    
    const newFile = file.makeCopy(newFileName, dayFolder);
    logger.info('OrchestratorService', 'archiveFile', `Archived file as: ${newFile.getName()}`);
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

    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
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

    const data = jobQueueSheet.getRange(2, 1, jobQueueSheet.getLastRow() - 1, jobQueueHeaders.length).getValues();

    const jobIdColIdx = jobQueueHeaders.indexOf('job_id');
    const statusColIdx = jobQueueHeaders.indexOf('status');
    const jobTypeColIdx = jobQueueHeaders.indexOf('job_type');
    const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');
    const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');

    // --- Zombie Killer: Check for stuck PROCESSING jobs ---
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
                jobQueueSheet.getRange(i + 2, statusColIdx + 1).setValue('FAILED');
                jobQueueSheet.getRange(i + 2, errorMsgColIdx + 1).setValue('Job stuck in PROCESSING state for too long (>15min).');
                jobQueueSheet.getRange(i + 2, processedTsColIdx + 1).setValue(new Date()); // Update processed timestamp to now
            }
        }
    }
    SpreadsheetApp.flush(); // Ensure updates are written immediately
    // --- End Zombie Killer ---
    
    let jobFoundAndProcessed = false;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[statusColIdx] === 'PENDING') {
        const jobId = row[jobIdColIdx];
        const jobType = row[jobTypeColIdx];
        const jobQueueSheetRowNumber = i + 2; // +1 for 0-based index, +1 for header

        const jobConfig = allConfig[jobType];
        
        if (!jobConfig || !jobConfig.processing_service) {
          logger.error(serviceName, functionName, `No processing service configured for job type: ${jobType}. Setting job ${jobId} to FAILED.`, { jobId: jobId, jobType: jobType });
          jobQueueSheet.getRange(jobQueueSheetRowNumber, statusColIdx + 1).setValue('FAILED');
          jobQueueSheet.getRange(jobQueueSheetRowNumber, errorMsgColIdx + 1).setValue('No processing service configured.');
          jobFoundAndProcessed = true; // Still consider it processed for this run
          break; // Process only one job
        }

        const processingServiceName = jobConfig.processing_service;
        logger.info(serviceName, functionName, `Delegating job ${jobId} of type '${jobType}' to service: ${processingServiceName}`, { jobId: jobId, jobType: jobType });

        // Create execution context to pass to the processing service
        const executionContext = {
            sessionId: row[jobQueueHeaders.indexOf('session_id')], // Get sessionId from job queue
            jobId: jobId,
            jobType: jobType,
            jobQueueSheetRowNumber: jobQueueSheetRowNumber,
            jobQueueHeaders: jobQueueHeaders // Pass headers for service to find column indices
        };

        try {
          // Set status to PROCESSING before calling service
          jobQueueSheet.getRange(jobQueueSheetRowNumber, statusColIdx + 1).setValue('PROCESSING');
          jobQueueSheet.getRange(jobQueueSheetRowNumber, processedTsColIdx + 1).setValue(new Date()); // Update processed timestamp

          switch (processingServiceName) {
            case 'ProductService':
              // Services will now be responsible for updating their own job status (COMPLETED/FAILED)
              // and calling OrchestratorService.finalizeJobCompletion upon success.
              ProductService.processJob(executionContext);
              break;
            case 'OrderService':
              const orderServiceInstance = new OrderService(ProductService);
              orderServiceInstance.processJob(executionContext);
              break;
            case 'ValidationOrchestratorService':
              ValidationOrchestratorService.processJob(executionContext);
              break;
            default:
              throw new Error(`Unknown processing service: ${processingServiceName}`);
          }
        } catch (e) {
          logger.error(serviceName, functionName, `Critical error in Orchestrator while delegating job ${jobId}: ${e.message}`, e, executionContext);
          // If service failed to update status, Orchestrator catches and sets FAILED
          jobQueueSheet.getRange(jobQueueSheetRowNumber, statusColIdx + 1).setValue('FAILED');
          jobQueueSheet.getRange(jobQueueSheetRowNumber, errorMsgColIdx + 1).setValue(`Orchestrator delegation failed: ${e.message}`);
        }
        jobFoundAndProcessed = true;
        break; // Process only one job per execution
      }
    }

    if (!jobFoundAndProcessed) {
      logger.info(serviceName, functionName, 'No PENDING jobs found in the queue to process in this run.');
    }
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

  function _createTaskIfNotOpen(taskTypeId, entityId, title, notes) {
    const serviceName = 'OrchestratorService';
    const functionName = '_createTaskIfNotOpen';
    try {
      if (!TaskService.hasOpenTasks(taskTypeId)) {
        logger.info(serviceName, functionName, `No open task of type '${taskTypeId}' found. Creating one.`);
        TaskService.createTask(taskTypeId, entityId, title, notes);
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
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
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

      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
      const fileRegistrySheet = logSpreadsheet.getSheetByName(sheetNames.SysFileRegistry);

      const registry = getRegistryMap(fileRegistrySheet);
      registry.set(originalFileId, { name: originalFileName, lastUpdated: new Date(originalFileLastUpdated) });
      
      updateRegistrySheet(fileRegistrySheet, registry, allConfig['schema.log.SysFileRegistry']);

    } catch (e) {
      logger.error(serviceName, functionName, `Failed to record file ${originalFileId} in registry: ${e.message}`, e);
      // Do not re-throw; we don't want this to crash the parent process.
    }
  }

  function finalizeJobCompletion(jobQueueSheetRowNumber) { // Change signature
    const serviceName = 'OrchestratorService';
    const functionName = 'finalizeJobCompletion';
    logger.info(serviceName, functionName, `Finalizing job completion for job on row ${jobQueueSheetRowNumber}.`);

    const allConfig = ConfigService.getAllConfig();
    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const sheetNames = allConfig['system.sheet_names'];
    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
    
    // Get details of the completed job
    const completedJobDetails = getJobDetailsByRow(jobQueueSheet, jobQueueSheetRowNumber, jobQueueHeaders);
    if (!completedJobDetails) {
        logger.error(serviceName, functionName, `Could not retrieve details for completed job on row ${jobQueueSheetRowNumber}.`);
        return;
    }
    const completedJobType = completedJobDetails.job_type;
    const completedJobSessionId = completedJobDetails.session_id;

    // --- Phase 1: Record file in registry if applicable ---
    try {
      // Use jobQueueSheetRowNumber instead of jobQueueSheet.getLastRow() >= rowNumber
      if (jobQueueSheetRowNumber) { // Check if row number is valid
        const jobRowData = jobQueueSheet.getRange(jobQueueSheetRowNumber, 1, 1, jobQueueHeaders.length).getValues()[0];
        const archiveFileIdIdx = jobQueueHeaders.indexOf('archive_file_id');
        const originalFileIdIdx = jobQueueHeaders.indexOf('original_file_id');
        const originalTimestampIdx = jobQueueHeaders.indexOf('original_file_last_updated');
        
        const archiveFileId = jobRowData[archiveFileIdIdx];
        const originalFileId = jobRowData[originalFileIdIdx];
        const originalFileLastUpdated = jobRowData[originalTimestampIdx];

        if (originalFileId && originalFileLastUpdated) {
          const archiveFile = DriveApp.getFileById(archiveFileId);
          const archiveFileName = archiveFile.getName();
          // Original name is everything before the last underscore, which precedes the ISO timestamp.
          const originalFileName = archiveFileName.substring(0, archiveFileName.lastIndexOf('_'));

          _recordFileInRegistry(originalFileId, originalFileName, originalFileLastUpdated);
        }
      }
    } catch(e) {
      logger.error(serviceName, functionName, `Error during file registry update phase: ${e.message}`, e, { sessionId: completedJobSessionId, jobType: completedJobType });
    }
    
    // --- Phase 2: Unblock dependent jobs in the queue ---
    try {
      if (jobQueueSheet.getLastRow() > 1) {
        const data = jobQueueSheet.getDataRange().getValues();
        const headers = data.shift();
        const jobTypeCol = headers.indexOf('job_type');
        const statusCol = headers.indexOf('status');
        const sessionIdCol = headers.indexOf('session_id'); // New index

        data.forEach((row, index) => {
          if (row[statusCol] === 'BLOCKED') {
            const blockedJobType = row[jobTypeCol];
            const blockedJobConfig = allConfig[blockedJobType];
            const blockedJobSessionId = row[sessionIdCol]; // Get session ID of blocked job
            
            if (blockedJobConfig && blockedJobConfig.depends_on === completedJobType && blockedJobSessionId === completedJobSessionId) {
              const sheetRow = index + 2; // +1 for 0-based index, +1 for header
              jobQueueSheet.getRange(sheetRow, statusCol + 1).setValue('PENDING');
              logger.info(serviceName, functionName, `Unblocked job ${row[0]} (type: ${blockedJobType}, Session: ${blockedJobSessionId}) because its dependency '${completedJobType}' was completed in the same session.`, { sessionId: completedJobSessionId, unblockedJobId: row[0], unblockedJobType: blockedJobType });
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
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
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
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
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
   * Counts the number of specific file types in the designated invoice folder, ignoring shortcuts.
   * Replicates logic from legacy AdminWorkflow.js.
   * @returns {number} The count of relevant files in the folder.
   */
  function getInvoiceFileCount() {
    const serviceName = 'OrchestratorService';
    const functionName = 'getInvoiceFileCount';
    try {
      const allConfig = ConfigService.getAllConfig();
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

  return {
    run: run,
    finalizeJobCompletion: finalizeJobCompletion,
    getLastJobSuccess: getLastJobSuccess,
    getPendingOrProcessingJob: getPendingOrProcessingJob,
    getInvoiceFileCount: getInvoiceFileCount
  };

})();