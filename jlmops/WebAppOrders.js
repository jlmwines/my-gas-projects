/**
 * @file WebAppOrders.js
 * @description This script acts as a Data Provider for all order-related data.
 * It contains reusable functions for fetching and preparing order data from the
 * backend services (e.g., OrderService) for consumption by UI View Controllers.
 */

// eslint-disable-next-line no-unused-vars
const WebAppOrders = (() => {
  /**
   * Gets all data required for the Admin Orders Widget.
   * @returns {Object} An object containing counts and tasks for the orders widget.
   */
  const getOrdersWidgetData = () => {
    try {
      const orderService = new OrderService(ProductService);
      const comaxExportOrderCount = orderService.getComaxExportOrderCount();
      const onHoldCount = orderService.getOnHoldOrderCount();
      const processingCount = orderService.getProcessingOrderCount();
      const packingSlipsReadyCount = orderService.getPackingSlipsReadyCount();

      const openComaxConfirmationTasks = WebAppTasks.getOpenTasksByTypeId('task.confirmation.comax_order_export').map(task => ({
        id: task.st_TaskId,
        title: task.st_Title,
        notes: task.st_Notes
      }));

      return {
        comaxExportOrderCount: comaxExportOrderCount,
        onHoldCount: onHoldCount,
        processingCount: processingCount,
        packingSlipsReadyCount: packingSlipsReadyCount,
        openComaxConfirmationTasks: openComaxConfirmationTasks
      };
    } catch (e) {
      LoggerService.error('WebAppOrders', 'getOrdersWidgetData', e.message, e);
      return { error: 'Could not load order data.' };
    }
  };

  /**
   * Triggers the backend service to generate the Comax Order Export file.
   * @returns {Object} A result object, { success: true } or { success: false, error: message }.
   */
  // const triggerComaxOrdersExport = () => {
  //   try {
  //     // ProductService is a global singleton, so we can pass it directly.
  //     const orderService = new OrderService(ProductService);
  //     orderService.exportOrdersToComax();
  //     return { success: true };
  //   } catch (e) {
  //     LoggerService.error('WebAppOrders', 'triggerComaxOrdersExport', `Error triggering Comax export: ${e.message}`, e);
  //     return { success: false, error: e.message };
  //   }
  // };

  return {
    getOrdersWidgetData,
    // triggerComaxOrdersExport,
  };
})();