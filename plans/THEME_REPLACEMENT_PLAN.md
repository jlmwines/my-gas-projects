# JLM Wines — Theme Replacement Plan

**Updated:** 2026-04-27
**Direction set 2026-04-26:** Drop both KoWine **and** Elementor. Build a proper custom theme on a staging clone, migrate Elementor-built pages to Gutenberg, deactivate the entire Elementor stack at cutover.

(Supersedes the prior direction, which kept Elementor and replaced only KoWine.)

**Strategic anchor:** read `THEME_FOUNDATIONS.md` first — business model, audience, voice, Israeli context, and the live dashboard of open gaps for the theme prep phase.

## Context

jlmwines.com runs on KoWine (parent + child) with Elementor + Elementor Pro layered on top. Two structural problems:

1. **KoWine + Wpbingo Core blocks WooCommerce updates.** On staging6, plugin updates crash the site (Wpbingo Core kills everything; Smart Coupons Pro kills shop/product pages). Live is rolled back.
2. **Elementor is the performance ceiling.** SG Optimizer captured the easy wins (font-display, minify, combine CSS/JS). The remaining 1,460 ms render-block + 226 KiB unused CSS are structural — Elementor itself ships heavy CSS/JS on every page. Optimizer tuning can't reach past it.

A KoWine-only replacement solves #1 but leaves #2 untouched. The decision is to do this once, properly: WP + Woo + WPML + custom theme + minimal plugins.

## Goals

- Eliminate KoWine, kowine-child, Wpbingo Core, Redux Framework, Elementor, Elementor Pro, Smart Coupons Pro, and any Elementor addons.
- Custom classic theme that integrates cleanly with WooCommerce, WPML, and Rank Math.
- **WPML compatibility 100% required** — non-negotiable.
- Performance: 90+ Lighthouse on shop/product pages, no Elementor CSS/JS in page source.
- WooCommerce upgrade-safe (no theme-specific compat issues blocking core updates).
- Bilingual HE+EN via WPML, RTL correct.
- Build on staging, cut over once, with a 3-minute rollback path.

## Design direction

The new theme is a clean break — **not preserving existing colors or fonts.** Design system comes from research against the brand voice and the goals below, not from the current site's dark/green Marcellus look.

Priorities (in order):

1. **Speed.** Minimal CSS/JS, no framework bloat, deferred loading where possible.
2. **Clarity.** Clean visual hierarchy, generous whitespace, content-first.
3. **Conversion.** Design choices that move sales:
   - **Floating add-to-cart** — sticky bar on single-product pages once the main add-to-cart scrolls out of view.
   - **Free shipping monitor** — cart progress indicator ("Add NIS X for free shipping") on cart page and mini-cart.
   - Card design optimized for the transparent-PNG product photo standard.
   - CTA contrast and placement validated against the chosen palette.
4. **SEO.** Semantic HTML5, valid schema, fast Core Web Vitals, content the crawler can read.
5. **Brand fit.** Appearance conforms with JLM's anti-snob, friendly-curator voice. Not luxury-formal, not bargain-bin. Approachable, knowledgeable, trustworthy.
6. **WPML 100%.** Every string, switcher, menu, and Woo flow works in HE+EN with no missing translations or RTL breakage.

**Design system research (next step before any CSS):** invoke `frontend-design` skill to research and propose a complete design system — bilingual font family/pair (HE + EN both first-class), 8-token color palette tuned for wine retail and conversion, image treatments around the transparent-PNG catalog standard, sample components (product card, hero, CTA bar, free shipping monitor, floating add-to-cart). Output is a design specification doc + a small set of reference HTML/CSS components that establish the visual contract before the theme code is written.

## Stack (resolved against staging audit, 2026-04-26)

**Keep — core**
- WordPress core, WooCommerce 10.7.0, WPML (Multilingual CMS 4.9.2.1 + WooCommerce Multilingual 5.5.5 + String Translation 3.5.1 + WPML SEO 2.2.5)
- Rank Math SEO 1.0.268
- SG Speed Optimizer 7.7.9
- **WPC Product Bundles for WooCommerce (Premium) 8.5.1 — CRITICAL, must work day one**
- Mailchimp for WooCommerce 6.0.2
- CardCom Payment Gateway
- WP Mail SMTP
- Wordfence Security
- Complianz GDPR/Cookie Consent
- Google Analytics for WooCommerce + Google for WooCommerce
- WooCommerce Checkout Field Editor (verify still needed)
- ManageWP Worker (infrastructure)
- User Switching, Disable Admin Notices Individually, WooCommerce.com Update Manager, ACF Multilingual

