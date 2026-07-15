# Verify Detail Speedup Plan

Speeds up the manager's read-only product-verification batch walk. Distinct from `PRODUCT_DETAIL_SNAPSHOT_PLAN.md` (the full add/edit/verify-converted editor) — this covers the plain `task.product.verify` review panel (image/category/flags comparison), which needs current live data, not a creation-time snapshot. Not yet implemented.

## Problem

The manager's verify batch walk (`ManagerProductsView.advanceVerify`, `ManagerProductsView.html:1440`) steps through every open `task.product.verify` task one at a time. Each step calls `loadVerifyDetail(sku)` (`:1453`), which round-trips to `WebAppProducts_getVerifyDetail` → `ProductService.getVerifyDetail(sku)` (`ProductService.js:3123`). That function calls `ConfigService._getSheetDataAsMap` for both `CmxProdM` and `WebProdM` — and that helper does a full, **uncached** sheet read every single call (`ConfigService.js:184-199`, `sheet.getRange(...).getValues()`, no cache layer at all).

So a walk of N open verify tasks does N separate full scans of CmxProdM and N separate full scans of WebProdM — the same "full-sheet-read-for-one-row" shape that made the product editor slow before Session J's fixes, except with zero caching at all (not even the CacheService layer the editor had before this round of fixes). For a catalog-sized sheet, this compounds badly across a real walk.

## Why not a snapshot (like the other plan)

`PRODUCT_DETAIL_SNAPSHOT_PLAN.md`'s fix works because the user confirmed product-detail data is reference-only and staleness between creation and open doesn't matter. Verify tasks are the opposite case: their entire purpose is catching *current* drift between live Comax/Web data (image, category, division/group) — a snapshot taken at task-creation time could go stale before review and defeat the check. This needs a speed fix that keeps live data, not a creation-time snapshot.

## Design — bulk prefetch, same shape as the dashboard/bundles fixes already in this codebase

The manager's walk already knows its full SKU list before stepping through it — `startVerifyWalk()`/`startVerifyAt()` (`ManagerProductsView.html:1415-1433`) load the whole `verifyQueue` (task id + SKU + title per open task) up front. That's the one place to read CmxProdM/WebProdM once for every SKU in the queue, instead of once per step.

1. **New `ProductService.getVerifyDetailsBulk(skus)`** — reads CmxProdM + WebProdM exactly once (not per SKU), builds the same per-SKU shape `getVerifyDetail` already returns (`{ imageUrl, webCategory, cmxDivision, cmxGroup, isWine }`), for every SKU in the list. Returns a `{sku: detail}` map. `getVerifyDetail(sku)` itself can be reimplemented as a one-SKU call into this (no duplicated read logic) for any future single-SKU caller.
2. **Client — `startVerifyWalk()`/`startVerifyAt()`** — call `WebAppProducts_getVerifyDetailsBulk(skus)` once, alongside fetching the task list, and cache the result client-side (e.g. `ManagerProductsView.verifyDetailCache`).
3. **`loadVerifyDetail(sku)`** — reads from that client-side cache instead of a fresh `google.script.run` round trip. Zero server calls during the walk itself, not just cheaper ones — stronger than a per-step cache-hit, since it also removes the round-trip latency, not only the sheet-read cost.
4. Live-ness is still as fresh as today's per-step calls were meant to be: the whole walk's data is captured once, at walk-start, same recency the manager gets today on the *first* step (every subsequent step today is already implicitly working from data that's a few seconds to a few minutes stale relative to a live-edited sheet — batching just makes that explicit and uniform instead of hiding it behind N separate stale-by-different-amounts calls).

## Out of scope

- The product editor's own load time — that's `PRODUCT_DETAIL_SNAPSHOT_PLAN.md`, already shipped (@492/@493).
- `getVerifyPlanningData()` (the full-catalog planning list used to select/create verify tasks in the first place) — separate function, separate caller, not part of the per-step walk cost this plan targets. Worth a look later if it's also slow, not blocking this.

## Sequencing

1. Add `ProductService.getVerifyDetailsBulk(skus)` (one CmxProdM + one WebProdM read, loop in memory).
2. Add `WebAppProducts_getVerifyDetailsBulk(skus)` wrapper.
3. Reimplement `getVerifyDetail(sku)` as a thin single-SKU wrapper over the bulk function (removes duplicate read logic).
4. Client: `startVerifyWalk()`/`startVerifyAt()` prefetch via the bulk call; `loadVerifyDetail()` reads from the client-side cache.
5. Smoke-test: start a verify walk with several open tasks, confirm each step renders instantly with correct image/category/flags, confirm no server calls fire during stepping (only at walk-start).

## Status

Implemented and deployed @494. No schema change (no new SysTasks column needed). Not yet smoke-tested live.
