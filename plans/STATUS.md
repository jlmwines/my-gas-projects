# JLM Wines — Current Status

**Updated:** 2026-02-27

## Metrics

| Metric | Value |
|--------|-------|
| Phase | Stable |
| Last Active | 2026-02-27 |
| Revenue | Steady |
| Deploy Version | @68 |
| Deploy Date | 2026-02-24 |
| Content | 7 posts live on production (EN+HE), remaining resume May |
| CRM Contacts | 548 enriched |
| SEO Status | Not set up — TOP PRIORITY |
| Open Bugs | 2 (vendor SKU update, trim safety — untested, both low priority) |
| Next Milestone | SEO setup + 15-min order trigger + Pesach campaign |
| Blockers | 0 |

## Next Action

- **Woo API order pull integrated into sync flow.** `importWebOrdersBackend` now pulls fresh orders from WooCommerce API before processing (seamless — replaces CSV upload). Hourly auto-pull still runs independently. Sync widget reverted to simple linear flow (removed confusing Pull Now / Skip to Comax buttons).
- **Content: 7 posts live on production (EN+HE).** Remaining posts (Selection, Price vs Quality) resume May.
- **About Page rebuilt** (EN ID 63644, HE ID 63649) — clean HTML replacing Elementor. User must disable Elementor on each page for new content to render.
- **Marketing ACTIVE:**
  - Seasonal bundle update in progress targeting Pesach wine sales, email campaign in preparation
  - Coupon active: NIS 50 off for new customers with minimum order
- **Test SKU management fixes** (deployed, partially verified):
  1. Vendor SKU Update: *(not yet tested)*
  2. ~~Product Replacement~~ → ✓ Tested, working.
  3. Trim safety: *(not yet tested)*
- **Website font optimization** — Open Sans loading 10 variants → 2-3 needed. Deferred pending WPML check.
- Build `CampaignService.getTargetSegment()` for segment export
- Start small comeback campaign testing
- Research PDF generation for Year in Wine

## Current State

- **Sync workflow:** Stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce). Imports, exports, validation all working.
- **CRM enrichment:** Complete. 548 contacts enriched with dual-language preferences (categories, wineries, grapes, kashrut). Activity backfill working.
- **Campaign system:** Planned (`jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md`), not yet built. Key decisions made: welcome offer NIS 50 off 399, Tuesday evening sends, 7-14 day attribution window.
- **First Mailchimp campaign:** Text and link ready (pending partner review). Two separate sends — EN and HE to language-segmented lists. Claude to build HTML email bodies. Mailchimp segments already set up.
- **Import system:** Woo REST API pull deployed and tested (Feb 2026). Order pull: 30-day rolling window, upsert via existing OrderService pipeline. Credentials in SysEnv sheet (separate from SysConfig). Replaces manual CSV exports.
- **Admin UI:** Contact preferences display, activity ribbon icons.
- **SKU management fixes:** Deployed 2026-02-19. Product replacement tested and working (bug fix: relaxed validation to find WebProdM row by SKU when web ID is empty). Vendor SKU update and trim safety still awaiting test.
- **Website performance:** Slider Revolution deactivated, Jetpack stats/WooCommerce Analytics tracking disabled. PageSpeed: mobile 57, desktop 82. Font optimization pending.
- **Content pipeline:** COMPLETE. All 8 posts (16 files EN+HE) live on staging6. `push-posts.js` pushes via WP REST API with ID-based updates. Posts authored as `.post.md` files with complete WP block HTML including placed images. About Page rebuilt as clean HTML (`.page.md` files) replacing Elementor — pushed directly via REST API to page IDs. Canva AI generates images from Claude-written prompts (impressionist oil painting style).

## Known Issues

1. Monitor bundle additions for stale data recurrence
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
- **Theme replacement:** Replace KoWine theme and current plugins with a Claude-built lightweight theme for Elementor Pro with WPML. Goals: improve performance (PageSpeed baseline 57/82), add features, reduce vendor dependency. Needs planning session.

