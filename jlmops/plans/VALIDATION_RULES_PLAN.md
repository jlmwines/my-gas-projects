# Validation Rules Plan

This document defines the validation rules for JLMops data integrity checks.

---

## Validation Architecture

### Sync Sequence

The daily sync follows a specific sequence. Validations run at each import step and at the end.

```
1A. Import Web Products      → run web_staging
1B. Import Web Translations  → run web_xlt_staging (if new file exists)
    [WebProdM and WebXltM now current]

2.  Import Web Orders        → run order_staging
    [Order data and stock levels updated]

3.  Export orders to Comax   → (no validation - export step)

4A. Import Comax Products    → run comax_staging
    [CmxProdM now current]

4B. Cross-System Validation  → run master_master
    [Both Web and Comax masters fresh - ideal for consistency check]

5.  Export inventory to web  → (no validation - export step)
```

**Validation Suites:**

| Suite | Triggered By | Purpose |
|-------|--------------|---------|
| `web_staging` | Sync step 1A | Validate before WebProdM upsert |
| `web_xlt_staging` | Sync step 1B | Validate before WebXltM upsert |
| `order_staging` | Sync step 2 | Validate before WebOrdM upsert |
| `comax_staging` | Sync step 4A | Validate before CmxProdM upsert |
| `master_master` | Sync step 4B + Housekeeping | Cross-system consistency |

### Housekeeping Sequence

Overnight housekeeping runs validations and tests after cleanup, before service updates.

```
Phase 1: Cleanup
  - cleanOldLogs()
  - archiveCompletedTasks()
  - manageFileLifecycle()
  - cleanupImportFiles()

Phase 2: Validation & Testing
  - Run master_master validation suite (cross-system consistency on master data)
  - Run unit tests via TestRunner.runAllTests()
  - Update task.system.health_status with results

Phase 3: Service Data Updates
  - checkBundleHealth()
  - checkCategoryMinimums()
  - checkBruryaReminder()
```

Note: Staging validation suites only run during their respective import steps (not in housekeeping) since staging data is temporary and only exists during active imports.

### Two Types of Cross-System Checks

| Type | When | Purpose | Example |
|------|------|---------|---------|
| **Staging vs Other Master** | During import (steps 1A, 4A) | Prevent introducing violations | WebProdS_EN.SKU must exist in CmxProdM |
| **Master vs Master** | Sync step 4B + Housekeeping | Detect inconsistencies | WebProdM.SKU must exist in CmxProdM |

**Key insight:** Staging vs Other Master rules catch violations BEFORE commit. Master vs Master runs twice: at end of sync (immediate feedback) and in housekeeping (overnight verification).

---

## Engine Capabilities (Verified)

**Supported operators in `evaluateCondition`:**
- `<`, `>`, `=`, `<>`
- `IS_NOT_EMPTY`
- `IS_EMPTY` - **NOT YET SUPPORTED** (must add)

**Compound conditions:**
- `AND` supported for INTERNAL_AUDIT test type only
- `OR` NOT supported
- FIELD_COMPARISON / EXISTENCE_CHECK: single `source_filter` only

**Implication:** Rules requiring compound conditions must be split into separate rules.

---

## Code Change Required

**File:** `ValidationLogic.js` line 18

**Add IS_EMPTY operator:**
```javascript
case 'IS_EMPTY': return String(val1 || '').trim() === '';
case 'IS_NOT_EMPTY': return String(val1 || '').trim() !== '';
```

---

## Data Model Notes (Verified from schemas.json)

**Comax (CmxProdM / CmxProdS):**
- `cpm_CmxId` / `cps_CmxId` - Permanent ID
- `cpm_SKU` / `cps_SKU` - Mutable, key for matching with WooCommerce
- `cpm_Division` / `cps_Division` - Product division
- `cpm_Group` / `cps_Group` - Product group
- `cpm_IsActive` - Date field (unarchive date), NOT relevant for validation
- `cpm_IsArchived` / `cps_IsArchived` - null = active, any date = archived
- `cpm_IsWeb` / `cps_IsWeb` - "כן" = sold online

**Web Products (WebProdM / WebProdS_EN):**
- `wpm_ID` / `wps_ID` - Permanent ID
- `wpm_SKU` / `wps_SKU` - Mutable
- `wpm_PostStatus` / `wps_PostStatus` - "publish", "draft", etc.
- `wpm_PostTitle` / `wps_PostTitle` - Product name

