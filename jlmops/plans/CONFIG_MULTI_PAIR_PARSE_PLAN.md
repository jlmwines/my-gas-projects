# Config Multi-Pair Rows Fix

Fix for the BUGS.md entry "`ConfigService.loadConfig` reads only the first key-value pair of non-schema settings" (2026-07-02). Status: **draft, independently reviewed 2026-10-27 (verdict: sound with changes, all incorporated). Approved, parked for a quiet day (user 2026-10-28): low urgency, no live impact; do it before anyone tunes CRM thresholds, and don't reorder GA4/GSC workbook tabs meanwhile.** Nothing changed yet. Recommendation: normalise the config data to one key-value pair per row and add a generator lint; **no runtime code change**.

## The SysConfig row model (what the code actually does)

Every SysConfig row is `scf_SettingName, scf_Description, scf_status, P01..`. The generator pads every row to the widest row in the source (`generate-config.js:189-198`), so the live sheet is currently 19 columns wide (P01-P16), not P01-P10. Four code paths touch rows, and all assume **one key-value pair per row (P01 = key, P02 = value)**:

- **Read:** `ConfigService.loadConfig` (`ConfigService.js:33-128`) builds `config[settingName][P01] = P02` for every loaded row (status `stable`/`locked`/`testing_phase2_part1`; `sys.schema.version` is loaded whatever its status). Only two exceptions read further: `schema.data.*`/`schema.log.*` also read P03/P04 as a second pair, and `system.users` has its own branch (P01-P04 into one user object). Nothing past P04 is ever read.
- **Write:** `ConfigService.setConfig` (`:228-267`) finds the row whose `settingName` and P01 match the key and writes P02; otherwise it appends a new single-pair row.
- **Rebuild:** `rebuildSysConfigFromSource` (generated into `SetupConfig.js`) wipes the sheet, writes the generated master config, and restores `RUNTIME_KEYS` through `getConfig`/`setConfig`. It swallows errors (`:332-339`), so success must be checked in the execution log.
- **Generator check:** `checkRuntimeKeysCompleteness` (`generate-config.js:73-78`) also reads P01/P02 only.

`generate-config.js#processTemplates` already turns the deliberately multi-value template rows (`map.web.order_columns.template`, `validation.rule.template`, `task.template`) into one row per pair. The bulk of the config follows the model: e.g. `woo.api` is six rows of one key each, `system.heartbeat` three.

**So the defect is in the data, not the reader:** 14 loaded non-schema settings plus one schema row were authored with several pairs in one row, a shape the reader and writer were never built for. All 1,727 data rows are currently `stable`, so every one of them is loaded.

## Affected rows and live effect (verified 2026-10-27, re-derived by the review)

| Setting | Pairs lost | What the consumer gets today | Live effect |
|---|---|---|---|
| `crm.lifecycle.thresholds` | recent, cooling, lapsed | `ContactService.js:23-26` `\|\| 90/180/365` | none: defaults equal config |
| `crm.prospect.thresholds` | stale_min | `ContactService.js:30` `\|\| 180` | none |
| `crm.vip.thresholds` | min_spend | `ContactService.js:34` `\|\| 3000` | none |
| `crm.churn.thresholds` | 4 of 5 | `ContactService.js:38-41` defaults | none |
| `crm.enrichment.price` / `.attributes` | max_percentile | `ContactEnrichmentService.js:24, 26` defaults | none |
| `crm.intelligence.thresholds` | 4 of 5 | `CrmIntelligenceService.js:24-27` defaults | none |
| `crm.customer_types` | 7 of 8 (P01-P16, the widest row) | read into `customerTypes` (`ContactService.js:46`), never used | none |
| `system.sheet.ga4_report` | `data_tab` ("JLM GA4 Weekly") | `StatusReportService._readGa4:301` falls back to the workbook's **first tab** | correct only by luck |
| `system.sheet.gsc_report` | `data_tab` ("Sheet1") | `_readGsc:403` same fallback | same |
| `map.grape_lookups` / `map.kashrut_lookups` | `key_col` on row 1 | row 2 supplies `key_col` (workaround) | none |
| `system.sync.step_names` | steps 2-5 | nothing reads it | none |
| `StockHealth` (3 of 9 rows, in both copies) | P03 `Division=N` (ליקר, אביזרים, פריטי מתנה) | reader filters on `MinCat.*` (`HousekeepingService.js:1645-1646`); divisions come from `SysCategories` | none: dead data |
| `schema.library.SysLibrary` | `key_column`/`slb_Slug` in P03/P04 (`config/schemas.json:617`) | P03/P04 are only read for `schema.data.*`/`schema.log.*` | none: nothing reads `.key_column` for library schemas (`SetupSheets.js:44`, `ValidationLogic.js:582` read `.headers` only) |

## Why it was never noticed

