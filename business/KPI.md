# JLM Wines — KPI Scope

**Status.** The live working definition of JLM's KPIs. Data path is live end-to-end: GA4 + GSC Sheets add-ons refresh on schedule, and the jlmops-side KPI block reads them into `jlmops-status.md` (orders/customers, GA4 traffic, GSC top-pages + week-over-week trend via SysConfig snapshot) on a daily cadence plus on-demand. Refine as measurements accumulate.

---

## Strategic frame (informs every KPI choice)

JLM is not a price-and-catalog competitor. It's a curation/relationship model. Customers come (often via search), we show them why we're different, we keep them long enough to convert from comparison-shoppers into JLM-style customers (who trust the curation and reorder).

That frame produces three operating priorities:
1. **Acquire** — get new customers, especially Hebrew-speaking, especially in Jerusalem.
2. **Convert** — once they arrive, get them past comparison-shopping. The first-order NIS 50 coupon (tied to the NIS 399 free-shipping threshold) does the financial work; content + Evyatar do the trust work.
3. **Retain** — keep them ordering. Goal: an order at least every 90 days (not the 57 days quoted in `website/MARKET_CONTEXT.md` — that was an observed stat, not a goal).

Each KPI below maps to one of those three.

**Strategic context that is NOT a KPI** (but shapes decisions):
- **Jerusalem-area share of new customers** — Jerusalem is the easiest growth market (physical store, word-of-mouth, flyer-drop reachability). Knowing the geo split helps us aim, but tracking it weekly doesn't change what we do.
- **The flyer-drop SE of Katamon** (specific neighborhood TBD) — independent of the winery-coordinated marketing.

---

## The KPI list (6 metrics)

### 1. Total organic traffic (EN/HE split)

**Maps to:** Acquire.

