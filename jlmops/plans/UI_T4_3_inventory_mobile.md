# UI Tier 4.3 — ManagerInventoryView mobile pass

**Session ID:** UI_T4_3
**Status:** Plan v2 (2026-05-28). **Major UX re-plan post agent review.** v1 committed to `.responsive-stack` for Product Counts; UX agent flagged this as wrong workflow shape (card-stack means manager scrolls past 9 read-only fields per product to reach 3 inputs). v2 commits to **modal-per-product data entry** for Product Counts (the warehouse-floor workflow), keeping `.responsive-stack` for the simpler 4-column Brurya table.

**v2 resolved gaps:**
- Product Counts mobile workflow re-designed as tap-product-row → full-screen modal-overlay with SKU + Name + 3 input fields + Save + Next.
- Brurya table 4-col `.responsive-stack` adoption preserved from v1 — it's read-mostly with only one input column.
- Card-header button rows + Brurya autocomplete max-width fixes preserved from v1.
- **Depends on CCP-UI-8 helper** (`ModalOverlay.open(id)` / `.close(id)` with focus management) — this session can build it as Stage 0 if not already shipped.

**Parent:** `UI_AUDIT.md` §5 Tier 4.3
**Estimated effort:** 1 session, 3 staged deploys.
**Depends on:** Soft after T1.0 (Brurya autocomplete cache fix). Not blocking.

## Session goal

Manager Inventory works on phone for both workflows: Product Counts (enter counts in 3 fields per product walking the warehouse) and Brurya Stock Management (search + add + adjust quantities). Card headers wrap; Brurya autocomplete dropdown doesn't clip; both tables collapse to card-stacks.

## Session opening checklist

1. Working tree clean.
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Re-read `ManagerInventoryView.html:60-76` (Product Counts card header), `:79-97` (Brurya card header + autocomplete input-group), `:132-199` (Product Counts table template), `:614-626` (Brurya table template).
5. Confirm T1.0 Brurya cache shipped (autocomplete is faster post-T1.0 but plan works either way).
6. Mobile device or browser at 360px ready for smoke.

## Stage A — Card-header layout fixes (both cards)

**Why first.** Card-header buttons compress / overflow at narrow viewports today. Fix the layout container before changing table structures so the test results are visible immediately.

**Files.**
- Edit `jlmops/ManagerInventoryView.html` — CSS + tweaks to header div classes.

**Changes.**

### Part 1: Add a `<style>` block at top of file (or extend existing if present)

Add the following styles at top of `ManagerInventoryView.html` (after the opening `<div class="container-fluid">` at `:1`, inserting a new `<style>` block):

```html
<style>
  /* Wrap card-header button rows so they don't overflow at narrow widths */
  .card-header .header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Brurya add-product input-group: drop max-width on mobile so dropdown fits */
  @media (max-width: 768px) {
    .brurya-add-group {
      max-width: 100% !important;
      width: 100%;
    }
  }

  /* Brurya quantity input takes proportional width on desktop, full on mobile */
  .brurya-qty-input { width: 80px; }
  @media (max-width: 768px) {
    .brurya-qty-input { width: 100%; }
  }
</style>
```

### Part 2: Wrap the Product Counts card header buttons

Modify `:60-67`:

```html
<!-- before -->
<div class="card-header d-flex justify-content-between align-items-center" style="background: transparent; border-bottom: 1px solid rgba(0,0,0,.125);">
    <h5 class="mb-0">Product Counts</h5>
    <div>
      <button id="export-counts-btn" class="btn btn-light btn-sm mr-2" type="button">Export to Sheet</button>
      <button id="import-counts-btn" class="btn btn-light btn-sm mr-2" type="button">Import from Sheet</button>
      <button id="submit-selected-counts-btn" class="btn btn-light btn-sm" type="button" disabled>Submit Counts</button>
    </div>
</div>

<!-- after — outer flex wraps; button div uses new helper class -->
<div class="card-header d-flex flex-wrap justify-content-between align-items-center" style="background: transparent; border-bottom: 1px solid rgba(0,0,0,.125); gap: 8px;">
    <h5 class="mb-0">Product Counts</h5>
    <div class="header-actions">
      <button id="export-counts-btn" class="btn btn-light btn-sm" type="button">Export to Sheet</button>
      <button id="import-counts-btn" class="btn btn-light btn-sm" type="button">Import from Sheet</button>
      <button id="submit-selected-counts-btn" class="btn btn-light btn-sm" type="button" disabled>Submit Counts</button>
    </div>
</div>
```

