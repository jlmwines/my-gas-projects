# Catalog Filters Plan

**Status:** Locked — ready to build (pending answers to 2 small open questions)
**Owner:** website
**Surfaces:** Shop page, product category archives, search results

## Goal

Add attribute filters for **intensity**, **complexity**, **acidity** to catalog
pages, in that fixed order. The point isn't filter usage volume — it's brand
communication: these 1–5 plain-language descriptors are core to the anti-snob
positioning. Customers should *see* them on every catalog page even if few
will use them.

## Model

The three attributes are **ordinal scales (1–5)**. The PDP description
encodes a value with the same `●●●○○` glyph the filter uses (filled
left-to-right by value). To keep the visual rhyme honest, the filter selects
**a single exact value**, not a threshold — clicking circle 3 (which fills
1..3, matching the PDP encoding for "this wine is at value 3") returns
wines at exactly value 3.

- **State per attribute** = a single integer N from 1 to 5, or cleared.
- **Click circle N** → select value N → fill circles 1..N → result set is
  "products whose attribute value = N."
- **Click the currently selected (rightmost filled) circle** → clear → no
  circles filled, no filter on that attribute.
- **Default** = cleared, all products shown.
- **URL form**: a single term slug, e.g. `?filter_intensity=3-medium`. WC's
  `WC_Query::layered_nav_query()` filters natively. Single value, so no
  `query_type_X` override is needed.

(An earlier draft used a threshold model — `≥ N` — but that broke the visual
rhyme: in the PDP `●●●○○` means "value = 3," and a filter inheriting the
same glyph should mean the same thing.)

## Visual language — rhymes with PDP

The PDP description encodes intensity = 4 as `●●●●○`: filled left-to-right
according to value. The filter uses the **same glyph and the same encoding**,
so the customer learns the language once. Five circles, filled = active /
included by current filter, empty = above the threshold.

### Auto-hide and disabled positions

- **Whole attribute hidden** if every product in the current view shares one
  value for that attribute (filter would be a no-op). Example: dry reds with
  uniform acidity → acidity group is suppressed.
- **Disabled circle** if no product in the current view has exactly that
  value. Renders dimmed, no hover, not clickable, not focusable. All five
  positions still render, so the scale stays visible — the unavailable end
  of the spectrum just shows it's not in stock right now.
- Every clickable circle now does something specific (in the threshold
  model, circle 1 was a no-op edge case — that's gone).

## UI

### Filter group (shared across breakpoints)
- Label: WC attribute display name in current language, with any trailing
  parenthetical stripped. WC stores names like `"Intensity (1-5)"`; we
  render `"Intensity"`. With exact-value semantics, "(1-5)" reads as "pick
  from a range," which the filter no longer offers. The five visible circles
  already encode the scale.
- Control: **5-circle row, exact-value selection.** Click = select value.
  Click currently selected (rightmost filled) circle = clear that attribute.
  Phase-2 visual: hover/focus state on the selected circle hints "click to
  clear" so first-time users discover the gesture (aria-label already does
  this for screen readers).
- **Clear-all control**: appears only when at least one filter is active.
  No per-attribute clear buttons — the active-circle-click gesture already
  clears one attribute, and adding ✕ chrome per group would duplicate it.
  Placement: in the results-meta row above the product grid (alongside the
  product count and sort dropdown), styled as a discreet text link.

### Desktop (≥900px)
- Discreet **inline-start sidebar** (left in EN, right in HE — uses logical
  properties so RTL flips automatically).
- Always-expanded — three short groups, total ~200–250px tall.
- Sticky on scroll (after the breadcrumbs row).
- ~220–260px wide.

### Mobile (<900px)
- **Filter icon** in the catalog toolbar (next to sort/count).
- Tap → accordion drops below the toolbar (not a full drawer — keeps results
  visible and avoids competing with the cart drawer).
- Selected-filter count appears as a badge on the icon.

## Term captions (out of scope for v1)

The `pa_intensity` / `pa_complexity` / `pa_acidity` taxonomies currently use
bare numbers as term names ("1", "2", …). Plain-language captions
("light / medium / bold" etc.) are a brand-voice exercise we should do, but
as a follow-up. v1 ships with the attribute label only — the circle row is
self-explanatory once the customer has seen the PDP encoding.

## Out of scope for v1

- Filtering on `pa_grape`, `pa_region`, `pa_winery` — bigger sets, different
  UX (autocomplete or search-in-filter), separate task.
- Term captions (above).
- "Sort by intensity" etc. — keep WC's default sort options unchanged.
- AJAX filter-on-change. v1 reloads the page on filter apply (matches WC
  default; no risk of breaking pagination/query state).
- Bucketing into Low/Medium/High. The filter speaks the same 1–5 scale the
  PDP does; bucketing would break the visual rhyme.

## Implementation outline

1. **`inc/shop-filters.php`** (new). One function that, given the current
   archive query, walks the result set, computes term distribution per
   attribute, decides which attribute groups render and which circles are
   disabled, and emits the markup. Reads the current threshold from the
   `?filter_*` query string.
2. **`woocommerce.php`** (edit): wrap `woocommerce_content()` in a 2-column
   grid (filters | results) on archives. Hide the filters column on
   non-archive Woo pages (cart, checkout, single product).
3. **`assets/css/main.css`** (edit): styles for `.shop-filters`, the circle
   row (active / empty / disabled states), sticky behavior, mobile accordion
   reveal, RTL flip.
4. **`assets/js/main.js`** (edit): click handler on circles (set the
   `?filter_<slug>` query param and reload). Mobile filter-toggle handler.
5. **`functions.php`** (edit): include `inc/shop-filters.php`.

## Bilingual / RTL

- Attribute labels: WC reads the attribute name from
  `wc_get_attribute_taxonomies()`. WPML's String Translation handles EN/HE.
  No theme-side translation.
- All layout uses logical properties (`inset-inline-*`); sidebar flips
  automatically in RTL.

## Open questions before build

1. **Does the live site (current Elementor theme) surface these three
   filters today?** If yes, the HE labels are likely already in WPML String
   Translation and we don't need to write them. (I'll check live before
   building if you don't know offhand.)
2. **Design pass before code?** The 5-circle threshold control is a
   little unusual. Want a quick visual mock first (CSS sketch on a static
   page), or go straight to building it on staging?
