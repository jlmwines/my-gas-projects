# JLM Wines — Operational Task Registry

A session-readable index of every recurring operational task this project supports. For each: entry-point doc, script or command, and hard constraints. This is an index, not a runbook — follow the link for the full procedure. Read this when a user asks to DO something, not just orient.

---

## Content

**Publish a blog post**
- Procedure: `content/PUBLISHING.md`
- Command: `node content/push-posts.js <name> --both`
- Notes: manifest-driven (add entry to `push-posts.js` MANIFEST if post is new); pushes to live site as a draft; does NOT publish. Manual wp-admin checklist after push: focus keyword, SEO snippet, WPML link, then publish.

**Upload images for a post**
- Procedure: `content/PUBLISHING.md` §"The two scripts"
- Script: write a fresh `upload-<topic>-images.js` from `upload-handling-images.js` template; run `node content/upload-<topic>-images.js`
- Notes: uploads to live WP media library; prints the featured image ID for the `## FEATURED MEDIA` section; stamps body image placeholders in the `.post.md` file.

**Upload a content draft doc to Drive (blog post draft)**
- Procedure: Drive MCP `create_file` with text content → jlmops "Attach new version"
- Steps:
  1. Get Israel timestamp: `pwsh -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetime]::UtcNow, 'Israel Standard Time').ToString('yy-MM-dd-HH-mm')"`
  2. Read the `.post.md` file with the Read tool.
  3. Call Drive MCP `create_file`: title = `<slug>-en <timestamp>`, textContent = the .md file text, contentMimeType = `text/plain`, parentId = content library folder ID (see memory `reference_drive_files.md` for IDs). Drive auto-converts plain text to a Google Doc — fast, native format, consistent with prior docs.
  4. In jlmops PublishingView → find the content entity → "Attach new version" → paste the returned URL. Old doc is superseded and archived automatically.
- Notes: use `textContent`, NOT `base64Content` + pandoc .docx. The .docx path is slow, forces a binary conversion, and produces different formatting. Timestamp via PowerShell timezone API only (Git Bash returns UTC).

**Register content in the jlmops library**
- Procedure: `content/register-library.js` header (read it — covers all modes)
- Command: `node content/register-library.js <slug>` (or `--all`, `--update`)
- Notes: writes to `JLMops_Library` (single-tab, Drive-MCP-readable). Requires service-account JSON at `.gcp-credentials.json`. Add manifest entry to the script first.

**Format a docx for WordPress**
- Procedure: `/pformat` skill
- Command: `/pformat <filepath>`
- Notes: runs pandoc, produces a `.post.md` with WordPress block HTML in 2-column layout.

---

## Marketing

**Create a promo or companion email (HTML for Mailchimp)**
- Procedure: `marketing/EMAIL_GUIDELINES.md`
- Templates: `marketing/newsletter/issues/2026-06-handling-en.html` + sibling HE file (current reference examples)
- Notes: write inline HTML only (the `<h1>` through closing `<p>`); Mailchimp wraps the outer structure. Two sends — EN and HE to language-segmented lists. Hero image goes in a Mailchimp Image block, not in the code.

**Create the newsletter (print insert + companion email)**
- Procedure: `marketing/NEWSLETTER_PLAN.md`
- Pattern: most-recent issue in `marketing/newsletter/issues/` — copy structure
- Session produces (all files local — session-owned, user pastes from them):
  1. `<YYYY-MM>-<label>-en.md` + `he.md` — two sections (`## LEFT COLUMN` / `## RIGHT COLUMN`), plain text only, no table or image refs (QR images live in the Drive template)
  2. Convert to docx: `pandoc <file>.md -o <file>.docx` (run for both EN + HE)
  3. `<YYYY-MM>-<label>-email-en.html` + `email-he.html` — Mailchimp-ready code block
- User opens each .docx → copies left block into Drive template left cell, right block into right cell → prints (EN front / HE back)
- User opens each .html → pastes into Mailchimp Code block (after adding hero Image block) → schedules
- After output files are ready: register issue as library entities (see Register content below) — one EN+HE pair per issue, content_type='email', slug prefix `email-newsletter-<YYYY-MM>-`

---

## Deployment

**Deploy jlmops code to production**
- Command: `pwsh -NoProfile -File jlmops/deploy.ps1 "<description>"`
- Notes: NEVER bare `clasp deploy` — use the wrapper only. The wrapper stamps `VERSION.built`, runs `clasp push`, then deploys to the pinned ID. Needs explicit user OK before running.

**Deploy theme to live**
- Command: `pwsh -NoProfile -File website/deploy-theme.ps1`
- Notes: FTP push to the LIVE site (staging removed 2026-05-07). Ask before every deploy.

**Update jlmops config (system/jobs/schemas/etc.)**
- Workflow: edit `jlmops/config/*.json` → `node jlmops/generate-config.js` → `clasp push` → run `rebuildSysConfigFromSource()` in Apps Script
- Notes: `SysConfig.js` is generated — never edit it directly.

---

## Ops review

**Read live ops health and KPIs**
- Procedure: `/review-daily` skill (reads `jlmops-status.md` from Drive)
- Notes: the ONLY session window into ops state — the web app is domain-auth (WebFetch blocked) and `JLMops_Data`/`JLMops_Logs` are multi-tab (Drive MCP can't read them usefully). jlmops writes `jlmops-status.md` on a 15-min cadence; `/review-daily` reads it by title search via Drive MCP.

---

## SEO verification

**Check post SEO after publishing**
- Procedure: `plans/RANKMATH_WPML_AUDIT.md` + `plans/SEO_AUDIT_2026-05-06.md`
- Mechanism: curl + RankMath MCP (use curl with the ability endpoints; in-Claude MCP calls hang — see memory `reference_rankmath_mcp_curl.md`)
- Notes: RankMath focus keyword and meta description are NOT REST-writable from the push script; set them manually in wp-admin.

---

## Drive access constraints

Sessions cannot reach operational data directly. The rules:

- `JLMops_Data`, `JLMops_Logs`, `JLM GA4 Weekly`, `JLM GSC Weekly` — all multi-tab; Drive MCP cannot read them usefully. Don't try.
- `jlmops-status.md` — the ops-session bridge artifact. Single flat file, Drive-MCP-readable by title search. Contains live ops health + KPIs, written by jlmops on cadence. Use this, not the source workbooks.
- `JLMops_Library` — single-tab; Drive MCP CAN read it. Use to check library registration status.
- jlmwines.com web app — domain-auth; WebFetch is blocked.
- Drive MCP CAN: read single-tab Docs/Sheets/PDFs, create files, copy files (e.g. clone a newsletter template).
