# Dashboard Performance Optimization Plan

## Problem Statement

Dashboard loads are slow because:
1. Multiple client roundtrips (4-6 separate `google.script.run` calls per dashboard)
2. Same sheets read repeatedly - each WebApp function reads independently
3. The layered architecture (View → WebApp → Service) has no shared data context

**Current flow (Admin Dashboard):**
```
AdminDashboardView_v2.html
  → google.script.run.WebAppSystem_getHealthData()      → reads SysTasks, SysJobQueue
  → google.script.run.WebAppInventory_getWidgetData()   → reads SysTasks again
  → google.script.run.WebAppOrders_getWidgetData()      → reads SysOrdLog, SysTasks again
  → google.script.run.WebAppTasks_getSummary()          → reads SysTasks again
```

Result: 4+ roundtrips, SysTasks read 4 times, 8-12 second load times.

## Solution: One Endpoint Per Dashboard

No new abstractions. Just consolidate each dashboard into a single endpoint that reads sheets once and builds all widget data.

### Admin Dashboard Endpoint

**File:** `WebAppDashboard.js` (new)

```javascript
/**
 * Single endpoint for Admin Dashboard.
 * One roundtrip, each sheet read once.
 */
function WebAppDashboard_getAdminData() {
  const fnName = 'getAdminData';
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];

    // ========== READ SHEETS ONCE ==========
    const tasksSheet = SheetAccessor.getDataSheet(sheetNames.SysTasks);
    const tasksData = tasksSheet ? tasksSheet.getDataRange().getValues() : [];

    const ordLogSheet = SheetAccessor.getDataSheet(sheetNames.SysOrdLog);
    const ordLogData = ordLogSheet ? ordLogSheet.getDataRange().getValues() : [];

    const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue);
    const jobQueueData = jobQueueSheet ? jobQueueSheet.getDataRange().getValues() : [];

    // ========== CONVERT TO OBJECTS ==========
    const tasks = _rowsToObjects(tasksData);
    const ordLog = _rowsToObjects(ordLogData);
    const jobQueue = _rowsToObjects(jobQueueData);

    // ========== DERIVE COMMON FILTERS ==========
    const openTasks = tasks.filter(t =>
      t.st_Status !== 'Completed' && t.st_Status !== 'Done'
    );

    // ========== BUILD EACH WIDGET ==========
    return {
      sync: _buildSyncWidget(openTasks, jobQueue, allConfig),
      health: _buildHealthWidget(tasks, jobQueue, allConfig),
      orders: _buildOrderWidget(ordLog, openTasks),
      inventory: _buildInventoryWidget(openTasks),
      tasks: _buildTaskWidget(openTasks),
      timestamp: new Date().toISOString()
    };

  } catch (e) {
    LoggerService.error('WebAppDashboard', fnName, e.message, e);
    return { error: e.message };
  }
}

/**
 * Converts 2D array (with header row) to array of objects.
 */
function _rowsToObjects(data) {
  if (!data || data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    headers.forEach((h, j) => obj[h] = data[i][j]);
    rows.push(obj);
  }
  return rows;
}

// ========== WIDGET BUILDERS ==========
// Each receives pre-loaded data, no sheet reads

function _buildSyncWidget(openTasks, jobQueue, allConfig) {
  // Find active sync task
  const syncTask = openTasks.find(t =>
    t.st_TaskTypeId === 'task.sync.daily' && t.st_Status === 'In Progress'
  );

  // Get last completed sync
  const lastSync = jobQueue
    .filter(j => j.sjq_JobType === 'DAILY_SYNC' && j.sjq_Status === 'COMPLETED')
    .sort((a, b) => new Date(b.sjq_EndTime) - new Date(a.sjq_EndTime))[0];

  return {
    isRunning: !!syncTask,
    lastSyncTime: lastSync ? lastSync.sjq_EndTime : null,
    // ... other sync status fields
  };
}

function _buildHealthWidget(tasks, jobQueue, allConfig) {
  // Recent failures
  const recentFailures = jobQueue.filter(j => {
    const isRecent = (new Date() - new Date(j.sjq_EndTime)) < 24 * 60 * 60 * 1000;
    return j.sjq_Status === 'FAILED' && isRecent;
  });

  return {
    failureCount: recentFailures.length,
    taskCount: tasks.length,
    // ... other health metrics
  };
}

function _buildOrderWidget(ordLog, openTasks) {
  const packableTasks = openTasks.filter(t =>
    t.st_TaskTypeId === 'task.order.packing_available'
  );

  const pendingOrders = ordLog.filter(o =>
    o.sol_PackingStatus === 'Ready'
  );

  return {
    packableCount: packableTasks.length,
    pendingCount: pendingOrders.length,
    // ... other order metrics
  };
}

function _buildInventoryWidget(openTasks) {
  const inventoryTasks = openTasks.filter(t =>
    t.st_TaskTypeId === 'task.inventory.count' ||
    t.st_TaskTypeId === 'task.validation.comax_internal_audit'
  );

  return {
    countTasksOpen: inventoryTasks.filter(t => t.st_Status === 'New').length,
    countTasksReview: inventoryTasks.filter(t => t.st_Status === 'Review').length,
    // ... other inventory metrics
  };
}

function _buildTaskWidget(openTasks) {
  return {
    total: openTasks.length,
    byStatus: {
      new: openTasks.filter(t => t.st_Status === 'New').length,
      inProgress: openTasks.filter(t => t.st_Status === 'In Progress').length,
      review: openTasks.filter(t => t.st_Status === 'Review').length
    },
    // ... task summary
  };
}
```

