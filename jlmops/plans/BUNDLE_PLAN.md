# Bundle Handling — Master Plan

**Created:** 2026-06-04 (consolidates `BUNDLE_AUTHORING_EXPORT_PLAN.md` + `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md` into one staged plan).
**Status:** Planning. Staged — each stage is independently shippable; **decide depth as we refine**. No code until per-stage user go.
**Owner:** Session-driven; user reviews / visually verifies.
**Supersedes:** `BUNDLE_AUTHORING_EXPORT_PLAN.md`, `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md` (both stubbed → here). `BUNDLE_API_PUSH_TEST_PLAN.md` remains **parked** (export via the vendor's own import is safer than a raw REST write).

---

## 1. Vision

Today jlmops is a near read-only **monitor** for bundles: composition is edited row-by-row in WPClever per language, master data refreshes only via the slow full sync, and there's no profit or cross-bundle intelligence. The goal is to make jlmops the **fast authoring + intelligence surface** for bundles:

- **Refresh** member data quickly (not via the slow full sync).
- **Author** composition once (EN+HE together) and **publish** to WC by export.
- **Validate** EN/HE integrity and stock.
- **Optimize** (forward-looking) for **profit** and **catalog diversity**.

WC stays the **system of record**; jlmops is the authoring + analysis layer.

## 2. Current state (verified 2026-06-04)

- Composition is derived into `SysBundles` / `SysBundleSlots` from **master** (`WebProdM.wpm_WoosbIds` EN + `WebXltM.wxm_WoosbIds` HE) by `WebAppBundles_reimportAllBundles` → `BundleService.importBundleFromWooCommerce`.
- The `woosb_ids` JSON is token-keyed: product slots `{id, sku, qty, optional, min, max}`, text/section slots `{type, text}` (`BundleService.js:1069`). This **is** the WPClever import/export format.
- **Master refreshes only via the slow full product pull** (pull → staging → validation → copy-to-master, which also drags orders/Comax). The 15-min frequent-maintenance trigger pulls **orders only**. So the bundle screen is slow + usually stale.
- **woosb products have no SKU / no Comax relationship and skip Comax validation** (`DATA_MODEL.md`) — they're exempt from the reason the staging→validate gate exists.
- The jlmops bundle **editor already exists** (`AdminBundlesView.html`: slot list, Add Text/Product, per-slot SKU+qty, EN/HE text). Controllers `updateComposition`/`reviewStock`/`validateParity` exist in `WebAppBundles.js` (live status to confirm — Stage 3).
- A price calc exists — `BundleService._calculateBundlePrice` — using `sb_DiscountPrice` (`displayPrice`/`discount` at `:202-204`). It has the **qty=0 bug** (Stage 0).

## 3. Decisions (settled with user)

- **jlmops = authoring surface; WC = system of record.** Re-derive on every refresh; un-exported edits are **volatile** (publish-or-lost, by design); `sb_PendingExport` is a "publish now" marker, **not a shield**.
- **Publish via WPClever's first-party import** (single field per bundle product; trusted, manually reliable per user). REST push parked.
- **Fast refresh = bundles-only pull straight to master** (safe because woosb is exempt from the Comax-reconciliation gate).
- **Profit:** margin uses the **discounted** selling price (`displayPrice`), not summed regular prices. **qty=0 contributes 0** to price/value.
- **Trust basis:** the export text is the `woosb_ids` meta; the premium plugin behaves like the read free version (user's call). No plugin-side verification gate.

---

## 4. Stages

Ordered foundation → forward-looking. Each produces shippable value on its own.

### Stage 0 — Quick fixes
- **qty=0 price bug** (`BundleService.js:198`): `slot.defaultQty || 1` coerces a 0-qty placeholder slot to 1, inflating the calculated total. Fix: `slot.defaultQty === '' || slot.defaultQty == null ? 1 : Number(slot.defaultQty)`. Internal only (admin display + future margin), not the live WC price. Tracked in `.claude/bugs.md`.

### Stage 1 — Fast member refresh + view load control
- **Bundles-only pull (direct to master).** New `WooProductPullService.pullBundleProducts()` — WC REST `?type=woosb` (EN+HE, tens of products), upsert **only** the bundle fields (`wpm_TaxProductType` + `wpm_WoosbIds`; `wxm_WoosbIds`) **directly into WebProdM/WebXltM, bypassing staging+validation**. Safe: woosb is exempt from Comax validation; the next full sync's copy-to-master writes the same WC data (no divergence). New **"Pull Bundle Data"** button, first in the management-card row. **Update Composition** then re-derives from master only (drops its WC-fetch role).
- **View load control.** The view is slow and loads stale data on mount. Defer the heavy load and/or keep cards collapsed until the user has run Pull. Options (decide at build): (a) collapsed cards + lazy-load on expand; (b) lightweight list immediately, defer detail; (c) gate the heavy load behind Pull. Verify current mount behavior at build.

### Stage 2 — Authoring + export (the core win)
- **Workspace = the existing editor.** Polish as needed.
- **Serializer.** `BundleService.exportBundleWoosb(bundleId, lang)` → `{json, warnings}`: slots → token-keyed `woosb_ids` (product `{id,sku,qty,optional,min,max}` / text `{type,text}`), letter-first tokens (preserve order), sku→id per language (EN `wpm_WebIdEn` by `wpm_SKU`; HE via `WebXltM.wxm_WpmlOriginalId`→`wxm_ID`), unresolved SKU → blank that cell + row warning. `optional` from `sbs_QtyVariable`; `min`/`max` blank.
- **Export table.** `buildExportTable()` over the **pending-export** bundles → rows `{bundleId, name, en, he}`. Delivered as **Open in new tab** (HTML table, click a cell to copy) + **Export to file** (TSV — JSON has no tabs). Button on the management card. Paste each row's EN/HE cell into that bundle's EN/HE product via WPClever Import.
- **Pending-export tracking.** New `sb_PendingExport` (append-only on `SysBundles`); set on slot-edit save with a "volatile until published" warning; **cleared** when any re-derive (`reimportAllBundles`, incl. the daily `refreshBundleComposition`) rebuilds the bundle from WC — website truth wins, no skip/shield. Optional **Mark published** clears immediately.
- **DATA_MODEL reframing.** Retire the "shadow system" line for composition: jlmops authors, WC is record, non-composition woosb settings stay WC-managed.
- **Button row consolidated:** Pull Bundle Data → Update Composition → Review Stock → Validate Parity → Export.

### Stage 3 — Integrity (EN/HE parity + stock)
- **Parity validator** — `BundleService.validateAllBundleParity()`. Full algorithm in Appendix A. Section-aware, atomic `(product_id, qty)` pair check, EN-as-truth, `qty=0` is a real value (not absence). Failure modes: `HE_MISSING`, `HE_EXTRA`, `QTY_MISMATCH`, `SECTION_COUNT_MISMATCH`, `WRONG_SECTION`. Results cached on `SysBundles` (`sb_ParityIssueCount` + timestamp); **Parity** column on the list; alerts panel tagged Stock/Parity. Post-sync auto-trigger runs it after `checkBundleHealth`.
- **Stock review** — `checkBundleHealth` on demand (Review Stock button) + the existing post-sync trigger.
- **Reconcile:** the editor + these three controllers already exist in code — confirm live, finish gaps, retire the old refinements framing.

### Stage 4 — Profitability (Comax cost → whole-bundle margin)
- **Cost pull.** Add `sp_Cost` (or `CmxProdM` equivalent, append-only) refreshed by sync — Comax can supply cost; it's **not pulled today** (confirmed). Cost is internal — never customer-side.
- **Whole-bundle margin** = `displayPrice` (discounted selling price) − Σ(member cost × **actual** qty). Depends on Stage 0 (qty=0→0). Per-member margin alone is misleading; model the bundle.
- **Surface** margin in the editor's candidate list (sort/filter) and in `WebAppBundles_getEligibleProducts` suggestions, so profitability drives inclusion.

### Stage 5 — Cross-bundle diversity / rotation
- A wine can sit in several bundles; today the only cross-bundle signal is the binary `sbs_Exclusive`. Build a **cross-bundle usage index** (which active bundles each SKU is in); **diversity-score** `getEligibleProducts` to down-rank wines already saturating other bundles; optional **rotation** history so bundles refresh over time. `sbs_Exclusive` becomes a soft usage signal rather than on/off.

---

## 5. Data-model touches (cumulative)
`sb_PendingExport` (SysBundles, Stage 2) · `sp_Cost` (Comax product, Stage 4) · cross-bundle usage index (derived/cached, Stage 5) · possibly `sbs_WoosbKey` (Stage 2, only if WPClever import rejects regenerated tokens). All append-only.

## 6. Open questions
- Margin surfacing: whole-bundle vs per-member emphasis in the editor.
- Diversity scoring weight + rotation window (Stage 5).
- View-load approach (collapse vs lazy vs gate).
- Premium WPClever import specifics — trusted per user; one round-trip smoke confirms our serializer, not the plugin.

## 7. Out of scope
- REST push of composition (`BUNDLE_API_PUSH_TEST_PLAN.md`, parked).
- Non-composition woosb settings (discount/layout/limits) — stay WC-managed (margin *reads* `sb_DiscountPrice`).
- Customer-facing site / theme.
- Shipping any fix inside a planning stage — each stage is its own build.

---

## Appendix A — EN/HE parity validator algorithm (carried from the refinements plan)

**Inputs per bundle:** EN composition (`wpm_WoosbIds`), HE composition (`wxm_WoosbIds`), WPML map (`WebXltM.wxm_WpmlOriginalId` → HE `wpm_ID`). Both parsed by `_parseWoosbJson` into slots (`type`/`id`/`qty`/`text`).

**EN-as-truth:** EN is canonical; all drift is "HE relative to EN." Resolution is always fix-HE-to-EN or accept-the-change-and-update-EN (next run reports clean).

**Section-aware:** treat each bundle as ordered **sections** delimited by text/HTML slots (a section = one text header + the product slots until the next text slot). Match sections by ordinal position (editorial order is identical EN/HE); within a section, match products by WPML translation pair (intra-section product order is per-language alphabetic, so don't compare positions). Single-section bundles (no text slots) collapse to one implicit section.

**Atomic check** — unit is `(product_id, qty)`. For each EN product slot in a section: translate `en_id`→`he_id`; find the HE slot with that id in the matched HE section; compare `qty_en` vs `qty_he`. `qty=0` is a **real, intentional value** (customization placeholder), never treated as absence — a qty=0 EN vs qty=1 HE is a `QTY_MISMATCH`, not "missing." Any HE product in the section not consumed by an EN match is an HE-extra.

**Failure modes:** `HE_MISSING` (EN product's translation absent where expected) · `HE_EXTRA` (HE product whose EN translation isn't in the EN bundle) · `QTY_MISMATCH` (pair found, qtys differ — report both) · `SECTION_COUNT_MISMATCH` (different # of text-delimited sections) · `WRONG_SECTION` (pair found but in a different ordinal section).

**Not checked:** EN product with no WPML translation (doesn't occur in this catalog) · total bottle-count parity (misleading due to qty=0 placeholders — per-pair qty catches the real cases) · text-slot translation quality (separate concern).

**Open at implementation:** whether `woosb_ids` keys are stable UUIDs or array indices — stable keys would enable text-slot identity matching across languages; index keys → only section-count parity for text slots. Ships with the product-slot validator regardless; text-slot identity is a refinement after seeing real premium JSON.
