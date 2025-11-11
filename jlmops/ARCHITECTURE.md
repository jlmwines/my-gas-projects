# System Architecture

This document provides a detailed overview of the technical architecture for the JLM Operations Hub.

## 1. Core Principles

The system is designed around four core principles:

1.  **Separation of Concerns:** Logic is separated into distinct layers (UI, Business Logic, Data Access), making the system easier to maintain.
2.  **Configuration as Data:** Hardcoded values are eliminated. All settings, rules, and mappings are stored in a central Google Sheet (`SysConfig`), allowing for updates without code changes.
3.  **Configuration-Driven Logic:** The system is driven by its configuration. The logic for handling different data sources (e.g., file imports vs. API imports) is determined by parsing the structured names of the configuration records, rather than being hardcoded.
4.  **Service-Oriented Design:** The backend is composed of modular, independent services that each handle one specific area of responsibility.
5.  **Event-Driven Automation:** The system is proactive, driven by automated triggers that watch for events (like new files) rather than waiting for manual user input.

## 2. Architectural Components

### 2.1. Frontend: The Dashboard-Driven Web App

The entire user interface is a modern, dashboard-driven Single Page Application (SPA) built on Google Apps Script's `HtmlService`. This design provides a centralized, at-a-glance overview of all system operations and guides the user to the most urgent tasks.

*   **The Dashboard Paradigm:** The application opens to a main dashboard that acts as the central hub. The dashboard is composed of several "widgets," with each widget representing a major functional area of the system (e.g., Orders, Managed Inventory, Product Details).
*   **"At-a-Glance" Health Status:** Each widget provides a high-level summary of its area and is designed to surface critical information immediately. Urgent matters, such as "5 New Orders to Pack" or "Critical items out of stock," are highlighted with clear visual cues like red banners or numbers.
*   **Drill-Down Navigation:** The dashboard allows for two levels of navigation. Clicking on a widget's general area takes the user to a topic summary page. Clicking directly on an urgent notice takes the user straight into the specific "workflow action page" required to handle that task.
*   **Standard Page Layout:** All workflow action pages share a consistent two-part layout:
    *   **Main Content Area:** This area holds the data being acted upon, such as a list of orders or the inventory grid.
    *   **Sidebar:** A persistent sidebar contains all controls for the current view (e.g., "Add Product," "Submit Changes" buttons), as well as relevant notifications and navigation links to return to the dashboard or other pages.

### 2.2. Backend: API-Driven & Service-Oriented

The backend is designed as a collection of services that are controlled by a single API endpoint.

