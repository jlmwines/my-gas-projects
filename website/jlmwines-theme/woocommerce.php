<?php
/**
 * WooCommerce wrapper — applies our header/footer to all Woo pages.
 */

get_header();
?>

<main id="content" class="site-main woocommerce-wrap">
    <?php woocommerce_content(); ?>
</main>

<?php
get_footer();
