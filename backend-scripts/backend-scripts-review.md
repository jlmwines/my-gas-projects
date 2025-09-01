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

  Low Priority (Minor/Cosmetic/Placeholder):

   24. `backend-scripts/AuditLowProducts.js` - File with Typo: Remove AuditLowPorducts.js.
   25. `backend-scripts/Finalize.js` - Hardcoded Test Reference ID: Minor point, but could be improved.
   26. `backend-scripts/HandleExceptions.js` - Unused/Disabled Function: Consider removing jumpToTaskSource() if not needed.
   27. `backend-scripts/Sidebar.js` - Placeholder `updateInventoryProtection()`: Implement or remove.
   28. `backend-scripts/RestoreDialog.html` - Dialog Closing on Error: Consider keeping the dialog open longer on error.
   29. `backend-scripts/State.js` - Default State Duplication: The default UI state object is duplicated. (Already listed in medium priority,
       but also applies here).
   30. `backend-scripts/TaskCreator.js` - `runTaskCreatorWorkflow()`: Consider if this older entry point is still needed.