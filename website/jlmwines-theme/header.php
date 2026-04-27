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
    </defs>
</svg>

<header class="site-header">
    <div class="container site-header-inner">
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
                    <input id="site-search-input" type="search" name="s" placeholder="<?php esc_attr_e('Search wines…', 'jlmwines'); ?>" />
                    <input type="hidden" name="post_type" value="product" />
                </form>
            <?php endif; ?>

            <?php
            // Language switcher lives in the primary menu (WPML). Header tools = cart only.
            if (class_exists('WooCommerce')) :
                $cart_count = WC()->cart ? WC()->cart->get_cart_contents_count() : 0;
                ?>
                <a class="cart-icon" href="<?php echo esc_url(wc_get_cart_url()); ?>" aria-label="<?php esc_attr_e('Cart', 'jlmwines'); ?>">
                    <svg width="20" height="20"><use href="#i-cart"/></svg>
                    <?php if ($cart_count > 0) : ?>
                        <span class="cart-icon-count"><?php echo esc_html($cart_count); ?></span>
                    <?php endif; ?>
                </a>
            <?php endif; ?>
        </div>
    </div>
</header>
