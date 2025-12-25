# Resource Optimization Plan

Improve system resilience, reliability, and speed through targeted optimizations.

---

## Phase 1: Timeout Prevention

### 1.1 Time Budget Pattern

Apply to any operation processing many rows to prevent GAS 6-minute timeout.

**Pattern:**
```javascript
const startTime = Date.now();
const TIME_BUDGET_MS = 4 * 60 * 1000; // 4 minutes, leave buffer

for (const item of items) {
  if (Date.now() - startTime > TIME_BUDGET_MS) {
    logger.info('Service', 'function', `Time budget reached, processed ${count}/${total}`);
    return { completed: false, processed: count, remaining: total - count };
  }
  // process item
  count++;
}
return { completed: true, processed: count };
```

**Apply to:**
- [ ] `ContactEnrichmentService.enrichAllContacts()` - processes all contacts
- [ ] `CrmIntelligenceService.runCrmIntelligence()` - analyzes contacts
- [ ] Any future batch processing operations

**Deliverable:** Functions return partial completion status; callers handle resumption.

---

## Phase 2: Conditional Execution

### 2.1 Skip-If-Unchanged Guards

Only run expensive operations when relevant data has changed.

**Bundle Health Check:**
```javascript
this.checkBundleHealth = function() {
  // Get bundle member SKUs
  const memberSkus = BundleService.getAllMemberSkus();

  // Check if any member inventory changed since last check
  const lastCheck = ConfigService.getConfig('system.bundle_health.last_check')?.value;
  const changedSkus = InventoryService.getSkusChangedSince(lastCheck);

  const relevantChanges = changedSkus.filter(sku => memberSkus.includes(sku));
  if (relevantChanges.length === 0) {
    logger.info('HousekeepingService', 'checkBundleHealth', 'No bundle member inventory changes, skipping');
    return;
  }

  // Run full check only for affected bundles
  BundleService.checkHealthForSkus(relevantChanges);
  ConfigService.setConfig('system.bundle_health.last_check', new Date().toISOString());
};
```

**CRM Intelligence:**
```javascript
this.runCrmIntelligence = function() {
  const lastRun = ConfigService.getConfig('system.crm_intelligence.last_run')?.value;
  const contactsModified = ContactService.getModifiedCountSince(lastRun);

  if (contactsModified === 0) {
    logger.info('HousekeepingService', 'runCrmIntelligence', 'No contact changes, skipping');
    return;
  }

  // Run analysis
  CrmIntelligenceService.runAnalysis();
  ConfigService.setConfig('system.crm_intelligence.last_run', new Date().toISOString());
};
```

**Apply to:**
- [ ] `checkBundleHealth()` - skip if no bundle member SKU inventory changed
- [ ] `runCrmIntelligence()` - skip if no contacts modified
- [ ] `refreshCrmContacts()` - skip if no new orders/subscriptions
- [ ] `checkBruryaReminder()` - already has date check, verify efficiency

---

## Phase 3: Batch Operation Audit

### 3.1 Identify N+1 Patterns

Audit services for loops containing `setValue`, `getValue`, `getRange` calls.

**Known fixed:**
- `InventoryManagementService.generateComaxInventoryExport()` - 40+ calls → 2 batch calls

**To audit:**
- [ ] `ContactEnrichmentService.js` - contact updates
- [ ] `OrderService.js` - order processing
- [ ] `ProductImportService.js` - product upserts
- [ ] `TaskService.js` - task creation/updates
- [ ] `ValidationLogic.js` - validation result writing

**Pattern to find:**
```javascript
// BAD
rows.forEach(row => {
  sheet.getRange(row, col).setValue(value);  // N calls
});

// GOOD
const updates = rows.map(row => [value]);
sheet.getRange(startRow, col, rows.length, 1).setValues(updates);  // 1 call
```

### 3.2 Read-Once Pattern

Cache sheet data at operation start, lookup from memory.

**Pattern:**
```javascript
// BAD: Read sheet multiple times
function processItems(items) {
  items.forEach(item => {
    const row = findRowBySku(sheet, item.sku);  // Sheet read each time
  });
}

// GOOD: Read once, lookup from map
function processItems(items) {
  const data = sheet.getDataRange().getValues();
  const skuMap = new Map(data.slice(1).map((row, idx) => [row[skuCol], idx + 2]));

  items.forEach(item => {
    const rowNum = skuMap.get(item.sku);  // Memory lookup
  });
}
```

**Apply to:**
- [ ] `ContactEnrichmentService` - contact lookups during enrichment
- [ ] `ProductService` - product lookups
- [ ] `OrderService` - order item lookups

