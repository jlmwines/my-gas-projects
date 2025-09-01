## Reference Sheets and Column Descriptions (Accessed by Frontend Scripts)

This document details the Google Sheets residing in the central Reference Spreadsheet that are accessed by the `frontend-scripts` codebase. Column definitions are based on their usage within these frontend scripts.

### I. Reference Sheets Accessed by Frontend Scripts

#### 1. `Audit`
*   **Description:** Tracks product stock-taking and detail verification from the Frontend.
*   **Used in:** `Brurya.js` (reads and updates quantities), `Inventory.js` (reads and updates quantities).
*   **Columns (as defined in `G.COLUMN_INDICES.AUDIT` in `Globals.js` and used in code):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B):** `SKU`
    *   **Column 3 (C):** `LastCount` (Date written by `Brurya.js`)
    *   **Column 4 (D):** `ComaxQty`
    *   **Column 5 (E):** `NewQty`
    *   **Column 6 (F):** `BruryaQty`
    *   **Column 7 (G):** `StorageQty`
    *   **Column 8 (H):** `OfficeQty`
    *   **Column 9 (I):** `ShopQty`

#### 2. `ComaxM`
*   **Description:** Master product data from the ERP.
*   **Used in:** `Brurya.js` (gets item details by SKU), `ComaxSync.js` (filters and displays data), `Inventory.js` (gets product info for tasks), `ProductDetails.js` (gets additional product details), `StockHealth.js` (analyzes stock health).
*   **Columns (as inferred from various frontend script usages):**
    *   **Column 1 (A):** `CMX ID`
    *   **Column 2 (B):** `CMX SKU`
    *   **Column 3 (C):** `CMX NAME`
    *   **Column 4 (D):** `CMX DIV`
    *   **Column 5 (E):** `CMX GROUP`
    *   **Column 11 (K):** `CMX YEAR`
    *   **Column 13 (M):** `CMX ARCHIVE`
    *   **Column 15 (O):** `CMX PRICE`
    *   **Column 16 (P):** `CMX STOCK`
    *   **Column 17 (Q):** `CMX WEB`
    *   **Column 18 (R):** `EXCLUDE`

#### 3. `Config` (Reference Spreadsheet's Config sheet)
*   **Description:** Contains system-wide configuration settings and values.
*   **Used in:** `Globals.js` (for `getReferenceSetting`), `StockHealth.js` (reads stock health rules).
*   **Columns (as defined in `G.COLUMN_INDICES.REFERENCE_CONFIG` in `Globals.js` and inferred from `StockHealth.js`):**
    *   **Column 1 (A):** `Setting`
    *   **Column 2 (B):** `Value`
    *   **Column 3 (C):** `Notes`
    *   **Column 4 (D):** `Category` (Inferred from `StockHealth.js` for `MinCat` rules)
    *   **Column 5 (E):** `Required Count` (Inferred from `StockHealth.js` for `MinCat` rules)

#### 4. `DetailsC`
*   **Description:** Contains calculated or derived product details.
*   **Used in:** `PackingSlipConsolidated.js` (reads calculated details for packing slips).
*   **Columns (as inferred from `PackingSlipConsolidated.js`):**
    *   **Column 1 (A):** `SKU`
    *   **Column 4 (D):** `Harmonize EN`
    *   **Column 5 (E):** `Contrast EN`
    *   **Column 6 (F):** `Harmonize HE`
    *   **Column 7 (G):** `Contrast HE`

#### 5. `DetailsM`
*   **Description:** The master sheet for granular product details.
*   **Used in:** `PackingSlipConsolidated.js` (reads product details for packing slips), `ProductDetails.js` (reads and updates product details).
*   **Columns (as defined in `G.COLUMN_INDICES.DETAILS_M` in `Globals.js` and used in code):**
    *   **Column 1 (A):** `SKU`
    *   **Column 2 (B):** `NAME_HE` (שם היין)
    *   **Column 3 (C):** `NAME_EN` (NAME)
    *   **Column 4 (D):** `SHORT_HE` (קצר)
    *   **Column 5 (E):** `SHORT_EN` (Short)
    *   **Column 6 (F):** `DESC_HE` (תיאור ארוך)
    *   **Column 7 (G):** `DESC_EN` (Description)
    *   **Column 8 (H):** `REGION` (אזור)
    *   **Column 9 (I):** `ABV`
    *   **Column 10 (J):** `INTENSITY`
    *   **Column 11 (K):** `COMPLEXITY`
    *   **Column 12 (L):** `ACIDITY`
    *   **Column 13 (M):** `SWEET_CON`
    *   **Column 14 (N):** `INTENSE_CON`
    *   **Column 15 (O):** `RICH_CON`
    *   **Column 16 (P):** `MILD_CON`
    *   **Column 17 (Q):** `SWEET_HAR`
    *   **Column 18 (R):** `INTENSE_HAR`
    *   **Column 19 (S):** `RICH_HAR`
    *   **Column 20 (T):** `MILD_HAR`
    *   **Column 21 (U):** `DECANT`
    *   **Column 22 (V):** `PERMIT` (היתר מכירה)
    *   **Column 23 (W):** `K1`
    *   **Column 24 (X):** `K2`
    *   **Column 25 (Y):** `K3`
    *   **Column 26 (Z):** `K4`
    *   **Column 27 (AA):** `K5`
    *   **Column 28 (AB):** `G1`
    *   **Column 29 (AC):** `G2`
    *   **Column 30 (AD):** `G3`
    *   **Column 31 (AE):** `G4`
    *   **Column 32 (AF):** `G5`

