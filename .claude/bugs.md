# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

### Open

- [ ] 2026-05-04: **Comax order export includes bundle parent SKU** — should export bundle members only (recurrence; prior fix appears lost). Filter pattern exists in InventoryManagementService.js (bundleSkus from WebProdM where wpm_TaxProductType in {woosb, bundle}).

- [ ] 2026-05-04: **Sync state-machine hardening** (bundle). The sync widget has multiple race / stale-state issues across the 12-state pipeline:
  - Generate web export button visible/clickable before the action can fire (orig 2026-01-28)
  - Export button stays visible after export step starts (orig 2025-12-29)
  - Sync widget doesn't show Comax product import stage when order export is skipped without a refresh (orig 2025-12-31)
  - Generate button stays after export completes — file is generated and named, but button doesn't reset (orig 2026-03-17, separate from the 2026-03-03 stale-poll fix)
  - Failed Comax import can't recover when a corrected file is uploaded — state stays stuck (orig 2026-03-17)

  Action: review every state transition guard, add stale-state recovery for failed imports, add idempotent re-entry handling.

- [ ] 2026-05-04: **CRM cleanup** (bundle). Resolve in one CRM-cleanup pass:
  - `sc_IsCore` defaulting conflict overwrites correct values from import (data integrity)
  - Archive mapping missing `CouponItems` field — coupon usage history lost on archive
  - Existing contact data corrupted: inconsistent `sc_IsCore` / `sc_CustomerType` on historical rows. **Requires a one-time data fix** on the Contacts sheet to repair existing rows, plus verifying import logic doesn't re-introduce mismatches.

  Also during this pass: remove the dead war-support detection code path (war support no longer relevant), and verify the simpler gift-detection rule is wired up (different shipping address + customer note ⇒ gift).

- [ ] 2026-05-04: **Audit timestamps + date formats system-wide** (folds in 2025-12-26 task-creation Israel-time bug + 2026-01-21 inconsistent date display). Walk every place dates/times are stored or rendered: task creation, sync log, order export, dashboard, manager/admin views. Standardize on Israel time for storage and 3-letter-month universal format for display ("21 Jan 2026"). Future step, not urgent.

- [ ] 2026-05-04: **Audit on-demand count-task creation** (folds in 2025-12-26 master/detail dedupe check). Walk the path that creates verification count tasks: confirm no duplicates, confirm correct-user assignment, and split data-validation tasks from count-validation tasks so they run as separate paths (don't require a count to do a data review). Future step.

### Resolved

- [x] 2026-05-04: 2026-02-09 manager orders view requires refresh to reload → verified in code: `ManagerOrdersView.html:172-174` self-executes `loadPackingSlipsData()` + `loadOpenOrdersData()` on view render, plus manual Refresh Orders button.
- [x] 2026-05-04: 2026-01-28 inventory count task — manager date / admin SKU+name → admin view shows Date/SKU/Name (c1af348, 2026-03-09); manager-view date column declared not needed.
- [x] 2026-05-04: 2026-01-20 accepted inventory counts not appearing in Comax sync → resolved per user.
- [x] 2026-05-04: 2025-12-29 changed Woo coupon plugin auto-apply URL pattern → WON'T FIX. Auto-apply coupons not worth UX downsides (silent application, URL-sharing leaks). Marketing emails surface the code as plain text instead.
- [x] 2026-05-04: 2025-12-29 new coupon plugin accepts comma-separated emails → N/A. Coupon plugin removed; first-purchase restriction is native theme code.
- [x] 2026-05-04: Gift detection keyword logic → WON'T FIX. Simpler rule decided (different shipping address + note ⇒ gift); folded into CRM cleanup verification.
- [x] 2026-05-04: War-support detection wrong field → N/A. Feature retired; remove dead code in CRM cleanup.
- [x] 2026-01-26: Bundle export to Comax (inventory) → bundleSkus filter added to generateComaxInventoryExport().
- [x] 2026-01-20: Brurya days showing 999 → RESOLVED 2026-01-23. Code fix was correct, SysConfig row had empty value from pre-fix runs, manually set scf_P02.
- [x] 2025-12-29: Packing slips bundle count → VERIFIED. PrintService.js excludes bundle products.
- [x] 2025-12-23: Sync confirmation button not appearing after order export.
- [x] 2025-12-23: Need confirmation dialog before confirming sync steps.
- [x] 2025-12-23: Sync importing full order history (832 orders).
- [x] 2025-12-23: Missing task type `task.data.review`.
- [x] 2025-12-23: ActivityBackfillService exceeds maximum execution time.
- [x] 2025-12-18: Manager order view missing billing/shipping names.
- [x] 2025-12-17: Sync step 4 shows validation status briefly.
- [x] 2025-12-17: Sync lacks final confirmation completion update.
- [x] 2025-12-15: Bundle products incorrectly flagged for Comax comparison.

## web

### Resolved

- [x] 2026-05-03: deploy-theme.ps1 didn't delete orphan files. RESOLVED: added `Delete-File` helper + orphan detection (manifest keys absent from local tree). Script now reports orphan count in the deploy header and deletes per file with retry; FTP 550 (already gone) treated as success.

## marketing

(none)

## content

(none)
