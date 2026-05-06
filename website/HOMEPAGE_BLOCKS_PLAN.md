# Homepage Carousel Blocks — Plan

**Created:** 2026-05-06
**Status:** Draft — awaiting user sign-off before implementation. Two-phase plan: Phase 1 is a quick interim structural fix (no new blocks); Phase 2 is the full Gutenberg block design.
**Pairs with:** SEO audit fix #3 (`/he/home-elegant/` sitemap stray) which becomes moot once the homepage is rebuilt as a normal Page.

---

## Phasing

This plan splits into two phases that can be done in different sessions:

| Phase | What | Effort | Blockers fixed |
|---|---|---|---|
| **1 — Interim** (no new blocks) | Repurpose the existing EN + HE `home-elegant` Pages. Rename `front-page.php` → custom page template, assign to those Pages, switch Settings → Reading. Rendering logic unchanged. | ~1–2 hrs | All SEO surface issues: hreflang `http://`, `/he/home-elegant/` stray sitemap, missing per-page RankMath fields. |
| **2 — Full** (Gutenberg blocks) | Build `jlm/product-carousel` and `jlm/post-carousel` blocks. Rebuild homepage Page content to use blocks. Retire the custom template. | ~6–10 hrs across 2–3 sessions | Editability — carousels become wp-admin-editable instead of PHP-edit-only. |

Phase 1 is the right move when the SEO friction needs to clear quickly and the architecture refactor can wait. Phase 2 is the right move when there's session capacity to do the full block design properly.

After Phase 1, the homepage is structurally correct (real Pages, normal SEO surface) but the dynamic carousels are still hard-coded inside the custom template. Phase 2 replaces those hard-coded sections with reusable blocks, but the structural anchor (real Page records) is already in place — Phase 2 just changes how the Page content is composed.

---

## Goal (overall)

Restore the homepage to a normal WordPress Page-based structure, with reusable carousel patterns. The two-phase split lets us fix the SEO surface today (Phase 1) and clean up the editability story later (Phase 2).

---

## Phase 1 — Interim solution (custom page template, no new blocks)

### Steps

1. **Rename `front-page.php` → `templates/template-homepage.php`** (or wherever the theme keeps custom page templates). Add a header at the top:
   ```php
   /**
    * Template Name: Homepage
    */
   ```
   This converts the auto-loaded front-page template into a selectable page template.

2. **Assign the template to the EN `home-elegant` Page.** Page Attributes panel (right sidebar in editor) → Template dropdown → "Homepage".

3. **Assign the same template to the HE `home-elegant` Page.** Same dropdown.

4. **Switch Settings → Reading** to **"A static page"**, choose the EN `home-elegant` page from the Homepage dropdown.

5. **Verify WPML's per-language Front Page mapping** picks up the HE `home-elegant` page automatically. If not, set it explicitly in WPML → Languages settings.

