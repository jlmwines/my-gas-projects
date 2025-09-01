# Key Workflows

This document describes the primary user and system workflows within the JLM Operations Hub. These workflows are designed to be intuitive, efficient, and integrated with the dashboard-driven user interface.

## 1. Order Processing & Packing Slip Workflow

This workflow manages orders from import to packing and export, prioritizing speed and accuracy.

### 1.1. Order Import & Data Processing

1.  **Raw Data Ingestion:** A user uploads the latest WooCommerce order CSV export. The system lands this raw data into the `WebOrdS` (Web Order Staging) sheet.
2.  **Automated Processing:** The `OrderService` (triggered by the Orchestrator) processes the data from `WebOrdS`.
    *   It parses and normalizes the order and line item data.
    *   It populates the `WebOrdM` (Web Orders Master) and `WebOrdItemsM` (Web Order Items Master) sheets.
    *   For new orders, it creates a new entry in `SysOrdLog` (System Order Log) with a `sol_PackingStatus` of 'Pending'.
    *   For existing orders that have been modified (e.g., status change, item change), it updates their records in `WebOrdM` and `WebOrdItemsM`. If the order is in a mutable status (e.g., 'On-Hold'), it also clears its entry in `SysPackingCache` and resets its `sol_PackingStatus` in `SysOrdLog` to 'Pending', signaling it needs reprocessing.

### 1.2. Packing Slip Data Pre-processing (Automated)

1.  **Background Task:** A scheduled background process (part of the `OrderService` or a dedicated `PackingService`) continuously monitors `SysOrdLog` for orders with a `sol_PackingStatus` of 'Pending'.
2.  **Data Enrichment:** For each 'Pending' order, the process gathers all necessary data for the packing slip:
    *   Order details from `WebOrdM`.
    *   Line item details from `WebOrdItemsM`.
    *   Rich product details (names, attributes, pairings) from `WebDetM` (linked via `woi_WebIdEn`).
3.  **Cache Population:** This fully enriched, ready-to-print data is then stored in the `SysPackingCache` sheet.

### 1.3. Dynamic Packing Slip Generation (The "Generate and Finalize" Workflow)

This hybrid workflow is designed to provide maximum speed for the system and maximum flexibility for the manager, combining automated HTML generation with the familiar editing and printing power of Google Docs.

1.  **Initiate Generation:** On the "Order Packing" workflow page, a manager selects one or more orders and clicks "Generate Packing Slips".

2.  **Step 1: Automated Document Creation (Backend Process)**
    *   **Context Gathering:** The `OrderService` is called and immediately gathers the current context, including any active campaigns from `SysCampaigns` and customer details from `WebOrdM`.
    *   **Template Parsing:** The service reads and parses the `PackingSlipTemplate` definition from the `SysConfig` sheet.
    *   **Dynamic HTML Assembly:** The service orchestrates the assembly of a single, rich HTML string containing all the selected packing slips. This HTML includes all line item details from `SysPackingCache` and any context-aware promotional messages (e.g., `CAMPAIGN_FOOTER` blocks).
    *   **Conversion to Google Doc:** The `OrderService` creates a new Google Doc and programmatically inserts the generated HTML. Google Docs renders the HTML into a fully formatted, multi-page document.

3.  **Step 2: Manager Finalization and Printing (User Action)**
    *   **Review "Draft" Document:** The manager is presented with a link to the single, newly created "Packing Slip Batch" Google Doc.
    *   **Final Edits (Optional):** The manager can quickly scroll through the document. Because the layout is based on fluid HTML, it is highly efficient. If any minor layout issues exist (e.g., a slip that spills onto a new page by one line), the manager can use the standard Google Docs editor to make small adjustments (e.g., tweaking a margin or font size) to perfect the layout.
    *   **Bulk Printing:** Once satisfied, the manager uses the native Google Docs print function (`File > Print`) to print the entire batch in a single print job.

4.  **Status Update:** After successfully generating and providing the link to the Google Doc, the `OrderService` updates the `sol_PackingStatus` to 'Printed' and records the `sol_PackingPrintedTimestamp` in `SysOrdLog`.

### 1.4. Comax Export

1.  **Export Trigger:** An admin triggers the Comax export process.
2.  **Data Aggregation:** The `OrderService` identifies orders in `SysOrdLog` that have not yet been exported to Comax.
3.  **Line Item Summary:** It aggregates all line items from these orders (from `WebOrdItemsM`) into a summary of SKUs and total quantities.
4.  **CSV Generation:** A CSV file is generated and saved to a designated Google Drive folder.
5.  **Status Update:** The `sol_ComaxExportStatus` and `sol_ComaxExportTimestamp` are updated in `SysOrdLog` for the exported orders.

---

## 2. Inventory Management Workflow

This workflow ensures accurate inventory counts and proactive management of stock levels.

