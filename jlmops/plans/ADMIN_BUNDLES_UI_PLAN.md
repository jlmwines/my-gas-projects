# Admin Bundles View — UI Overhaul Plan

**Status:** DESIGN DEFINED 2026-06-07 (Dispatch) — three-lens design pass (workflow, IA, interaction) + user interview + mockup reviewed by user. Ready for phased build, per-phase user go.
**Owner:** Dispatch-led (UI/UX redesign of `AdminBundlesView`). Main CLI session owns the data/serializer/export layer in `BUNDLE_PLAN.md`.
**Relationship:** This doc owns the **editor UI/UX** at a deeper level than `BUNDLE_PLAN.md`'s "Workspace = the existing editor, polish as needed" (Stage 3). When the two overlap, the data contract lives in `BUNDLE_PLAN.md`; the surface/layout lives here.

---

## 1. Purpose

Own the redesign of the bundle admin surface — `AdminBundlesView.html` (+ its controllers in `WebAppBundles.js`). The current view grew incrementally; this doc is the home for a considered UI/UX pass.

## 2. Scope

**In scope (this doc):**
- Layout of the Bundle Management dashboard (stats, action buttons).
- The slot editor UX (add/edit/reorder slots, per-slot SKU + qty + criteria, EN/HE text).
- The health/alerts panel (today an unused low-inventory panel — see Stage 7 note below).
- In-view navigation, mobile behaviour, results/diff panels.

**Out of scope (owned by `BUNDLE_PLAN.md`):**
- Bundle data model (`SysBundles`/`SysBundleSlots`), the derive, serializer (`exportBundleWoosb`), export worklist/diff (`buildExportTable`), cost/profit (`cpm_Cost`/`wpm_ProfitRate`).
- These provide the data contracts the UI renders; change requests against them go to `BUNDLE_PLAN.md`.

## 3. Current state (snapshot 2026-06-07, for grounding)

`AdminBundlesView.html` sections:
- **Bundle Management dashboard** — stats row (total / active / draft / archived / needs-attention) + action buttons: Update Composition, Review Stock, Validate EN/HE Parity, **Export** (added @234).
- **Health alerts panel** (`#health-alerts-container`) — low-inventory replacement suggestions; this is the **"unused alert view"** that `BUNDLE_PLAN.md` Stage 7 plans to replace with a proactive suggestion view. Coordinate with that stage.
- **Bundle list** — table of bundles, Edit per row.
- **Slot editor** — Add Text / Add Product, per-slot SKU + qty + criteria (category, price band, intensity/complexity/acidity, nameContains, exclusive, qty-variable), EN/HE text; slot edit via modal-overlay.
- Backend: `WebAppBundles.js` controllers → `BundleService.js`.

## 4. Plan-mandated UI touches to fold in

From `BUNDLE_PLAN.md` (these are already specced at the data level; the redesign should incorporate their surfaces):
- **Profit in the selector** — show retail price + `wpm_ProfitRate` on candidate products (Stage 3).
- **As-presented price/profit** — bundle price (discount applied) and margin (Stage 3).
- **Optional / qty-variable authoring toggle** — so ops can author the `optional` flag per slot (Stage 3; the field is now re-derived from web each refresh — see `BUNDLE_PLAN.md` Stage 3 fix 2026-06-07 — so an editor toggle is the authoring path, exported same session).
- **Button-row consolidation** — Pull Bundle Data → Update Composition → Review Stock → Validate Parity → Export (Export shipped @234; Pull Bundle Data is Stage 5, not built).
- **Stage 7 suggestion view** — replaces the unused alert panel with per-bundle recommended composition (capstone).

## 5. Conventions (hard rules)

UI work here MUST follow `jlmops/CLAUDE.md`:
- Copy existing patterns exactly; never invent button classes (grep `class="btn` first).
- Modals use the `modal-overlay` pattern, not Bootstrap `$().modal()`.
- Notifications/confirms via `TaskWidgets.toast` / `TaskWidgets.confirm` — never native `alert()`/`confirm()`.
- Edit config via `config/*.json` → `generate-config.js`; never `SetupConfig.js` directly.

## 6. Redesign goals (user interview, 2026-06-07)

