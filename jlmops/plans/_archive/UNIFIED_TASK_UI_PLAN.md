# Unified Task UI — Shared List + Detail Component

**Status:** Deploys A–E complete @354–@365. All five deploys shipped.
**Supersedes:** `ADMIN_TASK_UI_PLAN.md` post-go-live follow-ups #1, #4, and the Manager ↔ Admin convergence section.

Tasks appear in five places today (AdminTasksView, PublishingView Tasks tab, LibraryView entity drawer, Manager Dashboard, AdminDashboard summary) with different layouts, different language, and different capabilities at each. Opening a task from Publishing opens an entity drawer with no task controls. Opening from the dashboard uses a bespoke inline editor that doesn't share code with anything else. No consistent path through a task anywhere.

---

## Design decisions

**1. One task detail component — `TaskDetail`.** Opens from any task row, anywhere. Role and task type determine what renders inside. Replaces the AdminTasksView side panel content, the Publishing entity-drawer workaround, the LibraryView display-only rows, and the dashboard's bespoke inline editor.

**2. Two mounting modes, one inner HTML.** In AdminTasksView, TaskDetail renders inside the existing right panel — zero layout change, zero blast radius for Deploy A. From every other surface it opens as a `ModalOverlay` floating modal. Same markup and logic; the host chooses the mount point. Panel mode and modal mode are mutually exclusive per host — no ID collisions.

**3. Task detail layout — top to bottom:**
- **Toolbar:** task name (truncated) + Close
- **Compact header:** status pill + assignee chip + due chip — one line, not labeled rows
- **DO pack:** `TaskPacks.packBody()` — the type-specific action surface; loads with the task
- **Admin controls** (admin role only): status dropdown + Done button always visible; assignee / start / due / notes behind a "More" toggle to keep the primary action unobstructed. Priority is a list-view concern only — not shown in the detail.
- **Entity context** (bottom, lazy): compact block — entity title + state chip + sibling language link + campaign chip + project chip; collapsed by default; fetched on demand so it never delays task open

**4. Consistent language.** Same field labels and button text everywhere. Task name, status values, and action button labels come from one source.

**5. One task list column pattern.** A column definition array that the render function iterates. Same columns, same default sort everywhere a task list appears. Reorder = change array, no other code change needed. No reorder UI now.

**6. Column order:** Project → Campaign → Task title → Status → Due → Notes

**7. Inline quick actions on list rows.** Each row renders the single most common action for the role + task type without opening the detail. Driven by `TaskPacks.packKind()` so the logic is in one place.

**8. Filters collapsible** on mobile. Filter bar shown/hidden by a toggle; state not persisted.

**9. Lazy entity context.** Anything requiring a second server call (entity connections, history, references) sits behind a toggle in the detail and only fetches on demand.

---

## TaskDetail component

New shared include: `TaskDetail.html`. Wraps TaskPacks — do NOT also include TaskPacks directly. Hosts that currently include TaskPacks (`AdminTasksView`, `ManagerDashboardView_v2`, `LibraryView`) drop that include once they adopt TaskDetail.

### Host contract

```js
TaskDetail.configure({
  getTask:          function(id)       { /* return task object */ },
  getEntity:        function(slug)     { /* return library entity for DO pack; return null if unavailable — packs handle null gracefully */ },
  loadEntityDetail: function(slug, cb) { /* async: cb(detailData) on toggle expand */ },
  saveTask:         function(id, fields, cb) { /* route to correct backend by role:
                                                 admin  → WebAppTasks_updateTask
                                                 manager → WebAppDashboardV2_updateManagerTask */ },
  refresh:          function()         { /* re-render host list */ },
  reload:           function()         { /* full server reload */ }
});
TaskDetail.open(taskId);   // modal mode (all surfaces except AdminTasksView)
TaskDetail.render(taskId, containerEl); // panel mode (AdminTasksView right panel)
```

`TaskPacks.configure()` is called internally — hosts configure once through TaskDetail.

### Layout

```
[ task name                              Close ]
[ status-pill  assignee-chip  due-chip        ]
─────────────────────────────────────────────
[ DO pack (TaskPacks.packBody)               ]
─────────────────────────────────────────────
[admin] [ status select ▾ ]  [ Done ]  [ More ▾ ]
        ↳ assignee / start / due / notes / Save / Cancel
─────────────────────────────────────────────
[ ▸ Entity ]  ← toggle, lazy fetch on expand
  entity title · state chip · EN↔HE sibling · campaign chip · project chip
```

### Admin controls

