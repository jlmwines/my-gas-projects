## Phase 1: System Foundation & Setup (COMPLETED)

**Goal:** To establish the core technical foundation based on the user-managed configuration before any workflow logic is built.

## Phase 2: Product Workflow Engine (COMPLETED)

**Goal:** To build the complete, automated workflow for ingesting, reconciling, and validating all product data sources, replacing the legacy `ImportWebProducts.js` and `ProductUpdates.js` scripts.

## Phase 3: Initial Data Population (COMPLETED)

**Goal:** To migrate all necessary product and order data from the legacy system into the new JLMops master sheets.

## Phase 4: Order Workflow & Parallel Implementation (COMPLETED)

**Goal:** To implement the core order workflow logic while establishing a robust framework for parallel operation, data synchronization, and validation against the legacy system.

*   **Phase 4.1: Foundational Utilities for Parallel Operation (COMPLETED)**
    *   **Goal:** Built a set of safe, reusable tools to manage data during the parallel implementation phase.

*   **Phase 4.4: Implement Core Order Workflows (COMPLETED)**
    *   **Goal:** Re-implement the core business logic for order processing within the new, robust framework.
    *   **Tasks:**
        1.  **On-Hold Inventory Calculation (COMPLETED):** Implement the logic in `InventoryManagementService.js`.
        2.  **Optimize Order Upsert (COMPLETED):** Implemented faster order handling in `OrderService.js` by categorizing orders and performing targeted updates.
        3.  **Refactor WebAdapter for Configuration-Driven Line Item Parsing (COMPLETED):**
        4.  **Comax Order Export (COMPLETED - Monitoring Ongoing):** Implement the export generation logic in `OrderService.js`.
            *   **Note:** Results must be validated in parallel with the legacy system over many cycles to check for different data patterns.
        5.  **Packing Slip Data Preparation (COMPLETED):** Implement the `preparePackingData` function in `OrderService.js`.
        6.  **Web Product Inventory Export (COMPLETED - Monitoring Ongoing):** Implement the stock & price update export generation in `ProductService.js`.
            *   **Note:** Results must be validated in parallel with the legacy system over many cycles to check for different data patterns.

## Phase 5: Output Generation & Notification (COMPLETED)

**Goal:** To build the services required to format and export data for external systems like WooCommerce.

## Upcoming Implementation Priorities

**Goal:** To implement the remaining core workflows from the legacy system to reach feature parity.

### 1. Packing Slip Workflow (PLANNED)
*   **Goal:** Implement the dynamic, template-driven packing slip generation process.
*   **Tasks:**
    1.  **Implement `generatePackingSlips` function in `OrderService.js`:** This function will be triggered manually by the user from the frontend.
    2.  **Template-Driven Content:** The function will read the `PackingSlipTemplate` definition from `SysConfig`.
    3.  **Data Population:** It will use the pre-calculated data from the `SysPackingCache` sheet to populate the template for selected orders.
    4.  **Document Generation:** It will generate a single HTML string containing all selected packing slips and create one Google Doc for easy review and bulk printing.
    5.  **Status Update:** Upon successful generation, it will update the `sol_PackingStatus` in the `SysOrdLog` sheet to 'Printed'.

### 2. Product Detail Update Workflow (Vintage Discrepancy) (PLANNED)
*   **Goal:** Automate the detection and task creation for vintage mismatches between Comax imports and the master data.
*   **Tasks:**
    1.  **Verify Validation Rule:** Ensure the `validation.rule.C6_Comax_VintageMismatch` rule in `SysConfig` is correctly configured.
    2.  **Verify Rule Execution:** Confirm that the `_runStagingValidation` function in `ProductService.js` correctly executes this rule during a Comax import.
    3.  **Verify Task Creation:** Ensure that the `TaskService` correctly creates a `task.validation.field_mismatch` task when a discrepancy is found.

### 3. New Product Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to manage the process of adding a new product to both Comax and WooCommerce.
*   **Tasks:**
    1.  **Detection:** Implement logic in `ProductService.js` to detect new products during a Comax import (i.e., products in the import file that do not exist in `CmxProdM`).
    2.  **Candidate Management:** Create a new sheet (`NewProductCandidates`) or similar mechanism to hold these new products for review.
    3.  **Task Generation:** Upon detection, create a parent task ("Onboard New Product: [Product Name]") and a sub-task for an admin to "Approve New Product Candidate".
    4.  **Guided Workflow:** Once approved, the system will generate a series of linked tasks to guide an admin through the manual steps (e.g., "Add Product to WooCommerce", "Set 'IsWeb' Flag in Comax").

### 4. SKU Update Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to safely manage SKU changes and prevent data mismatches between systems.
*   **Tasks:**
    1.  **Detection:** Implement logic in `ProductService.js` to detect when a product's SKU has changed during a Comax import (keyed by the stable `cpm_CmxId`).
    2.  **Task Generation:** When a change is detected for a product that is sold online, create a high-priority task in `SysTasks` (e.g., "SKU Change Detected for [Product Name]").
    3.  **Guided Action:** The task notes will instruct the admin to manually update the SKU in the WooCommerce admin panel.
    4.  **Automated Verification:** The system will monitor subsequent web product imports. When it detects that the SKU for the corresponding product has been updated in `WebProdM`, it will automatically mark the task as 'Completed'.
