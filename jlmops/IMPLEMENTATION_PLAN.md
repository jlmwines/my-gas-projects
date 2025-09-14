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

## Phase 2: Core Workflow Implementation

**Goal:** To build the primary automated workflow for ingesting and processing Comax product data.

**1. Implement Intake Workflow (`OrchestratorService`) (COMPLETED)**
    *   **Action:** Implement the `OrchestratorService` to perform the "Intake" phase.
    *   **Detail:** This service is fully driven by the `import.drive.*` settings from the `config.js` service.
    *   **Verification:** The service correctly finds new files, archives them, and creates a 'PENDING' job in the `SysJobQueue`.

**2. Implement Data Adapter (`ComaxAdapter.js`) (COMPLETED)**
    *   **Action:** Implement the `ComaxAdapter` to parse the raw `ComaxProducts.csv` file.

**3. Implement Execution Workflow (`ProductService`) (NEXT UP)**
    *   **Action:** Implement the `ProductService` to handle the "Execution" phase for Comax product jobs.
    *   **Detail:** The service will be called by the Orchestrator for pending jobs. It will use the `ComaxAdapter` to get clean data and populate the `CmxProdS` staging sheet.

**4. Implement Configuration Health Service**
    *   **Action:** Implement the `runHealthCheck()` and `validateCurrentConfig()` functions.
    *   **Detail:** The logic will reside in `HousekeepingService.js` and use the `SYS_CONFIG_DEFINITIONS` global constant to validate the live `SysConfig` sheet.

## Phase 3: The Dashboard-Driven Web App (Frontend)

**Goal:** To build the user interface that sits on top of the powerful backend engine.

**1. Build Core UI Framework**
    *   **Action:** Set up the main HTML file, CSS framework, and client-side JavaScript for the Single Page Application (SPA).

**2. Implement System Health Widget**
    *   **Action:** Create the UI for the "System Health" widget on the main dashboard.
    *   **Detail:** The widget will display the count of failed jobs from `SysJobQueue` and the status from the last `runHealthCheck()`. It will include a button to trigger the health check function.

## Phase 4: Testing, Integration & Deployment

**Goal:** To connect, test, and launch the new system.
