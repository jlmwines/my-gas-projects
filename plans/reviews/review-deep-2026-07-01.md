# JLM Wines — Deep Review, 2026-07-01

First deep review (no prior to compare against).

## 1. Situation

Steady-state operation. Recent engineering effort (jlmops UI/infrastructure: ds-v2 rollout, Unified Task UI convergence, new-product onboarding hardening, today's content-workflow + library-attach fixes) has been heavy, and running alongside it, acquisition-channel work continues on its own tracks: flyer round 1 in production, region-post drafting in progress, print newsletter in ongoing physical distribution. Site health (sync, data quality, integrations) is clean.

## 2. Direction — is it still right?

`business/STRATEGY.md` (updated 2026-05-15, within its quarterly window — not stale) names this period's lever explicitly: **acquisition, online + offline**, de-prioritizing further internal build relative to acquisition-channel activity.

**Retracted finding.** The first draft of this review tried to weigh "effort allocation" using git commit volume (121 commits, mostly jlmops) against acquisition output, and concluded effort had drifted from the stated priority. That comparison doesn't hold: git commits only capture code work. Acquisition activity — writing and publishing posts, sending campaigns, producing and distributing print newsletters and flyers — leaves no commit trail. Measuring one side and not the other and calling the gap a finding was a methodology error, not a real signal. No direction finding stands from this review; a fair read would need the acquisition-side activity log (content published, emails sent, print runs, flyer drops) alongside the commit log, not commits alone.

## 3. Performance

- **Sync / data quality:** performing. `jlmops-status.md`: sync IDLE, all 4 integrations pulling on schedule, last housekeeping run clean (15/15 tests, 0 validation issues). 13 failed jobs in queue, but oldest is 241 days — long-standing backlog, not a new signal.
- **Orders:** unmeasured against expectation — no baseline to compare. Last 7d: 3 orders, ₪2,503. Flagging only because it's the volume acquisition work is meant to move; not asserting it's low without a trend line.
- **Traffic (GA4):** unmeasured against expectation for the same reason — 7d: 114 sessions, 90 users, 50% engagement (data as of 2026-06-27, GA4's normal lag). This is KPI #1 in `business/KPI.md` (Acquire). No historical comparison point was found in docs to judge direction.
- **GSC:** not broken — a wiring gap. `JLM GSC Weekly` (id `1535CDgL8oD8o2L5ceOTAXtxrXGVnRgQfEddfc3b6hHc`) has two tabs: `Sheet1` and a dated `SAS_2026-06-10_03-55-31` tab — almost certainly where the Date-dimension pull landed when it ran 2026-06-10. This is the documented multi-tab constraint (`KPI.md`/`ARCHITECTURE.md`): sessions/Drive MCP can't read multi-tab workbooks, only jlmops's own `openById` code can. `jlmops-status.md`'s KPI-block generator hasn't been pointed at that dated tab yet — a small jlmops build task, not a regression to investigate.

## 4. Active initiatives

- **Print newsletter** — not a pending event. Corrected understanding: the print newsletter goes into every web shipment and is handed out in-shop continuously; the current issue is in ongoing distribution the moment it's printed, until the next issue replaces it. `plans/STATUS.md`'s "print ready to distribute... mark published after distribute" framing doesn't fit an always-on physical channel the way it fits a one-time send — worth revisiting that language, but it's not a stalled initiative. No finding.
- **June AYIW email** — still an open, genuinely discrete question (Mailchimp send, separate from print): did it go out? `plans/STATUS.md` still says "scheduled 2026-06-24." → **Decision outstanding, §6.**
- **Flyer round 1** — on track. Quote received 2026-06-21, art in progress, no blockers noted. Healthy, no finding.
- **Region posts (6-post plan)** — Negev is the only one drafted, 5 weeks into the plan (first slot A is due 2026-07-07, per `REGION_POSTS_PLAN.md`), and it's not yet published (pending winery verification + HE translation, both human-dependent — not drift, per the plan-aware default). Slot A (Galilee) has no draft yet and is due in 6 days. Worth a status check, not a fire drill.
- **Bug/reliability queue** (Sync Hardening Session F, timestamp audit H, count-task audit I) — steady, no cadence expectation violated; per STRATEGY.md, "sync is stable, bug fixes only" is the right posture here.

## 5. Plan vs. reality — revision due

- **`business/KPI.md`** describes the jlmops KPI block as a pending "next step" ("Next step is the jlmops-side KPI block... RELIABILITY_AUDIT §3.2"). It's actually built, deployed (@287), and live — confirmed today reading `jlmops-status.md`'s KPI section directly. Doc lags reality by roughly three weeks.
- **Portfolio `CALENDAR.md`** lists "CONTENT_LIBRARY phase 7 — split into 7a + 7b... Next library session" under Today/This Week. Phase 7 (Decision 7, attach-to-replace versioning) shipped weeks ago (@316-@322) and its plan was graduated and archived earlier today. Stale entry.

## 6. Decisions outstanding

1. **Did the June AYIW email actually send?** STATUS.md needs an honest answer either way — "sent" or "blocked," not "scheduled" a week past date. Print newsletter is unaffected — it's an ongoing channel, not a pending event. (§4)
2. **GSC tab wiring** — worth queuing as a small jlmops build task (point the KPI-block reader at `SAS_2026-06-10_03-55-31`), or leave GSC diagnostic-only until the next SEO/jlmops session? (§3)

## 7. Wishlist + reminders

- No wishlist adds/promotes surfaced this review.
- Candidate for dismissal (user confirm): `marketing` wishlist "Year in Wine 2024" — the year has passed; likely dead. Leaving in place pending confirmation.
- Inbox defer check: `defer:2026-07-08` (PROJ-CONTENT routing) and `defer:2026-07-14` (offline attribution) are both still future-valid, no action needed yet.

---

## Flags → resolution

| Flag | Resolution |
|---|---|
| Effort allocation vs. STRATEGY.md period focus | **Dismissed** — methodology error (commits-only measure can't see acquisition work); no finding stands |
| Print newsletter framed as pending/overdue | **Dismissed** — ongoing channel, not a discrete event; corrected understanding |
| June AYIW email send status unconfirmed | **Decision outstanding** — asked above |
| GSC multi-tab wiring gap | **Fixed + deployed @426** — root cause was worse than the multi-tab guess: `data_tab` config held the workbook's own title (matched no tab), so the reader silently fell back to the wrong sheet. Corrected to `Sheet1`; pending user's `rebuildSysConfigFromSource()` + add-on recurring-report confirmation (`plans/STATUS.md` Pending Verification) |
| `KPI.md` KPI-block description stale | **Proposed in-session fix** — awaiting go-ahead |
| `CALENDAR.md` Content Library phase 7 entry stale | **Proposed in-session fix** — awaiting go-ahead |
| Wishlist "Year in Wine 2024" likely dead | **Proposed dismissal** — awaiting user confirm |
