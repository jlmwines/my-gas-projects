/**
 * @file ContactEnrichmentService.js
 * @description Enriches contact records with calculated preferences from order history.
 * Analyzes purchased products to determine wine preferences, top wineries, and price ranges.
 */

const ContactEnrichmentService = (function () {
  const SERVICE_NAME = 'ContactEnrichmentService';

  // Config cache (loaded once per execution)
  let _enrichmentConfig = null;

  /**
   * Gets enrichment config values from CRM config.
   * @returns {Object} Enrichment configuration
   */
  function _getEnrichmentConfig() {
    if (_enrichmentConfig) return _enrichmentConfig;

    const allConfig = ConfigService.getAllConfig();
    _enrichmentConfig = {
      categoryMinPercent: parseInt(allConfig['crm.enrichment.category']?.min_percent, 10) || 15,
      priceMinPercentile: parseInt(allConfig['crm.enrichment.price']?.min_percentile, 10) || 10,
      priceMaxPercentile: parseInt(allConfig['crm.enrichment.price']?.max_percentile, 10) || 90,
      attrMinPercentile: parseInt(allConfig['crm.enrichment.attributes']?.min_percentile, 10) || 15,
      attrMaxPercentile: parseInt(allConfig['crm.enrichment.attributes']?.max_percentile, 10) || 85
    };
    return _enrichmentConfig;
  }

  // Known wineries for extraction from product names
  const KNOWN_WINERIES = [
    'Golan Heights', 'Carmel', 'Barkan', 'Recanati', 'Dalton', 'Teperberg',
    'Psagot', 'Tabor', 'Galil Mountain', 'Yatir', 'Flam', 'Tzora', 'Ella Valley',
    'Vitkin', 'Jezreel Valley', 'Shiloh', 'Tulip', 'Feldstein', 'Mony', 'Pelter',
    'Alexander', 'Binyamina', 'Segal', 'Tishbi', 'Castel', 'Domaine du Castel',
    'Covenant', 'Hagafen', 'Herzog', 'Four Gates', 'Shvo', 'Netofa', 'Chateau Golan',
    'Yarden', 'Gamla', 'Gush Etzion', 'Tura', 'Or Haganuz', 'Midbar', 'Lueria',
    'Agur', 'Bat Shlomo', 'Adir', 'Kayoumi', 'Margalit', 'Maia', 'Sphera'
  ];

  // Hebrew to English category translation (cpm_Group values)
  const CATEGORY_TRANSLATION = {
    'יין אדום יבש': 'Dry Red',
    'יין לבן יבש': 'Dry White',
    'רוזה': 'Rosé',
    'יין רוזה': 'Rosé',
    'יין מוגז': 'Sparkling',
    'יין קינוח': 'Dessert',
    'יין מחוזק': 'Fortified',
    'יין חצי יבש': 'Semi-Dry'
  };

  // English to Hebrew category translation (reverse of above)
  const CATEGORY_TRANSLATION_HE = {
    'Dry Red': 'יין אדום יבש',
    'Dry White': 'יין לבן יבש',
    'Rosé': 'רוזה',
    'Sparkling': 'יין מוגז',
    'Dessert': 'יין קינוח',
    'Fortified': 'יין מחוזק',
    'Semi-Dry': 'יין חצי יבש'
  };

  // Cache for lookup tables
  let _brandsLookup = null;
  let _categoriesLookup = null;

  /**
   * Loads SysBrands lookup table for brand translations.
   * @returns {Map<string, Object>} Map of BrandEn to {en, he}
   */
  function _loadBrandsLookup() {
    if (_brandsLookup) return _brandsLookup;

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    const sheet = spreadsheet.getSheetByName(sheetNames.SysBrands || 'SysBrands');
    _brandsLookup = new Map();

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        const headers = data[0];
        const idx = {};
        headers.forEach((h, i) => idx[h] = i);

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const brandEn = String(row[idx['sbr_BrandEn']] || '').trim();
          const brandHe = String(row[idx['sbr_BrandHe']] || '').trim();
          if (brandEn) {
            _brandsLookup.set(brandEn.toLowerCase(), { en: brandEn, he: brandHe || brandEn });
          }
        }
      }
    }

    LoggerService.info(SERVICE_NAME, '_loadBrandsLookup', `Loaded ${_brandsLookup.size} brands`);
    return _brandsLookup;
  }

  /**
   * Loads SysCategories lookup table for category translations.
   * @returns {Map<string, Object>} Map of NameEn to {en, he}
   */
  function _loadCategoriesLookup() {
    if (_categoriesLookup) return _categoriesLookup;

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    const sheet = spreadsheet.getSheetByName(sheetNames.SysCategories || 'SysCategories');
    _categoriesLookup = new Map();

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        const headers = data[0];
        const idx = {};
        headers.forEach((h, i) => idx[h] = i);

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const nameEn = String(row[idx['sct_NameEn']] || '').trim();
          const nameHe = String(row[idx['sct_NameHe']] || '').trim();
          if (nameEn) {
            _categoriesLookup.set(nameEn.toLowerCase(), { en: nameEn, he: nameHe || nameEn });
          }
        }
      }
    }

    LoggerService.info(SERVICE_NAME, '_loadCategoriesLookup', `Loaded ${_categoriesLookup.size} categories`);
    return _categoriesLookup;
  }

  /**
   * Extracts winery name from product name (wdm_NameEn).
   * Matches known wineries at the start of the name.
   * @param {string} nameEn - English product name
   * @returns {string} Winery name or empty
   */
  function _extractWineryFromName(nameEn) {
    if (!nameEn) return '';
    const name = nameEn.trim();

    // Check against known wineries (case-insensitive, longest match first)
    const sorted = KNOWN_WINERIES.slice().sort((a, b) => b.length - a.length);
    for (const winery of sorted) {
      if (name.toLowerCase().startsWith(winery.toLowerCase())) {
        return winery;
      }
    }

    return '';
  }

  /**
   * Builds a Set of bundle SKUs from WebProdM.
   * @returns {Set<string>} Set of SKUs where wpm_TaxProductType = 'woosb'
   */
  function _buildBundleSkuSet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    const webProdSheet = spreadsheet.getSheetByName(sheetNames.WebProdM || 'WebProdM');
    const bundleSkus = new Set();
    if (webProdSheet) {
      const data = webProdSheet.getDataRange().getValues();
      if (data.length > 1) {
        const headers = data[0];
        const idx = {};
        headers.forEach((h, i) => idx[h] = i);
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const sku = String(row[idx['wpm_SKU']] || '').trim();
          const productType = String(row[idx['wpm_TaxProductType']] || '').trim().toLowerCase();
          if (sku && productType === 'woosb') {
            bundleSkus.add(sku);
          }
        }
      }
    }
    LoggerService.info(SERVICE_NAME, '_buildBundleSkuSet', `Found ${bundleSkus.size} bundle SKUs`);
    return bundleSkus;
  }

  /**
   * Builds a SKU → product lookup from CmxProdM and WebDetM.
   * Uses wdm_NameEn for winery extraction.
   * @returns {Map<string, Object>} Map of SKU to product data
   */
  function _buildProductLookup() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    // Load WebDetM for English names, tasting attributes, grape codes, and kashrut codes
    const webDetSheet = spreadsheet.getSheetByName(sheetNames.WebDetM || 'WebDetM');
    const webDetLookup = new Map();
    if (webDetSheet) {
      const wdData = webDetSheet.getDataRange().getValues();
      if (wdData.length > 1) {
        const wdHeaders = wdData[0];
        const wdIdx = {};
        wdHeaders.forEach((h, i) => wdIdx[h] = i);
        for (let i = 1; i < wdData.length; i++) {
          const row = wdData[i];
          const sku = String(row[wdIdx['wdm_SKU']] || '').trim();
          if (sku) {
            webDetLookup.set(sku, {
              nameEn: row[wdIdx['wdm_NameEn']] || '',
              intensity: parseFloat(row[wdIdx['wdm_Intensity']]) || null,
              complexity: parseFloat(row[wdIdx['wdm_Complexity']]) || null,
              acidity: parseFloat(row[wdIdx['wdm_Acidity']]) || null,
              // Grape code (G1 is primary - used for preference)
              grapeG1: String(row[wdIdx['wdm_GrapeG1']] || '').trim(),
              // Kashrut code (K1 is primary - used for preference)
              kashrutK1: String(row[wdIdx['wdm_KashrutK1']] || '').trim()
            });
          }
        }
      }
    }

    // Load CmxProdM for category/division/price
    const cmxSheet = spreadsheet.getSheetByName(sheetNames.CmxProdM);
    if (!cmxSheet) {
      LoggerService.warn(SERVICE_NAME, '_buildProductLookup', 'CmxProdM sheet not found');
      return new Map();
    }

    const data = cmxSheet.getDataRange().getValues();
    if (data.length <= 1) return new Map();

    const headers = data[0];
    const idx = {};
    headers.forEach((h, i) => idx[h] = i);

    const lookup = new Map();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sku = String(row[idx['cpm_SKU']] || '').trim();
      if (!sku) continue;

      // Get English name from WebDetM for winery extraction
      const webDet = webDetLookup.get(sku) || {};
      const nameEn = webDet.nameEn || '';
      const winery = _extractWineryFromName(nameEn);

      lookup.set(sku, {
        sku: sku,
        nameEn: nameEn,
        nameHe: row[idx['cpm_NameHe']] || '',
        division: String(row[idx['cpm_Division']] || '').trim(),
        group: String(row[idx['cpm_Group']] || '').trim(),
        winery: winery,
        brand: String(row[idx['cpm_Brand']] || '').trim(),
        price: parseFloat(row[idx['cpm_Price']]) || 0,
        intensity: webDet.intensity || null,
        complexity: webDet.complexity || null,
        acidity: webDet.acidity || null,
        grapeG1: webDet.grapeG1 || '',
        kashrutK1: webDet.kashrutK1 || ''
      });
    }

    LoggerService.info(SERVICE_NAME, '_buildProductLookup', `Built lookup with ${lookup.size} products`);
    return lookup;
  }

  /**
   * Calculates a percentile value from a sorted array.
   * @param {Array<number>} sortedArr - Sorted array of numbers
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   */
  function _percentile(sortedArr, percentile) {
    if (sortedArr.length === 0) return 0;
    if (sortedArr.length === 1) return sortedArr[0];

    const index = (percentile / 100) * (sortedArr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sortedArr[lower];

    // Linear interpolation
    const weight = index - lower;
    return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
  }

  /**
   * Calculates price range using 10th-90th percentile to skip outliers.
   * @param {Array<number>} prices - Array of prices
   * @returns {Object} { min, max } or null if no prices
   */
  function _calculatePriceRange(prices) {
    if (!prices || prices.length === 0) return null;

    // Need at least 3 prices for percentile to make sense
    if (prices.length < 3) {
      return { min: Math.min(...prices), max: Math.max(...prices) };
    }

    const config = _getEnrichmentConfig();
    const sorted = [...prices].sort((a, b) => a - b);
    return {
      min: Math.round(_percentile(sorted, config.priceMinPercentile)),
      max: Math.round(_percentile(sorted, config.priceMaxPercentile))
    };
  }

  /**
   * Gets the primary category for a product based on Division/Group.
   * Translates Hebrew cpm_Group values to English.
   * @param {Object} product - Product with division and group fields
   * @returns {string} Primary category in English
   */
  function _getPrimaryCategory(product) {
    const div = product.division;
    const group = product.group;

    if (div === '1') {
      // Wine - translate Group from Hebrew to English
      return CATEGORY_TRANSLATION[group] || group || 'Wine';
    }
    if (div === '3') return 'Liqueur';
    if (div === '5') return 'Accessories';
    if (div === '9') return 'Gifts';
    return 'Other';
  }

  /**
   * Loads order data from a sheet and adds to orderEmailMap.
   * @param {Sheet} sheet - Order sheet
   * @param {Map} orderEmailMap - Map to populate
   */
  function _loadOrderSheet(sheet, orderEmailMap) {
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0];
    const idx = {};
    headers.forEach((h, i) => idx[h] = i);

    // Find column indices (support wom_, woma_, and other prefixes)
    const orderIdCol = idx['wom_OrderId'] ?? idx['woma_OrderId'] ?? idx['woa_OrderId'] ?? idx['OrderId'];
    const emailCol = idx['wom_BillingEmail'] ?? idx['woma_BillingEmail'] ?? idx['woa_BillingEmail'] ?? idx['BillingEmail'];
    const statusCol = idx['wom_Status'] ?? idx['woma_Status'] ?? idx['woa_Status'] ?? idx['Status'];

    if (orderIdCol === undefined || emailCol === undefined) return;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const orderId = String(row[orderIdCol] || '');
      const email = (row[emailCol] || '').toLowerCase().trim();
      const status = statusCol !== undefined ? String(row[statusCol] || '').toLowerCase() : '';

      if (['cancelled', 'refunded', 'failed'].includes(status)) continue;
      if (orderId && email) {
        orderEmailMap.set(orderId, email);
      }
    }
  }

  /**
   * Loads order items from a sheet and adds to itemsByEmail.
   * @param {Sheet} sheet - Order items sheet
   * @param {Map} orderEmailMap - Order → email lookup
   * @param {Map} itemsByEmail - Map to populate
   */
  function _loadItemsSheet(sheet, orderEmailMap, itemsByEmail) {
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0];
    const idx = {};
    headers.forEach((h, i) => idx[h] = i);

    // Find column indices (support woi_, woia_, and other prefixes)
    const orderIdCol = idx['woi_OrderId'] ?? idx['woia_OrderId'] ?? idx['OrderId'];
    const skuCol = idx['woi_SKU'] ?? idx['woia_SKU'] ?? idx['SKU'];
    const nameCol = idx['woi_Name'] ?? idx['woia_Name'] ?? idx['Name'];
    const qtyCol = idx['woi_Quantity'] ?? idx['woia_Quantity'] ?? idx['Quantity'];
    const priceCol = idx['woi_UnitPrice'] ?? idx['woia_UnitPrice'] ?? idx['UnitPrice'] ?? idx['woi_ItemTotal'] ?? idx['woia_ItemTotal'];
    const totalCol = idx['woi_ItemTotal'] ?? idx['woia_ItemTotal'] ?? idx['ItemTotal'];

    if (orderIdCol === undefined || skuCol === undefined) return;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const orderId = String(row[orderIdCol] || '');
      const email = orderEmailMap.get(orderId);
      if (!email) continue;

      const sku = String(row[skuCol] || '').trim();
      if (!sku) continue;

      if (!itemsByEmail.has(email)) {
        itemsByEmail.set(email, []);
      }

      const quantity = qtyCol !== undefined ? (parseInt(row[qtyCol], 10) || 1) : 1;
      const total = totalCol !== undefined ? (parseFloat(row[totalCol]) || 0) : 0;
      // Calculate unit price from total/quantity since WebOrdItemsM has ItemTotal not UnitPrice
      const unitPrice = quantity > 0 ? total / quantity : 0;

      itemsByEmail.get(email).push({
        orderId: orderId,
        sku: sku,
        name: nameCol !== undefined ? row[nameCol] || '' : '',
        quantity: quantity,
        unitPrice: unitPrice,
        total: total
      });
    }
  }

  /**
   * Builds order items grouped by billing email.
   * Reads from both current and archive sheets.
   * @returns {Map<string, Array>} Map of email to array of order items
   */
  function _buildItemsByEmail() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    const orderEmailMap = new Map();
    const itemsByEmail = new Map();

    // Load current order sheets
    const orderMasterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    const orderItemsSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);

    _loadOrderSheet(orderMasterSheet, orderEmailMap);
    _loadItemsSheet(orderItemsSheet, orderEmailMap, itemsByEmail);

    // Load archive sheets if they exist
    const archiveSheetNames = ['WebOrdM_Archive', 'WebOrdArchive', 'WebOrdA', 'Web Order Archive'];
    const archiveItemsNames = ['WebOrdItemsM_Archive', 'WebOrdItemsArchive', 'WebOrdItemsA', 'Web Order Items Archive'];

    for (const name of archiveSheetNames) {
      const archiveSheet = spreadsheet.getSheetByName(name);
      if (archiveSheet) {
        _loadOrderSheet(archiveSheet, orderEmailMap);
        LoggerService.info(SERVICE_NAME, '_buildItemsByEmail', `Loaded archive orders from ${name}`);
        break;
      }
    }

    for (const name of archiveItemsNames) {
      const archiveSheet = spreadsheet.getSheetByName(name);
      if (archiveSheet) {
        _loadItemsSheet(archiveSheet, orderEmailMap, itemsByEmail);
        LoggerService.info(SERVICE_NAME, '_buildItemsByEmail', `Loaded archive items from ${name}`);
        break;
      }
    }

    LoggerService.info(SERVICE_NAME, '_buildItemsByEmail', `Built items for ${itemsByEmail.size} contacts from ${orderEmailMap.size} orders`);
    return itemsByEmail;
  }

  /**
   * Calculates frequent categories from purchased items.
   * Returns categories that represent >15% of purchases, comma-separated.
   * Uses SysCategories lookup for Hebrew translations.
   * @param {Array} enrichedItems - Items with category field
   * @returns {Object} { en: string, he: string } - Comma-separated frequent categories
   */
  function _calculateFrequentCategories(enrichedItems) {
    const wineItems = enrichedItems.filter(i =>
      i.category && !['Liqueur', 'Accessories', 'Gifts', 'Other'].includes(i.category)
    );

    if (wineItems.length === 0) return { en: '', he: '' };

    const categoriesLookup = _loadCategoriesLookup();
    const counts = {};
    let total = 0;
    wineItems.forEach(item => {
      const cat = item.category;
      counts[cat] = (counts[cat] || 0) + item.quantity;
      total += item.quantity;
    });

    // Include categories with significant percentage of purchases
    const config = _getEnrichmentConfig();
    const threshold = total * (config.categoryMinPercent / 100);
    const significant = Object.keys(counts)
      .filter(cat => counts[cat] >= threshold)
      .sort((a, b) => counts[b] - counts[a]);

    // Translate categories
    const enNames = [];
    const heNames = [];
    significant.forEach(cat => {
      const lookup = categoriesLookup.get(cat.toLowerCase());
      if (lookup) {
        enNames.push(lookup.en);
        heNames.push(lookup.he);
      } else {
        // Try reverse lookup from CATEGORY_TRANSLATION_HE
        const heTranslation = CATEGORY_TRANSLATION_HE[cat];
        enNames.push(cat);
        heNames.push(heTranslation || cat);
      }
    });

    return {
      en: enNames.join(', '),
      he: heNames.join(', ')
    };
  }

  /**
   * Calculates the most common attribute range for wines.
   * Attributes are on 1-5 scale, returns range like "3-5" or "2-4".
   * @param {Array<number>} values - Attribute values (1-5)
   * @returns {string} Range string or empty
   */
  function _calculateAttributeRange(values) {
    if (!values || values.length < 2) return '';

    // Filter to valid 1-5 values and sort
    const valid = values
      .map(v => Math.round(v))
      .filter(v => v >= 1 && v <= 5)
      .sort((a, b) => a - b);

    if (valid.length === 0) return '';

    // For small samples, use raw min-max
    if (valid.length < 4) {
      const min = valid[0];
      const max = valid[valid.length - 1];
      return min === max ? String(min) : `${min}~${max}`;
    }

    // Use percentiles from config to trim outliers
    const config = _getEnrichmentConfig();
    const min = Math.round(_percentile(valid, config.attrMinPercentile));
    const max = Math.round(_percentile(valid, config.attrMaxPercentile));

    // Use ~ instead of hyphen to prevent Sheets interpreting as date
    return min === max ? String(min) : `${min}~${max}`;
  }

  /**
   * Resolves a grape code to names in both languages using LookupService.
   * @param {string} grapeCode - Grape code from WebDetM (e.g., "CS" for Cabernet Sauvignon)
   * @param {Map} grapeLookup - Pre-loaded grape lookup map
   * @returns {Object} { en: string, he: string } or null
   */
  function _resolveGrapeCode(grapeCode, grapeLookup) {
    if (!grapeCode || !grapeLookup) return null;
    const grapeRow = grapeLookup.get(grapeCode);
    if (grapeRow) {
      const en = grapeRow['slg_TextEN'] || '';
      const he = grapeRow['slg_TextHE'] || '';
      if (en || he) {
        return { en: en || he, he: he || en };
      }
    }
    return null;
  }

  /**
   * Gets the primary grape variety for a product using lookup codes.
   * @param {Object} product - Product with grapeG1 code field
   * @param {Map} grapeLookup - Pre-loaded grape lookup map
   * @returns {Object} { en: string, he: string } or null
   */
  function _getFirstGrape(product, grapeLookup) {
    return _resolveGrapeCode(product.grapeG1, grapeLookup);
  }

  /**
   * Resolves a kashrut code to names in both languages using LookupService.
   * @param {string} kashrutCode - Kashrut code from WebDetM
   * @param {Map} kashrutLookup - Pre-loaded kashrut lookup map
   * @returns {Object} { en: string, he: string } or null
   */
  function _resolveKashrutCode(kashrutCode, kashrutLookup) {
    if (!kashrutCode || !kashrutLookup) return null;
    const row = kashrutLookup.get(kashrutCode);
    if (row) {
      const en = row['slk_TextEN'] || '';
      const he = row['slk_TextHE'] || '';
      if (en || he) {
        return { en: en || he, he: he || en };
      }
    }
    return null;
  }

  /**
   * Calculates top kashrut certifications from K1 codes.
   * @param {Array} enrichedItems - Items with kashrutK1 field
   * @param {Map} kashrutLookup - Pre-loaded kashrut lookup map
   * @returns {Object} { en: string, he: string } - Comma-separated top 3 kashrut certifications
   */
  function _calculateTopKashrut(enrichedItems, kashrutLookup) {
    const wineItems = enrichedItems.filter(i =>
      i.category && !['Liqueur', 'Accessories', 'Gifts', 'Other'].includes(i.category)
    );

    if (wineItems.length === 0) return { en: '', he: '' };

    // Count by kashrut code to preserve order, store translations
    const counts = {};
    const translations = {};
    wineItems.forEach(item => {
      if (item.kashrutK1) {
        const resolved = _resolveKashrutCode(item.kashrutK1, kashrutLookup);
        if (resolved) {
          const key = item.kashrutK1;
          counts[key] = (counts[key] || 0) + item.quantity;
          translations[key] = resolved;
        }
      }
    });

    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
    return {
      en: sortedKeys.map(k => translations[k].en).join(', '),
      he: sortedKeys.map(k => translations[k].he).join(', ')
    };
  }

  /**
   * Calculates top wineries by purchase count.
   * Uses SysBrands lookup for Hebrew translations.
   * @param {Array} enrichedItems - Items with winery field
   * @param {number} limit - Number of wineries to return
   * @returns {Object} { en: string, he: string } - Comma-separated list of top wineries
   */
  function _calculateTopWineries(enrichedItems, limit = 3) {
    const wineItems = enrichedItems.filter(i =>
      i.winery && !['Liqueur', 'Accessories', 'Gifts', 'Other'].includes(i.category)
    );

    if (wineItems.length === 0) return { en: '', he: '' };

    const brandsLookup = _loadBrandsLookup();
    const counts = {};
    wineItems.forEach(item => {
      counts[item.winery] = (counts[item.winery] || 0) + item.quantity;
    });

    // Sort by count descending
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, limit);

    // Translate wineries using SysBrands lookup
    const enNames = [];
    const heNames = [];
    sorted.forEach(winery => {
      const brand = brandsLookup.get(winery.toLowerCase());
      if (brand) {
        enNames.push(brand.en);
        heNames.push(brand.he);
      } else {
        // No translation found, use original
        enNames.push(winery);
        heNames.push(winery);
      }
    });

    return {
      en: enNames.join(', '),
      he: heNames.join(', ')
    };
  }

  /**
   * Calculates top grapes by wine category.
   * Uses primary grape (G1) only - blend components are listed by volume,
   * so G2/G3 are minor components not indicative of preference.
   * @param {Array} enrichedItems - Items with grape (object with en/he) and category fields
   * @param {string} wineType - 'red' or 'white'
   * @returns {Object} { en: string, he: string } - Comma-separated top grapes
   */
  function _calculateTopGrapes(enrichedItems, wineType) {
    const redCategories = ['Dry Red'];
    const whiteCategories = ['Dry White'];
    const targetCategories = wineType === 'red' ? redCategories : whiteCategories;

    const wineItems = enrichedItems.filter(i => {
      const cat = (i.category || '').toLowerCase();
      return targetCategories.some(tc => cat.includes(tc.toLowerCase()));
    });

    if (wineItems.length === 0) return { en: '', he: '' };

    // Count by grape code to preserve order, store translations
    const counts = {};
    const translations = {};
    wineItems.forEach(item => {
      // Only use primary grape (G1) - blend components are not preferences
      if (item.grape && item.grapeCode) {
        const key = item.grapeCode;
        counts[key] = (counts[key] || 0) + item.quantity;
        translations[key] = item.grape;  // grape is now { en, he }
      }
    });

    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
    return {
      en: sortedKeys.map(k => translations[k].en).join(', '),
      he: sortedKeys.map(k => translations[k].he).join(', ')
    };
  }

  /**
   * Enriches all contacts with calculated preferences.
   * Uses new schema: FrequentCategories, attribute ranges, grapes.
   * @returns {Object} Results with counts
   */
  function enrichAllContacts() {
    const fnName = 'enrichAllContacts';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting preference enrichment');

    const productLookup = _buildProductLookup();
    const itemsByEmail = _buildItemsByEmail();
    const bundleSkus = _buildBundleSkuSet();

    // Load grape lookup for code resolution
    const grapeLookup = LookupService.getLookupMap('map.grape_lookups');
    LoggerService.info(SERVICE_NAME, fnName, `Loaded grape lookup with ${grapeLookup.size} entries`);

    // Load kashrut lookup for code resolution
    const kashrutLookup = LookupService.getLookupMap('map.kashrut_lookups');
    LoggerService.info(SERVICE_NAME, fnName, `Loaded kashrut lookup with ${kashrutLookup.size} entries`);

    // Preload brands and categories lookups
    _loadBrandsLookup();
    _loadCategoriesLookup();

    let enriched = 0;
    let skipped = 0;
    let errors = [];
    let processed = 0;
    const totalContacts = itemsByEmail.size;

    LoggerService.info(SERVICE_NAME, fnName, `Processing ${totalContacts} contacts with order history`);

    itemsByEmail.forEach((items, email) => {
      processed++;
      if (processed % 50 === 0 || processed === totalContacts) {
        LoggerService.info(SERVICE_NAME, fnName, `Progress: ${processed}/${totalContacts} (${enriched} enriched, ${skipped} skipped)`);
      }

      try {
        const contact = ContactService.getContactByEmail(email);
        if (!contact) {
          skipped++;
          return;
        }

        // Skip if already enriched and no new orders since
        const lastEnriched = contact.sc_LastEnriched ? new Date(contact.sc_LastEnriched) : null;
        const lastOrder = contact.sc_LastOrderDate ? new Date(contact.sc_LastOrderDate) : null;
        if (lastEnriched && lastOrder && lastOrder <= lastEnriched) {
          skipped++;
          return;
        }

        // Enrich items with product data
        const enrichedItems = items.map(item => {
          const product = productLookup.get(item.sku);
          if (product) {
            const grapeResolved = _getFirstGrape(product, grapeLookup);
            return {
              ...item,
              category: _getPrimaryCategory(product),
              winery: product.winery,
              grape: grapeResolved,  // { en, he } or null
              grapeCode: product.grapeG1,  // Keep code for grape calculation
              price: item.unitPrice || product.price,
              intensity: product.intensity,
              complexity: product.complexity,
              acidity: product.acidity,
              kashrutK1: product.kashrutK1
            };
          }
          return {
            ...item,
            category: '',
            winery: '',
            grape: null,
            grapeCode: '',
            price: item.unitPrice,
            intensity: null,
            complexity: null,
            acidity: null,
            kashrutK1: ''
          };
        });

        // Calculate preferences using new schema fields
        const frequentCategories = _calculateFrequentCategories(enrichedItems);
        const topWineries = _calculateTopWineries(enrichedItems);
        const topRedGrapes = _calculateTopGrapes(enrichedItems, 'red');
        const topWhiteGrapes = _calculateTopGrapes(enrichedItems, 'white');

        // Calculate price stats
        const wineWithPrices = enrichedItems.filter(i =>
          i.price > 0 && !['Liqueur', 'Accessories', 'Gifts', 'Other'].includes(i.category)
        );
        const prices = wineWithPrices.map(i => i.price);
        const priceRange = _calculatePriceRange(prices);
        const priceMin = priceRange ? priceRange.min : null;
        const priceMax = priceRange ? priceRange.max : null;
        const priceAvg = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

        // Calculate attribute ranges for red wines
        const redItems = enrichedItems.filter(i => {
          const cat = (i.category || '').toLowerCase();
          return cat.includes('dry red');
        });
        const redIntensities = redItems.filter(i => i.intensity).map(i => i.intensity);
        const redComplexities = redItems.filter(i => i.complexity).map(i => i.complexity);
        const redIntensityRange = _calculateAttributeRange(redIntensities);
        const redComplexityRange = _calculateAttributeRange(redComplexities);

        // Calculate attribute ranges for white wines
        const whiteItems = enrichedItems.filter(i => {
          const cat = (i.category || '').toLowerCase();
          return cat.includes('dry white');
        });
        const whiteComplexities = whiteItems.filter(i => i.complexity).map(i => i.complexity);
        const whiteAcidities = whiteItems.filter(i => i.acidity).map(i => i.acidity);
        const whiteComplexityRange = _calculateAttributeRange(whiteComplexities);
        const whiteAcidityRange = _calculateAttributeRange(whiteAcidities);

        // Update contact if any preferences calculated
        let updated = false;

        // Frequent Categories - _En and _He for consistency
        if (frequentCategories.en && contact.sc_FrequentCategories_En !== frequentCategories.en) {
          contact.sc_FrequentCategories_En = frequentCategories.en;
          updated = true;
        }
        if (frequentCategories.he && contact.sc_FrequentCategories_He !== frequentCategories.he) {
          contact.sc_FrequentCategories_He = frequentCategories.he;
          updated = true;
        }

        // Top Wineries - _En and _He
        if (topWineries.en && contact.sc_TopWineries_En !== topWineries.en) {
          contact.sc_TopWineries_En = topWineries.en;
          updated = true;
        }
        if (topWineries.he && contact.sc_TopWineries_He !== topWineries.he) {
          contact.sc_TopWineries_He = topWineries.he;
          updated = true;
        }

        // Top Grapes - _En and _He
        if (topRedGrapes.en && contact.sc_TopRedGrapes_En !== topRedGrapes.en) {
          contact.sc_TopRedGrapes_En = topRedGrapes.en;
          updated = true;
        }
        if (topRedGrapes.he && contact.sc_TopRedGrapes_He !== topRedGrapes.he) {
          contact.sc_TopRedGrapes_He = topRedGrapes.he;
          updated = true;
        }

        if (topWhiteGrapes.en && contact.sc_TopWhiteGrapes_En !== topWhiteGrapes.en) {
          contact.sc_TopWhiteGrapes_En = topWhiteGrapes.en;
          updated = true;
        }
        if (topWhiteGrapes.he && contact.sc_TopWhiteGrapes_He !== topWhiteGrapes.he) {
          contact.sc_TopWhiteGrapes_He = topWhiteGrapes.he;
          updated = true;
        }

        if (priceAvg !== null && contact.sc_PriceAvg !== priceAvg) {
          contact.sc_PriceAvg = priceAvg;
          updated = true;
        }

        if (priceMin !== null && contact.sc_PriceMin !== priceMin) {
          contact.sc_PriceMin = priceMin;
          updated = true;
        }

        if (priceMax !== null && contact.sc_PriceMax !== priceMax) {
          contact.sc_PriceMax = priceMax;
          updated = true;
        }

        // Attribute ranges (only update if we have data)
        if (redIntensityRange && contact.sc_RedIntensityRange !== redIntensityRange) {
          contact.sc_RedIntensityRange = redIntensityRange;
          updated = true;
        }

        if (redComplexityRange && contact.sc_RedComplexityRange !== redComplexityRange) {
          contact.sc_RedComplexityRange = redComplexityRange;
          updated = true;
        }

        if (whiteComplexityRange && contact.sc_WhiteComplexityRange !== whiteComplexityRange) {
          contact.sc_WhiteComplexityRange = whiteComplexityRange;
          updated = true;
        }

        if (whiteAcidityRange && contact.sc_WhiteAcidityRange !== whiteAcidityRange) {
          contact.sc_WhiteAcidityRange = whiteAcidityRange;
          updated = true;
        }

        // Calculate BundleBuyer - check if any purchased SKU is a bundle (wpm_TaxProductType = 'woosb')
        const hasBundles = items.some(i => bundleSkus.has(i.sku));
        if (hasBundles !== contact.sc_BundleBuyer) {
          contact.sc_BundleBuyer = hasBundles;
          updated = true;
        }

        // Calculate AvgBottlesPerOrder (wine items only, not accessories/gifts)
        // Count unique orders from items (not sc_OrderCount which may be from different data source)
        const wineItemsForBottles = enrichedItems.filter(i =>
          i.category && !['Liqueur', 'Accessories', 'Gifts', 'Other'].includes(i.category)
        );
        const totalBottles = wineItemsForBottles.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const uniqueOrderIds = new Set(items.map(i => i.orderId));
        const orderCountFromItems = uniqueOrderIds.size || 1;
        const avgBottles = orderCountFromItems > 0 ? Math.round(totalBottles / orderCountFromItems * 10) / 10 : 0;
        if (avgBottles > 0 && contact.sc_AvgBottlesPerOrder !== avgBottles) {
          contact.sc_AvgBottlesPerOrder = avgBottles;
          updated = true;
        }

        // Calculate KashrutPrefs - top 3 kashrut certifications from K1 codes
        const kashrutPrefs = _calculateTopKashrut(enrichedItems, kashrutLookup);
        if (kashrutPrefs.en && kashrutPrefs.en !== (contact.sc_KashrutPrefs_En || '')) {
          contact.sc_KashrutPrefs_En = kashrutPrefs.en;
          updated = true;
        }
        if (kashrutPrefs.he && kashrutPrefs.he !== (contact.sc_KashrutPrefs_He || '')) {
          contact.sc_KashrutPrefs_He = kashrutPrefs.he;
          updated = true;
        }

        // Always set LastEnriched when we process a contact (even if no changes)
        contact.sc_LastEnriched = new Date().toISOString();
        ContactService.upsertContact(contact, true);  // Skip cache clear for batch performance

        if (updated) {
          enriched++;
        } else {
          skipped++;
        }

      } catch (e) {
        errors.push(`${email}: ${e.message}`);
      }
    });

    // Clear cache once at end of batch
    ContactService.clearCache();

    LoggerService.info(SERVICE_NAME, fnName, `Enriched ${enriched}, skipped ${skipped}, errors ${errors.length}`);
    return { enriched, skipped, errors };
  }

  /**
   * Enriches a single contact with preferences.
   * Uses new schema: FrequentCategories, attribute ranges, grapes.
   * @param {string} email - Contact email
   * @returns {Object} Result
   */
  function enrichSingleContact(email) {
    const fnName = 'enrichSingleContact';

    const contact = ContactService.getContactByEmail(email);
    if (!contact) {
      return { error: 'Contact not found' };
    }

    const productLookup = _buildProductLookup();
    const itemsByEmail = _buildItemsByEmail();
    const bundleSkus = _buildBundleSkuSet();
    const items = itemsByEmail.get(email.toLowerCase().trim());

    if (!items || items.length === 0) {
      return { success: true, message: 'No order items found' };
    }

    // Load grape and kashrut lookups for code resolution
    const grapeLookup = LookupService.getLookupMap('map.grape_lookups');
    const kashrutLookup = LookupService.getLookupMap('map.kashrut_lookups');

    // Enrich items with product data
    const enrichedItems = items.map(item => {
      const product = productLookup.get(item.sku);
      if (product) {
        const grapeResolved = _getFirstGrape(product, grapeLookup);
        return {
          ...item,
          category: _getPrimaryCategory(product),
          winery: product.winery,
          grape: grapeResolved,  // { en, he } or null
          grapeCode: product.grapeG1,
          price: item.unitPrice || product.price,
          kashrutK1: product.kashrutK1
        };
      }
      return { ...item, category: '', winery: '', grape: null, grapeCode: '', price: item.unitPrice, kashrutK1: '' };
    });

    // Calculate BundleBuyer - check if any purchased SKU is a bundle
    contact.sc_BundleBuyer = items.some(i => bundleSkus.has(i.sku));

    // Calculate preferences with dual language support
    const frequentCategories = _calculateFrequentCategories(enrichedItems);
    contact.sc_FrequentCategories_En = frequentCategories.en;
    contact.sc_FrequentCategories_He = frequentCategories.he;

    const topWineries = _calculateTopWineries(enrichedItems);
    contact.sc_TopWineries_En = topWineries.en;
    contact.sc_TopWineries_He = topWineries.he;

    const topRedGrapes = _calculateTopGrapes(enrichedItems, 'red');
    contact.sc_TopRedGrapes_En = topRedGrapes.en;
    contact.sc_TopRedGrapes_He = topRedGrapes.he;

    const topWhiteGrapes = _calculateTopGrapes(enrichedItems, 'white');
    contact.sc_TopWhiteGrapes_En = topWhiteGrapes.en;
    contact.sc_TopWhiteGrapes_He = topWhiteGrapes.he;

    const kashrutPrefs = _calculateTopKashrut(enrichedItems, kashrutLookup);
    contact.sc_KashrutPrefs_En = kashrutPrefs.en;
    contact.sc_KashrutPrefs_He = kashrutPrefs.he;

    const wineWithPrices = enrichedItems.filter(i =>
      i.price > 0 && !['Liqueur', 'Accessories', 'Gifts', 'Other'].includes(i.category)
    );
    const prices = wineWithPrices.map(i => i.price);
    const priceRange = _calculatePriceRange(prices);
    if (priceRange) {
      contact.sc_PriceMin = priceRange.min;
      contact.sc_PriceMax = priceRange.max;
    }
    if (prices.length > 0) {
      contact.sc_PriceAvg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    }

    ContactService.upsertContact(contact);
    LoggerService.info(SERVICE_NAME, fnName, `Enriched contact ${email}`);

    return {
      success: true,
      preferences: {
        categories_en: contact.sc_FrequentCategories_En,
        categories_he: contact.sc_FrequentCategories_He,
        wineries_en: contact.sc_TopWineries_En,
        wineries_he: contact.sc_TopWineries_He,
        redGrapes_en: contact.sc_TopRedGrapes_En,
        redGrapes_he: contact.sc_TopRedGrapes_He,
        whiteGrapes_en: contact.sc_TopWhiteGrapes_En,
        whiteGrapes_he: contact.sc_TopWhiteGrapes_He,
        kashrut_en: contact.sc_KashrutPrefs_En,
        kashrut_he: contact.sc_KashrutPrefs_He,
        priceAvg: contact.sc_PriceAvg,
        priceRange: `${contact.sc_PriceMin}-${contact.sc_PriceMax}`
      }
    };
  }

  // Public API
  return {
    enrichAllContacts: enrichAllContacts,
    enrichSingleContact: enrichSingleContact
  };
})();

/**
 * Global function to run preference enrichment from Apps Script editor.
 */
function runContactEnrichment() {
  return ContactEnrichmentService.enrichAllContacts();
}
