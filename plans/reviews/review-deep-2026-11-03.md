# JLM Wines - Deep Review, 2026-11-03

## 1. Situation

Steady state on systems, post-holiday catch-up on operations. The 2026-11-03 08:59 OPS snapshot is fully green: sync IDLE, 0 failed jobs, housekeeping succeeded 02:31 with 54/54 tests, 0 validation issues, schema passed (`jlmops-status.md`). The last two weeks were reliability and data-integrity work (@594-@604: failure-alert auto-resolve, WebDetM key integrity, heartbeat, Heter Mechira) plus one real incident, the 10/30 bundle wipe, now restored and with a redesign plan awaiting approval. Content is on its monthly cadence (Coastal Plain published 10/28, Golan Heights due 11/16, October AYIW sends today). The named focus is still acquisition (`business/STRATEGY.md` Period Focus).

This review makes **no trend calls**. `plans/REVIEW_PROCESS_PLAN.md` (2026-10-26) found that this review's trend reads are invalid: no year-over-year figures, only snapshot inputs, and summer-only history. Until that redesign exists, performance is reported as current health plus sanity flags only.

## 2. Direction

- **Acquisition is still the right lever,** but its mix changed and the strategy doc hasn't caught up. Paid ads ended, flyer Round 2 was cancelled (popup + `50NEW` replace it), and manager-led Thursday tastings are now the growth push (`STATUS.md` Next Action 3-4). `STRATEGY.md:16` still lists "printed newsletter insert; flyer + tasting events queued as wishlist." That's a revision, not a direction change.
- **"Action layer > data layer"** (`STRATEGY.md:26`) is still right, and the last two weeks honored it mostly as reliability work, not new data build.

## 3. Performance (health, not trend)

- **Sync / jobs / housekeeping:** performing (snapshot above).
- **Orders:** 7d 7 orders, ₪3,609. Recorded only; no comparison per §1.
- **GSC feed: broken, not flat.** 1,790 clicks / 100,269 impr / pos 9.9 is byte-identical to the 2026-08-21 review, about 10 weeks ago. The feed has been frozen at least that long. This is the fourth time it's been raised.
- **First-order conversion 0% alongside 26 new customers (90d):** the metric is broken (already noted in `REVIEW_PROCESS_PLAN.md`), but it has no `BUGS.md` entry.
- **Tastings (the current growth push):** unmeasured. There's no plan doc and no attribution path. The 08-21 offline-attribution reminder was never resolved.

## 4. Active initiatives

- **Bundle web-sync redesign:** plan complete (D1-D6, prep D4 done), awaiting approval. Bundle composition is seasonal, so waiting isn't urgent, as long as the Update buttons stay unused.
- **Region posts:** on cadence; Golan Heights body with the manager since 10/28 for 11/16 (human dependency, not drift). Judea due 12/14, not drafted.
- **AYIW October:** sends today. Healthy.
- **Physical inventory:** "due now" since mid-October, no visible progress; it depends on manager bandwidth.
- **Verification backlog (the structural pattern):** eight `BUGS.md` items read "Fixed @5xx/@60x, verify" (@597 ×2, @598, @599, @601, @602, @603 ×2), oldest from 10/27. Fixes ship faster than verifications close. Tonight's clean housekeeping is evidence for the housekeeping-related ones, but each still needs a look.

## 5. Plan vs. reality

- `STATUS.md:11` says "3 of 6 region posts published"; `CALENDAR.md:36` and Next Action 8 say 4. STATUS is stale.
- `STRATEGY.md:16`'s offline-channel line is stale (see §2).
- `REVIEW_PROCESS_PLAN.md`: design not started. That's what blocks a valid version of this review.

## 6. Decisions outstanding

1. **Bundle plan approval:** blocks the step 1 config push and all bundle code.
2. **Review-process redesign** (Next Action 12): blocks any trend reading of organic, customers and subscribers.
3. **Tasting measurement:** plan doc or not, and how to attribute tasting-driven sales.
4. **Server-side authorization program** (Next Action 5): carried, no movement, no urgency signal.

## 7. Wishlist + reminders

- No wishlist movement proposed.
- Reminders: the eight pending verifications (§4); Vintage-drift smoke test (waits on a natural vintage change).

## Flags → resolution (proposed; each needs user confirmation)

- `STATUS.md:11` region count stale → **in-session fix** (3 → 4).
- `STRATEGY.md:16` offline channels stale → **in-session fix** (tastings live; flyers done; paid ads ended), or Inbox if you'd rather do it at the quarterly review.
- GSC feed frozen → **add to `REVIEW_PROCESS_PLAN.md`** as the freshness case, plus a `BUGS.md` line, so it stops floating.
- First-order conversion 0% → **`BUGS.md` line**.
- Verification backlog → **walk the eight items with the user**; close those confirmed.
- Tasting measurement → **Inbox** (decision item), `defer:2026-11-17`.
