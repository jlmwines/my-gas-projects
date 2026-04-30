# Cross-Sell Plan

**Purpose.** Curated similarity recommendations replace WooCommerce's auto-generated "Related Products" on the PDP and power cart cross-sells. Calculated in jlmops, pushed to WC, rendered with category-aware copy in the theme.

**Status.** Plan written 2026-04-30. Build queued post theme cutover.

---

## Why

- WC's auto-generated "Related Products" uses shared categories/tags only — it's noise, not curation.
- Our products carry attribute scores (intensity / complexity / acidity) that are not used for recommendations today.
- Manual entry of cross-sells in WC admin is error-prone and silently breaks when products shift.
- The data already lives in WebProdM. The schema slot already exists in DATA_MODEL.md (`wps_CrossSells`).

---

## Calculation Rules

For a product W, generate a list of top N (≈4) cross-sell candidates:

1. **In stock.** Required.
2. **Same category.** Required. Different categories don't recommend each other.
3. **Unique products.** No duplicates within the list for a given W.
4. **Attribute-closest.** Start with candidates that share W's attribute values exactly. If fewer than N qualify, expand the range progressively (loosen by ±1 on each axis, then ±2, etc.) until N candidates are found.
5. **Category-specific axes.** Reds (Dry Red): rank by distance over (intensity, complexity). Whites (Dry White): rank by distance over (complexity, acidity). Other categories (Rosé, Sparkling, etc.): generic similarity over all available axes.

If the category genuinely doesn't have N in-stock candidates, the list is shorter than N. Don't pad cross-category.

### Out of Scope for v1

- Kashrut filtering (let customers browse across)
- Winery diversity tie-breakers
- Recommending bundles as cross-sells
- Price band logic (tested in earlier discussion — collapsed to single pool)

---

## Storage

- WC field: `cross_sell_ids` only. Skip `upsell_ids` entirely.
- jlmops field: `wps_CrossSells` (already in DATA_MODEL.md schema).
- Calculation runs as part of the daily sync; results pushed alongside the existing CSV inventory export.

---

## Display Surfaces

### PDP

- Theme replaces WC's auto-generated Related Products section with the cross-sell loop.
- Implementation: hook in `inc/woocommerce.php` removes `woocommerce_output_related_products` action, registers a custom render that reads `cross_sell_ids` and renders the loop.

### Cart

- Use WC's native cart cross-sell rendering, dressed down to match the design system.
- **Conditional:** suppress when the cart is exclusively bundles (`woosb` or `product_bundle` types). Mixed carts and bottle-only carts get the cross-sell block.
- Implementation: filter on `woocommerce_cart_cross_sells` (or equivalent) that returns empty when cart is bundle-only.

### Heading copy (category-aware)

- Reds → "Wines with similar intensity and complexity"
- Whites → "Wines with similar complexity and acidity"
- Other → "Similar wines"

---

## Refresh Cadence

- **Daily** as part of the sync. Lightweight calculation — only re-runs for products whose attributes, price, or stock have changed.
- Out-of-stock filter is enforced at calculation time; if a recommended product goes out of stock between syncs, the next sync fixes it.

---

## Build Steps (when ready)

1. **Calculation service** in jlmops (new `CrossSellService.js`). Reads WebProdM, writes to `wps_CrossSells` for each product row.
2. **CSV export extension.** Existing inventory CSV already has the column slot per DATA_MODEL.md; verify it's emitted and that values are imported correctly into WC.
3. **Theme PDP override.** `inc/woocommerce.php`: remove auto-generated Related Products, render cross-sell loop, category-aware heading.
4. **Theme cart conditional.** Filter that suppresses cart cross-sells when cart is bundle-only.
5. **Verify rendering** on staging across reds / whites / other categories before going live.

---

## Open Questions

- Confirm WC's cross-sell rendering on the new theme works cleanly with the design system, or whether we need a custom card style.
- Decide on N (4 is the working assumption).
- Decide whether calculation respects out-of-stock at-time-of-sync (yes, working assumption) or accepts brief staleness for products that go out of stock later in the day.

---

## Cross-Area Touch

- **jlmops:** primary owner — calculation, push.
- **website:** theme rendering, category-aware copy.
- **business:** contributes the brand framing — anti-snob curation, attribute system as authority.

See `business/COORDINATION.md` for the cross-area view.

---

Updated: 2026-04-30
