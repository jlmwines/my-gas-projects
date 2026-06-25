# Content Workflow Redesign — Dispatch Brief

A charter for a multi-agent design session. The content library/task subsystem is built and live but **barely used in the real world**, and the admin/manager surfaces have drifted from the original single-surface, role-gated intent. This brief hands a panel of expert agents the goal, the validated current state, the hard constraints, and the open decisions — and asks them to debate it out and produce one redesign plan.

**Output of the session:** a new `jlmops/plans/CONTENT_WORKFLOW_REDESIGN_PLAN.md` — a synthesized plan of record (surface map + sequenced, code-anchored build + locked decisions + remaining open questions). This brief is the input; do not edit it during the session.

---

## The goal

Redesign the content workflow so it fits how the work is actually done, on top of the entity/task/activity model that already exists. Concretely, the plan must:

1. Make the **editorial calendar the front-of-funnel demand driver** — the admin opens it, sees pipeline deficiencies, and spawns the work to fill them.
2. Give the admin a **top-down view of a piece and its companions** (a blog post together with its newsletter mention, email, images, translations) — the overview the entity-only model currently can't render.
3. **Collapse the admin/manager task-working divergence into one role-gated component** — honoring the original "design packs + containers so roles do the work" intent.
4. Define **revert / re-edit after close** — the real-world case of fixing a typo on an already-published, version-locked piece.

…without rewriting the sound entity/task/activity substrate or the working sync/CRM/bundle/dashboard code.

---

## Validated current state (ground truth — verified 2026-06-14)

**The model is sound and is not the problem.** Three primitives: **entities** (things with state + history, in `SysLibrary`), **tasks** (work units, attached polymorphically to entities via `(st_EntityType, st_EntityId)`), **activity logs** (`SysLibraryActivity`). Workflows are wiring, not a fourth primitive. This substrate maps cleanly to draft→edit→translate→images→publish and the version-lock lifecycle.

**Three admin surfaces exist, and they drifted into two task code paths:**

- **AdminTasksView** — the unified task workbench, live in admin nav after Dashboard. Left task table + right MANAGE form + a DO region that renders the shared **TaskPacks**. This is where admin administers tasks (due/priority/assignee/status).
- **LibraryView** — entity catalog (Library/Blog/Campaigns/Templates/Images presets) + an entity drawer (files, refs in/out, state history, activity log, attached tasks). **Content-chain creation lives only here**, in the drawer's "Create Content Tasks" button (`spawnContentChain`).
- **AdminProjectsView** — demoted to the bottom of the nav as a soak fallback; still carries the legacy content-stream creation.
- **ManagerDashboardView_v2** — the manager's daily surface. It works tasks through its **own bespoke inline editor + per-type "Open in <view>" deep-links — NOT the shared TaskPacks.**

**How the two paths happened (drift, not design):** the original plan (CONTENT_LIBRARY_PLAN §9, LIBRARY_VIEW_PLAN) intended ONE role-conditional surface, packs as the shared working component, gated by the `data-roles` CSS attribute. Then "additive, don't disturb the manager's daily dashboard" kept the manager on the old dashboard code "until packs are ready" (that never closed); then admin needed real task administration that LibraryView's notes-only tab lacked, so AdminTasksView was built as a third surface. Net: admin on packs, manager on bespoke inline code, Library as catalog in between. A written-but-unbuilt "Manager ↔ Admin convergence" section (ADMIN_TASK_UI_PLAN.md, 2026-06-02) already proposes repointing the dashboard onto TaskPacks — it was never built.

**Build assets that already exist (anchor the design to these — do not rebuild):**
- `TaskPacks` — shared include; `configure({getTask, getEntity, refresh, reload})`; already drives AdminTasksView + LibraryView. Pack archetypes: Outreach, Content edit (file-link + create/attach Doc + lock), Content publish (mark published + URL), Confirmation, deep-link (order packing / inventory count), generic skeleton.
- `WebAppLibrary._getQueueTasks` — already normalizes SysTasks into ONE row shape (id, typeId, topic, entityType/Id, assignedTo, projectId, status, priority, notes, packForm, dates). The "central integration" is already done.
- `WebAppLibrary_spawnContentChain` — creates `blog-<topic>-en`/`-he` entity stubs + one task per chain stage from the `CONTENT_STAGES` array; idempotent via slug uniqueness.
- `data-roles="admin|manager"` body-class CSS gate — the role mechanism is built and in use.
- LibraryView drawer → task **return leg is live** (`openAttachedTask` sets `selectTaskId` + navigates) — note: ADMIN_TASK_UI_PLAN follow-up #4 calls this "not done"; it shipped. The plan is stale there.

