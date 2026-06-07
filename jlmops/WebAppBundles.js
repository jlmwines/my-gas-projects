/**
 * @file WebAppBundles.js
 * @description Controller functions for the Admin Bundles View.
 * Handles bundle management UI interactions.
 */

// =================================================================================
// DASHBOARD DATA
// =================================================================================

/**
 * Gets bundle statistics and summary for the dashboard widget.
 * @returns {Object} Bundle stats with counts and health status
 */
function WebAppBundles_getStats() {
  try {
    // includeInventory=false: skip the heavy low-inventory pass on the view mount.
    // The attention counter is filled by the lazy health fetch (loadHealthAlerts).
    const stats = BundleService.getBundleStats(false);
    return {
      error: null,
      data: stats
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getStats', `Error getting bundle stats: ${e.message}`, e);
    return {
      error: `Error getting bundle stats: ${e.message}`,
      data: null
    };
  }
}

/**
 * Gets all bundles for the dashboard list.
 * @returns {Object} List of bundles with basic info
 */
function WebAppBundles_getAllBundles() {
  try {
    const bundles = BundleService.getAllBundles();
    return {
      error: null,
      data: bundles
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getAllBundles', `Error getting bundles: ${e.message}`, e);
    return {
      error: `Error getting bundles: ${e.message}`,
      data: null
    };
  }
}

/**
 * Consolidates the 4 view-mount fetches that AdminBundlesView.init() previously
 * fired as 4 separate google.script.run calls into one round-trip. Each of the 4
 * getters returns an {error, data} envelope; this unwraps .data (falling back to
 * empty array/object). Frontend dispatches the result via applyInitData(). [T3.3]
 * @param {string} [sessionId] Optional, for traceability.
 * @returns {{success: boolean, data?: object, error?: string}}
 */
function WebAppBundles_getViewData(sessionId) {
  try {
    return {
      success: true,
      data: {
        categories:   WebAppBundles_getCategories().data || [],
        stats:        WebAppBundles_getStats().data || {},
        bundles:      WebAppBundles_getAllBundles().data || []
        // healthAlerts intentionally omitted (Stage 1 Fix B): the low-inventory compute is the
        // slow part of the mount. The frontend's loadHealthAlerts(undefined) fallback lazy-fetches
        // it async after mount, so the view opens immediately. (Fix A keeps that async call fast.)
      }
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getViewData', e.message, e);
    return { success: false, error: e.message };
  }
}

// =================================================================================
// BUNDLE EDITOR
// =================================================================================

/**
 * Gets a single bundle with all its slots for editing.
 * Includes descriptions from WebProdM and Hebrew translations from WebXltM.
 * @param {string} bundleId - The bundle ID to load
 * @returns {Object} Bundle with slots array and descriptions
 */
function WebAppBundles_getBundleWithSlots(bundleId) {
  try {
    const bundle = BundleService.getBundleWithSlots(bundleId);
    if (!bundle) {
      return {
        error: `Bundle not found: ${bundleId}`,
        data: null
      };
    }

    // Load descriptions from WebProdM
    const allConfig = ConfigService.getAllConfig();
    const spreadsheet = SheetAccessor.getDataSpreadsheet();
    const webSheet = spreadsheet.getSheetByName('WebProdM');

    if (webSheet) {
      const schema = allConfig['schema.data.WebProdM'];
      const headers = schema.headers.split(',');
      const data = webSheet.getDataRange().getValues();

      const idIdx = headers.indexOf('wpm_ID');
      const excerptIdx = headers.indexOf('wpm_PostExcerpt');
      const contentIdx = headers.indexOf('wpm_PostContent');

      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][idIdx] || '').trim();
        if (rowId === bundleId) {
          bundle.shortDescEn = String(data[i][excerptIdx] || '').trim();
          bundle.longDescEn = String(data[i][contentIdx] || '').trim();
          break;
        }
      }
    }

    // Load Hebrew descriptions from WebXltM via wxm_WpmlOriginalId
    const xltSheet = spreadsheet.getSheetByName('WebXltM');
    if (xltSheet) {
      const xltSchema = allConfig['schema.data.WebXltM'];
      const xltHeaders = xltSchema.headers.split(',');
      const xltData = xltSheet.getDataRange().getValues();

      const origIdIdx = xltHeaders.indexOf('wxm_WpmlOriginalId');
      const xltExcerptIdx = xltHeaders.indexOf('wxm_PostExcerpt');
      const xltContentIdx = xltHeaders.indexOf('wxm_PostContent');

      for (let i = 1; i < xltData.length; i++) {
        const origId = String(xltData[i][origIdIdx] || '').trim();
        if (origId === bundleId) {
          bundle.shortDescHe = String(xltData[i][xltExcerptIdx] || '').trim();
          bundle.longDescHe = String(xltData[i][xltContentIdx] || '').trim();
          break;
        }
      }
    }

    // Load product names and prices for product slots (for preview)
    if (bundle.slots && bundle.slots.length > 0 && webSheet) {
      const schema = allConfig['schema.data.WebProdM'];
      const headers = schema.headers.split(',');
      const data = webSheet.getDataRange().getValues();

      const skuIdx = headers.indexOf('wpm_SKU');
      const nameIdx = headers.indexOf('wpm_PostTitle');
      const priceIdx = headers.indexOf('wpm_RegularPrice');

      // Build SKU lookup map
      const productMap = {};
      for (let i = 1; i < data.length; i++) {
        const sku = String(data[i][skuIdx] || '').trim();
        if (sku) {
          productMap[sku] = {
            name: String(data[i][nameIdx] || '').trim(),
            price: priceIdx !== -1 ? Number(data[i][priceIdx]) || 0 : 0
          };
        }
      }

      // Enrich slots with product data
      bundle.slots.forEach(slot => {
        if (slot.slotType === 'Product' && slot.activeSKU) {
          const product = productMap[slot.activeSKU];
          if (product) {
            slot.productName = product.name;
            slot.productPrice = product.price;
          }
        }
      });
    }

    return {
      error: null,
      data: bundle
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getBundleWithSlots', `Error getting bundle ${bundleId}: ${e.message}`, e);
    return {
      error: `Error getting bundle: ${e.message}`,
      data: null
    };
  }
}

/**
 * Updates bundle header information.
 * @param {string} bundleId - Bundle ID to update
 * @param {Object} updates - Fields to update {nameEn, nameHe, type, status, discountPrice}
 * @returns {Object} Updated bundle
 */
function WebAppBundles_updateBundle(bundleId, updates) {
  try {
    const bundle = BundleService.updateBundle(bundleId, updates);
    if (!bundle) {
      return {
        error: `Bundle not found: ${bundleId}`,
        data: null
      };
    }
    return {
      error: null,
      data: bundle
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'updateBundle', `Error updating bundle ${bundleId}: ${e.message}`, e);
    return {
      error: `Error updating bundle: ${e.message}`,
      data: null
    };
  }
}

/**
 * Creates a new bundle.
 * @param {Object} bundleData - Bundle data {bundleId, nameEn, nameHe, type, status}
 * @returns {Object} Created bundle
 */
function WebAppBundles_createBundle(bundleData) {
  try {
    const bundle = BundleService.createBundle(bundleData);
    return {
      error: null,
      data: bundle
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'createBundle', `Error creating bundle: ${e.message}`, e);
    return {
      error: `Error creating bundle: ${e.message}`,
      data: null
    };
  }
}

/**
 * Deletes a bundle and all its slots.
 * @param {string} bundleId - Bundle ID to delete
 * @returns {Object} Success status
 */
function WebAppBundles_deleteBundle(bundleId) {
  try {
    const success = BundleService.deleteBundle(bundleId);
    return {
      error: success ? null : `Failed to delete bundle: ${bundleId}`,
      data: { success: success }
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'deleteBundle', `Error deleting bundle ${bundleId}: ${e.message}`, e);
    return {
      error: `Error deleting bundle: ${e.message}`,
      data: null
    };
  }
}

/**
 * Duplicates a bundle to create a variation.
 * @param {string} sourceBundleId - Bundle to duplicate
 * @param {string} newBundleId - ID for the new bundle
 * @param {Object} overrides - Optional field overrides {nameEn, nameHe}
 * @returns {Object} New bundle with slots
 */
function WebAppBundles_duplicateBundle(sourceBundleId, newBundleId, overrides) {
  try {
    const bundle = BundleService.duplicateBundle(sourceBundleId, newBundleId, overrides || {});
    if (!bundle) {
      return {
        error: `Failed to duplicate bundle: ${sourceBundleId}`,
        data: null
      };
    }
    return {
      error: null,
      data: bundle
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'duplicateBundle', `Error duplicating bundle: ${e.message}`, e);
    return {
      error: `Error duplicating bundle: ${e.message}`,
      data: null
    };
  }
}

// =================================================================================
// SLOT MANAGEMENT
// =================================================================================

/**
 * Creates a new slot in a bundle.
 * @param {Object} slotData - Slot data {bundleId, slotType, order, ...}
 * @returns {Object} Created slot
 */
function WebAppBundles_createSlot(slotData) {
  try {
    const slot = BundleService.createSlot(slotData);
    return {
      error: null,
      data: slot
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'createSlot', `Error creating slot: ${e.message}`, e);
    return {
      error: `Error creating slot: ${e.message}`,
      data: null
    };
  }
}

/**
 * Updates a slot.
 * @param {string} slotId - Slot ID to update
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated slot
 */
function WebAppBundles_updateSlot(slotId, updates) {
  try {
    const slot = BundleService.updateSlot(slotId, updates);
    if (!slot) {
      return {
        error: `Slot not found: ${slotId}`,
        data: null
      };
    }
    return {
      error: null,
      data: slot
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'updateSlot', `Error updating slot ${slotId}: ${e.message}`, e);
    return {
      error: `Error updating slot: ${e.message}`,
      data: null
    };
  }
}

/**
 * Deletes a slot.
 * @param {string} slotId - Slot ID to delete
 * @returns {Object} Success status
 */
function WebAppBundles_deleteSlot(slotId) {
  try {
    const success = BundleService.deleteSlot(slotId);
    return {
      error: success ? null : `Failed to delete slot: ${slotId}`,
      data: { success: success }
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'deleteSlot', `Error deleting slot ${slotId}: ${e.message}`, e);
    return {
      error: `Error deleting slot: ${e.message}`,
      data: null
    };
  }
}

// =================================================================================
// PRODUCT ASSIGNMENT
// =================================================================================

/**
 * Gets eligible products for a slot based on its criteria.
 * @param {string} slotId - Slot ID
 * @param {Object} options - Options like {limit: 10, excludeExclusiveSKUs: true}
 * @returns {Object} List of eligible products with stock info
 */
function WebAppBundles_getEligibleProducts(slotId, options) {
  try {
    const products = BundleService.getEligibleProducts(slotId, options || {});
    return {
      error: null,
      data: products
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getEligibleProducts', `Error getting eligible products for ${slotId}: ${e.message}`, e);
    return {
      error: `Error getting eligible products: ${e.message}`,
      data: null
    };
  }
}

/**
 * Assigns a product to a slot, updating history.
 * @param {string} slotId - Slot ID
 * @param {string} sku - SKU to assign
 * @param {string} reason - Reason for change
 * @returns {Object} Updated slot
 */
function WebAppBundles_assignProductToSlot(slotId, sku, reason) {
  try {
    const slot = BundleService.assignProductToSlot(slotId, sku, reason || 'Manual');
    if (!slot) {
      return {
        error: `Failed to assign product to slot: ${slotId}`,
        data: null
      };
    }
    return {
      error: null,
      data: slot
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'assignProductToSlot', `Error assigning product: ${e.message}`, e);
    return {
      error: `Error assigning product: ${e.message}`,
      data: null
    };
  }
}

// =================================================================================
// HEALTH MONITORING
// =================================================================================

/**
 * Gets bundles with low inventory slots, including replacement suggestions.
 * @param {number} threshold - Stock threshold (uses config default if not provided)
 * @returns {Object} List of bundles with low stock slots and suggestions
 */
function WebAppBundles_getBundlesWithLowInventory(threshold) {
  try {
    // Pass threshold as-is; BundleService will use config default if undefined
    const results = BundleService.getBundlesWithLowInventory(threshold);
    return {
      error: null,
      data: results
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getBundlesWithLowInventory', `Error getting low inventory bundles: ${e.message}`, e);
    return {
      error: `Error getting low inventory bundles: ${e.message}`,
      data: null
    };
  }
}

/**
 * Applies bulk replacement suggestions for low stock slots.
 * @param {Array<Object>} replacements - Array of {slotId, sku, reason}
 * @returns {Object} Results with success/failure counts
 */
function WebAppBundles_applyReplacements(replacements) {
  try {
    let successCount = 0;
    let failCount = 0;
    const results = [];

    replacements.forEach(r => {
      try {
        const slot = BundleService.assignProductToSlot(r.slotId, r.sku, r.reason || 'Low Stock Replacement');
        if (slot) {
          successCount++;
          results.push({ slotId: r.slotId, success: true });
        } else {
          failCount++;
          results.push({ slotId: r.slotId, success: false, error: 'Assignment failed' });
        }
      } catch (e) {
        failCount++;
        results.push({ slotId: r.slotId, success: false, error: e.message });
      }
    });

    return {
      error: null,
      data: {
        successCount: successCount,
        failCount: failCount,
        results: results
      }
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'applyReplacements', `Error applying replacements: ${e.message}`, e);
    return {
      error: `Error applying replacements: ${e.message}`,
      data: null
    };
  }
}

// =================================================================================
// IMPORT
// =================================================================================

/**
 * Imports a bundle from WooCommerce data.
 * @param {string} bundleId - WooCommerce product ID
 * @param {string} woosbIdsJson - JSON string from woosb_ids field
 * @param {Object} bundleInfo - Additional info {nameEn, nameHe, type}
 * @returns {Object} Imported bundle with slots
 */
function WebAppBundles_importFromWooCommerce(bundleId, woosbIdsJson, bundleInfo) {
  try {
    const bundle = BundleService.importBundleFromWooCommerce(bundleId, woosbIdsJson, bundleInfo || {});
    if (!bundle) {
      return {
        error: `Failed to import bundle: ${bundleId}`,
        data: null
      };
    }
    return {
      error: null,
      data: bundle
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'importFromWooCommerce', `Error importing bundle: ${e.message}`, e);
    return {
      error: `Error importing bundle: ${e.message}`,
      data: null
    };
  }
}

/**
 * Re-imports all bundles from current web product data.
 * Scans WebProdM for woosb type products and imports/updates their bundle structure.
 * @returns {Object} Import results
 */
function WebAppBundles_reimportAllBundles() {
  const serviceName = 'WebAppBundles';
  const functionName = 'reimportAllBundles';

  try {
    LoggerService.info(serviceName, functionName, 'Starting full bundle reimport from WebProdM...');

    const allConfig = ConfigService.getAllConfig();
    const spreadsheet = SheetAccessor.getDataSpreadsheet();
    const webProdMSheet = spreadsheet.getSheetByName('WebProdM');

    if (!webProdMSheet) {
      throw new Error('WebProdM sheet not found');
    }

    const webProdMSchema = allConfig['schema.data.WebProdM'];
    const headers = webProdMSchema.headers.split(',');
    const data = webProdMSheet.getDataRange().getValues();

    const typeIdx = headers.indexOf('wpm_TaxProductType');
    const woosbIdsIdx = headers.indexOf('wpm_WoosbIds');
    const idIdx = headers.indexOf('wpm_ID');
    const titleIdx = headers.indexOf('wpm_PostTitle');
    const statusIdx = headers.indexOf('wpm_PostStatus');

    if (typeIdx === -1 || woosbIdsIdx === -1) {
      throw new Error('Bundle columns (wpm_TaxProductType, wpm_WoosbIds) not found in WebProdM schema');
    }

    // Load WebXltM to get Hebrew names and woosb_ids
    const webXltMSheet = spreadsheet.getSheetByName('WebXltM');
    const hebrewNameMap = {};
    const hebrewWoosbIdsMap = {};
    if (webXltMSheet) {
      const xltSchema = allConfig['schema.data.WebXltM'];
      const xltHeaders = xltSchema.headers.split(',');
      const xltData = webXltMSheet.getDataRange().getValues();
      const xltOrigIdIdx = xltHeaders.indexOf('wxm_WpmlOriginalId');
      const xltTitleIdx = xltHeaders.indexOf('wxm_PostTitle');
      const xltWoosbIdsIdx = xltHeaders.indexOf('wxm_WoosbIds');

      for (let i = 1; i < xltData.length; i++) {
        const origId = String(xltData[i][xltOrigIdIdx] || '').trim();
        const heTitle = String(xltData[i][xltTitleIdx] || '').trim();
        const heWoosbIds = String(xltData[i][xltWoosbIdsIdx] || '').trim();
        if (origId) {
          if (heTitle) hebrewNameMap[origId] = heTitle;
          if (heWoosbIds) hebrewWoosbIdsMap[origId] = heWoosbIds;
        }
      }
      LoggerService.info(serviceName, functionName, `Loaded ${Object.keys(hebrewNameMap).length} Hebrew translations, ${Object.keys(hebrewWoosbIdsMap).length} Hebrew woosb_ids`);
    }

    // Collect bundle metadata for batch reimport (one sheet-write pass instead
    // of per-bundle row ops). Pre-batch implementation called
    // BundleService.importBundleFromWooCommerce per bundle which did its own
    // deleteRow + appendRow per slot — 14 bundles × ~12 slot ops × ~150ms each
    // ≈ 25-40s of sheet overhead. Batch path completes in ~2-3s.
    let skipped = 0;
    const bundlesToImport = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const productType = String(row[typeIdx] || '').toLowerCase().trim();
      if (productType !== 'woosb' && productType !== 'bundle') continue;

      const bundleId = String(row[idIdx] || '').trim();
      if (!bundleId) {
        skipped++;
        continue;
      }

      const woosbIds = String(row[woosbIdsIdx] || '').trim();
      const nameEn = String(row[titleIdx] || '').trim();
      const postStatus = String(row[statusIdx] || '').toLowerCase().trim();
      const nameHe = hebrewNameMap[bundleId] || '';
      const woosbIdsHe = hebrewWoosbIdsMap[bundleId] || '';
      const bundleStatus = (postStatus === 'publish' || postStatus === '1') ? 'Active' : 'Draft';

      bundlesToImport.push({
        bundleId: bundleId,
        nameEn: nameEn,
        nameHe: nameHe,
        type: 'Bundle',
        status: bundleStatus,
        woosbIds: woosbIds,
        woosbIdsHe: woosbIdsHe
      });
    }

    const batchResult = BundleService.reimportAllBundlesBatch(bundlesToImport);

    LoggerService.info(serviceName, functionName,
      `Bundle reimport complete. Imported: ${batchResult.imported}, Failed: ${batchResult.failed}, Skipped: ${skipped}, Slots: ${batchResult.slotCount}`);

    return {
      error: null,
      data: {
        imported: batchResult.imported,
        failed: batchResult.failed,
        skipped: skipped,
        slotCount: batchResult.slotCount
      }
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Error reimporting bundles: ${e.message}`, e);
    return {
      error: `Error reimporting bundles: ${e.message}`,
      data: null
    };
  }
}

// =================================================================================
// LOOKUP DATA
// =================================================================================

/**
 * Gets web categories from SysLkp_Texts lookup table.
 * Filters by slt_Code = 'WebCat' and returns slt_TextEN values.
 * @returns {Object} List of category names (English) in original order
 */
function WebAppBundles_getCategories() {
  try {
    const lkpSheet = SheetAccessor.getDataSheet('SysLkp_Texts', false);

    if (!lkpSheet) {
      return { error: 'SysLkp_Texts sheet not found', data: null };
    }

    const data = lkpSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { error: 'No data in SysLkp_Texts', data: null };
    }

    // Find column indices from header row
    const headers = data[0];
    const codeIdx = headers.indexOf('slt_Code');
    const textEnIdx = headers.indexOf('slt_TextEN');

    if (codeIdx === -1 || textEnIdx === -1) {
      return { error: 'Required columns not found in SysLkp_Texts', data: null };
    }

    // Filter for WebCat entries, preserve order
    const categories = [];
    for (let i = 1; i < data.length; i++) {
      const code = String(data[i][codeIdx] || '').trim();
      if (code === 'WebCat') {
        const textEn = String(data[i][textEnIdx] || '').trim();
        if (textEn) {
          categories.push(textEn);
        }
      }
    }

    return {
      error: null,
      data: categories
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getCategories', `Error getting categories: ${e.message}`, e);
    return {
      error: `Error getting categories: ${e.message}`,
      data: null
    };
  }
}

/**
 * Gets a product name by SKU for display in the slot editor.
 * Looks up the product in WebProdM and returns its English title.
 * @param {string} sku - The product SKU
 * @returns {Object} Product name or error
 */
/**
 * Gets product name and price for a given SKU.
 * @param {string} sku - Product SKU
 * @returns {Object} { error, data: { name, price } }
 */
function WebAppBundles_getProductName(sku) {
  try {
    if (!sku) {
      return { error: 'No SKU provided', data: null };
    }

    const allConfig = ConfigService.getAllConfig();
    const webSheet = SheetAccessor.getDataSheet('WebProdM', false);

    if (!webSheet) {
      return { error: 'WebProdM sheet not found', data: null };
    }

    const schema = allConfig['schema.data.WebProdM'];
    const headers = schema.headers.split(',');
    const data = webSheet.getDataRange().getValues();

    const skuIdx = headers.indexOf('wpm_SKU');
    const nameIdx = headers.indexOf('wpm_PostTitle');
    const priceIdx = headers.indexOf('wpm_RegularPrice');

    if (skuIdx === -1) {
      return { error: 'SKU column not found in schema', data: null };
    }

    for (let i = 1; i < data.length; i++) {
      const rowSku = String(data[i][skuIdx] || '').trim();
      if (rowSku === sku) {
        const name = String(data[i][nameIdx] || '').trim();
        const price = priceIdx !== -1 ? Number(data[i][priceIdx]) || 0 : 0;
        return {
          error: null,
          data: {
            name: name || sku,
            price: price
          }
        };
      }
    }

    return { error: null, data: null };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getProductName', `Error looking up product ${sku}: ${e.message}`, e);
    return {
      error: `Error looking up product: ${e.message}`,
      data: null
    };
  }
}

// =================================================================================
// BUNDLE MANAGEMENT CARD — TOP-LEVEL ACTIONS
// =================================================================================

/**
 * Update Composition button: re-derives SysBundles + SysBundleSlots from
 * current WebProdM + WebXltM data. Does NOT pull from WooCommerce — premise
 * is "sync just ran, WebProdM is fresh, but housekeeping bundle refresh
 * didn't run". If WebProdM is stale, run the daily sync first.
 * @returns {Object} { error, data: { reimport } }
 */
function WebAppBundles_updateComposition() {
  const serviceName = 'WebAppBundles';
  const functionName = 'updateComposition';
  try {
    LoggerService.info(serviceName, functionName, 'Update Composition: re-derive bundles from WebProdM (no WC pull)');

    const reimportResult = WebAppBundles_reimportAllBundles();
    return {
      error: null,
      data: {
        reimport: reimportResult
      }
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Update Composition failed: ${e.message}`, e);
    return { error: `Update Composition failed: ${e.message}`, data: null };
  }
}

/**
 * Review Stock button: runs checkBundleHealth on demand.
 * @returns {Object} { error, data }
 */
function WebAppBundles_reviewStock() {
  const serviceName = 'WebAppBundles';
  const functionName = 'reviewStock';
  try {
    LoggerService.info(serviceName, functionName, 'On-demand bundle stock review');
    const result = housekeepingService.checkBundleHealth();
    return { error: null, data: result };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Review Stock failed: ${e.message}`, e);
    return { error: `Review Stock failed: ${e.message}`, data: null };
  }
}

/**
 * Validate EN/HE Parity button: walks every bundle and reports composition drift.
 * @returns {Object} { error, data: { totalBundles, bundlesWithIssues, bundles } }
 */
function WebAppBundles_validateParity() {
  const serviceName = 'WebAppBundles';
  const functionName = 'validateParity';
  try {
    LoggerService.info(serviceName, functionName, 'EN/HE bundle parity validation');
    return BundleService.validateAllBundleParity();
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Validate Parity failed: ${e.message}`, e);
    return { error: `Validate Parity failed: ${e.message}`, data: null };
  }
}

/**
 * Export button: worklist of bundles whose ops composition differs from web (EN or HE),
 * each serialized to woosb_ids JSON for paste into WPClever (BUNDLE_PLAN Stage 3).
 * @returns {Object} { error, data: { rows, total, exportCount } }
 */
function WebAppBundles_buildExportTable() {
  const serviceName = 'WebAppBundles';
  const functionName = 'buildExportTable';
  try {
    LoggerService.info(serviceName, functionName, 'Building bundle export worklist (ops != web)');
    return { error: null, data: BundleService.buildExportTable() };
  } catch (e) {
    LoggerService.error(serviceName, functionName, `Export build failed: ${e.message}`, e);
    return { error: `Export build failed: ${e.message}`, data: null };
  }
}
