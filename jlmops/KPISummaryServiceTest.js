/**
 * @file KPISummaryServiceTest.js
 * @description Unit tests for KPISummaryService._firstCouponOrders, the KPI #3
 * first-order conversion count read from orders (TARGETED_COUPONS_PLAN build step 1).
 * No sheet access: orders are built in memory.
 */
const KPISummaryServiceTest = (function() {

  function run() {
    const suiteName = 'KPISummaryServiceTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }
    const eq = TestRunner.assertEqual;
    const F = KPISummaryService._firstCouponOrders;
    const valid = StatusReportService._isValidOrderStatus;
    const start = new Date(2026, 9, 1), end = new Date(2026, 10, 1);
    const o = function (day, status, total, coupons) {
      return { date: new Date(2026, 9, day), status: status, total: total, coupons: coupons };
    };

    try {
      const orders = [
        o(5, 'completed', 400, '50new'),
        o(6, 'processing', 300, 'shipfree, 50NEW'),
        o(7, 'completed', 500, 'shipfree'),
        o(8, 'cancelled', 350, '50new'),
        o(9, 'completed', 250, ''),
        { date: new Date(2026, 10, 2), status: 'completed', total: 999, coupons: '50new' },
        { date: null, status: 'completed', total: 999, coupons: '50new' }
      ];
      const r = F(orders, ['50new'], start, end, valid);
      eq(r.count, 2, 'counts valid in-window 50NEW orders, case-insensitive, within a list');
      eq(r.total, 700, 'sums their totals');
      log('first-coupon orders: filters window, status and code', true);
    } catch (e) { log('first-coupon orders: filters window, status and code', false, e); }

    try {
      const r = F([o(5, 'completed', 400, '50new')], [], start, end, valid);
      eq(r.count, 0, 'no configured codes counts nothing');
      log('first-coupon orders: empty code list', true);
    } catch (e) { log('first-coupon orders: empty code list', false, e); }

    return results;
  }

  return { run: run };
})();
