# UI Tier 4.1 — OrdersView mobile pass (responsive-stack adoption)

**Session ID:** UI_T4_1
**Status:** **SHIPPED 2026-05-29 (@173 deploy @177 + @174 deploy @178 refine; commit `7e1f643`).** Both tables adopt `.responsive-stack` + `table-sm` with `data-label` per cell; mobile-safe "Select all" button (`toggleAllPacking`) added above Packing Slips (thead select-all stays for desktop). **Refinement after mobile smoke:** the bare packing-slip checkbox was distorted by the global `input{min-height:40px}` rule once stacked — scoped CSS pins `#packing-slips-list .order-checkbox` to 22×22; relabelled its cell "Select" → "Print this order". User-confirmed on mobile (Open Orders cards, packing cards, individual/all/deselect, checkbox). First production adopter of `.responsive-stack`. — Plan v1 (2026-05-28). All gaps resolved via code reading:
- **`.responsive-stack` utility verified.** Defined at `AppView.html:111-135`. Behavior matches its label: `thead` hides on mobile, each `<tr>` becomes a bordered card, each `<td>` becomes a block with `::before` content from `data-label` attribute. Empty `<td>::empty::before { content: none }` (`:134`) handles missing labels cleanly. Adopt as-is.
- **Mobile primitives in AppView are sufficient:** `:151-156` already enforces `.btn { min-height: 44px }`, `.btn-sm { min-height: 38px }`, inputs `font-size: 16px !important; min-height: 40px`. No extra touch-target work needed on this session beyond proper markup.
- **Both ManagerOrdersView tables use template literals to build HTML** (`:44, :84` per pre-T2.3 file). Adoption requires modifying the template strings, not just CSS.
- **File name post-T2.3:** session edits `OrdersView.html` (was `ManagerOrdersView.html`).

**Parent:** `UI_AUDIT.md` §5 Tier 4.1
**Estimated effort:** 1 session, 1 staged deploy.
**Depends on:** **T2.3 must ship first** (file rename + role gating). T1.0 should also have shipped (`btn-primary` → `btn-light` fix on the gift-doc link).

## Session goal

Both tables in `OrdersView.html` collapse to readable card-stacks on mobile via `.responsive-stack`. Manager can run packing-slip and open-orders workflows on phone without horizontal scroll or clipped columns. Open Orders table works the same way for admin (single-column simple table — also benefits from card-stack on mobile).

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. **Verify T2.3 shipped** — `ls jlmops/OrdersView.html` returns one file; `ManagerOrdersView.html` and `AdminOrdersView.html` do not exist.
5. Re-read `OrdersView.html` end-to-end. Locate the two table templates in `loadPackingSlipsData()` and `loadOpenOrdersData()`.
6. Open phone + desktop browser side-by-side for smoke.

## Stage A — Both tables adopt `.responsive-stack` with `data-label`

**Why one stage.** Two table edits in one file. Atomic.

**Files.**
- Edit `jlmops/OrdersView.html` — two table template literals.

**Changes.**

### Part 1: Packing Slips table (manager-only)

Find the template literal in `loadPackingSlipsData()` that builds the packing slips table. Pre-T2.3 line `:44`; post-T2.3 file may differ slightly. The string starts with `<table class="table table-hover">`.

```javascript
// before:
let tableHtml = '<table class="table table-hover"><thead><tr><th><input type="checkbox" onclick="toggleAll(this)"></th><th>Order #</th><th>Status</th><th>Billing Name</th><th>Shipping Name</th><th>Customer Note</th><th></th></tr></thead><tbody>';
orders.forEach(order => {
  let giftButton = '';
  if (order.customerNote) {
    giftButton = `<button class="btn btn-sm" onclick="createGiftMessage('${order.orderId}', '${order.customerNote}')">Create Gift Doc</button>`;
  }
  tableHtml += `<tr>
                  <td><input type="checkbox" class="order-checkbox" value="${order.orderId}"></td>
                  <td>${order.orderNumber || order.orderId}</td>
                  <td>${order.status}</td>
                  <td>${order.billingName || ''}</td>
                  <td>${order.shippingName || ''}</td>
                  <td>${order.customerNote || ''}</td>
                  <td>${giftButton}</td>
                </tr>`;
});

// after:
let tableHtml = '<table class="table table-sm table-hover responsive-stack"><thead><tr><th><input type="checkbox" onclick="toggleAll(this)"></th><th>Order #</th><th>Status</th><th>Billing Name</th><th>Shipping Name</th><th>Customer Note</th><th></th></tr></thead><tbody>';
orders.forEach(order => {
  let giftButton = '';
  if (order.customerNote) {
    giftButton = `<button class="btn btn-sm" onclick="createGiftMessage('${order.orderId}', '${order.customerNote}')">Create Gift Doc</button>`;
  }
  tableHtml += `<tr>
                  <td data-label="Select"><input type="checkbox" class="order-checkbox" value="${order.orderId}"></td>
                  <td data-label="Order #">${order.orderNumber || order.orderId}</td>
                  <td data-label="Status">${order.status}</td>
                  <td data-label="Billing">${order.billingName || ''}</td>
                  <td data-label="Shipping">${order.shippingName || ''}</td>
                  <td data-label="Note">${order.customerNote || ''}</td>
                  <td>${giftButton}</td>
                </tr>`;
});
```

