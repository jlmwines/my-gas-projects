# JLM Wines - Comax ERP & Web Catalog Sync System

## Overview

This system is a comprehensive Google Apps Script-based solution designed to synchronize, audit, and manage product and order data between a Comax ERP system and a web-based sales catalog. It leverages Google Sheets as its primary data store and user interface, routing all data operations through a secure Web App script that executes with the project owner's permissions.

## Core Purpose

The primary goal of this system is to ensure data consistency and streamline workflows related to:

*   **Product Data Management:** Importing, processing, and updating product information from Comax to the web catalog.
*   **Order Processing:** Importing web orders, preparing packing slips, and exporting order summaries for Comax.
*   **Inventory Management:** Auditing stock levels, managing negative inventory, and facilitating product counting tasks.
*   **Task Management:** Creating, assigning, and tracking various data-related tasks (e.g., product updates, inventory reviews).
*   **System Maintenance:** Providing tools for data backup, restore, and archiving.

## Architecture

The system operates across two primary environments and utilizes several key Google Workspace components:

*   **Google Sheets:**
    *   **Reference Spreadsheet:** A central repository for master data (e.g., ComaxM, WebM, TaskQ, Users, Config) and lookup tables. This is the single source of truth for the system's configuration and core data.
    *   **Backend Spreadsheet (Active Spreadsheet):** The Google Sheet where the Apps Script project is bound. It contains staging sheets (e.g., WebS, ComaxS, OrdersS) and temporary sheets used during various workflows (e.g., Inventory, ProductDetails, PackingQueue, PackingRows).

*   **Google Apps Script Project:**
    *   **Frontend (User) Environment (`frontend-scripts`):** Contains client-side HTML and JavaScript files for user-facing interfaces (e.g., `Dashboard.html` for daily tasks, `DetailsForm.html` for product editing) and server-side `.gs` files that expose functions to these UIs via `google.script.run`.
    *   **Backend (Admin) Environment (`backend-scripts`):** Contains HTML and JavaScript files for administrative interfaces (e.g., `AdminSidebar.html` for workflow control, `RestoreDialog.html` for restore options) and server-side `.gs` files that implement core business logic, data processing, and system maintenance tasks.

*   **Google Drive:** Used for storing import CSV files, backup snapshots, and generated PDF documents (packing slips, customer notes).

*   **Google Apps Script Web App:** A deployed web app that acts as a secure endpoint for certain data operations, ensuring that all data modifications occur with the project owner's permissions.

## Key Workflows

### 1. Daily Sync Workflow

*   **Purpose:** Ensures product and order data is synchronized between Comax and the web catalog.
*   **Process:** Involves importing Comax product data (`ImportComaxProducts.js`), importing web orders (`ImportWebOrders.js`), and comparing/merging data to update master records (`OrderProcessing.js`, `Finalize.js`).

### 2. Order Processing

*   **Purpose:** Manages the lifecycle of web orders from import to packing slip generation and export for Comax.
*   **Process:** Includes merging orders (`OrderProcessing.js`), preparing packing data (`PackingSlipData.js`), generating packing slips and customer notes (`PackingSlipCreator.js`, `PackingSlipProcessor.js`), and exporting order summaries (`OrderProcessing.js`).

### 3. Product Detail Management

*   **Purpose:** Facilitates the review and update of detailed product information for the web catalog.
*   **Process:** Involves listing product update tasks (`ProductDetails.js`), providing a form for editing details (`DetailsForm.html`), and processing approvals to update master data (`DetailsReview.js`).

### 4. Inventory Management

*   **Purpose:** Supports auditing and counting of physical inventory.
*   **Process:** Includes populating inventory review sheets (`InventoryReview.js`), submitting counts (`Inventory.js`), and auditing low-stock products (`AuditLowProducts.js`).

### 5. Task Management

*   **Purpose:** Centralizes the creation, assignment, and tracking of various operational tasks.
*   **Process:** Tasks are logged to the `TaskQ` sheet (`Compare.js`, `TaskCreator.js`, `HandleExceptions.js`) and can be reviewed and managed through both user and admin interfaces.

### 6. System Maintenance

*   **Purpose:** Ensures the long-term health and recoverability of the system.
*   **Process:** Includes daily backup rotation (`Backup.js`), manual snapshot creation (`Backup.js`), data restoration (`Restore.js`), and archiving old records (`Housekeeping.js`).

## Setup & Deployment

*(Placeholder for detailed setup instructions. This would typically include:)*

