# AI Session Setup

This session guides a focused AI assistant whose role is to implement requested edits, review logic, generate code or documentation, and follow provided instructions precisely. No enhancements or autonomous decisions will be made unless explicitly requested.

**Session Context**: This session includes access to a GitHub repository located at: https://github.com/jlmwines/my-gas-projects. The assistant is expected to use relevant scripts, documentation, and file relationships from this repository to inform tasks and logic reviews. All references to system structure, workflows, or scripts should be grounded in that repository unless otherwise specified.

**Instructions for AI**: Expect incoming information in multiple sections. Treat all input as part of one continuous session context.
Do not begin implementation until prompted with `BEGIN TASK`. Until then, confirm understanding and await further input.

## AI Prompt Enforcement
* Be brief. Answer questions succinctly.
* Stick to the structure and details here. Don’t rebuild features when asked for edits.
* Never assume logic; ask if a detail isn’t defined.
* Review plans before generating code.
* For minor edits, provide the updated code and some text for search to locate old code.
* Provide full scripts on request, or when changes are more than a single line or block of code.
* Present code/text cleanly in raw blocks (GitHub-friendly).
* Format all code with standard indentation (4 spaces per level).
* Ensure all code uses only standard ASCII whitespace (spaces, newlines). Proactively replace any non-standard or invisible characters.
* No emojis, styling, embellishments, or suggestions when coding.
* Never apologize; just fix or explain.
* Outputs must be testable, minimal, and never truncated.

---
# VinSync: Comax ERP & Web Catalog Synchronization Tool

VinSync is a comprehensive Google Apps Script-based tool designed to synchronize and audit product data between a Comax ERP system and a web-based catalog. It facilitates staged imports, identifies data mismatches through structured comparison logic, logs exceptions, and offers user-guided resolution and backup functionalities. The system leverages multiple Google Sheets, structured column indexing, modal dialogs, and a sidebar workflow interface.

## Project Goals
I. **Ensure Data Accuracy**: Maintain consistency and correctness of product data across all systems.
II. **Ensure Data Completeness**: Guarantee that all necessary product information is present in both the ERP and web catalog.
III. **Synchronize Sales Channels**: Align product data and order information between the Comax ERP and the web-based catalog to ensure consistent sales operations.
IV. **Maintain Operational Health**: Ensure the smooth and error-free operation of the data synchronization processes, including inventory management and exception handling.

## Workflow Rules & Conventions
* Sheet writes consistently use `setValues()`.
* Session IDs are formatted as `hhmmssSSS`.
* All comparisons involve trimming whitespace and normalizing casing for accuracy.
* Open TaskQ items remain persistent across multiple runs.
* DriveV2 is enabled for picker-based actions (though some picker UIs are legacy/unused).
* UI flows utilize `SpreadsheetApp.getUi()` and `HtmlService` sidebars.
* The sidebar auto-opens via an installable trigger and supports finalize/export stages.

## File & Sheet Organization

### Reference
The Reference Spreadsheet acts as the hub of the system, containing master files and various supporting sheets.

**Sheets**

* **TaskQ (Active Exception Log)**: Logs all active exceptions.
    * **Columns**: `Timestamp`, `Session ID`, `Type`, `Source`, `Details`, `RelatedEntity`, `Status`, `Priority`, `AssignedTo`, `StartDate`, `EndDate`, `DoneDate`, `Notes`.
    * **Task statuses**: `Open`, `Assigned`, `Review`, `Closed`.
* **WebM (Website Master Catalog)**: Master product data for the web catalog.
    * **Columns**: `ID`, `SKU`, `W Name`, `W Publ`, `W Stock`, `W Price`.
* **ComaxM (ERP Master Catalog)**: Master product data from the ERP.
    * **Columns**: `CMX ID`, `CMX SKU`, `CMX NAME`, `CMX DIV`, `CMX GROUP`, `CMX VENDOR`, `CMX BRAND`, `CMX COLOR`, `CMX SIZE`, `CMX DRY`, `CMX YEAR`, `CMX NEW`, `CMX ARCHIVE`, `CMX ACTIVE`, `CMX PRICE`, `CMX STOCK`, `CMX WEB`, `EXCLUDE`.
