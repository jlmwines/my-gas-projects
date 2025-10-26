# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub. It is based on the formal design in `ARCHITECTURE.md`.

## Next Task

**Implement "Comax SKU Change" Validation.**

The next step is to implement the validation rule that detects when a SKU for a product sold online has changed in Comax.

*   **Next Step:** Define and implement the `validation.rule.C7_Comax_SKUChange` rule.

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


## Phase 3: Order Workflow Engine (COMPLETED)

**Goal:** To build the complete, automated workflow for ingesting and processing web orders to enable accurate, real-time stock calculations.

*   **Status:** All necessary configurations for the Order Workflow have been added to `setup.js`.
    *   **Immediate Task:** Proceed to Phase 4: Output Generation & Notification.

**Phase 3.8: Add `OrderLogArchive` Support (Additional Step)**
    *   **Action:** In `setup.js`, add the `schema.data.OrderLogArchive` definition to `getMasterConfiguration`.
    *   **Action:** In `setup.js`, create a new function `createOrderLogArchiveHeaders()`.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and `createOrderLogArchiveHeaders()` and verify the results.

**Phase 3.9: Initial Order Data Population**
    *   **Goal:** To populate the JLMops master order sheets (`WebOrdM`, `WebOrdItemsM`, `SysOrdLog`, `OrderLogArchive`) with existing web order data to enable comprehensive testing of downstream processes.
    *   **Action:** Create a new function `populateInitialOrderData()` in `jlmops/setup.js`.
    *   **Detail:** This function will read raw web order data from `WebOrdS`, transform it into the `WebOrdM` and `WebOrdItemsM` schemas, write the data to these sheets, create initial entries in `SysOrdLog`, and move older/completed orders to `OrderLogArchive`.
**Phase 3.10: Initial Product Detail Data Population (New Phase)**

**Objective:** Migrate existing product detail data from the old system's reference sheets (or a file structured similarly) into the JLMops product master sheets.

1.  **Action: Create `populateInitialProductData()` function in `jlmops/setup.js`:**
    *   This function will be designed to read data from sheets (or a file) with the following expected old system headers (inferred from `DetailsReview.gs`):
        *   **For `DetailsM` (old system):** `SKU`, `NAME`, `Short`, `קצר`, `Description`, `תיאור ארוך`, `היתר מכירה`, `ABV`, `Intensity`, `Complexity`, `Acidity`, `Decant`, `G1`, `G2`, `G3`, `G4`, `G5`, `K1`, `K2`, `K3`, `K4`, `K5`, `Mild Har`, `Rich Har`, `Intense Har`, `Sweet Har`, `Mild Con`, `Rich Con`, `Intense Con`, `Intense Con`, `Sweet Con`, `אזור`.
        *   **For `ComaxM` (old system):** `CMX SKU`, `CMX GROUP`, `CMX YEAR`, `CMX SIZE`.
        *   **For `WeHe` (old system):** `wpml:original_product_sku`, `wpml:original_product_id`, `ID`.
    *   It will implement logic to map these old system header names to the JLMops product master sheet headers (`wpm_`, `wdm_`, `cpm_`, `wxl_` prefixes).
    *   It will process and transform this data into the JLMops product master sheets (`WebProdM`, `WebDetM`, `CmxProdM`, `WebXltM`).
    *   It will write the transformed data to these sheets.
2.  **Verification:** Manually run `populateInitialProductData()` and confirm that `WebProdM`, `WebDetM`, `CmxProdM`, and `WebXltM` are populated correctly.
**Phase 3.1: Add `WebOrdS` (Web Order Staging) Support**
    *   **Action:** In `setup.js`, add the `schema.data.WebOrdS` and relevant `map.web.order_columns` definitions to the `getMasterConfiguration` function.
    *   **Action:** In `setup.js`, create a new, self-contained function `setupWebOrdSHeader()` to create the headers for the `WebOrdS` sheet. This function will not be called automatically.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and confirm the new records are in the `SysConfig` sheet. Manually run `setupWebOrdSHeader()` and confirm the sheet is created correctly.

**Phase 3.2: Add `WebOrdM` (Web Orders Master) Support**
    *   **Action:** In `setup.js`, add the `schema.data.WebOrdM` definition to `getMasterConfiguration`.
    *   **Action:** In `setup.js`, create a new function `setupWebOrdMHeader()`.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and `setupWebOrdMHeader()` and verify the results.

**Phase 3.3: Add `WebOrdItemsM` (Web Order Items Master) Support**
    *   **Action:** In `setup.js`, add the `schema.data.WebOrdItemsM` definition to `getMasterConfiguration`.
    *   **Action:** In `setup.js`, create a new function `setupWebOrdItemsMHeader()`.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and `setupWebOrdItemsMHeader()` and verify the results.

**Phase 3.4: Add `SysInventoryOnHold` Support**
    *   **Action:** In `setup.js`, add the `schema.data.SysInventoryOnHold` definition to `getMasterConfiguration`.
    *   **Action:** In `setup.js`, create a new function `setupSysInventoryOnHoldHeader()`.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and `setupSysInventoryOnHoldHeader()` and verify the results.

**Phase 3.5: Add `SysOrdLog` (System Order Log) Support**
    *   **Action:** In `setup.js`, add the `schema.data.SysOrdLog` definition to `getMasterConfiguration`.
    *   **Action:** In `setup.js`, create a new function `setupSysOrdLogHeader()`.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and `setupSysOrdLogHeader()` and verify the results.

**Phase 3.6: Add `SysPackingCache` Support**
    *   **Action:** In `setup.js`, add the `schema.data.SysPackingCache` definition to `getMasterConfiguration`.
    *   **Action:** In `setup.js`, create a new function `setupSysPackingCacheHeader()`.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and `setupSysPackingCacheHeader()` and verify the results.

**Phase 3.7: Add Packing Slip Template Support**
    *   **Action:** In `setup.js`, add the `template.packing_slip` definition to `getMasterConfiguration`.
    *   **Verification:** Manually run `rebuildSysConfigFromSource()` and confirm the new records are in the `SysConfig` sheet.


## Phase 4: Output Generation & Notification (PLANNED)

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