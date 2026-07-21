# Configuration-as-Data Compliance Plan

**Created:** 2026-07-20 (surfaced while planning `WOO_API_PUSH_PLAN.md`'s `slt_Value` column; escalated into its own investigation once the pattern turned out to be systemic).
**Status:** Phase 1 and Phase 2 complete as of 2026-07-21 (deploys @513–@515, all `rebuildSysConfigFromSource()` runs confirmed). Mailchimp/Campaign hardcodes investigated and deliberately deferred as backlog (not bugs). This also unblocks `WOO_API_PUSH_PLAN.md`'s export/push build per Phase 2's gate. Phases 3–4 (category-translation bug fix, `divisionMap` dedup, `SysLkp_Texts` consumer repoint + retirement) not started.
**Governing rule:** `docs/ARCHITECTURE.md:10` — "Configuration as Data: Hardcoded values are eliminated. All settings, rules, and mappings are stored in a central Google Sheet (`SysConfig`)." No documented exception exists for small/stable enums. The one sanctioned hardcode is `SetupConfig.js`'s `getMasterConfiguration()`, which seeds `SysConfig` itself before it exists to read from — a bootstrap necessity, not a precedent for business logic.

## How this was found

Four forked research passes this session (full transcripts not retained, findings below are the verified output):
1. Repo-wide sweep of every literal sheet-name access, cross-referenced against `config/schemas.json` (`schema.data.*`) and `config/mappings.json` (`map.*`).
2. Git/plan-doc archaeology on `SysCategories`' origin and live-reachability.
3. Exhaustive mapping of every consumer of `SysLkp_Texts`' category-related rows.
4. Full-codebase sweep for hardcoded lookup/translation objects elsewhere in the code.

## Findings, by severity

### A. Corrected 2026-07-21 — one live map, two dead, plus a real bug found while tracing
Traced every call site (two independent greps per function name, whole codebase including `.html`) before touching anything:
- **`ActivityBackfillService.js:11`'s `CATEGORY_TRANSLATIONS`/`translateCategory` — DEAD CODE.** Exported, never called anywhere.
- **`WebAppContacts.js:423`'s `CATEGORY_TRANSLATIONS`/`_translateCategory` — DEAD CODE.** Defined, never called anywhere.
- **`ContactEnrichmentService.js:43`'s `CATEGORY_TRANSLATION`/`:55`'s `CATEGORY_TRANSLATION_HE` — the only live copy.** Used in `_getPrimaryCategory` (wine-group translation) and `_calculateFrequentCategories` (fallback when `SysCategories`-backed `_loadCategoriesLookup()` misses). Live daily via `HousekeepingService.js:938` → `enrichAllContacts()`.

**Original "active divergence between live paths" framing was wrong** — with only one path ever executing, there's no runtime inconsistency, just duplicated dead code with drifted content. Downgraded from "active bug" to "dead code + one file needs real repointing."

**Real bug found instead, while tracing `_getPrimaryCategory` (`ContactEnrichmentService.js:322-334`):** its non-wine handling is a separate hardcoded division check — `div==='3'→Liqueur`, `'5'→Accessories`, `'9'→Gifts` — **missing division 7 entirely**. `SysCategories` confirms divisions 7 and 9 both mean "Gift Items" (same WC term `903`), but this function only handles 9 — division-7 products silently fall through to `'Other'`. Live bug in the daily CRM enrichment path. Highest-priority item in this plan now.

### B. `divisionMap` tripled
Identical hardcoded `{'ליקר':'3','אביזרים':'5','פריטי מתנה':'9'}` appears in `HousekeepingService.js:1469-1516` (stock-health deficiency check), and **twice** in `WebAppProducts.js` (`:561-565`, the new-product-suggestion filter `WebAppProducts_getPotentialProducts`, and again at `:662`). None of the three read `SysCategories` or `SysLkp_Texts`.

### C. `criticalMappings` duplicated
`ProductImportService.js:772` and `ProductService.js:721` each hardcode an identical expected-value snapshot (`{wps_Stock:'wpm_Stock', wps_RegularPrice:'wpm_RegularPrice', wps_SKU:'wpm_SKU', wps_PostTitle:'wpm_PostTitle'}`) used to validate that the real config (`map.staging_to_master.web_products`) hasn't drifted. An intentional config change requires editing both hardcoded copies by hand or the validation throws — a duplication risk different in kind from A/B (it's a guard, not business data) but still a two-sources-of-truth problem.

