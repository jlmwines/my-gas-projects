# Reload Resilience — surviving accidental back/refresh

**Created:** 2026-06-03
**Status:** Reviewed (needs-revision) → **revised 2026-06-03; ready for build decision.** The review's 3 fixes are folded into §4.A (partial-submit per-task clear + rehydrate staleness guard; cache key scheme + selection-state restore; store decision resolved with a stated cutover). Implementation still pending user go.
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
- **`localStorage` is unreliable in the GAS iframe.** The app runs as a third-party iframe; Safari/iOS and other privacy modes block third-party storage, so client persistence can silently fail on exactly the mobile devices most at risk. Do not depend on it for the durable path.
- **Net:** design for **cheap recovery**, not prevention. The robust place to persist is **server-side**.

## 4. Options (ranked by robustness in this environment)

### A. Server-side per-row autosave for count entry — the real fix (recommended)
Make `saveCountEntry` / "Save & next" actually persist each row to a **server-side draft**, so a reload rehydrates the entered counts.

**Store decision (resolved — review fix #3).** Default to **`CacheService` user cache** (already used by 4 services; no live-data writes). Hard TTL is **6h** (CacheService max), so state the cutover explicitly: **a count session that pauses past ~6h or spans overnight silently loses its drafts** — the exact failure this plan exists to prevent. **Cutover trigger:** if real use shows count workflows routinely running > a few hours or across a day (e.g. a full-warehouse count), move drafts to a **durable store** — a dedicated `SysCountDraft` sheet (or scratch columns on the count task) keyed the same way. Start on `CacheService`; the key scheme below is store-agnostic so the cutover is a swap, not a redesign.

**Key + payload (review fix #2).** One draft per (operator, count task):
- Key: `countdraft:<activeUserEmail>:<taskId>` (taskId is the stable handle; SKU is derivable from the task).
- Payload: `{ storage, office, shop, vintage, comment, selected, ts }` — note `selected` carries the **submit-checkbox state**, which is otherwise lost on reload too, so rehydrate lands the operator exactly where they were (one boolean; cheap). `ts` supports the staleness rule below.

**Flow.**
- **Save / Save & next** → `WebAppInventory_saveCountDraft(taskId, payload)` (awaited).
- **View load** → `getCountDrafts()` returns the operator's drafts; rehydrate **only** rows whose `taskId` is still present + open in the freshly-loaded count list (review fix #1: drop any draft whose task is gone/Done so a stale draft can never resurrect a completed row).
- **Batch Submit** → clear drafts **per successfully-submitted task only** (review fix #1). Submit is per-item (`WebAppInventory_submitInventoryCounts` loops `selectedCounts`, flips status only on each item's success), so on a partial failure the **failed items' drafts must survive** for retry; only clear the ones that actually committed. The submit response already distinguishes per-item success, so clear from that.

**Cost:** one new endpoint pair (save + get) + clear-on-submit wiring + rehydrate-on-load; a server round-trip per Save (acceptable — it's a deliberate button, not keystroke autosave). Highest-value piece.

### B. Restore-context breadcrumb
Persist "current view + key IDs" so a reload returns you where you were instead of the default dashboard.
- **Where:** best-effort `localStorage` (cheap, may fail on mobile) **or** a per-user server breadcrumb (`CacheService`) read in the bootstrap. Given the iframe storage caveat, server-side is the reliable option.
- **Value:** medium — removes the "I'm back at the dashboard" disorientation. Pairs naturally with A.

### C. `beforeunload` dirty-form seatbelt (desktop)
Show the browser "unsaved changes" prompt when a count/edit form is dirty.
- **Value:** partial — helps on desktop, mostly ignored on mobile. **Low effort**, so worth adding as a complement to A, not a substitute.

### D. Non-goal — trapping the back button
Pushing history entries to intercept back fights the platform, breaks expected navigation, and frustrates users. **Do not do this.**

## 5. Recommendation

- **Do A** for count entry — it's the only thing that actually survives a mobile reload, and it converts the worst-case (lose a whole count session) into "reload, pick up where you were."
- **Add C** as a cheap desktop seatbelt in the same pass.
- **B is optional**, nice with A; only worth the server breadcrumb if context-loss disorientation is a real complaint.
- Apply the same pattern to any **other multi-field, batch-submit forms** that would hurt to lose (audit candidates: product detail edits in `AdminProductsView`, project/task create forms). Count entry is the priority.

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
