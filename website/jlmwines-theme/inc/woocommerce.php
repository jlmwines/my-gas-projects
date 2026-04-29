<?php
/**
 * WooCommerce hook customizations.
 *
 * Sale flash override (Save ₪X copy on simple products) and the floating
 * add-to-cart bar that appears on PDPs once the main CTA scrolls out of view.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Single product page cleanup:
 *   • Hide SKU — internal identifier, no customer value
 *   • Remove "Additional information" tab — attribute data redundant once
 *     it's surfaced in the summary / description / future sensory chips
 *   • Empty the "Description" heading — the content speaks for itself
 *   • If only Description tab remains (no Reviews enabled), render the
 *     description inline without tab chrome — single-tab UIs look odd
 */
add_filter('wc_product_sku_enabled', '__return_false');
add_filter('woocommerce_product_description_heading', '__return_empty_string');
add_filter('woocommerce_product_tabs', function ($tabs) {
    unset($tabs['additional_information']);
    return $tabs;
}, 99);

add_action('wp', function () {
    if (!function_exists('is_product') || !is_product()) {
        return;
    }

    // Remove categories + tags meta block — internal taxonomies, no
    // customer value on the PDP. SKU is already filtered out separately.
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_meta', 40);

    if (comments_open()) {
        // Reviews tab will exist; keep WC's tab structure (Description + Reviews).
        return;
    }
    // No reviews → drop the tab chrome entirely. Render the long description
    // as a section after the summary; CSS handles the column-then-full-width
    // wrap behavior via clear: right + image margin-right.
    remove_action('woocommerce_after_single_product_summary', 'woocommerce_output_product_data_tabs', 10);
    add_action('woocommerce_after_single_product_summary', function () {
        global $product;
        if (!$product) return;
        $desc = $product->get_description();
        if (!$desc) return;
        echo '<section class="pdp-description">' . apply_filters('the_content', $desc) . '</section>';
    }, 10);
});

/**
 * Sale flash — distinct copy by product type:
 *   • simple on sale, with both regular_price + sale_price set → "Save ₪X"
 *   • bundle (woosb / product_bundle) with both prices set     → "Save ₪X"
 *   • bundle without explicit prices but is_on_sale() = true   → "Bundle Savings"
 *   • everything else → default WC "Sale!" markup unchanged
 *
 * Bundles are inherently discounted (their price is always less than the sum
 * of contents), so a generic "Sale!" badge reads as a temporary promotion when
 * it isn't. Differentiating the copy makes the discount story honest:
 * "Bundle Savings" for the structural bundle discount, "Save ₪X" for actual
 * sale pricing on either simple products or bundles with explicit sale prices.
 */
add_filter('woocommerce_sale_flash', function ($html, $post, $product) {
    if (!is_a($product, 'WC_Product')) {
        return $html;
    }
    if (!$product->is_on_sale()) {
        return $html;
    }

    $type = $product->get_type();
    $is_bundle = in_array($type, ['woosb', 'product_bundle'], true);

    if (!$product->is_type('simple') && !$is_bundle) {
        return $html;
    }

    $regular = (float) $product->get_regular_price();
    $sale    = (float) $product->get_sale_price();

    if ($regular > 0 && $sale > 0 && $sale < $regular) {
        $save = $regular - $sale;
        $copy = sprintf(
            /* translators: %s: amount saved (e.g. ₪50) */
            __('Save %s', 'jlmwines'),
            wc_price($save, ['decimals' => 0])
        );
        return '<span class="onsale">' . $copy . '</span>';
    }

    if ($is_bundle) {
        return '<span class="onsale onsale-bundle">' . esc_html__('Bundle Savings', 'jlmwines') . '</span>';
    }

    return $html;
}, 10, 3);

