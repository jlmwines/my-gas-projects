## Phase 1: System Foundation & Setup (COMPLETED)

**Goal:** To establish the core technical foundation based on the user-managed configuration before any workflow logic is built.

## Phase 2: Product Workflow Engine (COMPLETED)

**Goal:** To build the complete, automated workflow for ingesting, reconciling, and validating all product data sources, replacing the legacy `ImportWebProducts.js` and `ProductUpdates.js` scripts.

### SysConfig Data Integrity & Import Functionality Restoration (COMPLETED)
*   **Goal:** Ensure the `SysConfig` sheet accurately reflects the `SetupConfig.js` source of truth and that all critical import processes are fully functional.
*   **Details:**
    *   Resolved issues with `ConfigService.js` failing to correctly parse `scf_Pxx` parameters from `SysConfig` rows.
    *   Corrected missing `system.sheet_names` entries in `SetupConfig.js` for `WebXltM`, `CmxProdM`, and `SysInventoryOnHold`.
    *   Addressed and deduplicated `task.validation.name_mismatch` and `task.validation.comax_internal_audit` task definitions in `SetupConfig.js`.
    *   Ensured `_getTaskDefinitionsConfig()` is properly included in `getMasterConfiguration()`.
    *   **Result:** Web Order Import, Web Product Import, Web Translation Import, and Comax Product Import functionalities are fully restored and operating as expected.

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
            *   **Resolution:** `SysConfig`-related data access issues for packing slips resolved. This includes ensuring correct SKU-to-WebIdEn lookups and addressing a timing issue with spreadsheet updates.
        6.  **Web Product Inventory Export (COMPLETED - Monitoring Ongoing):** Implement the stock & price update export generation in `ProductService.js`.
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
    3.  **Inventory Screen (IN PROGRESS):** Create `AdminInventoryView.html` to contain the Product Count Export workflow.
    4.  **Development Screen (IN PROGRESS):** Create `DevelopmentView.html` to house the developer tools (Rebuild SysConfig, etc.).
    5.  **Product Details Screen (PLANNED):** Create a placeholder `ProductDetailsView.html`.

### 5.3. Manager Screen Implementation
*   **Goal:** Build the dedicated screens for the manager user.
*   **Tasks:**
    1.  **Inventory Screen (IN PROGRESS):** Create `ManagerInventoryView.html` to house the inventory count input workflow.

### 5.4. UI/WebApp Architecture Refactoring (IN PROGRESS)
*   **Goal:** To refactor the UI controller layer to align with the formal architecture defined in `ARCHITECTURE.md, Section 2.1.1`.
*   **Architectural Model:** All work follows the **View Controller / Data Provider** model.
*   **Tasks:**
    1.  **Create Data Provider (`WebAppTasks.js`) (COMPLETED):** Created a new data provider for task-related data and actions.
    2.  **Create View Controller (`WebAppDashboard.js`) (COMPLETED):** Created a new view controller for the main dashboard.
    3.  **Refactor `WebApp.js` (IN PROGRESS):** Moved `getDashboardData` to its view controller and refactored multiple functions to use the new `WebAppTasks.js` data provider.
    4.  **Future Tasks (PLANNED):** Continue creating new View Controller and Data Provider scripts and migrating logic from `WebApp.js` as new UI views are developed.

### 5.5. UI Authentication & User Switching (COMPLETED)
*   **Goal:** Implement a robust and flexible UI control for user authentication and role switching, leveraging a proven pattern for dynamic content loading.
*   **Tasks:**
    1.  **Refactor `AuthService.js` (COMPLETED):** Replaced the old, complex impersonation logic with a simplified service that reads user roles directly from `SysConfig`.
    2.  **Implement UI Control (COMPLETED):** Integrated a role-switcher dropdown into `AppView.html` that dynamically loads content and adjusts navigation based on the selected user's role.
    3.  **Resolve Known Issue (COMPLETED):** The previous issue of user-specific content not loading correctly has been resolved by implementing a client-side content loading mechanism, ensuring that all initial and subsequent content is fetched and rendered via `google.script.run`.

## Upcoming Implementation Priorities

**Goal:** To implement the remaining core workflows from the legacy system.

