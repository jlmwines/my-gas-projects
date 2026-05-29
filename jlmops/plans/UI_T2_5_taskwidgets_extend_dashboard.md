# UI Tier 2.5 — Extend TaskWidgets kit + Migrate ManagerDashboardView_v2

**Session ID:** UI_T2_5
**Status:** SHIPPED 2026-05-29 @155 deploy @159 (all 3 stages). Plan v1 (2026-05-28). All gaps resolved via code reading: formatDate format divergence resolved (kit gets `formatDateShort` + `formatDateFull`; existing `formatDate` ISO stays for LibraryView), escapeHtml is safe to migrate (kit's escape is strict superset), isOverdue is inline-replaceable via existing `dueClass`, status/priority/due-chip atoms are NOT used by this view (no migration needed for them — defer to Tier 2.6 for views that hand-roll them).
**Parent:** `UI_AUDIT.md` §5 Tier 2.5
**Estimated effort:** 1 session, 3 staged deploys.
**Depends on:** Nothing structural. Independent.

## Session goal

Migrate ManagerDashboardView_v2 to the shared TaskWidgets kit. Extend the kit with the two date helpers ManagerDashboardView_v2 needs (`formatDateShort` for `M/D`, `formatDateFull` for locale). Adopt the include scriptlet pattern. Remove duplicated helpers (~30 lines) and the duplicated `.task-filters` CSS. Closes the audit's observation that TaskWidgets is consumed by exactly one view.

This session also **establishes the migration recipe** for Tier 2.6 (rolling out adoption to AdminCampaignsView, AdminProjectsView, AdminContactsView, AdminBundlesView, AdminInventoryView, ManagerContactView). The recipe is: extend kit with whatever the next consumer needs, then migrate that consumer.

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh (`clasp deployments` returns expected list).
4. Read `jlmops/TaskWidgets.html` (193 lines) to refresh current kit shape.
5. Read `jlmops/ManagerDashboardView_v2.html:1-95` (CSS) + `:266-280` (helpers) + `:695-698` (escapeHtml) to confirm session-time state matches the plan.
6. Read `UI_AUDIT.md` §5 CCP-UI-6 (shared widget kit) and CCP-UI-3 (table pattern) sections.
7. Open `.claude/bugs.md` — confirm no open bug on ManagerDashboardView_v2 that would conflict.

## Stage A — Extend TaskWidgets kit (additive, zero risk)

**Why first.** Adding two helpers + zero CSS changes affects nothing currently. LibraryView (the only existing consumer) continues to call `TaskWidgets.formatDate` (ISO) unchanged. Stage A ships safely standalone; if Stage B/C reveal an issue, Stage A doesn't need rollback.

**Files.**
- Edit `jlmops/TaskWidgets.html` — add two helpers inside the existing `<script>` block.

**Change.**

Insert after `TaskWidgets.formatDate` (at `TaskWidgets.html:185`, immediately before the closing of `formatDate`'s body and before `TaskWidgets.escape`):

```javascript
  TaskWidgets.formatDateShort = function(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return (d.getMonth() + 1) + '/' + d.getDate();
  };

  TaskWidgets.formatDateFull = function(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString();
  };
```

Behavior matches ManagerDashboardView_v2's existing `formatDate` (M/D, returns `-` on null) and `formatDateFull` (locale, returns `-` on null) exactly. Drop-in compatible.

**Smoke A.**
- `clasp push` after change (this is a TaskWidgets-only change; no view affected).
- Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T2.5 stage A: extend TaskWidgets with formatDateShort + formatDateFull"`.
- Open LibraryView — confirm renders identically (existing `TaskWidgets.formatDate` unchanged).
- Open browser console on LibraryView, run `TaskWidgets.formatDateShort('2026-05-28')` — expect `'5/28'`. Run `TaskWidgets.formatDateFull('2026-05-28')` — expect locale-formatted (e.g. `'5/28/2026'`).
- No regression to existing LibraryView functionality.

**Rollback A.**
- Git revert + redeploy. Kit reverts; LibraryView still works (it never used the new helpers).

**Commit A.** `ui(TaskWidgets): add formatDateShort + formatDateFull helpers (kit extension for Tier 2.5 ManagerDashboard migration)`

## Stage B — Migrate ManagerDashboardView_v2 helpers (replace, no CSS change)

**Why second.** Stage B replaces 4 helper functions with kit calls. Each replacement is local, testable, reversible. CSS untouched in this stage — visual rendering unchanged.

**Files.**
- Edit `jlmops/ManagerDashboardView_v2.html` — five changes.

**Changes.**

1. **Add scriptlet include at top of file** (before line 1 `<style>`):
   ```html
   <?!= include('TaskWidgets') ?>
   ```
   This inlines the TaskWidgets CSS + script. The script self-registers `window.TaskWidgets` via `window.TaskWidgets = window.TaskWidgets || {};` so no conflict if both are present in a transitional state.

2. **Replace `formatDate` callers** (`:419, :420`):
   ```javascript
   // before:
   html += '<div class="task-col-due">' + formatDate(task.dueDate) + '</div>';
   html += '<div class="task-col-created">' + formatDate(task.createdDate) + '</div>';
   // after:
   html += '<div class="task-col-due">' + TaskWidgets.formatDateShort(task.dueDate) + '</div>';
   html += '<div class="task-col-created">' + TaskWidgets.formatDateShort(task.createdDate) + '</div>';
   ```

3. **Replace `formatDateFull` callers** (`:453, :454, :455, :456, :625`):
   ```javascript
   // before (5 instances):
   formatDateFull(task.startDate)
   formatDateFull(task.dueDate)
   formatDateFull(task.doneDate)
   formatDateFull(task.createdDate)
   formatDateFull(weekStart.toISOString()) + ' - ' + formatDateFull(periodEnd.toISOString())
   // after — same arguments, just kit-prefixed:
   TaskWidgets.formatDateFull(task.startDate)
   TaskWidgets.formatDateFull(task.dueDate)
   TaskWidgets.formatDateFull(task.doneDate)
   TaskWidgets.formatDateFull(task.createdDate)
   TaskWidgets.formatDateFull(weekStart.toISOString()) + ' - ' + TaskWidgets.formatDateFull(periodEnd.toISOString())
   ```

4. **Replace `isOverdue` caller** (`:403`):
   ```javascript
   // before:
   var overdueClass = isOverdue(task.dueDate) && task.status !== 'Done' ? ' overdue' : '';
   // after (preserves exact existing semantics — Cancelled tasks DO still flash overdue):
   var overdueClass = (function(){
     if (!task.dueDate) return '';
     if (task.status === 'Done') return '';
     return new Date(task.dueDate) < new Date() ? ' overdue' : '';
   })();
   ```
   **v2 scope correction.** v1 of this stage replaced `isOverdue(...) && status !== 'Done'` with `TaskWidgets.dueClass(...) === 'overdue'`, calling it an "intentional behavior tightening" because the kit excludes both Done AND Cancelled. Per plan-coherence agent review: that's a UX change being smuggled into a code-consolidation session. **v2: preserve exact existing semantics inline; the local isOverdue helper goes away, but its behavior survives.** If the Cancelled-overdue-display question matters, ship it as a separate atomic commit with explicit user authorization — not bundled into a kit-migration session.

5. **Replace `escapeHtml` callers** (`:410, :415×2, :416×2, :434-438, :459, :468, :479, :482, :655` — total 16 instances):
   ```javascript
   // before (16 instances):
   escapeHtml(task.entityId)
   escapeHtml(task.entityName)
   escapeHtml(task.name)
   // ... (12 more)
   // after — kit-prefixed everywhere:
   TaskWidgets.escape(task.entityId)
   TaskWidgets.escape(task.entityName)
   TaskWidgets.escape(task.name)
   ```
   Kit's `escape` escapes single-quote in addition to what local `escapeHtml` covers. No behavioral regression — single-quote idempotent when absent.

6. **Delete the 4 local helper definitions** at `:266-280` and `:695-698`:
   ```javascript
   // delete (formatDate, formatDateFull, isOverdue) at :266-280
   // delete (escapeHtml) at :695-698
   ```

**Smoke B.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T2.5 stage B: migrate ManagerDashboardView_v2 helpers to TaskWidgets"`.
- Open Manager Dashboard. Confirm:
  - Task list renders with same due/created date columns (M/D format unchanged).
  - Expanded task row shows full dates (locale format) for Start/Due/Done/Created.
  - Calendar view week label shows the period dates (e.g. `'5/26/2026 - 6/1/2026'`).
  - Overdue tasks still display with red `.overdue` class.
  - Cancelled task that previously appeared overdue (if any in the data) no longer shows overdue red — **intentional behavior tightening; document if observed**.
  - Notes textarea + entity name display + open-contact button text all render without HTML breakage.
- Open browser console: zero `formatDate is not defined` / `escapeHtml is not defined` / `isOverdue is not defined` errors.

**Rollback B.**
- Git revert + redeploy. Helpers restore + kit calls revert.

**Commit B.** `ui(ManagerDashboard): migrate to TaskWidgets kit (replace 4 local helpers, 24 call-sites; kit isOverdue tightens Cancelled-overdue behavior)`

## Stage C — Replace `.task-filters` CSS with `.tw-filter-bar`

**Why third.** CSS change. Single class rename + delete duplicate CSS. Visual smoke required.

**Files.**
- Edit `jlmops/ManagerDashboardView_v2.html` — change CSS + markup.

**Changes.**

1. **Delete duplicate `.task-filters` CSS** at `:10-11` and the mobile override at `:55-59`:
   ```css
   /* delete :10-11 */
   .task-filters { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
   .task-filters select, .task-filters input { font-size: 12px; height: 28px; }

   /* delete :55-59 from the @media block */
   .task-filters { gap: 8px; }
   .task-filters select, .task-filters input {
     font-size: 16px !important; height: 40px !important;
     flex: 1 1 100%; width: auto !important; min-width: 0;
   }
   ```

2. **Rename markup class at `:146`** from `task-filters` to `tw-filter-bar`:
   ```html
   <!-- before -->
   <div class="task-filters">
   <!-- after -->
   <div class="tw-filter-bar">
   ```

**Behavior comparison after change.**

| Property | `.task-filters` (deleted) | `.tw-filter-bar` (kept) |
|---|---|---|
| Desktop gap | 10px | 8px (subtle reduction; acceptable) |
| Mobile gap | 8px | inherits desktop (8px) |
| Margin-bottom | 10px | 10px |
| Flex behavior | flex / wrap | flex / wrap |
| Input/select font-size desktop | 12px | 12px |
| Input/select height desktop | 28px | 28px |
| Mobile input/select font-size | 16px (!important) | 16px (no !important) |
| Mobile input/select height | 40px (!important) | 40px (no !important) |
| Mobile width / flex behavior | `flex: 1 1 100%` (!important) | `flex: 1 1 100%` |
| Border on input/select | none | `1px solid #ced4da` |
| Border-radius on input/select | none | `4px` |
| Padding on input/select | none | `0 8px` (right `24px` for select) |

**Difference summary:** kit version adds a thin grey border + 4px radius + 8px horizontal padding to filter inputs/selects. Desktop gap drops from 10px → 8px. The `!important` flags on the local mobile rules are dropped (kit doesn't need them because no other CSS competes).

**Verdict:** visual change is minor and the kit version is the project standard. Apply.

**Smoke C.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T2.5 stage C: replace .task-filters with .tw-filter-bar (kit standard)"`.
- Open Manager Dashboard. Confirm:
  - Filter bar renders with subtle border on topic select, status select, search input.
  - Filter bar wraps to multi-line on narrow viewport.
  - **Manual phone test:** open on phone. Filter inputs ≥40px tall, 16px font. No iOS auto-zoom on focus.
- Compare side-by-side with pre-deploy screenshot (or eyeball) — confirm no layout shift in surrounding content.

**Rollback C.**
- Git revert + redeploy. `.task-filters` CSS + class returns.

**Commit C.** `ui(ManagerDashboard): rename .task-filters → .tw-filter-bar + drop duplicate CSS (kit standard)`

## Session-end checklist

After all 3 stages committed + deployed:

1. **Git log review.** Three fix commits + initial state.
2. **Live smoke:**
   - Open Admin Dashboard (should render unaffected — it doesn't include TaskWidgets yet).
   - Open Manager Dashboard. Run all interactive paths: filter by topic, filter by status, search, expand a task row, click into Calendar view, navigate weeks, click a task dot.
   - Open LibraryView (existing TaskWidgets consumer). Confirm unchanged.
   - Browser console: zero errors across all three views.
   - SysLog: zero new ERROR entries.
3. **Line count check.** Confirm `ManagerDashboardView_v2.html` is ~30 lines shorter (4 helpers + 6 CSS lines removed; 1 scriptlet line added; 24 call-site renames net-neutral).
4. **Update `UI_AUDIT.md` §10 status:** mark T2.5 SHIPPED with deploy refs.
5. **Update `.claude/session-log.md`:** brief session note.
6. **CCP-UI audit:**
   - CCP-UI-6 (shared kit + scriptlet include): applied — scriptlet at top of ManagerDashboardView_v2, kit calls replace 4 local helpers across 24 sites.
   - CCP-UI-3 (table pattern): N/A this session.

## Notes for future sessions (Tier 2.6 onward)

Tier 2.6 rolls out TaskWidgets adoption to the remaining 6 consumers. The recipe established here:

1. **Per consumer, count usage** of `formatDate`, `formatDateFull`, `escapeHtml`, `isOverdue` (or equivalents) before migrating. Some consumers may need additional kit helpers; add them in a Stage A before migrating that consumer.
2. **Atom CSS migration is per-view.** ManagerDashboardView_v2 had zero status-pill / priority-badge / due-chip CSS — it renders status/priority/due as plain text. Other consumers may have hand-rolled these atoms; those migrations replace local CSS with kit classes (`tw-status-pill`, `tw-priority-badge`, `tw-due-chip`).
3. **`.task-filters` → `.tw-filter-bar`** pattern repeats wherever the local filter-bar CSS duplicates the kit.
4. **`escapeHtml` → `TaskWidgets.escape`** is always safe (strict superset).
5. **Date format helpers:** if a consumer uses M/D, call `formatDateShort`. If it uses locale, call `formatDateFull`. If it uses ISO yyyy-mm-dd, call `formatDate`. The kit now covers all three formats.

Specific consumer notes:
- **AdminCampaignsView** (`AdminCampaignsView.html:36-52`): status colors + helpers; check for status-pill CSS.
- **AdminProjectsView** (`AdminProjectsView.html:1-72, :1951-1980`): task-row layout that anticipates LibraryView's; may have status-pill / priority-badge atoms inline.
- **AdminContactsView** (`AdminContactsView.html:1162`): escapeHtml — Stage B equivalent only.
- **AdminBundlesView** (`AdminBundlesView.html:1175`): formatDate — check format.
- **AdminInventoryView** (`AdminInventoryView.html:578`): formatDate — check format.
- **ManagerContactView** (`ManagerContactView.html:189`): formatDate — check format.
