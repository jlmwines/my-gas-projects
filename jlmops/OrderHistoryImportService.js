/**
 * @file OrderHistoryImportService.js
 * @description Imports historical orders from WooCommerce export CSV.
 * Populates WebOrdM_Archive and WebOrdItemsM_Archive sheets.
 */

const OrderHistoryImportService = (function () {
  const SERVICE_NAME = 'OrderHistoryImportService';

  // Archive sheet names
  const ORDERS_ARCHIVE_SHEET = 'WebOrdM_Archive';
  const ITEMS_ARCHIVE_SHEET = 'WebOrdItemsM_Archive';

  // Order headers for archive (must match schema.data.WebOrdM_Archive)
  const ORDER_HEADERS = [
    'woma_OrderId', 'woma_OrderNumber', 'woma_OrderDate', 'woma_Status',
    'woma_CustomerNote',
    'woma_BillingFirstName', 'woma_BillingLastName', 'woma_BillingEmail', 'woma_BillingPhone',
    'woma_ShippingFirstName', 'woma_ShippingLastName', 'woma_ShippingAddress1',
    'woma_ShippingAddress2', 'woma_ShippingCity', 'woma_ShippingPhone',
    'woma_CouponItems', 'woma_OrderTotal'
  ];

  // Items headers for archive
  const ITEMS_HEADERS = [
    'woia_OrderItemId', 'woia_OrderId', 'woia_WebIdEn', 'woia_SKU',
    'woia_Name', 'woia_Quantity', 'woia_ItemTotal', 'woia_UnitPrice'
  ];

  /**
   * Gets or creates the archive sheet.
   * @param {Spreadsheet} spreadsheet - Spreadsheet object
   * @param {string} sheetName - Sheet name
   * @param {Array} headers - Header row
   * @returns {Sheet} Sheet object
   */
  function _getOrCreateSheet(spreadsheet, sheetName, headers) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      LoggerService.info(SERVICE_NAME, '_getOrCreateSheet', `Created sheet: ${sheetName}`);
    }
    return sheet;
  }

  /**
   * Gets existing order IDs from current and archive sheets.
   * @param {Spreadsheet} spreadsheet - Spreadsheet object
   * @returns {Set} Set of existing order IDs
   */
  function _getExistingOrderIds(spreadsheet) {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];

    const existingIds = new Set();

    // Check current WebOrdM
    const currentSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (currentSheet && currentSheet.getLastRow() > 1) {
      const data = currentSheet.getRange(2, 1, currentSheet.getLastRow() - 1, 1).getValues();
      data.forEach(row => {
        if (row[0]) existingIds.add(String(row[0]));
      });
    }

    // Check archive
    const archiveSheet = spreadsheet.getSheetByName(ORDERS_ARCHIVE_SHEET);
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      const data = archiveSheet.getRange(2, 1, archiveSheet.getLastRow() - 1, 1).getValues();
      data.forEach(row => {
        if (row[0]) existingIds.add(String(row[0]));
      });
    }

    return existingIds;
  }

  /**
   * Gets existing item IDs from current and archive sheets.
   * @param {Spreadsheet} spreadsheet - Spreadsheet object
   * @returns {Set} Set of existing order item IDs
   */
  function _getExistingItemIds(spreadsheet) {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];

    const existingIds = new Set();

    // Check current WebOrdItemsM
    const currentSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
    if (currentSheet && currentSheet.getLastRow() > 1) {
      const data = currentSheet.getRange(2, 1, currentSheet.getLastRow() - 1, 1).getValues();
      data.forEach(row => {
        if (row[0]) existingIds.add(String(row[0]));
      });
    }

    // Check archive
    const archiveSheet = spreadsheet.getSheetByName(ITEMS_ARCHIVE_SHEET);
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      const data = archiveSheet.getRange(2, 1, archiveSheet.getLastRow() - 1, 1).getValues();
      data.forEach(row => {
        if (row[0]) existingIds.add(String(row[0]));
      });
    }

    return existingIds;
  }

  /**
   * Parses line items from CSV row.
   * Handles both pipe-delimited line_item_N and Product Item N columns.
   * @param {Object} row - CSV row as object
   * @param {Array} headers - CSV headers
   * @param {string} orderId - Order ID
   * @returns {Array} Array of item objects
   */
  function _parseLineItems(row, headers, orderId) {
    const items = [];
    let itemIndex = 0;

    // Method 1: Parse line_item_N columns (pipe-delimited format)
    for (let i = 1; i <= 30; i++) {
      const key = `line_item_${i}`;
      const value = row[key];
      if (!value) continue;

      // Format: name:...|product_id:...|sku:...|quantity:...|total:...|sub_total:...
      const parts = {};
      String(value).split('|').forEach(part => {
        const colonIdx = part.indexOf(':');
        if (colonIdx > 0) {
          const k = part.substring(0, colonIdx).trim();
          const v = part.substring(colonIdx + 1).trim();
          parts[k] = v;
        }
      });

      if (parts.sku || parts.name) {
        itemIndex++;
        const qty = parseInt(parts.quantity, 10) || 1;
        const total = parseFloat(parts.total) || 0;
        items.push({
          orderItemId: `${orderId}-${itemIndex}`,
          orderId: orderId,
          webIdEn: parts.product_id || '',
          sku: parts.sku || '',
          name: parts.name || '',
          quantity: qty,
          itemTotal: total,
          unitPrice: qty > 0 ? Math.round((total / qty) * 100) / 100 : 0
        });
      }
    }

    // Method 2: Parse "Product Item N" columns (if line_item not found)
    if (items.length === 0) {
      for (let i = 1; i <= 30; i++) {
        const nameKey = `Product Item ${i} Name`;
        const name = row[nameKey];
        if (!name) continue;

        itemIndex++;
        const qty = parseInt(row[`Product Item ${i} Quantity`], 10) || 1;
        const total = parseFloat(row[`Product Item ${i} Total`]) || 0;

        items.push({
          orderItemId: `${orderId}-${itemIndex}`,
          orderId: orderId,
          webIdEn: row[`Product Item ${i} id`] || '',
          sku: row[`Product Item ${i} SKU`] || '',
          name: name,
          quantity: qty,
          itemTotal: total,
          unitPrice: qty > 0 ? Math.round((total / qty) * 100) / 100 : 0
        });
      }
    }

    return items;
  }

  /**
   * Imports orders from CSV content.
   * @param {string} csvContent - CSV file content
   * @param {Object} options - Import options
   * @param {boolean} options.skipExisting - Skip orders that already exist (default: true)
   * @returns {Object} Import results
   */
  function importFromCsv(csvContent, options = {}) {
    const fnName = 'importFromCsv';
    const skipExisting = options.skipExisting !== false;

    LoggerService.info(SERVICE_NAME, fnName, 'Starting order history import');

    const allConfig = ConfigService.getAllConfig();
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    // Get or create archive sheets
    const ordersSheet = _getOrCreateSheet(spreadsheet, ORDERS_ARCHIVE_SHEET, ORDER_HEADERS);
    const itemsSheet = _getOrCreateSheet(spreadsheet, ITEMS_ARCHIVE_SHEET, ITEMS_HEADERS);

    // Get existing order and item IDs
    const existingOrderIds = skipExisting ? _getExistingOrderIds(spreadsheet) : new Set();
    const existingItemIds = _getExistingItemIds(spreadsheet);
    LoggerService.info(SERVICE_NAME, fnName, `Found ${existingOrderIds.size} existing orders, ${existingItemIds.size} existing items`);

    // Parse CSV
    const rows = Utilities.parseCsv(csvContent);
    if (rows.length <= 1) {
      return { error: 'No data rows in CSV' };
    }

    const headers = rows[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    // Process rows
    const orderRows = [];
    const itemRows = [];
    let ordersSkipped = 0;
    let ordersImported = 0;
    let itemsSkipped = 0;
    let itemsImported = 0;
    const errors = [];

    LoggerService.info(SERVICE_NAME, fnName, `Processing ${rows.length - 1} CSV rows`);

    for (let i = 1; i < rows.length; i++) {
      // Progress log every 200 rows
      if (i % 200 === 0) {
        LoggerService.info(SERVICE_NAME, fnName, `Progress: ${i}/${rows.length - 1} rows, ${itemsImported} items imported`);
      }

      try {
        const csvRow = rows[i];
        const row = {};
        headers.forEach((h, idx) => row[h] = csvRow[idx]);

        const orderId = String(row['order_id'] || '').trim();
        if (!orderId) continue;

        // Skip cancelled/failed orders entirely
        const status = String(row['status'] || '').toLowerCase();
        if (['cancelled', 'failed', 'trash'].includes(status)) {
          ordersSkipped++;
          continue;
        }

        // Only add order row if it doesn't exist
        const orderExists = existingOrderIds.has(orderId);
        if (!orderExists) {
          const orderRow = [
            orderId,                                    // A: woma_OrderId
            row['order_number'] || orderId,             // B: woma_OrderNumber
            row['order_date'] || '',                    // C: woma_OrderDate
            row['status'] || '',                        // D: woma_Status
            row['customer_note'] || '',                 // E: woma_CustomerNote
            row['billing_first_name'] || '',            // F: woma_BillingFirstName
            row['billing_last_name'] || '',             // G: woma_BillingLastName
            row['billing_email'] || '',                 // H: woma_BillingEmail
            row['billing_phone'] || '',                 // I: woma_BillingPhone
            row['shipping_first_name'] || '',           // J: woma_ShippingFirstName
            row['shipping_last_name'] || '',            // K: woma_ShippingLastName
            row['shipping_address_1'] || '',            // L: woma_ShippingAddress1
            row['shipping_address_2'] || '',            // M: woma_ShippingAddress2
            row['shipping_city'] || '',                 // N: woma_ShippingCity
            row['shipping_phone'] || '',                // O: woma_ShippingPhone
            row['coupon_items'] || '',                  // P: woma_CouponItems
			parseFloat(row['order_total']) || 0         // Q: woma_OrderTotal
          ];
          orderRows.push(orderRow);
          existingOrderIds.add(orderId);
          ordersImported++;
        } else {
          ordersSkipped++;
        }

        // Always parse items - add only if they don't exist
        const items = _parseLineItems(row, headers, orderId);
        items.forEach(item => {
          if (existingItemIds.has(item.orderItemId)) {
            itemsSkipped++;
            return;
          }
          itemRows.push([
            item.orderItemId,
            item.orderId,
            item.webIdEn,
            item.sku,
            item.name,
            item.quantity,
            item.itemTotal,
            item.unitPrice
          ]);
          existingItemIds.add(item.orderItemId);
          itemsImported++;
        });

      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    // Write to sheets in batches
    if (orderRows.length > 0) {
      const startRow = ordersSheet.getLastRow() + 1;
      ordersSheet.getRange(startRow, 1, orderRows.length, ORDER_HEADERS.length).setValues(orderRows);
      LoggerService.info(SERVICE_NAME, fnName, `Wrote ${orderRows.length} orders to archive`);
    }

    if (itemRows.length > 0) {
      const startRow = itemsSheet.getLastRow() + 1;
      itemsSheet.getRange(startRow, 1, itemRows.length, ITEMS_HEADERS.length).setValues(itemRows);
      LoggerService.info(SERVICE_NAME, fnName, `Wrote ${itemRows.length} items to archive`);
    }

    LoggerService.info(SERVICE_NAME, fnName,
      `Import complete: ${ordersImported} orders imported, ${ordersSkipped} skipped, ${itemsImported} items imported, ${itemsSkipped} items skipped`);

    return {
      ordersImported: ordersImported,
      ordersSkipped: ordersSkipped,
      itemsImported: itemsImported,
      itemsSkipped: itemsSkipped,
      errors: errors
    };
  }

  /**
   * Imports orders from a Google Drive file.
   * @param {string} fileId - Google Drive file ID
   * @param {Object} options - Import options
   * @returns {Object} Import results
   */
  function importFromDriveFile(fileId, options = {}) {
    const fnName = 'importFromDriveFile';
    LoggerService.info(SERVICE_NAME, fnName, `Importing from file: ${fileId}`);

    try {
      const file = DriveApp.getFileById(fileId);
      const csvContent = file.getBlob().getDataAsString();
      return importFromCsv(csvContent, options);
    } catch (e) {
      LoggerService.error(SERVICE_NAME, fnName, `Failed to read file: ${e.message}`);
      return { error: e.message };
    }
  }

  // Public API
  return {
    importFromCsv: importFromCsv,
    importFromDriveFile: importFromDriveFile
  };
})();

/**
 * Global function to import order history from a Drive file.
 * @param {string} fileIdOrName - Google Drive file ID or filename (default: order_history_2025-12-16.csv)
 */
function runOrderHistoryImport(fileIdOrName) {
  const fileName = fileIdOrName || 'order_history_2025-12-16.csv';

  // If it looks like a filename (contains .), find it by name
  if (fileName.includes('.')) {
    const files = DriveApp.getFilesByName(fileName);
    if (!files.hasNext()) {
      throw new Error('File not found: ' + fileName);
    }
    const file = files.next();
    return OrderHistoryImportService.importFromDriveFile(file.getId());
  }

  // Otherwise treat as file ID
  return OrderHistoryImportService.importFromDriveFile(fileName);
}

/**
 * Global function to test with a sample of rows.
 * Reads first 100 orders from a Drive file.
 */
function testOrderHistoryImport(fileId) {
  if (!fileId) {
    throw new Error('Please provide a Google Drive file ID');
  }

  const file = DriveApp.getFileById(fileId);
  const csvContent = file.getBlob().getDataAsString();
  const rows = Utilities.parseCsv(csvContent);

  // Take header + first 100 data rows
  const sampleRows = rows.slice(0, 101);
  const sampleCsv = sampleRows.map(row => row.join(',')).join('\n');

  return OrderHistoryImportService.importFromCsv(sampleCsv);
}
