<?php
/**
 * Breadcrumbs.
 *
 * Wraps WooCommerce's native breadcrumb output in a styled container and
 * renders it on shop, single product, product taxonomy, cart, and account
 * pages. Hidden on the front page.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Tweak WC breadcrumb defaults: separator + home label.
 */
add_filter('woocommerce_breadcrumb_defaults', function ($defaults) {
    $defaults['delimiter']   = '<span class="breadcrumbs-sep" aria-hidden="true">/</span>';
    $defaults['wrap_before'] = '<nav class="breadcrumbs" aria-label="' . esc_attr__('Breadcrumbs', 'woocommerce') . '"><div class="container">';
    $defaults['wrap_after']  = '</div></nav>';
    $defaults['before']      = '';
    $defaults['after']       = '';
    $defaults['home']        = __('Home', 'woocommerce');
    return $defaults;
});

/**
 * Remove WC's default breadcrumb hook. Our `woocommerce.php` wrapper calls
 * `woocommerce_content()` which only fires `woocommerce_before_main_content`
 * for archive pages — single product, cart, account etc. miss it. We render
 * breadcrumbs from header.php instead, so they appear consistently across all
 * page types (Woo and non-Woo).
 */
add_action('init', function () {
    remove_action('woocommerce_before_main_content', 'woocommerce_breadcrumb', 20);
});

/**
 * Render breadcrumbs below the header on every front-end page except the
 * front page and 404. Called from header.php.
 */
function jlmwines_render_breadcrumbs() {
    if (is_front_page() || is_404()) {
        return;
    }
    if (function_exists('woocommerce_breadcrumb')) {
        woocommerce_breadcrumb();
    }
}

/**
 * Targeted HE overrides for WC search-results strings.
 *
 * WC's plugin code emits two distinct title-style strings for search pages:
 *   1. `Search results for &ldquo;%s&rdquo;` — breadcrumb prefix (class-wc-breadcrumb)
 *   2. `Search results: &ldquo;%s&rdquo;`     — page title for product search
 *      (woocommerce_page_title() called from the theme's woocommerce.php H1)
 *
 * Both use HTML-entity quotes around `%s`. WPML's gettext path fails to match
 * these exact entity-form strings at runtime, so they render English on HE
 * pages even with translation rows in String Translation. The HE translations
 * drop the quotes around `%s` to dodge RTL/LTR bidi reordering that visually
 * scrambles ASCII quotes around the embedded search term.
 *
 * These strings live in WC plugin code (cannot edit source), so a narrow,
 * explicit gettext filter is the deterministic fix. This is the only such
 * filter in the theme — the broader gettext / ngettext_with_context filters
 * for result-count phrases were retired in v1.2.17 (count line removed in
 * v1.2.16).
 */
add_filter('gettext', function ($translation, $text, $domain) {
    if ($domain !== 'woocommerce' || !is_rtl()) {
        return $translation;
    }
    if ($text === 'Search results for &ldquo;%s&rdquo;') {
        return 'תוצאות חיפוש עבור: %s';
    }
    if ($text === 'Search results: &ldquo;%s&rdquo;') {
        return 'תוצאות חיפוש: %s';
    }
    return $translation;
}, 10, 3);
