# Sync Widget Hardening Plan

**Created:** 2026-05-05
**Status:** **Bug 4 obsoleted 2026-05-12** — the `GENERATING_WEB_EXPORT` stage no longer exists. Web inventory export is now synchronous (`generateWebExportBackend` calls `ProductService.exportWebInventory` inline, transitions state directly). See `WEB_EXPORT_INLINE_PLAN.md` for the refactor. Bugs 1, 2, 3 still pending staging repro — backend looks clean. **A related batch of inventory-push hardening (auto-retry, double-submit guard, stale-render fix, real error surfacing) shipped 2026-08-25** — facts graduated to `jlmops/docs/WORKFLOWS.md` §11.2 and `jlmops/docs/ARCHITECTURE.md` §2.5.6; narrative in `.claude/session-log.md`. **Bug 5 added 2026-08-26 — the 2026-08-25 log-dedup fix did not close the duplicate-log problem it targeted**; confirmed via live log that the real cause is a cross-execution race, not the single-execution case that fix addressed. First fix draft was independently reviewed and found incomplete (missed the dominant call site, reinvented a narrower version of an already-staged, never-shipped design in `RELIABILITY_AUDIT.md` §1.3); Bug 5 below now points to building §1.3 directly. Planned, not yet built.
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

## Bug 5: Concurrent sync-state race — duplicate log entries (confirmed 2026-08-26, plan rewritten after independent review)

**First draft of this section (2026-08-26, superseded below) proposed a standalone lock-plus-trim fix.** An independent review found it incomplete in ways that would have repeated the 2026-08-25 fix's failure mode (looked reasonable, didn't close the gap) — see corrections below. Do not build the original three-point fix as first written; build the plan under "Corrected fix" instead.

