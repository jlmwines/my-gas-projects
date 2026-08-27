/**
 * @file WooProductPullServiceTest.js
 * @description Unit tests for WooProductPullService's pure transform helpers --
 * Tier 1 of `jlmops/plans/TEST_SUITE_EXTENSION_PLAN.md`. `getAttributeValue`/
 * `extractNames` tests lock in Bug I1 (brand field routed through the wrong
 * extractor, writing the literal label "Brand" instead of the winery name);
 * `transformApiTranslation` locks in Bug I3's fix (the corrected WPML original-
 * ID lookup via `translations.en`, not the broken `_wpml_original_post_id` meta
 * key the still-unfixed alternate path in `_extractAndStageTranslationLinks`
 * uses -- that other path stays a documented, open gap, not tested here).
 */
const WooProductPullServiceTest = (function() {

  function run() {
    const suiteName = 'WooProductPullServiceTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }

    // --- getAttributeValue (Bug I1 lock-in: brand must come from attributes, not term names) ---
    try {
      const attributes = [
        { id: 1, name: 'Winery', slug: 'pa_winery', options: ['Golan Heights Winery'] },
        { id: 2, name: 'Intensity', slug: 'pa_intensity', options: ['Medium'] }
      ];
      TestRunner.assertEqual(WooProductPullService.getAttributeValue(attributes, 'pa_winery'), 'Golan Heights Winery', 'returns the first option for a matching slug');
      TestRunner.assertEqual(WooProductPullService.getAttributeValue(attributes, 'pa_missing'), '', 'unknown slug returns empty string');
      TestRunner.assertEqual(WooProductPullService.getAttributeValue(null, 'pa_winery'), '', 'null attributes array returns empty string, not throw');
      TestRunner.assertEqual(WooProductPullService.getAttributeValue([{ id: 3, slug: 'pa_winery', options: [] }], 'pa_winery'), '', 'empty options array returns empty string');
      log('getAttributeValue: correct extractor for attribute-based fields (I1)', true);
    } catch (e) { log('getAttributeValue: correct extractor for attribute-based fields (I1)', false, e); }

    // --- extractNames (the extractor I1's bug wrongly used for the brand field) ---
    try {
      const terms = [{ id: 1, name: 'Red Wine' }, { id: 2, name: 'Dry' }];
      TestRunner.assertEqual(WooProductPullService.extractNames(terms), 'Red Wine, Dry', 'joins term names with comma-space');
      TestRunner.assertEqual(WooProductPullService.extractNames([]), '', 'empty array returns empty string');
      TestRunner.assertEqual(WooProductPullService.extractNames(null), '', 'null returns empty string, not throw');
      TestRunner.assertEqual(WooProductPullService.extractNames('not-an-array'), '', 'non-array input returns empty string, not throw');
      log('extractNames: term-object name extraction', true);
    } catch (e) { log('extractNames: term-object name extraction', false, e); }

    // --- getMetaValue ---
    try {
      const meta = [{ id: 1, key: 'rank_math_description', value: 'A fine wine.' }];
      TestRunner.assertEqual(WooProductPullService.getMetaValue(meta, 'rank_math_description'), 'A fine wine.', 'finds matching key');
      TestRunner.assertEqual(WooProductPullService.getMetaValue(meta, 'missing_key'), null, 'missing key returns null');
      TestRunner.assertEqual(WooProductPullService.getMetaValue(null, 'x'), null, 'null meta array returns null, not throw');
      log('getMetaValue: meta_data array lookup', true);
    } catch (e) { log('getMetaValue: meta_data array lookup', false, e); }

    // --- woosbIdsString ---
    try {
      const objMeta = [{ id: 1, key: 'woosb_ids', value: { 1: { qty: 1 } } }];
      const strMeta = [{ id: 1, key: 'woosb_ids', value: '{"1":{"qty":1}}' }];
      TestRunner.assertEqual(WooProductPullService.woosbIdsString(objMeta), JSON.stringify({ 1: { qty: 1 } }), 'object value is JSON-stringified');
      TestRunner.assertEqual(WooProductPullService.woosbIdsString(strMeta), '{"1":{"qty":1}}', 'string value passes through unchanged');
      TestRunner.assertEqual(WooProductPullService.woosbIdsString([]), '', 'no woosb_ids key returns empty string');
      log('woosbIdsString: normalizes object vs string meta value', true);
    } catch (e) { log('woosbIdsString: normalizes object vs string meta value', false, e); }

    // --- transformApiTranslation (Bug I3 lock-in: correct WPML original-ID source) ---
    try {
      const heProd = {
        id: 456,
        sku: 'SKU-HE-1',
        name: 'שם בעברית',
        description: 'תיאור',
        short_description: 'תקציר',
        permalink: 'https://example.com/he/product',
        translations: { en: 123 },
        meta_data: [{ id: 1, key: 'rank_math_description', value: 'HE SEO desc' }]
      };
      const out = WooProductPullService.transformApiTranslation(heProd);
      TestRunner.assertEqual(out.wxs_ID, '456', 'HE product ID mapped as string');
      TestRunner.assertEqual(out.wxs_WpmlOriginalId, '123', 'original (EN) ID sourced from translations.en, not a meta lookup');
      TestRunner.assertEqual(out.wxs_WpmlLanguageCode, 'he', 'language code hardcoded to he');
      TestRunner.assertEqual(out.wxs_MetaRankMathDesc, 'HE SEO desc', 'RankMath meta pulled via getMetaValue');
      log('transformApiTranslation: WPML original-ID sourced from translations.en (I3)', true);
    } catch (e) { log('transformApiTranslation: WPML original-ID sourced from translations.en (I3)', false, e); }

    try {
      TestRunner.assertEqual(WooProductPullService.transformApiTranslation(null), null, 'null product returns null, not throw');
      const noEnLink = { id: 789, sku: 'SKU-2', translations: {} };
      TestRunner.assertEqual(WooProductPullService.transformApiTranslation(noEnLink).wxs_WpmlOriginalId, '', 'missing translations.en yields empty string, not "undefined"');
      log('transformApiTranslation: edge cases (no product, no EN link)', true);
    } catch (e) { log('transformApiTranslation: edge cases (no product, no EN link)', false, e); }

    return results;
  }

  return { run: run };
})();
