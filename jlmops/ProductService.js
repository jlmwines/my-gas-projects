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

  function _getSheetDataAsMap(sheetName, headers, keyColumnName) {
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
    const keyHeader = keyColumnName || headers.find(h => h.endsWith('_ID') || h.includes('_Id') || h.endsWith('_SKU'));
    
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
    
    return String(rule.on_failure_quarantine).toUpperCase() === 'TRUE';
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

  function _executeExistenceCheck(rule, dataMaps, prebuiltMaps) {
    LoggerService.info('ProductService', '_executeExistenceCheck', `Executing rule: ${rule.on_failure_title}`);

    let quarantineTriggered = false;

    // Use pre-built maps for efficiency
    const sourceMapKey = `${rule.source_sheet}_by_${rule.source_key}`;
    const targetMapKey = `${rule.target_sheet}_by_${rule.target_key}`;

    const sourceMap = prebuiltMaps[sourceMapKey];
    const targetMap = prebuiltMaps[targetMapKey];

    if (!sourceMap || !targetMap) {
        throw new Error(`Could not find pre-built maps for rule: ${rule.on_failure_title}. Required keys: ${sourceMapKey}, ${targetMapKey}`);
    }

    for (const [key, sourceRow] of sourceMap.entries()) {
      const existsInTarget = targetMap.has(key);
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
            if (_createTaskFromFailure(rule, sourceRow)) {
                quarantineTriggered = true;
            }
        }
      }
    }
    return quarantineTriggered;
  }
  
  function _executeFieldComparison(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeFieldComparison', `Executing rule: ${rule.on_failure_title}`);

    let quarantineTriggered = false; // Flag to track if a quarantine task was created

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
                if (_createTaskFromFailure(rule, mergedRow, key)) {
                    quarantineTriggered = true;
                }
            }
        }
    }
    return quarantineTriggered;
  }

  function _executeInternalAudit(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeInternalAudit', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false; // Flag to track if a quarantine task was created
    const sourceMap = dataMaps[rule.source_sheet].map;
    const conditionParts = rule.condition.split(',');
    const [field, operator, value, logic, field2, op2, val2] = conditionParts;

    for (const [key, row] of sourceMap.entries()) {
        let conditionMet = _evaluateCondition(row[field], operator, value);

        if (conditionMet && logic === 'AND') {
            conditionMet = _evaluateCondition(row[field2], op2, val2);
        }

        if (conditionMet) {
            if (_createTaskFromFailure(rule, row)) {
                quarantineTriggered = true;
            }
        }
    }
    return quarantineTriggered;
  }

  function _executeCrossConditionCheck(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeCrossConditionCheck', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false; // Flag to track if a quarantine task was created
    const mapA = dataMaps[rule.sheet_A].map;
    const mapB = dataMaps[rule.sheet_B].map;
    const [condFieldA, condValueA] = rule.condition_A.split(',');
    const [condFieldB, condOpB, condValueB] = rule.condition_B.split(',');

    for (const [key, rowA] of mapA.entries()) {
      if (rowA[condFieldA] === condValueA && mapB.has(key)) {
        const rowB = mapB.get(key);
        if (_evaluateCondition(rowB[condFieldB], condOpB, condValueB)) {
          if (_createTaskFromFailure(rule, { ...rowA, ...rowB })) {
            quarantineTriggered = true;
          }
        }
      }
    }
    return quarantineTriggered;
  }

  function _executeCrossExistenceCheck(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeCrossExistenceCheck', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false; // Flag to track if a quarantine task was created
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
          if (_createTaskFromFailure(rule, row)) {
            quarantineTriggered = true;
          }
        }
      }
    }
    return quarantineTriggered;
  }

  function _executeSchemaComparison(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeSchemaComparison', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false; // Flag to track if a quarantine task was created
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
      // Schema mismatch is always critical, so it should always trigger quarantine if on_failure_quarantine is TRUE
      if (_createTaskFromFailure(rule, { missingColumns: missingColumns.join(', ') })) { // Pass relevant data for task
          quarantineTriggered = true;
      }
    }
    return quarantineTriggered;
  }

  function _executeRowCountComparison(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeRowCountComparison', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false; // Flag to track if a quarantine task was created

    const sourceSheetData = dataMaps[rule.source_sheet];
    const targetSheetData = dataMaps[rule.target_sheet];

    // Assuming first row is headers, so data rows are length - 1
    const sourceRowCount = sourceSheetData.values.length;
    const targetRowCount = targetSheetData.values.length;

    if (targetRowCount < sourceRowCount) {
      if (_createTaskFromFailure(rule, { sourceRowCount: sourceRowCount, targetRowCount: targetRowCount })) {
        quarantineTriggered = true;
      }
    }
    return quarantineTriggered;
  }

  function _executeDataCompleteness(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeDataCompleteness', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false; // Flag to track if a quarantine task was created

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
          if (_createTaskFromFailure(rule, { rowNum: i + 2, colName: sourceSheetHeaders[j], cellValue: row[j] })) {
            quarantineTriggered = true;
          }
        }
      }
    }
    return quarantineTriggered;
  }

  function _runMasterValidation() {
    LoggerService.info('ProductService', '_runMasterValidation', 'Starting master-master validation');
    const allConfig = ConfigService.getAllConfig();
    const validationRules = Object.keys(allConfig).filter(k => 
      k.startsWith('validation.rule.') && allConfig[k].validation_suite === 'master_master' && String(allConfig[k].enabled).toUpperCase() === 'TRUE'
    );
    LoggerService.info('ProductService', '_runMasterValidation', `Found ${validationRules.length} enabled master_master validation rules.`);

    if (validationRules.length === 0) return;

    // --- 1. Pre-computation Step ---
    const requiredSheets = new Set();
    const requiredMaps = new Map();

    validationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if(rule.source_sheet) requiredSheets.add(rule.source_sheet);
      if(rule.target_sheet) requiredSheets.add(rule.target_sheet);
      if(rule.sheet_A) requiredSheets.add(rule.sheet_A);
      if(rule.sheet_B) requiredSheets.add(rule.sheet_B);

      if (rule.test_type === 'EXISTENCE_CHECK') {
        requiredMaps.set(`${rule.source_sheet}_by_${rule.source_key}`, { sheet: rule.source_sheet, keyColumn: rule.source_key });
        requiredMaps.set(`${rule.target_sheet}_by_${rule.target_key}`, { sheet: rule.target_sheet, keyColumn: rule.target_key });
      }
    });

    const sheetDataCache = {};
    requiredSheets.forEach(sheetName => {
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema) {
            LoggerService.warn('ProductService', '_runMasterValidation', `Schema not found for required sheet: ${sheetName}. Skipping load.`);
            return;
        };
        const headers = schema.headers.split(',');
        sheetDataCache[sheetName] = _getSheetDataAsMap(sheetName, headers);
    });

    const prebuiltMaps = {};
    for (const [mapKey, { sheet, keyColumn }] of requiredMaps.entries()) {
        if (prebuiltMaps[mapKey]) continue;
        const data = sheetDataCache[sheet];
        if (data) {
            prebuiltMaps[mapKey] = _buildMapFromData(data.values, data.headers, keyColumn);
        }
    }
    LoggerService.info('ProductService', '_runMasterValidation', `Pre-built ${Object.keys(prebuiltMaps).length} maps for validation.`);

    // --- 2. Execution Step ---
    validationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      try {
        switch (rule.test_type) {
          case 'EXISTENCE_CHECK':
            _executeExistenceCheck(rule, sheetDataCache, prebuiltMaps);
            break;
          case 'FIELD_COMPARISON':
            _executeFieldComparison(rule, sheetDataCache);
            break;
          // Add other test types here as they are refactored
          default:
            LoggerService.warn('ProductService', '_runMasterValidation', `Unhandled or un-refactored test_type: '${rule.test_type}' for rule ${ruleKey}`);
        }
      } catch (e) {
        LoggerService.error('ProductService', '_runMasterValidation', `Error executing rule ${ruleKey}: ${e.message}`, e);
      }
    });
    LoggerService.info('ProductService', '_runMasterValidation', 'Master-master validation complete.');
  }

  function _runStagingValidation(suiteName) {
    LoggerService.info('ProductService', '_runStagingValidation', `Starting validation for suite: ${suiteName}`);
    const allConfig = ConfigService.getAllConfig();
    const validationRules = Object.keys(allConfig).filter(k => 
      k.startsWith('validation.rule.') && allConfig[k].validation_suite === suiteName && String(allConfig[k].enabled).toUpperCase() === 'TRUE'
    );
    LoggerService.info('ProductService', '_runStagingValidation', `Found ${validationRules.length} enabled rules for suite: ${suiteName}.`);

    if (validationRules.length === 0) return true; // No rules, so validation passes

    let quarantineTriggered = false;

    // --- 1. Pre-computation Step: Gather all required data and build all necessary maps ONCE ---
    const requiredSheets = new Set();
    const requiredMaps = new Map(); // Key: sheetName_by_keyColumn, Value: { sheet, keyColumn }

    validationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if(rule.source_sheet) requiredSheets.add(rule.source_sheet);
      if(rule.target_sheet) requiredSheets.add(rule.target_sheet);
      if(rule.sheet_A) requiredSheets.add(rule.sheet_A);
      if(rule.sheet_B) requiredSheets.add(rule.sheet_B);

      // For existence checks, identify the specific maps needed
      if (rule.test_type === 'EXISTENCE_CHECK') {
        requiredMaps.set(`${rule.source_sheet}_by_${rule.source_key}`, { sheet: rule.source_sheet, keyColumn: rule.source_key });
        requiredMaps.set(`${rule.target_sheet}_by_${rule.target_key}`, { sheet: rule.target_sheet, keyColumn: rule.target_key });
      }
    });

    const sheetDataCache = {};
    requiredSheets.forEach(sheetName => {
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema) {
            LoggerService.warn('ProductService', '_runStagingValidation', `Schema not found for required sheet: ${sheetName}. Skipping load.`);
            return;
        };
        const headers = schema.headers.split(',');
        sheetDataCache[sheetName] = _getSheetDataAsMap(sheetName, headers);
    });

    const prebuiltMaps = {};
    for (const [mapKey, { sheet, keyColumn }] of requiredMaps.entries()) {
        if (prebuiltMaps[mapKey]) continue; // Already built
        const data = sheetDataCache[sheet];
        if (data) {
            prebuiltMaps[mapKey] = _buildMapFromData(data.values, data.headers, keyColumn);
        }
    }
    LoggerService.info('ProductService', '_runStagingValidation', `Pre-built ${Object.keys(prebuiltMaps).length} maps for validation.`);

    // --- 2. Execution Step: Run rules with pre-computed data ---
    validationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      try {
        let ruleQuarantineTriggered = false;
        switch (rule.test_type) {
          case 'EXISTENCE_CHECK':
            ruleQuarantineTriggered = _executeExistenceCheck(rule, sheetDataCache, prebuiltMaps);
            break;
          case 'FIELD_COMPARISON':
            ruleQuarantineTriggered = _executeFieldComparison(rule, sheetDataCache);
            break;
          case 'INTERNAL_AUDIT':
            ruleQuarantineTriggered = _executeInternalAudit(rule, sheetDataCache);
            break;
          case 'ROW_COUNT_COMPARISON':
            ruleQuarantineTriggered = _executeRowCountComparison(rule, sheetDataCache);
            break;
          // Add other test types here as they are refactored
          default:
            LoggerService.warn('ProductService', '_runStagingValidation', `Unhandled or un-refactored test_type: '${rule.test_type}' for rule ${ruleKey}`);
        }
        if (ruleQuarantineTriggered) {
            quarantineTriggered = true;
        }
      } catch (e) {
        LoggerService.error('ProductService', '_runStagingValidation', `Error executing rule ${ruleKey}: ${e.message}`, e);
        if (String(rule.on_failure_quarantine).toUpperCase() === 'TRUE') {
            quarantineTriggered = true;
            LoggerService.warn('ProductService', '_runStagingValidation', `Rule ${ruleKey} encountered an error and triggered quarantine.`);
        }
      }
    });
    return !quarantineTriggered; // Return true if no quarantine was triggered
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

    // --- 2. Run Staging Validation ---
    if (!_runStagingValidation('web_xlt_staging')) {
        LoggerService.warn('ProductService', '_runWebXltValidationAndUpsert', 'WebXlt staging validation failed. Job will be QUARANTINED.');
        return 'QUARANTINED';
    }

    // --- 3. Upsert (existing logic) ---
    _upsertWebXltData();
    return 'COMPLETED';
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

        _populateStagingSheet(comaxData, 'CmxProdS');
        LoggerService.info('ProductService', '_runComaxImport', 'Successfully populated CmxProdS staging sheet.');
        
        if (!_runStagingValidation('comax_staging')) {
            LoggerService.warn('ProductService', '_runComaxImport', 'Comax staging validation failed. Job will be QUARANTINED.');
            return 'QUARANTINED';
        }

        _upsertComaxData();

        return 'COMPLETED';

    } catch (e) {
        LoggerService.error('ProductService', '_runComaxImport', `Failed to import Comax data: ${e.message}`, e);
        _updateJobStatus(jobRowNumber, 'FAILED', `Comax import failed: ${e.message}`);
        return 'FAILED';
    }
  }

  function _upsertComaxData() {
    LoggerService.info('ProductService', '_upsertComaxData', 'Starting CmxProdS to CmxProdM upsert process.');

    const allConfig = ConfigService.getAllConfig();
    const masterSchema = allConfig['schema.data.CmxProdM'];
    const stagingSchema = allConfig['schema.data.CmxProdS'];
    if (!masterSchema || !stagingSchema) {
        throw new Error('Comax master or staging schema not found.');
    }
    const masterHeaders = masterSchema.headers.split(',');
    const stagingHeaders = stagingSchema.headers.split(',');

    const masterData = _getSheetDataAsMap('CmxProdM', masterHeaders, 'cpm_CmxId');
    const stagingData = _getSheetDataAsMap('CmxProdS', stagingHeaders, 'cps_CmxId');

    const masterMap = masterData.map;
    const stagingKey = 'cps_CmxId';
    const masterKey = 'cpm_CmxId';
    const stagingKeyIndex = stagingHeaders.indexOf(stagingKey);

    // Iterate through staging data and update/insert into the master map
    stagingData.values.forEach(stagingRow => {
        const key = stagingRow[stagingKeyIndex] ? String(stagingRow[stagingKeyIndex]).trim() : null;
        if (key) {
            const newMasterRow = {};
            masterHeaders.forEach((masterHeader, index) => {
                const baseHeader = masterHeader.substring(masterHeader.indexOf('_') + 1);
                const stagingHeader = 'cps_' + baseHeader;
                const stagingIndex = stagingHeaders.indexOf(stagingHeader);
                if (stagingIndex !== -1) {
                    newMasterRow[masterHeader] = stagingRow[stagingIndex];
                }
            });
            masterMap.set(key, newMasterRow);
        }
    });

    // Prepare the final data array for writing back to the sheet
    const finalData = Array.from(masterMap.values()).map(rowObject => {
        return masterHeaders.map(header => rowObject[header] || '');
    });

    // Write back to the master sheet
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const masterSheet = dataSpreadsheet.getSheetByName('CmxProdM');
    
    // More robustly clear the sheet and rewrite headers + data
    masterSheet.clear();
    masterSheet.getRange(1, 1, 1, masterHeaders.length).setValues([masterHeaders]).setFontWeight('bold');

    if (finalData.length > 0) {
        masterSheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
    }
    LoggerService.info('ProductService', '_upsertComaxData', `Upsert to CmxProdM complete. Total rows: ${finalData.length}.`);
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

        _populateStagingSheet(productObjects, 'WebProdS_EN');
        LoggerService.info('ProductService', '_runWebProductsImport', 'Successfully populated WebProdS_EN staging sheet.');
        
        if (!_runStagingValidation('web_staging')) {
            LoggerService.warn('ProductService', '_runWebProductsImport', 'Web Products staging validation failed. Job will be QUARANTINED.');
            return 'QUARANTINED';
        }

        _upsertWebProductsData();

        return 'COMPLETED';

    } catch (e) {
        LoggerService.error('ProductService', '_runWebProductsImport', `Failed to import Web Products (EN) data: ${e.message}`, e);
        _updateJobStatus(jobRowNumber, 'FAILED', `Web Products (EN) import failed: ${e.message}`);
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

    const stagingData = _getSheetDataAsMap('WebProdS_EN', stagingHeaders);
    const masterData = _getSheetDataAsMap('WebProdM', masterHeaders);
    const masterMap = masterData.map;

    const stagingKeyIndex = stagingHeaders.indexOf('wps_ID');

    let updatedCount = 0;
    stagingData.values.forEach(stagingRow => {
        const key = stagingRow[stagingKeyIndex];
        if (key && masterMap.has(key)) {
            // Product exists in master, update its values
            const masterRow = masterMap.get(key);
            const stagingRowObject = {};
            stagingHeaders.forEach((h, i) => { stagingRowObject[h] = stagingRow[i]; });

            // Update specific, non-descriptive fields
            masterRow.wpm_Stock = stagingRowObject['wps_Stock'];
            masterRow.wpm_Price = stagingRowObject['wps_RegularPrice'];
            masterRow.wpm_PublishStatusEn = stagingRowObject['wps_Published'];

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
    _updateJobStatus(jobRowNumber, 'PROCESSING');

    try {
      let finalJobStatus = 'COMPLETED'; // Default to COMPLETED
      switch (jobType) {
        case 'import.drive.comax_products':
          finalJobStatus = _runComaxImport(jobRowNumber);
          break;
        case 'import.drive.web_products_en':
          finalJobStatus = _runWebProductsImport(jobRowNumber);
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

  function getProductWebIdBySku(sku) {
    const functionName = 'getProductWebIdBySku';
    try {
      const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const sheet = spreadsheet.getSheetByName('WebProdM');
      if (!sheet) {
        throw new Error('WebProdM sheet not found');
      }
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const skuCol = headers.indexOf('wpm_SKU');
      const webIdCol = headers.indexOf('wpm_WebIdEn');
      if (skuCol === -1 || webIdCol === -1) {
        throw new Error('Could not find SKU or WebIdEn columns in WebProdM');
      }
      for (let i = 1; i < data.length; i++) {
        if (data[i][skuCol] === sku) {
          return data[i][webIdCol];
        }
      }
      return null;
    } catch (e) {
      LoggerService.error('ProductService', functionName, `Error getting web id for sku ${sku}: ${e.message}`, e);
      return null;
    }
  }

  return {
    processJob: processJob,
    runMasterValidation: _runMasterValidation,
    runWebXltValidationAndUpsert: _runWebXltValidationAndUpsert,
    getProductWebIdBySku: getProductWebIdBySku
  };
})();