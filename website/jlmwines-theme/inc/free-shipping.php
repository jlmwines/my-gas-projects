<?php
/**
 * Free shipping monitor.
 *
 * Reads the threshold from the first enabled WC free_shipping method found in
 * any shipping zone. Renders a box variant on the cart page (woocommerce_before_cart)
 * and a slim strip under the header on other front-end pages. Auto-refreshes via
 * WC AJAX cart fragments when the customer adds/removes items.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Free-shipping threshold (NIS) from the first enabled free_shipping method
 * found across all shipping zones. Returns 0 if none configured.
 */
function jlmwines_get_free_shipping_threshold() {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $cached = 0;
    if (!class_exists('WC_Shipping_Zones')) {
        return $cached;
    }

    $zones = WC_Shipping_Zones::get_zones();
    $rest_of_world = WC_Shipping_Zones::get_zone(0);
    if ($rest_of_world) {
        $zones[] = ['shipping_methods' => $rest_of_world->get_shipping_methods()];
    }

    foreach ($zones as $zone) {
        if (empty($zone['shipping_methods'])) {
            continue;
        }
        foreach ($zone['shipping_methods'] as $method) {
            if ($method->id !== 'free_shipping' || $method->enabled !== 'yes') {
                continue;
            }
            $min = isset($method->min_amount) ? (float) $method->min_amount : 0;
            if ($min > 0) {
                $cached = $min;
                return $cached;
            }
        }
    }
    return $cached;
}

/**
 * Visible shipping fee for cart-summary display. Reads the first non-free-shipping
 * method's `cost` from the shipping zones. Returns ['amount' => float|null, 'qualified' => bool].
 * Returns amount=0 with qualified=true when the free-shipping threshold is met.
 */
function jlmwines_get_shipping_fee() {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $cached = ['amount' => null, 'qualified' => false];

    if (!class_exists('WC_Shipping_Zones') || !class_exists('WooCommerce')) {
        return $cached;
    }

    $monitor = jlmwines_get_shipping_monitor_data();
    if ($monitor['qualified']) {
        $cached = ['amount' => 0.0, 'qualified' => true];
        return $cached;
    }

    $zones = WC_Shipping_Zones::get_zones();
    $rest_of_world = WC_Shipping_Zones::get_zone(0);
    if ($rest_of_world) {
        $zones[] = ['shipping_methods' => $rest_of_world->get_shipping_methods()];
    }

    foreach ($zones as $zone) {
        if (empty($zone['shipping_methods'])) {
            continue;
        }
        foreach ($zone['shipping_methods'] as $method) {
            if (!is_object($method)) continue;
            if (isset($method->id) && $method->id === 'free_shipping') continue;
            if (isset($method->enabled) && $method->enabled !== 'yes') continue;

            $cost = null;
            if (isset($method->cost) && $method->cost !== '' && is_numeric($method->cost)) {
                $cost = (float) $method->cost;
            } elseif (method_exists($method, 'get_option')) {
                $opt = $method->get_option('cost');
                if ($opt !== false && $opt !== '' && is_numeric($opt)) {
                    $cost = (float) $opt;
                }
            }

            if ($cost !== null) {
                $cached = ['amount' => $cost, 'qualified' => false];
                return $cached;
            }
        }
    }

    return $cached;
}

/**
 * Current monitor state: threshold, subtotal, qualified flag, remaining, percent.
 */
function jlmwines_get_shipping_monitor_data() {
    $threshold = jlmwines_get_free_shipping_threshold();
    $subtotal  = 0;

    if (function_exists('WC') && WC()->cart) {
        // Sum directly from cart contents using each item's product
        // price × quantity. This bypasses WC's totals-state caching
        // entirely — the monitor previously depended on
        // get_displayed_subtotal(), which reads from $cart->totals
        // populated by calculate_totals(); those totals can lag the
        // session's cart_contents during the cart-update request flow,
        // making the monitor read a "stale" subtotal.
        //
        // get_price() and quantity are the source of truth for line
        // items; iterating them gives the same number cart shows.
        $include_tax = WC()->cart->display_prices_including_tax();
        foreach (WC()->cart->get_cart() as $cart_item) {
            $product = $cart_item['data'] ?? null;
            if (!$product || !is_a($product, 'WC_Product')) {
                continue;
            }
            $qty   = (float) ($cart_item['quantity'] ?? 0);
            $price = (float) wc_get_price_to_display($product, [
                'price' => $product->get_price(),
                'qty'   => 1,
            ]);
            $subtotal += $price * $qty;
        }
    }

    $remaining = max(0, $threshold - $subtotal);
    $qualified = ($threshold > 0 && $remaining <= 0 && $subtotal > 0);
    $pct       = $threshold > 0 ? min(100, max(0, ($subtotal / $threshold) * 100)) : 0;

    return compact('threshold', 'subtotal', 'qualified', 'remaining', 'pct');
}

