# Inventory API Push — Alternate Sync Route

**Created:** 2026-05-05
**Status:** IMPLEMENTED + DEPLOYED 2026-05-05 as jlmops @80. First real-cycle push verified successful (16/16 products updated in WC after WC API key permission was upgraded from Read to Read/Write).
**Goal:** Add a REST-API push path that updates WooCommerce product prices and quantities directly, alongside (not replacing) the existing CSV export → manual upload → confirm flow.

## Implementation log

- **2026-05-05** — Six implementation steps landed in this order, each with `clasp push`; final deploy at `clasp deploy --deploymentId AKfycbzDvzMNI0IYyMFVjdWG8YcUs3clDsSNz4hoLq5VhFHlaYqpPcBxC0jQ3biCd6HeeqlU4A` (stable URL) as @80.
  1. State machine + config skeleton — added `PUSHING_WEB_INVENTORY` stage and the `WAITING_WEB_CONFIRM → PUSHING_WEB_INVENTORY` transition in `SyncStateService.js`. Added `export.web.inventory.api` job type in `config/jobs.json`, regenerated `SetupConfig.js`.
  2. Push service — new `WooInventoryPushService.js`. Reads CSV from Drive (`state.webExportFilename` in `system.folder.jlmops_exports`), parses headers `ID,SKU,Stock,Regular Price`, PUTs each row to `/wc/v3/products/{ID}` with `{ regular_price, stock_quantity }`. Atomic semantics: any failure marks the whole job FAILED with per-SKU error list in `error_message`.
  3. Backend entry point — `pushWebInventoryBackend` in `WebAppSync.js` (stage guard `WAITING_WEB_CONFIRM`, transition + queue + run). `queueWebInventoryPush` in `OrchestratorService.js`. New `PUSHING_WEB_INVENTORY` branch in `_checkAndAdvanceSyncState` with the inline stuck-job reaper. Wired `WooInventoryPushService` into the orchestrator's processing-service switch.
  4. Retry override — `retryFailedStepBackend` redirects `failedAtStage: 'PUSHING_WEB_INVENTORY'` back to `WAITING_WEB_CONFIRM` so the CSV is still in hand and the user can fall back to manual upload.
  5. Widget UI — `WAITING_WEB_CONFIRM` stage now has `button: ['pushWebInventory', 'API Push']` + `altButton: ['confirmWeb', 'I uploaded it']`. New `PUSHING_WEB_INVENTORY` config (spinner). New `pushWebInventory` JS handler. "Open in Drive" link added to Step 5 card (mirrors Pre-Sync invoice-folder pattern) when `state.webExportFilename` is set, via new `getWebExportFileUrlBackend` + `viewCsv` handler.
  6. Also extended `WooApiService._fetch` to support body for PUT (`Content-Type: application/json`, `payload = JSON.stringify(body)`). Service header changed from "Read-only" to "Read + write".

- **2026-05-05** — First production cycle: initial push failed 0/16 with HTTP 401 "API key provided does not have write permissions". User upgraded the WC REST API key from Read to Read/Write in wp-admin. Retry succeeded; product data verified updated in WooCommerce.

## Architectural decision: CSV-as-source

The push reads the **same CSV the existing path generates** as its input — it does NOT compute its own changed-product set. This means:

- One change-detection codepath. Whatever rules the existing export uses to decide "eligible and changed since last cycle" apply to both delivery routes by construction.
- Bit-for-bit parity guaranteed. The CSV is the contract; whichever route delivers it, WC ends up in the same state.
- The CSV becomes an audit artifact for every push, not just manual uploads.
- Built-in fallback: if API push fails partway, the CSV is on Drive — fall back to manual upload without regenerating.
- Couples both routes to CSV generation. If CSV gen fails, both routes fail — but that's where the failure should surface (broken data upstream would break the API path too).

Implication: the fork in the state machine is **after** `GENERATING_WEB_EXPORT`, not before it. Both routes always produce the CSV first.

## Why