**Translations (WebXltM / WebXltS) - NOTE: prefix is `wxm_` / `wxs_`:**
- `wxm_ID` / `wxs_ID` - Hebrew product ID (primary key)
- `wxm_WpmlOriginalId` / `wxs_WpmlOriginalId` - Links to English product ID

**Orders (WebOrdS):**
- `wos_OrderId` - Order ID
- `wos_OrderNumber` - Order number

---

## Validation Categories

### A. Staging vs Same Master (Import Integrity)

Purpose: Detect import file issues by comparing staging to its own master.

### B. Staging vs Other Master (Cross-System Prevention)

Purpose: Prevent violations by checking staging against other system masters before upsert.

### C. Master vs Master (Cross-System Detection)

Purpose: Periodic verification that master sheets remain consistent.

### D. Business Rules (Data Quality)

Purpose: Catch problematic data states.

---

## Rules to Keep (with updated titles/notes)

### A. Staging vs Same Master

| rule_id | suite | title | notes |
|---------|-------|-------|-------|
| validation.comax.row_count_decrease | comax_staging | Comax Row Count Drop | master ${sourceRowCount} import ${targetRowCount} |
| validation.comax.master_missing_from_staging | comax_staging | Missing From Comax Import | CmxId ${cpm_CmxId} |
| validation.comax.vintage_mismatch | comax_staging | Vintage Update | master ${cpm_Vintage} staging ${cps_Vintage} |
| validation.comax.name_mismatch | comax_staging | Comax Name Changed | master ${cpm_NameHe} staging ${cps_NameHe} |
| validation.comax.is_web_mismatch | comax_staging | IsWeb Changed | master ${cpm_IsWeb} staging ${cps_IsWeb} |
| validation.comax.schema_mismatch | comax_staging | Comax Schema Mismatch | columns changed |
| validation.web.row_count_decrease | web_staging | Web Row Count Drop | master ${sourceRowCount} import ${targetRowCount} |
| validation.web.master_missing_from_staging | web_staging | Missing From Web Import | ID ${wpm_ID} |
| validation.web.new_product_in_staging | web_staging | Unexpected Web Product | ID ${wps_ID} not in master |
| validation.web.sku_mismatch | web_staging | Web SKU Changed | master ${wpm_SKU} staging ${wps_SKU} |
| validation.web.name_mismatch | web_staging | Web Name Changed | master ${wdm_NameEn} staging ${wps_PostTitle} |
| validation.web.schema_mismatch | web_staging | Web Schema Mismatch | columns changed |
| validation.web_translations.row_count_decrease | web_xlt_staging | Translations Row Count Drop | master ${sourceRowCount} import ${targetRowCount} |
| validation.web_translations.schema_mismatch | web_xlt_staging | Translations Schema Mismatch | columns changed |
| validation.orders.schema_mismatch | order_staging | Orders Schema Mismatch | columns changed |

### B. Master vs Master (Periodic Verification)

| rule_id | suite | title | notes |
|---------|-------|-------|-------|
| validation.master.web_sku_missing_comax | master_master | No Comax Match | SKU ${wpm_SKU} |
| validation.master.comax_sku_missing_web | master_master | Not In Web Store | SKU ${cpm_SKU} IsWeb ${cpm_IsWeb} |
| validation.master.web_name_missing_details | master_master | Missing Details Record | ID ${wpm_ID} |
| validation.master.web_details_name_missing_master | master_master | Orphaned Details | ID ${wdm_WebIdEn} |
| validation.master.published_status_mismatch | master_master | Web/Comax Status Mismatch | web ${wpm_PostStatus} comax ${cpm_IsWeb} |
| validation.audit.row_count_mismatch | master_master | Audit Row Count Mismatch | CmxProdM ${sourceRowCount} Audit ${targetRowCount} |

### C. Business Rules

| rule_id | suite | title | notes |
|---------|-------|-------|-------|
| validation.comax.negative_stock | comax_staging | Negative Stock | ${cps_Stock} |
| validation.comax.archived_stock | master_master | Archived With Stock | stock ${cpm_Stock} |

---

## Rules to Enable

| rule_id | current_status | action |
|---------|----------------|--------|
| validation.comax.is_archived_mismatch | DISABLED | ENABLE - Archive status change is significant |

Updated title/notes:

| rule_id | suite | title | notes |
|---------|-------|-------|-------|
| validation.comax.is_archived_mismatch | comax_staging | Archive Status Changed | master ${cpm_IsArchived} staging ${cps_IsArchived} |

---

## Rules to Fix

| rule_id | issue | fix |
|---------|-------|-----|
| validation.comax.master_missing_from_staging | Filter uses `cpm_IsActive,1` which checks a date field | Remove filter entirely - check all master CmxIds |

