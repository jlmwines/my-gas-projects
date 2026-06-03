# Test Harness — schema-mirrored test workbook for real service tests

**Created:** 2026-06-03
**Status:** Draft — planning only, no implementation yet.
**Owner:** Session-driven; user reviews / verifies via the Dev-screen "Run Unit Tests" button.
**Origin:** User idea — "create a test-suite collection of sheets as a separate file, and extend the rebuild/config-and-sheets machinery to keep the pair in sync (one mirrors the other), so test sheets never drift from production schema." This doc scopes that.

## 1. Why this exists (and why it's separate from the adapter tests)

Apps Script has no test framework; everything is hand-rolled via `TestRunner.js`. Two of the four suites (`ComaxAdapterTest`, `WebAdapterTest`) are **decorative** — they re-implement the import logic inside the test and never call the real adapter, so they pass even if the shipping code is broken (false confidence; daily housekeeping reports green regardless).

**Important scoping fact (verified 2026-06-03):** the adapters are **pure transforms** — `ComaxAdapter.processProductCsv(blob)` and `WebAdapter.processProductCsv(csvString, mapName)` take a CSV in and return objects; they touch **no production sheet** (Comax only spins a self-trashing temp Drive file). So making the **adapter** tests real needs only **in-memory CSV fixtures** — NO test workbook. That work is tracked separately (reliability audit 2.3 / the "real adapter fixtures" task) and should ship without this harness.

**This plan is for the layer above the adapters:** the services that genuinely **read/write sheets** — `OrderService`, `ProductService`, `InventoryManagementService`, `ContactImportService`, `TaskService`, etc. To test those for real you need somewhere safe to read/write that is NOT production data. That is what a schema-mirrored test workbook provides.

## 2. The idea

A dedicated **test workbook** whose sheets are kept structurally identical to production by the **same schema definitions** that build the real sheets — so when a column is added/renamed in `schema.data.*`, the test sheets get it automatically and never drift.

Benefits:
- **Real service tests** — feed known fixture rows into test sheets, run the real service, assert the real result; it goes red when the service breaks.
- **Zero production risk** — tests read/write the test workbook only; the "a test might corrupt live data" fear (the reason 2.3 was treated as risky) disappears.
- **No schema drift** — reuse the existing schema→sheet header sync (`SetupSheets.js`, the `syncHeaders` precedent) so test-sheet structure tracks prod with no duplicated definitions.

## 3. Design sketch

1. **Test workbook.** A new spreadsheet (e.g. `JLMops_Test`) registered under a new SysConfig key `system.spreadsheet.test`. (Alternative: `Test*`-prefixed tabs inside an existing workbook — cheaper but muddier; see Open Qs.)
2. **Schema mirror.** Extend the existing header-sync so it can build/refresh the test workbook's sheets from the same `schema.data.*` / `schema.log.*` / `schema.library.*` headers it uses for prod. Structure stays in lockstep; one source of truth.
3. **SheetAccessor test-mode.** Services resolve sheets through `SheetAccessor`. Add a test-mode so a suite-under-test transparently gets the **test** workbook's sheet instead of prod. Mechanism options (Open Qs): an explicit param, a scoped global flag set by the test runner, or a parallel `SheetAccessor.test.*` namespace. This is the **invasive part** — it touches the core data layer — so it needs care and is the main cost.
4. **Fixture seeding.** A helper seeds known rows into the relevant test sheets before a suite and clears them after (or the suite is self-cleaning). Fixtures live in `TestData.js` as before, now written into real test sheets.
5. **Run cadence.** Heavy service suites probably run **on-demand** (Dev "Run Unit Tests" button), NOT in daily housekeeping — to avoid adding sheet/Drive churn to every housekeeping run. Decide per-suite.

## 4. Honest tradeoffs (read before committing)

- **Syncs structure, not fixture data.** Auto-mirroring keeps *columns* aligned, but the fixture *rows* still need hand-maintenance when a column's *meaning* changes. Reduces drift, doesn't eliminate fixture upkeep.
- **Standing infrastructure for a one-developer project.** A 4th workbook + new config + a `SheetAccessor` test-mode + rebuild touching it. Justified **only if real service-level testing becomes an ongoing discipline**, not a one-off. If the goal is just "make the import path honest," the adapter fixtures (no workbook) already do that far cheaper.
- **`SheetAccessor` test-mode is the risk.** Every service reads sheets through it; making it test-aware is a change to the data layer that all of prod depends on. Must be designed so test-mode can NEVER leak into a production code path (a stray flag pointing prod writes at the test sheet, or vice-versa, would be bad). Strong default-to-prod + explicit opt-in only inside the runner.
- **Cost per run.** Service tests against the test workbook add sheet reads/writes (and any Drive ops) per run — another reason to run them on-demand, not daily.

## 5. Phasing

- **Phase 1 (separate, do now):** make `ComaxAdapterTest` + `WebAdapterTest` real with in-memory CSV fixtures. No workbook. Validates via the Dev button. *(This is the cheap win; not part of this harness.)*
- **Phase 2:** create the test workbook + extend the header-sync to mirror its structure. No service tests yet — just prove the mirror stays in sync across a schema change.
- **Phase 3:** add `SheetAccessor` test-mode + ONE service suite as proof (e.g. `ProductService` happy + edge), run on-demand. Validate it goes red when the service is broken.
- **Phase 4:** expand to the other sheet-touching services as worth it.

Stop after any phase — each is independently useful. Don't build Phase 2+ unless Phase 3's payoff (real service coverage) is something you'll actually maintain.

## 6. Open questions

1. **Separate `JLMops_Test` workbook vs `Test*`-prefixed tabs** in an existing workbook? Separate is cleaner/safer (no chance of a test tab being mistaken for prod); tabs are cheaper. Lean separate.
2. **`SheetAccessor` test-mode mechanism** — explicit param threaded through, a runner-scoped global flag, or a parallel accessor namespace? Decide for safety-against-leakage first, ergonomics second.
3. **Run cadence** — which suites (if any) run in daily housekeeping vs on-demand only? Default: adapters daily (cheap), service suites on-demand.
4. **Is the ambition real?** Honest gut-check before Phase 2: is service-level testing going to be maintained, or is "honest adapter tests" enough? If the latter, this plan stays a record and isn't built.

## 7. Recommendation

Do **Phase 1 now** (real adapter fixtures, no workbook — it's the actual pain and it's cheap). Treat Phases 2–4 as a **deliberate, opt-in investment**: worth it if you're committing to real service-level tests as ongoing discipline; otherwise leave this doc as the considered design and don't build it. The mirror-workbook is the *right* architecture for that ambition — the question is only whether the ambition is real for a one-dev project.
