<?php
/**
 * Customizer registration — site-editor controls for editorially-managed
 * imagery. Stores attachment IDs (not URLs) so wp_get_attachment_image()
 * can render a proper srcset from WP's pre-built image sizes.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('customize_register', function ($wp_customize) {

    // ─── Section: Homepage Hero ────────────────────────────────────
    $wp_customize->add_section('jlmwines_hero', [
        'title'    => __('Homepage Hero', 'jlmwines'),
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
        'label'     => __('Hero image', 'jlmwines'),
        'description' => __('Upload at 1200px+ wide so WordPress generates a full range of responsive sizes.', 'jlmwines'),
        'mime_type' => 'image',
    ]));
});