### Manager Dashboard Endpoint

```javascript
/**
 * Single endpoint for Manager Dashboard.
 */
function WebAppDashboard_getManagerData() {
  const fnName = 'getManagerData';
  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];

    // ========== READ SHEETS ONCE ==========
    const tasksSheet = SheetAccessor.getDataSheet(sheetNames.SysTasks);
    const tasksData = tasksSheet ? tasksSheet.getDataRange().getValues() : [];

    const ordLogSheet = SheetAccessor.getDataSheet(sheetNames.SysOrdLog);
    const ordLogData = ordLogSheet ? ordLogSheet.getDataRange().getValues() : [];

    // ========== CONVERT TO OBJECTS ==========
    const tasks = _rowsToObjects(tasksData);
    const ordLog = _rowsToObjects(ordLogData);

    // ========== FILTER FOR MANAGER ==========
    const managerTasks = tasks.filter(t =>
      t.st_Status !== 'Completed' &&
      t.st_Status !== 'Done' &&
      (t.st_Assignee === 'Manager' || t.st_Assignee === 'Packing')
    );

    // ========== BUILD EACH WIDGET ==========
    return {
      calendar: _buildCalendarWidget(managerTasks),
      orders: _buildManagerOrderWidget(ordLog),
      tasks: _buildManagerTaskList(managerTasks),
      timestamp: new Date().toISOString()
    };

  } catch (e) {
    LoggerService.error('WebAppDashboard', fnName, e.message, e);
    return { error: e.message };
  }
}

function _buildCalendarWidget(tasks) {
  // Build 14-day calendar data
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayTasks = tasks.filter(t => {
      const due = t.st_DueDate ? new Date(t.st_DueDate).toISOString().split('T')[0] : null;
      return due === dateStr;
    });

    days.push({
      date: dateStr,
      dayOfWeek: date.getDay(),
      tasks: dayTasks.map(t => ({
        id: t.st_TaskId,
        title: t.st_Title,
        priority: t.st_Priority,
        status: t.st_Status
      }))
    });
  }

  return { days };
}

function _buildManagerOrderWidget(ordLog) {
  const readyOrders = ordLog.filter(o => o.sol_PackingStatus === 'Ready');
  return {
    readyCount: readyOrders.length,
    orders: readyOrders.slice(0, 10).map(o => ({
      orderId: o.sol_OrderId,
      status: o.sol_PackingStatus
    }))
  };
}

function _buildManagerTaskList(tasks) {
  return tasks.map(t => ({
    id: t.st_TaskId,
    title: t.st_Title,
    type: t.st_TaskTypeId,
    status: t.st_Status,
    priority: t.st_Priority,
    dueDate: t.st_DueDate,
    entity: t.st_LinkedEntityId
  }));
}
```

