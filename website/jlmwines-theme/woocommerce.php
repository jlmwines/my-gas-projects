<?php
/**
 * WooCommerce wrapper — applies our header/footer to all Woo pages.
 * On product archives we render the filter panel (always-visible button,
 * conditionally expanded groups), then a custom catalog-header that
 * pairs the page title with the sort dropdown in a flex row, then the
 * normal WC content. On non-archives (PDPs, cart, account, etc.) only
 * woocommerce_content() runs.
 */

get_header();

$is_archive = (function_exists('is_shop') && is_shop())
    || (function_exists('is_product_taxonomy') && is_product_taxonomy())
    || (function_exists('is_search') && is_search() && get_query_var('post_type') === 'product');
?>

<main id="content" class="site-main woocommerce-wrap">
    <?php if ($is_archive) : ?>
        <?php
        if (function_exists('jlmwines_get_shop_filters_html')) {
            echo jlmwines_get_shop_filters_html();
        }
        ?>
        <div class="catalog-header">
            <h1 class="page-title"><?php woocommerce_page_title(); ?></h1>
            <?php woocommerce_catalog_ordering(); ?>
        </div>
    <?php endif; ?>
    <?php woocommerce_content(); ?>
</main>

<?php
get_footer();
