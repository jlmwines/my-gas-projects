# System Task Lifecycle — Plan

**Created:** 2026-06-02

## Problem

System-created failure tasks (`task.system.failure`, raised via `NotificationService.reportFailure`) are created but **never closed**. Once raised, a task persists indefinitely even after its underlying condition clears, and there is **no user-facing way to dismiss it**. The manager/admin sees a stale "System Failure: …" task forever. First surfaced concretely by `reconciliation.sys_contacts.write_verify` (persisted after the contacts rebuild succeeded) and previously by `task.system.deployment_drift` (recurring, un-closable — `.claude/bugs.md`).

## Current state (as of 2026-06-02)

- `reportFailure(context, …)` **de-dupes**: one open `task.system.failure` per derived `entityId` (context minus its prefix); repeat failures bump an `occurrenceCount` in notes rather than creating duplicates.
- The only "clear on success" code — `reportStepSuccess` → `clearAlerts` — clears the **health-status banner** (`task.system.health_status` singleton's `urgentAlerts`). It does **not** touch the `task.system.failure` task.
- Result: failure tasks have no auto-resolve and no manual close.

Two failure classes need two different remedies:
- **Recurring/scheduled checks** (reconciliations, sync steps, validations) → can auto-resolve when the next run passes.
- **One-shot failures** (a transient job error, deployment-drift) → have no recurring "success" event, so they need a manual dismiss.

## Shipped this session (targeted slice)

- `NotificationService.resolveFailure(context, sessionId)` — symmetric counterpart to `reportFailure`. Finds the open `task.system.failure` for the context's `entityId`, stamps `resolvedAt`/`resolvedBy: 'auto'` in notes, completes it, and clears the matching health alert. No-op if none open (safe to call every run).
- `_entityIdFromContext(context)` — extracted shared helper used by **both** `reportFailure` (raise) and `resolveFailure` (clear) so the two sides can never drift.
- `ContactImportService.updateContactsFromOrders` — the write-verify `if (mismatch) reportFailure(…)` now has an `else { resolveFailure('reconciliation.sys_contacts.write_verify', sessionId) }`. First consumer of the pattern.

## Phase 1 — auto-resolve rollout (recurring checks)

Convention to adopt: **any `reportFailure(context)` on a schedulable check gets a paired `resolveFailure(context)` on its success path.** Document this in the `RELIABILITY_AUDIT` CCP pattern (CCP-1 failure path already standardized there; add a CCP "clear path" twin).

High-leverage first move: make **`reportStepSuccess`** also call `resolveFailure(context)` (it already computes the step context and is already called on every sync-step success) — this auto-closes sync-step failure tasks with zero per-caller changes.

Then wire `resolveFailure` into the success branches of the remaining live reporters:
- `ValidationOrchestratorService.js:94` — on a clean validation pass.
- `OrchestratorService.js:585, 1149, 1210, 1237, 1304` — on the corresponding job/step success (map each to its context; several may already flow through `reportStepSuccess`).
- Future `RELIABILITY_AUDIT` checks raise + clear as a pair from the start: `queue.failed_job_sweep`, `tests.empty_or_null_result`, `status_export.refresh`, `snapshot.failed`, `integration.woo.response_oversize`.

## Phase 2 — manual close (one-shot failures)

For failures with no recurring success event, add a dashboard dismiss action.
- **Backend:** a WebApp endpoint to complete a `task.system.*` task by id (reuse `TaskService.completeTask`); guard it to system task types so it can't be used to silently close operational work. Stamp `resolvedBy: 'manual'` + the acting user in notes.
- **UI:** a "Dismiss" / "Resolve" button on system-failure rows (admin dashboard task card and/or `AdminTasksView`). Currently these rows have no close affordance.
- Closes the `deployment_drift` "can't be UI-closed" complaint in `.claude/bugs.md`.

## Open considerations

- **Severity/tolerance** (option a from the write-verify bug): the inline reconciliation uses exact `!==` at **High**, stricter than the reliability audit's own `<1%` tolerance (`RELIABILITY_AUDIT` Tier 3.4 `aggregate_check_tolerance_pct`). With auto-resolve in place, immaterial drift self-clears each run, lowering the urgency to fix this — but the exact check can still raise a transient High between a real cancellation and the next rebuild. Decide whether to align the inline check to the tolerance + lower severity, or leave it (now self-healing).
- **Idempotency:** `resolveFailure` is a safe no-op when nothing is open; call it unconditionally on the success path.
- **Auditability:** resolution stamps `resolvedAt` + `resolvedBy` (`auto` vs `manual`) in task notes.

## Relationships

- `RELIABILITY_AUDIT.md` — CCP-1/CCP-3 reporting pattern (Phase 1 extends it with the clear-path twin); Tier 3.4 scheduled aggregate-consistency check shares the reconciler + tolerance question.
- `.claude/bugs.md` — `deployment_drift` (no UI close path) resolved by Phase 2; `reconciliation.sys_contacts.write_verify` root cause + this session's targeted slice.
