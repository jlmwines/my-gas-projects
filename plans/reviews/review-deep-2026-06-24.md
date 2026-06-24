# Deep Review — 2026-06-24

Reads: prior deep review (2026-06-21), wishlist.md, bugs.md, plans/STATUS.md, CALENDAR.md, session-log (2026-06-24), git log --since="14 days ago" (@342–@371), GA4 (last run 2026-06-21, 90d window Mar 23–Jun 21), GSC (last run 2026-06-10, ~90d window).

## Situation

Three days since the last review. Not a strategic inflection — this review was triggered mid-session during a focused jlmops build sprint (@369–@371: new-product workflow hardening). The business is in steady-state execution: outbound channels active and converging, organic traffic holding its post-cutover trajectory, internal tooling quality improving incrementally. No structural pivots; no emergent blockers.

## Direction

Acquisition focus remains correct and is showing results across three converging channels simultaneously for the first time:

- **Email/newsletter** — June 24 AYIW email scheduled (today); Issue #2 newsletter print-ready for distribution. Email cadence is healthy (~twice monthly). Handling promo (June 17) too fresh for analytics.
- **Flyer (offline/local)** — unblocked. Quote received June 21; art in progress. After three consecutive review carries, this is now executing. Attribution (`defer:2026-07-01`) comes due in 7 days.
- **Organic** — growing steadily. GA4 (90d, Jun 21 run): 1,505 sessions / 1,147 users / 1,114 new users. Recent June dates show ~20+ combined EN+HE sessions/day, up from 4–9/day at the March baseline. Post-cutover lift is holding.

Revenue (26 key events / 14,944 in the 90d window) shows a modest drop from the prior run's 30 / ₪19,499 — this is a rolling-window artifact: the pre-Passover high-revenue March dates rolled out of the window. Organic channel is not deteriorating.

## Performance

**Organic — performing.** Trajectory is clean; review posture is trajectory not fine-tune. Homepage GSC (June 10): 204 clicks / 4,938 impressions / pos 9.1. Best content impression pool: acidity/complexity post at 2,782 impressions / pos 9 — accumulating well, CTR will follow as position solidifies. No fine-tuning warranted yet.

**Email — performing within cadence.** GA4 confirms `JLM Wines / email` sessions on June 17 (Handling promo send). Newsletter May 26–27 conversion confirmed in prior review. Issue #2 today.

**Sync / ops — stable.** No failure reports. New-product accept flow hardened (@370–@371): wpm_ID and cpm_IsWeb now written at accept time. Smoke test with real product in progress; user will report.

**GSC — stale.** Last run June 10, now 14 days old. Worth a manual re-run before the next review.

## Active initiatives — health check

- **New-product workflow (Track B)** — effectively shipped. @342 retired hotlink; @370 required Woo Post ID at accept; @371 seeds cpm_IsWeb. Pending: real-product smoke (user testing now). Plan `NEW_PRODUCT_WORKFLOW_UX_PLAN.md` current.
- **June content calendar** — on track. AYIW email sending today; print newsletter ready. July entities pre-registered.
- **Flyer Round 1** — executing. Art in progress; no Claude action needed until art is reviewed.
- **Reliability audit** — parked. Still at ~7/16 sessions; 1.3 (concurrency) and 4.1 (snapshots/DR) are next when bandwidth permits.
- **Content pipeline** — Reds/Whites Guides in editing + translation (human-gated); Negev region post in draft. Within cadence.

## Plan vs. reality — where revision is due

1. **NEWSLETTER_PLAN.md model** — still diverged (carried from June 21 review). Actual practice is post-promo-adjacent email, not a subscriber-exclusive Making-Wine series. Small in-session fix; was flagged "awaiting user OK." → **Re-surface as decision** (disposition below).

2. **PROJ-CONTENT task routing** — decided June 11, not built. Now the third review carry. → **Inbox entry** `defer:2026-07-08` (push to next jlmops session after smoke test settles).

## Decisions outstanding

- **NEWSLETTER_PLAN model** — confirm OK to update in-session (align plan text to actual post-promo-led practice). Small edit, low stakes.
- **MCP vetting** (Gmail/Calendar/WordPress.com) — unactioned, 4th consecutive carry. Suggest: **dismiss until a concrete need surfaces.** No active workflow requires any of the three.
- **PROJ-CONTENT seeding** — see above; Inbox entry proposed.

## Wishlist + reminders

- **Bundle explainer message** (web wishlist, June 8) — "(soon)" holds; Bundle Plan stages 0–7 shipped. Promote when next web session opens.
- **Offline attribution** `defer:2026-07-01` — 7 days out. Flyer is moving, so this is live soon: define coupon naming convention + UTM QR scheme when flyer art is finalized.
- **GSC** — stale (Jun 10). Re-run manually before next review.

## Flag → action disposition

| Flag | Action |
|------|--------|
| NEWSLETTER_PLAN model divergence | User decision: OK to fix in-session? |
| PROJ-CONTENT task routing | Inbox entry `defer:2026-07-08` |
| MCP vetting (Gmail/Cal/WP.com) | Dismiss — no active need |
| Offline attribution | `defer:2026-07-01` already in Inbox; now live |
| GSC stale | Note only — manual re-run |
