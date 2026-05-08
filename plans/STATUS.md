# JLM Wines — Current Status

**Updated:** 2026-05-08

## Metrics

| Metric | Value |
|--------|-------|
| Phase | Theme cutover SHIPPED 2026-05-05. New theme + Mailchimp pulls live. |
| Last Active | 2026-05-05 |
| Revenue | Steady |
| Deploy Version | jlmops @82 (post-sync bundle health auto-trigger via Apps Script time trigger) · theme v1.2.1 LIVE (Mailchimp order opt-in passes FNAME/LNAME/PHONE/ADDRESS merge fields) |
| Deploy Date | jlmops 2026-05-05 (@82 live) · theme 2026-05-05 (cutover via SiteGround staging→live promote) |
| Content | 9 editorial posts live on production (EN+HE) — Selection and Price vs Quality already shipped; 5 in pipeline (A Year in the Vineyard under review/translation; Context, Handling and Storage, Reds Guide, Whites Guide awaiting editing + translation, planned monthly drops paired with newsletter QR) |
| CRM Contacts | 548 enriched |
| SEO Status | Audit run 2026-05-06 (`plans/SEO_AUDIT_2026-05-06.md`). Resolved same day: HE site name (#2), homepage meta descriptions (#7), title format (drop %page%), category pairs (#4 — actually fine), page pairs (#5 — actually fine), site-wide image URL https sweep (#6). Deferred: homepage hreflang http (#1 — resolves via Phase 1 of homepage rebuild). Remaining: gtin13 emission (#9 opportunity), aggregateRating (#10), HE OG image (#11), EN-only post israel-wine-discovery (#8). |
| Open Bugs | 1 active (Comax order export bundle SKU) + 4 grouped backlog buckets in `.claude/bugs.md` (sync hardening, CRM cleanup, timestamp/date audit, count-task creation audit) |
| Next Milestone | Homepage architecture rebuild Phase 1 (interim, ~1–2 hrs) per `website/HOMEPAGE_BLOCKS_PLAN.md` — clears remaining SEO issue #1 (homepage hreflang http) and #3 (`/he/home-elegant/` stray sitemap entry) as side effects. Mobile LCP tuning (currently 4.0–4.1s) remains queued. |
| Blockers | 0 |
| Mobile PageSpeed (post-cutover) | EN: FCP 3.2 / LCP 4.1 · HE: FCP 3.5 / LCP 4.0 · TBT 210ms (was LCP 7.2 / FCP 3.9 pre-cutover — ~43% LCP improvement) |
| Desktop PageSpeed (post-cutover) | EN: FCP 0.7 / LCP 0.8 · HE: FCP 0.7 / LCP 1.2 |

## Next Action

**Theme cutover SHIPPED 2026-05-05.** Approach taken: SiteGround staging→live promote (after a failed activate-in-place attempt revealed page content existed only on staging). Live now runs jlmwines-theme v1.2.1 with Mailchimp pulls + post-sync bundle health auto-trigger.

**Post-cutover follow-ups (queued):**

1. **WPML String Translation cleanup** — HE storefront walk complete 2026-05-08. Initial 35-string import (2026-05-06) plus supplemental coupon + search gap import (2026-05-08, 8 strings via `jlmwines/exchange/strings/lookup-coupon-search-gaps.js`). One string hand-translated by user ("Coupon \"%s\" cannot be applied because it does not exist."). One string ("Coupon \"%s\" has expired.") needed manual variant entry in WPML — runtime form uses literal-backslash escape, not the clean form, so import of clean form alone didn't render. **Remaining sub-action:** retire the `gettext`/`ngettext_with_context` filters in `inc/shop-filters.php` for catalog result-count phrases and WC dropdown labels — these duplicate the now-authoritative WPML rows. The ~290 WPML-untranslated WC strings (admin/blocks/dev) remain deferred — not customer-facing. Tooling: `jlmwines/exchange/strings/lookup-canonical.js` + `lookup-coupon-search-gaps.js` reusable for future canonical pulls.
2. **Mobile LCP tuning** — current 4.0–4.1s sits on the "poor" boundary. Targets: hero image format/size, render-blocking script audit.
3. **Post-cutover stability check** — error log + order monitoring per `plans/CUTOVER_CHECKLIST.md` Stage 3. Initial 24–48hr window has passed (cutover 2026-05-05, today 2026-05-07); confirm monitoring happened and was clean, or run a retroactive check now.
4. **WC term thumbnails refresh** — admin-side images in wp-admin → Products → Categories still old; customer-facing pages already use theme overrides.
5. **SG Optimizer re-enablement** — **deferred 2026-05-07: probably not worth the effort.** The clean new theme already eliminated the big lever (no kowine/WPBingo/Redux registering 226 KiB of unused CSS — that's where SG Optimizer's combine/minify mattered). Remaining safe features are mostly redundant: font-display swap is already in the Google Fonts URL; WP core handles lazy-load since 5.5; SiteGround sets browser-cache headers by default; HTML minify and disable-emojis are tiny byte savings. If mobile LCP becomes a priority, image/asset audit (hero WebP/AVIF + fetchpriority, render-blocking script audit, defer above-the-fold third-party JS) is the higher-leverage path. Keep SG Optimizer fully off.
6. **Untranslated strings audit** — walk live in EN and HE, list every visible English string on HE pages (and vice versa). Most likely surfaces: WC chrome (cart/checkout/account), PDP variation labels, Complianz banner, plugin-emitted strings. Resolve via inline `is_rtl()` baking (theme-owned) or WPML String Translation (plugin/WC chrome).
7. **Homepage architecture — Phase 2 (Gutenberg blocks) queued.** **Phase 1 SHIPPED 2026-05-07** — `template-homepage.php` (copy of `front-page.php` with Template Name header) deployed in theme v1.2.16; EN home-elegant page #9109 restored from trash and published, WPML-linked to HE home-elegant #64199, both assigned the Homepage template; Settings → Reading switched to static page. Side effects verified: homepage hreflang now `https://` (was `http://`), `/he/home-elegant/` no longer in sitemap, per-page RankMath fields now usable on EN+HE Home pages. **Phase 2 (~2–3 sessions):** build `jlm/product-carousel` + `jlm/post-carousel` Gutenberg blocks, rewrite homepage Page content using the blocks, retire `template-homepage.php` AND `front-page.php` (both now redundant). Plan: `website/HOMEPAGE_BLOCKS_PLAN.md`.
8. **Unused plugin cleanup on live** — delete deactivated plugins to reduce attack surface and update noise. **DO NOT DELETE `mailchimp-woocommerce`** — its `wp_options` API key is what the theme's replacement code reads. Safe to delete: `woo-smart-wishlist`, `WPBingo`, `redux-framework`, `Elementor` + `Elementor Pro` (after verifying no remaining Elementor pages — search wp-admin → Pages for the Elementor edit indicator), `widget-importer-exporter`, `better-search-replace`, `wp-file-manager`. Verify-before-delete: `contact-form-7` + CF7 multilingual (any forms in use?), `variation-swatches-for-woocommerce` (variation selector acceptable without it?), `woocommerce-checkout-field-editor` (any custom checkout fields configured?).
9. **Remove "Magnums" product category** — magnums phased out of inventory. Sequence: pull from gift bundle composition first, verify no magnums remain in gift slots or other bundles, then delete the WC `product_cat` term (EN + HE WPML pair). Tracked in `.claude/bugs.md` (web).

**Other in-flight initiatives** (cross-area, sequenced per `business/COORDINATION.md`):
- **KPI Summary tab in `JLMops_Data`** — DEFERRED / parked. Spec at `jlmops/plans/KPI_SUMMARY_TAB.md` was Claude's pitch, not the user's. User prefers periodic manual review of GA4 + GSC + JLMops_Data on cadence over a built dashboard tab. Don't re-surface as "ready to build" in pickups.
- **Inventory fill-in (in progress)** — adding products to fill category gaps after the recent full-inventory pass. Likely to surface jlmops refinements in passing: decanting field treats 0 as empty (already in `.claude/bugs.md`); new kashrut values may need to be added to the lookup list as they appear. Bring me in when there's a concrete blocker.
- **CONTACT_MANAGER Half 2** — action layer: first-order welcome trigger, partner mobile follow-up UI. Half 1 shipped @81. See `jlmops/plans/CONTACT_MANAGER_PLAN.md`.
- **Newsletter v1** — printed monthly insert (online + store handout). Layout + format finalized 2026-05-08 (`marketing/NEWSLETTER_PLAN.md` — A4 b/w, two-col, masthead "Wine Talk — from Evyatar," signup CTA copy lifted from live footer, QR 3cm/EC-Q, secondary slot rotates YiV / 2nd post / Did You Know). Print Newsletter Body now a required post-source section per `content/CLAUDE.md`; template at `content/_post-template.md`. Issue #1 gated on Evyatar's edit + HE translation of Context (drafted into source + handed off as `content/Context EN_2026-05-08.docx`). Companion Mailchimp campaign (separate send) carries the redesign mention; print stays editorial.
- **Flyer advertising — printed mailbox insert acquisition test.** Plan at `marketing/FLYER_PLAN.md` (drafted 2026-05-08). Round 1 hypothesis: French Hill (EN) + Beit HaKerem (HE), beyond walking distance from Katamon shop. Single coupon code + billing-address attribution. ~₪2,000/round test scale. Unblockers: vendor outreach (yoterplus + dilen), designer engagement, photo assets. Not scheduled.
- **Comeback campaign** — segment export + test send. Calendar item.
- **Year in Wine PDF** — research. Calendar item.
- **Phase 14 bundle work** — bundle composition / member condition split. See `jlmops/plans/IMPLEMENTATION_PLAN.md`.
- **CRM extras** — campaign-recipient activity rows on contacts (post Half 1); housekeeping last-run markers cleanup (small sweep).

**Pending SKU management test verifications** (code deployed 2026-02-19):
- Vendor SKU Update — not yet tested
- Trim safety — not yet tested
- (Product Replacement tested and working.)

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

_(Cross-project notes land here during sessions. Triaged at end of workday in cleanup sessions; verified clean at start of next session.)_

### Active

- **2026-04-29: Nav menu structure + mobile review.** Audit desktop layout, mobile drawer hierarchy, deep-link targets (e.g., `#footer-contact`). What customers actually need vs what the menu currently has. Check mobile drawer appearance against design system.
- **2026-05-07: Examine nav menu — is it optimal?** User-flagged note for a future session; no specific issue stated. Likely overlaps with the 2026-04-29 nav-review item — consider as a single audit pass.

### Deferred

- **2026-05-04: Offline-channel attribution scheme** `defer:2026-07-01` — When SE-of-Katamon flyer drops + newsletter inserts ship, need unique coupon code per offline campaign (e.g., `JLMSE50`) + UTM-tagged QR codes feeding GA4. First-order coupon system already supports per-code restrictions. Define naming convention + QR generator setup when offline campaigns are about to ship. Specific neighborhood SE of Katamon (Talpiot/Arnona/Mekor Haim/Baka) — TBD.
- **2026-05-05: Drive folder structure — legacy import folder out of place** `defer:2026-06-01` — Folder used by jlmops for Comax product CSV import sits in the legacy app's Drive location. New jlmops Drive parent has its own `export` and other subfolders; import folder should be moved under there. Action: move folder in Drive, then update the corresponding `system.folder.*` SysConfig key (likely `system.folder.imports`) so jlmops sync still finds it. Verify a sync cycle picks up the new location after the move.
