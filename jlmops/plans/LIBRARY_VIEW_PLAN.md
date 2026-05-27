# Library View Plan

**Created:** 2026-05-25
**Status:** PARTIAL IMPLEMENTATION — phase 5 of `plans/CONTENT_LIBRARY_PLAN.md`. Steps 1, 2, 3, 6 shipped (LibraryView scaffold + Outreach / Confirmation / deep-link packs). Phase 7a shipped 2026-05-26 (LibraryService.addEntity + spawnContentChain + LibraryView "Create Content Tasks" admin button + modal). Steps 4 + 5 (Content edit + Content publish packs) land with CONTENT_LIBRARY_PLAN phase 7b alongside `createBlankDoc` / `attachExistingDoc` / `lockVersion` / `logEntityActivity`.

**Editing discipline:** when a decision changes, revise the relevant topical section above (Surfaces / Library list view / Common skeleton / etc.) inline. Append to "Decisions banked" only for genuinely cross-cutting principles. Do not accumulate dated blocks — keep the document reading as current truth.
**Scope:** Build `LibraryView` — a single new entity (one HTML file, role-conditional content) that surfaces both the library entity list (preset filters per §11) and the unified task queue (common-skeleton + type-pack + widget-kit per §11). **LibraryView is an additional nav entry alongside the existing Dashboard for both manager and admin** (corrected 2026-05-26 after `@127` shipped a Dashboard route-flip on `library.enabled=true`, user clarified intent at smoke test, `@134` reverted to additive-nav). `ManagerDashboardView_v2` and `AdminDashboardView_v2` continue serving the Dashboard nav link unchanged. The new "Library" nav entry is gated by `library.enabled`. No promotion-time nav-route swap.
**Out of scope:** `AdminDashboardView_v2` stays untouched (the project-centric admin path lives there and collapses in a later phase per 2026-05-25 user direction). `ManagerDashboardView_v2` stays as the manager's daily-use dashboard indefinitely (per 2026-05-26 additive-nav correction). `AdminProjectsView` stays untouched. `lockVersion` + `createBlankDoc` + `attachExistingDoc` + `logEntityActivity` + Content edit + Content publish packs are deferred to phase 7b. Add-new-entity generic form deferred indefinitely per CONTENT_LIBRARY_PLAN §18 2026-05-26 (no current ad-hoc-creation use case). Comparison widget (Comax / Web / ops) deferred to phase 9 detail view. SystemHealthWidget redesign (singleton, not a queue task).

---

## Why a new entity (not a v3 of the dashboard)

Per 2026-05-25 user direction: the v2-suffix pattern was right when v2 evolved v1 of the same surface. This work is different — it adds a library layer the dashboard never had, and the unified task queue is shaped around library entities, not project containers. Naming it `ManagerDashboardView_v3` would carry forward the wrong mental model (an iteration of the manager dashboard) when in fact this is a new surface that lives **alongside** the dashboard. Fresh name, fresh nav entry.

Correction 2026-05-26: an earlier reading of this section ("subsumes the dashboard", "old file retires at promotion") was wrong — user clarified at phase 7a smoke test that LibraryView was always intended as an additional view, not a replacement. `ManagerDashboardView_v2` and `AdminDashboardView_v2` stay as the daily-use dashboards indefinitely; LibraryView coexists.

The parallel-build discipline remains, but the promotion model changes: there is no nav-route swap. LibraryView is reached through its own "Library" nav entry, gated by `library.enabled`. Both dashboards stay serving the Dashboard nav link.

---

## Surfaces

New files:
- `jlmops/LibraryView.html` — the new surface. Role-conditional content (manager queue defaults vs admin queue defaults); same file for both. Hosts a JS `packBody()` dispatcher (one case per packed task type) that renders the slotted body inline, composing `TaskWidgets` atoms.
- `jlmops/WebAppLibrary.js` — controller. Returns the task-row shape compatible with the queue render path; adds library list reads. Reads polymorphic `st_EntityType`/`st_EntityId` from SysTasks (shipped @124), falls back to existing typed FKs when blank.
- `jlmops/TaskWidgets.html` — shared widget-kit include (CSS atoms + JS helpers), used by LibraryView and all packs.

