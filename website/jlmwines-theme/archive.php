<?php
/**
 * Archive template — categories, tags, date, author.
 */

get_header();
?>

<main id="content" class="site-main">
    <?php if (have_posts()) : ?>
        <header class="archive-header">
            <h1 class="archive-title"><?php the_archive_title(); ?></h1>
            <?php
            $description = get_the_archive_description();
            if ($description) :
                ?>
                <div class="archive-description"><?php echo wp_kses_post($description); ?></div>
            <?php endif; ?>
        </header>

        <div class="post-list">
            <?php
            while (have_posts()) :
                the_post();
                ?>
                <article id="post-<?php the_ID(); ?>" <?php post_class('post-summary'); ?>>
                    <?php if (has_post_thumbnail()) : ?>
                        <a class="post-summary-thumb" href="<?php the_permalink(); ?>">
                            <?php the_post_thumbnail('medium_large'); ?>
                        </a>
                    <?php endif; ?>
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
        <p><?php _e('Nothing to show here yet.', 'jlmwines'); ?></p>
    <?php endif; ?>
</main>

<?php
get_footer();
