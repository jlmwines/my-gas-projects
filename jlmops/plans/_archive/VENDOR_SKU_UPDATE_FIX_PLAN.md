# Vendor SKU Update — Discovery Bug Fix Plan

**Purpose.** Fix a root-cause bug in the Vendor SKU Update tool (Admin Products → SKU Management) found during first real use, reported 2026-08-17. "Old SKU" always means the stale `WebProdM`/`WebDetM` SKU; "new SKU" is the target value, which may already exist in `CmxProdM` (vendor's Comax change already synced in) or may not exist anywhere yet (admin originating the change before Comax has it). The tool currently can only discover a product via `CmxProdM` and blocks whenever the new SKU is found to already exist — both wrong for the tool's normal case. Design finalized through discussion 2026-08-17; not yet implemented.

## Root cause (confirmed against current code)

- `ProductService.searchAllProducts()` (`ProductService.js:2317`) — the search box behind "Find Existing Product" — reads only `CmxProdM`'s `cpm_SKU`/`cpm_NameHe`. Never touches `WebProdM`/`WebDetM`.
- `ProductService.lookupProductBySku()` (`ProductService.js:2068`) — runs on selecting a search result, and again in Step 2's SKU-availability check — hard-requires a `CmxProdM` match (`if (!comaxData) return null`, line 2120), and only cross-references Web using the SKU it just found *in Comax* (line 2125), never the SKU actually searched for.
- `AdminProductsView.validateNewSku()` — blocks whenever `lookupProductBySku(newSku)` finds *any* match, and separately blocks whenever the entered new SKU equals whatever Step 1 populated as "current."

Net effect: once Comax already carries the new SKU, there is no path to find the product by its actual stale Web SKU — search/lookup only ever surface Comax's already-current value, mislabeled as "current" in the UI — and even if that were fixed, entering the real target SKU (which legitimately already exists in Comax) gets rejected as a false conflict.

The apply step (`ProductService.vendorSkuUpdate`) is unaffected and needs no change: confirmed by reading `_updateSkuInSheet` (`ProductService.js:1942`) that it's a plain "find row matching `oldSku`, set to `newSku`, no-op if not found" — safe to call unconditionally regardless of whether `CmxProdM` already has the new value. If Comax already changed, the `CmxProdM` pass simply finds nothing and skips; if not, it updates Comax too. No case-detection needed before calling it.

## Fix design

**1. Discovery must be able to find the product by its stale Web SKU, not only via Comax.** `searchAllProducts` needs to also scan `WebProdM.wpm_SKU` and `WebDetM.wdm_NameEn`/`wdm_NameHe`; `lookupProductBySku` needs to drop the `if (!comaxData) return null` gate and independently look up Web sheets by the *searched* SKU, returning `{ comax: {...} | null, web: {...} | null }`. Without this, there is no field in the UI that can ever hold the true stale Web SKU as "old SKU" — the apply call would run with the wrong `oldSku` and silently fix nothing on the Web side.

**2. Step 1 UI must show whichever side actually matched**, not assume Comax is authoritative — `vendor-current-sku`/`vendor-label-old-sku` should reflect the stale Web SKU when that's what was found, not `data.comax.sku`.

**3. Step 2 validation must stop treating "new SKU already exists in Comax" as a conflict — it's the expected, normal case.** Drop the "already exists in JLMops" block when the match is in `CmxProdM`; only block on a genuine collision — the new SKU already belonging to a *different* product's Web-side record. No identity-matching (`cpm_CmxId` cross-check) needed to distinguish "same product" from "different product" here, since re-running the apply is harmless even in ambiguous cases (per the idempotency confirmed above) — err toward permissive. The "must differ from current SKU" check stays, but now correctly compares against the stale Web SKU (post-fix-#1/#2), not Comax's already-current value, so it won't misfire in the normal case.

**4. Optional, lower priority: surface an informational note** when the new SKU is found already in Comax ("Comax already has this SKU as `<name>` — this will sync Web/JLMops records to match") rather than silence — nice-to-have for admin confidence, not required for correctness.

## Status

Implemented, deployed live jlmops @546, and smoke-tested confirmed working (2026-08-17) — updated as expected on a real vendor SKU change. All four fix-design points shipped: `searchAllProducts`/`lookupProductBySku` (`ProductService.js`) now find a product via its Web-side SKU/name even when Comax has already moved past it; Step 1 (`AdminProductsView.html`) shows whichever side actually matched and resolves "current SKU" to the Web value when present; Step 2 no longer blocks when the target SKU already exists in Comax (only blocks on a genuine different-product Web collision); search results flag a "Web only (not in Comax)" match.
