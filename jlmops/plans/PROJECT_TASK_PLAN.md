Project-Task Integration Plan

Executive Summary

This plan integrates the existing Projects and Tasks systems so that every task automatically routes to an appropriate project. The foundation
already exists - schemas have st_ProjectId, TaskService already reads topic from config. We're adding the routing logic and populating the data.

Scope:
- 4 system projects (Product Data Quality, Inventory Management, System Health, Order Fulfillment)
- Auto-routing for all 22 existing task types
- 7 new task types (sync session, category deficiency, 3 bundle types, packing availability, brurya update)
- Flow pattern metadata for UI guidance (admin_direct, manager_direct, manager_to_admin_review, manager_suggestion)

---
Part 1: Existing Infrastructure

1.1 SysTasks Schema (Already Exists)

File: config/schemas.json lines 183-195
st_TaskId, st_TaskTypeId, st_SessionId, st_ProjectId, st_Topic, st_Title,
st_Status, st_Priority, st_AssignedTo, st_LinkedEntityId, st_LinkedEntityName,
st_CreatedDate, st_StartDate, st_DueDate, st_DoneDate, st_Notes

Key columns for this work:
- st_ProjectId - EXISTS but never populated
- st_Topic - EXISTS, populated from taskTypeConfig.topic

1.2 SysProjects Schema (Already Exists)

File: config/schemas.json lines 198-210
spro_ProjectId, spro_Name, spro_Type, spro_Status, spro_StartDate, spro_EndDate

Project Types: OPERATIONAL, CAMPAIGN, ONE_OFF
Project Statuses: Planning, Active, Completed, Archived

1.3 TaskService.createTask() Current State

File: jlmops/TaskService.js lines 37-126

Current signature:
function createTask(taskTypeId, linkedEntityId, linkedEntityName, title, notes, sessionId = null, options = {})

What it already does:
- Line 39: Loads taskTypeConfig from ConfigService
- Line 93: Sets st_Topic from taskTypeConfig.topic
- Line 95: Sets st_Status from taskTypeConfig.initial_status
- Line 96: Sets st_Priority from taskTypeConfig.default_priority
- Lines 104-107: Supports options.projectId (but no caller uses it)

What needs to be added:
After line 93 (where topic is set), add auto-routing:
// Auto-route to project based on topic
if (!options.projectId) {
const routing = ConfigService.getConfig('task.routing.topic_to_project');
if (routing && routing[taskTypeConfig.topic]) {
options.projectId = routing[taskTypeConfig.topic];
}
}

1.4 taskDefinitions.json Current Structure

File: config/taskDefinitions.json

Current format (flat array):
[
"task.template",           // [0] marker
"task.validation.xxx",     // [1] task type ID
"Description text",        // [2] description
"stable",                  // [3] stability
"topic", "Products",       // [4-5] topic key-value
"default_priority", "High",// [6-7] priority key-value
"initial_status", "New"    // [8-9] status key-value
]

To add flow_pattern, append:
"flow_pattern", "admin_direct"  // [10-11] flow pattern key-value

---
Part 2: The Four System Projects

2.1 Project Definitions

| Project ID     | Name                 | Type        | Status | Purpose
|
|----------------|----------------------|-------------|--------|------------------------------------------------------------------------------------
--|
| PROJ-SYS_PRODUCT   | Product Data Quality | OPERATIONAL | Active | Product data issues, validation failures, onboarding, bundles, category
deficiencies |
| PROJ-SYS_INVENTORY | Inventory Management | OPERATIONAL | Active | Inventory counts, audits, stock-related validations, Brurya warehouse
|
| PROJ-SYS_SYSTEM    | System Health        | OPERATIONAL | Active | Sync sessions, exports, confirmations, system-level validations
|
| PROJ-SYS_ORDERS    | Order Fulfillment    | OPERATIONAL | Active | Packing slips, order completion, fulfillment workflow
|

2.2 Manual Creation Steps

1. Open Admin > Projects in the web app
2. Create each project with exact ProjectId shown above
3. Set Type = OPERATIONAL, Status = Active

---
Part 3: Topic-to-Project Routing

3.1 Config Entry to Add

File: config/system.json

Add these rows (following existing flat array pattern):
["task.routing.topic_to_project", "Topic-to-project routing for auto-assignment", "stable",
"Products", "PROJ-SYS_PRODUCT", "Inventory", "PROJ-SYS_INVENTORY", "System", "PROJ-SYS_SYSTEM",
"Orders", "PROJ-SYS_ORDERS", "WebXlt", "PROJ-SYS_PRODUCT", "", "", ""]

3.2 Routing Table

| Topic     | Project        | Rationale                                        |
|-----------|----------------|--------------------------------------------------|
| Products  | PROJ-SYS_PRODUCT   | Product identity, details, existence             |
| WebXlt    | PROJ-SYS_PRODUCT   | Translation/localization is product identity     |
| Inventory | PROJ-SYS_INVENTORY | Stock levels, counts, audits, Brurya warehouse   |
| Orders    | PROJ-SYS_ORDERS    | Order fulfillment, packing slips                 |
| System    | PROJ-SYS_SYSTEM    | System-level tasks, sync sessions, confirmations |

---
Part 4: Complete Task Type Mapping

4.1 All 22 Existing Task Types

Format: [task_type_id, current_topic, target_project, flow_pattern, current_priority]

Validation Tasks (13 types)

| Task Type                                     | Topic     | Project        | Flow Pattern            | Priority |
|-----------------------------------------------|-----------|----------------|-------------------------|----------|
| task.validation.vintage_mismatch              | Products  | PROJ-SYS_PRODUCT   | manager_to_admin_review | Normal   |
| task.validation.comax_internal_audit          | Inventory | PROJ-SYS_INVENTORY | manager_to_admin_review | Normal   |
| task.validation.webxlt_data_integrity         | WebXlt    | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.sku_not_in_comax              | Products  | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.translation_missing           | Products  | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.field_mismatch                | Products  | PROJ-SYS_PRODUCT   | admin_direct            | Normal   |
| task.validation.status_mismatch               | Products  | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.name_mismatch                 | Products  | PROJ-SYS_PRODUCT   | admin_direct            | Normal   |
| task.validation.web_master_discrepancy        | Products  | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.master_master_discrepancy     | System    | PROJ-SYS_SYSTEM    | admin_direct            | High     |
| task.validation.comax_master_discrepancy      | Products  | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.row_count_decrease            | Products  | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.comax_not_web_product         | Products  | PROJ-SYS_PRODUCT   | admin_direct            | High     |
| task.validation.order_staging_failure         | Orders    | PROJ-SYS_ORDERS    | admin_direct            | High     |
| task.validation.archived_comax_stock_mismatch | Inventory | PROJ-SYS_INVENTORY | admin_direct            | High     |

Export Tasks (2 types)

| Task Type                       | Topic  | Project     | Flow Pattern | Priority |
|---------------------------------|--------|-------------|--------------|----------|
| task.export.comax_orders_ready  | System | PROJ-SYS_SYSTEM | admin_direct | High     |
| task.export.web_inventory_ready | System | PROJ-SYS_SYSTEM | admin_direct | High     |

Confirmation Tasks (4 types)

| Task Type                                | Topic     | Project        | Flow Pattern | Priority |
|------------------------------------------|-----------|----------------|--------------|----------|
| task.confirmation.comax_order_export     | System    | PROJ-SYS_SYSTEM    | admin_direct | High     |
| task.confirmation.web_inventory_export   | System    | PROJ-SYS_SYSTEM    | admin_direct | High     |
| task.confirmation.product_count_export   | System    | PROJ-SYS_SYSTEM    | admin_direct | High     |
| task.confirmation.comax_inventory_export | Inventory | PROJ-SYS_INVENTORY | admin_direct | High     |

Onboarding Tasks (2 types)

| Task Type                   | Topic    | Project      | Flow Pattern            | Priority |
|-----------------------------|----------|--------------|-------------------------|----------|
| task.onboarding.suggestion  | Products | PROJ-SYS_PRODUCT | manager_suggestion      | Normal   |
| task.onboarding.add_product | Products | PROJ-SYS_PRODUCT | manager_to_admin_review | High     |

4.2 New Task Types (6 types)

Sync Session Task

["task.template", "task.sync.daily_session",
"Wraps an entire daily sync session for tracking and visibility.", "stable",
"topic", "System", "default_priority", "Normal", "initial_status", "New",
"flow_pattern", "admin_direct"]

Category Deficiency Task

["task.template", "task.deficiency.category_stock",
"Category is below minimum stock threshold.", "stable",
"topic", "Products", "default_priority", "Normal", "initial_status", "New",
"flow_pattern", "admin_direct"]

Bundle Review Task

["task.template", "task.bundle.monthly_review",
"Periodic bundle health check.", "stable",
"topic", "Products", "default_priority", "Normal", "initial_status", "New",
"flow_pattern", "admin_direct"]

Bundle Critical Inventory Task

["task.template", "task.bundle.critical_inventory",
"Bundle has member product with zero inventory.", "stable",
"topic", "Products", "default_priority", "Critical", "initial_status", "New",
"flow_pattern", "admin_direct", "due_pattern", "immediate"]

