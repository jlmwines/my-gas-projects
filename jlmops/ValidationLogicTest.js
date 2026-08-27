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

    return results;
  }

  return { run: run };
})();
