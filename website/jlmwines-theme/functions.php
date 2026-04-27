<?php
/**
 * JLM Wines theme functions.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('JLMWINES_VERSION', '1.0.0');

if (!isset($content_width)) {
    $content_width = 1140;
}

function jlmwines_setup() {
    load_theme_textdomain('jlmwines', get_template_directory() . '/languages');

    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', [
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
    ]);
    add_theme_support('custom-logo');
    add_theme_support('automatic-feed-links');
    add_theme_support('align-wide');
    add_theme_support('responsive-embeds');

    add_theme_support('woocommerce');
    add_theme_support('wc-product-gallery-zoom');
    add_theme_support('wc-product-gallery-lightbox');
    add_theme_support('wc-product-gallery-slider');

    register_nav_menus([
        'primary' => __('Primary Navigation', 'jlmwines'),
        'footer'  => __('Footer Navigation', 'jlmwines'),
        'mobile'  => __('Mobile Navigation', 'jlmwines'),
    ]);
}
add_action('after_setup_theme', 'jlmwines_setup');

require_once get_template_directory() . '/inc/enqueue.php';
