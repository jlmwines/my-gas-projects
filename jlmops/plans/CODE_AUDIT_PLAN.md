# jlmops Code Audit Plan

**Created:** 2026-06-04
**Status:** Draft — planning only, no implementation yet. Scopes the audit dimensions that existing docs do **not** cover. **Reviewed + premises verified 2026-06-04 (second session) — see §8.**
**Owner:** Session-driven. User observes and tests; does not co-author.

## 1. Why this exists

JLMops has deep audit coverage along two dimensions — **reliability/data-integrity** (`RELIABILITY_AUDIT.md`) and **UI/UX** (`UI_AUDIT.md`, `DEVELOPER_VIEW_AUDIT.md`) — plus **performance** (`PERFORMANCE_OPTIMIZATION_PLAN.md`) and a stack of subsystem reliability slices (`SYNC_HARDENING_PLAN.md`, `RELOAD_RESILIENCE_PLAN.md`, `VALIDATION_AND_INVENTORY_FIX_PLAN.md`, `PRODUCT_VERIFICATION_PLAN.md`). That coverage skews to **inventory / products / orders / sync**.

A coverage-mapping pass (2026-06-04) found dimensions and subsystems with little or no audit-grade coverage. This plan targets only those gaps. It deliberately does **not** re-audit reliability or UI — where this plan touches a finding those docs already own, it cross-references rather than restates.

**Scoping principle.** Existing coverage is organized **by dimension**, and the gaps are dimensional (authorization, code-quality, error-handling, tests). So the audit is scoped **by dimension**, with **one subsystem-scoped pass** carved out for CRM + campaigns — the surfaces no existing audit has reached at all.

## 2. The gaps (from the 2026-06-04 coverage map)

| # | Gap | Why it's genuinely uncovered |
|---|---|---|
| 1 | **Service-layer code-quality / architecture conformance** | ~45 services; no current audit of layering violations, duplication, or drift from `ARCHITECTURE.md`. `TECH_DEBT_AUDIT.md` is the only prior pass — 2026-05-11, scan-only, "needs triage." |
| 2 | **Authorization / access-control** | `RELIABILITY_AUDIT.md` §1.2 covers input-safety + secret-leak, but **not** whether each `WebApp*` endpoint enforces a role check against `AuthService`. No endpoint-authz audit exists. |
| 3 | **Error-handling pattern consistency** | `RELIABILITY_AUDIT.md` wires *invariants* to `reportFailure`; no systematic sweep of try/catch coverage and failure propagation across all services. |
| 4 | **Test coverage (execution, not plan)** | `TEST_HARNESS_PLAN.md` is planning-only; only the two adapters were made honest. Real service-level coverage is effectively near-zero. |
| 5 | **Fresh dead-code / consistency sweep** | `TECH_DEBT_AUDIT.md` is stale; `UI_AUDIT.md` independently found 6 orphan widgets it had missed. Codebase has grown since. |
| 6 | **CRM + campaigns subsystem audit** | `Contact*`, `CrmIntelligenceService`, `Campaign*`, `Mailchimp`, `Coupon` are heavily feature-planned but un-audited across every dimension. |

## 3. Codebase surface (what the audit runs against)

Flat GAS project (~45 service `.js`, ~14 `WebApp*` controllers, 21 `.html` views, `config/*.json`). Subsystem grouping used throughout this plan:

- **Inventory** — `InventoryManagementService`, `WebAppInventory`, `WooInventoryPushService`
- **Products** — `ProductService`, `ProductImportService`, `CategoryService`, `PromotionsEngineService`, `WebAppProducts`
- **Orders / packing** — `OrderService`, `OrderHistoryImportService`, `PackingSlipService`, `PrintService`, `WebAppOrders`
- **Sync / housekeeping** — `OrchestratorService`, `SyncStateService`, `HousekeepingService`, `WooApiService`, `Woo*PullService`, `ComaxAdapter`, `WebAdapter`
- **CRM / contacts** — `ContactService`, `ContactImportService`, `ContactAnalysisService`, `ContactEnrichmentService`, `CrmIntelligenceService`, `ActivityBackfillService`, `WebAppContacts`
- **Campaigns / marketing** — `CampaignService`, `MarketingCampaignService`, `MailchimpService`, `CouponService`, `PromotionsEngineService`, `WebAppCampaigns`
- **Content library** — `LibraryService`, `WebAppLibrary`
- **Tasks / projects** — `TaskService`, `ProjectService`, `WebAppTasks`, `WebAppProjects`
- **Bundles** — `BundleService`, `WebAppBundles`
- **Config / schema / data layer** — `ConfigService`, `SetupConfig`, `SetupSheets`, `SheetAccessor`, `LookupService`, `schemas.json`
- **Platform / cross-cutting** — `WebApp` (routing), `AuthService`, `NotificationService`, `LoggerService`, `SeverityService`, `KpiService`, `StatusReportService`, `ValidationLogic`, `ValidationOrchestratorService`

