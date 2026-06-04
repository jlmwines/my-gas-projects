# Reload Resilience — surviving accidental back/refresh

**Created:** 2026-06-03
**Status:** **A0 SHIPPED 2026-06-04 (deploy @224).** `ManagerInventoryView` count entry autosaves to `sessionStorage` on every edit and rehydrates on render — survives same-tab pull-to-refresh / back (the reported mobile case). **Pending the on-phone empirical check (§4.A0)** — verify a real-device round-trip. Option A (server-side draft, durable across tab-close / device-switch) remains **deferred** behind A0, prerequisites in §4.A.
**Owner:** Session-driven; user reviews / visually verifies.
**Origin:** User report — an accidental browser **back** gesture or **pull-to-refresh** (easy on mobile) reloads the app and loses in-progress work.

## 1. Problem

The jlmops web app is a single-page app served by Apps Script `HtmlService` in `SandboxMode.IFRAME` (`WebApp.js doGet`). A reload re-runs `doGet`, lands on the **default dashboard**, and discards all client state. The worst-hit workflow is **inventory count entry**.

## 2. Current state (verified 2026-06-03)

- **View state is in-memory only.** A reload returns to the default view; in-memory state (current view, entered-but-unsubmitted counts) is lost.
- **Count entry is NOT incrementally persisted.** `saveCountEntry()` / the **"Save & next"** button only copy modal values into the **hidden DOM row inputs** (`ManagerInventoryView.html:405`) — no server call. The only server write is the **batch** `WebAppInventory_submitInventoryCounts()` (`WebAppInventory.js:322`), fired by **"Submit Selected Counts."** So **every entered count lives only in the DOM until batch Submit; a reload before Submit loses all of it.**
- **Web storage works here.** `ManagerInventoryView` itself uses none, but the app overall uses `sessionStorage` ~21× across 7 views — so it functions in this iframe (see §3).

## 3. Constraints

- **Can't block back/refresh** — the browser/OS owns the gesture (mobile especially).
- **`beforeunload` is unreliable** on mobile and in the sandbox → treat as a desktop-only seatbelt.
- **`sessionStorage` works in this iframe** — proven by ~21 live uses across 7 views (Admin/Manager dashboards, Tasks, Projects, Library, ManagerContact, ManagerProducts). It **survives a same-tab reload / pull-to-refresh** (cleared only on tab close) — which is the dominant accidental case. (Third-party-storage blocking is a theoretical mobile risk but untested against the app's own working evidence — don't assume it fails.)
- **Net:** design for **cheap recovery**, not prevention. `sessionStorage` covers the common case for near-zero cost; server-side is the durable backstop.

## 4. Options

### A0. `sessionStorage` autosave — cheapest; covers the dominant case (do FIRST)
Mirror count-entry DOM state into `sessionStorage` on every Save / input; rehydrate on view load.
- **Why it likely works:** `sessionStorage` is proven in this iframe and survives same-tab pull-to-refresh — the reported case. No new endpoint, no draft store, no server change, no partial-submit entanglement. ~10–20 lines in `ManagerInventoryView`.
- **Does NOT survive:** tab close, a back-gesture that discards the tab, mobile low-memory eviction. "Covers most, cheaply," not bulletproof.
- **Empirical check first (~5 min):** on a real phone, enter counts → pull-to-refresh → confirm a `sessionStorage` round-trip rehydrates. If yes, A0 may be the whole fix.

