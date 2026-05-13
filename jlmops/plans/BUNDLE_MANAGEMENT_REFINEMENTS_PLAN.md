# Bundle Management — UI Refinements + EN/HE Parity Validator

**Created:** 2026-05-13
**Status:** Plan written. Implementation pending user OK.
**Scope:** `AdminBundlesView.html` + `WebAppBundles.js` + `BundleService.js` + `HousekeepingService.js`. Two coordinated changes: (1) tidy the bundle management card's button surface so each control does one named thing, (2) add an EN/HE composition parity validator that uses the bundle data JLMops already imports from WC.
**Out of scope:** API push of bundle composition back to WC. WPClever warns against direct REST updates; we want to test it but as a separate, time-boxed plan (`BUNDLE_API_PUSH_TEST_PLAN.md`, to be written). Also out of scope: text-slot content quality checks (translation correctness — different problem class).

---

## Why

Three problems observed live on 2026-05-13:

1. **Vague controls on the bundle management card.** Current buttons: `Refresh`, `Add New Bundle`, `Re-import from WooCommerce`. None say honestly what they do.
   - `Refresh` only re-renders cached JLMops data — no analysis, no fetch. The label implies action it doesn't perform.
   - `Add New Bundle` writes a row to `SysBundles` with no push path to WC. The bundle is orphaned from the WC source of truth. Bundles flow WC → JLMops only.
   - `Re-import from WooCommerce` doesn't call WC at all. It scans cached `WebProdM` rows for `woosb`-type products and re-derives `SysBundles` + `SysBundleSlots` from `wpm_WoosbIds`. Useful work, misleading label.

2. **No on-demand stock review.** `HousekeepingService.checkBundleHealth` exists, runs in daily housekeeping and via the post-sync trigger (`runPostSyncBundleHealth`, shipped @82). No UI button surfaces it for an out-of-cycle check.

3. **No EN/HE composition parity check.** Bundles are edited manually per language in WC (separate WPClever entries for EN and HE). Drift is easy: an editor adds a product to one language and forgets the other; a qty changes on one side; a section restructures. There is currently no way to verify EN and HE compositions agree.

---

## Final state (proposed)

### Bundle management card button row

Remove `Refresh`. Remove `Add New Bundle` (and its modal + backend wiring).

Add three buttons, each doing one named thing:

| Button | Action | Backend |
|---|---|---|
| **Update Composition** | Bundles-only WC product pull (`?type=woosb` via WC REST), then re-derive `SysBundles` + `SysBundleSlots` from the fresh `wpm_WoosbIds` data | New `WebAppBundles_updateComposition()` calling a new `WooProductPullService.pullBundleProducts()` + existing `WebAppBundles_reimportAllBundles()` |
| **Review Stock** | Run `checkBundleHealth` on demand; refresh the alerts panel | New thin wrapper `WebAppBundles_reviewStock()` invoking `HousekeepingService.checkBundleHealth()` |
| **Validate EN/HE Parity** | Run the new parity validator across all active bundles; refresh the parity column + alerts panel | New `WebAppBundles_validateParity()` calling a new `BundleService.validateAllBundleParity()` |

### Bundle list table

Add a **Parity** column showing `✓` or `⚠ N` per bundle (N = issue count). At-a-glance per-bundle drift signal sourced from cached validator results. Click `⚠` → scroll to the alerts panel filtered to that bundle.

### Health alerts panel

Already shows stock alerts. Extend to also show parity alerts, tagged with a `type` indicator (`Stock` / `Parity`). Each alert includes bundle name, issue summary, and a click-through to the bundle detail.

### Post-sync auto-trigger

`runPostSyncBundleHealth` (in `SyncStateService.js`) currently runs only `checkBundleHealth` after `COMPLETE`. Extend it to also run `validateAllBundleParity` so the Parity column is always fresh after each daily sync without user action. Same gate behavior (only after `COMPLETE`).

---

## EN/HE parity validator — algorithm

### Inputs

For each bundle:
- EN composition: `wpm_WoosbIds` on `WebProdM` (already loaded via daily sync)
- HE composition: `wxm_WoosbIds` on `WebXltM` (already loaded via daily sync)
- WPML translation map: `WebXltM.wxm_WpmlOriginalId` → HE product `wpm_ID` (already present in data; build a Map in memory)

Both `woosb_ids` payloads are JSON, already parsed by `BundleService._parseWoosbJson` into slot objects with `type` (text/product), `id`, `qty`, `text`.

### EN-as-truth framing

EN is canonical. All drift is described as **HE drift relative to EN**. The validator never says "EN is missing X." Editor action on a drift report is always either:
- Fix HE to match EN, **or**
- (Decide the change was intentional and) update EN — then the next validator run reports zero drift.

### Section-aware comparison

Treat each bundle as an ordered sequence of **sections** delimited by text/HTML slots. A section = one text slot (the header) plus the product slots following it, until the next text slot.

- Order of sections is editorial and identical across EN/HE → match sections by ordinal position (1st EN section ↔ 1st HE section).
- Order of products within a section is per-language alphabetic → don't compare positions; match products by WPML translation pair.

Most JLM bundles are single-section (no text slots) — they collapse to one implicit section and the algorithm still works.

### Atomic check

The unit of comparison is `(product_id, qty)` as a pair. For each EN product slot in a given section:
1. Translate `en_id` → `he_id` via the WPML map.
2. Find the slot in the matched HE section whose product id equals `he_id`.
3. Compare `qty_en` to `qty_he`.

Each step has its own failure mode (see Failure modes below).

