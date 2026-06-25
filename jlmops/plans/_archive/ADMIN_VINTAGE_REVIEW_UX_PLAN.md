# Admin Vintage Review UX Fixes

**Status:** Deployed 2026-04-24 — tested, confirmed by user
**Scope:** AdminProductsView — "Review Pending" card modal (the vintage-mismatch review editor)
**Created:** 2026-04-23

## Problems

From admin feedback on 2026-04-23:

1. **Modal opens slowly.** Reviewing a queue of vintage-update tasks is painful.
2. **No navigation between tasks.** Once the modal is open, admin must close it, find the next row in the list, and click Review again. There's no prev/next.
3. **Task date is hidden when the modal is open.** Created date lives in the list row, which the modal covers.

## Current Flow (for reference)

- `AdminProductsView.loadReviewList()` → `WebAppProducts_getAdminReviewTasks()` returns `[{ taskId, sku, productName, title, createdDate }, ...]`. This is cached client-side as the rendered table.
- Clicking **Review** → `openEditor(taskId)` at `AdminProductsView.html:1319`:
  1. Sets modal visible, clears fields.
  2. Round-trip 1: `WebAppProducts_loadProductEditorData(taskId)` at `WebAppProducts.js:230`.
     - Full `SysTasks` scan (via `_getSheetDataAsMap`) just to resolve `taskId → sku`.
     - `ProductService.getProductDetails(sku)` at `ProductService.js:1045`: reads 4 sheets (WebDetM, WebDetS, CmxProdM, WebProdM) with 5-min `CacheService` per sheet. On cache miss, `getDataRange().getValues()` on each.
     - Returns a big JSON string.
  3. Round-trip 2: `updatePreview()` → `WebAppProducts_getPreview(sku, formData, comaxData)` at `WebAppProducts.js:148` → `ProductService.getProductHtmlPreview(...)` renders EN + HE HTML.
- Modal header shows only: `wdm_NameEn`, `sku`, `wdm_NameHe`. No date.
- Modal footer: Cancel, Accept & Update. On accept: `closeModal()` + `refreshView()` (reloads the list from backend).

## Diagnosis

| Issue | Root cause | Lever |
|-------|-----------|-------|
| Slow | Two serial GAS round-trips per open; first-of-session also misses the 4-sheet cache; redundant full SysTasks scan just to look up SKU from taskId | Eliminate redundant reads; merge trips; reuse cached sheet maps across sequential reviews |
| No nav | Modal has no prev/next; accept closes and forces re-scan of the list | Add prev/next buttons; on accept, auto-advance to next task in the in-memory array |
| Date hidden | Modal header never received it | Include `createdDate` in modal header (already returned by `getAdminReviewTasks`) |

## Design Decisions

**D1. Pass `sku` to the editor-data loader.** The client already knows the SKU for each task (returned by `getAdminReviewTasks`). Drop the full `SysTasks` scan inside `WebAppProducts_loadProductEditorData` and accept `(taskId, sku)` instead of `(taskId)`. This removes one sheet scan per open.

**D2. Merge data load + preview into one round-trip.** `loadProductEditorData` should also return the rendered `htmlEn`/`htmlHe` preview, since it already has `masterData`, `stagingData`, `comaxData` in hand. This eliminates round-trip 2 on open. Subsequent preview refreshes (textarea edits → `updatePreview`) still call `getPreview` separately; that's fine.

**D3. In-memory task list drives navigation.** Cache the array returned by `getAdminReviewTasks` as `AdminProductsView.reviewTasks`. Track `currentIndex`. Prev/Next buttons call `openEditor(reviewTasks[nextIndex].taskId, reviewTasks[nextIndex].sku)`. No backend changes beyond D1.

**D4. Auto-advance on Accept.** Current accept flow: close modal + `refreshView()`. New flow: splice the accepted task out of the in-memory `reviewTasks` array, decrement the counter, and if more tasks remain, open the next one (same position — if index 3 was accepted, index 3 is now the next task). If list is empty, close and refresh. This avoids the full-list reload round-trip between reviews.

