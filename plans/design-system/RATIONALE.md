# JLM Wines — Design System Rationale

**Date:** 2026-04-27 (font + components revised; production-feature inventory added)
**Demo:** open `index.html` in any modern browser
**Source:** `styles.css` is the design system; the HTML demo consumes it

This is a reference design system for the WordPress theme replacement. It locks in tokens, type, color, components, and image treatment **before** any PHP is written. The actual theme will translate these into the proper template files.

---

## Aesthetic direction (the thing to remember)

**Editorial-confident-warm.** Substantial typography. Generous whitespace. Warmth comes from the palette and editorial details (italic eyebrows, numbered section markers, custom underline that thickens on hover), not from decoration. The bottle is the hero. Everything else gets out of the way.

Rejected directions and why:
- **Refined minimalist** (Aesop, MUJI) — too "luxe formal," fights the anti-snob brief.
- **Editorial magazine** — too cerebral; reads like a wine publication, not a shop.
- **Maximalist illustration** — would compete with the bottle photography.
- **Retro vintage label** — wine cliché territory.
- **Dark luxury** — drives down conversion in food/beverage; product PNGs lose pop.

What this system signals: *"This place knows what it's doing and isn't trying to impress you."*

---

## Color system (8 tokens — locked)

| Token | Hex | Use |
|-------|-----|-----|
| `--c-base` | `#f7f3ec` | Page background. Warm cream, not stark white. Paper-feel. |
| `--c-surface` | `#ffffff` | Cards, elevated surfaces. Subtle contrast against base. |
| `--c-ink` | `#1a1612` | All body text and headings. Warm near-black, never pure `#000`. |
| `--c-muted` | `#7a6e62` | Secondary text, captions, borders. Warm gray. |
| `--c-accent` | `#a83920` | CTAs, links, highlights. Deep terracotta. |
| `--c-success` | `#4a7a3e` | Free-shipping qualified, success messages. Sage. |
| `--c-warning` | `#c9882c` | Sale badges, low-stock notices. Warm amber. |
| `--c-error` | `#8a2018` | Form errors. Distinguishable from accent. |

**Why terracotta as the accent:** the obvious choice for a wine site is wine-red. Three problems with it: (1) it fights with bottle label colors on shelf shots, (2) it's the cliché everyone uses, (3) it codes "luxury formal." Terracotta is food-coded, Mediterranean, distinctly Israeli, warm without being soft, and far enough from typical bottle reds that it doesn't compete. Reads as confident and grounded.

**Contrast checks (WCAG AA minimum 4.5:1 normal text):**
- Ink on base: ~16:1 (AAA)
- Ink on surface: ~17:1 (AAA)
- Muted on base: ~4.6:1 (AA)
- Accent on base: ~5.4:1 (AA)
- Accent on surface: ~5.7:1 (AA)
- White on accent (button text): ~6.1:1 (AA)
- Success on base: ~5.3:1 (AA)

Hover state for accent: `#8e2f1a` (slightly deeper) — keeps contrast with white above 7:1.

---

## Typography (bilingual, two families — resolved 2026-04-27)

**Display: David Libre** (weights 400, 500, 700)
- Mid-century Hebrew serif, drawn by Ismar David in the 1950s, Google-revived. Modern enough to read editorial; distinctly not liturgical (avoids the prayerbook association of Frank Ruhl Libre).
- Three weights give the type scale flexibility — H1 at 500, H2 at 500, eyebrow and pull-quote at 400.
- Latin companion is solid humanist serif. Less refined than FRL Latin but close enough, and the trade-off was worth it to escape the religious-text reading.

**UI / Body: Rubik** (weights 400, 500, 600, 700)
- Hand-drawn, slightly rounded sans designed by Hubert and Fischer for Hebrew-first multilingual use.
- Friendly without being childish. Modern without being generic.
- Used for: body, navigation, prices, buttons, labels, micro-text — everything functional.
- Avoids the AI-default Inter/Roboto/Space Grotesk trap.

**Why one family wasn't enough:** a single bilingual sans (Heebo, Assistant) is the safe choice but produces a "everywhere else in Tel Aviv" look. The serif/sans pairing gives JLM a voice no other Israeli wine site has.

**No italic anywhere — bilingual constraint.** Hebrew lacks italic by tradition; browsers fake it via skew, which leans against right-to-left reading and fights the eye. The system uses only treatments that work identically in both scripts:
- Color shift (terracotta) for emphasis
- Weight bump (Rubik 400 → 500) for stronger emphasis
- Family shift (David Libre among Rubik) for register changes — this is what carries voice moments where FRL italic used to
- Size, ornament prefix (em-dash, rule), color tone