**Pack pattern (corrected 2026-05-26 after cleanup pass).** Early planning envisioned one `jlmops/TaskPack_<Name>.html` per packed task type, included via `<?!= include('TaskPack_…') ?>` HtmlService scriptlets. The @125 implementation went with a simpler JS dispatcher (`packBody(t)` function inside `LibraryView.html`, switching on `t.typeId` and returning an HTML string). @127 added Outreach / Confirmation / deep-link packs the same way. Phase 7b Content edit / Content publish packs follow the same JS-dispatch pattern. The HtmlService include pattern remains available if pack count or per-pack complexity ever justifies the split, but it has not been adopted.

Modified files:
- `jlmops/AppView.html` — adds a flag-conditional "Library" nav entry to **both** admin and manager sidebars (gated by `library.enabled`). Dashboard nav link is unchanged for both roles — it continues to load `AdminDashboardView_v2` / `ManagerDashboardView_v2`. No route flip on `WebApp.js`. ✱ (Earlier draft of this plan described a Dashboard route flip on `library.enabled`; @127 shipped that flip, user clarified at @133 smoke test, @134 reverted.)
- `jlmops/config/taskDefinitions.json` — add `pack_form` field to each task-template row (per-type metadata for pack presentation; values: `inline` / `modal` / `dedicated_view` / `skeleton`).

No edits to existing v2 files. `ManagerDashboardView_v2` and `AdminDashboardView_v2` stay bit-for-bit identical throughout phase 5.

---

## Library list view (per §11)

LibraryView's first surface (loads when no task is open). Read-only in this phase — LibraryService write paths land in phase 7 (LibraryView "Create Content Tasks" modal (extended `contentStreamModal` shape) admin-side + lockVersion / createBlankDoc / attachExistingDoc manager-side). Add-new-entity generic form deferred indefinitely per CONTENT_LIBRARY_PLAN §18 2026-05-26.

**Structure:** one underlying view; preset filters in the side or top region toggle between Library (firehose), Blog posts, Campaigns, Templates, Images. Each preset is a filter chip on the same SysLibrary read, not a separate view file. Driven by the `feedback_cards_over_view_links` principle.

**Columns** (per §11 "Entity list view"):
- Generic on every row: title, type, state, last touched, references count
- Per-type extensions: blog adds version + wp_post_id + derivative count; email adds send_date + recipient_count + KPI stats; news adds issue_number + print_date; image adds kind + index + descriptor; templates add channel
- Sort by last_touched descending default; user can change

**Filter chips** (per §11): state, language, language gap (siblings present?), tag, taxonomy, date range. Plus free-text search on title + slug.

**Read path:** `WebAppLibrary.js` calls `SheetAccessor.getLibrarySheet().getRange()...` — requires the SheetAccessor extension noted in CONTENT_LIBRARY_PLAN §17 phase 4 (~25 lines: `getLibrarySpreadsheet` + `getLibrarySheet` + `clearCache()` update mirroring the existing data/log getters). That extension lands as part of this phase's step 1.

**Forward-pointer:** LibraryService skeleton + admin-side LibraryView "Create Content Tasks" modal (extended `contentStreamModal` shape) + manager-side lockVersion wiring (Content edit pack) land in phase 7 per CONTENT_LIBRARY_PLAN §18 2026-05-26. Add-new-entity generic form deferred indefinitely (no current ad-hoc-creation use case beyond the LibraryView "Create Content Tasks" modal (extended `contentStreamModal` shape)). LibraryView v1 is read-only; entity registration continues through the local node script (`content/register-library.js`) for authoring artifacts; planned content rides LibraryView "Create Content Tasks" modal (extended `contentStreamModal` shape) once phase 7 lands.

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

