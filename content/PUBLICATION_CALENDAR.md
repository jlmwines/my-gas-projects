# Publication Calendar

**Updated:** 2026-06-11 (May row reconciled to shipped; June row needs the user's session-end confirmation)

One timeline coordinating blog posts, email sends, print newsletter, and flyer drops. Source of truth for *what ships when*. Workflow stages (edit, translate, publish, promote) live in jlmops `SysTasks` per post — this calendar names the dates and dependencies.

---

## Schedule

### 2026-05 — May

| Channel | Item | Status | Notes |
|---|---|---|---|
| Blog | Context | **Published live (EN+HE)** | Lead for Newsletter Issue #1 |
| Print Newsletter | Issue #1 | **Printed + distributing** (shipments + store bags) | Pattern-setter for the monthly cadence |
| Email (Mailchimp) | Context post + redesign | _confirm sent_ | Announces redesign + Context post (newsletter NOT part of email per 2026-05-18 decision) |

### 2026-06 — June

_Needs the user's confirmation — status below is as of 2026-05-18 and may have moved._

| Channel | Item | Status | Notes |
|---|---|---|---|
| Blog | A Year in the Vineyard | Under review + translation _(confirm)_ | |
| Print Newsletter | Issue #2 | TBD | Lead TBD; YiV month section in secondary slot when EN+HE ready |

### 2026-07 onward

Slots TBD. Pull from backlog as items are ready.

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
