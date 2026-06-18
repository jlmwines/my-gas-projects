# Content Workflow Redesign Plan

This plan defines the end-state workflow for JLM Wines content operations — who does what, on which surface, in what sequence — as of 2026-06-14. It is the output of a five-lens adversarial design panel; the panel's open questions were resolved 2026-06-14 against verified code (see Resolutions). **All four deploys shipped 2026-06-14–15 (jlmops @290 → @295); ready to archive once its durable facts graduate to the system docs.**

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

**Locked:** Roll-forward-only. Closed/published entities get an admin-only **"Request Correction"** button in the entity drawer (gated by `data-roles="admin"`). It spawns `task.content.edit` against the same entity slug via `TaskService.createTask` + `LibraryService.logEntityActivity`. Entity stays `published` while the corrective task is open; task close bumps `slb_Version` to N+1 via `LibraryService.lockVersion`. **(Superseded 2026-06-18 → Decision 7: `slb_Version` and the lock step retire; versioning becomes file-based — newest-timestamp file is authoritative, Ops stamps + archives the predecessor.)** Content recovery uses Drive (~30d) / git — no in-app revert. "Revert" needs no separate definition: it is a corrective edit whose content happens to match a prior state.

### Decision 6: Handoff visibility

**Locked:** Three layers, all client-side over data already loaded:

1. **Entity list row** — state pill via `TaskWidgets.statusClass` (already dynamic; free-form `slb_State` strings render as pills with no schema change). Controlled vocabulary (reconciled to the live model 2026-06-14): `draft` → `locked` → `published`, plus terminal `abandoned`. **(Decision 7, 2026-06-18, collapses this to `draft` → `published` + `abandoned`: the `locked` middle state retires with the lock step.)** The granular `editing`/`translating`/`in_review` states from early drafts were never wired and are dropped — attached-task states + the deficiency stall signal carry progress. Documented in `docs/DATA_MODEL.md` (`slb_State`).
2. **Overdue chip** — open task's `dueDate` past today → red chip in drawer Tasks tab (already partially wired).
3. **Deficiency preset blank** — entity with `slb_TargetDate` in window and no open task shows a blank task-column row; that is the stall signal.

`abandoned` is set **explicitly** via an admin-only **"Abandon"** drawer action (mirrors "Request Correction", `data-roles="admin"`), never inferred from the absence of tasks: `spawnContentChain` creates all stage tasks up front, so a non-`published` entity with no open task is a **stall/orphan** signal, not abandonment. The deficiency preset filters `abandoned` out.

Deferred: "in handoff" badge (open task assigned to counterpart role). Implement only if richer state vocabulary proves insufficient.

### Decision 7: Versioning model — file-based, library-blind (supersedes the lock/version mechanics in Decisions 5–6)

**Decided 2026-06-18. Not yet built — implementation slice flagged at the end.**

The library's only versioning job is to name the single authoritative file per slug. It does not track versions. The earlier lock/version machinery retires: `slb_Version` is inert (set at create, bumped at lock, only ever *displayed* — no logic branches on it), and the "lock" step's sole real work was closing the task. Both read as version control the system doesn't actually provide.

**Authoritative resolution.** `SysLibrary` holds **one row per slug** — the clean face that never shows versions. Version multiplicity lives only in Drive (a fork just created a new file). Files are named **`<slug> yy-mm-dd-hh-mm`** (e.g. `blog-region-negev-en 26-06-18-12-30`); **current = the slug's file with the maximum timestamp suffix** — big-endian and zero-padded, so newest-wins is a plain lexical string-max, no date parsing. Match files by exact **slug + space** to avoid prefix collisions (`...-negev` vs `...-negev-reds`). Nothing auto-publishes by recency (publishing and its derivatives are deliberate downstream acts), so newest-as-authoritative is safe — the clobber worry is moot.