## Session History

- **2026-02-27:** Two bug fixes + Pesach email draft.
  - **Sync widget race condition:** Stale poll responses (initiated before an action) could arrive after the success handler and overwrite the UI with old state. This caused the Generate button to reappear after web export completed, requiring a second click. Fix: track `lastActionTimestamp`, discard poll responses with older `lastUpdated`. Files: `AdminDailySyncWidget_v2.html`
  - **Bundle health check crash:** `getEligibleProducts()` referenced undefined `spreadsheet` variable when accessing WebDetM for slots with intensity/complexity/acidity criteria. Same class of bug as the Feb 24 fix in `getBundlesWithLowInventory` — a second instance in a different function. The crash killed the entire bundle health check silently, preventing zero-stock alerts. Fix: use `SheetAccessor.getDataSheet('WebDetM', false)`. Files: `BundleService.js`
  - **Pesach email:** Created HTML Mailchimp email draft (English) from spreadsheet content. Iterated to personal tone: no logo, no branded button, no decorative cards — just text with inline links like a personal note. Two section headlines ("How much wine?" / "Which wines?") with inline bold for Easy Starters / Dining in Style. CTA is text link to `/product/seasonal-wines/`. WP media library has 5 Pesach images (pesach-3, pesach-mosaic, pesach-banner). **In progress:** deciding whether to add an image. File: `exchange/pesach-email-en.html`
- **2026-02-25:** Sync widget UX fix — reverted to simple linear flow.
  - **Problem:** After Woo API integration, sync widget showed confusing "Start Import" + "Skip to Comax" buttons at IDLE, plus per-step "Pull Now" buttons that operated outside the state machine. User imported products and pulled orders, but state machine stayed at IDLE.
  - **Widget fix:** Removed Skip to Comax button, Pull Now buttons, and API pull timestamps from step cards. Back to single "Start Import" → linear step flow.
  - **Backend fix:** `importWebOrdersBackend` now calls `WooOrderPullService.pullOrders()` automatically before processing staged data. If API pull fails, logs warning and continues with existing staged data. Seamlessly replaces old CSV file upload — user experience identical to before.
  - Files modified: `AdminDailySyncWidget_v2.html`, `WebAppSync.js`
- **2026-02-24b:** Woo API deploy, testing, and bug fixes. Deployed @68.
  - **Woo API credentials:** Moved to SysEnv sheet (separate spreadsheet) so `rebuildSysConfigFromSource()` can't overwrite them. Removed consumer_key/consumer_secret from system.json.
  - **API connection verified:** 746 EN products, 746 HE products, 1237 orders.
  - **Order pull tested:** First pull brought all 1196 orders (flooded WebOrdM/SysOrdLog). Fixed: restricted to 30-day rolling window (`modified_after`), removed timestamp-based incremental logic. Pipeline already has upsert (update existing, insert new). Re-tested: 18 orders processed correctly.
  - **Admin order import updated:** "Import Web Orders" button now calls Woo API pull instead of file-based OrchestratorService flow.
  - **Manager UI:** Added "Refresh Orders" button to ManagerOrdersView.
  - **Version system:** Added VERSION constant to WebApp.js, `getVersion()` global function, version footer in AppView sidebar (visible on all pages).
  - **Bug fixes:**
    - BundleService.getBundlesWithLowInventory: `spreadsheet` was undefined — added `SheetAccessor.getDataSpreadsheet()`.
    - HousekeepingService.validateCurrentConfig: `SYS_CONFIG_DEFINITIONS` global no longer exists — rebuilt from `getMasterConfiguration()`. Skips `system.users` (special array handling).
  - **Created `/ship` skill** for JLM Wines (full release pipeline).
  - Files modified: WooApiService.js, WooOrderPullService.js, WebAppOrders.js, WebApp.js, AppView.html, ManagerOrdersView.html, BundleService.js, HousekeepingService.js, SetupConfig.js, config/system.json
