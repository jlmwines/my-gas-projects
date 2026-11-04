# Publishing Board Plan

A new admin and manager working surface for content: one row per publication with its tasks laid out left to right, plus a month calendar grid of the same tasks. It replaces the gap between the Calendar tab (which shows only a coarse status per row) and AdminTasks filtered to Content (which shows tasks either all at once or for a single slug). Status: **design captured in conversation (user, 2026-11-04), nothing built**. Open questions are listed at the end.

## Problem

As admin, the user can't see the state of several publications at once. The Calendar tab's status per row is one of four tiers (open, unscheduled, done, or no tasks yet; `docs/WORKFLOWS.md` §13.4), so it doesn't show which stage a piece is at or who holds it. Tasks filtered to Content give the real picture, ordered by start dates the user sets by hand, but only for everything at once or for one slug. Multiple publications and their due dates can't be seen together without a flood of tasks. The calendar drawer lists tasks but can't act on them. The common case, where the manager hands work back without closing his task and the admin closes it, has to happen on the Tasks screen.

The manager's Edit and Translate stages are the main bottleneck. Delivery is irregular, so the admin re-plans dates by hand.

## Board view (agreed)

- **One row per publication**, sorted by publish date like today's calendar. Date and name sit on the left edge. Holidays and notes appear as thin divider rows. A row with no tasks shows a Create button, which replaces today's row-select-then-Create-Content-Tasks flow. Today's filters and search stay.
- **Each chip is a task.** Chips run left to right, ordered by start date, with as many as the publication has. There are no fixed per-type columns. Undated tasks go at the end, greyed out, as a "not fully planned" signal; that should be rare, since the admin usually dates a whole stream when creating it.
- **Two fixed, vertically aligned anchor columns:**
  - **Manager: Edit + Translate.** The manager does both, edit first and then translate. This is the bottleneck, so it aligns across rows; looking down the column shows where he stands on every piece.
  - **Publish / distribute**, on the right edge, as the end goal.
  - Admin and other tasks flow into the free lanes before and between the anchors: `[prep chips] | Manager: Edit + Translate | [chips] | Publish/distribute`.
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

## Manager side (agreed direction)

The manager sees the same board, with rights limited to his role. CoSchedule works the same way: a shared calendar plus a personal "my tasks" dashboard. His existing Dashboard queue stays his "my tasks" list. Each of his tasks gains the publication's publish date ("publishes in X days") and a link that opens that publication's row on the board.

## Candidates (not decided)

- **Consolidation:** the board becomes the main working screen and the Calendar tab folds into it. Library stays the entity catalog, reached from a chip. Open: whether Library and Tasks tabs remain as-is.
- **Overnight auto-attach:** the admin often forgets to attach a Doc. Today `reconcileLibraryDuplicates` only repoints existing entities to the newest file, and `runLibraryIntegrityReport` only logs orphans (`docs/ARCHITECTURE.md` housekeeping Phase 3). Candidate: nightly, attach a Doc in the canonical folder whose slug matches an open task with no entity, or flag the chip as "Doc found, not attached".
- **Scheduling tie-ins** (`CONTENT_CHAIN_SCHEDULING_PLAN.md`): stages tied to the publish date, so moving the publish date moves the chain (CoSchedule-style); when a stage closes late, a preview of new downstream dates for the admin to accept (Asana-style "shift only on conflict, show the changes first"); durations derived from the manager's actual turnaround history.
- **Coaching data:** days late per stage for the manager over time, for review with him rather than for nagging.

## Inspiration

- CoSchedule: tasks shown on the calendar ahead of the publish date, and dragging a project moves all its tasks ([guide](https://coschedule.com/guide/getting-started-with-coschedule-marketing-calendar/be-flexible-when-projects-change)).
- Asana: dependent-task auto-shift with a preview of the changes ([help](https://help.asana.com/s/article/auto-shifting-dates-for-dependent-tasks)).
- ClickUp and Teamwork calendar views: task filters and "+N more" overflow.

## Open questions

- Which chip actions belong on the tap menu versus the full task.
- Whether the board replaces the Calendar tab outright or sits beside it at first.
- Which task types map to each anchor column for every content type (email and news chains have no manager Edit/Translate today).
- How far ahead the board shows by default (the Calendar tab's "Open" rule, or a fixed window).
