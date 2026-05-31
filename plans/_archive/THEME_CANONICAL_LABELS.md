# Theme Canonical Labels — Proposal

**Created:** 2026-04-30
**Pairs with:** `plans/THEME_STRING_AUDIT.md` (Section E candidates), `plans/TRANSLATION_PLAN.md` (the rule), `plans/THEME_REPLACEMENT_PLAN.md` (operational owner)

**Purpose.** Decide canonical EN source string + textdomain for each common UI label that currently sits in `'jlmwines'` but has an existing translation in WordPress core or WooCommerce. Switching textdomain pulls the HE translation for free and avoids retranslating shared concepts.

**Phone-review format.** Each row is one decision. Mark **Y** to apply, **N** to keep theme-local, or write a different EN string in the margin.

---

## DECISIONS LOCKED — 2026-04-30

All decisions in this doc were reviewed and locked in a phone-review session on 2026-04-30. Summary, in plain prose for cross-reference:

- **B.1 — All nine textdomain swaps approved.** `Add to cart`, `Cart`, `Search` (header aria + bottom-nav), `Home`, `Previous`, `Next`, `Email`, `Shop`, `Read more` — all switch from `'jlmwines'` to either `'woocommerce'` or `'default'` (WP core) per the table below.
- **B.2 — Recommendations accepted.** `Account` becomes `My account` and switches to `'woocommerce'`. `Shipping:` keeps the colon and stays theme-local. `Shop all` stays theme-local.
- **C.1 — Approved.** Standardize on `Wine Talk` (title case). Single-character fix in `inc/sections.php:94`.
- **C.3 — Covered by B.1 row 3.** No separate change. The visible search label and placeholder (`Search wines` / `Search wines…`) stay theme-local; only the bare `Search` button aria switches to core textdomain.
- **D — Gifts hero EN/HE drift: keep both as-is.** The English page is the dominant version and was approved as-is; the Hebrew page is also approved with its slightly warmer phrasing. They are NOT direct translations of each other, but both are intentional. In the `.po` file the EN becomes the source string and the existing HE becomes the registered translation — non-literal but approved. Same pattern for the bullet text drift on the same page. No copy edits to either side.

Implementation order remains as per Section E. Code edits held until keyboard time so they can be applied one at a time and verified per change.

---

## A. The decision principle (recap)

For any string that already exists in WordPress core or WooCommerce, **use the exact same string with that text domain**. The translation comes free.

- `__( 'Add to cart', 'woocommerce' )` ✓ — translated by WC's `.mo`
- `__( 'Add to cart', 'jlmwines' )` ✗ — would need our own translation

**Avoid paraphrasing standard concepts.** "Items" instead of "Cart contents" loses the free translation for no real benefit. "Account" instead of "My account" same problem.

