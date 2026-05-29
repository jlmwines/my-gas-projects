# UI Tier 4.4 — ManagerProductsView mobile pass

**Session ID:** UI_T4_4
**Status:** **SHIPPED 2026-05-29 (@178 deploy @182 + @179 deploy @183 fixes; commit `e97df74`).** Stage A (modal mobile CSS) + Stage B (both outer tables → responsive-stack + data-label) shipped in one deploy. **Post-smoke fixes (@179):** (1) edit areas were wider than the modal card — CSS-grid `min-width:auto` trap; added `.comparison-grid>*{min-width:0}` + desc box-sizing/overflow-wrap; (2) Fill/Clear crowded the tabs — tab-group now scrolls on its own row, tab-actions wraps below; (3) **shared `.responsive-stack` fix in AppView** — cells without a `data-label` were rendering a bare ": " (`td:not([data-label])::before{content:none}`), which also fixed the OrdersView action/gift-button cells. RTL Hebrew header-stack + tab scroll + comparison single-column all user-confirmed on mobile. — Plan v1 (2026-05-28). All gaps resolved via code reading:
- **`.comparison-grid` (`:34`)** is `grid-template-columns: 1fr 1fr` at every viewport — fixed two-column at 360px gives ~150px per column, unusable for Hebrew long-description textareas (which have `min-height: 120px` per `:65`).
- **`.tab-bar` (`:23-29`)** is `display: flex; justify-content: space-between` with 7 tab buttons + a right-aligned actions slot. No `overflow-x` handling. Overflows phone width without scroll.
- **`.header-right` (`:16`)** is `direction: rtl` + ellipsis truncation. This causes Hebrew names like "יין אדום מהכרם הראשון" to truncate from the LEFT (showing only the end), losing the start of the name.
- **Outer tables (Detail Updates + New Products)** are 5-column tables with `class="table table-hover"` — direct `.responsive-stack` candidates. Section 3 (Suggest Products) already has `table-responsive` wrapper + `table-sm` — no mobile work needed there.
- **Modal `.modal-overlay` width: 90%; max-width: 900px** — already adapts to viewport width. The internal layout is the issue, not the modal frame.

**Parent:** `UI_AUDIT.md` §5 Tier 4.4
**Estimated effort:** 1 session, 2 staged deploys.
**Depends on:** Nothing structural. Independent.

## Session goal

Manager can edit product details on phone without cramped two-column comparison views, overflowing tab bars, or truncated-from-the-start Hebrew names. Outer Detail Updates + New Products tables stack as cards.

## Session opening checklist

1. Working tree clean.
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Re-read `ManagerProductsView.html:5-71` (CSS), `:88-126` (two outer tables), `:11-18` (modal header), `:23-29` (tab bar), `:193-202` (tab bar markup with 7 buttons; verify count at session start).
5. Real Hebrew product name in test data for RTL smoke (any wine with Hebrew name like `יין` characters works).

## Stage A — Modal interior mobile fixes (comparison-grid, tab-bar, header)

**Why first.** Modal is the manager's primary edit surface. Fix the interior so the modal is usable before touching the outer card tables.

**Files.**
- Edit `jlmops/ManagerProductsView.html` — `<style>` block additions.

**Changes.**

Add to the `<style>` block (after the existing rules at `:69` and before `</style>` at `:71`):

```css
/* === Mobile overrides (≤768px) === */
@media (max-width: 768px) {
  /* Comparison grid: single column on mobile so Hebrew long descriptions get full width */
  .comparison-grid {
    grid-template-columns: 1fr;
    gap: 20px;  /* tighter than desktop's 30px since stacking already adds visual separation */
  }

  /* Tab bar: horizontal scroll so 7 tabs don't overflow + clip */
  .tab-bar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
    /* hide scrollbar visually on iOS Safari while keeping native scroll behavior */
    scrollbar-width: thin;
  }
  .tab-group {
    flex-wrap: nowrap;
    min-width: 0;  /* allow children to scroll instead of forcing parent to grow */
  }
  .tab-btn {
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tab-actions {
    flex-shrink: 0;
    padding-left: 10px;
  }

  /* Modal header: stack three columns vertically so Hebrew name gets full width
     and isn't truncated-from-the-start by RTL ellipsis */
  .modal-product-info {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  .header-item {
    text-overflow: clip;  /* let it wrap instead of ellipsis at narrow widths */
    white-space: normal;
    overflow: visible;
  }
  .header-left { text-align: center; }
  .header-center { text-align: center; }
  .header-right { text-align: center; direction: rtl; }

  /* Description textareas comfortable size on mobile (already have min-heights) */
  .desc-long { min-height: 140px; }  /* slightly taller on mobile to compensate for column width */
}
```

**Smoke A.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T4.4 stage A: ManagerProducts modal mobile fixes (comparison-grid single-column, tab-bar scroll, header stack)"`.
- **Desktop:** open Manager Products. Click any Detail Updates row → edit modal opens. Confirm comparison grid still 2-column. Tab bar still single row with 7 tabs visible. Modal header still 3-column with ellipsis on long Hebrew names (the desktop behavior is unchanged because rules are in `@media (max-width: 768px)`).
- **Mobile (real phone strongly preferred — Hebrew test required):**
  - Open Manager Products. Click any row's edit action → modal opens at 90% viewport width.
  - Confirm comparison sections (Current / Edit) stack vertically. Each column gets full modal width. Long description textareas have ~280px width on a 320px phone instead of ~140px.
  - Tab bar scrolls horizontally. 7 tabs reachable via scroll. Tab actions (`.tab-actions`) stays on the right side as you scroll.
  - Modal header: English name, SKU, Hebrew name stack vertically. Hebrew name renders fully visible (not truncated from start). Test with a wine that has a long Hebrew name (e.g. `יין אדום מהכרם הראשון` — 6 words; should display all 6 on phone).
  - Tap each tab → switches content; switching is smooth.
  - Edit a long description in Hebrew (via textarea) → enter several lines; confirm the textarea grows + resize handle works.
  - Submit → save fires; modal closes.