### A. Server-side draft autosave — durable but heavier (deferred behind A0)
Persist each row to a server-side draft so recovery survives even tab-close / device-switch.
- **Store:** default `CacheService` user cache (already used by 4 services; no live-data writes). Hard TTL **6h** — so a count session paused overnight loses its drafts. **Cutover:** if count workflows routinely run > a few hours / span a day, move to a durable `SysCountDraft` sheet (or scratch columns on the count task), same key scheme.
- **Key / payload:** `countdraft:<activeUserEmail>:<taskId>` → `{ storage, office, shop, vintage, comment, selected, v }`. `selected` restores the submit-checkbox state; `v` is a draft schema version (new code ignores incompatible old drafts after a form change — see §6). Staleness is task-presence-based (rehydrate only rows whose task is still open).
- **Flow:** Save → `WebAppInventory_saveCountDraft(taskId, payload)`; view load → `getCountDrafts()` rehydrates open-task rows; batch Submit → clear drafts per successfully-submitted task.
- **BLOCKER — server changes are prerequisites** (failure model verified §Appendix). Today `WebAppInventory_submitInventoryCounts` returns only a count (no per-task results), and `updatePhysicalCounts` returns `{success:true}` or **throws** — so a real item failure **aborts the whole batch** to `withFailureHandler` *after* earlier items already committed (written + flipped to `'Review'`). True hazard: **a partial commit shown to the operator as a total failure.** Prereqs, in order:
  1. **Per-item try/catch** in the submit loop — turn a single throw into a captured per-item failure instead of aborting the batch.
  2. **Return succeeded + failed taskId arrays** (possible only after #1) — client clears only committed drafts and surfaces failures.
  3. **Resubmit idempotency** — re-submitting after a partial commit must not re-process already-committed items / re-`'Review'` their tasks (e.g. skip tasks already at `'Review'`/Done).

### B. Restore-context breadcrumb (optional)
Persist current view + key IDs so reload returns to context instead of the default dashboard. Server breadcrumb (`CacheService`) is the reliable store. Medium value; pairs with A0/A.

### C. `beforeunload` desktop seatbelt (cheap complement)
"Unsaved changes" prompt when a count/edit form is dirty. Helps on desktop, ignored on mobile. Low effort.

### D. NON-GOAL — trapping the back button
Pushing history to intercept back fights the platform and frustrates users. Don't.

## 5. Recommendation (plan of record)

1. **A0 phone check (~5 min)** — the gating step.
2. **Build A0** if it passes (client-side `sessionStorage`, no server change).
3. **Option A only for the gaps A0 misses** (tab close / device switch) — blocked on its §4.A prerequisites; don't start until A0's coverage is judged insufficient.
4. **Add C** as a cheap desktop seatbelt.
5. **B optional** — only if landing-on-dashboard disorientation is an actual complaint.
- Extend the winning pattern to other multi-field batch-submit forms (`AdminProductsView` detail edits, project/task create) once proven on count entry.

## 6. Intentional refresh & going back (the flip side — recovery must not become a trap)

- **Intentional refresh to get a new app version — already works.** A refresh re-runs `doGet` → serves the **current deployed version**, so the user gets new code; recovery just re-fills in-progress counts on top. Two additions keep it clean: a **"Discard / start fresh"** control (clear the draft for a genuine clean slate), and the **draft version tag `v`** (new code ignores an incompatible old draft after a form-shape change, rather than mis-rehydrating).
- **Deliberate "go back a screen" — browser-back is the wrong tool here, by architecture.** Verified: **no `history.pushState`/`popstate`** anywhere — navigation is in-app `loadView('X')` swapping the content div, so the browser holds no per-view history; browser-back exits/reloads the iframe (destructive). So "going back" must be **in-app**: the nav sidebar, or a contextual in-app **Back** button (the Library entity-drawer back-stack is the pattern to copy). If a surface lacks an obvious way back and operators reach for browser-back, **add an in-app Back there**. Optional larger enhancement: real `pushState` history (push per view, `popstate` → `loadView`) so browser-back navigates views naturally — its own piece of work; separate decision, not a default.

## 7. Open questions

1. **Scope:** count entry first, or also the admin edit/create forms (`AdminProductsView` detail edits) in the same effort? Recommend count entry first; extend after it's proven.
2. **Restore-to-last-view (B):** worth the breadcrumb, or is only the data loss (A0/A) the real pain?

## Appendix — review history & key corrections (2026-06-03)

Three independent red-team passes converged the plan; each caught a real issue, two of which were errors carried forward in earlier drafts. Settled conclusions (verified against code):

- **Storage (review 2).** Earlier "client storage is unreliable in this iframe / none in use" was wrong app-wide: the app uses `sessionStorage` ~21× across 7 views and it works. `sessionStorage` survives same-tab refresh → A0 added as the cheap primary path and the recommendation re-ranked. (The inventory view itself uses none — that narrow true fact was over-generalized.)
- **Failure model (review 3).** Earlier "submit silently returns success on partial failure" was wrong: `updatePhysicalCounts` (`InventoryManagementService.js:495–603`) returns `{success:true}` or **throws** (never `success:false`), so the submit `else` branch is dead and a real failure **aborts the whole batch after partial commits**. True hazard = partial-commit-as-total-failure. Option A's prereqs corrected to per-item try/catch + succeeded/failed arrays + resubmit idempotency.
- **Submit response shape (review 2).** Returns only `{ success, updated, vintageTasksCreated }` — no per-task results, so the clear-per-task logic needs the server change above.

Spot-checked: `WebApp.js`, `ManagerInventoryView.html`, `WebAppInventory.js:322–378`, `InventoryManagementService.js:495–603`. Read-only.
