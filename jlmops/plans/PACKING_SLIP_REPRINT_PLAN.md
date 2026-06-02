# Packing Slip Reprint Control

**Simplified & approved:** 2026-06-02. (Supersedes the original state-machine design — see git history.)

## Problem

A printed packing slip can go stale if its order is edited afterward, and occasionally a slip needs reprinting. The original design was a 6-state mutability / reprint-window machine built to decide *when* a reprint is safe and should be offered. In practice: reprints are **rare**, the person packing is the **business owner**, and there is no security reason to gate reprints. The machinery isn't worth its cost — and it was never implemented.

## Design (simplified)

Three moves — no state machine, no new schema, no timers:

1. **Reprint regenerates from current order data.** Every (re)print builds the slip from the order's *current* contents, so it can never be stale. This one choice removes the entire reason the state machine existed — the "is this slip stale after an edit?" question disappears. ("Prepared once" means we don't track mutability state, not that we freeze a stale copy.)
2. **Print queue = eligible, unprinted orders, read from order/packing state** — shown directly in the Packing Slip card. Availability is derived from state (`sol_PackingStatus = Ready`), **not** inferred from the presence of a task.
3. **"Recent" reprint list.** Every order still in the **active orders sheet (`WebOrdM`, i.e. not yet archived)** gets a Reprint action — printed or not. "Recent" = unarchived; no window/timer logic. The manager (owner) can reprint any recent slip, period.

## What this replaces (dropped 2026-06-02)

- The `Ineligible / Ready / PrintedMutable / ReprintWindow / Closed / Refunded` state machine.
- Proposed fields `sol_PackingSlipState`, `sol_ImmutableSince`, `sol_SyncsSinceImmutable`.
- The 2-syncs-and-2-days reprint-window close logic and the 14 traced scenarios.

(All preserved in this file's git history if ever needed.)

## The `task.order.packing_available` task

Today this de-duped singleton (entityId `PACKING`, `due_pattern: immediate`) is the *only* "orders available to print" signal, and closes only when `PrintService` prints everything down to 0 `Ready`. Its due date never refreshes, so it ages into dashboard "overdue" (observed 2026-06-02). Under this design, availability is read from order/packing state, so the singleton is **retired** — or demoted to a thin, no-due-date "you have orders to pack" nudge. Either way the overdue-aging symptom is gone.

(Do **not** blanket-suppress overdue styling on *all* system tasks — inventory counts / comax validations may carry real deadlines; only this packing indicator is the clear non-deadline case.)

## Implementation sketch

- **PrintService.js** — the reprint path regenerates the slip from current order data (reuse the first-print generation path); no freshness tracking.
- **WebApp.js / WebAppOrders.js** — the print queue already derives from `sol_PackingStatus = Ready` (`getPackableOrders`); expose the "recent" set (unarchived `WebOrdM` orders) with a `printed?` flag so the UI can offer Reprint on any of them.
- **Packing / Manager Orders UI** — Packing Slip card = unprinted queue; a Recent list shows unarchived orders with a Reprint button (printed ones included).
- **Task** — stop using `task.order.packing_available` as the availability source; retire it (or demote to a no-due nudge) and reconcile the `PackingSlipService` create + `PrintService` close paths.

## Status

- [x] Design simplified + approved (2026-06-02)
- [ ] Implementation
- [ ] Testing
- [ ] Deployed
