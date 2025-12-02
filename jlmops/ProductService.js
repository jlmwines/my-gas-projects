/**
 * @file ProductService.js
 * @description Service for handling product-related business logic, including staging and validation.
 */

const ProductService = (function() {
  let skuToWebIdMap = null;

  /**
   * Helper to update job status in SysJobQueue.
   * @param {object} executionContext The execution context.
   * @param {string} status The new status ('COMPLETED', 'FAILED', 'QUARANTINED').
   * @param {string} [errorMessage=''] Optional error message.
   */
  function _updateJobStatus(executionContext, status, errorMessage = '') {
    const serviceName = 'ProductService';
    const functionName = '_updateJobStatus';
    const { jobQueueSheetRowNumber, jobQueueHeaders, jobId, jobType, sessionId } = executionContext;

    try {
      const allConfig = ConfigService.getAllConfig();
      const logSpreadsheet = SpreadsheetApp.openById(allConfig['system.spreadsheet.logs'].id);
      const jobQueueSheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysJobQueue);

      const statusColIdx = jobQueueHeaders.indexOf('status');
      const errorMsgColIdx = jobQueueHeaders.indexOf('error_message');
      const processedTsColIdx = jobQueueHeaders.indexOf('processed_timestamp');

      if (statusColIdx === -1 || errorMsgColIdx === -1 || processedTsColIdx === -1) {
        logger.error(serviceName, functionName, `Missing required columns in SysJobQueue headers for updating job status.`, null, { sessionId: sessionId, jobId: jobId, jobType: jobType });
        return;
      }

      jobQueueSheet.getRange(jobQueueSheetRowNumber, statusColIdx + 1).setValue(status);
      jobQueueSheet.getRange(jobQueueSheetRowNumber, processedTsColIdx + 1).setValue(new Date());
      if (errorMessage) {
        jobQueueSheet.getRange(jobQueueSheetRowNumber, errorMsgColIdx + 1).setValue(errorMessage);
      }
      logger.info(serviceName, functionName, `Job ${jobId} status updated to ${status}.`, { sessionId: sessionId, jobId: jobId, jobType: jobType, newStatus: status });
    } catch (e) {
      logger.error(serviceName, functionName, `Failed to update job status for ${jobId}: ${e.message}`, e, { sessionId: sessionId, jobId: jobId, jobType: jobType });
    }
  }

  function _buildSkuToWebIdMap() {
    const functionName = '_buildSkuToWebIdMap';
    LoggerService.info('ProductService', functionName, 'Building SKU to WebIdEn map...');
    skuToWebIdMap = new Map();
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const sheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      if (!sheet) {
        throw new Error('WebProdM sheet not found');
      }
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const skuCol = headers.indexOf('wpm_SKU');
      const webIdCol = headers.indexOf('wpm_WebIdEn');
      if (skuCol === -1 || webIdCol === -1) {
        throw new Error('Could not find SKU or WebIdEn columns in WebProdM');
      }
      data.forEach(row => {
        const sku = String(row[skuCol]).trim();
        if (sku) {
          skuToWebIdMap.set(sku, row[webIdCol]);
        }
      });
      LoggerService.info('ProductService', functionName, `Built SKU map with ${skuToWebIdMap.size} entries.`);
    } catch (e) {
      LoggerService.error('ProductService', functionName, `Error building SKU map: ${e.message}`, e);
      // If the map fails to build, we leave it as an empty map to prevent repeated errors.
      skuToWebIdMap = new Map();
    }
  }

  // =================================================================================
  // PRIVATE HELPER METHODS
  // =================================================================================

  function _populateStagingSheet(productsOrData, sheetName, sessionId) {
    const serviceName = 'ProductService';
    const functionName = '_populateStagingSheet';
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const sheet = dataSpreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found in JLMops_Data spreadsheet.`);
    }
    logger.info(serviceName, functionName, `Successfully opened sheet: ${sheetName}. Current headers: ${JSON.stringify(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0])}`, { sessionId: sessionId });

    let finalData;

    // Check if the input is a 2D array (from ComaxAdapter) or an array of objects (from WebAdapter)
    if (productsOrData.length > 0 && Array.isArray(productsOrData[0])) {
        finalData = productsOrData; // It's already a 2D array, use directly
    } else {
        // It's an array of objects, so we need to map it using the schema
        const schema = ConfigService.getConfig(`schema.data.${sheetName}`);
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration.`);
        }
        const schemaHeaders = schema.headers.split(',');

        finalData = productsOrData.map(product => {
          return schemaHeaders.map(header => product[header] || '');
        });

        logger.info(serviceName, functionName, `Mapping complete for ${sheetName}. Schema headers: ${JSON.stringify(schemaHeaders)}. First data row: ${finalData.length > 0 ? JSON.stringify(finalData[0]) : 'N/A'}`, { sessionId: sessionId });
        
        // Clear previous content and write new data
        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
        }
        if (finalData.length > 0 && finalData[0].length > 0) {
            sheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
        }
        SpreadsheetApp.flush(); // Ensure data is written before any subsequent reads (e.g., validation)
        logger.info(serviceName, functionName, `Staging sheet '${sheetName}' has been updated with ${finalData.length} rows.`, { sessionId: sessionId });
    }
  }





  function _runStagingValidation(suiteName, sessionId) {
    const serviceName = 'ProductService';
    const functionName = '_runStagingValidation';
    logger.info(serviceName, functionName, `Starting validation for suite: ${suiteName}`, { sessionId: sessionId });
    const quarantineTriggered = !ValidationService.runValidationSuite(suiteName, sessionId); // Pass sessionId to ValidationService
    if (quarantineTriggered) {
        logger.warn(serviceName, functionName, `Validation suite '${suiteName}' triggered a quarantine.`, { sessionId: sessionId });
    }
    return !quarantineTriggered;
  }

  function _runWebXltValidationAndUpsert(executionContext) {
    const serviceName = 'ProductService';
    const functionName = '_runWebXltValidationAndUpsert';
    const { jobQueueSheetRowNumber, sessionId } = executionContext;
    
    LoggerService.info(serviceName, functionName, `Starting WebXlt specific validation and upsert process for job row: ${jobQueueSheetRowNumber}.`, { sessionId: sessionId });

    // --- 1. Populate Staging Sheet ---
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobQueueSheetRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobQueueSheetRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const csvContent = file.getBlob().getDataAsString('UTF-8');

        const translationObjects = WebAdapter.processTranslationCsv(csvContent, 'map.web.translation_columns');

        _populateStagingSheet(translationObjects, sheetNames.WebXltS, sessionId);
        LoggerService.info(serviceName, functionName, 'Successfully populated WebXltS staging sheet.', { sessionId: sessionId });

    } catch (e) {
        LoggerService.error(serviceName, functionName, `Failed to populate staging sheet: ${e.message}`, e, { sessionId: sessionId });
        _updateJobStatus(executionContext, 'FAILED', `Staging population failed: ${e.message}`);
        return 'FAILED';
    }

    // --- 2. Run Staging Validation ---
    const validationResult = ValidationLogic.runValidationSuite('web_xlt_staging', sessionId);
    const { quarantineTriggered } = ValidationOrchestratorService.processValidationResults(validationResult, sessionId);

    if (quarantineTriggered) {
        logger.warn(serviceName, functionName, 'WebXlt staging validation triggered a quarantine.', { sessionId: sessionId });
        return 'QUARANTINED';
    }

    // --- 3. Upsert (existing logic) ---
    _upsertWebXltData(sessionId);
    return 'COMPLETED';
  }

  function _upsertWebXltData(sessionId) {
    const serviceName = 'ProductService';
    const functionName = '_upsertWebXltData';
    logger.info(serviceName, functionName, 'Starting WebXltS to WebXltM full replacement process.', { sessionId: sessionId });

    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const webXltMSheet = dataSpreadsheet.getSheetByName('WebXltM');
    const webXltSSheet = dataSpreadsheet.getSheetByName('WebXltS');

    if (!webXltMSheet) throw new Error('WebXltM sheet not found in JLMops_Data spreadsheet.');
    if (!webXltSSheet) throw new Error('WebXltS sheet not found in JLMops_Data spreadsheet.');

    const webXltSData = webXltSSheet.getDataRange().getValues();
    const numRows = webXltSData.length;
    const numCols = numRows > 0 ? webXltSData[0].length : 0;

    // Clear the master sheet entirely
    webXltMSheet.clear();
    logger.info(serviceName, functionName, 'Cleared WebXltM sheet.', { sessionId: sessionId });

    if (numRows > 0 && numCols > 0) {
        // Write the entire data block from staging (including headers) to master in one operation
        webXltMSheet.getRange(1, 1, numRows, numCols).setValues(webXltSData);
        logger.info(serviceName, functionName, `Wrote ${numRows} rows and ${numCols} columns from WebXltS to WebXltM.`, { sessionId: sessionId });
    } else {
        // If staging is empty, we still need to restore the headers to the master sheet
        const webXltMHeaders = ConfigService.getConfig('schema.data.WebXltM').headers.split(',');
        if (webXltMHeaders.length > 0) {
            webXltMSheet.getRange(1, 1, 1, webXltMHeaders.length).setValues([webXltMHeaders]).setFontWeight('bold');
            logger.info(serviceName, functionName, 'WebXltS was empty. Restored headers to WebXltM.', { sessionId: sessionId });
        }
    }

    SpreadsheetApp.flush(); // Ensure all pending changes are applied
    logger.info(serviceName, functionName, `Upsert complete. Final row count in WebXltM: ${webXltMSheet.getLastRow()}`, { sessionId: sessionId });
  }

  function _runComaxImport(executionContext) {
    const serviceName = 'ProductService';
    const functionName = '_runComaxImport';
    const { jobQueueSheetRowNumber, sessionId } = executionContext;
    logger.info(serviceName, functionName, `Starting Comax import process for job row: ${jobQueueSheetRowNumber}.`, { sessionId: sessionId });
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobQueueSheetRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobQueueSheetRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const fileBlob = file.getBlob();

        const comaxData = ComaxAdapter.processProductCsv(fileBlob);

        _populateStagingSheet(comaxData, sheetNames.CmxProdS, sessionId);
        logger.info(serviceName, functionName, 'Successfully populated CmxProdS staging sheet.', { sessionId: sessionId });
        
        const validationResult = ValidationLogic.runValidationSuite('comax_staging', sessionId);
        const { quarantineTriggered } = ValidationOrchestratorService.processValidationResults(validationResult, sessionId);

        if (quarantineTriggered) {
            logger.warn(serviceName, functionName, 'Comax staging validation triggered a quarantine.', { sessionId: sessionId });
            return 'QUARANTINED';
        }

        _upsertComaxData(comaxData, sessionId); // Pass comaxData here

        try {
            logger.info(serviceName, functionName, 'Comax import successful. Triggering automatic WooCommerce update export.', { sessionId: sessionId });
            // generateWooCommerceUpdateExport(); // This function will need sessionId if it logs
        } catch (e) {
            logger.error(serviceName, functionName, `The subsequent WooCommerce update export failed: ${e.message}`, e, { sessionId: sessionId });
            // We do not re-throw the error or change the job status.
            // The primary Comax import was successful. The export failure is a separate issue.
        }

        return 'COMPLETED';

    } catch (e) {
        logger.error(serviceName, functionName, `Failed to import Comax data: ${e.message}`, e, { sessionId: sessionId });
        _updateJobStatus(executionContext, 'FAILED', `Comax import failed: ${e.message}`); // Using new helper
        return 'FAILED';
    }
  }

  function _upsertComaxData(comaxProducts, sessionId) { // Modified to accept comaxProducts and sessionId
    const serviceName = 'ProductService';
    const functionName = '_upsertComaxData';
    logger.info(serviceName, functionName, 'Starting CmxProdS to CmxProdM upsert process.', { sessionId: sessionId });

    const allConfig = ConfigService.getAllConfig();
    const masterSchema = allConfig['schema.data.CmxProdM'];
    const stagingSchema = allConfig['schema.data.CmxProdS'];
    if (!masterSchema || !stagingSchema) {
        throw new Error('Comax master or staging schema not found.');
    }
    const masterHeaders = masterSchema.headers.split(',');
    const stagingHeaders = stagingSchema.headers.split(',');

    const masterData = ConfigService._getSheetDataAsMap('CmxProdM', masterHeaders, 'cpm_CmxId');
    const masterMap = masterData.map;

    const stagingKey = 'cps_CmxId'; 
    const stagingKeyIndex = stagingHeaders.indexOf(stagingKey);

    // Iterate through the fresh comaxProducts and update/insert into the master map
    comaxProducts.forEach(comaxProductRow => {
        const key = comaxProductRow[stagingKeyIndex] ? String(comaxProductRow[stagingKeyIndex]).trim() : null;
        if (key) {
            const newMasterRow = {};
            masterHeaders.forEach((masterHeader) => {
                const baseHeader = masterHeader.substring(masterHeader.indexOf('_') + 1);
                const stagingHeader = 'cps_' + baseHeader;
                const stagingIndex = stagingHeaders.indexOf(stagingHeader);
                if (stagingIndex !== -1) {
                    newMasterRow[masterHeader] = comaxProductRow[stagingIndex];
                }
            });
            masterMap.set(key, newMasterRow);
        }
    });

    // Prepare the final data array for writing back to the sheet
    const finalData = Array.from(masterMap.values()).map(rowObject => {
        return masterHeaders.map(header => rowObject[header] || '');
    });

    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const masterSheet = dataSpreadsheet.getSheetByName('CmxProdM');
    
    // More robustly clear the sheet and rewrite headers + data
    masterSheet.clear();
    masterSheet.getRange(1, 1, 1, masterHeaders.length).setValues([masterHeaders]).setFontWeight('bold');

    if (finalData.length > 0) {
        masterSheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
    }
    logger.info(serviceName, functionName, `Upsert to CmxProdM complete. Total rows: ${finalData.length}.`, { sessionId: sessionId });

    // Maintain SysProductAudit after CmxProdM is updated
    _maintainSysProductAudit(comaxProducts, sessionId);
  }

  /**
   * Maintains the SysProductAudit sheet by upserting Comax product data.
   * This ensures that SysProductAudit is synchronized with the latest CmxId and SKU from Comax.
   * @param {Array<Object>} comaxProducts - An array of Comax product objects (from ComaxAdapter).
   */
  function _maintainSysProductAudit(comaxProducts, sessionId) {
    const serviceName = 'ProductService';
    const functionName = '_maintainSysProductAudit';
    logger.info(serviceName, functionName, 'Starting SysProductAudit maintenance.', { sessionId: sessionId });

    const allConfig = ConfigService.getAllConfig();
    const sysProductAuditSchema = allConfig['schema.data.SysProductAudit'];
    if (!sysProductAuditSchema) {
        throw new Error('SysProductAudit schema not found in configuration.');
    }
    const sysProductAuditHeaders = sysProductAuditSchema.headers.split(',');

    // Load existing SysProductAudit data into a map keyed by pa_CmxId
    const auditMap = ConfigService._getSheetDataAsMap('SysProductAudit', sysProductAuditHeaders, 'pa_CmxId');
    // Ensure auditMap is not null/undefined if _getSheetDataAsMap can return null or if map property doesn't exist.
    const actualAuditMap = auditMap ? auditMap.map : new Map(); 

    let updatedCount = 0;
    let newCount = 0;
    let skippedCount = 0;

    // Iterate through the newly imported Comax products and upsert into the map
    comaxProducts.forEach(comaxProduct => {
        const cmxId = String(comaxProduct.cps_CmxId || '').trim();
        const sku = String(comaxProduct.cps_SKU || '').trim();

        if (!cmxId) {
            logger.warn(serviceName, functionName, `Skipping product with empty CmxId. SKU: ${sku}`, { sessionId: sessionId, sku: sku });
            skippedCount++;
            return; // Cannot process without a CmxId
        }

        if (actualAuditMap.has(cmxId)) {
            // Product exists, update SKU if it has changed
            const existingRow = actualAuditMap.get(cmxId);
            if (existingRow.pa_SKU !== sku) {
                existingRow.pa_SKU = sku;
                updatedCount++;
            }
        } else {
            // New product, create a new row object and add it to the map
            const newAuditRow = {};
            sysProductAuditHeaders.forEach(header => {
                newAuditRow[header] = ''; // Initialize all columns to empty
            });
            newAuditRow.pa_CmxId = cmxId;
            newAuditRow.pa_SKU = sku;
            actualAuditMap.set(cmxId, newAuditRow);
            newCount++;
        }
    });

    // Convert the fully updated map's values to a 2D array for writing
    const finalAuditData = Array.from(actualAuditMap.values()).map(rowObject => {
        return sysProductAuditHeaders.map(header => rowObject[header] || '');
    });

    // Clear and rewrite the entire SysProductAudit sheet
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const sysProductAuditSheet = dataSpreadsheet.getSheetByName('SysProductAudit');
    
    sysProductAuditSheet.clear();
    sysProductAuditSheet.getRange(1, 1, 1, sysProductAuditHeaders.length).setValues([sysProductAuditHeaders]).setFontWeight('bold');

    if (finalAuditData.length > 0) {
        sysProductAuditSheet.getRange(2, 1, finalAuditData.length, finalAuditData[0].length).setValues(finalAuditData);
    }
    
    logger.info(serviceName, functionName, `SysProductAudit synchronized. New: ${newCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}. Total rows: ${finalAuditData.length}.`, { sessionId: sessionId });
  }

  function _runWebProductsImport(executionContext) {
    const serviceName = 'ProductService';
    const functionName = '_runWebProductsImport';
    const { jobQueueSheetRowNumber, sessionId } = executionContext;
    logger.info(serviceName, functionName, `Starting Web Products (EN) import process for job row: ${jobQueueSheetRowNumber}.`, { sessionId: sessionId });
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobQueueSheetRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobQueueSheetRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const fileEncoding = ConfigService.getConfig('import.drive.web_products_en').file_encoding || 'UTF-8';
        const csvContent = file.getBlob().getDataAsString(fileEncoding);

        const productObjects = WebAdapter.processProductCsv(csvContent, 'map.web.product_columns');

        _populateStagingSheet(productObjects, sheetNames.WebProdS_EN, sessionId);
        logger.info(serviceName, functionName, 'Successfully populated WebProdS_EN staging sheet.', { sessionId: sessionId });
        
    // --- 2. Run Staging Validation ---
    const validationResult = ValidationLogic.runValidationSuite('web_staging', sessionId);
    const { quarantineTriggered } = ValidationOrchestratorService.processValidationResults(validationResult, sessionId);

    if (quarantineTriggered) {
        logger.warn(serviceName, functionName, 'Web Products staging validation triggered a quarantine.', { sessionId: sessionId });
        return 'QUARANTINED';
    }

        _upsertWebProductsData(sessionId);

        return 'COMPLETED';

    } catch (e) {
        logger.error(serviceName, functionName, `Failed to import Web Products (EN) data: ${e.message}`, e, { sessionId: sessionId });
        _updateJobStatus(executionContext, 'FAILED', `Web Products (EN) import failed: ${e.message}`); // Using new helper
        return 'FAILED';
    }
  }

  function _upsertWebProductsData(sessionId) {
    const serviceName = 'ProductService';
    const functionName = '_upsertWebProductsData';
    logger.info(serviceName, functionName, 'Starting UPDATE-ONLY process for WebProdM.', { sessionId: sessionId });

    const allConfig = ConfigService.getAllConfig();
    const stagingSchema = allConfig['schema.data.WebProdS_EN'];
    const masterSchema = allConfig['schema.data.WebProdM'];

    if (!stagingSchema || !masterSchema) {
        throw new Error('Web product staging or master schema not found.');
    }
    const stagingHeaders = stagingSchema.headers.split(',');
    const masterHeaders = masterSchema.headers.split(',');

    const stagingData = ConfigService._getSheetDataAsMap('WebProdS_EN', stagingHeaders, 'wps_ID');
    const masterData = ConfigService._getSheetDataAsMap('WebProdM', masterHeaders, 'wpm_WebIdEn');
    const masterMap = masterData.map;

    const stagingKey = stagingSchema.key_column;
    const stagingKeyIndex = stagingHeaders.indexOf(stagingKey);

    let updatedCount = 0;
    stagingData.values.forEach(stagingRow => {
        const key = stagingRow[stagingKeyIndex];
        if (key && masterMap.has(key)) {
            // Product exists in master, update its values
            const masterRow = masterMap.get(key);
            const stagingRowObject = {};
            stagingHeaders.forEach((h, i) => { stagingRowObject[h] = stagingRow[i]; });

            const stagingToMasterMap = ConfigService.getConfig('map.staging_to_master.web_products');
            for (const sKey in stagingToMasterMap) {
              if (stagingRowObject.hasOwnProperty(sKey)) {
                const mKey = stagingToMasterMap[sKey];
                masterRow[mKey] = stagingRowObject[sKey];
              }
            }

            masterMap.set(key, masterRow); // Put the updated row back in the map
            updatedCount++;
        }
        // If key does not exist in masterMap, we do nothing, as per user requirements.
    });

    logger.info(serviceName, functionName, `${updatedCount} existing products were updated in the master map.`, { sessionId: sessionId });

    // Convert the map back to a 2D array to write to the sheet
    const finalData = Array.from(masterMap.values()).map(rowObject => {
        return masterHeaders.map(header => rowObject[header] || '');
    });

    // Write the updated data back to WebProdM
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const masterSheet = dataSpreadsheet.getSheetByName('WebProdM');
    masterSheet.getRange(2, 1, masterSheet.getMaxRows() - 1, masterSheet.getMaxColumns()).clearContent();
    if (finalData.length > 0) {
        masterSheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
    }
    logger.info(serviceName, functionName, `Upsert to WebProdM complete. Total rows: ${finalData.length}.`, { sessionId: sessionId });
  }

  function processJob(executionContext) {
    const serviceName = 'ProductService';
    const functionName = 'processJob';
    const { jobType, jobQueueSheetRowNumber, sessionId } = executionContext;
    logger.info(serviceName, functionName, `Starting job: ${jobType} (Row: ${jobQueueSheetRowNumber})`, { sessionId: sessionId, jobType: jobType });


    try {
      let finalJobStatus = 'COMPLETED'; // Default to COMPLETED
      switch (jobType) {
        case 'import.drive.comax_products':
          finalJobStatus = _runComaxImport(executionContext);
          break;
        case 'import.drive.web_products_en':
          finalJobStatus = _runWebProductsImport(executionContext);
          break;
        case 'import.drive.web_translations_he':
          finalJobStatus = _runWebXltValidationAndUpsert(executionContext);
          break;
        case 'manual.validation.master':
          ValidationService.runValidationSuite('master_master', executionContext); // Pass executionContext
          finalJobStatus = 'COMPLETED'; // Assume validation suite will handle its own logging/errors
          break;
        case 'export.web.inventory':
          exportWebInventory(); // Call the export function
          finalJobStatus = 'COMPLETED';
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
      // Update job status in the queue
      _updateJobStatus(executionContext, finalJobStatus);
      
      if (finalJobStatus === 'COMPLETED') {
        OrchestratorService.finalizeJobCompletion(jobQueueSheetRowNumber);
      }

      LoggerService.info('ProductService', 'processJob', `Job ${jobType} completed with status: ${finalJobStatus}.`);
    } catch (e) {
      logger.error(serviceName, functionName, `Job ${jobType} failed: ${e.message}`, e, { sessionId: sessionId, jobType: jobType });
      _updateJobStatus(executionContext, 'FAILED', e.message);
      throw e; // Re-throw the error after logging and updating status
    }
  }

  function getProductWebIdBySku(sku) {
    if (skuToWebIdMap === null) {
      _buildSkuToWebIdMap();
    }
    const trimmedSku = String(sku).trim();
    if (skuToWebIdMap.has(trimmedSku)) {
      return skuToWebIdMap.get(trimmedSku);
    }
    LoggerService.warn('ProductService', 'getProductWebIdBySku', `SKU ${trimmedSku} not found in WebProdM cache.`);
    return null;
  }

  function exportWebInventory() {
    const functionName = 'exportWebInventory';
    LoggerService.info('ProductService', functionName, 'Starting WooCommerce inventory update export with change detection.');

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

      // 1. Get CmxProdM data for new stock and price
      const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
      if (!cmxSheet) throw new Error('CmxProdM sheet not found');
      const cmxData = ConfigService._getSheetDataAsMap(allConfig['system.sheet_names'].CmxProdM, allConfig['schema.data.CmxProdM'].headers.split(','), 'cpm_SKU');
      const cmxMap = cmxData.map;

      // 2. Get On-Hold Inventory
      const onHoldSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].SysInventoryOnHold);
      const onHoldData = onHoldSheet.getLastRow() > 1 ? onHoldSheet.getRange(2, 1, onHoldSheet.getLastRow() - 1, 2).getValues() : [];
      const onHoldMap = onHoldData.reduce((map, row) => {
        map[row[0]] = row[1]; // SKU -> OnHoldQuantity
        return map;
      }, {});

      // 3. Get WebProdM data for existing stock and price
      const webProdMSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      if (!webProdMSheet) throw new Error('WebProdM sheet not found');
      const webProdMData = ConfigService._getSheetDataAsMap(allConfig['system.sheet_names'].WebProdM, allConfig['schema.data.WebProdM'].headers.split(','), 'wpm_WebIdEn');
      const webProdMMap = webProdMData.map;

      // 4. Compare new values with existing and prepare export data for changed products
      const exportProducts = [];
      let productsChecked = 0;
      let productsSkipped = 0; // Skipped because not in Comax

      for (const [webIdEn, webProdMRow] of webProdMMap.entries()) {
        productsChecked++;
        const sku = String(webProdMRow.wpm_SKU || '').trim();

        if (!cmxMap.has(sku)) {
          productsSkipped++;
          LoggerService.warn('ProductService', functionName, `Skipping product ${sku} (${webProdMRow.wpm_NameEn}): Not found in Comax master data.`);
          continue; // Cannot determine new price/stock, so skip.
        }
        const cmxProduct = cmxMap.get(sku);

        // Get existing values from WebProdM
        const oldStock = Number(webProdMRow.wpm_Stock) || 0;
        const oldPrice = webProdMRow.wpm_Price;

        // Calculate new values
        const newPrice = cmxProduct.cpm_Price;
        let comaxStock = Number(cmxProduct.cpm_Stock || 0);
        const onHoldStock = Number(onHoldMap[sku] || 0);

        // Apply legacy exclude logic: if cpm_Exclude is true, stock becomes 0
        if (String(cmxProduct.cpm_Exclude).toUpperCase() === 'TRUE') {
            comaxStock = 0;
        }
        
        const newStock = Math.max(0, comaxStock - onHoldStock);

        // Compare and add to export list if changed
        if (newStock !== oldStock || newPrice !== oldPrice) {
          exportProducts.push({
            ID: webProdMRow.wpm_WebIdEn,
            SKU: sku,
            WName: webProdMRow.wpm_NameEn,
            Stock: newStock,
            RegularPrice: newPrice
          });
        }
      }

      LoggerService.info('ProductService', functionName, `Checked ${productsChecked} products. Skipped ${productsSkipped} (not in Comax). Found ${exportProducts.length} products with changed stock or price.`);

      if (exportProducts.length === 0) {
        LoggerService.info('ProductService', functionName, 'No product changes detected. Export file will not be created.');
        return { success: true, message: 'No product changes detected. Export file not created.' }; // Exit if there's nothing to export
      }

      // 5. Format and save the CSV
      const csvContent = WooCommerceFormatter.formatInventoryUpdate(exportProducts);

      const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
      const fileName = `ProductInventory_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm')}.csv`;
      const file = DriveApp.getFolderById(exportFolderId).createFile(fileName, csvContent, MimeType.CSV);
      LoggerService.info('ProductService', functionName, `WooCommerce inventory update file created: ${file.getName()} (ID: ${file.getId()})`);

      // Close the "signal" task that indicated the export was ready
      try {
        const signalTasks = WebAppTasks.getOpenTasksByTypeId('task.export.web_inventory_ready');
        if (signalTasks && signalTasks.length > 0) {
          LoggerService.info('ProductService', functionName, `Found and closing ${signalTasks.length} 'web_inventory_ready' signal task(s).`);
          signalTasks.forEach(task => {
            TaskService.completeTask(task.st_TaskId);
          });
        }
      } catch (e) {
        LoggerService.error('ProductService', functionName, `Could not close signal task: ${e.message}`, e);
        // Do not re-throw, proceed to create the confirmation task anyway
      }

      const taskTitle = 'Confirm Web Inventory Export';
      const taskNotes = `Web inventory export file ${file.getName()} has been generated. Please confirm that the web inventory has been updated.`;
      TaskService.createTask('task.confirmation.web_inventory_export', file.getId(), taskTitle, taskNotes);

      return { success: true, message: 'Web Inventory Export file created: ' + file.getName() };

    } catch (e) {
      LoggerService.error('ProductService', functionName, `Error generating WooCommerce inventory update export: ${e.message}`, e);
      throw e;
    }
  }

  function getProductDetails(sku) {
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      
      LoggerService.info('ProductService', 'getProductDetails', `Fetching details for SKU ${sku} using in-memory search...`);

      const sheetNames = {
        master: allConfig['system.sheet_names'].WebDetM,
        staging: allConfig['system.sheet_names'].WebDetS,
        comax: allConfig['system.sheet_names'].CmxProdM,
        webProd: allConfig['system.sheet_names'].WebProdM
      };

      const schemas = {
        master: allConfig['schema.data.WebDetM'],
        staging: allConfig['schema.data.WebDetS'],
        comax: allConfig['schema.data.CmxProdM'],
        webProd: allConfig['schema.data.WebProdM']
      };

      // Helper to fetch row object using getValues (Legacy Method)
      const getRowObject = (sheetName, schema, keyCol) => {
        LoggerService.info('ProductService', 'getProductDetails', `Fetching data for sheet: ${sheetName}`);
        if (!sheetName || !schema) {
            LoggerService.warn('ProductService', 'getProductDetails', `Missing sheetName or schema for ${sheetName}`);
            return null;
        }
        
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
             LoggerService.warn('ProductService', 'getProductDetails', `Sheet '${sheetName}' not found.`);
             return null;
        }
        
        // Optimization: Check if sheet is empty
        if (sheet.getLastRow() < 2) {
             LoggerService.info('ProductService', 'getProductDetails', `Sheet '${sheetName}' is empty.`);
             return null;
        }

        const headers = schema.headers.split(',');
        
        // Get all data values (Legacy approach)
        const data = sheet.getDataRange().getValues();
        LoggerService.info('ProductService', 'getProductDetails', `Loaded ${data.length} rows from ${sheetName}`);

        const sheetHeaders = data[0];
        const keyIndex = sheetHeaders.indexOf(keyCol);
        
        if (keyIndex === -1) {
             LoggerService.warn('ProductService', 'getProductDetails', `Key column '${keyCol}' not found in sheet '${sheetName}'.`);
             return null;
        }

        // Find the row
        const targetSku = String(sku).trim();
        const rowData = data.find(r => String(r[keyIndex]).trim() === targetSku);

        if (!rowData) {
            LoggerService.info('ProductService', 'getProductDetails', `SKU ${targetSku} not found in ${sheetName}`);
            return null;
        }

        const rowObj = {};
        headers.forEach((h) => {
             const headerIndex = sheetHeaders.indexOf(h);
             if(headerIndex > -1) rowObj[h] = rowData[headerIndex];
        });
        LoggerService.info('ProductService', 'getProductDetails', `Successfully found row for ${sheetName}`);
        return rowObj;
      };

      let masterData = getRowObject(sheetNames.master, schemas.master, 'wdm_SKU');
      const stagingData = getRowObject(sheetNames.staging, schemas.staging, 'wds_SKU');
      const comaxData = getRowObject(sheetNames.comax, schemas.comax, 'cpm_SKU');
      const webProdData = getRowObject(sheetNames.webProd, schemas.webProd, 'wpm_SKU');

      // Fallback logic for names if WebDetM is incomplete
      if (!masterData) masterData = {}; // Initialize if null so we can populate it
      
      if (!masterData.wdm_NameEn && webProdData && webProdData.wpm_NameEn) {
          masterData.wdm_NameEn = webProdData.wpm_NameEn;
      }
      if (!masterData.wdm_NameHe && comaxData && comaxData.cpm_NameHe) {
          masterData.wdm_NameHe = comaxData.cpm_NameHe;
      }

      // Fetch region lookup data
      const allTexts = LookupService.getLookupMap('map.text_lookups'); // maps to SysLkp_Texts
      const regionsMap = new Map();
      allTexts.forEach((value, key) => {
          if (value.slt_Note === 'Region') {
              regionsMap.set(key, value);
          }
      });
      // Convert to array and sort by slt_TextHE
      const regions = Array.from(regionsMap.values()).sort((a, b) => {
          const textA = a.slt_TextHE || '';
          const textB = b.slt_TextHE || '';
          return textA.localeCompare(textB);
      }).map(r => ({ code: r.slt_Code, textEN: r.slt_TextEN, textHE: r.slt_TextHE }));

      // Generate ABV options
      const abvOptions = [];
      for (let i = 12.0; i <= 14.5; i += 0.5) {
          abvOptions.push(i.toFixed(1));
      }

      // Fetch Grape lookup data
      const allGrapes = LookupService.getLookupMap('map.grape_lookups'); // maps to SysLkp_Grapes
      const grapes = Array.from(allGrapes.values()).sort((a, b) => {
          const textA = a.slg_TextEN || '';
          const textB = b.slg_TextEN || '';
          return textA.localeCompare(textB);
      }).map(g => ({ code: g.slg_Code, textEN: g.slg_TextEN, textHE: g.slg_NameHe }));

      // Fetch Kashrut lookup data
      const allKashrut = LookupService.getLookupMap('map.kashrut_lookups'); // maps to SysLkp_Kashrut
      const kashrut = Array.from(allKashrut.values()).sort((a, b) => {
          const textA = a.slk_TextEN || '';
          const textB = b.slk_TextEN || '';
          return textA.localeCompare(textB);
      }).map(k => ({ code: k.slk_Code, textEN: k.slk_TextEN, textHE: k.slk_TextHE }));

      const result = {
        master: masterData,
        staging: stagingData || null,
        comax: comaxData || null,
        regions: regions,
        abvOptions: abvOptions,
        grapes: grapes,
        kashrut: kashrut
      };
      
      // Return as JSON string to avoid serialization issues
      return JSON.stringify(result);

    } catch (e) {
      LoggerService.error('ProductService', 'getProductDetails', `Error fetching details for SKU ${sku}: ${e.message}`, e);
      throw e;
    }
  }

  function submitProductDetails(taskId, sku, formData) {
    try {
      LoggerService.info('ProductService', 'submitProductDetails', `Submitting details for SKU ${sku}, Task ${taskId}`);
      
      const allConfig = ConfigService.getAllConfig();
      const stagingSchema = allConfig['schema.data.WebDetS'];
      const stagingHeaders = stagingSchema.headers.split(',');
      
      const rowData = {};
      stagingHeaders.forEach(header => {
        // Handle TaskId and SKU directly
        if (header === 'wds_TaskId') {
            rowData[header] = taskId;
            return;
        }
        if (header === 'wds_SKU') {
            rowData[header] = sku;
            return;
        }

        // Map wds_ header back to wdm_ key to find value in formData
        // Example: wds_NameEn -> wdm_NameEn
        const masterKey = header.replace('wds_', 'wdm_');
        let value = formData[masterKey];

        if (header === 'wds_ABV') {
            value = parseFloat(value);
            if (isNaN(value)) {
                value = ''; 
            } else {
                value = value / 100; // Convert percentage (12.5) to decimal (0.125)
            }
        }
        rowData[header] = value !== undefined ? value : '';
      });
      
      // 2. Upsert into WebDetS
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const stagingSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetS);
      
      const existingData = stagingSheet.getDataRange().getValues();
      const skuIndex = stagingHeaders.indexOf('wds_SKU');
      let rowIndex = -1;
      
      // Simple linear search for upsert
      if (existingData.length > 1) {
        for (let i = 1; i < existingData.length; i++) {
          if (String(existingData[i][skuIndex]) === String(sku)) {
            rowIndex = i + 1; // 1-based index
            break;
          }
        }
      }

      const rowValues = stagingHeaders.map(h => rowData[h]);

      if (rowIndex > 0) {
        stagingSheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        stagingSheet.appendRow(rowValues);
      }

      // 3. Update Task Status
      TaskService.updateTaskStatus(taskId, 'Review');
      
      return { success: true };

    } catch (e) {
      LoggerService.error('ProductService', 'submitProductDetails', `Error submitting details: ${e.message}`, e);
      throw e;
    }
  }

  function acceptProductDetails(taskId, sku, finalData) {
    try {
      LoggerService.info('ProductService', 'acceptProductDetails', `Accepting details for SKU ${sku}, Task ${taskId}`);

      const allConfig = ConfigService.getAllConfig();
      const masterSchema = allConfig['schema.data.WebDetM'];
      const masterHeaders = masterSchema.headers.split(',');

      // 1. Prepare row data for Master
      const rowData = {};
      masterHeaders.forEach(header => {
        // Map wdm_ header to wds_ key to find value in finalData (assuming finalData comes from staging/admin UI with wds keys)
        // Or if finalData uses wdm keys, use directly. 
        // Given Admin UI likely mirrors Manager UI, let's assume it sends wdm_ keys for now to match submitProductDetails logic.
        // But if it sends wds_ keys (raw staging data), we need to map.
        // Let's support both for robustness.
        
        let value = finalData[header]; // Try wdm_ key
        if (value === undefined) {
             const stagingKey = header.replace('wdm_', 'wds_');
             value = finalData[stagingKey]; // Try wds_ key
        }
        
        rowData[header] = value !== undefined ? value : '';
      });
      // Ensure SKU matches
      rowData['wdm_SKU'] = sku;

      // 2. Upsert into WebDetM
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const masterSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetM);

      const existingData = masterSheet.getDataRange().getValues();
      const skuIndex = masterHeaders.indexOf('wdm_SKU');
      let rowIndex = -1;

      if (existingData.length > 1) {
        for (let i = 1; i < existingData.length; i++) {
          if (String(existingData[i][skuIndex]) === String(sku)) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      const rowValues = masterHeaders.map(h => rowData[h]);

      if (rowIndex > 0) {
        masterSheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        masterSheet.appendRow(rowValues);
      }
      ConfigService.forceReload(); // Force reload of config cache after updating master data

      // 3. Update Task Status
      TaskService.updateTaskStatus(taskId, 'Accepted');

      return { success: true };

    } catch (e) {
      LoggerService.error('ProductService', 'acceptProductDetails', `Error accepting details: ${e.message}`, e);
      throw e;
    }
  }

  function generateDetailExport(sessionId) { // Added sessionId
    const serviceName = 'ProductService';
    const functionName = 'generateDetailExport';
    logger.info(serviceName, functionName, 'Starting export of accepted product details to Google Sheet.', { sessionId: sessionId });
    try {
        const tasks = WebAppTasks.getOpenTasksByTypeId('task.validation.vintage_mismatch', sessionId); // Use specific task type
        const acceptedTasks = tasks.filter(t => t.st_Status === 'Accepted');
        
        if (acceptedTasks.length === 0) {
             return { success: false, message: 'No accepted tasks found for export.' }; // Changed to false for no tasks
        }
        
        const skus = acceptedTasks.map(t => t.st_LinkedEntityId);
        
        // 2. Fetch Data
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

        // Helper to get map
        const getMap = (sheetName, schemaKey, keyCol) => {
            const headers = allConfig[schemaKey].headers.split(',');
            return ConfigService._getSheetDataAsMap(sheetName, headers, keyCol).map;
        };

        const webDetMap = getMap('WebDetM', 'schema.data.WebDetM', 'wdm_SKU');
        const cmxMap = getMap('CmxProdM', 'schema.data.CmxProdM', 'cpm_SKU');
        
        // Load Lookups
        const lookupMaps = {
            texts: LookupService.getLookupMap('map.text_lookups'),
            grapes: LookupService.getLookupMap('map.grape_lookups'),
            kashrut: LookupService.getLookupMap('map.kashrut_lookups')
        };

        // --- DEBUGGING LOGS for webDetMap ---
        logger.info(serviceName, functionName, `WebDetM map size: ${webDetMap.size}`, { sessionId: sessionId });
        logger.info(serviceName, functionName, `WebDetM map first 5 keys: ${Array.from(webDetMap.keys()).slice(0, 5).join(', ')}`, { sessionId: sessionId });
        logger.info(serviceName, functionName, `Is SKU '7290017324487' in WebDetM map? ${webDetMap.has('7290017324487')}`, { sessionId: sessionId });
        // --- END DEBUGGING LOGS ---


        // 3. Prepare data for the new Google Sheet
        const exportDataRows = [];
        const headers = [
            'SKU', 
            'Product Title (EN)', 
            'Short Description (EN)', 
            'Long Description (EN)', 
            'Short Description (HE)', 
            'Long Description (HE)'
        ];
        exportDataRows.push(headers);

        const skippedSkus = [];
        skus.forEach(rawSku => {
            const sku = String(rawSku); // Convert SKU to string for consistent lookup
            // --- DEBUGGING LOGS for each SKU lookup ---
            logger.info(serviceName, functionName, `Looking up SKU: '${sku}' (Type: ${typeof sku})`, { sessionId: sessionId });
            logger.info(serviceName, functionName, `webDetMap.has('${sku}'): ${webDetMap.has(sku)}`, { sessionId: sessionId });
            if (webDetMap.size > 0) {
                logger.info(serviceName, functionName, `First map key type: ${typeof Array.from(webDetMap.keys())[0]}`, { sessionId: sessionId });
            }
            // --- END DEBUGGING LOGS ---

            const webDetRow = webDetMap.get(sku);
            const cmxRow = cmxMap.get(sku);
            
            if (!webDetRow) {
                logger.warn(serviceName, functionName, `Skipping SKU ${sku}: Details not found in WebDetM.`, { sessionId: sessionId, sku: sku });
                skippedSkus.push(sku);
                return; // Continue to the next SKU
            }

            const productTitleEn = webDetRow.wdm_NameEn || (cmxRow ? cmxRow.cpm_NameHe : '');
            const shortDescriptionEn = webDetRow.wdm_ShortDescrEn || '';
            const shortDescriptionHe = webDetRow.wdm_ShortDescrHe || '';

            const longDescriptionEnHtml = WooCommerceFormatter.formatDescriptionHTML(sku, webDetRow, cmxRow, 'EN', lookupMaps, true);
            const longDescriptionHeHtml = WooCommerceFormatter.formatDescriptionHTML(sku, webDetRow, cmxRow, 'HE', lookupMaps, true);
            
            exportDataRows.push([
                sku,
                productTitleEn,
                shortDescriptionEn,
                longDescriptionEnHtml,
                shortDescriptionHe,
                longDescriptionHeHtml
            ]);
        });

        if (exportDataRows.length <= 1 && skippedSkus.length === skus.length) { // Only headers present AND all SKUs were skipped or no SKUs were processed
            logger.info(serviceName, functionName, 'No product data was successfully exported.', { sessionId: sessionId });
            return { success: false, message: 'No product data was successfully exported. All selected products were skipped.' };
        }

        // 4. Create and format the new Google Sheet
        const newSpreadsheetName = `ProductDetails_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm')}`;
        const newSpreadsheet = SpreadsheetApp.create(newSpreadsheetName);
        const sheet = newSpreadsheet.getSheets()[0];
        sheet.setName('Product Details'); 

        // Write data
        sheet.getRange(1, 1, exportDataRows.length, headers.length).setValues(exportDataRows);

        // Apply formatting
        sheet.setFrozenRows(1); // Freeze header row
        sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
             .setWrap(true)
             .setVerticalAlignment('top');

        // Apply specific column widths
        sheet.setColumnWidth(4, 550); // Column D: Long Description (EN)
        sheet.setColumnWidth(6, 550); // Column F: Long Description (HE)

        // Set vertical alignment for the header row to bottom
        sheet.getRange(1, 1, 1, headers.length).setVerticalAlignment('bottom');

        sheet.autoResizeColumns(1, headers.length); // Auto-resize columns for better readability

        // Move the new spreadsheet to the designated folder
        const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
        
        logger.info(serviceName, functionName, `Attempting to move spreadsheet ID: ${newSpreadsheet.getId()} ('${newSpreadsheet.getName()}') to folder ID: ${exportFolderId}`, { sessionId: sessionId });

        try {
            const folder = DriveApp.getFolderById(exportFolderId);
            DriveApp.getFileById(newSpreadsheet.getId()).moveTo(folder);
            logger.info(serviceName, functionName, `Successfully moved spreadsheet to folder ID: ${exportFolderId}`, { sessionId: sessionId, fileId: newSpreadsheet.getId() });
        } catch (moveError) {
            logger.error(serviceName, functionName, `Error moving spreadsheet to folder ID ${exportFolderId}: ${moveError.message}`, moveError, { sessionId: sessionId, fileId: newSpreadsheet.getId(), folderId: exportFolderId });
            return { 
                success: false, // Indicate failure to move
                message: `Export created in root, but failed to move to folder: ${moveError.message}. Sheet URL: ${newSpreadsheet.getUrl()}`, 
                fileId: newSpreadsheet.getId(),
                fileUrl: newSpreadsheet.getUrl()
            };
        }
        
        logger.info(serviceName, functionName, `Created export spreadsheet: ${newSpreadsheet.getName()} (ID: ${newSpreadsheet.getId()}), URL: ${newSpreadsheet.getUrl()}`, { sessionId: sessionId, fileId: newSpreadsheet.getId(), fileName: newSpreadsheet.getName(), fileUrl: newSpreadsheet.getUrl() });

        let returnSuccess = true;
        let returnMessage = `Exported ${exportDataRows.length - 1} products to Google Sheet: ${newSpreadsheet.getName()}`;
        if (skippedSkus.length > 0) {
            returnSuccess = false; // Indicate partial success/failure
            returnMessage += ` (Skipped ${skippedSkus.length} products: ${skippedSkus.join(', ')})`;
        } else if (exportDataRows.length <=1 && skippedSkus.length === 0) {
            // This case should be caught by the earlier if-condition for `exportDataRows.length <= 1`,
            // but included for robustness.
            returnSuccess = false;
            returnMessage = 'No product data was successfully exported.';
        }

        return { 
            success: returnSuccess, 
            message: returnMessage, 
            fileId: newSpreadsheet.getId(),
            fileUrl: newSpreadsheet.getUrl()
        };

    } catch (e) {
        logger.error(serviceName, functionName, `Error generating product details export: ${e.message}`, e, { sessionId: sessionId });
        throw e;
    }
  }

    function generateNewProductExport(sessionId) { // Added sessionId

      const serviceName = 'ProductService';

      const functionName = 'generateNewProductExport';

      logger.info(serviceName, functionName, 'Starting export of new products to Google Sheet.', { sessionId: sessionId });

      try {

          // 1. Identify Accepted Tasks

          const tasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.onboarding.add_product', 'Accepted', sessionId); // Pass sessionId

          

          if (tasks.length === 0) {

               return { success: false, message: 'No new products ready for export.' };

          }

          

          const skus = tasks.map(t => t.st_LinkedEntityId);

          

          // 2. Fetch Data

          const allConfig = ConfigService.getAllConfig();

          

          // Helper to get map

          const getMap = (sheetName, schemaKey, keyCol) => {

              const headers = allConfig[schemaKey].headers.split(',');

              return ConfigService._getSheetDataAsMap(sheetName, headers, keyCol).map;

          };

  

          const webDetMap = getMap('WebDetM', 'schema.data.WebDetM', 'wdm_SKU');

          const cmxMap = getMap('CmxProdM', 'schema.data.CmxProdM', 'cpm_SKU');

          

          // Load Lookups

          const lookupMaps = {

              texts: LookupService.getLookupMap('map.text_lookups'),

              grapes: LookupService.getLookupMap('map.grape_lookups'),

              kashrut: LookupService.getLookupMap('map.kashrut_lookups')

          };

  

          // 3. Prepare data

          const exportDataRows = [];

          const headers = [

              'SKU', 

              'Name (EN)', 

              'Price',

              'Stock',

              'Short Description (EN)', 

              'Long Description (EN)', 

              'Long Description (HE)'

          ];

          exportDataRows.push(headers);

  

          skus.forEach(rawSku => {

              const sku = String(rawSku);

              const webDetRow = webDetMap.get(sku);

              const cmxRow = cmxMap.get(sku);

              

              if (!webDetRow) {

                  logger.warn(serviceName, functionName, `Skipping SKU ${sku}: Details not found in WebDetM.`, { sessionId: sessionId, sku: sku });

                  return;

              }

  

              const nameEn = webDetRow.wdm_NameEn || '';

              const price = cmxRow ? cmxRow.cpm_Price : 0;

              const stock = cmxRow ? cmxRow.cpm_Stock : 0;

              

              const shortDescriptionEn = webDetRow.wdm_ShortDescrEn || '';

              const longDescriptionEnHtml = WooCommerceFormatter.formatDescriptionHTML(sku, webDetRow, cmxRow, 'EN', lookupMaps, true);

              const longDescriptionHeHtml = WooCommerceFormatter.formatDescriptionHTML(sku, webDetRow, cmxRow, 'HE', lookupMaps, true);

              

              exportDataRows.push([

                  sku,

                  nameEn,

                  price,

                  stock,

                  shortDescriptionEn,

                  longDescriptionEnHtml,

                  longDescriptionHeHtml

              ]);

          });

  

          if (exportDataRows.length <= 1) {

              return { success: false, message: 'No data found to export.' };

          }

  

          // 4. Create Sheet

          const fileName = `NewProducts_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm')}`;

          const newSpreadsheet = SpreadsheetApp.create(fileName);

          const sheet = newSpreadsheet.getSheets()[0];

          

          sheet.getRange(1, 1, exportDataRows.length, headers.length).setValues(exportDataRows);

          

          // Formatting

          sheet.setFrozenRows(1);

          sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

          sheet.autoResizeColumns(1, headers.length);

  

          // Move to Export Folder

          const exportFolderId = allConfig['system.folder.jlmops_exports'].id;

          try {

              const folder = DriveApp.getFolderById(exportFolderId);

              DriveApp.getFileById(newSpreadsheet.getId()).moveTo(folder);

          } catch (moveError) {

              logger.warn(serviceName, functionName, `Failed to move to export folder: ${moveError.message}`, { sessionId: sessionId, fileId: newSpreadsheet.getId(), folderId: exportFolderId });

          }

  

          return { 

              success: true, 

              message: `Exported ${exportDataRows.length - 1} new products to ${fileName}`, 

              fileId: newSpreadsheet.getId(),

              fileUrl: newSpreadsheet.getUrl()

          };

  

      } catch (e) {

          logger.error(serviceName, functionName, `Error: ${e.message}`, e, { sessionId: sessionId });

          throw e;

      }

    }

  function confirmWebUpdates(sessionId) { // Added sessionId
    const serviceName = 'ProductService';
    const functionName = 'confirmWebUpdates';
    logger.info(serviceName, functionName, 'Marking exported tasks as Completed.', { sessionId: sessionId });
    try {
        const tasks = WebAppTasks.getOpenTasksByTypeId('task.validation.vintage_mismatch', sessionId); // Use specific task type
        const acceptedTasks = tasks.filter(t => t.st_Status === 'Accepted');
        
        let count = 0;
        acceptedTasks.forEach(t => {
            TaskService.updateTaskStatus(t.st_TaskId); // TaskService needs sessionId too
            count++;
        });
        
        logger.info(serviceName, functionName, `Completed ${count} tasks.`, { sessionId: sessionId, completedTasks: count });
        return { success: true, message: `Marked ${count} tasks as Completed.` };

    } catch (e) {
        logger.error(serviceName, functionName, `Error confirming updates: ${e.message}`, e, { sessionId: sessionId });
        throw e;
    }
  }

  /**
   * Generates HTML previews for a product based on the provided data (from frontend).
   * @param {string} sku The product SKU.
   * @param {Object} formData The form data from the UI.
   * @returns {Object} { htmlEn, htmlHe }
   */
    function getProductHtmlPreview(sku, formData, comaxData, lang, lookupMaps, isForExport, sessionId) { // Added sessionId
        const serviceName = 'ProductService';
        const functionName = 'getProductHtmlPreview';
        try {
            // Use the comaxData passed as an argument directly
            const cmxRow = comaxData;
  
            // 2. Load Lookups
            const lookupMaps = {
                texts: LookupService.getLookupMap('map.text_lookups'),
                grapes: LookupService.getLookupMap('map.grape_lookups'),
                kashrut: LookupService.getLookupMap('map.kashrut_lookups')
            };
  
            // 3. Generate HTML
            const htmlEn = WooCommerceFormatter.formatDescriptionHTML(sku, formData, cmxRow, 'EN', lookupMaps, false);
            const htmlHe = WooCommerceFormatter.formatDescriptionHTML(sku, formData, cmxRow, 'HE', lookupMaps, false);
  
            return { htmlEn: htmlEn, htmlHe: htmlHe };
  
        } catch (e) {
            logger.error(serviceName, functionName, `Error generating preview: ${e.message}`, e, { sessionId: sessionId, sku: sku });
            throw e;
        }
    }
  /**
   * Transitions a product suggestion task to a full onboarding task.
   * @param {string} suggestionTaskId The ID of the suggestion task.
   * @param {string} sku The product SKU.
   * @param {string} suggestedNameEn The confirmed English name.
   * @param {string} suggestedNameHe The confirmed Hebrew name.
   */
  function acceptProductSuggestion(suggestionTaskId, sku, suggestedNameEn, suggestedNameHe, sessionId) { // Added sessionId
    const serviceName = 'ProductService';
    const functionName = 'acceptProductSuggestion';
    logger.info(serviceName, functionName, `Accepting suggestion for SKU ${sku}`, { sessionId: sessionId, sku: sku, suggestionTaskId: suggestionTaskId });
    try {
      // 1. Complete the suggestion task
      TaskService.completeTask(suggestionTaskId); // TaskService needs sessionId too

      // 2. Create the onboarding task
      const title = `Add New Product: ${suggestedNameEn} (${sku})`;
      const notes = `Approved suggestion. \nEN Name: ${suggestedNameEn}\nHE Name: ${suggestedNameHe}`;
      TaskService.createTask('task.onboarding.add_product', sku, title, notes); // TaskService needs sessionId too
      
      // 3. Pre-populate WebDetS with the approved names to save the manager time
      // We can reuse submitProductDetails logic or just write directly. 
      // Let's use a lightweight direct write to WebDetS for efficiency.
      const allConfig = ConfigService.getAllConfig();
      const stagingSchema = allConfig['schema.data.WebDetS'];
      const stagingHeaders = stagingSchema.headers.split(',');
      const rowData = new Array(stagingHeaders.length).fill('');
      
      // Map indices
      const skuIdx = stagingHeaders.indexOf('wds_SKU');
      const nameEnIdx = stagingHeaders.indexOf('wds_NameEn');
      const nameHeIdx = stagingHeaders.indexOf('wds_NameHe');

      if (skuIdx > -1) rowData[skuIdx] = sku;
      if (nameEnIdx > -1) rowData[nameEnIdx] = suggestedNameEn;
      if (nameHeIdx > -1) rowData[nameHeIdx] = suggestedNameHe;
      
      // Upsert to WebDetS
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const stagingSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetS);
      const existingData = stagingSheet.getDataRange().getValues();
      let rowIndex = -1;
      if (existingData.length > 1) {
        for (let i = 1; i < existingData.length; i++) {
          if (String(existingData[i][skuIdx]) === String(sku)) {
            rowIndex = i + 1;
            break;
          }
        }
      }
      if (rowIndex > 0) {
        stagingSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        stagingSheet.appendRow(rowData);
      }

      return { success: true };
    } catch (e) {
      logger.error(serviceName, functionName, `Error: ${e.message}`, e, { sessionId: sessionId, sku: sku, suggestionTaskId: suggestionTaskId });
      throw e;
    }
  }

  /**
   * The "Hot Insert" Engine.
   * Validates inputs and synchronously inserts the new product into all master sheets.
   * @param {string} onboardingTaskId The ID of the onboarding task.
   * @param {string} sku The product SKU.
   * @param {string} wooIdEn The WooCommerce Product ID (English).
   * @param {string} wooIdHe The WooCommerce Product ID (Hebrew).
   */
  function linkAndFinalizeNewProduct(onboardingTaskId, sku, wooIdEn, wooIdHe, sessionId) { // Added sessionId
    const serviceName = 'ProductService';
    const functionName = 'linkAndFinalizeNewProduct';
    logger.info(serviceName, functionName, `Starting Hot Insert for SKU ${sku}. IDs: ${wooIdEn} / ${wooIdHe}`, { sessionId: sessionId, sku: sku, wooIdEn: wooIdEn, wooIdHe: wooIdHe });
    
    if (!sku || !wooIdEn || !wooIdHe) {
      throw new Error('Missing required parameters: SKU, WooIdEn, or WooIdHe.');
    }

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

      // --- 1. Load Master Sheets ---
      const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
      const webProdSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      const webXltSheet = spreadsheet.getSheetByName('WebXltM');
      const auditSheet = spreadsheet.getSheetByName('SysProductAudit');
      const webDetSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetM);

      if (!cmxSheet || !webProdSheet || !webXltSheet || !auditSheet || !webDetSheet) {
        throw new Error('One or more master sheets are missing.');
      }

      // --- 2. Validation Checks ---
      
      // A. Check if SKU exists in Comax
      const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
      const cmxSkuIdx = cmxHeaders.indexOf('cpm_SKU');
      const cmxData = cmxSheet.getDataRange().getValues();
      const cmxRowIdx = cmxData.findIndex(row => String(row[cmxSkuIdx]).trim() === String(sku).trim());
      
      if (cmxRowIdx === -1) {
        throw new Error(`SKU ${sku} not found in Comax Master (CmxProdM). Cannot link.`);
      }
      const cmxRowData = cmxData[cmxRowIdx]; // Keep for later data copying

      // B. Check if Woo IDs are already in use
      const webProdHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
      const webIdIdx = webProdHeaders.indexOf('wpm_WebIdEn');
      const webProdData = webProdSheet.getDataRange().getValues();
      const duplicateEn = webProdData.some(row => String(row[webIdIdx]).trim() === String(wooIdEn).trim());
      if (duplicateEn) throw new Error(`WooCommerce ID (EN) ${wooIdEn} is already in use in WebProdM.`);

      const webXltHeaders = allConfig['schema.data.WebXltM'].headers.split(',');
      const xltIdHeIdx = webXltHeaders.indexOf('wxl_WebIdHe');
      const webXltData = webXltSheet.getDataRange().getValues();
      const duplicateHe = webXltData.some(row => String(row[xltIdHeIdx]).trim() === String(wooIdHe).trim());
      if (duplicateHe) throw new Error(`WooCommerce ID (HE) ${wooIdHe} is already in use in WebXltM.`);

      // --- 3. Perform Hot Inserts (Synchronous Writes) ---

      // A. Update CmxProdM: Set cpm_IsWeb to TRUE
      const cmxIsWebIdx = cmxHeaders.indexOf('cpm_IsWeb');
      if (cmxIsWebIdx > -1) {
         // +1 for 1-based index
         cmxSheet.getRange(cmxRowIdx + 1, cmxIsWebIdx + 1).setValue(true); 
      }

      // B. Insert into WebProdM
      // Required: wpm_WebIdEn, wpm_SKU, wpm_NameEn, wpm_PublishStatusEn, wpm_Stock, wpm_Price
      const newWebProdRow = new Array(webProdHeaders.length).fill('');
      
      // Map logic
      const wp_WebIdIdx = webProdHeaders.indexOf('wpm_WebIdEn');
      const wp_SkuIdx = webProdHeaders.indexOf('wpm_SKU');
      const wp_NameIdx = webProdHeaders.indexOf('wpm_NameEn');
      const wp_StatusIdx = webProdHeaders.indexOf('wpm_PublishStatusEn');
      const wp_StockIdx = webProdHeaders.indexOf('wpm_Stock');
      const wp_PriceIdx = webProdHeaders.indexOf('wpm_Price');

      // Get values from Comax row or Args
      const cpmNameHeIdx = cmxHeaders.indexOf('cpm_NameHe');
      const cpmStockIdx = cmxHeaders.indexOf('cpm_Stock');
      const cpmPriceIdx = cmxHeaders.indexOf('cpm_Price');

      // Get Name from WebDetM (should have been populated in previous 'Accept' step)
      // We need to fetch it to be safe, or pass it in. Fetching is safer.
      const webDetHeaders = allConfig['schema.data.WebDetM'].headers.split(',');
      const wd_SkuIdx = webDetHeaders.indexOf('wdm_SKU');
      const wd_NameEnIdx = webDetHeaders.indexOf('wdm_NameEn');
      const webDetData = webDetSheet.getDataRange().getValues();
      const webDetRow = webDetData.find(r => String(r[wd_SkuIdx]) === String(sku));
      const nameEn = webDetRow ? webDetRow[wd_NameEnIdx] : (cmxRowData[cpmNameHeIdx] || 'New Product');

      if (wp_WebIdIdx > -1) newWebProdRow[wp_WebIdIdx] = wooIdEn;
      if (wp_SkuIdx > -1) newWebProdRow[wp_SkuIdx] = sku;
      if (wp_NameIdx > -1) newWebProdRow[wp_NameIdx] = nameEn;
      if (wp_StatusIdx > -1) newWebProdRow[wp_StatusIdx] = 'publish'; // Assume published if we are finalizing
      if (wp_StockIdx > -1) newWebProdRow[wp_StockIdx] = cmxRowData[cpmStockIdx] || 0;
      if (wp_PriceIdx > -1) newWebProdRow[wp_PriceIdx] = cmxRowData[cpmPriceIdx] || 0;

      webProdSheet.appendRow(newWebProdRow);

      // C. Insert into WebXltM
      // Required: wxl_WebIdHe, wxl_NameHe, wxl_WebIdEn, wxl_SKU
      const newXltRow = new Array(webXltHeaders.length).fill('');
      const xl_IdHeIdx = webXltHeaders.indexOf('wxl_WebIdHe');
      const xl_IdEnIdx = webXltHeaders.indexOf('wxl_WebIdEn');
      const xl_SkuIdx = webXltHeaders.indexOf('wxl_SKU');
      const xl_NameHeIdx = webXltHeaders.indexOf('wxl_NameHe');

      if (xl_IdHeIdx > -1) newXltRow[xl_IdHeIdx] = wooIdHe;
      if (xl_IdEnIdx > -1) newXltRow[xl_IdEnIdx] = wooIdEn;
      if (xl_SkuIdx > -1) newXltRow[xl_SkuIdx] = sku;
      if (xl_NameHeIdx > -1) newXltRow[xl_NameHeIdx] = cmxRowData[cpmNameHeIdx]; // Default to Comax Name

      webXltSheet.appendRow(newXltRow);

      // D. Maintain SysProductAudit
      // Ensure row exists. If not, add it.
      const auditHeaders = allConfig['schema.data.SysProductAudit'].headers.split(',');
      const pa_SkuIdx = auditHeaders.indexOf('pa_SKU');
      const pa_CmxIdIdx = auditHeaders.indexOf('pa_CmxId');
      
      const auditData = auditSheet.getDataRange().getValues();
      const auditRowExists = auditData.some(r => String(r[pa_SkuIdx]) === String(sku));
      
      if (!auditRowExists) {
         const cpmCmxIdIdx = cmxHeaders.indexOf('cpm_CmxId');
         const cmxId = cmxRowData[cpmCmxIdIdx];
         
         const newAuditRow = new Array(auditHeaders.length).fill('');
         if (pa_SkuIdx > -1) newAuditRow[pa_SkuIdx] = sku;
         if (pa_CmxIdIdx > -1) newAuditRow[pa_CmxIdIdx] = cmxId;
         
         auditSheet.appendRow(newAuditRow);
      }
      
      // E. Update WebDetM with WebIdEn
      // The row exists (from 'Accept'), but needs the WebIdEn linked.
      const wd_WebIdIdx = webDetHeaders.indexOf('wdm_WebIdEn');
      if (webDetRow && wd_WebIdIdx > -1) {
          // Find row index again (data might have shifted if we were concurrent, but we are single threaded here mostly)
          const refreshWebDetData = webDetSheet.getDataRange().getValues();
          const refreshRowIdx = refreshWebDetData.findIndex(r => String(r[wd_SkuIdx]) === String(sku));
          if (refreshRowIdx > -1) {
              webDetSheet.getRange(refreshRowIdx + 1, wd_WebIdIdx + 1).setValue(wooIdEn);
          }
      }

      SpreadsheetApp.flush(); // Commit all changes
      
      // 4. Complete Task
      TaskService.updateTaskStatus(onboardingTaskId, 'Done'); // TaskService needs sessionId too
      
      // 5. Force Reload Config/Cache if needed (though product maps are usually rebuilt per request)
      // skuToWebIdMap = null; // Invalidate local cache if used
      
      return { success: true };

    } catch (e) {
      logger.error(serviceName, functionName, `Error: ${e.message}`, e, { sessionId: sessionId, sku: sku, wooIdEn: wooIdEn, wooIdHe: wooIdHe });
      throw e;
    }
  }

  return {
    processJob: processJob,
    runWebXltValidationAndUpsert: _runWebXltValidationAndUpsert,
    getProductWebIdBySku: getProductWebIdBySku,
    exportWebInventory: exportWebInventory,
    getProductDetails: getProductDetails,
    submitProductDetails: submitProductDetails,
    acceptProductDetails: acceptProductDetails,
    generateDetailExport: generateDetailExport,
    generateNewProductExport: generateNewProductExport,
    confirmWebUpdates: confirmWebUpdates,
    getProductHtmlPreview: getProductHtmlPreview,
    acceptProductSuggestion: acceptProductSuggestion,
    linkAndFinalizeNewProduct: linkAndFinalizeNewProduct
  };
})();

/**
 * Global wrapper function to execute the Web Inventory Export from the Apps Script editor or client-side.
 */
function run_exportWebInventory() {
  ProductService.exportWebInventory();
}