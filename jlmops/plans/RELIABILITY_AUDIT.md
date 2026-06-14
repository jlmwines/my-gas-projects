# Reliability Audit & Path Forward, jlmops

**Status:** Active remediation audit — ~7 of 16 sessions shipped (the 2026-06-03 push); the rest is open intent in the §5 session queue. Durable reliability facts that have shipped (two-tier stuck-job recovery, the UI-managed vs code-installed trigger model, severity-routed alerting + the SysJobQueue DLQ) are graduated to `../docs/ARCHITECTURE.md` §4. **Owner:** session-driven; user observes and tests.

## 1. Why this exists

JLMops is business-critical (product sync, order flow, packing, CRM, content library) and currently under-protected and under-monitored:

- Disaster recovery is one sentence in `ARCHITECTURE.md` §4.4: "manual backup and restore of Sheets." No documented procedure, no scheduled snapshots, no recovery drill on record.
- Drift detection is broken (`validateDeployment` false-positives daily, four orphan deployments live in the deployments list, see `.claude/bugs.md` 2026-05-27).
- Alerting fires per ERROR but there is no trend view, capacity telemetry, integration heartbeat, or aggregate-consistency check on schedule.
- Tracking discipline has decayed: 7 items in the 2026-05-28 session alone shipped without their `.claude/bugs.md` / STATUS entries reflecting reality. Real state and recorded state drift apart.

This plan defines the path from ad-hoc resilience to a documented, measured posture that survives single-person bandwidth.

## 1A. Detection coverage — cross-cutting requirement (added 2026-06-02, from user)

The export / alerting work (`OPS_SESSION_BRIDGE_PLAN.md`, the dashboard, `resolveFailure`) is the **Record → Communicate** leg. It is worthless without the **Detect** leg: the system can only report failures it actually checks for. Today detection is *ad hoc* — checks exist where someone thought to add one, with no master list of what *should* be checked. Closing that is a first-class goal of this plan, not an afterthought. Concern raised by the user: "make sure everything the system should be detecting is detected, and that I or the session is made aware — no gaps between detection and communication."

Two artifacts to build and maintain:

**(1) Detection register.** One catalog of every system invariant: the invariant, its check function (or "NONE — gap"), severity, whether it's wired to `NotificationService.reportFailure`, and whether it reaches the status export / dashboard. A gap = any invariant with no check, or a check not wired to communication. Recurring invariant *classes* to seed it:
- **Archiving actually happens** — every high-volume master that should archive is archiving (not silently stalled); newly-added high-volume data gets archive handling.
- **Master ∪ archive in analysis** — every analytical/aggregate read over a master also reads its archive. This is the exact root cause of the write-verify bug (contact aggregates read `WebOrdM` but not `WebOrdM_Archive`, `.claude/bugs.md` 2026-05-28). Treat as a class — audit every aggregator, not one site.
- **Referential integrity / orphans** — every FK edge has no danglers: SKU across `WebProdM`/`WebProdS_EN`/`WebDetM`/`WebDetS`/`WebXltM`/`SysProductAudit`/`SysTasks`/`CmxProdM` (Fix Orphan SKU territory; `webProductReassign` latent gap); `SysTasks.st_ProjectId → SysProjects` (the PROJ-CONTENT rename can orphan tasks); `task.st_LinkedEntityId → entity`; contact↔order (email); bundle slot→product; campaign links (`spro_CampaignId`, `scm_MarketingCampaignId`).
- **Aggregate reconciliation** — stored aggregates match their source within tolerance (generalize the CCP-3 write-verify pattern; identify which other aggregates need a reconciliation twin).
- **Liveness** — every scheduled check/trigger is actually running; a detector that silently stopped is itself an undetected gap (ties to Tier 3.1 heartbeats).
- (Already partly covered: schema validation — daily Phase 2; sync-state stage guards.)

**(2) New-feature reliability gate.** A short checklist applied whenever anything new is added, so coverage grows with the system instead of drifting behind it:
- Does this produce data that needs **archiving**?
- Does any **analysis** of it read **master ∪ archive**?
- Does it add an **FK edge** that needs **orphan detection**?
- Does it need an **aggregate reconciliation** twin?
- Is its detector **wired to `reportFailure`** and surfaced (dashboard + export)?

**Concrete next step (user-requested):** audit current detection coverage against these classes and produce the actual gap list (which aggregators don't union archive; which FK edges have no orphan check; what isn't archiving). That gap list feeds the tiers below and seeds the register. Every detected violation must terminate in `reportFailure` (→ self-healing task via `resolveFailure`, see `SYSTEM_TASK_LIFECYCLE_PLAN.md`) AND the status export, so neither the user nor a CLI session has a blind spot.

## 2. Scope

**In scope**

- jlmops GAS code, deployment, triggers
- The three workbooks: `JLMops_Data`, `JLMops_Library`, `JLMops_Logs`
- `SysConfig`, `SysJobQueue`, `SysLog`
- Integrations: Comax CSV drop, WooCommerce REST API, Mailchimp REST API, Drive, Gmail
- Daily, frequent, and on-demand housekeeping behavior
- Observability + alerting

**Out of scope**

- WordPress, theme, FTP, SiteGround infrastructure (covered in website plans)
- Content authoring workflows (covered in content plans)
- Marketing creative pipeline (covered in marketing plans)
- Portfolio-wide concerns (separate `projects/STATUS.md` work)

## 3. Reliability surfaces, current state and gaps

For each surface: what is in place, what fails, how it recovers, who notices, where the gaps are.

### 3.1 Data store

**In place.** Three workbooks split for performance (`ARCHITECTURE.md` §2.5.2). Schema validation runs in daily housekeeping Phase 2. `rebuildSysConfigFromSource()` is wrapped in snapshot + restore (verified at `SetupConfig.js:19-109`; `.claude/bugs.md` 2026-05-12) so runtime-mutable rows survive rebuilds.

**Fails when.** Accidental sheet edit, malformed write, schema drift, account suspension or lock, accidental sheet deletion, malicious actor.

**Recovers via.** Google Drive's built-in version history (~30 days) and manual restore. No automated out-of-band copy.

**Who notices.** Nobody until a workflow breaks; the failure is silent until consumed.

**Gaps.**
- No scheduled out-of-band snapshots of the three workbooks.
- **Snapshots to the same Drive parent do not provide DR against the most likely catastrophic failure (account suspension or compromise).** Off-account or external storage is required for real RPO protection. This is a Tier 1 design decision, not a §8 deferred question.
- No documented restore procedure (steps, who, RTO).
- No post-write integrity check on a snapshot (silent corruption is invisible until the drill).
- No row-count baselines per sheet; size drift is invisible.
- No scheduled aggregate-consistency check (e.g., `SysContacts.sc_OrderCount` vs `WebOrdM` row count per email). **The underlying bug is fixed (1.1, @201); the *scheduled* check is Tier 3.4 — still open.** (All other §3.1 snapshot/DR gaps below remain open — Tier 4 not started.)

### 3.2 Code and deployment

**In place.** Clasp push from local working tree, pinned deployment ID enforced by `jlmops/deploy.ps1` wrapper, version stamp in `WebApp.js`, git history as the rollback path.

**Fails when.** Bare `clasp deploy` creates an orphan deployment URL (has happened repeatedly; memory `jlm_stable_deploy_id` exists because of this). Pre-commit hook missed. Code regression slips past the test suite (whose freshness is unverified, see §3.6).

**Recovers via.** Git revert + redeploy. Pinned ID lookup. Manual `clasp undeploy` to clean orphans.

**Who notices.** Drift is now prevented at the source: the `deploy.ps1` wrapper is the only deploy path and pins `--deploymentId`, so bare-deploy orphans can't form (Tier 2.1, 2026-06-03). The broken `validateDeployment` detector was removed.

**Gaps.**
- ✓ **CLOSED (2.1, 2026-06-03)** — `validateDeployment` removed; it never reliably detected drift. Root-cause prevention (pinned-ID wrapper) replaces detection.
- ✓ **CLOSED (2.1, 2026-06-03)** — the four orphan deployments (@66, @67, @73, @96) were undeployed.
- ✓ **RESOLVED-BY-DESIGN (2.1)** — no external drift check built; deemed unnecessary while the pinned-ID wrapper is the sole deploy path. Reopen only if bare `clasp deploy` ever returns.
- No deploy log on Sheets side; only git captures what shipped when. **(still open)**
- No rollback drill on record. **(still open)**

### 3.3 Triggers and execution