### Client-Side Changes

**AdminDashboardView_v2.html:**
```javascript
// Before: Multiple calls
function loadDashboard() {
  google.script.run.withSuccessHandler(renderHealth).WebAppSystem_getHealthData();
  google.script.run.withSuccessHandler(renderSync).WebAppSync_getStatus();
  google.script.run.withSuccessHandler(renderOrders).WebAppOrders_getWidgetData();
  google.script.run.withSuccessHandler(renderInventory).WebAppInventory_getWidgetData();
}

// After: Single call
function loadDashboard() {
  google.script.run
    .withSuccessHandler(function(data) {
      if (data.error) {
        showError(data.error);
        return;
      }
      renderSyncWidget(data.sync);
      renderHealthWidget(data.health);
      renderOrderWidget(data.orders);
      renderInventoryWidget(data.inventory);
      renderTaskWidget(data.tasks);
    })
    .withFailureHandler(showError)
    .WebAppDashboard_getAdminData();
}
```

**ManagerDashboardView_v2.html:**
```javascript
// After: Single call
function loadDashboard() {
  google.script.run
    .withSuccessHandler(function(data) {
      if (data.error) {
        showError(data.error);
        return;
      }
      renderCalendar(data.calendar);
      renderOrders(data.orders);
      renderTaskList(data.tasks);
    })
    .withFailureHandler(showError)
    .WebAppDashboard_getManagerData();
}
```

## Implementation

### Phase 1: Create WebAppDashboard.js
1. Create new file with both endpoints
2. Add `_rowsToObjects` helper
3. Add widget builder stubs that return minimal data
4. Test endpoints directly in Apps Script editor

### Phase 2: Admin Dashboard
1. Build out `_buildSyncWidget`, `_buildHealthWidget`, etc.
2. Match current data structure that AdminDashboardView expects
3. Update AdminDashboardView_v2.html to use single endpoint
4. Test, measure load time

### Phase 3: Manager Dashboard
1. Build out manager widget builders
2. Match current data structure that ManagerDashboardView expects
3. Update ManagerDashboardView_v2.html to use single endpoint
4. Test, measure load time

### Phase 4: Cleanup (Optional)
1. Remove unused WebApp*_getWidgetData functions if no other callers
2. Or keep them for individual view pages that don't need full dashboard

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Client roundtrips | 4-6 | 1 |
| Sheet reads (SysTasks) | 4 | 1 |
| Sheet reads (total) | 10-15 | 3-4 |
| Dashboard load time | 8-12s | 2-4s |

## Files

**Create:**
- `WebAppDashboard.js`

**Modify:**
- `AdminDashboardView_v2.html` - use `WebAppDashboard_getAdminData()`
- `ManagerDashboardView_v2.html` - use `WebAppDashboard_getManagerData()`
- `appsscript.json` - add WebAppDashboard.js

**No changes to:**
- Existing WebApp*.js files (keep for other uses)
- Service layer files
- SheetAccessor.js

## Risks

| Risk | Mitigation |
|------|------------|
| Large response payload | Only return what widgets need, not full row data |
| Breaking existing views | New endpoint is additive; old functions still work |
| Widget data structure mismatch | Match existing structure exactly, refactor later |

## Success Criteria

1. Dashboard load time under 4 seconds
2. Single network request visible in browser dev tools
3. No functional regressions

---

# Bundles Health Check — N+1 Sheet Reads (added 2026-06-01, not implemented)

## Problem

