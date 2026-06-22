# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

### Open

- [ ] 2026-06-22: **Draft products flagged as unexpected by ops validation.** New product workflow introduces WooCommerce draft products (staging step before publish); validation/reconciliation logic treats any product not in ops data as unexpected. Rule should apply to published products only — drafts should be exempt. Find and gate the unexpected-product check on `post_status = 'publish'` (or equivalent status field in WebProdM/WebProdS).

- [ ] 2026-06-16: **Product Replacement reads dead WebProdM columns — examine + repair if needed.** `ProductService.searchWebProducts` and `lookupProductBySku` do `indexOf('wpm_WebIdEn')`/`indexOf('wpm_WebIdHe')` on WebProdM, but the live sheet (confirmed against 2026-06-16 export) has no such columns — EN post id is `wpm_ID`, HE post id is WebXltM `wxm_ID`. So both reads return `-1` → blank `webIdEn`/`webIdHe`. Visible symptom: Product Replacement panel "Web IDs" line (`AdminProductsView.html:1105/1113`) shows empty. STATUS lists Product Replacement as "tested, working", so the swap may run off SKU and the blanks be cosmetic — OR the sheets were restructured after that test. NOT yet traced through the actual reassign step (`webProductReassign` takes `webProductId`); trace whether the blanks break the swap or are harmless display before fixing. Related to latent note at the @148 resolved entry ("webProductReassign still misses some sheets").

- [ ] 2026-06-14: **Web inventory export silently dropped — "no changes" reported while a real CSV was created** (SERIOUS, data-loss class; confirmed in SysLog 7:50:01–7:50:46). Concurrency lost-update on `system.sync.state`: `exportWebInventory` created `Inv-Web-06-14-07-50.csv` with real stock/price changes, but a concurrent `setSyncState`/triple `_checkAndAdvanceSyncState` clobbered `webExportFilename`; `generateWebExportBackend` re-read empty → declared no changes → COMPLETE → orphaned the file (user applied it by hand). **Silent-loss leg FIXED + DEPLOYED @289 2026-06-14** (`RELIABILITY_AUDIT.md` §1.4 — caller branches on the return value + clobber detector; pending live smoke). **Underlying race still open** → §1.3 (LockService + atomic read-modify-write + idempotent advance).

- [ ] 2026-06-11: **Task→project routing incomplete — some auto-created tasks resolve to no real project** (violates the "every task belongs to a project" design rule). Gaps: `Content` topic (16 task types) maps to `PROJ-CONTENT`, which was never seeded in `SysProjects`; `Marketing` (15) and `Data` (2) topics have no map entry → blank `st_ProjectId`. (`Custom` is not a gap — `WebAppTasks` requires the user to pick a project.) **Decided fix (user, 2026-06-11):** (1) seed `PROJ-CONTENT` as a real *user-managed* project — `ProjectService.createProject({projectId:'PROJ-CONTENT', name:'Content', type:'OPERATIONAL', status:'ACTIVE', startDate:'2026-06-11'})`; plain id, NOT `PROJ-SYS_`, so it stays user-deletable (the `PROJ-SYS_` prefix blocks deletion). The UI can't set a custom id, so run the call from the editor. (2) Add map entry `Marketing → PROJ-CONTENT` (fold marketing into content for now). (3) Re-topic the two `Data` tasks per domain: `task.data.review` (new-cities lookup) `Data→CRM` (→ `PROJ-SYS_CRM`); `task.data.coupons_update` (coupons reminder) `Data→Marketing` (→ `PROJ-CONTENT`). The `Data` topic then retires. Mechanics: edit `taskDefinitions.json` topics + `system.json` `task.routing.topic_to_project` → `node generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()` + run the seed. Analysis → `jlmops/docs/WORKFLOWS.md` §12.0.

- [ ] 2026-06-01: **`WebAppBundles_getViewData` takes 100s+ to load the Bundles view.** Root cause is an N+1 in `BundleService.getBundlesWithLowInventory` (`BundleService.js:830`). After a sane bulk setup (bundles/slots/CmxProdM/on-hold/WebProdM read once), its per-bundle → per-slot loop calls `getEligibleProducts(slot.slotId, …)` (`:920`) once per low-stock slot, and **each call re-reads whole sheets from scratch** — full `WebProdM` (`getDataRange().getValues()`, `:683`), full `WebDetM` when the slot has intensity/complexity/acidity criteria (`:696`), and a full `_loadSlots()` reload (`:718`). Cost scales with (low-stock slots × full-sheet reads), GAS's slowest op → 100s+. Everything those calls re-read is invariant within one `getBundlesWithLowInventory` run. Only N+1 caller is the `:920` loop; the interactive editor path (`AdminBundlesView.html:1059` → `WebAppBundles_getEligibleProducts`) is single-shot. **Fix plan:** `jlmops/plans/PERFORMANCE_OPTIMIZATION_PLAN.md` → "Bundles Health Check — N+1 Sheet Reads". Surfaced 2026-06-01 by user; previously noted in STATUS as "bundles slow on mobile (server-side low-inventory compute, not round-trips)".


