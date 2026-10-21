# JLM Wines — Current Status

**Updated:** 2026-10-21. Israel-only checkout guard live; insert, What's in the Box post and FAQ in the library awaiting Evyatar's edits; Calendar tab date-edit/row-click/date-display plan reviewed and ready to build.

## At a glance

One current-state line per business area. The umbrella has no single phase label — each area carries its own state.

- **jlmops** (GAS backend) — live (current version in Metrics below); sync/calendar/coupons all recently hardened (`jlmops/docs/ARCHITECTURE.md`).
- **jlmwines.com** (storefront/theme) — live (current version in Metrics below); new-visitor offer popup, expanded Wine Talk categories, and the Israel-only checkout guard live; folk-art package images live EN/HE (HE alt text awaits manager translation); category tab-row UI not yet built (`website/BLOG_CATEGORIES_PLAN.md`).
- **content** — 12 editorial posts live (EN+HE), 3 of 6 region posts published; remaining regions and a Grapes guide anchor in active drafting (`content/plans/REGION_POSTS_PLAN.md`, `content/plans/ISRAELI_WINE_GUIDE_PLAN.md`).
- **marketing** — organic traffic rising, subscribers growing slowly; no paid ads running (`marketing/_resources/PAID_ADS_REFERENCE.md`); manager-led Thursday tastings are the current growth push (Next Action 3-4).
- **business** — strategy/brand docs current.

## Metrics

| Metric | Value |
|--------|-------|
| Last Active | 2026-10-21 |
| Revenue | Steady |
| Deploy Version | jlmops @584 · theme v1.2.32 |
| Deploy Date | jlmops 2026-10-18 · theme 2026-10-21 (Israel-only checkout guard, no version bump) |
| CRM Contacts | 548 enriched |
| Content | 12 editorial posts live (EN+HE); 2 in pipeline (Reds Guide, Whites Guide — awaiting editing + translation). |
| SEO | 87/100 (pre-mixed-content-fix audit). GSC feed live in `jlmops-status.md`. Growth plan: `plans/SEO_GROWTH_PLAN.md`; open items: `plans/RANKMATH_WPML_AUDIT.md`, `plans/SEO_AUDIT_2026-05-06.md`. |
| Open Bugs | See `.claude/bugs.md` + `jlmops/plans/BUG_FIX_SEQUENCE.md`. Open sessions: F, H, I. Code-audit fix sequence (Sessions K–U) done 2026-07-24; only server-side authorization remains, tracked separately. |
| Mobile PageSpeed | FCP ~3.5 / LCP ~4.2 (at baseline). Remaining lever: render-blocking pile (main.css critical-CSS + jQuery defer). |
| Desktop PageSpeed | EN FCP 0.7 / LCP 0.8 · HE FCP 0.7 / LCP 1.2 |
| Blockers | 0 |

## Next Action

The live "what now" — daily review reads these first.

