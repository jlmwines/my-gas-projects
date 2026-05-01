<?php
/**
 * Set the Language group on Mailchimp subscribers added through WC checkout.
 *
 * The Mailchimp for WooCommerce plugin syncs opt-in customers to Mailchimp
 * but doesn't set the Language interest group, leaving HE checkout signups
 * indistinguishable from EN. This adds a follow-up call: when an order
 * thank-you renders, if the customer opted in, PUT their subscriber record
 * with the Language interest matching the order's WPML language.
 *
 * Mailchimp PUT to /lists/{list}/members/{hash} is upsert-safe with
 * status_if_new=subscribed — runs whether the plugin synced first or not.
 *
 * Replace the four placeholder constants below with real values from
 * Mailchimp (audience ID, group category ID, EN interest ID, HE interest
 * ID). API key is read from the Mailchimp for WooCommerce plugin's stored
 * settings — no separate credential to maintain.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JLMWINES_MC_AUDIENCE_ID         = ''; // TODO: Mailchimp audience (list) ID
const JLMWINES_MC_LANGUAGE_GROUP_ID   = ''; // TODO: "Language" group category ID
const JLMWINES_MC_LANGUAGE_INTEREST_EN = ''; // TODO: "English" interest ID
const JLMWINES_MC_LANGUAGE_INTEREST_HE = ''; // TODO: "Hebrew" interest ID

/**
 * Read the Mailchimp API key the WC plugin stored on connection.
 * Returns empty string if the plugin isn't configured.
 */
function jlmwines_mc_api_key() {
    $opts = get_option('mailchimp-woocommerce');
    if (!is_array($opts)) {
        return '';
    }
    return isset($opts['mailchimp_api_key']) ? (string) $opts['mailchimp_api_key'] : '';
}

/**
 * Mailchimp data center suffix from the API key (everything after the dash).
 */
function jlmwines_mc_dc($api_key) {
    $pos = strrpos($api_key, '-');
    return $pos === false ? '' : substr($api_key, $pos + 1);
}

/**
 * Determine the order's language. Prefers WPML's recorded language for the
 * order, falls back to the site's current language at thankyou-render time.
 */
function jlmwines_mc_order_language($order) {
    $lang = $order->get_meta('wpml_language');
    if ($lang) {
        return $lang;
    }
    if (function_exists('icl_get_current_language')) {
        return icl_get_current_language();
    }
    return 'en';
}

/**
 * Detect newsletter opt-in on the order. The Mailchimp for WC plugin
 * stores this on the order meta — exact key has shifted across plugin
 * versions, so we check the common candidates.
 */
function jlmwines_mc_order_opted_in($order) {
    $candidates = [
        'mailchimp_woocommerce_is_subscribed',
        '_mailchimp_woocommerce_is_subscribed',
        'mailchimp_woocommerce_subscribed',
    ];
    foreach ($candidates as $key) {
        $val = $order->get_meta($key);
        if ($val === '1' || $val === 1 || $val === true || $val === 'yes') {
            return true;
        }
    }
    return false;
}

/**
 * PUT the subscriber's Language interest. Idempotent — safe to call when
 * the subscriber already exists or hasn't been synced yet.
 */
function jlmwines_mc_set_language_interest($email, $lang) {
    $api_key   = jlmwines_mc_api_key();
    $audience  = JLMWINES_MC_AUDIENCE_ID;
    $group_cat = JLMWINES_MC_LANGUAGE_GROUP_ID;
    $en_id     = JLMWINES_MC_LANGUAGE_INTEREST_EN;
    $he_id     = JLMWINES_MC_LANGUAGE_INTEREST_HE;

    if (!$api_key || !$audience || !$group_cat || !$en_id || !$he_id) {
        return;
    }

    $dc = jlmwines_mc_dc($api_key);
    if (!$dc) {
        return;
    }

    $hash = md5(strtolower($email));
    $url  = sprintf('https://%s.api.mailchimp.com/3.0/lists/%s/members/%s', $dc, $audience, $hash);

    $is_he = ($lang === 'he');
    $body = [
        'email_address'   => $email,
        'status_if_new'   => 'subscribed',
        'interests'       => [
            $group_cat => [
                $en_id => !$is_he,
                $he_id => $is_he,
            ],
        ],
    ];

    wp_remote_request($url, [
        'method'  => 'PUT',
        'timeout' => 8,
        'headers' => [
            'Authorization' => 'Basic ' . base64_encode('anystring:' . $api_key),
            'Content-Type'  => 'application/json',
        ],
        'body'    => wp_json_encode($body),
    ]);
}

/**
 * Fires once on the WC thankyou page. If the order opted into the
 * newsletter, push the Language interest matching the order's language.
 */
add_action('woocommerce_thankyou', function ($order_id) {
    if (!$order_id) {
        return;
    }
    $order = wc_get_order($order_id);
    if (!$order || !jlmwines_mc_order_opted_in($order)) {
        return;
    }
    $email = $order->get_billing_email();
    if (!$email || !is_email($email)) {
        return;
    }
    $lang = jlmwines_mc_order_language($order);
    jlmwines_mc_set_language_interest($email, $lang);
}, 20, 1);
