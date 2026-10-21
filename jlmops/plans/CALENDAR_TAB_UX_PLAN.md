# Calendar Tab UX Plan

Open work on `PublishingView.html`'s Calendar tab. One open bug remains: the Calendar sometimes doesn't refresh after an action, cause not found. Shipped Calendar behavior (row click, drawer, Task button, admin date edit, Library on `cal_Date`) is documented in `jlmops/docs/WORKFLOWS.md` §13.1 and `DATA_MODEL.md` (Publishing Calendar, SysLibrary).

## Open bug: Calendar doesn't refresh after "Apply Pending Updates" / "Create Content Tasks"

Investigated, not fixed. Static reading ruled out the obvious causes: client refresh calls are wired for both triggers (`applyPendingCalendarUpdates()` success → `_loadCampaignsAndProjects()`; `ContentStreamModal` spawn → `cfg.reload()` → `_loadData()` → `_onLoaded()` → `_loadCampaignsAndProjects()`); the server merge writes directly with no caching and reads back in the same execution; the server read opens the sheet fresh on every call. Next step needs runtime observation (browser Network tab or temporary logging): does the response after the action contain the changed row or a stale one?

The admin date edit (`saveCalendarDate` → `_loadCampaignsAndProjects()`) uses the same refresh path and hasn't been exercised live yet (no re-date needed so far). Its first real use doubles as a repro: if the row doesn't move after Save, it's this bug.
