# New Product Workflow — Manager UX Plan

**ARCHIVED 2026-07-01.** Three UX fixes to the **Manager Products view** (`ManagerProductsView.html`) on the new-product onboarding path: make the view load fast via lazy/collapsed cards, fix the English product name showing blank during processing, and make the candidate list sortable. Root causes below are grounded in the code; the design decisions are locked. Status: all three shipped — #3 sort deployed @308, #2 EN-name + #1 lazy cards deployed @309 (2026-06-17). Tracks A/B/C (translation timing, hot-link retirement) shipped through @423. The onboarding-pipeline description graduated to `jlmops/docs/WORKFLOWS.md` §14 (done in a prior session). Verified 2026-07-01: `linkAndFinalizeNewProduct` is gone from the codebase (matches the plan's @422 claim); `docs/DATA_MODEL.md`'s stale 4-column `wxl_` WebXltM schema (flagged in this plan as needing a fix) has been corrected to the real 31-column `wxm_` schema. Kept here for historical design rationale only — the UI-polish smoke checklist (item (a)-(e), STATUS.md Pending Verification) is still open and unrelated to this archival.

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

## Export parity fix (post-plan)

The new-product export (`generateNewProductExport`) used a different, EN-heavy column set (Name EN / Price / Stock / Short EN / Long EN / Long HE) than the product-detail-update export, so a linked new product reached WooCommerce with an empty/mismatched description. Root cause: the hot-insert (`linkAndFinalizeNewProduct`) writes name/price/stock/Woo-IDs but never a description, and after it closes the task (Accepted→Done) the SKU drops out of the export pool — descriptions never got exported.

**Fix:** `generateDetailExport` and `generateNewProductExport` now both delegate to one shared builder `ProductService._buildProductDetailExport(skus, sessionId)`. The new-product export is therefore byte-identical to the detail export (SKU · Title EN · Short EN · Long EN · Short HE · Long HE · Title HE), and the two can never drift. Each caller still owns its own task pool (`vintage_mismatch` Accepted vs `add_product` Accepted).

Operationally: export **before** the hot-insert (while the task is still Accepted), or re-queue a record by reverting its status to Accepted, then export. No revert UI or recovery routine was built — recovery is a manual status flip.

## Deferred — retire the manual hot-link (sync owns new-product insertion)

**Status: deferred (warranted, too costly now). Revisit as its own session.**

The manual hot-link (`linkAndFinalizeNewProduct`) is a relic of the original design, when the system managed EN price/qty only and a separate HE translation feed ran *after* a product already existed in Woo. Today the Woo pull fetches both languages in one pass, and each HE product carries `translations.en` pointing at its EN original (`WooProductPullService._transformApiTranslation`). So the EN↔HE relationship the hot-link supplies by hand is already in every sync payload.

What the hot-link actually does for a new SKU is **two inserts**: it creates the **WebProdM** (EN master) row *and* the **WebXltM** (translation) row — the only `WebProdM.appendRow` and `WebXltM` insert in the onboarding path. Accept (`acceptProductDetails`) only seeds **WebDetM**; the EN pull (`_upsertWebProductsData`) is **update-only** (skips SKUs not already in master). So before the link, only WebDetM (+ WebDetS staging) carries the SKU.

**Target design:** keep WebXltM, but maintain it (and the new WebProdM row) from the sync pull rather than user input. Once the admin creates the EN+HE products in Woo and pairs them in WPML, the next pull has everything to insert both rows from `translations.en`. New products handled once; hot-link retires.

**Why deferred:** product import flows staging → validation → master. A brand-new SKU appearing in staging is (today) a validation-rule violation — which is exactly why the upsert is update-only. Making the pull insert-capable for new products means reworking that validation gate. Real scope, not warranted yet.

**Interim (current):** keep creating stubs + hot-linking to get the Woo IDs. The description now exports correctly (export-parity fix above), which was the actual day-to-day pain.

