# Inventory Count Task Creation — Redesign

**Created:** 2026-04-14
**Status:** Implemented in a single pass (2026-04-14). Staged locally; awaiting `clasp push` to test deployment and user verification. No production push until test pass.

## Problem Statement

The current inventory count task creation flow is slow, under-tested, and doesn't support the three real use cases cleanly:

1. **Periodic full inventory sweep** — count everything, do not skip for recent counts. Walked in batches across sessions (e.g. "first 30 alphabetically starting at X").
2. **Threshold maintenance counts** — only products not counted for N days AND with stock > 0.
3. **Rule-triggered counts** — negative inventory, validation failures. Already automated; no UI work needed, they share the same manager queue.

Additional needs:
- Count activity should double as a data-validation pass (verify vintage, catch detail drift).
- The counter needs to see what they're counting (product page link, attributes) to validate against the physical bottle.
- Preview must be near-instant so the admin can tune criteria without multi-second server round-trips.
- Partial batches (fill 30 rows, leave 200 blank) must import cleanly.

## Architectural Decisions

These were settled in the planning conversation and are not up for re-litigation during implementation:

| Decision | Choice | Rationale |
|---|---|---|
| Data freshness model | One server load on view open; filter/sort/preview client-side | Inventory reconciles daily; snapshot at page-open is as fresh as anything else in the system |
| Brand filtering | Name contains / starts-with (default: starts-with) | `cpm_Brand` is unreliable; name prefixes usually lead with brand in Hebrew |
| Sort order | Product name alphabetical, default and only | Matches sheet default; enables "start at X, take N" pagination across sessions |
| New task types | None | Reuse `task.validation.vintage_mismatch` for all detail-drift cases, with descriptive notes |
| Spot-check card | Removed; folded into unified form | Filter to one product by name, create single task. Same mental model. |
| In-sheet image | Not included | Too small to judge bottle quality; product page link is the answer |
| Import model | Strict atomic pre-scan | Sheet is protected and two-user environment; any anomaly is user error needing admin attention |
| Count task dedup | Enforced (skip if open task exists for SKU) | Keeps the count queue clean |
| Vintage task dedup | Not enforced (duplicates allowed) | Rare and needed when carrying new observations |
| Hard cap on batch size | None | Full list is occasionally valuable (e.g. reverse-match shelf stock to list for orphan detection) |
| Defaults storage | HTML constants, not `system.json` | Rarely tuned; no need to bloat config |
| Schema config edits | None needed | All fields (`cpm_Vintage`, `wpm_Images`, `wpm_ProductPageUrl`) already in schemas |

## Three Use Cases, Mapped to the UI

**Full sweep**
- Leave "skip products counted within N days" blank
- Optionally name-filter (brand-like queries)
- Set "start at" to walk the alphabet across sessions
- Count field holds the batch size (e.g. 30)

**Threshold maintenance**
- Set "skip products counted within N days" (e.g. 90)
- Leave name filter blank or use if narrowing
- Uncheck "include zero stock"

**Rule-triggered**
- No UI work. Tasks created by validation engine land in the same `task.inventory.count` queue and flow through the same counting paths.

## Data Loading Model

### Server call on view open — new function

`WebAppInventory_getCountPlanningData()` returns a single object:

```
{
  products: [
    {
      sku,           // cpm_SKU
      nameHe,        // cpm_NameHe
      stock,         // cpm_Stock (number)
      isWeb,         // cpm_IsWeb === 'כן'
      isWine,        // cpm_Division === '1'
      isArchived,    // cpm_IsArchived === 'כן'
      vintage,       // cpm_Vintage
      vendor,        // cpm_Vendor
      brand,         // cpm_Brand (best-effort, may be blank)
      lastCount,     // pa_LastCount ISO date string or null
      pageUrl,       // wpm_ProductPageUrl (empty if no WebProdM row)
      imageUrl,      // wpm_Images (first image src from API)
      hasOpenTask    // boolean — dedup exclusion
    },
    ...
  ],
  loadedAt: ISO timestamp
}
```

Archived products are filtered out at the server level — no point shipping them to the client. `hasOpenTask` is a flag, not a filter, so the client can show "X already queued" counts in the UI but always exclude them from creation.

### Client-side behavior

- Load once on view render, cache in JS scope
- All filtering, sorting, previewing operates on this array
- No additional round-trips until "Create N tasks"
- Optional "Refresh data" button at top of card to reload manually (no auto-refresh)

### Performance expectation

