# WooCommerce API Pull Integration

**Status:** Testing in normal use — not yet deployed as versioned release
**Updated:** 2026-02-27

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

## Testing Status

- **First test:** 2026-02-27 — full pipeline completed, sync reached WAITING_ORDER_EXPORT with 1 order ready. Data landed in staging and master sheets. No silent failures.
- **Audit trail:** SysLog sheet in JLMops_Log (filter service: `WooProductPullService`). No SysJobQueue entries (runs inline, not via OrchestratorService).
- **Next:** Continue testing during normal daily syncs. Once trusted, integrate into main sync flow and deploy as versioned release.

## Future Considerations

- Remove manual CSV import path once API pull is proven stable
- Consider removing the broken `_extractAndStageTranslationLinks` function
- Hourly auto-pull could be extended to include products/translations (currently orders only)
- Add audit trail (SysJobQueue or similar) when integrating into main sync flow
