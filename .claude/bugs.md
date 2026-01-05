# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

### Open
- [x] 2026-01-05: increase size of sync status notification text - FIXED: bumped from 1.1rem to 1.3rem
- [x] 2026-01-05: sync timestamp is not local Israel time (looks like GMT) - FIXED: explicit Asia/Jerusalem timezone
- [x] 2026-01-05: admin dashboard task counts wrong - FIXED: V1 missing 'Assigned' status, V2 wrong task type + no status filter
- [ ] 2025-12-26: task creation timestamp is not always local Israel time
- [ ] 2025-12-26: check if product master/detail task duplicate creation is prevented
- [ ] 2025-12-29: sync shows export button after export starts, then refreshes to confirm stage
- [ ] 2025-12-29: changed woo coupon plugin - auto apply url pattern changed to {site_url}/?wt_coupon={coupon_code}
- [ ] 2025-12-29: new coupon plugin accepts email addresses separated by commas, not user id's
- [ ] 2025-12-31: sync needs refresh to show comax product import when order export skipped
- [x] 2026-01-02: brurya edits only possible through file import, not accepted on screen, task not updated after submission - FIXED: SKU type mismatch + missing task close
- [ ] sc_IsCore defaulting conflict overwrites correct values from import
- [ ] Gift detection incomplete (missing delivery keyword logic)
- [ ] War-support detection checks wrong field (customerNote instead of wom_CouponItems)
- [ ] Archive mapping missing CouponItems field
- [x] Duplicate _classifyCustomerType function in ContactImportService - NOT A BUG: functions defined once in ContactService.js, correctly called from ContactImportService
- [x] Duplicate _calculateLifecycleStatus function in ContactImportService - NOT A BUG: same as above
- [ ] Existing contact data corrupted (inconsistent sc_IsCore/sc_CustomerType)
- [x] 2026-01-05: Packing slip wine info order wrong - FIXED: reordered layout, compact RTL header, pairing enrichment
- [ ] 2026-01-05: printme folder not in housekeeping routine

### Resolved
- [x] 2025-12-29: Packing slips bundle count - VERIFIED: PrintService.js excludes bundle products
- [x] 2025-12-23: Sync confirmation button not appearing after order export
- [x] 2025-12-23: Need confirmation dialog before confirming sync steps
- [x] 2025-12-23: Sync importing full order history (832 orders)
- [x] 2025-12-23: Missing task type 'task.data.review'
- [x] 2025-12-23: ActivityBackfillService exceeds maximum execution time
- [x] 2025-12-18: Manager order view missing billing/shipping names
- [x] 2025-12-17: Sync step 4 shows validation status briefly
- [x] 2025-12-17: Sync lacks final confirmation completion update
- [x] 2025-12-15: Bundle products incorrectly flagged for Comax comparison

## web

(none)

## marketing

(none)

## content

(none)