Bundle Low Inventory Task

["task.template", "task.bundle.low_inventory",
"Bundle has member product with low inventory.", "stable",
"topic", "Products", "default_priority", "Normal", "initial_status", "New",
"flow_pattern", "admin_direct", "due_pattern", "one_week"]

Packing Slips Available Task

["task.template", "task.order.packing_available",
"Orders are ready for packing slip generation.", "stable",
"topic", "Orders", "default_priority", "Normal", "initial_status", "New",
"flow_pattern", "manager_direct", "due_pattern", "immediate"]

Brurya Update Reminder Task

["task.template", "task.inventory.brurya_update",
"Reminder to update Brurya remote warehouse inventory.", "stable",
"topic", "Inventory", "default_priority", "Normal", "initial_status", "New",
"flow_pattern", "manager_direct", "due_pattern", "one_week"]

---
Part 5: Flow Patterns

5.1 Pattern Definitions

Pattern A: manager_to_admin_review
New  Assigned (manager)  Review (admin reviews)  Accepted (admin approves)  Done (admin confirms completion)
- Manager does initial work
- Admin reviews and approves
- Final confirmation after external action (export, web update, etc.)

Pattern B: admin_direct
New  Done (admin action or system auto-closes)
- System creates task
- Admin resolves directly OR system auto-closes when condition clears
- No manager involvement

Pattern C: manager_suggestion
New (manager creates)  Done (admin approves, may create follow-up task)
- Manager initiates
- Admin reviews and approves
- May spawn a new task (e.g., suggestion  add_product)

Pattern D: manager_direct
New  Assigned (manager)  Done (manager completes)
- System creates task assigned to Manager
- Manager resolves directly
- No admin involvement required

5.2 Tasks by Pattern

manager_to_admin_review (4 tasks):
- task.validation.vintage_mismatch
- task.validation.comax_internal_audit
- task.inventory.count (not in taskDefinitions - created by InventoryManagementService)
- task.onboarding.add_product

admin_direct (16 tasks):
- All export.* tasks
- All confirmation.* tasks
- All validation.* tasks except vintage_mismatch and comax_internal_audit
- task.sync.daily_session
- task.deficiency.category_stock
- task.bundle.monthly_review
- task.bundle.critical_inventory
- task.bundle.low_inventory

manager_direct (2 tasks):
- task.order.packing_available
- task.inventory.brurya_update

manager_suggestion (1 task):
- task.onboarding.suggestion

---
Part 6: Priority Levels

6.1 Priority Values

| Priority | Meaning                 | Visual  | Use Case                                   |
|----------|-------------------------|---------|--------------------------------------------|
| Critical | Blocks sync, immediate  | Red     | Quarantine conditions, bundle out of stock |
| High     | Attention before Normal | Orange  | Most validation failures                   |
| Normal   | Standard                | Default | Routine tasks                              |
| Low      | Can wait                | Gray    | Future use                                 |

6.2 Priority Sources

1. validation.json - on_failure_quarantine: TRUE implies Critical
2. validation.json - priority: HIGH explicit setting
3. taskDefinitions.json - default_priority per task type
4. Admin override - Manual edit in UI

---
Part 7: Task Dates & Assignment

7.1 Due Date Patterns

Tasks use named patterns for due date calculation:

| Pattern | Meaning | Business Day Logic |
|---------|---------|-------------------|
| `immediate` | Same day | N/A |
| `next_business_day` | Next Sun-Thu | Skip Fri/Sat |
| `one_week` | 7 calendar days | N/A |
| `two_weeks` | 14 calendar days | N/A |

Business days (Israel): Sun (0), Mon (1), Tue (2), Wed (3), Thu (4)
Weekend: Fri (5), Sat (6)

7.2 Date Field Rules

**Rule 1: Start Date on Creation**
- Only `immediate` due_pattern tasks get st_StartDate on creation
- User-created tasks may be created without start date

**Rule 2: Assignment Atomicity**
When a task is assigned, ALL THREE fields must be set together:
- st_StartDate = assignment time
- st_Status = 'Assigned'
- st_DueDate = calculated from due_pattern

**Invariant:** If any of these 3 fields has a value, all 3 must have values.

7.3 Task Type Due Patterns

| Category | due_pattern | Task Types |
|----------|-------------|------------|
| Immediate | immediate | task.export.*, task.confirmation.*, task.sync.daily_session, task.bundle.critical_inventory, task.order.packing_available |
| Next Business Day | next_business_day | task.validation.comax_internal_audit, task.validation.status_mismatch, task.validation.master_master_discrepancy, task.validation.row_count_decrease, task.validation.order_staging_failure |
| One Week | one_week | Most validation tasks, task.onboarding.*, task.deficiency.category_stock, task.inventory.brurya_update |
| Two Weeks | two_weeks | task.bundle.monthly_review |

---
Part 8: Implementation Phases

Phase 1: Foundation (Config + Data)

Step 1.1: Create Projects (Manual)
- Open Admin > Projects
- Create PROJ-SYS_PRODUCT, PROJ-SYS_INVENTORY, PROJ-SYS_SYSTEM, PROJ-SYS_ORDERS
- Set Type=OPERATIONAL, Status=Active for each

Step 1.2: Add Routing Config
File: config/system.json
- Add task.routing.topic_to_project entry (see Part 3.1)

Step 1.3: Update taskDefinitions.json
File: config/taskDefinitions.json
- Add "flow_pattern", "xxx" to each existing task type
- Add 6 new task type entries (see Part 4.2)

Step 1.4: Update TaskService.js
File: jlmops/TaskService.js
- Add auto-routing logic after line 93 (see Part 1.3)

Step 1.5: Manually Assign Existing Tasks
- Edit SysTasks sheet directly
- Set st_ProjectId for important open tasks

Verification:
- Run sync or trigger validation
- Check new tasks have st_ProjectId populated
- Check project view shows task counts

Phase 2: Sync Session Task

Step 2.1: Add task type (done in Phase 1.3)

Step 2.2: Create session task at sync start
File: jlmops/WebAppSync.js
Location: In startDailySyncBackend(), after line 47 (after const newSessionId = ...), add:

// Create sync session task for tracking
TaskService.createTask(
'task.sync.daily_session',
newSessionId,                    // linkedEntityId = sessionId
`Sync ${new Date().toISOString().split('T')[0]}`,  // linkedEntityName
`Daily Sync - ${new Date().toLocaleDateString()}`, // title
'Sync session initiated',        // notes
newSessionId                     // sessionId
);

Step 2.3: Complete session task on sync completion
File: jlmops/WebAppSync.js
Location: In confirmWebInventoryUpdateBackend(), after line 524 (after setting currentStage = 'COMPLETE'), add:

// Complete the sync session task
const taskSheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next()).getSheetByName('SysTasks');
if (taskSheet && taskSheet.getLastRow() > 1) {
const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
const headers = taskSchema.headers.split(',');
const typeCol = headers.indexOf('st_TaskTypeId');
const entityCol = headers.indexOf('st_LinkedEntityId');
const statusCol = headers.indexOf('st_Status');
const taskIdCol = headers.indexOf('st_TaskId');

const data = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, headers.length).getValues();
for (let i = 0; i < data.length; i++) {
if (data[i][typeCol] === 'task.sync.daily_session' &&
data[i][entityCol] === sessionId &&
data[i][statusCol] !== 'Done' && data[i][statusCol] !== 'Closed') {
TaskService.completeTask(data[i][taskIdCol]);
break;
}
}
}

Step 2.4: Handle no-export completion path
File: jlmops/WebAppSync.js
Location: In exportComaxOrdersBackend(), in the if (exportedCount === 0) block around line 313, the sync can complete without Step 5. Add sync task
completion there too if the workflow ends early.

Alternative (cleaner): Create a helper function completeSyncSessionTask(sessionId) in WebAppSync.js and call it from both completion paths.

Phase 3: Category Deficiency Tasks

Step 3.1: Add task type (done in Phase 1.3)

Step 3.2: Create tasks when category is Low
File: jlmops/WebAppProducts.js
Location: In WebAppProducts_getManagerWidgetData(), after line 511 (inside the if (status === 'Low') block), add:

// Create deficiency task if none exists (de-duplication handled by TaskService)
TaskService.createTask(
'task.deficiency.category_stock',
rule.category,                           // linkedEntityId = category name
rule.category,                           // linkedEntityName
`Low stock: ${rule.category}`,           // title
`Category "${rule.category}" has ${currentCount} products in stock (minimum: ${rule.min}).`, // notes
null                                     // no sessionId
);

Current code context (lines 509-512):
if (status === 'Low') {
result.deficientCategoriesCount++;
result.deficientCategories.push(catData);
}

After change:
if (status === 'Low') {
result.deficientCategoriesCount++;
result.deficientCategories.push(catData);

// Create deficiency task if none exists (de-duplication handled by TaskService)
TaskService.createTask(
'task.deficiency.category_stock',
rule.category,                           // linkedEntityId = category name
rule.category,                           // linkedEntityName
`Low stock: ${rule.category}`,           // title
`Category "${rule.category}" has ${currentCount} products in stock (minimum: ${rule.min}).`, // notes
null                                     // no sessionId
);
}

