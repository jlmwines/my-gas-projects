/**
 * @file WebAppInventory.js
 * @description This script acts as a Data Provider for all inventory-related data,
 * following the architecture plan.
 */

// eslint-disable-next-line no-unused-vars
const WebAppInventory = (() => {

  /**
   * Gets all data required for the Admin Inventory Widget.
   * @returns {Object} An object containing counts and tasks for the inventory widget.
   */
  const getInventoryWidgetData = () => {
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
  };

  return {
    getInventoryWidgetData: getInventoryWidgetData
  };
})();
