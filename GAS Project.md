This session guides a focused AI assistant whose role is to implement requested edits, review logic, generate code or documentation, and follow provided instructions precisely. No enhancements or autonomous decisions will be made unless explicitly requested.
Instructions for AI: Expect incoming information in multiple sections. Treat all input as part of one continuous session context.
Do not begin implementation until prompted with my prompt with text “BEGIN TASK” (not your interpretation of any other prompt). Until then, confirm understanding and await further input.

AI Prompt Enforcement  
Be brief. Answer questions succinctly.  
Stick to the structure and details here. Don’t rebuild features when asked for edits.  
Never assume logic; ask if a detail isn’t defined.  
Review plans before generating code.  NEVER GENERATE CODE WITHOUT A REQUEST!
For minor edits, provide the updated code and some text for search to locate old code.  
Provide full scripts on request, or when changes are more than a single line or block of code.  
Present code/text cleanly in raw blocks (GitHub-friendly).
Format all code with standard indentation (4 spaces per level).
Ensure all code uses only standard ASCII whitespace (spaces, newlines). Proactively replace any non-standard or invisible characters.  
No emojis, styling, embellishments, or suggestions when coding.
Never apologize; just fix or explain.  
Outputs must be testable, minimal, and never truncated.



Project Overview
This is a comprehensive Google Apps Script-based system designed to synchronize, audit, and manage product and order data between a Comax ERP system and a web-based sales catalog. The system is composed of three primary Google Sheet environments: a central Reference spreadsheet that acts as the master database, a Backend spreadsheet for administrative data processing, and a user-facing Frontend spreadsheet for remote tasks. To allow multiple users to securely interact with protected master data, the Frontend is built on a Web App architecture, where all data operations are routed through a central script that executes with the project owner's permissions.


Core Workflows
Backend Workflow (Admin-Driven): The backend workflow is a sequential, user-driven process managed via a custom sidebar in the Backend spreadsheet. The admin must complete each step to unlock the next.
Backup: The admin initiates a full backup of the Reference and Backend spreadsheets.
Process Orders & Products (Sub-flows): The admin uses the sidebar to run a series of import and merge tasks. This brings new order and product data from CSV files into staging sheets (OrdersS, ComaxS) and then merges it into the master sheets (OrdersM, ComaxM). New orders are also added to the OrderLog.
Review Data: The admin runs an automated comparison script. This script analyzes all staged and master data, identifies discrepancies, and automatically creates tasks for each issue in the TaskQ.
Handle Exceptions: The admin uses the "Exceptions" view in the sidebar to manually resolve all tasks in the TaskQ by assigning, annotating, and closing them.
Finalize: Once the data is clean, the admin runs the "Finalize" process, which applies all approved changes from the staging sheets to the master data files.
Inventory & Export: The admin can create inventory tasks for Frontend users and, as a final step, export aggregated inventory adjustment data. The workflow is then reset for the next batch.
Frontend Workflow (User-Driven): The frontend workflow provides a focused toolkit for remote users, accessed via a custom menu.
User Session Initialization: A user opens the sheet, and a dropdown is populated with user names via a Web App call. The user must select their name. This onEdit trigger calls the Web App to fetch their specific permissions (e.g., bruryaAccess) and stores them for the session.
Inventory Counting: General Inventory: A user loads their assigned stock-taking tasks onto the Inventory sheet. After entering counts, they submit the data, which marks the tasks as "Review" for an admin to approve in the Backend. Brurya Inventory: A streamlined process where a user can add a new item by typing a SKU in Column C, which triggers an onEdit event that calls the Web App to auto-populate the item's ID and Name. They enter quantities and submit. The server then compares the submitted data to the master Audit data to identify and save all changes.
Packing Slip Generation: A user refreshes a list to see all orders ready for packing. They use checkboxes to select orders and then trigger a "Generate Docs" function, which securely calls the Web App to create a single, consolidated Google Doc containing all the selected packing slips.


