
## 11. Daily Sync Workflow (Automated & Guided)

This workflow orchestrates the synchronization of data between the Web (WooCommerce) and the ERP (Comax), ensuring inventory accuracy and data integrity.

### 11.1. Steps & Logic

1.  **Import Web Data:**
    *   **Action:** User clicks "Start".
    *   **Process:** The system imports the latest `WebOrders.csv`, `WebProducts.csv`, and `WebTranslations.csv` from the source folder.
    *   **State:** Transitions to `WEB_IMPORT_PROCESSING`.

2.  **Export Orders (Conditional):**
    *   **Check:** The system checks if any eligible orders need to be exported to Comax.
    *   **If Orders Exist:**
        *   **Action:** User clicks "Export Orders".
        *   **Process:** A CSV file is generated for upload to Comax.
        *   **Action:** User clicks "Confirm Comax Update" after uploading.
    *   **If No Orders:**
        *   **Logic:** The system displays "No orders to export" and automatically enables the next step.

3.  **Import Comax Data:**
    *   **Action:** User clicks "Start Import" (after ensuring Comax export file is in source folder).
    *   **Process:** The system imports `ComaxProducts.csv` and updates master data.
    *   **State:** Transitions to `COMAX_IMPORT_PROCESSING`.

4.  **Validation (Automated):**
    *   **Trigger:** Automatically starts after Comax Import completes.
    *   **Process:** Runs master data validation (SKU checks, price integrity).
    *   **State:** Transitions to `VALIDATING`.

5.  **Export Web Inventory:**
    *   **Trigger:** Enabled only after Validation succeeds.
    *   **Action:** User clicks "Generate Export".
    *   **Process:** Generates a CSV diff of inventory changes for WooCommerce.
    *   **Action:** User clicks "Download Export" to get the file.
    *   **Action:** User clicks "Confirm Web Update" to complete the cycle.
    *   **State:** Transitions to `COMPLETE`.

### 11.2. Error Handling & Reset
*   **Failure:** If any step fails, the widget turns red and displays the error.
*   **Retry:** Users can retry specific actions (e.g., "Generate Export") without restarting the whole flow.
*   **Reset:** A "Reset" link is available to clear the state and start a fresh sync cycle if necessary.

---

## 12. Task Routing, Assignment & Dates

### 12.0 Project Routing on Creation

**Design rule:** every task belongs to exactly one project, carried in `st_ProjectId`. Routing is how that project is assigned at creation.

`createTask()` stamps each new task with a project. When the caller passes no explicit `options.projectId`, the task's topic (`options.topic`, else the task type's `topic`) is looked up in the `task.routing.topic_to_project` config map and the match becomes `st_ProjectId`. An explicit `options.projectId` always wins. There is currently no fallback: a topic with no map entry, or a topic mapped to an unseeded project, yields a task that does not satisfy the design rule (see Coverage gaps below).

**Topic → project map** (`task.routing.topic_to_project`, stored split-key in SysConfig):

| Topic | Project |
|-------|---------|
| `Products` | `PROJ-SYS_PRODUCT` |
| `WebXlt` | `PROJ-SYS_PRODUCT` |
| `Inventory` | `PROJ-SYS_INVENTORY` |
| `Orders` | `PROJ-SYS_ORDERS` |
| `System` | `PROJ-SYS_SYSTEM` |
| `CRM` | `PROJ-SYS_CRM` |
| `Contact` | `PROJ-SYS_CRM` |
| `Campaign` | `PROJ-SYS_CRM` |
| `Content` | `PROJ-CONTENT` |

To change routing, edit `config/system.json` → `node generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`.

**Project classes.** Routing targets fall into two kinds:

- **System-managed** — the `PROJ-SYS_*` projects (`SysProjects`, seeded Dec 2025): Product Data Quality (`PROJ-SYS_PRODUCT`), Inventory Management (`PROJ-SYS_INVENTORY`), System Health (`PROJ-SYS_SYSTEM`), Order Fulfillment (`PROJ-SYS_ORDERS`), CRM Operations (`PROJ-SYS_CRM`). They hold auto-generated system tasks and are **protected from deletion** (`ProjectService.deleteProject` rejects any `PROJ-SYS_` id).
- **User-managed** — projects where a person creates and works the tasks directly, e.g. `PROJ-CONTENT` (editorial content production). These must **not** carry the `PROJ-SYS_` prefix, precisely so they stay user-deletable/editable; system tasks cannot be handled the way content tasks are.

Campaign-type projects (e.g. Core Content, `PROJ-6878357E`) are created per program and carry a `spro_CampaignId`. Schema → `DATA_MODEL.md` (`SysProjects`).

**Coverage gaps (current — a tracked fix closes these; see `.claude/bugs.md`).** Until that fix ships, some auto-created tasks do not resolve to a real project:

- **`Content`** (16 task types) maps to `PROJ-CONTENT`, which is **not yet seeded** in `SysProjects`. These tasks are still tracked operationally via their Library entity (`st_EntityId`). Fix: seed `PROJ-CONTENT` as a user-managed project (plain id, not `PROJ-SYS_`, since users own its tasks).
- **`Marketing`** (15 task types) has **no map entry**. Fix: fold into Content (add `Marketing → PROJ-CONTENT`).
- **`Data`** (2 task types) has **no map entry**. Fix: re-topic per domain — `task.data.review` (cities lookup) → `CRM` (→ `PROJ-SYS_CRM`); `task.data.coupons_update` → `Marketing` (→ Content). The `Data` topic then retires.

`Custom` (`task.project.custom`) is intentionally unmapped: user-created tasks require the user to choose a project (`WebAppTasks` rejects a missing one), so they already satisfy the rule.

### 12.1 Auto-Assignment on Creation

When `TaskService.createTask()` is called:
1. Task type config is loaded (includes `flow_pattern`, `due_pattern`)
2. If `flow_pattern` specifies initial assignee → auto-assign based on role
3. If auto-assigned, the following fields are set atomically:
   - `st_AssignedTo` = role name (Manager or Administrator)
   - `st_StartDate` = now
   - `st_Status` = 'Assigned'
   - `st_DueDate` = calculated from `due_pattern`

### 12.1.1 Flow Patterns

| Pattern | Initial Assignee | Description |
|---------|------------------|-------------|
| `admin_direct` | Administrator | Admin resolves directly |
| `manager_direct` | Manager | Manager resolves directly |
| `manager_to_admin_review` | Manager | Manager works, then hands off to Administrator on Review (e.g. `task.onboarding.add_product`, `task.validation.vintage_mismatch`) |

### 12.2 Due Date Patterns

| Pattern | Calculation |
|---------|-------------|
| `immediate` | Same day |
| `next_business_day` | +1 day, skip Fri/Sat to Sunday |
| `one_week` | +7 days |
| `two_weeks` | +14 days |

**Business Days (Israel):** Sun (0), Mon (1), Tue (2), Wed (3), Thu (4)
**Weekend:** Fri (5), Sat (6)

### 12.3 Date Field Rules

**Rule 1: Start Date on Creation**
- Only `immediate` due_pattern tasks get `st_StartDate` on creation
- Other tasks get start date when assigned

**Rule 2: Assignment Atomicity**
When a task is assigned (manually or automatically), ALL THREE fields must be set:
- `st_StartDate` = assignment time
- `st_Status` = 'Assigned'
- `st_DueDate` = calculated from due_pattern

**Invariant:** If any of these 3 fields has a value, all 3 must have values.

### 12.4 Manual Assignment

When user assigns task via UI:
1. Update `st_AssignedTo` to user email
2. Set `st_StartDate` = now (if not already set)
3. Set `st_Status` = 'Assigned'
4. Calculate and set `st_DueDate` based on task type's `due_pattern`
