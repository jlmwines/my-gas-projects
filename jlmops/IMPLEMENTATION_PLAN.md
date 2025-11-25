## Phase 1: System Foundation & Setup (COMPLETED)

**Goal:** To establish the core technical foundation based on the user-managed configuration before any workflow logic is built.

## Phase 2: Product Workflow Engine (COMPLETED)

**Goal:** To build the complete, automated workflow for ingesting, reconciling, and validating all product data sources, replacing the legacy `ImportWebProducts.js` and `ProductUpdates.js` scripts.

### SysConfig Data Integrity & Import Functionality Restoration (COMPLETED)
*   **Goal:** Ensure the `SysConfig` sheet accurately reflects the `SetupConfig.js` source of truth and that all critical import processes are fully functional.
*   **Result:** Web Order Import, Web Product Import, Web Translation Import, and Comax Product Import functionalities are fully restored and operating as expected.

## Phase 3: Initial Data Population (COMPLETED)

**Goal:** To migrate all necessary product and order data from the legacy system into the new JLMops master sheets.

## Phase 4: Order Workflow & Parallel Implementation (COMPLETED)

**Goal:** To implement the core order workflow logic while establishing a robust framework for parallel operation, data synchronization, and validation against the legacy system.

*   **Phase 4.1: Foundational Utilities for Parallel Operation (COMPLETED)**
    *   **Goal:** Built a set of safe, reusable tools to manage data during the parallel implementation phase.

*   **Phase 4.4: Implement Core Order Workflows (COMPLETED)**
    *   **Goal:** Re-implement the core business logic for order processing within the new, robust framework.
    *   **Note:** Results must be validated in parallel with the legacy system over many cycles to check for different data patterns.

## Phase 5: UI Overhaul & Workflow Screens (IN PROGRESS)

**Goal:** To refactor the UI into a workflow-oriented design with separate screens for each major business area and user role, improving maintainability and clarity.

### 5.1. Core Navigation & Shell Update
*   **Goal:** Update the main application shell to support the new navigation structure.
*   **Tasks:**
    1.  **Home Button (IN PROGRESS):** The main "JLMops" title in the header will be converted into a "Home" link that reloads the application.
    2.  **Role-Specific Sidebar (IN PROGRESS):** The sidebar in `Dashboard.html` will be updated to dynamically display links based on user role (`admin` or `manager`).
    3.  **Cleanup (IN PROGRESS):** The "Display Orders (Test)" link will be removed. The "Comax Actions" and "Web Actions" links will be replaced by the new workflow screens.

### 5.2. Admin Screen Implementation
*   **Goal:** Build the dedicated screens for the admin user.
*   **Tasks:**
    1.  **System Health Screen (IN PROGRESS):** Create `SystemHealthView.html` to display the System Health widget (Failed Jobs, etc.).
    2.  **Orders Screen (IN PROGRESS):** Create `AdminOrdersView.html` to contain the Comax Order Export workflow.
    3.  **Inventory Screen (IN PROGRESS):** Create `AdminInventoryView.html` with three distinct sections for a complete inventory management workflow:
        *   **1. Inventory Review Table:** The primary section at the top of the screen. This table will display submitted counts from managers (i.e., tasks in 'Review' status) for an admin to process and accept. It will include selection checkboxes and processing controls.
        *   **2. Task Creation Controls:** A section for generating new count tasks. This will include:
            *   Controls to create bulk tasks for products that are below a maximum stock quantity OR have not been counted in a maximum number of days.
            *   A spot-check tool to manually create a count task for a single, specific product.
        *   **3. Open Tasks List:** A read-only table at the bottom of the screen displaying all products that are currently in the manager's queue to be counted (i.e., tasks in 'Assigned' status). This provides the admin with full visibility into the current workload.
        *   **4. Display Inventory Task Count (PLANNED):** Implement logic to display the count of 'Review' inventory tasks in `AdminInventoryWidget.html`.
    4.  **Development Screen (IN PROGRESS):** Create `DevelopmentView.html` to house the developer tools (Rebuild SysConfig, etc.).
    5.  **Product Details Screen (PLANNED):** Create a placeholder `ProductDetailsView.html`.

