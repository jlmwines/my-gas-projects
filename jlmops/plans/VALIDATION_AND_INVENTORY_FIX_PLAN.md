# Validation Rules & Manager Inventory View — Fix Plan

**Created:** 2026-03-09
**Status:** Fixes 1-6 implemented (c1af348). Fix 7 (skip redundant tasks) and Fix 8 (woosb_ids JSON) planned.

## Problem Summary

### A. Validation rules fire too broadly

Two rules create noisy tasks for products where no action is needed:

1. **"Published But Archived"** (`validation.master.published_vs_archived`) — flags web-published products whose Comax match is archived. But if the archived product has zero stock, that's expected — nothing to act on.

2. **"Archive Status Changed"** (`validation.comax.is_archived_mismatch`) — flags any Comax product where archive status changed between staging and master. But this only matters for web-published products. Non-web products archiving is routine and irrelevant.

### B. Manager inventory view — two bugs

From inbox (2026-03-06):

1. **Create count task fails.** Root cause: `task.inventory.count` has no definition in `taskDefinitions.json`. `TaskService.createTask()` calls `ConfigService.getConfig('task.inventory.count')` → gets null → throws `"Task type configuration for 'task.inventory.count' not found."` The task type is referenced by `InventoryManagementService.generateBulkCountTasks()` and `createSpotCheckTask()` but was never defined.

2. **Open inventory tasks don't show SKU and product name in list.** Root cause: `task.inventory.count` is not in the `managerTaskTypes` array in `WebAppDashboardV2.js` (line 729-739), so count tasks never appear in the manager's task list. The data is there (`st_LinkedEntityId` = SKU, `st_LinkedEntityName` = product name) but the tasks are filtered out before reaching the UI.

---

## Fix Plan

### Fix 1: Add `source_filter` to "Archive Status Changed"

**File:** `config/validation.json`
**Rule:** `validation.comax.is_archived_mismatch` (line ~357)

Add `"source_filter", "cpm_IsWeb,כן"` — only check products marked as web products.

**Before:**
```
"compare_fields", "cpm_IsArchived,cps_IsArchived",
"on_failure_task_type", ...
```

**After:**
```
"compare_fields", "cpm_IsArchived,cps_IsArchived",
"source_filter", "cpm_IsWeb,כן",
"on_failure_task_type", ...
```

No code changes. Config only.

### Fix 2: Add `target_filter` support + apply to "Published But Archived"

**Problem:** The rule needs to skip rows where `cpm_Stock = 0` on the CmxProdM (target/sheet_B) side. The validation engine only supports `source_filter` (sheet_A), not `target_filter` (sheet_B).

**Step 2a — Add `target_filter` to ValidationLogic.js**

**File:** `ValidationLogic.js`, function `_executeFieldComparison` (line ~118)

After the existing `source_filter` block (lines 136-141), add a parallel `target_filter` block:

```javascript
// Target Filter Logic
if (rule.target_filter) {
    const [filterKey, filterValue] = rule.target_filter.split(',');
    if (rowB.hasOwnProperty(filterKey) && String(rowB[filterKey]) !== String(filterValue)) {
        continue;
    }
}
```

This mirrors `source_filter` exactly but checks sheet_B rows.

**Step 2b — Update validation.json**

**File:** `config/validation.json`
**Rule:** `validation.master.published_vs_archived` (line ~616)

The current `source_filter` is `wpm_PostStatus,publish` (only check published products). This stays.

Add: `"target_filter", "cpm_IsWeb,כן"` — skip products not on web. This replaces the stock check idea because:
- If a product is archived in Comax AND not marked as web (`cpm_IsWeb ≠ כן`), it's already been pulled from the site — no action needed.
- If it IS on web and archived, that's the real problem regardless of stock level.

Wait — re-reading the user's requirement: "if inventory is zero, that is not a problem." So the filter should be on stock, not IsWeb. The `source_filter` already ensures we only look at published web products. The missing filter is: skip when `cpm_Stock = 0`.

But `target_filter` with a simple equality check (`cpm_Stock,0`) would only match exact string "0". Stock could be empty string, 0, or "0". Let me check...

Actually, the existing `source_filter` uses `String(rowA[filterKey]) !== String(filterValue)` — so `String(0) !== String("0")` → `"0" !== "0"` → false. That works. Empty string would be `"" !== "0"` → true → would continue (skip). That's also correct — empty stock should not be flagged.

**But wait:** we want to SKIP when stock IS zero, meaning we want to EXCLUDE `cpm_Stock = 0`. The filter logic is "continue if value does NOT match filter." So `target_filter = "cpm_Stock,0"` means: skip rows where stock ≠ 0, only process rows where stock = 0. That's backwards.

We need an inverted filter: only flag when stock > 0, i.e., skip when stock = 0.

Options:
- Add `target_filter_exclude` (skip rows that MATCH the filter value)
- Add negation syntax like `target_filter: "cpm_Stock,!0"`

Simplest: support `!` prefix on filter value to invert.

**Revised Step 2a — support `!` prefix for exclusion:**

