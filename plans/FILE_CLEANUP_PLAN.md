# File & Folder Cleanup Plan — Exchange Folders + Scratch Areas

**Status: survey complete, no files touched.** Two gitignored scratch folders (`exchange/` at jlmwines root, `jlmops/exchange/`) have accumulated a large, mixed backlog with no consistent rule for what goes where or when it gets cleared. This is a real plan, not a quick pass — nothing gets deleted until each category below is reviewed and confirmed.

## Why two folders exist and what each actually holds

Both are declared in `.gitignore` as "scratch / temp folders (file exchange, screenshots, dumps)" — intentional, not an accident. But in practice they've diverged:

- **`exchange/` (jlmwines root)** — a broad, general-purpose dump: screenshots (Feb–June 2026), old HTML mockups, SEO/performance audit exports, credential files, theme zips, WPML `.po` translation strings (a whole sub-workspace under `strings/`), JSON API dumps, and a few jlmops data snapshots that shouldn't really be here (see below).
- **`jlmops/exchange/`** — almost entirely `JLMops_Data` table CSV snapshots (products, config, tasks) plus a handful of very old files from January. No doc references any specific file here by path (checked — only a narrative session-log mention exists), so this folder looks like pure ad-hoc export/debug snapshots with nothing load-bearing.

**The actual mess isn't just "two folders" — it's that the same kind of file (jlmops data snapshots) lands in *either* folder with no rule**, which is exactly what you flagged.

## Real finding: some "scratch" files are not scratch at all

Checked every `.md` doc that references an `exchange/` path (not just guessed) — several files here are load-bearing, cited by living plan docs, and must not be casually deleted:

| File / folder | Referenced by | Status |
|---|---|---|
| `exchange/rankmath-mcp.credentials.csv` | `plans/RANKMATH_WPML_AUDIT.md` | **Live credential**, actively used for RankMath MCP auth via curl. Keep, handle with care (rotate if stale, don't delete blind). |
| `exchange/seo-audit/` | `plans/SEO_AUDIT_2026-05-06.md` | Explicitly "kept for re-audit reference." Keep. |
| `exchange/strings/` (whole subfolder — 15 `.po`/`.txt` files + 2 lookup scripts) | `plans/CUTOVER_CHECKLIST.md` | Live WPML translation-string workspace, not incidental scratch. `jlmwines-he-draft.po` specifically is already flagged in the checklist as "optional: delete or keep as reference" — a decision already pending, not new. |
| `exchange/zip/jlmwines-theme-v1.0.80.zip` | `plans/CUTOVER_CHECKLIST.md` | **Stale** — checklist assumes this gets refreshed to the current theme version when needed, but current live theme is v1.2.30 (per `plans/STATUS.md`) and this zip is v1.0.80, many versions behind. The checklist's "keep this current" intent isn't being maintained. |

**Also found, and this is a real bug, not a cleanup item:** `marketing/EMAIL_GUIDELINES.md` references `exchange/pesach-email-en.html` and `exchange/pesach-email-he.html` as reference HTML — **neither file exists.** The doc is citing files that are already gone. This needs fixing in the doc regardless of what else happens here (either the files get restored from Drive/git history if they still matter, or the doc's reference gets removed).

## Proposed categories for the rest (review, not yet execute)

For everything NOT already covered above:

1. **Dated screenshots (Feb–June 2026, ~20 files)** — support-ticket/debugging evidence for issues almost certainly already resolved. Candidate for bulk removal, but I haven't cross-checked each one against an open bug — proposal: keep any screenshot dated within the last 30 days, remove the rest, unless you know of a reason to keep older ones.
2. **Old CSV/JSON snapshots with a clear "newer version exists" signal** (e.g., `ComaxProducts.csv` + a dated sibling `ComaxProducts.csv_2026-03-10...`, both from March) — these are manual point-in-time exports. Candidate for removal once confirmed nothing currently depends on the *specific old snapshot* rather than just "a recent one."
3. **Build/tool-output-shaped folders** (`coverage/`, `perf-pages/`, `perf-queries/`, `node_modules/`, `bundle-images/`) — look like regenerable tool output, not source content. Candidate for removal — regenerate on demand if ever needed again, don't keep stale copies.
4. **One-off HTML mockups / early drafts** (`home.html`, `jlm-home.html`, `jlmwines-home-*.html`, `cart 01.html`, `bundle-page.html`, etc.) — these look like pre-cutover design exploration. Given `plans/CUTOVER_CHECKLIST.md` shows the cutover already completed (per portfolio kernel note), these likely predate the live theme entirely. Candidate for removal, but worth a quick visual skim before bulk-deleting in case one is still a useful reference for a specific still-open theme question.
5. **`jlmops/exchange/`'s CSV snapshots** — no doc references any specific one by path. Candidate for a full clear, since these are reproducible by re-exporting the live sheet if ever needed, and nothing currently points at them.
6. **Everything else not yet categorized** — genuinely needs a pass to sort into one of the above; the folder has ~130 files and this survey covered the load-bearing ones plus the obvious bulk categories, not every single file individually.

## What this plan does NOT do yet

- No file gets deleted, moved, or touched as part of writing this plan.
- Credential files get flagged, never blind-deleted — if `rankmath-mcp.credentials.csv` turns out stale, that's a rotate-or-confirm decision, not a delete.
- The `pesach-email-*.html` doc-reference bug gets fixed in `EMAIL_GUIDELINES.md` separately (small, unambiguous, safe to just do) — not gated on the rest of this plan.

## Going-forward convention (to stop this re-accumulating)

Proposed, open for adjustment:

- **One rule for jlmops data snapshots:** they always go in `jlmops/exchange/`, never the root `exchange/` — stops the "same file type, two homes" problem directly.
- **Root `exchange/` is for cross-cutting scratch** (screenshots, SEO/perf exports, credentials, WPML strings) — not a generic dumping ground for anything.
- **Age-based default:** anything in either folder untouched for 60+ days and not referenced by a living doc is fair game for removal without asking each time — codify this as a recurring check in the portfolio kernel's existing Cleanup & Organization Session, rather than inventing a new cadence.
- **Local folder naming should align with the system's own identifiers — slug, campaign, content type — not ad hoc names.** Already the emerging pattern for region posts (`content/regions/<region>/` matching the entity slug, holding that region's `.post.md` pair, images, and per-post script together). Extend this as the standard: a content piece's local folder is named/keyed by its slug, session working files for a given piece live alongside it rather than in a generic scratch folder, and where a campaign or content-type grouping is relevant (e.g., the monthly companion-email set), the folder structure reflects that grouping too — mirroring the same taxonomy `SysLibrary`/`SysMarketingCampaigns` already uses, so a human (or a session) can find a piece's files by the same name they'd look it up by in jlmops.

## Next step

Confirm which of the 6 categories above to act on (all at once, or one at a time), and whether the age-based default (60 days, no doc reference) is the right bar — then I'll go through file-by-file within approved categories and report exactly what's removed before doing it, not after.
