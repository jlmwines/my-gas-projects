/**
 * @file CouponService.js
 * @description Service for managing WooCommerce coupons and tracking redemption.
 * Imports coupon data from WooCommerce export and tracks usage through orders.
 */

const CouponService = (function () {
  const SERVICE_NAME = 'CouponService';

  // Auto-tag rules
  const WAR_SUPPORT_KEYWORDS = ['efrat', 'roshtzurim', 'gushwarriors', 'gush', 'tekoa'];

  // Cache
  let _couponCache = null;
  let _cacheTimestamp = null;
  const CACHE_TTL_MS = 60000;

  /**
   * Clears the internal cache.
   */
  function clearCache() {
    _couponCache = null;
    _cacheTimestamp = null;
  }

  /**
   * Gets the SysCoupons sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getCouponsSheet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    return SheetAccessor.getDataSheet(sheetNames.SysCoupons, false);
  }

  /**
   * Gets the SysCouponUsage sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getUsageSheet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    return SheetAccessor.getDataSheet(sheetNames.SysCouponUsage, false);
  }

  /**
   * Gets column indices for SysCoupons sheet.
   * @returns {Object} Map of column names to 0-based indices
   */
  function _getCouponColumnIndices() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysCoupons'];
    if (!schema || !schema.headers) {
      throw new Error('Schema for SysCoupons not found in configuration.');
    }
    const headers = schema.headers.split(',');
    const indices = {};
    headers.forEach((h, i) => indices[h] = i);
    return indices;
  }

  /**
   * Gets column indices for SysCouponUsage sheet.
   * @returns {Object} Map of column names to 0-based indices
   */
  function _getUsageColumnIndices() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysCouponUsage'];
    if (!schema || !schema.headers) {
      throw new Error('Schema for SysCouponUsage not found in configuration.');
    }
    const headers = schema.headers.split(',');
    const indices = {};
    headers.forEach((h, i) => indices[h] = i);
    return indices;
  }

  /**
   * Derives tags from coupon properties.
   * @param {Object} coupon - Coupon object
   * @returns {string} Comma-separated tags
   */
  function _deriveCouponTags(coupon) {
    const tags = [];
    const code = (coupon.sco_Code || '').toLowerCase();

    // War-support
    if (WAR_SUPPORT_KEYWORDS.some(w => code.includes(w))) {
      tags.push('war-support');
    }

    // Welcome/first-purchase
    if (coupon.sco_FirstPurchaseOnly || code.includes('welcome')) {
      tags.push('welcome');
    }

    // Threshold
    if (coupon.sco_MinSpend > 0) {
      tags.push('threshold');
    }

    // Gift
    if (coupon.sco_FreeProductId) {
      tags.push('gift');
    }

    // Shipping-only
    if (coupon.sco_FreeShipping && coupon.sco_Amount === 0) {
      tags.push('shipping-only');
    }

    return tags.join(',');
  }

  /**
   * Determines if a coupon is currently active.
   * @param {Object} coupon - Coupon object
   * @returns {boolean}
   */
  function _isCouponActive(coupon) {
    if (coupon.sco_Status !== 'publish') return false;
    if (coupon.sco_ExpiryDate && new Date(coupon.sco_ExpiryDate) < new Date()) return false;
    if (coupon.sco_UsageLimit > 0 && coupon.sco_UsageCount >= coupon.sco_UsageLimit) return false;
    return true;
  }

  /**
   * Loads all coupons into cache.
   * @returns {Array<Object>} Array of coupon objects
   */
  function _loadCoupons() {
    const now = Date.now();
    if (_couponCache && _cacheTimestamp && (now - _cacheTimestamp) < CACHE_TTL_MS) {
      return _couponCache;
    }

    const sheet = _getCouponsSheet();
    if (!sheet) {
      LoggerService.warn(SERVICE_NAME, '_loadCoupons', 'SysCoupons sheet not found');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      _couponCache = [];
      _cacheTimestamp = now;
      return [];
    }

    const indices = _getCouponColumnIndices();
    const coupons = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const coupon = {};
      Object.keys(indices).forEach(col => {
        coupon[col] = row[indices[col]];
      });
      coupons.push(coupon);
    }

    _couponCache = coupons;
    _cacheTimestamp = now;
    return coupons;
  }

  /**
   * Gets a coupon by code.
   * @param {string} code - Coupon code
   * @returns {Object|null} Coupon object or null
   */
  function getCouponByCode(code) {
    if (!code) return null;
    const coupons = _loadCoupons();
    return coupons.find(c => c.sco_Code === code) || null;
  }

  /**
   * Gets all active coupons.
   * @returns {Array<Object>} Active coupons
   */
  function getActiveCoupons() {
    const coupons = _loadCoupons();
    return coupons.filter(_isCouponActive);
  }

  /**
   * Gets coupons matching filter criteria.
   * @param {Object} filters - Filter criteria
   * @returns {Array<Object>} Filtered coupons
   */
  function getCoupons(filters = {}) {
    const coupons = _loadCoupons();

    return coupons.filter(c => {
      if (filters.activeOnly && !_isCouponActive(c)) return false;
      if (filters.tag && !(c.sco_Tags || '').includes(filters.tag)) return false;
      if (filters.discountType && c.sco_DiscountType !== filters.discountType) return false;
      return true;
    });
  }

  /**
   * Creates or updates a coupon record.
   * @param {Object} couponData - Coupon data with sco_Code required
   * @returns {Object} Updated coupon
   */
  function upsertCoupon(couponData) {
    if (!couponData.sco_Code) {
      throw new Error('sco_Code is required for upsert');
    }

    const sheet = _getCouponsSheet();
    const indices = _getCouponColumnIndices();
    const headers = Object.keys(indices);
    const data = sheet.getDataRange().getValues();

    // Derive tags if not provided
    if (!couponData.sco_Tags) {
      couponData.sco_Tags = _deriveCouponTags(couponData);
    }

    // Calculate isActive
    couponData.sco_IsActive = _isCouponActive(couponData);
    couponData.sco_LastImported = new Date();

    // Find existing row
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][indices.sco_Code] === couponData.sco_Code) {
        rowIndex = i;
        break;
      }
    }

    // Build row array
    const rowArray = new Array(headers.length).fill('');
    headers.forEach((h, i) => {
      if (couponData[h] !== undefined) {
        rowArray[i] = couponData[h];
      } else if (rowIndex >= 0) {
        rowArray[i] = data[rowIndex][i];
      }
    });

    if (rowIndex >= 0) {
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([rowArray]);
    } else {
      sheet.appendRow(rowArray);
    }

    clearCache();
    return couponData;
  }

  /**
   * Records a coupon usage event.
   * @param {Object} usage - Usage data
   * @returns {string} Usage ID
   */
  function recordUsage(usage) {
    const sheet = _getUsageSheet();
    if (!sheet) {
      throw new Error('SysCouponUsage sheet not found');
    }

    const indices = _getUsageColumnIndices();
    const headers = Object.keys(indices);

    const usageId = Utilities.getUuid();
    const rowArray = new Array(headers.length).fill('');

    rowArray[indices.scu_Id] = usageId;
    rowArray[indices.scu_Code] = usage.scu_Code || '';
    rowArray[indices.scu_Email] = (usage.scu_Email || '').toLowerCase().trim();
    rowArray[indices.scu_OrderId] = usage.scu_OrderId || '';
    rowArray[indices.scu_OrderDate] = usage.scu_OrderDate || new Date();
    rowArray[indices.scu_DiscountAmount] = usage.scu_DiscountAmount || 0;
    rowArray[indices.scu_OrderTotal] = usage.scu_OrderTotal || 0;
    rowArray[indices.scu_WasFirstOrder] = usage.scu_WasFirstOrder || false;
    rowArray[indices.scu_ConvertedToRepeat] = usage.scu_ConvertedToRepeat || false;

    sheet.appendRow(rowArray);
    return usageId;
  }

  /**
   * Gets usage records for a coupon code.
   * @param {string} code - Coupon code
   * @returns {Array<Object>} Usage records
   */
  function getUsageByCode(code) {
    const sheet = _getUsageSheet();
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const indices = _getUsageColumnIndices();
    const records = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[indices.scu_Code] === code) {
        const record = {};
        Object.keys(indices).forEach(col => {
          record[col] = row[indices[col]];
        });
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Calculates conversion rate for a coupon.
   * @param {string} code - Coupon code
   * @returns {number|null} Conversion rate (0-100) or null if no data
   */
  function calculateConversionRate(code) {
    const usages = getUsageByCode(code);
    if (usages.length === 0) return null;

    const conversions = usages.filter(u => u.scu_ConvertedToRepeat).length;
    return Math.round((conversions / usages.length) * 100);
  }

  /**
   * Imports coupons from a WooCommerce coupon export CSV.
   * @param {string} csvContent - CSV content
   * @returns {Object} Import results
   */
  function importFromCsv(csvContent) {
    const fnName = 'importFromCsv';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting coupon import');

    const lines = Utilities.parseCsv(csvContent);
    if (lines.length <= 1) {
      return { imported: 0, errors: ['No data rows found'] };
    }

    const csvHeaders = lines[0];
    const headerMap = {};
    csvHeaders.forEach((h, i) => headerMap[h.trim()] = i);

    // Mapping from WooCommerce export columns to our schema
    const mapping = {
      'post_title': 'sco_Code',
      'ID': 'sco_WooId',
      'post_excerpt': 'sco_Description',
      'post_status': 'sco_Status',
      'post_date': 'sco_CreatedDate',
      'discount_type': 'sco_DiscountType',
      'coupon_amount': 'sco_Amount',
      'free_shipping': 'sco_FreeShipping',
      'minimum_amount': 'sco_MinSpend',
      'maximum_amount': 'sco_MaxSpend',
      'product_categories': 'sco_Categories',
      'individual_use': 'sco_IndividualUse',
      'usage_limit': 'sco_UsageLimit',
      'usage_limit_per_user': 'sco_UsageLimitPerUser',
      'usage_count': 'sco_UsageCount',
      'date_expires': 'sco_ExpiryDate',
      'customer_email': 'sco_CustomerEmail'
    };

    let imported = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = lines[i];
        const couponData = {};

        // Map fields
        Object.keys(mapping).forEach(csvCol => {
          if (headerMap[csvCol] !== undefined) {
            let value = row[headerMap[csvCol]];

            // Type conversions
            const targetCol = mapping[csvCol];
            if (targetCol === 'sco_WooId' || targetCol === 'sco_UsageLimit' ||
                targetCol === 'sco_UsageLimitPerUser' || targetCol === 'sco_UsageCount') {
              value = parseInt(value, 10) || 0;
            } else if (targetCol === 'sco_Amount' || targetCol === 'sco_MinSpend' ||
                       targetCol === 'sco_MaxSpend') {
              value = parseFloat(value) || 0;
            } else if (targetCol === 'sco_FreeShipping' || targetCol === 'sco_IndividualUse') {
              value = value === 'yes' || value === '1' || value === true;
            } else if (targetCol === 'sco_CreatedDate' || targetCol === 'sco_ExpiryDate') {
              value = value ? new Date(value) : null;
            }

            couponData[targetCol] = value;
          }
        });

        // Check for first purchase only meta
        const firstPurchaseCol = 'meta:_wjecf_first_purchase_only';
        if (headerMap[firstPurchaseCol] !== undefined) {
          couponData.sco_FirstPurchaseOnly = row[headerMap[firstPurchaseCol]] === 'yes';
        }

        // Check for free product meta
        const freeProductCol = 'meta:_wjecf_free_product_ids';
        if (headerMap[freeProductCol] !== undefined) {
          const freeIds = row[headerMap[freeProductCol]];
          couponData.sco_FreeProductId = freeIds ? freeIds.split(',')[0].trim() : '';
        }

        if (couponData.sco_Code) {
          upsertCoupon(couponData);
          imported++;
        }
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    LoggerService.info(SERVICE_NAME, fnName, `Imported ${imported} coupons, ${errors.length} errors`);
    return { imported, errors };
  }

  // Public API
  return {
    clearCache: clearCache,
    getCouponByCode: getCouponByCode,
    getActiveCoupons: getActiveCoupons,
    getCoupons: getCoupons,
    upsertCoupon: upsertCoupon,
    recordUsage: recordUsage,
    getUsageByCode: getUsageByCode,
    calculateConversionRate: calculateConversionRate,
    importFromCsv: importFromCsv,
    // Expose for testing
    _deriveCouponTags: _deriveCouponTags,
    _isCouponActive: _isCouponActive
  };
})();

/**
 * Import coupons from file in import folder.
 * Looks for file containing 'coupon' in name.
 */
function importCouponsFromFolder() {
  const rows = getImportFileData('coupon');
  if (!rows) {
    return { error: 'Coupon export file not found in import folder' };
  }

  // Convert rows back to CSV for existing import function
  const csvContent = rows.map(row => row.map(cell => {
    const str = String(cell);
    if (str.includes(',') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }).join(',')).join('\n');

  return CouponService.importFromCsv(csvContent);
}