* **Audit**: Tracks product stock-taking and detail verification.
    * **Columns**: `ID` (from ComaxM), `SKU` (from ComaxM), `LastCount`, `ComaxQty`, `NewQty` (total submitted from Frontend), `BruryaQty` (location quantity submitted from Frontend), `StorageQty` (location quantity submitted from Frontend), `OfficeQty` (location quantity submitted from Frontend), `ShopQty` (location quantity submitted from Frontend).
* **OrdersM (Website Orders Master)**: Master log of web orders, mirroring the OrdersS structure.
    * **Columns**: `order_id`, `order_number`, `order_date`, `paid_date`, `status`, `Shipping_total`, `shipping_tax_total`, `fee_total`, `fee_tax_total`, `tax_total`, `cart_discount`, `order_discount`, `discount_total`, `order_total`, `order_subtotal`, `order_currency`, `payment_method`, `payment_method_title`, `transaction_id`, `customer_ip_address`, `customer_user_agent`, `shipping_method`, `customer_id`, `customer_user`, `customer_email`, `billing_first_name`, `billing_last_name`, `billing_company`, `billing_email`, `billing_phone`, `billing_address_1`, `billing_address_2`, `billing_postcode`, `billing_city`, `billing_state`, `billing_country`, `Shipping_first_name`, `shipping_last_name`, `shipping_company`, `shipping_phone`, `shipping_address_1`, `shipping_address_2`, `shipping_postcode`, `shipping_city`, `shipping_state`, `shipping_country`, `customer_note`, `Wt_import_key`, `shipping_items`, `fee_items`, `tax_items`, `coupon_items`, `refund_items`, `order_notes`, `download_permissions`, `meta:wt_pklist_order_language`, followed by details for up to 24 line items (e.g., `Product Item 1 Name`, `Product Item 1 id`, `Product Item 1 SKU`, `Product Item 1 Quantity`, `Product Item 1 Total`, `Product Item 1 Subtotal`).
    * **Web Order Statuses**: `pending`, `failed`, `on-hold`, `processing`, `completed`, `cancelled`, `refunded`, `draft`.
* **OrderLog**: Tracks order export and packing slip status.
    * **Columns**: `order_id`, `order_date`, `packing_slip_printed`, `print_date`, `comax_export_status`.
* **OnHoldInventory**: Staging for temporarily held inventory.
    * **Columns**: `SKU`, `OnHoldQuantity`.
* **PackingQueue**: Order-level packing list support.
    * **Columns**: `Order Number`, `Order Date`, `Customer Name`, `Phone`, `Email`, `Address`.
* **PackingRows**: Order-item level support combining order data with related extended product data.
    * **Columns**: `Order Number`, `Order Date`, `SKU`, `Quantity`, `Name EN`, `Name HE`, `Short`, `Intensity`, `Complexity`, `Acidity`, `Decant`, `Harmonize`, `Contrast`.
* **PackingText**: Used to display output to test packing slip logic and layout.
    * **Columns**: `Order Number`, `SKU`, `Product Description`.
* **Grapes (Grape Variety Metadata)**: Stores grape variety information.
    * **Columns**: `Key`, `Variety (English)`, `זן (Hebrew)`.
* **Kashrut (Kosher Certification Metadata)**: Stores kosher certification details.
    * **Columns**: `Type`, `Key`, `Kashrut (English)`, `כשרות (Hebrew)`.
* **Texts (Reusable Text Snippets)**: Contains reusable text in multiple languages.
    * **Columns**: `KEY`, `ENGLISH 01`, `HEBREW 01`, `NOTE`.
* **WeHe (English ↔ Hebrew Mapping)**: Maps English and Hebrew product details.
    * **Columns**: `wpml:original_product_sku`, `ID`, `post_title`, `wpml:original_product_id`.
* **Users (Task Assignment Directory)**: Defines user permissions and information.
    * **Columns**: `ID`, `Name`, `Email`, `Phone`, `Language`, `Brurya Access` (values 'Y' or 'N').
* **DetailsM (product detail master)**: Used to store details, often as keys used to lookup and replace text in description output.
    * **Columns**: `SKU`, `שם היין`, `NAME`, `קצר`, `Short`, `תיאור ארוך`, `Description`, `אזור`, `ABV`, `Intensity`, `Complexity`, `Acidity`, `Sweet Con`, `Intense Con`, `Rich Con`, `Mild Con`, `Sweet Har`, `Intense Har`, `Rich Har`, `Mild Har`, `Decant`, `היתר מכירה`, `K1`, `K2`, `K3`, `K4`, `K5`, `G1`, `G2`, `G3`, `G4`, `G5`.
