# Sync Widget V2 - Clean Event-Driven Design

**Date:** 2025-12-07
**Status:** Ready for testing
**Replaces:** AdminDailySyncWidget.html (complex state-machine version)

## The Problem with V1

The original widget tried to be too clever:
- Complex state machine with 10+ states
- Polling triggered job processing AND state checking
- UI logic mixed with workflow logic
- Job statuses cached and stale
- Race conditions everywhere
- Updates only happened after everything completed

## The V2 Solution: Event-Driven Status

### Core Principle
**Jobs write their own status as they happen. UI just reads and displays.**

### Three New Components

#### 1. SyncStatusService.js
Simple status tracking service:
- `writeStatus(sessionId, {step, status, message})` - Jobs call this as they work
- `getSessionStatus(sessionId)` - UI calls this to display
- `clearSession(sessionId)` - Reset functionality

**Database:** New sheet `SysSyncStatus` with columns:
- Timestamp
- SessionID
- Step (1-5)
- StepName
- Status (waiting/processing/completed/failed)
- Message
- Details (JSON)

#### 2. Updated WebAppSync.js
Functions now write status updates:
```javascript
startDailySyncBackend() {
  // Create session
  const sessionId = generateSessionId();

  // Write status immediately
  SyncStatusService.writeStatus(sessionId, {
    step: 1,
    status: 'processing',
    message: 'Queueing import jobs...'
  });

  // Queue and process jobs
  queueJobs(sessionId);
  run('hourly');

  // Return current status
  return SyncStatusService.getSessionStatus(sessionId);
}
```

#### 3. AdminDailySyncWidget_v2.html
Simplified UI:
- Just displays step status
- Shows appropriate buttons based on status
- No complex logic
- Polls `getSyncStateFromBackend()` every 3 seconds

## How It Works

### Step 1: User Clicks "Start"
```
Backend:
  1. Write: Step 1 = "processing" - "Queueing jobs..."
  2. Queue jobs
  3. Write: Step 1 = "processing" - "Processing orders, products..."
  4. Trigger job processor
  5. Return status

UI Updates:
  - Step 1 shows spinner + "Processing orders, products..."
```

### Step 2: Jobs Complete
```
OrchestratorService._checkAndAdvanceSyncState():
  1. Check job statuses
  2. All complete? Write: Step 1 = "completed"
  3. Write: Step 2 = "waiting" - "5 orders ready to export"

Next UI Poll (3 seconds later):
  - Step 1 shows ✅ + "All web data imported"
  - Step 2 shows "Export Orders" button
```

### Step 3: Continue Workflow
```
Each step follows same pattern:
  - User action → Backend writes "processing"
  - Work happens → Backend writes "completed"
  - UI polls → Displays current status
```

## Advantages

### 1. Real-Time Updates
Jobs write status AS THEY HAPPEN, not after everything completes:
```
10:00:00 - Step 1: processing "Importing orders..."
10:00:15 - Step 1: processing "Processing products..."
10:00:30 - Step 1: completed "All imports done"
10:00:33 - UI updates (next poll)
```

### 2. Easy Debugging
Query the status table to see exact progression:
```sql
SELECT * FROM SysSyncStatus WHERE SessionID = 'XXX' ORDER BY Timestamp
```

### 3. No Race Conditions
- UI polling doesn't trigger work
- Status writes are independent
- Each step self-contained

### 4. Simple UI Logic
```javascript
if (step.status === 'completed') {
  showCheckmark();
} else if (step.status === 'processing') {
  showSpinner(step.message);
} else if (step.status === 'waiting') {
  showButton();
}
```

### 5. Backward Compatible
Keeps old SyncStateService for now, gradually migrate.

## Migration Plan

**Phase 1: Core Infrastructure** ✅
- Create SyncStatusService.js
- Update startDailySyncBackend() to write status
- Create new widget v2

**Phase 2: Test & Validate**
- Test with real sync workflow
- Verify status updates appear
- Check all steps work correctly

**Phase 3: Full Migration**
- Update all workflow functions to write status
- Add status writes to job completion handlers
- Replace old widget with v2
- Remove old state machine logic

## Files Created

- `jlmops/SyncStatusService.js` - Status tracking service
- `jlmops/AdminDailySyncWidget_v2.html` - Simplified widget UI
- `jlmops/SYNC_WIDGET_V2_DESIGN.md` - This document

## Files Modified

- `jlmops/WebAppSync.js` - Updated startDailySyncBackend() and getSyncStateFromBackend()
- `jlmops/OrchestratorService.js` - Added status writes when Step 1 completes

## Next Steps

1. **Test the new widget:**
   - Replace old widget include with v2
   - Run a sync and watch status updates
   - Verify each step shows correct status

2. **Add remaining status writes:**
   - Step 2: Export/Confirm actions
   - Step 3: Comax import
   - Step 4: Validation
   - Step 5: Web export/confirm

3. **Add Admin Tasks View:**
   - Create dedicated view for task queue management
   - Enable direct task handling (view, retry, cancel)
   - Show task details, logs, and execution history
   - Allow manual triggering of specific tasks
   - Provide task filtering and search capabilities
   - This gives admins direct control over the task system

4. **Polish UI:**
   - Add better error handling
   - Show job details in tooltips
   - Add progress indicators

5. **Remove old code:**
   - Deprecate complex state machine
   - Clean up unused logic
   - Simplify configuration

## Success Metrics

✅ Status updates within 3 seconds of job completion
✅ Each step updates independently
✅ Clear visibility into what's happening
✅ No race conditions or stuck states
✅ Easy to debug via status table query
