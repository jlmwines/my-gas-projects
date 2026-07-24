# jlmops Code Audit Plan

**Created:** 2026-06-04
**Status:** All 6 planned clusters reviewed and synthesized 2026-06-04→2026-07-23. Phases 1/2/3/5 complete as scoped; Phase 4 (error-handling) partially covered (Content Library pass onward only) — see §10 for the cross-cutting synthesis, fix-priority tiers, and the one remaining gap. Findings sequenced into implementation sessions at `jlmops/plans/CODE_AUDIT_FIX_SEQUENCE.md` (2026-07-24) — no fixes shipped yet, each session still needs explicit go-ahead.
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
- **CRM / contacts** — `ContactService`, `ContactImportService`, `ContactEnrichmentService`, `CrmIntelligenceService`, `ActivityBackfillService`, `WebAppContacts`
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

## 9. Execution — subsystem passes (started 2026-07-23)

Each pass runs as a background `general-purpose` Agent call, briefed to apply correctness/security/data-integrity/efficiency/maintainability lenses (Phase 1+2+5 gaps) plus a light test-coverage check to one file cluster at a time — the same method Phase 3 already prescribed for CRM/campaigns, now used for every cluster. Error-handling consistency (Phase 4) has not yet been checked as an explicit dimension in the passes below — add it to remaining passes. Actionable bugs get a one-line pointer in `.claude/bugs.md` referencing the numbered finding here.

**Phase 1 (authz) status:** confirmed real a third time, independently, in both passes below — no mutating function in Sync/Orders or Products/Inventory clusters re-checks caller role server-side. Matches the 2026-06-04 empirical count (2 of 15 controllers reference `AuthService`). Ready to execute fixes whenever prioritized.

**Phase 3 (CRM/campaigns) status: done 2026-07-23** — see findings below.

### Pass: Sync / Orders cluster (2026-07-23)

Files: `ComaxAdapter.js`, `ComaxAdapterTest.js`, `WebAdapter.js`, `WebAdapterTest.js`, `WooApiService.js`, `WooCommerceFormatter.js`, `WooProductPullService.js`, `WooOrderPullService.js`, `WooInventoryPushService.js`, `SyncStateService.js`, `WebAppSync.js`, `ProductImportService.js`, `OrderService.js`, `OrderServiceTest.js`, `OrderHistoryImportService.js`, `WebAppOrders.js`, `WpmlService.js`. (Not yet covered: `PackingSlipService.js`, `PrintService.js`, `HousekeepingService.js`, `OrchestratorService.js` — folded into the Platform/cross-cutting pass below.)

Overall: solid for daily production use — product upserts have real defensive layers (sanity checks, critical-field validation, quarantine-on-failure), the Woo API client isolates credentials and caps response size, the sync state machine's transitions are coherent. No evidence of live data corruption, matching the owner's experience of only transient UI glitches.