`flex-wrap` on the outer allows the h5 + buttons to stack on narrow viewports. `gap: 8px` on outer + `header-actions` flex inside replaces the `mr-2` spacing (now consistent across button states).

### Part 3: Wrap the Brurya card header (more complex — 4 buttons + autocomplete)

Modify `:80-93`:

```html
<!-- before -->
<div class="card-header d-flex justify-content-between align-items-center" style="background: transparent; border-bottom: 1px solid rgba(0,0,0,.125);">
    <h5 class="mb-0"><i class="fas fa-warehouse mr-1"></i> Brurya Stock Management</h5>
    <div style="position: relative;">
        <div class="input-group input-group-sm" style="max-width: 300px;">
            <input type="text" id="brurya-add-product-input" class="form-control" placeholder="Product Name">
            <div class="input-group-append">
                <button id="brurya-add-product-button" class="btn btn-light" type="button">Add</button>
            </div>
        </div>
    </div>
    <button id="brurya-export-button" class="btn btn-light btn-sm mr-2" type="button">Export to Sheet</button>
    <button id="brurya-import-button" class="btn btn-light btn-sm mr-2" type="button">Import from Sheet</button>
    <button id="brurya-save-button" class="btn btn-light btn-sm" type="button">Save</button>
</div>

<!-- after — flex-wrap on outer; group autocomplete into its own div; replace inline max-width with brurya-add-group class -->
<div class="card-header d-flex flex-wrap justify-content-between align-items-center" style="background: transparent; border-bottom: 1px solid rgba(0,0,0,.125); gap: 8px;">
    <h5 class="mb-0"><i class="fas fa-warehouse mr-1"></i> Brurya Stock Management</h5>
    <div class="brurya-add-group input-group input-group-sm" style="position: relative; max-width: 300px;">
        <input type="text" id="brurya-add-product-input" class="form-control" placeholder="Product Name">
        <div class="input-group-append">
            <button id="brurya-add-product-button" class="btn btn-light" type="button">Add</button>
        </div>
    </div>
    <div class="header-actions">
      <button id="brurya-export-button" class="btn btn-light btn-sm" type="button">Export to Sheet</button>
      <button id="brurya-import-button" class="btn btn-light btn-sm" type="button">Import from Sheet</button>
      <button id="brurya-save-button" class="btn btn-light btn-sm" type="button">Save</button>
    </div>
</div>
```

Now on mobile the outer flex wraps to 3 rows (h5 / autocomplete group full-width / 3-button group with internal wrap). The `brurya-add-group` class triggers the mobile CSS (Part 1) to drop `max-width` on phones.

**Smoke A.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T4.3 stage A: Inventory card-headers wrap; Brurya autocomplete max-width drops on mobile"`.
- Desktop: open Manager Inventory. Both card headers render with h5 + buttons inline. Subtle difference vs pre-deploy: gap is now 8px instead of `mr-2` margins (consistent visual).
- Mobile: card headers wrap; autocomplete input takes full width; buttons wrap below. No clipping. No overflow.

**Rollback A.** Git revert + redeploy.

**Commit A.** `ui(ManagerInventory): card-headers flex-wrap + Brurya autocomplete max-width drops on mobile`

## Stage B (v2) — Product Counts: modal-per-product data entry on mobile

