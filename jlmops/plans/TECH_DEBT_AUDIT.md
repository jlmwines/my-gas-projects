# jlmops Tech Debt Audit

**Created:** 2026-05-11
**Updated:** 2026-05-11 — first cheap-wins pass complete (see §6 "Done" subsection).
**Method:** Survey pass — scan-and-list, no deep verification. Each finding needs triage before any fix.
**Scope:** dead/one-use code, obsolete dev UI controls, code-compliance drift, plan-doc accuracy, data integrity gaps.
**Out of scope:** the existing data-integrity backlog already captured in `.claude/bugs.md` (timestamp audit, CRM cleanup, count-task audit, decanting zero, SKU mgmt test verifications) — referenced from §5 but not re-discovered.

**Severity legend:** S=safe-to-delete after one quick check · M=needs scope decision · L=lower priority / cosmetic.

---

## 1. Dead / One-Use Code

### 1.1 Orphan HTML views (not in `WebApp.getView` viewMap, no other references) — **DONE 2026-05-11**
- ~~`Dashboard.html`~~ (168 lines) — DELETED.
- ~~`ManagerDashboardView.html`~~ (69 lines) — DELETED.
- ~~`AdminDashboardView.html`~~ (130 lines) — DELETED. Stray comment reference in `ManagerProductsView.html:6` reworded ("Bootstrap from Dashboard.html" → "Bootstrap loaded by AppView.html"); no functional `AdminDashboardView` reference existed.
- ~~`DisplayOrdersView.html`~~ (33 lines) — DELETED.

### 1.2 Placeholder views that ship in production but do nothing — **DONE 2026-05-11**
- ~~`ComaxView.html`~~ (13 lines) — DELETED + removed from `WebApp.getView` viewMap.
- ~~`WebView.html`~~ (14 lines) — DELETED + removed from `WebApp.getView` viewMap.

Pending: `clasp push` to retire from the deployed source tree.

### 1.3 `SetupMigrate.js` (442 lines)
- One-time migration from a legacy spreadsheet (hardcoded ID `1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc`) to JLMops master sheets. Already executed. See §7 for full legacy-retirement context.

### 1.4 Retired-feature dead code (already known)
- War-support detection — flagged in `.claude/bugs.md` CRM-cleanup bundle. Cross-referenced here for completeness.

### 1.5 ~~Stale state-machine branch in `SyncStateService.js`~~ — **WITHDRAWN 2026-05-11**
- Finding was incorrect. `PUSHING_WEB_INVENTORY` IS declared in STATES (`SyncStateService.js:30`) — earlier grep filtered it out due to a too-narrow regex. The transition `WAITING_WEB_CONFIRM → PUSHING_WEB_INVENTORY` is valid; `PUSHING_WEB_INVENTORY → ['COMPLETE', 'FAILED']` is its outgoing edge. No fix needed.

### 1.6 Drive-import paths possibly orphaned after WC REST API pull
- STATUS.md (Current State) says: "Full Woo REST API pull (products + translations + orders) deployed Feb 2026. 'API Pull' button runs entire pipeline." But `OrchestratorService.js`, `ProductService.js`, `OrderService.js`, `ProductImportService.js`, `HousekeepingService.js` still reference `import.drive.web_orders` / `import.drive.web_products_en` extensively (~25 sites).
- `import.drive.comax_products` is legitimately still drive-based (Comax CSV drop).
- **M — confirm whether `web_orders` and `web_products_en` drive paths are still live (fallback path? scheduled trigger?) or fully retired in favor of the REST pull. If retired, remove the case branches, config rows, and folder watchers; keep only `comax_products`.**

### 1.7 Test files in production deploy (`*Test.js` + `TestData.js` + `TestRunner.js`)
- `OrderServiceTest.js`, `ProductServiceTest.js`, `ComaxAdapterTest.js`, `WebAdapterTest.js`, `TestData.js`, `TestRunner.js` — ~1,343 lines total. Wired into `DevelopmentView.html` via `runUnitTests()` button.
- `TESTING_GUIDE.md` last updated 2025-12-08 (Phase 0/0A); unclear if any of these tests still pass against the current service shapes.
- **M — decide: (a) keep + groom (re-run, fix breakages, treat as living regression suite), or (b) remove from deploy (move to a `tests/` folder excluded from `clasp push`). Default recommendation: (b), since GAS lacks a real test runner and the suite hasn't been touched in 5 months.**

---

## 2. Obsolete Dev UI Controls

