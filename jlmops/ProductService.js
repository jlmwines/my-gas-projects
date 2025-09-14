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
    const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
    const jobId = jobRow[jobQueueHeaders.indexOf('job_id')];
    const jobType = jobRow[jobQueueHeaders.indexOf('job_type')];
    const archiveFileId = jobRow[jobQueueHeaders.indexOf('archive_file_id')];

    console.log(`ProductService: Starting processing for job ${jobId} of type ${jobType}`);

    try {
      const jobConfig = ConfigService.getConfig(jobType);
      if (!jobConfig) throw new Error(`Configuration for job type ${jobType} not found.`);

      const file = DriveApp.getFileById(archiveFileId);
      const encoding = jobConfig.file_encoding || 'UTF-8';
      const csvContent = file.getBlob().getDataAsString(encoding);

      let products;
      let dataSheetName;

      switch (jobType) {
        case 'import.drive.comax_products':
          products = ComaxAdapter.processProductCsv(csvContent);
          dataSheetName = 'CmxProdS';
          break;
        case 'import.drive.web_products_en':
          products = _processGenericCsv(csvContent, 'schema.data.WebProdS_EN');
          dataSheetName = 'WebProdS_EN';
          break;
        case 'import.drive.web_products_he':
          products = _processGenericCsv(csvContent, 'schema.data.WebProdS_HE');
          dataSheetName = 'WebProdS_HE';
          break;
        default:
          throw new Error(`Unsupported job type: ${jobType}`);
      }

      if (!products || products.length === 0) {
        console.log('No products to process.');
        updateJobStatus(rowNumber, 'COMPLETED', 'No products found in file.');
        return;
      }

      populateStagingSheet(products, dataSheetName);

      // Data validation will be enhanced in a future step.
      // For now, we only validate Comax imports.
      if (jobType === 'import.drive.comax_products') {
        const validationErrors = verifyDataIntegrity(products, jobId);
        if (validationErrors.length > 0) {
          const errorMessage = 'Data integrity checks failed. See SysLog for details.';
          LoggerService.error('ProductService', 'processJob', `${errorMessage} Details: ${JSON.stringify(validationErrors)}`, new Error(errorMessage));
          updateJobStatus(rowNumber, 'FAILED', errorMessage);
          return;
        }
      }

      updateJobStatus(rowNumber, 'COMPLETED', `Processed and staged ${products.length} products.`);
      console.log(`ProductService: Successfully completed job ${jobId}`);

    } catch (e) {
      console.error(`ProductService: FAILED job ${jobId}. Error: ${e.message}`);
      updateJobStatus(rowNumber, 'FAILED', e.message);
    }
  }

  /**
   * Processes a generic CSV file into an array of objects.
   * @private
   * @param {string} csvContent The raw CSV content.
   * @param {string} schemaName The name of the schema in config that defines the headers.
   * @returns {Array<Object>} An array of objects representing the CSV rows.
   */
  function _processGenericCsv(csvContent, schemaName) {
    const schema = ConfigService.getConfig(schemaName);
    if (!schema || !schema.headers) {
      throw new Error(`Schema '${schemaName}' not found or is missing headers.`);
    }
    const headers = schema.headers.split(',');
    const parsedData = Utilities.parseCsv(csvContent);

    if (parsedData.length < 2) return []; // Empty or header-only file

    const headerRow = parsedData[0];
    // Find the indices of the headers we care about from the actual CSV file
    const headerIndices = headers.map(h => headerRow.indexOf(h));

    const products = parsedData.slice(1).map(row => {
      const product = {};
      headerIndices.forEach((csvIdx, i) => {
        if (csvIdx !== -1) {
          const headerName = headers[i];
          product[headerName] = row[csvIdx];
        }
      });
      return product;
    });

    return products;
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
   * Verifies the integrity of product data against the master product sheet.
   * @param {Array<Object>} products The array of product objects to validate.
   * @param {string} jobId The ID of the current job for logging purposes.
   * @returns {Array<string>} An array of error messages. Returns an empty array if all checks pass.
   */
  function verifyDataIntegrity(products, jobId) {
    console.log(`Starting data integrity check for job ${jobId}...`);
    const errors = [];
    
    // Get master SKUs for validation
    const masterSkuList = getMasterSkuList();
    if (masterSkuList.size === 0) {
      console.warn('Master SKU list is empty. Cannot perform SKU existence check.');
      // Decide if this is a critical error. For now, we'll log it and continue.
      errors.push('Master SKU list (CmxProdM) is empty or could not be read.');
      return errors;
    }

    products.forEach((product, index) => {
      const sku = product['cpm_SKU'];
      const price = product['cpm_Price'];
      const quantity = product['cpm_Stock']; // Assuming cpm_Stock is the quantity field

      // 1. SKU Existence Check
      if (!sku || !masterSkuList.has(sku)) {
        errors.push(`Row ${index + 2}: SKU '${sku || 'EMPTY'}' not found in master product list (CmxProdM).`);
      }

      // 2. Data Type Validation for Price
      if (price === undefined || price === '' || isNaN(Number(price))) {
        errors.push(`Row ${index + 2}: Invalid or empty Price for SKU '${sku}'. Value: '${price}'`);
      }
      
      // 3. Data Type Validation for Quantity
      if (quantity === undefined || quantity === '' || !/^-?\d+$/.test(quantity)) {
        errors.push(`Row ${index + 2}: Invalid or empty Stock quantity for SKU '${sku}'. Value: '${quantity}'`);
      }
    });

    console.log(`Data integrity check for job ${jobId} finished. Found ${errors.length} errors.`);
    return errors;
  }

  /**
   * Retrieves a Set of all SKUs from the Comax Master Product sheet (CmxProdM).
   * @returns {Set<string>} A set of all master SKUs.
   */
  function getMasterSkuList() {
    const masterSheetName = 'CmxProdM';
    const schema = ConfigService.getConfig(`schema.data.${masterSheetName}`);
    if (!schema || !schema.headers) {
      throw new Error(`Schema for master sheet '${masterSheetName}' not found.`);
    }
    const headers = schema.headers.split(',');
    const skuColumnIndex = headers.indexOf('cpm_SKU');

    if (skuColumnIndex === -1) {
      throw new Error(`SKU column ('cpm_SKU') not found in schema for '${masterSheetName}'.`);
    }

    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = dataSpreadsheet.getSheetByName(masterSheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      return new Set(); // Return empty set if sheet is empty
    }

    const range = sheet.getRange(2, skuColumnIndex + 1, sheet.getLastRow() - 1, 1);
    const values = range.getValues().flat().filter(String); // Get all SKU values, flatten, and remove empty strings
    return new Set(values);
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