<?php
/**
 * Mobile bottom navigation bar.
 *
 * Fixed to the viewport bottom on screens under 720px. Four icons:
 * shop, account, search (opens nav drawer + focuses the drawer's
 * search input via JS), WhatsApp click-to-chat. Hidden on tablet/desktop.
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_render_bottom_nav() {
    if (!class_exists('WooCommerce')) {
        return;
    }

    $shop_url    = wc_get_page_permalink('shop');
    $account_url = wc_get_page_permalink('myaccount');

    $is_shop_active    = (function_exists('is_shop') && is_shop()) || is_post_type_archive('product') || is_tax('product_cat');
    $is_account_active = function_exists('is_account_page') && is_account_page();
    ?>
    <nav class="bottom-nav" aria-label="<?php esc_attr_e('Quick access', 'jlmwines'); ?>">
        <a class="bottom-nav-item<?php echo $is_shop_active ? ' is-active' : ''; ?>" href="<?php echo esc_url($shop_url); ?>">
            <svg width="22" height="22" aria-hidden="true"><use href="#i-shop"/></svg>
            <span><?php esc_html_e('Shop', 'jlmwines'); ?></span>
        </a>
        <a class="bottom-nav-item<?php echo $is_account_active ? ' is-active' : ''; ?>" href="<?php echo esc_url($account_url); ?>">
            <svg width="22" height="22" aria-hidden="true"><use href="#i-account"/></svg>
            <span><?php esc_html_e('Account', 'jlmwines'); ?></span>
        </a>
        <button type="button" class="bottom-nav-item" data-bottom-nav-search>
            <svg width="22" height="22" aria-hidden="true"><use href="#i-search"/></svg>
            <span><?php esc_html_e('Search', 'jlmwines'); ?></span>
        </button>
        <button type="button" class="bottom-nav-item" data-bottom-nav-top aria-label="<?php esc_attr_e('Back to top', 'jlmwines'); ?>">
            <svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-up"/></svg>
            <span><?php esc_html_e('Top', 'jlmwines'); ?></span>
        </button>
    </nav>
    <?php
}
