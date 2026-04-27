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
            printf(
                _n('%s comment', '%s comments', $count, 'jlmwines'),
                number_format_i18n($count)
            );
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
            'prev_text' => __('Previous', 'jlmwines'),
            'next_text' => __('Next', 'jlmwines'),
        ]);
        ?>

        <?php if (!comments_open()) : ?>
            <p class="no-comments"><?php _e('Comments are closed.', 'jlmwines'); ?></p>
        <?php endif; ?>
    <?php endif; ?>

    <?php comment_form(); ?>
</section>