**Why this changed in v2.** UX agent flagged that `.responsive-stack` for a 12-column data-entry table on warehouse floor = manager scrolls past 9 read-only fields per product to reach 3 inputs. Card-stack adds scrolling, doesn't remove it. Real warehouse apps (Square, Lightspeed, Shopify POS) use tap-product → focused entry modal showing just the inputs that matter.

**v2 design.** On desktop, the 12-column table renders as before (no change). On mobile (≤768px), the table renders as a **compact list** showing just `Product Name | SKU | Status checkbox` per row. Tapping a row opens a **full-screen modal-overlay** with: SKU + Name (read-only header), Comax + Total + Brurya (read-only context, top of body), Storage + Office + Shop input fields (large 16px inputs, prominent), Vintage (actual) + Comment (the existing detail-row content, inline), Save button + "Save & next" button. Save closes the modal and moves to the next un-counted product.

**Files.**
- Edit `jlmops/ManagerInventoryView.html` — Product Counts table template + add modal markup + mobile-only show/hide.

**Changes.**

### Part 1: Add Product Counts modal markup

Insert near the bottom of the file (before the closing `</body>` or before the existing script block):

```html
<!-- Mobile-only count-entry modal (v2 T4.3) -->
<div class="modal-overlay" id="count-entry-modal" data-roles="manager">
  <div class="modal-container" style="max-width: 480px;">
    <div class="modal-header">
      <h5 id="count-entry-product-name">—</h5>
      <button type="button" class="close" id="btn-close-count-entry" aria-label="Close">&times;</button>
    </div>
    <div class="form-body">
      <div class="text-muted small mb-2"><span id="count-entry-sku">—</span></div>
      <div class="row text-center mb-3">
        <div class="col-4"><div class="small text-muted">Comax</div><div class="h5" id="count-entry-comax">—</div></div>
        <div class="col-4"><div class="small text-muted">Total</div><div class="h5" id="count-entry-total">—</div></div>
        <div class="col-4"><div class="small text-muted">Brurya</div><div class="h5" id="count-entry-brurya">—</div></div>
      </div>
      <div class="form-group">
        <label>Storage</label>
        <input type="number" class="form-control" id="count-entry-storage" inputmode="numeric">
      </div>
      <div class="form-group">
        <label>Office</label>
        <input type="number" class="form-control" id="count-entry-office" inputmode="numeric">
      </div>
      <div class="form-group">
        <label>Shop</label>
        <input type="number" class="form-control" id="count-entry-shop" inputmode="numeric">
      </div>
      <div class="form-group">
        <label>Vintage (actual, if differs)</label>
        <input type="text" class="form-control" id="count-entry-vintage">
      </div>
      <div class="form-group">
        <label>Comment</label>
        <input type="text" class="form-control" id="count-entry-comment" placeholder="Note for admin">
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" id="btn-count-entry-cancel">Cancel</button>
      <button type="button" class="btn" id="btn-count-entry-save">Save</button>
      <button type="button" class="btn" id="btn-count-entry-save-next">Save &amp; next</button>
    </div>
  </div>
</div>
```

### Part 2: Modify Product Counts table for mobile-compact mode

Keep the 12-column table for desktop. Add mobile-only CSS to hide read-only columns and reveal a tap-to-open affordance on rows:

```css
@media (max-width: 768px) {
  /* On mobile, hide non-essential columns; show Product Name + SKU + Status checkbox only */
  .products-count-table th:nth-child(1),  /* Comax */
  .products-count-table th:nth-child(2),  /* Total */
  .products-count-table th:nth-child(3),  /* Brurya */
  .products-count-table th:nth-child(4),  /* Storage */
  .products-count-table th:nth-child(5),  /* Office */
  .products-count-table th:nth-child(6),  /* Shop */
  .products-count-table th:nth-child(7),  /* Vintage */
  .products-count-table th:nth-child(8),  /* Link */
  .products-count-table th:nth-child(11),  /* details toggle */
  .products-count-table td:nth-child(1),
  .products-count-table td:nth-child(2),
  .products-count-table td:nth-child(3),
  .products-count-table td:nth-child(4),
  .products-count-table td:nth-child(5),
  .products-count-table td:nth-child(6),
  .products-count-table td:nth-child(7),
  .products-count-table td:nth-child(8),
  .products-count-table td:nth-child(11) {
    display: none;
  }
  .products-count-table tr { cursor: pointer; }
  .products-count-table .product-details-row { display: none !important; }
}
```

