# Detection Register, jlmops

**Created:** 2026-06-09 (from the §1A detection-coverage audit in `RELIABILITY_AUDIT.md`)
**Owner:** Session-driven. Maintained as part of the reliability work.
**Purpose:** One catalog of every system invariant the platform *should* be detecting, the check that detects it (or "GAP — none"), its severity, whether the detected violation reaches **communication** (`NotificationService.reportFailure` → self-healing task via `resolveFailure`), and whether it is **surfaced** (dashboard / status export). This is the artifact §1A of `RELIABILITY_AUDIT.md` calls for: it closes the gap between *Detect* and *Communicate* and grows with the system instead of drifting behind it.

## How to use this doc

- **A gap** = any invariant with no check, OR a check that detects but is not wired to `reportFailure`, OR a heartbeat that is recorded/displayed but never thresholded into an alert.
- **Two-leg rule.** Detection is worthless without communication. Every row should end in `reportFailure` AND be surfaced; a row that only `logger.warn`s or only creates a passive task is a partial gap.
- **Refs are an audit snapshot (2026-06-09).** Anchors (`File.js:line`) were captured by the audit pass and a few were approximate. **Re-verify the anchor before implementing** — same discipline as the §3 deep re-verify.
- **When closing a gap, edit the row in place** (GAP → check fn + anchor + ✓ wired) and note the session/deploy. Don't delete rows; the register is the running record.
- **Adding a feature?** Run the New-feature reliability gate at the bottom before you ship it, and add its invariants here.

## Legend

- **→fail** = terminates in `NotificationService.reportFailure` (the communicate leg). `partial` = creates a passive task or logs only.
- **Surfaced** = reaches the admin dashboard and/or the `jlmops-status.md` export.
- **Status** = ✓ covered · ◑ partial · ✗ GAP.

---

## Class 1 — Archiving actually happens

Every high-volume / append-only master that should archive is archiving (not silently stalled); newly-added high-volume data gets archive handling.

| Invariant | Check (or GAP) | Anchor | Sev | →fail | Surfaced | Status |
|---|---|---|---|---|---|---|
| Archive move is atomic + verified (count before/after, throw on mismatch) | `_moveRowsToArchive` | `HousekeepingService.js:305` | High | no (throws, not reported) | no | ◑ |
| WebOrdM / WebOrdItemsM / SysOrdLog archived daily | `archiveCompletedOrders` (Phase 1) | `HousekeepingService.js` (Phase 1) | — | — | — | ✓ |
| SysTasks archived daily | `archiveCompletedTasks` | `HousekeepingService.js:1826` | — | — | — | ✓ |
| SysLog archived/cleaned daily | `cleanOldLogs` | `HousekeepingService.js:511` | — | — | — | ✓ |
| **Archiving actually ran (not silently stalled)** | GAP — archive fns return a boolean callers ignore; no alert on zero/stalled archive | — | High | ✗ | ✗ | ✗ |
| **SysProductAudit bounded** | GAP — no archive, no purge; unbounded growth | — | Med | ✗ | ✗ | ✗ |
| **SysActivityLog bounded** | GAP — no archive, no purge; unbounded growth | — | Med | ✗ | ✗ | ✗ |
| SysJobQueue bounded | `purgeOldJobs` (30-day delete; `checkFailedJobs` sweeps failures first) | `HousekeepingService.js:1839+`, `:1857` | Low | ✓ (sweep) | — | ✓ |

## Class 2 — Master ∪ archive in analysis

Every analytical / aggregate read over a master also reads its archive. This is the root cause of the write-verify bug (1.1) — treated as a class, not one site. Tasks/SysLog master-only reads are **by design** (archive = done/historical) and are not gaps.