1.  **Google Apps Script Project Setup:** How to create a new Apps Script project and bind it to the Backend Spreadsheet.
2.  **`clasp` Configuration:** Instructions for setting up `clasp` for local development and pushing code to the Apps Script project.
3.  **Google Drive Folder Structure:** Required 'Import' and 'Backup' folders, and their IDs.
4.  **Reference Spreadsheet Setup:** How to create/link the Reference Spreadsheet and populate its initial sheets (Config, Users, ComaxM, WebM, TaskQ, etc.).
5.  **API Enablement:** Ensuring Drive API v2 is enabled in the Google Cloud Project associated with the Apps Script project.
6.  **Web App Deployment:** Instructions for deploying the Apps Script project as a Web App to obtain the `WEB_APP_URL`.
7.  **`Globals.js` Configuration:** How to update `WEB_APP_URL`, `FILE_IDS`, and other environment-specific settings in `Globals.js` for both frontend and backend environments.
8.  **Installable Triggers:** Setting up `onOpen` and `onEdit` installable triggers.
9.  **Time-Driven Triggers:** Setting up triggers for daily backups and archiving.

## Usage

Users and administrators interact with the system primarily through custom menus and sidebars within the Google Sheet.

*   **Opening Sidebars:** Use the custom menu (`JLM Wines` -> `Show Sidebar` or `Admin Sidebar`) to open the respective dashboards.
*   **Workflow Buttons:** Buttons within the sidebars trigger specific actions (e.g., `Run Sync`, `Create Tasks`, `Submit for Review`).
*   **Sheet Interactions:** Some workflows involve direct interaction with specific sheets (e.g., `Inventory` sheet for counting, `Product Details` sheet for task selection).

## File Structure

*   `project-root/`
    *   `frontend-scripts/`: Contains Apps Script files and HTML templates for the user-facing (frontend) environment.
    *   `backend-scripts/`: Contains Apps Script files and HTML templates for the administrative (backend) environment.
    *   `frontend-scripts-wishlist.md`: Documentation of identified areas for improvement in the frontend code.
    *   `backend-scripts-review.md`: Documentation of identified areas for improvement in the backend code.
    *   `README.md`: This document.
    *   *(Other project-specific files like `.clasp.json`, `appsscript.json`)*

## Future Improvements / Known Issues

### Frontend Environment Wishlist

# Frontend Scripts Wishlist

This document outlines areas for improvement and potential issues identified during a review of the `frontend-scripts` directory. These points are categorized by priority.

## Medium Priority (Maintainability/Efficiency/Consistency)

*   **Hardcoded Column Indices and Sheet Names:**
    *   **Description:** Throughout `Brurya.js`, `ComaxSync.js`, `Inventory.js`, `PackingSlipConsolidated.js`, `ProductDetails.js`, `Sidebar.js`, `StockHealth.js`, and `Utilities.js`, column indices are often hardcoded or determined via `indexOf()` on string literals. Sheet names are also sometimes hardcoded.
    *   **Recommendation:** Centralize all column indices and sheet names in `G.COLUMN_INDICES` and `G.SHEET_NAMES` within `Globals.js`. Consistently use these global constants to improve maintainability and robustness against sheet structure changes.

*   **Performance for Large Sheets (Reading/Writing Entire Ranges):**
    *   **Description:** Functions in `Brurya.js`, `ComaxSync.js`, `Inventory.js`, `ProductDetails.js`, `Sidebar.js`, and `StockHealth.js` frequently use `getDataRange().getValues()` and `setValues()` on entire sheets.
    *   **Recommendation:** For very large sheets, this can be inefficient. Consider optimizing by reading/writing only necessary ranges or implementing more targeted updates if performance becomes a bottleneck.

*   **`frontend-scripts/Inventory.js` - `_server_getProductCountTasks()` Efficiency:**
    *   **Description:** This function calls a full data population function (`server_populateInventory`) just to retrieve a count, performing more work than necessary.
    *   **Recommendation:** Implement a dedicated, lightweight server-side function that *only* calculates and returns the count of product tasks, without fetching all associated data.

*   **`frontend-scripts/UpdatePackingDisplay.js` - Code Duplication:**
    *   **Description:** Significant logical duplication exists between `_server_getOpenOrderCount()` and `_server_getPackingDisplayData()`.
    *   **Recommendation:** Extract the common data fetching and filtering logic into a shared helper function to reduce redundancy and improve maintainability.

*   **`frontend-scripts/Display.html` - `callServer` Function:**
    *   **Description:** The `callServer` function implements a custom `doPost` communication pattern, but most other server calls use direct `google.script.run`.
    *   **Recommendation:** Review the necessity of this custom `callServer` abstraction. If there isn't a strong, specific reason for its existence (e.g., complex authentication or cross-script communication not easily handled by `google.script.run`), consider refactoring to use direct `google.script.run` calls for consistency and simplicity.

