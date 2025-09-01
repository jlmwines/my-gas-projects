# New Product Task Integration Plan

## 1. Objective
To integrate a "New Product" task type into the existing frontend workflow, allowing users to complete details for products that have been minimally pre-registered in `DetailsM` by an admin. The process should leverage existing product detail editing functionalities.

## 2. Assumptions
*   **Product Pre-existence in `DetailsM`:** For any "New Product" task, a corresponding entry with at least SKU, Hebrew Product Name, and English Product Name will already exist in the `DetailsM` sheet.
*   **`DetailsS` Role:** The `DetailsS` sheet is exclusively updated by the frontend submission process. It will not contain initial data for new products.
*   **TaskQ Type:** The new task type in `TaskQ` will be `'New Product'` with a `Status` of `'Assigned'`.
*   **SKU and Names Pre-supplied:** The SKU, Hebrew Product Name, and English Product Name will be available from the `DetailsM` entry when the form is opened.

## 3. High-Level Workflow
1.  **Admin Action:** Admin creates a new product entry in `DetailsM` (SKU, Hebrew Name, English Name).
2.  **Admin Action:** Admin creates a "New Product" task in `TaskQ` for this SKU, setting its status to 'Assigned'.
3.  **Frontend User:** Opens the sidebar (`Display.html`).
4.  **Frontend User:** Clicks a new button/section to list "New Product" tasks.
5.  **Frontend User:** Selects a "New Product" task (by SKU) and clicks "View Details".
6.  **System:** `DetailsForm.html` opens, pre-populated with data from `DetailsM` (SKU, names). Other fields are blank.
7.  **Frontend User:** Fills in the remaining product details.
8.  **Frontend User:** Clicks "Submit for Review".
9.  **System:** The completed product data is submitted to `DetailsS` (as a new row).
10. **System:** The `TaskQ` entry for this product is updated (e.g., status to 'Review').

## 4. Detailed Changes

### 4.1. `Display.html` (Frontend UI)
*   **Add New Section:** Introduce a new `<h4>` heading for "New Products" below the existing "Products" section.
*   **New Message Area:** Add a `div` with `id="new-product-message"` to display status messages for new product tasks.
*   **New Button:** Add a button (e.g., `id="list-new-products-btn"`) with an `onclick` handler to trigger listing of "New Product" tasks.
*   **Modify `listProductDetailTasks()`:**
    *   Change its signature to accept `taskType` (e.g., `'Product Exception C6'` or `'New Product'`) and `messageElementId` (e.g., `'details-message'` or `'new-product-message'`).
    *   This function will call a new generic server-side function (e.g., `_server_getTasksByTypeAndStatus`) to fetch tasks.
*   **Create `listNewProductTasks()`:** A new client-side function that calls the modified `listProductDetailTasks()` with `taskType='New Product'` and `messageElementId='new-product-message'`.
*   **Update `globalRefresh()`:** Ensure it calls both `listProductDetailTasks()` (for existing updates) and `listNewProductTasks()`.
*   **`viewProductDetails()`:** This function should remain generic. It will continue to rely on `_server_getSkuFromActiveCell()` to get the SKU from the currently selected row in the `ProductDetails` sheet, regardless of task type.
*   **Button Enablement:** The `view-details-btn` should be enabled if *any* tasks (either 'Product Exception C6' or 'New Product') are loaded into the `ProductDetails` sheet.

### 4.2. `ProductDetails.js` (Backend Logic)
*   **New Generic Task Fetcher:**
    *   Create a new server-side function, e.g., `_server_getTasksByTypeAndStatus(taskType, selectedFilterUser)`.
    *   This function will read `TaskQ`, filter by the provided `taskType` and `selectedFilterUser`, and write the results (SKU, Details, Type) to the `ProductDetails` sheet.
    *   The `ProductDetails` sheet will need a new column for 'Type' to differentiate tasks.
*   **Modify `_server_getProductDetailTasks()`:** This function will now simply call `_server_getTasksByTypeAndStatus('Product Exception C6', selectedFilterUser)`.
*   **`_server_getProductDetailsForForm(sku)`:**
    *   This function will *only* fetch data from `DetailsM`.
    *   It will *not* look in `DetailsS` for initial data.
    *   If `sku` is not found in `DetailsM`, it should throw an error (as per assumption).
*   **`_server_submitProductDetails(sku, editedData, selectedUser)`:**
    *   The existing `upsert` logic for `DetailsS` is suitable.
    *   For a "New Product" task, `DetailsS` will not have an existing entry for that SKU, so the `appendRow` path will be taken, effectively adding the complete, newly detailed product record.
    *   The `originalRow` for comparison will always come from `DetailsM`.
    *   **TaskQ Update:** The logic for updating `TaskQ` status needs to be adapted to handle the `'New Product'` type. It should change the status from `'Assigned'` to `'Review'` (or 'Completed') for the specific SKU and task type.

### 4.3. `Sidebar.js` (Backend Delegators)
*   **New Delegator:** Add a delegator function for the new `_server_getTasksByTypeAndStatus` if it's called directly from the client-side.
    *   `function getTasksByTypeAndStatus(taskType, selectedFilterUser) { return _server_getTasksByTypeAndStatus(taskType, selectedFilterUser); }`
*   Ensure `_server_checkModalStatus()` continues to function correctly for both task types.

### 4.4. `Globals.js` (Constants)
*   Consider adding a new constant for the `'New Product'` task type:
    `G.TASK_TYPES.NEW_PRODUCT: 'New Product'`

## 5. Testing Considerations
*   **Admin Setup:** Verify that creating a minimal entry in `DetailsM` and a corresponding `TaskQ` entry works.
*   **Frontend Display:** Check if "New Product" tasks are listed correctly in the sidebar with the appropriate message.
*   **Form Opening:** Verify that clicking "View Details" for a "New Product" task opens `DetailsForm.html` with pre-filled SKU and names, and blank fields for other details.
*   **Form Submission:** Test submitting a completed "New Product" form.
*   **`DetailsS` Update:** Confirm that the new product's complete data is appended to `DetailsS`.
*   **`TaskQ` Update:** Verify that the "New Product" task's status in `TaskQ` is updated correctly.
*   **Existing Workflow:** Ensure that existing "Product Update" tasks still function as expected.
*   **Error Handling:** Test scenarios where a SKU is not found in `DetailsM` for a "New Product" task.
