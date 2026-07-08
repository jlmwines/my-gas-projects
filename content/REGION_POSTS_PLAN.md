# Region Posts — 2026 Production Plan

Six region posts complete the Regions spoke of the Israeli Wine Guide. Each maps to a Blog A–F editorial calendar slot. Content spec (structure, opening archetypes, source material) lives in `content/guide/ISRAELI_WINE_GUIDE_PLAN.md` §Regions — read it before drafting any post.

**Sources:** `content/regions/ISRAEL-WINE-REGIONS.pdf` (Montefiore 2023) + `content/regions/ISRAEL WINE MAP - REGIONS.pdf` (Asado/IPEVO) + `content/regions/region map.png`

**Calendar source of truth:** the [content calendar sheet](https://docs.google.com/spreadsheets/d/1xnhFKCPUkvVdMy7GWXDWwiipT6j028ZrZ_69GJ6HWjc) (`cal_Date`/`cal_Name`/`cal_Type` rows) is the live, user-maintained schedule — this table is a reconciled mirror. Re-check the sheet before trusting dates here if it's been a while.

---

## Slot assignments

Negev published out of sequence 2026-07-06 (ahead of its original Slot F date), reshuffling the queue: Negev takes Slot A, Galilee moves to Slot B (inheriting the old Golan Heights dates), Central Mountains/Judea/Coastal Plain keep their original dates. **Golan Heights → Slot F is inferred, not confirmed** — the calendar sheet only names slots once they're imminent; C/D/E/F beyond Galilee are still generic "blog C/D/E/F" rows there, so Golan Heights landing at F is our best read of "whichever region got displaced," not a sheet-confirmed fact.

| Slot | Email date | Newsletter date | Region | Slug | Status |
|------|-----------|----------------|--------|------|--------|
| A | 2026-07-07 | 2026-07-27 | Negev | `blog-negev` | **Published live (EN+HE) 2026-07-06** |
| B | 2026-08-11 | 2026-08-25 | Galilee | `blog-galilee` | In progress (drafted + registered) |
| C | 2026-08-25 | 2026-09-23 | Central Mountains | `blog-central-mountains` | — |
| D | 2026-10-20 | 2026-10-27 | Judea (Foothills) | `blog-judea` | — |
| E | 2026-11-17 | 2026-11-24 | Coastal Plain | `blog-coastal-plain` | — |
| F | 2026-12-15 | 2026-12-29 | Golan Heights (inferred — confirm) | `blog-golan-heights` | — |

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

**Central Mountains** — Opening archetype: quality-heartland / mixed (lead with Judean Hills). Composite region: Mt. Carmel + Shomron Hills (700–850m, planted 2000s; Gvaot, Tura) + Judean Hills (Jerusalem corridor, 400–1,000m, thin terra rossa; Castel 1992, Tzora 1993). Tribal: Ephraim + western Manasseh (Shomron); Benjamin/Judah around Jerusalem.

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
