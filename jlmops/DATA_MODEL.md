# Data Model

This document provides a detailed reference for the Google Sheets that serve as the database for the JLM Operations Hub. All sheets are located in the central Reference Spreadsheet unless otherwise specified.

## Naming Conventions

To ensure clarity, consistency, and robust programmatic access, all sheets and columns follow a strict naming convention.

### Sheet Names

Sheet names follow a `Source_Topic_Type` pattern, modified for brevity and clarity. The official sheet names are:

| Sheet Name   | Description                  |
| :----------- | :--------------------------- |
| `WebProdM`   | Web Products Master          |
| `WebDetM`    | Web Details Master           |
| `CmxProdM`   | Comax Products Master        |
| `WebBundles` | Web Bundle Rules             |
| `WebXlt`     | Web WPML Links (Translate)   |

*(Other system, log, and configuration sheets will follow a similar clear-spoken pattern, e.g. `SysTasksQ`)*

### Column Names

All column names across all sheets are **globally unique**. This is to support programming and debugging by allowing for unique global constants for each column.

The pattern is `sheetPrefix_FieldName`, where the prefix is a short, lowercase abbreviation of the sheet name.

**Official Sheet Prefixes:**

| Sheet Name   | Prefix |
| :----------- | :----- |
| `WebProdM`   | `wpm_` |
| `WebDetM`    | `wdm_` |
| `CmxProdM`   | `cpm_` |
| `WebBundles` | `wbu_` |
| `WebXlt`     | `wxl_` |
| `BruryaStock`| `bru_` |
| `SysTasks`             | `st_`  |
| `SysTaskTypes`         | `stt_` |
| `SysTaskStatusWorkflow`| `stw_` |
| `SysCampaigns`         | `scamp_` |
| `SysCampaignAssets`    | `sca_` |


**Example:** The concept of a product's web ID (`WebIdEn`) would have a different column name in each sheet it appears in:

*   In `WebProdM`, its name is `wpm_WebIdEn`.
*   In `WebDetM`, its name is `wdm_WebIdEn`.

This convention makes it immediately clear which sheet a given column belongs to when viewing code or logs.

## Product Data Model

The following sheets represent the core data model for managing products.

### `WebProdM` (Web Products Master)
*   **Purpose:** Contains a single row for each conceptual product, holding core data for identification and sorting.
*   **Columns:**
    *   `wpm_WebIdEn`: **Primary Key.** The unique ID of the original (English) product.
    *   `wpm_ProductType`: The type from WooCommerce (e.g., `Simple`, `Smart Bundle`). Used as the primary sort key.
    *   `wpm_SKU`: The SKU that links the product to Comax data.
    *   `wpm_NameEn`: The English product name, for easy identification.
    *   `wpm_PublishStatusEn`: The publication status of the English product.
    *   `wpm_Stock`: The inventory level.
    *   `wpm_Price`: The product's price.

### `WebDetM` (Web Details Master)
*   **Purpose:** Contains all detailed, language-dependent, and descriptive data for each product. The columns are ordered to group related fields.
*   **Columns:**
    *   **Core Identification**
        1.  `wdm_WebIdEn`
        2.  `wdm_SKU`
        3.  `wdm_NameEn`
        4.  `wdm_NameHe`
    *   **Descriptions & Region**
        5.  `wdm_ShortDescrEn`
        6.  `wdm_ShortDescrHe`
        7.  `wdm_DescriptionEn`
        8.  `wdm_DescriptionHe`
        9.  `wdm_Region`
    *   **Tasting Attributes**
        10. `wdm_Intensity`
        11. `wdm_Complexity`
        12. `wdm_Acidity`
        13. `wdm_Decant`
    *   **Pairing Flags**
        14. `wdm_PairHarMild`
        15. `wdm_PairHarRich`
        16. `wdm_PairHarIntense`
        17. `wdm_PairHarSweet`
        18. `wdm_PairConMild`
        19. `wdm_PairConRich`
        20. `wdm_PairConIntense`
        21. `wdm_PairConSweet`
    *   **Grape Codes**
        22. `wdm_GrapeG1`
        23. `wdm_GrapeG2`
        24. `wdm_GrapeG3`
        25. `wdm_GrapeG4`
        26. `wdm_GrapeG5`
    *   **Kashrut Details**
        27. `wdm_KashrutK1`
        28. `wdm_KashrutK2`
        29. `wdm_KashrutK3`
        30. `wdm_KashrutK4`
        31. `wdm_KashrutK5`
        32. `wdm_HeterMechira`
        33. `wdm_IsMevushal`
    *   **Sales Rules**
        34. `wdm_IsSoldIndividually`

