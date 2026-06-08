/**
 * @file WooProductPullService.js
 * @description Automated WooCommerce product pull replacing manual CSV exports.
 *
 * Pulls EN + HE products via WooApiService, transforms JSON to wps_* staging format,
 * extracts EN↔HE translation links from WPML metadata, and feeds into the existing
 * staging → validation → master upsert pipeline.
 */

const WooProductPullService = (function() {
  const SERVICE_NAME = 'WooProductPullService';

  /**
   * Main entry point: pull all products from WooCommerce.
   * Pulls EN products, HE products (for translations), stages, validates, upserts.
   *
   * @returns {object} { success, enCount, heCount, message }
   */
  function pullProducts() {
    var functionName = 'pullProducts';
    var sessionId = generateSessionId();
    logger.info(SERVICE_NAME, functionName, 'Starting automated product pull', { sessionId: sessionId });

    // Guard: skip if a sync session is already active
    try {
      var syncState = SyncStateService.getState();
      if (syncState && syncState.currentStage && syncState.currentStage !== 'IDLE' && syncState.currentStage !== 'COMPLETE' && syncState.currentStage !== 'FAILED') {
        var msg = 'Skipping product pull — sync session active at stage: ' + syncState.currentStage;
        logger.warn(SERVICE_NAME, functionName, msg, { sessionId: sessionId });
        return { success: false, enCount: 0, heCount: 0, message: msg };
      }
    } catch (e) {
      // SyncStateService might not be initialized — proceed anyway
      logger.warn(SERVICE_NAME, functionName, 'Could not check sync state: ' + e.message, { sessionId: sessionId });
    }

    try {
      // Step 1: Pull EN products
      var enProducts = _pullEnProducts(sessionId);

      // Step 2: Pull HE products (for translation links)
      var heProducts = _pullHeProducts(sessionId);

      // Step 3: Trigger existing validation + upsert pipeline for EN products
      _triggerExistingPipeline(sessionId);

      // Step 4: Extract and stage translation links
      if (heProducts.length > 0) {
        _extractAndStageTranslationLinks(heProducts, sessionId);
      }

      // Step 5: Update last pull timestamp
      ConfigService.setConfig('woo.api', 'products_last_pull', new Date().toISOString());

      var message = 'Product pull complete. EN: ' + enProducts.length + ', HE: ' + heProducts.length;
      logger.info(SERVICE_NAME, functionName, message, { sessionId: sessionId });

      return { success: true, enCount: enProducts.length, heCount: heProducts.length, message: message };

    } catch (e) {
      logger.error(SERVICE_NAME, functionName, 'Product pull failed: ' + e.message, e, { sessionId: sessionId });
      return { success: false, enCount: 0, heCount: 0, message: 'Failed: ' + e.message };
    }
  }

  /**
   * Fetch EN products from Woo API, transform to staging format, write to WebProdS_EN.
   * @param {string} sessionId
   * @returns {Array} Transformed product objects
   */
  function _pullEnProducts(sessionId) {
    var functionName = '_pullEnProducts';
    logger.info(SERVICE_NAME, functionName, 'Fetching EN products from WooCommerce...', { sessionId: sessionId });

    var apiProducts = WooApiService.fetchProducts('en');
    logger.info(SERVICE_NAME, functionName, 'Received ' + apiProducts.length + ' EN products from API', { sessionId: sessionId });

    // Transform each API product to wps_* staging format
    var stagingProducts = [];
    for (var i = 0; i < apiProducts.length; i++) {
      var transformed = _transformApiProduct(apiProducts[i]);
      if (transformed) {
        stagingProducts.push(transformed);
      }
    }

    logger.info(SERVICE_NAME, functionName, 'Transformed ' + stagingProducts.length + ' EN products to staging format', { sessionId: sessionId });

    // Write to WebProdS_EN staging sheet using existing _populateStagingSheet pattern
    var sheetNames = ConfigService.getConfig('system.sheet_names');
    _writeToStagingSheet(stagingProducts, sheetNames.WebProdS_EN, sessionId);

    return stagingProducts;
  }

  /**
   * Fetch HE products from Woo API for translation link extraction.
   * @param {string} sessionId
   * @returns {Array} Raw API product objects (HE)
   */
  function _pullHeProducts(sessionId) {
    var functionName = '_pullHeProducts';
    logger.info(SERVICE_NAME, functionName, 'Fetching HE products from WooCommerce...', { sessionId: sessionId });

    var apiProducts = WooApiService.fetchProducts('he');
    logger.info(SERVICE_NAME, functionName, 'Received ' + apiProducts.length + ' HE products from API', { sessionId: sessionId });

    return apiProducts;
  }

  /**
   * Transform a single Woo API product object to internal wps_* staging format.
   *
   * @param {object} apiProduct - WooCommerce REST API product object
   * @returns {object|null} Product in wps_* format, or null if invalid
   */
  function _transformApiProduct(apiProduct) {
    if (!apiProduct || !apiProduct.id) return null;

    var product = {};

    // Direct field mappings
    product.wps_ID = String(apiProduct.id);
    product.wps_SKU = apiProduct.sku || '';
    product.wps_PostTitle = apiProduct.name || '';
    product.wps_PostStatus = apiProduct.status || '';
    product.wps_Stock = apiProduct.stock_quantity !== null && apiProduct.stock_quantity !== undefined ? String(apiProduct.stock_quantity) : '';
    product.wps_RegularPrice = apiProduct.regular_price || '';
    product.wps_SalePrice = apiProduct.sale_price || '';
    product.wps_PostContent = apiProduct.description || '';
    product.wps_PostExcerpt = apiProduct.short_description || '';
    product.wps_Backorders = apiProduct.backorders || '';
    product.wps_SoldIndividually = apiProduct.sold_individually ? 'yes' : 'no';
    product.wps_ManageStock = apiProduct.manage_stock ? 'yes' : 'no';
    product.wps_Featured = apiProduct.featured ? 'yes' : 'no';
    product.wps_PostDate = apiProduct.date_created || '';

    // Composite fields
    product.wps_TaxProductCat = _extractNames(apiProduct.categories);
    product.wps_TaxProductTag = _extractNames(apiProduct.tags);
    product.wps_Images = apiProduct.images && apiProduct.images.length > 0 ? apiProduct.images[0].src : '';
    product.wps_ProductUrl = apiProduct.permalink || '';
    product.wps_ProductPageUrl = apiProduct.permalink || '';

    // Upsell/cross-sell IDs
    product.wps_UpsellIds = (apiProduct.upsell_ids || []).join(',');
    product.wps_CrosssellIds = (apiProduct.cross_sell_ids || []).join(',');

    // Product type
    product.wps_TaxProductType = apiProduct.type || '';

    // WPML language code from meta
    product.wps_WpmlLanguageCode = _getMetaValue(apiProduct.meta_data, '_wpml_language_code') || 'en';

    // Attributes
    product.wps_AttrIntensity = _getAttributeValue(apiProduct.attributes, 'pa_intensity');
    product.wps_AttrComplexity = _getAttributeValue(apiProduct.attributes, 'pa_complexity');
    product.wps_AttrAcidity = _getAttributeValue(apiProduct.attributes, 'pa_acidity');
    product.wps_AttrFoodHarmony = _getAttributeValue(apiProduct.attributes, 'pa_food-harmony');
    product.wps_AttrFoodContrast = _getAttributeValue(apiProduct.attributes, 'pa_food-contrast');
    product.wps_AttrWinery = _getAttributeValue(apiProduct.attributes, 'pa_winery');

    // Product brand
    product.wps_TaxProductBrand = _extractNames(
      apiProduct.attributes ? apiProduct.attributes.filter(function(a) { return a.slug === 'pa_brand'; }) : []
    );

    // WPClever Smart Bundle fields — API may return object instead of JSON string
    var woosbRaw = _getMetaValue(apiProduct.meta_data, 'woosb_ids');
    product.wps_WoosbIds = (woosbRaw && typeof woosbRaw === 'object') ? JSON.stringify(woosbRaw) : (woosbRaw || '');
    // WPClever discount/price meta (parallel to woosb_ids). Previously captured only on the HE
    // translation path, so the EN/main wpm_Woosb* columns stayed blank and the as-presented bundle
    // margin (BundleService) had nothing to read. Flows wps_* -> wpm_* via the existing staging->master
    // mapping. Takes effect after a full product API Pull repopulates WebProdM.
    product.wps_WoosbDiscount = _getMetaValue(apiProduct.meta_data, 'woosb_discount') || '';
    product.wps_WoosbDiscountAmount = _getMetaValue(apiProduct.meta_data, 'woosb_discount_amount') || '';
    product.wps_WoosbCustomPrice = _getMetaValue(apiProduct.meta_data, 'woosb_custom_price') || '';
    product.wps_WoosbDisableAutoPrice = _getMetaValue(apiProduct.meta_data, 'woosb_disable_auto_price') || '';

    return product;
  }

  /**
   * Extract translation links from HE products and write to WebXltS staging sheet.
   * HE products from ?lang=he include WPML metadata with _wpml_original_post_id pointing to EN product ID.
   *
   * @param {Array} heProducts - Raw API HE product objects
   * @param {string} sessionId
   */
  function _extractAndStageTranslationLinks(heProducts, sessionId) {
    var functionName = '_extractAndStageTranslationLinks';
    logger.info(SERVICE_NAME, functionName, 'Extracting translation links from ' + heProducts.length + ' HE products', { sessionId: sessionId });

    var translations = [];

    for (var i = 0; i < heProducts.length; i++) {
      var heProd = heProducts[i];
      var enOriginalId = _getMetaValue(heProd.meta_data, '_wpml_original_post_id');

      var translation = {
        wxs_ID: String(heProd.id),
        wxs_PostTitle: heProd.name || '',
        wxs_PostContent: heProd.description || '',
        wxs_PostExcerpt: heProd.short_description || '',
        wxs_SKU: heProd.sku || '',
        wxs_ProductPageUrl: heProd.permalink || '',
        wxs_WpmlLanguageCode: 'he',
        wxs_WpmlOriginalId: enOriginalId ? String(enOriginalId) : '',
        wxs_WpmlOriginalSku: '' // Will be populated during validation/upsert from EN data
      };

      // Bundle fields — API may return object instead of JSON string
      var woosbRawHe = _getMetaValue(heProd.meta_data, 'woosb_ids');
      translation.wxs_WoosbIds = (woosbRawHe && typeof woosbRawHe === 'object') ? JSON.stringify(woosbRawHe) : (woosbRawHe || '');

      translations.push(translation);
    }

    logger.info(SERVICE_NAME, functionName, 'Extracted ' + translations.length + ' translation links (with EN original ID)', { sessionId: sessionId });

    // Write to WebXltS staging sheet
    var sheetNames = ConfigService.getConfig('system.sheet_names');
    _writeToStagingSheet(translations, sheetNames.WebXltS, sessionId);

    // Run translation validation and upsert
    var validationResult = ValidationLogic.runValidationSuite('web_xlt_staging', sessionId);
    var processed = ValidationOrchestratorService.processValidationResults(validationResult, sessionId);

    if (processed.quarantineTriggered) {
      logger.error(SERVICE_NAME, functionName, 'Translation validation triggered quarantine — WebXltM NOT updated', null, { sessionId: sessionId });
    } else {
      // Upsert translations to WebXltM
      ProductImportService.upsertWebXltData(sessionId);
      logger.info(SERVICE_NAME, functionName, 'Translation links upserted to WebXltM', { sessionId: sessionId });
    }
  }

  /**
   * Trigger the existing validation + upsert pipeline for EN products.
   * @param {string} sessionId
   */
  function _triggerExistingPipeline(sessionId) {
    var functionName = '_triggerExistingPipeline';
    logger.info(SERVICE_NAME, functionName, 'Running staging validation for web products...', { sessionId: sessionId });

    // Run validation
    var validationResult = ValidationLogic.runValidationSuite('web_staging', sessionId);
    var processed = ValidationOrchestratorService.processValidationResults(validationResult, sessionId);

    if (processed.quarantineTriggered) {
      throw new Error('Product staging validation triggered quarantine. Check validation results for details.');
    }

    // Upsert to master (reuses existing _upsertWebProductsData)
    ProductImportService.upsertWebProductsData(sessionId);
    logger.info(SERVICE_NAME, functionName, 'EN products upserted to WebProdM', { sessionId: sessionId });
  }

  /**
   * Write an array of objects to a staging sheet.
   * Uses the schema headers from config to map object keys to columns.
   *
   * @param {Array<object>} objects - Array of objects with field names matching schema headers
   * @param {string} sheetName - Target sheet name
   * @param {string} sessionId
   */
  function _writeToStagingSheet(objects, sheetName, sessionId) {
    var functionName = '_writeToStagingSheet';

    var schema = ConfigService.getConfig('schema.data.' + sheetName);
    if (!schema || !schema.headers) {
      throw new Error('Schema for sheet ' + sheetName + ' not found in configuration.');
    }

    var schemaHeaders = schema.headers.split(',');
    var dataSpreadsheet = SheetAccessor.getDataSpreadsheet();
    var sheet = dataSpreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet ' + sheetName + ' not found in JLMops_Data spreadsheet.');
    }

    // Map objects to rows based on schema headers
    var rows = objects.map(function(obj) {
      return schemaHeaders.map(function(header) {
        return obj[header] !== undefined && obj[header] !== null ? obj[header] : '';
      });
    });

    // Clear previous data rows
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
    }

    // Write new data
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }

    SpreadsheetApp.flush();
    logger.info(SERVICE_NAME, functionName, 'Wrote ' + rows.length + ' rows to ' + sheetName, { sessionId: sessionId });
  }

  /**
   * Full API pull pipeline: EN products → HE translations → orders.
   * Updates SyncStateService step progress between each phase for widget polling.
   *
   * Called from apiPullAllBackend() which handles the state machine wrapper.
   * Does NOT touch the existing pullProducts() flow.
   *
   * @returns {object} { success, enCount, heCount, message }
   */
  function pullAndImportAll() {
    var functionName = 'pullAndImportAll';
    var sessionId = SyncStateService.getSyncState().sessionId;
    logger.info(SERVICE_NAME, functionName, 'Starting full API pull pipeline', { sessionId: sessionId });

    var sheetNames = ConfigService.getConfig('system.sheet_names');

    // ── Phase A: EN Products ──
    SyncStateService.updateStep(1, 'processing', 'Pulling EN products...');
    SpreadsheetApp.flush();

    var enProducts = WooApiService.fetchProducts('en');
    var enStaging = [];
    for (var i = 0; i < enProducts.length; i++) {
      var t = _transformApiProduct(enProducts[i]);
      if (t) enStaging.push(t);
    }
    _writeToStagingSheet(enStaging, sheetNames.WebProdS_EN, sessionId);

    SyncStateService.updateStep(1, 'processing', 'EN: ' + enStaging.length + ' staged. Validating...');
    SpreadsheetApp.flush();

    var enValidation = ValidationLogic.runValidationSuite('web_staging', sessionId);
    var enProcessed = ValidationOrchestratorService.processValidationResults(enValidation, sessionId);
    if (enProcessed.quarantineTriggered) {
      throw new Error('EN product validation triggered quarantine');
    }
    ProductImportService.upsertWebProductsData(sessionId);

    // ── Phase B: HE Translations ──
    SyncStateService.updateStep(1, 'processing', 'EN imported. Pulling HE translations...');
    SpreadsheetApp.flush();

    var heProducts = WooApiService.fetchProducts('he');
    var heStaging = [];
    for (var j = 0; j < heProducts.length; j++) {
      var ht = _transformApiTranslation(heProducts[j]);
      if (ht) heStaging.push(ht);
    }
    _writeToStagingSheet(heStaging, sheetNames.WebXltS, sessionId);

    SyncStateService.updateStep(1, 'processing', 'HE: ' + heStaging.length + ' staged. Validating...');
    SpreadsheetApp.flush();

    var heValidation = ValidationLogic.runValidationSuite('web_xlt_staging', sessionId);
    var heProcessed = ValidationOrchestratorService.processValidationResults(heValidation, sessionId);
    if (heProcessed.quarantineTriggered) {
      throw new Error('HE translation validation triggered quarantine');
    }
    ProductImportService.upsertWebXltData(sessionId);

    SyncStateService.updateStep(1, 'completed', 'EN: ' + enStaging.length + ', HE: ' + heStaging.length + ' products imported');
    SpreadsheetApp.flush();

    // ── Phase C: Orders ──
    SyncStateService.updateStep(2, 'processing', 'Pulling orders...');
    SpreadsheetApp.flush();

    var orderResult = WooOrderPullService.pullOrders();
    if (!orderResult.success) {
      throw new Error('Order pull failed: ' + orderResult.message);
    }

    SyncStateService.updateStep(2, 'completed', orderResult.orderCount + ' orders imported');
    SpreadsheetApp.flush();

    // Update last pull timestamp
    ConfigService.setConfig('woo.api', 'products_last_pull', new Date().toISOString());

    var message = 'Full pipeline complete. EN: ' + enStaging.length + ', HE: ' + heStaging.length;
    logger.info(SERVICE_NAME, functionName, message, { sessionId: sessionId });

    return { success: true, enCount: enStaging.length, heCount: heStaging.length, message: message };
  }

  /**
   * Transform a single HE API product to the full 31-column wxs_* staging format.
   * Uses heProd.translations.en for the original ID (the fix for the broken _wpml_original_post_id lookup).
   *
   * @param {object} heProd - WooCommerce REST API product object fetched with ?lang=he
   * @returns {object|null} Product in wxs_* format, or null if invalid
   */
  function _transformApiTranslation(heProd) {
    if (!heProd || !heProd.id) return null;

    var meta = heProd.meta_data;
    var translation = {};

    // Core fields
    translation.wxs_ID = String(heProd.id);
    translation.wxs_PostTitle = heProd.name || '';
    translation.wxs_PostContent = heProd.description || '';
    translation.wxs_PostExcerpt = heProd.short_description || '';
    translation.wxs_SKU = heProd.sku || '';
    translation.wxs_ProductPageUrl = heProd.permalink || '';
    translation.wxs_WpmlLanguageCode = 'he';
    translation.wxs_WpmlOriginalId = heProd.translations && heProd.translations.en ? String(heProd.translations.en) : '';
    translation.wxs_WpmlOriginalSku = heProd.sku || '';

    // RankMath SEO meta
    translation.wxs_MetaRankMathDesc = _getMetaValue(meta, 'rank_math_description') || '';
    translation.wxs_MetaRankMathKeyword = _getMetaValue(meta, 'rank_math_focus_keyword') || '';

    // WPClever Smart Bundle fields (20 meta keys)
    translation.wxs_WoosbAfterText = _getMetaValue(meta, 'woosb_after_text') || '';
    translation.wxs_WoosbBeforeText = _getMetaValue(meta, 'woosb_before_text') || '';
    translation.wxs_WoosbCustomPrice = _getMetaValue(meta, 'woosb_custom_price') || '';
    translation.wxs_WoosbDisableAutoPrice = _getMetaValue(meta, 'woosb_disable_auto_price') || '';
    translation.wxs_WoosbDiscount = _getMetaValue(meta, 'woosb_discount') || '';
    translation.wxs_WoosbDiscountAmount = _getMetaValue(meta, 'woosb_discount_amount') || '';
    translation.wxs_WoosbExcludeUnpurch = _getMetaValue(meta, 'woosb_exclude_unpurchasable') || '';
    var woosbRawMeta = _getMetaValue(meta, 'woosb_ids');
    translation.wxs_WoosbIds = (woosbRawMeta && typeof woosbRawMeta === 'object') ? JSON.stringify(woosbRawMeta) : (woosbRawMeta || '');
    translation.wxs_WoosbLayout = _getMetaValue(meta, 'woosb_layout') || '';
    translation.wxs_WoosbLimitEachMax = _getMetaValue(meta, 'woosb_limit_each_max') || '';
    translation.wxs_WoosbLimitEachMin = _getMetaValue(meta, 'woosb_limit_each_min') || '';
    translation.wxs_WoosbLimitEachMinDef = _getMetaValue(meta, 'woosb_limit_each_min_default') || '';
    translation.wxs_WoosbLimitWholeMax = _getMetaValue(meta, 'woosb_limit_whole_max') || '';
    translation.wxs_WoosbLimitWholeMin = _getMetaValue(meta, 'woosb_limit_whole_min') || '';
    translation.wxs_WoosbManageStock = _getMetaValue(meta, 'woosb_manage_stock') || '';
    translation.wxs_WoosbOptionalProducts = _getMetaValue(meta, 'woosb_optional_products') || '';
    translation.wxs_WoosbShippingFee = _getMetaValue(meta, 'woosb_shipping_fee') || '';
    translation.wxs_WoosbTotalLimits = _getMetaValue(meta, 'woosb_total_limits') || '';
    translation.wxs_WoosbTotalLimitsMax = _getMetaValue(meta, 'woosb_total_limits_max') || '';
    translation.wxs_WoosbTotalLimitsMin = _getMetaValue(meta, 'woosb_total_limits_min') || '';

    return translation;
  }

  // ============================================================
  // Helper functions
  // ============================================================

  /**
   * Extract name values from an array of WooCommerce term objects (categories, tags).
   * @param {Array} terms - Array of { id, name, slug } objects
   * @returns {string} Comma-separated names
   */
  function _extractNames(terms) {
    if (!terms || !Array.isArray(terms)) return '';
    return terms.map(function(t) { return t.name || t.options && t.options[0] || ''; }).filter(Boolean).join(', ');
  }

  /**
   * Get a specific attribute value from WooCommerce product attributes array.
   * @param {Array} attributes - Array of { id, name, slug, options[] } objects
   * @param {string} slug - Attribute slug (e.g., 'pa_intensity')
   * @returns {string} First option value, or empty string
   */
  function _getAttributeValue(attributes, slug) {
    if (!attributes || !Array.isArray(attributes)) return '';
    for (var i = 0; i < attributes.length; i++) {
      if (attributes[i].slug === slug && attributes[i].options && attributes[i].options.length > 0) {
        return attributes[i].options[0];
      }
    }
    return '';
  }

  /**
   * Get a specific meta_data value from WooCommerce product meta array.
   * @param {Array} metaData - Array of { id, key, value } objects
   * @param {string} key - Meta key to find
   * @returns {*} Meta value, or null if not found
   */
  function _getMetaValue(metaData, key) {
    if (!metaData || !Array.isArray(metaData)) return null;
    for (var i = 0; i < metaData.length; i++) {
      if (metaData[i].key === key) {
        return metaData[i].value;
      }
    }
    return null;
  }

  // ===================================================================================
  // Stage 5 — fast bundles-only refresh (direct to master, no staging/validation)
  // ===================================================================================

  // woosb_ids meta may arrive as an object or a JSON string — normalize to a JSON string
  // (mirrors _transformApiProduct's woosb_ids handling).
  function _woosbIdsString(meta) {
    var raw = _getMetaValue(meta, 'woosb_ids');
    return (raw && typeof raw === 'object') ? JSON.stringify(raw) : (raw || '');
  }

  /**
   * Fast bundles-only refresh (BUNDLE_PLAN Stage 5): pull ONLY woosb products from WC (EN+HE) and
   * write their bundle fields — composition (`woosb_ids`) + the four WOOSB discount fields — DIRECTLY
   * into WebProdM/WebXltM, bypassing staging+validation. Safe: woosb is exempt from Comax validation,
   * and the next full sync re-writes the same WC data (no divergence). Updates EXISTING master rows
   * only (matched by id); ids not in master are counted as "new" and skipped (a full pull inserts
   * them). Seconds instead of a full product pull.
   * @returns {object} { success, enUpdated, enMissing, heUpdated, heMissing, message }
   */
  function pullBundleProducts() {
    var functionName = 'pullBundleProducts';
    var sessionId = generateSessionId();
    logger.info(SERVICE_NAME, functionName, 'Starting fast bundles-only pull', { sessionId: sessionId });

    try {
      var enProducts = WooApiService.fetchBundleProducts('en') || [];
      var heProducts = WooApiService.fetchBundleProducts('he') || [];

      if (enProducts.length === 0 && heProducts.length === 0) {
        var emptyMsg = 'No bundle (woosb) products returned from WooCommerce — nothing updated. ' +
          '(Verify the store exposes products with ?type=woosb.)';
        logger.warn(SERVICE_NAME, functionName, emptyMsg, { sessionId: sessionId });
        return { success: false, enUpdated: 0, enMissing: 0, heUpdated: 0, heMissing: 0, message: emptyMsg };
      }

      var enResult = _upsertBundleFieldsToMaster(enProducts, 'WebProdM', 'wpm_ID', {
        wpm_TaxProductType: function() { return 'woosb'; },
        wpm_WoosbIds: function(m) { return _woosbIdsString(m); },
        wpm_WoosbDiscount: function(m) { return _getMetaValue(m, 'woosb_discount') || ''; },
        wpm_WoosbDiscountAmount: function(m) { return _getMetaValue(m, 'woosb_discount_amount') || ''; },
        wpm_WoosbCustomPrice: function(m) { return _getMetaValue(m, 'woosb_custom_price') || ''; },
        wpm_WoosbDisableAutoPrice: function(m) { return _getMetaValue(m, 'woosb_disable_auto_price') || ''; }
      });

      var heResult = _upsertBundleFieldsToMaster(heProducts, 'WebXltM', 'wxm_ID', {
        wxm_WoosbIds: function(m) { return _woosbIdsString(m); },
        wxm_WoosbDiscount: function(m) { return _getMetaValue(m, 'woosb_discount') || ''; },
        wxm_WoosbDiscountAmount: function(m) { return _getMetaValue(m, 'woosb_discount_amount') || ''; },
        wxm_WoosbCustomPrice: function(m) { return _getMetaValue(m, 'woosb_custom_price') || ''; },
        wxm_WoosbDisableAutoPrice: function(m) { return _getMetaValue(m, 'woosb_disable_auto_price') || ''; }
      });

      var message = 'Bundle data pulled. EN: ' + enResult.updated + ' updated' +
        (enResult.missing ? ' (' + enResult.missing + ' new, skipped)' : '') +
        '; HE: ' + heResult.updated + ' updated' +
        (heResult.missing ? ' (' + heResult.missing + ' new, skipped)' : '') + '.';
      logger.info(SERVICE_NAME, functionName, message, { sessionId: sessionId });

      return {
        success: true,
        enUpdated: enResult.updated, enMissing: enResult.missing,
        heUpdated: heResult.updated, heMissing: heResult.missing,
        message: message
      };
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, 'Bundle pull failed: ' + e.message, e, { sessionId: sessionId });
      return { success: false, enUpdated: 0, enMissing: 0, heUpdated: 0, heMissing: 0, message: 'Failed: ' + e.message };
    }
  }

  /**
   * Direct-to-master upsert of bundle fields. Reads the sheet once, sets only the given columns on
   * rows whose id matches a fetched product, writes once (mirrors the full upsert's full-range write).
   * Ids not present in master are counted as "missing" and skipped. No staging, no validation.
   * @param {Array} products   fetched API product objects (must have .id and .meta_data)
   * @param {string} sheetName  'WebProdM' | 'WebXltM'
   * @param {string} idField    schema header used as the join key ('wpm_ID' | 'wxm_ID')
   * @param {Object} fieldFns   { columnHeader: fn(meta) -> cellValue }
   * @returns {{updated:number, missing:number}}
   */
  function _upsertBundleFieldsToMaster(products, sheetName, idField, fieldFns) {
    var fnName = '_upsertBundleFieldsToMaster';
    var ss = SheetAccessor.getDataSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(sheetName + ' sheet not found');

    var allConfig = ConfigService.getAllConfig();
    var schema = allConfig['schema.data.' + sheetName];
    if (!schema) throw new Error('schema.data.' + sheetName + ' not found');
    var headers = schema.headers.split(',');
    var idIdx = headers.indexOf(idField);
    if (idIdx === -1) throw new Error(idField + ' not in ' + sheetName + ' schema');

    // Resolve target column indices once; skip (and log) any header absent from the schema.
    var colIdx = {};
    Object.keys(fieldFns).forEach(function(col) {
      var i = headers.indexOf(col);
      if (i === -1) {
        logger.warn(SERVICE_NAME, fnName, 'Column ' + col + ' absent from ' + sheetName + ' schema — skipped');
      } else {
        colIdx[col] = i;
      }
    });

    // Map fetched products by id -> meta_data. HARD GUARD: only ACTUAL bundle products, keyed off the
    // product's own `type` — never trust the `?type=woosb` query filter. If WC ignored the filter and
    // returned the whole catalog, this prevents marking every product woosb + blanking its woosb_ids.
    var byId = {};
    products.forEach(function(p) {
      if (!p || p.id == null) return;
      var t = String(p.type || '').toLowerCase().trim();
      if (t === 'woosb' || t === 'bundle') byId[String(p.id)] = p.meta_data || [];
    });

    var data = sheet.getDataRange().getValues();
    var updated = 0;
    var seen = {};
    for (var r = 1; r < data.length; r++) {
      var id = String(data[r][idIdx] || '').trim();
      if (!id || !byId.hasOwnProperty(id)) continue;
      var meta = byId[id];
      seen[id] = true;
      Object.keys(colIdx).forEach(function(col) {
        data[r][colIdx[col]] = fieldFns[col](meta);
      });
      updated++;
    }

    if (updated > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
    var missing = Object.keys(byId).filter(function(id) { return !seen[id]; }).length;
    logger.info(SERVICE_NAME, fnName, sheetName + ': ' + updated + ' updated, ' + missing + ' unmatched/new', {});
    return { updated: updated, missing: missing };
  }

  return {
    pullProducts: pullProducts,
    pullAndImportAll: pullAndImportAll,
    pullBundleProducts: pullBundleProducts
  };
})();

/**
 * Global function for time-driven trigger or manual execution from Apps Script editor.
 * @returns {object} Pull result
 */
function pullWooProducts() {
  return WooProductPullService.pullProducts();
}