6. **Verify rendering**:
   - `/` → renders the new homepage layout (same dynamic content as before)
   - `/he/` → renders the HE homepage (same dynamic content)
   - `/he/home-elegant/` → either redirects to `/he/` (WPML's normal behavior when a Page is set as language front page) or stops being indexed in the sitemap

7. **Verify SEO surface**:
   - hreflang on homepage now `https://` (generated from Page permalinks, not the template-only path)
   - Per-page RankMath sidebar works on both EN and HE Pages — set the meta description on each here instead of the global RankMath → Titles & Meta → Homepage workaround
   - `/he/home-elegant/` stops appearing as a stray sitemap entry

### What Phase 1 does NOT do

- Carousels (bundles, packages, Wine Talk) remain hard-coded inside the template PHP. Editing them still requires touching `templates/template-homepage.php`. Phase 2 fixes this.
- The template rendering logic is unchanged from the original `front-page.php` — same queries, same markup. Migration is purely structural.

### Risks / verifications

- Page content is ignored by the custom template (the template renders its own layout, not `the_content()`). So the EN and HE `home-elegant` Pages can have empty content or a placeholder note explaining that the layout is in the template. Set this content via REST API push for consistency.
- WPML translation linkage between the EN and HE Pages must already exist (user confirmed both `home-elegant` Pages are present and translated). If linkage is broken, fix in WPML's translation management before the Reading switch.
- The existing `front-page.php` may be referenced in other plan docs (`plans/CUTOVER_CHECKLIST.md`, etc.) — search and update.

---

## Phase 2 — Full block-based design

Replace the dynamic sections currently hard-coded in `templates/template-homepage.php` (bundles carousel, packages carousel, recent-posts section, plus any other repeated carousel patterns) with **two reusable Gutenberg blocks**:

1. **`jlm/product-carousel`** — list a configurable set of WooCommerce products. Handles the current bundles section, the current packages section, and any future product-grouping section (category landing pages, gift guides, etc.).
2. **`jlm/post-carousel`** — list a configurable set of editorial posts. Handles the current "Wine Talk" section.

Both blocks accept the same set of layout attributes (heading, count, columns, layout mode) plus content-source attributes specific to their domain.

Once these blocks exist and are placed on a real Homepage Page record (with WPML-linked HE counterpart), `front-page.php` can be deleted, the unconventional Settings → Reading config can be reset to "A static page," and the SEO surface issues (hreflang http, /he/home-elegant/ sitemap entry, missing per-page RankMath fields) all resolve as a side effect.

---

## Why a real Gutenberg block (not shortcodes)

Three reasons for the heavier path:

1. **The carousels appear multiple times on the homepage with different settings.** Shortcodes work but lose the editing UX — every reuse means hand-editing `[jlm_product_carousel count="6" columns="3" category="bundles"]` strings. Real blocks give you an attribute panel in the editor for each instance.
2. **Future reuse is likely.** Category landing pages, gift-guide pages, the about page, marketing campaign landing pages — anywhere we want to surface a product group with a heading and layout. A block is droppable into the inserter and discoverable to anyone editing.
3. **WPML translation works cleanly.** Block attributes that hold translatable text (heading, subheading) get picked up by WPML's translation editor automatically. Shortcode arguments are harder to translate per-language.

Trade-off accepted: build setup is heavier. See "Build & deploy" below.

---

## Block 1: `jlm/product-carousel`

### Purpose
Render a heading + horizontal carousel (or grid) of WooCommerce products selected by category, taxonomy, or explicit ID list.

### Attributes

| Attribute | Type | Default | Translatable | Notes |
|---|---|---|---|---|
| `heading` | string | empty | yes | Section title (e.g., "Our Bundles", "Curated Packages"). |
| `subheading` | string | empty | yes | Optional smaller line above or below the heading. |
| `eyebrow` | string | empty | yes | Optional micro-label above heading (e.g., "PICKED FOR YOU"). |
| `cta_label` | string | empty | yes | Optional CTA button text. |
| `cta_url` | string | empty | no | Optional CTA destination. |
| `source` | enum | `category` | no | `category` \| `tag` \| `attribute` \| `manual`. Determines how products are selected. |
| `category` | string | empty | no | Category slug, used when `source = category`. |
| `tag` | string | empty | no | Tag slug. |
| `attribute_term` | string | empty | no | `pa_winery=tabor` style, used when `source = attribute`. |
| `manual_ids` | array<int> | empty | no | Explicit product IDs, used when `source = manual`. |
| `count` | int | 6 | no | Maximum number of items. |
| `count_mobile` | int | 3 | no | Mobile cap (matches current homepage behavior). |
| `columns` | int | 3 | no | Desktop columns (1–4). Mobile is always 1 or 2 depending on layout. |
| `layout` | enum | `carousel` | no | `carousel` (horizontal scroll) \| `grid` (no scroll). |
| `order_by` | enum | `menu_order` | no | `menu_order` \| `date` \| `title` \| `rand` \| `popularity`. |
| `order` | enum | `ASC` | no | `ASC` \| `DESC`. |
| `show_price` | boolean | true | no | Show product price. |
| `show_attributes` | boolean | true | no | Show wine-attribute circles (intensity/complexity/acidity) — already a card pattern in the theme. |

### Render

PHP `render_callback` reuses the existing WC product-card template the theme already has (so visual consistency with shop/category pages is automatic). The block wrapper provides the heading section and the carousel scaffold. Pseudocode:

```php
function jlm_render_product_carousel($attrs) {
    $query = jlm_build_product_query($attrs);  // shared helper
    $products = wc_get_products($query);
    if (empty($products)) return '';

    ob_start();
    ?>
    <section class="jlm-product-carousel" data-layout="<?= esc_attr($attrs['layout']) ?>">
        <?php jlm_render_section_header($attrs); /* eyebrow / heading / subheading */ ?>
        <div class="jlm-product-carousel__track" data-columns="<?= intval($attrs['columns']) ?>">
            <?php foreach ($products as $product) {
                wc_get_template_part('content', 'product-card', ['product' => $product]);
            } ?>
        </div>
        <?php jlm_render_section_cta($attrs); /* optional CTA button */ ?>
    </section>
    <?php
    return ob_get_clean();
}
```

### Editor UX

ServerSideRender component shows real preview in the editor. Right-sidebar InspectorControls panel exposes all attributes grouped logically:

- **Content** panel: eyebrow, heading, subheading, CTA
- **Source** panel: source type radio + the relevant ID/slug field
- **Layout** panel: count, count_mobile, columns, layout mode, order_by, order
- **Display** panel: show_price, show_attributes

---

## Block 2: `jlm/post-carousel`

### Purpose
Render a heading + carousel/grid of editorial posts (the "Wine Talk" section pattern).

### Attributes

| Attribute | Type | Default | Translatable | Notes |
|---|---|---|---|---|
| `heading` | string | empty | yes | |
| `subheading` | string | empty | yes | |
| `eyebrow` | string | empty | yes | |
| `cta_label` | string | empty | yes | |
| `cta_url` | string | empty | no | |
| `category` | string | empty | no | Post category slug filter. |
| `count` | int | 3 | no | |
| `columns` | int | 3 | no | |
| `layout` | enum | `grid` | no | `carousel` \| `grid`. |
| `show_excerpt` | boolean | true | no | |
| `show_date` | boolean | false | no | |
| `show_author` | boolean | false | no | |
| `read_more_label` | string | "Read more" | yes | |

Render reuses the theme's existing blog-card markup for visual consistency.

---

## Build & deploy approach

### Stack choice: PHP-rendered block with React edit UI

Two layers:

- **Frontend:** PHP `render_callback`. Deterministic, server-side, cache-friendly, no JS hydration on the public site. Same template parts the theme already uses.
- **Editor:** React block (block.json + edit.js + save.js). `ServerSideRender` component for live preview. InspectorControls for attribute editing.

### Build pipeline

Add `@wordpress/scripts` to the theme:

```
website/jlmwines-theme/
├── blocks/
│   ├── product-carousel/
│   │   ├── block.json
│   │   ├── edit.js
│   │   ├── index.js
│   │   ├── style.css         (frontend styles)
│   │   └── editor.css        (editor-only styles)
│   └── post-carousel/
│       └── ... (same shape)
├── package.json              (adds @wordpress/scripts as devDep)
└── inc/blocks.php            (PHP registration + render callbacks)
```

Build commands (added to existing theme `package.json` if any, else new):
- `npm run build` → compiles blocks/*/index.js → blocks/*/build/index.js
- `npm run start` → watch mode for development

PHP side: `inc/blocks.php` calls `register_block_type(__DIR__ . '/../blocks/product-carousel')` for each block. block.json declares the React entrypoint and the PHP render callback.

### Deployment integration

Existing `pwsh -NoProfile -File website/deploy-theme.ps1` (incremental FTP push to staging6) ships theme files. Need to ensure:

1. `blocks/*/build/` directories are included in the deploy whitelist (currently the script may exclude `build/` or `node_modules/` — verify).
2. `node_modules/` is excluded (it's huge and unnecessary on the server).
3. The `package.json` and lock file are tracked in git.

A pre-deploy step (`npm run build`) bakes the blocks before each FTP push. Easiest: add to `deploy-theme.ps1` as a first step.

### CI / git considerations

- Track: `blocks/*/{block.json,edit.js,index.js,save.js,*.css}`, `blocks/*/build/`, `package.json`, `package-lock.json`, `inc/blocks.php`.
- Gitignore: `node_modules/`.
- Deploy: include `blocks/*/build/`, exclude `node_modules/` and source `.js` if you want a smaller upload (the build/ output is what WP loads).

---

## Migration plan (Phase 2 — assumes Phase 1 already shipped)

Once both blocks exist and are tested:

### Step 1: build the blocks (no front-end change yet)
- Add the `blocks/` directory + `inc/blocks.php` + `package.json`.
- Verify they render correctly in editor + frontend on staging.
- Both blocks accessible in the inserter under a "JLM Wines" block category.

### Step 2: rewrite the homepage Page content
- The EN + HE `home-elegant` Pages already exist (set up in Phase 1) with the custom template assigned.
- Replace their content with block markup: hero (Custom HTML block) + jlm/product-carousel × N + jlm/post-carousel + static section blocks for why-trust, category cards, testimonials.
- Verify the WPML translation linkage from Phase 1 still holds.

### Step 3: switch the page template assignment
- Change Page Attributes → Template from "Homepage" (the custom template from Phase 1) to "Default" — so the Page renders its own block content via `the_content()` instead of the hard-coded template.
- Verify both `/` and `/he/` render the new block-based homepage.

### Step 4: retire `templates/template-homepage.php`
- Either delete it entirely, or stub it to render `the_content()` (defensive).
- After verifying no regression, remove.

### Step 5: clean up artifacts
- Update `plans/STATUS.md` with the architectural change recorded.
- Update `plans/SEO_AUDIT_2026-05-06.md` — issues #1 and #3 already cleared in Phase 1; mark editability work complete here.
- Update `plans/CUTOVER_CHECKLIST.md` if it references `front-page.php` or the old template path.

### Step 6: opportunistic refactor (later)
- Use the same `jlm/product-carousel` block on category landing pages, the about page, gift-guide pages, etc. Each instance configurable.

---

## WPML compatibility

- **Translatable attributes** (`heading`, `subheading`, `eyebrow`, `cta_label`, `read_more_label`) need to be marked translatable in the block.json or via WPML's "translatable strings in custom blocks" config.
- **Page-level translation** of the EN ↔ HE homepage Pages handled by WPML's standard Page translation flow.
- **Source filters that reference slugs** (e.g., `category="bundles"`) — slugs differ between EN and HE in this project (e.g., `bundles` vs `bundles-he`). The block should probably resolve to the language-appropriate slug at render time via WPML's `wpml_object_id` filter. Option: the source attribute holds an EN-canonical slug; render-side translates to current language. Or store a category ID instead of slug (IDs are language-stable).
- **Verify in WPML config** that the new block types are translatable. WPML usually auto-detects.

---

## Open questions for user before implementation

1. **Block category in the inserter** — what should the block category be labeled? "JLM Wines" / "JLM" / "Site Blocks" / something else? Affects discoverability for editors.
2. **Carousel JavaScript** — we'll need a small JS for horizontal scroll/swipe behavior on the carousel layout. Bundle our own (~1KB) or reuse an existing library the theme already loads (Swiper, Glide, etc.)? Verify what's already in the theme.
3. **Homepage Page strategy** — replace the existing `home-elegant` HE Page (and find/create its EN pair), or create a fresh pair from scratch? Replace is cleaner if WPML linkage already exists; fresh is cleaner if `home-elegant`'s metadata is questionable.
4. **Migration risk tolerance** — staging-first is mandatory. Want to run both old and new homepage in parallel for a day (e.g., new homepage at `/home-2/` for review) before flipping Settings → Reading? Or full cutover from staging once it looks right?
5. **Scope of this session vs. follow-up** — does this plan get implemented in one session, or split? Reasonable split points:
   - Session A: build the two blocks, demo them on a test Page.
   - Session B: build the new homepage Pages with the blocks, set up WPML linkage.
   - Session C: cutover (Settings → Reading switch, retire front-page.php).
   That's safer than one mega-session but uses three weekly capacity slots.
6. **Other carousels on the homepage** — beyond bundles/packages/Wine Talk, are there other repeated patterns I should account for? (Category cards section is static, testimonials is its own carousel-style pattern; should that also be a block?)

---

## Estimate

Single-session build: probably 6–10 hours of focused work, depending on how many round-trips are needed for the blocks to look right. Spread across 2–3 sessions is more realistic given staging→review→adjust cycles.

Most of the time goes to:
- Block plumbing (block.json, edit.js, registration) — once for both, then they share patterns
- Editor UX (InspectorControls panels, ServerSideRender wiring)
- Render-side compatibility with the existing theme's product-card and blog-card markup
- WPML translation integration for attributes
- Carousel JS behavior tuning across breakpoints

---

## Cross-references

- `website/CATALOG_FILTERS_PLAN.md` — pattern for theme-level features that started as PHP includes; same evolution path.
- `plans/SEO_AUDIT_2026-05-06.md` — issues #1 and #3 resolve as side effect of this work.
- `plans/CUTOVER_CHECKLIST.md` — needs update if it still references `front-page.php`.
- `business/CONTENT_STRATEGY.md` — voice/brand reference for default heading copy.
