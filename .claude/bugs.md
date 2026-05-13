# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

### Open

- [ ] 2026-05-04: **Comax order export includes bundle parent SKU** — should export bundle members only.
  - Diagnosis (2026-05-13): `WebOrdItemsM` contains parent rows because `WooOrderPullService._transformLineItems` copies every line item from the Woo API unfiltered (parents + children). `OrderService.exportOrdersToComax` then aggregates from that sheet with no bundle filter. Prior bundle fixes lived elsewhere — `PrintService.js` (packing slips, 2025-12-29) and `InventoryManagementService.generateComaxInventoryExport` (Comax inventory export, 2026-01-26); the order export missed both passes. **First-fix, not recurrence** — git log on `OrderService.js` shows no `bundleSkus` / `TaxProductType` / `woosb` reference ever.
  - Fix shape: build `bundleSkus` Set from WebProdM where `wpm_TaxProductType` ∈ {`woosb`, `bundle`} (same pattern as `InventoryManagementService.js:875–892`); skip rows in the aggregation loop at `OrderService.js:359–368` with `if (bundleSkus.has(sku)) continue;`.

- [ ] 2026-05-04: **Sync state-machine hardening** (bundle). Tracked in `jlmops/plans/SYNC_HARDENING_PLAN.md`. Status:
  - Generate web export button visible/clickable before the action can fire (orig 2026-01-28) — pending staging repro; backend looks clean
  - Export button stays visible after export step starts (orig 2025-12-29) — pending staging repro; backend looks clean
  - Sync widget doesn't show Comax product import stage when order export is skipped without a refresh (orig 2025-12-31) — pending staging repro; backend looks clean
  - **Generate button stays after export completes — file is generated and named, but button doesn't reset (orig 2026-03-17). FIX DEPLOYED 2026-05-05 as @80** — root cause was stuck-`PROCESSING` job in SysJobQueue (zombie killer only ran on hourly trigger, not polls). Inline reaper added to `_checkAndAdvanceSyncState` for all three async stages (IMPORTING_COMAX, VALIDATING, GENERATING_WEB_EXPORT) with 8-min threshold. Stuck spinner now caps at ~8 min instead of up to 60.
  - Failed Comax import can't recover when a corrected file is uploaded — state stays stuck (orig 2026-03-17).
    - Diagnosis (2026-05-13): `WebAppSync.retryFailedStepBackend` (`WebAppSync.js:641-645`) sets `state.stage = failedAtStage`, so a failed `IMPORTING_COMAX` → Retry → goes back to `IMPORTING_COMAX` (a processing state with no upload UI). User has no path to swap in the corrected CSV. Precedent for the right pattern already exists at the same site: `PUSHING_WEB_INVENTORY` failure drops back to the **pre-fork user-action stage** `WAITING_WEB_CONFIRM` instead of back to itself.
    - Fix shape: add a second special case in `retryFailedStepBackend` so `IMPORTING_COMAX` failure drops back to `WAITING_COMAX_IMPORT` (which has the upload UI). Single elif. `VALIDATING` failures intentionally stay at `failedAtStage` (different recovery pattern — fix data in sheets, not re-upload).

- [ ] 2026-05-04: **CRM cleanup** (bundle). Reconciled with `jlmops/plans/CRM_PLAN.md` simplified rule (2026-04-30 revision) on 2026-05-13. The simplified rule supersedes the older 12-step plan and changes what's actually on the table:
  - **`sc_IsCore` defaulting conflict** — **STRUCK**. Per CRM_PLAN.md §271-273: under the simplified rule, defaulting `sc_IsCore` to TRUE for customers IS the correct answer; the only override is the gift-only case. Not a bug anymore.
  - **War-support dead code removal** — **DEMOTED to optional cleanup**. Per CRM_PLAN.md §265-269: don't fix the classification — war-support purchasers will age into Lapsed → Dormant naturally. The detection code in `ContactImportService.js` becomes dead code over time; safe to remove as a separate housekeeping pass, but not required.
  - **Archive mapping missing `CouponItems` field** — **STILL REAL** (CRM_PLAN.md §372-381 Bug 4). `woma_CouponItems` is not mapped from archive orders into `wom_CouponItems` during import. Fix shape: add `mappedRow[womIdx['wom_CouponItems']] = row[womaIdx['woma_CouponItems']];` to the archive mapping loop in `ContactImportService.js` (~line 89-104).
  - **Wire up the simplified gift-detection rule** — per CRM_PLAN.md §255-263. Single-order gift = (different shipping address) AND (delivery keyword in customer note). Customer is `noncore.gift` only when this fires for **every** one of their orders. Needs code in `ContactService._isGiftOrder()` and the import path in `ContactImportService.js`.
  - **One-time correction script** — per CRM_PLAN.md §275-281. After the simplified rule lands in code, run a one-time pass that re-evaluates every customer with the new gift rule; sets `noncore.gift` where every order qualifies, everything else → core. War-support category left alone (consistent with the "self-resolving" decision).

  Net remaining work: 3 items (archive mapping fix, wire gift rule, run correction script) + 1 optional housekeeping (delete war-support detection code).