### 5.3. Manager Screen Implementation
*   **Goal:** Build the dedicated screens for the manager user.
*   **Tasks:**
    1.  **Inventory Screen (COMPLETED):** Create `ManagerInventoryView.html` to house manager-level inventory workflows, including Brurya warehouse inventory management and inventory count entry/submission.
        *   **Display Inventory Task Count (PLANNED):** Implement logic to display the count of 'Assigned' inventory tasks in `ManagerInventoryView.html`.
    2.  **Product Management Screen (PLANNED):** Create `ManagerProductsView.html` to serve as a unified dashboard for all manager-level product workflows.
        *   **UI Layout:** The page will feature distinct, ordered areas/widgets to prioritize manager tasks:
            *   **Area 1: New Product Suggestions (Prominent, Top of Page)**
                *   **Purpose:** To immediately highlight opportunities for new product additions and address inventory gaps.
                *   **Content:**
                    *   **Deficient Categories Summary:** Display metrics or a summary of product categories identified as having deficiencies (e.g., "Wines - 3 products needed"). This data will come from `JLMops/InventoryManagementService.js` or a new `ProductSuggestionService.js`.
                    *   **Suggested Products Table:** A filterable table listing eligible products (from Comax via `JLMops/ComaxAdapter.js`) that could fill the gaps for selected categories.
                        *   **Columns:** `Select` (checkbox), `SKU`, `Product Name`, `Category`, `Price`, `Stock`, `Web Status`.
                    *   **Action:** "Suggest Selected Products" button. This would create `New Product Suggestion` tasks in `JLMops/TaskService.js`.
            *   **Area 2: My Product Tasks (Below Suggestions)**
                *   **Purpose:** To provide access to and manage all product-related tasks assigned to the manager, including detail updates, new product entries, and product audit verifications.
                *   **Content:**
                    *   **Task List Table:** A scrollable, sortable, filterable table listing all product-related tasks currently `Assigned` to the manager (from `JLMops/TaskService.js`).
                        *   **Columns:** `Task Type` (e.g., "Update Product Details", "Enter New Product Details", "Verify Product Data"), `SKU`, `Product Name (EN)`, `Product Name (HE)`, `Vintage`, `Status`, `Assigned Date`, `Details/Notes`.
                        *   **Action:** An "Open Task" button for each row.
                *   **Action Flow:** When "Open Task" is clicked, it will open a **modal dialog** or a **fly-out panel** whose content is dynamically determined by the `Task Type`.
                    *   **Modal/Panel for "Update Product Details" or "Enter New Product Details" Tasks:**
                        *   **Header:** Dynamically display `SKU`, `Product Name (English)`, `Vintage (CMX YEAR)`, and `Product Name (Hebrew)`.
                        *   **Navigation:** "Previous" and "Next" buttons (if managing multiple tasks sequentially).
                        *   **Tabbed Interface:** The content will feature a **tabbed layout** (replicating the legacy `DetailsForm.html`):
                            1.  **Descriptions Tab:** Fields for Short/Long Descriptions (HE/EN).
                            2.  **Specs Tab:** Editable fields for `Region`, `ABV`. Read-only for `Size`, `Division`, `Group`, `Year`.
                            3.  **Attributes Tab:** Editable fields for `Intensity`, `Complexity`, `Acidity`, `Decant`.
                            4.  **Pairing Tab:** Checkboxes for `Harmonize With` and `Contrast With`.
                            5.  **Grapes Tab:** Dropdowns for `Grape 1` through `Grape 5`.
                            6.  **Kashrut Tab:** Checkbox for `Heter Mechira`, dropdowns for `Kashrut 1` through `Kashrut 5`.
                            7.  **Preview Tab:** Dynamically generated English and Hebrew product descriptions.
                        *   **Action Buttons:** "Submit for Review", "Close".
                    *   **Modal/Panel for "Verify Product Data" Tasks:**
                        *   **Content:** A new, dedicated single-page summary view for product audit verification.
                        *   **Purpose:** Display a comprehensive summary of the wine's data from `JLMops/ProductService.js` (master data), potentially external web data, and physical product details.
                        *   **Layout:** Sections for:
                            *   **Basic Info:** `SKU`, `Product Name (EN/HE)`, `Vintage`, `ABV`, `Region`.
                            *   **Key Descriptors:** `Short Description`, `Long Description`, `Intensity`, `Complexity`, `Acidity`, `Harmonize With`, `Contrast With`.
                            *   **Categorization:** `Grapes (G1-G5)`, `Kashrut (K1-K5)`, `Heter Mechira`.
                            *   **Verification Status:** This section would allow the manager to indicate their verification findings (e.g., checkboxes "Matches Web Data", "Matches Physical Product", "Requires Correction", "Verified Date", "Verifier Comments").
                        *   **Action Buttons:** "Mark as Verified", "Create Correction Task", "Close".
            *   **Area 3: Product Status/Search (Optional Utility Widget)**
                *   **Purpose:** A read-only search and display area for any product's details and current JLMops workflow status.
                *   **Content:** A search bar (by SKU or Name) and a display area for read-only product information from `JLMops/ProductService.js`.

