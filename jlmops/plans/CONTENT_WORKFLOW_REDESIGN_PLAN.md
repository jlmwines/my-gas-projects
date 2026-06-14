# Content Workflow Redesign Plan

This plan defines the end-state workflow for JLM Wines content operations — who does what, on which surface, in what sequence — as of 2026-06-14. It is the output of a five-lens adversarial design panel; the panel's open questions were resolved 2026-06-14 against verified code (see Resolutions). Implementation has not begun.

## Goal

Deliver an editorial workflow where: admin reads a calendar-driven deficiency view and spawns content chains; manager edits, translates, and hands back; Claude sessions assist in EN drafting and companion generation; status is readable at a glance throughout. No new primitives; no rewrites of working systems.

---

## Locked Decisions

### Decision 1: Calendar

**Locked:** Markdown stays the calendar authoring surface. The in-app surface is a **Deficiency preset** in LibraryView — a filter chip showing entities whose `slb_TargetDate` falls within a rolling forward window (default 56 days; config key `system.content.deficiency_window_days`) **plus any overdue not-yet-`published` piece**, sorted by target date, with state and sibling state visible in each row.

Gap rows for planned-but-nonexistent slots are **not** shown in-app. Reading the markdown to derive gap rows creates a sync/ownership problem — who owns the canonical date? The bridge remains manual: admin reads the markdown, identifies the gap, opens the deficiency preset, and spawns the chain. The markdown is editorial intent; the library is operational reality.

`slb_TargetDate` is a new column (additive, append-only per schema rule) — a single generic target-publish-date field all content types share, written by `spawnContentChain` when the caller passes it.

### Decision 2: Top-down overview

**Locked:** Family roll-up is a **section within the entity drawer** — not a new surface, not a container entity. A client-side reverse-reference map is built after the entity list loads (O(n) scan of all `slb_References` arrays, already in memory). The Family section groups by type (EN/HE siblings, companion types, images) with state pills and tap-to-open. At ~14 pieces the drawer depth is manageable; a dedicated family-preset view is deferred until scale warrants it.

No new entity type. `slb_FamilyKey` (denormalized shared slug prefix) noted as a possible future optimization if the reverse scan proves inadequate; not added speculatively.

**Sibling-state pairing** (EN/HE side-by-side) is computed by stripping the language suffix from the slug — CONTENT_LIBRARY_PLAN §5/§12 already mandate the slug-pair lookup, not a row field (the slug is immutable + language-last). No `slb_SiblingSlug` column: a diverging slug is a convention violation to fix at source, not to denormalize around.

### Decision 3: Task surface convergence

**Locked:** Manager dashboard queue keeps its render loop and list UI. Task-working interaction is repointed onto **TaskPacks** (`configure({getTask, getEntity, refresh, reload})`). The bespoke inline editor (`saveTask`, `toggleTaskExpand`, `WebAppDashboardV2_updateManagerTask`) is replaced by `TaskPacks.packBody()` rendering inside the expanded row.

Two things that **survive unchanged:**
- `taskOpenTarget()` deep-link buttons (navigation, not task-working — independent of the pack repointing)
- `revertTaskToAdmin()` dedicated confirm button — this is a role-transfer (manager → admin), not a status change; it must remain a distinct action with its own confirm dialog

**Doc-link sourcing (verified in code 2026-06-14):** content-task doc links do **not** belong on the task shape. `TaskPacks` already sources the Doc link from the entity via its `getEntity(slug)` callback (`TaskPacks.html:102`), not from `task.fileUrl`. The dashboard's `task.fileUrl` + `resolveContentFileUrl` (`WebAppDashboardV2.js:887`) are an artifact of the bespoke inline editor, which had no entity-fetch path. On convergence the dashboard supplies a `getEntity` callback (it already reads SysLibrary once at `WebAppDashboardV2.js:804`), and `task.fileUrl` + `resolveContentFileUrl` **retire**. No `_getQueueTasks` change, no per-surface adapter, no drift: the single source for a doc link is the entity's `slb_DocUrl`. The `taskOpenTarget` content-task case (`ManagerDashboardView_v2.html:579`) becomes redundant with the pack's own file chip and is dropped; `taskOpenTarget` survives only for true cross-view navigation (contact, product-verify).

**Pack coverage (verified in code 2026-06-14).** The dashboard renders **no packs today** — one generic inline body (status `New/In Progress/Done` dropdown + Save + Notes) for every non-system task, plus per-type deep-link buttons and a CRM contact context block. Repointing onto `TaskPacks` is an upgrade for content/confirmation/deep-link/skeleton types (packs equal or exceed the generic body). Two things a naive repoint would regress — both prerequisites for retiring the bespoke editor:
- **Contact context block** (`ManagerDashboardView_v2.html:468`) — name/email/phone/lang shown inline before navigating. The Outreach pack is `dedicated_view` (routes to ManagerContactView); preserve this preview, either as an inline pack header or by keeping the block above the pack.
- **Status transition without close** — the dashboard lets the manager set `In Progress`, not just close. The skeleton pack's close-only affordance loses that; the converged component must keep a status control for skeleton/non-content types.

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

`abandoned` is set **explicitly** via an admin-only **"Abandon"** drawer action (mirrors "Request Correction", `data-roles="admin"`), never inferred from the absence of tasks: `spawnContentChain` creates all stage tasks up front, so a non-`published` entity with no open task is a **stall/orphan** signal, not abandonment. The deficiency preset filters `abandoned` out.

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

