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

## Review pass (2026-06-10)

Re-checked the plan against shipped code and the consumer skill. The bridge is **half-open: the producer shipped, the consumer was never wired.**

- **P0 producer — SHIPPED 2026-06-03** (@217, commit `437e015`). `StatusReportService.refreshLiveBlocks` writes `jlmops-status.md` to the exports folder on every productive `performFrequentMaintenance` fire. Live blocks only (System / Integrations / Queue / Data quality / Capacity / Recent errors); KPI block still deferred. The "**Not built yet**" notes in "What already exists" below are stale — see `RELIABILITY_AUDIT.md` §3.2 for the as-built detail (and its three documented deviations: KPI block deferred, find-or-create-by-name placement, productive-fires-only refresh).
- **Open question #1 (headless Drive MCP) still gates P1–P3** and is untouched — correctly deferred; it only matters for the scheduled/push variant, which the current pull-mode scope doesn't need.

Plan reasoning remains sound and internally consistent; no design changes needed. The build-status framing was stale (corrected) and the consume leg was unbuilt — now closed (below).

**✅ CONSUME LEG WIRED 2026-06-10.** `/review-daily` now reads `jlmops-status.md` (skill at `~/.claude/commands/review-daily.md`), closing the interactive pull loop end-to-end: producer writes every ~15 min, the daily review reads it each run. What was done:
1. **Reads step 5** added — fetch `jlmops-status.md` via Drive MCP. **Deviation from the flagged spec:** located by **title search**, not by file ID. The ID lives in SysConfig (`system.file.status_report`) and isn't exposed to a CLI session; the producer also finds-or-creates the file by name (a §3.2 as-built deviation), so title search is both available and robust to ID changes. Graceful one-line no-op if Drive MCP is absent that run.
2. **Pulse rule** added — open `task.system.failure` rows and a stale `generated_at` (no refresh in many business hours) surface in the Pulse output bullet; otherwise silent.
3. **Posture reconciled, not just appended.** The skill's `Skip by default` line and its "Pulling Drive… preemptively" anti-pattern both target the heavy multi-tab pulls (`JLMops_Data`/GSC/GA4); both were amended to explicitly carve out the single-file ops export, so a future session doesn't read the anti-pattern and stop reading the export.
4. **Scope guard honored** — read-only, flag-don't-fix, per the skill's existing rules and the plan's consumer guardrail.
5. **`/review-deep` not wired** — daily is the right cadence for ops-health glance; revisit only if deep reviews want it too.

## Active build plan (2026-06-10): OPS supplies BOTH health + KPI to sessions — on cadence AND on-demand

Locks the scope discussed with the user. **OPS is the sole reader of the source systems and writes everything a session needs into the one flat file `jlmops-status.md`.** Two data kinds (system health + KPI), two trigger modes (scheduled + an on-demand admin button). The on-demand control pushes **both** blocks — it is not health-only.

**State going in.** Health blocks ship and run on the 15-min cadence (`refreshLiveBlocks`, @217). The KPI block (`refreshKpiBlock`) is fully specced (§3.2 "KPI block scope", 2026-06-04) but **not built**. **Status 2026-06-10: ✅ SHIPPED @287 — smoke PASSED.** Deployed; `rebuildSysConfigFromSource()` run; Dev → Push Status Export verified live via Drive MCP read of `jlmops-status.md`. Both sections render and coexist (section-aware write holds). Internal KPIs correct (orders counting — `wom_Status` assumption held). **GA4 Traffic working** — `data_tab` guess (`JLM GA4 Weekly`) was right, no config fix needed. **GSC** shows the fail-soft `no Date dimension yet` line — its tab still holds the old Page-only data; populates after the next dated GSC fetch (monthly/3rd, or re-run the request with Date grouped). The export is already surfacing real signals (Woo Orders STALE, 13 failed jobs, overnight Comax schema-mismatch). GA4/GSC source pulls restored (step 0).

**Build steps, in order:**

