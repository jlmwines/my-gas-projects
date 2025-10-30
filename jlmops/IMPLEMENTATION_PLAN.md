# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub. It is based on the formal design in `ARCHITECTURE.md`.

## Next Task

**Phase 4.4: Implement Core Order Workflows**

*   **Next Step:** Begin implementing the core business logic for order processing, starting with On-Hold Inventory Calculation.

## Phase 1: System Foundation & Setup (COMPLETED)

**Goal:** To establish the core technical foundation based on the user-managed configuration before any workflow logic is built.

**1. Manual Configuration Setup (User Action) (COMPLETED)**
    *   **Action:** Create the necessary `Source` and `Archive` folders in Google Drive.
    *   **Action:** Create the `JLMops_Logs` spreadsheet.
    *   **Action:** Populate the `SysConfig` sheet in the `JLMops_Data` spreadsheet using the universal, block-based schema defined in `ARCHITECTURE.md`.
    *   **Verification:** All required configuration blocks for spreadsheets, folders, and import types are present in the `SysConfig` sheet.

**2. Implement Configuration Service (`config.js`) (COMPLETED)**
    *   **Action:** Create a `config.js` script that provides a central service for reading and accessing configuration values.
    *   **Detail:** This service will find the `JLMops_Data` spreadsheet by name and parse the `SysConfig` sheet. It must be able to read multi-row configuration blocks (grouped by `scf_SettingName`) and return them as structured objects.
    *   **Verification:** The service can successfully read and provide a complete configuration block for any defined setting.

**3. Implement Configuration Synchronization Script (`setup.js`) (COMPLETED)**
    *   **Action:** The `setup.js` file has been implemented to act as the authoritative source of truth for system configuration.
    *   **Detail:** The `rebuildSysConfigFromSource()` function inside `setup.js` contains the master configuration as a hardcoded array and will overwrite the live `SysConfig` sheet to ensure it is always in the correct, version-controlled state.
    *   **Verification:** Running `rebuildSysConfigFromSource()` in `setup.js` successfully synchronizes the live sheet.


## Phase 2: Product Workflow Engine (COMPLETED)

**Goal:** To build the complete, automated workflow for ingesting, reconciling, and validating all product data sources, replacing the legacy `ImportWebProducts.js` and `ProductUpdates.js` scripts.


## Phase 3: Initial Data Population (COMPLETED)

**Goal:** To migrate all necessary product and order data from the legacy system into the new JLMops master sheets.

**Phase 3.1: Product Detail Data Population (COMPLETED)**
    *   **Goal:** Migrate existing product detail data from the old system's reference sheets into the JLMops product master sheets.
    *   **Action:** Created the `populateInitialProductData()` function in `jlmops/setup.js`.
    *   **Detail:** This function reads from the legacy `DetailsM`, `WeHe`, and `ComaxM` sheets to populate the `WebProdM`, `WebDetM`, and `WebXltM` sheets.

**Phase 3.2: Order Data Population (COMPLETED)**
    *   **Goal:** To populate the JLMops master order sheets with existing web order data.
    *   **Action:** Created the `populateInitialOrderData()` function in `jlmops/setup.js`.
    *   **Detail:** This function reads from the legacy `OrdersM`, `OrderLog`, and `OrderLogArchive` sheets, normalizes the data, separates active vs. archived records, and populates the new `WebOrdM`, `WebOrdItemsM`, `SysOrdLog`, `WebOrdM_Archive`, and `WebOrdItemsM_Archive` sheets.

## Phase 4: Order Workflow & Parallel Implementation (IN PROGRESS)

**Goal:** To implement the core order workflow logic while establishing a robust framework for parallel operation, data synchronization, and validation against the legacy system.

