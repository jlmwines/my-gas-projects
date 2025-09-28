# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub. It is based on the formal design in `ARCHITECTURE.md`.

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

**3. Implement Configuration Synchronization Script (`setup.js`) (IN PROGRESS)**
    *   **Action:** The `setup.js` file will be revamped to act as a configuration synchronization tool.
    *   **Detail:** It will read the `SysConfig_template.csv` (the single source of truth for configuration) and synchronize the live `SysConfig` sheet to match it. This ensures consistency and prevents configuration drift.
    *   **Verification:** Running `syncSysConfigWithTemplate()` in `setup.js` reports no discrepancies.

**4. Configuration Template (`SysConfig_template.csv`) (NEW)**
    *   **Action:** Create and maintain `SysConfig_template.csv` as the single source of truth for all system configuration.
    *   **Detail:** This CSV file will contain the complete, desired state of the `SysConfig` sheet. All schemas, maps, and rules will be defined here. `setup.js` will read this file to synchronize the live `SysConfig` sheet.
    *   **Verification:** `SysConfig_template.csv` is up-to-date and accurately reflects the desired system configuration.
    *   **NOTE ON FAILURE:** During a previous session, the attempt to programmatically update the `SysConfig_template.csv` file failed due to a communication breakdown regarding explicit tool execution approval. This highlights a critical point of friction in the interaction process.

## Phase 2: Product Workflow Engine (IN PROGRESS)

**Goal:** To build the complete, automated workflow for ingesting, reconciling, and validating all product data sources (Comax, WooCommerce EN, WooCommerce HE), replacing the legacy `ImportWebProducts.js` and `ProductUpdates.js` scripts.

### Part 1: Foundational Configuration (COMPLETED)
*   **1.1. Define Web Product Import Configurations (COMPLETED):** Add two new configuration blocks (`import.drive.web_products_en`, `import.drive.web_products_he`) to the existing `SYS_CONFIG_DEFINITIONS` in `setup.js`. The configuration for `import.drive.comax_products` is already complete.
*   **1.2. Define Staging Sheet Schemas (IN PROGRESS):** Define comprehensive schemas for `WebProdS_EN` (49 columns) and `WebProdS_HE` (for future use, not directly imported) in `SysConfig_template.csv` to enable automatic sheet creation and header validation.
*   **1.3. Define Validation Task Types (COMPLETED):** Add new task type definitions (e.g., `SKU_NOT_IN_COMAX`, `TRANSLATION_MISSING`) to `SYS_CONFIG_DEFINITIONS` to allow for the creation of specific, actionable tasks when data discrepancies are found.

### Part 2: Automated Intake & Staging (COMPLETED)
*   **2.1. Enhance `OrchestratorService` (COMPLETED):** The service will now automatically handle the three product-related file types based on the new configurations, creating a distinct job in `SysJobQueue` for each.
*   **2.2. Enhance `ProductService` for Staging (IN PROGRESS):** The service will be updated to handle the new job types, routing the file content to the correct parser (`ComaxAdapter` or `WebAdapter`) and populating the correct staging sheet (`CmxProdS`, `WebProdS_EN`). `ComaxAdapter` now uses header-name-based mapping.

### Part 3: Staging Data Validation (COMPLETED)
*   **3.1. Implement Configuration-Driven Validation Engine (COMPLETED):** In `setup.js`, define a comprehensive set of validation rules inspired by the legacy `Compare.js` script. Each rule defines a specific test, its parameters, and the task to create upon failure. The full list of 17 required tests has been identified and is detailed below.

    | Legacy ID | Description                                                      | Status in `setup.js` |
    | :-------- | :--------------------------------------------------------------- | :------------------- |
    | A1        | Web Staging product not in Web Master.                           | Implemented          |
    | A2        | Web Master product not in Web Staging.                           | Implemented          |
    | A3        | SKU mismatch between Web Master and Staging.                     | Implemented          |
    | A4        | Name mismatch between Web Master and Staging.                    | **Missing**          |
    | A5        | Publish status mismatch between Web Master and Staging.          | **Missing**          |
    | C1        | Active Comax Master product not in Comax Staging.                | Implemented          |
    | C2        | ID mismatch between Comax Master and Staging.                    | **Missing**          |
    | C3        | Name mismatch between Comax Master and Staging.                  | Implemented          |
    | C4        | Group mismatch between Comax Master and Staging.                 | **Missing**          |
    | C5        | Size mismatch between Comax Master and Staging.                  | **Missing**          |
    | C6        | Vintage mismatch between Comax Master and Staging.               | **Missing**          |
    | D1        | "Excluded" but not "Sell Online" in Comax Staging.               | **Missing**          |
    | D2        | Negative inventory in Comax Staging.                             | Implemented          |
    | D3        | Archived item with positive stock in Comax Staging.              | Implemented          |
    | E1        | New "Sell Online" Comax SKU not in Web Staging.                  | Implemented          |
    | E2        | Web Staging SKU not in Comax Staging.                            | Implemented          |
    | E3        | Published web product not "Sell Online" in Comax.                | Implemented          |

*   **3.2. Implement Task De-duplication (COMPLETED):** In `TaskService`, add logic to prevent the creation of duplicate tasks for the same entity and exception type.
*   **3.3. Implement Validation Execution (COMPLETED):** In `ProductService`, create a validation engine that reads the rules from the configuration and executes them against the staged data *after* the staging sheets are populated but *before* any data is written to the master sheets. The engine uses the `TaskService` to log all discrepancies.

### Part 4: Master Data Reconciliation (NEXT)
*   **4.1. Implement Master Data Upsert Logic:** In `ProductService`, create functions to "upsert" data from the staging sheets (`CmxProdS`, `WebProdS_EN`, `WebProdS_HE`) into the master data sheets (`CmxProdM`, `WebProdM`, `WebDetM`, `WebXlt`), ensuring new products are added and existing ones are updated based on the staged data.

### Part 5: Output Generation & Notification
*   **4.1. Implement `WooCommerceFormatter` Service:** Create a new `WooCommerceFormatter.js` service. Its purpose is to take clean, validated data from the system's master sheets and format it into the complex, multi-column CSV required by WooCommerce for bulk updates.
*   **4.2. Implement `generateWooCommerceUpdateExport()` function:** Create this function in `ProductService` to orchestrate the export process, using the `WooCommerceFormatter` to generate the final CSV file and save it to a designated "Exports" folder in Google Drive.
*   **4.3. Enhance Notifications:** Ensure all new processes log detailed results to `SysLog` and that job statuses in `SysJobQueue` are updated correctly, with clear error messages pointing to generated tasks if applicable.

## Phase 3: Bundle Management Engine (PLANNED)

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