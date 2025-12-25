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

### 2.1. Frontend: The Single-Page Application Shell

The entire user interface is a modern, dashboard-driven Single Page Application (SPA) built on Google Apps Script's `HtmlService`. The main entry point is `AppView.html`, which serves as the application shell.

*   **Application Shell:** `AppView.html` contains the persistent UI elements, including the main header and the navigation sidebar.
*   **Dynamic Content:** The main content area within the shell is dynamically populated by loading other HTML files (e.g., `AdminDashboardView.html`, `PackingSlipView.html`) into it via client-side JavaScript (`google.script.run`). This approach avoids full page reloads and creates a responsive user experience.
*   **Dashboard Paradigm:** The initial view loaded is a dashboard composed of several "widgets," with each widget representing a major functional area of the system (e.g., Orders, System Health). This provides a centralized, at-a-glance overview of all system operations.

### 2.1.1. WebApp Controller Architecture

To ensure a clear separation of concerns, the interface between the HTML Views and the backend is managed by a flexible, multi-layered controller architecture.

**Guiding Principles:**

*   **Separate HTML Views for Roles:** For workflows where different user roles (e.g., admin, manager) have distinct actions, separate HTML files are used for each role's screen (e.g., `AdminInventoryView.html`, `ManagerInventoryView.html`). This keeps the HTML for each role clean and simple.
*   **Shared Logic:** To avoid code duplication, logic is shared at either the Controller or Data Provider layer, depending on the complexity of the views.

**Controller Patterns:**

**1. Shared View Controller (Preferred for Related Workflows):**
*   When multiple views are closely related and part of the same workflow (e.g., admin and manager views for Inventory), they may share a single View Controller script (e.g., `WebAppInventory.js`).
*   **Responsibility:** This shared controller contains all the backend functions required by *all* associated views. It is organized with clear, descriptive function names to distinguish which view and action a function supports (e.g., `getManagerInventoryTasks()`, `acceptAdminCounts()`).
*   **Benefit:** This reduces the number of `.js` files in the project.

**2. Dedicated View Controller:**
*   For standalone or highly complex views, a dedicated View Controller script may be used (e.g., `WebAppDashboard.js` for `Dashboard.html`).
*   **Responsibility:** This script is responsible *only* for the data and actions of its specific view.

**Data Providers:**
Regardless of the controller pattern used, View Controllers call upon **Data Providers** (e.g., `WebAppTasks.js`, `WebAppProducts.js`). These are reusable, internal libraries that contain functions to fetch data from backend *Services* and format it for UI consumption.

**Data Flow:**
The data flow is typically: `HTML View` -> `View Controller (Shared or Dedicated)` -> `Data Provider(s)` -> `Backend Service(s)`.

### 2.1.2. Client-Side Patterns

*   **HTML Generation via JavaScript:** To prevent duplicating markup in separate but similar HTML files (e.g., an inventory list seen by both an admin and a manager), shared JavaScript functions can be used to generate the HTML for common components. These functions are called from the client-side script within each HTML view, passing parameters to control variations (e.g., making a field read-only for an admin).

### 2.2. Backend: API-Driven & Service-Oriented

The backend is designed as a collection of services that are controlled by a single API endpoint.

*   **API Endpoint:** A single `doPost(e)` function acts as the router for all incoming requests from the frontend. It inspects the request (`{action: '...', payload: {...}}`) and routes it to the appropriate service.
*   **Service Layer:** The core logic is broken down into the following services:
    *   **`OrchestratorService`**: Manages the time-driven trigger, scans for new files, checks the `FileRegistry`, and initiates the correct workflows.
    *   **`ProductService`**: Handles core product data management, including the validation and integrity checks for the product onboarding and SKU change workflows.
    *   **`OrderService`**: Manages the entire order lifecycle. It handles the import and upsert of order data into the master sheets and is the master controller of the processing state machine in `SysOrdLog`, setting the initial `Eligible` or `Ineligible` status based on defined business rules.
    *   **`PackingSlipService`**: Acts as an enrichment engine. It scans `SysOrdLog` for `Eligible` orders, gathers all necessary data for printing, enriches it with descriptive text, and places the result in `SysPackingCache`. Upon completion, it updates the order's status in `SysOrdLog` to `Ready`.
    *   **`PrintService`**: Handles the final document generation. It reads pre-processed data from `SysPackingCache` for orders marked as `Ready`. For each order, it copies a designated Google Doc template, populates the copy with the order's specific data, and saves the result as a new Google Doc in an output folder. It then completes the workflow by setting the order's status in `SysOrdLog` to `Printed`.
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
    *   **`ValidationService`**: Provides a central suite of tools for running all types of system validations.
        *   **Legacy Comparisons:** Validates the `jlmops` system against the legacy system to ensure consistent outputs.
        *   **System Integrity Checks:** Performs critical master-to-master validations (e.g., row count disparities, SKU existence across master sheets, data completeness) on the internal `jlmops` data.
        *   **Generic Rule Execution:** Centralizes the execution logic for configurable validation rules (defined by `test_type` in `SysConfig`), making it the single engine for executing validation rules.