### `CmxProdM` (Comax Products Master)
*   **Purpose:** Contains master product data imported from the Comax ERP.
*   **Columns:**
    *   `cpm_CmxId`: **Primary Key.** The unique ID for the product from Comax.
    *   `cpm_SKU`: The Comax SKU.
    *   `cpm_NameHe`: The product name in Hebrew.
    *   `cpm_Division`: The product's division (e.g., 'Wine', 'Liqueur').
    *   `cpm_Group`: The product's sub-category (e.g., 'Dry Red').
    *   `cpm_Vendor`: The product's vendor.
    *   `cpm_Brand`: The product's brand.
    *   `cpm_Color`: The product's color.
    *   `cpm_Size`: The product's size.
    *   `cpm_Dryness`: The product's dryness level.
    *   `cpm_Vintage`: The product's vintage year.
    *   `cpm_Price`: The price from Comax.
    *   `cpm_Stock`: The stock level from Comax.
    *   `cpm_IsNew`: Flag indicating a new product.
    *   `cpm_IsArchived`: Flag indicating an archived product.
    *   `cpm_IsActive`: Flag indicating an active product.
    *   `cpm_IsWeb`: Flag indicating if the product should be sold online.
    *   `cpm_Exclude`: Flag to exclude the product from synchronization.

### `WebBundles`
*   **Purpose:** Defines the component products that make up a `Smart Bundle`. This data is parsed from the bundle's metadata during import.
*   **Columns:**
    *   `wbu_BundleWebIdEn`: The `WebIdEn` of the `Smart Bundle` product.
    *   `wbu_ComponentWebIdEn`: The `WebIdEn` of a single product included in the bundle.
    *   `wbu_Quantity`: The quantity of the component in the bundle.

### `WebXlt` (Web Translate)
*   **Purpose:** Stores the relationship between original language and translated language products for WPML. This data is parsed from the product's WPML metadata during import.
*   **Columns:**
    *   `wxl_WebIdHe`: The unique ID of the Hebrew (translated) product.
    *   `wxl_NameHe`: The Hebrew product name, for readability and debugging.
    *   `wxl_WebIdEn`: The ID of the original English product it's linked to.
    *   `wxl_SKU`: The SKU, for reference and data validation.

## Order & Packing Workflow Data Model

This set of sheets manages the entire workflow from when an order is imported until it is packed and the data is exported.

### 1. `WebOrdS` (Web Order Staging)
*   **Purpose:** A temporary holding area for the raw, unprocessed order data from the WooCommerce export. This sheet is cleared and re-populated with each import. Its structure and column names map directly to the source CSV file.
*   **Key Columns:** `wos_OrderId`, `wos_OrderNumber`, `wos_Status`, `wos_BillingEmail`, `wos_ShippingFirstName`, `wos_ShippingAddress1`, `wos_LineItems`, etc.

### 2. `WebOrdM` (Web Orders Master)
*   **Purpose:** Stores a minimal, defined set of processed order-level data required for packing, notes, and marketing analysis.
*   **Columns:**
    *   `wom_OrderId`: **Primary Key.**
    *   `wom_OrderNumber`
    *   `wom_OrderDate`
    *   `wom_Status`: Essential for workflow logic (e.g., 'On-Hold').
    *   `wom_CustomerNote`
    *   **Billing Fields:** `wom_BillingFirstName`, `wom_BillingLastName`, `wom_BillingEmail`, `wom_BillingPhone`
    *   **Shipping Fields:** `wom_ShippingFirstName`, `wom_ShippingLastName`, `wom_ShippingAddress1`, `wom_ShippingAddress2`, `wom_ShippingCity`, `wom_ShippingPhone`

### 3. `WebOrdItemsM` (Web Order Items Master)
*   **Purpose:** Stores the individual line items for each order in a normalized structure.
*   **Columns:**
    *   `woi_OrderItemId`: **Primary Key.**
    *   `woi_OrderId`: Links to `WebOrdM`.
    *   `woi_WebIdEn`: The direct, immutable link to the original product in `WebProdM`.
    *   `woi_SKU`: The product SKU, for reference.
    *   `woi_Name`: The name of the product as it appeared in the order.
    *   `woi_Quantity`
    *   `woi_ItemTotal`