*   **API Endpoint:** A single `doPost(e)` function acts as the router for all incoming requests from the frontend. It inspects the request (`{action: '...', payload: {...}}`) and routes it to the appropriate service.
*   **Service Layer:** The core logic is broken down into the following services:
    *   **`OrchestratorService`**: Manages the time-driven trigger, scans for new files, checks the `FileRegistry`, and initiates the correct workflows.
    *   **`ProductService`**: Handles core product data management, including the validation and integrity checks for the product onboarding and SKU change workflows.
    *   **`OrderService`**: Manages the entire order lifecycle. It handles the import and upsert of order data into the master sheets and is the master controller of the processing state machine in `SysOrdLog`, setting the initial `Eligible` or `Ineligible` status based on defined business rules.
    *   **`PackingSlipService`**: Acts as an enrichment engine. It scans `SysOrdLog` for `Eligible` orders, gathers all necessary data for printing, enriches it with descriptive text, and places the result in `SysPackingCache`. Upon completion, it updates the order's status in `SysOrdLog` to `Ready`.
    *   **`PrintService`**: Handles the final document generation. It reads pre-processed data from `SysPackingCache` for orders marked as `Ready`. For each order, it copies a designated Google Sheet template, populates the copy with the order's specific data, and saves the resulting Google Sheet in an output folder. It then completes the workflow by setting the order's status in `SysOrdLog` to `Printed`.
    *   **`CategoryService`**: Contains the rules engine for dynamically determining web categories based on Comax attributes.
    *   **`WpmlService`**: Encapsulates the specific rules for handling multilingual data to ensure compatibility with WPML.
    *   **`BundleService`**: Manages the entire lifecycle of product bundles. This service uses a rules-based engine defined in the Data Model (`SysBundlesM`, `SysBundleRows`, `SysBundleActiveComponents`). Its primary responsibilities include:
        *   Monitoring the stock levels of all SKUs listed in `SysBundleActiveComponents`.
        *   If an active component is low on stock, it consults the eligibility rules for that bundle slot (defined in `SysBundleRows`) to find and suggest suitable replacements.
        *   Creating tasks via the `TaskService` to alert users to low-stock situations and provide replacement suggestions.
        *   Logging all component changes to the `SysBundleComponentHistory` sheet to provide a complete audit trail.
    *   **`PromotionsEngineService`**: Automatically calculates dynamic cross-sell and up-sell links during the sync process.
    *   **`TaskService`**: Manages the creation, updating, and assignment of all tasks (product, content, etc.) in the `TaskQ`.
    *   **`HousekeepingService`**: Contains all logic for scheduled data cleanup and archiving.
    *   **`InventoryManagementService`**: Manages physical inventory at managed locations (e.g., BruryaStock).
    *   **`KpiService`**: Calculates and stores Key Performance Indicators (KPIs) based on configurable definitions.
    *   **`CampaignService`**: Manages promotional campaigns, their assets (posts, bundles, coupons), and the associated tasks.
    *   **`LoggerService`**: Handles centralized logging to the `SysLog` sheet and sends real-time alerts.
    *   **`ValidationService` (New)**: Provides a suite of tools for validating the `jlmops` system against the legacy system. Its purpose is not to validate raw data, but to compare the final outputs of key business logic (e.g., on-hold inventory calculations, packing slip data, Comax export values) to ensure the new system produces identical results.
*   **`AuditService`**: Manages stock levels for various locations (Brurya, Storage, Office, Shop) in the `SystemAudit` sheet.

### 2.3. Data Adapters & Formatters

To keep the core services clean, we use an adapter/formatter pattern to handle messy external data.

*   **`ComaxAdapter`**: Ingests raw, Hebrew-language CSV data from Comax. It cleans the data (e.g., handles `null` inventory), translates headers, and produces clean, standardized product objects for the rest of the system to use.
*   **`WebAdapter`**: Ingests raw data from WooCommerce CSV files. It is responsible for parsing the input file and mapping its columns to the wider schema of the corresponding staging sheet (e.g., `WebProdS_EN`). This adapter is key to the system's resilience, as it isolates the core logic from changes in the external file format.
*   **`WooCommerceFormatter`**: Takes the clean, processed product objects from our system and formats them into the complex, multi-column CSV file required by WooCommerce for import. This includes handling special flags like `IsSoldIndividually`.

### 2.4. Migration Utilities (New)

*   **`migration.js`**: This script contains utilities specifically for the parallel implementation phase, allowing for safe, on-demand data synchronization from the legacy system.
    *   **`syncLegacyMasterData(dataType)`**: A generic function that performs a non-destructive upsert from a legacy master sheet to a `jlmops` master sheet. It is fully driven by `SysConfig` definitions (see `migration.sync.tasks` in `DATA_MODEL.md`) and is executed manually from the script editor.

### 2.5. Data & Workflow Architecture

The system's architecture is designed to be entirely driven by its configuration.

#### 2.5.1. Configuration Discovery & Schema

*   **Dynamic Discovery:** At runtime, the system bootstraps itself by searching Google Drive for the `JLMops_Data` spreadsheet by its exact name. It then reads the `SysConfig` sheet within it to load all settings.
*   **Universal Schema:** The `SysConfig` sheet uses a universal, block-based schema. This allows it to define simple key-value settings or complex, multi-row configurations in a consistent way.
    *   **`scf_SettingName` (Grouping Key):** All rows belonging to a single configuration share the same `SettingName`.
    *   **`scf_P01` (Property / Block Type):** This column defines the specific property or type of block this row represents within the group.
    *   **`scf_P02` onwards (Values):** These columns hold the values for the given property.