- **2026-02-24:** WooCommerce REST API automated pull — full implementation.
  - **Phase 1 — Integrity fixes:**
    - 1a: Consolidated duplicate CSV parser. Deleted `_parseWebToffeeCsv()` from ProductImportService (78-line duplicate). Now routes through `WebAdapter.parseComplexCsv()`.
    - 1b: Added TTL-based invalidation (10min) to region/grape/kashrut lookup caches in ProductService. Previously these were permanent until manual invalidation.
    - 1c: No-op — `logger` is already an alias for `LoggerService` (LoggerService.js:192). No console-only logging found.
    - 1d: No-op — sanity checks already handle `0` and `"0"` correctly with `!== '' && !== null && !== undefined`.
  - **Phase 2 — WooApiService.js (new, 299 lines):** GAS-native WooCommerce REST API client. HTTP Basic Auth, auto-pagination (100/page, follows X-WP-TotalPages), exponential backoff retries (429/5xx). Config in SysConfig `woo.api.*`.
  - **Phase 3 — WooProductPullService.js (new, 351 lines):** Pulls EN products → transforms to wps_* staging format → existing validation → WebProdM upsert. Pulls HE products → extracts WPML `_wpml_original_post_id` → stages translation links → WebXltM upsert. Replaces manual language-switch CSV export workflow.
  - **Phase 4 — WooOrderPullService.js (new, 288 lines):** Pulls orders with status filter (processing, on-hold, completed, cancelled, refunded). Transforms to wos_* format with flat line item fields. Key advantage: API returns `product_id` directly — no SKU-to-WebId lookup needed. Feeds into existing OrderService.processStagedOrders pipeline.
  - **Phase 5 — Sync simplification:** SyncStateService transitions updated (IDLE → WAITING_ORDER_EXPORT/WAITING_COMAX_IMPORT). Sync widget: added "Skip to Comax" button, "Pull Now" buttons on steps 1+2, last pull timestamps. Backend: `skipToComaxBackend()`, `pullWooProductsBackend()`, `pullWooOrdersBackend()`, `getWooApiPullStatus()` in WebAppSync.js.
  - **Config changes:** 7 new entries in system.json (woo.api.*), 30 new entries in mappings.json (product + order + line item field maps). SetupConfig.js regenerated.
  - Files created: WooApiService.js, WooProductPullService.js, WooOrderPullService.js
  - Files modified: WebAdapter.js, ProductService.js, ProductImportService.js, SyncStateService.js, WebAppSync.js, AdminDailySyncWidget_v2.html, config/system.json, config/mappings.json, SetupConfig.js
- **2026-02-23b:** All 8 blog posts complete, About Page rebuilt.
  - Completed remaining posts: Acidity, Complexity, Intensity, Good Wine, Selection, Price vs Quality, About Evyatar — all EN/HE with Canva images and varied layouts.
  - About Page (EN 63644, HE 63649): Rebuilt as clean HTML+CSS replacing Elementor. Pure HTML approach (not Gutenberg blocks). EN has 5 English testimonials, HE has 5 Hebrew testimonials from Google Maps. All with 5-star gold ratings.
  - RTL handling: same DOM order as EN, flexbox mirrors automatically. Testimonial cards respect page direction.
  - About Evyatar fixes: slug corrected (no `-he` suffix), paragraphs moved into columns, vineyard images swapped L/R for directional reading.
  - Key rule: never mention "no hands" in Canva prompts (triggers Canva to add hands).
  - Files created: `content/About Page EN.page.md`, `content/About Page HE.page.md`.
  - Files modified: all 14 `.post.md` files, `content/push-posts.js`.
