# JLM Operations Hub

## 1. Overview

The JLM Operations Hub is a smart, automated system designed to streamline and unify the entire JLM e-commerce operation. Built on Google Apps Script, it proactively synchronizes product, order, and inventory data between the Comax ERP and the WooCommerce web store. It provides a central, dashboard-driven platform for admins and managers to efficiently manage daily operations, strategic product planning, and inventory control.

## 2. Core Features

*   **Dashboard-Driven Interface:** A modern, intuitive web application centered around a dynamic dashboard that provides at-a-glance health status and direct access to critical workflows.
*   **Automated Order Processing:** A streamlined, efficient workflow for importing web orders, pre-processing data for rapid packing slip generation, and exporting sales data back to Comax. Includes robust handling for order modifications.
*   **Intelligent Inventory Management:** Proactive system for ensuring inventory accuracy. This includes direct management of specific locations like Brurya, automated physical count verification, and real-time tracking of on-hold stock.
*   **Configurable Task Management:** A flexible, data-driven system for generating, assigning, and tracking all system and user-generated tasks, with customizable workflows and status paths.
*   **Data-Driven Product Management:** A robust workflow for managing product data, including automated import, detail verification, and ensuring data consistency across platforms.
*   **Flexible Configuration:** All system settings, business rules, and even KPI definitions are stored in a central, easily configurable sheet, allowing for updates without code changes.
*   **Event-Driven Automation:** The system's core processes are driven by scheduled triggers and file monitoring, ensuring proactive and automated execution of routine tasks.
*   **Campaign Planning & Coordination:** A central hub for planning and executing multi-faceted promotional campaigns, linking product bundles, blog posts, emails, and coupons to a unified timeline.
*   **Secure Google Workspace Authentication:** Leverages Google accounts for secure, seamless login. Access is restricted to users within your organization's domain.
*   **Resilient & Transparent Workflows:** Features centralized logging, real-time error alerting via Google Chat, and a "Dead Letter Queue" system to ensure that automated processes are robust and failures can be recovered from gracefully.

## 3. Architecture Overview

The system is built on Google Apps Script and leverages Google Sheets as its primary database. It follows a robust, maintainable, and scalable architecture:

*   **Frontend:** A dashboard-driven Single Page Application (SPA) providing a unified, widget-based interface with drill-down navigation to specific workflows.
*   **Backend:** An API-driven, service-oriented architecture where business logic is organized into distinct, encapsulated services.
*   **Data Model:** A clean, normalized data model stored in Google Sheets, utilizing standardized naming conventions for clarity and programmatic access.
*   **Configuration as Data:** All system settings and rules are externalized into a central configuration sheet, enabling flexible updates.
*   **Orchestration:** A time-based trigger acts as the system's heartbeat, monitoring data and files to proactively initiate automated workflows.

## 4. Data Model Overview

The system utilizes a meticulously designed data model across several Google Sheets, ensuring data integrity, consistency, and efficient processing. Key sheets include:

*   **Product Data:** `WebProdM` (core product data), `WebDetM` (detailed product descriptions), `CmxProdM` (Comax product data), `WebXlt` (WPML translation links), `WebBundles` (bundle definitions).
*   **Order Data:** `WebOrdS` (staging), `WebOrdM` (master orders), `WebOrdItemsM` (order line items), `SysOrdLog` (order workflow log), `SysPackingCache` (packing slip data cache), `SysInventoryOnHold` (on-hold inventory summary).
*   **System Data:** `SysConfig` (system settings), `SysTasks` (task management), `SysTaskTypes` (task type definitions), `SysTaskStatusWorkflow` (task status rules), `BruryaStock` (Brurya inventory management), `SysCampaigns` (campaign definitions), `SysCampaignAssets` (links campaigns to content).

For detailed column structures and relationships, refer to `DATA_MODEL.md`.

## 5. Key Documents

For more detailed information on the system's design and implementation, please refer to the following documents:

*   **[ARCHITECTURE.md](ARCHITECTURE.md):** A detailed description of the system's technical architecture and UI/UX design.
*   **[DATA_MODEL.md](DATA_MODEL.md):** A complete reference for all Google Sheets, their columns, and data relationships.
*   **[WORKFLOWS.md](WORKFLOWS.md):** Detailed explanations of the key user and system workflows.
*   **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md):** The high-level, phased plan for building and deploying the system.
*   **[TESTING_AND_VERSIONING.md](TESTING_AND_VERSIONING.md):** The strategy for version control, testing, and safe deployment of new features.