CmxProdM is ~1500–2500 rows. Payload ~150–300 KB uncompressed. Initial load: 2–4 seconds. Every subsequent interaction: instant. This replaces the current multi-second server round-trip per preview click.

## Unified "Create Count Tasks" Card

**Replaces** the existing Bulk Task Creation card AND the Spot-Check card in `AdminInventoryView.html`.

### Controls

| Field | Type | Default | Notes |
|---|---|---|---|
| Name filter mode | Dropdown | `starts with` | `starts with` / `contains` |
| Name filter text | Text input | empty | Case-insensitive; matches `nameHe` |
| Start at (name) | Text input | empty | Advances alphabet across sessions; empty = from first |
| Count (batch size) | Number | 30 | Blank = unlimited |
| Skip counted within N days | Number | empty | Empty = full-sweep mode; populated = threshold mode |
| Web products only | Checkbox | checked | Matches current default |
| Wine only (Div 1) | Checkbox | checked | Matches current default |
| Include 0 stock | Checkbox | unchecked | Matches current default |

### Live preview area (below controls)

- **Candidate count display**: `"42 products match — will create [30] tasks"` — updates as criteria change
- **Preview table**: SKU, Name, Vintage, Stock, Last Counted, Brand (if present) — rows that will become tasks
- **Create button**: `"Create 30 count tasks"` — disabled until at least one candidate

### Behavior

- Every criteria change → re-filter the in-memory array → update count and preview table
- Archived always excluded
- SKUs with `hasOpenTask = true` always excluded from creation (and shown elsewhere in the view as informational count)
- Sort alphabetical by name, then slice from "start at" match forward, take first N

### Create button action

- Single server call: `WebAppInventory_createCountTasks(skus, optionalNote)` — returns `{ created, skipped, errors }`
- Server re-verifies no open task exists for each SKU (race protection in the two-user case)
- Creates `task.inventory.count` with SKU and product name in standard fields
- Success toast reloads the view data so the new tasks appear in the queue and are excluded from the next preview

## Sheet Export — New Columns

`WebAppInventory_exportCountsToSheet()` adds columns between existing ones:

| Column | Source | Editable | Purpose |
|---|---|---|---|
| SKU | existing | no | |
| Product Name | existing | no | |
| **Vintage (ref)** | `cpm_Vintage` | no | Reference — what the system says |
| **Product Page** | `wpm_ProductPageUrl` | no | Hyperlink; counter clicks to see bottle image + attributes |
| Comax Quantity | existing | no | |
| Brurya Quantity | existing | no | |
| Storage Quantity | existing | yes | |
| Office Quantity | existing | yes | |
| Shop Quantity | existing | yes | |
| Total Count | existing formula | no (formula) | |
| **Vintage (actual)** | blank | yes | Counter enters year observed on physical bottle |
| Comments | existing | yes | Free-text notes |
| Task ID | existing | no | |

Protection: sheet remains locked except for the editable columns listed above.

Image column **not** added — too small to be useful. Product page link delivers richer validation.

## Sheet Import — Strict Atomic Model

Replaces `WebAppInventory_importCountsFromSheet()`.

### Pre-scan phase (no writes)

Walk all rows. For each, collect issues into an errors array:

1. **Missing quantity with auxiliary data**: Storage/Office/Shop all empty AND (Vintage-actual non-empty OR Comments non-empty) → **reject row**
2. **Non-numeric quantity**: any filled quantity field that won't parse → **reject row**

Skipped (not errors): rows where Storage + Office + Shop + Vintage + Comments are all empty. These are unchanged rows — ignored silently.

### Outcome gate

- If any errors collected → return `{ success: false, errors: [...] }`. No writes. UI shows a list of row numbers, SKUs, and reasons. User fixes sheet and re-imports.
- If no errors → proceed to write phase.

### Write phase

For each row with any input data:

1. Write physical counts via `InventoryManagementService.updatePhysicalCounts()` (upsert on SysProductAudit by SKU — same behavior as today)
2. If Vintage (actual) is filled AND differs from `cpm_Vintage`:
   - Create `task.validation.vintage_mismatch`
   - Note format: `"Update Comax vintage to [entered value]"` + (if comment also present) `" " + [comment]`
3. If Comments is filled AND Vintage (actual) is empty or matches `cpm_Vintage`:
   - Create `task.validation.vintage_mismatch`
   - Note format: `[comment text]` verbatim
4. No dedup — duplicate vintage tasks allowed (by design)

Vintage task creation failures are logged but do not block the count write. Errors from the write phase (e.g. sheet transient failure) collect into a post-hoc errors array and return as `{ success: true, processed, errors }`.