**Why total, not branded-vs-non-branded.** All organic traffic has similar value to JLM. Whether someone arrived searching "JLM Wines" (knew us already) or "kosher wine Jerusalem" (didn't), the conversion job is the same: show curation, show Evyatar, get them to stop comparison-shopping. So we don't split by query type. Just count the volume of conversion opportunities by language.

**Data source:** GA4 (Source/Medium = `google / organic`, dimension Language).

### 2. New customers / month (EN/HE split)

**Maps to:** Acquire (the outcome metric).

**Why split by language.** Hebrew growth is the primary lever. English is the existing competitive moat (covered well already). HE expansion is where lift comes from.

**Data source:** jlmops (`JLMops_Data` → SysOrdLog + WebOrdM, filter on first-order flag, group by language).

### 3. First-order conversion + AOV

**Maps to:** Convert.

**What's in it:** % of new customers who place an order using the NIS 50 coupon, average value of those first orders.

**Data source:** jlmops (order data with coupon_code field) + Mailchimp (campaign attribution if order followed a campaign).

### 4. 90-day return rate

**Maps to:** Retain (the goal-aligned metric).

**Definition:** % of customers with at least one order in the trailing 90 days. Target: trend upward over time.

**Data source:** jlmops (SysOrdLog aggregated by customer).

### 5. Newsletter signups + open/click

**Maps to:** Acquire (signups) + Retain (engagement).

**What's in it:** Total subscribers (with EN/HE Language interest groups), monthly growth, weekly open + click rates per campaign.

**Data source:** Mailchimp. Comes through jlmops Half 1 (Mailchimp daily pull) once that ships. Until then, manual API pull or read from Mailchimp UI.

**Activates:** When newsletter v1 first issue ships post-cutover.

### 6. Organic-source engagement

**Maps to:** Convert (the funnel-quality metric).

**What's in it:** Bounce rate and pages-per-session for visitors arriving via organic search. Signal of "are we keeping them long enough to absorb the curation message?"

**Data source:** GA4 (Source/Medium = organic, segmented metrics).

---

## Excluded from this list (with reasons)

- **GSC top queries + CTR.** Mostly branded + product-name searches that don't represent new-customer acquisition. Useful as a **diagnostic tool** (pull when investigating a drop) but not a weekly metric. No active SEO work needed for the brand name itself — it ranks fine without effort.
- **Lighthouse score.** Already captured in `plans/STATUS.md` as a pre/post-cutover sanity check; not a recurring business KPI.
- **Total revenue / weekly revenue.** Reasonable to look at, but the trailing measures above (#2, #4) drive it more usefully than the top-line itself.
- **Jerusalem-area customer share.** Strategic context, not a tracked metric (see "Strategic frame" above).

---

## Cadence

**Weekly review.** Not automated alerts — periodic discussion. User reads the data, surfaces what's interesting, we talk about it.

**No alert thresholds.** Per user preference: human review beats automated nags at this volume. We'll define thresholds later if a specific number proves useful to monitor.

---

## Data path

### What's in place
- **Drive auth** for `accounts@jlmwines.com` (done 2026-05-04). Claude can read directly from the business Drive.
- **`JLMops_Data` lives in this Drive** (3MB live spreadsheet — SysOrdLog, WebOrdM, SysTasks, etc., all the sheets jlmops reads/writes). Modified daily by the GAS code. Claude can read sheet contents directly.
- **`JLMops_Logs`** also in Drive (operational logs).
- **Daily exports** (Comax order export, web inventory export, Comax inventory export) land in Drive folders.
- **Setup guide** for GA4 + GSC → Sheets is in Drive root (file ID `1QWTJmlj-wvHYk3SfdTvPj7gxskEqPx2HDEznILljRYM`, "JLM Wines — GA4 + GSC to Drive: Setup Guide"). User runs the 15-min × 2 setup when ready.
- **GA4 + GSC sheets BUILT and REFRESHING (restored 2026-06-10):**
  - **"JLM GA4 Weekly"** — id `12zBAZZPfhWqLGLsf1Lu8-eOMcYKOyi_HrlGkSmPkTFU` (GA4 property `279950414`, rolling 90-day, end = yesterday, Sheets add-on). Refreshing (last ran 2026-06-10). _(Had stalled 2026-05-17 → 2026-06-10; re-enabled.)_
  - **"JLM GSC Weekly"** — id `1535CDgL8oD8o2L5ceOTAXtxrXGVnRgQfEddfc3b6hHc`. **Monthly cadence (3rd)** via Search Analytics for Sheets; recurring backup re-enabled + **Date dimension added** 2026-06-10 (was Page-only, so no trend accumulated before). _(Had not recurred since 2026-05-07.)_
  - Both are **multi-tab** (Report + Configuration), so sessions/Drive MCP can NOT read them usefully — **only OPS (GAS) reads them and flattens KPIs into the shared one-tab export (`jlmops-status.md` KPI block) that sessions consume.** Sessions never open these source workbooks directly, and don't verify them — that's OPS's job (or a human eyeball in the sheet UI).

### What's needed
1. ~~**Restart the GA4 + GSC weekly pulls**~~ **DONE 2026-06-10** — both add-ons re-enabled and refreshing (GA4 daily-ish/rolling, GSC monthly on the 3rd with a Date dimension now). The KPI-automation prerequisite is cleared.
2. ~~**Summary tab in `JLMops_Data`**~~ **SHIPPED 2026-07-02 @430.** `SysKPISummary` computes the 4 jlmops-source metrics (new customers, first-order conversion, AOV, 90-day return rate) daily and feeds `jlmops-status.md`'s "Business KPIs" block — no jlmops UI. Spec → `jlmops/plans/KPI_SUMMARY_TAB.md`.
3. **Mailchimp metrics flow** — comes through jlmops Half 1 (Mailchimp daily API pull). Already planned in `jlmops/plans/CONTACT_MANAGER_PLAN.md`. Don't double-plan.

### Sequence
- **Now:** scope captured (this doc).
- **After cutover settles:** user runs GA4 + GSC sheet setup → Claude verifies end-to-end read.
- **In parallel or after:** add summary tab to `JLMops_Data` in a small jlmops deploy.
- **After jlmops Half 1 ships:** newsletter metrics start flowing.
- **Then:** we do the first weekly review session against real data.

---

## Related documents

- `website/MARKET_CONTEXT.md` — market segmentation, growth strategy, the "57 days" stat (correction: should be reframed as observed, not goal — the working goal is 90 days; update when we revisit MARKET_CONTEXT)
- `business/STRATEGY.md` — strategic posture and direction principles (acquisition focus, build-less-data principle) that frame KPI priorities
- `plans/STATUS.md` — current state of cross-area initiatives that produce or consume KPI data (newsletter, Contact Manager, cross-sell)
- `marketing/NEWSLETTER_PLAN.md` — newsletter mechanics (KPI #5 source)
- `jlmops/plans/CONTACT_MANAGER_PLAN.md` — Mailchimp daily pull (KPI #5 wiring)
- `claudeops/plans/STATUS.md` — meta-tracking of "do we have the right structure"; pointer back to this doc

---

## Future expansion (not now)

- **Offline-channel attribution.** When SE-of-Katamon flyers + newsletter inserts ship, we need per-channel attribution. Lightest path: unique coupon codes per offline campaign (e.g., `JLMSE50`) + UTM-tagged QR codes feeding GA4. The first-order coupon system already supports per-code restrictions. Add this section when offline campaigns are scheduled.
- **Per-bundle / per-package performance.** Once cross-sell + bundle health data are flowing reliably, ratio of bundle-vs-individual-bottle orders is interesting.
- **Customer cohort retention.** Once 90-day-return rate is a stable read, look at cohort retention by acquisition month (does April's cohort behave differently than March's?). Slow-data analysis, not weekly.

---

Updated: 2026-07-02 (jlmops KPI block live in `jlmops-status.md`, reworked to its Page-grouped GSC design; 5 of 6 KPIs now compute automatically — 4 via `SysKPISummary`'s "Business KPIs" block, KPI #1 organic-traffic EN/HE split via a dedicated GA4 audience report ("Audience Weekly" tab, audiences Not IL/EN IL/HE IL) surfaced in the Traffic block. Only KPI #6 organic-source engagement remains unbuilt.)
