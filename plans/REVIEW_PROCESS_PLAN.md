# Business Review Process — Plan

The current `/review-deep` process does not produce valid trend reads. This doc records why, what the source data actually holds (traced 2026-11-03), and the design. Phase 1 done 2026-11-03: steps 1-3 live @605, verified in `jlmops-status.md` (series match the exported workbooks; BROKEN label showing); step 4 in `~/.claude/commands/review-deep.md` (reads step 6 + "Reading the data" rules). Phase 2 not started.

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

**Phase 1 first: make current and recent data accurate and available from what the sheets already hold (user 2026-11-03).** No add-on changes, no history questions.

1. **GSC from the month tabs (code).** OPS stops reading `Sheet1` and reads every month tab (name pattern `Mon YYYY`): per month total clicks, impressions, impression-weighted position, plus top pages for the newest month. Today that is Aug, Sep, Oct 2026; each monthly backup adds one. The stale `otherSettings.json:94` note is rewritten.
2. **GA4 series from the existing 90-day daily rows (code).** OPS keeps the daily rows it already reads but reports them as series instead of only 7d/MTD: the last 12 complete Sun-Sat weeks and every month inside the window (today Sep and Oct 2026 complete; Aug partial and labeled so). All traffic: weekly sessions/key events; monthly sessions, new users, key events, revenue, engagement. Organic: weekly EN/HE sessions; monthly EN/HE sessions plus combined new users, key events, revenue, bounce, pages/session. Users are left out of the series (daily active users don't add up across days).
3. **Freshness and sanity in the export.** Each input prints its newest data date. GA4 data more than 9 days old (the add-on reports are weekly) and a missing GSC month tab (last month expected once 10+ days into the current month) print as STALE. First-order conversion at 0% with nonzero new customers prints as BROKEN. A partial month is labeled and never compared.
4. **Review reads the series.** `/review-deep` reports these as recent direction, explicitly without seasonal adjustment until phase 2; 7d/MTD stay health figures.

**Phase 2 later: year-over-year.** Needs history the sheets don't hold today: GA4 reports with dimension `yearMonth` from a fixed start date (add-on settings), and a one-time GSC backfill of earlier month tabs. Whether the sources return that far back is checked when phase 2 starts, by running it. OPS then adds the same-month-last-year column to each series.

## Open questions

- Ops data series (new customers EN/HE, orders/revenue, subscribers) from jlmops sheets and Mailchimp: add to phase 1, or later?
- Does 2025 (pre-cutover site, before 2026-05-05) count as comparable for year-over-year, or is it shown but flagged?
- Review cadence, and whether `/review-daily` needs the same treatment.
