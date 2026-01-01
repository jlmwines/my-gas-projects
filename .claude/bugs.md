# Bugs

Active bugs to fix. Mark with [x] when resolved.

- [x] 2025-12-15: Skipping product 61806 (BBQ (Al Ha-Esh) Package): Not found in Comax master data. (Bundle products should be exempted from Comax comparisons) - RESOLVED 2025-12-17
- [x] 2025-12-17: sync step 4 briefly shows validation status after beginning import. - RESOLVED 2025-12-17
- [x] 2025-12-17: sync lacks final confirmation completion update - sync should show completed - RESOLVED 2025-12-17
- [x] 2025-12-18: manager order view shows packing slip order and status, but not billing name, shipping name, customer note - RESOLVED: WebOrdM header row was corrupted
- [x] 2025-12-23: Missing task type 'task.data.review' in TaskService.createTask. - RESOLVED: Added to taskDefinitions.json
- [x] 2025-12-23: ActivityBackfillService exceeds maximum execution time, causing housekeeping to fail. - RESOLVED: Added 4-minute time budget with graceful exit.
- [x] 2025-12-23: Sync importing full order history (832 orders instead of 1-3). Import files remain in folder after processing. - RESOLVED: Fixed _processWebOrdersFiles() to only import newest file; archiveFile() now deletes original after archiving.
- [x] 2025-12-23: Sync confirmation button not appearing after order export. Progress log not updating. - RESOLVED: Added comaxOrdersExported to getActiveSession(); added progress entry for order export waiting state.
- [x] 2025-12-23: Need confirmation dialog before confirming sync steps updating web and comax. - RESOLVED: Added confirm() to confirmWeb(); confirmComax() already had one.
- [ ] 2025-12-26: task creation timestamp is not always loacl israel time. dates can be incorrect as a result.
- [ ] 2025-12-26: check if product master/detail task duplicate creation is prevented
- [x] 2025-12-29: packing slips - only actual products within the bundle should show in count (verify behavior) - VERIFIED: PrintService.js excludes bundle products (woosb) from total, only components count
- [ ] 2025-12-29: sync shows export button after export starts, then refreshes to confirm stage (UI state timing issue)
- [ ] 2025-12-29: jlmops changed woo coupon plugin - auto apply url pattern changed to {site_url}/?wt_coupon={coupon_code}
- [ ] 2025-12-29: jlmops new coupon plugin accepts email addresses separated by commas, not user id's - need to update output
- [ ] 2025-12-31: jlmops sync needs refresh to show comax product import when order export to comax skipped
