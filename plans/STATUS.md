# JLM Wines — Current Status

**Updated:** 2026-04-27c

## Metrics

| Metric | Value |
|--------|-------|
| Phase | Stable |
| Last Active | 2026-04-27 |
| Revenue | Steady |
| Deploy Version | @79 |
| Deploy Date | 2026-04-26 |
| Content | 7 posts live on production (EN+HE), remaining resume May |
| CRM Contacts | 548 enriched |
| SEO Status | Not set up — TOP PRIORITY |
| Open Bugs | 2 (vendor SKU update, trim safety — untested, low priority, rare conditions) |
| Next Milestone | Theme replacement + SEO setup |
| Blockers | 0 |

## Next Action

- **API Pull deployed (@69, 2026-03-03).** Full pipeline (EN products → HE translations → orders via Woo REST API) confirmed working in daily sync. API Pull is now the primary button in the sync widget. CSV Import remains as fallback. Timestamps throughout sync now Israel time. Stale-poll UI bug fixed (Generate button no longer reappears after action completes).
- **Content: 7 posts live on production (EN+HE).** Remaining posts (Selection, Price vs Quality) resume May.
- **About Page rebuilt** (EN ID 63644, HE ID 63649) — clean HTML replacing Elementor. User must disable Elementor on each page for new content to render.
- **Marketing ACTIVE:**
  - Coupon active: NIS 50 off for new customers with minimum order
  - Pesach campaign sent (early March); next seasonal push TBD
- **Test SKU management fixes** (deployed, partially verified):
  1. Vendor SKU Update: *(not yet tested)*
  2. ~~Product Replacement~~ → ✓ Tested, working.
  3. Trim safety: *(not yet tested)*
- **Website performance — theme swap planning next session.** SG Optimizer toggles captured first round of wins (font-display, minify, combine CSS/JS). Remaining 1,460 ms render-block and 226 KiB unused CSS are structural limits that only a theme swap can reach. See 2026-04-15b session entry for full diagnosis.
- **Design standards phase complete (2026-04-27).** `plans/design-system/` is the design contract for the theme replacement. David Libre + Rubik, no italic, single bundle/package chassis, Woo native sale flash, contextual filters, single PDP. Live homepage and About page palettes (navy/gold and tan/cream) will be rebranded to the new tokens when the theme ships. Demo at `plans/design-system/index.html`.
- **Foundation review phase complete + theme build started (2026-04-27c).** All 7 gaps in `plans/THEME_FOUNDATIONS.md` resolved or appropriately deferred. Pre-build action items: none. Theme build phase active on staging6: `website/jlmwines-theme/` exists with v1.0.7 installed and active on staging. Phase 2 (scaffold) complete; Phase 3 (core templates + design system port) in progress — sticky header, product search, nav with submenu dropdowns, WPML lang switcher (in menu), cart icon with badge, footer (newsletter + 4-col + base) all working. Cutover model switched to SG staging-to-live push with `theme-state.json` for state portability. **Outstanding build TODOs:** free shipping monitor, mobile nav, `front-page.php`, translation harvest, Woo hook customizations (`inc/woocommerce.php`), front-page hero/sections, page templates for 16 Elementor pages, performance tuning.
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
- **Theme replacement:** PLAN WRITTEN at `~/.claude/plans/unified-sparking-galaxy.md`. Minimal Elementor-compatible theme ZIP to replace KoWine, eliminating Wpbingo Core + Redux Framework. Scoping session next — 2026-04-15 performance diagnosis confirmed theme stack is the remaining structural bottleneck.

## Session History