- **2026-02-23:** Content workflow finalized, Pairing EN/HE complete with images.
  - **Push script fixed:** Added `enId`/`heId` to manifest for ID-based updates (slug lookup was failing for HE posts — WPML uses same slug with `/he/` prefix, not `-he` suffix). Deleted orphan draft 67019.
  - **Image workflow:** Claude writes Canva AI prompts (close-up, intimate, warm oil painting style, no ratios). User generates in Canva at 4:3, uploads to WP media library. Claude places images in HTML and pushes.
  - **Layout iterations:** Tested multiple approaches — uniform text|image columns (too repetitive), full-width images (lost column context), simpler single-column (downgrade). Final: varied column layouts with asymmetric widths, flipped sides, 4-column food type grid, tinted background section, pullquote, separators.
  - **Hebrew fixes:** Removed English parentheticals from HE headings (Mild, Rich, Intense, Sweet). Fixed HE slugs in manifest.
  - **Gutenberg WYSIWYG:** Attempted editor width fix via child theme CSS — caused block distortion. Reverted. Accepted that editor ≠ front-end; workflow bypasses Gutenberg for layout.
  - **Cover block tested:** Full-width parallax cover for visual break — parallax too jarring, removed. Post works without it.
  - Pairing images: harmony-or-contrast (67012), mild (67055), cheese/rich (67043), intense (67054), sweet (67053), glass-in-hand (67041). Pour wide (67059) and flavors (67022) available but not used in final layout.
  - Files modified: `content/push-posts.js`, `content/Pairing EN_2026-01-06.post.md`, `content/Pairing HE.post.md`.
- **2026-02-22b:** Content layout workflow revision.
  - **Problem:** Previous session's `convert-posts.js` used forced 58%/42% column widths, CSS `!important` overrides, and put all text in left column with right empty. This didn't match the existing working posts on staging6.
  - **Investigation:** Pulled raw block content from all 7 existing posts via WP REST API. Found existing posts use plain `wp:columns`/`wp:column` without widths or CSS hacks, with content in both columns. Some posts (Acidity, Good Wine) have images alongside text.
  - **Failed approaches:** (1) Algorithmic column distribution — paired h3 subsections left/right, broke reading order (food types staggered). (2) Multiple column sections per post — split content into unreadable fragments on desktop. (3) Single column pair with content split by weight — still not right editorially.
  - **Solution:** New collaborative workflow. Claude produces text as clean WP blocks in left column + Canva AI prompts as visible yellow paragraph blocks at image insertion points. User generates images in Canva, arranges content and images across columns in the WP block editor.
  - **Canva style:** Oil painting, impressionist brushstrokes, warm natural lighting, no text. Matches existing featured images (Canva AI generated). Each prompt tailored to the adjacent content's mood and color palette.
  - **Fixes:** Removed CSS fix from `convert-posts.js`. Fixed `push-posts.js` to not force `status: 'draft'` (preserves existing post status on update). Added empty column pair at top of posts for layout flexibility.
  - **Pushed:** Pairing EN (ID 65344, published) and Pairing HE (ID 67019, draft). Downloaded existing post layouts to `content/existing-layouts/` for reference. Downloaded featured images for style analysis.
  - Files modified: `content/convert-posts.js`, `content/push-posts.js`, `content/Pairing EN_2026-01-06.post.md`, `content/Pairing HE.post.md`. Files created: `content/existing-layouts/*.raw.txt`, `content/existing-layouts/*.jpg`.
