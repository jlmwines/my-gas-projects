# Admin Bundles View — UI Overhaul Plan

**Status:** STUB — owner doc, created 2026-06-07. Scope to be developed by **Dispatch**.
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

## 6. Open — Dispatch to define

- The concrete redesign goals / pain points (what's wrong with the current layout/UX) — **TBD by Dispatch.**
- Proposed target design + phased implementation.
- Which Stage 7 elements to build here vs leave to `BUNDLE_PLAN.md`.

_(Dispatch: develop sections 6 into a real plan; keep sections 2–5 as the boundary + grounding.)_
