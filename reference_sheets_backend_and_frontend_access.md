## Reference Sheets and Column Descriptions (Accessed by Frontend and Backend Scripts)

This document details the Google Sheets residing in the central Reference Spreadsheet that are accessed by both the `frontend-scripts` and `backend-scripts` codebases. Column definitions are based on their usage within these scripts.

### I. Reference Sheets Accessed by Frontend and Backend Scripts

#### 1. `Audit`
*   **Description:** Tracks product stock-taking and detail verification from the Frontend.
*   **Used in:** `Brurya.js`, `Inventory.js`, `Finalize.js`, `TaskCreator.js`.
*   **Columns (as defined in `G.COLUMN_INDICES.AUDIT` in `Globals.js` and used in code):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B):** `SKU`
    *   **Column 3 (C):** `LastCount`
    *   **Column 4 (D):** `ComaxQty`
    *   **Column 5 (E):** `NewQty`
    *   **Column 6 (F):** `BruryaQty`
    *   **Column 7 (G):** `StorageQty`
    *   **Column 8 (H):** `OfficeQty`
    *   **Column 9 (I):** `ShopQty`
    *   **Column 10 (J):** `LastDetailUpdate`
    *   **Column 11 (K):** `LastDetailAudit`

#### 2. `ComaxM`
*   **Description:** Master product data from the ERP.
*   **Used in:** `Brurya.js`, `ComaxSync.js`, `Inventory.js`, `ProductDetails.js`, `StockHealth.js`, `AuditLowProducts.js`, `Compare.js`, `DetailsReview.js`, `ExportInventory.js`, `Finalize.js`, `InventoryReview.js`, `TaskCreator.js`.
*   **Columns (as inferred from various script usages):**
    *   **Column 1 (A):** `CMX ID`
    *   **Column 2 (B)::** `CMX SKU`
    *   **Column 3 (C):** `CMX NAME`
    *   **Column 4 (D):** `CMX DIV`
    *   **Column 5 (E):** `CMX GROUP`
    *   **Column 6 (F):** `CMX VENDOR`
    *   **Column 7 (G):** `CMX BRAND`
    *   **Column 8 (H):** `CMX COLOR`
    *   **Column 9 (I):** `CMX SIZE`
    *   **Column 10 (J):** `CMX DRY`
    *   **Column 11 (K):** `CMX YEAR`
    *   **Column 12 (L)::** `CMX NEW`
    *   **Column 13 (M):** `CMX ARCHIVE`
    *   **Column 14 (N):** `CMX ACTIVE`
    *   **Column 15 (O):** `CMX PRICE`
    *   **Column 16 (P):** `CMX STOCK`
    *   **Column 17 (Q):** `CMX WEB`
    *   **Column 18 (R):** `EXCLUDE`

#### 3. `Config` (Reference Spreadsheet's Config sheet)
*   **Description:** Contains system-wide configuration settings and values.
*   **Used in:** `Globals.js`, `StockHealth.js`, `Housekeeping.js`, `PackingSlipData.js`.
*   **Columns (as defined in `G.COLUMN_INDICES.REFERENCE_CONFIG` in `Globals.js` and inferred from `StockHealth.js` and `Housekeeping.js`):**
    *   **Column 1 (A):** `Setting`
    *   **Column 2 (B)::** `Value`
    *   **Column 3 (C):** `Notes`
    *   **Column 4 (D):** `Category` (Inferred from `StockHealth.js` for `MinCat` rules)
    *   **Column 5 (E):** `Required Count` (Inferred from `StockHealth.js` for `MinCat` rules)

#### 4. `DetailsC`
*   **Description:** Contains calculated or derived product details.
*   **Used in:** `PackingSlipConsolidated.js`, `DetailsReview.js`, `PackingSlipData.js`, `PackingSlipProcessor.js`.
*   **Columns (as inferred from `PackingSlipConsolidated.js` and `DetailsReview.js`):**
    *   **Column 1 (A):** `SKU`
    *   **Column 2 (B)::** `Description HE` (תיאור)
    *   **Column 3 (C):** `Description EN` (Description)
    *   **Column 4 (D):** `Harmonize EN`
    *   **Column 5 (E):** `Contrast EN`
    *   **Column 6 (F)::** `Harmonize HE`
    *   **Column 7 (G):** `Contrast HE`
    *   **Column 8 (H):** `Kashrut` (כשרות)
    *   **Column 9 (I):** `Grapes` (ענבים)
    *   **Column 10 (J):** `Short Description HE` (תיאור קצר)
    *   **Column 11 (K):** `Short Description EN` (Short Description)
    *   **Column 12 (L)::** `Comax Name`
    *   **Column 13 (M):** `C Stock`
    *   **Column 14 (N):** `Price`
    *   **Column 15 (O):** `C Div.`
    *   **Column 16 (P):** `C Group`
    *   **Column 17 (Q):** `C Year`
    *   **Column 18 (R):** `C Size`
    *   **Column 19 (S):** `HE ID`
    *   **Column 20 (T):** `EN ID`

