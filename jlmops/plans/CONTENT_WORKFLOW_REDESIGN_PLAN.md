# Content Workflow Redesign Plan

This plan defines the end-state workflow for JLM Wines content operations — who does what, on which surface, in what sequence — as of 2026-06-14. It is the output of a five-lens adversarial design panel. Implementation has not begun.

## Goal

Deliver an editorial workflow where: admin reads a calendar-driven deficiency view and spawns content chains; manager edits, translates, and hands back; Claude sessions assist in EN drafting and companion generation; status is readable at a glance throughout. No new primitives; no rewrites of working systems.

---

## Locked Decisions

### Decision 1: Calendar

**Locked:** Markdown stays the calendar authoring surface. The in-app surface is a **Deficiency preset** in LibraryView — a filter chip showing entities whose `slb_TargetDate` falls within the current or next month, sorted by target date, with state and sibling state visible in each row.

Gap rows for planned-but-nonexistent slots are **not** shown in-app. Reading the markdown to derive gap rows creates a sync/ownership problem — who owns the canonical date? The bridge remains manual: admin reads the markdown, identifies the gap, opens the deficiency preset, and spawns the chain. The markdown is editorial intent; the library is operational reality.

`slb_TargetDate` is a new column (additive, append-only per schema rule) — a single generic target-publish-date field all content types share, written by `spawnContentChain` when the caller passes it.

### Decision 2: Top-down overview

**Locked:** Family roll-up is a **section within the entity drawer** — not a new surface, not a container entity. A client-side reverse-reference map is built after the entity list loads (O(n) scan of all `slb_References` arrays, already in memory). The Family section groups by type (EN/HE siblings, companion types, images) with state pills and tap-to-open. At ~14 pieces the drawer depth is manageable; a dedicated family-preset view is deferred until scale warrants it.

No new entity type. `slb_FamilyKey` (denormalized shared slug prefix) noted as a possible future optimization if the reverse scan proves inadequate; not added speculatively.

### Decision 3: Task surface convergence

**Locked:** Manager dashboard queue keeps its render loop and list UI. Task-working interaction is repointed onto **TaskPacks** (`configure({getTask, getEntity, refresh, reload})`). The bespoke inline editor (`saveTask`, `toggleTaskExpand`, `WebAppDashboardV2_updateManagerTask`) is replaced by `TaskPacks.packBody()` rendering inside the expanded row.

Two things that **survive unchanged:**
- `taskOpenTarget()` deep-link buttons (navigation, not task-working — independent of the pack repointing)
- `revertTaskToAdmin()` dedicated confirm button — this is a role-transfer (manager → admin), not a status change; it must remain a distinct action with its own confirm dialog

**Key shape gap (verified in code):** `fileUrl` (Drive doc link for content tasks) is present in `WebAppDashboardV2` task objects but absent from `_getQueueTasks` normalized shape. Resolved via client-side adapter in the dashboard's `getTask()` callback (derive from entity data already in memory). Server feed change is deferred — see Open Questions.

Before retiring the bespoke editor, confirm the contact task pack archetype covers the `isContactTask` context block (entityPhone, entityLanguage, entity link) currently rendered by the dashboard inline editor.

End state: AdminProjectsView kept in-repo, removed from nav after soak confirmation.

### Decision 4: Creation locus

**Locked:** PRIMARY locus is **AdminTasksView** — unhide `#btn-content-stream`, repoint its handler from `WebAppProjects_createContentStream` to `WebAppLibrary_spawnContentChain`. The modal already exists; it needs an entity-picker and `slb_TargetDate` field.

