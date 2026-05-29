# JLMops UI Audit & Path Forward

**Created:** 2026-05-28
**Updated:** 2026-05-28 (v2, post second-round agent review)
**Status:** Draft v2. Three additional agent reviews (UX/frontend critique, code-anchor verification, plan-coherence + execution-risk) folded in. Adds CCP-UI-8 (accessibility & focus management) and CCP-UI-9 (observability & measurement); re-plans T4.3 (warehouse-floor count UX); corrects T2.6 Stage D call-site count; banks line-ref drift discipline; surfaces T5.1/T2.2/T2.6.D file-coupling dependency; pulls T2.5 Stage B's isOverdue semantic change out as its own atomic concern.
**Owner:** Session-driven. User observes and tests; does not co-author.

## 1. Why this exists

JLMops UI works but wide areas fail at appearance/utility/efficiency. The bundles view is the user-named example, but the picture extends across both admin and manager surfaces:

- **Six orphan widgets** routed in `WebApp.js:79-89` (`AdminOrdersWidget`, `ManagerOrdersWidget`, `AdminInventoryWidget`, `ManagerInventoryWidget`, `AdminProductsWidget`, `ManagerProductsWidget`) and one empty stub (`SystemHealthView.html:12`) — dead code from a pre-v2 dashboard architecture.
- **Nav misplacement.** `AppView.html:206` "CRM Tools" label points at `AdminContactsView`, but the actual CRM operational tooling sits in `DevelopmentView.html:21-36`. Two unrelated surfaces share the "CRM Tools" name.
- **Twelve parallel round-trips after every Accept/Submit** in `AdminProductsView.html:726-746` (`refreshView`) — biggest aggregate speed cost in the system.
- **Per-keystroke server round-trips** in `ManagerContactView` search (bug 2026-05-15, `BUG_FIX_SEQUENCE.md` Session G) and Brurya autocomplete (`LookupService.js:72-115` re-opens spreadsheet by name + full sheet scan per keystroke).
- **Shared widget kit `TaskWidgets.html` adopted by exactly one view** (`LibraryView`). Same atoms (status pill, priority badge, due chip, helpers like `formatDate`/`escape`) are hand-rolled across 8+ views.
- **Mobile breaks across critical manager views**: `ManagerProductsView` comparison grid is fixed 2-column at every width (cramming on phone); `ManagerInventoryView` 12-column counts table cannot fit a phone even with `table-sm`; `ManagerOrdersView` has zero mobile CSS and a CLAUDE.md violation (`btn-primary` invented at `:120`).
- **`.responsive-stack` utility** defined in `AppView.html:113-135` and adopted by **zero** views.

This plan reorganizes, optimizes for speed, and mobile-izes (where mobile matters) without adding new features.

## 2. Scope

**In scope.**
- All HtmlService views in `jlmops/` (`*.html`)
- Shared widget kit (`TaskWidgets.html`) and the AppView shell
- View controllers (`WebApp*.js`) where their data-fetch shape drives UI behavior
- Reconciliation against existing UI plans: `MANAGER_UI_PLAN.md`, `LIBRARY_VIEW_PLAN.md`, `ADMIN_VINTAGE_REVIEW_UX_PLAN.md`

**Out of scope.**
- WordPress / theme / customer-facing site (separate `website/` work; covered in Target 2 future audit)
- Net-new features (improve + consolidate only, per user direction 2026-05-28)
- Visual design system overhaul (colors, typography, brand polish) — "appearance" here means visible / accessible / not overlapping / not truncated / not more than useful; **functional appearance, not aesthetic redesign**
- Bilingual EN+HE language switching mechanism (preserved as constraint, not redesigned)

## 3. Surfaces (per-view inventory + gaps)

For each routed view: role audience, primary purpose, key gaps. Widgets listed at end.

### 3.1 Dashboards

**`AdminDashboardView_v2.html`** — both roles via `WebApp.js:73-75, :57-62`. Daily admin entry; 4 summary cards (System Health / Orders / Inventory / Products) + Projects table + Tasks table. Click-through to AdminProjectsView via sessionStorage handoff. `WebAppDashboardV2_getData` single round-trip. **Gaps:** the backend reads full `SysJobQueue` and discards it (`WebAppDashboardV2.js:30-37, :101-174`) — dead I/O on every dashboard load for both roles.

**`ManagerDashboardView_v2.html`** — manager only. 3 context cards (Orders / Inventory / Products) + full-width Tasks card with List/Calendar toggle. Inline expand-on-row pattern. Per `MANAGER_UI_PLAN.md` §2 + §4 the dashboard routing contract: inventory/products tasks navigate to dedicated views; content tasks expand inline. **Gaps:** expanded `task-detail .detail-row` outer collapses to column on mobile (`:30, :92`), but the inner `<div class="d-flex">` at `:451` doesn't — 6 label/value pairs + status select + Revert button overflow on phone. Status select fixed `style="width:100px"` (`:462`) forces small tap target.

### 3.2 Sync

**`AdminSyncView.html`** — admin only. 36-line wrapper that loads `AdminDailySyncWidget_v2` via `getHtmlOutput` at runtime (`:22-35`) — one unnecessary network round-trip every Sync nav (LibraryView precedent at `LibraryView.html:1` uses `<?!= include('TaskWidgets') ?>` scriptlet instead).

**`AdminDailySyncWidget_v2.html`** — embedded widget; 6-step horizontal stepper. Polling: 1s during spinner stages, 10s during `WAITING_*` stages, off when `IDLE`/`COMPLETE`. Polling cadence appropriate.

### 3.3 Orders

**`OrdersView.html`** (T2.3 SHIPPED 2026-05-29 — merged `AdminOrdersView` + `ManagerOrdersView` into one role-gated file). Both roles via `WebApp.js` (`AdminOrders` + `ManagerOrders` both route here). Open Orders card visible to both; Packing Slips card `data-roles="manager"` (Print Selected + gift-doc creation). Admin skips the packable-orders fetch on mount via `document.body` role check. `btn-primary` already fixed in T1.0. **Remaining gaps (Tier 4.1):** zero mobile CSS; tables overflow on phone.

### 3.4 Inventory

**`AdminInventoryView.html`** — admin only, 793 lines. Four cards: Counts to Review / Comax Sync export / Create Count Tasks (filter form) / Open Inventory Tasks (Manager Queue — admin embeds manager queue as card 4). 1 round-trip via `WebAppInventory_getAdminInventoryViewData` (returns both reviewTasks + openTasks). Good consolidation precedent.

**`ManagerInventoryView.html`** — manager only, 646 lines. Two cards: Product Counts (export to/import from sheet + submit) + Brurya Stock Management (autocomplete + add + save). **Gaps:** 12-column counts table cannot fit phone (no `.responsive-stack`, no table-responsive wrapper); Brurya autocomplete re-opens spreadsheet by name + full sheet scan per keystroke (`LookupService.js:72-115`, no cache); autocomplete dropdown clips on narrow widths (container has `max-width: 300px`); action buttons row doesn't wrap on mobile; no media queries.

### 3.5 Products

**`AdminProductsView.html`** — admin only, 2053 lines. Four cards (Detail Updates / New Products / SKU Management / Lookups) + seven modals. Vintage Review editor modal per `ADMIN_VINTAGE_REVIEW_UX_PLAN.md` (status "Deployed 2026-04-24"). **Gaps (biggest):** `refreshView()` (`:726-746`) fires **12 parallel `google.script.run` calls** after every Accept/Submit (loadReviewList, loadAcceptedList, loadPendingDetailsList, loadSuggestionList, loadSubmissionsList, loadLinkageList, updateNewExportUI, loadPendingNewList, loadSkuUpdates, plus 3 loadLookupSection). Each independently scans SysTasks. Estimated 2-3 sec wall clock on warm cache. Also: invented `btn-primary` at multiple sites (`:186, :590, :1420`) — desk-only but CLAUDE.md violation.

**`ManagerProductsView.html`** — manager only, 1332 lines. Three cards (Detail Updates / New Products / Suggest Products); detail-edit modal mirrors admin vintage modal structure. **Gaps:** `.comparison-grid` is `grid-template-columns: 1fr 1fr` fixed at all widths (`:34`) — on 360px phone gives ~150px per column, unusable for Hebrew long-description textareas. 7-tab bar (`:23, :193-202`) on one flex line overflows phone width with no scroll. Modal header three-column flex uses `text-overflow: ellipsis` with `direction: rtl` for Hebrew name — RTL truncation pattern loses the start of the name on long wines (e.g. "…ינטז'"). Two outer tables lack `table-sm` and responsive treatment.

### 3.6 Bundles (named known-bad)

**`AdminBundlesView.html`** — admin only, 1201 lines. **What's specifically wrong:**

1. Three vertically stacked cards (Bundle Management / Low Inventory Alerts / Bundle Editor) with no workflow direction. Editor card pre-renders empty showing "Bundle Editor" placeholders — no visual cue tying list→editor; cards look like equal peers.
2. Three toolbar actions in the Management header (`:14-17`: Update Composition / Review Stock / Validate EN/HE Parity) appear row-scoped but are global system-task triggers. Looks like row-actions; behaves like system ops.
3. Low Inventory Alerts card duplicates a count already on the dashboard Products card (`AdminDashboardView_v2.html:271-275` "Bundle Critical" / "Bundle Low"). Two truths-of-the-day for the same data.
4. Bundle Editor empty workbench (no row selected) is structural noise.
5. No filter/search on the bundle list table; "Needs Attention" stat (`#stat-attention` at `:40`) is a count, not a filter.
6. EN/HE bundle name columns (`:51-52`) but parity-validate action is global, not row-level; no inline parity badge.

