# Business Review Process — Plan

Draft. The current `/review-deep` process does not produce valid trend reads. This doc records why, what the source data actually holds (traced 2026-11-03), and the draft design for monthly series with year-over-year. Design written at the user's request 2026-11-03; not yet approved, nothing built.

## Deficiencies (found 2026-10-26)

**Seasonality ignored.** Every trend call compares against the previous review or the previous month. JLM traffic and sales are strongly seasonal (holiday peaks, an unusual summer), so sequential comparison misreads normal seasonal swings as growth or decline. The 2026-08-21 review called organic "declining" on a summer dip while GA4 year-over-year numbers were good. The valid comparison is the same period last year.

**Inputs are snapshots, not series.** Reviews read the OPS export (`jlmops-status.md`), which carries 7-day and month-to-date figures plus a few month-over-month deltas. A "trend" is assembled by stringing spot readings from past review files together, which is noisy and short. No metric has a monthly series, and none has a year-over-year figure.

**History is too short and too thin.** The earliest recorded values are mid-2026. The full history exists in the source systems but the review never reaches it.

**Metrics conflated.** Reviews tracked total GA4 sessions as if they were organic until 2026-08-21, then reversed the conclusion once paid traffic was separated out.

**Stale data read as signal.** The GSC total has been frozen and carried across reviews; a byte-identical value is a broken feed, not a flat trend.

**Suspect KPIs passed through.** First-order conversion reads 0% alongside 26 new customers in 90 days; the review does not sanity-check values before interpreting them.

**Recurring flags never resolved.** The same gaps (trajectory unmeasured, GSC stale, no organic MoM) are re-raised review after review without becoming a scheduled fix.

**Lapsed cadence.** No deep review ran between 2026-08-21 and 2026-10-26.

## Source data as it is (traced 2026-11-03, from `exchange/JLM GSC Weekly.xlsx` and `exchange/JLM GA4 Weekly.xlsx`)

**GSC workbook.** `Sheet1` is a one-time trailing-90-day page-grouped pull of unknown dates; its totals (1,790 clicks / 100,269 impressions / pos 9.9) are exactly the frozen figures OPS exports. Since 2026-09-03 the add-on's monthly backup writes one tab per month (`Aug 2026`, `Sep 2026`, `Oct 2026`, newest second after `Sheet1`; `Backup Log` tab records each run). Each month tab is page-grouped (Page, Clicks, Impressions, CTR, Position); summed by page: Aug 595 clicks / 31,687 impr / pos 10.9, Sep 728 / 33,588 / 8.8, Oct 511 / 27,218 / 9.4.

**Why OPS froze.** `StatusReportService._readGsc` (`StatusReportService.js:399-405`) reads only the configured tab `Sheet1`, falling back to the first tab. The config note (`config/otherSettings.json:94`, 2026-07-01) assumed the add-on would keep writing into `Sheet1`; it creates a new tab per month instead. Possibly also affected by the open `ConfigService.loadConfig` multi-pair bug (`plans/BUGS.md` 2026-07-02), unconfirmed.

**GA4 workbook.** Two reports, both `90daysAgo` to `yesterday`, rewritten on every run: `JLM GA4 Weekly` (dimension `date`; sessions, activeUsers, newUsers, engagementRate, keyEvents, totalRevenue) and `Audience Weekly` (dimensions `date, audienceName, sessionMedium`, filtered to organic; same metrics plus bounceRate, screenPageViewsPerSession). No history older than 90 days is kept. OPS (`StatusReportService.js:297-339`) reduces them further to 7-day and month-to-date sums.

## Design (draft, 2026-11-03)

1. **GA4 monthly history (add-on settings, no code).** Add (or convert to) reports with dimension `yearMonth` and a fixed start date (2025-01-01 candidate) to yesterday: one for all traffic, one for organic by audience (EN IL, HE IL, Not IL), with sessions, users, new users, key events, revenue, engagement. About 22 rows per audience. Keep the existing daily reports if anything else reads them. To verify on first run: that GA4 returns months back to the start date.
2. **GSC monthly history.** One-time backfill of monthly tabs from about Jul 2025 (GSC is expected to keep 16 months; verify), then the existing monthly backup continues. `Sheet1` is ignored.
3. **OPS reads series (code).** OPS reads every month tab of the GSC workbook (by name pattern `Mon YYYY`, skipping `Sheet1`) and the monthly GA4 rows, and writes into `jlmops-status.md` a monthly table per metric for the last 13 months: organic sessions EN/HE, total sessions, key events, revenue, GSC clicks/impressions/position, each with year-over-year where the same month last year exists. The current-month partial is shown as such, never compared. The stale `otherSettings.json:94` note is rewritten.
4. **Freshness and sanity in the export.** Each input carries its newest month; one overdue past its refresh cadence is printed as STALE, not as a value. Known-broken KPIs (first-order conversion 0% with nonzero new customers) print as BROKEN until fixed.
5. **Review reads only the series.** `/review-deep` trend calls use year-over-year from the export; month-over-month is secondary context only. Snapshot figures (7d, MTD) are health, not trend.

## Open questions

- Ops data series (new customers EN/HE, orders/revenue, subscribers) from jlmops sheets and Mailchimp: same monthly + YoY treatment in step 3, or a second phase?
- Does 2025 (pre-cutover site, before 2026-05-05) count as comparable for year-over-year, or is it shown but flagged?
- Review cadence, and whether `/review-daily` needs the same treatment.