Today, sync stage 5 generates a CSV of changed products and the user manually uploads it to the website (WAITING_WEB_CONFIRM). With change detection already filtering to only-changed products (qty or price diff between cycles), daily volume is small — typically a handful of products. The manual upload step is overhead disproportionate to the actual change.

A parallel API push:
- Eliminates the manual upload + confirm step.
- Removes the CSV file artifact (no more orphan files in Drive, no naming conventions to keep clean).
- Surfaces per-product errors immediately (instead of after a failed import on the WP side).
- Keeps the CSV path intact as fallback so any regression is one click away from rollback.

## Non-goals

- Not replacing the CSV path. Both routes coexist indefinitely (or until the API path proves itself over many cycles).
- Not rebuilding change detection. The new push consumes the same set of changed products the CSV path would write. One source of truth for "what changed this cycle".
- Not pushing fields beyond price + qty. Same scope as the CSV export — anything else stays where it lives (descriptions, taxonomies, etc. are managed separately).
- Not handling product creation or deletion. Push is updates-only; new SKUs flow through the existing pipeline.

## Architecture

### Fork after CSV generation

State machine before:

```
VALIDATING → WAITING_WEB_EXPORT → GENERATING_WEB_EXPORT → WAITING_WEB_CONFIRM → COMPLETE
```

State machine after (no renames — `WAITING_WEB_CONFIRM` keeps its name; it semantically means "CSV is ready, waiting for the action that completes the cycle", which fits both delivery routes):

```
VALIDATING → WAITING_WEB_EXPORT → GENERATING_WEB_EXPORT → WAITING_WEB_CONFIRM ─┬→ PUSHING_WEB_INVENTORY → COMPLETE   (API)
                                                                                └→ COMPLETE                            (manual confirm — unchanged)
```

`WAITING_WEB_CONFIRM` shows two buttons: **API Push** (primary) and **I uploaded it** (the existing manual-confirm flow). The CSV is generated either way; the user just picks how it gets to WC. A code comment on the stage definition documents that the name predates the API path and covers both routes.

Failure on the API path goes to FAILED with `failedAtStage: 'PUSHING_WEB_INVENTORY'`. Retry returns to `WAITING_WEB_CONFIRM` so the user can pick again — typically falling back to manual upload once they see the API push isn't working for the current cycle.

### New components

| File | Type | Responsibility |
|------|------|---------------|
| `jlmops/WooInventoryPushService.js` | new service | `processJob(ctx)` — pull the changed-product set, PUT each via WooApiService, set job status COMPLETED or FAILED |
| `jlmops/WebAppSync.js` | edit | Add `pushWebInventoryBackend()` — stage guard, transition WAITING_WEB_EXPORT → PUSHING_WEB_INVENTORY, queue + run the new job |
| `jlmops/SyncStateService.js` | edit | Add `PUSHING_WEB_INVENTORY` to STAGES + TRANSITIONS table |
| `jlmops/OrchestratorService.js` | edit | New branch in `_checkAndAdvanceSyncState` for `PUSHING_WEB_INVENTORY`. Add `queueWebInventoryPush(sessionId)`. Add `_reapStuckJobInSession` call in the new branch (matching the recent hardening fix). |
| `jlmops/AdminDailySyncWidget_v2.html` | edit | Add `PUSHING_WEB_INVENTORY` to `STAGE_CONFIG` (spinner). Add `altButton` to `WAITING_WEB_EXPORT` config. Add `pushWebInventory` JS handler. |
| `jlmops/config/jobs.json` | edit | Register `export.web.inventory.api` job type with `processing_service: 'WooInventoryPushService'`. After edit: `node jlmops/generate-config.js`. |

### Reuse, don't duplicate

- **CSV is the input.** The push parses the same file the existing path generates (Drive file, name in `state.webExportFilename`). No new change-detection. No re-pull from sheets.
- **WooApiService** — existing REST plumbing (auth, request wrapper, error parsing). Push uses `PUT /wp-json/wc/v3/products/{id}` with `{ regular_price, stock_quantity }` payload.
- **SKU → Woo product ID lookup** — the CSV has SKUs. Need a lookup table (likely WebProdM rows already store the WC product ID). Build a one-shot map at job start so we don't query per row.
- **Job tracking** — same SysJobQueue pattern. Same status lifecycle (PENDING → PROCESSING → COMPLETED/FAILED). Same notification routing on failure.
- **Stuck-job reaper** — the inline reaper added 2026-05-05 in `_checkAndAdvanceSyncState` extends to the new stage automatically once we add the branch and the helper call.

