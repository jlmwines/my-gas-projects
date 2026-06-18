# New Product Workflow — Manager UX Plan

Three UX fixes to the **Manager Products view** (`ManagerProductsView.html`) on the new-product onboarding path: make the view load fast via lazy/collapsed cards, fix the English product name showing blank during processing, and make the candidate list sortable. Root causes below are grounded in the code; the design decisions are locked. **Status: all three shipped — #3 sort deployed @308, #2 EN-name + #1 lazy cards deployed @309 (2026-06-17). Pending live smoke; once confirmed, graduate the onboarding-pipeline description into `docs/WORKFLOWS.md`.**

## Context

The new-product onboarding pipeline is **Suggestion → Accept → `task.onboarding.add_product` (Review) → Submissions → Linkage → finalize**, one task lifecycle keyed by SKU (statuses New → Review → Accepted → Done). It is largely **undocumented in the system docs** — the real spec lives in `config/taskDefinitions.json` + `WebAppProducts.js` / `ProductService.js` + `AdminProductsView.html` / `ManagerProductsView.html`. When this work ships, graduate a short description of the pipeline into `docs/WORKFLOWS.md`.

## 1. Manager view loads slow → collapsed cards + progressive badges

**Cause.** On open, init runs all four loads at once — `loadWidgetData` + `loadTaskList` + `loadVerifyList` + `loadCategoryStatus` (`ManagerProductsView.html:537-540`) — so every card populates before first paint. Admin Products already solved this: its cards collapse and **lazy-load on first expand** via `AdminProductsView.toggleCard()`, with clickable headers and header badges.

**Approach.** Reuse Admin's `toggleCard` pattern. Cards in page order: **Detail Updates → Verification Tasks → New Products → Suggest Products**.

- **Detail Updates** (topmost) **opens on load** — its content (`loadTaskList`) and header badges (`loadWidgetData` → `stat-mismatch` + `stat-onboarding`) load immediately.
- The other three start **collapsed**; their loads **chain sequentially in the background** in page order (Verification → New Products → Suggest Products). Each load fills its header badge and pre-populates its body, so expanding later is instant.
- Expanding a card before its turn triggers its load on the spot; a per-card `loaded` flag stops the background chain from double-loading it.

**Badges (pending count on a collapsed header).** No new count endpoint — each `loadX` sets its own badge from the result it already fetches. Verification = existing `verify-task-count`; **New Products = add a count badge** (onboarding queue); **Suggest Products = no badge** (it's the discovery/search tool, not a pending queue) — just lazy-load its panel.

**To confirm at implementation.** What populates `onboarding-list-body` (New Products) — `loadTaskList` or a separate loader — so it gets wired into the chain + badge.

## 2. New-product English name blank in the manager preview

**Cause (grounded).** The manager preview and editor header read EN/HE from the **detail master**: `name = isEn ? m.wdm_NameEn : m.wdm_NameHe` (`ManagerProductsView.html:1407`; header at 916-921). For a product **mid-onboarding**, the admin-supplied English name lives in **WebProdM `wpm_PostTitle`** and/or **WebDetS staging `wds_NameEn`** — it has not been written into detail-master `wdm_NameEn` yet, so EN renders blank while `wdm_NameHe` shows. The same fallback already exists server-side — `ProductService.js:1180`: `if (!masterData.wdm_NameEn && wpm_PostTitle) masterData.wdm_NameEn = wpm_PostTitle` — but it is not applied on the path that builds `currentMasterData` for the manager preview.

**Approach.** Apply that existing fallback on the manager-preview load path: when `wdm_NameEn` is empty, source EN from `wpm_PostTitle` (or staging `wds_NameEn`). Reuses logic that already exists; small change. Confirm the loader that sets `currentMasterData` (via `loadVerifyDetail` → its backend getter) and apply the fallback there.

## 3. Candidate / suggestion list — sortable

**Current.** The candidate list renders in backend order (`loadSuggestions`); the rows already carry `price` and `stock`.

**Approach.** Default sort = **alphabetical by product name (title)**. Add **user-selectable** sort options for **Price** and **Stock quantity** (clickable column headers / sort control), done client-side on the already-fetched list. Apply to the Manager candidate list; mirror on the Admin suggestion list where the same columns exist.

## Deploy & docs

Touches the manager's live daily surface → expect 1-2 small deploys via the wrapper (`jlmops/deploy.ps1`), smoke each. On ship, graduate the onboarding-pipeline description into `docs/WORKFLOWS.md` (currently undocumented).

## Suggested order

Smallest/lowest-risk first: **(3) sort → (2) EN-name fallback → (1) lazy cards**. Each can be its own deploy. (Shipped in this order @308/@309.)

## Follow-ons shipped (post-plan, @310–@311)

- **Badge color (@310):** count badges show dark-gray (`badge-secondary`) at zero, color when pending — amber for to-clear counts (mismatch, verify), blue for onboarding. `ManagerProductsView.setCountBadge`.
- **Manager badge counts were broken (@311):** `loadWidgetData` read flat keys (`vintage_mismatch_tasks`/`onboarding_tasks`) that `getProductsWidgetData` never returns (it returns `detailUpdates.{edit,review}` + `newProducts.{suggested,review}`) — badges had been stuck at 0. Remapped to the real fields.
- **Admin submissions title (@311):** `getSubmissionsTasks` now reads the product title from WebDetS staging (`wds_NameEn` ‖ `wds_NameHe`), not the stale Comax-derived `st_LinkedEntityName`.
- **Admin New Products badge (@311):** collapsed-card header count (suggestions + submissions), loaded on mount via `getProductsWidgetData`; lazy section loads unchanged. **Open:** linkage (add_product Accepted) isn't counted by that widget — include it if a fuller count is wanted.
