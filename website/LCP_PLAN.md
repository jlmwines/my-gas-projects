# Site Speed Plan (sales funnel)

Plan to make every page on the site load fast, starting with the pages a buyer passes through, measured as LCP under 2.5s and CLS under 0.1 on mobile. Home page work is done (score 90, FCP 1.2s, lab LCP ~3.5s). Funnel-wide steps F1-F7 below are planned, not started. Each step is one change, measured before the next; theme steps are live deploys (no staging) and need explicit user OK.

## The funnel and where it stands

Buyers land on home EN/HE, product pages (Search Console's top pages after home), blog posts and `/he/about/`. They then go to shop, product, cart and checkout (Cardcom). GA4 currently exports site totals only (about 1,150 sessions and 22 key events a month), so per-page speed comes from lab tests until F7 adds real-visitor data.

Read-only probes, 2026-11-05 (logged out, from Israel):

- **Pages wait ~0.6s for the first byte.** The server page cache works, but the base CDN only caches static files, so each page makes a round trip from the CDN edge to the server in Europe (F1).
- **Product photo is lazy-loaded.** The main product image (`wp-post-image`) ships as a placeholder GIF with `data-src` and loads only after SiteGround's `lazysizes` script runs. WebPageTest (Europe) bundle page: FCP 1.7s, LCP 3.3s, versus home LCP 1.5s.
- **Fonts.** Rubik is served as 4 `.ttf` weights from fonts.gstatic.com, inlined by SiteGround's "Combine Google Fonts" (no woff2, extra connection).
- **Cart/checkout** take about 2.0s before the first byte (uncacheable by design).
- **Blocking CSS.** Product and shop pages wait on 4-8 stylesheets (WooCommerce, photoswipe, bundles plugin, `main.css`); the home page waits on none.
- **Prefetch.** WordPress speculation rules are present at core's default eagerness.

## Constraints

- The live JS optimizer strips inline `<script>` from rendered markup; theme JS belongs in `main.js` (`website/CLAUDE.md`).
- Verify with `curl` or a `?x=` query string, not a plain reload.
- Shop/category/cart/checkout need WooCommerce's classic CSS; any CSS removal is scoped per route and verified there (`inc/enqueue.php` dequeue history).
- Measure with WebPageTest from Europe (server is in Europe; PageSpeed tests from the US and swings run to run), median of 3 runs per page.

## Funnel steps (highest leverage first)

**F1. Serve cached pages from the CDN edge (decision: Premium CDN).** The server page cache works: behind SiteGround's base CDN, pages always report `x-proxy-cache: MISS` / `sg-f-cache: BYPASS` (SiteGround support, 2026-11-05), so check by timing, not headers. Measured 2026-11-05 (median of 5, `/he/`): cached page 0.6s, forced-uncached (unique query) 1.07s, static file from the CDN edge 0.07s. The base CDN caches static files only (`x-cdn-c: static`), so every page still makes the ~0.5s trip from the edge to the server in Europe. Premium CDN caches pages at the edge too, which should bring cacheable pages to roughly 0.1s. No effect on cart/checkout. User decides on cost. Exclusions are checkout and wp-admin (favorites removed 2026-11-05, unused).

**F2. Load the main product image immediately.** Exclude it from SiteGround lazy load (Speed Optimizer → Media → exclusions, class `wp-post-image`; theme filter if the setting can't). Give it `fetchpriority="high"`, same pattern as the hero (`jlmwines_hero_image_sources()` in `inc/enqueue.php`). Same for the first row of shop/category thumbnails. Blog posts have the same problem (the `post-hero-image wp-post-image` featured image is lazy-loaded), so the same class exclusion fixes them. Expected product and blog LCP ~1.5-2s. Status: lazy-load exclusion done 2026-11-05 (Speed Optimizer setting, class `wp-post-image`); live product and blog images now load with a real `src`. After (WebPageTest Europe mobile, warm cache, single run, bundle page): FCP 1.7s, LCP 2.9s, TTFB 0.65s, CLS 0.065. The earlier 3.3s run's settings are uncertain, so this is the new baseline. Still open: `fetchpriority="high"` on the main image (small theme filter) and the shop thumbnail row.

**F3. Self-host fonts.** Rubik woff2 (Hebrew + Latin subsets) in the theme, only the weights in use, body weight preloaded; turn off Combine Google Fonts.

**F4. Profile cart and checkout.** Query Monitor (admin-only, temporary) to find slow hooks (likely WPML, bundles plugin, Complianz); confirm PHP version and Memcached. Target first byte under 0.8s.

**F5. Prefetch on hover.** Speculation rules eagerness `moderate`; exclude cart, checkout, add-to-cart and logout URLs. With F1 done, the next funnel page opens near-instantly.

**F6. Critical CSS for every template.** Extend `website/critical-css.js` (the home page method, step 3 below) template by template, which covers every page on the site: product, shop/category, single post, standard page (about, contact, FAQ and other top-level pages), then cart/checkout last (highest risk). Posts and pages wait on 6 stylesheets today; load photoswipe and bundle CSS without blocking.

**F7. Measure real visitors.** Send LCP/INP/CLS from `main.js` (web-vitals library, ~2 KB) to GA4 as events tagged with page type and EN/HE. Replaces the missing CrUX field data; OPS can later fold it into `jlmops-status.md`.

**Parked: defer jQuery** (home step 4 below). Checkout risk; revisit only if real-visitor data shows it matters.

## Home page steps (done unless noted)

**0. Baseline.** Mobile LCP element is the hero photo (`evyatar-cohen-09.jpg.webp`, ~35 KB). Images were not the problem; render-blocking `<head>` work was.

**1. Logo stops claiming high priority.** `get_custom_logo_image_attributes` filter in `inc/enqueue.php` sets the logo to `fetchpriority="auto"`; the hero is the only high-priority image.

**2. Plugin stylesheets.** WPML switcher CSS stripped at tag output (`style_loader_tag`), its 6 rules at the top of `main.css`. Complianz and accessibility-widget stylesheets load via `media="print"` onload swap with `<noscript>` fallback.

**2b. Image delivery.** (a) Done: logo `sizes="48px"`. (b) Hero picks the 760w file on mobile; acceptable. (c) Open: below-the-fold images without srcset (`evyatar-cohen-10.png` 68 KB, footer `evyatar-at-the-vineyard-1200.828.jpg` 167 KB, popup avatar `evyatar-cohen-04.jpg` 30 KB at 40px); lazy, so not LCP-critical.

**3. Critical CSS.** `website/critical-css.js` drives headless Chrome over EN/HE home at mobile and desktop widths and keeps every `main.css` rule touching the first screen or a hidden element, giving `assets/css/critical-home.css` (165 of 567 rules). Inlined at `wp_head` priority 1, front page only; `main.css` via print-media swap. Verified pixel-identical first screens on all four views. Regenerate when the header or hero layout changes.

**3b. Hero preload.** `<link rel="preload" as="image" imagesrcset imagesizes fetchpriority="high">` built from `jlmwines_hero_image_sources()`, shared with `front-page.php` so preload and `<picture>` select the same file. LCP stayed ~3.5s in PageSpeed's simulated slow connection (the photo competes with jQuery, wp-hooks/i18n and fonts).

**4. Defer jQuery.** Not done (parked, see above). Would include `wp-hooks` and `wp-i18n` (synchronous chain, 1,485 ms critical path). Needs a full list of jQuery-dependent scripts on home, shop, product, cart and checkout, and a checkout test with Cardcom before any change.

## Verification (every step)

- F1: a cached page responds in about the same time as a static file (~0.1s), median of 5 requests. Headers are not a reliable check behind the CDN.
- WebPageTest Europe, median of 3, before and after: home EN/HE, shop, a wine product, a bundle, a blog post, cart.
- After any theme step: add to cart, mini-cart qty/remove, checkout to the Cardcom page, cookie banner, newsletter popup, EN and HE.

## Done when

Median mobile LCP under 2.5s and CLS under 0.1 on every funnel page, verify lists pass, and F7 reports real-visitor data. Then record the final approach in `plans/THEME_FOUNDATIONS.md` (performance section), update the Mobile PageSpeed row in `plans/STATUS.md`, and archive this plan.
