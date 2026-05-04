<?php
/**
 * WooCommerce wrapper — applies our header/footer to all Woo pages.
 * On product archives (shop, product taxonomies, product search), wraps the
 * loop in a 2-column grid with the attribute filters sidebar.
 */

get_header();

$jlmwines_is_archive = function_exists('jlmwines_is_filterable_archive') && jlmwines_is_filterable_archive();
?>

<main id="content" class="site-main woocommerce-wrap">
    <?php if ($jlmwines_is_archive) : ?>
    <div class="woocommerce-archive-grid">
        <?php jlmwines_render_shop_filters(); ?>
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
