# Region Posts — 2026 Production Plan

Six region posts complete the Regions spoke of the Israeli Wine Guide. Each maps to a Blog A–F editorial calendar slot. Content spec (structure, opening archetypes, source material) lives in `content/guide/ISRAELI_WINE_GUIDE_PLAN.md` §Regions — read it before drafting any post.

**Sources:** `content/regions/ISRAEL-WINE-REGIONS.pdf` (Montefiore 2023) + `content/regions/ISRAEL WINE MAP - REGIONS.pdf` (Asado/IPEVO) + `content/regions/region map.png`

**Calendar source of truth:** `JLMops_Publishing` (the live sheet the jlmops app reads, `system.calendar.sheet_id` — see `jlmops/docs/DATA_MODEL.md` §Publishing Calendar), not the older pre-redesign planning sheet this doc used to link here. That older sheet still holds the original `blog C`/`D`/`E`/`F` placeholder rows (email/newsletter date pairs) referenced below — useful for picking the next slot's dates, but it is not what the app or the Calendar tab reads. Sessions can't write `JLMops_Publishing` directly; they stage rows via `system.folder.calendar` (see `.claude/CLAUDE.md` Drive Asset Placement + `DATA_MODEL.md` Write rules).

---

## Slot assignments

Negev published out of sequence 2026-07-06 (ahead of its original Slot F date), reshuffling the queue: Negev takes Slot A, Galilee moves to Slot B. **Slots D–F are date placeholders only**, per the older planning sheet's `blog D`/`blog E`/`blog F` rows — no region attached. An earlier version of this table named Central Mountains/Judea/Coastal Plain/Golan Heights against C/D/E/F as if decided (only F was flagged "inferred") — that was wrong for all four, corrected 2026-07-09. Assign a region to a slot at the point of actually drafting it, not before. Slot C is now assigned (Central Mountains, 2026-07-09) — its `blog-region-central-mountains` row is staged in `JLMops_Publishing` (2026-08-25), pending the admin's "Apply Pending Updates."

| Slot | Email date | Newsletter date | Region | Slug | Status |
|------|-----------|----------------|--------|------|--------|
| A | 2026-07-07 | 2026-07-27 | Negev | `blog-region-negev` | **Published live (EN+HE) 2026-07-06** |
| B | 2026-08-11 | 2026-08-25 | Galilee | `blog-region-galilee` | In progress (drafted + registered) |
| C | 2026-08-25 | 2026-09-23 | Central Mountains | `blog-region-central-mountains` | Body drafted through Image Prompts; calendar row staged |
| D | 2026-10-20 | 2026-10-27 | TBD | TBD | — |
| E | 2026-11-17 | 2026-11-24 | TBD | TBD | — |
| F | 2026-12-15 | 2026-12-29 | TBD | TBD | — |

Slug column corrected 2026-07-09 — verified live in `JLMops_Library`/`JLMops_Publishing`: the real convention is `blog-region-<name>` (library entities append `-en`/`-he`), not the shorter `blog-<name>` this table previously showed.

**Remaining regions, no slot assigned yet:** Judea (Foothills), Coastal Plain, Golan Heights.

Email date = post publish + companion email send (separate from the monthly AYIW email, which runs on its own date). Newsletter date = print insert distribution.

## Source files

Post source files live in a per-region subfolder alongside that region's image assets (confirmed convention as of Negev/Galilee — each subfolder holds the `.post.md` pair, Canva source images, and the per-post upload script):

| Region | EN file | HE file |
|--------|---------|---------|
| Galilee | `content/regions/galilee/galilee-en.post.md` | `content/regions/galilee/galilee-he.post.md` |
| Golan Heights | `content/regions/golan-heights/golan-heights-en.post.md` | `content/regions/golan-heights/golan-heights-he.post.md` |
| Central Mountains | `content/regions/central-mountains/central-mountains-en.post.md` | `content/regions/central-mountains/central-mountains-he.post.md` |
| Judea | `content/regions/judea/judea-en.post.md` | `content/regions/judea/judea-he.post.md` |
| Coastal Plain | `content/regions/coastal-plain/coastal-plain-en.post.md` | `content/regions/coastal-plain/coastal-plain-he.post.md` |
| Negev | `content/regions/negev/negev-en.post.md` | `content/regions/negev/negev-he.post.md` |

