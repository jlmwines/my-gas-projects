/**
 * @file WebAppOrders.js
 * @description Provides backend functions for the Orders dashboard widget and view.
 * This script is responsible for gathering order-related data for the UI without modifying core services.
 */

const WebAppOrders = (function() {

  /**
   * Gathers various order-related metrics for the Admin Orders widget.
   * @returns {Object} An object containing order metrics.
   */
  function getOrdersWidgetData() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);

    if (!logSheet) {
      throw new Error("Required sheet 'SysOrdLog' not found.");
    }

    const logData = logSheet.getDataRange().getValues();
    const logHeaders = logData.shift(); // Remove headers
    const orderStatusCol = logHeaders.indexOf('sol_OrderStatus');
    const packingStatusCol = logHeaders.indexOf('sol_PackingStatus');

    if (orderStatusCol === -1 || packingStatusCol === -1) {
      throw new Error("Could not find 'sol_OrderStatus' or 'sol_PackingStatus' columns in SysOrdLog sheet.");
    }

    let onHoldCount = 0;
    let processingCount = 0;
    let packingSlipsToPrintCount = 0;

    logData.forEach(row => {
      const orderStatus = String(row[orderStatusCol] || '').trim().toLowerCase();
      const packingStatus = String(row[packingStatusCol] || '').trim();

      if (orderStatus === 'on-hold') {
        onHoldCount++;
      } else if (orderStatus === 'processing') {
        processingCount++;
      }

      if (packingStatus === 'Ready') {
        packingSlipsToPrintCount++;
      }
    });

    // Get Comax export count from OrderService (existing getter, not modifying core logic)
    const orderService = new OrderService(ProductService); // ProductService is a dependency for OrderService
    const comaxExportOrderCount = orderService.getComaxExportOrderCount();

    return {
      packingSlipsToPrint: packingSlipsToPrintCount,
      comaxExportOrderCount: comaxExportOrderCount,
      onHoldOrders: onHoldCount,
      processingOrders: processingCount
    };
  }

  return {
    getOrdersWidgetData: getOrdersWidgetData
  };

})();
