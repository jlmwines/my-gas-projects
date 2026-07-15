# Product Detail Snapshot Plan

Eliminates the live sheet-read cost when a manager opens a product-detail task for review/edit. Captures the product's detail rows as JSON on the task at creation (or conversion) time — when the creating code either already has the data in memory or can fetch it once, off the manager's critical path — instead of re-reading sheets live on every editor open. Both phases implemented (@492), pending live smoke-test.

## Scope

Three moments create or convert a task into one that opens the shared product editor (`ManagerProductsView.html` / `getProductDetails`), each handled separately since the data available differs:

- **Add** — `task.onboarding.add_product`, created fresh by `acceptProductSuggestion` (`ProductService.js:1747-1778`).
- **Vintage-drift update** — `task.validation.vintage_mismatch`, created fresh by `ValidationOrchestratorService._createIndividualTask` off the `validation.comax.vintage_mismatch` rule (CmxProdM vs. CmxProdS comparison, `config/validation.json:87-104`).
- **Verification-fail conversion** — a failed verification doesn't create a fresh task: `WebAppProducts_passVerifyToManager` (`WebAppProducts.js:1297+`) converts an *existing* `task.product.verify` task (created by `createVerifyTasksBulk`, `ProductService.js:3166`, from CmxProdM only) onto `task.validation.vintage_mismatch` by reassigning its type (2026-06-17 decision: "vintage mismatch is the reason, detail update is the action"). This is the moment it first becomes editor-opening, so the snapshot is built here, not at the original verify-task creation.

Two review findings from the first pass don't apply, confirmed by user:
- Product-detail rules are never consolidated into `_createSummaryTask` (the >10-discrepancy summary path) — not a concern.
- Multiple open tasks on one SKU carrying different snapshots is very rare — not a concern.

## Problem

`getProductDetails(sku)` (`ProductService.js:1113`) reads WebDetM, WebDetS, CmxProdM, WebProdM live every time a manager opens a product-detail task in the editor. @482 fixed the worst cost driver (`LookupService`'s 3x Drive-wide filename search for regions/grapes/kashrut) but manager smoke-testing on 2026-07-14 found load times still slow enough to dominate the day's testing session. The remaining cost is the four live sheet reads themselves — per-SKU `CacheService` caching (shipped @469) only helps on *reopening* a SKU already opened this session; the first open of any task still pays full sheet-read cost.

## Why a snapshot, not more caching

Confirmed by user: product detail data only changes on the three triggers above. Between a task's creation and a manager opening it, staleness is not a concern — the displayed data is reference for the manager to work from, the physical product label is the actual source of truth for any correction. This makes a creation-time snapshot strictly better than either live reads or a cache layer: no sheet reads at open time, no TTL, no invalidation logic.

## Design

### Storage

`st_DetailSnapshot` — new column, appended to the end of `schema.data.SysTasks` per the append-only rule. Populated two ways, same mechanism both times:
- `TaskService.createTask`'s new `options.detailSnapshot` (`TaskService.js:217-227`) — same pattern as the existing `options.entityType`/`options.entityId`. Used by add + vintage-drift (fresh task creation).
- `WebAppTasks_updateTask`'s new `updates.detailSnapshot` (`WebAppTasks.js`, alongside its existing field-by-field update pattern). Used by the verify-conversion path (mutating an existing task).

Marker-in-notes (append JSON behind a delimiter inside `st_Notes`) was considered and rejected: `AdminProjectsView.html:1761` loads `task.st_Notes` raw into an editable textarea and writes it straight back on any admin save — a marker+JSON block would be silently destroyed with no recovery path. A dedicated column is never touched by that field.

### Shared reader

`ProductService.getWebDetailRows(sku)` — new public function, live WebDetM + WebDetS rows for one SKU, keyed exactly like `getProductDetails`' `master`/`staging` shape. Used by both paths below that don't already have this data in memory (replaces an earlier private copy that briefly lived in `ValidationOrchestratorService.js` — moved here to avoid duplicating it a second time for Phase 2).

### Add path — genuinely free

`acceptProductSuggestion` already has everything a snapshot needs, **no new read**: `suggestedNameEn`/`suggestedNameHe` arrive as parameters, and the function already reads `CmxProdM` directly (`ProductService.js:1802-1820`) and builds full in-memory WebDetS-shaped and WebDetM-shaped row objects before writing them. The snapshot is built from those same in-memory objects.

### Vintage-drift update path — one extra read, still a net win

`_createIndividualTask`'s `discrepancy.data` for this rule is `{...rowA, ...rowB}` = CmxProdM + CmxProdS fields only (`ValidationLogic.js:194`) — not WebDetM/WebDetS. Scoped narrowly (`rule.on_failure_task_type === 'task.validation.vintage_mismatch' && rule.sheet_A === 'CmxProdM' && rule.sheet_B === 'CmxProdS'`, so no other `task.validation.*` rule pays this cost), it calls `ProductService.getWebDetailRows(entityId)` for master/staging and reuses the Comax fields already in `discrepancy.data` — one extra read, paid once per validation pass, not per manager open.

### Verification-fail conversion path — three reads, nothing was in memory

`WebAppProducts_passVerifyToManager(taskId)` only had `taskId` before this change. Now: looks up the task row for its SKU, calls `ProductService.getWebDetailRows(sku)` for master/staging, and does its own direct CmxProdM row lookup (`ConfigService._getSheetDataAsMap`) for comax — all three reads happen once, at conversion, instead of on every subsequent manager open.

### Read side

`WebAppProducts_loadProductEditorData(taskId, sku)` (`WebAppProducts.js:233`) now always looks up the task row (needed to check for a snapshot regardless of whether the client passed `sku`). If `st_DetailSnapshot` is present: parse it, fetch the still-shared/global parts via the new `ProductService.getProductLookups()` (regions/grapes/kashrut/abvOptions — catalog-wide, not per-product, factored out of `getProductDetails` into a reusable `_getStaticLookups()` so both paths share it) — zero sheet reads for the per-SKU data. If absent or unparseable (tasks created before this shipped): falls back to `getProductDetails(sku)` unchanged. Purely additive.

## Out of scope

- Lookup caching (regions/grapes/kashrut) — @482 already fixed the slow path; whether these are also worth `CacheService`-caching is a smaller follow-on, not blocked by this plan.
- The 6-8s `submitProductDetails`/`completeVerifyTask` write-side slowness noted in `BUG_FIX_SEQUENCE.md` Session J — a different bottleneck (writes, not reads), tracked there.

## Status

Both phases implemented and deployed @492. Schema change requires `rebuildSysConfigFromSource()` (done). Not yet smoke-tested live — need to confirm: a freshly-created add task, a freshly-created vintage-drift task, and a freshly-converted verify-fail task all open instantly with correct data; an old (pre-change) task still loads via fallback. Follows Session J (`BUG_FIX_SEQUENCE.md`) live smoke-test of @482, which found load times still slow after the Drive-search fix — this plan is the fix for that finding.
