# JLMOps Project Context

## Project Overview
Resource optimization project for Google Apps Script application managing orders, inventory, and sync workflows.

## Key Objectives
1. **Reduce Google Sheets API calls** - Primary resource target
2. **Improve dashboard load times** - User experience
3. **Optimize execution quota usage** - Google Apps Script limits
4. **Better UX for sync workflows** - Real-time feedback

## Current Architecture

### Application Structure
- **Platform:** Google Apps Script (server-side JavaScript)
- **Storage:** Google Sheets as database
- **Frontend:** HTML Service with client-side JavaScript
- **Entry Point:** `WebApp.js` - `doGet()` serves role-based UI

### Role-Based UI (Two Sets of HTML Files)

**Admin Role** (Full Access):
- Views: `AdminDashboardView.html`, `AdminOrdersView.html`, `AdminInventoryView.html`, `AdminProductsView.html`, `AdminSyncView.html`, `AdminBundlesView.html`
- Widgets: `AdminOrdersWidget.html`, `AdminInventoryWidget.html`, `AdminProductsWidget.html`, `AdminDailySyncWidget.html`
- **Unique Features:** Sync management, System administration, Bundle management

**Manager Role** (Limited Access):
- Views: `ManagerDashboardView.html`, `ManagerOrdersView.html`, `ManagerInventoryView.html`, `ManagerProductsView.html`
- Widgets: `ManagerOrdersWidget.html`, `ManagerInventoryWidget.html`, `ManagerProductsWidget.html`
- **Limitations:** No Sync or System access

### Shared Data Layer (WebApp Scripts - One Set)

**All roles use the same backend data access scripts:**
- `WebApp.js` - Main entry point, routing, role-based HTML serving
- `WebAppDashboard.js` - Dashboard data aggregation
- `WebAppOrders.js` - Orders data access and operations
- `WebAppProducts.js` - Products data access and operations
- `WebAppInventory.js` - Inventory data access and operations
- `WebAppTasks.js` - Task data access with caching (✅ optimized)
- `WebAppSync.js` - Sync workflow data and operations
- `WebAppSystem.js` - System administration data

**Pattern:**
- UI layer is duplicated per role (Admin*.html vs Manager*.html)
- Data layer is shared (WebApp*.js) - single source for all roles
- Role permissions enforced by `AuthService.getActiveUserRole()`

### Key Services
- `TaskService.js` - Task management and orchestration
- `WebAppTasks.js` - Task data access with caching
- `SyncStateService.js` - Sync workflow state management
- `SetupConfig.js` - Configuration and logging
- `AuthService.js` - User authentication and role management
- `BundleService.js` - Bundle management (2-sheet model: SysBundles + SysBundleSlots)
- `WebAppBundles.js` - Bundle UI controller functions

## Configuration Management Workflow

**CRITICAL:** The SysConfig sheet is managed through a local build process, NOT edited directly in Google Sheets.

### Workflow Steps:
1. **Edit Config Files** (Local):
   - Modify JSON files in `jlmops/config/` directory
   - Available configs: `headers.json`, `system.json`, `jobs.json`, `schemas.json`, `mappings.json`, `validation.json`, `taskDefinitions.json`, `migrationColumnMapping.json`, `orders.json`, `migrationSyncTasks.json`, `printing.json`, `users.json`, `otherSettings.json`