Two changes per row:
- Table class: `table table-hover` → `table table-sm table-hover responsive-stack` (adds `table-sm` for desktop density + `responsive-stack` for mobile collapse).
- Each `<td>` gets a `data-label` attribute for its mobile prefix. The gift-button `<td>` has no label (its empty `data-label` triggers the `td:empty::before { content: none }` rule — confirmed at `AppView.html:134`).

### Part 2: Open Orders table (both roles)

Same recipe. Find the template literal in `loadOpenOrdersData()`:

```javascript
// before:
let tableHtml = '<table class="table table-hover"><thead><tr><th>Order ID</th><th>Status</th><th>Order Date</th><th>Billing Name</th><th>Shipping Name</th><th>Shipping City</th></tr></thead><tbody>';
orders.forEach(order => {
  tableHtml += `<tr>
                  <td>${order.orderId}</td>
                  <td>${order.status}</td>
                  <td>${order.orderDate}</td>
                  <td>${order.billingName || ''}</td>
                  <td>${order.shippingName || ''}</td>
                  <td>${order.shippingCity}</td>
                </tr>`;
});

// after:
let tableHtml = '<table class="table table-sm table-hover responsive-stack"><thead><tr><th>Order ID</th><th>Status</th><th>Order Date</th><th>Billing Name</th><th>Shipping Name</th><th>Shipping City</th></tr></thead><tbody>';
orders.forEach(order => {
  tableHtml += `<tr>
                  <td data-label="Order ID">${order.orderId}</td>
                  <td data-label="Status">${order.status}</td>
                  <td data-label="Order Date">${order.orderDate}</td>
                  <td data-label="Billing">${order.billingName || ''}</td>
                  <td data-label="Shipping">${order.shippingName || ''}</td>
                  <td data-label="City">${order.shippingCity}</td>
                </tr>`;
});
```

**Smoke.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T4.1: OrdersView tables adopt .responsive-stack for mobile"`.
- **Desktop manager smoke** (≥769px viewport):
  - Open Orders. Both tables render as standard tables with `thead`, no card-stack behavior. Visual: slightly tighter spacing from `table-sm` (acceptable; matches project standard).
  - Check checkbox selection still works (single + select-all). Click "Create Gift Doc" on an order with a customer note → modal/result block renders.
  - Click "Refresh Orders" → both tables reload.
- **Desktop admin smoke:** open Orders. Confirm only Open Orders card visible (Packing Slips hidden via T2.3 `data-roles="manager"`). Table renders as standard.
- **Mobile manager smoke (real device or browser at 360px width):**
  - Open Orders. Packing Slips table is now a vertical stack of cards. Each card shows: Select / Order # / Status / Billing / Shipping / Note labelled with grey bold prefixes; Create Gift Doc button below if applicable.
  - Tap select-all checkbox in the (now-hidden) header — confirm the `toggleAll` JS function still runs even though `thead` is hidden. **Wait** — `thead` is `display: none` on mobile, so the select-all checkbox is not tappable! Need to handle this.

**Critical mobile gap discovered during plan-time review:** the select-all checkbox lives in `<thead>` which `.responsive-stack` hides on mobile. Without the select-all, mobile users can only select/deselect orders one at a time. Mitigation options:

