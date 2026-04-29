<?php
/**
 * Coupon extensions.
 *
 * Adds a "First-purchase only" toggle to the WooCommerce coupon edit
 * screen. When checked, the coupon is only valid for customers who
 * have no completed/processing/on-hold orders yet. Replaces the need
 * for Smart Coupons / Advanced Coupons for this single rule.
 *
 * Usage: edit a coupon in wp-admin, tick "First-purchase only" in the
 * General tab, save. The validation runs whenever the coupon is
 * applied or re-checked at checkout.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JLMWINES_FIRST_PURCHASE_META = '_jlmwines_first_purchase_only';

/**
 * Render the checkbox on the coupon edit screen (General tab).
 */
add_action('woocommerce_coupon_options', function () {
    woocommerce_wp_checkbox([
        'id'          => JLMWINES_FIRST_PURCHASE_META,
        'label'       => __('First-purchase only', 'jlmwines'),
        'description' => __('Only valid for customers with no prior orders. Guest checkouts validate against the billing email.', 'jlmwines'),
    ]);
}, 10);

/**
 * Save the checkbox value when a coupon is updated.
 */
add_action('woocommerce_coupon_options_save', function ($post_id) {
    $value = isset($_POST[JLMWINES_FIRST_PURCHASE_META]) ? 'yes' : 'no';
    update_post_meta($post_id, JLMWINES_FIRST_PURCHASE_META, $value);
}, 10);

/**
 * Validate the rule at apply / checkout time.
 *
 * If the coupon has the flag and the resolved customer has any
 * completed / processing / on-hold orders, the coupon is invalid.
 * If no user can be resolved (e.g., logged-out guest with a brand-new
 * email), the coupon passes — they get the discount on the order that
 * creates their account.
 */
add_filter('woocommerce_coupon_is_valid_for_user', function ($valid, $coupon, $user_email) {
    if (!$valid) {
        return $valid;
    }
    if (get_post_meta($coupon->get_id(), JLMWINES_FIRST_PURCHASE_META, true) !== 'yes') {
        return $valid;
    }

    // Resolve the customer: prefer the email passed in (covers guest
    // checkout) and fall back to the logged-in user.
    $user = null;
    if ($user_email) {
        $user = get_user_by('email', $user_email);
    }
    if (!$user && is_user_logged_in()) {
        $user = wp_get_current_user();
    }
    if (!$user || !$user->ID) {
        // Brand-new email — let the discount through.
        return $valid;
    }

    $existing = wc_get_orders([
        'customer_id' => $user->ID,
        'status'      => ['wc-completed', 'wc-processing', 'wc-on-hold'],
        'limit'       => 1,
        'return'      => 'ids',
    ]);
    if (!empty($existing)) {
        return false;
    }
    return $valid;
}, 10, 3);
