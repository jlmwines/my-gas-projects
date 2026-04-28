<footer class="site-footer">
    <div class="container">

        <div class="footer-newsletter">
            <div>
                <h2><?php _e('Stay close to the cellar.', 'jlmwines'); ?></h2>
                <p><?php _e('One short note when something special arrives. No daily blasts. No "act now."', 'jlmwines'); ?></p>
            </div>
            <?php
            // Mailchimp for WooCommerce / MC4WP form. Falls back to a placeholder form if no shortcode.
            if (shortcode_exists('mc4wp_form')) {
                echo do_shortcode('[mc4wp_form id=""]');
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

        <div class="footer-cols">
            <div class="footer-col">
                <h4><?php _e('Shop', 'jlmwines'); ?></h4>
                <ul>
                    <li><a href="<?php echo esc_url(home_url('/shop/')); ?>"><?php _e('All wines', 'jlmwines'); ?></a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4><?php _e('About', 'jlmwines'); ?></h4>
                <ul>
                    <li><a href="<?php echo esc_url(home_url('/about/')); ?>"><?php _e('Meet Evyatar', 'jlmwines'); ?></a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4><?php _e('Help', 'jlmwines'); ?></h4>
                <ul>
                    <li><a href="<?php echo esc_url(home_url('/contact/')); ?>"><?php _e('Contact', 'jlmwines'); ?></a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4><?php _e('Legal', 'jlmwines'); ?></h4>
                <ul>
                    <li><a href="<?php echo esc_url(home_url('/privacy-policy/')); ?>"><?php _e('Privacy', 'jlmwines'); ?></a></li>
                    <li><a href="<?php echo esc_url(home_url('/terms/')); ?>"><?php _e('Terms', 'jlmwines'); ?></a></li>
                </ul>
            </div>
        </div>

        <div class="footer-base">
            <div>
                &copy; <?php echo esc_html(date('Y')); ?> <?php bloginfo('name'); ?>
                <?php
                $business_id = get_theme_mod('jlmwines_business_id');
                if ($business_id) {
                    echo ' · ' . esc_html($business_id);
                }
                ?>
            </div>
            <?php
            if (function_exists('icl_get_languages')) :
                $languages = icl_get_languages('skip_missing=0&orderby=code');
                if (!empty($languages)) :
                    ?>
                    <div class="footer-lang">
                    <?php foreach ($languages as $lang) :
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