**Why this pair over alternatives considered:**
- *Frank Ruhl Libre + Rubik*: rejected — FRL's display sizes read as religious-text in Hebrew.
- *Bellefair + Rubik*: rejected — Bellefair only ships at weight 400, breaks the type scale; high-contrast Latin reads "luxury formal," opposite of the anti-snob brief.
- *Heebo + Assistant*: too uniform, feels generic.
- *Suez One + Rubik*: Suez is too display-y for editorial use.
- *Heebo + Rubik*: lacks the voice variation between display and UI.

**Type scale:**

| Size | Mobile | Desktop | Family | Weight | Line-height |
|------|--------|---------|--------|--------|-------------|
| H1 (Display) | 44px | 60px | David Libre | 500 | 1.1 |
| H2 (Display) | 30px | 38px | David Libre | 500 | 1.3 |
| H3 (UI) | 22px | 26px | Rubik | 600 | 1.3 |
| Body | 16px | 17px | Rubik | 400 | 1.55 |
| Small | 14px | 14px | Rubik | 400 | 1.55 |
| Micro / Caption | 12px | 12px | Rubik | 600 (uppercase EN, regular HE, +0.10em tracking) | 1.4 |
| Price | 24px | 28px | Rubik | 500 (tabular numerals, −0.01em tracking) | 1 |
| Eyebrow | 18px | 18px | David Libre | 400 (terracotta) | 1.4 |
| Section number | 28px | 28px | David Libre | 500 (terracotta) | 1 |

**Eyebrow treatment:** David Libre regular at 18px in terracotta. The serif-among-sans contrast itself is the voice marker — no slant, no case treatment, works identically in EN and HE. Em-dash prefix as ornamental anchor.

**Hebrew adjustments:**
- +1px on body size (Hebrew letterforms read smaller at the same point size)
- Tighter line-height (1.4 vs 1.55) — Hebrew has fewer ascenders/descenders, so generous LH creates river effect
- Micro/caption: uppercase + tracking applies to EN only (Hebrew has no case); HE uses size + weight + color alone for the same register

**Inline emphasis:** terracotta color shift on the phrase, or weight bump (Rubik 400 → 500). Never `font-style: italic` — the bilingual system treats italic as off-limits.

**Letter-spacing:**
- Display: −0.01em (tightens for confidence)
- Micro/caption: +0.10em (uppercase needs breathing room)
- Prices: −0.01em (numbers feel more confident slightly tightened)

**Number rendering:** prices use OpenType `tnum` (tabular numerals) — every digit is the same width. Critical for grids and totals where numbers stack.

---

## Spacing scale (locked)

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96` — base 4, multiplied by 1, 2, 3, 4, 6, 8, 12, 16, 24.

Available as `--s-1` through `--s-24`. No values outside this scale.

**Why these intervals:** doubles up to 16 (small-component scale), then 1.5x (24, 48, 96) for layout-level rhythm. Avoids the "every multiple of 4" sprawl that produces inconsistent layouts.

---

## Components (in the demo)

### Header
Logo + nav + language switcher + cart icon + search. Cart icon has a small terracotta badge for item count. Language switcher uses underline (terracotta) on the active language — quiet but unmistakable. **Sticky on scroll** with subtle compress and a 1px ink-12 bottom border.

### Hero
Eyebrow (David Libre regular, terracotta) + display headline + body subline + two CTAs (primary + ghost) + bottle visual with floating animation (6s gentle drift) and a centered shelf shadow. The shelf shadow is two layers: a hairline grey line + a soft radial shadow — gives the bottle a place to sit. (Hero retains its shelf treatment because the bottle here is a single hero element, not a catalog grid.)

### Product cards
- White surface, 1px ink-12 border (almost invisible, just enough definition)
- Photo well: square aspect, no padding, no shelf shadow — 1000×1000 catalog PNGs already include their own whitespace, image fills container edge-to-edge via `object-fit: contain`
- Hover: card lifts 2px and shadow deepens. No bottle-only animation.
- Body: micro-caption (region/type) → title → meta line (short description) → price + circular cart button
- The meta line under the title is a brief tasting-note style summary — sourced from the WooCommerce short description or product excerpt
- **Alignment in grids:** card body uses `flex: 1` to fill its grid cell. Card footer (price + cart button) uses `margin-top: auto` so prices line up across a row regardless of title length. Card title clamps to 2 lines (`-webkit-line-clamp: 2`) AND reserves a 2-line `min-height` so meta-lines align across the row whether titles are 1 or 2 lines. Meta-line clamps to 2 lines without a min-height (variable-height block, absorbed by the auto-margin gap).
- Cart button: ink-black circle, turns terracotta on hover with a 1.06 scale

### Bundle cards
**One chassis, two tag-pill variants.** Bundles and packages are structurally the same product type (packages = bundles with discount + fixed wines + fixed quantity). Catalog grouping (separate Bundles and Packages sections) does the primary differentiation. On the card itself:
- **Bundle**: cream `--c-base` photo well, ink tag pill ("Bundle"). Imagery never identifies specific products — bundle contents may rotate.
- **Package**: warm tinted gradient photo well (`#f0e9d8 → #e8dfca`), terracotta tag pill ("Package"). Because contents are fixed, package imagery can be richer (Canva-painted scene, not just grouped silhouettes) — but this is optional, not load-bearing.

