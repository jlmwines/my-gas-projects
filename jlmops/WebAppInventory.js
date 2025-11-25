/**
 * @file WebAppInventory.js
 * @description This script acts as a Data Provider for all inventory-related data,
 * following the architecture plan.
 */

/**
 * Gets all data required for the Admin Inventory Widget.
 * @returns {Object} An object containing counts and tasks for the inventory widget.
 */
function WebAppInventory_getInventoryWidgetData() {
  try {
    const inventoryManagementService = InventoryManagementService;
    // 1. Get Brurya stats from the backend service
    const bruryaSummary = inventoryManagementService.getBruryaSummaryStatistic();
    
    // 2. Get task counts from the tasks data provider
    const openNegativeInventoryTasksCount = WebAppTasks.getOpenTasksByTypeId('task.validation.comax_internal_audit').length;
    const openInventoryCountTasksCount = WebAppTasks.getOpenTasksByTypeId('task.inventory.count').length;
    const openInventoryCountReviewTasksCount = WebAppTasks.getOpenTasksByTypeId('task.inventory.count_review').length;

    // 3. Check for Web Inventory Export tasks
    const webInventoryExportReadyTask = WebAppTasks.getOpenTaskByTypeId('task.export.web_inventory_ready');
    const webInventoryConfirmationTask = WebAppTasks.getOpenTaskByTypeId('task.confirmation.web_inventory_export');
    
    // 4. Set disabled fields to their null state
    const comaxInventoryExportCount = 0;
    const openComaxInventoryConfirmationTask = null;

    return {
      bruryaProductCount: bruryaSummary.productCount,
      bruryaTotalStock: bruryaSummary.totalStock,
      openNegativeInventoryTasksCount: openNegativeInventoryTasksCount,
      openInventoryCountTasksCount: openInventoryCountTasksCount,
      openInventoryCountReviewTasksCount: openInventoryCountReviewTasksCount,
      comaxInventoryExportCount: comaxInventoryExportCount,
      openComaxInventoryConfirmationTask: openComaxInventoryConfirmationTask,
      webInventoryExportReadyTask: webInventoryExportReadyTask,
      webInventoryConfirmationTask: webInventoryConfirmationTask,
      error: null
    };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getInventoryWidgetData', e.message, e);
    return { error: `Could not load inventory widget data: ${e.message}` };
  }
}

/**
 * Gets data for the manager inventory view.
 * @returns {Object} An object with inventory data for the manager.
 */
function WebAppInventory_getManagerInventoryData() {
  return { isInventoryCountNeeded: true }; // Placeholder
}

/**
 * Wraps the ProductService.exportWebInventory function so it can be called from the UI.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_exportWebInventory() {
  return ProductService.exportWebInventory();
}

/**
 * Retrieves the full list of Brurya stock for display.
 * @returns {Array<Object>} An array of stock items, each with SKU and quantity.
 */
function WebAppInventory_getBruryaStockList() {
  try {
    const inventoryManagementService = InventoryManagementService;
    return inventoryManagementService.getBruryaStockList();
  } catch (error) {
    LoggerService.error('WebAppInventory', 'getBruryaStockList', error.message, error);
    throw error; // Re-throw to be caught by the client-side failure handler
  }
}

/**
 * Wraps the LookupService.searchComaxProducts function for client-side access.
 * @param {string} searchTerm The term to search for.
 * @returns {Array<Object>} A list of matching products.
 */
function WebAppInventory_searchComaxProducts(searchTerm) {
  try {
    const lookupService = new LookupService();
    return lookupService.searchComaxProducts(searchTerm);
  } catch (error) {
    LoggerService.error('WebAppInventory', 'searchComaxProducts', error.message, error);
    throw error;
  }
}

/**
 * Wraps the InventoryManagementService.setBruryaQuantity function for client-side access.
 * @param {string} sku The SKU of the product to update.
 * @param {number} quantity The new quantity to set.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_setBruryaQuantity(sku, quantity) {
  try {
    const inventoryManagementService = InventoryManagementService;
    return inventoryManagementService.setBruryaQuantity(sku, quantity);
  } catch (error) {
    LoggerService.error('WebAppInventory', 'setBruryaQuantity', error.message, error);
    throw error;
  }
}

/**
 * Retrieves the number of open inventory count tasks for the current manager.
 * This is used to display a count badge in the Manager's inventory view.
 * @returns {number} The number of open 'task.inventory.count' tasks.
 */
function WebAppInventory_getManagerTaskCount() {
  try {
    // This assumes the task type 'task.inventory.count' corresponds to tasks assigned to managers.
    return WebAppTasks.getOpenTasksByTypeId('task.inventory.count').length;
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getManagerTaskCount', e.message, e);
    return 0; // Return 0 on error to prevent UI issues.
  }
}

