# Deep Review — 2026-06-06

Reads: prior deep review (2026-05-24), STATUS.md, CALENDAR.md (portfolio root, Updated 2026-06-04), .claude/bugs.md, .claude/wishlist.md, session-log 2026-06-03→2026-06-05, business/STRATEGY.md (2026-05-15) + KPI.md, git log --since=14d (~140 commits, jlmops @119→@230). Trajectory pull skipped — same user-side blocker as the last 3 reviews (GA4 data-tab + GSC Date-dim), decision already parked `defer:2026-06-15`; not re-pulled.

## Situation

Thirteen days, and the posture flipped hard back to build-sprint — the single heaviest internal-build window in the project's history. jlmops went @119→@230 (~111 deploys); theme held at v1.2.29. What shipped: Content Library in full (phases 5–11, @122→@147), Reliability Audit tiers (1.1/1.2/2.2/2.3/3.1/3.2, @151→@217), UI Audit Tiers 1–5 mobile (@153→@191), Notification-UX standard (@218→@219), the Admin Task workbench go-live (@198), Product Verification surface (@199→@201), Contact Action Ribbon Phase 1 (@191, Phase 2 dropped), and Bundle Plan Stages 0+1 (@227→@230). The last review's worry — "1000-line CONTENT_LIBRARY queued while Campaign Architecture hasn't fired" — resolved by *shipping the data layer*, not by shifting to outbound.