- **2026-04-27c:** Theme build phase started. Closed remaining theme-prep gaps and started building `jlmwines-theme/` on staging6. Theme is installable, active on staging, with real header/footer markup, design system styling, sticky scroll, product search. No production changes; staging only.
  - **Gap audit closure.** All 7 gaps in `THEME_FOUNDATIONS.md` resolved or appropriately deferred — pre-build action items: none. Closed Gap #5 (bundle/package theme rendering): bundle/package/accessory grids are stock WC category grids; contextual filtering is stock WC layered nav; PDP CSS is routine build-phase styling; folds into general WC theme compatibility. False-alarm "Product Bundles plugin compatibility" gap I raised was not added to the dashboard (covered by general WC theme compatibility).
  - **Ally accessibility plugin verified.** Theme switch test: Ally icon disappeared but tab-key accessibility still worked. Ally site confirms theme-agnostic, no Elementor dependency. Build-phase note added: ensure new theme's `footer.php` calls `wp_footer()` so Ally icon renders.
  - **Cutover model rewritten in `THEME_REPLACEMENT_PLAN.md`.** Switched from "upload theme zip via wp-admin + deactivate plugins in order" to **SG staging-to-live push** model. Plugin deactivations happen on staging (Build phase step 7); cutover is single atomic SG push-to-live. Order frequency low (hours to days between orders) makes the cutover window forgiving — retry-friendly. Added `theme-state.json` + `inc/theme-state.php` to architecture for export/import of theme-managed options across staging refresh cycles. Added "Periodic staging refresh pattern" section: zip theme + export state → SG pull from live → unzip + import + re-push posts. Removes the manual "remember to redo settings" step.
  - **STATUS.md cleanup.** Pesach campaign reference removed from active milestone (campaign shipped early March per 2026-02-27b session).
  - **Theme build started: `website/jlmwines-theme/`.**
    - **Phase 2 (scaffold) complete:** `style.css`, `functions.php`, `header.php`, `footer.php`, `index.php`, plus structural stubs (`singular.php`, `archive.php`, `search.php`, `404.php`, `comments.php`, `woocommerce.php`). Theme is installable on staging6.
    - **Critical-error during first activation:** plugins expecting Elementor crashed against bare theme. Resolved by deactivating Elementor + Elementor Pro + Wpbingo Core + Redux Framework + WPC Smart Wishlist + WP File Manager + CF7 + WPML for CF7 on staging (planned for cutover anyway). User also opportunistically deactivated Mailchimp / Jetpack / Google for testing — re-enable as needed.
    - **Phase 3 (design system port + interactive bits):** Copied `plans/design-system/styles.css` → `assets/css/main.css` (700-line design system port). `inc/enqueue.php` registers Google Fonts (David Libre + Rubik) + main.css with `filemtime` cache busting (fixed a bug where `JLMWINES_VERSION` constant was static, causing browser cache to serve stale CSS through 4 zip uploads). Real `header.php`: SVG sprite (cart/plus/check), `the_custom_logo()` with text fallback, primary nav menu (with submenu dropdown CSS), Woo cart icon with count badge, product search form (post_type=product, hidden under 960px). Real `footer.php`: newsletter callout (MC4WP shortcode if present, else placeholder), 4-column nav, base row with copyright + WPML switcher (WPML lang switcher removed from header per user; lives in primary menu instead). `assets/js/main.js`: sticky-scroll detection, toggles `.is-scrolled` class for compress/shadow effect. CSS additions for WP integration: nav-menu list reset, submenu dropdowns (hover/focus to open), `.site-main` width constraint matching `--container-max`, custom-logo sizing (max-height 48px), block alignment helpers, screen-reader-text helper.
    - **Latest pushed:** v1.0.7 with sticky-scroll JS + product search. Tested through 7 zip iterations.
  - **Inbox addition:** bundle/package images need re-export with transparent bg (currently white, visible against new beige page bg). Production task, Canva "Remove background" or equivalent.
  - **Outstanding theme-build TODO list (build-phase items):**
    - Free shipping monitor (Woo shipping zone integration + bilingual messages + multi-position rendering — design system CSS already in main.css)
    - Mobile nav (hamburger toggle + drawer + mini-cart on small screens)
    - `front-page.php` — homepage with hero, bundles row, packages row, "Why Trust Me," category tiles, testimonials, Wine Talk previews
    - Translation harvest from WPML String Translation → seed `.po` for theme strings
    - `inc/woocommerce.php` — Woo hook customizations (gallery, loop, account menu, mini-cart drawer, floating add-to-cart bar, sale flash override, free-shipping monitor positions)
    - `inc/wpml.php` — switcher helper, menu sync notes
    - `inc/theme-state.php` — export/import handler for `theme-state.json`
    - WhatsApp button + age verification modal (theme-side rebuilds)
    - Migrate 16 Elementor pages to PHP templates
    - Performance tuning to hit ≥90 Lighthouse
  - **Estimate (revised aggressive cadence, daily work):** ~1–2 weeks build + 1–2 weeks verification = cutover early-to-mid May 2026. Build phase ~3–5 days, verification is the long pole.
  - Files created: `website/jlmwines-theme/style.css`, `functions.php`, `index.php`, `header.php`, `footer.php`, `singular.php`, `archive.php`, `search.php`, `404.php`, `comments.php`, `woocommerce.php`, `inc/enqueue.php`, `assets/css/main.css`, `assets/js/main.js`. Build artifact: `exchange/jlmwines-theme.zip`.
  - Files modified: `plans/STATUS.md`, `plans/THEME_FOUNDATIONS.md`, `plans/THEME_REPLACEMENT_PLAN.md`.