/**
 * Floating add-to-cart bar on single product pages.
 *
 * Rendered to wp_footer so it lives outside the product summary container —
 * it's position:fixed so DOM placement only matters for tab order. Hidden by
 * default; JS toggles `.is-visible` via IntersectionObserver watching the
 * main `.single_add_to_cart_button`. The floating CTA delegates its click to
 * the main button so all WC flows (variation validation, add-to-cart hooks,
 * AJAX behavior) run unchanged.
 */
/**
 * Render a product loop section. Used by front-page.php and any other
 * template that needs an inline grid of products.
 *
 * @param array $args {
 *   @type string  type        'featured' | 'sale' | 'recent' | 'category' | 'bundle'
 *   @type int     limit       Max products to show
 *   @type int     columns     Grid columns (CSS Grid)
 *   @type string  category    Slug for type=category
 *   @type string  heading     Section heading (display font)
 *   @type string  eyebrow     Small label above heading (terracotta, all-caps)
 *   @type string  cta_url     Optional "View all" link
 *   @type string  cta_text    CTA label
 * }
 */
function jlmwines_render_product_loop($args = []) {
    $args = wp_parse_args($args, [
        'type'       => 'featured',
        'limit'      => 4,
        'columns'    => 4,
        'category'   => '',
        'heading'    => '',
        'eyebrow'    => '',
        'body'       => '',
        'cta_url'    => '',
        'cta_text'   => __('Shop all', 'jlmwines'),
    ]);

    $query_args = [
        'post_type'      => 'product',
        'posts_per_page' => (int) $args['limit'],
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
        'tax_query'      => [],
    ];

    switch ($args['type']) {
        case 'featured':
            $query_args['tax_query'][] = [
                'taxonomy' => 'product_visibility',
                'field'    => 'name',
                'terms'    => 'featured',
                'operator' => 'IN',
            ];
            break;
        case 'sale':
            $sale_ids = wc_get_product_ids_on_sale();
            if (empty($sale_ids)) return;
            $query_args['post__in'] = $sale_ids;
            $query_args['orderby']  = 'post__in';
            break;
        case 'category':
            if (!empty($args['category'])) {
                $query_args['tax_query'][] = [
                    'taxonomy' => 'product_cat',
                    'field'    => 'slug',
                    'terms'    => $args['category'],
                ];
            }
            break;
        case 'bundle':
            $query_args['tax_query'][] = [
                'taxonomy' => 'product_type',
                'field'    => 'slug',
                'terms'    => ['woosb', 'product_bundle'],
            ];
            break;
    }

    $query = new WP_Query($query_args);
    if (!$query->have_posts()) {
        return;
    }
    ?>
    <section class="section section-products">
        <?php if ($args['heading'] || $args['eyebrow'] || $args['body']) : ?>
            <header class="section-header">
                <?php if ($args['eyebrow']) : ?>
                    <p class="section-eyebrow"><?php echo esc_html($args['eyebrow']); ?></p>
                <?php endif; ?>
                <?php if ($args['heading']) : ?>
                    <h2 class="section-heading"><?php echo esc_html($args['heading']); ?></h2>
                <?php endif; ?>
                <?php if ($args['body']) : ?>
                    <p class="section-body"><?php echo esc_html($args['body']); ?></p>
                <?php endif; ?>
            </header>
        <?php endif; ?>

        <ul class="products section-product-grid columns-<?php echo (int) $args['columns']; ?>">
            <?php while ($query->have_posts()) : $query->the_post(); ?>
                <?php wc_get_template_part('content', 'product'); ?>
            <?php endwhile; ?>
        </ul>

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

/**
 * Render a grid of WooCommerce product categories as visual tiles.
 */
function jlmwines_render_category_cards($args = []) {
    $args = wp_parse_args($args, [
        'limit'    => 6,
        'parent'   => 0,
        'orderby'  => 'name',
        'order'    => 'ASC',
        'heading'  => '',
        'eyebrow'  => '',
        'columns'  => 3,
        'include'  => [],
        'exclude'  => [],
        'image_overrides' => [],   // map of term_id|slug => image URL
        'card_aspect'     => '',   // override card image aspect ratio (e.g. '16/9')
    ]);

    $term_args = [
        'taxonomy'   => 'product_cat',
        'parent'     => (int) $args['parent'],
        'orderby'    => $args['orderby'],
        'order'      => $args['order'],
        'number'     => (int) $args['limit'],
        'hide_empty' => true,
    ];
    if (!empty($args['include'])) $term_args['include'] = $args['include'];
    if (!empty($args['exclude'])) $term_args['exclude'] = $args['exclude'];

    $cats = get_terms($term_args);
    if (empty($cats) || is_wp_error($cats)) {
        return;
    }
    ?>
    <section class="section section-categories">
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

        <?php
        $aspect_style = $args['card_aspect'] ? ' style="--card-aspect: ' . esc_attr($args['card_aspect']) . '"' : '';
        ?>
        <div class="category-grid columns-<?php echo (int) $args['columns']; ?>"<?php echo $aspect_style; // phpcs:ignore ?>>
            <?php foreach ($cats as $cat) :
                // Override URL precedence: image_overrides[$slug] || image_overrides[$term_id] || term thumbnail
                $override_url = '';
                if (!empty($args['image_overrides'][$cat->slug])) {
                    $override_url = $args['image_overrides'][$cat->slug];
                } elseif (!empty($args['image_overrides'][$cat->term_id])) {
                    $override_url = $args['image_overrides'][$cat->term_id];
                }
                if ($override_url) {
                    $thumb_url = $override_url;
                } else {
                    $thumb_id  = get_term_meta($cat->term_id, 'thumbnail_id', true);
                    $thumb_url = $thumb_id ? wp_get_attachment_image_url($thumb_id, 'medium') : '';
                }
                $cat_url = get_term_link($cat);
                ?>
                <a class="category-card" href="<?php echo esc_url($cat_url); ?>">
                    <div class="category-card-image">
                        <?php if ($thumb_url) : ?>
                            <img src="<?php echo esc_url($thumb_url); ?>" alt="" loading="lazy">
                        <?php endif; ?>
                    </div>
                    <div class="category-card-body">
                        <h3 class="category-card-name"><?php echo esc_html($cat->name); ?></h3>
                        <span class="category-card-count">
                            <?php
                            printf(
                                /* translators: %s: number of products in this category */
                                esc_html(_n('%s wine', '%s wines', $cat->count, 'jlmwines')),
                                esc_html(number_format_i18n($cat->count))
                            );
                            ?>
                        </span>
                    </div>
                </a>
            <?php endforeach; ?>
        </div>
    </section>
    <?php
}

add_action('wp_footer', 'jlmwines_render_floating_cart', 5);
function jlmwines_render_floating_cart() {
    if (!function_exists('is_product') || !is_product()) {
        return;
    }
    global $product;
    if (!$product || !is_a($product, 'WC_Product') || !$product->is_purchasable()) {
        return;
    }

    $thumb_id = $product->get_image_id();
    $thumb = $thumb_id
        ? wp_get_attachment_image($thumb_id, [56, 56], false, ['class' => 'floating-cart-image'])
        : '';
    ?>
    <div class="floating-cart" id="floating-cart" aria-hidden="true">
        <div class="container floating-cart-inner">
            <?php if ($thumb) : ?>
                <div class="floating-cart-thumb"><?php echo $thumb; // phpcs:ignore ?></div>
            <?php endif; ?>
            <div class="floating-cart-info">
                <span class="floating-cart-title"><?php echo esc_html($product->get_name()); ?></span>
                <span class="floating-cart-price"><?php echo $product->get_price_html(); // phpcs:ignore ?></span>
            </div>
            <button type="button" class="floating-cart-cta" data-floating-cart-add>
                <?php esc_html_e('Add to cart', 'jlmwines'); ?>
            </button>
        </div>
    </div>
    <?php
}

/**
 * Checkout-fields configuration — replaces the WooCommerce Checkout
 * Field Editor plugin entirely.
 *
 * Billing block:
 *   - Hide first/last name and postcode (gift-purchase context — billing
 *     identity is on the WP user account; the form only needs phone +
 *     email for delivery contact).
 *   - Require phone + email.
 *
 * Shipping block:
 *   - Require first/last name.
 *   - Hide postcode (Israeli addresses don't conventionally use it; the
 *     active payment gateway CardCom doesn't require it either).
 *   - Hide country (always Israel — only shipping region).
 *   - Add a shipping_phone field labeled "Recipient phone in Israel",
 *     pre-filled "+972 ", lenient validation (we contact the buyer
 *     manually if the number isn't dialable).
 *
 * Order comments:
 *   - Re-frame as "Order Notes/Gift Message" with a delivery+gift-text
 *     placeholder.
 */
add_filter('woocommerce_checkout_fields', function ($fields) {
    // Billing — hide first_name, last_name, postcode
    unset($fields['billing']['billing_first_name']);
    unset($fields['billing']['billing_last_name']);
    unset($fields['billing']['billing_postcode']);

    if (isset($fields['billing']['billing_phone'])) {
        $fields['billing']['billing_phone']['required'] = true;
    }
    if (isset($fields['billing']['billing_email'])) {
        $fields['billing']['billing_email']['required'] = true;
    }

    // Shipping — require names, hide postcode + country
    if (isset($fields['shipping']['shipping_first_name'])) {
        $fields['shipping']['shipping_first_name']['required'] = true;
    }
    if (isset($fields['shipping']['shipping_last_name'])) {
        $fields['shipping']['shipping_last_name']['required'] = true;
    }
    unset($fields['shipping']['shipping_postcode']);
    unset($fields['shipping']['shipping_country']);

    // Shipping phone — added (not a WC default field).
    $fields['shipping']['shipping_phone'] = [
        'label'        => __('Recipient phone in Israel', 'jlmwines'),
        'required'     => true,
        'class'        => ['form-row-wide'],
        'autocomplete' => 'tel',
        'default'      => '+972 ',
        'priority'     => 60,
    ];

    // Order comments — gift-message framing
    if (isset($fields['order']['order_comments'])) {
        $fields['order']['order_comments']['label']       = __('Order Notes/Gift Message', 'jlmwines');
        $fields['order']['order_comments']['placeholder'] = __('Delivery notes and/or gift message text.', 'jlmwines');
    }

    return $fields;
});

/**
 * Force shipping_country='IL' since the field is hidden from the form.
 * Without this WC has no country to calculate shipping/tax against.
 */
add_filter('woocommerce_checkout_posted_data', function ($data) {
    $data['shipping_country'] = 'IL';
    return $data;
});

/**
 * On order creation: persist shipping_phone, mirror shipping names into
 * billing names (so order email / admin list display correctly even
 * though the form hid the billing name fields), and lock shipping
 * country to IL.
 */
add_action('woocommerce_checkout_create_order', function ($order) {
    if (!empty($_POST['shipping_phone'])) {
        $order->update_meta_data('_shipping_phone', sanitize_text_field(wp_unslash($_POST['shipping_phone'])));
    }
    if (!$order->get_billing_first_name()) {
        $order->set_billing_first_name($order->get_shipping_first_name());
    }
    if (!$order->get_billing_last_name()) {
        $order->set_billing_last_name($order->get_shipping_last_name());
    }
    if (!$order->get_shipping_country()) {
        $order->set_shipping_country('IL');
    }
}, 10);

/**
 * Surface shipping_phone in the admin order screen, beneath the
 * shipping address block.
 */
add_action('woocommerce_admin_order_data_after_shipping_address', function ($order) {
    $phone = $order->get_meta('_shipping_phone');
    if ($phone) {
        echo '<p><strong>' . esc_html__('Recipient phone:', 'jlmwines') . '</strong> ' . esc_html($phone) . '</p>';
    }
});