### 4. `SysOrdLog` (System Order Log)
*   **Purpose:** Tracks the workflow status of each order.
*   **Columns:**
    *   `sol_OrderId`: **Primary Key.** Links to `WebOrdM`.
    *   `sol_PackingStatus`: e.g., 'Pending', 'Printed'.
    *   `sol_PackingPrintedTimestamp`
    *   `sol_ComaxExportStatus`: e.g., 'Pending', 'Exported'.
    *   `sol_ComaxExportTimestamp`

### 5. `SysPackingCache` (System Packing Cache)
*   **Purpose:** A pre-processed sheet containing all the rich, combined data needed to print packing slips quickly. This sheet is populated by an automated background process.
*   **Columns:**
    *   `spc_OrderId`
    *   `spc_WebIdEn`
    *   `spc_SKU`
    *   `spc_Quantity`
    *   `spc_NameEn` / `spc_NameHe`
    *   `spc_Intensity`, `spc_Complexity`, `spc_Acidity`, `spc_Decant`
    *   `spc_PairHarMild`, `spc_PairHarRich`, `spc_PairHarIntense`, `spc_PairHarSweet`
    *   `spc_PairConMild`, `spc_PairConRich`, `spc_PairConIntense`, `spc_PairConSweet`

### 6. `SysInventoryOnHold` (System On-Hold Inventory)
*   **Purpose:** Stores a pre-calculated summary of stock committed to 'On-Hold' orders to improve system performance.
*   **Columns:**
    *   `sio_SKU`: **Primary Key.**
    *   `sio_OnHoldQuantity`

## Managed Inventory Data Model

This section defines the sheets used to directly manage physical inventory at non-Comax locations.

### `BruryaStock`
*   **Purpose:** The master list and user interface for managing inventory at the Brurya warehouse.
*   **Prefix:** `bru_`
*   **Columns:**
    *   `bru_SKU`: The product SKU.
    *   `bru_Name`: The product name, for readability.
    *   `bru_CurrentQuantity`: The official, saved quantity for the location.
    *   `bru_NewQuantity`: An editable column for the manager to input updates.
    *   `bru_LastUpdated`: A timestamp of the last successful update for the row.

## Task Management Data Model

This system provides a flexible, configurable way to manage all user and system-generated tasks. It is composed of one main task sheet and two configuration sheets.

### 1. `SysTasks` (The Master Task List)
*   **Purpose:** This is the main sheet that holds every individual task created in the system.
*   **Columns:**
    *   `st_TaskId`: **Primary Key.**
    *   `st_TaskTypeId`: Links to the `SysTaskTypes` sheet.
    *   `st_Topic`: e.g., 'Inventory', 'Orders'. This links the task to a dashboard widget.
    *   `st_Title`: A human-readable title, e.g., "Verify stock for SKU 12345".
    *   `st_Status`: The current status of the task.
    *   `st_Priority`: 'High', 'Normal', 'Low'.
    *   `st_AssignedTo`: The user responsible for the task.
    *   `st_LinkedEntityId`: The ID of the product, order, etc. that this task is about.
    *   `st_CreatedDate`
    *   `st_DueDate`
    *   `st_DoneDate`: Populated when the task is closed, for KPI tracking.
    *   `st_Notes`

### 2. `SysTaskTypes` (Configuration Sheet)
*   **Purpose:** This sheet defines every *type* of task that can exist.
*   **Columns:**
    *   `stt_TaskTypeId`: **Primary Key,** e.g., 'VERIFY_COUNT'.
    *   `stt_TypeName`: Human-readable name, e.g., "Verify Physical Count".
    *   `stt_Topic`: The dashboard widget this task type belongs to.
    *   `stt_DefaultPriority`
    *   `stt_InitialStatus`: The status a new task of this type starts with.
    *   `stt_Description`

### 3. `SysTaskStatusWorkflow` (Configuration Sheet)
*   **Purpose:** This sheet defines the "state machine"—the valid paths a task can take from one status to another, and who is allowed to make the change.
*   **Columns:**
    *   `stw_WorkflowId`: **Primary Key** for the row.
    *   `stw_TaskTypeId`: Which task type this rule applies to.
    *   `stw_FromStatus`: The status the task is currently in.
    *   `stw_ToStatus`: The status the user wants to move it to.
    *   `stw_AllowedRole`: The user role allowed to make this change, e.g., 'Admin', 'Manager'.

## Campaign Management Data Model

This section defines the sheets used to coordinate multi-faceted promotional campaigns.

