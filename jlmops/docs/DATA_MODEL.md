# Data Model

This document provides a detailed reference for the Google Sheets that serve as the database for the JLM Operations Hub. All sheets are located in the central Reference Spreadsheet unless otherwise specified.

## Naming Conventions

To ensure clarity, consistency, and robust programmatic access, all sheets and columns follow a strict naming convention.

### Sheet Names

Sheet names follow a `Source_Topic_Type` pattern, modified for brevity and clarity.

### Boolean Columns

Columns typed "Boolean" in this doc are not reliably real GAS booleans on the sheet — some are written as the string `'TRUE'`/`'FALSE'` instead (confirmed live, 2026-07-02; `ContactService.js:933` already defends against both forms). Never compare with `=== true` alone; check both (`v === true || v === 'TRUE'`).

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
| `WebXltM`    | `wxm_` |
| `WebXltS`    | `wxs_` |
| `BruryaStock`| `bru_` |
| `SysBundles` | `sb_` |
| `SysBundleSlots` | `sbs_` |
| `SysTasks`             | `st_`  |
| `SysTaskTypes`         | `stt_` |
| `SysTaskStatusWorkflow`| `stw_` |
| `SysProjects`          | `spro_` |
| `SysMarketingCampaigns`| `sm_`  |
| `SysShortUrls`         | `ssu_` |
| `SysConfig`            | `scf_` |
| `WebOrdM_Archive`      | `woma_`|
| `WebOrdItemsM_Archive` | `woia_`|
| `SysContacts`          | `sc_`  |
| `SysContactActivity`   | `sca_` |
| `SysCoupons`           | `sco_` |
| `SysCampaigns`         | `scm_` |
| `SysCouponUsage`       | `scu_` |
| `SysBrands`            | `sbr_` |
| `SysCategories`        | `sct_` |



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
*   **Purpose:** Master table of Hebrew (translated) product data pulled from WooCommerce/WPML. Populated from `WebXltS` staging via the daily HE pull (`WooProductPullService` → `ProductImportService.upsertWebXltData`), which **clears and rewrites the whole table every sync run** — WebXltM is fully sync-owned, never hand-maintained.
*   **Columns:** 31 columns mirroring `WebXltS` staging (`schema.data.WebXltM` in `config/schemas.json`) — WordPress/WPML fields (`wxm_ID`, `wxm_PostTitle`, `wxm_SKU`, `wxm_WpmlLanguageCode`, `wxm_WpmlOriginalId`, `wxm_WpmlOriginalSku`) plus RankMath and Woosb (bundle) fields, matching the equivalent EN-side fields on `WebProdM`. **Key column:** `wxm_ID`. The EN↔HE link is `wxm_WpmlOriginalId`/`wxm_WpmlOriginalSku`, pointing back to the EN product.
*   **Historical note:** an earlier, much smaller 4-column schema (`wxl_WebIdHe`, `wxl_NameHe`, `wxl_WebIdEn`, `wxl_SKU`) was retired before the live `wxm_` schema above; the manual new-product hot-link (`linkAndFinalizeNewProduct`, deleted @422 per `_archive/NEW_PRODUCT_WORKFLOW_UX_PLAN.md`) kept writing those old `wxl_` column names until removal — dead code, since the live headers never matched and every write silently no-opped.

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
    *   `wom_CustomerUser`: WooCommerce user ID (for coupon targeting).
    *   `wom_MetaWpmlLanguage`: WPML language code from order (e.g., 'en', 'he').
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
    *   `spro_ProjectId`: **Primary Key.** A unique ID for the project (e.g., `PROJ-NL-context-2026-05-25`, `PROJ-INV-SYNC`).
    *   `spro_Name`: The human-readable name of the project.
    *   `spro_Type`: The type of project (e.g., 'CAMPAIGN', 'OPERATIONAL', 'ONE_OFF').
    *   `spro_Status`: The current state (e.g., 'PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED').
    *   `spro_StartDate`: The planned start date.
    *   `spro_EndDate`: The planned end date (optional for ongoing operational projects).
    *   ~~`spro_CampaignId`~~ — **Dropped.** FK direction reversed: `SysMarketingCampaigns.sm_ProjectId` now points to `SysProjects` (one campaign → one project). The old back-link on SysProjects rows is gone.

## Marketing Campaign Data Model

