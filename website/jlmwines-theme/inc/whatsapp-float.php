<?php
/**
 * Floating WhatsApp click-to-chat button.
 *
 * Pinned to the bottom inline-end corner — bottom-right in LTR (EN),
 * bottom-left in RTL (HE) — on product, shop, product category, and
 * product tag pages. Hidden on content pages, posts, cart, checkout,
 * account so it doesn't interrupt transaction flow or compete with
 * reading. On mobile (<720px) the button stacks above the bottom-nav.
 *
 * Companion: pojo-accessibility plugin's floating "ally" icon should
 * sit on the opposite corner (configured via plugin settings or CSS
 * override — out of scope for this file).
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_render_whatsapp_float() {
    if (!function_exists('is_product')) {
        return;
    }
    if (!(is_product() || is_shop() || is_product_category() || is_product_tag())) {
        return;
    }

    $whatsapp_number = get_theme_mod('jlmwines_whatsapp_number', '+972555174805');
    if (!$whatsapp_number) {
        return;
    }
    $clean = preg_replace('/[^0-9]/', '', $whatsapp_number);
    if (!$clean) {
        return;
    }

    $is_he = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';
    $aria  = $is_he ? 'שלחו לנו הודעה בוואטסאפ' : 'Message us on WhatsApp';
    ?>
    <a class="whatsapp-float"
       href="https://wa.me/<?php echo esc_attr($clean); ?>"
       target="_blank"
       rel="noopener"
       aria-label="<?php echo esc_attr($aria); ?>">
        <svg width="28" height="28" aria-hidden="true"><use href="#i-whatsapp"/></svg>
    </a>
    <?php
}
add_action('wp_footer', 'jlmwines_render_whatsapp_float');
