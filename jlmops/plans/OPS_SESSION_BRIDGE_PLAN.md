# Ops ↔ Session Bridge — Plan

**Created:** 2026-06-02

## Goal

Let JLMops selectively export operational signal (system errors, KPIs) to a place Claude sessions can read, and let a **scheduled** Claude session pick up those exports, examine them, and diagnose errors — with as much of the loop automated as is safe. Producer = JLMops (GAS). Consumer = a scheduled Claude routine. Transport = a Drive file (and/or a token-gated read endpoint).

## Decision & current scope (2026-06-02, with user)

**Pull-mode, human-initiated.** The user always has a CLI session available and folds an ops check into the daily session routine. So the Claude-side automation is **not** needed and is deferred:

- **IN (build):** the producer — JLMops writes a Claude-readable `jlmops-status.md` (open system errors + KPIs + recent errors), refreshed on the existing maintenance cadence. This is the load-bearing piece: a CLI session cannot otherwise see ops state — `JLMops_Data`/`Logs` are multi-tab so Drive MCP can't read them, and the web app is domain-auth so WebFetch can't reach it. The export is the only window a session has.
- **IN (consume):** fold "read the ops status, flag anything needing attention" into the existing **`/review-daily`** skill, so it runs as part of the routine the user already does.
- **DEFERRED (not now):** the scheduled Claude routine, the token-gated read endpoint, the headless-MCP catch (§"The one real catch" below), and event-triggered exports. These only buy *push* (notify me without my asking); revisit only if the pull workflow ever feels too slow.
- **UPSTREAM DEPENDENCY — detection coverage.** The export can only report what the system *detects*. Making sure everything that should be detected *is* (archiving happening, master ∪ archive in analysis, orphans / referential integrity, reconciliation, liveness) is tracked as a first-class requirement in `RELIABILITY_AUDIT.md` §1A. This plan is the Communicate leg; §1A is the Detect leg. The export is only as trustworthy as that coverage.

The sections below retain the fuller push-mode design for if/when it's wanted — treat them as deferred detail, not current scope.

## What already exists / is designed (don't rebuild — extend)

- **Producer is mostly specced in `RELIABILITY_AUDIT.md` Tier 3.2** — `jlmops-status.md`, a single Claude-readable markdown file regenerated on the 15-min `runFrequentMaintenance` cadence (live blocks) + daily (KPI block), written via `DriveApp.getFileById(statusFileId).setContent(markdown)`, wrapped in `reportFailure('status_export.refresh', …)` so a regen failure never breaks maintenance. Sections: System / Integrations / Queue / Data quality / Capacity / KPIs / Recent errors. New `StatusReportService.js` + `LoggerService.getRecentErrors(n)`. **Not built yet.**
- **Tier 4.1** mirrors that file to an off-account (`kosbracha@gmail.com`) Drive folder for DR.
- **Error surface:** `NotificationService.reportFailure` → de-duped `task.system.failure` tasks + `task.system.health_status` singleton; `resolveFailure` (shipped @202) now auto-closes them on recovery (`SYSTEM_TASK_LIFECYCLE_PLAN.md`). So "open system errors" = open `task.system.failure` rows; this is the clean signal to export.
- **KPIs:** `KpiService.js` is a stub; aggregations live in `WebAppDashboardV2.js`. Tier 3.2 plans fresh aggregators.
- **Transport (interactive):** Drive MCP authenticated as `accounts@jlmwines.com` CAN read a single markdown/Doc file by ID (`reference_drive_files`). So an *interactive* session can already read the export once Tier 3.2 ships.
- **Triggers:** GAS time-driven triggers already run `runFrequentMaintenance` (15 min, business hours) + `runDailyMaintenance`. Event hooks available inside `reportFailure`.
- **Scheduling Claude:** the `/schedule` skill (CronCreate) creates scheduled *remote* agents (routines) on a cron.

So three of the four mechanical questions are already answered yes: JLMops can export on a schedule (triggers), can export on a condition (hook `reportFailure`), and Claude can be scheduled (`/schedule`).

## The one real catch: can a scheduled (headless) Claude session read the Drive export?

The harness note is explicit: **"interactively-authenticated MCP servers (e.g. claude.ai) may be absent in headless/cron runs."** Drive MCP is interactively authed. So a cron/remote routine may NOT have Drive MCP — which would break "scheduled session reads the Drive file." This is the pivotal design decision and should be resolved by a quick experiment before building the consumer (see Open Questions).

Transport options, ranked by headless-friendliness:
1. **Token-gated GAS read endpoint (most headless-safe).** A *separate* web-app deployment with `access: ANYONE` exposing `doGet(?ops=<secret-token>)` that returns the status JSON (read-only, ops-health only, no PII). A scheduled routine `WebFetch`es it — no MCP needed. The main app stays `DOMAIN`-auth; this is a narrow, token-checked, read-only sibling. Security: rotate token in SysConfig, return 403 on mismatch, never include customer data.
2. **Drive file + Drive MCP (works interactively, uncertain headless).** Build Tier 3.2 as-is; fine for a human-initiated session, contingent for cron. Verify headless availability first.
3. **Git-committed snapshot (no live ops write path).** JLMops can't push to git (it's GAS); would need a local scheduled `clasp pull`-style bridge. Rejected — adds a moving part.