* **DetailsC (calculated product details, lookups and formula-based text)**:
    * **Columns**: `SKU`, `תיאור`, `Description`, `Harmonize`, `Contrast`, `הרמוניה`, `קונטרסט`, `כשרות`, `Kashrut`, `ענבים`, `Grapes`, `תיאור קצר`, `Short Description`, `Comax Name`, `C Stock`, `Price`, `C Div.`, `C Group`, `C Year`, `C Size`, `HE ID`, `EN ID`.
* **DetailsO (product detail output, for use product detail updates and packing slips)**:
    * **Columns**: `SKU`, `תיאור`, `Description`, `Harmonize`, `Contrast`, `הרמוניה`, `קונטרסט`, `כשרות`, `Kashrut`, `ענבים`, `Grapes`, `תיאור קצר`, `Short Description`, `Comax Name`, `C Stock`, `Price`, `C Div.`, `C Group`, `C Year`, `C Size`, `HE ID`, `EN ID`.

### Backend
The Backend Spreadsheet contains staging sheets, scripts to process workflows, and the sidebar workflow user interface.

**Sheets**

* **WebS (Web Product Staging)**: Staging area for web product data.
    * **Columns**: `ID`, `SKU`, `W Name`, `W Publ`, `W Stock`, `W Price`.
* **ComaxS (ERP Product Staging)**: Staging area for ERP product data.
    * **Columns**: `CMX ID`, `CMX SKU`, `CMX NAME`, `CMX DIV`, `CMX GROUP`, `CMX VENDOR`, `CMX BRAND`, `CMX COLOR`, `CMX SIZE`, `CMX DRY`, `CMX YEAR`, `CMX NEW`, `CMX ARCHIVE`, `CMX ACTIVE`, `CMX PRICE`, `CMX STOCK`, `CMX WEB`, `EXCLUDE`.
* **OrdersS (Web Orders)**: Staging log for incoming web orders, with each order stored as a single row. `order_number` is the unique key, and `status` controls export to Comax and packing slip production.
    * **Columns**: `order_id`, `order_number`, `order_date`, `paid_date`, `status`, `Shipping_total`, `shipping_tax_total`, `fee_total`, `fee_tax_total`, `tax_total`, `cart_discount`, `order_discount`, `discount_total`, `order_total`, `order_subtotal`, `order_currency`, `payment_method`, `payment_method_title`, `transaction_id`, `customer_ip_address`, `customer_user_agent`, `shipping_method`, `customer_id`, `customer_user`, `customer_email`, `billing_first_name`, `billing_last_name`, `billing_company`, `billing_email`, `billing_phone`, `billing_address_1`, `billing_address_2`, `billing_postcode`, `billing_city`, `billing_state`, `billing_country`, `Shipping_first_name`, `shipping_last_name`, `shipping_company`, `shipping_phone`, `shipping_address_1`, `shipping_address_2`, `shipping_postcode`, `shipping_city`, `shipping_state`, `shipping_country`, `customer_note`, `Wt_import_key`, `shipping_items`, `fee_items`, `tax_items`, `coupon_items`, `refund_items`, `order_notes`, `download_permissions`, `meta:wt_pklist_order_language`, followed by details for up to 24 line items (e.g., `Product Item 1 Name`, `Product Item 1 id`, `Product Item 1 SKU`, `Product Item 1 Quantity`, `Product Item 1 Total`, `Product Item 1 Subtotal`).
* **Inventory Review Sheet Layout**: Populated with items from TaskQ that are in 'Review' status.
    * **Columns**: `Product Identification` (ID, Name, SKU), `Quantity Comparison` (ComaxQty, NewQty, BruryaQty, StorageQty, OfficeQty, ShopQty), `User Action` (Accept - editable, Notes - editable).
* **Config Sheet**: Handles system defaults.
    * **Columns**: `Settings`, `Value Notes`.

### Frontend
The Frontend Spreadsheet serves as the user-facing interface for managing inventory and exception tasks, designed to be mobile-friendly.

**Sheets**

* **Dashboard**: Used for user selection, displaying information, and potential future use as a command interface.
* **Inventory**: Entry sheet for bulk stock-taking, populated via a menu command.
    * **Columns**: `Name`, `ID`, `SKU`, `Stock`, `Difference`, `TotalQty`, `BruryaQty`, `StorageQty`, `OfficeQty`, `ShopQty`.
