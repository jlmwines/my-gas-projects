<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <defs>
        <symbol id="i-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 4h2l2.4 12a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H6"/>
            <circle cx="9" cy="20" r="1.4"/>
            <circle cx="18" cy="20" r="1.4"/>
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 5v14M5 12h14"/>
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12l5 5 11-12"/>
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <path d="M20 20l-3.6-3.6"/>
        </symbol>
        <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M4 7h16M4 12h16M4 17h16"/>
        </symbol>
        <symbol id="i-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18"/>
        </symbol>
        <symbol id="i-shop" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 8h14l-1.5 11.5a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 8z"/>
            <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
        </symbol>
        <symbol id="i-account" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 21a8 8 0 0 1 16 0"/>
        </symbol>
        <symbol id="i-whatsapp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4l-4.4 1.1 1.2-4.2A8.4 8.4 0 1 1 21 11.5z"/>
            <path d="M9 9c0 4 3 7 7 7" stroke-width="1.4"/>
        </symbol>
    </defs>
</svg>

<header class="site-header">
    <div class="container site-header-inner">
        <button type="button" class="nav-toggle" aria-controls="nav-drawer" aria-expanded="false" aria-label="<?php esc_attr_e('Open menu', 'jlmwines'); ?>">
            <svg width="22" height="22" aria-hidden="true"><use href="#i-menu"/></svg>
        </button>

        <?php if (has_custom_logo()) : ?>
            <?php the_custom_logo(); ?>
        <?php else : ?>
            <a class="site-logo" href="<?php echo esc_url(home_url('/')); ?>">
                JLM <span style="color:var(--c-accent)">·</span> Wines
            </a>
        <?php endif; ?>

        <?php
        if (has_nav_menu('primary')) :
            wp_nav_menu([
                'theme_location'  => 'primary',
                'container'       => 'nav',
                'container_class' => 'site-nav',
                'menu_class'      => 'site-nav-menu',
                'depth'           => 2,
                'fallback_cb'     => false,
            ]);
        endif;
        ?>

        <div class="site-tools">
            <?php if (class_exists('WooCommerce')) : ?>
                <form class="site-search" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
                    <label class="screen-reader-text" for="site-search-input"><?php esc_html_e('Search wines', 'jlmwines'); ?></label>
                    <button type="submit" class="site-search-submit" aria-label="<?php esc_attr_e('Search', 'jlmwines'); ?>">
                        <svg width="16" height="16" aria-hidden="true"><use href="#i-search"/></svg>
                    </button>
                    <input id="site-search-input" type="search" name="s" placeholder="<?php esc_attr_e('Search wines…', 'jlmwines'); ?>" />
                    <input type="hidden" name="post_type" value="product" />
                </form>
            <?php endif; ?>

            <?php
            // Language switcher lives in the primary menu (WPML). Header tools = cart only.
            if (function_exists('jlmwines_render_cart_icon')) {
                jlmwines_render_cart_icon();
            }
            ?>
        </div>
    </div>
</header>

<?php
if (function_exists('jlmwines_render_shipping_monitor_strip')) {
    jlmwines_render_shipping_monitor_strip();
}
if (function_exists('jlmwines_render_breadcrumbs')) {
    jlmwines_render_breadcrumbs();
}
?>

<div class="nav-drawer" id="nav-drawer" aria-hidden="true">
    <div class="nav-drawer-backdrop" data-nav-drawer-close></div>
    <div class="nav-drawer-panel" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e('Site navigation', 'jlmwines'); ?>">
        <button type="button" class="nav-drawer-close" data-nav-drawer-close aria-label="<?php esc_attr_e('Close menu', 'jlmwines'); ?>">
            <svg width="22" height="22" aria-hidden="true"><use href="#i-close"/></svg>
        </button>

        <?php if (class_exists('WooCommerce')) : ?>
            <form class="nav-drawer-search site-search" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
                <label class="screen-reader-text" for="nav-drawer-search-input"><?php esc_html_e('Search wines', 'jlmwines'); ?></label>
                <button type="submit" class="site-search-submit" aria-label="<?php esc_attr_e('Search', 'jlmwines'); ?>">
                    <svg width="16" height="16" aria-hidden="true"><use href="#i-search"/></svg>
                </button>
                <input id="nav-drawer-search-input" type="search" name="s" placeholder="<?php esc_attr_e('Search wines…', 'jlmwines'); ?>" />
                <input type="hidden" name="post_type" value="product" />
            </form>
        <?php endif; ?>

        <?php
        $mobile_location = has_nav_menu('mobile') ? 'mobile' : 'primary';
        if (has_nav_menu($mobile_location)) :
            wp_nav_menu([
                'theme_location'  => $mobile_location,
                'container'       => 'nav',
                'container_class' => 'nav-drawer-nav',
                'menu_class'      => 'nav-drawer-menu',
                'depth'           => 2,
                'fallback_cb'     => false,
            ]);
        endif;
        ?>
    </div>
</div>

<?php
if (function_exists('jlmwines_render_mini_cart_drawer')) {
    jlmwines_render_mini_cart_drawer();
}
?>
