/**
 * @file WebAppDashboard.js
 * @description Aggregator for dashboard data to minimize round trips.
 */

/**
 * Aggregates data for the Admin Dashboard from all relevant providers.
 * @returns {Object} A composite object containing data for System, Orders, Inventory, and Products widgets.
 */
function WebAppDashboard_getAdminDashboardData() {
  const serviceName = 'WebAppDashboard';
  const functionName = 'getAdminDashboardData';
  LoggerService.info(serviceName, functionName, 'Starting aggregation of admin dashboard data...');

  try {
    // Execute fetching in parallel logic (sequential in GAS but grouped)
    let systemHealth, ordersData, inventoryData, productsData;

    try {
        systemHealth = WebAppSystem_getSystemHealthDashboardData();
    } catch (e) {
        LoggerService.error(serviceName, functionName, `System Health fetch failed: ${e.message}`);
        systemHealth = { error: e.message };
    }

    try {
        ordersData = WebAppOrders_getOrdersWidgetData();
    } catch (e) {
        LoggerService.error(serviceName, functionName, `Orders fetch failed: ${e.message}`);
        ordersData = { error: e.message };
    }

    try {
        inventoryData = WebAppInventory_getInventoryWidgetData(systemHealth);
    } catch (e) {
        LoggerService.error(serviceName, functionName, `Inventory fetch failed: ${e.message}`);
        inventoryData = { error: e.message };
    }

    try {
        productsData = WebAppProducts_getProductsWidgetData();
    } catch (e) {
        LoggerService.error(serviceName, functionName, `Products fetch failed: ${e.message}`);
        productsData = { error: e.message };
    }

    LoggerService.info(serviceName, functionName, 'Aggregation complete.');

    return {
      success: true,
      system: systemHealth,
      orders: ordersData,
      inventory: inventoryData,
      products: productsData
    };

  } catch (e) {
    LoggerService.error(serviceName, functionName, `Aggregation failed: ${e.message}`, e);
    return {
      success: false,
      error: e.message
    };
  }
}
