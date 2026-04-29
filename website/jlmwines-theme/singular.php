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
            <?php
            // Blog posts with a featured image render a full-width hero
            // with the title overlaid on the image. Pages and posts
            // without a featured image fall back to a plain title header.
            $use_post_hero = is_singular('post') && has_post_thumbnail();
            ?>

            <?php if ($use_post_hero) : ?>
                <header class="post-hero">
                    <figure class="post-hero-figure">
                        <?php the_post_thumbnail('large', ['class' => 'post-hero-image']); ?>
                    </figure>
                    <div class="post-hero-content container">
                        <h1 class="post-hero-title"><?php the_title(); ?></h1>
                    </div>
                </header>
            <?php else : ?>
                <header class="entry-header">
                    <?php the_title('<h1 class="entry-title">', '</h1>'); ?>
                </header>
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