**Keep — accessibility (verify)**
- **Ally — Web Accessibility (by Elementor.com)** — KEEP per decision. **Open question:** plugin is by Elementor; verify it functions standalone after Elementor is deactivated. If it requires Elementor, replace with One Click Accessibility, WP Accessibility, or AccessiBe.

**Drop at cutover**
- KoWine, kowine-child, Wpbingo Core, Redux Framework
- Elementor, Elementor Pro
- Smart Coupons Pro (already removed on staging — confirmed)
- WPC Smart Wishlist for WooCommerce (low usage)
- WP File Manager (likely a KoWine requirement; security risk to keep)
- Contact Form 7 + WPML for CF7 (already inactive; likely was a KoWine requirement)

**Drop AFTER cutover (staged removal once new theme is stable)**
- **Jetpack 15.7.1** — defer deactivation until the new theme has been stable for at least a week, in case it's providing image CDN, stats, or backup services the site depends on. Audit Jetpack module usage before pulling.

**Build into theme (replacing Elementor features)**
- **Floating WhatsApp button** — currently an Elementor widget; rebuild as a small theme-side component (HTML + CSS + minimal JS for click tracking).
- **Age verification modal** — currently an Elementor feature; rebuild as a small theme-side component (modal + localStorage gate). Bilingual via WPML strings.

**Open / TBD**
- Block library beyond Gutenberg core: likely not needed (homepage hard-coded). Default Gutenberg only.

## Why in-place, not clean WP install

Considered and rejected (2026-04-26). A clean install would mean fresh WP + fresh DB + migrate products / customers / orders / reviews / WPML translations / Rank Math metadata via export-import. The downside is large: every product/order/customer ID can shift, breaking external references (old confirmation emails, third-party integrations, **the jlmops Comax sync** which is keyed on those records). Reviews can detach. WPML translation pairs need re-linking. Rollback is not 3 minutes once production data has been migrated.

The upside (clean DB) is ~90% achievable in-place via targeted cleanup queries after cutover (see Cutover step 9). That recovers most of the cleanliness benefit without any of the customer-facing or integration risk.

Reconsider only if: the existing DB shows real corruption during the staging audit, or this is bundled with a hosting/domain/PHP change that warrants a full relaunch.

## Theme architecture

**Classic theme, not block (FSE).** Reasons:
- Block themes are still maturing for WooCommerce — template-part edge cases are common.
- Classic + Gutenberg for content is the proven path with full Woo hook coverage.
- Easier WPML integration (string registration, switcher placement).
- Tighter performance control (no FSE template-part overhead).

Theme slug: `jlmwines`. Directory: `wp-content/themes/jlmwines-theme/`.

```
jlmwines-theme/
├── style.css              # Theme declaration + base reset
├── rtl.css                # RTL overrides for Hebrew
├── functions.php          # Setup, supports, enqueues, content width
├── header.php             # <head>, site header (logo, nav, switcher, cart)
├── footer.php             # Site footer (newsletter, columns, legal)
├── front-page.php         # Custom homepage (replaces Elementor page 9019)
├── index.php              # Default fallback
├── singular.php           # Base for single post/page
├── single.php             # Blog post (extends singular)
├── page.php               # Plain page (extends singular)
├── archive.php            # Generic archive
├── search.php             # Search results
├── 404.php                # Not found
├── comments.php           # Comments template
├── woocommerce.php        # Woo wrapper — header/footer + woocommerce_content()
├── inc/
│   ├── enqueue.php        # Style/script registration
│   ├── nav-walker.php     # WPML-aware nav walker
│   ├── woocommerce.php    # Woo hooks (gallery, loop, account menu, mini-cart)
│   ├── wpml.php           # Switcher helper, string registrations
│   ├── theme-state.php    # Export/import handler for theme-state.json
│   └── blocks.php         # Custom block patterns (optional, for homepage v2)
├── template-parts/
│   ├── header-nav.php
│   ├── footer-newsletter.php
│   ├── product-card.php
│   └── ...
├── assets/
│   ├── css/main.css       # Compiled site CSS
│   ├── css/editor.css     # Block editor styles
│   ├── js/main.js         # Vanilla JS (nav toggle, cart drawer)
│   └── img/
├── languages/
│   └── jlmwines.pot       # Translation template + initial HE
├── theme-state.json       # Versioned theme state (menus, options, template assignments) — see inc/theme-state.php
└── screenshot.png
```

