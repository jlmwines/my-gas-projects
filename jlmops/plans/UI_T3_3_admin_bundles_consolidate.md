# UI Tier 3.3 — AdminBundlesView 4-call init consolidation

**Session ID:** UI_T3_3
**Status:** **SHIPPED 2026-05-29 (@166 deploy @170; Stage A + Stage B `12eaf2f`).** Single `WebAppBundles_getViewData` round-trip live; smoke confirmed one `getViewData` on mount + all sections render with data. **Built against the actual PRE-T2.1 loaders** — T2.1 was deprioritized (desktop-only), so the post-T2.1 Stage-B snippets below (which reference `allBundles`/`lowStockBundleIds`/`applyFilterAndRender`/filter chips) were NOT applicable; loaders dispatch straight to `renderStats`/`renderBundleList`/`renderHealthAlerts` as they actually exist. All 4 backend getters confirmed to return `{error,data}` (so `.data` unwrap is correct — unlike T3.1's raw-array getters). `renderStats` extracted; explicit-refresh callers preserved by the `!== undefined` guard. **Observed on smoke:** load is still slow on mobile — consolidation removed the 4-call round-trip overhead but NOT the server-side compute (low-inventory calc dominates); genuine speed-up is a separate backend-perf task. Bundles view cards remain non-mobile-friendly = known/accepted (desktop admin tool, deprioritized for mobile). — Plan v1 (2026-05-28); gaps below resolved via code reading:
- **4 init round-trips confirmed:** `AdminBundlesView.html:186-191` `init()` calls `loadCategories / loadStats / loadBundleList / loadHealthAlerts`, each firing its own `google.script.run` (`:204, :238, :265, :330`).
- **Backend functions identified:** `WebAppBundles_getCategories`, `_getStats`, `_getAllBundles`, `_getBundlesWithLowInventory`.
- **T2.1 dependency:** T2.1 introduces a `lowStockBundleIds` Set derived from `healthData` in `loadHealthAlerts` (Stage B of T2.1 deep-dive). T3.3 preserves this derivation by sourcing both `state.allBundles` and `state.lowStockBundleIds` from the consolidated response. T2.1's filter-chip logic continues to work.
- **Action-callback path preserved:** `applyReplacements` (`:419-441`) and `loadBundleForEditing` (`:447-463`) call individual loaders explicitly after their actions. These remain independent — only `init()` is consolidated; individual loaders stay callable.

**Parent:** `UI_AUDIT.md` §5 Tier 3.3
**Estimated effort:** 1 session, 2 staged deploys (backend then frontend, T3.1 recipe).
**Depends on:** **T2.1 must ship first** (Stage B introduces `applyFilterAndRender`, `lowStockBundleIds`, `allBundles` state that this session preserves). If T3.3 ships before T2.1, the refactor still works but Bundle Editor remains visible-by-default and there's no filter chip — not ideal but not broken.

## Session goal

Replace the 4-call `init()` fanout with a single consolidated backend call. Estimated improvement: ~4× parallel `google.script.run` overhead (each ~200-500ms) → 1 call (~500ms). Visible as a faster view mount.

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. **Verify T2.1 already shipped.** Open `AdminBundlesView.html` — search for `allBundles` state declaration and `lowStockBundleIds` Set. If absent, ship T2.1 first.
5. Re-read `AdminBundlesView.html:186-205` (init + loadCategories), `:221-239` (loadStats), `:253-309` (loadBundleList + renderBundleList), `:315-403` (loadHealthAlerts + renderHealthAlerts).
6. Read `WebAppBundles.js` head to confirm module export pattern (mirrors `WebAppProducts.js` pattern from T3.1).

## Stage A — Backend `WebAppBundles_getViewData()`

**Why first.** Additive backend. Editor-testable without frontend deploy. T3.1 set the recipe; this is a smaller-scope application of it.

**Files.**
- Edit `jlmops/WebAppBundles.js` — add public entry point.

**Changes.**

Add inside the `WebAppBundles` module:

```javascript
/**
 * Consolidates the 4 view-mount fetches that AdminBundlesView.init() previously
 * fired in parallel via 4 separate google.script.run calls. Returns one response
 * suitable for AdminBundlesView.applyInitData(data) to dispatch.
 *
 * @param {string} [sessionId] Optional sessionId for traceability.
 * @returns {{success: boolean, data?: object, error?: string}}
 */
function WebAppBundles_getViewData(sessionId) {
  try {
    return {
      success: true,
      data: {
        categories:   WebAppBundles_getCategories().data || [],
        stats:        WebAppBundles_getStats().data || {},
        bundles:      WebAppBundles_getAllBundles().data || [],
        healthAlerts: WebAppBundles_getBundlesWithLowInventory().data || []
      }
    };
  } catch (e) {
    LoggerService.error('WebAppBundles', 'getViewData', e.message, e);
    return { success: false, error: e.message };
  }
}
```

The above calls the existing 4 public functions and unwraps their `.data` field. Per the T3.1 deep-dive note, an internal-helper SysTasks/SysBundles single-read optimization is **deferred** — the 4 sequential reads inside one execution share context (no IPC overhead) and are still markedly faster than 4 parallel `google.script.run` round-trips.

**Smoke A (Apps Script editor only).**
- After `clasp push`, open Apps Script editor.
- Run `WebAppBundles_getViewData()` from the editor.
- Confirm: `success: true`, `data` has all 4 keys (`categories`, `stats`, `bundles`, `healthAlerts`), each is the expected type (array or object).

**Rollback A.** Git revert + `clasp push` (no deploy revert needed since no deploy ran).

**Commit A.** `ui(AdminBundles/backend): add WebAppBundles_getViewData (consolidates 4 section reads)`

## Stage B — Frontend `init` refactor + per-loader optional preload

**Why second.** Frontend dispatch. Each existing loader accepts an optional preloaded-data argument and skips the fetch when given.

**Files.**
- Edit `jlmops/AdminBundlesView.html` — `init` + 4 loaders.

**Changes.**

### Part 1: Refactor each loader to accept optional preload

For each of the 4 init loaders, apply the T3.1 pattern:

**`loadCategories(preloadedData)`** (currently `:194-205`):
```javascript
function loadCategories(preloadedData) {
  if (preloadedData !== undefined) {
    categoryOptions = preloadedData;
    return;
  }
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result.error && result.data) {
        categoryOptions = result.data;
      }
    })
    .withFailureHandler(function(err) {
      console.error('Failed to load categories:', err);
    })
    .WebAppBundles_getCategories();
}
```

**`loadStats(preloadedData)`** (currently `:221-239`):
```javascript
function loadStats(preloadedData) {
  if (preloadedData !== undefined) {
    renderStats(preloadedData);
    return;
  }
  google.script.run
    .withSuccessHandler(function(result) {
      if (result.error) { console.error('Error loading stats:', result.error); return; }
      renderStats(result.data);
    })
    .withFailureHandler(function(err) { console.error('Failed to load stats:', err); })
    .WebAppBundles_getStats();
}

function renderStats(stats) {
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-active').textContent = stats.active;
  document.getElementById('stat-draft').textContent = stats.draft;
  document.getElementById('stat-archived').textContent = stats.archived;
  document.getElementById('stat-attention').textContent = stats.needsAttention + ' bundles (' + stats.lowInventoryCount + ' slots)';
}
```

(Extracting the stat-DOM logic into `renderStats` keeps both fetch and preload paths clean.)

**`loadBundleList(preloadedData)`** (currently `:253-266`, post-T2.1):
```javascript
function loadBundleList(preloadedData) {
  if (preloadedData !== undefined) {
    allBundles = preloadedData;
    applyFilterAndRender();  // T2.1 pattern preserved
    return;
  }
  google.script.run
    .withSuccessHandler(function(result) {
      if (result.error) { console.error('Error loading bundles:', result.error); return; }
      allBundles = result.data || [];
      applyFilterAndRender();
    })
    .withFailureHandler(function(err) { console.error('Failed to load bundles:', err); })
    .WebAppBundles_getAllBundles();
}
```

**`loadHealthAlerts(preloadedData)`** (currently `:315-331`, post-T2.1):
```javascript
function loadHealthAlerts(preloadedData) {
  if (preloadedData !== undefined) {
    healthData = preloadedData;
    lowStockBundleIds = new Set(healthData.map(function(bd) { return bd.bundle.bundleId; }));
    renderHealthAlerts(healthData);
    applyFilterAndRender();  // re-render bundle list with badges
    return;
  }
  google.script.run
    .withSuccessHandler(function(result) {
      if (result.error) {
        document.getElementById('health-alerts-container').innerHTML = '<div class="text-danger">' + result.error + '</div>';
        lowStockBundleIds = new Set();
        applyFilterAndRender();
        return;
      }
      healthData = result.data || [];
      lowStockBundleIds = new Set(healthData.map(function(bd) { return bd.bundle.bundleId; }));
      renderHealthAlerts(healthData);
      applyFilterAndRender();
    })
    .withFailureHandler(function(err) {
      document.getElementById('health-alerts-container').innerHTML = '<div class="text-danger">Failed to load health data</div>';
      lowStockBundleIds = new Set();
      applyFilterAndRender();
    })
    .WebAppBundles_getBundlesWithLowInventory();
}
```

### Part 2: Refactor `init` to single round-trip

```javascript
// before (:186-192):
function init() {
  loadCategories();
  loadStats();
  loadBundleList();
  loadHealthAlerts();
  bindEvents();
}

// after:
function init() {
  bindEvents();  // event bindings can run before data arrives
  google.script.run
    .withSuccessHandler(function(res) {
      if (!res.success) {
        console.error('init failed:', res.error);
        return;
      }
      applyInitData(res.data);
    })
    .withFailureHandler(function(err) {
      console.error('init call failed:', err);
    })
    .WebAppBundles_getViewData();
}

function applyInitData(data) {
  loadCategories(data.categories);
  loadStats(data.stats);
  loadBundleList(data.bundles);
  loadHealthAlerts(data.healthAlerts);
}
```

`bindEvents()` moves before the round-trip so event handlers are wired even if the data fetch is in flight — clicking a not-yet-rendered row simply does nothing, no race.

**Smoke B.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T3.3: AdminBundles init consolidation (4 round-trips → 1)"`.
- **Mount smoke:** open AdminBundles. Browser Network tab during mount: confirm ONE `WebAppBundles_getViewData` round-trip (not 4).
- **Render smoke:** confirm all 4 sections render:
  - Stats row (Total / Active / Draft / Archived / Needs Attention)
  - Filter chips (T2.1 outcome)
  - Bundle list with Low Stock badges on appropriate rows (T2.1 outcome)
  - Suggest Replacements card visible only if alerts exist (T2.1 outcome)
- **Action-callback smoke:** click "Apply Selected Replacements" — confirm post-action callback re-calls `loadHealthAlerts()` and `loadStats()` (with no preload arg, since they're explicit refresh calls). Should reflect updated state.
- **Editor-open smoke:** click any bundle row's Edit → Bundle Editor renders (T2.1 hide-until-click).
- Browser console: zero errors.

**Rollback B.**
- Git revert + redeploy.

**Risk B.**
- **Low.** Same pattern as T3.1. Individual loaders preserved for explicit-refresh callers (`applyReplacements` post-callback continues to work).

**Commit B.** `ui(AdminBundles): init consolidation — single round-trip via getViewData; per-loader optional preload preserves explicit-refresh path`

## Session-end checklist

1. **Git log review.** Two commits.
2. **Performance smoke.** Pre-deploy: time AdminBundles mount on stopwatch. Post-deploy: same. Document the delta.
3. **Update `UI_AUDIT.md` §10 status:** mark T3.3 SHIPPED.
4. **Update `.claude/session-log.md`:** brief note with timing.
5. **CCP-UI audit:**
   - CCP-UI-5 (load-once + client-filter): partial — `init` is now load-once across 4 sections; filter chips (T2.1) drive client-side filter over cached `allBundles`. Same shape as T3.1.

## Notes for future sessions

- **T3.1 + T3.3 establish the pattern uniformly.** Any future "init fanout" anti-pattern (e.g., AdminProjectsView's 3-call init at `:660-784` per audit findings) follows the same recipe: consolidated `getViewData` + per-loader optional preload + single init dispatch.
- **Tier 5.3 reassessment after T3.3 lands:** with T3.1 + T3.3 both consolidated, the consolidated-backend pattern is observed in 2 views. If AdminProjectsView later joins, the pattern is consistent enough that Tier 5.3 could codify it as a CCP-UI-5 sub-pattern (`bindFetcher({fetchAll, sections, dispatch})`).
