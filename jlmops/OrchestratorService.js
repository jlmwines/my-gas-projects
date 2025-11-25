/**
 * @file OrchestratorService.js
 * @description Main service to orchestrate all automated workflows.
 */

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
      // Pass original file metadata to the job queue instead of updating the registry here.
      createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId(), initialStatus, file.getId(), file.getLastUpdated());
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

  function createJob(sheet, configName, serviceName, archiveFileId, status, originalFileId, originalFileLastUpdated) {
    const jobId = Utilities.getUuid();
    const now = new Date();
    // Corresponds to: job_id, job_type, status, archive_file_id, created_timestamp, processed_timestamp, error_message, original_file_id, original_file_last_updated
    sheet.appendRow([jobId, configName, status, archiveFileId, now, '', '', originalFileId, originalFileLastUpdated]);
    logger.info('OrchestratorService', 'createJob', `Created new job ${jobId} for ${configName} with status: ${status}`);
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

    const statusColIdx = jobQueueHeaders.indexOf('status');
    const jobTypeColIdx = jobQueueHeaders.indexOf('job_type');
    const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[statusColIdx] === 'PENDING') {
        const jobType = row[jobTypeColIdx];
        const jobConfig = allConfig[jobType];
        
        if (!jobConfig || !jobConfig.processing_service) {
          logger.error(serviceName, functionName, `No processing service configured for job type: ${jobType}. Skipping job.`);
          continue;
        }

        const processingServiceName = jobConfig.processing_service;
        logger.info(processingServiceName, functionName, `Delegating job ${row[0]} of type '${jobType}' to service: ${processingServiceName}`);

        jobQueueSheet.getRange(i + 2, statusColIdx + 1).setValue('PROCESSING');

        try {
          const rowNumber = i + 2; // The sheet row number (1-based index + header)
          switch (processingServiceName) {
            case 'ProductService':
              ProductService.processJob(jobType, rowNumber);
              break;
            case 'OrderService':
              const orderServiceInstance = new OrderService(ProductService);
              orderServiceInstance.processJob(jobType, rowNumber, ProductService);
              break;
            case 'ValidationOrchestratorService': // New case for master validation
              ValidationOrchestratorService.processJob(jobType, rowNumber);
              break;
            default:
              throw new Error(`Unknown processing service: ${serviceName}`);
          }
        } catch (e) {
          logger.error(serviceName, functionName, `Error processing job ${row[0]}: ${e.message}`, e);
          jobQueueSheet.getRange(i + 2, statusColIdx + 1).setValue('FAILED');
          jobQueueSheet.getRange(i + 2, errorMsgColIdx + 1).setValue(e.message);
        }
      }
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

    createJob(jobQueueSheet, 'periodic.validation.master', 'ValidationOrchestratorService', '', 'PENDING');
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

  function _handleCompletedWebOrderImport() {
    const serviceName = 'OrchestratorService';
    const functionName = '_handleCompletedWebOrderImport';
    try {
      logger.info(serviceName, functionName, 'Handling completed web order import...');
      const orderService = new OrderService(ProductService);
      const ordersToExportCount = orderService.getComaxExportOrderCount();

      if (ordersToExportCount > 0) {
        logger.info(serviceName, functionName, `${ordersToExportCount} orders are ready for Comax export. Creating task.`);
        _createTaskIfNotOpen(
          'task.export.comax_orders_ready',
          'SYSTEM',
          `Comax Export Ready: ${ordersToExportCount} Orders`,
          `The web order import has completed, and ${ordersToExportCount} orders are now ready for export to Comax.`
        );
      } else {
        logger.info(serviceName, functionName, 'No orders are currently ready for Comax export.');
      }
    } catch (e) {
      logger.error(serviceName, functionName, `Error checking for pending Comax exports: ${e.message}`, e);
    }
  }

  function _handleCompletedProductImport() {
    const serviceName = 'OrchestratorService';
    const functionName = '_handleCompletedProductImport';
    try {
      logger.info(serviceName, functionName, 'Handling completed product import, checking for pair...');

      const allConfig = ConfigService.getAllConfig();
      const logSheetConfig = allConfig['system.spreadsheet.logs'];
      const sheetNames = allConfig['system.sheet_names'];
      const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
      const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);

      if (!jobQueueSheet || jobQueueSheet.getLastRow() < 2) {
        logger.info(serviceName, functionName, 'Job queue is empty, cannot check for pairs.');
        return;
      }
      
      const data = jobQueueSheet.getDataRange().getValues();
      const headers = data.shift();
      const jobTypeCol = headers.indexOf('job_type');
      const statusCol = headers.indexOf('status');
      const processedTsCol = headers.indexOf('processed_timestamp');

      let lastWebProd, lastCmxProd;

      for (const row of data) {
        const jobType = row[jobTypeCol];
        const status = row[statusCol];
        const timestamp = new Date(row[processedTsCol]);

        if (status === 'COMPLETED' && timestamp.getTime()) {
          if (jobType === 'import.drive.web_products') {
            if (!lastWebProd || timestamp > lastWebProd) {
              lastWebProd = timestamp;
            }
          } else if (jobType === 'import.drive.comax_products') {
            if (!lastCmxProd || timestamp > lastCmxProd) {
              lastCmxProd = timestamp;
            }
          }
        }
      }

      if (lastWebProd && lastCmxProd) {
        const timeDiffHours = Math.abs(lastWebProd.getTime() - lastCmxProd.getTime()) / 36e5;
        logger.info(serviceName, functionName, `Found last web prod at ${lastWebProd.toLocaleString()} and last comax prod at ${lastCmxProd.toLocaleString()}. Time difference: ${timeDiffHours.toFixed(2)} hours.`);
        
        if (timeDiffHours <= 2) { // 2-hour window to be considered a pair
          logger.info(serviceName, functionName, 'Product import pair confirmed. Creating web inventory export task.');
          _createTaskIfNotOpen(
            'task.export.web_inventory_ready',
            'SYSTEM',
            'Web Inventory Export Ready',
            'The Web and Comax product imports have both completed successfully. The web inventory export is now ready to be generated.'
          );
        } else {
          logger.info(serviceName, functionName, 'Product imports are not a recent pair. No task will be created.');
        }
      } else {
        logger.info(serviceName, functionName, 'One or both product imports have not completed yet. Cannot form a pair.');
      }

    } catch (e) {
      logger.error(serviceName, functionName, `Error during paired product import check: ${e.message}`, e);
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

  function finalizeJobCompletion(completedJobType, rowNumber) {
    const serviceName = 'OrchestratorService';
    const functionName = 'finalizeJobCompletion';
    logger.info(serviceName, functionName, `Finalizing job completion for type '${completedJobType}' from row ${rowNumber}.`);

    const allConfig = ConfigService.getAllConfig();
    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const sheetNames = allConfig['system.sheet_names'];
    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    const jobQueueHeaders = allConfig['schema.log.SysJobQueue'].headers.split(',');
    
    // --- Phase 1: Record file in registry if applicable ---
    try {
      if (jobQueueSheet.getLastRow() >= rowNumber) {
        const jobRowData = jobQueueSheet.getRange(rowNumber, 1, 1, jobQueueHeaders.length).getValues()[0];
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
      logger.error(serviceName, functionName, `Error during file registry update phase: ${e.message}`, e);
    }
    
    // --- Phase 2: Unblock dependent jobs in the queue ---
    try {
      if (jobQueueSheet.getLastRow() > 1) {
        const data = jobQueueSheet.getDataRange().getValues();
        const headers = data.shift();
        const jobTypeCol = headers.indexOf('job_type');
        const statusCol = headers.indexOf('status');

        data.forEach((row, index) => {
          if (row[statusCol] === 'BLOCKED') {
            const jobType = row[jobTypeCol];
            const jobConfig = allConfig[jobType];
            
            if (jobConfig && jobConfig.depends_on === completedJobType) {
              const sheetRow = index + 2; // +1 for 0-based index, +1 for header
              jobQueueSheet.getRange(sheetRow, statusCol + 1).setValue('PENDING');
              logger.info(serviceName, functionName, `Unblocked job ${row[0]} (type: ${jobType}) because its dependency '${completedJobType}' was completed.`);
            }
          }
        });
      }
    } catch(e) {
      logger.error(serviceName, functionName, `Error during job unblocking phase: ${e.message}`, e);
    }

    // --- Phase 3: Immediately process any newly unblocked jobs ---
    try {
      logger.info(serviceName, functionName, 'Checking for newly unblocked jobs to process.');
      processPendingJobs();
    } catch (e) {
      logger.error(serviceName, functionName, `Error during immediate processing of unblocked jobs: ${e.message}`, e);
    }

    // --- Phase 4: Fire state-based triggers ---
    try {
      switch (completedJobType) {
        case 'import.drive.web_orders':
          _handleCompletedWebOrderImport();
          break;
        case 'import.drive.web_products':
        case 'import.drive.comax_products':
          _handleCompletedProductImport();
          break;
        default:
          logger.info(serviceName, functionName, `No specific state-based triggers to run for completed job type: '${completedJobType}'.`);
          break;
      }
    } catch(e) {
      logger.error(serviceName, functionName, `Error during state-based trigger phase: ${e.message}`, e);
    }
  }

  return {
    run: run,
    finalizeJobCompletion: finalizeJobCompletion
  };

})();