# Loyalty Rewards Plan

**Purpose.** A retention gesture for loyal customers, deliberately *not* a discount. JLM used to run automated percentage-off rewards for repeat customers and moved away from it — the brand doesn't want to be discount-oriented (anti-snob, curator positioning, not a retailer pushing markdowns). The reward instead is a physical value-add: an extra bottle, or an upgraded bottle in place of one they ordered.

**Status.** Phase 1 shipped 2026-07-14. Eligibility decision made the same day: no automated rule — see Phase 1 below.

---

## Phase 1 — manager-judged, logged inline (SHIPPED 2026-07-14)

No system-computed eligibility flag and no cooldown check, by design — matches the brand's curator positioning (a human call, not a system rule). On the manager's order screen (`jlmops/OrdersView.html`, Open Orders card — not `ManagerOrdersView`, which never existed as a file), each order row shows the customer's tier, last order date, lifetime spend, and average order value, all pulled from their existing CRM record. The manager judges from that data whether the order merits a reward.

Two actions per row, both manager-only: a CRM link (deep-links straight into that customer's `ManagerContactView` record, for messaging via the channels already there) and a "Log Reward" button (small note — which bottle, upgrade vs. add — saved via the existing `ContactService.createActivity`/`WebAppContacts_logActivity` path as a new `reward.given` activity type). Logging happens inline on the order screen; no navigate-away-and-back required, though the manager can still open the CRM link first to message the customer, then come back and log it.

Server-side, this is a second, separate `google.script.run` call (`WebAppOrders_getContactSummaries`) fired after the order list itself renders — deliberately split so adding customer data doesn't delay the order list's initial load.

## Phase 2 — self-service at checkout ("dream world," ambitious, not scoped for build)

Eligible customers get a system-flagged reward that surfaces as an active choice at checkout — not a silent auto-apply. A dialog offers: an additional bottle, an upgraded bottle (system-suggested from what's in their cart), or "let the manager choose" (routes to Phase 1's mechanism — the manager's own taste recommendation is the point, not a fallback).

**Suggested-upgrade mechanism, if built:** same category as the cart item, nearest match on complexity/intensity/acidity (the sensory framework attributes — see `content/CLAUDE.md`), price bracketed one notch above and below the original. This is a small, well-specified nearest-neighbor match on attributes JLM already tracks and considers still meaningful — it does *not* depend on the broader attribute/tag cleanup discussed 2026-07-02, which was mostly about long-unused legacy fields, not these three.

**Known prior art, don't repeat the mistake it looks like:** an earlier version of this general shape (auto-applying a coupon) was explicitly rejected — but for a different, specific reason: silent auto-apply via shareable URLs let the discount leak to anyone with the link. This proposal is an active choice the customer makes at checkout, not a silent auto-apply, so that objection doesn't carry over as-is. Worth remembering the history so it doesn't look like relitigating a settled question.

**Infrastructure note:** the WooCommerce coupon plugin was removed a while back; first-purchase discount logic now runs off native theme code, not a plugin (`.claude/bugs.md` history). "Customer has an eligible reward at checkout" would need new plumbing, not a flip of something dormant — this is checkout/theme-flow work (`website/`), not a jlmops-only build.

---

## Open questions

- Reward definition specifics — is "upgraded bottle" always a same-price-bracket-up swap, or does the manager have full discretion.
- Whether Phase 2 gets scoped for real, or stays aspirational indefinitely.

## Out of scope (for now)

- Automated percentage/coupon-based rewards — explicitly the thing being moved away from.
- Cross-sell/upsell as a general product-discovery feature — Phase 2's suggestion mechanism above is a narrow, self-contained use of the same attributes, not a dependency on a broader cross-sell build.
