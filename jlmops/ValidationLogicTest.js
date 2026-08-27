/**
 * @file ValidationLogicTest.js
 * @description Unit tests for ValidationLogic's pure helper functions -- Tier 1
 * of `jlmops/plans/TEST_SUITE_EXTENSION_PLAN.md`. `evaluateCondition`'s tests
 * lock in Bug I4 (boolean-vs-string TRUE/'TRUE' mismatch that silently
 * disabled 3 CRM audit rules) so a regression there fails loudly.
 */
const ValidationLogicTest = (function() {

  function run() {
    const suiteName = 'ValidationLogicTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }

    // --- evaluateCondition: '=' / '<>' (Bug I4 lock-in) ---
    try {
      TestRunner.assert(ValidationLogic.evaluateCondition(true, '=', 'TRUE'), 'boolean true should equal string TRUE (case/type-insensitive)');
      TestRunner.assert(!ValidationLogic.evaluateCondition(true, '<>', 'TRUE'), 'boolean true should not be <> string TRUE');
      TestRunner.assert(ValidationLogic.evaluateCondition(false, '=', 'FALSE'), 'boolean false should equal string FALSE');
      log('evaluateCondition: boolean vs string TRUE/FALSE (I4)', true);
    } catch (e) { log('evaluateCondition: boolean vs string TRUE/FALSE (I4)', false, e); }

    // --- evaluateCondition: numeric and string operators ---
    try {
      TestRunner.assert(ValidationLogic.evaluateCondition(5, '<', 10), '5 < 10');
      TestRunner.assert(ValidationLogic.evaluateCondition(10, '>', 5), '10 > 5');
      TestRunner.assert(ValidationLogic.evaluateCondition('', 'IS_EMPTY', null), 'empty string IS_EMPTY');
      TestRunner.assert(ValidationLogic.evaluateCondition('x', 'IS_NOT_EMPTY', null), 'non-empty IS_NOT_EMPTY');
      TestRunner.assert(ValidationLogic.evaluateCondition('Hello World', 'CONTAINS', 'world'), 'CONTAINS is case-insensitive');
      TestRunner.assert(!ValidationLogic.evaluateCondition('Hello', 'CONTAINS', 'world'), 'CONTAINS false when absent');
      TestRunner.assert(ValidationLogic.evaluateCondition('prefix-x', 'STARTS_WITH', 'prefix'), 'STARTS_WITH');
      TestRunner.assert(ValidationLogic.evaluateCondition('unknown-op', 'BOGUS_OP', 'x') === false, 'unrecognized operator returns false, not throw');
      log('evaluateCondition: numeric/string operators', true);
    } catch (e) { log('evaluateCondition: numeric/string operators', false, e); }

    // --- buildMapFromData ---
    try {
      const headers = ['sku', 'name', 'stock'];
      const data = [['A1', 'Wine A', '5'], ['B2', 'Wine B', '0'], ['', 'No key', '1']];
      const map = ValidationLogic.buildMapFromData(data, headers, 'sku');
      TestRunner.assertEqual(map.size, 2, 'blank-key row is skipped');
      TestRunner.assertEqual(map.get('A1').name, 'Wine A', 'row object built with header keys');
      TestRunner.assertEqual(map.get('B2').stock, '0', 'zero-value cell preserved');
      log('buildMapFromData: keys rows, skips blank keys', true);
    } catch (e) { log('buildMapFromData: keys rows, skips blank keys', false, e); }

    try {
      ValidationLogic.buildMapFromData([['x']], ['a'], 'missing_header');
      log('buildMapFromData: throws on missing key header', false, new Error('did not throw'));
    } catch (e) { log('buildMapFromData: throws on missing key header', true); }

    // --- formatString ---
    try {
      TestRunner.assertEqual(ValidationLogic.formatString('Hello ${name}, stock: ${stock}', { name: 'Wine A', stock: 5 }), 'Hello Wine A, stock: 5', 'substitutes known keys');
      TestRunner.assertEqual(ValidationLogic.formatString('Missing: ${nope}', {}), 'Missing: ', 'unknown key substitutes empty string, not "undefined"');
      TestRunner.assertEqual(ValidationLogic.formatString('', { a: 1 }), '', 'empty template returns empty string');
      TestRunner.assertEqual(ValidationLogic.formatString(null, { a: 1 }), '', 'null template returns empty string, not throw');
      log('formatString: substitution and edge cases', true);
    } catch (e) { log('formatString: substitution and edge cases', false, e); }

    // --- extractName ---
    try {
      TestRunner.assertEqual(ValidationLogic.extractName({ cpm_NameHe: 'יין' }), 'יין', 'first priority column wins');
      TestRunner.assertEqual(ValidationLogic.extractName({ wpm_PostTitle: 'Wine A' }), 'Wine A', 'falls through priority list');
      TestRunner.assertEqual(ValidationLogic.extractName({}), '', 'no matching column returns empty string');
      TestRunner.assertEqual(ValidationLogic.extractName(null), '', 'null row returns empty string, not throw');
      log('extractName: priority list and fallback', true);
    } catch (e) { log('extractName: priority list and fallback', false, e); }

    // --- rowPassesFilter ---
    try {
      TestRunner.assert(ValidationLogic.rowPassesFilter(null, { any: 'x' }), 'no filter spec always passes');
      TestRunner.assert(ValidationLogic.rowPassesFilter('wpm_Stock,!0', { wpm_Stock: '5' }), 'inverted filter: non-zero stock passes');
      TestRunner.assert(!ValidationLogic.rowPassesFilter('wpm_Stock,!0', { wpm_Stock: '0' }), 'inverted filter: zero stock (string "0") is excluded, not coerced to empty');
      TestRunner.assert(!ValidationLogic.rowPassesFilter('wpm_Stock,!0', { wpm_Stock: 0 }), 'inverted filter: numeric 0 is excluded too (nullish coalesce, not ||)');
      TestRunner.assert(ValidationLogic.rowPassesFilter('a,1;b,2', { a: '1', b: '2' }), 'AND-combined conditions all match');
      TestRunner.assert(!ValidationLogic.rowPassesFilter('a,1;b,2', { a: '1', b: 'X' }), 'AND-combined conditions: one mismatch fails the row');
      log('rowPassesFilter: inversion and zero-value handling', true);
    } catch (e) { log('rowPassesFilter: inversion and zero-value handling', false, e); }

    // --- executeExistenceCheck (Tier 2) ---
    try {
      const prebuiltMaps = {
        'SrcSheet_by_sku': new Map([
          ['A1', { sku: 'A1', wpm_Stock: '5' }],
          ['A2', { sku: 'A2', wpm_Stock: '0' }]
        ]),
        'TgtSheet_by_sku': new Map([['A1', { sku: 'A1' }]])
      };
      const rule = { source_sheet: 'SrcSheet', source_key: 'sku', target_sheet: 'TgtSheet', target_key: 'sku', invert_result: 'TRUE' };
      const result = ValidationLogic.executeExistenceCheck(rule, {}, prebuiltMaps, 'test-session');
      TestRunner.assertEqual(result.status, 'FAILED', 'invert_result=TRUE flags source keys missing from target');
      TestRunner.assertEqual(result.discrepancies.length, 1, 'only A2 (missing from target) is a discrepancy');
      TestRunner.assertEqual(result.discrepancies[0].key, 'A2', 'discrepancy key is the missing source key');
      log('executeExistenceCheck: invert_result=TRUE flags missing-from-target', true);
    } catch (e) { log('executeExistenceCheck: invert_result=TRUE flags missing-from-target', false, e); }

    try {
      const prebuiltMaps = {
        'SrcSheet_by_sku': new Map([['A1', { sku: 'A1' }]]),
        'TgtSheet_by_sku': new Map([['A1', { sku: 'A1' }]])
      };
      const rule = { source_sheet: 'SrcSheet', source_key: 'sku', target_sheet: 'TgtSheet', target_key: 'sku' };
      const result = ValidationLogic.executeExistenceCheck(rule, {}, prebuiltMaps, 'test-session');
      TestRunner.assertEqual(result.status, 'FAILED', 'default (non-inverted): key present in target is a discrepancy');
      log('executeExistenceCheck: default (non-inverted) flags present-in-target', true);
    } catch (e) { log('executeExistenceCheck: default (non-inverted) flags present-in-target', false, e); }

    try {
      const prebuiltMaps = {
        'SrcSheet_by_sku': new Map([
          ['A1', { sku: 'A1', wpm_Stock: '0' }],
          ['A2', { sku: 'A2', wpm_Stock: '5' }]
        ]),
        'TgtSheet_by_sku': new Map()
      };
      const rule = { source_sheet: 'SrcSheet', source_key: 'sku', target_sheet: 'TgtSheet', target_key: 'sku', invert_result: 'TRUE', source_filter: 'wpm_Stock,!0' };
      const result = ValidationLogic.executeExistenceCheck(rule, {}, prebuiltMaps, 'test-session');
      TestRunner.assertEqual(result.discrepancies.length, 1, 'source_filter excludes the zero-stock row from discrepancies');
      TestRunner.assertEqual(result.discrepancies[0].key, 'A2', 'only the non-zero-stock row is reported');
      log('executeExistenceCheck: source_filter narrows discrepancies', true);
    } catch (e) { log('executeExistenceCheck: source_filter narrows discrepancies', false, e); }

    try {
      const result = ValidationLogic.executeExistenceCheck({ source_sheet: 'Missing', source_key: 'sku', target_sheet: 'AlsoMissing', target_key: 'sku' }, {}, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'ERROR', 'missing prebuilt maps returns ERROR, not throw');
      log('executeExistenceCheck: missing prebuilt maps -> ERROR', true);
    } catch (e) { log('executeExistenceCheck: missing prebuilt maps -> ERROR', false, e); }

    // --- executeFieldComparison (Tier 2) -- fixtures deliberately never set a
    // field_translations_map_* rule key, so the LookupService.getLookupMap I/O
    // escape hatch (see TEST_SUITE_EXTENSION_PLAN.md Tier 2 caveat) is never hit. ---
    try {
      const prebuiltMaps = {
        'SheetA_by_sku': new Map([
          ['A1', { sku: 'A1', priceA: '100' }],
          ['A2', { sku: 'A2', priceA: '50' }]
        ]),
        'SheetB_by_sku': new Map([
          ['A1', { sku: 'A1', priceB: '100' }],
          ['A2', { sku: 'A2', priceB: '55' }]
        ])
      };
      const rule = { sheet_A: 'SheetA', key_A: 'sku', sheet_B: 'SheetB', key_B: 'sku', compare_fields: 'priceA,priceB' };
      const result = ValidationLogic.executeFieldComparison(rule, {}, prebuiltMaps, 'test-session');
      TestRunner.assertEqual(result.status, 'FAILED', 'field mismatch produces FAILED');
      TestRunner.assertEqual(result.discrepancies.length, 1, 'only the mismatched key (A2) is a discrepancy');
      TestRunner.assertEqual(result.discrepancies[0].key, 'A2', 'discrepancy key is the mismatched row key');
      log('executeFieldComparison: mismatch detected (no translation map)', true);
    } catch (e) { log('executeFieldComparison: mismatch detected (no translation map)', false, e); }

    try {
      const prebuiltMaps = {
        'SheetA_by_sku': new Map([['A1', { sku: 'A1', priceA: '100' }]]),
        'SheetB_by_sku': new Map([['A1', { sku: 'A1', priceB: '100' }]])
      };
      const rule = { sheet_A: 'SheetA', key_A: 'sku', sheet_B: 'SheetB', key_B: 'sku', compare_fields: 'priceA,priceB' };
      const result = ValidationLogic.executeFieldComparison(rule, {}, prebuiltMaps, 'test-session');
      TestRunner.assertEqual(result.status, 'PASSED', 'matching fields produce PASSED');
      log('executeFieldComparison: matching fields -> PASSED', true);
    } catch (e) { log('executeFieldComparison: matching fields -> PASSED', false, e); }

    try {
      const result = ValidationLogic.executeFieldComparison({ sheet_A: 'X', key_A: 'k', sheet_B: 'Y', key_B: 'k', compare_fields: 'a,b' }, {}, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'ERROR', 'missing prebuilt maps returns ERROR, not throw');
      log('executeFieldComparison: missing prebuilt maps -> ERROR', true);
    } catch (e) { log('executeFieldComparison: missing prebuilt maps -> ERROR', false, e); }

    // --- executeSchemaComparison (Tier 2) -- unlike the other Tier 2 functions,
    // this one calls ConfigService.getAllConfig() (real, read-only config I/O),
    // not just prebuiltMaps/dataMaps. Only the guard-clause path is tested here,
    // via a schema key that cannot exist in live config -- the missing-columns
    // comparison logic itself needs a config mock to test without a fixture that
    // silently depends on live schema content, so it stays untested (named here
    // per the plan's own "name the gap" rule; see the _executeFieldComparison
    // caveat above for precedent). ---
    try {
      const rule = { source_schema: '__nonexistent_schema_key__', target_schema: '__also_nonexistent__', on_failure_title: 'Test Rule' };
      const result = ValidationLogic.executeSchemaComparison(rule, {}, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'ERROR', 'schema key absent from live config returns ERROR, not throw');
      log('executeSchemaComparison: missing schema config -> ERROR (guard path only)', true);
    } catch (e) { log('executeSchemaComparison: missing schema config -> ERROR (guard path only)', false, e); }

    // --- executeRowCountComparison (Tier 2) ---
    try {
      const dataMaps = {
        SourceSheet: { values: [['a'], ['b'], ['c']] },
        TargetSheet: { values: [['a'], ['b']] }
      };
      const rule = { source_sheet: 'SourceSheet', target_sheet: 'TargetSheet', on_failure_title: 'Row Count' };
      const result = ValidationLogic.executeRowCountComparison(rule, dataMaps, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'FAILED', 'target row count below source row count fails');
      log('executeRowCountComparison: target count decrease -> FAILED', true);
    } catch (e) { log('executeRowCountComparison: target count decrease -> FAILED', false, e); }

    try {
      const dataMaps = {
        SourceSheet: { values: [['a'], ['b']] },
        TargetSheet: { values: [['a'], ['b'], ['c']] }
      };
      const rule = { source_sheet: 'SourceSheet', target_sheet: 'TargetSheet', on_failure_title: 'Row Count' };
      const result = ValidationLogic.executeRowCountComparison(rule, dataMaps, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'PASSED', 'target row count at or above source passes');
      log('executeRowCountComparison: target count steady/increased -> PASSED', true);
    } catch (e) { log('executeRowCountComparison: target count steady/increased -> PASSED', false, e); }

    try {
      const result = ValidationLogic.executeRowCountComparison({ source_sheet: 'Missing', target_sheet: 'AlsoMissing', on_failure_title: 'x' }, {}, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'ERROR', 'missing sheet data returns ERROR, not throw');
      log('executeRowCountComparison: missing sheet data -> ERROR', true);
    } catch (e) { log('executeRowCountComparison: missing sheet data -> ERROR', false, e); }

    // --- executeDataCompleteness (Tier 2) ---
    try {
      const dataMaps = {
        SourceSheet: {
          headers: ['sku', 'name'],
          values: [
            ['sku', 'name'],
            ['A1', 'Wine A'],
            ['A2', '']
          ]
        }
      };
      const result = ValidationLogic.executeDataCompleteness({ source_sheet: 'SourceSheet' }, dataMaps, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'FAILED', 'an empty cell fails the completeness check');
      TestRunner.assertEqual(result.discrepancies.length, 1, 'only the row with the empty cell is reported');
      log('executeDataCompleteness: empty cell -> FAILED', true);
    } catch (e) { log('executeDataCompleteness: empty cell -> FAILED', false, e); }

    try {
      const dataMaps = {
        SourceSheet: {
          headers: ['sku', 'name'],
          values: [
            ['sku', 'name'],
            ['A1', 'Wine A'],
            ['A2', 'Wine B']
          ]
        }
      };
      const result = ValidationLogic.executeDataCompleteness({ source_sheet: 'SourceSheet' }, dataMaps, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'PASSED', 'no empty cells passes');
      log('executeDataCompleteness: no empty cells -> PASSED', true);
    } catch (e) { log('executeDataCompleteness: no empty cells -> PASSED', false, e); }

    try {
      const result = ValidationLogic.executeDataCompleteness({ source_sheet: 'Missing' }, {}, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'ERROR', 'missing sheet data returns ERROR, not throw');
      log('executeDataCompleteness: missing sheet data -> ERROR', true);
    } catch (e) { log('executeDataCompleteness: missing sheet data -> ERROR', false, e); }

    // --- executeInternalAudit (Tier 2) ---
    try {
      const dataMaps = {
        SourceSheet: {
          headers: ['sku', 'wpm_Stock', 'wpm_Status'],
          values: [
            ['sku', 'wpm_Stock', 'wpm_Status'],
            ['A1', '0', 'Active'],
            ['A2', '5', 'Active'],
            ['A3', '0', 'Draft']
          ]
        }
      };
      const rule = { source_sheet: 'SourceSheet', source_key: 'sku', condition: 'wpm_Stock,=,0,AND,wpm_Status,=,Active' };
      const result = ValidationLogic.executeInternalAudit(rule, dataMaps, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'FAILED', 'AND-combined condition match fails the audit');
      TestRunner.assertEqual(result.discrepancies.length, 1, 'only the row matching both AND conditions (A1) is reported');
      TestRunner.assertEqual(result.discrepancies[0].key, 'A1', 'reported key uses rule.source_key column');
      TestRunner.assertEqual(result.failedItems[0], 'A1', 'failedItems mirrors discrepancy keys');
      log('executeInternalAudit: AND condition -> FAILED', true);
    } catch (e) { log('executeInternalAudit: AND condition -> FAILED', false, e); }

    try {
      const dataMaps = {
        SourceSheet: {
          headers: ['sku', 'wpm_Stock'],
          values: [
            ['sku', 'wpm_Stock'],
            ['A1', '5']
          ]
        }
      };
      const rule = { source_sheet: 'SourceSheet', source_key: 'sku', condition: 'wpm_Stock,=,0' };
      const result = ValidationLogic.executeInternalAudit(rule, dataMaps, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'PASSED', 'no rows match the single condition');
      log('executeInternalAudit: single condition, no match -> PASSED', true);
    } catch (e) { log('executeInternalAudit: single condition, no match -> PASSED', false, e); }

    try {
      const result = ValidationLogic.executeInternalAudit({ source_sheet: 'Missing', condition: 'a,=,b' }, {}, {}, 'test-session');
      TestRunner.assertEqual(result.status, 'ERROR', 'missing sheet data returns ERROR, not throw');
      log('executeInternalAudit: missing sheet data -> ERROR', true);
    } catch (e) { log('executeInternalAudit: missing sheet data -> ERROR', false, e); }

    return results;
  }

  return { run: run };
})();
