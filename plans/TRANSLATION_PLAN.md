# Translation Plan

**Purpose.** Minimize the hand-translation surface across the JLM Wines theme by leaning on standard WordPress and WooCommerce translations wherever they exist. Translate only the strings that are genuinely unique to JLM's brand voice.

**Status.** Plan written 2026-04-30. Migration target: post theme cutover.

---

## Why

- WordPress and WooCommerce ship `.mo` translation files for `he_IL` covering all standard UI affordances (Cart, Account, Search, Add to cart, Sale!, Out of stock, all checkout/order labels, etc.)
- These translations are auto-loaded when the language pack is installed — zero per-string work for theme code
- Today the theme has Hebrew strings hardcoded as inline EN/HE conditionals (e.g., in `template-articles.php`, `inc/free-shipping.php`)
- That approach scales poorly and duplicates translation work that's already been done by the WP / WC translation teams

---

## The Rule

**For any string that already exists in WordPress core or WooCommerce, use the exact same string with that text domain.** The translation comes free.

Examples:
- `__( 'Add to cart', 'woocommerce' )` ✓ — translated by WC's `.mo`
- `__( 'Add to cart', 'jlmwines-theme' )` ✗ — would need our own translation even though WC has one

**Avoid paraphrasing standard concepts.** Saying "Items" instead of "Cart contents" loses the free translation for no real benefit. Stick with the canonical word.

---

## What Gets Translated by the Theme

Genuinely unique brand-voice strings:
- "Wine Talk" / "Articles" (custom navigation labels)
- Hero copy on homepage
- Footer contact copy
- "Why trust me" section headings
- "Send wine gifts in Israel" page-specific copy
- Free-shipping monitor copy variants
- Custom widget titles

Net surface should be **under 100 strings**.

---

## Migration Plan

### Step 1 — Audit

Identify every string in the theme that is:
1. Already hardcoded as an EN/HE conditional → candidate for `.po` migration
2. A plain English string with `__( '...', 'jlmwines-theme' )` → already in the right shape, ready for `.po`
3. Using a WC or WP textdomain → already free, no change needed

Tooling: `wp i18n make-pot` extracts all gettext calls into a `.pot` template.

### Step 2 — Reduce

For each candidate string:
- If a WC or WP equivalent exists, switch to the canonical string with their textdomain
- Otherwise, prepare for theme-local translation

### Step 3 — Translate

For the residual strings (genuinely unique):
- Generate `jlmwines-theme.pot`
- Translate to `jlmwines-theme-he_IL.po` → compile to `.mo`
- Place in `website/jlmwines-theme/languages/`

Alternative for unique strings: WPML's String Translation can manage these without `.po/.mo` files. Decide per string family during build.

### Step 4 — Remove Hardcoded Conditionals

Replace:
```php
<?php echo is_he() ? 'מאמרים' : 'Articles'; ?>
```

With:
```php
<?php esc_html_e( 'Articles', 'jlmwines-theme' ); ?>
```

Then translation is loaded from `.mo` automatically based on current locale.

---

## Pairs With

- `plans/THEME_REPLACEMENT_PLAN.md` — operational implementation of translation handling for the theme cutover (WPML setup review, source-string discipline, `.po` harvest from existing WPML translations). The theme plan is where the build TODOs live; this doc holds the standing rule.

---

## Out of Scope

- Translation of customer-facing copy outside the theme (handled per-channel — Mailchimp via duplicate language campaigns, packing slips via per-language templates)
- Translation of jlmops admin UI (internal; manager and admin both read English)
- Server-side dynamic strings from external services (let those services handle their own translations)

---

## Verification

After migration:
- Open theme in HE — every visible string should be translated
- Switch to EN — every visible string should be in English
- No EN/HE conditionals remaining in PHP files (grep should come up empty)
- WP / WC standard strings should look identical to a stock WC / WP store in HE

---

Updated: 2026-04-30