**Known-open friction (verified in live code):**
- AdminTasksView's "+ Content" spawner button is `display:none` AND still wired to the **legacy** `WebAppProjects_createContentStream`, not `spawnContentChain`. So the only working content-creation door is the LibraryView drawer.
- Notes is rendered twice in AdminTasksView's detail (MANAGE form + DO pack).
- No in-app editorial calendar. Per CONTENT_LIBRARY_PLAN §15 the calendar deliberately stays markdown (`content/PUBLICATION_CALENDAR.md`).
- No top-down/family roll-up view; the drawer shows one entity's refs only.

---

## The target workflow (from the product owner, 2026-06-14)

1. **Editorial calendar drives.** Says what must publish when — blog post plus companion newsletter / email / etc.
2. **Admin reads the calendar as a deficiency view** — sees gaps to keep the pipeline full, spawns work to fill them.
3. **EN draft** generated by the owner + a Claude session, from inputs traded between admin and manager.
4. **Handoff to manager:** edit the EN.
5. **Manager → translate → back to admin** to continue processing.
6. **Handoff to Claude sessions:** update the blog post + generate the companion outputs.
7. **Status tracked the whole way.**

Plus three explicitly named real-world needs: a **top-down/project-style overview**, **revert-or-re-edit after close** (typo found post-publish), and "more real-world stuff to walk through" — the panel should enumerate and pressure-test additional edge cases (e.g. a translation that lags its EN sibling, a companion email that must wait on the post URL, an abandoned draft, a calendar slip).

---

## Hard constraints (the panel must respect these; challenge only with explicit justification)

- **Three primitives only; workflows are wiring.** Do not add a fourth container casually. If the top-down overview implies a project/issue container, justify it as a *renderer over references* or argue explicitly for promoting a first-class entity type — and reconcile with the deliberate "no fourth container" stance.
- **Don't rewrite working code.** Sync (12-state machine), CRM, bundles, and the manager's daily dashboard ops must keep working; convergence repoints, it doesn't rip out.
- **Version model:** task close = version lock; new task = new version; one slug = one current version; no intra-version history (recovery rides external history — Drive ~30d, git, Canva). Any "revert" proposal states whether it stays roll-forward-only or introduces real versioned recovery, and why.
- **Two write paths:** UI writes via `LibraryService.*` (validates, writes entity row + activity log, fires workflow); session-time registration writes directly to `SysLibrary` via the Sheets API (`content/register-library.js`), never the activity log, never a state transition.
- **Admin initiates, manager executes.** Admin creates/spawns; manager works the queue. Role split via the `data-roles` CSS gate — no new role plumbing; server-side endpoint hardening stays out of scope (managers use the UI; not a script-execution threat).
- **Publishing stays external.** Blog via `content/push-posts.js`; Mailchimp / social / WhatsApp / video manual. "Publish" tasks close as confirmations recording the external URL.
- **GAS reality:** no `/dev` test loop (deploy = the test); load-once + client-side filter/sort; any sheet Claude must read via Drive MCP must be a separate single-tab workbook. `SetupConfig.js` is generated from `config/*.json` — no runtime config writes.
- **Manager is mobile-first; admin is desktop-first.** One component, role-gated, must work in both densities.
- **Scale:** build for ~14 live pieces now; bake the data model for hundreds. No rewrites for cleanliness alone.

---

## Open decisions the panel must force answers on

1. **Calendar:** in-app surface, markdown-driven import, or hybrid? Is a calendar slot / issue a first-class entity, or a computed demand view over existing entities + dates?
2. **Top-down overview:** restore a project/campaign/issue *container* view, or render a family roll-up from `references[]`? If a container — how does it coexist with "no fourth container"?
3. **Task surface convergence:** confirm "repoint the dashboard onto TaskPacks → one role-gated working component," or argue a better collapse. What happens to AdminTasksView, LibraryView's Tasks tab, and AdminProjectsView in the end state?
4. **Creation locus:** where does the admin spawn content — the calendar/deficiency view, the Tasks view, the Library drawer, or several? Pick one primary.
5. **Revert/re-edit after close:** is roll-forward-only (spawn a corrective edit task = new version) sufficient? What is the UI affordance to drop a one-off corrective task on an already-closed entity? Does "revert" need defining beyond roll-forward?
6. **Handoff visibility:** how does status (steps 4-7) read at a glance so a handoff doesn't stall silently?

