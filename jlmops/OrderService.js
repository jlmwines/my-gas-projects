/**
 * @file OrderService.js
 * @description This service manages orders.
 */

/**
 * OrderService provides methods for managing order data.
 */
function OrderService() {
  const ORDER_SHEET_NAME = "WebOrdM"; // Assuming WebOrdM is the master order sheet
  const ORDER_ITEMS_SHEET_NAME = "WebOrdItemsM"; // Assuming WebOrdItemsM for order line items

  /**
   * Retrieves all orders from the order sheet.
   * @returns {Array<Object>} An array of order objects.
   */
  this.getAllOrders = function() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(ORDER_SHEET_NAME);

      if (!sheet) {
        logger.error(`Order sheet '${ORDER_SHEET_NAME}' not found.`);
        return [];
      }

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length === 0) {
        logger.info(`No data found in order sheet '${ORDER_SHEET_NAME}'.`);
        return [];
      }

      const headers = values[0];
      const orders = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const order = {};
        headers.forEach((header, index) => {
          order[header] = row[index];
        });
        orders.push(order);
      }

      logger.info(`Successfully retrieved ${orders.length} orders from '${ORDER_SHEET_NAME}'.`);
      return orders;

    } catch (e) {
      logger.error(`Error getting all orders: ${e.message}`, e);
      return [];
    }
  };

  /**
   * Retrieves a single order by its ID.
   * @param {string} orderId The ID of the order to retrieve.
   * @returns {Object|null} The order object if found, otherwise null.
   */
  this.getOrderById = function(orderId) {
    try {
      const orders = this.getAllOrders(); // For simplicity, fetch all and filter
      const order = orders.find(o => o.ID === orderId || o.OrderNumber === orderId); // Assuming 'ID' or 'OrderNumber' as identifier

      if (order) {
        logger.info(`Found order with ID/OrderNumber: ${orderId}`);
      } else {
        logger.warn(`Order with ID/OrderNumber: ${orderId} not found.`);
      }
      return order || null;

    } catch (e) {
      logger.error(`Error getting order by ID ${orderId}: ${e.message}`, e);
      return null;
    }
  };

  /**
   * Retrieves order items for a given order ID.
   * This is a placeholder and needs full implementation.
   * @param {string} orderId The ID of the order whose items to retrieve.
   * @returns {Array<Object>} An array of order item objects.
   */
  this.getOrderItems = function(orderId) {
    logger.info(`Attempting to retrieve items for order ID: ${orderId}. (Placeholder: Full implementation needed)`);
    // TODO: Implement logic to fetch order items from ORDER_ITEMS_SHEET_NAME
    // Filter by orderId
    return [];
  };

  // TODO: Add methods for updating order status, creating new orders, etc.
  // this.updateOrderStatus = function(orderId, newStatus) { ... };
  // this.createOrder = function(orderData) { ... };
}

// Global instance for easy access throughout the project
const orderService = new OrderService();