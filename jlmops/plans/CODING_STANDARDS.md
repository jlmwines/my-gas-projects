# jlmops Coding Standards

**Purpose:** Document coding patterns and standards for the jlmops Google Apps Script project to ensure consistency across sessions.

---

## 1. HTML View Initialization Pattern

**Problem:** HTML views loaded via `HtmlService.createTemplateFromFile()` may execute JavaScript before DOM elements exist, causing "innerHTML is null" errors.

**Required Pattern:**
```javascript
<script>
(function() {
  'use strict';

  // Initialize on load - use this exact pattern
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // All initialization code here
  }
})();
</script>
```

**Wrong Pattern (causes timing bugs):**
```javascript
// DON'T DO THIS - can cause double-init or null element errors
document.addEventListener('DOMContentLoaded', function() {
  init();
});
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(init, 0);
}
```

**Reference:** `AdminBundlesView.html` lines 1100-1106

---

## 2. Configuration Changes Workflow

**Problem:** JSON config files (`config/system.json`, `config/taskDefinitions.json`, `config/schemas.json`) are source files that must be compiled before deployment.

**Required Workflow:**
1. Edit JSON file in `jlmops/config/` folder
2. Run `node generate-config.js` to compile to Apps Script format
3. Run `clasp push` to deploy

**Never:** Edit SysConfig sheet directly for configuration that originates in JSON files.

---

## 3. Button Styling

**Standard:** Use Bootstrap 4 classes with the app's established button patterns.

```html
<!-- Primary action -->
<button class="btn btn-sm">Action</button>

<!-- Secondary/cancel -->
<button class="btn btn-sm" data-dismiss="modal">Cancel</button>
```

**Reference:** Existing views use minimal Bootstrap styling; avoid custom CSS.

---

## 4. ConfigService Access Pattern

**Problem:** `ConfigService.getAllConfig()` returns nested objects. Accessing with dot-notation in the key returns undefined.

**Correct:**
```javascript
const allConfig = ConfigService.getAllConfig();
const sheetNames = allConfig['system.sheet_names'];
const taskSheet = sheetNames.SysTasks;  // Nested access
```

**Wrong:**
```javascript
const taskSheet = allConfig['system.sheet_names.SysTasks'];  // Returns undefined!
```

---

## 5. Spreadsheet Access Pattern

**Preferred:** Use config-based ID lookup:
```javascript
const allConfig = ConfigService.getAllConfig();
const spreadsheetId = allConfig['system.spreadsheet.data'].id;
const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
```

**Avoid:** `DriveApp.getFilesByName()` - unreliable if duplicate filenames exist.

---

## 6. Error Handling in WebApp Functions

**Standard Pattern:**
```javascript
function WebApp_functionName(params) {
  try {
    const result = SomeService.doThing(params);
    return { error: null, data: result };
  } catch (e) {
    logger.error('WebApp', 'functionName', e.message, e);
    return { error: e.message, data: null };
  }
}
```

---

## 7. Project ID Conventions

- **System projects:** `PROJ-SYS_XXXXX` (protected from deletion)
- **User projects:** `PROJ-XXXXXXXX` (auto-generated UUID)

---

## 8. Date Serialization for Client

**Problem:** Google Sheets Date objects cannot be serialized via `google.script.run`. Returning objects containing Date values will result in `null` on the client side.

**Required Pattern:** Sanitize data before returning to client:
```javascript
function _sanitizeForClient(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(_sanitizeForClient);
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      sanitized[key] = _sanitizeForClient(obj[key]);
    }
    return sanitized;
  }
  return obj;
}

// Usage in WebApp functions:
return { error: null, data: _sanitizeForClient(results) };
```

**Symptom:** Backend logs show successful return, but frontend receives `null`.

**Reference:** `WebAppProjects.js` lines 12-24

---

## 9. Sync Widget Step Mapping

**Problem:** The Daily Sync Widget (AdminDailySyncWidget_v2.html) uses a 5-step UI. The shared message area uses `currentStage` as the source of truth, not step data.

**UI Step Mapping:**
| Step | Card Title | Stage(s) |
|------|------------|----------|
| 1 | Web Product Import | IDLE, WEB_IMPORT_PROCESSING |
| 2 | Web Order Import | (part of WEB_IMPORT_PROCESSING) |
| 3 | Update Comax Orders | WAITING_FOR_COMAX, COMAX_EXPORT_PENDING |
| 4 | Import Comax Products | READY_FOR_COMAX_IMPORT, COMAX_IMPORT_PROCESSING, VALIDATING |
| 5 | Update Web Inventory | READY_FOR_WEB_EXPORT, WEB_EXPORT_PROCESSING, WEB_EXPORT_GENERATED |

**Important:** The shared message area in the widget uses `status.currentStage` to determine what to show, bypassing potentially mismatched step data.

**Reference:** `AdminDailySyncWidget_v2.html` updateSharedArea() function

---

## 10. Sync State Stage Names

**Problem:** Sync state uses specific stage names. Using incorrect names causes the state machine to fail to advance.

**Valid Stage Names:**
- `IDLE` - No active sync
- `WEB_PRODUCTS_IMPORTING` - Importing web products (v2 widget)
- `WEB_ORDERS_READY` - Products done, ready for orders import (v2 widget)
- `WEB_ORDERS_IMPORTING` - Importing web orders (v2 widget)
- `WEB_IMPORT_PROCESSING` - Importing web data (v1 combined flow)
- `WAITING_FOR_COMAX` - Orders ready for export
- `READY_FOR_COMAX_IMPORT` - Ready to import Comax data
- `COMAX_IMPORT_PROCESSING` - Importing Comax data
- `VALIDATING` - Running validation
- `READY_FOR_WEB_EXPORT` - Ready to generate web inventory
- `WEB_EXPORT_PROCESSING` - Generating export file
- `WEB_EXPORT_GENERATED` - Export complete, awaiting confirmation
- `COMPLETE` - Sync finished
- `FAILED` - Error occurred

**Note:** v2 widget stages (WEB_PRODUCTS_IMPORTING, WEB_ORDERS_READY, WEB_ORDERS_IMPORTING) use step-based UI logic and may not require `_checkAndAdvanceSyncState()` handling.

**Reference:** `SyncStateService.js` line 114, `OrchestratorService.js` lines 1043-1350

---

## 11. Job Completion Triggers

**Problem:** When a new job type is added to the system, its completion must trigger state advancement.

**Required:** Add job type to `finalizeJobCompletion()` switch statement:
```javascript
// In OrchestratorService.js finalizeJobCompletion()
case 'job.periodic.validation.master':
  logger.info(serviceName, functionName, 'Validation job completed. Triggering state advancement.');
  _checkAndAdvanceSyncState();
  break;
```

**Current job types with triggers:**
- `import.drive.web_orders`
- `import.drive.web_products_en`
- `import.drive.comax_products`
- `job.periodic.validation.master`
- `export.web.inventory`

**Reference:** `OrchestratorService.js` lines 914-935