- **Daily-workday surface.** Bundles are key to the business; the view is opened every workday. THE question it must answer in <5 seconds: **which bundles need a push to web.** Everything else is secondary.
- **Desktop-first.** Mobile use is "in a pinch" only, and its real job — *verify nothing needs updating* — moves to the **dashboard** (task badge), requiring zero visits to this view.
- **Batch habit.** When updating, the user handles ALL bundles needing work in one sitting. Design for sequential row-by-row clearing, not one-off edits.
- **Export pattern (user decision):** produce a **CSV via the product-detail export sequence, auto-opened as a new sheet**; user copies from the sheet tab and pastes into the web product tab without losing track. The flow is **self-correcting daily** (the derive re-diffs), so no paste-verification step.
- **Scale:** 14 bundles today, each a paired EN+HE pair. Small — optimize for scan speed, not pagination.
- **Editing is secondary but must become intuitive** — replace today's row-by-row, per-language slot CRUD.

## 7. Target design

### 7.1a Parity dropped (2026-06-07, user call)
EN/HE **parity is no longer a status**. Under jlmops-as-source-of-truth the composition is authored once and the serializer derives BOTH the EN and HE woosb from it (`exportBundleWoosb`), so EN/HE cannot diverge in ops; any web-side EN/HE drift is overwritten by the next export (which pushes both halves together) — i.e. it is **subsumed by "Needs export" and self-correcting**. So: no Parity chip, no Parity advisory. **The parity surface is REMOVED @260 (Stage 4 cleanup):** the "Validate EN/HE Parity" button + its frontend handler, the `WebAppBundles_validateParity` controller, and `BundleService.validateAllBundleParity` + `_validateBundlePairParity` (+ the orphaned `_splitIntoSections` helper) are all deleted. The export/diff path keeps its own EN↔HE id resolution (it never depended on these). Wherever §7.1/§7.3 below list "parity" as an advisory or chip, treat it as struck.

### 7.1b Dashboard bundle rows consolidated (2026-06-07, user call)
On the admin dashboard Products widget, **"Bundle Critical" and "Bundle Low" rows are removed** — **"Bundles: Needs Push"** is the single bundle signal there. Stock-driven composition changes flow into Needs Push under the Stage 7 model (jlmops examines stock and supplies the corrected bundle), so the separate stock rows are redundant on the dashboard. `HousekeepingService.checkBundleHealth` still creates the underlying `task.bundle.critical_inventory` / `task.bundle.low_inventory` tasks (they remain in the task workbench); revisit whether to stop creating them when Stage 7 lands.

### 7.1c Discount is WC-managed (2026-06-07, user call)
**Discount is set manually on the web (WPClever), not in jlmops.** jlmops does not author, control, or push it — resolving the earlier UI-plan ↔ `BUNDLE_PLAN` (line 192) conflict in favor of WC-managed. Facts (verified against `schema.data.WebProdM`):
- The web discount **IS imported** every sync, as a *separate* field (not part of `woosb_ids`): `wpm_WoosbDiscount`, `wpm_WoosbDiscountAmount`, `wpm_WoosbCustomPrice`, `wpm_WoosbDisableAutoPrice` (+ `wpm_RegularPrice`/`wpm_SalePrice`) in WebProdM.
- The §7.4 header-strip "discount" field is **read-only display**, never editable; no export path carries discount (the woosb serializer is composition-only).
- **Margin — fixed @256/@257 (a deeper gap than first thought).** The earlier "the discount IS imported every sync" claim was WRONG: the live REST pull only captured `woosb_ids` on the main product (`WooProductPullService.js:170`); the four discount meta fields were captured **only on the HE translation path** (`:411-417`), so `wpm_WoosbDiscount`/`Amount`/`CustomPrice`/`DisableAutoPrice` in WebProdM stayed **blank**. Fixes: **@256** — `_calculateBundlePrice(bundle, slots, priceMap, webDiscount)` reads the bundle's own WOOSB row (keyed by `wpm_ID` = bundleId) via `_buildBundleDiscountMap` + `_bundleDiscountFromWeb`: precedence (1) `wpm_WoosbDisableAutoPrice` → fixed `wpm_WoosbCustomPrice`; (2) `wpm_WoosbDiscount` on → `wpm_WoosbDiscountAmount` off the member sum (`'%'`-suffixed = percentage, else fixed amount — **user-confirmed fixed 2026-06-07**); (3) else none. Applied in `getBundleWithSlots` (editor) + `getAllBundles` (list); read-only, never pushed. **@257** — main-product pull now captures the four discount fields (→ `wps_*` → `wpm_*` via the existing staging→master map); **needs one full API Pull to populate**. Also @257: a manually-set `sb_DiscountPrice` (final price) now overrides the WOOSB discount — a test/override hook (reimport re-blanks it).