1. **Masking defaults:** every CRM consumer hardcodes a fallback equal to the configured value (`parseInt(cfg?.x) || default`), so a dropped value is indistinguishable from a loaded one. The config "knobs" have never worked: changing any of them would silently do nothing.
2. **Silent fallback:** the GA4/GSC readers fall back to the first tab when `data_tab` is missing, and the first tab happens to be the right one.
3. **Workarounds instead of root fixes:** the lookup maps carry a duplicate `key_col` row; the 2026-07-02 GA4 audience setting was split into `_id`/`_tab` settings when the bug was found.
4. **Nothing flags unread cells:** neither `loadConfig` nor the generator warns when a loaded row has data it won't read, and there is no parse test.

**Blast radius today: no wrong live behaviour.** The risk is latent: (a) a GA4/GSC workbook tab reorder silently feeds the KPI block the wrong data (the GA4 workbook has at least two tabs, since the audience report shares it); (b) any threshold tuned in config silently does nothing; (c) the next setting written in this shape silently loses data.

## Options considered

1. **Change `loadConfig` to read every column as pairs for every setting.** Rejected: it creates a read/write asymmetry. `setConfig` still only matches P01, so a key living in P03 could be read but never updated in place: `setConfig` would append a duplicate row instead, leaving two sources for one key. `RUNTIME_KEYS` restore and `checkRuntimeKeysCompleteness` would also stay on the old model. It turns the dead `Division=N` cells into junk keys. (Today the asymmetry is theoretical: every runtime-written key is single-pair.)
2. **Normalise the data: one pair per row** (this plan). All four code paths stay untouched and consistent with each other; every lost value becomes visible; a generator lint stops recurrence.
3. **Explode multi-pair rows in the generator** (like templates). Same runtime result as option 2, but keeps the misleading shape in the JSON source and adds generator logic.

## Steps (option 2)

1. **Lint first, as the detector.** Add to `generate-config.js`, after template processing (raw template rows are legitimately wide and must not be checked before processing): for every loaded row (loaded status, or `sys.schema.version`), fail the build if any cell from position P03 to the end of the row is non-empty, except: `schema.data.*`/`schema.log.*`/`system.users` may use P03/P04 but nothing past P04. Error names the setting and source file. Run it on today's JSON: it must list exactly the rows in the table above, and nothing else.
2. **Baseline.** User exports the live SysConfig sheet to `exchange/`. An offline parser replicating `loadConfig` (status filter, `_section.` skipping, `system.users` handling, schema P03/P04, last-row-wins) parses (a) the live export and (b) today's generated master config. Expected differences are runtime values only: `RUNTIME_KEYS` values and runtime-appended rows such as `system.kpi.gsc_last_snapshot` and `system.bundles.needs_update_status`. Anything else means hand edits in the live sheet and stops the plan for review.
3. **Normalise the JSON.** Split each row in the table into one row per pair, same setting name/description/status. SysLibrary: move `key_column` to its own row. Lookup maps: drop the redundant `key_col` from row 1. StockHealth: clear the 3 dead `Division=N` cells and delete the duplicate block in `system.json` (keep `otherSettings.json`, which loads last and currently wins; values are identical). While there, remove the two duplicate `system.sheet_names` keys in `system.json` (OrderLogArchive, SysPackingCache; identical values). Re-run the lint: it must pass.
4. **Offline parity check.** Re-run the step-2 parser on the new generated config. The diff against (b) must show **only added keys** (the lost pairs, plus `key_column` on SysLibrary) and no changed or removed values, except the intentional removals (`Division=N`, duplicate `key_col`). The generated sheet narrows from 19 to 13 columns; that is expected.
5. **GA4/GSC tab names, before applying.** Once `data_tab` takes effect the readers open the named tab, and `getSheetByName` is case- and whitespace-sensitive. A post-apply KPI check can't tell a correct name from a mismatch (the first-tab fallback hides both), so confirm the exact names first: GA4 via `runListGa4Tabs` (`StatusReportService.js:834`), GSC by the user opening the workbook (no lister exists). Fix the config value if they differ.
6. **Apply.** `node jlmops/generate-config.js` → `clasp push` → run `rebuildSysConfigFromSource()` → check the execution log for errors (the function swallows them) → `ConfigService.forceReload()`. No `deploy.ps1` needed: no app code changes.
7. **Verify live.** Spot-check the SysConfig sheet (split rows present, 13 columns, runtime keys restored). Fresh `jlmops-status.md`: GA4/GSC KPI numbers unchanged. Next housekeeping clean (unit tests, schema, validation; StockHealth deficiency results unchanged). Next CRM refresh produces no lifecycle/churn reclassification (values equal the old defaults).
8. **Docs + close.** Record the row model (one pair per row; schema and `system.users` P01-P04; lint enforces it) in `jlmops/docs/DATA_MODEL.md` (SysConfig section); close the bug; archive this plan.

**Rollback:** revert the JSON and generator commit, regenerate, `clasp push`, `rebuildSysConfigFromSource()`. No sheet data outside SysConfig is touched.

## Out of scope / optional follow-ups

- Collapsing the `ga4_audience_report_id/_tab` workaround back into one setting (works as is).
- Removing the now-redundant `|| default` fallbacks in CRM consumers (they become harmless duplicates of config).
- `runCheckGa4AudienceConfig` (`StatusReportService.js:848`) reads `system.sheet.ga4_audience_report`, which no longer exists: dead diagnostic, delete in a later code pass.
