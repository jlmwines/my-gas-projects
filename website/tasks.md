# Website Tasks

WooCommerce/WordPress website improvements and customizations.

## Bugs

(none)

## Pending

- [ ] 2025-12-24: Enable Wordfence Login Security WooCommerce integration
- [ ] 2026-05-31: Reconcile WooCommerce template overrides (Status report flagged out-of-date version headers). Diff each against installed WC core, port any new hooks/markup, keep custom copy, then bump `@version`. Files: `woocommerce/cart/mini-cart.php` (missing header; core 10.0.0), `woocommerce/emails/customer-on-hold-order.php` (9.7.0 → 10.4.0), `woocommerce/emails/customer-processing-order.php` (9.7.0 → 10.4.0). NOT a bug — emails/mini-cart render fine; this is maintenance. The `woocommerce.php` vs `archive-product.php` notice is informational (intended wrapper) — no action. Deploys to live via deploy-theme.ps1, needs explicit OK at deploy.
- [ ] 2026-06-03: Delete unused/deactivated plugins on live (reduce attack surface + update noise). **Jetpack already disabled 2026-06-03** (not needed for the WooCommerce phone app — that uses site credentials + Application Passwords; Jetpack only added push/stats/multi-store/Blaze; disabling also helped mobile LCP); deletion deferred until confirming nothing depends on the Jetpack Connection package. **DO NOT DELETE `mailchimp-woocommerce`** — its `wp_options` API key is what the theme's replacement code reads. Safe to delete: `woo-smart-wishlist`, `WPBingo`, `redux-framework`, `Elementor` + `Elementor Pro` (after verifying no remaining Elementor pages — search wp-admin → Pages for the Elementor edit indicator), `widget-importer-exporter`, `better-search-replace`, `wp-file-manager`. Verify-before-delete: `contact-form-7` + CF7 multilingual (any forms in use?), `variation-swatches-for-woocommerce` (variation selector acceptable without it?), `woocommerce-checkout-field-editor` (any custom checkout fields configured?).
- [ ] 2026-05-07: Untranslated strings audit — walk live in EN and HE, list every visible English string on HE pages (and vice versa). Likely surfaces: WC chrome (cart/checkout/account), PDP variation labels, Complianz banner, plugin-emitted strings. Resolve via inline `is_rtl()` baking (theme-owned) or WPML String Translation (plugin/WC chrome). Note: the WPML String Translation cleanup itself shipped v1.2.17–v1.2.19; this is the remaining broad sweep.
- [ ] 2026-05-07: WC term thumbnails refresh — admin-side category images in wp-admin → Products → Categories are still old. Customer-facing pages already use theme overrides, so this is admin cosmetic only.
- [ ] 2026-06-17: Blog post category page is poorly formatted — improve the post-listing layout (e.g. the Basics category archive, EN + HE). Specifics TBD: walk the live category page and capture what's broken (post cards, featured image, excerpt, spacing, RTL).

## Completed

- [x] 2025-12-24: Product page - adjust desktop columns (deployed)
- [x] 2025-12-24: Checkout radio buttons + saved payment methods styling (deployed)
