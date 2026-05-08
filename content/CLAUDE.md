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

Full reference: `content/SENSORY_FRAMEWORK.md`

## Content Purpose

**Build trust, not educate.**

Every piece answers: "Why should I trust you to pick my wine?"

## Quick Checks

Before publishing any content, verify:

- [ ] Would a friend talk this way? (not a professor, not a salesperson)
- [ ] Is it free of wine jargon?
- [ ] Does it respect the reader's time?
- [ ] Is the tone warm and helpful, never condescending?
- [ ] Does it avoid negativity about any wine, brand, or competitor?

## Blog Publishing vs Newsletter — Decoupled

Blog cadence and newsletter cadence run on independent tracks. Don't treat newsletter-worthiness as a gating filter for what gets published.

- **Blog publishes everything** that builds the book's content architecture (per `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`). That includes encyclopedic, dry reference posts (region spokes, grape spokes, historical detail) — they ship for SEO authority and as searchable reference, not for newsletter promotion.
- **Newsletter cherry-picks** the most narrative/shareable post from each month's publishing catch. Theme posts (anchored in a region with a grape and a winery story) and accessible profile pieces are typical newsletter leads. Dry spokes publish without a newsletter slot — that's fine.
- **Practical effect:** blog can run faster than monthly when production allows; newsletter still drops monthly off whatever's freshest. The Print Newsletter Body section is only required for posts that will lead a newsletter — purely-reference spokes can skip it.

## Post Source File Format

Each blog post lives as a `.md` file (one EN, one HE) with a fixed section structure. Start new posts by copying `_post-template.md`.

### Required sections (in this order)

| Section | Length | Purpose |
|---|---|---|
| `## TITLE` | 50–70 chars | Final post title |
| `## EXCERPT` | 1–2 sentences (~150 chars) | WordPress post excerpt — category/search listings |
| `## NEWSLETTER EXCERPT (web/social)` | ~50 words | Social posts, email teasers, web snippets — ends with `[Read the full guide →]` |
| `## PRINT NEWSLETTER BODY` | ~150–200 words | Printed Wine Talk insert (left column). Self-contained — reader may not scan the QR. Signs off `— Evyatar` |
| `## CTA` | one line | End-of-post link copy. Default: `Read the full guide →` |
| `## IMAGE PROMPTS` | one prompt per illustration | Canva prompts. Impressionist oil painting style |
| Body HTML | full post | Goes after the line `Paste below into WordPress Code Editor:` |

### Parser dependencies

`content/push-posts.js` parses three things from each source file:
- `## TITLE` → WP post title
- `## EXCERPT` → WP excerpt field
- Everything after `Paste below into WordPress Code Editor:` → WP post body

The other sections (Newsletter Excerpt, Print Newsletter Body, CTA, Image Prompts) are human-facing references — the parser ignores them, they're never sent to WordPress. Adding new `## `-headed sections between EXCERPT and the body marker is safe.

### Work order (how a post gets produced)

1. Topic + angle agreed
2. **Body draft** — first pass from source material or outline
3. Editorial review + revisions until body is locked
4. **Title** confirmed
5. **WP Excerpt** — derived from locked body
6. **Newsletter Excerpt (web)** — derived from locked body
7. **Print Newsletter Body** — derived from locked body, fuller treatment
8. **CTA**
9. **Image prompts**
10. HE translation — entire chain duplicates into the HE file last

Body is always first; derivatives are extracted/condensed from a locked body.

### Backfill

Existing live posts predate the Print Newsletter Body section. They don't all need retroactive updates — write the print body ad hoc when a post is selected as a future newsletter lead.
