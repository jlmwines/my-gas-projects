# JLM Wines — Brand Identity

**Site:** jlmwines.com
**Type:** Wine retail / e-commerce
**Platform:** WooCommerce, bilingual (Hebrew + English)

## Personality

Warm, inviting, anti-snob. This is the friend who knows wine but never makes you feel dumb for not knowing. Personal, conversational, never condescending. Earnest — genuinely wants to help people find wine they'll enjoy. Never negative about competitors.

Full brand voice guidelines: `../business/CONTENT_STRATEGY.md`

## Visual Identity

**Single source of truth:** the theme CSS `:root` block (`website/jlmwines-theme/assets/css/main.css`), mirrored for non-developer use in `business/BRAND_STANDARDS.md`. The values below are the headline summary as shipped in the 2026-05-05 theme cutover — see BRAND_STANDARDS for the full palette/token table.

**Colors:** warm cream background (`#fcf9f2`), warm near-black ink (`#1a1612`), terracotta accent for CTAs/links (`#a83920`), sage for success, amber for sale flash.

**Typography:** Secular One for display/headings, Rubik for UI/body (both Google Fonts; the old Open Sans was replaced in the cutover).

**Photography/imagery:**
- Canva AI generated: impressionist oil painting style, warm natural lighting, no text
- Featured images match this style consistently
- Not stock photography, not flat design illustrations
- **Exception: Occasion Packages** (product category 1035) use a naïve Israeli folk-art set, so each package reads as a place and an occasion. Prompt = this style block + a one-line scene: "Square illustration in naïve Israeli folk-art style, inspired by Reuven Rubin and Nahum Gutman: flat colors, simple unfussy shapes, warm hand-painted feel. Palette: terracotta, ochre, cypress green, Jerusalem stone, deep wine red, pale sky blue. Wine bottles drawn as plain unlabeled shapes. Cheerful and inviting. No people, no text, no logos." Attach an existing package image as a Canva style reference.
- **Value bundles** keep their side-on bottle-lineup images (they read as "a case of wine" at thumbnail size; label style distinguishes tiers). A flat-lay redesign was tried and rejected.
- **Uploading product images:** set the image on the EN product only. WPML duplicates the attachment into HE and syncs the HE product's image; then give the HE attachment Hebrew title/alt.

**Layout patterns:**
- Product pages: clean WooCommerce
- Blog: two-column (content left, images/cards right), stacks on mobile
- Content-forward design — the words matter as much as the visuals

## What This Site Is NOT

- Not a luxury/exclusive wine shop
- Not a generic e-commerce template
- Not similar to VaadAi or AliyahNet
- Not pretentious, never talks down

## Differentiation from Other Projects

| | JLM Wines | VaadAi | AliyahNet |
|---|-----------|--------|-----------|
| Mood | Warm, personal | Professional, clean | Helpful, authoritative |
| Audience | Wine buyers (bilingual) | Building reps (Hebrew) | English-speaking olim |
| Feel | Boutique shop | Dashboard/tool | Resource guide |
| Imagery | Oil painting, warm | Functional, minimal | Informative, friendly |

## Reference Style

Modern boutique wine shops that feel personal, not corporate. Think small-batch, neighborhood wine store with good taste — not a supermarket wine aisle and not a pretentious tasting room.

## Status

The design system shipped in the 2026-05-05 theme cutover — palette, fonts, product cards, category/blog layouts, and mobile browsing are all live. Remaining design work is the homepage section-by-section redesign (`website/WEBSITE_UPDATE_PLAN.md` + the Phase 2 Gutenberg blocks in `website/HOMEPAGE_BLOCKS_PLAN.md`); ongoing tweaks live in `website/tasks.md`.