#### 5. `DetailsM`
*   **Description:** The master sheet for granular product details.
*   **Used in:** `PackingSlipConsolidated.js`, `ProductDetails.js`, `DetailsReview.js`, `PackingSlipData.js`, `PackingSlipProcessor.js`.
*   **Columns (as defined in `G.COLUMN_INDICES.DETAILS_M` in `Globals.js` and used in code):**
    *   **Column 1 (A):** `SKU`
    *   **Column 2 (B)::** `NAME_HE` (שם היין)
    *   **Column 3 (C):** `NAME_EN` (NAME)
    *   **Column 4 (D):** `SHORT_HE` (קצר)
    *   **Column 5 (E):** `SHORT_EN` (Short)
    *   **Column 6 (F)::** `DESC_HE` (תיאור ארוך)
    *   **Column 7 (G):** `DESC_EN` (Description)
    *   **Column 8 (H):** `REGION` (אזור)
    *   **Column 9 (I):** `ABV`
    *   **Column 10 (J):** `INTENSITY`
    *   **Column 11 (K)::** `COMPLEXITY`
    *   **Column 12 (L)::** `ACIDITY`
    *   **Column 13 (M):** `SWEET_CON`
    *   **Column 14 (N):** `INTENSE_CON`
    *   **Column 15 (O):** `RICH_CON`
    *   **Column 16 (P):** `MILD_CON`
    *   **Column 17 (Q):** `SWEET_HAR`
    *   **Column 18 (R)::** `INTENSE_HAR`
    *   **Column 19 (S):** `RICH_HAR`
    *   **Column 20 (T):** `MILD_HAR`
    *   **Column 21 (U):** `DECANT`
    *   **Column 22 (V):):** `PERMIT` (היתר מכירה)
    *   **Column 23 (W):** `K1`
    *   **Column 24 (X):** `K2`
    *   **Column 25 (Y):** `K3`
    *   **Column 26 (Z):** `K4`
    *   **Column 27 (AA):** `K5`
    *   **Column 28 (AB)::** `G1`
    *   **Column 29 (AC):** `G2`
    *   **Column 30 (AD):** `G3`
    *   **Column 31 (AE):** `G4`
    *   **Column 32 (AF):** `G5`

#### 6. `DetailsS`
*   **Description:** A staging sheet for product detail output, used for updates and packing slips.
*   **Used in:** `ProductDetails.js`, `DetailsReview.js`.
*   **Columns:** Assumed to have the same structure as `DetailsM` when used for upserting.

#### 7. `Grapes`
*   **Description:** Lookup sheet for grape varieties.
*   **Used in:** `ProductDetails.js`, `DetailsReview.js`.
*   **Columns (as inferred from `ProductDetails.js` and `DetailsReview.js`):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B)::** `Name HE`
    *   **Column 3 (C):** `Name EN`

#### 8. `Kashrut`
*   **Description:** Lookup sheet for Kashrut certifications.
*   **Used in:** `ProductDetails.js`, `DetailsReview.js`.
*   **Columns (as inferred from `ProductDetails.js` and `DetailsReview.js`):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B)::** `Key/Identifier`
    *   **Column 3 (C):** `Name EN`
    *   **Column 4 (D)::** `Name HE`

#### 9. `OnHoldInventory`
*   **Description:** A summary of inventory for items in orders that are currently on-hold.
*   **Used in:** `ExportInventory.js`, `Finalize.js`.
*   **Columns (as inferred from `ExportInventory.js`):**
    *   **Column 1 (A):** `SKU`
    *   **Column 2 (B)::** `OnHoldQuantity`

#### 10. `OrderLog`
*   **Description:** Tracks the processing status of orders.
*   **Used in:** `PackingSlipConsolidated.js`, `UpdatePackingDisplay.js`, `Housekeeping.js`, `OrderProcessing.js`, `PackingSlipData.js`, `PackingSlipProcessor.js`.
*   **Columns:**
    *   **Column 1 (A):** `order_id`
    *   **Column 2 (B)::** `order_date`
    *   **Column 3 (C):** `packing_slip_status`
    *   **Column 4 (D)::** `packing_print_date`
    *   **Column 5 (E):** `comax_export_status`
    *   **Column 6 (F)::** `customer_note_doc_id`