## File specifications

### style.css
Theme header: Theme Name, Version 1.0.0, WC tags (`WC requires at least`, `WC tested up to`). Minimal reset (box-sizing, margin/padding zero on root elements). No layout CSS here — that lives in `assets/css/main.css`.

### functions.php
- Theme supports: `title-tag`, `post-thumbnails`, `html5`, `custom-logo`, `automatic-feed-links`, `align-wide`, `responsive-embeds`, `woocommerce`, `wc-product-gallery-zoom`, `wc-product-gallery-lightbox`, `wc-product-gallery-slider`.
- Register nav menus: `primary`, `footer`, `mobile`.
- Register sidebars (likely only blog).
- Enqueue: chosen font family/families (single combined Google Fonts URL, `font-display: swap`) — **font selection deferred to design system research; not preserving Marcellus + Open Sans**. Plus `main.css`, `main.js` (defer), `rtl.css` conditional on `is_rtl()`.
- `$content_width = 1140`.
- Load `inc/*.php`.
- `load_theme_textdomain('jlmwines', get_template_directory() . '/languages')`.

### header.php
- Hand-coded `<head>` with charset, viewport, `wp_head()`.
- Site header markup:
  - Custom logo
  - Primary nav (`wp_nav_menu` with WPML-aware walker)
  - WPML switcher (PHP — `wpml_active_languages` filter, **not** the Elementor widget)
  - Mini-cart icon with AJAX item count
  - Mobile menu toggle

### footer.php
- Newsletter (Mailchimp shortcode)
- Footer columns (menu, contact, legal)
- Copyright + mobile language switcher
- `wp_footer()`

### front-page.php
Custom homepage, **fully hard-coded.** No block patterns, no theme options panel — all content lives in the PHP template, edited via Claude when changes are needed. This is a single-website theme, not a distributed product.

Section inventory deferred until staging clone is up and the current Elementor homepage is captured. Likely sections: hero, featured categories, **bundle showcase** (currently whites + lighter reds), brand statement, recent posts, newsletter CTA.

### singular.php / page.php / single.php
Standard `the_content()` with proper article wrappers; post meta only on `single.php`; Rank Math schema hook points unobstructed.

### woocommerce.php
```php
<?php get_header(); ?>
<main id="content" class="site-main woocommerce-wrap">
    <?php woocommerce_content(); ?>
</main>
<?php get_footer(); ?>
```

### inc/woocommerce.php
- Remove default Woo wrappers, add theme-grid wrappers
- Customize product loop hooks (thumbnail, title, price, add-to-cart)
- My Account menu items / order
- Header mini-cart fragment refresh
- NIS price formatting if not already handled
- **Floating add-to-cart bar** on single-product pages: appears when the main add-to-cart scrolls out of view, contains product thumbnail + title + price + qty + add-to-cart. Built with Intersection Observer; sticky at bottom on mobile, top or bottom on desktop (decide).
- **Free shipping monitor:** progress component for cart and mini-cart. Reads the active free-shipping zone threshold from Woo, calculates remaining amount, renders a progress bar + message ("Add NIS X more for free shipping" / "You qualify for free shipping!"). Bilingual via WPML strings.
- **Bundle plugin compatibility hooks** — once the bundle plugin is identified, integrate any required template overrides.

### inc/wpml.php
- Custom language switcher render (`wpml_active_languages` filter)
- Menu sync helper notes (HE primary menu must exist)
- *(Note: theme strings are NOT registered here — they go through standard WP `__()` + `.po/.mo`. See WPML integration section.)*