*   **`AuditService`**: Manages stock levels for various locations (Brurya, Storage, Office, Shop) in the `SysProductAudit` sheet (prefix `pa_`).

### 2.5.5. Validation Architecture

The system runs validation suites at strategic points to ensure data integrity.

**Validation Suites:**

| Suite | Trigger | Purpose |
|-------|---------|---------|
| `web_staging` | Web product import | Validate before WebProdM upsert |
| `web_xlt_staging` | Translation import | Validate before WebXltM upsert |
| `order_staging` | Order import | Validate before WebOrdM upsert |
| `comax_staging` | Comax import | Validate before CmxProdM upsert |
| `master_master` | End of sync + housekeeping | Cross-system consistency check |

**Rule Types:**
- `EXISTENCE_CHECK`: Verify records exist across sheets
- `FIELD_COMPARISON`: Compare field values between sheets
- `INTERNAL_AUDIT`: Check data quality within a single sheet
- `ROW_COUNT`: Detect unexpected row count changes

### 2.5.6. Housekeeping Phases

Daily maintenance runs in three phases:

**Phase 1: Cleanup**
- `cleanOldLogs()` - Archive old SysLog entries (keep 1000 recent)
- `archiveCompletedTasks()` - Move done tasks to archive
- `archiveCompletedOrders()` - Move old orders to archive
- `manageFileLifecycle()` - Trash old export files
- `cleanupImportFiles()` - Archive processed import files

**Phase 2: Validation & Testing**
- Run `master_master` validation suite
- Run unit tests via `TestRunner.runAllTests()`
- Run schema validation via `ValidationLogic.validateDatabaseSchema()`
- Update `task.system.health_status` with results

**Phase 3: Service Updates**
- `checkBundleHealth()` - Bundle inventory alerts
- `checkBruryaReminder()` - Brurya warehouse reminder
- `refreshCrmContacts()` - Update contact metrics
- `runCrmIntelligence()` - Generate campaign suggestions

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

*   **Dependency Management:** To enforce a strict processing sequence for automated imports, the configuration supports defining dependencies as a separate row within an `import.drive.*` configuration block. For example, a row with `scf_P01` set to `depends_on` and `scf_P02` specifying the `scf_SettingName` of the prerequisite job (e.g., `import.drive.web_translations_he`) ensures that the current job (e.g., `import.drive.web_products_en`) will not be processed until its dependency is met.

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

#### 2.5.4. System-State-Aware Workflow Orchestration

To ensure data integrity and provide robust control over all system processes, the engine has evolved from a simple file-import utility to a **System-State-Aware Orchestrator**. It manages a queue of "Jobs" which can be triggered by various system events.

