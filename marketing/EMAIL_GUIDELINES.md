# JLM Wines — Email Creation Guidelines

## Brand Voice in Email

Same as all JLM communications (see `business/CONTENT_STRATEGY.md`):
- Personal, warm, plain-spoken
- From Evyatar — first person, like a note from a friend
- Never condescending, never salesy
- No logo in body — sender name IS the brand

## Design Decisions

| Element | Choice | Rationale |
|---------|--------|-----------|
| Layout | Single column | Mobile-first (41%+ open on phone), multi-column crushes on small screens |
| Hero image | Yes, via Mailchimp Image block | Sets mood, not in HTML code — keeps code clean |
| CTA | One button, charcoal (#32373c) white text | Outperforms text links; matches site; one CTA avoids confusion |
| Inline links | Remove from body when button exists | Don't compete with the primary CTA |
| Closing | Personal sign-off from Evyatar, below button | Warm ending after the action prompt |
| Fonts | Marcellus (headings), Open Sans (body) | Matches website |
| Text color | #32373c (headings), #444444 (body) | Matches website |
| Background | #ffffff content, #f4f4f4 outer | Clean, warm |

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

- `exchange/pesach-email-en.html` — English email (full HTML for reference)
- `exchange/pesach-email-he.html` — Hebrew email (RTL, full HTML for reference)
- `content/pesach/` — Image assets (header, textures)

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
