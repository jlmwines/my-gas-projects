# Library View Plan

**Created:** 2026-05-25
**Status:** PLANNING — phase 5 of `plans/CONTENT_LIBRARY_PLAN.md`. No implementation yet. Mandated as precondition by §17 safety preamble.
**Scope:** Build `LibraryView` — a single new entity (one HTML file, role-conditional content) that surfaces both the library entity list (preset filters per §11) and the unified task queue (common-skeleton + type-pack + widget-kit per §11). LibraryView replaces `ManagerDashboardView_v2`; admin can also reach it through nav. Built alongside the existing v2; promotion is a one-line nav-route swap once soaked.
**Out of scope:** `AdminDashboardView_v2` stays untouched (the project-centric admin path lives there and collapses in a later phase per 2026-05-25 user direction). `AdminProjectsView` stays untouched (same later collapse). LibraryService skeleton and the "Add new entity" UI affordance are deferred to phase 7 alongside task-chain spawn (one LibraryService build serves both). Comparison widget (Comax / Web / ops) deferred to phase 9 detail view. SystemHealthWidget redesign (singleton, not a queue task).

---

## Why a new entity (not a v3 of the dashboard)

Per 2026-05-25 user direction: the v2-suffix pattern was right when v2 evolved v1 of the same surface. This work is different — it adds a library layer the dashboard never had, and the unified task queue is shaped around library entities, not project containers. Naming it `ManagerDashboardView_v3` would carry forward the wrong mental model (an iteration of the manager dashboard) when in fact this is a new surface that subsumes the dashboard. Fresh name, fresh start; old file retires at promotion.

The parallel-build discipline remains: LibraryView lives alongside `ManagerDashboardView_v2` throughout phase 5, behind the `library.enabled` flag. v2 stays serving daily ops until LibraryView is ready and soaked. Promotion = one nav-route swap. Reversible.

---

## Surfaces

New files:
- `jlmops/LibraryView.html` — the new surface. Role-conditional content (manager queue defaults vs admin queue defaults); same file for both.
- `jlmops/WebAppLibrary.js` — controller. Returns the task-row shape compatible with the queue render path; adds library list reads. Reads polymorphic `st_EntityType`/`st_EntityId` from SysTasks (shipped @124), falls back to existing typed FKs when blank.
- `jlmops/TaskPack_<Name>.html` — one HTML include per packed task type (six initially, see Type packs below). Included via the existing `<?!= include('TaskPack_…') ?>` HtmlService pattern; each renders the slotted body for one task type, composing widget-kit atoms.
- `jlmops/TaskWidgets.html` — shared widget-kit include, used by LibraryView and all task packs.

Modified files:
- `jlmops/WebApp.js` — route flip on `library.enabled` (SysConfig). When true, the "Tasks" link routes to LibraryView (manager + admin); when false, to v2 (current default for manager) and admin's LibraryView nav entry is hidden. Verified 2026-05-25: `doGet(e)` does not currently read URL params, so the fallback mechanism is the flag itself (not a `?v=` URL hack).
- `jlmops/AppView.html` — sidebar's "Tasks" link target shifts per flag. Adds a flag-conditional admin nav entry for LibraryView (admin reaches it through nav, not by replacing AdminDashboardView_v2).
- `jlmops/config/taskDefinitions.json` — add `pack_form` field to each task-template row (per-type metadata for pack presentation; values: `inline` / `modal` / `dedicated_view` / `skeleton`).

No edits to existing v2 files. `ManagerDashboardView_v2` and `AdminDashboardView_v2` stay bit-for-bit identical throughout phase 5.

---

## Library list view (per §11)

LibraryView's first surface (loads when no task is open). Read-only in this phase — the "Add new entity" affordance and LibraryService write paths land in phase 7 (see forward-pointer below).

**Structure:** one underlying view; preset filters in the side or top region toggle between Library (firehose), Blog posts, Campaigns, Templates, Images. Each preset is a filter chip on the same SysLibrary read, not a separate view file. Driven by the `feedback_cards_over_view_links` principle.

**Columns** (per §11 "Entity list view"):
- Generic on every row: title, type, state, last touched, references count
- Per-type extensions: blog adds version + wp_post_id + derivative count; email adds send_date + recipient_count + KPI stats; news adds issue_number + print_date; image adds kind + index + descriptor; templates add channel
- Sort by last_touched descending default; user can change