- [ ] 2026-05-28: **Mailchimp campaign sends not written to per-contact activity log.** `CampaignService.pullRecentCampaigns()` (runs daily via `performDailyMaintenance`) pulls campaign-level aggregates (recipients, opens, clicks, bounces, ecommerce) and upserts the campaign sheet — but does NOT iterate per-recipient and write `comm.campaign` rows to `SysContactActivity`. Result: contact activity timeline shows order events + lifecycle changes + pending-payment auto-emails, but a campaign recipient has no record on their own activity log that they received the send. The `comm.campaign` activity type exists as a concept (used as pre-seeded value in segment-export CSVs for post-send manual fill — `CampaignService.js:890-895`) but the automated per-recipient write was deferred when Manager CRM Half 1 shipped (STATUS queued item: "campaign-recipient activity rows on contacts (post Half 1)"). Fix shape: when `pullRecentCampaigns` upserts a campaign, also pull Mailchimp's recipient list endpoint (`/reports/{id}/sent-to` or `/campaigns/{id}/content` + audience lookup), iterate, and write one `ContactService.createActivity({sca_Email, sca_Type: 'comm.campaign', sca_Summary: <campaign title>, sca_Details: {campaignId, sendDate}})` per recipient. Idempotency by (campaignId, email) to avoid duplicates on re-pull. Consider rate-limiting / pagination — popular campaigns have 500+ recipients.

- [ ] 2026-05-04: **Sync state-machine hardening** (bundle). Tracked in `jlmops/plans/SYNC_HARDENING_PLAN.md`. Status:
  - Generate web export button visible/clickable before the action can fire (orig 2026-01-28) — pending staging repro; backend looks clean
  - Export button stays visible after export step starts (orig 2025-12-29) — pending staging repro; backend looks clean
  - Sync widget doesn't show Comax product import stage when order export is skipped without a refresh (orig 2025-12-31) — pending staging repro; backend looks clean
  - **Generate button stays after export completes — file is generated and named, but button doesn't reset (orig 2026-03-17). FIX DEPLOYED 2026-05-05 as @80** — root cause was stuck-`PROCESSING` job in SysJobQueue (zombie killer only ran on hourly trigger, not polls). Inline reaper added to `_checkAndAdvanceSyncState` for all three async stages (IMPORTING_COMAX, VALIDATING, GENERATING_WEB_EXPORT) with 8-min threshold. Stuck spinner now caps at ~8 min instead of up to 60.
  - **Failed Comax import recovery — RESOLVED.** Verified 2026-05-28 Session A: `WebAppSync.js:646-647` has the `IMPORTING_COMAX → WAITING_COMAX_IMPORT` special case alongside the `PUSHING_WEB_INVENTORY → WAITING_WEB_CONFIRM` precedent. Fix matches the originally-planned shape. Bug entry was stale — fix had been applied but never marked done.

- [ ] 2026-05-04: **Audit timestamps + date formats system-wide** (folds in 2025-12-26 task-creation Israel-time bug + 2026-01-21 inconsistent date display). Walk every place dates/times are stored or rendered: task creation, sync log, order export, dashboard, manager/admin views. Standardize on Israel time for storage and 3-letter-month universal format for display ("21 Jan 2026"). Future step, not urgent.

