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
| `SysBundlesM` | `sbm_` |
| `SysBundleRows` | `sbr_` |
| `SysBundleActiveComponents` | `sac_` |
| `SysBundleComponentHistory` | `sbh_` |
| `SysTasks`             | `st_`  |
| `SysTaskTypes`         | `stt_` |
| `SysTaskStatusWorkflow`| `stw_` |
| `SysCampaigns`         | `scamp_` |
| `SysCampaignAssets`    | `sca_` |
| `SysConfig`            | `scf_` |
| `WebOrdM_Archive`      | `woma_`|
| `WebOrdItemsM_Archive` | `woia_`|
| `SystemAudit`          | `sa_`  |


## System Audit Data Model

### `SystemAudit`
*   **Purpose:** Stores stock levels for various locations (Brurya, Storage, Office, Shop).
*   **Prefix:** `sa_`
*   **Columns:**
    *   `sa_Item`: The name of the item (e.g., 'Brurya', 'Storage', 'Office', 'Shop').
    *   `sa_StockLevel`: The current stock level for the item.


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
*   **Columns:**
    *   `wps_ID`
    *   `wps_Type`
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
    *   `wps_Categories`
    *   `wps_Tags`
    *   `wps_ShippingClass`
    *   `wps_Images`
    *   `wps_DownloadLimit`
    *   `wps_DownloadExpiry`
    *   `wps_Parent`
    *   `wps_GroupedProducts`
    *   `wps_Upsells`
    *   `wps_CrossSells`
    *   `wps_ExternalURL`
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

This data model uses a rules-engine approach to provide flexible and intelligent management of product bundles and packages.

### 1. `SysBundlesM` (Bundles Master)
*   **Purpose:** Defines the "header" information for each bundle or package. Each row represents one unique bundle product.
*   **Prefix:** `sbm_`
*   **Columns:**
    *   `sbm_BundleWebIdEn`: **Primary Key.** The WooCommerce Product ID for the bundle.
    *   `sbm_NameEn`: The bundle's display name in English.
    *   `sbm_DescriptionEn`: The bundle's description in English.
    *   `sbm_BundleWebIdHe`: The WooCommerce Product ID for the translated bundle.
    *   `sbm_NameHe`: The bundle's display name in Hebrew.
    *   `sbm_DescriptionHe`: The bundle's description in Hebrew.
    *   `sbm_BundleType`: The type of bundle, e.g., `'Package'` (fixed components) or `'Bundle'` (customer-controlled components).
    *   `sbm_Theme`: A theme name used for grouping or suggesting products (e.g., "Summer Reds").
    *   `sbm_PackagePrice`: The special, discounted price if the `sbm_BundleType` is `'Package'`.

### 2. `SysBundleRows` (Bundle Blueprint & Rules)
*   **Purpose:** Defines the structure, layout, and eligibility rules for each row within a bundle.
*   **Prefix:** `sbr_`
*   **Columns:**
    *   `sbr_RowId`: **Primary Key.** A unique ID for this specific row (e.g., `BUN-001-ROW-01`).
    *   `sbr_BundleWebIdEn`: Links the row to a bundle in `SysBundlesM`.
    *   `sbr_RowOrder`: A number (1, 2, 3...) to define the display order of the row within the bundle.
    *   `sbr_RowType`: The type of row, either `'Product'` or `'Text'`.
    *   **For 'Text' Rows:**
        *   `sbr_TextContentEn`: The text to display in English.
        *   `sbr_TextContentHe`: The text to display in Hebrew.
    *   **For 'Product' Rows (Eligibility Rules):**
        *   `sbr_EligibleCategory`: The product category a component must belong to.
        *   `sbr_EligiblePriceMin`: The minimum price for an eligible component.
        *   `sbr_EligiblePriceMax`: The maximum price for an eligible component.
        *   `sbr_EligibleAttributes`: A delimited string of required attributes (e.g., 'Color=Red;Vintage=2020').
        *   `sbr_MinStockThreshold`: A specific stock threshold for this product slot that triggers a warning.
        *   `sbr_DefaultQuantity`: The default quantity for this product slot.
        *   `sbr_IsCustomerControl`: A TRUE/FALSE flag indicating if the customer can change the quantity.

