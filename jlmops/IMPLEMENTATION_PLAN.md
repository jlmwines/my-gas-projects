# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub. It is based on the formal design in `ARCHITECTURE.md`.

## Phase 1: System Foundation & Setup

**Goal:** To establish the core technical foundation based on the user-managed configuration before any workflow logic is built.

**1. Manual Configuration Setup (User Action)**
    *   **Action:** Create the necessary `Source` and `Archive` folders in Google Drive.
    *   **Action:** Create the `JLMops_Logs` spreadsheet.
    *   **Action:** Populate the `SysConfig` sheet in the `JLMops_Data` spreadsheet using the universal, block-based schema defined in `ARCHITECTURE.md`.
    *   **Verification:** All required configuration blocks for spreadsheets, folders, and import types are present in the `SysConfig` sheet.

**2. Implement Configuration Service (`config.js`)**
    *   **Action:** Create a `config.js` script that provides a central service for reading and accessing configuration values.
    *   **Detail:** This service will find the `JLMops_Data` spreadsheet by name and parse the `SysConfig` sheet. It must be able to read multi-row configuration blocks (grouped by `scf_SettingName`) and return them as structured objects.
    *   **Verification:** The service can successfully read and provide a complete configuration block for any defined setting.

**3. Implement Core Setup Script (`setup.js`)**
    *   **Action:** Create a `setupLogSheets()` function in `setup.js`.
    *   **Detail:** This function will use the `config.js` service to get the `logSpreadsheetId` and then create the `SysJobQueue`, `SysFileRegistry`, and `SysLog` sheets.
    *   **Verification:** When the script is run, the log sheets are correctly created in the `JLMops_Logs` spreadsheet.

## Phase 2: Core Workflow Implementation

**Goal:** To build the primary automated workflow for ingesting and processing Comax product data.

**1. Implement Intake Workflow (`OrchestratorService`)**
    *   **Action:** Implement the `OrchestratorService` to perform the "Intake" phase.
    *   **Detail:** This service will be fully driven by the `import.drive.*` settings from the `config.js` service.

**2. Implement Data Adapter (`ComaxAdapter.js`)**
    *   **Action:** Implement the `ComaxAdapter` to parse the raw `ComaxProducts.csv` file.

**3. Implement Execution Workflow (`ProductService`)**
    *   **Action:** Implement the `ProductService` to handle the "Execution" phase for Comax product jobs.

## Phase 3: The Dashboard-Driven Web App (Frontend)

**Goal:** To build the user interface that sits on top of the powerful backend engine.

## Phase 4: Testing, Integration & Deployment

**Goal:** To connect, test, and launch the new system.
