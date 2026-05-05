<?php
/**
 * Set the Language group on Mailchimp subscribers added through WC checkout.
 *
 * The Mailchimp for WooCommerce plugin syncs opt-in customers to Mailchimp
 * but doesn't set the Language interest group, leaving HE checkout signups
 * indistinguishable from EN. This adds a follow-up call: when payment
 * succeeds, if the customer opted in, PUT their subscriber record with the
 * Language interest matching the order's WPML language.
 *
 * Hook: woocommerce_order_status_processing fires on the server-side
 * payment-success transition (CardCom IPN, etc.) — independent of whether
 * the customer's browser reaches the thank-you page. Idempotent via
 * _jlmwines_mc_lang_synced order meta in case the order transitions
 * through both processing and completed.
 *
 * Mailchimp PUT to /lists/{list}/members/{hash} is upsert-safe with
 * status_if_new=subscribed — runs whether the plugin synced first or not.
 *
 * API key is read from the Mailchimp for WooCommerce plugin's stored
 * settings — no separate credential to maintain.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JLMWINES_MC_AUDIENCE_ID          = '8a3c6dd69c';
const JLMWINES_MC_LANGUAGE_GROUP_ID    = '8b945481c0';
const JLMWINES_MC_LANGUAGE_INTEREST_EN = '17072990c9';
const JLMWINES_MC_LANGUAGE_INTEREST_HE = '962feef4ab';

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
 * Detect newsletter opt-in on the order. Checks our own meta key first
 * (set by the checkout-opt-in checkbox below), falls back to the legacy
 * Mailchimp for WC plugin keys for backward compatibility while the
 * plugin is being deactivated.
 */
function jlmwines_mc_order_opted_in($order) {
    $candidates = [
        '_jlmwines_mc_optin',                           // ours
        'mailchimp_woocommerce_is_subscribed',          // legacy plugin
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
 * PUT the subscriber's Language interest, optionally with merge_fields
 * (FNAME, LNAME, PHONE, ADDRESS) populated from the order's billing data.
 * Idempotent — safe to call when the subscriber already exists or hasn't
 * been synced yet. Mailchimp merges merge_fields rather than replacing,
 * so JLMops-managed preference fields (WINERIES, REDGRAPE, etc.) are
 * never overwritten by this PUT.
 */
function jlmwines_mc_set_language_interest($email, $lang, $merge_fields = []) {
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
    if (!empty($merge_fields)) {
        $body['merge_fields'] = $merge_fields;
    }

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
 * Build the Mailchimp merge_fields array from a WC order's billing data.
 * FNAME / LNAME / PHONE are required billing fields; ADDRESS is structured.
 * Only includes ADDRESS sub-fields that are non-empty (addr2 + state are
 * legitimately optional; rest are required at checkout).
 */
function jlmwines_mc_merge_fields_from_order($order) {
    $address = array_filter([
        'addr1'   => $order->get_billing_address_1(),
        'addr2'   => $order->get_billing_address_2(),
        'city'    => $order->get_billing_city(),
        'state'   => $order->get_billing_state(),
        'zip'     => $order->get_billing_postcode(),
        'country' => $order->get_billing_country(),
    ], 'strlen');

    return [
        'FNAME'   => $order->get_billing_first_name(),
        'LNAME'   => $order->get_billing_last_name(),
        'PHONE'   => $order->get_billing_phone(),
        'ADDRESS' => $address,
    ];
}

/**
 * Fires when the order transitions to processing (payment captured).
 * Server-side hook — fires from the gateway's IPN/callback regardless of
 * whether the customer's browser returns to the thank-you page. Some
 * gateways skip processing and go straight to completed, so we listen on
 * both. The _jlmwines_mc_lang_synced meta guards against double-PUT.
 */
function jlmwines_mc_sync_language_on_paid($order_id) {
    if (!$order_id) {
        return;
    }
    $order = wc_get_order($order_id);
    if (!$order || !jlmwines_mc_order_opted_in($order)) {
        return;
    }
    if ($order->get_meta('_jlmwines_mc_lang_synced')) {
        return;
    }
    $email = $order->get_billing_email();
    if (!$email || !is_email($email)) {
        return;
    }
    $lang = jlmwines_mc_order_language($order);
    $merge = jlmwines_mc_merge_fields_from_order($order);
    jlmwines_mc_set_language_interest($email, $lang, $merge);
    $order->update_meta_data('_jlmwines_mc_lang_synced', current_time('mysql'));
    $order->save();
}
add_action('woocommerce_order_status_processing', 'jlmwines_mc_sync_language_on_paid', 20, 1);
add_action('woocommerce_order_status_completed',  'jlmwines_mc_sync_language_on_paid', 20, 1);

/**
 * Render the newsletter opt-in checkbox at WC checkout, placed just
 * before the place-order button. Replaces the Mailchimp for WooCommerce
 * plugin's opt-in checkbox so the plugin can be deactivated without
 * losing the checkout-opt-in path. Bilingual via is_rtl().
 */
add_action('woocommerce_review_order_before_submit', function () {
    woocommerce_form_field('jlmwines_mc_optin', [
        'type'    => 'checkbox',
        'class'   => ['form-row jlmwines-mc-optin-row'],
        'label'   => is_rtl()
            ? 'שלחו לי מבצעים ומידע על יין במייל'
            : 'Send me special offers and wine info by email',
        'default' => 0,
    ]);
});

/**
 * Save the opt-in choice as order meta. Read by jlmwines_mc_order_opted_in()
 * which then drives the upsert PUT to Mailchimp.
 */
add_action('woocommerce_checkout_create_order', function ($order) {
    if (!empty($_POST['jlmwines_mc_optin'])) {
        $order->update_meta_data('_jlmwines_mc_optin', '1');
    }
}, 20, 1);