`qty = 0` counts as a real, intentional value (placeholder slot for customer customization). It is NOT treated as "absence." A product at qty=0 in EN that is qty=1 in HE is reported as a qty mismatch, not as "missing in HE."

After all EN slots in a section are processed, any HE product slot in that section not consumed by an EN match is an HE-extra.

### Failure modes (validator output)

Each is reported as one alert per bundle per occurrence, tagged with the bundle name and the section index where relevant:

| Code | Description |
|---|---|
| `HE_MISSING` | EN product X has no matching HE slot in the corresponding section (translation pair `he_id` not present where it should be). |
| `HE_EXTRA` | HE product Y appears in HE bundle; its EN translation X is not in the EN bundle. |
| `QTY_MISMATCH` | Translation pair found, but `qty_en` ≠ `qty_he`. Report both values. |
| `SECTION_COUNT_MISMATCH` | HE has different number of text-slot-delimited sections than EN. |
| `WRONG_SECTION` | Translation pair found, but HE places the product in a different ordinal section than EN. |

Explicitly NOT checked:
- "EN product with no WPML translation" — not a real case in this catalog (every product has a translation).
- Total bottle count parity — misleading due to customization placeholders (qty=0 slots). Per-pair qty match catches the real cases.
- Text-slot content correctness — translation quality, out of scope.

### Storage of results

Two writes per validator run:
- Per-bundle issue count (or zero) → cached on the `SysBundles` row in a new column `sb_ParityIssueCount` (or similar), plus a timestamp `sb_ParityLastChecked`. Powers the bundle list column.
- Per-issue detail rows → existing alert-row pattern in whichever sheet hosts the alerts panel data (likely the same place `checkBundleHealth` writes its task rows; verify when implementing).

---

## Implementation pieces (order of work)

1. **New WC pull function** — `WooProductPullService.pullBundleProducts()`. Reuse the existing paginated WC REST pattern but with `?type=woosb` filter. Returns the list of bundle products with their `wpm_WoosbIds` meta. Upserts to `WebProdM` (only `woosb`-typed rows touched) and `WebXltM` for HE.

2. **Wire `Update Composition` button** — new `WebAppBundles_updateComposition()` calls (1) then existing `WebAppBundles_reimportAllBundles()`. Single button → fresh WC bundle data + fresh derivation.

3. **Wire `Review Stock` button** — thin wrapper `WebAppBundles_reviewStock()` that calls `HousekeepingService.checkBundleHealth()` and returns the result for UI refresh.

4. **Parity validator service** — new `BundleService.validateAllBundleParity()` implementing the algorithm above. Returns per-bundle issue lists and writes the cached counts + timestamp.

5. **Wire `Validate EN/HE Parity` button** — new `WebAppBundles_validateParity()` invokes (4), refreshes the column and alerts panel.

6. **Bundle list Parity column** — add the column header + cell rendering in `AdminBundlesView.html`. Source from `sb_ParityIssueCount`. Click handler scrolls / filters alerts panel.

7. **Health alerts panel — type tagging** — extend existing panel to render parity alerts alongside stock alerts with a `type` label.

8. **Post-sync auto-trigger** — extend `runPostSyncBundleHealth` in `SyncStateService.js` to call `validateAllBundleParity` after `checkBundleHealth`. Same gate behavior.

9. **Remove dead controls** — delete `Refresh` button handler, `Add New Bundle` button + modal + `WebAppBundles_addBundle` backend (verify no other caller first).

10. **Smoke test the full flow** — daily sync runs → post-sync auto-trigger → bundle list shows parity flags → user clicks `Validate EN/HE Parity` → results match the auto-triggered run.

Each step can `clasp push` independently. Recommend bundling 1–5 into one deploy (the buttons that need backend), 6–9 into a second (UI and dead-code removal), 10 is a live verification.

---

## Open implementation questions (defer to implementation, not planning)

- **`woosb_ids` JSON key shape.** Are the keys stable identifiers (e.g., slot UUIDs from WPClever) or just array indices? Stable keys would enable text-slot identity matching across languages. Index keys → only section-count parity is feasible for text slots. Either way, plan ships with the section-aware Product-slot validator; text-slot identity is a refinement to investigate after seeing real JSON.
- **WC REST `?type=woosb` filter performance.** Should be fast (tens of products vs ~1500–2000) but confirm with one timing test before committing the `Update Composition` button to the bundles-only pull. Fallback is the heavy version (full product pull).
- **Alerts panel sheet location.** Verify where `checkBundleHealth` writes its task/alert rows; the parity output should land in the same place with `type=Parity` for the UI to show both in one feed.
- **EN/HE bundle pairing.** Confirmed that EN bundle's WC product ID is the source-of-truth bundleId in `SysBundles`. HE bundle data is reached via `WebXltM.wxm_WpmlOriginalId = en_bundle_id`. Worth a single read during implementation to verify no other pairing path exists.

---

## Not in this plan (separate work)

- **API push test for bundle updates** — `BUNDLE_API_PUSH_TEST_PLAN.md` (to be written). WPClever discourages direct REST updates of bundle composition; the test plan probes the data model in WC meta fields (`_woosb_ids` etc.), picks a low-stakes bundle, attempts a read → modify → write cycle, verifies admin/storefront/translation linkage survives. If clean, that opens the door to JLMops being source-of-truth for bundles. Out of scope here.
- **Translation content quality checks** — verifying that text-slot content in HE is a faithful translation of the EN text-slot content. Different problem (NLP / human review), separate concern.
- **Bundle editor improvements in JLMops UI** — anything that touches the per-slot edit modal is out of scope for this plan. The current modal stays as-is for now; once API push test settles whether push is viable, the editor's role can be revisited.
