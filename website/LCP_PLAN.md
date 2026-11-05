# Mobile LCP Plan

Plan to bring mobile LCP on jlmwines.com from 3.9s to under 2.5s (Google's "good" mark). Status: **draft, not started** (2026-11-05). Each step below is one live theme deploy, measured before the next starts.

## Where we are

Mobile PageSpeed on 2026-11-05 (homepage, user run): score 86, FCP 1.8s, LCP 3.9s, Speed Index 3.7s. FCP dropped from ~3.5s after Memcached was turned on the same day; LCP barely moved (~4.2s before).

Images are not the problem. The hero (`evyatar-cohen-09.jpg`) and the logo both serve as WebP at about 35 KB each. The gap is render-blocking work in `<head>`. On a mobile load the browser must fetch these before it paints anything:

- `jquery.min.js` (synchronous, in head). SiteGround Speed Optimizer already combines and defers the rest of the site JS, but leaves jQuery blocking.
- 7 stylesheets: theme `main.css` (27 KB), WPML language switcher x2 (`legacy-list-horizontal`, `menu-item`), Complianz `cookieblocker.min.css` and `banner-1-optin.css`, accessibility plugin `fonts.css` and `skip-link.css`.

Also, two images on the homepage ask for `fetchpriority="high"`: the hero (set in `front-page.php`) and the header logo (added automatically by WordPress, which treats the 512x512 logo as the main image). They compete for first place in the download queue.

Not yet known: which element Google counts as the mobile LCP (hero photo or hero headline text). Step 0 settles it, because it changes which fix matters most.

## Constraints

- Theme deploy is live (no staging); each deploy needs explicit user OK.
- The live JS optimizer strips inline `<script>` from rendered markup; theme JS belongs in `main.js` (`website/CLAUDE.md`).
- Pages are full-page-cached; verify with `curl` or `?x=1`, not a plain reload.
- Homepage-first. The existing dequeue code in `inc/enqueue.php` learned the hard way that shop/category/cart/checkout need WooCommerce's classic CSS; any CSS removal is scoped to the front page unless verified per route.
- Measure each step with PageSpeed mobile, at least 3 runs, and record the median (single runs vary).

## Steps (lowest risk first)

**0. Baseline and LCP element.** Run PageSpeed mobile 3 times on the EN and HE homepages; record median LCP and the "Largest Contentful Paint element" shown in the report. No code change.

**1. Logo stops claiming high priority.** Filter the custom-logo image attributes so the logo gets `fetchpriority="auto"`, leaving the hero as the only high-priority image. Tiny change, near-zero risk. Matters most if the LCP element is the hero photo.

**2. Drop or defer plugin stylesheets on the homepage.** The theme already tries to sweep the two WPML switcher stylesheets (pattern list in `inc/enqueue.php`), but they still print, so WPML adds them some other way; find the real hook and remove them if the header switcher still looks right without them. Load Complianz and accessibility-plugin CSS without blocking (`media="print" onload` swap) if their UI is unaffected; otherwise leave them. Verify: header language switcher, cookie banner, accessibility widget, EN and HE.

**3. Critical CSS for `main.css`.** Inline the small set of rules the first mobile screen needs (header, hero, fonts) in `<head>`, and load the full `main.css` without blocking. Biggest CSS win, moderate risk: a missed rule shows as a brief unstyled flash. Generate the critical set once, keep it in a theme file, and note that it needs regenerating when the header or hero layout changes. Verify: no flash on EN/HE mobile and desktop, CLS stays under 0.1.

**4. Defer jQuery.** Move jQuery out of the blocking path (SiteGround Speed Optimizer exclusion settings, or the theme marking it deferred in the footer). Highest risk: anything that runs jQuery code before it loads breaks silently. Before changing, list every script that depends on jQuery on homepage, shop, product, cart and checkout. Verify: add to cart, mini-cart qty/remove, checkout with Cardcom, cookie banner, newsletter popup, EN and HE. If checkout is affected at all, scope the defer to non-checkout routes.

## Done when

Median mobile LCP under 2.5s on EN and HE homepages, CLS under 0.1, and the step 3 and 4 verify lists pass. Then update the Mobile PageSpeed row in `plans/STATUS.md`, record the final approach in the theme's system doc (`plans/THEME_FOUNDATIONS.md` performance section), and archive this plan.

If LCP stays above 2.5s after step 4, stop and re-measure before trying anything else; the remaining time may be server response (TTFB about 0.66s from Israel) rather than page weight.