## State machine details

`WAITING_WEB_CONFIRM` keeps its name. The new transition just adds a second outgoing edge.

Add to `SyncStateService.STAGES`:

```js
PUSHING_WEB_INVENTORY: 'PUSHING_WEB_INVENTORY',
```

Update `TRANSITIONS`:

```js
WAITING_WEB_CONFIRM:   ['COMPLETE', 'PUSHING_WEB_INVENTORY'],  // existing manual-confirm + new API push
PUSHING_WEB_INVENTORY: ['COMPLETE', 'FAILED'],
```

(`GENERATING_WEB_EXPORT` already transitions to `WAITING_WEB_CONFIRM` — unchanged.)

`failedAtStage` semantics: if push fails, `failedAtStage = 'PUSHING_WEB_INVENTORY'`. Retry returns the user to `WAITING_WEB_CONFIRM` (the pre-fork stage with the CSV in hand), not back to `PUSHING_WEB_INVENTORY`. This way they can pick a different route on retry — typically falling back to manual upload of the CSV that's already on Drive. Implementation: `retryFailedStepBackend` already sets `state.stage = state.failedAtStage`; we'd override for `PUSHING_WEB_INVENTORY` to set `state.stage = 'WAITING_WEB_CONFIRM'` instead. Document this special case.

## Push service — `WooInventoryPushService.processJob(ctx)`

Pseudocode shape:

```
1. Read sync state to get webExportFilename. If absent → throw (push should never run without a CSV).
2. Open the CSV from Drive. Parse rows (SKU, qty, price columns — match whatever the existing export writes).
3. If empty → mark job COMPLETED with note "No rows to push", flush, return.
4. Build SKU → Woo product ID map from WebProdM (one query, not per row).
5. For each CSV row:
     a. Look up Woo product ID by SKU. If missing → record as failure for this row, continue.
     b. Build PUT payload: { regular_price, stock_quantity } (only those two fields).
     c. Call WooApiService.putProduct(wooId, payload).
     d. Capture response (success/failure + per-row reason).
6. After loop:
     a. If all succeeded → mark job COMPLETED with summary (e.g. "Pushed 7 products: 7 ok, 0 failed").
     b. If any failed → mark job FAILED with error_message listing failed SKUs + reasons.
7. SpreadsheetApp.flush.
```

The service touches **only** the `regular_price` and `stock_quantity` fields on each WC product — never the title, description, taxonomy, images, or any other field. SKU is the matching key.

### Per-product error handling

**Atomic failure semantics:** any failure → whole job FAILED → user sees Retry. Reasons:
- Volume is tiny (handful per day). Partial-success states are confusing for low N.
- The failures are typically transient (rate-limit, transient network) or systemic (auth broken, plugin off). Either way, retry-the-whole-batch is the right ergonomic.
- Avoids "what changed in this partial state" debugging when something does go wrong.

Error message format:
```
Pushed 7/10 products. Failed:
  - SKU ABC-123 (product 4521): 404 Not Found
  - SKU XYZ-789 (product 4522): rate limit
  - SKU DEF-456 (product 4523): 400 invalid stock_quantity
```

Future iteration could add quarantine semantics (succeeded products commit, failed products go to a review queue) — out of scope for v1.

### Batching & timing

Apps Script hard limit: 6 minutes. WC REST API rate limit: typically ~3-5 PUTs/sec safely. Daily volume per the user: "few products updated daily". So a typical job is <10 PUTs and finishes in seconds.

For larger cycles (e.g. after a price audit touches 200 products), 200 × ~300ms = ~60 seconds — still well within budget. No chunking needed at this scale.

