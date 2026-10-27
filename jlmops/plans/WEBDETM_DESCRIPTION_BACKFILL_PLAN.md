# WebDetM Description Backfill (non-wine)

One-time data fix so `WebDetM` holds the long descriptions (EN + HE) for every non-wine product: import the ones that exist only on the live site, and clean unwanted HTML out of the ones already stored. Status: **draft, awaiting approval.** No code changes; the work is done offline on sheet exports and lands as one sheet import.

## Why

The site description is rebuilt from `wdm_DescriptionEn/He` by `WooCommerceFormatter.formatDescriptionHTML` on every Woo API push and every description backfill export. Non-wine descriptions were mostly written directly in WordPress and never reached WebDetM, so any push blanks them (bug 2026-06-16, `plans/BUGS.md`). Several stored descriptions also carry HTML pasted in from the site.

## Scope

- **In:** `wdm_DescriptionEn`, `wdm_DescriptionHe` for non-wine rows: accessories, liqueurs, gift items, gift items 2, bundles. Category taken from WebProdM `wpm_TaxProductCat` (bundles have no Comax row).
- **Out:** wines, short descriptions, the bundles editing UI, any change to the formatter or push code.

## Inputs (all three must be fresh before step 2)

Exported from `JLMops_Data` to `exchange/` by the user, Google Sheets → CSV:

| File | Role | Export time |
|---|---|---|
| `JLMops_Data - WebDetM.csv` | base to modify | 2026-10-27 10:36 |
| `JLMops_Data - WebProdM.csv` | live EN text (`wpm_PostContent`), category | refreshed by user 2026-10-27 (timestamp confirmed at step 1) |
| `JLMops_Data - WebXltM.csv` | live HE text (`wxm_PostContent`) | 2026-10-27 10:37 |

Freshness check: WebProdM and WebXltM exported after the latest Woo product pull (`jlmops-status.md` Integrations row); WebDetM exported after that too, and **no WebDetM edits in jlmops between its export and the import** (step 6), or those edits are lost.

## Steps

Two passes, each ending in its own import. Pass 2 starts from a fresh WebDetM export taken after Pass 1's import.

**Every output file** has a unique name, keeps the input WebDetM's columns, row order and row count, and changes only `wdm_DescriptionEn/He` on in-scope rows. The build script prints a diff summary (rows changed, by category, by field) and fails if any other cell differs. Import is by the user (Google Sheets: File → Import → Replace current sheet into `WebDetM`), same day as the build, before nightly housekeeping re-sorts WebDetM.

### Pass 1: import missing descriptions

1. **Confirm inputs fresh** (table above). Session states the three timestamps and the last Woo pull before proceeding.
2. **Inventory** (scratch script, read-only): per non-wine SKU, which description fields are blank in WebDetM but present live.
3. **Inspect live text before importing.** Check whether live `PostContent` for these products contains formatter-generated material (detail lines, appendices). If it does, only the hand-written body is imported, never the generated parts, or the next push would duplicate them. Live text is copied as-is otherwise; its HTML is Pass 2's job.
4. **Build** (done 2026-10-27, 21 cells changed, every other cell verified identical) `exchange/JLMops_Data - WebDetM - desc-import 26-10-27.csv`: fills only description fields that are blank in WebDetM, only on in-scope (non-wine) rows, from live. Hard guards in the script: it never touches a wine row and never overwrites a non-blank WebDetM description; either case fails the build.
5. **Review sheet:** EN/HE side by side, every filled row. User reviews (Hebrew included) before import.
6. **Import**, then re-export WebDetM and re-run the inventory: zero recoverable blanks in scope. **Done 2026-10-27:** post-import export `JLMops_Data - WebDetM - after descr import.csv` matches the built file cell for cell (767 rows, 35 columns, no differences); this export is Pass 2's input.

**Inventory result (2026-10-27, steps 2-3 done).** 55 in-scope rows; 30 EN + 31 HE blank descriptions have live text, but most of it is formatter output with no description inside (name line + details table + promo box): every bundle/package and the six Ilana's liqueurs were already blanked on the site by earlier pushes, so there is nothing to recover for them. Real hand-written text exists for **21 fields**: nine Lavie liqueurs (EN+HE; the Lavie gift set has only a name line), Meshek Achiya Picual Olive Oil (EN+HE), Ethiopian Tehina (HE). Five more "real" hits are leftover name lines where the live name differs from `wdm_NameHe`/`wdm_NameEn` (Cheese Please HE, two Ilana's HE, Lavie gift set HE, Value Whites & Rosés EN); excluded. Import takes only the real text: generated name line, details table and promo box are stripped; remaining HTML is left for Pass 2.

### Pass 2: clean unwanted HTML

7. **Inventory** from the post-Pass-1 WebDetM export: every in-scope description containing HTML (includes text imported in Pass 1).
8. **Define the cleaning rule from real samples.** Before/after for a handful of rows per category; user approves the rule (what HTML is "unwanted", what formatting, if any, survives as plain text, e.g. paragraph breaks). **Rule (user, 2026-10-27): keep lists and media, remove spurious HTML.** Kept: `ul`/`li`/`strong` (no attributes), colour spans with only their colour (the red "Heter Mechira" on two olive oils), `img` (src, alt, width, height), `iframe` (title, src, width, height, frameborder, allowfullscreen). Removed, text kept: `p`, other `span`s, headings, `div`, and all other tags and attributes (style, class, `data-sourcepos`). `</p>`/headings become a blank line, `<br>` a single line break (WordPress renders both); `&amp;`/`&nbsp;` become plain characters. Inventory: 60 of 68 in-scope description fields carry HTML; the norm is wine descriptions, which are plain text.
9. **Build** (done 2026-10-27, 58 cells cleaned: liqueurs 24, gift items 12, accessories 22; every other cell verified identical) `exchange/JLMops_Data - WebDetM - desc-clean 26-10-27.csv` (date stamp updated if Pass 2 runs on a later day).
10. **Review sheet:** EN/HE side by side, old vs new, every changed row; Hebrew reviewed by the user (Hebrew-review rule).
11. **Import**, then re-export and re-run the inventory: zero HTML in scope; the next validation run is clean.

Known side effect of a full-sheet import (from the 10-25 `wdm_NameHe` reconcile): Sheets reformats `wdm_ABV` display (value unchanged) and trims cell whitespace.

## Open questions

- Does `formatDescriptionHTML` produce sensible output for non-wine products once their descriptions exist (wine-only detail lines)? Must be answered before any of these products is pushed again; not part of this data fix.
- Products with no description anywhere (e.g. Seasonal Wines bundle) stay blank; new copy is a separate content task.