*   **Phase 4.1: Foundational Utilities for Parallel Operation (COMPLETED)**
    *   **Goal:** Built a set of safe, reusable tools to manage data during the parallel implementation phase.
    *   **Tasks:**
        1.  **Refactored Setup Script (COMPLETED):** The monolithic `setup.js` script has been refactored into three specialized scripts: `SetupConfig.js` (for configuration management), `SetupSheets.js` (for sheet creation and header management), and `SetupMigrate.js` (for data migration).
        2.  **Create Safe Header Update Function (COMPLETED):** Implemented a new `updateSheetHeaders` function in `SetupSheets.js` that only modifies the header row of a sheet, ensuring that it can be run safely on sheets containing data.
        3.  **Create Sheet Initialization Functions (COMPLETED):** Added functions to `SetupSheets.js` to create all system sheets with headers based on `SysConfig` definitions. A master function `createJlmopsSystemSheets` was also added to run all sheet creation functions.
        4.  **Build Generic Master Data Sync Utility (PLANNED):** Implement a generic `syncLegacyMasterData(dataType)` function in `migration.js`. This tool will be driven by `migration.sync.tasks` configurations in `SysConfig` to perform non-destructive upserts from any legacy master sheet to its `jlmops` counterpart.

*   **Phase 4.4: Implement Core Order Workflows (IN PROGRESS)**
    *   **Goal:** Re-implement the core business logic for order processing within the new, robust framework.
    *   **Tasks:**
        1.  **On-Hold Inventory Calculation (COMPLETED):** Implement the logic in `InventoryManagementService.js`.
        2.  **Comax Order Export:** Implement the export generation logic in `OrderService.js`.
        3.  **Packing Slip Data Preparation:** Implement the `preparePackingData` function in `OrderService.js`.

*   **Phase 4.2: Business Logic Validation Framework (PLANNED)**
    *   **Goal:** Create a service dedicated to validating the outputs of `jlmops` business logic against the legacy system.
    *   **Tasks:**
        1.  **Implement `ValidationService.js`:** Create the new service file.
        2.  **Implement Initial Validation Tools:** Build the first set of validation tools, including `validateHighestOrderNumber()`, `validateOnHoldInventory()`, `validatePackingSlipData()`, and `validateComaxExport()`. 

## Phase 5: Output Generation & Notification (PLANNED)

**Goal:** To build the services required to format and export data for external systems like WooCommerce.

*   **1. Implement `WooCommerceFormatter` Service:** Create a new `WooCommerceFormatter.js` service. Its purpose is to take clean, validated data from the system's master sheets and format it into the complex, multi-column CSV required by WooCommerce for bulk updates.
*   **2. Implement `generateWooCommerceUpdateExport()` function:** Create this function in `ProductService` to orchestrate the export process, using the `WooCommerceFormatter` to generate the final CSV file and save it to a designated "Exports" folder in Google Drive.
*   **3. Enhance Notifications:** Ensure all new processes log detailed results to `SysLog` and that job statuses in `SysJobQueue` are updated correctly, with clear error messages pointing to generated tasks if applicable.

## Phase 6: Bundle Management Engine (PLANNED)

**Goal:** To implement the rules-based engine for managing product bundles, monitoring component stock, and suggesting replacements.

*   **1. Update `setup.js`:** Add the new schemas for `SysBundlesM`, `SysBundleRows`, `SysBundleActiveComponents`, and `SysBundleComponentHistory` to the `SYS_CONFIG_DEFINITIONS` object.
*   **2. Implement `BundleService` Monitoring Logic:** Implement the scheduled function to monitor stock levels of all SKUs in the `SysBundleActiveComponents` sheet.
*   **3. Implement `BundleService` Suggestion Logic:** Implement the core logic to find suitable replacement SKUs by matching the eligibility rules defined in `SysBundleRows` against the master product data.
*   **4. Implement `BundleService` Task Creation:** Integrate with the `TaskService` to automatically create detailed tasks when low-stock situations are detected.
*   **5. Implement `BundleService` Audit Trail:** Implement the `onEdit` trigger or an equivalent mechanism to automatically log all component changes from `SysBundleActiveComponents` into the `SysBundleComponentHistory` sheet.

## Phase 7: The Dashboard-Driven Web App (Frontend)

**Goal:** To build the user interface that sits on top of the powerful backend engine.

**1. Build Core UI Framework**
    *   **Action:** Set up the main HTML file, CSS framework, and client-side JavaScript for the Single Page Application (SPA).

**2. Implement System Health Widget**
    *   **Action:** Create the UI for the "System Health" widget on the main dashboard.
    *   **Detail:** The widget will display the count of failed jobs from `SysJobQueue` and the status from the last configuration health check. It will include a button to trigger the health check function.

## Phase 8: Testing, Integration & Deployment

**Goal:** To connect, test, and launch the new system.
