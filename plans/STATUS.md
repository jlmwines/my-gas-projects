# JLM Wines — Current Status

**Updated:** 2026-02-19

## Next Action

- **Test SKU management fixes** (deployed, partially verified):
  1. Vendor SKU Update: search for a product already on web → should appear with [Web] badge *(not yet tested)*
  2. ~~Product Replacement: run a replacement~~ → ✓ Tested, working. WebProdM, WebDetM, WebXltM, CmxProdM all updated.
  3. Trim safety: SKUs with whitespace should match correctly *(not yet tested)*
- Check SysTasks for `task.validation.vintage_mismatch` row from the replacement test
- **Automatic order import via Woo REST API** — high priority, plan and implement soon. GAS timed trigger polls Woo for new orders, eliminates manual export/import. Unblocks packing slips and removes daily bottleneck. See `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`.
- **Website font optimization** — Open Sans loading 10 variants (5 weights × 2 styles), only need 2-3. Kowine theme custom font settings can restrict this. Check WPML impact before changing. Body and header fonts configurable separately.
- Build `CampaignService.getTargetSegment()` for segment export
- Export segments for review (2025 customers, comeback targets, subscribers)
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

## Known Issues

1. Monitor bundle additions for stale data recurrence
2. Consider auto-cleanup of rows below data range during upsert

## Blocked / Deferred

- Year in Wine PDF — needs PDF generation research
- Gift recipient campaigns — lowest priority, wait
- VIP recognition + referral program — after campaigns launch

## Session History

- **2026-02-19d:** Website performance audit. Deactivated Slider Revolution (unused, heavy). Disabled Jetpack stats and WooCommerce Analytics tracking (redundant with GA4). PageSpeed scores: mobile 57, desktop 82. Identified font optimization opportunity (Open Sans 10 variants → 2-3 needed). Font change deferred pending WPML compatibility check.
- **2026-02-19c:** Product replacement bug fix verified. Sync widget double-click guard added (disable button immediately in `runAction`). Planned automatic order import via Woo REST API — created `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`. High priority for next jlmops session.
- **2026-02-19b:** Product replacement bug fix. `webProductReassign()` was rejecting calls when `wpm_WebIdEn` was empty in WebProdM. Relaxed validation to accept either web ID or old SKU for row identification. Added SKU-based fallback to WebProdM row lookup. Tested — replacement updates WebProdM, WebDetM, WebXltM, CmxProdM correctly. File: ProductService.js.
- **2026-02-19a:** SKU management fixes. (1) New `searchAllProducts()` for vendor SKU update — searches all non-archived products in CmxProdM, no isWeb/stock filter. (2) `webProductReassign()` now creates `task.validation.vintage_mismatch` task after replacement so stale web content gets flagged. (3) Defensive `String().trim()` on SKU comparisons in `_updateSkuInSheet` and `vendorSkuUpdate` SysTasks loop. Files: ProductService.js, WebAppProducts.js, AdminProductsView.html.
- **2025-12-25:** Import system fixes (CSV filter, validation rule, quarantine diagnostics). Hebrew translation import working (747 rows). Quarantine file preservation + detailed error messages.
- **2025-12-22:** CRM Phase 2 dual-language enrichment (10 new columns, 548 enriched, 10 skipped). Activity backfill fix. Admin UI updates. Campaign system planning (comprehensive plan + key business decisions). Plan consolidation (deleted 4 obsolete plans, created CRM_PLAN.md).

## Previous Session Summaries

Detailed session history prior to standardization is in `jlmops/SESSION_SUMMARY.md`.
