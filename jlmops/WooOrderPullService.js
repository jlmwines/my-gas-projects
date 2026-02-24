/**
 * @file WooOrderPullService.js
 * @description Automated WooCommerce order pull replacing manual CSV exports.
 *
 * Pulls orders via WooApiService, transforms JSON to internal order format,
 * handles deduplication, and feeds into existing OrderService pipeline.
 * Runs independently of the sync state machine (no sync session required).
 */

const WooOrderPullService = (function() {
  const SERVICE_NAME = 'WooOrderPullService';

  /**
   * Main entry point: pull recent orders from WooCommerce.
   * Uses modified_after from last pull timestamp for incremental updates.
   *
   * @returns {object} { success, orderCount, message }
   */
  function pullOrders() {
    var functionName = 'pullOrders';
    var sessionId = generateSessionId();
    logger.info(SERVICE_NAME, functionName, 'Starting automated order pull', { sessionId: sessionId });

    try {
      // Get last pull timestamp for incremental pull
      var apiConfig = ConfigService.getConfig('woo.api');
      var lastPull = apiConfig ? apiConfig.orders_last_pull : '';

      // Fetch orders from WooCommerce
      var apiOrders = WooApiService.fetchOrders(lastPull || undefined);
      logger.info(SERVICE_NAME, functionName, 'Received ' + apiOrders.length + ' orders from API' + (lastPull ? ' (modified after ' + lastPull + ')' : ' (full pull)'), { sessionId: sessionId });

      if (apiOrders.length === 0) {
        var noOrdersMsg = 'No new or modified orders found';
        logger.info(SERVICE_NAME, functionName, noOrdersMsg, { sessionId: sessionId });
        ConfigService.setConfig('woo.api', 'orders_last_pull', new Date().toISOString());
        return { success: true, orderCount: 0, message: noOrdersMsg };
      }

      // Transform API orders to internal format
      var transformedOrders = [];
      for (var i = 0; i < apiOrders.length; i++) {
        var transformed = _transformApiOrder(apiOrders[i]);
        if (transformed) {
          transformedOrders.push(transformed);
        }
      }

      logger.info(SERVICE_NAME, functionName, 'Transformed ' + transformedOrders.length + ' orders', { sessionId: sessionId });

      // Write to staging sheet
      _writeOrdersToStaging(transformedOrders, sessionId);

      // Run validation
      var validationResult = ValidationLogic.runValidationSuite('order_staging', sessionId);
      if (!validationResult.success || validationResult.results.some(function(r) { return r.status === 'FAILED'; })) {
        throw new Error('Order staging validation failed. Check validation results.');
      }

      // Process staged orders using existing OrderService pipeline
      _triggerExistingPipeline(transformedOrders, sessionId);

      // Update last pull timestamp
      ConfigService.setConfig('woo.api', 'orders_last_pull', new Date().toISOString());

      var message = 'Order pull complete: ' + transformedOrders.length + ' orders processed';
      logger.info(SERVICE_NAME, functionName, message, { sessionId: sessionId });

      return { success: true, orderCount: transformedOrders.length, message: message };

    } catch (e) {
      logger.error(SERVICE_NAME, functionName, 'Order pull failed: ' + e.message, e, { sessionId: sessionId });
      return { success: false, orderCount: 0, message: 'Failed: ' + e.message };
    }
  }

  /**
   * Transform a single Woo API order object to internal staging format.
   * Maps flat fields and transforms line items.
   *
   * @param {object} apiOrder - WooCommerce REST API order object
   * @returns {object|null} Order in wos_* format with lineItems array, or null if invalid
   */
  function _transformApiOrder(apiOrder) {
    if (!apiOrder || !apiOrder.id) return null;

    var order = {};

    // Direct field mappings
    order.wos_OrderId = String(apiOrder.id);
    order.wos_OrderNumber = String(apiOrder.number || apiOrder.id);
    order.wos_OrderDate = apiOrder.date_created || '';
    order.wos_PaidDate = apiOrder.date_paid || '';
    order.wos_Status = apiOrder.status || '';
    order.wos_OrderTotal = apiOrder.total || '';
    order.wos_DiscountTotal = apiOrder.discount_total || '';
    order.wos_ShippingTotal = apiOrder.shipping_total || '';
    order.wos_CustomerNote = apiOrder.customer_note || '';
    order.wos_CustomerUser = apiOrder.customer_id ? String(apiOrder.customer_id) : '';
    order.wos_OrderSubtotal = apiOrder.subtotal || '';
    order.wos_OrderCurrency = apiOrder.currency || '';
    order.wos_PaymentMethod = apiOrder.payment_method || '';
    order.wos_PaymentMethodTitle = apiOrder.payment_method_title || '';
    order.wos_TransactionId = apiOrder.transaction_id || '';
    order.wos_ShippingMethod = (apiOrder.shipping_lines && apiOrder.shipping_lines.length > 0) ? apiOrder.shipping_lines[0].method_title : '';

    // Billing fields
    var billing = apiOrder.billing || {};
    order.wos_BillingFirstName = billing.first_name || '';
    order.wos_BillingLastName = billing.last_name || '';
    order.wos_BillingCompany = billing.company || '';
    order.wos_BillingEmail = billing.email || '';
    order.wos_BillingPhone = billing.phone || '';
    order.wos_BillingAddress1 = billing.address_1 || '';
    order.wos_BillingAddress2 = billing.address_2 || '';
    order.wos_BillingPostcode = billing.postcode || '';
    order.wos_BillingCity = billing.city || '';
    order.wos_BillingState = billing.state || '';
    order.wos_BillingCountry = billing.country || '';
    order.wos_CustomerEmail = billing.email || '';

    // Shipping fields
    var shipping = apiOrder.shipping || {};
    order.wos_ShippingFirstName = shipping.first_name || '';
    order.wos_ShippingLastName = shipping.last_name || '';
    order.wos_ShippingCompany = shipping.company || '';
    order.wos_ShippingPhone = shipping.phone || '';
    order.wos_ShippingAddress1 = shipping.address_1 || '';
    order.wos_ShippingAddress2 = shipping.address_2 || '';
    order.wos_ShippingPostcode = shipping.postcode || '';
    order.wos_ShippingCity = shipping.city || '';
    order.wos_ShippingState = shipping.state || '';
    order.wos_ShippingCountry = shipping.country || '';

    // WPML language from meta
    order.wos_MetaWpmlLanguage = _getMetaValue(apiOrder.meta_data, 'wpml_language') || '';

    // Coupon items
    if (apiOrder.coupon_lines && apiOrder.coupon_lines.length > 0) {
      order.wos_CouponItems = apiOrder.coupon_lines.map(function(c) { return c.code; }).join(', ');
    } else {
      order.wos_CouponItems = '';
    }

    // Transform line items
    order.lineItems = _transformLineItems(apiOrder.line_items || []);

    // Also populate the flat wos_Product_Item_N_* fields for staging sheet compatibility
    _populateFlatLineItemFields(order, apiOrder.line_items || []);

    return order;
  }

  /**
   * Transform Woo API line items to internal woi_* format.
   * Key advantage: API returns product_id directly — no SKU lookup needed.
   *
   * @param {Array} apiLineItems - Array of Woo API line_item objects
   * @returns {Array} Line items in internal format
   */
  function _transformLineItems(apiLineItems) {
    var items = [];
    for (var i = 0; i < apiLineItems.length; i++) {
      var item = apiLineItems[i];
      items.push({
        SKU: item.sku || '',
        Name: item.name || '',
        Quantity: String(item.quantity || 0),
        Total: item.total || '',
        Subtotal: item.subtotal || '',
        // API gives product_id directly — no SKU-to-WebId lookup needed!
        id: String(item.product_id || '')
      });
    }
    return items;
  }

  /**
   * Populate flat wos_Product_Item_N_* fields for staging sheet compatibility.
   * The staging sheet expects flattened line items in numbered columns.
   *
   * @param {object} order - Order object to populate
   * @param {Array} apiLineItems - Raw API line items
   */
  function _populateFlatLineItemFields(order, apiLineItems) {
    for (var i = 0; i < Math.min(apiLineItems.length, 24); i++) {
      var num = i + 1;
      var item = apiLineItems[i];
      order['wos_Product_Item_' + num + '_Name'] = item.name || '';
      order['wos_Product_Item_' + num + '_id'] = String(item.product_id || '');
      order['wos_Product_Item_' + num + '_SKU'] = item.sku || '';
      order['wos_Product_Item_' + num + '_Quantity'] = String(item.quantity || 0);
      order['wos_Product_Item_' + num + '_Total'] = item.total || '';
      order['wos_Product_Item_' + num + '_Subtotal'] = item.subtotal || '';
    }
  }

  /**
   * Write transformed orders to WebOrdS staging sheet.
   * @param {Array} orders - Transformed order objects
   * @param {string} sessionId
   */
  function _writeOrdersToStaging(orders, sessionId) {
    var functionName = '_writeOrdersToStaging';
    var allConfig = ConfigService.getAllConfig();
    var sheetNames = allConfig['system.sheet_names'];

    var spreadsheet = SheetAccessor.getDataSpreadsheet();
    var stagingSheet = spreadsheet.getSheetByName(sheetNames.WebOrdS);
    if (!stagingSheet) {
      throw new Error('Sheet WebOrdS not found in JLMops_Data spreadsheet.');
    }

    var stagingHeaders = stagingSheet.getRange(1, 1, 1, stagingSheet.getLastColumn()).getValues()[0];
    var stagingData = orders.map(function(order) {
      return stagingHeaders.map(function(header) {
        return order[header] || '';
      });
    });

    // Clear previous data rows
    if (stagingSheet.getMaxRows() > 1) {
      stagingSheet.getRange(2, 1, stagingSheet.getMaxRows() - 1, stagingSheet.getMaxColumns()).clearContent();
    }

    // Write new data
    if (stagingData.length > 0) {
      stagingSheet.getRange(2, 1, stagingData.length, stagingData[0].length).setValues(stagingData);
    }

    SpreadsheetApp.flush();
    logger.info(SERVICE_NAME, functionName, 'Wrote ' + stagingData.length + ' orders to WebOrdS staging', { sessionId: sessionId });
  }

  /**
   * Trigger existing OrderService processing pipeline.
   * Creates a lightweight execution context and calls processStagedOrders.
   *
   * @param {Array} transformedOrders - Orders with lineItems
   * @param {string} sessionId
   */
  function _triggerExistingPipeline(transformedOrders, sessionId) {
    var functionName = '_triggerExistingPipeline';
    logger.info(SERVICE_NAME, functionName, 'Feeding ' + transformedOrders.length + ' orders into existing pipeline', { sessionId: sessionId });

    // Create a lightweight execution context for OrderService
    var executionContext = {
      sessionId: sessionId,
      jobType: 'woo_api.orders',
      jobId: 'API-' + sessionId
    };

    // The existing processStagedOrders expects orders in the format from importWebOrdersToStaging.
    // Our transformed orders already have the right structure (wos_* fields + lineItems).
    var orderService = new OrderService(ProductService);
    orderService.processStagedOrders(transformedOrders, executionContext);

    logger.info(SERVICE_NAME, functionName, 'Order pipeline processing complete', { sessionId: sessionId });
  }

  /**
   * Get a meta_data value by key.
   * @param {Array} metaData - Array of { key, value } objects
   * @param {string} key - Meta key
   * @returns {*} Meta value or null
   */
  function _getMetaValue(metaData, key) {
    if (!metaData || !Array.isArray(metaData)) return null;
    for (var i = 0; i < metaData.length; i++) {
      if (metaData[i].key === key) {
        return metaData[i].value;
      }
    }
    return null;
  }

  return {
    pullOrders: pullOrders
  };
})();

/**
 * Global function for time-driven trigger or manual execution from Apps Script editor.
 * @returns {object} Pull result
 */
function pullWooOrders() {
  return WooOrderPullService.pullOrders();
}
