# Wine Talk — Multiple Blog Categories

The Wine Talk page (`/articles/` EN, `/he/articles/` HE — template "Articles (Wine Talk)") currently shows only the **Basics** category, hardcoded. `content/guide/ISRAELI_WINE_GUIDE_PLAN.md` §Content Architecture already road-maps six eventual categories (Regions, Wineries, Grapes, History, Uniqueness, People) plus the existing Basics content — so this isn't a "make room for one more category" fix, it's "build the page for an open-ended, growing category count." This doc is the plan; not yet implemented.

## Current state (verified live 2026-07-06, re-verified same day after category creation)

- Live categories (`GET /wp-json/wp/v2/categories`): **Wine Basics** EN id `947` slug `basics` (10 posts, name changed from "Basics" — same id/slug) / HE id `948` slug `basics-he` name `יסודות היין` (10 posts); **Regions** EN id `1272` slug `regions` (0 posts) / HE id `1273` slug `regions-he` name `אזורים` (0 posts). Bundles (formerly EN `669`/HE `677`) no longer appears in either language's category list — unrelated to this plan, flagged separately.
- `website/jlmwines-theme/template-articles.php:31` hardcodes `'category' => 'basics'` in the args passed to `jlmwines_render_blog_roll()`.
- `website/jlmwines-theme/inc/sections.php:126-183` — `jlmwines_render_blog_roll()` renders one category as one self-contained section (heading + eyebrow + grid + CTA), filtering via `category_name` (single-term match, `:144-146`). That's the right shape for a homepage teaser section, but not for a category-browsing page once there are several categories: calling it once per category would stack N full sections vertically, which stops being usable well before N=6.
- Both existing categories already follow a `<slug>` / `<slug>-he` naming pattern (`basics`/`basics-he`, `bundles`/`bundles-he`) with matching term IDs 1:1. WPML resolves language from site context, independent of this fix.

## UI decision: filter tabs/pills, not stacked sections

Wine Talk stays the page/section name. Once there's a reason to have tabs at all, the row reads `All | Wine Basics | Regions` (growing as Wineries/Grapes/History/Uniqueness/People launch), default view **All**. Each card in the All view carries a small category label so it stays legible when categories are mixed together.

**A category's tab only appears once it has at least one published post** — this part is data-driven (query each candidate category's live post count / build the tab row from whichever categories a fresh `WP_Query` actually returns posts for), because it has to track content that ships on its own schedule across many future categories (Wineries, Grapes, ...), each earning its tab the day its first post publishes.

**"All" is different: it only makes sense once a second category is actually populated, and building it is not automated.** Right now Wine Basics is the only populated category — an "All" view would be identical to the single "Wine Basics" view, so there's nothing to build yet. Rather than write a runtime check that turns "All" on/off as category counts change, **"All" gets implemented as its own deliberate step, timed to when the first region post is ready to publish** (see Plan step 3 below) — not wired to auto-appear the instant a second category happens to get a post. Until then, Wine Talk can keep behaving exactly as it does today (single category, no tab row at all).

Rejected alternative: reuse `jlmwines_render_blog_roll()` as-is, once per category, stacking sections top to bottom. Works fine at 2 categories, degrades badly by 5-6 — most sections look identical and someone looking for one topic has to scroll past the rest. Tabs stay flat regardless of category count and match how someone would actually want to browse ("just show me the region posts"), at the cost of new template work now instead of a copy-paste of the existing helper.

Implementation stays server-rendered PHP (a URL/query-string param, e.g. `?topic=regions`, driving a plain `WP_Query`) — no JS framework, consistent with how the rest of the theme is built (`front-page.php`/`template-articles.php` are plain PHP templates).

## Rename: Basics → Wine Basics

User decision: rename the existing "Basics" category to "Wine Basics" (more user-legible tab/section label). This is a WordPress term-name edit only (`947`/`948` — same IDs, same slugs, same posts; only the display name changes), not a re-categorization. Do this in wp-admin (Posts → Categories) for both EN and HE terms. No code depends on the category *name* (code paths use ID/slug), so this is safe to do independently of the rest of this plan, whenever the manager has reviewed the Hebrew label if it also needs adjusting.

## Plan

1. ~~**Rename Basics → Wine Basics** (EN term `947`, HE term `948`) in wp-admin.~~ **Done** — verified live: name changed, same IDs/slugs (`basics`/`basics-he`), HE name `יסודות היין`. No template change needed — `template-articles.php`'s heading is always "Wine Talk"/`שיחת יין`, never the category name, so this rename is cosmetic-only in wp-admin and doesn't touch code.
2. ~~**Create the Regions category** in wp-admin (WPML translate-a-term flow).~~ **Done** — verified live: EN id `1272` slug `regions`; HE id `1273` slug `regions-he` name `אזורים`. Both currently 0 posts (expected — region posts aren't publishing yet).
3. ~~**Not yet — hold until the first region post is ready to publish.**~~ **Trigger condition met 2026-07-06** — Negev published live in both languages (`https://jlmwines.com/blog-negev/`, `https://jlmwines.com/he/blog-negev/`), categorized under Regions (EN `1272`/HE `1273`). The tab-row code itself is still not built (see below) — user is dual-categorizing Negev under Wine Basics too as an interim workaround so it actually surfaces on the current (still single-category) Wine Talk page in the meantime. Real work still to do: build the `inc/sections.php` multi-category render path (tab row + `category__in` filtering + per-language term resolution), the `All` view (category-label badges per card), and wire `template-articles.php` to it. Tabs for individual categories stay data-driven (only show a tab for a category with ≥1 published post); `All` is just written in as a normal tab at this point, not behind any runtime "2+ categories populated" check.
4. ~~**`content/push-posts.js`** — add `enCategoryId: 1272`/`heCategoryId: 1273` to the first region post's manifest entry.~~ **Done** — Negev's manifest entry carries both category IDs; verified set correctly on the live posts via REST API.
5. **Verify**: confirm the HE Wine Talk page's filter/labels read correctly in Hebrew (RTL layout for the tab row too, not just the text); confirm switching topics on the HE page only ever shows HE-language posts (mirror whatever makes the current Wine-Basics-only HE page correctly language-scoped); confirm a still-empty future category (e.g. Wineries, whenever its term is created ahead of its first post) doesn't get a tab until it has a published post — same rule Regions is following now.

## Status

Drafted 2026-07-06, revised same day (filter-tabs approach → post-count-gated tabs → deferred `All`/tab-row build until the first region post publishes). That trigger fired 2026-07-06 when Negev went live — categories + manifest wiring (steps 1-2, 4) are done; the actual tab-row template code (step 3) is still not built. User is temporarily dual-categorizing region posts under Wine Basics so they surface on Wine Talk before the real multi-category UI exists — a workaround, not a fix; don't mistake it for step 3 being done.
