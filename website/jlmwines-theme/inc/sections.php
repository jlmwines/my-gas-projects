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
    // Real Google 5-star reviews. Bilingual inline per session rule
    // (HE coverage at write time). Each entry has a short title (the
    // reviewer's chosen headline on Google) plus quote, name, source.
    $is_he = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';

    $default = [
        [
            'title'  => $is_he ? 'שירות מדהים' : 'Amazing Service',
            'quote'  => $is_he
                ? 'המקום לגלות יינות ישראלים איכותיים עם עצות טובות ושירות מדהים.'
                : 'The place to discover quality Israeli wines with good advice and amazing service.',
            'name'   => $is_he ? 'ארי כהן' : 'Ari Cohen',
        ],
        [
            'title'  => $is_he ? 'מחירים סבירים' : 'Reasonably Priced',
            'quote'  => $is_he
                ? 'זו רק אחת מאותן פנינים נדירות... מבחר ממש טוב של יינות, במחיר סביר.'
                : "It's just one of those rare gems... a really good selection of wines, reasonably priced.",
            'name'   => $is_he ? 'אבישג כהן' : 'Avishag Cohen',
        ],
        [
            'title'  => $is_he ? 'פשוט הכי טוב' : 'Simply the Best',
            'quote'  => $is_he
                ? 'פשוט חנות היין הטובה ביותר. הבעלים הוא מומחה גדול ונלהב.'
                : 'Simply the best wine shop. The owner is a great expert and enthusiast.',
            'name'   => $is_he ? 'בריאן קואן' : 'Brian Cowan',
        ],
        [
            'title'  => $is_he ? 'עצה מצוינת' : 'Excellent Advice',
            'quote'  => $is_he
                ? 'אפשר לסמוך על אביתר שייתן עצות מצוינות לכל כיס. והם שולחים!'
                : 'Evyatar can be counted on to give excellent advice for every pocket. And they deliver!',
            'name'   => $is_he ? 'דיוויד גרטלר' : 'David Gurtler',
        ],
        [
            'title'  => $is_he ? 'חנות היין הטובה ביותר' : 'Best Wine Shop',
            'quote'  => $is_he
                ? 'זוהי חנות היין הטובה ביותר בירושלים ושווה לצאת מגדרו.'
                : 'This is the best wine shop in Jerusalem and worth going out of your way.',
            'name'   => $is_he ? 'רוב רקטור' : 'Rob Rector',
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

        <div class="section-testimonials-wrap">
            <button type="button" class="carousel-arrow carousel-arrow-prev" aria-label="<?php esc_attr_e('Previous', 'woocommerce'); ?>">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
            </button>
            <div class="testimonials-grid columns-<?php echo (int) $args['columns']; ?>">
                <?php foreach ($testimonials as $t) :
                    if (empty($t['quote'])) continue;
                    ?>
                    <figure class="testimonial">
                        <div class="testimonial-rating" aria-label="<?php esc_attr_e('Rated 5 out of 5', 'woocommerce'); ?>">
                            <?php for ($i = 0; $i < 5; $i++) : ?>
                                <svg width="14" height="14" aria-hidden="true"><use href="#i-star"/></svg>
                            <?php endfor; ?>
                        </div>
                        <?php if (!empty($t['title'])) : ?>
                            <h3 class="testimonial-title"><?php echo esc_html($t['title']); ?></h3>
                        <?php endif; ?>
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
            <button type="button" class="carousel-arrow carousel-arrow-next" aria-label="<?php esc_attr_e('Next', 'woocommerce'); ?>">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </button>
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
                            <span class="blog-card-readmore"><?php esc_html_e('Read more', 'woocommerce'); ?></span>
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