### 2.1 `DevelopmentView.html` is in the live nav for all users
- `AppView.html:105` adds a "Development" link to the top-nav unconditionally — no role gate. Same in the orphan `Dashboard.html:84`.
- The panel exposes destructive/maintenance actions: Rebuild SysConfig, Protect Headers, Validate Schema, Daily Housekeeping, Run Unit Tests, Import CRM Data, Validate CRM, Correct Data, Refresh Contacts, Enrich Contacts, Run Intelligence.
- Also has a Developer Wishlist textarea (likely superseded by `.claude/wishlist`).
- **M — at minimum gate the nav link behind `effectiveRole === 'admin'` and probably a narrower dev-flag. Better: split into "Admin Tools" (keep) + "Developer Tools" (remove or move behind a per-user flag).**

### 2.2 ~~`AdminSyncView.html` carries commented-out "new sync widget" scaffolding~~ — **DONE 2026-05-11**
- Commented HTML block + JS stub removed. View now loads only the active V2 widget.

### 2.3 Run Unit Tests button (see §1.7)
- If §1.7 decision is "remove from deploy," also remove this button from `DevelopmentView.html`.

---

## 3. Code-Compliance Drift

### 3.1 ~~`CODING_STANDARDS.md` §9–10 list stale stage names~~ — **DONE 2026-05-11**
- §10 rewritten as a 14-row table over the actual STATES (`SyncStateService.js:15-33`), including `PUSHING_WEB_INVENTORY` and the kind taxonomy (`processing` / `user action` / `terminal` / `resting`).
- §9 step mapping reworked against the current stages; widget code remains the definitive source for step-to-stage UI logic.

### 3.2 `CODING_STANDARDS.md` §11 job-types list may be incomplete
- Lists `import.drive.web_orders`, `import.drive.web_products_en`, `import.drive.comax_products`, `job.periodic.validation.master`, `export.web.inventory`. Need to verify against `OrchestratorService.finalizeJobCompletion()` switch — there's also a Mailchimp pull, campaign pull, and post-sync bundle health trigger that may be wired in other ways.
- **M — reconcile after §1.6 decision (drive vs API).**

### 3.3 Placeholder views use `btn btn-primary`
- `ComaxView.html:9` and `WebView.html:9-10` use `btn btn-primary` — violates `CODING_STANDARDS.md` §3 + `jlmops/CLAUDE.md` button rule. Resolves automatically if §1.2 is acted on (delete the files).

### 3.4 `setConfig` key-shape inconsistency
- All callers correctly use the 3-arg signature (the 2-arg bug was fixed 2026-05-05). However the second argument varies:
  - Topic-level keys: `setConfig('system.brurya.last_update', 'value', ts)` — settingName carries the full path, key is the generic `'value'`.
  - Topic + field: `setConfig('woo.api', 'products_last_pull', ts)` — settingName is the topic, key is the field.
- Both work, but inconsistency makes it harder to scan SysConfig and harder to predeclare rows. Worth documenting the preferred shape and migrating one direction.
- **L — pick one shape, document it in `CODING_STANDARDS.md` §2 or a new section, normalize over time.**

### 3.5 Hardcoded spreadsheet ID in `SetupMigrate.js` (see §1.3)

---

## 4. Plan-Doc Accuracy

(Survey-level only — each entry needs a freshness pass.)

- **`MASTER_PLAN.md`** — "Updated: 2026-02-16" header. STATUS.md is the actual living source of truth for current priorities. **L — either refresh, retire (point header to STATUS.md), or merge useful long-view content into STRATEGIC_PLAN.md.**
- **`TESTING_GUIDE.md`** — "Last Updated: 2025-12-08," references Phase 0/0A. **M — tied to §1.7 decision (keep or retire the test suite).**
- ~~**`CAMPAIGN_SYSTEM_PLAN.md`** vs **`CAMPAIGN_ARCHITECTURE.md`** — two campaign plans now coexist.~~ **PARTIAL 2026-05-11** — status header added to `CAMPAIGN_SYSTEM_PLAN.md` pointing at `CAMPAIGN_ARCHITECTURE.md` as the implementation and clarifying the older doc's role (strategic context: welcome offer, send cadence, attribution). Open question (deferred): should the strategic content merge into `STRATEGIC_PLAN.md` and the older doc retire?
- ~~**`KPI_SUMMARY_TAB.md`** — STATUS.md flags this as DEFERRED/parked (Claude's pitch, not user's). **S — add a status header making this explicit so future sessions don't re-surface it as ready-to-build.**~~ **DONE 2026-05-11** — status header rewritten to "DEFERRED / parked (2026-05-07)" with rationale.
- **`ARCHITECTURE.md` + `IMPLEMENTATION_PLAN.md` + `WORKFLOWS.md`** — no dated headers; size/scope makes them hard to skim for drift. **M — each needs a targeted "what's accurate / what's drifted" pass against the current code, especially the sync workflow section and the data-model overview which may now reference renamed states or missing services (e.g., `MarketingCampaignService`, `MailchimpService`, `WooProductPullService`, `WooOrderPullService` postdate these docs).**
- **`PERFORMANCE_OPTIMIZATION_PLAN.md`** — dashboard performance plan; post-V2-dashboard freshness unknown. **L — quick verdict pass.**
- **Stale theme-prep docs surfaced 2026-05-07 cleanup** (RANKMATH_WPML_AUDIT, STAGING_AUDIT, THEME_FOUNDATIONS, etc.) live in `plans/` at the project root, not in `jlmops/plans/`, so out of scope for this audit. Noted for the next portfolio cleanup pass.