### 1. Packing Slip Workflow (Backend Completed)
*   **Goal:** Implement a robust, state-aware packing slip generation system that ensures consistency and manages descriptive text enrichment.
*   **Tasks:**
    1.  **Define Data Model (COMPLETED):** Added `sol_OrderStatus` to `SysOrdLog` and clarified the role of `SysPackingCache`.
    2.  **Refactor `OrderService` (COMPLETED):** Implemented the full state machine logic, including the "Lock-in" and "On-hold" rules, to set `Eligible`/`Ineligible` status in `SysOrdLog`.
    3.  **Refactor `PackingSlipService` (COMPLETED):** Logic updated to act on `Eligible` orders and set them to `Ready`.
    4.  **Refactor `PrintService` (COMPLETED):** Logic updated to act on `Ready` orders and set them to `Printed`.
    5.  **Update `WebApp.js` Backend (COMPLETED):** The `getPackableOrders` function was updated to fetch `Ready` orders from `SysOrdLog`.
    *   **Resolution:** `spc_WebIdEn` population issue and underlying timing problem resolved, ensuring accurate packing slip data.

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

### 3. Packing Slip Formatting & Generation (COMPLETED)
*   **Goal:** To generate professional, readable, and consistent packing slips by leveraging robust Google Doc templates, ensuring continuity with the legacy system's output format.
*   **Design Rationale (Correction):** The initial `jlmops` implementation incorrectly pivoted to using Google Sheet templates. This has been corrected. The system will now follow the true legacy method of using a pre-formatted **Google Doc** as a WYSIWYG template. This template will be copied and populated with data from `SysPackingCache`, combining the robust data assembly of the new system with the proven output format of the old system.
*   **Tasks:**
    1.  **Data Preparation (`PackingSlipService.js`): (COMPLETED)**
        *   **Objective:** Ensure `SysPackingCache` contains all necessary order and product details for packing slip generation.
    2.  **Packing Slip Generation (`PrintService.js`): (COMPLETED)**
        *   **Objective:** Modify the `printPackingSlips` function to copy a **Google Doc** template, populate it with data from `SysPackingCache` by replacing placeholders and building tables, and save the result as a new Google Doc in the designated output folder.

### 4. Customer Note Implementation (IN PROGRESS - Awaiting Data for Testing)
*   **Goal:** To provide a UI for handling customer notes and creating individual, editable Google Docs for gift messages.
*   **Tasks:
    1.  **Gift Message Creation (`WebApp.js`): (COMPLETED)**
        *   **Objective:** Add a new server-side function to create individual, editable Google Docs for gift messages.
        *   **Action:** Add a new global function `createGiftMessageDoc(orderId, noteContent)` to `WebApp.js`.
    2.  **UI Updates (`WebApp.js` & `PackingSlipView.html`): (COMPLETED)**
        *   **Objective:** Adapt the client-side and server-side functions to handle the new return format and provide UI for customer notes and gift message creation.

### 5. Comax Inventory Export (IN PROGRESS - Backend Implemented, Testing)
*   **Goal:** To generate a simple CSV file of SKU and count for export to the Comax system.
*   **Status Update:**
    *   **Data Model Foundation (COMPLETED):** `SysProductAudit` sheet defined in `SetupConfig.js` with `pa_CmxId` and wide-format columns.
    *   **Comax Product Import Integration (COMPLETED):** `ProductService.js` modified to maintain `SysProductAudit` with latest `pa_CmxId` and `pa_SKU` during Comax product imports.
    *   **Brurya Inventory Management Backend (COMPLETED):** `InventoryManagementService.js` updated with `getBruryaStock()` and `setBruryaStock()` functions.
    *   **Brurya Inventory Management UI (COMPLETED):** `BruryaInventoryView.html` and `WebApp.js` integration for manager-controlled Brurya stock updates.
    *   **Testing (IN PROGRESS):** Currently testing the `SysProductAudit` maintenance and Brurya UI.
*   **Tasks (Remaining):**
    1.  **Develop Export Logic:** Implement a new function (e.g., in `InventoryManagementService.js` or `PrintService.js`) that reads current inventory data from `SysProductAudit` and generates a CSV string with `SKU` and `Count`.
    2.  **File Creation:** Create a new CSV file in a designated Google Drive export folder.
    3.  **UI Integration:** Provide a UI element (e.g., a button on an inventory management page) to trigger this export.