**In place** (deep code re-verify, 2026-06-09 — all confirmed). Time-driven triggers: hourly orchestrator, 15-minute `runFrequentMaintenance` (Sun-Thu 08-20 IL plus Fri 08-13 IL — cadence guard verified at `HousekeepingService.js:532, :550-562`), daily housekeeping. Zombie killer (15-min stuck-PROCESSING → FAILED + reportFailure, verified `OrchestratorService.js:566-603`) plus inline reaper in the poll path (`_reapStuckJobInSession`, 8-min `STUCK_JOB_THRESHOLD_MIN`, verified `:1105, :1179`; called from `_checkAndAdvanceSyncState` at `:1190/:1231/:1268`; shipped 2026-05-05 as @80). **Trigger management nuance:** only ONE trigger is installed by code (`runPostSyncBundleHealth`, `SyncStateService.js:133`); the hourly / 15-min / daily triggers are **created manually in the Apps Script Triggers UI**, so a deleted trigger is not self-reinstalled — sharpening the liveness gap below.

**Fails when.** GAS hits the 6-minute hard execution limit mid-job. Trigger silently disabled (deleted by accident, OAuth scope revoked, account quota hit). Quota exhausted (UrlFetchApp daily limit, MailApp daily limit, drive operations).

**Recovers via.** Zombie killer on next run; manual trigger re-add; user re-auth (`feedback_warn_before_new_oauth_scope` exists because revocation has happened).

**Who notices.** `SysLog` (after the fact); user (when a workflow stalls).

**Gaps** (all still open as of 2026-06-09 deep re-verify).
- No trigger-health heartbeat (no record of "did the daily housekeeping run finish today?"). **Sharpened:** since the hourly/15-min/daily triggers are UI-managed (not code-installed — see In place), an accidentally-deleted trigger silently stops with nothing to re-add or detect it.
- Execution-time trends invisible; we know runs are getting longer only by anecdote.
- Quota usage invisible.
- OAuth scope revocations require a pre-emptive warning (memory exists) but no automated detector.
- **No concurrency control between scheduled triggers and user-initiated workflows. (Tier 1.3 — NOT built; highest-risk remaining session.)** Housekeeping running while a user mid-syncs (or two triggers stepping on the same `SysJobQueue` row) is undefended; the zombie killer is not a concurrency control. Confirmed greenfield: `ScriptApp.newTrigger` appears once and `LockService` appears nowhere in code.

### 3.4 Integrations

**In place.** WC REST API pull for products / translations / orders, Comax CSV drop into the `Source Folder`, Mailchimp REST pull (subscribers + campaigns), Gmail send via `GmailApp` and `MailApp` for templates and dispatches.

**Fails when.** API credentials expire or are revoked, rate-limited, network blip, source file delayed or malformed.

**Recovers via.** Next-scheduled run retries; FAILED job lands in the SysJobQueue dead-letter.

**Who notices.** Failures land in `SysLog` + a `task.system.failure` (dashboard health widget); there is **no out-of-band push alert** (the Chat webhook claimed in `ARCHITECTURE.md` §4.2 does not exist — confirmed 2026-06-09, §3.5). Silent staleness (last successful pull was 48 hours ago) is only caught by the 3.1 heartbeat card.

**Gaps.**
- ✓ **CLOSED (3.1, 2026-06-03)** — Integrations heartbeat card on the admin dashboard shows last-successful-pull per source (Woo orders/products, Mailchimp subscribers/campaigns) with per-source staleness thresholds. **Comax heartbeat still omitted** (no config key; lives in SysJobQueue COMPLETED rows) — small 3.1 follow-up.
- ✓ **CLOSED (3.1, 2026-06-03)** — `woo.api.orders_last_pull` dead key now written by `WooOrderPullService.pullOrders` on success + added to `RUNTIME_KEYS`.
- No rate-limit usage visibility. **(still open)**
- Mailchimp campaign sends are pulled at aggregate level only; per-recipient activity log writes are missing (`.claude/bugs.md` 2026-05-28). **(still open — Tier 3.3 not built)**

### 3.5 Observability

**In place.** Centralized `SysLog` writes via `LoggerService`. `NotificationService.reportFailure` creates a system task on failure. System health widget on the admin dashboard reading `task.system.health_status`.

**Verification note — RESOLVED (deep code re-verify, 2026-06-09).** The Google Chat webhook `ARCHITECTURE.md` §4.2 claims **does not exist in code.** Confirmed three ways: no `chat.googleapis.com`/`webhook` string anywhere in `*.js`; no `UrlFetchApp` in `NotificationService.js`; no fetch/mail in `LoggerService.js`. The alerting path is task-creation + health-status only. **ARCHITECTURE.md §4.2 overstates reality and should be corrected** (no out-of-band push alert exists — a failure is only seen by opening the dashboard).

**Gaps (deep code re-verify, 2026-06-09).**
- ✓ **CORRECTED — there IS severity routing.** `NotificationService.reportFailure` calls `SeverityService.getBehavior(severity)` and routes by it: log level (Critical→error / High→warn / Normal→info, `:27`), `createTask` gate, `updateHealthStatus` gate (**Normal is excluded from the health-status escalation**, `:36`), and `shouldStop` (Critical halts the caller). `SeverityService.determineSeverity` maps contexts→levels. The old "all at the same level" claim was wrong.
- ✓ **CORRECTED — there IS de-dup/rate-limiting.** `_createFailureTask` (`:59-83`) dedups by `entityId` derived from context: an existing open `task.system.failure` is updated with an incremented `occurrenceCount` instead of spawning duplicates. `resolveFailure` (`:241`) auto-closes the task when the condition clears; `urgentAlerts` capped at last 10. (Still missing: a *time-window* throttle, but task spam is prevented.)
- **Chat/out-of-band push alert: confirmed ABSENT** (above). A failure reaches a human only via the dashboard health widget — no push. **(still open — build a push bridge OR formally accept dashboard-only + drop the §4.2 claim.)**
- No true trend dashboard; SysLog is now **partially** summarized — Tier 3.2's `jlmops-status.md` carries a Recent-errors tail + capacity, but no time-series. **(partially addressed; trend view still open.)**
- "Is the system healthy this morning" — **partially addressed**: the health task now carries `failed_job_*` (2.2), `urgentAlerts`, and integration heartbeats (3.1); `jlmops-status.md` (3.2) is the readable snapshot. **(largely addressed; no single SLO-scored verdict.)**
- No SLO targets enforced/compared (the §4 capability targets exist on paper only). **(still open.)**

### 3.6 Data quality

**In place.** Master-master validation suite at end of every sync (verified at `HousekeepingService.js:633`). Schema validation runs daily. Unit tests (`TestRunner.runAllTests()`) invoked in housekeeping Phase 2 at `HousekeepingService.js:641`.

**Who notices.** Validation failures land in `SysLog`; the system health task picks up critical counts. No standalone notifier for data-quality drift; if SysLog isn't being read, drift is invisible.