Step 3.3: Review action
User workflow:
1. Task appears in Product Data Quality project
2. Task notes show: category name, current count, minimum required
3. User clicks task  sees info
4. User either:
- Closes task manually (they've addressed it)
- Navigates to inventory to investigate

No additional code needed - existing task UI allows manual close. The getManagerWidgetData function already provides category health info for the
user to see.

Phase 4: Bundle Tasks

Step 4.1: Add task types (done in Phase 1.3)

Step 4.2: Add bundle maintenance function to BundleService
File: jlmops/BundleService.js
Location: Add new function before the return { ... } block (around line 1175):

/**
* Checks all active bundles for out-of-stock members and creates tasks.
* Called by HousekeepingService during nightly maintenance.
* @returns {Object} { bundlesChecked, tasksCreated, outOfStockBundles: [] }
*/
function checkBundleInventoryHealth() {
const functionName = 'checkBundleInventoryHealth';
const bundles = _loadBundles().filter(b => b.status === 'Active');
const allSlots = _loadSlots();

// Build stock map from WebProdM
const allConfig = ConfigService.getAllConfig();
const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
const webSheet = spreadsheet.getSheetByName('WebProdM');

const stockMap = {};
const nameMap = {};
if (webSheet) {
const webData = webSheet.getDataRange().getValues();
const webSchema = allConfig['schema.data.WebProdM'];
const webHeaders = webSchema.headers.split(',');
const skuIdx = webHeaders.indexOf('wpm_SKU');
const stockIdx = webHeaders.indexOf('wpm_Stock');
const nameIdx = webHeaders.indexOf('wpm_PostTitle');

for (let i = 1; i < webData.length; i++) {
const sku = String(webData[i][skuIdx] || '');
if (sku) {
stockMap[sku] = Number(webData[i][stockIdx]) || 0;
nameMap[sku] = webData[i][nameIdx] || '';
}
}
}

let tasksCreated = 0;
const outOfStockBundles = [];

for (const bundle of bundles) {
const bundleSlots = allSlots.filter(s => s.bundleId === bundle.bundleId && s.slotType === 'Product');
const outOfStockMembers = [];

for (const slot of bundleSlots) {
if (!slot.activeSKU) continue;
const stock = stockMap[slot.activeSKU];
if (stock === 0) {
outOfStockMembers.push({
sku: slot.activeSKU,
name: nameMap[slot.activeSKU] || 'Unknown'
});
}
}

if (outOfStockMembers.length > 0) {
outOfStockBundles.push({
bundleId: bundle.bundleId,
bundleName: bundle.nameEn,
outOfStockMembers: outOfStockMembers
});

// Create critical inventory task
const memberList = outOfStockMembers.map(m => `${m.sku} (${m.name})`).join(', ');
const result = TaskService.createTask(
'task.bundle.critical_inventory',
bundle.bundleId,                              // linkedEntityId
bundle.nameEn || bundle.bundleId,             // linkedEntityName
`Bundle out of stock: ${bundle.nameEn || bundle.bundleId}`, // title
`Bundle has ${outOfStockMembers.length} member(s) with zero stock: ${memberList}`, // notes
null                                          // no sessionId
);

if (result) tasksCreated++;
}
}

LoggerService.info(SERVICE_NAME, functionName,
`Bundle health check: ${bundles.length} bundles checked, ${outOfStockBundles.length} with issues, ${tasksCreated} tasks created`);

return {
bundlesChecked: bundles.length,
tasksCreated: tasksCreated,
outOfStockBundles: outOfStockBundles
};
}

Step 4.3: Export the new function
File: jlmops/BundleService.js
Location: In the return { ... } block (around line 1176), add:

// Health Check (for nightly maintenance)
checkBundleInventoryHealth: checkBundleInventoryHealth,

Step 4.4: Add bundle check to nightly maintenance
File: jlmops/HousekeepingService.js
Location: In performDailyMaintenance() function (line 212-218), add call:

Current code:
this.performDailyMaintenance = function() {
logger.info('HousekeepingService', 'performDailyMaintenance', "Starting daily maintenance tasks.");
this.cleanOldLogs();
this.archiveCompletedTasks();
this.manageFileLifecycle();
this.cleanupImportFiles();
logger.info('HousekeepingService', 'performDailyMaintenance', "Daily maintenance tasks completed.");
};

After change:
this.performDailyMaintenance = function() {
logger.info('HousekeepingService', 'performDailyMaintenance', "Starting daily maintenance tasks.");
this.cleanOldLogs();
this.archiveCompletedTasks();
this.manageFileLifecycle();
this.cleanupImportFiles();

// Bundle inventory health check
try {
const bundleResult = BundleService.checkBundleInventoryHealth();
logger.info('HousekeepingService', 'performDailyMaintenance',
`Bundle health: ${bundleResult.bundlesChecked} checked, ${bundleResult.tasksCreated} tasks created`);
} catch (e) {
logger.warn('HousekeepingService', 'performDailyMaintenance', `Bundle health check failed: ${e.message}`);
}

logger.info('HousekeepingService', 'performDailyMaintenance', "Daily maintenance tasks completed.");
};

Step 4.5: Monthly review trigger (manual)
For task.bundle.monthly_review, create a simple function that can be called manually or scheduled:

File: jlmops/BundleService.js
Location: Add alongside checkBundleInventoryHealth:

/**
* Creates a monthly bundle review task.
* @returns {Object|null} Created task or null if one already exists
*/
function createMonthlyReviewTask() {
const functionName = 'createMonthlyReviewTask';
const monthYear = new Date().toISOString().substring(0, 7); // "2025-12"

const result = TaskService.createTask(
'task.bundle.monthly_review',
monthYear,                                      // linkedEntityId = month
`Bundle Review ${monthYear}`,                   // linkedEntityName
`Monthly Bundle Review - ${monthYear}`,         // title
'Review all active bundles for content freshness, pricing, and inventory health.', // notes
null
);

if (result) {
LoggerService.info(SERVICE_NAME, functionName, `Created monthly review task for ${monthYear}`);
}
return result;
}

And export it:
createMonthlyReviewTask: createMonthlyReviewTask,

Step 4.6: (Optional) Schedule monthly review
Add to a monthly trigger or call BundleService.createMonthlyReviewTask() manually at the start of each month.

Phase 5: Dashboard Consolidation

Goal: Replace complex multi-source widget lookups with simple task counts from SysTasks. Dashboards become fast and consistent.

---
5.1 Current Widget Data Sources (Complex)

AdminProductsWidget / ManagerProductsWidget displays:
| Metric                          | Current Source                                                   | Complex          |
|---------------------------------|------------------------------------------------------------------|-------------------|
| Detail Updates - Edits Pending  | Task count: task.validation.vintage_mismatch status=New/Assigned | Task lookup       |
| Detail Updates - Review Pending | Task count: task.validation.vintage_mismatch status=Review       | Task lookup       |
| New Products - Suggestions      | Task count: task.onboarding.suggestion                           | Task lookup       |
| New Products - Edits            | Task count: task.onboarding.add_product status=New               | Task lookup       |
| Deficient Categories            | Calculated from CmxProdM stock vs MinCat rules                   | Heavy calculation |
| Other Validations               | Task count: all other validation types                           | Task lookup       |

AdminInventoryWidget / ManagerInventoryWidget displays:
| Metric                  | Current Source                                                 | Complex    |
|-------------------------|----------------------------------------------------------------|-------------|
| Brurya Products         | Count rows in SysProductAudit where pa_BruryaQty > 0           | Sheet scan  |
| Brurya Total Stock      | Sum pa_BruryaQty from SysProductAudit                          | Sheet scan  |
| Negative Inventory      | Task count: task.validation.comax_internal_audit               | Task lookup |
| Inventory Count         | Task count: task.inventory.count                               | Task lookup |
| Inventory Count Reviews | Task count: task.validation.comax_internal_audit status=Review | Task lookup |

---
5.2 Target: Everything is a Task Count

Principle: If it's important enough to show on the dashboard, it should be a task.

Products Widget - After:
| Metric                     | Source                                                                        |
|----------------------------|-------------------------------------------------------------------------------|
| Detail Updates - Edits     | Count tasks: type=task.validation.vintage_mismatch, status in (New, Assigned) |
| Detail Updates - Review    | Count tasks: type=task.validation.vintage_mismatch, status=Review             |
| New Products - Suggestions | Count tasks: type=task.onboarding.suggestion                                  |
| New Products - Edits       | Count tasks: type=task.onboarding.add_product, status=New                     |
| Category Deficiencies      | Count tasks: type=task.deficiency.category_stock                              |
| Other Validations          | Count tasks: topic=Products, type NOT IN (above types)                        |

Inventory Widget - After:
| Metric             | Source                                                 |
|--------------------|--------------------------------------------------------|
| Negative Inventory | Count tasks: type=task.validation.comax_internal_audit |
| Inventory Count    | Count tasks: type=task.inventory.count                 |
| Inventory Reviews  | Count tasks: status=Review, project=PROJ-SYS_INVENTORY     |
| Brurya Status      | Single task (see below)                                |

---
5.3 Brurya Reminder Task

Current: Dashboard shows "Brurya Products: X, Brurya Total Stock: Y" by scanning SysProductAudit sheet every load.

Problem: Expensive lookup. Also, no mechanism to remind manager to update remote warehouse inventory.

New approach: Reminder task that triggers when Brurya hasn't been updated in 7 days.

task.inventory.brurya_update
- topic: Inventory
- default_priority: Normal
- initial_status: New
- flow_pattern: admin_direct

How it works:
1. Nightly maintenance checks last Brurya update date
2. If > 7 days since last update, creates reminder task (if none open)
3. Task appears in manager's Inventory widget
4. Manager goes to Inventory > Brurya Management card
5. Manager either:
- Edits counts  task closes
- Confirms "no change"  task closes
6. Last update date is recorded

Add to taskDefinitions.json:
[
"task.template",
"task.inventory.brurya_update",
"Reminder to update Brurya remote warehouse inventory.",
"stable",
"topic", "Inventory",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
]

Add to HousekeepingService.performDailyMaintenance():
// Check if Brurya update reminder needed
try {
const allConfig = ConfigService.getAllConfig();
const lastBruryaUpdate = allConfig['system.brurya.last_update'];
const daysSinceUpdate = lastBruryaUpdate
Math.floor((Date.now() - new Date(lastBruryaUpdate.value).getTime()) / (1000 * 60 * 60 * 24))
: 999; // Never updated

if (daysSinceUpdate >= 7) {
// Check if reminder task already exists
const existingTask = WebAppTasks.getOpenTaskByTypeId('task.inventory.brurya_update');
if (!existingTask) {
TaskService.createTask(
'task.inventory.brurya_update',
'BRURYA',
'Brurya Warehouse',
'Update Brurya Inventory',
`Last updated ${daysSinceUpdate} days ago. Please verify or update inventory counts.`,
null
);
logger.info('HousekeepingService', 'performDailyMaintenance', `Brurya reminder created (${daysSinceUpdate} days since last update)`);
}
}
} catch (e) {
logger.warn('HousekeepingService', 'performDailyMaintenance', `Brurya reminder check failed: ${e.message}`);
}

Manager Inventory View - Brurya Card changes:
When manager updates Brurya counts OR confirms no change:
1. Update system.brurya.last_update config to current timestamp
2. Close any open task.inventory.brurya_update task

Dashboard display:
- Brurya counts still displayed (from SysProductAudit - can optimize later if needed)
- If reminder task exists, show indicator "Update needed"

---
5.4 Single Dashboard Query

New function: WebAppProjects_getDashboardData(role)

File: jlmops/WebAppProjects.js

/**
* Gets all dashboard data in a single query by counting tasks.
* @param {string} role - 'admin' or 'manager'
* @returns {Object} Dashboard data organized by project
*/
function WebAppProjects_getDashboardData(role) {
const functionName = 'getDashboardData';
try {
// Single read of SysTasks
const allConfig = ConfigService.getAllConfig();
const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
const taskSheet = spreadsheet.getSheetByName('SysTasks');

if (!taskSheet || taskSheet.getLastRow() <= 1) {
return { projects: [], summary: { total: 0, critical: 0 } };
}

const taskSchema = allConfig['schema.data.SysTasks'];
const headers = taskSchema.headers.split(',');
const data = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, headers.length).getValues();

// Column indices
const cols = {
projectId: headers.indexOf('st_ProjectId'),
taskType: headers.indexOf('st_TaskTypeId'),
status: headers.indexOf('st_Status'),
priority: headers.indexOf('st_Priority'),
topic: headers.indexOf('st_Topic'),
title: headers.indexOf('st_Title'),
notes: headers.indexOf('st_Notes')
};

// Initialize project summaries
const projects = {
'PROJ-SYS_PRODUCT': { id: 'PROJ-SYS_PRODUCT', name: 'Product Data Quality', counts: {}, tasks: [] },
'PROJ-SYS_INVENTORY': { id: 'PROJ-SYS_INVENTORY', name: 'Inventory Management', counts: {}, tasks: [] },
'PROJ-SYS_SYSTEM': { id: 'PROJ-SYS_SYSTEM', name: 'System Health', counts: {}, tasks: [] },
'PROJ-SYS_ORDERS': { id: 'PROJ-SYS_ORDERS', name: 'Order Fulfillment', counts: {}, tasks: [] }
};

let totalOpen = 0;
let criticalCount = 0;

// Count tasks by project and type
data.forEach(row => {
const status = String(row[cols.status] || '').trim();
if (status === 'Done' || status === 'Closed') return; // Skip completed

const projectId = String(row[cols.projectId] || '').trim();
const taskType = String(row[cols.taskType] || '').trim();
const priority = String(row[cols.priority] || '').trim();

if (!projects[projectId]) return; // Unknown project

totalOpen++;
if (priority === 'Critical') criticalCount++;

// Count by task type within project
projects[projectId].counts[taskType] = (projects[projectId].counts[taskType] || 0) + 1;

// Track recent/important tasks for display
if (projects[projectId].tasks.length < 5) {
projects[projectId].tasks.push({
type: taskType,
title: row[cols.title],
status: status,
priority: priority,
notes: row[cols.notes]
});
}
});

return {
projects: Object.values(projects),
summary: {
total: totalOpen,
critical: criticalCount
}
};
} catch (e) {
LoggerService.error('WebAppProjects', functionName, e.message, e);
return { error: e.message };
}
}

