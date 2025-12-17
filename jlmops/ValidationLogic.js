/**
 * @file ValidationLogic.js
 * @description Pure analysis engine for system validations. Returns results without side effects.
 */

const ValidationLogic = (function() {

  // =================================================================================
  // HELPER METHODS
  // =================================================================================

  function evaluateCondition(val1, operator, val2) {
      switch(operator) {
          case '<': return Number(val1) < Number(val2);
          case '>': return Number(val1) > Number(val2);
          case '=': return String(val1) === val2;
          case '<>': return String(val1) !== val2;
          case 'IS_EMPTY': return String(val1 || '').trim() === '';
          case 'IS_NOT_EMPTY': return String(val1 || '').trim() !== ''; 
          default: return false;
      }
  }

  function buildMapFromData(data, headers, keyHeader) {
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

  function formatString(template, dataRow) {
    if (!template) return '';
    return template.replace(/\${(.*?)}/g, (match, key) => {
      return dataRow[key.trim()] || '';
    });
  }

  function _extractName(row) {
      if (!row) return '';
      // Priority list of name columns
      const nameCols = ['cpm_NameHe', 'wdm_NameEn', 'wpm_NameEn', 'wps_Name', 'wxl_NameHe', 'Name', 'name', 'cps_NameHe'];
      for (const col of nameCols) {
          if (row[col]) return row[col];
      }
      return '';
  }

  // =================================================================================
  // VALIDATION EXECUTORS
  // =================================================================================

  function _executeExistenceCheck(rule, dataMaps, prebuiltMaps, sessionId) {
    const discrepancies = [];
    
    // Use pre-built maps for efficiency
    const sourceMapKey = `${rule.source_sheet}_by_${rule.source_key}`;
    const targetMapKey = `${rule.target_sheet}_by_${rule.target_key}`;

    const sourceMap = prebuiltMaps[sourceMapKey];
    const targetMap = prebuiltMaps[targetMapKey];

    if (!sourceMap || !targetMap) {
        return { 
            status: 'ERROR', 
            message: `Missing pre-built maps: ${sourceMapKey}, ${targetMapKey}`, 
            discrepancies: [] 
        };
    }

    for (const [key, sourceRow] of sourceMap.entries()) {
      const existsInTarget = targetMap.has(key);
      const shouldInvert = String(rule.invert_result).toUpperCase() === 'TRUE';
      const shouldFail = shouldInvert ? !existsInTarget : existsInTarget;

      if (shouldFail) {
        let passesFilter = true;
        if (rule.source_filter) {
            const [filterKey, filterValue] = rule.source_filter.split(',');
            if (sourceRow[filterKey] != filterValue) {
                passesFilter = false;
            }
        }
        if (passesFilter) {
            discrepancies.push({
                key: key,
                name: _extractName(sourceRow),
                details: `Item ${key} failed existence check.`,
                data: sourceRow
            });
        }
      }
    }

    return {
        status: discrepancies.length > 0 ? 'FAILED' : 'PASSED',
        message: discrepancies.length > 0 ? `${discrepancies.length} existence failures.` : 'Passed.',
        discrepancies: discrepancies
    };
  }

  function _executeFieldComparison(rule, dataMaps, prebuiltMaps, sessionId) {
      const discrepancies = [];
  
      const mapA = prebuiltMaps[`${rule.sheet_A}_by_${rule.key_A}`];
      const mapB = prebuiltMaps[`${rule.sheet_B}_by_${rule.key_B}`];
  
      if (!mapA || !mapB) {
          return { status: 'ERROR', message: 'Missing pre-built maps.', discrepancies: [] };
      }

      const [fieldA, fieldB] = rule.compare_fields.split(',');
      let logCount = 0;
  
      for (const [key, rowB] of mapB.entries()) {
          if (mapA.has(key)) {
              const rowA = mapA.get(key);

              // Source Filter Logic
              if (rule.source_filter) {
                  const [filterKey, filterValue] = rule.source_filter.split(',');
                  if (rowA.hasOwnProperty(filterKey) && String(rowA[filterKey]) !== String(filterValue)) {
                      continue;
                  }
              }
  
              let valueA = String(rowA[fieldA] || '').trim();
              let valueB = String(rowB[fieldB] || '').trim();
              const rawValueA = valueA;
              const rawValueB = valueB;

              // Helper to load map from config (JSON or LookupService)
              const getTranslationMap = (configValue) => {
                  if (!configValue) return null;
                  try {
                      // Try parsing as inline JSON first
                      const parsed = JSON.parse(configValue);
                      if (typeof parsed === 'object' && parsed !== null) {
                          return new Map(Object.entries(parsed));
                      }
                  } catch (e) {
                      // Not JSON, proceed to LookupService
                  }
                  // Fallback to named lookup map
                  const lookupMap = LookupService.getLookupMap(configValue);
                  if (!lookupMap && logCount < 1) {
                       logger.info('ValidationLogic', 'getTranslationMap', `Failed to load map for configValue: ${configValue}`, { sessionId: sessionId });
                  }
                  return lookupMap;
              };

              // Apply translation map for fieldA if defined in the rule (Dynamic lookup)
              const mapKeyA = `field_translations_map_${fieldA}`;
              if (rule[mapKeyA]) {
                  const translationMap = getTranslationMap(rule[mapKeyA]);
                  if (translationMap && translationMap.has(valueA)) {
                      valueA = translationMap.get(valueA);
                  }
              }
              // Apply translation map for fieldB if defined in the rule (Dynamic lookup)
              const mapKeyB = `field_translations_map_${fieldB}`;
              if (rule[mapKeyB]) {
                  const translationMap = getTranslationMap(rule[mapKeyB]);
                  if (translationMap && translationMap.has(valueB)) {
                      valueB = translationMap.get(valueB);
                  }
              }
  
              if (valueA !== valueB) {
                  discrepancies.push({
                      key: key,
                      name: _extractName(rowA) || _extractName(rowB),
                      details: `Mismatch: ${fieldA}('${valueA}') vs ${fieldB}('${valueB}')`,
                      data: { ...rowA, ...rowB }
                  });
              }
          }
      }
  
      return {
          status: discrepancies.length > 0 ? 'FAILED' : 'PASSED',
          message: discrepancies.length > 0 ? `${discrepancies.length} mismatches found.` : 'Passed.',
          discrepancies: discrepancies
      };
  }

  // Implement other executors similarly (_executeInternalAudit, etc.)
  // For the shadow phase, implementing the core ones (Existence, Field) is enough to prove the concept.
  // I will include a placeholder for others to ensure the structure is complete.

  function _executeSchemaComparison(rule, dataMaps, prebuiltMaps, sessionId) {
    const discrepancies = [];
    const allConfig = ConfigService.getAllConfig();

    const sourceSchema = allConfig[rule.source_schema];
    const targetSchema = allConfig[rule.target_schema];

    if (!sourceSchema || !targetSchema || !sourceSchema.headers || !targetSchema.headers) {
        return { status: 'ERROR', message: `Schema config missing for ${rule.on_failure_title}`, discrepancies: [] };
    }

    const sourceSchemaHeaders = sourceSchema.headers.split(',');
    const targetSchemaHeaders = targetSchema.headers.split(',');

    const missingColumns = sourceSchemaHeaders.filter(header => !targetSchemaHeaders.includes(header));

    if (missingColumns.length > 0) {
        discrepancies.push({
            key: 'SCHEMA',
            name: 'System',
            details: `Missing columns in target schema: ${missingColumns.join(', ')}`
        });
    }
    
    return {
        status: discrepancies.length > 0 ? 'FAILED' : 'PASSED',
        message: discrepancies.length > 0 ? `Schema mismatch found.` : 'Passed.',
        discrepancies: discrepancies
    };
  }

  function _executeRowCountComparison(rule, dataMaps, prebuiltMaps, sessionId) {
    const discrepancies = [];
    
    // dataMaps is sheetDataCache passed from runValidationSuite
    const sourceSheetData = dataMaps[rule.source_sheet];
    const targetSheetData = dataMaps[rule.target_sheet];

    if (!sourceSheetData || !targetSheetData) {
        return { status: 'ERROR', message: `Sheet data missing for ${rule.on_failure_title}`, discrepancies: [] };
    }

    // values include header row, so count is length
    const sourceRowCount = sourceSheetData.values.length;
    const targetRowCount = targetSheetData.values.length;

    if (targetRowCount < sourceRowCount) {
        discrepancies.push({
            key: 'ROW_COUNT',
            name: 'System',
            details: `Row count mismatch: Source (${sourceRowCount}) > Target (${targetRowCount}).`
        });
    }
    
    return {
        status: discrepancies.length > 0 ? 'FAILED' : 'PASSED',
        message: discrepancies.length > 0 ? `Row count decrease detected.` : 'Passed.',
        discrepancies: discrepancies
    };
  }

  function _executeDataCompleteness(rule, dataMaps, prebuiltMaps, sessionId) {
    const discrepancies = [];
    const sourceSheetData = dataMaps[rule.source_sheet];
    
    if (!sourceSheetData) return { status: 'ERROR', message: `Sheet data missing`, discrepancies: [] };

    const sourceSheetHeaders = sourceSheetData.headers; // Array of headers
    const sourceSheetValues = sourceSheetData.values;   // 2D array, row 0 is headers

    // Iterate through data (starting from row 1)
    for (let i = 1; i < sourceSheetValues.length; i++) { 
      const row = sourceSheetValues[i];
      // Build rowObj for context
      const rowObj = {};
      sourceSheetHeaders.forEach((h, k) => rowObj[h] = row[k]);

      for (let j = 0; j < row.length; j++) {
        if (sourceSheetHeaders[j] && (row[j] === null || String(row[j]).trim() === '')) {
          discrepancies.push({
              key: `Row ${i + 1}`,
              name: _extractName(rowObj), // Updated to use rowObj
              details: `Empty cell in column '${sourceSheetHeaders[j]}'.`,
              data: rowObj
          });
        }
      }
    }
    
    return {
        status: discrepancies.length > 0 ? 'FAILED' : 'PASSED',
        message: discrepancies.length > 0 ? `${discrepancies.length} empty cells found.` : 'Passed.',
        discrepancies: discrepancies
    };
  }

  function _executeInternalAudit(rule, dataMaps, prebuiltMaps, sessionId) {
    const discrepancies = [];
    const sourceSheetData = dataMaps[rule.source_sheet];
    
    if (!sourceSheetData) return { status: 'ERROR', message: `Sheet data missing`, discrepancies: [] };

    // We need a map to iterate with keys, or just iterate rows.
    // The rule likely expects to identify items by key.
    // prebuiltMaps should have the source map if configured correctly.
    // But INTERNAL_AUDIT might not define a key in the rule config?
    // Let's check validation.json logic. Usually it iterates source_sheet.
    
    // Using the raw values and converting to objects for condition evaluation
    const headers = sourceSheetData.headers;
    const values = sourceSheetData.values;
    
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

    const fieldIdx = headers.indexOf(field);
    const field2Idx = field2 ? headers.indexOf(field2) : -1;
    
    // We need a key column to report. Try common keys or rule.source_key if exists.
    // If rule.source_key exists, use it.
    const keyColName = rule.source_key || headers[0];
    const keyIdx = headers.indexOf(keyColName);

    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowObj = {}; 
        headers.forEach((h, k) => rowObj[h] = row[k]);
        
        const val1_part1 = row[fieldIdx];
        const result_part1 = evaluateCondition(val1_part1, operator, value);
        let conditionMet = result_part1;

        if (conditionMet && logic === 'AND') {
            const val1_part2 = row[field2Idx];
            const result_part2 = evaluateCondition(val1_part2, op2, val2);
            conditionMet = conditionMet && result_part2;
        }

        if (conditionMet) {
            const key = (keyIdx > -1) ? row[keyIdx] : `Row ${i+1}`;
            
            discrepancies.push({
                key: key,
                name: _extractName(rowObj),
                details: `Internal Audit failed: ${rule.condition}`,
                data: rowObj
            });
        }
    }

    return {
        status: discrepancies.length > 0 ? 'FAILED' : 'PASSED',
        message: discrepancies.length > 0 ? `${discrepancies.length} items failed audit.` : 'Passed.',
        discrepancies: discrepancies
    };
  }

  function _executeGeneric(rule, sessionId) {
      return { status: 'SKIPPED', message: `Executor for ${rule.test_type} not yet implemented in ValidationLogic.`, discrepancies: [] };
  }

  // =================================================================================
  // MAIN ENTRY POINT
  // =================================================================================

  function runValidationSuite(suiteName, sessionId) {
    const serviceName = 'ValidationLogic';
    const functionName = 'runValidationSuite';
    logger.info(serviceName, functionName, `Starting analysis for suite: ${suiteName}`, { sessionId: sessionId });
    
    ConfigService.forceReload(); // Force reload to ensure latest rules are used
    const allConfig = ConfigService.getAllConfig();
    const rules = Object.keys(allConfig)
        .filter(k => k.startsWith('validation.rule.') && allConfig[k].validation_suite === suiteName && String(allConfig[k].enabled).toUpperCase() === 'TRUE')
        .map(k => allConfig[k]);

    if (rules.length === 0) return { success: true, results: [] };

    // --- Pre-computation (Maps) ---
    const requiredMaps = new Map();
    const requiredSheets = new Set();

    rules.forEach(rule => {
        if (rule.source_sheet) requiredSheets.add(rule.source_sheet);
        if (rule.target_sheet) requiredSheets.add(rule.target_sheet);
        if (rule.sheet_A) requiredSheets.add(rule.sheet_A);
        if (rule.sheet_B) requiredSheets.add(rule.sheet_B);

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
        if (schema) {
            const headers = schema.headers.split(',');
            sheetDataCache[sheetName] = ConfigService._getSheetDataAsMap(sheetName, headers, schema.key_column);
        }
    });

    const prebuiltMaps = {};
    for (const [mapKey, { sheet, keyColumn }] of requiredMaps.entries()) {
        const data = sheetDataCache[sheet];
        if (data) {
            prebuiltMaps[mapKey] = buildMapFromData(data.values, data.headers, keyColumn);
        }
    }

    // --- Execution ---
    const results = [];
    const totalRules = rules.length;

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];

        // Validation progress is logged to SysLog, not SyncStatus
        // Step 4 status is managed by ValidationOrchestratorService (start/complete only)

        let result;
        try {
            switch (rule.test_type) {
                case 'EXISTENCE_CHECK':
                    result = _executeExistenceCheck(rule, sheetDataCache, prebuiltMaps, sessionId);
                    break;
                case 'FIELD_COMPARISON':
                    result = _executeFieldComparison(rule, sheetDataCache, prebuiltMaps, sessionId);
                    break;
                case 'ROW_COUNT_COMPARISON':
                    result = _executeRowCountComparison(rule, sheetDataCache, prebuiltMaps, sessionId);
                    break;
                case 'SCHEMA_COMPARISON':
                    result = _executeSchemaComparison(rule, sheetDataCache, prebuiltMaps, sessionId);
                    break;
                case 'DATA_COMPLETENESS':
                    result = _executeDataCompleteness(rule, sheetDataCache, prebuiltMaps, sessionId);
                    break;
                case 'INTERNAL_AUDIT':
                    result = _executeInternalAudit(rule, sheetDataCache, prebuiltMaps, sessionId);
                    break;
                default:
                    result = _executeGeneric(rule, sessionId);
            }
        } catch (e) {
            result = { status: 'ERROR', message: e.message, discrepancies: [] };
            logger.error(serviceName, functionName, `Error executing rule ${rule.on_failure_title}: ${e.message}`, e, { sessionId: sessionId });
        }

        results.push({
            rule: rule,
            status: result.status,
            message: result.message,
            discrepancies: result.discrepancies
        });
    }

    return { success: true, results: results };
  }

  function validateDatabaseSchema(sessionId) {
      const serviceName = 'ValidationLogic';
      const functionName = 'validateDatabaseSchema';
      logger.info(serviceName, functionName, `Starting database schema validation.`, { sessionId: sessionId });

      const allConfig = ConfigService.getAllConfig();
      const discrepancies = [];

      const dataSpreadsheetId = allConfig['system.spreadsheet.data']?.id;
      const logSpreadsheetId = allConfig['system.spreadsheet.logs']?.id;

      if (!dataSpreadsheetId || !logSpreadsheetId) {
          throw new Error("Spreadsheet IDs for 'JLMops_Data' or 'JLMops_Logs' not found in SysConfig.");
      }

      const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
      const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);

      const sheetSchemas = Object.keys(allConfig).filter(key => 
          key.startsWith('schema.data.') || key.startsWith('schema.log.')
      );

      for (const schemaKey of sheetSchemas) {
          const schema = allConfig[schemaKey];
          const sheetName = schemaKey.replace('schema.data.', '').replace('schema.log.', '');

          if (!schema || !schema.headers) {
              discrepancies.push({
                  sheet: sheetName,
                  issue: `Schema definition missing 'headers' property in SysConfig.`,
                  severity: 'ERROR',
                  details: `Config key: ${schemaKey}`
              });
              continue;
          }

          const expectedHeaders = schema.headers.split(',').map(h => h.trim());

          let targetSpreadsheet;
          if (schemaKey.startsWith('schema.data.')) {
              targetSpreadsheet = dataSpreadsheet;
          } else if (schemaKey.startsWith('schema.log.')) {
              targetSpreadsheet = logSpreadsheet;
          } else {
              continue; 
          }

          const sheet = targetSpreadsheet.getSheetByName(sheetName);
          if (!sheet) {
              discrepancies.push({
                  sheet: sheetName,
                  issue: `Sheet not found in spreadsheet '${targetSpreadsheet.getName()}'.`,
                  severity: 'CRITICAL',
                  details: `Expected sheet name: ${sheetName}`
              });
              continue;
          }
          
          const actualHeadersRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
          const actualHeaders = actualHeadersRange.getValues()[0].filter(h => h !== '').map(h => h.trim());

          const missingHeaders = expectedHeaders.filter(header => !actualHeaders.includes(header));
          if (missingHeaders.length > 0) {
              discrepancies.push({
                  sheet: sheetName,
                  issue: `Missing expected headers in sheet.`,
                  severity: 'CRITICAL',
                  details: `Missing: ${missingHeaders.join(', ')}`
              });
          }

          const extraHeaders = actualHeaders.filter(header => !expectedHeaders.includes(header));
          if (extraHeaders.length > 0) {
              discrepancies.push({
                  sheet: sheetName,
                  issue: `Extra headers found in sheet.`,
                  severity: 'WARNING',
                  details: `Extra: ${extraHeaders.join(', ')}`
              });
          }

          if (missingHeaders.length === 0 && extraHeaders.length === 0) {
              const orderMismatch = expectedHeaders.some((header, index) => header !== actualHeaders[index]);
              if (orderMismatch) {
                  discrepancies.push({
                      sheet: sheetName,
                      issue: `Header order mismatch.`,
                      severity: 'WARNING',
                      details: `Expected order: [${expectedHeaders.join(', ')}], Actual order: [${actualHeaders.join(', ')}]`
                  });
              }
          }
      }

      const status = discrepancies.length > 0 ? 'FAILED' : 'PASSED';
      const message = discrepancies.length > 0 ? `${discrepancies.length} schema discrepancies found.` : 'All sheet schemas are valid.';
      logger.info(serviceName, functionName, message, { sessionId: sessionId, details: discrepancies });

      return {
          status: status,
          message: message,
          discrepancies: discrepancies
      };
  }

  return {
    runValidationSuite: runValidationSuite,
    validateDatabaseSchema: validateDatabaseSchema // Expose the new function
  };

})();

/**
 * Public function to be called from the UI to validate all sheet schemas.
 * @returns {object} The result object from validateDatabaseSchema.
 */
function validateDatabaseSchemaFromUI() {
    try {
        const sessionId = 'UI_SchemaValidation_' + Date.now(); // Generate a simple session ID for UI calls
        return ValidationLogic.validateDatabaseSchema(sessionId);
    } catch (error) {
        console.error('Error validating database schema from UI: ' + error.message);
        return {
            status: 'ERROR',
            message: 'Failed to validate schema: ' + error.message,
            discrepancies: []
        };
    }
}