```javascript
// Target Filter Logic
if (rule.target_filter) {
    const [filterKey, rawFilterValue] = rule.target_filter.split(',');
    const invert = rawFilterValue.startsWith('!');
    const filterValue = invert ? rawFilterValue.substring(1) : rawFilterValue;
    const matches = String(rowB[filterKey] || '') === String(filterValue);
    if (invert ? matches : !matches) {
        continue;
    }
}
```

Also apply the same `!` support to `source_filter` for consistency (but don't change existing behavior — `!` prefix is opt-in).

**Revised Step 2b — validation.json:**

```
"target_filter", "cpm_Stock,!0",
```

Meaning: exclude (skip) rows where `cpm_Stock` equals `0`. Only flag when stock > 0.

**Edge case:** What about `cpm_Stock = ""` (empty)? `String("") === String("0")` → false → invert=true, matches=false → `!false` → true → continue. Wait, that skips empty stock too. Is that right? Empty stock = unknown, probably shouldn't flag. Yes, this is correct — only flag when stock is a positive number.

### Fix 3: Add `task.inventory.count` to taskDefinitions.json

**File:** `config/taskDefinitions.json`

Add new task template:

```json
[
    "task.template",
    "task.inventory.count",
    "Task to verify physical count of a product's inventory.",
    "stable",
    "topic", "Inventory",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "manager_direct",
    "due_pattern", "one_week"
]
```

Uses `manager_direct` flow (like `task.inventory.brurya_update`) since the manager does the counting.

### Fix 4: Add `task.inventory.count` to manager task list

**File:** `WebAppDashboardV2.js`, line ~729

Add `'task.inventory.count'` to the `managerTaskTypes` array under the Inventory section:

```javascript
// Inventory
'task.inventory.brurya_update',
'task.inventory.count',                    // ← ADD
'task.validation.comax_internal_audit',    // Negative inventory counts
```

This makes count tasks appear in the manager dashboard task list, showing SKU (entityId) and product name (entityName) — which are already set by `createSpotCheckTask` and `generateBulkCountTasks`.

### Fix 5: Admin Inventory — Open Tasks card details

**File:** `AdminInventoryView.html`, `WebAppInventory.js`

The "Open Inventory Tasks (Manager Queue)" card only showed Date and Task Title. Added SKU, Product Name, and On Hand (total physical count) columns — matching the detail level of the review table above it.

- **Backend** (`WebAppInventory.js`): Enriched open task mapping to include `sku`, `productName` (with CmxProdM fallback), and `totalQty` (Brurya + Storage + Office + Shop) from SysProductAudit.
- **Frontend** (`AdminInventoryView.html`): Added SKU (centered), Product Name (right-aligned), On Hand (centered) columns.

### Fix 6: Auto-refresh bundle composition before health check

**File:** `HousekeepingService.js`

Bundle health check was using stale SysBundleSlots data — bundle composition only updated on manual "Re-import from WooCommerce" button click. Added `refreshBundleComposition` step in Phase 3 of `performDailyMaintenance`, immediately before `checkBundleHealth`. Calls `WebAppBundles_reimportAllBundles()` to refresh SysBundles + SysBundleSlots from current WebProdM data (already updated during sync).

---

## Deployment Sequence

1. Edit config files: `validation.json`, `taskDefinitions.json`
2. Edit code: `ValidationLogic.js`, `WebAppDashboardV2.js`, `WebAppInventory.js`, `AdminInventoryView.html`, `HousekeepingService.js`
3. Run `node jlmops/generate-config.js`
4. User: `clasp push` → `rebuildSysConfigFromSource()`
5. Test: create a spot check task from Admin Inventory view → confirm it appears in Manager dashboard with SKU and product name
6. Verify open tasks card shows SKU, product name, on-hand count
7. Run housekeeping or wait for next daily run to verify bundle composition refresh

## Files Modified

| File | Change |
|------|--------|
| `config/validation.json` | Add `source_filter` to archive mismatch rule; add `target_filter` to published-vs-archived rule |
| `config/taskDefinitions.json` | Add `task.inventory.count` definition |
| `ValidationLogic.js` | Add `target_filter` support to `_executeFieldComparison`; add `!` prefix support to both filters |
| `WebAppDashboardV2.js` | Add `task.inventory.count` to `managerTaskTypes` |
| `WebAppInventory.js` | Enrich open tasks with SKU, product name, total on-hand qty |
| `AdminInventoryView.html` | Add SKU, Product Name, On Hand columns to open tasks table |
| `HousekeepingService.js` | Add `refreshBundleComposition` step before `checkBundleHealth` |
| `SetupConfig.js` | Regenerated (via generate-config.js) |

### Fix 7: Skip redundant name/archive tasks when vintage task exists

**Problem:** Three validation rules in `comax_staging` detect changes that may indicate a vintage update:
- `validation.comax.vintage_mismatch` → creates `task.validation.vintage_mismatch` (direct detection)
- `validation.comax.name_mismatch` → creates `task.validation.name_mismatch` (indirect signal — name often changes with vintage)
- `validation.comax.is_archived_mismatch` → creates `task.validation.field_mismatch` (indirect signal — old vintage archived)

When vintage changes, all three fire for the same SKU. The name and archive tasks are noise — the vintage task already covers the required action. Currently there's no cross-type dedup: `TaskService.createTask` only deduplicates within the same task type + entity.

**Solution:** Config-driven `skip_if_open_task_type` property on validation rules. If a rule has this property, the orchestrator checks whether an open task of that type already exists for the same entity before creating a new task. If it does, skip silently.

**Why config-driven:** Follows the existing pattern of validation behavior being controlled by `validation.json` properties. Hardcoding the relationship in code would be fragile and invisible.

**Execution order matters:** Vintage rule is at line 89 in `validation.json`, name at 303, archive at 357. Rules process in order, so vintage tasks are created before name/archive tasks are evaluated. This is already correct.

**Step 7a — Pre-load open tasks in `ValidationOrchestratorService.processValidationResults`**

Before iterating results, scan all rules for `skip_if_open_task_type` values. Collect unique task type IDs. Load open tasks for those types once via `WebAppTasks.getOpenTasksByTypeId()`. Build a Set of `taskType:entityId` keys for O(1) lookup.

```javascript
// At top of processValidationResults, before the forEach
const skipTaskTypes = new Set();
analysisResult.results.forEach(result => {
    if (result.rule && result.rule.skip_if_open_task_type) {
        skipTaskTypes.add(result.rule.skip_if_open_task_type);
    }
});

// Pre-load open tasks for skip check (also include tasks created earlier in this same run)
const skipEntityKeys = new Set();
skipTaskTypes.forEach(taskType => {
    const openTasks = WebAppTasks.getOpenTasksByTypeId(taskType);
    openTasks.forEach(t => {
        const entityId = String(t.st_LinkedEntityId || '').trim();
        if (entityId) skipEntityKeys.add(taskType + ':' + entityId);
    });
});
```

**Step 7b — Check before creating in `_createIndividualTask`**

Pass `skipEntityKeys` set to `_createIndividualTask`. Before calling `TaskService.createTask`, check:

```javascript
if (rule.skip_if_open_task_type) {
    const skipKey = rule.skip_if_open_task_type + ':' + entityId;
    if (skipEntityKeys.has(skipKey)) {
        return; // Skip — higher-priority task already exists
    }
}
```

**Step 7c — Track tasks created during this validation run**

When a task IS created (e.g., vintage task), add its `taskType:entityId` to `skipEntityKeys` so that subsequent rules in the same run also benefit. This handles the case where the vintage task didn't exist before this run but was just created moments ago.

```javascript
// After TaskService.createTask succeeds in _createIndividualTask:
if (skipEntityKeys) {
    skipEntityKeys.add(rule.on_failure_task_type + ':' + entityId);
}
```

**Step 7d — Config changes in `validation.json`**

Add to `validation.comax.name_mismatch` (line ~303):
```
"skip_if_open_task_type", "task.validation.vintage_mismatch",
```

Add to `validation.comax.is_archived_mismatch` (line ~357):
```
"skip_if_open_task_type", "task.validation.vintage_mismatch",
```

The web name mismatch rule (`validation.web.name_mismatch`, line ~141) is a different suite context (web vs comax). Leave it as-is unless user says otherwise.

**Files modified:**
- `config/validation.json` — add `skip_if_open_task_type` to 2 rules
- `ValidationOrchestratorService.js` — pre-load skip tasks, check before creating, track new tasks
- `SetupConfig.js` — regenerated

### Fix 8: woosb_ids stored as GAS object string instead of JSON

**Problem:** `WooProductPullService._getMetaValue()` returns `woosb_ids` meta as a native object when the WooCommerce API sends it that way (common for Hebrew translations). GAS serializes objects to `{key=value}` format when writing to sheets. `BundleService._parseWoosbJson` then fails to `JSON.parse()` this format.

**Fix:** At all 3 points where `woosb_ids` is captured in `WooProductPullService.js`, check `typeof` — if object, `JSON.stringify()` before storing.

**Already implemented** (not yet pushed). Three locations fixed:
- Line 169: EN product pull
- Line 204: HE translation extraction
- Line 416: Full translation metadata pull

**Files modified:**
- `WooProductPullService.js` — stringify object-type woosb_ids at 3 capture points

**Note:** Existing stale data in WebXltM will be corrected on next Woo API pull. The `_parseWoosbJson` fallback (warn + return empty) means bundles still function — they just miss Hebrew text slots until refreshed.

---

## Risk

Low. Validation filter changes reduce false positives — no new tasks created, fewer noisy ones. Task definition addition is purely additive. Dashboard filter is a one-line array addition. Bundle composition refresh reuses existing reimport logic. Open tasks card is display-only, no data writes. Skip-if-open-task is additive — worst case it doesn't skip and behavior is unchanged. woosb_ids fix is defensive stringify — no behavior change for values already stored as strings.
