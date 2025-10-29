# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub. It is based on the formal design in `ARCHITECTURE.md`.

## Next Task

**Phase 4.1b: Process Staged Orders to Master Sheets**

*   **Next Step:** To parse the raw, staged order data and upsert it into the normalized master order sheets. Implement a function in `OrderService.js` that reads from `WebOrdS`, normalizes the data, and populates `WebOrdM`, `WebOrdItemsM`, and `SysOrdLog`.

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

## Phase 4: Order Workflow Logic (PLANNED)

**Goal:** To implement the core business logic for processing orders, based on the analysis of the legacy system.

*   **Phase 4.1a: Order Import to Staging (COMPLETED)**
    *   **Goal:** Implement the automated workflow for ingesting new web orders into a staging area.
    *   **Action:** 
        1. Added a new `import.drive.web_orders` configuration to `setup.js`.
        2. Implemented the `importWebOrdersToStaging` function in `OrderService.js` to read data from the archived CSV and populate the `WebOrdS` staging sheet.
    *   **Verification:** `WebOrdS` sheet successfully populated from `WebOrders.csv` via `runScheduledTasks()`.

**Phase 4.1b: Process Staged Orders to Master Sheets (IN PROGRESS)**

*   **Next Step:** To parse the raw, staged order data and upsert it into the normalized master order sheets. Implement a function in `OrderService.js` that reads from `WebOrdS`, normalizes the data, and populates `WebOrdM`, `WebOrdItemsM`, and `SysOrdLog`.

**Testing Plan:**

1.  **Execute `rebuildSysConfigFromSource()`:** Run the `rebuildSysConfigFromSource()` function in `setup.js` to update the `SysConfig` sheet with the corrected schema.
2.  **Execute `importWebOrdersToStaging`:** Run the `importWebOrdersToStaging` function in `OrderService.js` to import the `WebOrders.csv` data into the `WebOrdS` sheet.
3.  **Verify `WebOrdS` sheet:** Manually inspect the `WebOrdS` sheet to confirm that the headers are correct and the data has been imported successfully.
4.  **Execute `processStagedOrders`:** Run the `processStagedOrders` function in `OrderService.js` to process the staged data.
5.  **Verify master sheets:** Manually inspect the `WebOrdM`, `WebOrdItemsM`, and `SysOrdLog` sheets to confirm that the data has been correctly processed and inserted.

*   **Phase 4.2: On-Hold Inventory Calculation**
    *   **Goal:** To create a service that calculates the total quantity of each SKU committed to 'On-Hold' orders.
    *   **Action:** Implement a function in `InventoryManagementService.js` that reads `WebOrdM` and `WebOrdItemsM`, filters for 'On-Hold' orders, aggregates the quantities for each SKU, and populates the `SysInventoryOnHold` sheet.

*   **Phase 4.3: Comax Order Export**
    *   **Goal:** To create a service that generates the aggregated SKU summary for Comax.
    *   **Action:** Implement a function in `OrderService.js` that identifies export-eligible orders from `SysOrdLog` and `WebOrdM`, aggregates line items from `WebOrdItemsM`, and generates the summary CSV file.

*   **Phase 4.4: Packing Slip Data Preparation**
    *   **Goal:** To create a service that populates the `SysPackingCache` with enriched data for all pending packing slips.
    *   **Action:** Implement the `preparePackingData` function in `OrderService.js`. This function will identify eligible orders based on their status in `WebOrdM` and `SysOrdLog`, gather data from `WebOrdM`, `WebOrdItemsM`, and `WebDetM`, and write the combined data to `SysPackingCache`.

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

**Goal:** To build the services required to format and export data for external systems like WooCommerce.

*   **1. Implement `WooCommerceFormatter` Service:** Create a new `WooCommerceFormatter.js` service. Its purpose is to take clean, validated data from the system's master sheets and format it into the complex, multi-column CSV required by WooCommerce for bulk updates.
*   **2. Implement `generateWooCommerceUpdateExport()` function:** Create this function in `ProductService` to orchestrate the export process, using the `WooCommerceFormatter` to generate the final CSV file and save it to a designated "Exports" folder in Google Drive.
*   **3. Enhance Notifications:** Ensure all new processes log detailed results to `SysLog` and that job statuses in `SysJobQueue` are updated correctly, with clear error messages pointing to generated tasks if applicable.

## Phase 5: Bundle Management Engine (PLANNED)

**Goal:** To implement the rules-based engine for managing product bundles, monitoring component stock, and suggesting replacements.

*   **1. Update `setup.js`:** Add the new schemas for `SysBundlesM`, `SysBundleRows`, `SysBundleActiveComponents`, and `SysBundleComponentHistory` to the `SYS_CONFIG_DEFINITIONS` object.
*   **2. Implement `BundleService` Monitoring Logic:** Implement the scheduled function to monitor stock levels of all SKUs in the `SysBundleActiveComponents` sheet.
*   **3. Implement `BundleService` Suggestion Logic:** Implement the core logic to find suitable replacement SKUs by matching the eligibility rules defined in `SysBundleRows` against the master product data.
*   **4. Implement `BundleService` Task Creation:** Integrate with the `TaskService` to automatically create detailed tasks when low-stock situations are detected.
*   **5. Implement `BundleService` Audit Trail:** Implement the `onEdit` trigger or an equivalent mechanism to automatically log all component changes from `SysBundleActiveComponents` into the `SysBundleComponentHistory` sheet.

## Phase 4: The Dashboard-Driven Web App (Frontend)

**Goal:** To build the user interface that sits on top of the powerful backend engine.

**1. Build Core UI Framework**
    *   **Action:** Set up the main HTML file, CSS framework, and client-side JavaScript for the Single Page Application (SPA).

**2. Implement System Health Widget**
    *   **Action:** Create the UI for the "System Health" widget on the main dashboard.
    *   **Detail:** The widget will display the count of failed jobs from `SysJobQueue` and the status from the last configuration health check. It will include a button to trigger the health check function.

## Phase 5: Testing, Integration & Deployment

**Goal:** To connect, test, and launch the new system.