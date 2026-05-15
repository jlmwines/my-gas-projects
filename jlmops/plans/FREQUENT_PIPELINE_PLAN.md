# Frequent Pipeline Plan

**Status.** SHIPPED 2026-05-15 (@117 → @119). Build Order Steps 1–3 complete: (1) `createWelcomeOutreachTasks` refactored to derive its signal from WebOrdM directly (`HousekeepingService.js:962`); (2) full pipeline wired into `performFrequentMaintenance` with sync-state + cadence guards (`HousekeepingService.js:655`); (3) `createPendingPaymentFollowups` removed from `performDailyMaintenance` Phase 3 (lives only in frequent). Refinements during in-session testing:
- **Forward cursor** via SysConfig `crm.frequent_pipeline.last_modified_floor` replaces the fixed 30-day floor on `WooOrderPullService.pullOrders`. Runtime observed: 58s → 27s → 10s as the cursor stamped and bounded the `modified_after` window.
- **Cadence guard tightened** to Israeli business hours: Sun-Thu 08:00–20:00 IL, Fri 08:00–13:00 IL, Sat off (was 07:00–23:00 every day). Apps Script trigger API can't combine 20-min intervals with day-of-week, so the schedule lives in code.

**Pending user steps (Build Order 4–5):** ~~arrange trigger~~ 15-min time-driven trigger arranged 2026-05-15 (Apps Script `everyMinutes()` accepts 1/5/10/15/30 — 20 isn't valid; 15 is close enough, the cadence guard handles the per-day window). Remove any standalone `pullWooOrders` time-driven trigger if one exists (redundant now — `runFrequentMaintenance` calls `pullOrders` itself with the forward cursor; a standalone trigger would duplicate the unbounded 30-day pull each fire). Observe one business day, verify cursor advances, no error spam, welcome + pending-payment fire as expected. Overnight cadence intentionally off (binary on/off rather than reduced-frequency overnight); revisit if morning reports show problematic backlog burst.

**Purpose.** One time-driven trigger every ~20 minutes during business hours that pulls fresh orders from Woo and immediately runs the housekeeping sweeps that benefit from sub-hourly cadence (pending-payment follow-up, first-order welcome). Replaces the indirect path where pending-payment detection waited on the daily sync to refresh WebOrdM.

---

## Verified Behavior of `WooOrderPullService.pullOrders()`

Confirmed by reading `WooOrderPullService.js`. The function is self-contained:

1. Fetches orders from Woo REST API with a 30-day rolling window.
2. Transforms each API order into `wos_*` staging format.
3. Writes to WebOrdS staging sheet.
4. Runs validation suite (`order_staging`); throws if any rule fails.
5. Calls `OrderService.processStagedOrders` internally — lands data in WebOrdM master and SysOrdLog.

So **one call** runs the entire order pipeline. ~15 paginated API calls per run for a 30-day window on a quiet store like JLM.

---

## Design

### Sequence inside `performFrequentMaintenance`

1. **Sync-state guard.** Read `SyncStateService.getActiveSession()`. If `currentStage` is anything other than `IDLE` / `COMPLETE` / `FAILED` (i.e., the daily 12-state sync is mid-flight), skip and return immediately. Avoids racing the daily sync's writes to WebOrdS / WebOrdM.

2. **Cadence guard.** Optional time-of-day filter. If the configured "frequent window" excludes the current hour, skip. Default proposal: 07:00–23:00 Israel time. Implemented as a code-side `Hour()` check rather than two triggers, so the schedule lives in code/config and survives trigger reconfiguration.

3. **Order pull.** `WooOrderPullService.pullOrders()`. Self-contained — pull + transform + stage + validate + process to master.

4. **Welcome outreach sweep.** `createWelcomeOutreachTasks()`, but **refactored** (see below) so it no longer depends on `refreshCrmContacts` populating `sc_FirstCompletedDate`. The signal is derived directly from WebOrdM by the sweep itself: find emails whose earliest completed order is on/after the floor and which don't yet have an open outreach task.

5. **Pending-payment follow-up sweep.** `createPendingPaymentFollowups()`. Unchanged from @111. Reads WebOrdM directly; no contact-aggregate dependency.

Each step wrapped in try/catch — a failing step does not abort the chain.

### Why `refreshCrmContacts` stays out of the frequent pipeline

`refreshCrmContacts` does a full contact recomputation (`ContactImportService.updateContactsFromOrders` iterates all orders for all emails), full enrichment (`ContactEnrichmentService.enrichAllContacts`), and 12-month spend recalc (`updateContactSpend12Month`). Running that every 20 minutes is wasteful — most contacts don't change between pulls, and the enrichment work is expensive.

So the frequent pipeline doesn't call it. The daily trigger continues to call it. The price: `sc_FirstCompletedDate` updates at daily cadence, not frequent.

### Welcome trigger refactor

To get the welcome task on the frequent cadence without dragging the full contact refresh along, change `createWelcomeOutreachTasks` to read its signal from WebOrdM directly:

- Find unique billing emails in WebOrdM where the **earliest completed-status order date** for that email is on/after `system.crm.welcome_floor_date`.
- For each such email, look up the contact via `ContactService.getContactByEmail` (cheap, returns the row).
- If no open `task.contact.outreach` exists for that email → create one (existing dedupe in `TaskService.createTask`).

This eliminates the dependency on `sc_FirstCompletedDate`. The field can stay populated by the daily refresh for other consumers (reporting, etc.), but the welcome sweep no longer needs it.

Trade-off: the sweep iterates WebOrdM each run, grouping by email and computing min(orderDate where status='completed'). For ~1500 orders in a 30-day window plus archives, that's manageable but not free. Cache or memoize if it becomes a bottleneck.

### Cadence guard implementation sketch

```js
this.performFrequentMaintenance = function() {
  // Sync-state guard
  const session = SyncStateService.getActiveSession();
  const blockingStages = ['IMPORTING_PRODUCTS','IMPORTING_ORDERS','EXPORTING_ORDERS',
    'IMPORTING_COMAX','VALIDATING','WAITING_ORDER_EXPORT','WAITING_ORDER_CONFIRM',
    'WAITING_COMAX_IMPORT','WAITING_WEB_EXPORT','WAITING_WEB_CONFIRM'];
  if (session && blockingStages.indexOf(session.currentStage) >= 0) {
    logger.info(...'Daily sync in progress (' + session.currentStage + '). Skipping frequent pipeline.');
    return;
  }

  // Cadence guard (07:00–23:00 Israel)
  const hour = parseInt(Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'H'), 10);
  if (hour < 7 || hour >= 23) {
    logger.info(...'Outside frequent window (hour=' + hour + '). Skipping.');
    return;
  }

  // Pipeline
  try { WooOrderPullService.pullOrders(); }
  catch (e) { logger.error(...'Order pull failed: ' + e.message); }

  try { this.createWelcomeOutreachTasks(); }
  catch (e) { logger.error(...'Welcome sweep failed: ' + e.message); }

  try { this.createPendingPaymentFollowups(); }
  catch (e) { logger.error(...'Pending-payment sweep failed: ' + e.message); }
};
```

### What stays in daily

Everything else: Mailchimp pulls (subscribers + campaigns), `refreshCrmContacts` (contact aggregate + enrichment + spend), bundle composition + health, Brurya / coupons reminders, deploy validation, city lookup maintenance, activity backfill, CRM intelligence. None of these benefit from sub-hourly cadence.

### Daily sync stays

The 12-state daily sync via the admin sync widget continues unchanged. The frequent pipeline is additive — it just makes the order-side data fresher between full syncs. The sync-state guard prevents conflict when the manual sync runs.

---

## Open Questions

- **Cadence window** — 07:00–23:00 Israel proposed. Or 24x7 (no guard)? Or business hours only (09:00–18:00)? Customer email at 6am may feel less personal than at 10am, but the cost of 24x7 is just a handful of additional pulls per day.
- **Frequency** — 20 minutes proposed. Could be 15 / 30 / hourly. 20 gives "within the hour" responsiveness with one cushion sweep.
- **Failure escalation** — if `pullOrders` fails repeatedly, do we want a `task.system.*` task surfaced for admin? Currently failure just logs.

---

## Build Order

1. Refactor `createWelcomeOutreachTasks` to derive `sc_FirstCompletedDate`-equivalent signal from WebOrdM directly. Verify behavior unchanged from the daily perspective.
2. Update `performFrequentMaintenance` to call the full pipeline (sync-state guard → cadence guard → pullOrders → welcome sweep → pending-payment sweep).
3. Remove `createPendingPaymentFollowups` from `performDailyMaintenance` (it lives only in frequent now). Keep `createWelcomeOutreachTasks` in both for the daily fallback during transition.
4. User configures the time-driven trigger in the Apps Script editor: function `runFrequentMaintenance`, every 20 min, no day restriction (cadence guard handles hours).
5. Observe one full day, verify follow-up emails are firing as expected.

---

## Cross-Reference

- `jlmops/plans/CONTACT_MANAGER_PLAN.md` — Half 2 action layer this builds on.
- `jlmops/SyncStateService.js` — state machine the guard reads from.
- `jlmops/WooOrderPullService.js` — `pullOrders()` is the self-contained entry point.