/**
 * Render the monitor. $variant: 'box' (cart page) or 'slim' (header strip).
 */
function jlmwines_render_shipping_monitor($variant = 'box') {
    $data = jlmwines_get_shipping_monitor_data();
    if ($data['threshold'] <= 0) {
        return;
    }

    $classes = ['shipping-monitor', $variant];
    if ($data['qualified']) {
        $classes[] = 'qualified';
    }

    $is_he = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';

    $remaining_html = '<strong>' . wc_price($data['remaining'], ['decimals' => 0]) . '</strong>';
    $threshold_html = '<strong>' . wc_price($data['threshold'], ['decimals' => 0]) . '</strong>';

    // Per-language hardcoded copy (matches the pattern used in
    // template-articles.php — proper .po harvest still on the deferred
    // TODO). Three states: qualified / empty cart / below threshold.
    if ($data['qualified']) {
        $message = $is_he
            ? 'מזל טוב, המשלוח עלינו!'
            : 'Congratulations, the shipping is on us!';
    } elseif ($data['subtotal'] <= 0) {
        $message = $is_he
            ? sprintf('משלוח חינם בהזמנה של %s ומעלה.', $threshold_html)
            : sprintf('Free delivery with order of %s or more.', $threshold_html);
    } else {
        $message = $is_he
            ? sprintf('רק עוד %s והמשלוח חינם', $remaining_html)
            : sprintf('Only %s more for free shipping.', $remaining_html);
    }

    $width = number_format($data['pct'], 1, '.', '');
    ?>
    <div class="<?php echo esc_attr(implode(' ', $classes)); ?>">
        <div class="shipping-monitor-head">
            <div class="shipping-monitor-message"><?php echo $message; // wc_price html already escaped ?></div>
        </div>
        <?php if ($data['subtotal'] > 0 && !$data['qualified']) : ?>
            <div class="shipping-monitor-bar"><div class="shipping-monitor-fill" style="width:<?php echo esc_attr($width); ?>%"></div></div>
        <?php endif; ?>
    </div>
    <?php
}

/**
 * Slim strip rendered from header.php on non-cart/checkout pages.
 * No threshold or cart/checkout context = no wrapper at all (cleaner DOM).
 */
function jlmwines_render_shipping_monitor_strip() {
    if (function_exists('is_cart') && (is_cart() || is_checkout())) {
        return;
    }
    if (jlmwines_get_free_shipping_threshold() <= 0) {
        return;
    }
    ?>
    <div class="shipping-monitor-strip-wrap">
        <div class="container">
            <?php jlmwines_render_shipping_monitor('slim'); ?>
        </div>
    </div>
    <?php
}

// Hooked inside the cart form (rather than woocommerce_before_cart)
// so WC's AJAX update_wc_div() swaps it together with the form. The
// outer hook leaves our wrap as stale DOM after Update Cart because
// update_wc_div() only replaces .woocommerce-cart-form, .cart_totals,
// and notices.
add_action('woocommerce_before_cart_table', function () {
    echo '<div class="shipping-monitor-cart-wrap">';
    jlmwines_render_shipping_monitor('box');
    echo '</div>';
});

/**
 * AJAX refresh on cart change. Replaces both the slim strip (for non-
 * cart/checkout pages) and the cart-page box wrapper. WC fires this
 * filter on add-to-cart AND on cart-quantity AJAX updates, so any
 * client-side cart change triggers a fresh render.
 */
add_filter('woocommerce_add_to_cart_fragments', function ($fragments) {
    // Slim strip (renders empty on cart/checkout pages — harmless replace)
    ob_start();
    jlmwines_render_shipping_monitor_strip();
    $fragments['div.shipping-monitor-strip-wrap'] = ob_get_clean();

    // Cart-page box variant
    if (function_exists('is_cart') && is_cart()) {
        ob_start();
        echo '<div class="shipping-monitor-cart-wrap">';
        jlmwines_render_shipping_monitor('box');
        echo '</div>';
        $fragments['div.shipping-monitor-cart-wrap'] = ob_get_clean();
    }

    return $fragments;
});
