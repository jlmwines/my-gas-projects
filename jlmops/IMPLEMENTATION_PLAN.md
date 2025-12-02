## 0. CRITICAL WORKFLOW: SysConfig Management

*   **Goal:** To replace the error-prone manual editing of `SetupConfig.js` with a safer, configuration-driven build process.
*   **Architecture:**
    1.  The master configuration is stored in `jlmops/SysConfig.json`.
    2.  A Node.js script (`generate-config.js`) reads `SysConfig.json` and generates the `jlmops/SetupConfig.js` file.
    3.  `SetupConfig.js` is a machine-generated artifact and must not be edited manually.
*   **Developer Workflow:**
    1.  To make configuration changes, edit `jlmops/SysConfig.json`.
    2.  Run the `node generate-config.js` script.
    3.  Commit both `jlmops/SysConfig.json` and the generated `jlmops/SetupConfig.js`.

## Recent Completions (Phases 1-4)

*   **Phase 1: System Foundation & Setup (COMPLETED):** Established the core technical foundation and user-managed configuration.
*   **Phase 2: Product Workflow Engine (COMPLETED):** Built the automated workflow for ingesting, reconciling, and validating product data. Restored SysConfig data integrity and import functionality.
*   **Phase 3: Initial Data Population (COMPLETED):** Migrated product and order data from the legacy system.
*   **Phase 4: Order Workflow & Parallel Implementation (COMPLETED):** Implemented core order logic, packing slip generation, and parallel operation utilities.

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
    3.  **Inventory Screen (COMPLETED - Display Showing, Acceptance/Export/Confirm Sequence Next):** Create `AdminInventoryView.html` with three distinct sections for a complete inventory management workflow. The 'Inventory Review Table' has been implemented, including data fetching from backend, display with selection controls, and backend logic for processing selected tasks (updating `pa_NewQty`, `pa_LastCount`, and task statuses). Frontend UI bugs have been addressed, including checkbox functionality and "check all" control.
        *   **1. Inventory Review Table (COMPLETED):** The primary section at the top of the screen. This table displays submitted counts from managers (i.e., tasks in 'Review' status) for an admin to process and accept.
        *   **2. Inventory Acceptance Logic (COMPLETED):**
            *   **Goal:** Admins can now process and accept submitted inventory counts, which updates `pa_LastCount` and marks associated tasks as `Completed`.
        *   **3. Inventory Task Creation Controls (COMPLETED):** Admins can now generate new inventory count tasks (both bulk and spot-check). Product-related task creation remains to be done.
        *   **4. Admin Inventory Open Tasks List (COMPLETED):** Admins now have full visibility into the current inventory counting workload of managers.
        *   **5. Display Inventory Task Count (COMPLETED):** Implement logic to display the count of 'Review' inventory tasks in `AdminInventoryWidget.html`.
    4.  **Development Screen (IN PROGRESS):** Create `DevelopmentView.html` to house the developer tools (Rebuild SysConfig, etc.).
    5.  **Product Details Screen (COMPLETED):** A placeholder `ProductDetailsView.html` has been created, ready for future development.

### 5.3. Manager Screen Implementation
*   **Goal:** Build the dedicated screens for the manager user.
*   **Tasks:**
    1.  **Inventory Screen (COMPLETED):** Create `ManagerInventoryView.html` to house manager-level inventory workflows, including Brurya warehouse inventory management and inventory count entry/submission.
        *   **Display Inventory Task Count (COMPLETED):** Logic implemented to display the count of 'Assigned' inventory tasks in `ManagerInventoryView.html`.
    2.  **Product Management Screen (COMPLETED):** Created `ManagerProductsView.html` as a unified dashboard for manager-level product workflows.
        *   **Product Detail Updates (COMPLETED):** Integrated task list for handling "Vintage Mismatch" and other product detail updates.
        *   **Stock Health & Suggestions (COMPLETED):** Implemented a "New Products" section featuring:
            *   **Category Status:** Visual dashboard of product categories (Wine, Liqueur, etc.) showing current stock vs. configured minimums (`StockHealth` config).
            *   **Suggestion Tool:** Interface to view eligible "candidate" products (Active, In Stock, Not on Web) filtered by category, and batch-create "New Product" tasks for them.
        *   **Manager Products Widget (COMPLETED):** Created `ManagerProductsWidget.html` to provide a high-level summary of open product tasks and deficient categories on the main dashboard.

