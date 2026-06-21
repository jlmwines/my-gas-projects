# Deep Review — 2026-06-21

Reads: prior deep review (2026-06-06), .claude/bugs.md + wishlist.md, plans/STATUS.md, CALENDAR.md (portfolio root), session-log (2026-06-16 → 2026-06-18 later 4), git log --since=14d (@289→@323, 35 commits), GA4 (last run 2026-06-14, ~90d window), GSC (last run 2026-06-10, ~90d window).

## Situation

Fifteen days since the last review. JLM is executing steadily on a dual track: outbound acquisition channels running (email #2 sent June 17 evening, newsletter distributing, flyer externally stalled) while the internal build continues at a lighter pace than the prior sprint — @289→@323 covered content-library versioning (Decision 7, @316–@322), new-product UX overhaul (@307–@311), product-management tooling (@306, @312), and the ops-bridge KPI block (@287). No theme deploy since v1.2.30 (2026-06-12). The organic-traffic and revenue data now have enough history to characterize trajectory cleanly — that gap from the last four reviews is closed.

## Direction

Acquisition focus holds and is producing:
- **Email:** 2 campaigns in ~3 weeks (newsletter May 26, Handling post-promo June 17) — at the upper end of the ~2/month cadence but within it. Newsletter email converted (prior review confirmed orders + clicks). Handling post-promo was 4 days ago; analytics pending.
- **Newsletter print:** distributing via order inserts and store bags; QR scans coming in.
- **Flyer:** still stalled on vendor/designer. Same external blocker as June 6. **Third consecutive review without movement** — the question is no longer "is it planned?" but "is the nag working or does Round 1 need a different vendor?"

The internal build track's recent output (new-product UX, Correct Product Name, Product Verification handling, content-library versioning) serves the manager's daily ops surface — this is action-layer work, not further data-layer depth. The "action > data" strategy flag doesn't apply here. Decision 7 was the last structural piece; the queue is genuinely lighter now.

## Performance

**Organic traffic — performing.** GA4 (~90d, last run 2026-06-14): 1,339 sessions / 1,015 users / 982 new users / 30 conversions / ₪19,499 revenue. Recent June dates show 15–23 organic sessions/day (EN + HE combined); pre-cutover March dates show 4–9/day. Post-cutover trajectory is up. ~₪650 AOV on 30 conversions.

**Email — performing.** GA4 shows `JLM Wines / email` spike on May 26–27 (~24 sessions in 2 days vs. ~15/day organic baseline), consistent with the confirmed conversion report from the last review.

**GSC — building.** ~90d ending 2026-06-10. Homepage: 204 clicks / 4,938 imp / pos 9.1. Best product: Hollander grapefruit liqueur at 10.6% CTR / pos 4.0. Best content impression share: acidity/complexity page at 2,782 imp / 10 clicks / pos 9 — accumulating impressions but not yet converting to clicks. Expected 6 weeks post-cutover; trajectory is fine, not a fine-tuning candidate yet.

**Editorial — within cadence.** 11 posts live; Handling shipped June 17; Reds/Whites Guides in pipeline. Monthly cadence = healthy.

## Active initiatives — health check

- **Decision 7** — DONE @316–@322. 3 smokes pending (Create-translation-text, mobile URL, `runLibraryDuplicateReconcile`). User-driven; healthy.
- **New-product UX overhaul (@307–@311)** — shipped, mostly unsmoked. On watch list; low risk.
- **Bundle Plan** — all stages 0–7 shipped. Stage 2 (cost/profit) is the next planned build, not yet scoped; no seasonal urgency.
- **Task routing (PROJ-CONTENT seeding)** — decided June 11, not built. Three-step fix in bugs.md. Drifting; no external dependency.

## Plan vs. reality — where revision is due

1. **NEWSLETTER_PLAN.md model diverged.** The plan describes a Making-Wine-led subscriber-exclusive series; the actual practice is now clearly post-promo (manager writes email copy in the Drive doc alongside each blog post). Session log June 17 named this explicitly. → **In-session fix** (update email model section); small scope. Awaiting user OK.

2. **CALENDAR.md JLM rows still stale.** Same flag as June 6 (Updated: 2026-06-04). Still shows: Newsletter send 2026-05-26 (past), "2026-06-02 perf session" rows, CONTENT_LIBRARY phase 7 (shipped), superseded bundle plan stubs. **Two consecutive reviews carrying this unfixed.** → **Inbox entry** `defer:2026-06-28`; if user wants to fix now, do it in-session.

## Decisions outstanding

Re-surfaced (still open):
- **Flyer Round 1 — 3rd consecutive carry.** Keep nagging the current vendor, or switch / find a fallback? This is the only unworking outbound channel. Needs a real answer.
- **runFrequentMaintenance** — confirmed running regularly with a time-based trigger. Closed.
- **Task routing (PROJ-CONTENT seeding)** — decided June 11, not built. Suggest scheduling in the next jlmops session.
- **MCP vetting (Gmail/Calendar/WordPress.com)** — unactioned. Pick a defer date or dismiss.

## Wishlist + reminders

- **Promote candidate:** Bundle explainer message (web wishlist, June 8) — marked "(soon)"; Bundle Plan now fully shipped, making this a natural next web task.
- **Holds:** bundles missed-profit card (jlmops wishlist, June 8) — scopes naturally after Bundle Stage 2.
- **Reminder:** offline attribution `defer:2026-07-01` — in window, but stalled until flyer actually drops.
- GA4 last run June 14, GSC June 10 — both ~1 week stale. Manual re-run trigger worth doing before next review.

## Flag → action disposition

- NEWSLETTER_PLAN model divergence → **in-session fix** (awaiting user OK).
- CALENDAR.md stale → **Inbox entry** `defer:2026-06-28`.
- runFrequentMaintenance → **closed** (confirmed running with time-based trigger).
- Flyer stall → **priority decision** (3rd carry; needs a concrete answer, not another re-surface).
- Task routing (PROJ-CONTENT) → **open decision**, note it's drifting; no flag action beyond re-surfacing here.
