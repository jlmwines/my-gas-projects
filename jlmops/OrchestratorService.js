/**
 * @file OrchestratorService.js
 * @description Main service to orchestrate all automated workflows.
 */

/**
 * The main entry point for the time-driven trigger.
 * This function is globally scoped so it can be selected in the Apps Script editor.
 */
function runScheduledTasks() {
  OrchestratorService.run();
}


const OrchestratorService = (function() {

  /**
   * The main internal function for the orchestrator.
   */
  function run() {
    console.log('Orchestrator running...');
    try {
      processAllFileImports();
    } catch (e) {
      console.error(`An unexpected error occurred in the orchestrator: ${e.message} (${e.stack})`);
    }
    console.log('Orchestrator finished.');
  }

  /**
   * Finds and processes all configured file imports.
   */
  function processAllFileImports() {
    const allConfig = ConfigService.getAllConfig();
    if (!allConfig) {
      console.error('Could not load configuration. Halting file import processing.');
      return;
    }

    const logSheetConfig = allConfig['system.spreadsheet.logs'];
    const archiveFolderConfig = allConfig['system.folder.archive'];

    if (!logSheetConfig || !logSheetConfig.id || !archiveFolderConfig || !archiveFolderConfig.id) {
      console.error('Essential system configuration (log spreadsheet or archive folder) is missing.');
      return;
    }

    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName('SysJobQueue');
    const fileRegistrySheet = logSpreadsheet.getSheetByName('SysFileRegistry');
    const archiveFolder = DriveApp.getFolderById(archiveFolderConfig.id);

    const registry = getRegistryMap(fileRegistrySheet);
    const importConfigs = Object.keys(allConfig).filter(key => key.startsWith('import.drive'));

    console.log(`Found ${importConfigs.length} drive import configuration(s).`);

    importConfigs.forEach(configName => {
      const config = allConfig[configName];
      if (!config.processing_service || !config.source_folder_id || !config.file_pattern) {
        console.error(`Configuration for '${configName}' is incomplete. Skipping.`);
        return;
      }

      console.log(`Processing import: ${configName}`);
      const sourceFolder = DriveApp.getFolderById(config.source_folder_id);
      const files = sourceFolder.getFiles();

      while (files.hasNext()) {
        const file = files.next();
        if (isNewFile(file, config.file_pattern, registry)) {
          console.log(`New file found: ${file.getName()}`);
          const archivedFile = archiveFile(file, archiveFolder);
          createJob(jobQueueSheet, configName, config.processing_service, archivedFile.getId());
          registry.set(file.getId(), file.getLastUpdated());
        }
      }
    });

    updateRegistrySheet(fileRegistrySheet, registry);
    console.log('File import processing complete.');
  }

  /**
   * Checks if a file is new or updated based on the registry.
   */
  function isNewFile(file, pattern, registry) {
    if (file.getName() !== pattern) {
      return false;
    }
    const fileId = file.getId();
    const lastUpdated = file.getLastUpdated();
    const registeredDate = registry.get(fileId);
    return !registeredDate || lastUpdated.getTime() > registeredDate.getTime();
  }

  /**
   * Copies a file to the archive folder.
   */
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

  /**
   * Creates a new job in the SysJobQueue sheet.
   */
  function createJob(sheet, configName, serviceName, archiveFileId) {
    const jobId = Utilities.getUuid();
    const now = new Date();
    sheet.appendRow([jobId, configName, 'PENDING', archiveFileId, now, '', '']);
    console.log(`Created new job ${jobId} for ${configName}`);
  }

  /**
   * Reads the file registry sheet into a Map.
   */
  function getRegistryMap(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return new Map();
    data.shift(); // remove header
    const map = new Map();
    data.forEach(row => {
      if (row[0] && row[2]) { // fileId and timestamp
        map.set(row[0], new Date(row[2]));
      }
    });
    return map;
  }

  /**
   * Writes the updated registry map back to the sheet.
   */
  function updateRegistrySheet(sheet, registry) {
    sheet.clearContents();
    sheet.appendRow(['source_file_id', 'source_file_name', 'last_processed_timestamp']);
    if (registry.size > 0) {
      const data = Array.from(registry, ([fileId, lastUpdated]) => [fileId, '', lastUpdated]);
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
    console.log('SysFileRegistry updated.');
  }

  /**
   * Helper to get or create a folder.
   */
  function getOrCreateFolder(parentFolder, folderName) {
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      return folders.next();
    }
    return parentFolder.createFolder(folderName);
  }

  return {
    run: run
  };

})();