**WebXltM correction (verified 2026-06-19).** The framing above overstated the hot-link's role in translations. The daily **API Pull** (`pullAndImportAll`) already rebuilds WebXltM wholesale every sync: it re-pulls HE products and `ProductImportService.upsertWebXltData` **clears WebXltM and rewrites it** from the HE staging pull (using the fixed `translations.en` linkage). So WebXltM is sync-owned, not hot-link-owned. Two real findings stand: (a) the hot-link's WebXltM insert in `linkAndFinalizeNewProduct` is **dead code** — it writes `wxl_*` columns but the live schema is `wxm_*` (31 cols, mirroring staging), so every `indexOf` returns -1 and it appends a blank row the next sync overwrites; (b) `docs/DATA_MODEL.md` still documents the old 4-column `wxl_` WebXltM schema — stale. Both logged for a cleanup pass.

## Track A — on-demand translation refresh (shipped @323, 2026-06-19)

The only genuine new-product translation gap is **timing**: between adding a product mid-day and the next daily sync, WebXltM has no EN↔HE link for it. Closed with an **on-demand WebXltM refresh** control instead of a new importer.

- **Backend:** `WooProductPullService.refreshTranslationLinks()` — mirrors Phase B of `pullAndImportAll` (HE pull → stage → `web_xlt_staging` validation → `upsertWebXltData`), minus the sync-state-machine step updates, plus the active-sync guard copied from `pullProducts` (it clears+rebuilds WebXltM, so it must not collide with an in-flight sync). Exposed via `WebAppProducts_refreshTranslations()`.
- **UI:** "Refresh Translations" button on the Admin Products → New Products card, Section D (next to Export), confirm-gated, with status feedback.
- **Behavior:** identical to the daily sync's HE phase, so validation behaves the same (the row-count-decrease quarantine guard only trips on removals, not adds). Full HE re-pull each call — chosen over a surgical single-product insert for lowest new code / proven safety.
- **Smoke:** add a product (hot-link), click Refresh Translations, confirm its `wxm_*` row appears in WebXltM linking HE→EN; verify it skips cleanly if a sync is mid-flight.

## Track B — retire the hot-link (shipped @342 + @370 + @371)

The destination: eliminate the manual **Link** step (Woo-ID entry + hot-insert) entirely.

**Revised design (2026-06-22).** The earlier framing assumed the sync would insert WebProdM for new SKUs, which hit the validation-gate blocker. The correct design is simpler: `acceptProductSuggestion` (the accept step) inserts both WebProdM and WebDetM directly, so the sync's existing update-only path continues to work unchanged — the row is already there when the sync runs.

**Target flow:**

1. Manager suggests a new product.
2. Admin accepts + supplies EN/HE names → `acceptProductSuggestion`:
   - Inserts **WebProdM** row (SKU + EN name + price/stock from CmxProdM) — *new*
   - Seeds **WebDetM** row (SKU + EN/HE names) — *new*
   - Pre-populates WebDetS with names (as today)
   - Admin also creates EN + HE drafts in WooCommerce and pairs them in WPML (manual).
3. Manager submits details → `submitProductDetails` → updates WebDetS (as today).
4. Admin reviews and accepts details → `acceptProductDetails` → updates WebDetM from WebDetS + **deletes WebDetS row** (cleanup moves here from the hot-link).
5. Admin publishes the Woo product (manual).
6. Admin updates Comax (manual).
7. Next sync: EN pull finds SKU already in WebProdM, updates it (wpm_ID, price, stock, etc.); HE pull rebuilds WebXltM with the EN↔HE link.

**`linkAndFinalizeNewProduct` (hot-link) is retired** — its WebProdM insert moves to step 2; the dead `wxl_` insert is removed with it.

**What needs to change in code:**

