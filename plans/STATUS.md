# JLM Wines — Current Status

**Updated:** 2026-07-17. jlmops @511 live, stable; view-loading spinner now covers every admin/manager view's own data load, closing the 2026-06-10 wishlist ask; Manager Inventory counts screen + bulk Sheet export both stripped of the leftover read-only Vintage/Product-Page columns; Woo API push (descriptions/category/brand/attributes) fully scoped and reviewed at `jlmops/plans/WOO_API_PUSH_PLAN.md`, not started; deep review completed, Product Verification confirmed live/tested and its STATUS pointer corrected to the archived plan.

## At a glance

One current-state line per business area. The umbrella has no single phase label — each area carries its own state.

- **jlmops** (GAS backend) — live, stable (current version in Metrics below); 2026-07-14/15 fixes smoke-tested and confirmed clean (`jlmops/plans/BUG_FIX_SEQUENCE.md`, `.claude/bugs.md`, `jlmops/docs/WORKFLOWS.md` §16).
- **jlmwines.com** (storefront/theme) — live (current version in Metrics below); Wine Talk category taxonomy expanded (Wine Basics + Regions live in WP), tab UI pending first region post.
- **content** — 11 editorial posts live (EN+HE); region-post series and a Grapes guide anchor in active drafting (`content/REGION_POSTS_PLAN.md`, `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`).
- **marketing** — flyer printed, distributing to Talbiye after 9 Av; newsletter cadence current (July print out, AYIW email drafting); calendar filled through December.
- **business** — strategy/brand docs current.

## Metrics

| Metric | Value |
|--------|-------|
| Last Active | 2026-07-17 |
| Revenue | Steady |
| Deploy Version | jlmops @511 · theme v1.2.31 |
| Deploy Date | jlmops 2026-07-17 · theme 2026-07-09 |
| CRM Contacts | 548 enriched |
| Content | 11 editorial posts live (EN+HE); 2 in pipeline (Reds Guide, Whites Guide — awaiting editing + translation). |
| SEO | 87/100 (pre-mixed-content-fix audit). GSC feed live in `jlmops-status.md`. Growth plan: `plans/SEO_GROWTH_PLAN.md`; open items: `plans/RANKMATH_WPML_AUDIT.md`, `plans/SEO_AUDIT_2026-05-06.md`. |
| Open Bugs | See `.claude/bugs.md` + `jlmops/plans/BUG_FIX_SEQUENCE.md`. Open sessions: F, H, I, J. |
| Mobile PageSpeed | FCP ~3.5 / LCP ~4.2 (at baseline). Remaining lever: render-blocking pile (main.css critical-CSS + jQuery defer). |
| Desktop PageSpeed | EN FCP 0.7 / LCP 0.8 · HE FCP 0.7 / LCP 1.2 |
| Blockers | 0 |

## Next Action

The live "what now" — daily review reads these first.

