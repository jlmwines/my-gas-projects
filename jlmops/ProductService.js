/**
 * @file ProductService.js
 * @description Service for handling product-related business logic, including staging and validation.
 */

const ProductService = (function() {
  let skuToWebIdMap = null;

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

  function _populateStagingSheet(productsOrData, sheetName) {
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const sheet = dataSpreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found in JLMops_Data spreadsheet.`);
    }
    LoggerService.info('ProductService', '_populateStagingSheet', `Successfully opened sheet: ${sheetName}. Current headers: ${JSON.stringify(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0])}`);

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

        LoggerService.info('ProductService', '_populateStagingSheet', `Mapping complete for ${sheetName}. Schema headers: ${JSON.stringify(schemaHeaders)}. First data row: ${finalData.length > 0 ? JSON.stringify(finalData[0]) : 'N/A'}`);
        
        // Clear previous content and write new data
        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
        }
        if (finalData.length > 0 && finalData[0].length > 0) {
            sheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
        }
        SpreadsheetApp.flush(); // Ensure data is written before any subsequent reads (e.g., validation)
        LoggerService.info('ProductService', '_populateStagingSheet', `Staging sheet '${sheetName}' has been updated with ${finalData.length} rows.`);
    }
  }





  function _runStagingValidation(suiteName) {
    LoggerService.info('ProductService', '_runStagingValidation', `Starting validation for suite: ${suiteName}`);
    const quarantineTriggered = !ValidationService.runValidationSuite(suiteName);
    if (quarantineTriggered) {
        LoggerService.warn('ProductService', '_runStagingValidation', `Validation suite '${suiteName}' triggered a quarantine.`);
    }
    return !quarantineTriggered;
  }

  function _runWebXltValidationAndUpsert(jobRowNumber) {
    LoggerService.info('ProductService', '_runWebXltValidationAndUpsert', `Starting WebXlt specific validation and upsert process for job row: ${jobRowNumber}.`);

    // --- 1. Populate Staging Sheet ---
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const csvContent = file.getBlob().getDataAsString('UTF-8');

        const translationObjects = WebAdapter.processTranslationCsv(csvContent, 'map.web.translation_columns');

        _populateStagingSheet(translationObjects, sheetNames.WebXltS);
        LoggerService.info('ProductService', '_runWebXltValidationAndUpsert', 'Successfully populated WebXltS staging sheet.');

    } catch (e) {
        LoggerService.error('ProductService', '_runWebXltValidationAndUpsert', `Failed to populate staging sheet: ${e.message}`, e);
        ValidationService.updateJobStatus(jobRowNumber, 'FAILED', `Staging population failed: ${e.message}`);
        return 'FAILED';
    }

    // --- 2. Run Staging Validation ---
    if (!ValidationService.runValidationSuite('web_xlt_staging')) {
        LoggerService.warn('ProductService', '_runWebXltValidationAndUpsert', 'WebXlt staging validation failed. Job will be QUARANTINED.');
        return 'QUARANTINED';
    }

    // --- 3. Upsert (existing logic) ---
    _upsertWebXltData();
    return 'COMPLETED';
  }

  function _upsertWebXltData() {
    LoggerService.info('ProductService', '_upsertWebXltData', 'Starting WebXltS to WebXltM full replacement process.');

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
    LoggerService.info('ProductService', '_upsertWebXltData', 'Cleared WebXltM sheet.');

    if (numRows > 0 && numCols > 0) {
        // Write the entire data block from staging (including headers) to master in one operation
        webXltMSheet.getRange(1, 1, numRows, numCols).setValues(webXltSData);
        LoggerService.info('ProductService', '_upsertWebXltData', `Wrote ${numRows} rows and ${numCols} columns from WebXltS to WebXltM.`);
    } else {
        // If staging is empty, we still need to restore the headers to the master sheet
        const webXltMHeaders = ConfigService.getConfig('schema.data.WebXltM').headers.split(',');
        if (webXltMHeaders.length > 0) {
            webXltMSheet.getRange(1, 1, 1, webXltMHeaders.length).setValues([webXltMHeaders]).setFontWeight('bold');
            LoggerService.info('ProductService', '_upsertWebXltData', 'WebXltS was empty. Restored headers to WebXltM.');
        }
    }

    SpreadsheetApp.flush(); // Ensure all pending changes are applied
    LoggerService.info('ProductService', '_upsertWebXltData', `Upsert complete. Final row count in WebXltM: ${webXltMSheet.getLastRow()}`);
  }

  function _runComaxImport(jobRowNumber) {
    LoggerService.info('ProductService', '_runComaxImport', `Starting Comax import process for job row: ${jobRowNumber}.`);
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const fileBlob = file.getBlob();

        const comaxData = ComaxAdapter.processProductCsv(fileBlob);

        _populateStagingSheet(comaxData, sheetNames.CmxProdS);
        LoggerService.info('ProductService', '_runComaxImport', 'Successfully populated CmxProdS staging sheet.');
        
        if (!ValidationService.runValidationSuite('comax_staging')) {
            LoggerService.warn('ProductService', '_runComaxImport', 'Comax staging validation failed. Job will be QUARANTINED.');
            return 'QUARANTINED';
        }

        _upsertComaxData(comaxData); // Pass comaxData here

        try {
            LoggerService.info('ProductService', '_runComaxImport', 'Comax import successful. Triggering automatic WooCommerce update export.');
            // generateWooCommerceUpdateExport();
        } catch (e) {
            LoggerService.error('ProductService', '_runComaxImport', `The subsequent WooCommerce update export failed: ${e.message}`, e);
            // We do not re-throw the error or change the job status.
            // The primary Comax import was successful. The export failure is a separate issue.
        }

        return 'COMPLETED';

    } catch (e) {
        LoggerService.error('ProductService', '_runComaxImport', `Failed to import Comax data: ${e.message}`, e);
        ValidationService.updateJobStatus(jobRowNumber, 'FAILED', `Comax import failed: ${e.message}`);
        return 'FAILED';
    }
  }

  function _upsertComaxData(comaxProducts) { // Modified to accept comaxProducts
    LoggerService.info('ProductService', '_upsertComaxData', 'Starting CmxProdS to CmxProdM upsert process.');

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
    LoggerService.info('ProductService', '_upsertComaxData', `Upsert to CmxProdM complete. Total rows: ${finalData.length}.`);

    // Maintain SysProductAudit after CmxProdM is updated
    _maintainSysProductAudit(comaxProducts);
  }

  /**
   * Maintains the SysProductAudit sheet by upserting Comax product data.
   * This ensures that SysProductAudit is synchronized with the latest CmxId and SKU from Comax.
   * @param {Array<Object>} comaxProducts - An array of Comax product objects (from ComaxAdapter).
   */
  function _maintainSysProductAudit(comaxProducts) {
    LoggerService.info('ProductService', '_maintainSysProductAudit', 'Starting SysProductAudit maintenance.');

    const allConfig = ConfigService.getAllConfig();
    const sysProductAuditSchema = allConfig['schema.data.SysProductAudit'];
    if (!sysProductAuditSchema) {
        throw new Error('SysProductAudit schema not found in configuration.');
    }
    const sysProductAuditHeaders = sysProductAuditSchema.headers.split(',');

    // Load existing SysProductAudit data into a map keyed by pa_CmxId
    const auditMap = ConfigService._getSheetDataAsMap('SysProductAudit', sysProductAuditHeaders, 'pa_CmxId').map;

    let updatedCount = 0;
    let newCount = 0;
    let skippedCount = 0;

    // Iterate through the newly imported Comax products and upsert into the map
    comaxProducts.forEach(comaxProduct => {
        const cmxId = String(comaxProduct.cps_CmxId || '').trim();
        const sku = String(comaxProduct.cps_SKU || '').trim();

        if (!cmxId) {
            LoggerService.warn('ProductService', '_maintainSysProductAudit', `Skipping product with empty CmxId. SKU: ${sku}`);
            skippedCount++;
            return; // Cannot process without a CmxId
        }

        if (auditMap.has(cmxId)) {
            // Product exists, update SKU if it has changed
            const existingRow = auditMap.get(cmxId);
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
            auditMap.set(cmxId, newAuditRow);
            newCount++;
        }
    });

    // Convert the fully updated map's values to a 2D array for writing
    const finalAuditData = Array.from(auditMap.values()).map(rowObject => {
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
    
    LoggerService.info('ProductService', '_maintainSysProductAudit', `SysProductAudit synchronized. New: ${newCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}. Total rows: ${finalAuditData.length}.`);
  }

  function _runWebProductsImport(jobRowNumber) {
    LoggerService.info('ProductService', '_runWebProductsImport', `Starting Web Products (EN) import process for job row: ${jobRowNumber}.`);
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const fileEncoding = ConfigService.getConfig('import.drive.web_products_en').file_encoding || 'UTF-8';
        const csvContent = file.getBlob().getDataAsString(fileEncoding);

        const productObjects = WebAdapter.processProductCsv(csvContent, 'map.web.product_columns');

        _populateStagingSheet(productObjects, sheetNames.WebProdS_EN);
        LoggerService.info('ProductService', '_runWebProductsImport', 'Successfully populated WebProdS_EN staging sheet.');
        
    // --- 2. Run Staging Validation ---
    if (!ValidationService.runValidationSuite('web_staging')) {
        LoggerService.warn('ProductService', '_runWebProductsImport', 'Web Products staging validation failed. Job will be QUARANTINED.');
        return 'QUARANTINED';
    }

        _upsertWebProductsData();

        return 'COMPLETED';

    } catch (e) {
        LoggerService.error('ProductService', '_runWebProductsImport', `Failed to import Web Products (EN) data: ${e.message}`, e);
        ValidationService.updateJobStatus(jobRowNumber, 'FAILED', `Web Products (EN) import failed: ${e.message}`);
        return 'FAILED';
    }
  }

  function _upsertWebProductsData() {
    LoggerService.info('ProductService', '_upsertWebProductsData', 'Starting UPDATE-ONLY process for WebProdM.');

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

    LoggerService.info('ProductService', '_upsertWebProductsData', `${updatedCount} existing products were updated in the master map.`);

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
    LoggerService.info('ProductService', '_upsertWebProductsData', `Upsert to WebProdM complete. Total rows: ${finalData.length}.`);
  }

  function processJob(jobType, jobRowNumber) {
    LoggerService.info('ProductService', 'processJob', `Starting job: ${jobType} (Row: ${jobRowNumber})`);
    ValidationService.updateJobStatus(jobRowNumber, 'PROCESSING');

    try {
      let finalJobStatus = 'COMPLETED'; // Default to COMPLETED
      switch (jobType) {
        case 'import.drive.comax_products':
          finalJobStatus = _runComaxImport(jobRowNumber);
          break;
        case 'import.drive.web_products_en':
          finalJobStatus = _runWebProductsImport(jobRowNumber);
          break;
        case 'import.drive.web_translations_he':
          finalJobStatus = _runWebXltValidationAndUpsert(jobRowNumber);
          break;
        case 'manual.validation.master':
          ValidationService.runValidationSuite('master_master', jobType, rowNumber);
          finalJobStatus = 'COMPLETED';
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
      ValidationService.updateJobStatus(jobRowNumber, finalJobStatus);
      
      if (finalJobStatus === 'COMPLETED') {
        OrchestratorService.finalizeJobCompletion(jobType, jobRowNumber);
      }

      LoggerService.info('ProductService', 'processJob', `Job ${jobType} completed with status: ${finalJobStatus}.`);
    } catch (e) {
      LoggerService.error('ProductService', 'processJob', `Job ${jobType} failed: ${e.message}`, e);
      ValidationService.updateJobStatus(jobRowNumber, 'FAILED', e.message);
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

  function generateDetailExport() {
    LoggerService.info('ProductService', 'generateDetailExport', 'Starting export of accepted product details to Google Sheet.');
    try {
        // 1. Identify Accepted Tasks
        const tasks = WebAppTasks.getOpenTasksByTypeId('task.validation.field_mismatch');
        const acceptedTasks = tasks.filter(t => t.st_Status === 'Accepted' && t.st_Title.toLowerCase().includes('vintage mismatch'));
        
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
        LoggerService.info('ProductService', 'generateDetailExport', `WebDetM map size: ${webDetMap.size}`);
        LoggerService.info('ProductService', 'generateDetailExport', `WebDetM map first 5 keys: ${Array.from(webDetMap.keys()).slice(0, 5).join(', ')}`);
        LoggerService.info('ProductService', 'generateDetailExport', `Is SKU '7290017324487' in WebDetM map? ${webDetMap.has('7290017324487')}`);
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
            LoggerService.info('ProductService', 'generateDetailExport', `Looking up SKU: '${sku}' (Type: ${typeof sku})`);
            LoggerService.info('ProductService', 'generateDetailExport', `webDetMap.has('${sku}'): ${webDetMap.has(sku)}`);
            if (webDetMap.size > 0) {
                LoggerService.info('ProductService', 'generateDetailExport', `First map key type: ${typeof Array.from(webDetMap.keys())[0]}`);
            }
            // --- END DEBUGGING LOGS ---

            const webDetRow = webDetMap.get(sku);
            const cmxRow = cmxMap.get(sku);
            
            if (!webDetRow) {
                LoggerService.warn('ProductService', 'generateDetailExport', `Skipping SKU ${sku}: Details not found in WebDetM.`);
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
            LoggerService.info('ProductService', 'generateDetailExport', 'No product data was successfully exported.');
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
        
        LoggerService.info('ProductService', 'generateDetailExport', `Attempting to move spreadsheet ID: ${newSpreadsheet.getId()} ('${newSpreadsheet.getName()}') to folder ID: ${exportFolderId}`);

        try {
            const folder = DriveApp.getFolderById(exportFolderId);
            DriveApp.getFileById(newSpreadsheet.getId()).moveTo(folder);
            LoggerService.info('ProductService', 'generateDetailExport', `Successfully moved spreadsheet to folder ID: ${exportFolderId}`);
        } catch (moveError) {
            LoggerService.error('ProductService', 'generateDetailExport', `Error moving spreadsheet to folder ID ${exportFolderId}: ${moveError.message}`, moveError);
            return { 
                success: false, // Indicate failure to move
                message: `Export created in root, but failed to move to folder: ${moveError.message}. Sheet URL: ${newSpreadsheet.getUrl()}`, 
                fileId: newSpreadsheet.getId(),
                fileUrl: newSpreadsheet.getUrl()
            };
        }
        
        LoggerService.info('ProductService', 'generateDetailExport', `Created export spreadsheet: ${newSpreadsheet.getName()} (ID: ${newSpreadsheet.getId()}), URL: ${newSpreadsheet.getUrl()}`);

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
        LoggerService.error('ProductService', 'generateDetailExport', `Error generating product details export: ${e.message}`, e);
        throw e;
    }
  }

  function confirmWebUpdates() {
    LoggerService.info('ProductService', 'confirmWebUpdates', 'Marking exported tasks as Completed.');
    try {
        const tasks = WebAppTasks.getOpenTasksByTypeId('task.validation.field_mismatch');
        const acceptedTasks = tasks.filter(t => t.st_Status === 'Accepted' && t.st_Title.toLowerCase().includes('vintage mismatch'));
        
        let count = 0;
        acceptedTasks.forEach(t => {
            TaskService.updateTaskStatus(t.st_TaskId, 'Completed');
            count++;
        });
        
        LoggerService.info('ProductService', 'confirmWebUpdates', `Completed ${count} tasks.`);
        return { success: true, message: `Marked ${count} tasks as Completed.` };

    } catch (e) {
        LoggerService.error('ProductService', 'confirmWebUpdates', `Error confirming updates: ${e.message}`, e);
        throw e;
    }
  }

  /**
   * Generates HTML previews for a product based on the provided data (from frontend).
   * @param {string} sku The product SKU.
   * @param {Object} formData The form data from the UI.
   * @returns {Object} { htmlEn, htmlHe }
   */
  function getProductHtmlPreview(sku, formData, comaxData, lang, lookupMaps, isForExport) {
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
          LoggerService.error('ProductService', 'getProductHtmlPreview', `Error generating preview: ${e.message}`, e);
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
    confirmWebUpdates: confirmWebUpdates,
    getProductHtmlPreview: getProductHtmlPreview
  };
})();

/**
 * Global wrapper function to execute the Web Inventory Export from the Apps Script editor or client-side.
 */
function run_exportWebInventory() {
  ProductService.exportWebInventory();
}