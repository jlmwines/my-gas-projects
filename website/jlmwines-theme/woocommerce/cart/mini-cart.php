<?php
/**
 * Mini-cart template (override).
 *
 * Layered on top of WC's default template at /templates/cart/mini-cart.php.
 * Adds inline +/- qty controls and a remove (×) button per line item.
 *
 * @see https://woocommerce.com/document/template-structure/
 */

defined('ABSPATH') || exit;

do_action('woocommerce_before_mini_cart');
?>

<?php if (!WC()->cart->is_empty()) : ?>

    <ul class="woocommerce-mini-cart cart_list product_list_widget <?php echo esc_attr($args['list_class']); ?>">
        <?php
        do_action('woocommerce_before_mini_cart_contents');

        foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) {
            $_product   = apply_filters('woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key);
            $product_id = apply_filters('woocommerce_cart_item_product_id', $cart_item['product_id'], $cart_item, $cart_item_key);

            if (!$_product || !$_product->exists() || $cart_item['quantity'] <= 0 || !apply_filters('woocommerce_cart_item_visible', true, $cart_item, $cart_item_key)) {
                continue;
            }

            $product_name      = apply_filters('woocommerce_cart_item_name', $_product->get_name(), $cart_item, $cart_item_key);
            $thumbnail         = apply_filters('woocommerce_cart_item_thumbnail', $_product->get_image('thumbnail'), $cart_item, $cart_item_key);
            $product_price     = apply_filters('woocommerce_cart_item_price', WC()->cart->get_product_price($_product), $cart_item, $cart_item_key);
            $product_permalink = apply_filters('woocommerce_cart_item_permalink', $_product->is_visible() ? $_product->get_permalink($cart_item) : '', $cart_item, $cart_item_key);
            ?>
            <li class="woocommerce-mini-cart-item mini-cart-item <?php echo esc_attr(apply_filters('woocommerce_mini_cart_item_class', 'mini_cart_item', $cart_item, $cart_item_key)); ?>" data-cart-item-key="<?php echo esc_attr($cart_item_key); ?>">

                <div class="mini-cart-item-image">
                    <?php if (empty($product_permalink)) : ?>
                        <?php echo $thumbnail . wp_kses_post($product_name); // phpcs:ignore ?>
                    <?php else : ?>
                        <a href="<?php echo esc_url($product_permalink); ?>"><?php echo $thumbnail; // phpcs:ignore ?></a>
                    <?php endif; ?>
                </div>

                <div class="mini-cart-item-body">
                    <?php if (empty($product_permalink)) : ?>
                        <span class="mini-cart-item-title"><?php echo wp_kses_post($product_name); ?></span>
                    <?php else : ?>
                        <a class="mini-cart-item-title" href="<?php echo esc_url($product_permalink); ?>"><?php echo wp_kses_post($product_name); ?></a>
                    <?php endif; ?>

                    <?php echo wc_get_formatted_cart_item_data($cart_item); // phpcs:ignore ?>

                    <div class="mini-cart-item-meta">
                        <div class="mini-cart-qty" data-cart-item-key="<?php echo esc_attr($cart_item_key); ?>">
                            <button type="button" class="mini-cart-qty-btn" data-qty-step="-1" aria-label="<?php esc_attr_e('Decrease quantity', 'jlmwines'); ?>">−</button>
                            <span class="mini-cart-qty-value" aria-live="polite"><?php echo esc_html($cart_item['quantity']); ?></span>
                            <button type="button" class="mini-cart-qty-btn" data-qty-step="1" aria-label="<?php esc_attr_e('Increase quantity', 'jlmwines'); ?>">+</button>
                        </div>
                        <span class="mini-cart-item-price"><?php echo $product_price; // phpcs:ignore ?></span>
                    </div>
                </div>

                <?php
                echo apply_filters( // phpcs:ignore
                    'woocommerce_cart_item_remove_link',
                    sprintf(
                        '<a href="%s" class="remove remove_from_cart_button mini-cart-item-remove" aria-label="%s" data-product_id="%s" data-cart_item_key="%s" data-product_sku="%s">&times;</a>',
                        esc_url(wc_get_cart_remove_url($cart_item_key)),
                        /* translators: %s is the product name */
                        esc_attr(sprintf(__('Remove %s from cart', 'jlmwines'), wp_strip_all_tags($product_name))),
                        esc_attr($product_id),
                        esc_attr($cart_item_key),
                        esc_attr($_product->get_sku())
                    ),
                    $cart_item_key
                );
                ?>
            </li>
            <?php
        }

        do_action('woocommerce_mini_cart_contents');
        ?>
    </ul>

    <p class="woocommerce-mini-cart__total total">
        <?php
        /**
         * Hook: woocommerce_widget_shopping_cart_total.
         *
         * @hooked woocommerce_widget_shopping_cart_subtotal - 10
         */
        do_action('woocommerce_widget_shopping_cart_total');
        ?>
    </p>

    <?php
    // Shipping fee line + free-shipping monitor.
    // Layout: subtotal → shipping (₪40 or "Free ✓") → progress bar (only when not qualified).
    if (function_exists('jlmwines_get_shipping_fee')) :
        $jlm_fee = jlmwines_get_shipping_fee();
        if ($jlm_fee['amount'] !== null) :
            ?>
            <p class="woocommerce-mini-cart__shipping">
                <strong><?php esc_html_e('Shipping:', 'jlmwines'); ?></strong>
                <?php if ($jlm_fee['qualified']) : ?>
                    <span class="shipping-free">
                        <svg width="14" height="14" aria-hidden="true"><use href="#i-check"/></svg>
                        <?php esc_html_e('Free', 'jlmwines'); ?>
                    </span>
                <?php else : ?>
                    <span class="amount"><?php echo wc_price($jlm_fee['amount'], ['decimals' => 0]); ?></span>
                <?php endif; ?>
            </p>
            <?php
            if (!$jlm_fee['qualified']) {
                jlmwines_render_shipping_monitor('slim');
            }
        endif;
    endif;
    ?>

    <?php do_action('woocommerce_widget_shopping_cart_before_buttons'); ?>

    <p class="woocommerce-mini-cart__buttons buttons">
        <?php do_action('woocommerce_widget_shopping_cart_buttons'); ?>
    </p>

    <?php do_action('woocommerce_widget_shopping_cart_after_buttons'); ?>

<?php else : ?>

    <p class="woocommerce-mini-cart__empty-message"><?php esc_html_e('Your cart is empty.', 'jlmwines'); ?></p>

<?php endif; ?>

<?php do_action('woocommerce_after_mini_cart'); ?>