**Filter chips** (per §11): state, language, language gap (siblings present?), tag, taxonomy, date range. Plus free-text search on title + slug.

**Read path:** `WebAppLibrary.js` calls `SheetAccessor.getLibrarySheet().getRange()...` — requires the SheetAccessor extension noted in CONTENT_LIBRARY_PLAN §17 phase 4 (~25 lines: `getLibrarySpreadsheet` + `getLibrarySheet` + `clearCache()` update mirroring the existing data/log getters). That extension lands as part of this phase's step 1.

**Forward-pointer:** "Add new entity" action + LibraryService skeleton land in phase 7 (alongside task-chain spawn — one LibraryService build serves both). LibraryView v1 is read-only; entity registration continues through the local node script (`content/register-library.js`) until phase 7 wires the UI.

---

## Common skeleton (task queue)

Per CONTENT_LIBRARY_PLAN §11. Every task row in LibraryView's queue surface renders:
- Title, status pill, due chip, assignee, priority badge (Critical/High colored; Normal/Low neutral)
- Topic chip + entity-type chip (from `st_EntityType` shipped @124)
- Expand toggle (for inline packs) OR overlay-open button (for modal packs) OR view-open link (for dedicated-view packs)
- Notes field + close button at the bottom of every expanded body

Above the queue: filter chips (status, type, topic, assignee, language) + free-text search + sort selector (default: due ascending). Per §11 Residual 2 settlement — drop priority filter (keep as visual badge), drop due-window filter (sort covers it).

Skeleton-only tasks: description + notes + close. Default for any task type whose `pack_form` is `skeleton` (or undefined).

---

## Type packs — necessary set for v1

Enumerated against `jlmops/config/taskDefinitions.json` (~80 templates). Six pack archetypes cover daily work; everything else falls to the generic skeleton in v1 and earns a dedicated pack when surface friction shows up.

| Pack | Task types covered | `pack_form` | Source pattern |
|---|---|---|---|
| **Outreach** | `task.contact.outreach`, `task.crm.contact_followup`, `task.crm.churn_risk`, `task.crm.vip_attention`, `task.crm.coupon_expiring`, `task.crm.suggestion` | `dedicated_view` | `ManagerContactView.html` (shipped 2026-05-14) — adopted as-is; LibraryView routes the click into it |
| **Content edit** | `task.content.edit`, `task.content.translate`, `task.content.translate_edit`, `task.content.images`, `task.content.print_newsletter_body`, `task.content.draft`, `task.content.video_create` | `inline` | New — file-link chip + open-doc button + (for translate) "Create HE doc" button per §11 + lock button + notes; mode discriminator chooses which buttons render per type |
| **Content publish** | `task.content.blog_publish`, `task.content.video_publish`, `task.content.email`, `task.content.social`, `task.content.whatsapp` | `inline` | New — channel-specific action button (WP push / YT push / Mailchimp link / FB-IG-X link / WA link); version-match check on blog publish |
| **Confirmation** | `task.confirmation.comax_order_export`, `task.confirmation.product_count_export`, `task.confirmation.comax_inventory_export`, `task.confirmation.web_inventory_export`, `task.sync.daily_session` | `inline` | New — "Confirm completed" button + notes textarea; closes the task on confirm |
| **Order packing** | `task.order.packing_available` | `inline` (deep-link) | Link out to existing `ManagerOrdersView` packing-slips action; no new affordances |
| **Inventory count** | `task.inventory.count`, `task.inventory.brurya_update` | `inline` (deep-link) | Link out to existing `ManagerInventoryView` count UI; no new affordances |

**Falls to generic skeleton in v1** (`pack_form: skeleton`): all `task.validation.*` (15), all `task.bundle.*` (3), all `task.campaign.*` + `task.newsletter.*` + `task.email.*` + `task.flyer.*` chain task types (~24), `task.onboarding.*` (2), `task.data.*` (2), `task.deficiency.*`, `task.export.*`, `task.system.failure`, `task.project.custom`. Each is a candidate for a future pack when daily friction surfaces.

**Not in the queue at all** (singletons / dashboard-backing): `task.system.health_status`, `task.system.deployment_drift` — keep their existing widgets/views.

