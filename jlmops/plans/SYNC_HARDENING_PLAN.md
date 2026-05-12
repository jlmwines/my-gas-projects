# Sync Widget Hardening Plan

**Created:** 2026-05-05
**Status:** **Bug 4 obsoleted 2026-05-12** — the `GENERATING_WEB_EXPORT` stage no longer exists. Web inventory export is now synchronous (`generateWebExportBackend` calls `ProductService.exportWebInventory` inline, transitions state directly). See `WEB_EXPORT_INLINE_PLAN.md` for the refactor. Bugs 1, 2, 3 still pending staging repro — backend looks clean.
**Scope:** Daily Sync widget UI/state drift. Excludes failed-Comax-import recovery (rare; tracked separately in `.claude/bugs.md`).

## Implementation log

- **2026-05-05** — Implemented Bug 4 fix #1 in `OrchestratorService.js`:
  - New private helper `_reapStuckJobInSession(jobType, sessionId, thresholdMinutes)` — finds the matching `PROCESSING` job for the active session, marks it `FAILED` if `processed_timestamp` is older than the threshold, sends a `NotificationService.reportFailure` matching the existing zombie-killer pattern.
  - Called from each of the three async branches in `_checkAndAdvanceSyncState` (`IMPORTING_COMAX`, `VALIDATING`, `GENERATING_WEB_EXPORT`) before the `getJobStatusInSession` call. So a stuck job is reaped on the next poll, not on the next hourly trigger.
  - Threshold: 8 minutes. Apps Script's hard execution limit is 6 min — anything stuck past 8 is dead by definition. Tighter than the existing 15-min hourly zombie killer because polls run continuously.
  - Existing 15-min zombie killer in `processPendingJobs` left in place — still useful for non-sync jobs and as a safety net.
  - Outcome: stuck spinner caps at ~8 min instead of "up to 60 min". After reap, normal `FAILED` branch handles state transition + UI Retry button.

## Goal

Eliminate the 4 frequent race / stale-state issues in the Daily Sync widget so users don't see stuck buttons, missing stages, or buttons that fire too early. Make the UI a faithful mirror of the backend state at all times.

## Scope

In:

1. Generate web export button visible/clickable before the action can fire (orig 2026-01-28)
2. Export button stays visible after export step starts (orig 2025-12-29)
3. Sync widget doesn't show Comax product import stage when order export is skipped without a refresh (orig 2025-12-31)
4. Generate button stays after export completes — file generated and named, but button doesn't reset (orig 2026-03-17, distinct from 2026-03-03 stale-poll fix)

Out (deferred):

- Failed Comax import can't recover when corrected file is uploaded — rare case, separate plan.

## Architecture recap

- **Backend state** lives in one JSON object in SysConfig at `system.sync.state`, managed by `SyncStateService.js`. 12 stages + FAILED. Strict transition table at `SyncStateService.js:35-50`. Every backend action has a stage guard.
- **Frontend** is `AdminDailySyncWidget_v2.html` (single file, ~636 lines). One source of truth for the shared message/action area: `STAGE_CONFIG[stage]` lookup table at lines 164-179, rendered by `updateSharedArea()` at lines 236-281.
- **Polling** runs at 1s during spinner stages, 10s during waiting stages, off when IDLE/COMPLETE. See `adjustPolling()` at lines 576-606.
- **Action lifecycle** in `runAction()` at lines 385-458: disable buttons → spinner → backend call → success handler updates UI from returned state.
- **Race protection** today:
  - `actionInProgress` flag (line 157) — polls during an action skip the shared-area update (lines 542-557).
  - Strict-less-than stale-poll discard (lines 560-564) — the 2026-03-03 fix.

## Backend audit (read on 2026-05-05)

Confirmed by reading `WebAppSync.js` and `OrchestratorService.js`:

- **All user-triggered backend functions correctly transition AND return the post-state.** Specifically:
  - `importWebOrdersBackend` (`WebAppSync.js:123-190`): when `ordersToExportCount === 0`, sets stage = `WAITING_COMAX_IMPORT`, marks step3 'skipped', step4 'waiting', returns the post-state.
  - `exportComaxOrdersBackend` (`WebAppSync.js:201-264`): transitions through `EXPORTING_ORDERS` → `WAITING_ORDER_CONFIRM` (or `WAITING_COMAX_IMPORT` if empty), returns post-state.
  - `generateWebExportBackend` (`WebAppSync.js:389-430`): transitions to `GENERATING_WEB_EXPORT`, queues a job via `OrchestratorService.queueWebInventoryExport`, calls `OrchestratorService.run('hourly')`, returns. **Final transition out of GENERATING_WEB_EXPORT happens asynchronously via `_checkAndAdvanceSyncState`** (not by the backend function itself).