### D. Unregistered sheets
- **`SysEnv`** — **corrected 2026-07-21, not a compliance violation.** Confirmed columns (owner-provided): `scf_SettingName, scf_Description, scf_status, scf_P01, scf_P02` — the same shape as `SysConfig` itself. It deliberately lives in a **separate spreadsheet** (`WooApiService.js:16-22`, `MailchimpService.js:15-17` — both comment this explicitly) so credentials are never wiped by `rebuildSysConfigFromSource()` rebuilding the live `SysConfig` sheet on deploy. Same category as the one sanctioned bootstrap exception — deliberate, documented, not a gap. `schema.data.*`/`map.*` don't apply here anyway; those govern sheets in the main data spreadsheet, and `SysEnv` intentionally isn't one. **Real, smaller finding:** the spreadsheet ID (`SYSENV_SPREADSHEET_ID`) is hardcoded identically in both `WooApiService.js:17` and `MailchimpService.js:17` — `MailchimpService.js:16` even comments "Same spreadsheet ID as WooApiService." Two literal copies of one ID, not a governance issue — fix is centralizing the constant (or sourcing it from `SysConfig` as `system.spreadsheet.env`, matching how `system.spreadsheet.data` already stores the main data spreadsheet ID), not registering the sheet.
- **`KpiData`** (`KpiService.js:11`) — also unregistered, but the file reads as unfinished placeholder code with no confirmed live callers. Low priority; verify dead before deciding whether to register or delete.

### E. Unregistered external-service IDs — corrected 2026-07-21 after config-overlap check
- `MailchimpService.js:155` — `AUDIENCE` object hardcodes Mailchimp list/group/interest IDs. **Confirmed no config overlap** (checked all of `config/*.json` — only sync-timestamp trackers like `system.mailchimp.subscribers_last_update` exist, no ID data). Genuinely net-new, self-commented as deliberate ("single audience, immutable in practice"). Real candidate for `SysConfig`, not urgent — backlog decision, not a bug.
- `CampaignService.js:11` — `CAMPAIGN_TYPES` (keyword→campaign-type classification). No config duplicate, but a real migration candidate: it's ongoing classification logic feeding `scm_CampaignType`, a column that already exists in `SysMarketingCampaigns`' schema. Bigger lift than the other Phase 1 items (needs its own `SysConfig` block design) — backlog, not part of this pass.
- ~~`CampaignService.js:1217` `baseOptions` hardcoded date~~ — **retracted, not a violation.** Read the full function: `baseOptions` lives inside `getH1_2025_LapsedCore()`, a one-off function *named* for a specific historical period. Its `lastOrderAfter: '2025-01-01'`/`lastOrderBefore: '2025-06-30'` dates correctly define what "H1 2025" means — they're not a reusable default that drifts, they're a purpose-built historical query. Original framing ("a literal date that will quietly go stale") was wrong; this needs no fix.

