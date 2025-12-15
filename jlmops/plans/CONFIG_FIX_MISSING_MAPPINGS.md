# Configuration Fix - Missing Web Products Mappings

**Date:** 2025-12-08
**Issue:** Web Products import failing with "CRITICAL: Mapping missing for wps_SKU"
**Status:** ✅ FIXED

---

## The Problem

**Error Message:**
```
Web Products (EN) import failed: CRITICAL: Mapping missing for wps_SKU
```

This error is **CORRECT** - our Phase 0A validation detected that the configuration was incomplete.

---

## Root Cause

The `map.staging_to_master.web_products` configuration in `config/mappings.json` was **missing 2 critical mappings**:

### Before Fix (INCOMPLETE)
```
map.staging_to_master.web_products:
✅ wps_Stock → wpm_Stock
✅ wps_RegularPrice → wpm_Price
✅ wps_Published → wpm_PublishStatusEn
❌ wps_SKU → wpm_SKU (MISSING!)
❌ wps_Name → wpm_NameEn (MISSING!)
```

### Why This Happened

The configuration was likely set up before the Phase 0A validation was added, which now requires all 4 critical mappings:
1. Stock
2. Price
3. SKU ← **Was missing**
4. Name ← **Was missing**

---

## The Fix

Added 2 missing mapping entries to `config/mappings.json`:

```json
[
    "map.staging_to_master.web_products",
    "Maps WebProdS_EN staging columns to WebProdM master columns.",
    "stable",
    "wps_SKU",
    "wpm_SKU",
    ...
],
[
    "map.staging_to_master.web_products",
    "Maps WebProdS_EN staging columns to WebProdM master columns.",
    "stable",
    "wps_Name",
    "wpm_NameEn",
    ...
]
```

### After Fix (COMPLETE)
```
map.staging_to_master.web_products:
✅ wps_Stock → wpm_Stock
✅ wps_RegularPrice → wpm_Price
✅ wps_Published → wpm_PublishStatusEn
✅ wps_SKU → wpm_SKU (ADDED!)
✅ wps_Name → wpm_NameEn (ADDED!)
```

---

## Deployment Steps

### 1. Update Configuration File

Upload the modified `config/mappings.json` to Google Apps Script.

### 2. Rebuild SysConfig

The configuration must be reloaded into the SysConfig sheet:

```javascript
// In Apps Script Editor
SetupConfig.rebuildSysConfigFromSource();
```

**This will:**
- Read all config JSON files
- Rebuild the SysConfig sheet
- Load new mappings into memory

### 3. Verify Configuration

```javascript
// Test that mappings are loaded
const mappings = ConfigService.getConfig('map.staging_to_master.web_products');
Logger.log(JSON.stringify(mappings, null, 2));

// Should show:
// {
//   "wps_Stock": "wpm_Stock",
//   "wps_RegularPrice": "wpm_Price",
//   "wps_Published": "wpm_PublishStatusEn",
//   "wps_SKU": "wpm_SKU",           ← NEW
//   "wps_Name": "wpm_NameEn"        ← NEW
// }
```

### 4. Test Import

Run a Web Products import:
- Should now pass validation ✅
- Should successfully update master ✅

---

## Why This Error is GOOD

**This is Phase 0A validation working correctly!**

**Before Phase 0A:**
- ❌ Missing mappings would be silently ignored
- ❌ SKU and Name fields wouldn't be updated
- ❌ Partial updates would create inconsistent data
- ❌ User wouldn't know until they noticed missing data

**After Phase 0A (Now):**
- ✅ Missing mappings detected immediately
- ✅ Import fails with clear error message
- ✅ Tells you EXACTLY what's missing ("wps_SKU")
- ✅ Prevents corrupt/incomplete data

---

## Validation Logic

The validation added in Phase 0A (ProductService.js lines 609-625):

```javascript
const criticalMappings = {
    'wps_Stock': 'wpm_Stock',
    'wps_RegularPrice': 'wpm_Price',
    'wps_SKU': 'wpm_SKU',
    'wps_Name': 'wpm_NameEn'
};

// Validate critical mappings are present
for (const [stagingField, expectedMasterField] of Object.entries(criticalMappings)) {
    if (!stagingToMasterMap[stagingField]) {
        throw new Error(`CRITICAL: Mapping missing for ${stagingField}`);
    }
    if (stagingToMasterMap[stagingField] !== expectedMasterField) {
        throw new Error(
            `CRITICAL: Mapping mismatch for ${stagingField}. ` +
            `Expected ${expectedMasterField}, got ${stagingToMasterMap[stagingField]}`
        );
    }
}
```

**This ensures:**
- All 4 critical fields have mappings
- Mappings point to correct master fields
- Configuration errors caught before data corruption

---

## Testing

### Test 1: Configuration Loaded
```javascript
const config = ConfigService.getConfig('map.staging_to_master.web_products');
console.log('SKU mapping:', config['wps_SKU']); // Should be: wpm_SKU
console.log('Name mapping:', config['wps_Name']); // Should be: wpm_NameEn
```

### Test 2: Import Succeeds
1. Place valid Web Products CSV in import folder
2. Run sync
3. Verify import completes without error
4. Check logs - should NOT see "CRITICAL: Mapping missing"

### Test 3: Data Updated
1. After successful import
2. Check WebProdM sheet
3. Verify SKU and Name columns updated
4. Compare to previous import (if SKU/Name were missing before)

---

## Related Files

- **config/mappings.json** - Fixed (added 2 mappings)
- **ProductService.js** - Validation code (lines 592-666)
- **ProductServiceTest.js** - Unit tests for this validation

---

## Lessons Learned

1. **Validation catches incomplete config** - Phase 0A working as intended
2. **Critical mappings must be complete** - SKU and Name are required
3. **Clear error messages help debugging** - Immediately knew what was missing
4. **Configuration changes need rebuild** - Must run `rebuildSysConfigFromSource()`

---

## Summary

**Issue:** Missing mappings for wps_SKU and wps_Name
**Cause:** Configuration incomplete, caught by new validation
**Fix:** Added 2 mapping entries to mappings.json
**Action Required:** Rebuild SysConfig, test import

**Files Modified:**
- config/mappings.json (added 2 mapping entries)

**Next Steps:**
1. Upload modified mappings.json
2. Run SetupConfig.rebuildSysConfigFromSource()
3. Test Web Products import
4. Verify SKU and Name fields update correctly

---

**Fixed By:** Claude (Anthropic)
**Date:** 2025-12-08
**Related:** Phase 0A Mapping Validation