---

## Expert panel (lenses to staff)

Each agent argues from its lens and defends the tension named. Staff one agent per area; the synthesizer is separate.

1. **Editorial-Ops Workflow Designer** — models the real day-to-day choreography (calendar → deficiency → spawn → draft → edit → translate → outputs → publish) and the admin↔manager↔Claude-session handoffs. *Defends:* the surface must match how the humans actually work, not how the data is shaped. Champions the calendar-as-driver and handoff visibility.

2. **Information Architect (surfaces & navigation)** — owns how many surfaces exist, the nav map, where the top-down overview lives, and how calendar/demand, entity catalog, task queue, and any family/project view relate. *Defends:* legibility and a coherent end-state surface map. Argues the case for or against a restored top-down view.

3. **Role & Interaction Designer (mobile-first UX)** — owns the single-surface, role-gated experience; manager-on-phone vs admin-on-desktop; collapsing the two task code paths into one packs-based component. *Defends:* one working component, role-gated, with manager parity. Champions the convergence.

4. **Entity / Data-Model Architect** — owns entities, references, version-lock, revert semantics, whether calendar/issue or project needs to be a first-class entity, KPI columns. *Defends:* integrity of the three-primitive model. Argues whether the new needs are model extensions or just renderers over existing data.

5. **GAS Build-Pragmatist (implementation realist)** — owns cost and what already exists (TaskPacks, the normalized `_getQueueTasks` feed, `spawnContentChain`, the `data-roles` gate, the dashboard inline editor), plus GAS constraints. *Defends:* buildability. Kills designs that ignore shipped infrastructure or under-estimate (the prior workflow over-estimated cost — anchor every "build" claim to verified code).

6. **Synthesizer / Lead** *(final, after debate + critique)* — reconciles the panel into one plan of record: locked decisions, the surface map, a sequenced code-anchored build, and the residual open questions.

---

## Process — debate, then converge

1. **Round 1 — independent proposals.** Each lens drafts its answer to the six open decisions and a sketch of the end-state surfaces. No coordination.
2. **Round 2 — cross-critique (adversarial).** Each proposal is attacked by the others; every "this won't work / won't build / breaks an invariant" must cite the specific constraint or code asset. (Precedent: prior red-team rounds each caught a real issue — budget for it.)
3. **Round 3 — converge.** Reconcile into a single direction; surface the genuine disagreements that remain rather than papering them.
4. **Synthesis.** The Lead writes `CONTENT_WORKFLOW_REDESIGN_PLAN.md`: goal, locked decisions (with the dissent noted), the surface map, the sequenced build (each step anchored to an existing file/function or flagged as genuinely new), and the open questions left for the product owner.

The panel should disagree productively on the two juiciest tensions: **does the workflow want a top-down container back** (and how does that reconcile with the entity-only model), and **does the calendar belong in the app**. Don't resolve those by fiat — argue them.

---

## Reference docs (read before proposing)

- `plans/CONTENT_LIBRARY_PLAN.md` — the model, §15 foundational principles, open phases.
- `jlmops/plans/LIBRARY_VIEW_PLAN.md` — the shipped LibraryView surface + packs.
- `jlmops/plans/ADMIN_TASK_UI_PLAN.md` — the unified workbench + the unbuilt convergence section + open follow-ups (note #4 is stale; the return leg shipped).
- `jlmops/docs/DATA_MODEL.md` — `SysLibrary` / `SysLibraryActivity` / SysTasks polymorphic columns / slug convention (graduated facts).
- `jlmops/docs/WORKFLOWS.md` — SysTasks date semantics, `flow_pattern` / `due_pattern`.
- `content/PUBLICATION_CALENDAR.md` — the current markdown editorial calendar.
- Live surfaces: `LibraryView.html`, `AdminTasksView.html`, `WebAppLibrary.js`, `LibraryService.js`, `TaskWidgets.html` (TaskPacks), `ManagerDashboardView_v2.html`.