Recommendation: **build Tier 3.2's Drive file as the canonical artifact, AND add the token-gated read endpoint as the headless transport** (same `StatusReportService` builds the payload once; two sinks). That makes the bridge work for both interactive and scheduled sessions.

## Producer extensions beyond Tier 3.2

1. **Machine-readable block.** Tier 3.2's markdown is for humans. Add a fenced ```json block (or a sibling `jlmops-status.json`) with a stable schema so a session can detect state without prose-parsing:
   ```json
   { "generated_at": "<IL ISO>", "status": "OK|ATTENTION",
     "open_failures": [ { "context": "...", "severity": "...", "firstOccurrence": "...", "occurrenceCount": N, "lastMessage": "..." } ],
     "kpis": { "orders_today": N, "revenue_week": N, "new_vs_returning": "...", "lang_split": "..." },
     "sync": { "stage": "...", "last_housekeeping": "<ts>" } }
   ```
   `open_failures` is sourced directly from open `task.system.failure` rows (already de-duped, and now self-healing via `resolveFailure`, so the list reflects *live* problems, not stale ones).
2. **Event-triggered refresh.** In `reportFailure`, after creating/deduping a `High`/`Critical` task, call `StatusReportService.refreshLiveBlocks(sessionId)` inline so the export updates the moment a serious error is raised — not just on the 15-min tick. Keep it cheap and reportFailure-safe (own try/catch; a refresh failure must not break the caller). Periodic refresh stays as the baseline/heartbeat.

## Consumer: the scheduled Claude routine

A `/schedule` routine (e.g., daily morning + optional more frequent) that:
1. Reads the export (token endpoint via WebFetch, or Drive MCP if headless-available).
2. If `status == OK` → emit a one-line "all clear + KPI digest" and stop (cheap).
3. If `status == ATTENTION` → for each `open_failure`, **diagnose read-only**: map `context` to the owning service (we have the `reportFailure` call-site map), read the relevant code, determine likely root cause, and produce a written diagnosis + proposed fix.
4. Report the digest + diagnoses back to the user (routine output / notification). **Stop there.**

**Guardrail (hard):** the routine diagnoses and proposes; it does **not** auto-fix or auto-deploy. Fixes and deploys remain human-approved per project discipline (`feedback_report_not_ship_order`, deploy-OK rule). The value is "every morning, the open ops errors arrive already triaged with a root-cause and a proposed fix," not autonomous remediation.

This also composes with the lifecycle work: because `resolveFailure` self-closes transient errors, the consumer only ever sees *persistent* problems worth a human's attention — low false-positive rate.

## Phasing

- **P0 — producer.** Build `RELIABILITY_AUDIT` Tier 3.2 (`StatusReportService` + `jlmops-status.md` + `getRecentErrors`). This is the prerequisite and is already in the audit queue.
- **P1 — machine block + headless transport.** Add the JSON block and the token-gated read endpoint.
- **P2 — event trigger.** Hook `refreshLiveBlocks` into `reportFailure` for High/Critical.
- **P3 — consumer routine.** Author the `/schedule` routine (read → triage → diagnose → report), read-only.
- **P4 — mirror/DR.** Tier 4.1 off-account mirror (independent track).

## Open questions (need user/decision before P1–P3)

1. **Headless Drive MCP** — does a `/schedule` remote routine actually have Drive MCP? Quick experiment: schedule a one-off routine that tries to read a known Drive file by ID; if it can't, commit to the token-gated endpoint (option 1). This single test de-risks the whole consumer side.
2. **Consumer cadence** — daily morning digest only, or also a tighter reactive poll (e.g., hourly) that depends on the event-triggered export? Tighter = faster error response, more session spend.
3. **Auto-fix boundary** — confirm read-only diagnosis only (recommended), vs allowing the routine to open a branch/PR with a proposed fix for human review (more automation, still no live deploy).
4. **Endpoint security** — acceptable to expose an `ANYONE`-access token-gated read endpoint returning ops health (no PII)? If not, the consumer is interactive-only.

## Relationships

- `RELIABILITY_AUDIT.md` Tier 3.2 (producer), Tier 4.1 (DR mirror), Tier 3.1 (heartbeats feeding the export).
- `SYSTEM_TASK_LIFECYCLE_PLAN.md` — `resolveFailure` keeps `open_failures` live/de-noised, which is what makes the consumer's triage trustworthy.
- `reference_drive_files` (transport scope), `KPI_SUMMARY_TAB.md` (KPI source; user prefers periodic review over a built dashboard — this export is the lighter-weight way to surface KPIs without the parked dashboard tab).
