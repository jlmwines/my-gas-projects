# Newsletter Plan — Printed Monthly Insert + Companion Email

**Purpose.** Two-sided printed sheet, one language per side (EN / HE), distributed monthly via online order shipments and brick-and-mortar store handouts. A companion email goes to the email list the same week. Drives signups to the email list and reinforces JLM's editorial voice.

**Status.** Layout and content model agreed 2026-05-08. Workflow finalized 2026-05-19 after MCP capability audit (Canva for image gen only, Mailchimp manual paste, Drive for finished-doc delivery; pandoc + reference docx templates do the layout work). First issue (Context post) launching 2026-05.

---

## Audience Framing

Single audience — both online customers (in-box) and brick-and-mortar walk-ins (in-bag). Always encourages signup. Mentions website-only features (e.g., the packing slip) as info, not pitch.

In-box readers and in-store readers should both feel equally welcomed. Don't address either as if they're already in the other's shoes.

---

## Making Wine series

A recurring section in the newsletter (and the body of the companion email) carrying Evyatar's monthly notes from the vineyard and the winery — pruning, canopy, harvest, pressing, barreling, bottling, etc.

- **Section title format:** "Making Wine — [topic]" (e.g., "Making Wine — Pruning," "Making Wine — Barreling"). Single recurring stem covering both vineyard and winery work; topic varies by what the month is actually about.
- **Source content:** 12-month draft already exists; Evyatar edits month-by-month before each issue ships.
- **Channel exclusivity:** lives ONLY in the print newsletter and the email. Not published to the blog. This is the recurring subscriber-exclusive content that gives the email signup CTA real teeth.
- **Cadence:** monthly, tracking the wine year's seasonal cycle. Issue #1 carries the May entry.
- **Voice:** first-person personal note from Evyatar. No meta-framing — readers don't get told "this is our new monthly series." Each entry just shows up.

---

## Layout (per language side)

A4 portrait, single-sided per language (one sheet, EN front / HE back, b/w print). Masthead → recurring banner → two-column body → footer band.

```
┌──────────────────────────────────────────┐
│ [logo]      Wine Talk — from Evyatar     │  masthead
├──────────────────────────────────────────┤
│ [vine → barrel → bottle → glass banner]  │  recurring b&w banner (3-4cm tall)
├────────────────────┬─────────────────────┤
│  PRIMARY ARTICLE   │  SECONDARY SLOT     │
│  (~60% width)      │  (~40% width)       │
│                    │                     │
│  Title             │  Making Wine —      │
│  Lead + body       │   [topic]           │
│                    │                     │
│  — Evyatar [sig]   │  ─────────          │
│                    │  Special offers     │
│  ─────────         │  by email…          │
│  Read the full     │      [QR]           │
│  article           │  jlmwines.com/n/sub │
│      [QR]          │                     │
│  jlmwines.com/n/.. │                     │
├────────────────────┴─────────────────────┤
│  jlmwines.com                            │  footer (URL only)
└──────────────────────────────────────────┘
```

### Masthead
- One-color logo (top-left) + wordmark **Wine Talk — from Evyatar** (matches live site signup heading)
- No issue number, no date. Issues drop as Evyatar produces them; monthly cadence is internal, not surfaced.
- HE side mirrors structure, RTL flow.

### Recurring banner
- Single horizontal B&W line illustration under the masthead, ~3–4 cm tall
- Composition: left-to-right journey — roots/vine cluster → oak barrel → wine bottle → wine glass
- Identical banner across every issue; provides instant visual continuity and reinforces "behind-the-scenes from vine to glass" framing
- B&W ink line style, no shading, prints cleanly at small sizes
- Generated in Canva; exported as SVG (vector preferred) or high-res PNG; stored in `marketing/newsletter/banner.svg`

### Primary article (left column)
- Title
- Lead paragraph + 2–4 short body paragraphs, lifted from the post's `Newsletter Excerpt` block
- Sign-off: `— Evyatar` with handwritten signature image (signature only at the sign-off, not in masthead)
- Signature is an SVG (`signature-en.svg` / `signature-he.svg`) — script-font rendering of "Evyatar" / "אביתר" as placeholder. Replaceable with a scanned real signature later without changing the template.
- Article QR + URL fallback below the sign-off

### Secondary slot (right column)
A single slot whose content rotates by what's freshest. Priority order:
1. **Making Wine — [topic]** — Evyatar's monthly note from vineyard/winery. This is the default and most common occupant once the 12-month draft is rolling.
2. **Second post teaser** — when the Making Wine entry isn't ready, or there's another strong post worth pointing at (text URL only, no second article QR — keep tracking clean).
3. **Did You Know** — fallback when neither of the above applies.

### Signup CTA (right column, lower)
Lift the live-site footer copy verbatim so print and web reinforce each other. The site footer CTA is being updated alongside Issue #1 (see "Site footer CTA" section below); the print and site use the same words.

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
- Set in the reference docx template, not specified per-issue.

---

## Distribution

- **Online orders:** dropped in the box at packing time. No per-customer personalization.
- **Brick-and-mortar:** dropped in the bag at sale time.
- **Volume:** monthly batches based on estimated combined volume + buffer. Running out mid-month is worse than overprinting.
- **Carry-over:** if a month's batch isn't fully used, decision per issue (carry over briefly vs trash). Affects how aggressively topical the content can be.

---

## Cadence

- **Monthly.** Content locked ~1 week before print date; print + delivery before month flips.
- **Primary article rotation:** primary post block changes each month, drawn from existing live blog posts.
- **Making Wine rotation:** tracks calendar month — May issue carries May activity, June carries June, etc.
- **Did You Know library:** can be sparse for first 3 months — repeating the same item across issues is acceptable while the bank builds.

