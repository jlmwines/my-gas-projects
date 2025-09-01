# Implementation Plan

This document outlines the high-level, phased plan for building the JLM Operations Hub.

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

1.  **Build Core Services:** Implement the backend logic for all the services:
    *   `OrchestratorService`
    *   `ProductService`
    *   `OrderService`
    *   `CategoryService`
    *   `WpmlService`
    *   `BundleService`
    *   `PromotionsEngineService`
    *   `TaskService`
    *   `HousekeepingService`
    *   `InventoryManagementService` (for Brurya and other managed stock)
        *   `KpiService` (for calculating and storing KPIs)
        *   `CampaignService` (for managing promotions)
    *   `LoggerService` (for centralized logging and alerting)
2.  **Implement Adapters:** Build the `ComaxAdapter` to clean incoming data and the `WooCommerceFormatter` to create the complex export files.
3.  **Activate the Orchestrator:** Implement the file-watching `OrchestratorService` and set up the time-driven trigger.

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