- [ ] 2026-05-04: **Audit on-demand count-task creation** (folds in 2025-12-26 master/detail dedupe check). Walk the path that creates verification count tasks: confirm no duplicates, confirm correct-user assignment, and split data-validation tasks from count-validation tasks so they run as separate paths (don't require a count to do a data review). Future step.

### Resolved (recent)

_One line each; full root-cause analysis lives in the git commit + `.claude/session-log.md`._

- [x] 2026-06-08: Admin Products view "Failed to load" (getAdminViewData timeout) → @273 lazy-load redesign (mount loads only Card 1; Cards 2-4 lazy on expand).
- [x] 2026-06-08: Admin Products no loading state on mount → @271 spinner paint (superseded by @273 lazy-load).
- [x] 2026-06-08: Accepted blank-`st_Status` tasks invisible → NO ACTION (not reproducible; root cause already fixed 2026-06-01, orphans cleared, user confirmed none exist).
- [x] 2026-06-07: `task.order.packing_available` orphaned at 0 Ready → @274 (`processStagedOrders` closes at sync drain + one-shot `reconcilePackingAvailableTask()`).
- [x] 2026-06-04: Bundle price calc counted qty=0 as qty=1 → @227 calc fix + @230 three slot-write `||1` guards (BUNDLE_PLAN Stage 0).
- [x] 2026-06-04: Sync view rendered literal `<?!= include('TaskWidgets') ?>` → @223 (moved include to template-evaluated `AdminSyncView` line 1).
- [x] 2026-06-02: `task.order.packing_available` reads as overdue → demoted to no-due nudge (`due_pattern: manual`, per PACKING_SLIP_REPRINT_PLAN).
- [x] 2026-06-01: Accepted tasks reappear as "New" after admin close → @191 (`confirmWebUpdates` now passes `'Done'` to `updateTaskStatus`).
- [x] 2026-05-29: `reconciliation.sys_contacts.write_verify` High on immaterial drift → @201 self-heal (zero aggregates for contacts absent from the qualifying union). Relates to RELIABILITY_AUDIT Tier 3.4.
- [x] 2026-05-29: Brurya autocomplete "Argument too large" → @169 (dropped duplicate lowercase fields + try/catch around `cache.put`).
- [x] 2026-05-28: Contact summary aggregates ≠ order list → @151/@152 (archive-merge in `updateContactsFromOrders` + `syncRecentOrderActivity` for the timeline).
- [x] 2026-05-27: `validateDeployment` false positives / un-closeable → resolved at root 2026-06-03 (pinned-ID wrapper; detector removed; orphans undeployed). RELIABILITY_AUDIT §2.1.
- [x] 2026-05-27: SKU Replacement leaves web-side orphans → @148 new `Fix Orphan SKU` action. (Latent: `webProductReassign` still misses some sheets — deferred.)
- [x] 2026-05-17: No admin UI for lookup values → @121 Card 4 (Grapes/Kashrut/Texts), LOOKUP_ADMIN_UI_PLAN.
- [x] 2026-05-15: `backfillOrderTotals` destructive → removed (no callers).
- [x] 2026-05-15: ManagerContactView search latency → @165 load-once + client filter (closes BUG_FIX_SEQUENCE Session G).
- [x] 2026-05-15: Admin Projects task delete leaves records → @149 atomic bulk `WebAppTasks_deleteTasks`.
- [x] 2026-05-12: Project task creation broken → @90/@91/@92 (registered `task.project.custom`, added `WebAppTasks_createTask`, fixed modal + whitelist).
- [x] 2026-05-04: Comax export includes bundle parent SKU → verified already fixed (`OrderService` bundleSkus filter); entry was stale.
- [x] 2026-05-04: CRM cleanup (bundle) → @150 (war-support dead code removed; gift rule + correction script verified in place).
- [x] 2026-03-10: Decanting field treats 0 as empty → manager can now pick "0" (customer render still hides on 0).

### Resolved

- [x] 2026-05-04: 2026-02-09 manager orders view requires refresh to reload → verified in code: `ManagerOrdersView.html:172-174` self-executes `loadPackingSlipsData()` + `loadOpenOrdersData()` on view render, plus manual Refresh Orders button.
- [x] 2026-05-04: 2026-01-28 inventory count task — manager date / admin SKU+name → admin view shows Date/SKU/Name (c1af348, 2026-03-09); manager-view date column declared not needed.
- [x] 2026-05-04: 2026-01-20 accepted inventory counts not appearing in Comax sync → resolved per user.
- [x] 2026-05-04: 2025-12-29 changed Woo coupon plugin auto-apply URL pattern → WON'T FIX. Auto-apply coupons not worth UX downsides (silent application, URL-sharing leaks). Marketing emails surface the code as plain text instead.
- [x] 2026-05-04: 2025-12-29 new coupon plugin accepts comma-separated emails → N/A. Coupon plugin removed; first-purchase restriction is native theme code.
- [x] 2026-05-04: Gift detection keyword logic → WON'T FIX. Simpler rule decided (different shipping address + note ⇒ gift); folded into CRM cleanup verification.
- [x] 2026-05-04: War-support detection wrong field → N/A. Feature retired; remove dead code in CRM cleanup.
- [x] 2026-01-26: Bundle export to Comax (inventory) → bundleSkus filter added to generateComaxInventoryExport().
- [x] 2026-01-20: Brurya days showing 999 → RESOLVED 2026-01-23. Code fix was correct, SysConfig row had empty value from pre-fix runs, manually set scf_P02.
- [x] 2026-05-12: Brurya days showing 999 recurred → root cause identified + STRUCTURAL FIX shipped 2026-05-12 as @93. The recurrence was triggered by `rebuildSysConfigFromSource()` clearing the SysConfig sheet (intended) and overwriting predeclared rows back to empty (unintended for runtime-written values). Eight runtime-mutable keys were vulnerable to the same wipe, including the live `system.sync.state` JSON. @93 wraps the rebuild with snapshot + restore around the destructive write. User manually restored the April 14 timestamp post-deploy; future rebuilds will preserve runtime values automatically. See `TECH_DEBT_AUDIT.md §5.2` — this addresses it.
- [x] 2025-12-29: Packing slips bundle count → VERIFIED. PrintService.js excludes bundle products.
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

- [ ] 2026-06-16: **Gift + accessory descriptions blanked on jlmwines.com** — the ops description overlay wrote empty descriptions onto non-wine SKUs (no tasting attributes → formatter emits empty, and nothing stored in WebDetM). Originals found in old files; user restoring manually. **Recurrence prevention:** restored text must land in WebDetM `wdm_DescriptionEn/He` (the formatter inserts that freeform field verbatim — verified `WooCommerceFormatter.js:213`), not just the live WC site, else the next overlay re-blanks it.

- [ ] 2026-05-11: **Mixed-content HTTP image on HE homepage** — `http://jlmwines.com/wp-content/uploads/2023/04/value-speical-sq-599x599.jpg` referenced in homepage Page #64199 (HE). Triggers Chrome "does not support secure connection" warning in private/incognito (HTTPS-Only Mode is stricter there). Fix: locate the image reference in the Page content and change to `https://` (or protocol-relative `//`). Slated AFTER WPML translation verification.

- [ ] 2026-05-11: **GTIN structured-data enrichment** (deferred, separate from SKU admin issue) — populating `Product.gtin` would improve product schema (currently emits `pa_winery` / `pa_complexity` taxonomy slugs). Requires Comax-side source check + new column in `CmxProdM` + `WebDetM` + WC push path + GTIN-8/12/13/14 checksum validator. Policy: only write when value passes validation; never store false GTIN data. Same dependency profile as the cross-sell deferral.

- [ ] 2026-05-11: **Auto-push short URL redirects to RankMath** (deferred) — Campaign Service generates short codes and writes to `SysShortUrls`, but RankMath redirect rules are created manually in wp-admin. Acceptable at low volume (5–10 URLs/month). Build trigger: when monthly volume makes manual paste a real friction. Implementation: small WP mu-plugin exposing `POST /wp-json/jlmops/v1/redirect` that writes to `wp_rank_math_redirections` directly; jlmops `_pushToRankMath` in `MarketingCampaignService.js` calls it. RankMath's own `/wp-json/rankmath/v1/updateRedirection` is not usable — it only attaches redirects to existing WP objects, not arbitrary source paths.

### Resolved

- [x] 2026-05-08: **Remove "Magnums" product category — SHIPPED 2026-05-18.** Magnums not actually in bundles (earlier framing was wrong); just gifts-page section + category term. Template fix `4b630c9` deployed via v1.2.26 FTP push; EN+HE `product_cat` term pair + WPML translation deleted by user same day.

- [x] 2026-05-11: **WC admin SKU display + search gone.** RESOLVED in theme v1.2.20. Root cause: `inc/woocommerce.php:22` used `add_filter('wc_product_sku_enabled', '__return_false')` to hide SKU from customer-facing pages, but the filter is global — it also killed the admin product-list column, admin search-by-SKU, and the SKU field on the product edit screen. Fix: gate the callback on `!is_admin()` so SKU stays visible in admin while remaining hidden on the storefront.

- [x] 2026-05-03: deploy-theme.ps1 didn't delete orphan files. RESOLVED: added `Delete-File` helper + orphan detection (manifest keys absent from local tree). Script now reports orphan count in the deploy header and deletes per file with retry; FTP 550 (already gone) treated as success.

## marketing

### Open

- [ ] 2026-06-22: **PublishingView Calendar shows library entities as holiday-style rows.** `_loadHolidays()` loads ALL rows from JLMops_Publishing (including entity rows written by `refreshCalendarExport()`). Those entity rows then appear as grey/italic non-clickable rows alongside real holidays, duplicating the live entity rows already loaded from SysLibrary. Fix: `_loadHolidays()` should filter to `cal_Type = 'holiday'` (and 'blackout', 'note') only — not entity rows.

## content

(none)
