# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

One line per item: date + symptom + pointer to the plan doc holding the analysis, where one exists. The analysis itself lives in the plan doc, a git commit, or `.claude/session-log.md` — not here.

---

## jlmops

### Open

- [ ] 2026-07-24: Admin Dashboard's Tasks card (`_getAdminTasksList`) dumps every open task system-wide as a flat table with no summarization — 200+ rows, by design scoped to all tasks (not Admin-assigned only, confirmed intentional), but no grouping/counts make it useless at that size. Needs a real summary (counts by type/priority/overdue, or similar) instead of a raw list. Design decision on summary shape deferred — not yet scheduled into `CODE_AUDIT_FIX_SEQUENCE.md`.
- [ ] 2026-07-24: `ManagerDashboardView_v2.html`'s Projects card (`renderProjectsCard`) is fed by unfiltered `_getProjectSummaries`/`ProjectService.getAllProjects()` — includes `COMPLETED`/`ARCHIVED` projects alongside `ACTIVE`/`PLANNING`. Owner's view: projects aren't directly manipulated by either role day-to-day, so downgraded to low priority — revisit only if it becomes a real point of confusion.
- [ ] 2026-07-23: **`doGet`'s role check is a login gate, not an authorization boundary** — it only blocks unlisted "viewer" users; any listed user of any role gets the identical full SPA shell, `availableRoles` lists every role regardless of caller, and the role-switcher dropdown is 100% client-side (no server round-trip). A manager can click "Admin" in the UI and load real Admin screens + every mutating `google.script.run` endpoint elsewhere in the codebase (Product/Inventory, CRM/Campaigns, Library/Project — no server-side re-check exists anywhere). `jlmops/plans/CODE_AUDIT_PLAN.md` §9 (WebApp controllers pass); sequenced as Session R in `jlmops/plans/CODE_AUDIT_FIX_SEQUENCE.md` — scoped as its own program (needs a dedicated `AUTHORIZATION_PLAN.md`), not a quick fix.
- [ ] 2026-07-22: Woo API push's `attributes` array doesn't prune Region/Grape/Harmonize/Contrast on existing products — WooCommerce PUT doesn't full-replace `attributes` as assumed. Not urgent, owner OK'd leaving as-is. `jlmops/plans/WOO_API_PUSH_PLAN.md`.
- [ ] 2026-07-20: Admin Products "Correct Product Name" action (SKU Management) applies with no confirmation step first — risk of accidental edit. `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
- [ ] 2026-07-16: Dashboard "Schema Validation" indicator doesn't refresh when re-run from Admin Dev — only a nightly/manual housekeeping run updates the dashboard's cached status.
- [ ] 2026-07-16: "System Health Status" task's displayed date is frozen at original creation, not last-run — any view surfacing its Created Date misrepresents last-check time.
- [ ] 2026-07-16: Woo Orders integration heartbeat shows red every morning before ~08:00 IL — the staleness threshold isn't business-hours-aware like the pull cadence it's checking.
- [ ] 2026-07-09: Calendar tab doesn't refresh after "Apply Pending Updates" or "Create Content Tasks" — no defect found in code, needs a live repro. `jlmops/plans/CALENDAR_TAB_UX_PLAN.md` Phase 1.
- [ ] 2026-07-02: `ConfigService.loadConfig` silently drops the second (P03/P04) key-value pair for any non-schema setting — worked around for `ga4_audience_report`; systemic fix not done, other two-param entries unaudited.
- [ ] 2026-06-16: Product Replacement reads dead WebProdM columns (`wpm_WebIdEn`/`wpm_WebIdHe`) — not yet traced whether this breaks the reassign step or is cosmetic.
- [ ] 2026-06-14: Web inventory export sync-state race (concurrency, not the silent-loss leg — that's fixed). `jlmops/plans/RELIABILITY_AUDIT.md` §1.3.
- [ ] 2026-05-28: Mailchimp campaign sends not written to per-contact activity log — `pullRecentCampaigns` doesn't write `comm.campaign` rows to `SysContactActivity`.
- [ ] 2026-05-04: Sync state-machine hardening (bundle, 3 items pending staging repro). `jlmops/plans/SYNC_HARDENING_PLAN.md`.
- [ ] 2026-05-04: Audit timestamps + date formats system-wide (storage vs. display standardization). Future step, no plan doc yet.
- [ ] 2026-05-04: Audit on-demand count-task creation (dedupe + split data/count validation paths). Future step, no plan doc yet.

### Resolved (recent)

_One line each; full root-cause analysis lives in the git commit + `.claude/session-log.md`._

- [x] 2026-07-24: Code-audit fix sequence (`jlmops/plans/CODE_AUDIT_FIX_SEQUENCE.md`, Sessions K–U) — 21 of the audit's ~18 findings fixed and deployed (jlmops @530-@543), the rest folded in as found: `WebAppDashboardV2` wrong order/inventory fields + invented `newOrders` definition, `TaskService.updateTaskDates` false-failure, 3 SKU functions' retired `wxl_SKU` field, `WebXltM` positional-copy fix, `pa_CmxId` PK gap (3 functions), Campaign↔Project FK fix + broken project-side Campaign dropdown removed, `ManagerContactView` missing Direction control, Woo line-item cap now config-driven, `LibraryService.attachExistingDoc` ownership-check, `CrmIntelligenceService` winery field, `sc_DoNotContact` dead-check removed (no real suppression need per owner), `TaskDetail` Done-button content-task gating, `OrdersView` customer-note XSS, 6-view escaping consistency pass, `LibraryService` LockService (entity/file creation race), 12-modal `ModalOverlay` conversion, `HousekeepingService` skip-optimization field fix, `ContactEnrichmentService` batch-upsert, `TaskService`/`WebAppTasks` Drive-search→`SheetAccessor`. Plus dead-code deletion: `KpiService.js`/`WpmlService.js`/`CategoryService.js`/`PromotionsEngineService.js`/`WebAppDashboard.js`/`LibraryView.html` + a ~656-line duplicate import pipeline in `ProductService.js` + several orphaned widget-count functions. Only genuinely deferred: server-side authorization (Tier 3, its own program) and two Admin/Manager dashboard panels needing a real redesign (tracked above).
- [x] 2026-07-16: Publishing view Calendar tab crashed on load for both roles ("slug.slice is not a function") — `renderCalendar()`'s task loop had no content-type filter, so non-content tasks with numeric entityIds (exposed by the 2026-07-10 `_deriveEntityId` priority fix) reached `.slice()` unguarded. Fixed @509: loop now filters to `task.content.*` (matching `renderTasks()`); Calendar-tab error routing also fixed (was writing failures only to the Campaigns tab's container). Confirmed working live, both roles.
- [x] 2026-07-16: Admin Inventory failed to load live (Comax Sync card's file-link buttons) — reverted to pre-@489 state @507; root mechanism never found.
- [x] 2026-07-15: Manager product-editor slow load (15-18s) + submit/verify modal race — fixed @479-@482. `jlmops/docs/WORKFLOWS.md` §16.
- [x] 2026-07-15: New products triggered spurious `status_mismatch`/`translation_missing` warnings — fixed @490 (publish-status source filter).
- [x] 2026-07-15: Admin Tasks view showed SKU instead of product name for entity-linked tasks — fixed @491.
- [x] 2026-07-15: Product-editor still slow (10s) after Session J cache fix — new regression, uncached full `SysTasks` scan — fixed @495.
- [x] 2026-07-15: `WebAppTasks.getOpenTasks`'s "60-second cache" never worked (module-level var, cold every call) — fixed @496 (real `CacheService`).
- [x] 2026-07-15: `getManagerWidgetData` computed category-stock health live on every load (~13-15s) — moved to housekeeping cadence + cache @498.
- [x] 2026-07-14: Admin "Accept Suggestion" had no loading feedback on submit — fixed @484.
- [x] 2026-07-14: Admin/Manager Dashboard task-detail modal always showed assignee as unassigned — fixed @477.
- [x] 2026-07-10: "Failed jobs" health metric only reported oldest failure's age — fixed @476.
- [x] 2026-07-10: Admin Tasks/Publishing/Library task lists showed no/wrong SKU for product-topic validation tasks — fixed @468.
- [x] 2026-07-10: Admin Dashboard task-detail "Done" button appeared to do nothing — fixed @463 (missing `TaskWidgets.html` include).
- [x] 2026-07-06: `attachExistingDoc` never transferred Drive ownership to admin — resolved 2026-07-08.
- [x] 2026-07-06: Admin Bundles message strip never closed — fixed @441.
- [x] 2026-07-06: `createTranslationDraft`'s HE Doc copy unopenable by admin — fixed @442.
- [x] 2026-07-03: Unit-test suites' expected failures were logged into production SysLog, looking like real sync errors — fixed @440 (`LoggerService.setTestSuppression`).
- [x] 2026-06-24: Draft products flagged as unexpected by ops validation — fixed @368/@370/@371.
- [x] 2026-06-08: Admin Products view "Failed to load" (timeout) — fixed @273 (lazy-load redesign).
- [x] 2026-06-08: Admin Products no loading state on mount — fixed @271 (superseded by @273).
- [x] 2026-06-08: Accepted blank-`st_Status` tasks invisible — not reproducible, no action taken.
- [x] 2026-06-07: `task.order.packing_available` orphaned at 0 Ready — fixed @274.
- [x] 2026-06-04: Bundle price calc counted qty=0 as qty=1 — fixed @227/@230.
- [x] 2026-06-04: Sync view rendered literal include tag — fixed @223.
- [x] 2026-06-02: `task.order.packing_available` reads as overdue — demoted to no-due nudge.
- [x] 2026-06-01: Accepted tasks reappear as "New" after admin close — fixed @191.
- [x] 2026-06-01: Bundles view N+1 sheet reads (100s+ load) — fixed @228/@229.
- [x] 2026-05-29: Contact reconciliation false-positive on immaterial drift — fixed @201.
- [x] 2026-05-29: Brurya autocomplete "Argument too large" — fixed @169.
- [x] 2026-05-28: Contact summary aggregates ≠ order list — fixed @151/@152.
- [x] 2026-05-27: `validateDeployment` false positives / un-closeable — resolved 2026-06-03 (pinned-ID wrapper).
- [x] 2026-05-27: SKU Replacement leaves web-side orphans — fixed @148 (`Fix Orphan SKU` action; `webProductReassign` gap remains, tracked as an open item above).
- [x] 2026-05-17: No admin UI for lookup values — fixed @121.
- [x] 2026-05-15: `backfillOrderTotals` destructive — removed (no callers).
- [x] 2026-05-15: ManagerContactView search latency — fixed @165.
- [x] 2026-05-15: Admin Projects task delete leaves records — fixed @149.
- [x] 2026-05-12: Project task creation broken — fixed @90/@91/@92.
- [x] 2026-05-04: Comax export includes bundle parent SKU — verified already fixed; entry was stale.
- [x] 2026-05-04: CRM cleanup (bundle) — fixed @150.
- [x] 2026-03-10: Decanting field treats 0 as empty — manager can now pick "0".

### Resolved

- [x] 2026-05-04: 2026-02-09 manager orders view requires refresh to reload — verified in code, self-executing load + manual refresh button both present.
- [x] 2026-05-04: 2026-01-28 inventory count task — manager date / admin SKU+name — resolved (c1af348).
- [x] 2026-05-04: 2026-01-20 accepted inventory counts not appearing in Comax sync — resolved per user.
- [x] 2026-05-04: 2025-12-29 changed Woo coupon plugin auto-apply URL pattern — WON'T FIX.
- [x] 2026-05-04: 2025-12-29 new coupon plugin accepts comma-separated emails — N/A, plugin removed.
- [x] 2026-05-04: Gift detection keyword logic — WON'T FIX, simpler rule adopted.
- [x] 2026-05-04: War-support detection wrong field — N/A, feature retired.
- [x] 2026-01-26: Bundle export to Comax (inventory) — fixed (bundleSkus filter).
- [x] 2026-01-20: Brurya days showing 999 — resolved 2026-01-23.
- [x] 2026-05-12: Brurya days showing 999 recurred — structural fix @93 (SysConfig rebuild no longer wipes runtime-mutable keys). `jlmops/plans/TECH_DEBT_AUDIT.md` §5.2.
- [x] 2025-12-29: Packing slips bundle count — verified, PrintService excludes bundle products.
- [x] 2025-12-23: Sync confirmation button not appearing after order export.
- [x] 2025-12-23: Need confirmation dialog before confirming sync steps.
- [x] 2025-12-23: Sync importing full order history (832 orders).
- [x] 2025-12-23: Missing task type `task.data.review`.
- [x] 2025-12-23: ActivityBackfillService exceeds maximum execution time.
- [x] 2025-12-18: Manager order view missing billing/shipping names.
- [x] 2025-12-17: Sync step 4 shows validation status briefly.
- [x] 2025-12-17: Sync lacks final confirmation completion update.
- [x] 2025-12-15: Bundle products incorrectly flagged for Comax comparison.

## web

### Open

- [ ] 2026-06-16: Gift + accessory descriptions blanked on jlmwines.com — restored text must land in WebDetM `wdm_DescriptionEn/He`, not just the live site, or the next overlay re-blanks it.
- [ ] 2026-05-11: Auto-push short URL redirects to RankMath (deferred) — manual paste acceptable at current volume (5-10/month); build trigger noted.

### Resolved

- [x] 2026-07-01: Homepage tracked as two separate URLs in GSC — investigated, redirect confirmed correct; residual index history, not a live bug.
- [x] 2026-05-11: Mixed-content HTTP images on EN+HE homepages — fixed 2026-07-01 (9 images across both pages).
- [x] 2026-05-08: Removed "Magnums" product category — shipped 2026-05-18.
- [x] 2026-05-11: WC admin SKU display + search gone — resolved in theme v1.2.20 (hide-SKU filter gated to `!is_admin()`).
- [x] 2026-05-03: deploy-theme.ps1 didn't delete orphan files — fixed (orphan detection + delete).

## marketing

### Open

(none)

### Resolved

- [x] 2026-06-22: PublishingView Calendar showed library entities as holiday-style rows — resolved via `CALENDAR_LIBRARY_LOOP_PLAN`.

## content

(none)
