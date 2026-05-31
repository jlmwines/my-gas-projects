# Theme String Audit

**Created:** 2026-04-30
**Scope:** Customer-facing strings in `website/jlmwines-theme/`. Inventory only — no code changes.
**Source:** Greps across all `.php` and `.js` in the theme tree (24 files).

This doc has three jobs:
1. **Section B — Free-shipping monitor copy lock.** Three short EN strings to finalize before `.po` harvest. Phone-review-friendly.
2. **Section C — Hardcoded EN/HE conditionals that must migrate.** Inventory of every `$is_he ? 'HE' : 'EN'` pattern. These are the bulk of the .po harvest backlog.
3. **Sections D–F — Strings already in gettext shape, plus WC/WP canonical-replacement candidates.** Background for the upcoming canonical-label decision pass.

---

## A. Quick stats

| Category | Count | Status |
|---|---:|---|
| Hardcoded EN/HE conditionals (must migrate) | **22 strings** in 4 files | Highest priority — these are the only thing blocking a clean `.po` harvest |
| Free-shipping monitor states (subset of above) | **3 strings** | **Awaiting copy lock — see Section B** |
| Already wrapped with `__()` + textdomain `'jlmwines'` | ~80 strings across 17 files | Ready for `.po` extraction with `wp i18n make-pot` |
| Likely WC/WP canonical-replacement candidates | ~12 strings | Decision pass deferred (your "C" task — wait until keyboard) |
| User-facing string literals in JS | 0 | `assets/js/main.js` has no customer-facing text |

**Theme textdomain is `jlmwines`** (registered in `functions.php:17` via `load_theme_textdomain('jlmwines', ...)`).

> ⚠️ **Note (fixed 2026-04-30):** TRANSLATION_PLAN.md previously used `'jlmwines-theme'` in its examples. Corrected to `'jlmwines'`.

---

## B. Free-shipping monitor copy lock — proposed final wording

**Location:** `inc/free-shipping.php:174–186`. Three states. Both variants (`box` on cart, `slim` strip on other pages) use the same strings.

### Current EN copy

| State | Current EN |
|---|---|
| Qualified | `Congratulations, the shipping is on us!` |
| Empty cart | `Free delivery with order of %s or more.` |
| Below threshold | `Only %s more for free shipping.` |

### Issues with current copy

1. **Mixed terms:** "shipping" / "delivery" / "free shipping" used inconsistently across the three states. Pick one term and stick with it. Recommend **"free shipping"** to match the WC standard label and our footer perks card (`Free delivery` is the only outlier; could revisit separately).
2. **"Congratulations…" feels like a banner** — slightly excessive for a small UI element. Trim to a flat statement, friendlier than celebratory.
3. **"Free delivery with order of %s or more"** — slightly clunky. Smoother as `Free shipping on orders of %s or more.` or just `Free shipping over %s.`
4. **Trailing period on state 3** is missing in the original (`Only %s more for free shipping`) — inconsistent with state 2 (which has one). Pick a punctuation rule and apply it everywhere.

### Proposed final EN (recommendation 1 — flat / consistent)

| State | Proposed |
|---|---|
| Qualified | `You qualify for free shipping.` |
| Empty cart | `Free shipping on orders over %s.` |
| Below threshold | `Add %s for free shipping.` |

**Rationale:** All three say "free shipping." All three end with a period. All three avoid second-person hedging (no "Congrats", no "Only"). Reads as a calm utility line, not a marketing voice.

### Alternative final EN (recommendation 2 — slightly warmer)

| State | Proposed |
|---|---|
| Qualified | `Free shipping unlocked.` |
| Empty cart | `Free shipping on orders over %s.` |
| Below threshold | `%s away from free shipping.` |

**Rationale:** Same consistency, slightly more brand voice ("unlocked", "away from"). A touch closer to the anti-snob tone.

### Also consider — are we overspending words?

The slim strip lives at the top of every non-cart page. A one-liner like `Free shipping over %s` (no state machine, ignores cart subtotal) might be punchier UX than the dynamic remaining-amount calculation. Tradeoff: the dynamic version creates urgency near the threshold. Worth deciding before locking copy — affects how much state logic the monitor needs to keep.

**Pick one of the recommendations or revise — once locked, the HE translation pass can absorb it without rework.**

---

## C. Hardcoded EN/HE conditionals — must migrate

These are the strings that block a clean `.po` harvest. All 22 use the pattern `$is_he ? 'HE' : 'EN'`. Listed with the existing HE translations preserved so the harvest is mechanical (English → `__()`, then drop the existing HE into the `.po` file).

### `template-articles.php` (2 strings)

| Line | EN | HE |
|---|---|---|
| 20 | `with Evyatar` | `עם אביתר` |
| 21 | `Wine Talk` | `שיחת יין` |

### `template-gifts.php` (16 strings)