* **Brurya**: Specialized inventory interface for single warehouse location stock management.
    * **Columns**: `ID`, `Name`, `SKU`, `BruryaQty`.
    * **Behavior**: Always visible; all users can populate and edit quantities. Populated via menu command with items from the Audit sheet where BruryaQty > 0. onEdit trigger on quantity column flags session as active. UI uses warning-only protections for data entry. Edits activate `bruryaSessionActive` flag via `PropertiesService`.
* **Config**: A hidden sheet used for stable session state management, storing the currently selected user's name in cell A1.

## File & Function Reference
This section details the individual Google Apps Script files (.gs and .html) and their primary functions within the VinSync project, categorized by their operational environment: Backend or Frontend.

### Backend Scripts & UI
These scripts primarily run in the context of the Backend Spreadsheet, handling core synchronization, data processing, and administrative tasks.

**Core Settings & UI**
* `appsscript.json`: Declares project settings, scopes, and required APIs for the entire project.
* `Globals.gs`: Manages global configuration, including the LIVE/TEST environment switch and core file IDs, while operational parameters and thresholds are managed in the Config sheet.
* `Menu.gs`: Builds the VinSync custom menu in the Backend Spreadsheet, offering core actions, sidebar launcher, and workflow state reset options.
* `OpenSidebar.gs`: Programmatically opens the `Sidebar.html` UI.
* `Sidebar.html`: The user interface for the main workflow sidebar, featuring action buttons and status indicators.
* `State.gs`: Stores per-user workflow state flags and timestamps to manage progression through the synchronization process.
* `StateControl.gs`: Provides functions to reset the workflow state to specific completion points, callable from the main menu.

**Import & Data Staging**
* `ImportComaxProducts.gs`: Imports `comax.csv` data into the `ComaxS` staging sheet.
* `ImportWebOrders.gs`: Imports `orders.csv` data into the `OrdersS` staging sheet.
* `ImportWebProducts.gs`: Imports `web.csv` data into the `WebS` staging sheet, with data sorted during import.
* `Picker.html`: Legacy Drive picker UI, currently not in use.
* `FileUploadDialog.html`: Simple file upload dialog, currently unused.

**Comparison & Exception Logging**
* `Compare.gs`: Executes the structured comparison logic between staged and master data, identifying discrepancies.
* `TaskCreator.gs`: A user-guided script for generating prioritized inventory tasks based on 'Low Stock' and 'Periodic Review' rules, ensuring a balanced workload.
* `HandleExceptions.gs`: Manages the display and status updates of `TaskQ` items within the sidebar interface.
* `ProductUpdates.gs`: Applies staged product changes from `WebS` and `ComaxS` to the `WebM` and `ComaxM` reference sheets.

**Inventory Management**
* `Inventory.gs`: Manages the frontend inventory counting workflow, populating the user's sheet with assigned tasks from `TaskQ`, capturing new counts, and submitting them for review.
* `InventoryReview.gs`: Backend script responsible for processing accepted/rejected inventory counts submitted by users.

**Backup & Restore**
* `Backup.gs`: Manages the creation and rotation of 'Latest' and 'Previous' backup copies for both the Backend and Reference files.
* `Restore.gs`: Implements the logic for restoring data from backup sets, supporting 'Core' and 'Complete' restoration flows.
* `RestoreDialog.html`: The UI dialog used for configuring restore operations.

**Export & Finalization**
* `OrderProcessing.gs`: Aggregates new web orders, generates the Comax CSV for ERP import, and updates the `OrderLog`.
* `ExportInventory.gs`: Creates a CSV file detailing inventory mismatches identified by the system.
* `Finalize.gs`: Applies processed backend staging data to the `WebM` and `ComaxM` master files and updates the Audit data in the Reference Spreadsheet.
* `AuditLowProducts.gs`: A utility script (primarily for development aid) used to generate reports on low inventory products.

### Frontend Scripts & UI
These scripts are specifically designed to run within the user-facing Frontend Spreadsheet, managing the mobile-friendly interface and user interactions for inventory and task management.

