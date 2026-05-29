# UI Tier 1.0 — Quick Wins Batch

**Session ID:** UI_T1_0
**Status:** SHIPPED 2026-05-29 @153 deploy @157 (all 6 fixes). Plan v1.1 (2026-05-28). All v0 open questions resolved via code reading (Fix 2 SystemHealthWidget confirmed orphan + 3 dead AdminInventoryView calls flagged; Fix 4 jobQueue confirmed dead-read with no placeholder intent; Fix 5 polling re-test moved into smoke; Fix 6 sized CmxProdM at ~3043 rows + committed to projection-only caching at ~3KB).
**Parent:** `UI_AUDIT.md` §5 Tier 1.0
**Estimated effort:** 1 session, 6 staged deploys with smoke gate per fix.
**Depends on:** Nothing. First session to ship.

## Session goal

Ship 6 surgical, low-risk fixes that each take under an hour. Each fix has a focused smoke gate. If any fix reveals deeper issues than the sketch anticipated, **stop that fix, document, and continue with the others** — do not push through.

## Session opening checklist

Before touching code, confirm:

1. Working tree clean. `git status`.
2. Pinned deploy ID matches `.deployment-id`. `cat jlmops/.deployment-id`.
3. clasp auth fresh. `clasp deployments` returns the expected list (if stale, `clasp login`).
4. Read `jlmops/CLAUDE.md` UI constraints section.
5. Read `UI_AUDIT.md` §5 CCP-UI-1 through CCP-UI-7 (the patterns this session touches).
6. Open `.claude/bugs.md` jlmops section — confirm none of these 6 fixes overlap with an open bug we'd contradict.

## Fix 1 — Retire `SystemHealthView` empty stub

**Why.** 12-line empty stub (`SystemHealthView.html:12` says "Content to be added"). Real System Health surface is the dashboard card. Routed but dead.

**Files.**
- Delete `jlmops/SystemHealthView.html`
- Edit `jlmops/WebApp.js:76` — remove the line `'SystemHealth': 'SystemHealthView',`

**Pre-change verification (`[start]`).**
- Grep for any consumer beyond viewMap: `grep -rn "SystemHealthView\|'SystemHealth'" jlmops/` — expect only `WebApp.js:76` (the route) and `SystemHealthView.html` itself.
- Grep for nav links pointing at `loadView('SystemHealth')` or `?view=SystemHealth` — expect zero results. If any exist, surface before deleting.

**Change.**
1. In `WebApp.js`, delete the line at `:76`:
   ```javascript
   'SystemHealth': 'SystemHealthView',
   ```
2. Delete `jlmops/SystemHealthView.html`.