### 5.4. UI/WebApp Architecture Refactoring (IN PROGRESS)
*   **Goal:** To refactor the UI controller layer to align with the flexible patterns defined in `ARCHITECTURE.md`.
*   **Architectural Model:** For role-based workflows with distinct screens but shared data (like Inventory), work will follow the **Shared View Controller** pattern. This means that related views (e.g., `AdminInventoryView.html`, `ManagerInventoryView.html`) will be supported by a single, shared controller script (e.g., `WebAppInventory.js`). This approach reduces file count while relying on clear function naming to maintain organization. For standalone views, the **Dedicated View Controller** pattern will be used.

### 5.5. UI Authentication & User Switching (COMPLETED)
*   **Goal:** Implement a robust and flexible UI control for user authentication and role switching, leveraging a proven pattern for dynamic content loading.
*   **Resolution:** The previous issue of user-specific content not loading correctly has been resolved by implementing a client-side content loading mechanism, ensuring that all initial and subsequent content is fetched and rendered via `google.script.run`.

### 5.6. Admin Product Review & Export (COMPLETED)
*   **Goal:** Provide a comprehensive interface for admins to review product detail updates, make final edits, accept changes, and export them for web updates.

## Phase 6: Workflow Integrity & UI Orchestration (COMPLETED)

**Goal:** To evolve the current UI into a state-aware dashboard that provides visibility and guided control over the system's interdependent workflows. This will be achieved by enhancing the existing UI and backend services, not by redesigning them.

### 6.1. Core Architectural Principle (COMPLETED)

The system formally adopted a **"System-State-Aware Workflow Orchestration"** model. The `OrchestratorService` serves as the single source of truth for workflow status. The UI acts as a "dumb" but responsive dashboard that reflects the state managed by the backend, disabling or enabling user actions based on that state.

### 6.2. Backend Implementation Plan (COMPLETED)

*   **Job & Dependency Definition (`SysConfig`)**: New, non-file-based jobs for each export process (`export.comax.orders`, `export.web.inventory`) were defined in `SysConfig`. The `depends_on` property is used to enforce execution order. Specifically, the `Comax Product Import` job depends on the `Web Product Import` job.
*   **State-Based Job & Task Creation (`OrchestratorService`)**: The service's responsibilities were extended beyond file-based triggers. It programmatically creates tasks based on system state. A Task is a simple flag indicating work is ready; it does not store data and does not need to be updated if already open.
*   **New Trigger Logic (`OrchestratorService`)**:
    *   **Comax Order Export Trigger:** Upon completion of a `Web Order Import` job, the orchestrator checks if a "Comax Order Export" task is open. If not, it creates one.
    *   **Web Inventory Export Trigger:** Upon completion of *either* a `Web Product Import` or a `Comax Product Import` job, the orchestrator performs a "paired check." It verifies that its counterpart job has also recently completed. If this condition is met, it then checks if a "Web Inventory Export" task is open and creates one if it is not.

### 6.3. Frontend/UI Implementation Plan (COMPLETED)

The existing dashboard widgets were enhanced to:

*   **Display Workflow Status:** Each widget associated with a major workflow (Orders, Inventory) includes a status area that displays the real-time state from the `OrchestratorService` (e.g., "Status: Ready to Export 15 Orders to Comax," "Status: Waiting for Web Product Import").
*   **Implement Action Gating:** UI controls (buttons, links) for initiating actions are dynamically enabled or disabled based on the workflow state. A user cannot click "Export to Comax" if the system is not in a `ReadyForComaxExport` state.
*   **Implement State-Aware Widget Workflows (COMPLETED):**
    *   **Inventory Sync Strategy:** Implemented the "Daily Sync" workflow in the System Health Widget as per `INVENTORY_SYNC_STRATEGY.md`.
    *   **Features:**
        *   **Daily Sync Checklist:** A sequential, 6-step checklist (Invoices, Translations, Products, Orders, Comax Import, Web Export) guides the daily process.
        *   **Safety Locks:** Implemented Red/Yellow/Green logic to block export steps if dependencies (e.g., unexported orders, stale product data) are not met.
        *   **UI Gating:** The "Web Export" button is disabled until the entire sync cycle is verified complete.
        *   **Performance:** Optimized backend status checks to a single read operation.

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

### 5. Inventory Management Workflows (COMPLETED)
*   **Goal:** The full workflow for managing inventory, including Brurya warehouse stock, identifying low/negative stock, and executing physical counts (entry, review, acceptance, export to Comax), is now implemented.