---

## Mechanics

### Workflow

1. **Author markdown** — issue content (primary article excerpt + Making Wine entry + Did You Know if applicable) drafted as a single markdown file: `marketing/newsletter/issues/<YYYY-MM>-<lang>.md`.
2. **Generate images in Canva** — Evyatar runs prompts (session-provided) in Canva for any per-issue line art; saves outputs to `marketing/newsletter/images/`. The recurring banner is reused across issues.
3. **Embed in markdown** — image references in the markdown point at local paths.
4. **Pandoc convert** — `pandoc <issue>.md --reference-doc=marketing/newsletter/template-<lang>.docx -o <issue>.docx` produces the finished docx with masthead, banner, two-column body, footer applied from the template.
5. **Upload to Drive** — finished docx pushed to the newsletter folder in Google Drive via Drive MCP (`create_file`). User opens, prints, distributes.

### Reference docx templates

Two one-time-setup files:
- `marketing/newsletter/template-en.docx` — LTR, masthead/banner-region/two-column body/footer, with Secular One + Rubik styles configured.
- `marketing/newsletter/template-he.docx` — RTL mirror.

These are the layout artifacts. Pandoc uses them as style references; the body content comes from the per-issue markdown.

### QR code

- **Size: 3 cm × 3 cm** with 3–4 mm clean white quiet zone
- **Error correction: Q (25%)** — survives folds, smudges, light handling in shipping boxes and shop bags
- **Format:** SVG (vector) for layout; PNG ≥600 DPI if SVG unavailable
- **Contrast:** pure black on pure white, no screened backgrounds
- **URL pattern:** `jlmwines.com/n/<short-code>` (server-side redirect adds canonical UTM params). Until the redirect helper exists (jlmops wishlist 2026-05-08), use the canonical UTM'd URL directly — accept slightly denser code or bump size to 3.5 cm.
- **Two QRs max per side:** article QR (left column), signup QR (right column). Second post in the secondary slot uses text URL only, not a third QR.
- **Static per issue** — generate fresh each issue, no per-customer personalization.

### Content sourcing

- **Primary article excerpt:** each blog post source file (in `content/`) contains a `## NEWSLETTER EXCERPT (web/social)` section + `## PRINT NEWSLETTER BODY` section. Lift the print body into the layout.
- **Making Wine:** 12-month draft maintained by Evyatar; month-specific sections lifted into the issue markdown after Evyatar's edit pass.
- **Did You Know:** static library above; rotate or repeat as needed.

---

## Companion Email Campaign

A separate email send (EN + HE) accompanies each issue. Different role from the print insert: the email is the channel where the Making Wine content lives most fully (longer than what fits in the print column) and where subscribers get the personal note from Evyatar directly.

### Structure

1. **Subject line:** teaser phrase, not a series announcement. E.g., "Behind the scenes, before the bottle." Conveys the content type without naming it as a series.
2. **Preview text:** complements subject; sets expectation of personal/insider content.
3. **Lead body:** Evyatar's full Making Wine note for the month — what's happening in the vineyard and the winery right now. Personal voice, first-person, no meta-framing. The email IS the content; readers don't get told "this is our new monthly series."
4. **Below the lead:** brief secondary mentions — new blog post (when there is one), notable site changes, anything else worth surfacing. Short, plain.
5. **Sign-off:** `— Evyatar`.

### No signup CTA inside the email

Subscribers are already subscribed. The signup ask lives on the print insert + the site footer, where non-subscribers see it. Don't sell subscription inside an email to subscribers.

### Issue #1 specifics (Context launch + first Making Wine)

- Subject line teases the Making Wine angle (not Context-launch wording).
- Lead body: May edition of Making Wine, from Evyatar's edited 12-month draft.
- Below the lead: mention of the new Context blog post + the new site look (post-cutover redesign reference).

### Workflow

Same Mailchimp MCP constraint as documented: the integration cannot edit user-created drafts. Session drafts subject/preview/HTML body in chat; user pastes into the Mailchimp draft they've set up manually with the correct audience targeting.

---

## Site footer CTA

The site's footer signup CTA (next to the existing Evyatar-in-vineyard photo) gets copy updated alongside Issue #1 launch. Same framing as the print signup CTA so print and site reinforce each other.

- **New EN copy direction:** invite subscribers to follow Evyatar from the vineyard to the bottle — frames the email as Evyatar's monthly note, not just "offers."
- **HE mirror.**
- Exact wording drafted when the print CTA wording is locked; print and site go live together.

---

## Open Questions

- **First issue timing.** Issue #1 launches alongside the Context post (live 2026-05-19). Print + drop within 1–2 weeks of post going live.
- **Print method.** Self-print, in-house. Quantity scales with observed demand — start with a small batch, replenish as needed.
- **Volume estimate.** TBD by observation over first 2–3 issues.
- **Logo asset.** Confirm a one-color SVG/PNG of the JLM logo is available for the masthead.
- **Real signature.** SVG script-font placeholder is in place; replace with a scanned handwritten signature when Evyatar produces one.

---

## Out of Scope

- Per-customer personalized inserts (Year in Wine retro showed personalization theater backfires; see `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` "What didn't work")
- Per-customer referral QR codes (deferred as part of Ambassador program)
- jlmops integration with packing-slip print job (could come later if monthly print runs prove cumbersome)
- **Publishing Making Wine entries to the blog** — they are subscriber-exclusive content for email + print. Keeping them off the blog is what makes the email signup CTA worth acting on.

---

## Brand Voice

Per `business/BRAND_STANDARDS.md`. Editorial, not pitchy. Consistent with the website's voice and the existing blog posts.

---

Updated: 2026-05-19
