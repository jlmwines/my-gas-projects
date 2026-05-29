# UI Tier 2.6 — TaskWidgets adoption rollout (6 consumers)

**Session ID:** UI_T2_6
**Status:** SHIPPED 2026-05-29 @156 deploy @160 (all 6 stages). Plan v1 (2026-05-28). All gaps resolved via code reading:
- 6 consumer files inventoried with exact call-site counts and helper signatures.
- All local `escape` variants are forward-compatible with `TaskWidgets.escape` (kit is strict superset — single-quote escapes idempotent when not present).
- All local date helpers map to kit equivalents from T2.5: `formatDate` (ISO) / `formatDateShort` (M/D) / `formatDateFull` (locale).
- **`AdminInventoryView.formatLastCount` stays local** — its '—' fallback for null/invalid dates diverges from kit's behavior (kit returns empty string on null, raw input on invalid). Wrapping in kit calls would be uglier than keeping the 6-line helper.
- **`AdminContactsView.isDateString` stays local** — validation helper, not formatting; no kit equivalent.
- **No new kit additions needed.** T2.5 left the kit with everything required.

**Parent:** `UI_AUDIT.md` §5 Tier 2.6
**Estimated effort:** 1 session, 6 staged deploys (one consumer per stage; smallest-to-largest scope).
**Depends on:** **T2.5 must ship first** (kit extended with `formatDateShort` + `formatDateFull`). Soft order: ship Stage A after T2.1 has landed since T2.1 modifies AdminBundlesView; doing T2.6 Stage A on top of stale code requires re-base.

## Session goal

Migrate 6 consumer views to the shared TaskWidgets kit established in T2.5. Each stage: add scriptlet include, replace helper calls with kit-prefixed equivalents, delete local helper definitions. **84 total call sites** across 6 files; net ~30 lines of helper definitions removed.

## Migration recipe (applies to every stage)

The T2.5 deep-dive established this pattern. Re-stated for clarity:

1. **Add scriptlet include at top of file**: `<?!= include('TaskWidgets') ?>` immediately before the file's existing `<style>` block (or as the first line if no style block).
2. **Replace local-helper calls** with `TaskWidgets.<helper>(...)` form. Use Edit `replace_all: true` where the local helper name doesn't appear in a definition context (e.g., `esc(x)` → `TaskWidgets.escape(x)`).
3. **Delete the local helper definition** after all call sites updated.
4. **Smoke**: open the view, run its primary interactive flows, check console for `<helperName> is not defined` errors.
5. **Per-stage commit + push + smoke + deploy** (memory `feedback_clasp_push_not_deploy`).

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. **Verify T2.5 already shipped** — open `jlmops/TaskWidgets.html`, confirm `TaskWidgets.formatDateShort` and `TaskWidgets.formatDateFull` are defined. If absent, ship T2.5 first.
5. Re-read `jlmops/TaskWidgets.html:140-193` JS block to confirm current helper signatures.
6. Open `.claude/bugs.md` — confirm no open bug on the consumer files that would conflict.

## Stage A — AdminBundlesView (smallest: 5 call sites, escapeHtml only)

**Anchors.**
- Local helper definition: `AdminBundlesView.html:1175-1183` (`escapeHtml`, full escape including `'`).
- Call sites: 5 occurrences of `escapeHtml(` across the file (grep at session start to enumerate exact lines; expected concentration in the render functions around `:268-309, :333-403`).

**Changes.**

1. Add scriptlet include before the existing `<style>` block at `:1`:
   ```html
   <?!= include('TaskWidgets') ?>
   ```
2. Replace all 5 `escapeHtml(` calls with `TaskWidgets.escape(`. Use `Edit replace_all: true`:
   ```
   old: escapeHtml(
   new: TaskWidgets.escape(
   ```
   The definition site at `:1175` also matches but the next line context (`function `) is unique enough to leave intact for now; after replace_all, do a separate Edit removing the definition.
3. Delete the `escapeHtml` function definition at `:1175-1183`.

**Smoke A.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T2.6 stage A: AdminBundles adopts TaskWidgets (escapeHtml → escape)"`.
- Open AdminBundles. Confirm: bundle list renders identically. Click any bundle row → editor opens (T2.1's hide-until-click behavior preserved). Open Slot Edit Modal (T2.1's modal-overlay version) → edit a slot → save → confirm rendered text in updated slot list does not have HTML breakage.
- Browser console: zero errors. No `escapeHtml is not defined`.

**Rollback A.** Git revert + redeploy.

**Commit A.** `ui(AdminBundles): adopt TaskWidgets (replace local escapeHtml with kit's escape)`

## Stage B — AdminInventoryView (7 sites; only escapeHtml migrates)

**Anchors.**
- Local helper definitions: `AdminInventoryView.html:578-582` (`escapeHtml`, full escape) and `:584-589` (`formatLastCount`, **keeps local**).
- Call sites: ~6 of `escapeHtml(`, plus call sites of `formatLastCount(` (those stay).

