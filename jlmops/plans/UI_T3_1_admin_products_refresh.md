# UI Tier 3.1 — AdminProductsView refreshView consolidation (12 → 1 round-trip)

**Session ID:** UI_T3_1
**Status:** **SHIPPED 2026-05-29 — Stage A @159/Stage B both live @163.** Stage A (backend `WebAppProducts_getAdminViewData`) committed `b1f96c5`, editor-tested clean. Stage B (frontend `refreshView` consolidation) committed `02351c4`, deployed @163. Live smoke: all 4 cards render correctly. **Finding beyond plan:** v1 called `updateNewExportUI` "pure UI" — it actually made a *second* `WebAppProducts_getLinkageTasks()` call, so the old `refreshView` was **12 backend round-trips** (getLinkageTasks fired twice), now collapsed to 1; `updateNewExportUI` reuses `data.linkageTasks`. Implementation chose extracted-inner-`render()` per loader over the plan's duplicate-the-render-block sketch (avoids logic duplication; loading placeholder stays in the fetch path). Pre-existing (unrelated) note: SKU-management buttons overlap on mobile — desktop activity, not touched here, not logged. ⚠️ historical CORRECTED SHAPES below were the Stage-B prep notes. Plan v1 (2026-05-28).

> **CORRECTED SHAPES (verified against code during Stage A, 2026-05-29):**
> - The 8 section getters are **global functions** `WebAppProducts_getX()` (NOT methods `WebAppProducts._getX()`), and they return **raw arrays** (e.g. `reviewTasks.map(...)`), **throwing on error** — there is NO `{success,data}` or `.data` envelope on them.
> - `WebAppLookups_getMap(name)` returns `{ error, data: { headers, rows } }` — so lookups ARE unwrapped via `.data`.
> - Frontend loaders consume **raw arrays directly**: `withSuccessHandler(tasks => { ... = tasks || []; ... })`. The v1 Stage B "before" snippet showing `res.data` is wrong for these loaders. `loadLookupSection` consumes `{headers,rows}` via `WebAppLookups_getMap(cfg.mapName)` where `cfg.mapName` ∈ {`map.grape_lookups`,`map.kashrut_lookups`,`map.text_lookups`} (from the `LOOKUP_SECTIONS` config at AdminProductsView ~:718-720).
> - **The shipped Stage A function reflects all of the above** — copy its shape, not v1's snippet, when wiring Stage B's `applyAllSections` (pass raw arrays to each loader's preloaded path; pass `data.lookups.<section>` = `{headers,rows}` to `loadLookupSection`).

Plan v1 gaps (note several were wrong — see correction above):
- **12 round-trips confirmed:** `AdminProductsView.html:726-746` `refreshView` fires `loadReviewList / loadAcceptedList / loadPendingDetailsList / loadSuggestionList / loadSubmissionsList / loadLinkageList / updateNewExportUI / loadPendingNewList / loadSkuUpdates / loadLookupSection('grapes') / loadLookupSection('kashrut') / loadLookupSection('texts')`. **11 are backend calls; 1 is pure UI** (`updateNewExportUI` — no `google.script.run`).
- **Backend functions identified per loader:** `WebAppProducts_getAdminReviewTasks` (`:1242`), `_getAcceptedTasks` (`:1274`), `_getPendingDetailTasks` (`:1334`), `_getSuggestionTasks` (`:1367`), `_getSubmissionsTasks` (`:1402`), `_getLinkageTasks` (`:1424`), `_getPendingNewTasks` (`:1476`), `_getRecentSkuUpdates` (`:1212`), and `WebAppLookups_getMap` ×3 for lookups (`:1833`).
- **Vintage-review splice precedent must not regress:** `:1745-1777` `handleAdminAccept` splices accepted task from `reviewTasks` in-memory + calls `_rerenderReviewTable` for the next-task path; falls back to `refreshView` only on queue-drain or non-queue origin. Preserved as-is.
- **Render functions are already separable from fetchers:** verified at `loadLookupSection` (`:1816`) which fetches then explicitly calls `renderLookupTable(section)`. Adopt the same pattern for the 8 other loaders.

**Parent:** `UI_AUDIT.md` §5 Tier 3.1
**Estimated effort:** 1 session, 2 staged deploys.
**Depends on:** Nothing structural. Soft order: ideally after T2.5 (TaskWidgets) and T2.6 (AdminProductsView migration to kit, which lands in T2.6 Stage F) so this session edits the post-kit-adoption file.

## Session goal

Replace the 12-call fanout in `AdminProductsView.refreshView()` with a single backend call that returns all 11 data sections at once. Estimated wall-clock improvement on warm cache: **~2-3 sec → <500ms**. Vintage-review splice path preserved (no regression to in-memory accept flow).

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Re-read `AdminProductsView.html:726-746` (refreshView) and `:1745-1777` (vintage-accept splice). Confirm session-time state matches plan.
5. Read `WebAppProducts.js` head + `WebAppLookups.js` head to confirm module export pattern.
6. Open `.claude/bugs.md` — confirm no open AdminProductsView bug that conflicts.

## Stage A — Backend `WebAppProducts_getAdminViewData()`

**Why first.** Additive backend function. Frontend continues calling the existing 12 loaders unchanged. Stage A is testable from the Apps Script editor without any frontend deploy.

**Files.**
- Edit `jlmops/WebAppProducts.js` — add new public entry point.

**Changes.**

Add the following function inside the `WebAppProducts` module (alongside the existing 11 individual-section getters):

**SHIPPED CODE (added after `WebAppProducts_getRecentSkuUpdates`, ~:1051):**

```javascript
function WebAppProducts_getAdminViewData(sessionId) {
  try {
    return {
      success: true,
      data: {
        reviewTasks:        WebAppProducts_getAdminReviewTasks(),
        acceptedTasks:      WebAppProducts_getAcceptedTasks(),
        pendingDetailTasks: WebAppProducts_getPendingDetailTasks(),
        suggestionTasks:    WebAppProducts_getSuggestionTasks(),
        submissionsTasks:   WebAppProducts_getSubmissionsTasks(),
        linkageTasks:       WebAppProducts_getLinkageTasks(),
        pendingNewTasks:    WebAppProducts_getPendingNewTasks(),
        recentSkuUpdates:   WebAppProducts_getRecentSkuUpdates(),
        lookups: {
          grapes:  WebAppLookups_getMap('map.grape_lookups').data,
          kashrut: WebAppLookups_getMap('map.kashrut_lookups').data,
          texts:   WebAppLookups_getMap('map.text_lookups').data
        }
      }
    };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getAdminViewData', e.message, e);
    return { success: false, error: e.message };
  }
}
```

**Implementation note (RESOLVED).** v1 assumed `WebAppProducts._getX().data` internals — wrong. The getters are global `WebAppProducts_getX()` returning raw arrays (throw on error); lookups return `{error,data}`. The shipped code above reflects the verified shapes. Per-section SysTasks-read consolidation still deferred (see Notes).

**Per-section optimization deferred.** Each per-section getter currently reads SysTasks independently. A future optimization (deferred from this session) is to call SysTasks once at the top of `getAdminViewData` and pass the rows to each bucketer. Worthwhile if SysTasks size grows, not urgent today — the 8 sequential reads are still faster than 8 parallel `google.script.run` round-trips because they share execution context (no IPC overhead). Tracker note in session-end.

**Smoke A (Apps Script editor only — no live deploy yet).**
- After `clasp push` (no deploy), open Apps Script editor.
- Run `WebAppProducts_getAdminViewData()` from the editor.
- Confirm response shape: `success: true`, `data` object with all 11 keys present.
- Confirm each `data.<key>` is an array (the 8 task lists + the 3 lookup tables, the latter as `{ headers, rows }` objects per `loadLookupSection` parser).
- Total execution time: should be under 5 seconds even cold (most cost is SysTasks read).

**Rollback A.** Git revert + `clasp push` (no deploy revert needed since no deploy ran).

**Commit A.** `ui(AdminProducts/backend): add WebAppProducts_getAdminViewData (consolidates 11 section reads)`

## Stage B — Frontend `refreshView` refactor + per-loader optional preload

**Why second.** Refactor frontend to use the new backend. Each existing `load<X>` function accepts an optional preloaded-data argument and skips the fetch when given.

**Files.**
- Edit `jlmops/AdminProductsView.html` — `refreshView` + 9 load functions.

**Changes.**

### Part 1: Refactor each `load<X>` function to accept optional preload

⚠️ **The snippet below shows `res.data` — that is WRONG for these loaders.** Verified actual shape: e.g. `loadReviewList` does `google.script.run.withSuccessHandler(tasks => { ...; AdminProductsView.reviewTasks = tasks || []; ... }).WebAppProducts_getAdminReviewTasks();` — it consumes a **raw array**, not `res.data`. So the preloaded path sets the array directly (`AdminProductsView.reviewTasks = preloadedData;`). `loadLookupSection(section)` consumes `WebAppLookups_getMap(cfg.mapName)` → `{error,data}` and renders via `renderLookupTable(section)`; its preloaded shape is the `{headers,rows}` object (i.e. `data.lookups.<section>`). Match each loader's REAL current success-handler when adding its preload branch.

For each of the 9 fetch-bearing loaders (`loadReviewList / loadAcceptedList / loadPendingDetailsList / loadSuggestionList / loadSubmissionsList / loadLinkageList / loadPendingNewList / loadSkuUpdates / loadLookupSection`), add an optional preloaded-data parameter. Pattern (adapt to each loader's real shape):

```javascript
// before:
AdminProductsView.loadReviewList = function() {
  google.script.run.withSuccessHandler(res => {
    if (res.error) { console.error(...); return; }
    AdminProductsView.reviewTasks = res.data;
    AdminProductsView._rerenderReviewTable();
  }).WebAppProducts_getAdminReviewTasks();
};

// after:
AdminProductsView.loadReviewList = function(preloadedData) {
  if (preloadedData !== undefined) {
    AdminProductsView.reviewTasks = preloadedData;
    AdminProductsView._rerenderReviewTable();
    return;
  }
  google.script.run.withSuccessHandler(res => {
    if (res.error) { console.error(...); return; }
    AdminProductsView.reviewTasks = res.data;
    AdminProductsView._rerenderReviewTable();
  }).WebAppProducts_getAdminReviewTasks();
};
```

Apply the same pattern to all 9 loaders. The check is `if (preloadedData !== undefined)` because some sections may legitimately return empty arrays — distinguish "no arg" from "empty".

For `loadLookupSection(section, preloadedData)`: the preloaded shape mirrors the existing fetch response — `{ headers, rows }`. Handle accordingly.

### Part 2: Refactor `refreshView` to single round-trip

```javascript
// before (:726-746):
AdminProductsView.refreshView = function() {
  AdminProductsView.loadReviewList();
  AdminProductsView.loadAcceptedList();
  AdminProductsView.loadPendingDetailsList();
  AdminProductsView.loadSuggestionList();
  AdminProductsView.loadSubmissionsList();
  AdminProductsView.loadLinkageList();
  AdminProductsView.updateNewExportUI();
  AdminProductsView.loadPendingNewList();
  AdminProductsView.loadSkuUpdates();
  AdminProductsView.loadLookupSection('grapes');
  AdminProductsView.loadLookupSection('kashrut');
  AdminProductsView.loadLookupSection('texts');
};

// after:
AdminProductsView.refreshView = function() {
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) {
        console.error('refreshView failed:', res.error);
        return;
      }
      AdminProductsView.applyAllSections(res.data);
    })
    .withFailureHandler(err => {
      console.error('refreshView call failed:', err);
    })
    .WebAppProducts_getAdminViewData();
};

AdminProductsView.applyAllSections = function(data) {
  // Dispatch each section to its loader with preloaded data; loaders skip fetch.
  AdminProductsView.loadReviewList(data.reviewTasks);
  AdminProductsView.loadAcceptedList(data.acceptedTasks);
  AdminProductsView.loadPendingDetailsList(data.pendingDetailTasks);
  AdminProductsView.loadSuggestionList(data.suggestionTasks);
  AdminProductsView.loadSubmissionsList(data.submissionsTasks);
  AdminProductsView.loadLinkageList(data.linkageTasks);
  AdminProductsView.updateNewExportUI();  // pure UI, no data dependency
  AdminProductsView.loadPendingNewList(data.pendingNewTasks);
  AdminProductsView.loadSkuUpdates(data.recentSkuUpdates);
  AdminProductsView.loadLookupSection('grapes', data.lookups.grapes);
  AdminProductsView.loadLookupSection('kashrut', data.lookups.kashrut);
  AdminProductsView.loadLookupSection('texts', data.lookups.texts);
};
```

**Smoke B.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T3.1: AdminProducts refreshView consolidation (12 round-trips → 1)"`.
- **Pre-deploy comparison:** before Stage B ships, in production, time a vintage-review Accept on stopwatch from click to next-task-modal-appearing. Typical: 2-3 sec on warm cache.
- **Post-deploy:** open AdminProducts. Click a vintage-review task → modal opens with task. Click Accept → next task should appear in <500ms. Browser Network tab during Accept: confirm ONE `getAdminViewData` round-trip (not 12).
- **Splice path preserved smoke:** Accept several review tasks back-to-back. Confirm the splice-and-rerender path at `:1757-1768` continues to work (each Accept does NOT fire refreshView — only the splice happens). The refreshView fallback should only fire when (a) the queue drains (queue length reaches 0), or (b) the modal was opened from Submissions table (non-queue origin per `:1769-1772`).
- **Section-render smoke:** click each card's section to confirm data renders. Card 1: Review tasks count + Accepted tasks count + Pending Details tasks count. Card 2: Suggestions + Submissions + Linkage + Pending New. Card 3: Recent SKU Updates table. Card 4: Lookups (Grapes / Kashrut / Texts tables).
- **Individual loader smoke:** open browser console, run `AdminProductsView.loadReviewList()` directly with no arg. Confirm it still fetches and renders (per-section refresh path preserved for any future caller).

**Rollback B.**
- Git revert + redeploy. Per-section loaders revert to fetch-on-call; refreshView reverts to 12-call fanout.

**Risk B.**
- **Medium.** Largest single-file refactor in the audit. Mitigation: each load function's optional-preload pattern is uniform and minimal; the splice path (`:1745-1777`) is untouched.
- **Watch:** if any of the 9 loaders has a sub-render function call that depends on a side-effect from the fetch path (rare), behavior may diverge. Smoke catches it.

**Commit B.** `ui(AdminProducts): refreshView consolidation — single round-trip via getAdminViewData; per-loader optional preload arg preserves single-section refresh`

## Session-end checklist

After both stages committed + deployed:

1. **Git log review.** Two commits — backend then frontend.
2. **Performance smoke.** Stopwatch the vintage-Accept loop again post-fix. Document the wall-clock delta in commit notes or `.claude/session-log.md`.
3. **Update `UI_AUDIT.md` §10 status:** mark T3.1 SHIPPED with deploy refs and the perf measurement.
4. **Update `.claude/session-log.md`:** brief note with before/after timing.
5. **CCP-UI audit:**
   - CCP-UI-5 (load-once + client-filter): partial application — `refreshView` is now load-once across 11 sections. Individual filters within each section (e.g., suggestion-list filter) remain unchanged.

## Notes for future sessions

- **Per-section getter consolidation deferred** — the 9 underscore-internal getters each read SysTasks independently. If SysTasks size grows past ~5000 rows, this becomes meaningful overhead. Future session: read SysTasks once at the top of `WebAppProducts_getAdminViewData`, pass rows to bucketer per section. Track size growth via reliability audit Tier 4.1 (capacity telemetry) — promote to action if growth makes the difference observable.
- **Tier 3.3 (AdminBundles 4-call consolidation)** follows the same pattern as this session. Recipe is now established: one consolidated backend `getXViewData()` returning all sections; frontend `refreshView` rewrites to single call + dispatch.
- **Tier 5.3 (shared list component)** decision should account for the per-loader optional-preload pattern this session establishes. The pattern is uniform across 9 loaders here, 4 in AdminBundles, etc. If Tier 5.3 ever ships, the kit can expose a `bindLoader({fetch, render, preloadKey})` helper that codifies this shape.
