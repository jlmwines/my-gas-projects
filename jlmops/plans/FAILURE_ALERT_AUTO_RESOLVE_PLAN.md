# Failure Alert Auto-Resolve

Fix for the BUGS.md entry "Stale system-failure alerts stay on Admin dash" (2026-10-23). Every failure context that can report a failure should also clear it once the same operation next succeeds. Status: **draft, awaiting approval.** Nothing changed yet.

## How alerting works now

`NotificationService.reportFailure(context, …)` opens (or increments) one `task.system.failure` per context and, for High/Critical, adds an `urgentAlerts` entry to the System Health singleton (`jlmops/docs/ARCHITECTURE.md` §4.2). Its counterpart `resolveFailure(context)` completes that task and clears the alert. The task is keyed by `_entityIdFromContext(context)` (context minus its first segment, e.g. `sync.import_web_orders` → `import_web_orders`) and stored in `st_LinkedEntityId`.

Only two contexts ever call `resolveFailure`: `queue.failed_job_sweep` (@594) and `reconciliation.sys_contacts.write_verify`. Every other failure stays open until someone closes it by hand. `NotificationService.reportStepSuccess` (clears the alert only, not the task) exists but has no callers.

Not a source of this bug: daily-maintenance phase-1/phase-3 failures (incl. the @598 change) are written into the System Health singleton, which each run overwrites, not into failure tasks.

## Inventory of failure contexts (code, 2026-10-27)

**A. Repeating operation, clear success point: resolve on next success**

Success points traced 2026-10-27 (step 1 done). Line numbers are as of commit `a97e16b`.

| Context | Reported at | Resolve at (success point) |
|---|---|---|
| `sync.import_web_products` | `WebAppSync.js:102` (import failed and FAILED write didn't land) | `WebAppSync.js:110` `else` branch (import succeeded) |
| `sync.import_web_orders` | `WebAppSync.js:214` (same shape) | `WebAppSync.js:222` `else` branch |
| `sync.export_comax_orders` | `WebAppSync.js:348` (same shape) | `WebAppSync.js:314` `if (result.success)` branch |
| `sync.start_comax_import` | `WebAppSync.js:538` (same shape) | no success branch here: success is handed to `_checkAndAdvanceSyncState`; resolve with `sync.comax_product_import` at `OrchestratorService.js:1375` |
| `sync.api_pull_all` | `WebAppSync.js:1378` (same shape) | `WebAppSync.js:1386` `else` branch |
| `sync.comax_product_import` | `OrchestratorService.js:1397` | `OrchestratorService.js:1375` (`advanceResult.applied` to VALIDATING) |
| `validation.master_master` | `OrchestratorService.js:1428` (job FAILED) and `ValidationOrchestratorService.js:110` (quarantine) | `OrchestratorService.js:1448` (`advanceResult.applied` to WAITING_WEB_EXPORT) |
| `validation.<suite>` (all suites) | `ValidationOrchestratorService.js:110` (quarantine) | `ValidationOrchestratorService.js:117` path: suite finished without quarantine |
| `sync.web_inventory_push` | `OrchestratorService.js:1520` | `OrchestratorService.js:1476` (`advanceResult.applied` to COMPLETE) |
| `job.<jobType>` | `OrchestratorService.js:741` (zombie killer), `:1315` (poll reaper) | `OrchestratorService.setJobRowStatus` (`:626`): after a write that sets `status: 'COMPLETED'`, resolve `job.<row.job_type>`. Single point: every job processor's terminal write goes through it. Resolve **after** the lock closure returns, never inside it |
| `status_export.refresh` | `StatusReportService.js:577` (health) and `:599` (KPI) | **split into `status_export.refresh_health` / `status_export.refresh_kpi`**, each resolved on its own success (`:574` / `:596`). Shared today, so a 15-min health success would clear a still-failing daily KPI refresh |
| `status_export.calendar_merge` | `StatusReportService.js:737` | `StatusReportService.js:735` (success return) |
| `tests.empty_or_null_result` | `HousekeepingService.js:772` | same `if` at `:770`: `else` branch (`total > 0`) |

Context-to-task key note: `resolveFailure` finds the task by `_entityIdFromContext` (context minus first segment). `validation.master_master` from both reporters maps to the same task, which is intended.

**B. One-off events, no natural success point**

| Context | Reported at |
|---|---|
| `sync.web_export.state_clobber` | `WebAppSync.js:662` (race detected) |
| `integration.woo.response_oversize` | `WooApiService.js:142` |

Every success point above was confirmed by reading its function (2026-10-27).

## Approach

1. **Category A:** add `NotificationService.resolveFailure(<same context>, sessionId)` on each success path, mirroring the @594 failed-job sweep. `resolveFailure` is already a cheap no-op when nothing is open, and fails soft.
2. **Category B:** auto-close after a quiet period (user, 2026-10-27): daily housekeeping closes a category-B failure task (via `resolveFailure`, `resolvedBy: 'auto-quiet'`) once 7 days have passed with no new occurrence. The category-B context list lives in one place in code, next to the quiet-period constant.
3. **Remove `reportStepSuccess`** (dead, and a trap: it clears the alert but leaves the task open), or rewrite it as a thin wrapper over `resolveFailure`. Recommend remove.
4. **One-time cleanup** of currently open stale failure tasks: list them from a fresh `SysTasks` export; user decides which to close. No code needed if the count is small.

## Steps

1. ~~Trace each category-A success path; record the exact line.~~ Done 2026-10-27 (table above).
2. Implement category A in one change set; Tier-1 test for `resolveFailure` round-trip if not already covered.
3. Category B: 7-day quiet-period auto-close in housekeeping, keyed on the failure task's `notes.lastUpdated` (verified 2026-10-27: `_createFailureTask` sets it on creation and on every repeat occurrence; `notes.failures[].timestamp` holds each occurrence too). Both category-B contexts report at `High`, so each creates a task plus a health alert; `resolveFailure` clears both.
4. Deploy via `deploy.ps1`; verify with a real cycle: an open failure for a context closes after that context's next success (`jlmops-status.md` + Admin dashboard).
5. Update `jlmops/docs/ARCHITECTURE.md` §4.2: the report/resolve pairing is a rule for every context; close the bug; archive this plan.

## Adjacent, out of scope

BUGS.md 2026-08-04: failure tasks put the dedup key in `st_LinkedEntityId`, which breaks entity-drawer lookups. Same service; fixing it changes how `resolveFailure` finds tasks, so it should be planned separately and not mixed into this change.
