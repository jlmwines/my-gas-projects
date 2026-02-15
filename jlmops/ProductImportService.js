/**
 * @file ProductImportService.js
 * @description Service for handling product import/export job processing.
 *
 * Extracted from ProductService.js as part of Phase 13 codebase health initiative.
 * Handles: Comax imports, Web product imports, Translation imports, Inventory exports.
 */

const ProductImportService = (function() {

  /**
   * Helper to update job status in SysJobQueue.
   * @param {object} executionContext The execution context.
   * @param {string} status The new status ('COMPLETED', 'FAILED', 'QUARANTINED').
   * @param {string} [errorMessage=''] Optional error message.
   */
  function _updateJobStatus(executionContext, status, errorMessage = '') {
    const serviceName = 'ProductImportService';
    const functionName = '_updateJobStatus';
    const { jobQueueSheetRowNumber, jobQueueHeaders, jobId, jobType, sessionId } = executionContext;

    try {
      const allConfig = ConfigService.getAllConfig();
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
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

  /**
   * Builds a detailed quarantine error message from validation results.
   * @param {object} validationResult The result from ValidationLogic.runValidationSuite.
   * @returns {string} Human-readable error message describing what failed.
   */
  function _buildQuarantineErrorMessage(validationResult) {
    const failures = validationResult.results.filter(r => r.status === 'FAILED');
    if (failures.length === 0) {
      return 'Validation failed - data quarantined.';
    }

    const details = failures.map(f => {
      const ruleName = f.rule.on_failure_title || f.rule.id || 'Unknown rule';
      const count = f.discrepancies ? f.discrepancies.length : 0;
      // Include first few discrepancy keys for context
      let sample = '';
      if (f.discrepancies && f.discrepancies.length > 0) {
        const keys = f.discrepancies.slice(0, 3).map(d => d.key || d.sourceRowCount || d.targetRowCount || 'N/A');
        sample = ` (${keys.join(', ')}${f.discrepancies.length > 3 ? '...' : ''})`;
      }
      return `${ruleName}: ${count} issue${count !== 1 ? 's' : ''}${sample}`;
    });

    return `QUARANTINED: ${details.join('; ')}`;
  }

  // =================================================================================
  // STAGING HELPERS
  // =================================================================================

  /**
   * Applies standard formatting to a data sheet: top-align cells and set row height for single line.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to format.
   * @param {number} dataRowCount - Number of data rows (excluding header).
   */
  function _applySheetFormatting(sheet, dataRowCount) {
    if (dataRowCount <= 0) return;

    // Set vertical alignment to top for all data rows
    const dataRange = sheet.getRange(2, 1, dataRowCount, sheet.getLastColumn());
    dataRange.setVerticalAlignment('top');
    dataRange.setWrap(false);  // Disable wrap to enforce single-row height

    // Set row height for single line of text (24 pixels)
    sheet.setRowHeights(2, dataRowCount, 24);
  }

  /**
   * Gets the name column for sorting based on sheet name.
   * @param {string} sheetName - The sheet name.
   * @param {string[]} headers - The schema headers.
   * @returns {number} The column index for sorting, or -1 if not applicable.
   */
  function _getNameColumnIndex(sheetName, headers) {
    const nameColumnMap = {
      'CmxProdS': 'cps_NameHe',
      'CmxProdM': 'cpm_NameHe',
      'WebProdS_EN': 'wps_PostTitle',
      'WebProdM': 'wpm_PostTitle'
    };
    const nameCol = nameColumnMap[sheetName];
    return nameCol ? headers.indexOf(nameCol) : -1;
  }

  function _populateStagingSheet(productsOrData, sheetName, sessionId) {
    const serviceName = 'ProductImportService';
    const functionName = '_populateStagingSheet';
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SheetAccessor.getDataSpreadsheet();
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

        // Sort by product name if applicable
        const nameIdx = _getNameColumnIndex(sheetName, schemaHeaders);
        if (nameIdx > -1 && finalData.length > 0) {
            const locale = sheetName.includes('Cmx') ? 'he' : 'en';
            finalData.sort((a, b) => {
                const nameA = String(a[nameIdx] || '').toLowerCase();
                const nameB = String(b[nameIdx] || '').toLowerCase();
                return nameA.localeCompare(nameB, locale);
            });
            logger.info(serviceName, functionName, `Sorted ${sheetName} data by product name.`, { sessionId: sessionId });
        }

        // Clear previous content and write new data
        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
        }
        if (finalData.length > 0 && finalData[0].length > 0) {
            sheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
            // Apply standard formatting: top-align and single row height
            _applySheetFormatting(sheet, finalData.length);
        }
        SpreadsheetApp.flush(); // Ensure data is written before any subsequent reads (e.g., validation)
        logger.info(serviceName, functionName, `Staging sheet '${sheetName}' has been updated with ${finalData.length} rows.`, { sessionId: sessionId });
    }
  }

  function _runStagingValidation(suiteName, sessionId) {
    const serviceName = 'ProductImportService';
    const functionName = '_runStagingValidation';
    logger.info(serviceName, functionName, `Starting validation for suite: ${suiteName}`, { sessionId: sessionId });

    const result = ValidationOrchestratorService.runValidationSuite(suiteName, sessionId);
    const quarantineTriggered = result.quarantineTriggered;

    if (quarantineTriggered) {
        logger.warn(serviceName, functionName, `Validation suite '${suiteName}' triggered a quarantine.`, { sessionId: sessionId });
    }
    return !quarantineTriggered;
  }

  // =================================================================================
  // WEB TRANSLATION (WebXlt) IMPORT
  // =================================================================================

  function _runWebXltValidationAndUpsert(executionContext) {
    const serviceName = 'ProductImportService';
    const functionName = '_runWebXltValidationAndUpsert';
    const { jobQueueSheetRowNumber, sessionId } = executionContext;

    LoggerService.info(serviceName, functionName, `Starting WebXlt specific validation and upsert process for job row: ${jobQueueSheetRowNumber}.`, { sessionId: sessionId });

    // --- 1. Populate Staging Sheet ---
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobQueueSheetRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobQueueSheetRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const fileName = file.getName();
        const fileMimeType = file.getMimeType();
        const fileEncoding = ConfigService.getConfig('import.drive.web_translations_he').file_encoding || 'UTF-8';
        const csvContent = file.getBlob().getDataAsString(fileEncoding);

        logger.info(serviceName, functionName, `Processing file: ${fileName}, MIME: ${fileMimeType}, size: ${csvContent.length} chars, first 200: ${csvContent.substring(0, 200)}`, { sessionId, archiveFileId });

        const translationObjects = WebAdapter.processTranslationCsv(csvContent, 'map.webtoffee.hebrew_headers');
        logger.info(serviceName, functionName, `Parsed ${translationObjects.length} translation objects from CSV`, { sessionId });

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
        const errorMsg = _buildQuarantineErrorMessage(validationResult);
        logger.error(serviceName, functionName, 'CRITICAL: Quarantine triggered - MASTER UPDATE BLOCKED', null, { sessionId: sessionId, validationFailures: validationResult.results.filter(r => r.status === 'FAILED') });
        _updateJobStatus(executionContext, 'QUARANTINED', errorMsg);
        return 'QUARANTINED';
    }

    // --- 3. Upsert (existing logic) - Only reached if validation passed
    _upsertWebXltData(sessionId);
    return 'COMPLETED';
  }

  function _upsertWebXltData(sessionId) {
    const serviceName = 'ProductImportService';
    const functionName = '_upsertWebXltData';
    logger.info(serviceName, functionName, 'Starting WebXltS to WebXltM full replacement process.', { sessionId: sessionId });

    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
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
        _applySheetFormatting(webXltMSheet, numDataRows);
        logger.info(serviceName, functionName, `Wrote ${numDataRows} data rows with wxl_ headers to WebXltM.`, { sessionId: sessionId });
    } else {
        logger.info(serviceName, functionName, 'WebXltS had no data rows. Only headers written to WebXltM.', { sessionId: sessionId });
    }

    SpreadsheetApp.flush(); // Ensure all pending changes are applied
    logger.info(serviceName, functionName, `Upsert complete. Final row count in WebXltM: ${webXltMSheet.getLastRow()}`, { sessionId: sessionId });
  }

  // =================================================================================
  // COMAX IMPORT
  // =================================================================================

  function _runComaxImport(executionContext) {
    const serviceName = 'ProductImportService';
    const functionName = '_runComaxImport';
    const { jobQueueSheetRowNumber, sessionId } = executionContext;
    logger.info(serviceName, functionName, `Starting Comax import process for job row: ${jobQueueSheetRowNumber}.`, { sessionId: sessionId });
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
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
            const errorMsg = _buildQuarantineErrorMessage(validationResult);
            logger.error(serviceName, functionName, 'CRITICAL: Quarantine triggered - MASTER UPDATE BLOCKED', null, { sessionId: sessionId, validationFailures: validationResult.results.filter(r => r.status === 'FAILED') });
            _updateJobStatus(executionContext, 'QUARANTINED', errorMsg);
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
        _updateJobStatus(executionContext, 'FAILED', `Comax import failed: ${e.message}`);
        return 'FAILED';
    }
  }

  function _upsertComaxData(comaxProducts, sessionId) {
    const serviceName = 'ProductImportService';
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

    // Track mapping errors and missing fields
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
                     // Log for first few products to avoid spam
                     if (idx < 5) {
                         logger.warn(serviceName, functionName, `Product ${key}: Field ${stagingHeader} not in staging, preserving existing master value.`, { sessionId });
                     }
                } else {
                    // Track as missing instead of silent default
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

            // Validate critical fields are NOT empty after mapping
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

    // Fail if critical data missing
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

        const sampleSize = Math.min(20, finalData.length);
        let validRowsFound = 0;
        const sanityIssues = [];

        for (let i = 0; i < sampleSize; i++) {
            const row = finalData[i];
            // CRITICAL: Treat 0 as valid for stock/price
            const hasStock = stockIdx > -1 && row[stockIdx] !== '' && row[stockIdx] !== null && row[stockIdx] !== undefined;
            const hasPrice = priceIdx > -1 && row[priceIdx] !== '' && row[priceIdx] !== null && row[priceIdx] !== undefined;
            const hasName = nameIdx > -1 && row[nameIdx] !== '' && row[nameIdx] !== null && row[nameIdx] !== undefined;
            const hasSKU = skuIdx > -1 && row[skuIdx] !== '' && row[skuIdx] !== null && row[skuIdx] !== undefined;

            // Require Name AND SKU (Stock/Price can be 0 legitimately)
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

        // Require at least 80% of sampled rows to be valid
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
    const sortNameIdx = masterHeaders.indexOf('cpm_NameHe');
    if (sortNameIdx > -1 && finalData.length > 0) {
        finalData.sort((a, b) => {
            const nameA = String(a[sortNameIdx] || '').toLowerCase();
            const nameB = String(b[sortNameIdx] || '').toLowerCase();
            return nameA.localeCompare(nameB, 'he'); // Hebrew locale for proper sorting
        });
        logger.info(serviceName, functionName, 'Sorted CmxProdM data by product name (cpm_NameHe).', { sessionId });
    }

    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SheetAccessor.getDataSpreadsheet();
    const masterSheet = dataSpreadsheet.getSheetByName('CmxProdM');

    // More robustly clear the sheet and rewrite headers + data
    masterSheet.clear();
    masterSheet.getRange(1, 1, 1, masterHeaders.length).setValues([masterHeaders]).setFontWeight('bold');

    if (finalData.length > 0) {
        masterSheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
        // Apply standard formatting: top-align and single row height
        _applySheetFormatting(masterSheet, finalData.length);
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
    const serviceName = 'ProductImportService';
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
    const dataSpreadsheet = SheetAccessor.getDataSpreadsheet();
    const sysProductAuditSheet = dataSpreadsheet.getSheetByName('SysProductAudit');

    sysProductAuditSheet.clear();
    sysProductAuditSheet.getRange(1, 1, 1, sysProductAuditHeaders.length).setValues([sysProductAuditHeaders]).setFontWeight('bold');

    if (finalAuditData.length > 0) {
        sysProductAuditSheet.getRange(2, 1, finalAuditData.length, finalAuditData[0].length).setValues(finalAuditData);
    }

    logger.info(serviceName, functionName, `SysProductAudit synchronized. New: ${newCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}. Total rows: ${finalAuditData.length}.`, { sessionId: sessionId });
  }

  // =================================================================================
  // WEB PRODUCTS IMPORT
  // =================================================================================

  /**
   * Custom CSV parser that handles multi-line quoted fields properly.
   * Returns array of arrays (rows of fields).
   * @param {string} csvContent - Raw CSV content
   * @returns {Array<Array<string>>} - Parsed rows
   */
  function _parseWebToffeeCsv(csvContent) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvContent.length) {
      const char = csvContent[i];
      const nextChar = csvContent[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote - add single quote and skip next
            field += '"';
            i += 2;
            continue;
          } else {
            // End of quoted field
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          field += char;
          i++;
          continue;
        }
      } else {
        // Not in quotes
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
          i++;
          continue;
        } else if (char === ',') {
          // End of field
          row.push(field);
          field = '';
          i++;
          continue;
        } else if (char === '\r') {
          // Handle \r\n or standalone \r
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
          if (nextChar === '\n') {
            i += 2;
          } else {
            i++;
          }
          continue;
        } else if (char === '\n') {
          // End of row
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
          i++;
          continue;
        } else {
          field += char;
          i++;
          continue;
        }
      }
    }

    // Handle last field/row
    if (field || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  /**
   * Processes WebToffee CSV content into product objects.
   * Transforms WebToffee headers to internal wps_* format and converts values.
   * Uses custom CSV parser to handle multi-line HTML content fields.
   * @param {string} csvContent - Raw CSV content from WebToffee export
   * @returns {Array<Object>} - Array of product objects with wps_* field names
   */
  function _processWebToffeeProductCsv(csvContent) {
    const serviceName = 'ProductImportService';
    const functionName = '_processWebToffeeProductCsv';
    logger.info(serviceName, functionName, 'Processing WebToffee product CSV...');

    // Get WebToffee mappings from config
    const headerMap = ConfigService.getConfig('map.webtoffee.product_headers');
    const valueTransforms = ConfigService.getConfig('map.webtoffee.product_values');

    if (!headerMap) {
      throw new Error("WebToffee header mapping 'map.webtoffee.product_headers' not found in configuration.");
    }

    // Parse value transforms: "publish=1,draft=0" → { "publish": "1", "draft": "0" }
    const valueMapByColumn = {};
    if (valueTransforms) {
      Object.keys(valueTransforms).forEach(columnName => {
        const transformSpec = valueTransforms[columnName]; // e.g., "publish=1,draft=0"
        const mapping = {};
        transformSpec.split(',').forEach(pair => {
          const [oldVal, newVal] = pair.split('=');
          if (oldVal !== undefined && newVal !== undefined) {
            mapping[oldVal.trim()] = newVal.trim();
          }
        });
        valueMapByColumn[columnName] = mapping;
      });
    }

    // Use custom CSV parser that handles multi-line quoted fields
    logger.info(serviceName, functionName, `Parsing CSV content (${csvContent.length} chars)...`);
    const parsedData = _parseWebToffeeCsv(csvContent);

    if (parsedData.length < 2) {
      logger.warn(serviceName, functionName, 'File is empty or contains only a header.');
      return [];
    }

    logger.info(serviceName, functionName, `Parsed ${parsedData.length} rows from CSV.`);

    // Get CSV headers (first row)
    const csvHeaders = parsedData[0].map(h => String(h).trim());
    logger.info(serviceName, functionName, `Found ${csvHeaders.length} columns. First 5: ${csvHeaders.slice(0, 5).join(', ')}`);

    // Build column index map: csvHeaderIndex → internalFieldName
    const columnMapping = [];
    csvHeaders.forEach((csvHeader, idx) => {
      const internalField = headerMap[csvHeader];
      if (internalField) {
        columnMapping.push({ index: idx, field: internalField });
      }
    });

    logger.info(serviceName, functionName, `Mapped ${columnMapping.length} columns from WebToffee to internal format.`);

    // Process data rows
    const productObjects = [];
    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (!row || row.length === 0 || row.join('').trim() === '') continue; // Skip empty rows

      const product = {};
      columnMapping.forEach(({ index, field }) => {
        let value = row[index] || '';

        // Apply value transformation if configured for this field
        if (valueMapByColumn[field] && valueMapByColumn[field][value] !== undefined) {
          value = valueMapByColumn[field][value];
        }

        product[field] = value;
      });

      productObjects.push(product);
    }

    logger.info(serviceName, functionName, `Successfully processed ${productObjects.length} products from WebToffee format.`);
    return productObjects;
  }

  function _runWebProductsImport(executionContext) {
    const serviceName = 'ProductImportService';
    const functionName = '_runWebProductsImport';
    const { jobQueueSheetRowNumber, sessionId } = executionContext;
    logger.info(serviceName, functionName, `Starting Web Products (EN) import process for job row: ${jobQueueSheetRowNumber}.`, { sessionId: sessionId });
    try {
        const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
        const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const archiveFileIdCol = jobQueueHeaders.indexOf('archive_file_id') + 1;
        const archiveFileId = jobQueueSheet.getRange(jobQueueSheetRowNumber, archiveFileIdCol).getValue();

        if (!archiveFileId) {
            throw new Error(`Could not find archive_file_id for job row: ${jobQueueSheetRowNumber}`);
        }

        const file = DriveApp.getFileById(archiveFileId);
        const fileEncoding = ConfigService.getConfig('import.drive.web_products_en').file_encoding || 'UTF-8';
        const csvContent = file.getBlob().getDataAsString(fileEncoding);

        logger.info(serviceName, functionName, `CSV content length: ${csvContent.length}, first 200 chars: ${csvContent.substring(0, 200)}`, { sessionId });

        // Process WebToffee format directly (JLMops exclusive format)
        const productObjects = _processWebToffeeProductCsv(csvContent);

        _populateStagingSheet(productObjects, sheetNames.WebProdS_EN, sessionId);
        logger.info(serviceName, functionName, `Successfully populated WebProdS_EN staging sheet with ${productObjects.length} products.`, { sessionId });

        // --- 2. Run Staging Validation ---
        const validationResult = ValidationLogic.runValidationSuite('web_staging', sessionId);
        const { quarantineTriggered } = ValidationOrchestratorService.processValidationResults(validationResult, sessionId);

        if (quarantineTriggered) {
            const errorMsg = _buildQuarantineErrorMessage(validationResult);
            logger.error(serviceName, functionName, 'CRITICAL: Quarantine triggered - MASTER UPDATE BLOCKED', null, { sessionId: sessionId, validationFailures: validationResult.results.filter(r => r.status === 'FAILED') });
            _updateJobStatus(executionContext, 'QUARANTINED', errorMsg);
            return 'QUARANTINED';
        }

        // Only reached if validation passed - safe to update master
        _upsertWebProductsData(sessionId);

        return 'COMPLETED';

    } catch (e) {
        logger.error(serviceName, functionName, `Failed to import Web Products (EN) data: ${e.message}`, e, { sessionId: sessionId });
        _updateJobStatus(executionContext, 'FAILED', `Web Products (EN) import failed: ${e.message}`);
        return 'FAILED';
    }
  }

  function _upsertWebProductsData(sessionId) {
    const serviceName = 'ProductImportService';
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

    // Validate mapping configuration exists and is complete
    if (!stagingToMasterMap || Object.keys(stagingToMasterMap).length === 0) {
        throw new Error('Staging to master mapping configuration missing or empty!');
    }

    const criticalMappings = {
        'wps_Stock': 'wpm_Stock',
        'wps_RegularPrice': 'wpm_RegularPrice',
        'wps_SKU': 'wpm_SKU',
        'wps_PostTitle': 'wpm_PostTitle'
    };

    // Validate critical mappings are present
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
        const key = String(rawKey).trim();

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
                    // Track missing fields
                    missingFields.push(sKey);
                }
            }

            // Validate critical fields were updated
            const missedCritical = Object.keys(criticalMappings).filter(cf => missingFields.includes(cf));
            if (missedCritical.length > 0) {
                mappingErrors.push(
                    `Row ${idx + 2} (${key}): Missing critical staging fields: ${missedCritical.join(', ')}`
                );
            }

            masterMap.set(key, masterRow);
            updatedCount++;
        } else {
            skippedCount++;
        }
    });

    // Fail if critical fields missing
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

        const sampleSize = Math.min(20, finalData.length);
        let validRowsFound = 0;
        const sanityIssues = [];

        for (let i = 0; i < sampleSize; i++) {
            const row = finalData[i];
            // CRITICAL: Treat 0 as valid for stock/price
            const hasStock = stockIdx > -1 && row[stockIdx] !== '' && row[stockIdx] !== null && row[stockIdx] !== undefined;
            const hasPrice = priceIdx > -1 && row[priceIdx] !== '' && row[priceIdx] !== null && row[priceIdx] !== undefined;
            const hasSKU = skuIdx > -1 && row[skuIdx] !== '' && row[skuIdx] !== null && row[skuIdx] !== undefined;
            const hasName = nameIdx > -1 && row[nameIdx] !== '' && row[nameIdx] !== null && row[nameIdx] !== undefined;

            // Require Stock AND Price AND SKU AND Name
            if (hasStock && hasPrice && hasSKU && hasName) {
                validRowsFound++;
            } else {
                const missing = [];
                if (!hasSKU) missing.push('SKU');
                if (!hasName) missing.push('Name');
                if (!hasStock) missing.push('Stock');
                if (!hasPrice) missing.push('Price');
                sanityIssues.push(`Row ${i + 1}: Missing ${missing.join(', ')}`);
            }
        }

        // Require at least 80% of sampled rows to be valid
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
        _applySheetFormatting(masterSheet, finalData.length);
    }
    CacheService.getScriptCache().remove('skuToWebIdMap'); // Invalidate SKU map cache
    logger.info(serviceName, functionName, `Upsert to WebProdM complete. Total rows: ${finalData.length}. Cache invalidated.`, { sessionId: sessionId });

    // Bundle processing moved to manual trigger via Admin UI (Re-import from WooCommerce button)
    // to avoid slowing down product sync. Use WebAppBundles_reimportAllBundles() when needed.
  }

  /**
   * Processes bundle products from web staging data.
   * Detects woosb type products and imports their bundle structure.
   * @param {Object} stagingData - Staging data from ConfigService._getSheetDataAsMap
   * @param {Array<string>} stagingHeaders - Staging schema headers
   * @param {string} sessionId - Current session ID
   */
  function _processBundleProducts(stagingData, stagingHeaders, sessionId) {
    const serviceName = 'ProductImportService';
    const functionName = '_processBundleProducts';

    // Get column indices for relevant fields
    const typeIdx = stagingHeaders.indexOf('wps_TaxProductType');
    const woosbIdsIdx = stagingHeaders.indexOf('wps_WoosbIds');
    const idIdx = stagingHeaders.indexOf('wps_ID');
    const titleIdx = stagingHeaders.indexOf('wps_PostTitle');

    if (typeIdx === -1 || woosbIdsIdx === -1) {
      logger.info(serviceName, functionName, 'Bundle-related columns not found in staging schema. Skipping bundle processing.', { sessionId });
      return;
    }

    let bundlesProcessed = 0;
    let bundlesFailed = 0;

    stagingData.values.forEach(row => {
      const productType = String(row[typeIdx] || '').toLowerCase().trim();

      // Only process woosb (WPClever Smart Bundle) products
      if (productType === 'woosb' || productType === 'bundle') {
        const bundleId = String(row[idIdx] || '').trim();
        const woosbIds = String(row[woosbIdsIdx] || '').trim();
        const nameEn = String(row[titleIdx] || '').trim();

        if (!bundleId) {
          logger.warn(serviceName, functionName, `Bundle product missing ID. Skipping.`, { sessionId });
          bundlesFailed++;
          return;
        }

        if (!woosbIds) {
          logger.info(serviceName, functionName, `Bundle ${bundleId} (${nameEn}) has no woosb_ids data. Creating empty bundle.`, { sessionId });
        }

        try {
          // Determine bundle type from category or default
          const bundleType = productType === 'bundle' ? 'Bundle' : 'Bundle';

          BundleService.importBundleFromWooCommerce(bundleId, woosbIds, {
            nameEn: nameEn,
            nameHe: '', // Hebrew name populated separately from translation import
            type: bundleType
          });

          bundlesProcessed++;
          logger.info(serviceName, functionName, `Successfully imported bundle: ${bundleId} (${nameEn})`, { sessionId });
        } catch (e) {
          bundlesFailed++;
          logger.error(serviceName, functionName, `Failed to import bundle ${bundleId}: ${e.message}`, e, { sessionId });
        }
      }
    });

    if (bundlesProcessed > 0 || bundlesFailed > 0) {
      logger.info(serviceName, functionName, `Bundle processing complete. Imported: ${bundlesProcessed}, Failed: ${bundlesFailed}`, { sessionId });
    }
  }

  // =================================================================================
  // JOB DISPATCHER
  // =================================================================================

  function processJob(executionContext) {
    const serviceName = 'ProductImportService';
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
          exportWebInventory(sessionId);
          finalJobStatus = 'COMPLETED';
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
      // Update job status in the queue
      _updateJobStatus(executionContext, finalJobStatus);

      if (finalJobStatus === 'COMPLETED') {
        OrchestratorService.finalizeJobCompletion(jobQueueSheetRowNumber);
        LoggerService.info('ProductImportService', 'processJob', `Job ${jobType} completed successfully.`);
      } else {
        // Job returned FAILED or QUARANTINED - throw to stop processing
        LoggerService.error('ProductImportService', 'processJob', `Job ${jobType} returned status: ${finalJobStatus}`);
        throw new Error(`Job ${jobType} failed with status: ${finalJobStatus}`);
      }
    } catch (e) {
      logger.error(serviceName, functionName, `Job ${jobType} failed: ${e.message}`, e, { sessionId: sessionId, jobType: jobType });
      _updateJobStatus(executionContext, 'FAILED', e.message);

      throw e; // Re-throw the error after logging and updating status
    }
  }

  // =================================================================================
  // WEB INVENTORY EXPORT
  // =================================================================================

  function exportWebInventory(sessionId) {
    const functionName = 'exportWebInventory';
    LoggerService.info('ProductImportService', functionName, 'Starting WooCommerce inventory update export with change detection.', { sessionId: sessionId });

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
        const sku = String(webProdMRow.wpm_SKU || '').trim();

        if (!cmxMap.has(sku)) {
          productsSkipped++;
          LoggerService.warn('ProductImportService', functionName, `Skipping product ${sku} (${webProdMRow.wpm_PostTitle}): Not found in Comax master data.`);
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

      LoggerService.info('ProductImportService', functionName, `Checked ${productsChecked} products. Skipped ${productsSkipped} (not in Comax). Found ${exportProducts.length} products with changed stock or price.`);

      if (exportProducts.length === 0) {
        LoggerService.info('ProductImportService', functionName, 'No product changes detected. Export file will not be created.');
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
      LoggerService.info('ProductImportService', functionName, `WooCommerce inventory update file created: ${file.getName()} (ID: ${file.getId()})`);

      // Update Sync State with Filename
      if (sessionId) {
          const currentState = SyncStateService.getSyncState();
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
          LoggerService.info('ProductImportService', functionName, `Found and closing ${signalTasks.length} 'web_inventory_ready' signal task(s).`);
          signalTasks.forEach(task => {
            TaskService.completeTask(task.st_TaskId);
          });
        }
      } catch (e) {
        LoggerService.error('ProductImportService', functionName, `Could not close signal task: ${e.message}`, e);
      }

      const taskTitle = 'Confirm Web Inventory Export';
      const taskNotes = `Web inventory export file ${file.getName()} has been generated. Please confirm that the web inventory has been updated.`;
      TaskService.createTask('task.confirmation.web_inventory_export', file.getId(), file.getName(), taskTitle, taskNotes, sessionId);

      return { success: true, message: 'Web Inventory Export file created: ' + file.getName(), fileUrl: file.getUrl() };

    } catch (e) {
      LoggerService.error('ProductImportService', functionName, `Error generating WooCommerce inventory update export: ${e.message}`, e);
      throw e;
    }
  }

  // =================================================================================
  // PUBLIC API
  // =================================================================================

  return {
    processJob: processJob,
    runWebXltValidationAndUpsert: _runWebXltValidationAndUpsert,
    exportWebInventory: exportWebInventory
  };

})();

/**
 * Global wrapper function to execute the Web Inventory Export from the Apps Script editor or client-side.
 */
function run_exportWebInventory() {
  ProductImportService.exportWebInventory();
}
