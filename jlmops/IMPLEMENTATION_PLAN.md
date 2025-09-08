# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub.

## Current Implementation Progress

This section details the granular steps being undertaken in the current phase of the implementation. Each step should be a small, verifiable unit of work.

### Phase 1: Foundation & Data Normalization - Detailed Steps

**1. Project Setup & Environment Configuration (COMPLETED)**
    *   **Reference Spreadsheet:** The central Reference Spreadsheet (`1a4aAreab8IdSZjgpNDf0Wj8Rl2UOTwlD525d4Zpc874`) has been designated and its ID stored in script properties.
    *   **Core Sheets Created:** The `setup.js` script has been created to programmatically create all necessary sheets as per `DATA_MODEL.md`.
    *   **System Configuration:** The `SysConfig` sheet has been populated with initial settings for the Comax product import, including input and processed folder IDs.
    *   **File Registry:** The `SysFileRegistry` sheet has been created to ensure idempotent file processing.
    *   **Development Workflow:** The `clasp` and `git` workflows have been established for local development and deployment.

2.  **Address Critical Backend Script Issues (Refactoring for Robustness):**
    *   **Centralize Sheet Names and Column Indices:**
        *   **Goal:** Define all sheet names and column indices in `backend-scripts/Globals.js` (e.g., `G.SHEET_NAMES`, `G.COLUMN_INDICES`).
        *   **Verification:** Ensure all relevant backend scripts (`AdminWorkflow.js`, `AuditLowProducts.js`, `ExportInventory.js`, etc.) are updated to use these global constants instead of hardcoded values.
        *   **Priority:** High (as per `backend-scripts-review.md` point 3).
    *   **Remove Duplicate Code:**
        *   **Goal:** Centralize `restoreSheetsToFile()` (from `Restore.js`) and `setReferenceSetting()` (from `Housekeeping.js` and `PackingSlipData.js`) into a shared utility file (e.g., `backend-scripts/Utils.js`).
        *   **Verification:** Confirm that all call sites are updated to use the centralized functions.
        *   **Priority:** High (as per `backend-scripts-review.md` points 2 and 5).
    *   **Verify `getImportFileDates()`:**
        *   **Goal:** Implement or correct `getImportFileDates()` in `backend-scripts/AdminWorkflow.js` to ensure `runProductsStep` functions correctly.
        *   **Verification:** Test the product import workflow in the staging environment.
        *   **Priority:** Critical (as per `backend-scripts-review.md` point 1).

3.  **Core Data Sheet Creation (Manual/Scripted):**
    *   Create the following sheets in the Reference Spreadsheet, ensuring correct headers as per `DATA_MODEL.md`:
        *   `WebProdM`, `WebDetM`, `CmxProdM`, `WebXlt`, `WebBundles`
        *   `WebOrdS`, `WebOrdM`, `WebOrdItemsM`, `SysOrdLog`, `SysPackingCache`, `SysInventoryOnHold`
        *   `SysTasks`, `SysTaskTypes`, `SysTaskStatusWorkflow`
    *   **Verification:** Visually inspect sheets for correct creation and initial headers.

## Phase 1: Foundation & Data Normalization

**Goal:** To prepare the environment and establish the new, robust data structures before writing any new workflow logic. This is the most critical phase.

1.  **Project Setup:** Create the new, single Google Apps Script project and the central Reference Spreadsheet.
2.  **Configuration & Core Sheets:** Build out all the core data sheets and configuration sheets:
    *   `WebProdM`, `WebDetM`, `CmxProdM`, `WebXlt`, `WebBundles`
    *   `WebOrdS`, `WebOrdM`, `WebOrdItemsM`, `SysOrdLog`, `SysPackingCache`, `SysInventoryOnHold`
    *   `SysConfig`, `SysTasks`, `SysTaskTypes`, `SysTaskStatusWorkflow`
    *   Populate `SysConfig` with all necessary initial settings (file IDs, folder IDs, thresholds, etc.).
3.  **Data Migration:** Write and carefully execute a one-time migration script to normalize the existing data from the old system into the new, structured sheets. This must be tested thoroughly on a copy of the data first.

## Phase 2: Backend Engine & Automation

**Goal:** To build the core automated engine. At the end of this phase, the system will be able to perform its automated syncs "headless," without a UI.

**1. Implement Comax Products Import Workflow**
    *   **`setup.js`:**
        *   **Action:** Create a `setupSysConfig` function to populate the `SysConfig` sheet with structured configuration for the Comax import (folder IDs, file name, encoding).
        *   **Action:** Create a `createFileRegistrySheet` function to create the `SysFileRegistry` sheet with the correct columns (`sfr_FileType`, `sfr_FileID`, `sfr_LastUpdated`, `sfr_ProcessedTimestamp`).
        *   **Status:** Design complete.
    *   **`ComaxAdapter.js`:**
        *   **Action:** Implement a `processComaxProductFile` function that is self-contained and config-driven.
        *   **Detail:** The adapter will be responsible for fetching the raw CSV, patching the known blank header in column O, and transforming the data into clean objects based on an internal column-to-field map.
        *   **Status:** Awaiting implementation.
    *   **`OrchestratorService.js`:**
        *   **Action:** Implement a `processNewComaxProducts` function to manage the import workflow.
        *   **Detail:** The service will use a timestamp-based registry to identify new file versions. It will read the file's last-updated timestamp and compare it to the last-processed timestamp for the "COMAX_PRODUCTS" file type in the `SysFileRegistry`.
        *   **Detail:** The service will be non-destructive and will not move or alter the source file.
        *   **Status:** Awaiting implementation.

**2. Build Core Services (Remaining)**
    *   `ProductService`
    *   `OrderService`
    *   `CategoryService`
    *   `WpmlService`
    *   `BundleService`
    *   `PromotionsEngineService`
    *   `TaskService`
    *   `HousekeepingService`
    *   `InventoryManagementService`
    *   `KpiService`
    *   `CampaignService`
    *   `LoggerService`

**3. Implement Remaining Adapters**
    *   `WooCommerceFormatter`

**4. Activate the Orchestrator Trigger**
    *   Set up the time-driven trigger to run the orchestration services automatically.

## Phase 3: The Dashboard-Driven Web App (Frontend)

**Goal:** To build the user interface that sits on top of the powerful backend engine, providing a seamless and intuitive user experience.

1.  **Scaffold the App:** Create the single `WebApp.html` file and the client-side JavaScript to manage the dashboard and navigation between different workflow pages.
2.  **Connect to Backend:** Implement the `google.script.run` calls to fetch data from and send commands to the backend services.
3.  **Build UI Components:** Develop the user-facing components one by one, following the dashboard-driven design:
    *   The main **Operations Dashboard** with its various widgets.
    *   Specific workflow action pages, such as:
        *   Order Packing & Processing
        *   Brurya Stock Management
        *   Product Detail Verification
        *   Task Management Interface
                *   Bundle Planning Hub
                *   Campaigns Hub (for coordinating promotions)
                *   System Health & Recovery Interface

## Phase 4: Testing, Integration & Deployment

**Goal:** To connect, test, and launch the new system.

1.  **End-to-End Testing:** Test all workflows from file-drop to UI update to final export, using both Admin and Manager roles.
2.  **User Acceptance Testing (UAT):** A crucial step where the real users validate that the system meets their needs.
3.  **Go-Live:** Deploy the final version of the Web App and transition users from the old system to the new Operations Hub.
