# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub. It is based on the formal design in `ARCHITECTURE.md`.

## Next Task

**Implement Output Generation.**

The next step is to build the services required to format and export data for external systems, specifically the `WooCommerceFormatter` service which will generate the CSV file needed for bulk updates on the website.

*   **Next Step:** Implement **Part 6: Output Generation & Notification**.

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


## Phase 2: Product Workflow Engine (IN PROGRESS)

**Goal:** To build the complete, automated workflow for ingesting, reconciling, and validating all product data sources, replacing the legacy `ImportWebProducts.js` and `ProductUpdates.js` scripts.

### Part 1: Correct Product Import Model (COMPLETED)
**Goal:** To correct the flawed product import model to reflect the actual data sources: a single main product export and a separate translation link file (`wehe.csv`).

*   **1.1. Correct Data Model (`DATA_MODEL.md`):**
    *   Action: Remove the incorrect `WebProdS_HE` sheet.
    *   Action: Add the new `WebXltS` staging sheet for the `wehe.csv` file.
*   **1.2. Correct Workflows (`WORKFLOWS.md`):** Action: Update the "Product Import & Data Processing" workflow to describe the new two-file process.
*   **1.3. Correct Configuration Definitions:**
    *   Action: In `setup.js`, remove the `import.drive.web_products_he` configuration.
    *   Action: Add a new `import.drive.web_hebrew_links` configuration for the `wehe.csv` file.
    *   **COMPLETED:** Corrected `wps_Price` to `wps_RegularPrice` mapping in `SysConfig` for `map.web.product_columns` and `schema.data.WebProdS_EN`.
*   **1.4. Correct `ProductService` Staging Logic:** The service's staging function must be updated to handle the two distinct job types, routing the main export to `WebProdS_EN` and the translation links to `WebXltS`.
    *   **COMPLETED:** Modified `_populateStagingSheet` to dynamically map data based on actual sheet headers.
*   **1.5. Correct `OrchestratorService` Logic:** The service must be updated to look for the two correct file types (`web_products_en` and `web_hebrew_links`).
    *   **COMPLETED:** Fixed `ConfigService` schema loading by correcting parsing of `sys.schema.version` and ensuring it's always loaded.
    *   **COMPLETED:** Modified `WebAdapter.processProductCsv()` for case-insensitive header matching.

### Part 2: SysConfig State Management (COMPLETED)
**Goal:** To implement a state management system for `SysConfig` to ensure stability during development.

*   **2.1. Update Data Model (`DATA_MODEL.md`):** Add a new column, `scf_status`, to the `SysConfig` table definition.
*   **2.2. Modify Configuration Service (`config.js`):** Update the service to read and filter by the `scf_status` column.
*   **2.3. Enhance Setup Script (`setup.js`):** Add a utility function, `setRecordStatus()`, for programmatic tagging.
*   **2.4. Manual SysConfig Provision:** The `SysConfig` snapshot will be manually provided by the user at the start of each session, typically via a CSV file.

### Part 3: Staging Data Validation (IN PROGRESS)
*   **3.1. Implement Configuration-Driven Validation Engine (COMPLETED):** The core validation engine in `ProductService.js` is implemented and tested. It is capable of executing various types of rules defined in `SysConfig`.

*   **3.2. Implement Task De-duplication (COMPLETED):** In `TaskService`, logic has been added to prevent the creation of duplicate tasks for the same entity and exception type.

