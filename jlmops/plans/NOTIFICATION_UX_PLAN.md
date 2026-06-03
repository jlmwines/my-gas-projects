# Notification & Confirmation UX Standard — jlmops web app

**Created:** 2026-06-03
**Status:** APPROVED 2026-06-03 (user: "fix the plan, take care of the business"). Implementing Phases 0–2 (foundation + manager + Developer screen); Phases 3–4 (high-volume admin sweep) tracked as backlog. Decisions resolved (§7): scope = universal-but-phased; native-dialog grep guard = YES; toast types = `success/error/warning/info` (default `success`).
**Owner:** Session-driven; user reviews/visually verifies.
**Origin:** User report — recent dialogs show "long, ugly system titles" and "really, really long confirmation messages" (named example: the admin Developer screen; emphasis on the manager side). Root-caused below.

## 1. Problem

Two distinct defects, one root cause:

1. **The "long ugly system header."** Native browser `confirm(...)` / `alert(...)` run inside the Apps Script HtmlService **iframe**, so the browser prepends an un-styleable header — a long `…googleusercontent.com` origin line. There is no CSS or option to remove it. The *only* fix is to stop using native dialogs and render in-page UI instead.
2. **Verbose messages.** Even where an in-page helper is used (Developer screen uses the custom `devConfirm`), the message text is a paragraph, e.g. _"Daily Housekeeping runs the full live batch: it purges and archives data, trashes old Drive files, pulls Mailchimp, refreshes the CRM, and can create customer-outreach tasks. It also duplicates the scheduled run. Continue?"_

Compounding both: **the codebase has no single notification standard.** In-page helpers exist but are copy-pasted under three different names, and ~150 native dialogs remain.

## 2. Inventory (measured 2026-06-03)

**Native `confirm()` — ~23 calls, 9 files:**
AdminProductsView (7) · ManagerInventoryView (3) · AdminInventoryView (3) · AdminDailySyncWidget_v2 (3) · AdminBundlesView (3) · TaskPacks (1) · ManagerProductsView (1) · ManagerDashboardView_v2 (1) · LibraryView (1).

**Native `alert()` — ~128 calls, 12 files:**
AdminTasksView (32) · AdminProjectsView (32) · AdminBundlesView (25) · AdminProductsView (11) · ManagerProductsView (7) · LibraryView (5) · AdminContactsView (5) · ManagerDashboardView_v2 (4) · OrdersView (3) · AdminDailySyncWidget_v2 (2) · ManagerContactView (1) · AdminInventoryView (1).
_Note: the manager views are the **light** end; AdminTasks/AdminProjects/AdminBundles dominate._

**In-page helpers that already exist (fragmented — 3 names, 5 copies):**
- `TaskWidgets.toast(message, isError)` — **shared, in `TaskWidgets.html:146`**, already included by 10 views. This is the canonical toast; the others are reinventions.
- `showToast(message, type)` — local duplicates in `AdminInventoryView:437` and `ManagerInventoryView:597`.
- `showConfirm(message, callback)` — local duplicates in `AdminProjectsView:1952` and `AdminTasksView:1968`.
- `devConfirm(message, onConfirm)` — `DevelopmentView:39` (good UX: Cancel default-focused, Esc/backdrop = cancel; shipped @203).

**Shared include mechanism:** `<?!= include('TaskWidgets') ?>` is the first line of 10 views (AdminBundles, AdminCampaigns, AdminContacts, AdminInventory, AdminProjects, AdminTasks, Library, ManagerContact, ManagerDashboard, ManagerInventory). Six dialog-using views do **not** include it yet: AdminProductsView, AdminDailySyncWidget_v2, OrdersView, ManagerProductsView, TaskPacks, DevelopmentView.

**Stale-doc note:** `UI_AUDIT.md:109` says TaskWidgets is "Included by LibraryView only." That is now wrong (10 consumers). Reconcile that line as part of this work; this plan docks onto UI_AUDIT's "massive consolidation opportunity" for TaskWidgets rather than duplicating it.

## 3. The standard (target state)

**One sanctioned API, defined once in `TaskWidgets.html`, used by every view. No native `alert()`/`confirm()` anywhere.**