#### 11. `OrderLogArchive`
*   **Description:** Archives old records from the OrderLog.
*   **Used in:** `Housekeeping.js`, `PackingSlipData.js`.
*   **Columns:** Same columns as `OrderLog`.

#### 12. `OrdersM`
*   **Description:** The master log of all web orders.
*   **Used in:** `PackingSlipConsolidated.js`, `UpdatePackingDisplay.js`, `OrderProcessing.js`, `PackingSlipData.js`, `PackingSlipProcessor.js`, `Restore.js`.
*   **Columns (as inferred from various script usages):**
    *   **Column 1 (A):** `order_id`
    *   **Column 2 (B)::** `order_number`
    *   **Column 3 (C):** `order_date`
    *   **Column 4 (D)::** `paid_date`
    *   **Column 5 (E):** `status`
    *   **Column 6 (F)::** `Shipping_total`
    *   **Column 7 (G):** `shipping_tax_total`
    *   **Column 8 (H)::** `fee_total`
    *   **Column 9 (I):** `fee_tax_total`
    *   **Column 10 (J)::** `tax_total`
    *   **Column 11 (K)::** `cart_discount`
    *   **Column 12 (L)::** `order_discount`
    *   **Column 13 (M)::** `discount_total`
    *   **Column 14 (N)::** `order_total`
    *   **Column 15 (O)::** `order_subtotal`
    *   **Column 16 (P)::** `order_currency`
    *   **Column 17 (Q)::** `payment_method`
    *   **Column 18 (R)::** `payment_method_title`
    *   **Column 19 (S)::** `transaction_id`
    *   **Column 20 (T)::** `customer_ip_address`
    *   **Column 21 (U)::** `customer_user_agent`
    *   **Column 22 (V)::** `shipping_method`
    *   **Column 23 (W)::** `customer_id`
    *   **Column 24 (X)::** `customer_user`
    *   **Column 25 (Y)::** `customer_email`
    *   **Column 26 (Z)::** `billing_first_name`
    *   **Column 27 (AA)::** `billing_last_name`
    *   **Column 28 (AB)::** `billing_company`
    *   **Column 29 (AC):** `billing_email`
    *   **Column 30 (AD)::** `billing_phone`
    *   **Column 31 (AE)::** `billing_address_1`
    *   **Column 32 (AF)::** `billing_address_2`
    *   **Column 33 (AG)::** `billing_postcode`
    *   **Column 34 (AH)::** `billing_city`
    *   **Column 35 (AI)::** `billing_state`
    *   **Column 36 (AJ)::** `billing_country`
    *   **Column 37 (AK)::** `Shipping_first_name`
    *   **Column 38 (AL)::** `shipping_last_name`
    *   **Column 39 (AM)::** `shipping_company`
    *   **Column 40 (AN)::** `shipping_phone`
    *   **Column 41 (AO)::** `shipping_address_1`
    *   **Column 42 (AP)::** `shipping_address_2`
    *   **Column 43 (AQ)::** `shipping_postcode`
    *   **Column 44 (AR)::** `shipping_city`
    *   **Column 45 (AS)::** `shipping_state`
    *   **Column 46 (AT)::** `shipping_country`
    *   **Column 47 (AU)::** `customer_note`
    *   **Column 48 (AV)::** `Wt_import_key`
    *   **Column 49 (AW)::** `shipping_items`
    *   **Column 50 (AX)::** `fee_items`
    *   **Column 51 (AY)::** `tax_items`
    *   **Column 52 (AZ)::** `coupon_items`
    *   **Column 53 (BA)::** `Product Item 1 SKU`
    *   **Column 54 (BB)::** `Product Item 1 Quantity`
    *   **Column 55 (BC)::** `Product Item 2 SKU`
    *   **Column 56 (BD)::** `Product Item 2 Quantity`
    *   **Column 57 (BE)::** `Product Item 3 SKU`
    *   **Column 58 (BF)::** `Product Item 3 Quantity`
    *   **Column 59 (BG)::** `Product Item 4 SKU`
    *   **Column 60 (BH)::** `Product Item 4 Quantity`
    *   **Column 61 (BI)::** `Product Item 5 SKU`
    *   **Column 62 (BJ)::** `Product Item 5 Quantity`
    *   **Column 63 (BK)::** `Product Item 6 SKU`
    *   **Column 64 (BL)::** `Product Item 6 Quantity`
    *   **Column 65 (BM)::** `Product Item 7 SKU`
    *   **Column 66 (BN)::** `Product Item 7 Quantity`
    *   **Column 67 (BO)::** `Product Item 8 SKU`
    *   **Column 68 (BP)::** `Product Item 8 Quantity`
    *   **Column 69 (BQ)::** `Product Item 9 SKU`
    *   **Column 70 (BR)::** `Product Item 9 Quantity`
    *   **Column 71 (BS)::** `Product Item 10 SKU`
    *   **Column 72 (BT)::** `Product Item 10 Quantity`
    *   **Column 73 (BU)::** `Product Item 11 SKU`
    *   **Column 74 (BV)::** `Product Item 11 Quantity`
    *   **Column 75 (BW)::** `Product Item 12 SKU`
    *   **Column 76 (BX)::** `Product Item 12 Quantity`
    *   **Column 77 (BY)::** `Product Item 13 SKU`
    *   **Column 78 (BZ)::** `Product Item 13 Quantity`
    *   **Column 79 (CA)::** `Product Item 14 SKU`
    *   **Column 80 (CB)::** `Product Item 14 Quantity`
    *   **Column 81 (CC)::** `Product Item 15 SKU`
    *   **Column 82 (CD)::** `Product Item 15 Quantity`
    *   **Column 83 (CE)::** `Product Item 16 SKU`
    *   **Column 84 (CF)::** `Product Item 16 Quantity`
    *   **Column 85 (CG)::** `Product Item 17 SKU`
    *   **Column 86 (CH)::** `Product Item 17 Quantity`
    *   **Column 87 (CI)::** `Product Item 18 SKU`
    *   **Column 88 (CJ)::** `Product Item 18 Quantity`
    *   **Column 89 (CK)::** `Product Item 19 SKU`
    *   **Column 90 (CL)::** `Product Item 19 Quantity`
    *   **Column 91 (CM)::** `Product Item 20 SKU`
    *   **Column 92 (CN)::** `Product Item 20 Quantity`
    *   **Column 93 (CO)::** `Product Item 21 SKU`
    *   **Column 94 (CP)::** `Product Item 21 Quantity`
    *   **Column 95 (CQ)::** `Product Item 22 SKU`
    *   **Column 96 (CR)::** `Product Item 22 Quantity`
    *   **Column 97 (CS)::** `Product Item 23 SKU`
    *   **Column 98 (CT)::** `Product Item 23 Quantity`
    *   **Column 99 (CU)::** `Product Item 24 SKU`
    *   **Column 100 (CV)::** `Product Item 24 Quantity`