---
5.5 Widget Changes

AdminProductsWidget.html - After:
<script>
function updateProductsWidget(dashboardData) {
const project = dashboardData.projects.find(p => p.id === 'PROJ-SYS_PRODUCT');
if (!project) return;

const counts = project.counts;

// Detail Updates (vintage_mismatch tasks)
const editsPending = counts['task.validation.vintage_mismatch'] || 0;

// New Products
const suggestions = counts['task.onboarding.suggestion'] || 0;
const newEdits = counts['task.onboarding.add_product'] || 0;

// Deficiencies (now a task!)
const deficiencies = counts['task.deficiency.category_stock'] || 0;

// Render...
}
</script>

AdminInventoryWidget.html - After:
<script>
function updateInventoryWidget(dashboardData) {
const project = dashboardData.projects.find(p => p.id === 'PROJ-SYS_INVENTORY');
if (!project) return;

const counts = project.counts;

// Task counts
const negativeInventory = counts['task.validation.comax_internal_audit'] || 0;
const inventoryCounts = counts['task.inventory.count'] || 0;

// Brurya - from task notes
const bruryaTask = project.tasks.find(t => t.type === 'task.inventory.brurya_status');
const bruryaNotes = bruryaTask  bruryaTask.notes : 'No data';

// Render...
}
</script>

---
5.6 Performance Comparison

Before (per dashboard load):
- AdminDashboardView: 4 widget HTML loads + 4 backend calls
- Each backend call reads multiple sheets (SysTasks, CmxProdM, SysProductAudit, etc.)
- Category deficiency: scans entire CmxProdM for stock calculations
- Brurya: scans entire SysProductAudit

After (per dashboard load):
- AdminDashboardView: 1 backend call
- Single read of SysTasks sheet
- All counts from in-memory array iteration
- No expensive calculations (done in nightly maintenance)

Estimated speedup: 3-5x faster dashboard load

---
5.7 Implementation Steps

Step 5.1: Add Brurya status task type
- Add to taskDefinitions.json (see 5.3)

Step 5.2: Update nightly maintenance
- Add Brurya status update to HousekeepingService (see 5.3)

Step 5.3: Create aggregation function
- Add WebAppProjects_getDashboardData() to WebAppProjects.js (see 5.4)

Step 5.4: Update AdminDashboardView.html
- Replace multiple widget loads with single data call
- Update distributeDataWhenReady() to use new data structure

Step 5.5: Update widget HTML files
- Simplify to just rendering (no individual data fetches)
- Accept data from parent dashboard

Step 5.6: Update ManagerDashboardView.html
- Same pattern as admin

Step 5.7: Deprecate old functions
- Mark WebAppProducts_getManagerWidgetData() etc. as deprecated
- Remove after confirming new approach works

---
5.8 Verification

- Brurya status task created by nightly maintenance
- Dashboard loads with single backend call
- All widget counts match old values
- Dashboard load time decreased
- Category deficiency count comes from tasks (not calculated)

---
Phase 6: Packing Slip Tasks (Order Fulfillment)

Goal: Create a task-based notification system for packing slips, feeding the PROJ-SYS_ORDERS dashboard widget.

---
6.1 Current Packing Slip Workflow

Files involved:
- jlmops/ManagerOrdersView.html - UI for selecting/printing packing slips
- jlmops/WebAppOrders.js - WebAppOrders_getPackableOrders(), WebAppOrders_generatePackingSlips()
- jlmops/PrintService.js - printPackingSlips() generates docs and marks orders as "Printed"
- jlmops/ManagerOrdersWidget.html - Displays "Packing Slips Ready: X" count
- jlmops/AdminOrdersWidget.html - Same count display