### F. The original thread — `SysLkp_Texts` vs `SysCategories`
- `SysCategories` (`sct_Code, sct_NameEn, sct_NameHe, sct_ComaxDiv, sct_ComaxGrp`, schema-registered) was purpose-built 2025-12-22 (commit `534ac3c`, per `plans/CRM_PLAN.md:31`) to give CRM contact-preference fields EN↔HE category translation — not as a general product-catalog category table. It's live daily via `HousekeepingService.js:938` → `enrichAllContacts()` → `_calculateFrequentCategories()` → `_loadCategoriesLookup()`, but scoped narrowly to CRM.
- `SysLkp_Texts` (no `schema.data.*` entry; read dynamically via `LookupService.getLookupMap('map.text_lookups')`) is the table actually driving product-description generation (`WooCommerceFormatter.js`, `ProductService.js`, `WebAppProducts.js` preview) and the Bundles-UI category dropdown (`WebAppBundles.js`). Confirmed-complete consumer list — only these plus the generic Lookups-card wrapper (`WebAppLookups.js`).
- `SysLkp_Grapes`/`SysLkp_Kashrut` share the identical no-`schema.data.*` gap as `SysLkp_Texts` (all three registered only via `map.*` in `config/mappings.json`).
- `WOO_API_PUSH_PLAN.md` already made its own build decision here (extend `SysLkp_Texts` with `slt_Value` for the WC term-ID need) — that plan's decision stands independently of whatever this plan decides for the longer-term consolidation; cross-reference, don't restate.

### G. Flagged but not yet investigated
- `SysBrands` — introduced in the same commit as `SysCategories` (2025-12-22); same kind of staleness/compliance question never asked.
- `WebAppContacts.js`'s customer-type display `labels` object, and switch-statement equivalents of the hardcoded-map pattern — sweep ran out of budget before reaching these.
- `CampaignService.js` findings (E) — not cross-checked against config for overlap.

## Decisions (resolved 2026-07-20)

1. **Category-translation fix (A) — resolved.** Owner will personally update `SysCategories`' data directly (correct spellings, division mappings) rather than picking between the existing hardcoded copies. `SysCategories` becomes the curated, authoritative source.
2. **Consolidation target — resolved: `SysCategories`.** Follows directly from #1 — since the owner is curating its data as the authoritative source, it's the surviving table. `SysLkp_Texts`' category rows, and all the hardcoded maps in Finding A/B, are retirement candidates once consumers are repointed.
3. **Description text (short vs. long form) — resolved.** Covered by the same data-cleanup pass — the owner will ensure `SysCategories` carries whatever text form (short WC name and/or long descriptive form) each consumer actually needs, rather than treating this as a separate build decision.
4. **`schema.data.*` registration for `SysLkp_Texts`/`Grapes`/`Kashrut` — resolved: yes, register all three properly**, as a standalone compliance fix independent of the consolidation timeline.

5. **Cross-plan dependency with `WOO_API_PUSH_PLAN.md` — resolved 2026-07-20.** That plan yields to this one. The WC term-ID column for the Woo push goes directly on `SysCategories`, not `SysLkp_Texts`. `WOO_API_PUSH_PLAN.md` updated to mark its `slt_Value` step superseded.
6. **New column name on `SysCategories` — resolved 2026-07-21: `sct_Value`.** Same reasoning as `slt_Value` — deliberately generic, not `sct_WcCategoryId`, so it stays reusable for other future lookups rather than single-purposed to category IDs.

## Open decisions (still need input)

7. **Priority/sequencing:** owner wants nothing built until this plan is fully ready — implies no piecemeal hotfix for Finding A ahead of the full build. Proposed sequence below, awaiting sign-off.

## Scope (build) — not started, awaiting owner go-ahead

