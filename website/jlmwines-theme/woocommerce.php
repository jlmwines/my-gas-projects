<?php
/**
 * WooCommerce wrapper — applies our header/footer to all Woo pages.
 * On product archives (shop, product taxonomies, product search), wraps the
 * loop in a 2-column grid with the attribute filters sidebar.
 */

get_header();

$jlmwines_filters_html = function_exists('jlmwines_get_shop_filters_html')
    ? jlmwines_get_shop_filters_html()
    : '';
?>

<main id="content" class="site-main woocommerce-wrap">
    <?php if ($jlmwines_filters_html !== '') : ?>
    <div class="woocommerce-archive-grid">
        <?php echo $jlmwines_filters_html; ?>
        <div class="woocommerce-archive-content">
            <?php woocommerce_content(); ?>
        </div>
    </div>
    <?php else : ?>
        <?php woocommerce_content(); ?>
    <?php endif; ?>
</main>

<?php
get_footer();
