# Website Tasks

WooCommerce/WordPress website improvements and customizations.

## Bugs

(none)

## Pending

- [ ] 2025-12-24: Enable Wordfence Login Security WooCommerce integration
- [ ] 2026-05-31: Reconcile WooCommerce template overrides (Status report flagged out-of-date version headers). Diff each against installed WC core, port any new hooks/markup, keep custom copy, then bump `@version`. Files: `woocommerce/cart/mini-cart.php` (missing header; core 10.0.0), `woocommerce/emails/customer-on-hold-order.php` (9.7.0 → 10.4.0), `woocommerce/emails/customer-processing-order.php` (9.7.0 → 10.4.0). NOT a bug — emails/mini-cart render fine; this is maintenance. The `woocommerce.php` vs `archive-product.php` notice is informational (intended wrapper) — no action. Deploys to live via deploy-theme.ps1, needs explicit OK at deploy.

## Completed

- [x] 2025-12-24: Product page - adjust desktop columns (deployed)
- [x] 2025-12-24: Checkout radio buttons + saved payment methods styling (deployed)
