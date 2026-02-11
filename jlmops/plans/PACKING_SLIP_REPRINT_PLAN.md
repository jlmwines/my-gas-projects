# Packing Slip Reprint Control

## Problem

When an order is edited after its packing slip is printed (while still on-hold), the printed slip becomes stale. The manager needs a way to reprint with updated data, but reprints should be rare and intentional - not offered for every printed order.

## Key Insight

- **Mutable orders (on-hold):** Can be edited, packing slip might become stale after print
- **Immutable orders (processing/completed):** Cannot be edited, packing slip data is final
- **Reprint only needed if:** Printed while mutable, might have been edited before becoming immutable

## Solution

Track packing slip state through a progression that coordinates printing with order sync. Offer reprint only when meaningful (order was printed while mutable and is still in reprint window).

---

## State Machine

### States

| State | Meaning | Cache Action |
|-------|---------|--------------|
| `Ineligible` | pending, cancelled, failed, trash | No cache |
| `Ready` | Eligible, not yet printed | Keep cache |
| `PrintedMutable` | Printed while on-hold | Refresh on sync |
| `ReprintWindow` | Was mutable at print, now immutable, window open | Refresh on sync |
| `Closed` | Done, no reprint available | Clean up cache |
| `Refunded` | Permanent close, cannot reopen | Clean up cache |

### Fields Required

| Field | Type | Purpose |
|-------|------|---------|
| `sol_PackingSlipState` | string | Current state |
| `sol_ImmutableSince` | timestamp | When order became immutable |
| `sol_SyncsSinceImmutable` | integer | Count of syncs since immutable |

### Window Close Condition

**Both must be true:**
- `sol_SyncsSinceImmutable >= 2`
- Days since `sol_ImmutableSince >= 2`

---

## State Transitions

```
                                    Order arrives
                                         |
                         +---------------+---------------+
                         |                               |
                    eligible                        ineligible
                         |                               |
                         v                               v
                      Ready                         Ineligible
                         |                               |
          +--------------+---------------+               |
          |                              |               |
    print while               print while           status becomes
      on-hold                 immutable               eligible
          |                              |               |
          v                              v               |
   PrintedMutable ---------------------->+<--------------+
          |                              |
          |                              v
    status becomes                    Closed
      immutable                          ^
          |                              |
          v                              |
    ReprintWindow -----> reprinted ------+
          |
          +-----> syncs>=2 AND days>=2 --+
```

### Detailed Transitions

| From State | Event | To State | Notes |
|------------|-------|----------|-------|
| - | Order arrives eligible | Ready | Prepare cache |
| - | Order arrives ineligible | Ineligible | No cache |
| Ineligible | Status→eligible | Ready | Prepare cache |
| Ready | Printed while on-hold | PrintedMutable | |
| Ready | Printed while immutable | Closed | No reprint needed |
| PrintedMutable | Sync (still on-hold) | PrintedMutable | Refresh cache |
| PrintedMutable | Reprinted (still on-hold) | PrintedMutable | Might edit again |
| PrintedMutable | Status→immutable + sync | ReprintWindow | syncs=1, start counting |
| ReprintWindow | Sync (window open) | ReprintWindow | syncs++, refresh cache |
| ReprintWindow | Reprinted | Closed | Got fresh data |
| ReprintWindow | syncs>=2 AND days>=2 | Closed | Window expired |
| Any (not Closed/Refunded) | Status→cancelled | Ineligible | Can reopen later |
| Any | Status→refunded | Refunded | Permanent, cannot reopen |

---

## UI Changes

### Packing Slip Card (Top)
- Shows only `Ready` orders (unprinted)
- No change to current behavior for first prints

### Open Orders Card (Below)
- Shows on-hold and processing orders
- **Reprint button/checkbox** appears for orders in:
  - `PrintedMutable`
  - `ReprintWindow`
- **No reprint** for: `Ready`, `Closed`, `Refunded`, `Ineligible`

### Reprint Flow
1. Manager sees order in Open Orders list
2. Clicks "Reprint" (only visible if applicable)
3. Order appears in Packing Slip card for printing
4. After print: if immutable → Closed; if still mutable → stays PrintedMutable

---

## Scenarios Traced

### Scenario 1: Happy path - print, no edit, no reprint
```
Day 1: On-hold, Sync → Ready, cache v1
       Printed → PrintedMutable
Day 2: Status→processing
       Sync → ReprintWindow (syncs=1, days=0), refresh cache
Day 3: Sync → syncs=2, days=1 (not 2 days yet), refresh
Day 4: Sync → syncs=3, days=2 → Closed, clean up
```

### Scenario 2: Print, edit, sync while mutable
```
Day 1: On-hold, Sync → Ready, cache v1
       Printed → PrintedMutable
       Edited → v2
       Sync → PrintedMutable, refresh → v2
Day 2: Status→processing
       Sync → ReprintWindow (syncs=1), refresh v2
Day 3: Sync → syncs=2, days=1, refresh
Day 4: Sync → syncs=3, days=2 → Closed
```