- **2026-02-22:** Content organization, WP tooling, and post push pipeline.
  - **Phase 1 done:** Cleaned `content/` folder. Moved 14 superseded files to `content/history/`. Extracted zip (8 EN overwrite + 8 new HE docx). Fixed leading-space filename on HE Price vs Quality.
  - **Phase 2 done:** Created `tools/wp-api.js` — zero-dependency Node.js WP REST API client. Factory pattern, reads `.wp-credentials` file (same format as AliyahNet). Exports `api()`, `findPostBySlug()`, `upsertPost()`.
  - **Phase 3 done:** Created `content/convert-posts.js` — batch pandoc→WordPress block converter. Handles Hebrew RTL markers, blockquote stripping, heading level heuristics (h2/h3). All 16 docx converted to `.post.md`.
  - **Phase 4 done:** Created `content/push-posts.js` — manifest-driven push script. 8 posts × EN/HE. Slug-based upsert. Slugs updated to match existing staging6 posts: `white-rose-wine-acidity`, `wine-complexity`, `red-wine-intensity`, `pairing-food-and-wine`, `what-makes-a-wine-good`, `how-we-choose-wines`, `does-higher-price-mean-better-wine`, `about-evyatar` (new).
  - **Phase 5 done:** `.gitignore` updated (`.wp-credentials`, `content/history/`, `content/*.zip`).
  - **Layout issue — IN PROGRESS:** WP `wp:columns` blocks render as 1 column on desktop. Root cause: Kowine theme + Elementor single post template (ID 66911) has global `.is-layout-flex{flex-wrap:wrap}` that overrides WP's column-specific `flex-wrap:nowrap`. Injected CSS fix block (`!important` override) at top of post content. Needs visual verification on staging6. Post 65344 (Pairing EN) is published for testing.
  - Files created: `tools/wp-api.js`, `content/convert-posts.js`, `content/push-posts.js`, 16 `.post.md` files, `.wp-credentials` (not in git).
- **2026-02-19d:** Website performance audit. Deactivated Slider Revolution (unused, heavy). Disabled Jetpack stats and WooCommerce Analytics tracking (redundant with GA4). PageSpeed scores: mobile 57, desktop 82. Identified font optimization opportunity (Open Sans 10 variants → 2-3 needed). Font change deferred pending WPML compatibility check.
- **2026-02-19c:** Product replacement bug fix verified. Sync widget double-click guard added (disable button immediately in `runAction`). Planned automatic order import via Woo REST API — created `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`. High priority for next jlmops session.
- **2026-02-19b:** Product replacement bug fix. `webProductReassign()` was rejecting calls when `wpm_WebIdEn` was empty in WebProdM. Relaxed validation to accept either web ID or old SKU for row identification. Added SKU-based fallback to WebProdM row lookup. Tested — replacement updates WebProdM, WebDetM, WebXltM, CmxProdM correctly. File: ProductService.js.
- **2026-02-19a:** SKU management fixes. (1) New `searchAllProducts()` for vendor SKU update — searches all non-archived products in CmxProdM, no isWeb/stock filter. (2) `webProductReassign()` now creates `task.validation.vintage_mismatch` task after replacement so stale web content gets flagged. (3) Defensive `String().trim()` on SKU comparisons in `_updateSkuInSheet` and `vendorSkuUpdate` SysTasks loop. Files: ProductService.js, WebAppProducts.js, AdminProductsView.html.
- **2025-12-25:** Import system fixes (CSV filter, validation rule, quarantine diagnostics). Hebrew translation import working (747 rows). Quarantine file preservation + detailed error messages.
- **2025-12-22:** CRM Phase 2 dual-language enrichment (10 new columns, 548 enriched, 10 skipped). Activity backfill fix. Admin UI updates. Campaign system planning (comprehensive plan + key business decisions). Plan consolidation (deleted 4 obsolete plans, created CRM_PLAN.md).

## Previous Session Summaries

Detailed session history prior to standardization is in `jlmops/SESSION_SUMMARY.md`.

## Inbox

_(Cross-project notes captured via `/note jlm <text>`. Review and clear at session start.)_

- 2026-02-26: kowine theme update may be fix for recent elementor update disrupting site appearance. will apply to staging and see if that fixes appearance.
- 2026-02-26: jlmops need a way to research product/sku state and history. what are the last tasks for this sku? when did vintage change is very important. keep product history, or rely on data?