The decisions below are framed against that principle. When the EN source already matches a WC/WP standard exactly, the recommendation is straightforward: switch textdomain. Where the EN paraphrases (e.g., "Account" vs WC's "My account"), the call is whether to align the EN with the standard or keep the variant.

---

## B. Decisions

### B.1 — Direct switch (EN already matches a WC/WP standard exactly)

| # | Current | Proposed | Recommend | Notes |
|---|---|---|---|---|
| 1 | `__('Add to cart', 'jlmwines')` (woocommerce.php:382) | `__('Add to cart', 'woocommerce')` | **Y** | Direct match; very high confidence WC ships HE translation. |
| 2 | `__('Cart', 'jlmwines')` (mini-cart.php:108, aria-label) | `__('Cart', 'woocommerce')` | **Y** | Direct match. |
| 3 | `__('Search', 'jlmwines')` (header.php:138, bottom-nav.php:36) | `__('Search', 'default')` | **Y** | WP core; identical translation. |
| 4 | `__('Home', 'jlmwines')` (breadcrumbs.php:23) | `__('Home', 'default')` | **Y** | WP core. |
| 5 | `__('Previous', 'jlmwines')` (archive.php:46, comments.php:34, search.php:43) | `__('Previous', 'default')` | **Y** | WP core; 3-file change, single decision. |
| 6 | `__('Next', 'jlmwines')` (same 3 files) | `__('Next', 'default')` | **Y** | Pair with #5. |
| 7 | `__('Email', 'jlmwines')` (footer.php:66, aria-label on input) | `__('Email', 'default')` | **Y** | WP core. (Note: `Email:` with colon at footer.php:99 is different — keep theme-local; see B.3) |
| 8 | `__('Shop', 'jlmwines')` (bottom-nav.php:28) | `__('Shop', 'woocommerce')` | **Y** | WC ships this. |
| 9 | `__('Read more', 'jlmwines')` (sections.php:141) | `__('Read more', 'woocommerce')` or `(default)` | **Y, prefer `woocommerce`** | Both exist; WC's is the closer match for retail context. |

**B.1 net effect:** ~9 strings stop needing theme translation. Confirm `Y` for all to apply, or flag any to keep.

### B.2 — Align EN with the standard (EN currently paraphrases)

| # | Current EN | Standard EN | Recommend | Notes |
|---|---|---|---|---|
| 10 | `Account` (bottom-nav.php:32) | `My account` (WC) | **Y, change EN to "My account"** | Loses one syllable but gains free translation across all WC. Footer/account links elsewhere already say "My account" via WC's standard menu — alignment helps consistency. |
| 11 | `Shipping:` (cart/mini-cart.php:106) | `Shipping` (WC, no colon) | Hold for review | Two options: (a) drop the colon to match WC (`<strong>Shipping</strong>` followed by amount, no punctuation) or (b) keep theme-local with colon. The line currently reads `**Shipping:** [amount]`. Removing the colon is the cleaner standard; keeping it matches the rest of the cart line styling. **Mild preference: keep theme-local with colon** — visual consistency with `Tel:` / `Email:` / `Hours:` in footer. |
| 12 | `Shop all` (woocommerce.php:138, section CTA) | `Shop` (WC) | **N — keep theme-local** | "Shop all" implies "see the full catalog" while WC's `Shop` is just the page name. Different semantic; keep theme-local. |

### B.3 — Keep theme-local (no canonical exists or framing is intentional)

For reference. **No action needed** — these stay as-is in `'jlmwines'` textdomain.

| # | String | Reason to keep |
|---|---|---|
| K.1 | `Your cart` (mini-cart.php:27) | Friendlier than WC's "Cart"; brand voice. |
| K.2 | `Free` in cart total (cart/mini-cart.php:110) | WC has `Free!` with exclamation; ours is calmer — keep difference. |
| K.3 | `Email:` / `Tel:` / `Hours:` (footer.php) | The colon is intentional; matches the "label: value" pattern. |
| K.4 | `Subscribe` (footer.php:67) | No WC/WP equivalent. |
| K.5 | `Bundle Savings` (woocommerce.php:97) | JLM-specific concept. |
| K.6 | `Recipient phone` / `Order Notes/Gift Message` / `Recipient phone:` (woocommerce.php:437–491) | Custom checkout fields. |
| K.7 | `First-purchase only` and description (coupons.php:27–28) | JLM-specific coupon meta. |
| K.8 | `Wine talk`, `Wine Bundles`, `Occasion Packages`, etc. | Section/category labels — brand voice. |
| K.9 | All hero/why-trust-me/testimonial copy (front-page.php, sections.php) | Brand voice; non-shareable. |
| K.10 | `Top` / `Back to top` / `Quick access` (bottom-nav.php) | Theme-specific UX; not standard WC. |
| K.11 | `Open menu` / `Close menu` / `Site navigation` (header.php) | Could match WP core, but each is rendered uncommonly enough that the small audit gain isn't worth the consistency-with-the-rest-of-the-aria-labels cost. **Optional follow-up.** |
| K.12 | `Cookie Settings` (footer.php:170, currently hardcoded) | Will become `__('Cookie Settings', 'jlmwines')` during the migration of the hardcoded EN/HE conditionals (see audit Section C). Theme-local is correct — no WC/WP standard. |

---

## C. Cross-cutting cleanup the canonical pass enables

### C.1 — `Wine Talk` casing

Three places, two casings (per audit Section F.5):
- `template-articles.php:21` — hardcoded conditional, EN reads `Wine Talk` (capital T)
- `front-page.php:206` — `__('Wine Talk', 'jlmwines')` (capital T)
- `inc/sections.php:94` — `__('Wine talk', 'jlmwines')` (lowercase t)

**Recommendation:** standardize on **`Wine Talk`** (title case, matches the rest of the front-page section conventions — `Wine Bundles`, `Occasion Packages`, `Wine Accessories`). Single-character change in `inc/sections.php:94`.

### C.2 — `Free shipping` vs `Free delivery`

Audit Section F.4 flagged this. The front-page perks card at `front-page.php:223` reads `Free delivery`; the free-shipping monitor uses `free shipping`. The user has parked the monitor copy-lock for external consult. **When the monitor copy is locked, this perks card should align to whichever term wins** so the site speaks one language about the same offer.

### C.3 — `Search wines` / `Search wines…` / `Search`

Header.php has all three forms within ~40 lines (label, placeholder, button aria). For aria-label specifically, switching to canonical `Search` (per B.1 #3) leaves the more descriptive `Search wines` for the visible label and `Search wines…` for the placeholder. That's actually a fine result — keep all three; just textdomain-swap the bare `Search` button aria.

---

## D. EN/HE drift to resolve at harvest (separate from canonical pass)

From audit observation: the gifts-page hero body has EN/HE drift.

- **EN (template-gifts.php:46):** `Send a gift of wine or more with your personal message to any destination in Israel. Load your cart, fill in the shipping address, and add your personal message. We'll do the rest!`
- **HE (template-gifts.php:45):** `שלחו מתנה של יין טוב (ואולי עוד) עם מכתב אישי לכל כתובת בישראל. הוסיפו לעגלה, תנו לנו את הכתובת עם פרטי המשלוח והוסיפו את המסר האישי. אנחנו נטפל בשאר!`

The HE adds "good wine (and maybe more)" framing not present in EN. Decision needed when migrating to `.po`:

**Option A (preserve HE flavor — recommended):**
- Update the EN source string to match the HE flavor: `Send a gift of good wine — and maybe more — with a personal note to any address in Israel. Add to cart, give us the shipping address, and add your personal message. We'll handle the rest!`
- Then both become a single source string + matching translation in `.po`.

**Option B (preserve EN flatness):**
- Update the HE to literally translate the current EN, dropping the "good wine, maybe more" embellishment.

A is more consistent with brand voice (the "good wine" phrasing is warmer and more JLM). B is mechanical alignment.

**Recommend A.**

Same kind of small drift exists in the bullets (e.g., HE bullet 1 says "your personal message" with a possessive — `שלך`); EN says `Your personal message.` so that one's actually fine. Bullet 2 HE says `כתובת למשלוח מתנה` (address for the gift) — EN reads `Gift shipping address.` — same idea, slightly different word order. No real fix needed; literal translation will be added in `.po`.

---

## E. Sequence when implementing

1. **Confirm the B.1 / B.2 picks** (or revise on phone).
2. **Apply textdomain swaps** — single-line edits across ~9 files. Mechanical.
3. **Update `Wine talk` → `Wine Talk`** (C.1).
4. **Decide free-shipping copy** (separate, on hold).
5. **Run `wp i18n make-pot`** — generates `.pot` template excluding the canonical-replaced strings (good).
6. **Run WPML String Translation export → msgmerge into `.po`** (per THEME_REPLACEMENT_PLAN).
7. **Resolve gifts hero drift** (D) when locking source strings.
8. **Manually translate residuals.**

Steps 1, 4, 7 are the only ones that need decisions. The rest is mechanical once the decisions are made.

---

Updated: 2026-04-30