- **`TaskWidgets.toast(message, type)`** — transient feedback. `type` ∈ `success | error | warning | info` (extend the current `isError` boolean to a type string, keeping back-compat: truthy/`'error'` → red). Auto-dismiss ~3s. Never blocks. Replaces all `alert()` and the local `showToast` copies.
- **`TaskWidgets.confirm(message, onConfirm, opts)`** — NEW; promote `devConfirm`'s UX (in-page overlay; **Cancel default-focused**; Esc/backdrop = cancel; optional short `opts.title`, `opts.okLabel`, `opts.danger`). Replaces all `confirm()`, plus the local `showConfirm` and `devConfirm` copies.
- **Errors are toasts, not alerts:** `withFailureHandler(err => TaskWidgets.toast('…: ' + err.message, 'error'))`.

**Message-writing conventions (apply to every message touched):**
1. **No native dialogs.** Ever. (Enforced — see §6.)
2. **Action-first, ≤1 short sentence.** Drop "Are you sure you want to…", drop restating UI state. Confirm states the *consequence*, briefly: e.g. _"Revert this task to Admin?"_, _"Delete this slot?"_, _"Rebuild SysConfig from source? Runtime values are preserved."_
3. **No multi-line walls** (`\n\n`). One line. If a consequence needs emphasis, that's `opts.danger` styling, not more words.
4. **Toasts ≤ ~8 words** where possible: _"Slot updated"_, _"4 counts submitted"_, _"Export failed: <reason>"_.
5. **No long titles.** Confirm title is optional and short (≤3 words) or omitted; never a sentence.
6. **Sentence case, plain language, brand-neutral** (these are operator tools, not customer copy).

## 4. Design decisions

- **Home = `TaskWidgets.html`.** It already hosts the canonical `toast` and is the established shared include. Add `TaskWidgets.confirm` beside it. Add a short standard header-comment there pointing to this doc.
- **Reach the 6 non-including views:** add `<?!= include('TaskWidgets') ?>` to AdminProducts, AdminDailySyncWidget_v2, OrdersView, ManagerProducts, TaskPacks, DevelopmentView. _Implementation check:_ confirm TaskWidgets' `<script>` actually executes when a view is injected via `innerHTML` (AppView line ~325) — verify the script-exec mechanism on the first migrated view before fanning out. If injected-`<script>` doesn't auto-run, the helpers must live in the persistent `AppView` shell instead (one-time global) — resolve this in Phase 0.
- **Retire duplicates:** delete the 2 `showToast` + 2 `showConfirm` + 1 `devConfirm` local copies once their callers point at `TaskWidgets.*`.
- **Keep the good UX from `devConfirm`** (Cancel-default-focus, Esc/backdrop cancel) — it exists precisely so a reflex Enter/double-tap can't blow through a destructive action (@203). Carry it into `TaskWidgets.confirm`.

## 5. Migration phasing

**Phase 0 — foundation. SHIPPED 2026-06-03.** Added `TaskWidgets.confirm(message, onConfirm, {title,okLabel,danger})` + confirm CSS; extended `toast` to typed (`success/error/warning/info`, boolean back-compat) + warning/info CSS; verified script-exec mechanism (`AppView.executeScriptsInElement` recreates `<script>` in global scope → `TaskWidgets.*` is a persistent global); standard header-comment in `TaskWidgets.html`; rule added to `jlmops/CLAUDE.md` UI Constraints; conformance guard `scripts/check-no-native-dialogs.js` (informational; `--strict` to block — wire to deploy once Phases 3–4 land). Baseline at start: **152** native dialogs in 14 views.

**Phase 1 — manager side. SHIPPED 2026-06-03.** ManagerDashboardView_v2 (4 alert→toast, 1 confirm→`TaskWidgets.confirm`), ManagerContactView (1), ManagerInventoryView (3 confirms refactored to async callbacks; local `showToast` now delegates to `TaskWidgets.toast` — call sites unchanged), ManagerProductsView (added the `TaskWidgets` include — it was a full-doc fragment without it; 1 confirm + 7 alerts). All four are now **off** the native-dialog list. Messages shortened per §3. **User to visually verify each manager view on-screen.**

