# JLM Wines — Current Status

**Updated:** 2026-05-05

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
| SEO Status | Not set up — TOP PRIORITY |
| Open Bugs | 1 active (Comax order export bundle SKU) + 4 grouped backlog buckets in `.claude/bugs.md` (sync hardening, CRM cleanup, timestamp/date audit, count-task creation audit) |
| Next Milestone | SEO setup (top priority) — RankMath active on live, structured-data emission to verify. Mobile LCP tuning (currently 4.0–4.1s, on the "poor" boundary). |
| Blockers | 0 |
| Mobile PageSpeed (post-cutover) | EN: FCP 3.2 / LCP 4.1 · HE: FCP 3.5 / LCP 4.0 · TBT 210ms (was LCP 7.2 / FCP 3.9 pre-cutover — ~43% LCP improvement) |
| Desktop PageSpeed (post-cutover) | EN: FCP 0.7 / LCP 0.8 · HE: FCP 0.7 / LCP 1.2 |

## Next Action

**Theme cutover SHIPPED 2026-05-05.** Approach taken: SiteGround staging→live promote (after a failed activate-in-place attempt revealed page content existed only on staging). Live now runs jlmwines-theme v1.2.1 with Mailchimp pulls + post-sync bundle health auto-trigger.

**Post-cutover follow-ups (queued):**