Key Architectural Patterns
Web App Security Model: The Frontend project uses a "headless" Web App to manage permissions. Client-side functions triggered by menus or edits do not access the protected Reference file directly. Instead, they make a UrlFetchApp call to the project's own deployed Web App URL. A central doPost(e) function in WebApp.gs acts as a router, running with the project owner's permissions. It calls the appropriate server-side worker function (_server_...), which contains the protected logic. Because the worker is called by doPost, it inherits the owner's permissions, allowing it to securely read from and write to the Reference file on behalf of the user.
Data Staging: Raw data is first imported into staging sheets (e.g., OrdersS, ComaxS) in the Backend. It is only merged into the master sheets (OrdersM, ComaxM) in the Reference file after processing and review.
State Management: The Backend workflow state is tracked via flags in a State.gs script, allowing the sidebar UI to show progress and enable/disable steps sequentially. The Frontend user's session state (e.g., their identity and specific permissions) is managed via the hidden Config sheet and PropertiesService.
System Reference & Organization
Core Components: The Reference Spreadsheet: The central database and "single source of truth." It contains all master data files, logs, and configuration sheets. The Backend Spreadsheet: The administrative control panel. It contains staging sheets for imported data and a sidebar UI for the admin workflow. The Frontend Spreadsheet: The interface for remote users. It provides a simplified, task-oriented UI for inventory counting and packing slip generation.

Here is the breakdown of files and their key functions, organized by environment and workflow.
Backend Scripts & Functions
This environment handles the primary data processing, synchronization, and administrative tasks, managed via a sidebar UI.
Core & UI
Globals.gs: Manages global configuration, file IDs, and environment settings.
Menu.gs: Creates the custom admin menu and launches the sidebar.
Sidebar.html: The HTML and JavaScript for the main admin workflow user interface.
State.gs / StateControl.gs: A set of functions to get, save, and reset the steps of the admin workflow (e.g., getUiState, saveUiState, resetStateToStart).
Backup & Restore
Backup.gs: Contains backupSheets() to create full backups of the core spreadsheets.
Restore.gs: Contains restoreFromBackup() to restore the system from a saved backup set.
Data Import & Staging
ImportWebOrders.gs: Contains importWebOrders() to import CSV data into the OrdersS sheet.
ImportComaxProducts.gs: Contains importComaxProducts() to import CSV data into the ComaxS sheet.
ImportWebProducts.gs: Contains importWebProducts() to import CSV data into the WebS sheet.
Order & Packing Data Processing
OrderProcessing.gs:
mergeOrders(): Merges staged orders into the master OrdersM sheet and updates the OrderLog.
exportOrdersForComax(): Generates an aggregate CSV of new orders and updates their export status in the OrderLog.
PackingSlipData.gs:
preparePackingData(): Reads master order and product data to populate the PackingQueue and PackingRows sheets, making them ready for the Frontend to use.
Comparison & Exception Handling
Compare.gs:
reviewProducts(): The main engine that compares all staged and master sheets, identifies discrepancies, and creates tasks in the TaskQ.
TaskCreator.gs:
createTasksFromSidebar(): Creates inventory-related tasks (Low Stock, Periodic Review) based on admin input.
HandleExceptions.gs: Contains functions called by the sidebar to manage TaskQ items, such as getTasks(), assignTask(), and updateTaskLifecycle().
Inventory Review (Admin Side)
InventoryReview.gs:
populateReviewSheet(): Loads inventory counts submitted by Frontend users for admin review.
processAndExportReviewedInventory(): Processes the admin's accepted counts and finalizes the inventory update.
Finalization
Finalize.gs:
finalizeProductData(): The final step in the main workflow, which applies the clean data from staging sheets to the master sheets.

