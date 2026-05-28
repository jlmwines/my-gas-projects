# UI Tier 2.3 — Merge AdminOrdersView into shared OrdersView

**Session ID:** UI_T2_3
**Status:** Plan v1 (2026-05-28). Ready to ship. All gaps resolved via code reading:
- **File rename decision committed:** rename `ManagerOrdersView.html` → `OrdersView.html`. "ManagerOrdersView" misleads after merge; long-term clarity beats short-term diff size.
- **Parent error-handling legacy code** in `AdminOrdersView.html:52-54, :61-65, :82-84, :89-91, :98-100` (`window.parent.showError` / `window.parent.showToast`) is dead in current architecture — ManagerOrdersView uses simple `alert()` and `console.error()`. Adopt the simpler pattern in the merged file.
- **Admin Import button vs Manager Refresh button:** functionally identical (both call `WebAppOrders_triggerWebOrderImport`). Manager's `refreshOrders()` additionally reloads packing slips after — admin doesn't need packing reload (packing slips card not visible to admin). One button labelled context-appropriately for each role via `data-roles`.

**Parent:** `UI_AUDIT.md` §5 Tier 2.3
**Estimated effort:** 1 session, 1 staged deploy.
**Depends on:** **T1.0 must ship first** (already corrected `btn-primary` at `ManagerOrdersView.html:120` → `btn-light` in T1.0 Fix 3; this session inherits the fix without re-touching it).

## Session goal

One Orders view file gated by `data-roles` instead of two near-duplicate files. AdminOrdersView retires. Admin sees the Open Orders card with Import. Manager sees the same Open Orders card PLUS the Packing Slips card with Print Selected + gift-doc actions.

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. **Verify T1.0 already shipped** — grep `ManagerOrdersView.html:120` for `btn-primary`. Expected: zero matches (T1.0 fixed). If still present, ship T1.0 first.
5. Re-read `ManagerOrdersView.html` (176 lines) and `AdminOrdersView.html` (113 lines). Confirm session-time state matches plan.
6. Read `WebApp.js:78, :80` (viewMap entries for `AdminOrders` and `ManagerOrders`) and `AppView.html:199, :213` (nav entries).

## Stage A — File rename + merge + role gating

**Why one stage.** Renaming a file and merging two files together is naturally atomic — the change is consistent only when all related edits land together.

**Files.**
- **Rename** `jlmops/ManagerOrdersView.html` → `jlmops/OrdersView.html`. (Filesystem move; preserve git history via `git mv` if the user prefers, or just delete + create.)
- **Edit** `jlmops/OrdersView.html` — add `data-roles` to the Packing Slips card; add Import button visible to admin role; merge the (light) admin-specific behavior.
- **Delete** `jlmops/AdminOrdersView.html`.
- **Edit** `jlmops/WebApp.js:78, :80` — both viewMap keys point at `OrdersView`.

### Step 1: Rename the file

```
git mv jlmops/ManagerOrdersView.html jlmops/OrdersView.html
```

If `git mv` isn't available in the dev environment, equivalent: copy contents, delete old, create new with same content. (Either way, follow-up commit reflects rename.)

### Step 2: Edit `OrdersView.html` — role gating + button

Apply these changes to the renamed file:

1. **Add `data-roles="manager"` to the Packing Slips card** (was `:5-16` in ManagerOrdersView). This card hides for admin via the existing body-class CSS gate (CCP-UI-4 / `AppView.html:108-109`).

   ```html
   <!-- before -->
   <div class="card mb-4">
       <div class="card-header">
           <i class="fas fa-file-alt mr-1"></i>
           Packing Slips
       </div>
       ...
   </div>

   <!-- after -->
   <div class="card mb-4" data-roles="manager">
       <div class="card-header">
           <i class="fas fa-file-alt mr-1"></i>
           Packing Slips
       </div>
       ...
   </div>
   ```

2. **Verify the Open Orders card has no `data-roles`** — visible to both roles by default. Was `:18-28`. Stays as-is.

3. **Modify the Open Orders card header to surface the Import action consistently for both roles.** Currently the manager's "Refresh Orders" button at `:22` is a single button that triggers import + reloads everything. Adopt that as the unified pattern; relabel for clarity:

   ```html
   <!-- before -->
   <div class="card-header d-flex justify-content-between align-items-center">
       <span><i class="fas fa-box-open mr-1"></i> Open Orders</span>
       <button id="btn-refresh-orders" class="btn btn-sm" onclick="refreshOrders()">Refresh Orders</button>
   </div>

   <!-- after — unchanged markup; behavior unchanged. The button serves both roles. -->
   ```
   The button label "Refresh Orders" is fine for both roles (admin reads it as "import + refresh"; manager reads it as "refresh"). No label change needed.

4. **`refreshOrders()` JS function (`:151-170`)** — works for both roles, but currently calls `loadPackingSlipsData()` (`:161`) which is manager-only. After role-gating, admin's body-class hides the Packing Slips card; `loadPackingSlipsData()` still runs but writes to a hidden element — harmless. Optionally guard:

   ```javascript
   function refreshOrders() {
     const btn = document.getElementById('btn-refresh-orders');
     const originalText = btn.textContent;
     btn.textContent = 'Refreshing...';
     btn.disabled = true;

     google.script.run
       .withSuccessHandler(function(result) {
         btn.textContent = originalText;
         btn.disabled = false;
         // Only reload packing slips if the card is visible (manager role)
         if (document.querySelector('[data-roles="manager"]')) {
           loadPackingSlipsData();
         }
         loadOpenOrdersData();
       })
       .withFailureHandler(function(err) {
         btn.textContent = originalText;
         btn.disabled = false;
         alert('Refresh failed: ' + err.message);
       })
       .WebAppOrders_triggerWebOrderImport();
   }
   ```

   Actually the body-class CSS already prevents the Packing Slips card from rendering for admin; `loadPackingSlipsData()` writing to a hidden card is wasteful but not broken. **Decision:** leave `refreshOrders()` as-is. The unguarded reload of an invisible card has zero user impact and avoids a fragile DOM-presence check. Simpler is better.