### 2.1. Brurya Stock Management (Direct Control)

This workflow is designed for the manager to directly control Brurya inventory.

1.  **Access:** The manager navigates to the "Brurya Stock Management" page (which uses the `BruryaStock` sheet as its data source).
2.  **View & Edit:** The page displays products with `bru_SKU`, `bru_Name`, `bru_CurrentQuantity`, and an editable `bru_NewQuantity` column.
3.  **Update Quantity:** The manager types the new total quantity into `bru_NewQuantity` for any product.
4.  **Add Product:** The manager uses an "Add Product" button (in the sidebar) to search for and select a product by name. The system adds a new row for the product, auto-populating `bru_SKU` and `bru_Name`, ready for quantity input.
5.  **Remove Product:** The manager enters `0` in `bru_NewQuantity` for a product.
6.  **Submit Changes:** The manager clicks a "Submit Changes" button.
    *   The `InventoryManagementService` processes the changes.
    *   `bru_CurrentQuantity` is updated from `bru_NewQuantity`.
    *   `bru_LastUpdated` is timestamped.
    *   Rows with `0` quantity are removed.
    *   `bru_NewQuantity` cells are cleared.

### 2.2. Physical Inventory Count & Verification

This workflow manages the process of verifying stock at other locations (Office, Storage, Shop) and updating the master Comax inventory.

1.  **Task Generation:** The `OrchestratorService` (or `TaskService`) generates "Verify Physical Count" tasks based on:
    *   **Stale Counts:** Products whose `cpm_LastCountTimestamp` in `CmxProdM` is older than a configured threshold.
    *   **Negative Stock:** Products with `cpm_Stock < 0`.
    *   **Low Stock:** Products with `cpm_Stock` below a configured threshold.
    *   These tasks are created in `SysTasks`.

2.  **User Counting:** A user (e.g., a warehouse worker) accesses their assigned "Verify Physical Count" tasks.
    *   They are presented with a form to enter counts for specific SKUs at various locations.
    *   The submitted counts are recorded in the `SysInventoryAudit` sheet, along with `sia_LastCountTimestamp`, `sia_CountedBy`, and a `sia_ReviewStatus` of 'Pending Review'.

3.  **Admin Review & Approval:** An admin reviews the `SysInventoryAudit` sheet.
    *   If approved, the `InventoryManagementService` updates the `cpm_Stock` in `CmxProdM` with the new total count.
    *   The `cpm_LastCountTimestamp` in `CmxProdM` is updated.
    *   The task in `SysTasks` is marked as 'Completed'.

### 2.3. On-Hold Inventory Management

This workflow ensures that stock committed to 'On-Hold' orders is correctly accounted for.

1.  **Automated Calculation:** A background process (part of the `OrderService` or `InventoryManagementService`) continuously calculates the total quantity of each SKU currently in 'On-Hold' orders (by querying `WebOrdItemsM` and `WebOrdM`).
2.  **Cache Population:** This calculated `sio_OnHoldQuantity` for each `sio_SKU` is stored in the `SysInventoryOnHold` sheet.
3.  **System Use:** Other parts of the system (e.g., stock availability calculations for the web store) can quickly query `SysInventoryOnHold` to determine truly available stock.

---

## 3. Product Management Workflow

This workflow covers the end-to-end process for adding new products, updating existing ones, and ensuring data validity.

### 3.1. Product Import & Data Processing

1.  **Raw Data Ingestion:** A user uploads the latest WooCommerce product CSV exports (English and Hebrew). The system lands this raw data into a staging sheet (not explicitly defined, but implied).
2.  **Automated Processing:** The `ProductService` processes the raw data.
    *   It parses and normalizes the product data.
    *   It populates `WebProdM` (Web Products Master) with core, language-independent data.
    *   It populates `WebDetM` (Web Details Master) with detailed, language-dependent data.
    *   It populates `WebXlt` (Web Translate) with translation links.
    *   It populates `WebBundles` with bundle compositions.
3.  **Data Validation:** The `ProductService` performs validation checks:
    *   **SKU Compliance:** Ensures `wpm_SKU` exists in `CmxProdM`.
    *   **Translation Completeness:** Ensures each `WebIdEn` has a corresponding `WebIdHe` in `WebXlt`.
    *   Any discrepancies generate tasks in `SysTasks`.

### 3.2. Product Detail Verification

This workflow ensures the accuracy and freshness of web product details.

1.  **Task Generation:** The `OrchestratorService` (or `TaskService`) generates "Verify Product Details" tasks based on:
    *   **Stale Details:** Products whose `wdm_LastVerifiedTimestamp` in `WebDetM` is older than a configured threshold.
    *   **New Products:** Newly imported products that require initial detail review.
    *   These tasks are created in `SysTasks`.

