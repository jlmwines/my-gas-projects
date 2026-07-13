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

  // Per-execution counter so a single saveComposition that creates several new slots in a tight
  // loop can't collide on a same-millisecond `SLOT-${Date.now()}` id (createSlot).
  let _slotIdSeq = 0;

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
        // Stage 7 (cols undefined until the schema rebuild → safely null/'')
        minTotal: (cols.sb_MinTotal !== undefined && row[cols.sb_MinTotal] !== '' && row[cols.sb_MinTotal] != null) ? Number(row[cols.sb_MinTotal]) : null,
        maxTotal: (cols.sb_MaxTotal !== undefined && row[cols.sb_MaxTotal] !== '' && row[cols.sb_MaxTotal] != null) ? Number(row[cols.sb_MaxTotal]) : null,
        lastGenerated: (cols.sb_LastGenerated !== undefined) ? (row[cols.sb_LastGenerated] || '') : '',
        genFlags: (cols.sb_GenFlags !== undefined) ? (row[cols.sb_GenFlags] || '') : '',
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
  // WPClever (WOOSB) discount fields live on the BUNDLE's own WebProdM row, keyed by wpm_ID (which
  // IS bundleId — WebAppBundles.js:613). Imported every sync, never authored/pushed by jlmops
  // (§7.1c). Built once from a WebProdM read, keyed by wpm_ID, for the as-presented price/margin.
  function _buildBundleDiscountMap(webData, webHeaders) {
    const map = {};
    const idIdx = webHeaders.indexOf('wpm_ID');
    if (idIdx === -1) return map;
    const discIdx = webHeaders.indexOf('wpm_WoosbDiscount');
    const amtIdx = webHeaders.indexOf('wpm_WoosbDiscountAmount');
    const customIdx = webHeaders.indexOf('wpm_WoosbCustomPrice');
    const disableIdx = webHeaders.indexOf('wpm_WoosbDisableAutoPrice');
    for (let i = 1; i < webData.length; i++) {
      const id = String(webData[i][idIdx] || '').trim();
      if (!id) continue;
      map[id] = {
        discountOn: discIdx !== -1 ? webData[i][discIdx] : '',
        discountAmount: amtIdx !== -1 ? webData[i][amtIdx] : '',
        customPrice: customIdx !== -1 ? webData[i][customIdx] : '',
        disableAuto: disableIdx !== -1 ? webData[i][disableIdx] : ''
      };
    }
    return map;
  }

  // WPClever checkbox truthiness ('on' from the admin UI; tolerate other exported forms).
  function _woosbEnabled(v) {
    const s = String(v == null ? '' : v).toLowerCase().trim();
    return s === 'on' || s === '1' || s === 'yes' || s === 'true';
  }

  // A WOOSB discount value → currency amount off `totalPrice`. '%'-suffixed = percentage of the
  // member sum, otherwise a fixed amount. Blank / non-numeric / <=0 → 0.
  function _parseWoosbDiscount(v, totalPrice) {
    if (v === '' || v == null) return 0;
    const raw = String(v).trim();
    if (raw === '') return 0;
    if (raw.indexOf('%') !== -1) {
      const pct = parseFloat(raw.replace('%', ''));
      return (!isNaN(pct) && pct > 0) ? totalPrice * (pct / 100) : 0;
    }
    const amt = parseFloat(raw);
    return (!isNaN(amt) && amt > 0) ? amt : 0;
  }

  // Resolve the as-presented discount from the bundle's WOOSB fields, matching WPClever:
  // (1) auto-price disabled → fixed custom price; (2) a discount off the member sum — WPClever stores
  // the FIXED amount in woosb_discount_amount and a PERCENTAGE in woosb_discount, and a populated
  // value (NOT an enable flag — wpm_WoosbDiscount is blank for fixed-amount bundles) IS the discount;
  // this shop uses fixed amount (amount=30, discount blank — user-confirmed 2026-06-07); (3) else
  // none. Returns null only when no web row exists (caller falls back to sb_DiscountPrice). Math only.
  function _bundleDiscountFromWeb(totalPrice, d) {
    if (!d) return null;
    if (_woosbEnabled(d.disableAuto) && d.customPrice !== '' && d.customPrice != null) {
      const cp = parseFloat(d.customPrice);
      if (!isNaN(cp)) return { displayPrice: cp, discount: totalPrice > cp ? totalPrice - cp : 0 };
    }
    let discount = _parseWoosbDiscount(d.discountAmount, totalPrice);
    if (discount <= 0) discount = _parseWoosbDiscount(d.discountOn, totalPrice);
    if (discount > 0) return { displayPrice: Math.max(0, totalPrice - discount), discount: Math.min(discount, totalPrice) };
    return { displayPrice: totalPrice, discount: 0 };
  }

  function _calculateBundlePrice(bundle, bundleSlots, priceMap, webDiscount) {
    let totalPrice = 0;

    for (const slot of bundleSlots) {
      if (slot.slotType !== 'Product' || !slot.activeSKU) continue;
      const price = priceMap[slot.activeSKU] || 0;
      const qty = (slot.defaultQty === '' || slot.defaultQty == null) ? 1 : Number(slot.defaultQty);
      totalPrice += price * qty;
    }

    // As-presented price/margin. Precedence: a manually-set sb_DiscountPrice (the final price) wins —
    // a manual override / testing hook — otherwise the WC-managed WOOSB discount off the bundle's own
    // web row (§7.1c). sb_DiscountPrice is blank on import, so in normal operation the WOOSB path runs.
    let displayPrice, discount;
    const manual = (bundle.discountPrice !== '' && bundle.discountPrice != null) ? parseFloat(bundle.discountPrice) : null;
    if (manual !== null && !isNaN(manual)) {
      displayPrice = manual;
      discount = totalPrice > manual ? totalPrice - manual : 0;
    } else {
      const web = _bundleDiscountFromWeb(totalPrice, webDiscount) || { displayPrice: totalPrice, discount: 0 };
      displayPrice = web.displayPrice;
      discount = web.discount;
    }

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
    let discountMap = {};
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
      discountMap = _buildBundleDiscountMap(webData, webHeaders);
    }

    // Add price info to each bundle (as-presented discount from its own WOOSB row, §7.1c)
    return bundles.map(bundle => {
      const bundleSlots = allSlots.filter(s => s.bundleId === bundle.bundleId);
      const priceInfo = _calculateBundlePrice(bundle, bundleSlots, priceMap, discountMap[bundle.bundleId]);
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

    // priceMap (SKU -> RegularPrice number) feeds _calculateBundlePrice unchanged. infoMap carries
    // the per-slot display fields (name + profit) the §7.4 composition sheet renders — built from the
    // same single WebProdM read, so no extra sheet round-trip (ADMIN_BUNDLES_UI_PLAN Phase 3).
    const priceMap = {};
    const infoMap = {};
    let webDiscount = null;
    if (webSheet) {
      const webData = webSheet.getDataRange().getValues();
      const webSchema = allConfig['schema.data.WebProdM'];
      const webHeaders = webSchema.headers.split(',');
      const skuIdx = webHeaders.indexOf('wpm_SKU');
      const priceIdx = webHeaders.indexOf('wpm_RegularPrice');
      const titleIdx = webHeaders.indexOf('wpm_PostTitle');
      const profitIdx = webHeaders.indexOf('wpm_ProfitRate');

      for (let i = 1; i < webData.length; i++) {
        const sku = String(webData[i][skuIdx] || '');
        if (sku) {
          priceMap[sku] = Number(webData[i][priceIdx]) || 0;
          const rawRate = profitIdx !== -1 ? webData[i][profitIdx] : '';
          infoMap[sku] = {
            name: titleIdx !== -1 ? String(webData[i][titleIdx] || '') : '',
            // wpm_ProfitRate is a stored fraction (0.42 = 42%); blank = missing (never 0%).
            profitRate: (rawRate !== '' && rawRate !== null && rawRate !== undefined) ? Number(rawRate) : null
          };
        }
      }
      // The bundle's own WOOSB discount row (keyed by wpm_ID = bundleId) for the as-presented margin.
      webDiscount = _buildBundleDiscountMap(webData, webHeaders)[String(bundleId)] || null;
    }

    // Enrich product slots with display fields (name/price/profit) for the composition sheet.
    const enrichedSlots = bundleSlots.map(s => {
      if (s.slotType !== 'Product' || !s.activeSKU) return s;
      const info = infoMap[s.activeSKU] || {};
      return Object.assign({}, s, {
        productName: info.name || '',
        productPrice: priceMap[s.activeSKU] || 0,
        profitRate: (info.profitRate !== undefined ? info.profitRate : null)
      });
    });

    const priceInfo = _calculateBundlePrice(bundle, bundleSlots, priceMap, webDiscount);

    return {
      ...bundle,
      slots: enrichedSlots,
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
    // Stage 7 fields (guarded — columns exist only after the schema rebuild)
    if (updates.minTotal !== undefined && cols.sb_MinTotal !== undefined) {
      sheet.getRange(row, cols.sb_MinTotal + 1).setValue(updates.minTotal === null ? '' : updates.minTotal);
    }
    if (updates.maxTotal !== undefined && cols.sb_MaxTotal !== undefined) {
      sheet.getRange(row, cols.sb_MaxTotal + 1).setValue(updates.maxTotal === null ? '' : updates.maxTotal);
    }
    if (updates.lastGenerated !== undefined && cols.sb_LastGenerated !== undefined) {
      sheet.getRange(row, cols.sb_LastGenerated + 1).setValue(updates.lastGenerated);
    }
    if (updates.genFlags !== undefined && cols.sb_GenFlags !== undefined) {
      sheet.getRange(row, cols.sb_GenFlags + 1).setValue(updates.genFlags);
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

    // Generate slot ID if not provided. Counter suffix guarantees uniqueness even when several
    // slots are created in the same millisecond (saveComposition batch). The serializer treats any
    // id not prefixed by `${bundleId}-` as a whole-token, so this format stays export-safe.
    const slotId = slotData.slotId || `SLOT-${Date.now()}-${++_slotIdSeq}`;

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

  /**
   * Phase 3 atomic composition save (ADMIN_BUNDLES_UI_PLAN §7.5). Commits the whole bundle in one
   * call: header fields (names/status — discount is WC-managed, never written, §7.1c) + the full
   * ordered slot list. Reuses the slot primitives (createSlot/updateSlot/deleteSlot); slot order
   * comes from list position. Existing slots carry slotId (→ update); new ones don't (→ create);
   * stored slots absent from the incoming list are deleted. Returns the re-derived bundle.
   * @param {string} bundleId
   * @param {Object} header  {nameEn?, nameHe?, status?}
   * @param {Array<Object>} slots  ordered composition
   * @returns {Object} re-derived bundle (getBundleWithSlots)
   */
  function saveComposition(bundleId, header, slots) {
    const fnName = 'saveComposition';
    bundleId = String(bundleId);
    const incoming = Array.isArray(slots) ? slots : [];

    // 1. Header. nameEn/nameHe intentionally omitted — like the discount (§7.1c) the bundle NAME is
    //    web-derived (set from the web product title on import) and never authored/pushed by jlmops, so
    //    the editor shows it read-only and Save must not write it (a blank field would wipe the name).
    //    minTotal/maxTotal = the Stage 7 price band; '' clears to null. Validate min ≤ max (rev 2.1 #7).
    if (header && typeof header === 'object') {
      const hu = {};
      if (header.status !== undefined) hu.status = header.status;
      const toNum = v => (v === '' || v == null) ? null : Number(v);
      if (header.minTotal !== undefined) hu.minTotal = toNum(header.minTotal);
      if (header.maxTotal !== undefined) hu.maxTotal = toNum(header.maxTotal);
      // Resolve the effective band (incoming value, else the stored one) and reject min > max.
      const existing = getBundle(bundleId) || {};
      const effMin = (hu.minTotal !== undefined) ? hu.minTotal : (existing.minTotal != null ? existing.minTotal : null);
      const effMax = (hu.maxTotal !== undefined) ? hu.maxTotal : (existing.maxTotal != null ? existing.maxTotal : null);
      if (effMin != null && effMax != null && effMin > effMax) {
        throw new Error(`Price band invalid: min (${effMin}) must be ≤ max (${effMax}).`);
      }
      if (Object.keys(hu).length) updateBundle(bundleId, hu);
    }

    // 2. Reconcile slots: update existing, create new, delete removed.
    const SLOT_FIELDS = ['slotType', 'textStyle', 'textEn', 'textHe', 'activeSKU', 'category',
      'category2', 'priceMin', 'priceMax', 'intensity', 'complexity', 'acidity', 'nameContains',
      'exclusive', 'qtyVariable', 'defaultQty'];
    const existing = getSlotsForBundle(bundleId);
    const existingIds = existing.map(s => String(s.slotId));
    const keptIds = [];

    incoming.forEach(function (slot, idx) {
      const data = { order: idx + 1 };
      SLOT_FIELDS.forEach(function (f) { if (slot[f] !== undefined) data[f] = slot[f]; });
      const sid = slot.slotId ? String(slot.slotId) : '';
      if (sid && existingIds.indexOf(sid) !== -1) {
        updateSlot(sid, data);
        keptIds.push(sid);
      } else {
        createSlot(Object.assign({ bundleId: bundleId }, data));
      }
    });

    existing.forEach(function (s) {
      if (keptIds.indexOf(String(s.slotId)) === -1) deleteSlot(String(s.slotId));
    });

    clearCache();
    LoggerService.info(SERVICE_NAME, fnName, `Saved composition for ${bundleId}: ${incoming.length} slot(s), deleted ${existing.length - keptIds.length}`);
    return getBundleWithSlots(bundleId);
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
   * Cross-bundle usage index (BUNDLE_PLAN Stage 6): SKU -> count of DISTINCT OTHER bundles that use
   * it as a product slot's active SKU. Variety signal for diversity ranking; the current bundle is
   * excluded so a wine already in this bundle isn't self-penalized. Takes a preloaded slots array
   * (reuse `ctx.allSlots` or `_loadSlots()`) to avoid an extra sheet read.
   * @param {Array<Object>} allSlots - all slot objects (from _loadSlots / ctx.allSlots)
   * @param {string} excludeBundleId - the bundle being filled (not counted)
   * @returns {Object} { [sku]: otherBundleCount }
   */
  function _buildCrossBundleUsage(allSlots, excludeBundleId) {
    const exclude = String(excludeBundleId || '');
    const bySku = {};   // sku -> Set of bundleIds
    (allSlots || []).forEach(s => {
      if (s.slotType !== 'Product' || !s.activeSKU) return;
      if (String(s.bundleId) === exclude) return;
      if (!bySku[s.activeSKU]) bySku[s.activeSKU] = new Set();
      bySku[s.activeSKU].add(String(s.bundleId));
    });
    const usage = {};
    Object.keys(bySku).forEach(sku => { usage[sku] = bySku[sku].size; });
    return usage;
  }

  /**
   * Does a product satisfy a slot's criteria? Pure predicate shared by getEligibleProducts (candidate
   * filter) and the Stage 7 deficiency check (is the CURRENT wine still valid for its slot?). Exactly
   * mirrors the former inline block — the `!== null` guards skip an unspecified criterion, and an
   * undefined detail (no WebDetM row) fails an intensity/complexity/acidity criterion as before.
   * `slot.priceMax` doubles as the gate-time "over-band" check (rev 2.2): price > priceMax → miss.
   * @param {Object} p - {categories:[], price, name, intensity, complexity, acidity}
   * @param {Object} slot - slot with criteria fields
   * @returns {boolean} true if the product matches every specified criterion
   */
  function _matchesSlotCriteria(p, slot) {
    // Category filter - exact match in category list
    if (slot.category && !p.categories.includes(slot.category)) return false;
    if (slot.category2 && !p.categories.includes(slot.category2)) return false;
    // Price range
    if (slot.priceMin !== null && p.price < slot.priceMin) return false;
    if (slot.priceMax !== null && p.price > slot.priceMax) return false;
    // Name contains
    if (slot.nameContains && p.name.toLowerCase().indexOf(slot.nameContains.toLowerCase()) === -1) return false;
    // Intensity/Complexity/Acidity from WebDetM (exact match if specified)
    if (slot.intensity !== null && p.intensity !== null && p.intensity !== slot.intensity) return false;
    if (slot.complexity !== null && p.complexity !== null && p.complexity !== slot.complexity) return false;
    if (slot.acidity !== null && p.acidity !== null && p.acidity !== slot.acidity) return false;
    return true;
  }

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

    // Resolve the slot. The §7.4 composition-sheet picker drives off a CLIENT DRAFT row that may not
    // be persisted yet (newly added, or criteria edited but unsaved), so it passes options.draftSlot —
    // a slot-like criteria object {slotType,category,...,bundleId,slotId} — used directly. Otherwise
    // resolve from the preloaded ctx (avoids a per-call _loadSlots) or read by slotId, as before.
    const slot = options.draftSlot
      || (ctx ? (ctx.allSlots.find(s => s.slotId === String(slotId)) || null) : getSlot(slotId));
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

    // Draft-supplied exclusions: the composition-sheet picker passes the SKUs already chosen in OTHER
    // draft rows (those aren't on the sheet yet, so the allSlots scan below can't see them).
    if (Array.isArray(options.excludeSKUs)) {
      options.excludeSKUs.forEach(sku => { if (sku) excludedSKUs.add(String(sku)); });
    }

    // Exclude SKUs already used in other slots of the same bundle. The Stage 7 generator sets
    // options.ignoreSameBundle (it regenerates ALL slots, so the stored other-slot wines are stale)
    // and manages intra-bundle dedup itself via options.excludeSKUs (wines picked so far this run).
    if (!options.ignoreSameBundle) {
      allSlots.forEach(s => {
        if (s.bundleId === slot.bundleId && s.activeSKU && s.slotId !== slotId) {
          excludedSKUs.add(s.activeSKU);
        }
      });
    }

    // Also exclude SKUs from exclusive slots in other bundles
    if (options.excludeExclusiveSKUs) {
      allSlots.forEach(s => {
        if (s.exclusive && s.activeSKU && s.slotId !== slotId) {
          excludedSKUs.add(s.activeSKU);
        }
      });
    }

    // Cross-bundle usage index (BUNDLE_PLAN Stage 6): how many OTHER bundles already use each SKU.
    // Drives the variety-first diversity sort below (and is surfaced on each candidate for Stage 7).
    const usage = _buildCrossBundleUsage(allSlots, slot.bundleId);

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
      // Stock source: when the caller supplied ctx.comaxStockMap (Maintain/Re-roll, via
      // _buildBundleInventoryContext), use the same live Comax-minus-on-hold figure
      // _evaluateBundleDeficiency judges deficiency on — not WebProdM's wpm_Stock, which is only as
      // fresh as the last stock sync. Falls back to wpm_Stock when ctx carries no Comax data (the
      // interactive editor picker's no-ctx path, unchanged).
      const stock = (ctx && ctx.comaxStockMap)
        ? ((ctx.comaxStockMap[sku] || 0) - (ctx.onHoldMap[sku] || 0))
        : (Number(row[webCols.wpm_Stock]) || 0);
      const name = String(row[webCols.wpm_PostTitle] || '');
      const categoriesStr = String(row[webCols.wpm_TaxProductCat] || '');
      const categories = categoriesStr.split(',').map(c => c.trim()).filter(c => c);

      // Skip products below minimum stock level
      if (stock < minStock) {
        debugStats.lowStock++;
        continue;
      }

      // Apply criteria filters (shared predicate — see _matchesSlotCriteria)
      const details = detailsMap[sku] || {};
      if (!_matchesSlotCriteria({
        categories: categories, price: price, name: name,
        intensity: details.intensity, complexity: details.complexity, acidity: details.acidity
      }, slot)) continue;

      // Product matches criteria
      debugStats.passed++;
      // Profit rate (wpm_ProfitRate) for the selector — frontend display owned by the editor
      // (BUNDLE_PLAN Stage 3 "profit in the selector"; ADMIN_BUNDLES_UI_PLAN Phase 3 renders it).
      const prIdx = webCols.wpm_ProfitRate;
      const profitRate = (prIdx !== undefined && row[prIdx] !== '' && row[prIdx] !== null && row[prIdx] !== undefined)
        ? Number(row[prIdx]) : null;
      // wpm_Featured — high-margin / move-this-stock flag; a Stage 7 scoring bonus.
      const featIdx = webCols.wpm_Featured;
      const fv = featIdx !== undefined ? String(row[featIdx]).toLowerCase().trim() : '';
      const featured = (fv === 'true' || fv === '1' || fv === 'yes');

      eligible.push({
        sku: sku,
        nameEn: name,
        price: price,
        profitRate: profitRate,
        stock: stock,
        usage: usage[sku] || 0,   // cross-bundle uses (Stage 6) — diversity signal
        featured: featured,        // Stage 7 scoring bonus
        categories: categories,
        intensity: details.intensity,
        complexity: details.complexity,
        acidity: details.acidity
      });
      // NOTE: no early break — collect ALL eligible so the diversity sort below ranks the globally
      // least-used wines first, then slice to `limit` (Stage 6).
    }

    // Log debug stats
    LoggerService.info(SERVICE_NAME, functionName, `Slot ${slotId} eligible search: ${JSON.stringify(debugStats)}, minStock=${minStock}`);

    // Diversity-first sort (BUNDLE_PLAN Stage 6): fewest cross-bundle uses first (variety), then
    // higher stock. The min-stock floor already gated candidates, so an unused wine outranks a used
    // one even at lower stock; duplication only surfaces once unique wines run out ("relax as stock
    // runs low"). Then cap to `limit`. (Stage 7's generator applies its own profit+diversity composite.)
    eligible.sort((a, b) => (a.usage - b.usage) || (b.stock - a.stock));

    return eligible.slice(0, limit);
  }

  // =====================================================
  // PUBLIC API: Stage 7 — composition generator (auto-apply)
  // =====================================================

  // Composite ranking weights — TUNABLE (expected to be iterated after the first real run).
  // profitRate is a fraction 0..1; diversity = 1/(1+usage) (0..1); stockNorm = 0..1; pricePull weights
  // the fill-phase "use the budget toward the ceiling" term (NOT part of the static candidate score).
  const GENERATOR_WEIGHTS = { profit: 1.0, diversity: 1.0, stock: 0.1, pricePull: 0.5 };
  // Assumed margin when wpm_ProfitRate is blank — keeps a null-profit wine NEUTRAL (neither boosted
  // nor pushed to the bottom) rather than scoring it 0 (rev 2.1: "null-profit neutral"). Matches the
  // project's assumed-margin convention (ProductCostService manual/assumed backfill = 0.25). Now
  // mostly moot — profit was backfilled — but kept for the occasional blank. TUNABLE.
  const NEUTRAL_PROFIT = 0.25;
  // Flex (qty-0) add-on headroom: a flexible upsell slot prefers wines within the average base-bottle
  // budget, but if none fit it may exceed that budget by up to this factor (over-budget only WHEN
  // NECESSARY, and not by a huge margin — user call 2026-06-08). TUNABLE.
  const FLEX_HEADROOM = 1.5;

  // Static candidate score: profit (null → neutral) + diversity + stock. Featured dropped (rev 2.1 —
  // redundant with profit + stock). Price-toward-band is applied separately in the fill (it needs the
  // per-slot running ceiling, which a lone candidate doesn't know).
  function _scoreCandidate(c) {
    const profit = (c.profitRate != null && !isNaN(c.profitRate)) ? c.profitRate : NEUTRAL_PROFIT;
    const diversity = 1 / (1 + (c.usage || 0));
    const stockNorm = Math.min(c.stock || 0, 50) / 50;
    return GENERATOR_WEIGHTS.profit * profit
         + GENERATOR_WEIGHTS.diversity * diversity
         + GENERATOR_WEIGHTS.stock * stockNorm;
  }

  // Mild "use the budget toward the ceiling" pull — rewards picks closer to the running ceiling so the
  // base total drifts up toward the band rather than undershooting (rev 2.1 #3). 0 when no finite ceiling.
  function _priceFitScore(price, ceiling) {
    if (!ceiling || !isFinite(ceiling) || ceiling <= 0) return 0;
    return GENERATOR_WEIGHTS.pricePull * Math.min(price / ceiling, 1);
  }

  /**
   * Stage 7 generator (rev 2.2) — structure-preserving refresh of one bundle's PRODUCT slots.
   * Two modes:
   *   - reroll: re-pick every product slot.
   *   - maintain: re-pick only the deficient slots (opts.deficientSlotIds); keep the rest. A band-only
   *     trigger refills nothing but the top-up / down-pass below still nudge the total into the band.
   * Running-budget fill (Option B): per base (qty≥1) slot the ceiling = slot.priceMax, else
   * (sb_MaxTotal − committed base total) / remaining base slots to fill; flexible (qty-0) slots get the
   * average base ceiling (sb_MaxTotal / base-slot-count) and never draw budget. Among candidates under
   * the ceiling, pick the best by composite + price-pull. Then a TOP-UP pass (while base < sb_MinTotal,
   * apply the max-gain upgrade that keeps total ≤ sb_MaxTotal, else flag min_total_unmet) and a symmetric
   * DOWN-PASS (while base > sb_MaxTotal, downgrade the priciest base slot to a cheaper eligible wine,
   * else flag max_total_exceeded). Writes via assignProductToSlot. The web export remains the gate.
   * @param {Object} bundle - bundle (with minTotal/maxTotal)
   * @param {Object} opts - { mode:'maintain'|'reroll', deficientSlotIds:Set }
   */
  function _generateBundleComposition(bundle, opts) {
    opts = opts || {};
    const mode = opts.mode === 'maintain' ? 'maintain' : 'reroll';
    const deficientSet = (opts.deficientSlotIds instanceof Set) ? opts.deficientSlotIds : null;
    // Preloaded eligible-products context (webData/cols/detailsMap/allSlots/minStock). When supplied
    // (Maintain/Re-roll build it ONCE per run), getEligibleProducts reuses it instead of re-reading the
    // whole WebProdM/WebDetM sheets on EVERY slot/top-up/down-pass call — the main reroll/maintain cost.
    // Invariant within a run (product data doesn't change; intra-bundle dedup is handled via excludeSKUs,
    // not the snapshot), so a single shared snapshot is safe. Null = legacy per-call reads (back-compat).
    const genCtx = opts.ctx || null;

    const qtyOf = s => (s.defaultQty === '' || s.defaultQty == null) ? 1 : Number(s.defaultQty);

    const productSlots = getSlotsForBundle(bundle.bundleId)
      .filter(s => s.slotType === 'Product')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const baseSlots = productSlots.filter(s => qtyOf(s) >= 1);
    const baseSlotCount = baseSlots.length;
    // Base UNITS = Σqty over base slots — the average base-bottle budget (used for the flex slot's
    // soft ceiling) is sb_MaxTotal ÷ base units, so a qty-2 slot counts as two bottles.
    const baseUnitCount = baseSlots.reduce((sum, s) => sum + qtyOf(s), 0);

    const minTotal = bundle.minTotal;   // may be null → no floor flag
    const maxTotal = bundle.maxTotal;   // may be null → no ceiling

    // Current committed SKU + web price per slot (price seeded from getBundleWithSlots, updated on pick).
    const currentSku = {};
    const priceBySlot = {};
    const startState = getBundleWithSlots(bundle.bundleId);
    (startState ? startState.slots : []).forEach(s => {
      if (s.slotType === 'Product') {
        currentSku[s.slotId] = s.activeSKU || '';
        priceBySlot[s.slotId] = s.productPrice || 0;
      }
    });

    // Which slots get re-picked this run.
    const refill = {};
    productSlots.forEach(s => {
      refill[s.slotId] = (mode === 'reroll') ? true : (deficientSet ? deficientSet.has(s.slotId) : false);
    });

    // Eligible candidates for a slot, excluding the SKUs currently in OTHER product slots (intra-bundle
    // dedup) plus any extra. Uses the preloaded genCtx when present (no per-call sheet reads).
    function eligibleFor(slot, extraExclude) {
      const exclude = [];
      productSlots.forEach(s => {
        if (s.slotId !== slot.slotId && currentSku[s.slotId]) exclude.push(currentSku[s.slotId]);
      });
      if (Array.isArray(extraExclude)) extraExclude.forEach(x => { if (x) exclude.push(x); });
      return getEligibleProducts(slot.slotId, {
        limit: 500, excludeExclusiveSKUs: true, ignoreSameBundle: true, excludeSKUs: exclude, ctx: genCtx
      });
    }

    let changed = 0;
    const slotFlags = [];   // {slotId, flag:'no_candidate'}
    // Search context per slot where the pool came up empty this run — {inCriteriaCount, cheapest,
    // ceiling}. Captured for EVERY slot (base or flex), so a still-deficient flex slot's post-run
    // report (below) can say what the search actually found, not just stay silent.
    const searchStats = {};

    // ---- Fill phase ----
    // Budget already consumed by base slots we are NOT refilling (kept wines).
    let committedBaseTotal = 0;
    baseSlots.forEach(s => { if (!refill[s.slotId]) committedBaseTotal += (priceBySlot[s.slotId] || 0) * qtyOf(s); });
    let remainingBaseUnits = baseSlots.filter(s => refill[s.slotId]).reduce((sum, s) => sum + qtyOf(s), 0);

    // Fill order: base slots by DESCENDING qty first (the highest-qty slots get first pick of the
    // profit-weighted pool, so profit×qty concentrates where it counts), then flexible (qty-0) add-ons
    // LAST (they take leftovers and can't starve base slots of the good/high-value wines — which was
    // also pulling the base total below sb_MinTotal). Equal qty keeps display order.
    const fillOrder = productSlots
      .filter(s => refill[s.slotId])
      .sort((a, b) => (qtyOf(b) - qtyOf(a)) || ((a.order || 0) - (b.order || 0)));

    fillOrder.forEach(slot => {
      const q = qtyOf(slot);
      const isBase = q >= 1;

      // Candidate pool + scoring differ by slot kind:
      //  • BASE slot — capped at the running per-unit budget (remaining ÷ remaining base units; a qty-2
      //    slot draws 2 units). The price-pull nudges the pick toward the ceiling so the base total
      //    climbs toward the band.
      //  • FLEX (qty-0) add-on — an OPTIONAL upsell that doesn't draw the base budget. Prefer wines
      //    within the average base-bottle budget; ONLY if none fit, allow exceeding it by up to
      //    FLEX_HEADROOM (over-budget when necessary, modestly — user call 2026-06-08). No price-pull,
      //    so it picks the best-FIT wine, not the priciest.
      // An explicit slot.priceMax always wins as the hard cap.
      const inCriteria = eligibleFor(slot);                       // in-category, in-stock, dedup'd
      let pool, pullCeiling = Infinity, usePull = false;
      if (slot.priceMax != null) {
        pool = inCriteria.filter(c => c.price <= slot.priceMax);
        pullCeiling = slot.priceMax; usePull = isBase;
      } else if (isBase) {
        pullCeiling = (maxTotal == null) ? Infinity
          : (remainingBaseUnits > 0 ? (maxTotal - committedBaseTotal) / remainingBaseUnits : Infinity);
        pool = inCriteria.filter(c => c.price <= pullCeiling);
        usePull = true;
      } else if (maxTotal == null) {
        pool = inCriteria;                                        // flex, no band → any in-criteria wine
      } else {
        const flexBudget = baseUnitCount > 0 ? (maxTotal / baseUnitCount) : Infinity;
        pool = inCriteria.filter(c => c.price <= flexBudget);                       // prefer in-budget
        if (!pool.length) pool = inCriteria.filter(c => c.price <= flexBudget * FLEX_HEADROOM);  // else modest overage
      }

      if (!pool.length) {
        // Couldn't fill the slot from in-stock, in-criteria wines. We NEVER substitute a different
        // category (eligibleFor is hard-filtered by the slot's criteria); instead keep the current
        // wine so the slot doesn't export blank, and FLAG the failure so the operator can fix
        // conditions — restock the category, loosen the criteria, or widen the band. Distinguish:
        //   'unfilled'     — no in-stock wine matches the slot's category/criteria at all (stock-out).
        //   'over_ceiling' — in-criteria wines exist but all exceed the price ceiling (budget too tight).
        // (Flags are raised for BASE slots; an optional flex add-on going unfilled isn't a failure.)
        searchStats[slot.slotId] = {
          inCriteriaCount: inCriteria.length,
          cheapest: inCriteria.length ? Math.min.apply(null, inCriteria.map(c => c.price)) : null,
          ceiling: (usePull && isFinite(pullCeiling)) ? pullCeiling : null
        };
        if (isBase) {
          slotFlags.push({ slotId: slot.slotId, flag: inCriteria.length ? 'over_ceiling' : 'unfilled' });
          if (currentSku[slot.slotId]) committedBaseTotal += (priceBySlot[slot.slotId] || 0) * q;
          remainingBaseUnits -= q;
        }
        return;
      }

      let best = pool[0], bestScore = _scoreCandidate(pool[0]) + (usePull ? _priceFitScore(pool[0].price, pullCeiling) : 0);
      for (let i = 1; i < pool.length; i++) {
        const sc = _scoreCandidate(pool[i]) + (usePull ? _priceFitScore(pool[i].price, pullCeiling) : 0);
        if (sc > bestScore) { bestScore = sc; best = pool[i]; }
      }
      if (best.sku !== currentSku[slot.slotId]) {
        assignProductToSlot(slot.slotId, best.sku, 'Stage 7 generator');
        currentSku[slot.slotId] = best.sku;
        changed++;
      }
      priceBySlot[slot.slotId] = best.price;
      if (isBase) { committedBaseTotal += best.price * q; remainingBaseUnits -= q; }
    });

    // ---- Band enforcement ----
    let baseTotal = 0;
    baseSlots.forEach(s => baseTotal += (priceBySlot[s.slotId] || 0) * qtyOf(s));
    let flagMinUnmet = false, flagMaxExceeded = false;

    // Top-up: raise the total toward sb_MinTotal with the most-gain upgrade that respects sb_MaxTotal.
    if (minTotal != null && baseSlotCount > 0) {
      let guard = 0;
      while (baseTotal < minTotal && guard++ < 50) {
        let pick = null;   // {slot, sku, price, cur, q, gain}
        baseSlots.forEach(slot => {
          const q = qtyOf(slot);
          const cur = priceBySlot[slot.slotId] || 0;
          eligibleFor(slot).forEach(c => {
            if (c.price <= cur) return;                                  // upgrades only
            const newTotal = baseTotal - cur * q + c.price * q;
            if (maxTotal != null && newTotal > maxTotal) return;        // max-guard
            const gain = (c.price - cur) * q;
            if (!pick || gain > pick.gain) pick = { slot: slot, sku: c.sku, price: c.price, cur: cur, q: q, gain: gain };
          });
        });
        if (!pick) break;
        assignProductToSlot(pick.slot.slotId, pick.sku, 'Stage 7 top-up');
        currentSku[pick.slot.slotId] = pick.sku;
        priceBySlot[pick.slot.slotId] = pick.price;
        baseTotal = baseTotal - pick.cur * pick.q + pick.price * pick.q;
        changed++;
      }
      if (baseTotal < minTotal) flagMinUnmet = true;
    }

    // Down-pass: lower the total to ≤ sb_MaxTotal by downgrading the priciest base slot that has a
    // cheaper eligible wine. Strictly cheaper each step → monotone, terminates (rev 2.2).
    if (maxTotal != null && baseSlotCount > 0) {
      let guard = 0;
      while (baseTotal > maxTotal && guard++ < 50) {
        const ordered = baseSlots.slice().sort((a, b) => (priceBySlot[b.slotId] || 0) - (priceBySlot[a.slotId] || 0));
        let pick = null;   // {slot, sku, price, cur, q}
        for (const slot of ordered) {
          const q = qtyOf(slot);
          const cur = priceBySlot[slot.slotId] || 0;
          let cheaper = null;
          eligibleFor(slot).forEach(c => { if (c.price < cur && (!cheaper || c.price < cheaper.price)) cheaper = c; });
          if (cheaper) { pick = { slot: slot, sku: cheaper.sku, price: cheaper.price, cur: cur, q: q }; break; }
        }
        if (!pick) break;
        assignProductToSlot(pick.slot.slotId, pick.sku, 'Stage 7 down-pass');
        currentSku[pick.slot.slotId] = pick.sku;
        priceBySlot[pick.slot.slotId] = pick.price;
        baseTotal = baseTotal - pick.cur * pick.q + pick.price * pick.q;
        changed++;
      }
      if (baseTotal > maxTotal) flagMaxExceeded = true;
    }

    // ---- Self-check + stamp ----
    // Don't trust the bookkeeping above (flagMinUnmet/flagMaxExceeded/slotFlags) as the final word —
    // it's the generator's own narrower internal accounting, and it can say "ok" on a pick that the
    // system's REAL, authoritative deficiency test (_evaluateBundleDeficiency — the same one that
    // drives "Needs attention" everywhere else) still fails. So re-run that exact test against this
    // run's actual result (currentSku, updated in place above) and report ITS verdict, not our own.
    // opts.inv is the full context maintainBundles/maintainBundle/rerollBundles already built; when a
    // caller doesn't supply it (shouldn't happen post-rollout, kept as a safety fallback), fall back
    // to the old internal-only accounting rather than throw.
    let flags, stillDeficient, postCheck = null;
    if (opts.inv) {
      postCheck = _evaluateBundleDeficiency(bundle, opts.inv, currentSku);
      const flagsArr = [];
      postCheck.bandFlags.forEach(f => {
        flagsArr.push(f + ':total=' + postCheck.baseTotal + ',' + (f === 'below_min' ? 'min=' + minTotal : 'max=' + maxTotal));
      });
      postCheck.deficientSlots.forEach(d => {
        let entry = d.reason + ':' + d.slotId;
        if (d.reason === 'stock') entry += ':avail=' + d.stock + ',min=' + opts.inv.threshold;
        const s = searchStats[d.slotId];
        if (s) entry += ':searched=' + s.inCriteriaCount + (s.cheapest != null ? ',cheapest=' + s.cheapest : '') + (s.ceiling != null ? ',ceiling=' + Math.round(s.ceiling) : '');
        flagsArr.push(entry);
      });
      flags = flagsArr.join(';');
      stillDeficient = postCheck.deficientSlots.length > 0 || postCheck.bandFlags.length > 0;
    } else {
      const flagsArr = [];
      if (flagMinUnmet) flagsArr.push('min_total_unmet');
      if (flagMaxExceeded) flagsArr.push('max_total_exceeded');
      slotFlags.forEach(f => flagsArr.push(f.flag + ':' + f.slotId));
      flags = flagsArr.join(';');
      stillDeficient = flags !== '';
    }

    updateBundle(bundle.bundleId, { lastGenerated: new Date().toISOString(), genFlags: flags });

    const inBand = postCheck ? (postCheck.bandFlags.length === 0)
      : (minTotal == null || baseTotal >= minTotal) && (maxTotal == null || baseTotal <= maxTotal);
    return {
      bundleId: bundle.bundleId, bundleName: bundle.nameEn, mode: mode,
      productSlots: productSlots.length,
      refilled: productSlots.filter(s => refill[s.slotId]).length,
      changed: changed, baseTotal: Math.round(baseTotal),
      minTotal: minTotal, maxTotal: maxTotal, inBand: inBand, flags: flags, stillDeficient: stillDeficient
    };
  }

  /**
   * MAINTAIN (default) — fix only the deficient slots across every deficient bundle (the
   * `task.bundles.needs_update` set). Conservative: keeps every still-valid wine, swaps only what's
   * broken, and nudges the total into the band. Auto-applies; the web export is the gate.
   * @returns {Object} { totalBundles, generated, results: [...] }
   */
  function maintainBundles() {
    const fnName = 'maintainBundles';
    const deficiencies = getBundleDeficiencies();
    // Build the eligible-products context ONCE for the whole run (shared across every bundle's slot
    // picks) instead of re-reading WebProdM/WebDetM per slot — the big maintain/reroll speedup.
    const inv = _buildBundleInventoryContext();
    const genCtx = inv ? inv.ctx : null;
    const results = [];
    deficiencies.forEach(d => {
      try {
        const ids = new Set((d.deficientSlots || []).map(ds => ds.slotId));
        results.push(_generateBundleComposition(d.bundle, { mode: 'maintain', deficientSlotIds: ids, ctx: genCtx, inv: inv }));
      } catch (e) {
        LoggerService.error(SERVICE_NAME, fnName, `Maintain failed for ${d.bundle.bundleId}: ${e.message}`, e);
        results.push({ bundleId: d.bundle.bundleId, bundleName: d.bundle.nameEn, error: e.message });
      }
    });
    const ok = results.filter(r => !r.error).length;
    LoggerService.info(SERVICE_NAME, fnName, `Maintained ${ok}/${deficiencies.length} deficient bundles`);
    return { totalBundles: deficiencies.length, generated: ok, results: results };
  }

  /**
   * MAINTAIN one bundle (single-bundle target for the editor, Phase 5 §C). Same logic as
   * maintainBundles, scoped to the given bundle: re-picks only ITS deficient slots and nudges the
   * total into [sb_MinTotal, sb_MaxTotal]. Structure-preserving; web export remains the gate.
   * @param {string} bundleId
   * @returns {Object} { totalBundles, generated, results, clean? } (or { error } on failure)
   */
  function maintainBundle(bundleId) {
    const fnName = 'maintainBundle';
    const bundle = getBundle(bundleId);
    if (!bundle) return { error: 'Bundle not found: ' + bundleId, totalBundles: 0, generated: 0, results: [] };
    const inv = _buildBundleInventoryContext();
    if (!inv) return { error: 'Comax inventory data unavailable', totalBundles: 0, generated: 0, results: [] };
    const d = _evaluateBundleDeficiency(bundle, inv);
    if (d.deficientSlots.length === 0 && d.bandFlags.length === 0) {
      LoggerService.info(SERVICE_NAME, fnName, `${bundleId} has no deficiency — nothing to maintain`);
      return { totalBundles: 0, generated: 0, results: [], clean: true };
    }
    try {
      const ids = new Set((d.deficientSlots || []).map(ds => ds.slotId));
      const res = _generateBundleComposition(bundle, { mode: 'maintain', deficientSlotIds: ids, ctx: inv.ctx, inv: inv });
      LoggerService.info(SERVICE_NAME, fnName, `Maintained ${bundleId}`);
      return { totalBundles: 1, generated: res.error ? 0 : 1, results: [res] };
    } catch (e) {
      LoggerService.error(SERVICE_NAME, fnName, `Maintain failed for ${bundleId}: ${e.message}`, e);
      return { totalBundles: 1, generated: 0, results: [{ bundleId: bundle.bundleId, bundleName: bundle.nameEn, error: e.message }] };
    }
  }

  /**
   * RE-ROLL — explicit fresh lineup. One bundle (bundleId given) or every non-archived bundle.
   * Higher churn; for a seasonal reset / new bundle / "give me new wines".
   * @param {string} [bundleId] - re-roll just this bundle; omit to re-roll all non-archived bundles
   * @returns {Object} { totalBundles, generated, results: [...] }
   */
  function rerollBundles(bundleId) {
    const fnName = 'rerollBundles';
    let bundles;
    if (bundleId) {
      const b = getBundle(bundleId);
      bundles = b ? [b] : [];
    } else {
      bundles = _loadBundles().filter(b => b.status !== 'Archived');
    }
    // Build the eligible-products context ONCE for the run (shared across all bundles' slot picks).
    const inv = _buildBundleInventoryContext();
    const genCtx = inv ? inv.ctx : null;
    const results = [];
    bundles.forEach(b => {
      try {
        results.push(_generateBundleComposition(b, { mode: 'reroll', ctx: genCtx, inv: inv }));
      } catch (e) {
        LoggerService.error(SERVICE_NAME, fnName, `Re-roll failed for ${b.bundleId}: ${e.message}`, e);
        results.push({ bundleId: b.bundleId, bundleName: b.nameEn, error: e.message });
      }
    });
    const ok = results.filter(r => !r.error).length;
    LoggerService.info(SERVICE_NAME, fnName, `Re-rolled ${ok}/${bundles.length} bundles`);
    return { totalBundles: bundles.length, generated: ok, results: results };
  }

  /**
   * Builds the shared inventory context for stock/criteria evaluation — one set of sheet reads
   * (CmxProdM stock, SysInventoryOnHold, WebProdM prices/names/categories, WebDetM attributes)
   * consumed by BOTH getBundlesWithLowInventory (stock-only) and getBundleDeficiencies (richer
   * Stage 7 signal). Collapses the per-slot N+1 to a single pass.
   * @param {number} threshold - Stock threshold (uses system config if not specified)
   * @returns {Object|null} context, or null if CmxProdM is missing
   */
  function _buildBundleInventoryContext(threshold) {
    const functionName = '_buildBundleInventoryContext';
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
      return null;
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

    // 3. Read WebProdM once — English names for productMap here AND the invariant context handed to
    //    getEligibleProducts (Fix A: build the per-slot inputs once, not per low-stock slot). Also
    //    build webAttrMap (web price / title / categories) for the Stage 7 criteria recheck — the
    //    deficiency test must use the WEB regular price (what getEligibleProducts filters on and what
    //    _calculateBundlePrice sums), not the Comax price in productMap.
    let webData = [];
    const webCols = {};
    const webAttrMap = {};
    const webSheet = spreadsheet.getSheetByName('WebProdM');
    if (webSheet) {
      webData = webSheet.getDataRange().getValues();
      const webSchema = allConfig['schema.data.WebProdM'];
      webSchema.headers.split(',').forEach((h, i) => webCols[h] = i);

      for (let i = 1; i < webData.length; i++) {
        const row = webData[i];
        const sku = String(row[webCols.wpm_SKU] || '');
        if (!sku) continue;
        if (productMap[sku]) {
          productMap[sku].nameEn = row[webCols.wpm_PostTitle] || '';
        }
        const catStr = String(row[webCols.wpm_TaxProductCat] || '');
        webAttrMap[sku] = {
          price: Number(row[webCols.wpm_RegularPrice]) || 0,
          name: String(row[webCols.wpm_PostTitle] || ''),
          categories: catStr.split(',').map(c => c.trim()).filter(c => c)
        };
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

    // comaxStockMap/onHoldMap ride along so getEligibleProducts can filter candidates on the same
    // live Comax-minus-on-hold figure _evaluateBundleDeficiency uses, instead of WebProdM's own
    // wpm_Stock (only as fresh as the last stock sync) — keeps "eligible" and "deficient" consistent.
    const ctx = {
      webData: webData, webCols: webCols, detailsMap: detailsMap, allSlots: allSlots, minStock: eligibleMinStock,
      comaxStockMap: comaxStockMap, onHoldMap: onHoldMap
    };

    return {
      threshold: threshold, allSlots: allSlots,
      comaxStockMap: comaxStockMap, onHoldMap: onHoldMap, productMap: productMap,
      webAttrMap: webAttrMap, detailsMap: detailsMap, ctx: ctx
    };
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

    const inv = _buildBundleInventoryContext(threshold);
    if (!inv) return [];   // CmxProdM missing
    const comaxStockMap = inv.comaxStockMap;
    const onHoldMap = inv.onHoldMap;
    const productMap = inv.productMap;
    const allSlots = inv.allSlots;
    const ctx = inv.ctx;
    threshold = inv.threshold;

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

  /**
   * Stage 7 rev 2.2 — the richer deficiency signal driving `task.bundles.needs_update` and Maintain.
   * A PRODUCT slot is deficient when its current wine is (a) out/low-stock (available = Comax − on-hold
   * < threshold), (b) no longer satisfies its slot criteria (category/price/intensity/… — `_matchesSlotCriteria`,
   * which also catches price > slot.priceMax, the gate-time "over-band"), or (c) a base (qty≥1) slot with
   * no wine at all ('empty'). A BUNDLE is deficient if any slot is, OR its base total falls outside its
   * price band (baseTotal < sb_MinTotal → 'below_min', > sb_MaxTotal → 'above_max'). Base total sums
   * web price × qty over qty≥1 product slots; flexible (qty-0) add-ons contribute 0 (rev 2.2). Population
   * = non-archived (matches the generator's, rev 2.1 #7).
   * @param {number} threshold - Stock threshold (uses system config if not specified)
   * @returns {Array<Object>} [{ bundle, deficientSlots:[{slotId,reason,stock}], baseTotal, bandFlags:[] }]
   */
  // Evaluate ONE bundle's deficiency against a prebuilt inventory context. Shared by getBundleDeficiencies
  // (loop over all) and getBundleDeficiency (single, for the editor). Returns {deficientSlots, baseTotal, bandFlags}.
  // activeSkuOverride (optional): {slotId: sku} — evaluate as if these slots carried these SKUs
  // instead of `slot.activeSKU`, without a fresh sheet read. Used by _generateBundleComposition to
  // self-check its own just-picked result against this same, real deficiency test (see call site).
  function _evaluateBundleDeficiency(bundle, inv, activeSkuOverride) {
    const comaxStockMap = inv.comaxStockMap, onHoldMap = inv.onHoldMap, webAttrMap = inv.webAttrMap,
          detailsMap = inv.detailsMap, allSlots = inv.allSlots, threshold = inv.threshold;
    const bundleSlots = allSlots
      .filter(s => s.bundleId === bundle.bundleId && s.slotType === 'Product')
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const deficientSlots = [];
    let baseTotal = 0;

    for (const slot of bundleSlots) {
      const qty = (slot.defaultQty === '' || slot.defaultQty == null) ? 1 : Number(slot.defaultQty);
      const isBase = qty >= 1;
      const activeSKU = (activeSkuOverride && Object.prototype.hasOwnProperty.call(activeSkuOverride, slot.slotId))
        ? activeSkuOverride[slot.slotId] : slot.activeSKU;

      if (!activeSKU) {
        if (isBase) deficientSlots.push({ slotId: slot.slotId, reason: 'empty', stock: null });
        continue;
      }

      const attrs = webAttrMap[activeSKU];
      const price = attrs ? attrs.price : 0;
      if (isBase) baseTotal += price * qty;

      // (a) stock — available = Comax − on-hold; only assessable when the SKU is in Comax.
      const comaxStock = comaxStockMap[activeSKU];
      const stock = (comaxStock === undefined) ? null : comaxStock - (onHoldMap[activeSKU] || 0);
      let reason = null;
      if (stock !== null && stock < threshold) {
        reason = 'stock';
      } else if (attrs) {
        // (b) criteria recheck (includes price > slot.priceMax = over-band). Skip only when the wine
        //     has no web row at all (can't evaluate — leave it to the stock/export paths).
        const det = detailsMap[activeSKU] || {};
        const matches = _matchesSlotCriteria({
          categories: attrs.categories, price: price, name: attrs.name,
          intensity: det.intensity, complexity: det.complexity, acidity: det.acidity
        }, slot);
        if (!matches) reason = 'criteria';
      }
      if (reason) deficientSlots.push({ slotId: slot.slotId, reason: reason, stock: stock });
    }

    // Bundle-level band trigger (base total only; flexible slots excluded).
    const bandFlags = [];
    if (bundle.minTotal != null && baseTotal < bundle.minTotal) bandFlags.push('below_min');
    if (bundle.maxTotal != null && baseTotal > bundle.maxTotal) bandFlags.push('above_max');

    return { deficientSlots: deficientSlots, baseTotal: Math.round(baseTotal * 100) / 100, bandFlags: bandFlags };
  }

  function getBundleDeficiencies(threshold) {
    const bundles = _loadBundles().filter(b => b.status !== 'Archived');
    const inv = _buildBundleInventoryContext(threshold);
    if (!inv) return [];   // CmxProdM missing

    const results = [];
    for (const bundle of bundles) {
      const d = _evaluateBundleDeficiency(bundle, inv);
      if (d.deficientSlots.length > 0 || d.bandFlags.length > 0) {
        results.push({ bundle: bundle, deficientSlots: d.deficientSlots, baseTotal: d.baseTotal, bandFlags: d.bandFlags });
      }
    }
    return results;
  }

  /**
   * Deficiency detail for ONE bundle (for the editor — "why does this need attention?"). Returns the
   * per-slot reasons + band flags even if the bundle is clean (empty arrays). null if not found / no Comax.
   * @param {string} bundleId
   * @returns {{bundleId, deficientSlots:[{slotId,reason,stock}], baseTotal, bandFlags:[]}|null}
   */
  function getBundleDeficiency(bundleId) {
    const bundle = getBundle(bundleId);
    if (!bundle) return null;
    const inv = _buildBundleInventoryContext();
    if (!inv) return null;
    const d = _evaluateBundleDeficiency(bundle, inv);
    return { bundleId: String(bundleId), deficientSlots: d.deficientSlots, baseTotal: d.baseTotal, bandFlags: d.bandFlags };
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

    // 1b. Read existing BUNDLE rows → preserve the jlmops-owned, NON-web-derived fields by bundleId.
    //     The rebuild below sources name/type/status from web, but the Stage 7 price band
    //     (sb_MinTotal/sb_MaxTotal) and generation metadata (sb_LastGenerated/sb_GenFlags) have NO web
    //     source — without this they'd be wiped on every reimport (incl. the daily refresh).
    const existingBundlesData = bundlesSheet.getDataRange().getValues();
    const preservedBundleById = {};
    for (let i = 1; i < existingBundlesData.length; i++) {
      const row = existingBundlesData[i];
      const bid = row[bundleCols.sb_BundleId];
      if (!bid) continue;
      preservedBundleById[bid] = {
        minTotal: bundleCols.sb_MinTotal !== undefined ? row[bundleCols.sb_MinTotal] : '',
        maxTotal: bundleCols.sb_MaxTotal !== undefined ? row[bundleCols.sb_MaxTotal] : '',
        lastGenerated: bundleCols.sb_LastGenerated !== undefined ? row[bundleCols.sb_LastGenerated] : '',
        genFlags: bundleCols.sb_GenFlags !== undefined ? row[bundleCols.sb_GenFlags] : ''
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
        // Carry the jlmops-owned, non-web fields through the rebuild (Stage 7 band + gen metadata).
        const pb = preservedBundleById[b.bundleId];
        if (pb) {
          if (bundleCols.sb_MinTotal !== undefined) bundleRow[bundleCols.sb_MinTotal] = pb.minTotal;
          if (bundleCols.sb_MaxTotal !== undefined) bundleRow[bundleCols.sb_MaxTotal] = pb.maxTotal;
          if (bundleCols.sb_LastGenerated !== undefined) bundleRow[bundleCols.sb_LastGenerated] = pb.lastGenerated;
          if (bundleCols.sb_GenFlags !== undefined) bundleRow[bundleCols.sb_GenFlags] = pb.genFlags;
        }
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

  /**
   * Serializes a bundle's slots back to the WPClever woosb_ids JSON for one language,
   * reusing each slot's ORIGINAL token (the slotId is `${bundleId}-${token}`, so no token
   * regeneration — WPClever accepts the keys it issued). BUNDLE_PLAN Stage 3 serializer.
   *
   * Product slot -> { id, sku, qty, optional, min, max } (string values; id resolved per
   *   language: EN = wpm_ID by SKU; HE = WebXltM wxm_WpmlOriginalId(EN id) -> wxm_ID, the
   *   via WebXltM wxm_WpmlOriginalId -> wxm_ID). Unresolved SKU -> blank id + a warning.
   * Text slot -> { type, text } (text per language).
   *
   * @param {string} bundleId  EN bundle product id.
   * @param {string} lang      'en' | 'he'.
   * @returns {{json:string, warnings:Array<string>}}
   */
  function exportBundleWoosb(bundleId, lang, ctx) {
    const language = (lang === 'he') ? 'he' : 'en';
    const warnings = [];

    const slots = getSlotsForBundle(bundleId);
    if (!slots || slots.length === 0) {
      return { json: '', warnings: [`Bundle ${bundleId} has no slots.`] };
    }
    slots.sort((a, b) => (a.order || 0) - (b.order || 0));

    // SKU -> EN id, and (for HE) EN id -> HE id (WebXltM wxm_WpmlOriginalId -> wxm_ID). Reuse the
    // preloaded maps when a caller supplies ctx (buildExportTable builds them ONCE for the whole diff)
    // instead of re-reading WebProdM/WebXltM on every call — the export/diff N+1. Absent ctx → build
    // them here (single-bundle callers: getBundleExportMeta, smoke), behaviour unchanged.
    let skuToEnId, enToHeId;
    if (ctx && ctx.skuToEnId) {
      skuToEnId = ctx.skuToEnId;
      enToHeId = ctx.enToHeId || {};
    } else {
      const allConfig = ConfigService.getAllConfig();
      const ss = SheetAccessor.getDataSpreadsheet();
      const wpmHeaders = allConfig['schema.data.WebProdM'].headers.split(',');
      const wpmIdIdx = wpmHeaders.indexOf('wpm_ID');
      const wpmSkuIdx = wpmHeaders.indexOf('wpm_SKU');
      skuToEnId = {};
      const wpmData = ss.getSheetByName('WebProdM').getDataRange().getValues();
      for (let i = 1; i < wpmData.length; i++) {
        const sku = String(wpmData[i][wpmSkuIdx] || '').trim();
        const id = String(wpmData[i][wpmIdIdx] || '').trim();
        if (sku && id) skuToEnId[sku] = id;
      }
      enToHeId = {};
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
   * vs HE `c9su…`); (2) member order — per-language alphabetic (EN English, HE Hebrew); and
   * (3) **TEXT (non-product) slots entirely** — section-header text
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
    const skuToEnId = {};    // SKU -> EN id, built ONCE here + handed to exportBundleWoosb (kills its N+1)
    const wpmData = ss.getSheetByName('WebProdM').getDataRange().getValues();
    for (let i = 1; i < wpmData.length; i++) {
      const id = String(wpmData[i][wpmIdIdx] || '').trim();
      if (id) webEnByBundle[id] = String(wpmData[i][wpmWoosbIdx] || '');
      const sku = wpmSkuIdx >= 0 ? String(wpmData[i][wpmSkuIdx] || '').trim() : '';
      if (sku && wpmStockIdx >= 0) skuToStock[sku] = Number(wpmData[i][wpmStockIdx]);
      if (sku && id) skuToEnId[sku] = id;
    }
    const xltHeaders = allConfig['schema.data.WebXltM'].headers.split(',');
    const xltOrigIdx = xltHeaders.indexOf('wxm_WpmlOriginalId');
    const xltWoosbIdx = xltHeaders.indexOf('wxm_WoosbIds');
    const xltIdIdx = xltHeaders.indexOf('wxm_ID');
    const webHeByBundle = {};
    const enToHeId = {};     // EN id -> HE id, built ONCE here + handed to exportBundleWoosb
    const xltData = ss.getSheetByName('WebXltM').getDataRange().getValues();
    for (let i = 1; i < xltData.length; i++) {
      const enId = String(xltData[i][xltOrigIdx] || '').trim();
      if (enId && xltWoosbIdx !== -1) webHeByBundle[enId] = String(xltData[i][xltWoosbIdx] || '');
      if (enId && xltIdIdx !== -1) enToHeId[enId] = String(xltData[i][xltIdIdx] || '').trim();
    }
    const exportCtx = { skuToEnId: skuToEnId, enToHeId: enToHeId };

    const bundles = getAllBundles();
    const rows = [];
    bundles.forEach(b => {
      const en = exportBundleWoosb(b.bundleId, 'en', exportCtx);
      const he = exportBundleWoosb(b.bundleId, 'he', exportCtx);
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

  /**
   * Phase 2 export (ADMIN_BUNDLES_UI_PLAN §7.6): produce the export worklist as a new Google Sheet
   * — one row per bundle needing push, EN and HE woosb_ids cells side by side, plus any out-of-stock
   * / translation warnings. The user copies cells from the sheet and pastes into WPClever Import.
   * Mirrors the product-detail export sequence (ProductService.generateDetailExport): create sheet,
   * format, move to the exports folder. Task auto-close lives in the controller so the read-only
   * diff (also called by housekeeping) stays side-effect free.
   * @returns {{success:boolean, exportCount:number, total:number, fileUrl:?string, message:string}}
   */
  function exportBundlesToSheet() {
    const result = buildExportTable();
    if ((result.exportCount || 0) === 0) {
      return {
        success: true, exportCount: 0, total: result.total || 0, fileUrl: null,
        message: 'All bundles match web — nothing to export.'
      };
    }

    const header = ['Bundle', 'EN (woosb_ids)', 'HE (woosb_ids)', 'Warnings'];
    const sheetRows = [header];
    result.rows.forEach(function (r) {
      sheetRows.push([
        r.name,
        r.en,
        r.he,
        (r.warnings && r.warnings.length) ? r.warnings.join('; ') : ''
      ]);
    });

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
    const newSpreadsheet = SpreadsheetApp.create('Bundles-Export-' + timestamp);
    const sheet = newSpreadsheet.getSheets()[0];
    sheet.setName('Bundle Export');
    sheet.getRange(1, 1, sheetRows.length, header.length).setValues(sheetRows);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, sheet.getLastRow(), header.length).setWrap(true).setVerticalAlignment('top');
    sheet.setColumnWidth(2, 480); // EN woosb_ids
    sheet.setColumnWidth(3, 480); // HE woosb_ids
    sheet.setColumnWidth(4, 240); // Warnings

    // Move to the exports folder (same as the product-detail export sequence).
    const allConfig = ConfigService.getAllConfig();
    const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
    try {
      DriveApp.getFileById(newSpreadsheet.getId()).moveTo(DriveApp.getFolderById(exportFolderId));
    } catch (moveError) {
      LoggerService.warn(SERVICE_NAME, 'exportBundlesToSheet', `Created in root, move failed: ${moveError.message}`);
    }

    LoggerService.info(SERVICE_NAME, 'exportBundlesToSheet', `Exported ${result.exportCount} bundle(s) to ${newSpreadsheet.getUrl()}`);
    return {
      success: true,
      exportCount: result.exportCount,
      total: result.total || 0,
      fileId: newSpreadsheet.getId(),
      fileUrl: newSpreadsheet.getUrl(),
      fileName: newSpreadsheet.getName(),
      message: `Exported ${result.exportCount} bundle(s).`
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
    saveComposition: saveComposition,

    // Product Assignment
    assignProductToSlot: assignProductToSlot,

    // Eligible Products / Health
    getEligibleProducts: getEligibleProducts,
    getBundlesWithLowInventory: getBundlesWithLowInventory,
    getBundleDeficiencies: getBundleDeficiencies,
    getBundleDeficiency: getBundleDeficiency,

    // Stage 7 — composition generator (rev 2.2: Maintain default + Re-roll explicit)
    maintainBundles: maintainBundles,
    maintainBundle: maintainBundle,
    rerollBundles: rerollBundles,

    // Import / Duplicate
    importBundleFromWooCommerce: importBundleFromWooCommerce,
    reimportAllBundlesBatch: reimportAllBundlesBatch,
    duplicateBundle: duplicateBundle,

    // Authoring export (Stage 3) — slots -> WPClever woosb_ids JSON per language
    exportBundleWoosb: exportBundleWoosb,
    buildExportTable: buildExportTable,
    exportBundlesToSheet: exportBundlesToSheet,

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
