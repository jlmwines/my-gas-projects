# JLM Wines — Deep Review, 2026-08-04

## 1. Situation

Steady state on the technical side: jlmops @544 has run 9 clean days since the 07-26 WebXltM incident fix (0 recent errors, 15/15 tests, schema clean). The week's dominant activity was elsewhere — six days (07-30 → 08-03) of Meta Ads bucket-8 creative iteration in Canva/Paint.NET, finished as of 08-03 into a ready 23.9s reel; the campaign itself hasn't been built in Ads Manager yet, as of one day later. Content and flyer work continue on their own cadences in parallel.

## 2. Direction — is it still right?

- **Acquisition (online + offline)** still holds per `STRATEGY.md` — one-line confirm. Content on cadence; flyer live.
- **"Sync is stable, bug fixes only"** — held; no rebuild activity, reliability debt untouched (carried decision, see §6).
- Worth naming as a nudge, not a lag finding: `META_ADS_PLAN.md` itself already says (line 115) "Next action. **Not asset production anymore** — build the base campaign manually." The reel finished 08-03; the 08-04 session spent its remaining time checking two shortcuts (bulk-import-creates-campaign, an official Meta MCP server) before that build — reasonable diligence on a same-day basis, not neglect. Flagging only because the plan's own line is the next concrete step whenever the manager next picks this up.

## 3. Performance

- **Sync/data quality:** performing, unchanged and clean since the fix.
- **Orders:** 7d 7 orders/₪4,902 (up from 5/₪3,594 last review). MTD is only 4 days into August — not yet meaningful.
- **New customers (90d trailing):** 5 EN + 2 HE (7 total), vs 3 EN + 1 HE prior period — continues improving.
- **Return rate:** 7% (flat vs 7% last month) — still shaky per the known retroactive-snapshot caveat.
- **Newsletter:** 682 subscribers (~flat), avg 47% open / 5% click — down a touch from 50%/7% last review. One data point, not yet a trend; watch next cycle.
- **Organic traffic:** durable uptrend continues — 7d organic 85 EN/56 HE = 141 (vs 93 at 07-27 review; vs 39 at 07-17). Total GA4 7d sessions 277 (vs 159 at 07-27) — nearly doubled again.
- **New customers vs. traffic — the gap persists a third review running.** Total 7d sessions have gone 65 → 159 → 277 across the last three reviews (roughly 4x), but trailing-90d new customers sit at 7. This is the Convert-stage gap flagged 07-27, still not scaling with Acquire-stage gains.
- **GSC:** confirmed stalled, then fixed and re-pulled mid-session — user corrected the "JLM GSC Weekly" sheet setup and re-ran it. Fresh numbers: **1,790 clicks / 100,269 impr / avg pos 9.9** (down from the stale 2,140 / 117,221 / 9.5 that had persisted unchanged since ≤07-27; Δ -350 clicks / -16,952 impr on the live pull). Top pages reshuffled too (`/he/` now ahead of `/he/about/`). One pull isn't enough to read as a real decline vs. a trailing-90d window effect (old high-click days rolling out now that the sheet is current again) — needs one more pull to distinguish. `KPI.md`'s prior stall incident (05-17 → 06-10) recurred and is now resolved.

## 4. Active initiatives

- **Meta Ads bucket 8** — asset production complete 08-03 (23.9s reel, live-tested). Plan's own next step is the manual campaign build; not yet started as of one day later — not a lag, just the next thing in queue.
- **Region posts** — Galilee (due 08-11) in progress, Central Mountains staged for 08-25. On cadence.
- **Flyer** — Round 1 (Talbiye) distributed 07-26/27, 9 days elapsed, redemptions still unread. Round 2 (Emek Refaim) targeted 3rd week of August is now close — worth checking whether Round 1 data will be readable in time to inform Round 2, or whether Round 2 proceeds regardless.
- **Reliability debt** — unchanged since 07-27: `RELIABILITY_AUDIT.md` §1.5/§1.6 open, Tier 4 (DR/backup) unshipped.
- **Server-side authorization program** — no movement; sitting at 3 reviews without a dedicated session, not urgent but aging.

## 5. Plan vs. reality — where revision is due

No stale docs found this pass — the 07-31/08-02 cleanup session already reconciled the bugs.md/session-log conflict and swept the portfolio. The one gap is execution-lag, not doc drift: `META_ADS_PLAN.md`'s own "next action" line is current and correct, but the last several sessions haven't followed it (see §2, §6). No in-session doc fix needed.

## 6. Decisions outstanding

1. **Reliability debt** (`RELIABILITY_AUDIT.md` §1.5, §1.6, Tier 4 DR) — dedicated session or keep riding acquisition focus? (Carried from 07-27, still unresolved.)
2. **Convert-stage gap** — traffic has ~4x'd over three review cycles while new customers stayed flat-ish. Worth a dedicated look at the first-order coupon/landing conversion path now, or one more cycle of monitoring? (Carried from 07-27, sharper this cycle.)
3. ~~**GSC data freshness**~~ — resolved mid-session: sheet setup corrected, re-pulled, numbers now moving (1,790 clicks / 100,269 impr / pos 9.9). New watch item: confirm the -350 click / -16,952 impr drop is a real trend and not just the trailing-90d window catching up after the stall — read against the next pull.

**Not a decision — dropped:** Meta Ads campaign build. Initially flagged here as an "execution lag," which was wrong — the reel finished 08-03, this review ran 08-04. Under a day is not a lag. It's just the next queued step on `META_ADS_PLAN.md`, same as any other backlog item; no decision needed from you, no urgency implied.

## 7. Wishlist + reminders

- No wishlist movement this cycle.
- Reminder: offline-attribution `defer:2026-08-10` — due in 6 days, now genuinely load-bearing with the flyer live.

---

## Flags → resolution

| Flag | Resolution |
|---|---|
| GSC byte-identical pull past its expected refresh date | Resolved in-session — user corrected sheet setup, re-pulled, data now current (1,790/100,269/9.9). No Inbox entry needed. |
| Meta Ads "execution lag" (§2, originally) | Dismiss — was a bad finding, not a real one. Reel finished 08-03, review ran 08-04; under a day isn't a lag. Corrected in §2/§4/§6 above; not carried forward as a decision. |
| Reliability debt investment | Decision outstanding — §6.1, carried unresolved from 07-27 |
| Convert-stage gap (traffic vs. new customers) | Decision outstanding — §6.2, carried and sharpened from 07-27 |
| Newsletter open/click dip (50%/7% → 47%/5%) | Dismiss/note — single data point, watch next cycle, not yet a finding |
