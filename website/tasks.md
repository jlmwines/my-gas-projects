# Website Tasks

WooCommerce/WordPress website improvements and customizations.

## Bugs

(none)

## Pending

- [ ] 2025-12-24: Enable Wordfence Login Security WooCommerce integration
- [ ] 2026-11-05: Site Health performance items (wp-admin → Site Health). (1) **Persistent object cache:** done 2026-11-05, Memcached on in Site Tools and in the Speed Optimizer plugin (the plugin toggle installs the drop-in WordPress needs); reversible. (2) **OPcache reported off**: not a user-editable variable in PHP Manager; site runs SiteGround's Ultrafast PHP setup, which manages OPcache at server level, so likely a false reading (SiteGround restricts the status call Site Health uses). Ask SiteGround support only if wanting certainty. Template overrides: done (see Completed). Reviewed and no action needed: background updates (SiteGround's auto-updater deliberately sets `WP_AUTO_UPDATE_CORE` false), authorization header (app-password REST auth verified working 2026-11-05), MCP OAuth discovery (we use app passwords, not OAuth), approved download directories (no downloadable products), email test (order emails reach the manager).
- [ ] 2026-11-05: ACF Multilingual (inactive): investigate before touching. ACF was tried and abandoned, but Cardcom keeps many custom fields for charges and it's unclear whether any rely on ACF.
- [ ] 2026-05-07: Untranslated strings audit — walk live in EN and HE, list every visible English string on HE pages (and vice versa). Likely surfaces: WC chrome (cart/checkout/account), PDP variation labels, Complianz banner, plugin-emitted strings. Resolve via inline `is_rtl()` baking (theme-owned) or WPML String Translation (plugin/WC chrome). Note: the WPML String Translation cleanup itself shipped v1.2.17–v1.2.19; this is the remaining broad sweep.
- [ ] 2026-05-07: WC term thumbnails refresh — admin-side category images in wp-admin → Products → Categories are still old. Customer-facing pages already use theme overrides, so this is admin cosmetic only.
- [ ] 2026-06-17: Blog post category page is poorly formatted — improve the post-listing layout (e.g. the Basics category archive, EN + HE). Specifics TBD: walk the live category page and capture what's broken (post cards, featured image, excerpt, spacing, RTL).

## Completed

- [x] 2026-11-05: WooCommerce template overrides reconciled with WC 11.2.2, theme v1.2.34 live. Emails keep JLM custom wording (exact strings, so WPML Hebrew translations still match) in both email-improvements modes. Mini-cart deliberately keeps `woocommerce_cart_item_visible` (core uses the widget filter; switching could change bundle display). On future WC updates, diff against the new core version the same way. The `woocommerce.php` vs `archive-product.php` notice is informational (intended wrapper).

- [x] 2026-11-05: Plugin cleanup. Jetpack and WordPress Importer (prior theme only) deleted. Kept on purpose: Worker (user's ManageWP multi-site updates), `mailchimp-woocommerce` (inactive, but its `wp_options` API key is what the theme reads, DO NOT DELETE), Better Search Replace, Disable Admin Notices, Meta for WooCommerce, User Switching (inactive, user's choice).

- [x] 2025-12-24: Product page - adjust desktop columns (deployed)
- [x] 2025-12-24: Checkout radio buttons + saved payment methods styling (deployed)
