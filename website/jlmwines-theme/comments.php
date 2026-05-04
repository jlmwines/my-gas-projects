<?php
/**
 * Comments template.
 */

if (post_password_required()) {
    return;
}
?>

<section id="comments" class="comments-area">
    <?php if (have_comments()) : ?>
        <h2 class="comments-title">
            <?php
            $count = get_comments_number();
            $comments_fmt = is_rtl()
                ? '%s תגובות'
                : ($count === 1 ? '%s comment' : '%s comments');
            printf($comments_fmt, number_format_i18n($count));
            ?>
        </h2>

        <ol class="comment-list">
            <?php
            wp_list_comments([
                'style'      => 'ol',
                'short_ping' => true,
            ]);
            ?>
        </ol>

        <?php
        the_comments_pagination([
            'prev_text' => __('Previous', 'woocommerce'),
            'next_text' => __('Next', 'woocommerce'),
        ]);
        ?>

        <?php if (!comments_open()) : ?>
            <p class="no-comments"><?php echo is_rtl() ? 'התגובות סגורות.' : 'Comments are closed.'; ?></p>
        <?php endif; ?>
    <?php endif; ?>

    <?php comment_form(); ?>
</section>