The deficiency preset row in LibraryView also exposes a contextual **"Spawn Chain"** action (same `spawnContentChain` call), making both surfaces functional entry points. AdminTasksView is primary because the button and modal infrastructure already exist there (ADMIN_TASK_UI_PLAN follow-up #8).

**Dissent noted:** Editorial-Ops and Role designer argued for LibraryView-primary because admin has entity context at the demand surface. Resolved in favor of AdminTasksView-primary with LibraryView as a first-class secondary entry, not a subordinate shortcut.

### Decision 5: Revert/re-edit after close

**Locked:** Roll-forward-only. Closed/published entities get an admin-only **"Request Correction"** button in the entity drawer (gated by `data-roles="admin"`). It spawns `task.content.edit` against the same entity slug via `TaskService.createTask` + `LibraryService.logEntityActivity`. Entity stays `published` while the corrective task is open; task close bumps `slb_Version` to N+1 via `LibraryService.lockVersion`. Content recovery uses Drive (~30d) / git — no in-app revert. "Revert" needs no separate definition: it is a corrective edit whose content happens to match a prior state.

### Decision 6: Handoff visibility

**Locked:** Three layers, all client-side over data already loaded:

1. **Entity list row** — state pill via `TaskWidgets.statusClass` (already dynamic; free-form `slb_State` strings render as pills with no schema change). Adopt a controlled vocabulary in `CONTENT_STAGES` config: `draft`, `editing`, `translating`, `in_review`, `published`, `abandoned`.
2. **Overdue chip** — open task's `dueDate` past today → red chip in drawer Tasks tab (already partially wired).
3. **Deficiency preset blank** — entity with `slb_TargetDate` in window and no open task shows a blank task-column row; that is the stall signal.

Deferred: "in handoff" badge (open task assigned to counterpart role). Implement only if richer state vocabulary proves insufficient.

---

## End-state Surface Map

| Surface | Roles | Job |
|---|---|---|
| **Dashboard** | Both | Daily ops: sync widget (admin), manager task queue via TaskPacks, ops cards |
| **Library** | Both | Entity catalog; deficiency preset; family drawer; admin-only: spawn chain, lock, correct |
| **Tasks** | Admin only | Full workbench (create + do + manage); primary content-chain creation locus |
| AdminProjectsView | Admin (fallback) | Retained in-repo; removed from nav after Tasks soaks |

Manager has no separate task workbench. Dashboard queue + TaskPacks IS their workbench.

---

## Model Changes

One schema addition required:

- **`slb_TargetDate`** — append to `config/schemas.json` SysLibrary headers (per schema-append-only rule); null for existing rows; written by `spawnContentChain` when caller supplies it.

No other column additions. `slb_State` controlled vocabulary is a config/convention change, not a schema column change. `st_LinkedEntityId` cleanup (redundant for library-typed tasks per DATA_MODEL.md) deferred.

---

## Build Sequence

**Step 1 — Fix "+ Content" button** — Cost: A (Reuse)
Anchor: `AdminTasksView.html:97` (`#btn-content-stream` `display:none`) + `createContentStream()` line ~1013 (calls `WebAppProjects_createContentStream`)
New: Remove `display:none`; swap call target to `WebAppLibrary_spawnContentChain`; add entity-picker and `slb_TargetDate` fields to `#contentStreamModal`.

**Step 2 — Add `slb_TargetDate` column** — Cost: A (Reuse)
Anchor: `config/schemas.json` SysLibrary headers; `SetupSheets.js#syncHeaders`; `WebAppLibrary_spawnContentChain`
New: Append column to schema headers; add optional `targetDate` arg to `spawnContentChain` + `LibraryService.spawnContentChain`; run `generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`.

**Step 3 — Deficiency preset in LibraryView** — Cost: B (Adapt)
Anchor: `LibraryView.html` existing filter chip infrastructure; `_getLibraryEntities` shape (already includes entity dates)
New: Date-range filter on `slb_TargetDate`; "Deficiency" preset chip rendering entities in window by state; contextual "Spawn Chain" row action calling `WebAppLibrary_spawnContentChain`.

**Step 4 — Family section in entity drawer** — Cost: B (Adapt)
Anchor: `LibraryView.html` `renderEntityDrawer()`; entity list already loaded client-side with `slb_References`
New: Build reverse-reference map (`Map<slug, Set<referencing slugs>>`) post-load; Family section HTML grouped by type (siblings / companions / images) with state pills and tap-to-open links.

**Step 5 — TaskPacks convergence on manager dashboard** — Cost: B/C (Adapt/Build)
Anchor: `ManagerDashboardView_v2.html` bespoke editor lines ~597–677 (~80 lines to retire); `TaskPacks.html` `configure()` + `packBody()`; `WebAppDashboardV2_updateManagerTask` (write path preserved); `taskOpenTarget()` (survives, render above pack output)
New: Shape adapter in `getTask()` mapping dashboard task objects → normalized shape, including `fileUrl` resolution client-side from entity data; configure `TaskPacks` in the expand slot; keep `revertTaskToAdmin()` as a dedicated button (role-transfer, not pack action); verify `isContactTask` context coverage before retiring bespoke editor.

**Step 6 — Controlled `slb_State` vocabulary** — Cost: A (Reuse)
Anchor: `CONTENT_STAGES` config array; `TaskWidgets.statusClass()` (already handles arbitrary lowercase-hyphenated strings)
New: Define and document vocabulary (`draft`, `editing`, `translating`, `in_review`, `published`, `abandoned`) in `DATA_MODEL.md`; wire stage names into `spawnContentChain` task-close state transitions.

**Step 7 — "Request Correction" in entity drawer** — Cost: A (Reuse)
Anchor: `LibraryView.html` admin-gated drawer action buttons; `TaskService.createTask`; `LibraryService.logEntityActivity`; `data-roles="admin"` CSS gate
New: Button visible when `slb_State === 'published'` and user is admin; spawns `task.content.edit` against entity slug; toast confirmation.

**Step 8 — De-dup Notes in AdminTasksView** — Cost: A (Reuse)
Anchor: `AdminTasksView.html:337–338` (MANAGE form Notes textarea); `TaskPacks.html:63–64` (pack Notes textarea) — ADMIN_TASK_UI_PLAN follow-up #2
New: Remove Notes from MANAGE form; pack Notes is the single field.

---

## Edge Cases and How They Resolve

| Scenario | Resolution |
|---|---|
| EN published, HE still draft | State pills on entity row show both states; sibling state visible in one list scan |
| Companion email must wait on post URL | Admin spawns email task from drawer after blog entity reaches `published`; no auto-trigger |
| Abandoned draft (no open task) | `abandoned` state pill; appears in deficiency preset as blank task-column row — stall visible |
| Calendar slip (target date past, entity in `in_review`) | Deficiency preset shows entity overdue; admin investigates drawer |
| Closed entity needs correction | "Request Correction" → corrective task open → entity stays `published` with amending pill; task close bumps version |
| Multiple companions unlocking simultaneously | Admin spawns in sequence from deficiency preset or entity drawer; no fan-out automation at current scale |
| Task closed without artifact | Drawer shows missing `slb_DocUrl`; orphan-integrity report (already live) surfaces it |

---

## Open Questions for the Product Owner

1. **`abandoned` state** — Must admin explicitly set `abandoned`, or is "draft + no open task" sufficient signal? If explicit, what UI affordance sets it?

2. **Deficiency preset window** — Current/next month assumed. Should it be configurable, or is a rolling 8-week window more useful?

3. **Manager pack coverage before convergence** — Confirm which manager task types currently handled inline (via bespoke Save) vs. via deep-link. Content task types and contact task types need verified pack archetypes before the bespoke inline editor can be retired (Step 5).

4. **`fileUrl` long-term home** — Today: `fileUrl` is computed server-side in `WebAppDashboardV2` and absent from `_getQueueTasks`. Short-term fix: client-side adapter in dashboard `getTask()`. Long-term: should `fileUrl` move into `_getQueueTasks` (cleaner, slower load for all surfaces) or stay as a per-surface adapter (cheaper now, drift risk over time)?

5. **Sibling state in entity list** — Showing EN and HE state side-by-side requires pairing slugs client-side by base-slug convention. This is fragile if slug naming diverges. Prefer (a) computed pairing (no model change) or (b) an explicit `slb_SiblingSlug` column (additive, robust)?
