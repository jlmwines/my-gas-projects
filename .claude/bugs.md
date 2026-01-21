# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

### Open
- [ ] 2026-01-21: dates displayed in USA format - should use universal format with 3-letter month (e.g., 21 Jan 2026)
- [ ] 2026-01-20: previous brurya task st_DoneDate jan 02, but current brurya task shows 999 days since completed - FIX APPLIED: missing 'value' arg in setConfig call, pending verification
- [ ] 2026-01-20: accepted inventory counts are removed from admin inventory view, but do not appear below in comax sync without refreshing the view
- [ ] 2025-12-26: task creation timestamp is not always local Israel time - FIX APPLIED: _getIsraelMidnight() helpers added, needs overnight verification
- [ ] 2025-12-26: check if product master/detail task duplicate creation is prevented
- [ ] 2025-12-29: sync shows export button after export starts, then refreshes to confirm stage
- [ ] 2025-12-29: changed woo coupon plugin - auto apply url pattern changed to {site_url}/?wt_coupon={coupon_code}
- [ ] 2025-12-29: new coupon plugin accepts email addresses separated by commas, not user id's
- [ ] 2025-12-31: sync needs refresh to show comax product import when order export skipped
- [ ] sc_IsCore defaulting conflict overwrites correct values from import
- [ ] Gift detection incomplete (missing delivery keyword logic)
- [ ] War-support detection checks wrong field (customerNote instead of wom_CouponItems)
- [ ] Archive mapping missing CouponItems field
- [ ] Existing contact data corrupted (inconsistent sc_IsCore/sc_CustomerType)

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