/**
 * Retrieves the list of products that a manager needs to count, based on open 'task.inventory.count' tasks.
 * Includes product details (name) and any existing count from SysProductAudit.
 * @returns {Array<Object>} An array of product objects to count, e.g., [{ taskId, sku, productName, currentCount }]
 */
function WebAppInventory_getProductsForCount() {
  try {
    const allConfig = ConfigService.getAllConfig();

    const cmxProdMHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
    const sysProductAuditHeaders = allConfig['schema.data.SysProductAudit'].headers.split(',');
    
    // Get both types of inventory count tasks
    const inventoryCountTasks = WebAppTasks.getOpenTasksByTypeId('task.inventory.count');
    const negativeInventoryTasks = WebAppTasks.getOpenTasksByTypeId('task.validation.comax_internal_audit');
    
    // Combine the task lists
    const allCountTasks = inventoryCountTasks.concat(negativeInventoryTasks);
    
    // Load CmxProdM (Comax Product Master) to get product names by SKU
    const cmxProdMData = ConfigService._getSheetDataAsMap('CmxProdM', cmxProdMHeaders, 'cpm_SKU');
    const cmxProdMMap = cmxProdMData.map;

    // Load SysProductAudit to get any existing counts by SKU
    const sysProductAuditData = ConfigService._getSheetDataAsMap('SysProductAudit', sysProductAuditHeaders, 'pa_SKU');
    const sysProductAuditMap = sysProductAuditData.map;

    const productsToCount = allCountTasks.map(task => {
      const sku = String(task.st_LinkedEntityId).trim();
      const productName = cmxProdMMap.has(sku) ? cmxProdMMap.get(sku).cpm_NameHe : 'Unknown Product';
      
      if (!cmxProdMMap.has(sku)) {
        LoggerService.warn('WebAppInventory', 'getProductsForCount', `SKU from task not found in CmxProdM: ${sku}`);
      }

      // Assuming 'pa_OfficeQty' is the general physical count column.
      const auditEntry = sysProductAuditMap.has(sku) ? sysProductAuditMap.get(sku) : {};
      
      const comaxStockFromMaster = cmxProdMMap.has(sku) ? cmxProdMMap.get(sku).cpm_Stock || 0 : 0;
      const bruryaQty = auditEntry.pa_BruryaQty || 0;
      const storageQty = auditEntry.pa_StorageQty || 0;
      const officeQty = auditEntry.pa_OfficeQty || 0;
      const shopQty = auditEntry.pa_ShopQty || 0;

      const totalQty = bruryaQty + storageQty + officeQty + shopQty;

      return {
        taskId: task.st_TaskId,
        sku: sku,
        productName: productName,
        comaxQty: comaxStockFromMaster, // Changed to cpm_Stock
        totalQty: totalQty,
        bruryaQty: bruryaQty,
        storageQty: storageQty,
        officeQty: officeQty,
        shopQty: shopQty
      };
    });

    // Sort by product name for consistent display
    productsToCount.sort((a, b) => a.productName.localeCompare(b.productName));

    return productsToCount;
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getProductsForCount', e.message, e);
    return { error: `Could not load products for count: ${e.message}` };
  }
}

/**
 * Submits inventory counts for multiple products and completes their associated tasks.
 * @param {Array<Object>} selectedCounts An array of objects, each containing { taskId, sku, storageQty, officeQty, shopQty }.
 * @returns {Object} A result object indicating success and number of updated items.
 */
function WebAppInventory_submitInventoryCounts(selectedCounts) {
  try {
    const inventoryManagementService = InventoryManagementService;
    let updatedCount = 0;
    
    selectedCounts.forEach(item => {
      // Pass the complete item object including taskId, sku, and all quantities
      const updateResult = inventoryManagementService.updatePhysicalCounts(item); 
      if (updateResult.success) {
        TaskService.completeTask(item.taskId); // Mark the task as Done.
        updatedCount++;
      } else {
        LoggerService.warn('WebAppInventory', 'submitInventoryCounts', `Failed to update count for SKU ${item.sku}. Task ${item.taskId} not completed.`);
      }
    });

    return { success: true, updated: updatedCount };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'submitInventoryCounts', e.message, e);
    throw e;
  }
}

/**
 * Wraps the InventoryManagementService.updateBruryaInventory function for client-side access.
 * @param {Array<Object>} inventoryData The inventory data to save.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_updateBruryaInventory(inventoryData) {
  try {
    const inventoryManagementService = InventoryManagementService;
    return inventoryManagementService.updateBruryaInventory(inventoryData);
  } catch (error) {
    LoggerService.error('WebAppInventory', 'updateBruryaInventory', error.message, error);
    throw error;
  }
}