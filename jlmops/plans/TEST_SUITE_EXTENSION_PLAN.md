# Test Suite Extension Plan

**Created:** 2026-08-27
**Status:** Tier 1 built, deployed, and run live 2026-08-27 via the Admin Dev view's "Run Unit Tests" button (`WebAppSystem_runUnitTests` → `TestRunner.runAllTests()`) — 32/33 passed on first run. The one failure was a real bug, not a test error: `evaluateCondition` used `val || ''` before stringifying, coercing boolean `false`/numeric `0` to `''` instead of `'false'`/`'0'` (the same footgun `_rowPassesFilter` already documents and avoids). Fixed (`??` instead of `||`) and deployed @565 — re-run confirmed 33/33 passing. Also fixed while reviewing the test run's console output: `LoggerService`'s "[Context Warning] ERROR log generated without explicit Session ID" now respects `testSuppression`, since `ComaxAdapterTest.js`/`WebAdapterTest.js` deliberately call adapters with no session context and were triggering it as expected noise on every run. Tiers 2-4 not started.

## Goal

`TestRunner.js` + 4 test files (`ComaxAdapterTest.js`, `OrderServiceTest.js`, `ProductServiceTest.js`, `WebAdapterTest.js`) exist but give zero coverage to the files most recently changed: `ValidationLogic.js`, `ValidationOrchestratorService.js`, `WebAppSync.js`, `WooInventoryPushService.js`, `WooProductPullService.js` — plus, as of today, `OrchestratorService.js`'s new D1 locking primitives and `SyncStateService.js`'s Bug 5 primitives. This plan scopes what's realistically testable with the existing harness and what isn't.

## Constraint that shapes everything below

The harness has **no mocking framework** — no fake `SpreadsheetApp`, `DriveApp`, `LockService`, or `ConfigService`. Existing tests (see `OrderServiceTest.js`) only exercise genuinely pure, side-effect-free functions, or construct minimal plain-object mocks by hand for simple cases. Building a real mocking/dependency-injection layer is a separate, much larger project — not something to bundle into "add more tests." This plan works within that constraint rather than proposing to fix it, and says explicitly where that leaves gaps.

## Tier 1 — pure functions, direct bug lock-in (do first) — BUILT 2026-08-27

`ValidationLogicTest.js`, `WooProductPullServiceTest.js`, `WooInventoryPushServiceTest.js` created and registered in `TestRunner.js`. Each targeted function had to be added to its file's public return object first (none were exported before) — noted inline in each file with a one-line comment. Not yet run live (`TestRunner.runAllTests()` needs an Apps Script execution; `node --check` only confirmed syntax). Tiers 2-4 below are unchanged, still not started.

Zero I/O. Each test directly locks in a bug already fixed this plan, so these tests catch a real regression, not a hypothetical one.

- **`WooProductPullServiceTest.js`** (new):
  - `_getAttributeValue(attributes, slug)` / `_extractNames(terms)` — locks in **I1** (brand field was routed through the wrong extractor, writing the literal label "Brand" instead of the winery name).
  - `_transformApiTranslation(heProd)` — locks in **I3** (the fixed WPML lookup path); pairs with a fixture confirming the *other*, still-broken `_extractAndStageTranslationLinks` path is a documented gap, not silently assumed fixed.
  - `_getMetaValue(metaData, key)`, `_woosbIdsString(meta)` — small pure helpers, cheap to add alongside the above.
- **`ValidationLogicTest.js`** (new):
  - `evaluateCondition(val1, operator, val2)` — locks in **I4** (boolean-vs-string `TRUE`/`'TRUE'` mismatch that silently disabled 3 CRM audit rules). Test the exact failure shape: `evaluateCondition(true, '=', 'TRUE')`.
  - `buildMapFromData(data, headers, keyHeader)`, `formatString(template, dataRow)`, `_rowPassesFilter(filterSpec, row)`, `_extractName(row)` — small pure helpers used by every rule type below; worth locking in once, used implicitly everywhere else.
- **`WooInventoryPushServiceTest.js`** (new):
  - `_buildAttributesPayload(row, idx)`, `_buildDateCreated(row, idx)` — pure row-to-payload transforms, no API/Sheet calls.

