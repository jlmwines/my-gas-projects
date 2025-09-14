/**
 * @file ProductService.js
 * @description Service for handling product-related business logic.
 */

const ProductService = (function() {

  /**
   * Processes a single product import job from the job queue.
   * @param {Array} jobRow The row from the SysJobQueue sheet representing the job.
   * @param {number} rowNumber The row number of the job in the sheet.
   */
  function processJob(jobRow, rowNumber) {
    // Get headers from config to safely access jobRow columns by name
    const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
    const jobId = jobRow[jobQueueHeaders.indexOf('job_id')];
    const jobType = jobRow[jobQueueHeaders.indexOf('job_type')];
    const archiveFileId = jobRow[jobQueueHeaders.indexOf('archive_file_id')];

    console.log(`ProductService: Starting processing for job ${jobId}`);

    try {
      const jobConfig = ConfigService.getConfig(jobType);
      if (!jobConfig) throw new Error(`Configuration for job type ${jobType} not found.`);

      const file = DriveApp.getFileById(archiveFileId);
      const encoding = jobConfig.file_encoding || 'UTF-8';
      const csvContent = file.getBlob().getDataAsString(encoding);

      const products = ComaxAdapter.processProductCsv(csvContent);
      if (!products || products.length === 0) {
        console.log('No products to process.');
        updateJobStatus(rowNumber, 'COMPLETED', 'No products found in file.');
        return;
      }

      // Per the implementation plan, populate the CmxProdS (staging) sheet.
      const dataSheetName = 'CmxProdS';
      populateStagingSheet(products, dataSheetName);

      // TODO: Add next step for data integrity validation against CmxProdM.

      updateJobStatus(rowNumber, 'COMPLETED', `Processed and staged ${products.length} products.`);
      console.log(`ProductService: Successfully completed job ${jobId}`);

    } catch (e) {
      console.error(`ProductService: FAILED job ${jobId}. Error: ${e.message}`);
      updateJobStatus(rowNumber, 'FAILED', e.message);
    }
  }

  /**
   * Writes product data to a specified staging sheet, overwriting existing data.
   * @param {Array<Object>} products An array of product objects from the adapter.
   * @param {string} sheetName The name of the staging sheet to populate.
   */
  function populateStagingSheet(products, sheetName) {
    console.log(`Writing ${products.length} products to staging sheet: ${sheetName}...`);
    
    const schema = ConfigService.getConfig(`schema.data.${sheetName}`);
    if (!schema || !schema.headers) {
        throw new Error(`Schema for sheet '${sheetName}' not found in configuration.`);
    }
    const headers = schema.headers.split(',');

    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = dataSpreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found in JLMops_Data spreadsheet.`);
    }

    const newData = products.map(product => {
      return headers.map(header => product[header] || '');
    });
    
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    if (newData.length > 0) {
        sheet.getRange(2, 1, newData.length, newData[0].length).setValues(newData);
    }
    console.log(`Staging sheet '${sheetName}' has been updated.`);
  }


  /**
   * Updates the status of a job in the SysJobQueue.
   * @param {number} rowNumber The row number of the job to update.
   * @param {string} status The new status ('COMPLETED' or 'FAILED').
   * @param {string} message An optional message.
   */
  function updateJobStatus(rowNumber, status, message = '') {
    const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
    const sheetNames = ConfigService.getConfig('system.sheet_names');
    const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
    
    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    
    const statusCol = jobQueueHeaders.indexOf('status') + 1;
    const messageCol = jobQueueHeaders.indexOf('error_message') + 1;
    const timestampCol = jobQueueHeaders.indexOf('processed_timestamp') + 1;

    if (rowNumber && statusCol > 0) {
        jobQueueSheet.getRange(rowNumber, statusCol).setValue(status);
    }
    if (rowNumber && messageCol > 0) {
        jobQueueSheet.getRange(rowNumber, messageCol).setValue(message);
    }
    if (rowNumber && timestampCol > 0) {
        jobQueueSheet.getRange(rowNumber, timestampCol).setValue(new Date());
    }
  }

  return {
    processJob: processJob
  };

})();