*   **3.3. Define Validation Rules in `setup.js` (IN PROGRESS):** The master configuration in `setup.js` must define all required validation rules. The status of the 17 legacy rules is as follows:

    *   **A1: Web Staging product not in Web Master.** (Implemented & Enabled in `setup.js`)
    *   **A2: Web Master product not in Web Staging.** (Implemented & Enabled in `setup.js`)
    *   **A3: SKU mismatch between Web Master and Staging.** (Implemented & Enabled in `setup.js`)
    *   **A4: Name mismatch between Web Master and Staging.** (To Be Implemented in `setup.js`)
    *   **A5: Publish status mismatch between Web Master and Staging.** (To Be Implemented in `setup.js`)
    *   **C1: Active Comax Master product not in Comax Staging.** (Implemented & Disabled in `setup.js` - Replaced by row count check)
    *   **C2: ID mismatch between Comax Master and Staging.** (To Be Implemented in `setup.js`)
    *   **C3: Name mismatch between Comax Master and Staging.** (To Be Implemented in `setup.js`)
    *   **C4: Group mismatch between Comax Master and Staging.** (To Be Implemented in `setup.js`)
    *   **C5: Size mismatch between Comax Master and Staging.** (To Be Implemented in `setup.js`)
    *   **C6: Vintage mismatch between Comax Master and Staging.** (Implemented & Enabled in `setup.js`)
    *   **D1: "Excluded" but not "Sell Online" in Comax Staging.** (To Be Implemented in `setup.js`)
    *   **D2: Negative inventory in Comax Staging.** (Implemented & Enabled in `setup.js`)
    *   **D3: Archived item with positive stock in Comax Staging.** (To Be Implemented in `setup.js`)
    *   **E1: New "Sell Online" Comax SKU not in Web Staging.** (To Be Implemented in `setup.js`)
    *   **E2: Web Staging SKU not in Comax Staging.** (To Be Implemented in `setup.js`)
    *   **E3: Published web product not "Sell Online" in Comax.** (To Be Implemented in `setup.js`)
    *   **C_ComaxS_RowCountDecrease: Comax Staging row count decreased compared to Master.** (Implemented & Enabled in `setup.js` - Triggers quarantine)
    *   **W_WebS_RowCountDecrease: Web Products Staging row count decreased compared to Master.** (Implemented & Enabled in `setup.js` - Triggers quarantine)
    *   **X_WebXltS_RowCountDecrease: Web Translations Staging row count decreased compared to Master.** (Implemented & Enabled in `setup.js` - Triggers quarantine)

*   **3.4. Implement Staging Workflows (COMPLETED):** The `processJob` function in `ProductService.js` now correctly calls dedicated functions to populate the `CmxProdS` and `WebProdS_EN` staging sheets from their respective import files.

*   **3.5. Centralized Validation Trigger (COMPLETED):** The `OrchestratorService.run()` function is confirmed to call `ProductService.runValidationEngine()` after all import jobs are processed. This ensures validation runs centrally against all populated staging sheets.

### Part 4: Refactor Validation Workflow (COMPLETED)
**Goal:** To implement the hybrid validation approach, making the system more efficient and logical. Staging-related validation will be triggered by imports, while master-to-master validation will remain on a schedule.

*   **4.1. Categorize Validation Rules in `setup.js`:** (COMPLETED)
*   **4.2. Refactor `ProductService.js`:** (COMPLETED)
*   **4.3. Update `OrchestratorService.js`:** (COMPLETED)
*   **4.4. Test Refactored Workflow:** (COMPLETED)

### Part 5: Master Data Reconciliation (COMPLETED)
*   **5.1. Implement Master Data Upsert Logic:** (COMPLETED) The upsert logic for `WebXltS` to `WebXltM`, `CmxProdS` to `CmxProdM`, and `WebProdS_EN` to `WebProdM` has been implemented and verified. The logic follows an update-only strategy for existing products and does not automatically create new ones from imports.

### Part 6: Output Generation & Notification (IN PROGRESS)
*   **6.1. Implement `WooCommerceFormatter` Service:** Create a new `WooCommerceFormatter.js` service. Its purpose is to take clean, validated data from the system's master sheets and format it into the complex, multi-column CSV required by WooCommerce for bulk updates.
*   **6.2. Implement `generateWooCommerceUpdateExport()` function:** Create this function in `ProductService` to orchestrate the export process, using the `WooCommerceFormatter` to generate the final CSV file and save it to a designated "Exports" folder in Google Drive.
*   **6.3. Enhance Notifications:** Ensure all new processes log detailed results to `SysLog` and that job statuses in `SysJobQueue` are updated correctly, with clear error messages pointing to generated tasks if applicable.

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