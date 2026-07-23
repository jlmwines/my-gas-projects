# UI Tier 2.1 — AdminBundlesView IA restructure

**Session ID:** UI_T2_1
**Status:** Superseded 2026-06-07 by `ADMIN_BUNDLES_UI_PLAN.md`'s deeper three-lens redesign of the same view (`AdminBundlesView`) — that plan is now the owning doc for AdminBundlesView UI work. This IA-restructure was never shipped. Plan v1 (2026-05-28) findings, kept for reference:
- Slot Edit Modal is Bootstrap modal (CLAUDE.md violation) — folded into session as Stage A.
- Health Alerts card is NOT a count duplicate — it's a working replacement-selection workflow. **Do not retire.** Repurposed: keep workflow, drop count duplication, hide when no alerts.
- Row-level parity badge deferred — parity check writes to global panel, not per-bundle state; would need backend change. Out of scope.
- Bundle Editor card's internal col-md-4 / col-md-8 layout already works; only change is hide-until-row-click.

**Parent:** `UI_AUDIT.md` §5 Tier 2.1
**Estimated effort:** 1 session, 4 staged deploys.
**Depends on:** Nothing structural. Independent.

## Session goal

Restructure AdminBundlesView so the workflow answers "which bundle do I touch today?" at a glance:
- Row-level "Low Stock" badges give the at-a-glance health status (currently only available as an aggregate count on the dashboard's Bundle Critical / Bundle Low rows).
- Filter chips (All / Needs Attention / Active / Draft / Archived) make "Needs Attention" a row filter, not a count.
- Three global toolbar actions move into a System Actions footer (clear they're global ops, not row-actions).
- Bundle Editor hidden until row click (no more empty workbench card).
- Health Alerts repurposed and hidden when no alerts (no more "Loading health data..." then "All bundle slots have adequate inventory" footer).
- Bootstrap modal → modal-overlay (CLAUDE.md compliance).

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Read `jlmops/AdminBundlesView.html` end-to-end (~1201 lines). Note the JS structure: `init()` → `loadCategories / loadStats / loadBundleList / loadHealthAlerts` parallel fan-out at `:186-191`.
5. Read `jlmops/CLAUDE.md:80-95` (modal-overlay pattern).
6. Read `LibraryView.html:267-285` (filter chips precedent for the chip atom shape).
7. Open `.claude/bugs.md` — confirm no open bug on AdminBundlesView that would conflict.

## Stage A — Convert Slot Edit Modal from Bootstrap to modal-overlay

**Why first.** CLAUDE.md compliance prerequisite. Independent of IA restructure. Lowest risk — same workflow, different modal mechanics.

**Files.**
- Edit `jlmops/AdminBundlesView.html` — modal markup + open/close JS + add minimal CSS.

**Anchors.**
- Slot Edit Modal markup: `:141-159` (uses `class="modal fade"`, `data-dismiss="modal"` — Bootstrap modal).
- Existing modal-overlay CSS in same file: `:1-5` (already has `modal-overlay`, `modal-container`, `form-body` — partial set; need to extend).
- Precedent for full modal-overlay structure: `AdminProductsView.html` (any of the seven modals — they use the project's standard).
- Bootstrap modal trigger calls in JS: need to grep within file (see verification below).

**Pre-change verification (deterministic, run during Stage A start):**
- Grep `$('#slotEditModal').modal` within `AdminBundlesView.html` — counts open/close call sites. Expected: 2-4 (open from edit slot click, close after save, close on cancel).

**Changes.**

1. **Extend modal-overlay CSS at `:1-5`** to match project standard fully:
   ```html
   <style>
   .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: flex-start; padding-top: 80px; overflow-y: auto; }
   .modal-container { background: white; width: 90%; max-width: 800px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
   .modal-header { padding: 16px 20px; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; }
   .modal-header h5 { margin: 0; }
   .modal-footer { padding: 12px 20px; border-top: 1px solid #dee2e6; display: flex; justify-content: flex-end; gap: 8px; }
   .form-body { padding: 20px; }
   </style>
   ```
   (`max-width: 800px` matches modal-lg behavior the slot editor needs.)

2. **Replace Slot Edit Modal markup (`:141-159`)** with modal-overlay structure:
   ```html
   <!-- before -->
   <div class="modal fade" id="slotEditModal" tabindex="-1" aria-hidden="true">
     <div class="modal-dialog modal-lg">
       <div class="modal-content">
         <div class="modal-header">
           <h5 class="modal-title" id="slotEditModalTitle">Edit Slot</h5>
           <button type="button" class="close" data-dismiss="modal" aria-label="Close">
             <span aria-hidden="true">&times;</span>
           </button>
         </div>
         <div class="modal-body" id="slotEditModalBody"></div>
         <div class="modal-footer">
           <button type="button" class="btn" data-dismiss="modal">Cancel</button>
           <button type="button" class="btn" id="btn-save-slot">Save Slot</button>
         </div>
       </div>
     </div>
   </div>

   <!-- after -->
   <div class="modal-overlay" id="slot-edit-modal">
     <div class="modal-container">
       <div class="modal-header">
         <h5 id="slot-edit-modal-title">Edit Slot</h5>
         <button type="button" class="close" id="btn-close-slot-modal" aria-label="Close">
           <span aria-hidden="true">&times;</span>
         </button>
       </div>
       <div class="form-body" id="slot-edit-modal-body"></div>
       <div class="modal-footer bg-light">
         <button type="button" class="btn" id="btn-cancel-slot">Cancel</button>
         <button type="button" class="btn" id="btn-save-slot">Save Slot</button>
       </div>
     </div>
   </div>
   ```

3. **Replace Bootstrap modal open calls.** Grep `$('#slotEditModal').modal('show')` within the file. For each:
   ```javascript
   // before:
   $('#slotEditModal').modal('show');
   // after:
   document.getElementById('slot-edit-modal').style.display = 'flex';
   ```

4. **Replace Bootstrap modal close calls.** Grep `$('#slotEditModal').modal('hide')` within the file. For each:
   ```javascript
   // before:
   $('#slotEditModal').modal('hide');
   // after:
   document.getElementById('slot-edit-modal').style.display = 'none';
   ```

5. **Wire close + cancel buttons in `bindEvents()` (around `:207-215`)** — add:
   ```javascript
   document.getElementById('btn-close-slot-modal').addEventListener('click', closeSlotModal);
   document.getElementById('btn-cancel-slot').addEventListener('click', closeSlotModal);
   ```
   And helper:
   ```javascript
   function closeSlotModal() {
     document.getElementById('slot-edit-modal').style.display = 'none';
   }
   ```

6. **Update title-setting JS** wherever it sets `#slotEditModalTitle` text: change selector to `#slot-edit-modal-title`. Similarly `#slotEditModalBody` → `#slot-edit-modal-body`.

**Smoke A.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T2.1 stage A: convert AdminBundles Slot Edit Modal to modal-overlay"`.
- Open AdminBundles. Click any bundle's Edit → click a slot → confirm slot edit modal opens (centered overlay, dim background).
- Click close (×), then re-open. Click Cancel, confirm closes.
- Click into a slot, edit a value, click Save Slot — confirm save fires and modal closes.
- Browser console: zero errors. No `$ is not defined` / `.modal is not a function` errors.

**Rollback A.**
- Git revert + redeploy.

**Risk A.**
- Low. Bootstrap modal classes leftover in markup (if any missed) render as static divs (since Bootstrap modal CSS won't trigger without the JS open call). Smoke catches any miss.

**Commit A.** `ui(AdminBundles): convert Slot Edit Modal from Bootstrap to modal-overlay (CLAUDE.md compliance)`

## Stage B — Add row-level "Low Stock" badges + filter chips

**Why second.** This is the core of the IA fix: making "Needs Attention" actionable per-row. Combines the data wiring (use existing health data to decorate rows) with the filter chip atom (precedent: LibraryView).

**Files.**
- Edit `jlmops/AdminBundlesView.html` — markup + CSS + JS state.

**Anchors.**
- Bundle list table: `:46-62`.
- `renderBundleList` function: `:268-309`.
- `loadHealthAlerts` populates `healthData` array at `:323` — same data used to build replacement workflow.
- Filter chip CSS precedent: `LibraryView.html` (the kit's `tw-chip` class — but this view doesn't include TaskWidgets yet; either include the kit or use local CSS).
- Decision: define filter chips locally in this session (don't introduce TaskWidgets adoption — that's Tier 2.6). Filter chip CSS matches `tw-chip` shape so future kit migration is straightforward.

**Changes.**

1. **Add filter-chip CSS** to the `<style>` block:
   ```css
   .bundle-filter-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
   .bundle-filter-chip { display: inline-block; padding: 4px 12px; border-radius: 14px; font-size: 12px; background: #f1f3f5; color: #495057; border: 1px solid #dee2e6; cursor: pointer; }
   .bundle-filter-chip.active { background: #495057; color: #fff; border-color: #495057; }
   .bundle-row-badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 11px; font-weight: 600; margin-left: 6px; }
   .bundle-row-badge.low-stock { background: #f8d7da; color: #721c24; }
   .bundle-row-badge.critical { background: #dc3545; color: #fff; }
   ```

2. **Add filter chips markup** above the bundle list table (between `:42` stats row close and `:44` table-responsive open):
   ```html
   <div class="bundle-filter-bar" id="bundle-filter-bar">
     <span class="text-muted small mr-2">Filter:</span>
     <span class="bundle-filter-chip active" data-filter="all">All</span>
     <span class="bundle-filter-chip" data-filter="needs-attention">Needs Attention</span>
     <span class="bundle-filter-chip" data-filter="active">Active</span>
     <span class="bundle-filter-chip" data-filter="draft">Draft</span>
     <span class="bundle-filter-chip" data-filter="archived">Archived</span>
   </div>
   ```

3. **Extend state** at `:174-180`:
   ```javascript
   var allBundles = [];        // cached full list from loadBundleList
   var lowStockBundleIds = new Set();  // built from healthData
   var activeFilter = 'all';
   ```

4. **Modify `loadBundleList`** at `:253-266` to cache:
   ```javascript
   function loadBundleList() {
     google.script.run
       .withSuccessHandler(function(result) {
         if (result.error) { console.error('Error loading bundles:', result.error); return; }
         allBundles = result.data || [];
         applyFilterAndRender();
       })
       .withFailureHandler(function(err) { console.error('Failed to load bundles:', err); })
       .WebAppBundles_getAllBundles();
   }
   ```

5. **Modify `loadHealthAlerts`** at `:315-331` to build the `lowStockBundleIds` Set after data lands:
   ```javascript
   function loadHealthAlerts() {
     google.script.run
       .withSuccessHandler(function(result) {
         if (result.error) {
           document.getElementById('health-alerts-container').innerHTML = '<div class="text-danger">' + result.error + '</div>';
           lowStockBundleIds = new Set();
           applyFilterAndRender();
           return;
         }
         healthData = result.data || [];
         lowStockBundleIds = new Set(healthData.map(function(bd) { return bd.bundle.bundleId; }));
         renderHealthAlerts(healthData);
         applyFilterAndRender();  // re-render list with badges
       })
       .withFailureHandler(function(err) {
         document.getElementById('health-alerts-container').innerHTML = '<div class="text-danger">Failed to load health data</div>';
         lowStockBundleIds = new Set();
         applyFilterAndRender();
       })
       .WebAppBundles_getBundlesWithLowInventory();
   }
   ```

6. **Add filter + render helpers** (insert near `renderBundleList`):
   ```javascript
   function applyFilterAndRender() {
     var filtered;
     switch (activeFilter) {
       case 'needs-attention':
         filtered = allBundles.filter(function(b) { return lowStockBundleIds.has(b.bundleId); });
         break;
       case 'active':
         filtered = allBundles.filter(function(b) { return b.status === 'Active'; });
         break;
       case 'draft':
         filtered = allBundles.filter(function(b) { return b.status === 'Draft'; });
         break;
       case 'archived':
         filtered = allBundles.filter(function(b) { return b.status === 'Archived'; });
         break;
       default:
         filtered = allBundles;
     }
     renderBundleList(filtered);
   }
   ```

7. **Modify `renderBundleList`** at `:288-296` to add the low-stock badge after the Name (EN) column:
   ```javascript
   // inside the .map row builder, change the Name (EN) <td>:
   var badge = lowStockBundleIds.has(b.bundleId)
     ? ' <span class="bundle-row-badge low-stock">Low Stock</span>'
     : '';
   // ...
   '<td>' + (b.nameEn || '-') + badge + '</td>' +
   ```

8. **Wire filter chip clicks** in `bindEvents()`:
   ```javascript
   document.querySelectorAll('.bundle-filter-chip').forEach(function(chip) {
     chip.addEventListener('click', function() {
       document.querySelectorAll('.bundle-filter-chip').forEach(function(c) { c.classList.remove('active'); });
       chip.classList.add('active');
       activeFilter = chip.dataset.filter;
       applyFilterAndRender();
     });
   });
   ```

**Smoke B.**
- `clasp push`. Deploy.
- Open AdminBundles. Confirm:
  - Filter chips visible above bundle list.
  - Default "All" chip is active.
  - Bundles with low stock have inline "Low Stock" badge next to Name (EN).
  - Click "Needs Attention" → table filters to only low-stock bundles.
  - Click "Active" → filters to active only.
  - Click "All" → restores full list.
  - Console: zero errors. Network tab: no extra round-trips on filter clicks (purely client-side).

**Rollback B.**
- Git revert + redeploy.

**Risk B.**
- Low. Filter is purely client-side over cached data; bundle list backend untouched. Badge rendering depends on health data load completing — if it fails, badges are absent but filter still works.

**Commit B.** `ui(AdminBundles): add row-level Low Stock badges + filter chips (All / Needs Attention / Active / Draft / Archived)`

## Stage C — Move toolbar actions to System Actions footer; rename + conditionally hide Health Alerts

**Why third.** Reframes the three global ops (Update Composition / Review Stock / Validate EN/HE Parity) as clearly-global. Repurposes the Health Alerts card title to reflect its actual function (Suggest Replacements). Hides when no alerts.

**Files.**
- Edit `jlmops/AdminBundlesView.html` — markup + JS conditional display.

**Changes.**

1. **Remove three buttons from Bundle Management card header (`:13-17`)** — leave the `<h5>` alone, drop the action div:
   ```html
   <!-- before -->
   <div class="card-header d-flex justify-content-between align-items-center" style="background: transparent;">
     <h5>Bundle Management</h5>
     <div>
       <button id="btn-update-composition" class="btn btn-sm mr-2">Update Composition</button>
       <button id="btn-review-stock" class="btn btn-sm mr-2">Review Stock</button>
       <button id="btn-validate-parity" class="btn btn-sm">Validate EN/HE Parity</button>
     </div>
   </div>

   <!-- after -->
   <div class="card-header" style="background: transparent;">
     <h5>Bundle Management</h5>
   </div>
   ```

2. **Add a System Actions footer card-section** just before the closing `</div></div></div>` of the Bundle Management card (after the table-responsive close at `:62`):
   ```html
   <div class="card-footer bg-light">
     <span class="text-muted small mr-3">System actions (run against all bundles):</span>
     <button id="btn-update-composition" class="btn btn-sm mr-2">Run Composition Refresh</button>
     <button id="btn-review-stock" class="btn btn-sm mr-2">Run Stock Review</button>
     <button id="btn-validate-parity" class="btn btn-sm">Run EN/HE Parity Check</button>
   </div>
   ```
   The button IDs stay the same so the existing `bindEvents()` wiring at `:208-210` continues to work — no JS changes needed.

3. **Rename Health Alerts card title (`:73`)** from "Low Inventory Alerts" to "Suggest Replacements":
   ```html
   <!-- before -->
   <h5>Low Inventory Alerts</h5>
   <!-- after -->
   <h5>Suggest Replacements</h5>
   ```

4. **Conditionally hide the Health Alerts card when no alerts.** Wrap the whole card (`:68-83`) in an outer div with id, and toggle via JS:
   ```html
   <div class="row mb-4" id="health-alerts-section" style="display: none;">
     <div class="col-12">
       <div class="card">
         <div class="card-header d-flex justify-content-between align-items-center">
           <h5>Suggest Replacements</h5>
           <button id="btn-apply-replacements" class="btn btn-sm" disabled>Apply Selected Replacements</button>
         </div>
         <div class="card-body">
           <div id="health-alerts-container"></div>
         </div>
       </div>
     </div>
   </div>
   ```

5. **Modify `renderHealthAlerts`** at `:333-342` — show/hide section based on data:
   ```javascript
   function renderHealthAlerts(data) {
     var section = document.getElementById('health-alerts-section');
     var container = document.getElementById('health-alerts-container');
     selectedReplacements = [];

     if (!data || data.length === 0) {
       section.style.display = 'none';
       document.getElementById('btn-apply-replacements').disabled = true;
       return;
     }
     section.style.display = '';
     // ... existing render logic continues
   }
   ```

**Smoke C.**
- `clasp push`. Deploy.
- Open AdminBundles. Confirm:
  - Bundle Management card has no header action buttons (clean h5 only).
  - System Actions footer at bottom of card shows three relabelled buttons.
  - Click each: same global ops fire as before (Update Composition, Review Stock, Validate EN/HE Parity).
  - If health data has alerts: "Suggest Replacements" card visible with the alert list.
  - If health data is empty: card hidden entirely (no "Loading..." placeholder, no "All bundle slots have adequate inventory" footer).

**Rollback C.**
- Git revert + redeploy.

**Risk C.**
- Low. Buttons retain their IDs and JS bindings.

**Commit C.** `ui(AdminBundles): move 3 system actions to footer + rename "Low Inventory Alerts" → "Suggest Replacements" + hide when empty`

## Stage D — Hide Bundle Editor card until row click

**Why last.** No-row-selected workbench is structural noise. Reveal on row click.

**Files.**
- Edit `jlmops/AdminBundlesView.html` — JS conditional display.

**Changes.**

1. **Wrap Bundle Editor card row (`:86-137`)** with `display: none` default:
   ```html
   <div class="row" id="bundle-editor-section" style="display: none;">
   ```

2. **Show on row click** — modify the row-click handler in `renderBundleList` at `:302-308`:
   ```javascript
   // current:
   tbody.querySelectorAll('tr').forEach(function(row) {
     row.addEventListener('click', function(e) {
       if (e.target.classList.contains('btn-edit-bundle')) {
         loadBundleForEditing(row.dataset.bundleId);
       }
     });
   });

   // updated:
   tbody.querySelectorAll('tr').forEach(function(row) {
     row.addEventListener('click', function(e) {
       if (e.target.classList.contains('btn-edit-bundle')) {
         document.getElementById('bundle-editor-section').style.display = '';
         loadBundleForEditing(row.dataset.bundleId);
         document.getElementById('bundle-editor-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
       }
     });
   });
   ```

3. **Hide on Editor close** — net-new "Close Editor" button in editor card header. Append to the actions block at `:91-95`:
   ```html
   <button id="btn-close-editor" class="btn btn-sm">Close</button>
   ```
   And handler in `bindEvents()`:
   ```javascript
   document.getElementById('btn-close-editor').addEventListener('click', function() {
     document.getElementById('bundle-editor-section').style.display = 'none';
     currentBundleId = null;
     currentBundle = null;
   });
   ```

**Smoke D.**
- `clasp push`. Deploy.
- Open AdminBundles. Confirm:
  - Bundle Editor card NOT visible by default.
  - Click any bundle row's Edit button → editor card slides into view, populated with that bundle's slot list + preview.
  - Click Close in editor card header → editor card hides.
  - Re-click a different bundle's Edit — editor appears with the new bundle.
  - Smooth-scroll behavior on first edit-click (gives mobile users a clear signal the editor is below).

**Rollback D.**
- Git revert + redeploy.

**Risk D.**
- Low. Editor card display state is purely CSS; backend untouched.

**Commit D.** `ui(AdminBundles): hide Bundle Editor card until row click; smooth-scroll to editor on open; Close button hides`

## Session-end checklist

After all 4 stages committed + deployed:

1. **Git log review.** Four fix commits.
2. **Live smoke (full flow):**
   - Open AdminBundles. Confirm: stats row, filter chips, bundle list with low-stock badges, Suggest Replacements card (visible iff alerts exist), System Actions footer.
   - Click a bundle row → Bundle Editor appears.
   - Click a slot in the editor → Slot Edit Modal opens (modal-overlay), edit + save closes modal.
   - Filter to "Needs Attention" → only low-stock bundles remain.
   - Run "Run EN/HE Parity Check" from footer → action results panel appears with parity report.
   - Close editor → editor card hides.
3. **Browser console:** zero errors across full flow.
4. **Update `UI_AUDIT.md` §10 status:** mark T2.1 SHIPPED with deploy refs.
5. **Update `.claude/session-log.md`:** brief session note.
6. **CCP-UI audit:**
   - CCP-UI-1 (modal-overlay): Stage A — all `$().modal()` calls converted; no Bootstrap modals remain.
   - CCP-UI-3 (table pattern): bundle list table already used `table-sm`; preserved.
   - CCP-UI-5 (load-once + client-filter): Stage B — filter chips drive client-side filter over cached `allBundles`; zero round-trips on filter clicks.

## Notes for future sessions

- **Tier 3.3** (AdminBundles 4-call init consolidation) follows naturally — the four `init()` calls (`loadCategories / loadStats / loadBundleList / loadHealthAlerts`) collapse to one `WebAppBundles_getViewData()`. Tier 3.3 deep-dive will reference Stage B's `lowStockBundleIds` Set as still-applicable (the consolidated backend returns the same data structure; only the fetch path changes).
- **Row-level EN/HE parity badge** deferred — would require backend change to write parity result per-bundle. Revisit if parity issues become a frequent operator concern. Could ride a separate session that updates the parity check to write results to a SysConfig key per bundle (e.g. `bundles.parity.<bundleId>`) — out of scope for this audit.
- **Slot Edit Modal conversion (Stage A)** establishes the modal-overlay-from-Bootstrap recipe for Tier 5.1 (AdminContacts) and Tier 5.2 (AdminProducts). Same shape applies there.
