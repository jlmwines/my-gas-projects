# Deep Review — 2026-05-24

Reads: prior deep review (2026-05-15), STATUS.md, CALENDAR.md (last updated 2026-05-14), .claude/bugs.md, .claude/wishlist.md, session-log entries 2026-05-18 to 2026-05-21 (4 entries covering Context publish, MCP audit, Library plan reviews, Lookup plan lock), git log --since=14-days-ago (24 commits), business/STRATEGY.md + business/KPI.md (both with uncommitted rewrite). Trajectory pull skipped this run — the user-side GSC Date-dim + GA4 data-tab unblock from last review hasn't landed; same gap, treated as a pattern below, not re-pulled.

## Situation

Nine days. Posture shifted from build-sprint to planning + content + brand. jlmops version unchanged since 2026-05-15 — @119 for nine days (vs. @81 to @116 in the nine days before). Only theme deploy was v1.2.28 (LCP small-CSS sweep, took mobile to FCP 3.5 / LCP 4.0 — both at/below 2026-05-05 baseline). The customer-facing marquee of the period was the Context post landing live EN+HE on 2026-05-19 — first new editorial post since cutover.

The build-side period output was almost entirely planning artifacts:
- plans/CONTENT_LIBRARY_PLAN.md — two refinement passes in 4 days (2026-05-20 + 2026-05-21); now ~1000 lines, internally consistent, unimplemented.
- jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md — locked 2026-05-21 in collapsed single-phase scope (~110 lines), ready to implement one-session.
- Newsletter workflow shifted twice (pandoc to Google Doc template Path A, commits 312789c, 9b0ca6f).
- Brand standards refresh: David Libre cleanup, Making Wine voice guide.
- Five new session-shape memories (reply format, discussion-vs-action, by-the-way tangents, dictation substitutions, cards-over-views).

Two outbound bottlenecks unchanged from prior review: Newsletter Issue #1 send slipped from 2026-05-19 to 2026-05-26 (Shavuot + content rework — now 2 days out); first Campaign Architecture exercise still pending the same send. The infrastructure built @84/@85 has yet to fire once.

## Direction — is it still right?

business/STRATEGY.md (revised 2026-05-15, uncommitted edits in working copy completing the rewrite from old COORDINATION & ROADMAP framing to clean strategic-posture doc) names the period clearly: Acquisition online + offline; Action layer > data layer; outbound cadence is the open frontier; "no new sophistication of CRM data layer until the existing is exercised by actions."

Measured against that lens:

- Acquisition focus — Context post live (yes). Newsletter Issue #1 in-flight (yes). Direction holds.
- Action > data — Tension. CONTENT_LIBRARY_PLAN is a large architectural build (entity layer, references, taxonomy, library service, register-on-create endpoint). It is workflow-oriented at the top, but the implementation surface is heavy data-layer. The strategy principle isn't strictly violated (it names CRM specifically) but the spirit is: 1000 lines of new data architecture queued while Campaign Architecture has shipped but not fired, and ManagerContactView Half 2 has barely been exercised. Worth surfacing for sequencing.
- Outbound cadence — Newsletter Issue #1 2026-05-26 is the gate. Same as last review, one week later. Cadence-healthy (twice a month max is the JLM reference); execution is the proof.

Direction not in renegotiation. Sequencing is at risk.

## Performance

- Online acquisition surfaces: trajectory unmeasured for third consecutive review (2026-05-07, 2026-05-15, 2026-05-24). The unblock is user-side (GSC Date-dimensioned report + GA4 data-tab population). This is now a pattern. See "Plan vs. reality" #5.
- Outbound sends: zero in window. Newsletter cadence healthy on its own terms; the inability to exercise Campaign Architecture is the constraint.
- Editorial cadence: Context post live 2026-05-19, ~14 days after Acidity (prior post). Monthly cadence intact.
- Sync / CRM / internal ops: performing — zero version bumps in 9 days means zero fires.
- Mobile LCP: v1.2.28 (FCP 3.5 / LCP 4.0) is the post-cutover best. Performing.

## Active initiatives — health check

