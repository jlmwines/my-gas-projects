# Category image prompts for Canva AI

Three homepage category teaser images: `dry-red`, `dry-white`, `rose`. All
16:9 widescreen. Designed as a triptych so they read as a series.

## Shared style (paste at top of each prompt)

> Impressionist oil painting, soft brushstrokes, warm natural light, casual
> Mediterranean / Jerusalem atmosphere, no people visible, lived-in and
> inviting (not formal). 16:9 widescreen.

## Dry red

> A glass of deep ruby red wine on a worn wooden table, late-afternoon
> sunlight slanting in through a window. Jerusalem stone wall in the
> soft-focus background. A wine bottle (label intentionally blurred) just
> at the edge of frame. Warm amber and burgundy palette.

## Dry white

> A glass of pale gold-green wine on a stone garden table, dappled sunlight
> through olive leaves overhead, condensation beading on the glass. A clay
> water pitcher and a half lemon nearby. Cool greens and pale yellows,
> airy and bright.

## Rosé

> A glass of soft pink rosé on a small terrace table in afternoon sun. A
> linen napkin rumpled to the side, a small ceramic bowl of olives.
> Painted with loose, airy strokes — peach, rose, and warm cream tones
> dominating.

## Output destination

Final files go to `website/jlmwines-theme/assets/images/categories/` as:

- `dry-red.jpg`
- `dry-white.jpg`
- `rose.jpg`

Front-page consumer: `front-page.php` section 5, via the `image_overrides`
array passed to `jlmwines_render_category_cards()`.