*   **`frontend-scripts/PackingSlipConsolidated.js` - `IS_TEST_RUN` Flag:**
    *   **Description:** The `IS_TEST_RUN` constant is hardcoded within the file.
    *   **Recommendation:** Move this configuration flag to `Globals.js` to centralize environment-specific settings and allow for easier switching between test and production modes.

*   **HTML Files (`Dashboard.html`, `DetailsForm.html`, `Display.html`) - Inline Styles and `onclick` Attributes:**
    *   **Description:** These HTML files contain extensive inline CSS and JavaScript directly embedded in `onclick` attributes.
    *   **Recommendation:** For improved readability, maintainability, and separation of concerns, extract most CSS into `<style>` blocks in the `<head>` or external CSS files. Attach JavaScript event listeners programmatically rather than using `onclick` attributes.

*   **HTML Files (`Dashboard.html`, `Display.html`) - `globalRefresh()` Spin Icon Logic:**
    *   **Description:** The `setTimeout` used to remove the spin class from refresh icons has a hardcoded delay, which might not accurately reflect the completion of server-side operations.
    *   **Recommendation:** Improve the logic to remove the spin class only after all associated server calls have successfully completed (e.g., by using a counter for pending requests or by triggering the removal in the final `withSuccessHandler`/`withFailureHandler`).

*   **`frontend-scripts/StockHealth.js` - Sheet Deletion and Recreation:**
    *   **Description:** Functions like `_server_populateAndFilterNewProducts` delete and recreate the `NewProducts` sheet to clear its content.
    *   **Recommendation:** Consider if `sheet.clearContents()` or `sheet.clear()` would be sufficient and more performant than deleting and re-inserting the sheet, especially if only the data needs to be reset and not the sheet's properties or position.

## Low Priority (Minor/Cosmetic/Placeholder)

*   **`frontend-scripts/Brurya.js` - `DEBUG_TEST_OK` Message:**
    *   **Description:** The `_server_submitBruryaWithCheck` function returns a debug message (`DEBUG_TEST_OK`).
    *   **Recommendation:** Change this to a more user-friendly and production-ready message.

*   **`frontend-scripts/Utilities.js` - Unused `forceReAuth()` Function:**
    *   **Description:** The `forceReAuth()` function is defined but not called anywhere in the reviewed frontend scripts.
    *   **Recommendation:** If this function is not intended for future use or manual execution, consider removing it to keep the codebase clean.

*   **`frontend-scripts/Sidebar.js` - Placeholder `updateInventoryProtection()`:**
    *   **Description:** The `updateInventoryProtection()` function is called but currently contains only a `Logger.log` statement, indicating it's a placeholder.
    *   **Recommendation:** Implement the intended protection logic or remove the function if it's no longer needed.