| Invariant (reader unions archive) | Check (or GAP) | Anchor | Sev | →fail | Surfaced | Status |
|---|---|---|---|---|---|---|
| Contact aggregate update unions WebOrdM_Archive | `updateContactsFromOrders` | `ContactImportService.js:627` (archive at `:659`) | — | ✓ (`reconciliation.sys_contacts.write_verify`) | — | ✓ |
| Order-history import unions archive | `importFromOrderHistory` | `ContactImportService.js:52` (archive `:78`) | — | — | — | ✓ |
| 12-month spend reconcile unions archive | `updateContactSpend12Month` | `HousekeepingService.js:122` (archive `:201`) | — | — | — | ✓ |
| Enrichment items-by-email unions archive | `ContactEnrichmentService` | `:431`/`:447-457`, `:727` | — | — | — | ✓ |
| **Campaign recent-spend** | GAP — reads WebOrdM only | `CampaignService.js:1401` | Med | ✗ | ✗ | ✗ |
| **Campaign 2025-spend** | GAP — reads WebOrdM only | `CampaignService.js:1468` | Med | ✗ | ✗ | ✗ |
| **Welcome-outreach task creation** | GAP — reads WebOrdM only; archived orders skip the trigger | `HousekeepingService.js:929` | High | ✗ | ✗ | ✗ |
| **Pending-payment follow-up creation** | GAP — reads WebOrdM only | `HousekeepingService.js:1055` | High | ✗ | ✗ | ✗ |
| **Comax-export order count** | GAP — reads SysOrdLog, not OrderLogArchive | `OrderService.js:710` | Med | ✗ | dashboard | ✗ |
| **On-hold order count** | GAP — SysOrdLog only | `OrderService.js` (~`:474`) | Med | ✗ | dashboard | ✗ |
| **Processing order count** | GAP — SysOrdLog only | `OrderService.js` (~`:505`) | Med | ✗ | dashboard | ✗ |
| **Recent-activity sync** | GAP — `syncRecentOrderActivity` master-only while `backfillOrderActivity` unions (inconsistent) | `ActivityBackfillService.js:99` vs `:250+` | Med | ✗ | ✗ | ✗ |

## Class 3 — Referential integrity / orphans

Every FK edge has no danglers, with a scheduled scan wired to communication.

| FK edge | Check (or GAP) | Anchor | Sev | →fail | Scheduled | Status |
|---|---|---|---|---|---|---|
| SKU across WebProdM/WebProdS_EN/WebDetM/WebDetS/WebXltM/SysProductAudit/SysTasks/CmxProdM | `fixOrphanSku` (full) — manual, log-only | `ProductService.js:2216` | Med | ✗ | on-demand | ◑ |
| ↳ proactive-replace path | `webProductReassign` — **misses WebProdS_EN, WebDetS, SysTasks** (known latent gap, confirmed) | `ProductService.js:2356` | Med | ✗ | on-demand | ✗ |
| Web-side orphan SKU (Comax deleted product) | GAP — no proactive scan; validation checks missing-Comax, not orphaned-web | — | Med | ✗ | ✗ | ✗ |
| WebDetM → WebProdM (orphan details) | validation rule B4 (creates task) | `config/validation.json:264` | — | partial | daily | ◑ |
| `SysTasks.st_ProjectId → SysProjects` | GAP — none (PROJ rename/delete orphans tasks) | — | Med | ✗ | ✗ | ✗ |
| `SysTasks.st_LinkedEntityId → SysLibrary` | GAP — `runLibraryIntegrityReport` checks Drive-file orphans only, not task→slug; log-only | `HousekeepingService.js:1294` | Med | partial | daily | ✗ |
| Bundle slot `sbs_ActiveSKU → WebProdM` | GAP — `getBundleDeficiencies` checks stock/criteria, not existence | `BundleService.js` / `HousekeepingService.js:1481` | Med | partial (task) | daily | ✗ |
| Campaign `spro_CampaignId` / `scm_MarketingCampaignId` | GAP — none | `ProjectService.js:185`, `WebAppCampaigns.js:63` | Med | ✗ | ✗ | ✗ |
| Contact ↔ order (1:N existence) | GAP — only sum-reconciliation exists, not per-row existence | `ContactImportService.js:967` | Low | ✓ (sum only) | — | ◑ |

## Class 4 — Aggregate reconciliation

Stored aggregates match their source within tolerance (generalize the CCP-3 write-verify pattern).

| Aggregate | Check (or GAP) | Anchor | Sev | →fail | Status |
|---|---|---|---|---|---|
| SysContacts `sc_OrderCount`/`sc_TotalSpend`/`sc_LastOrderDate`/`sc_AvgOrderValue` | write-verify post-update; `resolveFailure` on heal | `ContactImportService.js:967-978` | High | ✓ | ✓ |
| **SysBundles `sb_MinTotal`/`sb_MaxTotal`** | GAP — manual input; nothing asserts bundles still honor the band after a manual edit | `BundleService.js:116-117` | Low-Med | ✗ | ✗ |
| **Health-status snapshot counts** | GAP — `task.system.health_status` notes (test/validation/job counts) never verified truthful against sources | `HousekeepingService.js:728-748` | Med | ✗ | ✗ |

## Class 5 — Liveness

Every scheduled check/trigger is actually running; a detector that silently stopped is itself an undetected gap.