The card chassis (border, body, pricing footer) is identical. Distinction lives in the photo well chrome + tag color. No separate component, no flat-illustration track, no display-font title difference.

### Buttons
- **Primary** (`.btn`): terracotta background, white text, 14×28 padding, 0 border-radius. Decisive. Hover deepens. Active pushes 1px.
- **Ghost** (`.btn--ghost`): transparent with ink border. Inverts on hover (ink fill, white text).
- **Small variant** (`.btn--small`): 10×18 padding for cart contexts.
- **Disabled**: muted background, not-allowed cursor.
- **Focus state**: 2px ink outline, 3px offset — high contrast, accessibility-first.

### Free shipping monitor
- Two states: in-progress (terracotta fill on cream-base bar) and qualified (sage-green fill, success-tinted background, check icon).
- Message + amounts in editorial split: human-readable message on left, raw numbers on right (tabular).
- Bilingual via WPML; numbers stay LTR even in HE per typographic convention.
- **Single component, multiple positions:** slim sticky strip under the header on cart-bearing pages, top of mini-cart drawer, top of cart page, above PDP add-to-cart. One data source (cart total + threshold).

### Discount badge
- **Hooks WooCommerce native sale flash** — `span.onsale` markup, no custom widget.
- The Product Bundles plugin sets `is_on_sale()` through the standard API, so the flash fires automatically on any package or sale-priced product.
- Theme CSS overrides default red-circle styling to amber sticker, top corner of the photo well (`inset-inline-start: 12px` so it flips correctly in RTL).
- Optional `woocommerce_sale_flash` filter swaps "Sale!" for "Save ₪50" / "חיסכון ₪50" by reading `regular_price - sale_price`.
- Uses `--c-warning` (amber), reserved for sale/attention. Terracotta stays for CTAs.

### Floating add-to-cart bar
Sticky bottom bar with:
- Thumbnail (cream-base square, 56px)
- Title + meta (truncated with ellipsis)
- Price (right-aligned)
- Qty stepper with ink border
- Primary CTA on the far end

Mobile collapses meta line and reduces thumbnail to 48px. The bar uses sticky positioning at the bottom of its container — in production it should appear when the main add-to-cart scrolls out of view (Intersection Observer).

### Footer
Dark (ink) — the only dark surface in the system. Provides intentional contrast and a "you've reached the end" feeling.
- Newsletter callout: display headline + subtle copy + inline form (terracotta CTA against ink — high contrast)
- Four utility columns
- Base row: copyright + business registration (Israeli convention) + language switcher

---

## Image treatment

### Catalog spec (locked, matches existing asset library)
- 1000px square PNG, transparent background
- Bottle visible, year obscured on label
- Boxed wine shows the box, accessories shot to the same standard
- The image already includes its own whitespace/padding — fills the card photo well edge-to-edge via `object-fit: contain`. No CSS padding inside the photo well, no shelf shadow.

### Bundles vs packages
Existing site imagery transfers as-is. New theme does not require new bundle/package painting commissions — but if package imagery is added later (Canva impressionist oil painting, brand-consistent with blog featured images), it sits in the package photo well's tinted gradient.

- **Bundles**: imagery never identifies specific products. Contents may rotate. Grouped silhouettes, abstract wine moments, or a representative scene — anything that signals "selection" without naming bottles.
- **Packages**: contents fixed by definition, so imagery can be richer. Optional Canva-painted scene works here. Same constraint though — no specific products visible, since vintage/SKU may shift even if the package theme stays.

