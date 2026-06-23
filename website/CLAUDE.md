# Website Folder

Frontend code and customizations for JLM Wines website (WooCommerce/WordPress).

## Homepage Planning Docs

| Doc | Purpose |
|-----|---------|
| `HOMEPAGE_COPY.md` | Draft copy for all sections, voice strategy |
| `WEBSITE_UPDATE_PLAN.md` | Section layout, subscription strategy, implementation notes |
| `MARKET_CONTEXT.md` | Customer segments, competitors, growth strategy |
| `WEBSITE_STRATEGY.md` | Key phrases, messaging approach |

## Related Folders

- `jlmops/` — Backend operations code (Google Apps Script)
- `business/` — Strategy docs, brand voice (`CONTENT_STRATEGY.md`)
- `content/` — Blog posts, FAQ, About Evyatar

## Brand Context

- **Tone:** Friendly, personal, never talks down
- **Voice:** First-person (Evyatar) for homepage/video; "we" for blog content
- **Goal:** Make choosing wine fast and easy—no jargon, no snobbery
- **USP:** Evyatar is the product—his palate, judgment, and care

Full brand guidelines: `business/CONTENT_STRATEGY.md`

## Technical Context

- Platform: WooCommerce/WordPress
- Bilingual: Hebrew + English (JLM is only bilingual Israeli wine site)
- See `jlmops/CLAUDE.md` for backend patterns

## Critical Rules

- **Translation: never `__('…','jlmwines')`.** Only translate at runtime what can't be stored in advance. Static page content goes in real per-language Pages or `is_rtl()` PHP for chrome.
- **Theme JS lives in `main.js`.** The live site's JS optimizer strips inline `<script>` from product/hook-rendered markup. Page HTML is full-page-cached — verify changes with `curl` or `?x=1`, not a plain reload.
