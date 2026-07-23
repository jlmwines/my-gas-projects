# Newsletter Reference — Printed Monthly Insert + Companion Email

Session reference for producing the monthly newsletter (print insert + companion email) — read this before building an issue. Graduated from a plan doc 2026-07-23: the operating model below is proven, recurring practice (multiple issues shipped), not unbuilt intent.

**Purpose.** Two-sided printed sheet, one language per side (EN / HE), distributed monthly via online order shipments and brick-and-mortar store handouts. A companion email goes to the email list the same week. Drives signups to the email list and reinforces JLM's editorial voice.

**Status.** Operating model established and live, running monthly since May. Workflow: a Google Doc template per language is built once in Drive; per-issue paste-source docx files (one per language, links preserved) are delivered to the issue folder; the user duplicates the template, pastes content, drops in the article QR, and prints. Current cadence per `plans/STATUS.md`: July issue out, August issue already prepped.

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
- Set in the Google Doc template; not specified per-issue. Full style table in Mechanics.

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

### Production approach

One Google Doc template per language, built manually in Drive (one-time). Per issue: user duplicates the template, pastes content from per-issue paste-source docx files, drops in the article QR, prints. No jlmops automation for Issue #1; Library work may automate later.

### Template — page setup

- **Paper:** A4 portrait (21 cm × 29.7 cm)
- **Margins:** 1.5 cm top/bottom, 2 cm left/right
- **Body width after margins:** 17 cm
- **Single page per language side**

### Template — content stack (top to bottom)

All content lives in the document body, not in Google Docs' Header/Footer features (except the footer URL band — that goes in the Footer feature so it stays anchored if a future issue ever spills to a second page).

1. **Logo + wordmark row** (~1.5 cm tall)
   - Left: one-color JLM logo, ~3 cm wide
   - Right of logo: wordmark "Wine Talk — from Evyatar" set in Secular One 16pt
   - HE template: same row structure; with RTL paragraph direction the logo visually flips to the right side