1. **WPML String Translation cleanup** — untranslated WC chrome strings (catalog result-count phrases, default WC dropdown labels) currently patched via `gettext`/`ngettext_with_context` filters in `inc/shop-filters.php`. Move to WPML String Translation DB entries.
2. **Catalog filter sizing** — user noted larger than desired on live; tune CSS in `inc/shop-filters.php` / main.css.
3. **Mobile LCP tuning** — current 4.0–4.1s sits on the "poor" boundary. Targets: hero image format/size, render-blocking script audit.
4. **24–48hr error log + order monitoring** per checklist Stage 3.
5. **WC term thumbnails refresh** — admin-side images in wp-admin → Products → Categories still old; customer-facing pages already use theme overrides.
6. **SG Optimizer re-enablement test** — currently fully OFF on live (PDP product-card white background was missing with it on; disabling Combine/Minify alone didn't fix it). Re-enable one setting at a time with cache purge + hard refresh between each: memcached/browser cache, web fonts + emoji, then dynamic cache (flush before test), then combine, then minify. Identify and leave off whichever setting breaks rendering.
7. **Untranslated strings audit** — walk live in EN and HE, list every visible English string on HE pages (and vice versa). Most likely surfaces: WC chrome (cart/checkout/account), PDP variation labels, Complianz banner, plugin-emitted strings. Resolve via inline `is_rtl()` baking (theme-owned) or WPML String Translation (plugin/WC chrome).
8. **Unused plugin cleanup on live** — delete deactivated plugins to reduce attack surface and update noise. **DO NOT DELETE `mailchimp-woocommerce`** — its `wp_options` API key is what the theme's replacement code reads. Safe to delete: `woo-smart-wishlist`, `WPBingo`, `redux-framework`, `Elementor` + `Elementor Pro` (after verifying no remaining Elementor pages — search wp-admin → Pages for the Elementor edit indicator), `widget-importer-exporter`, `better-search-replace`, `wp-file-manager`. Verify-before-delete: `contact-form-7` + CF7 multilingual (any forms in use?), `variation-swatches-for-woocommerce` (variation selector acceptable without it?), `woocommerce-checkout-field-editor` (any custom checkout fields configured?).

**Other in-flight initiatives** (unchanged from coordination doc):
- ~~jlmops Half 1 — Mailchimp daily pull.~~ **SHIPPED 2026-05-05 as @81.** `MailchimpService` HTTP wrapper + `ContactImportService.importFromMailchimpApi()` + `CampaignService.pullRecentCampaigns()` wired into housekeeping phase 3. AdminContactsView card-header has `⟳ MC` button + `MC subs/camp` freshness display. First live run: 7 new prospects, 63 subscription-state corrections, 3 unsubscribe activities; 2 campaigns upserted. Half 2 (action layer — first-order welcome trigger, partner mobile follow-up UI) is the next CONTACT_MANAGER_PLAN section, not started.
- Newsletter v1 — printed monthly insert (online + store handout). Plan written. First issue post-cutover.
- Comeback campaign segment export + test send. Calendar item.
- Year in Wine PDF research. Calendar item.
- New calendar items added 2026-05-05: bundle composition / member condition split (Phase 14 in `IMPLEMENTATION_PLAN.md`), campaign-recipient activity rows on contacts (post Half 1), housekeeping last-run markers cleanup (small sweep — see `CALENDAR.md`).

**Test SKU management fixes** (deployed, partially verified):
- Vendor SKU Update: not yet tested
- Product Replacement → ✓ tested, working
- Trim safety: not yet tested
- ~~**Age verification modal (CUTOVER BLOCKER).**~~ **SHIPPED v1.0.81 + v1.0.82.** `inc/age-gate.php` renders bilingual modal at wp_footer with logo (white-bg JLM stamp), headline ("Before we begin..." / "לפני שנתחיל..."), question ("Are you 18?" / "כבר חגגת 18?"), Yes/No buttons (Yes-on-right in both languages via `:dir(rtl) flex-direction: row-reverse`), eligibility body and Israeli law warning. Cookie `jlmwines_age_verified` 30-day persistence. Logged-in users auto-skip via `body.logged-in` class check. JS-only show/hide for page-cache compatibility. "No" → google.com redirect. Z-index 10000. User approved.
- **RankMath now inactive on staging (back to baseline state).** User deactivated post-audit to avoid staging-URL sitemap submission. og:locale fix (`inc/seo-fixes.php`, v1.0.78) verified working when RankMath was briefly active; will activate on live at cutover. No staging-plugin-baseline re-snapshot needed.
- **jlmops Half 1 — Mailchimp daily pull (NEXT THEME-INDEPENDENT SESSION).** Plan resolved 2026-05-03 in `jlmops/plans/CONTACT_MANAGER_PLAN.md` Half 1. Replaces manual CSV with daily API pull (subscribers + campaigns). Decisions: keep `sc_IsSubscribed` boolean (no schema change), Mailchimp = source of truth, one-way pull, per-contact engagement out of scope. Audience IDs captured in plan doc. 7 build steps spelled out: SysEnv `MAILCHIMP_API_KEY` row → `MailchimpService.js` HTTP wrapper → `ContactImportService.importFromMailchimpApi()` → campaigns sync (60-day rolling window) → `HousekeepingService` daily wiring → last-update markers → DevelopmentView smoke-test trigger. API key already saved locally at `exchange/.mc-credentials` (gitignored).
- Build `CampaignService.getTargetSegment()` for segment export
- Start small comeback campaign testing
- Research PDF generation for Year in Wine

## Current State

- **Sync workflow:** Stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce). Imports, exports, validation all working.
- **CRM enrichment:** Complete. 548 contacts enriched with dual-language preferences (categories, wineries, grapes, kashrut). Activity backfill working.
- **Campaign system:** Planned (`jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md`), not yet built. Key decisions made: welcome offer NIS 50 off 399, Tuesday evening sends, 7-14 day attribution window.
- **First Mailchimp campaign:** Text and link ready (pending partner review). Two separate sends — EN and HE to language-segmented lists. Claude to build HTML email bodies. Mailchimp segments already set up.
- **Import system:** Full Woo REST API pull (products + translations + orders) deployed Feb 2026. "API Pull" button runs entire pipeline with step-by-step progress in sync widget. Order pull: 30-day rolling window, upsert via existing OrderService pipeline. Credentials in SysEnv sheet. Plan: `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`.
- **Admin UI:** Contact preferences display, activity ribbon icons. Task list: created date column in state 3, created date in detail panel, reduced font sizes + rebalanced columns (in test, not deployed).
- **SKU management fixes:** Deployed 2026-02-19. Product replacement tested and working (bug fix: relaxed validation to find WebProdM row by SKU when web ID is empty). Vendor SKU update and trim safety still awaiting test.
- **Website performance:** Round 1 of SG Optimizer tuning complete (2026-04-15). Enabled: Web Font Optimization, Combine/Minify CSS + JS, Ultrafast PHP. Captured font-display (1,230 ms) and minify CSS/JS in full. Lab LCP 11.0 s → 7.2 s, FCP 5.3 s → 3.9 s. Field CWV still Failed (28-day rolling window hasn't reflected changes yet). Remaining work requires theme swap — see 2026-04-15b session entry for full diagnosis.
- **Content pipeline:** COMPLETE. All 8 posts (16 files EN+HE) live on staging6. `push-posts.js` pushes via WP REST API with ID-based updates. Posts authored as `.post.md` files with complete WP block HTML including placed images. About Page rebuilt as clean HTML (`.page.md` files) replacing Elementor — pushed directly via REST API to page IDs. Canva AI generates images from Claude-written prompts (impressionist oil painting style).

## Known Issues

1. ~~Monitor bundle additions for stale data recurrence~~ → Fixed: bundle composition auto-refreshes before health check
2. Consider auto-cleanup of rows below data range during upsert
3. Gutenberg editor width doesn't match Elementor front-end (accepted limitation — use Preview or API push workflow)

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

_(Cross-project notes from other sessions land here. Review and clear at session start.)_

- **2026-05-04: Offline-channel attribution scheme (future).** When SE-of-Katamon flyer drops + newsletter inserts ship, we need to know which leads come from where. Lightest path: **unique coupon code per offline campaign** (e.g., `JLMSE50` for the SE-Katamon flyer drop) + **UTM-tagged QR codes** that feed into GA4. The first-order coupon system already supports per-code restrictions. Define naming convention + QR generator setup when offline campaigns are about to ship. The specific neighborhood SE of Katamon (Talpiot? Arnona? Mekor Haim? Baka?) — TBD; user couldn't recall, possibly captured in a prior session not in current docs.
- **2026-05-04: Update `website/MARKET_CONTEXT.md` "57 days" framing.** Line 99 currently calls 57 days "The Goal" but it's actually an observed average; the working goal is 90 days (per `business/KPI.md`). Reword next time MARKET_CONTEXT is touched.
- 2026-02-26: kowine theme update may be fix for recent elementor update disrupting site appearance. will apply to staging and see if that fixes appearance.
- 2026-02-26: jlmops need a way to research product/sku state and history. what are the last tasks for this sku? when did vintage change is very important. keep product history, or rely on data?
- ~~2026-03-06: Manager inventory view: 1. Create count task failed. 2. Open inventory tasks need to show entity id (SKU) and product name in list.~~ → Fixed 2026-03-09 (c1af348)
- 2026-03-09: Vintage update tasks from late February not assigned to manager. Recent ones are fine. Check what changed — may have been the task.inventory.count fix or a routing issue.
- ~~2026-03-10: jlmops task shows "Published But Archived (Summary: 446 Items)". Archived in Comax with zero inventory is OK if web shows zero stock.~~ → Fixed 2026-04-17 (@76)
- 2026-03-10: Decanting field can be skipped — system should allow zero (0) as a valid value, not treat it as empty/skippable.
- ~~2026-04-27: Bundle/package product images need re-export with transparent background.~~ → **Resolved 2026-05-04** — product page background changed to white, no re-export needed.
- 2026-04-28: Theme breadcrumbs — add to shop/PDP/cart/account flow (`woocommerce_before_main_content`). Style with David Libre or Rubik UI? Probably Rubik 13px muted. Decide before `inc/woocommerce.php` build.
- ~~2026-04-28: Coupon behavior — first-purchase restriction.~~ → **Resolved 2026-05-04** — first-purchase coupon feature activated.
- 2026-04-28: Checkout appearance — improve the WooCommerce checkout look (form layout, payment-method visuals, order-review polish). Currently using Woo defaults under the new theme; styling pass needed when `inc/woocommerce.php` lands.
- ~~2026-04-28: Mobile UI redesign direction (KoWine pattern: 3-zone header, bottom nav with shop/account/search/whatsapp).~~ → **Resolved 2026-05-04** — mobile footer (bottom nav) settled.
- ~~2026-04-28: Theme footer needs work (contact block, language-group newsletter, payment icons, Terms link).~~ → **Resolved 2026-05-04** — footer has payment icons and links. Newsletter language-group already wired (v1.0.74).
- ~~2026-04-29: Checkout-field customization plugin replacement.~~ → **Resolved 2026-05-04** — function replaced (checkout field plugin no longer needed).
- ~~2026-04-29: Coupon plugin plan (Smart Coupons / Advanced Coupons / theme-side).~~ → **Resolved 2026-05-04** — coupon plugin removed; first-purchase coupon feature activated natively.
- 2026-04-29: **Gift page check.** Verify whether the gift page (likely `/gift/` or `/gift-card/`) currently renders or is Elementor-dependent like the old Articles page. If broken, build a clean template or convert to plain HTML + theme helpers.
- 2026-04-29: **Nav menu structure + mobile review.** Audit desktop layout, mobile drawer hierarchy, deep-link targets (e.g., `#footer-contact`). What customers actually need vs what the menu currently has. Check mobile drawer appearance against design system.
- ~~**2026-04-29: PARKED — Free-shipping monitor on /cart/ shows stale text.**~~ → **Fixed 2026-05-01 (v1.0.72, diagnostic stripped in v1.0.73).** Root cause: WC's `cart.js` AJAX `update_wc_div()` only replaces `.woocommerce-cart-form`, `.cart_totals`, and notices. Our monitor was hooked at `woocommerce_before_cart` (outside the form) so the Update Cart AJAX response correctly contained the new monitor markup but `update_wc_div` left the stale DOM in place. Moving the hook to `woocommerce_before_cart_table` (inside the form) lets WC's selective replace swap the monitor along with the form. POST response confirmed correct via DevTools Network → Response on the live broken state.
- **2026-05-01: Checkout opt-in misses Language group.** Customers who tick the newsletter opt-in at WC checkout are subscribed to Mailchimp but not assigned to the EN/HE group. **Plan:** after the footer signup form lands (Path B — direct POST to Mailchimp with hidden Language group), add a `woocommerce_thankyou` hook that PUTs the customer's Language interest to the same group based on the order's WPML language. Uses Mailchimp API directly (read API key from `mailchimp-woocommerce` plugin's stored options); no dependency on the plugin's filter API. Same group/interest IDs as the footer form. Skeleton scaffolded in `inc/mailchimp-language-group.php` with placeholder constants — fill in once Mailchimp IDs are known.
- ~~**2026-05-04: CUTOVER BLOCKER — `front-page.php` rework to real Page.**~~ → **RESOLVED 2026-05-04 via inline `is_rtl()` (theme v1.0.88).** All `__('…','jlmwines')` wrappers around static content were converted to `is_rtl() ? 'HE' : 'EN'` baked-inline form across the whole theme. HE strings sourced from live HE site (chrome) and the user-reviewed `exchange/strings/jlmwines-he-draft.po` (homepage sections + brand-voice copy). The `'jlmwines'` textdomain is now zero-use across the theme (verified by grep). Files changed: `front-page.php`, `inc/sections.php`, `header.php`, `footer.php`, `inc/bottom-nav.php`, `inc/mini-cart.php`, `woocommerce/cart/mini-cart.php`, `inc/woocommerce.php`, `404.php`, `index.php`, `archive.php`, `search.php`, `comments.php`, `template-articles.php` (obsolete `.po` comment removed), `functions.php` (`load_theme_textdomain` removed, `register_nav_menus` labels switched to plain English admin labels), `inc/coupons.php` and `inc/customize.php` (admin-only labels switched to plain English literals). The 72-entry `exchange/strings/jlmwines-he-draft.po` is now orphaned — keep as Hebrew-copy reference or delete. **Optional future enhancement (not a cutover blocker):** convert homepage from `front-page.php` template to a real WP Page with WPML duplicates (the About model). That would require authoring shortcodes for the dynamic loops (bundles, packages, posts, testimonials). Current inline-`is_rtl()` implementation satisfies the rule (text stored in advance, no runtime translation) without that scope.
- **2026-04-30: Holistic planning session — COMPLETE.** Cross-area planning across business / marketing / website / jlmops. All session conclusions captured in proper plan docs (no remaining inbox content from this session). New top-level coordination view at `business/COORDINATION.md`. Brand standards index at `business/BRAND_STANDARDS.md`. Sequence: theme cutover → newsletter v1 → contact manager Half 1 (Mailchimp pull) → Half 2 (action layer) → cross-sell calc + push → JLMops→WC attribute push (deferred). Plan docs created or updated: `business/COORDINATION.md` (new), `business/BRAND_STANDARDS.md` (new), `marketing/NEWSLETTER_PLAN.md` (new), `jlmops/plans/CROSS_SELL_PLAN.md` (new), `jlmops/plans/CONTACT_MANAGER_PLAN.md` (new), `plans/TRANSLATION_PLAN.md` (new), `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` (added "What didn't work" / Year in Wine retrospective), `jlmops/plans/CRM_PLAN.md` (replaced classification bug section with simplified rule), `jlmops/plans/IMPLEMENTATION_PLAN.md` (refined Phase 14 bundle model + narrow-scope attribute push backlog entry).
- **2026-05-05: Drive folder structure — legacy import folder out of place.** The folder used by jlmops for the Comax product CSV import is in the legacy app's Drive location. The new jlmops Drive parent has its own `export` and other subfolders; the import folder should be moved under there for consistency. Action: move the folder in Drive, then update the corresponding `system.folder.*` SysConfig key (likely `system.folder.imports` or similar) so the jlmops sync still finds it. Verify a sync cycle picks up the new location after the move.