Current flow:
1. Orders import from WooCommerce (status: on-hold, processing)
2. WebAppOrders_getPackableOrders() queries SysOrdLog for unprinted orders
3. Widget shows count: "Packing Slips Ready: N"
4. Manager selects orders in ManagerOrdersView, clicks "Print Selected"
5. PrintService.printPackingSlips() generates document, marks sol_PackingStatus = "Printed"
6. Widget count decreases

What the dashboard displays:
- On-Hold Orders count
- Processing Orders count
- Packing Slips Ready count (unprinted orders)
- Comax Orders to Export count (admin only)

---
6.2 Task-Based Approach

Option A: Single availability task (simpler)
- One task exists when there are orders ready for packing
- Task notes: "X orders ready for packing"
- Task closes when count drops to 0

Option B: Per-order tasks (granular)
- One task per order that needs packing
- Task closes when order is printed
- More overhead, better tracking

Recommendation: Option A - single task for availability notification.

---
6.3 Implementation Steps

Step 6.1: Task type already defined (in Phase 1.3)

["task.template", "task.order.packing_available",
"Orders are ready for packing slip generation.", "stable",
"topic", "Orders", "default_priority", "Normal", "initial_status", "New",
"flow_pattern", "admin_direct"]

Step 6.2: Create/update task when packable orders change

File: jlmops/WebAppOrders.js
New function: Add alongside existing functions

/**
* Updates the packing availability task based on current unprinted order count.
* Called after order imports and after printing packing slips.
*/
function _updatePackingAvailabilityTask() {
const functionName = '_updatePackingAvailabilityTask';
try {
// Get current count of packable orders
const packableOrders = WebAppOrders_getPackableOrders();
const count = packableOrders.length;

const allConfig = ConfigService.getAllConfig();
const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
const taskSheet = spreadsheet.getSheetByName('SysTasks');

if (!taskSheet) return;

// Find existing packing task
const taskSchema = allConfig['schema.data.SysTasks'];
const headers = taskSchema.headers.split(',');
const typeCol = headers.indexOf('st_TaskTypeId');
const statusCol = headers.indexOf('st_Status');
const taskIdCol = headers.indexOf('st_TaskId');
const notesCol = headers.indexOf('st_Notes');

let existingTaskRow = null;
let existingTaskId = null;

if (taskSheet.getLastRow() > 1) {
const data = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, headers.length).getValues();
for (let i = 0; i < data.length; i++) {
if (data[i][typeCol] === 'task.order.packing_available' &&
data[i][statusCol] !== 'Done' && data[i][statusCol] !== 'Closed') {
existingTaskRow = i + 2; // 1-indexed, plus header
existingTaskId = data[i][taskIdCol];
break;
}
}
}

if (count > 0) {
if (existingTaskId) {
// Update existing task notes with new count
taskSheet.getRange(existingTaskRow, notesCol + 1).setValue(`${count} order(s) ready for packing slip generation.`);
} else {
// Create new task
TaskService.createTask(
'task.order.packing_available',
'PACKING',                               // linkedEntityId
'Packing Slips',                         // linkedEntityName
`${count} order(s) ready for packing`,   // title
`${count} order(s) ready for packing slip generation.`, // notes
null                                     // no sessionId
);
}
} else {
// No orders to pack - close existing task
if (existingTaskId) {
TaskService.completeTask(existingTaskId);
}
}
} catch (e) {
LoggerService.warn('WebAppOrders', functionName, `Packing task update failed: ${e.message}`);
}
}

Step 6.3: Call after order import

File: jlmops/WebAppOrders.js
Location: At end of WebAppOrders_triggerWebOrderImport(), add:

// Update packing availability task
_updatePackingAvailabilityTask();

Step 6.4: Call after printing packing slips

File: jlmops/WebAppOrders.js
Location: At end of WebAppOrders_generatePackingSlips(), add:

// Update packing availability task after printing
_updatePackingAvailabilityTask();

Step 6.5: (Optional) Call from nightly maintenance

Add to HousekeepingService.performDailyMaintenance():

// Update packing availability task
try {
WebAppOrders._updatePackingAvailabilityTask();
} catch (e) {
logger.warn('HousekeepingService', 'performDailyMaintenance', `Packing task update failed: ${e.message}`);
}

Note: This requires exporting the function from WebAppOrders. Alternatively, create it as a standalone function.

---
6.4 Dashboard Integration

Orders Widget - After:
| Metric                 | Source                                                         |
|------------------------|----------------------------------------------------------------|
| On-Hold Orders         | Count from SysOrdLog (existing)                                |
| Processing Orders      | Count from SysOrdLog (existing)                                |
| Packing Slips Ready    | Task count: task.order.packing_available (or task notes value) |
| Comax Orders to Export | Task count: task.export.comax_orders_ready                     |

The widget can either:
- Display task existence as indicator
- Parse task notes for count (e.g., "5 orders ready")
- Continue using existing SysOrdLog count query (keeps working)

Simplest integration: Keep existing count query in widget, task is for project-level visibility only.

---
6.5 Verification

- After importing orders, task.order.packing_available created/updated
- Task notes show current count of packable orders
- After printing all orders, task is completed (closed)
- Task appears in PROJ-SYS_ORDERS project
- Orders widget still shows correct counts

---
Part 9: Task Creation Points

9.1 Existing Creation Points (11 locations)

| File                             | Line | Task Type                           | After Phase 1                 |
|----------------------------------|------|-------------------------------------|-------------------------------|
| InventoryManagementService.js    | 1034 | confirmation.comax_inventory_export | Auto-routes to PROJ-SYS_INVENTORY |
| InventoryManagementService.js    | 1245 | inventory.count                     | Auto-routes to PROJ-SYS_INVENTORY |
| InventoryManagementService.js    | 1303 | inventory.count                     | Auto-routes to PROJ-SYS_INVENTORY |
| OrchestratorService.js           | 721  | export.comax_orders_ready           | Auto-routes to PROJ-SYS_SYSTEM    |
| OrchestratorService.js           | 788  | export.web_inventory_ready          | Auto-routes to PROJ-SYS_SYSTEM    |
| OrderService.js                  | 448  | confirmation.comax_order_export     | Auto-routes to PROJ-SYS_SYSTEM    |
| ProductImportService.js          | 1282 | confirmation.web_inventory_export   | Auto-routes to PROJ-SYS_SYSTEM    |
| ProductService.js                | 1018 | confirmation.web_inventory_export   | Auto-routes to PROJ-SYS_SYSTEM    |
| ProductService.js                | 1847 | onboarding.add_product              | Auto-routes to PROJ-SYS_PRODUCT   |
| ValidationOrchestratorService.js | 138  | validation.* (system-level)         | Auto-routes based on topic    |
| ValidationOrchestratorService.js | 163  | validation.* (entity-level)         | Auto-routes based on topic    |
| WebAppProducts.js                | 875  | onboarding.suggestion               | Auto-routes to PROJ-SYS_PRODUCT   |

9.2 New Creation Points (Phase 2-6)

| Phase | File                               | Task Type                      |
|-------|------------------------------------|--------------------------------|
| 2     | WebAppSync.js                      | task.sync.daily_session        |
| 3     | WebAppProducts.js                  | task.deficiency.category_stock |
| 4     | BundleService.js                   | task.bundle.critical_inventory |
| 4     | Manual/Scheduled                   | task.bundle.monthly_review     |
| 5     | HousekeepingService.js             | task.inventory.brurya_update   |
| 6     | WebAppOrders.js or OrderService.js | task.order.packing_available   |

---
Part 10: Status Update Points

10.1 Files That Update Task Status

| File               | Functions                                                                                           | Task Types
|
|--------------------|-----------------------------------------------------------------------------------------------------|------------------------
----------------------|
| TaskService.js     | updateTaskStatus(), completeTask()                                                                  | All
|
| WebAppTasks.js     | completeTaskById()                                                                                  | All
|
| WebAppInventory.js | submitInventoryCounts (Review), acceptCount (Accepted)                                            | inventory.*,
validation.comax_internal_audit |
| WebAppProducts.js  | handleAdminAccept (Accepted), handleAdminConfirmWebUpdate (Done)                                  |
validation.vintage_mismatch                  |
| ProductService.js  | submitProductDetails (Review), acceptProductDetails (Accepted), linkAndFinalizeNewProduct (Done) | onboarding.*
|
| OrderService.js    | exportToComax - auto-closes export.comax_orders_ready                                               | export.*
|
| ProductService.js  | exportWebInventory - auto-closes export.web_inventory_ready                                         | export.*
|

---
Part 11: Verification Checklist

After Phase 1

- 4 projects exist in SysProjects sheet (PROJ-SYS_PRODUCT, PROJ-SYS_INVENTORY, PROJ-SYS_SYSTEM, PROJ-SYS_ORDERS)
- taskDefinitions.json updated with all 28 task types (22 existing + 6 new)
- system.json contains task.routing.topic_to_project entry
- TaskService.js has auto-routing code after line 93
- clasp push succeeds without errors
- Trigger a validation or sync  check new tasks have st_ProjectId populated
- Check SysTasks sheet  st_Topic column should be populated
- Open Admin > Projects  verify task counts match SysTasks

After Phase 2

