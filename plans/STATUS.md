# JLM Wines — Current Status

**Updated:** 2026-02-22 (session 2)

## Next Action

- **Content push to staging6 — IN PROGRESS, new workflow established:**
  - **Workflow:** Claude produces text as WP blocks in left column + Canva AI prompts as yellow placeholder blocks. User generates images in Canva, arranges layout in block editor.
  - **Pairing EN** pushed and ready for user layout work (ID 65344, published). Has 7 Canva prompts (oil painting style matching featured images). Empty column pair at top for flexibility.
  - **Pairing HE** pushed as draft (ID 67019). Same structure, image prompts reference EN images.
  - **Next:** User finalizes Pairing EN/HE layout with images. Then Claude produces remaining 6 posts (Acidity, Complexity, Intensity, Good Wine, Selection, Price vs Quality) in same format — EN with Canva prompts, HE with image references.
  - **About Evyatar** is new (no existing post on staging6). Needs both EN and HE created.
  - After all posts ready: user links HE↔EN translations manually in WPML.
- **Test SKU management fixes** (deployed, partially verified):
  1. Vendor SKU Update: search for a product already on web → should appear with [Web] badge *(not yet tested)*
  2. ~~Product Replacement: run a replacement~~ → ✓ Tested, working. WebProdM, WebDetM, WebXltM, CmxProdM all updated.
  3. Trim safety: SKUs with whitespace should match correctly *(not yet tested)*
- Check SysTasks for `task.validation.vintage_mismatch` row from the replacement test
- **Automatic order import via Woo REST API** — high priority, plan and implement soon. See `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`.
- **Website font optimization** — Open Sans loading 10 variants → 2-3 needed. Deferred pending WPML check.
- Build `CampaignService.getTargetSegment()` for segment export
- Start small comeback campaign testing
- Research PDF generation for Year in Wine

## Current State

- **Sync workflow:** Stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce). Imports, exports, validation all working.
- **CRM enrichment:** Complete. 548 contacts enriched with dual-language preferences (categories, wineries, grapes, kashrut). Activity backfill working.
- **Campaign system:** Planned (`jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md`), not yet built. Key decisions made: welcome offer NIS 50 off 399, Tuesday evening sends, 7-14 day attribution window.
- **Import system:** Fixed Dec 2025 — CSV filter, validation rule fix, quarantine diagnostics.
- **Admin UI:** Contact preferences display, activity ribbon icons.
- **SKU management fixes:** Deployed 2026-02-19. Product replacement tested and working (bug fix: relaxed validation to find WebProdM row by SKU when web ID is empty). Vendor SKU update and trim safety still awaiting test.
- **Website performance:** Slider Revolution deactivated, Jetpack stats/WooCommerce Analytics tracking disabled. PageSpeed: mobile 57, desktop 82. Font optimization pending.
- **Content pipeline:** Revised workflow. `convert-posts.js` handles docx→WP blocks (pandoc). Posts are handcrafted per-post: all text in left column, Canva AI prompts as yellow placeholder blocks, empty right column. User generates images and arranges layout in WP editor. `push-posts.js` pushes via WP REST API (slug-based upsert, preserves post status). CSS fix removed — plain `wp:columns`/`wp:column` without widths works with the theme. Featured images are Canva AI oil paintings (impressionist brushstrokes, warm palette). In-body images use same style but smaller vignettes.

## Known Issues

1. Monitor bundle additions for stale data recurrence
2. Consider auto-cleanup of rows below data range during upsert

## Blocked / Deferred

- Year in Wine PDF — needs PDF generation research
- Gift recipient campaigns — lowest priority, wait
- VIP recognition + referral program — after campaigns launch

## Session History

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
