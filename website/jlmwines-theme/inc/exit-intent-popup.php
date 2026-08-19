<?php
/**
 * New-visitor offer popup.
 *
 * Dismissible modal for non-purchasing visitors: primary CTA is the
 * live `50NEW` first-order coupon (₪50 off + free delivery threshold
 * already covered by the site-wide free-shipping method at the same
 * ₪399 mark), with WhatsApp contact and email signup as secondary,
 * smaller links. Two trigger paths (desktop exit-intent, mobile
 * delayed-load) both fire this same markup — see main.js.
 *
 * Server-side guards (logged-in, cart/checkout/thank-you) run here so
 * those cases never ship the markup at all. The 7-day dismiss cookie
 * is checked JS-only, matching age-gate.php's reasoning: the page is
 * cached, so cache-safe show/hide has to happen client-side.
 *
 * Plan: website/EXIT_INTENT_POPUP_PLAN.md
 */

if (!defined('ABSPATH')) {
    exit;
}

function jlmwines_render_offer_popup() {
    if (is_user_logged_in()) {
        return;
    }
    if (function_exists('is_cart') && is_cart()) {
        return;
    }
    if (function_exists('is_checkout') && is_checkout()) {
        return;
    }
    if (function_exists('is_order_received_page') && is_order_received_page()) {
        return;
    }

    $is_he = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';

    $whatsapp_number   = get_theme_mod('jlmwines_whatsapp_number', '+972555174805');
    $whatsapp_clean    = $whatsapp_number ? preg_replace('/[^0-9]/', '', $whatsapp_number) : '';
    $whatsapp_greeting = $is_he ? 'היי אביתר,' : 'Hi Evyatar,';
    $whatsapp_url      = $whatsapp_clean
        ? 'https://wa.me/' . $whatsapp_clean . '?text=' . rawurlencode($whatsapp_greeting)
        : '';

    $mc_lang_interest = $is_he ? '8' : '4';

    // WhatsApp-appropriate portrait (2026-08-20 — replaces the vineyard
    // shot the footer newsletter band uses; that one didn't read well at
    // the popup's small avatar size). Same image both languages.
    $evyatar_photo = 'https://jlmwines.com/wp-content/uploads/2024/08/evyatar-cohen-04.jpg';

    $coupon_code = '50NEW';

    $headline      = $is_he ? 'הזמנה ראשונה? חסכו ₪50' : 'First order? Save ₪50';
    $detail        = $is_he
        ? 'קבלו משלוח חינם ו-50 ₪ הנחה על הזמנה ראשונה של 399 ₪ ומעלה. קוד: 50NEW'
        : 'Get free delivery and ₪50 off your first order of ₪399 or more. Code: 50NEW';
    $copy_label    = $is_he ? 'העתיקו קוד' : 'Copy Code';
    $copied_label  = $is_he ? 'הועתק!' : 'Copied!';
    $help_line     = $is_he ? 'צריכים עזרה? שאלו אותי!' : 'Need help? Ask me!';
    $learn_line    = $is_he ? 'לומדים על יין' : 'Learn About Wine';
    $close_label   = $is_he ? 'סגירה' : 'Close';
    ?>
    <div class="offer-popup" id="offer-popup" hidden>
        <div class="offer-popup-overlay" data-offer-popup-overlay></div>
        <div class="offer-popup-modal" role="dialog" aria-modal="true" aria-labelledby="offer-popup-title">
            <button type="button" class="offer-popup-close" data-offer-popup-close aria-label="<?php echo esc_attr($close_label); ?>">
                <svg width="20" height="20" aria-hidden="true"><use href="#i-close"/></svg>
            </button>

            <div class="offer-popup-offer">
                <h2 class="offer-popup-headline" id="offer-popup-title"><?php echo esc_html($headline); ?></h2>
                <p class="offer-popup-detail"><?php echo esc_html($detail); ?></p>
                <button type="button" class="offer-popup-shop-btn" data-offer-popup-copy-code="<?php echo esc_attr($coupon_code); ?>" data-copy-label="<?php echo esc_attr($copy_label); ?>" data-copied-label="<?php echo esc_attr($copied_label); ?>"><?php echo esc_html($copy_label); ?></button>
            </div>

            <div class="offer-popup-secondary">
                <?php if ($whatsapp_url) : ?>
                <a class="offer-popup-whatsapp" href="<?php echo esc_url($whatsapp_url); ?>" target="_blank" rel="noopener">
                    <img class="offer-popup-evyatar-photo" src="<?php echo esc_url($evyatar_photo); ?>" alt="" loading="lazy">
                    <span class="offer-popup-whatsapp-label">
                        <svg width="18" height="18" aria-hidden="true"><use href="#i-whatsapp"/></svg>
                        <?php echo esc_html($help_line); ?>
                    </span>
                </a>
                <?php endif; ?>

                <div class="offer-popup-email">
                    <h3><?php echo esc_html($learn_line); ?></h3>
                    <form class="footer-form offer-popup-form"
                          data-mc-form
                          action="https://jlmwines.us5.list-manage.com/subscribe/post?u=439baf502ee03aaf62e476724&amp;id=8a3c6dd69c"
                          method="post"
                          target="_blank"
                          novalidate>
                        <input type="email" name="EMAIL" required
                               placeholder="your@email"
                               aria-label="<?php esc_attr_e('Email', 'woocommerce'); ?>">
                        <input type="hidden" name="group[383942]" value="<?php echo esc_attr($mc_lang_interest); ?>">
                        <div aria-hidden="true" style="position:absolute;left:-5000px" tabindex="-1">
                            <input type="text" name="b_439baf502ee03aaf62e476724_8a3c6dd69c" tabindex="-1" value="">
                        </div>
                        <button type="submit"><?php _e('Subscribe', 'woocommerce'); ?></button>
                    </form>
                    <div class="footer-form-msg offer-popup-form-msg" data-mc-msg role="status" aria-live="polite" hidden></div>
                </div>
            </div>
        </div>
    </div>
    <?php
}
add_action('wp_footer', 'jlmwines_render_offer_popup', 6);
