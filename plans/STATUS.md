# JLM Wines — Current Status

**Updated:** 2026-02-19

## Next Action

- **Test SKU management fixes** (deployed, awaiting verification):
  1. Vendor SKU Update: search for a product already on web → should appear with [Web] badge
  2. Product Replacement: run a replacement → check SysTasks for `task.validation.vintage_mismatch` row with new SKU
  3. Trim safety: SKUs with whitespace should match correctly
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
- **SKU management fixes:** Deployed 2026-02-19, awaiting test. Vendor SKU search now finds all non-archived products (was filtering out web products). Product replacement now creates a vintage_mismatch task for web content review. Defensive trims on SKU comparisons.

## Known Issues

1. Monitor bundle additions for stale data recurrence
2. Consider auto-cleanup of rows below data range during upsert

## Blocked / Deferred

- Year in Wine PDF — needs PDF generation research
- Gift recipient campaigns — lowest priority, wait
- VIP recognition + referral program — after campaigns launch

## Session History

- **2026-02-19:** SKU management fixes. (1) New `searchAllProducts()` for vendor SKU update — searches all non-archived products in CmxProdM, no isWeb/stock filter. (2) `webProductReassign()` now creates `task.validation.vintage_mismatch` task after replacement so stale web content gets flagged. (3) Defensive `String().trim()` on SKU comparisons in `_updateSkuInSheet` and `vendorSkuUpdate` SysTasks loop. Files: ProductService.js, WebAppProducts.js, AdminProductsView.html. Deployed via clasp, awaiting user testing.
- **2025-12-25:** Import system fixes (CSV filter, validation rule, quarantine diagnostics). Hebrew translation import working (747 rows). Quarantine file preservation + detailed error messages.
- **2025-12-22:** CRM Phase 2 dual-language enrichment (10 new columns, 548 enriched, 10 skipped). Activity backfill fix. Admin UI updates. Campaign system planning (comprehensive plan + key business decisions). Plan consolidation (deleted 4 obsolete plans, created CRM_PLAN.md).

## Previous Session Summaries

Detailed session history prior to standardization is in `jlmops/SESSION_SUMMARY.md`.
