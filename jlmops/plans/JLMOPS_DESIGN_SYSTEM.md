# JLMops Design System

Internal UI design language for the jlmops HtmlService admin interface. Brand-derived tokens applied with a functional-first semantic layer. Not a visual overhaul — a coherent system so every surface looks and behaves consistently.

Current state: **ds-v2 applied to all admin and manager views.** Global Bootstrap card theming in AppView.html. All views have `ds-v2` container class. All inline view titles (h1/h2/h3) removed — title lives in the app shell header.

---

## Design Tokens

Sourced from the JLM Wines theme CSS (`:root` in `website/jlmwines-theme/assets/css/main.css`). jlmops uses a subset.

| Token name | Hex | Semantic role in jlmops |
|---|---|---|
| `--ds-go` | `#4a7a3e` | Links, active nav/tab, published state |
| `--ds-bg-action` | `#fcf9f2` | Actionable area background |
| `--ds-header-action` | `#f2ede3` | Section header cream (very light — ~5% off white) |
| `--ds-urgent` | `#c9882c` | Overdue signal (always paired with bold) |
| `--ds-delete` | `#a83920` | Destructive actions only |
| `--ds-muted` | `#a09489` | Informational secondary text |

---

## Spatial Signal — Background

The primary visual signal is **background color on the container**, not on individual rows.

- **Cream (`--ds-bg-action`) = this section wants work.** Cards holding actionable content get cream. The user sees cream and knows: act here.
- **White = informational.** Sections that are read-only, waiting, or historical stay white.

Applied at the **section level**, not at the row level.

---

## Urgency — Typography + Color

Two levels, both use bold.

- **Bold alone** (`font-weight: 600`) = time-sensitive but not yet overdue.
- **Amber + bold** (`color: #c9882c; font-weight: 600`) = overdue / needs immediate attention.

Applied to rows or individual cells, not to entire section containers.

---

## Interactive Color Vocabulary

Three colors, three distinct meanings. Never mix them.

**Dark green `#4a7a3e` — go / navigate / active state**
- Clickable product names, active tab underline, active nav link, "published/done" pills

**Amber `#c9882c` — selection toggle + overdue signal**
- Filter chip when selected; overdue row indicator when paired with bold

**Terracotta `#a83920` — destructive**
- Delete buttons only; cancel in a destructive confirm dialog

---

## App Shell — AppView.html

### Header layout

Current: `[☰] [h1 JLM Wines] [role switcher 150px min]`

Target: `[☰] [h1 JLM Wines] [/ view title] [spacer] [role switcher auto-width]`

Changes:
- Add `<span id="view-title" class="view-title-label"></span>` to header after h1
- Style: `font-size: 0.85rem; color: #7a6e62; margin-left: 8px;` — secondary label, reads as context not heading. Precede with a muted separator `·` or `/`.
- This replaces the `<h2>`/`<h3>` inside each view — the title is in the shell, not the content area.
- `loadView()` sets it via a `VIEW_LABELS` map (see below)
- Remove `min-width: 150px` from `#roleSelect`; replace with `width: auto; max-width: 120px` — just wide enough for "Admin" / "Manager"
- On mobile, role switcher further constrained: `max-width: 90px; font-size: 13px`

**VIEW_LABELS map** (in AppView.html `loadView()` or a dedicated setter):
```javascript
const VIEW_LABELS = {
  AdminDashboard: '', ManagerDashboard: '',
  AdminTasks: 'Tasks', AdminSyncView: 'Sync',
  AdminOrders: 'Orders', AdminInventory: 'Inventory',
  AdminProducts: 'Products', AdminBundles: 'Bundles',
  ManagerContacts: 'Contacts', Publishing: 'Publishing',
  Development: 'Development',
  ManagerOrders: 'Orders', ManagerInventory: 'Inventory',
  ManagerProducts: 'Products',
};
```

### Nav active state