### 3. `SysBundleActiveComponents` (Live Bundle Version)
*   **Purpose:** Tracks the currently active, specific SKU filling each product slot in a bundle. This is the sheet the system actively monitors for stock levels.
*   **Prefix:** `sac_`
*   **Columns:**
        *   `sac_RowId`: **Primary Key.** Links directly to a product row and its rules in `SysBundleRows`.
        *   `sac_ActiveSKU`: The actual product SKU currently filling this slot.

### 4. `SysBundleComponentHistory` (Audit Log)
*   **Purpose:** An append-only log that provides a full audit trail of every component replacement.
*   **Prefix:** `sbh_`
*   **Columns:**
    *   `sbh_Timestamp`: The exact date and time the change was made.
    *   `sbh_RowId`: Which product slot (`sac_RowId`) was changed.
    *   `sbh_OldSKU`: The SKU that was removed.
    *   `sbh_NewSKU`: The new SKU that was added.
    *   `sbh_ChangedBy`: The user or process that made the change.
    *   `sbh_Reason`: The reason for the change (e.g., "Low Stock", "Seasonal Update").

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


### 6. `SysInventoryOnHold` (System On-Hold Inventory)
*   **Purpose:** Stores a pre-calculated summary of stock committed to 'On-Hold' orders to improve system performance.
*   **Columns:**
    *   `sio_SKU`: **Primary Key.**
    *   `sio_OnHoldQuantity`

### 7. `SysProductAudit` (System Product Audit)
*   **Purpose:** A central audit log for both inventory counts and product detail verifications across all locations.
*   **Columns:**
    *   `spa_AuditId`: **Primary Key.** (UUID).
    *   `spa_SKU`: The SKU being audited.
    *   `spa_AuditType`: 'Inventory Count', 'Product Detail Verification'.
    *   `spa_Timestamp`: When the audit event occurred/was submitted.
    *   `spa_CountValue`: (For Inventory Count) The submitted count.
    *   `spa_Location`: (For Inventory Count) The location of the count ('Brurya', 'Storage', 'Office', 'Shop').
    *   `spa_CountedBy`: (For Inventory Count) User who performed the count.
    *   `spa_VerificationStatus`: (For Product Detail Verification) 'Verified', 'Issues Found', 'Pending Review'.
    *   `spa_VerifiedBy`: (For Product Detail Verification) User who performed verification.
    *   `spa_Notes`: Any additional notes from the auditor.
    *   `spa_ReviewStatus`: 'Pending Admin Review', 'Approved', 'Rejected', 'Brurya - Manager Controlled'.
    *   `spa_AdminNotes`: Notes from admin review.
    *   `spa_AdminTimestamp`: Timestamp of admin review.
    *   `spa_LinkedTaskId`: (Optional) Link to a `SysTasks` entry if the audit was part of a task.

## Managed Inventory Data Model

This section defines the sheets used to manage physical inventory at non-Comax locations and their audit trails.

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

### 2. `SysFailedJobs` (Dead Letter Queue)
*   **Purpose:** Records information about automated jobs that have failed, allowing for administrative review and retry.
*   **Prefix:** `sfj_`
*   **Columns:**
    *   `sfj_Timestamp`: When the failure occurred.
    *   `sfj_OriginalFileId`: The ID of the quarantined file that caused the failure.
    *   `sfj_ServiceName`: The service that failed during processing.
    *   `sfj_Error`: The specific error message.
    *   `sfj_Status`: The current status of the failed job (`NEW`, `RETRYING`, `RESOLVED`, `IGNORED`).