### inc/theme-state.php
Theme state management — captures menu locations, theme-managed `wp_options`, and page → custom-template assignments to a versioned JSON file (`theme-state.json` in theme root). Provides an admin page (Tools submenu) with **Export** and **Import** buttons. Auto-imports on theme activation if `theme-state.json` is present and DB state is empty. Designed for the staging-refresh-from-live workflow: zip theme + export state before SG pull-from-live; unzip + import after. Eliminates the manual "remember to redo theme settings" step in the cutover and refresh cycles.

### assets/css/main.css
Hand-authored or compiled (Sass). CSS custom properties for tokens: colors, spacing scale, type scale. **Color palette + type scale come from the design system research (not preserving the existing dark/green look).** Mobile-first. No utility framework — site is small enough to author directly.

### assets/js/main.js
Vanilla JS only. Nav toggle, cart drawer open/close, smooth scroll. Defer loaded.

## Migration scope (Elementor → native)

Staging audit (2026-04-26) identified **16 Elementor-built pages** out of 18 total. Each becomes a custom PHP template in the new theme. Homepage is low-touch (rare edits), so hard-coded PHP is acceptable across the board.

| Page (ID) | New home |
|-----------|----------|
| Home Elegant (9019) | `front-page.php` |
| About (63644) | `page-about.php` |
| Send Wine Gifts in Israel (63724) | `page-send-wine-gifts.php` |
| Wine Talk / articles index (63813) | `page-articles.php` |
| Subscribed (63887) | `page-subscribed.php` |
| Privacy Policy (3), Terms (414), Cookie Policy (65832), Accessibility (65840) | `page-legal.php` (one template, switched by slug) |
| My Account (11), Cart (9), Shop (8), Order Tracking (14932), Thank You (2272), Order Error (2274) | Native Woo via `woocommerce.php` + Woo hook customizations |
| Favorites (10612) | Deleted (wishlist plugin dropped) |
| Wishlist (64610) | Deleted (wishlist plugin dropped) |
| Checkout (10) | Native Woo (already not Elementor) |

## WPML integration

**Translation workflow: standard WordPress i18n + theme `.po/.mo` files.** No ACF, no Gutenberg blocks for the homepage, no WPML String Translation UI. Both source strings and Hebrew translations are managed by Claude as version-controlled text files in `languages/`.

How it works:
1. PHP source uses `__()` / `_e()` everywhere with text domain `jlmwines`:
   ```php
   <h1><?php _e('Curated by Evyatar', 'jlmwines'); ?></h1>
   ```
2. Claude maintains:
   - `languages/jlmwines.pot` — source strings (English)
   - `languages/jlmwines-he_IL.po` — Hebrew translations
3. `.po` compiled to `.mo` (binary format WP reads) via `msgfmt` or a small Node helper. The compiled `.mo` ships in the theme.
4. Theme registers text domain in `functions.php`:
   ```php
   load_theme_textdomain('jlmwines', get_template_directory() . '/languages');
   ```
5. WPML switches the active locale; WordPress auto-loads the matching `.mo`.
6. WPML setting **"Theme and plugin localization → use theme's .mo files"** — tells WPML to defer to standard WP i18n for theme strings instead of intercepting them. Clean separation.

**What WPML still does (and is required for):**
- Language switcher rendered via `wpml_active_languages` filter (PHP, not Elementor widget)
- Per-language URL routing (`/he/...` etc.)
- Per-language menus (HE menu / EN menu, sync via WPML)
- WooCommerce Multilingual: product titles, descriptions, attributes, taxonomies
- Per-language SEO meta (Rank Math + WPML SEO)
- `is_rtl()` flips CSS direction automatically

**What does NOT go through WPML String Translation UI:**
- Theme strings (handled by `.po/.mo`)
- Hard-coded page content (handled by `.po/.mo`)

**Seed `.po` from existing WPML translations — do not retranslate from scratch.**

WPML String Translation has accumulated years of Hebrew translations across the existing theme, Elementor, and plugin strings. Many will overlap with the new theme's strings (common UI: "Add to cart", "Free shipping", section headings, footer text, error messages, etc.). The migration must harvest these, not redo them.