### 6. Enhanced Product Detail Verification (PLANNED)
*   **Goal:** To provide a comprehensive, task-based workflow for managers to review and verify product details, including images, facts, and overall appearance.
*   **Tasks:
    1.  **UI Development:** Create a new UI view (e.g., `ProductDetailVerificationView.html`) that displays a list of products requiring verification.
    2.  **Product Display:** For each product, display relevant details (e.g., `wdm_NameEn`, `wdm_SKU`, current image URL, key attributes).
    3.  **Checklist Integration:** Implement an interactive checklist for managers to mark verification status for:
        *   Image accuracy and quality.
        *   Fact accuracy (e.g., `wdm_Intensity`, `wdm_Acidity`).
        *   Overall appearance/presentation on the web.
    4.  **Submission & Status Update:** Implement backend logic (e.g., in `ProductService.js`) to update `wdm_LastVerifiedTimestamp` and potentially a new `wdm_VerificationStatus` field in `WebDetM` upon submission.
    5.  **Task Integration:** Ensure this UI is linked to "Verify Product Details" tasks generated by the `OrchestratorService`.

### 7. Propose New Products to Fill Gaps (PLANNED)
*   **Goal:** To proactively identify product categories with low inventory and prompt managers to propose new products to fill these gaps, integrating with the "Onboard New Product" workflow.
*   **Tasks:
    1.  **Gap Detection Logic:** Implement logic (e.g., in `InventoryManagementService.js` or a new `ProductGapService.js`) to:
        *   Monitor inventory levels across product categories.
        *   Identify categories where a significant number of products are consistently low in stock or out of stock.
        *   Potentially analyze sales data to identify popular categories with unmet demand.
    2.  **Manager Notification/Prompt:**
        *   Generate a task (e.g., "Review Product Gaps in [Category Name]") for managers.
        *   Provide a UI (e.g., a new view or a section on the dashboard) that highlights these categories and lists potential product types or attributes that could fill the gaps.
    3.  **Integration with New Product Workflow:** From this UI, allow managers to directly initiate the "Onboard New Product" workflow, pre-populating some details based on the identified gap.

### 8. Product Detail Update Workflow (Vintage Discrepancy) (PLANNED)
*   **Goal:** Automate the detection and task creation for vintage mismatches between Comax imports and the master data.
*   **Tasks:
    1.  **Verify Validation Rule:** Ensure the `validation.rule.C6_Comax_VintageMismatch` rule in `SysConfig` is correctly configured.
    2.  **Verify Rule Execution:** Confirm that the `_runStagingValidation` function in `ProductService.js` correctly executes this rule during a Comax import.
    3.  **Verify Task Creation:** Ensure that the `TaskService` correctly creates a `task.validation.field_mismatch` task when a discrepancy is found.

### 9. New Product Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to manage the process of adding a new product to both Comax and WooCommerce.
*   **Tasks:
    1.  **Detection:** Implement logic in `ProductService.js` to detect new products during a Comax import (i.e., products in the import file that do not exist in `CmxProdM`).
    2.  **Candidate Management:** Create a new sheet (`NewProductCandidates`) or similar mechanism to hold these new products for review.
    3.  **Task Generation:** Upon detection, create a parent task ("Onboard New Product: [Product Name]") and a sub-task for an admin to "Approve New Product Candidate".
    4.  **Guided Workflow:** Once approved, the system will generate a series of linked tasks to guide an admin through the manual steps (e.g., "Add Product to WooCommerce", "Set 'IsWeb' Flag in Comax").

### 10. SKU Update Workflow (PLANNED)
*   **Goal:** Create a guided, task-based workflow to safely manage SKU changes and prevent data mismatches between systems.
*   **Tasks:
    1.  **Detection:** Implement logic in `ProductService.js` to detect when a product's SKU has changed during a Comax import (keyed by the stable `cpm_CmxId`).
    2.  **Task Generation:** When a change is detected for a product that is sold online, create a high-priority task in `SysTasks` (e.g., "SKU Change Detected for [Product Name]").
    3.  **Guided Action:** The task notes will instruct the admin to manually update the SKU in the WooCommerce admin panel.
    4.  **Automated Verification:** The system will monitor subsequent web product imports. When it detects that the SKU for the corresponding product has been updated in `WebProdM`, it will automatically mark the task as 'Completed'.

## Go-Live Readiness

### 1. Failed Job Handling (PLANNED)
*   **Goal:** To ensure that any failed job in the `SysJobQueue` automatically generates a high-priority task for an administrator to investigate.
*   **Tasks:**
    1.  **SysConfig:** Add a new task definition to `SetupConfig.js` for `task.system.job_failed`. This task should have a `High` priority.
    2.  **OrchestratorService:** Modify the `processPendingJobs` function in `OrchestratorService.js`. In the `catch` block where a job's status is set to `FAILED`, add a call to `TaskService.createTask` to generate the new "Job Failed" task.