### 5.4. UI/WebApp Architecture Refactoring (IN PROGRESS)
*   **Goal:** To refactor the UI controller layer to align with the flexible patterns defined in `ARCHITECTURE.md`.
*   **Architectural Model:** For role-based workflows with distinct screens but shared data (like Inventory), work will follow the **Shared View Controller** pattern. This means that related views (e.g., `AdminInventoryView.html`, `ManagerInventoryView.html`) will be supported by a single, shared controller script (e.g., `WebAppInventory.js`). This approach reduces file count while relying on clear function naming to maintain organization. For standalone views, the **Dedicated View Controller** pattern will be used.

### 5.5. UI Authentication & User Switching (COMPLETED)
*   **Goal:** Implement a robust and flexible UI control for user authentication and role switching, leveraging a proven pattern for dynamic content loading.
*   **Resolution:** The previous issue of user-specific content not loading correctly has been resolved by implementing a client-side content loading mechanism, ensuring that all initial and subsequent content is fetched and rendered via `google.script.run`.

## Phase 6: Workflow Integrity & UI Orchestration (CURRENT)

**Goal:** To evolve the current UI into a state-aware dashboard that provides visibility and guided control over the system's interdependent workflows. This will be achieved by enhancing the existing UI and backend services, not by redesigning them.

### 6.1. Core Architectural Principle

The system will formally adopt a **"System-State-Aware Workflow Orchestration"** model. The `OrchestratorService` will serve as the single source of truth for workflow status. The UI will act as a "dumb" but responsive dashboard that reflects the state managed by the backend, disabling or enabling user actions based on that state.

### 6.2. Backend Implementation Plan

*   **Job & Dependency Definition (`SysConfig`)**:
    *   New, non-file-based jobs for each export process (e.g., `export.comax.orders`, `export.web.inventory`) will be defined in `SysConfig`.
    *   The `depends_on` property will be used to enforce execution order. Specifically, the `Comax Product Import` job will `depend_on` the `Web Product Import` job.

*   **State-Based Job & Task Creation (`OrchestratorService`)**:
    *   The service's responsibilities will be extended beyond file-based triggers. It will programmatically create tasks based on system state.
    *   A **Task** is a simple flag indicating work is ready; it does not store data and does not need to be updated if already open.

*   **New Trigger Logic (`OrchestratorService`)**:
    *   **Comax Order Export Trigger:** Upon completion of a `Web Order Import` job, the orchestrator will check if a "Comax Order Export" task is open. If not, it will create one.
    *   **Web Inventory Export Trigger:** Upon completion of *either* a `Web Product Import` or a `Comax Product Import` job, the orchestrator will perform a "paired check." It will verify that its counterpart job has also recently completed. If this condition is met, it will then check if a "Web Inventory Export" task is open and create one if it is not.

### 6.3. Frontend/UI Implementation Plan

The existing dashboard widgets will be enhanced to:

*   **Display Workflow Status:** Each widget associated with a major workflow (Orders, Inventory) will include a status area that displays the real-time state from the `OrchestratorService` (e.g., "Status: Ready to Export 15 Orders to Comax," "Status: Waiting for Web Product Import").
*   **Implement Action Gating:** UI controls (buttons, links) for initiating actions will be dynamically enabled or disabled based on the workflow state. A user will not be able to click "Export to Comax" if the system is not in a `ReadyForComaxExport` state.
*   **Implement State-Aware Widget Workflows (COMPLETED):**
    *   **Summary:** Refactored widget data supply and implemented state-aware UI controls for Comax Order Export and Web Inventory Export workflows, including dependency messaging and fixing data supply for the Inventory widget.

## Phase 7: Future Implementation Priorities (PLANNED)

**Goal:** To implement the remaining core workflows from the legacy system.

### 1. Packing Slip Workflow (Backend Completed)
*   **Goal:** Implement a robust, state-aware packing slip generation system that ensures consistency and manages descriptive text enrichment.

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
*   **Phase 2.3: Impersonation for Testing (INPROGRESS)**
    *   **Goal:** Implement a mechanism to allow developers to test the UI with different user roles.
    *   **Tasks:**
        1.  **Create `AuthService.js` (IN PROGRESS):** Service created to manage user identity and impersonation. Awaiting testing.
        2.  **Integrate Impersonation (IN PROGRESS):** `WebApp.js` updated to use the `AuthService` to set the user's identity based on URL parameters. Awaiting testing.

### 3. Packing Slip Formatting & Generation (COMPLETED)
*   **Goal:** To generate professional, readable, and consistent packing slips by leveraging robust Google Doc templates, ensuring continuity with the legacy system's output format.

### 4. Customer Note Implementation (IN PROGRESS - Awaiting Data for Testing)
*   **Goal:** To provide a UI for handling customer notes and creating individual, editable Google Docs for gift messages.

### 5. Inventory Management Workflows (PLANNED)
*   **Goal:** To fully integrate and manage all inventory-related processes within `jlmops`, including physical counts, audits, and synchronization with Comax, using a task-based workflow.
*   **Tasks:**
            1.  **Brurya Warehouse Inventory Management:** Implement a dedicated manager UI and backend logic for managing Brurya-specific stock levels.
                *   **UI:** A web-based screen featuring a table of products currently in Brurya inventory.
                    *   **Table Columns:** `Product Name` (read-only), `SKU` (read-only), `Quantity` (editable number input).
                    *   **"Add Product" Tool:** A search box labeled "Add Product" to find and add new items by SKU or name.
                *   **Workflow:** Managers can edit quantities directly in the table, add new products via the search tool, or remove products by setting their quantity to `0`. All changes will be saved via a single "Save Changes" button, which updates the `BruryaQty` in the `SysProductAudit` sheet.    2.  **Low Inventory Task Creation:** Implement logic to automatically identify low-stock items (based on configurable thresholds) and generate tasks for review or reorder.
    3.  **Negative Inventory Task Follow-up:** Implement logic to detect negative stock levels and create high-priority tasks for investigation and correction.
    4.  **Inventory Count Workflow (Single Task Type):** Implement a unified task type with a defined workflow to manage the entire lifecycle of inventory counts.
        *   **Entry/Submission (IN PROGRESS):** Provide an enhanced UI for managers to enter and submit physical inventory counts.
            *   The UI will feature a table displaying all products assigned for counting, with data sourced from `CmxProdM` (for Product Name) and `SysProductAudit` (for quantities).
            *   The table columns will be: `Comax Qty` (read-only `pa_ComaxQty`), `Total` (read-only calculated sum), `Brurya` (read-only `pa_BruryaQty`), `Storage` (editable `pa_StorageQty`), `Office` (editable `pa_OfficeQty`), `Shop` (editable `pa_ShopQty`), `SKU`, `Product Name` (right-justified), and a `Checkbox`.
            *   Client-side scripting will provide an intuitive workflow: editing a quantity in any of the editable columns will automatically check that row's checkbox.
            *   A "Submit Selected Counts" button will allow for partial submissions of all entered counts.
        *   **Review/Acceptance:** Provide a UI for admins to review and accept submitted counts.
            *   The screen will be nearly identical to the manager's view, showing a consolidated list of all products in 'Review' status.
            *   Quantity fields will be read-only, displaying the manager's submitted counts.
            *   Each row will have a checkbox, and a "Select All" control will be available.
            *   A "Process Selected Counts" button will trigger the acceptance, updating the underlying tasks to a final state (e.g., 'Completed').
            *   Upon successful submission, the user will be redirected to the main dashboard to handle the next step of the workflow (exporting the adjustments).
        *   **Export to Comax/Confirm:** After a count is accepted, trigger the generation of an export file for Comax and a corresponding confirmation task.
        *   **Note:** This requires a new task definition in the master configuration and new logic in the inventory and task services.

