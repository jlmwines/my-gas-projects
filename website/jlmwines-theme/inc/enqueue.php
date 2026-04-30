<?php
/**
 * Asset enqueue.
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_enqueue_assets() {
    $main_css_path = get_template_directory() . '/assets/css/main.css';
    $main_css_ver  = file_exists($main_css_path) ? filemtime($main_css_path) : JLMWINES_VERSION;

    wp_enqueue_style(
        'jlmwines-fonts',
        'https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;700&family=Rubik:wght@400;500;600;700&display=swap',
        [],
        null
    );

    wp_enqueue_style(
        'jlmwines-main',
        get_template_directory_uri() . '/assets/css/main.css',
        ['jlmwines-fonts'],
        $main_css_ver
    );

    $main_js_path = get_template_directory() . '/assets/js/main.js';
    $main_js_ver  = file_exists($main_js_path) ? filemtime($main_js_path) : JLMWINES_VERSION;

    wp_enqueue_script(
        'jlmwines-main',
        get_template_directory_uri() . '/assets/js/main.js',
        [],
        $main_js_ver,
        true
    );

    // RTL handling lives in main.css via [dir="rtl"] selectors; WPML sets <html dir="rtl"> automatically.
}
add_action('wp_enqueue_scripts', 'jlmwines_enqueue_assets');

/**
 * Preconnect to Google Fonts origins.
 *
 * The browser otherwise doesn't open connections to fonts.googleapis.com
 * (CSS host) and fonts.gstatic.com (font-file host) until it parses the
 * stylesheet link in <head>. On a slow-4G mobile profile that DNS + TCP +
 * TLS handshake adds ~300-450ms to FCP. Preconnect parallelizes the
 * handshake with HTML parse so by the time the font CSS request fires,
 * the connection is already warm.
 *
 * fonts.gstatic.com requires `crossorigin` because font files must be
 * CORS-fetched; fonts.googleapis.com (CSS) does not.
 */
add_filter('wp_resource_hints', function ($hints, $relation_type) {
    if ($relation_type === 'preconnect') {
        $hints[] = 'https://fonts.googleapis.com';
        $hints[] = ['href' => 'https://fonts.gstatic.com', 'crossorigin'];
    }
    return $hints;
}, 10, 2);

/**
 * Dequeue block-library + WooCommerce blocks CSS on routes that render
 * no Gutenberg block content.
 *
 * The homepage uses front-page.php (pure PHP templates with our own
 * design-system CSS); shop / archive / cart / checkout / account pages
 * route through Woo templates. None of these output block-styled
 * markup, so block stylesheets are pure render-blocking dead weight on
 * mobile (≈1.5 s of mobile critical-path delay measured on slow-4G).
 *
 * Two-pronged dequeue:
 *   1) Known handle names registered by WP/WC core
 *   2) URL-pattern sweep that catches per-block stylesheets registered
 *      with handles we can't predict (legacy-list-horizontal, menu-item,
 *      WC's @woocommerce/block-library frontend.css/blocks.css, etc.)
 *
 * Singular product, blog post, and standard page templates keep these
 * stylesheets because they pipe content through `the_content()` and
 * may render Gutenberg blocks authored in the editor.
 */
add_action('wp_enqueue_scripts', function () {
    $is_blockless_route = is_front_page()
        || (function_exists('is_shop') && is_shop())
        || (function_exists('is_product_category') && is_product_category())
        || (function_exists('is_product_tag') && is_product_tag())
        || (function_exists('is_cart') && is_cart())
        || (function_exists('is_checkout') && is_checkout())
        || (function_exists('is_account_page') && is_account_page());

    if (!$is_blockless_route) {
        return;
    }

    // Known handles
    $handles = [
        'wp-block-library',
        'wp-block-library-theme',
        'global-styles',
        'wc-blocks-style',
        'wc-blocks-vendors-style',
        'wc-blocks-packages-style',
    ];
    foreach ($handles as $handle) {
        wp_dequeue_style($handle);
    }

    // URL-pattern sweep for per-block stylesheets registered with
    // handles we don't predict ahead of time.
    global $wp_styles;
    if (!$wp_styles) {
        return;
    }
    $patterns = [
        '/wp-includes/blocks/',          // WP core per-block CSS
        '/assets/client/blocks/',        // WC's @woocommerce/block-library bundle
        '/assets/css/blocks/',           // older WC blocks path
        'wc-blocks',                     // any wc-blocks-* handle/url
    ];
    foreach (array_keys($wp_styles->registered) as $handle) {
        $src = $wp_styles->registered[$handle]->src;
        if (!is_string($src) || $src === '') {
            continue;
        }
        foreach ($patterns as $pat) {
            if (stripos($src, $pat) !== false) {
                wp_dequeue_style($handle);
                break;
            }
        }
    }
}, 100);

/**
 * Cookie-banner reopen trigger.
 *
 * Complianz exposes a hidden internal `.cmplz-manage-consent` element
 * that opens its consent banner; clicking it via JS works regardless
 * of whether the floating tab is visible. We surface a footer link
 * with class `.cmplz-show-banner` and delegate clicks from it to the
 * hidden control. This is the official Complianz-recommended pattern
 * for sites that hide the floating tab but still need a manual
 * consent-management entry point.
 */
add_action('wp_footer', function () {
    ?>
    <script>
    (function () {
        function delegate(eventName, selector, handler) {
            document.addEventListener(eventName, function (e) {
                if (e.target.closest(selector)) {
                    handler(e);
                }
            });
        }
        delegate('click', '.cmplz-show-banner', function (e) {
            e.preventDefault();
            document.querySelectorAll('.cmplz-manage-consent').forEach(function (btn) {
                btn.click();
            });
        });
    })();
    </script>
    <?php
}, 100);
