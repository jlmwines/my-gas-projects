# JLM Wines — Strategy

**Purpose.** Long-horizon strategic context: posture, priorities, direction-level principles. Reviewed quarterly. Updates only when strategic direction shifts — not when individual initiatives ship.

**Not this doc:**
- Current state, metrics, what's in flight → `plans/STATUS.md`
- Dated milestones → `CALENDAR.md`
- Per-area implementation detail → plan docs in `plans/` or `<area>/plans/`

If something here would need to change because a feature shipped or a sprint ended, it belongs in STATUS, not here.

---

## Period Focus

**Acquisition — online and offline.** Online channels: organic content (blog → SEO authority via the Israeli Wine Guide architecture), email list reactivation, welcome-trigger conversion. Offline: printed newsletter insert; flyer + tasting events queued as wishlist.

Retention and optimization continue alongside but are not the lever this period. Specifically: campaign-engagement work, KPI-tab build, mobile LCP tuning are de-prioritized relative to acquisition channel activity.

---

## Strategic Posture

- **Recovery posture has ended.** Theme cutover (2026-05-05) is closed; the site is in steady-state operation.
- **Internal build pushed heavy** through April–May 2026; outbound channels were intentionally quiet. The reversal of that posture — putting outbound into active cadence — is the next period's primary work.
- **Action layer > data layer.** The system already produces more data signals than the human can act on. Build less data infrastructure, ship more action surface. (Manager CRM Half 2 closed half this gap; outbound side remains the open half.)

---

## Brand Axis

- **Friendly, personal, never talks down.** No jargon. No teaching wine vocabulary.
- **Anti-snob.** Curation-led trust > selection breadth. We do the work so the customer doesn't have to.
- **Never negative about competitors / wineries / wines.** Show the position through what we do, not by criticizing.

Full guidelines: `business/CONTENT_STRATEGY.md`. This doc holds only the axis; CONTENT_STRATEGY holds the application detail.

---

## Direction Principles by Area

### Marketing

- **Email = "we exist" reminder.** Don't ask for behavior changes in email. Restart-after-silence is the dominant near-term need.
- **One campaign, two language copies (EN + HE).** Microsegmentation is not justified at current volume.
- **Newsletter insert** = primary near-term offline marketing channel.
- **Year in Wine retrospective** and similar high-effort personalization plays backfire at current volume. Dropped from active roadmap. (See `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` "What didn't work.")

### Website

- **Theme is the customer surface.** Visual + perf changes here have the highest leverage; treat any theme work as customer-facing-priority.
- **Performance follows content priority, not vice versa.** Mobile LCP tuning is queued because acquisition content is the lead lever, not because perf doesn't matter.

### jlmops

- **Sync is stable. Don't rebuild it.** Bug fixes only.
- **Outbound side is the open frontier.** Campaign-send execution, scheduled triggers, action-layer surfaces — these are where build energy belongs.
- **No new sophistication of CRM data layer** until the existing layer is fully exercised by actions.

### Content

- **Editorial pipeline is acquisition.** Each post is SEO authority + newsletter material + email content. Treat as a multi-channel asset, not a single-channel one.
- **Monthly drop cadence** paired with newsletter QR. Don't accelerate just because production is faster; cadence is the discipline.
- **Print Newsletter Body** is a required source section. The companion Mailchimp campaign rides on the same post.

---

## Strategic Seams (cross-cutting)

Connections between areas where a directional decision in one constrains another. These are stable enough to live here; specific-implementation seams live in plan docs.

- **Build-less-data, ship-more-action.** Affects every initiative — verification track design, campaign launches, KPI-tab decision (kept deferred). The default answer to "should we add a data surface?" is "no, unless an action surface needs it."
- **Cross-sell loop** — schema exists, calculation not built. Decision deferred until campaign-engagement data justifies the work.
- **Offline → online attribution** — flyer + tasting will need coupon codes + UTM-tagged QR. Attribution scheme is parked (Inbox `defer:2026-07-01`) because those channels aren't shipping yet.

---

## Review Cadence

This doc is reviewed **quarterly**. Updates fire only when:
- Strategic posture shifts (e.g. acquisition → retention as period focus)
- A direction-level principle inverts (e.g. "build less data" stops being right)
- A new cross-cutting seam emerges that spans plan docs

If a change to this doc seems triggered by a single initiative shipping or a single sprint ending — that change belongs in STATUS.md, not here. This file should age slowly.

---

Updated: 2026-05-15
