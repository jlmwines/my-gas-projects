# UI Tier 4.5 — LibraryView mobile gaps

**Session ID:** UI_T4_5
**Status:** Plan v1 (2026-05-28). Ready to ship. All gaps resolved via code reading:
- **Drawer panel `.lv-drawer-panel` already mobile-safe** (`width: 560px; max-width: 95vw; max-height: 88vh` at `:121-130`). Frame adapts; only the internal `.lv-drawer-header` (`grid-template-columns: 1fr 1fr` at `:154-156`) is fixed two-column.
- **Task row mobile rule exists but partial** (`:110-116`): collapses to column on mobile + adds `::before` labels for `col-assignee` and `col-due` only. **Missing labels** for `col-status` (column-stacked but unlabeled), `col-name` (acceptable — main content), `col-chips` (acceptable — visual badges).
- **Library list table** (`:859-873`) is 7 columns (Title / Type / Lang / State / Ver / Last touched / Refs). No `.responsive-stack` today; needs adoption like the other Tier 4 sessions.
- **TaskWidgets already included via scriptlet at `LibraryView.html:1`** (gold-standard kit consumer); no kit adoption work needed in this session.

**Parent:** `UI_AUDIT.md` §5 Tier 4.5
**Estimated effort:** 1 session, 2 staged deploys.
**Depends on:** Soft after T4.1 (validates `.responsive-stack` utility in production).

## Session goal

Library view on phone: drawer header stacks one-column for readability; task row stacked columns get labels for the missing fields; library list table collapses to card-stack.

## Session opening checklist

1. Working tree clean.
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Re-read `LibraryView.html:34-49` (task row col CSS), `:110-116` (existing mobile rule), `:121-160` (drawer panel + header), `:622-640` (task row render), `:858-873` (library table render).
5. Mobile device or browser at 360px ready.

## Stage A — CSS additions: drawer header single-col + task row stacked labels

**Why first.** CSS-only. Zero markup change. Safest.

**Files.**
- Edit `jlmops/LibraryView.html` — extend the `@media (max-width: 768px)` block.

**Changes.**

Modify `:110-116` to extend the mobile media block:

```css
/* before — :110-116 */
@media (max-width: 768px) {
  .lv-task-row { flex-direction: column; align-items: stretch; }
  .lv-task-row [class^="col-"] { flex: none; }
  .lv-task-row .col-name { white-space: normal; }
  .lv-task-row .col-assignee::before { content: 'Assigned: '; color: #6c757d; }
  .lv-task-row .col-due::before { content: 'Due: '; color: #6c757d; }
}

/* after — add status label + drawer-header single-column */
@media (max-width: 768px) {
  .lv-task-row { flex-direction: column; align-items: stretch; }
  .lv-task-row [class^="col-"] { flex: none; }
  .lv-task-row .col-name { white-space: normal; }
  .lv-task-row .col-status::before { content: 'Status: '; color: #6c757d; font-weight: 600; font-size: 11px; margin-right: 4px; }
  .lv-task-row .col-assignee::before { content: 'Assigned: '; color: #6c757d; font-weight: 600; font-size: 11px; margin-right: 4px; }
  .lv-task-row .col-due::before { content: 'Due: '; color: #6c757d; font-weight: 600; font-size: 11px; margin-right: 4px; }
  /* col-name and col-chips are visually distinct enough on their own — no ::before needed */

  /* Drawer header: single column on phone so 8-10 label/value pairs get full width */
  .lv-drawer-header {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
```

Style consistency note: the existing labels at `:114-115` use plain `content` and `color`. Stage A adds `font-weight: 600; font-size: 11px; margin-right: 4px` to all three (status + assignee + due) for uniformity and slight visual polish. This is a small visual improvement to the existing assignee/due labels at the same time — acceptable, since the pre-T4.5 rules are sparse and easily improved without controversy.

