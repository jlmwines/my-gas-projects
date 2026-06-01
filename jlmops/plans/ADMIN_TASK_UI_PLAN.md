# Admin Task UI — Unified Task Workbench Plan

**Created:** 2026-06-01
**Origin:** chavruta + a 4-lens design workflow (2026-06-01). Realizes the convergence in `plans/CONTENT_LIBRARY_PLAN.md` §18 "Task UI shape" and its 2026-06-01 "task administration + creation locus" refinement.
**Status:** **Deploy A SHIPPED** 2026-06-01 (@189 deploy @193 — TaskPacks shared include). **Deploy B GO-LIVE** 2026-06-01 (@191 deploy @198 — `AdminTasksView` live in the admin nav after Dashboard; `AdminProjects` demoted to the bottom as the soak fallback). Polish follow-ups still open (see "Post-go-live follow-ups" at the bottom).

---

## Problem

Task work is split across two mental models. `AdminProjectsView` is a real task-administration surface (editable Status/Priority/Assignee/Start/Due/Notes, a multi-state sortable/filterable table, new-task form, content-stream creation) but is project-as-container. `LibraryView` is the library-era surface (unified queue + do-the-work "packs" + entity catalog) but its Tasks tab can only edit **notes** — the administration layer never ported. The admin therefore still reaches for the old view to move due dates / reprioritize / reassign.

**Goal:** one Tasks surface that owns **create + do + manage**, recovering full task administration without losing content-chain creation or entity inspection.

---

## Decisions locked (2026-06-01)

1. **Design — Master-Detail Task Workbench in a NEW `AdminTasksView` file.** Left multi-state table + right detail pane, with `LibraryView`'s `packBody()` dispatcher folded into the detail pane as a DO region beneath the MANAGE form. (Hybrid of the design workflow's options 2/3/4.) **Build-new, not in-place surgery:** AdminProjectsView is preserved untouched as the fallback (Decision 3), so the Tasks view is a fresh file that *lifts* AdminProjectsView's proven sub-components verbatim (the multi-state table render + sort/filter/inline-edit/bulk-delete handlers, the `#detail-task` MANAGE form + per-type lock matrix) and *omits* (never imports) the project-form/campaign/`generateOutputs`/mode-split machinery. Glue is written fresh against the normalized `_getQueueTasks` feed — no `st_*`→normalized rebind of an existing file. Omission can't leave dead coupling; stripping can.
2. **Data feed — single task-row shape, normalized SERVER-SIDE.** Reconcile AdminProjectsView's `st_*` objects (`WebAppTasks_getAll*`) and LibraryView's normalized `t.*` (`WebAppLibrary_getData`) into ONE shape that the table, the MANAGE form, and `packBody()` all consume. This is the central integration task; do it once, server-side, rather than a per-pack client adapter.
3. **Nav / retirement — additive, with a demoted fallback.** **Library** stays in the menu (entity catalog). **Tasks** = the new workbench. **Projects** (`AdminProjectsView`) is *preserved* but moved to the **bottom** of the menu as a safety fallback during soak; removed only once the Tasks view is proven to cover everything. Kept in-repo regardless.
4. **Project model — project is a library entity (§18); creation relocates, not vanishes.** Parent projects are a near-static set (new top-level projects are rare; most work is publishing under an existing parent), so they serve as **filter chips** on the Tasks view + entries in the Library catalog. Content-stream creation **picks** an existing parent; a genuinely new project is a **lightweight "New project" entity** in the Create flow. Drop the project-*container* view + project-CRUD form + campaign select + `generateOutputs` from the Tasks view (project/campaign domain — out of scope here).
5. **Role split — existing CSS gate.** Admin = full table + detail editor + creation. Manager = compact/queue density, packs only. Via the existing `data-roles="admin"` body-class gate; no new role plumbing. Manager mobile QUEUE density stays today's responsive `lv-task-row` (zero regression); the TABLE density is admin-only/desktop-first.
6. **GAS discipline — load-once + client-side filter/sort** (precedent: UI T3.2). One fetch populates the table; filtering and sorting are client-side over the loaded array.

---

## Verified against code (2026-06-01) — most "build" items already exist

