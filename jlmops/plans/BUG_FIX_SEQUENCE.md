# JLMOps Bug Fix Sequence

**Date:** 2026-05-28. **Source:** `.claude/bugs.md` ## jlmops ### Open.

Sequenced by readiness (concrete fix shape → diagnosis needed → larger scope → audits). Each session is one focused unit of work. Sessions A–E each end with: commit → user OK → `clasp push` → user smoke → user OK → `deploy.ps1`.

**Progress 2026-07-12:** Sessions A–E and G shipped/resolved. Open: F (sync hardening, needs staging repro), H (timestamp/date-format audit), I (count-task creation audit), J (product-editor cache fix + manager submit hang, new 2026-07-12).

---

## ✅ Session A — Quick wins batch (5 bugs, 1 session) — SHIPPED 2026-05-28 @144 deploy @148

Five bugs with concrete fix shape, each surgical. Bundled into one session.

1. **Decanting field treats 0 as empty** (2026-03-10)
   Find where decanting is read/written/displayed; treat 0 as a valid value, not a null sentinel.

2. **`backfillOrderTotals` is destructive** (2026-05-15)
   Either (a) gate so it only fills missing/zero totals + never overwrites, OR (b) remove entirely. Default: remove (Woo pull is the canonical writer; the function is unused in any automated path).

3. **Archive `wom_CouponItems` mapping** (2026-05-04, CRM cleanup item)
   Add `mappedRow[womIdx['wom_CouponItems']] = row[womaIdx['woma_CouponItems']];` to archive mapping loop in `ContactImportService.js` ~line 89-104.

4. **Bundle parent SKU in Comax order export** (2026-05-04)
   Build `bundleSkus` Set in `OrderService.exportOrdersToComax` from `WebProdM` where `wpm_TaxProductType ∈ {woosb, bundle}` (precedent: `InventoryManagementService.js:875-892`). Skip parent SKUs in the aggregation loop at `OrderService.js:359-368` with `if (bundleSkus.has(sku)) continue;`.

5. **Failed Comax import recovery** (2026-05-04, sync hardening item)
   Add a second special case in `WebAppSync.retryFailedStepBackend` (`WebAppSync.js:641-645`): if `failedAtStage === 'IMPORTING_COMAX'`, drop back to `WAITING_COMAX_IMPORT` (which has the upload UI) instead of back to itself. Single elif, precedent already exists for `PUSHING_WEB_INVENTORY` → `WAITING_WEB_CONFIRM` at the same site.

---

## ✅ Session B — SKU Replacement orphans (1 bug, diagnosis-first) — SHIPPED 2026-05-28 @148 deploy @152

Diagnosis flipped the framing: Product Replacement modal's Step 1 `lookupProductBySku` requires Comax presence; orphan scenario fails before action runs. Resolved as a NEW action (Fix Orphan SKU) rather than relaxing Product Replacement. `webProductReassign`'s missing WebProdS_EN + WebDetS + SysTasks updates in proactive-replace path noted but deferred (no real symptom).

**Bug:** 2026-05-27. SKU Replacement leaves orphans on web side: `WebProdM`, `WebProdM_Staging`, `WebDetM`, `WebDetM_Staging`, and `SysTasks.st_LinkedEntityId` on any open row referencing the old SKU.

**Plan:**
1. Trace which sheet(s) `WebAppProducts` / `ProductService` actually rewrite during a replace.
2. Confirm whether the lookup path uses `wpm_SKU` / `wdm_SKU` queries at all, or relies solely on Comax-side matching.
3. Patch all 5 web-side write sites in one cohesive change.
4. Add a smoke path: pick a real Comax SKU change, run replace, verify all 5 sites updated.

---

## ✅ Session C — Admin Projects task delete partial-success (1 bug, diagnosis-first) — SHIPPED 2026-05-28 @149 deploy @153

Diagnosis: row-index race between parallel `WebAppTasks_deleteTask` calls. Fix: new `WebAppTasks_deleteTasks(taskIds)` (plural) atomic endpoint reads sheet once, sorts descending, deletes in one server execution. Returns per-task failure detail.

**Bug:** 2026-05-15 (re-confirmed 2026-05-27). Delete claims partial-success, leaves rows in list, display lags.

