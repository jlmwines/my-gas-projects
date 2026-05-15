# JLM Wines — Current Status

**Updated:** 2026-05-15 (deep review; Inbox triaged 9 → 0 + routing-prompt header added; frequent pipeline shipped @117 → @119 — full order-pull-and-sweep pipeline behind a forward `modified_after` cursor + Israeli business-hour cadence guard; 20-min trigger arrangement pending user)

## Metrics

| Metric | Value |
|--------|-------|
| Phase | Theme cutover SHIPPED 2026-05-05. New theme + Mailchimp pulls live. Manager CRM Half 2 SHIPPED 2026-05-14 with mobile UX + pending-payment automation. |
| Last Active | 2026-05-14 |
| Revenue | Steady |
| Deploy Version | jlmops @119 (most recent: @117 frequent pipeline full wiring, @118 forward cursor on order pull, @119 cadence guard tightened to Israeli business hours Sun-Thu 08-20 + Fri 08-13) · theme v1.2.23 LIVE |
| Deploy Date | jlmops 2026-05-15 (@117 → @119) · theme 2026-05-12 (v1.2.21 → v1.2.22 → v1.2.23) |
| Content | 9 editorial posts live on production (EN+HE) — Selection and Price vs Quality already shipped; 5 in pipeline (A Year in the Vineyard under review/translation; Context, Handling and Storage, Reds Guide, Whites Guide awaiting editing + translation, planned monthly drops paired with newsletter QR) |
| CRM Contacts | 548 enriched |
| SEO Status | Audit run 2026-05-06 (`plans/SEO_AUDIT_2026-05-06.md`). Resolved same day: HE site name (#2), homepage meta descriptions (#7), title format (drop %page%), category pairs (#4 — actually fine), page pairs (#5 — actually fine), site-wide image URL https sweep (#6). Deferred: homepage hreflang http (#1 — resolves via Phase 1 of homepage rebuild). Remaining: gtin13 emission (#9 opportunity), aggregateRating (#10), HE OG image (#11), EN-only post israel-wine-discovery (#8). |
| Open Bugs | 1 active (Comax order export bundle SKU) + 4 grouped backlog buckets in `.claude/bugs.md` (sync hardening, CRM cleanup, timestamp/date audit, count-task creation audit) + 2026-05-11 additions: GTIN structured-data enrichment (deferred), auto-push to RankMath for short URL redirects (deferred — manual paste fine at current volume) |
| Next Milestone | **2026-05-13 morning sync — live observation of @88 web-export inline refactor.** Be present at start of the daily sync. After Generate, widget must transition `WAITING_WEB_EXPORT → WAITING_WEB_CONFIRM` in one step (with API upload button), or `→ COMPLETE` if no diff. If anything looks wrong, rollback per `jlmops/plans/WEB_EXPORT_INLINE_PLAN.md`. After that lands cleanly: Pilot Campaign Architecture end-to-end with Newsletter Issue #1. Mobile LCP tuning (4.0–4.1s) remains queued. |
| Blockers | 0 |
| Mobile PageSpeed (post-cutover) | EN: FCP 3.2 / LCP 4.1 · HE: FCP 3.5 / LCP 4.0 · TBT 210ms (was LCP 7.2 / FCP 3.9 pre-cutover — ~43% LCP improvement) |
| Desktop PageSpeed (post-cutover) | EN: FCP 0.7 / LCP 0.8 · HE: FCP 0.7 / LCP 1.2 |

## Next Action

**Theme cutover SHIPPED 2026-05-05.** Approach taken: SiteGround staging→live promote (after a failed activate-in-place attempt revealed page content existed only on staging). Live now runs jlmwines-theme v1.2.1 with Mailchimp pulls + post-sync bundle health auto-trigger.

**Post-cutover follow-ups (queued):**

1. **WPML String Translation cleanup — SHIPPED 2026-05-11.** HE storefront walk complete 2026-05-08; initial 35-string + 8-string supplemental imports done. **Filter retirement SHIPPED v1.2.17** (`gettext`/`ngettext_with_context` for result-count phrases — count line itself was removed in v1.2.16, so the filters were dead code). **Search-results chrome strings handled inline in theme** (v1.2.18 → v1.2.19): `search.php` H1 uses `is_rtl()` conditional with inline HE; WC's product-search H1 (`Search results: &ldquo;%s&rdquo;`) and breadcrumb prefix (`Search results for &ldquo;%s&rdquo;`) overridden via single narrow `gettext` filter in `inc/breadcrumbs.php`. HE translations drop quotes around `%s` to dodge RTL bidi reordering. The ~290 WPML-untranslated WC strings (admin/blocks/dev) remain deferred — not customer-facing.
2. **Mobile LCP tuning** — current 4.0–4.1s sits on the "poor" boundary. Targets: hero image format/size, render-blocking script audit.
3. **Post-cutover stability check** — error log + order monitoring per `plans/CUTOVER_CHECKLIST.md` Stage 3. Initial 24–48hr window has passed (cutover 2026-05-05, today 2026-05-07); confirm monitoring happened and was clean, or run a retroactive check now.
4. **WC term thumbnails refresh** — admin-side images in wp-admin → Products → Categories still old; customer-facing pages already use theme overrides.
5. **SG Optimizer re-enablement** — **deferred 2026-05-07: probably not worth the effort.** The clean new theme already eliminated the big lever (no kowine/WPBingo/Redux registering 226 KiB of unused CSS — that's where SG Optimizer's combine/minify mattered). Remaining safe features are mostly redundant: font-display swap is already in the Google Fonts URL; WP core handles lazy-load since 5.5; SiteGround sets browser-cache headers by default; HTML minify and disable-emojis are tiny byte savings. If mobile LCP becomes a priority, image/asset audit (hero WebP/AVIF + fetchpriority, render-blocking script audit, defer above-the-fold third-party JS) is the higher-leverage path. Keep SG Optimizer fully off.
6. **Untranslated strings audit** — walk live in EN and HE, list every visible English string on HE pages (and vice versa). Most likely surfaces: WC chrome (cart/checkout/account), PDP variation labels, Complianz banner, plugin-emitted strings. Resolve via inline `is_rtl()` baking (theme-owned) or WPML String Translation (plugin/WC chrome).
7. **Homepage architecture — Phase 2 (Gutenberg blocks) queued.** **Phase 1 SHIPPED 2026-05-07** — `template-homepage.php` (copy of `front-page.php` with Template Name header) deployed in theme v1.2.16; EN home-elegant page #9109 restored from trash and published, WPML-linked to HE home-elegant #64199, both assigned the Homepage template; Settings → Reading switched to static page. Side effects verified: homepage hreflang now `https://` (was `http://`), `/he/home-elegant/` no longer in sitemap, per-page RankMath fields now usable on EN+HE Home pages. **Phase 2 (~2–3 sessions):** build `jlm/product-carousel` + `jlm/post-carousel` Gutenberg blocks, rewrite homepage Page content using the blocks, retire `template-homepage.php` AND `front-page.php` (both now redundant). Plan: `website/HOMEPAGE_BLOCKS_PLAN.md`.
8. **Unused plugin cleanup on live** — delete deactivated plugins to reduce attack surface and update noise. **DO NOT DELETE `mailchimp-woocommerce`** — its `wp_options` API key is what the theme's replacement code reads. Safe to delete: `woo-smart-wishlist`, `WPBingo`, `redux-framework`, `Elementor` + `Elementor Pro` (after verifying no remaining Elementor pages — search wp-admin → Pages for the Elementor edit indicator), `widget-importer-exporter`, `better-search-replace`, `wp-file-manager`. Verify-before-delete: `contact-form-7` + CF7 multilingual (any forms in use?), `variation-swatches-for-woocommerce` (variation selector acceptable without it?), `woocommerce-checkout-field-editor` (any custom checkout fields configured?).
9. **Remove "Magnums" product category** — magnums phased out of inventory. Sequence: pull from gift bundle composition first, verify no magnums remain in gift slots or other bundles, then delete the WC `product_cat` term (EN + HE WPML pair). Tracked in `.claude/bugs.md` (web).

**Other in-flight initiatives** (cross-area, strategic context in `business/STRATEGY.md`):
- **Cadence Realignment + Campaign Architecture — BOTH SHIPPED 2026-05-11.** (1) `jlmops/plans/CADENCE_REALIGNMENT_PLAN.md` — CRM throttling shipped as @83: `CrmIntelligenceService.runAnalysis()` gates cooling/unconverted/winery cohort suggestions behind `crm.suggestions.cohort.enabled = false` flag; holiday reminder unaffected; first-order welcome path untouched. Existing unactioned lifecycle tasks cleared manually by user. (2) `jlmops/plans/CAMPAIGN_ARCHITECTURE.md` — full data model + UI shipped as @84/@85: new `SysMarketingCampaigns` + `SysShortUrls` sheets, two FKs added (`spro_CampaignId`, `scm_MarketingCampaignId`), `MarketingCampaignService` (seed + UTM builder + short URL CRUD + QR helper, RankMath push stubbed), `WebAppCampaigns` controller, `AdminCampaignsView` + nav link, Campaign dropdown on Project create form, Campaign field + Generate Outputs button + modal on Project Detail, 16 new task templates for Distribution chains, `setupMarketingSheets()` helper. Launch Campaigns seeded: `newsletter-print` + `email-broadcast`. End-to-end smoke test passed: campaign list, project-campaign link, Generate Outputs producing utm URL + short URL + QR. **Manual short-URL paste into RankMath wp-admin for now** (5–10 URLs/month volume; auto-push deferred per `.claude/bugs.md`). Remaining UI: AdminCampaignServiceView (standalone, nice-to-have); AdminCampaignDetailView analytics (build once first-cycle data lands).
- **KPI Summary tab in `JLMops_Data`** — DEFERRED / parked. Spec at `jlmops/plans/KPI_SUMMARY_TAB.md` was Claude's pitch, not the user's. User prefers periodic manual review of GA4 + GSC + JLMops_Data on cadence over a built dashboard tab. Don't re-surface as "ready to build" in pickups.
- **Inventory fill-in (in progress)** — adding products to fill category gaps after the recent full-inventory pass. Likely to surface jlmops refinements in passing: decanting field treats 0 as empty (already in `.claude/bugs.md`); new kashrut values may need to be added to the lookup list as they appear. Bring me in when there's a concrete blocker.
- **CONTACT_MANAGER Half 2** — action layer: first-order welcome trigger, partner mobile follow-up UI. Half 1 shipped @81. See `jlmops/plans/CONTACT_MANAGER_PLAN.md`.
- **Newsletter v1** — printed monthly insert (online + store handout). Layout + format finalized 2026-05-08 (`marketing/NEWSLETTER_PLAN.md` — A4 b/w, two-col, masthead "Wine Talk — from Evyatar," signup CTA copy lifted from live footer, QR 3cm/EC-Q, secondary slot rotates YiV / 2nd post / Did You Know). Print Newsletter Body now a required post-source section per `content/CLAUDE.md`; template at `content/_post-template.md`. Issue #1 gated on Evyatar's edit + HE translation of Context (drafted into source + handed off as `content/Context EN_2026-05-08.docx`). Companion Mailchimp campaign (separate send) carries the redesign mention; print stays editorial.
- **Flyer advertising — printed mailbox insert acquisition test.** Plan at `marketing/FLYER_PLAN.md` (drafted 2026-05-08). Round 1 hypothesis: French Hill (EN) + Beit HaKerem (HE), beyond walking distance from Katamon shop. Single coupon code + billing-address attribution. ~₪2,000/round test scale. Unblockers: vendor outreach (yoterplus + dilen), designer engagement, photo assets. Not scheduled.
- **Comeback campaign** — segment export + test send. Calendar item.
- **Year in Wine PDF** — research. Calendar item.
- **Bundle management** — composition / member-condition split is SHIPPED (refreshBundleComposition + checkBundleHealth as separate housekeeping steps, post-sync auto-trigger @82, sync widget Run Bundle Analysis button @95). Next: `jlmops/plans/BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md` (written 2026-05-13) — bundle card UI cleanup (3 named buttons replacing Refresh/Add-New/Re-import) + new EN/HE composition parity validator (atomic (product_id, qty) pair check, section-aware, EN-as-truth). Implementation pending OK. Separate future plan: API push test for bundle composition (`BUNDLE_API_PUSH_TEST_PLAN.md`, to be written) — probes whether WPClever's REST endpoint can take updates safely.
- **CRM extras** — campaign-recipient activity rows on contacts (post Half 1); housekeeping last-run markers cleanup (small sweep).

**Pending SKU management test verifications** (code deployed 2026-02-19):
- Vendor SKU Update — not yet tested
- Trim safety — not yet tested
- (Product Replacement tested and working.)

**Pending operational tasks:**
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

_(none — Inbox triaged 2026-05-15 as part of deep review)_

### Deferred

- **2026-05-04: Offline-channel attribution scheme** `defer:2026-07-01` — When SE-of-Katamon flyer drops + newsletter inserts ship, need unique coupon code per offline campaign (e.g., `JLMSE50`) + UTM-tagged QR codes feeding GA4. First-order coupon system already supports per-code restrictions. Define naming convention + QR generator setup when offline campaigns are about to ship. Specific neighborhood SE of Katamon (Talpiot/Arnona/Mekor Haim/Baka) — TBD.
- **2026-05-05: Drive folder structure — legacy import folder out of place** `defer:2026-06-01` — Folder used by jlmops for Comax product CSV import sits in the legacy app's Drive location. New jlmops Drive parent has its own `export` and other subfolders; import folder should be moved under there. Action: move folder in Drive, then update the corresponding `system.folder.*` SysConfig key (likely `system.folder.imports`) so jlmops sync still finds it. Verify a sync cycle picks up the new location after the move.