**Smoke A.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T4.5 stage A: Library mobile (drawer header single-col + task row status label)"`.
- **Desktop:** open LibraryView. Tasks tab → task rows render in horizontal columns as before. Library tab → entity drawer opens at 560px width with 2-column header. **No visual change vs pre-deploy on desktop.**
- **Mobile:**
  - Open LibraryView. Tasks tab — each row stacks vertically. Each row now shows "Status: …", "Assigned: …", "Due: …" labels with bold 11px prefixes.
  - Tap a task row → expanded detail appears below. (Expanded detail's `.detail-row` should still render OK on mobile; if not, follow up.)
  - Click an entity title in either tab → drawer opens centered. Drawer header (8-10 label/value pairs) renders as a single vertical column, each pair on its own line.
  - Scroll within the drawer body — all sections accessible.
- Console: zero errors.

**Rollback A.** Git revert + redeploy.

**Risk A.** Low. CSS-only.

**Commit A.** `ui(Library): mobile CSS — drawer header single-column + status label on stacked task rows`

## Stage B — Library list table adopts `.responsive-stack`

**Why second.** Table is rendered via JS template literal; needs both the table class change and `data-label` attributes on cells. Independent of Stage A.

**Files.**
- Edit `jlmops/LibraryView.html` — table render at `:858-873`.

**Changes.**

Modify the library table render (within `:858-873`):

```javascript
// before — :859-873
var html = '<table class="lv-library-table"><thead><tr>';
html += '<th>Title</th><th>Type</th><th>Lang</th><th>State</th><th>Ver</th><th>Last touched</th><th>Refs</th>';
html += '</tr></thead><tbody>';
rows.forEach(function(e) {
  html += '<tr>';
  html += '<td><a class="lv-entity-title-link" onclick="LibraryView.openEntityDrawer(\'' + TaskWidgets.escape(e.slug) + '\')"><strong>' + TaskWidgets.escape(e.title || e.slug) + '</strong></a><div class="detail-meta">' + TaskWidgets.escape(e.slug) + '</div></td>';
  html += '<td>' + TaskWidgets.escape(e.contentType || '—') + '</td>';
  html += '<td>' + TaskWidgets.escape(e.language || '—') + '</td>';
  html += '<td><span class="tw-status-pill ' + TaskWidgets.statusClass(e.state) + '">' + TaskWidgets.escape(e.state || '—') + '</span></td>';
  html += '<td>' + TaskWidgets.escape(e.version || '—') + '</td>';
  html += '<td>' + (e.lastTouched ? TaskWidgets.formatDate(e.lastTouched) : '—') + '</td>';
  html += '<td>' + (e.references && e.references.length ? e.references.length : 0) + '</td>';
  html += '</tr>';
});
html += '</tbody></table>';

// after — add responsive-stack class + data-label per td
var html = '<table class="lv-library-table responsive-stack"><thead><tr>';
html += '<th>Title</th><th>Type</th><th>Lang</th><th>State</th><th>Ver</th><th>Last touched</th><th>Refs</th>';
html += '</tr></thead><tbody>';
rows.forEach(function(e) {
  html += '<tr>';
  html += '<td data-label="Title"><a class="lv-entity-title-link" onclick="LibraryView.openEntityDrawer(\'' + TaskWidgets.escape(e.slug) + '\')"><strong>' + TaskWidgets.escape(e.title || e.slug) + '</strong></a><div class="detail-meta">' + TaskWidgets.escape(e.slug) + '</div></td>';
  html += '<td data-label="Type">' + TaskWidgets.escape(e.contentType || '—') + '</td>';
  html += '<td data-label="Lang">' + TaskWidgets.escape(e.language || '—') + '</td>';
  html += '<td data-label="State"><span class="tw-status-pill ' + TaskWidgets.statusClass(e.state) + '">' + TaskWidgets.escape(e.state || '—') + '</span></td>';
  html += '<td data-label="Ver">' + TaskWidgets.escape(e.version || '—') + '</td>';
  html += '<td data-label="Last touched">' + (e.lastTouched ? TaskWidgets.formatDate(e.lastTouched) : '—') + '</td>';
  html += '<td data-label="Refs">' + (e.references && e.references.length ? e.references.length : 0) + '</td>';
  html += '</tr>';
});
html += '</tbody></table>';
```

Two changes summarized:
- Table class: `lv-library-table` → `lv-library-table responsive-stack`.
- Each `<td>` gets `data-label="<col>"`.

The existing `.lv-library-table` styling (background, sticky thead, hover) is preserved on desktop; on mobile, `.responsive-stack` rules from AppView take over (hides thead, stacks rows as cards with `data-label::before` prefixes). The sticky thead becomes inert on mobile (thead is `display: none`), which is correct.

**Smoke B.**
- `clasp push`. Deploy.
- **Desktop:** Library tab table renders as before — sticky header, hover, no visual change.
- **Mobile:**
  - Library tab → each entity row becomes a card.
  - "Title: <link>" stays a clickable link → opens drawer.
  - Other fields render with bold grey "Type:", "Lang:", "State:", etc. prefixes.
  - State pill renders inline within the data-label container; visually shows "State: [pill]".
- Click a Title → drawer opens; Stage A's single-column header layout takes effect. Full cycle works.

**Rollback B.** Git revert + redeploy.

**Commit B.** `ui(Library): library list table adopts .responsive-stack (7-column entity table)`

## Session-end checklist

1. **Git log review.** Two commits.
2. **Live smoke** — desktop + mobile for both task list and library list, plus drawer header.
3. **Update `UI_AUDIT.md` §10 status:** mark T4.5 SHIPPED.
4. **Update `.claude/session-log.md`:** brief note.
5. **CCP-UI audit:**
   - CCP-UI-3 (table pattern): `.responsive-stack` adopted on library list table.
   - CCP-UI-7 (mobile primitives): stacked-column labels uniform; drawer header single-column on mobile; touch targets preserved from shell.

## Notes for future sessions

- **`.responsive-stack` count: 5 adopters after T4.5** (Orders, Inventory, Products, Library + utility definition). The pattern is well-validated.
- **Drawer-header-1fr-on-mobile pattern** repeats here from T2.1 (AdminBundles editor right-pane similar) — the grid-template-columns single-column override at narrow widths is now a project pattern. If a future drawer/detail panel uses 2-column grid, apply this rule.
- **Sticky thead vs `.responsive-stack`** — sticky positioning becomes inert when thead is `display: none`. This is correct behavior; no special handling needed. Documented as a sanity check for future table-with-sticky-thead conversions.