Add the `products-count-table` class to the table at `:133` (was `table table-hover table-sm`):

```javascript
let tableHtml = `<table class="table table-hover table-sm products-count-table">`
```

### Part 3: Wire row-click on mobile to open the modal

In the JS that binds the table after render (currently `:202+`), add a row-click handler that detects mobile viewport + opens the modal:

```javascript
productCountsListDiv.querySelectorAll('tr[data-task-id]').forEach(row => {
  row.addEventListener('click', (e) => {
    // Only intercept on mobile + only if the click wasn't already an input/button
    if (window.innerWidth > 768) return;
    if (e.target.matches('input, button')) return;
    openCountEntryModal(row);
  });
});

function openCountEntryModal(row) {
  const item = {
    sku: row.dataset.sku,
    productName: row.dataset.productName,
    comaxQty: row.dataset.comaxQty,
    totalQty: row.querySelector('td:nth-child(2)').textContent.trim(),
    bruryaQty: row.querySelector('td:nth-child(3)').textContent.trim(),
    storage: row.querySelector('[data-qty-type="storage"]').value,
    office: row.querySelector('[data-qty-type="office"]').value,
    shop: row.querySelector('[data-qty-type="shop"]').value,
    vintage: (document.querySelector(`.product-vintage-input[data-sku="${row.dataset.sku}"]`) || {}).value || '',
    comment: (document.querySelector(`.product-comment-input[data-sku="${row.dataset.sku}"]`) || {}).value || ''
  };
  document.getElementById('count-entry-product-name').textContent = item.productName;
  document.getElementById('count-entry-sku').textContent = item.sku;
  document.getElementById('count-entry-comax').textContent = item.comaxQty;
  document.getElementById('count-entry-total').textContent = item.totalQty;
  document.getElementById('count-entry-brurya').textContent = item.bruryaQty;
  document.getElementById('count-entry-storage').value = item.storage;
  document.getElementById('count-entry-office').value = item.office;
  document.getElementById('count-entry-shop').value = item.shop;
  document.getElementById('count-entry-vintage').value = item.vintage;
  document.getElementById('count-entry-comment').value = item.comment;
  // CCP-UI-8: open via shared helper for focus management + Esc handling
  ModalOverlay.open('count-entry-modal');
  document.getElementById('count-entry-storage').focus();
  // Stash the active row so Save can write back to it
  document.getElementById('count-entry-modal').dataset.activeSku = item.sku;
}

function saveCountEntry(advanceToNext) {
  const modal = document.getElementById('count-entry-modal');
  const sku = modal.dataset.activeSku;
  const row = productCountsListDiv.querySelector(`tr[data-sku="${sku}"]`);
  if (row) {
    row.querySelector('[data-qty-type="storage"]').value = document.getElementById('count-entry-storage').value;
    row.querySelector('[data-qty-type="office"]').value = document.getElementById('count-entry-office').value;
    row.querySelector('[data-qty-type="shop"]').value = document.getElementById('count-entry-shop').value;
    const vintageInput = document.querySelector(`.product-vintage-input[data-sku="${sku}"]`);
    if (vintageInput) vintageInput.value = document.getElementById('count-entry-vintage').value;
    const commentInput = document.querySelector(`.product-comment-input[data-sku="${sku}"]`);
    if (commentInput) commentInput.value = document.getElementById('count-entry-comment').value;
    // Trigger the existing 'input' event so the status checkbox auto-updates
    row.querySelector('[data-qty-type="storage"]').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (advanceToNext) {
    // Find next un-checked row
    const allRows = Array.from(productCountsListDiv.querySelectorAll('tr[data-task-id]'));
    const idx = allRows.findIndex(r => r.dataset.sku === sku);
    const nextRow = allRows.slice(idx + 1).find(r => !r.querySelector('.product-count-checkbox').checked);
    if (nextRow) {
      openCountEntryModal(nextRow);
      return;
    }
  }
  ModalOverlay.close('count-entry-modal');
}

document.getElementById('btn-close-count-entry').addEventListener('click', () => ModalOverlay.close('count-entry-modal'));
document.getElementById('btn-count-entry-cancel').addEventListener('click', () => ModalOverlay.close('count-entry-modal'));
document.getElementById('btn-count-entry-save').addEventListener('click', () => saveCountEntry(false));
document.getElementById('btn-count-entry-save-next').addEventListener('click', () => saveCountEntry(true));
```