- Newsletter Issue #1 / Campaign Architecture first send — Tuesday 2026-05-26 (2 days out). Healthy. Remaining: reference docx templates EN+HE (or final Google Doc template per Path A), SVG signatures, recurring banner art, Mailchimp manual paste.
- CONTENT_LIBRARY_PLAN — planning-saturated. Two refinement passes in 4 days; further refinements likely have diminishing return. Implementation gate is sequencing decision (below).
- LOOKUP_ADMIN_UI_PLAN — focused, locked, ~one session of work. The kind of action-layer ship STRATEGY prescribes. Healthy.
- runFrequentMaintenance one-business-day SysLog verification — STATUS pending item from 2026-05-15. No session-log entry indicating it happened. Status unclear.
- Bundle Phase 2 + API push test — no movement, no new flag (prior review queued; STRATEGY doesn't prioritize).
- Flyer + tasting — third review with no scoping movement. STRATEGY explicitly names "queued as wishlist." Consistent, not drift.
- MCP vetting (Gmail/Calendar/WordPress.com) — STATUS Inbox 2026-05-19, unactioned. Light task; can run anytime.

## Plan vs. reality — where revision is due

1. STRATEGY.md + KPI.md rewrite uncommitted. Working copy completes the migration from old COORDINATION & ROADMAP sequencing-table format to strategic-posture format (and updates KPI.md cross-ref). This closes the "COORDINATION.md stale" flag that 2026-05-07 and 2026-05-15 reviews both carried unconverted. In-session: commit (user confirms).

2. CALENDAR.md 10 days stale (Updated: 2026-05-14). "Today/This Week" still names post-cutover follow-ups, "2026-06-02 perf session" rows, and "blog publishing + email campaign send (queued behind product details)" — that ordering is reversed now. Revision due: refresh Today/This Week to put Newsletter Issue #1 (2026-05-26) at the top, drop or move stale post-cutover follow-up rows.

3. CONTENT_LIBRARY implementation sequencing not declared. The plan is built; the implementation order vs. (Newsletter Issue #1 send → Lookup Admin UI → first Campaign Architecture exercise → Manager CRM Half 2 use-validation) is not on paper. Surface as Decisions outstanding for user, not for in-session edit.

4. Inbox is short (1 active + 2 deferred). Last review's "9 active, triage needed" attrited well. Healthy.

5. Trajectory monitoring unblock has lingered three reviews. Pattern: each review notes user-side action needed (GSC Date-dim + GA4 data-tab population), no review reports it landed. Recommend deciding once: either schedule the fix (an Inbox item with a defer date), or accept that trajectory monitoring stays qualitative and stop carrying the flag review-to-review.

## Decisions outstanding

Carried from prior review, still open:
- Bundle Phase 2 + API push test — code now, queue, or close?
- Flyer + tasting scoping — third review no movement; STRATEGY says "queued." Honor that and stop carrying as a decision?
- runFrequentMaintenance SysLog verification — happened? Or pending?

New this review:
- Implementation order after Newsletter Issue #1 send (2026-05-26): Lookup Admin UI (one session, focused, action-layer) → first Campaign Architecture exercise (rides the send) → CONTENT_LIBRARY (large)? Or different sequence?
- CONTENT_LIBRARY scope of first implementation slice — entire plan, or a thin vertical (one entity type end-to-end)?
- Trajectory monitoring — schedule the GSC/GA4 unblock with a date, or accept qualitative monitoring?
- MCP vetting (Gmail/Calendar/WordPress.com) — Inbox item 2026-05-19; pick it up next light session, or defer with a date?

## Wishlist + reminders

No new wishlist movement. Items added 2026-05-15 still all listed (product-centered ops view, Woo App/Jetpack replacement, abandoned-cart outreach, Comax sync decoupling, nav menu audit, bundle/package imagery refresh). Nothing to dismiss without explicit user say.

Active reminders:
- Offline attribution scheme: defer:2026-07-01 — in window
- Drive folder structure: defer:2026-06-01 — 8 days out (revisit at next session in window)
- MCP vetting (2026-05-19): unactioned in Inbox

## Flag to action disposition

- STRATEGY.md + KPI.md uncommitted rewrite → propose in-session: commit (clears the 17-day-old COORDINATION-stale flag). Awaiting user OK.
- CALENDAR.md 10 days stale, Today/This Week obsolete → propose in-session refresh. Awaiting user OK.
- Trajectory unmeasured three reviews running → propose Inbox entry defer:2026-06-15 with explicit content "Schedule GSC Date-dim report + verify GA4 data-tab populated, or accept qualitative trajectory monitoring." Awaiting user OK.
- CONTENT_LIBRARY sequencing → surface as Decisions outstanding; user-side, not for in-session edit.
- Bundle Phase 2 / Flyer / runFrequentMaintenance verification → surface as Decisions outstanding (re-surfaced from prior reviews).
- MCP vetting Inbox item → no action, keep in Inbox as-is.