**Plan:**
1. Trace the delete handler in `WebAppProjects.js` / `AdminProjectsView`.
2. Identify whether the partial-success is: (a) race between client refresh and server write, (b) per-record failures bubbling without row-level reporting, (c) selection-set mismatch with backend.
3. Fix the named cause + add row-level reporting so the message names which records failed.

---

## ✅ Session D — CRM cleanup gift rule + correction script — SHIPPED 2026-05-28 @150 deploy @154

All 3 plan pieces (gift rule, import wire-up, correction script) discovered to be already implemented — another stale-tracking case. Manager executed `runContactDataCorrection()` against live data before deploy. Code removal landed in @150: war-support detection helpers + `_warSupportOrders` counters + `noncore.support` classification branches dropped. `noncore.support` enum value + UI mappings kept per plan §269 ("ages out naturally").

Per `jlmops/plans/CRM_PLAN.md` simplified rule (2026-04-30 revision).

**Plan:**
1. `ContactService._isGiftOrder()` — implement the simplified rule: single-order gift = (different shipping address) AND (delivery keyword in customer note).
2. `ContactImportService.js` — wire the rule into the import path. Customer is `noncore.gift` only when the rule fires for every one of their orders.
3. One-time correction script — re-evaluate every customer with the new rule; set `noncore.gift` where every order qualifies, everything else → core.
4. Optional housekeeping: delete the war-support detection dead code (separate commit).

Prerequisite: Session A item 3 (archive `wom_CouponItems` mapping) should land first since it affects the same `ContactImportService.js` import path; helps reduce merge surface.

---

## Session E — `validateDeployment` detector — RESOLVED 2026-06-01 (@188 deploy @192)

**Bug:** 2026-05-27. Detector fires false positives daily; cannot UI-close.

**Resolution: removed, not fixed.** The detector's purpose (catch orphan deployments serving requests) is now covered at the source by `deploy.ps1` (`clasp deploy --deploymentId <pinned>` + post-deploy survival verify), and the visible `VERSION.built` stamp confirms which build is live. Rather than build the baseline-tracking rewrite below, deleted `HousekeepingService.validateDeployment` + its `performDailyMaintenance` registration, the `task.system.deployment_drift` template (taskDefinitions.json → SetupConfig.js regenerated → `rebuildSysConfigFromSource`), and the dead `NOT_IN_QUEUE` ref in WebAppLibrary. Kept `system.deployment.pinned_id` as the canonical pinned-ID record. The 4 orphan deployments (@66/@67/@73/@96) were undeployed the same session; deployments now = pinned @192 + @HEAD only. The external-check idea (item 2 below) remains available if a bypass-the-wrapper backstop is ever wanted, but is not built.

**Original plan (superseded by removal):**
1. **In-script baseline tracking** (soft warning). New SysConfig key `system.deployment.runtime_url_baseline`; detector compares against baseline rather than pinned ID; bootstraps baseline on first run.
2. **External check** (hard catch). New local script `jlmops/scripts/check-deployments.js` (or `package.json` npm script) that runs `clasp deployments` + diffs against a checked-in `jlmops/.expected-deployments.txt`; fails loudly on new IDs.
3. **UI close path** for system tasks — add a dashboard "Close drift task" admin action OR allow system tasks to be marked done from the manager view.
4. **Cleanup**: undeploy the 4 old orphan deployments (@66, @67, @73, @96) via `clasp undeploy` in the same session.

---

## Session F — Sync hardening 3 pending-repro items

User-driven. Backend already audited clean (per `SYNC_HARDENING_PLAN.md`); these need staging repro before backend can be fixed.

**Plan:**
1. User reproduces each on staging with timestamped notes.
2. Repro narrows root cause to stage-guard order, UI render race, or polling timing.
3. Fix the narrowed cause per item; verify on staging before deploy.

Items:
- Generate web export button visible/clickable before the action can fire
- Export button stays visible after export step starts
- Sync widget doesn't show Comax product import stage when order export is skipped without a refresh

---

## ✅ Session G — ManagerContactView search latency — RESOLVED 2026-05-29 (UI T3.2, @165 deploy @169)

