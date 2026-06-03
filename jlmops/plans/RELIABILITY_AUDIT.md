# Reliability Audit & Path Forward, jlmops

**Created:** 2026-05-28
**Updated:** 2026-05-28 (v2.1, self-critique fixes applied)
**Status:** Draft v2.1. v2 went through a self-critique pass and 14 issues were folded back in: stale Tier cross-references fixed, high-risk LockService session restructured to staged deploys, input-safety session split into stages, Tier 2.3 scope committed, Mailchimp activity-log moved to visibility tier, "Open" question taxonomy added, capability targets mapped to sessions, CCP-audit mechanism added, session-opening discipline pointer added, snapshot/status Drive-MCP asymmetry made explicit, and a self-refresh checkpoint added to the ongoing assurance scheme.
**Owner:** Session-driven. User observes and tests; does not co-author.

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
- No scheduled aggregate-consistency check (e.g., `SysContacts.sc_OrderCount` vs `WebOrdM` row count per email; open bug 2026-05-28).

### 3.2 Code and deployment

**In place.** Clasp push from local working tree, pinned deployment ID enforced by `jlmops/deploy.ps1` wrapper, version stamp in `WebApp.js`, git history as the rollback path.

**Fails when.** Bare `clasp deploy` creates an orphan deployment URL (has happened repeatedly; memory `jlm_stable_deploy_id` exists because of this). Pre-commit hook missed. Code regression slips past the test suite (whose freshness is unverified, see §3.6).

**Recovers via.** Git revert + redeploy. Pinned ID lookup. Manual `clasp undeploy` to clean orphans.

**Who notices.** `validateDeployment` housekeeping check, currently broken (`.claude/bugs.md` 2026-05-27).

**Gaps.**
- `validateDeployment` does not actually detect drift; compares two values GAS has no reason to keep equal.
- Four orphan deployments accumulated (@66, @67, @73, @96) and have never been cleaned.
- No external drift check (e.g., a local `clasp deployments` diff against an expected-IDs file).
- No deploy log on Sheets side; only git captures what shipped when.
- No rollback drill on record.

### 3.3 Triggers and execution

**In place.** Time-driven triggers: hourly orchestrator, 15-minute `runFrequentMaintenance` (Sun-Thu 08-20 IL plus Fri 08-13 IL), daily housekeeping. Zombie killer (15-min stuck-PROCESSING) plus inline reaper in the poll path (8-min, shipped 2026-05-05 as @80).

**Fails when.** GAS hits the 6-minute hard execution limit mid-job. Trigger silently disabled (deleted by accident, OAuth scope revoked, account quota hit). Quota exhausted (UrlFetchApp daily limit, MailApp daily limit, drive operations).

**Recovers via.** Zombie killer on next run; manual trigger re-add; user re-auth (`feedback_warn_before_new_oauth_scope` exists because revocation has happened).

**Who notices.** `SysLog` (after the fact); user (when a workflow stalls).

**Gaps.**
- No trigger-health heartbeat (no record of "did the daily housekeeping run finish today?").
- Execution-time trends invisible; we know runs are getting longer only by anecdote.
- Quota usage invisible.
- OAuth scope revocations require a pre-emptive warning (memory exists) but no automated detector.
- **No concurrency control between scheduled triggers and user-initiated workflows.** Housekeeping running while a user mid-syncs (or two triggers stepping on the same `SysJobQueue` row) is undefended; the zombie killer is not a concurrency control.

### 3.4 Integrations

**In place.** WC REST API pull for products / translations / orders, Comax CSV drop into the `Source Folder`, Mailchimp REST pull (subscribers + campaigns), Gmail send via `GmailApp` and `MailApp` for templates and dispatches.

**Fails when.** API credentials expire or are revoked, rate-limited, network blip, source file delayed or malformed.

**Recovers via.** Next-scheduled run retries; FAILED job lands in the SysJobQueue dead-letter.

**Who notices.** `SysLog` ERROR → Google Chat webhook for hard failures. Silent staleness (last successful pull was 48 hours ago and nobody alerts) is invisible.

**Gaps.**
- No integration heartbeat per source (no last-successful-pull view).
- **`woo.api.orders_last_pull` heartbeat key is dead** — declared in `config/system.json` and read at `WebAppSync.js:1058`, but `WooOrderPullService.pullOrders` never writes it. Separate bug to fix as part of the heartbeat session.
- No rate-limit usage visibility.
- Mailchimp campaign sends are pulled at aggregate level only; per-recipient activity log writes are missing (`.claude/bugs.md` 2026-05-28).

### 3.5 Observability

**In place.** Centralized `SysLog` writes via `LoggerService`. `NotificationService.reportFailure` creates a system task on failure. System health widget on the admin dashboard reading `task.system.health_status`.

**Verification note.** `ARCHITECTURE.md` §4.2 claims a Google Chat webhook fires on ERROR; code review (`LoggerService.js`, `NotificationService.js`) found a task-creation path but no direct webhook code. Either the webhook lives elsewhere unverified, or the doc overstates reality. Resolve in Tier 2 alongside the heartbeat panel.

**Gaps.**
- Chat-alert path unverified end-to-end (see verification note).
- All failures task-create at the same level; no severity routing, no rate limit.
- No trend dashboard; SysLog accumulates but is not summarized.
- No "is the system healthy this morning" snapshot beyond the single health task.
- No SLO targets to compare against.

### 3.6 Data quality