This section defines the sheets supporting the Campaign attribution layer. Designed for shared-attribution reporting (one row per "how did this do" question) and unified UTM/short-URL/QR generation. Full architecture in `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`.

### 1. `SysMarketingCampaigns` (Top-level Campaign Container)
*   **Purpose:** Each row defines a shared-attribution unit — typically a delivery-channel program (`newsletter-print`, `email-broadcast`). Each campaign links to one SysProject via `sm_ProjectId`. Bounded topic/promo Campaigns are supported but not seeded at launch. Seeded rows: `core-content`, `newsletter-print`, `email-broadcast`, `flyer-acquisition`.
*   **Prefix:** `sm_`
*   **Columns:**
    *   `sm_CampaignId`: **Primary Key.** Pure slug for ongoing programs (`newsletter-print`); slug + date for rare bounded campaigns.
    *   `sm_Name`: Human name (e.g., "Print Newsletter — Wine Talk").
    *   `sm_Status`: PLANNING / ACTIVE / COMPLETED / ARCHIVED.
    *   `sm_StartDate`: First distribution under this campaign.
    *   `sm_EndDate`: Nullable. Null = ongoing. Set = bounded.
    *   `sm_ProjectId`: **FK** to `SysProjects.spro_ProjectId`. One campaign → one project. Replaces the old `spro_CampaignId` direction (dropped from SysProjects).
    *   `sm_PrimaryGoal`: Free text, one line — what success looks like.
    *   `sm_Notes`

### 2. `SysShortUrls` (Short Code Registry)
*   **Purpose:** Maps short codes to utm-tagged target URLs. Populated by the Campaign Service when the partner generates outputs for a Distribution. The redirect runtime is RankMath; jlmops pushes rule entries to RankMath when a row is created here. Each language gets its own short code (no regex unification).
*   **Prefix:** `ssu_`
*   **Columns:**
    *   `ssu_ShortCode`: **Primary Key.** Unique code used in `jlmwines.com/n/<code>` URLs.
    *   `ssu_CampaignId`: FK to `SysMarketingCampaigns.sm_CampaignId`.
    *   `ssu_EntitySlug`: **FK** to `SysLibrary.slb_Slug`. Distribution events are Library entities, not Projects rows. Replaced the old `ssu_ProjectId`.
    *   `ssu_Language`: `en` or `he`.
    *   `ssu_TargetUrl`: Utm-tagged destination URL.
    *   `ssu_CreatedDate`
    *   `ssu_Notes`

### Cross-Sheet FKs Introduced

*   `SysMarketingCampaigns.sm_ProjectId` → `SysProjects.spro_ProjectId` (replaces old `spro_CampaignId` back-link)
*   `SysCampaigns.scm_MarketingCampaignId` → `SysMarketingCampaigns.sm_CampaignId` (nullable; Mailchimp sends rolling up under a marketing campaign)
*   `SysShortUrls.ssu_CampaignId` → `SysMarketingCampaigns.sm_CampaignId`
*   `SysShortUrls.ssu_EntitySlug` → `SysLibrary.slb_Slug` (replaced `ssu_ProjectId`)