2. **Recurring B&W banner** (~3 cm tall, full body width)
   - Image: `banner.png` stored in `Newsletter/templates/` (PNG; Google Docs doesn't render inline SVG reliably)
   - Centered, no caption
   - Identical across every issue

3. **Body table** (the 2-cell working area)
   - 1 row × 2 cells
   - **Left cell:** 10 cm wide
   - **Right cell:** 7 cm wide
   - Border width: 0 (invisible)
   - Cell padding: 0.3 cm
   - Vertical alignment: top
   - HE template: same cell structure with same role mapping (first cell = article, second cell = Making Wine). RTL paragraph direction handles the visual flip.

4. **Footer** (Google Docs Footer feature)
   - "jlmwines.com" centered, Rubik 9pt

### Template — left cell contents (placeholder)

Top to bottom:

1. **Article title** — Heading 2 style placeholder: `[Article Title]`
2. **Article excerpt** — Normal text placeholder, 2-4 paragraphs of lorem ipsum
3. **Signature** — handwritten "Evyatar" PNG, ~4 cm wide, left-aligned, with `— ` prefix
4. **Horizontal divider** — single-paragraph border-bottom (subtle gray)
5. **"Read the full article"** — Normal text label
6. **Article QR placeholder** — 3 cm × 3 cm placeholder image (any dummy PNG with correct dimensions)
7. **URL text fallback** — Caption style, e.g., `jlmwines.com/n/<short-code>`

### Template — right cell contents (placeholder)

Top to bottom:

1. **Section heading** — Heading 2 placeholder: `Making Wine — [topic]`
2. **Making Wine body** — Normal text placeholder, 2-3 paragraphs
3. **Horizontal divider** — same style as left cell
4. **CTA copy** — *Fixed across issues.* Normal text. EN working copy: "Follow along — Evyatar's monthly notes from vineyard to bottle. Subscribe by email." HE copy TBD.
5. **Signup QR** — *Fixed across issues.* 3 cm × 3 cm. Same image file (`qr-signup-en.png` / `qr-signup-he.png`) every issue.
6. **URL text fallback** — Caption style, e.g., `jlmwines.com/n/sub`

The divider, CTA copy, signup QR, and URL fallback below it are part of the template and never change per issue. The user only replaces the heading + body above the divider.

### Template — fonts

Both fonts are in Google Fonts and need to be added to the doc font picker before use:
- **Secular One** — Font picker → More fonts → search → Add → close
- **Rubik** — same procedure

### Template — paragraph styles

| Style | Font | Size | Weight | Line spacing | Use |
|---|---|---|---|---|---|
| Heading 1 | Secular One | 18pt | Bold | 1.15 | Wordmark |
| Heading 2 | Secular One | 14pt | Bold | 1.15 | Article title, Making Wine heading |
| Normal text | Rubik | 11pt | Regular | 1.15 | All body |
| Caption | Rubik | 9pt | Regular | 1.0 | URL fallback, footer |

Set via Format → Paragraph styles → [style] → "Update [style] to match" after styling a sample paragraph.

### Building the HE template

1. Drive: right-click `Wine Talk EN template` → Make a copy → rename `Wine Talk HE template`
2. Tools → Preferences → check "Display right-to-left controls"
3. File → Language → Hebrew (Israel)
4. Select all body paragraphs, click the RTL button in the toolbar to flip paragraph direction
5. Replace placeholder text with Hebrew:
   - Wordmark: TBD final HE copy
   - Article title placeholder: `[כותרת המאמר]`
   - Article excerpt placeholder: Hebrew lorem ipsum
   - "Read the full article": `קראו את המאמר המלא`
   - CTA copy: TBD final HE copy
   - URL fallbacks: same URLs (no translation)
6. Cell widths stay the same; visual flip happens automatically.

### Drive folder layout

```
Newsletter/
├── templates/
│   ├── Wine Talk EN template       (Google Doc)
│   ├── Wine Talk HE template       (Google Doc)
│   ├── banner.png                  (recurring B&W banner)
│   ├── signature-evyatar.png       (signature placeholder/real)
│   ├── jlm-logo-1color.png         (one-color logo)
│   ├── qr-signup-en.png            (signup QR EN — fixed)
│   └── qr-signup-he.png            (signup QR HE — fixed)
└── issues/
    └── 2026-05/
        ├── 2026-05-en.docx                 (paste-source EN: left content → page break → right content)
        ├── 2026-05-he.docx                 (paste-source HE: same structure)
        ├── 2026-05-qr-article-en.png       (per-issue article QR)
        ├── 2026-05-qr-article-he.png
        ├── Wine Talk 2026-05 EN            (assembled EN, Google Doc)
        └── Wine Talk 2026-05 HE            (assembled HE, Google Doc)
```

### QR code specifications

- **Size: 3 cm × 3 cm** with 3-4 mm white quiet zone
- **Error correction: Q (25%)** — survives folds, smudges, light handling
- **Format:** PNG ≥600 DPI (vector preferred when Google Docs reliably supports SVG inline)
- **Contrast:** pure black on pure white
- **URL pattern:** `jlmwines.com/n/<short-code>` (server-side redirect adds canonical UTM params); until the redirect helper exists (jlmops wishlist 2026-05-08), use the canonical UTM'd URL directly and accept slightly denser code (or bump to 3.5 cm if scan reliability suffers)
- **Two QRs max per side:** article QR (left cell), signup QR (right cell)
- **Static per issue** — no per-customer personalization

### Per-issue workflow

For each issue:

1. **Session produces** (uploaded to `Newsletter/issues/<YYYY-MM>/` via Drive MCP):
   - `<YYYY-MM>-en.docx` — left content + page break + right content (hyperlinks live)
   - `<YYYY-MM>-he.docx` — same structure
   - `<YYYY-MM>-qr-article-en.png` — article QR EN
   - `<YYYY-MM>-qr-article-he.png` — article QR HE
   - Canva prompts come in chat (no docx)

2. **User assembles each language (~5 min)**:
   - Drive: right-click `Wine Talk EN template` → Make a copy → rename `Wine Talk <YYYY-MM> EN` → move to issue folder
   - Open. Also open `<YYYY-MM>-en.docx` in a second tab.
   - Copy the left-content block from the paste-source → paste into the template's left cell, replacing the left-cell placeholder above the divider
   - Copy the right-content block (after the page break) → paste into the right cell, replacing the heading + body above the right-cell divider
   - In the left cell, right-click the QR placeholder image → Replace image → Upload from computer → select `<YYYY-MM>-qr-article-en.png`
   - File → Print
   - Repeat for HE

### Content sourcing

- **Article excerpt:** lifted from the blog post source file (`content/<post>.post.md`), `## PRINT NEWSLETTER BODY` section if present, else hand-distilled from the post body
- **Making Wine entry:** Evyatar's 12-month draft, current month section, after his monthly edit pass
- **CTA copy + signup QR:** stable; lives in the template; updated in-template if/when the copy changes
- **Article QR target URL:** `jlmwines.com/n/<short-code>` (or canonical UTM'd URL until redirect helper exists)
- **Signup QR target URL:** `jlmwines.com/n/sub` (fixed)
- **Did You Know:** static library in the Layout section; rotate or repeat as needed when the right-cell secondary slot is used

---

## Companion Email Campaign

A separate email send (EN + HE) accompanies each issue. The email is post-promo-led — it features the month's blog post, not the Making Wine series. **Actual model (corrected 2026-07-01 — the prior "manager writes it verbatim" description was wrong):** the session drafts the full post — body, excerpt, and every extract needed (Newsletter Excerpt, Print Newsletter Body, Email Subject/Preview/Body/CTA, Image Prompts) — from seed facts and guidance, same drafting pass, same effort. The manager's job is to edit the English draft and translate it to Hebrew, not to originate the email copy from scratch. Making Wine stays in the print secondary slot; it does not anchor the companion email.

### Structure

1. **Hero:** blog post featured image (referenced by the post's Mailchimp-side upload).
2. **Body:** drafted by the session into the `## EMAIL BODY` section of the post's `.post.md` file, from the same locked body as the rest of the post's derivatives. Manager edits the English, then translates to Hebrew.
3. **Sign-off:** `— Evyatar`.
4. **No footer:** no `jlmwines.com` URL band; no boilerplate. The Mailchimp footer handles compliance.

### No signup CTA inside the email

Subscribers are already subscribed. The signup ask lives on the print insert + the site footer, where non-subscribers see it. Don't sell subscription inside an email to subscribers.

### Workflow

Same Mailchimp MCP constraint as documented: the integration cannot edit user-created drafts. Session builds the HTML body from the post's own `## EMAIL BODY` section (once locked and translated); user creates the Mailchimp campaign draft and pastes in the content, then reviews and schedules.

---

## Site footer CTA

The site's footer signup CTA (next to the existing Evyatar-in-vineyard photo) gets copy updated alongside Issue #1 launch. Same framing as the print signup CTA so print and site reinforce each other.

- **New EN copy direction:** invite subscribers to follow Evyatar from the vineyard to the bottle — frames the email as Evyatar's monthly note, not just "offers."
- **HE mirror.**
- Exact wording drafted when the print CTA wording is locked; print and site go live together.

---

## Open Questions

- **First issue timing.** ~~Issue #1 launches alongside the Context post.~~ Resolved — Issue #1 (Context/May) printed and distributing; cadence is monthly from here.
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

Updated: 2026-07-23 (graduated from `marketing/NEWSLETTER_PLAN.md` to this reference doc; status line refreshed to current cadence)