*   **Robustness and Data Integrity:** Recent efforts have focused on solidifying the `SysConfig` implementation. This included resolving issues with `ConfigService.js` to ensure accurate parsing of all `scf_Pxx` parameters, correcting missing `system.sheet_names` entries, and deduplicating task definitions within `SetupConfig.js`. These improvements have successfully restored the full functionality of critical import processes, including Web Order, Web Product, Web Translation, and Comax Product imports, ensuring `SysConfig` remains the reliable source of truth.
*   **Example:** A file import is defined by multiple rows sharing the `SettingName` `import.drive.comax_products`. One row might have `P01` set to `source_folder_id` and `P02` as the folder ID, while another row has `P01` set to `file_pattern` and `P02` as the file name. This schema is flexible enough to define any configuration the system needs, from business rules to document templates.

##### 2.5.1.1. Configuration State Management

To ensure stability and prevent accidental modifications to the live system during development, the `SysConfig` sheet includes a state management mechanism implemented via the `scf_status` column.

*   **`scf_status`:** This column on each configuration row defines its state. The possible values are:
    *   `stable`: The default state for a reliable, tested configuration record. These are loaded by default.
    *   `locked`: A record that is considered final and should not be modified by any script. This provides an extra layer of protection for critical settings. Loaded by default.
    *   **Implementation-Specific Tags (e.g., `dev_phase_2`, `test_feature_x`):** These tags are used to isolate new or modified configurations during development. Records with these tags are only loaded when explicitly requested by a script, ensuring that in-progress work does not affect the stable system.

*   **Configuration Loading:** The `ConfigService` is responsible for enforcing this state management. By default, it will only load records marked as `stable` or `locked`. During development, services can specifically request to include records with a certain implementation tag, allowing for safe, parallel development and testing.

*   **Situational Awareness (The "Read First, Then Act" Principle):** To ensure safe and context-aware administrative actions (both manual and automated), the system adopts a **"Read First, Then Act"** principle. Before any operation that depends on system configuration is planned or executed, the agent or script must first retrieve a complete snapshot of the live `SysConfig` data (e.g., via `ConfigService.getSysConfigSnapshot()`). This ensures all actions are grounded in the current reality of the system's state, preventing errors caused by outdated assumptions.

#### 2.5.2. Two-Spreadsheet Data Store

To ensure high performance, the system utilizes two separate Google Spreadsheets:

1.  **`JLMops_Data` (Main Data Spreadsheet):**
    *   **Purpose:** Stores core business data and the master `SysConfig` sheet.
    *   **Contents:** Master data sheets (`WebProdM`, `CmxProdM`), business rule definitions (`CategoryMapping`), and `SysConfig`.

2.  **`JLMops_Logs` (Log & Job Spreadsheet):**
    *   **Purpose:** Dedicated to high-volume, append-only data. Its ID is specified in the `SysConfig` sheet.
    *   **Contents:** `SysJobQueue`, `SysFileRegistry`, `SysLog`.

#### 2.5.3. Google Drive Folder Structure

The system relies on a clear folder structure for managing files, with all folder IDs specified in the `SysConfig` sheet.

*   **`Source Folder`**: The inbox for new files. The system treats this as **read-only**.
*   **`Archive Folder`**: The system's permanent record for all ingested files.

#### 2.5.4. Event-Driven Workflow Engine

The system is driven by a time-based trigger that initiates a two-phase workflow.

**Phase 1: Intake (Performed by `OrchestratorService`)**

*   **Goal:** To securely discover, ingest, and queue new files.
1.  **Load Config:** The service finds and parses the `SysConfig` sheet.
2.  **Scan Sources:** It iterates through all `import.drive.*` configurations and scans the specified `Source Folder`.
3.  **Check Registry:** It compares files against the `SysFileRegistry` to see if they are new.
4.  **Copy to Archive:** New file versions are copied to the `Archive Folder`.
5.  **Queue Job:** A new job is created in the `SysJobQueue`.
6.  **Update Registry:** The `SysFileRegistry` is updated to prevent re-ingestion.

