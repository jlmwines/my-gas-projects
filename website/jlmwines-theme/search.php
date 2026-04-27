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
            printf(
                /* translators: %s: search query. */
                esc_html__('Search results for: %s', 'jlmwines'),
                '<span>' . get_search_query() . '</span>'
            );
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
            'prev_text' => __('Previous', 'jlmwines'),
            'next_text' => __('Next', 'jlmwines'),
        ]);
        ?>

    <?php else : ?>
        <p><?php _e('No results found. Try a different search.', 'jlmwines'); ?></p>
        <?php get_search_form(); ?>
    <?php endif; ?>
</main>

<?php
get_footer();
