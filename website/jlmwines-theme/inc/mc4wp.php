<?php
/**
 * MC4WP per-language form selection.
 *
 * Returns the EN or HE MC4WP form ID based on the current WPML language.
 * Each form is configured in MC4WP admin with a hidden Mailchimp Interest
 * field targeting the matching value of the "Language" group (English /
 * Hebrew). Subscribers from each language form land in the right group.
 *
 * Replace the two placeholder IDs below with the real form IDs from
 * wp-admin → MC4WP → Forms.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JLMWINES_MC4WP_FORM_ID_EN = 0; // TODO: set to MC4WP form ID for English
const JLMWINES_MC4WP_FORM_ID_HE = 0; // TODO: set to MC4WP form ID for Hebrew

add_filter('jlmwines_mc4wp_form_id', function ($form_id, $current_lang) {
    if ($current_lang === 'he' && JLMWINES_MC4WP_FORM_ID_HE > 0) {
        return JLMWINES_MC4WP_FORM_ID_HE;
    }
    if (JLMWINES_MC4WP_FORM_ID_EN > 0) {
        return JLMWINES_MC4WP_FORM_ID_EN;
    }
    return $form_id;
}, 10, 2);
