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
        'label'       => 'First-purchase only',
        'description' => 'Only valid for customers with no prior orders. Guest checkouts validate against the billing email.',
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
 * If the coupon has the flag and this customer has any completed /
 * processing / on-hold order already, the coupon is invalid. Checked
 * two ways: by billing email (catches guest checkout, which has no
 * linked account) and by account (catches an old order placed under a
 * different email while logged in). If neither turns up a past order,
 * the coupon passes.
 *
 * Fixed 2026-09-03: was hooked to 'woocommerce_coupon_is_valid_for_user',
 * which is not a real WooCommerce filter (verified against WC core
 * class-wc-discounts.php / class-wc-coupon.php / class-wc-cart.php) --
 * so this check never ran, for anyone, since the file was created. The
 * real filter is 'woocommerce_coupon_is_valid', which does not pass a
 * user email, so it's resolved here instead (logged-in account email,
 * else the guest email WooCommerce has captured so far in the session).
 */
add_filter('woocommerce_coupon_is_valid', function ($valid, $coupon) {
    if (!$valid) {
        return $valid;
    }
    if (get_post_meta($coupon->get_id(), JLMWINES_FIRST_PURCHASE_META, true) !== 'yes') {
        return $valid;
    }

    $statuses = ['wc-completed', 'wc-processing', 'wc-on-hold'];

    // Resolve the customer's email: logged-in account email first, else
    // whatever guest email WC()->customer has captured so far this
    // session (populated as the checkout form is filled in via the
    // standard update_order_review AJAX flow).
    $email = '';
    if (is_user_logged_in()) {
        $email = wp_get_current_user()->user_email;
    } elseif (function_exists('WC') && WC()->customer) {
        $email = WC()->customer->get_billing_email();
    }

    // Primary check: any past order billed to this email, guest or
    // account-holder alike. This is the check that actually covers
    // guest checkout, since a guest order has no linked customer_id.
    if ($email) {
        $byEmail = wc_get_orders([
            'billing_email' => $email,
            'status'        => $statuses,
            'limit'         => 1,
            'return'        => 'ids',
        ]);
        if (!empty($byEmail)) {
            return false;
        }
    }

    // Secondary check: any past order linked to this account, in case
    // an old order was placed under a different billing email.
    $user = $email ? get_user_by('email', $email) : null;
    if (!$user && is_user_logged_in()) {
        $user = wp_get_current_user();
    }
    if ($user && $user->ID) {
        $byAccount = wc_get_orders([
            'customer_id' => $user->ID,
            'status'      => $statuses,
            'limit'       => 1,
            'return'      => 'ids',
        ]);
        if (!empty($byAccount)) {
            return false;
        }
    }

    return $valid;
}, 10, 2);