The `ModalOverlay.open(id)` helper (CCP-UI-8) is built once and reused — it handles focus management, Esc-to-close, body scroll-lock, and modal stacking.

**CCPs applied (Stage B v2).** CCP-UI-1 (modal-overlay), CCP-UI-7 (mobile primitives — 16px inputs avoid auto-zoom), CCP-UI-8 (focus/keyboard via shared helper).

**Smoke B (v2).**
- Desktop: open Manager Inventory. Product Counts table renders 12-column. Click `…` toggle on a row → detail row reveals. Type into Storage/Office/Shop → status checkbox auto-checks. Submit Counts.
- **Mobile (real device — warehouse-floor simulation):**
  - Open Manager Inventory. Product Counts table renders as compact 3-column list: Product Name + SKU + Status checkbox.
  - Tap any row → modal opens, focus lands in Storage input automatically (CCP-UI-8). Soft keyboard appears.
  - Enter 5 in Storage, 3 in Office, 2 in Shop. Tap Save & next → modal switches to next un-counted product, focus in Storage again.
  - Continue down the list — efficient floor workflow.
  - Press Esc on phone keyboard (if hardware keyboard attached) or back button → modal closes (CCP-UI-8).
  - Confirm body doesn't scroll behind modal (scroll-lock).
  - Tap Cancel → modal closes; row's values reflect any save that happened.

**Rollback B.** Git revert + redeploy.

**Risk B.** Medium. New modal infrastructure. Mitigated by CCP-UI-8 shared helper. Original table remains usable on desktop without behavioral change.

**Commit B (v2).** `ui(ManagerInventory): mobile count-entry modal — tap row opens focused modal with 3 inputs + Save & next (replaces v1's responsive-stack approach)`

---

(v1 Stage B content below preserved for traceability; superseded by v2 above.)

~~Modify `:132-198`:~~

```javascript
// before — table tag and per-row td's:
let tableHtml = `
    <table class="table table-hover table-sm">
        <thead>
            <tr>
                <th class="text-center">Comax</th>
                ...
            </tr>
        </thead>
        <tbody>
`;
productsToCount.forEach(item => {
  // ... existing variables ...
  tableHtml += `
    <tr data-task-id="${item.taskId}" ...>
      <td class="text-center">${item.comaxQty}</td>
      <td class="text-center" id="total-qty-${item.sku}">${item.totalQty}</td>
      <td class="text-center">${item.bruryaQty}</td>
      <td style="width: 8%;"><input type="text" class="form-control form-control-sm product-count-input" data-qty-type="storage" value="${valStorage}"></td>
      ... etc ...
    </tr>
    <tr class="product-details-row" data-sku="${item.sku}" style="display: none; background: #fafafa;">
      <td colspan="12">
        ...
      </td>
    </tr>
  `;
});

// after — add responsive-stack class and data-label per cell:
let tableHtml = `
    <table class="table table-hover table-sm responsive-stack">
        <thead>
            <tr>
                <th class="text-center">Comax</th>
                <th class="text-center">Total</th>
                <th class="text-center">Brurya</th>
                <th class="text-center">Storage</th>
                <th class="text-center">Office</th>
                <th class="text-center">Shop</th>
                <th class="text-center">Vintage</th>
                <th class="text-center">Link</th>
                <th class="text-center">SKU</th>
                <th class="text-right">Product Name</th>
                <th class="text-center"></th>
                <th></th>
            </tr>
        </thead>
        <tbody>