1. **`SysCategories` data refresh — DONE, live 2026-07-21.** Owner edited the live sheet directly (`semi-dry` gap-fill, new `gift-boxed`/`sparkling`/`packages` rows, four non-taxonomic rows dropped, `sct_Value` populated for all 14 rows). `exchange/JLMops_Data - SysCategories.csv` is an export/snapshot of that live state, not a working file to import — no import step needed. Confirmed: `gift-items`/`gift-items-2` both correctly resolve to `903` (Comax-7/9→one-WC-category mapping).
2. **Append WC term-ID column to `SysCategories`**, named **`sct_Value`** — **DONE 2026-07-21, end to end.** `config/schemas.json` updated, `generate-config.js` regenerated `SetupConfig.js` (confirmed `sct_Value` present), deployed live via `deploy.ps1` (@513, pinned ID verified), `rebuildSysConfigFromSource()` run — owner confirms all sheet schemas valid post-rebuild. `SysCategories` with `sct_Value` is fully live.
3. **Register `SysLkp_Texts`/`SysLkp_Grapes`/`SysLkp_Kashrut`** as proper `schema.data.*` entries in `config/schemas.json` — **DONE 2026-07-21, deployed (@514).** All three verified against fresh live exports (`SysLkp_Kashrut` actually has `slk_Type` first, not `slk_Code` — confirmed from the export, not guessed from code references). **`rebuildSysConfigFromSource()` still needed** to land these three in the live `SysConfig` sheet, same as the `sct_Value` step.
4. **Repoint category-text consumers from `SysLkp_Texts` to `SysCategories`:** `WooCommerceFormatter.js`, `ProductService.js` (export + preview), `WebAppProducts.js` (live preview), `WebAppBundles.js` (Bundles-UI dropdown) — the 5 confirmed consumers from the consumer-mapping pass.
5. **Remove product categories from `SysLkp_Texts`** (per owner direction 2026-07-20) — retire the `Category`/`ComaxCat`-note rows once step 4's consumers are repointed and verified against step 1's data. Do not remove before repointing is confirmed working, or descriptions/bundles UI break.
6. **Fix Finding A — corrected 2026-07-21, scope narrower than planned.** Only `ContactEnrichmentService.js` needs real repointing (the live copy) — repoint `_getPrimaryCategory`/`_calculateFrequentCategories` to `SysCategories`, and fix the missing-division-7 bug in the same pass since it's the same code path. `ActivityBackfillService.js`/`WebAppContacts.js`'s copies are confirmed dead code (no call sites found) — owner decision needed: delete outright, or leave as unused dead weight?
7. **Dedupe `divisionMap` (Finding B) and `criticalMappings` (Finding C).** `criticalMappings` half **DONE 2026-07-21, deployed (@514).** Added `ConfigService.getValidatedMapping(mapName, criticalMappings)`, both `ProductImportService.js` and `ProductService.js` now call it instead of duplicating the validation loop; each still declares its own `criticalMappings` literal locally (used again downstream in both files to check per-row missing fields), so only the actual duplicated logic was removed, not the shared data shape. `divisionMap` half not started.
8. **Centralize the duplicated `SYSENV_SPREADSHEET_ID` constant** — **DONE 2026-07-21, deployed (@515).** Rather than just deduping the literal, sourced it from `SysConfig` as `system.spreadsheet.env` (`config/system.json`, same pattern as `system.spreadsheet.data`) — the ID pointer itself isn't a credential, so it's safe in `SysConfig` even though the `SysEnv` sheet's contents deliberately aren't. Both `WooApiService.js`/`MailchimpService.js` now read it via `ConfigService.getConfig('system.spreadsheet.env').id` instead of a hardcoded literal. **Deployed @515, `rebuildSysConfigFromSource()` confirmed done.** Mailchimp/Campaign hardcodes (Finding E) investigated 2026-07-21 — see corrected Finding E. `AUDIENCE` and `CAMPAIGN_TYPES` are real backlog candidates, not fixed this pass; the third item (hardcoded date) was retracted as a non-issue.

## Proposed Build Sequence (2026-07-21, awaiting sign-off)

Ordered by dependency and blast radius — nothing in a later phase starts until its phase gate is met.

**Phase 1 — Foundation — COMPLETE 2026-07-21.** All items done and deployed (@513–@515): `SysCategories` data live, `SysLkp_Texts`/`Grapes`/`Kashrut` registered, `SYSENV_SPREADSHEET_ID` centralized into `SysConfig`, `criticalMappings` deduped. Mailchimp/Campaign hardcodes investigated and deferred as backlog (Finding E).