Also: `init()` fires **4 parallel round-trips** on view mount (`:186-205`: loadCategories / loadStats / loadBundleList / loadHealthAlerts). Same anti-pattern as AdminProductsView, smaller scale.

### 3.7 Projects

**`AdminProjectsView.html`** — admin only, 2301 lines. Two-column workbench (col-md-8 list / col-md-4 detail) with tri-state width toggle (`:16-58, :73-184`). Project mode + Task mode share the same list shell. Six modals including Content Stream (`:568`) — the precedent for LibraryView's modal. **Gaps:** Content Stream modal duplicated in LibraryView (`LibraryView.html:317`) — fork is deliberate per LIBRARY_VIEW_PLAN line 205 but convergence is now safe since both files exist in production. Session/entity filter debounce (`:851-871`) is local-only filter so doesn't need debounce (unneeded flicker).

### 3.8 Campaigns

**`AdminCampaignsView.html`** — admin only, 191 lines. Single card: campaign list with click-to-expand detail rows. 1 round-trip on load; per-campaign expand fires `getCampaignDetail` cached in `state.details`. **Good caching pattern precedent.** No gaps.

### 3.9 Contacts

**`AdminContactsView.html`** — admin only, 1446 lines. Two-column (col-md-8 list + filters + sortable headers / col-md-4 detail panel). **Good IA + speed pattern:** loads contacts once on mount, then `applyFilters()` runs entirely client-side over the cached `contacts[]` array (`:756-816`); search debounced 300ms but only re-runs local filter. **Gaps:** invented `btn-primary` at `:409, :515` (desk-only, CLAUDE.md violation); Bootstrap `$().modal()` at `:615, :621, :632, :686, :1067, :1087` (desk-only, CLAUDE.md violation); MC freshness chip + ⟳ MC button buried in tiny `mr-2` slot (`:7-18`).

**`ManagerContactView.html`** — both roles via `WebApp.js:96`. Mobile-first single-pane (max-width 760px). Self-contained mobile-first styles. Modal-overlay pattern correct. Used as Outreach dedicated-view pack per `LIBRARY_VIEW_PLAN.md:78`. **Gaps:** **uses different fetch pattern than AdminContactsView for the same backend** — every search keystroke (250ms debounced) round-trips to GAS via `WebAppContacts_getContactList({search})`, server filters all contacts in memory and returns matches. Same backend, opposite UI strategy. (Bug 2026-05-15; BUG_FIX_SEQUENCE Session G.)

### 3.10 Library

**`LibraryView.html`** — both roles. Two tabs (Tasks / Library). Tasks panel filter bar + queue list + inline pack-body expansion. Library panel preset chips + table + admin-only Create Content Tasks button (`data-roles="admin"` at `:288-290`). Three modals (Content Stream, Lock+Version, Attach Doc). Entity Detail Drawer. **Gold standard speed pattern:** 1 round-trip via `WebAppLibrary_getData`; all filtering/preset/sort/search client-side. Uses shared `TaskWidgets.html`. Per `LIBRARY_VIEW_PLAN.md:4`: all phase 11 distribution events live, `library.enabled` flag retired 2026-05-28. **Mobile gaps:** `.lv-drawer-header` is `grid-template-columns: 1fr 1fr` at all widths (`:154-156`) — same cramming as ManagerProductsView. Library list table has no mobile collapse. Stacked task columns lack `::before` labels on mobile (column meaning lost when stacked).

### 3.11 Admin tooling

**`DevelopmentView.html`** — admin only. Two cards: Development Tools (Rebuild SysConfig / Protect Headers / etc.) + **CRM Tools** (Import / Validate / Correct / Refresh / Enrich / Run Intelligence at `:21-36`). **Gap:** CRM operational tooling buried under "Development" while nav label "CRM Tools" goes to `AdminContactsView`.

### 3.12 Empty stub

**`SystemHealthView.html`** — RETIRED (T1.0 SHIPPED 2026-05-29). Was a 12-line empty stub; file deleted + viewMap line removed. The dashboard's System Health card (`AdminDashboardView_v2.html:142-207`) is the actual surface.

### 3.13 Widgets (loaded into views, not routed)

- **`TaskWidgets.html`** — atom kit. Included by LibraryView only (`:1` scriptlet). Atoms: status-pill, priority-badge, due-chip, topic chip, file-link chip, filter-bar, notes textarea, toast. JS helpers: `escape`, `formatDate`, `statusClass`, `priorityClass`, `dueClass`. **Sole consumer = LibraryView. Massive consolidation opportunity.**
- **`AdminDailySyncWidget_v2.html`** — embedded in AdminSyncView. The actual sync UI.
- **7 orphan widgets RETIRED (T1.0 SHIPPED 2026-05-29):** `SystemHealthWidget`, `AdminOrdersWidget`, `ManagerOrdersWidget`, `AdminInventoryWidget`, `ManagerInventoryWidget`, `AdminProductsWidget`, `ManagerProductsWidget` — all HTML files deleted + 7 viewMap lines removed + 3 dead `refreshSystemHealthWidget` conditional blocks removed from AdminInventoryView. Pre-v2 architecture residue, no consumer. (Backend `*WidgetData` data functions are separate and retained — one in live use by ManagerProductsView.)

## 4. Capability targets

What "good UI" means here. Starting numbers; tune after first review.

- **Workflow tap-count:** ≤ 5 taps from any view to complete a top manager workflow (packing run, count submit, contact lookup, task close).
- **Load time:** ≤ 1 round-trip on view mount; ≤ 500ms wall clock on warm cache for primary admin views.
- **Lookup latency:** local filter on bounded sets (≤ ~10k rows); 0 server round-trips per keystroke. Search debounces drive only local filter execution.
- **Mobile usability:** every mobile-needed view renders without overlap or truncation at 360px viewport; touch targets ≥ 44px; RTL Hebrew layout correct at all breakpoints.
- **Modal pattern compliance:** zero Bootstrap `$().modal()` calls in mobile-needed views; zero invented button classes anywhere.
- **Code consolidation:** TaskWidgets adopted by every view rendering tasks; duplicated helpers (`formatDate`, `escape`, etc.) removed from at least 5 view files.
- **Dead-code reduction:** orphan widgets retired (-6 files); empty stub views retired.

### Target → session map

Which sessions move each target.

| Target | Sessions |
|---|---|
| Tap-count ≤ 5 | 2.1 (bundles) + 2.2 (CRM nav) + 2.3 (orders merge) |
| Load time ≤ 1 round-trip + ≤ 500ms | 3.1 (Products refresh) + 3.3 (bundles fanout) + 1.x (quick wins) |
| Lookup latency 0 keystroke round-trips | 3.2 (ManagerContact load-once) + 1.x (Brurya cache) |
| Mobile usable at 360px | 5.1-5.5 (per-view mobile passes) |
| Modal compliance | 6.1 + 6.2 (admin modal cleanup) |
| Code consolidation | 2.5-2.7 (TaskWidgets adoption) |
| Dead code retired | 1.x (quick-wins batch) |

## 5. Remediation queue, sequenced sessions

### Cross-cutting UI patterns (CCP-UI)

Every session below applies these. Listed once, referenced by name.

**CCP-UI-1 Modal pattern.** `modal-overlay` with `style.display = 'flex' / 'none'`. Never Bootstrap `$().modal()`. Pattern: `<div class="modal-overlay" id="x-modal" style="display:none;"><div class="modal-container"><div class="modal-header">…</div><div class="form-body">…</div><div class="modal-footer bg-light">…</div></div></div>`. Source: `jlmops/CLAUDE.md:80-95`, precedent `AdminProductsView`, `LibraryView`.

**CCP-UI-2 Button discipline.** Copy existing button class from the same file. Run `grep -n "class=\"btn" <filename>` before writing any new button. Never invent `btn-primary` / `btn-secondary` / `btn-danger` etc. unless the file already uses them. Source: `jlmops/CLAUDE.md:68-78`.

**CCP-UI-3 Table pattern.** `<table class="table table-sm table-hover">` for data tables. Many-column tables need either `<div class="table-responsive">` wrapper (horizontal scroll) or `.responsive-stack` utility from `AppView.html:113-135` (stacks rows on mobile with `<td data-label="…">`). Source: `jlmops/CLAUDE.md:97-99` + shell utility.

**CCP-UI-4 Role gating.** Body class `role-admin` / `role-manager` applied at `AppView.html:108-109` drives role-conditional visibility. Per-element gating uses `data-roles="admin"` / `data-roles="manager"`. Single shared view file for both roles is preferred over separate files. Source: `AppView.html:108-109`, `LIBRARY_VIEW_PLAN.md:192-204`.

**CCP-UI-5 Data fetch: load-once + client-filter.** Bounded data sets (~few thousand rows) fetch once on view mount; all filter/sort/search runs over cached client state. Explicit "Refresh" button next to search box re-fetches. Backend exposes a single `WebAppX_getViewData()` returning the bounded set. **No backend call per keystroke.** Precedent: `AdminContactsView`, `LibraryView`, `AdminProjectsView`.

