/**
 * @file ProductService.js
 * @description Service for product CRUD operations, lookups, detail management, and SKU operations.
 *
 * Note: Import/export job processing has been extracted to ProductImportService.js
 * as part of Phase 13 codebase health initiative.
 */

const ProductService = (function() {
  let skuToWebIdMap = null;
  // Cached lookup data (module-level cache for small reference data)
  let cachedRegions = null;
  let cachedGrapes = null;
  let cachedKashrut = null;
  // Note: Product data now uses CacheService instead of module-level cache

  /**
   * Applies standard formatting to a data sheet: top-align cells and set row height for single line.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to format.
   * @param {number} dataRowCount - Number of data rows (excluding header).
   */
  function _applyProductSheetFormatting(sheet, dataRowCount) {
    if (dataRowCount <= 0) return;

    // Set vertical alignment to top for all data rows
    const dataRange = sheet.getRange(2, 1, dataRowCount, sheet.getLastColumn());
    dataRange.setVerticalAlignment('top');
    dataRange.setWrap(false);  // Disable wrap to enforce single-row height

    // Set row height for single line of text (24 pixels)
    sheet.setRowHeights(2, dataRowCount, 24);
  }

  // =================================================================================
  // SKU LOOKUP AND CACHING
  // =================================================================================

  function _buildSkuToWebIdMap() {
    const functionName = '_buildSkuToWebIdMap';
    LoggerService.info('ProductService', functionName, 'Building SKU to WebIdEn map...');
    skuToWebIdMap = new Map();

    // Try to get from CacheService first
    const scriptCache = CacheService.getScriptCache();
    const cachedMap = scriptCache.get('skuToWebIdMap');
    if (cachedMap) {
      try {
        const entries = JSON.parse(cachedMap);
        skuToWebIdMap = new Map(entries);
        LoggerService.info('ProductService', functionName, `Loaded SKU map from cache with ${skuToWebIdMap.size} entries.`);
        return;
      } catch (e) {
        LoggerService.warn('ProductService', functionName, 'Failed to parse cached SKU map. Rebuilding from sheet.');
      }
    }

    try {
      const allConfig = ConfigService.getAllConfig();
      const sheet = SheetAccessor.getDataSheet(allConfig['system.sheet_names'].WebProdM, false);
      if (!sheet) {
        throw new Error('WebProdM sheet not found');
      }
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const skuCol = headers.indexOf('wpm_SKU');
      const webIdCol = headers.indexOf('wpm_ID');
      if (skuCol === -1 || webIdCol === -1) {
        throw new Error('Could not find SKU or WebIdEn columns in WebProdM');
      }
      data.forEach(row => {
        const sku = String(row[skuCol]).trim();
        if (sku) {
          skuToWebIdMap.set(sku, row[webIdCol]);
        }
      });
      
      // Cache the built map
      try {
        const serializedMap = JSON.stringify(Array.from(skuToWebIdMap.entries()));
        scriptCache.put('skuToWebIdMap', serializedMap, 600); // Cache for 10 minutes
        LoggerService.info('ProductService', functionName, `Built and cached SKU map with ${skuToWebIdMap.size} entries.`);
      } catch (cacheError) {
        LoggerService.warn('ProductService', functionName, `Failed to cache SKU map (likely too large): ${cacheError.message}`);
      }

    } catch (e) {
      LoggerService.error('ProductService', functionName, `Error building SKU map: ${e.message}`, e);
      // If the map fails to build, we leave it as an empty map to prevent repeated errors.
      skuToWebIdMap = new Map();
    }
  }

  /**
   * Get cached regions lookup data. Filters and caches the result for performance.
   * @returns {Array} Array of region objects {code, textEN, textHE}
   */
  function _getCachedRegions() {
    if (cachedRegions) {
      return cachedRegions;
    }

    const allTexts = LookupService.getLookupMap('map.text_lookups');
    const regionsMap = new Map();
    allTexts.forEach((value, key) => {
      if (value.slt_Note === 'Region') {
        regionsMap.set(key, value);
      }
    });

    cachedRegions = Array.from(regionsMap.values())
      .sort((a, b) => (a.slt_TextHE || '').localeCompare(b.slt_TextHE || ''))
      .map(r => ({ code: r.slt_Code, textEN: r.slt_TextEN, textHE: r.slt_TextHE }));

    return cachedRegions;
  }

  /**
   * Get cached grapes lookup data.
   * @returns {Array} Array of grape objects {code, textEN, textHE}
   */
  function _getCachedGrapes() {
    if (cachedGrapes) {
      return cachedGrapes;
    }

    const allGrapes = LookupService.getLookupMap('map.grape_lookups');
    cachedGrapes = Array.from(allGrapes.values())
      .sort((a, b) => {
        const textA = a.slg_TextEN || '';
        const textB = b.slg_TextEN || '';
        return textA.localeCompare(textB);
      })
      .map(g => ({ code: g.slg_Code, textEN: g.slg_TextEN, textHE: g.slg_TextHE }));

    return cachedGrapes;
  }

  /**
   * Get cached kashrut lookup data.
   * @returns {Array} Array of kashrut objects {code, textEN, textHE}
   */
  function _getCachedKashrut() {
    if (cachedKashrut) {
      return cachedKashrut;
    }

    const allKashrut = LookupService.getLookupMap('map.kashrut_lookups');
    cachedKashrut = Array.from(allKashrut.values())
      .sort((a, b) => {
        const textA = a.slk_TextEN || '';
        const textB = b.slk_TextEN || '';
        return textA.localeCompare(textB);
      })
      .map(k => ({ code: k.slk_Code, textEN: k.slk_TextEN, textHE: k.slk_TextHE }));

    return cachedKashrut;
  }

  /**
   * Invalidate all product data caches.
   * Called after data modifications (submit/accept).
   */
  function _invalidateProductCache() {
    // Clear CacheService caches
    try {
      const cache = CacheService.getScriptCache();
      cache.remove('productData_WebDetM');
      cache.remove('productData_WebDetS');
      cache.remove('productData_CmxProdM');
      cache.remove('productData_WebProdM');
      LoggerService.info('ProductService', '_invalidateProductCache', 'Cleared all CacheService product caches');
    } catch (e) {
      LoggerService.warn('ProductService', '_invalidateProductCache', `Failed to clear CacheService: ${e.message}`);
    }

    // Clear module-level caches (for lookup helpers)
    cachedRegions = null;
    cachedGrapes = null;
    cachedKashrut = null;
  }

  // =================================================================================
  // PRODUCT LOOKUP
  // =================================================================================


  function _runStagingValidation(suiteName, sessionId) {
    const serviceName = 'ProductService';
    const functionName = '_runStagingValidation';
    logger.info(serviceName, functionName, `Starting validation for suite: ${suiteName}`, { sessionId: sessionId });
    
    const result = ValidationOrchestratorService.runValidationSuite(suiteName, sessionId);
    const quarantineTriggered = result.quarantineTriggered;

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
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobQueueSheetRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobQueueSheetRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const csvContent = file.getBlob().getDataAsString('UTF-8');

        const translationObjects = WebAdapter.processTranslationCsv(csvContent, 'map.webtoffee.hebrew_headers');

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
        logger.error(serviceName, functionName, '🛑 CRITICAL: Quarantine triggered - MASTER UPDATE BLOCKED', null, { sessionId: sessionId, validationFailures: validationResult.results.filter(r => r.status === 'FAILED') });
        _updateJobStatus(executionContext, 'QUARANTINED', 'Validation failed - data quarantined. Do not update master.');
        return 'QUARANTINED';
    }

    // --- 3. Upsert (existing logic) - Only reached if validation passed
    _upsertWebXltData(sessionId);
    return 'COMPLETED';
  }

  function _upsertWebXltData(sessionId) {
    const serviceName = 'ProductService';
    const functionName = '_upsertWebXltData';
    logger.info(serviceName, functionName, 'Starting WebXltS to WebXltM full replacement process.', { sessionId: sessionId });

    const dataSpreadsheet = SheetAccessor.getDataSpreadsheet();
    const webXltMSheet = dataSpreadsheet.getSheetByName('WebXltM');
    const webXltSSheet = dataSpreadsheet.getSheetByName('WebXltS');

    if (!webXltMSheet) throw new Error('WebXltM sheet not found in JLMops_Data spreadsheet.');
    if (!webXltSSheet) throw new Error('WebXltS sheet not found in JLMops_Data spreadsheet.');

    // Get the correct headers for master sheet from config (wxl_ prefix)
    const webXltMHeaders = ConfigService.getConfig('schema.data.WebXltM').headers.split(',');

    // Get staging data (including header row)
    const webXltSData = webXltSSheet.getDataRange().getValues();
    const numStagingRows = webXltSData.length;

    // Clear the master sheet entirely
    webXltMSheet.clear();
    logger.info(serviceName, functionName, 'Cleared WebXltM sheet.', { sessionId: sessionId });

    // Always write the correct headers first
    if (webXltMHeaders.length > 0) {
        webXltMSheet.getRange(1, 1, 1, webXltMHeaders.length).setValues([webXltMHeaders]).setFontWeight('bold');
    }

    // Copy data rows (skip staging header row at index 0) with correct headers
    if (numStagingRows > 1) {
        const dataRows = webXltSData.slice(1); // Skip header row
        const numDataRows = dataRows.length;
        const numCols = webXltMHeaders.length;

        // Write data rows starting at row 2 (after header)
        webXltMSheet.getRange(2, 1, numDataRows, numCols).setValues(dataRows);
        // Apply standard formatting: top-align and single row height
        _applyProductSheetFormatting(webXltMSheet, numDataRows);
        logger.info(serviceName, functionName, `Wrote ${numDataRows} data rows with wxl_ headers to WebXltM.`, { sessionId: sessionId });
    } else {
        logger.info(serviceName, functionName, 'WebXltS had no data rows. Only headers written to WebXltM.', { sessionId: sessionId });
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
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue);
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
            logger.error(serviceName, functionName, '🛑 CRITICAL: Quarantine triggered - MASTER UPDATE BLOCKED', null, { sessionId: sessionId, validationFailures: validationResult.results.filter(r => r.status === 'FAILED') });
            _updateJobStatus(executionContext, 'QUARANTINED', 'Validation failed - data quarantined. Do not update master.');
            return 'QUARANTINED';
        }

        // Only reached if validation passed - safe to update master
        _upsertComaxData(comaxData, sessionId);

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
    if (!masterSchema) {
        throw new Error('Comax master schema not found.');
    }
    const masterHeaders = masterSchema.headers.split(',');

    const masterData = ConfigService._getSheetDataAsMap('CmxProdM', masterHeaders, 'cpm_CmxId');
    const masterMap = masterData.map;

    // NEW: Track mapping errors and missing fields
    const mappingErrors = [];
    const criticalFields = ['cpm_SKU', 'cpm_NameHe', 'cpm_Stock', 'cpm_Price'];

    // Iterate through the fresh comaxProducts (Objects) and update/insert into the master map
    comaxProducts.forEach((comaxProductObj, idx) => {
        const key = comaxProductObj['cps_CmxId'] ? String(comaxProductObj['cps_CmxId']).trim() : null;

        if (key) {
            const newMasterRow = {};
            const missingFields = [];

            masterHeaders.forEach((masterHeader) => {
                const baseHeader = masterHeader.substring(masterHeader.indexOf('_') + 1);
                const stagingHeader = 'cps_' + baseHeader;

                // If the object has the property, use it. Otherwise track as missing.
                if (comaxProductObj.hasOwnProperty(stagingHeader)) {
                    newMasterRow[masterHeader] = comaxProductObj[stagingHeader];
                } else if (masterMap.has(key) && masterMap.get(key)[masterHeader]) {
                     // Preserve existing value if not in update (for manual fields)
                     newMasterRow[masterHeader] = masterMap.get(key)[masterHeader];
                     // NEW: Still log that it wasn't in the staging data
                     if (idx < 5) { // Only log for first few products to avoid spam
                         logger.warn(serviceName, functionName, `Product ${key}: Field ${stagingHeader} not in staging, preserving existing master value.`, { sessionId });
                     }
                } else {
                    // NEW: Track as missing instead of silent default
                    missingFields.push(stagingHeader);
                    newMasterRow[masterHeader] = '';
                }
            });

            // COMAX BUSINESS RULE: Normalize null/empty stock to '0'
            if (!newMasterRow['cpm_Stock'] || String(newMasterRow['cpm_Stock']).trim() === '') {
                newMasterRow['cpm_Stock'] = '0';
            }

            // COMAX BUSINESS RULE: Normalize null/empty price to '0'
            if (!newMasterRow['cpm_Price'] || String(newMasterRow['cpm_Price']).trim() === '') {
                newMasterRow['cpm_Price'] = '0';
            }

            // NEW: Validate critical fields are NOT empty after mapping
            // Note: cpm_Stock is already normalized to '0' if empty, so it will pass validation
            const emptyCriticalFields = criticalFields.filter(f => !newMasterRow[f] || String(newMasterRow[f]).trim() === '');

            if (emptyCriticalFields.length > 0) {
                mappingErrors.push(
                    `Product ${key} (row ${idx + 1}): Missing critical fields: ${emptyCriticalFields.join(', ')}`
                );
            }

            if (missingFields.length > 0 && idx < 5) {
                logger.warn(serviceName, functionName,
                    `Product ${key}: ${missingFields.length} fields not in staging object: ${missingFields.slice(0, 5).join(', ')}${missingFields.length > 5 ? '...' : ''}`,
                    { sessionId }
                );
            }

            masterMap.set(key, newMasterRow);
        }
    });

    // NEW: Fail if critical data missing
    if (mappingErrors.length > 0) {
        const errorSummary = mappingErrors.slice(0, 10).join('\n');
        const totalErrors = mappingErrors.length;
        const errorMsg = `CRITICAL DATA MISSING IN ${totalErrors} PRODUCTS:\n${errorSummary}\n${totalErrors > 10 ? `... and ${totalErrors - 10} more` : ''}\nCannot update master with incomplete data. HALTING.`;
        logger.error(serviceName, functionName, errorMsg, null, { sessionId });
        throw new Error(errorMsg);
    }

    // Prepare the final data array for writing back to the sheet
    const finalData = Array.from(masterMap.values()).map(rowObject => {
        return masterHeaders.map(header => {
            const value = rowObject[header];
            // CRITICAL: Don't treat 0 as falsy - it's a valid stock/price value
            return (value !== undefined && value !== null) ? value : '';
        });
    });

    // --- ENHANCED SANITY CHECK ---
    if (finalData.length > 0) {
        const stockIdx = masterHeaders.indexOf('cpm_Stock');
        const priceIdx = masterHeaders.indexOf('cpm_Price');
        const nameIdx = masterHeaders.indexOf('cpm_NameHe');
        const skuIdx = masterHeaders.indexOf('cpm_SKU');

        // ENHANCED: Sample more rows and check ALL critical fields
        const sampleSize = Math.min(20, finalData.length); // Increased from 5 to 20
        let validRowsFound = 0;
        const sanityIssues = [];

        for (let i = 0; i < sampleSize; i++) {
            const row = finalData[i];
            // CRITICAL: Treat 0 as valid for stock/price (0 !== '', 0 !== null, 0 !== undefined)
            const hasStock = stockIdx > -1 && row[stockIdx] !== '' && row[stockIdx] !== null && row[stockIdx] !== undefined;
            const hasPrice = priceIdx > -1 && row[priceIdx] !== '' && row[priceIdx] !== null && row[priceIdx] !== undefined;
            const hasName = nameIdx > -1 && row[nameIdx] !== '' && row[nameIdx] !== null && row[nameIdx] !== undefined;
            const hasSKU = skuIdx > -1 && row[skuIdx] !== '' && row[skuIdx] !== null && row[skuIdx] !== undefined;

            // ENHANCED: Require Name AND SKU (Stock/Price can be 0 legitimately)
            if (hasName && hasSKU && (hasStock || hasPrice)) {
                validRowsFound++;
            } else {
                const missing = [];
                if (!hasSKU) missing.push('SKU');
                if (!hasName) missing.push('Name');
                if (!hasStock && !hasPrice) missing.push('Stock or Price');
                sanityIssues.push(`Row ${i + 1}: Missing ${missing.join(', ')}`);
            }
        }

        // ENHANCED: Require at least 80% of sampled rows to be valid
        const validPercentage = (validRowsFound / sampleSize) * 100;
        if (validPercentage < 80) {
            const msg = `CRITICAL SANITY CHECK FAILED in _upsertComaxData. Only ${validRowsFound}/${sampleSize} sampled rows (${validPercentage.toFixed(1)}%) have all critical fields. Issues:\n${sanityIssues.slice(0, 5).join('\n')}\nAborting write to prevent data corruption.`;
            logger.error(serviceName, functionName, msg, null, { sessionId: sessionId });
            throw new Error(msg);
        }

        logger.info(serviceName, functionName, `Sanity check passed: ${validRowsFound}/${sampleSize} sampled rows (${validPercentage.toFixed(1)}%) valid.`, { sessionId });
    }
    // --- END ENHANCED SANITY CHECK ---

    // Sort by product name (cpm_NameHe) before writing
    const nameIdx = masterHeaders.indexOf('cpm_NameHe');
    if (nameIdx > -1 && finalData.length > 0) {
        finalData.sort((a, b) => {
            const nameA = String(a[nameIdx] || '').toLowerCase();
            const nameB = String(b[nameIdx] || '').toLowerCase();
            return nameA.localeCompare(nameB, 'he'); // Hebrew locale for proper sorting
        });
        logger.info(serviceName, functionName, 'Sorted CmxProdM data by product name (cpm_NameHe).', { sessionId });
    }

    const masterSheet = SheetAccessor.getDataSheet('CmxProdM');

    // More robustly clear the sheet and rewrite headers + data
    masterSheet.clear();
    masterSheet.getRange(1, 1, 1, masterHeaders.length).setValues([masterHeaders]).setFontWeight('bold');

    if (finalData.length > 0) {
        masterSheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
        // Apply standard formatting: top-align and single row height
        _applyProductSheetFormatting(masterSheet, finalData.length);
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
    const sysProductAuditSheet = SheetAccessor.getDataSheet('SysProductAudit');

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
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue);
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
        logger.info(serviceName, functionName, `Successfully populated WebProdS_EN staging sheet with ${productObjects.length} products.`, { sessionId });
        
        // --- 2. Run Staging Validation ---
        const validationResult = ValidationLogic.runValidationSuite('web_staging', sessionId);
        const { quarantineTriggered } = ValidationOrchestratorService.processValidationResults(validationResult, sessionId);

        if (quarantineTriggered) {
            logger.error(serviceName, functionName, '🛑 CRITICAL: Quarantine triggered - MASTER UPDATE BLOCKED', null, { sessionId: sessionId, validationFailures: validationResult.results.filter(r => r.status === 'FAILED') });
            _updateJobStatus(executionContext, 'QUARANTINED', 'Validation failed - data quarantined. Do not update master.');
            return 'QUARANTINED';
        }

        // Only reached if validation passed - safe to update master
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
    const masterData = ConfigService._getSheetDataAsMap('WebProdM', masterHeaders, 'wpm_ID');
    const masterMap = masterData.map;

    const stagingKey = stagingSchema.key_column;
    const stagingKeyIndex = stagingHeaders.indexOf(stagingKey);

    let updatedCount = 0;
    let skippedCount = 0;
    const stagingToMasterMap = ConfigService.getConfig('map.staging_to_master.web_products');

    // NEW: Validate mapping configuration exists and is complete
    if (!stagingToMasterMap || Object.keys(stagingToMasterMap).length === 0) {
        throw new Error('Staging to master mapping configuration missing or empty!');
    }

    const criticalMappings = {
        'wps_Stock': 'wpm_Stock',
        'wps_RegularPrice': 'wpm_RegularPrice',
        'wps_SKU': 'wpm_SKU',
        'wps_PostTitle': 'wpm_PostTitle'
    };

    // NEW: Validate critical mappings are present
    for (const [stagingField, expectedMasterField] of Object.entries(criticalMappings)) {
        if (!stagingToMasterMap[stagingField]) {
            throw new Error(`CRITICAL: Mapping missing for ${stagingField}`);
        }
        if (stagingToMasterMap[stagingField] !== expectedMasterField) {
            throw new Error(
                `CRITICAL: Mapping mismatch for ${stagingField}. ` +
                `Expected ${expectedMasterField}, got ${stagingToMasterMap[stagingField]}`
            );
        }
    }

    const mappingErrors = [];

    stagingData.values.forEach((stagingRow, idx) => {
        const rawKey = stagingRow[stagingKeyIndex];
        const key = String(rawKey).trim(); // Convert to string to match map keys

        if (key && masterMap.has(key)) {
            // Product exists in master, update its values
            const masterRow = masterMap.get(key);
            const stagingRowObject = {};
            stagingHeaders.forEach((h, i) => { stagingRowObject[h] = stagingRow[i]; });

            const missingFields = [];
            const updatedFields = [];

            for (const sKey in stagingToMasterMap) {
                const mKey = stagingToMasterMap[sKey];

                if (stagingRowObject.hasOwnProperty(sKey)) {
                    masterRow[mKey] = stagingRowObject[sKey];
                    updatedFields.push(sKey);
                } else {
                    // NEW: Track missing fields
                    missingFields.push(sKey);
                }
            }

            // NEW: Validate critical fields were updated
            const missedCritical = Object.keys(criticalMappings).filter(cf => missingFields.includes(cf));
            if (missedCritical.length > 0) {
                mappingErrors.push(
                    `Row ${idx + 2} (${key}): Missing critical staging fields: ${missedCritical.join(', ')}`
                );
            }

            masterMap.set(key, masterRow); // Put the updated row back in the map
            updatedCount++;
        } else {
            skippedCount++;
        }
    });

    // NEW: Fail if critical fields missing
    if (mappingErrors.length > 0) {
        const errorSummary = mappingErrors.slice(0, 10).join('\n');
        const totalErrors = mappingErrors.length;
        const errorMsg = `MAPPING ERRORS (${totalErrors} products):\n${errorSummary}\n${totalErrors > 10 ? `... and ${totalErrors - 10} more` : ''}\nStaging sheet missing critical fields. Check schema. HALTING.`;
        logger.error(serviceName, functionName, errorMsg, null, { sessionId });
        throw new Error(errorMsg);
    }

    logger.info(serviceName, functionName, `WebProdM upsert complete: ${updatedCount} products updated, ${skippedCount} not found in master`, { sessionId });

    // Convert the map back to a 2D array to write to the sheet
    const finalData = Array.from(masterMap.values()).map(rowObject => {
        return masterHeaders.map(header => {
            const value = rowObject[header];
            // CRITICAL: Don't treat 0 as falsy - it's a valid stock/price value
            return (value !== undefined && value !== null) ? value : '';
        });
    });

    // --- ENHANCED SANITY CHECK ---
    if (finalData.length > 0) {
        const stockIdx = masterHeaders.indexOf('wpm_Stock');
        const priceIdx = masterHeaders.indexOf('wpm_RegularPrice');
        const skuIdx = masterHeaders.indexOf('wpm_SKU');
        const nameIdx = masterHeaders.indexOf('wpm_PostTitle');

        // ENHANCED: Sample more rows and check ALL critical fields
        const sampleSize = Math.min(20, finalData.length); // Increased from 5 to 20
        let validRowsFound = 0;
        const sanityIssues = [];

        for (let i = 0; i < sampleSize; i++) {
            const row = finalData[i];
            // CRITICAL: Treat 0 as valid for stock/price (0 !== '', 0 !== null, 0 !== undefined)
            const hasStock = stockIdx > -1 && row[stockIdx] !== '' && row[stockIdx] !== null && row[stockIdx] !== undefined;
            const hasPrice = priceIdx > -1 && row[priceIdx] !== '' && row[priceIdx] !== null && row[priceIdx] !== undefined;
            const hasSKU = skuIdx > -1 && row[skuIdx] !== '' && row[skuIdx] !== null && row[skuIdx] !== undefined;
            const hasName = nameIdx > -1 && row[nameIdx] !== '' && row[nameIdx] !== null && row[nameIdx] !== undefined;

            // ENHANCED: Require Stock AND Price AND SKU AND Name (not just OR)
            if (hasStock && hasPrice && hasSKU && hasName) {
                validRowsFound++;
            } else {
                // Track what's missing
                const missing = [];
                if (!hasSKU) missing.push('SKU');
                if (!hasName) missing.push('Name');
                if (!hasStock) missing.push('Stock');
                if (!hasPrice) missing.push('Price');
                sanityIssues.push(`Row ${i + 1}: Missing ${missing.join(', ')}`);
            }
        }

        // ENHANCED: Require at least 80% of sampled rows to be valid
        const validPercentage = (validRowsFound / sampleSize) * 100;
        if (validPercentage < 80) {
            const msg = `CRITICAL SANITY CHECK FAILED in _upsertWebProductsData. Only ${validRowsFound}/${sampleSize} sampled rows (${validPercentage.toFixed(1)}%) have all critical fields. Issues:\n${sanityIssues.slice(0, 5).join('\n')}\nAborting write to prevent data corruption.`;
            logger.error(serviceName, functionName, msg, null, { sessionId: sessionId });
            throw new Error(msg);
        }

        logger.info(serviceName, functionName, `Sanity check passed: ${validRowsFound}/${sampleSize} sampled rows (${validPercentage.toFixed(1)}%) valid.`, { sessionId });
    }
    // --- END ENHANCED SANITY CHECK ---

    // Sort by product name (wpm_PostTitle) before writing
    const postTitleIdx = masterHeaders.indexOf('wpm_PostTitle');
    if (postTitleIdx > -1 && finalData.length > 0) {
        finalData.sort((a, b) => {
            const nameA = String(a[postTitleIdx] || '').toLowerCase();
            const nameB = String(b[postTitleIdx] || '').toLowerCase();
            return nameA.localeCompare(nameB, 'en');
        });
        logger.info(serviceName, functionName, 'Sorted WebProdM data by product name (wpm_PostTitle).', { sessionId });
    }

    // Write the updated data back to WebProdM
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const masterSheet = dataSpreadsheet.getSheetByName('WebProdM');
    masterSheet.getRange(2, 1, masterSheet.getMaxRows() - 1, masterSheet.getMaxColumns()).clearContent();
    if (finalData.length > 0) {
        masterSheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
        // Apply standard formatting: top-align and single row height
        _applyProductSheetFormatting(masterSheet, finalData.length);
    }
    CacheService.getScriptCache().remove('skuToWebIdMap'); // Invalidate SKU map cache
    logger.info(serviceName, functionName, `Upsert to WebProdM complete. Total rows: ${finalData.length}. Cache invalidated.`, { sessionId: sessionId });
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
        // Note: validation jobs (job.manual.validation.master, job.periodic.validation.master)
        // are routed directly to ValidationOrchestratorService by OrchestratorService
        case 'export.web.inventory':
          exportWebInventory(sessionId); // Pass sessionId
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

  function exportWebInventory(sessionId) { // Accept sessionId
    const functionName = 'exportWebInventory';
    LoggerService.info('ProductService', functionName, 'Starting WooCommerce inventory update export with change detection.', { sessionId: sessionId });

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();

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
      const webProdMData = ConfigService._getSheetDataAsMap(allConfig['system.sheet_names'].WebProdM, allConfig['schema.data.WebProdM'].headers.split(','), 'wpm_ID');
      const webProdMMap = webProdMData.map;

      // 4. Compare new values with existing and prepare export data for changed products
      const exportProducts = [];
      let productsChecked = 0;
      let productsSkipped = 0; // Skipped because not in Comax

      for (const [webIdEn, webProdMRow] of webProdMMap.entries()) {
        productsChecked++;

        // Skip bundle products - they don't exist in Comax
        const productType = String(webProdMRow.wpm_Type || '').toLowerCase();
        if (productType === 'woosb' || productType === 'bundle') {
          continue;
        }

        const sku = String(webProdMRow.wpm_SKU || '').trim();

        if (!cmxMap.has(sku)) {
          productsSkipped++;
          LoggerService.warn('ProductService', functionName, `Skipping product ${sku} (${webProdMRow.wpm_PostTitle}): Not found in Comax master data.`);
          continue; // Cannot determine new price/stock, so skip.
        }
        const cmxProduct = cmxMap.get(sku);

        // Get existing values from WebProdM
        const oldStock = Number(webProdMRow.wpm_Stock) || 0;
        const oldPrice = webProdMRow.wpm_RegularPrice;

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
            ID: webProdMRow.wpm_ID,
            SKU: sku,
            WName: webProdMRow.wpm_PostTitle,
            Stock: newStock,
            RegularPrice: newPrice
          });
        }
      }

      LoggerService.info('ProductService', functionName, `Checked ${productsChecked} products. Skipped ${productsSkipped} (not in Comax). Found ${exportProducts.length} products with changed stock or price.`);

      if (exportProducts.length === 0) {
        LoggerService.info('ProductService', functionName, 'No product changes detected. Export file will not be created.');
        // Update state to indicate "No changes" or empty filename?
        // User wants to see the filename. If no file, maybe "No Changes"?
        if (sessionId) {
            const currentState = SyncStateService.getSyncState();
            if (currentState.sessionId === sessionId) {
                currentState.webExportFilename = 'No Changes Detected';
                currentState.lastUpdated = new Date().toISOString();
                SyncStateService.setSyncState(currentState);
            }
        }
        return { success: true, message: 'No product changes detected. Export file not created.' }; 
      }

      // 5. Format and save the CSV
      const csvContent = WooCommerceFormatter.formatInventoryUpdate(exportProducts);

      const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
      const namePattern = allConfig['system.files.output_names']?.web_inventory_export || 'Inv-Web-{timestamp}.csv';
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
      const fileName = namePattern.replace('{timestamp}', timestamp);
      
      const file = DriveApp.getFolderById(exportFolderId).createFile(fileName, csvContent, MimeType.CSV);
      LoggerService.info('ProductService', functionName, `WooCommerce inventory update file created: ${file.getName()} (ID: ${file.getId()})`);

      // Update Sync State with Filename
      if (sessionId) {
          const currentState = SyncStateService.getSyncState();
          // Ensure we are updating the correct session's state (though job runs in context)
          if (currentState.sessionId === sessionId) {
              currentState.webExportFilename = fileName;
              currentState.lastUpdated = new Date().toISOString();
              SyncStateService.setSyncState(currentState);
          }
      }

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
      }

      const taskTitle = 'Confirm Web Inventory Export';
      const taskNotes = `Web inventory export file ${file.getName()} has been generated. Please confirm that the web inventory has been updated.`;
      TaskService.createTask('task.confirmation.web_inventory_export', file.getId(), file.getName(), taskTitle, taskNotes, sessionId);

      return { success: true, message: 'Web Inventory Export file created: ' + file.getName(), fileUrl: file.getUrl() };

    } catch (e) {
      LoggerService.error('ProductService', functionName, `Error generating WooCommerce inventory update export: ${e.message}`, e);
      throw e;
    }
  }

  function getProductDetails(sku) {
    const startTime = new Date();
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();

      LoggerService.info('ProductService', 'getProductDetails', `Fetching details for SKU ${sku} using cached maps...`);

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

      // Helper to fetch row object with CacheService caching
      const getRowObject = (sheetName, schema, keyCol) => {
        const cacheKey = `productData_${sheetName}`;
        const cache = CacheService.getScriptCache();
        const now = Date.now();
        const targetSku = String(sku).trim();

        // Try to get from CacheService
        try {
          const cachedData = cache.get(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            const cacheAge = Math.round((now - parsed.timestamp) / 1000);

            LoggerService.info('ProductService', 'getProductDetails',
              `Using CacheService data for ${sheetName} (age: ${cacheAge}s)`);

            // Reconstruct Map from cached entries array
            const dataMap = new Map(parsed.entries);
            const rowObj = dataMap.get(targetSku);
            if (!rowObj) {
              LoggerService.info('ProductService', 'getProductDetails',
                `SKU ${targetSku} not found in cached ${sheetName}`);
            }
            return rowObj || null;
          }
        } catch (e) {
          LoggerService.warn('ProductService', 'getProductDetails',
            `Failed to read cache for ${sheetName}: ${e.message}`);
        }

        // Cache miss - load from sheet
        LoggerService.info('ProductService', 'getProductDetails',
            `Cache miss for ${sheetName}, loading from sheet...`);

        if (!sheetName || !schema) {
            LoggerService.warn('ProductService', 'getProductDetails',
                `Missing sheetName or schema for ${sheetName}`);
            return null;
        }

        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            LoggerService.warn('ProductService', 'getProductDetails',
                `Sheet '${sheetName}' not found.`);
            return null;
        }

        if (sheet.getLastRow() < 2) {
            LoggerService.info('ProductService', 'getProductDetails',
                `Sheet '${sheetName}' is empty.`);
            return null;
        }

        const headers = schema.headers.split(',');
        const data = sheet.getDataRange().getValues();
        const sheetHeaders = data[0];
        const keyIndex = sheetHeaders.indexOf(keyCol);

        if (keyIndex === -1) {
            LoggerService.warn('ProductService', 'getProductDetails',
                `Key column '${keyCol}' not found in sheet '${sheetName}'.`);
            return null;
        }

        // Build map for entire sheet
        const dataMap = new Map();
        for (let i = 1; i < data.length; i++) {
            const rowData = data[i];
            const key = String(rowData[keyIndex]).trim();
            if (key) {
                const rowObj = {};
                headers.forEach((h, idx) => {
                    const headerIdx = sheetHeaders.indexOf(h);
                    if (headerIdx > -1) rowObj[h] = rowData[headerIdx];
                });
                dataMap.set(key, rowObj);
            }
        }

        // Cache the map using CacheService (convert Map to array for JSON serialization)
        const cacheData = {
          timestamp: now,
          entries: Array.from(dataMap.entries())  // Convert Map to array for JSON
        };

        try {
          cache.put(cacheKey, JSON.stringify(cacheData), 300); // 300 seconds = 5 minutes
          LoggerService.info('ProductService', 'getProductDetails',
            `Cached ${dataMap.size} rows in CacheService for ${sheetName}`);
        } catch (e) {
          LoggerService.warn('ProductService', 'getProductDetails',
            `Failed to cache ${sheetName}: ${e.message}`);
        }

        // Return the requested row
        const rowObj = dataMap.get(targetSku);
        return rowObj || null;
      };

      let masterData = getRowObject(sheetNames.master, schemas.master, 'wdm_SKU');
      const stagingData = getRowObject(sheetNames.staging, schemas.staging, 'wds_SKU');
      const comaxData = getRowObject(sheetNames.comax, schemas.comax, 'cpm_SKU');
      const webProdData = getRowObject(sheetNames.webProd, schemas.webProd, 'wpm_SKU');

      // Fallback logic for names if WebDetM is incomplete
      if (!masterData) masterData = {}; // Initialize if null so we can populate it
      
      if (!masterData.wdm_NameEn && webProdData && webProdData.wpm_PostTitle) {
          masterData.wdm_NameEn = webProdData.wpm_PostTitle;
      }
      if (!masterData.wdm_NameHe && comaxData && comaxData.cpm_NameHe) {
          masterData.wdm_NameHe = comaxData.cpm_NameHe;
      }

      // Use cached lookup helpers for better performance
      const regions = _getCachedRegions();
      const grapes = _getCachedGrapes();
      const kashrut = _getCachedKashrut();

      // Generate ABV options
      const abvOptions = [];
      for (let i = 12.0; i <= 14.5; i += 0.5) {
          abvOptions.push(i.toFixed(1));
      }

      const result = {
        master: masterData,
        staging: stagingData || null,
        comax: comaxData || null,
        regions: regions,
        abvOptions: abvOptions,
        grapes: grapes,
        kashrut: kashrut
      };

      const endTime = new Date();
      LoggerService.info('ProductService', 'getProductDetails',
        `Completed in ${endTime - startTime}ms for SKU ${sku}`);

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
                // Only divide by 100 if value looks like a whole percentage (> 1)
                // Values like 0.14 are already decimal, values like 14 need conversion
                if (value > 1) {
                    value = value / 100; // Convert percentage (14.0) to decimal (0.14)
                }
                // else: value is already decimal (e.g., 0.14), keep as is
            }
        }
        rowData[header] = value !== undefined ? value : '';
      });
      
      // 2. Upsert into WebDetS
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
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

      // 4. Invalidate caches after data modification
      _invalidateProductCache();
      WebAppTasks.invalidateCache();

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
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
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

      // 3. Update Task Status to "Accepted" (not "Done" - Done happens after finalize/export)
      TaskService.updateTaskStatus(taskId, 'Accepted');

      // Invalidate caches after data modification
      _invalidateProductCache();
      WebAppTasks.invalidateCache();

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
        const spreadsheet = SheetAccessor.getDataSpreadsheet();

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
            'Product Title EN',
            'Short Description EN',
            'Long Description EN',
            'Short Description HE',
            'Long Description HE',
            'Product Title HE'
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

            const productTitleEn = webDetRow.wdm_NameEn || '';
            const productTitleHe = webDetRow.wdm_NameHe || (cmxRow ? cmxRow.cpm_NameHe : '');
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
                longDescriptionHeHtml,
                productTitleHe
            ]);
        });

        if (exportDataRows.length <= 1 && skippedSkus.length === skus.length) { // Only headers present AND all SKUs were skipped or no SKUs were processed
            logger.info(serviceName, functionName, 'No product data was successfully exported.', { sessionId: sessionId });
            return { success: false, message: 'No product data was successfully exported. All selected products were skipped.' };
        }

        // 4. Create and format the new Google Sheet
        const namePattern = allConfig['system.files.output_names']?.web_product_update || 'Prod-Web-{timestamp}';
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
        const newSpreadsheetName = namePattern.replace('{timestamp}', timestamp).replace('.csv', ''); // Remove .csv if present as this is a Sheet
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

          const namePattern = allConfig['system.files.output_names']?.web_product_update || 'Prod-Web-{timestamp}';
          const fileName = namePattern.replace('{timestamp}', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm')).replace('.csv', '');

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

        // Prepare for WebDetS cleanup
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const spreadsheet = SheetAccessor.getDataSpreadsheet();
        const stagingSheetName = allConfig['system.sheet_names'].WebDetS;
        const stagingSheet = spreadsheet.getSheetByName(stagingSheetName);
        const stagingSchema = allConfig['schema.data.WebDetS'];
        const stagingHeaders = stagingSchema.headers.split(',');
        const skuColIndex = stagingHeaders.indexOf('wds_SKU');

        let count = 0;
        let deletedCount = 0;
        acceptedTasks.forEach(t => {
            TaskService.updateTaskStatus(t.st_TaskId);
            count++;

            // Delete corresponding WebDetS row
            const sku = t.st_LinkedEntityId;
            if (sku && stagingSheet && skuColIndex >= 0) {
                const stagingData = stagingSheet.getDataRange().getValues();
                for (let i = stagingData.length - 1; i > 0; i--) { // Start from end, skip header
                    if (String(stagingData[i][skuColIndex]) === String(sku)) {
                        stagingSheet.deleteRow(i + 1);
                        deletedCount++;
                        logger.info(serviceName, functionName, `Deleted WebDetS row for SKU ${sku}`, { sessionId: sessionId, sku: sku });
                        break;
                    }
                }
            }
        });

        // Invalidate caches after staging cleanup
        _invalidateProductCache();
        WebAppTasks.invalidateCache();

        logger.info(serviceName, functionName, `Completed ${count} tasks, deleted ${deletedCount} staging rows.`, { sessionId: sessionId, completedTasks: count, deletedRows: deletedCount });
        return { success: true, message: `Marked ${count} tasks as Completed. Cleaned up ${deletedCount} staging rows.` };

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
      TaskService.createTask('task.onboarding.add_product', sku, suggestedNameEn, title, notes, sessionId); // TaskService needs sessionId too
      
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
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
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
      const spreadsheet = SheetAccessor.getDataSpreadsheet();

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
      const webIdIdx = webProdHeaders.indexOf('wpm_ID');
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
      // Required: wpm_ID, wpm_SKU, wpm_PostTitle, wpm_PostStatus, wpm_Stock, wpm_RegularPrice
      const newWebProdRow = new Array(webProdHeaders.length).fill('');
      
      // Map logic
      const wp_WebIdIdx = webProdHeaders.indexOf('wpm_ID');
      const wp_SkuIdx = webProdHeaders.indexOf('wpm_SKU');
      const wp_NameIdx = webProdHeaders.indexOf('wpm_PostTitle');
      const wp_StatusIdx = webProdHeaders.indexOf('wpm_PostStatus');
      const wp_StockIdx = webProdHeaders.indexOf('wpm_Stock');
      const wp_PriceIdx = webProdHeaders.indexOf('wpm_RegularPrice');

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
      WebAppTasks.invalidateCache();

      // 5. Force Reload Config/Cache if needed (though product maps are usually rebuilt per request)
      skuToWebIdMap = null; // Invalidate local cache if used
      CacheService.getScriptCache().remove('skuToWebIdMap'); // Invalidate shared cache
      
      return { success: true };

    } catch (e) {
      logger.error(serviceName, functionName, `Error: ${e.message}`, e, { sessionId: sessionId, sku: sku, wooIdEn: wooIdEn, wooIdHe: wooIdHe });
      throw e;
    }
  }

  /**
   * Vendor SKU Update - Updates SKU across ALL product master sheets.
   * Used when vendor changes SKU in both Comax and WooCommerce.
   * @param {string} oldSku The old SKU to replace.
   * @param {string} newSku The new SKU value.
   * @param {string} sessionId Optional session ID for logging.
   * @returns {Object} { success: boolean, message: string }
   */
  function vendorSkuUpdate(oldSku, newSku, sessionId) {
    const serviceName = 'ProductService';
    const functionName = 'vendorSkuUpdate';
    logger.info(serviceName, functionName, `Starting vendor SKU update: ${oldSku} -> ${newSku}`, { sessionId, oldSku, newSku });

    if (!oldSku || !newSku) {
      return { success: false, message: 'Both old SKU and new SKU are required.' };
    }

    if (oldSku === newSku) {
      return { success: false, message: 'Old SKU and new SKU cannot be the same.' };
    }

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
      const userEmail = Session.getActiveUser().getEmail();

      let updatedSheets = [];

      // 1. Update CmxProdM
      const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
      if (cmxSheet) {
        const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
        const cmxSkuIdx = cmxHeaders.indexOf('cpm_SKU');
        if (cmxSkuIdx >= 0) {
          const updated = _updateSkuInSheet(cmxSheet, cmxSkuIdx, oldSku, newSku);
          if (updated) updatedSheets.push('CmxProdM');
        }
      }

      // 2. Update WebProdM
      const webProdSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      if (webProdSheet) {
        const webProdHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
        const webProdSkuIdx = webProdHeaders.indexOf('wpm_SKU');
        if (webProdSkuIdx >= 0) {
          const updated = _updateSkuInSheet(webProdSheet, webProdSkuIdx, oldSku, newSku);
          if (updated) updatedSheets.push('WebProdM');
        }
      }

      // 3. Update WebDetM
      const webDetSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetM);
      if (webDetSheet) {
        const webDetHeaders = allConfig['schema.data.WebDetM'].headers.split(',');
        const webDetSkuIdx = webDetHeaders.indexOf('wdm_SKU');
        if (webDetSkuIdx >= 0) {
          const updated = _updateSkuInSheet(webDetSheet, webDetSkuIdx, oldSku, newSku);
          if (updated) updatedSheets.push('WebDetM');
        }
      }

      // 4. Update WebXltM
      const webXltSheet = spreadsheet.getSheetByName('WebXltM');
      if (webXltSheet) {
        const webXltHeaders = allConfig['schema.data.WebXltM'].headers.split(',');
        const webXltSkuIdx = webXltHeaders.indexOf('wxl_SKU');
        if (webXltSkuIdx >= 0) {
          const updated = _updateSkuInSheet(webXltSheet, webXltSkuIdx, oldSku, newSku);
          if (updated) updatedSheets.push('WebXltM');
        }
      }

      // 5. Update SysProductAudit
      const auditSheet = spreadsheet.getSheetByName('SysProductAudit');
      if (auditSheet) {
        const auditHeaders = allConfig['schema.data.SysProductAudit'].headers.split(',');
        const auditSkuIdx = auditHeaders.indexOf('pa_SKU');
        if (auditSkuIdx >= 0) {
          const updated = _updateSkuInSheet(auditSheet, auditSkuIdx, oldSku, newSku);
          if (updated) updatedSheets.push('SysProductAudit');
        }
      }

      // 6. Update SysTasks (open tasks referencing old SKU in st_LinkedEntityId)
      const taskSchema = allConfig['schema.data.SysTasks'];
      const taskHeaders = taskSchema.headers.split(',');
      const taskSheet = spreadsheet.getSheetByName('SysTasks');
      if (taskSheet) {
        const taskEntityIdIdx = taskHeaders.indexOf('st_LinkedEntityId');
        const taskStatusIdx = taskHeaders.indexOf('st_Status');
        if (taskEntityIdIdx >= 0 && taskStatusIdx >= 0) {
          const taskData = taskSheet.getDataRange().getValues();
          let taskUpdated = false;
          for (let i = 1; i < taskData.length; i++) {
            const status = String(taskData[i][taskStatusIdx]).trim();
            // Only update open tasks (not Completed/Cancelled)
            if (status !== 'Completed' && status !== 'Cancelled' && status !== 'Done') {
              if (String(taskData[i][taskEntityIdIdx]).trim() === String(oldSku).trim()) {
                taskSheet.getRange(i + 1, taskEntityIdIdx + 1).setValue(newSku);
                taskUpdated = true;
              }
            }
          }
          if (taskUpdated) updatedSheets.push('SysTasks');
        }
      }

      // 7. Log the SKU update to SysLog
      _logSkuUpdate('VendorSkuUpdate', oldSku, newSku, userEmail, updatedSheets.join(', '));

      // Invalidate caches
      _invalidateProductCache();

      const message = updatedSheets.length > 0
        ? `SKU updated from ${oldSku} to ${newSku} in: ${updatedSheets.join(', ')}`
        : `No records found with SKU ${oldSku}`;

      logger.info(serviceName, functionName, message, { sessionId, oldSku, newSku, updatedSheets });
      return { success: true, message };

    } catch (e) {
      logger.error(serviceName, functionName, `Error updating SKU: ${e.message}`, e, { sessionId, oldSku, newSku });
      return { success: false, message: `Error: ${e.message}` };
    }
  }

  /**
   * Web Product Reassign - Updates SKU in web product sheets and optionally updates IsWeb flags in CmxProdM.
   * Used when replacing an old product with a new one on the website.
   * @param {string} webProductId The WooCommerce Product ID (EN or HE).
   * @param {string} oldSku The old Comax SKU being replaced.
   * @param {string} newSku The new Comax SKU to assign.
   * @param {boolean} updateOldIsWeb If true, set old product's cpm_IsWeb to empty.
   * @param {boolean} updateNewIsWeb If true, set new product's cpm_IsWeb to '1'.
   * @param {string} sessionId Optional session ID for logging.
   * @returns {Object} { success: boolean, message: string }
   */
  function webProductReassign(webProductId, oldSku, newSku, updateOldIsWeb, updateNewIsWeb, sessionId) {
    const serviceName = 'ProductService';
    const functionName = 'webProductReassign';
    logger.info(serviceName, functionName, `Starting web product reassign: WebId ${webProductId}, ${oldSku} -> ${newSku}`, { sessionId, webProductId, oldSku, newSku, updateOldIsWeb, updateNewIsWeb });

    if (!newSku) {
      return { success: false, message: 'New SKU is required.' };
    }
    if (!webProductId && !oldSku) {
      return { success: false, message: 'Either Web Product ID or old SKU is required to identify the product.' };
    }

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
      const userEmail = Session.getActiveUser().getEmail();

      let updatedSheets = [];

      // 1. Find and update WebProdM by wpm_WebIdEn or wpm_WebIdHe
      const webProdSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      if (!webProdSheet) {
        return { success: false, message: 'WebProdM sheet not found.' };
      }

      const webProdHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
      const webIdEnIdx = webProdHeaders.indexOf('wpm_WebIdEn');
      const webIdHeIdx = webProdHeaders.indexOf('wpm_WebIdHe');
      const webProdSkuIdx = webProdHeaders.indexOf('wpm_SKU');

      const webProdData = webProdSheet.getDataRange().getValues();
      let webProdRowIdx = -1;
      const webIdStr = webProductId ? String(webProductId).trim() : '';
      const oldSkuStr = oldSku ? String(oldSku).trim() : '';

      for (let i = 1; i < webProdData.length; i++) {
        const idEn = String(webProdData[i][webIdEnIdx]).trim();
        const idHe = String(webProdData[i][webIdHeIdx]).trim();
        const rowSku = String(webProdData[i][webProdSkuIdx]).trim();
        // Match by web ID or by old SKU
        if ((webIdStr && (idEn === webIdStr || idHe === webIdStr)) || (oldSkuStr && rowSku === oldSkuStr)) {
          webProdRowIdx = i;
          // Use passed oldSku or get from sheet
          if (!oldSku) {
            oldSku = rowSku;
          }
          break;
        }
      }

      if (webProdRowIdx === -1) {
        return { success: false, message: `Product not found in WebProdM (WebId: ${webProductId || 'none'}, SKU: ${oldSku || 'none'}).` };
      }

      // Update WebProdM SKU
      webProdSheet.getRange(webProdRowIdx + 1, webProdSkuIdx + 1).setValue(newSku);
      updatedSheets.push('WebProdM');

      // 2. Update WebDetM using the old SKU to find the row
      const webDetSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetM);
      if (webDetSheet && oldSku) {
        const webDetHeaders = allConfig['schema.data.WebDetM'].headers.split(',');
        const webDetSkuIdx = webDetHeaders.indexOf('wdm_SKU');
        if (webDetSkuIdx >= 0) {
          const updated = _updateSkuInSheet(webDetSheet, webDetSkuIdx, oldSku, newSku);
          if (updated) updatedSheets.push('WebDetM');
        }
      }

      // 3. Update WebXltM using the old SKU
      const webXltSheet = spreadsheet.getSheetByName('WebXltM');
      if (webXltSheet && oldSku) {
        const webXltHeaders = allConfig['schema.data.WebXltM'].headers.split(',');
        const webXltSkuIdx = webXltHeaders.indexOf('wxl_SKU');
        if (webXltSkuIdx >= 0) {
          const updated = _updateSkuInSheet(webXltSheet, webXltSkuIdx, oldSku, newSku);
          if (updated) updatedSheets.push('WebXltM');
        }
      }

      // 4. Update CmxProdM IsWeb flags if requested, and capture new product name
      let newProductNameHe = '';
      if (updateOldIsWeb || updateNewIsWeb) {
        const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
        if (cmxSheet) {
          const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
          const cmxSkuIdx = cmxHeaders.indexOf('cpm_SKU');
          const cmxIsWebIdx = cmxHeaders.indexOf('cpm_IsWeb');
          const cmxNameHeIdx = cmxHeaders.indexOf('cpm_NameHe');

          if (cmxSkuIdx >= 0 && cmxIsWebIdx >= 0) {
            const cmxData = cmxSheet.getDataRange().getValues();
            const oldSkuStr = String(oldSku).trim();
            const newSkuStr = String(newSku).trim();

            for (let i = 1; i < cmxData.length; i++) {
              const sku = String(cmxData[i][cmxSkuIdx]).trim();

              // Set old product's IsWeb to 'לא'
              if (updateOldIsWeb && sku === oldSkuStr) {
                cmxSheet.getRange(i + 1, cmxIsWebIdx + 1).setValue('לא');
                if (!updatedSheets.includes('CmxProdM (old IsWeb off)')) {
                  updatedSheets.push('CmxProdM (old IsWeb off)');
                }
              }

              // Set new product's IsWeb to 'כן'
              if (updateNewIsWeb && sku === newSkuStr) {
                cmxSheet.getRange(i + 1, cmxIsWebIdx + 1).setValue('כן');
                if (cmxNameHeIdx >= 0) {
                  newProductNameHe = String(cmxData[i][cmxNameHeIdx] || '');
                }
                if (!updatedSheets.includes('CmxProdM (new IsWeb on)')) {
                  updatedSheets.push('CmxProdM (new IsWeb on)');
                }
              }
            }
          }
        }
      }

      // If we didn't capture the name from step 4 (IsWeb loop was skipped), look it up
      if (!newProductNameHe) {
        const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
        if (cmxSheet) {
          const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
          const cmxSkuIdx = cmxHeaders.indexOf('cpm_SKU');
          const cmxNameHeIdx = cmxHeaders.indexOf('cpm_NameHe');
          if (cmxSkuIdx >= 0 && cmxNameHeIdx >= 0) {
            const cmxData = cmxSheet.getDataRange().getValues();
            const newSkuStr = String(newSku).trim();
            for (let i = 1; i < cmxData.length; i++) {
              if (String(cmxData[i][cmxSkuIdx]).trim() === newSkuStr) {
                newProductNameHe = String(cmxData[i][cmxNameHeIdx] || '');
                break;
              }
            }
          }
        }
      }

      // 5. Log the SKU update
      _logSkuUpdate('WebProductReassign', oldSku || webProductId, newSku, userEmail, updatedSheets.join(', '));

      // 6. Create vintage update task for the new product
      try {
        TaskService.createTask(
          'task.validation.vintage_mismatch',
          newSku,
          newProductNameHe || newSku,
          'Product Replacement: web content review needed',
          JSON.stringify({ replacedSku: oldSku, webProductId: webProductId, reason: 'product_replacement' }),
          sessionId
        );
        logger.info(serviceName, functionName, `Created vintage update task for replacement product ${newSku}`);
      } catch (taskError) {
        if (!taskError.message.includes('already exists')) {
          logger.warn(serviceName, functionName, `Could not create vintage update task: ${taskError.message}`);
        }
      }

      // Invalidate caches
      _invalidateProductCache();

      const message = `Web Product ${webProductId} reassigned from SKU ${oldSku} to ${newSku}. Updated: ${updatedSheets.join(', ')}`;
      logger.info(serviceName, functionName, message, { sessionId, webProductId, oldSku, newSku, updatedSheets });
      return { success: true, message };

    } catch (e) {
      logger.error(serviceName, functionName, `Error reassigning web product: ${e.message}`, e, { sessionId, webProductId, newSku });
      return { success: false, message: `Error: ${e.message}` };
    }
  }

  /**
   * Helper to update SKU value in a sheet column.
   * @param {Sheet} sheet The sheet object.
   * @param {number} skuColIdx The 0-based index of the SKU column.
   * @param {string} oldSku The old SKU to find.
   * @param {string} newSku The new SKU to set.
   * @returns {boolean} True if a row was updated.
   */
  function _updateSkuInSheet(sheet, skuColIdx, oldSku, newSku) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // Skip header
      if (String(data[i][skuColIdx]).trim() === String(oldSku).trim()) {
        sheet.getRange(i + 1, skuColIdx + 1).setValue(newSku);
        return true;
      }
    }
    return false;
  }

  /**
   * Logs a SKU update to SysLog for audit trail.
   * @param {string} updateType 'VendorSkuUpdate' or 'WebProductReassign'
   * @param {string} oldSku The old SKU.
   * @param {string} newSku The new SKU.
   * @param {string} userEmail The user who performed the update.
   * @param {string} affectedSheets Comma-separated list of updated sheets.
   */
  function _logSkuUpdate(updateType, oldSku, newSku, userEmail, affectedSheets) {
    try {
      const logSheet = SheetAccessor.getLogSheet('SysLog', false);

      if (logSheet) {
        const timestamp = new Date();
        const logEntry = [
          timestamp,
          'INFO',
          'ProductService',
          updateType,
          `SKU Update: ${oldSku} -> ${newSku}`,
          JSON.stringify({ oldSku, newSku, affectedSheets, updatedBy: userEmail }),
          ''  // sessionId
        ];
        logSheet.appendRow(logEntry);
      }
    } catch (e) {
      // Don't throw - logging failure shouldn't break the main operation
      console.error(`Failed to log SKU update: ${e.message}`);
    }
  }

  /**
   * Gets recent SKU updates from SysLog for display in the UI.
   * @param {number} limit Number of records to return (default 10).
   * @returns {Array<Object>} Array of { date, type, oldSku, newSku, updatedBy }
   */
  function getRecentSkuUpdates(limit) {
    limit = limit || 10;
    try {
      const logSheet = SheetAccessor.getLogSheet('SysLog', false);

      if (!logSheet || logSheet.getLastRow() <= 1) {
        return [];
      }

      const data = logSheet.getDataRange().getValues();
      const results = [];

      // Search from the end (most recent) backwards
      for (let i = data.length - 1; i >= 1 && results.length < limit; i--) {
        const functionName = String(data[i][3] || '');
        if (functionName === 'VendorSkuUpdate' || functionName === 'WebProductReassign') {
          try {
            const details = JSON.parse(data[i][5] || '{}');
            results.push({
              date: data[i][0],
              type: functionName === 'VendorSkuUpdate' ? 'Vendor Update' : 'Reassign',
              oldSku: details.oldSku || '',
              newSku: details.newSku || '',
              updatedBy: details.updatedBy || ''
            });
          } catch (parseErr) {
            // Skip malformed entries
          }
        }
      }

      return results;
    } catch (e) {
      console.error(`Failed to get recent SKU updates: ${e.message}`);
      return [];
    }
  }

  /**
   * Looks up a product by SKU and returns comprehensive data from both Comax and Web.
   * @param {string} sku The product SKU to lookup.
   * @returns {Object} { comax: {...}, web: {...} | null }
   */
  function lookupProductBySku(sku) {
    const serviceName = 'ProductService';
    const functionName = 'lookupProductBySku';

    if (!sku) return null;

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();

      // Lookup in CmxProdM
      const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
      const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
      const cmxSkuIdx = cmxHeaders.indexOf('cpm_SKU');
      const cmxCmxIdIdx = cmxHeaders.indexOf('cpm_CmxId');
      const cmxNameHeIdx = cmxHeaders.indexOf('cpm_NameHe');
      const cmxDivisionIdx = cmxHeaders.indexOf('cpm_Division');
      const cmxGroupIdx = cmxHeaders.indexOf('cpm_Group');
      const cmxIsWebIdx = cmxHeaders.indexOf('cpm_IsWeb');
      const cmxIsActiveIdx = cmxHeaders.indexOf('cpm_IsActive');
      const cmxStockIdx = cmxHeaders.indexOf('cpm_Stock');
      const cmxPriceIdx = cmxHeaders.indexOf('cpm_Price');

      let comaxData = null;
      let foundSku = null;
      if (cmxSheet) {
        const cmxData = cmxSheet.getDataRange().getValues();
        const searchVal = String(sku).trim();
        for (let i = 1; i < cmxData.length; i++) {
          // Try matching by SKU first, then by Comax ID
          const rowSku = String(cmxData[i][cmxSkuIdx] || '').trim();
          const rowCmxId = String(cmxData[i][cmxCmxIdIdx] || '').trim();
          if (rowSku === searchVal || rowCmxId === searchVal) {
            const isWebVal = String(cmxData[i][cmxIsWebIdx] || '').trim().toLowerCase();
            foundSku = rowSku;
            comaxData = {
              sku: rowSku,
              cmxId: rowCmxId,
              nameHe: cmxData[i][cmxNameHeIdx] || '',
              division: cmxData[i][cmxDivisionIdx] || '',
              group: cmxData[i][cmxGroupIdx] || '',
              isWeb: isWebVal === '1' || isWebVal === 'true' || isWebVal === 'כן',
              isActive: !!cmxData[i][cmxIsActiveIdx],
              stock: cmxData[i][cmxStockIdx] || 0,
              price: cmxData[i][cmxPriceIdx] || 0
            };
            break;
          }
        }
      }

      if (!comaxData) {
        return null; // Not found in Comax by SKU or CmxId
      }

      // Lookup in WebProdM + WebDetM using the found SKU (in case we searched by CmxId)
      const lookupSku = comaxData.sku;
      let webData = null;
      const webProdSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      const webProdHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
      const wpmSkuIdx = webProdHeaders.indexOf('wpm_SKU');
      const wpmWebIdEnIdx = webProdHeaders.indexOf('wpm_WebIdEn');
      const wpmWebIdHeIdx = webProdHeaders.indexOf('wpm_WebIdHe');

      if (webProdSheet && lookupSku) {
        const webProdData = webProdSheet.getDataRange().getValues();
        for (let i = 1; i < webProdData.length; i++) {
          if (String(webProdData[i][wpmSkuIdx]).trim() === lookupSku) {
            webData = {
              webIdEn: webProdData[i][wpmWebIdEnIdx] || '',
              webIdHe: webProdData[i][wpmWebIdHeIdx] || '',
              nameEn: '',
              nameHe: ''
            };
            break;
          }
        }
      }

      // Get web names from WebDetM
      if (webData && lookupSku) {
        const webDetSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetM);
        const webDetHeaders = allConfig['schema.data.WebDetM'].headers.split(',');
        const wdmSkuIdx = webDetHeaders.indexOf('wdm_SKU');
        const wdmNameEnIdx = webDetHeaders.indexOf('wdm_NameEn');
        const wdmNameHeIdx = webDetHeaders.indexOf('wdm_NameHe');

        if (webDetSheet) {
          const webDetData = webDetSheet.getDataRange().getValues();
          for (let i = 1; i < webDetData.length; i++) {
            if (String(webDetData[i][wdmSkuIdx]).trim() === lookupSku) {
              webData.nameEn = webDetData[i][wdmNameEnIdx] || '';
              webData.nameHe = webDetData[i][wdmNameHeIdx] || '';
              break;
            }
          }
        }
      }

      return { comax: comaxData, web: webData };

    } catch (e) {
      logger.error(serviceName, functionName, `Error looking up product: ${e.message}`, e, { sku });
      return null;
    }
  }

  /**
   * Searches web products (products linked to WooCommerce) by SKU or name.
   * @param {string} searchTerm The search term (min 2 chars).
   * @returns {Array<Object>} Array of { sku, webIdEn, webIdHe, nameEn, nameHe }
   */
  function searchWebProducts(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
      const term = String(searchTerm).toLowerCase();

      // Get WebProdM data
      const webProdSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      const webProdHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
      const wpmSkuIdx = webProdHeaders.indexOf('wpm_SKU');
      const wpmWebIdEnIdx = webProdHeaders.indexOf('wpm_WebIdEn');
      const wpmWebIdHeIdx = webProdHeaders.indexOf('wpm_WebIdHe');

      if (!webProdSheet) return [];

      const webProdData = webProdSheet.getDataRange().getValues();

      // Get WebDetM for names
      const webDetSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebDetM);
      const webDetHeaders = allConfig['schema.data.WebDetM'].headers.split(',');
      const wdmSkuIdx = webDetHeaders.indexOf('wdm_SKU');
      const wdmNameEnIdx = webDetHeaders.indexOf('wdm_NameEn');
      const wdmNameHeIdx = webDetHeaders.indexOf('wdm_NameHe');

      const webDetData = webDetSheet ? webDetSheet.getDataRange().getValues() : [];
      const detailsMap = new Map();
      for (let i = 1; i < webDetData.length; i++) {
        const sku = String(webDetData[i][wdmSkuIdx]).trim();
        if (sku) {
          detailsMap.set(sku, {
            nameEn: webDetData[i][wdmNameEnIdx] || '',
            nameHe: webDetData[i][wdmNameHeIdx] || ''
          });
        }
      }

      const results = [];
      for (let i = 1; i < webProdData.length && results.length < 50; i++) {
        const sku = String(webProdData[i][wpmSkuIdx] || '').trim();
        const details = detailsMap.get(sku) || { nameEn: '', nameHe: '' };

        // Search by SKU or names
        if (sku.toLowerCase().includes(term) ||
            details.nameEn.toLowerCase().includes(term) ||
            details.nameHe.includes(searchTerm)) {
          results.push({
            sku: sku,
            webIdEn: webProdData[i][wpmWebIdEnIdx] || '',
            webIdHe: webProdData[i][wpmWebIdHeIdx] || '',
            nameEn: details.nameEn,
            nameHe: details.nameHe
          });
        }
      }

      return results;

    } catch (e) {
      console.error(`Failed to search web products: ${e.message}`);
      return [];
    }
  }

  /**
   * Searches Comax products that are NOT linked to web (for replacement).
   * @param {string} searchTerm The search term (min 2 chars).
   * @returns {Array<Object>} Array of { sku, name }
   */
  function searchProductsForReplacement(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
      const term = String(searchTerm).toLowerCase();

      // Get all SKUs that are already on web (in WebProdM)
      const webProdSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].WebProdM);
      const webProdHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
      const wpmSkuIdx = webProdHeaders.indexOf('wpm_SKU');

      const webSkus = new Set();
      if (webProdSheet) {
        const webProdData = webProdSheet.getDataRange().getValues();
        for (let i = 1; i < webProdData.length; i++) {
          const sku = String(webProdData[i][wpmSkuIdx] || '').trim();
          if (sku) webSkus.add(sku);
        }
      }

      // Search CmxProdM for products NOT in WebProdM
      const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
      const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
      const cmxSkuIdx = cmxHeaders.indexOf('cpm_SKU');
      const cmxNameHeIdx = cmxHeaders.indexOf('cpm_NameHe');

      if (!cmxSheet) return [];

      const cmxData = cmxSheet.getDataRange().getValues();
      const results = [];

      for (let i = 1; i < cmxData.length && results.length < 50; i++) {
        const sku = String(cmxData[i][cmxSkuIdx] || '').trim();
        const nameHe = String(cmxData[i][cmxNameHeIdx] || '');

        // Skip if already on web
        if (webSkus.has(sku)) continue;

        // Search by SKU or Hebrew name
        if (sku.toLowerCase().includes(term) || nameHe.includes(searchTerm)) {
          results.push({
            sku: sku,
            name: nameHe
          });
        }
      }

      return results;

    } catch (e) {
      console.error(`Failed to search products for replacement: ${e.message}`);
      return [];
    }
  }

  /**
   * Searches ALL products in CmxProdM by SKU or Hebrew name.
   * Only excludes archived products — no isWeb or stock filtering.
   * Used by vendor SKU update where the product is likely already on web.
   * @param {string} searchTerm The search term (min 2 chars).
   * @returns {Array<Object>} Array of { sku, name, isWeb, stock }
   */
  function searchAllProducts(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const allConfig = ConfigService.getAllConfig();
      const spreadsheet = SheetAccessor.getDataSpreadsheet();
      const term = String(searchTerm).toLowerCase();

      const cmxSheet = spreadsheet.getSheetByName(allConfig['system.sheet_names'].CmxProdM);
      const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
      const cmxSkuIdx = cmxHeaders.indexOf('cpm_SKU');
      const cmxNameHeIdx = cmxHeaders.indexOf('cpm_NameHe');
      const cmxIsArchivedIdx = cmxHeaders.indexOf('cpm_IsArchived');
      const cmxIsWebIdx = cmxHeaders.indexOf('cpm_IsWeb');
      const cmxStockIdx = cmxHeaders.indexOf('cpm_Stock');

      if (!cmxSheet) return [];

      const isTrue = (val) => {
        const s = String(val || '').trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'כן';
      };

      const cmxData = cmxSheet.getDataRange().getValues();
      const results = [];

      for (let i = 1; i < cmxData.length && results.length < 50; i++) {
        const sku = String(cmxData[i][cmxSkuIdx] || '').trim();
        const nameHe = String(cmxData[i][cmxNameHeIdx] || '');
        const isArchived = isTrue(cmxData[i][cmxIsArchivedIdx]);

        // Skip archived products only
        if (isArchived) continue;

        // Search by SKU or Hebrew name
        if (sku.toLowerCase().includes(term) || nameHe.includes(searchTerm)) {
          results.push({
            sku: sku,
            name: nameHe,
            isWeb: isTrue(cmxData[i][cmxIsWebIdx]),
            stock: Number(cmxData[i][cmxStockIdx] || 0)
          });
        }
      }

      return results;

    } catch (e) {
      console.error(`Failed to search all products: ${e.message}`);
      return [];
    }
  }

  /**
   * Exports descriptions for ALL products in WebDetM, split into EN and HE sheets.
   * Uses language-specific WooCommerce post IDs (wpm_ID for EN, wxm_ID for HE)
   * so the output can be imported directly via WebToffee.
   * Columns per sheet: ID, WName, Description
   */
  function exportDescriptionBackfill(testSku) {
    const serviceName = 'ProductService';
    const functionName = 'exportDescriptionBackfill';
    logger.info(serviceName, functionName, 'Starting description backfill export.', { testSku: testSku || 'ALL' });
    try {
      const allConfig = ConfigService.getAllConfig();

      const getMap = (sheetName, schemaKey, keyCol) => {
        const headers = allConfig[schemaKey].headers.split(',');
        return ConfigService._getSheetDataAsMap(sheetName, headers, keyCol).map;
      };

      const webDetMap = getMap('WebDetM', 'schema.data.WebDetM', 'wdm_SKU');
      const cmxMap = getMap('CmxProdM', 'schema.data.CmxProdM', 'cpm_SKU');
      const webProdMap = getMap('WebProdM', 'schema.data.WebProdM', 'wpm_SKU');
      const webXltMap = getMap('WebXltM', 'schema.data.WebXltM', 'wxm_SKU');

      const lookupMaps = {
        texts: LookupService.getLookupMap('map.text_lookups'),
        grapes: LookupService.getLookupMap('map.grape_lookups'),
        kashrut: LookupService.getLookupMap('map.kashrut_lookups')
      };

      const skus = testSku ? [String(testSku)] : Array.from(webDetMap.keys());

      const enRows = [['ID', 'WName', 'Description']];
      const heRows = [['ID', 'WName', 'Description']];
      let skippedCount = 0;

      skus.forEach(sku => {
        const webDetRow = webDetMap.get(sku);
        if (!webDetRow) { skippedCount++; return; }

        const cmxRow = cmxMap.get(sku);
        const webProdRow = webProdMap.get(sku);
        const webXltRow = webXltMap.get(sku);

        if (webProdRow) {
          const descEn = WooCommerceFormatter.formatDescriptionHTML(sku, webDetRow, cmxRow, 'EN', lookupMaps, true);
          enRows.push([webProdRow.wpm_ID, webProdRow.wpm_PostTitle || '', descEn]);
        }

        if (webXltRow) {
          const descHe = WooCommerceFormatter.formatDescriptionHTML(sku, webDetRow, cmxRow, 'HE', lookupMaps, true);
          heRows.push([webXltRow.wxm_ID, webXltRow.wxm_PostTitle || '', descHe]);
        }

        if (!webProdRow && !webXltRow) { skippedCount++; }
      });

      if (enRows.length <= 1 && heRows.length <= 1) {
        return { success: false, message: 'No products found to export.' };
      }

      // Create spreadsheet
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
      const fileName = testSku ? `Desc-Backfill-TEST-${timestamp}` : `Desc-Backfill-${timestamp}`;
      const newSpreadsheet = SpreadsheetApp.create(fileName);

      // EN sheet
      const enSheet = newSpreadsheet.getSheets()[0];
      enSheet.setName('EN');
      if (enRows.length > 1) {
        enSheet.getRange(1, 1, enRows.length, 3).setValues(enRows);
      }

      // HE sheet
      const heSheet = newSpreadsheet.insertSheet('HE');
      if (heRows.length > 1) {
        heSheet.getRange(1, 1, heRows.length, 3).setValues(heRows);
      }

      // Move to exports folder
      const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
      try {
        DriveApp.getFileById(newSpreadsheet.getId()).moveTo(DriveApp.getFolderById(exportFolderId));
      } catch (moveError) {
        logger.warn(serviceName, functionName, `Failed to move to exports folder: ${moveError.message}`);
      }

      const msg = `Exported ${enRows.length - 1} EN + ${heRows.length - 1} HE descriptions. Skipped: ${skippedCount}`;
      logger.info(serviceName, functionName, msg, { fileUrl: newSpreadsheet.getUrl() });
      return { success: true, message: msg, fileUrl: newSpreadsheet.getUrl() };

    } catch (e) {
      logger.error(serviceName, functionName, `Error: ${e.message}`, e);
      throw e;
    }
  }

  return {
    // Note: processJob, runWebXltValidationAndUpsert, exportWebInventory moved to ProductImportService
    getProductWebIdBySku: getProductWebIdBySku,
    getProductDetails: getProductDetails,
    submitProductDetails: submitProductDetails,
    acceptProductDetails: acceptProductDetails,
    generateDetailExport: generateDetailExport,
    generateNewProductExport: generateNewProductExport,
    exportDescriptionBackfill: exportDescriptionBackfill,
    confirmWebUpdates: confirmWebUpdates,
    getProductHtmlPreview: getProductHtmlPreview,
    acceptProductSuggestion: acceptProductSuggestion,
    linkAndFinalizeNewProduct: linkAndFinalizeNewProduct,
    vendorSkuUpdate: vendorSkuUpdate,
    webProductReassign: webProductReassign,
    getRecentSkuUpdates: getRecentSkuUpdates,
    lookupProductBySku: lookupProductBySku,
    searchWebProducts: searchWebProducts,
    searchProductsForReplacement: searchProductsForReplacement,
    searchAllProducts: searchAllProducts
  };
})();