---

## Rules to Delete

| rule_id | reason |
|---------|--------|
| validation.comax.is_active_mismatch | cpm_IsActive is a date field, not meaningful for validation |
| validation.web_translations.row_count_mismatch | Duplicate of validation.web_translations.row_count_decrease |

---

## Rules to Create

### Staging vs Same Master (New)

**1. Comax Division Change**
```
rule_id: validation.comax.division_mismatch
suite: comax_staging
description: [Comax Import] Field: Division changed
test_type: FIELD_COMPARISON
sheet_A: CmxProdM
sheet_B: CmxProdS
key_A: cpm_CmxId
key_B: cps_CmxId
compare_fields: cpm_Division,cps_Division
task_type: task.validation.field_mismatch
title: Division Changed
notes: master ${cpm_Division} staging ${cps_Division}
```

**2. Comax Group Change**
```
rule_id: validation.comax.group_mismatch
suite: comax_staging
description: [Comax Import] Field: Group changed
test_type: FIELD_COMPARISON
sheet_A: CmxProdM
sheet_B: CmxProdS
key_A: cpm_CmxId
key_B: cps_CmxId
compare_fields: cpm_Group,cps_Group
task_type: task.validation.field_mismatch
title: Group Changed
notes: master ${cpm_Group} staging ${cps_Group}
```

**3. Web Publish Status Change**
```
rule_id: validation.web.publish_status_mismatch
suite: web_staging
description: [Web Import] Field: Publish status changed
test_type: FIELD_COMPARISON
sheet_A: WebProdM
sheet_B: WebProdS_EN
key_A: wpm_ID
key_B: wps_ID
compare_fields: wpm_PostStatus,wps_PostStatus
task_type: task.validation.status_mismatch
title: Web Publish Status Changed
notes: master ${wpm_PostStatus} staging ${wps_PostStatus}
```

**4. Translations ID Existence**
```
rule_id: validation.web_translations.master_missing_from_staging
suite: web_xlt_staging
description: [Translations Import] Existence: Master translation missing from import
test_type: EXISTENCE_CHECK
source_sheet: WebXltM
source_key: wxm_ID
target_sheet: WebXltS
target_key: wxs_ID
invert_result: TRUE
task_type: task.validation.webxlt_data_integrity
title: Missing From Translations Import
notes: HeID ${wxm_ID} EnID ${wxm_WpmlOriginalId}
```

**5. Orders Required Fields - OrderId**
```
rule_id: validation.orders.missing_order_id
suite: order_staging
description: [Orders Import] Data: Order ID is empty
test_type: INTERNAL_AUDIT
source_sheet: WebOrdS
source_key: wos_OrderNumber
condition: wos_OrderId,IS_EMPTY
task_type: task.validation.order_staging_failure
title: Order Missing ID
notes: OrderNumber ${wos_OrderNumber}
```

**6. Orders Required Fields - OrderNumber**
```
rule_id: validation.orders.missing_order_number
suite: order_staging
description: [Orders Import] Data: Order number is empty
test_type: INTERNAL_AUDIT
source_sheet: WebOrdS
source_key: wos_OrderId
condition: wos_OrderNumber,IS_EMPTY
task_type: task.validation.order_staging_failure
title: Order Missing Number
notes: OrderId ${wos_OrderId}
```

### Staging vs Other Master (Cross-System Prevention - New)

**7. Web Staging SKU Not In Comax Master**
```
rule_id: validation.web.staging_sku_not_in_comax
suite: web_staging
description: [Web Import] Existence: Staging product SKU not found in Comax master
test_type: EXISTENCE_CHECK
source_sheet: WebProdS_EN
source_key: wps_SKU
source_filter: wps_TaxProductType,simple
target_sheet: CmxProdM
target_key: cpm_SKU
invert_result: TRUE
task_type: task.validation.sku_not_in_comax
title: No Comax Match (Staging)
notes: SKU ${wps_SKU}
```

Purpose: Blocks web import if staging product doesn't exist in Comax. Excludes bundles.

**8. Comax Staging Online Product Not In Web Master**
```
rule_id: validation.comax.staging_isweb_not_in_webmaster
suite: comax_staging
description: [Comax Import] Existence: Staging online product not found in Web master
test_type: EXISTENCE_CHECK
source_sheet: CmxProdS
source_key: cps_SKU
source_filter: cps_IsWeb,כן
target_sheet: WebProdM
target_key: wpm_SKU
invert_result: TRUE
task_type: task.validation.comax_not_web_product
title: Not In Web Store (Staging)
notes: SKU ${cps_SKU}
```