1. **`ProductImportService.js` `_upsertWebXltData` (data-integrity, high)** — copies `WebXltS` → `WebXltM` by raw column position instead of by field name (unlike every other upsert in the file). Works only because the two schemas happen to list fields in the same order today. A future schema edit that reorders/appends a column in one but not the other silently shifts every Hebrew product's translation row — same bug class as the vintage-snapshot incident, but table-wide blast radius. Filed: bugs.md.
2. **`WooOrderPullService.js` `_populateFlatLineItemFields` (data-integrity, medium-high)** — line-item cap hardcoded to `24` instead of reading `web.order.line_item_schema.max_line_items` like the CSV order path does. If that config value is ever raised, the API-pull path silently truncates large orders while the CSV path wouldn't. Filed: bugs.md.
3. **`WebAdapter.js` `processOrderCsv` (correctness, medium)** — final line-item check indexes `productItemFields` by hardcoded position instead of by name, despite the preceding logic already tracking fields by name. Reordering `product_item_fields` in config would silently validate the wrong columns.
4. **`WooCommerceFormatter.js` `_csvEscape` (correctness, low)** — quote-detection regex only matches `" ` (quote+space), not a bare trailing quote; muted because the only quote-heavy caller is dead code (#5).
5. **`WooCommerceFormatter.js` `formatProductsForExport`** — dead code (no callers); also references non-existent field names (`wps_WeightKg` etc. vs. real `wps_Weight`).
6. **`WooCommerceFormatter.js` `formatDescriptionHTML`** — ~175 lines of unreachable "ORIGINAL FORMATTING" branch gated by a `const` that can never be false.
7. **`WpmlService.js`** — entire file is unused scaffolding (zero callers), yet `docs/ARCHITECTURE.md` described it as live. Doc line removed 2026-07-23; real WPML handling lives in `WooProductPullService.js` via `wpm_Wpml*`/`wxm_Wpml*` fields, not yet documented in ARCHITECTURE.md.
8. **`WebAppOrders.js` `WebAppOrders_getOrdersWidgetData` (efficiency)** — 4 separate full-sheet scans of `SysOrdLog` where `OrderService.getDashboardStats()` already computes the same counts in one pass.
9. **`SyncStateService.js` `getSyncState`/`getActiveSession` (efficiency)** — both force a full `ConfigService.forceReload()` per call; every dashboard poll pays for 2+ full SysConfig re-parses.
10. **Test coverage (light check)** — Comax/WebAdapter tests never assert on price/stock edge values (non-numeric, negative, decimal); `OrderServiceTest.js` only covers two pure predicates — `processStagedOrders`/`exportOrdersToComax`/order-total logic has no coverage.

### Pass: Products / Inventory cluster (2026-07-23)

Files: `ProductService.js`, `ProductServiceTest.js`, `InventoryManagementService.js`, `CategoryService.js`, `ProductCostService.js`, `BundleService.js`, `ValidationLogic.js`, `ValidationOrchestratorService.js`, `WebAppProducts.js`, `WebAppInventory.js`, `WebAppBundles.js`.

Overall: competently built where actively maintained — `BundleService.js`'s generator (self-checks its own result against the live deficiency test) and `ProductCostService.js` are careful and match their docs; `ValidationLogic.js`/`ValidationOrchestratorService.js` form a solid generic rule engine. Risk concentrates in the older, less-visited SKU-management corner of `ProductService.js` and `InventoryManagementService.js`. Nothing found rises to active data corruption in normal operation — consistent with the owner's report of low-severity, self-correcting glitches. Confirmed by direct grep: `wxl_SKU` (retired field) appears at exactly the 3 lines flagged; `CategoryService.js` has zero callers anywhere in the codebase.

1. **`ProductService.js`: `vendorSkuUpdate`, `fixOrphanSku`, `webProductReassign` (data-integrity, high)** — all three reference the retired field name `wxl_SKU` instead of the live `wxm_SKU`, so `headers.indexOf('wxl_SKU')` returns -1 and the WebXltM update silently no-ops. The sibling function `correctProductName` uses the right field, confirming this was fixed once and never propagated to the other three. Filed: bugs.md.
2. **`InventoryManagementService.js`: `setBruryaQuantity`, `setInventoryCount`, `updatePhysicalCounts` (data-integrity, high)** — the "create new SysProductAudit row" fallback never populates `pa_CmxId` (the sheet's real primary key); it looks for nonexistent `cpm_ProdId`/`pa_ProdId` columns. A manual count for a SKU not yet seeded creates a row with blank `pa_CmxId`, causing a duplicate row on the next Comax import. Narrow window — `_maintainSysProductAudit` proactively seeds most rows first. Filed: bugs.md.
3. **Security (medium) — Phase 1 confirmation** — no mutating function in this cluster (`ProductService`, `InventoryManagementService`, `BundleService`, `WebAppProducts/Inventory/Bundles`) re-checks caller role server-side. Any authenticated user the web app is deployed to could call e.g. `vendorSkuUpdate`/`deleteBundle` directly via `google.script.run`, bypassing UI role gating — contradicts `ARCHITECTURE.md` §3.2's claim that an unlisted user "grants no access." Filed: bugs.md.
4. **`CategoryService.js` — dead code.** Zero callers; live category logic is `ConfigService.getCategoryDivisionMap()`/`getCategoryTextLookup()` reading `SysCategories`. `ARCHITECTURE.md` line describing it as live fixed 2026-07-23.
5. **`ProductService.js` `_upsertWebXltData`/file-based translation pipeline — orphaned.** A second, CSV-drop-based WebXltM path exists alongside the live API-based one; its only caller (`OrchestratorService.queueWebFilesForSync`) itself has no callers. Independently reimplements the same position-based copy pattern flagged in the Sync/Orders pass.
6. **`InventoryManagementService.js` `updatePhysicalCounts` (correctness, low)** — "created new row" branch returns `{action: 'updated'}` instead of `'created'`.
7. **`InventoryManagementService.js` `getStockLevel`/`updateStock` — dead code, broken if ever called** (calls nonexistent `ProductService.getProductById`; looks for unprefixed headers that don't exist).
8. **Efficiency (low)** — 4 widget-count functions in `InventoryManagementService.js` each do their own uncached full `SysTasks` scan — same redundant-read pattern as the Sync/Orders pass's `WebAppOrders` finding.
9. **Maintainability (low)** — `acceptProductSuggestion`, `webProductReassign`, `fixOrphanSku`/`vendorSkuUpdate` each re-implement "load headers → linear-scan → write" inline instead of using shared helpers — the duplicated surface that let finding #1 hide across three copies.
10. **Test coverage (light check)** — `ProductServiceTest.js` has 4 assertions total, all input-validation guards; none exercise the SKU-rewrite, price/stock, or category logic, so nothing would catch findings #1 or #2.

### Phase 3: CRM / Campaigns cluster — done 2026-07-23

Files: `ContactService.js`, `ContactImportService.js`, `ContactEnrichmentService.js`, `CrmIntelligenceService.js`, `CampaignService.js`, `MarketingCampaignService.js`, `MailchimpService.js`, `CouponService.js`, `PromotionsEngineService.js`, `WebAppContacts.js`, `WebAppCampaigns.js`. (Not yet covered at time of this pass: `ActivityBackfillService.js` — since reviewed in the Core Plumbing pass below. `ContactAnalysisService.js` doesn't exist in the codebase, confirmed via glob — removed from this plan's §3 file list.)

Overall: functionally solid for its primary daily-use paths (contact aggregation from orders, Mailchimp sync, campaign metrics pull); Mailchimp API key handling is correct (isolated to a separate SysEnv workbook, never exposed client-side). Consistent with the owner's report of low-severity, non-corrupting issues in practice. Three findings below are worth scheduling.

1. **`CampaignService.js` (security/PII, high)** — `filterYearInWine`, `exportYearInWine2025`, `exportYearInWineSimple`, `exportLapsed2024Customers` all gate on `c.sc_DoNotContact` to exclude opted-out contacts. That column does not exist anywhere in `SysContacts`'s schema (confirmed via grep against `config/schemas.json`) — it's always `undefined`, so the documented "excludes do-not-contact" filter has never actually excluded anyone. Every marketing export includes contacts a manager believes are suppressed. Filed: bugs.md.
2. **`WebAppCampaigns.js` `WebAppCampaigns_getCampaignDetail` (data-integrity, high)** — filters projects via `p.spro_CampaignId`, a field DATA_MODEL.md confirms was dropped from `SysProjects` when the FK direction reversed (`SysMarketingCampaigns.sm_ProjectId` now points at `SysProjects`) — confirmed via grep against `config/schemas.json`. Campaign Detail's project list is always empty. `ProjectService.js` still writes to the dropped field (dead code); `MarketingCampaignService.js`'s header comment still describes the old direction. Filed: bugs.md.
3. **Security (high) — Phase 1 confirmation** — zero server-side role checks across all 11 files in this cluster, including `WebAppContacts_sendEmail` (calls `GmailApp.sendEmail` directly) and `exportYearInWine2025`. Confirms the authz gap is subsystem-wide, not isolated. Filed: bugs.md.
4. **`CrmIntelligenceService.js` `_checkWineryClusters`/`getInsights` (correctness, medium)** — reads `c.sc_TopWineries`, but the schema only has `sc_TopWineries_En`/`sc_TopWineries_He` (dual-language) — always `undefined`, so the winery-cluster campaign suggestion and dashboard "top winery" insight never fire.
5. **`ContactEnrichmentService.js` `enrichAllContacts` (efficiency, medium-high)** — calls `ContactService.upsertContact` once per contact in its main loop, and `upsertContact` does a full sheet scan per call, even though `ContactService.batchUpsertContacts` exists for exactly this. Risks the 6-minute GAS execution ceiling as the contact base grows.
6. **`ContactImportService.js` (maintainability, medium)** — ~30-line archive-merge column-mapping block duplicated near-verbatim across `importFromOrderHistory` and `updateContactsFromOrders` (code's own comments acknowledge the duplication, never factored out).
7. **`PromotionsEngineService.js` — dead code.** Zero callers anywhere; reads a `"Promotions"` sheet that doesn't exist in the schema; uses `SpreadsheetApp.getActiveSpreadsheet()` directly instead of `SheetAccessor`/`ConfigService`. `ARCHITECTURE.md` line describing it as live ("calculates dynamic cross-sell and up-sell links") fixed 2026-07-23.
8. **`ContactImportService.js` (maintainability/config discipline, low)** — hardcoded Drive folder ID (`IMPORT_FOLDER_ID`) instead of a `system.folder.*` SysConfig entry.
9. **`CouponService.js`/`CampaignService.js` `importFromCsv` (efficiency, low)** — same per-row full-sheet-read pattern as #5, at smaller scale (low volume, minor real-world impact).
10. **`CrmIntelligenceService.js` hardcoded Gregorian holiday dates (correctness, low, self-acknowledged)** — code's own comment already flags annual manual upkeep is required.
11. **`ContactImportService.js` — dead local variable** `couponItems`, parsed but never used, in two functions.

### Pass: Content Library / Publishing cluster (2026-07-23)

Files: `LibraryService.js`, `ProjectService.js`, `WebAppLibrary.js`, `WebAppPublishing.js`, `WebAppProjects.js`.

Overall: reasonable day-to-day shape — the lazy-entity-creation/attach-to-replace versioning design is coherent, and field-mapping is consistently header-driven (no positional-column bugs here, unlike other clusters). The two real gaps are the same two the audit is tracking across subsystems: no server-side authorization at all, and no concurrency protection around several check-then-write sequences (believable double-click race, not exotic).

1. **Security (high) — Phase 1 confirmation.** Zero server-side role checks across all 5 files (confirmed via grep). `WebAppLibrary_abandonEntity`/`requestCorrection` and `WebAppProjects_deleteProject`/`updateProject` are enforced only by hidden UI — the code's own comments and `WORKFLOWS.md` §13.4-13.5 concede this. Any authenticated user could call these directly via `google.script.run`. Filed: bugs.md.
2. **Data integrity (medium-high)** — no `LockService` anywhere in `LibraryService.js`. `_ensureEntity` (called from `createBlankDoc`/`attachExistingDoc`/`createTranslationDraft`) reads all rows, checks for an existing slug, then appends — no lock between check and write. A double-click or two near-simultaneous sessions can create two `SysLibrary` rows with the same `slb_Slug`; `_getEntityRow`'s `.find()` then silently returns only the first, hiding the duplicate. `createBlankDoc`'s "refuse silent overwrite" file check has the same non-atomic shape, risking two Drive Docs in the canonical folder. Filed: bugs.md.
3. **Error handling (medium)** — `_supersedeFile`'s `try/catch` covers only the Doc-stamp step; the following `DriveApp...moveTo(archive)` is unprotected. Since `attachExistingDoc` already points `slb_DocUrl` at the new file before calling `_supersedeFile` on the old one, a missing/trashed old file throws here and the UI reports total failure even though the new version is already live — inviting a retry that creates a real duplicate.
4. **Correctness (medium)** — `WebAppPublishing.js#_extractTopic`'s hardcoded prefix list is missing `print-`/`mention-` (real content types) and includes `flyer-` (not a content type). A `print-*` slug's short URL comes out as `.../n/print-newsletter-...` instead of `.../n/newsletter-...`.
5. **Stale field reference** — `ProjectService.js` still reads/writes `spro_CampaignId`; confirmed via grep against `config/schemas.json` that the column doesn't exist (dropped when the Campaign↔Project FK direction reversed, per `DATA_MODEL.md`). No current caller passes `campaignId`, so dead rather than actively corrupting — same stale-field shape as `wxl_SKU` elsewhere in this codebase.
6. **Efficiency (low)** — every Library/Project read or write does a full unbounded sheet scan (module-level `_cache` exists but is never populated, see #7); `reconcileLibraryDuplicates` (daily housekeeping) adds one Drive folder-listing call per library row — not yet a real quota risk at current row counts.
7. **Maintainability** — `LibraryService.js`'s `_cache` Map is declared and `.delete()`'d but never `.set()` — permanently empty, does nothing.
8. **Minor doc drift** — `WORKFLOWS.md` §13.2's sibling-language-type list omits `print`, though `LibraryService.js`'s actual `SIBLING_LANGUAGE_TYPES` constant includes it correctly.
9. **Minor** — `ProjectService._rowToProject`'s camelCase derivation actually produces all-lowercase keys (`spro_ProjectId` → `projectid`); harmless since every consumer reads the same lowercase form, but the comment is misleading.
10. **Minor** — leftover debug `console.log` calls in `ProjectService.getAllProjects` and `WebAppProjects.js`, not gated behind a debug flag.

### Pass: Core plumbing / platform services (2026-07-23)

Files: `TaskService.js`, `OrchestratorService.js`, `ConfigService.js`, `SetupConfig.js`, `SetupSheets.js`, `SheetAccessor.js`, `LookupService.js`, `HousekeepingService.js`, `AuthService.js`, `LoggerService.js`, `NotificationService.js`, `StatusReportService.js`, `KpiService.js`, `KPISummaryService.js`, `ActivityBackfillService.js`, `SeverityService.js`, `PackingSlipService.js`, `PrintService.js`. (Note: `ContactAnalysisService.js`, named in this plan's §3 codebase surface, does not exist — confirmed via glob. Removed from scope; no equivalent file found under another name.)

Overall: noticeably better shape than the codebase average — most services here (`ConfigService`, `SheetAccessor`, `LookupService`, `NotificationService`, `SeverityService`, `StatusReportService`, `SetupSheets`) are deliberately defensive: header-name field mapping throughout, graceful degradation on missing config, comments that reference prior incidents. Confirmed by direct grep: `_invalidateWebAppTasksCache` doesn't exist anywhere (only `invalidateTaskCache` does); `currentStage` doesn't exist on the sync session object (only `.stage` does, at both flagged lines).

1. **`TaskService.js:635` (correctness)** — `updateTaskDates()` calls `_invalidateWebAppTasksCache()`, which doesn't exist anywhere in the codebase (the real helper is `invalidateTaskCache`). Every call throws immediately after the sheet write succeeds; the catch swallows it and returns `false`, so a manager editing a task's date sees an error toast for a change that actually persisted. Filed: bugs.md.
2. **`HousekeepingService.js:908, :1563` (efficiency)** — `refreshCrmContacts()` and `checkBundleHealth()` both gate their "skip if nothing changed" optimization on `syncSession.currentStage === 'COMPLETE'`, a field that never exists (only `.stage` does). Always `undefined === 'COMPLETE'` → false, so the skip never fires — the full CRM refresh cascade and bundle-deficiency scan run unconditionally every daily maintenance cycle. Same "defeats the cache" pattern as the Sync-core pass's `SyncStateService.forceReload()` finding, recurring by copy-paste. Filed: bugs.md.
3. **`TaskService.js` (efficiency)** — `createTask`, `hasOpenTasks`, `completeTask`, `updateTaskStatus`, `getTasksByProject`, `updateTaskNotes`, `findOpenTaskByType` each do a fresh Drive-wide filename search (`DriveApp.getFilesByName('JLMops_Data')`) instead of the ID-based, cached `SheetAccessor.getDataSpreadsheet()`. `createTask`'s de-dup check also does a full `SysTasks` scan per call. Any loop creating several tasks per run pays both costs once per task, not once per run.
4. **`OrchestratorService.js` (maintainability)** — `processSessionJobs` duplicates `processPendingJobs`'s job-dispatch switch but is missing the `ValidationOrchestratorService`/`WooInventoryPushService` cases the other has. Currently harmless (only invoked for job types that don't need those cases), but a live trap if a future job type is routed through this path.
5. **`KpiService.js` — dead, broken legacy file.** `updateAllKpis()` calls a bare global `orderService` that doesn't exist anywhere (every real caller instantiates `new OrderService(...)` locally) and targets a `KpiData` sheet not in the schema. Grep-confirmed zero callers. Fully superseded by `KPISummaryService.js`/`StatusReportService.js`. Recommend deleting the file.
6. **`ActivityBackfillService.js:581` (efficiency)** — `_getExistingActivityIds()` does a full `SysContactActivity` scan on every call, and runs on the frequent (~20 min) housekeeping cadence via `refreshCrmContacts`. No archiving policy exists for this table (unlike orders/tasks/jobs) — grows unbounded.
7. **Security — Phase 1, re-verified, no change.** `AuthService._loadRoleMapFromConfig()` is fail-closed as designed (missing user → `'viewer'`, least privilege — this part is correct). But `getActiveUserRole()` is still called from exactly one place (`WebApp.js doGet`); none of `TaskService`, `OrchestratorService`, or housekeeping functions re-check caller role before privileged mutations. Confirms the systemic gap a 5th time.
8. **`OrchestratorService.js:599-603` (trivial)** — duplicated `SpreadsheetApp.flush()` block, copy-paste leftover.
9. **`PackingSlipService`/`PrintService` (minor efficiency)** — both read/rewrite entire `SysPackingCache`/`SysOrdLog` ranges regardless of batch size; low severity since archiving keeps these tables bounded.

### Pass: WebApp entry/dashboard controllers (2026-07-23) — Phase 1 (authz) definitively resolved

Files: `WebApp.js`, `WebAppDashboard.js`, `WebAppDashboardV2.js`, `WebAppLookups.js`, `WebAppSystem.js`, `WebAppTasks.js`.

**This pass answers Phase 1's open question definitively.** `doGet`'s role check protects exactly one thing: keeping `viewer` (unlisted) users from ever loading the app shell at all. Past that point there is no authorization boundary — any listed user (any role) gets the identical, fully-functional SPA shell, `availableRoles` lists every role regardless of who's asking, and the role-switcher dropdown (`AppView.html`) is 100% client-side (flips a CSS class, no server round-trip). `getView(viewName)` has no role parameter at all. Confirmed via direct grep: `sol_Status`/`sol_ComaxExported` (finding #2 below) don't exist in `config/schemas.json` — real fields are `sol_OrderStatus`/`sol_ComaxExportStatus`; `doPost` doesn't exist in any `.js` file, only in stale docs (finding #6).

1. **Security (critical) — `doGet` is a login gate, not an authorization boundary.** It's a restatement/definitive confirmation of the gap found in all 5 prior passes, now with the exact mechanism: a manager-role user can click "Admin" in the role dropdown and the client renders full Admin nav + loads `AdminTasks`/`AdminBundles`/`Development` — no console tricks needed, just a normal UI click. Filed: bugs.md (supersedes the generic prior-pass entries with this specific mechanism).
2. **`WebAppDashboardV2.js` `_getOrdersData_v2` (data-integrity/correctness, high)** — reads `order.sol_Status`/`o.sol_ComaxExported`, fields that don't exist (real: `sol_OrderStatus`/`sol_ComaxExportStatus`). Every admin/manager dashboard load shows `onHold`/`processing`/`newOrders`/`ordersToExport` as 0, regardless of actual counts. A fresh mistake in the V2 rewrite — sibling `WebAppOrders.js` reads the correct field. Filed: bugs.md.
3. **Maintainability (high) — `WebAppDashboard.js` (v1) is entirely dead code, orphaning ~420 lines of `WebAppSystem.js`.** `WebAppDashboard_getAdminDashboardData` has zero callers (grep-confirmed); its only callees (`WebAppSystem_getSystemHealthDashboardData`, the "Inventory Cycle Checklist" builder) are in turn called from nowhere — the sync UI now sources state from `SyncStateService` instead. Also dead in `WebAppDashboardV2.js`: `_getSystemHealthData()` (marked `@deprecated`), `_getLastSyncStatus()`, `_getOrdersData()` (v1, superseded by `_v2`). `WebAppSystem_getSystemHealthMetrics()` also has zero callers.
4. **`WebAppTasks.js` (maintainability/data-integrity, medium)** — `updateTask`/`deleteTask`/`deleteTasks` use `SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next())` + hardcoded `'SysTasks'` instead of `SheetAccessor`/`system.sheet_names` like every other function in the file. Wouldn't follow a sheet-name config change; `getFilesByName` could match an arbitrary duplicate if Drive ever has two files with that name.
5. **Minor** — `libraryBySlug.version` (`_getManagerData`) ships `slb_Version`, a field `DATA_MODEL.md` documents as retired/inert since @319.
6. **Doc drift** — `ARCHITECTURE.md` §2.2 describes a `doPost(e)` router that doesn't exist anywhere in the codebase; the actual/only RPC path is `google.script.run` (§2.1.2, which is correct). Fixed 2026-07-23 (this session).

### Pass: Admin UI views (2026-07-23)

Files: `AdminBundlesView.html`, `AdminCampaignsView.html`, `AdminContactsView.html`, `AdminDailySyncWidget_v2.html`, `AdminDashboardView_v2.html`, `AdminInventoryView.html`, `AdminProductsView.html`, `AdminProjectsView.html`, `AdminSyncView.html`, `AdminTasksView.html`, `AppView.html`, `AccessDenied.html`.

Overall: reasonable day-to-day shape (sync widget correctly guards polling intervals across view switches; bundle editor's save/discard flow is careful and well-commented), but inconsistent — the same known-good patterns (`ModalOverlay`, `TaskWidgets.escape`) are followed correctly in some files and bypassed entirely in sibling files, meaning the team knows the right pattern but nothing enforces it before new code ships. Given the confirmed absence of server-side authorization (Phase 1), these client-side escaping/hiding gaps carry more real weight than usual — they're not defense-in-depth, they *are* the entire access boundary. Confirmed via grep: zero `ModalOverlay.*` calls in `AdminTasksView.html`; zero `TaskWidgets.escape` calls anywhere in `AdminProductsView.html`.

1. **Maintainability/convention violation (high) — 3 files bypass the mandatory `ModalOverlay` controller.** `AdminTasksView.html` (5 modals), `AdminProjectsView.html` (6 modals), `AdminBundlesView.html` (1 modal) all build `.modal-overlay` markup but toggle it with raw `style.display`, not `ModalOverlay.open()/close()` — zero calls, grep-confirmed. `AdminProductsView.html`/`AdminContactsView.html` do it correctly in the same batch (8 calls each), proving this isn't a stale convention. Effect: no focus trap, no Esc-to-close, no scroll-lock, no z-index coordination with any properly-behaved modal open at the same time.
2. **XSS-adjacent (high) — `AdminProductsView.html` never uses the shared escape helper anywhere.** Zero `TaskWidgets.escape` calls, grep-confirmed. Product names render unescaped via raw `innerHTML` in 4 search-result renderers (`searchCurrentProduct`, `searchCorrectNameProduct`, `searchCurrentWebProduct`, `searchReplacementProduct`); later code reinvents a weaker local `_escapeHtml` (missing apostrophe encoding) instead of using the shared one. A Comax/Woo product name containing `<` or `"` renders raw in SKU-correction/replacement search dropdowns.
3. **XSS-adjacent (high) — `AdminContactsView.html` `renderContactList()`** builds `data-email="..."` with the raw email while every other field in the same function is escaped. An email containing `"` breaks out of the attribute, injecting arbitrary attributes/handlers on that row.
4. **XSS-adjacent (medium-high) — inconsistent escaping within `AdminInventoryView.html` itself.** `renderPreview()` escapes every field correctly; `renderReviewTable()`, `renderOpenTasksTable()`, `renderComaxSyncCard()` insert task title/SKU/notes raw via `innerHTML`. A task title/note is admin/manager-typed free text — one containing `<img src=x onerror=...>` executes the next time anyone opens Inventory.
5. **XSS-adjacent (medium) — `AdminDashboardView_v2.html` `renderTasksCard()`** inserts `task.name`/`typeId`/`entityId` unescaped into both `innerHTML` and data-attributes, unlike the near-identical renderer in `AdminProjectsView.html` which escapes every field. Content-task titles are editable free text, so a title containing `"` breaks row attributes on the dashboard every admin sees on login.
6. **Correctness (low)** — `AdminInventoryView.html` `handleComaxConfirmClick()` calls `handleError('Error: ...')` with a bare string when `handleError(error)` expects an object and reads `.message` — shows "Error: undefined" instead of the intended message.
7. **Maintainability (low)** — `AdminTasksView.html`'s `#btn-content-import` button is created hidden, has a fully wired handler, but nothing in the file ever reveals it — button, handler, and the modal it opens are unreachable.
8. **Security — Phase 1, re-confirmed.** `AuthService.getAvailableRoles()` returns every role in `system.users` regardless of caller; `AppView.html`'s `switchRole()` → `getView()` (`WebApp.js`) performs no role check. Same root cause as the WebApp-controllers pass finding; restated because it's *why* the escaping/hiding gaps above matter as much as they do — everything in this cluster is reachable by any authenticated non-viewer.

### Pass: Manager/shared UI views (2026-07-23)

Files: `ManagerContactView.html`, `ManagerDashboardView_v2.html`, `ManagerInventoryView.html`, `ManagerProductsView.html`, `PublishingView.html`, `LibraryView.html`, `ContentStreamModal.html`, `DevelopmentView.html`, `TaskDetail.html`, `TaskPacks.html`, `TaskWidgets.html`, `OrdersView.html`.

Overall: functionally mature and mostly self-consistent — `TaskWidgets`' `ModalOverlay`/`toast`/`confirm` controller is well-built and correctly adopted in most of this batch, and the shared `TaskDetail`/`TaskPacks`/`ContentStreamModal` components successfully de-duplicate what used to be 3 hand-copied implementations. The recurring failure mode is exactly what the Admin UI pass predicted: individual views bypass the shared safety nets they otherwise import. Confirmed via grep: `TaskPacks.html`'s exported `hasTypedPack()` has zero external callers anywhere in the codebase; `ManagerContactView.html` queries `input[name="mc-direction"]` (lines 482, 526) but no such radio group exists in its own markup — only `mc-channel` and `mc-record-direction` do.

1. **`OrdersView.html` (security/XSS, high)** — `loadPackingSlipsData()` interpolates `order.customerNote` (the one genuinely customer-supplied field in this batch, from WooCommerce checkout) raw into both a table cell and an inline `onclick="...('${order.customerNote}')"` attribute. A note containing a single quote breaks the Gift Doc button silently; one containing script markup executes in the packing-slip viewer. `billingName`/`shippingName`/`shippingCity`/`status`/`orderDate` in the same tables are likewise unescaped. Filed: bugs.md.
2. **`TaskDetail.html` (data-integrity, high)** — the generic "Done" button renders for `content_edit`/`content_publish` tasks too (its `showDone` guard only excludes `task.system.*`/`task.sync.*`), even though `TaskPacks.html` exports `hasTypedPack(typeId)` specifically so a host can suppress it for typed packs — never called anywhere (confirmed). A manager clicking generic "Done" on a content task closes it without running `WebAppLibrary_lockVersion` — the entity is never versioned/locked and the translation-draft trigger never fires, leaving task status and entity state silently out of sync. Filed: bugs.md.
3. **`ManagerProductsView.html` (security/XSS, high)** — zero `TaskWidgets.escape` calls in this 1939-line file despite it defining its own safe `setVal()` (`textContent`) used correctly elsewhere. 4 row-renderers (`renderSuggestions`, `loadTaskList`, `loadVerifyList`, `loadSuggestionList`) build rows via raw template-literal `innerHTML` with product/task names and titles unescaped — same defect class the Admin-view pass found in `AdminProductsView.html`, now confirmed in the Manager sibling too. Filed: bugs.md.
4. **`ManagerInventoryView.html` (security/XSS, medium-high)** — `renderProductCountsTable`/`renderBruryaInventory` interpolate product name/SKU raw into table HTML; the file's only escaping helper (`escapeAttr`) covers one data-attribute, never the visible cell text.
5. **`LibraryView.html`/`PublishingView.html` (correctness/maintainability, medium)** — both files' entity drawer is toggled via raw `style.display`, not `ModalOverlay`, and each installs its own bare Escape-key listener that unconditionally closes the drawer whenever visible. Opening a `ModalOverlay`-based modal (e.g. "Attach new version") on top and pressing Esc once closes both the top modal and the drawer underneath simultaneously — same pattern the Admin-view pass flagged, now on the two highest-traffic content-catalog surfaces, duplicated ~600 lines near-verbatim between the two files.
6. **`ManagerContactView.html` (correctness, medium)** — `currentDirection()` queries a `mc-direction` radio group that doesn't exist in this file's markup (only `mc-channel` and the separate Record modal's `mc-record-direction` do) — always falls through to `'Outbound'`. Every contact attempt logged through "Make contact" records as Outbound regardless of actual intent; the Inbound-specific UI branches are dead code. Filed: bugs.md.
7. **`PublishingView.html` (maintainability, low-medium)** — New Campaign modal toggled via raw `style.display` with no compensating Escape handler at all — alone among the file's modals, it doesn't close on Esc.
8. **`DevelopmentView.html` (maintainability/security, low-medium)** — `devConfirm()` reimplements `TaskWidgets.confirm()` from scratch instead of using it. Also: `Development` is admin-nav-only but has no `data-roles` gating and its backend functions (rebuild SysConfig, force daily maintenance, rewrite sheet headers from schema) have no server-side check — consistent with the known no-authorization model, but unusually consequential actions to leave reachable via a one-line console call.
9. **`TaskWidgets.html` (correctness, low-medium)** — `formatDate` derives its date string via UTC components (`toISOString().slice(0,10)`) while `formatDateShort`/`formatDateFull` use local components (`getDate()`/`getMonth()`). For a timestamp not at exactly UTC midnight (plausible for Apps-Script-authored dates in Israel's UTC+2/+3), the same value can render as different calendar days depending on which formatter a given view calls.
10. **Minor** — `ManagerDashboardView_v2.html`'s fully-retired Calendar view still computes 14 days of rendering into a permanently-hidden DOM tree on every filter change; `ManagerProductsView.html` has a stray `<!DOCTYPE html><html>...` wrapper despite being injected as an HTML fragment (harmless in practice, invalid markup).

## 10. Cross-cutting synthesis (2026-07-23)

All 6 subsystem passes are done, covering effectively every `.js` service/controller and every `.html` view in the codebase (Sync/Orders, Products/Inventory, CRM/Campaigns = Phase 3, Content Library, Core Plumbing, WebApp controllers, Admin UI, Manager UI — 8 passes total across those 6 planned clusters, since Platform and UI were each split in two for size). This section looks across all of them for patterns no single pass could see.

**Honest gap:** Phase 4 (error-handling consistency) was only checked as an explicit dimension from the Content Library pass onward — the Sync/Orders and Products/Inventory passes didn't systematically check catch-coverage/swallow-vs-rethrow patterns. Not re-run given the practical cost; flagged here rather than silently claiming full Phase 4 coverage.

### The one meta-pattern behind most findings

**When a fix, schema change, or shared pattern is introduced, it doesn't get propagated to the other 2-3 places doing the same job.** This single mechanism explains the large majority of concrete (non-authz, non-dead-code) findings across every pass:

- `wxl_SKU` (retired field) still live in 3 of 4 sibling SKU functions — the 4th was fixed and the fix never propagated.
- `WebXltM`'s positional-copy upsert exists in *two independent implementations* (`ProductImportService` live path, an orphaned CSV-drop path) — both share the same fragility, developed separately.
- `sc_DoNotContact`, `spro_CampaignId`, `sol_Status`/`sol_ComaxExported`, `cpm_ProdId`/`pa_ProdId`, `currentStage`, `_invalidateWebAppTasksCache` — six separate instances of code referencing a field/function name that used to exist (or was assumed to) and silently no-ops or misreports instead of erroring loudly.
- `ModalOverlay`/`TaskWidgets.escape` followed correctly in some Admin/Manager views, bypassed entirely in sibling views doing the identical job (modals, row rendering) — the UI-layer version of the same root cause.
- Superseded services/files left in place with no deletion and (until this audit) stale docs describing them as live: `WpmlService`, `CategoryService`, `PromotionsEngineService`, `KpiService.js`, `WebAppDashboard.js` (v1) + ~420 orphaned lines of `WebAppSystem.js`.

This is worth naming because it reframes the fix priority: the individual bugs are mostly narrow, but the pattern generating them is systemic. `jlmops/CLAUDE.md`'s "copy existing patterns exactly, find a working example in the same file" rule already targets exactly this — the finding is that the rule isn't being verified before shipping sibling code, not that a new rule is needed.

### Authorization (Phase 1) — now fully resolved, no longer "confirmed again," just true

Every single pass, from Product/Inventory through Manager UI, independently reconfirmed the same fact: `doGet` blocks only unlisted "viewer" accounts; every other role gets the identical full app shell, the role-switcher is client-side only, and zero mutating function anywhere re-checks caller role server-side. This is no longer a hypothesis — it's the load-bearing fact behind why the UI-layer escaping/hiding gaps matter as much as they do (they're not defense-in-depth, they're the only depth). One fix (server-side role check on `getView` + a shared guard other mutating endpoints call) would close the gap that every other pass had to route around.

### Recommended fix sequencing (not a commitment to fix — a ranking for when you do)

**Tier 1 — real, live, user-visible today:**
- `WebAppDashboardV2` orders widget shows 0 for on-hold/processing/new/export counts on every dashboard load (wrong field names).
- `TaskDetail`'s generic "Done" button silently skips content-entity locking/versioning.
- `TaskService.updateTaskDates` reports false failure on a successful save.
- `OrdersView.html` renders genuine customer-supplied order notes unescaped (the one real external-input XSS path found).
- 3 SKU-fix functions silently no-op the Hebrew-translation-table update.
- `sc_DoNotContact` suppression has never worked — a marketing export could contact someone who opted out.

**Tier 2 — real but narrower blast radius or lower likelihood:**
- `WebXltM` positional-copy fragility (bites only on a future schema edit).
- Campaign↔Project broken FK (cosmetic — empty list, not data loss).
- `SysProductAudit` PK gap (narrow pre-seeding window).
- `ManagerContactView` always-logs-Outbound bug.
- Admin/Manager Products/Inventory unescaped product-name rendering (internal-data XSS, lower likelihood than customer-facing).

**Tier 3 — structural, worth a dedicated effort rather than a quick patch:**
- Server-side authorization (Phase 1) — dozens of endpoints need a role-check pattern added; this is a program, not a patch, per this plan's own §8 scoping note.
- UI convention drift (`ModalOverlay`/escape bypassed in specific files) — worth a consistency pass across all views at once rather than one-off fixes.

**Tier 4 — cleanup, no urgency:**
- Delete confirmed-dead files/code: `KpiService.js`, `WpmlService.js`, `CategoryService.js`, `PromotionsEngineService.js`, `WebAppDashboard.js` + orphaned `WebAppSystem.js` functions, `ProjectService`'s `spro_CampaignId` references, `LibraryService`'s dead `_cache`, assorted dead variables/functions.
- Efficiency items (redundant full-sheet scans) — real cost, but every pass's own findings note current data volumes aren't yet near the GAS quota ceiling.

### Status

All 6 planned clusters done (2026-07-23). `CODE_AUDIT_PLAN.md` Phases 1 (definitively resolved), 2 (code-quality, covered across every subsystem), 3 (CRM/campaigns, done), and 5 (dead-code/test-coverage baseline, covered per-cluster) are complete as originally scoped. Phase 4 (error-handling) is partially covered (Content Library onward only) — the one legitimate remaining gap if this audit continues. No fixes have shipped from this audit; all findings are logged above and in `.claude/bugs.md`, ranked by tier above. Sequenced into sessions K–U at `jlmops/plans/CODE_AUDIT_FIX_SEQUENCE.md` (2026-07-24), awaiting go-ahead per session.