- **Polling endpoint `getSyncStateFromBackend` (`WebAppSync.js:17-23`) calls `OrchestratorService.checkAndAdvanceSyncState()` on every poll.** That means polling actively drives async stage advancement — the UI is the engine.

- **`_checkAndAdvanceSyncState` GENERATING_WEB_EXPORT branch (`OrchestratorService.js:1175-1230`) advances ONLY on terminal job statuses:**
  - `jobStatus === 'COMPLETED'` → `WAITING_WEB_CONFIRM` (or `COMPLETE` if no changes).
  - `jobStatus === 'FAILED' || 'QUARANTINED'` → `FAILED`.
  - **Any other status (`PENDING`, `PROCESSING`, `NOT_FOUND`, `ERROR`) → no transition.** Stage hangs at `GENERATING_WEB_EXPORT`. Spinner stays.

- **Job lifecycle (`OrchestratorService.js:621-680`):** queue creates `PENDING` row. `processPendingJobs` sets `PROCESSING` before calling the service. **Service is responsible for setting `COMPLETED`** itself — orchestrator only sets `FAILED` if the service throws.

- **Zombie killer exists (`OrchestratorService.js:567-601`):** any job stuck in `PROCESSING` for >15 minutes is marked `FAILED`. **But the zombie killer only runs inside `processPendingJobs`**, which is only called from `OrchestratorService.run(...)`. **Polling does NOT call `processPendingJobs`** — it only calls `_checkAndAdvanceSyncState`. So between hourly triggers, zombies aren't reaped.

- **`retryFailedStepBackend` (`WebAppSync.js:512-535`) sets stage = `failedAtStage` directly via `setSyncState` (not `transition`).** Doesn't validate. Doesn't re-queue jobs. So a failed async job + Retry only re-checks the job status; the export is not actually re-run.

## Diagnosis per bug

### Bug 4: Generate button stays after export completes

