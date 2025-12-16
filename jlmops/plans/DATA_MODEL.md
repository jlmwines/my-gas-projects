# Data Model

This document provides a detailed reference for the Google Sheets that serve as the database for the JLM Operations Hub. All sheets are located in the central Reference Spreadsheet unless otherwise specified.

## Naming Conventions

To ensure clarity, consistency, and robust programmatic access, all sheets and columns follow a strict naming convention.

### Sheet Names

Sheet names follow a `Source_Topic_Type` pattern, modified for brevity and clarity.

### Column Names

All column names across all sheets are **globally unique**. This is to support programming and debugging by allowing for unique global constants for each column.

The pattern is `sheetPrefix_FieldName`, where the prefix is a short, lowercase abbreviation of the sheet name.

**Official Sheet Prefixes:**

| Sheet Name   | Prefix |
| :----------- | :----- |
| `WebProdM`   | `wpm_` |
| `WebDetM`    | `wdm_` |
| `CmxProdS`   | `cps_` |
| `CmxProdM`   | `cpm_` |
| `WebXltM`    | `wxl_` |
| `WebXltS`    | `wxs_` |
| `BruryaStock`| `bru_` |
| `SysBundles` | `sb_` |
| `SysBundleSlots` | `sbs_` |
| `SysTasks`             | `st_`  |
| `SysTaskTypes`         | `stt_` |
| `SysTaskStatusWorkflow`| `stw_` |
| `SysProjects`          | `spro_` |
| `SysConfig`            | `scf_` |
| `WebOrdM_Archive`      | `woma_`|
| `WebOrdItemsM_Archive` | `woia_`|



## System Audit Data Model

### `SysProductAudit`
*   **Purpose:** Stores a single, human-friendly row per product, containing the latest inventory counts for various locations and timestamps for audit. This sheet is maintained by the Comax product import process.
*   **Prefix:** `pa_`
*   **Columns:**
    *   `pa_CmxId`: **Primary Key.** The stable Comax Product ID.
    *   `pa_SKU`: The current SKU from Comax. Updated if SKU changes in Comax.
    *   `pa_LastCount`: Timestamp of the last inventory count update for any location.
    *   `pa_ComaxQty`: The quantity reported by Comax (for reference).
    *   `pa_NewQty`: A generic 'new' quantity field (purpose to be defined).
    *   `pa_BruryaQty`: The current stock level at Brurya.
    *   `pa_StorageQty`: The current stock level at Storage.
    *   `pa_OfficeQty`: The current stock level at Office.
    *   `pa_ShopQty`: The current stock level at Shop.
    *   `pa_LastDetailUpdate`: Timestamp of the last product detail update.
    *   `pa_LastDetailAudit`: Timestamp of the last product detail audit.


**Example:** The concept of a product's web ID (`WebIdEn`) would have a different column name in each sheet it appears in:

*   In `WebProdM`, its name is `wpm_WebIdEn`.
*   In `WebDetM`, its name is `wdm_WebIdEn`.

This convention makes it immediately clear which sheet a given column belongs to when viewing code or logs.

## Product Data Model

The following sheets represent the core data model for managing simple products.

### `CmxProdS` (Comax Products Staging)
*   **Purpose:** A temporary holding area for the unprocessed product data from the Comax import. This sheet is cleared and re-populated with each import. Its structure mirrors `CmxProdM`.
*   **Columns:** The columns are identical to `CmxProdM` but use the `cps_` prefix (e.g., `cps_CmxId`, `cps_SKU`, `cps_NameHe`, etc.).

### `WebProdS_EN` (Web Products Staging - English)
*   **Purpose:** A temporary holding area for raw product data from the English WooCommerce export. This sheet is cleared and re-populated with each import. Its schema is intentionally broader than the input file, containing all columns from the WooCommerce export plus additional columns for future use. This design decouples our system from the source format, allows for future extensibility without database changes, and provides a consistent structure for the `ProductService`.
*   **Product Type Handling:**
    *   `wps_Type = 'simple'`: Standard products with SKU. Full Comax validation applies.
    *   `wps_Type = 'woosb'`: WPClever Smart Bundle products. **No SKU, no Comax relationship.** Skip Comax validation; use for bundle metadata import only.
