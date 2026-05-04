<?php
/**
 * Template Name: Articles (Wine Talk)
 *
 * Standalone page template — renders the blog roll for the "basics"
 * category with the Wine Talk framing. Apply this to the /articles/
 * page (EN + HE) via Page Attributes → Template in wp-admin.
 * Replaces the dead Elementor Posts widget the page used to host.
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

$is_he   = is_rtl();
$eyebrow = $is_he ? 'עם אביתר' : 'with Evyatar';
$heading = $is_he ? 'שיחת יין'  : 'Wine Talk';
?>

<main id="content" class="site-main">
    <div class="container">
        <?php
        if (function_exists('jlmwines_render_blog_roll')) {
            jlmwines_render_blog_roll([
                'eyebrow'  => $eyebrow,
                'heading'  => $heading,
                'limit'    => 30,
                'columns'  => 3,
                'category' => 'basics',
                'cta_url'  => '',
            ]);
        }
        ?>
    </div>
</main>

<?php get_footer(); ?>
