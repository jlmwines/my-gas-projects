/**
 * @file WooInventoryPushServiceTest.js
 * @description Unit tests for WooInventoryPushService's pure row-to-payload
 * helpers -- Tier 1 of `jlmops/plans/TEST_SUITE_EXTENSION_PLAN.md`.
 */
const WooInventoryPushServiceTest = (function() {

  // idx with every column absent (-1) except the ones a test overrides --
  // matches how a real idx object always has every key, just some at -1.
  function _idx(overrides) {
    const base = {
      winery: -1, wineryVisible: -1, wineryPosition: -1,
      intensity: -1, intensityVisible: -1, intensityPosition: -1,
      complexity: -1, complexityVisible: -1, complexityPosition: -1,
      acidity: -1, acidityVisible: -1, acidityPosition: -1,
      taskCreatedDate: -1
    };
    return Object.assign(base, overrides || {});
  }

  function run() {
    const suiteName = 'WooInventoryPushServiceTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }

    // --- buildAttributesPayload ---
    try {
      const row = ['Golan Heights Winery', 'Medium'];
      const idx = _idx({ winery: 0, intensity: 1 });
      const attrs = WooInventoryPushService.buildAttributesPayload(row, idx);
      TestRunner.assertEqual(attrs.length, 2, 'only present, mapped attributes are included');
      TestRunner.assertEqual(attrs[0].options[0], 'Golan Heights Winery', 'value read from its mapped column');
      TestRunner.assert(attrs[0].visible === true, 'blank visible cell defaults to true');
      TestRunner.assertEqual(attrs[0].position, 0, 'blank position cell defaults to insertion order');
      log('buildAttributesPayload: default visible/position when cells blank', true);
    } catch (e) { log('buildAttributesPayload: default visible/position when cells blank', false, e); }

    try {
      const row = ['Golan Heights Winery', 'false', '3'];
      const idx = _idx({ winery: 0, wineryVisible: 1, wineryPosition: 2 });
      const attrs = WooInventoryPushService.buildAttributesPayload(row, idx);
      TestRunner.assertEqual(attrs.length, 1, 'one attribute present');
      TestRunner.assert(attrs[0].visible === false, 'explicit "false" string cell overrides the visible default');
      TestRunner.assertEqual(attrs[0].position, 3, 'explicit position cell overrides insertion-order default');
      log('buildAttributesPayload: explicit sheet edit wins over default', true);
    } catch (e) { log('buildAttributesPayload: explicit sheet edit wins over default', false, e); }

    try {
      const row = [''];
      const idx = _idx({ winery: 0 });
      const attrs = WooInventoryPushService.buildAttributesPayload(row, idx);
      TestRunner.assertEqual(attrs.length, 0, 'blank cell value is omitted, not sent as an empty attribute');
      log('buildAttributesPayload: blank value omitted', true);
    } catch (e) { log('buildAttributesPayload: blank value omitted', false, e); }

    // --- buildDateCreated ---
    try {
      const row = [new Date('2026-08-27T10:00:00Z')];
      const idx = _idx({ taskCreatedDate: 0 });
      const result = WooInventoryPushService.buildDateCreated(row, idx);
      TestRunner.assert(typeof result === 'string' && result.indexOf('2026-08-27') === 0, 'formats a real Date into an ISO-like date-time string');
      log('buildDateCreated: valid Date formats correctly', true);
    } catch (e) { log('buildDateCreated: valid Date formats correctly', false, e); }

    try {
      TestRunner.assertEqual(WooInventoryPushService.buildDateCreated([''], _idx({ taskCreatedDate: 0 })), null, 'blank cell returns null (explicit "don\'t touch the date"), not a default');
      TestRunner.assertEqual(WooInventoryPushService.buildDateCreated(['not a date'], _idx({ taskCreatedDate: 0 })), null, 'unparseable cell returns null, not throw');
      TestRunner.assertEqual(WooInventoryPushService.buildDateCreated(['x'], _idx({ taskCreatedDate: -1 })), null, 'no Task Created Date column at all returns null');
      log('buildDateCreated: blank/unparseable/missing-column all return null', true);
    } catch (e) { log('buildDateCreated: blank/unparseable/missing-column all return null', false, e); }

    return results;
  }

  return { run: run };
})();