| Line | EN | HE |
|---|---|---|
| 41-43 | `Send Wine Gifts in Israel` (hero headline) | `שלחו מתנות יין בארץ` |
| 44-46 | `Send a gift of wine or more with your personal message to any destination in Israel. Load your cart, fill in the shipping address, and add your personal message. We'll do the rest!` (hero body) | `שלחו מתנה של יין טוב (ואולי עוד) עם מכתב אישי לכל כתובת בישראל. הוסיפו לעגלה, תנו לנו את הכתובת עם פרטי המשלוח והוסיפו את המסר האישי. אנחנו נטפל בשאר!` |
| 48 | `See All` | `עיין בהכל` |
| 54 | `Gift Boxed Wines` | `יינות באריזת מתנה` |
| 60 | `Magnum Size` | `מגנומים` |
| 66 | `Themed Packages` | `אריזות` |
| 72 | `Sparkling Wines` | `יינות מבעבעים` |
| 78 | `Wine Accessories` | `אביזרי יין` |
| 84 | `Gift Items` | `פריטי מתנה` |
| 90 | `Easy` | `בקלות` |
| 91 | `During checkout enter:` | `בזמן התשלום הזינו:` |
| 92-94 | `Your personal message.` / `Gift shipping address.` / `Recipient name and local phone.` (3 strings in array) | `ההודעה האישית שלך.` / `כתובת למשלוח מתנה.` / `שם הנמען וטלפון מקומי.` |
| 97 | `Need help?` | `אפשר לעזור?` |
| 98 | `We can help with choosing a gift, and sending it.` | `נוכל לעזור בבחירת ושליחה מתנות.` |
| 99 | `Ask us!` | `שאלו אותנו!` |

> Line 100 (`$help_anchor`) is NOT a translation candidate — it's an HTML anchor ID (`footer-contact` vs `footer-contact-he`). Footer renders both anchor variants language-conditionally. Keep as-is.

> **EN/HE drift to flag for the harvest:** The HE hero body (line 45) is more colorful than the EN — adds "good wine (and maybe more)" framing the EN doesn't have. Similarly the bullets list has small wording divergence. When migrating to `.po`, decide: (a) keep current HE as-is and accept that it's not a literal translation of the EN source, or (b) align them so the `.po` translation is one-to-one. Choosing (a) is fine if intentional but should be noted; choosing (b) means rewriting one side.

### `footer.php` (1 string)

| Line | EN | HE |
|---|---|---|
| 167-170 | `Cookie Settings` | `הגדרות עוגיות` |

### `inc/free-shipping.php` (3 strings — see Section B for proposed final copy)

| Line | EN | HE |
|---|---|---|
| 174-177 | `Congratulations, the shipping is on us!` | `מזל טוב, המשלוח עלינו!` |
| 178-181 | `Free delivery with order of %s or more.` | `משלוח חינם בהזמנה של %s ומעלה.` |
| 182-186 | `Only %s more for free shipping.` | `רק עוד %s והמשלוח חינם` |

---

## D. Already gettext-wrapped — ready for `.po` extraction

Counts per file. All use textdomain `'jlmwines'`.

| File | `__()` calls (approx) | Notes |
|---|---:|---|
| `front-page.php` | 22 | Hero, sections, perks cards, testimonials teaser, blog teaser |
| `inc/woocommerce.php` | ~10 | Save %s, Bundle Savings, Shop all, Add to cart, Recipient phone, Order Notes/Gift Message, %s wine/%s wines plural |
| `footer.php` | ~12 | Learn About Wine, newsletter copy, contact labels (Tel/Email/Hours), payment methods alt, social aria, Subscribe, Terms/Privacy |
| `header.php` | 6 | Search wines, Search, Open menu, Close menu, Site navigation, Search wines… placeholder |
| `inc/sections.php` | ~10 | Testimonials, What customers say, Wine talk, All posts, Read more, 5-star aria |
| `inc/customize.php` | ~5 | Homepage Hero panel labels |
| `woocommerce/cart/mini-cart.php` | 6 | Decrease/Increase quantity, Remove %s from cart, Shipping:, Free, empty message |
| `inc/mini-cart.php` | 4 | Shopping cart aria, Your cart, Close cart, Cart |
| `inc/bottom-nav.php` | 6 | Shop, Account, Search, Top, Back to top, Quick access aria |
| `inc/breadcrumbs.php` | 2 | Breadcrumb, Home |
| `inc/coupons.php` | 2 | First-purchase only label + description |
| `archive.php` | 3 | Previous, Next, Nothing to show here yet. |
| `comments.php` | 4 | Comment count plural, Previous, Next, Comments are closed. |
| `404.php` | 3 | Page not found, body, Back to home |
| `search.php` | 4 | Search results for: %s, Previous, Next, No results found. |
| `functions.php` | 3 | Nav menu labels |
| `index.php` | 1 | Nothing here yet. |

**Total ≈ 100 unique source strings ready for harvest.** Roughly the "under 100 strings" target from TRANSLATION_PLAN.md — confirms the order of magnitude.

---

## E. Strings that paraphrase a WC/WP standard — canonical-replacement candidates

