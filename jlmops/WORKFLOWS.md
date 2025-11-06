# Key Workflows

This document describes the primary user and system workflows within the JLM Operations Hub. These workflows are designed to be intuitive, efficient, and integrated with the dashboard-driven user interface.

## 1. Order Processing & Packing Slip Workflow

This workflow manages orders from import to packing and export, prioritizing speed and accuracy.

### 1.1. Order Import & Status Management (`OrderService`)

1.  **Raw Data Ingestion:** A user uploads the latest WooCommerce order CSV export. The system lands this raw data into the `WebOrdS` (Web Order Staging) sheet.
2.  **Automated Upsert:** The `OrderService` processes the data from `WebOrdS`.
    *   It parses and normalizes the order and line item data.
    *   It performs an "upsert" into the `WebOrdM` (master) and `WebOrdItemsM` (line items) sheets.
    *   Crucially, it also performs an "upsert" into `SysOrdLog`. For each order, it checks the business rules:
        *   **Lock-in Rule:** If the order's previous `sol_OrderStatus` in the log was 'processing' or 'completed', its packing status is locked, and no further packing updates are made.
        *   **Update Rule:** For all other orders (new, on-hold, etc.), it updates the `sol_OrderStatus` with the latest status from the import file and sets the `sol_PackingStatus` to either `Eligible` or `Ineligible`.

### 1.2. Packing Slip Workflow (Automated & User-Driven)

This workflow is now a clean, state-driven process managed by `SysOrdLog`.

#### 1.2.1. Data Enrichment (`PackingSlipService`)

1.  **Trigger:** The `PackingSlipService` is triggered after the `OrderService` completes.
2.  **Find Eligible Orders:** The service scans `SysOrdLog` for all orders with a `sol_PackingStatus` of `Eligible`.
3.  **Enrich and Cache:** For each eligible order, it gathers all required data from the master sheets, enriches it with descriptive text (e.g., pairing notes), and stores it in `SysPackingCache`.
4.  **Set to Ready:** After successfully caching the data for an order, the service updates that order's `sol_PackingStatus` in `SysOrdLog` from `Eligible` to `Ready`.

#### 1.2.2. Packing Slip Generation (UI & `PrintService`)

1.  **Display Ready Orders:** On the "Order Packing" page, the web app queries `SysOrdLog` and displays a list of all orders that are in the `Ready` state.
2.  **Initiate Generation (User Action):** A manager selects one or more `Ready` orders and clicks the print button.
3.  **Data Retrieval & Generation (`PrintService`):** The `PrintService` reads the pre-enriched data from `SysPackingCache` and generates the Google Doc.
4.  **Set to Printed:** Upon successful generation, the `PrintService` updates the `sol_PackingStatus` for the printed orders to `Printed` in `SysOrdLog` and records the `sol_PackingPrintedTimestamp`.
5.  **Manager Finalization & Printing (User Action):** The manager is presented with a link to the newly created Google Doc for review, optional minor edits, and bulk printing using native Google Docs functionality.

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

1.  **Raw Data Ingestion:** The system processes two separate files to build the product catalog:
    *   The main **WooCommerce product export (English)** is uploaded. The system lands this raw data into the `WebProdS_EN` staging sheet.
    *   The **`wehe.csv`** file, which contains the links between Hebrew translations and their English originals, is uploaded. The system lands this data into the `WebXltS` staging sheet.
2.  **Automated Processing:** The `ProductService` is triggered to process the staged data.
    *   It first processes the `WebXltS` sheet to populate the master `WebXltM` (Web Translate Master) table, establishing the relationships between products.
    *   It then processes the `WebProdS_EN` sheet, using the information from `WebXltM` to correctly associate the data with the master product records.
    *   It populates `WebProdM` (Web Products Master) with core, language-independent data (price, stock) from the English product data.
    *   It updates the English-specific columns in `WebDetM` (Web Details Master). The Hebrew-specific columns in this sheet are preserved, not overwritten by the import.
