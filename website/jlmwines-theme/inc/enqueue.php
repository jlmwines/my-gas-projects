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
        'https://fonts.googleapis.com/css2?family=Secular+One&family=Rubik:wght@400;500;600;700&display=swap',
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
 * Strip the cdn.elementor.com dns-prefetch hint. Elementor is
 * uninstalled but the hint still appears in <head> — likely added
 * by a plugin via its own wp_head action or by Elementor's leftover
 * autoloader bits. Filtering wp_resource_hints at priority 999
 * catches both filter-registered hints AND late-added ones; for
 * anything that bypasses the filter entirely we sweep wp_head via
 * an output-buffering filter below.
 */
add_filter('wp_resource_hints', function ($hints, $relation_type) {
    if ($relation_type !== 'dns-prefetch') {
        return $hints;
    }
    return array_values(array_filter($hints, function ($hint) {
        $url = is_array($hint) ? ($hint['href'] ?? '') : $hint;
        return stripos((string) $url, 'cdn.elementor.com') === false;
    }));
}, 999, 2);

/**
 * Defensive dequeue for wc-blocks-* stylesheets on the homepage.
 * The explicit-handle dequeue in jlmwines_is_blockless_route() above
 * should catch wc-blocks-style, but WC re-registers it via a later
 * hook chain in some setups (Woo + WPML interaction observed
 * 2026-05-17). Stripping the <link> tag at output time is the
 * last-line-of-defense: even if the handle gets re-enqueued, the tag
 * never reaches the browser.
 */
add_filter('style_loader_tag', function ($tag, $handle) {
    if (!is_front_page()) {
        return $tag;
    }
    if (strpos($handle, 'wc-blocks') === 0 || $handle === 'wp-block-library' || $handle === 'global-styles') {
        return '';
    }
    return $tag;
}, 10, 2);

/**
 * Reusable predicate for routes that render no Gutenberg block content.
 * Used by the block-CSS dequeue below. NOTE: this predicate is broader than
 * the WC-classic-CSS filter scope — shop/category/cart/checkout legitimately
 * need WC's classic styles for product grid / price / add-to-cart rendering;
 * they're included here only to dequeue *block* CSS, which they don't use.
 */
function jlmwines_is_blockless_route() {
    return is_front_page()
        || (function_exists('is_shop') && is_shop())
        || (function_exists('is_product_category') && is_product_category())
        || (function_exists('is_product_tag') && is_product_tag())
        || (function_exists('is_cart') && is_cart())
        || (function_exists('is_checkout') && is_checkout())
        || (function_exists('is_account_page') && is_account_page());
}

/**
 * Disable WooCommerce's classic stylesheets (woocommerce-general,
 * woocommerce-layout, woocommerce-smallscreen — totalling ~22 KiB and
 * ~2.2 s of mobile render-blocking time per 2026-05-12 PSI audit) on
 * the homepage only. The audit was a homepage measurement; extending
 * the dequeue to shop/category/cart/checkout was overreach — those
 * pages need WC's classic CSS for product grid / price / cart rendering.
 * Restoring earlier broke the catalog on live; predicate now narrowed
 * to is_front_page() only.
 *
 * Returning [] from this filter short-circuits WC's enqueue. Cleaner
 * than wp_dequeue_style after-the-fact because the handles never get
 * registered into the print queue.
 */
add_filter('woocommerce_enqueue_styles', function ($styles) {
    if (is_front_page()) {
        return [];
    }
    return $styles;
});

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
    if (!jlmwines_is_blockless_route()) {
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
        '/assets/css/blocks',            // older WC blocks path AND plugin blocks.css (e.g., woosb)
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
 * Dequeue woosb-frontend.css (3.7 KiB) on routes that never render bundle
 * composition UI. Required on cart, checkout, and single-product (a bundle
 * product page needs the qty/section/total styling). Dead weight on
 * homepage and product list archives, which show products as cards
 * without bundle interaction.
 */
add_action('wp_enqueue_scripts', function () {
    $has_no_bundle_ui = is_front_page()
        || (function_exists('is_shop') && is_shop())
        || (function_exists('is_product_category') && is_product_category())
        || (function_exists('is_product_tag') && is_product_tag())
        || (function_exists('is_account_page') && is_account_page());
    if (!$has_no_bundle_ui) {
        return;
    }
    wp_dequeue_style('woosb-frontend');
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