---

## Pack-form metadata

Each task template carries a `pack_form` field in `taskDefinitions.json` declaring its presentation form. Values:

- `skeleton` — generic body, no pack (default for any type not explicitly packed)
- `inline` — pack renders inside the expanded row
- `modal` — pack opens in a `modal-overlay` (per `jlmops/CLAUDE.md` UI conventions; no Bootstrap modals)
- `dedicated_view` — pack is a separate view; LibraryView routes the click to it

LibraryView's queue render reads `pack_form` from each task row and chooses the presentation surface accordingly. No new config file; per-task-template metadata lives where the other per-template fields already live (topic, default_priority, flow_pattern, due_pattern).

---

## Shared widget kit (`TaskWidgets.html`)

Atoms reused across packs and the skeleton. Each grepped from existing files first per `jlmops/CLAUDE.md` "copy existing patterns exactly":

- **Status pill** — copy `status-pill` styling from `AdminProjectsView.html`
- **Due chip** — copy due-date display from `ManagerDashboardView_v2.html`
- **Priority badge** — copy from `ManagerDashboardView_v2.html` (Critical/High colored, Normal/Low neutral per §11)
- **File-link chip** — new atom; lean on existing inline link styles (grep `btn` classes in the same file before adding any)
- **Notes textarea + Save row** — copy from `ManagerContactView.html` log-modal body shape
- **Confirm dialog** — `modal-overlay` pattern (`AdminProductsView.html`); never Bootstrap modal
- **Toast / inline-error feedback** — toast pattern from `AdminCampaignsView.html`; inline validation messages render in red below the affected row

Comparison widget (Comax / Web / ops side-by-side per §11) is **deferred to phase 9 detail view** — not in the v1 widget kit.

---

## Routing + flag wiring

- `WebApp.js` `doGet`: when `library.enabled === true`, the manager's "Tasks" link routes to LibraryView; admin also gets a LibraryView nav entry. When false, manager's "Tasks" link continues to point at v2 (current default); admin sees no LibraryView entry.
- v2 stays reachable via the flag flip (set `library.enabled = false`). Verified 2026-05-25: `doGet(e)` does not parse URL params, so no `?v=` URL-hack mechanism exists; the flag is the only fallback control. Removed in a later cleanup phase, not at promotion.
- Sidebar nav doesn't grow a second "Tasks" link for managers — same link, different target per flag. Admin gets one new nav entry for LibraryView (no equivalent existed in admin nav before).
- `WebAppLibrary.js` is the new controller. Row shape stays compatible with the v2 row shape (so any shared render scaffolding works); LibraryView additionally consumes the library list read.

---

## Build order — multi-session

1. **Skeleton + queue mechanics + widget-kit atoms + SheetAccessor extension.** Build LibraryView with the generic-skeleton fallback only — every task type renders the same body (description + notes + close). No packs yet. The 25-line SheetAccessor extension lands here so the library list view can read SysLibrary. Validate routing, flag, queue filter/sort/search, and library list view end-to-end against real data. (~1 session.)
2. **Outreach pack** — wire `ManagerContactView` into the dedicated-view slot. Smallest delta because the view already exists; integration only. (~½ session.)
3. **Confirmation pack** — covers the four sync-cycle confirmations + daily session. (~½ session.)
4. **Content edit pack** — file link + lock; covers 6 content task types. (~1 session.)
5. **Content publish pack** — channel-specific actions; covers 6 publish task types. (~1 session.)
6. **Deep-link packs** (Order packing, Inventory count) — link-out only, no new affordances. (~½ session.)
7. **Soak** — LibraryView live behind flag, daily use by manager + admin for 1–2 weeks. Bugs filed, pack polish only — no schema or controller-shape changes during soak.
8. **Promote** — flag default-on; nav points at LibraryView by default; v2 deprecated at `?v=2`.

---

## Soak + promotion path

- LibraryView reachable during phase 5 via `library.enabled = true` (toggled via SysConfig setter)
- Manager + admin both use LibraryView daily; v2 reachable only by flipping the flag back to false (no URL-param fallback exists per `WebApp.js` 2026-05-25 audit)
- Issues filed in `.claude/bugs.md`; pack polish only — no schema or controller-shape changes during soak
- Promotion: flag default-on; nav-route swap on `WebApp.js`; v2 file stays for one cycle as flag-flip fallback, removed in a later cleanup phase
- Reversible at any point pre-promotion or in early post-promotion by flipping the flag