- Status dropdown + Done always visible (most common actions, zero taps)
- "More" toggle expands assignee, start date, due date, notes, Save, Cancel
- "More" state persisted in `sessionStorage` so it stays open across tasks in a session
- Priority is a list-view concern; not present in the detail form
- Manager role: compact header only (read-only); no controls section. `WebAppDashboardV2_updateManagerTask` accepts only notes + status — there is nothing more for manager to edit here.

### Entity context

- Collapsed by default; toggle calls `loadEntityDetail(slug, cb)`, shows spinner until resolved; entity data is not needed until then so task open stays fast
- Field mapping from raw entity row: `slb_State` → state chip; `slb_Language` → sibling language lookup; `slb_CampaignId` → campaign chip
- Project chip sourced from the already-loaded task object (`task.projectId`) — not from the entity detail call
- `hideNotes: true` forwarded to TaskPacks to suppress the pack's own Notes field when admin controls "More" section is rendering Notes — no duplicate Notes fields
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

`responsive: 'wide'` columns hide on narrow viewports. `responsive: 'full'` hides on mobile. `actions` column renders the inline quick-action cell.

Default sort: due date ascending, nulls last; open tasks before done.

### Inline quick actions (actions column)

Keyed on `TaskPacks.packKind(task.typeId)` and role. Manager only sees tasks assigned to Manager role — publish tasks are Admin-assigned and never appear in the manager column.

| packKind | Admin action | Manager action |
|---|---|---|
| content_edit | Done | Open Doc |
| content_publish | Done | — |
| confirmation | Confirm | Confirm |
| deeplink_orders | Done | Open Orders |
| deeplink_inventory | Done | Open Inventory |
| skeleton | Done | — |

---

## Integration points

| Surface | Current | After |
|---|---|---|
| AdminTasksView | Side panel (private form + TaskPacks) | TaskDetail.render() into right panel; table adopts column pattern |
| AdminDashboard summary | Task card → navigates to AdminTasksView | Task card row opens TaskDetail modal |
| PublishingView Tasks tab | Click opens entity drawer | Click opens TaskDetail modal |
| LibraryView entity drawer attached-task rows | Display only | Click opens TaskDetail modal |
| Manager Dashboard | Bespoke inline expand + saveTask/revertTask | TaskDetail modal; bespoke editor retired |

AdminTasksView's `#detail-task` form and `populateTaskForm` are the implementation reference for TaskDetail's admin controls section — lifted verbatim, not reimplemented.

---

## Deploy sequence

**A — Build TaskDetail; wire into AdminTasksView right panel only.**
TaskDetail renders inside the existing right panel via `TaskDetail.render()`. AdminTasksView drops its direct `TaskPacks` include. Zero layout change; behavior-preserving. Smoke all task types (confirmation, content-edit, content-publish, deeplink, skeleton) before proceeding.

**B — Wire TaskDetail modal into PublishingView Tasks tab and LibraryView entity drawer.**
Task row clicks call `TaskDetail.open(id)`. `getEntity` in both hosts looks up from the already-loaded state.tasks/library arrays. No AdminTasksView changes.

**C — Wire TaskDetail modal into AdminDashboard summary.**
Task card row opens `TaskDetail.open(id)`. Admin dashboard task shape is thin (missing `notes`, `startDate`) — re-fetch full task object on open via a `getTask` that calls the server. `assignedTo` must be added to the admin dashboard data call so list rows show it correctly before the detail opens. `getEntity` wired to whatever entity map is available; null fallback safe.

**D — Manager Dashboard repointed onto TaskDetail modal.**
`toggleTaskExpand` and `saveTask`/`revertTask` retired. `getEntity` wired to `libraryBySlug` map already present in the manager data response — "Open Doc" works. `typeId` confirmed present on dashboard task objects; pack dispatch works without changes. `assignedTo` is always 'Manager' for manager-dashboard tasks — host hard-codes it in `getTask`. Backend routes to `WebAppDashboardV2_updateManagerTask` via `saveTask` callback (notes + status only).

**E — Column pattern applied to PublishingView Tasks tab (scoped down from original).**
`TASK_COLUMNS` array (title, entity, assignee, status, due, doc) defined; both `<thead>` and `<tbody>` iterate it via `_renderPvTaskCell`. AdminTasksView excluded — its 3-panel-state/12-column system is too complex for this pattern without regression risk. Behaviour unchanged.

Later: inline quick actions on list rows; mobile filter collapse toggle.

---

## Out of scope

- Column reorder UI or persistence
- Filter state persistence across sessions
- New task creation changes
- Retiring AdminProjectsView from nav (gated on soak per existing plan)
- Free-form tasks without a project (locked decision, existing plan)
