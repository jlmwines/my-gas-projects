# Reload Resilience — surviving accidental back/refresh

**Created:** 2026-06-03
**Status:** **NOT build-ready — approach being reconsidered (2026-06-03).** A second independent red-team (§8) was correct on every point and re-ranked the solution. Two real errors in the earlier drafts were corrected: (a) §4.A wrongly assumed the submit response gives per-item success — it returns only a count, so per-task draft-clearing needs a SERVER change; (b) the storage constraint was overstated — the app **already uses `sessionStorage` 23× across 7 views**, proving web storage works in this iframe, which opens a far cheaper **sessionStorage-first** fix (new §4.A0). Recommendation re-ranked in §5. Do the §4.A0 empirical check before committing to the server build.
**Owner:** Session-driven; user reviews / visually verifies.
**Origin:** User report — an accidental browser **back** gesture or **pull-to-refresh** (very easy on mobile) reloads the whole app and loses in-progress work. Asked for solutions.

## 1. Problem

The jlmops web app is a single-page app served by Apps Script `HtmlService` in **`SandboxMode.IFRAME`** (`WebApp.js doGet`). A reload re-runs `doGet`, which lands on the **default dashboard** and discards all client state. On mobile, back/refresh gestures are one stray swipe away, so this happens in normal use.

The worst-affected workflow is **inventory count entry.**

## 2. Current state (verified 2026-06-03, not assumed)

- **App state is in-memory only.** View JS holds state in plain objects (e.g. `state.tasks`, `state.expandedTaskId`); a reload re-fetches from the server and returns to the default view. Nothing is persisted client-side.
- **Count entry is NOT incrementally persisted.** In `ManagerInventoryView.html`:
  - `saveCountEntry()` (`:405`) — and the **"Save & next"** button — only copy the modal's values into the **hidden DOM row inputs**, then close the modal. **No server call.**
  - The only server write is the **batch** `WebAppInventory_submitInventoryCounts()` (`:471`/`WebAppInventory.js:322`), fired by **"Submit Selected Counts."**
  - **Therefore: every entered count lives only in the DOM until the final batch Submit. A reload before Submit loses all of it.**
- **No client storage in use.** No `localStorage` / `sessionStorage` in the inventory view. (Correcting an earlier session overstatement that "Save & next persists" — it does not.)

## 3. Constraints (why the obvious fixes are weak here)