### UI recovery surface

- Clean import: toast `"N counts imported, M vintage tasks created"`
- Pre-scan failure: modal listing row/SKU/reason; import not run
- Write-phase failure (rare): toast `"N imported successfully, M rows had issues"` + same modal format

## Manager In-App Count View — Enrichment

`ManagerInventoryView.html` and `WebAppInventory_getProductsForCount()`:

- Return `vintage`, `pageUrl`, `imageUrl` per product row (pulled from CmxProdM + WebProdM by SKU)
- Add on-demand expandable detail per row: show vintage, thumbnail preview (if imageUrl present), "View on site" link
- Allow counter to enter actual vintage or comment inline, same logic as the sheet import (creates vintage update task with note; count task proceeds independently)

Lazy loading: row expansion triggers display of already-loaded data, no extra server call.

## Spot-Check Fold-In

Delete:
- `WebAppInventory_createSpotCheckTask()` wrapper
- `InventoryManagementService.createSpotCheckTask()`
- `LookupService.searchComaxProducts()` (after verifying `ManagerInventoryView.html` usage)
- `WebAppInventory_searchComaxProducts()` wrapper
- Spot-Check Task Creation HTML block in `AdminInventoryView.html` (lines ~92–108)
- Spot-check JS block in `AdminInventoryView.html` (lines ~584–680)

**IMPORTANT:** `ManagerInventoryView.html:398` also calls `WebAppInventory_searchComaxProducts`. Before deleting the LookupService function, investigate what the manager view uses it for and either:
- Replace with an equivalent in-memory filter over already-loaded data, or
- Keep the function temporarily if the manager view use case is out of scope

If unsure, leave `searchComaxProducts` and the wrapper in place with a `@deprecated` comment and delete in a follow-up pass.

## Task Creation — Server Side

New function: `InventoryManagementService.createCountTasksBulk(skus, note)`

```
- Accepts an array of SKUs (already filtered client-side)
- Pre-loads open count-task SKUs (server-side dedup against race)
- For each SKU:
  - Skip if already has open task
  - Look up name from CmxProdM
  - Create task.inventory.count with SKU, name, title "Verify Count: {name}", and note
- Return { created, skippedDedup, errors }
```

Replaces `generateBulkCountTasks` and `_getBulkCandidates`. The old functions can be deleted once the new card is in place and no other callers exist.

## Files to Modify

| File | Change |
|---|---|
| `WebAppInventory.js` | Add `getCountPlanningData`, `createCountTasksBulk` wrapper; extend `getProductsForCount` with vintage/pageUrl/imageUrl; extend `exportCountsToSheet` with new columns; rewrite `importCountsFromSheet` with strict atomic model; remove `searchComaxProducts` wrapper (conditional); remove `createSpotCheckTask` wrapper |
| `InventoryManagementService.js` | Add `createCountTasksBulk`; remove `previewBulkCountTasks`, `generateBulkCountTasks`, `_getBulkCandidates`, `createSpotCheckTask` |
| `LookupService.js` | Remove `searchComaxProducts` (conditional on Manager view migration) |
| `AdminInventoryView.html` | Replace Bulk + Spot-Check cards with unified Create Count Tasks card; add preview table; wire up client-side filter/sort/preview logic; wire new create-tasks call |
| `ManagerInventoryView.html` | Enrich count rows with vintage/image/link display; wire inline vintage/comment input to task creation |

No config JSON edits. No `generate-config.js` run. No `rebuildSysConfigFromSource()`. Only `clasp push` and test.

## Implementation

All changes were implemented in a single pass after the user chose to batch them. One `clasp push` to test deployment, then user verification. Implementation details:

- **`TaskService.js`** — added `options.allowDuplicate` to bypass dedup; used by import-time vintage task creation
- **`InventoryManagementService.js`** — added `createCountTasksBulk(skus, note)`; removed `previewBulkCountTasks`, `generateBulkCountTasks`, `_getBulkCandidates`, `createSpotCheckTask`
- **`WebAppInventory.js`** — added `getCountPlanningData`, `createCountTasksBulk` wrapper; extended `getProductsForCount` with vintage/pageUrl/imageUrl; rewrote `exportCountsToSheet` with new columns and updated layout; rewrote `importCountsFromSheet` with strict atomic pre-scan + write phases; extended `submitInventoryCounts` to create vintage tasks from manager view inputs; removed old `previewBulkTasks` / `generateBulkTasks` / `createSpotCheckTask` wrappers
- **`LookupService.js`** — unchanged. `searchComaxProducts` is still used by `ManagerInventoryView.html` for the Brurya "Add Product" autocomplete (a separate feature from count tasks). Kept in place.
- **`AdminInventoryView.html`** — replaced both the Bulk Task Creation card and the Spot-Check card with the unified "Create Count Tasks" card; removed Bootstrap preview modal (violated project rule against `$().modal()`); added client-side filter/sort/preview/create logic against in-memory planning data
- **`ManagerInventoryView.html`** — added Vintage (ref) and Link columns to the count table; added expandable detail row per product with Vintage (actual) and Comment inputs; updated submit handler to pass these through to the server

