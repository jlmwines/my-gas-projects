## Frontend Sheets and Column Descriptions (Residing in the Active Frontend Spreadsheet)

This document details the Google Sheets and their columns that are part of the active Frontend Google Spreadsheet, as accessed and managed directly by the `frontend-scripts` codebase.

### I. Frontend-Specific Sheets (within the active spreadsheet)

These sheets are typically part of the user's active spreadsheet and are managed directly by the frontend scripts.

#### 1. `Brurya`
*   **Description:** A specialized interface for counting inventory at a single location.
*   **Used in:** `Brurya.js` (primary management), `Utilities.js` (onEdit routing).
*   **Columns (as used in `Brurya.js`):**
    *   **Column 1 (A):** `ID` (Product ID, written by script)
    *   **Column 2 (B):** `Name` (Product Name, written by script)
    *   **Column 3 (C):** `SKU` (User input, triggers lookup)
    *   **Column 4 (D):** `BruryaQty` (Quantity, user input)

#### 2. `ComaxSyncDisplay`
*   **Description:** A sheet used to display filtered Comax data.
*   **Used in:** `ComaxSync.js`.
*   **Columns (as hardcoded in `ComaxSync.js`):**
    *   **Column 1 (A):** `Name`
    *   **Column 2 (B):** `SKU`

#### 3. `Config`
*   **Description:** A hidden sheet for managing the active user's session state within the frontend spreadsheet.
*   **Used in:** `Globals.js` (defined in `G.SHEET_NAMES`).
*   **Columns:** (No explicit column definitions found in code, likely simple key-value pairs)

#### 4. `Home`
*   **Description:** The primary landing page sheet for the frontend user interface. `Dashboard.html` creates a sidebar that serves as the main UI for this sheet.
*   **Used in:** `Utilities.js` (activated on open), `WebApp.js` (activated by `activateHomeSheet`).
*   **Columns:** (No explicit column definitions found in code)

#### 5. `Inventory`
*   **Description:** The main sheet for users to perform assigned stock-taking tasks.
*   **Used in:** `Inventory.js` (populates and processes), `Sidebar.js` (writes data, applies formulas, manages protection).
*   **Columns (as defined in `G.INV_COL` in `Globals.js` and used in `Sidebar.js`):**
    *   **Column 1 (A):** `Name`
    *   **Column 2 (B):** `ID`
    *   **Column 3 (C):** `SKU`
    *   **Column 4 (D):** `Stock` (Comax Stock)
    *   **Column 5 (E):** `Difference` (Calculated: `TotalQty` - `Stock`)
    *   **Column 6 (F):** `TotalQty` (Calculated: Sum of location quantities)
    *   **Column 7 (G):** `BruryaQty`
    *   **Column 8 (H):** `StorageQty`
    *   **Column 9 (I):** `OfficeQty`
    *   **Column 10 (J):** `ShopQty`

#### 6. `NewProducts`
*   **Description:** A sheet used to display eligible products for suggestion (e.g., for "MinCat" rules).
*   **Used in:** `StockHealth.js` (populates and reads from).
*   **Columns (as hardcoded in `StockHealth.js`):**
    *   **Column 1 (A):** `Suggest` (Checkbox)
    *   **Column 2 (B):** `SKU`
    *   **Column 3 (C):** `Category`
    *   **Column 4 (D):** `Name`
    *   **Column 5 (E):** `Price`
    *   **Column 6 (F):** `Stock`

#### 7. `PackingDisplay`
*   **Description:** A sheet where orders eligible for packing slip generation are displayed for user selection.
*   **Used in:** `UpdatePackingDisplay.js` (writes data, applies checkboxes).
*   **Columns (as hardcoded in `UpdatePackingDisplay.js`):**
    *   **Column 1 (A):** `Select` (Checkbox)
    *   **Column 2 (B):** `Order Date`
    *   **Column 3 (C):** `Order Number`
    *   **Column 4 (D):** `Status`
    *   **Column 5 (E):** `Packing Slip`
    *   **Column 6 (F):** `Print Date`
    *   **Column 7 (G):** `Customer Name`
    *   **Column 8 (H):** `Customer Note`

#### 8. `ProductDetails`
*   **Description:** A sheet used to display product detail tasks for editing.
*   **Used in:** `ProductDetails.js` (populates and reads from).
*   **Columns (as hardcoded in `ProductDetails.js`):**
    *   **Column 1 (A):** `SKU`
    *   **Column 2 (B):** `Details`