## Identified SysConfig Additions (November 10, 2025)

The following configuration settings were identified as legitimate additions to `SetupConfig.js` after the `6e5caba` commit and will be preserved during the restoration process. They will be formatted in the correct multi-line block structure.

### 1. Printing Configuration

```javascript
['_section.08_Printing', 'Configurations for printing documents.', '', '', '', '', '', '', '', '', '', '', ''],
['printing.templates.folder_id', 'The Google Drive Folder ID for printing templates.', 'stable', 'id', '1dUSbbkNCrGbVUpZnmoa0D_e5zib9HaXe', '', '', '', '', '', '', '', ''],
['printing.packingslip.default_template_id', 'The Google Doc ID for the default packing slip template.', 'stable', 'id', '1z3VocTeR_PbLMtQp94dg2JuIb-Z3EOVoZVgS0zMmAMw', '', '', '', '', '', '', '', ''],
['printing.note.default_template_id', 'The Google Doc ID for the default note template.', 'stable', 'id', '1_E2uUq0b5jsIfrdvMorUDF2Hweqm4JFvS-GkliEFXKg', '', '', '', '', '', '', '', ''],
['printing.output.folder_id', 'The Google Drive Folder ID for printed documents output.', 'stable', 'id', '1eUQtr15O_NT0Ow4GUi1icBvpDwGJQf23', '', '', '', '', '', '', '', '']
```

### 2. Product Audit Schema

```javascript
['schema.data.SysProductAudit', 'Schema for the Product Audit sheet (wide format).', 'stable', 'headers', 'pa_CmxId,pa_SKU,pa_LastCount,pa_ComaxQty,pa_NewQty,pa_BruryaQty,pa_StorageQty,pa_OfficeQty,pa_ShopQty,pa_LastDetailUpdate,pa_LastDetailAudit', '', '', '', '', '', '', '', ''],
['schema.data.SysProductAudit', 'Schema for the Product Audit sheet (wide format).', 'stable', 'key_column', 'pa_CmxId', '', '', '', '', '', '', '', '']
```

### 3. Updated Order Schemas

#### `schema.data.SysOrdLog`

```javascript
['schema.data.SysOrdLog', 'Schema for System Order Log sheet.', 'stable', 'headers', 'sol_OrderId,sol_OrderDate,sol_OrderStatus,sol_PackingStatus,sol_PackingPrintedTimestamp,sol_ComaxExportStatus,sol_ComaxExportTimestamp', '', '', '', '', '', '', '', ''],
['schema.data.SysOrdLog', 'Schema for System Order Log sheet.', 'stable', 'key_column', 'sol_OrderId', '', '', '', '', '', '', '', '']
```

#### `schema.data.SysPackingCache`

```javascript
['schema.data.SysPackingCache', 'Schema for System Packing Cache sheet.', 'stable', 'headers', 'spc_OrderId,spc_WebIdEn,spc_SKU,spc_Quantity,spc_NameEn,spc_NameHe,spc_Intensity,spc_Complexity,spc_Acidity,spc_Decant,spc_HarmonizeEn,spc_ContrastEn,spc_HarmonizeHe,spc_ContrastHe,spc_GrapeG1Text,spc_GrapeG2Text,spc_GrapeG3Text,spc_GrapeG4Text,spc_GrapeG5Text,spc_KashrutK1Text,spc_KashrutK2Text,spc_KashrutK3Text,spc_KashrutK4Text,spc_KashrutK5Text,spc_HeterMechiraText,spc_IsMevushalText,spc_PrintedFlag,spc_PrintedTimestamp,spc_ReprintCount', '', '', '', '', '', '', '', ''],
['schema.data.SysPackingCache', 'Schema for System Packing Cache sheet.', 'stable', 'key_column', 'spc_OrderId', '', '', '', '', '', '', '', '']
```

### 4. Comax Export Confirmation Task

```javascript
['task.confirmation.comax_export', 'Task to confirm Comax order export has been processed.', 'stable', 'topic', 'System', '', '', '', '', '', '', '', ''],
['task.confirmation.comax_export', 'Task to confirm Comax order export has been processed.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
['task.confirmation.comax_export', 'Task to confirm Comax order export has been processed.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', '']
```