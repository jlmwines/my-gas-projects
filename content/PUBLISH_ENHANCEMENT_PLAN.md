# Plan — Extend `push-posts.js` to set featured image, category & SEO

**Status: featured image + category shipped; RankMath meta blocked — not REST-writable, stays manual pending a decision.** Goal: shrink the post-push manual checklist in `content/PUBLISHING.md` by having `push-posts.js` also set the four non-status items it skipped — featured image, category, focus keyword, and the RankMath meta description — so a push leaves only "review and publish" for a human. Status is deliberately left out of scope: the script must keep never auto-publishing.

## Current state

The push payload is `{ title, content, excerpt }` only (see `pushPost()` in `push-posts.js`). The shared client `projects/tools/wp-api.js` exposes a generic `api(method, path, body)`, so any additional REST-writable post field can be added to that payload with no new dependency. WP core REST natively accepts `featured_media` (int) and `categories` (int[]) on the post object. RankMath fields are post **meta** (`rank_math_focus_keyword`, `rank_math_description`) and are only writable through REST `meta` if RankMath registered them with `show_in_rest` on this site — that is the one unknown to verify.

## Where the new values come from

Per-post data belongs in the `.post.md` source (consistent with how title/excerpt are parsed), not hardcoded. Adding new `##` sections between EXCERPT and the body marker is explicitly safe per `content/CLAUDE.md`. Proposed new sections:

- `## FEATURED MEDIA` — the featured image's WP media ID. The image-upload script already prints this; have it also stamp the value into both `.post.md` files (same mechanism it uses to substitute body image IDs), so the ID travels with the post instead of living only in a console log.
- `## FOCUS KEYWORD` — one per language (HE keyword differs from EN).
- `## META DESCRIPTION` — one per language (EN is usually already drafted in `## NOTES`; formalize it here; HE needs writing).

Category is shared across these guide posts, so it is better as a default category-ID constant in `push-posts.js`, overridable by an optional `categoryId` on a manifest entry — rather than repeated in every source file.

## Approach, field by field (ship in this order — one change at a time)

1. **`featured_media`** — DONE (2026-06-17). `push-posts.js` parses an optional `## FEATURED MEDIA` section and adds `featured_media` to the payload; the per-post image-upload script stamps the ID via a `__FEATURED_ID__` placeholder (added to `_post-template.md`). Verified on Handling: both 67497/67500 read back `featured_media:67502`, status still `draft`.
2. **`categories`** — DONE (2026-06-17). Optional per-language `enCategoryId`/`heCategoryId` on the manifest entry → `payload.categories = [id]` (opt-in; no global default, so posts without it are untouched). Handling set to Basics `947` EN / `948` HE (WPML-translated terms); verified read-back `[947]`/`[948]`, status still `draft`.
3. **RankMath meta** — BLOCKED (probed 2026-06-17). The keys are **not REST-exposed**: a `context=edit` GET on post 67497 returns only `footnotes` in `meta`; a test write of `rank_math_focus_keyword` returned `200` but silently dropped (read-back `undefined`). So core REST cannot set the focus keyword or meta description on this site — they stay manual unless we expose them. The only way to automate is a small must-use plugin running `register_post_meta('post', 'rank_math_focus_keyword'/'rank_math_description', { show_in_rest: true, single: true, type: 'string', auth_callback })` — a live-WP server change (FTP), out of scope for the push pipeline and not built without explicit OK.

## Risks & guards

- RankMath REST meta may silently no-op or 403 — hence the read-back verification gate before relying on it.
- A wrong `featured_media` or `categories` ID is a visible, easily-corrected mistake, not a data risk.
- Keep every new field **optional**: a post with no `## FEATURED MEDIA` / no SEO sections pushes exactly as today. This keeps already-live posts and reference-only spokes working unchanged.
- Still no status change — review-and-publish stays a human step.

## Open decisions for the user

1. ~~Category~~ — RESOLVED: per-post opt-in via manifest; Handling = Basics (947 EN / 948 HE).
2. **RankMath** — CONFIRMED not REST-writable (see step 3). Decision now: add a tiny must-use plugin to `register_post_meta(... show_in_rest)` for the two keys (live-WP/FTP change), or leave focus keyword + meta description manual. Default recommendation: leave manual — it's two quick fields in wp-admin and the mu-plugin is server surface for marginal gain.
3. **Per-language SEO** — confirm focus keyword + meta description are authored separately for EN and HE (assumed yes).

## Done when

A `push-posts.js <name> --both` on a post whose source carries the new sections leaves only "review and Publish" in wp-admin — featured image, category, focus keyword, and meta description all set by the push, verified by reading the post back through the API.
