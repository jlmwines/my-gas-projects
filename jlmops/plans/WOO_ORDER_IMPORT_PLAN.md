# WooCommerce API Pull Integration

**Status:** Implemented
**Updated:** 2026-02-28

## What Was Built

Full WooCommerce REST API integration replacing manual CSV exports for the daily sync workflow.

### Phase 1: Order Pull (Deployed 2026-02)

- `WooOrderPullService.pullOrders()` — fetches orders via API, transforms, validates, upserts
- Integrated into sync widget step 2 (`importWebOrdersBackend`)
- Hourly auto-pull trigger runs independently
- 30-day rolling window, upsert via existing OrderService pipeline
- Credentials stored in SysEnv sheet

### Phase 2: Product + Translation Pull (Deployed 2026-02-28)

- `WooProductPullService.pullAndImportAll()` — full pipeline:
  - **Phase A:** EN products via `WooApiService.fetchProducts('en')` → `_transformApiProduct` → WebProdS_EN → validate → WebProdM
  - **Phase B:** HE translations via `WooApiService.fetchProducts('he')` → `_transformApiTranslation` → WebXltS → validate → WebXltM
  - **Phase C:** Orders via `WooOrderPullService.pullOrders()`
- Key fix: `_transformApiTranslation` uses `heProd.translations.en` for `wxs_WpmlOriginalId` (the EN product ID). The old `_extractAndStageTranslationLinks` looked for `_wpml_original_post_id` in meta which the API doesn't return.
- Full 31-column `wxs_*` mapping including 2 RankMath SEO fields and 20 woosb bundle fields.
- Progress visible in sync widget via `SyncStateService.updateStep()` + `SpreadsheetApp.flush()` between each sub-phase.

### Sync Widget Integration

- `apiPullAllBackend()` in WebAppSync.js — state machine wrapper (IDLE → IMPORTING_PRODUCTS → ... → WAITING_ORDER_EXPORT or WAITING_COMAX_IMPORT)
- "API Pull" button appears alongside "Start Import" at IDLE stage via `altButton` pattern
- Step 1 shows sub-phase progress: "Pulling EN products..." → "EN: N staged. Validating..." → "EN imported. Pulling HE translations..." → "HE: N staged. Validating..." → "Products and translations imported"
- Step 2 shows order pull progress
- After completion, normal sync flow continues (Comax import, web export)

## What Stays Unchanged

- `pullProducts()` — existing standalone function, not modified
- `_extractAndStageTranslationLinks()` — old broken function, not modified (superseded by `_transformApiTranslation`)
- `importWebProductsBackend()` — manual CSV path via "Start Import" button
- `importWebOrdersBackend()` — separate order import path
- All downstream sync steps (Comax import, web export) unchanged

## Files

| File | Role |
|------|------|
| `WooApiService.js` | REST API client (fetchProducts, fetchOrders) |
| `WooProductPullService.js` | Product + translation pull, transform, staging |
| `WooOrderPullService.js` | Order pull, transform, staging |
| `WebAppSync.js` | `apiPullAllBackend()` state machine wrapper |
| `AdminDailySyncWidget_v2.html` | "API Pull" button + action wiring |

## Future Considerations

- Remove manual CSV import path once API pull is proven stable
- Consider removing the broken `_extractAndStageTranslationLinks` function
- Hourly auto-pull could be extended to include products/translations (currently orders only)
