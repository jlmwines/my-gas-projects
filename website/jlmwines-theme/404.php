<?php
/**
 * 404 — page not found.
 */

get_header();
?>

<main id="content" class="site-main">
    <section class="error-404">
        <header class="entry-header">
            <h1 class="entry-title"><?php _e('Page not found', 'woocommerce'); ?></h1>
        </header>
        <div class="entry-content">
            <p><?php echo is_rtl() ? 'לא הצלחנו למצוא את מה שחיפשתם. ייתכן שהדף עבר למקום אחר, או שהקישור שגוי.' : "We couldn't find what you were looking for. It may have moved, or the link may be wrong."; ?></p>
            <p>
                <a class="button" href="<?php echo esc_url(home_url('/')); ?>">
                    <?php _e('Back to Home', 'woocommerce'); ?>
                </a>
            </p>
            <?php get_search_form(); ?>
        </div>
    </section>
</main>

<?php
get_footer();