1. **July newsletter — print already in distribution (track only).** End-of-July AYIW email (`ayiw-2026-07`) content in progress — finish drafting and send before month end. August AYIW (`ayiw-2026-08`, target send 2026-09-08) also prepped 2026-07-09: calendar row merged, Doc placed at canonical Library path — ready for admin to attach/spawn when convenient.
2. **Branded shipping cartons — art confirmed with vendor; arrival date unknown.** Partner-owned. Track only: nudge in daily review; re-flag if production/delivery slips. No Claude action.
3. **Flyer advertising — printed; distribution delayed until after the 9 Av fast day, likely last week of July, to 5,000 Talbiye residences.** Vendor-owned execution. Plan → `marketing/FLYER_PLAN.md`. Coupon rides the offline-attribution scheme (Inbox, `defer:2026-08-10`).
4. **Ongoing operational cadence** (continuous): update products; validate web product data + image accuracy (`jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`); add products to fill category gaps; publish regularly (blog pipeline + monthly newsletter).
5. **Galilee region post (Slot B, due 2026-08-11, see `content/REGION_POSTS_PLAN.md`)** — in progress; drafted + registered in the library (`blog-region-galilee-en`, state `draft`).
6. **Central Mountains region post (Slot C) — body drafted through Image Prompts, 2026-07-09.** Calendar row staged (`blog-region-central-mountains`, cal_Date 2026-08-25, pending "Apply Pending Updates"); Drive doc placed at the canonical library path (`blog-region-central-mountains-en 26-07-09-12-05`); git source at `content/regions/central-mountains/central-mountains-en.post.md`. Remaining: winery verification (Gvaot/Tura not yet confirmed against JLM's carried wineries), Canva images, HE translation, library registration, WP push — same checklist as Galilee (`content/REGION_POSTS_PLAN.md`).
7. **Grapes anchor post** ("Grape Varieties in Israel") — drafted through Image Prompts + Notes at `content/grapes/grapes-en.post.md`, facts verified. Not yet registered in the library or flagged to anyone. Individual grape spoke posts deferred per `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`'s sequencing decision.

## Active Plans

Plans with code partially shipped and open implementation steps remaining. Session-end must update this list — add when a plan starts mid-implementation, strike or remove when fully done.

- **Bug fix sequence** (`jlmops/plans/BUG_FIX_SEQUENCE.md`) — Sessions A–E, G, and J (product-editor load time + manager submit/verify hang, plus the follow-on product-detail load-performance work) resolved and smoke-tested clean. Still pending: F (sync hardening — 3 items, needs staging repro), H (timestamps + date-format audit), I (count-task creation audit).
- **City-classification removal** (`jlmops/plans/CITY_CLASSIFICATION_REMOVAL_PLAN.md`) — code + config fully removed and live @479+. Two manual admin steps remain: run `rebuildSysConfigFromSource()`, delete the `SysLkp_Cities` sheet tab.
- **Wine Talk blog categories** (`website/BLOG_CATEGORIES_PLAN.md`) — Wine Basics renamed + Regions category created live in WP, manifest wiring done (steps 1-2, 4). Deferred trigger fired 2026-07-06 (Negev published) — tab-row UI + `All` view (step 3) still not built; user dual-categorizing region posts under Wine Basics as an interim workaround in the meantime.
- **Calendar tab UX** (`jlmops/plans/CALENDAR_TAB_UX_PLAN.md`) — Phases 2–4 (click-through shows entity details before a task, status filter, search repositioned) shipped live 2026-07-09 @461. Phase 3 (status filter) smoke-tested and confirmed working; Phases 2 and 4 still unsmoked. Phase 1 (refresh doesn't fire after "Apply Pending Updates"/"Create Content Tasks") investigated, root cause still open — needs a live repro.
- **Admin Inventory Comax file-link buttons** — re-implemented @508 by copying `AdminProductsView._renderFileActions`'s proven pattern (`containerId`/`fileUrl`/`fileName`) rather than restoring the version that broke. View-load confirmed clean live 2026-07-16. The buttons themselves (Open File/Copy Filename) are not yet tested — no active Comax export/confirmation task to test against; user will advise when one appears. Original failure's root mechanism was never found, so this is the safest available reimplementation, not a guaranteed fix. Same-shaped buttons on Detail Update/New Product export (`AdminProductsView.html`, same @489 commit) remain unverified but unaffected by this change.
- **Publishing view Calendar-tab crash** — fixed @509 2026-07-16, confirmed working live both roles. `renderCalendar()`'s task-grouping loop had no content-type filter (unlike `renderTasks()`), so non-content tasks with numeric entityIds — exposed by the 2026-07-10 `_deriveEntityId` priority fix — reached `.slice()` unguarded and crashed the whole view. Also fixed: `_loadCampaignsAndProjects()`'s failure path now clears the Calendar tab's own container, not just the Campaigns tab's. See `.claude/bugs.md`.

## Current State

- **Sync workflow** — stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce); imports, exports, validation all working.
- **Import system** — full Woo REST API pull (products + translations + orders); 30-day rolling window.
- **CRM enrichment** — 548 contacts with dual-language preferences; `campaign.received` backfill manual only (daily auto-wiring deferred). Plans → `jlmops/plans/CONTACT_MANAGER_PLAN.md`, `CRM_PLAN.md`.
- **Content Library** — entity/task model live (no auto-paired EN/HE entities, lazy entity creation on first Doc attach with title sourced from the spawning task's `cal_Name`, task-derived status everywhere, calendar-row-picker-only content creation). `PublishingView.html` (promoted from `LibraryView.html`) is the current UI: admin sees Calendar/Library/Campaigns/Projects tabs, manager sees Calendar/Tasks/Library, both with a "Create Content Tasks" entry point. Both Library and Calendar tabs show a Slug column for connection diagnosis. System doc → `jlmops/docs/DATA_MODEL.md`, `jlmops/docs/WORKFLOWS.md` §13; drafting/placement procedure → `jlmops/plans/CONTENT_CREATION_CHECKLIST.md`.
- **Calendar tab UX** — row click now opens the entity drawer (details) before advancing to a task, plus a status filter (not started/in progress/done/no tasks yet) and a search box repositioned into the title bar. Live @461 (2026-07-09). Status filter smoke-tested and confirmed working 2026-07-09; click-through and search placement not yet smoke-tested. Refresh after "Apply Pending Updates"/"Create Content Tasks" still doesn't fire on the client — investigated, no defect found in code, needs a live repro. Plan/investigation → `jlmops/plans/CALENDAR_TAB_UX_PLAN.md`.
- **Campaign system** — data model + UI live (`SysMarketingCampaigns` + `SysShortUrls`, UTM/short-URL/QR); short URLs pasted manually (auto-push deferred). Plan → `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`.
- **Bundles** — implemented; plan graduated to system docs (`jlmops/docs/DATA_MODEL.md` "Bundle Management Data Model", `jlmops/docs/WORKFLOWS.md` §15) and archived (`jlmops/plans/_archive/BUNDLE_PLAN.md`). Maintain/Re-roll now self-check their own result against the live deficiency test and record the real reason when a slot stays deficient, deployed jlmops @470 2026-07-13, confirmed fixing bundles a prior Maintain run had left stuck. Composite scoring weights (`GENERATOR_WEIGHTS` in `BundleService.js`) remain a single global tunable, not yet split per-slot/per-bundle — UI redesign tracked separately in `jlmops/plans/ADMIN_BUNDLES_UI_PLAN.md`.
- **Ops↔session bridge** — OPS writes system-health (15-min) + KPI (daily) into `jlmops-status.md`; `/review-daily` reads it each run. Plan → `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md`.
- **Loyalty rewards Phase 1** — live @487. Manager's Orders screen shows tier/last-order/spend/avg per row (fetched separately from the order list so it doesn't delay load) plus a CRM link and a "Log Reward" note action; no automated eligibility rule, manager judges. Not yet smoke-tested live. Plan → `marketing/REWARDS_PLAN.md`.
- **KPI Summary Tab** — live @440. All 6 `business/KPI.md` KPIs compute automatically: 4 jlmops-source ones (new customers EN/HE, first-order conversion+AOV, 90-day return rate, newsletter subscribers+engagement) via `SysKPISummary`, plus GA4 organic-traffic EN/HE split and organic-source engagement (bounce rate + pages/session) via a dedicated GA4 audience report. All surface in `jlmops-status.md`, no jlmops UI. Month-over-month trend surfacing also live (new customers, return rate, subscriber MoM vs. last closed month) — but the return-rate/subscriber deltas aren't trustworthy until a month closes naturally (next: 2026-08-01), since all 6 backfilled months share one retroactive snapshot; new-customers deltas are trustworthy now. Schema/system doc → `jlmops/docs/DATA_MODEL.md` (`SysKPISummary`); engineering history archived at `jlmops/plans/_archive/KPI_SUMMARY_TAB.md`; known bugs → `.claude/bugs.md`.
- **View-loading indicator** — shell-level spinner next to the view title (`AppView.html`), extended into every admin/manager view's own mount-time data load(s), closing the 2026-06-10 wishlist ask. Two deliberate exceptions: `AdminSyncView`'s widget (repeating status poller, not a one-time load; already has richer inline step-card feedback) and `LibraryView.html` (superseded by `PublishingView`, not in live navigation).
- **Theme** — live v1.2.31; Homepage Phase 2 (Gutenberg blocks) queued → `website/HOMEPAGE_BLOCKS_PLAN.md`.
- **Checkout Israel-shipping confirmation** — live (`inc/woocommerce.php` `shipping_israel_confirm` field). Country/postcode fields are hidden and hardcoded to IL, so there's no country signal to validate against; an always-shown required checkbox next to the shipping-phone field ("Shipping address and phone are both Israeli") gates submission on acknowledgment rather than validating phone format, since legitimate gift orders often start without a valid recipient number and get one via manual follow-up. Addresses foreign visitors entering a US address (country field can't be changed) whose orders then have to be manually cancelled. Shipping FAQ (`content/FAQ EN.md`, "Where do you deliver?") now spells out Israel-only shipping.