**Rollback A.** Git revert + redeploy.

**Risk A.**
- Low. CSS-only additions; desktop behavior unchanged by `@media (max-width: 768px)` scoping.

**Commit A.** `ui(ManagerProducts): modal mobile fixes (comparison-grid single-column, tab-bar horizontal scroll, header stacks vertically to fix RTL Hebrew truncation)`

## Stage B — Outer tables (Detail Updates + New Products) adopt `.responsive-stack`

**Why second.** Two tables, same 5-column shape (Product / SKU / Task / Date / Action). Same recipe as T4.1 + T4.3.

**Files.**
- Edit `jlmops/ManagerProductsView.html` — find where the two table bodies are populated.

**Changes.**

### Part 1: Modify the Detail Updates table thead + add `.responsive-stack`

Modify `:88-101`:

```html
<!-- before -->
<table class="table table-hover mb-0">
  <thead>
    <tr>
      <th class="border-top-0">Product</th>
      <th class="border-top-0">SKU</th>
      <th class="border-top-0">Task</th>
      <th class="border-top-0">Date</th>
      <th class="border-top-0">Action</th>
    </tr>
  </thead>
  <tbody id="task-list-body">
    <!-- Tasks will be populated here -->
  </tbody>
</table>

<!-- after -->
<table class="table table-sm table-hover responsive-stack mb-0">
  <thead>
    <tr>
      <th class="border-top-0">Product</th>
      <th class="border-top-0">SKU</th>
      <th class="border-top-0">Task</th>
      <th class="border-top-0">Date</th>
      <th class="border-top-0">Action</th>
    </tr>
  </thead>
  <tbody id="task-list-body">
    <!-- Tasks will be populated here -->
  </tbody>
</table>
```

(Added `table-sm responsive-stack` to the class list.)

### Part 2: Modify the New Products table thead

Same change at `:111-124`:

```html
<table class="table table-sm table-hover responsive-stack mb-0">
  <thead>
    <tr>
      <th class="border-top-0">Product</th>
      <th class="border-top-0">SKU</th>
      <th class="border-top-0">Task</th>
      <th class="border-top-0">Date</th>
      <th class="border-top-0">Action</th>
    </tr>
  </thead>
  <tbody id="onboarding-list-body">
    <!-- Onboarding tasks will be populated here -->
  </tbody>
</table>
```

### Part 3: Add `data-label` to per-row `<td>` cells in the JS that populates these tables

Find the JS that generates rows for `#task-list-body` and `#onboarding-list-body`. Both likely use template literals or DOM construction.

Pattern (apply uniformly to both tables' row builders):

```javascript
// before (sketch):
'<td>' + product + '</td>' +
'<td>' + sku + '</td>' +
'<td>' + taskName + '</td>' +
'<td>' + date + '</td>' +
'<td>' + actionButton + '</td>'

// after:
'<td data-label="Product">' + product + '</td>' +
'<td data-label="SKU">' + sku + '</td>' +
'<td data-label="Task">' + taskName + '</td>' +
'<td data-label="Date">' + date + '</td>' +
'<td>' + actionButton + '</td>'   // no label on action button cell
```

Use grep to locate the row builders at session start (function names like `renderDetailTasks` / `renderOnboardingTasks` or similar). Both rows likely share a single helper; modify in one place if so.

**Smoke B.**
- `clasp push`. Deploy.
- **Desktop:** both tables render as standard tables with `table-sm` density. Click any row's Action button → edit modal opens (Stage A behavior preserved).
- **Mobile:** each Detail Update row + each New Product row renders as a card with labels. Action button at bottom of each card is tappable. Modal-open flow works from card-action.

**Rollback B.** Git revert + redeploy.

**Commit B.** `ui(ManagerProducts): Detail Updates + New Products tables adopt .responsive-stack (5-column pattern)`

## Session-end checklist

1. **Git log review.** Two commits.
2. **Live smoke** — desktop + mobile + Hebrew RTL test.
3. **Update `UI_AUDIT.md` §10 status:** mark T4.4 SHIPPED.
4. **Update `.claude/session-log.md`:** brief note. Specifically capture the RTL Hebrew truncation fix as a discoverable improvement (manager may notice without reading commit notes).
5. **CCP-UI audit:**
   - CCP-UI-1 (modal pattern): preserved — no new modal opens; existing modal-overlay structure unchanged.
   - CCP-UI-3 (table pattern): `table-sm responsive-stack` applied to 2 outer tables.
   - CCP-UI-7 (mobile primitives): comparison-grid stacks; tab-bar scrolls; modal header stacks; RTL truncation fixed.

## Notes for future sessions

- **`.responsive-stack` adopted in 4 views** after this session (OrdersView T4.1 + ManagerInventoryView T4.3 + ManagerProductsView T4.4 + utility itself). Pattern is now well-established.
- **RTL Hebrew truncation gotcha** — any `text-overflow: ellipsis` combined with `direction: rtl` truncates from the visual-left (logical-start in RTL). If found in other views, the fix is to either (a) `text-overflow: clip; white-space: normal;` at narrow widths to let the text wrap, or (b) provide an alternative full-width layout that doesn't need ellipsis. T4.4 chose (a).
- **Tab bar overflow** — if other views have many tabs (e.g., AdminProductsView's tab bar in the vintage-review modal), the same `overflow-x: auto; -webkit-overflow-scrolling: touch` recipe applies. Tier 5.2 (AdminProducts modal cleanup) should fold this in if discovered.