*   **Category Notes:** `wps_Categories` contains full WooCommerce category membership (comma-separated). Comax Division/Group remains the **primary category determinant**; WooCommerce categories like "Special Value", "New Arrivals", "Featured Wines" are supplementary marketing categories.
*   **Columns:**
    *   `wps_ID`
    *   `wps_Type`: Product type (`simple`, `woosb`, `variable`, etc.)
    *   `wps_SKU`
    *   `wps_Name`
    *   `wps_Published`
    *   `wps_IsFeatured`
    *   `wps_VisibilityInCatalog`
    *   `wps_ShortDescription`
    *   `wps_Description`
    *   `wps_DateSalePriceStarts`
    *   `wps_DateSalePriceEnds`
    *   `wps_TaxStatus`
    *   `wps_TaxClass`
    *   `wps_InStock`
    *   `wps_Stock`
    *   `wps_BackordersAllowed`
    *   `wps_SoldIndividually`
    *   `wps_Weight`
    *   `wps_Length`
    *   `wps_Width`
    *   `wps_Height`
    *   `wps_AllowCustomerReviews`
    *   `wps_PurchaseNote`
    *   `wps_SalePrice`
    *   `wps_RegularPrice`
    *   `wps_Categories`: Full WooCommerce category list (e.g., "Dry Red, North, Special Value")
    *   `wps_Tags`
    *   `wps_ShippingClass`
    *   `wps_Images`: Product image URL
    *   `wps_DownloadLimit`
    *   `wps_DownloadExpiry`
    *   `wps_Parent`
    *   `wps_GroupedProducts`
    *   `wps_Upsells`: Comma-separated product IDs for upsells
    *   `wps_CrossSells`: Comma-separated product IDs for cross-sells
    *   `wps_ExternalURL`: Product page URL
    *   `wps_ButtonText`
    *   `wps_Position`
    *   `wps_Attribute1Name`
    *   `wps_Attribute1Value`
    *   `wps_Attribute1Visible`
    *   `wps_Attribute1Global`
    *   `wps_Attribute2Name`
    *   `wps_Attribute2Value`
    *   `wps_Attribute2Visible`
    *   `wps_Attribute2Global`
    *   `wps_MetaWpmlTranslationHash`
    *   `wps_MetaWpmlLanguage`
    *   `wps_MetaWpmlSourceId`
    *   `wps_WoosbIds`: **(Bundle type only)** JSON containing bundle composition from `Meta: woosb_ids`. Format: `{"key":{"type":"h6","text":"..."},...}` for text blocks, `{"key":{"id":"123","sku":"456","qty":"1","optional":"1",...},...}` for product slots.



### `WebXltS` (Web Translate Staging)
*   **Purpose:** A temporary holding area for the translation linking data from the `wehe.csv` import. This sheet is cleared and re-populated with each import. It provides the link between a translated Hebrew product and its original English product.
*   **Prefix:** `wxs_`
*   **Columns:**
    *   `wxs_WebIdHe`: The unique ID of the Hebrew (translated) product.
    *   `wxs_WebIdEn`: The ID of the original English product it's linked to.

### `WebProdM` (Web Products Master)
*   **Purpose:** Contains a single row for each conceptual product, holding core data for identification and sorting.
*   **Columns:**
    *   `wpm_WebIdEn`: **Primary Key.** The unique ID of the original (English) product.
    *   `wpm_SKU`: The SKU that links the product to Comax data.
    *   `wpm_NameEn`: The English product name, for easy identification.
    *   `wpm_PublishStatusEn`: The publication status of the English product.
    *   `wpm_Stock`: The inventory level.
    *   `wpm_Price`: The product's price.

### `WebDetM` (Web Details Master)
*   **Purpose:** Contains all detailed, language-dependent, and descriptive data for each product.
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

### `WebXltM` (Web Translate Master)
*   **Purpose:** Stores the master relationship between original language and translated language products for WPML. This data is populated from the `WebXltS` staging sheet.
*   **Columns:**
    *   `wxl_WebIdHe`: The unique ID of the Hebrew (translated) product.
    *   `wxl_NameHe`: The Hebrew product name, for readability and debugging.
    *   `wxl_WebIdEn`: The ID of the original English product it's linked to.
    *   `wxl_SKU`: The SKU, for reference and data validation.

## Bundle Management Data Model

