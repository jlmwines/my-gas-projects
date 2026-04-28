<?php
/**
 * Reusable content sections — testimonials, blog roll, hero scaffolding.
 *
 * Helpers consumed by front-page.php and any other template that wants to
 * compose homepage-style blocks.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Default testimonials list — placeholder copy. Override via the
 * `jlmwines_testimonials` filter to inject real customer quotes (e.g. from
 * a child theme, mu-plugin, or a future custom post type).
 */
function jlmwines_get_testimonials() {
    $default = [
        [
            'quote'  => __("Evyatar's recommendations are always spot-on. I've stopped guessing which wine to buy.", 'jlmwines'),
            'name'   => 'Sarah M.',
            'source' => 'Jerusalem',
        ],
        [
            'quote'  => __("Best curated wine selection I've found in Israel. Free delivery sealed the deal.", 'jlmwines'),
            'name'   => 'David L.',
            'source' => 'Tel Aviv',
        ],
        [
            'quote'  => __("The Pesach package was perfect. Found wines I would never have picked myself.", 'jlmwines'),
            'name'   => 'Rachel B.',
            'source' => 'Jerusalem',
        ],
    ];
    return apply_filters('jlmwines_testimonials', $default);
}

function jlmwines_render_testimonials($args = []) {
    $args = wp_parse_args($args, [
        'heading' => __('What customers say', 'jlmwines'),
        'eyebrow' => '',
        'columns' => 3,
    ]);

    $testimonials = jlmwines_get_testimonials();
    if (empty($testimonials)) {
        return;
    }
    ?>
    <section class="section section-testimonials">
        <?php if ($args['heading'] || $args['eyebrow']) : ?>
            <header class="section-header">
                <?php if ($args['eyebrow']) : ?>
                    <p class="section-eyebrow"><?php echo esc_html($args['eyebrow']); ?></p>
                <?php endif; ?>
                <?php if ($args['heading']) : ?>
                    <h2 class="section-heading"><?php echo esc_html($args['heading']); ?></h2>
                <?php endif; ?>
            </header>
        <?php endif; ?>

        <div class="testimonials-grid columns-<?php echo (int) $args['columns']; ?>">
            <?php foreach ($testimonials as $t) :
                if (empty($t['quote'])) continue;
                ?>
                <figure class="testimonial">
                    <div class="testimonial-rating" aria-label="<?php esc_attr_e('5 out of 5 stars', 'jlmwines'); ?>">
                        <?php for ($i = 0; $i < 5; $i++) : ?>
                            <svg width="14" height="14" aria-hidden="true"><use href="#i-star"/></svg>
                        <?php endfor; ?>
                    </div>
                    <blockquote class="testimonial-quote"><?php echo esc_html($t['quote']); ?></blockquote>
                    <figcaption class="testimonial-attribution">
                        <span class="testimonial-name"><?php echo esc_html($t['name'] ?? ''); ?></span>
                        <?php if (!empty($t['source'])) : ?>
                            <span class="testimonial-source"><?php echo esc_html($t['source']); ?></span>
                        <?php endif; ?>
                    </figcaption>
                </figure>
            <?php endforeach; ?>
        </div>
    </section>
    <?php
}

/**
 * Recent blog posts roll.
 */
function jlmwines_render_blog_roll($args = []) {
    $args = wp_parse_args($args, [
        'limit'    => 3,
        'columns'  => 3,
        'heading'  => __('Wine talk', 'jlmwines'),
        'eyebrow'  => '',
        'cta_url'  => get_permalink(get_option('page_for_posts')) ?: home_url('/blog/'),
        'cta_text' => __('All posts', 'jlmwines'),
        'category' => '',
    ]);

    $query_args = [
        'post_type'      => 'post',
        'posts_per_page' => (int) $args['limit'],
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
    ];
    if (!empty($args['category'])) {
        $query_args['category_name'] = $args['category'];
    }

    $query = new WP_Query($query_args);
    if (!$query->have_posts()) {
        return;
    }
    ?>
    <section class="section section-blog">
        <?php if ($args['heading'] || $args['eyebrow']) : ?>
            <header class="section-header">
                <?php if ($args['eyebrow']) : ?>
                    <p class="section-eyebrow"><?php echo esc_html($args['eyebrow']); ?></p>
                <?php endif; ?>
                <?php if ($args['heading']) : ?>
                    <h2 class="section-heading"><?php echo esc_html($args['heading']); ?></h2>
                <?php endif; ?>
            </header>
        <?php endif; ?>

        <div class="blog-grid columns-<?php echo (int) $args['columns']; ?>">
            <?php while ($query->have_posts()) : $query->the_post(); ?>
                <article class="blog-card">
                    <a class="blog-card-link" href="<?php echo esc_url(get_permalink()); ?>">
                        <?php if (has_post_thumbnail()) : ?>
                            <div class="blog-card-image"><?php the_post_thumbnail('medium_large'); ?></div>
                        <?php endif; ?>
                        <div class="blog-card-body">
                            <h3 class="blog-card-title"><?php the_title(); ?></h3>
                            <?php $excerpt = get_the_excerpt(); if ($excerpt) : ?>
                                <p class="blog-card-excerpt"><?php echo esc_html(wp_trim_words($excerpt, 18, '…')); ?></p>
                            <?php endif; ?>
                            <span class="blog-card-readmore"><?php esc_html_e('Read more', 'jlmwines'); ?></span>
                        </div>
                    </a>
                </article>
            <?php endwhile; ?>
        </div>

        <?php if ($args['cta_url']) : ?>
            <div class="section-cta">
                <a class="button button-secondary" href="<?php echo esc_url($args['cta_url']); ?>">
                    <?php echo esc_html($args['cta_text']); ?>
                </a>
            </div>
        <?php endif; ?>
    </section>
    <?php
    wp_reset_postdata();
}
