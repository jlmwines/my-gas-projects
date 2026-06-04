# Bundle Handling — Master Plan

**Created:** 2026-06-04 (consolidates `BUNDLE_AUTHORING_EXPORT_PLAN.md` + `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md` into one staged plan).
**Status:** Planning. Staged — each stage is independently shippable; **decide depth as we refine**. No code until per-stage user go.
**Owner:** Session-driven; user reviews / visually verifies.
**Supersedes:** `BUNDLE_AUTHORING_EXPORT_PLAN.md`, `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md` (both stubbed → here). The **REST-push approach is parked** (export via the vendor's own import is safer than a raw REST write) — it was never written up as its own doc, so there is no `BUNDLE_API_PUSH_TEST_PLAN.md` file; the idea lives here in §7.

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
- The jlmops bundle **editor already exists** (`AdminBundlesView.html`: slot list, Add Text/Product, per-slot SKU+qty, EN/HE text). Controllers `updateComposition` (`WebAppBundles.js:765`), `reviewStock` (`:788`), `validateParity` (`:805`) and `BundleService.validateAllBundleParity` (`:1487`) **confirmed live 2026-06-04** — Stage 3 is mostly already built (see §4 sequencing note). The old `Refresh` button, `Add New Bundle` modal, and an `addBundle` backend (named in the predecessor refinements plan) **no longer exist in code** — verified absent in `WebAppBundles.js` + `AdminBundlesView.html`; that cleanup is already done.
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

**Sequencing note (2026-06-04, post-review).** The stage numbers are a logical grouping, **not** a build order. What's actually shipped vs net-new:
- **Stage 3 (integrity) is mostly already built** — `updateComposition`/`reviewStock`/`validateParity` + `validateAllBundleParity` are live (verified §2). Treat it as *confirm-live + finish-gaps*, runnable now and in parallel with the rest.
- **Stages 1–2 are the genuinely net-new work** — no `pullBundleProducts`, `exportBundleWoosb`, or `sb_PendingExport` in code yet. This is where the real build effort sits.
- Stage 0 is a one-line bug fix; Stages 4–5 are forward-looking.

Suggested build order: **Stage 0 → Stage 1 → Stage 2**, with Stage 3 confirmed/finished alongside, then 4 → 5.

### Stage 0 — Quick fixes
- **qty=0 price bug** (`BundleService.js:198`): `slot.defaultQty || 1` coerces a 0-qty placeholder slot to 1, inflating the calculated total. Fix: `slot.defaultQty === '' || slot.defaultQty == null ? 1 : Number(slot.defaultQty)`. Internal only (admin display + future margin), not the live WC price. Tracked in `.claude/bugs.md`.

### Stage 1 — Fast member refresh + view load control
- **Bundles-only pull (direct to master).** New `WooProductPullService.pullBundleProducts()` — WC REST `?type=woosb` (EN+HE, tens of products), upsert **only** the bundle fields (`wpm_TaxProductType` + `wpm_WoosbIds`; `wxm_WoosbIds`) **directly into WebProdM/WebXltM, bypassing staging+validation**. Safe: woosb is exempt from Comax validation; the next full sync's copy-to-master writes the same WC data (no divergence). New **"Pull Bundle Data"** button, first in the management-card row. **Update Composition** stays as-is — it already re-derives from master only with **no WC pull** (`WebAppBundles_updateComposition` → `reimportAllBundles`, confirmed 2026-06-04); the predecessor's "pull-inside-Update" role was never built, so there is nothing to drop.
- **View load control — fix the documented root cause first.** The slow mount is **not** a vague "loads too much" problem: it's a diagnosed N+1 — `WebAppBundles_getViewData` fans out to `getBundlesWithLowInventory`, whose per-bundle→per-slot loop calls `getEligibleProducts` (`BundleService.js:920`), and each call re-reads whole sheets (`WebProdM`/`WebDetM`/`_loadSlots`), blowing up to 100s+. Root cause + two fixes are already written in `PERFORMANCE_OPTIMIZATION_PLAN.md` (§"Bundles Health Check — N+1 Sheet Reads"): **Fix A** = preload an invariant `ctx` once and pass it into `getEligibleProducts`; **Fix B** = drop `healthAlerts` from the mount and compute low-inventory only when the user opens the alerts panel. Prefer that fix over collapse/lazy/gate workarounds (those only mask the symptom). If any UX deferral is still wanted on top, decide at build.

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
- REST push of composition — **parked** (no separate doc; export via vendor import preferred).
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

## Review — RESOLVED (2026-06-04)

**Resolution (folded into the plan body 2026-06-04, all three claims re-verified against code first):**
1. **Stages reframed, not deleted.** Added the §4 sequencing note: Stage 3 is marked mostly-built and runnable now/in parallel; Stages 1–2 flagged as the net-new work; §2 updated with confirmed-live controller line refs.
2. **N+1 root cause referenced.** Stage 1's view-load bullet now points at `PERFORMANCE_OPTIMIZATION_PLAN.md` (§N+1 Sheet Reads, Fix A ctx-preload / Fix B drop healthAlerts) and prefers it over the collapse/lazy/gate workarounds.
3. **Stale line fixed + dead-code claim corrected.** The "drops its WC-fetch role" line is gone — `updateComposition` already re-derives from master with no WC pull (verified, logs it explicitly). **Correction to the review itself:** the `Refresh` button / `Add New Bundle` modal / `addBundle` backend it wanted re-added as a cleanup task **do not exist in current code** (verified absent via grep across `WebAppBundles.js` + `AdminBundlesView.html` — `addBundle` appears only in this plan doc); that cleanup is already done, so §2 now records them as absent rather than queuing a retire-task. The `BUNDLE_API_PUSH_TEST_PLAN.md` references were corrected (file never existed; REST push parked in §7).

---

Independent review (Dispatch). **Merge quality is good** — reads as one coherent staged plan (not stapled fragments), both predecessors (`BUNDLE_AUTHORING_EXPORT_PLAN.md`, `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN.md`) correctly folded in and stubbed→here, parity algorithm carried verbatim in Appendix A. `CROSS_SELL_PLAN.md` correctly left unmerged (PDP recommendations, separate domain). Three fixes before build:

1. **Status understates what's shipped — reorder Stages.** Stage 3 (parity + stock + on-demand controls) is framed as future ("confirm live, finish gaps"), but it's already built: `WebAppBundles_updateComposition/reviewStock/validateParity` (`WebAppBundles.js:765/788/805`) + `BundleService.validateAllBundleParity` (`BundleService.js:1487`) all exist. Stages 1–2 (member pull, woosb export) are the genuinely net-new work — no `pullBundleProducts`/`exportBundleWoosb`/`sb_PendingExport` in code. Mark Stage 3 mostly-done and sequence it ahead of / parallel to the net-new stages, not after.
2. **Big gap — the known N+1 perf issue.** Stage 1's "view load control" proposes collapse/lazy/gate workarounds for the slow mount but never references the documented root cause: `getBundlesWithLowInventory`'s N+1 (`BundleService.js:920`) makes `getViewData` take 100s+, already diagnosed with a fix in `PERFORMANCE_OPTIMIZATION_PLAN.md`. The plan masks the symptom instead of pointing at the real fix — a merge blind spot (that perf work lived outside both predecessors). Reference it and prefer the root-cause fix.
3. **Lost predecessor content + a stale claim.** The refinements plan's concrete dead-code cleanup (retire `Refresh`, the `Add New Bundle` modal + `WebAppBundles_addBundle` backend) was dropped — the new button row (§4 Stage 1) lists keepers but never says to retire the dead controls; re-add that. And Stage 1 says Update Composition "drops its WC-fetch role" — but the code already re-derives from master with no WC pull (`BundleService.js:202–204`), so there's no role to drop; the predecessor's pull-inside-Update design was never built. Correct the line. (Minor: `BUNDLE_API_PUSH_TEST_PLAN.md` cited as "parked" was never written.)

Stage 0 qty=0 bug confirmed real (`const qty = slot.defaultQty || 1;`, `BundleService.js:198`). Sources: this doc; predecessors @4a24da8/@41a386e (git, pre-stub); `PERFORMANCE_OPTIMIZATION_PLAN.md`; spot-checks `BundleService.js` (198, 202–204, 920, 1487), `WebAppBundles.js` (765/788/805), `AdminBundlesView.html`.