Purpose: Alerts if Comax import marks product for web but product doesn't exist in WebProdM.

### Master vs Master (Periodic Verification - New)

**9. Web EN → HE Translation**
```
rule_id: validation.master.web_missing_translation
suite: master_master
description: [Master Sync] Existence: Web product has no Hebrew translation
test_type: EXISTENCE_CHECK
source_sheet: WebProdM
source_key: wpm_ID
target_sheet: WebXltM
target_key: wxm_WpmlOriginalId
invert_result: TRUE
task_type: task.validation.translation_missing
title: Missing Translation
notes: ID ${wpm_ID}
```

**10. Published vs Comax Archived**
```
rule_id: validation.master.published_vs_archived
suite: master_master
description: [Master Sync] Field: Published web product has archived Comax match
test_type: FIELD_COMPARISON
sheet_A: WebProdM
sheet_B: CmxProdM
key_A: wpm_SKU
key_B: cpm_SKU
source_filter: wpm_PostStatus,publish
compare_fields: wpm_PostStatus,cpm_IsArchived
field_translations_map_wpm_PostStatus: {"publish":""}
task_type: task.validation.status_mismatch
title: Published But Archived
notes: comax archived ${cpm_IsArchived}
```

Logic: For published web products, "publish" translates to "". If cpm_IsArchived is empty, it matches (PASS). If cpm_IsArchived has a date, it doesn't match (FAIL). This workaround is confirmed working.

---

## Implementation Phases

### Phase 0: Code Changes

**ValidationLogic.js:**
1. Add `IS_EMPTY` operator to `evaluateCondition`

**Sync Flow (ProductImportService or SyncService):**
1. Add `master_master` validation call after Comax import (step 4B)
2. Ensure sync sequence follows: 1A → 1B → 2 → 3 → 4A → 4B → 5

**HousekeepingService.js:**
1. Restructure `performDailyMaintenance()` into three phases:
   - Phase 1: Cleanup (existing functions)
   - Phase 2: Validation & Testing (new)
   - Phase 3: Service Data Updates (move bundle/reminder checks here)
2. Add master_master validation suite run
3. Add unit test run via `TestRunner.runAllTests()`
4. Update `task.system.health_status` with results

### Phase 1: Update Existing Rules
1. Update all title/notes per this plan in `validation.json`
2. Remove broken filter from `validation.comax.master_missing_from_staging`
3. Enable `validation.comax.is_archived_mismatch`
4. Delete `validation.comax.is_active_mismatch`
5. Delete `validation.web_translations.row_count_mismatch`
6. Run `node jlmops/generate-config.js`

### Phase 2: Create New Rules
1. Create staging vs same master rules (1-6)
2. Create staging vs other master rules (7-8)
3. Create master vs master rules (9-10)
4. Run `node jlmops/generate-config.js`

### Phase 3: Deploy & Verify
1. `clasp push`
2. Run `rebuildSysConfigFromSource()` in Apps Script
3. Run sync manually, verify step 4B executes master_master
4. Run housekeeping manually, verify three-phase sequence
5. Verify tasks created with correct titles/notes
6. Verify linked entity ID/name populated correctly

---

## Validation Rules Summary

**Total after changes:** 32 rules

| Category | Suite | Count |
|----------|-------|-------|
| Comax Staging vs Master | comax_staging | 10 |
| Web Staging vs Master | web_staging | 7 |
| Translations Staging vs Master | web_xlt_staging | 3 |
| Orders Staging | order_staging | 3 |
| Master vs Master (Periodic) | master_master | 9 |

---

## Open Questions

1. **Bundle exclusion:** Should other cross-system rules exclude bundle products? Currently `validation.web.staging_sku_not_in_comax` and `validation.master.web_sku_missing_comax` filter for simple products.

---

## Code Changes Summary

| File | Change |
|------|--------|
| `ValidationLogic.js` | Add `IS_EMPTY` operator |
| `ProductImportService.js` or `SyncService.js` | Add step 4B (master_master after Comax import) |
| `HousekeepingService.js` | Restructure into 3 phases: Cleanup → Validation/Tests → Service Updates |
| `HousekeepingService.js` | Run master_master suite, TestRunner.runAllTests(), update health task |
| `TaskService.js` | Add upsertSingletonTask() for system health updates (see PROJECT_TASK_PLAN Part 7) |

---

Plan Version: 4.1
Created: 2025-12-17
Updated: 2025-12-17
Status: Ready for Implementation