- **You cannot block back/refresh.** The browser/OS owns those gestures; mobile especially.
- **`beforeunload` is unreliable.** Many mobile browsers ignore the "leave site?" prompt, and inside a sandboxed third-party iframe it's weaker still. Treat it as a desktop-only seatbelt, not a guarantee.
- **Web storage in the iframe — CORRECTED 2026-06-03.** An earlier draft claimed `localStorage` is unreliable here and "no client storage is in use." That was overstated: the app uses **`sessionStorage` 23× across 7 views** (Admin/Manager dashboards, Tasks, Projects, Library, ManagerContact, ManagerProducts) and those are live, working features — so web storage **does** function in this iframe. (ManagerInventoryView itself happens to use none, which is why the narrow original observation was locally true but wrongly generalized.) The third-party-blocking risk is real on some privacy modes but is **untested against the app's own working evidence** — don't assume it fails. **Crucially: `sessionStorage` survives a same-tab reload / pull-to-refresh** (it's cleared only on tab close), which is the dominant accidental case — see §4.A0.
- **Net:** design for **cheap recovery**. Server-side is the *most durable* place, but `sessionStorage` likely covers the common case for near-zero cost (§4.A0).

## 4. Options (ranked by robustness in this environment)

### A0. Client-side `sessionStorage` autosave — cheapest; covers the dominant case (NEW, per §8 red-team — evaluate FIRST)
Mirror the count-entry DOM state into `sessionStorage` on every Save / input, and rehydrate from it on view load.
- **Why it likely works here:** the app already uses `sessionStorage` 23× in 7 views (proven in this iframe), and `sessionStorage` **survives a same-tab reload / pull-to-refresh** — which IS the accidental case the user reported. No new endpoint, no draft store, no server change, no partial-submit entanglement. ~10–20 lines in `ManagerInventoryView`.
- **What it does NOT survive:** tab close, a back-gesture that discards the tab, and mobile low-memory tab eviction. So it's "covers most, cheaply," not bulletproof.
- **Empirical check before anything else (~5 min):** on a real phone, enter counts → pull-to-refresh → confirm whether a quick `sessionStorage.setItem`/`getItem` round-trip rehydrates. If yes, A0 may be the whole fix; A becomes the optional durability upgrade for the rarer cases.

### A. Server-side per-row autosave for count entry — the durable (but heavier) fix
Make `saveCountEntry` / "Save & next" actually persist each row to a **server-side draft**, so recovery survives even tab-close / device-switch (the cases A0 misses).

**Store decision (resolved — review fix #3).** Default to **`CacheService` user cache** (already used by 4 services; no live-data writes). Hard TTL is **6h** (CacheService max), so state the cutover explicitly: **a count session that pauses past ~6h or spans overnight silently loses its drafts** — the exact failure this plan exists to prevent. **Cutover trigger:** if real use shows count workflows routinely running > a few hours or across a day (e.g. a full-warehouse count), move drafts to a **durable store** — a dedicated `SysCountDraft` sheet (or scratch columns on the count task) keyed the same way. Start on `CacheService`; the key scheme below is store-agnostic so the cutover is a swap, not a redesign.

**Key + payload (review fix #2).** One draft per (operator, count task):
- Key: `countdraft:<activeUserEmail>:<taskId>` (taskId is the stable handle; SKU is derivable from the task).
- Payload: `{ storage, office, shop, vintage, comment, selected }` — `selected` carries the **submit-checkbox state** (otherwise lost on reload). Staleness is task-presence-based (rehydrate only rows whose task is still open), so no `ts` key is needed.

**Flow.**
- **Save / Save & next** → `WebAppInventory_saveCountDraft(taskId, payload)` (awaited).
- **View load** → `getCountDrafts()` returns the operator's drafts; rehydrate **only** rows whose `taskId` is still present + open in the freshly-loaded count list (drop any draft whose task is gone/Done so a stale draft can never resurrect a completed row).
- **Batch Submit** → clear drafts **per successfully-submitted task only**.

**BLOCKER (§8) — server change required first.** This clear-per-task logic is **not implementable as-is**: `WebAppInventory_submitInventoryCounts` returns only `{ success:true, updated:<count>, vintageTasksCreated }` (`WebAppInventory.js:373`) — a count, no per-task succeeded/failed list. Two server changes are prerequisites:
1. Have submit **return the succeeded + failed taskId arrays** so the client can clear only committed drafts.
2. **Surface partial failure** — today a per-item failure just `LoggerService.warn`s and `return`s while the outer call still returns `success:true` and the UI toasts "N submitted" + reloads. The draft feature must show which items failed, not silently keep their drafts.

**Cost:** new endpoint pair (save + get) + the two server changes above + clear-on-submit wiring + rehydrate-on-load; a server round-trip per Save. Heavier than A0 — justified only for the cases A0 misses (tab close / device switch).

### B. Restore-context breadcrumb
Persist "current view + key IDs" so a reload returns you where you were instead of the default dashboard.
- **Where:** best-effort `localStorage` (cheap, may fail on mobile) **or** a per-user server breadcrumb (`CacheService`) read in the bootstrap. Given the iframe storage caveat, server-side is the reliable option.
- **Value:** medium — removes the "I'm back at the dashboard" disorientation. Pairs naturally with A.

### C. `beforeunload` dirty-form seatbelt (desktop)
Show the browser "unsaved changes" prompt when a count/edit form is dirty.
- **Value:** partial — helps on desktop, mostly ignored on mobile. **Low effort**, so worth adding as a complement to A, not a substitute.

### D. Non-goal — trapping the back button
Pushing history entries to intercept back fights the platform, breaks expected navigation, and frustrates users. **Do not do this.**

## 5. Recommendation (re-ranked 2026-06-03 per §8)

1. **Do the A0 empirical check first** (~5 min on a phone). `sessionStorage` survives same-tab pull-to-refresh and is already proven to work in this app — if it rehydrates count entry, **A0 is likely the whole fix** for the reported case, at near-zero cost and risk.
2. **Build A0** if the check passes — client-side `sessionStorage` autosave in `ManagerInventoryView`. No server change, no draft store.
3. **Reach for A (server autosave) only for the gaps A0 can't cover** (tab close, device switch). It is heavier and **blocked on a server change** (per-task submit results + surfacing partial failure) — don't start it until A0's coverage is judged insufficient.
4. **Add C** (desktop `beforeunload` seatbelt) as a cheap complement.
5. **B is optional** — only if context-loss disorientation is an actual complaint.
- Apply the winning pattern to other multi-field batch-submit forms (`AdminProductsView` detail edits, project/task create) once proven on count entry.

## 6. Open questions

1. ~~Draft store for A~~ — **RESOLVED (§4.A): `CacheService` default + stated cutover to durable `SysCountDraft` if sessions span >~6h/overnight.**
2. ~~Selection-state restore~~ — **RESOLVED (§4.A): `selected` flag in the draft payload restores the submit checkboxes.**
3. Scope: count entry only first, or also the admin edit/create forms (`AdminProductsView` detail edits) in the same effort? Recommendation: count entry first; extend after it's proven.
4. Is landing on the default dashboard (B) actually a complaint, or is only the *data loss* (A) the pain? Drives whether B is worth the server breadcrumb.

## 7. Review — needs-revision (2026-06-03)

Fresh-eyes review (Dispatch session). **Verdict: needs-revision — close to ready.** Diagnosis is sound and every load-bearing code reference was spot-checked and holds: reload→`doGet`→default-view reset (`WebApp.js:35,50`); `saveCountEntry()` is client-only with no server call (`ManagerInventoryView.html:405–430`); the only write is batch `WebAppInventory_submitInventoryCounts()` (`WebAppInventory.js:322`); and there is genuinely zero client storage (`localStorage`/`sessionStorage`) anywhere in the app, so the data-loss diagnosis is correct, not overstated. `CacheService` is already used in 4 services, so Option A's draft store is consistent with existing patterns. Option ranking is right for this GAS environment.

**Top 3 to fix before build:**

1. **Partial-submit handling (biggest gap).** Submit is per-item (`forEach` → `updatePhysicalCounts`, counts only successes), so a partial failure is real — but §4.A clears drafts wholesale on "Submit success." Specify: clear only the *successfully-submitted* task drafts, and define a staleness rule so rehydrate never resurrects rows for tasks already completed/removed.
2. **Cache key scheme + selection state.** Specify the draft key (per-user × taskId/sku). Also: the "selected for submit" checkbox state is lost on reload too and isn't covered by the draft signature — decide whether to restore it.
3. **Resolve the Option-A store decision with a concrete trigger** (Open-Q #1), don't leave it open. `CacheService` ~6h TTL means a count session left overnight silently loses its drafts — exactly the failure this plan exists to prevent. State the cutover condition to durable storage (scratch columns/sheet).

**Risk/sequencing otherwise safe:** rehydrate-on-load and the `CacheService` path touch no live data; only the durable-scratch variant writes live count state, and the plan correctly recommends `CacheService` first. Sources: this doc; spot-checked `WebApp.js`, `ManagerInventoryView.html`, `WebAppInventory.js`.

**Resolution (2026-06-03):** all 3 fixes folded into §4.A — (1) partial-submit handled by clearing drafts per-successfully-submitted-task + a rehydrate guard that only restores rows whose task is still open; (2) key `countdraft:<user>:<taskId>` + a `selected` flag restoring submit-checkbox state; (3) store resolved to `CacheService` default with an explicit cutover to a durable `SysCountDraft` if count sessions span >~6h. Open-Qs trimmed to the two genuine product decisions (scope, whether B is wanted). Plan is build-ready pending user go.

## 8. Second (independent red-team) review — needs-revision, NOT yet ready (2026-06-03)

Independent second pass after the §7 Resolution claimed build-ready. **Verdict: needs-revision — the "ready" claim is premature.** Architecture/ranking are sound (not a rethink), but two issues survive, one a hard build blocker:

1. **BLOCKER — fix #1's mechanism is not implementable as written.** §4.A assumes the submit response distinguishes per-item success so the client can clear only committed drafts. It does **not**: `WebAppInventory_submitInventoryCounts` returns only `{success:true, updated:<count>, vintageTasksCreated}` (`WebAppInventory.js:373`) — a count, no per-task succeeded/failed list. "Clear only successfully-submitted drafts" therefore requires a **server change** (return succeeded/failed taskId arrays) before it can work. Must fix before build.
2. **Partial-failure is silent today.** On a per-item failure the `forEach` just `return`s and the outer call still returns `success:true`; the UI toasts "N submitted successfully" and reloads (only a `LoggerService.warn` records the failure). The draft feature must **surface** failed items, not merely preserve their drafts.
3. **Storage overstatement (correcting §2/§7 AND the first review).** "Zero client storage anywhere in the app" is **false** — `sessionStorage`/`localStorage` are used in ≥7 views (Manager/Admin dashboards, ManagerProducts, etc.). This matters two ways: the app already runs web storage in the GAS iframe (so §3's "localStorage silently fails on mobile" is at least untested against the app's own evidence), and **`sessionStorage` survives a same-tab pull-to-refresh** — the exact worst case — so a far cheaper client-side recovery may exist. Do a ~5-min empirical check before committing to the full server-autosave build.

Minor: multi-device same operator → CacheService user cache is shared server-side = last-write-wins, no merge (acceptable, note it). The `ts` staleness key is vestigial — the actual rule is task-presence-based.

Sources: this doc; spot-checked `WebApp.js`, `ManagerInventoryView.html`, `WebAppInventory.js`. Read-only.

## 9. Resolution of the §8 red-team (2026-06-03)

Verified all three points against code — **all correct**; the §7 "build-ready" claim was premature and is retracted.
1. **Per-item submit results — confirmed.** `WebAppInventory.js:373` returns only `{ success, updated, vintageTasksCreated }`. §4.A now flags this as a **server-change prerequisite** (return succeeded/failed taskId arrays) before the clear-per-task logic can work.
2. **Silent partial failure — confirmed** (per-item `LoggerService.warn` + `return`, outer `success:true`). §4.A now requires **surfacing** failed items.
3. **Storage overstatement — confirmed and corrected.** Grep: **23 `sessionStorage` uses across 7 views, 0 `localStorage`.** §2/§3 corrected; the cheaper **§4.A0 sessionStorage-first** option added and the recommendation re-ranked to evaluate it first.
- **Minor noted:** multi-device same operator on the server path = `CacheService` user cache is shared = last-write-wins, no merge (acceptable; note at build). Vestigial `ts` key dropped (staleness is task-presence-based).

**Status: approach re-ranked; A0 empirical check is the next concrete step before any build.**