Workflow:
1. **Before cutover, export WPML String Translation to `.po`.** WPML admin has a built-in "Export & Import" feature in String Translation that produces a `.po` file per language across all registered domains. Run this on production and save as `languages/wpml-export-he_IL.po` (reference, not shipped).
2. **Generate the new theme's `.pot`** from `__()` calls in the new templates (standard `xgettext` or `wp i18n make-pot` from WP-CLI).
3. **`msgmerge` the WPML export into the theme's `.po`.** Any source string that matches verbatim auto-populates with the existing Hebrew translation. Anything new stays untranslated and goes onto a short list to translate manually.
4. **Review fuzzy matches.** `msgmerge` flags near-matches (slight wording differences) as "fuzzy" — review each one; either accept the existing translation if the meaning is identical, or retranslate.
5. **Compile `.po` → `.mo`** as part of the theme build.

The harvest step is cheap and only runs once. Skipping it would mean retranslating dozens to hundreds of already-translated strings, plus risking voice drift on phrases that have been in production for years and customers are used to seeing.

**What still uses standard WPML page translation (database content):**
- Blog posts (already managed via the existing API push pipeline — HE+EN posts pushed separately)
- Any page that genuinely uses the Gutenberg editor (none planned for now — all 16 Elementor pages convert to PHP templates)

**WPML setup review (during staging audit) — look for improvements:**

The current WPML configuration has been in place for years; before the cutover is a good moment to look for misconfigurations or under-used features.

