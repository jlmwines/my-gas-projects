<?php
/**
 * Search results template.
 */

get_header();
?>

<main id="content" class="site-main">
    <header class="archive-header">
        <h1 class="archive-title">
            <?php
            // Inline HE for chrome text per the theme's translation rule
            // ("only translate at runtime what cannot be stored in advance;
            //  static page content goes in real Pages (per-language) or
            //  inline is_rtl() PHP for chrome"). WPML's gettext path failed
            //  to match the runtime form for this string; baking the HE in
            //  here makes it deterministic.
            if (is_rtl()) {
                printf(
                    'תוצאות חיפוש עבור: %s',
                    '<span>' . esc_html(get_search_query()) . '</span>'
                );
            } else {
                printf(
                    /* translators: %s: search query. */
                    esc_html__('Search results for: %s', 'woocommerce'),
                    '<span>' . esc_html(get_search_query()) . '</span>'
                );
            }
            ?>
        </h1>
    </header>

    <?php if (have_posts()) : ?>
        <div class="post-list">
            <?php
            while (have_posts()) :
                the_post();
                ?>
                <article id="post-<?php the_ID(); ?>" <?php post_class('post-summary'); ?>>
                    <header class="entry-header">
                        <?php the_title('<h2 class="entry-title"><a href="' . esc_url(get_permalink()) . '">', '</a></h2>'); ?>
                    </header>
                    <div class="entry-summary">
                        <?php the_excerpt(); ?>
                    </div>
                </article>
                <?php
            endwhile;
            ?>
        </div>

        <?php
        the_posts_pagination([
            'prev_text' => __('Previous', 'woocommerce'),
            'next_text' => __('Next', 'woocommerce'),
        ]);
        ?>

    <?php else : ?>
        <p><?php echo is_rtl() ? 'לא נמצאו תוצאות. נסו חיפוש אחר.' : 'No results found. Try a different search.'; ?></p>
        <?php get_search_form(); ?>
    <?php endif; ?>
</main>

<?php
get_footer();
