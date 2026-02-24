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

    // WPClever Smart Bundle fields
    product.wps_WoosbIds = _getMetaValue(apiProduct.meta_data, 'woosb_ids') || '';

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

      // Bundle fields
      translation.wxs_WoosbIds = _getMetaValue(heProd.meta_data, 'woosb_ids') || '';

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

  return {
    pullProducts: pullProducts
  };
})();

/**
 * Global function for time-driven trigger or manual execution from Apps Script editor.
 * @returns {object} Pull result
 */
function pullWooProducts() {
  return WooProductPullService.pullProducts();
}
