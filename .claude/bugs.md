# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

### Open

- [ ] 2026-07-12: **Manager product-editor loads take 15-18s.** Original cause (CacheService failing 100% of the time on WebDetM/CmxProdM/WebProdM, >100KB-per-value limit) fixed @469 — but 2026-07-13 smoke test found total open time unchanged even with confirmed cache hits. Real cause found 2026-07-14: `getProductDetails` calls three lookup helpers (`_getCachedRegions`/`_getCachedGrapes`/`_getCachedKashrut`) whose "cache" never survives across separate `google.script.run` calls, so each of the 3 fell through to `LookupService.getLookupMap`'s slow path — a Drive-wide filename search (`DriveApp.getFilesByName`) instead of the fast ID-based open every other sheet access uses, done 3x per load. **Fix shipped @482** — both call sites in `LookupService.js` now reuse `SheetAccessor.getDataSpreadsheet()`. Not yet smoke-tested live for actual load-time improvement. Analysis → `jlmops/plans/BUG_FIX_SEQUENCE.md` Session J.

- [ ] 2026-07-12: **Manager submit/verify modal gets stuck on "Submitting…"/spinner; image and fields silently swap to a different product; opening the next verification showed stale data from the previous one.** Root cause was not the original "never reaches server" framing — `SysLog` confirmed server-side success in at least one occurrence with the modal still stuck. One debugging arc, three sequential fixes: **@479** — `openEditor()` had no guard against re-entry while a submit/verify/revert call was in flight, letting a second task load silently overwrite the shown modal without resetting the original button (in-flight flag + defensive button reset). **@480** — live smoke-test of @479 surfaced a second, distinct load-vs-load race in `openEditor()`'s own data fetch, fixed via a `_loadToken` guard. **@481** — @480 didn't resolve the stale-data report either; the actual persistent cause was `loadVerifyDetail()` only clearing the image/category/flags panel after the slow load resolved, not synchronously on open. Same deploy restored "Done & Next" auto-advance on verification submit (relabeled to avoid recreating the @208 label mismatch). All three shipped; not yet confirmed clean by a full live smoke pass. Analysis → `jlmops/plans/BUG_FIX_SEQUENCE.md` Session J.

- [ ] 2026-07-09: **Calendar tab doesn't refresh after actions that change its state.** Confirmed for two triggers: "Apply Pending Updates" and "Create Content Tasks." Investigated 2026-07-09 (`jlmops/plans/CALENDAR_TAB_UX_PLAN.md` Phase 1) — client refresh calls and server reads/writes all traced clean, no defect found in the code; needs a live repro to go further, not more static reading.

- [x] 2026-07-03: **Unit-test suites deliberately feed adapters malformed input to verify error handling, but the adapters' own `logger.error()` calls wrote those expected failures into the production `SysLog`** — surfaced in `jlmops-status.md`'s "Recent errors" as if last night's Comax/Woo product import had broken (`SCHEMA MISMATCH: Comax file has 3 columns`, `Input CSV is missing required headers: Stock`), when in fact `ComaxAdapterTest.js`/`WebAdapterTest.js` were correctly exercising `ComaxAdapter.processProductCsv`/`WebAdapter.processProductCsv`'s reject-malformed-input paths (`Unit tests: 15/15` passing = working as intended). No real file, no real import failure, no data corruption — confirmed the same day's real interactive Comax sync applied real inventory changes with no warnings. **Fixed @440:** added `LoggerService.setTestSuppression(on)` (still logs to the Apps Script execution log via `console.log`, just skips the `SysLog` sheet write while suppressed); `TestRunner.runAllTests()` wraps its suite loop in suppress-on/suppress-off (`finally`-guarded) so any current or future test suite gets this for free without touching the adapters themselves.

- [ ] 2026-07-02: **`ConfigService.loadConfig` silently drops the second (P03/P04) key-value pair for any non-schema setting.** `ConfigService.js` only parses P03/P04 (row[5]/row[6]) into the config object when the setting name starts with `schema.data.` or `schema.log.` — for every other setting (including all `system.*` two-param entries like `id`/`data_tab` pairs), only P01/P02 (row[3]/row[4]) loads; the second pair is silently ignored. Discovered building the GA4 audience-report reader: `system.sheet.ga4_audience_report`'s `data_tab` never resolved, `cfg.data_tab` was always `undefined`. The sibling `system.sheet.ga4_report` entry has the identical two-param shape and appeared to work purely by luck — `StatusReportService._readGa4` has a `if (!sheet) sheet = ss.getSheets()[0]` fallback, and "JLM GA4 Weekly" happens to be that workbook's first tab, so it's been silently reading the fallback sheet, never actually resolving `data_tab`, this whole time. **Worked around for now:** split `ga4_audience_report` into two single-param entries (`ga4_audience_report_id` + `ga4_audience_report_tab`), matching what `ConfigService` actually supports. **Real fix (not done):** extend `loadConfig`'s P03/P04 parsing to all settings, not just `schema.data.*`/`schema.log.*` — additive change (currently-ignored data would just start loading), but touches shared config-loading code every setting depends on, so treat as its own careful pass. Worth checking whether any *other* existing two-param non-schema entries are also silently missing their second value.