**Gaps.**
- ✓ **PARTLY CLOSED** — the SysContacts vs WebOrdM aggregate *bug* is fixed (1.1, @201 2026-06-02); the *scheduled* weekly consistency check (Tier 3.4) is **still open**.
- ✓ **CLOSED (2.3, 2026-06-03)** — `ComaxAdapterTest`/`WebAdapterTest`/`ProductServiceTest` rewritten to call real code (were decorative); Phase-2 empty/null-result guard (`tests.empty_or_null_result`, High) added, so housekeeping can no longer be silently green on broken tests.
- No scheduled cross-system reconciliation (e.g., Comax row counts vs WebProdM, WC API order count vs WebOrdM rolling window). **(still open)**
- ✓ **CLOSED (1.2, 2026-06-03, all 3 stages)** — adversarial-input defense shipped: WC response size cap (`woo.api.response_max_bytes`), Comax adapter outer try, Doc-bound bidi sanitization. (Formula-prefix guard intentionally omitted — wrong surface for a Doc; revisit if a slip→Sheets export is built.) Original detail retained below for record:
  - Oversized WC response → memory blow. Single chokepoint at `WooApiService.js:127-136` `_fetch` has no `Content-Length` check before `getContentText() + JSON.parse`.
  - Comax CSV parser. Plan-claim "leaves state machine in IMPORTING_COMAX" is wrong: `OrchestratorService.js:1218` already routes parse failures to FAILED with `failedAtStage='IMPORTING_COMAX'`, and retry returns to `WAITING_COMAX_IMPORT` correctly. The actual gap is narrower: `Drive.Files.insert` at `ComaxAdapter.js:31` lacks a top-level try.
  - Doc-bound text injection. Plan-claim "customer notes injecting into Doc templates" is wrong: grep across `jlmops/` finds zero `replaceText` calls; `customerNote` is read at `WebApp.js:163` and `WebAppOrders.js:160` for UI display only, never written to Docs. The real injection surface is the shipping address fields at `PrintService.js:180-188` (formula `=` if a slip is exported to Sheets; U+202E RTL flip on the operator's view).

### 3.7 Secrets and credentials

**In place.** Secrets stored across `SysConfig`, PropertiesService (clasp), and local files (`.gcp-credentials.json` for the library register script, `jlmops/.clasprc.json` for clasp auth, the `accounts@jlmwines.com` Google session). `.gitignore` keeps the credential files out of git (verify in Tier 1).

**Fails when.** A `git add .` accident commits a credential file. A public-repo flip exposes history. AI training-data scrape exfiltrates from screen shares or accidental paste. Local machine compromise reads files at rest.

**Recovers via.** Revoke + rotate at the issuer (WC, Mailchimp, Google), redistribute to all consumers. No documented procedure today.

**Who notices.** Nobody, unless the leak triggers a vendor security alert or unauthorized usage shows in audit logs.

**Gaps.**
- No inventory of secrets, their location, or where each is referenced.
- No rotation procedure or last-rotated date column.
- No `.gitignore` audit recorded (claim above is unverified).
- No GitHub secret-scanning alerts (if any repo is on GitHub.com, this is a free win).
- No "rotate WC keys at 11pm" runbook.

### 3.8 Bus factor

**In place.** Single developer (Baruch) maintains all code, deployment, configuration, and recovery procedures. STATUS.md and plan docs document architecture; `.claude/CLAUDE.md` files document conventions. Evyatar (partner) has access to the Google account but is not a hands-on operator of jlmops.

**Reality** (banked 2026-05-28). Nobody on-staff can run jlmops independently. Evyatar can provide account access and physical continuity but is not going to operate sync widgets, restore snapshots, or invoke Apps Script functions. The realistic bus-factor mitigation is **handing off to an external developer** (a hired Apps Script contractor, or successor) — not training Evyatar to operate the system.

**Fails when.** Developer is unreachable (illness, vacation, accident, attention elsewhere) and a critical workflow needs attention. Severity scales with duration: 2 days = brief outage acceptable, manual processes carry; 2 weeks = orders pile up, sync drifts; indefinite = need a successor or contractor with enough context to take over.

**Recovers via.** Wait for the developer (short outages). Hand off to a hired contractor with the successor pack (long outages or permanent absence).

**Who notices.** Evyatar or customers notice the symptom; nobody notices the underlying bus-factor risk until it bites.

**Gaps.**
- No successor / contractor handoff pack (Tier 1.5 addresses this).
- No emergency contact tree.
- No escrow of credentials accessible to Evyatar (so a contractor can be granted access without waiting for the developer to return).
- No annual review of the handoff pack against current code reality.

### 3.9 Vendor and account integrity

**In place.** Google Workspace account `accounts@jlmwines.com` holds Sheets, Drive, GAS, Gmail, OAuth tokens, and (under current plan) snapshots. 2FA assumed enabled. Recovery email and phone assumed configured.

**Fails when.** TOS suspension (false-positive flag, content reported, payment dispute). Billing lapse (card expired, fraud alert frozen). Account hijack (phishing, SIM swap, credential reuse). Google deprecates an API or service the system depends on (GAS V8 runtime change, UrlFetchApp quota cut, Drive mass-delete bug, Sheets API deprecation). Workspace-side mass-delete bug.

**Recovers via.** Google account-recovery flow (slow, no SLA, no guarantee). Re-auth from fresh device. For deprecations: no contingency.

**Who notices.** Operator notices when login fails or workflows error. No proactive monitoring.

**Gaps.**
- No second Workspace account or external snapshot target (closes the §3.1 same-blast-radius gap).
- Recovery email and phone not verified on record.
- 2FA backup codes not printed/escrowed.
- No subscription to GAS release notes or Workspace status page.
- No quarterly check for deprecation announcements affecting our scopes/services.
- No billing-failure alert (card expiry reminder).

## 4. Capability targets

Starting suggestions; tune after first review. Without targets, "reliable" is unmeasurable.

- **RPO (max acceptable data loss):** 24 hours, with the snapshot stored off-account (not same-Drive). Same-Drive snapshots provide hours not days against the most likely catastrophic mode (account suspension); honest target requires off-account storage.
- **RTO-orders (sync-down recovery):** 4 business hours. Orders stalling 8 hours on Thursday eats Friday delivery; tighter than the system-wide RTO.
- **RTO-content (content library, CRM enrich, marketing):** 24 hours. Lower urgency than order flow.
- **MTTA (alert acknowledgement):** same business day for failure alerts.
- **MTTR (known-cause incident fix):** 2 hours for sync-down; next business day for non-critical.
- **Drift detection latency:** within 24 hours of any bare deploy — but only if the external check is automated, not human-run. If the script requires a human to run it, set to "next session that touches deploy."
- **Housekeeping completion:** daily 3-phase run completes within 30 minutes.
- **Aggregate consistency:** reconcile aggregates vs sources weekly; tolerate < 1% drift before alerting.
- **Integration freshness:** last-successful-pull no older than 1 hour for orders, 24 hours for products / Mailchimp.
- **Secrets rotation:** WC + Mailchimp API keys annually or on personnel change, whichever comes first. Service-account JSON on suspected compromise only.
- **Successor pack freshness:** annual developer review against current code reality.

### Target → session map

Which sessions move each target. Use this to answer "what shipping order gets me to X."

| Target | Sessions that move it |
|---|---|
| RPO 24h (off-account) | 4.1 |
| RTO-orders 4h | 4.1 + 4.2 (drill confirms) |
| RTO-content 24h | 4.1 + 4.2 |
| MTTA same business day | 3.1 (heartbeats) + 2.1 (drift visible + closeable) |
| MTTR 2h sync-down | 1.2 (CSV recovery) + 1.3 (concurrency) + 2.1 (drift) |
| Drift detection <24h | 2.1 |
| Housekeeping <30 min | 5.1 (capacity telemetry) |
| Aggregate consistency <1% | 1.1 (fix) + 3.4 (scheduled check) |
| Integration freshness | 3.1 + 3.2 (visible) |
| Secrets rotation discipline | 6.3 (inventory) + 6.4 (pack + Bitwarden) |
| Successor pack freshness | 6.4 |

## 5. Remediation queue, sequenced sessions

**v2 priority refocus (2026-05-28).** User direction: data integrity and operational reliability of the running system come before DR. Tiers reranked accordingly. Code-anchored against actual file:line refs (three-agent pass).

### Cross-cutting patterns (CCP)

Every session below applies these. Listed once; referenced by name in session entries.

**CCP-1 Failure path.** Top-level service entries wrap in try/catch; on catch, call `NotificationService.reportFailure(context, message, severity, details, sessionId)`. `logger.error` alone is invisible to the dashboard. Precedent: `OrchestratorService.js:585, :1149, :1210, :1237, :1304`; `ValidationOrchestratorService.js:94`.

**CCP-2 Session ID.** Generate `sessionId = Utilities.getUuid()` at the top-level entry; thread to subordinate calls. Logger and NotificationService both accept it for correlation. Precedent: `OrchestratorService.js:9, :473`; `TaskService.js:185`; `WebApp.js:335`.

**CCP-3 Batch + flush + verify.** Never row-by-row `setValue` in loops (6-min cap risk). Read once via `getValues()`, modify in memory, write once via `setValues()`, call `SpreadsheetApp.flush()`. For aggregate writes, add a verify step: re-read and assert (e.g., checksum sum equals row count). Precedent: `OrchestratorService.js:558` for read-once pattern; `ARCHITECTURE.md` §6.3 for flush() rule.

**CCP-4 LockService discipline.** `LockService.getScriptLock()` only (`getDocumentLock` and `getUserLock` are wrong scope for trigger code). Use `tryLock(30000)`, never `waitLock`. Scope to critical section only — never the full function (would burn 6-min budget inside the lock and starve other handlers including `doGet/doPost`). Always release in `finally`. Lock contention is expected backpressure: log info and return cleanly, do NOT `reportFailure`. **No existing precedent** — Tier 1.3 is greenfield.

**CCP-5 Cadence + stage guards.** Every scheduled function gates on (a) sync state in a safe stage (IDLE / COMPLETE / FAILED), and (b) days-since-last-successful-run >= threshold. Don't trust trigger reliability. Precedent: `HousekeepingService.js:550-564` (15-min schedule guard); `HousekeepingService.js:734-776` `checkBruryaReminder` (days-since gate).

**CCP-6 Runtime state in SysConfig.** Cursors, baselines, last-success timestamps, thresholds, retention windows, max-bytes caps — all SysConfig (preserved by snapshot+restore at `SetupConfig.js:19-109`). Code constants reserved for truly invariant values. SysConfig changes go through `config/*.json` → `node jlmops/generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`.

### Session entry format

Each session below has: **goal** (one sentence), **anchors** (file:line refs), **implementation** (concrete sketch with explicit staged deploys when scope warrants), **CCPs** (which cross-cutting patterns apply), **smoke** (post-deploy verification, one per staged deploy when staged), **rollback** (revert path), **depends on** (prior sessions), **open** (unknowns), and **CCP audit** (the end-of-session pass that confirms cited patterns were actually applied).

**Open question taxonomy.** Each open item is tagged:
- `[start]` resolve at session start before coding (a config value, a name, a permission)
- `[spike]` resolve mid-session via a small investigation (a 10-line test, a grep)
- `[defer]` known unknown that does not block this session; document and move on

**Session opening discipline.** Every session begins by reading: this audit doc (current section + cross-cuts), `.claude/bugs.md` for related entries, last 1-2 entries of `.claude/session-log.md` for continuity, and per the portfolio kernel at `projects/.claude/CLAUDE.md`. Commit small, push then deploy as separate change-points (memory `feedback_clasp_push_not_deploy`).

**CCP audit.** Before declaring a session done, walk back through the CCPs the session cites and confirm each was actually applied in the code change. Skipping leads to half-pattern code that's harder to maintain later. Single sentence per CCP is enough.

---

### Tier 1, data integrity now

#### 1.1 SysContacts aggregate-consistency fix — SHIPPED 2026-06-02 (@201)

`updateContactsFromOrders` now reads `WebOrdM` ∪ `WebOrdM_Archive` (was master-only, so `sc_OrderCount` decremented when orders archived); CCP-3 batch + post-write verify (`reconciliation.sys_contacts.write_verify`, High, on mismatch); the `\`-for-`/` typo at `ContactImportService.js:818` fixed. This is the reconciler that 3.4 (scheduled check) reuses.

#### 1.2 Input-safety hardening — SHIPPED 2026-06-03 (3 stages)

Adversarial inputs fail closed: **(A)** WC response size cap in `WooApiService._fetch` (config `woo.api.response_max_bytes`, default 10 MB; `wooNonRetryable` tag short-circuits the retry loop; `integration.woo.response_oversize` High on exceed). **(B)** outer try around `ComaxAdapter.js:31` `Drive.Files.insert` (FAILED routing via `OrchestratorService.js:1218` preserved). **(C)** `_sanitizeForDoc` in `PrintService.js` strips bidi override/embed/isolate controls from the six shipping fields. The formula-prefix guard was intentionally omitted — a leading `=` is inert in a Google Doc; that defense belongs on a Sheets-export path (none exists). Revisit if a slip→Sheets export is built.

#### 1.3 Concurrency control (LockService — staged: helper + 4 lock applications, 5 deploys)

**Goal.** Eliminate race conditions where two triggers, or a trigger and a user-initiated workflow, step on the same SysJobQueue row or sync-state transition.

**Live incident — concrete repro (2026-06-14, SysLog window 7:50:01–7:50:46).** This race is no longer theoretical. The user pressed "Generate" at `WAITING_WEB_EXPORT`. `exportWebInventory` correctly found real changes and created `Inv-Web-06-14-07-50.csv` (SysLog 7:50:26) plus its `task.confirmation.web_inventory_export` (7:50:35). Yet `generateWebExportBackend`, in the same execution, took the **noChanges** branch: completed the daily-sync session task (7:50:42), set stage **COMPLETE** (7:50:43), and ran `_registerSessionFiles` registering only `ComaxProducts.csv` — never the inventory CSV. The widget reported "No inventory changes detected"; the real stock/price export was orphaned and never pushed. (User applied the CSV by hand.) Mechanism: during the ~25s export, the single `system.sync.state` JSON was under unsynchronized read-modify-write by **multiple concurrent executions** — the button handler plus the SYNC session context plus **three separate** runners each firing `_checkAndAdvanceSyncState → "Advancing to WAITING_WEB_EXPORT"` for the same session (SysLog 7:50:19/:24/:23, contexts `085635c1`/`e5142428`/`4918c516`). A concurrent advance-write, holding a snapshot taken before `exportWebInventory` wrote `webExportFilename`, saved it back and clobbered the filename. `generateWebExportBackend` then re-read state with no filename → false "no changes." **Two distinct defects:** (1) lost update on shared state (this session, 1.3); (2) the caller infers result from a clobberable round-trip through shared state instead of `exportWebInventory`'s return value (new session 1.4 — ship first; it converts silent loss into a visible error even before locks land). Locking `setSyncState` per-call (Stage B) is necessary but **not sufficient** on its own: the export's filename-write and the concurrent advance-writes are separate transactions, so per-call locking still lets the last stale writer win unless the read-modify-write **re-reads inside the lock** (sharpened in Stage B below) and the duplicate advances are made idempotent.

**Why staged.** This is the highest-risk session in the plan. LockService usage is greenfield (zero codebase precedent). Failure mode if scope wrong: `doGet/doPost` web-app handlers starve, admin dashboard becomes unresponsive. To make the risk observable, ship the helper first, then apply locks one at a time with at least 24 hours of observation between deploys. If `doGet` latency spikes after any deploy, stop and reconsider before adding more locks.

**Anchors.**
- Race surfaces (per agent code-anchor pass):
  - `OrchestratorService.processPendingJobs :540-815` — re-reads data per-iteration at `:614-616`, but two parallel triggers both pass the PENDING check and both write 'PROCESSING'. Cell write isn't atomic across triggers.
  - `HousekeepingService.performFrequentMaintenance :537-548` — guard reads sync state, then calls `pullOrders`. A user-clicked sync starting in the window races.
  - `HousekeepingService.purgeOldJobs :1839+` — clear + bulk rewrite. Concurrent enqueue from `processPendingJobs` lost.
  - `SyncStateService.setSyncState` — full JSON overwrite. Two transitions race-write. **Confirmed clobbering agent in the 2026-06-14 incident.**
  - `OrchestratorService._checkAndAdvanceSyncState` — **non-idempotent advance.** Three concurrent runners advanced the same session to `WAITING_WEB_EXPORT` within 5s (2026-06-14). Each is a read-modify-write of `system.sync.state`; duplicates both waste work and supply the stale snapshots that clobber sibling writes. Needs an idempotency guard (no-op if the session is already at/past the target stage) in addition to locking.
- LockService usage codebase-wide: **zero** (no precedent).

**Stage A: ship the helper, no application yet.**
- New file `LockHelpers.js`: `withScriptLock(context, timeoutMs, fn) { const lock = LockService.getScriptLock(); if (!lock.tryLock(timeoutMs || 30000)) { logger.info('lock-contention', {context}); return null; } try { return fn(); } finally { lock.releaseLock(); } }`.
- Add a smoke entry: a no-op test function that wraps `Utilities.sleep(100)` in `withScriptLock` and confirms two concurrent calls show one contention log.
- Smoke A: editor-invoke the test function twice in 1 second. Expect one to complete, one to log `lock-contention` and return null. Confirm admin dashboard responsive while the test sleeps.
- **Wait 24+ hours after deploy A before stage B.** Watch for any unexpected SysLog patterns.

**Stage B: lock `setSyncState` — and move read-modify-write inside the lock.**
- Lowest-risk first: tightest critical section, simplest write, no fetch inside.
- **Not just `setSyncState`.** The 2026-06-14 lost update proves that guarding the write alone is insufficient — callers read state, mutate a field, then write, and a concurrent writer with an older snapshot clobbers. Provide a `SyncStateService.mutateSyncState(fn)` that acquires the lock, **re-reads** current state, applies `fn(state)`, writes, releases — so the whole read-modify-write is atomic. Migrate the field-level updaters (`webExportFilename` write in `exportWebInventory`, `_checkAndAdvanceSyncState`'s stage advance, the order/comax export updaters) to it. A bare locked `setSyncState` still loses updates because the stale read happened outside the lock.
- Smoke B: trigger two state transitions concurrently (manual editor invocation or fire a user-action while housekeeping runs). Confirm one wins, one logs contention and returns. State remains consistent. **Regression smoke for this incident:** with the 1.4 fix + Stage B in place, fire `generateWebExportBackend` while a `_checkAndAdvanceSyncState` runs; confirm `webExportFilename` survives and the widget reports the real file.
- **Wait 24+ hours.**

**Stage C: lock `purgeOldJobs`.**
- Wrap the clear + rewrite block at `:1839+`.
- Concurrent enqueue from `processPendingJobs` no longer lost.
- Smoke C: trigger `processPendingJobs` to enqueue + `purgeOldJobs` to clear during the same minute. Confirm no enqueued rows lost.
- **Wait 24+ hours.**

**Stage D: lock `processPendingJobs` pick-up.**
- Wrap the loop iteration that picks-up + sets PROCESSING (`:614-680` block). **Critical: do NOT include the inner service call** (which can take minutes inside the lock — would burn the 6-min budget and starve everything).
- Smoke D: fire two `OrchestratorService.run` invocations within 5 seconds. Confirm no duplicate PROCESSING rows in SysJobQueue. Confirm admin dashboard remains responsive during a long housekeeping run.
- **Wait 24+ hours.**

**Stage E: lock `pullOrders` start.**
- Wrap the state-guard + state-set sequence at the start of `pullOrders` in `WebAppSync.js` (called from `performFrequentMaintenance`).
- Smoke E: fire a user-click sync + a scheduled `performFrequentMaintenance` in the same second. Confirm only one proceeds; the other returns cleanly.

**CCPs.** CCP-1 (no reportFailure on contention; only on unexpected lock-acquire errors). CCP-2 (sessionId on entries that lock). CCP-4 (full pattern).

**Rollback.** Each stage independently revertible via git revert + redeploy. Helper alone (Stage A) is harmless if no callers. If Stage B through E starve `doGet/doPost`, revert that stage and reconsider scope.

**Depends on.** Nothing. Independent.

**Open.**
- `[defer]` Lock granularity may need tuning if `doGet/doPost` starves. Stage smoke catches it; if observed, split per-resource locks (separate locks for SysJobQueue vs SyncStateService vs SysContacts).
- `[start]` Stage-D scope: confirm by reading `:614-680` again at session start that the inner service call boundary is clear before locking.

**CCP audit.** Per stage: CCP-4 pattern applied exactly (tryLock with 30s timeout, return on contention, always release in finally); CCP-1 no reportFailure on contention.

#### 1.4 Sync result-reporting integrity — trust the return value, not a round-trip through shared state — SHIPPED 2026-06-14 (@289, pending live smoke)

**Shipped.** `exportWebInventory` now returns `{success, changed, fileName, fileId, count, fileUrl}`; `generateWebExportBackend` branches on `result.changed` and sets `webExportFilename`/stage from the return value, with a `reportFailure('sync.web_export.state_clobber', High)` detector that repairs the filename when shared state disagrees. Deployed @289. **Smoke still owed** — verify on the next live sync that reaches `WAITING_WEB_EXPORT` (a) real changes → "Export ready", `WAITING_WEB_CONFIRM`; (b) no changes → COMPLETE, no orphan; (c) if a clobber recurs, the detector logs/reports and the workflow still advances. The underlying race is unchanged — closed separately in §1.3.

**Goal.** The web-export step decides "changes vs no changes" from `exportWebInventory`'s **return value**, never from a state field that a concurrent writer can clobber. This converts the 2026-06-14 silent-data-loss failure mode into, at worst, a visible error — and it ships independently of (and before) the LockService work in 1.3.

**Why immediate, why first.** 1.3 is a 5-stage, multi-day, greenfield LockService rollout. This is a single self-contained function-boundary fix that closes the *silent* leg of the failure today: even with the race still present, a clobbered state write can no longer masquerade as "no changes" and auto-complete the sync. It is the highest value-per-line fix in the plan right now.

**Root cause (from the 2026-06-14 SysLog trace).** `ProductService.exportWebInventory` (`ProductService.js:897`) creates the CSV **unconditionally** when `exportProducts.length > 0` (`:1002`) but persists `webExportFilename` into sync state only inside a guard (`:1006-1014`). `WebAppSync.generateWebExportBackend` (`WebAppSync.js:389`) ignores the function's return (`{success, message, fileUrl}`) and re-derives `noChanges` purely from re-reading `state.webExportFilename` (`:410-411`). When a concurrent `setSyncState` clobbered the filename, the caller saw empty → declared no changes → COMPLETE → orphaned the real file.

**Anchors.**
- `ProductService.exportWebInventory` — `ProductService.js:897`; no-change return `:991`; file-create `:1002`; guarded state write `:1006-1014`; success return `:1033`.
- `WebAppSync.generateWebExportBackend` — `WebAppSync.js:389`; the indirect inference `:410-411`; branch `:415-431`.

**Implementation.**
1. Make `exportWebInventory` return an explicit, authoritative result on both paths: no-change → `{success:true, changed:false}`; file-created → `{success:true, changed:true, fileName, fileId, count: exportProducts.length, fileUrl}`. (The data already exists at both return sites; this just names it.)
2. In `generateWebExportBackend`, capture `const result = ProductService.exportWebInventory(sessionId)` and branch on `result.changed`, **not** on the re-read state field. On `changed`, set `webExportFilename = result.fileName` and stage `WAITING_WEB_CONFIRM` from the return value (authoritative); on `!changed`, the existing COMPLETE/skip path.
3. Defense-in-depth: if `result.changed` is true but the re-read `state.webExportFilename` is missing/different, that is a detected clobber — `reportFailure('sync.web_export.state_clobber', ..., 'High', {fileName, fileId}, sessionId)` and still advance to `WAITING_WEB_CONFIRM` using the return value, so the file is never silently dropped. This is the early-warning detector for the race until 1.3 lands.
4. Leave the file-creation and confirmation-task creation in `exportWebInventory` as-is (they already run on the correct path).

**CCPs.** CCP-1 (the new clobber-detector reportFailure), CCP-2 (sessionId already threaded).

**Smoke.** (a) Normal: at `WAITING_WEB_EXPORT` with real changes, press Generate — widget shows "Export ready: <file>", stage `WAITING_WEB_CONFIRM`, confirmation task present. (b) No-change: force-equal stock/price, press Generate — "No inventory changes detected", COMPLETE, no orphan file. (c) Race-detector: artificially blank `webExportFilename` immediately after the export (or fire a concurrent `_checkAndAdvanceSyncState`) — confirm the workflow still advances on the return value and logs `sync.web_export.state_clobber`.

**Rollback.** Single-commit git revert + redeploy. No schema/config change.

**Depends on.** Nothing. Independent of 1.3; should ship before it.

**Open.**
- `[start]` Confirm the no-change return site (`:991`) and success return site (`:1033`) are the only two exits before editing.
- `[defer]` Audit the sibling steps that infer outcome the same indirect way — `exportComaxOrdersBackend` already branches on `result.exportedCount` (return value, good); confirm no other step re-reads state to decide success.

**CCP audit.** CCP-1 the clobber-detector calls reportFailure with High; CCP-2 sessionId passed through both calls.

### Tier 2, operational reliability now

#### 2.1 Drift detection — RESOLVED AT ROOT 2026-06-03 (not built)

Resolved at the source instead of detected: the drift cause was bare `clasp deploy` spawning orphan URLs, and the `deploy.ps1` wrapper already eliminates it (`--deploymentId <pinned>` + verify; bare deploy forbidden per the kernel). The orphans (@66/@67/@73/@96) were undeployed; the broken `validateDeployment` detector was removed from the codebase. **Decision: do not build a baseline-compare detector while the pinned-ID wrapper is the only deploy path** — reopen only if bare `clasp deploy` returns. The system-task UI close-path affordance that was bundled here is still useful and folds into 3.4's dependency.

#### 2.2 FAILED-job daily sweep — SHIPPED 2026-06-03

`HousekeepingService.checkFailedJobs(sessionId)` runs in Phase 1 before `purgeOldJobs`; writes `failed_job_count` + `failed_job_oldest_age_days` additively into the `task.system.health_status` notes; severity-ladders (Normal at >0, High at >7d, Critical when a FAILED job_type is still PROCESSING — zombie killer never fired); dedups on the stable `queue.failed_job_sweep` context; failures >30d are counted but excluded from High/Critical laddering.

#### 2.3 Test suite rewrite — SHIPPED 2026-06-03

`ComaxAdapterTest` + `WebAdapterTest` rewritten to call the real adapters with in-memory CSV fixtures (happy / structural-reject / empty / bad-data) — they now go RED if the import path breaks. `ProductServiceTest` rewritten to 4 real input-validation-guard tests; `OrderServiceTest` left (mostly real already). Phase-2 empty/null-result guard (`tests.empty_or_null_result`, High) added so housekeeping can't be silently green on broken tests. Both adapters are pure transforms, so no `Test*` sheets were needed. Validated via the Developer screen's "Run Unit Tests" button. *Remaining (Tier 6.7):* deeper OrderService/ProductService coverage needs the `TEST_HARNESS_PLAN` workbook.

### Tier 3, visibility

#### 3.1 Integration heartbeats panel + `orders_last_pull` fix — SHIPPED 2026-06-03

Dead `woo.api.orders_last_pull` key now stamped by `WooOrderPullService.pullOrders` on success (+ added to `RUNTIME_KEYS`). `_getIntegrationHeartbeats_v2` feeds an **Integrations** card on the admin dashboard — 4 sources (Woo orders/products, Mailchimp subscribers/campaigns), fresh/stale per `system.heartbeat.{products|orders|mailchimp}_threshold_min` (defaults 60/1440/1440). *Remaining:* Comax heartbeat omitted (no config key; lives in SysJobQueue COMPLETED rows) — small follow-up. (The §3.5 Chat-webhook question is now resolved — see §3.5/§3.7: no webhook exists.)

#### 3.2 Flat-file system status export (`jlmops-status.md`)

**Live blocks SHIPPED 2026-06-03.** `StatusReportService.refreshLiveBlocks(sessionId)` runs at the end of `performFrequentMaintenance` (15-min) and writes `jlmops-status.md` (find-or-create in the exports folder) with section-aware sentinel markers so each writer replaces only its own block. Blocks: System / Integrations (reuses `_getIntegrationHeartbeats_v2`) / Queue / Data quality (incl. the 2.2 `failed_job_*` fields) / Capacity (per-sheet row counts) / Recent errors (new `LoggerService.getRecentErrors`, bounded tail). Never throws (wraps to `reportFailure('status_export.refresh', Normal)`). Verify by reading `jlmops-status.md` via Drive MCP after a frequent-maintenance fire.

**KPI block — OPEN (deferred; daily cadence).** `refreshKpiBlock` renders KPIs as a section *inside the same file*. Three parts: **(1) Foundation gate** — verify/edit the GA4 + GSC add-on reports first (GA4 "JLM GA4 Weekly", property `properties/279950414`: schedule firing, `date` dimension present, metrics cover sessions/users/engagement/keyEvents/revenue; GSC Search-Analytics-for-Sheets: add a **Date** dimension if still Page-only, else no trend accumulates). **(2) Ops mirror** — ops has full `SpreadsheetApp` access (the multi-tab limit is Claude's Drive path only), so `refreshKpiBlock` reads the GA4/GSC workbooks by ID, aggregates last-7/WTD/MTD, and writes a Traffic subsection alongside internal KPIs (today/week/month orders + revenue from WebOrdM, AOV, new-vs-returning via `sc_FirstCompletedDate`, EN/HE split); stamp each external metric with its tab's max date, render "no data" rather than throw. No GA4 Data API needed. **(3) Trend spine (optional)** — append the daily aggregate to the `KpiData` sheet (`KpiService.js` stubs it) for WoW/MoM beyond the rolling 90-day window; this is where the trajectory-monitoring deferral resolves. New SysConfig keys for the KPI build: `system.sheet.ga4_report`/`ga4_data_tab`, `system.sheet.gsc_report`/`gsc_data_tab`. Depends-on: soft after 3.1.

#### 3.3 Mailchimp activity-log per-recipient writes (moved up from former 6.3)

**Goal.** Close open bug 2026-05-28: `comm.campaign` activity rows missing on per-contact log. Visibility gap for "did this customer receive this campaign?"

**Anchors.**
- Current writer: `CampaignService.pullRecentCampaigns` pulls aggregate-level only (recipients, opens, clicks).
- Activity-row writer precedent: `ContactService.createActivity({sca_Email, sca_Type, sca_Summary, sca_Details})` exists and is the canonical entry.
- Mailchimp recipient-list endpoint: `/reports/{id}/sent-to` returns per-recipient delivery for a campaign.
- Idempotency surface: `SysContactActivity` rows keyed by (campaignId, email) implicitly via the activity row contents; need explicit dedup check before insert.

**Implementation.**
1. Extend `CampaignService.pullRecentCampaigns` to, after the aggregate upsert, iterate the campaign's recipient list via the Mailchimp report endpoint.
2. For each recipient: check if a `comm.campaign` activity row already exists for (campaignId, email); if not, write via `ContactService.createActivity({sca_Email, sca_Type: 'comm.campaign', sca_Summary: <campaign title>, sca_Details: JSON.stringify({campaignId, sendDate})})`.
3. Rate-limiting: pull recipients in pages (Mailchimp default 10/page; cap session iterations to avoid 6-min timeout on popular campaigns; resume on next pull via cursor in SysConfig).
4. New SysConfig key `system.mailchimp.activity_log_cursor` for resumability.

**CCPs.** CCP-1 (reportFailure on pull error), CCP-2 (sessionId), CCP-6 (cursor in SysConfig).

**Smoke.** Trigger `pullRecentCampaigns` manually after a real campaign send. Pick 3 known recipients. Confirm each has a `comm.campaign` row in `SysContactActivity` with matching campaign title + sendDate. Re-trigger; confirm no duplicates (idempotency).

**Rollback.** Git revert + redeploy. Any activity rows already written stay (idempotent — re-pulling will not duplicate). New SysConfig key orphans harmlessly.

**Depends on.** Nothing structural. Independent.

**Open.**
- `[defer]` Rate-limiting tuning if a campaign has 1000+ recipients and a single pull hits 6-min cap. Cursor pattern handles continuation across runs; verify on first large campaign.

**CCP audit.** CCP-1 reportFailure on Mailchimp API error; CCP-2 sessionId threaded; CCP-6 cursor key in SysConfig not constant.

#### 3.4 Scheduled aggregate-consistency check (weekly via days-since gate)

**Goal.** Aggregate columns continue to match source weekly; drift > tolerance opens a task with details.

**Anchors.**
- Wire location: Phase 3 of `performDailyMaintenance`, `phase3Tasks` array at `HousekeepingService.js:659-673`. Function runs daily; days-since gate handles weekly cadence (CCP-5).
- Gate precedent: `checkBruryaReminder` (`:734-776`), `checkCouponsReminder` (`:782-820`) — same shape.
- Reuses 1.1's reconciler.

**Implementation.**
1. New method `HousekeepingService.checkAggregateConsistency(sessionId)`: gates on `system.crm.aggregate_check_last_run` (>= 6 days). On gate pass, call the same reconciler from Tier 1.1 with `mode='check'` (returns drift count without writing). If drift count > tolerance count (`system.crm.aggregate_check_tolerance_pct` default 1.0), open `task.system.aggregate_drift` via `TaskService.upsertSingletonTask`.
2. New SysConfig keys: `system.crm.aggregate_check_last_run`, `system.crm.aggregate_check_tolerance_pct`.
3. **Compose with 1.1, do not fork** — the weekly check IS the 1.1 reconciler invoked with a different mode flag. One implementation, two invocation paths.
4. Insert in `phase3Tasks` array.

**CCPs.** CCP-1 (reportFailure on any inner exception), CCP-2 (sessionId), CCP-5 (days-since gate), CCP-6 (tolerance + last_run in SysConfig).

**Smoke.** (a) Manually invoke once. With 1.1 already shipped, expect drift = 0; no task created. (b) Manually edit one SysContacts `sc_OrderCount` to a wrong value, manually invoke again, expect a task to open with the email + delta in notes. (c) Re-invoke same day, expect gate to skip (days-since not met).

**Rollback.** Git revert + redeploy. Any open drift tasks: close via 2.1's UI affordance.

**Depends on.** 1.1 (reconciler) MUST ship first or the check fires on day 1 (the SysContacts bug currently disagrees with source). 2.1 (UI close path) MUST ship first or operator cannot dismiss the open task.

**Open.**
- `[start]` Day-of-week to run. Default: "any day, gate allows ≥6 days" (avoids collision with 15-min Sun-Thu window).

**CCP audit.** CCP-1 reportFailure on inner exception; CCP-2 sessionId; CCP-5 days-since gate before work; CCP-6 tolerance + last_run in SysConfig.

### Tier 4, protection (DR)

#### 4.1 Off-account workbook snapshots (kosbracha-owned)

**Goal.** Daily snapshots of all three workbooks land in `kosbracha@gmail.com`-owned Drive folder; primary loss does not take snapshots.

**Anchors.**
- Workbook IDs: `system.spreadsheet.data`, `system.spreadsheet.library`, `system.spreadsheet.logs` (SysConfig).
- Insert point: Phase 1 of `performDailyMaintenance`, before `purgeOldJobs` and before 2.2 sweep ordering. Concretely insert at start of phase1Tasks.
- Advanced Drive Service required for ownership transfer (manifest update).

**Drive-MCP asymmetry (v2.1 explicit).** Workbook snapshots are multi-tab Sheets copies; per memory `feedback_drive_mcp_placement`, Drive MCP cannot read multi-tab workbooks. Snapshots therefore serve **human-driven restore only** — they are not visible to Claude between sessions. The status file mirror (single-tab markdown) IS MCP-readable, so Claude retains visibility into "what was the last known good state" via the mirrored status file even if primary is lost. Workbook snapshots are restore artifacts, not observability artifacts.

**Implementation.**
1. New service `SnapshotService.js`. Public entry `runDailySnapshots(sessionId)`.
2. New SysConfig keys: `system.folder.snapshots` (folder ID, owned by kosbracha, shared edit-access to primary), `system.snapshot.retention_days` (default 30), `system.snapshot.secondary_email` (`kosbracha@gmail.com`).
3. Per workbook: `DriveApp.getFileById(id).makeCopy(`${name}_${YYYY-MM-DD}`, snapshotFolder)`. Then transfer ownership via `Drive.Permissions.create({type:'user', role:'owner', emailAddress: secondaryEmail}, copy.getId(), {transferOwnership: true})`.
4. Integrity check: `SpreadsheetApp.openById(copy.getId())`, verify at least one critical tab (`WebOrdM` row count within ±5% of source `getLastRow()`).
5. Retention sweep: list snapshot folder, parse date-stamps, delete > retention_days. **Open: primary may not be able to delete secondary-owned files even with shared edit.** Test in-session; fallback is a secondary-owned cleanup script bound to a separate Apps Script project under `kosbracha@gmail.com`.
6. Mirror status file: at end of `refreshKpiBlock` (Tier 3.2), copy `jlmops-status.md` to snapshot folder with same date-stamp pattern.
7. Failure path: `reportFailure('snapshot.failed', ..., 'High', {workbook, errorMessage}, sessionId)` per workbook.

**CCPs.** CCP-1 (reportFailure per workbook), CCP-2 (sessionId), CCP-5 (stage guard before run).

**Smoke.** (a) Set up kosbracha + share snapshot folder edit-access to primary (Tier 6 prerequisite; can be done in same session as 4.1). (b) Run `runDailySnapshots` manually. Confirm 3 copies in snapshot folder, ownership transferred (open the share dialog, verify owner = kosbracha). (c) Restore drill: in a sandbox sheet, open one copy, copy a tab back, verify data matches. (d) Retention: place a file dated 40 days ago in the folder, run sweep, confirm deleted (or fall back to secondary-script).

**Rollback.** Git revert + redeploy. Snapshots already created stay in secondary's Drive (harmless). The SysConfig keys orphan or clean via rebuild.

**Depends on.** kosbracha account exists and shared snapshot folder set up. Can be done in the same session as the code work (light step).

**Open.**
- `[spike]` Confirm primary can delete secondary-owned files via shared edit. Test in-session with a throwaway file. If not, separate cleanup script in secondary account.

**CCP audit.** CCP-1 reportFailure per workbook on snapshot or integrity-check failure; CCP-2 sessionId; CCP-5 stage guard before run.

#### 4.2 Restore procedure documented + drill

**Goal.** §7 restore procedure becomes real and tested, not a placeholder.

**Anchors.** §7 has the structure; this session fills it in and runs the drill.

**Implementation.**
1. Pick a sandbox workbook (create a new throwaway Sheet for the drill, not production).
2. Walk the §7 steps using a real recent snapshot from 4.1: restore a single tab, restore a full workbook, time each.
3. Pause-triggers procedure: document the exact Apps Script editor → Triggers UI click path; capture screenshots if helpful.
4. Update §7 with actual observed times, success criteria, gotchas encountered.

**CCPs.** None — pure docs + manual drill.

**Smoke.** Drill completion is the smoke. Single-sheet restore <15 min target; full-workbook restore <2 hours target. Schema validation clean on restored sandbox. `jlmops-status.md` regenerates after sandbox sync.

**Rollback.** N/A — no production change.

**Depends on.** 4.1 (snapshots exist to restore from), 3.2 (status file regenerates as success criterion).

**Open.**
- `[defer]` Partial-row recovery procedure (single row corruption). Out of scope for first drill; add to §7 after first real incident.

**CCP audit.** N/A — docs + manual drill only.

### Tier 5, capacity

#### 5.1 Capacity telemetry

**Goal.** Sheet row counts and script execution times tracked daily; growth-rate anomalies surface before they hit limits.

**Anchors.**
- SysLog currently writes events but no per-run execution time. Add timing instrumentation.
- New sheet `SysCapacity` in `JLMops_Data`; schema in `config/schemas.json`.

**Implementation.**
1. New schema entry `schema.data.SysCapacity`: columns `timestamp, sheet_name, row_count` plus separate rows for `function_name, execution_ms` style metrics.
2. New `HousekeepingService.recordCapacityMetrics(sessionId)` in Phase 3: iterate workbook sheets, write row counts; write top-5 execution times from SysLog tail.
3. Anomaly detection: net-new function compares latest day vs prior 7-day average. >50% growth in a day on any sheet → reportFailure 'capacity.anomaly'.

**CCPs.** CCP-1, CCP-2, CCP-3, CCP-6.

**Smoke.** Run manually, inspect SysCapacity for fresh rows. Spike one sheet's row count artificially (add 2000 rows), expect anomaly task next run.

**Rollback.** Git revert. New sheet stays harmless or can be deleted manually.

**Depends on.** Nothing. Independent.

**Open.**
- `[defer]` Anomaly threshold (50% growth/day) is a guess. Tune after first 30 days of data.

**CCP audit.** CCP-1, CCP-2, CCP-3, CCP-6 per cited usage.

#### 5.2 Quota dashboard

**Goal.** GAS quota usage visible per service; budget per service to head off silent ceilings.

**Anchors.**
- GAS exposes some quota info via `MailApp.getRemainingDailyQuota()` etc.; otherwise inferred from operation counts.

**Implementation.**
1. New helper that polls available quota signals per known limit (UrlFetchApp daily, MailApp daily, Drive ops/day inferred).
2. Surface in `jlmops-status.md` Capacity section.

**CCPs.** CCP-1, CCP-2.

**Smoke.** Status file shows quota burn estimates that match expected use.

**Rollback.** Git revert.

**Depends on.** 3.2 (status file exists to render into).

**Open.**
- `[spike]` Which quotas GAS reliably exposes (`MailApp.getRemainingDailyQuota` is known) vs which must be inferred from operation counts. Spike: enumerate available `*.getRemaining*` calls in GAS at session start.

**CCP audit.** CCP-1 on quota-read failure; CCP-2 sessionId.

### Tier 6, crisis defense + human/process (lower priority)

#### 6.1 WC-compromise circuit breaker

**Goal.** Anomalous WC payload shape pauses pulls without code change.

**Implementation.** Anomaly checks in `WooApiService._fetch` response handler (unexpected fields, anomalous values). Manual kill-switch flag `system.integration.{name}.disabled` in SysConfig per integration. CCP-1 + CCP-6.

#### 6.2 DSAR / compliance readiness

**Goal.** Export full customer record on demand; deletion path preserves aggregate integrity.

**Implementation.** New function `ContactService.exportFullRecord(email)` joining SysContacts + WebOrdM + WebOrdItemsM + SysContactActivity + Mailchimp history. Deletion path documents the procedure.

#### 6.3 Secrets inventory + git-history audit

**Goal.** Inventory every secret + verify `.gitignore` + scan history for leaks.

**Implementation.** Audit pass per §3.7 gaps; output `jlmops/plans/SECRETS_INVENTORY.md`.

#### 6.4 Successor / contractor handoff pack + Bitwarden setup

**Goal.** External developer can take over with the pack alone.

**Implementation.** Document per §3.8 + Bitwarden Emergency Access with kosbracha as trusted contact.

#### 6.5 Account integrity baseline

**Goal.** Recovery email + phone verified, 2FA backup codes printed, billing reminder, Workspace status page subscription.

**Implementation.** One sitting, no code.

#### 6.6 OAuth scope inventory

**Goal.** Document current scopes + re-auth procedure.

**Implementation.** Pull from `appsscript.json` manifest + Apps Script project settings.

#### 6.7 Test suite expansion (deferred from 2.3) + operator Comax-stalled runbook

**Goal.** Rewrite the remaining 2 test suites (OrderServiceTest, ProductServiceTest) that 2.3 deferred. Document operator-readable wrapper for the Tier 1.2 Comax-stalled work.

**Implementation.** Same `TestData.js`-fixture pattern from 2.3 applied to OrderService + ProductService. Comax-stalled runbook documents the externally-observable symptoms + decision tree from the Tier 1.2 hardening.

#### 6.8 V2 dashboard aggregator refactor (deferred from 3.2)

**Goal.** Reconcile fresh aggregators built in 3.2 `StatusReportService.js` with the existing aggregators in `WebAppDashboardV2.js:107-755`. Extract shared helpers to avoid divergence.

**Implementation.** Pull common date-window aggregations + EN/HE split logic into a shared `AggregationHelpers.js`. Both V2 dashboard and StatusReportService call the helpers. Smoke each view independently.

**CCPs.** CCP-3 (batch reads + memory aggregation).

**Open.**
- `[start]` Confirm V2 dashboard contract preserved before refactor (run V2 dashboard pre + post, compare outputs).

---

### Sequencing summary

**Independent (can ship any order within tier):** 1.1, 1.2 (staged), 1.3 (staged), 1.4, 2.1, 2.2, 2.3, 3.1, 3.3, 4.1, 5.1, 6.3, 6.5. **1.4 ships before 1.3** (closes the silent-loss leg immediately; 1.3 closes the race itself).

**Hard dependencies:**
- 3.4 depends on 1.1 (reconciler must exist) AND 2.1 (UI close path).
- 4.2 depends on 4.1 (snapshots exist) AND 3.2 (status file exists).
- 5.2 depends on 3.2 (status file exists).
- 6.7 depends on 2.3 (test pattern established).
- 6.8 depends on 3.2 (status file exists; refactor consolidates).

**Soft dependencies + risk decisions:**
- 2.3 (test rewrite) ships before 4.1 (snapshots). **Risk accepted (v2.1):** user priority is data integrity over DR. Mitigation: tests must use dedicated `Test*` sheets from session start, never production tabs.
- 3.2 (status file) ideally after 3.1 so heartbeat values exist; can ship before if 3.2 block shows "key missing" placeholders for the dead `orders_last_pull` key.

**Recommended ship order:** 1.1 → 1.2 → **1.4 (immediate)** → 1.3 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 3.4 → 4.1 → 4.2 → 5.1 → 5.2 → 6.x (any order).

**Staging within sessions.** Sessions 1.2 (3 stages) and 1.3 (5 stages) ship multiple deploys with smoke gates between. Within-session staging is shown in those entries.

**Self-refresh checkpoint.** After every 3 shipped sessions, re-read §3 surfaces and confirm they still match code reality. Drift in the "current state" inventory is the most common source of plan failure as work proceeds. Update §3 in place if drift is found; flag in §9 review-pass log.

## 6. Ongoing assurance scheme

After Tiers 1-3 land. Cadence tuned post-review for realistic one-person ops:

- **Daily (automated).** Housekeeping reports a health snapshot to the system task: snapshot success, FAILED jobs count, drift status, integration heartbeats, aggregate-consistency status. Failure escalates via Chat or task. **The daily report carries the weight that "weekly review" would have carried — automate what would otherwise lapse.**
- **Per-session-start (semi-automated).** Session-start protocol surfaces health-task state if non-green. Takes 30 seconds if green; routes to incident handling if not. Replaces the original "weekly session-driven" cadence, which would have lapsed within 6 weeks per SRE review.
- **Monthly (session-driven).** Capacity review: row counts, execution time trends, quota burn rates. Tied to the cleanup cadence already in the JLM kernel.
- **Annual (successor-pack review).** Developer reviews the Tier 6.4 handoff pack against current code reality: are credentials still where documented, contacts still current, snapshot folder still accessible, critical-workflow map still accurate. Replaces the "quarterly operator dry-run" idea (Evyatar is not a hands-on operator; that drill would not happen).
- **Annual (DR drill).** Restore from latest snapshot into a sandbox workbook. Document actual RTO. Identify gaps. Update procedures. Downgraded from quarterly per review (unrealistic with single-developer bandwidth; annual + monthly snapshot-integrity check is the practical version).
- **Monthly (snapshot-integrity check).** Quick automated verification that the most recent snapshot opens and matches expected row counts within tolerance. Catches silent corruption between annual drills.
- **After every 3 shipped sessions (self-refresh).** Re-read §3 surfaces against current code; update in place if drift found. This plan is long; without a refresh checkpoint, by session 6 the early sessions' assumptions may have drifted from reality. See sequencing summary in §5 for the trigger.

## 7. Restore procedure (placeholder, to be filled by Tier 1 session 1)

To be written end-to-end during the Tier 4.2 drill session. Pre-decided structure:

- **Snapshot location.** Secondary Google account's Drive, folder name TBD during Tier 4.1. Filenames date-stamped (`JLMops_Data_2026-MM-DD.xlsx` or `_2026-MM-DD copy` per `makeCopy()` convention).
- **Identifying the right snapshot.** By date in filename. Most recent that pre-dates the incident is the target. Successor pack (Tier 6.4) carries the lookup steps for a non-developer.
- **Restoring a single sheet** (most common case): open the snapshot copy, copy the relevant tab to the live workbook, smoke-check row count + a handful of values.
- **Restoring a full workbook** (rare): open the snapshot copy, "Make a copy" into the original location, rename to match production name, update `system.spreadsheet.*` SysConfig if file ID changed.
- **Pausing triggers during restore.** Disable hourly + 15-min + daily triggers via Apps Script editor → Triggers UI. Re-enable after smoke. Runbook captures the click path.
- **Verifying restore.** Run schema validation manually; run a single `runFrequentMaintenance` cycle; confirm SysJobQueue not stuck; check `jlmops-status.md` regenerates with expected shape.
- **Expected total time.** Single sheet: 15 min. Full workbook: 1-2 hours including verification.
- **Success criteria.** Schema validation clean; one sync cycle completes; status file regenerates; no new FAILED jobs.

## 8. Open questions

Trimmed in v2. Only session-level unknowns that can be resolved at session start remain (most v1 questions either resolved or moved into per-session "Open" fields in §5).

- ~~**Chat webhook reality.**~~ **RESOLVED 2026-06-09 (deep code re-verify): the webhook does NOT exist in code** (no `chat.googleapis.com`/`webhook` in any `*.js`, no `UrlFetchApp` in `NotificationService.js`). It was aspirational. `ARCHITECTURE.md` §4.2 corrected. Decision still owed: build a push bridge OR formally accept dashboard-only alerting.
- **`task.system.*` UI close path scope.** Uniform across all system task types, or just `validateDeployment`? Resolve in Tier 2.1.
- **GitHub presence.** Is any jlmwines repo on github.com with secret-scanning available? Affects Tier 6.3 spike depth.
- **External-contractor candidates** for Tier 6.4 contact tree.
- **Upgrade-to-external snapshot trigger.** When (if ever) does the strategy upgrade from second-account-only to add Backblaze B2? Triggers: revenue threshold, regulatory requirement, an actual close call. Document; don't act until.

## 9. Status & progress

Durable shipped facts have graduated to `ARCHITECTURE.md` §4 (stuck-job recovery, trigger model, severity-routed alerting + DLQ); the review-pass history lives in git + `.claude/session-log.md`.

**Progress (self-refresh checkpoint, 2026-06-09; incident addendum 2026-06-14).** ~7 of 16 sessions shipped, all in the 2026-06-03 push: **1.1** (SysContacts aggregate fix, @201), **1.2** (input-safety, 3 stages), **2.1** (drift — resolved at root, detector removed), **2.2** (FAILED-job sweep), **2.3** (real test suites + empty-result guard), **3.1** (integration heartbeats + `orders_last_pull` fix), **3.2** (status-export live blocks; KPI block deferred). **Open:** **1.4 sync result-reporting integrity (IMMEDIATE — new, motivated by the 2026-06-14 lost-update incident that silently dropped a real inventory export)**, 1.3 concurrency (greenfield LockService, highest-risk — race now confirmed live, not theoretical), 3.2 KPI block, 3.3 Mailchimp per-recipient activity, 3.4 scheduled aggregate-consistency check, all of Tier 4 (DR snapshots/restore — none exists yet), Tier 5 (capacity), Tier 6 (crisis/human). **Highest-value next: 1.4 (ship now — small, stops silent data loss), then 1.3.**

**Open decisions to unblock DR work:** designate the secondary Google account for off-account snapshots (Tier 4.1); confirm the operator identity for the runbook; decide build-a-push-bridge vs formally accept dashboard-only alerting (the Chat webhook was confirmed absent 2026-06-09 — `ARCHITECTURE.md` §4.2 is the authority).