**Editing paths (preferred — keep confusion out):**
- **Humans edit in place** on the live Doc; Google Docs' own revision history is the within-version trail. The convenient default.
- **Anyone may create a new version via Ops** — a coordinated GAS action: fork from the current file, repoint, stamp + archive the old one, in one transaction.
- **Sessions must fork** (they can read + create, not edit a Doc in place): create a new `<slug> <timestamp>` file **from the current pointer** (never a stale base) and repoint `slb_DocUrl` via the Sheets API.

**Supersede lifecycle (Ops owns it).** When a new version becomes current, Ops stamps the old Doc with **"Superseded by → [link to successor]"** at the top and moves it to the library archive — a single flat **`_archive`** subfolder under `system.folder.library` — returning the active library folders to one file per slug. Retrieval is name-based (every file carries its `<slug> yy-mm-dd-hh-mm` name), so the archive is flat: no `<type>/<concept>` mirroring, no calendar grouping. Ops/GAS can edit a Doc body in place and move files — a session cannot — so Ops is the right actor. Breadcrumb: the repoint hands Ops the prior file id to process (or housekeeping detects the multiplicity).

**Not `JLMops_Archive`.** The top-level `system.folder.archive` is the sync pipeline's processed-file archive and carries a **destructive 365-day sweep** (`HousekeepingService.manageFileLifecycle` trashes files older than `ARCHIVE_FOLDER_RETENTION_DAYS = 365`), which would silently delete version history. The library tree has no such sweep — its only housekeeping is the read-only orphan-integrity report — so superseded content lives under `system.folder.library`, never in `system.folder.archive`.

**Housekeeping backstop.** If multiple slug-bearing files sit in an active library folder, newest wins and the rest are demoted (stamp + move to `_archive`). Insurance for the cases that skip the clean paths (a raw Sheets-API fork, a stray duplicate), not the normal workflow.

**No new fields.** No predecessor column — the forward "superseded by" links plus timestamp order already give the chain, and the current file is the one with no successor. No explicit current-flag — current is computed as newest. No version counter — `slb_Version` retired. The registry needs only slug + `slb_DocUrl` + timestamp.

**Primary action:** Open-Doc-from-the-task (Decision 3 / Step 9) is the main interaction; it always follows the pointer to whatever is current, so no one edits a superseded copy by accident.

**Scope: documents only.** Templates keep the stricter lock/version handling — they feed live runtime sends (pending-payment email, outreach), so an uncontrolled edit has immediate blast radius.

