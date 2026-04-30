<?php
/**
 * Template Name: Gifts (Send Wine in Israel)
 *
 * Replaces the Elementor-built /send-wine-gifts-in-israel/ landing
 * page. Page flow:
 *
 *   1. Hero (banner image + dark overlay + light headline + body +
 *      6 anchor links to each section below)
 *   2. Gift Boxed Wines (product carousel)
 *   3. "Easy / בקלות" block — image + bullet list explaining the
 *      checkout fields where the gifter enters the message and
 *      recipient details
 *   4. Magnum Size (product carousel)
 *   5. Themed Packages (product carousel)
 *   6. "Need help? / אפשר לעזור?" block — image (Evyatar) + body +
 *      CTA that anchors to the language-specific footer-contact ID
 *   7. Sparkling Wines, Wine Accessories, Gift Items (product carousels)
 *
 * EN + HE copy is hardcoded; WPML serves the right language based on
 * the active language. Mobile (≤599px) renders product grids as
 * horizontal carousels (CSS scoped under `.page-gifts`).
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

$is_he = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';

// ─── Media library asset URLs ─────────────────────────────────────
// Site-relative paths — work on both staging (staging6.jlmwines.com)
// and production (jlmwines.com) without per-domain swapping.
$hero_bg_url    = '/wp-content/uploads/2021/06/send-wine-gift-israel-800x683-1.jpg';
$easy_image_url = '/wp-content/uploads/2021/06/gift-message-800x550-1.jpg';
$help_image_url = '/wp-content/uploads/2023/08/evyatar-cohen-jlmwines-1-1024x557.jpg';

// ─── Copy ──────────────────────────────────────────────────────────
$hero_headline = $is_he
    ? 'שלחו מתנות יין בארץ'
    : 'Send Wine Gifts in Israel';
$hero_body = $is_he
    ? 'שלחו מתנה של יין טוב (ואולי עוד) עם מכתב אישי לכל כתובת בישראל. הוסיפו לעגלה, תנו לנו את הכתובת עם פרטי המשלוח והוסיפו את המסר האישי. אנחנו נטפל בשאר!'
    : "Send a gift of wine or more with your personal message to any destination in Israel. Load your cart, fill in the shipping address, and add your personal message. We'll do the rest!";

$cta_text = $is_he ? 'עיין בהכל' : 'See All';

$sections = [
    [
        'anchor'   => 'gift-boxed',
        'category' => 'gift-boxed',
        'heading'  => $is_he ? 'יינות באריזת מתנה' : 'Gift Boxed Wines',
        'icon'     => 'i-gift-box',
    ],
    [
        'anchor'   => 'magnums',
        'category' => 'magnums',
        'heading'  => $is_he ? 'מגנומים' : 'Magnum Size',
        'icon'     => 'i-champagne-bottle',
    ],
    [
        'anchor'   => 'packages',
        'category' => 'packages',
        'heading'  => $is_he ? 'אריזות' : 'Themed Packages',
        'icon'     => 'i-basket',
    ],
    [
        'anchor'   => 'sparkling',
        'category' => 'sparkling',
        'heading'  => $is_he ? 'יינות מבעבעים' : 'Sparkling Wines',
        'icon'     => 'i-flute',
    ],
    [
        'anchor'   => 'accessories',
        'category' => 'accessories',
        'heading'  => $is_he ? 'אביזרי יין' : 'Wine Accessories',
        'icon'     => 'i-corkscrew',
    ],
    [
        'anchor'   => 'gift-items',
        'category' => 'gift-items',
        'heading'  => $is_he ? 'פריטי מתנה' : 'Gift Items',
        'icon'     => 'i-jar',
    ],
];

// "Easy" block copy
$easy_heading   = $is_he ? 'בקלות' : 'Easy';
$easy_intro     = $is_he ? 'בזמן התשלום הזינו:' : 'During checkout enter:';
$easy_bullets   = $is_he
    ? ['ההודעה האישית שלך.', 'כתובת למשלוח מתנה.', 'שם הנמען וטלפון מקומי.']
    : ['Your personal message.', 'Gift shipping address.', 'Recipient name and local phone.'];

// Help block copy
$help_heading = $is_he ? 'אפשר לעזור?'                       : 'Need help?';
$help_body    = $is_he ? 'נוכל לעזור בבחירת ושליחה מתנות.'    : 'We can help with choosing a gift, and sending it.';
$help_cta     = $is_he ? 'שאלו אותנו!'                        : 'Ask us!';
$help_anchor  = $is_he ? 'footer-contact-he'                  : 'footer-contact';
?>

<main id="content" class="site-main page-gifts">

    <section class="page-gifts-hero" style="background-image: url('<?php echo esc_url($hero_bg_url); ?>');">
        <div class="page-gifts-hero-overlay" aria-hidden="true"></div>
        <div class="container page-gifts-hero-inner">
            <h1 class="page-gifts-hero-title"><?php echo esc_html($hero_headline); ?></h1>
            <p class="page-gifts-hero-body"><?php echo esc_html($hero_body); ?></p>
            <ul class="page-gifts-hero-anchors">
                <?php foreach ($sections as $s) : ?>
                    <li>
                        <a class="page-gifts-hero-anchor" href="#<?php echo esc_attr($s['anchor']); ?>">
                            <svg class="page-gifts-hero-anchor-icon" width="20" height="20" aria-hidden="true">
                                <use href="#<?php echo esc_attr($s['icon']); ?>"/>
                            </svg>
                            <span><?php echo esc_html($s['heading']); ?></span>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    </section>

    <?php
    /**
     * Render a single product section (anchor + product loop).
     * Inline closure so we can compose the page in groups separated
     * by full-width Easy / Help bands.
     */
    $render_product_section = function ($s) use ($cta_text) {
        $term    = get_term_by('slug', $s['category'], 'product_cat');
        $cta_url = ($term && !is_wp_error($term)) ? get_term_link($term) : '';
        ?>
        <div id="<?php echo esc_attr($s['anchor']); ?>" class="page-gifts-section-anchor"></div>
        <?php
        if (function_exists('jlmwines_render_product_loop')) {
            jlmwines_render_product_loop([
                'type'                 => 'category',
                'category'             => $s['category'],
                'limit'                => 6,
                'columns'              => 6,
                'heading'              => $s['heading'],
                'cta_url'              => $cta_url,
                'cta_text'             => $cta_text,
                'include_out_of_stock' => true,
            ]);
        }
    };
    ?>

    <div class="container">
        <?php $render_product_section($sections[0]); // Gift Boxed Wines ?>
    </div>

    <section class="page-gifts-band page-gifts-easy-band">
        <div class="container page-gifts-band-inner">
            <div class="page-gifts-band-content">
                <h2 class="page-gifts-band-heading"><?php echo esc_html($easy_heading); ?></h2>
                <p class="page-gifts-band-body"><?php echo esc_html($easy_intro); ?></p>
                <ul class="page-gifts-easy-list">
                    <?php foreach ($easy_bullets as $bullet) : ?>
                        <li><?php echo esc_html($bullet); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
            <div class="page-gifts-band-image">
                <img src="<?php echo esc_url($easy_image_url); ?>" alt="" loading="lazy">
            </div>
        </div>
    </section>

    <div class="container">
        <?php $render_product_section($sections[1]); // Magnums ?>
        <?php $render_product_section($sections[2]); // Themed Packages ?>
    </div>

    <section class="page-gifts-band page-gifts-help-band">
        <div class="container page-gifts-band-inner page-gifts-band-image-start">
            <div class="page-gifts-band-content">
                <h2 class="page-gifts-band-heading"><?php echo esc_html($help_heading); ?></h2>
                <p class="page-gifts-band-body"><?php echo esc_html($help_body); ?></p>
                <a class="button button-primary page-gifts-band-cta" href="#<?php echo esc_attr($help_anchor); ?>"><?php echo esc_html($help_cta); ?></a>
            </div>
            <div class="page-gifts-band-image">
                <img src="<?php echo esc_url($help_image_url); ?>" alt="" loading="lazy">
            </div>
        </div>
    </section>

    <div class="container">
        <?php $render_product_section($sections[3]); // Sparkling ?>
        <?php $render_product_section($sections[4]); // Accessories ?>
        <?php $render_product_section($sections[5]); // Gift Items ?>
    </div>
</main>

<?php get_footer(); ?>
