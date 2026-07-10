# JLMOps Bug Fix Sequence

**Date:** 2026-05-28. **Source:** `.claude/bugs.md` ## jlmops ### Open.

Sequenced by readiness (concrete fix shape → diagnosis needed → larger scope → audits). Each session is one focused unit of work. Sessions A–E each end with: commit → user OK → `clasp push` → user smoke → user OK → `deploy.ps1`.

**Progress 2026-07-10:** Sessions A–E and G shipped/resolved. Open: F (sync hardening, needs staging repro), H (timestamp/date-format audit), I (count-task creation audit).

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

## Sequencing notes

- Sessions A–C can run in any order. A is the biggest leverage (5 bugs / 1 session); B + C are diagnosis-first single-bug sessions.
- D depends on A.3 (archive coupon items mapping) landing first — both touch `ContactImportService.js`.
- E is self-contained.
- F depends on user-side staging repro.
- G is independent.
- H + I are audits, last because they produce change lists rather than fixes; their downstream fixes spawn additional sessions.

Recommend running A first to clear the deck of surgical fixes, then prioritizing among B-E based on user impact.
