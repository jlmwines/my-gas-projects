# Unified Task UI — Shared List + Detail Component

**Status:** Planning
**Supersedes:** `ADMIN_TASK_UI_PLAN.md` post-go-live follow-ups #1, #4, and the Manager ↔ Admin convergence section.

Tasks appear in five places today (AdminTasksView, PublishingView Tasks tab, LibraryView entity drawer, Manager Dashboard, AdminDashboard summary) with different layouts, different language, and different capabilities at each. Opening a task from Publishing opens an entity drawer with no task controls. Opening from the dashboard uses a bespoke inline editor that doesn't share code with anything else. No consistent path through a task anywhere.

---

## Design decisions

**1. One task detail component — `TaskDetail`.** A shared modal overlay that opens from any task row, anywhere. Role and task type determine what renders inside. Replaces the AdminTasksView side panel, the Publishing entity-drawer workaround, the LibraryView display-only rows, and the dashboard's bespoke inline editor.

**2. Task detail layout — top to bottom:**
- **Toolbar:** task name (truncated) + Close
- **Compact header:** status pill + assignee chip + due chip — one line, not labeled rows
- **DO pack:** `TaskPacks.packBody()` — the type-specific action surface; loads with the task
- **Admin controls** (admin role only): status dropdown + Done button always visible; assignee / dates / notes behind a "More" toggle to keep the primary action unobstructed
- **Entity context** (bottom, lazy): compact block — entity title + state chip + sibling language link + campaign/project chips; rendered only when toggled; fetched via `WebAppLibrary_getEntityDetail` on demand so it never delays task open

**3. Consistent language.** Same field labels and button text everywhere. Task name, status values, and action button labels come from one source.

**4. One task list column pattern.** A column definition array that the render function iterates. Same columns, same default sort everywhere a task list appears. Reorder = change array, no other code change needed. No reorder UI now.

**5. Column order:** Project → Campaign → Task title → Status → Due → Notes

**6. Inline quick actions on list rows.** Each row renders the single most common action for the role + task type without opening the detail. Driven by `TaskPacks.packKind()` so the logic is in one place.

**7. Filters collapsible** on mobile. Filter bar shown/hidden by a toggle; state not persisted.

**8. Lazy entity context.** Anything requiring a second server call (entity connections, history, references) sits behind a toggle in the detail and only fetches on demand.

---

## TaskDetail component

New shared include: `TaskDetail.html`. Extends TaskPacks — includes it, wraps it.

### Host contract

```js
TaskDetail.configure({
  getTask:         function(id)   { /* return task object */ },
  getEntity:       function(slug) { /* return library entity for DO pack */ },
  loadEntityDetail:function(slug, cb) { /* async: cb(detailData) */ },
  refresh:         function()     { /* re-render host list */ },
  reload:          function()     { /* full server reload */ }
});
TaskDetail.open(taskId);  // opens the modal
```

`TaskPacks.configure()` is called internally by `TaskDetail.configure()` — hosts configure once.

### Modal markup

Single `modal-overlay` div (`#td-modal`) opened via `ModalOverlay.open('td-modal')`.

```
[ task name                              Close ]
[ status-pill  assignee-chip  due-chip        ]
─────────────────────────────────────────────
[ DO pack (TaskPacks.packBody)               ]
─────────────────────────────────────────────
[admin] [ status select ▾ ]  [ Done ]  [ More ▾ ]
        ↳ expanded: assignee / start / due / notes / Save / Cancel
─────────────────────────────────────────────
[ ▸ Entity context ]  ← toggle, lazy fetch
  entity title · state · EN↔HE sibling · campaign chips
```

### Admin controls behaviour

- Status dropdown + Done always visible to admin (most common actions, zero taps)
- "More" toggle expands assignee, start date, due date, notes, Save, Cancel
- `More` state persisted in `sessionStorage` so it stays open across tasks in a session
- Manager role: compact header only (status/assignee/due read-only); no controls section

### Entity context behaviour

- Collapsed by default with a "▸ Entity" toggle
- On expand: calls `loadEntityDetail(slug, cb)`; shows spinner until resolved
- Renders: entity title (link to Library), state chip, sibling language link (EN↔HE), campaign chips, project chip
- No slug, no references in/out, no activity log, no state history — those belong in the Library entity drawer

---

## Task list column pattern

```js
var TASK_COLUMNS = [
  { key: 'project',   label: 'Project',  responsive: 'wide' },
  { key: 'campaign',  label: 'Campaign', responsive: 'wide' },
  { key: 'title',     label: 'Task',     flex: true },
  { key: 'status',    label: 'Status'    },
  { key: 'due',       label: 'Due'       },
  { key: 'notes',     label: 'Notes',    responsive: 'full' },
  { key: 'actions',   label: '',         actions: true }
];
```

`responsive: 'wide'` columns hide on narrow viewports. `responsive: 'full'` hide on mobile. `actions` column renders the inline quick-action cell.

Default sort: due date ascending, nulls last; open tasks before done.

### Inline quick actions (actions column)

Keyed on `TaskPacks.packKind(task.typeId)` and role:

| packKind | Admin action | Manager action |
|---|---|---|
| content_edit | Done | Open Doc |
| content_publish | Done | Mark Published |
| confirmation | Confirm | Confirm |
| deeplink_orders | Done | Open Orders |
| deeplink_inventory | Done | Open Inventory |
| skeleton | Done | — |

---

## Integration points

| Surface | Current | After |
|---|---|---|
| AdminTasksView | Side detail panel (private form + TaskPacks) | TaskDetail modal; table uses column pattern |
| PublishingView Tasks tab | Click opens entity drawer | Click opens TaskDetail modal |
| LibraryView entity drawer attached-task rows | Display only | Click opens TaskDetail modal |
| Manager Dashboard | Bespoke inline expand + saveTask | TaskDetail modal; bespoke editor retired |

AdminTasksView's `#detail-task` form and `populateTaskForm` become the implementation reference for TaskDetail's admin controls section — lifted verbatim, not reimplemented.

---

## Deploy sequence

**A — Build TaskDetail; wire into AdminTasksView only.**
Replace the side panel with `TaskDetail.open()`. Behavior-preserving; no other surface changes. This is the only step with blast radius — smoke all task types before proceeding.

**B — Wire TaskDetail into PublishingView Tasks tab and LibraryView entity drawer.**
Task row clicks call `TaskDetail.open(id)` instead of opening entity drawer or doing nothing. No AdminTasksView changes.

**C — Manager Dashboard repointed onto TaskDetail.**
`toggleTaskExpand` and `saveTask`/`revertTask` retired. Dashboard task rows call `TaskDetail.open(id)`. Shape reconciliation: dashboard task objects adapted to normalized shape in `getTask` callback.

**D — Column pattern applied to AdminTasksView table, then Publishing Tasks tab.**
Render functions refactored to iterate `TASK_COLUMNS`. Behaviour unchanged; reorder is now a one-line array edit.

Later: inline quick actions on list rows; mobile filter collapse toggle.

---

## Out of scope

- Column reorder UI or persistence
- Filter state persistence across sessions
- New task creation changes
- Retiring AdminProjectsView from nav (gated on soak per existing plan)
- Free-form tasks without a project (locked decision, existing plan)