| Invariant | Check (or GAP) | Anchor | Sev | →fail | Status |
|---|---|---|---|---|---|
| Integration last-pull timestamps recorded | `woo.api.orders_last_pull` / `products_last_pull`; `system.mailchimp.subscribers_last_update` / `campaigns_last_update`; `system.brurya.last_update` | `WooOrderPullService.js:41,:72`; `WooProductPullService.js:53,:380`; `ContactImportService.js:564`; `CampaignService.js:1130`; `WebAppInventory.js:578,:1186` | — | — | ✓ |
| Heartbeats displayed | dashboard integration card | `WebAppDashboardV2.js:94-158`, `AdminDashboardView_v2.html:158` | — | — | ✓ |
| **Heartbeat staleness alert** | GAP — timestamps displayed but no scheduled threshold check → `reportFailure` (Display-but-don't-Detect) | — | **Crit** | ✗ | ✗ |
| **Trigger-run heartbeat** | GAP — no "housekeeping finished today" marker | — | **Crit** | ✗ | ✗ |
| **Required triggers still installed** | GAP — no `ScriptApp.getProjectTriggers()` scan; hourly/daily/15-min are UI-created (only `runPostSyncBundleHealth` is code-installed) and can be deleted silently | `SyncStateService.js:133` (the lone code-installed one) | **Crit** | ✗ | ✗ |
| **Comax import heartbeat** | GAP — no `system.comax.import_last_pull` key (dashboard infers from SysJobQueue COMPLETED rows) | — | Med | ✗ | ✗ |
| **CRM import/enrich pipeline heartbeat** | GAP — no completion marker for `refreshCrmContacts` Phase 3 | — | Med | ✗ | ✗ |

---

## Already-wired detectors (the model to copy)

For reference when wiring a new gap — these already terminate in `reportFailure`:

| Detector | Anchor | Context |
|---|---|---|
| Failed-job sweep | `HousekeepingService.js:1936` | `queue.failed_job_sweep` (High/Critical only) |
| Contact write-verify | `ContactImportService.js:968` | `reconciliation.sys_contacts.write_verify` |
| Stuck-job reaper (hourly + poll) | `OrchestratorService.js:585`, `:1149` | `job.{type}` |
| Empty/null test result | `HousekeepingService.js:671` | `tests.empty_or_null_result` |
| WC oversize response | `WooApiService._fetch` (1.2 Stage A) | `integration.woo.response_oversize` |

Detectors that **detect but don't communicate** (the wiring sweep targets): archiving stall, `runLibraryIntegrityReport`, bundle health, the `master_master` validation suite results, schema validation — all log-only or passive-task-only.

---

## Gap summary → candidate sessions

The register collapses into four low-risk Tier-3 (detection/visibility) sessions. None need LockService, so all are a safer near-term fit than 1.3 concurrency. Listed highest-leverage first.

1. **Liveness + heartbeat alerting** (closes the three CRITICAL Class-5 gaps). One new scheduled `checkLiveness()` in housekeeping: threshold each integration heartbeat → `reportFailure`; scan `getProjectTriggers()` for the three required handlers → `reportFailure`; stamp a daily "housekeeping completed" heartbeat; add the Comax + CRM heartbeat keys. This is the substance of the still-open §3.3 trigger-heartbeat gap + the 3.1 follow-up. Thresholds live in SysConfig (CCP-6).
2. **"Wire detectors to reportFailure" sweep** (cheap). Add the communicate leg to archiving-stall, library-integrity, bundle-health, validation-suite, schema-validation. Pure Detect→Communicate closure; no new detection logic.
3. **Master ∪ archive read fixes** (Class 2). Mechanical: mirror the archive-merge block (`ContactImportService.js:78-131`) into the seven master-only readers. Same recipe as the shipped 1.1 fix; add a write-verify where it's an aggregate.
4. **Orphan-scan session** (Class 3) — the natural content for the still-open **Tier 3.4**. One scheduled integrity scan for the uncovered FK edges (project, entity, bundle-slot, campaign, web-side orphan SKU) → `reportFailure`. Also close the `webProductReassign` sheet-coverage gap while in `ProductService`.

Lower-urgency register items not in the four sessions: unbounded `SysProductAudit` / `SysActivityLog` (Class 1 — growth, not correctness); SysBundles band reconciliation + health-snapshot truthfulness (Class 4 — Low-Med).

---

## New-feature reliability gate

Run this whenever anything new is added, so coverage grows with the system (reproduced from `RELIABILITY_AUDIT.md` §1A so it lives next to the register it feeds):

- [ ] Does this produce data that needs **archiving**? (→ Class 1 row + verify the archive move is wired)
- [ ] Does any **analysis** of it read **master ∪ archive**? (→ Class 2 row)
- [ ] Does it add an **FK edge** that needs **orphan detection**? (→ Class 3 row)
- [ ] Does it need an **aggregate reconciliation** twin? (→ Class 4 row)
- [ ] Is its detector **wired to `reportFailure`** and **surfaced** (dashboard + export)? (→ the two-leg rule)
- [ ] If it adds a scheduled check/trigger, is its **liveness** detectable? (→ Class 5 row)