- [x] 2026-06-24: **Draft products flagged as unexpected by ops validation.** Fixed @368 (rule 17 gated to `wpm_PostStatus=publish`) + @370 (accept modal now requires Woo Post ID so WebProdM is always seeded with a real `wpm_ID` — eliminates the empty-key row that `clearContent` wiped on every sync). @371: `cpm_IsWeb` also set at accept time (was only in retired hotlink).

- [ ] 2026-06-16: **Product Replacement reads dead WebProdM columns — examine + repair if needed.** `ProductService.searchWebProducts` and `lookupProductBySku` do `indexOf('wpm_WebIdEn')`/`indexOf('wpm_WebIdHe')` on WebProdM, but the live sheet (confirmed against 2026-06-16 export) has no such columns — EN post id is `wpm_ID`, HE post id is WebXltM `wxm_ID`. So both reads return `-1` → blank `webIdEn`/`webIdHe`. Visible symptom: Product Replacement panel "Web IDs" line (`AdminProductsView.html:1105/1113`) shows empty. STATUS lists Product Replacement as "tested, working", so the swap may run off SKU and the blanks be cosmetic — OR the sheets were restructured after that test. NOT yet traced through the actual reassign step (`webProductReassign` takes `webProductId`); trace whether the blanks break the swap or are harmless display before fixing. Related to latent note at the @148 resolved entry ("webProductReassign still misses some sheets").

- [ ] 2026-06-14: **Web inventory export silently dropped — "no changes" reported while a real CSV was created** (SERIOUS, data-loss class; confirmed in SysLog 7:50:01–7:50:46). Concurrency lost-update on `system.sync.state`: `exportWebInventory` created `Inv-Web-06-14-07-50.csv` with real stock/price changes, but a concurrent `setSyncState`/triple `_checkAndAdvanceSyncState` clobbered `webExportFilename`; `generateWebExportBackend` re-read empty → declared no changes → COMPLETE → orphaned the file (user applied it by hand). **Silent-loss leg FIXED + DEPLOYED @289 2026-06-14** (`RELIABILITY_AUDIT.md` §1.4 — caller branches on the return value + clobber detector; pending live smoke). **Underlying race still open** → §1.3 (LockService + atomic read-modify-write + idempotent advance).



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

- [x] 2026-07-10: "Failed jobs" health metric reported only the oldest failure's age, no way to see a job that just failed → @476. `checkFailedJobs()` now also computes `newestAgeDays`; surfaced in the daily health-status task and `StatusReportService._dataQualityBlock`.
- [x] 2026-07-14: Admin Dashboard + Manager Dashboard task-detail modal always showed the assignee dropdown as "- Unassigned -" regardless of actual assignee → @477. Same root cause as the 2026-07-14 `AdminProductsView.html` fix: `TaskDetail.html`'s assignee `<select>` is built entirely from the host view's `getAssignees()` list, and both dashboards had it stubbed to `return [];` — with no options to match against, the real `assignedTo` value never rendered. Fixed both to return the canonical `['Administrator', 'Manager']` role list. Audited the other 4 `TaskDetail`-wired views (`AdminTasksView`, `LibraryView`, `PublishingView`, `AdminProductsView`) — all already return real values, no further instances.
- [x] 2026-07-03: `SysKPISummary.sk_Period` closed-month values silently converted to Date objects by Sheets, breaking the string dedup match on any re-run of an already-closed month → @476. `_upsertRow` now sets the `sk_Period` cell to plain-text format before writing; both comparison sites (`_upsertRow` dedup, `closeMonth` prior-month lookup) normalize Date-typed cells via a new `_asPeriodKey` helper. Bonus: this also fixes MoM subscriber-growth calc, which silently failed for any already-closed prior month via the same bug.
- [x] 2026-07-10: Admin Tasks/Publishing/Library task lists showed no SKU (or the wrong id) for product-topic validation tasks (e.g. "Comax Name Changed") → @468. `WebAppLibrary._deriveEntityId` checked `st_ProjectId` before `st_LinkedEntityId`; any task type auto-routed to a project (e.g. topic "Products" → `PROJ-SYS_PRODUCT`) had its real linked entity (the SKU) silently discarded in favor of the project id. Swapped priority — linked entity always wins, project id is a last-resort fallback only.
- [x] 2026-07-10: Admin Dashboard task-detail "Done" button appeared to do nothing → @463. `AdminDashboardView_v2.html` used `TaskPacks`/`TaskDetail` (and called `TaskWidgets.toast` directly) without including `TaskWidgets.html` itself — the only view doing so. `TaskWidgets.confirm()`'s popup depends entirely on a CSS class defined in that include; without it the dialog rendered unstyled and out of flow, invisible without scrolling. Fixed by adding the missing include, matching every other `TaskDetail`-consuming view.
- [x] 2026-06-01: Bundles view N+1 sheet reads (100s+ load) → @228/@229 (ctx hoist + transitive caller fix). `PERFORMANCE_OPTIMIZATION_PLAN.md` "Bundles Health Check" section.
- [x] 2026-07-06: `attachExistingDoc` never transferred Drive ownership to admin → resolved 2026-07-08 (`file.setOwner(adminEmail)` added generally, `createTranslationDraft` now relies on it). `jlmops/docs/DATA_MODEL.md` Content Library §"Doc ownership vs. folder placement".
- [x] 2026-07-06: Admin Bundles message strip never closed, always visible even empty on load → @441. Root cause: `#bundle-mgmt-msg` combined an inline `style="display:none"` with Bootstrap's `.d-flex` utility class, whose `display: flex !important` always won over any `style.display` toggle (open or close). Fixed by moving the flex layout out of the class into inline style and toggling `display` between `'none'`/`'flex'` with no competing `!important` class.
- [x] 2026-07-06: `createTranslationDraft`'s HE Doc copy owned by whoever clicked the button (manager), unopenable by admin → @442. Root cause: `executeAs: USER_ACCESSING` means `DriveApp...makeCopy()` is owned by the accessing user; `attachExistingDoc`'s later `file.moveTo` only reparents the file, never transfers access. Fixed by adding `copy.setOwner(TaskService.getUserByRole('admin'))` right after the copy is made. Forward-looking only — does not retroactively fix already-created docs (the existing Negev-HE doc still needs a manual share from the manager). The same gap remains open in the generic `attachExistingDoc` path (see Open, above).
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

