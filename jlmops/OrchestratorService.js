/**
 * @file OrchestratorService.js
 * @description Main service to orchestrate all automated workflows.
 */

/**
 * The main entry point for the time-driven trigger.
 */
function runScheduledTasks() {
  OrchestratorService.run();
}

const OrchestratorService = (function() {

  function run() {
    console.log('Orchestrator running...');
    try {
      processAllFileImports();
      processPendingJobs();
    } catch (e) {
      console.error(`An unexpected error occurred in the orchestrator: ${e.message} (${e.stack})`);
    }
    console.log('Orchestrator finished.');
  }

  // --- PHASE 1: FILE INTAKE ---

  function processAllFileImports() {
    console.log('Checking for new files...');
    const allConfig = ConfigService.getAllConfig();
    if (!allConfig) {
      console.error('Could not load configuration. Halting file import processing.');
      return;
    }

    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const archiveFolderConfig = allConfig['system.folder.archive'];
    const sheetNames = allConfig['system.sheet_names'];

    if (!logSheetConfig || !logSheetConfig.id || !archiveFolderConfig || !archiveFolderConfig.id || !sheetNames) {
      console.error('Essential system configuration is missing (log spreadsheet, archive folder, or sheet names).');
      return;
    }

    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    const fileRegistrySheet = logSpreadsheet.getSheetByName(sheetNames.SysFileRegistry);
    const archiveFolder = DriveApp.getFolderById(archiveFolderConfig.id);

    const registry = getRegistryMap(fileRegistrySheet);
    
    const processingOrderConfig = allConfig['system.import.processing_order'];
    if (!processingOrderConfig || !processingOrderConfig.order) {
      console.error('system.import.processing_order is not defined in SysConfig. Halting file import processing.');
      return;
    }
    const importConfigs = processingOrderConfig.order.split(',');

    console.log(`Found ${importConfigs.length} drive import configuration(s) in the specified processing order.`);

    importConfigs.forEach(configName => {
      const config = allConfig[configName];
      console.log(`Config for ${configName}:`, config);
      if (!config.source_folder_id || !config.file_pattern) {
        console.error(`Configuration for '${configName}' is incomplete. Skipping.`);
        return;
      }

      console.log(`Processing import: ${configName}`);
      const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
      const files = sourceFolder.getFilesByName(config.file_pattern);

      while (files.hasNext()) {
        const file = files.next();
        if (isNewFile(file, registry)) {
          console.log(`New file version found: ${file.getName()}`);

          // Workflow Gate for Comax Products
          if (configName === 'import.drive.comax_products') {
            if (TaskService.hasOpenTasks('task.confirmation.comax_export')) {
              console.warn('A new Comax product file was found, but it will not be processed because an administrator has not yet confirmed the previous Comax order export. Please complete the open \'Confirm Comax Export\' task.');
              continue; // Skip to the next file
            }
          }

          const archivedFile = archiveFile(file, archiveFolder);
          createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId());
          // Update the registry map with the file's ID, name, and last updated time
          registry.set(file.getId(), { name: file.getName(), lastUpdated: file.getLastUpdated() });
        }
      }
    });

    updateRegistrySheet(fileRegistrySheet, registry, allConfig['schema.log.SysFileRegistry']);
    console.log('File import check complete.');
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

    console.log(`isNewFile Check: File: ${file.getName()}, Live Timestamp: ${liveSeconds}, Registered Timestamp: ${registeredSeconds}`);

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
    console.log(`Archived file as: ${newFile.getName()}`);
    return newFile;
  }

  function createJob(sheet, configName, serviceName, archiveFileId) {
    const jobId = Utilities.getUuid();
    const now = new Date();
    sheet.appendRow([jobId, configName, 'PENDING', archiveFileId, now, '', '']);
    console.log(`Created new job ${jobId} for ${configName}`);
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
    console.log('SysFileRegistry updated.');
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
    console.log('Checking for pending jobs...');
    const allConfig = ConfigService.getAllConfig();
    
    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    if (!logSheetConfig || !logSheetConfig.id) {
      console.error('Log spreadsheet ID not found in configuration.');
      return;
    }

    const sheetNames = allConfig['system.sheet_names'];
    const jobQueueSheetName = sheetNames.SysJobQueue;

    const jobQueueSchema = allConfig['schema.log.SysJobQueue'];
    if (!jobQueueSchema || !jobQueueSchema.headers) {
        console.error('Job Queue schema not found in configuration.');
        return;
    }
    const jobQueueHeaders = jobQueueSchema.headers.split(',');

    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(jobQueueSheetName);
    
    if (!jobQueueSheet) {
        console.error(`Sheet '${jobQueueSheetName}' not found in log spreadsheet.`);
        return;
    }

    if (jobQueueSheet.getLastRow() < 2) {
        console.log('No jobs found in the queue.');
        console.log('Pending job check complete.');
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
          console.error(`No processing service configured for job type: ${jobType}. Skipping job.`);
          continue;
        }

        const serviceName = jobConfig.processing_service;
        console.log(`Delegating job ${row[0]} of type '${jobType}' to service: ${serviceName}`);

        jobQueueSheet.getRange(i + 2, statusColIdx + 1).setValue('PROCESSING');

        try {
          const rowNumber = i + 2; // The sheet row number (1-based index + header)
          switch (serviceName) {
            case 'ProductService':
              ProductService.processJob(jobType, rowNumber);
              break;
            case 'OrderService':
              const orderServiceInstance = new OrderService(ProductService);
              orderServiceInstance.processJob(jobType, rowNumber, ProductService);
              break;
            default:
              throw new Error(`Unknown processing service: ${serviceName}`);
          }
        } catch (e) {
          console.error(`Error processing job ${row[0]}: ${e.message}`);
          jobQueueSheet.getRange(i + 2, statusColIdx + 1).setValue('FAILED');
          jobQueueSheet.getRange(i + 2, errorMsgColIdx + 1).setValue(e.message);
        }
      }
    }
    console.log('Pending job check complete.');
  }

  return {
    run: run
  };

})();