- **2026-04-27b:** Foundation review for theme replacement. Captured strategic anchors and identified 7 gaps to close before build phase. No production code changed.
  - **Foundation read.** Confirmed business model (anti-snob, EN+HE moat, retention via 57-day cycle, Evyatar-as-product), audience segments (Frustration-Avoiders / Curious Explorers / Gift Senders / Know-What-I-Want), voice rules (first-person Evyatar vs "we", no jargon, never negative, no "ritual"/"cheap wine"), Israeli context (price sensitivity, word-of-mouth, ₪399 free shipping, occasion-first navigation), and visual identity already locked in `design-system/RATIONALE.md`.
  - **Foundation gap.** Strategic anchors existed in `business/`, `website/`, `content/` but were not anchored in `plans/`; theme replacement plan only had a one-line voice gesture. Future cold reads of theme work would miss the strategy.
  - **Plan: `THEME_FOUNDATIONS.md`** — pointer-style strategic anchor for the entire theme workstream. Pulls business model, segments, voice rules, sensory framework note, Israeli context constraints, visual identity headline, source-doc index. Adds a live 7-gap dashboard (Open gaps — theme prep) updated as gaps progress. Cross-referenced from `THEME_REPLACEMENT_PLAN.md`, `design-system/RATIONALE.md`, `EDITORIAL_TOKEN_MIGRATION.md`.
  - **Gap #1 plan locked: `EDITORIAL_TOKEN_MIGRATION.md`.** Migrate 18 editorial source files (16 `.post.md` + 2 `.page.md`) from ad-hoc tokens (`#faf6f1`/`#5a4a3a`/`#C0A483` cream/brown/tan + 6–10px radius + soft shadows) to design system tokens (`#ffffff` surface / `#1a1612` ink / `#a83920` terracotta + 0 radius + no shadow). Two `sed` passes specified. User confirmed callout backgrounds → surface white. Implementation awaits "go."
  - **Gap #2 in discussion: hero / marketing imagery direction.** Three registers identified — catalog PNG (locked), Canva impressionist oil painting (locked for blog), hero/lifestyle/campaign (open). Three splits on the table:
    - A: real photo wherever Evyatar appears; Canva for atmospheric only
    - B: Canva everywhere lifestyle, including painted Evyatar-likeness for hero/marketing
    - C (recommended): hybrid — real photo at highest-trust moments only (Meet Evyatar page hero, packing slip insert, exit popup); Canva impressionist for homepage hero, campaign banners, About interior. Concentrates real photography where trust is the explicit job; uses painterly register where atmosphere/seasonality matters.
    - User has not picked.
  - **Gaps #3–#7 not started.** Voice in `.po` strings (which components first-person vs "we"), gift sender path visibility (homepage hero CTA vs current menu placement), bundle/package content parity (theme grids must not assume EN/HE counts match), design-system open items (loading/empty states, cart layout, forms, iconography, Complianz scroll-jump), performance acceptance criteria (tool, profile, threshold).
  - Files created: `plans/THEME_FOUNDATIONS.md`, `plans/EDITORIAL_TOKEN_MIGRATION.md`.
  - Files modified: `plans/THEME_REPLACEMENT_PLAN.md` (cross-ref to foundations), `plans/design-system/RATIONALE.md` (cross-ref to foundations), `plans/STATUS.md`.

- **2026-04-27:** Theme replacement — design system standards phase. Resolved all open typography and component decisions; demo and rationale fully aligned with the resolved spec. No production code changed.
  - **Display font:** Frank Ruhl Libre rejected on prior session as too liturgical in Hebrew. Considered Bellefair (single-weight 400, breaks scale), David Libre, sans-serif Hebrew options. Chose **David Libre** (Ismar David, 1950s revival; 400/500/700) — modern enough to read editorial, distinctly not prayerbook.
  - **No italic anywhere** — Hebrew italic leans against RTL eye motion (browsers fake-skew Hebrew italic, fights reading). Voice/emphasis instead carried by family shift (David Libre among Rubik), color (terracotta), weight bump. Eyebrow becomes David Libre 18px regular in terracotta.
  - **Bundle/package cards:** one chassis. Catalog grouping (separate Bundles/Packages sections) carries primary distinction; tag pill (ink "Bundle" / terracotta "Package") + cream vs warm-tinted background carries the rest. Dropped the dual flat-illustration vs grouped-PNG dual-track from the original spec. Bundles' contents may rotate, so imagery never identifies specific products.
  - **Discount badge:** hooks WooCommerce native `span.onsale`. Product Bundles plugin sets `is_on_sale()` through standard API so flash fires automatically on packages and sale-priced products. Theme CSS overrides default red-circle to amber sticker top-corner. Optional `woocommerce_sale_flash` filter for "Save ₪X" copy. No custom widget.
  - **Catalog filters:** contextual — only render attribute filters that apply to the current result set. Sensory triad ordered intensity → complexity → acidity. Bundles/packages have no sensory attributes; dry reds/whites each have 2 of 3. Kashrut and grapes are not stored as attributes — no filter UI for them.
  - **Production features inventory** added to RATIONALE.md: sticky header, header search, mini-cart drawer, free-shipping monitor (single component, multiple positions), WhatsApp icon (+972555174805 — bottom-corner, opposite to floating cart), Elementor age gate (language-aware), Complianz cookie banner, MC4WP newsletter, Elementor a11y widget (kept for Israeli law), WPML. Theme restyles, doesn't rebuild. **Bilingual content:** bundle/package products are managed independently EN/HE — not translations.
  - **Card layout polish:** photo well padding removed (1000×1000 PNGs fill edge-to-edge via `object-fit: contain`); shelf shadow dropped from cards (kept on hero); footer pinned to bottom of card body via `margin-top: auto`; title clamps to 2 lines AND reserves 2-line `min-height` so meta-lines align across grid rows regardless of title length; meta-line clamps to 2 lines without min-height. Wishlist feature retired (user confirmed dead).
  - **Demo additions:** sticky header, live viewport indicator pill (top-right, shows current width + desktop/mobile mode), labeled section explaining floating add-to-cart bar is PDP-only (Intersection Observer triggered after main add-to-cart scrolls out of view, not a global element). Three real product images pulled from live site (Ella Valley Zimrat Hakerem, Azeka Blend, Ella Valley Rakia).
  - Plan: `plans/design-system/` — RATIONALE.md (design contract), README.md (quick start), index.html (single-page demo), styles.css (~700 lines reference implementation).
  - Files modified: `plans/design-system/RATIONALE.md`, `plans/design-system/styles.css`, `plans/design-system/index.html`, `plans/design-system/README.md`, `plans/STATUS.md`.
  - **Imagery state confirmed:** catalog spec locked in design system; blog/editorial style locked in `content/IMAGE_RECIPE.md` (Canva impressionist oil painting). Live homepage and About page structures carry over to the new theme but their current palettes (navy/charcoal + gold for homepage; tan/cream for About) do not — both adopt the new tokens when the theme ships. Decision made — no per-page palette variants.
  - **Still open in design system:** hero/marketing imagery direction; iconography beyond the 3 in the sprite (no wishlist — favorites icon currently in homepage nav needs removal in the new theme); loading + empty states; cart page layout; form styling beyond newsletter; Complianz scroll-jump bug investigation.