**Confirmed via live log** (`exchange/JLMops_Logs - SysLog.csv`): this is not a one-off. Duplicate "Advancing to WAITING_WEB_EXPORT" rows from distinct execution IDs appear on 8/19, 8/20, 8/21, 8/23, 8/24, and 8/26. Worst observed: 8/24, 06:21:06–06:21:17, **twelve** distinct `INTERNAL-<uuid>` executions advancing the same session within an 11-second window (2026-08-26's own burst was five, at 06:47:57–06:48:04). Confirmed real — twelve *separate* Apps Script executions, not one execution logging repeatedly. **The 2026-08-25 log-dedup fix in `SyncStateService.setSyncState` does not help**: it only skips logging when one execution's own read-then-write sees no stage change; with no lock, overlapping executions each read the pre-transition stage before any of them writes back, so each legitimately sees a real transition from its own vantage point.

**This exact race was already diagnosed and staged 2026-06-14 — and never shipped.** `jlmops/plans/RELIABILITY_AUDIT.md` §1.3 documents an identical incident that same day (three concurrent runners — contexts `085635c1`/`e5142428`/`4918c516` — each advancing the same session within 5 seconds), traces it to the same non-idempotent, unlocked `_checkAndAdvanceSyncState`/`setSyncState`, and designs a 5-stage `LockService` rollout (`LockHelpers.withScriptLock` helper, then locking `setSyncState`/`processPendingJobs`/`purgeOldJobs`/`pullOrders` one at a time with 24h+ observation between each). **Confirmed nothing from that design ever shipped** — `LockHelpers`, `withScriptLock`, and `SyncStateService.mutateSyncState` don't exist anywhere in the repo (grepped). §1.3's own diagnosis already states the key correctness point the first draft of this section missed: *locking the write alone is not sufficient* — the read-modify-write must happen **inside** the lock (its proposed `mutateSyncState(fn)` re-reads state after acquiring the lock, applies the mutation, then writes), and the duplicate advances need an idempotency guard (no-op if the session is already at/past the target stage), not just mutual exclusion. §1.4 (a related, smaller fix — decide "changes vs. no changes" from `exportWebInventory`'s return value, not a re-read of clobberable state) **has already shipped** — confirmed live in `WebAppSync.js#generateWebExportBackend`, which reads `result.changed` and reports a `sync.web_export.state_clobber` failure if the re-read state disagrees. Only §1.3 itself (the lock/idempotency work) is outstanding.

**Call sites (corrected — the first draft missed the dominant one).** `_checkAndAdvanceSyncState()`/`processPendingJobs()` are reachable from: the real hourly Apps Script trigger (`runHourlyTrigger`); `WebAppSync.js`'s Push-Web-Inventory action (`OrchestratorService.run('hourly')` inline on a user click); `finalizeJobCompletion`'s inline `processPendingJobs()` call after any job completes; the recursive call inside `_checkAndAdvanceSyncState`'s own IMPORTING_COMAX branch (same execution, not a concurrency source, but worth a comment so it isn't mistaken for one); and — missed in the first draft — **`WebAppSync.js#getSyncStateFromBackend`, which calls `OrchestratorService.checkAndAdvanceSyncState()` on every widget poll**, at 1-second cadence during spinner stages (`AdminDailySyncWidget_v2.html`'s own polling design, already noted in this doc's May section above: "the UI is the engine"). Burst sizes of 5-12 concurrent executions line up with 1s polling far better than with any of the other four paths — this is almost certainly the dominant driver, and it must be in scope for locking, not left out.

**`HousekeepingService.js#performFrequentMaintenance` already guards against running during an active sync** (lines 596-603, shipped 2026-05-15 per `FREQUENT_PIPELINE_PLAN.md` — confirmed live, reads `SyncStateService.getActiveSession()` and skips if stage isn't IDLE/COMPLETE/FAILED). The first draft's fix #3 proposed adding this guard again and misattributed which function runs log cleanup/validation/Mailchimp pulls (that's `performDailyMaintenance`, a separate daily-cadence function, not this one) — drop that fix entirely, there's nothing to build here.

### Corrected fix: build RELIABILITY_AUDIT.md §1.3 as staged, with the polling call site in scope

Follow §1.3's existing stage sequence rather than a new design:

1. **Stage A** — ship `LockHelpers.js#withScriptLock(context, timeoutMs, fn)` exactly as specced (§1.3: `tryLock`, not `waitLock` — returns `null` and logs `lock-contention` on timeout rather than throwing). Smoke per §1.3 before proceeding.
2. **Stage B** — add `SyncStateService.mutateSyncState(fn)`: acquire the lock, **re-read** current state, apply `fn(state)`, write, release. Migrate `_checkAndAdvanceSyncState`'s stage-advance writes (all three branches — IMPORTING_COMAX, VALIDATING, PUSHING_WEB_INVENTORY) and `exportWebInventory`'s `webExportFilename` write to it. Add the idempotency guard §1.3 calls for: inside the mutation, no-op if the session is already at or past the target stage (this is what actually stops the duplicate-log symptom — the lock alone only serializes the writes, it doesn't stop a second execution from performing a now-redundant transition it read as "new" a moment earlier).
3. **In scope for Stage B, not deferred**: `getSyncStateFromBackend`'s poll-triggered call into `checkAndAdvanceSyncState()` — this is the highest-frequency caller (1s during spinner stages) and the likely dominant contributor to the observed bursts. Confirm it goes through the same locked/idempotent path as every other caller.
4. Stages C (`purgeOldJobs`), D (`processPendingJobs` pick-up), E (`pullOrders` start) — as specced in §1.3, each with its own 24h+ observation window before the next.

**What this drops from the first draft:** the "collapse `runHourlyTrigger`'s redundant call" fix — audit review found `processPendingJobs()`'s internal advance-check only fires when it actually processed a job (`jobsProcessedCount > 0`); the explicit call in `runHourlyTrigger` is the only path that re-checks advancement when nothing was PENDING that run, so removing it would silently drop real coverage, not just tidy redundancy.

**Verification:** re-run a real sync, pull a fresh SysLog export, confirm each real stage transition produces exactly one "State saved" row — across a full sync, not just one transition. Fire two concurrent state-advance attempts deliberately (per §1.3's own smoke-test pattern) and confirm one proceeds, one logs `lock-contention` and no-ops, and state stays consistent.

**Status:** plan corrected 2026-08-26 after independent review; not yet built. Next session should build Stage A first and stop for the 24h+ observation §1.3 calls for before Stage B, rather than shipping the whole sequence in one pass.

## Files in scope

- `jlmops/AdminDailySyncWidget_v2.html` — widget
- `jlmops/SyncStateService.js` — state machine + transition table (reference only)
- `jlmops/WebAppSync.js` — backend entry points (`getSyncStateFromBackend`, all `*Backend` functions)
- `jlmops/OrchestratorService.js` — async job advancement (`_checkAndAdvanceSyncState`, job status tracking)
