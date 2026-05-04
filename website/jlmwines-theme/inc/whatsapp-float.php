<?php
/**
 * Floating WhatsApp click-to-chat button.
 *
 * Pinned to the bottom inline-end corner — bottom-right in LTR (EN),
 * bottom-left in RTL (HE) — on every page. Always present on mobile
 * so the bottom-nav row (which reserves an empty slot on this side)
 * stays visually balanced; on desktop it's a persistent help affordance
 * paired with the ea11y widget on the inline-start corner.
 *
 * Companion: pojo-accessibility (ea11y) widget sits at the same height
 * on the opposite (inline-start) corner — see main.css. Plugin should
 * have "Exact position" disabled and corner set to bottom-left so the
 * theme's CSS can position both icons consistently per language.
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_render_whatsapp_float() {
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
        <svg width="24" height="24" aria-hidden="true"><use href="#i-whatsapp"/></svg>
    </a>
    <?php
}
add_action('wp_footer', 'jlmwines_render_whatsapp_float');