---

## Risk + rollback

- All changes additive — no v2 file edited
- Rollback at any step: flip `library.enabled` to false, LibraryView nav hides, v2 serves daily ops
- Git tag `pre-libraryview` at the commit before phase 5 step 1 (mirrors the `pre-library-v0` tag from phase 2)
- If LibraryView controller diverges from v2 in any meaningful behavior (e.g. a write path), back out to v2 before adding the divergence — divergence isn't an invariant of phase 5
- `library.enabled` is itself the contract: anything gated by it must short-circuit cleanly when off

---

## Decisions banked

- **LibraryView is a new entity, not a v3 of the dashboard** — 2026-05-25 user direction. The v2-suffix pattern was right when v2 evolved v1 of the same surface; this work adds a library layer the dashboard never had and the unified task queue is shaped around library entities. Fresh name, fresh start; old file retires at promotion.
- **Single `LibraryView.html` for both manager and admin** — 2026-05-25 user direction. Role-conditional content within one file; no Manager + Admin counterparts. Aligns with the `feedback_cards_over_view_links` principle.
- **AdminDashboardView_v2 stays untouched** — the project-centric admin path lives there; collapses in a later phase alongside `AdminProjectsView`.
- **Six packs cover daily work; everything else falls to the generic skeleton in v1** — driven by actual task-template enumeration of `taskDefinitions.json`. Validation / bundle / chain tasks stay on skeleton until daily friction earns them a pack.
- **`pack_form` lives in `taskDefinitions.json`** — joins existing per-task-template metadata (topic, default_priority, flow_pattern, due_pattern). No new config file.
- **Library list view is read-only in v1** — Add-new-entity affordance + LibraryService skeleton land in phase 7 alongside task-chain spawn (one LibraryService build serves both UI write paths).
- **SheetAccessor library-routing extension lands in step 1** — was deferred per CONTENT_LIBRARY_PLAN §17 phase 4 sub-list to "when ops first needs to read SysLibrary"; that need arrives here.
- **No SysTasks schema changes in phase 5** — polymorphic columns already shipped @124; LibraryView reads them, doesn't write yet (writers come in phase 7).
- **Parallel build, not in-place refactor** — per CONTENT_LIBRARY_PLAN §17 phase 5 + §18 (2026-05-25). Risk profile collapses to additive.
- **No comparison widget in v1 widget kit** — defer to phase 9 detail view per §11 drawer-vs-pack boundary.
- **One `task.content.translate` task type; direction is always EN→HE.** No direction-baked variants. §11's `task.content.translate_he` is a friendly documentation label, not a separate type. The Content edit pack handles every translate instance the same way regardless of which entity it attaches to. Confirmed 2026-05-25.
- **Every task template declares its `pack_form` explicitly.** All ~80 rows in `taskDefinitions.json` get the new field — the 26 packed types declare their pack name; the rest declare `skeleton`. No inheritance-by-absence; configuration is exhaustive. Consumer code reads the field directly; missing/undefined is a config error, not a default-to-skeleton fallback. Confirmed 2026-05-25.

---

## Cross-references

- `plans/CONTENT_LIBRARY_PLAN.md` §11 (UI shape — library list + task queue), §17 phase 5 + safety preamble, §18 (banked decisions)
- `jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md` (shape precedent for this doc; just-shipped pattern)
- `jlmops/CLAUDE.md` (UI conventions — modal-overlay only, button-class grep rule, copy existing patterns exactly)
- `jlmops/ManagerDashboardView_v2.html` (skeleton precedent — already halfway to the type-pack model per §11; stays as fallback after LibraryView promotion, removed in a later cleanup phase per Soak section)
- `jlmops/ManagerContactView.html` (dedicated-view precedent; Outreach pack adopts as-is)
- `jlmops/AdminCampaignsView.html` (controller envelope shape — `{error, data}` pattern reused by `WebAppLibrary.js`)
- `jlmops/config/taskDefinitions.json` (~80 templates; basis for the pack enumeration and `pack_form` field addition)
