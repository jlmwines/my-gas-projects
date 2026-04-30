# Newsletter Plan — Printed Monthly Insert

**Purpose.** Two-sided printed sheet, one language per side (EN / HE), distributed monthly via online order shipments and brick-and-mortar store handouts. Drives signups to the email list and reinforces JLM's editorial voice.

**Status.** Operating model approved 2026-04-30. First issue queued for post theme cutover. Content engine already built.

**Prep runs in parallel with theme cutover.** Post-writing, plan finalization, vendor selection, and volume estimation can advance while cutover is still in progress. What waits on cutover is only the QR destination polish (so the link target looks like the new theme) and the first physical print run.

---

## Audience Framing

Single audience — both online customers (in-box) and brick-and-mortar walk-ins (in-bag). Always encourages signup. Mentions website-only features (e.g., the packing slip) as info, not pitch.

In-box readers and in-store readers should both feel equally welcomed. Don't address either as if they're already in the other's shoes.

---

## Layout (per language side)

### Required blocks (3)

1. **Primary post excerpt + QR code.** Lifted from the Newsletter Excerpt section already present in each blog post source file. QR points to that month's primary post on the website.
2. **Current month's "A Year in the Vineyard" section.** Editorial text only — no link of its own. The post is sticky in the basics category, so readers reach it organically when they visit `/articles/`.
3. **Signup CTA.** Calls out subscribing to email. The same QR from block 1 also lands on the post page, where the footer signup form is present (universal across all pages, MC4WP with language groups).

### Optional block (4)

- **"Did you know" feature.** Included only if layout has room. Library starts with the packing slip framing (uniform attribute / pairing / decanting info across all wines, useful comparison aid). Other candidates: free shipping at ₪399, hand-picked curation, vineyard ownership, EN/HE bilingual support, store location.

---

## Distribution

- **Online orders:** dropped in the box at packing time. No per-customer personalization.
- **Brick-and-mortar:** dropped in the bag at sale time.
- **Volume:** monthly batches based on estimated combined volume + buffer. Running out mid-month is worse than overprinting.
- **Carry-over:** if a month's batch isn't fully used, decision per issue (carry over briefly vs trash). Affects how aggressively topical the content can be.

---

## Cadence

- **Monthly.** Content locked ~1 week before print date; print + delivery before month flips.
- **Same article rotation:** primary post block changes each month, drawn from existing live blog posts (7 EN+HE live as of 2026-04-30, more queued).
- **Year in the Vineyard:** rotates by calendar month — December issue carries the December section, etc.
- **Did you know library:** can be sparse for first 3 months — repeating the same item across issues is acceptable while the bank builds.

---

## Mechanics

### QR code

- One QR per language side
- Points to that month's primary post URL on jlmwines.com
- Static per issue — generate fresh each month, no per-customer personalization
- Footer signup is on every page so the QR doubles as both "read more" and "sign up"

### Content sourcing

- Each blog post source file (in `content/`) contains a `**Newsletter Excerpt:**` section as part of its front matter
- Lift the excerpt + the "Read the full guide →" line into the layout
- Year in the Vineyard EN exists at `content/A Year in Wine EN.md`; HE pending partner edit + translate

### Layout

- Theme typography (David Libre + Rubik) per `business/BRAND_STANDARDS.md`
- Two-sided print, one language per side
- Both sides identical in structure — language is the only axis of variation

---

## Open Questions

- **First issue timing.** Right after theme cutover (early-to-mid May 2026), to ensure QR destinations look polished
- **Print vendor + lead time.** TBD by user
- **Volume estimate.** TBD — needs a month or two of online + store traffic data
- **Language-aware contact form** — already configured via MC4WP groups, verify still working post-cutover

---

## Out of Scope

- Per-customer personalized inserts (Year in Wine retro showed personalization theater backfires; see `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` "What didn't work")
- Per-customer referral QR codes (deferred as part of Ambassador program)
- jlmops integration with packing-slip print job (could come later if monthly print runs prove cumbersome)

---

## Brand Voice

Per `business/BRAND_STANDARDS.md`. Editorial, not pitchy. Consistent with the website's voice and the existing blog posts.

---

Updated: 2026-04-30
