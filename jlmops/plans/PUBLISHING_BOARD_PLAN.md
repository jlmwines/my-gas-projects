# Publishing Board Plan

A new admin and manager working surface for content: one row per publication with its tasks laid out left to right, plus a month calendar grid of the same tasks. It replaces the gap between the Calendar tab (which shows only a coarse status per row) and AdminTasks filtered to Content (which shows tasks either all at once or for a single slug). Status: **phases 1+2 live and checked by the user; phase 3 (month grid, a Rows/Month toggle on the Board tab) live and in use; phase 4 (perfect the board for the admin so it replaces the Calendar and Tasks views) in progress: row Doc links + Attach (with library-folder lookup) live, and the board's two views promoted to top tabs List and Month (Calendar last for the admin until it retires), manager defaults to Tasks, and the schedule form (add row + re-date) @620. Remaining: live check of the form, then retire the Calendar tab (admin) and the Library Deficiency preset.**

## Problem

As admin, the user can't see the state of several publications at once. The Calendar tab's status per row is one of four tiers (open, unscheduled, done, or no tasks yet; `docs/WORKFLOWS.md` §13.4), so it doesn't show which stage a piece is at or who holds it. Tasks filtered to Content give the real picture, ordered by start dates the user sets by hand, but only for everything at once or for one slug. Multiple publications and their due dates can't be seen together without a flood of tasks. The calendar drawer lists tasks but can't act on them. The common case, where the manager hands work back without closing his task and the admin closes it, has to happen on the Tasks screen.

The manager's Edit and Translate stages are the main bottleneck. Delivery is irregular, so the admin re-plans dates by hand.

## Placement (agreed)

A new admin-only **Board** tab inside `PublishingView.html`, next to Calendar/Library/Campaigns, gated with the existing `data-roles="admin"` tab mechanism. It is the **admin's default tab** when the view opens; the manager's default is unchanged. It reuses the data the view already loads (no separate view or nav link). Its markup and script live in their own include file, pulled in the same way as `TaskWidgets`/`TaskPacks`, so the 1,800-line view doesn't grow. The Calendar tab stays untouched until the board is proven; whether it later replaces Calendar, and whether the manager gets it, is decided then.

Build order: (1) board view-only, (2) chip actions, (3) month grid, (4) admin board complete (below), (5) manager gets the board.

## Phase 4: admin board complete (agreed direction, user 2026-11-05)

The board should be perfected for the admin before the manager sees it. The goal is for it to replace the Calendar tab and the admin's content use of the Tasks view. Three additions on each row:

- **Open Doc links**, EN and HE, from the row's library entities. The view already loads each entity's `docUrl` (the Tasks tab's "↗ Doc" button uses it), so no server change.
- **Attach Doc** on the row, reusing the existing `WebAppLibrary_attachExistingDoc` path the Library drawer uses (canonical placement and versioning happen server-side).
- **Find the Doc for a first attach.** When the row's Attach opens, a find-only server lookup lists files in the slug's canonical Library folder (`<type>/<concept>`) whose names start with the full slug, newest first; each has a one-tap Attach through the same `attachExistingDoc` path. The paste box stays as the fallback for Docs drafted elsewhere. The lookup never creates folders.
- **One schedule form for new and existing rows.** Editing a row's publish date and adding a new calendar row share a single small form: date, type, name, slug suggested from type + name (editable on new rows only), optional notes. Edit writes `cal_Date` through the existing `StatusReportService.updateCalendarDate` path; new appends a `JLMops_Publishing` row through a new server function that refuses a duplicate `cal_Slug` and re-sorts (DATA_MODEL "Publishing Calendar" write rules gain this second UI write path). An empty-day tap on the month grid opens the form prefilled with that date.

Once these are in use, the Calendar tab and the Library's Deficiency preset retire: the board's Open range plus late chips cover what Deficiency showed, and add which stage is late and who holds it. Library stays as the entity catalog, since it holds items with no calendar row (images, templates) and entity actions such as campaign assignment.

## Build notes (verified against code, 2026-11-04)

- **Data:** no new server call. `WebAppLibrary_getData` already gives `state.tasks` + `state.archivedTasks` (each with `typeId`, `entityId`, `assignedTo`, `status`, `startDate`, `dueDate`) and `WebAppPublishing_getCampaignsAndProjects` gives the calendar rows (`state.holidays`). Group by base slug exactly as `renderCalendar` does. End-milestone types are `task.content.blog_publish`, `task.content.email.send` and `task.content.print.distribute` (all `task.content.*`, from `CONTENT_STAGES` in `WebAppProjects.js`); the legacy `task.newsletter.distribute` is also included as content, matching `TaskDetail`. Chip labels come from the task title's prefix ("Edit: …" → Edit), so no stage list is duplicated client-side.
- **Chip actions = open the existing task modal.** Tapping a chip calls `TaskDetail.open(id)`, already configured in this view (`PublishingView.html:475`, `saveTask`/`completeTask` adapters). It gives date edit, the status dropdown (how the admin closes a manager's handed-back task today, so not a new convention), and the task's pack. This matters for the end milestone: a publish task must close through the pack's **Mark Published** (sets `slb_State=published` + URL), not a bare close, and the modal keeps that path. No new write code.
- **Refresh:** after any modal save or close, re-render the board from the same reload the Tasks tab uses. Watch the open Calendar refresh bug (`CALENDAR_TAB_UX_PLAN.md`): verify the board actually redraws after a change.
- **UI to copy:** tabs are `.pv-tab` / `.pv-panel` with `switchTab()` (`PublishingView.html:235-238, 649`); admin gating via `data-roles="admin"`; chip state colors via `tw-status-pill` + `TaskWidgets.statusClass()`; buttons `btn btn-sm`; every button `type="button"`. Default tab: set Board active for admin at load, leave Calendar for the manager.
- **Include file:** new `PublishingBoard.html`, added with `<?!= include('PublishingBoard') ?>`, exposing a `renderBoard()` that `switchTab` and `_onLoaded` call.

## Board view (agreed)

- **One row per publication**, sorted by publish date like today's calendar. Date and name sit on the left edge. Holidays and notes appear as thin divider rows. A row with no tasks shows a Create button, which replaces today's row-select-then-Create-Content-Tasks flow. Today's filters and search stay.
- **Each chip is a task.** Chips run left to right, ordered by start date, with as many as the publication has. There are no fixed per-type columns. Undated tasks go at the end, greyed out, as a "not fully planned" signal; that should be rare, since the admin usually dates a whole stream when creating it.
- **Two fixed, vertically aligned anchor columns:**
  - **Translate.** The manager edits, reviews extracts, then translates everything; Translate is the unique milestone and the bottleneck, so it aligns across rows. Looking down the column shows where every piece stands.
  - **End milestones** (publish, print, distribute, send), on the right edge, as the end goal.
  - All other tasks (admin and manager) flow into the free lanes before and between the anchors: `[chips] | Translate | [chips] | End milestones`.
- **Act from the chip.** Tap a chip to close the task (including closing a manager task he handed back), change its start or due date, or open the Doc or the full task. Setting dates chip by chip across a row also serves for planning a new stream.
- **Chip state:** done (checkmark), open with its date, or late (red).
- **Phone:** the chip strip wraps under the publication name.

## Month calendar view (agreed)

A second view of the same data, for weekday rhythm. The admin assigns manager work Monday to Wednesday, sends email on Tuesday evenings, and schedules the newsletter before month end.

- A month grid showing publication dates, holidays and notes.
- **All task chips, admin and manager both,** placed by start date. The two sets are interleaved and dependent, so a manager-only version was rejected.
- Chips are colored by publication, so a chain reads as one thread, and marked A or M for whose turn it is.
- When a day is crowded, show "+N more".
- Tapping a chip or a publication acts on it, or jumps to that publication's row on the board, highlighted.
- The point is to spot bad handoffs at a glance, for example a manager task landing on a Thursday, or a week with no email.
- Optional rhythm markers (candidate): shaded Mon-Wed, a Tuesday email marker, a month-end newsletter line.

## Manager side (agreed direction, later phase)

Once the admin board is proven, the manager may get the same board, with rights limited to his role. CoSchedule works the same way: a shared calendar plus a personal "my tasks" dashboard. His existing Dashboard queue stays his "my tasks" list. Publish dates don't help him: they can be far off, and the admin still has work after his Edit and Translate, so his own task due dates are what matter. The value for him is opening the Doc from the board.

## Candidates (not decided)

- **Consolidation:** the board becomes the main working screen and the Calendar tab folds into it. Library stays the entity catalog, reached from a chip. Open: whether Library and Tasks tabs remain as-is.
- **Overnight auto-attach:** the admin often forgets to attach a Doc. Today `reconcileLibraryDuplicates` only repoints existing entities to the newest file, and `runLibraryIntegrityReport` only logs orphans (`docs/ARCHITECTURE.md` housekeeping Phase 3). Candidate: nightly, attach a Doc in the canonical folder whose slug matches an open task with no entity, or flag the chip as "Doc found, not attached".
- **Scheduling tie-ins** (`CONTENT_CHAIN_SCHEDULING_PLAN.md`): stages tied to the publish date, so moving the publish date moves the chain (CoSchedule-style); when a stage closes late, a preview of new downstream dates for the admin to accept (Asana-style "shift only on conflict, show the changes first"); durations derived from the manager's actual turnaround history.
- **Coaching data:** days late per stage for the manager over time, for review with him rather than for nagging.

## Inspiration

- CoSchedule: tasks shown on the calendar ahead of the publish date, and dragging a project moves all its tasks ([guide](https://coschedule.com/guide/getting-started-with-coschedule-marketing-calendar/be-flexible-when-projects-change)).
- Asana: dependent-task auto-shift with a preview of the changes ([help](https://help.asana.com/s/article/auto-shifting-dates-for-dependent-tasks)).
- ClickUp and Teamwork calendar views: task filters and "+N more" overflow.

## Settled details (user, 2026-11-04)

- **Chip actions** are the same as the Tasks view: change dates and close the task.
- **Range = the Calendar tab's Open view.** Every calendar row is scheduled content (tasks are created because a row is scheduled, not the other way round), so all future rows show, plus past rows that aren't done, including past rows with no tasks (overdue). Rows with no tasks show their Create button. All shows everything.

- **The fixed middle column is Translate** (`content.translate`), the one unique milestone. A blog runs: manager Edit → admin Extracts → back to the manager to review the extracts and translate everything. His other tasks (Edit, Review Extracts) flow as ordinary chips before the column. Empty when the content has no Translate task (e.g. email, news). The right-edge **end-milestone column** holds the row's single end point, its one publish, send, print or distribute task (Blog Publish for a blog row, Send Email for an email row, Print & Distribute for a news row). A blog and its email are separate content streams, each its own calendar row. Reuse doesn't add end points: AYIW pieces and blog posts feed newsletters, but the newsletter is its own stream with its own row and due date; the build session maps end-milestone types from `CONTENT_STAGES`.
