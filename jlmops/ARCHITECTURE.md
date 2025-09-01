# System Architecture

This document provides a detailed overview of the technical architecture for the JLM Operations Hub.

## 1. Core Principles

The system is designed around four core principles:

1.  **Separation of Concerns:** Logic is separated into distinct layers (UI, Business Logic, Data Access), making the system easier to maintain.
2.  **Configuration as Data:** Hardcoded values are eliminated. All settings, rules, and mappings are stored in Google Sheets, allowing for updates without code changes.
3.  **Service-Oriented Design:** The backend is composed of modular, independent services that each handle one specific area of responsibility.
4.  **Event-Driven Automation:** The system is proactive, driven by automated triggers that watch for events (like new files) rather than waiting for manual user input.

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
    *   **`ProductService`**: Handles core product data management and the "Product Relationship Manager" for linking/unlinking products.
    *   **`OrderService`**: Manages the entire order lifecycle, including import, status merging, and preparing data for the Comax export.
    *   **`CategoryService`**: Contains the rules engine for dynamically determining web categories based on Comax attributes.
    *   **`WpmlService`**: Encapsulates the specific rules for handling multilingual data to ensure compatibility with WPML.
    *   **`BundleService`**: Manages the Bundle Planning Hub, including checking component stock and sending notifications.
    *   **`PromotionsEngineService`**: Automatically calculates dynamic cross-sell and up-sell links during the sync process.
    *   **`TaskService`**: Manages the creation, updating, and assignment of all tasks (product, content, etc.) in the `TaskQ`.
    *   **`HousekeepingService`**: Contains all logic for scheduled data cleanup and archiving.
    *   **`InventoryManagementService`**: Manages physical inventory at managed locations (e.g., BruryaStock).
        *   **`KpiService`**: Calculates and stores Key Performance Indicators (KPIs) based on configurable definitions.
    *   **`CampaignService`**: Manages promotional campaigns, their assets (posts, bundles, coupons), and the associated tasks.

### 2.3. Data Adapters & Formatters

To keep the core services clean, we use an adapter/formatter pattern to handle messy external data.

*   **`ComaxAdapter`**: Ingests raw, Hebrew-language CSV data from Comax. It cleans the data (e.g., handles `null` inventory), translates headers, and produces clean, standardized product objects for the rest of the system to use.
*   **`WooCommerceFormatter`**: Takes the clean, processed product objects from our system and formats them into the complex, multi-column CSV file required by WooCommerce for import.

### 2.4. Data Store: Google Sheets

Google Sheets serves as the system's primary database. A central **Reference Spreadsheet** contains all master data, logs, and configuration.

*   **Master Data:** `WebProdM`, `CmxProdM`, `WebOrdM`, etc.
*   **Business Logic as Data:** `CategoryMapping`, `BundleComposition`, `ProductLinks`.
*   **System State & Logs:** `TaskQ`, `FileRegistry`, `OrderLog`.
*   **Configuration:** A central `Config` sheet holds all system settings.

### 2.5. Triggering Mechanism: The Orchestrator

The system is initiated by a single, time-driven trigger that runs the `OrchestratorService` every 5-15 minutes. This makes the entire system event-driven and removes the need for manual initiation of routine tasks.

*   **File Watching:** The orchestrator scans Google Drive folders for new or modified files.
*   **Idempotency:** The `FileRegistry` sheet ensures that the same file is never processed more than once, making the system safe to re-run.

## 3. Security & Authentication

The system leverages Google's native security infrastructure for robust and seamless user management.

### 3.1. Authentication

User authentication is handled entirely by Google's account system. The web app is deployed to only be accessible to users within the organization's Google Workspace domain. This eliminates the need for a separate, custom login system and ensures that only authorized company personnel can access the application.

### 3.2. Identification & Authorization

*   **Identification:** Once a user is authenticated, the backend can reliably identify them on every request by calling `Session.getActiveUser().getEmail()`. This provides a secure, verified email address for the active user.
*   **Authorization:** This user email serves as the primary key for all role-based access control (RBAC). When a user attempts an action, the relevant backend service checks their email against the system's configuration sheets (e.g., `SysTaskStatusWorkflow`) to determine if their role permits them to perform that action.

### 3.3. Deployment Configuration

To enable this security model, the Google Apps Script project must be deployed with the following settings:
*   **Execute as:** `User accessing the web app`
*   **Who has access:** `Anyone in [YourDomain.com]` (where `[YourDomain.com]` is the organization's domain)

## 4. Error Handling & Resilience

The system is designed to be resilient and transparent about failures, incorporating a three-layered strategy of logging, alerting, and recovery.

### 4.1. Centralized Logging

All significant operations and events are logged to a central `SysLog` sheet. This provides a comprehensive audit trail for debugging and performance monitoring. Key service functions are wrapped in `try/catch` blocks to ensure that both successful (`INFO`) and failed (`ERROR`) operations are captured.

### 4.2. Real-Time Alerting

For critical failures, the system provides immediate notifications via Google Chat. When the central `LoggerService` captures an `ERROR` level event, it automatically sends a concise alert to a pre-configured webhook URL stored in `SysConfig`. This ensures that administrators are notified of problems the moment they occur.

### 4.3. Recovery & Dead Letter Queue

To prevent automated workflows from being halted by a single bad file, the system uses a "Dead Letter Queue" pattern.

*   **Quarantine:** If the `OrchestratorService` encounters a file it cannot process, it automatically moves the file to a designated "Quarantine" folder in Google Drive.
*   **Failed Jobs Log:** A record of the failure is created in the `SysFailedJobs` sheet, detailing the error and the file that caused it.
*   **Admin Dashboard:** A "System Health" widget on the main dashboard displays these failed jobs, allowing an admin to investigate the issue, correct the source file, and trigger a retry directly from the interface.