## Per-region notes

**Galilee** — Opening archetype: quality-heartland. Upper Galilee East carries the reputation (350–800m, terra rossa/volcanic/gravel). Wineries: Dalton, Or Haganuz, Capsouto, Lueria. Tribal: Naphtali (Upper), Asher (west), Zebulun/Issachar (Lower).

**Golan Heights** — Opening archetype: modern-revolution. Volcanic plateau to 1,200m; Upper Golan (750–1,200m) is the quality zone. Yarden / Golan Heights Winery (1983) is the central story. First vines 1976. Tribal: half-tribe of Manasseh (biblical Bashan).

**Central Mountains** — Opening archetype: quality-heartland / mixed (lead with Judean Hills). Composite region per IPEVO's own sub-region list: **Mt. Gilboa** (corrected 2026-07-09 — this note previously said "Mt. Carmel," which is a different range entirely, already used for the Coastal Plain post; the guide plan's sub-region table and the Montefiore PDF both say Gilboa) + Shomron Hills (planted mostly 2000s onward; Gvaot, Tura — not independently verified against Montefiore, confirm before publishing) + Judean Hills (Jerusalem corridor, 400–1,000m, thin terra rossa; Castel 1992, Tzora 1993). Tribal: Ephraim + western Manasseh (Shomron); Benjamin/Judah around Jerusalem. **Text complete** (2026-07-09) — EN through Image Prompts drafted in `content/regions/central-mountains/central-mountains-en.post.md`; Drive doc placed at the canonical library path.

**Judea (Foothills)** — Opening archetype: ancient-rediscovery (light). Judean Foothills (Shfela), 50–350m, chalky clay loams. Largest region by vineyard share (27%). Barkan, Bravdo, Segal. Latroun Monastery (1890) is oldest. Indigenous grapes angle (Marawi, Hamdani) belongs here — see guide plan for sources and editorial caution on contested framing.

**Coastal Plain** — Opening archetype: heritage-continuity. Baron Edmond de Rothschild (1880s), Carmel's Zichron Ya'akov cellars (1892). 0–150m, Mediterranean breezes; known now for old-vine Carignan. Alexander, Recanati. Tribal: brushes Asher and Manasseh coastline (borderland/Phoenician — keep light).

**Negev** — Opening archetype: ancient-rediscovery (strongest arc). Nabataean/Byzantine desert viticulture at Avdat, Shivta, Nizzana → modern revival at Mitzpe Ramon (800m). Carmel first at Ramat Arad 1998; Yatir. Ancient sources in guide plan §Regions. **Text complete both languages** (2026-07-06) — EN through Image Prompts locked in `content/regions/negev-en.post.md`; HE translation done in the manager's Drive doc, admin now has Editor access. Remaining: winery verification, Canva images, `negev-he.post.md` creation, image upload, library registration, WP push — see `plans/STATUS.md` Next Action for the full checklist.

## Production checklist (per post)

- [ ] Body draft (from Montefiore + map sources + guide plan spec)
- [ ] Title confirmed
- [ ] WP Excerpt
- [ ] Email fields — Subject/Preview/Body/CTA (required — these all lead a companion email; session drafts, manager edits/translates)
- [ ] Newsletter Excerpt (web)
- [ ] Print Newsletter Body (required — these all lead a newsletter)
- [ ] CTA
- [ ] Image prompts (Canva, impressionist oil painting)
- [ ] HE translation
- [ ] Canva images generated from prompts, dropped into `content/regions/<region>/`
- [ ] Image upload script (`content/regions/<region>/upload-<region>-images.js`) — **copy `content/regions/negev/upload-negev-images.js` as the template, not a flat-post script like `upload-handling-images.js`.** Region posts are nested one level deeper (`content/regions/<region>/`, not `content/`) — the credential/module require paths differ. See `content/PUBLISHING.md` "Two directory depths" before writing or running it.
- [ ] Register in library (`node content/register-library.js <slug>`)
- [ ] Push to WordPress (`node content/push-posts.js <slug> --both`)
- [ ] wp-admin checklist (focus keyword, SEO snippet, WPML link, publish)

## Canonical summary post

After all six spokes publish, one hub post: "Israeli Wine Regions: Complete Guide" (per guide plan §Regions). Slug: `blog-regions-guide`. Not in the 2026 calendar — write when the spokes are complete.