### 1. `SysCampaigns` (The Master Campaign List)
*   **Purpose:** This sheet defines each promotion as a whole, acting as the central hub for a campaign.
*   **Prefix:** `scamp_`
*   **Columns:**
    *   `scamp_CampaignId`: **Primary Key.** A unique ID for the campaign (e.g., `CAMP-001`).
    *   `scamp_Name`: The name of the promotion (e.g., "Summer Reds 2025").
    *   `scamp_Topic`: A short description of the theme.
    *   `scamp_StartDate`: The planned start date for the promotion.
    *   `scamp_EndDate`: The planned end date for the promotion.
    *   `scamp_Status`: The current state of the campaign (e.g., 'Planning', 'In Progress', 'Live', 'Completed').

### 2. `SysCampaignAssets` (The Campaign Components)
*   **Purpose:** This sheet links all the individual pieces of content (assets) to a specific campaign.
*   **Prefix:** `sca_`
*   **Columns:**
    *   `sca_AssetId`: **Primary Key.** A unique ID for the asset row.
    *   `sca_CampaignId`: Links to `SysCampaigns`.
    *   `sca_AssetType`: The type of content (e.g., 'BUNDLE', 'BLOG_POST', 'EMAIL', 'COUPON').
    *   `sca_LinkedEntityId`: The ID of the actual content (e.g., a Product ID, a Google Doc ID, a Coupon Code).
    *   `sca_DueDate`: The internal due date for this specific asset.
    *   `sca_Status`: The status of this asset (e.g., 'Draft', 'Review', 'Scheduled', 'Published').

## System Configuration

### `SysConfig`
*   **Purpose:** A flexible, wide-format table to hold all system settings and business rules. The meaning of the generic `P-`columns is determined by the script based on the `SettingName`.
*   **Columns:**
    *   `scf_SettingName`: **Primary Key.** The unique name for the setting group (e.g., "InventoryThresholds").
    *   `scf_Description`: A human-readable explanation of what this row of settings controls.
    *   `scf_P01`: Generic Parameter 1.
    *   `scf_P02`: Generic Parameter 2.
    *   `scf_P03`: Generic Parameter 3.
    *   `scf_P04`: Generic Parameter 4.
    *   `scf_P05`: Generic Parameter 5.
    *   `scf_P06`: Generic Parameter 6.
    *   `scf_P07`: Generic Parameter 7.
    *   `scf_P08`: Generic Parameter 8.
    *   `scf_P09`: Generic Parameter 9.
    *   `scf_P10`: Generic Parameter 10.

*   **Example Usage: Block-Based Templates**
    This sheet's flexibility can be leveraged to define complex structures like document templates. For example, a dynamic packing slip can be defined using multiple rows, all sharing the same `scf_SettingName` (e.g., `PackingSlipTemplate`).
    *   `scf_P01` is used to define the "Block Type" (`HEADER`, `TABLE_COLUMN`, `FOOTER`, `CAMPAIGN_FOOTER`).
    *   `scf_P02` holds the display label or static content.
    *   `scf_P03` holds the corresponding data source field name (e.g., `wom_OrderNumber` or `spc_SKU`).
    *   `scf_P04` and beyond can hold optional parameters, like presentation hints (`align-center`) or conditions (`NON_SUBSCRIBERS_ONLY`).
    This allows for the creation of powerful, configuration-driven documents without changing any code.

## System Health & Logging

This section defines the sheets used for monitoring system health and recovering from errors.

### 1. `SysLog` (Centralized Log)
*   **Purpose:** Provides a comprehensive, time-stamped audit trail of all significant system events and errors.
*   **Prefix:** `sl_`
*   **Columns:**
    *   `sl_Timestamp`: When the event occurred.
    *   `sl_SessionId`: A unique ID for a specific workflow run.
    *   `sl_LogLevel`: The severity of the event (`INFO`, `WARN`, `ERROR`).
    *   `sl_ServiceName`: The service that generated the log (e.g., `OrderService`).
    *   `sl_FunctionName`: The specific function that was running.
    *   `sl_Message`: A human-readable log message.
    *   `sl_StackTrace`: The full error stack trace, if the log level is `ERROR`.

### 2. `SysFailedJobs` (Dead Letter Queue)
*   **Purpose:** Records information about automated jobs that have failed, allowing for administrative review and retry.
*   **Prefix:** `sfj_`
*   **Columns:**
    *   `sfj_Timestamp`: When the failure occurred.
    *   `sfj_OriginalFileId`: The ID of the quarantined file that caused the failure.
    *   `sfj_ServiceName`: The service that failed during processing.
    *   `sfj_Error`: The specific error message.
    *   `sfj_Status`: The current status of the failed job (`NEW`, `RETRYING`, `RESOLVED`, `IGNORED`).