## 4. Phases

Ordered by risk-to-effort and by how little they duplicate existing audits. Each phase is read-only investigation producing a findings table + a sequenced fix list — **no fixes ship inside the audit phase**; fixes route to their own sessions (precedent: `BUG_FIX_SEQUENCE.md`).

---

### Phase 1 — Authorization / access-control (gap 2). **Do first.**

**Why first.** Highest risk per unit of effort, smallest surface, near-zero overlap with anything existing. A missing role check on a destructive endpoint is a security hole, not a polish item. **Empirically confirmed 2026-06-04: only 2 of 15 `WebApp*` controllers reference `AuthService` (`WebApp.js`, `WebAppTasks.js`) — the gate is at `doGet` only, 13 controllers expose `google.script.run` endpoints with no server-side role check. See §8.**

**Method.**
1. Enumerate every server entry point — `function WebApp*_*` across the 14 controllers plus any top-level `function` exposed to `google.script.run` (and the `doGet`/`doPost` routing in `WebApp.js`).
2. For each, record: caller role(s) expected, whether it reads `AuthService.getActiveUserRole()` / gates on it, and whether the gate is **server-side** (client-side hiding ≠ enforcement).
3. Classify destructiveness (reuse the `DEVELOPER_VIEW_AUDIT.md` destructive/irreversible lens). The cross-product **destructive × ungated** is the priority list.
4. Spot-check the role map source: `AuthService._loadRoleMapFromConfig()` ← `config/users.json` — fail-open vs fail-closed when a user/role is missing.

**Output.** `endpoint × {role-expected, server-gated?, destructive?}` table; ranked fix list (destructive+ungated first). Findings that are *input* validation rather than *authorization* hand off to `RELIABILITY_AUDIT.md` §1.2 instead of being re-owned here.

---

### Phase 2 — Service-layer code-quality / architecture conformance (gap 1).

