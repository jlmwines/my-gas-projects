# Task States and Filters Plan

Plan to give every task view one vocabulary for task state, keyed on the **due date**, with the same filter row in every view. The admin sees and schedules a whole chain; an assignee sees a task only once it has a due date. Status: **live as jlmops @582 (column widths @583), 2026-10-18; awaiting user testing.** Backward scheduling deferred but required. See "Build notes" for where the build differs from the text below.

## Model (user, 2026-10-18)

- **The due date makes a task Open** and visible to its assignee. No due date = not yet released.
- **The start date is a planning field**, set by the admin independently of the due date (e.g. the latest start that still meets the deadline). It never decides state or visibility.
- **The admin sees the full chain** in every state and sets start and due dates independently, per task.
- **Assignees see their own Open tasks** (due date set, not closed), plus their Done history, **with both start and due dates shown**.
- **The manager can also view admin tasks, read-only** (no pack actions, status changes or revert).

## Terms

- **Closed:** status Done or Cancelled (and the legacy `Closed` status).
- **Unscheduled:** no due date, not closed.
- **Open:** has a due date, not closed. Future dates included. The only word for this state everywhere; "in progress", "started" and "future" are retired.
- **Done:** closed (includes Cancelled).
- **All:** every task.

Status (`Assigned`, `Review`, ...) no longer encodes state; a new task with an assignee is `Assigned` with or without dates.

## Filter row (same order in every task view)

Assignee, category/project (where relevant), text filter, then toggle links **Unscheduled | Open | Done | All**, Open selected by default. Admin views keep their extras (status, priority, entity). Assignee views omit Unscheduled, since those tasks are hidden from assignees.

## Current state (verified 2026-10-18)

- `TaskService.createTask` (`TaskService.js:259-287`) gives every assigned task start = today, a forward-computed due date (`due_pattern`) and `Assigned`; content-chain types are all `admin_direct`/`manager_direct`, so a new chain is fully dated and visible at once.
- `TaskService.updateTaskDates` already writes start and due independently. The generic create-task path (`WebAppTasks.js:715`) rejects one date without the other.
- **ManagerDashboardView_v2:** dropdown "All Open" (default, not Done), "Started", "Done"; server (`WebAppDashboardV2.js` ~635) returns only `Manager` tasks, minus Cancelled. Clicking a task opens its action pack.
- **AdminTasksView:** links Open (not closed), Started (start <= today), Future (no/future start), All.
- **PublishingView Tasks tab** (`PublishingView.html:1119`): open content tasks; assignee filter for admin only; manager sees own tasks only.
- **Calendar/entity status** (`TaskWidgets.deriveStatus`, `TaskWidgets.html:255`): "in progress" if any non-closed task is `Assigned`/`Review`, else "not started", else done. Shown on Calendar rows and in the Library. The Calendar also has a separate row toggle named "Open" (undone rows plus future rows, `WORKFLOWS.md` §13.1).

## Changes

1. **Creation: dates optional for user-created tasks only.** System-generated tasks (validation, onboarding, sync, housekeeping, etc.) keep today's auto-dating in `createTask`, or they would become Unscheduled and vanish from assignees. Only the two user-facing creation paths pass an explicit "no auto dates" option to `createTask`:
   - **Content dialog** (`ContentStreamModal.html` → `spawnContentChain`): new "Set due date now" checkbox, **default off**. Off: assignee and `Assigned` saved, no dates (Unscheduled). On: today's behavior.
   - **Generic create-task modal** (`WebAppTasks_createTask`, `WebAppTasks.js:706`): it already has start/due date inputs, so no checkbox. Blank due date = Unscheduled (today a blank pair is auto-filled from `due_pattern`). Drop the "both or neither" rule (`WebAppTasks.js:715`) so either date can be set alone.