Frontend Scripts & Functions
This environment provides the user interface for remote workers. It uses a Web App to securely interact with the protected Reference spreadsheet.
Core Architecture & UI
WebApp.gs:
doPost(e): The central Web App router. It receives all commands from the Frontend UI, runs with owner permissions, and calls the appropriate server-side worker function.
Globals.gs:
G: A constant object containing all file IDs, sheet names, and the Web App URL.
getReferenceSheet(): A server-side helper function to access sheets in the protected Reference file.
Dashboard.gs:
onOpenInstallable(): Trigger that runs when the sheet is opened to build the custom menu.
onEditInstallable(e): Trigger that routes edit events for user selection and Brurya auto-population.
populateUserDropdown(): Client-side function that calls the Web App to get the list of users.
handleDashboardEdit(e): Client-side function that calls the Web App to get a user's permissions.
_server_getUsers(): Server-side worker that reads the Users sheet.
_server_getBruryaAccess(): Server-side worker that gets a specific user's permissions.
Brurya Inventory Workflow
Brurya.gs:
populateBruryaSheetFromAudit(): Client-side menu function that calls the Web App to load the sheet.
handleBruryaEdit(e): Client-side trigger that calls the Web App to auto-populate item details when a SKU is entered.
submitBruryaToAudit(): Client-side menu function that sends current sheet data to the Web App for processing.
_server_populateBruryaSheet(): Server-side worker that gets the initial data for the Brurya sheet.
_server_getItemDetailsBySku(): Server-side worker that looks up item details from ComaxM.
_server_submitBruryaWithCheck(): Server-side worker that compares submitted data to the master data and saves all changes.
General Inventory Workflow
Inventory.gs:
populateInventorySheetFromTasks(): Client-side menu function that calls the Web App to load the user's assigned tasks.
submitInventoryToAudit(): Client-side menu function that sends the user's completed counts to the Web App.
_server_populateInventory(): Server-side worker that gets a user's assigned tasks from TaskQ.
_server_submitInventory(): Server-side worker that updates the Audit sheet and marks tasks as "Review" in TaskQ.
Packing Slip Workflow
updatePackingDisplay.gs:
updatePackingDisplay(): Client-side menu function that calls the Web App to get the list of orders ready for packing.
_server_getPackingDisplayData(): Server-side worker that reads PackingQueue and OrderLog to build the list.
PackingSlipConsolidated.gs:
generateSelectedPackingDocs(): Client-side menu function that gathers selected orders and calls the Web App.
createConsolidatedPackingDocs(): Client-side menu function that tells the Web App to process all orders in the queue.
_server_generatePackingDocs(): Server-side worker that contains the engine for creating the consolidated Google Docs.
Utility
ComaxSync.gs:
syncComaxDirectory(): Client-side menu function that calls the Web App to refresh the local Comax directory sheet.
_server_getComaxData(): Server-side worker that reads and filters data from the master ComaxM sheet.

Sheet & Column Details:
Reference Spreadsheet Sheets: TaskQ (Active Exception Log): Logs all active exceptions identified during data comparison. Columns: Timestamp, Session ID, Type, Source, Details, RelatedEntity, Status, Priority, AssignedTo, StartDate, EndDate, DoneDate, Notes. Task statuses: Open, Assigned, Review, Closed. WebM (Website Master Catalog): Master product data for the web catalog. Columns: ID, SKU, W Name, W Publ, W Stock, W Price. ComaxM (ERP Master Catalog): Master product data from the ERP. Columns: CMX ID, CMX SKU, CMX NAME, CMX DIV, CMX GROUP, CMX VENDOR, CMX BRAND, CMX COLOR, CMX SIZE, CMX DRY, CMX YEAR, CMX NEW, CMX ARCHIVE, CMX ACTIVE, CMX PRICE, CMX STOCK, CMX WEB, EXCLUDE. Audit: Tracks product stock-taking and detail verification from the Frontend. Columns: ID (from ComaxM), SKU (from ComaxM), LastCount, ComaxQty, NewQty (total submitted from Frontend), BruryaQty (location quantity submitted from Frontend), StorageQty (location quantity submitted from Frontend), OfficeQty (location quantity submitted from Frontend), ShopQty (location quantity submitted from Frontend). OrdersM (Website Orders Master): The master log of all web orders. Columns: order_id, order_number, order_date, paid_date, status, Shipping_total, shipping_tax_total, fee_total, fee_tax_total, tax_total, cart_discount, order_discount, discount_total, order_total, order_subtotal, order_currency, payment_method, payment_method_title, transaction_id, customer_ip_address, customer_user_agent, shipping_method, customer_id, customer_user, customer_email, billing_first_name, billing_last_name, billing_company, billing_email, billing_phone, billing_address_1, billing_address_2, billing_postcode, billing_city, billing_state, billing_country, Shipping_first_name, shipping_last_name, shipping_company, shipping_phone, shipping_address_1, shipping_address_2, shipping_postcode, shipping_city, shipping_state, shipping_country, customer_note, Wt_import_key, shipping_items, fee_items, tax_items, coupon_items, refund_items, order_notes, download_permissions, meta:wt_pklist_order_language, followed by details for up to 24 line items. Web Order Statuses: pending, failed, on-hold, processing, completed, cancelled, refunded, draft.

OrderLog: Tracks the processing status of orders. Columns: order_id    order_date    packing_slip_status    packing_print_date    comax_export_status    customer_note_doc_id.