- **2026-04-26:** Two task-system fixes from a live data audit (140 count tasks stuck at Review on 4/20). Deployed @79 (commit 5b6a850, deploymentId preserved live URL).
  - **Bug A — Manager dashboard leaked admin tasks.** `WebAppDashboardV2_getManagerData` filtered by `managerTaskTypes` and `Cancelled`, but not by `st_AssignedTo`. After a count or vintage task transitioned to Review (which `manager_to_admin_review` reassigns to Administrator), it stayed visible on the manager calendar/list. Added `.filter(task => task.st_AssignedTo === 'Manager')`.
  - **Bug B — `generateComaxInventoryExport` had a silent partial-failure mode.** The export (1) read SysTasks once to find Accepted rows, (2) re-read the full sheet later, modified the Accepted rows in memory, and (3) wrote the **entire sheet** back with one `setValues()`. On large batches (4/19–4/21 ran 8 exports totaling ~390 items, biggest 86) the full-sheet write could fail or partially commit, while the export file and confirmation task were still created. Result: Accepted tasks looked like they reverted to Review (or never advanced), file was on disk, Comax got updated, but the source tasks never closed. Replaced with per-row targeted reads/writes for both SysTasks (Status='Done', DoneDate=now) and SysProductAudit (Storage/Office/Shop=0, NewQty←Brurya). Per-row failures now logged individually instead of silently dropping the whole batch. Cache invalidated on completion.
  - **Bug C — possible: Admin Inventory View allegedly not showing Review count tasks.** Code at `WebAppInventory.js:391-392` does include them since the @73 fix. User confirmed @78 is live, so the fix is deployed. Suspect this report stems from looking at the Admin Dashboard widget (which has separate counting bugs at `WebAppDashboardV2.js:508-509` — wrong task types) rather than the Admin Inventory View. Not changed this session.
  - **Data recovery:** User will manually flip the 140 stuck Review tasks to Done.
  - Files modified: `WebAppDashboardV2.js`, `InventoryManagementService.js`, `WebApp.js` (version stamp).
  - Plan note: see admin dashboard widget counts (`_getInventoryData`) for a future cleanup — `inventoryCountTasks` and `inventoryAwaitingReview` count wrong types.