0. **Foundation gate — restart the source pulls. ✅ DONE 2026-06-10 (user-side).** Both add-ons re-enabled and refreshing: GA4 ("JLM GA4 Weekly") confirmed refreshed 2026-06-10; GSC ("JLM GSC Weekly") set to **monthly (3rd)** via Search Analytics for Sheets, recurring backup re-enabled, and a **Date dimension added** (was Page-only → no trend accumulated; now dated rows stack). **Effect on the STATUS `defer:2026-06-15` trajectory item:** the pulls now feed the rolling window (near-term trend), but long-run trajectory is the **trend spine** (`KpiData` history) this build keeps OUT. So the 6-15 item resolves as: pulls restored, accept rolling-90-day (+ the new GSC dated rows) as the trend horizon for now, build the `KpiData` spine later only if longer history is wanted — NOT a full close.

1. **Register the source IDs in config.** Add `system.sheet.ga4_report = 12zBAZZPfhWqLGLsf1Lu8-eOMcYKOyi_HrlGkSmPkTFU` + `system.sheet.ga4_data_tab`, and `system.sheet.gsc_report = 1535CDgL8oD8o2L5ceOTAXtxrXGVnRgQfEddfc3b6hHc` + `system.sheet.gsc_data_tab`, to `config/system.json` → `node generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`. (IDs verified live 2026-06-10; also in `business/KPI.md` + `reference_drive_files` memory.)

2. **Make both writers section-aware (retrofit — do BEFORE the KPI block coexists).** Today `refreshLiveBlocks` does an atomic full-rewrite; once two cadences *and* a button write the same file, a full rewrite clobbers whichever block it didn't generate. Wrap each block in sentinel markers (`<!-- health:start -->…<!-- health:end -->`, `<!-- kpi:start -->…<!-- kpi:end -->`); each writer replaces only its own section and preserves the other. (§3.2 "Single-file write correction.")

