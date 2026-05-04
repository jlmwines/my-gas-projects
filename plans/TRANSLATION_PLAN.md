# Translation Plan

**Purpose.** Define when translation happens at runtime vs. when text is stored in the correct language in advance. Minimize the runtime-translation surface to the smallest possible set.

**Status.** Rewritten 2026-05-04 to correct the prior plan, which prescribed the opposite of the rule the user actually decided.

---

## The Rule

**Only translate at runtime what cannot be stored in the correct language in advance.**

- **Runtime translation OK for:** system messages, dynamic output (cart totals, status notifications, validation errors), WP/WC framework strings (Cart, Search, Add to cart, Sale!, Out of stock, etc.) — by reusing the `'woocommerce'` / `'default'` textdomain so the translation comes free from WP/WC's own `.mo` files.
- **Runtime translation NOT OK for:** static page content — homepage, About, Articles, hero copy, headlines, body, CTAs, footer text, section labels, brand-voice copy.

Static content is stored in the correct language in advance, in one of two ways:

1. **Real WP Page with WPML duplicate.** EN content on EN Page, HE content on HE Page. WordPress dispatches by language. Default for content pages — same model as the About rebuild (EN ID 63644, HE ID 63649).
2. **Inline `is_rtl()` conditional in PHP.** Only for chrome that genuinely can't be a Page — for example, the free-shipping monitor or footer copy rendered from PHP. Rare exceptions.

The wrapper `__( '…', 'jlmwines' )` should not appear around static page content. If a string in PHP is static, it should be in `is_rtl()` form, or the surrounding template should be replaced by a Page.

---

## Why

- The text on a JLM Wines page is known at build time. There is no editorial pipeline that adds new copy in only one language.
- Storing HE next to EN (in a Page or in `is_rtl()`) means the HE site is correct from the moment it deploys. There's no "did the `.po` import succeed?" failure mode.
- WP and WC ship `.mo` files for `he_IL` covering all standard UI affordances — Cart, Account, Search, Add to cart, Sale!, Out of stock, all checkout/order labels. These are auto-loaded when the language pack is installed; zero per-string work.
- The homepage is not edited frequently. The argument that runtime translation made content "easier to maintain" doesn't hold up: a real Page with bilingual duplicates is just as easy to edit, and it eliminates the translation step entirely.

---

## What That Means In Practice

### Homepage
- **Built as a real Page** (clean HTML, no Elementor) with EN ID and HE ID via WPML. Each language has native content. Same model as About.
- The theme does **not** include a `front-page.php` template that hardcodes content with `__()` calls. (The current `front-page.php` v1.0.87 contradicts this rule and needs to be reworked before cutover — see `plans/STATUS.md` inbox.)

### Other content pages (About, Articles, Send Wine Gifts, Privacy, Terms, etc.)
- Real WP Pages with WPML duplicates. EN content on EN Page, HE content on HE Page.
- Plain HTML in the editor or block content. Already done for About.

### Chrome strings in PHP (header, footer, free-shipping monitor, age gate, etc.)
- Inline `is_rtl()` conditional with HE and EN baked in.
- Example:
  ```php
  <?php if ( is_rtl() ) : ?>
    <p>הוסיפו עוד ₪<?php echo esc_html( $remaining ); ?> ותקבלו משלוח חינם</p>
  <?php else : ?>
    <p>Add ₪<?php echo esc_html( $remaining ); ?> more for free shipping</p>
  <?php endif; ?>
  ```
- This is *not* runtime translation — both languages are stored in the source file and selected at render time.

### Standard UI strings shared with WP/WC
- Use the WP / WC textdomain. The translation is already in their `.mo`.
- Example: `esc_html_e( 'Add to cart', 'woocommerce' )` ✓
- Do **not** copy these strings into the `'jlmwines'` textdomain — that would break the free translation.

### System messages, dynamic output
- Where the string genuinely doesn't exist until runtime (cart totals, status, validation), translate via the appropriate WP/WC textdomain or — only if no canonical equivalent exists — `__('…','jlmwines')` with HE provided in a `.po`. This category should be small.

---

## Verification

After any theme work:
- Open a HE page → every visible string is in Hebrew, with no English bleed-through.
- Open the same page in EN → English.
- `grep "__( '" | grep "'jlmwines'"` across PHP returns very few results, all of which are clearly system-message-class strings (or empty if none qualify).
- No `.po` import is required for HE content to render correctly.

---

## Out of Scope

- Customer-facing copy outside the theme (handled per-channel — Mailchimp via duplicate language campaigns, packing slips via per-language templates).
- jlmops admin UI (internal; manager and admin both read English).
- Server-side dynamic strings from external services (let those services handle their own translations).

---

## Why the prior plan was wrong

The earlier version of this document (2026-04-30) prescribed migrating from `is_rtl()` conditionals to `__('…','jlmwines')` + `.po`/`.mo`. That was the opposite of the user's actual rule and led to:
- `front-page.php` being built with `__()` wrappers around hero/eyebrow/headline copy.
- Staging HE homepage showing English because no `.po` was imported.
- A 72-entry HE draft `.po` being prepared as a workaround — which is itself the problem (it's runtime translation of static content).

The corrective is this rewrite. Going forward: store in advance, runtime-translate only what cannot be stored in advance.

---

Updated: 2026-05-04