Corrected 2026-05-26 after `@127` shipped a Dashboard route-flip on `library.enabled=true` and `@134` reverted it. Current routing model is **additive nav, no route flip**:

- `AppView.html`: when `library.enabled === true`, both admin and manager sidebars render an additional "Library" nav entry (gated by a server-side scriptlet `<? if (libraryEnabled) { ?>`). When false, neither sidebar shows the entry.
- Existing Dashboard nav link is unchanged for both roles — it continues to load `AdminDashboardView_v2` for admin and `ManagerDashboardView_v2` for manager. **No route flip on the Dashboard link.**
- `WebApp.js` `doGet` sets `template.libraryEnabled` from `library.enabled` SysConfig; `AppView.html` reads it for both the scriptlet-gated nav entry and the `window.libraryEnabled` JS flag (used by other views if they need to check).
- v2 dashboards stay live indefinitely as the daily-use surface. The `library.enabled` flag now gates only the Library nav entry's visibility, not any dashboard routing.
- `WebAppLibrary.js` is the controller for LibraryView. Row shape stays compatible with the v2 row shape (so the queue's render scaffolding ideas are shared); LibraryView additionally consumes the library list read.

---

## Role gating

LibraryView is one file serving both roles. Admin-only controls (phase 7 onward: LibraryView "Create Content Tasks" modal (extended `contentStreamModal` shape), lock, delete-entity, anything mutating library state from the admin side) must be **rendered conditionally based on active role** — never visible to manager, just as the prior dashboard hid admin-only actions. Add-new-entity generic form is listed as an example throughout the plan; per 2026-05-26 it is deferred indefinitely, but if it ever ships it would be admin-only and follow this same gate.

**Mechanism: reuse the existing AppView body-class CSS gate** (`AppView.html:105-109`). `doGet` already sets `body.role-admin` / `body.role-manager` from `effectiveRole`. Any element with a `data-roles="..."` attribute that does not list the active role is hidden via CSS:

```css
body.role-admin [data-roles]:not([data-roles~="admin"]) { display: none !important; }
body.role-manager [data-roles]:not([data-roles~="manager"]) { display: none !important; }
```

**Convention for LibraryView:**
- Admin-only buttons / sections carry `data-roles="admin"`
- Shared controls carry no `data-roles` attribute (visible to both by default)
- Manager-only controls (if any) carry `data-roles="manager"`
- Same convention applies to pack bodies — an admin-only button inside a pack still gets the attribute, not a separate pack variant

No LibraryView-specific role plumbing needed — no role passed into `WebAppLibrary_getData`, no `template.effectiveRole` on the LibraryView template, no JS role checks. The AppView body class already drives everything via CSS, which is how the prior dashboard's nav gating works today.

Scope: UI-only. Server-side endpoint hardening is intentionally out of scope per the trust model (managers use the UI; not a script-execution threat).

---

## Build order — multi-session

1. **Skeleton + queue mechanics + widget-kit atoms + SheetAccessor extension.** Build LibraryView with the generic-skeleton fallback only — every task type renders the same body (description + notes + close). No packs yet. The 25-line SheetAccessor extension lands here so the library list view can read SysLibrary. Validate routing, flag, queue filter/sort/search, and library list view end-to-end against real data. (~1 session.)
2. **Outreach pack** — wire `ManagerContactView` into the dedicated-view slot. Smallest delta because the view already exists; integration only. (~½ session.)
3. **Confirmation pack** — covers the four sync-cycle confirmations + daily session. (~½ session.)
4. **Content edit pack** — file link + lock; covers 7 content task types per the Type packs table above (`edit`, `translate`, `translate_edit`, `images`, `print_newsletter_body`, `draft`, `video_create`). (~1 session.)
5. **Content publish pack** — Confirmation-pack variant (notes + Mark Published + optional external URL); covers 5 publish task types (`blog_publish`, `video_publish`, `email`, `social`, `whatsapp`). (~1 session.)
6. **Deep-link packs** (Order packing, Inventory count) — link-out only, no new affordances. (~½ session.)
7. **Soak** — LibraryView live as an additional nav entry, daily testing by admin (manager's daily UI stays on `ManagerDashboardView_v2` per 2026-05-26 user direction). Bugs filed, pack polish only — no schema or controller-shape changes during soak.
8. **(No promotion step.)** Library is permanently an additional view; there is no nav-route swap and no v2 deprecation. Phase 8+ work refines LibraryView's surface; the dashboards stay.

---

## Soak + extended-use path

Corrected 2026-05-26: there is no "promotion" event because Library is additive, not a replacement.

- LibraryView reachable via the "Library" nav entry on both admin and manager sidebars when `library.enabled = true`
- Admin tests via the admin Library nav; manager's daily UI is still `ManagerDashboardView_v2` (the Manager Library nav entry exists for testing the manager-side packs but the manager works the Dashboard for actual ops until packs are ready for daily use)
- Issues filed in `.claude/bugs.md`; pack polish only — no schema or controller-shape changes during soak
- v2 dashboards are permanent. Library is the additional surface where library-era affordances (entity list, library-aware task packs) live.
- Reversible at any point by flipping `library.enabled = false` — Library nav entry disappears, no other UI changes

---

## Risk + rollback

- All changes additive — no v2 file edited
- Rollback at any step: flip `library.enabled` to false, LibraryView nav hides, v2 serves daily ops
- Git tag `pre-libraryview` at the commit before phase 5 step 1 (mirrors the `pre-library-v0` tag from phase 2)
- If LibraryView controller diverges from v2 in any meaningful behavior (e.g. a write path), back out to v2 before adding the divergence — divergence isn't an invariant of phase 5
- `library.enabled` is itself the contract: anything gated by it must short-circuit cleanly when off

---

## Decisions banked

- **LibraryView is a new entity, not a v3 of the dashboard** — 2026-05-25 user direction. The v2-suffix pattern was right when v2 evolved v1 of the same surface; this work adds a library layer the dashboard never had and the unified task queue is shaped around library entities. Fresh name, fresh nav entry. Old dashboards stay (corrected 2026-05-26 after @127 / @134 ship-and-revert) — Library is permanently additive, not a replacement.
- **Single `LibraryView.html` for both manager and admin** — 2026-05-25 user direction. Role-conditional content within one file; no Manager + Admin counterparts. Aligns with the `feedback_cards_over_view_links` principle.
- **AdminDashboardView_v2 stays untouched** — the project-centric admin path lives there; collapses in a later phase alongside `AdminProjectsView`.
- **Six packs cover daily work; everything else falls to the generic skeleton in v1** — driven by actual task-template enumeration of `taskDefinitions.json`. Validation / bundle / chain tasks stay on skeleton until daily friction earns them a pack.
- **`pack_form` lives in `taskDefinitions.json`** — joins existing per-task-template metadata (topic, default_priority, flow_pattern, due_pattern). No new config file.
- **Library list view is read-only in v1** — LibraryService skeleton + LibraryView "Create Content Tasks" modal (extended `contentStreamModal` shape) (admin-side) land in phase 7 (CONTENT_LIBRARY_PLAN §17). Add-new-entity generic form deferred indefinitely per CONTENT_LIBRARY_PLAN §18 (no current ad-hoc use case beyond per-chain buttons).
- **SheetAccessor library-routing extension lands in step 1** — was deferred per CONTENT_LIBRARY_PLAN §17 phase 4 sub-list to "when ops first needs to read SysLibrary"; that need arrives here.
- **No SysTasks schema changes in phase 5** — polymorphic columns already shipped @124; LibraryView reads them, doesn't write yet (writers come in phase 7).
- **Parallel build, not in-place refactor** — per CONTENT_LIBRARY_PLAN §17 phase 5 + §18 (2026-05-25). Risk profile collapses to additive.
- **No comparison widget in v1 widget kit** — defer to phase 9 detail view per §11 drawer-vs-pack boundary.
- **One `task.content.translate` task type; direction is always EN→HE.** No direction-baked variants. §11's `task.content.translate_he` is a friendly documentation label, not a separate type. The Content edit pack handles every translate instance the same way regardless of which entity it attaches to. Confirmed 2026-05-25.
- **Every task template declares its `pack_form` explicitly.** All ~80 rows in `taskDefinitions.json` get the new field — the 26 packed types declare their pack name; the rest declare `skeleton`. No inheritance-by-absence; configuration is exhaustive. Consumer code reads the field directly; missing/undefined is a config error, not a default-to-skeleton fallback. Confirmed 2026-05-25.
- **Role gating reuses the AppView body-class CSS gate.** Admin-only controls in LibraryView (phase 7 onward: Add-new-entity, lock, publish, delete-entity) carry `data-roles="admin"`; no LibraryView-specific role plumbing. Server-side endpoint hardening is intentionally out of scope per the trust model (managers use the UI; not a script-execution threat). Confirmed 2026-05-26.
- **Phase 7 (CONTENT_LIBRARY_PLAN §17) lands LibraryView's manager-side and admin-side write paths together.** Admin side shipped phase 7a (2026-05-26): LibraryView "Create Content Tasks" button + modal-overlay copied from `contentStreamModal` (`AdminProjectsView.html:565`); submits to `LibraryService.spawnContentChain` (forked from `WebAppProjects_createContentStream` so AdminProjectsView's surface continues unchanged); the spawner creates SysLibrary row(s) via `LibraryService.addEntity` and writes the polymorphic `st_EntityType`/`st_EntityId` columns via the new `TaskService.createTask` options. Manager side ships phase 7b: `lockVersion` + `createBlankDoc` + `attachExistingDoc` + `logEntityActivity` wired into Content edit + Content publish packs. **No `chains.json`, no `chain_id` field on task definitions** — chain stages come from the existing `CONTENT_STAGES` array (extended phase 7a with `target_sibling` + two new chain-pickable stages). Phase 5 step 5 (Content publish pack) reduces to a Confirmation-pack variant (notes + Mark Published button; logs to entity activity); no publish-action method needed since blog publish stays session-side via `content/push-posts.js` and Mailchimp / social / WhatsApp / video are manual. Document attachment on edit/translate tasks is on-demand: Create/Attach buttons fire `createBlankDoc` / `attachExistingDoc` when the task opens. Add-new-entity generic form deferred indefinitely (no current ad-hoc use case). See `plans/CONTENT_LIBRARY_PLAN.md` §17 phase 7 + §18 "Added 2026-05-26" for full rationale. Confirmed 2026-05-26.

---

## Cross-references

- `plans/CONTENT_LIBRARY_PLAN.md` §11 (UI shape — library list + task queue), §17 phase 5 + safety preamble, §18 (banked decisions)
- `jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md` (shape precedent for this doc; just-shipped pattern)
- `jlmops/CLAUDE.md` (UI conventions — modal-overlay only, button-class grep rule, copy existing patterns exactly)
- `jlmops/ManagerDashboardView_v2.html` (skeleton precedent — already halfway to the type-pack model per §11; stays as the manager's daily-use dashboard indefinitely per 2026-05-26 additive-nav correction; LibraryView coexists)
- `jlmops/ManagerContactView.html` (dedicated-view precedent; Outreach pack adopts as-is)
- `jlmops/AdminCampaignsView.html` (controller envelope shape — `{error, data}` pattern reused by `WebAppLibrary.js`)
- `jlmops/config/taskDefinitions.json` (~80 templates; basis for the pack enumeration and `pack_form` field addition)
