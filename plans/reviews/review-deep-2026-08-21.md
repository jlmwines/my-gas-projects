# JLM Wines — Deep Review, 2026-08-21

## 1. Situation

Recovery, not steady state, on the technical side today: a two-day production incident (`JLMops_Logs` workbook hit Google Sheets' 10M-cell limit, silently blocking Comax imports since ~08-19) was found and fixed this session (jlmops @548), alongside an unrelated live-site incident from a website deploy the day before (theme files truncated to 0 bytes, restored, deploy script hardened). Both are resolved as of today, not yet naturally re-exercised. Underneath that, the new-visitor offer popup (₪50 coupon + WhatsApp + email) shipped and was confirmed working 08-20/21 — a real, on-plan win. Content and marketing continue on their own cadences in parallel; no drift there.

## 2. Direction — is it still right?

- **Acquisition (online + offline)** still holds — content, flyer, and two live ad channels (Meta relaunch, Google Search Ads) all in cadence. One-line confirm.
- **"Sync is stable, bug fixes only"** — this review's incident is direct evidence *for* re-weighting this, not just a one-off: the SysLog failure went undetected for ~2 days because the housekeeping failure-alert system only catches thrown exceptions, not internal `return false` failures (`.claude/bugs.md`, 2026-08-21). That's a real gap in the "we'd know if sync broke" assumption underlying the current low-priority stance on reliability debt.

## 3. Performance

- **Sync/data quality:** recovering, not performing — was actively failing (`SysJobQueue` FAILED: 12, oldest 2d, per `jlmops-status.md` 01:27 snapshot) until fixed today. Needs one clean cycle to confirm.
- **Orders:** 7d 7 orders/₪3,572 — same order count as the 08-04 review (7) but ₪1,330 less revenue. Small numbers, watch not alarm.
- **New customers (90d trailing):** 4 EN + 3 HE = 7 total — **identical total to the 08-04 review**, 17 days apart. The Convert-stage gap flagged 07-27 and 08-04 hasn't moved at all in over two weeks.
- **Traffic — needs re-framing, not just re-confirming.** GA4 *total* 7d sessions are way up (488 vs 277 at 08-04), but GA4 *organic*-audience 7d sessions are only 31 (17 EN + 14 HE) — down sharply from 141 at 08-04, same data vintage (2026-08-15) both times. The "traffic nearly doubling" story from the last three reviews was tracking *total* sessions; organic itself looks to have pulled back while something else (plausibly the relaunched Meta Ads / new Google Search Ads, both live since ~08-17) fills the rest. **This changes the Convert-stage-gap diagnosis**: it may not be "acquisition outpacing conversion" so much as "organic declining while paid volume masks it in the total." Worth a real look, not another cycle of monitoring on the old framing.
- **GSC:** 1,790 clicks / 100,269 impr / pos 9.9 — **byte-identical** to the 08-04 pull, 17 days later. This is the same stall pattern that hit 05-17→06-10 and again just before 08-04 (both times required a manual sheet fix). Strongly suspect it's stalled a third time, not that search performance froze exactly in place.
- **Newsletter:** 680 subscribers (-1 MoM), 48% open / 4% click — second consecutive review of a mild click-rate dip (was 5%/7% two reviews back). Still noise-level, two points now instead of one.

## 4. Active initiatives

- **New-visitor offer popup** — shipped, live, confirmed working both languages/devices 08-20/21. Done, healthy.
- **Meta Ads bucket 18** — "top production priority" since 08-17 per `STATUS.md`; 4 days, no build movement yet. Not yet a lag at this cadence, worth a light nudge next session.
- **Google Search Ads** — launched 08-17, in Learning phase. On cadence, nothing due.
- **Region posts** — Galilee shipped 08-17 (done, both languages, confirmed). Central Mountains staged for 08-25. On cadence.
- **Flyer Round 2 (Emek Refaim)** — targeted "3rd week of August," which is now. Worth confirming it's moving.
- **Reliability debt** (`RELIABILITY_AUDIT.md` §1.5/1.6, Tier 4 DR) — unchanged, now with a fresh incident (§2) sharpening the case.

## 5. Plan vs. reality — where revision is due

No stale plan docs found this pass. One real gap, not a doc-drift issue: there's no plan doc owning the online-conversion-path question (why new customers stayed flat across four review cycles) — it's lived only as a recurring "decision outstanding" line. Given the diagnosis just shifted (§3), this is worth a real home if it's going to get investigated rather than re-flagged a fifth time.

## 6. Decisions outstanding

1. **Reliability debt investment** — carried a third time; now with direct incident evidence (this week's SysLog crisis) rather than abstract risk.
2. **Convert-stage gap, re-framed** — is it acquisition-outpacing-conversion, or organic-declining-behind-a-paid-traffic-mask? Worth a dedicated look at GA4's actual source/medium breakdown before another cycle of "monitor."
3. **GSC data freshness** — likely stalled again (byte-identical pull, 17 days). Same fix as before: check/re-run the "Search Analytics for Sheets" add-on.
4. **Offline-attribution reminder** (`defer:2026-08-10`, from last review) — now 11 days past due; flyer Round 1 redemption data status unclear from what's visible this session. Carrying forward.

## 7. Wishlist + reminders

- No wishlist movement this cycle.
- `defer:2026-08-10` offline-attribution reminder — see §6.4, now overdue rather than due.

---

## Flags → resolution

| Flag | Resolution |
|---|---|
| Sync failure-detection gap (only catches thrown exceptions) | Already logged `.claude/bugs.md` 2026-08-21 — no separate Inbox entry needed. |
| GSC byte-identical pull, 17 days | **Proposed Inbox entry**, `defer:2026-08-24` — awaiting your confirmation to add. |
| Organic-vs-total traffic divergence / Convert-gap re-framing | **Proposed Inbox entry** pointing at GA4 source/medium breakdown — awaiting your confirmation to add. |
| Offline-attribution reminder overdue | Carry forward as-is in Inbox with updated defer date — awaiting your confirmation. |
| Meta Ads bucket 18 (4 days no movement) | Dismiss as a finding — under natural cadence for creative production, just a nudge in §4. |
| Newsletter click-rate second dip | Dismiss/note — still noise-level at two points, watch next cycle. |
| Reliability debt, Convert-stage gap (original framing) | Decisions outstanding — §6.1/§6.2, carried. |
