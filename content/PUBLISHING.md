# Blog Publishing Pipeline

How a finished `.post.md` becomes a WordPress post. This is the reference for what the scripts in `content/` expect and what they do — read it before pushing a post or changing the scripts. The companion source-file format (sections, parser rules) lives in `content/CLAUDE.md`; the planned enhancement lives in `content/PUBLISH_ENHANCEMENT_PLAN.md`.

## The two scripts

**`upload-<topic>-images.js`** — one-shot, per post. Uploads the local Canva PNGs from the post's own folder to the WP media library (with alt text + title), then substitutes the returned media IDs/URLs into the `__IMG_N_ID__` / `__IMG_N_URL__` placeholders in both `.post.md` files. The **featured** image is uploaded too but is *not* in the body — its media ID is stamped into `## FEATURED MEDIA` (see below). These scripts are written fresh per post; they are not manifest-driven.

**Two directory depths exist — copy the matching template, don't just paste-and-tweak the other one:**

- **Flat posts** (`Context`, `Handling`) — script and `.post.md` files sit directly in `content/`, images one level down in `content/<topic>/`. Template: `upload-handling-images.js`. From `content/`: `CRED_PATH = path.join(__dirname, '..', '.wp-credentials')`, `require('../../tools/wp-api')`.
- **Region posts** (`content/regions/<region>/`, one folder per region — Negev is the first) — script, `.post.md` files, and images are all co-located in that one folder. Template: `content/regions/negev/upload-negev-images.js`. From `content/regions/<region>/` (two levels deeper than flat posts): `NEGEV_DIR`-equivalent = `__dirname` (everything's alongside the script), `CRED_PATH = path.resolve(__dirname, '../../../.wp-credentials')`, `require('../../../../tools/wp-api')`. **Getting this wrong doesn't error at write time** — `fs`/`path` calls resolve silently to a wrong-but-valid path, and the failure only shows up when the script actually runs (file-not-found or module-not-found). Double-check the directory depth before running, not after.

**`push-posts.js`** — the repeatable publisher. Manifest-driven, slug-keyed, idempotent. Reads a `.post.md`, parses three sections, and POSTs them to WordPress. Re-running updates the same post by its pinned ID.

## What `push-posts.js` sends — and what it does NOT

It sends: **title** (`## TITLE`), **excerpt** (`## EXCERPT`), **content** (everything after `Paste below into WordPress Code Editor:`, wrapped in a `wp:html` block), **`featured_media`** when the source has a `## FEATURED MEDIA` section holding a media ID, and **`categories`** when the post's manifest entry carries an `enCategoryId`/`heCategoryId`. Both are optional — absent posts push unchanged. The parser ignores every other `##` section (Newsletter Excerpt, Print Newsletter Body, CTA, Image Prompts, Notes) — they are human-facing references.

It does **NOT** set: **post status** (so an existing draft stays a draft — there is no publish step here), **focus keyword**, or the **RankMath SEO snippet / meta description**. Those stay manual in wp-admin. The RankMath fields **cannot** be automated through this pipeline: their meta keys (`rank_math_focus_keyword`, `rank_math_description`) are not registered for REST, so the core API silently ignores writes (verified 2026-06-17). Automating them would require a server-side must-use plugin — see `PUBLISH_ENHANCEMENT_PLAN.md`. Featured image and category are done.

## The manifest

Each post is one entry in the `MANIFEST` array in `push-posts.js`. To register a new post, add an entry with: `name` (the CLI handle), `enSlug`/`heSlug`, `enId`/`heId` (the pinned WP post IDs — direct update by ID, no slug guessing), and `enFile`/`heFile` (the `.post.md` filenames). Optionally add `enCategoryId`/`heCategoryId` to set the post's category per language (WPML translates a category into two term IDs — e.g. Basics is `947` EN / `948` HE; query `categories?slug=<slug>&lang=he` to resolve the HE term). EN and HE share the same WP media IDs (images uploaded once). If `enId`/`heId` is absent, the script falls back to slug-based upsert (create-or-update), used for brand-new posts.

## Credentials & target

Auth comes from `.wp-credentials` at the repo root (`url` / `username` / `app_password`), consumed via the shared client `projects/tools/wp-api.js` (zero-dep REST wrapper: `api`, `upsertPost`, `uploadMedia`). **The `url` currently points at the LIVE site, `jlmwines.com`** — not staging. Pushing therefore writes to live drafts. There is no `/dev` round-trip; a push lands on the real post immediately (as a draft until someone publishes).

## Commands

```
node content/push-posts.js                  # list all posts in the manifest
node content/push-posts.js <name>           # push EN only
node content/push-posts.js <name> --he      # push HE only
node content/push-posts.js <name> --both    # push EN + HE
node content/push-posts.js --all --both     # push every post, both languages
```

## Manual checklist after a push (wp-admin)

The script gets the words, the featured image, and the category onto the post; a human still finishes the rest in wp-admin:

1. **Focus keyword** (RankMath) — set.
2. **SEO snippet / meta description** (RankMath) — paste. The EN meta description is usually drafted in the post's `## NOTES`; HE often still needs one written.
3. **WPML link** — link the HE and EN posts as translations of each other.
4. **Publish** — when reviewed (the script never publishes).

(Featured image is set by the push when `## FEATURED MEDIA` is present; category is set when the manifest entry has `enCategoryId`/`heCategoryId`.)
