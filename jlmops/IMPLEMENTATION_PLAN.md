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

**3. Implement Core Setup Script (`setup.js`) (COMPLETED)**
    *   **Action:** Create a `setupLogSheets()` and `rebuildDataSheets()` function in `setup.js`.
    *   **Detail:** These functions use the `config.js` service to get the correct spreadsheet IDs and create/update all necessary sheets with the correct headers.
    *   **Verification:** When the script is run, all log and data sheets are correctly created and formatted.

## Phase 2: Product Workflow Engine (IN PROGRESS)

**Goal:** To build the complete, automated workflow for ingesting, reconciling, and validating all product data sources (Comax, WooCommerce EN, WooCommerce HE), replacing the legacy `ImportWebProducts.js` and `ProductUpdates.js` scripts.

### Part 1: Foundational Configuration (COMPLETED)
*   **1.1. Define Web Product Import Configurations (COMPLETED):** Add two new configuration blocks (`import.drive.web_products_en`, `import.drive.web_products_he`) to the existing `SYS_CONFIG_DEFINITIONS` in `setup.js`. The configuration for `import.drive.comax_products` is already complete.
*   **1.2. Define Staging Sheet Schemas (COMPLETED):** Add schemas for the new `WebProdS_EN` and `WebProdS_HE` staging sheets to `SYS_CONFIG_DEFINITIONS` in `setup.js` to enable automatic sheet creation and header validation.
*   **1.3. Define Validation Task Types (COMPLETED):** Add new task type definitions (e.g., `SKU_NOT_IN_COMAX`, `TRANSLATION_MISSING`) to `SYS_CONFIG_DEFINITIONS` to allow for the creation of specific, actionable tasks when data discrepancies are found.

### Part 2: Automated Intake & Staging (COMPLETED)
*   **2.1. Enhance `OrchestratorService` (COMPLETED):** The service will now automatically handle the three product-related file types based on the new configurations, creating a distinct job in `SysJobQueue` for each.
*   **2.2. Enhance `ProductService` for Staging (COMPLETED):** The service will be updated to handle the new job types, routing the file content to the correct parser (`ComaxAdapter` or a new internal CSV parser) and populating the correct staging sheet (`CmxProdS`, `WebProdS_EN`, or `WebProdS_HE`).

### Part 3: Master Data Reconciliation & Validation (NEXT)
*   **3.1. Implement Master Data Upsert Logic:** In `ProductService`, create functions to "upsert" data from the staging sheets into the master data sheets (`CmxProdM`, `WebProdM`, `WebDetM`, `WebXlt`), ensuring new products are added and existing ones are updated.
*   **3.2. Implement Comprehensive Data Validation:** Create a validation function in `ProductService` that runs after the master data is updated. This function will perform all critical checks (SKU Compliance, Translation Completeness, Archived with Stock, etc.) and use the `TaskService` to create tasks for any identified issues.

### Part 4: Output Generation & Notification
*   **4.1. Implement `WooCommerceFormatter` Service:** Create a new `WooCommerceFormatter.js` service. Its purpose is to take clean, validated data from the system's master sheets and format it into the complex, multi-column CSV required by WooCommerce for bulk updates.
*   **4.2. Implement `generateWooCommerceUpdateExport()` function:** Create this function in `ProductService` to orchestrate the export process, using the `WooCommerceFormatter` to generate the final CSV file and save it to a designated "Exports" folder in Google Drive.
*   **4.3. Enhance Notifications:** Ensure all new processes log detailed results to `SysLog` and that job statuses in `SysJobQueue` are updated correctly, with clear error messages pointing to generated tasks if applicable.

## Phase 3: The Dashboard-Driven Web App (Frontend)

**Goal:** To build the user interface that sits on top of the powerful backend engine.

**1. Build Core UI Framework**
    *   **Action:** Set up the main HTML file, CSS framework, and client-side JavaScript for the Single Page Application (SPA).

**2. Implement System Health Widget**
    *   **Action:** Create the UI for the "System Health" widget on the main dashboard.
    *   **Detail:** The widget will display the count of failed jobs from `SysJobQueue` and the status from the last configuration health check. It will include a button to trigger the health check function.

## Phase 4: Testing, Integration & Deployment

**Goal:** To connect, test, and launch the new system.