**Phase 2: Execution (Performed by specific `ProcessingServices`)**

*   **Goal:** To execute the business logic for a queued job.
1.  **Query Queue:** A service (e.g., `ProductService`) queries the `SysJobQueue` for 'PENDING' jobs of its type.
2.  **Claim Job:** It claims a job by updating its status to 'PROCESSING'.
3.  **Process from Archive:** It performs all business logic using the data from the file in the **Archive Folder**.
4.  **Handle Outcome:**
    *   **On Success:** The job status is updated to 'COMPLETED'.
    *   **On Failure:** The job status is updated to 'FAILED' and the error is logged. The file remains in the `Archive Folder`.

## 3. Security & Authentication

The system leverages Google's native security infrastructure for robust and seamless user management.

### 3.1. Authentication

User authentication is handled entirely by Google's account system. The web app is deployed to only be accessible to users within the organization's Google Workspace domain. This eliminates the need for a separate, custom login system and ensures that only authorized company personnel can access the application.

### 3.2. Identification & Authorization

*   **Identification:** Once a user is authenticated, the backend can reliably identify them on every request by calling `Session.getActiveUser().getEmail()`. This provides a secure, verified email address for the active user.
*   **Authorization:** This user email serves as the primary key for all role-based access control (RBAC). When a user attempts an action, the relevant backend service checks their email against the system's configuration sheets (e.g., `SysTaskStatusWorkflow`) to determine if their role permits them to perform that action.

### 3.2.1. Developer Impersonation (Development Only)

To facilitate testing of different user roles without requiring multiple Google accounts, a development-only impersonation feature has been implemented.

*   **`AuthService.js`**: A new centralized service has been created to handle user identification. All parts of the application that need to identify the current user **must** call `AuthService.getActiveUserEmail()` instead of `Session.getActiveUser().getEmail()`.

*   **Impersonation Mechanism**: The `doGet(e)` function in `WebApp.js` calls `AuthService.handleImpersonation(e)`. This function checks for a URL parameter `test_user`.
    *   If `?test_user=email@domain.com` is present in the web app's URL, the `AuthService` will store this email in the current user's `PropertiesService`.
    *   The `AuthService.getActiveUserEmail()` function will then return this stored email for all subsequent backend calls, effectively impersonating that user for the current session.
    *   To clear the impersonation, navigate to the web app URL with `?clear_impersonation=true`.

*   **Security Warning**: This feature is intended **strictly for development and testing purposes**. It allows a developer to test the UI and permissions of different roles easily. It should be disabled or secured before the application is considered production-ready.

### 3.3. Deployment Configuration