#### 13. `PackingQueue`
*   **Description:** A staging sheet holding order-level data for all orders eligible for packing slip generation.
*   **Used in:** `PackingSlipConsolidated.js`, `UpdatePackingDisplay.js`, `PackingSlipData.js`, `PackingSlipProcessor.js`, `psTest.js`.
*   **Columns (as inferred from `PackingSlipData.js`):**
    *   **Column 1 (A):** `Order Number`
    *   **Column 2 (B)::** `Order Date`
    *   **Column 3 (C):** `Customer Name`
    *   **Column 4 (D)::** `Phone`
    *   **Column 5 (E):** `Email`
    *   **Column 6 (F)::** `Address`
    *   **Column 7 (G):** `Customer Note`
    *   **Column 8 (H)::** `order_id`

#### 14. `PackingRows`
*   **Description:** A staging sheet holding item-level data for all orders eligible for packing slip generation.
*   **Used in:** `PackingSlipConsolidated.js`, `PackingSlipData.js`, `PackingSlipProcessor.js`, `PackingTexts.js`, `psTest.js`.
*   **Columns (as inferred from `PackingSlipData.js`):**
    *   **Column 1 (A):** `Order Number`
    *   **Column 2 (B)::** `Order Date`
    *   **Column 3 (C):** `SKU`
    *   **Column 4 (D)::** `Quantity`
    *   **Column 5 (E):** `Name EN`
    *   **Column 6 (F)::** `Short EN`
    *   **Column 7 (G):** `Intensity`
    *   **Column 8 (H)::** `Complexity`
    *   **Column 9 (I):** `Acidity`
    *   **Column 10 (J)::** `Decant`
    *   **Column 11 (K)::** `Harmonize EN`
    *   **Column 12 (L)::** `Contrast EN`
    *   **Column 13 (M)::** `Name HE`
    *   **Column 14 (N)::** `Short HE`
    *   **Column 15 (O)::** `Harmonize HE`
    *   **Column 16 (P)::** `Contrast HE`