## Tier 2 — rule-execution functions (pure, one caveat)

`ValidationLogic.js`'s `_execute*` functions (`_executeExistenceCheck`, `_executeSchemaComparison`, `_executeRowCountComparison`, `_executeDataCompleteness`, `_executeInternalAudit`) take already-built `prebuiltMaps` (plain JS `Map`s) as input and do no I/O themselves — confirmed by reading `_executeExistenceCheck`'s body. A fixture is just constructing a `Map` by hand; no stubbing needed. Add these to `ValidationLogicTest.js` alongside Tier 1.

**One caveat:** `_executeFieldComparison` has a conditional escape hatch — if a rule sets a `field_translations_map_*` key that isn't inline JSON, it calls `LookupService.getLookupMap(configValue)` (real I/O). Test fixtures should avoid setting that rule field, and the plan should say plainly that this one function's translation-map path stays untested, not imply full coverage.

## Tier 3 — today's Bug 6 fix, avoidable I/O

**`ValidationOrchestratorServiceTest.js`** (new): `processValidationResults(analysisResult, sessionId)` is the function Bug 6 changed today (added the `ERROR` branch, unconditional quarantine). It calls `TaskService.createTask`/`WebAppTasks.getOpenTasksByTypeId` — but only for `FAILED` results or rules with `skip_if_open_task_type` set. A fixture `analysisResult.results` containing only `ERROR` and `PASSED` statuses, with no `skip_if_open_task_type` rule field, exercises the new branch with **zero I/O** — assert `quarantineTriggered === true` and `failureCount` is correct regardless of the rule's own `on_failure_quarantine` flag (the fix's whole point: an errored rule quarantines unconditionally). This is the highest-value single test in this plan — it directly verifies a fix shipped today with no mocking investment at all.

## Tier 4 — explicitly out of scope for now (name the gap, don't silently imply coverage)

These need either a real mocking/dependency-injection layer (a separate project) or stay integration-tested only (verified against a live system, the way Bug 5/D1 were verified this session) — not covered by unit tests under the current harness:

- **`WebAppSync.js`** — every `*Backend` function is I/O-bound (SyncStateService reads/writes, TaskService, OrchestratorService calls chained together). This is the file the original plan note already flagged as hardest to isolate.
- **`SyncStateService.js`**'s `mutateSyncState`/`mutateSyncStateBestEffort` — needs a fake `LockService`/`ConfigService` to test the guard/retry/error-type logic in isolation from a real sheet.
- **`OrchestratorService.js`**'s D1 primitives (`_claimNextPendingJob`, `setJobRowStatus`, `_getJobRowByJobId`) — needs a fake `Sheet` object (a 2D-array-backed stub of `getRange`/`getValues`/`setValue`) to test the claim/guard/retry logic without a live `SysJobQueue`. This is the most valuable Tier 4 item if a mocking investment ever gets made — the guard logic (job_id-keyed lookup, `applied`/`contended` outcomes) is exactly the kind of branch-heavy logic unit tests are best at, and it's brand new, zero-precedent code.
- **`WooProductPullService.js`**/`WooInventoryPushService.js`'s orchestration functions (`pullProducts`, `_runPush`, `pullAndImportAll`, etc.) — WooCommerce API + Drive + Sheet calls chained together.

## Build order

1. Tier 1 (4 small test files, all pure, no fixtures needed beyond literal values) — smallest effort, immediate regression protection for 2 already-shipped bug fixes.
2. Tier 3 (`ValidationOrchestratorServiceTest.js`, the Bug 6 branch) — one focused test, verifies today's work specifically.
3. Tier 2 (`_execute*` rule functions folded into `ValidationLogicTest.js`) — needs constructing fixture `Map`s per rule type, more setup per test but still no mocking framework.
4. Register all new suites in `TestRunner.js`'s `suites` array (same pattern as the existing 4).
5. Tier 4 — do not start without a separate decision to invest in a mocking/stub layer. If that investment happens, D1's primitives are the highest-value target in this tier (newest code, zero prior precedent, branch-heavy).

## What this plan does not do

It does not propose a mocking framework, a refactor of I/O-bound functions toward dependency injection, or coverage numbers/percentages. It scopes what's realistically testable today and sequences it by effort vs. value.
