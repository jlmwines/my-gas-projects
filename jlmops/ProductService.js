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
          products = _processGenericCsv(csvContent, 'schema.data.WebProdS_EN');
          stagingSheetName = 'WebProdS_EN';
          break;
        case 'import.drive.web_products_he':
          products = _processGenericCsv(csvContent, 'schema.data.WebProdS_HE');
          stagingSheetName = 'WebProdS_HE';
          break;
        default:
          // This job is not a product import, so we can stop here.
          LoggerService.info('ProductService', 'processJob', `Job type ${jobType} is not a product import. Skipping.`);
          return;
      }

      if (!products || products.length === 0) {
        LoggerService.info('ProductService', 'processJob', 'No products to process.');
        _updateJobStatus(rowNumber, 'COMPLETED', 'No products found in file.');
        return;
      }

      _populateStagingSheet(products, stagingSheetName);
      
      // --- Run the validation engine after staging is complete ---
      LoggerService.info('ProductService', 'processJob', `Staging complete. Starting validation engine.`);
      _runValidationEngine();
      LoggerService.info('ProductService', 'processJob', 'Validation engine finished.');

      _updateJobStatus(rowNumber, 'COMPLETED', `Processed and staged ${products.length} products. Validation complete.`);
      LoggerService.info('ProductService', 'processJob', `Successfully completed job ${jobId}`);

    } catch (e) {
      LoggerService.error('ProductService', 'processJob', `FAILED job ${jobId}. Error: ${e.message}`, e);
      _updateJobStatus(rowNumber, 'FAILED', e.message);
    }
  }

  // =================================================================================
  // VALIDATION ENGINE
  // =================================================================================

  /**
   * Main entry point for the validation engine.
   * Reads all validation rules and executes them.
   */
  function _runValidationEngine() {
    const allConfig = ConfigService.getAllConfig();
    const validationRules = Object.keys(allConfig).filter(k => k.startsWith('validation.rule.'));

    if (validationRules.length === 0) {
      LoggerService.warn('ProductService', '_runValidationEngine', 'No validation rules found in configuration.');
      return;
    }

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
      if (rule.enabled !== 'TRUE') return;

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

  function _executeExistenceCheck(rule, dataMaps) {
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

  function _evaluateCondition(val1, operator, val2) {
      switch(operator) {
          case '<': return Number(val1) < Number(val2);
          case '>': return Number(val1) > Number(val2);
          case '=': return String(val1) === val2;
          case '<>': return String(val1) !== val2;
          default: return false;
      }
  }

  function _executeCrossConditionCheck(rule, dataMaps) {
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

  function _createTaskFromFailure(rule, dataRow) {
    const title = _formatString(rule.on_failure_title, dataRow);
    const notes = _formatString(rule.on_failure_notes, dataRow);
    const entityId = dataRow[rule.source_key] || dataRow[rule.key_A] || dataRow[Object.keys(dataRow)[1]] || 'N/A';

    TaskService.createTask(rule.on_failure_task_type, entityId, title, notes);
  }

  function _formatString(template, dataRow) {
    if (!template) return '';
    return template.replace(/\${(.*?)}/g, (match, key) => {
      return dataRow[key.trim()] || '';
    });
  }

  function _getSheetDataAsMap(sheetName, headers) {
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = dataSpreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
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
    return { map: dataMap, headers: headers };
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