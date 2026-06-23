# Content Distribution Plan

Extends the content library/task model (see `CONTENT_WORKFLOW_REDESIGN_PLAN.md`) to cover newsletter and email distribution. Status: **planning**. Nothing shipped yet.

---

## Problem

The existing model tracks blog posts (entity type `blog`) through draft → publish. Distribution channels — print newsletter and AYIW email — have no library home, no task chain, and no way to receive the live post URL after publish. Content is assembled manually from memory.

---

## Entity Types (post-extension)

| Type | Drive folder | Content | EN+HE |
|---|---|---|---|
| `blog` | `Library/blog/<slug>/` | Blog posts | Yes |
| `email` | `Library/email/<slug>/` | AYIW emails | Yes |
| `print` | `Library/print/<slug>/` | Print newsletter (Wine Talk), flyers, carton art | Yes (where applicable) |
| `image` | `Library/image/<slug>/` | Post images | No (shared) |
| `template` | `Library/template/<slug>/` | Draft templates only — post, ayiw, newsletter | No |

**AYIW** lives under `email` type. Current `blog/ayiw-june/` folder is misplaced — user will relocate after library setup is final.

**Print** is a new entity type covering all physical output: printed newsletter (Wine Talk), flyers, carton art. The newsletter is assembled by admin from blog post PRINT NEWSLETTER BODY + AYIW body, then EN and HE Google Docs are attached. Manager prints from those docs. Images and QR codes are local files, not library entities.

**Templates folder** holds only draft-structure templates: `template-post`, `template-ayiw`, `template-newsletter`. Not content instances. Any newsletter instances currently there are misplaced and should move to `Library/print/`.

---

## Task Chains

### Newsletter (new)

Spawned by admin when a newsletter issue is ready to assemble.

1. `task.content.newsletter.create-en` — admin assembles EN newsletter doc (blog excerpt + AYIW body + layout)
2. `task.content.newsletter.create-he` — admin assembles HE version
3. `task.content.newsletter.print` — manager prints EN + HE and distributes

Both create tasks are EN/HE attachable (same `attachExistingDoc` / `createBlankDoc` pattern as blog). Print task closes when physical distribution is done.

### AYIW email (new)

Spawned per issue.

1. `task.content.email.create-en` — admin drafts AYIW email body (EN)
2. `task.content.email.create-he` — admin drafts AYIW email body (HE)
3. `task.content.email.send` — admin sends (Mailchimp or GmailApp; closes on send confirmation)

---

## Post-Publish URL Stamp

When a session pushes a blog post to WordPress it receives back the actual published URL. The session cannot edit an existing Drive doc in place (Decision 7), and the calendar is editorial intent — not the right home for operational facts.

Each blog post already has a local working folder at `content/<slug>/` where images are stored. After a successful WordPress push the session writes a `urls.md` file to that folder:

```
EN: https://jlmwines.com/<slug>
HE: https://jlmwines.com/he/<slug>
Published: YYYY-MM-DD
```

This file:
- Lives with the post's other assets, findable by any future session
- Is the source for QR code generation (QR stored in the same folder or in `marketing/newsletter/issues/<yyyy-mm>/`)
- Gives the admin/session the URL pair when drafting the AYIW email or assembling the newsletter doc

GAS `markPublished` also logs the URL to the SysLibrary activity feed via `logEntityActivity` — this surfaces it in the LibraryView drawer for visibility, at no extra cost.

---

## Draft Template Word Count Targets

The `_post-template.md` (blog post source format) defines what text each post must supply. Targets below are calibrated to what actually fits:

| Section | Target | Used by |
|---|---|---|
| Title | 50–70 chars | WordPress, newsletter header |
| WP Excerpt | ~150 chars | WordPress category/search |
| NEWSLETTER EXCERPT (web/social) | ~50 words | Social, email teasers |
| PRINT NEWSLETTER BODY | 120–150 words | Left column of Wine Talk A5 |
| CTA | one line | Post body, newsletter footer |

AYIW email has its own simple template (`template-ayiw`):

| Section | Target |
|---|---|
| Subject line | ~50 chars |
| Preview text | ~90 chars |
| Body (EN) | 100–130 words (allows picture alongside) |
| Body (HE) | same |
| CTA | one line |

Newsletter doc is assembled manually — no machine template. The newsletter Google Doc itself is the artifact.

---

## Build Sequence

**Step 1 — Schema: add `print` entity type**
Append `print` to the valid `slb_EntityType` values in `config/schemas.json`. No new SysConfig folder key needed — `LibraryService._getCanonicalFolder(type, concept)` reads only `system.folder.library` (already configured) and auto-creates `Library/<type>/<slug>/` subfolders on demand via `_getOrCreateChildFolder`. Run `generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`.

**Step 2 — LibraryService: print folder routing**
`LibraryService._getEntityFolder(type)` already maps type → folder. Add `print` case. `spawnContentChain` already works for any type; it will work for print once the folder is registered.

**Step 3 — Task definitions: print + email task types**
Add to `config/taskDefinitions.json`:
- `task.content.print.create-en`
- `task.content.print.create-he`
- `task.content.print.distribute`
- `task.content.email.create-en`
- `task.content.email.create-he`
- `task.content.email.send`

These follow the same shape as existing `task.content.*` types (doc-attachable, assignable, language-flagged).

**Step 4 — TaskPacks: pack bodies for new types**
Add pack rendering in `TaskPacks.packBody()` for the new task types. Print create packs: same as blog content-edit (Open Doc, Editing Done). Print distribute pack: simple confirm button. Email create packs: same as content-edit. Email send pack: confirm send button.

**Step 5 — URL stamp on publish**
In `LibraryService.markPublished(slug)`, after state update, resolve `jlmwines.com/<slug>` and `jlmwines.com/he/<slug>`, find all entities where `slb_References` contains the slug, and call `logEntityActivity` with type `url-stamped` and the URL payload. LibraryView drawer activity tab will surface this automatically.

**Step 6 — `spawnContentChain` for print and email**
Verify `spawnContentChain` covers the new task type lists. Likely config-driven already — just needs the new task type keys in `taskDefinitions.json` and a `chainTasks` list per type. Confirm in `LibraryService.js` before assuming.

---

## Drive Reorganization + Register Fix

User will reorganize Drive folders (safe — Drive file IDs are stable, `slb_DocUrl` links survive moves). After reorganization, session fixes `content/register-library.js`:

1. `TYPES` updated to `['blog', 'email', 'print', 'template']` — done.
2. `slb_EntityType` added to `UPDATE_FIELDS` — done.
3. Add print manifest entries: `print-newsletter-2026-06-en/he` (and future print entities) with `content_type: 'print'`
4. Run `node content/register-library.js <print-slug>` to register print entities

Note: `print` type also needs to be appended to `slb_EntityType` valid values in `config/schemas.json` (Step 1 of build sequence) before GAS will accept print entities through the task/library system.

---

## What This Does NOT Change

- Blog post workflow is unchanged.
- `_post-template.md` structure is unchanged (word count targets only tighten slightly).
- LibraryView presets add a "Newsletter" and update "Email" — no structural change to the drawer or entity model.
- `slb_References` is the link mechanism — no new column.
- Images and QR codes remain local assets, never in the library.