**CCP-UI-6 Shared widget kit.** Include `TaskWidgets.html` via scriptlet `<?!= include('TaskWidgets') ?>` for any view rendering task atoms. Use the kit's `escape`, `formatDate`, `statusClass`, `priorityClass`, `dueClass`. Add to the kit before re-implementing locally. Sub-templates load via scriptlet include, not runtime `getHtmlOutput`. Precedent: `LibraryView.html:1`.

**CCP-UI-7 Mobile primitives.** Viewport meta correct (precedent `AppView.html:5`). Touch targets ≥ 44px (precedent `AppView.html:144-156`). Inputs `min-height: 40px; font-size: 16px` (defeats iOS auto-zoom). `.responsive-stack` utility from `AppView.html:113-135` for many-column **read-mostly** tables (NOT for tables where data entry is the workflow — see T4.3 v2 re-plan). RTL bidi tested with real Hebrew strings at narrow widths. **Use logical CSS properties** (`margin-inline-start` not `margin-left`, `padding-inline-end` not `padding-right`) so layouts mirror correctly in RTL mode.

**CCP-UI-8 Accessibility & focus management.** Every modal-overlay sets focus to its first interactive element on open and restores focus to the trigger element on close. Esc key closes modal. Body scroll-lock while modal open (`body { overflow: hidden }` toggled on open/close). Modal stacking uses incrementing z-index. Interactive non-button elements (filter chips, tab buttons, clickable rows) get `role="button" tabindex="0"` and respond to Enter/Space. ARIA: form inputs paired with `<label for>`; status badges use `aria-label` describing the state. Implement once as a shared `ModalOverlay.open(id)` / `.close(id)` helper to be used by every modal-overlay consumer; do not re-derive per session. **Bootstrap modals provided focus-trap for free; modal-overlay does not — converting without CCP-UI-8 ships a regression masquerading as compliance.**

**CCP-UI-9 Observability & measurement.** Every session that promises a perf improvement captures a stopwatch baseline pre-deploy and records it in `.claude/session-log.md` alongside the post-deploy measurement. Project-wide `window.onerror` handler ships errors to SysLog via `WebAppSystem_reportClientError(err)` (build the endpoint in the first session that needs it; reuse thereafter). Smoke for any session that adds event handlers (filter clicks, modal close buttons, etc.) explicitly opens browser console + Network tab — "zero errors" is a verification step, not a hope. Performance budgets per view: list view warm-cache mount ≤ 500ms; action handler post-action repaint ≤ 200ms; client-side filter on cached ≤2000 items ≤ 50ms. Sessions that miss the budget pause and reconsider before shipping.

### Session entry format

Each session below has: **goal** (one sentence), **anchors** (file:line refs), **implementation** (concrete sketch), **CCP-UIs applied**, **smoke** (post-deploy verification, including manual phone test for mobile sessions), **rollback** (revert path), **depends on** (prior sessions), and **CCP audit** (end-of-session checklist).

**No open-question punts.** This plan does not use `[start] / [spike] / [defer]` open-question taxonomy. Every gap is resolved in the session's deep-dive companion doc (`UI_T<tier>_<n>_<slug>.md`) via code reading before the session opens — never punted to session time. Library-plan failure mode: plans graded complete by many sessions were incomplete; mid-implementation decisions wasted time. Cure: answer the gaps in plan, ship cleanly. Genuine external dependencies (a credential to obtain, a third-party confirmation) go in §8.

**Session opening discipline.** Each session begins by reading: the session's deep-dive doc, the cited file:line refs, `jlmops/CLAUDE.md` for UI constraints, the relevant UI plan if cited. Commit small. Push then deploy as separate change-points (memory `feedback_clasp_push_not_deploy`).

**Line-ref drift discipline (v2).** Every deep-dive cites line numbers from current (pre-flight) code. Sessions later in the queue WILL operate on stale refs when prior sessions have shipped (e.g., T4.2's refs to `ManagerDashboardView_v2.html` are ~30 lines stale after T2.5; T5.1's refs to `AdminContactsView.html` are pre-T2.2 state). At session start, **re-grep the cited symbols** (not the literal line numbers) and adjust. Implementing sessions should treat plan line numbers as approximations, surrounding-text matches as authoritative. Coupled-file sessions (multiple sessions editing the same file) note this explicitly.

---

### Tier 1, Quick wins batch (1 session, 6 surgical fixes)

**1.0 Quick wins.** Six low-risk fixes that each take under 1 hour. Ship together in a single session with smoke gate per fix; if any reveals deeper issue, defer that one and continue with the rest.

**Anchors + fixes.**

1. **Retire `SystemHealthView`.** Delete `SystemHealthView.html`; remove from `WebApp.js` viewMap (`:76`). No nav reference. Smoke: nav still works.
2. **Retire 6 orphan widgets.** Delete `AdminOrdersWidget.html`, `ManagerOrdersWidget.html`, `AdminInventoryWidget.html`, `ManagerInventoryWidget.html`, `AdminProductsWidget.html`, `ManagerProductsWidget.html`. Remove from viewMap (`:79-89`). Confirm no `getView('*Widget')` or `getHtmlOutput('*Widget')` calls remain. Smoke: dashboards still render.
3. **Fix `ManagerOrdersView.html:120` invented `btn-primary`.** Change `class="btn btn-sm btn-primary ml-2"` to `class="btn btn-sm btn-light ml-2"` for the gift-doc "Open Document" link.
4. **Remove dead SysJobQueue read in `WebAppDashboardV2.js:30-37`.** The function `_getSystemHealthData_v2(allTasks, jobQueue, allConfig)` (`:101-174`) never uses the `jobQueue` parameter. Stop reading SysJobQueue in `_getData`; remove the parameter. Smoke: dashboard System Health card renders identically.
5. **Convert `AdminSyncView.html:22-35` to scriptlet include.** Replace runtime `getHtmlOutput('AdminDailySyncWidget_v2')` with `<?!= include('AdminDailySyncWidget_v2') ?>` (precedent `LibraryView.html:1`). Remove the now-unused `executeScriptsInElement` redefinition at `AdminSyncView.html:13-20` (parent shell has it). Smoke: Sync view loads, polling works, no console errors.
6. **Cache Brurya autocomplete source data.** In `LookupService.js:72-115` `searchComaxProducts`, replace per-call `SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next())` + full sheet scan with `ConfigService._getSheetDataAsMap`-style cache (precedent already exists in the same file for other lookups). Smoke: type 3 characters into Brurya autocomplete on Manager Inventory; expect sub-100ms response after first keystroke.

**CCPs applied.** CCP-UI-2 (fix 3 — copy `btn-light`), CCP-UI-6 (fix 5 — scriptlet include precedent).

**Rollback.** Per fix: git revert + redeploy. Each fix independent. Deleted view files: restore from git if reverted.

**Depends on.** Nothing. First session to ship.

**Deep-dive:** `jlmops/plans/UI_T1_0_quick_wins.md` (v1 written 2026-05-28; all gaps resolved; SystemHealthWidget confirmed orphan, scope expanded to 7 widgets + 3 dead conditional blocks).

**CCP audit.** Per fix: confirm pattern applied or refactor goal met; no new btn classes invented; no Bootstrap modal introduced.

---

### Tier 2, Organize (IA + workflow cleanup)

#### 2.1 AdminBundlesView restructure (named known-bad)

**Goal.** Bundle management surface answers "which bundle do I touch today?" at a glance. Cards have workflow direction; global actions stop looking like row-actions.

**Anchors.**
- `AdminBundlesView.html:6-95` (three-card structure)
- `AdminBundlesView.html:14-17` (Update Composition / Review Stock / Validate EN/HE Parity toolbar)
- `AdminBundlesView.html:40` (`#stat-attention` count, not a filter)
- `AdminBundlesView.html:51-52` (EN/HE columns)
- `AdminBundlesView.html:88+` (Bundle Editor card, pre-rendered empty)
- `AdminDashboardView_v2.html:271-275` (dashboard already shows Bundle Critical / Bundle Low count)

**Implementation.** (Corrected post-deep-dive 2026-05-28.)
1. Promote "Needs Attention" stat to row filter chip. Add filter chips bar (precedent `LibraryView.html:267-285`) above the bundle table: All / Needs Attention / Active / Draft / Archived. Click filters the table client-side from cached list.
2. Move 3 toolbar actions into a "System Actions" card-footer below the table. Re-label to make their global scope clear ("Run Composition Refresh" etc.).
3. Hide Bundle Editor card until a list-row is clicked; on row-click reveal the editor populated with the selected bundle. Editor keeps its existing internal col-md-4 / col-md-8 split.
4. Add row-level Low Stock badges to bundle list rows using the existing health-alerts data (build a Set of low-stock bundle IDs from the same `WebAppBundles_getBundlesWithLowInventory` response, cross-reference in the row renderer).
5. **CORRECTION:** Health Alerts card is NOT a count duplicate — it's a working replacement-selection workflow. **Do not retire.** Rename to "Suggest Replacements" and hide when no alerts exist.
6. **HIDDEN scope surfaced during deep-dive:** Slot Edit Modal at `:141-159` is Bootstrap modal (`class="modal fade"`, `data-dismiss="modal"`) — CLAUDE.md violation. Convert to modal-overlay as Stage A of this session.
7. **Row-level EN/HE parity badge deferred** — would require backend change (write parity result per-bundle). Defer until parity issues become frequent operator concern.

