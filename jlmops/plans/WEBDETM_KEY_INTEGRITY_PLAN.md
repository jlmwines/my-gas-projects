# WebDetM Key Integrity Plan

Status: **draft, not started.** Goal: every WebDetM row has a unique `wdm_WebIdEn`, its `wdm_SKU` matches WebProdM, and validation flags it when not. Covers the two BUGS.md entries dated 2026-10-26 and 2026-10-27.

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

If the row for a web product still holds an old SKU, a write under the new SKU finds no match and appends a second row with the same web ID. The SKU-change tools (`vendorSkuUpdate`, `fixOrphanSku`, `webProductReassign`) update WebDetM's SKU in place, so this depends on a SKU change that bypassed them. How the Gros row actually arose is not established; a manual sheet edit is also possible.

## Stages

**Stage 1: SKU mismatch rule (config only).** Add a `master_master` FIELD_COMPARISON rule in `config/validation.json`: `sheet_A` WebDetM, `key_A` `wdm_WebIdEn`, `sheet_B` WebProdM, `key_B` `wpm_ID`, `compare_fields` `wdm_SKU,wpm_SKU`, task type `task.validation.master_master_discrepancy`, title "Details SKU Mismatch". B7 already proves master-to-master FIELD_COMPARISON works. Ship via `generate-config.js`, `clasp push`, `rebuildSysConfigFromSource()`.

**Stage 2: KEY_UNIQUENESS rule type (code).** Add `_executeKeyUniqueness` to `ValidationLogic.js` and a `case 'KEY_UNIQUENESS'` in `runValidationSuite`'s switch. It reads the raw rows from `sheetDataCache[rule.source_sheet]` (not the prebuilt maps, which already dropped duplicates), counts non-empty `rule.source_key` values, and emits one discrepancy per duplicated key with the row numbers and SKUs in `details`. Add three `master_master` rules, task type `task.validation.master_master_discrepancy` (decided 2026-10-27):

- WebDetM `wdm_WebIdEn`, title "Duplicate Details Row"
- WebDetM `wdm_SKU`, title "Duplicate Details SKU"
- WebProdM `wpm_ID`, title "Duplicate Web Product Row"

Deploy with `deploy.ps1`.

**Stage 3: write-path guard (code).** Before changing anything, trace both writers: whether a web ID is available at each call, and whether `_upsertMasterProductRow` overwrites `wdm_WebIdEn` with blank when `finalData` lacks it. Intended change: find the row by `wdm_WebIdEn` when a web ID is known, fall back to SKU only when it is not, and refuse to append when that web ID already has a row under a different SKU (return an error instead). Deploy with `deploy.ps1`.

Order: 1, then 2, then 3. Stages 1 and 2 detect, Stage 3 prevents. Each stage gets its own OK and verification before the next.

## Verification

After Stages 1 and 2, run the `master_master` suite on current data: expect zero new tasks (both rows were fixed). The offline check script used on 2026-10-27 can be re-run on fresh exports as a cross-check.

## On completion

Update `jlmops/docs/ARCHITECTURE.md` §2.5.5 rule types with KEY_UNIQUENESS, remove the two BUGS.md entries, and archive this plan.
