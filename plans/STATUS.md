# JLM Wines — Current Status

**Updated:** 2026-07-10 — jlmops @468 live, entity-id resolution fixed and confirmed; Negev region post live in both languages, wp-admin finishing (SEO meta, WPML link, winery verification) still pending.

## At a glance

One current-state line per business area. The umbrella has no single phase label — each area carries its own state.

- **jlmops** (GAS backend) — live @465, stable. Content-publishing pipeline, Calendar tab UX, task-detail UI, and new-product onboarding all current and live-tested.
- **jlmwines.com** (storefront/theme) — live, theme v1.2.30; Wine Talk category taxonomy expanded (Wine Basics + Regions live in WP), tab UI pending first region post.
- **content** — 11 editorial posts live (EN+HE); region-post series and a Grapes guide anchor in active drafting (`content/REGION_POSTS_PLAN.md`, `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`).
- **marketing** — flyer printed, distributing to Talbiye after 9 Av; newsletter cadence current (July print out, AYIW email drafting); calendar filled through December.
- **business** — strategy/brand docs current.

## Metrics

| Metric | Value |
|--------|-------|
| Last Active | 2026-07-10 |
| Revenue | Steady |
| Deploy Version | jlmops @469 · theme v1.2.31 |
| Deploy Date | jlmops 2026-07-12 · theme 2026-07-09 |
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
2. **Branded shipping cartons — art in review with vendor.** Partner-owned. Track only: nudge in daily review; re-flag if production/delivery slips. No Claude action.
3. **Flyer advertising — printed; distribution scheduled after 9 Av to 5,000 Talbiye residences.** Vendor-owned execution. Plan → `marketing/FLYER_PLAN.md`. Coupon rides the offline-attribution scheme (Inbox, `defer:2026-07-14`).
4. **Ongoing operational cadence** (continuous): update products; validate web product data + image accuracy (`jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`); add products to fill category gaps; publish regularly (blog pipeline + monthly newsletter).
5. **Galilee region post (Slot B, due 2026-08-11, see `content/REGION_POSTS_PLAN.md`)** — in progress; drafted + registered in the library (`blog-region-galilee-en`, state `draft`).
6. **Central Mountains region post (Slot C) — body drafted through Image Prompts, 2026-07-09.** Calendar row staged (`blog-region-central-mountains`, cal_Date 2026-08-25, pending "Apply Pending Updates"); Drive doc placed at the canonical library path (`blog-region-central-mountains-en 26-07-09-12-05`); git source at `content/regions/central-mountains/central-mountains-en.post.md`. Remaining: winery verification (Gvaot/Tura not yet confirmed against JLM's carried wineries), Canva images, HE translation, library registration, WP push — same checklist as Galilee (`content/REGION_POSTS_PLAN.md`).
7. **Grapes anchor post** ("Grape Varieties in Israel") — drafted through Image Prompts + Notes at `content/grapes/grapes-en.post.md`, facts verified. Not yet registered in the library or flagged to anyone. Individual grape spoke posts deferred per `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`'s sequencing decision.
8. **Local file/folder cleanup** (`plans/FILE_CLEANUP_PLAN.md`) — executed 2026-07-10, all 6 categories. `jlmops/exchange/` fully cleared; root `exchange/` down from ~130 to ~19 items. A few ambiguous files (a Mailchimp credential, a jlmops UI design-system preview, two theme-zip candidates, loose `.po` translation files) were deliberately left for a decision — see plan doc "Remaining decision items."
9. **Product-editor cache fix (jlmops @469) — awaiting manager smoke test 2026-07-13.** Fixes the 15-18s uncached product-editor loads. See `jlmops/plans/BUG_FIX_SEQUENCE.md` Session J; items 2-4 (manager submit-hang reassessment/diagnosis) pending this smoke test's result.

## Active Plans

Plans with code partially shipped and open implementation steps remaining. Session-end must update this list — add when a plan starts mid-implementation, strike or remove when fully done.

- **Bug fix sequence** (`jlmops/plans/BUG_FIX_SEQUENCE.md`) — Sessions A–E and G resolved. Pending: F (sync hardening — 3 items, needs staging repro), H (timestamps + date-format audit), I (count-task creation audit), J (product-editor cache fix + manager submit hang, found 2026-07-12).
- **Bundles** (`jlmops/plans/BUNDLE_PLAN.md`) — Stages 1–7 + UI phases 1–5 shipped. Pending: composite-weight tuning (per-slot/per-bundle weight overrides).
- **Wine Talk blog categories** (`website/BLOG_CATEGORIES_PLAN.md`) — Wine Basics renamed + Regions category created live in WP, manifest wiring done (steps 1-2, 4). Deferred trigger fired 2026-07-06 (Negev published) — tab-row UI + `All` view (step 3) still not built; user dual-categorizing region posts under Wine Basics as an interim workaround in the meantime.
- **Calendar tab UX** (`jlmops/plans/CALENDAR_TAB_UX_PLAN.md`) — Phases 2–4 (click-through shows entity details before a task, status filter, search repositioned) shipped live 2026-07-09 @461. Phase 3 (status filter) smoke-tested and confirmed working; Phases 2 and 4 still unsmoked. Phase 1 (refresh doesn't fire after "Apply Pending Updates"/"Create Content Tasks") investigated, root cause still open — needs a live repro.

## Current State

- **Sync workflow** — stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce); imports, exports, validation all working.
- **Import system** — full Woo REST API pull (products + translations + orders); 30-day rolling window.
- **CRM enrichment** — 548 contacts with dual-language preferences; `campaign.received` backfill manual only (daily auto-wiring deferred). Plans → `jlmops/plans/CONTACT_MANAGER_PLAN.md`, `CRM_PLAN.md`.
- **Content Library** — entity/task model live (no auto-paired EN/HE entities, lazy entity creation on first Doc attach with title sourced from the spawning task's `cal_Name`, task-derived status everywhere, calendar-row-picker-only content creation). `PublishingView.html` (promoted from `LibraryView.html`) is the current UI: admin sees Calendar/Library/Campaigns/Projects tabs, manager sees Calendar/Tasks/Library, both with a "Create Content Tasks" entry point. Both Library and Calendar tabs show a Slug column for connection diagnosis. System doc → `jlmops/docs/DATA_MODEL.md`, `jlmops/docs/WORKFLOWS.md` §13; drafting/placement procedure → `jlmops/plans/CONTENT_CREATION_CHECKLIST.md`.
- **Calendar tab UX** — row click now opens the entity drawer (details) before advancing to a task, plus a status filter (not started/in progress/done/no tasks yet) and a search box repositioned into the title bar. Live @461 (2026-07-09). Status filter smoke-tested and confirmed working 2026-07-09; click-through and search placement not yet smoke-tested. Refresh after "Apply Pending Updates"/"Create Content Tasks" still doesn't fire on the client — investigated, no defect found in code, needs a live repro. Plan/investigation → `jlmops/plans/CALENDAR_TAB_UX_PLAN.md`.
- **Campaign system** — data model + UI live (`SysMarketingCampaigns` + `SysShortUrls`, UTM/short-URL/QR); short URLs pasted manually (auto-push deferred). Plan → `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`.
- **Bundles** — all stages (0–7) live; EN/HE export working; composite-weight tuning pending. Plans → `jlmops/plans/BUNDLE_PLAN.md`, `ADMIN_BUNDLES_UI_PLAN.md`.
- **Ops↔session bridge** — OPS writes system-health (15-min) + KPI (daily) into `jlmops-status.md`; `/review-daily` reads it each run. Plan → `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md`.
- **KPI Summary Tab** — live @440. All 6 `business/KPI.md` KPIs compute automatically: 4 jlmops-source ones (new customers EN/HE, first-order conversion+AOV, 90-day return rate, newsletter subscribers+engagement) via `SysKPISummary`, plus GA4 organic-traffic EN/HE split and organic-source engagement (bounce rate + pages/session) via a dedicated GA4 audience report. All surface in `jlmops-status.md`, no jlmops UI. Month-over-month trend surfacing also live (new customers, return rate, subscriber MoM vs. last closed month) — but the return-rate/subscriber deltas aren't trustworthy until a month closes naturally (next: 2026-08-01), since all 6 backfilled months share one retroactive snapshot; new-customers deltas are trustworthy now. Schema/system doc → `jlmops/docs/DATA_MODEL.md` (`SysKPISummary`); engineering history archived at `jlmops/plans/_archive/KPI_SUMMARY_TAB.md`. Found + worked around along the way: `ConfigService.loadConfig` silently drops a second param pair for non-schema settings, and `sk_Period` closed-month values get silently converted to Dates by Sheets (`.claude/bugs.md` 2026-07-02/03).
- **Theme** — live v1.2.31; Homepage Phase 2 (Gutenberg blocks) queued → `website/HOMEPAGE_BLOCKS_PLAN.md`.
- **Checkout Israel-shipping confirmation** — live (`inc/woocommerce.php` `shipping_israel_confirm` field). Country/postcode fields are hidden and hardcoded to IL, so there's no country signal to validate against; an always-shown required checkbox next to the shipping-phone field ("Shipping address and phone are both Israeli") gates submission on acknowledgment rather than validating phone format, since legitimate gift orders often start without a valid recipient number and get one via manual follow-up. Addresses foreign visitors entering a US address (country field can't be changed) whose orders then have to be manually cancelled. Shipping FAQ (`content/FAQ EN.md`, "Where do you deliver?") now spells out Israel-only shipping.

- **Content-library versioning** — attach-to-replace + supersede→`_archive` confirmed live (Decision 7 / Plan B). Not yet smoke-tested: the **Create-translation-text** button (HE translate task with an EN Doc → copies EN + prompt, attaches as HE current, old HE archived); a messy/mobile-pasted URL through the hardened id extraction; `runLibraryDuplicateReconcile` from the editor.
- **Correct Product Name tool** — live (Admin → Products → SKU Management → Correct Product Name); edits WebProdM/WebDetM name fields and logs to Recent SKU Updates. Not yet smoke-tested from /dev. Plan → `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
- **New-product Products-view UX** — shipped, archived, and smoke-tested/validated by the user 2026-07-09 (`jlmops/plans/_archive/NEW_PRODUCT_WORKFLOW_UX_PLAN.md`); current behavior documented in `jlmops/docs/WORKFLOWS.md` §14. Accept Suggestion modal field order (EN name → Woo Post ID → HE name) and its required Comax "Sold Online" confirmation checkbox smoke-tested 2026-07-10. Closes the smoke-test gate the PROJ-CONTENT Inbox item was waiting on.
- **Verification reverted-task handling** — live; reverting a verify task routes it to Admin → Verification "Reverted — needs admin"; Close completes it, Pass to manager hands it off as an editable Detail-Updates task with findings intact. Not yet smoke-tested. Plan → `jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`.
- **SKU management** — Vendor SKU Update and Trim Safety not yet tested; Product Replacement tested and working, though its product search reads dead WebProdM columns (`.claude/bugs.md`).
- **UI T4.3 count-entry modal** — shipped, unsmoked; verify on a phone when count tasks next appear.
- **`st_DoneDate` set without `st_Status='Done'`** — at least one Manager-assigned row carries a done date while still Assigned, so it surfaces as open. Watch whether the pattern spreads; if so, fix the write path or the dashboard filter.
- **Manager-dashboard pack types** — contact / confirmation / content-publish packs still unexercised (no such tasks have appeared yet); smoke each type's actions when one next shows up.

## Known Issues

1. Consider auto-cleanup of rows below the data range during upsert.
2. Gutenberg editor width doesn't match the Elementor front-end (accepted limitation — use Preview or API-push workflow).

## Blocked / Deferred

- **Year in Wine PDF** — needs PDF-generation research.
- **Woo Brand + GTIN structured-data enrichment** — needs a jlmops-side data-shape change (new WC sync fields or CSV columns); deferred alongside cross-sell.
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

- **Offline-channel attribution scheme** `defer:2026-07-14` — newsletter attribution confirmed, including QR-code tracking specifically (not just tagged links). Flyer not yet distributed; allow ~2 weeks post-drop to smoke results before reviewing naming convention + QR/coupon setup.