#### 15. `PackingText`
*   **Description:** Stores formatted product descriptions for packing slips.
*   **Used in:** `PackingTexts.js`.
*   **Columns (as inferred from `PackingTexts.js`):**
    *   **Column 1 (A):** `Order Number`
    *   **Column 2 (B)::** `SKU`
    *   **Column 3 (C):** `Product Description`

#### 16. `Products`
*   **Description:** A master sheet for product data.
*   **Used in:** `ProductUpdates.js`.
*   **Columns (as inferred from `ProductUpdates.js`):**
    *   **Column 21 (U):** `PRODUCTS_ORPHAN_NOTE_COL` (Orphan Note)
    *   *(Other product data columns are inferred but not explicitly defined in reviewed backend scripts.)*

#### 17. `TaskAssignments`
*   **Description:** Defines rules for automatic task assignment.
*   **Used in:** `AdminWorkflow.js`, `Compare.js`.
*   **Columns (as inferred from `AdminWorkflow.js` and `Compare.js`):**
    *   **Column 1 (A):** `TaskType`
    *   **Column 2 (B)::** `AssignTo` (User ID)
    *   **Column 3 (C):** `Priority`
    *   **Column 4 (D)::** `Notes` (Display Label)

#### 18. `TaskQ`
*   **Description:** Logs all active exceptions and tasks.
*   **Used in:** `Brurya.js`, `Inventory.js`, `ProductDetails.js`, `StockHealth.js`, `AdminWorkflow.js`, `Compare.js`, `DetailsReview.js`, `HandleExceptions.js`, `InventoryReview.js`, `TaskCreator.js`, `Restore.js`.
*   **Columns (as defined in `G.COLUMN_INDICES.TASKQ` in `Globals.js` and used in code):**
    *   **Column 1 (A):** `Timestamp`
    *   **Column 2 (B)::** `Session ID`
    *   **Column 3 (C):** `Type`
    *   **Column 4 (D)::** `Source`
    *   **Column 5 (E):** `Details`
    *   **Column 6 (F)::** `RelatedEntity` (often SKU)
    *   **Column 7 (G)::** `Status`
    *   **Column 8 (H)::** `Priority`
    *   **Column 9 (I):** `AssignedTo`
    *   **Column 10 (J)::** `Start Date`
    *   **Column 11 (K)::** `End Date`
    *   **Column 12 (L)::** `Done Date`
    *   **Column 13 (M)::** `Notes`

#### 19. `Texts`
*   **Description:** Various metadata and mapping sheets used for lookups and data enrichment.
*   **Used in:** `ProductDetails.js`, `DetailsReview.js`.
*   **Columns (as inferred from `ProductDetails.js` and `DetailsReview.js`):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B)::** `Value EN`
    *   **Column 3 (C):** `Value HE`
    *   **Column 4 (D)::** `Type` (Used to filter for 'Region')

#### 20. `Users`
*   **Description:** Defines all system users, their contact information, and specific permissions.
*   **Used in:** `Sidebar.js`, `WebApp.js`, `AdminWorkflow.js`, `Compare.js`, `HandleExceptions.js`, `TaskCreator.js`.
*   **Columns (as defined in `G.COLUMN_INDICES.USERS` in `Globals.js` and used in code):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B)::** `Name`
    *   **Column 3 (C):** `Email`
    *   **Column 4 (D)::** `Phone`
    *   **Column 5 (E)::** `Language`
    *   **Column 6 (F)::** `Brurya Access`

#### 21. `WebM`
*   **Description:** Master product data for the web catalog.
*   **Used in:** `PackingSlipConsolidated.js`, `Compare.js`, `ExportInventory.js`, `Restore.js`.
*   **Columns (as inferred from `Compare.js` and `ExportInventory.js`):**
    *   **Column 1 (A):** `ID`
    *   **Column 2 (B)::** `SKU`
    *   **Column 3 (C):** `W Name`
    *   **Column 4 (D)::** `W Publ`
    *   **Column 5 (E)::** `W Stock`
    *   **Column 6 (F)::** `W Price`

#### 22. `WeHe`
*   **Description:** Contains WPML (WordPress Multilingual Plugin) related product ID mappings.
*   **Used in:** `DetailsReview.js`.
*   **Columns (as inferred from `DetailsReview.js` and user clarification):**
    *   **Column 1 (A):** `wpml:original_product_sku`
    *   **Column 2 (B)::** `ID`
    *   **Column 3 (C):** `post_title`
    *   **Column 4 (D)::** `wpml:original_product_id`