| Change | Location | Status |
|--------|----------|--------|
| Insert WebProdM row (SKU + EN name + price/stock from CmxProdM) | `acceptProductSuggestion` | ✓ @342 |
| Seed WebDetM row (SKU + EN/HE names) | `acceptProductSuggestion` | ✓ @342 |
| Delete WebDetS row after accepting details | `acceptProductDetails` | ✓ @342 |
| Remove Linkage UI button | `AdminProductsView.html` | ✓ (removed in earlier session) |
| Delete `linkAndFinalizeNewProduct` (incl. dead `wxl_` insert) | GAS codebase | ✓ @422 |

**Shipped:** hotlink retired @342 (WebProdM + WebDetM seeded in `acceptProductSuggestion`; WebDetS cleanup moved to `acceptProductDetails`). Accept modal requires Woo Post ID @370 (seeds `wpm_ID` in WebProdM at accept time, eliminating empty-key row loss). `cpm_IsWeb` set at accept @371. Draft-product validation false-positives resolved @368 (rule 17 gated to `wpm_PostStatus=publish`). See `.claude/bugs.md` 2026-06-24. **Pending:** Linkage UI button removal + `linkAndFinalizeNewProduct` deletion deferred to Track C completion (remove together in one pass).

---

## Follow-ons shipped (post-plan, @310–@311)

- **Badge color (@310):** count badges show dark-gray (`badge-secondary`) at zero, color when pending — amber for to-clear counts (mismatch, verify), blue for onboarding. `ManagerProductsView.setCountBadge`.
- **Manager badge counts were broken (@311):** `loadWidgetData` read flat keys (`vintage_mismatch_tasks`/`onboarding_tasks`) that `getProductsWidgetData` never returns (it returns `detailUpdates.{edit,review}` + `newProducts.{suggested,review}`) — badges had been stuck at 0. Remapped to the real fields.
- **Admin submissions title (@311):** `getSubmissionsTasks` now reads the product title from WebDetS staging (`wds_NameEn` ‖ `wds_NameHe`), not the stale Comax-derived `st_LinkedEntityName`.
- **Admin New Products badge (@311):** collapsed-card header count (suggestions + submissions), loaded on mount via `getProductsWidgetData`; lazy section loads unchanged. **Open:** linkage (add_product Accepted) isn't counted by that widget — include it if a fuller count is wanted.

## Track C — seed WebXltM at accept time (shipped)


**Goal:** close the WebXltM timing gap without the Refresh Translations button. When the admin supplies the EN Woo Post ID at accept, the EN↔HE WPML pairing already exists (user creates EN draft → clicks Create Translation → gets HE ID in sequence). So `translations.he` is guaranteed to be on the EN product at accept time.

**Change:** in `acceptProductSuggestion`, after writing `wpm_ID` to WebProdM, fetch the EN product from the Woo REST API (`WooApiService` — same credentials, same pattern as the pull pipeline), read `product.translations.he`, and upsert the WebXltM row for this SKU.

**Effect:** WebXltM is populated on accept. The daily sync still rebuilds WebXltM wholesale on each run (no change needed). The Refresh Translations button becomes a fallback for manual corrections rather than a required step for new-product onboarding.

**Location:** `acceptProductSuggestion` in `WebAppProducts.js` (or the service it delegates to). Single Woo API fetch, single WebXltM upsert. No sync-state-machine involvement — this runs synchronously in the accept handler like the existing WebProdM/WebDetM writes.

**Cleanup — after Track C is smoked and confirmed:**

| Remove | Location |
|--------|----------|
| "Refresh Translations" button + confirm gate | `AdminProductsView.html` (Track A UI) |
| `WebAppProducts_refreshTranslations()` | `WebAppProducts.js` (Track A backend) |
| `WooProductPullService.refreshTranslationLinks()` | `WooProductPullService.js` (Track A backend) |
| Linkage UI button | `AdminProductsView.html` (Track B pending) |
| `linkAndFinalizeNewProduct` function (incl. dead `wxl_` insert) | GAS codebase (Track B pending) |
| Stale `wxl_` schema documentation | `docs/DATA_MODEL.md` |
