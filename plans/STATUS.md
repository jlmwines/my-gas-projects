# JLM Wines — Current Status

**Updated:** 2026-06-08 — jlmops @270 · theme v1.2.29 live; 0 blockers. **Bundles Stage 7 generator (rev 2.2) SHIPPED @267→@270 — BUNDLE_PLAN complete.** Per-bundle price band (`sb_MinTotal`/`sb_MaxTotal`, schema-appended + manual column) + slot criteria, structure-preserving; **two ops — Maintain** (default; re-picks only deficient slots; gate = the richer `getBundleDeficiencies` = stock ∨ criteria-miss ∨ over `slot.priceMax` ∨ base total ∉ band, driving `task.bundles.needs_update`) **+ Re-roll** (explicit, whole-bundle, editor button). Qty-weighted running-budget fill (high-qty base slots picked first so profit×qty concentrates), top-up (max-guard) + symmetric down-pass; **flex (qty-0) two-tier budget** (prefer in-budget avg base bottle, modest ≤1.5× overage only when needed, best-fit not priciest); **unfillable base slot keeps current + flags** (`unfilled`/`over_ceiling`) — never cross-category; composite = profit (null→0.25 neutral) + diversity + stock (featured dropped; price-pull on base slots only). Bundle **NAME read-only** (web-derived, never pushed — like discount §7.1c); **reimport now preserves** band + gen metadata; **push-status cache refreshed on every edit** (fixes stale "Matches web"). Editor adds band fields + generation-status line + per-bundle **EN/HE export-meta copy panel** + category-in-row + open-all-details. Live testing positive (faithful EN/HE output = the win); rough spots remain, full editor smoke ongoing. **Standing jlmops backlog:** reliability-audit + UI-audit queues; `TEST_HARNESS_PLAN.md`; CODE_AUDIT Phase 1 authz; RELOAD_RESILIENCE Option A. Detail → `jlmops/plans/BUNDLE_PLAN.md`; narrative → `.claude/session-log.md`.

## Metrics

| Metric | Value |
|--------|-------|
| Phase | Theme cutover, Manager CRM, Lookup admin UI, Content Library subsystem, and the Admin task workbench (`AdminTasksView`) are all SHIPPED and live. Content Library is permanent (`library.enabled` flag and `crm.template.*` SysConfig retired; SysLibrary is the sole template source). Phase 12 cross-link renderer remains blocked on the §16 regions overhaul. |
| Last Active | 2026-06-08 |
| Revenue | Steady |
| Deploy Version | jlmops deploy @281 · theme v1.2.29 LIVE |
| Deploy Date | jlmops 2026-06-08 (deploy @281) · theme 2026-06-04 (v1.2.29) |
| Content | 10 editorial posts live on production (EN+HE) — Context published 2026-05-19; 3 in pipeline (Handling and Storage, Reds Guide, Whites Guide awaiting editing + translation). "A Year in the Vineyard" moved OUT of blog pipeline 2026-05-19 — repositioned as recurring subscriber-exclusive "Making Wine — [topic]" series for newsletter + email per `marketing/NEWSLETTER_PLAN.md` |
| CRM Contacts | 548 enriched |
| SEO Status | Latest audit: RankMath 2026-05-31 (read-only `audit-site-seo` via curl; global/EN scan, WPML-blind) — 87/100. Open actionable: (RM-1) **FIXED 2026-06-02 (both halves).** staging leak: 6 hardcoded `staging6.jlmwines.com` image-URL defaults in `footer.php`/`template-homepage.php`/`front-page.php` → root-relative `/wp-content/uploads/...`. Missing alt: banner (`Evyatar Cohen, JLM Wines`) + newsletter (`Evyatar at the vineyard`) imgs given `is_rtl()` EN/HE alt. Deployed + verified clean/correct on live EN+HE; (RM-2) focus keyword not in title — NOT actionable (self-resolves): on products it's mostly the Rosé/Rose accent or vintage/wording drift that the next restock detail-update corrects, and packages aren't real search targets (user call 2026-06-02). Don't re-flag each review; WPML per-language meta gap (`RANKMATH_WPML_AUDIT.md` §A–F — needs a wp-admin walk, not covered by the scan). Still open from the 2026-05-06 audit (`plans/SEO_AUDIT_2026-05-06.md`): gtin13 emission (#9), aggregateRating (#10), HE OG image (#11), EN-only post israel-wine-discovery (#8). |
| Open Bugs | Per `.claude/bugs.md` and `jlmops/plans/BUG_FIX_SEQUENCE.md` (9 sessions). Sessions A–E and G SHIPPED. Still open: **Session F** (3 sync-hardening items, pending staging repro — user-driven); **Session H** (timestamps + date-formats audit — produces a change list); **Session I** (count-task creation audit). Deferred: GTIN structured-data enrichment; auto-push to RankMath for short-URL redirects. Latent (deferred): `webProductReassign` misses `WebProdS_EN` + `WebDetS` + `SysTasks` in the proactive-replace path — covered in practice by Fix Orphan SKU. |
| Next Milestone | Content Library implementation complete; phase 12 cross-link renderer blocked on the §16 regions overhaul. Product verification surface SHIPPED (@199–@201, `jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`). Next jlmops action: open (candidates: reliability audit / UI audit queues). PROJ-CONTENT activation done 2026-06-03; Contact Action Ribbon Phase 2 dropped 2026-06-03 (`jlmops/plans/CONTACT_ACTION_RIBBON_PLAN.md`). Reliability audit queue (`jlmops/plans/RELIABILITY_AUDIT.md`, 16 sessions; Tier 1.1 shipped) and UI audit (`jlmops/plans/UI_AUDIT.md`, Tiers 1–4 mobile shipped, Tier 5 partial) remain. Mobile LCP tuning (~4.0s) queued. |
| Blockers | 0 |
| Mobile PageSpeed (post-cutover) | Baseline 2026-05-05: EN FCP 3.2 / LCP 4.1 · HE FCP 3.5 / LCP 4.0 · TBT 210ms. Current (theme v1.2.29, 2026-06-05): FCP 3.5 / LCP 4.2 — at baseline. The earlier single-run 3.6 LCP read (post-Jetpack-disable) was an optimistic outlier; true mobile LCP sits ~4.0–4.2 within PSI run-to-run noise. Remaining lever = render-blocking pile (main.css critical-CSS + jQuery defer). |
| Desktop PageSpeed (post-cutover) | EN: FCP 0.7 / LCP 0.8 · HE: FCP 0.7 / LCP 1.2 |