5. **`loadPackingSlipsData()` self-execute at `:173`** — runs on every view load regardless of role. Same logic: for admin, it writes to a hidden element. Wasted round-trip on view load. Guard at the IIFE level:

   ```javascript
   // before:
   loadPackingSlipsData();
   loadOpenOrdersData();

   // after:
   if (document.querySelector('[data-roles="manager"]')) {
     loadPackingSlipsData();
   }
   loadOpenOrdersData();
   ```

   This saves admin one round-trip per Orders nav.

### Step 3: Delete `AdminOrdersView.html`

The 113-line file is no longer needed. Its functions (`loadOpenOrdersData`, `handleTriggerWebOrderImport`) are duplicated in the merged `OrdersView.html` (the manager equivalents already there). Its `<h1>Orders</h1>` heading is the same as ManagerOrdersView's.

Delete the file outright.

### Step 4: Update `WebApp.js:78, :80`

Both viewMap entries point at the merged file:

```javascript
// before (lines 78, 80):
'AdminOrders': 'AdminOrdersView',
...
'ManagerOrders': 'ManagerOrdersView',

// after:
'AdminOrders': 'OrdersView',
...
'ManagerOrders': 'OrdersView',
```

Nav entries in `AppView.html:199` (admin) and `:213` (manager) **stay unchanged** — they call `loadView('AdminOrders')` and `loadView('ManagerOrders')` respectively, both of which now route to the same shared template via the updated viewMap.

**Smoke.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T2.3: merge AdminOrdersView into shared OrdersView with role gating"`.
- **Admin role smoke:**
  - Navigate to "Orders" (admin sidebar).
  - Confirm ONLY the Open Orders card visible (no Packing Slips).
  - Open Orders table populates.
  - Click "Refresh Orders" — Import fires; table reloads. Browser console: zero errors.
  - Network tab: confirm only ONE round-trip on view mount (`getOpenOrdersForManager`); no `getPackableOrders` call.
- **Manager role smoke** (switch role via dev dropdown or sign in as manager):
  - Navigate to "Orders" (manager sidebar).
  - Confirm BOTH cards visible: Packing Slips (with Print Selected) AND Open Orders.
  - Both tables populate.
  - Select a packing slip, click Print Selected — generates document.
  - Click an order's "Create Gift Doc" — gift doc generates with `btn-light` style (T1.0's fix preserved).
  - Click "Refresh Orders" — both tables reload.
  - Network tab: TWO round-trips on view mount (`getPackableOrders` + `getOpenOrdersForManager`).

**Rollback.**
- Git revert + redeploy. The rename reverts (file restores from git), `AdminOrdersView.html` restores, viewMap entries restore.

**Risk.**
- **Low.** Both roles continue to access Orders via their existing nav entries; viewMap update is transparent to nav. Body-class CSS gating (CCP-UI-4) is established pattern, used elsewhere in jlmops. Single deploy makes the move atomic.

**Commit.** `ui(Orders): merge AdminOrdersView into shared OrdersView; role-gate Packing Slips to manager; viewMap both routes to single file`

## Session-end checklist

After Stage A committed + deployed:

1. **Git log review.** One commit (the rename + edits + delete) — git tracks the rename via `git mv` (with `--follow` showing history continuity).
2. **Live smoke:** both role flows above.
3. **File count check.** `ls jlmops/*OrdersView.html` should return exactly one file: `OrdersView.html`. Confirm `AdminOrdersView.html` and `ManagerOrdersView.html` no longer exist.
4. **Update `UI_AUDIT.md` §3 surfaces** — strike the "AdminOrdersView" and "ManagerOrdersView" entries; replace with one "OrdersView" entry noting both roles.
5. **Update `UI_AUDIT.md` §10 status:** mark T2.3 SHIPPED.
6. **Update `.claude/session-log.md`:** brief note.
7. **CCP-UI audit:**
   - CCP-UI-4 (role gating via `data-roles`): applied to Packing Slips card.
   - CCP-UI-2 (button discipline): T1.0's `btn-light` fix at the gift-doc link preserved through the rename.

## Notes for future sessions

- **Pattern established:** shared view + body-class role gate + `data-roles` per card is the project's canonical way to consolidate role-paired views. Future consolidation candidates (e.g., `AdminProductsView` ↔ `ManagerProductsView` if scope ever permits) follow this exact recipe.
- **Audit §3 update needed at session end** — UI_AUDIT.md still lists `AdminOrdersView` and `ManagerOrdersView` as separate surfaces. Replace with one OrdersView entry.
- **Pre-v2 architecture residue:** `window.parent.showError` / `window.parent.showToast` calls in the original `AdminOrdersView.html` are confirmed unused in current architecture. Other views may have similar legacy calls — flag if discovered in future sessions but do not chase systematically.
