# Validation Rules & Manager Inventory View — Fix Plan

**Created:** 2026-03-09
**Status:** Draft

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

---

## Deployment Sequence

1. Edit config files: `validation.json`, `taskDefinitions.json`
2. Edit code: `ValidationLogic.js`, `WebAppDashboardV2.js`
3. Run `node jlmops/generate-config.js`
4. User: `clasp push` → `rebuildSysConfigFromSource()`
5. Test: create a spot check task from Admin Inventory view → confirm it appears in Manager dashboard with SKU and product name

## Files Modified

| File | Change |
|------|--------|
| `config/validation.json` | Add `source_filter` to archive mismatch rule; add `target_filter` to published-vs-archived rule |
| `config/taskDefinitions.json` | Add `task.inventory.count` definition |
| `ValidationLogic.js` | Add `target_filter` support to `_executeFieldComparison`; add `!` prefix support to both filters |
| `WebAppDashboardV2.js` | Add `task.inventory.count` to `managerTaskTypes` |
| `SetupConfig.js` | Regenerated (via generate-config.js) |

## Risk

Low. Validation filter changes reduce false positives — no new tasks created, fewer noisy ones. Task definition addition is purely additive. Dashboard filter is a one-line array addition.
