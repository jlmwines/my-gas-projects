<?php
/**
 * Mobile bottom navigation bar.
 *
 * Fixed to the viewport bottom on screens under 720px. Four-slot grid:
 * inline-start and inline-end slots are empty placeholders that align
 * with the floating ea11y and WhatsApp icons, so those floats visually
 * land inside the nav row without duplicating an in-nav button. The
 * two middle slots are search (opens nav drawer + focuses search) and
 * a language toggle. Floats stay floating (so they remain visible at
 * any scroll position); empty slots just preserve the alignment.
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_render_bottom_nav() {
    if (!class_exists('WooCommerce')) {
        return;
    }
    ?>
    <nav class="bottom-nav" aria-label="<?php echo esc_attr( is_rtl() ? 'גישה מהירה' : 'Quick access' ); ?>">
        <span class="bottom-nav-spacer" aria-hidden="true"></span>
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
        <span class="bottom-nav-spacer" aria-hidden="true"></span>
    </nav>
    <?php
}