### 7.1 Status model — one status, computed daily, cached
"**Needs export**" has a single correct definition: serialized ops woosb ≠ web `wpm_WoosbIds` (the `buildExportTable` diff, `BUNDLE_PLAN.md` Stage 3). No new flags, no `sb_PendingExport`-style recorded state — **status is recomputed, never recorded**, which is what makes the whole flow self-correcting. Compute per-bundle `needsPush` + count in **daily housekeeping immediately after `refreshBundleComposition`** (diff maximally fresh; cheap at n=14); cache it so the view mounts instantly (no N+1 — the root-cause fix stays with `PERFORMANCE_OPTIMIZATION_PLAN.md`). Advisory states, strictly subordinate: **parity** > **low stock** > **suggestion** (Stage 7, cached overnight). **OK = silence** (no badge).

### 7.2 Task + dashboard tie-in
When the daily diff count > 0, housekeeping opens (or updates the count on) **one batch task** `task.bundles.push_pending` — never per-bundle (noise at n=14; the user clears all in one sitting). It surfaces on the admin dashboard as "Bundles: N need push" — that IS the mobile verify-case. **Producing the export file auto-closes the task server-side.** Edge cases (exported-but-never-pasted, partial paste, re-edit after export) all leave ops≠web, so tomorrow's diff re-detects and re-opens — no bookkeeping.

### 7.3 View IA — publish queue, not health monitor
- **One flat status-sorted list** (no cards, no tier grouping at n=14), **one row per logical EN+HE pair** (`SysBundles` is already pair-shaped). Needs-export rows pinned on top.
- Row contents: name EN (HE as muted second line) · type (derived, a column not a structure) · status badges · as-presented price + margin (Stage 3 data).
- **Count-bearing filter chips** replace the 5-stat row: All / Needs export / Parity / Stock / OK.
- **The low-inventory alerts panel is REMOVED** (never used; its replacement-suggestion content folds into the per-bundle deficiency strip now, and the Stage 7 suggestion view later).
- **Row click reveals the editor in place** (UI_T2_1 Stage D pattern; not a drawer — batch clearing wants the queue visible above). Detail opens with a **deficiency strip** (what changed / parity specifics / stock) above the composition.

### 7.4 Editor — single composition sheet, authored once for EN+HE
- **Header strip inline** atop the editor (no modal): name EN / name HE / status / discount (**read-only, WC-managed — see §7.1c**) / min-profit-rate; **type renders as a derived read-only badge** (§1.1: `sb_Type` is a cache).
- **One ordered composition list** replaces the slot-list/detail split: text slots = inline-editable section headers; product rows = ↑↓ reorder (deliberately not drag — no new component at n=14), qty stepper with **qty-0 as a first-class "Flexible" pill** (never an error), name + SKU + price + `wpm_ProfitRate`, per-slot criteria (incl. the Stage 3 **optional toggle**) behind a ▸ disclosure.
- **Product picker = ModalOverlay** search over `getEligibleProducts`, showing price + profit.
- **EN+HE authored once:** HE name resolves via the translation pair; per-row parity badges from `validateParity` results.

### 7.5 Draft + atomic save (kills commit-per-click)
Today every slot edit commits immediately and deletes are one confirm from gone. Instead: edits mutate a **client-side draft**; deletes render struck-through with Undo; one **Save Composition** commits atomically via a **new backend `WebAppBundles_saveComposition(bundleId, header, slots[])`** (contract owned by `BUNDLE_PLAN.md`), with `TaskWidgets.confirm` listing deletions. Draft mirrors to `sessionStorage` per `RELOAD_RESILIENCE_PLAN.md` A0 + `beforeunload` desktop seatbelt. After save, the row shows "differs from web — export pending" (which is simply true, via the diff).

### 7.6 Export UX
Export button: run the fresh diff + the targeted out-of-stock failsafe (`BUNDLE_PLAN.md` §3.1) → **generate the CSV through the product-detail export sequence and auto-open it as a new sheet** (user decision §6) — one row per bundle, EN and HE woosb cells side by side. File production **auto-closes** `task.bundles.push_pending`. Optional nicety: in-sheet/in-session strikethrough tracking only — no persisted "pasted" state.

## 8. UI_T2_1 disposition
- **Absorbed:** Stage A (Bootstrap modal → ModalOverlay), Stage B (filter chips — re-keyed to the §7.1 status model), Stage C (action footer order: Pull → Update Composition → Review Stock → Validate Parity → Export), Stage D (editor hidden until row click).
- **Superseded:** the low-stock row-badge IA (stock is now a subordinate advisory) and the old editor stages (replaced by the §7.4 composition sheet). Mark `UI_T2_1_admin_bundles.md` superseded-by-this-doc when Phase 1 ships.

