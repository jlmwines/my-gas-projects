/**
 * @file BundleServiceTest.js
 * @description Unit tests for BundleService's pure bundle-sync helpers (BUNDLE_PULL_FIX_PLAN §6):
 * the WebBundles snapshot builder and its abort rules, the Pull plan, the safe-write merge and its
 * non-target assertion, and Restore to web version's slot rebuild (criteria carry + history).
 * No sheet access: fixtures are built in memory against the live SysBundles/SysBundleSlots schemas.
 */
const BundleServiceTest = (function() {

  function run() {
    const suiteName = 'BundleServiceTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }
    const eq = TestRunner.assertEqual;

    const allConfig = ConfigService.getAllConfig();
    const colsOf = function (key) {
      const o = {};
      allConfig[key].headers.split(',').forEach(function (h, i) { o[h] = i; });
      return o;
    };
    const bCols = colsOf('schema.data.SysBundles');
    const sCols = colsOf('schema.data.SysBundleSlots');
    const bW = Object.keys(bCols).length, sW = Object.keys(sCols).length;

    // --- fixtures ---
    const woosb = function (obj) { return [{ key: 'woosb_ids', value: JSON.stringify(obj) }]; };
    const enComp = { aa: { type: 'h3', text: 'Reds' }, bb: { id: '11', sku: 'SKU1', qty: '1' }, cc: { id: '12', sku: 'SKU2', qty: '0', optional: '1' } };
    const heComp = { xx: { type: 'h3', text: 'אדומים' }, yy: { id: '21', sku: 'SKU1', qty: '1' }, zz: { id: '22', sku: 'SKU2', qty: '0', optional: '1' } };
    const enP = function () { return [{ id: 100, type: 'woosb', name: 'Box', status: 'publish', meta_data: woosb(enComp).concat([{ key: 'woosb_discount_amount', value: '30' }]), short_description: 's', description: 'l' }]; };
    const heP = function () { return [{ id: 200, type: 'woosb', name: 'קופסה', status: 'publish', translations: { en: '100', he: '200' }, meta_data: woosb(heComp) }]; };
    const bundleRow = function (id, nameEn, nameHe, status) {
      const r = new Array(bW).fill(''); r[bCols.sb_BundleId] = id; r[bCols.sb_NameEn] = nameEn; r[bCols.sb_NameHe] = nameHe;
      r[bCols.sb_Type] = 'Bundle'; r[bCols.sb_Status] = status || 'Active'; return r;
    };
    const slotRow = function (slotId, bundleId, sku, cat, history) {
      const r = new Array(sW).fill(''); r[sCols.sbs_SlotId] = slotId; r[sCols.sbs_BundleId] = bundleId; r[sCols.sbs_SlotType] = 'Product';
      r[sCols.sbs_ActiveSKU] = sku; r[sCols.sbs_Category] = cat || ''; r[sCols.sbs_HistoryJson] = history || '[]'; return r;
    };

    // --- snapshot builder: happy path + EN/HE join ---
    try {
      const s = BundleService.buildSnapshotRows(enP(), heP(), 'T');
      eq(s.ok, true, 'valid fetch builds');
      eq(s.rows.length, 1, 'one row per EN bundle');
      eq(s.rows[0].wb_HeId, '200', 'HE joined by translations.en');
      eq(s.rows[0].wb_DiscountAmount, '30', 'discount amount from EN meta');
      eq(s.rows[0].wb_PulledAt, 'T', 'pulledAt stamped');
      log('snapshot: builds and joins HE by translations.en', true);
    } catch (e) { log('snapshot: builds and joins HE by translations.en', false, e); }

    // --- snapshot builder: every abort rule ---
    try {
      const B = BundleService.buildSnapshotRows;
      eq(B([], heP(), 'T').ok, false, 'no EN aborts');
      const many = []; for (let i = 0; i < 51; i++) many.push(Object.assign({}, enP()[0], { id: 1000 + i }));
      eq(B(many, heP(), 'T').ok, false, 'over cap aborts');
      eq(B(enP(), [], 'T').ok, false, 'no HE aborts');
      const simple = enP(); simple[0].type = 'simple'; eq(B(simple, heP(), 'T').ok, false, 'non-woosb aborts');
      const legacy = enP(); legacy[0].type = 'bundle'; eq(B(legacy, heP(), 'T').ok, false, 'legacy bundle type aborts');
      const noLink = heP(); delete noLink[0].translations; eq(B(enP(), noLink, 'T').ok, false, 'HE without link aborts');
      const badLink = heP(); badLink[0].translations.en = '999'; eq(B(enP(), badLink, 'T').ok, false, 'HE linking to unknown EN aborts');
      const dup = heP().concat([Object.assign({}, heP()[0], { id: 201 })]); eq(B(enP(), dup, 'T').ok, false, 'two HE on one EN aborts');
      const broken = enP(); broken[0].meta_data = [{ key: 'woosb_ids', value: '{not json' }]; eq(B(broken, heP(), 'T').ok, false, 'unparseable woosb aborts');
      log('snapshot: every abort rule refuses to write', true);
    } catch (e) { log('snapshot: every abort rule refuses to write', false, e); }

    // --- snapshot builder: untranslated EN is a warning, not an abort ---
    try {
      const two = enP().concat([Object.assign({}, enP()[0], { id: 101, name: 'New' })]);
      const s = BundleService.buildSnapshotRows(two, heP(), 'T');
      eq(s.ok, true, 'untranslated EN does not abort');
      eq(s.warnings.length, 1, 'one warning');
      eq(s.rows[1].wb_HeId, '', 'HE fields blank');
      log('snapshot: untranslated EN bundle warns, blank HE fields', true);
    } catch (e) { log('snapshot: untranslated EN bundle warns, blank HE fields', false, e); }

    // --- Pull plan: create / rename / missing-from-web, never touches composition or status ---
    try {
      const snap = BundleService.buildSnapshotRows(enP(), heP(), 'T').rows;
      const p1 = BundleService.planPull(snap, [], bCols, sCols);
      eq(p1.creates.length, 1, 'missing web bundle is created');
      eq(p1.creates[0].bundleRow[bCols.sb_Status], 'Active', 'publish → Active');
      eq(p1.creates[0].slotRows.length, 3, 'slots from web woosb');
      eq(p1.creates[0].slotRows[0][sCols.sbs_TextHe], 'אדומים', 'HE text by ordinal');
      eq(p1.creates[0].slotRows[1][sCols.sbs_SlotId], '100-bb', 'slot id <bundleId>-<token>');
      eq(p1.creates[0].slotRows[1][sCols.sbs_Category], '', 'created slots have blank category');
      const p2 = BundleService.planPull(snap, [bundleRow('100', 'Old', 'קופסה', 'Archived')], bCols, sCols);
      eq(p2.renames.length, 1, 'changed EN name renamed');
      eq(p2.renames[0].bundleRow[bCols.sb_Status], 'Archived', 'status kept');
      const p3 = BundleService.planPull(snap, [bundleRow('100', 'Box', 'קופסה'), bundleRow('300', 'Gone', ''), bundleRow('301', 'Old', '', 'Archived')], bCols, sCols);
      eq(p3.creates.length + p3.renames.length, 0, 'matching bundle untouched');
      eq(p3.missingFromWeb.length, 1, 'non-Archived bundle absent from web is reported');
      eq(p3.missingFromWeb[0].bundleId, '300', 'Archived bundle is not reported');
      log('planPull: create, rename, missing-from-web', true);
    } catch (e) { log('planPull: create, rename, missing-from-web', false, e); }

    // --- safe-write merge + non-target assertion ---
    try {
      const bRows = [bundleRow('1', 'A', ''), bundleRow('2', 'B', ''), bundleRow('3', 'C', '')];
      const sRows = [slotRow('1-a', '1', 'S1'), slotRow('2-a', '2', 'S2'), slotRow('2-b', '2', 'S3'), slotRow('3-a', '3', 'S4')];
      const m = BundleService.mergeReplace(bRows, sRows, { '2': bundleRow('2', 'B2', '') }, { '2': [slotRow('2-z', '2', 'S9')] }, bCols, sCols);
      eq(m.bundleRows[1][bCols.sb_NameEn], 'B2', 'target bundle replaced in place');
      eq(m.slotRows.length, 3, 'target slots replaced');
      eq(m.slotRows[1][sCols.sbs_SlotId], '2-z', 'new slots inserted where the old ones were');
      eq(BundleService.nonTargetDiff(sRows, m.slotRows, sCols.sbs_BundleId, { '2': true }), '', 'non-targets unchanged');
      const m2 = BundleService.mergeReplace(bRows, sRows, { '9': bundleRow('9', 'N', '') }, { '9': [slotRow('9-a', '9', 'S0')] }, bCols, sCols);
      eq(m2.bundleRows.length, 4, 'new bundle appended');
      eq(m2.slotRows[m2.slotRows.length - 1][sCols.sbs_SlotId], '9-a', 'new slots appended');
      const keepSlots = BundleService.mergeReplace(bRows, sRows, { '2': bundleRow('2', 'B2', '') }, {}, bCols, sCols);
      eq(keepSlots.slotRows.length, 4, 'rename keeps slots');
      const numeric = sRows.map(function (r) { const x = r.slice(); x[sCols.sbs_BundleId] = Number(x[sCols.sbs_BundleId]); return x; });
      eq(BundleService.nonTargetDiff(sRows, numeric, sCols.sbs_BundleId, {}), '', 'numeric vs text ids equal');
      const tampered = sRows.map(function (r) { return r.slice(); }); tampered[3][sCols.sbs_Category] = 'X';
      eq(BundleService.nonTargetDiff(sRows, tampered, sCols.sbs_BundleId, { '2': true }) !== '', true, 'non-target change detected');
      eq(BundleService.nonTargetDiff([['1', new Date(5)]], [['1', new Date(5)]], 0, {}), '', 'equal dates match');
      eq(BundleService.nonTargetDiff([['1', new Date(5)]], [['1', new Date(6)]], 0, {}) !== '', true, 'different dates detected');
      log('mergeReplace + nonTargetDiff: only targets change', true);
    } catch (e) { log('mergeReplace + nonTargetDiff: only targets change', false, e); }

    // --- Restore to web version: criteria by token then SKU, history close/append ---
    try {
      const web = BundleService.buildSnapshotRows(enP(), heP(), 'T').rows[0];
      const hist = JSON.stringify([{ sku: 'OLD', start: 'a', end: null, reason: 'Stage 7 generator' }]);
      const existing = [
        slotRow('100-bb', '100', 'OLD', 'Dry Red', hist),        // token match, SKU differs (re-rolled)
        slotRow('SLOT-1-1', '100', 'SKU2', 'Dry White', '[]')     // bare editor id, matched by SKU
      ];
      const out = BundleService.buildRestoredSlotRows('100', web, existing, sCols, 'NOW');
      eq(out.length, 3, 'rebuilt from web woosb');
      eq(out[1][sCols.sbs_ActiveSKU], 'SKU1', 'web wine restored');
      eq(out[1][sCols.sbs_Category], 'Dry Red', 'criteria carried by token');
      const h = JSON.parse(out[1][sCols.sbs_HistoryJson]);
      eq(h.length, 2, 'restore entry appended');
      eq(h[0].end, 'NOW', 'replaced SKU entry closed');
      eq(h[1].reason, 'Restore to web version', 'restore reason');
      eq(out[2][sCols.sbs_Category], 'Dry White', 'criteria carried by SKU fallback');
      eq(out[2][sCols.sbs_HistoryJson], '[]', 'same SKU keeps history unchanged');
      eq(out[2][sCols.sbs_QtyVariable], 'TRUE', 'optional re-derived from web');
      log('buildRestoredSlotRows: token-then-SKU carry, history', true);
    } catch (e) { log('buildRestoredSlotRows: token-then-SKU carry, history', false, e); }

    return results;
  }

  return { run: run };
})();