- Start a sync via Daily Sync widget
- Check SysTasks  task.sync.daily_session exists with current sessionId
- Complete the sync (through Step 5 confirmation)
- Check task status changed to "Done"
- Verify session task appears in PROJ-SYS_SYSTEM project

After Phase 3

- Open Manager widget (or run WebAppProducts_getManagerWidgetData)
- If a category is Low, check SysTasks for task.deficiency.category_stock
- Verify task notes contain: category name, current count, minimum
- Trigger the check again  verify no duplicate task created
- Task appears in PROJ-SYS_PRODUCT project

After Phase 4

- Manually run runDailyMaintenance() or trigger nightly job
- If any active bundle has 0-stock member  check for task.bundle.critical_inventory
- Verify task notes list the out-of-stock SKU(s) and names
- Call BundleService.createMonthlyReviewTask()  verify task created
- Bundle tasks appear in PROJ-SYS_PRODUCT project

After Phase 5 (Dashboard Consolidation)

- Brurya reminder task created when > 7 days since last update
- Dashboard loads with single backend call
- All widget counts match previous values
- Category deficiency count comes from tasks (not calculated)

After Phase 6 (Packing Slips)

- Import web orders  task.order.packing_available created/updated
- Task notes show current count of packable orders
- Print all packing slips  task is completed (closed)
- Task appears in PROJ-SYS_ORDERS project
- Orders widget still shows correct counts

---
Appendix A: File Paths

| File                                    | Purpose                                                    |
|-----------------------------------------|------------------------------------------------------------|
| jlmops/TaskService.js                   | Task CRUD operations - add routing logic                   |
| jlmops/config/taskDefinitions.json      | Task type definitions - add flow_pattern, 6 new task types |
| jlmops/config/system.json               | System config - add routing table                          |
| jlmops/config/schemas.json              | Schema definitions (reference only)                        |
| jlmops/ProjectService.js                | Project CRUD operations (exists)                           |
| jlmops/WebAppProducts.js                | Products widget - add deficiency task creation             |
| jlmops/BundleService.js                 | Bundle operations - add critical inventory detection       |
| jlmops/WebAppSync.js                    | Sync workflow - add session task                           |
| jlmops/WebAppOrders.js                  | Order operations - add packing availability task           |
| jlmops/HousekeepingService.js           | Nightly maintenance - add Brurya reminder, bundle check    |
| jlmops/OrchestratorService.js           | Import orchestration (reference)                           |
| jlmops/ValidationOrchestratorService.js | Validation task creation (reference)                       |
| jlmops/PrintService.js                  | Packing slip generation (reference)                        |

Appendix B: Complete Config Files

B.1 Complete taskDefinitions.json (Replace Entire File)

File: jlmops/config/taskDefinitions.json

[
[
"task.template",
"task.validation.webxlt_data_integrity",
"Task definition for WebXlt data integrity issues.",
"stable",
"topic", "WebXlt",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.sku_not_in_comax",
"Task definition for when a SKU from a web import does not exist in the Comax master data.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.translation_missing",
"Task definition for when a product is missing its counterpart in the other language.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.comax_internal_audit",
"Task for internal data consistency issues in Comax staging.",
"stable",
"topic", "Inventory",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "manager_to_admin_review"
],
[
"task.template",
"task.validation.field_mismatch",
"Task for when a field in a staging sheet does not match the master sheet.",
"stable",
"topic", "Products",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.vintage_mismatch",
"Task for when a product's vintage in a staging sheet does not match the master sheet or Comax.",
"stable",
"topic", "Products",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "manager_to_admin_review"
],
[
"task.template",
"task.validation.status_mismatch",
"Task for critical status (IsWeb, IsActive) mismatches in product data.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.name_mismatch",
"Task for when a product name in a staging sheet does not match the master sheet.",
"stable",
"topic", "Products",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.web_master_discrepancy",
"Task for when a web product exists in staging but not in the master sheet.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.master_master_discrepancy",
"Task for when a critical discrepancy is found between two master sheets.",
"stable",
"topic", "System",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.comax_master_discrepancy",
"Task for when an active Comax product is missing from staging.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.row_count_decrease",
"Task for when a row count decreases in a staging sheet compared to its master.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.export.comax_orders_ready",
"System task indicating that new web orders have been imported and are ready for export to Comax.",
"stable",
"topic", "System",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.confirmation.comax_order_export",
"Task to confirm Comax order export has been processed.",
"stable",
"topic", "System",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.confirmation.product_count_export",
"Task to confirm product count export has been processed.",
"stable",
"topic", "System",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.comax_not_web_product",
"Task for when a web product is not marked as \"sold on line\" in Comax.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.order_staging_failure",
"Task for when order staging validation fails.",
"stable",
"topic", "Orders",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.confirmation.comax_inventory_export",
"Task to confirm Comax inventory export has been processed.",
"stable",
"topic", "Inventory",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.export.web_inventory_ready",
"System task indicating that paired product imports are complete and web inventory is ready for export.",
"stable",
"topic", "System",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.confirmation.web_inventory_export",
"Task to confirm web inventory export has been processed.",
"stable",
"topic", "System",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.validation.archived_comax_stock_mismatch",
"Archived Comax product has non-zero stock.",
"stable",
"topic", "Inventory",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.onboarding.suggestion",
"Task for suggesting a new product to add to the web store.",
"stable",
"topic", "Products",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "manager_suggestion"
],
[
"task.template",
"task.onboarding.add_product",
"Task for managing the full onboarding process of a new product.",
"stable",
"topic", "Products",
"default_priority", "High",
"initial_status", "New",
"flow_pattern", "manager_to_admin_review"
],
[
"task.template",
"task.sync.daily_session",
"Wraps an entire daily sync session for tracking and visibility.",
"stable",
"topic", "System",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.deficiency.category_stock",
"Category is below minimum stock threshold.",
"stable",
"topic", "Products",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.bundle.monthly_review",
"Periodic bundle health check.",
"stable",
"topic", "Products",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.bundle.critical_inventory",
"Bundle has member product with zero inventory.",
"stable",
"topic", "Products",
"default_priority", "Critical",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.order.packing_available",
"Orders are ready for packing slip generation.",
"stable",
"topic", "Orders",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
],
[
"task.template",
"task.inventory.brurya_update",
"Reminder to update Brurya remote warehouse inventory.",
"stable",
"topic", "Inventory",
"default_priority", "Normal",
"initial_status", "New",
"flow_pattern", "admin_direct"
]
]

B.2 system.json Routing Entry (Append to File)

File: jlmops/config/system.json

Add this entry before the closing ]:
,
[
"task.routing.topic_to_project",
"Topic-to-project routing for auto-assignment",
"stable",
"Products", "PROJ-SYS_PRODUCT",
"Inventory", "PROJ-SYS_INVENTORY",
"System", "PROJ-SYS_SYSTEM",
"Orders", "PROJ-SYS_ORDERS",
"WebXlt", "PROJ-SYS_PRODUCT",
"", "", ""
]

Appendix C: Code Changes

TaskService.js - Auto-routing addition

Location: After line 93, before line 94
// Auto-route to project based on topic (if not explicitly provided)
if (!options.projectId) {
const routing = ConfigService.getConfig('task.routing.topic_to_project');
if (routing && taskTypeConfig.topic && routing[taskTypeConfig.topic]) {
const projectIdIdx = headers.indexOf('st_ProjectId');
if (projectIdIdx > -1) {
newRow[projectIdIdx] = routing[taskTypeConfig.topic];
}
}
}

---
Appendix D: Conceptual Overview

What Are Projects

Projects are containers that organize related work. They provide visibility into operational areas and track progress across multiple tasks.

What Are Tasks

Tasks are individual work items. They represent something to do, verify, or resolve.

How They Relate

Project (container)
Task 1 (work item)
Task 2 (work item)
Task 3 (work item)

- Every task belongs to one project (via st_ProjectId)
- Projects aggregate tasks by operational area
- Tasks are created with auto-routing based on topic

Task Lifecycle

- Created automatically (by system events) or manually (by users)
- Assigned to appropriate project via auto-routing
- Progress through statuses based on flow pattern
- Priority determines urgency: Critical > High > Normal > Low

---
Plan Version: 2.4
Last Updated: 2025-12-15
Status: Phase 1 and 1B COMPLETE - Implementation In Progress

IMPLEMENTATION SUMMARY:
- Phase 0: Prerequisites (manual project creation, config prep) - PENDING
- Phase 1: Config files (taskDefinitions.json, system.json) - ✅ COMPLETE
- Phase 1B: Core auto-routing (TaskService.js) - ✅ COMPLETE
- Phase 2: Sync session tasks (WebAppSync.js) - PENDING
- Phase 3: Category deficiency tasks (WebAppProducts.js) - PENDING
- Phase 4: Bundle tasks (BundleService.js, HousekeepingService.js) - PENDING
- Phase 5: Dashboard consolidation (WebAppProjects.js) - MOST COMPLEX - PENDING
- Phase 6: Packing slip tasks (WebAppOrders.js) - PENDING

Each phase has: Safety Checks, Verification Tests, Rollback Plan
See Appendix F for detailed implementation guide with checklists

---
IMPLEMENTATION LOG:

2025-12-16: Phase 5 Dashboard Consolidation Complete
- Created WebAppDashboardV2.js with single API call (WebAppDashboardV2_getData)
- Created AdminDashboardView_v2.html with task-based counts
- Layout: Row 1 (System, Orders, Inventory, Products), Row 2 (Projects, Admin Tasks)
- All counts derived from tasks - no separate sheet queries
- Registered as 'AdminDashboardV2' in WebApp.js viewMap
- Added sidebar link for testing
- Brurya shows task count (not product/stock counts)
- Bundle tasks (critical, low) displayed in Products card

2025-12-15: Phase 1 & 1B Complete
- Added flow_pattern to all 22 task definitions in taskDefinitions.json
- Added 5 routing entries to system.json (Products, Inventory, System, Orders, WebXlt)
- Added auto-routing code to TaskService.createTask() (lines 103-109)
- Ran generate-config.js and deployed via clasp push
- Verified: Tasks now auto-route to projects based on topic

2025-12-15: Critical Sync Fixes (Prerequisite for Phase 2)
- Fixed stage name mismatch: WEB_PRODUCTS_IMPORTING → WEB_IMPORT_PROCESSING
- Fixed step number mapping in OrchestratorService.js to match 5-step UI:
  * Step 1 = Web Products, Step 2 = Web Orders, Step 3 = Order Export
  * Step 4 = Comax Products, Step 5 = Web Inventory
- Added missing step 2 completion status when imports finish
- Added job completion triggers for validation and web export jobs in finalizeJobCompletion()
- These fixes documented in CODING_STANDARDS.md sections 9-11

---
Appendix E: Security Review (2025-12-15, Updated)

E.1 User Decisions

| Question | Decision |
|----------|----------|
| System Project IDs | Manual spreadsheet edit - add 4 projects directly to SysProjects sheet with exact IDs |
| Category Deficiency Tasks | Manual review required - tasks stay open until user closes them |
| Phase 5 Priority | Include in first release |
| File Lookup Pattern | Keep existing DriveApp.getFilesByName() - has been working reliably |

---
Appendix F: Enhanced Security Review (2025-12-15)

F.1 CRITICAL SAFETY MEASURES

The following safety measures MUST be in place before each phase begins:

BEFORE ANY CODE CHANGES:
1. Backup current config files (taskDefinitions.json, system.json)
2. Document current task count in SysTasks sheet
3. Verify clasp push works with no changes first

F.2 PHASE-BY-PHASE IMPLEMENTATION WITH SAFETY GATES

================================================================================
PHASE 0: PREREQUISITES (No Code Changes)
================================================================================

Purpose: Prepare environment before any code modifications

Step 0.1: Add System Project Protection to ProjectService.js
Location: In deleteProject() function, add at the start:

```javascript
// Reject deletion of system projects (pattern: SYS_ prefix after PROJ-)
if (projectId && projectId.startsWith('PROJ-SYS_')) {
  throw new Error('Cannot delete system project');
}
```

System project IDs use pattern: PROJ-SYS_XXXXX (e.g., PROJ-SYS_PRODUCT)
User-created projects use: PROJ-XXXXXXXX (auto-generated UUID)

Step 0.2: Manual Project Creation in SysProjects Sheet
- Open Google Sheet: JLMops_Data > SysProjects
- Add 4 rows with EXACT values:

| spro_ProjectId     | spro_Name            | spro_Type   | spro_Status | spro_StartDate | spro_EndDate |
|--------------------|----------------------|-------------|-------------|----------------|--------------|
| PROJ-SYS_PRODUCT   | Product Data Quality | OPERATIONAL | Active      | 2025-12-15     |              |
| PROJ-SYS_INVENTORY | Inventory Management | OPERATIONAL | Active      | 2025-12-15     |              |
| PROJ-SYS_SYSTEM    | System Health        | OPERATIONAL | Active      | 2025-12-15     |              |
| PROJ-SYS_ORDERS    | Order Fulfillment    | OPERATIONAL | Active      | 2025-12-15     |              |

SAFETY CHECK 0.1:
[ ] Open Admin > Projects in web app
[ ] Verify 4 projects visible with correct names
[ ] Verify task counts show 0 for each

Step 0.2: Add system.brurya.last_update to system.json
Add BEFORE closing bracket:
,
["system.brurya.last_update", "Tracks last Brurya inventory update", "stable", "value", "", "", "", "", "", "", "", "", ""]

SAFETY CHECK 0.2:
[ ] Run generate-config.js locally
[ ] Verify no JSON errors
[ ] Do NOT push yet - this is just validation

================================================================================
PHASE 1: CONFIGURATION CHANGES (Config Files Only)
================================================================================

Purpose: Update config files only - no service code changes yet

Step 1.1: Update taskDefinitions.json
- Replace entire file with Appendix B.1 content
- This adds flow_pattern to 22 existing tasks
- This adds 6 new task types

SAFETY CHECK 1.1:
[ ] JSON syntax valid (use jsonlint)
[ ] Exactly 28 task definitions in array
[ ] Each has: task.template marker, taskTypeId, description, stable, topic, default_priority, initial_status, flow_pattern

Step 1.2: Add routing config to system.json
- Add entry from Appendix B.2 (task.routing.topic_to_project)
- Also add system.brurya.last_update from Step 0.2

SAFETY CHECK 1.2:
[ ] JSON syntax valid
[ ] Run: node generate-config.js (must complete without errors)
[ ] Count config entries - should be +2 from before

Step 1.3: Deploy config changes
- clasp push
- Run rebuildSysConfigFromSource() in Apps Script editor

VERIFICATION TEST 1.3:
[ ] In Apps Script, run: ConfigService.getConfig('task.routing.topic_to_project')
[ ] Should return object with Products, Inventory, System, Orders, WebXlt keys
[ ] In Apps Script, run: ConfigService.getConfig('task.sync.daily_session')
[ ] Should return object with topic='System', flow_pattern='admin_direct'

ROLLBACK PLAN 1:
- Restore backup of taskDefinitions.json and system.json
- clasp push
- Run rebuildSysConfigFromSource()

================================================================================
PHASE 1B: AUTO-ROUTING CODE (TaskService.js Only)
================================================================================

Purpose: Add auto-routing logic to TaskService - this is the core change

Step 1B.1: Add completeTaskByTypeAndEntity helper to TaskService.js
Location: After completeTask() function (around line 205), add:

/**
 * Finds and completes an open task by type and linked entity.
 * @param {string} taskTypeId The task type to find.
 * @param {string} linkedEntityId The entity ID to match.
 * @returns {boolean} True if task found and completed.
 */
function completeTaskByTypeAndEntity(taskTypeId, linkedEntityId) {
  try {
    const allConfig = ConfigService.getAllConfig();
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const sheet = spreadsheet.getSheetByName('SysTasks');

    if (!sheet || sheet.getLastRow() < 2) return false;

    const taskSchema = allConfig['schema.data.SysTasks'];
    const headers = taskSchema.headers.split(',');
    const typeCol = headers.indexOf('st_TaskTypeId');
    const entityCol = headers.indexOf('st_LinkedEntityId');
    const statusCol = headers.indexOf('st_Status');
    const taskIdCol = headers.indexOf('st_TaskId');

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][typeCol] === taskTypeId &&
          String(data[i][entityCol]).trim() === String(linkedEntityId).trim() &&
          data[i][statusCol] !== 'Done' && data[i][statusCol] !== 'Closed') {
        return completeTask(data[i][taskIdCol]);
      }
    }
    return false;
  } catch (e) {
    logger.error('TaskService', 'completeTaskByTypeAndEntity', e.message, e);
    return false;
  }
}

Export it in return block:
completeTaskByTypeAndEntity: completeTaskByTypeAndEntity,

Step 1B.2: Add auto-routing code to createTask()
Location: After line 93 (after setting st_Topic), add:

    // Auto-route to project based on topic (if not explicitly provided)
    if (!options.projectId) {
      const routing = ConfigService.getConfig('task.routing.topic_to_project');
      if (routing && taskTypeConfig.topic && routing[taskTypeConfig.topic]) {
        const projectIdIdx = headers.indexOf('st_ProjectId');
        if (projectIdIdx > -1) {
          newRow[projectIdIdx] = routing[taskTypeConfig.topic];
          logger.info('TaskService', 'createTask', `Auto-routed to project: ${routing[taskTypeConfig.topic]}`);
        }
      }
    }

SAFETY CHECK 1B:
[ ] Code compiles (clasp push succeeds)
[ ] No existing functionality changed - only added

VERIFICATION TEST 1B:
Manual test in Apps Script editor:
1. Run: TaskService.createTask('task.validation.field_mismatch', 'TEST-SKU-123', 'Test Product', 'Test Task', 'Testing auto-routing')
2. Check SysTasks sheet - new task should have st_ProjectId = 'PROJ-SYS_PRODUCT'
3. Delete test task row manually

ROLLBACK PLAN 1B:
- Restore TaskService.js from git
- clasp push

================================================================================
PHASE 2: SYNC SESSION TASKS (WebAppSync.js Only)
================================================================================

Purpose: Track each sync session as a task

