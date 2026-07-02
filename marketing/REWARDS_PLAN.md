# Loyalty Rewards Plan

**Purpose.** A retention gesture for loyal customers, deliberately *not* a discount. JLM used to run automated percentage-off rewards for repeat customers and moved away from it — the brand doesn't want to be discount-oriented (anti-snob, curator positioning, not a retailer pushing markdowns). The reward instead is a physical value-add: an extra bottle, or an upgraded bottle in place of one they ordered.

**Status.** Concept stage, direction agreed 2026-07-02. No build started. Eligibility criteria (which order, what frequency/spend/tenure counts as "loyal") is explicitly undecided and doesn't block scoping the mechanism below — the notification/fulfillment plumbing is independent of how eligibility ends up computed.

---

## Phase 1 — manager-notified, offline fulfillment (near-term, small)

The real near-term software need, scoped down to the minimum: the manager sees a highlighted order on the screen he's already using to prepare packing slips (`ManagerOrdersView`), taps into that customer's CRM record, and logs a note confirming the gesture was done (which bottle, upgrade vs. add). Orders move fast and jlmops tasks are advisory, not workflow-stoppers — so this deliberately does *not* route through the task system. It's a highlight + a shortcut + a durable note, nothing that can block or delay fulfillment.

The note-logging half isn't new infrastructure — `ContactService.createActivity` is already a general-purpose contact-activity write path (used for campaign sends, order events, lifecycle changes; see `.claude/bugs.md`'s Mailchimp-activity entry for the exact call shape). What Phase 1 needs is: (a) a way to flag a contact as reward-eligible, (b) that flag surfacing as a highlight on the relevant row in `ManagerOrdersView`, (c) a tap/click shortcut from that row into the contact's CRM record with a note field ready.

This phase is also the fulfillment path for Phase 2's "let the manager choose" option below — building it now isn't throwaway work even if Phase 2 never ships.

## Phase 2 — self-service at checkout ("dream world," ambitious, not scoped for build)

Eligible customers get a system-flagged reward that surfaces as an active choice at checkout — not a silent auto-apply. A dialog offers: an additional bottle, an upgraded bottle (system-suggested from what's in their cart), or "let the manager choose" (routes to Phase 1's mechanism — the manager's own taste recommendation is the point, not a fallback).

**Suggested-upgrade mechanism, if built:** same category as the cart item, nearest match on complexity/intensity/acidity (the sensory framework attributes — see `content/CLAUDE.md`), price bracketed one notch above and below the original. This is a small, well-specified nearest-neighbor match on attributes JLM already tracks and considers still meaningful — it does *not* depend on the broader attribute/tag cleanup discussed 2026-07-02, which was mostly about long-unused legacy fields, not these three.

**Known prior art, don't repeat the mistake it looks like:** an earlier version of this general shape (auto-applying a coupon) was explicitly rejected — but for a different, specific reason: silent auto-apply via shareable URLs let the discount leak to anyone with the link. This proposal is an active choice the customer makes at checkout, not a silent auto-apply, so that objection doesn't carry over as-is. Worth remembering the history so it doesn't look like relitigating a settled question.

**Infrastructure note:** the WooCommerce coupon plugin was removed a while back; first-purchase discount logic now runs off native theme code, not a plugin (`.claude/bugs.md` history). "Customer has an eligible reward at checkout" would need new plumbing, not a flip of something dormant — this is checkout/theme-flow work (`website/`), not a jlmops-only build.

---

## Open questions

- Eligibility criteria — Nth order, spend threshold, or tenure. Needs a decision before Phase 1's "flag" step can be built.
- Reward definition specifics — is "upgraded bottle" always a same-price-bracket-up swap, or does the manager have full discretion.
- Whether Phase 2 gets scoped for real, or stays aspirational indefinitely.

## Out of scope (for now)

- Automated percentage/coupon-based rewards — explicitly the thing being moved away from.
- Cross-sell/upsell as a general product-discovery feature — Phase 2's suggestion mechanism above is a narrow, self-contained use of the same attributes, not a dependency on a broader cross-sell build.