## Next Action

**Current active threads** (the live "what now" — daily review reads these first; set 2026-05-31 from user):

1. **Newsletter Issue #1 — distribution UNDERWAY (2026-06-01).** Printed; now being inserted into outgoing shipments and into store customers' bags. Moved from "ready" to active distribution. Physical / user-handled; Claude only if insert copy or a counter card is wanted.
2. **Branded shipping cartons — POSTPONED ~1 week (vendors unavailable), expected ~2026-06-11.** Partner-owned task (not Claude's to scope or do). Track only: surface as a nudge in daily review; re-flag as overdue if it slips past the expected date. No Claude action.
3. **Flyer advertising — ACTIVATED 2026-05-31** (was "not scheduled"). Plan `marketing/FLYER_PLAN.md`. **Round 1 = local acquisition** within ~2km of the Katamon shop: primary target is new customers in this warm, high-English, Evyatar-aware area, with offline-only regulars moving online as a secondary benefit; ~₪2,000 test. Outward cold-acquisition neighborhoods (French Hill / Beit HaKerem) move to Round 2+. Immediate unblockers: vendor outreach (yoterplus / dilen), designer, photo assets; coupon code rides the offline-attribution scheme (`defer:2026-07-01`, Inbox).
4. **Put recent jlmops upgrades into real-world use.** Standing next jlmops action = **open / TBD** — candidates are the reliability audit queue (`jlmops/plans/RELIABILITY_AUDIT.md`, Tier 1.1 shipped) and the UI audit queue (`jlmops/plans/UI_AUDIT.md`, Tiers 1–4 mobile shipped, Tier 5 partial). Two prior slot-holders both cleared 2026-06-03: **PROJ-CONTENT activation DONE** (user ran `rebuildSysConfigFromSource` + `SysProjects` row + content-task `st_ProjectId` repoints), and **Contact Action Ribbon Phase 2 DROPPED** (Phase 1 functionally complete for a single operator, see `jlmops/plans/CONTACT_ACTION_RIBBON_PLAN.md`). Intent: drive the shipped CRM / contact / UI work through actual daily operation, not just ship more. **Unified admin task workbench GO-LIVE 2026-06-01 (@191 deploy @198) — `AdminTasksView` is in the admin nav (after Dashboard); AdminProjects demoted to the soak fallback. Now driven by real use; polish follow-ups (column redesign DEFERRED) tracked in `jlmops/plans/ADMIN_TASK_UI_PLAN.md`.**
5. **Ongoing operational efforts** (continuous, not one-session): update products; validate web product data + image accuracy / quality (`jlmops/plans/PRODUCT_VERIFICATION_PLAN.md` — **SHIPPED 2026-06-02: read-only batch verification surface live @199; manager open-verify-tasks list @200; admin-card refinements + CRM/routing fixes @201**); add products to fill category gaps (inventory fill-in, line below); publish regularly (blog pipeline + monthly newsletter cadence).

---

**Theme cutover SHIPPED 2026-05-05.** Approach taken: SiteGround staging→live promote (after a failed activate-in-place attempt revealed page content existed only on staging). Live now runs jlmwines-theme v1.2.1 with Mailchimp pulls + post-sync bundle health auto-trigger.

**Post-cutover follow-ups (queued):**

1. **WPML String Translation cleanup — SHIPPED 2026-05-11.** HE storefront walk complete 2026-05-08; initial 35-string + 8-string supplemental imports done. **Filter retirement SHIPPED v1.2.17** (`gettext`/`ngettext_with_context` for result-count phrases — count line itself was removed in v1.2.16, so the filters were dead code). **Search-results chrome strings handled inline in theme** (v1.2.18 → v1.2.19): `search.php` H1 uses `is_rtl()` conditional with inline HE; WC's product-search H1 (`Search results: &ldquo;%s&rdquo;`) and breadcrumb prefix (`Search results for &ldquo;%s&rdquo;`) overridden via single narrow `gettext` filter in `inc/breadcrumbs.php`. HE translations drop quotes around `%s` to dodge RTL bidi reordering. The ~290 WPML-untranslated WC strings (admin/blocks/dev) remain deferred — not customer-facing.
2. **Mobile LCP tuning** — current ~4.1s sits on the "poor" boundary. v1.2.26+v1.2.27 brought LCP back to baseline after the v1.2.25 hero-preload regression; remaining lever is the render-blocking pile (main.css 26.6 KiB / 1,080 ms; jquery 35.1 KiB / 1,390 ms — biggest single-item win but highest regression risk). Standard play: critical-CSS extraction + defer rest for `main.css`; jQuery defer audit. Smaller items (woosb-frontend 3.7 KiB, ea11y fonts+skip-link 2.6 KiB, WPML switcher CSS, Complianz cookieblocker, fonts.googleapis CSS) need route-conditional dequeue scoping.
3. **Post-cutover stability check** — error log + order monitoring per `plans/CUTOVER_CHECKLIST.md` Stage 3. Initial 24–48hr window has passed (cutover 2026-05-05, today 2026-05-07); confirm monitoring happened and was clean, or run a retroactive check now.
4. **WC term thumbnails refresh** — admin-side images in wp-admin → Products → Categories still old; customer-facing pages already use theme overrides.
5. **SG Optimizer re-enablement** — **deferred 2026-05-07: probably not worth the effort.** The clean new theme already eliminated the big lever (no kowine/WPBingo/Redux registering 226 KiB of unused CSS — that's where SG Optimizer's combine/minify mattered). Remaining safe features are mostly redundant: font-display swap is already in the Google Fonts URL; WP core handles lazy-load since 5.5; SiteGround sets browser-cache headers by default; HTML minify and disable-emojis are tiny byte savings. If mobile LCP becomes a priority, image/asset audit (hero WebP/AVIF + fetchpriority, render-blocking script audit, defer above-the-fold third-party JS) is the higher-leverage path. Keep SG Optimizer fully off.
6. **Untranslated strings audit** — walk live in EN and HE, list every visible English string on HE pages (and vice versa). Most likely surfaces: WC chrome (cart/checkout/account), PDP variation labels, Complianz banner, plugin-emitted strings. Resolve via inline `is_rtl()` baking (theme-owned) or WPML String Translation (plugin/WC chrome).
7. **Homepage architecture — Phase 2 (Gutenberg blocks) queued.** **Phase 1 SHIPPED 2026-05-07** — `template-homepage.php` (copy of `front-page.php` with Template Name header) deployed in theme v1.2.16; EN home-elegant page #9109 restored from trash and published, WPML-linked to HE home-elegant #64199, both assigned the Homepage template; Settings → Reading switched to static page. Side effects verified: homepage hreflang now `https://` (was `http://`), `/he/home-elegant/` no longer in sitemap, per-page RankMath fields now usable on EN+HE Home pages. **Phase 2 (~2–3 sessions):** build `jlm/product-carousel` + `jlm/post-carousel` Gutenberg blocks, rewrite homepage Page content using the blocks, retire `template-homepage.php` AND `front-page.php` (both now redundant). Plan: `website/HOMEPAGE_BLOCKS_PLAN.md`.
8. **Unused plugin cleanup on live** — delete deactivated plugins to reduce attack surface and update noise. **Jetpack DISABLED 2026-06-03** (not required for the WooCommerce phone app — it uses site-credentials + Application Passwords on WP 5.6+; Jetpack only adds push/stats/multi-store/Blaze. Disabling also improved mobile LCP — see PageSpeed row). Deletion deferred: confirm nothing else depends on the Jetpack Connection package before removing. **DO NOT DELETE `mailchimp-woocommerce`** — its `wp_options` API key is what the theme's replacement code reads. Safe to delete: `woo-smart-wishlist`, `WPBingo`, `redux-framework`, `Elementor` + `Elementor Pro` (after verifying no remaining Elementor pages — search wp-admin → Pages for the Elementor edit indicator), `widget-importer-exporter`, `better-search-replace`, `wp-file-manager`. Verify-before-delete: `contact-form-7` + CF7 multilingual (any forms in use?), `variation-swatches-for-woocommerce` (variation selector acceptable without it?), `woocommerce-checkout-field-editor` (any custom checkout fields configured?).
9. **Remove "Magnums" product category — SHIPPED 2026-05-18.** Template fix (`template-gifts.php` via `4b630c9` + v1.2.26 FTP push, section removed from gifts page + hero anchor chip), and EN+HE `product_cat` term pair + WPML translation deleted in wp-admin by user same day. Fully retired.

**Other in-flight initiatives** (cross-area, strategic context in `business/STRATEGY.md`):
- **Content Library — COMPLETE.** Phases 2–11 shipped (2026-05-25 → 2026-05-28); the subsystem is permanent (`library.enabled` + `crm.template.*` retired). Entity / task / activity-log model with references between entities; templates migrated from SysConfig; Campaigns absorbed; CRM unchanged. Full architecture and phase history in `plans/CONTENT_LIBRARY_PLAN.md` (§17 reconciled) + `jlmops/plans/LIBRARY_VIEW_PLAN.md`. Remaining: phase 12 cross-link renderer, blocked on the §16 regions overhaul.
- **Cadence Realignment + Campaign Architecture — BOTH SHIPPED 2026-05-11.** (1) `jlmops/plans/CADENCE_REALIGNMENT_PLAN.md` — CRM throttling shipped as @83: `CrmIntelligenceService.runAnalysis()` gates cooling/unconverted/winery cohort suggestions behind `crm.suggestions.cohort.enabled = false` flag; holiday reminder unaffected; first-order welcome path untouched. Existing unactioned lifecycle tasks cleared manually by user. (2) `jlmops/plans/CAMPAIGN_ARCHITECTURE.md` — full data model + UI shipped as @84/@85: new `SysMarketingCampaigns` + `SysShortUrls` sheets, two FKs added (`spro_CampaignId`, `scm_MarketingCampaignId`), `MarketingCampaignService` (seed + UTM builder + short URL CRUD + QR helper, RankMath push stubbed), `WebAppCampaigns` controller, `AdminCampaignsView` + nav link, Campaign dropdown on Project create form, Campaign field + Generate Outputs button + modal on Project Detail, 16 new task templates for Distribution chains, `setupMarketingSheets()` helper. Launch Campaigns seeded: `newsletter-print` + `email-broadcast`. End-to-end smoke test passed: campaign list, project-campaign link, Generate Outputs producing utm URL + short URL + QR. **Manual short-URL paste into RankMath wp-admin for now** (5–10 URLs/month volume; auto-push deferred per `.claude/bugs.md`). Remaining UI: AdminCampaignServiceView (standalone, nice-to-have); AdminCampaignDetailView analytics (build once first-cycle data lands).
- **KPI Summary tab in `JLMops_Data`** — DEFERRED / parked. Spec at `jlmops/plans/KPI_SUMMARY_TAB.md` was Claude's pitch, not the user's. User prefers periodic manual review of GA4 + GSC + JLMops_Data on cadence over a built dashboard tab. Don't re-surface as "ready to build" in pickups.
- **Inventory fill-in (in progress)** — adding products to fill category gaps after the recent full-inventory pass. Likely to surface jlmops refinements in passing: decanting field treats 0 as empty (already in `.claude/bugs.md`); new kashrut values may need to be added to the lookup list as they appear. Bring me in when there's a concrete blocker.
- **CONTACT_MANAGER Half 2** — action layer: first-order welcome trigger, partner mobile follow-up UI. Half 1 shipped @81. See `jlmops/plans/CONTACT_MANAGER_PLAN.md`.
- **Newsletter v1** — printed monthly insert (online + store handout) + companion email. **Issue #1 EN + HE Mailchimp campaigns SCHEDULED 2026-05-26 (Tue) evening send.** HTMLs at `marketing/newsletter/issues/2026-05-context-{en,he}.html` — "Out in the Vineyard" / "בכרם" May Making Wine entry locked, subject "A note from the vineyard" / "פתק מהכרם", custom footer dropped (Mailchimp's draft footer handles CAN-SPAM). **Print PDFs READY 2026-05-26** for distribution + order inclusion (user-handled). **"Making Wine — [topic]" series** is the recurring subscriber-exclusive monthly journal of vineyard/winery activity (12-month draft already exists, Evyatar edits month-by-month); lives ONLY in print newsletter + companion email, NOT on the blog. **Future publishing rides the library entity model per CONTENT_LIBRARY_PLAN §17 phase 11** (distribution events as entities) — Issue #1 is the last pre-library issue; June 2026 onward registers as library entity instances.
- **Flyer advertising — printed mailbox insert acquisition test.** Plan at `marketing/FLYER_PLAN.md` (drafted 2026-05-08). Round 1 (revised 2026-05-31): local acquisition within ~2km of the Katamon shop (new local customers primary, in a warm high-English Evyatar-aware area; offline-only regulars converting online secondary); the original beyond-walking-distance pair (French Hill / Beit HaKerem) moves to Round 2+. Single coupon code + billing-address attribution. ~₪2,000/round test scale. Unblockers: vendor outreach (yoterplus + dilen), designer engagement, photo assets. **ACTIVATED 2026-05-31** (was "not scheduled") — see Current active threads at top of Next Action.
- **Comeback campaign** — segment export + test send. Calendar item.
- **Year in Wine PDF** — research. Calendar item.
- **Bundle handling — `jlmops/plans/BUNDLE_PLAN.md` — ALL STAGES COMPLETE (0–7), live @270.** Staged master plan: **0** qty=0 price fix; **1** Bundles-view perf; **2** cost/profit data layer; **3** serializer + Export worklist (ops≠web product-multiset diff) + profit-in-selector + as-presented WOOSB discount; **4** EN/HE parity cleanup + stock; **5** "Pull Bundle Data" fast bundles-only refresh; **6** cross-bundle diversity (variety-first picker); **7** rev-2.2 suggestion generator — price band + Maintain/Re-roll + qty-weighted fill + flex two-tier + unfilled-flagging (details in the `Updated:` line + plan). EN+HE woosb paste verified flawless live (2026-06-08). **AdminBundles UI overhaul (`ADMIN_BUNDLES_UI_PLAN.md`) shipped alongside.** REST push parked. Remaining: full editor smoke + tuning of rough spots surfaced in live use.
- **CRM extras** — campaign-recipient activity rows on contacts (post Half 1); housekeeping last-run markers cleanup (small sweep).

**Pending SKU management test verifications** (code deployed 2026-02-19):
- Vendor SKU Update — not yet tested
- Trim safety — not yet tested
- (Product Replacement tested and working.)

**Pending operational tasks:**
- **Verify UI T4.3 Stage B count-entry modal when count tasks next appear.** Shipped @170 deploy @174 but unsmoked — no `task.validation.*` count tasks were scheduled at ship time, so the Product Counts list was empty. When count tasks exist, test on a phone: Product Counts shows the compact list (Name+SKU+checkbox); tap a row opens the modal focused on Storage; Save & next walks to the next un-counted product; Save ticks the status checkbox and updates Total; Submit Counts works. Desktop 12-col table is unchanged regardless.
- **Verify @120 task date fix over next 3–5 business days.** Shipped 2026-05-25: `TaskService.createTask` Rule 2 restored — assigned tasks with non-immediate `due_pattern` should now get `st_StartDate = today` + `st_DueDate` computed from pattern on creation. Watch newly created `task.validation.vintage_mismatch` (`one_week`) and `task.validation.comax_internal_audit` (`next_business_day`) rows after the next sync runs: confirm both date columns populate. Also confirm no new `task.crm.suggestion` rows appear in SysTasks (CrmIntelligenceService task-creation calls dropped in same deploy).
- **Watch: `st_DoneDate` set without `st_Status='Done'`.** 2026-05-25 SysTasks snapshot has at least one Manager-assigned `task.project.custom` row with status `Assigned` but `st_DoneDate = 5/12/2026`. Frontend "All Open" filter is status-based, so these surface in the manager view as open tasks despite carrying a done date. Track over coming days whether the pattern persists / spreads; if it does, find the write path that sets `st_DoneDate` without flipping status and either fix it or change the dashboard filter to also exclude `task.doneDate` present.
- **Observe `runFrequentMaintenance` over one business day.** Pipeline shipped @117 → @119 + 15-min time-driven trigger arranged 2026-05-15 (Apps Script `everyMinutes()` accepts 1/5/10/15/30, not 20 — close enough; cadence guard handles the per-day schedule). Runs every 15 min during business hours (Sun-Thu 08–20 IL + Fri 08–13 IL); overnight + Sat intentionally off (trigger still fires, function returns on guard — no overnight pulls). Manual runs verified: 58s → 27s → 10s as cursor stamped. Confirm a prior `pullWooOrders` time-driven trigger, if any, has been removed (redundant now — `runFrequentMaintenance` calls `pullOrders` itself with the cursor; standalone wrapper would duplicate the unbounded 30-day pull each fire). After one business day, verify in SysLog: cursor advancing, no error spam, welcome + pending-payment tasks firing as expected.

**Pending build items:**
- `CampaignService.getTargetSegment()` for segment export
- Comeback campaign small-scale testing
- PDF generation research for Year in Wine

## Current State

- **Sync workflow:** Stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce). Imports, exports, validation all working.
- **CRM enrichment:** Complete. 548 contacts enriched with dual-language preferences (categories, wineries, grapes, kashrut). Activity backfill working.
- **Campaign system:** Planned (`jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md`), not yet built. Key decisions made: welcome offer NIS 50 off 399, Tuesday evening sends, 7-14 day attribution window.
- **First Mailchimp campaign:** Text and link ready (pending partner review). Two separate sends — EN and HE to language-segmented lists. Claude to build HTML email bodies. Mailchimp segments already set up.
- **Import system:** Full Woo REST API pull (products + translations + orders) deployed Feb 2026. "API Pull" button runs entire pipeline with step-by-step progress in sync widget. Order pull: 30-day rolling window, upsert via existing OrderService pipeline. Credentials in SysEnv sheet. Plan: `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`.
- **Admin UI:** Contact preferences display, activity ribbon icons. Task list: created date column in state 3, created date in detail panel, reduced font sizes + rebalanced columns (in test, not deployed).
- **SKU management fixes:** Deployed 2026-02-19. Product replacement tested and working. Vendor SKU update + trim safety still awaiting test (see Pending SKU management test verifications above).
- **Website performance:** Round 1 of SG Optimizer tuning complete (2026-04-15). Enabled: Web Font Optimization, Combine/Minify CSS + JS, Ultrafast PHP. Captured font-display (1,230 ms) and minify CSS/JS in full. Lab LCP 11.0 s → 7.2 s, FCP 5.3 s → 3.9 s. Field CWV still Failed (28-day rolling window hasn't reflected changes yet). Remaining work requires theme swap — see 2026-04-15b session entry for full diagnosis.
- **Content pipeline:** COMPLETE. All 8 posts (16 files EN+HE) live on staging6. `push-posts.js` pushes via WP REST API with ID-based updates. Posts authored as `.post.md` files with complete WP block HTML including placed images. About Page rebuilt as clean HTML (`.page.md` files) replacing Elementor — pushed directly via REST API to page IDs. Canva AI generates images from Claude-written prompts (impressionist oil painting style).

## Known Issues

1. Consider auto-cleanup of rows below data range during upsert
2. Gutenberg editor width doesn't match Elementor front-end (accepted limitation — use Preview or API push workflow)

## Review Cadence

Periodic business health checks — not automated, just a checklist for session review.

### Weekly (any session touching jlmops or website)

- [ ] New orders since last check — count, anything unusual
- [ ] New customers — how many, EN vs HE language split
- [ ] Open bugs or failed syncs in SysLog
- [ ] Anything broken on the live site (spot-check homepage, a product page, cart)

### Monthly (dedicated review, first session of the month)

**Customers & Revenue**
- [ ] New vs returning customer ratio
- [ ] Language breakdown of new customers (EN vs HE) — trend over time
- [ ] Average order value — any drift
- [ ] Top-selling products — shifts or surprises

**SEO & Content**
- [ ] Google Search Console: indexing status, crawl errors, duplicate content flags
- [ ] Canonical issues — are new/changed products getting proper canonical tags?
- [ ] Blog post traffic — are the 8 posts getting impressions/clicks?
- [ ] Product description quality — any thin or duplicate content appearing?

**Marketing & Communications**
- [ ] Campaign status — what's been sent, what's planned
- [ ] Email list health — bounces, unsubscribes, growth
- [ ] Comeback campaign progress (planned but not yet launched)
- [ ] Social/referral sources — anything new driving traffic?

**Technical Health**
- [ ] Sync reliability — any recurring failures in the last 30 days
- [ ] PageSpeed check — mobile and desktop (baseline: 57/82)
- [ ] WooCommerce API pull status (once deployed) — errors, timing, data quality
- [ ] Open bugs — still 2 untested? Resolve or close.

## Blocked / Deferred

- Year in Wine PDF — needs PDF generation research
- Gift recipient campaigns — lowest priority, wait
- VIP recognition + referral program — after campaigns launch
- **Woo Brand + GTIN structured-data enrichment** — currently we don't use WC Brand or GTIN fields, so product schema emits taxonomy slugs (`pa_winery`, `pa_complexity`) instead of richer `Brand`/`gtin` properties. To enable would require jlmops to push the data: either via new fields in the WC sync, or CSV format change to include brand/GTIN columns. Deferred similar to cross-sell — both depend on jlmops-side data shape changes.
- **Theme replacement:** PLAN WRITTEN at `~/.claude/plans/unified-sparking-galaxy.md`. Minimal Elementor-compatible theme ZIP to replace KoWine, eliminating Wpbingo Core + Redux Framework. Scoping session next — 2026-04-15 performance diagnosis confirmed theme stack is the remaining structural bottleneck.

## Inbox

_**BEFORE ADDING HERE:** bug? → `.claude/bugs.md`. Idea / feature? → `.claude/wishlist.md`._
_Operational pending task? → Next Action above. Item with a plan doc? → that doc._
_Only cross-project notes or pending-decision items belong here._

### Active

- _(empty — AdminDailySyncWidget literal-scriptlet bug fixed @223 + recorded in `.claude/bugs.md`, struck 2026-06-04. Prior triage 2026-06-01 cleared six items into plan docs / Deferred.)_

### Deferred

- **2026-05-24: Trajectory monitoring — decide once `defer:2026-06-15`** (moved from Active 2026-06-01; not yet due). GA4/GSC date-bucketed trajectory flagged unmeasured across 3 deep reviews (2026-05-07, 2026-05-15, 2026-05-24). Unblock is user-side: re-run GSC report with a Date dimension (current rollup is by Page only); confirm GA4 add-on data tabs populate (last check found only the config tab readable via Drive MCP). By 2026-06-15: either schedule the sheet-config fix, or accept trajectory monitoring stays qualitative and stop carrying the flag review-to-review.
- **2026-05-04: Offline-channel attribution scheme** `defer:2026-07-01` — When SE-of-Katamon flyer drops + newsletter inserts ship, need unique coupon code per offline campaign (e.g., `JLMSE50`) + UTM-tagged QR codes feeding GA4. First-order coupon system already supports per-code restrictions. Define naming convention + QR generator setup when offline campaigns are about to ship. Specific neighborhood SE of Katamon (Talpiot/Arnona/Mekor Haim/Baka) — TBD.
