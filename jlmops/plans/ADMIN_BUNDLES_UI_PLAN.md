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
- **Header strip inline** atop the editor (no modal): name EN / name HE / status / discount / min-profit-rate; **type renders as a derived read-only badge** (§1.1: `sb_Type` is a cache).
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
- **Phase 1 — Queue & status.** Housekeeping `needsPush` cache + count; status-sorted list + chips; remove alerts panel; `task.bundles.push_pending` + dashboard surfacing. Depends on Stage 3 diff being live (it is).
- **Phase 2 — Export UX.** CSV-sequence auto-open-as-sheet; auto-close-task hook; out-of-stock failsafe wiring. (Export @234 exists; this re-plumbs its output + lifecycle.)
- **Phase 3 — Composition sheet.** Header strip; draft + atomic `saveComposition`; picker with price/profit; Flexible pill; criteria disclosure incl. optional toggle; sessionStorage draft.
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
