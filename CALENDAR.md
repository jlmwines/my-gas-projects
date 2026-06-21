# JLM Wines Calendar

**Updated:** 2026-06-21 (cleanup pass — BUG_FIX_SEQUENCE session status refreshed).

## Plan-driven queues (not date-bound)

The bulk of forward work now lives in dated plan documents, not in this calendar:
- **`jlmops/plans/RELIABILITY_AUDIT.md`** — ~7 of 16 sessions shipped (2026-06-03); open: 1.3 concurrency, 3.3 Mailchimp per-recipient activity, 3.4 aggregate check, Tiers 4-6 (DR / capacity / human-process).
- **`jlmops/plans/UI_AUDIT.md`** — Tiers 1-5 essentially all shipped 2026-05-29; open: T5.2 (btn cleanup), T5.3 (shared-list, conditional), T2.1 (bundles, deprioritized), T2.4 (deferred).
- **`jlmops/plans/BUG_FIX_SEQUENCE.md`** — Sessions A-E and G shipped; open: F (sync hardening, needs staging repro), H (timestamp audit), I (count-task audit). validateDeployment resolved at root (Session E, removed not fixed).

This calendar tracks only items that are NOT inside one of those plan queues.

## Upcoming

| Date | Area | Item | Notes |
|------|------|------|-------|
| — | jlmops | Campaign segment export | Backlog. Needs `CampaignService.getTargetSegment()` build. Calendar-tracked because not in current plan queues. |
| — | jlmops | Comeback campaign test | After segments reviewed. |
| — | jlmops | Year in Wine PDF research | PDF generation options. |
| — | Marketing | Tuesday evening test send | After segments ready. |
| — | jlmops | Bundle handling (staged) | `jlmops/plans/BUNDLE_PLAN.md` — consolidated master plan (refresh → author/export → integrity → profit → diversity). Also Phase 14 in `IMPLEMENTATION_PLAN.md`. Distinct from reliability/UI audits. |
| — | Website | Update bundle & package product images | Refresh / replace the product images for the bundle and package (woosb) products on the site. |
| — | jlmops | Housekeeping last-run markers cleanup | Three SysConfig markers written by `HousekeepingService.js` lines 995, 1127, 1782 with the buggy 2-arg `setConfig` signature AND no row in `config/system.json`. Every housekeeping run appends a junk row to live SysConfig. Sweep: (1) add 3 rows to `config/system.json` with `scf_P01='value'`, empty value, (2) regenerate via `node jlmops/generate-config.js`, (3) fix the 3 caller signatures to 3-arg, (4) run `rebuildSysConfigFromSource()`, (5) manually delete junk rows for those names + the two MC names from live SysConfig. **Not in reliability audit** — concrete operational fix that doesn't fit a tier. Consider folding into a quick-wins session. |

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
