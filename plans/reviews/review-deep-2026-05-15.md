# Deep Review — 2026-05-15

Reads: prior deep review (2026-05-07), STATUS.md, CALENDAR.md, .claude/bugs.md, .claude/wishlist.md, session-log 2026-05-07 → 2026-05-14 (9 entries), `git log --since="14 days ago"`. GA4/GSC weekly sheets exist and refresh but weren't pulled this run — direct user-side read of the 4-week window straddling cutover is the unblock for trajectory comparison. **Trajectory unmeasured this run, consistent with 2026-05-07.**

## Situation

Eight days since the prior review. Cutover is now 10 days back; recovery posture is over. The period was an unusually concentrated build sprint: jlmops @81 → @116 (35 versions in 9 days), six theme deploys (v1.2.17 → v1.2.23), Newsletter v1 layout locked, RankMath audit + 7 changes shipped, homepage Phase 1 shipped, Context post moved into translation.

Mapped by **funnel function** (not by codebase area):

- **Online acquisition surface, shipped:** Campaign Architecture end-to-end send infrastructure (@84/@85 — UTM builder, short URL CRUD, QR helper, AdminCampaignsView); SEO consolidation (RankMath audit + 7 settings changes, homepage Phase 1 hreflang+sitemap+RankMath-fields fix, SEO audit items #1/#3/#10/#11 closed); Newsletter v1 layout locked + post-source format spec'd + Context print body drafted; catalog filter UX overhaul. Content pipeline progressing on partner cadence (5 posts queued; Context moving).
- **Conversion plumbing, shipped:** pending-payment auto-followup with one-tap guest-pay link (@110-@111 — catches checkout-bouncers); full mobile UX pass (@107-@109 — every mobile visitor benefits, including the server-side viewport-tag fix that made media queries actually fire); billing names restored on checkout (v1.2.23).
- **Retention layer, shipped:** Manager CRM Half 2 action layer (@105 — ManagerContactView + welcome-outreach trigger + Action Panel). This is exactly the gap 2026-05-07 flagged ("data layers ahead of action layers"); it's closed.
- **Pure ops, shipped:** tech-debt audit + cleanup, sync architecture (web-export inline @88, FAILED IMPORTING_COMAX recovery @94, non-destructive config rebuild @93), deploy hardening (@106 pinned-wrapper + drift check), schema column-position bug + append-only rule, bundle parity validator Phase 1 (@98).

The directional bottom line: most of the period served acquisition / conversion. The retention gap from 2026-05-07 closed. What's left silent is **the first send** through Campaign Architecture — gated on Evyatar's edit + HE translation of Context.

## Direction — is it still right?

- **Acquire — multi-channel, online-primary.** Direction holds. Online acquisition shipped substantially (infrastructure, SEO, conversion paths). The two offline items (flyer + tasting) are real but narrow gaps; they're a slice, not the headline.
- **Convert** — pending-payment automation + mobile UX shipped this period. Healthy.
- **Retain** — Half 2 shipped, awaiting real-world manager use.

Direction not in need of renegotiation.

## Performance

- **Online acquisition surfaces:** shipped substantially; **trajectory unmeasured** (GA4/GSC user-side pull pending — last measured 2026-05-07 was 90-day rollup; the 4-week-straddle window across 2026-05-05 cutover is the right read and hasn't been done).
- **Outbound sends:** zero in window. Gated on Context translation, healthy on partner cadence — but the gating is now the bottleneck, not internal capacity.
- **Sync / CRM / internal ops:** performing.
- **Mobile LCP 4.0–4.1s:** unchanged, CWV "poor" boundary. Correctly deferred.

## Active initiatives — health check

- **Newsletter v1 / Context email** — translation gate. Tuesday 2026-05-19 (4 days out) vs. 2026-05-26 (post-Shavuot) is the period's most-important customer-facing decision. In partner cadence, healthy.
- **Campaign Architecture** — built, awaiting first exercise. The send infrastructure is the most consequential build of the period; its first cycle is the proof-of-life.
- **Manager CRM Half 2** — shipped, awaiting real-world manager workload to validate.
- **`runFrequentMaintenance` trigger** — entry point exists @112; trigger not arranged (10-min Apps Script editor task). Pending-payment automation reliability depends on this; sitting since 2026-05-14.
- **Bundle parity Phase 2 + verification track + Phase 2 homepage** — plans written, pending OK to code.
- **5-post pipeline** — Context moving, 4 awaiting editorial + translation. Partner cadence.
- **Flyer + tasting** — wishlist, no scoping movement in 8 days. Real gap.

## Plan vs. reality — where revision is due

1. **COORDINATION.md flagged stale 2026-05-07, untouched 8 days.** Pre-cutover sequence overtaken; post-cutover roadmap (where flyer/tasting fit, when Phase 2 homepage moves, what gates the first Campaign Architecture send) not written down. Last review flagged without converting; this review converts: **propose `defer:2026-05-22` Inbox entry**, which forces revision before next deep review.
2. **Inbox is accumulating.** 9 active items, 6 added in a single day (2026-05-14). Mix of bug-tracker items that belong in `bugs.md` (backfillOrderTotals destructive, ManagerContactView search latency), structural rethinks (Comax decoupling, Jetpack/Woo App replacement), design direction (bundle/package imagery refresh), planned tracks (product-centered ops view, verification — plan written). **Triage pass needed** to route each to its right destination.
3. **Pattern from 2026-05-07 — "data ahead of action" — partially closed.** CRM action gap shipped (Half 2). Campaign send-action remains: infrastructure shipped, first send pending. Narrower and more specific than the 2026-05-07 framing.
4. **`KPI_SUMMARY_TAB.md`** — marked DEFERRED 2026-05-11 (user prefers periodic manual GA4 + GSC + JLMops_Data review). Stays parked.

## Decisions outstanding

- **Newsletter restart date.** 2026-05-19 vs. 2026-05-26. Discussed 2026-05-14, not decided.
- **First Campaign Architecture exercise.** Will run with Context send — same decision as the date.
- **Verification plan implementation.** Code now, or queue?
- **`runFrequentMaintenance` trigger.** ~10 min Apps Script editor; should be done this week.
- **Bundle Phase 2 + API push test.** Code now, or queue?
- **Flyer + tasting scoping.** Move from wishlist to plan, or accept defer and update COORDINATION to match?
- **COORDINATION.md revision.** In-session this week, or `defer:2026-05-22`?

## Wishlist + reminders

Items obsoleted by this period's ship, candidates to close at user discretion:
- **Mailchimp API** (wishlist) — shipped @81
- **WooCommerce API for orders** (wishlist) — shipped @68
- **Newsletter UTM/QR helper** (wishlist 2026-05-08) — subsumed by Campaign Architecture (@84/@85)
- **URL shortener integration** (wishlist) — shipped via `SysShortUrls` + `MarketingCampaignService` (@84)

**Active reminders:**
- Magnums category removal — pull from bundle composition first (STATUS Next Action #9)
- Test `runFrequentMaintenance` + arrange 20-min trigger (Inbox 2026-05-14)
- `backfillOrderTotals` destructive — fix or remove (Inbox 2026-05-14)
- Admin Projects task-delete partial-success (bugs.md 2026-05-15, low-priority)

## Flag → action disposition

- **COORDINATION.md staleness** → propose `defer:2026-05-22` Inbox entry (awaiting user OK).
- **Inbox accumulation (9 items)** → propose triage pass next session, route each item to `bugs.md` / plan-doc / `defer:date` / strike (awaiting user OK).
- **Wishlist items shipped-or-subsumed (4)** → flagged for close at user discretion; not auto-closed.
- **Newsletter restart date** → surfaced as Decisions outstanding; resolution is user-side.
- **Mobile LCP** → correctly deferred, no action.

## Trajectory (added in-session, GA4 + GSC pull)

Pulled both weekly sheets via Drive MCP. **GSC** surfaced (full 90-day page-level rollup). **GA4** did not — only the add-on configuration tab returned (Property 279950414, 90d window, dims `sessionSourceMedium / country / language`, metrics `sessions / activeUsers / newUsers / engagementRate / keyEvents / totalRevenue`). The data tabs themselves are in separate sub-sheets the MCP plaintext export doesn't reach.

**Date-bucketed pre/post-cutover comparison remains unavailable** — GSC report is dimensioned by Page, not Date. The 4-week-straddle window around 2026-05-05 needs a Date-dimensioned report config; this is a sheet-config change on your side, not a Claude task. *Flag, not substitute.*

**Page-rollup snapshot (90d window, ~2026-02-14 → 2026-05-15), top entries:**

| Page | Clicks | Impressions | CTR | Position |
|---|---|---|---|---|
| `/` (EN home) | 204 | 4,938 | 4.1% | 9.1 |
| `/he/about/` | 105 | 1,355 | 7.7% | 5.3 |
| `http://jlmwines.com/` (legacy) | 72 | 1,602 | 4.5% | 6.1 |
| `/send-wine-gifts-in-israel/` | 56 | 1,109 | 5.0% | 6.7 |
| `/he/` (HE home) | 49 | 1,634 | 3.0% | 7.0 |
| `/about/` (EN) | 2 | 385 | 0.5% | 5.9 |
| `/he/about-evyatar/` | 4 | 134 | 3.0% | 7.4 |
| `/shop/` | 12 | 358 | 3.4% | 4.2 |
| `/white-rose-wine-acidity/` (blog) | 10 | 2,782 | 0.4% | 9.0 |

Three signals worth naming at snapshot resolution:

1. **Legacy `http://jlmwines.com/` GSC property still drawing 72 clicks / 1,602 impressions over 90d.** Flagged 2026-05-07 as a cleanup task. Homepage Phase 1 (hreflang http→https) will erode this over time, but it's still active. Cleanup item still real.
2. **EN `/about/` underperforms HE `/he/about/` by ~50×** (2 vs 105 clicks). HE benefits from Evyatar's personal-brand searches in Hebrew, so a gap is expected — but a 0.5% CTR / 2-click count on 385 impressions at position 5.9 is anemic for what should be a top-3 nav page. Worth a future look (indexing / canonical / EN-side brand keywords).
3. **`/white-rose-wine-acidity/` blog post: 2,782 impressions, 10 clicks, 0.4% CTR, position 9.0** — highest-impression non-product page in the sheet. Page-level CTR fine-tune (title + meta) is the obvious lever, but /review-deep posture defers page-level CTR triage during recovery. Note for a future SEO session.

**Still unmeasured:** date-bucketed trajectory itself, GA4 sessions/users/revenue over time, language split direction, source/medium attribution. Unblock for next deep review: re-run the GSC report with Date dimension dropped onto a fresh tab, and confirm the GA4 add-on actually populated its data tabs (the config tab is the only one MCP saw).
