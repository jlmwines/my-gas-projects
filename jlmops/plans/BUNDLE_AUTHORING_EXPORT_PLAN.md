# Bundle Authoring + Export to WooCommerce

**Created:** 2026-06-04
**Status:** Plan written. Implementation pending user OK.
**Scope:** `BundleService.js` (serializer + table aggregator), `WebAppBundles.js` (export controller; `reimportAllBundles` clears the pending flag on re-derive), `AdminBundlesView.html` (Export control + table delivery + save-time volatility warning + optional Mark published), `SysBundles` (new `sb_PendingExport` column), `jlmops/plans/DATA_MODEL.md` (authoring-surface reframing). Builds on the existing jlmops bundle editor + parity validator. The daily `refreshBundleComposition` in `HousekeepingService.js` is left as-is (it re-derives and clears the flag - website truth wins).
**Out of scope:** REST push of composition (the safe export/import path supersedes it, see sibling plans); managing the non-composition woosb settings (discount / layout / custom price / limits / before-after text) - those stay edited in WC.

---

## Why

Today, changing a bundle's contents means editing **each product row by hand, twice** (once in the EN WPClever bundle, once in the HE one). Slow, and drift between the two languages is easy.

WPClever ships a manual import/export of bundle "details" (the composition). The exported file is exactly the `woosb_ids` meta that jlmops **already pulls and parses** for both languages. That means jlmops can serialize its own composition back into that format and hand the user two ready-to-paste blobs (EN, HE), turning a two-language row-by-row edit into: edit once in jlmops, paste twice.

Because product slots in jlmops are stored **by SKU + qty** (language-neutral) and text slots hold EN+HE together, the jlmops editor is already a natural "edit once, emit both languages" surface. The only missing piece is the serializer + an Export button.

## Decision (user, 2026-06-04)