OnHoldInventory: A summary of inventory for items in orders that are currently on-hold. Columns: SKU, OnHoldQuantity. PackingQueue: A staging sheet holding order-level data for all orders eligible for packing slip generation. Columns: Order Number, Order Date, Customer Name, Phone, Email, Address PackingRows: A staging sheet holding item-level data for all orders eligible for packing slip generation. Columns: Order Number, Order Date, SKU, Quantity, Name EN, Name HE, Short, Intensity, Complexity, Acidity, Decant, Harmonize, Contrast Users (Task Assignment Directory): Defines all system users, their contact information, and specific permissions. Columns: ID, Name, Email, Phone, Language, Brurya Access (values 'Y' or 'N'). DetailsM (product detail master): The master sheet for granular product details. Columns: SKU, שם היין, NAME, קצר, Short, תיאור ארוך, Description, אזור, ABV, Intensity, Complexity, Acidity, Sweet Con, Intense Con, Rich Con, Mild Con, Sweet Har, Intense Har, Rich Har, Mild Har, Decant, היתר מכירה, K1, K2, K3, K4, K5, G1, G2, G3, G4, G5 DetailsC (calculated product details): Contains calculated or derived product details. Columns: SKU, תיאור, Description, Harmonize, Contrast, הרמוניה, קונטרסט, כשרות, Kashrut, ענבים, Grapes, תיאור קצר, Short Description, Comax Name, C Stock, Price, C Div., C Group, C Year, C Size, HE ID, EN ID DetailsO (product detail output): A staging sheet for product detail output, used for updates and packing slips. Columns: SKU, תיאור, Description, Harmonize, Contrast, הרמוניה, קונטרסט, כשרות, Kashrut, ענבים, Grapes, תיאור קצר, Short Description, Comax Name, C Stock, Price, C Div., C Group, C Year, C Size, HE ID, EN ID Config: Contains system-wide configuration settings and values. Columns: Setting, Value, Notes Grapes, Kashrut, Texts, WeHe: Various metadata and mapping sheets used for lookups and data enrichment.
Backend Spreadsheet Sheets: WebS (Web Product Staging): Staging area for imported web product data. Columns: ID, SKU, W Name, W Publ, W Stock, W Price. ComaxS (ERP Product Staging): Staging area for imported ERP product data. Columns: CMX ID, CMX SKU, CMX NAME, CMX DIV, CMX GROUP, CMX VENDOR, CMX BRAND, CMX COLOR, CMX SIZE, CMX DRY, CMX YEAR, CMX NEW, CMX ARCHIVE, CMX ACTIVE, CMX PRICE, CMX STOCK, CMX WEB, EXCLUDE. OrdersS (Web Orders): Staging area for imported web order data before it's merged into the master file. Columns: (Same as OrdersM) Inventory Review Sheet: A UI sheet for an admin to review and accept inventory counts submitted by Frontend users. Columns: Product Identification (ID, Name, SKU), Quantity Comparison (ComaxQty, NewQty, BruryaQty, StorageQty, OfficeQty, ShopQty), User Action (Accept - editable, Notes - editable).
Frontend Spreadsheet Sheets: Dashboard: The landing page for user selection and general information. Inventory: The main sheet for users to perform assigned stock-taking tasks. Columns: Name, ID, SKU, Stock, Difference, TotalQty, BruryaQty, StorageQty, OfficeQty, ShopQty. Brurya: A specialized, streamlined interface for counting inventory at a single location. Columns: ID, Name, SKU, BruryaQty. Config: A hidden sheet for managing the active user's session state.
General Workflow Rules & Conventions
Sheet writes consistently use setValues(). Session IDs are formatted as hhmmssSSS. Script versions are marked with date as: YYYY-MM-DD-HHMM All comparisons involve trimming whitespace and normalizing casing for accuracy. Open TaskQ items remain persistent across multiple runs. The Frontend UI is a stateless menu system where each action is an independent, secure transaction handled by the Web App.

Product Validation Test Matrix
Web Comparison (A) A1 (II) – Staging ID missing from WebM. A2 (II) – WebM ID missing from staging. A3 (I) – SKU mismatch by ID. A4 (I) – Name mismatch by ID. A5 (III) – Publish status mismatch.
Comax Comparison (C) Applied only to “Sell Online” SKUs. C1 (II) – SKU in ComaxM but missing from ComaxS. C2 (I) – ID mismatch. C3 (I) – Name mismatch. C4 (I) – Group mismatch. C5 (I) – Size mismatch. C6 (I) – Vintage mismatch.
Data Audits (D) D1 (I) – EXCLUDE flag illogically set. D2 (IV) – Negative inventory. D3 (IV) – Archived with stock (critical alert if also online).
Cross-File Checks (E) E1 (II) – New online SKU not found in Web. E2 (II) – Web SKU not found in Comax. E3 (III) – Published SKU on Web but offline in Comax.