**Confirmed root cause (cause #1):** the export job can finish its work (file written to Drive) but its row in SysJobQueue never reaches `COMPLETED`, leaving stage stuck at `GENERATING_WEB_EXPORT`.

How this happens:

1. User clicks Generate. `generateWebExportBackend` queues a `PENDING` job, calls `OrchestratorService.run('hourly')`, returns.
2. `processPendingJobs` picks up the job, sets `PROCESSING`, calls `ProductImportService.processJob(...)` (or whichever service runs the export).
3. Service writes the file to Drive successfully.
4. Service is about to write `COMPLETED` to the queue row, but Apps Script's 6-minute hard timeout fires first. Or service throws AFTER file write but before status update. Or any other path where the status update is skipped.
5. Status stays `PROCESSING`. File exists on Drive. Stage stuck at `GENERATING_WEB_EXPORT`.
6. Widget polls. `_checkAndAdvanceSyncState` reads job status = `PROCESSING`, doesn't advance. Spinner forever (or whatever the UI shows when stage = GENERATING_WEB_EXPORT).
7. **Zombie killer would catch this — but only when `processPendingJobs` runs, not on polls.** Until the next hourly trigger fires `OrchestratorService.run('hourly')`, the zombie sits.

This matches the symptom: "file is generated and named, but button doesn't reset". The user sees the file in Drive but the widget never advances.

The "Generate button" framing in the original report is likely loose terminology — the user means "the action area never returns to a clickable state" (still showing spinner from `GENERATING_WEB_EXPORT`). After up to 1 hour, the next hourly trigger reaps the zombie → status FAILED → widget shows Retry. User clicks Retry → stage returns to `GENERATING_WEB_EXPORT`, polls re-check the (now FAILED) status → widget shows Retry again. So even after the zombie kill, the widget cycles between Failed and Retry — never returning to Generate.

**Cause #2 (less likely but worth noting):** the same stuck-status pattern can happen earlier in the lifecycle (job stuck in `PENDING` because `processPendingJobs` didn't pick it up). Symptom would be identical — spinner stays.

**Fix candidates (in order of value):**

1. **Inline zombie check in `_checkAndAdvanceSyncState`** for the specific job being polled. If status is `PROCESSING` and `processed_timestamp` > N minutes old, mark `FAILED` right there. Catches stuck jobs on every poll, not just hourly. Lowest risk, highest value.
2. **Tighter zombie threshold for export jobs** — 6 minutes (Apps Script execution limit) instead of 15 minutes. The export can't legitimately exceed 6 minutes.
3. **Cross-check stage by file existence** — if `webExportFilename` is set on the state and the file exists in Drive, force-advance to `WAITING_WEB_CONFIRM` regardless of job status. Recovers from the file-written-but-status-not-set timing window without waiting for zombie kill.
4. **Make `retryFailedStepBackend` re-queue the failed job**, not just reset the stage — so retry actually re-runs the export instead of re-checking the same FAILED status.

### Bug 3: Comax import stage hidden after order export skip

**Reframed after backend audit.** `importWebOrdersBackend` correctly transitions to `WAITING_COMAX_IMPORT` and returns the post-state with `step3 = 'skipped'`, `step4 = 'waiting'`. The widget's `updateUI(status)` should render the "Import Comax" button immediately via `STAGE_CONFIG[WAITING_COMAX_IMPORT]`. **Backend is not the bug.**

Likely causes:

1. **A poll fires between the click and the success handler return** (10s idle interval, but action could take seconds). During the action, `actionInProgress = true` blocks shared-area updates. After the success handler returns, `actionInProgress = false`. The next poll reads stage = `WAITING_COMAX_IMPORT` and renders correctly. So the user *should* see the button. Unless the success handler itself isn't rendering — possible if `runAction` exited early.
2. **The user "without a refresh" description may mean within a brief invisible window.** Hard to confirm without repro.

**Verification:** repro on staging with a sync that has 0 orders to export. Click Import Orders. Open console, log every `updateSharedArea` call with `(stage, source)`. Determine whether the stage actually arrives in the success handler.

**Fix candidate:** TBD until repro. If the success handler does receive `WAITING_COMAX_IMPORT` and still doesn't render, the bug is in `updateSharedArea` or a CSS/DOM issue.

### Bug 2: Export button stays visible after export step starts

**Reframed after backend audit.** `exportComaxOrdersBackend` synchronously transitions through `EXPORTING_ORDERS` → `WAITING_ORDER_CONFIRM` and returns the post-state. So the success handler should never see stage = `WAITING_ORDER_EXPORT` post-click.

Plausible cause: a polling race during the action. `runAction` sets the spinner immediately. Polls during the action are blocked from updating the shared area. So the spinner should hold. UNLESS:

- The user clicked Export but the backend call hadn't yet started (network queue, Apps Script cold start). Polling fires, returns stage = `WAITING_ORDER_EXPORT`. But `actionInProgress` is true, so the poll skips the shared area. So the spinner from `runAction` stays.
- After the success handler runs and `actionInProgress = false`, the next poll fetches a fresh state. If the backend has fully advanced past `EXPORTING_ORDERS`, the new button (Confirm or Import Comax) renders. So no Export button.

**Most likely real cause:** the symptom may be misdescribed. The user may be seeing a brief moment during the action where the spinner doesn't replace the button cleanly (CSS layout shift, or the `disabled` state visible). Need staging repro to characterize.

**Verification:** record screen during a successful export-with-orders sync. Capture pixel-by-pixel what shows in the shared action area from click to confirm-button render.

### Bug 1: Generate button live too early

**Status:** still unclear without staging repro. The button only shows for stage = `WAITING_WEB_EXPORT`, reached after `VALIDATING` completes. If clicking it "doesn't fire", the backend stage guard at `WebAppSync.js:395` would throw with the actual stage in the message — visible in browser console.

**Verification:** repro on staging. When the bug fires, check browser console for the thrown error. The error message will reveal what stage the backend was actually in.

**Fix candidate:** TBD until repro. If it's a stage-guard rejection, the question is why the widget showed the button when stage wasn't `WAITING_WEB_EXPORT` — likely a polling display race we need to characterize.

## Cross-cutting hardening

After fixing individual bugs, harden against the whole class of races:

1. **Stuck-stage detector.** The async pattern (`GENERATING_WEB_EXPORT` waiting on a job to flip to `COMPLETED`) has no timeout. If `_checkAndAdvanceSyncState` finds stage = `GENERATING_WEB_EXPORT` for > N minutes (say 10), advance to `FAILED` with a "stuck" error message. Same pattern likely applies to other async stages (`IMPORTING_PRODUCTS`, `IMPORTING_COMAX`, `VALIDATING`).
2. **Retry actually retries.** `retryFailedStepBackend` currently just resets the stage. For async-job stages, it should also re-queue the job. For synchronous-action stages, resetting the stage and letting the user click again is fine.
3. **Render gate in widget.** Shared message/action area is updated only by (a) the success handler from a fresh action, or (b) a poll whose `status.lastUpdated` is strictly newer than the last applied state. Track `lastAppliedTimestamp` separate from `lastActionTimestamp`.
4. **Stage assertion in success handler.** When an action expects specific post-transition stages, assert. Log a warning when the returned stage is unexpected — surfaces backend regressions immediately.
5. **Button-enable invariant.** Whenever a button is rendered into `#sharedAction`, set `disabled` based on `actionInProgress`. Today the disable is only on click-time (line 388); if a poll re-renders during an action, the new buttons are enabled by default.
6. **Single transition log.** Dev-only console log (`SyncWidget: stage <prev> → <new> via <source>`) so future race bugs are diagnosable from the browser console without instrumentation.

## Fix sequence

Order fixes by what we can land without staging repro vs. what needs repro first:

1. **Stuck-stage detector** (cross-cutting #1) — defensible to add even without repro; unblocks the most painful symptom (forever spinner) regardless of whether it's the actual root cause of Bug 4.
2. **Bug 4 staging repro** with browser console capture of polled `status.stage` and `status.webExportFilename`. Determines whether the cause is stuck-job-status or retry-doesn't-retry. Fix follows from observation.
3. **Bug 1, 2, 3 staging repro** — backend looks correct for all three; the bugs are widget-side or in the async job system. Each needs targeted observation before a fix.
4. **Render gate + button-enable invariant** (cross-cutting #3 and #5) — apply once individual root causes are confirmed, so the hardening doesn't mask which specific fix worked.
5. **Retry-actually-retries** (cross-cutting #2) — only worth doing if Bug 4 cause #2 is confirmed.

## Verification protocol

Staging repro for each bug — must produce before/after evidence:

- **Bug 4:** start a sync, advance to `WAITING_WEB_EXPORT`, click Generate, observe whether "Generate" button reappears post-completion. Browser console open the whole time.
- **Bug 2:** start a sync with orders to export, advance to `WAITING_ORDER_EXPORT`, click Export, observe whether Export button visibly persists during the export.
- **Bug 3:** start a sync with zero orders to export. Click Import Orders. Observe whether "Import Comax" appears without manual refresh.
- **Bug 1:** advance to `WAITING_WEB_EXPORT` and click Generate as fast as the button appears. Observe whether the click fails, and capture the error.

Each fix lands as its own commit so we can isolate cause/effect on staging.

## Open questions

- ~~For Bug 4: how does `getJobStatusInSession` actually evaluate?~~ **Answered 2026-05-05.** Returns one of `PENDING`/`PROCESSING`/`COMPLETED`/`QUARANTINED`/`FAILED`/`NOT_FOUND`/`ERROR`. `_checkAndAdvanceSyncState` only handles the terminal three; the others leave stage stuck. Zombie killer reaps stuck PROCESSING after 15 min but only via `processPendingJobs`, not via polls — explains hour-long stuck-spinner symptom.
- Should the render-gate use `lastAppliedTimestamp` (track applied state) or `expectedStageAfterAction` (track what we're waiting for)? The latter is stricter but harder to maintain.
- Should the inline zombie check (Bug 4 fix #1) apply to ALL `*ING_*` stages or just `GENERATING_WEB_EXPORT`? Same pattern likely affects `IMPORTING_PRODUCTS`, `IMPORTING_COMAX`, `VALIDATING`. Low cost to handle uniformly.
- Add a dev-mode console-log toggle to the widget for race diagnosis without code edits?

## Files in scope

- `jlmops/AdminDailySyncWidget_v2.html` — widget
- `jlmops/SyncStateService.js` — state machine + transition table (reference only)
- `jlmops/WebAppSync.js` — backend entry points (`getSyncStateFromBackend`, all `*Backend` functions)
- `jlmops/OrchestratorService.js` — async job advancement (`_checkAndAdvanceSyncState`, job status tracking)
