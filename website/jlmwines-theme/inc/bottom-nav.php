<?php
/**
 * Mobile bottom navigation bar.
 *
 * Fixed to the viewport bottom on screens under 720px. Four icons:
 * shop, account, search (opens nav drawer + focuses the drawer's
 * search input via JS), and a language toggle (single tap switches
 * to the other site language — labelled in the OPPOSITE language's
 * native script: "עברית" on the EN side, "English" on the HE side).
 * Hidden on tablet/desktop. WhatsApp lives on a floating-corner
 * button on product/catalog pages (see inc/whatsapp-float.php).
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
    <nav class="bottom-nav" aria-label="<?php echo esc_attr( is_rtl() ? 'גישה מהירה' : 'Quick access' ); ?>">
        <a class="bottom-nav-item<?php echo $is_shop_active ? ' is-active' : ''; ?>" href="<?php echo esc_url($shop_url); ?>">
            <svg width="22" height="22" aria-hidden="true"><use href="#i-shop"/></svg>
            <span><?php echo esc_html( is_rtl() ? 'חנות' : 'Shop' ); ?></span>
        </a>
        <a class="bottom-nav-item<?php echo $is_account_active ? ' is-active' : ''; ?>" href="<?php echo esc_url($account_url); ?>">
            <svg width="22" height="22" aria-hidden="true"><use href="#i-account"/></svg>
            <span><?php echo esc_html( is_rtl() ? 'החשבון שלי' : 'Account' ); ?></span>
        </a>
        <button type="button" class="bottom-nav-item" data-bottom-nav-search>
            <svg width="22" height="22" aria-hidden="true"><use href="#i-search"/></svg>
            <span><?php echo esc_html( is_rtl() ? 'חיפוש' : 'Search' ); ?></span>
        </button>
        <?php
        // Language toggle: tap → switch to the OTHER site language. Label
        // is the other language's name in its own native script (so an
        // EN visitor sees "עברית", a HE visitor sees "English").
        if (function_exists('icl_get_languages')) :
            $other_lang_url   = '';
            $other_lang_label = '';
            foreach ((array) icl_get_languages('skip_missing=0&orderby=code') as $_lang) {
                if (empty($_lang['active'])) {
                    $other_lang_url   = $_lang['url'];
                    $other_lang_label = $_lang['native_name']; // "English" or "עברית"
                    break;
                }
            }
            if ($other_lang_url) :
                ?>
                <a class="bottom-nav-item" href="<?php echo esc_url($other_lang_url); ?>" aria-label="<?php echo esc_attr($other_lang_label); ?>">
                    <svg width="22" height="22" aria-hidden="true"><use href="#i-globe"/></svg>
                    <span><?php echo esc_html($other_lang_label); ?></span>
                </a>
                <?php
            endif;
        endif;
        ?>
    </nav>
    <?php
}