## Testing Strategy

Test deployment only until user is satisfied; no production pushes from implementation sessions.

### Data loader
- Payload size (~150–300 KB expected)
- Load time (~2–4s acceptable)
- All archived products excluded
- `hasOpenTask` correctly flags SKUs with existing count tasks

### Unified card — filter correctness
- Full sweep (blank days): shows all eligible products
- Threshold mode (90 days): only products counted > 90 days ago OR never counted
- Name starts-with "Yatir": only products whose name begins with "Yatir" (Hebrew case-insensitive)
- Name contains "Forest": finds products with "Forest" anywhere
- Start-at "M": first match is first product whose name ≥ "M"
- Count 30: exactly 30 tasks created (or all if fewer match)
- Flags behave as expected (web-only, wine-only, zero-stock)

### Task creation
- SKUs with open count tasks excluded even if client includes them (server-side dedup)
- Created tasks appear in manager queue
- Title format correct
- Note passes through

### Sheet export
- New columns appear in correct order
- Vintage ref reads from `cpm_Vintage`
- Product page link from `wpm_ProductPageUrl` is clickable
- Protection unchanged except for new Vintage-actual input column

### Sheet import — pre-scan
- Missing quantity + comment → rejected, clear message, no writes
- Missing quantity + vintage → rejected, clear message
- Non-numeric quantity → rejected
- All-empty row → silently ignored, no error
- Clean sheet → proceeds to write phase

### Sheet import — write phase
- Counts written correctly for filled rows
- Vintage match (actual == ref) → count saved, no vintage task
- Vintage mismatch → count saved + vintage task with correct note format
- Comment only (quantity filled, vintage empty) → count saved + vintage task with comment note
- Vintage task creation failure → count still saves, error logged

### Manager view enrichment
- Expand shows vintage, image, page link
- Inline vintage entry creates correct vintage task
- Count still completes normally when vintage/comment entered

### Regression checks
- Inventory widget counts still match expectations
- Existing count tasks still import/export correctly
- `task.validation.comax_internal_audit` tasks (negative inventory) still appear in the manager queue

## Architectural Debt — Noted, Not Fixed

**Hardcoded export sheet columns.** Several export functions (`exportCountsToSheet`, `exportBruryaToSheet`, `generateComaxInventoryExport`) define their column lists as inline JS arrays with inline formatting/protection. The project externalizes most data schemas via `schemas.json` and `mappings.json`, but export sheet presentation is all in code. This means:

- Column changes require code deploys
- Each export sheet type maintains its own column list with no shared helper
- A non-developer cannot tweak layout

**Why not fixed in this round:** Externalizing columns cleanly requires a meta-schema (header label, source field, read-only, format, protection zone, width, color). That's substantial. No pressure to fix right now — columns rarely change, and when they do it's alongside code changes in the same function anyway.

**Revisit trigger:** A second count-sheet variant is requested, OR a non-developer needs to own column layout, OR shared export helpers become valuable for reasons beyond this file.

## Out of Scope (Explicit)

- New task types — reuse existing
- Config JSON edits — not needed
- Brand-dropdown filter — deferred until `cpm_Brand` is reliable (separate data-hygiene pass via Comax CSV)
- Export format alternatives (PDF, CSV) — sheet only
- Scheduled/automated full-sweep triggers — manual only
- Multi-sort (name then stock) — name only
- Bulk edit of existing count tasks — create-only for this round
- Reverse-match workflow ("find shelf inventory not in the list") — note only, not implemented; the full-list export already supports this use case manually

## Risk

**Low-to-medium.** The core change is architectural (memory-load, client-side filter) but all the data paths exist today. Biggest risk is the import rewrite — strict atomic mode is a behavior change from the current partial-write-then-throw. Mitigation: test deployment cycle with real sheets before production.

The spot-check removal is the second-largest risk because `ManagerInventoryView.html` references `searchComaxProducts`. Investigation required before deletion.
