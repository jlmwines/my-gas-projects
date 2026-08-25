# Coupon API Pull

**Created:** 2026-08-25
**Status:** Shipped and deployed live (jlmops @551). Facts graduated to `jlmops/docs/ARCHITECTURE.md` §2.5.6 (Housekeeping Phases). Archived.

WooCommerce coupons currently only reach jlmops via a manual step: the `task.data.coupons_update` housekeeping reminder (fires every 14+ days since the last import) asks an admin to export a CSV from WooCommerce and drop it in the import folder for `CouponService.importFromCsv` to pick up. Coupons are available via the same WooCommerce REST API already used for products and orders (`/wc/v3/coupons`), so this replaces the manual step with an automatic daily pull, plus a manual "Pull Coupons Now" control in Admin Dev for on-demand refreshes (useful right after launching/editing a coupon, e.g. the current `50NEW` popup coupon or a flyer code).

## Design

Everything reuses existing plumbing — no new service file, no new job-queue/SysJobQueue wiring (this doesn't need the async-job UI feedback loop the sync flow does; it's a plain function call like the existing Mailchimp pulls in the same daily-housekeeping phase).

1. **`WooApiService.fetchCoupons(modifiedAfter)`** — new function alongside `fetchOrders`/`fetchProducts`, same shape: `_fetchAllPages('/wc/v3/coupons', { orderby: 'date', order: 'desc', modified_after: modifiedAfter })`. Added to the module's public return.

2. **`CouponService._transformApiCoupon(apiCoupon)`** (private) — maps the REST API's JSON coupon object to the same `sco_*`-keyed shape `importFromCsv` already produces per row, so both paths feed the same `upsertCoupon()` (tag derivation, `sco_IsActive` calc, `sco_LastImported` stamp, upsert-by-code — all already correct there, not duplicated). Field mapping: `code`→`sco_Code`, `id`→`sco_WooId`, `description`→`sco_Description`, `status`→`sco_Status`, `date_created`→`sco_CreatedDate`, `discount_type`→`sco_DiscountType`, `amount`→`sco_Amount`, `free_shipping`→`sco_FreeShipping`, `minimum_amount`/`maximum_amount`→`sco_MinSpend`/`sco_MaxSpend`, `product_categories`→`sco_Categories` (joined), `individual_use`→`sco_IndividualUse`, `usage_limit`/`usage_limit_per_user`/`usage_count`→`sco_UsageLimit`/`sco_UsageLimitPerUser`/`sco_UsageCount`, `date_expires`→`sco_ExpiryDate`, `email_restrictions`→`sco_CustomerEmail` (joined — the CSV path only carried one `customer_email`, the API can return several, so joining keeps all of them rather than silently dropping data). The two WPClever-plugin fields the CSV import picks off `meta:_wjecf_*` columns come from the API's `meta_data` array instead — same values, read via a small local `_getMetaValue(metaData, key)` helper (mirrors the one already in `WooProductPullService.js`, not shared cross-file since it's a 6-line lookup).

3. **`CouponService.pullFromApi(modifiedAfter)`** (public) — fetch, transform, upsert each row, stamp `system.woocommerce.coupons_last_update` on success (even 0 results — same "still a live integration" reasoning `WooOrderPullService.pullOrders` already uses for its heartbeat), return `{ success, imported, errors }`. A hard failure (API/auth down) propagates as a thrown exception from `WooApiService.fetchCoupons` uncaught, so housekeeping's Phase 3 tracking and the Admin Dev button's failure handler both see it; a bad individual row is caught per-row (same pattern as `importFromCsv`) and reported in `errors` rather than aborting the whole pull.

4. **`HousekeepingService.js` Phase 3 task list** — add `{ name: 'pullCoupons', fn: () => CouponService.pullFromApi() }` alongside the existing `pullMailchimpSubscribers`/`pullMailchimpCampaigns` pulls. `checkCouponsReminder` stays in the list too, unchanged — with pulls succeeding it should stop firing on its own (data stays fresh), but it's a real, cheap safety net if the pull ever silently stops working without throwing (the exact failure mode already flagged as an open gap in `.claude/bugs.md`, 2026-08-21).

5. **Manual control in Admin Dev** — a bare global `function pullCouponsFromApi() { return CouponService.pullFromApi(); }` in `CouponService.js` (mirrors the existing `importCouponsFromFolder()` bare-global pattern in the same file), called directly from a new "Pull Coupons Now" button in `DevelopmentView.html`'s `runPullCoupons()`, following the exact same button/result-div pattern as `runLibraryIntegrity()`/`runDailyHousekeeping()` there.

## Not changed

- `SysCoupons` schema — every field the API needs already exists (`sco_*`, confirmed against `docs/DATA_MODEL.md`); no append needed.
- `importFromCsv` / the manual CSV path — left in place as a fallback (e.g. if the API pull is ever down).
- No SysJobQueue/`OrchestratorService`/`jobs.json` changes — this isn't part of the sync state machine.

## Key files

- `jlmops/WooApiService.js` — `fetchCoupons`
- `jlmops/CouponService.js` — `_transformApiCoupon`, `pullFromApi`, bare global `pullCouponsFromApi`
- `jlmops/HousekeepingService.js` — Phase 3 task list
- `jlmops/DevelopmentView.html` — manual control

## Verification

- Manual: click "Pull Coupons Now" in Admin Dev, confirm `SysCoupons` rows update (spot-check `sco_UsageCount`/`sco_Status` against a known live coupon) and `system.woocommerce.coupons_last_update` advances.
- Automatic: confirm it runs clean on the next daily housekeeping pass (SysLog, no `pullCoupons` entry in the failure list).