**Implementation slice (not built):**
1. Strip the version number + lock affordance from the content-task UI; make Open-Doc primary.
2. Adopt `<slug> yy-mm-dd-hh-mm` naming + newest-wins resolution in the session fork path and in `LibraryService` lookups.
3. Add the "Superseded by →" stamp + move to a single flat **`_archive`** subfolder under the existing `system.folder.library` (auto-minted on demand via the library service's existing `_getOrCreateChildFolder` helper — `LibraryService.js:391`), driven off the repoint breadcrumb. **No new top-level folder or SysConfig key** — `system.folder.library` already exists; the `_archive` underscore prefix avoids colliding with content `<type>` folders. **Do not use `system.folder.archive` / `JLMops_Archive`** — its 365-day trash sweep would delete history (see "Not `JLMops_Archive`" above). Also: exclude the `_archive` subfolder from `HousekeepingService.runLibraryIntegrityReport`'s orphan-files walk (`HousekeepingService.js:1341`) — archived files are named `<slug> <timestamp>`, so they won't match a bare `slb_Slug` and would otherwise be flagged as orphans.
4. Collapse `slb_State` to `draft → published` (+ terminal `abandoned`); retire `slb_Version` and `lockVersion`'s version bump.

---

## End-state Surface Map

| Surface | Roles | Job |
|---|---|---|
| **Dashboard** | Both | Daily ops: sync widget (admin), manager task queue via TaskPacks, ops cards |
| **Library** | Both | Entity catalog; deficiency preset; family drawer; admin-only: spawn chain, Request Correction, Abandon. (Lock/publish are task-pack actions in the workbench, not here.) |
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

**Step 5 — TaskPacks convergence on manager dashboard** — Cost: B/C (Adapt/Build) — done 2026-06-15 @295
Anchor: `ManagerDashboardView_v2.html` bespoke editor lines ~597–677 (~80 lines to retire); `TaskPacks.html` `configure()` + `packBody()`; `WebAppDashboardV2_updateManagerTask` (write path preserved); `taskOpenTarget()` (survives, render above pack output)
New: Provide `getTask`/`getEntity` callbacks (dashboard already reads SysLibrary at `WebAppDashboardV2.js:804`); render `TaskPacks` in the expand slot; **retire** `task.fileUrl` + `resolveContentFileUrl` (doc links come from the entity via the pack's `getEntity`) and drop the `taskOpenTarget` content case; keep `revertTaskToAdmin()` as a dedicated role-transfer button; **preserve the contact context block + a status-transition control** (the two verified coverage gaps) before deleting the bespoke editor.

**Step 6 — Controlled `slb_State` vocabulary** — Cost: A (Reuse) — Option A, done 2026-06-14
Anchor: `LibraryService` state writers (`addEntity`→`draft`, `lockVersion`→`locked`, `abandonEntity`→`abandoned`); `TaskPacks.markPublished`; `TaskWidgets.statusClass()`.
Done: documented the **live** vocabulary in `docs/DATA_MODEL.md` (`draft → locked → published` + terminal `abandoned`; the early-draft `editing`/`translating`/`in_review` were never wired → dropped, not imposed). Wired the one real gap: in-app publish-task close now transitions the entity to `published` via new `LibraryService.markPublished` + `WebAppLibrary_markPublished` (replacing the URL-only activity log in `TaskPacks.markPublished`).

**Step 7 — "Request Correction" in entity drawer** — Cost: A (Reuse)
Anchor: `LibraryView.html` admin-gated drawer action buttons; `TaskService.createTask`; `LibraryService.logEntityActivity`; `data-roles="admin"` CSS gate
New: Button visible when `slb_State === 'published'` and user is admin; spawns `task.content.edit` against entity slug; toast confirmation. Same step adds an admin-only **"Abandon"** drawer action setting `slb_State='abandoned'` + `LibraryService.logEntityActivity` (same gate/pattern).

**Step 8 — De-dup Notes in AdminTasksView** — Cost: B (Adapt) — **rides with Deploy 3** — done 2026-06-15 @295
Anchor: `AdminTasksView.html:337–338` (MANAGE form Notes, saved by `saveTaskStatus` :2233); `TaskPacks.html` pack Notes (`tw-notes`) — ADMIN_TASK_UI_PLAN follow-up #2
Trace (2026-06-14): can't simply drop the MANAGE Notes — the **skeleton** pack's Notes is readonly (`TaskPacks.html:172`), so for skeleton-type tasks the MANAGE field is the only editable Notes; removing it regresses them. Clean de-dup = give `TaskPacks` a `ctx.hideNotes` option so the pack omits its Notes block where a MANAGE Notes already exists (AdminTasksView), keeping the MANAGE field as the single one. Edits the shared pack → batch with Deploy 3's pack rework, not Deploy 1.

**Step 9 — Direct Doc access from Library** — Cost: A (Reuse) — **independent of Deploy 3** — done 2026-06-15 @294
Anchor: `LibraryView.html` list Title cell (`renderLibrary`:696, `renderDeficiency`:756); drawer action bar (`renderDrawerActions`:1140, which today deliberately omits an Open-Doc button per its :1145 comment); existing low-prominence "Open Doc" link in `renderDrawerFiles`:1118.
Trace (2026-06-15, UX observation): opening the Doc is the most likely Library action, but the only control is a faint `tw-file-link` buried three sections down the drawer — and it's absent entirely when no Doc is attached. `slb_DocUrl` already rides on the client `state.library` entity (`res.data.library`, :493), so this is **client-only — no server/schema change.** New: a row-level **"↗ Doc"** link in the Title cell of both list presets, rendered only when `e.docUrl` (independent `<a target="_blank">` with `event.stopPropagation()` so it opens the file directly, no drawer hop; the link's absence = "no Doc yet" signal). Plus a prominent **"Open Doc"** button in the drawer action bar gated on `entity.docUrl` — reversing the :1145 no-duplicate decision now that direct-open is the primary path. The Files & URLs "Open Doc" link stays.

---

## Deploy Plan

Three sequenced code deploys (1 → 2 → 3), plus one independent small Library deploy (4). GAS has no `/dev`, so each deploy is the test — smoke each on the deployed surface before starting the next. Deploys 1–2 also carry a config push (`generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`); Deploy 3 is code-only. Live deploy via `deploy.ps1` is a change-point needing explicit OK each time.

**Deploy 1 — schema + creation locus** (Steps 2 → 1). Config: append `slb_TargetDate`. Code: unhide + repoint the "+ Content" button to `spawnContentChain` (entity-type + existing-entity picker + target-date modal). Step 2 leads — Step 1's modal field and Step 3's filter both depend on the column. Admin-only surface; low risk. (Step 8 moved to Deploy 3 — see below.)

**Deploy 2 — demand view + overview + lifecycle** (Steps 3, 4, 6, 7). Config: `system.content.deficiency_window_days`; `slb_State` vocabulary. Code: deficiency preset, family roll-up, state pills, Request Correction + Abandon. Clusters on LibraryView/the drawer; smoke together. Splittable if any piece smokes rough.

**Deploy 3 — manager convergence + Notes de-dup** (Steps 5 + 8) — **[shipped @295, 2026-06-15].** Repoint the dashboard onto TaskPacks; retire the bespoke editor + `task.fileUrl`. Step 8 rides here because its clean fix (a `ctx.hideNotes` pack option) edits the shared `TaskPacks`, which this deploy already reworks — batching avoids touching the pack twice. Isolated otherwise — the only change touching the manager's live daily surface and the riskiest; ship and soak (mirrors ADMIN_TASK_UI's live-touching-change isolation). Never batch with Deploys 1–2, and keep Deploy 4 out of it.

