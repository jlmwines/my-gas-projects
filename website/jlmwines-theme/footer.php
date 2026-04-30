<footer class="site-footer">
    <div class="container">

        <?php
        // ─── Theme-mod values ─────────────────────────────────────────
        $contact_address = get_theme_mod('jlmwines_contact_address', __('Kos Shel Bracha — Halamed Hei 16, Jerusalem', 'jlmwines'));
        $contact_phone   = get_theme_mod('jlmwines_contact_phone', '02-561-1557');
        $contact_email   = get_theme_mod('jlmwines_contact_email', 'info@jlmwines.com');
        $contact_hours   = get_theme_mod('jlmwines_contact_hours', '');
        $whatsapp_number = get_theme_mod('jlmwines_whatsapp_number', '+972555174805');

        $social_facebook  = get_theme_mod('jlmwines_social_facebook',  'https://www.facebook.com/jlmwines/');
        $social_instagram = get_theme_mod('jlmwines_social_instagram', 'https://www.instagram.com/jlmwines/');
        $social_whatsapp_url = $whatsapp_number
            ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $whatsapp_number)
            : '';
        $socials = array_filter([
            'facebook'  => $social_facebook,
            'instagram' => $social_instagram,
            'whatsapp'  => $social_whatsapp_url,
        ]);

        $payment_image_rel = get_theme_mod('jlmwines_payment_image', '/assets/images/payments/payment-methods.jpg');
        $payment_image_abs = $payment_image_rel ? get_template_directory() . $payment_image_rel : '';

        $business_id = get_theme_mod('jlmwines_business_id');
        ?>

        <?php
        // ─── Newsletter band (top) ───────────────────────────────────
        // Language-aware: filter receives current WPML lang so a child theme /
        // mu-plugin can return a per-language MC4WP form ID. Setup in MC4WP
        // admin: one form per language with a hidden Mailchimp interest-group
        // field for that language.
        $current_lang  = function_exists('icl_get_current_language') ? icl_get_current_language() : 'en';
        $mc4wp_form_id = apply_filters('jlmwines_mc4wp_form_id', '', $current_lang);
        ?>
        <?php
        // Vineyard image for the newsletter section. RTL gets the flipped
        // variant so Evyatar faces toward the page content, not the edge.
        $newsletter_image_en = 'https://staging6.jlmwines.com/wp-content/uploads/2026/02/evyatar-at-the-vineyard-1200.828.jpg';
        $newsletter_image_he = 'https://staging6.jlmwines.com/wp-content/uploads/2026/02/evyatar-at-the-vineyard-1200.828-h.jpg';
        $newsletter_image    = is_rtl() ? $newsletter_image_he : $newsletter_image_en;
        $newsletter_image    = get_theme_mod('jlmwines_newsletter_image', $newsletter_image);
        ?>
        <div class="footer-newsletter">
            <?php if ($newsletter_image) : ?>
                <div class="footer-newsletter-image">
                    <img src="<?php echo esc_url($newsletter_image); ?>" alt="" loading="lazy">
                </div>
            <?php endif; ?>
            <div class="footer-newsletter-content">
                <h2><?php _e('Learn About Wine', 'jlmwines'); ?></h2>
                <p><?php _e('Special offers by email, and fascinating information about the world of wine.', 'jlmwines'); ?></p>
            </div>
            <?php
            if (shortcode_exists('mc4wp_form')) {
                if ($mc4wp_form_id) {
                    echo do_shortcode('[mc4wp_form id="' . esc_attr($mc4wp_form_id) . '"]');
                } else {
                    echo do_shortcode('[mc4wp_form]');
                }
            } else {
                ?>
                <form class="footer-form" onsubmit="event.preventDefault()">
                    <input type="email" placeholder="<?php esc_attr_e('your@email', 'jlmwines'); ?>" aria-label="<?php esc_attr_e('Email', 'jlmwines'); ?>">
                    <button type="submit"><?php _e('Subscribe', 'jlmwines'); ?></button>
                </form>
                <?php
            }
            ?>
        </div>

        <div class="footer-band">

            <?php
            // Anchor ID flips per language so HE menus / page links can
            // target #footer-contact-he and EN menus #footer-contact —
            // a single rendered footer can't carry both IDs without
            // duplicate-anchor warnings, so we render the right one
            // for the current language.
            $jlm_contact_anchor_id = (function_exists('icl_get_current_language') && icl_get_current_language() === 'he')
                ? 'footer-contact-he'
                : 'footer-contact';
            ?>
            <section id="<?php echo esc_attr($jlm_contact_anchor_id); ?>" class="footer-contact">
                <address class="footer-contact-info">
                    <?php if ($contact_address) : ?>
                        <span class="footer-contact-line footer-contact-address"><?php echo wp_kses_post($contact_address); ?></span>
                    <?php endif; ?>
                    <?php if ($contact_phone) : ?>
                        <span class="footer-contact-line">
                            <span class="footer-contact-key"><?php esc_html_e('Tel:', 'jlmwines'); ?></span>
                            <a href="tel:<?php echo esc_attr(preg_replace('/[^+0-9]/', '', $contact_phone)); ?>"><?php echo esc_html($contact_phone); ?></a>
                        </span>
                    <?php endif; ?>
                    <?php if ($contact_email) : ?>
                        <span class="footer-contact-line">
                            <span class="footer-contact-key"><?php esc_html_e('Email:', 'jlmwines'); ?></span>
                            <a href="mailto:<?php echo esc_attr($contact_email); ?>"><?php echo esc_html($contact_email); ?></a>
                        </span>
                    <?php endif; ?>
                    <?php if ($contact_hours) : ?>
                        <span class="footer-contact-line">
                            <span class="footer-contact-key"><?php esc_html_e('Hours:', 'jlmwines'); ?></span>
                            <span><?php echo wp_kses_post($contact_hours); ?></span>
                        </span>
                    <?php endif; ?>
                </address>
            </section>

            <div class="footer-mid">
                <?php if (file_exists($payment_image_abs)) : ?>
                    <img class="footer-payments-image"
                         src="<?php echo esc_url(get_template_directory_uri() . $payment_image_rel); ?>"
                         alt="<?php esc_attr_e('Accepted payment methods', 'jlmwines'); ?>"
                         loading="lazy">
                <?php endif; ?>
                <?php if (!empty($socials)) : ?>
                    <ul class="footer-social-list" aria-label="<?php esc_attr_e('Social links', 'jlmwines'); ?>">
                        <?php foreach ($socials as $key => $url) : ?>
                            <li class="footer-social-<?php echo esc_attr($key); ?>">
                                <a href="<?php echo esc_url($url); ?>" target="_blank" rel="noopener" aria-label="<?php echo esc_attr(ucfirst($key)); ?>">
                                    <svg width="16" height="16" aria-hidden="true"><use href="#i-<?php echo esc_attr($key); ?>"/></svg>
                                </a>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>

                <?php
                // Language switcher relocated from the legal column to
                // sit beneath the social icons so the legal column can
                // host the cookie-consent control instead.
                if (function_exists('icl_get_languages')) :
                    $languages = icl_get_languages('skip_missing=0&orderby=code');
                    if (!empty($languages)) :
                        ?>
                        <div class="footer-lang">
                            <?php $i = 0; foreach ($languages as $lang) :
                                if ($i++ > 0) echo ' <span class="footer-lang-sep" aria-hidden="true">·</span> ';
                                $class = $lang['active'] ? 'active' : '';
                                ?>
                                <a class="<?php echo esc_attr($class); ?>" href="<?php echo esc_url($lang['url']); ?>">
                                    <?php echo esc_html($lang['native_name']); ?>
                                </a>
                            <?php endforeach; ?>
                        </div>
                        <?php
                    endif;
                endif;
                ?>
            </div>

            <div class="footer-legal">
                <ul class="footer-legal-links">
                    <li><a href="<?php echo esc_url(home_url('/terms/')); ?>"><?php _e('Terms &amp; Conditions', 'jlmwines'); ?></a></li>
                    <li><a href="<?php echo esc_url(home_url('/privacy-policy/')); ?>"><?php _e('Privacy', 'jlmwines'); ?></a></li>
                    <?php
                    // Cookie consent control. Uses Complianz's documented
                    // pattern: a link with class `cmplz-show-banner` that
                    // a small footer-injected JS snippet (see
                    // jlmwines_cmplz_show_banner_on_click in
                    // inc/enqueue.php) delegates to Complianz's hidden
                    // internal `.cmplz-manage-consent` button. Works
                    // whether or not Complianz's floating tab is visible.
                    $consent_label_he = 'הגדרות עוגיות';
                    $consent_label_en = 'Cookie Settings';
                    $is_he_footer     = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';
                    $consent_label    = $is_he_footer ? $consent_label_he : $consent_label_en;
                    ?>
                    <li class="footer-consent-item">
                        <a class="cmplz-show-banner footer-consent-link"><?php echo esc_html($consent_label); ?></a>
                    </li>
                </ul>
            </div>

        </div>

        <p class="footer-copyright">
            <?php echo esc_html(date('Y')); ?> &copy; <?php bloginfo('name'); ?>
            <?php if ($business_id) : ?>
                · <?php echo esc_html($business_id); ?>
            <?php endif; ?>
        </p>

    </div>
</footer>

<?php
if (function_exists('jlmwines_render_bottom_nav')) {
    jlmwines_render_bottom_nav();
}
wp_footer();
?>
</body>
</html>
