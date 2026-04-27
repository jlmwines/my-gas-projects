<?php
/**
 * Asset enqueue.
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_enqueue_assets() {
    $main_css_path = get_template_directory() . '/assets/css/main.css';
    $main_css_ver  = file_exists($main_css_path) ? filemtime($main_css_path) : JLMWINES_VERSION;

    wp_enqueue_style(
        'jlmwines-fonts',
        'https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;700&family=Rubik:wght@400;500;600;700&display=swap',
        [],
        null
    );

    wp_enqueue_style(
        'jlmwines-main',
        get_template_directory_uri() . '/assets/css/main.css',
        ['jlmwines-fonts'],
        $main_css_ver
    );

    $main_js_path = get_template_directory() . '/assets/js/main.js';
    $main_js_ver  = file_exists($main_js_path) ? filemtime($main_js_path) : JLMWINES_VERSION;

    wp_enqueue_script(
        'jlmwines-main',
        get_template_directory_uri() . '/assets/js/main.js',
        [],
        $main_js_ver,
        true
    );

    // RTL handling lives in main.css via [dir="rtl"] selectors; WPML sets <html dir="rtl"> automatically.
}
add_action('wp_enqueue_scripts', 'jlmwines_enqueue_assets');
