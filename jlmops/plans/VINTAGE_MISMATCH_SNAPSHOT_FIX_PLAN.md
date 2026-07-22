# Vintage-Mismatch Snapshot Fix Plan

Fixes a correctness bug in `task.validation.vintage_mismatch`'s use of the `st_DetailSnapshot` product-detail-snapshot mechanism (`jlmops/plans/_archive/PRODUCT_DETAIL_SNAPSHOT_PLAN.md`, `docs/WORKFLOWS.md` §16.1). The snapshot mechanism itself is sound and stays for the other two trigger types (Add, Verification-fail conversion); this task type is being pulled out of it entirely because its premise — "staleness doesn't matter, the physical bottle is the source of truth" — doesn't hold for a task whose whole purpose is reconciling two data systems (Comax vs. Web) that can keep moving after task creation.

## Problem (found 2026-07-22)

Two distinct bugs, both stemming from freezing Comax/Web data at task-creation/conversion time for a task type whose job is tracking a live cross-system discrepancy:

1. **Wrong field captured.** `ValidationOrchestratorService._createIndividualTask` (~line 190) filters the rule's discrepancy data to `cpm_*` keys only, discarding `cps_Vintage` — the incoming/staging value that's the actual reason the task exists. The editor (`ManagerProductsView.html:1197`) displays `comaxData.cpm_Vintage`, so it always shows the pre-drift value, and normal sync promotes staging→master in the meantime, so by the time anyone opens the task, live `CmxProdM.cpm_Vintage` has already moved past what the snapshot shows.
2. **Full-row overwrite from a stale baseline.** The manager's edit form is seeded entirely from the frozen snapshot (master + staging + comax). Both write paths — `ProductService.submitProductDetails` (→ WebDetS) and `ProductService.acceptProductDetails` → `_upsertMasterProductRow` (→ WebDetM) — write *every* column from the form, not just the ones edited. Any field on that SKU that changed elsewhere while the task sat open gets silently reverted to its task-creation value on Submit/Accept. Not vintage-specific — every field in the editor is exposed to this, for as long as the task remains open (observed: 4+ days in the reported case).

Both `ValidationOrchestratorService._createIndividualTask` (rule-based creation) and `WebAppProducts_passVerifyToManager` (verify-fail conversion, `WebAppProducts.js:1240`) currently attach a snapshot to what becomes a `task.validation.vintage_mismatch` task. The conversion path captures the correct live `cpm_Vintage` at conversion time (no field bug there), but has the identical staleness/overwrite exposure once the task sits open afterward.

## Fix

Exempt `task.validation.vintage_mismatch` from the snapshot mechanism entirely — treat it like the verify modal (`docs/WORKFLOWS.md` §16.2), which already skips snapshotting because "it's checking for live drift, so a creation-time snapshot would defeat the point." `WebAppProducts_loadProductEditorData` already falls back to a full live `ProductService.getProductDetails(sku)` read whenever `st_DetailSnapshot` is absent (existing, tested fallback path for pre-snapshot tasks) — so removing the snapshot at the two creation points is sufficient; no read-side code change needed.

1. `ValidationOrchestratorService._createIndividualTask` — delete the `comaxSnapshot`-building block and the `taskOptions` assignment for the vintage_mismatch branch; call `TaskService.createTask` with no `detailSnapshot` option (same as every other rule).
2. `WebAppProducts_passVerifyToManager` — drop the `detailSnapshot` computation; call `WebAppTasks_updateTask` without a `detailSnapshot` key.
3. `docs/WORKFLOWS.md` §16.1 — currently lists all three trigger types under "staleness doesn't matter." Correct it: vintage-drift is excluded, cross-reference §16.2's reasoning instead of repeating it.
4. `plans/_archive/PRODUCT_DETAIL_SNAPSHOT_PLAN.md` stays archived as-is (historical record of what was built); this plan is the correction, not a rewrite of that history.

## Consequence accepted

Vintage-drift tasks go back to paying the live-read cost (WebDetM/WebDetS/CmxProdM) on first open — the exact cost the snapshot plan eliminated. Given the correctness failure this causes, that's the right trade for this task type; Add and Verification-fail-conversion tasks are unaffected and keep the fast path, since they're proofreading-against-a-physical-object tasks that are normally actioned same-day.

## Already-open task

The SKU reported 2026-07-22 (task created 2026-07-18) already carries a frozen, wrong `st_DetailSnapshot`. User will handle directly — either blank the task's `st_DetailSnapshot` cell (simplest: forces the existing live-read fallback next open) or hand-correct the JSON. No code change needed for this part.

## Residual risk (not in scope here)

Add and Verification-fail-conversion tasks still snapshot, and still do the same full-row-overwrite on Submit/Accept. Their premise holds today because they're short-lived in practice — but if either is ever observed sitting open for days, the same corruption risk applies to them too. Watch for it; revisit if seen.

## Status

Implemented 2026-07-22: both code edits made (`ValidationOrchestratorService._createIndividualTask`, `WebAppProducts_passVerifyToManager`), `docs/WORKFLOWS.md` §16.1 corrected. Not yet pushed, deployed, or smoke-tested live.