1. **Author composition in jlmops, publish to WC by export.** You compose/edit in the jlmops editor (not WPClever's row-by-row builder), export the changed bundles, and paste into WPClever's import. **WC stays the system of record:** jlmops re-syncs to it on every refresh, so an un-exported edit is **volatile - publish it the same session or the next refresh overwrites it** (by design, see below). The DATA_MODEL "shadow system" line is updated: jlmops is the *authoring surface* for composition; non-composition woosb settings stay WC-managed.
2. **Edit surface = the existing jlmops bundle editor** in `AdminBundlesView.html` (slot list, Add Text / Add Product, per-slot SKU+qty, EN/HE text). Polish as needed, then add Export.

Consequences:
- jlmops is where composition is *authored* (fast, EN+HE at once); WC is what is live and what jlmops trusts after each refresh.
- **Edits are published-or-lost, on purpose.** Editing flags the bundle and warns it must be exported + pasted before the next data refresh, or it is overwritten with current WC data. Rationale (user, 2026-06-04): holding an un-published "fix" would make jlmops show data that isn't live, which is inaccurate and confusing. Favoring website truth keeps jlmops always accurate; the cost is that a lazy/abandoned edit is discarded and must be redone. Accepted.
- WPClever's row builder still works as the slow fallback (WC is the record); the jlmops authoring path is the fast replacement, not a lock-out.
- The EN/HE parity validator keeps its original role: confirm EN and HE compositions agree in WC.

---

## The workflow (end state)

1. **Update Composition** (refresh from WC) and **Review Stock** as needed, so you author against current data.
2. Edit one or more bundles in the jlmops editor. Saving flags each edited bundle **pending export** and warns: *publish before the next refresh or it is overwritten.*
3. Click **Export** (on the management card). jlmops builds a table of **only the pending-export bundles** - one row per bundle, columns **Bundle Name | English Meta | Hebrew Meta** - delivered via **Open in new tab** and **Export to file**.
4. For each row: copy the **English Meta** cell -> paste into that bundle's EN product (WPClever Import) -> save; copy the **Hebrew Meta** cell -> paste into the HE product -> save.
5. Done. The flag clears at the next refresh (which re-derives from WC: matches if you published, or overwrites the edit if you didn't). An optional **Mark published** control can clear it immediately. **Validate EN/HE Parity** should read clean.

Do the whole loop in one session (edit -> export -> paste). Two pastes per updated bundle (one per language), far faster than per-row two-language editing. (A future REST push could remove the manual paste, but only if proven safe - see sibling plans.)

## Tracking which bundles need export

The `sb_PendingExport` flag is a transient "you have un-exported edits" marker, **not a shield**.

- **Set:** saving slot edits sets `sb_PendingExport = TRUE` on the `SysBundles` row (new append-only column; optionally `sb_EditedAt`). The editor warns at save time that the edit is volatile until published.
- **Export table = bundles where `sb_PendingExport = TRUE`.** Empty -> "nothing to export."
- **Clear:** the next re-derive (`reimportAllBundles` via Update Composition, or the daily `refreshBundleComposition`) rebuilds `SysBundleSlots` from WC and clears the flag - after a re-derive jlmops equals WC, so nothing is pending. If you published first, WC carries your edit and it survives; if you didn't, WC overwrites it. An optional **Mark published** control clears the flag immediately for tidiness.
- **No clobber guard (deliberate).** An earlier draft protected pending bundles from the daily re-derive; **dropped per user** - holding an un-published edit makes jlmops show data that isn't live (inaccurate, confusing). Website truth wins; the contract is publish-in-session.

---

## The serializer (core new build)

New `BundleService.exportBundleWoosb(bundleId, lang)` returning `{ json: <string>, warnings: [] }`. Pure, unit-testable. One call per language.

A thin aggregator `BundleService.buildExportTable()` iterates the **pending-export** bundles and, for each, calls `exportBundleWoosb(id, 'en')` and `exportBundleWoosb(id, 'he')`, returning rows `{ bundleId, name, en, he, warnings }`. The table delivery (file / new tab) renders these rows.

### Field mapping (slot -> woosb_ids entry)

The output is a JSON object keyed by a freshly generated token, entries emitted in `sbs_Order` sequence:

**Product slot:**
```json
"<token>": {
  "id":  "<WC product id for this language>",
  "sku": "<sbs_ActiveSKU>",
  "qty": "<String(sbs_DefaultQty || 1)>",
  "optional": "<sbs_QtyVariable ? '1' : '0'>",
  "min": "",
  "max": ""
}
```

**Text / section slot:**
```json
"<token>": {
  "type": "<sbs_TextStyle, e.g. h6>",
  "text": "<lang === 'en' ? sbs_TextEn : sbs_TextHe>"
}
```

### SKU -> product id resolution (the language-specific part)

- **EN file:** `sbs_ActiveSKU` -> `WebProdM.wpm_WebIdEn` (lookup by `wpm_SKU`).
- **HE file:** `sbs_ActiveSKU` -> EN id (as above) -> `WebXltM` row where `wxm_WpmlOriginalId === en_id` -> `wxm_ID` (HE product id). This is the same EN->HE map the parity validator already builds; reuse it, don't reinvent.
- **Miss handling:** if a SKU has no EN id, or (for HE) no HE translation, **leave that language's cell blank** for that bundle and put a warning in the row (naming the bundle + offending SKU). Never emit a blob with a missing/zero `id` (it would corrupt the WC bundle). Other bundles and the other-language cell still export. Remedy: run Update Composition (pull products) first, or fix the WPML translation.

### Token generation

Generate keys as `[a-z][a-z0-9]{3}` (letter-first). Letter-first guarantees JS/JSON preserves insertion order (purely numeric-looking keys can be reordered by the engine, which would scramble section order). Tokens are regenerated each export; WPClever's import accepts arbitrary keys (trusted, see Trust basis).

### Notes on fidelity

- jlmops does not currently model per-item `min`/`max`; the live sample has them blank, so we emit blank. If a bundle ever needs per-item min/max, add `sbs_Min`/`sbs_Max` columns (append-only) later; out of scope now.
- `optional` is derived from `sbs_QtyVariable` (current import behavior, inverted). Keep that mapping symmetric so a pull-then-export round-trip is stable.
- Composition only. The ~19 other `woosb_*` settings (discount, layout, custom price, limits, before/after text) are NOT in this blob and are untouched by a composition import.

---

## Export UX

- **Trigger:** an **Export** button on the bundle **management card** button row (alongside Update Composition / Review Stock / Validate EN/HE Parity) - it is an all-pending-bundles operation, not per-bundle. Match existing `btn btn-sm` styling exactly (no color classes) per jlmops UI rules.
- **Output:** a **table of the pending-export bundles**, one row per bundle, columns **Bundle Name | English Meta | Hebrew Meta**. Each meta cell is that language bundle's paste-ready `woosb_ids` value. Next bundle, next row. Two delivery actions:
  - **Open in new tab** - an HTML table; click a cell to select-all/copy its value.
  - **Export to file** - download the table as **TSV** (tab-separated). TSV is the safe container: the `woosb_ids` JSON contains commas and quotes but no tabs, so cells stay intact and the file opens cleanly in Sheets/Excel. (CSV would need quote-doubling; TSV avoids it.)
  - Empty state: if nothing is pending, the button reports "nothing to export."
- **Delivery technique (GAS):** server returns the rows; client builds a `Blob` (`text/tab-separated-values` for the file, `text/html` for the tab) and a `URL.createObjectURL` URL used for both the download (`<a download>`) and the new-tab open (`target="_blank"`). If the Apps Script iframe sandbox blocks either, fall back to a read-only field of the table text (not a blocker).
- **Per-row warnings:** a bundle with an unresolved SKU shows the warning in its row and leaves the affected meta cell blank; every other bundle/cell still exports.

---

## Trust basis (settled)

The exported text **is** the `woosb_ids` metadata, and the import/export is WPClever's own first-party feature (a single field you copy / paste / edit per bundle product) that **supports this format and is reliable when used manually** (user, 2026-06-04). No plugin-side verification gate: replace-vs-merge, fresh tokens, and derived-state safety are all handled by the vendor's own feature. The only thing to get right is **our serializer producing correct content**, which the unit tests + final smoke (phase below) cover. Build it.

---

## Reconciliation (closing the loop)

After import, the existing buttons do the confirming:
- **Update Composition** re-pulls WC -> jlmops.
- **Validate EN/HE Parity** should report zero drift (single upstream source). Non-zero means an import was skipped or didn't land; re-paste.

This makes the manual two-paste safe: jlmops always verifies WC ended up matching what was authored.

---

## Risks / edge cases

- **Member product not yet pulled** (added in WC after last sync): SKU->id miss -> that cell blanks with a row warning. Remedy: Update Composition first.
- **Member lacking HE translation:** the HE cell blanks with the SKU named. Remedy: create the WPML translation.
- **Section/text slots:** fully supported via `type`/`text` (EN text in the EN cell, HE text in the HE cell).
- **Un-exported edit abandoned:** the next refresh overwrites it with current WC data; the user must redo it. This is the intended behavior (website truth wins, no held drafts), surfaced by the save-time warning. Not a bug.
- **Someone edits composition directly in WC:** fine - WC is the record, the next refresh brings it into jlmops. The jlmops authoring path is the fast option, not exclusive.
- **Two-paste friction:** acceptable now; the REST push (sibling plan) is the only way to remove it, and only if proven safe.

---

## Relationship to sibling plans

- **`BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md`** - the editor, Update Composition, Review Stock, and Validate EN/HE Parity controllers already exist in `WebAppBundles.js` (`updateComposition`/`reviewStock`/`validateParity`), so that plan appears largely implemented despite its "pending OK" header. **Action: reconcile that plan's status during implementation** (verify the buttons are live, then mark shipped). This export plan builds directly on that editor + parity validator.
- **`BUNDLE_API_PUSH_TEST_PLAN.md`** (never written) - the export/import path is the **safe alternative** to direct REST writes, since WPClever's native import recomputes derived state. **Action: park the REST push test**; revisit only if two-paste friction proves worth the risk.

---

## Implementation phases

1. **Pending-export flag** - add `sb_PendingExport` (append-only) to `SysBundles`; set on slot-edit save, with a save-time warning that the edit is volatile until published. `reimportAllBundles` **clears** the flag when it re-derives a bundle (no skip - website truth wins). Optional **Mark published** control clears it immediately.
2. **Serializer** - `BundleService.exportBundleWoosb(bundleId, lang)` (sku->id resolution, token gen, per-cell warnings) + `buildExportTable()` aggregating the pending bundles into rows. Unit tests (pull -> export reproduces equivalent composition).
3. **Controller** - `WebAppBundles_buildExportTable()` returning `[{ bundleId, name, en, he, warnings }]`.
4. **UX** - Export button on the management card + delivery (open-in-new-tab HTML table, export-to-file TSV, fallback field) in `AdminBundlesView.html`.
5. **DATA_MODEL reframing** - jlmops is the *authoring surface* for composition; WC stays the system of record (re-derived on every refresh, un-exported edits volatile); non-composition woosb settings stay WC-managed.
6. **Reconcile refinements-plan status** - confirm editor + Update Composition + Review Stock + Validate Parity are live; mark `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN` shipped (or finish gaps).
7. **Smoke** - full loop: edit bundles -> Export -> paste EN+HE per row -> Update Composition -> Validate Parity clean; pending flags cleared.

---

## Open questions (defer to implementation)

- Should Export also offer a "diff vs current WC" preview (what this export changes relative to the last pull)? Nice-to-have, not v1.

---

## Longer-term considerations (composition intelligence, not this plan)

Raised by user 2026-06-04 as non-immediate but worth recording while we are in the bundle context. Both extend the **authoring / suggestion** side (the editor + the eligible-products logic), not the export mechanics, and neither changes the export loop above.

### 1. Margin-aware bundle inclusion (Comax cost)

- **Why:** profitability is a primary driver of which products belong in a bundle. Today's slot criteria are category / price / sensory only (`sbs_Category`, `sbs_PriceMin`/`Max`, `sbs_Intensity`/`Complexity`/`Acidity`, `sbs_NameContains`) - no cost or margin signal.
- **Current state:** Comax can supply cost, but cost is **not pulled into ops today** (no cost field in the Comax import / schema / mappings - confirmed two ways 2026-06-04).
- **What it would take:** (a) add a cost column to the Comax product import (e.g. `CmxProdM` / `sp_Cost`, append-only) refreshed by sync; (b) derive per-product margin (web price - cost); (c) surface margin in the editor's candidate list (sort/filter) and in `WebAppBundles_getEligibleProducts` suggestions.
- **Caveats:** cost is sensitive - never expose customer-side. And a bundle has its own discount / custom-price settings in WC, so the meaningful figure is **whole-bundle margin** (member costs vs the bundle's selling price), not just per-member margin. Model the bundle, not only the slot.

### 2. Cross-bundle diversity / rotation

- **Why:** a wine can sit in several bundles. Diversity is desirable **within** a bundle, **across** bundles at any moment (avoid the same wine saturating many bundles), and **over time** (rotation so bundles refresh).
- **Current state:** the only cross-bundle signal is the binary `sbs_Exclusive` flag ("product should not appear in other bundles"). Stock/health and suggestion logic examine members of the **same** bundle only; there is no across-bundle concentration view and no time/rotation dimension.
- **What it would take:** (a) a cross-bundle index (which active bundles each SKU is in) to flag over-concentration; (b) diversity scoring in `getEligibleProducts` (down-rank candidates already heavily used across active bundles); (c) optionally a recently-featured history for rotation. The binary `sbs_Exclusive` becomes a soft "usage count" signal rather than just on/off.

### Where these live

Both belong to bundle **composition intelligence** (the editor + the eligible-products/suggestion path), i.e. an extension of `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md` territory, not this export plan. Recorded here for continuity; promote to their own plan or a section there when prioritized.
