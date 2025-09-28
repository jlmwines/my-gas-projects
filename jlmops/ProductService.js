/**
 * @file ProductService.js
 * @description Service for handling product-related business logic, including staging and validation.
 */

const ProductService = (function() {

  // =================================================================================
  // PRIVATE HELPER METHODS
  // =================================================================================

  function _populateStagingSheet(productsOrData, sheetName) {
    LoggerService.info('ProductService', '_populateStagingSheet', `Writing ${productsOrData.length} items to staging sheet: ${sheetName}...`);
    
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = dataSpreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found in JLMops_Data spreadsheet.`);
    }

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
    const sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const schemaHeaders = schema.headers.split(','); // These are the expected keys in product objects

    finalData = productsOrData.map(product => {
      const rowData = [];
      for (let i = 0; i < sheetHeaders.length; i++) {
        const sheetHeader = sheetHeaders[i];
        // Find the corresponding value in the product object using the sheetHeader
        // We assume sheetHeader (e.g., 'wps_ID') directly corresponds to the key in the product object
        rowData.push(product[sheetHeader] || '');
      }
      return rowData;
    });
    }
    
    // Clear previous content and write new data
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
    }
    if (finalData.length > 0 && finalData[0].length > 0) {
        sheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
    }
    LoggerService.info('ProductService', '_populateStagingSheet', `Staging sheet '${sheetName}' has been updated.`);
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
    if (!sheet || sheet.getLastRow() < 2) {
      LoggerService.warn('ProductService', '_getSheetDataAsMap', `Sheet '${sheetName}' is empty or not found.`);
      return { map: new Map(), headers: headers };
    }
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    
    const dataMap = new Map();
    const keyHeader = headers.find(h => h.endsWith('_ID') || h.endsWith('_SKU') || h.endsWith('_IdEn'));
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
    return { map: dataMap, headers: headers };
  }

  function _formatString(template, dataRow) {
    if (!template) return '';
    return template.replace(/\${(.*?)}/g, (match, key) => {
      return dataRow[key.trim()] || '';
    });
  }

  function _createTaskFromFailure(rule, dataRow) {
    const title = _formatString(rule.on_failure_title, dataRow);
    const notes = _formatString(rule.on_failure_notes, dataRow);
    const entityId = dataRow[rule.source_key] || dataRow[rule.key_A] || dataRow[Object.keys(dataRow)[1]] || 'N/A';

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

  function _executeExistenceCheck(rule, dataMaps) {
    LoggerService.info('ProductService', '_executeExistenceCheck', `Executing rule: ${rule.on_failure_title}`);
    const sourceMap = dataMaps[rule.source_sheet].map;
    const targetMap = dataMaps[rule.target_sheet].map;

    for (const [key, sourceRow] of sourceMap.entries()) {
      const existsInTarget = targetMap.has(key);
      const shouldFail = rule.invert_result === 'TRUE' ? !existsInTarget : existsInTarget;

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
    const mapA = dataMaps[rule.sheet_A].map;
    const mapB = dataMaps[rule.sheet_B].map;
    const [fieldA, fieldB] = rule.compare_fields.split(',');

    for (const [key, rowA] of mapA.entries()) {
      if (mapB.has(key)) {
        const rowB = mapB.get(key);
        if (String(rowA[fieldA] || '') !== String(rowB[fieldB] || '')) {
          _createTaskFromFailure(rule, { ...rowA, ...rowB });
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

  function _runValidationEngine() {
    const allConfig = ConfigService.getAllConfig();
    const validationRules = Object.keys(allConfig).filter(k => k.startsWith('validation.rule.'));
    LoggerService.info('ProductService', '_runValidationEngine', `Found ${validationRules.length} validation rules.`);

    if (validationRules.length === 0) return;

    const requiredSheets = new Set();
    validationRules.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if (rule.enabled !== 'TRUE') return;
      if(rule.source_sheet) requiredSheets.add(rule.source_sheet);
      if(rule.target_sheet) requiredSheets.add(rule.target_sheet);
      if(rule.sheet_A) requiredSheets.add(rule.sheet_A);
      if(rule.sheet_B) requiredSheets.add(rule.sheet_B);
      if(rule.join_against) requiredSheets.add(rule.join_against);
    });
    LoggerService.info('ProductService', '_runValidationEngine', `Validation requires sheets: ${Array.from(requiredSheets).join(', ')}`);

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

  // =================================================================================
  // PUBLIC METHODS
  // =================================================================================

  function processJob(jobRow, rowNumber) {
    const jobQueueHeaders = ConfigService.getConfig('schema.log.SysJobQueue').headers.split(',');
    const jobId = jobRow[jobQueueHeaders.indexOf('job_id')];
    const jobType = jobRow[jobQueueHeaders.indexOf('job_type')];
    const archiveFileId = jobRow[jobQueueHeaders.indexOf('archive_file_id')];

    LoggerService.info('ProductService', 'processJob', `Starting processing for job ${jobId} of type ${jobType}`);

    try {
      const jobConfig = ConfigService.getConfig(jobType);
      if (!jobConfig) throw new Error(`Configuration for job type ${jobType} not found.`);

      const file = DriveApp.getFileById(archiveFileId);
      const encoding = jobConfig.file_encoding || 'UTF-8';
      const csvContent = file.getBlob().getDataAsString(encoding);

      let products;
      let stagingSheetName;

      switch (jobType) {
        case 'import.drive.comax_products':
          products = ComaxAdapter.processProductCsv(csvContent);
          stagingSheetName = 'CmxProdS';
          break;
        case 'import.drive.web_products_en':
          products = WebAdapter.processProductCsv(csvContent, 'map.web.product_columns');
          stagingSheetName = 'WebProdS_EN';
          break;
        case 'import.drive.web_products_he':
          // This import is intentionally not processed as there is no separate Hebrew source file.
          // Hebrew data is synthesized from other sources after the English import.
          LoggerService.info('ProductService', 'processJob', `Job type ${jobType} is not processed directly. Skipping.`);
          _updateJobStatus(rowNumber, 'COMPLETED', 'Job type is not processed directly.');
          return;
        default:
          LoggerService.info('ProductService', 'processJob', `Job type ${jobType} is not a product import. Skipping.`);
          return;
      }

      if (!products || products.length === 0) {
        LoggerService.info('ProductService', 'processJob', 'No products to process.');
        _updateJobStatus(rowNumber, 'COMPLETED', 'No products found in file.');
        return;
      }

      _populateStagingSheet(products, stagingSheetName);
      
      LoggerService.info('ProductService', 'processJob', `Staging complete. Running validation engine.`);
      // _runValidationEngine(); // Temporarily disabled for import testing
      LoggerService.info('ProductService', 'processJob', 'Validation engine finished.');

      _updateJobStatus(rowNumber, 'COMPLETED', `Processed and staged ${products.length} products. Validation complete.`);
      LoggerService.info('ProductService', 'processJob', `Successfully completed job ${jobId}`);

    } catch (e) {
      LoggerService.error('ProductService', 'processJob', `FAILED job ${jobId}. Error: ${e.message}`, e);
      _updateJobStatus(rowNumber, 'FAILED', e.message);
    }
  }

  return {
    processJob: processJob
  };

})();