A code audit before implementation (the project's stale-tracking guard) found the integration cost is **much lower** than the design workflow estimated. Confirmed in code:

- **No SysConfig JSON edits anywhere in this plan.** `pack_form` is already on every task template (it is what routes the DO region); `st_ProjectId` / `st_EntityType` / `st_EntityId` are already SysTasks columns; `task.project.custom` already exists. Dropping the project-CRUD/campaign/`generateOutputs` is code-only (the `task.campaign.*` templates stay for phase 11). **Every step is a plain code deploy via `deploy.ps1` — no `generate-config.js` / `rebuildSysConfigFromSource`.**
- **The "central build" (single normalized task-row shape) already exists.** `WebAppLibrary._getQueueTasks` already maps SysTasks → a complete shape: `id`(=st_TaskId), `typeId`, `topic`, `name`, `entityType/Id`, `entityName`, `assignedTo`, `projectId`, `sessionId`, `createdDate`, `startDate`, `dueDate`, `doneDate`, `status`, `priority`, `notes`, `packForm`. Decision 2 is therefore **adopt `_getQueueTasks` / `WebAppLibrary_getData` as the single feed and point the revived table + MANAGE form at it** (field rename `st_*` → normalized), not build a new shape.
- **`WebAppTasks_updateTask` already writes the full field set** (status/priority/assignedTo/start/due/done/notes/linkedEntityId) — confirmed at `WebAppTasks.js:352`. LibraryView's `{notes}`-only call was self-imposed.
- **Project-as-filter logic already exists** — `getFilteredTasks` (`AdminProjectsView.html:1894`) filters `st_ProjectId`; the normalized shape carries `projectId`. Work = remove the `mode='projects'/'tasks'` split, not build filtering.
- **Entity→task return leg — open question RESOLVED.** The `attached_tasks` payload already carries `id` (`_getQueueTasks`, `WebAppLibrary.js:72`), and the `loadView` deep-link handoff (`checkDashboardNavigation`/`navigateToTask`) already exists. Only the drawer-row `onclick` is missing.
- **`createProject` backend exists** (`ProjectService.createProject`); only a lightweight create UI is new.

**Genuinely new work (the actual gaps):** (1) extract `packBody()` into a shared `TaskPacks` include; (2) assemble the new `AdminTasksView` (lift proven components, omit project machinery, bind to the normalized feed); (3) wire the drawer-row `onclick` for the return leg. **No `createTask` change** — free-form/projectless tasks were considered and **declined (2026-06-01)**; `WebAppTasks_createTask`'s mandatory `projectId` (`WebAppTasks.js:641`) stays as-is.

---

## The surface

### Tasks view (new `AdminTasksView` file — proven components lifted from AdminProjectsView, which stays intact; standalone nav entry)

- **Left — task table.** Multi-state (compact / standard / full = `panel-state-1/2/3`), sortable + filterable, over the load-once unified queue across all ~75 types. Filter set = AdminProjectsView's status/priority/assignee **+** LibraryView's entity-type/topic/language **+** an admin-only **project filter chip** (`getFilteredTasks` already filters `st_ProjectId`) **+** session/stream **+** free-text. Scope links Open/Started/Future/All. Inline-edit cells (`saveInlineEdit`). Bulk select + delete.
- **Right — detail pane, two stacked regions:**
  - **MANAGE** — the existing `#detail-task` form (Title / Status / Priority / Assignee / Start / Due / Entity / Entity-URL / Notes), with `populateTaskForm`'s per-type lock matrix lifted **verbatim** (system/sync/order tasks stay locked; content tasks fully editable; data tasks read-only).
  - **DO** — the task's pack rendered in its declared `pack_form` (inline-expand / modal-overlay / dedicated-view).
- **Creation — top bar, admin-only:** **New Task** (single task → `WebAppTasks_createTask`, which keeps **requiring a project/scope** — no free-form/projectless tasks, locked 2026-06-01) and **Create Content Tasks** (content-chain spawner → `WebAppLibrary_spawnContentChain`, entity as an input: pick existing or spin up new). Creation never starts in Library.

### Library view (kept, near-frozen)

Entity catalog — presets (Library/Blog/Campaigns/Templates/Images), search, sort, entity table, drawer (Files/URLs, Refs in/out, State history, Activity log, Attached tasks). **Two changes only:** (a) drawer attached-task rows become clickable → the entity→task return leg; (b) the drawer "Create Content Tasks" shortcut hands off to the *same* creation modal the Tasks view owns, pre-filled with the entity. The in-LibraryView Tasks tab is retired after the Tasks view soaks.

### Projects view (demoted)

`AdminProjectsView` kept and reachable, moved to the bottom of the admin menu as a soak-period fallback. Retired from nav once the Tasks view is proven.

---

## Reuse / Adapt / Build

**Reuse (verbatim):**
- Two-column master-detail shell + `panel-state-1/2/3` CSS + `setPanelState` — `AdminProjectsView.html`.
- Multi-state sortable/filterable table + scope links + sort handlers + inline-edit cells + bulk-select/delete — `AdminProjectsView` (`renderTasksList`, `saveInlineEdit`, `cancelSelectedTasks`).
- Task MANAGE form + per-type lock matrix — `AdminProjectsView` `#detail-task` + `populateTaskForm` + `saveTaskStatus` (lift the gating verbatim, do not re-implement).
- `WebAppTasks_updateTask` with the full field set (status/priority/assignee/start/due/notes/linkedEntityId/title) — **already** called by AdminProjectsView; the server path exists. (LibraryView's `{notes}`-only call was self-imposed, not a server limit.)
- Entity drawer + catalog tab + presets/search — `LibraryView` (`renderEntityDrawer`, `renderLibrary`) — unchanged.
- Role split — existing `data-roles="admin"` CSS gate.

**Adapt:**
- New-task modal — reuse the existing form; the Project select stays **required** (no free-form, locked 2026-06-01). May be relabeled a project/scope picker, but never optional.
- Content-chain modal/spawner — point the Tasks-view "+ Content" button at `WebAppLibrary_spawnContentChain` (library-era fork that writes the entity + chain), **not** legacy `WebAppProjects_createContentStream`.
- `packBody()` dispatcher + handlers (`confirmTask`, `createBlankDoc`, `attachExistingDoc`, `openLockModal`, `markPublished`, `openView`) + lock/attach modals — extract into a shared include (`TaskPacks`) first, then render into the DO region.
- Project demoted to a filter chip — `getFilteredTasks` already filters `st_ProjectId`; remove the `mode='projects'/'tasks'` entry split, project switcher, and project home/back flow.

**Build:**
- **Unified server-side task-row shape** — the central integration task (Decision 2).
- **Entity→task return leg** — click handler on drawer attached-task rows → `sessionStorage.selectTaskId` + `loadView('Tasks')`, consuming AdminProjectsView's existing `checkDashboardNavigation`/`navigateToTask` handoff.
- Lightweight "New project" entity create for the rare new-project case.

**Drop (out of scope — do NOT carry into the Tasks view):** project-form, project CRUD (`createProject`/`saveProject`/`WebAppProjects_*`), campaign select, `generateOutputsModal`. Project/campaign domain; if ever needed, a separate surface.

---

## Sequenced implementation — two deploys

**Risk profile:** only Deploy A touches a live surface (LibraryView). The new view in Deploy B is unreachable until the nav flip, so it can be built in full and tested *unlinked* before exposure. GAS has no local test loop (push+deploy is the test, no `/dev`) — so build the bulk in one pass but exercise each pack archetype on the deployed-but-unlinked view to keep debugging tractable. The data feed is already a single normalized shape (`_getQueueTasks`); no shape build.

### Deploy A — extract packs (the only live-touching change)

- Move LibraryView's `packBody()` + pack handlers (`confirmTask`, `createBlankDoc`, `attachExistingDoc`, `openLockModal`, `markPublished`, `openView`) + lock/attach modals into a shared `TaskPacks` include. Behavior-preserving.
- **Verify LibraryView is unchanged** — every pack still renders and acts as before.
- This is the single step with real blast radius; ship and confirm it on its own before Deploy B.

### Deploy B — build the whole new surface, unlinked, then go live

- **Build the new `AdminTasksView`** in one pass: lift AdminProjectsView's proven components verbatim (multi-state table + sort/filter/inline-edit/bulk-delete handlers; `#detail-task` MANAGE form + per-type lock matrix); **omit** (never import) the project-form/campaign/`generateOutputs`/mode-split machinery; bind to the existing normalized `_getQueueTasks` feed; add the entity-type/topic/language filters + project filter chip. New Task requires a project/scope (no free-form). **AdminProjectsView is copied from, never modified.**
- **Render the shared `TaskPacks`** into the detail-pane DO region keyed on `packForm`; test each archetype (confirmation, content-edit, content-publish, deep-link).
- **Wire the drawer attached-task row `onclick`** → `loadView('Tasks')` with the task selected (payload already carries `id`).
- **Deploy unlinked** (no nav entry) and exercise the view directly until satisfied — users never see it.
- **Go live (one reversible push):** add the **Tasks** nav entry; keep **Library**; move **Projects** to the bottom as the fallback; repoint `AdminDashboardView_v2`'s summary-card jump from AdminProjectsView to the Tasks view (`selectTaskId`/`selectProjectId` contract).

### Later (after soak)

Retire the in-LibraryView Tasks tab; remove **Projects** from the nav (keep the file in-repo). Gate: confirm `st_ProjectId` filtering fully replaces the project-container for every current admin flow first.

---

## Open / to verify during build

- ~~Does `WebAppLibrary_getEntityDetail.attached_tasks` include a stable task id?~~ **RESOLVED 2026-06-01: yes** — `_getQueueTasks` maps `id: st_TaskId` (`WebAppLibrary.js:72`). No server change; only the client `onclick` is needed.
- ~~Free-form New Task — allow *no* entity/scope?~~ **DECIDED 2026-06-01: NO.** Tasks always require a project/scope; `WebAppTasks_createTask`'s mandatory `projectId` stays. No code change.
- Confirm `st_ProjectId` filtering over the unified queue fully replaces the project-container for every current admin flow before retiring Projects from nav (the "Later (after soak)" step).

---

## What shipped (2026-06-01)

- **Deploy A (@189 deploy @193):** `TaskPacks` shared include extracted from LibraryView (packBody + handlers + Lock/Attach modals), behavior-preserving.
- **Deploy B (@190→@191, deploy @194→@198):** `AdminTasksView` built (copy-reduce from AdminProjectsView; normalized `WebAppLibrary_getData` feed; `st_*`→normalized; tasks-only; TaskPacks DO region below the MANAGE form). Iterated live via a temp link: fixed Open-scope (exclude done client-side), decluttered the header (scope + project filter moved into the top bar, project-nav chrome hidden), killed the back-button-to-empty bug, added the Project filter, removed the unusable 1/3 density. **GO-LIVE @191/@198:** Tasks nav entry after Dashboard; Projects demoted to the bottom (soak fallback); dashboard task-card repointed to AdminTasks. AdminProjectsView untouched throughout.

## Post-go-live follow-ups (open)

1. **Full-width column redesign — DEFERRED (revisit only if needed).** Per user 2026-06-01: the table works as-is; hold this until real use shows the column order/width is actually a problem. If revived: Title-first + wide; cluster the filterable group (Status · Priority · Assignee) in hierarchy; dates together; demote Stream/Link/Done/Created to Full density (needs a visual see-and-adjust pass).
2. **De-dup Notes** — the MANAGE form and the DO pack both render a Notes field; reconcile to one.
3. **Project filter labels** — dropdown shows raw `projectId`s (e.g. `PROJ-SYS_PRODUCT`); add a friendly-name map if wanted.
4. **Entity→task return leg** — wire LibraryView drawer attached-task rows' `onclick` → `loadView('AdminTasks')` + `selectTaskId` (payload already carries `id`; AdminTasksView honors it). Planned in Deploy B, not yet done.
5. **Excise inert project/campaign dead code** from AdminTasksView (present but unreachable with `mode='tasks'`).
6. **After soak:** remove Projects from the nav; retire the in-LibraryView Tasks tab. Gate: confirm `st_ProjectId` filtering fully covers current project flows.

---

## Source

Design workflow run 2026-06-01 (`admin-task-ui-design`, 5 agents): 4 lens designs (minimal-reuse, ideal-workbench, role-convergence, IA-first) + synthesis. Recommendation = the hybrid above. Full option detail in the workflow transcript.