### 6. Comax Inventory Export (IN PROGRESS - Backend Implemented, Testing)
*   **Goal:** To generate a simple CSV file of SKU and count for export to the Comax system.

### 6. Enhanced Product Detail Verification (PLANNED)
*   **Goal:** To provide a comprehensive, task-based workflow for managers to review and verify product details, including images, facts, and overall appearance.
*   **Tasks:
    1.  **UI Development:** Create a new UI view that displays a list of products requiring verification.
    2.  **Product Display:** For each product, display relevant details (e.g., name, SKU, current image URL, key attributes).
    3.  **Checklist Integration:** Implement an interactive checklist for managers to mark verification status for various details.
    4.  **Submission & Status Update:** Implement backend logic to update the product's verification status upon submission.
    5.  **Task Integration:** Ensure this UI is linked to "Verify Product Details" tasks.

### 7. Propose New Products to Fill Gaps (PLANNED)
*   **Goal:** To proactively identify product categories with low inventory and prompt managers to propose new products to fill these gaps, integrating with the "Onboard New Product" workflow.
*   **Tasks:
    1.  **Gap Detection Logic:** Implement logic to monitor inventory levels and identify categories with low stock.
    2.  **Manager Notification/Prompt:** Generate tasks and provide a UI to highlight these categories.
    3.  **Integration with New Product Workflow:** Allow managers to directly initiate the "Onboard New Product" workflow from the gap analysis UI.

### 8. Product Detail Update Workflow (Vintage Discrepancy) (PLANNED)
*   **Goal:** Automate the detection and task creation for vintage mismatches between Comax imports and the master data.
*   **Tasks:
    1.  **Verify Validation Rule:** Ensure the vintage mismatch validation rule is correctly configured in the master configuration.
    2.  **Verify Rule Execution:** Confirm that the staging validation function in the product service correctly executes this rule during a Comax import.
    3.  **Verify Task Creation:** Ensure that the task service correctly creates a field mismatch task when a discrepancy is found.

### 9. New Product Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to manage the process of adding a new product to both Comax and WooCommerce.
*   **Tasks:
    1.  **Detection:** Implement logic in the product service to detect new products during a Comax import.
    2.  **Candidate Management:** Create a new sheet or similar mechanism to hold these new products for review.
    3.  **Task Generation:** Upon detection, create a parent task and a sub-task for an admin to approve the new product.
    4.  **Guided Workflow:** Once approved, the system will generate a series of linked tasks to guide an admin through the required manual steps.

### 10. SKU Update Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to safely manage SKU changes and prevent data mismatches between systems.
*   **Tasks:
    1.  **Detection:** Implement logic in the product service to detect when a product's SKU has changed during a Comax import.
    2.  **Task Generation:** When a change is detected for a product that is sold online, create a high-priority task.
    3.  **Guided Action:** The task notes will instruct the admin to manually update the SKU in the corresponding external system.
    4.  **Automated Verification:** The system will monitor subsequent imports and automatically mark the task as 'Completed' once the change is verified.

## Go-Live Readiness

### 1. Failed Job Handling (PLANNED)
*   **Goal:** To ensure that any failed job in the `SysJobQueue` automatically generates a high-priority task for an administrator to investigate.
*   **Tasks:**
    1.  **Configuration:** Add a new high-priority task definition for "Job Failed" to the master configuration.
    2.  **Orchestration:** Modify the job processing function to automatically create a "Job Failed" task when a job's status is set to FAILED.

## Phase 9: Admin & Developer Experience (IN PROGRESS)

**Goal:** To improve the administrator and developer experience by providing dedicated tools for system management, validation, and data migration.

