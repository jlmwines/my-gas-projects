<?php
/**
 * Single post + page template (shared wrapper).
 */

get_header();
?>

<main id="content" class="site-main">
    <?php
    while (have_posts()) :
        the_post();
        ?>
        <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
            <header class="entry-header">
                <?php the_title('<h1 class="entry-title">', '</h1>'); ?>
            </header>

            <?php if (has_post_thumbnail() && !is_page()) : ?>
                <figure class="entry-thumbnail">
                    <?php the_post_thumbnail('large'); ?>
                </figure>
            <?php endif; ?>

            <div class="entry-content">
                <?php the_content(); ?>
                <?php
                wp_link_pages([
                    'before' => '<nav class="page-links">',
                    'after'  => '</nav>',
                ]);
                ?>
            </div>
        </article>

        <?php
        if (comments_open() || get_comments_number()) :
            comments_template();
        endif;
        ?>
        <?php
    endwhile;
    ?>
</main>

<?php
get_footer();