3.  **Data Validation & Integrity:** The `ProductService` performs validation checks based on the system's data ownership rules. The principle is that **Comax is the owner of primary product data** (price, stock), while the **JLM Ops Hub is the authority for all descriptive and marketing data,** which it expands upon using some base data from Comax. The key integrity checks are:
    *   **SKU Compliance:** Ensures a product's `wpm_SKU` in the web system has a valid, corresponding entry in the `CmxProdM` (Comax master) sheet. This is the primary link between the systems.
    *   **Translation Completeness:** Ensures each original language product in `WebProdM` has a corresponding translated product linked in the `WebXltM` sheet.
    *   Any discrepancies found during these validation steps will automatically generate a task in `SysTasks` for manual review and correction.

### 3.2. Product Detail Verification

This workflow ensures the accuracy and freshness of web product details.

1.  **Task Generation:** The `OrchestratorService` (or `TaskService`) generates "Verify Product Details" tasks based on:
    *   **Stale Details:** Products whose `wdm_LastVerifiedTimestamp` in `WebDetM` is older than a configured threshold.
    *   **New Products:** Newly imported products that require initial detail review.
    *   These tasks are created in `SysTasks`.

2.  **Manager Action:** A manager accesses their assigned "Verify Product Details" tasks.
    *   They are presented with a form to review and edit the product's details (names, descriptions, attributes, pairings, and sales rules like 'Sold Individually') in both English and Hebrew.
    *   Upon completion, the `ProductService` updates the `WebDetM` sheet and sets the `wdm_LastVerifiedTimestamp`.
    *   The task in `SysTasks` is marked as 'Completed'.

---

## 4. Advanced Product Management Workflows

These workflows handle complex scenarios where the relationships between products in Comax and WooCommerce change. They are designed around a "Detect -> Task -> Manual Action -> Verify" principle to ensure data integrity.

### 4.1. Handling Comax SKU Changes

This workflow safely manages the process when a SKU for a product sold online is changed in Comax.

1.  **Detection:** During a Comax import, the `ProductService` identifies any product flagged as "sold online" whose SKU has changed since the last import (keyed by the stable Comax Product ID).
2.  **Task Generation:** The service automatically creates a high-priority task: *"The Comax SKU for product '[Product Name]' has changed to '[New SKU]'. Please manually update the SKU for this product in WooCommerce."*
3.  **Manual Action:** An admin performs the SKU update in the WooCommerce admin panel.
4.  **Verification:** The task remains open. The JLM Ops Hub monitors subsequent WooCommerce imports. When it detects that the SKU for the corresponding WooCommerce product has been updated to match, it automatically marks the task as 'Completed'.

### 4.2. Onboarding New Web Products

This workflow coordinates the multi-step, multi-user process of bringing a new product to the web, ensuring data integrity at each stage.

1.  **Initiation (Manager):** A manager creates a new "Onboard New Product" task to begin the process.
2.  **Approval & Naming (Admin):** An admin receives a task to approve the suggestion. If approved, they provide the official English and Hebrew names, which creates a placeholder record in the system.
3.  **Add Details (Manager):** A task is generated for the manager to enter all descriptive and marketing data (tasting notes, pairings, etc.) into the JLM Ops Hub UI.
4.  **Confirm Details (Admin):** The admin gets a task to review and confirm the manager's data entry.
5.  **Create in WooCommerce & Link (Admin):** A critical task instructs the admin to:
    a. Manually create the draft product and its translation in WooCommerce.
    b. Return to the task in the JLM Ops Hub and paste the new English and Hebrew WooCommerce Product IDs into the task form.
6.  **System Verification of Link:** The system waits for the next WooCommerce import, then verifies that the provided IDs match the product SKU for the task. The workflow is halted if a mismatch is detected.
7.  **Update Data (Admin):** A task is generated for the admin to push all the rich data to the new WooCommerce drafts, either via a system-generated export or manually.
8.  **Flag in Comax (Admin):** A task instructs the admin to set the "Sell Online" flag for the product in Comax.
9.  **Final Reconciliation (System):** The parent "Onboard" task is only closed after the system verifies that the Comax "Sell Online" flag is active AND the product is marked as "Published" in WooCommerce, ensuring the entire process is complete and reconciled.

---

## 5. Content Creation Workflow (Editorial Hub)

This workflow facilitates the creation of content like blog posts, managed via the Publishing section of the dashboard.