**Phase 2 — Term-ID column — COMPLETE 2026-07-21.** Data populated live, schema registered, deployed, `rebuildSysConfigFromSource()` run and confirmed clean.
*This unblocks `WOO_API_PUSH_PLAN.md`'s build now — it doesn't need Phases 3/4 to finish.*

**Phase 3 — Fix the real bug + dedupe `divisionMap` (depends on Phase 1 item 1's corrected data):**
- Scope item 6, revised: repoint `ContactEnrichmentService.js` (only live copy) off `CATEGORY_TRANSLATION`/`CATEGORY_TRANSLATION_HE` onto `SysCategories`, fixing the missing-division-7 bug in the same change. `ActivityBackfillService.js`/`WebAppContacts.js` dead-code decision pending (delete vs. leave).
- `divisionMap` half of item 7: replace the 3 confirmed-live hardcoded copies (`HousekeepingService.js`, `WebAppProducts.js` x2 — both call sites verified live via `ManagerProductsView.html`/`AdminProductsView.html`) with a single `SysCategories`-driven lookup.
*Gate: verify translated category names match the corrected data (§ Verification) before Phase 4.*

**Phase 4 — Consumer repoint + `SysLkp_Texts` retirement (highest blast radius — live descriptions + Bundles UI; depends on Phase 1 + Phase 3 verified clean):**
- Scope item 4: repoint `WooCommerceFormatter.js`, `ProductService.js`, `WebAppProducts.js`, `WebAppBundles.js` from `SysLkp_Texts` to `SysCategories`.
- Verify: regenerate a sample of descriptions, check the Bundles-UI dropdown, confirm no regression.
- Scope item 5: only once verification is clean, remove the `Category`/`ComaxCat`-note rows from `SysLkp_Texts`.

## Key files
- `jlmops/ContactEnrichmentService.js` (`:42-55`, `:105-137`, `:486`, `:745`) — `CATEGORY_TRANSLATION`/`CATEGORY_TRANSLATION_HE`, `_loadCategoriesLookup`, `_calculateFrequentCategories`, `enrichAllContacts`
- `jlmops/ActivityBackfillService.js:11`, `jlmops/WebAppContacts.js:423` — the agreeing `CATEGORY_TRANSLATIONS` pair
- `jlmops/HousekeepingService.js:1469-1516`, `jlmops/WebAppProducts.js:561-565,662` — `divisionMap` triplication
- `jlmops/ProductImportService.js:772`, `jlmops/ProductService.js:721` — `criticalMappings` duplication
- `jlmops/MailchimpService.js:25,155`, `jlmops/WooApiService.js:28` — `SysEnv` access + hardcoded `AUDIENCE`
- `jlmops/CampaignService.js:11,1217` — `CAMPAIGN_TYPES`, `baseOptions`
- `jlmops/KpiService.js:11` — unregistered, likely-dead `KpiData` reference
- `jlmops/config/schemas.json`, `jlmops/config/mappings.json` — registration targets for any fix
- `jlmops/docs/DATA_MODEL.md` — new `SysCategories`/`SysLkp_Texts` section (added 2026-07-20) documents the current-state facts this plan will change
- `jlmops/plans/WOO_API_PUSH_PLAN.md` — independent, already-decided build for the WC term-ID need; don't restate its decision here
- `jlmops/plans/CRM_PLAN.md:31` — `SysCategories`' original design intent

## Verification (once build starts)
- Category-translation fix: confirm corrected spelling against a live WooCommerce category export before picking a winner.
- Any consolidation: diff old vs. new lookup output across a full product/category sample before retiring the losing table.
- `SysEnv`/external-ID registration: confirm no runtime behavior change — this is a compliance registration, not a data change.