### Format pipeline
- Archival masters: PNG-1000 (lossless, source of truth)
- Runtime: WebP-with-alpha via `<picture>` + `srcset`
- Fallback: PNG for browsers without WebP (~0.3% of traffic)
- Per slot:
  - `card-thumb-360w.webp` (catalog grid 1x)
  - `card-720w.webp` (catalog grid 2x retina)
  - `single-1000w.webp` (single product hero)
  - `single-zoom-2000w.webp` (zoom view)
- All cropped square in the WebP transcode pipeline
- Lazy-loaded except above-the-fold

### Lifestyle / hero / blog imagery (separate spec — TBD)
Atmospheric food-and-table moments, bright daylight, no vineyard sunsets. Catalog images and lifestyle images **never appear in the same component** — clear separation prevents the chaotic mixed-bag look.

---

## What this implies for the WordPress build

A few decisions in this design system imply theme structure choices:

1. **Two font families, seven weights total** (David Libre 400/500/700, Rubik 400/500/600/700) = ~140 KB of font data. Single combined Google Fonts request with `font-display: swap`. Subset to Hebrew + Latin only (drop Cyrillic, Greek, etc.) — saves another ~30 KB. Self-host if Israel-EU latency to Google fonts is a problem.

2. **Eight CSS custom properties for color** = the entire palette. Theme can expose via `theme.json` (for the block editor) and as CSS variables (for runtime). One source of truth.

3. **Type scale uses CSS custom properties with a media query** at 720px. Theme should not duplicate this in PHP.

4. **No utility framework, no Tailwind, no Bootstrap.** The CSS in `styles.css` is the entire styling system — about 700 lines, well under any reasonable budget.

5. **Component classes are semantic** (`.card`, `.bundle-card`, `.shipping-monitor`, `.floating-cart`) — these become BEM-friendly when extended in the theme, and integrate cleanly with WooCommerce's own template hierarchy.

6. **SVG sprite pattern** for icons (cart, plus, check) — single inline `<svg>` block at the top of `<body>`, referenced via `<use href="#i-cart"/>`. Zero extra HTTP requests, easily themed via `currentColor`.

7. **Floating cart uses sticky positioning** — production version needs Intersection Observer to show only after main add-to-cart scrolls out of view. The CSS is ready; the JS is ~10 lines.

8. **Hero animation (`heroFloat`)** is CSS-only (`@keyframes`). Reduce via `prefers-reduced-motion: reduce`.

9. **Shelf shadow on cards** is a `::after` pseudo-element on the photo well, not a separate DOM node. Cleaner template markup.

10. **Bilingual font scaling** via `[dir="rtl"] .t-body { font-size: calc(var(--t-body) + 1px); }` — RTL detection automatic via WPML's `<html dir>` attribute.

---

## Production features the theme inherits

The live site already runs these — the theme replacement keeps the plugins, the design system tells them how to look. Not building from scratch.

| Feature | Source | Theme's job |
|---------|--------|-------------|
| **Sticky header** | existing | Compresses on scroll. Logo shrinks, nav stays, cart + search + lang switcher persist. Shadow appears only when scrolled. |
| **Header search** | WooCommerce native | Always-visible input next to language switcher. Footer-input styling pattern (transparent, ink border, terracotta on focus). |
| **Mini-cart** | WooCommerce | Drawer from cart icon click. Free-shipping monitor at top, line items, totals + checkout CTA. Not always-visible — the count badge handles persistent signaling. |
| **Free-shipping monitor** | WooCommerce + theme | Single component, multiple positions (sticky strip under header on cart-bearing pages, mini-cart, cart page, PDP). |
| **WhatsApp icon** | existing plugin (number `+972555174805`) | Bottom-corner circle, opposite horizontal corner from floating add-to-cart. 4-6 sec appearance delay. Both icons flip together in RTL. |
| **Age verification gate** | existing (Elementor-based) | Appears in language of landed page. Footer toggle re-routes to equivalent page in other language. Yes 18+ → cookie + proceed. No → off-site redirect. |
| **Cookie consent** | Complianz | Theme styles the banner: cream-base background, ink text, terracotta CTA. Existing scroll-jump bug on close needs investigation or plugin replacement (separate decision). |
| **Newsletter signup** | MC4WP (Mailchimp for WordPress) | Theme styles the plugin's form output to match the footer-form pattern. |
| **Accessibility widget** | Elementor a11y widget (38 KiB, kept for Israeli law compliance) | Self-contained, theme-agnostic. Stays through theme swap. |
| **Catalog filters** | WooCommerce + WPML | Contextual — only renders attribute filters that apply to the current result set. Sensory triad ordered **intensity → complexity → acidity**. Bundles/packages have no sensory attributes. Kashrut and grapes are not stored as attributes — no catalog filter UI for them. |
| **Bilingual content** | WPML | Drives lang switch + dir attribute. **Bundle and package products are managed independently** in EN and HE — not translations. Design must not assume content parity. |