**Pre-change verification.**
- Grep `escapeHtml(` in `AdminInventoryView.html` to enumerate sites.
- Grep `formatLastCount(` — these stay; do not migrate.

**Changes.**

1. Add scriptlet include at `:1`.
2. Replace all `escapeHtml(` calls with `TaskWidgets.escape(`. Use `Edit replace_all: true`.
3. Delete the `escapeHtml` function definition at `:578-582`.
4. **Leave `formatLastCount` at `:584-589` intact** — '—' null fallback semantics differ from kit; keep local. Optionally add a comment above the definition explaining why it isn't migrated:
   ```javascript
   // formatLastCount: kept local; returns '—' on null/invalid where TaskWidgets.formatDate
   // returns empty string / String(iso) respectively. Different display contract.
   function formatLastCount(iso) {
     ...
   }
   ```

**Smoke B.**
- Deploy. Open Admin Inventory. Confirm:
  - Counts review table renders with same content.
  - Last-count timestamp column shows `'—'` for rows without timestamps (formatLastCount path preserved).
  - Vintage preview rows render escaped text identically.
- Browser console: zero errors.

**Rollback B.** Git revert + redeploy.

**Commit B.** `ui(AdminInventory): adopt TaskWidgets escape (formatLastCount stays local due to '—' fallback semantics)`

## Stage C — ManagerContactView (8 sites; esc only)

**Anchors.**
- Local helper definition: `ManagerContactView.html:189-194` (`esc`, full escape).
- Call sites: 8 occurrences of `esc(` in the file (grep at session start to confirm).

**Changes.**

1. Add scriptlet include at `:1`.
2. Replace all `esc(` calls with `TaskWidgets.escape(`. **Caution with replace_all**: the local function name `esc` is short; grep first to confirm no false-positive matches (e.g., `esc` appearing inside a variable name like `description`). Expected matches: all 8 are isolated function calls like `esc(task.name)`.
3. Delete the `esc` function definition at `:189-194`.

**Pre-change verification (resolve at session start, in <30 seconds).**
- Run `grep -n "esc(" jlmops/ManagerContactView.html` — confirm all 8 matches are call sites, not substring matches inside identifiers.

**Smoke C.**
- Deploy. Open Manager Contacts on phone (or desktop with narrow viewport):
  - Type search query → results render with escaped names/emails.
  - Click a contact → detail panel shows activity timeline with escaped text.
  - Click "Log activity" → modal opens; submit creates activity row.
- Console: zero errors.

**Rollback C.** Git revert + redeploy.

**Commit C.** `ui(ManagerContact): adopt TaskWidgets escape (replace local 'esc')`

## Stage D — AdminContactsView (5 sites; escapeHtml only; isDateString stays)

**v2 correction:** v1 said 10 occurrences; code-anchor agent grep returned 5. Updated to 5. Migration recipe unchanged.