`;
productsToCount.forEach(item => {
  // ... existing variables ...
  tableHtml += `
    <tr data-task-id="${item.taskId}" data-sku="${item.sku}" data-comax-qty="${item.comaxQty}" data-vintage-ref="${vintageRef}" data-product-name="${escapeAttr(item.productName || '')}">
      <td class="text-center" data-label="Comax">${item.comaxQty}</td>
      <td class="text-center" data-label="Total" id="total-qty-${item.sku}">${item.totalQty}</td>
      <td class="text-center" data-label="Brurya">${item.bruryaQty}</td>
      <td data-label="Storage"><input type="text" class="form-control form-control-sm product-count-input" data-qty-type="storage" value="${valStorage}"></td>
      <td data-label="Office"><input type="text" class="form-control form-control-sm product-count-input" data-qty-type="office" value="${valOffice}"></td>
      <td data-label="Shop"><input type="text" class="form-control form-control-sm product-count-input" data-qty-type="shop" value="${valShop}"></td>
      <td class="text-center" data-label="Vintage">${escapeAttr(item.vintage || '')}</td>
      <td class="text-center" data-label="Link">${pageLink}</td>
      <td class="text-center" data-label="SKU">${item.sku}</td>
      <td class="text-right" data-label="Product">${item.productName}</td>
      <td class="text-center"><button type="button" class="btn btn-light btn-sm product-details-toggle" data-sku="${item.sku}">…</button></td>
      <td><input type="checkbox" class="product-count-checkbox" ${isChecked} disabled></td>
    </tr>
    <tr class="product-details-row" data-sku="${item.sku}" style="display: none; background: #fafafa;">
      <td colspan="12">
        <div class="form-row align-items-center">
          <div class="col-auto">
            <label class="small mb-0 mr-1">Vintage (actual):</label>
            <input type="text" class="form-control form-control-sm product-vintage-input" data-sku="${item.sku}" style="width: 80px; display: inline-block;">
          </div>
          <div class="col">
            <label class="small mb-0 mr-1">Comment:</label>
            <input type="text" class="form-control form-control-sm product-comment-input" data-sku="${item.sku}" placeholder="Note for admin (creates vintage update task)">
          </div>
        </div>
      </td>
    </tr>
  `;
});
```

