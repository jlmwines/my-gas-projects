const LEGACY_EXPORT_FOLDER_ID = '1ZNCnL6ryYOyhFaErbZlGW_eTKoR6nUU5';
const LEGACY_REFERENCE_SPREADSHEET_ID = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc';

const ValidationService = {
  /**
   * Compares the on-hold inventory data between jlmops and the legacy system.
   */
  validateOnHoldInventory() {
    const serviceName = 'ValidationService';
    const functionName = 'validateOnHoldInventory';
    try {
      const legacyData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OnHoldInventory');
      const jlmopsData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'SysInventoryOnHold');

      const legacyMap = new Map(legacyData.map(row => [row['product SKU'], row['on hold quantity']]));
      const jlmopsMap = new Map(jlmopsData.map(row => [row.sio_SKU, row.sio_OnHoldQuantity]));

      let discrepancies = [];

      for (const [sku, legacyQuantity] of legacyMap.entries()) {
        const jlmopsQuantity = jlmopsMap.get(sku);
        if (jlmopsQuantity === undefined) {
          discrepancies.push(`Legacy SKU ${sku} with quantity ${legacyQuantity} not found in JLMops.`);
        } else if (jlmopsQuantity !== legacyQuantity) {
          discrepancies.push(`SKU ${sku}: Legacy quantity ${legacyQuantity} differs from JLMops quantity ${jlmopsQuantity}.`);
        }
      }

      for (const [sku, jlmopsQuantity] of jlmopsMap.entries()) {
        if (!legacyMap.has(sku)) {
          discrepancies.push(`JLMops SKU ${sku} with quantity ${jlmopsQuantity} not found in Legacy.`);
        }
      }

      if (discrepancies.length === 0) {
        const message = 'On-Hold Inventory validation successful. Data matches.';
        logger.info(serviceName, functionName, message);
        return message;
      } else {
        const message = `On-Hold Inventory validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' ')); // Log as a single line
        return message;
      }

    } catch (e) {
      const errorMessage = `Error during On-Hold Inventory validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Helper function to read data from a Google Sheet.
   * @param {string} spreadsheetId
   * @param {string} sheetName
   * @returns {Array<Object>}
   */
  readSheetData(spreadsheetId, sheetName) {
    const serviceName = 'ValidationService';
    const functionName = 'readSheetData';
    try {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found in spreadsheet ID '${spreadsheetId}'.`);
      }
      const range = sheet.getDataRange();
      const values = range.getValues();
      if (values.length === 0) {
        return [];
      }
      const headers = values[0];
      const data = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header] = row[index];
        });
        data.push(rowObject);
      }
      return data;
    } catch (e) {
      logger.error(serviceName, functionName, `Error reading sheet data: ${e.message}`, e);
      throw e; // Re-throw the error to be handled upstream
    }
  },



  formatString(template, dataRow) {
    if (!template) return '';
    return template.replace(/\${(.*?)}/g, (match, key) => {
      return dataRow[key.trim()] || '';
    });
  },

  createTaskFromFailure(rule, dataRow, joinKey) {
    const serviceName = 'ValidationService';
    const title = this.formatString(rule.on_failure_title, dataRow);
    const notes = this.formatString(rule.on_failure_notes, dataRow);
    const skuKey = Object.keys(dataRow).find(k => k.endsWith('_SKU'));
    const entityId = skuKey ? dataRow[skuKey] : (joinKey || dataRow[rule.source_key] || dataRow[rule.key_A] || 'N/A');

    LoggerService.info(serviceName, 'createTaskFromFailure', `Attempting to create task for rule: ${rule.on_failure_task_type} with entity ID: ${entityId}`);
    TaskService.createTask(rule.on_failure_task_type, entityId, title, notes);
    
    return String(rule.on_failure_quarantine).toUpperCase() === 'TRUE';
  },

  evaluateCondition(val1, operator, val2) {
      switch(operator) {
          case '<': return Number(val1) < Number(val2);
          case '>': return Number(val1) > Number(val2);
          case '=': return String(val1) === val2;
          case '<>': return String(val1) !== val2;
          case 'IS_NOT_EMPTY': return String(val1 || '').trim() !== ''; 
          default: return false;
      }
  },
  // =================================================================================
  // VALIDATION ENGINE SUB-FUNCTIONS
  // =================================================================================

  buildMapFromData(data, headers, keyHeader) {
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
  },

  _executeExistenceCheck(rule, dataMaps, prebuiltMaps) {
    const serviceName = 'ValidationService';
    LoggerService.info(serviceName, '_executeExistenceCheck', `Executing rule: ${rule.on_failure_title}`);

    let quarantineTriggered = false;
    let ruleStatus = 'PASSED';
    let ruleMessage = 'All checks passed.';

    // Use pre-built maps for efficiency
    const sourceMapKey = `${rule.source_sheet}_by_${rule.source_key}`;
    const targetMapKey = `${rule.target_sheet}_by_${rule.target_key}`;

    const sourceMap = prebuiltMaps[sourceMapKey];
    const targetMap = prebuiltMaps[targetMapKey];

    if (!sourceMap || !targetMap) {
        const errorMsg = `Could not find pre-built maps for rule: ${rule.on_failure_title}. Required keys: ${sourceMapKey}, ${targetMapKey}`;
        LoggerService.error(serviceName, '_executeExistenceCheck', errorMsg);
        return { status: 'FAILED', message: errorMsg, quarantineTriggered: true }; // Consider this a critical failure
    }

    const failedItems = [];

    for (const [key, sourceRow] of sourceMap.entries()) {
      const existsInTarget = targetMap.has(key);
      const shouldInvert = String(rule.invert_result).toUpperCase() === 'TRUE';
      const shouldFail = shouldInvert ? !existsInTarget : existsInTarget;

      if (shouldFail) {
        let passesFilter = true;
        if (rule.source_filter) {
            const [filterKey, filterValue] = rule.source_filter.split(',');
            if (sourceRow[filterKey] != filterValue) { // Use != for loose comparison
                passesFilter = false;
            }
        }
        if (passesFilter) {
            // Log for debugging and collect details for the message
            const isQuarantineFailure = this.createTaskFromFailure(rule, sourceRow);
            if (isQuarantineFailure) {
                quarantineTriggered = true;
            }
            // Collect enough info to construct a meaningful message later
            failedItems.push(key); 
        }
      }
    }

    if (failedItems.length > 0) {
        ruleStatus = 'FAILED';
        ruleMessage = `Failed for ${failedItems.length} item(s). First few: ${failedItems.slice(0, 5).join(', ')}.`;
    }
    
    return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
  },
  
    _executeFieldComparison(rule, dataMaps, prebuiltMaps) {
      const serviceName = 'ValidationService';
      LoggerService.info(serviceName, '_executeFieldComparison', `Executing rule: ${rule.on_failure_title}`);
  
      let quarantineTriggered = false;
      let ruleStatus = 'PASSED';
      let ruleMessage = 'All checks passed.';
      const failedItems = [];
  
      // Use pre-built maps for efficiency
      const mapA = prebuiltMaps[`${rule.sheet_A}_by_${rule.key_A}`];
      const mapB = prebuiltMaps[`${rule.sheet_B}_by_${rule.key_B}`];
  
      if (!mapA || !mapB) {
          const errorMsg = `Could not find pre-built maps for rule: ${rule.on_failure_title}. Required keys: ${rule.sheet_A}_by_${rule.key_A}, ${rule.sheet_B}_by_${rule.key_B}`;
          LoggerService.error(serviceName, '_executeFieldComparison', errorMsg);
          return { status: 'FAILED', message: errorMsg, quarantineTriggered: true }; // Critical configuration error
      }

      const [fieldA, fieldB] = rule.compare_fields.split(',');
  
      if (!fieldA || !fieldB) {
          const errorMsg = `Invalid 'compare_fields' for rule: ${rule.on_failure_title}`;
          LoggerService.error(serviceName, '_executeFieldComparison', errorMsg);
          return { status: 'FAILED', message: errorMsg, quarantineTriggered: true }; // Critical configuration error
      }
  
      for (const [key, rowB] of mapB.entries()) {
          if (mapA.has(key)) {
              const rowA = mapA.get(key);

              // --- New Filter Logic ---
              if (rule.source_filter) {
                  const [filterKey, filterValue] = rule.source_filter.split(',');
                  // Check filter on Sheet A (Master)
                  if (rowA.hasOwnProperty(filterKey) && String(rowA[filterKey]) !== String(filterValue)) {
                      continue; // Skip this row
                  }
                  // Check filter on Sheet B (Staging) if not found in A (fallback or specific logic)
                  // For comparison, we generally filter on the "Source of Truth" or Master record context.
                  // If needed, we could check rowB as well, but usually Master flag dictates "is this relevant".
              }
              // ------------------------
  
              let valueA = String(rowA[fieldA] || '').trim();
              let valueB = String(rowB[fieldB] || '').trim();
  
              // Apply translation map for fieldA if available
              const translationMapConfigA = rule[`field_translations_map_${fieldA}`];
              if (translationMapConfigA) {
                  try {
                      const translationMapA = JSON.parse(translationMapConfigA);
                      if (valueA in translationMapA) {
                          valueA = translationMapA[valueA];
                      }
                  } catch (e) {
                      LoggerService.error('ValidationService', '_executeFieldComparison', `Error parsing translation map for ${fieldA}: ${e.message}`);
                  }
              }
  
              // Apply translation map for fieldB if available
              const translationMapConfigB = rule[`field_translations_map_${fieldB}`];
              if (translationMapConfigB) {
                  try {
                      const translationMapB = JSON.parse(translationMapConfigB);
                      if (valueB in translationMapB) {
                          valueB = translationMapB[valueB];
                      }
                  } catch (e) {
                      LoggerService.error('ValidationService', '_executeFieldComparison', `Error parsing translation map for ${fieldB}: ${e.message}`);
                  }
              }
              
              // Log values for debugging
              if (valueA !== valueB) {
                LoggerService.info(
                    'ValidationService',
                    '_executeFieldComparison',
                    `DEBUG Mismatch for rule '${rule.on_failure_title}'. ` +
                    `Key: '${key}'. ` +
                    `Comparing '${fieldA}' (Value: '${valueA}') with '${fieldB}' (Value: '${valueB}').`
                );
              }
  
              if (valueA !== valueB) {
                  const mergedRow = { ...rowA, ...rowB };
                  const isQuarantineFailure = this.createTaskFromFailure(rule, mergedRow, key);
                  if (isQuarantineFailure) {
                      quarantineTriggered = true;
                  }
                  failedItems.push(key);
              }
          }
      }
  
      if (failedItems.length > 0) {
          ruleStatus = 'FAILED';
          ruleMessage = `Failed for ${failedItems.length} item(s). First few: ${failedItems.slice(0, 5).join(', ')}.`;
      }
      
      return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
    },
  _executeCrossConditionCheck(rule, dataMaps) {
    const serviceName = 'ValidationService';
    LoggerService.info(serviceName, '_executeCrossConditionCheck', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false;
    let ruleStatus = 'PASSED';
    let ruleMessage = 'All checks passed.';
    const failedItems = [];

    const mapA = dataMaps[rule.sheet_A].map;
    const mapB = dataMaps[rule.sheet_B].map;
    const [condFieldA, condValueA] = rule.condition_A.split(',');
    const [condFieldB, condOpB, condValueB] = rule.condition_B.split(',');

    for (const [key, rowA] of mapA.entries()) {
      if (rowA[condFieldA] == condValueA && mapB.has(key)) { // Use == for loose comparison
        const rowB = mapB.get(key);
        if (this.evaluateCondition(rowB[condFieldB], condOpB, condValueB)) {
          const isQuarantineFailure = this.createTaskFromFailure(rule, { ...rowA, ...rowB });
          if (isQuarantineFailure) {
            quarantineTriggered = true;
          }
          failedItems.push(key);
        }
      }
    }

    if (failedItems.length > 0) {
        ruleStatus = 'FAILED';
        ruleMessage = `Failed for ${failedItems.length} item(s). First few: ${failedItems.slice(0, 5).join(', ')}.`;
    }
    
    return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
  },

  _executeInternalAudit(rule, dataMaps) {
    const serviceName = 'ValidationService';
    LoggerService.info(serviceName, '_executeInternalAudit', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false;
    let ruleStatus = 'PASSED';
    let ruleMessage = 'All checks passed.';
    const failedItems = [];

    const sourceMap = dataMaps[rule.source_sheet].map;
    const conditionParts = rule.condition.split(',');
    
    let field, operator, value, logic, field2, op2, val2;
    const andIndex = conditionParts.indexOf('AND');

    if (andIndex !== -1) {
      const part1 = conditionParts.slice(0, andIndex);
      const part2 = conditionParts.slice(andIndex + 1);
      
      [field, operator, value] = part1;
      logic = 'AND';
      [field2, op2, val2] = part2;
    } else {
      [field, operator, value] = conditionParts;
    }

    for (const [key, row] of sourceMap.entries()) {
        const val1_part1 = row[field];
        const result_part1 = this.evaluateCondition(val1_part1, operator, value);

        let conditionMet = result_part1;

        if (conditionMet && logic === 'AND') { // Supports up to one AND condition
            const val1_part2 = row[field2];
            const result_part2 = this.evaluateCondition(val1_part2, op2, val2);
            conditionMet = conditionMet && result_part2;
        }

        if (conditionMet) {
            LoggerService.info(
                serviceName,
                '_executeInternalAudit',
                `Condition met for rule '${rule.on_failure_title}'. ` +
                `Key: '${key}', ${field}: '${row[field]}', ${field2 ? `${field2}: '${row[field2]}', ` : ''} ` + // Dynamically log condition fields
                `Full Condition: '${rule.condition}'.`
            );
            const isQuarantineFailure = this.createTaskFromFailure(rule, row, key);
            if (isQuarantineFailure) {
                quarantineTriggered = true;
            }
            failedItems.push(key);
        }
    }

    if (failedItems.length > 0) {
        ruleStatus = 'FAILED';
        ruleMessage = `Failed for ${failedItems.length} item(s). First few: ${failedItems.slice(0, 5).join(', ')}.`;
    }
    
    return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
  },

  _executeCrossExistenceCheck(rule, dataMaps) {
    const serviceName = 'ValidationService';
    LoggerService.info(serviceName, '_executeCrossExistenceCheck', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false;
    let ruleStatus = 'PASSED';
    let ruleMessage = 'All checks passed.';
    const failedItems = [];

    const sourceMap = dataMaps[rule.source_sheet].map;
    const targetMap = dataMaps[rule.target_sheet].map;
    const joinMap = dataMaps[rule.join_against].map;
    const [condField, condValue] = rule.source_condition.split(',');

    for (const [key, row] of sourceMap.entries()) {
      if (row[condField] == condValue) { // Use == for loose comparison
        const existsInJoin = joinMap.has(key);
        const existsInTarget = targetMap.has(key);

        const joinCheck = rule.join_invert === 'TRUE' ? !existsInJoin : existsInJoin;
        const targetCheck = rule.invert_result === 'TRUE' ? !existsInTarget : existsInTarget;

        if (joinCheck && targetCheck) {
          const isQuarantineFailure = this.createTaskFromFailure(rule, row);
          if (isQuarantineFailure) {
            quarantineTriggered = true;
          }
          failedItems.push(key);
        }
      }
    }

    if (failedItems.length > 0) {
        ruleStatus = 'FAILED';
        ruleMessage = `Failed for ${failedItems.length} item(s). First few: ${failedItems.slice(0, 5).join(', ')}.`;
    }
    
    return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
  },

  _executeSchemaComparison(rule, dataMaps) {
    const serviceName = 'ValidationService';
    LoggerService.info(serviceName, '_executeSchemaComparison', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false;
    let ruleStatus = 'PASSED';
    let ruleMessage = 'All checks passed.';

    const allConfig = ConfigService.getAllConfig();

    const sourceSchema = allConfig[rule.source_schema];
    const targetSchema = allConfig[rule.target_schema];

    if (!sourceSchema || !targetSchema || !sourceSchema.headers || !targetSchema.headers) {
        const errorMsg = `CRITICAL: Schema configuration incomplete for rule '${rule.on_failure_title}'. Source or target schema headers missing.`;
        LoggerService.error(serviceName, '_executeSchemaComparison', errorMsg);
        return { status: 'FAILED', message: errorMsg, quarantineTriggered: true };
    }

    const sourceSchemaHeaders = sourceSchema.headers.split(',');
    const targetSchemaHeaders = targetSchema.headers.split(',');

    const missingColumns = sourceSchemaHeaders.filter(header => !targetSchemaHeaders.includes(header));

    if (missingColumns.length > 0) {
      ruleStatus = 'FAILED';
      ruleMessage = `Missing columns in target schema: ${missingColumns.join(', ')}`;
      const isQuarantineFailure = this.createTaskFromFailure(rule, { missingColumns: missingColumns.join(', ') });
      if (isQuarantineFailure) {
        quarantineTriggered = true;
      }
    }
    
    return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
  },

  _executeRowCountComparison(rule, dataMaps) {
    const serviceName = 'ValidationService';
    LoggerService.info(serviceName, '_executeRowCountComparison', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false;
    let ruleStatus = 'PASSED';
    let ruleMessage = 'All checks passed.';

    const sourceSheetData = dataMaps[rule.source_sheet];
    const targetSheetData = dataMaps[rule.target_sheet];

    if (!sourceSheetData || !targetSheetData) {
        const errorMsg = `CRITICAL: Sheet data not found for rule '${rule.on_failure_title}'. Check source_sheet or target_sheet configuration.`;
        LoggerService.error(serviceName, '_executeRowCountComparison', errorMsg);
        return { status: 'FAILED', message: errorMsg, quarantineTriggered: true };
    }

    // Assuming first row is headers, so data rows are length - 1
    const sourceRowCount = sourceSheetData.values.length;
    const targetRowCount = targetSheetData.values.length;

    if (targetRowCount < sourceRowCount) {
      ruleStatus = 'FAILED';
      ruleMessage = `Row count mismatch: Source (${sourceRowCount}) > Target (${targetRowCount}).`;
      const isQuarantineFailure = this.createTaskFromFailure(rule, { sourceRowCount: sourceRowCount, targetRowCount: targetRowCount });
      if (isQuarantineFailure) {
        quarantineTriggered = true;
      }
    }
    
    return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
  },

  _executeDataCompleteness(rule, dataMaps) {
    const serviceName = 'ValidationService';
    LoggerService.info(serviceName, '_executeDataCompleteness', `Executing rule: ${rule.on_failure_title}`);
    let quarantineTriggered = false;
    let ruleStatus = 'PASSED';
    let ruleMessage = 'All checks passed.';
    const failedItems = [];

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
          const isQuarantineFailure = this.createTaskFromFailure(rule, { rowNum: i + 2, colName: sourceSheetHeaders[j], cellValue: row[j] });
          if (isQuarantineFailure) {
            quarantineTriggered = true;
          }
          failedItems.push(`Row ${i + 2}, Col ${sourceSheetHeaders[j]}`);
        }
      }
    }

    if (failedItems.length > 0) {
        ruleStatus = 'FAILED';
        ruleMessage = `Failed for ${failedItems.length} empty cell(s). First few: ${failedItems.slice(0, 5).join(', ')}.`;
    }
    
    return { status: ruleStatus, message: ruleMessage, quarantineTriggered: quarantineTriggered };
  },

    _runMasterValidation() {
      const serviceName = 'ValidationService';
      LoggerService.info(serviceName, '_runMasterValidation', 'Starting master-master validation');
      const allConfig = ConfigService.getAllConfig();
      const validationRulesKeys = Object.keys(allConfig).filter(k =>
        k.startsWith('validation.rule.') && allConfig[k].validation_suite === 'master_master' && String(allConfig[k].enabled).toUpperCase() === 'TRUE'
      );
      LoggerService.info(serviceName, '_runMasterValidation', `Found ${validationRulesKeys.length} enabled master_master validation rules.`);
  
      const collectedResults = [];
      let overallQuarantineTriggered = false;
  
      if (validationRulesKeys.length === 0) {
          return { overallQuarantineTriggered: overallQuarantineTriggered, results: collectedResults };
      }
  
      // --- 1. Pre-computation Step ---
      const requiredSheets = new Set();
      const requiredMaps = new Map();
  
      validationRulesKeys.forEach(ruleKey => {
        const rule = allConfig[ruleKey];
        if(rule.source_sheet) requiredSheets.add(rule.source_sheet);
        if(rule.target_sheet) requiredSheets.add(rule.target_sheet);
        if(rule.sheet_A) requiredSheets.add(rule.sheet_A);
        if(rule.sheet_B) requiredSheets.add(rule.sheet_B);
        if(rule.join_against) requiredSheets.add(rule.join_against); // For CROSS_EXISTENCE_CHECK
  
        if (rule.test_type === 'EXISTENCE_CHECK') {
          requiredMaps.set(`${rule.source_sheet}_by_${rule.source_key}`, { sheet: rule.source_sheet, keyColumn: rule.source_key });
          requiredMaps.set(`${rule.target_sheet}_by_${rule.target_key}`, { sheet: rule.target_sheet, keyColumn: rule.target_key });
        } else if (rule.test_type === 'FIELD_COMPARISON') {
          requiredMaps.set(`${rule.sheet_A}_by_${rule.key_A}`, { sheet: rule.sheet_A, keyColumn: rule.key_A });
          requiredMaps.set(`${rule.sheet_B}_by_${rule.key_B}`, { sheet: rule.sheet_B, keyColumn: rule.key_B });
        } else if (rule.test_type === 'CROSS_EXISTENCE_CHECK') { // Special handling for CROSS_EXISTENCE_CHECK
          requiredMaps.set(`${rule.source_sheet}_by_${rule.source_key}`, { sheet: rule.source_sheet, keyColumn: rule.source_key });
          requiredMaps.set(`${rule.target_sheet}_by_${rule.target_key}`, { sheet: rule.target_sheet, keyColumn: rule.target_key });
          requiredMaps.set(`${rule.join_against}_by_${rule.target_key}`, { sheet: rule.join_against, keyColumn: rule.target_key }); // Assuming join_against uses target_key for consistency
        }
      });
  
      const sheetDataCache = {};
      requiredSheets.forEach(sheetName => {
          const schema = allConfig[`schema.data.${sheetName}`];
          if (!schema) {
              LoggerService.warn(serviceName, '_runMasterValidation', `Schema not found for required sheet: ${sheetName}. Skipping load.`);
              return;
          };
          const headers = schema.headers.split(',');
          const keyColumn = schema.key_column; // Extract key_column
          sheetDataCache[sheetName] = ConfigService._getSheetDataAsMap(sheetName, headers, keyColumn);
      });
  
      const prebuiltMaps = {};
      for (const [mapKey, { sheet, keyColumn }] of requiredMaps.entries()) {
          if (prebuiltMaps[mapKey]) continue;
          const data = sheetDataCache[sheet];
          if (data) {
              prebuiltMaps[mapKey] = this.buildMapFromData(data.values, data.headers, keyColumn);
          }
      }
      LoggerService.info(serviceName, '_runMasterValidation', `Pre-built ${Object.keys(prebuiltMaps).length} maps for validation.`);
  
      // --- 2. Execution Step ---
      validationRulesKeys.forEach(ruleKey => {
        const rule = allConfig[ruleKey];
        let ruleResult = { ruleKey: ruleKey, ruleTitle: rule.on_failure_title, status: 'UNKNOWN', message: 'Rule did not execute.' };
        try {
          switch (rule.test_type) {
            case 'EXISTENCE_CHECK':
              ruleResult = this._executeExistenceCheck(rule, sheetDataCache, prebuiltMaps);
              break;
            case 'FIELD_COMPARISON':
              ruleResult = this._executeFieldComparison(rule, sheetDataCache, prebuiltMaps);
              break;
            case 'ROW_COUNT_COMPARISON':
              ruleResult = this._executeRowCountComparison(rule, sheetDataCache);
              break;
            case 'SCHEMA_COMPARISON':
              ruleResult = this._executeSchemaComparison(rule, sheetDataCache);
              break;
            case 'DATA_COMPLETENESS':
              ruleResult = this._executeDataCompleteness(rule, sheetDataCache);
              break;
            case 'CROSS_CONDITION_CHECK':
              ruleResult = this._executeCrossConditionCheck(rule, sheetDataCache);
              break;
            case 'CROSS_EXISTENCE_CHECK':
              ruleResult = this._executeCrossExistenceCheck(rule, sheetDataCache);
              break;
            case 'INTERNAL_AUDIT':
              ruleResult = this._executeInternalAudit(rule, sheetDataCache);
              break;
            default:
              LoggerService.warn(serviceName, '_runMasterValidation', `Unhandled or un-refactored test_type: '${rule.test_type}' for rule ${ruleKey}`);
              ruleResult = { ruleKey: ruleKey, ruleTitle: rule.on_failure_title, status: 'SKIPPED', message: `Unhandled test_type: ${rule.test_type}` };
          }
        } catch (e) {
          LoggerService.error(serviceName, '_runMasterValidation', `Error executing rule ${ruleKey}: ${e.message}`, e);
          ruleResult = { ruleKey: ruleKey, ruleTitle: rule.on_failure_title, status: 'ERROR', message: `Execution error: ${e.message}` };
        } finally {
            collectedResults.push({
                ruleName: rule.on_failure_title,
                status: ruleResult.status,
                message: ruleResult.message
            });
            if (ruleResult.quarantineTriggered) {
                overallQuarantineTriggered = true;
            }
        }
      });
      LoggerService.info(serviceName, '_runMasterValidation', 'Master-master validation complete.');
      return { overallQuarantineTriggered: overallQuarantineTriggered, results: collectedResults };
    },
  _runOrderStagingValidation(suiteName) {
    const serviceName = 'ValidationService';
    const functionName = '_runOrderStagingValidation';
    logger.info(serviceName, functionName, `Starting validation for suite: ${suiteName}`);
    const allConfig = ConfigService.getAllConfig();
    const validationRulesKeys = Object.keys(allConfig).filter(k => 
      k.startsWith('validation.rule.') && allConfig[k].validation_suite === suiteName && String(allConfig[k].enabled).toUpperCase() === 'TRUE'
    );
    logger.info(serviceName, functionName, `Found ${validationRulesKeys.length} enabled rules for suite: ${suiteName}.`);

    if (validationRulesKeys.length === 0) return true;

    let quarantineTriggeredOverall = false;

    // --- 1. Pre-computation Step ---
    const requiredSheets = new Set();
    const requiredMaps = new Map();

    validationRulesKeys.forEach(ruleKey => {
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
            logger.warn(serviceName, functionName, `Schema not found for required sheet: ${sheetName}. Skipping load.`);
            return;
        };
        const headers = schema.headers.split(',');
        const keyColumn = schema.key_column;
        const sheetData = ConfigService._getSheetDataAsMap(sheetName, headers, keyColumn);
        if (sheetData) {
          sheetDataCache[sheetName] = sheetData;
        }
    });

    const prebuiltMaps = {};
    for (const [mapKey, { sheet, keyColumn }] of requiredMaps.entries()) {
        if (prebuiltMaps[mapKey]) continue;
        const data = sheetDataCache[sheet];
        if (data && data.values && data.headers) {
            prebuiltMaps[mapKey] = this.buildMapFromData(data.values, data.headers, keyColumn);
        }
    }
    logger.info(serviceName, functionName, `Pre-built ${Object.keys(prebuiltMaps).length} maps for validation.`);

    // --- 2. Execution Step ---
    for (const ruleKey of validationRulesKeys) {
        const rule = allConfig[ruleKey];
        logger.info(serviceName, functionName, `Executing rule: ${rule.on_failure_title}`);
        try {
            let ruleResult = { quarantineTriggered: false };
            switch (rule.test_type) {
                case 'EXISTENCE_CHECK':
                    ruleResult = this._executeExistenceCheck(rule, sheetDataCache, prebuiltMaps);
                    break;
                case 'FIELD_COMPARISON':
                    ruleResult = this._executeFieldComparison(rule, sheetDataCache);
                    break;
                case 'INTERNAL_AUDIT':
                    ruleResult = this._executeInternalAudit(rule, sheetDataCache);
                    break;
                case 'ROW_COUNT_COMPARISON':
                    ruleResult = this._executeRowCountComparison(rule, sheetDataCache);
                    break;
                case 'SCHEMA_COMPARISON':
                    ruleResult = this._executeSchemaComparison(rule, sheetDataCache);
                    break;
                case 'DATA_COMPLETENESS':
                    ruleResult = this._executeDataCompleteness(rule, sheetDataCache);
                    break;
                case 'CROSS_CONDITION_CHECK':
                    ruleResult = this._executeCrossConditionCheck(rule, sheetDataCache);
                    break;
                case 'CROSS_EXISTENCE_CHECK':
                    ruleResult = this._executeCrossExistenceCheck(rule, sheetDataCache);
                    break;
                default:
                    logger.warn(serviceName, functionName, `Unhandled test_type: '${rule.test_type}' for rule: ${rule.on_failure_title}`);
            }
            if (ruleResult.quarantineTriggered) {
                quarantineTriggeredOverall = true;
            }
        } catch (e) {
            logger.error(serviceName, functionName, `Error executing rule '${rule.on_failure_title}': ${e.message}`, e);
            if (String(rule.on_failure_quarantine).toUpperCase() === 'TRUE') {
                quarantineTriggeredOverall = true;
            }
        }
    }
    return !quarantineTriggeredOverall;
  },

  /**
   * Compares the orders awaiting Comax export between jlmops and the legacy system.
   * This is a higher-level check than direct file comparison.
   */
  validateComaxExportConsistency() {
    const serviceName = 'ValidationService';
    const functionName = 'validateComaxExportConsistency';
    let report = [];

    try {
      // --- JLMops System ---
      const jlmopsDataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
      const sheetNames = ConfigService.getConfig('system.sheet_names');
      const jlmopsOrderLog = this.readSheetData(jlmopsDataSpreadsheetId, sheetNames.SysOrdLog);

      const jlmopsAwaitingExport = jlmopsOrderLog
        .filter(row => {
          const currentStatus = String(row.sol_OrderStatus || '').toLowerCase().trim();
          const notExported = !row.sol_ComaxExportTimestamp;
          return notExported && (currentStatus === 'processing' || currentStatus === 'completed');
        })
        .map(row => String(row.sol_OrderId));

      report.push('JLMops System:');
      report.push(`- Count: ${jlmopsAwaitingExport.length}`);
      if (jlmopsAwaitingExport.length > 0) {
        report.push(`- Orders: ${jlmopsAwaitingExport.join(', ')}`);
      }
      report.push(''); // Add a blank line for spacing


      // --- Legacy System ---
      const legacyOrdersM = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrdersM');
      const legacyOrderLog = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrderLog');

      const legacyStatusMap = new Map(legacyOrdersM.map(row => [
        String(row.order_id),
        String(row.status || '').toLowerCase().trim()
      ]));
      
      const legacyAwaitingExport = legacyOrderLog
        .filter(logRow => {
          const exportStatus = logRow.comax_export_status;
          if (exportStatus) { return false; } // Filter for null/empty

          const orderId = String(logRow.order_id);
          const currentStatus = legacyStatusMap.get(orderId);
          return currentStatus === 'processing' || currentStatus === 'completed';
        })
        .map(logRow => String(logRow.order_id));

      report.push('Legacy System:');
      report.push(`- Count: ${legacyAwaitingExport.length}`);
      if (legacyAwaitingExport.length > 0) {
        report.push(`- Orders: ${legacyAwaitingExport.join(', ')}`);
      }

    } catch (e) {
      const errorMessage = `Error during Comax Export data collection: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
    
    const finalReport = report.join('\n');
    logger.info(serviceName, functionName, finalReport.replace(/\n/g, ' | '));
    return finalReport;
  },

  /**
   * Compares the Comax order export from jlmops with the latest one from the legacy system.
   */
  validateComaxOrderExport() {
    // First, run the new high-level consistency check.
    const consistencyResult = this.validateComaxExportConsistency();

    // The direct file comparison below is disabled in favor of the order-level check above.
    // It was found to be unreliable if the export processes were not run at the exact same time.
    /*
    const jlmopsExportConfig = ConfigService.getConfig('system.folder.jlmops_exports');
    if (!jlmopsExportConfig || !jlmopsExportConfig.id) {
      throw new Error('Configuration "system.folder.jlmops_exports" is missing or incomplete in SysConfig. Please ensure SetupConfig.js is correct and rebuildSysConfigFromSource() has been run.');
    }
    const jlmopsFolderId = jlmopsExportConfig.id;
    const legacyFileNamePattern = /OrderEx-\d{2}-\d{2}-\d{2}-\d{2}\.csv/;
    const jlmopsFileNamePattern = /ComaxExport_\d{2}-\d{2}-\d{2}-\d{2}\.csv/; // Updated pattern for jlmops export
    const fileCompareResult = this._validateCsvExport(LEGACY_EXPORT_FOLDER_ID, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, 'Comax Order Export', 'SKU', ['Quantity']);
    */

    // Return the result of the new validation.
    return consistencyResult;
  },

  /**
   * Compares the web product update export from jlmops with the latest one from the legacy system.
   */
  validateWebProductUpdate() {
    const jlmopsExportConfig = ConfigService.getConfig('system.folder.jlmops_exports');
    if (!jlmopsExportConfig || !jlmopsExportConfig.id) {
      throw new Error('Configuration "system.folder.jlmops_exports" is missing or incomplete in SysConfig. Please ensure SetupConfig.js is correct and rebuildSysConfigFromSource() has been run.');
    }
    const jlmopsFolderId = jlmopsExportConfig.id;
    const legacyFileNamePattern = /ProductInventory-\d{2}-\d{2}-\d{2}-\d{2}\.csv/;
    const jlmopsFileNamePattern = /ProductInventory_\d{2}-\d{2}-\d{2}-\d{2}\.csv/;

    return this._validateCsvExport(LEGACY_EXPORT_FOLDER_ID, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, 'Web Product Update', 'SKU', ['Stock', 'Regular Price']);
  },

  /**
   * Orchestrates the validation of a CSV export.
   * @param {string} legacyFolderId
   * @param {RegExp} legacyFileNamePattern
   * @param {string} jlmopsFolderId
   * @param {RegExp} jlmopsFileNamePattern
   * @param {string} validationName
   * @param {string} keyColumn The name of the column to use as a primary key.
   * @param {Array<string>} columnsToCompare The names of the columns to compare.
   */
  _validateCsvExport(legacyFolderId, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, validationName, keyColumn, columnsToCompare) {
    const serviceName = 'ValidationService';
    const functionName = '_validateCsvExport';
    try {
      const legacyFile = this._getLatestFile(legacyFolderId, legacyFileNamePattern);
      const jlmopsFile = this._getLatestFile(jlmopsFolderId, jlmopsFileNamePattern);

      if (!legacyFile) {
        const message = `Validation skipped: No legacy file found for ${validationName}`;
        logger.info(serviceName, functionName, message);
        return message;
      }
      if (!jlmopsFile) {
        const message = `Validation skipped: No jlmops file found for ${validationName}`;
        logger.info(serviceName, functionName, message);
        return message;
      }

      const legacyContent = legacyFile.getBlob().getDataAsString();
      const jlmopsContent = jlmopsFile.getBlob().getDataAsString();

      return this._compareCsvData(legacyContent, jlmopsContent, validationName, keyColumn, columnsToCompare);

    } catch (e) {
      const errorMessage = `Error during ${validationName} validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Parses a CSV string into an array of objects.
   * @param {string} csvContent
   * @returns {Array<Object>}
   */
  _parseCsv(csvContent) {
    const rows = Utilities.parseCsv(csvContent);
    if (rows.length < 2) {
      return [];
    }
    const headers = rows[0];
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = rows[i][j];
      }
      data.push(row);
    }
    return data;
  },

  /**
   * Compares the data from two CSV files, independent of row order.
   * @param {string} legacyContent
   * @param {string} jlmopsContent
   * @param {string} validationName
   * @param {string} keyColumn
   * @param {Array<string>} columnsToCompare
   */
  _compareCsvData(legacyContent, jlmopsContent, validationName, keyColumn, columnsToCompare) {
    const serviceName = 'ValidationService';
    const functionName = '_compareCsvData';
    const legacyData = this._parseCsv(legacyContent);
    const jlmopsData = this._parseCsv(jlmopsContent);

    const legacyMap = new Map(legacyData.map(row => [row[keyColumn], row]));
    const jlmopsMap = new Map(jlmopsData.map(row => [row[keyColumn], row]));

    let discrepancies = [];

    for (const [key, legacyRow] of legacyMap.entries()) {
      const jlmopsRow = jlmopsMap.get(key);
      if (!jlmopsRow) {
        discrepancies.push(`Key ${key} from legacy file not found in jlmops file.`);
        continue;
      }

      for (const column of columnsToCompare) {
        if (legacyRow[column] !== jlmopsRow[column]) {
          discrepancies.push(`Key ${key}, Column ${column}: Legacy value '${legacyRow[column]}' differs from jlmops value '${jlmopsRow[column]}'.`);
        }
      }
    }

    for (const key of jlmopsMap.keys()) {
      if (!legacyMap.has(key)) {
        discrepancies.push(`Key ${key} from jlmops file not found in legacy file.`);
      }
    }

    if (discrepancies.length === 0) {
      const message = `${validationName} validation successful. Data is equivalent.`;
      logger.info(serviceName, functionName, message);
      return message;
    } else {
      const message = `${validationName} validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
      logger.info(serviceName, functionName, message.replace(/\n/g, ' ')); // Log as a single line
      return message;
    }
  },

  /**
   * Gets the latest file from a Google Drive folder that matches a pattern.
   * @param {string} folderId
   * @param {RegExp} fileNamePattern
   * @returns {GoogleAppsScript.Drive.File | null}
   */
  _getLatestFile(folderId, fileNamePattern) {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    let latestFile = null;
    let latestDate = new Date(0);

    while (files.hasNext()) {
      const file = files.next();
      if (fileNamePattern.test(file.getName())) {
        const dateModified = file.getLastUpdated();
        if (dateModified > latestDate) {
          latestFile = file;
          latestDate = dateModified;
        }
      }
    }
    return latestFile;
  },

  /**
   * Compares the highest order number between jlmops and the legacy system.
   */
  validateHighestOrderNumber() {
    const serviceName = 'ValidationService';
    const functionName = 'validateHighestOrderNumber';
    try {
      const legacyData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrdersM');
      const jlmopsData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebOrdM');

      const legacyOrderNumbers = legacyData.map(row => parseInt(row['order_number'])).filter(num => !isNaN(num));
      const jlmopsOrderNumbers = jlmopsData.map(row => parseInt(row.wom_OrderNumber)).filter(num => !isNaN(num));

      const maxLegacyOrderNumber = legacyOrderNumbers.length > 0 ? Math.max(...legacyOrderNumbers) : 0;
      const maxJlmopsOrderNumber = jlmopsOrderNumbers.length > 0 ? Math.max(...jlmopsOrderNumbers) : 0;

      let message;
      if (maxLegacyOrderNumber === maxJlmopsOrderNumber) {
        message = `Highest Order Number validation successful. Both systems report ${maxJlmopsOrderNumber}.`;
        logger.info(serviceName, functionName, message);
      } else {
        message = `Highest Order Number validation failed. Legacy: ${maxLegacyOrderNumber}, JLMops: ${maxJlmopsOrderNumber}.`;
        logger.info(serviceName, functionName, message);
      }
      return message;

    } catch (e) {
      const errorMessage = `Error during Highest Order Number validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Compares order statuses ('on-hold', 'processing') between jlmops and legacy.
   */
  validateOrderStatusMatch() {
    const serviceName = 'ValidationService';
    const functionName = 'validateOrderStatusMatch';
    try {
      const legacyData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrdersM');
      const jlmopsData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebOrdM');
      
      const statusesToCompare = ['on-hold', 'processing'];
      let discrepancies = [];

      for (const status of statusesToCompare) {
        const legacyOrders = new Set(legacyData.filter(row => row['status'] === status).map(row => row['order_number']));
        const jlmopsOrders = new Set(jlmopsData.filter(row => row['wom_Status'] === status).map(row => row.wom_OrderNumber));

        const legacyOnly = [...legacyOrders].filter(order => !jlmopsOrders.has(order));
        const jlmopsOnly = [...jlmopsOrders].filter(order => !legacyOrders.has(order));

        if (legacyOnly.length > 0) {
          discrepancies.push(`Status '${status}': Orders found only in legacy system: ${legacyOnly.join(', ')}.`);
        }
        if (jlmopsOnly.length > 0) {
          discrepancies.push(`Status '${status}': Orders found only in JLMops system: ${jlmopsOnly.join(', ')}.`);
        }
        if (legacyOnly.length === 0 && jlmopsOnly.length === 0) {
           discrepancies.push(`Status '${status}': Order lists match successfully.`);
        }
      }

      if (discrepancies.some(d => d.includes('only in'))) {
        const message = `Order Status validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' '));
        return message;
      } else {
        const message = `Order Status validation successful.\n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' '));
        return message;
      }

    } catch (e) {
      const errorMessage = `Error during Order Status validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Compares the prepared packing slip data between jlmops and the legacy system.
   */
  validatePackingSlipData() {
    const serviceName = 'ValidationService';
    const functionName = 'validatePackingSlipData';
    try {
      // 1. Read data from all sheets
      const legacyQueueData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'PackingQueue');
      const legacyRowsData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'PackingRows');
      const jlmopsCacheData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'SysPackingCache');

      // 2. Normalize Legacy Data
      const legacyOrders = new Map();
      for (const item of legacyRowsData) {
        const orderNumber = item['Order Number'];
        if (!legacyOrders.has(orderNumber)) {
          legacyOrders.set(orderNumber, []);
        }
        legacyOrders.get(orderNumber).push({
          sku: item.SKU,
          quantity: Number(item.Quantity)
        });
      }

      // 3. Normalize JLMops Data
      const jlmopsOrders = new Map();
      for (const item of jlmopsCacheData) {
        const orderId = item.spc_OrderId;
        if (!jlmopsOrders.has(orderId)) {
          jlmopsOrders.set(orderId, []);
        }
        jlmopsOrders.get(orderId).push({
          sku: item.spc_SKU,
          quantity: Number(item.spc_Quantity)
        });
      }
      
      // 4. Find order number to order ID map from legacy queue
      const orderNumberToIdMap = new Map(legacyQueueData.map(row => [row['Order Number'], row['order_id']]));

      // 5. Compare
      let discrepancies = [];
      for (const [legacyOrderNumber, legacyItems] of legacyOrders.entries()) {
        const jlmopsOrderId = orderNumberToIdMap.get(legacyOrderNumber);
        if (!jlmopsOrderId) {
            discrepancies.push(`Legacy Order Number ${legacyOrderNumber} not found in legacy PackingQueue.`);
            continue;
        }

        const jlmopsItems = jlmopsOrders.get(jlmopsOrderId);
        if (!jlmopsItems) {
          discrepancies.push(`Order ${jlmopsOrderId} (Legacy #${legacyOrderNumber}) found in legacy data but not in JLMops SysPackingCache.`);
          continue;
        }

        // Sort items by SKU for consistent comparison
        legacyItems.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
        jlmopsItems.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));

        if (legacyItems.length !== jlmopsItems.length) {
          discrepancies.push(`Order ${jlmopsOrderId}: Item count mismatch. Legacy: ${legacyItems.length}, JLMops: ${jlmopsItems.length}`);
          continue;
        }

        for (let i = 0; i < legacyItems.length; i++) {
          const legacyItem = legacyItems[i];
          const jlmopsItem = jlmopsItems[i];

          if (legacyItem.sku !== jlmopsItem.sku) {
            discrepancies.push(`Order ${jlmopsOrderId}: Item SKU mismatch at index ${i}. Legacy: ${legacyItem.sku}, JLMops: ${jlmopsItem.sku}`);
          } else if (legacyItem.quantity !== jlmopsItem.quantity) {
            discrepancies.push(`Order ${jlmopsOrderId}, SKU ${legacyItem.sku}: Quantity mismatch. Legacy: ${legacyItem.quantity}, JLMops: ${jlmopsItem.quantity}`);
          }
        }
         jlmopsOrders.delete(jlmopsOrderId); // Remove from map to track extra JLMops orders
      }

      // Check for any orders left in the jlmops map
      for (const orderId of jlmopsOrders.keys()) {
        discrepancies.push(`Order ${orderId} found in JLMops SysPackingCache but not in legacy data.`);
      }

      if (discrepancies.length === 0) {
        const message = 'Packing Slip Data validation successful. Data matches.';
        logger.info(serviceName, functionName, message);
        return message;
      } else {
        const message = `Packing Slip Data validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' ')); // Log as a single line
        return message;
      }

    } catch (e) {
      const errorMessage = `Error during Packing Slip Data validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  runValidationSuite(suiteName) {
    const serviceName = 'ValidationService';
    const functionName = 'runValidationSuite';
    LoggerService.info(serviceName, functionName, `Starting validation for suite: ${suiteName}`);
    const allConfig = ConfigService.getAllConfig();
    const validationRulesKeys = Object.keys(allConfig).filter(k => 
      k.startsWith('validation.rule.') && allConfig[k].validation_suite === suiteName && String(allConfig[k].enabled).toUpperCase() === 'TRUE'
    );
    LoggerService.info(serviceName, functionName, `Found ${validationRulesKeys.length} enabled rules for suite: ${suiteName}.`);

    if (validationRulesKeys.length === 0) return true; // No rules, so validation passes

    let quarantineTriggeredOverall = false;

    // --- 1. Pre-computation Step: Gather all required data and build all necessary maps ONCE ---
    const requiredSheets = new Set();
    const requiredMaps = new Map(); // Key: sheetName_by_keyColumn, Value: { sheet, keyColumn }

    validationRulesKeys.forEach(ruleKey => {
      const rule = allConfig[ruleKey];
      if(rule.source_sheet) requiredSheets.add(rule.source_sheet);
      if(rule.target_sheet) requiredSheets.add(rule.target_sheet);
      if(rule.sheet_A) requiredSheets.add(rule.sheet_A);
      if(rule.sheet_B) requiredSheets.add(rule.sheet_B);

      // For existence checks, identify the specific maps needed
      if (rule.test_type === 'EXISTENCE_CHECK') {
        requiredMaps.set(`${rule.source_sheet}_by_${rule.source_key}`, { sheet: rule.source_sheet, keyColumn: rule.source_key });
        requiredMaps.set(`${rule.target_sheet}_by_${rule.target_key}`, { sheet: rule.target_sheet, keyColumn: rule.target_key });
      } else if (rule.test_type === 'FIELD_COMPARISON') {
        requiredMaps.set(`${rule.sheet_A}_by_${rule.key_A}`, { sheet: rule.sheet_A, keyColumn: rule.key_A });
        requiredMaps.set(`${rule.sheet_B}_by_${rule.key_B}`, { sheet: rule.sheet_B, keyColumn: rule.key_B });
      }
    });

    const sheetDataCache = {};
    requiredSheets.forEach(sheetName => {
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema) {
            LoggerService.warn(serviceName, functionName, `Schema not found for required sheet: ${sheetName}. Skipping load.`);
            return;
        };
        const headers = schema.headers.split(',');
        const keyColumn = schema.key_column; // Extract key_column
        const sheetData = ConfigService._getSheetDataAsMap(sheetName, headers, keyColumn);
        if (sheetData) {
          sheetDataCache[sheetName] = sheetData;
        }
    });

    const prebuiltMaps = {};
    for (const [mapKey, { sheet, keyColumn }] of requiredMaps.entries()) {
        if (prebuiltMaps[mapKey]) continue; // Already built
        const data = sheetDataCache[sheet];
        if (data && data.values && data.headers) {
            prebuiltMaps[mapKey] = this.buildMapFromData(data.values, data.headers, keyColumn);
        } else {
             LoggerService.warn(serviceName, functionName, `Could not build map for ${mapKey}. Data not available for sheet ${sheet}.`);
        }
    }
    LoggerService.info(serviceName, functionName, `Pre-built ${Object.keys(prebuiltMaps).length} maps for validation.`);

    // --- 2. Execution Step: Run rules with pre-computed data ---
    for (const ruleKey of validationRulesKeys) {
      const rule = allConfig[ruleKey]; // Get the actual rule object
      LoggerService.info(serviceName, functionName, `Executing rule: ${rule.on_failure_title}`);
      try {
        let ruleResult = { status: 'UNKNOWN', message: 'Rule did not execute.', quarantineTriggered: false };
        switch (rule.test_type) {
          case 'EXISTENCE_CHECK':
            ruleResult = this._executeExistenceCheck(rule, sheetDataCache, prebuiltMaps);
            break;
          case 'FIELD_COMPARISON':
            ruleResult = this._executeFieldComparison(rule, sheetDataCache, prebuiltMaps);
            break;
          case 'INTERNAL_AUDIT':
            ruleResult = this._executeInternalAudit(rule, sheetDataCache);
            break;
          case 'ROW_COUNT_COMPARISON':
            ruleResult = this._executeRowCountComparison(rule, sheetDataCache);
            break;
          case 'SCHEMA_COMPARISON':
            ruleResult = this._executeSchemaComparison(rule, sheetDataCache);
            break;
          case 'DATA_COMPLETENESS':
            ruleResult = this._executeDataCompleteness(rule, sheetDataCache);
            break;
          case 'CROSS_CONDITION_CHECK':
            ruleResult = this._executeCrossConditionCheck(rule, sheetDataCache);
            break;
          case 'CROSS_EXISTENCE_CHECK':
            ruleResult = this._executeCrossExistenceCheck(rule, sheetDataCache);
            break;
          default:
            LoggerService.warn(serviceName, functionName, `Unhandled test_type: '${rule.test_type}' for rule: ${rule.on_failure_title}`);
        }
        
        if (ruleResult.quarantineTriggered) {
          LoggerService.warn(serviceName, functionName, `Rule '${rule.on_failure_title}' triggered a quarantine.`);
          quarantineTriggeredOverall = true;
        }

      } catch (e) {
        LoggerService.error(serviceName, functionName, `Error executing rule '${rule.on_failure_title}': ${e.message}`, e);
        // If a rule errors and it's marked for quarantine, trigger quarantine.
        if (String(rule.on_failure_quarantine).toUpperCase() === 'TRUE') {
            quarantineTriggeredOverall = true; 
        }
      }
    }
    return !quarantineTriggeredOverall; // Return true if validation passes (no quarantine), false if it fails
  },

  /**
   * Helper function to update job status in SysJobQueue.
   * This is a simplified version for ValidationService.
   * @param {number} rowNumber The row number in the SysJobQueue sheet for the current job.
   * @param {string} status The status to set (e.g., 'PROCESSING', 'COMPLETED', 'FAILED').
   * @param {string} [message=''] An optional error message.
   */
  updateJobStatus(rowNumber, status, message = '') {
    const serviceName = 'ValidationService';
    const functionName = '_updateJobStatus';
    try {
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
    } catch (e) {
      logger.error(serviceName, functionName, `Failed to update job status: ${e.message}`, e);
    }
  },

  runCriticalValidations(jobType, jobRowNumber) { // jobType and jobRowNumber are for logging/tracking, not direct use here
    const serviceName = 'ValidationService';
    const functionName = 'runCriticalValidations';
    LoggerService.info(serviceName, functionName, `Starting critical validation (master_master suite)`);

    let overallStatus = 'COMPLETED';
    let errorMessage = '';
    let results = [];

    try {
      const masterValidationResult = this._runMasterValidation(); // Call the modified function
      results = masterValidationResult.results;

      if (masterValidationResult.overallQuarantineTriggered) {
        overallStatus = 'FAILED'; // Or 'QUARANTINED' if more granular status is needed
        errorMessage = 'One or more master_master validation rules failed or triggered quarantine.';
        LoggerService.warn(serviceName, functionName, errorMessage);
      } else {
        LoggerService.info(serviceName, functionName, 'All master_master validation rules passed.');
      }

    } catch (e) {
      LoggerService.error(serviceName, functionName, `Error during critical validation orchestration: ${e.message}`, e);
      overallStatus = 'FAILED';
      errorMessage = `Orchestration failed: ${e.message}`;
    }
    
    // Return all necessary info
    return { overallStatus: overallStatus, errorMessage: errorMessage, results: results };
  },

  validateProductMasterData() {
    const serviceName = 'ValidationService';
    const functionName = 'validateProductMasterData';
    const results = [];
    
    try {
      // 1. Fetch Data
      const legacyWebMData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'WebM');
      const legacyWeHeData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'WeHe');
      const jlmopsProdMData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebProdM');
      const jlmopsXltMData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebXltM');

      // 2. Perform Product Count Comparison
      results.push(`Product Counts: Legacy (WebM) has ${legacyWebMData.length} products, JLMops (WebProdM) has ${jlmopsProdMData.length} products.`);

      // 3. Perform Translation Count Comparison
      results.push(`Translation Counts: Legacy (WeHe) has ${legacyWeHeData.length} translations, JLMops (WebXltM) has ${jlmopsXltMData.length} translations.`);

      // 4. Perform Product ID, SKU, and Description Matching Validation
      const jlmopsProdMap = new Map(jlmopsProdMData.map(row => [row.wpm_SKU, row]));
      const mismatches = [];

      for (const legacyProd of legacyWebMData) {
        const legacySku = legacyProd['SKU'];
        const legacyId = legacyProd['ID'];
        const legacyDesc = legacyProd['post_title']; // Assuming this is the English description column

        if (!jlmopsProdMap.has(legacySku)) {
          mismatches.push(`Legacy SKU '${legacySku}' (ID: ${legacyId}) not found in JLMops.`);
        } else {
          const jlmopsProd = jlmopsProdMap.get(legacySku);
          if (legacyId != jlmopsProd.wpm_WebIdEn) { // Use '!=' for potential type differences
            mismatches.push(`SKU '${legacySku}': Legacy ID '${legacyId}' does not match JLMops ID '${jlmopsProd.wpm_WebIdEn}'.`);
          }
          if (legacyDesc !== jlmopsProd.wpm_Description) {
            mismatches.push(`SKU '${legacySku}': Description mismatch. Legacy: "${legacyDesc}" | JLMops: "${jlmopsProd.wpm_Description}".`);
          }
        }
      }
      
      if (mismatches.length > 0) {
        results.push('ID/SKU/Description Mismatches Found:');
        results.push(...mismatches.map(m => `- ${m}`));
      } else {
        results.push('ID/SKU/Description Matching: All legacy SKUs, IDs, and Descriptions match JLMops.');
      }

      const message = `Product Master Data Validation Results:\n- ${results.join('\n- ')}`;
      logger.info(serviceName, functionName, message.replace(/\n/g, ' '));
      return message;

    } catch (e) {
      const errorMessage = `Error during Product Master Data validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },
};

// =================================================================
//  RUNNER FUNCTIONS (for execution from Apps Script Editor)
// =================================================================

function run_validateOnHoldInventory() {
  ValidationService.validateOnHoldInventory();
}

function run_validateComaxOrderExport() {
  ValidationService.validateComaxOrderExport();
}

function run_validateWebProductUpdate() {
  ValidationService.validateWebProductUpdate();
}

function run_validateHighestOrderNumber() {
  ValidationService.validateHighestOrderNumber();
}

function run_validateOrderStatusMatch() {
  ValidationService.validateOrderStatusMatch();
}

function run_validatePackingSlipData() {
  ValidationService.validatePackingSlipData();
}