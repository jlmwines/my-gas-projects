# WebDetM Key Integrity Plan

Status: **Stages 1-2 and the B2 fix live @595, config rebuilt; first housekeeping run 2026-10-27 raised no tasks (expected, data already fixed). Stages 3 (write-path guard) and 4 (WebDetM sort) built 2026-10-27, guard tested locally against the WebDetM export; deployed @596; awaiting a housekeeping run that shows WebDetM sorted.** Goal: every WebDetM row has a unique `wdm_WebIdEn`, its `wdm_SKU` matches WebProdM, and validation flags it when not. Covers the two BUGS.md entries dated 2026-10-26 and 2026-10-27.

## What was found (2026-10-27)

An offline check of the WebDetM, WebProdM and CmxProdM exports found two bad WebDetM rows, both fixed in data by the user. Gros Shoham Black Onyx (web ID 8270) had two rows: one with the current SKU and a stale one with the archived 2023 SKU. Alpha Omega Chenin (171) had a SKU that does not exist in Comax. Neither raised a task.

## Why validation missed them

- **Duplicates are invisible to every rule.** `ValidationLogic.buildMapFromData` builds one Map per sheet and key, and a later row with the same key overwrites the earlier one. Every EXISTENCE_CHECK and FIELD_COMPARISON rule works from these maps, so a duplicate key is silently collapsed before any rule runs.
- **No rule checks uniqueness.** The rule types are EXISTENCE_CHECK, FIELD_COMPARISON, INTERNAL_AUDIT (row conditions), ROW_COUNT_COMPARISON, SCHEMA_COMPARISON and DATA_COMPLETENESS. None counts keys.
- **No rule compares SKUs across WebDetM and WebProdM.** B3/B4 join the two on web ID for existence only.

## How duplicates likely get created (unverified for the Gros case)

The WebDetM schema key is `wdm_WebIdEn` (`config/schemas.json`), but both code paths that write WebDetM find the row by `wdm_SKU`:

- `ProductService._upsertMasterProductRow` (used by `acceptProductDetails`)
- `ProductService.acceptProductSuggestion` (seeds the row at new-product accept)

If the row for a web product still holds an old SKU, a write under the new SKU finds no match and appends a second row with the same web ID. The SKU-change tools (`vendorSkuUpdate`, `fixOrphanSku`, `webProductReassign`) update WebDetM's SKU in place, so this depends on a SKU change that bypassed them.

Most likely path for the Gros row (trace 2026-10-27, not confirmed from logs): the new vintage SKU was onboarded as a new-product suggestion, and the existing Woo product ID 8270 was entered at accept. `acceptProductSuggestion` looks up WebDetM and WebProdM by the new SKU, finds nothing, and appends a row to each carrying web ID 8270. The WebProdM duplicate disappears at the next sync (the import rewrites WebProdM keyed by ID); the WebDetM one stays, because nothing rewrites WebDetM. The intended tool for a vintage SKU swap is Product Replacement (`webProductReassign`), which edits the SKU in place.

