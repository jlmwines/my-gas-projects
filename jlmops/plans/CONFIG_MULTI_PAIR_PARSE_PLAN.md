# Config Multi-Pair Parse Fix

Fix for the BUGS.md entry "`ConfigService.loadConfig` drops the second (P03/P04) key-value pair for non-schema settings" (2026-07-02). The bug is wider than logged: P05-P10 are never read either. Status: **parked for in-depth planning (user, 2026-10-27).** Analysis below is verified; no option chosen, nothing changed. Next session on this picks it up from "Options".

## Root cause

`ConfigService.loadConfig` (`ConfigService.js:96-112`) builds each setting's object from SysConfig rows. It reads P01/P02 as a key-value pair for every setting, reads P03/P04 as a second pair **only** for `schema.data.*`/`schema.log.*`, and never reads P05-P10. `generate-config.js#processTemplates` writes ordinary rows to the sheet unchanged (only `map.web.order_columns.template`, `validation.rule.template` and `task.template` rows are exploded into one pair per row), so a config row with several pairs reaches the sheet intact and loses everything after its first pair at load time.

## What is affected today (survey of `config/*.json`, 2026-10-27)

15 loaded non-schema settings carry data past P02. Effect of the current bug, and of reading every pair:

| Setting(s) | Lost today | Effect of reading all pairs |
|---|---|---|
| `crm.lifecycle/prospect/vip/churn/enrichment.*` thresholds | every pair after the first | none: dropped values equal the code's `\|\| default` fallbacks (verified per key) |
| `crm.intelligence.thresholds` | 4 of 5 pairs | none: values equal `CrmIntelligenceService` defaults |
| `crm.customer_types` | 7 of 8 pairs | none: read into `customerTypes` but never used |
| `system.sheet.ga4_report`, `gsc_report` | `data_tab` | `data_tab` starts working; today `_readGa4/_readGsc` silently fall back to the workbook's first tab |
| `map.grape_lookups`, `map.kashrut_lookups` | `key_col` on row 1 (row 2 supplies it: workaround) | duplicate `key_col`, same value |
| `StockHealth` (18 rows) | P03 `Division=N` | junk keys `Division=N`; reader only takes `MinCat.*`, so ignored |
| `system.sync.step_names` | steps 2-5 | none: nothing reads it |

No `schema.*` row uses P05+. `system.users` has its own parse branch and is unaffected. Known workaround already in place: `ga4_audience_report` was split into `_id` and `_tab` settings.

Latent risk is the real reason to fix: any future setting written with two pairs silently loses its second one, and code defaults mask it.

## Options

1. **Parse all pairs for all settings in `loadConfig`** (P01/P02 … P09/P10). Smallest change, matches how the JSON is already written. Cost: settings that use P03+ for something other than a key (StockHealth) gain harmless junk keys.
2. **Explode multi-pair rows in the generator** (one pair per sheet row, like the existing templates); `loadConfig` unchanged. Runtime code untouched, but every affected setting's sheet layout changes on `rebuildSysConfigFromSource`, and StockHealth would need an exclusion.
3. **Allowlist** of settings that get extra pairs. Explicit, but every new multi-pair setting must remember to register: the same trap as today.

**Recommendation: option 1**, with the parse moved into a small pure function (`_parseConfigRows`) so it can be unit-tested without the sheet.

## Steps (option 1)

1. Extract the row-parsing loop from `loadConfig` into `_parseConfigRows(rows)`, behaviour unchanged; `loadConfig` calls it.
2. Add Tier-1 tests (`TestRunner`): multi-pair row yields all keys; schema rows unchanged; `system.users` unchanged; status filter unchanged; empty keys skipped.
3. Change `_parseConfigRows` to read every pair P01..P10.
4. Pre-deploy check (offline): run the parser over `SysConfigSnapshot.csv` before and after; diff must show only the additions in the table above, no changed or removed keys.
5. Deploy via `deploy.ps1`. Parsed config is cached 5 minutes (`parsedSysConfig`); run `ConfigService.forceReload` or wait.
6. Verify live: next housekeeping clean (unit tests, schema, validation); `jlmops-status.md` GA4/GSC blocks still populate; System Health task green.
7. Close the bug; record the parse rule in `jlmops/docs/ARCHITECTURE.md` (Configuration section) and archive this plan.

**Rollback:** revert the commit and redeploy; no data or sheet changes are involved.

## Open questions

- After the fix, keep or remove the `ga4_audience_report_id/_tab` split and the second `key_col` rows in the lookup maps? Leaving them is harmless; removing is cleanup, not required.