- [ ] 2026-05-11: **Auto-push short URL redirects to RankMath** (deferred) — Campaign Service generates short codes and writes to `SysShortUrls`, but RankMath redirect rules are created manually in wp-admin. Acceptable at low volume (5–10 URLs/month). Build trigger: when monthly volume makes manual paste a real friction. Implementation: small WP mu-plugin exposing `POST /wp-json/jlmops/v1/redirect` that writes to `wp_rank_math_redirections` directly; jlmops `_pushToRankMath` in `MarketingCampaignService.js` calls it. RankMath's own `/wp-json/rankmath/v1/updateRedirection` is not usable — it only attaches redirects to existing WP objects, not arbitrary source paths.

### Resolved

- [x] 2026-07-01: **Homepage tracked as two separate URLs in Search Console** — investigated: `curl -I http://jlmwines.com/` confirmed a clean single-hop 301 → `https://jlmwines.com/` (200, no further redirect) — HTTPS enforcement itself is correct and has been for a while. The GSC split is residual index history from before the redirect existed / before Google fully consolidated, not a live technical gap. `http://www.jlmwines.com/` takes an extra hop (http→https on www, then a second hop dropping www) — minor, not broken. Investigation led directly to the real, bigger bug below.

- [x] 2026-05-11: **Mixed-content HTTP images on EN + HE homepages — FIXED 2026-07-01.** Original ticket undersold the scope: it wasn't one image on the HE homepage, it was **9 images referenced via `http://` on both homepages** (EN Page 9019 `home-elegant`, HE Page 64199), each in 2 sizes — `value-speical-sq`, `value-reds-sq-1`, `value-white-and-rose-sq-1`, `value-premium-sq`, `shabbat-shalom`, `cheese-please-02`, `al-ha-aish`, `red-wine-lover`, `evyatar-cohen-10.png`. Fixed via WP REST API: protocol-only string replace (`http://jlmwines.com/wp-content/uploads/` → `https://`) on both pages' content, leaving the unrelated `http://www.w3.org/2000/svg` namespace strings untouched. Verified zero remaining `http://` image refs both in the saved content and on the live public pages (no cache issue).

- [x] 2026-05-08: **Remove "Magnums" product category — SHIPPED 2026-05-18.** Magnums not actually in bundles (earlier framing was wrong); just gifts-page section + category term. Template fix `4b630c9` deployed via v1.2.26 FTP push; EN+HE `product_cat` term pair + WPML translation deleted by user same day.

- [x] 2026-05-11: **WC admin SKU display + search gone.** RESOLVED in theme v1.2.20. Root cause: `inc/woocommerce.php:22` used `add_filter('wc_product_sku_enabled', '__return_false')` to hide SKU from customer-facing pages, but the filter is global — it also killed the admin product-list column, admin search-by-SKU, and the SKU field on the product edit screen. Fix: gate the callback on `!is_admin()` so SKU stays visible in admin while remaining hidden on the storefront.

- [x] 2026-05-03: deploy-theme.ps1 didn't delete orphan files. RESOLVED: added `Delete-File` helper + orphan detection (manifest keys absent from local tree). Script now reports orphan count in the deploy header and deletes per file with retry; FTP 550 (already gone) treated as success.

## marketing

### Open

(none)

### Resolved

- [x] 2026-06-22: PublishingView Calendar shows library entities as holiday-style rows → resolved as a side effect of `CALENDAR_LIBRARY_LOOP_PLAN` (2026-07-07/08): `_loadHolidays()` now reads a dedicated `system.calendar.sheet_id` holidays sheet, not `JLMops_Publishing`; `refreshCalendarExport()` (the wipe-and-rebuild that caused the duplication) was replaced (`WebAppSystem.js:589`).

## content

(none)