`WebAppBundles_getViewData` (the Bundles view mount endpoint) takes **100s+**. It fans out to four calls — `getCategories`, `getStats`, `getAllBundles`, `getBundlesWithLowInventory` — and the last one is the killer.

This is a **different shape** from the dashboard problem above: not client round-trips, but **N+1 sheet reads inside a single server call**.

**Root cause** — `BundleService.getBundlesWithLowInventory` (`BundleService.js:830`):
- Does a correct bulk setup (bundles, slots, CmxProdM, SysInventoryOnHold, WebProdM read once).
- Then a per-bundle → per-slot loop calls `getEligibleProducts(slot.slotId, …)` (`:920`) once per low-stock slot.
- **Each `getEligibleProducts` call re-reads whole sheets from scratch:** full `WebProdM` (`:683`), full `WebDetM` when the slot has intensity/complexity/acidity criteria (`:696`), and a full `_loadSlots()` reload (`:718`).
- Cost = (low-stock slots) × (full-sheet reads). GAS sheet reads are the slowest primitive, so it blows up to 100s+.

Everything `getEligibleProducts` re-reads is **invariant** across one `getBundlesWithLowInventory` run — the product dataset, details, and slot list don't change between slots. Only two things vary per slot: the slot's flavor criteria and its excluded-SKU set (both cheap, in-memory).

## Caller set (verified 2026-06-01)

- `BundleService.js:920` — the hot loop (the only N+1 caller).
- `AdminBundlesView.html:1059` → `WebAppBundles_getEligibleProducts` (`WebAppBundles.js:371`) — interactive, **single-shot** when the user selects a slot in the editor. Must stay unchanged.
- `BundleService.js:1588` — public API export.

So the refactor's context param must be **purely additive** — absent → behave exactly as today (keeps the interactive path identical), present → skip the internal reads.

## Fix A — hoist invariant loads (primary; behavior-identical)

1. In `getBundlesWithLowInventory`, build a preload context once at the top: `WebProdM` rows+cols, the `WebDetM` details map, `_loadSlots()`, and `getAllConfig()` / minStock.
2. Refactor `getEligibleProducts(slotId, options)` to accept an optional `options.ctx = { webData, webCols, detailsMap, allSlots, minStock }`. When present, use it and skip the sheet reads; when absent, read sheets as today.
3. `getBundlesWithLowInventory` builds `ctx` once and passes it to every `getEligibleProducts` call.

Net: N full-sheet reads → 1. Output identical.

Note: today `detailsMap` is only built when a slot specifies intensity/complexity/acidity. Hoisting builds it once unconditionally (one extra `WebDetM` read, amortized) — acceptable.

## Fix B — lazy-load healthAlerts off the mount path (complementary; optional)

- Drop `healthAlerts` from `WebAppBundles_getViewData`; the view renders on categories + stats + bundles alone.
- Compute low-inventory only when the user opens the health/alerts panel, via a separate `WebAppBundles_getBundlesWithLowInventory()` call with a spinner.
- Bundles is a desktop admin tool; the health view isn't needed on every mount.

## Sequencing

Do **Fix A first** — it's the root cause, behavior-identical, low risk. Add **Fix B** only if mount latency still matters after A (with A, the health compute is already a few seconds; B moves it off the critical path entirely).

## Expected impact

| Metric | Before | After (A) | After (A+B) |
|--------|--------|-----------|-------------|
| `WebAppBundles_getViewData` | 100s+ | a few seconds | sub-second mount |
| Full `WebProdM` reads in health check | N (per low-stock slot) | 1 | 1, on demand |

## Files

**Modify:** `BundleService.js` (`getBundlesWithLowInventory` + `getEligibleProducts` signature). For Fix B also `WebAppBundles.js` + `AdminBundlesView.html`.
**No changes to:** the interactive eligible-products path's behavior (additive param), SheetAccessor, schema/config.

## Status

Planned 2026-06-01, not implemented. Bug logged in `.claude/bugs.md` (2026-06-01).
