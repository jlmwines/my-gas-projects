# Publication Calendar

**Updated:** 2026-07-06 (Negev published out of sequence, reshuffling the region queue — see REGION_POSTS_PLAN.md)

One timeline coordinating blog posts, email sends, print newsletter, and flyer drops. Workflow stages (edit, translate, publish, promote) live in jlmops `SysTasks` per post — this calendar names the dates and dependencies. **Live source of truth is the [content calendar sheet](https://docs.google.com/spreadsheets/d/1xnhFKCPUkvVdMy7GWXDWwiipT6j028ZrZ_69GJ6HWjc)** (`cal_Date`/`cal_Name`/`cal_Type` rows, user-maintained) — this doc is a reconciled, human-readable mirror; re-check the sheet before trusting dates here if it's been a while.

---

## Schedule

### 2026-05 — May

| Channel | Item | Status | Notes |
|---|---|---|---|
| Blog | Context | **Published live (EN+HE)** | Lead for Newsletter Issue #1 |
| Print Newsletter | Issue #1 | **Printed + distributing** (shipments + store bags) | Pattern-setter for the monthly cadence |
| Email (Mailchimp) | May AYIW entry | **Sent** | Led with the May "A Year in Wine" entry; linked to the Context post; mentioned the website update. (Newsletter NOT part of the email, per 2026-05-18 decision.) |

### 2026-06 — June

| Channel | Item | Status | Notes |
|---|---|---|---|
| Blog | A Year in the Vineyard | Text ready; under review + translation | YiV is the June lead / Making Wine section |
| Print Newsletter | Issue #2 | **Text ready** — to be produced in an upcoming **Content Library + tasks workflow** session (the first issue on the library model, per `CONTENT_LIBRARY_PLAN.md` phase 11) | Lead = YiV month section |

### 2026-07 — July (Slot A: Negev)

| Channel | Item | Target | Status |
|---|---|---|---|
| Blog | `blog-negev` — Negev region post | 2026-07-06 | **Published live (EN+HE)** |
| Email (post companion) | Negev companion email | 2026-07-07 | HTML built (EN+HE), `marketing/newsletter/issues/2026-07/` |
| Print Newsletter | Issue #3 | 2026-07-27 | Not started |
| Email (AYIW) | ayiw-july | 2026-07-28 | Not started |

### 2026-08 — August (Slot B: Galilee; Slot C begins)

| Channel | Item | Target | Status |
|---|---|---|---|
| Blog | `blog-galilee` — Galilee region post | 2026-08-11 | Drafted + registered, held |
| Email (post companion) | Galilee companion email | 2026-08-11 | Not started |
| Print Newsletter | Issue #4 | 2026-08-25 | Not started |
| Blog | `blog-central-mountains` — Central Mountains post (Slot C) | 2026-08-25 | Not started |
| Email (post companion) | Central Mountains companion email | 2026-08-25 | Not started |

### 2026-09 — September (Slot C continued)

| Channel | Item | Target | Status |
|---|---|---|---|
| Email (AYIW) | ayiw-aug | 2026-09-08 | Not started |
| Print Newsletter | Issue #5 | 2026-09-23 | Not started |

### 2026-10 — October (Slot D: Judea)

| Channel | Item | Target | Status |
|---|---|---|---|
| Email (AYIW) | ayiw-sep | 2026-10-06 | Not started |
| Blog | `blog-judea` — Judea (Foothills) post | 2026-10-20 | Not started |
| Email (post companion) | Judea companion email | 2026-10-20 | Not started |
| Print Newsletter | Issue #6 | 2026-10-27 | Not started |

### 2026-11 — November (Slot E: Coastal Plain)

| Channel | Item | Target | Status |
|---|---|---|---|
| Email (AYIW) | ayiw-oct | 2026-11-03 | Not started |
| Blog | `blog-coastal-plain` — Coastal Plain post | 2026-11-17 | Not started |
| Email (post companion) | Coastal Plain companion email | 2026-11-17 | Not started |
| Print Newsletter | Issue #7 | 2026-11-24 | Not started |

### 2026-12 — December (Slot F: Golan Heights — inferred, unconfirmed)

| Channel | Item | Target | Status |
|---|---|---|---|
| Email (AYIW) | ayiw-nov | 2026-12-01 | Not started |
| Blog | `blog-golan-heights` — Golan Heights post (region assignment inferred, not yet confirmed on the calendar sheet) | 2026-12-15 | Not started |
| Email (post companion) | Golan Heights companion email | 2026-12-15 | Not started |
| Print Newsletter | Issue #8 | 2026-12-29 | Not started |
| Email (AYIW) | ayiw-dec | 2026-12-29 | Not started |

---

## Backlog (not yet slotted to a month)

### Blog posts in pipeline (queued behind editing + translation)
- Handling and Storage
- Reds Guide
- Whites Guide

### Future blog categories (per `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`)
- **Regions** — hub + 6 spokes: Galilee, Golan Heights, Coastal Plain, Central Mountains, Judea, Negev
- **Wineries** — hub + 10–15 winery spokes
- **Grapes** — hub + 8–12 variety spokes
- **History** — hub + 4–6 period spokes
- **Uniqueness** — hub + 4–6 topic spokes
- **People** — hub + 8–12 profile spokes

### Email
- **Comeback campaign** — segments + test send pending. Per `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md`.

### Flyer
- **Round 1** — French Hill (EN) + Beit HaKerem (HE). Per `marketing/FLYER_PLAN.md`. Blocking: vendor outreach (yoterplus + dilen), designer engagement, photo assets.

---

## Cadence Conventions

- **Print newsletter:** monthly. Content locked ~1 week before print date.
- **Email companion:** sent alongside the newsletter when there's an announcement worth carrying; not every month.
- **Blog:** runs at production pace; not gated by newsletter cadence (per `content/CLAUDE.md`).
- **Flyer:** ad-hoc, in test rounds.

---

## How to Use

- A post enters a month row when there's a target publish date for it. Until then it lives in Backlog.
- "Status" is a one-line read of where the lead item stands. For workflow detail (which sub-task is open, who it's assigned to, due date), check the Content project in jlmops `SysTasks`.
- Update this file at session end if anything moved (slotted, shipped, blocked, deferred). Stale calendar is worse than no calendar.

---

## Related Plans

- `content/CLAUDE.md` — post-source format and the blog/newsletter decoupling rule
- `content/guide/ISRAELI_WINE_GUIDE_PLAN.md` — book buildout architecture (long-horizon view this calendar realizes month by month)
- `marketing/NEWSLETTER_PLAN.md` — print newsletter spec
- `marketing/FLYER_PLAN.md` — mailbox flyer plan
- `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` — email campaign system