2.  **Manager Action:** A manager accesses their assigned "Verify Product Details" tasks.
    *   They are presented with a form to review and edit the product's details (names, descriptions, attributes, pairings) in both English and Hebrew.
    *   Upon completion, the `ProductService` updates the `WebDetM` sheet and sets the `wdm_LastVerifiedTimestamp`.
    *   The task in `SysTasks` is marked as 'Completed'.

---

## 4. Content Creation Workflow (Editorial Hub)

This workflow facilitates the creation of content like blog posts, managed via the Publishing section of the dashboard.

1.  **Automated Scaffolding:** A user clicks "Create New Blog Post" in the Editorial Hub.
2.  **System Action:** The system automatically creates a new Google Doc from a template, places it in the correct Drive folder, and creates a new task in `SysTasks` (e.g., "Draft: New Post"), linking it to the new Doc ID.
3.  **Collaborative Workflow:** The assigned user writes the content in the linked Google Doc. When finished, they change the task status to "In Review".
4.  **Review & Publish:** The task automatically moves to the Admin's review queue. The Admin can review the doc directly from the task and, when approved, can create and assign subsequent tasks like "Translate" or "Publish".

---

## 5. Campaign Management Workflow

This workflow provides a central hub for planning, executing, and tracking multi-faceted promotional campaigns.

### 5.1. Campaign Creation

1.  **Initiate Campaign:** A manager navigates to the "Campaigns" dashboard widget and creates a new campaign (e.g., "Summer Reds 2025").
2.  **Define Campaign:** The manager provides a name, topic, start date, and end date. This creates a new entry in the `SysCampaigns` sheet with a status of 'Planning'.

### 5.2. Asset Assembly & Task Generation

1.  **Access Campaign Hub:** The manager enters the specific hub for the new campaign.
2.  **Link Assets:** The manager links all components (assets) to the campaign. For each asset, a new row is created in `SysCampaignAssets`.
    *   **Link Existing Bundle:** The manager searches for and selects an existing product bundle. The system links it, creating an asset with `sca_AssetType` = 'BUNDLE'. The system can then proactively track component inventory for this planned promotion.
    *   **Create New Blog Post:** The manager selects "Create New Blog Post". This triggers the **Content Creation Workflow**, creating a Google Doc and a linked task in `SysTasks`. The new Doc ID is stored as the `sca_LinkedEntityId`.
    *   **Create Email/Coupon:** The manager creates entries for planned emails or coupons, linking them to the campaign for tracking.
3.  **Task Integration:** The creation of each asset automatically generates the necessary "scaffolding" of tasks in `SysTasks`, ensuring that every part of the campaign is tracked and assigned from the very beginning.

### 5.3. Coordinated Execution & Monitoring

1.  **Unified View:** The Campaign Hub provides a single dashboard to track the status of all assets for the promotion. The manager can see at a glance what is on track and what is falling behind.
2.  **Timeline Management:** By setting due dates for each asset (`sca_DueDate`), the manager can ensure that content is created, reviewed, and published in the correct sequence to coincide with the campaign's launch date.
3.  **Automated Status Updates:** As users complete their assigned tasks (e.g., moving a blog post from "Draft" to "In Review"), the status of the corresponding asset in `SysCampaignAssets` is updated automatically, providing real-time visibility in the Campaign Hub.

---

## 6. System Configuration Management

This workflow describes how system settings and business rules are managed.

1.  **Access:** An admin navigates to the "System Configuration" page (which uses the `SysConfig` sheet as its data source).
2.  **View & Edit:** The page displays a list of all configurable settings, with `scf_SettingName`, `scf_Description`, and the generic `scf_P01` to `scf_P10` columns.
3.  **Update Setting:** The admin types new values into the `scf_P-`columns for any setting.
4.  **Add Setting:** The admin types a new `scf_SettingName` and `scf_Description` into a new row, then fills in the relevant `scf_P-`columns.
5.  **Submit Changes:** The admin clicks a "Submit Changes" button.
    *   The `ConfigService` processes the changes, updating the `SysConfig` sheet.
    *   The system's in-memory configuration cache is refreshed to apply the new settings immediately.

---

## 6. Key Performance Indicator (KPI) Reporting

This workflow describes how the system calculates and displays key performance metrics.

1.  **KPI Definition:** KPIs are defined as rows in the `SysConfig` sheet, using a specific naming convention (e.g., `kpi.inventory.verifiedRate`). The `scf_P-`columns hold the parameters for each KPI (e.g., label, data field, display format, thresholds).
2.  **Automated Calculation:** A scheduled background process (the `KpiService`) runs periodically (e.g., daily).
    *   It reads all KPI definitions from `SysConfig`.
    *   For each KPI, it executes the defined calculation against the relevant master data sheets (e.g., `CmxProdM`, `SysTasks`).
3.  **Dashboard Display:** The dashboard widgets query the latest calculated KPI values to display them to the user, often with visual indicators of performance against targets.