**CCPs applied.** CCP-UI-1 (modal-overlay for Slot Edit Modal), CCP-UI-3 (table-sm + filter chips), CCP-UI-5 (load-once + client-filter for bundle list).

**Smoke.** Open AdminBundles. Filter chips work locally. Click a bundle row, editor appears populated. Click "Run Composition Refresh" — task spawns, button visibly global-scoped (in footer). Confirm Suggest Replacements card visible iff alerts exist. Open Slot Edit Modal — confirms modal-overlay (no Bootstrap modal calls).

**Rollback.** Git revert + redeploy. No backend change.

**Depends on.** Nothing structural. Independent.

**Deep-dive:** `UI_T2_1_admin_bundles.md` (v1 written 2026-05-28; 4 stages — modal conversion → row badges + filter chips → toolbar relocation + Health Alerts rename + hide → editor hide-until-row-click).

**CCP audit.** CCP-UI-1 (if modal route chosen, modal-overlay only); CCP-UI-3 (table-sm + filter chips applied); CCP-UI-5 (filter from cached list, no per-filter round-trip).

#### 2.2 CRM Tools nav misplacement

**Goal.** "CRM Tools" nav label points at the CRM operational tooling, not at the contact browse. Operators don't have to navigate to "Development" to refresh contacts.

**Anchors.**
- `AppView.html:205-206` (nav: "Contacts" → AdminContactsView, "CRM Tools" → AdminContactsView)
- `DevelopmentView.html:21-36` (CRM Tools card: Import / Validate / Correct / Refresh / Enrich / Run Intelligence)
- `AdminContactsView.html:7-18` (header with buried MC freshness chip)

**Implementation.** (Corrected post-deep-dive 2026-05-28.)
1. Move the 6-button CRM Tools card from `DevelopmentView.html:19-36` into `AdminContactsView.html` as a `<details>` collapsible "Admin operations" panel above the contact-card row. Move the 6 JS handlers (`runCrmImportData`, etc.) at `DevelopmentView.html:141-260` along with them.
2. **CORRECTION:** the two nav entries at `AppView.html:205-206` are NOT duplicates — they load different views (Contacts → ManagerContactView for mobile quick lookup; CRM Tools → AdminContactsView for full browse + ops). **Both nav entries stay.** The CRM Tools label now accurately describes its destination after the operations move.
3. DevelopmentView keeps only system-debug operations (Rebuild SysConfig / Protect Headers / Validate Schema / Daily Housekeeping / Run Unit Tests).
4. MC freshness chip stays at AdminContactsView header (`:13-14`) — re-surfacing as panel header is minor cosmetic, deferred.

**CCPs applied.** CCP-UI-4 (AdminContactsView is admin-only via viewMap — implicit role gate; no explicit data-roles needed on the panel), CCP-UI-2 (bare `btn` class preserved from DevelopmentView).

**Smoke.** Navigate admin → CRM Tools → confirm Admin operations panel above contact list (collapsed by default). Expand, run Refresh Contacts. Navigate → Development → confirm CRM buttons gone, system-debug buttons remain.

**Rollback.** Git revert + redeploy.

**Depends on.** Nothing.

**Deep-dive:** `UI_T2_2_crm_nav.md` (v1 written 2026-05-28; 1 atomic stage — file-to-file move).

**CCP audit.** CCP-UI-4 (role gating on admin-only panel); CCP-UI-2 (no invented btn classes).

#### 2.3 AdminOrdersView merge into ManagerOrdersView

**Goal.** Single Orders view file gated by `data-roles`. Eliminates duplicate import-button code path and one routed entity.