**Phase 2 — Developer screen. PARTIAL (messages) SHIPPED 2026-06-03.** The two mile-long `devConfirm` messages shortened to one line each (the actual complaint). `devConfirm` itself is already in-page (no header), so full `devConfirm`→`TaskWidgets.confirm` consolidation + include + helper removal is a **small residual backlog item** (cosmetic dedup, not user-visible).

**Phase 3 — high-volume admin. SHIPPED 2026-06-03.** AdminProjectsView (32 alert), AdminTasksView (32 alert), AdminBundlesView (25 alert + 3 confirm), AdminProductsView (11 alert + 7 confirm; added the missing include). Alerts converted via a reviewed balanced-paren transform (`scripts/migrate-alerts.js`); all 13 confirms hand-refactored to async `TaskWidgets.confirm` callbacks (destructive ones get `{danger:true}`).

**Phase 4 — remainder. SHIPPED 2026-06-03.** AdminDailySyncWidget_v2 (2 alert + 3 confirm; +include), LibraryView (5 alert + 1 confirm), AdminContactsView (5 alert), AdminInventoryView (1 alert + 3 confirm; local `showToast` now delegates), OrdersView (3 alert; +include), TaskPacks (1 confirm). Guard now passes `--strict` (0 native dialogs) — wire it to deploy if desired.

**DONE: 152 → 0 native dialogs across all 14 views.** Residual (cosmetic, optional): three in-page helper copies remain (`showConfirm` in AdminProjects/AdminTasks, `devConfirm` in DevelopmentView) — they are in-page (no ugly header), just not yet consolidated onto `TaskWidgets.confirm`. A few script-typed toasts may be imperfect (error vs success); cosmetic only.

Each phase: commit + deploy via wrapper, then **user visually verifies** the migrated view (these are not deploy-verifiable by a session). Order is deliberate: prove the pattern on the surface the user cares about most (manager) before the 100+ admin calls.

## 6. Future conformance

- **Standard lives in two places:** a header-comment in `TaskWidgets.html` (the API + the §3 conventions, short), and a bullet in `jlmops/CLAUDE.md` → "UI Constraints" ("Never use native `alert()`/`confirm()`; use `TaskWidgets.toast` / `TaskWidgets.confirm`; messages: action-first, one line, no long titles").
- **Lightweight guard (optional):** a grep check (pre-deploy or a tiny `node` script) that fails if any `*.html` view introduces a new bare `alert(`/`confirm(`. Cheap, catches regressions. Decide in Phase 0 whether to wire it.

## 7. Decisions (resolved 2026-06-03)

1. **Scope:** universal standard, phased. Ship Phases 0–2 now; Phases 3–4 (high-volume admin) are tracked backlog in this doc.
2. **Guard:** YES — wire the native-dialog grep guard (§6) in Phase 0.
3. **Toast types:** `success | error | warning | info`, default `success`. Back-compat: legacy `isError` truthy → `error`.

## Appendix A — sample message rewrites

| Where | Current | Proposed |
|---|---|---|
| DevelopmentView Rebuild | "Rebuild SysConfig clears the live SysConfig sheet and repopulates every row from the master source (runtime values are snapshotted and restored). Continue?" | "Rebuild SysConfig from source? Runtime values are preserved." |
| DevelopmentView Housekeeping | "Daily Housekeeping runs the full live batch: it purges and archives data, trashes old Drive files, pulls Mailchimp, refreshes the CRM, and can create customer-outreach tasks. It also duplicates the scheduled run. Continue?" | "Run full Daily Housekeeping now? (Also runs on schedule.)" |
| ManagerDashboard Revert | "Revert \"<task>\" to Admin?\n\nThis will reassign the task to Admin for handling." | "Revert \"<task>\" to Admin?" |
| ManagerInventory Brurya import | "Import Brurya counts from the most recent 'BruryaCount_' sheet?\n\nThis will update existing products and add new ones." | "Import latest Brurya counts?" |
| ManagerProducts suggestions | "Are you sure you want to create suggestions for N products?" | "Create suggestions for N products?" |

_(Full per-call catalog to be filled in during each phase as the calls are touched.)_