Shipped via the UI audit's Tier 3.2 session (`jlmops/plans/UI_T3_2_manager_contact_load_once.md`), not this sequence. Load-once on mount + client-side filter (email + name); recent 50 render on load. Impl caught a latent crash: filtering `c.phone.toLowerCase()` threw because phone is stored numeric — fixed with `String()` guards. See `.claude/bugs.md` 2026-05-15.

**Bug:** 2026-05-15. Each keystroke (debounced 250ms) round-trips to GAS, loading all ~548 contacts server-side.

**Plan:**
- Cache the contact list client-side after first load; filter in JS for subsequent keystrokes.
- Server call only fires on initial view load and explicit refresh.
- Optional: add `limit` param on server response as a fallback.

UX optimization, not a correctness bug. Last in the sequence intentionally — easy win once measured, no upstream dependency.

---

## Session H — Timestamps + date formats audit

**Bug:** 2026-05-04 (folds in 2025-12-26 + 2026-01-21). Multi-area walk.

**Plan:**
1. Walk every place dates/times are stored or rendered: task creation, sync log, order export, dashboard, manager/admin views.
2. Standardize storage on Israel time; display on "21 Jan 2026" format (3-letter month).
3. Identify inconsistencies; fix each in a follow-up session (this session produces the audit + change list, not the fixes).

---

## Session I — Count-task creation audit

**Bug:** 2026-05-04 (folds in 2025-12-26). Walk the path that creates verification count tasks.