Two changes summarized:
- Table class: added `responsive-stack`.
- Each main-row `<td>` gets `data-label="<col>"`.
- Width-style inline `style="width: 8%"` on input cells removed (no longer needed since responsive-stack makes them block on mobile; on desktop they'll auto-size based on table-sm).
- Toggle button and disabled checkbox `<td>` have no `data-label` (they're action/status, not labelled data).
- Detail row unchanged — its `colspan="12"` is ignored on mobile (each `<td>` becomes block) and works on desktop.

**Smoke B.**
- `clasp push`. Deploy.
- **Desktop:** Product Counts table renders as 12-column table with subtle table-sm density. Click `…` toggle on a row — detail row reveals with vintage + comment inputs. Type into Storage/Office/Shop inputs → status checkbox at end auto-checks (existing logic preserved). Submit Counts disables/enables correctly.
- **Mobile (real device strongly preferred — manager floor workflow):**
  - Open Manager Inventory. Each product renders as a card with labels: "Comax: 8", "Total: 23", "Brurya: 15", "Storage: [input]", "Office: [input]", "Shop: [input]", "Vintage: 2018", "Link: view", "SKU: ABC", "Product: Wine Name", then the toggle button and status checkbox.
  - Tap a Storage input → soft keyboard opens, can enter a number.
  - Tap `…` toggle → detail row appears as connected card below with Vintage and Comment inputs.
  - Status checkbox auto-checks on any input.
  - Submit Counts at top is reachable.

**Rollback B.** Git revert + redeploy.

**Commit B.** `ui(ManagerInventory): Product Counts table adopts .responsive-stack (warehouse-floor mobile workflow)`

## Stage C — Brurya table adopts `.responsive-stack`

**Why third.** Smaller table (4 columns), same pattern.

**Files.**
- Edit `jlmops/ManagerInventoryView.html` — Brurya table template + the Quantity input.

**Changes.**

Modify `:614-626`:

```javascript
// before:
let tableHtml = '<table class="table table-hover"><thead><tr><th>Quantity</th><th>SKU</th><th>Name</th><th>#</th></tr></thead><tbody>';
if (inventoryData.length > 0) {
    inventoryData.forEach((item, index) => {
        tableHtml += `
            <tr data-sku="${item.sku}">
                <td style="width: 15%;"><input type="number" class="form-control form-control-sm" value="${item.bruryaQty}" min="0"></td>
                <td>${item.sku}</td>
                <td class="product-name-col">${item.Name}</td>
                <td>${index + 1}</td>
            </tr>`;
    });
}
tableHtml += '</tbody></table>';

// after:
let tableHtml = '<table class="table table-sm table-hover responsive-stack"><thead><tr><th>Quantity</th><th>SKU</th><th>Name</th><th>#</th></tr></thead><tbody>';
if (inventoryData.length > 0) {
    inventoryData.forEach((item, index) => {
        tableHtml += `
            <tr data-sku="${item.sku}">
                <td data-label="Quantity"><input type="number" class="form-control form-control-sm brurya-qty-input" value="${item.bruryaQty}" min="0"></td>
                <td data-label="SKU">${item.sku}</td>
                <td data-label="Name" class="product-name-col">${item.Name}</td>
                <td data-label="#">${index + 1}</td>
            </tr>`;
    });
}
tableHtml += '</tbody></table>';
```

Changes summarized:
- Table class adds `table-sm responsive-stack`.
- Quantity input loses inline `width: 15%`; replaced by `brurya-qty-input` class (defined in Stage A CSS: `width: 80px` desktop, `100%` mobile).
- Each `<td>` gets `data-label`.

**Smoke C.**
- `clasp push`. Deploy.
- **Desktop:** Brurya table renders compact (table-sm); Quantity column is ~80px wide; SKU/Name/# columns auto-size; row hover. Change a Quantity value → state updates (existing JS preserved). Click Save → save fires.
- **Mobile:** each Brurya row becomes a card with "Quantity: [input]", "SKU: ABC", "Name: Wine X", "#: 7". Quantity input full-width. Save button reachable in card header.

**Rollback C.** Git revert + redeploy.

**Commit C.** `ui(ManagerInventory): Brurya table adopts .responsive-stack + table-sm; Quantity input width to CSS class`

## Session-end checklist

1. **Git log review.** Three commits.
2. **Live smoke** — both cards on desktop + mobile.
3. **Update `UI_AUDIT.md` §10 status:** mark T4.3 SHIPPED.
4. **Update `.claude/session-log.md`:** brief note with workflow observations from mobile smoke.
5. **CCP-UI audit:**
   - CCP-UI-3 (table pattern): `table-sm responsive-stack` applied to both tables; data-label on each cell.
   - CCP-UI-7 (mobile primitives): inputs get full-width on mobile; touch targets preserved from shell.

## Notes for future sessions

- **Inline-width-to-CSS-class** pattern (T4.2 + T4.3) is now established for any inline-styled element that needs responsive behavior. Apply uniformly when seen in future mobile sessions.
- **Detail row collapsed inside responsive-stack** works because `<td colspan>` is structurally ignored when `<td>` becomes block. Documented for T4.5 LibraryView mobile (drawer + nested rows pattern).
- **`responsive-stack` adopted in 3 views** after this session (Orders T4.1 + Inventory T4.3, plus the utility itself in AppView). Tier 5.3 reassessment after Tier 4 lands: with 3 adopters, the consolidation potential is clearer.