- **URL structure** — currently subdirectory (`/he/`)? Subdomain? Parameter? Confirm and decide whether to change. (Changing post-launch breaks SEO; if it's wrong now, fix during the cutover.)
- **Default language** — HE or EN? Affects what shows at the bare domain root. Verify intentional.
- **Translation completeness audit:**
  - Product titles + descriptions (every product translated?)
  - Categories, tags, attributes (and attribute values)
  - Product short descriptions
  - Custom fields used in product display
  - Pages: About, contact, shipping, returns, FAQs
  - Menu items
  - Theme strings
  - Plugin strings (age verification messages, free shipping monitor messages, Mailchimp form labels, etc.)
- **Hreflang** — Rank Math + WPML should emit hreflang tags. Verify in page source on a product and a category page.
- **Per-language SKU / pricing** — typically the same SKU across languages. Confirm not accidentally duplicated.
- **Translation method** — manual vs WPML's "Translate Everything" auto-translation. If manual is the bottleneck, evaluate the auto option (paid credits, but may unlock content velocity).
- **Media translation** — are images translated per-language (different image per language)? For product images this is rarely needed; for marketing/blog images sometimes useful.
- **Search behavior** — does Woo search return both languages or only the active one? Should be active-only.
- **Performance** — WPML adds query overhead. Confirm SG Optimizer cache treats per-language URLs as separate cache entries.
- **Compatibility flags** — any plugins on the keep list need explicit WPML compat (`wpml-config.xml` registration)? Bundle plugin in particular.

Audit produces a punch list; fixes happen on staging before cutover so the new theme launches with WPML in better shape than today.

**Source-string discipline (lock copy + canonicalize labels BEFORE the `.po` harvest):**

Two cleanup items that must happen before strings are extracted, otherwise Hebrew translations have to be redone:

1. **Free-shipping monitor copy lock.** English text in `inc/free-shipping.php` (strip + cart variants) was drafted quickly during the v1.0.8 build. Review and finalize wording before extraction.
2. **Canonical UI labels per language.** Common labels (Cart, Shop, Account, Search, Read more, etc.) currently come from a mix of theme strings, WC textdomain, and plugin defaults. Pick one canonical translation per language for each label and pin it in WPML String Translation. Theme code uses the canonical English source string with the appropriate textdomain (`woocommerce` where WC owns it, `jlmwines-theme` where we do) so the translation flows through automatically.

Both items run before the `.po` harvest pass listed in WPML setup review.

## Rank Math integration

Plugin-driven, theme-agnostic. Should work without theme changes. Verify after cutover:
- Meta titles/descriptions render
- Schema markup (product, breadcrumbs) intact
- Sitemap unchanged at `/sitemap_index.xml`
- Breadcrumb output via `<?php if (function_exists('rank_math_the_breadcrumbs')) rank_math_the_breadcrumbs(); ?>`

## Build approach (staging)

1. **Clone production to fresh staging** (staging7, or refresh staging6). Recent DB + uploads, all current plugins active. This is the workbench.
2. **Inventory pass (before any code):**
   - List every page with `_elementor_data` meta
   - List every active plugin; categorize keep / drop / decide
   - Capture homepage screenshots (desktop + mobile, EN + HE) for design reference
3. **Build theme in `wp-content/themes/jlmwines-theme/`** on staging. Do not activate yet — keep KoWine + Elementor running so the site stays functional.
4. **Iterative compare:** activate the new theme on a single test page (or use a developer query var); compare render to the Elementor version; refine.
5. **Migrate Elementor pages to Gutenberg** while still on staging.
6. **Activate `jlmwines-theme` on staging.** Run verification checklist.
7. **Deactivate** Elementor Pro → Elementor → Wpbingo Core → Redux Framework → kowine-child → KoWine, in order. Re-run verification.
8. **Final regression pass:** desktop + mobile, EN + HE, full purchase flow.
9. **Cutover to production** (see Cutover section).

## Periodic staging refresh pattern

All work happens on staging (staging6). Throughout the build, refresh staging from live periodically to pull in new prod orders/customers/sessions. Order pace is slow (hours to days between orders) so the refresh window is forgiving — no race against time.

**Refresh cycle:**

1. Zip the in-progress theme directory (`wp-content/themes/jlmwines-theme/`)
2. Export theme state via the admin Export button → updates `theme-state.json`
3. SG Manager → **Pull from live** (refreshes staging DB + files from current production)
4. Unzip the theme back into `wp-content/themes/`
5. Activate `jlmwines-theme` — auto-imports `theme-state.json`, or use the manual Import button
6. Re-push migrated post content: `node content/push-posts.js --target=staging`
7. Resume work

`theme-state.json` and version-controlled `.post.md` files mean the only manual artifact to track across refresh is the theme zip itself. Refresh is cheap; do it whenever staging starts to feel out of sync with live.

## Verification checklist (after staging activation)

Run twice: desktop (~1200px), then mobile (~375px). Run for both EN and HE.

**Templates**
1. Header: logo, nav, switcher, cart icon
2. Footer: newsletter, columns, switcher
3. Homepage: all sections render, CTAs link correctly
4. Shop archive: product grid, filters, sort, pagination
5. Single product: gallery (zoom/lightbox/slider), add-to-cart, related products, reviews
6. **Floating add-to-cart bar** appears on scroll, hides when main add-to-cart is in view
7. **Free shipping monitor** in cart and mini-cart shows correct remaining amount; flips to "qualified" message at threshold
8. **Bundle products** render and add to cart correctly
9. Cart → Checkout → My Account flow
10. Blog index + single post (existing API-driven HTML posts)
11. About page (clean HTML)
12. Search results, 404

**Cross-cutting**
13. WPML language switching on every page type
14. Hebrew pages render RTL
15. Rank Math meta titles/descriptions correct
16. Rank Math schema (product, breadcrumbs) intact
17. Sitemap unchanged
18. Age verification popup triggers
19. WhatsApp floating button visible
20. Mailchimp newsletter form submits
21. Woo built-in coupons work at checkout (Smart Coupons Pro removed)
22. SG Optimizer caching engaged
23. Mobile nav opens/closes
24. Mini-cart AJAX fragments update

**Performance** (per protocol below)
25. Performance acceptance protocol (see "Performance acceptance protocol" section) all-green
26. No Elementor CSS/JS in page source
27. No KoWine references in page source

## Performance acceptance protocol

**Initial protocol — locked 2026-04-27. Review periodically with user.**

### Tool

- **Scorecard:** PageSpeed Insights (`pagespeed.web.dev`) — public-facing score, includes lab + field CrUX.
- **Iteration during build:** Lighthouse CLI (`lighthouse --preset=desktop` / mobile default), median of 3 runs per URL. Reproducible across machines, faster feedback loop than PSI.

### Profile

- **Mobile:** primary, binding constraint. Lighthouse default throttling (Slow 4G: 1.6 Mbps down, 750 Kbps up, 150 ms RTT) + Moto G4 CPU throttling.
- **Desktop:** secondary. Must pass too, but mobile is harder so passing mobile usually means desktop passes.
- **Cache state:** warm server (visit each URL once before measurement to populate SG Optimizer cache), cold browser (Lighthouse default — incognito-like, no browser cache).

### URLs measured (8 per pass)

| Page type | EN URL | HE URL |
|---|---|---|
| Homepage | `/` | `/he/` |
| Shop archive | `/shop/` | `/he/shop/` |
| Single product | (highest-traffic single product, locked at audit) | (HE equivalent) |
| Single bundle | (highest-traffic bundle, locked at audit) | (HE equivalent) |

Bundle is on the list because the WPC Bundles plugin can add weight; that risk gets measured rather than assumed away. Both languages because Hebrew loads different fonts and RTL CSS.

### Pass thresholds (lab — all must pass on all 8 URLs)

| Metric | Threshold |
|---|---|
| Lighthouse Performance score | ≥ 90 |
| LCP (Largest Contentful Paint) | < 2.5s |
| INP (Interaction to Next Paint) | < 200ms |
| CLS (Cumulative Layout Shift) | < 0.1 |

### Field confirmation

After cutover, watch CrUX for 30 days. CrUX updates daily, reflects 28-day trailing window. Field pass = same four metrics in "Good" band per Google's Core Web Vitals Assessment.

### Ship-ready definition

**Lab green = ship-ready.** Field watch is post-cutover confirmation, not a launch gate. (Holding the launch on a 28-day field window would defer indefinitely; lab is the actionable gate.)

### Baseline (verified 2026-04-15, current site, post-SG-tuning)

| Metric | Mobile (current) | Desktop (current) | Target |
|---|---|---|---|
| LCP | 7.2s lab / 2.9s field | (similar lab) / 3.2s field | < 2.5s |
| FCP | 3.9s | 2.8s field | passing CWV |
| TTFB | 2.1s field (Poor) | 2.5s field (Poor) | < 800ms |
| CLS | 0.005 lab / 0 field | 0.005 lab / 0.15 field | < 0.1 |
| Performance score | not captured | not captured | ≥ 90 |

Both mobile and desktop currently fail the Core Web Vitals Assessment. Theme replacement should bring both into the green band per the diagnosis (1,460 ms render-block + 226 KiB unused CSS = structural Elementor/KoWine cost).

### Periodic review

Review this protocol with user at the following points; adjust thresholds, URLs, or tool selection as needed:

1. **Before staging build starts** — confirm initial protocol stands or refine
2. **At staging activation** — first measurement run; review whether thresholds are realistic given what the theme actually achieves
3. **At cutover decision** — final lab measurement; ship-or-iterate decision
4. **30 days post-cutover** — field CrUX results; if not green, decide whether further work is needed

If the build phase runs longer than expected, add a midpoint review.

## Cutover & deployment

Single-push cutover via SiteGround's **staging-to-live** mechanism. Staging carries the full target state — theme files, active theme, plugin activation state, post content, options, all DB tables — so push-to-live is atomic. Order frequency is low (hours to days between orders), so the cutover window is forgiving; if an order lands during the window, refresh staging again and redo the push.

Plugin deactivations (Elementor stack, KoWine, WP File Manager, WPC Smart Wishlist, Contact Form 7 + WPML for CF7, Smart Coupons Pro) all happen during the staging build phase (Build approach step 7) and arrive on live as part of the push-to-live state transfer. No wp-admin click sequence at cutover.

1. All staging verification green (per checklist)
2. **Production backup** via SG Manager (kept for rollback)
3. **Final refresh cycle on staging:**
   - Zip theme files
   - Export `theme-state.json`
   - SG Pull staging from live (capture latest prod orders/customers)
   - Unzip theme back
   - Activate `jlmwines-theme` → auto-imports state (or manual Import)
   - Re-push posts: `node content/push-posts.js --target=staging`
4. Quick re-verification on staging: homepage, shop, single product, cart → checkout flow, both EN+HE
5. **SG push staging → live** (atomic transfer of files + DB)
6. **Smoke test on live:** homepage, shop, one product, add to cart, view cart, both EN+HE
7. Clear SG Optimizer cache; monitor 24–48h
8. **Week 2 — staged Jetpack removal:** audit module usage; if nothing depends on it, deactivate Jetpack
9. **DB cleanup pass** (run after 48h of stable operation, with a fresh SG backup taken first). Run on a freshly refreshed staging clone first, then on production. Illustrative queries:
   ```sql
   -- Elementor postmeta (every page that was ever Elementor-built)
   DELETE FROM wp_postmeta WHERE meta_key LIKE '\_elementor%' ESCAPE '\\';
   -- KoWine + Wpbingo + Redux options
   DELETE FROM wp_options WHERE option_name LIKE '%kowine%';
   DELETE FROM wp_options WHERE option_name LIKE '%wpbingo%';
   DELETE FROM wp_options WHERE option_name LIKE '%redux%';
   -- Smart Coupons custom tables (exact names from audit)
   DROP TABLE IF EXISTS wp_smart_coupons_*;
   -- Orphan transients
   DELETE FROM wp_options WHERE option_name LIKE '\_transient_%' ESCAPE '\\';
   ```
10. **Rollback:** SG Manager → Restore from the backup taken in step 2. Steps 1–8 are reversible via this restore; step 9 (DB cleanup) is not, hence the 48-hour soak before running it.

**If an order lands in the cutover window** (between step 5 and step 6 verification): repeat from step 3 — staging refresh + re-apply + push again. Cheap to retry given low order frequency.

## Decisions locked in (2026-04-26)

- Smart Coupons Pro: **dropped** (already gone from staging); replaced by Woo built-in coupons.
- Bundles: **kept — CRITICAL, must work day one** (WPC Product Bundles for WooCommerce Premium 8.5.1).
- Wishlist: **dropped** (WPC Smart Wishlist).
- WP File Manager: **dropped** (likely a KoWine requirement, security risk).
- Contact Form 7 + WPML for CF7: **dropped** (already inactive; KoWine artifact).
- Jetpack: **dropped post-cutover** in week 2, after module audit (not at cutover — may be providing services the site depends on).
- Ally accessibility plugin: **kept**, but verify standalone operation after Elementor is deactivated; replace if it requires Elementor.
- WhatsApp button + Age verification: **rebuilt as theme-side components** (currently Elementor features).
- Homepage: **hard-coded** in `front-page.php`; rare edits, all via Claude. No block patterns, no ACF, no theme options panel.
- All 16 Elementor pages: **hard-coded as custom PHP page templates**. Both English source and Hebrew translation managed by Claude as `.po/.mo` files. No ACF Multilingual, no WPML String Translation UI.
- Translation mechanism: **standard WordPress i18n** (`__()` + `.po/.mo` files in `languages/`). WPML defers to theme's `.mo` files via "Theme and plugin localization" setting.
- Design: **clean break** — colors and fonts are NOT preserved from current site. Design system researched fresh against speed/clarity/conversion/brand goals.
- WPML: **100% required** at cutover; non-negotiable. Hreflang bug to fix at cutover (currently missing from page source).

## Next actions (before build starts)

1. ~~**Audit staging site**~~ — **DONE 2026-04-26.** Report at `STAGING_AUDIT_2026-04-26.md`. Plugin inventory, theme inventory, 16 Elementor pages identified, product image baseline captured. Plugin decisions locked in (above).
2. **Design system research** — invoke `frontend-design` skill. Output: a design specification document + a small set of reference HTML/CSS components (product card, hero section, CTA bar, free shipping monitor, floating add-to-cart, footer) that establish the bilingual font system, color palette, spacing scale, and visual language. **This is the next step.**
3. **CSS audit follow-up** — fetch the actual loaded stylesheets on staging to extract the real current font weights and color tokens (the inline-CSS pass in the staging audit was thin, partly capturing HTML entities as colors). Useful as reference but not as source of truth (we're not preserving them).
4. ~~**Verify Ally accessibility plugin works without Elementor**~~ — **DONE 2026-04-27.** Theme switch test: Ally icon disappeared (visible widget likely rendered or styled by KoWine/Elementor) but tab-key accessibility still worked. Ally's site confirms theme-agnostic, no Elementor dependency. Build-phase note: ensure new theme's `footer.php` calls `wp_footer()` so Ally's icon renders; verify icon visibility during Phase 7 verification.
5. **WPML setup review** — apply the audit checklist (URL structure, default language, translation completeness, hreflang fix). Punch list of improvements applied on staging before cutover.
6. **Production backup** snapshot before cutover scheduling.
