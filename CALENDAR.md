# JLM Wines Calendar

**Updated:** 2026-07-10 (content calendar table retired in favor of `content/PUBLICATION_CALENDAR.md`; plan-driven queues reconciled).

## Plan-driven queues (not date-bound)

The bulk of forward work now lives in dated plan documents, not in this calendar:
- **`jlmops/plans/RELIABILITY_AUDIT.md`** — ~7 of 16 sessions shipped (2026-06-03); open: 1.3 concurrency, 3.3 Mailchimp per-recipient activity, 3.4 aggregate check, Tiers 4-6 (DR / capacity / human-process).
- **`jlmops/plans/UI_AUDIT.md`** — Tiers 1-5 essentially all shipped 2026-05-29; open: T5.2 (btn cleanup), T5.3 (shared-list, conditional), T2.1 (bundles, deprioritized). T2.4 resolved 2026-07-08 (folded into `CALENDAR_LIBRARY_LOOP_PLAN`'s shared `ContentStreamModal.html`).
- **`jlmops/plans/BUG_FIX_SEQUENCE.md`** — Sessions A-E and G shipped; open: F (sync hardening, needs staging repro), H (timestamp audit), I (count-task audit). validateDeployment resolved at root (Session E, removed not fixed).

This calendar tracks only items that are NOT inside one of those plan queues.

## Content Calendar

Superseded by `content/PUBLICATION_CALENDAR.md`, which is actively maintained and reconciled against the live calendar sheet (`JLMops_Publishing`) each time slots change — this file no longer keeps its own copy of the schedule (the two had drifted: this table still showed the pre-Negev slot order and stale dates as of 2026-06-21). See that doc for region-post slot assignments and `content/REGION_POSTS_PLAN.md` for per-region production status.

## Upcoming

| Date | Area | Item | Notes |
|------|------|------|-------|
| — | jlmops | Campaign segment export | Backlog. Needs `CampaignService.getTargetSegment()` build. Calendar-tracked because not in current plan queues. |
| — | jlmops | Comeback campaign test | After segments reviewed. |
| — | jlmops | Year in Wine PDF research | PDF generation options. |
| — | Marketing | Tuesday evening test send | After segments ready. |
| — | jlmops | Bundle composite-weight tuning | Bundles implemented (`jlmops/docs/WORKFLOWS.md` §15); `GENERATOR_WEIGHTS` in `BundleService.js` is still one global tunable, not per-slot/per-bundle overrides. |
| — | Website | Update bundle & package product images | Refresh / replace the product images for the bundle and package (woosb) products on the site. |

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