- **2026-04-24b:** Two bug fixes. Deployed @78.
  - **Bug 1 (confirmed fixed post-deploy): "Available Online But Archived" validation rule still counted zero-stock products despite 2026-04-17 fix.** Root cause in `ValidationLogic.js:73` `_rowPassesFilter`: `String(row[filterKey] || '')` coerced numeric 0 to empty string, so a `wpm_Stock,!0` filter condition saw `'' !== '0'` and let zero-stock rows through. Fixed: `||` → `??` (nullish coalescing) so numeric 0 stringifies as `'0'` and the `!0` invert correctly rejects zero-stock rows. User verified: no false positives on next sync.
  - **Bug 2 (pending watch): Count-origin vintage-update tasks differed from sync-validation ones.** Two mismatches: (a) inventory count path passed `''` for `linkedEntityName` so the admin review row showed no Product name; (b) title format differed (`"Vintage Update: ${sku}"` vs `"Vintage Update"`). Fixed: both count-origin paths (`submitInventoryCounts`, `importCountsFromSheet`) now pass the product name and use title `"Vintage Update (Count)"` — deliberately distinct from rule-violation `"Vintage Update"` so admin can tell the origin at a glance (the notes differ in significance between the two flows).
  - **Client changes (`ManagerInventoryView.html`):** row gained `data-product-name` attribute; submit handler carries `productName` through `selectedCounts`.
  - **Sheet import (`WebAppInventory.js:importCountsFromSheet`):** now reads the "Product Name" column (column B) that the export already writes. Graceful fallback to empty if column missing.
  - Files modified: `ValidationLogic.js`, `WebAppInventory.js`, `ManagerInventoryView.html`, `WebApp.js` (version stamp).
  - **Still watching:** Bug 2 — needs a real count submission with a vintage mismatch to verify Product name appears in admin review and title reads "Vintage Update (Count)".

- **2026-04-24:** Admin vintage-review modal UX fixes. Deployed @77 (user deployed manually — clasp auth expired during session).
  - **Three issues addressed:** (1) slow modal open — two serial GAS round-trips plus a redundant full SysTasks scan just to resolve taskId→sku; (2) no prev/next navigation between review tasks in the queue; (3) created date hidden behind the modal.
  - **Backend (`WebAppProducts.js`):** `loadProductEditorData(taskId, sku)` accepts sku (caller already knows it from the list) to skip the SysTasks scan; falls back to the old lookup when sku omitted. Also returns `htmlEn`/`htmlHe` so the initial preview renders without a second round-trip. New `_buildInitialFormData(master, staging)` helper mirrors the client's `getFormData()` merge rule exactly (staging wds_ overrides master wdm_ whenever defined, even if empty — avoids stale values when manager has cleared a field).
  - **Frontend (`AdminProductsView.html`):** `loadReviewList` caches the tasks array as `reviewTasks`. New `openByIndex(i)` / `navTask(±1)` / `_updateNavUI()` drive prev/next and "N of M" position indicator. Modal header gained a meta row with position + created date. Modal footer gained Prev/Next buttons (auto-hidden on direct opens from Submissions table via taskId-match check on currentIndex). `acceptChanges` auto-advances: splices the accepted task, re-renders the review table in place via `_rerenderReviewTable()`, opens the next task at the same slot; only closes + full-refreshes when the queue drains.
  - **Result:** User confirmed better perceived performance. Raw open latency similar because the 4-sheet CacheService was already warm under prior workflow; the real win is eliminating the between-tasks refresh cycle and keeping the admin in-modal.
  - **Known clean-up (not done):** `ProductService.getProductHtmlPreview` ignores its `lookupMaps` param and rebuilds it internally — dead parameter, out of scope.
  - Plan: `jlmops/plans/ADMIN_VINTAGE_REVIEW_UX_PLAN.md`
  - Files modified: `WebAppProducts.js`, `AdminProductsView.html`

- **2026-04-17:** Fixed "Published But Archived" validation rule to filter by web stock. Deployed @76.
  - **Bug:** Rule `validation.master.published_vs_archived` flagged 446 items including published web products with zero web stock. The 2026-03-09 fix had added `target_filter: cpm_Stock,!0` — but that filters **Comax** stock (sheet_B), while the business rule cares about **web** stock (sheet_A). Zero web stock for an archived-in-Comax product is fine; non-zero web stock is the real problem.
  - **Engine extension:** `_rowPassesFilter` helper in `ValidationLogic.js` now parses `;`-separated AND conditions in `source_filter`/`target_filter`. Backward compatible — single-condition filters split to a 1-element array. EXISTENCE_CHECK path also gained `!` prefix support (was only on FIELD_COMPARISON).
  - **Rule change:** `source_filter` now `"wpm_PostStatus,publish;wpm_Stock,!0"`, `target_filter` removed. Title renamed "Published But Archived" → "Available Online But Archived" (customer-facing state, not WP jargon). Description updated to match.
  - **Verified:** User ran validation after deploy — rule detected zero violations.
  - **Deploy URL incident + fix:** Initial `clasp deploy` created orphan @75 with new URL, breaking the shared live app. Redeployed to existing deployment ID as @76 (URL restored), undeployed @75. `/ship` skill updated to always use `--deploymentId AKfycbzDvzMNI0IYyMFVjdWG8YcUs3clDsSNz4hoLq5VhFHlaYqpPcBxC0jQ3biCd6HeeqlU4A` for JLM Wines so this cannot recur. Memory saved at `~/.claude/projects/C--Users-B-projects-jlmwines/memory/jlm_stable_deploy_id.md`.
  - Files modified: `ValidationLogic.js`, `config/validation.json`, `SetupConfig.js`, `WebApp.js`, `plans/STATUS.md`, `~/.claude/commands/ship.md`

