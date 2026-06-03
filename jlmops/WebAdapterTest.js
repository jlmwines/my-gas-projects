/**
 * @file WebAdapterTest.js
 * @description REAL unit tests for WebAdapter.processProductCsv — feeds the actual
 * adapter in-memory CSV strings (via Utilities.parseCsv; no Drive, no sheets) and
 * asserts the real output. Rewritten 2026-06-03 (was decorative — re-implemented
 * the mapping inline and never called the adapter).
 *
 * Uses the live map 'map.web.product_columns' (keys: ID, SKU, Name, Published,
 * Stock, Regular price). The adapter requires ALL mapped headers present, returns
 * [] for a header-only file, and throws on missing required headers.
 */
const WebAdapterTest = (function() {

  const MAP = 'map.web.product_columns';
  const HEADER = 'ID,SKU,Name,Published,Stock,Regular price';

  function run() {
    const suiteName = 'WebAdapterTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }

    // 1. Happy path — a row maps to wps_ fields.
    try {
      const out = WebAdapter.processProductCsv(HEADER + '\n101,WEB-1,Test Wine,1,7,59.90', MAP);
      TestRunner.assertEqual(out.length, 1, 'one product returned');
      TestRunner.assertEqual(out[0].wps_SKU, 'WEB-1', 'SKU mapped');
      TestRunner.assertEqual(out[0].wps_Stock, '7', 'Stock mapped');
      TestRunner.assertEqual(out[0].wps_RegularPrice, '59.90', 'RegularPrice mapped');
      log('Happy path: row maps to wps_ fields', true);
    } catch (e) { log('Happy path: row maps to wps_ fields', false, e); }

    // 2. Missing required header (Stock dropped) — adapter throws.
    try {
      WebAdapter.processProductCsv('ID,SKU,Name,Published,Regular price\n101,WEB-1,T,1,59.90', MAP);
      log('Missing required header rejected', false, new Error('did not throw'));
    } catch (e) { log('Missing required header rejected', true); }

    // 3. Header-only file — adapter returns [] (no throw).
    try {
      const out = WebAdapter.processProductCsv(HEADER, MAP);
      TestRunner.assertEqual(out.length, 0, 'header-only yields no products');
      log('Header-only yields empty array', true);
    } catch (e) { log('Header-only yields empty array', false, e); }

    // 4. Blank rows are skipped.
    try {
      const out = WebAdapter.processProductCsv(HEADER + '\n,,,,, \n102,WEB-2,Another,1,3,40', MAP);
      TestRunner.assertEqual(out.length, 1, 'blank row skipped, one product');
      TestRunner.assertEqual(out[0].wps_SKU, 'WEB-2', 'correct product after blank row');
      log('Blank rows skipped', true);
    } catch (e) { log('Blank rows skipped', false, e); }

    return results;
  }

  return { run: run };
})();