1.  **Automated Scaffolding:** A user clicks "Create New Blog Post" in the Editorial Hub.
2.  **System Action:** The system automatically creates a new Google Doc from a template, places it in the correct Drive folder, and creates a new task in `SysTasks` (e.g., "Draft: New Post"), linking it to the new Doc ID.
3.  **Collaborative Workflow:** The assigned user writes the content in the linked Google Doc. When finished, they change the task status to "In Review".
4.  **Review & Publish:** The task automatically moves to the Admin's review queue. The Admin can review the doc directly from the task and, when approved, can create and assign subsequent tasks like "Translate" or "Publish".

---

## 6. Campaign Management Workflow

This workflow provides a central hub for planning, executing, and tracking multi-faceted promotional campaigns.

### 6.1. Campaign Creation

1.  **Initiate Campaign:** A manager navigates to the "Campaigns" dashboard widget and creates a new campaign (e.g., "Summer Reds 2025").
2.  **Define Campaign:** The manager provides a name, topic, start date, and end date. This creates a new entry in the `SysCampaigns` sheet with a status of 'Planning'.

### 6.2. Asset Assembly & Task Generation

1.  **Access Campaign Hub:** The manager enters the specific hub for the new campaign.
2.  **Link Assets:** The manager links all components (assets) to the campaign. For each asset, a new row is created in `SysCampaignAssets`.
    *   **Link Existing Bundle:** The manager searches for and selects an existing product bundle. The system links it, creating an asset with `sca_AssetType` = 'BUNDLE'. The system can then proactively track component inventory for this planned promotion.
    *   **Create New Blog Post:** The manager selects "Create New Blog Post". This triggers the **Content Creation Workflow**, creating a Google Doc and a linked task in `SysTasks`. The new Doc ID is stored as the `sca_LinkedEntityId`.
    *   **Create Email/Coupon:** The manager creates entries for planned emails or coupons, linking them to the campaign for tracking.
3.  **Task Integration:** The creation of each asset automatically generates the necessary "scaffolding" of tasks in `SysTasks`, ensuring that every part of the campaign is tracked and assigned from the very beginning.

### 6.3. Coordinated Execution & Monitoring

1.  **Unified View:** The Campaign Hub provides a single dashboard to track the status of all assets for the promotion. The manager can see at a glance what is on track and what is falling behind.
2.  **Timeline Management:** By setting due dates for each asset (`sca_DueDate`), the manager can ensure that content is created, reviewed, and published in the correct sequence to coincide with the campaign's launch date.
3.  **Automated Status Updates:** As users complete their assigned tasks (e.g., moving a blog post from "Draft" to "In Review"), the status of the corresponding asset in `SysCampaignAssets` is updated automatically, providing real-time visibility in the Campaign Hub.

---

## 7. System Configuration Management

This workflow describes how system settings and business rules are managed.

1.  **Access:** An admin navigates to the "System Configuration" page (which uses the `SysConfig` sheet as its data source).
2.  **View & Edit:** The page displays a list of all configurable settings, with `scf_SettingName`, `scf_Description`, and the generic `scf_P01` to `scf_P10` columns.
3.  **Update Setting:** The admin types new values into the `scf_P-`columns for any setting.
4.  **Add Setting:** The admin types a new `scf_SettingName` and `scf_Description` into a new row, then fills in the relevant `scf_P-`columns.
5.  **Submit Changes:** The admin clicks a "Submit Changes" button.
    *   The `ConfigService` processes the changes, updating the `SysConfig` sheet.
    *   The system's in-memory configuration cache is refreshed to apply the new settings immediately.

**Note on Configuration State:** To ensure system stability, the `SysConfig` sheet includes an `scf_status` column.
*   Records marked as `locked` are protected and cannot be modified through the UI.
*   Day-to-day changes should be made to records with a `stable` status.
*   During development, new features may use custom statuses (e.g., `dev_feature_x`) to isolate changes. These records are not loaded by the production system.

---

## 8. Key Performance Indicator (KPI) Reporting

This workflow describes how the system calculates and displays key performance metrics.

1.  **KPI Definition:** KPIs are defined as rows in the `SysConfig` sheet, using a specific naming convention (e.g., `kpi.inventory.verifiedRate`). The `scf_P-`columns hold the parameters for each KPI (e.g., label, data field, display format, thresholds).
2.  **Automated Calculation:** A scheduled background process (the `KpiService`) runs periodically (e.g., daily).
    *   It reads all KPI definitions from `SysConfig`.
    *   For each KPI, it executes the defined calculation against the relevant master data sheets (e.g., `CmxProdM`, `SysTasks`).