**Deploy 4 — Library direct Doc access** (Step 9) — **[shipped @294, 2026-06-15].** Client-only LibraryView change; `slb_DocUrl` is already on the client list entity, so no config push, no server, no schema. Independent of Deploy 3 — ship before or after it, never inside it (Deploy 3 stays isolated to the manager surface). Low risk; admin/manager Library only.

**Follow-up — LibraryView default tab — [shipped @296, 2026-06-15].** LibraryView now opens to the entity catalog (was the standalone `tasks` tab, redundant once AdminTasksView became the workbench). Flipped the `active` tab/panel markup + `activeTab` default to `library`; admins keep the Tasks tab one click away, managers unchanged. Shipped in Deploy 5 alongside an unrelated AdminTasksView `createTask` double-submit guard (disable+relabel on submit, added the missing failure handler).

**Deploy 6 — remove the Tasks tab from LibraryView — [shipped @297, 2026-06-15].** The Library Tasks tab/panel was a pre-convergence artifact (a co-equal task list) contradicting the surface map. Removed it (tab switcher, tasks panel + filters, `renderTasks`/`toggleTask`/`switchTab`, the `TaskPacks` include + `configure`, dead helpers/CSS). LibraryView is now **catalog-only** for both roles; `state.tasks` still loads (the Deficiency preset's open-task count). The task-list lens lives solely in AdminTasksView (admin) + the dashboard queue (manager).

**Decision — Request Correction stays edit-only (accepted 2026-06-15).** A corrective edit on a published piece lands the entity at `locked` (no publish task spawned), so it drops out of `published` until re-published. Accepted as-is because corrections are rare; revisit (spawn an edit+publish mini-chain) only if it becomes common.

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
