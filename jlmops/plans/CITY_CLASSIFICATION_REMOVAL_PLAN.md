# City Classification Removal Plan

**What this is.** A plan to fully remove the SysLkp_Cities city-classification feature from jlmops. **Status: in progress** — task creation disabled, live @478 (2026-07-14); service file, config entries, and manual sheet cleanup still pending. Scope is a clean deletion, not a deprecation.

## Why

The feature auto-adds Israeli cities (2+ orders) to a `SysLkp_Cities` lookup and spawns a recurring "Categorize N new cities" task asking a human to fill `Type`, `Region`, and `WineAccess`. Two problems make it dead weight:

- **No consumer.** A repo-wide grep found nothing that *reads* `slc_Type`, `slc_Region`, `slc_WineAccess`, or `slc_LanguageTend`. The only references are the code that writes them and the schema definition. The task therefore has no completion payoff.
- **Its headline justification is obsolete.** City-level language tendency was meant to infer a contact's language. But `sc_Language` is already set for every contact from order language or Mailchimp signup, so the inference is redundant. Gift detection (the other rationale) uses `ContactService._isGiftOrder` on a single order's billing-vs-shipping fields and does not depend on this table.

Net: a nightly job and a nagging task maintaining a table nothing uses.

## Footprint

`ContactAnalysisService.js` exists **only** for this path. Its internal `isGiftOrder` is a redundant duplicate of the authoritative `ContactService._isGiftOrder` (which is what `ContactImportService` actually calls), so deleting the whole file removes no live logic.

| Target | Location | Action | Status |
|---|---|---|---|
| Service file | `ContactAnalysisService.js` (entire file, incl. globals `extractOrderCities`, `generateCitySeedData`, `writeCitiesToSheet`, `maintainCityLookup`) | Delete | Pending |
| Housekeeping registration | `HousekeepingService.js` (task-array entry) | Remove line | **Done** 2026-07-14 |
| Housekeeping wrapper | `HousekeepingService.js` `this.maintainCityLookup` | Remove method | **Done** 2026-07-14 |
| Schema def | `config/schemas.json` `schema.data.SysLkp_Cities` block (~527–535) | Remove block | Pending |
| Sheet-name config | `config/system.json` `SysLkp_Cities` entry (~486) | Remove entry | Pending |
| Mapping def | `config/mappings.json` `map.city_lookups` (two rows, ~122–136: `sheet_name`→`SysLkp_Cities`, `key_col`→`slc_Code`) | Remove both rows | Pending — **found during review, not in original footprint** |
| Setup mirror | `SetupConfig.js` (generated file — do not hand-edit; regenerate via `node jlmops/generate-config.js` after the three `config/*.json` edits above, matching `SysLkp_Cities`/`slc_`/`map.city_lookups` entries currently at ~816–817, ~4173–4179, ~4467–4492) | Regenerate | Pending — **corrected from original "remove entries" framing, which violated the project's generated-file rule** |
| Doc reference | `plans/CRM_PLAN.md:17` (sheet-inventory row) | Remove row | Pending |
| Data sheet | `SysLkp_Cities` tab in the data spreadsheet | Delete tab manually | Pending |
| Live task(s) | Open "Categorize N new cities" `task.data.review` task(s) | Close/dismiss manually | **Done** — user closed 2026-07-14 |

Keep `task.data.review` — it is a generic task type used elsewhere. `DATA_MODEL.md` has no SysLkp_Cities entry, so no edit there.

## Sequence

1. ~~Remove the two `HousekeepingService.js` references (registration line + wrapper method).~~ **Done, live @478 (2026-07-14)** — stops new "Categorize N new cities" tasks from being created.
2. ~~Close any open "Categorize … new cities" task.~~ **Done** — user closed manually 2026-07-14.
3. Delete `ContactAnalysisService.js`.
4. Strip the config entries: `config/mappings.json` (`map.city_lookups`), `config/schemas.json`, `config/system.json`.
5. Run `node jlmops/generate-config.js` to regenerate `SetupConfig.js` from the edited JSON — do not hand-edit `SetupConfig.js`.
6. Remove the `CRM_PLAN.md` sheet-inventory row.
7. Grep the whole repo (`.js` **and** `.html`) for `ContactAnalysisService`, `SysLkp_Cities`, `slc_`, `maintainCityLookup`, `extractOrderCities`, `generateCitySeedData` — expect zero hits (except this plan doc and historical mentions in `TECH_DEBT_AUDIT.md`/`CODE_AUDIT_PLAN.md`, which are fine to leave as-is).
8. `clasp push` (project-local auth, `accounts@jlmwines.com`), then user runs `rebuildSysConfigFromSource()`.
9. Manual in Sheets/UI: delete the `SysLkp_Cities` tab.

## Verification

- Repo grep from step 7 returns nothing.
- Confirm no time-based Apps Script trigger points at the removed global functions.
- Smoke-run nightly housekeeping (or its city step's absence): completes with no "maintainCityLookup" error and no missing-sheet warning.
- Confirm `ContactImportService` gift detection still works (it uses `ContactService._isGiftOrder`, untouched) — spot-check one gift order classifies correctly.

## On completion

This plan is disposable. Once shipped and verified: note the removal in `.claude/session-log.md`, delete this plan (nothing durable graduates — the change is a subtraction, and `DATA_MODEL.md`/`CRM_PLAN.md` already reflect reality after the edits). Commit message records the operational outcome.
