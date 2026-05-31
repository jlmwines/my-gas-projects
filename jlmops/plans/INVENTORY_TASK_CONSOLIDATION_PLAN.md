# Inventory Task Consolidation Plan

**Created:** 2026-04-17
**Status:** Planning

## Background

The validation-triggered count tasks (`task.validation.comax_internal_audit`) and inventory count tasks (`task.inventory.count`) are functionally the same work: go count a product. They currently live in different namespaces, making it impossible to query all pending count work with a single pattern. The Pre-Sync card in the daily sync widget shows invoices and review counts but does not surface pending count tasks at all.

Additionally, product detail review during the count/validation flow surfaces issues (image accuracy, vintage changes) that have no structured task path today.

## Phase 1: Consolidate Count Tasks (Now)

### 1.1 Rename `task.validation.comax_internal_audit` to `task.inventory.count`

One task type for all physical counts, regardless of trigger (negative inventory, spot check, validation).

**Differentiation by content, not type:**
- Validation-triggered counts include a web product link in the notes — signals to manager that web detail review is needed
- Plain counts (negative inventory, spot checks) have no web link — just count

**Config changes:**
- `taskDefinitions.json`: remove `task.validation.comax_internal_audit` definition (already covered by `task.inventory.count`)
- `validation.json`: change all `on_failure_task_type` references from `task.validation.comax_internal_audit` to `task.inventory.count`

**Code changes — update all references to `task.validation.comax_internal_audit`:**
- `WebAppSync.js` (~line 682): `getInventoryReceiptsInfo()` review count query
- `WebAppDashboardV2.js` (~line 507, 736): dashboard inventory counts
- `WebAppInventory.js` (~line 20, 249): inventory widget and count queries
- `InventoryManagementService.js` (~lines 748, 785, 905): accepted count and type filtering
- `OrchestratorService.js`: if any direct references exist

**Data migration:** Existing open `task.validation.comax_internal_audit` tasks in SysTasks need their `st_TaskTypeId` updated to `task.inventory.count`.

### 1.2 Pre-Sync Card: Show Pending Count Tasks

Add a third line to the Pre-Sync card (card zero) in `AdminDailySyncWidget_v2.html`.

**Backend** (`WebAppSync.js` — `getInventoryReceiptsInfo`):
- Add count of open `task.inventory.count` tasks (any status except Done/Closed)
- Return as `countTasksCount` alongside existing `count` and `reviewCount`

**Frontend** (`AdminDailySyncWidget_v2.html`):
- Add `<div><span id="countTasksCount" class="fw-bold">...</span></div>` to the Pre-Sync card
- Render with same green (0) / warning (>0) pattern
- Label: "Counts: N"

### 1.3 Audit Table Tracking

`SysProductAudit` already tracks separately:
- `pa_LastCount` — updated on any physical count completion
- `pa_LastDetailAudit` — updated when detail review is done

No schema changes needed. The existing columns continue to track different activities regardless of task type consolidation.

## Phase 2: Image Review Tasks (Future)

When a reviewer finds an image that is inaccurate (label changed) or poor quality during detail review:

- **Flag:** `pa_ImageFlag` column on `SysProductAudit` — set manually by reviewer
- **Task type:** `task.product.image_update`
- **Flow:** `admin_direct` — admin is responsible for sourcing and updating images
- **Trigger:** flag is set during review; system creates task
- **Searchable:** separate task type allows filtering image tasks in task list

This is rare but needs to be trackable independently.

## Phase 3: Detail and Vintage Task Clarity (Future)

### 3.1 Separate "Detail Update" from "Vintage Update" in task titles

Current `on_failure_title` of "Vintage Update" is used for what are actually detail updates. Consider:
- Rename to "Detail Update" for non-vintage field mismatches
- Keep "Vintage Update" for actual vintage-specific validation rules
- Or: create `task.product.detail_update` as a distinct type if the workflow diverges

### 3.2 Comax Vintage Update

When a product needs its vintage year edited in Comax (reverse direction — web is correct, Comax is stale):
- **Task type:** `task.product.comax_update` (or similar)
- **Flow:** `admin_direct`
- Not triggered by validation — manual observation during review

### 3.3 Validation Without Count

If detail-only validation (no physical count needed) becomes a path:
- Split `task.inventory.count` back into two types under `task.inventory.*`
- `task.inventory.count` — physical count only
- `task.inventory.detail_audit` — web detail review, no count needed
- Pre-Sync card continues to query `task.inventory.*` prefix for all

## Implementation Order

1. Phase 1.1 — Rename task type (config + code + data migration)
2. Phase 1.2 — Pre-Sync card notification
3. Phase 1.3 — Verify audit tracking (no changes expected)
4. Phase 2 and 3 — as needed, independent of each other