- **2026-04-15b:** Website performance — Round 1 SG Optimizer tuning + diagnosis. No code changes.
  - **Field baseline (CrUX, Mar 17 – Apr 13):** Mobile LCP 2.9s / FCP 2.7s / TTFB 2.1s (Poor) / INP 77ms / CLS 0. Desktop LCP 3.2s / FCP 2.8s / TTFB 2.5s (Poor) / INP 44ms / CLS 0.15. Both fail Core Web Vitals Assessment. TTFB distribution mobile: Good 23% / NI 31% / **Poor 46%** — signature of inconsistent cache coverage, not uniformly slow server.
  - **Lab before SG toggles:** FCP 5.3s, LCP 11.0s, TBT 0ms, CLS 0.005, SI 10.9s. Insights: Render-blocking 2,210ms, Font-display 1,230ms, Image delivery 244 KiB, Unused CSS 197 KiB.
  - **Changes applied by user (SG Optimizer + hosting):** Web Font Optimization, Combine CSS, Combine JS, Minify CSS, Minify JS, Ultrafast PHP. Exact toggle list not captured — worth confirming next session.
  - **Lab after:** FCP 3.9s (−1.4s), LCP 7.2s (−3.8s), TBT 60ms (+60), CLS 0.005, SI 10.8s. Font-display moved to Passed Audits (1,230ms captured fully). Minify CSS/JS both Passed. Payload 2,081 KiB → 1,698 KiB.
  - **Tradeoff observed:** Combining JS/CSS captured render-block savings but grew Unused CSS (197 → 226 KiB) and introduced Unused JS (—  → 168 KiB). Main-thread work 1.4s → 2.1s, JS execution 0.3s → 0.9s. Net positive but approaching limits — no more combine-style toggles without risk.
  - **Remaining render-blocking named:** (1) `siteground-optimizer-combined-*.css` — **243.7 KiB, 2,960 ms blocking**, of which **226 KiB is unused (93%)**. Structural limit of SG Optimizer: it can combine/minify what's registered, cannot shrink what theme/plugins register. (2) `jquery.min.js` — 35.1 KiB, **1,400 ms blocking**. Inline `<script>` callers in the document head force jQuery to load synchronously; SG Optimizer excludes jQuery from defer to avoid breaking those callers.
  - **Third-party findings:** (a) Google Fonts — 243 KiB across 4 `.ttf` files (should be WOFF2, ~30% smaller; should be 2 weights not 4). Deferred "Open Sans 10→2-3 variants" item still unresolved. (b) `wpbingosite.com` — 44 KiB of banner JPEGs (`banner21.jpg`, `banner19.jpg`) hot-linked from the **theme vendor's demo site**. User suspects these may be admin-panel assets leaking to front-end via Redux Framework — consistent with Redux's known pattern of enqueuing globally instead of admin-only. Not confirmed, worth investigating during theme-swap scoping. (c) Elementor a11y widget — 38 KiB, **keep (legally required under Israeli accessibility law)**. (d) Mailchimp — 1 KiB, ignore.
  - **Desktop CLS 0.15 culprit:** "Image elements do not have explicit width and height" diagnostic. Mobile CLS 0 and lab CLS 0.005 — conditional on desktop viewport. Not fixed this session.
  - **Diagnosis verdict:** TBT 60ms + JS exec 0.9s = JavaScript is NOT the bottleneck. CSS registration is the bottleneck. 93% of the blocking CSS is unused — proves theme + Wpbingo Core + Redux Framework are registering site-wide styles that don't belong on any given page. This is the argument for theme swap, now with evidence rather than speculation.
  - **Expected theme-swap gains:** Combined CSS 243 KiB → ~60-80 KiB, jQuery deferrable or footer-loaded, Unused CSS 226 → <50 KiB, LCP −1.5 to −3s on top of current 7.2s. Field CWV should pass over the next 28-day CrUX cycle.
  - **Next session:** Scope theme swap using `~/.claude/plans/unified-sparking-galaxy.md` as starting point. Before committing, confirm (a) Elementor Theme Builder header/footer templates carry over cleanly, (b) a11y widget remains functional, (c) Israeli accessibility compliance not affected, (d) WPML + WooCommerce compatibility, (e) Smart Coupons Pro compatibility (crashed staging6 in Feb when combined with Wpbingo Core removal — may need separate handling).
  - **Also outstanding, independent of theme swap:** Google Fonts weight reduction + WOFF2 (~150 KiB savings), image width/height attributes to retire desktop CLS 0.15.
  - **Documentation gap noted:** No hosting/WP performance docs anywhere in the project before this session. Stack is SiteGround WordPress + SG Optimizer (cache + CDN + Memcached + Ultrafast PHP) — worth recording in a permanent location during theme swap planning.