### 9.1. Implement Development Tools UI (IN PROGRESS)
*   **Goal:** To build a new "Development Tools" screen in the admin UI that provides simple, grouped actions with appropriate safety checks and on-screen results.
*   **UI Layout:**
    *   The `DevelopmentView.html` will be updated with three sections: Configuration, Validation, and Migration.
    *   A new "Results" panel will be added within the Validation section to display on-screen feedback from the triggered functions.
*   **Configuration Management:**
    *   **Rebuild SysConfig from Source:**
        *   **UI:** A button to trigger the rebuild.
        *   **Backend Function:** Triggers the existing `rebuildSysConfigFromSource` function.
        *   **Confirmation:** Yes.
        *   **Confirmation Text:** "Rebuild Sysconfig?"
*   **Legacy Validation Engine:**
    *   **UI:** The validation section will be updated to have three domain-specific buttons.
    *   **Button: "Validate Legacy Orders"**
        *   **Action:** Executes a comprehensive validation of all order-related data.
        *   **Checks:** Highest Order Number, Packing Slip Data, and Comax Order Export CSVs.
        *   **UI Feedback:** A consolidated report from all checks will be displayed.
    *   **Button: "Validate Legacy Inventory"**
        *   **Action:** Executes a comprehensive validation of all inventory-related data.
        *   **Checks:** On-Hold Inventory and the Web Product/Inventory Export CSVs.
        *   **UI Feedback:** A consolidated report from both checks will be displayed.
    *   **Button: "Validate Legacy Products"**
        *   **Action:** Executes a comprehensive validation of all product master data.
        *   **Checks:** Product Counts, Translation Counts, and ID/SKU matching between legacy and jlmops.
        *   **UI Feedback:** A full report with counts and a list of any ID/SKU discrepancies will be displayed.
*   **Data Migration (from Legacy):**
    *   **Migrate Legacy Product Details:**
        *   **UI:** A button to migrate product details.
        *   **Backend Function:** Triggers the existing `migrateProductDetails` function.
        *   **Confirmation:** Yes.
        *   **Confirmation Text:** "Migrate Product Data?"
    *   **Migrate Legacy Order History:**
        *   **UI:** A button to migrate order history.
        *   **Backend Function:** Triggers the existing `migrateOrderHistory` function.
        *   **Confirmation:** Yes.
        *   **Confirmation Text:** "Migrate Order Data?"

## Phase 8: Architectural Refactoring (PLANNED)

**Goal:** To improve the long-term safety and maintainability of the system by refactoring core components and workflows.

### 8.1. Refactor SysConfig Management
*   **Goal:** To replace the error-prone manual editing of `SetupConfig.js` with a safer, configuration-driven build process.
*   **Architecture:**
    1.  The master configuration will be moved from a hardcoded array in `SetupConfig.js` to a dedicated `jlmops/SysConfig.json` file.
    2.  A new Node.js script (`generate-config.js`) will be created to read `SysConfig.json` and generate the `jlmops/SetupConfig.js` file.
    3.  `SetupConfig.js` will become a machine-generated artifact and will no longer be edited manually.
*   **Tasks:**
    1.  **Create `SysConfig.json` (COMPLETED):** Extract the current configuration from `SetupConfig.js` and convert it into a structured JSON format.
    2.  **Create `generate-config.js` (COMPLETED):** Develop the Node.js script that performs the JSON-to-JS conversion.
    3.  **Update Documentation (COMPLETED):** `ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` have been updated to reflect this new architecture.
    4.  **Update Developer Workflow (COMPLETED):** Document the new local development workflow (edit JSON, run generator script, commit both files).

### 8.2. Standardize System Logging (COMPLETED)
*   **Goal:** To ensure all logging across the application is consistent, meaningful, and conforms to the `LoggerService` standard. This improves traceability and reduces log noise.

### 8.3. Validation Service Optimization & Bug Fix (COMPLETED)
*   **Goal:** To improve the performance and correctness of the validation engine.

### 6.4. Orchestration and Service Layer Bug Fixes (COMPLETED)

*   **Goal:** To resolve critical runtime errors and improve the robustness of the job orchestration engine.