### 6. Comax Inventory Export (COMPLETED)
*   **Goal:** To generate a simple CSV file of SKU and count for export to the Comax system and manage the confirmation workflow.



### 6. Gap Analysis & New Product Suggestions (COMPLETED)
*   **Goal:** To proactively identify product categories with low inventory (gap analysis), suggest eligible candidates from Comax to fill those gaps, and provide a mechanism for general new product suggestions. This replaces legacy category management functions.
*   **Tasks:**
    1.  **Gap Detection Logic (COMPLETED):** Implemented logic in `WebAppProducts_getManagerWidgetData` to monitor inventory levels against `StockHealth` config.
    2.  **Candidate Suggestion Logic (COMPLETED):** Implemented `WebAppProducts_getPotentialProducts` to find eligible candidates in `CmxProdM`.
    3.  **Manager Notification/Prompt (COMPLETED):** Implemented visual indicators in `ManagerProductsWidget` and `ManagerProductsView`.
    4.  **Integration with New Product Workflow (COMPLETED):** Allowed managers to suggest selected products directly, creating "New Product" tasks.

### 7. SKU Management Workflow (Update/Replace) (PLANNED)
*   **Goal:** To provide a safe, guided workflow for updating a product's SKU across all Comax and Web product sheets. This is critical for maintaining data integrity when a SKU changes in the external systems (Comax/WooCommerce) or when switching a web product's connection to a different Comax product.
*   **Tasks:**
    1.  **Detection & Trigger:** Create a mechanism (manual or automated) to initiate an SKU update.
    2.  **Validation:** Ensure the new SKU exists in Comax and is valid for use.
    3.  **System-Wide Update:** Implement a service to safely update `wpm_SKU`, `cpm_SKU`, `wdm_SKU`, `wxl_SKU`, and `pa_SKU` references across all master and audit sheets.
    4.  **External Synchronization:** Provide clear instructions or tasks for the user to manually update the SKU in Comax and WooCommerce to match the internal change.
### 8. Product Detail Update Workflow (Vintage Discrepancy) (COMPLETED)

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

### 11. Enhanced Product Detail Verification (PLANNED)
*   **Goal:** To provide a comprehensive, task-based workflow for managers to review and verify product details, including images, facts, and overall appearance.
*   **Tasks:**
    1.  **UI Development:** Create a new UI view that displays a list of products requiring verification.
    2.  **Product Display:** For each product, display relevant details (e.g., name, SKU, current image URL, key attributes).
    3.  **Checklist Integration:** Implement an interactive checklist for managers to mark verification status for various details.
    4.  **Submission & Status Update:** Implement backend logic to update the product's verification status upon submission.
    5.  **Task Integration:** Ensure this UI is linked to "Verify Product Details" tasks.
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

## Phase 8: Session-Based Orchestration & Validation (PLANNED)

**Goal:** To transition the system from time-based inference to explicit state management using a "System Session ID", ensuring strict sequencing and robust traceability, followed by the implementation of specific validation rules.

### 8.1. Foundation: Session-Based Orchestration
*   **Goal:** Implement a "Session Manager" to group related jobs (Import -> Validation -> Export) into a single, traceable execution cycle.
*   **Detailed Implementation Steps:**
    1.  **Data Model Schema Updates:**
        *   **Goal:** Ensure the database supports the new tracking fields.
        *   **Target Sheets & Columns:**
            *   **`SysJobQueue`**: Add `session_id` (String), `retry_count` (Number, Default: 0).
            *   **`SysLog`**: Add `sl_SessionId` (String), `sl_Data` (String/JSON for structured context).
            *   **`SysTasks`**: Add `st_SessionId` (String).
    2.  **LoggerService Upgrade:**
        *   **Goal:** Ensure logs are tagged with the Session ID for debugging.
        *   **Action:** Update `LoggerService.js` to accept an optional `context` object (containing `sessionId` and `data`) and map it to the new `sl_SessionId` and `sl_Data` columns.
    3.  **Orchestrator Core Logic (The "Brain"):**
        *   **Goal:** Logic to generate and assign Session IDs.
        *   **Action:** Implement `generateSessionId()` (e.g., `SYNC-YYYYMMDD-XX`) and `resolveSessionIdForJob()`.
        *   **Logic:** Root jobs (no dependencies) trigger new IDs; dependent jobs inherit the `session_id` of their completed parent job.
    4.  **Dependency Logic Update (Strict Sequencing):**
        *   **Goal:** Prevent "Time Travel" (e.g., using stale data) and enforce strict ordering.
        *   **Action:** Update `checkDependencies` in `OrchestratorService.js`.
        *   **Logic:** Replace time-window checks with strict Session ID matching. A dependent job can only run if its prerequisite exists *within the same session*.
    5.  **Service Layer Context Propagation:**
        *   **Goal:** Pass the Session ID down to workers (ProductService, OrderService) for logging and task linkage.
        *   **Action:** Standardize an `ExecutionContext` object (`{ sessionId, jobId }`) and pass it as the final argument to all service entry points. Update `TaskService` to link created tasks to this ID.
    6.  **Resilience & Concurrency:**
        *   **Goal:** Prevent job pile-ups and handle crashes.
        *   **Action:**
            *   **Single Thread:** Modify `processPendingJobs` to execute only **one** job per trigger execution.
            *   **Zombie Cleanup:** Implement a check at the start of the Orchestrator to detect jobs stuck in `PROCESSING` state for > 15 minutes and mark them as `FAILED`.

