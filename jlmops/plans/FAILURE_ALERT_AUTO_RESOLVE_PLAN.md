# Failure Alert Auto-Resolve

Fix for the BUGS.md entry "Stale system-failure alerts stay on Admin dash" (2026-10-23). Every failure context that can report a failure should also clear it once the same operation next succeeds. Status: **draft, awaiting approval.** Nothing changed yet.

## How alerting works now

`NotificationService.reportFailure(context, …)` opens (or increments) one `task.system.failure` per context and, for High/Critical, adds an `urgentAlerts` entry to the System Health singleton (`jlmops/docs/ARCHITECTURE.md` §4.2). Its counterpart `resolveFailure(context)` completes that task and clears the alert. The task is keyed by `_entityIdFromContext(context)` (context minus its first segment, e.g. `sync.import_web_orders` → `import_web_orders`) and stored in `st_LinkedEntityId`.

Only two contexts ever call `resolveFailure`: `queue.failed_job_sweep` (@594) and `reconciliation.sys_contacts.write_verify`. Every other failure stays open until someone closes it by hand. `NotificationService.reportStepSuccess` (clears the alert only, not the task) exists but has no callers.

Not a source of this bug: daily-maintenance phase-1/phase-3 failures (incl. the @598 change) are written into the System Health singleton, which each run overwrites, not into failure tasks.

## Inventory of failure contexts (code, 2026-10-27)

**A. Repeating operation, clear success point: resolve on next success**

| Context | Reported at | Success point to resolve at |
|---|---|---|
| `sync.import_web_products` | `WebAppSync.js:102` | same function, success path |
| `sync.import_web_orders` | `WebAppSync.js:214` | same |
| `sync.export_comax_orders` | `WebAppSync.js:348` | same |
| `sync.start_comax_import` | `WebAppSync.js:538` | same |
| `sync.api_pull_all` | `WebAppSync.js:1378` | same |
| `sync.comax_product_import` | `OrchestratorService.js:1397` | job completes |
| `sync.web_inventory_push` | `OrchestratorService.js:1520` | push completes |
| `job.<jobType>` | `OrchestratorService.js:741, 1315` | next COMPLETED job of that type |
| `validation.<suite>` (incl. `master_master`, also `OrchestratorService.js:1428`) | `ValidationOrchestratorService.js:110` | suite run with no failures |
| `status_export.refresh` | `StatusReportService.js:577, 599` | next successful refresh |
| `status_export.calendar_merge` | `StatusReportService.js:737` | next successful merge |
| `tests.empty_or_null_result` | `HousekeepingService.js:772` | next run with `total > 0` |

**B. One-off events, no natural success point**

| Context | Reported at |
|---|---|
| `sync.web_export.state_clobber` | `WebAppSync.js:662` (race detected) |
| `integration.woo.response_oversize` | `WooApiService.js:142` |

Each success point above must be confirmed by reading the function before it is changed; this table is from the call-site survey, not a full trace.

## Approach

1. **Category A:** add `NotificationService.resolveFailure(<same context>, sessionId)` on each success path, mirroring the @594 failed-job sweep. `resolveFailure` is already a cheap no-op when nothing is open, and fails soft.
2. **Category B:** auto-close after a quiet period (user, 2026-10-27): daily housekeeping closes a category-B failure task (via `resolveFailure`, `resolvedBy: 'auto-quiet'`) once 7 days have passed with no new occurrence. The category-B context list lives in one place in code, next to the quiet-period constant.
3. **Remove `reportStepSuccess`** (dead, and a trap: it clears the alert but leaves the task open), or rewrite it as a thin wrapper over `resolveFailure`. Recommend remove.
4. **One-time cleanup** of currently open stale failure tasks: list them from a fresh `SysTasks` export; user decides which to close. No code needed if the count is small.

## Steps

1. Trace each category-A success path (one function at a time); record the exact line.
2. Implement category A in one change set; Tier-1 test for `resolveFailure` round-trip if not already covered.
3. Category B: 7-day quiet-period auto-close in housekeeping, keyed on the failure task's `notes.lastUpdated` (verified 2026-10-27: `_createFailureTask` sets it on creation and on every repeat occurrence; `notes.failures[].timestamp` holds each occurrence too). Both category-B contexts report at `High`, so each creates a task plus a health alert; `resolveFailure` clears both.
4. Deploy via `deploy.ps1`; verify with a real cycle: an open failure for a context closes after that context's next success (`jlmops-status.md` + Admin dashboard).
5. Update `jlmops/docs/ARCHITECTURE.md` §4.2: the report/resolve pairing is a rule for every context; close the bug; archive this plan.

## Adjacent, out of scope

BUGS.md 2026-08-04: failure tasks put the dedup key in `st_LinkedEntityId`, which breaks entity-drawer lookups. Same service; fixing it changes how `resolveFailure` finds tasks, so it should be planned separately and not mixed into this change.