2. **Admin date control:** start and due editable independently in AdminTasksView (via `updateTaskDates`).
3. **Visibility:** manager dashboard and PublishingView Tasks tab show assignee tasks only when they have a due date. Server returns all assignees' Open/Done tasks for the manager; admin tasks render read-only.
4. **Filters:** apply the shared row to ManagerDashboardView_v2, AdminTasksView, PublishingView Tasks tab.
5. **Entity/calendar status:** `deriveStatus` keys on due date (any non-closed task with a due date = Open, else Unscheduled, none open = Done). The Calendar's separate row toggle keeps the name "Open" (user, 2026-10-18).
6. **Docs:** rewrite `WORKFLOWS.md` §12.1/§12.3 (assignment no longer sets dates; dates independent; due date = visibility).
7. **One-task additions:** clear-all toggle in the content dialog (`CONTENT_TASK_CREATION_PLAN.md`).
8. **Assignee = role name** (`Manager`, `Administrator`), never an email. Checked 2026-10-18: the create modal's assignee list comes from `AuthService.getAvailableRoles` (role names) and the detail panel's list from assignees already on tasks; the 2026-09-01 SysTasks export has no staff emails (the only emails are customer addresses in CRM task text). So nothing to convert; only `WORKFLOWS.md` §12.4 (which says "user email") needs correcting. Re-check live data at build time, since the export is old.
9. **Manager dashboard counts** (project task counts) stay limited to the manager's own tasks, even though admin tasks are now viewable. Admin tasks are available but the manager may never use them; default stays own tasks.
10. **AdminTasksView opens full width** (list only, no detail panel; today `state.panelState: 2`, `AdminTasksView.html:526`). In full width the detail column is hidden and `selectTask` doesn't reveal it, Decided (user, 2026-10-18): **single click selects** the task (highlight only, layout unchanged); **double click, or an open-detail control** on the row, opens the detail panel (switches to list + detail). The existing layout buttons return to full width. Checked 2026-10-18: no conflict with multi-select, which uses its own row checkboxes (`state.selectedTaskIds`) separate from the single selection (`state.selectedTaskId`). Build note: `selectTask` re-renders the whole list on each click, which would swallow a double click, so selection must update the highlight in place instead. Moved here from `CONTENT_TASK_CREATION_PLAN.md`.

Existing open tasks without a due date become hidden from assignees; the admin reviews them via Unscheduled as part of managing tasks (no pre-ship cleanup).

## Build notes (2026-10-18)

- Shared state logic lives in `TaskWidgets.html`: `isClosed`, `taskState`, `matchesScope`, `scopeLinksHtml`. All views call these.
- `createTask` takes `options.noAutoDates`; only `spawnContentChain` (when `setDueDate === false`) and `WebAppTasks_createTask` pass it. System tasks are unchanged.
- TaskDetail: dates (and assignee) editable on every non-system task; the manager sees other assignees' tasks view-only (no pack, no buttons, notes read-only). The guard is client-side only; the server's manager update function doesn't check the assignee.
- Manager dashboard: server returns every assignee's due-dated tasks; other assignees' closed tasks are limited to the last 30 days (payload size). Project counts use the manager's own due-dated open tasks. List gains a Start column and a "(Administrator, view only)" tag.
- AdminTasksView: links are Unscheduled | Open | Done | All, after the project control. Assignee and text (entity) filters stay as column-header filters rather than moving into the header row. Full width by default; single click selects (highlight only), double click or the ▸ control before the title opens detail.
- PublishingView Tasks tab: filter row (assignee, text, links) built once; manager defaults to own tasks, no Unscheduled link; Start column added.
- Default sort in every task view: start date (none last), then due date (@584).
- AdminProjectsView is demoted (user, 2026-10-18) and left untouched.
- Not yet done: `WORKFLOWS.md` §12 rewrite (after deploy and test).

## Proposed next: backward scheduling (deferred 2026-10-18)

Parked by the user: the current `due_pattern` durations are too generous for a chain, so the durations need rethinking first. Open items when it resumes: realistic per-stage durations, what "compress" does, and the Clear all toggle (clear, then restore the type's default stages).

"Set due date now" today means: start = today, due = today + the type's `due_pattern`, counted forward, the same for every stage. Proposal: replace it with **"Schedule back from goal date"**, using the calendar row's date as the goal. Walk the checked stages from last to first; each stage's due date is the previous stage's start, and its start is due minus the stage's duration. Manager stages land only on Monday, Tuesday or Wednesday; admin stages land on any business day (Sun-Thu). Every date stays editable afterwards.

Decided (user, 2026-10-18):
- **Goal date = the calendar row's date,** which is the publish date for a blog post, the send date for an email, and so on. The chain's final stage (publish / send / distribute) is due on it.
- **Not enough time:** warn and offer to compress.

- **Duration = the type's `due_pattern`** (user, 2026-10-18); no new field. `immediate` = same day, `next_business_day` = 1 business day, `one_week` = 7 days, `two_weeks` = 14 days. Almost every content type is `one_week` today, so a full blog chain plans over about 7 weeks unless compressed; shorter stages are set by changing a type's `due_pattern` in `config/taskDefinitions.json` (config path), which also changes its forward deadline.

## Open questions

None. Pre-build checks done 2026-10-18 (results in changes 1, 8, 10).

## After build

Record the model and terms in `jlmops/docs/WORKFLOWS.md` §12, then archive this plan.
