# JLM Wines Calendar

**Updated:** 2026-05-28 (cleanup pass — most "Upcoming" items absorbed into new plan docs; remaining items keep their backlog framing.)

## Plan-driven queues (not date-bound)

The bulk of forward work now lives in dated plan documents, not in this calendar:
- **`jlmops/plans/RELIABILITY_AUDIT.md`** — 16 sequenced sessions (data integrity / operational reliability / visibility / DR / capacity / human-process). Includes Mailchimp per-recipient activity rows (was Calendar item; now Tier 6.3).
- **`jlmops/plans/UI_AUDIT.md`** + 18 deep-dives — 17 active sessions + 1 prerequisite + 2 deferred.
- **`jlmops/plans/BUG_FIX_SEQUENCE.md`** — Sessions A-D shipped; E-I queued (validateDeployment, sync hardening repro, search latency, timestamps audit, count-task audit).

This calendar tracks only items that are NOT inside one of those plan queues.

## Upcoming

| Date | Area | Item | Notes |
|------|------|------|-------|
| — | jlmops | Campaign segment export | Backlog. Needs `CampaignService.getTargetSegment()` build. Calendar-tracked because not in current plan queues. |
| — | jlmops | Comeback campaign test | After segments reviewed. |
| — | jlmops | Year in Wine PDF research | PDF generation options. |
| — | Marketing | Tuesday evening test send | After segments ready. |
| — | jlmops | Bundle handling (staged) | `jlmops/plans/BUNDLE_PLAN.md` — consolidated master plan (refresh → author/export → integrity → profit → diversity). Also Phase 14 in `IMPLEMENTATION_PLAN.md`. Distinct from reliability/UI audits. |
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
