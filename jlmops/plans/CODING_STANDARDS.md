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

**Problem:** The Daily Sync Widget (`AdminDailySyncWidget_v2.html`) maps the 12-state machine onto a 5-step UI. The shared message area uses `currentStage` as the source of truth, not step data.

**UI Step → Stage(s) (rough — verify in widget code before relying on for new work):**
| Step | Card Title | Stages |
|------|------------|--------|
| 1 | Web Product Import | `IDLE`, `IMPORTING_PRODUCTS` |
| 2 | Web Order Import | `IMPORTING_ORDERS` |
| 3 | Update Comax Orders | `WAITING_ORDER_EXPORT`, `EXPORTING_ORDERS`, `WAITING_ORDER_CONFIRM` |
| 4 | Import Comax Products | `WAITING_COMAX_IMPORT`, `IMPORTING_COMAX`, `VALIDATING` |
| 5 | Update Web Inventory | `WAITING_WEB_EXPORT`, `GENERATING_WEB_EXPORT`, `WAITING_WEB_CONFIRM`, `PUSHING_WEB_INVENTORY` |

Terminal states (`COMPLETE`, `FAILED`) and the `IDLE` reset are handled in the shared message area.

**Important:** The shared message area in the widget uses `status.currentStage` to determine what to show, bypassing potentially mismatched step data.

**Reference:** `AdminDailySyncWidget_v2.html` `updateSharedArea()` function; canonical state machine in `SyncStateService.js:15-54`.

---

## 10. Sync State Stage Names

**Problem:** Sync state uses specific stage names. Using incorrect names causes the state machine to fail to advance.

Canonical source: `SyncStateService.js:15-33` (STATES) and `:38-54` (TRANSITIONS). Update this section together with that file.

**Valid Stage Names** (14 total):

| Stage | Kind | Meaning |
|-------|------|---------|
| `IDLE` | resting | No active sync |
| `IMPORTING_PRODUCTS` | processing | Web products pull in flight |
| `IMPORTING_ORDERS` | processing | Web orders pull in flight |
| `WAITING_ORDER_EXPORT` | user action | Orders staged, awaiting export trigger |
| `EXPORTING_ORDERS` | processing | Order export to Comax in flight |
| `WAITING_ORDER_CONFIRM` | user action | Order export awaiting user confirmation |
| `WAITING_COMAX_IMPORT` | user action | Awaiting Comax product CSV drop |
| `IMPORTING_COMAX` | processing | Comax product import in flight |
| `VALIDATING` | processing | Running validation pass |
| `WAITING_WEB_EXPORT` | user action | Validation done, awaiting web export trigger |
| `GENERATING_WEB_EXPORT` | processing | Generating web inventory CSV |
| `WAITING_WEB_CONFIRM` | user action | Post-CSV decision point: manual confirm → `COMPLETE`, or API push → `PUSHING_WEB_INVENTORY` |
| `PUSHING_WEB_INVENTORY` | processing | API push to WC in flight |
| `COMPLETE` | terminal | Sync finished, ready to reset to `IDLE` |
| `FAILED` | terminal | Error occurred; retry path returns to `failedAtStage` |

**Convention:** `*ING_*` = system processing (spinner in UI), `WAITING_*` = user action needed, `IDLE` / `COMPLETE` / `FAILED` are special.

**Reference:** `SyncStateService.js:15-54` (definitive), `OrchestratorService.js` (transition triggers — search `_checkAndAdvanceSyncState`).

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
