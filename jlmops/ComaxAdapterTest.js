/**
 * @file ComaxAdapterTest.js
 * @description REAL unit tests for ComaxAdapter.processProductCsv — feeds the
 * actual adapter in-memory CSV fixtures (built into a Drive-converted temp file
 * by the adapter) and asserts the real output. No production sheets touched
 * (the adapter only spins a self-trashing temp Drive file). Rewritten 2026-06-03
 * (was decorative — re-implemented logic inline and never called the adapter).
 *
 * Column order matches map.comax.product_columns (18 cols, idx 0-17). The header
 * row's content is irrelevant (the adapter slices it off); only column COUNT and
 * the data rows matter. CmxProdS schema = these same 18 cps_ fields.
 */
const ComaxAdapterTest = (function() {

  const HEADER = ['CmxId','SKU','NameHe','Division','Group','Vendor','Brand','Color',
                  'Size','Dryness','Vintage','IsNew','IsArchived','IsActive','Price',
                  'Stock','IsWeb','Exclude'];

  // A valid 18-column Comax row (critical fields non-empty). `over` overrides cells by index.
  function _validRow(over) {
    const r = ['12345','TST-001','יין בדיקה','Div','Grp','Vend','Brand','Red','750',
               'Dry','2022','false','false','true','100','10','true','false'];
    if (over) Object.keys(over).forEach(i => { r[i] = over[i]; });
    return r;
  }

  // Build a CSV blob (header + data rows) the way the adapter expects.
  function _blob(dataRows) {
    const lines = [HEADER].concat(dataRows).map(r => r.map(c => String(c)).join(','));
    return Utilities.newBlob(lines.join('\n'), 'text/csv', 'test-comax.csv');
  }

  function run() {
    const suiteName = 'ComaxAdapterTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }

    // 1. Happy path — a valid row is imported and mapped to cps_ fields.
    try {
      const out = ComaxAdapter.processProductCsv(_blob([_validRow()]));
      TestRunner.assertEqual(out.length, 1, 'one product returned');
      TestRunner.assertEqual(out[0].cps_SKU, 'TST-001', 'SKU mapped');
      TestRunner.assertEqual(out[0].cps_CmxId, '12345', 'CmxId mapped as string');
      TestRunner.assertEqual(out[0].cps_Stock, '10', 'Stock mapped');
      log('Happy path: valid row imports and maps', true);
    } catch (e) { log('Happy path: valid row imports and maps', false, e); }

    // 2. Too few columns — adapter throws (schema mismatch).
    try {
      ComaxAdapter.processProductCsv(Utilities.newBlob('a,b,c\n1,2,3', 'text/csv', 't.csv'));
      log('Too few columns rejected', false, new Error('did not throw'));
    } catch (e) { log('Too few columns rejected', true); }

    // 3. Header-only (empty) file — adapter throws.
    try {
      ComaxAdapter.processProductCsv(_blob([]));
      log('Empty file rejected', false, new Error('did not throw'));
    } catch (e) { log('Empty file rejected', true); }

    // 4. Blank critical field (empty SKU) — adapter throws (mapping errors).
    try {
      ComaxAdapter.processProductCsv(_blob([_validRow({ 1: '' })]));
      log('Blank critical field rejected', false, new Error('did not throw'));
    } catch (e) { log('Blank critical field rejected', true); }

    return results;
  }

  return { run: run };
})();