## What's already locked

- **Catalog/product imagery:** 1000×1000 PNG, transparent background, year obscured. Specified in this document.
- **Blog / editorial featured images:** Canva impressionist oil painting style, 16:9 landscape. Specified in `content/IMAGE_RECIPE.md` with formula and per-category object guide. Used for blog roll thumbnails, post headers, social, newsletters, email.
- **Page structure for homepage and About:** the recently rebuilt homepage (sections per `website/HOMEPAGE_COPY.md`: hero, bundles row, packages row, "Why Trust Me" with Evyatar photo, category tiles, testimonials, Wine Talk previews) and About (real photo of Evyatar + testimonial cards) carry over. **Their current palettes do not** — both will adopt the new design system tokens (`#f7f3ec` cream + `#1a1612` ink + `#a83920` terracotta) when the new theme ships. Existing navy/charcoal homepage and tan/cream About are not preserved as variants.

## What's still open

- **Hero / marketing imagery** — campaign pages, seasonal banners, marketing landing pages. Editorial direction not yet specified. Probably want: bright daylight, food-and-table moments, no vineyard sunsets, no people unless model-released. **Avoid mixing** with blog oil-painting style or catalog product PNGs in the same component.
- **Iconography beyond the 3 in the sprite** — menu hamburger, account avatar, filter, search magnifier. Keep them in the same line-weight family as the cart icon (1.6px stroke, rounded caps). Wishlist icon is *not* needed — feature retired.
- **Loading states / skeletons** — not designed yet; should follow the system (cream-tinted blocks, no shimmer, no spinning).
- **Empty states** (empty cart, no search results, etc.) — small editorial moments, friendly tone, clear next action.
- **Product detail page layout** — for now, single PDP layout for all products (individual wines, bundles, packages). Refine by category as needed after viewing what we have. Implied direction: large square image (or gallery), title in David Libre, body description in Rubik, sensory framework indicators, related-products grid below.
- **Cart page layout** — implied: line items as compact horizontal cards, free-shipping monitor at the top, totals on the right (or below on mobile).
- **Form styling beyond the newsletter input** — checkout, account, contact forms. Should follow the input pattern shown in the footer (transparent background, ink border, terracotta on focus).
- **Complianz scroll-jump bug** — close button currently moves the user to the bottom of the page. Investigate plugin config or replace.

---

## Self-review notes

Things I'm confident about:
- The terracotta accent is differentiated and brand-appropriate
- The David Libre + Rubik pairing reads modern in both scripts without religious-text association
- No-italic system handles Hebrew without leaning against reading direction
- WooCommerce native sale-flash hookup avoids reinventing the discount badge
- One bundle-card chassis (with tag-pill variants) is simpler than the original dual-track and matches how the data is actually structured
- Hebrew is treated as a peer, not an afterthought

Things to validate before committing to PHP:
- **Real product PNGs** are now in the cards (Ella Valley, Azeka Blend, Rakia from the live site). Confirm the shelf shadow tunes correctly across these — the existing imagery has its own white-surface conventions.
- **Hebrew display headline at H1 mobile (44px David Libre)** — the Hebrew demo uses H2 (30px) for layout reasons; need to verify the full 44px David Libre renders cleanly on small Android browsers.
- **Free shipping bar contrast** — the terracotta fill on cream-base is intentional but should be tested with users to confirm the bar is visible enough to register peripherally.
- **Floating cart bar + WhatsApp icon collision** — both target the bottom of viewport. Spec says opposite horizontal corners, but mobile viewports under 360px may still feel crowded. May need a collapsed cart bar state on the smallest screens.
- **Complianz cookie banner** — current production has a scroll-jump bug on close. Verify with the new theme styling or budget plugin replacement.
- **Footer dark surface** — is the only dark moment in the system. Consider whether My Account / Checkout flows benefit from a similar dark accent or whether they should stay all-light. Lean toward all-light for transactional pages.

---

## Files

- `index.html` — single-page demo of the entire system. Open in any modern browser.
- `styles.css` — the design system itself (~700 lines, no dependencies beyond Google Fonts).
- `RATIONALE.md` — this document.
- `README.md` — quick start.

---

*This document is the design contract. The WordPress theme is built against it.*