**Plan:**
1. Confirm no duplicates created on master/detail dedupe.
2. Confirm correct-user assignment.
3. Split data-validation tasks from count-validation tasks so they run as separate paths (don't require a count to do a data review).
4. Produce audit + change list; fixes follow.

---

## Session J — Product-editor cache failure + manager submit hang

**Bugs:** 2026-07-12. Two bugs found together while investigating one manager-reported incident (SKU 7290101582403 submit stuck on "Submitting…" for several minutes) — see `.claude/bugs.md`.

**Progress:** Item 1 (cache fix) shipped 2026-07-12 @469. Smoke-tested 2026-07-13 via `SysLog`: the per-SKU cache mechanism itself works (confirmed cache-hit log lines for repeat opens within the 300s TTL), **but total `getProductDetails` time didn't improve** — three opens the same day measured 18957ms (all 4 sheets miss), 18616ms (3 of 4 hit), 16743ms (cache expired, all miss again) — near-identical regardless of hit/miss ratio. The sheet-read cost item 1 targeted was never the dominant cost in that ~17-19s window; something else in the function (or the request round-trip itself) is untouched by the fix.

**Real cause found + fixed 2026-07-14 @482.** `getProductDetails` calls `_getCachedRegions()`/`_getCachedGrapes()`/`_getCachedKashrut()` (`ProductService.js:112-178`) on every call — despite the names, these "cache" into plain module-level JS variables, which are `null` on every fresh `google.script.run` invocation (Apps Script runs each call in a cold execution context), so they never actually persist across calls. `LookupService.getLookupMap`'s own `_cache` layer has the identical problem. On that guaranteed-cold path, `getLookupMap` (and a second helper, `_openLookupSheet`) did `SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next())` — a Drive-wide filename search — **three separate times per `getProductDetails` call** (once each for regions/grapes/kashrut), instead of the direct ID-based open (`SpreadsheetApp.openById`) used everywhere else via `SheetAccessor.getDataSpreadsheet()`. Confirmed `system.spreadsheet.data`'s config description is literally "ID of the JLMops_Data spreadsheet" — the exact same file, just reached the slow way. This was completely untouched by @469 (which only covered `ProductService.getRowObject`'s 4 main sheets via real `CacheService` caching) and fully explains why confirmed cache hits there showed no improvement. **Fix:** both call sites in `LookupService.js` now reuse `SheetAccessor.getDataSpreadsheet()`. The same anti-pattern had already been fixed once before elsewhere in the same file (`_getCmxProdMSearchIndex`, the Brurya autocomplete) — this closes the two remaining instances. Not yet smoke-tested live for load-time improvement.

Also smoke-tested 2026-07-13: the submit-hang symptom reproduced again, this time on a **new-product** (`task.onboarding.add_product`) submission rather than an existing-product detail update — confirms it isn't scoped to one task type. `submitProductDetails`/`WebAppProducts_handleManagerSubmit` is one shared code path for both, no branching by task type, so this isn't a new-product-specific server bug. As with the 07-12 incident, `SysLog` shows zero trace of the failed attempt — consistent with the click never reaching the server at all. Item 3's DevTools-console repro (capture the client-side JS error at the moment of the stuck click) is still the next diagnostic step, now with confirmed broader scope. Items 2-4 otherwise not started.

**Progress 2026-07-14 — root cause confirmed via live SysLog, not a platform/bridge theory.** Two intermediate hypotheses were investigated and abandoned in this same session before landing on the real cause; recorded briefly so a future session doesn't re-walk them:
- *"Request never reaches the server"* (matched the 07-12/07-13 incidents' zero-`SysLog` pattern) — abandoned once a same-day incident (SKU 691835732190, submit at 11:38:55) showed a complete, successful server-side trace (`submitProductDetails` → `TaskService.updateTaskStatus` → both cache invalidations, done by 11:39:01) with the modal still confirmed stuck >15 seconds afterward.
- *"Stale `google.script.run` iframe bridge"* (server completes, client callback never fires, only a full reload recovers) — proposed to explain the above, but abandoned once the actual trigger was found in code; superseded by the finding below.

**Confirmed root cause, found by tracing `openEditor()` (`ManagerProductsView.html:1034`):** the editor modal's state — `ManagerProductsView.currentTaskId`/`currentSku`, all `#edit-*` fields, and the product image — is shared global DOM/JS state with no in-flight guard. `submitChanges()` and `confirmVerify()` disable their button and fire an async `google.script.run` call that verified-slow (6-8 seconds server-side, confirmed in `SysLog` for both the SKU 691835732190 submit and a `completeVerifyTask` call the same session) — but nothing prevents `openEditor()` from being invoked again while that call is still pending. There are exactly two call sites (`ManagerProductsView.html:990`, the task-list "Open" button, and `:1414`, `advanceVerify()`'s auto-walk during a verification batch) — both funnel through the same `openEditor()` choke point. When it fires mid-submit, it immediately overwrites `currentTaskId`/`currentSku` and — once its own load completes — repopulates the shared fields including the image with the *new* task's data, all while never touching `#btn-submit-changes`/`#btn-confirm-verify`, which stay disabled/spinner-labeled from the original (now orphaned) submit. That is exactly the reported symptom: button stuck "active," image silently replaced by a different product, no reload-independent recovery because the original submit's eventual response, whenever it arrives, still runs `closeModal()`/`refreshView()` against a UI the user has already moved past.

**Not confirmed and not claimed:** the exact user action that fires the second `openEditor()` call while a submit is pending (list click-through, double-click, or something else) — the fix below is trigger-agnostic by design, so pinning this further isn't required.

Item 3 (LockService/concurrency-on-`SysTasks` theory) and the iframe-bridge theory are both superseded — dropped, not merely deprioritized. Item 4 is rewritten below as the actual fix.

**Plan:**
1. **Cache fix (concrete fix shape, do first).** Rejected a plain per-SKU reactive cache (cache only the SKU being opened, lazily) — that only speeds up *reopening the same SKU*, not the real workflow, which is walking a bounded list of distinct open tasks once each (manager: `WebAppProducts_getManagerProductTasks` typically returns single digits of tasks; admin: several card-scoped task lists, same order of magnitude). Reactive-only caching would leave every task's first open exactly as slow as today.

   **Design: harvest-while-reading, keyed to the open task list (per-SKU cache entries, no separate prefetch round-trip).** `ProductService.getRowObject`'s cache-miss branch (`ProductService.js:1073-1170`) already pays for a full `getDataRange().getValues()` read of `WebDetM`/`CmxProdM`/`WebProdM` on every miss — that read is unavoidable for the first task opened. Instead of trying to cache the whole sheet as one blob (today's broken approach — exceeds CacheService's 100KB-per-value limit, `cache.put()` throws on every call, confirmed 100% miss rate) or caching only the requested SKU, use that same read to harvest rows for *every currently-open product task's SKU*, not just the one being viewed, and write each as its own small per-SKU cache entry (`productData_<sheetName>_<sku>`) — small enough to comfortably fit the 100KB cap.
   - New helper in `ProductService` (e.g. `_getOpenProductTaskSkus()`): call `WebAppTasks.getOpenTasks()` (existing `SysTasks` read + Done/Cancelled filter, `WebAppTasks.js:88-121` — reuse, don't duplicate) and filter to the task-type set already established in `WebAppProducts_getProductsWidgetData` (`WebAppProducts.js:12-58`): `task.validation.vintage_mismatch`, `task.onboarding.suggestion`, `task.onboarding.add_product`, and `task.validation.*` generally except `task.validation.comax_internal_audit`. Collect their `st_LinkedEntityId` values into one small Set — confirmed the raw SKU field, no derivation-order risk (`WebAppProducts.js:203`, unlike the unrelated `WebAppLibrary._deriveEntityId` masking bug fixed 2026-07-10, which only affected a different feed). **Verified 2026-07-12: `WebAppTasks`'s cache is in-memory (`let taskCache`, `WebAppTasks.js:12-16`), not `CacheService` — it won't already be warm from an earlier request, so this harvest step pays for one extra small `SysTasks` read per cache-miss call, not a free reuse of a prior call's cache.**
   - `getRowObject`'s cache-miss branch loops the harvested SKU set against the sheet Map it already built in memory, writing one small cache entry per SKU found (bounded by the open-task-list size, not the catalog size).
   - Net effect: the first task opened in a session costs what it costs today (~15-18s, unavoidable); every other task already on the open list becomes a cache hit the moment its editor is opened, with no separate prefetch trigger or background call needed.

   **Decision (2026-07-12): `_invalidateProductCache` stays as-is (whole-sheet key removal, now a no-op against the new per-SKU keys) — don't make it SKU-aware.** Let the 300s TTL be the staleness bound after a submit instead; low-stakes since it's the just-submitted product going briefly stale in its own cache. **Added benefit:** today, because caching is whole-sheet-scoped, `_invalidateProductCache`'s literal-key removal on every save wipes the cache for *all four sheets at once* — any save by anyone makes every other in-flight product editor cold again ("every product behaves as the first after save"). Per-SKU keys fix this as a side effect: the no-op invalidation only leaves the just-saved SKU briefly stale; every other product's cache stays warm.
2. **Reassess the submit hang after #1 ships.** The cache fix removes most of the extra dwell-time in the modal; retest whether the submit-never-reaches-server issue still reproduces. If it clears up, it was likely time/exposure-window related (mobile connection drop, stale binding across a long-open modal).
3. **Dropped 2026-07-14 (was: LockService/concurrency-on-`SysTasks` diagnosis).** Superseded — the confirmed root cause is a client-side modal-state race, not a server-side lock/write contention issue. No further action.

4. ✅ **SHIPPED 2026-07-14 @479. The fix — guard the modal's single choke point (`openEditor()`) against re-entry while a submit is in flight, plus a defensive button-state reset.** All in `ManagerProductsView.html`.

5. ✅ **SHIPPED 2026-07-14 @480. A second, distinct race found smoke-testing @479 live: load-vs-load, not submit-vs-load.** Manager reported: verification submit ~10s + ~5s list reload, then opening the *next* verification showed stale data in the modal; separately, a new-product onboarding modal showed "current data" that should have been blank (no master/staging row exists yet for a genuinely new SKU). Traced `WebAppProducts_loadProductEditorData` server-side — confirmed no server bug, it correctly returns empty `master`/`staging` for a SKU with no `WebDetM`/`WebDetS` row. The actual cause: `openEditor()`'s own data-fetch call (`ManagerProductsView.html:1107-1154`, separate from the @479 submit guard) had no protection against being called a second time before the first call's response arrived — whichever response landed *last* won, regardless of which task was actually being viewed by then. **Fix:** a `_loadToken` counter, incremented on every `openEditor()` call and captured locally; both the success and failure handlers discard themselves if their captured token no longer matches the live one (a newer `openEditor()` has since started).

6. ✅ **SHIPPED 2026-07-14 @481. The @480 fix didn't resolve the report — same "stale data (prior product)" symptom persisted, consistently, not intermittently.** That inconsistency (always reproducible, not timing-dependent) pointed away from a race and at a simpler structural gap: `loadVerifyDetail()` (`ManagerProductsView.html:1441`) correctly clears the verify-mode display panel (`#verify-image`, `#verify-web-category`, `#verify-flags`) — but it only runs *after* the slow main load resolves, and nothing clears that panel synchronously when `openEditor()` first opens. So for the entire loading window (~6-10s+), the previous product's image/category/flags stayed visible. **Fix:** moved the same clearing into `openEditor()`'s synchronous clear-block, alongside the fields it already blanks on open.

   Same deploy also restored the pre-@208 auto-walk-to-next-task behavior on verification submit, at the user's explicit request — the manual close-then-reopen flow this forced was itself a major contributor to how often the loading-window gap got hit. `confirmVerify()`'s success handler now calls `advanceVerify()` instead of `closeModal()`/`refreshView()`. **Note:** @208 (2026-06-02) removed this exact behavior because the button was labeled "Confirm & close" while actually auto-walking — a label/behavior mismatch, not a rejection of auto-walk itself. Avoided recreating that mismatch by relabeling the button "Done & Next" (was "Done") rather than restoring the behavior silently under an unchanged label.

Confirmed smoke-tested clean 2026-07-15, alongside the follow-on product-detail load-performance work (`jlmops/docs/WORKFLOWS.md` §16, `jlmops/plans/_archive/PRODUCT_DETAIL_SNAPSHOT_PLAN.md`).

   a. **In-flight flag.** Add `ManagerProductsView._submitInFlight = false` (module-level state, alongside `currentTaskId`/`currentSku`). Set it `true` at the start of `submitChanges()` (~line 1806), `confirmVerify()` (~line 1454), and `doRevert()` (~line 1495) — the same point each already disables its button. Set it back to `false` in *every* terminal branch of each: both `withSuccessHandler` and `withFailureHandler` outcomes, for all `google.script.run` calls in the chain (`doRevert()` chains two calls before reaching a terminal state — the flag must stay `true` until the second call resolves, not the first).

   b. **Guard `openEditor()` at entry** (`ManagerProductsView.html:1034`, before any state mutation): if `_submitInFlight` is `true`, toast something like "A submission is still in progress — please wait" and return immediately, before touching `currentTaskId` or any DOM field. This is the single choke point both real call sites (`:990` Open button, `:1414` `advanceVerify()`) funnel through, so guarding here covers both without needing to separately guard each caller or pin the exact click sequence that triggers it.

   c. **Defensive reset, belt-and-suspenders.** `openEditor()` should also unconditionally reset `#btn-submit-changes` and `#btn-confirm-verify` to enabled + their default label on every entry (a few lines alongside its existing field-clearing block, ~line 1042). This means even if some future code path reaches `openEditor()` while `_submitInFlight` is somehow stale/wrong, the buttons can't stay permanently stuck on a task that's no longer displayed — the guard in (b) is the real fix, this is a cheap second layer.

   Not part of this fix, tracked separately: **both `submitProductDetails` and `completeVerifyTask` take 6-8 seconds server-side** (confirmed in `SysLog` for the SKU 691835732190 submit and a same-session verify completion) — genuinely slow for what should be a small sheet write, and the reason the race window is wide enough to hit in practice. That's a performance question, not a correctness one; the guard above makes the bug harmless regardless of how slow the writes are, so it doesn't block this fix, but it's worth its own look (folds naturally alongside item 1's still-open "cache fix didn't move the needle" question — same area of `ProductService`, same session-J family of slowness).

Sequencing: 1 → 2 → 4 (item 3 dropped).

---

## Sequencing notes

- Sessions A–C can run in any order. A is the biggest leverage (5 bugs / 1 session); B + C are diagnosis-first single-bug sessions.
- D depends on A.3 (archive coupon items mapping) landing first — both touch `ContactImportService.js`.
- E is self-contained.
- F depends on user-side staging repro.
- G is independent.
- H + I are audits, last because they produce change lists rather than fixes; their downstream fixes spawn additional sessions.

Recommend running A first to clear the deck of surgical fixes, then prioritizing among B-E based on user impact.
