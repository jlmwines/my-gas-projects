# JLM Wines Content Guidelines

Read `business/CONTENT_STRATEGY.md` for full context. This is the quick reference.

---

## The Voice

**Friendly. Personal. Never talks down.**

Write like a trusted friend who happens to know wine—not a sommelier, not a salesperson, not a teacher giving a lecture.

## The Customer

People who drink wine. Not "wine lovers" or hobbyists.

They want:
- Convenience (it shows up, it's good)
- Consistency (no disappointments)
- Zero pretension (don't make me feel dumb)

They do NOT want to learn wine vocabulary.

## The Owner's Tone

- Exceedingly polite—never says anything negative about a brand, winery, wine, or grape
- Earnest and upbeat
- Service-dedicated
- Plain-spoken, no jargon

## Brand Position

**We do the work so you don't have to.**

- Anti-snob: wine without pretension
- Curators: we taste everything, reject what doesn't meet the bar
- Opposite of big retailers pushing whatever wineries need to dump
- But we show this through what we DO, never by criticizing others

## Sensory Framework

We use three visual/audio metaphors to describe wine characteristics:

All three use the same song as metaphor:
- **Intensity** = Volume (background music → listening at home → concert venue)
- **Complexity** = Instruments (solo → ensemble → orchestra)
- **Acidity** = Tone (warm cello/bass → balanced → bright violin/flute)

Visual alternatives available for each (thumbnail→fullscreen, sketch→mosaic, soft→bright photo).

**This is an internal tool for consistency—not something customers need to learn.**

Use metaphors to clarify, not to dominate. Customers should never feel they need to "learn" our system.

Full reference: `content/_resources/SENSORY_FRAMEWORK.md`

## Content Purpose

**Build trust, not educate.**

Every piece answers: "Why should I trust you to pick my wine?"

## Hebrew Source of Truth

The manager's Drive doc is the authoritative source for HE text. Local `.post.md` HE content can be stale. Always copy Hebrew from the Drive doc before publishing or using it — terminal RTL reversal makes stale content hard to detect.

## Quick Checks

Before publishing any content, verify:

- [ ] Would a friend talk this way? (not a professor, not a salesperson)
- [ ] Is it free of wine jargon?
- [ ] Does it respect the reader's time?
- [ ] Is the tone warm and helpful, never condescending?
- [ ] Does it avoid negativity about any wine, brand, or competitor?

## Blog Publishing vs Newsletter — Decoupled

Blog cadence and newsletter cadence run on independent tracks. Don't treat newsletter-worthiness as a gating filter for what gets published.

- **Blog publishes everything** that builds the book's content architecture (per `content/plans/ISRAELI_WINE_GUIDE_PLAN.md`). That includes encyclopedic, dry reference posts (region spokes, grape spokes, historical detail) — they ship for SEO authority and as searchable reference, not for newsletter promotion.
- **Newsletter cherry-picks** the most narrative/shareable post from each month's publishing catch. Theme posts (anchored in a region with a grape and a winery story) and accessible profile pieces are typical newsletter leads. Dry spokes publish without a newsletter slot — that's fine.
- **Practical effect:** blog can run faster than monthly when production allows; newsletter still drops monthly off whatever's freshest. The Print Newsletter Body section is only required for posts that will lead a newsletter — purely-reference spokes can skip it.

## Post Source File Format

Each blog post lives as a `.md` file (one EN, one HE) with a fixed section structure. Start new posts by copying `_resources/_post-template.md`.

**Publishing a post → see `content/_resources/PUBLISHING.md`** for the full pipeline (the image-upload + `push-posts.js` scripts, the manifest, credentials/target, commands, and the manual wp-admin checklist after a push). Planned automation of that checklist: `content/plans/PUBLISH_ENHANCEMENT_PLAN.md`.

**Manager/Admin task workflow in the jlmops app (who does each step, where to click) → see `content/PRODUCTION_GUIDE.md`.** Source of truth is `jlmops/docs/WORKFLOWS.md` §13; this guide is a Manager-facing snapshot, regenerate it if that workflow changes.

**Registering a post in the jlmops content library → see `content/scripts/register-library.js` header** for all usage modes (`<slug>`, `--all`, `--update`). Add a manifest entry to the script, then run `node content/scripts/register-library.js <slug>`.

**Writing the post's HTML block (the `Paste below into WordPress Code Editor:` section) → see `content/_resources/HTML_BLOCK_GUIDE.md` first.** Copy column/image layout from `content/_resources/existing-layouts/*.raw.txt` or an existing bilingual pair (e.g. `content/basics/handling/Handling EN.post.md`/`Handling HE.post.md`) — never invent column widths or CSS from scratch. The single most important rule: **the HE HTML is a structural copy of the EN HTML — same columns, same order, same classes, only the text is translated.** There is no cross-language mirroring/flipping convention on this site; do not try to build one.

### Required sections (in this order)

This table must mirror `_resources/_post-template.md` exactly — if they disagree, the template file is stale and gets fixed, not read around. Body sits right after Title: a human opening the file reads the post first, then sees the derived fields below it.

| Section | Length | Purpose |
|---|---|---|
| `## TITLE` | 50–70 chars | Final post title |
| `## BODY` | 800–1,200 words | The full post, plain prose during drafting. Write/lock this first — everything below is derived from it. |
| `## EXCERPT` | 1–2 sentences (~150 chars) | WordPress post excerpt — category/search listings |
| `## FEATURED MEDIA` | — | WP media ID, stamped by the per-post image-upload script |
| `## EMAIL SUBJECT` | one line | Subject line for the companion promotional email. Session drafts from the locked body, same as every other extract; manager edits/translates, doesn't originate it. |
| `## EMAIL PREVIEW TEXT` | 150 chars max | Preheader shown in email clients before opening — most clients truncate past 150. Session drafts; manager edits/translates. |
| `## EMAIL BODY` | full email copy | Companion email body — post-promo-led, features this post (see `marketing/_resources/NEWSLETTER_REFERENCE.md` Companion Email Campaign). Session drafts; manager edits/translates. |
| `## EMAIL CTA` | one line | Email call-to-action button/link text. Session drafts; manager edits/translates. |
| `## NEWSLETTER EXCERPT (web/social)` | ~50 words | Social posts, email teasers, web snippets — ends with `[Read the full guide →]` |
| `## PRINT NEWSLETTER BODY` | ~150–200 words | Printed Wine Talk insert (left column). Self-contained — reader may not scan the QR. Signs off `— Evyatar` |
| `## CTA` | one line | End-of-post link copy. Default: `Read the full guide →` |
| `## IMAGE PROMPTS` | one prompt per illustration | Canva prompts. Impressionist oil painting style |
| `## NOTES` | optional | Source docs, SEO meta draft, pre-publish checklist, manifest slug. Human-facing only. |
| Body → HTML (publish-time only) | full post | Publishing session converts `## BODY` prose into HTML and moves it to the very end of the file, after the line `Paste below into WordPress Code Editor:` |

### Parser dependencies

`content/scripts/push-posts.js` parses three things from each source file:
- `## TITLE` → WP post title. **Must be the first line of the file** — the regex anchors to file-start, not just any `## ` boundary.
- `## EXCERPT` → WP excerpt field. Position-independent.
- Everything after `Paste below into WordPress Code Editor:` → WP post body. **Must be the last thing in the file** — the parser captures from that marker to end-of-file; anything placed after it (Notes, Image Prompts, etc.) would get swallowed into the WordPress post body.

Every other `## `-headed section — including `## BODY` itself — is a human-facing reference the parser ignores. This is why `## BODY` can sit right after Title for readability: only the two constraints above are load-bearing.

### Work order (how a post gets produced)

1. Topic + angle agreed
2. **Body draft** — first pass from source material or outline, written directly into `## BODY` (sits right after Title in the template). Plain prose. NO HTML, no "Paste below" block — that is added by the publishing session only.
3. Editorial review + revisions until body is locked (manager edits the prose in the file or Drive doc)
4. **Title** confirmed
5. **WP Excerpt** — derived from locked body
6. **Email fields** (Subject/Preview/Body/CTA) — drafted by the session from the locked body, same pass as the rest of the post's derivatives
7. **Newsletter Excerpt (web)** — derived from locked body
8. **Print Newsletter Body** — derived from locked body, fuller treatment
9. **CTA**
10. **Image prompts**
11. HE translation — entire chain duplicates into the HE file last
12. **Publishing session only** — if the post has body images, run the per-post `upload-<topic>-images.js` script first (see `content/_resources/PUBLISHING.md` — copy the template matching the post's actual folder depth, flat vs. nested, don't assume). It stamps media IDs/URLs into the `.post.md` files. Then convert `## BODY` prose to HTML, replace it with `Paste below into WordPress Code Editor:` + HTML block **moved to the end of the file** (the parser reads to end-of-file from that marker), then run `push-posts.js`.

**Once body is locked (step 3), it is verbatim for every later step.** "Derived from locked body" in steps 5–10 means extracted/condensed *from* the existing wording — never a fresh paraphrase of the body itself. A session adding Email fields, Newsletter Excerpt, or a translation must not also rewrite `## BODY` as a side effect. (Real incident, 2026-07-01: the Negev post's body was progressively paraphrased across three sessions while later sections were being added, losing real content — restored from the original Drive doc. If the body genuinely needs a content change, that's a deliberate, called-out edit, not an incidental rewrite.)

**A drafting session stops after step 10.** Steps 11–12 are separate sessions. Never add HTML or copy-paste instructions to a draft file.

Body is always written and locked first, in place at the top of the file; derivatives are extracted/condensed from it after.

### Backfill

Existing live posts predate the Print Newsletter Body section. They don't all need retroactive updates — write the print body ad hoc when a post is selected as a future newsletter lead.