Two further FKs are documented for future use but not added at launch (added when their workflows ship):
*   `SysContactActivity.sca_CampaignId` → `SysMarketingCampaigns.sm_CampaignId` (deferred until Contact Manager Half 2)
*   `SysCoupons.sco_CampaignId` → `SysMarketingCampaigns.sm_CampaignId` (not adding — brand position isn't discount-driven, effectively one coupon)

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
    *   `st_LinkedEntityName`: Human-readable label for the linked entity (display companion to `st_LinkedEntityId`).
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
    *   `st_EntityType`: **Polymorphic entity type.** Names what kind of thing the task is attached to — a Content Library content type (`blog`, `news`, `email`, etc.) or a *virtual entity type* (`customer`, `order`, `project`).
    *   `st_EntityId`: **Polymorphic foreign key**, resolved by `st_EntityType`. For library content types it is a `SysLibrary.slb_Slug`; for virtual entity types it points at the source sheet's row id (`SysContacts.sc_Email`, an order id, or a `SysProjects.spro_ProjectId`). Distinct from `st_LinkedEntityId` (the older free-form subject/asset link). See `plans/CONTENT_LIBRARY_PLAN.md` §7 (virtual entity types).

## CRM Data Model

This section defines the sheets used for customer relationship management, contact tracking, and marketing campaign support.

### 1. `SysContacts` (Contact Master)
*   **Purpose:** The central contact list combining customer data from orders and subscriber data from Mailchimp. Each row represents one unique email address.
*   **Prefix:** `sc_`
*   **Primary Key:** `sc_Email`
*   **Columns:**
    *   **Identity:**
        *   `sc_Email`: **Primary Key.** Lowercase, trimmed email address.
        *   `sc_Name`: Display name (from orders or Mailchimp).
        *   `sc_Phone`: Primary phone number (most recent from orders).
        *   `sc_WhatsAppPhone`: Phone formatted for WhatsApp links (+972...).
    *   **Demographics:**
        *   `sc_Language`: `EN` or `HE` (from order language or Mailchimp).
        *   `sc_City`: Shipping city (raw, from most recent order).
        *   `sc_Country`: Shipping country code.
        *   `sc_WooUserId`: WooCommerce user ID (for coupon targeting by user ID list).
    *   **Classification:**
        *   `sc_CustomerType`: One of: `core.new`, `core.repeat`, `core.vip`, `noncore.gift`, `noncore.war_support`, `prospect.subscriber`, `prospect.fresh`, `prospect.stale`.
        *   `sc_LifecycleStatus`: One of: `Active` (0-30 days), `Recent` (31-90), `Cooling` (91-180), `Lapsed` (181-365), `Dormant` (365+).
        *   `sc_IsCore`: Boolean. TRUE if core customer (not gift purchaser, not war-support).
        *   `sc_IsCustomer`: Boolean. TRUE if has placed at least one order.
        *   `sc_IsSubscribed`: Boolean. TRUE if in Mailchimp list.
    *   **Purchase Metrics:**
        *   `sc_FirstOrderDate`: Date of earliest order.
        *   `sc_LastOrderDate`: Date of most recent order.
        *   `sc_DaysSinceOrder`: Calculated daily. Days since last order.
        *   `sc_OrderCount`: Total completed orders.
        *   `sc_TotalSpend`: Sum of order totals (lifetime).
        *   `sc_Spend12Month`: Sum of order totals over the trailing 12 months.
        *   `sc_Tier`: Spend/loyalty tier.
        *   `sc_AvgOrderValue`: Calculated. Average order value.
    *   **Subscription:**
        *   `sc_SubscribedDate`: Date joined Mailchimp.
        *   `sc_DaysSubscribed`: Calculated daily. Days since subscription.
        *   `sc_SubscriptionSource`: How they subscribed (from Mailchimp NOTES).
    *   **Engagement:**
        *   `sc_LastContactDate`: Date of last outreach sent.
        *   `sc_LastContactType`: Type of last contact (whatsapp/email/mailchimp).
    *   **Predictions:**
        *   `sc_NextOrderExpected`: Predicted next order date.
        *   `sc_ChurnRisk`: `low`, `medium`, or `high`.
    *   **Wine Preferences:** (Calculated from order history. Several fields are stored as a dual-language `_En`/`_He` pair so bilingual labels can be rendered/exported without re-translation; the underlying value is the same.)
        *   `sc_FrequentCategories_En` / `sc_FrequentCategories_He`: Most-purchased wine categories (dual-language).
        *   `sc_PriceAvg`: Average bottle price purchased.
        *   `sc_PriceMin`: Lowest bottle price purchased.
        *   `sc_PriceMax`: Highest bottle price purchased.
        *   `sc_RedIntensityRange`: Intensity band of purchased reds.
        *   `sc_RedComplexityRange`: Complexity band of purchased reds.
        *   `sc_WhiteComplexityRange`: Complexity band of purchased whites.
        *   `sc_WhiteAcidityRange`: Acidity band of purchased whites.
        *   `sc_TopWineries_En` / `sc_TopWineries_He`: Top wineries by purchase count (dual-language).
        *   `sc_TopRedGrapes_En` / `sc_TopRedGrapes_He`: Top red grape varieties (dual-language).
        *   `sc_TopWhiteGrapes_En` / `sc_TopWhiteGrapes_He`: Top white grape varieties (dual-language).
        *   `sc_KashrutPrefs_En` / `sc_KashrutPrefs_He`: Observed kashrut patterns (dual-language).
        *   `sc_BundleBuyer`: Boolean. Has purchased bundles.
        *   `sc_AvgBottlesPerOrder`: Typical order size in bottles.
    *   **System:**
        *   `sc_Tags`: Comma-separated manual tags.
        *   `sc_Notes`: Free-form notes.
        *   `sc_CreatedDate`: Record creation date.
        *   `sc_LastUpdated`: Last refresh date.
        *   `sc_LastEnriched`: Date the enrichment pass last recalculated this contact's derived fields.
        *   `sc_FirstCompletedDate`: Date of the contact's first completed order.
*   **Derived field rules:** The classification and preference fields are computed by `ContactService.js` (`_classifyCustomerType`, `_calculateLifecycleStatus`) and `ContactEnrichmentService.js`. Every threshold below is **config-driven** (read from `SysConfig`); the values shown are the current defaults used when the config key is absent.
    *   `sc_LifecycleStatus` (by `sc_DaysSinceOrder`, key `crm.lifecycle.thresholds`): `Active` ≤30, `Recent` ≤90, `Cooling` ≤180, `Lapsed` ≤365, `Dormant` >365.
    *   `sc_CustomerType` (key `crm.vip.thresholds`, `crm.prospect.thresholds`): non-customers → `prospect.fresh` (not subscribed, or subscribed <30 days), `prospect.stale` (subscribed ≥180 days), else `prospect.subscriber`. Customers: non-core → `noncore.gift`; core with `sc_OrderCount` ≥5 **or** `sc_TotalSpend` ≥3000 → `core.vip`; ≥2 orders → `core.repeat`; else `core.new`. (Note: `_classifyCustomerType` assigns only `noncore.gift` among non-core types — `noncore.war_support` is a legacy/manual value, not auto-assigned.)
    *   `sc_ChurnRisk` (key `crm.churn.thresholds`): `low` when recently active (default ≤60 days) with ≥2 orders / ≥1000 spend; higher otherwise.
    *   Wine-preference enrichment (`ContactEnrichmentService.js`): `sc_FrequentCategories_*` = categories making up ≥15% of purchases (key `crm.enrichment.category`); `sc_PriceMin`/`sc_PriceMax` = 10th/90th percentile of bottle prices to trim outliers (key `crm.enrichment.price`, needs ≥3 prices else raw min/max); `*Range` attribute fields = 15th–85th percentile of intensity/complexity/acidity (key `crm.enrichment.attributes`); `sc_TopWineries_*`/`sc_TopRedGrapes_*`/`sc_TopWhiteGrapes_*`/`sc_KashrutPrefs_*` = top 3 by purchase count; `sc_BundleBuyer` = bought any SKU with `wpm_TaxProductType='woosb'`.

### 2. `SysContactActivity` (Contact Timeline)
*   **Purpose:** Stores timeline events for each contact - orders, status changes, communications, etc.
*   **Prefix:** `sca_`
*   **Primary Key:** `sca_ActivityId`
*   **Columns:**
    *   `sca_ActivityId`: **Primary Key.** Unique ID (UUID).
    *   `sca_Email`: **Foreign Key** to `SysContacts.sc_Email`.
    *   `sca_Timestamp`: When the event occurred.
    *   `sca_Type`: Event type (see below).
    *   `sca_Summary`: Human-readable summary.
    *   `sca_Details`: JSON with type-specific data.
    *   `sca_CreatedBy`: `system` or user email.
*   **Activity Types:**
    *   `order.placed` - New order. Details: `{ orderId, total, itemCount, couponUsed }`
    *   `bundle.purchased` - Bundle in order. Details: `{ orderId, bundleName, bundleId }`
    *   `status.changed` - Lifecycle status change. Details: `{ from, to }`
    *   `type.changed` - Customer type change. Details: `{ from, to }`
    *   `comm.whatsapp` - WhatsApp sent. Details: `{ template, outcome, notes }`
    *   `comm.email` - Email sent. Details: `{ subject }`
    *   `comm.mailchimp` - Included in Mailchimp campaign. Details: `{ campaignName, campaignId }`
    *   `coupon.offered` - Coupon shared. Details: `{ code, channel, campaignName }`
    *   `coupon.used` - Coupon redeemed. Details: `{ code, orderId, discount }`
    *   `note.added` - Manual note. Details: `{ note }`
    *   `mailchimp.subscribed` - New subscription detected.
    *   `mailchimp.unsubscribed` - Subscription removed.

### 3. `SysCoupons` (Coupon Reference)
*   **Purpose:** Reference data for WooCommerce coupons. Imported from coupon export CSV.
*   **Prefix:** `sco_`
*   **Primary Key:** `sco_Code`
*   **Columns:**
    *   `sco_Code`: **Primary Key.** Coupon code (case-sensitive).
    *   `sco_WooId`: WooCommerce ID.
    *   `sco_Description`: Coupon description.
    *   `sco_Status`: `publish`, `draft`, or `trash`.
    *   `sco_CreatedDate`: When created.
    *   **Discount:**
        *   `sco_DiscountType`: `percent`, `fixed_cart`, or `fixed_product`.
        *   `sco_Amount`: Discount value.
        *   `sco_FreeShipping`: Boolean. Includes free shipping.
    *   **Restrictions:**
        *   `sco_MinSpend`: Minimum cart amount.
        *   `sco_MaxSpend`: Maximum cart amount.
        *   `sco_Categories`: Restricted categories.
        *   `sco_FirstPurchaseOnly`: Boolean. New customers only.
        *   `sco_FreeProductId`: Free gift product ID.
        *   `sco_IndividualUse`: Boolean. Can't combine with other coupons.
    *   **Limits:**
        *   `sco_UsageLimit`: Max total uses (0 = unlimited).
        *   `sco_UsageLimitPerUser`: Max uses per customer.
        *   `sco_UsageCount`: Times used.
        *   `sco_ExpiryDate`: Expiration date.
    *   **Classification:**
        *   `sco_Tags`: Auto-derived tags (war-support, welcome, threshold, gift, shipping-only).
        *   `sco_IsActive`: Calculated. Usable now.
        *   `sco_CustomerEmail`: For email-restricted coupons.
    *   **System:**
        *   `sco_LastImported`: Last sync date.

### 4. `SysCampaigns` (Mailchimp Campaign History)
*   **Purpose:** Historical record of Mailchimp campaigns for performance analysis.
*   **Prefix:** `scm_`
*   **Primary Key:** `scm_CampaignId`
*   **Columns:**
    *   `scm_CampaignId`: **Primary Key.** Mailchimp unique ID.
    *   `scm_Title`: Internal campaign title.
    *   `scm_Subject`: Email subject line.
    *   `scm_SendDate`: When sent.
    *   `scm_SendWeekday`: Day of week.
    *   **Delivery:**
        *   `scm_Recipients`: Total audience size.
        *   `scm_Delivered`: Successfully delivered.
        *   `scm_Bounces`: Total bounces.
    *   **Engagement:**
        *   `scm_UniqueOpens`: Unique openers.
        *   `scm_OpenRate`: Open percentage (decimal).
        *   `scm_TotalOpens`: All opens.
        *   `scm_UniqueClicks`: Unique clickers.
        *   `scm_ClickRate`: Click percentage (decimal).
        *   `scm_TotalClicks`: All clicks.
        *   `scm_Unsubscribes`: Unsubscribe count.
    *   **Revenue:**
        *   `scm_TotalOrders`: Orders attributed.
        *   `scm_GrossSales`: Gross revenue.
        *   `scm_Revenue`: Net revenue.
    *   **Classification:**
        *   `scm_CampaignType`: Derived from title (seasonal, value, explore, bundle, news, general).
    *   **System:**
        *   `scm_LastImported`: Last sync date.

### 5. `SysCouponUsage` (Coupon Redemption Tracking)
*   **Purpose:** Tracks each coupon use for conversion analysis.
*   **Prefix:** `scu_`
*   **Primary Key:** `scu_Id`
*   **Columns:**
    *   `scu_Id`: **Primary Key.** Unique ID (UUID).
    *   `scu_Code`: **Foreign Key** to `SysCoupons.sco_Code`.
    *   `scu_Email`: **Foreign Key** to `SysContacts.sc_Email`.
    *   `scu_OrderId`: Order ID where coupon was used.
    *   `scu_OrderDate`: Order date.
    *   `scu_DiscountAmount`: Discount given.
    *   `scu_OrderTotal`: Order total after discount.
    *   `scu_WasFirstOrder`: Boolean. Was this the customer's first order?
    *   `scu_ConvertedToRepeat`: Boolean. Did they order again within 90 days?

### 6. `SysKPISummary` (Business KPI Cache)
*   **Purpose:** Fast-read cache for `business/KPI.md`'s 4 jlmops-source KPIs (new customers EN/HE, first-order conversion+AOV, 90-day return rate, newsletter subscribers+engagement). One row per period: `sk_Period='current'` (rolling 90-day snapshot, recomputed daily) or `YYYY-MM` (frozen monthly close, written once on the 1st of the following month and never rewritten — late-arriving data does not retroactively edit history; `KPISummaryService.backfillMonths` is the only path to correct a closed row). `jlmops-status.md`'s KPI block reads this sheet instead of walking `SysContacts`/`SysCouponUsage`/`SysCampaigns` directly (~30× fewer cells read).
*   **Prefix:** `sk_`
*   **Primary Key:** `sk_Period`
*   **Columns:** `sk_Period`, `sk_AsOfTimestamp`, `sk_NewCustomersEN`/`HE`/`Total`, `sk_FirstOrderConvRate`, `sk_FirstOrderAOV`, `sk_Return90Rate`, `sk_TotalCoreCustomers`, `sk_Subscribers`, `sk_SubscriberGrowthMoM` (only populated by `closeMonth()`, always blank on the `current` row), `sk_CampaignsSent`, `sk_AvgOpenRate`, `sk_AvgClickRate`, `sk_Notes`.
*   **Known gotcha:** a plain `"YYYY-MM"` string written to `sk_Period` can get silently auto-converted to a Date by Sheets; readers must normalize (`instanceof Date` → reformat) rather than assume the stored type. `_upsertRow`'s own dedup match has this same unfixed bug — see `.claude/bugs.md` 2026-07-03.
*   **Not covered here:** the two GA4-source KPIs (#1 organic-traffic EN/HE split, #6 organic-source engagement) don't live in this sheet — both are read live from a GA4 Sheets add-on report (`StatusReportService._readGa4Audience`) and folded into `jlmops-status.md`'s Traffic block directly.
*   Full engineering spec (build sequence, config, worked example) archived at `jlmops/plans/_archive/KPI_SUMMARY_TAB.md` — implementation complete, nothing pending.

## Content Library Data Model

The Content Library is a single flat, polymorphic table holding every content/marketing entity (blog, news, mention, email/newsletter, social, template, image), plus a shared activity log. Full design intent lives in `plans/CONTENT_LIBRARY_PLAN.md`; the durable schema and placement facts are here.

**Workbook placement (durable constraint).** `SysLibrary` does **not** live in `JLMops_Data`. It lives in a separate single-tab workbook, `JLMops_Library` (id in `system.spreadsheet.library`), because Drive MCP can only read single-tab workbooks and the library must stay MCP-readable (see `reference_drive_files`). Its schema key uses the `schema.library.*` prefix so the validator and `syncHeaders` route to `getLibrarySpreadsheet()` instead of `getDataSpreadsheet()`. `SysLibraryActivity`, by contrast, is an ops-only log and lives inside `JLMops_Data` (`schema.data.*`).

**Slug as the universal key (§20).** `slb_Slug` is the key column — human-readable, immutable, globally unique, format `<type>-<topic>-<discriminator>[-<language>]` (lowercase kebab-case, type-prefix first, language last). There is no separate synthetic id: the slug is both the human handle and the cross-system foreign key. It is the value stored in `slb_References` entries, `slba_EntityId` (library rows), and `SysTasks.st_EntityId` (library-typed tasks), and it joins library rows to their Canva title, Mailchimp name, and Drive filename.

### 1. `SysLibrary` (Library Master)
*   **Purpose:** One row per content/marketing entity. Generic columns are always populated; per-type extension columns are sparse (only set for the relevant content type). `slb_Tags`, `slb_Taxonomy`, and `slb_References` are stored as JSON arrays.
*   **Workbook:** `JLMops_Library` (NOT `JLMops_Data`).
*   **Prefix:** `slb_`
*   **Primary Key:** `slb_Slug`
*   **Columns:**
    *   **Generic (always populated):**
        *   `slb_Slug`: **Primary Key.** See "Slug as the universal key" above.
        *   `slb_Title`: Human-readable title.
        *   `slb_ContentType`: Entity type — `blog`, `news`, `mention`, `email`, `print`, `social`, `template`, `image`. `print` (printed newsletter, flyers, carton art) validated server-side in `LibraryService.js` `VALID_TYPES`; folder routing is generic (`_getCanonicalFolder`), no print-specific code needed.
        *   `slb_Language`: `EN`, `HE`, or language-neutral.
        *   `slb_State`: Lifecycle state. Controlled vocabulary (CONTENT_WORKFLOW_REDESIGN Decision 6): `draft` (seeded on spawn/registration by `addEntity`) → `locked` (in-app version lock, `LibraryService.lockVersion`) → `published` (set when the in-app publish task closes via `LibraryService.markPublished`, or session-side by `content/register-library.js`). `abandoned` is a terminal state set by `LibraryService.abandonEntity` (admin "Abandon" action), filtered out of the deficiency view. Pills render any value via `TaskWidgets.statusClass`. The granular `editing`/`translating`/`in_review` states in early drafts were never wired and are not in use — handoff progress is read from attached-task states + the deficiency stall signal instead.
        *   `slb_Version`: **Retired/inert** since @319 — `lockVersion` no longer bumps it and no UI reads it (version display was stripped from the content pack and the LibraryView "Ver" column). Column kept append-only for history; current-version tracking is file-based (see "Document versioning" below), not a counter.
        *   `slb_CreatedDate`, `slb_CreatedBy`, `slb_LastTouched`: Provenance / last-modified.
        *   `slb_TargetDate`: Target publish date (ISO). Optional, written by `spawnContentChain` when the caller supplies it. Drives the LibraryView **Deficiency** preset (pieces due within `system.content.deficiency_window_days`, plus overdue not-yet-`published`). Appended column (CONTENT_WORKFLOW_REDESIGN Decision 1).
        *   `slb_CampaignId`: **Nullable FK** to `SysMarketingCampaigns.sm_CampaignId`. Set at spawn; null for templates and non-campaign entities. Blog posts carry `core-content`; newsletter/email/flyer entities carry the relevant distribution campaign ID.
        *   `slb_Tags`: JSON array of free-form tags.
        *   `slb_Taxonomy`: JSON array of taxonomy terms.
        *   `slb_References`: JSON array of related-entity slugs (cross-links).
        *   `slb_Notes`: Free-form notes.
    *   **Per-type extension (sparse, set only for the relevant type):**
        *   *Article (blog/news/mention):* `slb_MdUrl`, `slb_DocUrl`, `slb_WpPostId`, `slb_Excerpt`, `slb_PostedAt`, `slb_ExternalUrl`.
        *   *Newsletter / print:* `slb_IssueNumber`, `slb_PrintDate`, `slb_Position`.
        *   *Email / Mailchimp:* `slb_MailchimpCampaignId`, `slb_SubjectLine`, `slb_SendDate`, `slb_RecipientCount`, `slb_Subject`, `slb_Body`, `slb_Channel`.
        *   *Social:* `slb_Platform`, `slb_ScheduledAt`.
        *   *Image / Canva:* `slb_CanvaDesignUrl`, `slb_Kind`, `slb_Index`, `slb_Descriptor`.
    *   **Content source of truth (2026-06-15):** a content entity's editable content lives in its **Doc** (`slb_DocUrl`) — users see/edit/translate there, and the runtime reads it via **`LibraryService.getEntityContent`** (Doc-first; parses a leading `Subject:` line for email/template, body-only for the addendum/social). The inline **`slb_Subject`/`slb_Body`** fields are **legacy/fallback**, used only when an entity has no Doc yet (migration) or a Doc read fails. `createBlankDoc` seeds a new Doc from the inline fields **once**; thereafter the Doc is authoritative. Runtime consumers read from Docs via `getEntityContent`: the pending-payment follow-up send (`HousekeepingService`) and the manager outreach Action Panel (`WebAppContacts_getOutreachTemplate`, which seeds welcome/outreach messages); packing slips (`PrintService`) read their own Doc template directly. Inline-`slb_Body` → Doc migration is in progress; the fields retire once it completes. `slb_DocUrl` is now populated for `template`/`email` types too (not only articles).
    *   **Document versioning — attach-to-replace (file-based, library-blind):** a new version is a new Drive Doc, attached to replace the current one — there is no fork/lock engine and no version counter (see `slb_Version` above). `LibraryService.attachExistingDoc({entityId, driveUrl})` is the single mechanism: it moves the pasted Doc into the entity's canonical library folder, renames it `<slug> <timestamp>`, points `slb_DocUrl` at it, and — if a prior Doc existed — stamps the old one "Superseded by →" and moves it to a flat `_archive` folder (`_supersedeFile`/`_getArchiveFolder`), logging `slba_ActionType = 'version_superseded'` (`supersededFileId`, `successorUrl`; no task reference — the function takes only `entityId` and `driveUrl`, so this record is identical regardless of what triggered it). Two UI entry points call the same backend endpoint (`WebAppLibrary_attachExistingDoc`) and are otherwise unrelated: **task-scoped** — `TaskPacks.attachExistingDoc(taskId)` ("Attach new version" on a content task, `TaskPacks.html`), which resolves `task.entityId` client-side only; **entity-scoped** — the Library entity detail drawer's "Attach new version" button (`LibraryView.html`/`PublishingView.html`), which reaches the current version directly with no task required. `createTranslationDraft` (copy EN Doc → attach as HE current) is the same mechanism specialized for HE translation.

### 2. `SysLibraryActivity` (Library Activity Log)
*   **Purpose:** Per-entity audit trail across all library and virtual entities. Polymorphically attached via `(slba_EntityType, slba_EntityId)`.
*   **Workbook:** `JLMops_Data` (ops-only log).
*   **Prefix:** `slba_`
*   **Primary Key:** `slba_ActivityId`
*   **Columns:**
    *   `slba_ActivityId`: **Primary Key.**
    *   `slba_EntityType`: What the row is attached to — a library content type, or a *virtual entity type* (`customer`, `order`, `project`).
    *   `slba_EntityId`: **Polymorphic foreign key**, resolved by `slba_EntityType` — a `SysLibrary.slb_Slug` for library types, or the source row id (`SysContacts.sc_Email`, an order id, a `SysProjects.spro_ProjectId`) for virtual types. See `plans/CONTENT_LIBRARY_PLAN.md` §7.
    *   `slba_Timestamp`: When the action occurred.
    *   `slba_Actor`: Who/what performed the action.
    *   `slba_ActionType`: The action performed. Includes `version_superseded` (see "Document versioning" above) and `url-stamped` — `LibraryService.markPublished` resolves the published `jlmwines.com/<slug>` (+ `/he/<slug>`) URL and logs it against every entity whose `slb_References` names the newly-published slug, surfacing it in that entity's LibraryView/PublishingView drawer activity tab. (The companion session-side idea of writing a `content/<slug>/urls.md` file, from `CONTENT_DISTRIBUTION_PLAN.md`, was never adopted — `push-posts.js` already prints the published URL to the console on a successful push, which covers the same need.)
    *   `slba_Summary`: One-line human-readable summary.
    *   `slba_Details`: Structured detail (JSON).
    *   `slba_ReferencedEntities`: JSON array of other entity slugs/ids touched by the action.

## Publishing Calendar

### `JLMops_Publishing` (Standalone Google Sheet)

*   **Purpose:** The shared publishing calendar. Read by sessions via Drive MCP; read and written by jlmops via `SpreadsheetApp.openById()`. Holds manually-maintained holiday/blackout/note rows. Jlmops daily housekeeping regenerates entity rows from SysLibrary (`refreshCalendarExport`), merging them with the manual rows sorted by date. Sessions read the merged result for planning context.
*   **Workbook:** Standalone single-tab Google Sheet (`system.calendar.sheet_id` in SysConfig). Drive MCP compatible (single-tab).
*   **Prefix:** `cal_`
*   **Columns:**
    *   `cal_Date`: Date of the event (ISO or Google Sheets date).
    *   `cal_Name`: Display name — holiday name or entity title.
    *   `cal_Type`: Row kind. Manual rows: `holiday`, `blackout`, `note`. Entity rows: content type (`blog`, `news`, `email`, `flyer`, `other`).
    *   `cal_Notes`: For manual rows: optional notes. For entity rows: `state · campaignId`.
*   **Write rules:** Manual rows (`cal_Type` ∈ `holiday / blackout / note`) are preserved by `refreshCalendarExport` and never overwritten. All other rows are cleared and regenerated from SysLibrary on each daily run.

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
