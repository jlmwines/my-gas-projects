<?php
/**
 * Template Name: Homepage
 *
 * Selectable Page Template that mirrors the auto-loaded front-page.php
 * layout. Assigned to the EN + HE home-elegant Pages so the homepage
 * can be anchored on real Page records (fixes hreflang http, RankMath
 * per-page fields, and the /he/home-elegant/ stray sitemap entry).
 *
 * Sequence: hero → bundles → packages → why trust me → browse the
 * collection → testimonials → wine talk → trust banner.
 */

get_header();
?>

<main id="content" class="site-main">

    <?php
    // ─── 1. Hero — Evyatar header ──────────────────────────────────
    $hero_image = get_theme_mod(
        'jlmwines_hero_image',
        '/wp-content/uploads/2026/01/evyatar-cohen-09.png'
    );
    $hero_eyebrow  = get_theme_mod('jlmwines_hero_eyebrow',  is_rtl() ? 'לא מומחה יין?' : 'Wine, made easy');
    $hero_headline = get_theme_mod('jlmwines_hero_headline', is_rtl() ? 'אתם לא צריכים להבין ביין. זאת העבודה שלי.' : "You don't need to be an expert.");
    $hero_body     = get_theme_mod(
        'jlmwines_hero_body',
        is_rtl()
            ? 'אני אביתר, מחנות היין כוס של ברכה בירושלים. אני טועם את היינות לפני שהם מגיעים לאתר, כך שכל בקבוק בדוק ומספק את הסחורה.'
            : "I'm Evyatar. I taste everything in the shop and only stock what I'd pour for friends. Tell me what you like — I'll send you something you'll enjoy."
    );
    // Hero CTA jumps to the packages section by default — packages are the
    // curated, guided buying path for someone who wants to actually order.
    // The shop page is reachable from the header for browsers; buyers land
    // on packages first.
    $hero_cta_url  = get_theme_mod('jlmwines_hero_cta_url',  '#packages');
    $hero_cta_text = get_theme_mod('jlmwines_hero_cta_text', is_rtl() ? 'ראו את הבחירות שלי למטה' : 'Find your wine');
    ?>
    <section class="hero">
        <div class="container hero-inner">
            <div class="hero-content">
                <?php if ($hero_eyebrow) : ?>
                    <p class="section-eyebrow"><?php echo esc_html($hero_eyebrow); ?></p>
                <?php endif; ?>
                <h1 class="hero-headline"><?php echo esc_html($hero_headline); ?></h1>
                <?php if ($hero_body) : ?>
                    <p class="hero-body"><?php echo esc_html($hero_body); ?></p>
                <?php endif; ?>
                <?php if ($hero_cta_url && $hero_cta_text) : ?>
                    <a class="button button-primary hero-cta" href="<?php echo esc_url($hero_cta_url); ?>">
                        <?php echo esc_html($hero_cta_text); ?>
                    </a>
                <?php endif; ?>
            </div>
            <?php
            $hero_image_id = (int) get_theme_mod('jlmwines_hero_image_id', 0);
            ?>
            <?php if ($hero_image_id) : ?>
                <div class="hero-image">
                    <?php
                    /*
                     * Sizes attribute reflects layout: hero is 100vw on
                     * mobile/tablet (single column), 50vw on desktop (split
                     * with the hero copy). Browser picks the smallest srcset
                     * variant that fits — mobile ends up with a ~300-wide
                     * file instead of the full hero.
                     */
                    echo wp_get_attachment_image($hero_image_id, 'large', false, [
                        'alt'           => esc_attr( is_rtl() ? 'אביתר' : 'Evyatar' ),
                        'loading'       => 'eager',
                        'fetchpriority' => 'high',
                        'sizes'         => '(max-width: 899px) 100vw, 50vw',
                    ]);
                    ?>
                </div>
            <?php elseif ($hero_image) : ?>
                <div class="hero-image">
                    <img src="<?php echo esc_url($hero_image); ?>"
                         alt="<?php echo esc_attr( is_rtl() ? 'אביתר' : 'Evyatar' ); ?>"
                         width="760" height="751"
                         loading="eager"
                         fetchpriority="high">
                </div>
            <?php endif; ?>
        </div>
    </section>

    <div class="container">

        <?php
        // ─── 2. Wine bundles ──────────────────────────────────────────
        if (function_exists('jlmwines_render_product_loop')) {
            jlmwines_render_product_loop([
                'type'     => 'category',
                'category' => 'bundle',
                'limit'    => 4,
                'columns'  => 4,
                'order'    => 'ASC',
                'eyebrow'  => is_rtl() ? 'אנחנו מציעים – אתם בוחרים' : 'We suggest – You choose',
                'heading'  => is_rtl() ? 'חבילות יין' : 'Wine Bundles',
                'body'     => is_rtl()
                    ? 'בחרו מהמבחר בכל טווח מחיר. אתם בשליטה. אני מוודא שכל אפשרות שווה טעימה שלכם.'
                    : "Pick from my curated selection at every price point. You're in control. I make sure every option is worthy of your consideration.",
                'cta_url'  => home_url('/product-category/bundle/'),
                'cta_text' => is_rtl() ? 'ראו את כל החבילות' : 'All bundles',
            ]);
        }
        ?>

        <?php
        // ─── 3. Wine packages — different lead-in (intro question + body) ──
        // Renders an intro pair before the section heading, since the user's
        // brief frames packages as an answer to "Not sure where to start?".
        ?>
        <section id="packages" class="section section-packages-intro">
            <header class="section-header">
                <p class="section-question"><?php echo esc_html( is_rtl() ? 'לא בטוחים מאיפה להתחיל?' : 'Not sure where to start?' ); ?></p>
                <p class="section-body"><?php echo esc_html( is_rtl() ? 'החבילות שלנו מוכנות – אנחנו בוחרים את היינות, אתם חוסכים. הוסיפו פריט מתנה כדי להפוך אותו למושלם עבור מישהו מיוחד, כמוכם.' : 'Our packages are ready to go – we choose the wines, you save. Add a gift item to make it perfect for someone special, like yourself.' ); ?></p>
            </header>
        </section>

        <?php
        if (function_exists('jlmwines_render_product_loop')) {
            jlmwines_render_product_loop([
                'type'     => 'category',
                'category' => 'packages',
                'limit'    => 4,
                'columns'  => 4,
                'eyebrow'  => is_rtl() ? 'אנחנו בוחרים – אתם חוסכים' : 'We choose – You save',
                'heading'  => is_rtl() ? 'מארזים לאירועים' : 'Occasion Packages',
                'cta_url'  => home_url('/product-category/packages/'),
                'cta_text' => is_rtl() ? 'ראו את כל המארזים' : 'All packages',
            ]);
        }
        ?>

    </div>

    <?php
    // ─── 4. Why trust me banner ───────────────────────────────────
    $wtm_image = get_theme_mod(
        'jlmwines_wtm_image',
        '/wp-content/uploads/2026/01/evyatar-cohen-10.png'
    );
    $wtm_eyebrow  = get_theme_mod('jlmwines_wtm_eyebrow',  '');
    $wtm_headline = get_theme_mod('jlmwines_wtm_headline', is_rtl() ? 'למה לסמוך עליי?' : 'Why trust me?');
    $wtm_body     = get_theme_mod(
        'jlmwines_wtm_body',
        is_rtl()
            ? 'אני טועם כל יין לפני שאנחנו מזמינים אותו לאתר. יש הרבה יינות שלא מצליחים. אלו שכן? הייתי מגיש אותם בשולחן שלי.'
            : "I taste every wine before it reaches the site. Some wines don't make the cut. The ones that do? I'd serve them at my own table."
    );
    $wtm_cta_url  = get_theme_mod('jlmwines_wtm_cta_url',  home_url('/about/'));
    $wtm_cta_text = get_theme_mod('jlmwines_wtm_cta_text', is_rtl() ? 'הכירו את אביתר' : 'Meet Evyatar');
    ?>
    <section class="banner banner-wtm">
        <div class="container banner-inner banner-image-end">
            <div class="banner-content">
                <?php if ($wtm_eyebrow) : ?>
                    <p class="section-eyebrow"><?php echo esc_html($wtm_eyebrow); ?></p>
                <?php endif; ?>
                <h2 class="banner-headline"><?php echo esc_html($wtm_headline); ?></h2>
                <?php if ($wtm_body) : ?>
                    <p class="banner-body"><?php echo esc_html($wtm_body); ?></p>
                <?php endif; ?>
                <?php if ($wtm_cta_url && $wtm_cta_text) : ?>
                    <a class="button button-secondary" href="<?php echo esc_url($wtm_cta_url); ?>">
                        <?php echo esc_html($wtm_cta_text); ?>
                    </a>
                <?php endif; ?>
            </div>
            <?php if ($wtm_image) : ?>
                <div class="banner-image">
                    <img src="<?php echo esc_url($wtm_image); ?>" alt="<?php echo esc_attr( is_rtl() ? 'אביתר כהן, JLM Wines' : 'Evyatar Cohen, JLM Wines' ); ?>" loading="lazy">
                </div>
            <?php endif; ?>
        </div>
    </section>

    <div class="container">

        <?php
        // ─── 5. Browse The Collection — 3 hand-picked categories ──────
        if (function_exists('jlmwines_render_category_cards')) {
            $cat_images_base = get_template_directory_uri() . '/assets/images/categories';
            jlmwines_render_category_cards([
                'heading' => is_rtl() ? 'צפו בקולקציה' : 'Browse The Collection',
                'columns' => 3,
                'limit'   => 3,
                'include' => [88, 89, 135], // dry-red, dry-white, rose
                'orderby' => 'include',
                'card_aspect' => '16/9',
                'image_overrides' => [
                    'dry-red'   => $cat_images_base . '/dry-red.jpg',
                    'dry-white' => $cat_images_base . '/dry-white.jpg',
                    'rose'      => $cat_images_base . '/rose.jpg',
                ],
            ]);
        }
        ?>

        <?php
        // ─── 6. Testimonials ──────────────────────────────────────────
        if (function_exists('jlmwines_render_testimonials')) {
            $is_he_tm = function_exists('icl_get_current_language') && icl_get_current_language() === 'he';
            jlmwines_render_testimonials([
                'eyebrow' => $is_he_tm ? 'הלקוחות המאושרים שלנו' : 'FROM OUR 5-STAR GOOGLE REVIEWS',
                'heading' => $is_he_tm ? '' : 'What customers say',
            ]);
        }
        ?>

        <?php
        // ─── 7. Blog roll — Wine Talk ─────────────────────────────────
        if (function_exists('jlmwines_render_blog_roll')) {
            jlmwines_render_blog_roll([
                'eyebrow'  => is_rtl() ? 'מאת אביתר' : 'from Evyatar',
                'heading'  => is_rtl() ? 'שיחת יין' : 'Wine Talk',
                'limit'    => 3,
                'columns'  => 3,
                'category' => 'basics',
                'cta_url'  => home_url('/articles/'),
                'cta_text' => is_rtl() ? 'ראו את כל המאמרים' : 'All articles',
            ]);
        }
        ?>

    </div>

    <?php
    // ─── 8. Trust banner — free shipping / hand-picked / personal help
    $trust_items = apply_filters('jlmwines_trust_items', [
        [
            'icon'  => 'truck',
            'title' => is_rtl() ? 'משלוח חינם' : 'Free delivery',
            'body'  => is_rtl() ? 'בהזמנות מעל ₪399' : 'On orders over ₪399',
        ],
        [
            'icon'  => 'check',
            'title' => is_rtl() ? 'מבחר אישי' : 'Hand-picked',
            'body'  => is_rtl() ? 'כל יין נטעם אישית לפני שהוא מוכנס למלאי' : "Every wine personally tasted before it's stocked",
        ],
        [
            'icon'  => 'whatsapp',
            'title' => is_rtl() ? 'עזרה אישית' : 'Personal help',
            'body'  => is_rtl() ? 'שלחו לאביתר וואטסאפ להמלצה' : 'WhatsApp Evyatar for a recommendation',
        ],
    ]);
    ?>
    <section class="trust-banner">
        <div class="container">
            <ul class="trust-row">
                <?php foreach ($trust_items as $item) : ?>
                    <li class="trust-item">
                        <span class="trust-icon">
                            <svg width="32" height="32" aria-hidden="true"><use href="#i-<?php echo esc_attr($item['icon']); ?>"/></svg>
                        </span>
                        <h3 class="trust-title"><?php echo esc_html($item['title']); ?></h3>
                        <p class="trust-body"><?php echo esc_html($item['body']); ?></p>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    </section>

</main>

<?php
get_footer();