No other column additions. `slb_State` controlled vocabulary is a config/convention change, not a schema column change. `st_LinkedEntityId` cleanup (redundant for library-typed tasks per DATA_MODEL.md) deferred. The 2026-06-14 resolutions add **no further columns**: `fileUrl` retires to the entity (Q4); sibling pairing is computed from the slug (Q5). One config key is added: `system.content.deficiency_window_days` (Q2).

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
New: Date-range filter on `slb_TargetDate`; "Deficiency" preset chip rendering entities in window by state; contextual "Spawn Chain" row action calling `WebAppLibrary_spawnContentChain`. Window length from new config key `system.content.deficiency_window_days` (default 56); always include overdue not-yet-`published` rows.

**Step 4 — Family section in entity drawer** — Cost: B (Adapt)
Anchor: `LibraryView.html` `renderEntityDrawer()`; entity list already loaded client-side with `slb_References`
New: Build reverse-reference map (`Map<slug, Set<referencing slugs>>`) post-load; Family section HTML grouped by type (siblings / companions / images) with state pills and tap-to-open links.

**Step 5 — TaskPacks convergence on manager dashboard** — Cost: B/C (Adapt/Build)
Anchor: `ManagerDashboardView_v2.html` bespoke editor lines ~597–677 (~80 lines to retire); `TaskPacks.html` `configure()` + `packBody()`; `WebAppDashboardV2_updateManagerTask` (write path preserved); `taskOpenTarget()` (survives, render above pack output)
New: Provide `getTask`/`getEntity` callbacks (dashboard already reads SysLibrary at `WebAppDashboardV2.js:804`); render `TaskPacks` in the expand slot; **retire** `task.fileUrl` + `resolveContentFileUrl` (doc links come from the entity via the pack's `getEntity`) and drop the `taskOpenTarget` content case; keep `revertTaskToAdmin()` as a dedicated role-transfer button; **preserve the contact context block + a status-transition control** (the two verified coverage gaps) before deleting the bespoke editor.

**Step 6 — Controlled `slb_State` vocabulary** — Cost: A (Reuse)
Anchor: `CONTENT_STAGES` config array; `TaskWidgets.statusClass()` (already handles arbitrary lowercase-hyphenated strings)
New: Define and document vocabulary (`draft`, `editing`, `translating`, `in_review`, `published`, `abandoned`) in `DATA_MODEL.md`; wire stage names into `spawnContentChain` task-close state transitions.

**Step 7 — "Request Correction" in entity drawer** — Cost: A (Reuse)
Anchor: `LibraryView.html` admin-gated drawer action buttons; `TaskService.createTask`; `LibraryService.logEntityActivity`; `data-roles="admin"` CSS gate
New: Button visible when `slb_State === 'published'` and user is admin; spawns `task.content.edit` against entity slug; toast confirmation. Same step adds an admin-only **"Abandon"** drawer action setting `slb_State='abandoned'` + `LibraryService.logEntityActivity` (same gate/pattern).

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

## Resolutions (2026-06-14)

The panel's five open questions, resolved with best advice and folded into the decisions/steps above. Three are grounded in verified code or existing locked decisions; two are reversible preferences (flagged).

1. **`abandoned` — explicit, not inferred.** `spawnContentChain` creates all stage tasks up front, so "draft + no open task" is a stall/orphan signal, not abandonment — it can't carry the meaning. Set explicitly via an admin-only "Abandon" drawer action (Decision 6, Step 7). *Reversible: if Abandon proves unused, fall back to surfacing task-less non-`published` entities as stalls in the deficiency preset.*

2. **Deficiency window — rolling forward, config-driven.** Calendar-month boundaries cliff-edge a piece due in two days at the month flip. Use a rolling forward window (default 56 days) plus always-overdue, via `system.content.deficiency_window_days` (Decision 1, Step 3). *Reversible preference: default is tunable in config without code.*

3. **Manager pack coverage — verified; two prerequisites, no blocker.** The dashboard runs **no packs today** (one generic inline editor + deep-links + a contact context block). Repointing onto `TaskPacks` upgrades content/confirmation/deep-link/skeleton types. Two things must be preserved or it regresses: the **contact context block** (name/email/phone/lang preview) and a **status-transition control** (mark `In Progress` without closing). Folded into Decision 3 + Step 5 as prerequisites.

4. **`fileUrl` — retire it, don't relocate it.** `TaskPacks` already sources doc links from the entity via `getEntity` (`TaskPacks.html:102`); `task.fileUrl` + `resolveContentFileUrl` are bespoke-editor artifacts. On convergence the dashboard supplies `getEntity` and both retire. Single source = the entity's `slb_DocUrl`; no `_getQueueTasks` change, no adapter, no drift (Decision 3 + Step 5). Cleaner than either option posed.

5. **Sibling pairing — computed, no new column.** CONTENT_LIBRARY_PLAN §5/§12 already mandate the slug-pair lookup (siblings differ only by an immutable, language-last suffix), not a row field. Pair by stripping the language suffix; no `slb_SiblingSlug` (Decision 2). A diverging slug is a convention violation to fix at source.

---

## Review (2026-06-14)

Review of 79556c2 resolutions against the panel record and the brief's constraints: all five resolutions are sound. Q1 and Q3 are grounded in code reality (`spawnContentChain` creates tasks up front; dashboard pack-coverage gaps verified at specific line numbers). Q4 is a genuine improvement over the original plan — `TaskPacks.html:102` already sources doc links via `getEntity`, making `task.fileUrl` an artifact of the bespoke editor rather than a shape gap to bridge; the original "client-side adapter" proposal was unnecessary. Q2 and Q5 are reversible preferences, both defensible. No new primitives were introduced, no locked decision was reversed, and no brief constraint was violated.
