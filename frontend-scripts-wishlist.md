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