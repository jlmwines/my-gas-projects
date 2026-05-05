# JLM Wines Calendar

**Updated:** 2026-02-18

## Upcoming

| Date | Area | Item | Notes |
|------|------|------|-------|
| — | jlmops | Campaign segment export | First step back after pause |
| — | jlmops | Comeback campaign test | After segments reviewed |
| — | jlmops | Year in Wine PDF research | PDF generation options |
| — | Marketing | Tuesday evening test send | After segments ready |
| — | jlmops | Bundle composition / member condition split | After MC pull lands. Phase 14 in `jlmops/plans/IMPLEMENTATION_PLAN.md`: "Re-sync bundle membership" button (user-driven), separate stock health check, "Run bundle analysis" entry from sync widget post-COMPLETE. |
| — | jlmops | Campaign-recipient activity rows on contacts | After Half 1 settles. Per-contact `campaign.received` activity (recipient list only — not opens/clicks). Use: order-after-send attribution clue (GA4 covers the rest). Also seeds the activity timeline shape needed for Half 2 partner-contact records. Endpoint `/reports/{id}/sent-to`, idempotent insert keyed on campaign + email. |
| — | jlmops | Housekeeping last-run markers cleanup | Three SysConfig markers (`system.bundle_health.last_check`, `system.crm.last_refresh`, `system.crm_intelligence.last_run`) are written by `HousekeepingService.js` lines 995, 1127, 1782 with the buggy 2-arg `setConfig` signature AND have no row in `config/system.json`. Result: every housekeeping run appends a junk row to live SysConfig. Sweep: (1) add 3 rows to `config/system.json` with `scf_P01='value'`, empty value, (2) regenerate via `node jlmops/generate-config.js`, (3) fix the 3 caller signatures to 3-arg, (4) run `rebuildSysConfigFromSource()`, (5) manually delete junk rows for those names + the two MC names from live SysConfig. |

## Recurring

| Frequency | Item |
|-----------|------|
| Daily (when active) | Sync workflow runs — monitor for failures |
| Monthly | Check bundle additions for stale data |

## Completed

| Date | Item |
|------|------|
| 2025-12-25 | Import system fixes (CSV filter, validation, quarantine) |
| 2025-12-22 | CRM Phase 2 dual-language enrichment |
| 2025-12-22 | Campaign system planning |
