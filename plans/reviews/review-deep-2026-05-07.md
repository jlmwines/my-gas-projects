# Manager Review (alt) — 2026-05-07

First run of `/manager-review-alt`. Same-day comparison with `manager-review-2026-05-07.md` (original run 1) and `-2.md` (revised original). Reads reused from this session: wishlist, bugs, STATUS, CALENDAR, last 2 `session-log` entries, KPI.md, COORDINATION.md, NEWSLETTER_PLAN.md, CONTACT_MANAGER_PLAN.md, git log (14d), GSC 90d page rollup. **GA4 data tab + `JLMops_Data` operational tabs did not surface in Drive plaintext export** — organic-traffic trajectory therefore unmeasured this run, not fabricated.

## Situation

Recovery posture, online and offline acquisition both active. The theme cutover (2026-05-05), SEO audit (2026-05-06), and RankMath + homepage Phase 1 (2026-05-07) all just landed — the site is in the early days of organic-search recovery from a structural set of changes. The user has named **acquisition** as the period's focus, and two new offline channels (8-neighborhood Jerusalem bilingual flyer test, restaurant/venue tasting events) entered the wishlist this session. Operationally stable: sync steady, no fires, security plugin in 24hr burn-in. The dominant question right now isn't pace — it's whether the recovery is bending the right way and whether the offline acquisition channels can move from wish to plan.

## Direction — is it still right?

- **Acquire / HE-Jerusalem** — still right and now multi-channel. Online: organic recovery work just shipped. Offline: flyer + tasting added today. Direction reinforced.
- **Convert / Retain** — both still apply, both de-prioritized this period per the named focus. Half 2 (action layer), KPI Summary tab, mobile LCP all queued behind the acquisition push. Confirmed in flight as planned, not findings.

## Performance — how are existing surfaces doing?

- **Organic search trajectory:** **unmeasured.** GSC 90d page rollup is what was readable; the date-bucketed view (4 weeks straddling 2026-05-05) is the right read for recovery-vs-pre-cutover comparison but didn't surface in plaintext. Recommend opening the GA4 + GSC sheets directly for the next review.
- **Site sync + ops:** performing. Stable per STATUS, no failed runs flagged.
- **CRM data layer:** performing. 548 contacts enriched, daily Mailchimp pull live since 2026-05-05, suggestions generated nightly.
- **Mobile LCP 4.0–4.1s:** underperforming on CWV "poor" boundary; affects organic conversion downstream. Watching, not fixing this period (image/render-blocking work explicitly de-prioritized).

## Active initiatives — health check

All planned, all within natural cadence. None drifting.

- **KPI Summary tab** — 5 questions resolved 2026-05-07, build is ~30–60 min single GAS deploy. Ready.
- **Newsletter v1 first issue** — partner edit + translate of "A Year in the Vineyard" HE pending; QR destination cleared by Phase 1. In human cadence.
- **CONTACT_MANAGER Half 2 (action layer)** — unblocked 2026-05-05 by Half 1 ship. Multi-day build. Just-unblocked, on cadence.
- **Phase 2 homepage (Gutenberg blocks)** — Phase 1 shipped today. Multi-session ahead. Awaiting prioritization vs. other queue items.
- **Wordfence delete** — pending SG Security burn-in 2026-05-08. In window.
- **Content monthly drops** — 5 posts in pipeline; cutover gating resolved 2 days ago. In cadence.
- **Flyer + tasting (offline acquisition)** — wish-stage, not plan-stage yet. Direction matches priority; needs scoping.

## Plan vs. reality — where revision is due

- **`business/COORDINATION.md`** (Updated 2026-04-30). Stale. Sequence table marks theme cutover as "Active build" — shipped 2026-05-05. Newsletter v1 / Half 1 / multiple "After cutover" items now in flight or done. The pre-cutover sequence has been overtaken; the post-cutover roadmap is the next planning question (where do flyer/tasting fit, what gates Half 2, when does Phase 2 homepage move). Worth a sequencing session.
- **Pattern: data layers are running ahead of action layers across the system.** CRM enrichment runs nightly; campaign-send pipeline doesn't exist. Mailchimp pulls land daily; outbound campaigns don't. Catalog filter telemetry is collectible; isn't collected. Cross-sell schema is defined; calculation isn't built. This is one structural pattern, not several findings. Worth naming as a strategic constraint when COORDINATION.md gets revised: **build less data infrastructure, ship more action surface.**

## Decisions outstanding

- **Acquisition queue sequencing** — flyer + tasting just surfaced; where vs. organic-recovery watching, Half 2, Phase 2 homepage?
- **KPI Summary tab** — build now (single deploy, makes retention metrics visible) or sequence after Half 2?
- **Newsletter v1 first issue** — what's still pending partner-side beyond translate?
- **5 deferred posts** — pick first one for May, or accept slowdown in favor of acquisition focus?
- **Plugin cleanup on live** — when?

## Wishlist + reminders

**Wishlist:** 2 items added today (flyer test, tasting events) — both fit named focus. Older "Mailchimp API / Woo API" entries shipped via @81 / @68; could be marked done at user discretion.

**Reminders:**
- SG Security burn-in ends **2026-05-08** (tomorrow) — if clean, delete Wordfence
- WPML HE storefront walk (user task) — pending
- Vendor SKU Update + Trim safety tests — pending since 2026-02-19
- Legacy `http://jlmwines.com/` GSC property — user to remove or merge in GSC console
