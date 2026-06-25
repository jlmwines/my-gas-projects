# Lookup Admin UI Plan

**Created:** 2026-05-21
**Status:** SHIPPED 2026-05-25 @121. Card 4 (Lookups) live on `AdminProductsView`; first add (Kashrut) confirmed. Edit + Grapes/Texts add untested; surface for any UI rough edges as they come up.
**Scope:** Small UI to add or edit values in three jlmops lookup tables: `SysLkp_Grapes`, `SysLkp_Kashrut`, `SysLkp_Texts`. Single phase, one session.
**Out of scope:** Delete (user handles removals manually for data-integrity reasons). Retire/soft-delete state. `SysLkp_Cities` (rare, manual). Wineries (WP). §16 regions overhaul (separate concern, manual cleanup).

---

## Why

`LookupService.js` only exposes `getLookupMap()` (read). Adding a new grape / kashrut / text code requires opening the sheet in Drive. Bug tracked in `.claude/bugs.md` 2026-05-17.

---

## Surface

One **Lookups card on `AdminProductsView`** — appended below SKU Management as Card 4 (sibling to Detail Updates, New Products, SKU Management). Three sections inside, one per lookup. Each section: scrollable table of current rows (`max-height: 200px; overflow-y: auto` pattern from Pending lists) + "Add" button at top + per-row "Edit" button (not row-click, mirroring existing "Review"/"Action" per-row buttons on this view). Add and edit share one modal-overlay form. Key field disabled on edit. Texts section additionally has a filter dropdown driven by distinct `slt_Note` values + a sort toggle.

**Patterns to copy on AdminProductsView:**
- Card shell: `<div class="card mb-4">` + `<div class="card-header bg-white font-weight-bold">Lookups</div>` + `<div class="card-body">`
- Section headers: `<h6 class="text-muted mb-2">Grapes (<span id="...-count">0</span>)</h6>`
- Tables: `<div class="table-responsive border rounded" style="max-height: 200px; overflow-y: auto;">` + `<table class="table table-sm table-hover mb-0">` + `<thead class="thead-light">`
- Add modal template: **Suggestion Approval Modal** (lines 430–457 of AdminProductsView.html) — already has SKU + Name EN + Name HE fields, near-perfect for Grapes/Kashrut. Texts needs one extra `slt_Note` input.
- Modal toggle: `document.getElementById('...').style.display = 'flex' / 'none'`
- Buttons: `btn btn-sm` for everything in-card (plain look per user direction). Avoid `btn-primary`.

**Backend wiring pattern (from `WebAppCampaigns.js`):**
- Each backend function wraps logic in try/catch
- Returns `{ error: string|null, data: Object }` envelope
- Logs failures via `logger.error('WebAppLookups', '<fn>', message, error)`

**Frontend wiring pattern (from `AdminProductsView`):**
- IIFE-attached methods on `window.AdminProductsView`
- `google.script.run.withSuccessHandler(...).withFailureHandler(...).WebAppLookups_<fn>(...)`
- Triggered loads called from a single `loadLookupSection(name)` per section; central `AdminProductsView.refreshView()` already invoked at view bottom — extend to include the three load calls

**Dead state slots already declared** in `AdminProductsView` (lines 560–562): `lookupRegions`, `lookupGrapes`, `lookupKashrut`. Unused today; we can repopulate `lookupGrapes` / `lookupKashrut` (and add `lookupTexts`) as the in-memory cache for the card.

No new view, no new nav entry. Future product-vocabulary additions (regions, brands, etc.) extend the same card.

---

## Columns

From docs (`PRODUCT_TEXT_UPDATE_PLAN.md`, `PRODUCT_VERIFICATION_PLAN.md`) + code (`ProductService.js`, `ContactEnrichmentService.js`, `WooCommerceFormatter.js`, `WebAppBundles.js`):

| Sheet | Key | EN | HE | Other |
|---|---|---|---|---|
| `SysLkp_Grapes` | `slg_Code` | `slg_TextEN` | `slg_TextHE` | — |
| `SysLkp_Kashrut` | `slk_Code` | `slk_TextEN` | `slk_TextHE` | `slk_Type` (G=Global / I=Israel / L=Local kashrut authority. Categories overlap conceptually; each row carries exactly one. Editable in modal as `<select>` populated from distinct sheet values; label map G/I/L → Global/Israel/Local; sort key on the section.) |
| `SysLkp_Texts` | `slt_Code` | `slt_TextEN` | `slt_TextHE` | `slt_Note` (type/category — free text, sort/filter only) |

**Implementation note:** The form reads sheet headers at render time and surfaces all columns found, not just the four above. Any extra columns present in the sheet stay editable. This way the UI doesn't silently drop columns added later.

---

## Validation rules

All three lookups:

- **Key uniqueness.** New key cannot match an existing key in that lookup. Server-side check before write.
- **EN + HE both required.** Cannot save with either empty. Server-side primary; client-side mirror.

`slt_Note` on Texts: **no validation.** Free-text. The section UI uses it as a sort key and filter dropdown (populated from existing distinct values), but writes accept whatever the user types.

---

## Existing registration

All three sheets are already registered:

- `system.sheet_names` lists Grapes, Kashrut, Texts (system.json)
- `mappings.json` has `map.grape_lookups`, `map.kashrut_lookups`, `map.text_lookups`, each with `sheet_name` + `key_col` (slg_Code / slk_Code / slt_Code)

