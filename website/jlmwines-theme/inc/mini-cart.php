<?php
/**
 * Mini-cart drawer.
 *
 * Cart icon click opens a slide-in drawer containing the WC mini-cart with
 * inline qty controls. Quantity changes commit via wc_ajax with no full
 * page reload; cart fragments refresh the drawer body and the header
 * cart-icon count badge.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Render the cart drawer markup. Called from header.php after the nav drawer.
 */
function jlmwines_render_mini_cart_drawer() {
    if (!class_exists('WooCommerce')) {
        return;
    }
    ?>
    <div class="cart-drawer" id="cart-drawer" aria-hidden="true">
        <div class="cart-drawer-backdrop" data-cart-drawer-close></div>
        <aside class="cart-drawer-panel" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e('Shopping cart', 'jlmwines'); ?>">
            <header class="cart-drawer-head">
                <h2 class="cart-drawer-title"><?php esc_html_e('Your cart', 'jlmwines'); ?></h2>
                <button type="button" class="cart-drawer-close" data-cart-drawer-close aria-label="<?php esc_attr_e('Close cart', 'jlmwines'); ?>">
                    <svg width="22" height="22" aria-hidden="true"><use href="#i-close"/></svg>
                </button>
            </header>
            <div class="widget_shopping_cart_content">
                <?php woocommerce_mini_cart(); ?>
            </div>
        </aside>
    </div>
    <?php
}

/**
 * AJAX endpoint: update a cart item's quantity, or remove it when qty <= 0.
 * Wired via wc_ajax (?wc-ajax=jlmwines_update_qty).
 */
add_action('wc_ajax_jlmwines_update_qty', 'jlmwines_ajax_update_qty');
add_action('wp_ajax_jlmwines_update_qty', 'jlmwines_ajax_update_qty');
add_action('wp_ajax_nopriv_jlmwines_update_qty', 'jlmwines_ajax_update_qty');

function jlmwines_ajax_update_qty() {
    if (!class_exists('WooCommerce') || !WC()->cart) {
        wp_send_json_error(['message' => 'WooCommerce unavailable'], 500);
    }

    $cart_item_key = isset($_POST['cart_item_key']) ? wc_clean(wp_unslash($_POST['cart_item_key'])) : '';
    $qty           = isset($_POST['qty']) ? (int) $_POST['qty'] : 0;

    if ($cart_item_key === '' || !isset(WC()->cart->cart_contents[$cart_item_key])) {
        wp_send_json_error(['message' => 'Invalid cart item'], 400);
    }

    if ($qty > 0) {
        WC()->cart->set_quantity($cart_item_key, $qty, true);
    } else {
        WC()->cart->remove_cart_item($cart_item_key);
    }

    WC()->cart->calculate_totals();

    ob_start();
    woocommerce_mini_cart();
    $mini_cart_html = ob_get_clean();

    ob_start();
    jlmwines_render_shipping_monitor_strip();
    $strip_html = ob_get_clean();

    wp_send_json_success([
        'fragments' => [
            'div.widget_shopping_cart_content' => '<div class="widget_shopping_cart_content">' . $mini_cart_html . '</div>',
            'div.shipping-monitor-strip-wrap'  => $strip_html,
        ],
        'cart_count' => WC()->cart->get_cart_contents_count(),
    ]);
}

/**
 * Add the drawer's monitor to WC's existing fragments so add-to-cart from a
 * product page also refreshes the drawer's free-shipping monitor in place.
 */
add_filter('woocommerce_add_to_cart_fragments', function ($fragments) {
    // Cart-icon count badge — replace the whole anchor so the badge appears/disappears cleanly.
    ob_start();
    jlmwines_render_cart_icon();
    $fragments['a.cart-icon'] = ob_get_clean();

    return $fragments;
});

/**
 * Render the header cart icon as an anchor that JS hijacks to open the
 * drawer. Without JS the link still goes to /cart/ — graceful fallback.
 */
function jlmwines_render_cart_icon() {
    if (!class_exists('WooCommerce')) {
        return;
    }
    $count = WC()->cart ? WC()->cart->get_cart_contents_count() : 0;
    ?>
    <a class="cart-icon" href="<?php echo esc_url(wc_get_cart_url()); ?>" aria-label="<?php esc_attr_e('Cart', 'jlmwines'); ?>" data-cart-drawer-open>
        <svg width="20" height="20"><use href="#i-cart"/></svg>
        <?php if ($count > 0) : ?>
            <span class="cart-icon-count"><?php echo esc_html($count); ?></span>
        <?php endif; ?>
    </a>
    <?php
}

/**
 * Pass the wc-ajax URL template to JS so qty updates can post to it.
 */
add_action('wp_enqueue_scripts', function () {
    if (!wp_script_is('jlmwines-main', 'enqueued')) {
        return;
    }
    wp_localize_script('jlmwines-main', 'jlmwinesParams', [
        'wcAjaxUrl' => class_exists('WC_AJAX') ? WC_AJAX::get_endpoint('%%endpoint%%') : '',
    ]);
}, 20);
