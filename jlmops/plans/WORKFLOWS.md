
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

## 12. Task Assignment & Dates

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
| `manager_to_admin_review` | Manager | Manager works, admin reviews |
| `manager_suggestion` | (none) | Manager creates, admin approves |

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