Meanwhile the stated period lever — outbound acquisition — is genuinely moving, and producing results: the **email campaign generated orders and clicks** (the first real exercise of the @84/@85 Campaign-Architecture infra — it didn't just fire, it converted), the **print newsletter is getting QR action** (offline→online attribution live), and only the **flyer is stalled** (vendor/designer outreach; user is actively nagging). Two of three outbound channels working and measurable. That resolves the last two reviews' "infra has never fired once" question — positively.

## Direction — is it still right?

STRATEGY.md (2026-05-15): acquisition is the period lever; "putting outbound into active cadence is the next period's primary work"; "action layer > data layer, build less data infrastructure"; de-prioritize campaign-engagement/KPI-tab/mobile-LCP.

- **Acquisition focus — holds, and it's executing.** This is a business review, not a Claude-performance review: the lever advances through whoever does the work. Scorecard by channel: **email — working** (orders + clicks, converted); **newsletter — working** (QR scans coming in); **flyer — stalled** (vendor/designer; user nagging). So the lever isn't just chosen, it's live and producing measurable response. Direction confirmed by results, not just intent.
- **Action > data — partial tension, narrower than last review.** Much of the sprint *was* action-layer and usability (Admin Task workbench, Notification UX, Contact Ribbon, Product Verification, mobile UI audit, reliability hardening) — exactly STATUS Next-Action #4 ("drive shipped CRM/UI work through daily operation"). Strategy-aligned. The genuine net-new data builds were Content Library (5–11) and the 7-stage Bundle Plan.
- **One real watch item:** the only stalled outbound channel is the flyer, and its blocker is external (vendors/designer). The business question isn't "why is Claude not doing it" — it's whether the nag is working or whether Round 1 needs a different vendor / a fallback path. That's where outbound attention belongs, not on the internal build cadence (which is healthy and value-producing).

## Performance

- **Online acquisition trajectory — unmeasured (4th consecutive review).** User-side unblock, decision due `defer:2026-06-15` (9 days out). Not re-flagged as new; the parked item owns it.
- **Internal ops — performing.** Reliability audit + Notification UX + sustained @119→@230 cadence with no rollback narrated; bundle perf bug (100s+→seconds) and qty=0 price bug both fixed and user-verified.
- **Outbound — performing.** Email campaign produced orders + clicks (first Campaign-Architecture exercise, converted); newsletter QR scans coming in. Flyer underperforming/stalled on external vendors. 2 of 3 channels live and measurable.
- **Editorial — Context live 2026-05-19; no new post in 18 days; 3 in pipeline. Within monthly cadence** (next drop ~mid-June).
- **Mobile LCP — FCP 3.5 / LCP 4.2, at baseline. De-prioritized per strategy. Fine.**

## Active initiatives — health check

- **Bundle Plan** — Stages 0+1 shipped + verified; Stage 2 (cost/profit) planned, source+mechanism settled, build not scoped. On track, seasonal-cadence-appropriate. Healthy.
- **Newsletter #1 / Campaign Architecture** — fired and converting: email produced orders + clicks, print QR scans coming in. The @84/@85 infra is now exercised end-to-end. Healthy; next is the second-cycle analytics read once data accumulates.
- **Flyer Round 1 (local acquisition)** — activated 2026-05-31, **stalled** on vendor/designer; user actively nagging. The only outbound channel not moving. Watch: is the nag working, or does Round 1 need a different vendor / fallback?
- **runFrequentMaintenance one-business-day SysLog verification** — STATUS pending since 2026-05-15, flagged unverified in the *last* review too. Still unconfirmed. Lingering.
- **MCP vetting (Gmail/Calendar/WordPress.com)** — Inbox/CALENDAR 2026-05-19, unactioned. Light, anytime.

## Plan vs. reality — where revision is due

1. **CALENDAR.md "Today/This Week" substantively stale** despite Updated:2026-06-04 (only the bundle-image row was added). Still lists: Newsletter send 2026-05-26 (past), "2026-06-02 perf session" rows (that day was reliability+RankMath, not perf), CONTENT_LIBRARY phase 7 (phases 5–11 all shipped), and `BUNDLE_MANAGEMENT_REFINEMENTS_PLAN` / `BUNDLE_API_PUSH_TEST_PLAN` pointers now **superseded by BUNDLE_PLAN** (the first two are stubs, the API-push is parked). Same staleness this review flagged for CALENDAR on 2026-05-24. Revision due: refresh the JLM rows. → in-session, user OK.
2. **STATUS pending operational verifications (4 items, now 11–12 days old):** @120 task-date fix, st_DoneDate-without-Done, runFrequentMaintenance one-day observe, UI T4.3 count modal. Either confirmed (strike) or forgotten. → ask user which landed; strike the rest in-session.
3. **CONTENT_LIBRARY phase 12 cross-link renderer "blocked on §16 regions overhaul"** still carried in STATUS Metrics with no movement. Confirm it's genuinely still wanted, or demote to Deferred. → minor; surface, don't force.

## Decisions outstanding

New this review:
- **Flyer Round 1 is the one stalled outbound channel** — keep nagging the current vendor, or switch vendor / find a fallback? This is the outbound decision that matters now (email + newsletter are working).
- **Next internal pick:** Bundle Stage 2 (ready to scope) vs. the wishlist Newsletter UTM/QR helper (now earning its keep — email + QR attribution are live and producing data worth capturing cleanly). STATUS says "open/TBD."

Resolved this review: Newsletter #1 email + Campaign-Architecture **fired and converted** (orders + clicks); newsletter QR scans live. The "has the @84/@85 infra ever fired?" question from the last two reviews is closed, positively.

Re-surfaced (still open):
- **runFrequentMaintenance SysLog verification** — happened, or still pending? (3rd review carrying it.)
- **MCP vetting** — pick up next light session, or defer with a date?

Resolved since last review (clear from the carry-list): Bundle Phase 2 + API-push → folded into BUNDLE_PLAN (decided: staged build). Flyer scoping → activated 2026-05-31. CONTENT_LIBRARY sequencing/scope → built in full. Trajectory → converted to `defer:2026-06-15` Inbox item.

## Wishlist + reminders

- **Promote candidate:** Newsletter UTM/QR helper (wishlist jlmops 2026-05-08) — directly serves the now-active flyer + offline-attribution thread; worth elevating from wishlist to a scoped item if outbound becomes the next pick.
- **Pairs with active work:** bundle/package imagery refresh (wishlist marketing 2026-05-15) + CALENDAR bundle-image row — natural companion to the Bundle Plan now in flight.
- Reminders: offline attribution `defer:2026-07-01` (in window); trajectory `defer:2026-06-15` (9 days out); MCP vetting unactioned.

## Flag → action disposition

- CALENDAR "Today/This Week" JLM rows stale → propose in-session refresh. Awaiting user OK.
- STATUS 4 pending verifications 11–12 days old → ask user which confirmed; strike rest in-session. Awaiting user.
- Newsletter email/Campaign-Architecture → RESOLVED in-review: fired + converted (orders, clicks, QR). Logged.
- Flyer stall → surface as the live outbound Decision (nag vs. switch vendor). User-side.
- Next internal pick (Bundle Stage 2 vs UTM/QR helper) → Decisions outstanding; user-side.
- runFrequentMaintenance verification → re-surfaced Decision (3rd carry).
- CONTENT_LIBRARY phase 12 block → surface; demote to Deferred only on user say.
- Trajectory → owned by `defer:2026-06-15`; no new action.
- MCP vetting → keep in Inbox as-is.