### 8.2. Foundation: Decouple Validation Side-Effects (Shadow Implementation Strategy)
*   **Goal:** Safely transition `ValidationService` to a pure analysis engine without breaking the live system. We will build new components in parallel and switch over only when they are ready.
*   **Detailed Steps:**
    1.  **Create `ValidationLogic.js` (New File):**
        *   **Purpose:** A pure analysis engine.
        *   **Action:** Copy logic from `ValidationService.js`.
        *   **Refactor:** Remove all `TaskService.createTask` calls. Instead, have functions return a `ValidationResult` object (e.g., `{ isValid: false, discrepancies: [...] }`).
    2.  **Create `ValidationOrchestratorService.js` (New File):**
        *   **Purpose:** The decision maker and result handler.
        *   **Action:** Implement a service that calls `ValidationLogic` methods.
        *   **Logic:** Receive `ValidationResult`. If `isValid` is false, iterate through `discrepancies` and call `TaskService` based on the new `task.validation.*` types. Implement aggregation logic (e.g., "Too many errors" task) here.
    3.  **Verify (Parallel Test):**
        *   **Action:** Create a test script `test_validation_shadow.js`.
        *   **Logic:** Run `ValidationOrchestratorService.processJob(...)` manually on a staging sheet.
        *   **Check:** Verify it creates the *correct* new tasks in `SysTasks` (you can delete them after) and logs correctly with `SessionID`.
    4.  **Switch Over (Final Atomic Step):**
        *   **Action:** Update `ProductService.js` and `OrchestratorService.js` to call `ValidationOrchestratorService` instead of `ValidationService`.
        *   **Cleanup:** Mark `ValidationService.js` as deprecated or delete it.

### 8.3. Define Specific Task Types (COMPLETED)
*   **Goal:** Create distinct task types for different categories of field mismatches.
*   **Tasks:**
    1.  **Vintage Mismatch:** Add `task.validation.vintage_mismatch` (High Priority) to `taskDefinitions.json`.
    2.  **Status Mismatch:** Add `task.validation.status_mismatch` (High Priority) to `taskDefinitions.json` for critical status changes (IsWeb, IsActive).
    3.  **Name Mismatch:** Ensure `task.validation.name_mismatch` is properly defined and utilized.

### 8.4. Update Validation Rules
*   **Goal:** Update the validation rules configuration to use the new, specific task types.
*   **Tasks:**
    1.  **Vintage Rule:** Update `C6_Comax_VintageMismatch` to use `task.validation.vintage_mismatch`.
    2.  **Name Rule:** Update `C3_Comax_NameMismatch` to use `task.validation.name_mismatch`.
    3.  **Status Rules:** Update `C7_Comax_IsWebMismatch` and `C8_Comax_IsActiveMismatch` to use `task.validation.status_mismatch`.

### 8.5. UI Consolidation: Daily Sync Controller (The "Persistent State Machine")
*   **Goal:** Implement a robust, state-aware "Wizard" for the Admin to manage the multi-step Periodic Sync process.
*   **Architecture:**
    *   **State Persistence:** Store the current sync state in `SysConfig` (e.g., `system.sync.state`) to survive browser closes/interruptions. State includes: `sessionId`, `currentStage`, `lastUpdated`, and job statuses.
    *   **Stages:**
        1.  **Stage 1: Initialization (Web Data):** Admin uploads Web files. System imports them and generates `SessionID`.
        2.  **Stage 2: Comax Reconciliation (The Gap):** System waits. Admin performs external Comax update (using order export from Stage 1) and uploads `ComaxProducts.csv`.
        3.  **Stage 3: Validation & Finalization:** System imports Comax data, runs Master-Master validation, and generates the Inventory Export delta.