- **2026-04-15:** Fixed admin inventory review table missing manager-submitted count tasks.
  - **Root cause:** `WebAppInventory_getAdminInventoryViewData` at `WebAppInventory.js:389` only queried `task.validation.comax_internal_audit` in Review status. `task.inventory.count` tasks flipped to Review by manager submit (after the `manager_to_admin_review` flow-pattern fix from 2026-04-14) were never loaded.
  - **Fix:** Concat `task.inventory.count` Review tasks into `reviewTasks`. Existing map is SKU-generic so it renders both types. Also updated widget count at `WebAppInventory.js:22` (`openInventoryCountReviewTasksCount`) to sum both task types so the "Inventory Count Reviews" badge reflects manager submissions.
  - Files modified: `WebAppInventory.js`, `WebApp.js` (version stamp)
  - Closes out the "still pending" item from 2026-04-14.
  - Deployed @73 (commit 5c7560c).

- **2026-04-14:** Inventory count task redesign implemented and pushed to test. In testing — admin verifies tomorrow.
  - **Unified "Create Count Tasks" card** replaces old Bulk + Spot-Check cards in `AdminInventoryView.html`. Client-side filter/sort/preview over single-shot in-memory load from new `WebAppInventory_getCountPlanningData()`. Filter modes: name starts-with/contains, start-at, batch size, threshold (skip-counted-within-N-days), web/wine/zero-stock flags.
  - **Strict atomic sheet import** replaces partial-write model. Pre-scan rejects rows with missing quantity + auxiliary data or non-numeric quantity; clean sheets proceed to write phase. Vintage-actual mismatch or comment creates `task.validation.vintage_mismatch` (dedup disabled via new `options.allowDuplicate` on `TaskService.createTask`).
  - **Manager view enrichment:** Expandable row shows vintage, image thumbnail, product page link; inline vintage/comment inputs pass through to submit and create vintage tasks.
  - **New export columns:** Vintage (ref), Product Page link, Vintage (actual) input column.
  - **Bug found + fix in progress:** `task.inventory.count` used `flow_pattern: manager_direct` — on submit the task went to Review status but stayed assigned to Manager. Changed to `manager_to_admin_review` in `config/taskDefinitions.json`. Regenerated `SetupConfig.js`. Awaiting user push + `rebuildSysConfigFromSource()`.
  - **Still pending:** `WebAppInventory.js:389` only queries `task.validation.comax_internal_audit` for the admin review table — needs to also include `task.inventory.count` Review tasks so submitted counts appear there. Not yet changed.
  - Plan: `jlmops/plans/INVENTORY_COUNT_TASK_REDESIGN.md`
  - Files modified: `TaskService.js`, `InventoryManagementService.js`, `WebAppInventory.js`, `AdminInventoryView.html`, `ManagerInventoryView.html`, `config/taskDefinitions.json`, `SetupConfig.js`

- **2026-03-09:** Validation fixes, inventory UI, bundle composition, redundant task suppression. Two commits: c1af348, e398a29.
  - **Validation rules tightened:** "Archive Status Changed" now only fires for web products (`cpm_IsWeb=כן`). "Published But Archived" skips zero-stock products. Added `target_filter` support and `!` prefix exclusion to validation engine.
  - **Inventory count task definition added:** `task.inventory.count` was missing from `taskDefinitions.json` — caused "create count task" to fail. Added definition + added to `managerTaskTypes` so count tasks appear in manager dashboard.
  - **Admin inventory open tasks card:** Added SKU, Product Name, On Hand columns (was only showing Date + Title).
  - **Bundle composition auto-refresh:** `refreshBundleComposition` step added to housekeeping Phase 3, runs before `checkBundleHealth`. Eliminates stale bundle slot data.
  - **Skip redundant tasks:** New `skip_if_open_task_type` config property. Name/archive change tasks skip creation when vintage update task already exists for same SKU. Pre-loads open tasks once for O(1) lookup, tracks tasks created within same run.
  - **woosb_ids JSON fix:** `WooProductPullService` now stringifies object-type `woosb_ids` meta values. Fixes Hebrew bundle parse failures caused by GAS serializing objects as `{key=value}` instead of JSON.
  - Plan: `jlmops/plans/VALIDATION_AND_INVENTORY_FIX_PLAN.md`
  - Files modified: `ValidationLogic.js`, `ValidationOrchestratorService.js`, `WebAppDashboardV2.js`, `WebAppInventory.js`, `AdminInventoryView.html`, `HousekeepingService.js`, `WooProductPullService.js`, `config/validation.json`, `config/taskDefinitions.json`, `SetupConfig.js`, `WebApp.js`