- [ ] 2026-05-04: **Audit timestamps + date formats system-wide** (folds in 2025-12-26 task-creation Israel-time bug + 2026-01-21 inconsistent date display). Walk every place dates/times are stored or rendered: task creation, sync log, order export, dashboard, manager/admin views. Standardize on Israel time for storage and 3-letter-month universal format for display ("21 Jan 2026"). Future step, not urgent.

- [ ] 2026-05-04: **Audit on-demand count-task creation** (folds in 2025-12-26 master/detail dedupe check). Walk the path that creates verification count tasks: confirm no duplicates, confirm correct-user assignment, and split data-validation tasks from count-validation tasks so they run as separate paths (don't require a count to do a data review). Future step.

- [ ] 2026-03-10: **Decanting field treats 0 as empty** — system should accept zero as a valid decanting value (some wines legitimately need no decanting), not treat it as skippable/missing. Migrated from STATUS.md inbox 2026-05-07.

- [x] 2026-05-12: **Project task creation doesn't work as intended** — RESOLVED 2026-05-12 across @90/@91/@92. Root cause was multi-layer: (a) the modal called `WebAppTasks_createTask` which did not exist in the backend at all — silently failed; (b) the modal lacked the fields the data model expects (assignee, dates, topic); (c) after @90 added the call and fields, the project dropdown wrote `p.id` (undefined → empty value attribute via `esc(undefined)`); (d) the manager dashboard hardcoded a task-type whitelist that excluded `task.project.custom`. Fixes: registered `task.project.custom` in `taskDefinitions.json` with `flow_pattern: manual` + `due_pattern: manual`; extended `TaskService.createTask` to accept per-call overrides for topic/priority/status/dueDate/assignedTo; added `WebAppTasks_createTask` and `WebAppTasks_getAssignableUsers`; expanded the modal (project/topic/assignee/dates); fixed the project dropdown field-name pattern; added `task.project.custom` to manager dashboard whitelist with `st_Topic`-based topic resolution.

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

- [ ] 2026-05-08: **Remove "Magnums" product category** — magnums being phased out of inventory. Sequence: (1) remove magnums from gift bundle composition, (2) verify no magnums remain in gift slots or other bundles, (3) delete the WC `product_cat` term (EN + HE WPML pair). Coordinate with inventory fill-in work in progress.

- [ ] 2026-05-11: **Mixed-content HTTP image on HE homepage** — `http://jlmwines.com/wp-content/uploads/2023/04/value-speical-sq-599x599.jpg` referenced in homepage Page #64199 (HE). Triggers Chrome "does not support secure connection" warning in private/incognito (HTTPS-Only Mode is stricter there). Fix: locate the image reference in the Page content and change to `https://` (or protocol-relative `//`). Slated AFTER WPML translation verification.

- [ ] 2026-05-11: **GTIN structured-data enrichment** (deferred, separate from SKU admin issue) — populating `Product.gtin` would improve product schema (currently emits `pa_winery` / `pa_complexity` taxonomy slugs). Requires Comax-side source check + new column in `CmxProdM` + `WebDetM` + WC push path + GTIN-8/12/13/14 checksum validator. Policy: only write when value passes validation; never store false GTIN data. Same dependency profile as the cross-sell deferral.

- [ ] 2026-05-11: **Auto-push short URL redirects to RankMath** (deferred) — Campaign Service generates short codes and writes to `SysShortUrls`, but RankMath redirect rules are created manually in wp-admin. Acceptable at low volume (5–10 URLs/month). Build trigger: when monthly volume makes manual paste a real friction. Implementation: small WP mu-plugin exposing `POST /wp-json/jlmops/v1/redirect` that writes to `wp_rank_math_redirections` directly; jlmops `_pushToRankMath` in `MarketingCampaignService.js` calls it. RankMath's own `/wp-json/rankmath/v1/updateRedirection` is not usable — it only attaches redirects to existing WP objects, not arbitrary source paths.

### Resolved

- [x] 2026-05-11: **WC admin SKU display + search gone.** RESOLVED in theme v1.2.20. Root cause: `inc/woocommerce.php:22` used `add_filter('wc_product_sku_enabled', '__return_false')` to hide SKU from customer-facing pages, but the filter is global — it also killed the admin product-list column, admin search-by-SKU, and the SKU field on the product edit screen. Fix: gate the callback on `!is_admin()` so SKU stays visible in admin while remaining hidden on the storefront.

- [x] 2026-05-03: deploy-theme.ps1 didn't delete orphan files. RESOLVED: added `Delete-File` helper + orphan detection (manifest keys absent from local tree). Script now reports orphan count in the deploy header and deletes per file with retry; FTP 550 (already gone) treated as success.

## marketing

(none)

## content

(none)