**In place.** Master-master validation suite at end of every sync (verified at `HousekeepingService.js:633`). Schema validation runs daily. Unit tests (`TestRunner.runAllTests()`) invoked in housekeeping Phase 2 at `HousekeepingService.js:641`.

**Who notices.** Validation failures land in `SysLog`; the system health task picks up critical counts. No standalone notifier for data-quality drift; if SysLog isn't being read, drift is invisible.

**Gaps.**
- Aggregate-consistency check missing (open bug 2026-05-28 on SysContacts vs WebOrdM).
- Test-suite freshness unverified; `TESTING_GUIDE.md` last touched 2025-12-08 (`TECH_DEBT_AUDIT.md` §1.7). If the tests pass-by-default because they error out cleanly, daily housekeeping is silently green on broken tests.
- No scheduled cross-system reconciliation (e.g., Comax row counts vs WebProdM, WC API order count vs WebOrdM rolling window).
- No defense against adversarial inputs. Specifically (corrected post code-anchor pass):
  - Oversized WC response → memory blow. Single chokepoint at `WooApiService.js:127-136` `_fetch` has no `Content-Length` check before `getContentText() + JSON.parse`.
  - Comax CSV parser. Plan-claim "leaves state machine in IMPORTING_COMAX" is wrong: `OrchestratorService.js:1218` already routes parse failures to FAILED with `failedAtStage='IMPORTING_COMAX'`, and retry returns to `WAITING_COMAX_IMPORT` correctly. The actual gap is narrower: `Drive.Files.insert` at `ComaxAdapter.js:31` lacks a top-level try.
  - Doc-bound text injection. Plan-claim "customer notes injecting into Doc templates" is wrong: grep across `jlmops/` finds zero `replaceText` calls; `customerNote` is read at `WebApp.js:163` and `WebAppOrders.js:160` for UI display only, never written to Docs. The real injection surface is the shipping address fields at `PrintService.js:180-188` (formula `=` if a slip is exported to Sheets; U+202E RTL flip on the operator's view).

### 3.7 Secrets and credentials

**In place.** Secrets stored across `SysConfig`, PropertiesService (clasp), and local files (`.gcp-credentials.json` for the library register script, `jlmops/.clasprc.json` for clasp auth, the `accounts@jlmwines.com` Google session). `.gitignore` keeps the credential files out of git (verify in Tier 1).

**Fails when.** A `git add .` accident commits a credential file. A public-repo flip exposes history. AI training-data scrape exfiltrates from screen shares or accidental paste. Local machine compromise reads files at rest. A leaked Chat webhook URL is abused.

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

#### 1.1 SysContacts aggregate-consistency fix + ContactImportService typo

**Goal.** SysContacts aggregate columns (`sc_OrderCount`, `sc_TotalSpend`, `sc_LastOrderDate`, `sc_AvgOrderValue`) match union of `WebOrdM` + `WebOrdM_Archive` per normalized email, post status-exclusion.

**Anchors.**
- Bug location: `ContactImportService.js:626-885` `updateContactsFromOrders` — reads only `WebOrdM`, never `WebOrdM_Archive`. Once an order leaves for archive, `sc_OrderCount` decrements.
- Correct pattern to copy: `ContactImportService.js:78-131` in `importFromOrderHistory` — already does the archive merge correctly.
- Pre-existing typo: `ContactImportService.js:818` `Math.round(newTotalSpend \ newOrderCount)` — backslash instead of slash. Fix in a separate commit within the same session.
- Status-exclusion list (`cancelled / refunded / failed`): preserve as-is, both paths use it.
- Email normalize: `ContactImportService.js:172, :692` (`.toLowerCase().trim()`).
- Downstream readers (must not regress): `CampaignService.js:423-548` (segmentation), `ContactService.js:198-251, :829` (scoring), `ContactEnrichmentService.js:925-935` (has a known "may be from different data source" comment that flags this bug at author level).

**Implementation.**
1. Rewrite `updateContactsFromOrders` aggregation loop to read from `WebOrdM` + `WebOrdM_Archive` union (mirror the archive-merge block from `:78-131`).
2. Apply CCP-3: one `getValues()` per sheet, group-by-normalized-email in memory, one `setValues()` for the SysContacts aggregate columns block.
3. Verify step (CCP-3): post-write, sum SysContacts `sc_OrderCount` over all rows equals union row count (post status-exclusion); on mismatch, `reportFailure('reconciliation.sys_contacts.write_verify', ..., 'High', ..., sessionId)`.
4. Separate commit: fix the `\` typo at `:818`.

**CCPs.** CCP-1 (reportFailure on verify mismatch), CCP-2 (sessionId), CCP-3 (batch + flush + verify).

**Smoke.** Pre-deploy: snapshot 3 contacts (one with archived orders, one with mixed, one current-only). Post-deploy: confirm `sc_OrderCount` matches `COUNTIFS` against the union (post status-exclusion) within 0; `sc_TotalSpend` within 1 NIS. Run an admin campaign-segment count and confirm <1% shift.

**Rollback.** `git revert` + redeploy. Aggregate columns recompute on next run; divergence reverts naturally. No schema change.

**Depends on.** Nothing. Independent. First session to ship.

**Open.** None.

**CCP audit.** CCP-1 reportFailure fires on verify mismatch; CCP-2 sessionId threaded through reconciler + reportFailure; CCP-3 read-once / setValues / flush / verify pattern applied to aggregate columns block.

#### 1.2 Input-safety hardening (staged: 3 deploys)

**Goal.** Adversarial inputs (oversized WC response, Comax adapter pre-parse throw, Doc-bound text with formula/RTL exploits) fail closed without corrupting state or crashing the executor.

**Status (2026-06-03).** Stages A + B + C all SHIPPED (deploy in place) — session 1.2 complete. Stage C scope narrowed (bidi strip done; formula-prefix guard omitted as wrong-surface for a Doc — see Stage C below). Deviations from this plan as written: (1) config key landed as `woo.api.response_max_bytes`, NOT `system.woo.response_max_bytes` — followed the existing `woo.api.retry_max` / `retry_delay_ms` precedent so all woo HTTP knobs share a home (read in `WooApiService._getApiConfig` as `responseMaxBytes`); (2) the `_fetch` reportFailure passes `null` sessionId by design — `_fetch` is a deep internal called widely with no sessionId param, threading one through every caller is out-of-scope risk, and reportFailure tolerates null. Implementation also added a `wooNonRetryable` error tag so the oversize throw short-circuits the retry loop (fires reportFailure once, not retryMax+1 times).

Three distinct work items, three distinct files, three distinct failure modes. Staged as three deploys within the session so each ships with its own smoke gate. If any sub-stage fails or surfaces unknowns, stop the session and re-plan rather than push through.

**Anchors.**
- WC single chokepoint: `WooApiService.js:127-136` `_fetch` — `getContentText() + JSON.parse` with no size check. All WC endpoints go through this; one cap covers everything.
- Comax parser top-level miss: `ComaxAdapter.js:31` `Drive.Files.insert` has no try around it. Existing :42, :51-54, :120-126 throws already propagate to FAILED via `OrchestratorService.js:1218` correctly.
- Doc-bound text sites: `PrintService.js:180-188` (shipping name/address/phone). NOT `customerNote` (never injected; grep confirms zero `replaceText` codebase-wide).

**Stage A: WC response size cap. SHIPPED 2026-06-03.**
- In `WooApiService._fetch` after `UrlFetchApp.fetch` returns but before `getContentText()`, read the `Content-Length` header (blob-bytes fallback when absent, e.g. chunked transfer) and compare to config `woo.api.response_max_bytes` (default 10 MB = 10485760).
- On exceed: `reportFailure('integration.woo.response_oversize', ..., 'High', {endpoint, sizeBytes, maxBytes}, null)`, then throw a `wooNonRetryable`-tagged error so the retry loop short-circuits.
- Smoke A (pending user run post-deploy): mock oversized WC response, confirm short-circuit + `integration.woo.response_oversize` failure task.

**Stage B: Comax adapter outer try. SHIPPED 2026-06-03.**
- Wrapped `ComaxAdapter.js:31` `Drive.Files.insert` in try/catch.
- On catch: logs + throws a typed `INVALID FILE: ...could not be converted by Drive...` error; existing FAILED routing at `OrchestratorService.js:1218` preserved (no reportFailure added here — orchestrator owns that path).
- Smoke B (pending user run): drop a truncated/non-CSV Comax file, confirm state machine ends at FAILED with `failedAtStage=IMPORTING_COMAX`, retry from sync widget returns to `WAITING_COMAX_IMPORT`.

**Stage C: Doc-bound text sanitization. SHIPPED 2026-06-03 (scope narrowed).**
- Added private `_sanitizeForDoc(str)` in `PrintService.js`: strips bidi override/embedding/isolate controls (`U+202A-202E`, `U+2066-2069`); non-strings returned as-is; benign `U+200E/200F` marks left alone (already treated as noise at `:33`).
- Applied to the six shipping fields (name/address1/address2/city/phone) at the read site (now `:199-204` after the helper insertion).
- **Formula-prefix guard (`=/+/-/@`) intentionally OMITTED.** The plan called for it, but this surface is a Google **Doc**, where a leading `=` is inert text — the guard would only stamp a visible literal `'` onto names/addresses for zero in-Doc benefit. Formula-injection defense belongs on an actual **Sheets-export** path (none exists today). Decision flagged to user 2026-06-03; revisit if a slip→Sheets export is ever built.
- Smoke C (pending user run): (i) packing slip with an RLO/bidi-override-laced shipping name — confirm the slip's order#/address/phone are NOT visually reordered. (ii) packing slip with `שלום` in the name field — confirm Hebrew renders correctly.

**CCPs.** CCP-1 (reportFailure on oversize), CCP-2 (sessionId), CCP-6 (max-bytes in SysConfig).

**Rollback.** Per stage: git revert + redeploy. No data state. New SysConfig key can orphan or clean via rebuild. Each stage independently revertible.

**Depends on.** Nothing. Independent.

**Open.**
- `[spike]` U+202E strip unconditional vs preserve with other bidi marks. Test with real Hebrew test names mid-Stage-C before committing.

**CCP audit.** Stage A: CCP-1 reportFailure fires on oversize ✓; CCP-2 sessionId — passed `null` by design (see Status note) rather than threaded; CCP-6 `woo.api.response_max_bytes` lives in SysConfig (config/system.json regenerated → SetupConfig.js), not a code constant ✓. Stages B + C audit pending.

#### 1.3 Concurrency control (LockService — staged: helper + 4 lock applications, 5 deploys)

**Goal.** Eliminate race conditions where two triggers, or a trigger and a user-initiated workflow, step on the same SysJobQueue row or sync-state transition.

**Why staged.** This is the highest-risk session in the plan. LockService usage is greenfield (zero codebase precedent). Failure mode if scope wrong: `doGet/doPost` web-app handlers starve, admin dashboard becomes unresponsive. To make the risk observable, ship the helper first, then apply locks one at a time with at least 24 hours of observation between deploys. If `doGet` latency spikes after any deploy, stop and reconsider before adding more locks.

**Anchors.**
- Race surfaces (per agent code-anchor pass):
  - `OrchestratorService.processPendingJobs :540-815` — re-reads data per-iteration at `:614-616`, but two parallel triggers both pass the PENDING check and both write 'PROCESSING'. Cell write isn't atomic across triggers.
  - `HousekeepingService.performFrequentMaintenance :537-548` — guard reads sync state, then calls `pullOrders`. A user-clicked sync starting in the window races.
  - `HousekeepingService.purgeOldJobs :1839+` — clear + bulk rewrite. Concurrent enqueue from `processPendingJobs` lost.
  - `SyncStateService.setSyncState` — full JSON overwrite. Two transitions race-write.
- LockService usage codebase-wide: **zero** (no precedent).

**Stage A: ship the helper, no application yet.**
- New file `LockHelpers.js`: `withScriptLock(context, timeoutMs, fn) { const lock = LockService.getScriptLock(); if (!lock.tryLock(timeoutMs || 30000)) { logger.info('lock-contention', {context}); return null; } try { return fn(); } finally { lock.releaseLock(); } }`.
- Add a smoke entry: a no-op test function that wraps `Utilities.sleep(100)` in `withScriptLock` and confirms two concurrent calls show one contention log.
- Smoke A: editor-invoke the test function twice in 1 second. Expect one to complete, one to log `lock-contention` and return null. Confirm admin dashboard responsive while the test sleeps.
- **Wait 24+ hours after deploy A before stage B.** Watch for any unexpected SysLog patterns.

**Stage B: lock `setSyncState`.**
- Lowest-risk first: tightest critical section, simplest write, no fetch inside.
- Wrap the JSON read-modify-write in `SyncStateService.setSyncState` with `withScriptLock('sync_state', 30000, ...)`.
- Smoke B: trigger two state transitions concurrently (manual editor invocation or fire a user-action while housekeeping runs). Confirm one wins, one logs contention and returns. State remains consistent.
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

### Tier 2, operational reliability now

#### 2.1 Drift detection working

**Goal.** `validateDeployment` reliably detects bare-clasp-deploy drift without daily false positives; orphan deployments removed; system tasks become user-closeable.

**Status (2026-06-03).** Orphan deployments (@66/@67/@73/@96) UNDEPLOYED by user — that half of the goal is done. **Open question raised by user: is `validateDeployment` drift detection now obsolete?** With the pinned-ID `deploy.ps1` wrapper enforced (auto-push + `clasp deploy --deploymentId <pinned>` + pinned-ID survival verify) and bare `clasp deploy` retired as the failure mode, the original drift premise (orphan URLs from bare deploys) may no longer apply. RE-EVALUATE before building 2.1: confirm whether any drift vector survives the wrapper; if not, this session narrows to just the closeable-system-task UI affordance (or drops entirely). Do not build the `validateDeployment` baseline-compare detector until this is settled.

**Anchors.**
- Current detector: `HousekeepingService.js:1253-1312` (NOT `:1316` as v1.3 said — corrected).
- Task close paths exist: `TaskService.completeTask :341-388`, `TaskService.updateTaskStatus :429-497`; UI wrappers `WebAppTasks.js:240 _completeTaskById`, `:313 _updateTaskStatus`. Just needs UI surface in dashboard.
- Orphan deployments to undeploy: @66, @67, @73, @96 (per `.claude/bugs.md` 2026-05-27).
- No `package.json` in `jlmops/` — for the local script, either add `package.json` or invoke node directly.
- Memory `jlm_clasp_auth`: project-local `.clasprc.json` goes stale; local script must check auth state and exit clearly if stale.

**Implementation.**
1. New SysConfig key `system.deployment.runtime_url_baseline`. On first run after deploy, `validateDeployment` reads current `ScriptApp.getService().getUrl()` and stores as baseline. Subsequent runs compare against baseline (not pinned ID). **Bootstrap guard:** only write baseline from trigger context (e.g., guard with `e && e.triggerUid` or by detecting that the URL contains `/exec` not `/dev`) to avoid locking in a dev URL during manual editor runs.
2. Local script `jlmops/scripts/check-deployments.js`: shells `clasp deployments`, parses output, diffs against checked-in `jlmops/.expected-deployments.txt` (initial contents: pinned `AKfycbz...49l26x9LK8vuIH8ELHI6yw` + HEAD). Exits non-zero on unexpected entries. If clasp auth is stale, prints "re-run `clasp login`" and exits non-zero.
3. Add `package.json` to `jlmops/` with `"scripts": {"check-deployments": "node scripts/check-deployments.js"}`.
4. Undeploy orphans: **before undeploying, audit any external integration** (Mailchimp webhook, WC webhook, saved bookmarks) for references to those orphan URLs. Then `clasp undeploy <id>` per orphan in same session.
5. Add admin "Close drift task" affordance in `ManagerDashboardView_v2` (or admin dashboard) for `task.system.*` rows only. Re-uses existing `_completeTaskById`.

**CCPs.** CCP-1 (reportFailure on real drift), CCP-2 (sessionId), CCP-6 (baseline in SysConfig).

**Smoke.** (a) Force a mismatch (set baseline to a known-fake value), run housekeeping, confirm `task.system.deployment_drift` opens. Close it via the new UI affordance, confirm done. (b) Hit each orphan URL post-undeploy: expect 404. Hit pinned URL: expect normal response. (c) Run `npm run check-deployments`: expect clean exit. (d) Confirm SysConfig has `system.deployment.runtime_url_baseline` populated post first-run.

**Rollback.** Git revert + redeploy restores compare-to-pinned. Undeploys are not reversible — `clasp undeploy` is permanent. If an integration was pointing at an orphan and breaks, reconfigure the integration to the pinned URL.

**Depends on.** Nothing. Independent.

**Open.**
- `[spike]` Confirm zero external references to orphan URLs before undeploy. Grep webhook configs in Mailchimp + WC admin at session start.
- `[start]` `task.system.*` UI close path scope: uniform across all system task types, or scoped to `task.system.deployment_drift`? Default: uniform (replaces a recurring pattern across health, drift, deployment).

**CCP audit.** CCP-1 reportFailure on real drift; CCP-2 sessionId in detector + close path; CCP-6 `system.deployment.runtime_url_baseline` in SysConfig.

#### 2.2 FAILED-job daily sweep

**Goal.** Accumulating FAILED rows in SysJobQueue surface in the daily health snapshot with severity laddering, not silent rot.

**Anchors.**
- Sheet: `JLMops_Logs` workbook, `SysJobQueue` tab. Headers (from `config/schemas.json:157`): `job_id, session_id, job_type, status, archive_file_id, created_timestamp, processed_timestamp, error_message, retry_count, original_file_id, original_file_last_updated`. **Lowercase snake_case, no `sjq_*` prefix.**
- Existing iteration: `HousekeepingService.purgeOldJobs :1839+` already iterates the queue + parses `processed_timestamp` as Date + applies threshold. Add sweep adjacent.
- Phase ordering: `purgeOldJobs` is Phase 1; sweep must run BEFORE purge or aged FAILEDs vanish before being counted. Put sweep in Phase 1, before `purgeOldJobs`.
- Health task notes shape: `HousekeepingService.js:700-718` writes `task.system.health_status` JSON. Add field additively (don't restructure).
- Severity precedent: `SeverityService` referenced in `NotificationService.js:22`.
- Dedup precedent: `NotificationService._createFailureTask :64-80` dedups by entityId; pass stable `failed_job_sweep` so daily runs update one task, not seven.

**Implementation.**
1. New method `HousekeepingService.checkFailedJobs(sessionId)`: read SysJobQueue once, filter `status === 'FAILED'`, compute count, oldest age, and `currentlyProcessingJobTypes` (job_types with any PROCESSING row).
2. Severity laddering:
   - FAILED count > 0 → Normal
   - Any FAILED row > 7 days old → High
   - Any FAILED row with `job_type` currently in PROCESSING set → Critical (zombie killer never fired)
3. Write count + oldest_age to `task.system.health_status` notes additively. On High/Critical, call `reportFailure('queue.failed_job_sweep', ..., severity, details, sessionId)` with stable entityId `failed_job_sweep` for dedup.
4. Insert call in Phase 1 of `performDailyMaintenance`, before `purgeOldJobs`.

**CCPs.** CCP-1 (reportFailure with severity laddering), CCP-2 (sessionId), CCP-3 (read once, filter in memory).

**Smoke.** Pre-deploy: count current FAILED rows by hand. Post-deploy: run `performDailyMaintenance` manually, inspect `task.system.health_status` notes JSON for `failed_job_count` and `failed_job_oldest_age_days`. Confirm dashboard widget still renders. **Expected on first run:** orphan-deployment-era FAILEDs (pre-zombie-killer) may spike the alert. Either age-cap the sweep to last 30 days, OR accept one-time noise + manually mark legacy FAILEDs reviewed.

**Rollback.** Git revert + redeploy. No schema change. No data migration.

**Depends on.** Nothing. Independent.

**Open.**
- `[start]` Age-cap 30 days (recommended for High/Critical thresholds; report absolute total in notes) vs absolute count (alarm-noise risk on first run).

**CCP audit.** CCP-1 reportFailure with severity laddering + stable entityId for dedup; CCP-2 sessionId; CCP-3 read SysJobQueue once, filter in memory.

#### 2.3 Test suite rewrite (scoped: ComaxAdapter + WebAdapter only)

**Goal.** `TestRunner.runAllTests()` actually exercises the two import-safety-critical service shapes; daily housekeeping no longer green-by-default on broken tests.

**Scope committed (v2.1).** Rewrite only `ComaxAdapterTest` and `WebAdapterTest` — the two suites on the import path that input-safety hardening (1.2) depends on. `OrderServiceTest` + `ProductServiceTest` rewrites defer to Tier 6.7 as backlog. This commits the scope so the session does not balloon.

**Risk accepted (v2.1).** Per user priority of data-integrity over DR, this session ships before Tier 4.1 (snapshots). Rollback path if a test contaminates a live tab is reduced to Drive version history (~30 days) plus the existing SysConfig snapshot+restore around rebuild. Mitigation: tests MUST use dedicated `Test*` sheets from session start, never touch production tabs.

**Anchors.**
- `TestRunner.js:21-26` registers 4 suites: `OrderServiceTest`, `ProductServiceTest`, `ComaxAdapterTest`, `WebAdapterTest`.
- Invoked at `HousekeepingService.js:641`; result logged at `:642-643` but `total === 0` not flagged.
- **Current quality: decorative.** `ComaxAdapterTest:33-87` is inline mock arithmetic that never calls `ComaxAdapter.processProductCsv`. Tests "pass by default."
- Existing test fixtures: `TestData.js`.

**Implementation.**
1. Rewrite `ComaxAdapterTest` to invoke `ComaxAdapter.processProductCsv` against `TestData.js` fixtures landed in dedicated `TestComax*` sheets. Cover: happy path, schema-mismatch column count, empty file, malformed row.
2. Rewrite `WebAdapterTest` similarly against `TestWeb*` sheets.
3. Add guard at `HousekeepingService.js:641-646`: if `testResult.total === 0` OR `testResult === null`, call `reportFailure('tests.empty_or_null_result', ..., 'High', ..., sessionId)`. Pass-by-default vanishes.
4. Move `OrderServiceTest` + `ProductServiceTest` to `tests-deferred/` folder, `.claspignore` them, remove references from `TestRunner.js:21-26` (otherwise runtime errors). Document the deferral in Tier 6.7 of this doc.

**CCPs.** CCP-1 (reportFailure on empty result), CCP-2 (sessionId).

**Smoke.** Run `TestRunner.runAllTests()` from the editor. Expect non-zero total, all `ComaxAdapter` + `WebAdapter` tests passing. Run `performDailyMaintenance` and inspect SysLog: "Unit tests: N/N passed" with N > 0. Force a known-bad assertion in one test, redeploy, confirm Phase 2 reports failure.

**Rollback.** Git revert + redeploy. Test sheets remain — manually delete if needed. If a test accidentally wrote to a production tab (despite using TestData fixtures), restore from Drive version history.

**Depends on.** Nothing structural. Risk accepted on rollback without 4.1.

**Open.**
- `[start]` Confirm `TestData.js` fixtures exist for ComaxAdapter + WebAdapter happy-path inputs, or generate at session start.

**CCP audit.** CCP-1 reportFailure fires on empty/null testResult; CCP-2 sessionId threaded into reportFailure.

### Tier 3, visibility

#### 3.1 Integration heartbeats panel + `orders_last_pull` fix

**Goal.** Dashboard widget shows last-successful-pull per integration with per-source staleness thresholds. Dead `orders_last_pull` key gets written.

**Anchors.**
- Already written: `woo.api.products_last_pull` at `WooProductPullService.js:53, :372`; `system.mailchimp.subscribers_last_update.value` at `ContactImportService.js:563`; `system.mailchimp.campaigns_last_update.value` at `CampaignService.js:1130`; `system.brurya.last_update` at `WebAppInventory.js:551, :1159`; `WebAppDashboardV2.js:676`.
- **Bug: `woo.api.orders_last_pull` declared in `config/system.json` (per `SetupConfig.js:2158`), read at `WebAppSync.js:1058`, but `WooOrderPullService.pullOrders` (`:19-74`) never writes it.** Dead key.
- Comax last-import: not a config key; query SysJobQueue for most recent COMPLETED row with `job_type='import.drive.comax_products'`, read its `processed_timestamp`.
- Card precedent: existing card pattern in `AdminDashboardView_v2.html`.
- Chat webhook reality (open question from §3.5): grep again definitively; build if missing.

**Implementation.**
1. Fix the dead key: in `WooOrderPullService.pullOrders`, on success path, write `setConfig('woo.api', 'orders_last_pull', new Date().toISOString())`. Mirror the precedent at `WooProductPullService:53`. Stamp on success only (not on attempt).
2. New `WebAppSystem.js` (or similar) function `getIntegrationHeartbeats()` returning JSON for the widget: `{products: {ts, age_min}, orders: {ts, age_min}, mailchimp_subscribers: {...}, mailchimp_campaigns: {...}, comax: {...}}`.
3. New `IntegrationHeartbeatWidget.html` (or addition to existing dashboard widget) reading the JSON and rendering staleness per source. Per-source thresholds in SysConfig: `system.heartbeat.threshold_min.{products|orders|mailchimp|comax}` (defaults: 60 min for orders, 1440 min for products and Mailchimp, 1440 for Comax).
4. Resolve §3.5 Chat-webhook verification note: grep `LoggerService.js` + `NotificationService.js` for any `UrlFetchApp.fetch` to a webhook URL. If found, document. If not, decide: build a Chat-webhook bridge in `NotificationService._updateHealthStatusWithAlert`, or remove the claim from `ARCHITECTURE.md` §4.2.

**CCPs.** CCP-1 (any error from heartbeat read → reportFailure), CCP-6 (thresholds in SysConfig).

**Smoke.** (a) Trigger a real WC order pull, confirm `orders_last_pull` populates. (b) Open dashboard, see 5 sources with timestamps. (c) Set one threshold low (e.g., `products` to 1 min), confirm staleness alert renders. (d) Confirm Chat webhook either definitively works or definitively does not (close the §3.5 note).

**Rollback.** Git revert + redeploy. New SysConfig keys orphan harmlessly or clean via rebuild. The `orders_last_pull` writer fix is non-reversible-impact (just adds a write) so safe to leave even on partial revert.

**Depends on.** Nothing. Independent.

**Open.**
- `[spike]` Chat webhook reality. Grep `LoggerService.js` + `NotificationService.js` for `UrlFetchApp.fetch` to a webhook URL at session start. If absent, decide: build a Chat-webhook bridge or remove the claim from `ARCHITECTURE.md` §4.2.

**CCP audit.** CCP-1 reportFailure on heartbeat-read error; CCP-6 per-source thresholds in SysConfig.

#### 3.2 Flat-file system status export (`jlmops-status.md`)

**Goal.** Single Claude-readable markdown file regenerated periodically with system health, KPIs, recent errors. Also mirrored to kosbracha's snapshot folder when 4.1 ships.

**Anchors.**
- Data sources (per agent pass):
  - System: `WebApp.js:6-9` `VERSION.built` + `.commit`; `ConfigService.getConfig('system.deployment.pinned_id').value`; health-task notes JSON `last_housekeeping.timestamp` (`HousekeepingService.js:700-718`); `SyncStateService.getSyncState().stage` (`:58`).
  - Integrations: SysConfig keys per 3.1 above; Comax last-success from SysJobQueue COMPLETED rows.
  - Queue: SysJobQueue (lowercase columns per 2.2 anchors).
  - Data quality: `task.system.health_status` notes JSON fields `last_housekeeping.unit_tests / validation_issues / schema_status / schema_critical` (`HousekeepingService.js:710-713`).
  - Capacity: iterate `SheetAccessor.getDataSpreadsheet().getSheets()`, call `getLastRow()` per sheet (cheap, not `getDataRange().getValues()` which would be expensive).
  - **KPIs: `KpiService.js` is a stub** (TODOs at `:52, :82`). Aggregations live in `WebAppDashboardV2.js:107, :186, :725-755`. Refactor a callable helper out of V2 dashboard, OR build new aggregators (today's orders, this-week's orders, etc.).
  - Errors: net-new `LoggerService.getRecentErrors(n)` helper (LoggerService currently only writes).

**Implementation.**
1. New service `StatusReportService.js`. Public entries `refreshLiveBlocks(sessionId)` and `refreshKpiBlock(sessionId)`.
2. New SysConfig keys: `system.file.status_report` (Drive file ID), `system.status.live_path` (Drive parent path).
3. `refreshLiveBlocks` invoked at end of `runFrequentMaintenance` (15-min cadence). `refreshKpiBlock` invoked once in daily housekeeping Phase 3.
4. Atomic full-rewrite via `DriveApp.getFileById(statusFileId).setContent(markdown)`. **Wrap entire body in try/catch + `reportFailure('status_export.refresh', ..., 'Normal', ...)` so a regeneration failure does not break `runFrequentMaintenance`.** Status file is a reporting surface, not critical path; degrading to yesterday's file is acceptable.
5. Markdown structure: sections System / Integrations / Queue / Data quality / Capacity / KPIs (with "last refreshed N hours ago" subline) / Recent errors.
6. New `LoggerService.getRecentErrors(n)` helper. Query SysLog via range-limited read from bottom (not `getDataRange().getValues()` over thousands).
7. KPI block: **commit to fresh aggregators in this session, defer V2 dashboard refactor to Tier 6.8.** Reasoning: refactoring V2 dashboard mid-status-file session risks breaking the live dashboard; ship fresh aggregators in `StatusReportService.js` accepting some duplication; Tier 6.8 reconciles later. Fresh aggregator scope: today/week/month orders count + revenue from WebOrdM aggregation (date-stamp filter), new vs returning customer split (count of contacts where `sc_FirstCompletedDate` is within window), EN/HE language split from order metadata.
8. Time formatting: `Utilities.formatDate(new Date(), 'Asia/Jerusalem', '...')` precedent at `HousekeepingService.js:555`. **Memory `feedback_israel_time_powershell_not_tz` does NOT apply** — that's a developer-machine rule for Git Bash UTC. GAS runtime has the right API.

**CCPs.** CCP-1 (reportFailure on body throw), CCP-2 (sessionId), CCP-3 (range-limited reads for SysLog tail).

**Smoke.** (a) First run: open the file at configured Drive ID, confirm all sections render with real data, timestamps in IL time. (b) Force an error in `refreshLiveBlocks` (e.g., remove a SysConfig key the function reads), confirm next `runFrequentMaintenance` does not crash; a reportFailure task is created. (c) Confirm Drive MCP can fetch the file by ID without auth issues.

**Rollback.** Git revert + redeploy. New SysConfig keys orphan harmlessly. The Drive file can be deleted manually.

**Depends on.** Nothing structural. Soft sequence: ideally after 3.1 so heartbeat values exist; before 4.1 so the mirror-to-snapshot integration can hook the existing status file.

**Open.**
- `[defer]` V2 dashboard refactor for KPI source consolidation queued to Tier 6.8.

**CCP audit.** CCP-1 reportFailure wraps the full body and does not propagate; CCP-2 sessionId threaded; CCP-3 SysLog tail read uses range-limited not getDataRange.

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

**Independent (can ship any order within tier):** 1.1, 1.2 (staged), 1.3 (staged), 2.1, 2.2, 2.3, 3.1, 3.3, 4.1, 5.1, 6.3, 6.5.

**Hard dependencies:**
- 3.4 depends on 1.1 (reconciler must exist) AND 2.1 (UI close path).
- 4.2 depends on 4.1 (snapshots exist) AND 3.2 (status file exists).
- 5.2 depends on 3.2 (status file exists).
- 6.7 depends on 2.3 (test pattern established).
- 6.8 depends on 3.2 (status file exists; refactor consolidates).

**Soft dependencies + risk decisions:**
- 2.3 (test rewrite) ships before 4.1 (snapshots). **Risk accepted (v2.1):** user priority is data integrity over DR. Mitigation: tests must use dedicated `Test*` sheets from session start, never production tabs.
- 3.2 (status file) ideally after 3.1 so heartbeat values exist; can ship before if 3.2 block shows "key missing" placeholders for the dead `orders_last_pull` key.

**Recommended ship order:** 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 3.4 → 4.1 → 4.2 → 5.1 → 5.2 → 6.x (any order).

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

- **Chat webhook reality.** Did `ARCHITECTURE.md` §4.2's claim ever ship, or was it aspirational? Code agent found task-creation path in `NotificationService.reportFailure` but no `UrlFetchApp.fetch` to a Chat webhook. Resolve in Tier 3.1.
- **`task.system.*` UI close path scope.** Uniform across all system task types, or just `validateDeployment`? Resolve in Tier 2.1.
- **GitHub presence.** Is any jlmwines repo on github.com with secret-scanning available? Affects Tier 6.3 spike depth.
- **External-contractor candidates** for Tier 6.4 contact tree.
- **Upgrade-to-external snapshot trigger.** When (if ever) does the strategy upgrade from second-account-only to add Backblaze B2? Triggers: revenue threshold, regulatory requirement, an actual close call. Document; don't act until.

## 9. Review pass record

**v1 (2026-05-28).** Three expert reviews conducted in parallel via subagents:

1. **SRE design review** — flagged bus-factor as biggest blind spot; tightened RTO; demoted OAuth inventory; rejected same-Drive snapshots as DR; flagged weekly-review cadence as unrealistic.
2. **Code-vs-claims verification** — 12/13 claims VERIFIED with file:line refs (snapshot+restore at `SetupConfig.js:19-109`, zombie killer at `OrchestratorService.js:566-600`, inline reaper at `:1105-1170`, trigger guard at `HousekeepingService.js:550-564`, etc.). One claim PARTIAL: `ARCHITECTURE.md` §4.2's Google Chat webhook on ERROR — code shows task-creation in `NotificationService.reportFailure` but no direct webhook found. Folded into §3.5 verification note.
3. **Adversarial blind-spot review** — P0 modes added as new surfaces §3.7 (secrets), §3.8 (bus factor), §3.9 (vendor/account integrity); P1 modes folded into §3.6 (adversarial inputs) and Tier 3 item 12; P1 DSAR + P2 WC-compromise folded into new Tier 5.

Convergent findings (multiple agents agreed): bus factor as primary risk, same-Drive snapshots not real DR, secrets surface entirely missing from v0.

## 10. Status

Draft v2.1 written 2026-05-28. Self-critique pass identified 14 issues; all folded in:
1. Stale Tier cross-references in §6 / §7 / target map fixed.
2. Tier 1.3 LockService restructured to 5 staged deploys (helper + 4 lock applications) with 24-hour observation between.
3. Tier 1.2 input safety split into 3 staged deploys (WC cap / Comax try / Doc sanitization).
4. Tier 2.3 test rewrite scope committed (ComaxAdapter + WebAdapter only; others deferred to Tier 6.7).
5. Tier 2.3-before-4.1 risk explicitly accepted, mitigation documented.
6. Mailchimp activity-log moved from Tier 6 to Tier 3.3 (visibility tier).
7. Tier 3.2 KPI block scope committed (fresh aggregators in-session; V2 dashboard refactor deferred to new Tier 6.8).
8. `[start]` / `[spike]` / `[defer]` taxonomy added to every Open question.
9. CCP audit subsection added to every implementation session (sessions 1.1 through 5.2; Tier 6 entries lightweight don't need it).
10. Capability targets table added at end of §4 mapping target → sessions.
11. Snapshot/status Drive-MCP asymmetry made explicit in Tier 4.1 (workbook snapshots not Claude-readable, status file is).
12. Session opening discipline pointer added at top of §5 (read plan + bugs + session-log; commit small; push then deploy as separate change-points).
13. Self-refresh checkpoint added to §6 (re-read §3 surfaces every 3 shipped sessions).
14. Tier 3.3 renumbered to 3.4 (aggregate-consistency scheduled check) since Mailchimp took 3.3.

**Plan now covers 16 sessions across 6 tiers** (was 14 in v2; +1 for Mailchimp moved up, +1 for V2 dashboard refactor deferred from 3.2). Sessions 1.2 and 1.3 ship multiple staged deploys, so total deploy count is higher than session count.

**Ready to ship.** First session: **Tier 1.1 SysContacts aggregate fix** — anchored bug root, no dependencies, low rollback risk.

Prior-version notes (superseded; kept for traceability):

Next decisions to unblock implementation:
- Designate the secondary Google account email (could happen alongside Tier 1.1 session start)
- Confirm operator identity for Tier 1.5 runbook
- Confirm bus-factor time budget (~1 session runbook + ~30 min/quarter dry-runs)

Tier 1.1 (snapshots) and Tier 1.2 (status file) are the natural first two remediation sessions, in that order. They can ship in one combined session if scope fits, or split if integrity-verification work expands.