1. **Monthly AYIW email** — September issue (`email-ayiw-2026-09`, "Making Wine - Harvest Time") EN+HE scheduled in Mailchimp 2026-10-13; HTML at `content/newsletter/2026-09/`. October EN draft saved in the Library folder `email-ayiw-2026-10` (2026-10-20), awaiting admin attach, lock and HE translation. AYIW is becoming a rolling diary post, "Vine, Barrel, Bottle" (`content/plans/VINEYARD_DIARY_PLAN.md`); waiting on whether Evyatar has photos.
2. **Branded shipping cartons — custom-printed plan canceled (2026-07-30); switched to natural brown cartons + a large logo stamp.** The original vendor's shipping cost for custom-printed cartons ran way over the cartons' own cost; after negotiating, that plan was dropped in favor of plain natural-brown cartons with the JLM mark large-stamped on. Size: 6-bottle cartons (user, 2026-10-21). Partner-owned. Track only: nudge in daily review; re-flag if the stamped cartons slip. No Claude action.
3. **Flyer advertising — Round 1 (Talbiye) done; Round 2 cancelled** (user, 2026-10-21): the website new-visitor popup + `50NEW` discount make another round unnecessary. Plan → `marketing/plans/FLYER_PLAN.md`.
4. **Thursday-evening in-shop tastings — manager-led, replacing Google Search Ads as the current growth push.** Tastings resume after a years-long gap, announced via organic social media (no paid ads). Seen as a boon for both shop and web. No plan doc yet.
5. **Server-side authorization program** — the code audit's one unresolved finding: `doGet` is a login gate, not an authorization boundary; the role-switcher is client-side only and no mutating endpoint re-checks caller role. Needs a dedicated `AUTHORIZATION_PLAN.md` (sketch in `jlmops/plans/CODE_AUDIT_FIX_SEQUENCE.md` Session R) — a program, not a quick session.
6. **Current focus (post-holidays, user 2026-10-15):** publish content (blog pipeline + monthly newsletter); update and verify products (verification flow, `jlmops/docs/WORKFLOWS.md`); add new wines to fill category gaps.
7. **Physical inventory — due now that the holidays have passed.** Full count sweep via Admin Inventory's count-task creation (full-sweep mode, batched alphabetically across sessions; design archived at `jlmops/plans/_archive/INVENTORY_COUNT_TASK_REDESIGN.md`). Counting is quantity-only.
8. **Coastal Plain (post 2026-10-29), Golan Heights (2026-11-16), and Judea/Foothills (2026-12-14) region posts, per JLMops_Publishing.** Coastal Plain and Golan Heights bodies drafted, awaiting the manager's Title+Body lock; Judea not drafted. Negev, Galilee, and Central Mountains are published. Sources, slot table, and calendar-row state → `content/plans/REGION_POSTS_PLAN.md`.
9. **Grapes anchor post** ("Grape Varieties in Israel") — drafted through Image Prompts + Notes at `content/grapes/grapes-en.post.md`, facts verified. Not yet registered in the library or flagged to anyone. Individual grape spoke posts deferred per `content/plans/ISRAELI_WINE_GUIDE_PLAN.md`'s sequencing decision.
10. **Content chain scheduling — must get done, not yet designed.** "Set due date now" in the Create Content Tasks dialog dates every stage forward from today (each type's default deadline), which doesn't fit a chain. Wanted: dates worked back from the calendar goal date (publish/send), manager stages Mon-Wed only, warn and offer to compress when time is short. Blocked on realistic stage durations (the current defaults are too generous). Plan → `jlmops/plans/CONTENT_CHAIN_SCHEDULING_PLAN.md` (also holds the dialog's clear-all toggle and Translate-to-Manager).
11. **Packing slip insert → What's in the Box post → FAQ (in that order).** English copy for all three is in the library with calendar rows and tasks (FAQ includes its email); Evyatar edits, manager translates. Then a session builds the eight seasonal print templates and jlmops gets the Hebrew-date template picker. Plan → `website/PACKING_SLIP_EXPLAINER_PLAN.md`; FAQ still needs the Google reviews link.
12. **Vintage-drift smoke test** — fix deployed @528 (`jlmops/plans/VINTAGE_MISMATCH_SNAPSHOT_FIX_PLAN.md`); needs a live vintage change to occur naturally before it can be confirmed working (no way to manufacture the test condition). Also: the task open since 2026-07-18 still carries the old, pre-fix stale snapshot — user to correct/clear it directly.

## Active Plans

Plans with code partially shipped and open implementation steps remaining. Session-end must update this list — add when a plan starts mid-implementation, strike or remove when fully done.

- **Bug fix sequence** (`jlmops/plans/BUG_FIX_SEQUENCE.md`) — open: H (timestamps + date-format audit), I (count-task creation audit). Session F folded into the sync hardening plan below.
- **Sync hardening** (`jlmops/plans/SYNC_HARDENING_PLAN.md`) — single home for sync-pipeline work. All locking stages and Bug 2 are built, live, and running clean; open: Bugs 1 and 3 (need a live repro), Stage E's inside-lock re-check not yet exercised by a real collision, step 9 `JLMops_Logs` cleanup (queued behind Test Suite Tier 4).
- **Test suite extension** (`jlmops/plans/TEST_SUITE_EXTENSION_PLAN.md`) — Tiers 1-3 built, deployed (@566), and run live 2026-08-27: 54/54 passing (Tier 1 caught a real bug on first run, `evaluateCondition`'s boolean/zero coercion, fixed; Tier 2 caught and corrected a wrong plan claim — `_executeSchemaComparison` isn't I/O-free like its four siblings, it calls `ConfigService.getAllConfig()`, so only its guard path is tested). Only Tier 4 remains (I/O-heavy code, explicitly deferred, needs a mocking-layer decision).
- **City-classification removal** (`jlmops/plans/CITY_CLASSIFICATION_REMOVAL_PLAN.md`) — code + config fully removed and live @479+. Two manual admin steps remain: run `rebuildSysConfigFromSource()`, delete the `SysLkp_Cities` sheet tab.
- **Wine Talk blog categories** (`website/BLOG_CATEGORIES_PLAN.md`) — Wine Basics renamed + Regions category created live in WP, manifest wiring done (steps 1-2, 4). Deferred trigger fired 2026-07-06 (Negev published) — tab-row UI + `All` view (step 3) still not built; user dual-categorizing region posts under Wine Basics as an interim workaround in the meantime.
- **Calendar tab UX** (`jlmops/plans/CALENDAR_TAB_UX_PLAN.md`) — refresh bug open (doesn't refresh after "Apply Pending Updates"/"Create Content Tasks", root cause not found, needs a live repro). Planned and reviewed, not built: fix dates displaying one day early (`formatDate` uses UTC; prerequisite), row click as an explicit choice (drawer listing all tasks, bare for Doc-less rows, plus a Task button), admin-only publishing-date edit (no task shifting), and the Library/Deficiency running on `cal_Date` instead of obsolete `slb_TargetDate`.
- **Admin Inventory Comax file-link buttons** — re-implemented @508 by copying `AdminProductsView._renderFileActions`'s proven pattern (`containerId`/`fileUrl`/`fileName`) rather than restoring the version that broke. View-load confirmed clean live 2026-07-16. The buttons themselves (Open File/Copy Filename) are not yet tested — no active Comax export/confirmation task to test against; user will advise when one appears. Original failure's root mechanism was never found, so this is the safest available reimplementation, not a guaranteed fix. Same-shaped buttons on Detail Update/New Product export (`AdminProductsView.html`, same @489 commit) remain unverified but unaffected by this change.
- **Category data** — `SysCategories` is the live category authority (owner-curated, carries the WC category term ID). Product descriptions, CRM enrichment, and stock-deficiency/product-suggestion logic all read it through shared `ConfigService` lookups rather than scattered hardcoded maps. `SysLkp_Texts` still holds its now-superseded category rows, kept temporarily as a safety net during a production soak period before cleanup — see `jlmops/plans/CONFIG_COMPLIANCE_PLAN.md`.
- **Woo API push** (`jlmops/plans/WOO_API_PUSH_PLAN.md`) — live @526, date-created fix live @557. Export sheet carries category/attributes (each attribute a reviewable Value/Visible/Position triple)/manage-stock/qty/WC IDs/task-created-date; "Push via API" button on both export bars; both new-product and existing-product edit paths confirmed working live 2026-07-22. Push now also sets WooCommerce's `date_created` ("Published" date) from the originating task's creation date, fixing a gap where detail-update pushes never touched the product's date at all — not yet smoke-tested live. RankMath meta-description/focus-keyword push (item 8) deferred (manual for now, no urgency) — old manual copy/paste into Woo remains available as a fallback throughout.
- **Vintage-mismatch snapshot fix** (`jlmops/plans/VINTAGE_MISMATCH_SNAPSHOT_FIX_PLAN.md`) — live @528. `task.validation.vintage_mismatch` tasks no longer freeze Comax/Web data at creation time (the snapshot mechanism was showing/saving stale vintages, and captured the wrong field entirely — pre-drift `cpm_Vintage` instead of the incoming `cps_Vintage`); both creation paths (rule-based + verify-fail conversion) now rely on the existing live-read fallback. Not yet smoke-tested — needs a real vintage change to occur naturally. Add/Verification-fail-conversion tasks are unaffected and still snapshot.

## Current State

- **Sync workflow** — stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce); imports, exports, validation all working. Sync-state and job-queue writes are now concurrency-safe under the widget's 1s polling (`jlmops/docs/ARCHITECTURE.md` §2.5.4.1, live-verified 2026-08-27); a validation rule that errors is treated the same as one that fails (Bug 6), no longer a silent pass. Inventory-push job auto-retries transient server failures on just the still-failing rows, surfaces the real per-SKU failure reason instead of a generic status string, and Retry/Reset are guarded against double-submission; see `jlmops/docs/WORKFLOWS.md` §11.2, `jlmops/docs/ARCHITECTURE.md` §2.5.6.
- **Import system** — full Woo REST API pull (products + translations + orders); 30-day rolling window.
- **CRM enrichment** — 548 contacts with dual-language preferences; `campaign.received` backfill manual only (daily auto-wiring deferred). Plans → `jlmops/plans/CONTACT_MANAGER_PLAN.md`, `CRM_PLAN.md`.
- **Content Library** — entity/task model live (no auto-paired EN/HE entities, lazy entity creation on first Doc attach with title sourced from the spawning task's `cal_Name`, task-derived status everywhere, calendar-row-picker-only content creation). `PublishingView.html` (promoted from `LibraryView.html`) is the current UI: admin sees Calendar/Library/Campaigns/Projects tabs, manager sees Calendar/Tasks/Library, both with a "Create Content Tasks" entry point. Both Library and Calendar tabs show a Slug column for connection diagnosis. Library tab's paired EN/HE rows: each language's status pill carries its own doc-open link, and mobile viewports stack columns into labeled rows. System doc → `jlmops/docs/DATA_MODEL.md`, `jlmops/docs/WORKFLOWS.md` §13; drafting/placement procedure → `jlmops/plans/CONTENT_CREATION_CHECKLIST.md`.
- **Calendar tab UX** — row click opens the entity drawer before advancing to a task; status filter and title-bar search box; all confirmed working (`jlmops/docs/WORKFLOWS.md` §13.1). Refresh-after-apply bug open (Active Plans above).
- **Campaign system** — data model + UI live (`SysMarketingCampaigns` + `SysShortUrls`, UTM/short-URL/QR); short URLs pasted manually (auto-push deferred). Plan → `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`.
- **Bundles** — implemented; plan graduated to system docs (`jlmops/docs/DATA_MODEL.md` "Bundle Management Data Model", `jlmops/docs/WORKFLOWS.md` §15) and archived (`jlmops/plans/_archive/BUNDLE_PLAN.md`). Maintain/Re-roll self-check their own result against the live deficiency test and record the real reason when a slot stays deficient. Composite scoring weights (`GENERATOR_WEIGHTS` in `BundleService.js`) remain a single global tunable, not yet split per-slot/per-bundle — UI redesign tracked separately in `jlmops/plans/ADMIN_BUNDLES_UI_PLAN.md`.
- **Ops↔session bridge** — OPS writes system-health (15-min) + KPI (daily) into `jlmops-status.md`; `/review-daily` reads it each run. Plan → `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md`.
- **Loyalty rewards Phase 1** — live @487. Manager's Orders screen shows tier/last-order/spend/avg per row (fetched separately from the order list so it doesn't delay load) plus a CRM link and a "Log Reward" note action; no automated eligibility rule, manager judges. Not yet smoke-tested live. Plan → `marketing/plans/REWARDS_PLAN.md`.
- **KPI Summary Tab** — live @440. All 6 `business/KPI.md` KPIs compute automatically: 4 jlmops-source ones (new customers EN/HE, first-order conversion+AOV, 90-day return rate, newsletter subscribers+engagement) via `SysKPISummary`, plus GA4 organic-traffic EN/HE split and organic-source engagement (bounce rate + pages/session) via a dedicated GA4 audience report. All surface in `jlmops-status.md`, no jlmops UI. Month-over-month trend surfacing also live (new customers, return rate, subscriber MoM vs. last closed month); months since 2026-08 closed naturally, so the return-rate/subscriber deltas no longer rest on the shared backfill snapshot (not separately re-verified). Schema/system doc → `jlmops/docs/DATA_MODEL.md` (`SysKPISummary`); engineering history archived at `jlmops/plans/_archive/KPI_SUMMARY_TAB.md`; known bugs → `.claude/bugs.md`.
- **View-loading indicator** — shell-level spinner next to the view title (`AppView.html`), extended into every admin/manager view's own mount-time data load(s), closing the 2026-06-10 wishlist ask. One deliberate exception: `AdminSyncView`'s widget (repeating status poller, not a one-time load; already has richer inline step-card feedback). `LibraryView.html` (superseded by `PublishingView`) was deleted 2026-07-24 as confirmed dead code.
- **Theme** — live v1.2.32; new-visitor offer popup (₪50-off coupon + WhatsApp + email signup, exit-intent/mobile-delay triggers) live, confirmed working EN/HE and desktop/mobile (`website/EXIT_INTENT_POPUP_PLAN.md`); Homepage Phase 2 (Gutenberg blocks) queued → `website/HOMEPAGE_BLOCKS_PLAN.md`.
- **Deploy tooling** — `deploy-theme.ps1` uses `curl` for FTPS transport (switched 2026-08-20 after .NET's `FtpWebRequest` started failing against SiteGround) and never writes a live filename directly (upload → byte-verify → atomic rename). See `.claude/bugs.md`.
- **Checkout Israel-shipping confirmation** — live (`inc/woocommerce.php` `shipping_israel_confirm` field). Country/postcode fields are hidden and hardcoded to IL, so there's no country signal to validate against; an always-shown required checkbox next to the shipping-phone field ("Shipping address and phone are both Israeli") gates submission on acknowledgment rather than validating phone format, since legitimate gift orders often start without a valid recipient number and get one via manual follow-up. Addresses foreign visitors entering a US address (country field can't be changed) whose orders then have to be manually cancelled. Shipping FAQ (`content/FAQ EN.md`, "Where do you deliver?") now spells out Israel-only shipping.

- **Content-library versioning** — attach-to-replace + supersede→`_archive` confirmed live (Decision 7 / Plan B). Not yet smoke-tested: the **Create-translation-text** button (HE translate task with an EN Doc → copies EN + prompt, attaches as HE current, old HE archived); a messy/mobile-pasted URL through the hardened id extraction; `runLibraryDuplicateReconcile` from the editor.
- **Correct Product Name tool** — live (Admin → Products → SKU Management → Correct Product Name); edits WebProdM/WebDetM name fields and logs to Recent SKU Updates. Not yet smoke-tested from /dev. Plan → `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
- **New-product Products-view UX** — live and smoke-tested; behavior in `jlmops/docs/WORKFLOWS.md` §14. The accept-time `WebXltM` HE-translation-row seed step was fixed after silently skipping since it was added; not yet confirmed on a real new-product accept.
- **Product verification** — live end-to-end and in normal use, including manager review and reverted-task admin handling. Counting is quantity-only; product facts (vintage etc.) belong to verification alone. System doc → `jlmops/docs/WORKFLOWS.md`.
- **Configuration-as-Data compliance** (`jlmops/plans/CONFIG_COMPLIANCE_PLAN.md`) — `SysCategories` consolidation, schema registrations, and a live miscategorization bug fix are shipped and live-verified. Only remaining step: removing `SysLkp_Texts`' now-unused category rows, deliberately held for a short production soak period (owner call, not a blocker).
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

_(none)_