### Backend Environment Review Findings

 High Priority (Bugs/Direct Impact):

   1. `backend-scripts/AdminWorkflow.js` - Critical: `getImportFileDates()` placeholder: Verify the existence and correctness of the real
      getImportFileDates() function. If it's missing or incorrect, the runProductsStep will fail silently or with unexpected behavior.
   2. `backend-scripts/Restore.js` - CRITICAL: Code Duplication of `restoreSheetsToFile()`: One of the duplicate function definitions needs to
      be removed.

  Medium Priority (Maintainability/Efficiency/Consistency):

   3. Pervasive Hardcoded Column Indices and Sheet Names: This is the most significant recurring issue across almost all .js files in
      backend-scripts. This includes:
       * AdminWorkflow.js (getTaskCountsForAssignee_, getAdminTaskCounts_)
       * AuditLowProducts.js (AuditLowProducts)
       * ExportInventory.js (exportInventoryAdjustments)
       * Finalize.js (finalizeProductData, syncNewProductsToAudit)
       * HandleExceptions.js (getWorkflowSummary, getUsers, getTasks, updateTaskLifecycle, assignTask, addTaskNote)
       * Housekeeping.js (archiveOldOrderLogRecords, setReferenceSetting)
       * ImportComaxProducts.js (executeComaxImport)
       * ImportWebOrders.js (executeWebOrdersImport)
       * ImportWebProducts.js (executeWebImport)
       * InventoryReview.js (populateReviewSheet, markAllAsAccepted, processAndExportReviewedInventory, getOrCreateReviewSheet_)
       * Negatives.js (moveNegativeRows)
       * OrderProcessing.js (mergeOrders, exportOrdersForComax)
       * PackingSlipCreator.js (createPackingSlipPDF, createCustomerNotePDF)
       * PackingSlipData.js (preparePackingData)
       * PackingSlipProcessor.js (generatePackingSlipsAll)
       * PackingTexts.js (generatePackingTextDetails)
       * TaskCreator.js (createTasks, getTaskPanelInfo, saveTaskSettings)
       * Recommendation: This is the highest priority for refactoring. All sheet names and their corresponding column indices should be
         defined in G.SHEET_NAMES and G.COLUMN_INDICES within backend-scripts/Globals.js and consistently used throughout the project.

   4. Performance for Large Sheets: Reading and writing entire data ranges (getDataRange().getValues(), setValues()) can be inefficient for very
      large sheets. This is noted in many files.
   5. Code Duplication:
       * backend-scripts/Housekeeping.js and PackingSlipData.js have a duplicated setReferenceSetting function.
       * backend-scripts/InventoryReview.js has a duplicated getReferenceSheet_ function.
       * Recommendation: Centralize these helper functions in a shared utility file (e.g., backend-scripts/Utils.js or
         backend-scripts/Globals.js).
   6. `backend-scripts/Menu.js` - Workflow Transition: The createMenuAndShowSidebar() function still defaults to showing the old Sidebar.html.
      This needs to be updated to showAdminSidebar() if Sidebar.html is being replaced.
   7. `backend-scripts/OpenSidebar.js` - Obsolete `showWorkflowSidebar()`: This function and its associated Sidebar.html might be phased out.
   8. Hardcoded Configuration Setting Names: The string literals for configuration settings (e.g., 'TaskCreator_DefaultLimit') should be defined
      as constants in backend-scripts/Globals.js.
   9. Hardcoded HTML File Names: In Menu.js and OpenSidebar.js. Centralize these in backend-scripts/Globals.js.
   10. Hardcoded Product Item Limits: In OrderProcessing.js, PackingSlipData.js, PackingSlipProcessor.js. Review the 24 limit.
   11. `backend-scripts/Negatives.js` - CRITICAL: Hardcoded Target Spreadsheet ID: This is a major point of brittleness.
   12. `backend-scripts/AdminSidebar.html` - Styling: Centralize CSS for better maintainability.
   13. `backend-scripts/AdminSidebar.html` - `renderReviewTasks` - Dynamic Function Call: While functional, ensure group.functionName is always
       from a trusted source.
   14. `backend-scripts/AdminSidebar.html` - Generic Alert Messages: Consider a less intrusive notification system.
   15. `backend-scripts/AdminSidebar.html` - `setLoadingState` Scope: Evaluate if disabling all buttons/links is the desired behavior for all
       loading states.
   16. `backend-scripts/DownloadDialog.html` - Large CSV Data Handling: For very large files, the current approach might encounter performance
       or size issues.
   17. `backend-scripts/Picker.html` - Sensitive Credentials: Ensure developerKey and appId are securely managed and part of activeConfig.
   18. `backend-scripts/Picker.html` - Error Display: Consider a less intrusive error display.
   19. `backend-scripts/Picker.html` - OAuth Scopes: Verify that the getOAuthTokenForPicker() function has the necessary OAuth scopes.
   20. `backend-scripts/StateControl.js` - Default State Duplication: The default UI state object is duplicated.
   21. `backend-scripts/StateControl.js` - Incomplete `sheetsToClear` List: Ensure this list is comprehensive.
   22. `backend-scripts/SyncSidebar.html` - Obsolete File: If this file is no longer used, it should be removed.
   23. `backend-scripts/SyncSidebar.html` - `handleSuccess()` `confirmation_required` logic: Understand the server-side counterpart
       (runConfirmedExport) and ensure it's correctly implemented.

## Low Priority (Minor/Cosmetic/Placeholder)

   24. `backend-scripts/AuditLowProducts.js` - File with Typo: Remove AuditLowPorducts.js.
   25. `backend-scripts/Finalize.js` - Hardcoded Test Reference ID: Minor point, but could be improved.
   26. `backend-scripts/HandleExceptions.js` - Unused/Disabled Function: Consider removing jumpToTaskSource() if not needed.
   27. `backend-scripts/Sidebar.js` - Placeholder `updateInventoryProtection()`: Implement or remove.
   28. `backend-scripts/RestoreDialog.html` - Dialog Closing on Error: Consider keeping the dialog open longer on error.
   29. `backend-scripts/State.js` - Default State Duplication: The default UI state object is duplicated. (Already listed in medium priority,
       but also applies here).
   30. `backend-scripts/TaskCreator.js` - `runTaskCreatorWorkflow()`: Consider if this older entry point is still needed.