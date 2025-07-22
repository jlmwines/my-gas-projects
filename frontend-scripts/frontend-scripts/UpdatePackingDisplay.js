/**
 * @file updatePackingDisplay.gs
 * @description Displays only orders marked 'Created' in packing_slip_printed field.
 * @version 2025-07-21-0952
 */

function updatePackingDisplay() {
  const frontendSS = SpreadsheetApp.getActiveSpreadsheet();
  const displaySheet = frontendSS.getSheetByName("PackingDisplay") || frontendSS.insertSheet("PackingDisplay");

  const ordersM_sheet = getReferenceSheet("OrdersM");
  const orderLog_sheet = getReferenceSheet("OrderLog");

  const ordersData = ordersM_sheet.getDataRange().getValues();
  const headers = ordersData.shift();

  const orderLogData = orderLog_sheet.getDataRange().getValues();
  const logHeaders = orderLogData.shift().map(h => String(h).trim().replace(/\uFEFF/g, ''));
  const logOrderIdIndex = logHeaders.indexOf("order_id");
  const logPrintedFlagIndex = logHeaders.indexOf("packing_slip_printed");

  const createdOrderIds = new Set();
  const printStatusMap = new Map();

  orderLogData.forEach(row => {
    const orderId = String(row[logOrderIdIndex]).trim();
    const statusText = String(row[logPrintedFlagIndex] || "").trim().toLowerCase();
    if (orderId && statusText === "created") {
      createdOrderIds.add(orderId);
      printStatusMap.set(orderId, "Created");
    }
  });

  const outputHeaders = [
    "Order Date", "Order Number", "Order Status", "Print Status",
    "Shipping City", "Shipping Name", "Shipping Address1", "Shipping Address2",
    "Shipping Phone", "Customer Note", "Customer Name", "Customer Phone", "Customer Email"
  ];
  const outputRows = [outputHeaders];

  const indices = {
    orderId: headers.indexOf("order_id"),
    orderDate: headers.indexOf("order_date"),
    orderNumber: headers.indexOf("order_number"),
    status: headers.indexOf("status"),
    shippingCity: headers.indexOf("shipping_city"),
    firstName: headers.indexOf("shipping_first_name"),
    lastName: headers.indexOf("shipping_last_name"),
    address1: headers.indexOf("shipping_address_1"),
    address2: headers.indexOf("shipping_address_2"),
    billingPhone: headers.indexOf("billing_phone"),
    billingEmail: headers.indexOf("billing_email"),
    customerNote: 46
  };

  ordersData.forEach(row => {
    const orderId = String(row[indices.orderId]).trim();
    if (!createdOrderIds.has(orderId)) return;

    const shippingName = `${row[indices.firstName]} ${row[indices.lastName]}`.trim();
    const customerName = shippingName;

    const outputRow = [
      row[indices.orderDate],
      row[indices.orderNumber],
      row[indices.status],
      printStatusMap.get(orderId),
      row[indices.shippingCity],
      shippingName,
      row[indices.address1],
      row[indices.address2],
      row[indices.billingPhone],
      row[indices.customerNote],
      customerName,
      row[indices.billingPhone],
      row[indices.billingEmail]
    ];
    outputRows.push(outputRow);
  });

  displaySheet.clear();
  displaySheet.getRange(1, 1, outputRows.length, outputHeaders.length).setValues(outputRows);
  SpreadsheetApp.getActiveSpreadsheet().toast("PackingDisplay updated.", "Ready to Print", 3);
}