3.  **Dashboard Display:** The dashboard widgets query the latest calculated KPI values to display them to the user, often with visual indicators of performance against targets.

---

## 9. System Administration Workflows (New)

This section describes workflows related to system maintenance and health monitoring, particularly during the parallel implementation phase.

### 9.1. Master Data Synchronization

This workflow allows an administrator to keep the `jlmops` master data sheets synchronized with their counterparts in the legacy system.

1.  **Configuration:** An administrator defines a synchronization task in `SysConfig` under the `migration.sync.tasks` setting name. This configuration specifies the source (legacy) and target (jlmops) sheets, the primary key for matching, and the column mappings.
2.  **Execution:** From the Apps Script editor, the administrator runs the `syncLegacyMasterData(dataType)` function located in the `migration.js` script, passing the name of the configured sync task (e.g., 'WebOrdM') as the `dataType` argument.
3.  **Process:** The script performs a non-destructive upsert, updating existing records and inserting new ones in the target `jlmops` sheet based on the data in the source legacy sheet.

### 9.2. Business Logic Validation

This workflow allows an administrator to validate that the outputs of `jlmops` business logic match the outputs of the legacy system.

1.  **Execution:** From the Apps Script editor, the administrator runs the desired validation function from the `ValidationService.js` script (e.g., `validateOnHoldInventory()`, `validateComaxExport()`).
2.  **Process:** The validation function will execute the relevant business logic in both the `jlmops` and legacy systems.
3.  **Review:** The function will log a detailed comparison of the results, highlighting any discrepancies between the two systems. For validations that require visual inspection (like packing slips), it will provide links to both outputs.


## 10. Bundle Management Workflow

This workflow uses a rules-based engine to provide flexible, semi-automated management of product bundles, with a focus on proactively managing component stock.

### 10.1. Bundle Definition (User-Managed)

The entire bundle system is managed through a set of dedicated data sheets, not through code or complex configuration.

1.  **Define the Bundle Header:** A user creates a new bundle by adding a row to the `SysBundlesM` sheet, defining its ID, name, type (`Package` or `Bundle`), and other top-level properties.
2.  **Define the Blueprint:** The user defines the bundle's structure and layout by adding rows to the `SysBundleRows` sheet.
    *   For a line of text, they create a `Text` row and enter the content.
    *   For a product slot, they create a `Product` row and define the **eligibility rules** for that slot (e.g., Category, Price Range, Attributes).
3.  **Assign Active Components:** The user assigns the initial, specific product to each product slot by adding a row to the `SysBundleActiveComponents` sheet, linking a `RowId` to a specific `ActiveSKU`.

### 10.2. Automated Monitoring & Suggestion

This is the core automated workflow performed by the `BundleService`.

1.  **Monitor Active Components:** On a schedule, the `BundleService` iterates through every product in the `SysBundleActiveComponents` sheet.
2.  **Check Stock Levels:** For each `sac_ActiveSKU`, it checks the current stock level in `CmxProdM`.
3.  **Detect Low Stock:** It compares the stock level against the `sbr_MinStockThreshold` defined for that specific product row in `SysBundleRows`.
4.  **Generate Suggestions:** If stock is below the threshold, the service initiates the suggestion logic:
    *   It retrieves all eligibility rules for the product slot from `SysBundleRows`.
    *   It scans all master products (`CmxProdM`) to find a list of alternate SKUs that match the same rules and have sufficient stock.
5.  **Create Task:** The service creates a new, high-priority task in `SysTasks`: "Component [SKU] in bundle '[Bundle Name]' is low on stock. Suggested replacements: [SKU A, SKU B, SKU C]."

### 10.3. Manual Update & Audit Trail

1.  **User Action:** A user sees the task, reviews the suggestions, and decides on a replacement. They manually update the product bundle in the WooCommerce admin panel.
2.  **Update System:** The user then updates the `sac_ActiveSKU` in the `SysBundleActiveComponents` sheet to reflect the new component.
3.  **Automated Logging:** An `onEdit` trigger or a similar mechanism detects the change to `SysBundleActiveComponents`. It automatically creates a new row in the `SysBundleComponentHistory` sheet, logging the timestamp, the old SKU, the new SKU, the user who made the change, and the reason (which can be pulled from the related task). This provides a complete audit trail of all component swaps.