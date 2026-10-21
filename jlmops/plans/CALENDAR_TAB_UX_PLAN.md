# Calendar Tab UX Plan

Open work on `PublishingView.html`'s Calendar tab and the dates it shows. One open bug (refresh, cause not found) and four planned items (2026-10-21, none built): a date-display prerequisite, explicit row-click choices, editing a row's publishing date, and the Library running on `cal_Date` instead of obsolete `slb_TargetDate`. Shipped Calendar behavior (search, status filter, current row click) is documented in `jlmops/docs/WORKFLOWS.md` §13.1.

## Build order

1. Date display fix (prerequisite: every date below is shown through `formatDate`).
2. Row click: details or task. 3. Edit publishing date. Build and test these two together; both change how a row reacts to clicks.
4. Library on `cal_Date`.

All four ship in one jlmops deploy (code only, no config rebuild), then are tested in this order; a failing item is reverted alone and redeployed.

## 1. Prerequisite — date display one day early

Dates are date-only, but `TaskWidgets.formatDate` (`TaskWidgets.html` ~322) displays them via `toISOString().slice(0, 10)`, i.e. in UTC. A date stored as Israel local midnight is 21:00/22:00 UTC the previous day, so every screen using `formatDate` shows it one day early. Meanwhile `dueClass`/`isOverdue` and `formatDateShort` work in local time, so the same task can show different dates on different screens, and the overdue colour is judged on a different day than the one displayed. This likely explains the occasional "one day off" due dates the user has seen.

- **Fix:** `formatDate` builds `YYYY-MM-DD` from local `getFullYear/getMonth/getDate`. One shared function, so every caller is corrected at once.
- **Check on ship:** a pure ISO string (`2026-10-29`) parses as UTC midnight, which is still the same local day in Israel; all users are in Israel, so local-date output is correct for both input shapes. Spot-check a task due date, the drawer, and the Library after deploy.
- Relates to the open `bugs.md` item "Audit timestamps + date formats system-wide" (2026-05-04); this fixes one concrete instance, not the whole audit.

## 2. Row click: details or task, by choice

The user sees row clicks behave unpredictably in the admin Calendar (2026-10-21). `_routeTarget` (`PublishingView.html` ~688) has a hidden rule (entity exists → drawer; tasks but no entity → earliest open task) that doesn't fully account for what the user sees; two further confusions found: the drawer shows only the EN entity's tasks (below), and the two "go to task" paths behave differently. Replace with explicit choices:

- **Row click always opens the drawer** for a content row with an entity or tasks.
- **Drawer task list = every task for the row.** Today `LibraryService.getEntityDetail` matches `st_EntityId` exactly against the one entity slug opened (the EN representative), so HE tasks never appear. When opened from the Calendar, list all tasks for the row's base slug (both languages, archived included) from the already-loaded `tasksByBase`, not the server's exact-slug list.
- **Bare drawer** when the row has tasks but no entity (no Doc attached): header from the calendar row (name, slug, type, date) plus that same task list. No entity fields or entity actions.
- **"Task" button on the row** goes straight to the earliest open task, using today's row behavior (`openAttachedTask`: navigate to AdminTasks / ManagerDashboard with the task selected), not the drawer's `TaskDetail.open` popup. Same selection as today's `_routeTarget` task branch, role-aware for manager. Shown only when the row has an open task; `stopPropagation` so the row click doesn't also fire. Copy the button class from an existing row button in the file (e.g. the Library tab's Spawn button).
- **Untouched rows** (no entity, no tasks) keep the current select-for-Create-Content-Tasks click.
- **On ship:** rewrite the row-click description in `WORKFLOWS.md` §13.1.

## 3. Edit a row's publishing date

Today the only way to move a calendar date is editing `JLMops_Publishing` directly in Drive, and re-dating is frequent. Scope (user, 2026-10-21): change the date and refresh the display. Task start/due dates are **not** shifted; the admin re-dates remaining tasks by hand, since only the unfinished part of a chain ever needs adjusting. Automatic back-scheduling stays in `CONTENT_CHAIN_SCHEDULING_PLAN.md`.

- **Admin only.** The manager sees the Calendar tab but never edits dates; the date cell is clickable only for admin (`data-roles="admin"` / role check). No server-side role check is possible until the authorization program exists (`CODE_AUDIT_FIX_SEQUENCE.md` Session R), same as every other endpoint.
- **Content rows only** (`cal_Type` is a content type). Holidays are managed separately and never editable here; `blackout`/`note` rows stay sheet-edited too.
- **Entry point:** the date cell. Clicking it opens a small `modal-overlay` (date input + Save, via `ModalOverlay`) and stops propagation so the row click doesn't also fire. Name and notes stay sheet-edited.
- **Server:** a public `updateCalendarDate(slug, isoDate)` in `StatusReportService.js`, next to `applyPendingCalendarUpdates`, reusing its slug-to-row lookup and `_sortCalendarByDate`. Finds the row by `cal_Slug` (exact match), refuses `holiday`/`blackout`/`note` rows, writes `cal_Date`, re-sorts, errors if the slug isn't found. **Writes a local date:** build the Date from the `YYYY-MM-DD` parts (`new Date(y, m-1, d)` in the script's Israel timezone), never `new Date('YYYY-MM-DD')`, which is UTC midnight. A thin `WebAppPublishing_updateCalendarDate` wrapper exposes it.
- **Refresh:** on success, call `_loadCampaignsAndProjects()` like the Apply Pending Updates handler. The open refresh bug (below) may hit this too, so the first live test doubles as its repro.
- **On ship:** update `DATA_MODEL.md` Publishing Calendar write rules (admin can re-date from the Calendar tab) and `WORKFLOWS.md` §13.1.

## 4. Library on `cal_Date`, retire `slb_TargetDate`

`cal_Date` is the only live publish date. `slb_TargetDate` (SysLibrary) is obsolete: nothing writes it any more (`ContentStreamModal.html` still sends `targetDate`, but `spawnContentChain` ignores it and `_ensureEntity` never sets it), so only pre-2026-07-08 entities carry a value, and it never tracks calendar changes. It is still read, so the Library shows stale or blank dates.

- **Readers to repoint to `cal_Date`** (matched by base slug, the same `-en`/`-he` stripping the Calendar uses): the drawer's "Target date" field (`pv-drawer-targetdate`), the Library tab's Target column and overdue flag, and the **Deficiency preset** (`PublishingView.html` ~1359-1392; pieces with a date inside `system.content.deficiency_window_days`, default 56, plus overdue not-done). The setting stays; the preset now runs on `cal_Date`, so posts that never had a target date start appearing. Library items with no calendar row (images, templates) show no date.
- **Load order:** the Library renders from `WebAppLibrary_getData` before the calendar arrives (`_loadCampaignsAndProjects` is a separate, later call). Re-render the Library once `state.holidays` is loaded, or it shows blank dates first.
- **Dead write path to remove:** the `targetDate` param in `ContentStreamModal.html`'s `spawnContentChain` call and the `slb_TargetDate` write in `LibraryService.js` `addEntity`. `WebAppLibrary.js` stops mapping `targetDate` from `slb_TargetDate`.
- **Sheet column stays** (schema is append-only); it just goes unread. On ship, mark it obsolete in `DATA_MODEL.md` SysLibrary (which also wrongly says it can be "set manually via the entity drawer") and update `WORKFLOWS.md` §13.1's Deficiency description.

## Open bug — Calendar doesn't refresh after "Apply Pending Updates" / "Create Content Tasks"

Investigated, not fixed. Static reading ruled out the obvious causes: client refresh calls are wired for both triggers (`applyPendingCalendarUpdates()` success → `_loadCampaignsAndProjects()`; `ContentStreamModal` spawn → `cfg.reload()` → `_loadData()` → `_onLoaded()` → `_loadCampaignsAndProjects()`); the server merge writes directly with no caching and reads back in the same execution; the server read opens the sheet fresh on every call. Next step needs runtime observation (browser Network tab or temporary logging): does the response after the action contain the changed row or a stale one?