If volume grows past ~500 changed products in a single cycle, revisit: add chunked job pattern (process N per execution, requeue if more remain). Not needed for v1.

### Idempotency

The PUT endpoint is naturally idempotent (sets values, doesn't increment). Re-running the push after a partial failure is safe — products that already got the new values get them set again, no side effects. This makes Retry trivially correct.

## Widget UX

`WAITING_WEB_EXPORT` stays unchanged (single Generate button — same as today).

`STAGE_CONFIG[WAITING_WEB_CONFIRM]`:

Before:
```js
WAITING_WEB_CONFIRM: { message: 'Upload to website, then confirm', button: ['confirmWeb', 'Confirm'], confirm: true }
```

After:
```js
WAITING_WEB_CONFIRM: { 
  message:   'Export ready: {filename}. Push to WC or upload manually',
  button:    ['pushWebInventory',  'API Push'], 
  altButton: ['confirmWeb',        'I uploaded it'],
  confirm:   false  // the alt action keeps its own confirm dialog inside confirmWeb()
}
```

The existing filename-substitution logic for `WAITING_WEB_CONFIRM` in `updateSharedArea` (around `AdminDailySyncWidget_v2.html:257-258`) is unchanged.

Add new stage to STAGE_CONFIG:
```js
PUSHING_WEB_INVENTORY: { message: 'Pushing inventory updates via API...', button: null, spinner: true }
```

New JS handler in widget script:
```js
function pushWebInventory() {
    runAction('pushWebInventoryBackend', 5, 'Pushing inventory updates...');
}
```

Wire into `window.SyncWidget`. `runAction` already handles the spinner, button disable, success/failure routing — no new lifecycle logic needed.

Step 5 card text stays "Update Web Inventory"; the per-step message shows "Pushed N products" or "Manual upload confirmed" depending on which route was taken.

## Job config (`jobs.json`)

Add an entry mirroring `export.web.inventory`:

```json
"export.web.inventory.api": {
  "processing_service": "WooInventoryPushService"
  // any other fields the existing entry has — match shape
}
```

Run `node jlmops/generate-config.js` then `clasp push` then `rebuildSysConfigFromSource()` per the standard config workflow.

## Verification protocol

Test in the Apps Script editor environment first, then in the live widget:

1. **Manual upload still works** — start a sync, advance to `WAITING_WEB_CONFIRM`, click "I uploaded it" (the existing Confirm button, just relabeled). Should behave exactly as today's WAITING_WEB_CONFIRM → COMPLETE.
2. **Empty CSV** — sync where the export has zero rows. The current path goes COMPLETE on the no-changes branch — that path stays unchanged. API Push isn't reachable in this case (no CSV to push from).
3. **Small cycle, API Push** — stage a real change (one product price or qty). Run sync to `WAITING_WEB_CONFIRM`. Click API Push. Verify WC product updates via wp-admin or WC REST GET. Job → COMPLETED, state → COMPLETE.
4. **Failure mode — bad SKU lookup** — temporarily set a product's web ID to an invalid value. API Push. Job FAILED, error_message lists the bad SKU + reason. Widget shows Retry. State has `failedAtStage: 'PUSHING_WEB_INVENTORY'`.
5. **Failure mode — auth broken** — temporarily invalidate WC API key in SysEnv. API Push. Job fails fast (first PUT 401), error message clear. Widget shows Retry.
6. **Retry → fallback** — from a failed push, click Retry. Should return to `WAITING_WEB_CONFIRM` (not back to `PUSHING_WEB_INVENTORY`). The CSV is still on Drive. User clicks "I uploaded it" instead, uploads the file manually, confirms. Cycle completes.
7. **Side-by-side parity** — same cycle, generate CSV, API Push, compare resulting WC state to what manually uploading the same CSV would have produced. Must match exactly. Run this on the first few real cycles before declaring the API path trustworthy.
8. **Stuck-job reaper** — manually leave a `PUSHING_WEB_INVENTORY` job in PROCESSING with a 10-min-old timestamp. Poll. Reaped to FAILED at 8 min, widget shows Retry, fallback to manual upload available.

Each test produces a SysLog entry; capture them in the implementation session for evidence.

## Rollback plan

The API path is additive: a new button, a new stage, a new service. Nothing in the existing CSV path is touched. To roll back:

1. Remove the `altButton` line from `STAGE_CONFIG[WAITING_WEB_EXPORT]` in the widget.
2. (Optional) leave the backend code in place — no harm, just unreachable from the UI.

Or full rollback: revert the commits.

## Implementation sequence

Land in this order, each as its own commit so any regression is bisectable:

1. **State machine + config skeleton** — add `PUSHING_WEB_INVENTORY` stage and the new `WAITING_WEB_CONFIRM → PUSHING_WEB_INVENTORY` transition to `SyncStateService`. Add `export.web.inventory.api` job type to `jobs.json`, regenerate config. No new behavior yet — just plumbing.
2. **Push service** — implement `WooInventoryPushService.processJob`: read CSV from Drive, parse, build SKU→ID map, PUT each row, mark COMPLETED/FAILED with summary. Test in Apps Script editor via `DevelopmentView` trigger, no widget yet.
3. **Backend entry point** — add `pushWebInventoryBackend` in `WebAppSync.js` (stage guard `WAITING_WEB_CONFIRM`, transition to `PUSHING_WEB_INVENTORY`, queue + run). Add `queueWebInventoryPush` in `OrchestratorService.js`. Add the `PUSHING_WEB_INVENTORY` branch to `_checkAndAdvanceSyncState` (with the inline stuck-job reaper).
4. **Retry override** — patch `retryFailedStepBackend` to redirect `failedAtStage: 'PUSHING_WEB_INVENTORY'` back to `WAITING_WEB_CONFIRM`.
5. **Widget UI** — add the altButton + the new `PUSHING_WEB_INVENTORY` stage config + the `pushWebInventory` JS handler. Now the user can drive the new path end-to-end.
6. **Verification pass** — run all 8 tests; capture results in plan + bugs.md if anything surfaces.

Steps 1-4 are testable from the Apps Script editor without UI. Step 5 lights up the user-facing path. Step 6 is the gate before declaring the API path ready for production cycles. **Run the parity test (#7) on the first 2-3 real cycles before relying on API Push as the default route.**

## Open questions

- **CSV column layout.** Need to confirm exact column names in the export (`sku`, `stock_quantity`, `regular_price` — or different headers). Resolve in step 3 by reading the CSV-writer service.
- **SKU → Woo ID lookup source.** WebProdM presumably stores the WC product ID. Confirm column name and that it's reliably populated. If gaps exist, push must fail per-row with clear "no WC ID for SKU X" message.
- **Price field.** Push `regular_price` only, or also `sale_price`? CSV behavior dictates. If CSV sends `regular_price`, match. If sale prices are managed differently (e.g., via promotions), don't touch them.
- **Notification severity.** A failure during push reaches the same `NotificationService.reportFailure` channel as the CSV path. Confirm the message routing is wired to alert appropriately and isn't silently dropped.
- **Per-cycle audit log.** The push service should log per-row result somewhere — either SysLog or a new dedicated table. Lightweight version: one summary log entry per job listing all SKUs pushed + statuses, plus the source CSV filename for traceability.
- **Rename impact on existing log entries.** Renaming `WAITING_WEB_CONFIRM` → `WAITING_WEB_DELIVERY` means historical SysLog rows mention the old name. That's fine (logs are immutable) — just be aware grep for "WAITING_WEB_CONFIRM" returns historical matches.

## Files touched (summary)

- New: `jlmops/WooInventoryPushService.js`
- Edit: `jlmops/SyncStateService.js`, `jlmops/WebAppSync.js`, `jlmops/OrchestratorService.js`, `jlmops/AdminDailySyncWidget_v2.html`
- Edit: `jlmops/config/jobs.json` → regenerate `jlmops/SetupConfig.js`
- Reference (read-only): existing CSV writer service (location TBD — step 3), `WooApiService.js`, WebProdM schema (for the SKU→ID lookup column)