This data model provides flexible management of product bundles with intelligent inventory monitoring and replacement suggestions. JLMops serves as a **shadow system**—bundles are managed in WooCommerce (WPClever plugin), while JLMops monitors, suggests, and tracks.

### 1. `SysBundles` (Bundle Header)
*   **Purpose:** Defines the header information for each bundle or package.
*   **Prefix:** `sb_`
*   **Terminology (WooCommerce categories for user convenience):**
    *   **Bundle:** Customer can adjust quantities per item (flexible qty).
    *   **Package:** Fixed quantity per item.
    *   Discounts may be applied to Packages. Functionally identical to the system.
*   **Columns:**
    *   `sb_BundleId`: **Primary Key.** The WooCommerce Product ID (WebIdEn).
    *   `sb_NameEn`: Display name in English.
    *   `sb_NameHe`: Display name in Hebrew.
    *   `sb_Type`: WooCommerce category: `'Bundle'` (flexible qty) or `'Package'` (fixed qty).
    *   `sb_Status`: Current state: `'Active'`, `'Draft'`, `'Archived'`.
    *   `sb_DiscountPrice`: Discounted price if applicable (typically for Packages).

### 2. `SysBundleSlots` (Content Blocks + Product Slots)
*   **Purpose:** Defines the structure of a bundle as a sequence of content blocks and product slots. Each row is either a text block (bilingual content) or a product slot (criteria-based).
*   **Prefix:** `sbs_`
*   **Columns:**
    *   `sbs_SlotId`: **Primary Key.** Unique ID for this slot.
    *   `sbs_BundleId`: **Foreign Key.** Links to `SysBundles`.
    *   `sbs_Order`: Display sequence within the bundle (1, 2, 3...).
    *   `sbs_SlotType`: Either `'Text'` or `'Product'`.
    *   **For 'Text' Slots:**
        *   `sbs_TextStyle`: Display style from WooCommerce (e.g., `'h6'`, `'none'`, `'p'`). Used for rendering.
        *   `sbs_TextEn`: English content text.
        *   `sbs_TextHe`: Hebrew content text.
    *   **For 'Product' Slots - Current State:**
        *   `sbs_ActiveSKU`: The SKU currently assigned to this slot.
        *   `sbs_LastRotated`: Timestamp of last product change.
        *   `sbs_HistoryJson`: JSON array of rotation history. Format: `[{"sku":"12345","start":"2024-01-01","end":"2024-03-15","reason":"Low Stock"},...]`
    *   **For 'Product' Slots - Common Criteria:**
        *   `sbs_Category`: Required product category (e.g., 'Red', 'White', 'Rosé').
        *   `sbs_PriceMin`: Minimum eligible price.
        *   `sbs_PriceMax`: Maximum eligible price.
        *   `sbs_Intensity`: Required intensity level (1-5, or blank for any).
        *   `sbs_Complexity`: Required complexity level (1-5, or blank for any).
        *   `sbs_Acidity`: Required acidity level (1-5, or blank for any).
    *   **For 'Product' Slots - Flexible Criteria:**
        *   `sbs_NameContains`: Text that must appear in product name (covers vendor, grape, etc.).
    *   **For 'Product' Slots - Behavior:**
        *   `sbs_Exclusive`: `TRUE` = product should not appear in other bundles.
        *   `sbs_QtyVariable`: `TRUE` = customer can adjust quantity.
        *   `sbs_DefaultQty`: Default quantity for this slot.

**Example - Text Slot Row:**
| sbs_SlotId | sbs_BundleId | sbs_Order | sbs_SlotType | sbs_TextStyle | sbs_TextEn | sbs_TextHe | sbs_ActiveSKU | ... |
|------------|--------------|-----------|--------------|---------------|------------|------------|---------------|-----|
| SLOT-001 | 12345 | 1 | Text | h6 | Two bold reds | שני אדומים נועזים | | |

**Example - Product Slot Row:**
| sbs_SlotId | sbs_BundleId | sbs_Order | sbs_SlotType | sbs_TextStyle | sbs_TextEn | sbs_TextHe | sbs_ActiveSKU | sbs_Category | sbs_PriceMin | sbs_PriceMax | sbs_Intensity |
|------------|--------------|-----------|--------------|---------------|------------|------------|---------------|--------------|--------------|--------------|---------------|
| SLOT-002 | 12345 | 2 | Product | | | | 44521 | Red | 80 | 150 | 3 |

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

