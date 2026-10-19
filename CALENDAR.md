# JLM Wines Calendar

**Updated:** 2026-10-19.

## Plan-driven queues (not date-bound)

The bulk of forward work now lives in dated plan documents, not in this calendar:
- **`jlmops/plans/RELIABILITY_AUDIT.md`** — open: 1.5 empty-master hard-crash, 1.6 multi-phase pull atomicity, 3.3 Mailchimp per-recipient activity, 3.4 aggregate check, Tiers 4-6 (DR / capacity / human-process). 1.3 concurrency was built via `SYNC_HARDENING_PLAN.md`.
- **`jlmops/plans/UI_AUDIT.md`** — open: T5.2 (btn cleanup), T5.3 (shared-list, conditional), T2.1 (bundles, deprioritized).
- **`jlmops/plans/BUG_FIX_SEQUENCE.md`** — open: H (timestamp audit), I (count-task audit). Session F folded into `SYNC_HARDENING_PLAN.md`.
- **`jlmops/plans/SYNC_HARDENING_PLAN.md`** — open: Bugs 1/3 (need a live repro), step 9 `JLMops_Logs` cleanup (queued behind Test Suite Tier 4).

This calendar tracks only items that are NOT inside one of those plan queues.

## Content Calendar

Authoritative source is the live [`JLMops_Publishing` calendar sheet](https://docs.google.com/spreadsheets/d/1xnhFKCPUkvVdMy7GWXDWwiipT6j028ZrZ_69GJ6HWjc) directly — "calendar is king" (`jlmops/docs/DATA_MODEL.md` "Publishing Calendar"). `content/PUBLICATION_CALENDAR.md`, a manually-reconciled markdown mirror, was removed 2026-07-23 as a stale duplicate of that sheet. See `content/plans/REGION_POSTS_PLAN.md` for per-region production status.

## Upcoming

| Date | Area | Item | Notes |
|------|------|------|-------|
| — | jlmops | Campaign segment export | Backlog. Needs `CampaignService.getTargetSegment()` build. Calendar-tracked because not in current plan queues. |
| — | jlmops | Comeback campaign test | After segments reviewed. |
| — | jlmops | Year in Wine PDF research | PDF generation options. |
| — | Marketing | Tuesday evening test send | After segments ready. |
| — | jlmops | Bundle composite-weight tuning | Bundles implemented (`jlmops/docs/WORKFLOWS.md` §15); `GENERATOR_WEIGHTS` in `BundleService.js` is still one global tunable, not per-slot/per-bundle overrides. |
| — | Website | Package product images (folk-art set) | In progress, user generating in Canva. Value bundle images stay. Plan: `website/PACKAGE_IMAGES_PLAN.md`. |

## Recurring

| Frequency | Item |
|-----------|------|
| Daily (when active) | Sync workflow runs — monitor for failures |
| Monthly | Check bundle additions for stale data |

