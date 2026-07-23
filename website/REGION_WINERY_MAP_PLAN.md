# Region Posts — Winery Map

Each of the six region posts (`content/plans/REGION_POSTS_PLAN.md`) ends with a "Wineries to Visit" list. The ideal is an interactive map with callouts and links, not just a bullet list. This doc is the plan for that; not yet built. First region to get one: Negev (8 wineries, links already researched — see below).

## Approach: Google My Maps, embedded

No map infrastructure exists in the theme today (checked `website/jlmwines-theme` for Google Maps/Leaflet/Mapbox/iframe map usage — none found). Building a fully custom map (own markers, styled to match the site) is a real dev project with no existing pattern to lean on, so that's out of scope here. Google My Maps is the realistic path:

- **Account**: `accounts@jlmwines.com` is a standard Google account — My Maps needs nothing beyond that, no new signup or Workspace admin step.
- **Pins**: one pin per winery, title + description + link, placed by hand in the My Maps editor (or via a CSV import if the pin count grows — 8 for Negev alone, up to ~50 across all six regions eventually).
- **Embed**: My Maps' "Embed on my site" gives an `<iframe>` — drops into the post as a `wp:html` block, the same pattern already used for the "At a Glance" callout box in `negev-en.post.md`. No new theme capability needed.
- **Live sync**: editing the My Maps document (add/move/edit a pin) updates the embedded iframe automatically — no re-editing the post to reflect a change.

## Bilingual requirement: two maps, not one

My Maps has no per-viewer language switching for pin content — a pin's title/description is fixed text. Matching this site's existing bilingual standard (full parallel content, not an English-only shortcut on the Hebrew page) means **two separate My Maps documents**, same coordinates, EN labels/links vs. HE labels/links:

- EN map → embedded in `negev-en.post.md` (and so on for each region's EN post)
- HE map → embedded in `negev-he.post.md`

Cost: double upkeep going forward (a new/changed winery needs updating in both maps). Also out of our control: the map's own chrome (zoom controls, Google's UI wordmark) follows Google's own language detection, not our EN/HE split — an honest limitation, not something to oversell as fully polished bilingual.

## Negev winery data (researched 2026-07-06, real websites verified live — not guessed)

Grouped by proximity (this grouping is now live in both `negev-en.post.md`/`negev-he.post.md`'s Wineries list, independent of whether the map itself exists yet):

| Group | Winery | Site | Languages |
|---|---|---|---|
| Ramat Negev / Kadesh Barnea | Ramat Negev | rnwinery.co.il | EN + HE |
| Near Mitzpe Ramon | Nana Estate | nanawine.com | EN + HE |
| Near Mitzpe Ramon | Kerem Ramon | keremramon.org | HE, EN toggle |
| Near Arad | Midbar | midbar-winery.co.il | HE only |
| Near Arad | Yatir | yatirwinery.com | EN + HE |
| Yerucham | Pinto | pintowinery.com | EN + HE |
| Sde Boker | Sde Boker | none — Facebook only (facebook.com/sdebokerwinery), phone 050-7579212 | — |
| Be'er Milka | Meshek Tushia | tushia.co.il | HE only |

Coordinates for pin placement: not yet gathered (town-level location known for all 8 from the research above; exact pin coordinates are a geocode-from-address step, quick but not done — do this when actually building the map, not before).

## Status

Planned 2026-07-06, not yet built. Winery grouping + links (the content-level part of this, independent of the map itself) already shipped live in the Negev post drafts. The map itself — pin placement, embed — is future work, likely worth doing once more region posts are close to ready (so pins can be added region-by-region rather than one map redone six times), but nothing blocks starting with just Negev's 8 pins now if wanted.
