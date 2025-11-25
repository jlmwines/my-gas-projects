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
            WebAppTasks.completeTask(task.st_TaskId);
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

  return {
    processJob: processJob,
    runWebXltValidationAndUpsert: _runWebXltValidationAndUpsert,
    getProductWebIdBySku: getProductWebIdBySku,
    exportWebInventory: exportWebInventory
  };
})();

/**
 * Global wrapper function to execute the Web Inventory Export from the Apps Script editor or client-side.
 */
function run_exportWebInventory() {
  ProductService.exportWebInventory();
}