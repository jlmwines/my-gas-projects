# Admin Products View — Card-to-Tab Conversion

Convert the five stacked cards in `AdminProductsView.html` into a Bootstrap `nav-tabs` layout. Eliminates scrolling, hides irrelevant sections, preserves all existing lazy-load and badge behavior. **Status: Shipped @347 (2026-06-23).**

---

## Tab layout

Five tabs, in frequency-of-use order:

| Tab key | Label | Badge |
|---------|-------|-------|
| `details` | Detail Updates | pending review count (`stat-review`) |
| `new` | New Products | suggestions + submissions (`stat-new-products`) |
| `verify` | Verification | reverted-verify count (`reverted-verify-count`) |
| `sku` | SKU Management | none |
| `lookups` | Lookups | none |

Default active tab on mount: **Detail Updates** (already eager-loaded).

---

## What changes

### HTML

Replace the five `<div class="card mb-4">` wrappers with:

1. A `<ul class="nav nav-tabs mb-4" id="admin-products-tabs">` bar at the top, one `<li>` per tab. Badge `<span>` elements sit inside each `<a>` for the three badged tabs.

2. Five `<div class="tab-pane" id="tab-pane-{key}">` panels. Each panel's content is identical to the current card-body content — no inner changes. Only `tab-pane-details` is visible on mount; the rest get `display:none`.

The Verification card currently has a "Show / Hide" toggle button (`btn-verify-toggle`) inside the card header that reveals `verify-card-body`. With tabs the card header is gone — **remove the toggle button and `verify-card-body` wrapper**; the pane body is always visible when the tab is active.

Remove chevron elements (`chev-new`, `chev-sku`, `chev-lookups`) — no longer needed.

### CSS

Add page-level tab styles (Bootstrap `nav-tabs` already handles most of it). No new custom CSS needed beyond what Bootstrap provides. The existing `.tab-btn` / `.tab-content` classes stay — they are scoped to the inner editor modal and don't conflict.

### JS — `switchTab(key)`

Replace `toggleCard(key)` and `toggleVerifyCard()` with a single `switchTab(key)`:

```js
AdminProductsView.switchTab = function(key) {
  // Hide all panes, deactivate all tab links
  ['details', 'new', 'verify', 'sku', 'lookups'].forEach(function(k) {
    var pane = document.getElementById('tab-pane-' + k);
    var link = document.getElementById('tab-link-' + k);
    if (pane) pane.style.display = 'none';
    if (link) link.classList.remove('active');
  });
  // Show target
  var active = document.getElementById('tab-pane-' + key);
  var activeLink = document.getElementById('tab-link-' + key);
  if (active) active.style.display = '';
  if (activeLink) activeLink.classList.add('active');
  AdminProductsView._activeTab = key;
  // Lazy-load on first switch (mirrors current toggleCard behavior)
  if (key !== 'details' && key !== 'verify' && !AdminProductsView._cardLoaded[key]) {
    AdminProductsView._cardLoaded[key] = true;
    AdminProductsView._loadCard(key);
  }
  if (key === 'verify' && !AdminProductsView._cardLoaded.verify) {
    AdminProductsView._cardLoaded.verify = true;
    AdminProductsView._loadVerifyTab();
  }
};
```

Add `AdminProductsView._activeTab = 'details'` to the init block.

### JS — `_loadCard` / `_loadVerifyTab`

`_loadCard` is unchanged for keys `new`, `sku`, `lookups`.

Add `_loadVerifyTab` (content of current `toggleVerifyCard()` load path):

```js
AdminProductsView._loadVerifyTab = function() {
  AdminProductsView.loadRevertedVerify();
  AdminProductsView.loadVerifyPlanning();  // existing function
};
```

`toggleVerifyCard()` is removed. `_cardLoaded` gains a `verify: false` entry.

### JS — `refreshView`

Currently refreshes Card 1 always + any open lower card. With tabs, refresh Card 1 (details) always + the currently active tab:

```js
AdminProductsView.refreshView = function() {
  AdminProductsView.loadNewProductsBadge();
  AdminProductsView.loadRevertedVerify();
  AdminProductsView.loadReviewList();
  AdminProductsView.loadAcceptedList();
  AdminProductsView.loadPendingDetailsList();
  var tab = AdminProductsView._activeTab;
  if (tab && tab !== 'details') AdminProductsView._loadCard(tab);
};
```

### Badge wiring

The three badge elements keep their existing IDs (`stat-new-products`, `reverted-verify-count`). They move from card headers into the tab `<a>` markup. A new badge element `stat-review-tab` in the Detail Updates tab label is populated by `loadAdminReviewList` (the function that already sets `stat-review` in the card body — add a parallel write there).

`loadNewProductsBadge()` and `loadRevertedVerify()` continue running at mount and on `refreshView` — no change to those functions.

---

## What does NOT change

- All card-body content (tables, forms, buttons, section headers) — moved verbatim into tab panes
- All modal markup and JS — untouched (modals sit outside the tab structure)
- All backend calls — unchanged
- `_loadCard` for `new`, `sku`, `lookups`
- `setCountBadge` helper
- `loadNewProductsBadge`, `loadRevertedVerify`
- The inner editor modal's own tab system (`.tab-btn`, `.tab-content`) — independent

---

## Risk

Low. Pure structural move — no data flow changes, no new backend calls, no schema changes. Risk surface:

- **Verify tab lazy load**: current "Show" button triggers `loadVerifyPlanning()` — confirm that function name and call site are correct before implementing.
- **`refreshView` active-tab logic**: if `_activeTab` is stale after a modal close, the wrong loaders could fire. Set `_activeTab` at the top of init to `'details'` as a safe default.
- **Badge DOM moves**: any code that does `getElementById('stat-new-products')` will still find it — just in a different part of the DOM. No JS references need updating.

---

## Deploy

Single deploy. Smoke checklist:
- Detail Updates loads on mount; badge shows pending count
- Switch to New Products → lazy-loads; badge count shows
- Switch to Verification → lazy-loads reverted list + planning data; badge shows
- SKU Management and Lookups lazy-load on first switch
- After Accept action: tab stays on Detail Updates, counts refresh
- After accepting a suggestion (New Products tab): stays on New Products tab, list refreshes
