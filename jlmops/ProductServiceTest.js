/**
 * @file ProductServiceTest.js
 * @description Unit tests for ProductService.
 *
 * Rewritten 2026-06-03 — the previous suite was DECORATIVE: ~12 tests, 51
 * assertions, ZERO calls to the real ProductService. It re-implemented logic
 * inline and asserted on mock objects, so it passed by default and inflated the
 * green count while testing nothing.
 *
 * Honest scope of what's testable here: ProductService is almost entirely
 * sheet-coupled orchestration; the only logic reachable as a real unit test
 * WITHOUT the test-workbook harness is its input-validation guards (which return
 * before any product-sheet access). Those are tested below for real.
 *
 * What the old suite *claimed* to test, and where that coverage actually lives:
 *   - Comax/Web critical-field validation  → now REAL in ComaxAdapterTest /
 *     WebAdapterTest (the adapters own that logic).
 *   - Quarantine decision                  → ValidationOrchestratorService
 *     .processValidationResults (not pure — reads/creates tasks; needs the
 *     harness or a refactor to unit-test).
 *   - "Sanity-check %" sampling            → ValidationLogic.
 * Deeper ProductService coverage (the sheet-touching exports) requires the
 * schema-mirrored test workbook — see plans/TEST_HARNESS_PLAN.md.
 */
const ProductServiceTest = (function() {

  function run() {
    const suiteName = 'ProductServiceTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }

    // --- Test 1: vendorSkuUpdate rejects missing SKU (real guard, no sheets) ---
    try {
      const r = ProductService.vendorSkuUpdate('', 'NEW-SKU');
      TestRunner.assert(r && r.success === false, 'missing oldSku should fail');
      TestRunner.assert(/required/i.test(r.message), 'message names the required-fields reason');
      log('vendorSkuUpdate rejects missing SKU', true);
    } catch (e) { log('vendorSkuUpdate rejects missing SKU', false, e); }

    // --- Test 2: vendorSkuUpdate rejects identical SKUs ---
    try {
      const r = ProductService.vendorSkuUpdate('SAME-SKU', 'SAME-SKU');
      TestRunner.assert(r && r.success === false, 'identical SKUs should fail');
      TestRunner.assert(/cannot be the same/i.test(r.message), 'message names the same-SKU reason');
      log('vendorSkuUpdate rejects identical SKUs', true);
    } catch (e) { log('vendorSkuUpdate rejects identical SKUs', false, e); }

    // --- Test 3: fixOrphanSku rejects missing SKU (real guard, no sheets) ---
    try {
      const r = ProductService.fixOrphanSku('', 'NEW-SKU');
      TestRunner.assert(r && r.success === false, 'missing oldSku should fail');
      TestRunner.assert(/required/i.test(r.message), 'message names the required-fields reason');
      log('fixOrphanSku rejects missing SKU', true);
    } catch (e) { log('fixOrphanSku rejects missing SKU', false, e); }

    // --- Test 4: fixOrphanSku rejects identical SKUs ---
    try {
      const r = ProductService.fixOrphanSku('SAME-SKU', 'SAME-SKU');
      TestRunner.assert(r && r.success === false, 'identical SKUs should fail');
      TestRunner.assert(/cannot be the same/i.test(r.message), 'message names the same-SKU reason');
      log('fixOrphanSku rejects identical SKUs', true);
    } catch (e) { log('fixOrphanSku rejects identical SKUs', false, e); }

    return results;
  }

  return { run: run };
})();
