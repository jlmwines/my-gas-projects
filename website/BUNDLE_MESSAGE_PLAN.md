# Bundle Edit-Quantity Message — Plan

**What:** A short, **dismissible** hint shown on **all** bundle product pages, telling the customer that where a quantity can be edited they choose how many — 0 removes an item, raising from 0 adds one. Intent (plan); not yet built. Lives in the theme as inline `is_rtl()` chrome.

## Why

Bundles are customer-alterable by design: some wines are listed at qty 0 so the customer adjusts the mix to taste (`jlmops/plans/BUNDLE_PLAN.md` §1.1, `sb_Type`). The woosb quantity inputs make this possible, but nothing on the page tells the customer the qty field is theirs to change or that 0 removes an item. The message closes that gap.

## Scope — all bundles

Shown on **every woosb product**, alterable or fixed. No editability-detection logic. The copy is **self-guarding** — it opens with "*If* a quantity can be edited…", so on a fixed package where nothing is editable the line is simply a no-op the customer skips past, never wrong. This deliberately trades precise targeting for a one-line render with zero per-item inspection.

## Copy (final)

Bilingual; renders per `is_rtl()`.

- **EN:** `If a quantity can be edited, you can choose how many. Set it to 0 to remove an item, or raise it from 0 to add one.`
- **HE:** `מוצרים בהם ניתן לערוך את הכמות: בשדה הכמות הגדירו 0 על מנת להסיר פריט, או הוסיפו את מספר המוצרים שתרצו.`

Both user-approved (final). Brand voice (friendly, plain, no jargon). One short hint above the bundle's item list.

## Dismissible (closable)

The hint carries a close (✕) control. Once dismissed it stays dismissed so it doesn't nag on every bundle page the customer visits.

- Persistence via `localStorage` (a single flag, e.g. `jlm_bundle_hint_dismissed`) — survives across pages and sessions on that device, no server/cookie round-trip.
- Default open; hidden immediately on load if the flag is set.
- Small inline JS in the theme (no dependency beyond what's already enqueued).

## Placement

Above the woosb items table on the single-product page, so the customer reads it before touching the quantity inputs. Target a woosb render hook (e.g. before the bundle products block) rather than a generic WC hook, so it sits with the bundle UI and never leaks onto non-bundle products. Hook name to confirm at implementation.

## Implementation sketch

One small block in `website/jlmwines-theme/inc/woocommerce.php`, consistent with the existing bundle chrome there (`woocommerce_sale_flash` → `חיסכון במארז` / `Bundle Savings`, `woocommerce.php:157`):

1. Hook the woosb pre-items render point.
2. Guard: product type is `woosb` (no editability check — all bundles). Bail otherwise.
3. Echo a dismissible `<div class="bundle-edit-hint">` — the `is_rtl()`-selected copy + a ✕ button.
4. CSS in `assets/css/main.css` (muted, small, sits under the title — not a banner) + the close-button styling.
5. JS: read the `localStorage` flag on load → hide if set; on ✕ click → hide + set the flag.

No `__('…','jlmwines')` — page chrome stays inline `is_rtl()` per the project translation rule.

## Hook decision (resolved)

Used the WC-core hook **`woocommerce_single_product_summary` at priority 6**, gated on `$product->get_type()` ∈ `['woosb','product_bundle']` — *not* a woosb-internal action (keeps it verifiable / version-independent).

**Why priority 6 (not the obvious `before_add_to_cart_form`):** woosb renders its bundle-item *builder* by hooking the summary at a low priority (~21, just after the excerpt), and that item list is tall. Both `woocommerce_before_add_to_cart_form` and `single_product_summary`@25 fire *after* that builder, so the hint landed below the entire item list — at the bottom on mobile. Priority 6 fires right after the title (5) and before the builder, so the hint sits above the items. Verified live: hint at byte ~48430 (after `product_title`), woosb builder at ~48978.

## Status

**Live & user-confirmed (2026-06-12)** — renders below the product title, above the bundle items, on all bundle pages (EN + HE); ✕ dismisses and persists. Implemented in the theme and deployed to production:
- `inc/woocommerce.php` — the `woocommerce_before_add_to_cart_form` block (gated on bundle type) rendering the dismissible `#bundle-edit-hint`. Verified live: markup + locked EN/HE copy render on bundle pages (confirmed against `/product/value-reds/` and `/he/product/value-reds/`); the hint sits just after the `woosb-wrap` items.
- `assets/css/main.css` — `.bundle-edit-hint` styles (logical properties auto-flip for RTL). Verified live (rule present in the deployed file).
- `assets/js/main.js` — dismissal + `localStorage['jlm_bundle_hint_dismissed']` persistence.

**Gotcha recorded:** the site runs a JS optimizer that **strips inline `<script>`** rendered inside the product markup. The first cut put the dismissal JS inline there and it was silently removed (hint still showed, but ✕ was dead). Fix: dismissal logic moved to the enqueued `main.js`. Lesson for future theme work — behavior JS belongs in `main.js`/`wp_footer`, never inline in a hook-rendered fragment.
