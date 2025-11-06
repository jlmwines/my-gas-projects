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

**Goal:** To implement the remaining core workflows from the legacy system and build the user interface.

### 1. Packing Slip Workflow (Backend Completed)
*   **Goal:** Implement a robust, state-aware packing slip generation system that ensures consistency and manages descriptive text enrichment.
*   **Tasks:**
    1.  **Define Data Model (COMPLETED):** Added `sol_OrderStatus` to `SysOrdLog` and clarified the role of `SysPackingCache`.
    2.  **Refactor `OrderService` (COMPLETED):** Implemented the full state machine logic, including the "Lock-in" and "On-hold" rules, to set `Eligible`/`Ineligible` status in `SysOrdLog`.
    3.  **Refactor `PackingSlipService` (COMPLETED):** Logic updated to act on `Eligible` orders and set them to `Ready`.
    4.  **Refactor `PrintService` (COMPLETED):** Logic updated to act on `Ready` orders and set them to `Printed`.
    5.  **Update `WebApp.js` Backend (COMPLETED):** The `getPackableOrders` function was updated to fetch `Ready` orders from `SysOrdLog`.

### 2. Frontend UI Development (IN PROGRESS)
*   **Goal:** To build the dashboard-driven Single Page Application (SPA) that will serve as the main user interface for the JLMops system.
*   **Phase 2.1: UI Framework and Layout (IN PROGRESS)**
    *   **Goal:** Establish the foundational structure for the SPA.
    *   **Tasks:**
        1.  **Create `WebApp.js` (IN PROGRESS):** File created to serve the app and handle backend calls. Awaiting testing.
        2.  **Create `Dashboard.html` (IN PROGRESS):** Main SPA shell created. Awaiting testing.
        3.  **Integrate CSS/Routing (IN PROGRESS):** Basic styling and a simple view loader have been implemented. Awaiting testing.
*   **Phase 2.2: Packing Slip Workflow UI (IN PROGRESS)**
    *   **Goal:** Implement the user interface for the packing slip workflow as the first feature within the new SPA framework.
    *   **Tasks:**
        1.  **Create `PackingSlipView.html` (IN PROGRESS):** Partial view for the packing slip UI has been created. Awaiting testing.
        2.  **Integrate View (IN PROGRESS):** View is loaded into the dashboard via the client-side router. Awaiting testing.
*   **Phase 2.3: Impersonation for Testing (IN PROGRESS)**
    *   **Goal:** Implement a mechanism to allow developers to test the UI with different user roles.
    *   **Tasks:**
        1.  **Create `AuthService.js` (IN PROGRESS):** Service created to manage user identity and impersonation. Awaiting testing.
        2.  **Integrate Impersonation (IN PROGRESS):** `WebApp.js` updated to use the `AuthService` to set the user's identity based on URL parameters. Awaiting testing.

### 3. Packing Slip Formatting (PLANNED)
*   **Goal:** Apply professional and readable formatting to the generated Google Doc packing slips.
*   **Tasks:**
    1.  **Develop Formatting Logic:** Enhance the `PrintService` to apply styles (e.g., fonts, sizes, bolding, table layouts) to the generated Google Doc.
    2.  **Refine Template:** Update the `template.packing_slip` configuration in `SysConfig` to support more advanced layout and styling options if required.

### 4. Product Detail Update Workflow (Vintage Discrepancy) (PLANNED)
*   **Goal:** Automate the detection and task creation for vintage mismatches between Comax imports and the master data.
*   **Tasks:**
    1.  **Verify Validation Rule:** Ensure the `validation.rule.C6_Comax_VintageMismatch` rule in `SysConfig` is correctly configured.
    2.  **Verify Rule Execution:** Confirm that the `_runStagingValidation` function in `ProductService.js` correctly executes this rule during a Comax import.
    3.  **Verify Task Creation:** Ensure that the `TaskService` correctly creates a `task.validation.field_mismatch` task when a discrepancy is found.

### 4. New Product Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to manage the process of adding a new product to both Comax and WooCommerce.
*   **Tasks:**
    1.  **Detection:** Implement logic in `ProductService.js` to detect new products during a Comax import (i.e., products in the import file that do not exist in `CmxProdM`).
    2.  **Candidate Management:** Create a new sheet (`NewProductCandidates`) or similar mechanism to hold these new products for review.
    3.  **Task Generation:** Upon detection, create a parent task ("Onboard New Product: [Product Name]") and a sub-task for an admin to "Approve New Product Candidate".
    4.  **Guided Workflow:** Once approved, the system will generate a series of linked tasks to guide an admin through the manual steps (e.g., "Add Product to WooCommerce", "Set 'IsWeb' Flag in Comax").

### 5. SKU Update Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to safely manage SKU changes and prevent data mismatches between systems.
*   **Tasks:**
    1.  **Detection:** Implement logic in `ProductService.js` to detect when a product's SKU has changed during a Comax import (keyed by the stable `cpm_CmxId`).
    2.  **Task Generation:** When a change is detected for a product that is sold online, create a high-priority task in `SysTasks` (e.g., "SKU Change Detected for [Product Name]").
    3.  **Guided Action:** The task notes will instruct the admin to manually update the SKU in the WooCommerce admin panel.
    4.  **Automated Verification:** The system will monitor subsequent web product imports. When it detects that the SKU for the corresponding product has been updated in `WebProdM`, it will automatically mark the task as 'Completed'.