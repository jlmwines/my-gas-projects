# Newsletter Plan — Printed Monthly Insert

**Purpose.** Two-sided printed sheet, one language per side (EN / HE), distributed monthly via online order shipments and brick-and-mortar store handouts. Drives signups to the email list and reinforces JLM's editorial voice.

**Status.** Layout and content model agreed 2026-05-08. First issue (Context post) gated on Evyatar's edit + HE translation. Self-print, in-house — start small, scale to observed demand. Cutover shipped 2026-05-05, so QR destinations land on the new theme.

---

## Audience Framing

Single audience — both online customers (in-box) and brick-and-mortar walk-ins (in-bag). Always encourages signup. Mentions website-only features (e.g., the packing slip) as info, not pitch.

In-box readers and in-store readers should both feel equally welcomed. Don't address either as if they're already in the other's shoes.

---

## Layout (per language side)

A4 portrait, single-sided per language (one sheet, EN front / HE back, b/w print). Two-column body under a masthead, footer band at the bottom.

```
┌──────────────────────────────────────────┐
│ [logo]      Wine Talk — from Evyatar      │  masthead (no issue#/date)
├────────────────────┬─────────────────────┤
│  PRIMARY ARTICLE   │  SECONDARY SLOT     │
│  (~60% width)      │  (~40% width)       │
│                    │                     │
│  Title             │  Whichever is       │
│  Lead + body       │  freshest:          │
│                    │   • YiV month       │
│  — Evyatar [sig]   │   • 2nd post teaser │
│                    │   • Did You Know    │
│  ─────────         │                     │
│  Read the full     │  ─────────          │
│  article           │  Special offers     │
│      [QR]          │  by email…          │
│  jlmwines.com/n/.. │      [QR]           │
│                    │  jlmwines.com/n/sub │
├────────────────────┴─────────────────────┤
│  jlmwines.com                            │  footer (URL only)
└──────────────────────────────────────────┘
```

### Masthead
- One-color logo (top-left) + wordmark **Wine Talk — from Evyatar** (matches live site signup heading)
- No issue number, no date. Issues drop as Evyatar produces them; monthly cadence is internal, not surfaced.
- HE side mirrors structure, RTL flow.

### Primary article (left column)
- Title
- Lead paragraph + 2–4 short body paragraphs, lifted from the post's `Newsletter Excerpt` block
- Sign-off: `— Evyatar` with handwritten signature image (signature only at the sign-off, not in masthead)
- Article QR + URL fallback below the sign-off

### Secondary slot (right column)
A single slot whose content rotates by what's freshest. Priority order:
1. **Year in the Vineyard month section** — when EN+HE month sections are ready
2. **Second post teaser** — when YiV isn't ready, or there's another strong post worth pointing at (text URL only, no second article QR — keep tracking clean)
3. **Did You Know** — fallback when neither of the above applies

### Signup CTA (right column, lower)
Lift the live-site footer copy verbatim so print and web reinforce each other:
- **EN:** "Special offers by email, and fascinating information about the world of wine."
- **HE:** "מבצעים מיוחדים במייל, ומידע מרתק על עולם היין."
- Signup QR + URL fallback below.

### Footer
- `jlmwines.com` — URL only. No store address.

### Did You Know library starter
- **Free pickup at the Katamon shop** — any order amount, choose at checkout
- **Free delivery on orders ₪399+**
- Hand-picked curation (every wine tasted, anything below the bar gets rejected)
- Bilingual EN/HE customer support

### Typography
- Secular One for headlines (matches the 2026-05-04 site headline-font swap)
- Rubik for body

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

- **Size: 3 cm × 3 cm** with 3–4 mm clean white quiet zone
- **Error correction: Q (25%)** — survives folds, smudges, light handling in shipping boxes and shop bags
- **Format:** SVG (vector) for layout; PNG ≥600 DPI if SVG unavailable
- **Contrast:** pure black on pure white, no screened backgrounds
- **URL pattern:** `jlmwines.com/n/<short-code>` (server-side redirect adds canonical UTM params). Until the redirect helper exists (jlmops wishlist 2026-05-08), use the canonical UTM'd URL directly — accept slightly denser code or bump size to 3.5 cm.
- **Two QRs max per side:** article QR (left column), signup QR (right column). Second post in the secondary slot uses text URL only, not a third QR.
- **Static per issue** — generate fresh each issue, no per-customer personalization.

### Content sourcing

- Each blog post source file (in `content/`) contains a `**Newsletter Excerpt:**` section as part of its front matter
- Lift the excerpt + the "Read the full guide →" line into the layout
- Year in the Vineyard EN exists at `content/A Year in Wine EN.md`; HE pending partner edit + translate

### Layout

- Theme typography (Secular One + Rubik) per `business/BRAND_STANDARDS.md`
- Two-sided print, one language per side
- Both sides identical in structure — language is the only axis of variation

---

## Companion Mailchimp Campaign

A separate email send (EN + HE) accompanies issue #1 launch. The print insert stays editorial and doesn't reference the website redesign; the companion email carries that message — announcing the new Context post + the new print newsletter + the site speed/simplicity improvements.

## Open Questions

- **First issue timing.** Gated on Evyatar's edit + HE translation of Context. Print + drop should follow within 1–2 weeks of the post going live.
- **Print method.** Self-print, in-house. Quantity scales with observed demand — start with a small batch, replenish as needed.
- **Volume estimate.** TBD by observation over first 2–3 issues.
- **Logo asset.** Confirm a one-color SVG/PNG of the JLM logo is available for the masthead (user noted we have one).
- **Signature asset.** Source a clean handwritten signature image for the sign-off.

---

## Out of Scope

- Per-customer personalized inserts (Year in Wine retro showed personalization theater backfires; see `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` "What didn't work")
- Per-customer referral QR codes (deferred as part of Ambassador program)
- jlmops integration with packing-slip print job (could come later if monthly print runs prove cumbersome)
- Reference to the website redesign in print copy (handled in the companion Mailchimp campaign instead)

---

## Brand Voice

Per `business/BRAND_STANDARDS.md`. Editorial, not pitchy. Consistent with the website's voice and the existing blog posts.

---

Updated: 2026-05-08
