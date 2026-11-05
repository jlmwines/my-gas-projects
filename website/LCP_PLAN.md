# Mobile LCP Plan

Plan to bring mobile LCP on jlmwines.com from 3.9s to under 2.5s (Google's "good" mark). Status: **in progress**: steps 0-3b and 2b(a) done (score 90, FCP 1.2s after step 3); step 4 next if LCP is still over 2.5s. Each step below is one live theme deploy, measured before the next starts.

## Where we are

Mobile PageSpeed on 2026-11-05 (homepage, user run): score 86, FCP 1.8s, LCP 3.9s, Speed Index 3.7s. FCP dropped from ~3.5s after Memcached was turned on the same day; LCP barely moved (~4.2s before).

Images are not the problem. The hero (`evyatar-cohen-09.jpg`) and the logo both serve as WebP at about 35 KB each. The gap is render-blocking work in `<head>`. On a mobile load the browser must fetch these before it paints anything:

- `jquery.min.js` (synchronous, in head). SiteGround Speed Optimizer already combines and defers the rest of the site JS, but leaves jQuery blocking.
- 7 stylesheets: theme `main.css` (27 KB), WPML language switcher x2 (`legacy-list-horizontal`, `menu-item`), Complianz `cookieblocker.min.css` and `banner-1-optin.css`, accessibility plugin `fonts.css` and `skip-link.css`.

Also, two images on the homepage ask for `fetchpriority="high"`: the hero (set in `front-page.php`) and the header logo (added automatically by WordPress, which treats the 512x512 logo as the main image). They compete for first place in the download queue.

The mobile LCP element is the hero photo (confirmed in PageSpeed, step 0).

## Constraints

- Theme deploy is live (no staging); each deploy needs explicit user OK.
- The live JS optimizer strips inline `<script>` from rendered markup; theme JS belongs in `main.js` (`website/CLAUDE.md`).
- Pages are full-page-cached; verify with `curl` or `?x=1`, not a plain reload.
- Homepage-first. The existing dequeue code in `inc/enqueue.php` learned the hard way that shop/category/cart/checkout need WooCommerce's classic CSS; any CSS removal is scoped to the front page unless verified per route.
- Measure each step with PageSpeed mobile, at least 3 runs, and record the median (single runs vary).

## Steps (lowest risk first)

**0. Baseline and LCP element.** Baseline recorded 2026-11-05 (3rd run, EN and HE identical): FCP 1.8s, LCP 4.1s, Speed Index 2.5s. PageSpeed render-blocking list (pre-step-2): 8 files, 70 KiB, est. 3,620 ms; `main.css` 900 ms, jQuery 600 ms, the 6 plugin stylesheets 150-450 ms each. LCP element: the hero photo (`evyatar-cohen-09.jpg.webp`, already eager + `fetchpriority="high"`), so step 1 applies.

**1. Logo stops claiming high priority.** Done, theme v1.2.35 live 2026-11-05: `get_custom_logo_image_attributes` filter in `inc/enqueue.php` sets the logo to `fetchpriority="auto"`; live HTML confirms the hero is now the only high-priority image. Result: EN LCP 4.1s → 3.9s after cache purge (small, within run-to-run noise). As expected, the remaining delay is render-blocking.

**2. Drop or defer plugin stylesheets.** Done, theme v1.2.36 live 2026-11-05 (site-wide). WPML registers its switcher CSS after our dequeue runs, so both files are stripped at tag output (`style_loader_tag` in `inc/enqueue.php`); the menu-item switcher's 6 rules live at the top of `main.css` (top keeps the original cascade order). Complianz (2) and accessibility-widget (2) stylesheets load via `media="print"` onload swap with a `<noscript>` fallback. Live homepage now has `main.css` as its only blocking stylesheet. Result (with 2b logo fix, v1.2.37): mobile FCP 1.5s, LCP 3.6s; switcher, cookie banner and popup verified by user.

**2b. Image delivery (PageSpeed "Improve image delivery").** Not LCP-critical except the hero, but flagged by PageSpeed. Findings 2026-11-05: (a) logo displays at 48px tall but its `sizes` attribute says "100vw up to 512px", so phones download the 512px file (33 KB) instead of the 100px variant; fix by setting `sizes` in the existing `get_custom_logo_image_attributes` filter. (b) hero on mobile picks the 760w file because the 599w variant is just under the needed width; acceptable, revisit only if PageSpeed still flags it after (a). (c) below-the-fold images hardcoded without srcset: `evyatar-cohen-10.png` (68 KB, `front-page.php`/`template-homepage.php`), footer newsletter `evyatar-at-the-vineyard-1200.828.jpg` (167 KB, `footer.php`), popup avatar `evyatar-cohen-04.jpg` shown at 40px (30 KB, `inc/exit-intent-popup.php`). These are lazy-loaded so they don't affect LCP; fix by switching to sized variants. Status: (a) done, theme v1.2.37 live 2026-11-05 (logo `sizes="48px"`); (c) open.

**3. Critical CSS for `main.css`.** Done, theme v1.2.38 live 2026-11-05: `website/critical-css.js` drives headless Chrome over the live EN/HE homepage at mobile and desktop widths and keeps every `main.css` rule that touches the first screen or a hidden element, giving `assets/css/critical-home.css` (23 KB raw, 165 of 567 rules). Verified by swapping `main.css` for the critical file: first-screen screenshots pixel-identical on all four (EN/HE x mobile/desktop), with and without the age gate; empty-CSS control differs 22-37%. Front page only; inlined at `wp_head` priority 1, `main.css` via print-media swap. Live homepage render after deploy pixel-identical to before (all four views). Result: pending user PageSpeed rerun. Original approach notes: Inline the small set of rules the first mobile screen needs (header, hero, fonts) in `<head>`, and load the full `main.css` without blocking. Biggest CSS win, moderate risk: a missed rule shows as a brief unstyled flash. Generate the critical set once, keep it in a theme file, and note that it needs regenerating when the header or hero layout changes. Verify: no flash on EN/HE mobile and desktop, CLS stays under 0.1.

**3b. Preload the hero photo.** Added after step 3: score reached 90, FCP 1.2s, but LCP stayed 3.5-4.1s. PageSpeed's LCP breakdown (HE, observed): TTFB 0, resource load delay 660 ms, load duration 10 ms, render delay 120 ms. So the photo is discovered late (it sits deep in the HTML), not slow to download. Fix: `<link rel="preload" as="image" imagesrcset imagesizes fetchpriority="high">` in `<head>` on the front page, built from a shared helper (`jlmwines_hero_image_sources()` in `inc/enqueue.php`) that `front-page.php` also uses, so preload and `<picture>` always select the same file. Done, theme v1.2.39 live 2026-11-05: preload is the 3rd element in <head>; headless Chrome (EN/HE, mobile/desktop) shows the hero requested exactly once and it is the same file the <img> renders. Result: pending user PageSpeed rerun.

**4. Defer jQuery.** Move jQuery out of the blocking path (SiteGround Speed Optimizer exclusion settings, or the theme marking it deferred in the footer). Highest risk: anything that runs jQuery code before it loads breaks silently. Include `wp-hooks` and `wp-i18n`: PageSpeed's network dependency tree shows them as a synchronous chain (page → hooks.min.js → i18n.min.js, 1,485 ms critical path, 2026-11-05). Before changing, list every script that depends on jQuery or these two on homepage, shop, product, cart and checkout. Verify: add to cart, mini-cart qty/remove, checkout with Cardcom, cookie banner, newsletter popup, EN and HE. If checkout is affected at all, scope the defer to non-checkout routes.

## Done when

Median mobile LCP under 2.5s on EN and HE homepages, CLS under 0.1, and the step 3 and 4 verify lists pass. Then update the Mobile PageSpeed row in `plans/STATUS.md`, record the final approach in the theme's system doc (`plans/THEME_FOUNDATIONS.md` performance section), and archive this plan.

If LCP stays above 2.5s after step 4, stop and re-measure before trying anything else; the remaining time may be server response (TTFB about 0.66s from Israel) rather than page weight.