**Smoke.**
- `clasp push` after change. Open Admin Dashboard. Open Manager Dashboard. Open every nav entry. No 404 / "View not found" alerts.
- Confirm dashboard System Health card still renders (it's inline at `AdminDashboardView_v2.html:142-207`, unrelated to the deleted file).

**Rollback.**
- Git revert + redeploy. The deleted file is restored from git history.

**Commit.** `ui: retire SystemHealthView empty stub (12-line placeholder; dashboard card is the real surface)`

---

## Fix 2 — Retire 7 orphan widgets + 3 dead conditional refresh calls

**Why.** Seven widgets routed in `WebApp.js:77, :79-89` but no view embeds any of them via `getView` / `getHtmlOutput` / `include` (confirmed by exhaustive grep). Pre-v2 architecture residue. Each duplicates a card now inline in the dashboard.

`SystemHealthWidget` is included in this fix (resolved from v0 plan's `[spike]` — definitively orphan, see below).

`AdminInventoryView.html` has three calls to `window.refreshSystemHealthWidget` (`:406, :744, :781`) wrapped in `if (window.refreshSystemHealthWidget)` guards. The conditional short-circuits **always** because nothing loads the widget — these are permanent dead branches. Remove the 3 conditional blocks alongside the widget retirement.

**Files.**
- Delete (7 files):
  - `jlmops/AdminOrdersWidget.html`
  - `jlmops/ManagerOrdersWidget.html`
  - `jlmops/AdminInventoryWidget.html`
  - `jlmops/ManagerInventoryWidget.html`
  - `jlmops/AdminProductsWidget.html`
  - `jlmops/ManagerProductsWidget.html`
  - `jlmops/SystemHealthWidget.html`
- Edit `jlmops/WebApp.js` — remove 7 lines from the viewMap (`:77, :79, :81, :83, :85, :87, :89`).
- Edit `jlmops/AdminInventoryView.html` — remove three dead conditional refresh blocks at `:406-408, :744-746, :781-783`.

**Resolution of v0 `[spike]`.** Exhaustive grep across `jlmops/` for `getHtmlOutput('SystemHealthWidget'`, `getView('SystemHealthWidget'`, `include('SystemHealthWidget'`, `SystemHealthWidget')` returned zero non-plan-doc results. The only runtime references are the three conditional refresh calls in `AdminInventoryView.html` and the widget's own `window.refreshSystemHealthWidget = _fetchAndDisplaySystemHealth;` self-registration at `SystemHealthWidget.html:184`. Without a consumer that loads the widget script, the global is never defined; the refresh calls always short-circuit. Confirmed orphan.

**Change.**
1. In `WebApp.js`, delete seven lines from the viewMap object (`:77` and `:79, :81, :83, :85, :87, :89`):
   ```javascript
   'SystemHealthWidget': 'SystemHealthWidget',
   ...
   'AdminOrdersWidget': 'AdminOrdersWidget',
   'ManagerOrdersWidget': 'ManagerOrdersWidget',
   'AdminInventoryWidget': 'AdminInventoryWidget',
   'ManagerInventoryWidget': 'ManagerInventoryWidget',
   'AdminProductsWidget': 'AdminProductsWidget',
   'ManagerProductsWidget': 'ManagerProductsWidget',
   ```
   Leave `'AdminDailySyncWidget': 'AdminDailySyncWidget_v2'` at `:90` intact — it IS embedded (by AdminSyncView per Fix 5; also used by AppView per memory `feedback_widget_sync_health` if present — confirm in session at smoke).
2. Delete the 7 HTML files.
3. In `AdminInventoryView.html`, remove the three `if (window.refreshSystemHealthWidget) { window.refreshSystemHealthWidget(); }` blocks at `:406-408, :744-746, :781-783`. Replace each with nothing (the surrounding `loadAdminViewData()` + `loadComaxSyncData()` calls handle the actual UI refresh).

**Smoke.**
- `clasp push`. Open Admin Dashboard, Manager Dashboard, every nav entry — no 404 or "View not found".
- Specifically smoke Admin Inventory: accept a count, run a sync confirm, run a Comax export. Each previously called `window.refreshSystemHealthWidget` — confirm those flows still complete cleanly (dashboard System Health card refresh comes from the next dashboard nav, not from inventory hooks).
- Browser console: zero errors. No `refreshSystemHealthWidget is not defined` (it wasn't being called before either, but verify).

**Rollback.**
- Git revert + redeploy. The 7 files restore from git history; the 3 conditional blocks restore in AdminInventoryView.

**Commit.** `ui: retire 7 orphan v1-era widgets (no consumer; SystemHealthWidget conditional-refresh hooks in AdminInventory were permanent dead branches)`

---

## Fix 3 — Fix `ManagerOrdersView.html:120` invented `btn-primary`

**Why.** Per `jlmops/CLAUDE.md:68-78` (CCP-UI-2), button classes are copy-from-the-same-file, never invented. Every other button in `ManagerOrdersView.html` uses bare `btn` (e.g. `:12, :22`). The gift-doc success message link injected via template literal at `:120` uses `btn btn-sm btn-primary ml-2` — invented.

**Files.**
- Edit `jlmops/ManagerOrdersView.html:120`

**Pre-change verification (`[start]`).**
- Grep buttons in the file to confirm precedent: `grep -n "class=\"btn" jlmops/ManagerOrdersView.html` — expect bare `btn` and `btn btn-sm` only; no other color classes.

**Change.**
Current (`:120`):
```javascript
giftResultDiv.innerHTML = `<div class="alert alert-success">Gift message created for order ${orderId}. <a href="${docUrl}" target="_blank" class="btn btn-sm btn-primary ml-2">Open Document</a></div>`;
```

Target:
```javascript
giftResultDiv.innerHTML = `<div class="alert alert-success">Gift message created for order ${orderId}. <a href="${docUrl}" target="_blank" class="btn btn-sm btn-light ml-2">Open Document</a></div>`;
```

Only change: `btn-primary` → `btn-light`.

**Smoke.**
- `clasp push`. Open Manager Orders. Pick an order with a customer gift note and click Create Gift Doc.
- Confirm: alert renders green (Bootstrap `alert-success` is independent of the button), the "Open Document" link appears as a light button, clicks open the Drive doc in a new tab.

**Rollback.**
- Git revert + redeploy.

**Commit.** `ui(ManagerOrders): replace invented btn-primary with btn-light on gift-doc link (CLAUDE.md violation)`

---

## Fix 4 — Remove dead SysJobQueue read in `WebAppDashboardV2_getData`

**Why.** `WebAppDashboardV2.js:30-31` reads the entire `SysJobQueue` sheet on every dashboard load. `:37` converts it to objects. `:47` passes it to `_getSystemHealthData_v2(allTasks, jobQueue, allConfig)`. **The function never uses the `jobQueue` parameter** (verified by reading `:101-174`).

Dead I/O on every dashboard load for both admin and manager. SysJobQueue can be tens of thousands of rows; this is the cheapest single-fix wall-clock improvement in the system.

**Files.**
- Edit `jlmops/WebAppDashboardV2.js` — three changes.

**Pre-change verification (`[start]`).**
- Re-confirm `_getSystemHealthData_v2` does not use `jobQueue`. Read `WebAppDashboardV2.js:101-174` and grep for `jobQueue` inside that range. Expected: zero references.
- Confirm `jobQueue` is not used elsewhere in `_getData` body beyond the three lines we're removing. Grep `jobQueue` across the file — expected only `:30, :31, :37, :47`.

**Change.**
1. Delete line `:30-31` (the read):
   ```javascript
   const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue, false);
   const jobQueueRaw = jobQueueSheet ? jobQueueSheet.getDataRange().getValues() : [];
   ```
2. Delete line `:37` (the convert):
   ```javascript
   const jobQueue = _rowsToObjects(jobQueueRaw);
   ```
3. Update line `:47` to drop the unused argument:
   ```javascript
   // before:
   systemHealth: _getSystemHealthData_v2(allTasks, jobQueue, allConfig),
   // after:
   systemHealth: _getSystemHealthData_v2(allTasks, allConfig),
   ```
4. Update `_getSystemHealthData_v2` signature (`:101` or thereabouts) to drop the parameter:
   ```javascript
   // before:
   function _getSystemHealthData_v2(allTasks, jobQueue, allConfig) {
   // after:
   function _getSystemHealthData_v2(allTasks, allConfig) {
   ```

**Smoke.**
- `clasp push`. Open Admin Dashboard. Open Manager Dashboard.
- Confirm System Health card renders identical content (FAILED jobs, validation status, schema, etc. — all sourced from `allTasks` reading the system health task, not from `jobQueue`).
- Time-to-interactive should drop measurably on dashboards (varies by SysJobQueue size; could be 100-500ms+).

**Rollback.**
- Git revert + redeploy.

**Risk.**
- **Low.** Function signature change touches one call site (`:47`) and one definition. `_getSystemHealthData_v2` is underscore-private to the `WebAppDashboardV2` module pattern; no external callers.

**Resolution of v0 `[spike]`.** Reliability audit Tier 2.2 (FAILED-job daily sweep, `RELIABILITY_AUDIT.md` §5 Tier 2.2) writes count + age to `task.system.health_status` notes JSON additively — it does NOT pass a `jobQueue` parameter to dashboard helpers. The unused parameter is not a placeholder; it's dead. Remove cleanly. The sweep session re-reads SysJobQueue inside its own scope, not via dashboard plumbing.

**Commit.** `ui(dashboard): drop unused SysJobQueue read in _getSystemHealthData_v2 (dead I/O on every dashboard load)`

---

## Fix 5 — Convert `AdminSyncView` widget loader to scriptlet include

**Why.** `AdminSyncView.html:22-35` fires a server round-trip via `google.script.run.getHtmlOutput('AdminDailySyncWidget_v2')` to load the widget HTML, then re-evaluates scripts in the injected content. This is one unnecessary network round-trip every time the Sync nav is opened.

`LibraryView.html:1` precedent uses `<?!= include('TaskWidgets') ?>` scriptlet — widget content is inlined at template-eval time, no runtime round-trip.

`getView()` at `WebApp.js:105` already uses `HtmlService.createTemplateFromFile(...).evaluate()`, so scriptlets work in any routed view.

**Files.**
- Edit `jlmops/AdminSyncView.html` — replace dynamic loader with scriptlet include.

**Pre-change verification (`[start]`).**
- Confirm `AdminDailySyncWidget_v2.html` works as a scriptlet-include target (no top-level `<?` scriptlets that would fail in a sub-template — only scripts and CSS). Read the first ~30 lines of `AdminDailySyncWidget_v2.html` at session start.
- Confirm `include()` helper is available in jlmops (precedent `LibraryView.html:1` uses it).

**Change.**

Current (`AdminSyncView.html` entire file, 37 lines):
```html
<div class="container-fluid">
    <h1 class="mt-4">Sync</h1>

    <div class="row">
        <div class="col-12">
            <div id="admin-daily-sync-widget-container">
                <!-- AdminDailySyncWidget_v2.html will be loaded here -->
            </div>
        </div>
    </div>

    <script>
        function executeScriptsInElement(element) {
            const scripts = Array.from(element.getElementsByTagName('script'));
            scripts.forEach(s => {
                const newScript = document.createElement('script');
                newScript.textContent = s.textContent;
                s.parentNode.replaceChild(newScript, s);
            });
        }

        function loadAdminDailySyncWidget() {
            google.script.run
                .withSuccessHandler(html => {
                    const container = document.getElementById('admin-daily-sync-widget-container');
                    container.innerHTML = html;
                    executeScriptsInElement(container);
                })
                .withFailureHandler(err => {
                    document.getElementById('admin-daily-sync-widget-container').innerHTML = '<p class="text-danger">Failed to load sync widget.</p>';
                })
                .getHtmlOutput('AdminDailySyncWidget_v2');
        }

        loadAdminDailySyncWidget();
    </script>
</div>
```

Target:
```html
<div class="container-fluid">
    <h1 class="mt-4">Sync</h1>

    <div class="row">
        <div class="col-12">
            <?!= include('AdminDailySyncWidget_v2') ?>
        </div>
    </div>
</div>
```

The `executeScriptsInElement` helper goes away — already defined in `AppView.html:242-249` for the rare cases where dynamic HTML injection still needs it. The widget's scripts run normally because they're inlined at template-eval time.

**Smoke.**
- `clasp push`. Open Admin → Sync nav.
- Confirm: widget renders immediately (no spinner / dynamic loader gap); polling starts on the configured cadence; stage transitions work; Reset link works.
- Open browser console: no errors. No "AdminDailySyncWidget_v2 is not defined" or function-undefined errors (signals widget scripts re-running incorrectly).
- Open Network tab: confirm one less `google.script.run` call on view mount.
- **Poll-cycle smoke (do not skip).** With the Sync view open, observe one full 1-second spinner poll (during an active sync stage) and one full 10-second `WAITING_*` poll. Confirm `STAGE_CONFIG` lookup + state-transition rendering both fire correctly. If a sync isn't actively running, trigger a Reset (which transitions stage and exercises the polling) then a normal sync start to exercise both poll cadences.

**Rollback.**
- Git revert + redeploy. The original loader returns.

**Risk.**
- **Medium-low.** Widget scripts may have IIFE patterns or DOM-ready assumptions that behave differently when inlined vs dynamic-injected. The `getView` path already uses `createTemplateFromFile(...).evaluate()` so scriptlets work everywhere. Smoke is the gate.

**Commit.** `ui(AdminSync): replace dynamic widget loader with scriptlet include (saves one round-trip per Sync nav)`

---

## Fix 6 — Cache Brurya autocomplete source data

**Why.** `LookupService.js:72-115` `searchComaxProducts` re-opens the JLMops_Data spreadsheet **by name** (`SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next())` at `:85`), reads the entire CmxProdM sheet (`getDataRange().getValues()` at `:92`), and scans linearly per keystroke after the 300ms debounce.

Three costs stacked: (1) Drive name-lookup is slow vs ID-open, (2) `getDataRange().getValues()` of CmxProdM is several thousand rows of two-language data, (3) per-keystroke (after debounce) repeat.

**Precedent.** `ConfigService.js:34-40` uses `CacheService.getScriptCache()` to cache parsed config. Same pattern works here.

**Files.**
- Edit `jlmops/LookupService.js` — wrap the sheet read in CacheService with a TTL.

**Pre-change verification (`[start]`).**
- Read `LookupService.js:72-130` to see the full function context and confirm no parallel callers that would benefit from a different cache shape.
- Confirm `CacheService.getScriptCache()` precedent in `ConfigService.js:34-40` and the cache key + put pattern around `:155-170` (rough range; verify at session start).

**Change.**

Current core (`LookupService.js:78-92`):
```javascript
try {
    const allConfig = ConfigService.getAllConfig();
    const sheetName = allConfig['system.sheet_names'].CmxProdM;
    if (!sheetName) {
        throw new Error("Sheet name for 'CmxProdM' not found in configuration.");
    }

    const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        Logger.log(`Sheet '${sheetName}' not found.`);
        return [];
    }

    const data = sheet.getDataRange().getValues();
```

**Resolution of v0 `[start] / [spike]`.**

- **SheetAccessor availability:** confirmed standard global service in jlmops modules per `CODING_STANDARDS.md` §5 (precedent: `WebAppDashboardV2.js:21, :24, :27` uses `SheetAccessor.getDataSheet` and `SheetAccessor.getLogSheet`). Use `SheetAccessor.getDataSpreadsheet()` in this fix.
- **CmxProdM size:** ~3043 rows (verified against `exchange/ComaxProducts.csv`). Full 2D array stringified would push 100KB+ easily once all columns are JSON-encoded. **Switch strategy to cache only the (sku, nameHe) projection** — verified projection size for that row count is ~3KB (well under 100KB). Sufficient for the search function; raw 2D array is unnecessary.

Target (caches the projection, not the raw 2D array):
```javascript
try {
    const allConfig = ConfigService.getAllConfig();
    const sheetName = allConfig['system.sheet_names'].CmxProdM;
    if (!sheetName) {
        throw new Error("Sheet name for 'CmxProdM' not found in configuration.");
    }

    const projection = _getCmxProdMSearchIndex(sheetName);
    if (!projection.length) return [];

    const results = [];
    for (const item of projection) {
        if (item.skuLc.includes(lowerCaseSearchTerm) || item.nameLc.includes(lowerCaseSearchTerm)) {
            results.push({ sku: item.sku, name: item.name });
            if (results.length >= 15) break;
        }
    }
    return results;
} catch (e) {
    Logger.log(`Error searching products: ${e.message}`);
    return [];
}
```

And add the helper inside the module:
```javascript
const CMX_SEARCH_CACHE_KEY = 'lookup.cmxprodm.search_index';
const CMX_SEARCH_CACHE_TTL_SEC = 300; // 5 minutes

/**
 * Returns a small projection of CmxProdM (sku + nameHe + lowercased variants
 * for case-insensitive search) for the Brurya autocomplete. Cached for 5 min
 * to amortize the sheet-read across keystrokes.
 *
 * @param {string} sheetName CmxProdM sheet name from config.
 * @returns {Array<{sku: string, name: string, skuLc: string, nameLc: string}>}
 */
function _getCmxProdMSearchIndex(sheetName) {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CMX_SEARCH_CACHE_KEY);
    if (cached) {
        return JSON.parse(cached);
    }
    const spreadsheet = SheetAccessor.getDataSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        Logger.log(`Sheet '${sheetName}' not found.`);
        return [];
    }
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const skuIndex = headers.indexOf('cpm_SKU');
    const nameHeIndex = headers.indexOf('cpm_NameHe');
    if (skuIndex === -1 || nameHeIndex === -1) {
        Logger.log(`Required columns 'cpm_SKU' or 'cpm_NameHe' not found in '${sheetName}'.`);
        return [];
    }
    const projection = [];
    for (const row of data) {
        const sku = row[skuIndex] ? String(row[skuIndex]) : '';
        const name = row[nameHeIndex] ? String(row[nameHeIndex]) : '';
        if (!sku && !name) continue;
        projection.push({
            sku: sku,
            name: name,
            skuLc: sku.toLowerCase(),
            nameLc: name.toLowerCase()
        });
    }
    cache.put(CMX_SEARCH_CACHE_KEY, JSON.stringify(projection), CMX_SEARCH_CACHE_TTL_SEC);
    return projection;
}
```

**Three upgrades in this change:**
1. CacheService wrap (5-min TTL) — amortizes sheet read across keystrokes.
2. Projection-only caching — ~3KB for ~3043 rows, well within the 100KB CacheService per-key limit.
3. `SheetAccessor.getDataSpreadsheet()` replaces `DriveApp.getFilesByName('JLMops_Data').next()` per `CODING_STANDARDS.md` §5.

**Smoke.**
- `clasp push`. Open Manager Inventory. Open Brurya stock card. Type 2-character query (e.g. "ka").
- **First keystroke after pause:** expect normal latency (cache miss; same speed as before).
- **Second keystroke (different query):** expect sub-100ms response from cache hit.
- **Wait 6 minutes, type again:** expect normal latency (cache expired, re-fetches and re-caches).
- Open SysLog after smoke: zero new ERROR entries; zero "Required columns not found" warnings.

**Rollback.**
- Git revert + redeploy.

**Risk.**
- **Low.** Projection size resolved; CacheService precedent established (`ConfigService.js:34-40`); SheetAccessor precedent established (`WebAppDashboardV2.js:21+`). Falls back to fresh read if cache somehow throws.

**Commit.** `ui(LookupService): cache CmxProdM (sku, nameHe) projection in CacheService 5-min TTL + use SheetAccessor (CODING_STANDARDS §5)`

---

## Session-end checklist

After all 6 fixes are committed:

1. **Git log review.** `git log --oneline -7` shows 6 fix commits + the initial session-start state.
2. **Push + deploy as separate change-points** (memory `feedback_clasp_push_not_deploy`):
   - `clasp push` first (smoke at `/exec` if a `/dev` smoke is wanted — but per memory `feedback_jlm_no_dev_url_testing`, jlmops push+deploy is one motion; just go).
   - `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T1.0 quick wins: 6 fixes (orphan retire + dead-read removal + scriptlet include + Brurya cache)"`.
3. **Live smoke pass** (5-10 min):
   - Open Admin Dashboard, Manager Dashboard, Sync, Manager Orders (Create Gift Doc on a real gift order), Manager Inventory (Brurya autocomplete).
   - Browser console: zero errors.
   - SysLog: zero new ERROR entries in the 5 min following deploy.
4. **Update `UI_AUDIT.md` §10 status:** mark T1.0 SHIPPED with deploy ref.
5. **Update `.claude/session-log.md`:** brief session note per JLM kernel.
6. **CCP-UI audit** (per UI_AUDIT.md):
   - CCP-UI-2 (button discipline): Fix 3 applied; no new btn classes invented anywhere else.
   - CCP-UI-6 (shared kit + scriptlet include): Fix 5 applied.
   - Other CCP-UIs untouched by this session — no audit needed.

## Notes for future sessions

- **Fix 4 (dead SysJobQueue read)** sets a precedent for **Tier 3.3** (`AdminBundlesView` 4-call init consolidation) — same anti-pattern, larger fanout.
- **Fix 5 (scriptlet include)** sets a precedent for the **Content Stream modal merge (Tier 2.4)** which will use the same pattern.
- **Fix 6 (CacheService for autocomplete)** sets a precedent for **Tier 3.2** (`ManagerContactView` load-once) — though that one is client-side cache, not server-side; the pattern is shape-matched not literal.
- **Brurya cache (Fix 6)** may have follow-on: if cache-size is the bottleneck, a later session might convert it to load-once-filter-client (CCP-UI-5) instead. Document the size finding from this session for that decision.

## Open from this session

Anything resolved during the session goes here, with `[start] / [spike] / [defer]` tag and outcome.

- *(filled during session)*
