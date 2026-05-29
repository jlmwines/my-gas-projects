# UI Tier 4.2 — ManagerDashboardView_v2 expanded-row mobile fix

**Session ID:** UI_T4_2
**Status:** SHIPPED 2026-05-29 @157 deploy @161. Plan v1 (2026-05-28). All gaps resolved via code reading:
- **Two-layer flex confirmed:** `:450` outer `.detail-row.justify-content-between` already gets mobile column-flex via `:92` override (T2.5's polish). Inner `.d-flex` at `:451` lacks any mobile rule — stays single-row even at 360px, overflowing.
- **Inline width on status select:** `:462` has `style="width:100px;"` inline; only used at this single render site (`:462`) and queried for save at `:552`. Safe to move width from inline to CSS.
- **`task-status` class:** appears at exactly 2 sites in the file (render + save query). No external consumer; CSS change has scope-local impact only.

**Parent:** `UI_AUDIT.md` §5 Tier 4.2
**Estimated effort:** 1 session, 1 staged deploy.
**Depends on:** Soft after T2.5 (TaskWidgets adoption may move some inline CSS around). Not blocking.

## Session goal

When a task row is expanded on mobile, the 6 label/value pairs + status select + Revert button stack vertically instead of overflowing horizontally. Status select takes full width of its column on mobile (still 100px on desktop).

## Session opening checklist

1. Working tree clean.
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Re-read `ManagerDashboardView_v2.html:88-94` (existing mobile overrides for `.task-detail`), `:450-475` (the render block), `:462` (the inline-width select).
5. Verify T2.5 shipped (helpers migrated to TaskWidgets); if so, the file's at the post-T2.5 state but this session's changes are CSS-only — no kit dependency.

## Stage A — Inner-flex mobile override + select width

**Why one stage.** CSS-only + one JS render-string tweak. Tiny scope.

**Files.**
- Edit `jlmops/ManagerDashboardView_v2.html` — CSS additions + remove inline width from select.

**Changes.**

### Part 1: Add `.task-status` desktop CSS

Add to the desktop CSS block (after existing `.task-detail` styles around `:32`):

```css
.task-status { width: 100px; }
```

This replaces the inline `style="width:100px"` so the width can be overridden by the mobile media query.

### Part 2: Remove inline width from the JS render

Modify `:462`:

```javascript
// before:
html += '<select class="form-control form-control-sm task-status" data-id="' + task.id + '" style="width:100px;">';
// after:
html += '<select class="form-control form-control-sm task-status" data-id="' + task.id + '">';
```

### Part 3: Add inner-flex mobile override

Extend the existing mobile media query block at `:91-94` to also target the inner `.d-flex`:

```css
/* before — :91-94 */
@media (max-width: 768px) {
  ...existing rules...

  /* Task detail expanded view: full-width inputs */
  .task-detail .detail-row { flex-direction: column; align-items: stretch; gap: 8px; }
  .task-detail textarea { min-height: 100px; font-size: 16px; }
}

/* after — add inner-flex stack + select width override inside the same @media block */
@media (max-width: 768px) {
  ...existing rules...

  /* Task detail expanded view: full-width inputs */
  .task-detail .detail-row { flex-direction: column; align-items: stretch; gap: 8px; }
  /* Inner d-flex inside detail-row also stacks vertically on phone — was overflowing horizontally */
  .task-detail .detail-row > .d-flex {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  /* Status select goes full-width on mobile (was 100px inline before T4.2) */
  .task-status { width: 100%; }
  .task-detail textarea { min-height: 100px; font-size: 16px; }
}
```

The `.task-detail .detail-row > .d-flex` selector targets the inner flex specifically (direct child of `.detail-row`). The mobile-only override gives:
- `flex-direction: column` — stacks 6 pairs + select + Revert vertically
- `gap: 8px` — uniform spacing
- `align-items: stretch` — children fill the column width

The `.task-status { width: 100% }` rule inside the @media block beats the desktop `.task-status { width: 100px }` at narrow viewports.

**Smoke.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T4.2: ManagerDashboard expanded-row stacks vertically on mobile + select goes full-width"`.
- **Desktop smoke (≥769px):** open Manager Dashboard. Expand a task row. Confirm: Stream / Start / Due / Done / Created / Priority pairs render in a single horizontal row; status select is 100px wide; Revert button beside it. Save button on the far right. **No visual change vs pre-deploy.**
- **Mobile smoke (≤768px, real phone strongly preferred):**
  - Open Manager Dashboard. Expand a task row.
  - Confirm 6 label/value pairs stack vertically (one per row).
  - Status select takes full column width (~280px on a 320px viewport, accounting for padding).
  - Revert button is below the select, full-width.
  - Save button (outer flex child) is at the bottom, full-width (already handled by outer mobile override `:92` `align-items: stretch`).
  - Tap status select → soft keyboard / dropdown opens normally. Change to a value. Tap Save → save fires.
- **Cross-viewport smoke:** open on desktop, then resize browser to 360px width. Confirm layout reflows cleanly without re-render.
- **Calendar view smoke:** confirm Calendar view button (`#btn-calendar-view`) is still hidden on mobile per existing `:88` rule. Mobile-only feature.
- Console: zero errors.

**Rollback.**
- Git revert + redeploy.

**Risk.**
- Low. CSS + 1 line of JS markup change. Backend untouched.

**Commit.** `ui(ManagerDashboard): expanded-row inner-flex stacks vertically on mobile + task-status select goes full-width (was inline 100px)`

## Session-end checklist

1. **Git log review.** One commit.
2. **Live smoke** — desktop + mobile.
3. **Update `UI_AUDIT.md` §10 status:** mark T4.2 SHIPPED.
4. **Update `.claude/session-log.md`:** brief note.
5. **CCP-UI audit:**
   - CCP-UI-7 (mobile primitives): applied — inner-flex stacks on mobile per project pattern; touch targets preserved from shell primitives.

## Notes for future sessions

- **Inline width anti-pattern** — `style="width:100px"` inline on form controls is harder to override per breakpoint than CSS classes. As a general principle: prefer CSS classes for any sizing that may need responsive overrides. If a similar inline pattern is found in other views during their mobile sessions, apply the same move-to-CSS recipe.
- **Calendar view** (`:35-46`) is already mobile-hidden via existing CSS at `:88-89`. No further work needed there.