1. **Add a separate "Select all" button outside the table** that's visible on mobile (and harmless on desktop).
2. **Accept the limitation** — packing-slip selection is usually small batches; tapping each row's checkbox is acceptable.

**Decision committed:** Option 1. Add a small "Select all" toggle button above the Packing Slips table, visible at all viewport sizes, that wraps the existing `toggleAll` logic. This avoids feature-loss on mobile.

### Part 3 (additional): "Select all" toggle button above Packing Slips

**v2 added — `toggleAll` call-site safety check.** Plan-coherence agent flagged: the new `toggleAllPacking()` differs from existing `toggleAll(this)` (header checkbox) in semantics — `toggleAll` sets all to a passed checkbox's state; `toggleAllPacking` toggles to opposite of current. Before Part 3 ships, `grep -n "toggleAll(" jlmops/OrdersView.html` — expected: only the existing `<thead>` `<input>` `onclick="toggleAll(this)"` call. If any other call site is found, re-plan. Existing call should not be removed (it stays in `<thead>` for desktop).

Find the card-header markup for the Packing Slips card. After T2.3, the structure is:

```html
<div class="card mb-4" data-roles="manager">
    <div class="card-header">
        <i class="fas fa-file-alt mr-1"></i>
        Packing Slips
    </div>
    <div class="card-body">
        <p>Select order documents to print.</p>
        <button class="btn mb-3" onclick="generateSelectedPackingSlips()">Print Selected</button>
        <div id="packing-slips-list"></div>
        ...
```

Replace the existing button row with:

```html
        <div class="d-flex" style="gap: 8px; margin-bottom: 12px;">
            <button class="btn" onclick="generateSelectedPackingSlips()">Print Selected</button>
            <button class="btn" id="btn-select-all-packing" onclick="toggleAllPacking()">Select all</button>
        </div>
```

Add helper JS near `toggleAll`:

```javascript
function toggleAllPacking() {
  const checkboxes = document.querySelectorAll('#packing-slips-list .order-checkbox');
  // Determine new state: if ANY unchecked, check all. Else uncheck all.
  const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
  checkboxes.forEach(cb => cb.checked = anyUnchecked);
  const btn = document.getElementById('btn-select-all-packing');
  if (btn) btn.textContent = anyUnchecked ? 'Deselect all' : 'Select all';
}
```

The existing `toggleAll(this)` in `<thead>` stays (still tappable on desktop where `thead` is visible). The button works for both viewports.

**Smoke (updated, including Part 3).**
- Mobile: tap "Select all" → all visible packing-slip checkboxes check. Tap again → all uncheck. Button label toggles "Select all" ↔ "Deselect all". Tap Print Selected → modal renders with count.
- Desktop: same behavior; `thead`'s select-all also still works for backward compatibility.

**Rollback.**
- Git revert + redeploy. Tables revert to non-responsive; "Select all" button disappears.

**Risk.**
- Low. Both tables continue to function on desktop unchanged (table-sm is slightly tighter — acceptable). Mobile gains the card-stack rendering plus the explicit select-all button.

**Commit.** `ui(Orders): adopt .responsive-stack on both tables + add explicit Select all button (replaces thead-hidden-on-mobile checkbox)`

## Session-end checklist

1. **Git log review.** One commit.
2. **Live smoke** — both desktop and mobile (real device strongly preferred for the second).
3. **Update `UI_AUDIT.md` §10 status:** mark T4.1 SHIPPED.
4. **Update `.claude/session-log.md`:** brief note.
5. **CCP-UI audit:**
   - CCP-UI-3 (table pattern): `table table-sm table-hover responsive-stack` applied.
   - CCP-UI-7 (mobile primitives): inherited from shell (44px buttons, 40px inputs); explicit Select all button preserves feature parity across viewports.

## Notes for future sessions

- **First view to actually use `.responsive-stack`** in production. The utility was defined in AppView for some time but adopted by zero views (per audit §3). T4.1 is the proof-of-concept; T4.3 (ManagerInventoryView 12-column counts table) and T4.5 (LibraryView list table) will follow the same recipe.
- **`thead`-hidden-on-mobile pattern** — any table using `.responsive-stack` that has interactive controls in `<thead>` (select-all, sort indicators that need tapping) needs an external equivalent for mobile. T4.1 established the "explicit external button" recipe. T4.3/4.5 may need similar treatment.
