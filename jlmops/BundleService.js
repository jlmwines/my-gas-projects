/**
 * @file BundleService.js
 * @description Service for managing product bundles using the 2-sheet model (SysBundles + SysBundleSlots).
 * JLMops serves as a shadow system - bundles are managed in WooCommerce (WPClever plugin),
 * while JLMops monitors inventory, suggests replacements, and tracks content.
 */

const BundleService = (function () {
  const SERVICE_NAME = 'BundleService';

  // Cache for bundle data within a session
  let _bundleCache = null;
  let _slotCache = null;
  let _cacheTimestamp = null;
  const CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Clears the internal cache.
   */
  function clearCache() {
    _bundleCache = null;
    _slotCache = null;
    _cacheTimestamp = null;
  }

  /**
   * Gets the SysBundles sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getBundlesSheet() {
    return SheetAccessor.getDataSheet('SysBundles');
  }

  /**
   * Gets the SysBundleSlots sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getSlotsSheet() {
    return SheetAccessor.getDataSheet('SysBundleSlots');
  }

  /**
   * Gets column indices for SysBundles sheet.
   * @returns {Object} Map of column names to 0-based indices
   */
  function _getBundleColumnIndices() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysBundles'];
    if (!schema || !schema.headers) {
      throw new Error('Schema for SysBundles not found in configuration.');
    }
    const headers = schema.headers.split(',');
    const indices = {};
    headers.forEach((h, i) => indices[h] = i);
    return indices;
  }

  /**
   * Gets column indices for SysBundleSlots sheet.
   * @returns {Object} Map of column names to 0-based indices
   */
  function _getSlotColumnIndices() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysBundleSlots'];
    if (!schema || !schema.headers) {
      throw new Error('Schema for SysBundleSlots not found in configuration.');
    }
    const headers = schema.headers.split(',');
    const indices = {};
    headers.forEach((h, i) => indices[h] = i);
    return indices;
  }

  /**
   * Loads all bundles into cache.
   * @returns {Array<Object>} Array of bundle objects
   */
  function _loadBundles() {
    const now = Date.now();
    if (_bundleCache && _cacheTimestamp && (now - _cacheTimestamp) < CACHE_TTL_MS) {
      return _bundleCache;
    }

    const sheet = _getBundlesSheet();
    if (!sheet) {
      LoggerService.warn(SERVICE_NAME, '_loadBundles', 'SysBundles sheet not found');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      _bundleCache = [];
      _cacheTimestamp = now;
      return [];
    }

    const cols = _getBundleColumnIndices();
    const bundles = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[cols.sb_BundleId]) continue; // Skip empty rows

      bundles.push({
        bundleId: String(row[cols.sb_BundleId]),
        nameEn: row[cols.sb_NameEn] || '',
        nameHe: row[cols.sb_NameHe] || '',
        type: row[cols.sb_Type] || 'Bundle',
        status: row[cols.sb_Status] || 'Draft',
        discountPrice: row[cols.sb_DiscountPrice] || '',
        rowNumber: i + 1 // 1-based for sheet operations
      });
    }

    _bundleCache = bundles;
    _cacheTimestamp = now;
    return bundles;
  }

  /**
   * Loads all slots into cache.
   * @returns {Array<Object>} Array of slot objects
   */
  function _loadSlots() {
    const now = Date.now();
    if (_slotCache && _cacheTimestamp && (now - _cacheTimestamp) < CACHE_TTL_MS) {
      return _slotCache;
    }

    const sheet = _getSlotsSheet();
    if (!sheet) {
      LoggerService.warn(SERVICE_NAME, '_loadSlots', 'SysBundleSlots sheet not found');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      _slotCache = [];
      _cacheTimestamp = now;
      return [];
    }

    const cols = _getSlotColumnIndices();
    const slots = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[cols.sbs_SlotId]) continue; // Skip empty rows

      slots.push({
        slotId: String(row[cols.sbs_SlotId]),
        bundleId: String(row[cols.sbs_BundleId]),
        order: Number(row[cols.sbs_Order]) || 0,
        slotType: row[cols.sbs_SlotType] || 'Product',
        // Text slot fields
        textStyle: row[cols.sbs_TextStyle] || '',
        textEn: row[cols.sbs_TextEn] || '',
        textHe: row[cols.sbs_TextHe] || '',
        // Product slot fields
        activeSKU: row[cols.sbs_ActiveSKU] ? String(row[cols.sbs_ActiveSKU]) : '',
        lastRotated: row[cols.sbs_LastRotated] || '',
        historyJson: row[cols.sbs_HistoryJson] || '[]',
        // Criteria fields
        category: row[cols.sbs_Category] || '',
        category2: row[cols.sbs_Category2] || '',
        priceMin: row[cols.sbs_PriceMin] !== '' ? Number(row[cols.sbs_PriceMin]) : null,
        priceMax: row[cols.sbs_PriceMax] !== '' ? Number(row[cols.sbs_PriceMax]) : null,
        intensity: row[cols.sbs_Intensity] !== '' ? Number(row[cols.sbs_Intensity]) : null,
        complexity: row[cols.sbs_Complexity] !== '' ? Number(row[cols.sbs_Complexity]) : null,
        acidity: row[cols.sbs_Acidity] !== '' ? Number(row[cols.sbs_Acidity]) : null,
        nameContains: row[cols.sbs_NameContains] || '',
        // Behavior fields
        exclusive: row[cols.sbs_Exclusive] === true || row[cols.sbs_Exclusive] === 'TRUE',
        qtyVariable: row[cols.sbs_QtyVariable] === true || row[cols.sbs_QtyVariable] === 'TRUE',
        defaultQty: row[cols.sbs_DefaultQty] !== '' ? Number(row[cols.sbs_DefaultQty]) : 1,
        rowNumber: i + 1
      });
    }

    _slotCache = slots;
    _cacheTimestamp = now;
    return slots;
  }

  /**
   * Calculates the total and display prices for a bundle.
   * @param {Object} bundle - Bundle object
   * @param {Array} bundleSlots - Slots for this bundle
   * @param {Object} priceMap - Map of SKU to price
   * @returns {Object} {totalPrice, displayPrice, discount}
   */
  function _calculateBundlePrice(bundle, bundleSlots, priceMap) {
    let totalPrice = 0;

    for (const slot of bundleSlots) {
      if (slot.slotType !== 'Product' || !slot.activeSKU) continue;
      const price = priceMap[slot.activeSKU] || 0;
      const qty = (slot.defaultQty === '' || slot.defaultQty == null) ? 1 : Number(slot.defaultQty);
      totalPrice += price * qty;
    }

    const discountPrice = bundle.discountPrice ? parseFloat(bundle.discountPrice) : null;
    const displayPrice = discountPrice !== null ? discountPrice : totalPrice;
    const discount = discountPrice !== null && totalPrice > 0 ? totalPrice - discountPrice : 0;

    return {
      totalPrice: Math.round(totalPrice * 100) / 100,
      displayPrice: Math.round(displayPrice * 100) / 100,
      discount: Math.round(discount * 100) / 100
    };
  }

  // =====================================================
  // PUBLIC API: Bundle CRUD
  // =====================================================

  /**
   * Gets all bundles with calculated prices.
   * Uses WebProdM for price data.
   * @returns {Array<Object>} Array of bundle objects with price info
   */
  function getAllBundles() {
    const bundles = _loadBundles();
    const allSlots = _loadSlots();

    // Build price map from WebProdM
    const allConfig = ConfigService.getAllConfig();
    const webSheet = SheetAccessor.getDataSheet('WebProdM', false);

    const priceMap = {};
    if (webSheet) {
      const webData = webSheet.getDataRange().getValues();
      const webSchema = allConfig['schema.data.WebProdM'];
      const webHeaders = webSchema.headers.split(',');
      const skuIdx = webHeaders.indexOf('wpm_SKU');
      const priceIdx = webHeaders.indexOf('wpm_RegularPrice');

      for (let i = 1; i < webData.length; i++) {
        const sku = String(webData[i][skuIdx] || '');
        if (sku) {
          priceMap[sku] = Number(webData[i][priceIdx]) || 0;
        }
      }
    }

    // Add price info to each bundle
    return bundles.map(bundle => {
      const bundleSlots = allSlots.filter(s => s.bundleId === bundle.bundleId);
      const priceInfo = _calculateBundlePrice(bundle, bundleSlots, priceMap);
      return {
        ...bundle,
        totalPrice: priceInfo.totalPrice,
        displayPrice: priceInfo.displayPrice,
        discount: priceInfo.discount,
        slotCount: bundleSlots.length
      };
    });
  }

  /**
   * Gets a bundle by ID.
   * @param {string} bundleId - The WooCommerce product ID
   * @returns {Object|null} Bundle object or null if not found
   */
  function getBundle(bundleId) {
    const bundles = _loadBundles();
    return bundles.find(b => b.bundleId === String(bundleId)) || null;
  }

  /**
   * Gets a bundle with all its slots and price info.
   * @param {string} bundleId - The bundle ID
   * @returns {Object|null} Bundle object with slots array and price info, or null
   */
  function getBundleWithSlots(bundleId) {
    const bundle = getBundle(bundleId);
    if (!bundle) return null;

    const allSlots = _loadSlots();
    const bundleSlots = allSlots
      .filter(s => s.bundleId === String(bundleId))
      .sort((a, b) => a.order - b.order);

    // Build price map from WebProdM for price calculation
    const allConfig = ConfigService.getAllConfig();
    const webSheet = SheetAccessor.getDataSheet('WebProdM', false);

    const priceMap = {};
    if (webSheet) {
      const webData = webSheet.getDataRange().getValues();
      const webSchema = allConfig['schema.data.WebProdM'];
      const webHeaders = webSchema.headers.split(',');
      const skuIdx = webHeaders.indexOf('wpm_SKU');
      const priceIdx = webHeaders.indexOf('wpm_RegularPrice');

      for (let i = 1; i < webData.length; i++) {
        const sku = String(webData[i][skuIdx] || '');
        if (sku) {
          priceMap[sku] = Number(webData[i][priceIdx]) || 0;
        }
      }
    }

    const priceInfo = _calculateBundlePrice(bundle, bundleSlots, priceMap);

    return {
      ...bundle,
      slots: bundleSlots,
      totalPrice: priceInfo.totalPrice,
      displayPrice: priceInfo.displayPrice,
      discount: priceInfo.discount
    };
  }

  /**
   * Creates a new bundle.
   * @param {Object} bundleData - Bundle data
   * @returns {Object} Created bundle object
   */
  function createBundle(bundleData) {
    const functionName = 'createBundle';
    const sheet = _getBundlesSheet();
    if (!sheet) {
      throw new Error('SysBundles sheet not found');
    }

    const cols = _getBundleColumnIndices();
    const newRow = new Array(Object.keys(cols).length).fill('');

    newRow[cols.sb_BundleId] = bundleData.bundleId;
    newRow[cols.sb_NameEn] = bundleData.nameEn || '';
    newRow[cols.sb_NameHe] = bundleData.nameHe || '';
    newRow[cols.sb_Type] = bundleData.type || 'Bundle';
    newRow[cols.sb_Status] = bundleData.status || 'Draft';
    newRow[cols.sb_DiscountPrice] = bundleData.discountPrice || '';

    sheet.appendRow(newRow);
    clearCache();

    LoggerService.info(SERVICE_NAME, functionName, `Created bundle: ${bundleData.bundleId}`);
    return getBundle(bundleData.bundleId);
  }

  /**
   * Updates an existing bundle.
   * @param {string} bundleId - Bundle ID to update
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated bundle or null if not found
   */
  function updateBundle(bundleId, updates) {
    const functionName = 'updateBundle';
    const bundle = getBundle(bundleId);
    if (!bundle) {
      LoggerService.warn(SERVICE_NAME, functionName, `Bundle not found: ${bundleId}`);
      return null;
    }

    const sheet = _getBundlesSheet();
    const cols = _getBundleColumnIndices();
    const row = bundle.rowNumber;

    if (updates.nameEn !== undefined) {
      sheet.getRange(row, cols.sb_NameEn + 1).setValue(updates.nameEn);
    }
    if (updates.nameHe !== undefined) {
      sheet.getRange(row, cols.sb_NameHe + 1).setValue(updates.nameHe);
    }
    if (updates.type !== undefined) {
      sheet.getRange(row, cols.sb_Type + 1).setValue(updates.type);
    }
    if (updates.status !== undefined) {
      sheet.getRange(row, cols.sb_Status + 1).setValue(updates.status);
    }
    if (updates.discountPrice !== undefined) {
      sheet.getRange(row, cols.sb_DiscountPrice + 1).setValue(updates.discountPrice);
    }

    clearCache();
    LoggerService.info(SERVICE_NAME, functionName, `Updated bundle: ${bundleId}`, updates);
    return getBundle(bundleId);
  }

  /**
   * Deletes a bundle and all its slots.
   * @param {string} bundleId - Bundle ID to delete
   * @returns {boolean} True if deleted
   */
  function deleteBundle(bundleId) {
    const functionName = 'deleteBundle';
    const bundle = getBundle(bundleId);
    if (!bundle) {
      LoggerService.warn(SERVICE_NAME, functionName, `Bundle not found: ${bundleId}`);
      return false;
    }

    // Delete all slots first
    const allSlots = _loadSlots();
    const bundleSlots = allSlots.filter(s => s.bundleId === String(bundleId));

    // Delete slots in reverse order to maintain row numbers
    const slotsSheet = _getSlotsSheet();
    bundleSlots
      .sort((a, b) => b.rowNumber - a.rowNumber)
      .forEach(slot => {
        slotsSheet.deleteRow(slot.rowNumber);
      });

    // Delete the bundle
    const bundlesSheet = _getBundlesSheet();
    bundlesSheet.deleteRow(bundle.rowNumber);

    clearCache();
    LoggerService.info(SERVICE_NAME, functionName, `Deleted bundle and ${bundleSlots.length} slots: ${bundleId}`);
    return true;
  }

  // =====================================================
  // PUBLIC API: Slot CRUD
  // =====================================================

  /**
   * Gets all slots for a bundle.
   * @param {string} bundleId - Bundle ID
   * @returns {Array<Object>} Array of slot objects
   */
  function getSlotsForBundle(bundleId) {
    const allSlots = _loadSlots();
    return allSlots
      .filter(s => s.bundleId === String(bundleId))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Gets a slot by ID.
   * @param {string} slotId - Slot ID
   * @returns {Object|null} Slot object or null
   */
  function getSlot(slotId) {
    const allSlots = _loadSlots();
    return allSlots.find(s => s.slotId === String(slotId)) || null;
  }

  /**
   * Creates a new slot.
   * @param {Object} slotData - Slot data
   * @returns {Object} Created slot object
   */
  function createSlot(slotData) {
    const functionName = 'createSlot';
    const sheet = _getSlotsSheet();
    if (!sheet) {
      throw new Error('SysBundleSlots sheet not found');
    }

    const cols = _getSlotColumnIndices();
    const newRow = new Array(Object.keys(cols).length).fill('');

    // Generate slot ID if not provided
    const slotId = slotData.slotId || `SLOT-${Date.now()}`;

    newRow[cols.sbs_SlotId] = slotId;
    newRow[cols.sbs_BundleId] = slotData.bundleId;
    newRow[cols.sbs_Order] = slotData.order || 1;
    newRow[cols.sbs_SlotType] = slotData.slotType || 'Product';

    // Text fields
    newRow[cols.sbs_TextStyle] = slotData.textStyle || '';
    newRow[cols.sbs_TextEn] = slotData.textEn || '';
    newRow[cols.sbs_TextHe] = slotData.textHe || '';

    // Product fields
    newRow[cols.sbs_ActiveSKU] = slotData.activeSKU || '';
    newRow[cols.sbs_LastRotated] = slotData.lastRotated || '';
    newRow[cols.sbs_HistoryJson] = slotData.historyJson || '[]';

    // Criteria fields
    newRow[cols.sbs_Category] = slotData.category || '';
    newRow[cols.sbs_Category2] = slotData.category2 || '';
    newRow[cols.sbs_PriceMin] = slotData.priceMin !== null && slotData.priceMin !== undefined ? slotData.priceMin : '';
    newRow[cols.sbs_PriceMax] = slotData.priceMax !== null && slotData.priceMax !== undefined ? slotData.priceMax : '';
    newRow[cols.sbs_Intensity] = slotData.intensity !== null && slotData.intensity !== undefined ? slotData.intensity : '';
    newRow[cols.sbs_Complexity] = slotData.complexity !== null && slotData.complexity !== undefined ? slotData.complexity : '';
    newRow[cols.sbs_Acidity] = slotData.acidity !== null && slotData.acidity !== undefined ? slotData.acidity : '';
    newRow[cols.sbs_NameContains] = slotData.nameContains || '';

    // Behavior fields
    newRow[cols.sbs_Exclusive] = slotData.exclusive ? 'TRUE' : '';
    newRow[cols.sbs_QtyVariable] = slotData.qtyVariable ? 'TRUE' : '';
    newRow[cols.sbs_DefaultQty] = (slotData.defaultQty === '' || slotData.defaultQty == null) ? 1 : Number(slotData.defaultQty);

    sheet.appendRow(newRow);
    clearCache();

    LoggerService.info(SERVICE_NAME, functionName, `Created slot: ${slotId} for bundle: ${slotData.bundleId}`);
    return getSlot(slotId);
  }

  /**
   * Updates a slot.
   * @param {string} slotId - Slot ID to update
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated slot or null
   */
  function updateSlot(slotId, updates) {
    const functionName = 'updateSlot';
    const slot = getSlot(slotId);
    if (!slot) {
      LoggerService.warn(SERVICE_NAME, functionName, `Slot not found: ${slotId}`);
      return null;
    }

    const sheet = _getSlotsSheet();
    const cols = _getSlotColumnIndices();
    const row = slot.rowNumber;

    // Validate row number
    if (!row || row < 2) {
      LoggerService.error(SERVICE_NAME, functionName, `Invalid row number for slot ${slotId}: ${row}`);
      throw new Error(`Invalid row number for slot: ${slotId}`);
    }

    // Build updates array for batch write
    const fieldMap = {
      order: 'sbs_Order',
      slotType: 'sbs_SlotType',
      textStyle: 'sbs_TextStyle',
      textEn: 'sbs_TextEn',
      textHe: 'sbs_TextHe',
      activeSKU: 'sbs_ActiveSKU',
      lastRotated: 'sbs_LastRotated',
      historyJson: 'sbs_HistoryJson',
      category: 'sbs_Category',
      category2: 'sbs_Category2',
      priceMin: 'sbs_PriceMin',
      priceMax: 'sbs_PriceMax',
      intensity: 'sbs_Intensity',
      complexity: 'sbs_Complexity',
      acidity: 'sbs_Acidity',
      nameContains: 'sbs_NameContains',
      exclusive: 'sbs_Exclusive',
      qtyVariable: 'sbs_QtyVariable',
      defaultQty: 'sbs_DefaultQty'
    };

    for (const [key, colName] of Object.entries(fieldMap)) {
      if (updates[key] !== undefined) {
        const colIndex = cols[colName];
        if (colIndex === undefined) {
          LoggerService.warn(SERVICE_NAME, functionName, `Column ${colName} not found in schema, skipping update for ${key}`);
          continue;
        }
        let value = updates[key];
        // Handle boolean fields
        if (key === 'exclusive' || key === 'qtyVariable') {
          value = value ? 'TRUE' : '';
        }
        sheet.getRange(row, colIndex + 1).setValue(value);
      }
    }

    clearCache();
    LoggerService.info(SERVICE_NAME, functionName, `Updated slot: ${slotId}`, updates);
    return getSlot(slotId);
  }

  /**
   * Deletes a slot.
   * @param {string} slotId - Slot ID to delete
   * @returns {boolean} True if deleted
   */
  function deleteSlot(slotId) {
    const functionName = 'deleteSlot';
    const slot = getSlot(slotId);
    if (!slot) {
      LoggerService.warn(SERVICE_NAME, functionName, `Slot not found: ${slotId}`);
      return false;
    }

    const sheet = _getSlotsSheet();
    sheet.deleteRow(slot.rowNumber);

    clearCache();
    LoggerService.info(SERVICE_NAME, functionName, `Deleted slot: ${slotId}`);
    return true;
  }

  // =====================================================
  // PUBLIC API: Product Assignment
  // =====================================================

  /**
   * Assigns a product to a slot, updating history.
   * @param {string} slotId - Slot ID
   * @param {string} sku - SKU to assign
   * @param {string} reason - Reason for change (e.g., "Low Stock", "Manual", "Initial Import")
   * @returns {Object|null} Updated slot or null
   */
  function assignProductToSlot(slotId, sku, reason) {
    const functionName = 'assignProductToSlot';
    const slot = getSlot(slotId);
    if (!slot) {
      LoggerService.warn(SERVICE_NAME, functionName, `Slot not found: ${slotId}`);
      return null;
    }

    if (slot.slotType !== 'Product') {
      LoggerService.warn(SERVICE_NAME, functionName, `Cannot assign product to non-Product slot: ${slotId}`);
      return null;
    }

    const now = new Date().toISOString();

    // Update history
    let history = [];
    try {
      history = JSON.parse(slot.historyJson || '[]');
    } catch (e) {
      LoggerService.warn(SERVICE_NAME, functionName, `Invalid history JSON for slot ${slotId}, resetting`);
    }

    // Close previous assignment if exists
    if (slot.activeSKU && history.length > 0) {
      const lastEntry = history[history.length - 1];
      if (!lastEntry.end) {
        lastEntry.end = now;
      }
    }

    // Add new assignment
    history.push({
      sku: sku,
      start: now,
      end: null,
      reason: reason || 'Manual'
    });

    // Update the slot
    return updateSlot(slotId, {
      activeSKU: sku,
      lastRotated: now,
      historyJson: JSON.stringify(history)
    });
  }

  // =====================================================
  // PUBLIC API: Eligible Products / Inventory Health
  // =====================================================

  /**
   * Finds products eligible for a slot based on its criteria.
   * Uses WebProdM for product data (categories, stock, price).
   * @param {string} slotId - Slot ID
   * @param {Object} options - Options like {limit: 10, excludeExclusiveSKUs: true}
   * @returns {Array<Object>} Array of eligible products with stock info
   */
  function getEligibleProducts(slotId, options = {}) {
    const functionName = 'getEligibleProducts';
    const ctx = options.ctx || null;

    // Resolve the slot from the preloaded ctx when present (avoids a per-call _loadSlots), else read.
    const slot = ctx ? (ctx.allSlots.find(s => s.slotId === String(slotId)) || null) : getSlot(slotId);
    if (!slot) {
      LoggerService.warn(SERVICE_NAME, functionName, `Slot not found: ${slotId}`);
      return [];
    }

    if (slot.slotType !== 'Product') {
      return [];
    }

    const limit = options.limit || 20;

    // Invariant inputs (minStock, WebProdM rows+cols, the WebDetM details map, all slots).
    // Fix A (PERFORMANCE_OPTIMIZATION_PLAN "Bundles Health Check — N+1 Sheet Reads"): when the
    // caller supplies options.ctx, reuse the preloaded data and skip the per-call sheet reads —
    // this collapses getBundlesWithLowInventory's per-slot N+1 to a single set of reads. When ctx
    // is absent (the interactive editor path) it reads sheets exactly as before — behavior-identical.
    let minStock, webData, webCols, detailsMap, allSlots;
    if (ctx) {
      minStock = ctx.minStock;
      webData = ctx.webData;
      webCols = ctx.webCols;
      detailsMap = ctx.detailsMap;
      allSlots = ctx.allSlots;
    } else {
      const allConfig = ConfigService.getAllConfig();
      const minStockConfig = allConfig['system.inventory.minimum_stock'];
      minStock = minStockConfig ? parseInt(minStockConfig.value, 10) : 6;
      const webSheet = SheetAccessor.getDataSheet('WebProdM', false);

      if (!webSheet) {
        LoggerService.warn(SERVICE_NAME, functionName, 'WebProdM sheet not found');
        return [];
      }

      webData = webSheet.getDataRange().getValues();
      if (webData.length <= 1) return [];

      const webSchema = allConfig['schema.data.WebProdM'];
      webCols = {};
      webSchema.headers.split(',').forEach((h, i) => webCols[h] = i);

      // Get WebDetM for intensity/complexity/acidity if criteria specified
      detailsMap = {};
      if (slot.intensity !== null || slot.complexity !== null || slot.acidity !== null) {
        const detSheet = SheetAccessor.getDataSheet('WebDetM', false);
        if (detSheet) {
          const detData = detSheet.getDataRange().getValues();
          const detSchema = allConfig['schema.data.WebDetM'];
          const detCols = {};
          detSchema.headers.split(',').forEach((h, i) => detCols[h] = i);

          for (let i = 1; i < detData.length; i++) {
            const row = detData[i];
            const sku = String(row[detCols.wdm_SKU] || '');
            if (sku) {
              detailsMap[sku] = {
                intensity: row[detCols.wdm_Intensity] !== '' ? Number(row[detCols.wdm_Intensity]) : null,
                complexity: row[detCols.wdm_Complexity] !== '' ? Number(row[detCols.wdm_Complexity]) : null,
                acidity: row[detCols.wdm_Acidity] !== '' ? Number(row[detCols.wdm_Acidity]) : null
              };
            }
          }
        }
      }

      allSlots = _loadSlots();
    }

    if (!webData || webData.length <= 1) return [];

    // Get SKUs to exclude
    let excludedSKUs = new Set();

    // Exclude SKUs already used in other slots of the same bundle
    allSlots.forEach(s => {
      if (s.bundleId === slot.bundleId && s.activeSKU && s.slotId !== slotId) {
        excludedSKUs.add(s.activeSKU);
      }
    });

    // Also exclude SKUs from exclusive slots in other bundles
    if (options.excludeExclusiveSKUs) {
      allSlots.forEach(s => {
        if (s.exclusive && s.activeSKU && s.slotId !== slotId) {
          excludedSKUs.add(s.activeSKU);
        }
      });
    }

    // Filter products
    const eligible = [];
    let debugStats = { total: 0, noSku: 0, notPublished: 0, excluded: 0, lowStock: 0, passed: 0 };

    for (let i = 1; i < webData.length; i++) {
      const row = webData[i];
      const sku = String(row[webCols.wpm_SKU] || '');
      debugStats.total++;
      if (!sku) {
        debugStats.noSku++;
        continue;
      }

      // Only include published products (accept 'publish', '1', or treat non-draft as published)
      const postStatus = String(row[webCols.wpm_PostStatus] || '').toLowerCase().trim();
      const productType = String(row[webCols.wpm_TaxProductType] || '').toLowerCase().trim();

      // Skip bundles (woosb) - we want simple/variable products only
      if (productType === 'woosb' || productType === 'bundle') continue;

      // Accept 'publish' or '1' as published status
      if (postStatus !== 'publish' && postStatus !== '1' && postStatus !== '') {
        debugStats.notPublished++;
        continue;
      }

      // Skip excluded SKUs (same bundle + exclusive slots)
      if (excludedSKUs.has(sku)) {
        debugStats.excluded++;
        continue;
      }

      const price = Number(row[webCols.wpm_RegularPrice]) || 0;
      const stock = Number(row[webCols.wpm_Stock]) || 0;
      const name = String(row[webCols.wpm_PostTitle] || '');
      const categoriesStr = String(row[webCols.wpm_TaxProductCat] || '');
      const categories = categoriesStr.split(',').map(c => c.trim()).filter(c => c);

      // Skip products below minimum stock level
      if (stock < minStock) {
        debugStats.lowStock++;
        continue;
      }

      // Apply criteria filters

      // Category filter - exact match in category list
      if (slot.category && !categories.includes(slot.category)) continue;
      if (slot.category2 && !categories.includes(slot.category2)) continue;

      // Price range
      if (slot.priceMin !== null && price < slot.priceMin) continue;
      if (slot.priceMax !== null && price > slot.priceMax) continue;

      // Name contains
      if (slot.nameContains && name.toLowerCase().indexOf(slot.nameContains.toLowerCase()) === -1) continue;

      // Intensity/Complexity/Acidity from WebDetM (exact match if specified)
      const details = detailsMap[sku] || {};
      if (slot.intensity !== null && details.intensity !== null && details.intensity !== slot.intensity) continue;
      if (slot.complexity !== null && details.complexity !== null && details.complexity !== slot.complexity) continue;
      if (slot.acidity !== null && details.acidity !== null && details.acidity !== slot.acidity) continue;

      // Product matches criteria
      debugStats.passed++;
      // Profit rate (wpm_ProfitRate) for the selector — frontend display owned by the editor
      // (BUNDLE_PLAN Stage 3 "profit in the selector"; ADMIN_BUNDLES_UI_PLAN Phase 3 renders it).
      const prIdx = webCols.wpm_ProfitRate;
      const profitRate = (prIdx !== undefined && row[prIdx] !== '' && row[prIdx] !== null && row[prIdx] !== undefined)
        ? Number(row[prIdx]) : null;

      eligible.push({
        sku: sku,
        nameEn: name,
        price: price,
        profitRate: profitRate,
        stock: stock,
        categories: categories,
        intensity: details.intensity,
        complexity: details.complexity,
        acidity: details.acidity
      });

      if (eligible.length >= limit) break;
    }

    // Log debug stats
    LoggerService.info(SERVICE_NAME, functionName, `Slot ${slotId} eligible search: ${JSON.stringify(debugStats)}, minStock=${minStock}`);

    // Sort by stock descending (prefer products with more stock)
    eligible.sort((a, b) => b.stock - a.stock);

    return eligible;
  }

  /**
   * Gets all bundles that have slots with low inventory products.
   * Uses WebProdM for stock and product data.
   * @param {number} threshold - Stock threshold (uses system config if not specified)
   * @returns {Array<Object>} Array of {bundle, lowStockSlots: [{slot, product, stock, suggestions}]}
   */
  function getBundlesWithLowInventory(threshold) {
    const functionName = 'getBundlesWithLowInventory';
    const bundles = _loadBundles().filter(b => b.status === 'Active');
    const allSlots = _loadSlots();

    const allConfig = ConfigService.getAllConfig();

    // Use config threshold if not specified
    if (threshold === undefined || threshold === null) {
      const minStockConfig = allConfig['system.inventory.minimum_stock'];
      threshold = minStockConfig ? parseInt(minStockConfig.value, 10) : 6;
    }

    // 1. Read CmxProdM for Comax stock (source of truth)
    const cmxSheet = SheetAccessor.getDataSheet('CmxProdM', false);
    if (!cmxSheet) {
      LoggerService.warn(SERVICE_NAME, functionName, 'CmxProdM sheet not found');
      return [];
    }

    const cmxData = cmxSheet.getDataRange().getValues();
    const cmxSchema = allConfig['schema.data.CmxProdM'];
    const cmxHeaders = cmxSchema.headers.split(',');
    const cmxCols = {};
    cmxHeaders.forEach((h, i) => cmxCols[h] = i);

    const comaxStockMap = {};
    const productMap = {};
    for (let i = 1; i < cmxData.length; i++) {
      const row = cmxData[i];
      const sku = String(row[cmxCols.cpm_SKU] || '');
      if (sku) {
        comaxStockMap[sku] = Number(row[cmxCols.cpm_Stock]) || 0;
        productMap[sku] = {
          nameEn: '',
          nameHe: row[cmxCols.cpm_NameHe] || '',
          price: Number(row[cmxCols.cpm_Price]) || 0
        };
      }
    }

    // 2. Read SysInventoryOnHold for on-hold order quantities
    const spreadsheet = SheetAccessor.getDataSpreadsheet();
    const onHoldSheet = spreadsheet.getSheetByName('SysInventoryOnHold');
    const onHoldMap = {};
    if (onHoldSheet && onHoldSheet.getLastRow() > 1) {
      const onHoldData = onHoldSheet.getDataRange().getValues();
      // Schema: sio_SKU, sio_OnHoldQuantity
      for (let i = 1; i < onHoldData.length; i++) {
        const sku = String(onHoldData[i][0] || '');
        const qty = Number(onHoldData[i][1]) || 0;
        if (sku) onHoldMap[sku] = qty;
      }
    }

    // 3. Read WebProdM once — for English names here AND as the invariant context handed to
    //    getEligibleProducts below (Fix A: build the per-slot inputs once, not per low-stock slot).
    let webData = [];
    const webCols = {};
    const webSheet = spreadsheet.getSheetByName('WebProdM');
    if (webSheet) {
      webData = webSheet.getDataRange().getValues();
      const webSchema = allConfig['schema.data.WebProdM'];
      webSchema.headers.split(',').forEach((h, i) => webCols[h] = i);

      for (let i = 1; i < webData.length; i++) {
        const row = webData[i];
        const sku = String(row[webCols.wpm_SKU] || '');
        if (sku && productMap[sku]) {
          productMap[sku].nameEn = row[webCols.wpm_PostTitle] || '';
        }
      }
    }

    // Build the WebDetM details map once (unconditionally — amortized across all slots).
    const detailsMap = {};
    const detSheet = SheetAccessor.getDataSheet('WebDetM', false);
    if (detSheet) {
      const detData = detSheet.getDataRange().getValues();
      const detSchema = allConfig['schema.data.WebDetM'];
      const detCols = {};
      detSchema.headers.split(',').forEach((h, i) => detCols[h] = i);
      for (let i = 1; i < detData.length; i++) {
        const row = detData[i];
        const sku = String(row[detCols.wdm_SKU] || '');
        if (sku) {
          detailsMap[sku] = {
            intensity: row[detCols.wdm_Intensity] !== '' ? Number(row[detCols.wdm_Intensity]) : null,
            complexity: row[detCols.wdm_Complexity] !== '' ? Number(row[detCols.wdm_Complexity]) : null,
            acidity: row[detCols.wdm_Acidity] !== '' ? Number(row[detCols.wdm_Acidity]) : null
          };
        }
      }
    }

    // getEligibleProducts' own minStock floor is the config minimum_stock (independent of the
    // low-inventory `threshold` arg) — matches what it reads for itself when ctx is absent.
    const minStockConfig = allConfig['system.inventory.minimum_stock'];
    const eligibleMinStock = minStockConfig ? parseInt(minStockConfig.value, 10) : 6;

    const ctx = { webData: webData, webCols: webCols, detailsMap: detailsMap, allSlots: allSlots, minStock: eligibleMinStock };

    const results = [];

    for (const bundle of bundles) {
      const bundleSlots = allSlots.filter(s => s.bundleId === bundle.bundleId && s.slotType === 'Product');
      const lowStockSlots = [];

      for (const slot of bundleSlots) {
        if (!slot.activeSKU) continue;

        // Calculate available stock: Comax stock minus on-hold quantities
        const comaxStock = comaxStockMap[slot.activeSKU];
        if (comaxStock === undefined) continue; // SKU not in Comax
        const onHoldQty = onHoldMap[slot.activeSKU] || 0;
        const stock = comaxStock - onHoldQty;

        if (stock < threshold) {
          // Get suggestions
          const suggestions = getEligibleProducts(slot.slotId, {
            limit: 5,
            excludeExclusiveSKUs: true,
            ctx: ctx
          });

          lowStockSlots.push({
            slot: slot,
            product: productMap[slot.activeSKU] || { nameEn: 'Unknown', price: 0 },
            currentSKU: slot.activeSKU,
            stock: stock,
            suggestions: suggestions
          });
        }
      }

      if (lowStockSlots.length > 0) {
        results.push({
          bundle: bundle,
          lowStockSlots: lowStockSlots
        });
      }
    }

    return results;
  }

  // =====================================================
  // PUBLIC API: Import from WooCommerce
  // =====================================================

  /**
   * Parses woosb_ids JSON and extracts data, with JSON cleaning.
   * @param {string} jsonStr - Raw JSON string
   * @param {string} bundleId - Bundle ID for logging
   * @param {string} lang - Language code for logging (en/he)
   * @returns {Object} Parsed data or empty object
   */
  function _parseWoosbJson(jsonStr, bundleId, lang) {
    const functionName = '_parseWoosbJson';
    if (!jsonStr || jsonStr === '') return {};

    try {
      // Clean JSON string: remove BOM, trim whitespace, handle common issues
      let cleanJson = String(jsonStr)
        .replace(/^\uFEFF/, '') // Remove BOM
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
        .trim();

      // Handle double-escaped JSON (can happen with CSV imports)
      if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
        cleanJson = cleanJson.slice(1, -1).replace(/\\"/g, '"');
      }

      // Fix invalid escape sequences but preserve valid ones (\", \\, \/, \b, \f, \n, \r, \t, \uXXXX)
      // Only remove backslashes followed by chars that aren't valid JSON escapes
      cleanJson = cleanJson.replace(/\\(?!["\\/bfnrtu])/g, '');

      if (cleanJson.length > 10) {
        LoggerService.info(SERVICE_NAME, functionName, `Parsing woosb_ids (${lang}) for ${bundleId}: ${cleanJson.length} chars`);
      }

      const parsed = JSON.parse(cleanJson);

      // Log first text slot content for debugging Hebrew
      if (lang === 'he') {
        const entries = Object.entries(parsed);
        for (const [key, val] of entries) {
          if (val && val.type && val.text) {
            LoggerService.info(SERVICE_NAME, functionName, `Hebrew text slot [${key}]: "${val.text.substring(0, 30)}..."`);
            break;
          }
        }
      }

      return parsed;
    } catch (e) {
      const preview = String(jsonStr).substring(0, 100);
      LoggerService.warn(SERVICE_NAME, functionName, `Invalid woosb_ids JSON (${lang}) for bundle ${bundleId}: ${e.message}. Preview: ${preview}`);
      return {};
    }
  }

  /**
   * Parses woosb_ids JSON and creates/updates bundle structure.
   * @param {string} bundleId - WooCommerce product ID for the bundle
   * @param {string} woosbIdsJson - JSON string from Meta: woosb_ids field (English)
   * @param {Object} bundleInfo - Additional bundle info {nameEn, nameHe, type, woosbIdsJsonHe}
   * @returns {Object} Created/updated bundle with slots
   */
  function importBundleFromWooCommerce(bundleId, woosbIdsJson, bundleInfo = {}) {
    const functionName = 'importBundleFromWooCommerce';

    // Parse English woosb_ids
    const woosbData = _parseWoosbJson(woosbIdsJson, bundleId, 'en');
    const entryCount = Object.keys(woosbData).length;
    if (entryCount > 0) {
      LoggerService.info(SERVICE_NAME, functionName, `Parsed ${entryCount} entries from woosb_ids for bundle ${bundleId}`);
    } else if (!woosbIdsJson || woosbIdsJson === '') {
      LoggerService.info(SERVICE_NAME, functionName, `Bundle ${bundleId} has empty woosb_ids, creating bundle without slots`);
    }

    // Parse Hebrew woosb_ids if provided (for text slot translations)
    const woosbDataHe = _parseWoosbJson(bundleInfo.woosbIdsJsonHe, bundleId, 'he');

    // Create or update bundle
    let bundle = getBundle(bundleId);
    if (!bundle) {
      bundle = createBundle({
        bundleId: bundleId,
        nameEn: bundleInfo.nameEn || '',
        nameHe: bundleInfo.nameHe || '',
        type: bundleInfo.type || 'Bundle',
        status: bundleInfo.status || 'Draft'
      });
    } else {
      // Update bundle with new info
      const updates = {};
      if (bundleInfo.nameEn) updates.nameEn = bundleInfo.nameEn;
      if (bundleInfo.nameHe) updates.nameHe = bundleInfo.nameHe;
      if (bundleInfo.status) updates.status = bundleInfo.status;
      if (Object.keys(updates).length > 0) {
        updateBundle(bundleId, updates);
      }
    }

    // Preserve existing slot criteria before rebuild (keyed by activeSKU for product slots)
    const existingSlots = getSlotsForBundle(bundleId);
    const preservedCriteria = {};
    existingSlots.forEach(slot => {
      if (slot.slotType === 'Product' && slot.activeSKU) {
        preservedCriteria[slot.activeSKU] = {
          category: slot.category,
          category2: slot.category2,
          priceMin: slot.priceMin,
          priceMax: slot.priceMax,
          intensity: slot.intensity,
          complexity: slot.complexity,
          acidity: slot.acidity,
          nameContains: slot.nameContains,
          exclusive: slot.exclusive
          // qtyVariable intentionally NOT preserved — `optional` is a web-carried field, so
          // it's re-derived from web each time (Stage 3 fix 2026-06-07). Preserving it froze
          // ops at the pre-optional state and broke the export diff (all bundles flagged).
        };
      }
    });

    // Delete existing slots to rebuild
    existingSlots.forEach(slot => deleteSlot(slot.slotId));

    // Parse woosb_ids entries
    // Format: {"key1": {"type":"h6","text":"..."}, "key2": {"id":"123","sku":"456","qty":"1",...}}
    const entries = Object.entries(woosbData);
    let order = 1;

    // Valid text slot types (h1-h6, p, none, span, etc.)
    const textSlotTypes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'none', 'span', 'div'];

    // HE section-header text, matched by ORDINAL (not key): WPClever uses different woosb keys
    // per language, but text slots are parallel-ordered EN/HE (Stage 3 fix 2026-06-07).
    const heTexts = Object.keys(woosbDataHe || {})
      .filter(function (k) { const v = woosbDataHe[k] || {}; return v.type !== undefined && v.text !== undefined && v.id === undefined && v.sku === undefined; })
      .map(function (k) { return (woosbDataHe[k].text || '').trim(); });
    let heTextIdx = 0;

    for (const [key, value] of entries) {
      if (value.type && textSlotTypes.includes(value.type.toLowerCase())) {
        // Text slot — HE text by ordinal (keys differ per language; sections parallel)
        const textHe = (heTextIdx < heTexts.length) ? heTexts[heTextIdx] : '';
        heTextIdx++;

        createSlot({
          slotId: `${bundleId}-${key}`,
          bundleId: bundleId,
          order: order,
          slotType: 'Text',
          textStyle: value.type,
          textEn: value.text || '',
          textHe: textHe
        });
      } else if (value.id || value.sku) {
        // Product slot - restore preserved criteria if available
        const sku = value.sku || '';
        const preserved = preservedCriteria[sku] || {};

        createSlot({
          slotId: `${bundleId}-${key}`,
          bundleId: bundleId,
          order: order,
          slotType: 'Product',
          activeSKU: sku,
          defaultQty: (value.qty === '' || value.qty == null) ? 1 : Number(value.qty),
          qtyVariable: (value.optional === '1'),  // re-derive from web each time; not preserved
          exclusive: preserved.exclusive || false,
          // Restore criteria from previous slot (if same SKU was in bundle before)
          category: preserved.category || '',
          category2: preserved.category2 || '',
          priceMin: preserved.priceMin !== undefined ? preserved.priceMin : null,
          priceMax: preserved.priceMax !== undefined ? preserved.priceMax : null,
          intensity: preserved.intensity !== undefined ? preserved.intensity : null,
          complexity: preserved.complexity !== undefined ? preserved.complexity : null,
          acidity: preserved.acidity !== undefined ? preserved.acidity : null,
          nameContains: preserved.nameContains || ''
        });
      }
      order++;
    }

    LoggerService.info(SERVICE_NAME, functionName, `Imported bundle ${bundleId} with ${order - 1} slots`);
    return getBundleWithSlots(bundleId);
  }

  /**
   * Batch reimport — rebuilds SysBundles + SysBundleSlots in 4-6 sheet ops
   * total (vs ~250 per-row ops in the per-bundle importBundleFromWooCommerce
   * path). Used by WebAppBundles_reimportAllBundles when refreshing all
   * bundles after a sync. Preserves per-slot manager-edited criteria
   * (category / priceMin / intensity / etc.) keyed by (bundleId, sku).
   *
   * @param {Array<Object>} bundlesInput — pre-collected bundle metadata,
   *   each { bundleId, nameEn, nameHe, type, status, woosbIds, woosbIdsHe }.
   *   Caller (WebAppBundles_reimportAllBundles) extracts from WebProdM/WebXltM.
   * @returns {Object} { imported, failed, slotCount }
   */
  function reimportAllBundlesBatch(bundlesInput) {
    const functionName = 'reimportAllBundlesBatch';

    const bundlesSheet = _getBundlesSheet();
    const slotsSheet = _getSlotsSheet();
    if (!bundlesSheet || !slotsSheet) {
      throw new Error('SysBundles or SysBundleSlots sheet not found');
    }

    const bundleCols = _getBundleColumnIndices();
    const slotCols = _getSlotColumnIndices();
    const bundleColCount = Object.keys(bundleCols).length;
    const slotColCount = Object.keys(slotCols).length;

    // 1. Read existing slots once → preservedCriteria by (bundleId, sku).
    const existingSlotsData = slotsSheet.getDataRange().getValues();
    const preservedByBundleSku = {};
    for (let i = 1; i < existingSlotsData.length; i++) {
      const row = existingSlotsData[i];
      if (row[slotCols.sbs_SlotType] !== 'Product') continue;
      const bundleId = row[slotCols.sbs_BundleId];
      const sku = row[slotCols.sbs_ActiveSKU];
      if (!bundleId || !sku) continue;
      if (!preservedByBundleSku[bundleId]) preservedByBundleSku[bundleId] = {};
      preservedByBundleSku[bundleId][sku] = {
        category: row[slotCols.sbs_Category],
        category2: row[slotCols.sbs_Category2],
        priceMin: row[slotCols.sbs_PriceMin],
        priceMax: row[slotCols.sbs_PriceMax],
        intensity: row[slotCols.sbs_Intensity],
        complexity: row[slotCols.sbs_Complexity],
        acidity: row[slotCols.sbs_Acidity],
        nameContains: row[slotCols.sbs_NameContains],
        exclusive: row[slotCols.sbs_Exclusive] === 'TRUE'
        // qtyVariable NOT preserved — re-derived from web `optional` each run (Stage 3 fix 2026-06-07)
      };
    }

    // 2. Build new rows entirely in memory.
    const textSlotTypes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'none', 'span', 'div'];
    const newBundleRows = [];
    const newSlotRows = [];
    let imported = 0;
    let failed = 0;

    for (const b of bundlesInput) {
      try {
        const woosbData = _parseWoosbJson(b.woosbIds, b.bundleId, 'en');
        const woosbDataHe = _parseWoosbJson(b.woosbIdsHe, b.bundleId, 'he');

        const bundleRow = new Array(bundleColCount).fill('');
        bundleRow[bundleCols.sb_BundleId] = b.bundleId;
        bundleRow[bundleCols.sb_NameEn] = b.nameEn || '';
        bundleRow[bundleCols.sb_NameHe] = b.nameHe || '';
        bundleRow[bundleCols.sb_Type] = b.type || 'Bundle';
        bundleRow[bundleCols.sb_Status] = b.status || 'Draft';
        bundleRow[bundleCols.sb_DiscountPrice] = '';
        newBundleRows.push(bundleRow);

        const preserved = preservedByBundleSku[b.bundleId] || {};
        const entries = Object.entries(woosbData);
        let order = 1;

        // HE section-header text matched by ORDINAL (keys differ per language; sections parallel).
        const heTexts = Object.keys(woosbDataHe || {})
          .filter(function (k) { const v = woosbDataHe[k] || {}; return v.type !== undefined && v.text !== undefined && v.id === undefined && v.sku === undefined; })
          .map(function (k) { return (woosbDataHe[k].text || '').trim(); });
        let heTextIdx = 0;

        for (const [key, value] of entries) {
          const slotRow = new Array(slotColCount).fill('');
          slotRow[slotCols.sbs_SlotId] = `${b.bundleId}-${key}`;
          slotRow[slotCols.sbs_BundleId] = b.bundleId;
          slotRow[slotCols.sbs_Order] = order;
          slotRow[slotCols.sbs_HistoryJson] = '[]';

          if (value.type && textSlotTypes.includes(value.type.toLowerCase())) {
            slotRow[slotCols.sbs_SlotType] = 'Text';
            slotRow[slotCols.sbs_TextStyle] = value.type;
            slotRow[slotCols.sbs_TextEn] = value.text || '';
            slotRow[slotCols.sbs_TextHe] = (heTextIdx < heTexts.length) ? heTexts[heTextIdx] : '';
            heTextIdx++;
            slotRow[slotCols.sbs_DefaultQty] = 1;
            newSlotRows.push(slotRow);
          } else if (value.id || value.sku) {
            const sku = value.sku || '';
            const pcrit = preserved[sku] || {};
            slotRow[slotCols.sbs_SlotType] = 'Product';
            slotRow[slotCols.sbs_ActiveSKU] = sku;
            slotRow[slotCols.sbs_DefaultQty] = (value.qty === '' || value.qty == null) ? 1 : Number(value.qty);
            slotRow[slotCols.sbs_QtyVariable] = (value.optional === '1') ? 'TRUE' : '';
            slotRow[slotCols.sbs_Exclusive] = pcrit.exclusive ? 'TRUE' : '';
            slotRow[slotCols.sbs_Category] = pcrit.category || '';
            slotRow[slotCols.sbs_Category2] = pcrit.category2 || '';
            slotRow[slotCols.sbs_PriceMin] = (pcrit.priceMin !== null && pcrit.priceMin !== undefined && pcrit.priceMin !== '') ? pcrit.priceMin : '';
            slotRow[slotCols.sbs_PriceMax] = (pcrit.priceMax !== null && pcrit.priceMax !== undefined && pcrit.priceMax !== '') ? pcrit.priceMax : '';
            slotRow[slotCols.sbs_Intensity] = (pcrit.intensity !== null && pcrit.intensity !== undefined && pcrit.intensity !== '') ? pcrit.intensity : '';
            slotRow[slotCols.sbs_Complexity] = (pcrit.complexity !== null && pcrit.complexity !== undefined && pcrit.complexity !== '') ? pcrit.complexity : '';
            slotRow[slotCols.sbs_Acidity] = (pcrit.acidity !== null && pcrit.acidity !== undefined && pcrit.acidity !== '') ? pcrit.acidity : '';
            slotRow[slotCols.sbs_NameContains] = pcrit.nameContains || '';
            newSlotRows.push(slotRow);
          }
          // else: empty / unknown entry — skip but advance order.
          order++;
        }
        imported++;
      } catch (e) {
        LoggerService.warn(SERVICE_NAME, functionName, `Failed bundle ${b.bundleId}: ${e.message}`);
        failed++;
      }
    }

    // 3. Clear existing data rows + batch write the new ones.
    const oldBundlesLast = bundlesSheet.getLastRow();
    const oldSlotsLast = slotsSheet.getLastRow();
    if (oldBundlesLast > 1) {
      bundlesSheet.getRange(2, 1, oldBundlesLast - 1, bundlesSheet.getLastColumn()).clearContent();
    }
    if (oldSlotsLast > 1) {
      slotsSheet.getRange(2, 1, oldSlotsLast - 1, slotsSheet.getLastColumn()).clearContent();
    }
    if (newBundleRows.length > 0) {
      bundlesSheet.getRange(2, 1, newBundleRows.length, bundleColCount).setValues(newBundleRows);
    }
    if (newSlotRows.length > 0) {
      slotsSheet.getRange(2, 1, newSlotRows.length, slotColCount).setValues(newSlotRows);
    }
    // Trim trailing rows so the sheet doesn't grow over time.
    const newBundlesLast = 1 + newBundleRows.length;
    const newSlotsLast = 1 + newSlotRows.length;
    if (oldBundlesLast > newBundlesLast) {
      bundlesSheet.deleteRows(newBundlesLast + 1, oldBundlesLast - newBundlesLast);
    }
    if (oldSlotsLast > newSlotsLast) {
      slotsSheet.deleteRows(newSlotsLast + 1, oldSlotsLast - newSlotsLast);
    }
    SpreadsheetApp.flush();
    clearCache();

    LoggerService.info(SERVICE_NAME, functionName,
      `Batch reimport complete. Bundles: ${imported}, slots: ${newSlotRows.length}, failed: ${failed}`);

    return { imported: imported, failed: failed, slotCount: newSlotRows.length };
  }

  /**
   * Duplicates a bundle for creating variations.
   * @param {string} sourceBundleId - Bundle to duplicate
   * @param {string} newBundleId - ID for the new bundle
   * @param {Object} overrides - Optional field overrides {nameEn, nameHe, status}
   * @returns {Object} New bundle with slots
   */
  function duplicateBundle(sourceBundleId, newBundleId, overrides = {}) {
    const functionName = 'duplicateBundle';
    const source = getBundleWithSlots(sourceBundleId);
    if (!source) {
      LoggerService.warn(SERVICE_NAME, functionName, `Source bundle not found: ${sourceBundleId}`);
      return null;
    }

    // Create new bundle
    const newBundle = createBundle({
      bundleId: newBundleId,
      nameEn: overrides.nameEn || `${source.nameEn} (Copy)`,
      nameHe: overrides.nameHe || `${source.nameHe} (עותק)`,
      type: source.type,
      status: overrides.status || 'Draft',
      discountPrice: source.discountPrice
    });

    // Duplicate slots
    source.slots.forEach((slot, idx) => {
      createSlot({
        slotId: `${newBundleId}-${idx + 1}`,
        bundleId: newBundleId,
        order: slot.order,
        slotType: slot.slotType,
        textStyle: slot.textStyle,
        textEn: slot.textEn,
        textHe: slot.textHe,
        activeSKU: slot.activeSKU,
        defaultQty: slot.defaultQty,
        qtyVariable: slot.qtyVariable,
        category: slot.category,
        priceMin: slot.priceMin,
        priceMax: slot.priceMax,
        intensity: slot.intensity,
        complexity: slot.complexity,
        acidity: slot.acidity,
        nameContains: slot.nameContains,
        exclusive: slot.exclusive,
        historyJson: '[]' // Reset history for new bundle
      });
    });

    LoggerService.info(SERVICE_NAME, functionName, `Duplicated bundle ${sourceBundleId} to ${newBundleId}`);
    return getBundleWithSlots(newBundleId);
  }

  /**
   * Gets bundle statistics for dashboard.
   * @returns {Object} Stats object
   */
  function getBundleStats(includeInventory) {
    if (includeInventory === undefined) includeInventory = true;
    const bundles = _loadBundles();

    const stats = {
      total: bundles.length,
      active: bundles.filter(b => b.status === 'Active').length,
      draft: bundles.filter(b => b.status === 'Draft').length,
      archived: bundles.filter(b => b.status === 'Archived').length
    };

    // The low-inventory counters require the heavy getBundlesWithLowInventory() pass.
    // The Bundles view mount passes includeInventory=false to stay fast (its attention
    // counter is filled by the lazy health fetch); background callers (housekeeping
    // monthly review) keep the default true.
    if (includeInventory) {
      const lowInventory = getBundlesWithLowInventory();
      stats.needsAttention = lowInventory.length;
      stats.lowInventoryCount = lowInventory.reduce((sum, b) => sum + b.lowStockSlots.length, 0);
    }

    return stats;
  }

  // =====================================================
  // EN/HE COMPOSITION PARITY VALIDATION
  // =====================================================

  /**
   * Splits an ordered slot array into sections delimited by text/HTML slots.
   * A section = a (text-slot-header? + product-slots-following) until the next text slot.
   * Slots before the first text slot form an implicit section with header=null.
   * @param {Array<Object>} slots - Ordered slot objects
   * @returns {Array<{header: Object|null, products: Array<Object>}>}
   */
  function _splitIntoSections(slots) {
    const sections = [];
    let current = { header: null, products: [] };
    for (const slot of slots) {
      if (slot.type === 'text') {
        if (current.header !== null || current.products.length > 0) {
          sections.push(current);
        }
        current = { header: slot, products: [] };
      } else {
        current.products.push(slot);
      }
    }
    if (current.header !== null || current.products.length > 0) {
      sections.push(current);
    }
    return sections;
  }

  /**
   * Validates a single EN/HE bundle pair per CRM_PLAN-style atomic (product_id, qty) check.
   * Section-aware. Returns array of issue objects (empty if no drift).
   */
  function _validateBundlePairParity(enBundleId, enWoosbJson, heWoosbJson, enToHeMap) {
    const issues = [];

    const enParsed = _parseWoosbJson(enWoosbJson, enBundleId, 'en');
    const heParsed = _parseWoosbJson(heWoosbJson, enBundleId, 'he');

    if (Object.keys(enParsed).length === 0) {
      return issues;
    }

    const enSlots = Object.entries(enParsed).map(([key, val]) => Object.assign({ _key: key }, val));
    const heSlots = Object.entries(heParsed).map(([key, val]) => Object.assign({ _key: key }, val));

    const enSections = _splitIntoSections(enSlots);
    const heSections = _splitIntoSections(heSlots);

    if (enSections.length !== heSections.length) {
      issues.push({
        code: 'SECTION_COUNT_MISMATCH',
        detail: `EN has ${enSections.length} sections; HE has ${heSections.length}`
      });
    }

    const sectionsToCompare = Math.min(enSections.length, heSections.length);

    for (let s = 0; s < sectionsToCompare; s++) {
      const enSection = enSections[s];
      const heSection = heSections[s];

      const heProductsById = {};
      for (const slot of heSection.products) {
        if (slot.id) heProductsById[String(slot.id)] = slot;
      }
      const consumedHe = new Set();

      for (const enSlot of enSection.products) {
        const enProductId = String(enSlot.id || '').trim();
        if (!enProductId) continue;
        const enQty = Number(enSlot.qty);

        const expectedHeId = enToHeMap[enProductId];
        if (!expectedHeId) {
          issues.push({
            code: 'NO_TRANSLATION_PAIR',
            section: s,
            detail: `EN product ${enProductId} has no WPML translation pair`
          });
          continue;
        }

        const heMatch = heProductsById[expectedHeId];
        if (heMatch) {
          consumedHe.add(expectedHeId);
          const heQty = Number(heMatch.qty);
          if (enQty !== heQty) {
            issues.push({
              code: 'QTY_MISMATCH',
              section: s,
              detail: `Product ${enProductId} (HE ${expectedHeId}) qty differs: EN=${enQty}, HE=${heQty}`
            });
          }
        } else {
          let wrongSection = -1;
          for (let other = 0; other < heSections.length; other++) {
            if (other === s) continue;
            if (heSections[other].products.some(p => String(p.id) === expectedHeId)) {
              wrongSection = other;
              break;
            }
          }
          if (wrongSection >= 0) {
            issues.push({
              code: 'WRONG_SECTION',
              section: s,
              detail: `Product ${enProductId} (HE ${expectedHeId}) in HE section ${wrongSection}, EN places in section ${s}`
            });
          } else {
            issues.push({
              code: 'HE_MISSING',
              section: s,
              detail: `EN product ${enProductId} (HE ${expectedHeId}) missing from HE`
            });
          }
        }
      }

      for (const heSlot of heSection.products) {
        const heProductId = String(heSlot.id || '').trim();
        if (!heProductId || consumedHe.has(heProductId)) continue;
        issues.push({
          code: 'HE_EXTRA',
          section: s,
          detail: `HE has product ${heProductId} with no EN counterpart in section ${s}`
        });
      }
    }

    return issues;
  }

  /**
   * Validates EN/HE composition parity for every bundle in WebProdM.
   * Reads WebProdM (EN composition) and WebXltM (HE composition + WPML linkage).
   * Returns per-bundle issue lists; does not write anything.
   * @returns {Object} { error, data: { totalBundles, bundlesWithIssues, bundles: [...] } }
   */
  function validateAllBundleParity() {
    const fnName = 'validateAllBundleParity';
    try {
      const allConfig = ConfigService.getAllConfig();
      const spreadsheet = SheetAccessor.getDataSpreadsheet();

      const webProdMSheet = spreadsheet.getSheetByName('WebProdM');
      const webXltMSheet = spreadsheet.getSheetByName('WebXltM');
      if (!webProdMSheet || !webXltMSheet) {
        return { error: 'WebProdM or WebXltM sheet not found', data: null };
      }

      const wpmHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
      const xltHeaders = allConfig['schema.data.WebXltM'].headers.split(',');
      const wpmData = webProdMSheet.getDataRange().getValues();
      const xltData = webXltMSheet.getDataRange().getValues();

      const wpmIdIdx = wpmHeaders.indexOf('wpm_ID');
      const wpmTypeIdx = wpmHeaders.indexOf('wpm_TaxProductType');
      const wpmWoosbIdx = wpmHeaders.indexOf('wpm_WoosbIds');
      const wpmTitleIdx = wpmHeaders.indexOf('wpm_PostTitle');

      const xltIdIdx = xltHeaders.indexOf('wxm_ID');
      const xltOrigIdx = xltHeaders.indexOf('wxm_WpmlOriginalId');
      const xltWoosbIdx = xltHeaders.indexOf('wxm_WoosbIds');

      const enToHeProductMap = {};
      const heBundleWoosbMap = {};
      for (let i = 1; i < xltData.length; i++) {
        const enId = String(xltData[i][xltOrigIdx] || '').trim();
        const heId = String(xltData[i][xltIdIdx] || '').trim();
        if (enId && heId) enToHeProductMap[enId] = heId;
        if (xltWoosbIdx !== -1) {
          const heWoosb = String(xltData[i][xltWoosbIdx] || '').trim();
          if (enId && heWoosb) heBundleWoosbMap[enId] = heWoosb;
        }
      }

      const bundleResults = [];
      for (let i = 1; i < wpmData.length; i++) {
        const productType = String(wpmData[i][wpmTypeIdx] || '').toLowerCase().trim();
        if (productType !== 'woosb' && productType !== 'bundle') continue;

        const enBundleId = String(wpmData[i][wpmIdIdx] || '').trim();
        const enWoosb = String(wpmData[i][wpmWoosbIdx] || '').trim();
        const bundleName = String(wpmData[i][wpmTitleIdx] || '').trim();
        const heWoosb = heBundleWoosbMap[enBundleId] || '';

        const issues = _validateBundlePairParity(enBundleId, enWoosb, heWoosb, enToHeProductMap);
        bundleResults.push({
          bundleId: enBundleId,
          bundleName: bundleName,
          issueCount: issues.length,
          issues: issues
        });
      }

      const bundlesWithIssues = bundleResults.filter(b => b.issueCount > 0).length;
      LoggerService.info(SERVICE_NAME, fnName, `Validated ${bundleResults.length} bundles, ${bundlesWithIssues} have parity issues`);

      return {
        error: null,
        data: {
          totalBundles: bundleResults.length,
          bundlesWithIssues: bundlesWithIssues,
          bundles: bundleResults
        }
      };
    } catch (e) {
      LoggerService.error(SERVICE_NAME, fnName, `Validation failed: ${e.message}`, e);
      return { error: `Validation failed: ${e.message}`, data: null };
    }
  }

  /**
   * Serializes a bundle's slots back to the WPClever woosb_ids JSON for one language,
   * reusing each slot's ORIGINAL token (the slotId is `${bundleId}-${token}`, so no token
   * regeneration — WPClever accepts the keys it issued). BUNDLE_PLAN Stage 3 serializer.
   *
   * Product slot -> { id, sku, qty, optional, min, max } (string values; id resolved per
   *   language: EN = wpm_ID by SKU; HE = WebXltM wxm_WpmlOriginalId(EN id) -> wxm_ID, the
   *   same resolution validateAllBundleParity uses). Unresolved SKU -> blank id + a warning.
   * Text slot -> { type, text } (text per language).
   *
   * @param {string} bundleId  EN bundle product id.
   * @param {string} lang      'en' | 'he'.
   * @returns {{json:string, warnings:Array<string>}}
   */
  function exportBundleWoosb(bundleId, lang) {
    const language = (lang === 'he') ? 'he' : 'en';
    const warnings = [];

    const slots = getSlotsForBundle(bundleId);
    if (!slots || slots.length === 0) {
      return { json: '', warnings: [`Bundle ${bundleId} has no slots.`] };
    }
    slots.sort((a, b) => (a.order || 0) - (b.order || 0));

    // SKU -> EN id, and (for HE) EN id -> HE id — mirrors validateAllBundleParity (:1559-1578).
    const allConfig = ConfigService.getAllConfig();
    const ss = SheetAccessor.getDataSpreadsheet();
    const wpmHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
    const wpmIdIdx = wpmHeaders.indexOf('wpm_ID');
    const wpmSkuIdx = wpmHeaders.indexOf('wpm_SKU');
    const skuToEnId = {};
    const wpmData = ss.getSheetByName('WebProdM').getDataRange().getValues();
    for (let i = 1; i < wpmData.length; i++) {
      const sku = String(wpmData[i][wpmSkuIdx] || '').trim();
      const id = String(wpmData[i][wpmIdIdx] || '').trim();
      if (sku && id) skuToEnId[sku] = id;
    }
    const enToHeId = {};
    if (language === 'he') {
      const xltHeaders = allConfig['schema.data.WebXltM'].headers.split(',');
      const xltIdIdx = xltHeaders.indexOf('wxm_ID');
      const xltOrigIdx = xltHeaders.indexOf('wxm_WpmlOriginalId');
      const xltData = ss.getSheetByName('WebXltM').getDataRange().getValues();
      for (let i = 1; i < xltData.length; i++) {
        const enId = String(xltData[i][xltOrigIdx] || '').trim();
        const heId = String(xltData[i][xltIdIdx] || '').trim();
        if (enId && heId) enToHeId[enId] = heId;
      }
    }

    const prefix = bundleId + '-';
    const out = {};
    slots.forEach(slot => {
      // Recover the original woosb token from the slotId (`${bundleId}-${token}`).
      const token = (slot.slotId && slot.slotId.indexOf(prefix) === 0)
        ? slot.slotId.substring(prefix.length)
        : slot.slotId;

      if (slot.slotType === 'Text') {
        out[token] = {
          type: slot.textStyle || 'p',
          text: (language === 'he' ? slot.textHe : slot.textEn) || ''
        };
        return;
      }

      // Product slot
      const sku = slot.activeSKU || '';
      let id = '';
      if (!sku) {
        warnings.push(`Product slot ${token} has no SKU — id left blank.`);
      } else {
        const enId = skuToEnId[sku];
        if (!enId) {
          warnings.push(`${language.toUpperCase()}: SKU "${sku}" (token ${token}) not in WebProdM — id left blank.`);
        } else if (language === 'he') {
          id = enToHeId[enId] || '';
          if (!id) warnings.push(`HE: SKU "${sku}" (token ${token}) has no Hebrew translation in WebXltM — id left blank.`);
        } else {
          id = enId;
        }
      }

      // Match WPClever's format: `optional` present only when the member is optional
      // (WC omits it otherwise). Field order: id, sku, qty, [optional], min, max.
      const product = {
        id: id,
        sku: sku,
        qty: String((slot.defaultQty === '' || slot.defaultQty == null) ? 1 : slot.defaultQty)
      };
      if (slot.qtyVariable) product.optional = '1';
      product.min = '';
      product.max = '';
      out[token] = product;
    });

    return { json: JSON.stringify(out), warnings: warnings };
  }

  /**
   * Canonical string for one woosb member — for structural comparison. Ignores formatting,
   * min/max, and optional-absent vs "0"; keeps type/id/sku/qty/optional/text.
   */
  function _canonMember(v) {
    v = v || {};
    if (v.type !== undefined && v.text !== undefined && v.id === undefined && v.sku === undefined) {
      return 'T|' + (v.type || '') + '|' + String(v.text || '').trim();
    }
    return 'P|' + String(v.id || '').trim() + '|' + String(v.sku || '').trim() + '|' +
           String(v.qty || '').trim() + '|' + (String(v.optional || '').trim() === '1' ? '1' : '0');
  }

  /**
   * Order-insensitive MULTISET of canonical PRODUCT members for a woosb_ids JSON string
   * (sorted canon list). Used by the export diff. Deliberately ignores, as language-specific
   * noise: (1) token keys — WPClever issues independent random keys per language (EN `eoxl…`
   * vs HE `c9su…`); (2) member order — per-language alphabetic (EN English, HE Hebrew; parity
   * validator Appendix A); and (3) **TEXT (non-product) slots entirely** — section-header text
   * is language-specific (and HE text isn't authored ops-side), so it must not drive the
   * "needs export" decision (user call 2026-06-07). Only the set of PRODUCT members
   * (id/sku/qty/optional) counts.
   */
  function _canonMultiset(jsonStr) {
    const p = _parseWoosbJson(jsonStr, 'cmp', 'en');
    return Object.keys(p)
      .filter(function (k) { const v = p[k] || {}; return (v.id !== undefined || v.sku !== undefined); })  // products only; skip text slots
      .map(function (k) { return _canonMember(p[k]); })
      .sort();
  }

  /** Structural equality of two woosb_ids JSON strings as member multisets (order/key-agnostic). */
  function _woosbEqual(jsonA, jsonB) {
    const a = _canonMultiset(jsonA), b = _canonMultiset(jsonB);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /** Out-of-stock failsafe (§3.1): product-member SKUs in a serialized woosb whose web stock
   *  is <= 0. Used to warn before export so a now-out-of-stock wine isn't published. */
  function _outOfStockMembers(jsonStr, skuToStock) {
    const p = _parseWoosbJson(jsonStr, 'oos', 'en');
    const out = [];
    Object.keys(p).forEach(function (k) {
      const m = p[k] || {};
      const sku = m.sku ? String(m.sku).trim() : '';
      if (!sku) return;
      const st = skuToStock[sku];
      if (st !== undefined && !isNaN(st) && Number(st) <= 0) out.push(sku);
    });
    return out;
  }

  /**
   * Export worklist (BUNDLE_PLAN Stage 3): every bundle whose serialized OPS woosb differs
   * from the current WEB woosb (EN or HE) — covers both changed-this-round and
   * unchanged-but-drifted. Export direction is ops→web; this only SELECTS + serializes (the
   * manager pastes the cells into WPClever). Ops is never conformed to web.
   * @returns {{rows:Array<Object>, total:number, exportCount:number}}
   */
  function buildExportTable() {
    const allConfig = ConfigService.getAllConfig();
    const ss = SheetAccessor.getDataSpreadsheet();

    // Web woosb per bundle: EN from WebProdM (by wpm_ID), HE from WebXltM (by wxm_WpmlOriginalId).
    const wpmHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
    const wpmIdIdx = wpmHeaders.indexOf('wpm_ID');
    const wpmWoosbIdx = wpmHeaders.indexOf('wpm_WoosbIds');
    const wpmSkuIdx = wpmHeaders.indexOf('wpm_SKU');
    const wpmStockIdx = wpmHeaders.indexOf('wpm_Stock');
    const webEnByBundle = {};
    const skuToStock = {};   // web stock by SKU — for the pre-export out-of-stock failsafe (§3.1)
    const wpmData = ss.getSheetByName('WebProdM').getDataRange().getValues();
    for (let i = 1; i < wpmData.length; i++) {
      const id = String(wpmData[i][wpmIdIdx] || '').trim();
      if (id) webEnByBundle[id] = String(wpmData[i][wpmWoosbIdx] || '');
      const sku = wpmSkuIdx >= 0 ? String(wpmData[i][wpmSkuIdx] || '').trim() : '';
      if (sku && wpmStockIdx >= 0) skuToStock[sku] = Number(wpmData[i][wpmStockIdx]);
    }
    const xltHeaders = allConfig['schema.data.WebXltM'].headers.split(',');
    const xltOrigIdx = xltHeaders.indexOf('wxm_WpmlOriginalId');
    const xltWoosbIdx = xltHeaders.indexOf('wxm_WoosbIds');
    const webHeByBundle = {};
    const xltData = ss.getSheetByName('WebXltM').getDataRange().getValues();
    for (let i = 1; i < xltData.length; i++) {
      const enId = String(xltData[i][xltOrigIdx] || '').trim();
      if (enId && xltWoosbIdx !== -1) webHeByBundle[enId] = String(xltData[i][xltWoosbIdx] || '');
    }

    const bundles = getAllBundles();
    const rows = [];
    bundles.forEach(b => {
      const en = exportBundleWoosb(b.bundleId, 'en');
      const he = exportBundleWoosb(b.bundleId, 'he');
      const enDiff = !_woosbEqual(en.json, webEnByBundle[b.bundleId] || '');
      const heDiff = !_woosbEqual(he.json, webHeByBundle[b.bundleId] || '');
      if (enDiff || heDiff) {
        const warnings = en.warnings.concat(he.warnings);
        // Out-of-stock failsafe (§3.1): flag product members with web stock <= 0 so a now
        // out-of-stock wine isn't published into a bundle on export. Warning only (manager decides).
        const oos = _outOfStockMembers(en.json, skuToStock);
        if (oos.length) warnings.push('Out of stock (web): ' + oos.join(', '));
        rows.push({
          bundleId: b.bundleId,
          name: b.nameEn || b.bundleId,
          en: en.json,
          he: he.json,
          enDiff: enDiff,
          heDiff: heDiff,
          warnings: warnings
        });
      }
    });
    return { rows: rows, total: bundles.length, exportCount: rows.length };
  }

  // =====================================================
  // PUBLIC API
  // =====================================================

  return {
    // Cache
    clearCache: clearCache,

    // Bundle CRUD
    getAllBundles: getAllBundles,
    getBundle: getBundle,
    getBundleWithSlots: getBundleWithSlots,
    createBundle: createBundle,
    updateBundle: updateBundle,
    deleteBundle: deleteBundle,

    // Slot CRUD
    getSlotsForBundle: getSlotsForBundle,
    getSlot: getSlot,
    createSlot: createSlot,
    updateSlot: updateSlot,
    deleteSlot: deleteSlot,

    // Product Assignment
    assignProductToSlot: assignProductToSlot,

    // Eligible Products / Health
    getEligibleProducts: getEligibleProducts,
    getBundlesWithLowInventory: getBundlesWithLowInventory,

    // Import / Duplicate
    importBundleFromWooCommerce: importBundleFromWooCommerce,
    reimportAllBundlesBatch: reimportAllBundlesBatch,
    duplicateBundle: duplicateBundle,

    // EN/HE composition parity validation
    validateAllBundleParity: validateAllBundleParity,

    // Authoring export (Stage 3) — slots -> WPClever woosb_ids JSON per language
    exportBundleWoosb: exportBundleWoosb,
    buildExportTable: buildExportTable,

    // Stats
    getBundleStats: getBundleStats
  };
})();

/**
 * Editor smoke wrapper for the Stage 3 serializer — exports the first bundle EN+HE and
 * logs the JSON + warnings. Run from the Apps Script editor (BUNDLE_PLAN Stage 3).
 */
function runExportBundleWoosbSmoke() {
  const bundles = BundleService.getAllBundles();
  if (!bundles || !bundles.length) { Logger.log('No bundles found.'); return 'no bundles'; }
  const id = bundles[0].bundleId;
  const en = BundleService.exportBundleWoosb(id, 'en');
  const he = BundleService.exportBundleWoosb(id, 'he');
  Logger.log('Bundle %s (%s)', id, bundles[0].nameEn || '');
  Logger.log('EN json: %s', en.json);
  Logger.log('EN warnings (%s): %s', en.warnings.length, JSON.stringify(en.warnings));
  Logger.log('HE json: %s', he.json);
  Logger.log('HE warnings (%s): %s', he.warnings.length, JSON.stringify(he.warnings));
  return { bundleId: id, en: en, he: he };
}
