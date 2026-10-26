# Business Review Process — Plan

Draft. The current `/review-deep` process does not produce valid trend reads; this doc records why and holds the redesign once it is worked out. No design decided yet.

## Deficiencies (found 2026-10-26)

**Seasonality ignored.** Every trend call compares against the previous review or the previous month. JLM traffic and sales are strongly seasonal (holiday peaks, an unusual summer), so sequential comparison misreads normal seasonal swings as growth or decline. The 2026-08-21 review called organic "declining" on a summer dip while GA4 year-over-year numbers were good. The valid comparison is the same period last year.

**Inputs are snapshots, not series.** Reviews read the OPS export (`jlmops-status.md`), which carries 7-day and month-to-date figures plus a few month-over-month deltas. A "trend" is assembled by stringing spot readings from past review files together, which is noisy and short. No metric has a monthly series, and none has a year-over-year figure.

**History is too short and too thin.** The earliest recorded values are mid-2026 (subscribers from 2026-07, new-customer counts from 2026-07). Everything recorded falls inside the summer, so no review so far could have produced a seasonal read. The full history exists in the source systems (GA4, Mailchimp audience growth, `SysContacts.sc_SubscribedDate`, order archives) but the review never reaches it.

**Metrics conflated.** Reviews tracked total GA4 sessions as if they were organic until 2026-08-21, then reversed the conclusion once paid traffic was separated out.

**Stale data read as signal.** The GSC 90-day total has repeatedly frozen (feed stalls) and been carried across reviews; a byte-identical value is a broken feed, not a flat trend.

**Suspect KPIs passed through.** First-order conversion reads 0% alongside 23 new customers in 90 days; the review does not sanity-check values before interpreting them.

**Recurring flags never resolved.** The same gaps (trajectory unmeasured, GSC stale, no organic MoM) are re-raised review after review without becoming a scheduled fix.

**Lapsed cadence.** No deep review ran between 2026-08-21 and 2026-10-26.

## Requirements for a valid process (candidates, not decided)

- Every trend metric reported as year-over-year for the same period, with month-over-month only as secondary context.
- Monthly series per metric (organic sessions EN/HE, new customers EN/HE, subscribers, orders/revenue) produced by OPS from source systems, not reconstructed from past review files.
- Freshness check per input: a value unchanged past its refresh cadence is reported as stale, not interpreted.
- Sanity check per KPI before interpretation (e.g. a 0% conversion with nonzero new customers is flagged as a broken metric).
- A recurring flag either becomes a dated plan item or is dropped.

## Open questions

- Which metrics are in the core set, and does YoY need to cover 2025 (pre-cutover site) data as comparable?
- Build the monthly/YoY series inside OPS (`SysKPISummary`) or read source exports directly at review time?
- Review cadence and whether `/review-daily` needs the same treatment.