---

## 5. Data Integrity Gaps

All major items here are already on `.claude/bugs.md` — cross-referenced, not re-listed:

- CRM cleanup bundle (`sc_IsCore` defaulting overwrites import, Archive missing `CouponItems`, historical row corruption, dead war-support code, gift-detection rule) — `bugs.md:21-26`.
- Timestamp + date format audit — `bugs.md:28`.
- On-demand count-task creation audit (dedupe, assignment correctness, data-vs-count task split) — `bugs.md:30`.
- Decanting field treats 0 as empty — `bugs.md:32`.
- Pending SKU management test verifications (Vendor SKU Update + Trim Safety, deployed 2026-02-19, never tested) — `STATUS.md:51-54`.

**New from this audit:**

### 5.1 Sync stuck-state recovery for failed Comax import
- `.claude/bugs.md:19` notes this is deferred ("rare case"). Still worth a small fix — currently a corrected file upload after a failed import doesn't recover state, requiring manual intervention.
- **L — add explicit state-reset path in `_checkAndAdvanceSyncState` for `FAILED → WAITING_COMAX_IMPORT` retry.**

### 5.2 SysConfig predeclared-row hygiene
- Memory `feedback_read_arch_before_writing.md` records the pattern: one predeclared row per topic, `scf_P02` overwritten in place. The 2026-05-05 sweep fixed three writers but didn't verify all `setConfig` call sites predeclare their rows in `config/system.json`.
- **M — walk every `setConfig(...)` call (12 sites identified) and confirm a matching row exists in `config/system.json`. Currently uncertain whether `system.brurya.last_update`, `system.mailchimp.subscribers_last_update`, `system.mailchimp.campaigns_last_update`, `woo.api → products_last_pull` are all predeclared.**

### 5.3 SyncState `PUSHING_WEB_INVENTORY` reference (see §1.5)
- If this is a live state used at runtime but missing from the STATES object, transition validation may be silently passing through unguarded paths.

---

## 6. Triage Recommendation

**Done in first cheap-wins pass (2026-05-11):**
- §1.1, §1.2, §2.2, §3.1, §4 KPI_SUMMARY_TAB header, §4 CAMPAIGN_SYSTEM_PLAN header

**Needs a decision before touching:**
- §1.3 `SetupMigrate.js` — addressed by §7.1 (proposed deletion)
- §1.6 Drive-vs-API import paths — biggest scope question; affects ~25 code sites
- §1.7 Test files in deploy — keep + groom, or remove from deploy
- §2.1 DevelopmentView gating — what's the audience for which buttons
- §5.2 SysConfig predeclared-row walk
- §7.3 SetupSheets.js consolidation — proposed shape ready, awaiting OK

**Existing backlog (already tracked):**
- All of §5 except 5.1, 5.2, 5.3 — defer to existing bugs.md entries

**Lower priority:**
- §3.4 setConfig key-shape normalization
- §4 ARCHITECTURE/IMPLEMENTATION/WORKFLOWS freshness pass
- §5.1 stuck Comax import recovery

---

## 7. Legacy GAS Project Retirement

**Scope:** code in jlmops that was attached to the predecessor Google Apps Script project (cutover months ago). Not "drive-vs-API" inside jlmops; not "legacy WC import." Specifically: migration scripts, comparison-against-old-system code, and setup helpers that exist only because of the migration era.

### 7.1 ~~`SetupMigrate.js` — fully orphan, safe to delete~~ — **DONE 2026-05-11**

Both functions (`populateInitialOrderData`, `populateInitialProductData`) read from the legacy spreadsheet `1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc` (legacy sheets: `OrdersM`, `OrderLog`, `DetailsM`, `WeHe`, `ComaxM`, `WebM`, `Audit`) and write to the jlmops master sheets. Confirmed before delete: zero callers, legacy spreadsheet ID appears nowhere else in the codebase, legacy `Audit` sheet was the inline-consumed "comparison" data from the one-time migration.

**Result:** entire file deleted (442 lines). Pending `clasp push` to retire from deploy.

### 7.2 No ongoing legacy-comparison service exists