### `WebOrdM_Archive` (Web Orders Master - Archive)
*   **Purpose:** An archive of historical, completed, or cancelled order-level data. Its structure mirrors `WebOrdM`.
*   **Prefix:** `woma_`
*   **Columns:** Identical to `WebOrdM`, but using the `woma_` prefix (e.g., `woma_OrderId`, `woma_OrderNumber`, etc.).

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

### `WebOrdItemsM_Archive` (Web Order Items Master - Archive)
*   **Purpose:** An archive of line items corresponding to the orders in `WebOrdM_Archive`. Its structure mirrors `WebOrdItemsM`.
*   **Prefix:** `woia_`
*   **Columns:** Identical to `WebOrdItemsM`, but using the `woia_` prefix (e.g., `woia_OrderItemId`, `woia_OrderId`, etc.).

*   **`SysOrdLog`**: System Order Log. This is the **single source of truth** for the processing state of an order. It tracks an order's status as it moves through the packing and export workflows.
    *   **`sol_OrderId`**: The Order ID.
    *   **`sol_OrderDate`**: The date the order was placed.
    *   **`sol_OrderStatus`**: A snapshot of the order's main status (e.g., 'processing', 'on-hold', 'completed') at the time of the last update.
    *   **`sol_PackingStatus`**: The status of the order within the packing slip workflow. This follows a strict state machine:
        *   `Ineligible`: The order should not be packed (e.g., 'cancelled', 'refunded').
        *   `Eligible`: The order is valid and waiting for its packing slip data to be enriched. This is the trigger for the `PackingSlipService`.
        *   `Ready`: The data has been enriched and the order is ready to be displayed on the packing slip UI.
        *   `Printed`: The packing slip has been printed.
    *   **`sol_PackingPrintedTimestamp`**: Timestamp of when the packing slip was last printed.
    *   **`sol_ComaxExportStatus`**: The status of the order within the Comax export workflow.
    *   **`sol_ComaxExportTimestamp`**: Timestamp of when the order was last exported to Comax.

### 5. `SysPackingCache` (System Packing Cache)
*   **Purpose:** A temporary data cache used by the `PackingSlipService` to gather and enrich all the descriptive data (e.g., pairing texts, grape info) needed for a packing slip. It is **not** a source of truth for order status; `SysOrdLog` holds that role.
*   **Columns:**
    *   `spc_OrderId`
    *   `spc_WebIdEn`
    *   `spc_SKU`
    *   `spc_Quantity`
    *   `spc_NameEn` / `spc_NameHe`
    *   `spc_Intensity`, `spc_Complexity`, `spc_Acidity`, `spc_Decant`
    *   `spc_HarmonizeEn`, `spc_HarmonizeHe` (Formatted pairing text for harmonization)
    *   `spc_ContrastEn`, `spc_ContrastHe` (Formatted pairing text for contrast)
    *   `spc_ShippingFirstName`, `spc_ShippingLastName`
    *   `spc_ShippingAddress1`, `spc_ShippingAddress2`, `spc_ShippingCity`
    *   `spc_ShippingPhone`
    *   `spc_OrderDate`
    *   `spc_CustomerNote`