3. **Build `refreshKpiBlock(sessionId)`** per §3.2 part 2 (ops mirror). OPS opens the GA4 + GSC workbooks by ID (`SpreadsheetApp.openById(id).getSheetByName(dataTab).getDataRange().getValues()` — the multi-tab limit is Claude's Drive path only, not GAS), aggregates the window, and writes a **Traffic** subsection (GA4 sessions/users/engagement/keyEvents; GSC clicks/impressions/avg-position) alongside **internal KPIs** (today/week/month orders + revenue from WebOrdM, AOV, new-vs-returning via `sc_FirstCompletedDate`, EN/HE split) using fresh aggregators in `StatusReportService.js` (V2-dashboard refactor stays deferred to Tier 6.8). Each external metric stamped with its tab's max date; an empty tab renders "no data (last refresh <date>)" rather than throwing (CCP-1). Wire into daily housekeeping Phase 3. (Trend spine / `KpiData` append, §3.2 part 3, is optional and NOT in this build.)

4. **On-demand Developer control (pushes both).** One button on `DevelopmentView.html` — "Push Status Export Now (Health + KPI)" — copying an existing button + `google.script.run` handler in that file, calling a new thin `WebAppSystem_refreshStatusExport()` wrapper that invokes **both** `refreshLiveBlocks()` and `refreshKpiBlock()` (mirrors the existing `WebAppSystem_runUnitTests` entry). Success → `TaskWidgets.toast`. Backend `refreshLiveBlocks` already exists and is exported; the wrapper + button are the only new surface. (If KPI refresh proves slow in practice, split into two buttons — a trivial variation, decided at build time, not now.)

5. **Smoke.** Click the button → read `jlmops-status.md` via Drive MCP → confirm **both** the health section and the KPI section show current data with fresh IL timestamps, and neither clobbered the other (section-aware write holds). Then confirm the daily trigger refreshes the KPI block unattended, and the 15-min tick keeps refreshing health without wiping KPIs.

**Result.** Sessions read one file carrying live health (15-min tick + button) and KPIs (daily tick + button), all placed by OPS; no session ever touches a source system. The deferred P1/P3 push-mode pieces (token endpoint, headless routine, machine-readable JSON) stay out of scope — this is the interactive pull bridge, made complete for both data kinds.

## What already exists / is designed (don't rebuild — extend)

- **Producer is mostly specced in `RELIABILITY_AUDIT.md` Tier 3.2** — `jlmops-status.md`, a single Claude-readable markdown file regenerated on the 15-min `runFrequentMaintenance` cadence (live blocks) + daily (KPI block), written via `DriveApp.getFileById(statusFileId).setContent(markdown)`, wrapped in `reportFailure('status_export.refresh', …)` so a regen failure never breaks maintenance. Sections: System / Integrations / Queue / Data quality / Capacity / KPIs / Recent errors. New `StatusReportService.js` + `LoggerService.getRecentErrors(n)`. **Live blocks SHIPPED 2026-06-03 (@217, commit `437e015`); KPI block (`refreshKpiBlock`) still deferred — see Review pass (2026-06-10) above.**
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

- **P0 — producer + consumer. ✅ COMPLETE (both halves).** Health: producer SHIPPED 2026-06-03, consume leg WIRED 2026-06-10. KPI + on-demand control: SHIPPED @287 2026-06-10 (smoke passed — see Active build plan above). OPS now supplies BOTH health + KPI into `jlmops-status.md`, on cadence (15-min health / daily KPI) + on-demand (Dev → Push Status Export). Only tail: GSC Traffic populates once its dated fetch lands.
- **P1 — machine block + headless transport.** Add the JSON block and the token-gated read endpoint.
- **P2 — event trigger.** Hook `refreshLiveBlocks` into `reportFailure` for High/Critical.
- **P3 — consumer routine.** Author the `/schedule` routine (read → triage → diagnose → report), read-only.
- **P4 — mirror/DR.** Tier 4.1 off-account mirror (independent track).

## Open questions (need user/decision before P1–P3)

1. **Headless Drive MCP** — does a `/schedule` remote routine actually have Drive MCP? Quick experiment: schedule a one-off routine that tries to read a known Drive file by ID; if it can't, commit to the token-gated endpoint (option 1). This single test de-risks the whole consumer side.
2. **Consumer cadence** — daily morning digest only, or also a tighter reactive poll (e.g., hourly) that depends on the event-triggered export? Tighter = faster error response, more session spend.
3. **Auto-fix boundary** — confirm read-only diagnosis only (recommended), vs allowing the routine to open a branch/PR with a proposed fix for human review (more automation, still no live deploy).
4. **Endpoint security** — acceptable to expose an `ANYONE`-access token-gated read endpoint returning ops health (no PII)? If not, the consumer is interactive-only.

## Inbound: session → ops change requests (idea, 2026-06-02, from user)

The producer/consumer above is **ops → session** (read). The natural counterpart is **session → ops writes**: tell a Claude session a real-world fact and have it enacted in ops, instead of hand-editing jlmops. Motivating example (user): "the carton manufacturers are both unavailable (war + relocation) — delay that task a week." Today the user must *also* open ops and change the task's due date by hand. The interface would let them say it once to a session and have the change applied.

**Shape:**
- The session emits a **structured change request** against a task (or other ops entity): e.g. `{action: 'reschedule', taskRef, newDueDate, reason}`. Other actions: `reassign`, `add_note`, `close`, `create_task`.
- It lands in an **ops inbox the backend picks up** — e.g. a `SysChangeRequests` tab (single-tab, Drive-MCP-writable so even a session can append) *or* a token-gated write endpoint — and jlmops applies it on its next maintenance tick (or on demand), with validation + a `SysLibraryActivity`/task-notes audit entry.
- **Target resolution:** identify the task by stable `st_TaskId` where the session has it (e.g. straight off the dashboard/export); otherwise surface candidates by description and have the user pick — never guess a destructive target.

**Guardrails (consistent with project discipline):** every applied change is logged (who / what / why); destructive or ambiguous changes require explicit in-session confirmation before they're written; ops stays the system of record and the validator (it can reject an illegal change). Both bridge directions stay human-confirmed.

**Status:** idea captured, not designed in depth. Pairs with the read bridge — a session could read ops state (status export) *and* request well-scoped changes back, closing the loop the user described.

## Relationships

- `RELIABILITY_AUDIT.md` Tier 3.2 (producer), Tier 4.1 (DR mirror), Tier 3.1 (heartbeats feeding the export).
- `SYSTEM_TASK_LIFECYCLE_PLAN.md` — `resolveFailure` keeps `open_failures` live/de-noised, which is what makes the consumer's triage trustworthy.
- `reference_drive_files` (transport scope), `KPI_SUMMARY_TAB.md` (KPI source; user prefers periodic review over a built dashboard — this export is the lighter-weight way to surface KPIs without the parked dashboard tab).