To enable this security model, the Google Apps Script project must be deployed with the following settings:
*   **Execute as:** `User accessing the web app`
*   **Who has access:** `Anyone in [YourDomain.com]` (where `[YourDomain.com]` is the organization's domain)

## 4. Error Handling & Resilience

The system is designed to be resilient and transparent about failures, incorporating a three-layered strategy of logging, alerting, and recovery.

### 4.1. Centralized Logging

All significant operations and events are logged to the `SysLog` sheet in the dedicated `JLMops_Logs` spreadsheet. This provides a comprehensive audit trail for debugging and performance monitoring. Key service functions are wrapped in `try/catch` blocks to ensure that both successful (`INFO`) and failed (`ERROR`) operations are captured.

### 4.2. Real-Time Alerting

For critical failures, the system provides immediate notifications via Google Chat. When the central `LoggerService` captures an `ERROR` level event, it automatically sends a concise alert to a pre-configured webhook URL stored in `SysConfig`. This ensures that administrators are notified of problems the moment they occur.

### 4.3. Recovery & Dead Letter Queue

To prevent a single bad file from halting a workflow, the system uses the **`SysJobQueue`** as a "Dead Letter Queue".

*   **Failed Jobs Log:** The `SysJobQueue` sheet itself serves as the failed jobs log. If a `ProcessingService` fails to process a job, it updates that job's `status` to 'FAILED' and records the specific error message in the job's record.

*   **File Inspection:** The problematic file remains untouched in its original location within the `Archive Folder`. An administrator must use the `archive_file_id` from the failed job record to locate the exact file for inspection.

*   **Admin Dashboard:** A "System Health" widget on the main dashboard will query the `SysJobQueue` for any jobs with a 'FAILED' status, providing a centralized view of all processing failures.

### 4.4. Manual Recovery

System configuration or data integrity is managed via manual backup and restore procedures for the Google Sheets. The `setup.js` script is a tactical tool used only during development for specific, one-off implementation steps and is not part of the production system's resilience strategy.

## 5. Design Decisions

This section documents key design decisions to clarify the system's behavior and prevent misinterpretation.

### 5.1. Non-Destructive File Processing

To ensure the JLM Operations Hub can run in parallel with existing systems, all automated file processing is **non-destructive**. The system **will not** move, rename, or alter any input files. 

Specifically for the Comax Products import, the workflow identifies new file versions by checking the file's last-updated timestamp against the `SysFileRegistry`. The `comax.products.processedFolder` setting found in previous versions of `setup.js` is deprecated and should not be used.

## 6. Configuration Management & Data Handling

This section outlines the critical rules and patterns for managing the system's configuration and handling spreadsheet data to ensure stability and prevent common errors.

### 6.1. `SetupConfig.js` as the Single Source of Truth

The `SysConfig` Google Sheet is the live configuration for the application, but it is not the master source of truth.

*   **Master Source:** The JavaScript file `jlmops/SetupConfig.js` is the **single source of truth** for all system configuration. The master configuration is defined as a hardcoded array within the `getMasterConfiguration()` function.
*   **Update Workflow:** To make any changes to the system's configuration (including UI templates, validation rules, or sheet names), you **must** edit the array in `SetupConfig.js`. After the script is updated and pushed, an administrator must run the `rebuildSysConfigFromSource()` function from the Apps Script editor. This function will completely overwrite the `SysConfig` sheet with the data from the script.
*   **Warning:** Manual edits to the `SysConfig` sheet will be lost the next time `rebuildSysConfigFromSource()` is run. Do not edit the sheet directly.

### 6.2. `ConfigService.js` and Caching

The `ConfigService.js` is the universal service for accessing configuration values. It contains important caching behavior.

*   **Parsing:** On its first run, `ConfigService` reads the entire `SysConfig` sheet into memory. It parses the multi-column format, respects the `scf_status` column (only loading `stable` or `locked` records by default), and builds a structured JavaScript object.
*   **Caching:** The parsed configuration object is cached in a script-level variable for the duration of the script execution. All subsequent calls to `ConfigService.getConfig()` or `ConfigService.getAllConfig()` read from this cache, avoiding repeated spreadsheet reads.
*   **Forcing a Reload:** If the `SysConfig` sheet is changed during a script's execution (which should only happen in specific admin/debug workflows), the cache can be invalidated by calling `ConfigService.forceReload()`. This will cause the service to re-read the spreadsheet on the next configuration request.

### 6.3. Spreadsheet Read/Write Timing (`SpreadsheetApp.flush()`)

Google Apps Script batches spreadsheet operations for performance. A `setValues()` call does not guarantee the data is immediately saved. This can create timing issues (race conditions) where a subsequent `getValues()` call reads stale data from before the write occurred.

*   **The Rule:** If a script performs a write operation (e.g., `setValues()`) and a subsequent step in the *same execution* needs to read that data, you **must** call `SpreadsheetApp.flush()` immediately after the write operation.
*   **Example:** The `OrderService` writes new line items to the `WebOrdItemsM` sheet and then immediately calls `prepareInitialPackingData`, which reads from that same sheet. A `SpreadsheetApp.flush()` is required after the write to `WebOrdItemsM` to guarantee `prepareInitialPackingData` reads the newly written items.
*   **Impact of Not Flushing:** Failure to use `flush()` in these situations can lead to intermittent, hard-to-diagnose bugs where data appears to be missing, but the issue disappears when execution is slowed down by logging or debugging.
