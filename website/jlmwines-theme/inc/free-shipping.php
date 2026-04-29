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
        $subtotal = (float) WC()->cart->get_displayed_subtotal();
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

add_action('woocommerce_before_cart', function () {
    jlmwines_render_shipping_monitor('box');
}, 5);

/**
 * AJAX refresh on cart change. Replaces the strip wrapper so progress updates
 * without a full page reload.
 */
add_filter('woocommerce_add_to_cart_fragments', function ($fragments) {
    ob_start();
    jlmwines_render_shipping_monitor_strip();
    $fragments['div.shipping-monitor-strip-wrap'] = ob_get_clean();
    return $fragments;
});