**D5. Show created date in modal header.** Add a fourth header item. Format with `toLocaleDateString()` matching the list. Also show "N of M" position indicator next to it so the admin knows where they are in the queue.

**D6. Do not change cache TTL or cache strategy.** The existing 5-min CacheService caching in `ProductService.getProductDetails` is already good — and D3+D4 make it far more effective because multiple reviews now happen in quick succession within one session. Don't touch what's working.

## File Changes

### Backend

**`WebAppProducts.js`**

- Line ~230 `WebAppProducts_loadProductEditorData(taskId)`:
  - Change signature to `(taskId, sku)`.
  - Delete the `SysTasks` lookup block (lines 232–245 — the `allTasks` map and task fetch). If `sku` is falsy, fall back to the old lookup for safety (one line).
  - After building `productDetails`, also compute `htmlEn` and `htmlHe` by calling `ProductService.getProductHtmlPreview` twice (once per language — inspect current signature, it may already do both in one call; if so, one call). Return them as additional fields on the result: `{ ..., htmlEn, htmlHe }`.

**`ProductService.js`**

- Confirm `getProductHtmlPreview` signature and whether the existing call returns both languages or just one. Current `WebAppProducts_getPreview` passes `'EN'` as the language arg — implies single language per call. If so, in `loadProductEditorData` we make two calls for initial preview, using the same already-loaded `masterData`/`stagingData`/`comaxData` (no extra sheet reads). Small duplication cost, large UX gain.

No schema changes, no config changes, no `SetupConfig.js` regeneration.

### Frontend — `AdminProductsView.html`

**Modal header (lines 489–496):** add a fourth header item for created date + position indicator, e.g.:

```html
<div class="modal-header">
  <div class="modal-product-info">
    <div id="header-name-en-display" class="header-item header-left"></div>
    <div id="header-sku-display" class="header-item header-center"></div>
    <div id="header-name-he-display" class="header-item header-right"></div>
  </div>
  <div id="header-meta" class="small text-muted">
    <span id="header-created-date"></span> · <span id="header-position"></span>
  </div>
  <button type="button" class="close" ...>...</button>
</div>
```

CSS tweak if needed to keep the existing 3-column name layout clean — meta goes on its own row above or below the names. Copy existing header-item styling; do not invent new classes.

**Modal footer (lines 537–541):** add Prev + Next buttons. Keep existing Cancel / Accept & Update. Copy the `btn` class already on those buttons — **do not** add `btn-primary`/`btn-secondary`.

```html
<div class="modal-footer bg-light">
  <div id="modal-status" class="mr-auto text-muted small"></div>
  <button class="btn btn-sm" id="btn-prev" onclick="AdminProductsView.navTask(-1)">‹ Prev</button>
  <button class="btn btn-sm" id="btn-next" onclick="AdminProductsView.navTask(1)">Next ›</button>
  <button class="btn btn-sm" onclick="AdminProductsView.closeModal()">Cancel</button>
  <button class="btn btn-sm" onclick="AdminProductsView.acceptChanges()">Accept & Update</button>
</div>
```

**Script changes (inside the existing IIFE):**

