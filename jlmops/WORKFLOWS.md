
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