### Scenario 3: Print, edit, NO sync before immutable
```
Day 1: On-hold, Sync → Ready, cache v1
       Printed → PrintedMutable
       Edited → v2 (no sync)
       Status→processing (no sync)
Day 2: Sync → ReprintWindow (syncs=1, days=0), refresh → v2
Day 3: Sync → syncs=2, days=1, refresh
Day 4: Sync → syncs=3, days=2 → Closed
```

### Scenario 4: Print, edit, NO sync for 5 days
```
Day 1: On-hold, Sync → Ready, v1
       Printed → PrintedMutable
       Edited → v2
       Status→processing
Day 2-5: (no sync)
Day 6: Sync → ReprintWindow (syncs=1, days=5), refresh → v2
Day 7: Sync → syncs=2, days=6 → Closed (both conditions met)
```

### Scenario 5: Print mutable, reprint after immutable
```
Day 1: On-hold, Sync → Ready, v1
       Printed → PrintedMutable
       Edited → v2
Day 2: Status→processing
       Sync → ReprintWindow (syncs=1), refresh → v2
       Reprinted → Closed, clean up
```

### Scenario 6: Print while already immutable
```
Day 1: Order arrives processing
       Sync → Ready, cache v1
Day 2: Printed → Closed, clean up
```

### Scenario 7: Never printed, becomes immutable, then printed
```
Day 1: On-hold, Sync → Ready, cache v1
Day 2: Status→processing, Sync → Ready (still not printed)
Day 3: Sync → Ready
Day 4: Printed → Closed (printed while immutable)
```

### Scenario 8: Reprint while still mutable
```
Day 1: On-hold, Sync → Ready, v1
       Printed → PrintedMutable
       Edit → v2, Sync → refresh v2
       Reprinted → PrintedMutable (stays, still mutable)
       Edit → v3, Sync → refresh v3
Day 2: Status→processing
       Sync → ReprintWindow (syncs=1), refresh v3
```

### Scenario 9: Stays on-hold forever
```
Day 1: On-hold, Sync → Ready, v1
       Printed → PrintedMutable
Day 2: Sync → PrintedMutable, refresh
Day 30: Sync → PrintedMutable, refresh (never closes until immutable)
```

### Scenario 10: Cancelled after print, then reopened
```
Day 1: On-hold, Sync → Ready, v1
       Printed → PrintedMutable
Day 2: Status→cancelled, Sync → Ineligible, clean up
Day 3: Status→on-hold, Sync → Ready, cache reprepared
Day 4: Printed → PrintedMutable (fresh start)
```

### Scenario 11: Refunded (permanent)
```
Day 1: On-hold, Sync → Ready, v1
       Printed → PrintedMutable
Day 2: Status→refunded
       Sync → Refunded, clean up (cannot reopen)
```

### Scenario 12: Pending payment
```
Day 1: Arrives pending
       Sync → Ineligible (no cache)
Day 2: Status→on-hold (paid)
       Sync → Ready, cache prepared
Day 3: Printed → PrintedMutable
```

### Scenario 13: Rapid syncs same day
```
Day 1 AM: On-hold, Sync → Ready, v1
          Printed → PrintedMutable
          Status→processing
Day 1 PM: Sync → ReprintWindow (syncs=1, days=0)
Day 1 EVE: Sync → syncs=2, days=0 (not 2 days)
Day 2: Sync → syncs=3, days=1 (not 2 days)
Day 3: Sync → syncs=4, days=2 → Closed
```

### Scenario 14: In ReprintWindow, order completed
```
Day 1: On-hold, printed → PrintedMutable
Day 2: Status→processing, Sync → ReprintWindow (syncs=1)
Day 3: Status→completed, Sync → syncs=2, days=1 (stay in window)
Day 4: Sync → syncs=3, days=2 → Closed
```

---

## Implementation Notes

### Files to Modify

1. **SysOrdLog schema** - Add new fields
2. **OrderService.js** - Update `processStagedOrders()` for state transitions
3. **PackingSlipService.js** - Coordinate cache refresh with state
4. **PrintService.js** - Update state on print
5. **ManagerOrdersView.html** - Add reprint UI to Open Orders
6. **WebAppOrders.js** - Expose reprint eligibility to UI

### Cache Refresh Logic

```javascript
// During sync, for each order:
if (state === 'PrintedMutable' || state === 'ReprintWindow') {
  // Refresh cache from WebOrdItemsM
  refreshPackingCache(orderId);
}
```

### Window Check Logic

```javascript
function isWindowClosed(order) {
  if (!order.sol_ImmutableSince) return false;
  const daysSinceImmutable = (now - order.sol_ImmutableSince) / (1000 * 60 * 60 * 24);
  return order.sol_SyncsSinceImmutable >= 2 && daysSinceImmutable >= 2;
}
```

---

## Open Questions

1. Should `sol_SyncsSinceImmutable` reset if order is cancelled and reopened?
   - **Proposed:** Yes, fresh start on reopen

2. What if sync runs multiple times per day?
   - **Handled:** Syncs count up, but 2-day minimum still required

3. Should we show "days remaining" in reprint window UI?
   - **Proposed:** No, keep UI simple - just show reprint button or not

---

## Status

- [ ] Plan reviewed and approved
- [ ] Schema changes defined
- [ ] Implementation started
- [ ] Testing complete
- [ ] Deployed
