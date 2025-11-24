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
    return inventoryManagementService.getBruryaStockList();
  } catch (error) {
    LoggerService.error('WebAppInventory', 'getBruryaStockList', error.message, error);
    throw error; // Re-throw to be caught by the client-side failure handler
  }
}