- Add state: `AdminProductsView.reviewTasks = []; AdminProductsView.currentIndex = -1;`.
- In `loadReviewList` success handler (line ~991), store `AdminProductsView.reviewTasks = tasks || [];` before rendering the rows.
- Modify `openEditor` to accept `(taskId, sku)` OR change signature to `openByIndex(index)`. Preferred: `openByIndex(index)` — sets `currentIndex`, pulls `taskId`, `sku`, `createdDate` from `reviewTasks[index]`, populates header date + position ("3 of 12"), enables/disables prev/next based on bounds, calls backend with both `taskId` and `sku`, and uses the returned `htmlEn`/`htmlHe` to render preview immediately (no separate `updatePreview` round-trip on open).
- Update both row buttons (lines 1007, 1167) to call `openByIndex(i)` (pass the loop index — for the Submissions table we may still open by taskId since that list may differ; keep both paths if needed).
- Add `navTask(delta)`: `openByIndex(currentIndex + delta)` with bounds guard.
- Modify `acceptChanges` success handler: splice `reviewTasks[currentIndex]`, update the rendered table row (or just `loadReviewList` in background without awaiting), update position indicator, then:
  - If `reviewTasks.length === 0`: `closeModal()` + `refreshView()` (as today).
  - Else: open the task now at `currentIndex` (the next task shifted into that slot), or `currentIndex - 1` if we were at the end.

### Notes

- The Submissions table (line 1167) uses the same `openEditor` — it's a separate list (`loadSubmissionsList`). Decide whether to scope the prev/next behavior only to the Review Pending list, or extend it. **Recommendation:** keep prev/next only for the Review Pending queue for now — that's where the admin feels the pain. Submissions table stays single-click-and-close.

## Expected Impact

- **First modal open of session:** 1 round-trip instead of 2. ~30–50% faster.
- **Subsequent opens (via prev/next or auto-advance):** same 1 round-trip, but now the 4-sheet cache is warm, and the full-list refresh between reviews is skipped. Should feel near-instant (maybe 200–400 ms total).
- **No more "close, find row, click Review"** between tasks.
- **Date visible** in every modal.

## Implementation Order

1. Backend: change `loadProductEditorData` signature + remove SysTasks scan + add preview to return value.
2. Frontend: add state array, `openByIndex`, header date/position, prev/next wiring.
3. Frontend: auto-advance on Accept.
4. Test with live vintage-mismatch queue.

## Testing

- Open queue with ≥3 pending vintage-mismatch review tasks.
- Click Review on first → modal opens, date + "1 of N" visible in header, preview shows immediately.
- Click Next → advances without closing, preview refreshes.
- Click Prev at index 0 → button disabled, no-op.
- Accept middle task → advances to what was the next task, counter decrements.
- Accept last task in queue → modal closes, list refreshes.
- Edge: single task in queue — prev/next both disabled, accept closes modal.
- Edge: empty submissions table — unchanged behavior.
- Verify no regression in Submissions table Review button.

## Out of Scope

- Changing the underlying cache strategy in `ProductService.getProductDetails`.
- Schema / config changes.
- Keyboard shortcuts (could add later).
- Any changes to manager's vintage-update task view.

## Implementation Notes (2026-04-23)

- `getProductHtmlPreview` already returns `{ htmlEn, htmlHe }` in one call (despite the `lang` param in its signature — the function ignores it and always renders both). So the backend adds just one preview call, not two, to assemble the initial preview.
- Added `_buildInitialFormData(master, staging)` in `WebAppProducts.js` to mirror the client's `getFormData()` merge rule exactly (staging wds_ overrides master wdm_ whenever staging key is defined, even if empty). This is critical — treating empty-string staging as "fall back to master" would show stale values when the manager has intentionally cleared a field.
- `openEditor` preserves `currentIndex` only when the taskId matches the current queue slot; otherwise resets to -1. This cleanly distinguishes queue-nav opens (from Review Pending) from direct opens (from Submissions table) so prev/next hides itself on direct opens.
- Auto-advance splices the accepted task out of the in-memory array, re-renders the review table in place (no full backend refresh between reviews), and opens the next task at the same index. Full `refreshView()` only runs when the queue drains.
- Files modified: `WebAppProducts.js`, `AdminProductsView.html`. No config/schema changes, no `SetupConfig.js` regen needed.

Lightly flagged for later cleanup (not addressed here): `ProductService.getProductHtmlPreview` ignores its `lookupMaps` param and rebuilds it internally — dead parameter, but out of scope for this UX fix.