Step 2.1: Add task creation at sync start
File: WebAppSync.js
Location: In startDailySyncBackend(), after line 47 (after newSessionId generated), add:

    // Create sync session tracking task
    try {
      TaskService.createTask(
        'task.sync.daily_session',
        newSessionId,
        `Sync ${new Date().toISOString().split('T')[0]}`,
        `Daily Sync - ${new Date().toLocaleDateString()}`,
        'Sync session initiated',
        newSessionId
      );
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not create sync session task: ${taskError.message}`);
      // Non-blocking - sync continues even if task creation fails
    }

Step 2.2: Add task completion at sync end
File: WebAppSync.js
Location: In confirmWebInventoryUpdateBackend(), after setting currentStage = 'COMPLETE', add:

    // Complete the sync session task
    try {
      TaskService.completeTaskByTypeAndEntity('task.sync.daily_session', sessionId);
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not complete sync session task: ${taskError.message}`);
    }

Step 2.3: Handle early completion path
File: WebAppSync.js
Location: In exportComaxOrdersBackend(), in the if (exportedCount === 0) block, add same completion call.

SAFETY CHECK 2:
[ ] All task operations wrapped in try/catch
[ ] Failures logged but don't block sync
[ ] Uses new helper function (no duplicated sheet access code)

VERIFICATION TEST 2:
1. Start a Daily Sync
2. Check SysTasks - task.sync.daily_session should exist with session ID
3. Complete the sync
4. Check task status = 'Done'
5. Start another sync - should create new task (different session ID)

ROLLBACK PLAN 2:
- Remove added code blocks from WebAppSync.js
- clasp push

================================================================================
PHASE 3: CATEGORY DEFICIENCY TASKS (WebAppProducts.js Only)
================================================================================

Purpose: Create tasks when categories are below stock threshold

Step 3.1: Add task creation in getManagerWidgetData
File: WebAppProducts.js
Location: In WebAppProducts_getManagerWidgetData(), inside if (status === 'Low') block, add:

      // Create deficiency task (de-duplication handled by TaskService)
      try {
        TaskService.createTask(
          'task.deficiency.category_stock',
          rule.category,
          rule.category,
          `Low stock: ${rule.category}`,
          `Category "${rule.category}" has ${currentCount} products (minimum: ${rule.min}).`,
          null
        );
      } catch (taskError) {
        logger.warn('WebAppProducts', 'getManagerWidgetData', `Could not create deficiency task: ${taskError.message}`);
      }

SAFETY CHECK 3:
[ ] Task creation in try/catch - non-blocking
[ ] De-duplication relies on TaskService (linkedEntityId = category name)
[ ] Category names are stable (from config rules, not user input)

VERIFICATION TEST 3:
1. Identify a category that is currently 'Low' status
2. Open Manager Dashboard (triggers getManagerWidgetData)
3. Check SysTasks for task.deficiency.category_stock with that category
4. Refresh dashboard again - should NOT create duplicate task
5. Manually close the task
6. Refresh dashboard - new task should be created

ROLLBACK PLAN 3:
- Remove added code from WebAppProducts.js
- clasp push

================================================================================
PHASE 4: BUNDLE TASKS (BundleService.js + HousekeepingService.js)
================================================================================

Purpose: Detect bundles with out-of-stock members

Step 4.1: Add checkBundleInventoryHealth() to BundleService.js
- Add function from plan Part 4, Step 4.2
- Add createMonthlyReviewTask() from Step 4.5
- Export both functions

Step 4.2: Call from HousekeepingService.js
- Add call in performDailyMaintenance() with try/catch wrapper

SAFETY CHECK 4:
[ ] Both calls wrapped in try/catch
[ ] Failures logged at warn level, don't block other maintenance
[ ] Uses SpreadsheetApp.openById() not getFilesByName()

VERIFICATION TEST 4:
1. In Apps Script editor, run: BundleService.checkBundleInventoryHealth()
2. Check return value - should show bundlesChecked count
3. If any bundle has 0-stock member, check SysTasks for task.bundle.critical_inventory
4. Run: BundleService.createMonthlyReviewTask()
5. Check SysTasks for task.bundle.monthly_review with current month
6. Run again - should NOT create duplicate (de-duplication check)

ROLLBACK PLAN 4:
- Remove added functions from BundleService.js
- Remove call from HousekeepingService.js
- clasp push

================================================================================
PHASE 5: DASHBOARD CONSOLIDATION (Most Complex - Do Last)
================================================================================

Purpose: Single query for all dashboard data

Step 5.1: Add WebAppProjects_getDashboardData()
- Add function to WebAppProjects.js (from plan Part 5.4)
- MODIFICATION: Fetch projects dynamically instead of hardcoding:

const allProjects = ProjectService.getAllProjects();
const projects = {};
allProjects.forEach(p => {
  const id = p.spro_ProjectId || p.projectid;
  const name = p.spro_Name || p.name;
  if (id && p.spro_Status === 'Active') {
    projects[id] = { id, name, counts: {}, tasks: [] };
  }
});

Step 5.2: Add Brurya reminder to HousekeepingService
- Add code from plan Part 5.3
- Ensure system.brurya.last_update config exists (done in Phase 0)

Step 5.3: Update Brurya management to track last update
- Identify where Brurya counts are updated
- Add: ConfigService.setConfig('system.brurya.last_update', { value: new Date().toISOString() })
- Close any open brurya_update task

SAFETY CHECK 5:
[ ] getDashboardData fetches projects dynamically (not hardcoded)
[ ] Brurya reminder has try/catch wrapper
[ ] Config update has error handling

VERIFICATION TEST 5:
1. In Apps Script, run: WebAppProjects_getDashboardData('admin')
2. Should return { projects: [...], summary: { total: X, critical: Y } }
3. Run runDailyMaintenance()
4. If Brurya not updated in 7 days, check for task.inventory.brurya_update
5. Update Brurya inventory via UI
6. Verify task closes and config updated

ROLLBACK PLAN 5:
- Remove added function from WebAppProjects.js
- Remove Brurya check from HousekeepingService.js
- clasp push

================================================================================
PHASE 6: PACKING SLIP TASKS (WebAppOrders.js Only)
================================================================================

Purpose: Track when orders are ready for packing

Step 6.1: Add updatePackingAvailabilityTask() function
- Add function to WebAppOrders.js (from plan Part 6.2)
- Make it a regular function (not underscore-prefixed since called externally)

Step 6.2: Call after order operations
- Call at end of WebAppOrders_triggerWebOrderImport()
- Call at end of WebAppOrders_generatePackingSlips()

SAFETY CHECK 6:
[ ] Function wrapped in try/catch
[ ] Failures logged but don't block order operations
[ ] Uses SpreadsheetApp.openById() pattern

VERIFICATION TEST 6:
1. Import web orders (if any available)
2. Check SysTasks for task.order.packing_available
3. Task notes should show order count
4. Print all packing slips
5. Task should be completed (status = Done)
6. Import more orders - task should be recreated

ROLLBACK PLAN 6:
- Remove added function and calls from WebAppOrders.js
- clasp push

================================================================================
F.3 COMPREHENSIVE SAFETY CHECKLIST

Before marking implementation complete:

[ ] All 4 system projects exist in SysProjects
[ ] All 28 task types in taskDefinitions.json
[ ] Routing config entry in system.json
[ ] Brurya config entry in system.json
[ ] Auto-routing code in TaskService.js
[ ] completeTaskByTypeAndEntity helper in TaskService.js
[ ] Sync session task creation/completion in WebAppSync.js
[ ] Category deficiency task in WebAppProducts.js
[ ] Bundle health check in BundleService.js
[ ] Bundle check call in HousekeepingService.js
[ ] Dashboard aggregation in WebAppProjects.js
[ ] Brurya reminder in HousekeepingService.js
[ ] Packing task in WebAppOrders.js

Regression tests:
[ ] Daily Sync completes successfully
[ ] Manager Dashboard loads without errors
[ ] Admin Dashboard loads without errors
[ ] Existing task creation still works (validation tasks)
[ ] Task de-duplication still works
[ ] Project task counts are accurate

================================================================================
F.4 KNOWN LIMITATIONS

1. Existing tasks will not have st_ProjectId - only new tasks get auto-routing
   - Manual backfill possible via spreadsheet edit if needed

2. Dashboard consolidation (Phase 5) widget changes not detailed
   - Plan shows data structure but not full HTML changes
   - Existing widgets continue to work without Phase 5

3. Brurya integration point not fully specified
   - Need to identify exact function where Brurya counts are saved

4. Monthly bundle review requires manual trigger or separate time trigger
   - Not called from daily maintenance automatically

================================================================================
F.5 EMERGENCY ROLLBACK PROCEDURE

If critical issues occur after deployment:

1. Identify which phase caused the issue
2. Revert only that phase's files from git
3. clasp push
4. Run rebuildSysConfigFromSource() if config was changed
5. Verify system stable before proceeding

Order of reversion (safest first):
- Phase 6 (Packing) - isolated
- Phase 4 (Bundle) - isolated
- Phase 3 (Category) - isolated
- Phase 2 (Sync) - isolated
- Phase 1B (Auto-routing) - core change
- Phase 1 (Config) - foundation
- Phase 0 (Projects) - manual spreadsheet rows, delete if needed