Trace facts: per `docs/WORKFLOWS.md` §14.1 the Woo post ID is required at suggestion accept, so both writers normally have a web ID. `_upsertMasterProductRow` gets it from the client (`AdminProductsView.getFormData` passes the master row's `wdm_WebIdEn` through), so it does not blank the ID. It does overwrite the whole row, so columns the form never sends (`wdm_IsMevushal`, `wdm_IsSoldIndividually`) are blanked on every accept; both are effectively unused today (IsMevushal empty on all rows; IsSoldIndividually already logged as dead in BUGS.md), so this is noted, not fixed here.

## Stages

**Stage 1: SKU mismatch rule (config only).** Add a `master_master` FIELD_COMPARISON rule in `config/validation.json`: `sheet_A` WebDetM, `key_A` `wdm_WebIdEn`, `sheet_B` WebProdM, `key_B` `wpm_ID`, `compare_fields` `wdm_SKU,wpm_SKU`, task type `task.validation.master_master_discrepancy`, title "Details SKU Mismatch". B7 already proves master-to-master FIELD_COMPARISON works. Ship via `generate-config.js`, `clasp push`, `rebuildSysConfigFromSource()`.

**Stage 2: KEY_UNIQUENESS rule type (code).** Add `_executeKeyUniqueness` to `ValidationLogic.js` and a `case 'KEY_UNIQUENESS'` in `runValidationSuite`'s switch. It reads the raw rows from `sheetDataCache[rule.source_sheet]` (not the prebuilt maps, which already dropped duplicates), counts non-empty `rule.source_key` values, and emits one discrepancy per duplicated key with the row numbers and SKUs in `details`. Add three `master_master` rules (decided 2026-10-27):

- WebDetM `wdm_WebIdEn`, title "Duplicate Details Row"
- WebDetM `wdm_SKU`, title "Duplicate Details SKU"
- WebProdM `wpm_ID`, title "Duplicate Web Product Row"

They use a new task type, `task.validation.duplicate_key`, added to `config/taskDefinitions.json` as a copy of `master_master_discrepancy`. Reason: `TaskService.createTask` skips creation when an open task has the same type and entity ID, and the entity here is the web ID, the same as the Stage 1 SKU-mismatch task. A duplicate row that also mismatches on SKU (the Gros case) would otherwise raise only one task. Product views pick up any `task.validation.*` type by prefix, so no UI change is needed.

**Stage 3: write-path guard (code, traced).** Keep the SKU lookup (it is how both writers find their row today), and refuse the write when the web ID says otherwise. One shared helper in `ProductService.js` checks a sheet's rows for a given SKU and web ID and throws when either:

- no row has the SKU, but a row already has the web ID (under another SKU), or
- the row with the SKU carries a different, non-empty web ID.

The error names the other SKU and points to Product Replacement. Call sites:

- `acceptProductSuggestion`: check WebDetM (`wdm_SKU`/`wdm_WebIdEn`) and WebProdM (`wpm_SKU`/`wpm_ID`) **before step 1** (completing the suggestion task), so a refused accept writes nothing. Skip when `wpmId` is empty.
- `_upsertMasterProductRow`: check WebDetM with `finalData.wdm_WebIdEn` before the write.

Before building, confirm both client calls show a server error to the admin (failure handler + toast). Deploy with `deploy.ps1`.

**Stage 4: keep WebDetM sorted (code).** Closes the 2026-10-26 WISHLIST item. Safe: no code holds WebDetM row numbers between calls; every writer finds its row and writes in the same call, and the client and task snapshots carry row values, not row numbers. Add `sortWebDetM` to `HousekeepingService` as a phase 1 task, just before `formatDataSheets`. It uses the sheet's native `Range.sort` on `wdm_NameEn`, ascending, rows 2 to last, so cell formats (e.g. the ABV percent display) move with their rows. It throws on failure, since the phase 1 loop only notices thrown errors. Not locked: the only overlap risk is an admin accept running in the same second as housekeeping, which runs unattended; accepted as residual. WebProdM and CmxProdM need nothing: the sync import already re-sorts them on every run.

**B2 filter fix (config only, same cycle).** Rule B2 (`validation.master.comax_sku_missing_web`) filters on `cpm_IsWeb,1`, but Comax stores `כן`/`לא`, so B2 has never fired. Change the filter to `cpm_IsWeb,כן`. Offline preview on 2026-10-27 exports: zero hits. Comax-internal SKU and WebXltM duplicate checks were considered and dropped (Comax and WPML enforce those keys; the sheets are sync-written by key).

Stages 1 and 2 ship together in one cycle: edit `validation.json` and `taskDefinitions.json`, run `node jlmops/generate-config.js`, add the executor, run `deploy.ps1` (its `clasp push` carries code and generated config), then run `rebuildSysConfigFromSource()` in `SetupConfig.gs`. Stages 3 and 4 are code only (no config) and can ship together in one `deploy.ps1`.

## Verification

After Stages 1 and 2, run the `master_master` suite on current data: expect zero new tasks (both rows were fixed). The offline check script used on 2026-10-27 can be re-run on fresh exports as a cross-check.

## On completion

Update `jlmops/docs/ARCHITECTURE.md` §2.5.5 rule types with KEY_UNIQUENESS, remove the two BUGS.md entries, and archive this plan.