*   **Resilience:**
    *   **Resume:** UI reloads state from backend on startup.
    *   **Staleness:** If state is > 12 hours old, UI prompts to "Start Over" (clearing state).
*   **Tasks:**
    1.  **Backend:** Create `SyncStateService.js` to manage `get/set/reset` of the sync state blob.
    2.  **Frontend:** Create `AdminDailySyncWidget.html` that renders different "Cards" based on the `currentStage`.
    3.  **Integration:** Connect UI buttons to `OrchestratorService` triggers that advance the state.

## Phase 9: Architectural Refactoring (PLANNED)
*   **Goal:** To improve the long-term safety and maintainability of the system by refactoring core components and workflows.

### 9.1. Refactor SysConfig Management (MOVED)
*   **Note:** This workflow has been moved to Section 0 for high visibility.

### 9.2. Standardize System Logging (COMPLETED)
*   **Goal:** To ensure all logging across the application is consistent, meaningful, and conforms to the `LoggerService` standard. This improves traceability and reduces log noise.

### 9.3. Validation Service Optimization & Bug Fix (COMPLETED)
*   **Goal:** To improve the performance and correctness of the validation engine.

### 9.4. Orchestration and Service Layer Bug Fixes (COMPLETED)
*   **Goal:** To resolve critical runtime errors and improve the robustness of the job orchestration engine.

## Phase 10: System Maintenance & Scalability (PLANNED)

**Goal:** To ensure the long-term performance and manageability of the system through automated housekeeping and archiving.

### 10.1. Housekeeping Service
*   **Goal:** Prevent the `SysJobQueue` and `SysLog` sheets from growing indefinitely.
*   **Tasks:**
    1.  **Archive Logic:** Create a service to move records older than X days (e.g., 30) from the live spreadsheet to a dedicated "Archive Spreadsheet".
    2.  **Scheduled Trigger:** Configure a monthly trigger to run the housekeeping job.

### 10.2. Advanced Logging Policy
*   **Goal:** Reduce log noise.
*   **Tasks:**
    1.  **Aggregation:** Update services to aggregate recurring errors (e.g., "500 validation failures") into a single log entry summary.
    2.  **Log Levels:** strictly enforce INFO for high-level flow and DEBUG (new level) for granular details.

## Phase 11: Performance Optimization (PLANNED)

**Goal:** To improve system responsiveness and reduce load times by addressing data access bottlenecks and optimizing the backend-frontend interface.

### 11.1. Data Access Optimization
*   **Goal:** Reduce the latency caused by repeated, expensive Spreadsheet reads.
*   **Tasks:**
    1.  **Cache Implementation:** Implement `CacheService` for frequently accessed data (e.g., `SysConfig`, Product Lookups).
    2.  **Optimized Lookups:** Refactor `getDataRange().getValues()` calls to use more efficient indexing or lookup strategies where possible.

### 11.2. Backend-Frontend Interface
*   **Goal:** Minimize network round-trips (`google.script.run` calls).
*   **Tasks:**
    1.  **Data Aggregation:** Refactor backend functions to return "Composite Objects" (e.g., `getProductFullDetails` returns Metadata + Stock + History in one call) instead of multiple fragmented calls.
    2.  **Prefetching:** Where feasible, include essential detail data in list views to eliminate loading time for simple actions.

## Phase 12: Quality Assurance & Resilience (PLANNED)

**Goal:** To ensure business logic stability and "user-proof" the database infrastructure.

### 12.1. Automated Testing Framework
*   **Goal:** Ensure business logic stability without relying solely on manual testing.
*   **Tasks:**
    1.  **Unit Test Suite:** Create a script infrastructure to run logical tests on core services (e.g., `OrderService` logic) using mock data, avoiding spreadsheet side-effects.
    2.  **Regression Tests:** Define a standard set of tests to run before any deployment.

### 12.2. Database Protection
*   **Goal:** "User-proof" the Google Sheets database to prevent accidental corruption.
*   **Tasks:**
    1.  **Header Locking:** Programmatically protect the header rows of all Master Sheets.
    2.  **Schema Validator:** Implement a startup check that verifies all required columns exist before allowing operations to proceed.