### 7. `SysJobQueue` (System Job Queue)
*   **Purpose:** Tracks the lifecycle and status of all orchestrated jobs within the system.
*   **Prefix:** `jq_` (Note: Current code uses direct header names, this prefix is for conceptual consistency if formal schema were used)
*   **Columns:**
    *   `job_id`: **Primary Key.** Unique ID for the job.
    *   `session_id`: The ID of the session this job belongs to, for grouping related jobs.
    *   `job_type`: The type of job (e.g., `import.drive.comax_products`).
    *   `status`: Current status (e.g., `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `BLOCKED`).
    *   `archive_file_id`: ID of the archived input file (if applicable).
    *   `created_timestamp`: When the job was created.
    *   `processed_timestamp`: When the job was last processed or completed.
    *   `error_message`: Details if the job failed.
    *   `original_file_id`: ID of the original source file (if applicable).
    *   `original_file_last_updated`: Last modified timestamp of the original file.



## Managed Inventory Data Model

This section defines the sheets used to manage physical inventory at non-Comax locations and their audit trails.

## Project Management Data Model

This section defines the sheets used to manage all types of projects, from marketing campaigns to operational improvements.

### 1. `SysProjects` (The Master Project List)
*   **Purpose:** This sheet defines each project acting as a container for tasks and goals. It unifies marketing campaigns and operational projects.
*   **Prefix:** `spro_`
*   **Columns:**
    *   `spro_ProjectId`: **Primary Key.** A unique ID for the project (e.g., `PROJ-SUMMER-SALE`, `PROJ-INV-SYNC`).
    *   `spro_Name`: The human-readable name of the project.
    *   `spro_Type`: The type of project (e.g., 'CAMPAIGN', 'OPERATIONAL', 'ONE_OFF').
    *   `spro_Status`: The current state (e.g., 'PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED').
    *   `spro_StartDate`: The planned start date.
    *   `spro_EndDate`: The planned end date (optional for ongoing operational projects).

## Task Management Data Model

This system provides a flexible, configurable way to manage all user and system-generated tasks. It is composed of one main task sheet and two configuration sheets.

### 1. `SysTasks` (The Master Task List)
*   **Purpose:** This is the main sheet that holds every individual task created in the system.
*   **Columns:**
    *   `st_TaskId`: **Primary Key.**
    *   `st_ProjectId`: **(New)** Links the task to a specific project in `SysProjects`.
    *   `st_TaskTypeId`: Links to the `SysTaskTypes` sheet.
    *   `st_Topic`: e.g., 'Inventory', 'Orders'. This links the task to a dashboard widget.
    *   `st_Title`: A human-readable title.
    *   `st_Status`: The current status of the task.
    *   `st_Priority`: 'High', 'Normal', 'Low'.
    *   `st_AssignedTo`: The user responsible for the task.
    *   `st_LinkedEntityId`: The specific subject of the task (e.g., SKU, Order ID) OR the URL/Link to the asset/content (e.g., Google Doc ID).
    *   `st_SessionId`: The ID of the session that generated this task.
    *   `st_CreatedDate`
    *   `st_StartDate`: The date work begins on this task.
        - Set automatically on creation for `immediate` due_pattern tasks
        - Set when task is assigned (manual or auto-assignment)
        - **Invariant:** If st_StartDate has value, st_DueDate and st_Status='Assigned' must also be set
    *   `st_DueDate`: The deadline for task completion.
        - Calculated from `due_pattern` in taskDefinitions
        - Set when task is assigned
        - **Invariant:** If st_DueDate has value, st_StartDate and st_Status='Assigned' must also be set
    *   `st_DoneDate`: Populated when the task is closed.
    *   `st_Notes`

## System Configuration

### `SysConfig`
*   **Purpose:** A flexible, wide-format table to hold all system settings and business rules. The meaning of the generic `P-`columns is determined by the script based on the `SettingName`. The live `SysConfig` sheet is synchronized with `SysConfig_template.csv`.
*   **Columns:**
    *   `scf_SettingName`: **Primary Key.** The unique name for the setting group (e.g., "InventoryThresholds").
    *   `scf_Description`: A human-readable explanation of what this row of settings controls.
    *   `scf_status`: **(New)** The status of the configuration record. Used to protect stable configurations and manage implementation steps. Can be `stable`, `locked`, or a custom tag like `impl_step_1`.
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

### `migration.sync.tasks` (New)
*   **Purpose:** Defines the configuration for the generic master data synchronization utility (`migration.js`). Each row represents a sync-able data type from the legacy system to the JLMops system.
*   **`scf_SettingName`:** `migration.sync.tasks`
*   **Parameters:**
    *   `scf_P01`: **Data Type Name.** A unique name for the sync task (e.g., `WebOrdM`, `CmxProdM`). This is the argument passed to the `syncLegacyMasterData` function.
    *   `scf_P02`: **Legacy Spreadsheet ID.** The ID of the source Google Spreadsheet.
    *   `scf_P03`: **Legacy Sheet Name.** The name of the source sheet in the legacy spreadsheet.
    *   `scf_P04`: **JLMops Target Sheet Name.** The name of the target sheet in the `JLMops_Data` spreadsheet.
    *   `scf_P05`: **Primary Key Column.** The name of the column in the source sheet to use as the primary key for matching records.
    *   `scf_P06`: **Column Mappings.** A comma-separated list of `source_column:target_column` pairs (e.g., `order_id:wom_OrderId,order_number:wom_OrderNumber`).

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