`LookupService.getLookupMap()` reads headers from row 1 of the sheet and consults `mappings.json` for `sheet_name` + `key_col`. **No `schemas.json` or `mappings.json` additions required.**

---

## Build order — one session

1. **`LookupService.js` write methods.** Add `addLookupValue(mapName, row)` and `updateLookupRow(mapName, key, row)` to the IIFE. Both:
   - Read mapConfig via `ConfigService.getConfig(mapName)` for `sheet_name` + `key_col`.
   - Open `JLMops_Data` → target sheet → read row 1 headers.
   - **Validate key uniqueness** for add (key not already present); validate key exists for update.
   - **Validate EN/HE required** by detecting columns matching `*TextEN` / `*TextHE` suffix and confirming both non-empty. `slt_Note` skipped (free-text, no validation).
   - **Add:** append new row at sheet bottom (per `feedback_schema_append_only`).
   - **Update:** locate row by key, rewrite in place preserving non-submitted columns.
   - **Cache invalidation:** `_cache.delete(mapName)` after each write.
   - On error, throw — caller's controller wraps with try/catch.
   - Export both new methods in the return object (currently `{ getLookupMap, searchComaxProducts }`).

2. **`WebAppLookups.js` controller (new file).** Three functions following `WebAppCampaigns.js` shape:
   - `WebAppLookups_getMap(mapName)` → `{ error, data: rows[] }` (returns array of row objects; converts the Map from `LookupService.getLookupMap()` to an ordered array).
   - `WebAppLookups_addRow(mapName, row)` → `{ error, data: rows[] }` (calls add then re-loads the map).
   - `WebAppLookups_updateRow(mapName, key, row)` → `{ error, data: rows[] }` (calls update then re-loads).
   - Validation errors surface as `error` string in the envelope.

3. **Lookups card in `AdminProductsView.html`.** All in one file, mirroring the existing card pattern. Concrete additions:
   - **HTML body:** Card 4 appended below SKU Management (around line 248). Three `<h6>` sections (Grapes, Kashrut, Texts) each with its own scrollable table + Add button. Texts section adds `<select>` filter (slt_Note distinct values) + sort toggle button above its table.
   - **Modal:** new `<div class="modal-overlay" id="lookup-modal">` near the other modals (after the Linkage Modal block). Fields: read-only key input on edit / editable on add; EN input; HE input (with `class="hebrew-text"`); Note input (visible only for Texts section). Submit / Cancel in `modal-footer bg-light` using `btn btn-sm`.
   - **State slots:** repopulate the existing `AdminProductsView.lookupGrapes` / `lookupKashrut` arrays, add `AdminProductsView.lookupTexts`. Track `currentLookupSection` (`'grapes'|'kashrut'|'texts'`) + `currentEditKey` for modal state.
   - **Methods:** `loadLookupSection(name)`, `renderLookupTable(name)`, `openLookupModalAdd(name)`, `openLookupModalEdit(name, key)`, `submitLookupRow()`, `closeLookupModal()`, `filterTexts()`, `sortTexts()`.
   - **Wire into `refreshView()`:** add three load calls after the SKU Management section.

---

## Decisions banked

- **Card on AdminProductsView, not a new view.** Per `feedback_cards_over_view_links`. All product-vocabulary admin lives in this neighborhood.
- **Single phase: Grapes + Kashrut + Texts together.** Texts is needed now; the three share the same shape and split into phases creates no real saving.
- **Add + edit only.** No delete.
- **Validation: key unique + EN + HE required.** `slt_Note` is free-text, no validation, used as sort/filter on the Texts section.
- **No widget kit, no pack abstraction, no skeleton.** Three sections of straightforward UI.
- **Plain look, copy existing visible button styles only.** No new styling. First-round latitude on layout; user flags if it's off.
- **No activity logging.** Lookup writes do not emit SysLog entries.
- **Auth inherited from AdminProductsView.** No separate role check; if a user reaches the view, they can use the card.
- **Existing data normalized by user.** User will fill missing translations in existing rows so the EN+HE-required rule is satisfiable for every row in all three sheets. UI does not need a one-time migration step or a softer rule for legacy rows.
- **Default sort:** Grapes alphabetical by EN (mirrors `ProductService.js`); Kashrut by `slk_Type` then `slk_TextEN`; Texts ascending by `slt_Code`.
- **Filter dropdowns:** Texts filters by distinct `slt_Note` values. Kashrut has no filter (user direction 2026-05-25 — three categories are not enough to justify one).
- **Form reads sheet headers at render time.** Doesn't hardcode column lists; any extra columns in the sheet stay editable.
- **No `schemas.json` or `mappings.json` additions.** All three lookups already registered.

---

## Cross-references

- Bug entry: `.claude/bugs.md` jlmops 2026-05-17
- `plans/CONTENT_LIBRARY_PLAN.md` §16 / §17 — lookup-add UI demoted from library prerequisite to independent operational fix (per 2026-05-21 walkthrough)
- `jlmops/CLAUDE.md` — UI conventions (`modal-overlay` not Bootstrap modal; button classes via grep; `table table-sm table-hover`; copy from `AdminProductsView.html`)