These are strings currently in `'jlmwines'` textdomain that have an existing translation in WordPress core or WooCommerce. Switching textdomain pulls the translation for free. **Decision deferred to your "C" task — review when back at keyboard.**

| File:Line | Current | Suggested canonical | Notes |
|---|---|---|---|
| `inc/woocommerce.php:382` | `Add to cart` (`jlmwines`) | `Add to cart` (`woocommerce`) | Direct WC equivalent. Free translation. |
| `inc/woocommerce.php:138` | `Shop all` (`jlmwines`) | `Shop` (`woocommerce`) or keep theme-unique | "Shop all" is slightly different framing — judgment call |
| `inc/bottom-nav.php:28` | `Shop` (`jlmwines`) | `Shop` (`woocommerce`) | Use WC |
| `inc/bottom-nav.php:32` | `Account` (`jlmwines`) | `My account` (`woocommerce`) | Different concept ("Account" vs "My account") — keep theme version OR change EN to match WC |
| `inc/bottom-nav.php:36` | `Search` (`jlmwines`) | `Search` (`default`, WP core) | Use core |
| `header.php:138` | `Search` (`jlmwines`) | `Search` (`default`) | Use core |
| `inc/breadcrumbs.php:23` | `Home` (`jlmwines`) | `Home` (`default`) | Use core |
| `inc/sections.php:141` | `Read more` (`jlmwines`) | `Read more` (`woocommerce`) or core variant | Pick one canonical — both exist |
| `archive.php:46-47`, `comments.php:34-35`, `search.php:43-44` | `Previous` / `Next` (`jlmwines`) | `Previous` / `Next` (`default`) | Use core |
| `inc/mini-cart.php:108` | `Cart` (`jlmwines`) | `Cart` (`woocommerce`) | Use WC |
| `woocommerce/cart/mini-cart.php:106` | `Shipping:` (`jlmwines`) | `Shipping` (`woocommerce`) — drop colon | Minor punctuation difference |
| `footer.php:66` | `Email` (aria-label) (`jlmwines`) | `Email` (`default`) | Use core |

**Strings to keep theme-unique (no canonical exists or our framing is intentional):**
- All hero copy, why-trust-me, testimonials (truly brand voice)
- `Your cart` (mini-cart.php:27) — friendlier than WC's "Cart"
- `Free` in cart total (cart/mini-cart.php:110) — WC has `Free!` with exclamation; ours doesn't
- `Email:` / `Tel:` / `Hours:` in footer — we want the colon; WC's standard "Email" doesn't have one
- `Subscribe` — no WC equivalent
- `Bundle Savings` — JLM-specific
- All `Recipient phone`, `Order Notes/Gift Message`, etc. (custom checkout fields)
- All bundle-related strings
- `First-purchase only` (coupon-meta) — JLM-specific
- `Wine talk`, `Wine Bundles`, `Occasion Packages`, etc. — section/category labels

---

## F. Open questions for the canonical-label pass

1. **`Search wines…` vs `Search…`** — Should the wine-specific framing stay (current), or simplify to `Search` for canonical reuse? Theme has both `Search wines` (label) and `Search wines…` (placeholder) AND `Search` (button aria) in header.php. Could collapse.
2. **`Read more` ubiquity** — appears in both `inc/sections.php` and likely in any future blog teasers. Worth pinning the canonical translation up front.
3. **`Previous` / `Next`** — appears in 3 files with the `'jlmwines'` textdomain. Switching all to core textdomain is the cleanest single-change win.
4. **`Free delivery` (front-page perks card, line 223)** — uses `'jlmwines'` textdomain. Differs from monitor copy (which says "free shipping" if we lock recommendation 1). Same concept, different word. Pick one — recommend "free shipping" everywhere.
5. **Section heading duplication:** `Wine Talk` appears in BOTH `template-articles.php` (hardcoded HE/EN) AND `front-page.php:206` and `inc/sections.php:94` (`__('Wine talk', 'jlmwines')` — note lowercase 't' in sections.php). Three places, two casings. Worth canonicalizing during the migration.

---

## G. Migration order (when ready to implement)

1. **Lock free-shipping copy** (Section B). Smallest dependency, blocks the rest.
2. **Convert 22 hardcoded conditionals to `__()`** (Section C). Drops the `$is_he ?` pattern from the codebase. The 4 affected files: `template-articles.php`, `template-gifts.php`, `footer.php`, `inc/free-shipping.php`.
3. **Run `wp i18n make-pot`** to extract the canonical `.pot` template.
4. **Decide canonical replacements** (Section E). Each canonical move = a one-liner textdomain swap.
5. **Harvest existing WPML translations into `.po`** via WPML String Translation export + msgmerge (per THEME_REPLACEMENT_PLAN.md WPML section).
6. **Translate the residual** (genuinely brand-unique strings that have no existing HE).
7. **Verify on staging** — every page in HE, no `$is_he` greps remaining.

Step 1 is the only one feasible while remote (this doc). Steps 2–7 need staging access.

---

Updated: 2026-04-30