Search across jlmops for any reader of the legacy spreadsheet or comparison logic against the old system came up clean apart from `SetupMigrate.js`. The "comparison/validation" the user recalled was performed inline during the one-time migration, not as a separate service. `SysProductAudit` (which appears in inventory code) is unrelated — it's the live physical-count audit sheet used by `InventoryManagementService`, not legacy reconciliation.

### 7.3 ~~`SetupSheets.js` — 38 `create*Headers()` functions → consolidate to one generic~~ — **DONE 2026-05-11**

**Result:** SetupSheets.js reduced from 1,317 lines to 199 lines (~85% shrinkage).

- 38 per-sheet `create*Headers()` functions + 3 hand-coded master orchestrators (`createJlmopsSystemSheets`, `createCrmSheets`, `createLookupSheets`) → 1 `syncHeaders(sheetName, {preserveExtraColumns})` + 1 `syncAllHeaders()` that discovers sheets from `schema.data.*` config keys.
- `setupMarketingSheets()` retained as a named helper (pairs with `seedMarketingCampaigns()`) but reshaped to call `syncHeaders` internally.
- `protectAllSheetHeaders()` + `protectAllSheetHeadersFromUI()` preserved unchanged — they were already config-driven.
- `SysProductAudit`'s preserve-extra-columns behavior preserved via the `preserveExtraColumns` option, applied automatically by `syncAllHeaders()` for that sheet.
- `DriveApp.getFilesByName('JLMops_Data').next()` (CODING_STANDARDS §5 violation) now used in zero places — replaced with `SheetAccessor.getDataSpreadsheet()`.
- Two error-message strings in `ContactAnalysisService.js` updated from `createSysLkpCitiesHeaders()` → `syncHeaders('SysLkp_Cities')`.

Pending `clasp push` to retire the old functions from deploy.

**Original analysis below for reference:**

What the functions actually do (verified against `createWebXltSHeaders` body):

1. Open `JLMops_Data` and get/create the named sheet (create branch hasn't fired since cutover).
2. Clear row 1 entirely.
3. Rewrite row 1 from `schema.data.<SheetName>` config.

In other words: **they're header-sync helpers, misnamed "create."** Data rows are never touched. Only situation they'd legitimately run is after a schema change in `config/schemas.json` — a rare event now that the data model is stable.

**Callers:** only the master orchestrators `createJlmopsSystemSheets()`, `createCrmSheets()`, `setupMarketingSheets()`, `createLookupSheets()` — themselves only run from the Apps Script editor at setup/schema-change time. No UI button. No runtime path. The two `ContactAnalysisService.js` mentions are error-message strings (developer hints), not invocations.

**Proposed shape:**

```javascript
function syncHeaders(sheetName) {
  const allConfig = ConfigService.getAllConfig();
  const schema = allConfig[`schema.data.${sheetName}`];
  if (!schema || !schema.headers) {
    throw new Error(`Schema for '${sheetName}' not found. Run rebuildSysConfigFromSource first.`);
  }
  const spreadsheet = SheetAccessor.getDataSpreadsheet(); // per CODING_STANDARDS §5
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  const headers = schema.headers.split(',');
  const maxCols = sheet.getMaxColumns();
  if (maxCols > 0) sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
}

function syncAllHeaders() {
  const allConfig = ConfigService.getAllConfig();
  Object.keys(allConfig)
    .filter(k => k.startsWith('schema.data.'))
    .forEach(k => syncHeaders(k.replace('schema.data.', '')));
}
```

**Impact:**

| Before | After |
|--------|-------|
| 38 per-sheet `create*Headers()` functions (~900 lines, near-identical bodies) | 1 `syncHeaders(sheetName)` (~30 lines) |
| 4 master orchestrators (`createJlmopsSystemSheets`, `createCrmSheets`, `setupMarketingSheets`, `createLookupSheets`) with hard-coded function lists that must be updated whenever a new sheet is added | 1 `syncAllHeaders()` that discovers from config (no manual list) |
| Also: 23+ uses of `DriveApp.getFilesByName('JLMops_Data')` (violates `CODING_STANDARDS.md` §5) | 1 use of `SheetAccessor.getDataSpreadsheet()` |
| Misnamed "create" | Correctly named "sync" |

`protectAllSheetHeaders()` + `protectAllSheetHeadersFromUI()` + `createSysProductAuditHeaders()` (separate from the main batch, lines 818+) get the same consolidation treatment as part of the same refactor.

**Risk:** low. The new function does the exact same work; only the entry-point surface changes. Apps Script editor invocations from the user side change from `createWebXltSHeaders()` → `syncHeaders('WebXltS')` — a documented rename, easy to teach.

**Recommendation:** do §7.1 and §7.3 in the same pass — both touch `Setup*.js` files, both require a `clasp push`, neither has runtime risk (the deleted/replaced functions aren't called from runtime code).
