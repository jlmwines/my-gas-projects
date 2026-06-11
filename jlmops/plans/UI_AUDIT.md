# JLMops UI Audit & Path Forward

This is the standing UI-patterns reference for the jlmops HtmlService views, plus the few remaining open items from the 2026-05-28 UI audit. The remediation work is **~95% shipped** (Tiers 1–5 landed 2026-05-29); what's left is a handful of small/conditional items in §3. The reusable core is the CCP-UI pattern catalog (§2) and the ongoing-assurance scheme (§4). Durable role-gating and data-fetch facts have graduated to `../docs/ARCHITECTURE.md` (§2.1.1–2.1.2); modal/button/table conventions live in `jlmops/CLAUDE.md`.

## 1. Scope

Covers all HtmlService views in `jlmops/` (`*.html`), the shared widget kit (`TaskWidgets.html`), the AppView shell, and view controllers (`WebApp*.js`) where their data-fetch shape drives UI. Reconciles against `MANAGER_UI_PLAN.md`, `LIBRARY_VIEW_PLAN.md`, `ADMIN_VINTAGE_REVIEW_UX_PLAN.md`.

Out of scope: the WordPress/theme/customer site; net-new features; a visual design-system overhaul. "Appearance" here means **functional** — visible, accessible, not overlapping, not truncated — not aesthetic redesign. The EN+HE bilingual mechanism is a constraint, not a redesign target.

## 2. Cross-cutting UI patterns (CCP-UI)

Every UI session applies these. They are the durable output of the audit.

- **CCP-UI-1 Modal pattern.** `modal-overlay` markup, driven by the shared `ModalOverlay.open(id)/close(id)` controller — never Bootstrap `$().modal()`. Source: `jlmops/CLAUDE.md` Modals rule (which now mandates `ModalOverlay`).
- **CCP-UI-2 Button discipline.** Copy an existing button class from the same file (`grep -n 'class="btn' <file>` first). Never invent `btn-primary`/`btn-secondary`/`btn-danger`. Source: `jlmops/CLAUDE.md`.
- **CCP-UI-3 Table pattern.** `table table-sm table-hover`. Many-column tables on mobile use a `table-responsive` wrapper or the `.responsive-stack` utility (`AppView.html`, with `<td data-label="…">`).
- **CCP-UI-4 Role gating.** Body class `role-admin`/`role-manager` (set in `AppView.html`) + per-element `data-roles="admin manager"` drive a role×viewport visibility matrix. A single shared view file is preferred over separate per-role files. (Graduated → `ARCHITECTURE.md` §2.1.1.)
- **CCP-UI-5 Data fetch: load-once + client-filter.** Bounded sets fetch once on mount via a per-view data provider; filter/sort/search run client-side over cached state; explicit Refresh re-fetches. No backend call per keystroke. (Graduated → `ARCHITECTURE.md` §2.1.2.)
- **CCP-UI-6 Shared widget kit.** Include `TaskWidgets.html` via `<?!= include('TaskWidgets') ?>` for any view rendering task atoms; use its `escape`/`formatDate`/`statusClass`/`priorityClass`/`dueClass` rather than re-implementing. Now consumed by 10 views.
- **CCP-UI-7 Mobile primitives.** Correct viewport meta; touch targets ≥44px; inputs `min-height:40px; font-size:16px` (defeats iOS auto-zoom); `.responsive-stack` for read-mostly many-column tables (not for data-entry tables — use a focused per-row modal); use logical CSS properties (`margin-inline-start`, not `margin-left`) so RTL mirrors; test bidi with real Hebrew at narrow widths.
- **CCP-UI-8 Accessibility & focus management.** Use `ModalOverlay` (it provides focus-first/restore, Esc-close, Tab focus-trap, body scroll-lock, z-index stacking). Interactive non-buttons (chips, tab buttons, clickable rows) get `role="button" tabindex="0"` + Enter/Space handlers; inputs paired with `<label for>`; status badges carry `aria-label`.
- **CCP-UI-9 Observability & measurement.** A session promising a perf win captures a stopwatch baseline pre-deploy and the post-deploy number in `session-log.md`. Per-view budgets: warm-cache mount ≤500ms; post-action repaint ≤200ms; client-side filter on ≤2000 items ≤50ms. Smoke explicitly opens the browser console + Network tab — "zero errors" is a checked step.

## 3. Remaining open items

Everything else shipped (see git history around 2026-05-29). Open:

- **T5.2 — AdminProductsView CLAUDE.md compliance.** Replace 3 invented `btn-primary` sites (`AdminProductsView.html:186, :590, :1420`) with bare `btn`. Modals are already `modal-overlay` (no conversion needed). ~10-minute session. Deep-dive: `UI_T5_2_admin_products_modals.md`.
- **T5.3 — Shared list component (conditional).** After ≥3 views run load-once + client-filter (now true: AdminProducts, ManagerContact, AdminBundles), evaluate extracting `TaskWidgets.bindList({items, filters, sortFields, renderRow, onRowClick})`. Only proceed if the filter/sort/render code across the 7 kit consumers actually converges. Deep-dive: `UI_T5_3_shared_list_component.md`.
- **T2.1 — AdminBundlesView restructure (deprioritized).** Filter-chip bar, hide-editor-until-row-click, relabel global actions as a System Actions footer, row-level low-stock badges. Deprioritized per user (bundles are a desktop-only tool). Deep-dive: `UI_T2_1_admin_bundles.md`.
- **T2.4 — Content Stream modal merge (deferred).** The LibraryView and AdminProjectsView modals diverge, and AdminProjectsView is slated to retire (`LIBRARY_VIEW_PLAN.md`); forcing convergence now yields single-consumer overhead. Revisit if a third consumer emerges or that retirement is cancelled. Deep-dive: `UI_T2_4_content_stream_modal.md`.

Spun off during T5.1: **`CONTACT_ACTION_RIBBON_PLAN.md`** — a unified "Make contact" outreach/record ribbon that will rework the AdminContacts action modals.

## 4. Ongoing assurance

- **Per session start.** Open the relevant UI plan, this catalog, and `jlmops/CLAUDE.md`; confirm no CCP-UI rule is being skipped under time pressure.
- **After each shipped session.** CCP audit: confirm the cited pattern was actually applied (half-applied patterns are the main source of UI debt).
- **Monthly.** Spot-check 3 mobile-needed views on a real phone — mobile drift is silent.
- **Quarterly.** Re-grep for violations: `grep -rn "btn-primary\|btn-danger\|\.modal('show')"`.
- **Annually.** Reconcile MANAGER_UI_PLAN / LIBRARY_VIEW_PLAN / this doc against shipped code; update in place.

## 5. Shared-infrastructure pointers

- **Modal-overlay + focus:** `jlmops/CLAUDE.md` Modals rule; `ModalOverlay` in `TaskWidgets.html`. Precedent: any modal in `AdminProductsView.html`, `LibraryView.html`, `ManagerContactView.html`.
- **Buttons / tables:** `jlmops/CLAUDE.md`. Grep button classes before adding one.
- **Role gating:** `AppView.html` body class + `data-roles`; precedent `OrdersView.html`, `LibraryView.html`. (`ARCHITECTURE.md` §2.1.1.)
- **TaskWidgets kit:** include via scriptlet (precedent `LibraryView.html`); atoms/helpers documented in the file header.
- **Load-once + client-filter:** precedent `AdminContactsView.html`, `LibraryView.html`. (`ARCHITECTURE.md` §2.1.2.)
- **Mobile primitives:** `AppView.html` — viewport, `.responsive-stack`, sidebar collapse + backdrop, 44px targets, 40px/16px inputs.