- **Content-library versioning** — attach-to-replace + supersede→`_archive` confirmed live (Decision 7 / Plan B). Not yet smoke-tested: the **Create-translation-text** button (HE translate task with an EN Doc → copies EN + prompt, attaches as HE current, old HE archived); a messy/mobile-pasted URL through the hardened id extraction; `runLibraryDuplicateReconcile` from the editor.
- **Correct Product Name tool** — live (Admin → Products → SKU Management → Correct Product Name); edits WebProdM/WebDetM name fields and logs to Recent SKU Updates. Not yet smoke-tested from /dev. Plan → `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
- **New-product Products-view UX** — shipped, archived, and smoke-tested/validated by the user 2026-07-09 (`jlmops/plans/_archive/NEW_PRODUCT_WORKFLOW_UX_PLAN.md`); current behavior documented in `jlmops/docs/WORKFLOWS.md` §14. Accept Suggestion modal field order (EN name → Woo Post ID → HE name) and its required Comax "Sold Online" confirmation checkbox smoke-tested 2026-07-10. Closes the smoke-test gate the PROJ-CONTENT Inbox item was waiting on.
- **Product verification** — fully shipped end-to-end, live, tasks executing in normal use (confirmed 2026-07-17). Manager review surface + reverted-task admin handling (Close / Pass to manager / Task-modal edit-note-and-close-normally) live and smoke-tested. Count-flow strip also complete — Manager Inventory's Counts tab no longer does inline vintage/comment editing or spawns `vintage_mismatch` tasks (that's now verification-only). The read-only Vintage/Product-Page-link columns the 2026-07-14 strip had deliberately kept "for orientation" were removed too, live @510 2026-07-17 — counting stays quantity-only, product facts belong to verification alone, both on the live screen (`ManagerInventoryView.html`) and the bulk-entry Sheet export (`WebAppInventory.exportCountsToSheet`). Facts graduated to `jlmops/docs/WORKFLOWS.md`; plan archived at `jlmops/plans/_archive/PRODUCT_VERIFICATION_PLAN.md`.
- **Product-detail load performance** — live and smoke-tested clean. Product-editor tasks (add/vintage-drift/verify-conversion) read a creation-time snapshot instead of live sheets; the verify batch-walk bulk-prefetches once at walk-start instead of per step; category-stock health is computed by housekeeping and cached, not live on widget load; `WebAppTasks.getOpenTasks` is genuinely cached now (was a module-level variable that never persisted across calls). System doc → `jlmops/docs/DATA_MODEL.md` (`st_DetailSnapshot`), `jlmops/docs/WORKFLOWS.md` §16; plans archived (`jlmops/plans/_archive/PRODUCT_DETAIL_SNAPSHOT_PLAN.md`, `_archive/VERIFY_DETAIL_SPEEDUP_PLAN.md`).
- **SKU management** — Vendor SKU Update and Trim Safety not yet tested; Product Replacement tested and working, though its product search reads dead WebProdM columns (`.claude/bugs.md`).
- **Admin Inventory** — live and confirmed working @508, Comax Sync file-link buttons re-implemented per Active Plans above (view-load confirmed clean; buttons themselves pending a live export to test against). Server-side error isolation for the review/manager-queue cards still isn't read by the client.
- **UI T4.3 count-entry modal** — shipped, unsmoked; verify on a phone when count tasks next appear.
- **`st_DoneDate` set without `st_Status='Done'`** — at least one Manager-assigned row carries a done date while still Assigned, so it surfaces as open. Watch whether the pattern spreads; if so, fix the write path or the dashboard filter.
- **Manager-dashboard pack types** — contact / confirmation / content-publish packs still unexercised (no such tasks have appeared yet); smoke each type's actions when one next shows up.

## Known Issues

1. Consider auto-cleanup of rows below the data range during upsert.
2. Gutenberg editor width doesn't match the Elementor front-end (accepted limitation — use Preview or API-push workflow).

## Blocked / Deferred

- **Year in Wine PDF** — needs PDF-generation research.
- **Woo API push (descriptions, category, brand, attributes)** — fully scoped plan at `jlmops/plans/WOO_API_PUSH_PLAN.md` (2026-07-17), not started. Folds in the former "Woo Brand + GTIN structured-data enrichment" item (brand now pushes via WC's native Brand field, not a custom attribute). Sequencing open: this is catalog/ops infrastructure, not one of the acquisition-period's named channels — build now vs. queue behind acquisition work is an open call. Once built, extends to carry upsell/cross-sell values (separate later plan).
- **Gift recipient campaigns** — lowest priority.
- **VIP recognition + referral program** — after campaigns launch.

## Review Cadence

Periodic business-health checks — a session-review checklist, not automated.

**Weekly** (any session touching jlmops or website): new orders since last check; new customers (EN vs HE split); open bugs / failed syncs in SysLog; spot-check live site (homepage, a product page, cart).

**Monthly** (first session of the month):

- *Customers & revenue* — new vs returning ratio; EN/HE split trend; AOV drift; top-seller shifts.
- *SEO & content* — GSC indexing / crawl errors / duplicate flags; canonical tags on new/changed products; blog-post traffic; thin/duplicate product copy.
- *Marketing* — campaigns sent vs planned; list health (bounces, unsubscribes, growth); comeback-campaign progress; new referral sources.
- *Technical* — sync reliability (30-day failures); PageSpeed (mobile + desktop); Woo API pull errors/timing; open-bug count.

## Inbox

_**Before adding:** bug? → `.claude/bugs.md`. Idea/feature? → `.claude/wishlist.md`. Operational pending task? → Next Action. Item with a plan doc? → that doc. Only cross-project notes or pending-decision items belong here._

### Active

_(none)_

### Deferred

- **Offline-channel attribution scheme** `defer:2026-08-10` — newsletter attribution confirmed, including QR-code tracking specifically (not just tagged links). Flyer distribution now expected last week of July (post-9-Av); defer date allows ~2 weeks post-drop to smoke results before reviewing naming convention + QR/coupon setup.