Current: Bootstrap default blue on hover. No active highlighting for the current view.

Target: active nav link → `color: #4a7a3e; font-weight: 600; background: rgba(74,122,62,0.08); border-radius: 4px;`

Implementation:
- Add CSS rule `.sidebar .nav-link.active { color: #4a7a3e; font-weight: 600; background: rgba(74,122,62,0.08); border-radius: 4px; }`
- In `loadView()`, remove `.active` from all nav links, then add it to the link that called loadView (match by onclick value or data attribute)

---

## Tab Bar Standard

One tab bar style across all views. `pv-tab` (PublishingView) and `ap-tab` (AdminProductsView) keep their JS-facing names but share values.

AdminProductsView ds-v2 values are the reference:
- Desktop: `padding: 6px 10px; font-size: inherit;`
- Mobile (≤576px): `padding: 5px 5px; font-size: 11px;`
- Active: `color: #4a7a3e; border-bottom: 3px solid #4a7a3e; font-weight: 600;`
- Tab bar: `border-bottom: 2px solid #dee2e6; scrollbar-width: none;` (hide overflow scrollbar)

---

## Section Card Pattern (ds-section)

All tabs in all views should use the ds-section card pattern established in AdminProductsView:

```html
<div class="ds-section">
  <div class="ds-section-head">
    <h6>Section Name</h6>
    <span class="badge ...">count</span>  <!-- or action button -->
  </div>
  <div class="table-responsive" style="display:none;">
    <!-- table; shown by _tableState() when data arrives -->
  </div>
</div>
```

CSS lives in the ds-v2 block (already in AdminProductsView). For other views, either scope with `ds-v2` on the container or copy the rules directly into that view's `<style>`.

---

## Views to de-head

Remove inline `<h2>`/`<h3>` from views once AppView shows the title in the header:

- `AdminProductsView.html` line 83: `<h2 class="mb-4">Products</h2>` — remove
- `ManagerProductsView.html` ~line 120: `<h2 class="mb-4">Products</h2>` — remove
- `DevelopmentView.html` line 5: `<h3>Development Tools</h3>` — remove

---

## PublishingView — ds-v2 Rollout

Add `ds-v2` class to the container and apply:
- Tab bar: replace `pv-tab` active color with green (same CSS pattern)
- Section cards: convert existing sections to ds-section pattern
- Calendar urgency: overdue rows → amber + bold on the date/title cells

---

## ManagerProductsView — ds-v2 Rollout

Mirror AdminProductsView ds-v2 application:
- Same ds-section card pattern for all tab sections
- Same tab bar treatment
- Remove `<h2>`

---

## AdminProductsView — Section Backgrounds

Already applied via `ds-action` class on cream sections. Reference for other views:

- Actionable sections → `ds-action` wrapper (cream `#fcf9f2` background)
- Informational sections → no special background (white default)

---

## AdminProductsView — Column Ordering (deferred)

Two tables use `SKU | Product` order; standard is `Product | SKU`. Fix requires JS renderer changes — separate pass.

Tables to fix:
- "Pending" (Details tab): swap columns in both `<thead>` and JS row renderer
- "Awaiting Manager" (New tab): same

---

## Implementation Order — Completed

1. AppView.html — nav green, view title in header, role switcher width, global ds-v2 CSS
2. AdminProductsView.html — full ds-section conversion, remove h2
3. PublishingView.html — tab green, ds-section cards, calendar urgency
4. All remaining admin views — ds-v2 class + cream card-headers (global CSS) + title removal
5. All manager views — same pass

## Remaining

- **AdminProductsView.html** — column ordering fix (`SKU | Product` → `Product | SKU` in "Pending" and "Awaiting Manager" tables). Separate JS renderer pass.
- **Link colors** — per-view pass to fix Bootstrap blue links to `var(--ds-go)` (scope-links in Tasks, entity-links, etc.).