**Job & Task Model:**
*   **Jobs (`SysJobQueue`):** Represent specific, automated processes run by a service (e.g., importing a file, exporting data). Jobs have statuses like `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, and `BLOCKED`.
*   **Tasks (`TaskQ`):** Represent signals or units of work. They can be created manually by users or programmatically by the system. They act as triggers or gates for other processes. For orchestration purposes, a task is a simple flag; it does not store detailed data.

**Trigger Types and Workflow:**

The orchestrator initiates and manages jobs based on three distinct trigger types:

1.  **File-Based Triggers (for Imports):**
    *   **Event:** An automated, time-based trigger scans Google Drive for new or updated files (e.g., `comax_products.csv`).
    *   **Action:** For each new file, a corresponding import job is created in the `SysJobQueue`.
    *   **Dependency:** If an import job has a `depends_on` property in its configuration, the job is created with a `BLOCKED` status until its prerequisite job is `COMPLETED`.

2.  **State-Based Triggers (for Exports):**
    *   **Event:** The completion of a prerequisite job (e.g., a `Web Order Import`). This is hooked into the `unblockDependentJobs` function in the `OrchestratorService`.
    *   **Action:** The service checks the application's state (e.g., queries `OrderService` for pending orders).
    *   **Logic:** If the state condition is met (e.g., orders are pending), the service checks if a relevant task (e.g., "Comax Order Export") is already open. If not, it creates one, signaling that the export job is ready to be run.

3.  **Paired-Job Triggers (for Complex Exports):**
    *   **Event:** The completion of *either* of two related jobs (e.g., `Web Product Import` or `Comax Product Import`).
    *   **Action:** The orchestrator performs a "paired check" to verify that the counterpart job has also recently completed by checking their timestamps in the `SysJobQueue`.
    *   **Logic:** If the pair is confirmed, a state-based check is performed, and a task is created for the dependent export (e.g., "Web Inventory Export").

**Execution & UI Integration:**
*   The `OrchestratorService` processes `PENDING` jobs from the queue.
*   The UI acts as a dashboard, reflecting the state managed by the orchestrator. It queries the backend for the status of jobs and tasks to dynamically enable/disable action buttons, ensuring users can only perform actions that are valid for the system's current state.
*   Upon job completion, the orchestrator is notified, and it runs its unblocking/trigger logic to advance the next stage of the relevant workflow.

## 3. Security & Authentication

The system leverages Google's native security infrastructure for robust and seamless user management.

### 3.1. Authentication

User authentication is handled entirely by Google's account system. The web app is deployed to only be accessible to users within the organization's Google Workspace domain. This eliminates the need for a separate, custom login system and ensures that only authorized company personnel can access the application.

### 3.2. Identification & Authorization

*   **Identification:** The `AuthService.js` service is responsible for identifying the current user by calling `Session.getActiveUser().getEmail()`.
*   **Authorization:** The service determines the user's role (`admin`, `manager`, or `viewer`) by looking up their email in the `system.users` configuration, which is defined in `SysConfig`. If a user is not found, they are assigned the 'viewer' role, which grants no access.
*   **UI-Based Role Switching:** For development and testing, the UI includes a dropdown menu that displays all users defined in the `system.users` configuration. Selecting a user from this dropdown reloads the UI with that user's role and permissions, allowing developers to easily test the application from different perspectives. Full user impersonation is a potential future enhancement but is not part of the current implementation.

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

### 6.1. Configuration as Code: A Hybrid Approach

The system employs a hybrid "Configuration as Code" model to balance maintainability, safety, and the specific requirements of the Google Apps Script environment.

*   **Primary Source of Truth (`SysConfig.json`):** The ultimate source of truth for all system configuration is a JSON file named `jlmops/SysConfig.json` located in the project root. This file contains all configuration data in a structured, human-readable format. **This is the only file that should be manually edited for configuration changes.**

*   **Build Process (`generate-config.js`):** A local Node.js script, `generate-config.js`, serves as a build step. This script reads `jlmops/SysConfig.json`, validates its structure, and generates the `jlmops/SetupConfig.js` file.

*   **Generated Artifact (`SetupConfig.js`):** The `jlmops/SetupConfig.js` file is a **machine-generated artifact**. It should **not** be edited manually. It contains the `getMasterConfiguration()` function, which returns the configuration data as a hardcoded JavaScript array. This file is committed to version control alongside `SysConfig.json` to ensure that the deployed code is always in sync with the configuration source.

*   **Deployment and Execution:** The standard `clasp push` command deploys the generated `SetupConfig.js` to the Google Apps Script project. The existing `rebuildSysConfigFromSource()` function is then run, which reads from the generated script to populate the live `SysConfig` Google Sheet.

This architecture ensures:
1.  **Safety:** Manual edits are made to a simple data file (JSON), not a complex script file, dramatically reducing the risk of syntax errors that could break the application.
2.  **Maintainability:** The JSON format is easier to read, edit, and manage under version control.
3.  **Consistency:** The build step guarantees that the deployed code is always a direct and valid representation of the master configuration.

### 6.2. `ConfigService.js` and Caching

The `ConfigService.js` is the universal service for accessing configuration values. It contains important caching behavior.

*   **Parsing:** On its first run, `ConfigService` reads the entire `SysConfig` sheet into memory. It parses the multi-column format, respects the `scf_status` column (only loading `stable` or `locked` records by default), and builds a structured JavaScript object. It includes special handling for `system.users` to ensure it is parsed as an array of objects.
*   **Caching:** The parsed configuration object is cached in a script-level variable for the duration of the script execution. All subsequent calls to `ConfigService.getConfig()` or `ConfigService.getAllConfig()` read from this cache, avoiding repeated spreadsheet reads.
*   **Forcing a Reload:** If the `SysConfig` sheet is changed during a script's execution (which should only happen in specific admin/debug workflows), the cache can be invalidated by calling `ConfigService.forceReload()`. This will cause the service to re-read the spreadsheet on the next configuration request.

### 6.3. Spreadsheet Read/Write Timing (`SpreadsheetApp.flush()`)

Google Apps Script batches spreadsheet operations for performance. A `setValues()` call does not guarantee the data is immediately saved. This can create timing issues (race conditions) where a subsequent `getValues()` call reads stale data from before the write occurred.

*   **The Rule:** If a script performs a write operation (e.g., `setValues()`) and a subsequent step in the *same execution* needs to read that data, you **must** call `SpreadsheetApp.flush()` immediately after the write operation.
*   **Example:** The `OrderService` writes new line items to the `WebOrdItemsM` sheet and then immediately calls `prepareInitialPackingData`, which reads from that same sheet. A `SpreadsheetApp.flush()` is required after the write to `WebOrdItemsM` to guarantee `prepareInitialPackingData` reads the newly written items.
*   **Impact of Not Flushing:** Failure to use `flush()` in these situations can lead to intermittent, hard-to-diagnose bugs where data appears to be missing, but the issue disappears when execution is slowed down by logging or debugging.