* `appsscript.json`: (Shared) Declares project settings, scopes, and required APIs for the entire project, including Frontend-specific permissions.
* `OnOpen.gs`: An installable `onOpen` trigger that initializes the Frontend spreadsheet. It clears any previous user state, builds the custom "JLM Wines" menu, and populates the user dropdown on the Dashboard.
* `OnEdit.gs`: An `onEdit` trigger specifically for the Dashboard. It manages the active user session by detecting user selection in cell A2, writing the user's name to the hidden Config sheet, and querying the Users sheet (in the Reference Spreadsheet) to store the user's Brurya Access level in `PropertiesService`.
* `DashboardUI.gs`: Contains the `renderDashboardTasks` function, which updates informational task counts displayed on the Dashboard based on the active user.
* `BruryaWorkflow.gs`: Contains functions related to the Brurya Inventory Workflow:
    * `loadBruryaSheet()`: Populates the Brurya sheet with relevant inventory items from the Audit sheet (in the Reference Spreadsheet) where `BruryaQty` > 0.
    * `submitBruryaCounts()`: Processes the submission of Brurya inventory counts. This function calls `submitBruryaToAudit()` after verifying user authorization.
    * `submitBruryaToAudit()`: The core logic for submitting Brurya quantities. It performs a full replacement of `BruryaQty` values in the Audit sheet in the Reference Spreadsheet, clears the session state, and refreshes the Brurya sheet display.

## Core Workflows
### Primary Workflow: User Session Initialization (Frontend)
This is the main entry point for any user interacting with the spreadsheet.
1.  **onOpen**: The spreadsheet opens, clears any previous user state, and builds the custom "JLM Wines" menu. The user dropdown in cell A2 is populated.
2.  **User Selection**: The user selects their name from the dropdown in A2.
3.  **State Update (onEdit)**: An `onEdit` trigger detects the user selection and writes the user's name to the hidden Config sheet. It also queries the Users sheet in the Reference Spreadsheet to store the user's Brurya Access level in `PropertiesService`.
4.  **UI Rendering**: The `renderDashboardTasks` function is called to update the informational task counts on the Dashboard.

### Brurya Inventory Workflow (Frontend)
1.  **Navigation**: The user selects "JLM Wines" > "Brurya" > "Load Brurya Sheet" from the custom menu.
2.  **Counting & Data Entry**: The user adds or updates quantities for the items listed in the Brurya sheet.
3.  **Submission**: The user selects "JLM Wines" > "Brurya" > "Submit Brurya Counts" from the custom menu.
4.  **Processing**: The `submitBruryaToAudit` function first verifies the user has submission rights. If authorized, it performs a full replacement of the `BruryaQty` values in the Audit sheet (in the Reference Spreadsheet), clears the session state, and refreshes the Brurya sheet.

### Backup & Restore Process (Backend)
* **Backup**: Manages two backup sets: 'Latest' and 'Previous'. Each backup action creates a new 'Latest' set (containing full copies of both the Backend and Reference files), rotates the old 'Latest' to 'Previous', and deletes the old 'Previous'. A daily backup is the required first step in the sidebar workflow.
* **Restore**: Initiated from a custom dialog (not a file picker). The user can choose to restore from the 'Latest' or 'Previous' version using one of two profiles:
    * **Core Restore**: A surgical sync that updates specific, interdependent sheets across both the live Backend and Reference files.
    * **Complete Restore**: Replaces all sheets in both live files without changing the parent file IDs.
* **Configuration**: The entire process is governed by a `CONFIG` object and an `IS_TEST_ENVIRONMENT` switch in `Globals.gs`.

## Product Validation Test Matrix
### Web Comparison (A)
* **A1 (II)** – Staging ID missing from WebM.
* **A2 (II)** – WebM ID missing from staging.
* **A3 (I)** – SKU mismatch by ID.
* **A4 (I)** – Name mismatch by ID.
* **A5 (III)** – Publish status mismatch.

### Comax Comparison (C)
Applied only to “Sell Online” SKUs.
* **C1 (II)** – SKU in ComaxM but missing from ComaxS.
* **C2 (I)** – ID mismatch.
* **C3 (I)** – Name mismatch.
* **C4 (I)** – Group mismatch.
* **C5 (I)** – Size mismatch.
* **C6 (I)** – Vintage mismatch.

### Data Audits (D)
* **D1 (I)** – EXCLUDE flag illogically set.
* **D2 (IV)** – Negative inventory.
* **D3 (IV)** – Archived with stock (critical alert if also online).

### Cross-File Checks (E)
* **E1 (II)** – New online SKU not found in Web.
* **E2 (II)** – Web SKU not found in Comax.
* **E3 (III)** – Published SKU on Web but offline in Comax.
