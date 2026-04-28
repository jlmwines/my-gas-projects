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
    $defaults['wrap_before'] = '<nav class="breadcrumbs" aria-label="' . esc_attr__('Breadcrumb', 'jlmwines') . '"><div class="container">';
    $defaults['wrap_after']  = '</div></nav>';
    $defaults['before']      = '';
    $defaults['after']       = '';
    $defaults['home']        = __('Home', 'jlmwines');
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