2. **Generate SetupConfig.js** (Local):
   ```bash
   node jlmops/generate-config.js
   ```
   - Reads all config/*.json files in specific order
   - Processes template expansions (e.g., `validation.rule.template.*`)
   - Combines into single master config array
   - Generates `SetupConfig.js` with `getMasterConfiguration()` function

3. **Push to Apps Script** (Local):
   ```bash
   cd jlmops
   clasp push
   ```
   - Uploads `SetupConfig.js` to Google Apps Script project

4. **Execute Rebuild Function** (Apps Script):
   - Run `rebuildSysConfigFromSource()` function in Apps Script IDE
   - This overwrites the SysConfig sheet in JLMops_Data spreadsheet
   - Calls `ConfigService.forceReload()` to invalidate cache

### Important Files:
- **Source of Truth:** `jlmops/config/*.json` (local JSON files)
- **Generator Script:** `jlmops/generate-config.js` (Node.js)
- **Generated File:** `jlmops/SetupConfig.js` (DO NOT EDIT MANUALLY)
- **Runtime Storage:** `JLMops_Data` > `SysConfig` sheet (Google Sheets)

### Template Processing:
The generator supports template expansion for:
- `map.web.order_columns.template` - Expands ranges and fields
- `validation.rule.template.*` - Expands validation rules
- `task.template.*` - Expands task definitions

### Never:
- ❌ Edit `SetupConfig.js` manually (it's auto-generated)
- ❌ Edit `SysConfig` sheet directly in Google Sheets (changes will be overwritten)
- ✅ Always edit `jlmops/config/*.json` files and regenerate

## Validation Architecture

jlmops runs **TWO parallel validation systems** during the migration from legacy backend-script/frontend-script systems:

### 1. NEW - Permanent System (ValidationLogic.js + ValidationOrchestratorService.js)
- **Purpose:** Validates jlmops internal data integrity
- **Mechanism:** Config-driven validation rules from SysConfig (`validation.rule.*`)
- **Status:** Production system for all ongoing validation
- **Execution:** Runs via job queue orchestrator (automated)
- **Files:**
  - `ValidationLogic.js` - Pure analysis engine with test execution methods
  - `ValidationOrchestratorService.js` - Bridges ValidationLogic and TaskService
  - `config/validation.json` - Validation rule definitions

### 2. TEMPORARY - Legacy Comparisons (ValidationService_DEPRECATED.js)
- **Purpose:** Compares jlmops data vs legacy backend-script/frontend-script systems
- **Duration:** Only needed during parallel operation period
- **Will be removed:** Once legacy systems are decommissioned
- **Status:** Dead code removed (Phase 1 cleanup complete)
- **File Size:** Reduced from 1,437 → 599 lines (838 lines removed)
- **5 Active Comparison Methods:**
  - `validateProductMasterData()` - Compares product data (WebM/WeHe vs WebProdM/WebXltM)
  - `validateOnHoldInventory()` - Compares on-hold inventory
  - `validateHighestOrderNumber()` - Compares order numbers between systems
  - `validateComaxExportConsistency()` - Validates Comax export readiness
  - `validatePackingSlipData()` - Compares packing slip data
- **Accessible via:** DevelopmentView "Run Legacy Validation" button
- **Called from:** `WebAppSystem.WebAppSystem_runLegacyValidationAndReturnResults()`

### Migration Status:
- ✅ New validation system complete and operational
- ✅ Dead code removed from ValidationService_DEPRECATED.js (58% file reduction)
- ⏳ Legacy comparisons still active (waiting for legacy system decommission)
- 🔮 Future Phase 2: Remove ValidationService_DEPRECATED.js entirely when legacy systems retired

### Important Notes:
- **Do NOT modify** ValidationService_DEPRECATED.js - it contains only legacy comparison methods
- **Do NOT add new validations** to ValidationService_DEPRECATED.js - use ValidationLogic.js instead
- All config-driven validation engine code has been migrated to ValidationLogic.js
- ValidationService_DEPRECATED.js serves only as a temporary bridge during migration

## Performance Optimizations Completed
### 1. Task Caching System ✅
- **Files:** `WebAppTasks.js`, `TaskService.js`
- **Impact:** 50-70% dashboard load time reduction
- **Mechanism:** 60-second TTL cache with automatic invalidation
- **Status:** Deployed and tested

### 2. Sync Widget UX Overhaul ⏳
- **Files:** `AdminDailySyncWidget.html`, `SyncStateService.js`, `WebAppSync.js`
- **Features:** Invoice tracking, adaptive polling (5s/30s), 0-orders workflow
- **Status:** Code complete, needs deployment testing

## Resource Metrics
| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Dashboard Reads | 4+ per load | 1 per load | 75% |
| Load Time (cached) | 9-14s | 2-3s | 70% |
| Polling Rate (idle) | 30s fixed | 30s adaptive | 0% |
| Polling Rate (active) | 30s fixed | 5s adaptive | -83% (faster!) |

## Known Issues
- 71 instances of `getDataRange().getValues()` across codebase (only Task reads optimized so far)
- Sequential widget loading (not parallel)
- No connection pooling for `openById()` calls

## Future Optimization Opportunities
1. **Extend caching to Products, Orders, Inventory data**
   - Apply same caching pattern from `WebAppTasks.js` to:
     - `WebAppProducts.js`
     - `WebAppOrders.js`
     - `WebAppInventory.js`
   - **Impact:** Benefits BOTH Admin and Manager roles (shared data layer)

2. **Implement centralized SheetService**
   - Connection pooling for `openById()` calls
   - Batch read operations
   - Single point of optimization affects all WebApp*.js scripts

3. **Parallel widget loading with Promise.all()**
   - Admin has 4+ widgets per dashboard
   - Manager has 3+ widgets per dashboard
   - Currently loading sequentially

4. **Reduce columns read (selective field fetching)**
   - Currently reading full `getDataRange().getValues()`
   - Could read specific columns only

5. **Pagination for large datasets**
   - Orders, Products, Inventory can be 100s-1000s of rows
   - Implement client-side pagination with server-side chunking

## Session Management
- Keep session summaries in `jlmops/SESSION_SUMMARY.md`
- Document major changes in topic-specific files (e.g., `PERFORMANCE_IMPROVEMENTS.md`)
- Use this file to provide quick context to Claude without re-reading all docs

## Quick Reference
- **Main spreadsheet reads:** `getDataRange().getValues()`
- **Cache location:** In-memory (Apps Script runtime)
- **Cache TTL:** 60 seconds
- **Logging:** Uses `SysLog.info()` and `SysLog.error()`
- **Task states:** Pending, In Progress, Done, Failed