---

## Phase 4: Error Resilience

### 4.1 Retry Logic for External Calls

**Pattern:**
```javascript
function withRetry(fn, maxRetries = 3, label = 'operation') {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (e) {
      logger.warn('RetryService', label, `Attempt ${attempt} failed: ${e.message}`);
      if (attempt === maxRetries) throw e;
      Utilities.sleep(1000 * attempt);  // Exponential backoff
    }
  }
}

// Usage
const file = withRetry(() => DriveApp.getFileById(fileId), 3, 'getFile');
```

**Apply to:**
- [ ] Google Drive file operations
- [ ] SpreadsheetApp.openById calls
- [ ] Any external API calls (future WooCommerce API)

### 4.2 Failed Job Alerting

Add to housekeeping: check for failed jobs and alert.

```javascript
this.checkFailedJobs = function() {
  const lastCheck = ConfigService.getConfig('system.failed_jobs.last_check')?.value;
  const failedJobs = JobService.getFailedJobsSince(lastCheck);

  if (failedJobs.length > 0) {
    const message = `⚠️ ${failedJobs.length} failed jobs since last check:\n` +
      failedJobs.map(j => `- ${j.jobType}: ${j.errorMessage}`).join('\n');

    LoggerService.sendChatAlert(message);
  }

  ConfigService.setConfig('system.failed_jobs.last_check', new Date().toISOString());
};
```

---

## Phase 5: Health Monitoring Expansion

### 5.1 Extended Health Metrics

Add to health task notes:
```javascript
{
  last_housekeeping: { ... },
  data_freshness: {
    cmx_prod_m_age_hours: 12,  // Hours since last Comax import
    web_prod_m_age_hours: 12,  // Hours since last Web import
    last_sync_completed: "2025-12-24T10:00:00Z"
  },
  queue_status: {
    pending_jobs: 0,
    failed_jobs: 2,
    oldest_pending_hours: 0
  }
}
```

### 5.2 Dashboard Warnings

Show warnings in system health widget for:
- [ ] Comax data > 24 hours old
- [ ] Failed jobs > 0
- [ ] Pending jobs > 10 (queue backup)
- [ ] Last sync > 24 hours ago

---

## Phase 6: UI Performance

### 6.1 Lazy Loading

Load critical widgets first, defer secondary.

```javascript
// In AdminDashboardView_v2.html
async function loadDashboard() {
  // Critical - load immediately
  const [orders, systemHealth] = await Promise.all([
    fetchOrders(),
    fetchSystemHealth()
  ]);
  renderOrdersWidget(orders);
  renderHealthWidget(systemHealth);

  // Secondary - load after render
  setTimeout(async () => {
    const [inventory, projects] = await Promise.all([
      fetchInventory(),
      fetchProjects()
    ]);
    renderInventoryWidget(inventory);
    renderProjectsWidget(projects);
  }, 100);
}
```

### 6.2 Reduce Payload Size

Return only fields needed by UI, not full records.

---

## Implementation Priority

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| 2.1 Conditional execution | Medium | High | 1 |
| 3.1 Batch operation audit | Medium | High | 2 |
| 1.1 Time budgets | Low | Medium | 3 |
| 4.2 Failed job alerting | Low | Medium | 4 |
| 4.1 Retry logic | Low | Medium | 5 |
| 5.1 Health metrics | Medium | Low | 6 |
| 6.1 Lazy loading | Medium | Low | 7 |

---

## Tracking

### Quick Wins Completed
- [x] ActivityBackfillService disabled (was causing timeouts)
- [x] Phase 3 failures now tracked and displayed
- [x] InventoryManagementService batch optimization
- [x] Permanent file protection in archiveFile() (Comax Products.csv)

### Phase 2.1 Completed (2025-12-24)
- [x] `checkBundleHealth()` - skip if no sync since last check
- [x] `refreshCrmContacts()` - skip if no sync since last refresh
- [x] `runCrmIntelligence()` - skip if no contact refresh since last run
- [x] `checkBruryaReminder()` - verified already efficient (config read + 1 task update)

Config keys added:
- `system.bundle_health.last_check` - tracks last bundle health run
- `system.crm.last_refresh` - tracks last CRM contact refresh
- `system.crm_intelligence.last_run` - tracks last intelligence analysis

### Next Steps
- [ ] Audit ContactEnrichmentService for batch opportunities
- [ ] Add failed job alerting to housekeeping
- [ ] Add time budgets to ContactEnrichmentService.enrichAllContacts()

---

Plan Version: 1.1
Created: 2025-12-24
Updated: 2025-12-24