**Anchors.**
- `AdminOrdersView.html` (113 lines, one card)
- `ManagerOrdersView.html` (175 lines, two cards)
- `AdminOrdersView.html:59` (admin calls `WebAppOrders_getOpenOrdersForManager`)
- `ManagerOrdersView.html:151-170` (Import button duplicating Admin's)

**Implementation.**
1. Add `data-roles="admin manager"` to the Open Orders card in ManagerOrdersView; add `data-roles="manager"` to the Packing Slips card.
2. Move the Import Web Orders button to a position visible to both roles (or duplicate-gate it — admin sees one, manager sees the manual Refresh-Orders form factor).
3. Update `WebApp.js:81` viewMap to point `AdminOrders` → `ManagerOrdersView` template (or rename to `OrdersView.html` and update both viewMap entries).
4. Delete `AdminOrdersView.html`.

**CCPs applied.** CCP-UI-4 (role gating via data-roles), CCP-UI-2 (Tier 1.0 already fixed `btn-primary`; preserve).

**Smoke.** Admin role: navigate Orders, see Open Orders card + Import. Manager role: navigate Orders, see Packing Slips + Open Orders cards. Confirm no broken nav entries, no JS errors. Confirm `AdminOrders` route still works (now serves shared view).

**Rollback.** Git revert + redeploy + restore deleted file.

**Depends on.** Nothing.

**Deep-dive:** `UI_T2_3_orders_merge.md` (v1 written 2026-05-28; 1 atomic stage — rename ManagerOrdersView.html → OrdersView.html, role-gate Packing Slips, retire AdminOrdersView.html; depends on T1.0 shipping first).

**CCP audit.** CCP-UI-4 (data-roles applied to differentiate cards).

#### 2.4 Content Stream modal merge — DEFERRED

**Status: deferred. Not in active ship queue.** See deep-dive for reasoning.

**Decision (banked 2026-05-28):** the two modals diverge meaningfully (LibraryView has Type + References fields AdminProjectsView lacks); per `LIBRARY_VIEW_PLAN.md:194` AdminProjectsView is documented to retire in a later phase. Forcing convergence now produces shared-component overhead that collapses to single-consumer once AdminProjectsView retires. Defer until either a third consumer emerges or AdminProjectsView retirement is canceled.

**Deep-dive:** `UI_T2_4_content_stream_modal.md` (v1 written 2026-05-28; documents the defer decision + unblock conditions).

#### 2.5 Extend TaskWidgets kit + migrate ManagerDashboardView_v2

**Goal.** Shared kit adopted by the highest-traffic view, eliminating ~150 lines of duplicated CSS + helpers.

**Anchors.**
- `TaskWidgets.html:140-193` (existing helpers: escape, formatDate, statusClass, priorityClass, dueClass)
- `ManagerDashboardView_v2.html:18-50, :266-272, :695` (hand-rolled atoms + helpers)
- `LIBRARY_VIEW_PLAN.md:110` (cites ManagerDashboardView_v2 as the source pattern for these atoms)

**Implementation.**
1. Extend `TaskWidgets.html` JS helpers: add `formatTime`, `formatTimeAgo`, `formatDateShort`. (Pull from `ManagerDashboardView_v2.html:695` and `AdminProjectsView.html:1951-1980`.)
2. Add `<?!= include('TaskWidgets') ?>` scriptlet at top of `ManagerDashboardView_v2.html`.
3. Remove duplicated CSS (status pill / priority badge / due chip / toast) from `:18-50`.
4. Replace local `escape` / `formatDate` etc. calls with `TaskWidgets.escape` / `TaskWidgets.formatDate`.
5. Smoke against existing UI; ensure manager dashboard renders identically.

**CCPs applied.** CCP-UI-6 (shared kit + scriptlet include).

**Smoke.** Open Manager dashboard, confirm all atoms render (status pills, priority badges, due chips) identically. Toast notifications work. Calendar view still renders. List view click-through works.

**Rollback.** Git revert + redeploy. CSS + helpers return.

**Depends on.** Nothing structural.

**Deep-dive:** `UI_T2_5_taskwidgets_extend_dashboard.md` (v1 written 2026-05-28; 3 stages — kit extension → helper migration → CSS class rename; all helper divergences resolved up front).

**CCP audit.** CCP-UI-6 (kit included, atoms come from kit, no local duplicates).

#### 2.6 TaskWidgets adoption pass 2

**Goal.** Migrate additional consumers (AdminCampaignsView, AdminProjectsView, AdminContactsView, AdminBundlesView, AdminInventoryView, ManagerContactView) to the extended TaskWidgets kit, one file at a time.

**Anchors.**
- `AdminCampaignsView.html:36-39, :46-52` (status colors + helpers)
- `AdminProjectsView.html:1-72, :1951-1980` (task-row layout + helpers)
- `AdminContactsView.html:1162` (escapeHtml)
- `AdminBundlesView.html:1175` (formatDate)
- `AdminInventoryView.html:578`
- `ManagerContactView.html:189`

**Implementation.**
- One PR per consumer file.
- Same pattern as 2.5: include scriptlet, remove duplicates, replace calls.

**CCPs applied.** CCP-UI-6.

**Smoke.** Per file: open view, confirm identical render. Run any expand-on-row / filter behaviors. Confirm no console errors.

**Rollback.** Per file: git revert + redeploy.

**Depends on.** 2.5 (kit extension shipped first so all needed helpers exist).

**Deep-dive:** `UI_T2_6_taskwidgets_adoption_rollout.md` (v1 written 2026-05-28; 6 stages — one consumer per stage, smallest-to-largest scope; 84 total call sites; no new kit additions needed beyond T2.5).

**CCP audit.** CCP-UI-6 per file.

---

### Tier 3, Optimize (speed)

#### 3.1 AdminProductsView.refreshView consolidation

**Goal.** 12 parallel round-trips after every Accept/Submit collapses to 1.

**Anchors.**
- `AdminProductsView.html:726-746` (refreshView fans out 12 calls)
- `WebAppDashboardV2_getData` precedent for single-call shape
- `WebAppInventory_getAdminInventoryViewData` precedent (returns multiple bucketed task arrays from one call)

**Implementation.**
1. New backend `WebAppProducts_getAdminViewData()` reading SysTasks once, bucketing into the 8 task arrays needed (review / accepted / pendingDetails / suggestions / submissions / linkage / pendingNew / skuUpdates) + the 3 lookup sections + new-export-UI flag. Single response.
2. Replace `refreshView()` (`:726-746`) with single `google.script.run.withSuccessHandler(applyAllSections).WebAppProducts_getAdminViewData()`.
3. Client-side splicing remains for accept/submit flows (per `ADMIN_VINTAGE_REVIEW_UX_PLAN.md` precedent — do not regress).
4. Add explicit Refresh button to UI (precedent `AdminContactsView.html:544`) for manual refresh; remove automatic 12-call refresh on accept/submit completion (single splice + cache update is enough).

**CCPs applied.** CCP-UI-5 (load-once + client-filter for products data), CCP-UI-6 (use shared helpers where applicable).

**Smoke.** Pre-deploy: time a vintage-review Accept on stopwatch (typical ~2-3 sec). Post-deploy: same Accept, expect <500ms. Run full SKU action sequence (Submit, Finalize, Export, Confirm); confirm each card refreshes correctly via splicing + single getViewData.

**Rollback.** Git revert + redeploy. No schema change; backend addition harmless if unused.

**Depends on.** Nothing structural. Ideally after 2.5 (TaskWidgets) if any new rendering pulls atoms from the kit.

**Deep-dive:** `UI_T3_1_admin_products_refresh.md` (v1 written 2026-05-28; 2 stages — backend `WebAppProducts_getAdminViewData` added then frontend refreshView refactor; vintage splice path preserved; per-section getter consolidation deferred).

**CCP audit.** CCP-UI-5 (single getViewData call); no regression to single-action splicing.

#### 3.2 ManagerContactView load-once-filter-client

**Goal.** Per-keystroke server round-trip removed. Manager search runs entirely client-side. Closes BUG_FIX_SEQUENCE Session G.

**Anchors.**
- `ManagerContactView.html:219-265` (current per-keystroke pattern)
- `AdminContactsView.html:756-816` (correct load-once + client-filter pattern to copy)
- `WebAppContacts.js:12-83` (shared backend; can drop the filters.search branch after both UIs filter client-side)
- `ContactService.js:337-360, :278-318` (5-min TTL cache + serialization cost per call)

**Implementation.**
1. On view mount, call `WebAppContacts_getContactList({})` once; cache in `state.contacts`.
2. Search input runs `applyFilters()` against `state.contacts` locally; 250ms debounce drives only local filter execution.
3. Explicit Refresh button (button atom from CCP-UI-6) re-fetches.
4. Once both UIs use load-once, drop the `filters.search` branch in `ContactService.js:352-357` (deferred to follow-on cleanup; not in this session's scope).

**CCPs applied.** CCP-UI-5 (load-once + client-filter), CCP-UI-6 (button atom).

**Smoke.** Open Manager Contacts on phone. Type 3-letter search; expect instant filter (no spinner). Toggle filter chips; expect instant. Click Refresh; expect short spinner + re-fetch. Compare time-to-result vs pre-fix (per-keystroke vs local).

**Rollback.** Git revert + redeploy. No backend change.

**Depends on.** Nothing structural. Soft after 2.5 (TaskWidgets includes the search-input atoms).

**Deep-dive:** `UI_T3_2_manager_contact_load_once.md` (v1 written 2026-05-28; 1 stage — load-once on mount + client-side filter on email/name/phone/city; no Refresh button (mount = refresh); closes BUG_FIX_SEQUENCE Session G).

**CCP audit.** CCP-UI-5 (single fetch on mount, all input drives local filter); CCP-UI-6 (atoms from kit).

#### 3.3 AdminBundlesView 4-call init consolidation

**Goal.** 4 parallel init round-trips collapse to 1.

**Anchors.**
- `AdminBundlesView.html:186-205, :221-265` (init fires loadCategories + loadStats + loadBundleList + loadHealthAlerts)
- Precedent: `WebAppInventory_getAdminInventoryViewData`

**Implementation.**
1. New backend `WebAppBundles_getViewData()` returning `{ categories, stats, bundles, healthAlerts }`.
2. Replace `init()` 4 calls with single call.
3. Each render-function reads from the response sections.

**CCPs applied.** CCP-UI-5.

**Smoke.** Open Bundles view. Confirm all sections render with identical data. Time to interactive should be 1× single round-trip instead of 4× parallel.

**Rollback.** Git revert + redeploy.

**Depends on.** Soft after 2.1 (Bundles restructure) so the new IA is in place before consolidating the data load.

**Deep-dive:** `UI_T3_3_admin_bundles_consolidate.md` (v1 written 2026-05-28; 2 stages — backend `WebAppBundles_getViewData` + frontend init refactor; T2.1 outcomes preserved; same T3.1 recipe).

**CCP audit.** CCP-UI-5.

---

### Tier 4, Mobile-ize

#### 4.1 ManagerOrdersView mobile pass

**Goal.** Manager can run a packing slip workflow on phone without overflow.

**Anchors.**
- `ManagerOrdersView.html` (zero mobile CSS today)
- `ManagerOrdersView.html:44` (Packing Slips table — 7 columns)
- `ManagerOrdersView.html:84` (Open Orders table — 6 columns)
- `AppView.html:113-135` (`.responsive-stack` utility, unused so far)
- `jlmops/CLAUDE.md:80-99` (modal/btn/table rules)

**Implementation.**
1. Add `table-sm` to both tables.
2. Apply `.responsive-stack` utility with `<td data-label="…">` on cells: tables collapse to one card per row on mobile.
3. Verify checkbox tap target — wrap in `<label class="d-block p-2">` so the row label is tappable.
4. Confirm Print Selected button stays accessible at bottom of screen on mobile.

**CCPs applied.** CCP-UI-3 (table-sm + responsive-stack), CCP-UI-7 (44px touch targets).

**Smoke.** **Manual phone test required.** Load ManagerOrders on phone (Android Chrome or iOS Safari). Verify: 7-column packing table collapses to readable cards; checkbox row taps anywhere on the row; Print Selected button reachable; Open Orders table same behavior.

**Rollback.** Git revert + redeploy.

**Depends on.** Soft after 1.0 (the `btn-primary` fix at `:120` lands in quick wins).

**Deep-dive:** `UI_T4_1_orders_mobile.md` (v1 written 2026-05-28; 1 stage — both tables adopt `.responsive-stack` + explicit "Select all" button replaces thead-hidden-on-mobile select-all; `.responsive-stack` utility verified working).

**CCP audit.** CCP-UI-3 (table-sm + responsive treatment), CCP-UI-7 (touch targets verified on real device).

#### 4.2 ManagerDashboardView_v2 expanded row mobile fix

**Goal.** Expanded task `detail-row` inner content stacks vertically on phone instead of overflowing horizontally.

**Anchors.**
- `ManagerDashboardView_v2.html:30, :92` (outer `.detail-row` collapses to column on mobile)
- `ManagerDashboardView_v2.html:451` (inner `<div class="d-flex" style="gap:15px;">` doesn't collapse)
- `ManagerDashboardView_v2.html:462` (status select fixed `style="width:100px"`)

**Implementation.**
1. Add mobile override: `@media (max-width: 768px) { .task-detail .detail-row > .d-flex { flex-direction: column; gap: 8px; } }`.
2. Remove `style="width:100px"` from status select on mobile (or move to a media query unsetting it).
3. Confirm Revert + Save buttons remain reachable at bottom of expanded row.

**CCPs applied.** CCP-UI-7.

**Smoke.** **Manual phone test.** Open Manager Dashboard on phone, expand a task row. Confirm Stream / Start / Due / Done / Created / Priority / Document pairs stack vertically. Status select full-width and tappable. Revert/Save reachable.

**Rollback.** Git revert + redeploy.

**Depends on.** Soft after 2.5 (TaskWidgets adoption may consolidate some of the inline CSS).

**Deep-dive:** `UI_T4_2_dashboard_expanded_row.md` (v1 written 2026-05-28; 1 stage — CSS-only + 1 JS markup tweak; inner-flex stacks vertically on mobile; status select inline width moved to CSS so it can override per-breakpoint).

**CCP audit.** CCP-UI-7.

#### 4.3 ManagerInventoryView mobile pass

**Goal.** 12-column counts table fits a phone via either horizontal scroll wrapper or `.responsive-stack`. Brurya autocomplete dropdown doesn't clip on narrow widths.

**Anchors.**
- `ManagerInventoryView.html:132-194` (12-column counts table)
- `ManagerInventoryView.html:614-626` (4-column Brurya table)
- `ManagerInventoryView.html:466-492` (autocomplete dropdown positioned absolute within `max-width: 300px` container)
- `ManagerInventoryView.html:62-66, :82-92` (action button rows that don't wrap on mobile)
- `AppView.html:113-135` (responsive-stack)

**Implementation.**
1. Pass A: action button rows. Add `flex-wrap: wrap; gap: 8px;` so Export/Import/Submit/Save don't compress on narrow widths.
2. Pass B: 12-column counts table. Minimum-effort: wrap in `<div class="table-responsive">` for horizontal scroll. Longer-term: convert to `.responsive-stack` with one card per product (comax + total + brurya as labels; 3 input fields stacked).
3. Brurya autocomplete container: drop `max-width: 300px` on mobile; dropdown re-aligns.
4. Brurya table: add `table-sm`; on mobile widen the quantity-input column or stack.
5. Toast position: confirm doesn't cover hamburger when sidebar open.

**CCPs applied.** CCP-UI-3, CCP-UI-7.

**Smoke.** **Manual phone test.** Counts table scrolls horizontally without clip. Action buttons all reachable. Brurya autocomplete: type product name, dropdown shows all results without clip. Submit count.

**Rollback.** Git revert + redeploy.

**Depends on.** Soft after 1.0 (Brurya cache).

**Deep-dive:** `UI_T4_3_inventory_mobile.md` (v1 written 2026-05-28; 3 stages — card-header wrapping + Brurya autocomplete max-width fix → Product Counts table responsive-stack → Brurya table responsive-stack; committed to `.responsive-stack` over `table-responsive` wrapper for warehouse-floor workflow).

**CCP audit.** CCP-UI-3, CCP-UI-7.

#### 4.4 ManagerProductsView mobile pass

**Goal.** Comparison grid stacks vertically on phone. Tab bar scrolls. Hebrew RTL doesn't truncate from the start of the name.

**Anchors.**
- `ManagerProductsView.html:34` (`.comparison-grid: 1fr 1fr` at all widths)
- `ManagerProductsView.html:23, :193-202` (7-tab flex line)
- `ManagerProductsView.html:11-18, :182-189` (modal header three-column flex with RTL ellipsis)
- `ManagerProductsView.html:65` (desc-long min-height 120px)
- `ManagerProductsView.html:88-101, :111-125` (outer tables)
- `ManagerProductsView.html:156-171` (Suggest Products has `table-responsive` wrapper — keep)

**Implementation.**
1. Add `@media (max-width: 768px) { .comparison-grid { grid-template-columns: 1fr; } }`.
2. Add `overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap;` to tab bar at narrow widths.
3. Modal header on mobile: stack the three columns vertically (`@media (max-width: 768px) { .modal-header > .header-row { flex-direction: column; } }`) so Hebrew names get full width with no RTL ellipsis.
4. Outer tables: `table-sm` + `.responsive-stack` or `table-responsive` wrapper.

**CCPs applied.** CCP-UI-1 (modal-overlay pattern preserved), CCP-UI-3, CCP-UI-7.

**Smoke.** **Manual phone test.** Open a product edit modal. Comparison grid stacks. Tabs scroll horizontally. Hebrew name not truncated. Submit edit.

**Rollback.** Git revert + redeploy.

**Depends on.** Nothing structural.

**Deep-dive:** `UI_T4_4_products_mobile.md` (v1 written 2026-05-28; 2 stages — modal mobile fixes (comparison-grid single-column, tab-bar scroll, RTL Hebrew header truncation fix) → outer tables responsive-stack).

**CCP audit.** CCP-UI-3, CCP-UI-7.

#### 4.5 LibraryView mobile gaps

**Goal.** Entity drawer header stacks on phone. Stacked task rows show column labels via `::before`.

**Anchors.**
- `LibraryView.html:99-105` (library list table, no mobile collapse)
- `LibraryView.html:110-116` (task-row mobile override partial)
- `LibraryView.html:112` (`.lv-task-row [class^="col-"] { flex: none }` — stacks columns but labels lost)
- `LibraryView.html:121-125` (drawer panel sizing — already mobile-friendly)
- `LibraryView.html:154-156` (`.lv-drawer-header: 1fr 1fr` at all widths)

**Implementation.**
1. Add `@media (max-width: 768px) { .lv-drawer-header { grid-template-columns: 1fr; } }`.
2. Add `::before` content labels for all stacked task-row columns on mobile (precedent `ManagerDashboardView_v2.html:76-84`).
3. Library list table: `table-sm` + `table-responsive` wrapper (or `.responsive-stack` if utility verified in 4.1).

**CCPs applied.** CCP-UI-3, CCP-UI-7.

**Smoke.** **Manual phone test.** Open Library on phone. Tasks tab: rows stack with column labels visible. Library tab: list table scrolls or stacks. Open entity drawer: header stacks single-column; sections readable.

**Rollback.** Git revert + redeploy.

**Depends on.** Soft after 4.1 if `.responsive-stack` adoption pattern emerges from there.

**Deep-dive:** `UI_T4_5_library_mobile.md` (v1 written 2026-05-28; 2 stages — CSS additions (drawer single-col + task-row status label) → library list table responsive-stack).

**CCP audit.** CCP-UI-3, CCP-UI-7.

---

### Tier 5, Polish (lower priority, mostly admin-desk)

#### 5.1 AdminContactsView Bootstrap modal cleanup

**Goal.** Replace Bootstrap `$().modal()` with modal-overlay pattern. CLAUDE.md compliance.

**Anchors.**
- `AdminContactsView.html:424, :461, :495` (modal containers — Log Activity / Create Task / Compose Email)
- `AdminContactsView.html:615, :621, :632, :686, :1067, :1087` (Bootstrap `$().modal()` calls)
- `AdminContactsView.html:409, :515` (invented `btn-primary`)

**Implementation.**
1. Convert each modal HTML to modal-overlay pattern (CCP-UI-1).
2. Replace `$().modal('show')` / `$().modal('hide')` with `style.display = 'flex' / 'none'`.
3. Fix invented `btn-primary` → `btn btn-light` or matching existing class.

**CCPs applied.** CCP-UI-1, CCP-UI-2.

**Smoke.** Open each modal (Log Activity, Create Task, Compose Email). Submit and cancel each. Confirm visual behavior matches modal-overlay convention (background dim, click-outside-close optional).

**Rollback.** Git revert + redeploy.

**Depends on.** Nothing.

**Deep-dive:** `UI_T5_1_admin_contacts_modals.md` (v1 written 2026-05-28; 2 stages — btn-primary fix → 3 Bootstrap modal conversions; backdrop click-to-close NOT adopted per project precedent).

**CCP audit.** CCP-UI-1 (zero `$().modal()` after), CCP-UI-2 (zero invented btn classes after).

#### 5.2 AdminProductsView CLAUDE.md compliance (scope correction)

**Goal.** Replace invented `btn-primary` classes with bare `btn` pattern. **Modal cleanup NOT needed** — AdminProductsView's 7 modals are already `modal-overlay` (audit doc's modal-cleanup premise was wrong; verified via code-read 2026-05-28).

**Anchors.**
- `AdminProductsView.html:186, :590, :1420` (3 invented `btn-primary` sites)

**Implementation.** 3 class substitutions: `btn btn-primary` → `btn`. Verify zero `modal fade` or `$().modal()` remains (should already be zero).

**CCPs applied.** CCP-UI-2.

**Smoke.** Spot-check each fixed button (Export New Products / Finalize Hot Insert / Link) — confirms light btn style + click still works.

**Rollback.** Git revert + redeploy.

**Depends on.** Soft after 3.1 (refreshView consolidation lands first to avoid merge conflict on the same file).

**Deep-dive:** `UI_T5_2_admin_products_modals.md` (v1 written 2026-05-28; smallest session in queue — 3 trivial class fixes, ~10 minutes including deploy).

**CCP audit.** CCP-UI-2 only.

#### 5.3 Shared list component (CCP-UI candidate)

**Goal.** Extract a `TaskWidgets.bindList({items, filters, sortFields, renderRow, onRowClick})` helper after at least 3 views adopt the load-once + client-filter pattern.

**Anchors.**
- Adopters by Tier 3: ManagerContact, AdminBundles, AdminProducts.
- Existing precedents to align: AdminContacts, AdminProjects, LibraryView, AdminCampaigns.

**Implementation.**
1. After Tier 3 ships, audit the 3 new + 4 existing consumers for structural similarity in their filter/sort/render code.
2. If patterns converge, extract a `TaskWidgets.bindList` helper.
3. Migrate one consumer at a time.

**CCPs applied.** CCP-UI-5, CCP-UI-6.

**Smoke.** Per migrated consumer: identical render + filter behavior.

**Rollback.** Per file: git revert + redeploy.

**Depends on.** Tier 3 sessions shipped (so structural pattern is observable across more than 2 views).

**Deep-dive:** `UI_T5_3_shared_list_component.md` (v1 written 2026-05-28; **conditional deferral** with explicit 3-criterion trigger evaluated at end of UI implementation phase; not on active queue until trigger fires).

**CCP audit.** CCP-UI-5, CCP-UI-6.

---

### Sequencing summary

**Independent (can ship any order within tier):** 1.0, 3.2, 4.2, 4.4.

**Hard dependencies (v2 expanded):**
- T2.3 depends on T1.0 (file inherits `btn-primary` fix at `:120` before rename).
- T2.6 depends on T2.5 (kit extended first).
- T3.3 depends on T2.1 (filter chip + `lowStockBundleIds` state preserved through consolidation).
- T4.1 depends on T2.3 (file rename `ManagerOrdersView.html` → `OrdersView.html`).
- T4.3 v2 depends on **CCP-UI-8 helper shipped first** (modal-per-product needs focus management; first session that builds the `ModalOverlay.open/close` helper unblocks T4.3).
- T5.1 depends on T2.2 AND T2.6 Stage D (sequential AdminContactsView edits).
- T5.3 depends on Tier 3 shipped (need ≥3 adopters to observe pattern).

**File-coupling sequencing (v2 surfaced).** Multiple sessions edit the same file across the queue; line refs in later sessions are pre-flight (stale by ship time):

- **AdminContactsView.html:** T2.2 → T2.6 Stage D → T5.1. Each later session re-greps at session start.
- **ManagerDashboardView_v2.html:** T2.5 → T4.2. T4.2 line refs ~30 lines stale after T2.5.
- **AdminBundlesView.html:** T2.1 → T2.6 Stage A → T3.3. T2.6.A and T3.3 line refs pre-T2.1.
- **ManagerOrdersView.html / OrdersView.html:** T1.0 Fix 3 → T2.3 (rename) → T4.1.
- **AdminProductsView.html:** T3.1 → T5.2. T5.2 line refs pre-T3.1.

**Removed cargo-cult deps (v2):** T4.2 → T2.5 soft dep removed — T4.2 is CSS-only + 1 JS markup tweak; T2.5 helper migration doesn't affect T4.2's scope.

**Recommended ship order:** T1.0 → T2.5 → T2.1 → T2.2 → T2.3 → T2.6 → T3.1 → T3.2 → T3.3 → **[ship CCP-UI-8 helper as prerequisite]** → T4.3 (v2 modal-per-product) → T4.1 → T4.2 → T4.4 → T4.5 → T5.1 → T5.2 → T5.3 (conditional). (T2.4 deferred.)

(T2.4 deferred 2026-05-28 — see §5 Tier 2.4 entry. Total active sessions: 17 + 1 prerequisite (CCP-UI-8 helper).)

**Staging within sessions.** Tier 1.0 ships 6 surgical fixes with smoke gate per fix in one session. Other sessions are single deploys.

**Self-refresh checkpoint.** After every 3 shipped sessions, re-read §3 surfaces and confirm they still match code reality. UI shifts faster than backend; drift here is more likely than in the reliability audit.

## 6. Ongoing assurance scheme

After Tiers 1-2 land:

- **Per-session-start.** Open the relevant UI plan, this audit doc, and `jlmops/CLAUDE.md`. Confirm no CCP-UI rule is being skipped under time pressure.
- **After each shipped session.** CCP audit pass: confirm cited patterns actually applied in the code change. Half-pattern code is the most common source of UI debt.
- **Monthly (session-driven).** Spot-check 3 mobile-needed views on a real phone. Mobile drift is silent; only periodic manual test catches it.
- **Quarterly.** Re-grep for CLAUDE.md violations (`grep -rn "btn-primary\|btn-danger\|\.modal('show')"`). Surface any new violations introduced.
- **Annually.** UI plan reconciliation pass: are MANAGER_UI_PLAN / LIBRARY_VIEW_PLAN / this audit still aligned with shipped code, or has drift crept in? Update in place.
- **After every 3 shipped sessions.** Self-refresh checkpoint — re-read §3 surfaces.

## 7. Shared infrastructure reference

Quick reference for the patterns sessions apply. Not a full spec; pointers to source.

**Modal-overlay pattern.** `jlmops/CLAUDE.md:80-95`. Precedent: any modal in `AdminProductsView.html`, `LibraryView.html`, `ManagerContactView.html`.

**Button discipline.** `jlmops/CLAUDE.md:68-78`. Grep first: `grep -n "class=\"btn" <filename>`.

**Table pattern.** `jlmops/CLAUDE.md:97-99`. `table table-sm table-hover` is the standard. Many-column on mobile: `<div class="table-responsive">` wrapper or `.responsive-stack` from `AppView.html:113-135`.

**Role gating.** `AppView.html:108-109` body class. Per-element `data-roles="admin"` / `data-roles="manager"`. Precedent `LibraryView.html:288-290`.

**TaskWidgets shared kit.** `TaskWidgets.html`. Include via `<?!= include('TaskWidgets') ?>` (precedent `LibraryView.html:1`). Atoms + helpers documented in file header.

**Load-once + client-filter.** Precedent `AdminContactsView.html:756-816`. Backend exposes `WebAppX_getViewData()` returning bounded set. Client filter/sort/search over `state.items`. Explicit Refresh button for re-fetch.

**Mobile primitives.** `AppView.html:5` (viewport), `:113-135` (responsive-stack), `:138-172` (sidebar collapse + backdrop), `:144-156` (44px targets + 40px+16px inputs).

## 8. Open questions

Session-level unknowns that can be resolved at session start. Plan-level questions trimmed.

- **`.responsive-stack` utility verification.** Defined but never used (`AppView.html:113-135`). Spike at start of Tier 4.1 to confirm it behaves as labeled before relying on it. If broken, fix it in 4.1 or fall back to `table-responsive` wrappers across Tier 4.
- **Bundle Editor placement** (modal vs right-side detail pane). Resolved at start of 2.1 session; default right-side detail pane (consistency with AdminProjectsView).
- **Click-outside-to-close** modal convention. Inspect existing implementations at start of 5.1; apply consistently.
- **SystemHealthWidget retirement.** Confirm no consumer at start of 1.0 before deleting.
- **Visual design system question.** Not in scope per user direction. Open if "appearance = visible / accessible / not overlapping / not truncated" reveals a deeper need (font scaling, contrast, line-height) — surface in a future session if the per-view passes hit it.
- **Manager phone real-device testing.** Plan assumes Android Chrome OR iOS Safari but doesn't specify which device tests where. Resolve at start of first Tier 4 session.

## 8.5 v2 changes summary (post agent review, 2026-05-28)

Three additional agent reviews surfaced 12 findings; all folded in.

**Major (banked changes):**
1. **CCP-UI-8 added: Accessibility & focus management.** Modal focus trap, Esc-to-close, body scroll-lock, ARIA, keyboard nav on chips/tabs/rows. Shared `ModalOverlay.open/close` helper built once before T5.1 ships. Modal-overlay regression vs Bootstrap modal acknowledged and remediated.
2. **CCP-UI-9 added: Observability & measurement.** Stopwatch baseline mandate, `window.onerror` → SysLog via new endpoint, per-view perf budgets, smoke step explicitly opens browser console + Network tab.
3. **T4.3 v2 re-plan.** v1's `.responsive-stack` for warehouse-floor counts replaced with **modal-per-product data entry** — tap-product-row → focused modal with 3 inputs + Save/Save & next. Floor-workflow-correct. Depends on CCP-UI-8 helper.
4. **Line-ref drift discipline** added to session-opening rules. Coupled-file sequences explicitly listed (AdminContactsView, ManagerDashboardView_v2, AdminBundlesView, ManagerOrdersView/OrdersView, AdminProductsView).
5. **§5 sequencing summary expanded** with hard dep `T5.1 depends on T2.2 + T2.6 Stage D` (all touch AdminContactsView).
6. **T2.5 Stage B isOverdue scope creep pulled out.** v1 silently changed Cancelled-overdue behavior under the guise of "intentional fix"; v2 preserves exact existing semantics. Any Cancelled-overdue change ships as a separate authorized commit.
7. **T2.6 Stage D call-site count corrected** (10 → 5; verified by code-anchor agent grep).
8. **T4.1 toggleAll call-site grep check added** (Part 3 semantic-contract divergence flagged).

**Minor (banked notes, no plan edits required):**
9. **T3.1 falsely cited CCP-UI-6.** Implementation doesn't touch TaskWidgets. Citation noted in v2 audit doc only; deep-dive implementation is correct as-is.
10. **T2.6 Stage F split recommendation** noted — 34 sites / 4 helpers in one stage with replace_all is too coarse a rollback unit. Implementing session should split into 4 sub-stages (one helper per commit) with longest-name-first ordering (already flagged in v1).
11. **RTL gaps systemic** — `data-label` content hardcoded English; `margin-left` instead of `margin-inline-start` in several CCP-UI-7-touched stages; T4.4 modal-header `text-align: center` forces center on what was RTL. Implementing session for each Tier 4 entry checks logical-properties before committing CSS.
12. **3 minor punts** identified across T1.0 / T2.5 / T2.6. Acceptable but flagged; implementing session resolves at session start.

**Acknowledged but not addressed in v2 plan changes:**
- **T5.1 maybe overweight for admin-only compliance** — flagged for future consideration; not pulled from queue.
- **T5.2 could fold into T3.1** — flagged; left standalone for change-isolation rollback granularity.
- **AdminBundles desk-only assumption** — owner may want to edit bundles on phone someday; future mobile pass possible.
- **Dashboard summary cards mobile audit** — T4.2 scoped narrow; broader audit deferred.

## 9. Review pass record

**v1 (2026-05-28).** Three expert reviews conducted in parallel via subagents (same shape as reliability audit):

1. **IA + workflow + UI plan reconciliation** — per-view inventory across 28 HTML files, manager + admin workflow maps, misplacements, UI plan positions to respect (MANAGER_UI_PLAN single-dashboard contract, LIBRARY_VIEW_PLAN additive-nav + role-gating commitments, ADMIN_VINTAGE_REVIEW_UX_PLAN deployed pattern), bundles view IA pathology, 9 consolidation opportunities surfaced.
2. **Mobile UX** — mobile-needed vs desk-only view split, per-view audit of viewport / touch targets / modal sizing / table responsiveness / RTL bidi, CLAUDE.md UI-constraint violations enumerated, `.responsive-stack` utility flagged as defined-but-unused.
3. **Optimize + speed** — top 5 speed offenders ranked (AdminProductsView.refreshView 12-call fanout / Brurya autocomplete / ManagerContact search / WebAppDashboardV2 dead SysJobQueue read / AdminBundles 4-call init), 5 consolidation opportunities, 4 sub-1-hour quick wins, 3 CCP-UI candidates extracted (load-once + client-filter, TaskWidgets adoption, shared list component).

Convergent findings: TaskWidgets adoption is the highest-leverage cross-cutting fix; load-once + client-filter is the most-impactful speed pattern; bundles view IA + the refreshView fanout are the two biggest single-target wins.

## 10. Status

### Shipped

- **T1.0 quick wins — SHIPPED 2026-05-29 @153 deploy @157.** 6 fixes: retired `SystemHealthView` stub + 7 orphan widgets (+ 3 dead `refreshSystemHealthWidget` blocks in AdminInventory); `ManagerOrders` gift-doc `btn-primary`→`btn-light`; dropped dead SysJobQueue read in `WebAppDashboardV2._getSystemHealthData_v2`; `AdminSyncView` runtime loader → scriptlet include; Brurya autocomplete CacheService projection + SheetAccessor. Backend `*WidgetData` functions left intact (one in live use by ManagerProductsView). Brurya cache rethrow-to-client error behavior preserved (deviated from sketch's `return []`).
- **T2.2 CRM nav — SHIPPED 2026-05-29 @154 deploy @158.** CRM ops moved to a collapsed `<details>` "Admin operations" panel atop AdminContactsView; handlers in a separate global `<script>` (main script is an IIFE). DevelopmentView keeps the 5 system-debug tools. Both nav entries stay (never duplicates).
- **T2.3 Orders merge — SHIPPED 2026-05-29 @154 deploy @158.** `ManagerOrdersView.html`→`OrdersView.html`, `AdminOrdersView.html` deleted, both viewMap keys route to it; Packing Slips role-gated `data-roles="manager"`. Mount guard uses `document.body.classList.contains('role-manager')` — NOT the plan's `querySelector('[data-roles="manager"]')`, which would never skip (role gating is CSS `display:none`, element stays in DOM for admin).

- **T2.5 TaskWidgets kit extend + ManagerDashboard migrate — SHIPPED 2026-05-29 @155 deploy @159.** Added `formatDateShort`/`formatDateFull`; ManagerDashboardView_v2 scriptlet include, 21 call-sites migrated, `isOverdue` inlined (exact semantics preserved), `.task-filters`→`.tw-filter-bar`.
- **T2.6 TaskWidgets adoption rollout (6 consumers) — SHIPPED 2026-05-29 @156 deploy @160.** AdminBundles / AdminInventory / ManagerContact / AdminContacts / AdminCampaigns / AdminProjects. Kit now consumed by **7 views**. `formatLastCount` + `isDateString` kept local; dead locale `formatDate` removed from AdminProjects.
- **T4.2 ManagerDashboard expanded-row mobile — SHIPPED 2026-05-29 @157 deploy @161.** Inner `.d-flex` stacks vertically on mobile; `.task-status` full-width on mobile (inline width → CSS class). Desktop unchanged.
- **Display tweaks — SHIPPED @157 deploy @161 / @158 deploy @162.** dd/mm date order kit-wide (`en-GB`; `formatDate` ISO untouched, used for `<input type=date>`). AppView mobile `.content` padding 12px→12px 6px. ManagerDashboard mobile task-list: hid Entity/Created/Link columns (kept Topic/Title/Status/Priority/Due; hidden fields remain in expanded detail). Known minor: full date slightly clips the year in expanded detail (likely padding — logged in bugs.md).

- **T3.1 AdminProducts refreshView consolidation — SHIPPED 2026-05-29 (Stage A @159, Stage B both live @163).** Backend `WebAppProducts_getAdminViewData` (`b1f96c5`, editor-tested) + frontend refactor (`02351c4`): 9 loaders + `updateNewExportUI` each take an optional preloaded-data arg (extracted inner `render()`, skip fetch); `refreshView` → one round-trip → `applyAllSections` dispatch. **Was actually 12 round-trips, not 11** — `updateNewExportUI` made a second `getLinkageTasks` call (plan v1 wrongly called it pure UI); consolidation also removes that duplicate (reuses `data.linkageTasks`). Vintage-accept splice path + no-arg fetch callers untouched. Live smoke: all 4 cards render. T5.2 left standalone (folding was flagged optional). Recipe established for T3.3 (AdminBundles).

- **T3.2 ManagerContact load-once + client filter — SHIPPED 2026-05-29 (@165 deploy @169, commit `fd8441e`).** Per-keystroke `getContactList({search})` round-trip replaced by one `getContactList({})` on mount, cached + filtered client-side (email + name; phone dropped per user, city excluded). Recent 50 render on load (new `showDefaultList()`); shared `renderContactList` helper. **Latent crash found + fixed:** `c.phone.toLowerCase()` threw on numeric phone, killing the filter — all fields now `String()`-guarded. Closes bugs.md 2026-05-15 + BUG_FIX_SEQUENCE Session G. Spun off a tooling fix: `deploy.ps1` now auto-stamps `VERSION.built` (real Israel time) + owns `clasp push`.

- **T3.3 AdminBundles init consolidation — SHIPPED 2026-05-29 (@166 deploy @170, `12eaf2f`).** 4-call `init()` fanout → one `WebAppBundles_getViewData` round-trip dispatched via `applyInitData`; 4 loaders gained optional preload (skip fetch); `renderStats` extracted; `bindEvents()` moved ahead of fetch. Built against actual **pre-T2.1** loaders (T2.1 deprioritized — no filter-chip/`allBundles` constructs). All 4 backend getters return `{error,data}`. Smoke: one `getViewData` on mount, all sections render. **Caveat logged:** consolidation removes round-trip overhead but not the server-side low-inventory compute — load still feels slow on mobile; genuine speed-up is a separate backend-perf task. Bundles cards non-mobile-friendly = accepted (desktop tool). Tier 3 (consolidation) now complete: T3.1 + T3.2 + T3.3 all shipped.

- **CCP-UI-8 ModalOverlay helper — SHIPPED 2026-05-29 (@167 deploy @171, `e368125`).** `window.ModalOverlay.open(id)/close(id)` added to TaskWidgets (reaches all 8 kit views): focus-first + restore-to-trigger, Esc-to-close, Tab/Shift+Tab focus-trap, body scroll-lock, z-index stacking. Markup unchanged — toggles display + manages focus. **First consumer:** ManagerContactView action modal — all 5 behaviors smoke-confirmed. **T4.3 and T5.1 now unblocked** (they call `ModalOverlay.open/close` instead of bare `display=flex/none`). Remaining modal-overlay consumers (AdminProducts T5.2, LibraryView, etc.) adopt incrementally as their sessions land.

§3 surfaces updated: §3.3 (orders merged), §3.12 (SystemHealthView retired), §3.13 (orphan widgets retired). **Recommended remaining order:** T4.x (T4.3 v2 modal-per-product now unblocked) → T5.x. T2.1 (bundles) deprioritized per user (desktop-only). **T5.3 shared-list-component decision reachable now** (7 kit consumers — audit filter/sort/render commonality; the consolidated-`getViewData` + optional-preload-loader pattern is now established in 3 views: AdminProducts (T3.1), ManagerContact (T3.2 `renderContactList`), AdminBundles (T3.3)).

---

Draft v2 written 2026-05-28. **17 active sessions + 1 prerequisite (CCP-UI-8 helper) + 2 deferred** across 5 tiers, anchored against actual file:line refs (with explicit drift discipline), with **9 CCP-UI patterns** including accessibility (v2 addition) and observability (v2 addition). Six-agent review across two rounds folded in; gaps explicitly resolved or queued.

**Ready to review.** Recommended first session: **Tier 1.0 quick wins batch** — 6 surgical fixes with no dependencies, immediate observable benefits (orphan widget cleanup, dead-read removal, CLAUDE.md violation fix, Brurya cache).

**For your review:**
- §3 surfaces — per-view inventory grounded in code anchors.
- §4 targets — UI-specific (tap-count, load time, lookup latency, mobile usability, modal compliance, code consolidation, dead-code reduction).
- §5 remediation — 7 CCP-UI patterns at top, then 5 tiers re-ranked to organize → optimize → mobile-ize per user direction.
- §6 ongoing assurance — UI drift discipline (CCP audit per session, monthly mobile spot-check, quarterly violation grep).
- §7 shared infrastructure reference — quick pointers for sessions.

**For decision:**
- Confirm Tier 1.0 quick wins is the right starting session.
- Approve session entry format mirroring reliability audit (same as v2.1).
- Confirm "appearance = functional, not visual design" line in §2 scope.