**Anchors.**
- Local helper definitions: `AdminContactsView.html:1162-1165` (`escapeHtml`, 4-char — no `'`; safe to migrate to kit's strict-superset escape) and `:1167-1170+` (`isDateString`, **keeps local**).
- Call sites: 5 occurrences of `escapeHtml(` (verified 2026-05-28); plus `isDateString(` call sites that stay.

**Note:** T2.2 will have shipped before T2.6 per ship order. T2.2 added the Admin operations panel (collapsible card) inside AdminContactsView. Confirm the file structure at session start is post-T2.2 state.

**Changes.**

1. Add scriptlet include at `:1`.
2. Replace all `escapeHtml(` calls with `TaskWidgets.escape(`.
3. Delete `escapeHtml` definition at `:1162-1165`.
4. **Leave `isDateString` intact** (validation helper, not formatting).

**Smoke D.**
- Deploy. Open Admin → CRM Tools. Confirm:
  - Admin operations panel (T2.2 outcome) renders.
  - Contact list renders escaped names + emails.
  - Click a contact → detail panel renders.
  - Open Log Activity / Create Task / Compose Email modals — all open and submit cleanly.
- Console: zero errors. **No regression to corrupted-date detection** (isDateString preserved).

**Rollback D.** Git revert + redeploy.

**Commit D.** `ui(AdminContacts): adopt TaskWidgets escape (isDateString validation helper stays local)`

## Stage E — AdminCampaignsView (20 sites: esc + formatDate)

**Anchors.**
- Local helper definitions: `AdminCampaignsView.html:46-50` (`esc`, full) and `:52-58` (`formatDate`, ISO yyyy-mm-dd format — directly compatible with kit's `formatDate`).
- Call sites: 20 total combined.

**Changes.**

1. Add scriptlet include at `:1`.
2. Replace all `esc(` calls with `TaskWidgets.escape(`.
3. Replace all `formatDate(` calls with `TaskWidgets.formatDate(`.
4. Delete both local helper definitions at `:46-58`.

**Pre-change verification.**
- Grep `esc(` and `formatDate(` separately to enumerate sites and verify no substring false-positives.

**Smoke E.**
- Deploy. Open Admin Campaigns:
  - Campaign list renders with date columns (ISO yyyy-mm-dd) identical to before.
  - Click to expand a campaign row → linked Projects + Short URLs tables render with escaped content.
  - Status colors (cmp-status-* classes) preserved.
- Console: zero errors.

**Rollback E.** Git revert + redeploy.

**Commit E.** `ui(AdminCampaigns): adopt TaskWidgets (esc + formatDate; both directly compatible)`

## Stage F — AdminProjectsView (34 sites: esc + formatDate + formatDateShort + formatDateInput)

**Anchors.**
- Local helper definitions:
  - `AdminProjectsView.html:1951-1957` (`formatDate`, locale format) → migrate to `TaskWidgets.formatDateFull`
  - `AdminProjectsView.html:1959-1968` (`formatDateShort`, M/D format) → migrate to `TaskWidgets.formatDateShort`
  - `AdminProjectsView.html:1970-1976` (`formatDateInput`, ISO yyyy-mm-dd format) → migrate to `TaskWidgets.formatDate`
  - `AdminProjectsView.html:1978-1981` (`esc`, 4-char — no `'`; safe to migrate to kit's strict-superset)
- Call sites: 34 total combined across the 4 helpers.

**Pre-change verification (largest stage; care needed).**
- Run grep per helper to enumerate sites: `grep -n "formatDate(\|formatDateShort(\|formatDateInput(\|esc(" jlmops/AdminProjectsView.html`.
- Confirm no false-positive substring matches (especially for `esc(` — short name; check for occurrences inside identifiers like `description`).

**Changes.**

1. Add scriptlet include at `:1`.
2. Replace per-helper, **in this order** to avoid name-collision confusion:
   - `formatDateInput(` → `TaskWidgets.formatDate(` (most-specific name first)
   - `formatDateShort(` → `TaskWidgets.formatDateShort(`
   - `formatDate(` → `TaskWidgets.formatDateFull(` (this is the rename: local `formatDate` = locale; kit equivalent is `formatDateFull`)
   - `esc(` → `TaskWidgets.escape(`
3. Delete all 4 local helper definitions at `:1951-1981`.

**Critical ordering note:** if you do `formatDate(` → `TaskWidgets.formatDateFull(` BEFORE `formatDateShort(` → `TaskWidgets.formatDateShort(`, the first replace will match `formatDate` inside `formatDateShort(` and corrupt the second helper's call sites. Use **exact-match Edit operations** with surrounding context, OR do the longer names first.

**Smoke F.**
- Deploy. Open Admin Projects:
  - Projects list renders (both panel states 1/2/3).
  - Click a project row → detail panel renders with locale-formatted dates (post-rename `formatDateFull`).
  - Click a task row → detail panel renders with ISO date inputs (`formatDate` for inputs).
  - Click "Create Project" → modal renders.
  - Tasks list shows M/D format in compact columns (formatDateShort).
  - Filter changes work.
- Browser console: zero errors. No `formatDate is not defined` / `esc is not defined`.

**Rollback F.** Git revert + redeploy.

**Commit F.** `ui(AdminProjects): adopt TaskWidgets (4 helpers: esc + formatDate→formatDateFull + formatDateShort + formatDateInput→formatDate)`

## Session-end checklist

After all 6 stages committed + deployed:

1. **Git log review.** Six fix commits.
2. **TaskWidgets adoption verified across 7 consumers** (LibraryView from before + 6 from this session + ManagerDashboardView_v2 from T2.5 = 7). No consumer should still have a local `escapeHtml` / `esc` / `formatDate` (except AdminInventoryView's `formatLastCount` and AdminContactsView's `isDateString`, both intentionally local).
3. **Line count check.** Total ~30 lines of helper definitions removed (5 + 5 + 6 + 4 + 12 + 28 + ~10 from T2.5 = ~70 net reduction since kit shipped).
4. **Update `UI_AUDIT.md` §10 status:** mark T2.6 SHIPPED with deploy refs.
5. **Update `.claude/session-log.md`:** brief note.
6. **CCP-UI audit per stage:**
   - CCP-UI-6 (shared kit + scriptlet include): applied to all 6 files.

## Notes for future sessions

- **TaskWidgets now consumed by 7 of ~14 routed views.** Remaining views that don't render task/contact atoms (e.g., AdminSyncView, ManagerOrdersView, ManagerProductsView) don't need the kit. The "extend kit before adopting" recipe from T2.5 is the canonical pattern when new consumers need new helpers.
- **Tier 5.3 (shared list component) decision point:** after T2.6 lands, audit the 7 consumers' filter+sort+render shapes against each other. If structural commonality is high (≥4 consumers with near-identical filter-bar / sortable-table / row-click-detail patterns), proceed with Tier 5.3 extraction. If patterns diverge, leave 5.3 deferred (Library-style anti-pattern: don't build shared infrastructure for hypothetical reuse).
