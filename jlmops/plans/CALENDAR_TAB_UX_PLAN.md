# Calendar Tab UX Plan

Implementation plan for the four Calendar-tab items logged 2026-07-09 (`.claude/bugs.md` + `.claude/wishlist.md`), all in `PublishingView.html`'s Calendar tab. Traced against the actual current code before writing this — two of the four turned out smaller or different than they looked from the bug/wish description alone. Not yet implemented; plan only.

## Scope

1. **Bug:** Calendar tab doesn't refresh after "Apply Pending Updates" or "Create Content Tasks" succeed.
2. **Wish:** row click shows entity details before advancing to a task, replacing the current auto-route-straight-to-task.
3. **Wish:** filter Calendar rows by status.
4. **Wish:** search tool — **turns out this already exists** (`#pv-cal-search`, fully wired and functional). The actual gap is only its position: it renders in a row below the title bar, not inside the title bar next to the buttons. Correcting the wishlist entry to reflect this.

## Current architecture (traced 2026-07-09)

- Calendar rows come from `state.holidays`, populated via `_loadCampaignsAndProjects()` → `WebAppPublishing_getCampaignsAndProjects()` (`PublishingView.html:573-593`). Despite the name, this holds the full unified calendar (holidays + content rows), not just literal holidays.
- `renderCalendar()` (`:611-705`) groups tasks and library entities by base slug (strip `-en`/`-he`), computes `_routeTarget(base)` per row: earliest open task if one qualifies (role-aware — manager sees only tasks assigned to `'Manager'`), else the entity (drawer fallback), else nothing (non-interactive row, e.g. holidays).
- Row click currently calls either `openAttachedTask(id)` (`:1339` — full view navigation to AdminTasks/ManagerDashboard, no confirmation) or `openEntityDrawer(slug)` (`:1262` — opens the existing entity detail drawer: status, type, language, target date, campaign, last-touched, and an attached-tasks list where each task row is *already* independently clickable via `TaskDetail.open(id)`, `:1365`).
- Search (`#pv-cal-search`) already filters rows by name+slug (`:664-668`), listener already wired (`:497-498`). Markup sits in `.ds-section-actions` (`:246-250`), a separate row below `.ds-section-head` (`:241-245`, the title bar holding "Create Content Tasks" / "Apply Pending Updates").
- `applyPendingCalendarUpdates()` success handler already calls `_loadCampaignsAndProjects()` (`:564`), which sets `state.holidays` and calls `renderCalendar()` (`:580-582`). `ContentStreamModal`'s reload path (`_loadData` → `_onLoaded`, `:546`) also reaches `_loadCampaignsAndProjects()`. **So a client-side refresh call already exists for both triggers** — the bug isn't a missing `renderCalendar()` call.

## Phase 1 — Refresh bug: investigate before fixing

The obvious fix ("add a refresh call after the action") is already ruled out — both triggers already call the refresh chain. Don't write a fix until the actual cause is confirmed:

- Reproduce directly (Apply Pending Updates, watch whether `WebAppPublishing_getCampaignsAndProjects`'s response actually contains the new/changed row, or a stale snapshot).
- Read the server-side implementation behind `WebAppPublishing_getCampaignsAndProjects` (not yet located/read — file TBD, likely `WebAppPublishing.js`) for caching (`CacheService`, a memoized read, a stale reference).
- Check whether `StatusReportService.applyPendingCalendarUpdates` (the merge function) commits synchronously before its response fires, or has any async/deferred write.
- Fix shape depends entirely on what's found — likely a cache-invalidation gap or a write/read ordering issue, not a client-side change.

## Phase 2 — Click-through: details before task (small, additive)

- Change the row `onclick` in `renderCalendar()` (`:684-688`): when `_routeTarget` returns a task target for a slug that *has* an entity, open the entity drawer instead of routing straight to the task.
- Edge case: a freshly-spawned chain with no Doc attached yet has a task but no entity (`_routeTarget` returns `{kind:'task'}` with nothing in `libGroupByBase`) — there's no entity to show a drawer for. Keep direct-to-task routing for that specific case; the redesign only changes the common case where an entity exists.
- No new component needed: the entity drawer's attached-tasks list already renders each task as an independently-clickable row (`TaskDetail.open(id)`) — that already *is* the "advance to task" action, just currently unreached from Calendar because Calendar bypasses the drawer entirely today.

## Phase 3 — Filter by status (small, additive)

- Copy the existing filter-dropdown pattern from `AdminTasksView.html` (`filter-task-status`: a `<select>` populated from status options, `change` listener sets state + re-renders, predicate `state.X !== 'all' && rowStatus !== state.X`) — established convention, don't invent a new filter UI.
- Status values are the three-tier derived status already computed per row via `TaskWidgets.deriveStatus` (not started / in progress / done — `WORKFLOWS.md` §13.4).
- Add `<select id="pv-cal-status-filter">` next to the search box; wire its `change` handler alongside the existing `renderCalendar` trigger.

## Phase 4 — Search placement (correction: already built, just misplaced)

- Move the `.tw-filter-bar` block (`:246-250`, containing `#pv-cal-search`) from `.ds-section-actions` into `.ds-section-head` (`:241-245`), after the two buttons. Markup/CSS move only — no JS change, since the search logic already works correctly.

## Suggested build order

Phase 4 (trivial correction) → Phase 3 (additive, independent) → Phase 2 (additive, independent) → Phase 1 (needs investigation first — scope unknown until reproduced against the server-side code, which hasn't been read yet).

## Status (2026-07-09)

- **Phase 1 (refresh bug):** Investigated, not fixed. Traced both trigger paths end to end (client refresh calls, server merge write, server read) — no defect found in any of it; see the investigation note below. Root cause still open — needs a live repro (browser Network tab or temporary diagnostic logging), not more static reading.
- **Phase 2 (click-through):** Implemented — `_routeTarget` now checks for an entity first and opens the drawer whenever one exists; only routes straight to a task when no entity exists yet (fresh spawn, no Doc attached).
- **Phase 3 (status filter):** Implemented — `#pv-cal-status-filter` select added next to search; `_calRowStatus(h)` is the single status-bucket definition, shared by the filter and the status pill (was previously computed inline, duplicated).
- **Phase 4 (search placement):** Implemented — `#pv-cal-search` moved into `.ds-section-head`, empty `.ds-section-actions` wrapper removed.

Phases 2–4 deployed live 2026-07-09, jlmops @461. **Not yet smoke-tested** by the user.

### Phase 1 investigation findings

- Client refresh calls confirmed wired for both triggers: `applyPendingCalendarUpdates()`'s success handler calls `_loadCampaignsAndProjects()` (`:564`); `ContentStreamModal`'s spawn success calls `cfg.reload()` → `_loadData()` → `_onLoaded()` → `_loadCampaignsAndProjects()`.
- Server merge (`StatusReportService.applyPendingCalendarUpdates`) does direct `SpreadsheetApp` reads/writes, no caching; the post-merge sort reads the sheet back within the same execution (reliable read-after-write).
- Server read (`WebAppPublishing_getCampaignsAndProjects` → `_loadHolidays`) opens the sheet fresh on every call via `SpreadsheetApp.openById`, no `CacheService`, no memoization.
- Conclusion: the obvious causes (missing refresh call, stale cache, unflushed write) are all ruled out by static reading. Next step needs runtime observation.
