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
    const allConfig = ConfigService.getAllConfig();
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    return spreadsheet.getSheetByName('SysBundles');
  }

  /**
   * Gets the SysBundleSlots sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getSlotsSheet() {
    const allConfig = ConfigService.getAllConfig();
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    return spreadsheet.getSheetByName('SysBundleSlots');
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
      const qty = slot.defaultQty || 1;
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
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const webSheet = spreadsheet.getSheetByName('WebProdM');

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
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const webSheet = spreadsheet.getSheetByName('WebProdM');

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
    newRow[cols.sbs_DefaultQty] = slotData.defaultQty || 1;

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
    const slot = getSlot(slotId);
    if (!slot) {
      LoggerService.warn(SERVICE_NAME, functionName, `Slot not found: ${slotId}`);
      return [];
    }

    if (slot.slotType !== 'Product') {
      return [];
    }

    const limit = options.limit || 20;

    // Get all products from WebProdM (published web products)
    const allConfig = ConfigService.getAllConfig();

    // Get minimum stock threshold from config
    const minStockConfig = allConfig['system.inventory.minimum_stock'];
    const minStock = minStockConfig ? parseInt(minStockConfig.value, 10) : 6;
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const webSheet = spreadsheet.getSheetByName('WebProdM');

    if (!webSheet) {
      LoggerService.warn(SERVICE_NAME, functionName, 'WebProdM sheet not found');
      return [];
    }

    const webData = webSheet.getDataRange().getValues();
    if (webData.length <= 1) return [];

    const webSchema = allConfig['schema.data.WebProdM'];
    const webHeaders = webSchema.headers.split(',');
    const webCols = {};
    webHeaders.forEach((h, i) => webCols[h] = i);

    // Get WebDetM for intensity/complexity/acidity if criteria specified
    let detailsMap = {};
    if (slot.intensity !== null || slot.complexity !== null || slot.acidity !== null) {
      const detSheet = spreadsheet.getSheetByName('WebDetM');
      if (detSheet) {
        const detData = detSheet.getDataRange().getValues();
        const detSchema = allConfig['schema.data.WebDetM'];
        const detHeaders = detSchema.headers.split(',');
        const detCols = {};
        detHeaders.forEach((h, i) => detCols[h] = i);

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

    // Get SKUs to exclude
    let excludedSKUs = new Set();
    const allSlots = _loadSlots();

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
      eligible.push({
        sku: sku,
        nameEn: name,
        price: price,
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

    // Build SKU to stock map from WebProdM
    const allConfig = ConfigService.getAllConfig();

    // Use config threshold if not specified
    if (threshold === undefined || threshold === null) {
      const minStockConfig = allConfig['system.inventory.minimum_stock'];
      threshold = minStockConfig ? parseInt(minStockConfig.value, 10) : 6;
    }

    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const webSheet = spreadsheet.getSheetByName('WebProdM');

    if (!webSheet) {
      LoggerService.warn(SERVICE_NAME, functionName, 'WebProdM sheet not found');
      return [];
    }

    const webData = webSheet.getDataRange().getValues();
    const webSchema = allConfig['schema.data.WebProdM'];
    const webHeaders = webSchema.headers.split(',');
    const webCols = {};
    webHeaders.forEach((h, i) => webCols[h] = i);

    const stockMap = {};
    const productMap = {};
    for (let i = 1; i < webData.length; i++) {
      const row = webData[i];
      const sku = String(row[webCols.wpm_SKU] || '');
      if (sku) {
        stockMap[sku] = Number(row[webCols.wpm_Stock]) || 0;
        productMap[sku] = {
          nameEn: row[webCols.wpm_PostTitle] || '',
          price: Number(row[webCols.wpm_RegularPrice]) || 0
        };
      }
    }

    const results = [];

    for (const bundle of bundles) {
      const bundleSlots = allSlots.filter(s => s.bundleId === bundle.bundleId && s.slotType === 'Product');
      const lowStockSlots = [];

      for (const slot of bundleSlots) {
        if (!slot.activeSKU) continue;

        const stock = stockMap[slot.activeSKU];
        if (stock !== undefined && stock < threshold) {
          // Get suggestions
          const suggestions = getEligibleProducts(slot.slotId, {
            limit: 5,
            excludeExclusiveSKUs: true
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
          exclusive: slot.exclusive,
          qtyVariable: slot.qtyVariable
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

    for (const [key, value] of entries) {
      if (value.type && textSlotTypes.includes(value.type.toLowerCase())) {
        // Text slot - get Hebrew text from Hebrew woosb_ids data if available
        const hebrewEntry = woosbDataHe[key] || {};
        const textHe = (hebrewEntry.text || '').trim();

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
          defaultQty: Number(value.qty) || 1,
          qtyVariable: preserved.qtyVariable !== undefined ? preserved.qtyVariable : (value.optional === '1'),
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
  function getBundleStats() {
    const bundles = _loadBundles();
    const lowInventory = getBundlesWithLowInventory();

    return {
      total: bundles.length,
      active: bundles.filter(b => b.status === 'Active').length,
      draft: bundles.filter(b => b.status === 'Draft').length,
      archived: bundles.filter(b => b.status === 'Archived').length,
      needsAttention: lowInventory.length,
      lowInventoryCount: lowInventory.reduce((sum, b) => sum + b.lowStockSlots.length, 0)
    };
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
    duplicateBundle: duplicateBundle,

    // Stats
    getBundleStats: getBundleStats
  };
})();
