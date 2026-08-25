<?php
/**
 * Customizer registration — site-editor controls for editorially-managed
 * imagery. Stores attachment IDs (not URLs) so wp_get_attachment_image()
 * can render a proper srcset from WP's pre-built image sizes.
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_sanitize_checkbox($checked) {
    return ((isset($checked) && true == $checked) ? true : false);
}

add_action('customize_register', function ($wp_customize) {

    // ─── Section: Homepage Hero ────────────────────────────────────
    $wp_customize->add_section('jlmwines_hero', [
        'title'    => 'Homepage Hero',
        'priority' => 35,
    ]);

    // Attachment ID — preferred over a URL because wp_get_attachment_image()
    // builds srcset/sizes from WP's intermediate sizes automatically. On
    // mobile the browser fetches a ~300-wide variant instead of the full
    // hero, dropping LCP on slow networks.
    $wp_customize->add_setting('jlmwines_hero_image_id', [
        'default'           => 0,
        'sanitize_callback' => 'absint',
        'transport'         => 'refresh',
    ]);
    $wp_customize->add_control(new WP_Customize_Media_Control($wp_customize, 'jlmwines_hero_image_id', [
        'section'   => 'jlmwines_hero',
        'label'     => 'Hero image',
        'description' => 'Upload at 1200px+ wide so WordPress generates a full range of responsive sizes.',
        'mime_type' => 'image',
    ]));

    // ─── Section: Popup Controls ───────────────────────────────────
    // New-visitor offer popup (website/EXIT_INTENT_POPUP_PLAN.md) —
    // content toggles + timing, no code edit/redeploy needed for these.
    // See website/POPUP_ADMIN_CONTROLS_PLAN.md.
    $wp_customize->add_section('jlmwines_popup', [
        'title'    => 'Popup Controls',
        'priority' => 36,
    ]);

    $wp_customize->add_setting('jlmwines_popup_offer_enabled', [
        'default'           => true,
        'sanitize_callback' => 'jlmwines_sanitize_checkbox',
        'transport'         => 'refresh',
    ]);
    $wp_customize->add_control('jlmwines_popup_offer_enabled', [
        'section' => 'jlmwines_popup',
        'label'   => 'Show coupon offer',
        'type'    => 'checkbox',
    ]);

    $wp_customize->add_setting('jlmwines_popup_whatsapp_enabled', [
        'default'           => true,
        'sanitize_callback' => 'jlmwines_sanitize_checkbox',
        'transport'         => 'refresh',
    ]);
    $wp_customize->add_control('jlmwines_popup_whatsapp_enabled', [
        'section' => 'jlmwines_popup',
        'label'   => 'Show WhatsApp',
        'type'    => 'checkbox',
    ]);

    $wp_customize->add_setting('jlmwines_popup_email_enabled', [
        'default'           => true,
        'sanitize_callback' => 'jlmwines_sanitize_checkbox',
        'transport'         => 'refresh',
    ]);
    $wp_customize->add_control('jlmwines_popup_email_enabled', [
        'section' => 'jlmwines_popup',
        'label'   => 'Show email signup',
        'type'    => 'checkbox',
    ]);

    $wp_customize->add_setting('jlmwines_popup_mobile_delay', [
        'default'           => 4,
        'sanitize_callback' => 'absint',
        'transport'         => 'refresh',
    ]);
    $wp_customize->add_control('jlmwines_popup_mobile_delay', [
        'section'     => 'jlmwines_popup',
        'label'       => 'Mobile delay (seconds)',
        'description' => 'How long after page load the popup appears on mobile.',
        'type'        => 'number',
        'input_attrs' => ['min' => 0, 'max' => 60],
    ]);

    $wp_customize->add_setting('jlmwines_popup_exclude_logged_in', [
        'default'           => true,
        'sanitize_callback' => 'jlmwines_sanitize_checkbox',
        'transport'         => 'refresh',
    ]);
    $wp_customize->add_control('jlmwines_popup_exclude_logged_in', [
        'section' => 'jlmwines_popup',
        'label'   => 'Hide from logged-in customers',
        'type'    => 'checkbox',
    ]);
});
