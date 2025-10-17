/**
 * @file ProductService.js
 * @description Service for handling product-related business logic, including staging and validation.
 */

const ProductService = (function() {

  // =================================================================================
  // PRIVATE HELPER METHODS
  // =================================================================================

  function _populateStagingSheet(productsOrData, sheetName) {
    LoggerService.info('ProductService', '_populateStagingSheet', `Attempting to populate sheet: ${sheetName} with ${productsOrData.length} items.`);
    
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
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

  function _updateJobStatus(rowNumber, status, message = '') {
    const logSheetConfig = ConfigService.getConfig('system.spreadsheet.logs');
    const sheetNames = ConfigService.getConfig('system.sheet_names');
    const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
    
    const logSpreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
    
    const statusCol = jobQueueHeaders.indexOf('status') + 1;
    const messageCol = jobQueueHeaders.indexOf('error_message') + 1;
    const timestampCol = jobQueueHeaders.indexOf('processed_timestamp') + 1;

    if (rowNumber && statusCol > 0) jobQueueSheet.getRange(rowNumber, statusCol).setValue(status);
    if (rowNumber && messageCol > 0) jobQueueSheet.getRange(rowNumber, messageCol).setValue(message);
    if (rowNumber && timestampCol > 0) jobQueueSheet.getRange(rowNumber, timestampCol).setValue(new Date());
  }

  function _getSheetDataAsMap(sheetName, headers) {
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = dataSpreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      // This is a critical error if the sheet is expected to exist
      throw new Error(`Sheet '${sheetName}' not found in spreadsheet ID: ${dataSpreadsheet.getId()}. This is a critical configuration error.`);
    }
    // If the sheet is WebXltM and it's empty, this is also a critical error
    if (sheetName === 'WebXltM' && sheet.getLastRow() < 2) {
      throw new Error(`Sheet 'WebXltM' is empty (only headers or less). This is a critical data integrity error as WebXltM is expected to be populated.`);
    }
    // For other sheets, or if WebXltM is not empty, proceed as before
    if (sheet.getLastRow() < 2) {
      LoggerService.warn('ProductService', '_getSheetDataAsMap', `Sheet '${sheetName}' is empty (only headers or less).`);
      return { map: new Map(), headers: headers, values: [] };
    }
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    
    const dataMap = new Map();
    // This key detection is still used by other functions, so we leave it for now.
    const keyHeader = headers.find(h => h.endsWith('_ID') || h.includes('_Id') || h.endsWith('_SKU'));
    
    const keyIndex = headers.indexOf(keyHeader);
    if (keyIndex === -1) throw new Error(`Could not determine a key column for sheet ${sheetName}`);

    values.forEach(row => {
      const rowObject = {};
      headers.forEach((h, i) => rowObject[h] = row[i]);
      const key = row[keyIndex];
      if (key && String(key).trim()) {
        dataMap.set(String(key).trim(), rowObject);
      }
    });
    LoggerService.info('ProductService', '_getSheetDataAsMap', `Loaded ${dataMap.size} rows from ${sheetName}.`);
    return { map: dataMap, headers: headers, values: values };
  }

  function _formatString(template, dataRow) {
    if (!template) return '';
    return template.replace(/\${(.*?)}/g, (match, key) => {
      return dataRow[key.trim()] || '';
    });
  }

  function _createTaskFromFailure(rule, dataRow, joinKey) {
    const title = _formatString(rule.on_failure_title, dataRow);
    const notes = _formatString(rule.on_failure_notes, dataRow);
    const skuKey = Object.keys(dataRow).find(k => k.endsWith('_SKU'));
    const entityId = skuKey ? dataRow[skuKey] : (joinKey || dataRow[rule.source_key] || dataRow[rule.key_A] || 'N/A');

    LoggerService.info('ProductService', '_createTaskFromFailure', `Attempting to create task for rule: ${rule.on_failure_task_type} with entity ID: ${entityId}`);
    TaskService.createTask(rule.on_failure_task_type, entityId, title, notes);
  }

  function _evaluateCondition(val1, operator, val2) {
      switch(operator) {
          case '<': return Number(val1) < Number(val2);
          case '>': return Number(val1) > Number(val2);
          case '=': return String(val1) === val2;
          case '<>': return String(val1) !== val2;
          default: return false;
      }
  }

  // =================================================================================
  // VALIDATION ENGINE SUB-FUNCTIONS
  // =================================================================================

  function _buildMapFromData(data, headers, keyHeader) {
    const map = new Map();
    const keyIndex = headers.indexOf(keyHeader);
    if (keyIndex === -1) {
        throw new Error(`Key header '${keyHeader}' not found in headers: ${headers.join(', ')}`);
    }
    data.forEach(row => {
        const rowObject = {};
        headers.forEach((h, i) => rowObject[h] = row[i]);
        const key = row[keyIndex];
        if (key && String(key).trim()) {
            map.set(String(key).trim(), rowObject);
        }
    });
    return map;
  }

  function _executeExistenceCheck(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeExistenceCheck', `Executing rule: ${rule.on_failure_title}`);

    // Build maps using the keys specified in the rule
    const sourceData = dataMaps[rule.source_sheet];
    const targetData = dataMaps[rule.target_sheet];

    const sourceMap = _buildMapFromData(sourceData.values, sourceData.headers, rule.source_key);
    const targetMap = _buildMapFromData(targetData.values, targetData.headers, rule.target_key);

    for (const [key, sourceRow] of sourceMap.entries()) {
      const existsInTarget = targetMap.has(key);
      LoggerService.info('ProductService', '_executeExistenceCheck', `Checking key: ${key}, Exists in target: ${existsInTarget}`);
      // Robust check for boolean true or string 'TRUE'
      const shouldInvert = String(rule.invert_result).toUpperCase() === 'TRUE';

      const shouldFail = shouldInvert ? !existsInTarget : existsInTarget;

      if (shouldFail) {
        let passesFilter = true;
        if (rule.source_filter) {
            const [filterKey, filterValue] = rule.source_filter.split(',');
            if (sourceRow[filterKey] !== filterValue) {
                passesFilter = false;
            }
        }
        if (passesFilter) {
            _createTaskFromFailure(rule, sourceRow);
        }
      }
    }
  }
  
  function _executeFieldComparison(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeFieldComparison', `Executing rule: ${rule.on_failure_title}`);

    const dataA = dataMaps[rule.sheet_A];
    const dataB = dataMaps[rule.sheet_B];

    // Build maps using the keys specified in the rule
    const mapA = _buildMapFromData(dataA.values, dataA.headers, rule.key_A);
    const mapB = _buildMapFromData(dataB.values, dataB.headers, rule.key_B);

    const [fieldA, fieldB] = rule.compare_fields.split(',');

    if (!fieldA || !fieldB) {
        throw new Error(`Invalid 'compare_fields' for rule: ${rule.on_failure_title}`);
    }

    for (const [key, rowB] of mapB.entries()) {
        if (mapA.has(key)) {
            const rowA = mapA.get(key);

            const valueA = String(rowA[fieldA] || '').trim();
            const valueB = String(rowB[fieldB] || '').trim();

            if (valueA !== valueB) {
                const mergedRow = { ...rowA, ...rowB };
                _createTaskFromFailure(rule, mergedRow, key);
            }
        }
    }
  }

  function _executeInternalAudit(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeInternalAudit', `Executing rule: ${rule.on_failure_title}`);
    const sourceMap = dataMaps[rule.source_sheet].map;
    const conditionParts = rule.condition.split(',');
    const [field, operator, value, logic, field2, op2, val2] = conditionParts;

    for (const [key, row] of sourceMap.entries()) {
        let conditionMet = _evaluateCondition(row[field], operator, value);

        if (conditionMet && logic === 'AND') {
            conditionMet = _evaluateCondition(row[field2], op2, val2);
        }

        if (conditionMet) {
            _createTaskFromFailure(rule, row);
        }
    }
  }

  function _executeCrossConditionCheck(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeCrossConditionCheck', `Executing rule: ${rule.on_failure_title}`);
    const mapA = dataMaps[rule.sheet_A].map;
    const mapB = dataMaps[rule.sheet_B].map;
    const [condFieldA, condValueA] = rule.condition_A.split(',');
    const [condFieldB, condOpB, condValueB] = rule.condition_B.split(',');

    for (const [key, rowA] of mapA.entries()) {
      if (rowA[condFieldA] === condValueA && mapB.has(key)) {
        const rowB = mapB.get(key);
        if (_evaluateCondition(rowB[condFieldB], condOpB, condValueB)) {
          _createTaskFromFailure(rule, { ...rowA, ...rowB });
        }
      }
    }
  }

  function _executeCrossExistenceCheck(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeCrossExistenceCheck', `Executing rule: ${rule.on_failure_title}`);
    const sourceMap = dataMaps[rule.source_sheet].map;
    const targetMap = dataMaps[rule.target_sheet].map;
    const joinMap = dataMaps[rule.join_against].map;
    const [condField, condValue] = rule.source_condition.split(',');

    for (const [key, row] of sourceMap.entries()) {
      if (row[condField] === condValue) {
        const existsInJoin = joinMap.has(key);
        const existsInTarget = targetMap.has(key);

        const joinCheck = rule.join_invert === 'TRUE' ? !existsInJoin : existsInJoin;
        const targetCheck = rule.invert_result === 'TRUE' ? !existsInTarget : existsInTarget;

        if (joinCheck && targetCheck) {
          _createTaskFromFailure(rule, row);
        }
      }
    }
  }

  function _executeSchemaComparison(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeSchemaComparison', `Executing rule: ${rule.on_failure_title}`);
    const allConfig = ConfigService.getAllConfig();

    const sourceSchemaHeaders = allConfig[rule.source_schema].headers.split(',');
    const targetSchemaHeaders = allConfig[rule.target_schema].headers.split(',');

    // Extract base names (e.g., 'wpm_SKU' -> 'SKU') to compare schemas correctly
    const sourceBaseHeaders = sourceSchemaHeaders.map(h => h.substring(h.indexOf('_') + 1));
    const targetBaseHeaders = targetSchemaHeaders.map(h => h.substring(h.indexOf('_') + 1));

    const missingColumns = sourceBaseHeaders.filter(baseHeader => !targetBaseHeaders.includes(baseHeader));

    if (missingColumns.length > 0) {
      const errorMessage = `CRITICAL: Schema Mismatch Detected in rule '${rule.on_failure_title}'. Missing columns in target: ${missingColumns.join(', ')}`;
      LoggerService.error('ProductService', '_executeSchemaComparison', errorMessage);
      throw new Error(errorMessage);
    }
  }

  function _executeRowCountComparison(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeRowCountComparison', `Executing rule: ${rule.on_failure_title}`);

    const sourceSheetData = dataMaps[rule.source_sheet];
    const targetSheetData = dataMaps[rule.target_sheet];

    // Assuming first row is headers, so data rows are length - 1
    const sourceRowCount = sourceSheetData.values.length;
    const targetRowCount = targetSheetData.values.length;

    if (targetRowCount < sourceRowCount) {
      _createTaskFromFailure(rule, { sourceRowCount: sourceRowCount, targetRowCount: targetRowCount });
    }
  }

  function _executeDataCompleteness(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeDataCompleteness', `Executing rule: ${rule.on_failure_title}`);

    const sourceSheetData = dataMaps[rule.source_sheet];
    const sourceSheetHeaders = sourceSheetData.headers;
    const sourceSheetValues = sourceSheetData.values;

    // Iterate through data (excluding headers)
    for (let i = 0; i < sourceSheetValues.length; i++) { 
      const row = sourceSheetValues[i];
      for (let j = 0; j < row.length; j++) {
        // Check if the column has a header (i.e., it's a populated column)
        // and if the cell is empty (null or empty string)
        if (sourceSheetHeaders[j] && (row[j] === null || String(row[j]).trim() === '')) {
          _createTaskFromFailure(rule, { rowNum: i + 2, colName: sourceSheetHeaders[j], cellValue: row[j] });
        }
      }
    }
  }

  function _runValidationEngine() {
    const allConfig = ConfigService.getAllConfig();
    const validationRules = Object.keys(allConfig).filter(k => k.startsWith('validation.rule.') && !k.startsWith('validation.rule.WebXlt_')); // Exclude WebXlt rules
    LoggerService.info('ProductService', '_runValidationEngine', `Found ${validationRules.length} general validation rules.`);

    if (validationRules.length === 0) return;

    const requiredSheets = new Set();
    validationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if (String(rule.enabled).toUpperCase() !== 'TRUE') return;
      if(rule.source_sheet) requiredSheets.add(rule.source_sheet);
      if(rule.target_sheet) requiredSheets.add(rule.target_sheet);
      if(rule.sheet_A) requiredSheets.add(rule.sheet_A);
      if(rule.sheet_B) requiredSheets.add(rule.sheet_B);
      if(rule.join_against) requiredSheets.add(rule.join_against);
    });
    LoggerService.info('ProductService', '_runValidationEngine', `General validation requires sheets: ${Array.from(requiredSheets).join(', ')}`);

    const dataMaps = {};
    requiredSheets.forEach(sheetName => {
      const schema = allConfig[`schema.data.${sheetName}`];
      if (!schema) {
        LoggerService.warn('ProductService', '_runValidationEngine', `Schema not found for required sheet: ${sheetName}. Skipping load.`);
        return;
      };
      const headers = schema.headers.split(',');
      dataMaps[sheetName] = _getSheetDataAsMap(sheetName, headers);
    });

    validationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if (String(rule.enabled).toUpperCase() !== 'TRUE') return;

      try {
        switch (rule.test_type) {
          case 'EXISTENCE_CHECK':
            _executeExistenceCheck(rule, dataMaps);
            break;
          case 'FIELD_COMPARISON':
            _executeFieldComparison(rule, dataMaps);
            break;
          case 'INTERNAL_AUDIT':
            _executeInternalAudit(rule, dataMaps);
            break;
          case 'CROSS_CONDITION_CHECK':
            _executeCrossConditionCheck(rule, dataMaps);
            break;
          case 'CROSS_EXISTENCE_CHECK':
            _executeCrossExistenceCheck(rule, dataMaps);
            break;
          default:
            LoggerService.warn('ProductService', '_runValidationEngine', `Unknown test_type: '${rule.test_type}' for rule ${ruleKey}`);
        }
      } catch (e) {
        LoggerService.error('ProductService', '_runValidationEngine', `Error executing rule ${ruleKey}: ${e.message}`, e);
      }
    });
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

        _populateStagingSheet(translationObjects, 'WebXltS');
        LoggerService.info('ProductService', '_runWebXltValidationAndUpsert', 'Successfully populated WebXltS staging sheet.');

    } catch (e) {
        LoggerService.error('ProductService', '_runWebXltValidationAndUpsert', `Failed to populate staging sheet: ${e.message}`, e);
        _updateJobStatus(jobRowNumber, 'FAILED', `Staging population failed: ${e.message}`);
        return 'FAILED';
    }

    // --- 2. Run Validation and Upsert (existing logic) ---
    const allConfig = ConfigService.getAllConfig();
    const webXltValidationRules = Object.keys(allConfig).filter(k => k.startsWith('validation.rule.WebXlt_'));

    if (webXltValidationRules.length === 0) {
        LoggerService.warn('ProductService', '_runWebXltValidationAndUpsert', 'No WebXlt validation rules found. Skipping.');
        return;
    }

    const requiredSheets = new Set();
    webXltValidationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if (String(rule.enabled).toUpperCase() !== 'TRUE') return;
      if(rule.source_sheet) requiredSheets.add(rule.source_sheet);
      if(rule.target_sheet) requiredSheets.add(rule.target_sheet);
      if(rule.source_schema) requiredSheets.add(rule.source_schema.replace('schema.data.', '')); // Extract sheet name from schema key
      if(rule.target_schema) requiredSheets.add(rule.target_schema.replace('schema.data.', '')); // Extract sheet name from schema key
    });
    LoggerService.info('ProductService', '_runWebXltValidationAndUpsert', `WebXlt validation requires sheets: ${Array.from(requiredSheets).join(', ')}`);

    const dataMaps = {};
    requiredSheets.forEach(sheetName => {
      const schema = allConfig[`schema.data.${sheetName}`];
      if (!schema) {
        LoggerService.warn('ProductService', '_runWebXltValidationAndUpsert', `Schema not found for required sheet: ${sheetName}. Skipping load.`);
        return;
      };
      const headers = schema.headers.split(',');
      dataMaps[sheetName] = _getSheetDataAsMap(sheetName, headers);
    });

    let webXltValidationFailed = false;
    webXltValidationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if (String(rule.enabled).toUpperCase() !== 'TRUE') return;

      try {
        switch (rule.test_type) {
          case 'SCHEMA_COMPARISON':
            _executeSchemaComparison(rule, dataMaps);
            break;
          case 'ROW_COUNT_COMPARISON':
            _executeRowCountComparison(rule, dataMaps);
            break;
          case 'DATA_COMPLETENESS':
            _executeDataCompleteness(rule, dataMaps);
            break;
          default:
            LoggerService.warn('ProductService', '_runWebXltValidationAndUpsert', `Unknown test_type: '${rule.test_type}' for rule ${ruleKey}`);
        }
      } catch (e) {
        LoggerService.error('ProductService', '_runWebXltValidationAndUpsert', `Error executing rule ${ruleKey}: ${e.message}`, e);
        webXltValidationFailed = true;
      }
    });

    // After all WebXlt validations, check for specific tasks and update status
    let webXltValidationStatus = 'COMPLETED';
    if (webXltValidationFailed) {
        webXltValidationStatus = 'QUARANTINED';
        LoggerService.warn('ProductService', '_runWebXltValidationAndUpsert', `WebXlt data is QUARANTINED due to validation failures.`);
    } else {
        LoggerService.info('ProductService', '_runWebXltValidationAndUpsert', 'WebXlt data passed all validations.');
    }


    if (!webXltValidationFailed) {
        _upsertWebXltData();
    } else {
        LoggerService.warn('ProductService', '_runWebXltValidationAndUpsert', 'Skipping WebXltS to WebXltM upsert due to validation failures.');
    }
    return webXltValidationStatus;
  }

  function _upsertWebXltData() {
    LoggerService.info('ProductService', '_upsertWebXltData', 'Starting WebXltS to WebXltM full replacement process.');

    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
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

  function processJob(jobType, jobRowNumber) {
    LoggerService.info('ProductService', 'processJob', `Starting job: ${jobType} (Row: ${jobRowNumber})`);
    _updateJobStatus(jobRowNumber, 'PROCESSING');

    try {
      let finalJobStatus = 'COMPLETED'; // Default to COMPLETED
      switch (jobType) {
        case 'import.drive.comax_products':
          // TODO: Implement Comax product staging and validation
          LoggerService.info('ProductService', 'processJob', `Job type '${jobType}' received, placeholder implemented.`);
          break;
        case 'import.drive.web_products_en':
          // TODO: Implement Web (EN) product staging and validation
          LoggerService.info('ProductService', 'processJob', `Job type '${jobType}' received, placeholder implemented.`);
          break;
        case 'WEB_XLT_IMPORT':
        case 'import.drive.web_translations_he':
          finalJobStatus = _runWebXltValidationAndUpsert(jobRowNumber); // Capture the returned status
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
      _updateJobStatus(jobRowNumber, finalJobStatus);
      LoggerService.info('ProductService', 'processJob', `Job ${jobType} completed with status: ${finalJobStatus}.`);
    } catch (e) {
      LoggerService.error('ProductService', 'processJob', `Job ${jobType} failed: ${e.message}`, e);
      _updateJobStatus(jobRowNumber, 'FAILED', e.message);
      throw e; // Re-throw the error after logging and updating status
    }
  }

  return {
    processJob: processJob,
    runValidationEngine: _runValidationEngine,
    runWebXltValidationAndUpsert: _runWebXltValidationAndUpsert
  };
})();