#### 6. `DetailsS`
*   **Description:** A staging sheet for product detail output, used for updates and packing slips.
*   **Used in:** `ProductDetails.js` (upserts submitted product details).
*   **Columns:** Assumed to have the same structure as `DetailsM` when used for upserting.

#### 7. `Grapes`
*   **Description:** Lookup sheet for grape varieties.
*   **Used in:** `ProductDetails.js` (reads data for form lookups).
*   **Columns (as inferred from `ProductDetails.js`):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B):** `Name HE`
    *   **Column 3 (C):** `Name EN`

#### 8. `Kashrut`
*   **Description:** Lookup sheet for Kashrut certifications.
*   **Used in:** `ProductDetails.js` (reads data for form lookups).
*   **Columns (as inferred from `ProductDetails.js`):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B):** `Name HE`
    *   **Column 3 (C):** `Name EN`
    *   **Column 4 (D):** `Type` (Inferred)

#### 9. `OrderLog`
*   **Description:** Tracks the processing status of orders.
*   **Used in:** `PackingSlipConsolidated.js` (updates packing slip status and print date), `UpdatePackingDisplay.js` (reads packing slip status and print date).
*   **Columns (as defined in `G.COLUMN_INDICES.ORDERLOG` in `Globals.js` and inferred from code):**
    *   **Column 1 (A):** `order_id`
    *   **Column 2 (B):** `order_date`
    *   **Column 3 (C):** `packing_print_date`
    *   **Column 4 (D):** `customer_note_doc_id`
    *   **Column 5 (E):** `export_date`
    *   **Column (varies):** `packing_slip_status` (Accessed by name in code, not by fixed index in `Globals.js` for `OrderLog`)

#### 10. `OrdersM`
*   **Description:** The master log of all web orders.
*   **Used in:** `PackingSlipConsolidated.js` (reads order details), `UpdatePackingDisplay.js` (reads order details for display).
*   **Columns (as inferred from `PackingSlipConsolidated.js` and `UpdatePackingDisplay.js`):**
    *   **Column (varies):** `order_id`
    *   **Column (varies):** `order_number`
    *   **Column (varies):** `order_date`
    *   **Column (varies):** `status`
    *   **Column (varies):** `customer_note`
    *   **Column (varies):** `shipping_first_name`
    *   **Column (varies):** `shipping_last_name`
    *   **Column (varies):** `shipping_address_1`
    *   **Column (varies):** `shipping_address_2`
    *   **Column (varies):** `shipping_city`
    *   **Column (varies):** `shipping_phone`

#### 11. `PackingQueue`
*   **Description:** A staging sheet holding order-level data for all orders eligible for packing slip generation.
*   **Used in:** `PackingSlipConsolidated.js` (reads order numbers), `UpdatePackingDisplay.js` (reads order numbers).
*   **Columns (as inferred from `PackingSlipConsolidated.js` and `UpdatePackingDisplay.js`):**
    *   **Column (varies):** `Order Number` (Accessed by `G.HEADERS.PACKING_QUEUE_ORDER_NUMBER`)

#### 12. `PackingRows`
*   **Description:** A staging sheet holding item-level data for all orders eligible for packing slip generation.
*   **Used in:** `PackingSlipConsolidated.js` (reads item details for packing slips).
*   **Columns (as inferred from `PackingSlipConsolidated.js`):**
    *   **Column (varies):** `Order Number`
    *   **Column (varies):** `SKU`
    *   **Column (varies):** `Quantity`

#### 13. `TaskQ`
*   **Description:** Logs all active exceptions and tasks.
*   **Used in:** `Inventory.js` (reads and updates task status), `ProductDetails.js` (reads and updates task status), `Sidebar.js` (gets task counts), `StockHealth.js` (reads and creates tasks).
*   **Columns (as defined in `G.COLUMN_INDICES.TASKQ` in `Globals.js` and used in code):**
    *   **Column 1 (A):** `Timestamp`
    *   **Column 2 (B):** `Session ID`
    *   **Column 3 (C):** `Type`
    *   **Column 4 (D):** `Source`
    *   **Column 5 (E):** `Details`
    *   **Column 6 (F):** `RelatedEntity` (often SKU)
    *   **Column 7 (G):** `Status`
    *   **Column 8 (H):** `Priority`
    *   **Column 9 (I):** `AssignedTo`
    *   **Column 10 (J):** `Start Date`
    *   **Column 11 (K):** `End Date`
    *   **Column 12 (L):** `Done Date`
    *   **Column 13 (M):** `Notes`

#### 14. `Texts`
*   **Description:** Various metadata and mapping sheets used for lookups and data enrichment.
*   **Used in:** `ProductDetails.js` (reads data for regions lookup).
*   **Columns (as inferred from `ProductDetails.js`):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B):** `Value HE`
    *   **Column 3 (C):** `Value EN`
    *   **Column 4 (D):** `Type` (Used to filter for 'Region')

#### 15. `Users`
*   **Description:** Defines all system users, their contact information, and specific permissions.
*   **Used in:** `Sidebar.js` (gets names), `WebApp.js` (gets names and Brurya access).
*   **Columns (as defined in `G.COLUMN_INDICES.USERS` in `Globals.js` and used in code):**
    *   **Column 2 (B):** `Name`
    *   **Column 6 (F):** `Brurya Access`