**Why second.** Largest latent-bug reservoir; also the substrate the other phases lean on (you can't reason about error-handling or dead code without a current read of the service layer).

**Method (survey, then verify — don't fix in place).**
1. **Layering conformance vs `ARCHITECTURE.md`** — View → `WebApp*` controller → Service → `SheetAccessor`. Flag services reaching into `SpreadsheetApp` directly instead of through `SheetAccessor`; controllers carrying business logic; views calling services not via a `WebApp*` shim.
2. **Duplication** — repeated helpers (`formatDate`, `escape`, index-map building, `*Idx[...]` header lookups) hand-rolled per file vs shared. (UI-side duplication is `UI_AUDIT.md`'s; this phase owns the **service** side.)
3. **`CONFIG`-as-data conformance** — hardcoded sheet names / magic strings / column letters that should resolve through `ConfigService` / `schemas.json` (the principle ARCHITECTURE §1 commits to).
4. **Function-size / responsibility smells** — services doing import + transform + write + notify in one function (hard to test, the exact pain `TEST_HARNESS_PLAN.md` flags).

**Output.** Finding table tagged S/M/L (reuse `TECH_DEBT_AUDIT.md` severity legend); each with one cross-reference if another doc already owns part of it. **Reconcile and supersede the stale `TECH_DEBT_AUDIT.md`** rather than spawning a parallel list.

---

### Phase 3 — CRM + campaigns subsystem pass (gap 6).

**Why here.** These subsystems are un-audited along *every* dimension, so this phase applies the Phase-1/2/4 lenses (authz, code-quality, error-handling, dead code) to one subsystem cluster at once, rather than waiting for each dimensional sweep to eventually reach them.

**Scope.** `Contact*`, `CrmIntelligenceService`, `ActivityBackfillService`, `Campaign*`, `MarketingCampaignService`, `MailchimpService`, `CouponService`, `PromotionsEngineService`, `WebAppContacts`, `WebAppCampaigns`. Reconcile against the feature plans that already exist (`CRM_PLAN.md`, `CONTACT_MANAGER_PLAN.md`, `CAMPAIGN_SYSTEM_PLAN.md`, `CAMPAIGN_ARCHITECTURE.md`, `CROSS_SELL_PLAN.md`) — flag where built ≠ planned (stale-plan rule).

**Special attention** (external side-effects = real-world blast radius): Mailchimp writes (subscribers/campaigns), coupon generation, welcome-outreach task creation. Verify each has error handling that surfaces to `reportFailure` and does not partially commit silently.

---

### Phase 4 — Error-handling pattern consistency (gap 3).

**Method.** Across all services: catch coverage on every external boundary (Woo API, Mailchimp, Drive, `LockService`); whether catches swallow vs rethrow vs `reportFailure`; consistency of the `fnName` + `LoggerService` pattern (`CODING_STANDARDS.md` precedent). Cross-reference `RELIABILITY_AUDIT.md`'s detection register — this phase audits *handling/propagation*, that doc owns *what invariants get detected*. Likely folds into `RELIABILITY_AUDIT.md` as a sub-section rather than shipping standalone if overlap is high (decide after Phase 1–3).

---

### Phase 5 — Dead-code / consistency sweep + test-coverage baseline (gaps 5, 4).

**Dead code (5).** Re-run the `TECH_DEBT_AUDIT.md` survey against the current tree: orphan views/widgets not in any `viewMap`, one-use functions, retired-feature remnants, stale config keys. Merge results into the Phase-2 output; retire `TECH_DEBT_AUDIT.md` once reconciled.

**Test coverage (4).** This phase only **baselines** coverage (which services have real vs decorative tests, per `RELIABILITY_AUDIT.md`'s suite findings); the *build-out* is owned by `TEST_HARNESS_PLAN.md` and is out of scope here. Output: a coverage gap list that feeds that plan's phasing.

## 5. Sequencing & dependencies

```
Phase 1 (authz)  ──┐
Phase 2 (code-quality) ──┬─→ Phase 3 (CRM/campaigns, uses 1+2 lenses)
                         └─→ Phase 4 (error-handling, leans on 2)
Phase 5 (dead-code/test baseline) — anytime after 2
```

Phase 1 is independent and ships first. Phase 2 unblocks 3/4/5. Each phase is one focused session; none ship code — they produce findings + a ranked fix list that becomes its own work (the `BUG_FIX_SEQUENCE.md` model).

## 6. Out of scope

- Reliability / data-integrity invariants — owned by `RELIABILITY_AUDIT.md`.
- UI appearance / mobile / a11y — owned by `UI_AUDIT.md`, `DEVELOPER_VIEW_AUDIT.md`.
- Dashboard performance — owned by `PERFORMANCE_OPTIMIZATION_PLAN.md`.
- Test-harness construction — owned by `TEST_HARNESS_PLAN.md` (this plan only baselines coverage).
- WordPress / theme / customer-facing site — separate `website/` work.
- Shipping any fix — audits produce findings; fixes are separate sessions.

## 7. Open questions

- Phase 4 standalone vs absorbed into `RELIABILITY_AUDIT.md` — decide after Phase 1–3 reveal the real overlap.
- Authz model: is "client hides the button" considered acceptable for any non-destructive read endpoint, or is server-side gating required everywhere? (Affects Phase 1 finding severity.)
- Whether to run Phase 3 (CRM/campaigns) before Phase 2 finishes, if CRM is the higher business priority this quarter.

## 8. Verification & review (second session, 2026-06-04)

Independent review by a second session. Premises checked against the live tree, not taken on faith:

- **Referenced docs all exist** — `RELIABILITY_AUDIT`, `UI_AUDIT`, `DEVELOPER_VIEW_AUDIT`, `PERFORMANCE_OPTIMIZATION_PLAN`, `TECH_DEBT_AUDIT`, `TEST_HARNESS_PLAN`, `SYNC_HARDENING_PLAN`, `ARCHITECTURE`, `CODING_STANDARDS`, `BUG_FIX_SEQUENCE`. Cross-references are sound.
- **Counts roughly confirmed** — 21 `.html` views (exact), 15 `WebApp*` controllers, ~45 service `.js` (69 `.js` total incl. controllers + tests).
- **Gap 2 (authorization) is empirically real — the strongest part of this plan.** Only **2 of 15** `WebApp*` controllers reference `AuthService` at all (`WebApp.js` routing + `WebAppTasks.js`). `doGet` gates the *initial* role (viewer → AccessDenied), but the other 13 controllers expose `google.script.run` endpoints with no server-side role check. Phase 1 is validated, not speculative.

Two scoping notes for whoever runs this:

- **"One focused session per phase" undersells Phase 2 and 3.** Service-layer code-quality across ~45 services, and a four-lens CRM/campaigns pass, are each realistically multi-session (compare `RELIABILITY_AUDIT` = 16 sessions). Treat this as a program, not a week.
- **Recommend decoupling Phase 1 (authz) and running it soon.** It is the one verifiably-real security gap; the rest is quality/debt that can wait. Highest value, smallest surface — do it even if nothing else from this plan ships.
