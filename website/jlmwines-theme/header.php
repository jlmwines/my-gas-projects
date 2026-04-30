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
        <symbol id="i-facebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 7h3V3h-3a4 4 0 0 0-4 4v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1z"/>
        </symbol>
        <symbol id="i-instagram" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="5"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none"/>
        </symbol>
        <symbol id="i-arrow-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 14l7-7 7 7"/>
        </symbol>
        <symbol id="i-truck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 7h11v9H2zM13 11h5l3 3v2h-8z"/>
            <circle cx="6" cy="18" r="2"/>
            <circle cx="17" cy="18" r="2"/>
        </symbol>
        <symbol id="i-hand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11V5a2 2 0 0 1 4 0v6"/>
            <path d="M13 11V4a2 2 0 0 1 4 0v8"/>
            <path d="M17 9.5a2 2 0 0 1 4 0V14a8 8 0 0 1-8 8H10a4 4 0 0 1-3.4-1.9L4 16a2 2 0 0 1 3-2.6l2 2"/>
        </symbol>
        <symbol id="i-star" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M12 2.5l2.95 6.45 7.05.65-5.35 4.7L18.3 21 12 17.4 5.7 21l1.65-6.7L2 9.6l7.05-.65z"/>
        </symbol>
        <symbol id="i-gift-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="8" width="18" height="13" rx="1"/>
            <path d="M3 12h18"/>
            <path d="M12 8v13"/>
            <path d="M8 8c-1.6-2-1-4 1-4s2.5 1.5 3 4M16 8c1.6-2 1-4-1-4s-2.5 1.5-3 4"/>
        </symbol>
        <symbol id="i-champagne-bottle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="10" y="2" width="4" height="3" rx="0.4"/>
            <path d="M11 5v3M13 5v3"/>
            <path d="M10 8h4"/>
            <path d="M10 8c-1.2 1-2 2.2-2 4v8a2 2 0 002 2h4a2 2 0 002-2v-8c0-1.8-0.8-3-2-4"/>
        </symbol>
        <symbol id="i-basket" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 8h18l-1.5 12a2 2 0 01-2 2h-11a2 2 0 01-2-2L3 8z"/>
            <path d="M7 8a5 5 0 0110 0"/>
            <path d="M3 12h18"/>
        </symbol>
        <symbol id="i-flute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 3h6l-1.5 9c-0.2 1-0.8 1.5-1.5 1.5s-1.3-0.5-1.5-1.5z"/>
            <circle cx="12" cy="7" r="0.5" fill="currentColor"/>
            <circle cx="13.2" cy="9" r="0.4" fill="currentColor"/>
            <path d="M12 13.5v6.5"/>
            <path d="M9 21h6"/>
        </symbol>
        <symbol id="i-corkscrew" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 3h14v3a3 3 0 01-3 3h-3"/>
            <path d="M13 9v3M13 12c-2 0-2 2 0 2s2 2 0 2-2 2 0 2v2"/>
        </symbol>
        <symbol id="i-jar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="3" width="12" height="3" rx="0.5"/>
            <path d="M7 6v2M17 6v2"/>
            <path d="M5 8h14v12a2 2 0 01-2 2H7a2 2 0 01-2-2z"/>
            <path d="M7 12h10M7 16h10"/>
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
