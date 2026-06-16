# Product Name Correction — Plan

A small admin facility to correct a product's **title** in one or both languages, living alongside the existing SKU/identity tools in the Admin Products **SKU Management** card. Today the only way to fix a wrong product name is to hand-edit the master sheets. This is a draft plan; scope is deliberately narrow (title only) and approved with the user.

## Goal & scope

Correct `NameEn` and/or `NameHe` for one product through a guided modal instead of raw sheet editing. **Title only.** The related web-facing fields a rename *can* touch — focus keyword, SEO snippet/meta, description, slug/URL — stay out of scope: the operator edits those by hand on the web when needed, and not every rename warrants them (e.g. appending a word to a name rarely changes the slug or keyword).

The Comax name (`cpm_NameHe`) is **not** touched — Comax is not maintained for these corrections; the web record is.

## Where a title lives (write targets)

The **EN SKU is the universal key** across the web sheets. Verified against the live data export (2026-06-16): WebProdM holds 746 EN-only rows, WebXltM holds 746 HE-only rows, WebDetM holds both names per row. A title has **two write homes**, both keyed by the EN SKU:

- **WebProdM** `wpm_PostTitle` — the English product (746 rows, all `wpm_WpmlLanguageCode = en`). One row per SKU; holds the EN title.
- **WebDetM** `wdm_NameEn` and `wdm_NameHe` — a single row keyed by `wdm_SKU`, both languages in one row.

**WebXltM is NOT a write target.** It carries the EN↔HE linkage (`wxm_ID`, `wxm_WpmlOriginalId`/`wxm_WpmlOriginalSku`) and a `wxm_PostTitle` column, but that title is human-reference only — confirmed: no code reads `wxm_PostTitle`; the system uses WebXltM solely for ID/SKU linkage. The canonical Hebrew title the system exports comes from WebDetM `wdm_NameHe`, so writing WebDetM covers Hebrew.

## Why a dedicated tool (not the normal push)

Product **title is intentionally skipped during the product-data push**, so a corrected name never propagates to WooCommerce automatically. The loop only closes when the operator updates the live product manually. The tool therefore writes the sheet record, then shows the operator exactly what to change on the web, and the operator confirms in the same sitting (no persistent task — write-and-confirm in session).

This mirrors the shape of the existing vintage-mismatch lifecycle (edit → confirm web update) but without a task: a rename is a one-off, low-volume correction.

## UX — SKU Management card

A fourth button beside Vendor SKU Update / Product Replacement / Fix Orphan SKU:

1. **Correct Product Name** button → opens a modal (`ModalOverlay`, copied from an existing AdminProductsView modal; buttons copied from existing `btn` classes in the file).
2. Modal: search a web product (reuse `WebAppProducts_searchWebProducts` → SKU + current `nameEn`/`nameHe`), select it, see the current EN and HE titles pre-filled.
3. Operator edits one or both fields, Save.
4. On success the modal shows an **"apply on the web"** summary — the EN product's new title and the HE product's new title — and a **Confirm** acknowledgement that the operator has updated WooCommerce.
5. The change is appended to the card's audit trail.

## Server

New `ProductService.correctProductName(sku, newNameEn, newNameHe)`, wrapped by `WebAppProducts_correctProductName`, mirroring the write+log pattern of `vendorSkuUpdate`:

- If EN changed: set `wpm_PostTitle` on the WebProdM row for the SKU, and `wdm_NameEn` on the WebDetM row.
- If HE changed: set `wdm_NameHe` on the WebDetM row. (WebXltM is reference-only — not written.)
- Leave Comax untouched.
- Append an audit entry (old → new, both languages, by-user, date).
- Return `{ success, message }`; surface the before/after titles so the client can render the "apply on web" summary.

## To verify at build time

- **Audit-log home.** The existing "Recent SKU Updates" trail is SKU-shaped (Old SKU / New SKU). Decide whether to reuse it with a "Name Update" type (old=new=SKU, names in a detail column) or add a small name-change log.
- **WebProdM ↔ WebDetM row count.** The live export shows WebProdM/WebXltM at 746 rows and WebDetM at 747 — one extra WebDetM row. Harmless for a SKU-keyed write, but worth a glance for a stray/orphan row.

## Related (out of scope, logged separately)

The product-search path used elsewhere in SKU Management (`searchWebProducts` / `lookupProductBySku`) reads dead `wpm_WebIdEn`/`wpm_WebIdHe` columns off WebProdM and returns blank web IDs (the real ids are `wpm_ID` / WebXltM `wxm_ID`). This tool sidesteps it entirely by keying on `wpm_SKU`. The dead-column bug is tracked in `.claude/bugs.md` (2026-06-16, Product Replacement) for separate examination — not part of this tool's work.

## Out of scope

Focus keyword, SEO snippet/meta description, long/short description, slug/URL — all `wpm_*` columns that exist and can be hand-edited on the web. Revisit only if rename corrections routinely need them.