## 9. Phased build (each independently shippable; per-phase user go)
- **Phase 1 — Queue & status. ✅ COMPLETE @245→@249.** 1a-i cached push status (`WebAppBundles_getPushStatus`) @245; 1a-ii `task.bundles.push_pending` singleton (housekeeping opens, Export action closes) + dashboard "Bundles: Needs Push — N" @246; 1b needs-export filter chips (All/Needs export/OK) + status-sorted list (needs-export pinned top, EN+HE muted line) + alerts panel removed @247; 1c row-click editor in place + deficiency strip @248. (Also @249: editor price-bar fix — backend `_calculateBundlePrice`, qty-0 skipped, no phantom savings.) Decisions folded in: parity dropped (§7.1a), dashboard Bundle Critical/Low removed (§7.1b), discount WC-managed (§7.1c).
- **Phase 2 — Export UX. ✅ COMPLETE @250.** Export button → `BundleService.exportBundlesToSheet` (reuses `buildExportTable` diff) creates a Google Sheet (Bundle · EN woosb · HE woosb · Warnings) via the product-detail export sequence (`SpreadsheetApp.create` → move to `system.folder.jlmops_exports`), frontend auto-opens it (window.open + "Open Sheet" link fallback). Out-of-stock failsafe warnings flow into the Warnings column. Task auto-close moved from `buildExportTable` to the real export action `WebAppBundles_exportBundlesToSheet` (the read-only diff is now side-effect free).
- **Phase 3 — Composition sheet. ✅ SHIPPED @251 (smoke pending).** Backend (committed `70fd3c0`): `BundleService.saveComposition(bundleId, header, slots[])` + `WebAppBundles_saveComposition` — atomic batch commit reusing createSlot/updateSlot/deleteSlot, order from list position, discount never written (§7.1c), returns re-derived bundle. Frontend @251 replaced the two-pane editor with the §7.4/§7.5 composition sheet: header strip (name EN/HE, status, type badge, read-only price summary); single ordered list (text headers w/ inline EN/HE + style; product rows w/ ↑↓ reorder, qty stepper + qty-0 Flexible pill, name/SKU/price/profit, **full criteria editable** behind ▸ disclosure incl. qtyVariable "optional" toggle); client draft (every edit mutates `draft`, nothing commits till Save) + per-row Undo on delete + atomic Save Composition (confirm lists removals); product picker = ModalOverlay search over `getEligibleProducts` (price+profit, client text-filter); `sessionStorage` draft mirror (key `jlmops.bundleCompDraft.v1.<id>`) + `beforeunload` seatbelt. **Backend enablers added this pass (data contract):** `getBundleWithSlots` enriches product slots with `productName`/`productPrice`/`profitRate` from the same WebProdM read; `getEligibleProducts` accepts `options.draftSlot` (criteria for an unsaved/new row) + `options.excludeSKUs` (other draft rows); `createSlot` id gains a per-execution counter suffix so a batch save can't collide on a same-ms `SLOT-${Date.now()}` id. Save blocks if a live product row has no SKU (would push a blank woosb id). **Decisions (§11 resolved):** full criteria editable (no regression); **min-profit-rate deferred** (per-bundle override is a later add — `BUNDLE_PLAN` line 175 — and the as-presented profit math isn't live; §7.1c). Post-save needsPush is flagged optimistically client-side (authoritative recompute = overnight housekeeping).
- **Phase 4 — Stage 7 hook.** Deficiency strip grows the recommended-composition content when `BUNDLE_PLAN.md` Stage 7 lands. This doc owns the surface only.

## 10. New pieces required
- `WebAppBundles_saveComposition(bundleId, header, slots[])` — atomic batch commit (data contract → `BUNDLE_PLAN.md`).
- Housekeeping `needsPush` computation + cache (data contract → `BUNDLE_PLAN.md`).
- `task.bundles.push_pending` template + auto-close-on-export hook.
- No new UI framework: ModalOverlay, TaskWidgets, chips, steppers cover everything.

## 11. Open for build
- Per-slot criteria editing depth in Phase 3 v1: full criteria set editable, or read-only display with edit deferred?
- Export CSV exact column shape (EN/HE side-by-side confirmed as intent; final contract per `BUNDLE_PLAN.md` Stage 3).
- Header strip: include min-profit-rate in v1, or defer until Stage 4 profit data is fully live?

*(Design provenance: three parallel Dispatch design agents — workflow/UX, IA, interaction — 2026-06-07, converged with no conflicts; user interview + mockup review same day.)*
