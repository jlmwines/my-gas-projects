# JLM Wines — Email Creation Guidelines

## Brand Voice in Email

Same as all JLM communications (see `business/CONTENT_STRATEGY.md`):
- Personal, warm, plain-spoken
- From Evyatar — first person, like a note from a friend
- Never condescending, never salesy
- No logo in body — sender name IS the brand

## Design Decisions

Colors/fonts mirror the site's brand — source of truth is the theme CSS `:root` block, summarized in `business/BRAND_STANDARDS.md`. Keep these in sync if the theme palette changes.

| Element | Choice | Rationale |
|---------|--------|-----------|
| Layout | Single column | Mobile-first (41%+ open on phone), multi-column crushes on small screens |
| Hero image | Yes, via Mailchimp Image block | Sets mood, not in HTML code — keeps code clean |
| CTA | One button, terracotta (#a83920) white text (hover #8e2f1a) | Matches the site's accent/CTA color; one CTA avoids confusion |
| Inline links | Remove from body when button exists | Don't compete with the primary CTA |
| Closing | Personal sign-off from Evyatar, below button | Warm ending after the action prompt |
| Fonts | Secular One (headings), Rubik (body) — with a system sans-serif fallback | Matches the website (post-2026-05-05 cutover); most email clients fall back to system fonts anyway, so colors carry the brand more than fonts |
| Text color | #1a1612 (warm near-black Ink, headings + body); #7a6e62 (Muted) for secondary text | Matches the website `:root` palette |
| Background | #ffffff content surface on a #fcf9f2 warm-cream outer | Matches the site's cream background; clean, warm |

## Image Guidelines

- Composite real photos with Canva elements — don't generate fake shop/person images
- Matzah, wine, seasonal food = good Pesach cues. Star of David = trite, avoid.
- Oil painting style for Canva-generated elements (matches blog imagery)
- Hero image ratio: ~12:5 (600×250 for email width)
- Store image assets in `content/pesach/` (or relevant seasonal folder)

## Mailchimp Process

1. **New campaign → New Builder**
2. Add **Image block** at top — upload hero image
3. Add **Code block** below — paste inner HTML only (the `<h1>` through closing `<p>`, not the full document)
4. Mailchimp handles outer wrapper, background, unsubscribe footer
5. **Two separate sends** — EN and HE to language-segmented lists
6. Send timing: Tuesday evenings (established pattern)

## File Structure

- `marketing/newsletter/issues/2026-06/2026-06-handling-en.html` — English email (full HTML for reference)
- `marketing/newsletter/issues/2026-06/2026-06-handling-he.html` — Hebrew email (RTL, full HTML for reference)
- Per-issue image assets live alongside each issue's HTML under `marketing/newsletter/issues/<month>/`

## Hebrew Version Checklist

- `dir="rtl"` on `<html>` and `<body>`
- `direction:rtl; text-align:right` on content `<td>`
- CTA link uses `/he/` prefix (WPML)
- Closing in Hebrew (חג כשר ושמח, אביתר)
- Preview text in Hebrew
- Same image — no need to create a separate Hebrew hero

## What NOT to Do

- Don't add logo — this is a personal note, not a newsletter
- Don't add multiple CTAs — one button, one destination
- Don't make the image clickable — it's a mood-setter above the message
- Don't use stock imagery or AI-generated people/shops
- Don't use religious symbols as decoration (Star of David, menorah, etc.)
- Don't include placeholder image URLs in the code — image goes in Mailchimp's Image block