- **2026-03-03:** Sync widget fixes + deploy @69.
  - **API Pull promoted to primary button.** CSV Import remains as fallback.
  - **Step completion messages now show real counts:** EN/HE product counts and order count on step cards.
  - **Stale poll UI bug fixed:** Generate button no longer reappears after action completes. Root cause: `lastActionTimestamp = null` was clearing stale-poll protection too early. Fix: removed that line — timestamp persists and filters all pre-action polls.
  - **Sync timestamps fixed:** `generateSessionId()` now uses `Utilities.formatDate` + `Session.getScriptTimeZone()` instead of raw `getDate()`/`getHours()` (which return UTC in GAS). Session IDs and task labels now show Israel time.
  - Files modified: `AdminDailySyncWidget_v2.html`, `WebAppSync.js`, `WooProductPullService.js`, `OrchestratorService.js`, `WebApp.js`
  - Deployed @69, 2026-03-03.

- **2026-02-28:** Staging6 plugin diagnosis + theme replacement planning.
  - **Diagnosis:** staging6 returning 500 after plugin updates. Used WP REST API to deactivate plugins one by one.
  - **Culprit 1: Wpbingo Core** — crashed entire site. Deactivating restored homepage, /he/, cart, my-account.
  - **Culprit 2: Smart Coupons for WooCommerce Pro** — crashed shop + product pages specifically. Deactivating restored /shop/ and product pages.
  - Both plugins are essential (Wpbingo for KoWine theme, Smart Coupons for coupon system). Live site already rolled back.
  - **Theme replacement plan written.** Minimal Elementor-compatible theme modeled on Hello Elementor. Eliminates KoWine + Wpbingo Core + Redux Framework. Existing Elementor Theme Builder header/footer templates carry over automatically. Plan: `~/.claude/plans/unified-sparking-galaxy.md`.
  - Staging6 state: Wpbingo Core and Smart Coupons Pro deactivated. Site functional but missing those plugin features.
- **2026-02-27b:** Pesach email finalized (EN + HE).
  - Added hero image (Evyatar in shop with matzah corner overlay — `content/pesach/email header.jpg`). Image added via Mailchimp Image block, not in HTML.
  - Replaced text link CTA with charcoal button (#32373c, white text).
  - Removed inline link from body copy — button is the single CTA.
  - Added personal closing: "Chag Kasher v'Sameach, Evyatar" below button.
  - Created Hebrew version with RTL support, Hebrew closing (חג כשר ושמח, אביתר), CTA links to `/he/product/seasonal-wines/`.
  - Files: `exchange/pesach-email-en.html`, `exchange/pesach-email-he.html`
  - **Process:** New builder in Mailchimp → Image block (hero) → Code block (paste inner HTML). Two separate sends — EN and HE to language-segmented lists. Tuesday evening after Purim.
  - See `marketing/EMAIL_GUIDELINES.md` for reusable process and design decisions.
- **2026-02-27:** Two bug fixes + Pesach email draft.
  - **Sync widget race condition:** Stale poll responses (initiated before an action) could arrive after the success handler and overwrite the UI with old state. This caused the Generate button to reappear after web export completed, requiring a second click. Fix: track `lastActionTimestamp`, discard poll responses with older `lastUpdated`. Files: `AdminDailySyncWidget_v2.html`
  - **Bundle health check crash:** `getEligibleProducts()` referenced undefined `spreadsheet` variable when accessing WebDetM for slots with intensity/complexity/acidity criteria. Same class of bug as the Feb 24 fix in `getBundlesWithLowInventory` — a second instance in a different function. The crash killed the entire bundle health check silently, preventing zero-stock alerts. Fix: use `SheetAccessor.getDataSheet('WebDetM', false)`. Files: `BundleService.js`
  - **Pesach email:** Initial draft — plain text email, no image, text link CTA. Iterated to personal tone. File: `exchange/pesach-email-en.html`
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
- ~~2026-03-06: Manager inventory view: 1. Create count task failed. 2. Open inventory tasks need to show entity id (SKU) and product name in list.~~ → Fixed 2026-03-09 (c1af348)
- 2026-03-09: Vintage update tasks from late February not assigned to manager. Recent ones are fine. Check what changed — may have been the task.inventory.count fix or a routing issue.
- ~~2026-03-10: jlmops task shows "Published But Archived (Summary: 446 Items)". Archived in Comax with zero inventory is OK if web shows zero stock.~~ → Fixed 2026-04-17 (@76)
- 2026-03-10: Decanting field can be skipped — system should allow zero (0) as a valid value, not treat it as empty/skippable.
- 2026-04-27: Bundle/package product images need re-export with transparent background (currently white-bg). Catalog spec calls for transparent PNG; bundles/packages predate strict enforcement. Use Canva "Remove background" or equivalent. Surfaced when new theme's beige page bg made the white boxes visible.
