const LEGACY_EXPORT_FOLDER_ID = '1ZNCnL6ryYOyhFaErbZlGW_eTKoR6nUU5';
const LEGACY_REFERENCE_SPREADSHEET_ID = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc';

const ValidationService = {
  /**
   * Compares the on-hold inventory data between jlmops and the legacy system.
   */
  validateOnHoldInventory() {
    const serviceName = 'ValidationService';
    const functionName = 'validateOnHoldInventory';
    try {
      const legacyData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OnHoldInventory');
      const jlmopsData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'SysInventoryOnHold');

      const legacyMap = new Map(legacyData.map(row => [row['product SKU'], row['on hold quantity']]));
      const jlmopsMap = new Map(jlmopsData.map(row => [row.sio_SKU, row.sio_OnHoldQuantity]));

      let discrepancies = [];

      for (const [sku, legacyQuantity] of legacyMap.entries()) {
        const jlmopsQuantity = jlmopsMap.get(sku);
        if (jlmopsQuantity === undefined) {
          discrepancies.push(`Legacy SKU ${sku} with quantity ${legacyQuantity} not found in JLMops.`);
        } else if (jlmopsQuantity !== legacyQuantity) {
          discrepancies.push(`SKU ${sku}: Legacy quantity ${legacyQuantity} differs from JLMops quantity ${jlmopsQuantity}.`);
        }
      }

      for (const [sku, jlmopsQuantity] of jlmopsMap.entries()) {
        if (!legacyMap.has(sku)) {
          discrepancies.push(`JLMops SKU ${sku} with quantity ${jlmopsQuantity} not found in Legacy.`);
        }
      }

      if (discrepancies.length === 0) {
        const message = 'On-Hold Inventory validation successful. Data matches.';
        logger.info(serviceName, functionName, message);
        return message;
      } else {
        const message = `On-Hold Inventory validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' ')); // Log as a single line
        return message;
      }

    } catch (e) {
      const errorMessage = `Error during On-Hold Inventory validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Helper function to read data from a Google Sheet.
   * @param {string} spreadsheetId
   * @param {string} sheetName
   * @returns {Array<Object>}
   */
  readSheetData(spreadsheetId, sheetName) {
    const serviceName = 'ValidationService';
    const functionName = 'readSheetData';
    try {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found in spreadsheet ID '${spreadsheetId}'.`);
      }
      const range = sheet.getDataRange();
      const values = range.getValues();
      if (values.length === 0) {
        return [];
      }
      const headers = values[0];
      const data = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header] = row[index];
        });
        data.push(rowObject);
      }
      return data;
    } catch (e) {
      logger.error(serviceName, functionName, `Error reading sheet data: ${e.message}`, e);
      throw e; // Re-throw the error to be handled upstream
    }
  },

  /**
   * Compares the orders awaiting Comax export between jlmops and the legacy system.
   * This is a higher-level check than direct file comparison.
   */
  validateComaxExportConsistency() {
    const serviceName = 'ValidationService';
    const functionName = 'validateComaxExportConsistency';
    let report = [];

    try {
      // --- JLMops System ---
      const jlmopsDataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
      const sheetNames = ConfigService.getConfig('system.sheet_names');
      const jlmopsOrderLog = this.readSheetData(jlmopsDataSpreadsheetId, sheetNames.SysOrdLog);

      const jlmopsAwaitingExport = jlmopsOrderLog
        .filter(row => {
          const currentStatus = String(row.sol_OrderStatus || '').toLowerCase().trim();
          const notExported = !row.sol_ComaxExportTimestamp;
          return notExported && (currentStatus === 'processing' || currentStatus === 'completed');
        })
        .map(row => String(row.sol_OrderId));

      report.push('JLMops System:');
      report.push(`- Count: ${jlmopsAwaitingExport.length}`);
      if (jlmopsAwaitingExport.length > 0) {
        report.push(`- Orders: ${jlmopsAwaitingExport.join(', ')}`);
      }
      report.push(''); // Add a blank line for spacing


      // --- Legacy System ---
      const legacyOrdersM = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrdersM');
      const legacyOrderLog = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrderLog');

      const legacyStatusMap = new Map(legacyOrdersM.map(row => [
        String(row.order_id),
        String(row.status || '').toLowerCase().trim()
      ]));

      const legacyAwaitingExport = legacyOrderLog
        .filter(logRow => {
          const exportStatus = logRow.comax_export_status;
          if (exportStatus) { return false; } // Filter for null/empty

          const orderId = String(logRow.order_id);
          const currentStatus = legacyStatusMap.get(orderId);
          return currentStatus === 'processing' || currentStatus === 'completed';
        })
        .map(logRow => String(logRow.order_id));

      report.push('Legacy System:');
      report.push(`- Count: ${legacyAwaitingExport.length}`);
      if (legacyAwaitingExport.length > 0) {
        report.push(`- Orders: ${legacyAwaitingExport.join(', ')}`);
      }

    } catch (e) {
      const errorMessage = `Error during Comax Export data collection: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }

    const finalReport = report.join('\n');
    logger.info(serviceName, functionName, finalReport.replace(/\n/g, ' | '));
    return finalReport;
  },

  /**
   * Compares the Comax order export from jlmops with the latest one from the legacy system.
   */
  validateComaxOrderExport() {
    // First, run the new high-level consistency check.
    const consistencyResult = this.validateComaxExportConsistency();

    // The direct file comparison below is disabled in favor of the order-level check above.
    // It was found to be unreliable if the export processes were not run at the exact same time.
    /*
    const jlmopsExportConfig = ConfigService.getConfig('system.folder.jlmops_exports');
    if (!jlmopsExportConfig || !jlmopsExportConfig.id) {
      throw new Error('Configuration "system.folder.jlmops_exports" is missing or incomplete in SysConfig. Please ensure SetupConfig.js is correct and rebuildSysConfigFromSource() has been run.');
    }
    const jlmopsFolderId = jlmopsExportConfig.id;
    const legacyFileNamePattern = /OrderEx-\d{2}-\d{2}-\d{2}-\d{2}\.csv/;
    const jlmopsFileNamePattern = /ComaxExport_\d{2}-\d{2}-\d{2}-\d{2}\.csv/; // Updated pattern for jlmops export
    const fileCompareResult = this._validateCsvExport(LEGACY_EXPORT_FOLDER_ID, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, 'Comax Order Export', 'SKU', ['Quantity']);
    */

    // Return the result of the new validation.
    return consistencyResult;
  },

  /**
   * Compares the web product update export from jlmops with the latest one from the legacy system.
   */
  validateWebProductUpdate() {
    const jlmopsExportConfig = ConfigService.getConfig('system.folder.jlmops_exports');
    if (!jlmopsExportConfig || !jlmopsExportConfig.id) {
      throw new Error('Configuration "system.folder.jlmops_exports" is missing or incomplete in SysConfig. Please ensure SetupConfig.js is correct and rebuildSysConfigFromSource() has been run.');
    }
    const jlmopsFolderId = jlmopsExportConfig.id;
    const legacyFileNamePattern = /ProductInventory-\d{2}-\d{2}-\d{2}-\d{2}\.csv/;
    const jlmopsFileNamePattern = /ProductInventory_\d{2}-\d{2}-\d{2}-\d{2}\.csv/;

    return this._validateCsvExport(LEGACY_EXPORT_FOLDER_ID, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, 'Web Product Update', 'SKU', ['Stock', 'Regular Price']);
  },

  /**
   * Orchestrates the validation of a CSV export.
   * @param {string} legacyFolderId
   * @param {RegExp} legacyFileNamePattern
   * @param {string} jlmopsFolderId
   * @param {RegExp} jlmopsFileNamePattern
   * @param {string} validationName
   * @param {string} keyColumn The name of the column to use as a primary key.
   * @param {Array<string>} columnsToCompare The names of the columns to compare.
   */
  _validateCsvExport(legacyFolderId, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, validationName, keyColumn, columnsToCompare) {
    const serviceName = 'ValidationService';
    const functionName = '_validateCsvExport';
    try {
      const legacyFile = this._getLatestFile(legacyFolderId, legacyFileNamePattern);
      const jlmopsFile = this._getLatestFile(jlmopsFolderId, jlmopsFileNamePattern);

      if (!legacyFile) {
        const message = `Validation skipped: No legacy file found for ${validationName}`;
        logger.info(serviceName, functionName, message);
        return message;
      }
      if (!jlmopsFile) {
        const message = `Validation skipped: No jlmops file found for ${validationName}`;
        logger.info(serviceName, functionName, message);
        return message;
      }

      const legacyContent = legacyFile.getBlob().getDataAsString();
      const jlmopsContent = jlmopsFile.getBlob().getDataAsString();

      return this._compareCsvData(legacyContent, jlmopsContent, validationName, keyColumn, columnsToCompare);

    } catch (e) {
      const errorMessage = `Error during ${validationName} validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Parses a CSV string into an array of objects.
   * @param {string} csvContent
   * @returns {Array<Object>}
   */
  _parseCsv(csvContent) {
    const rows = Utilities.parseCsv(csvContent);
    if (rows.length < 2) {
      return [];
    }
    const headers = rows[0];
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = rows[i][j];
      }
      data.push(row);
    }
    return data;
  },

  /**
   * Compares the data from two CSV files, independent of row order.
   * @param {string} legacyContent
   * @param {string} jlmopsContent
   * @param {string} validationName
   * @param {string} keyColumn
   * @param {Array<string>} columnsToCompare
   */
  _compareCsvData(legacyContent, jlmopsContent, validationName, keyColumn, columnsToCompare) {
    const serviceName = 'ValidationService';
    const functionName = '_compareCsvData';
    const legacyData = this._parseCsv(legacyContent);
    const jlmopsData = this._parseCsv(jlmopsContent);

    const legacyMap = new Map(legacyData.map(row => [row[keyColumn], row]));
    const jlmopsMap = new Map(jlmopsData.map(row => [row[keyColumn], row]));

    let discrepancies = [];

    for (const [key, legacyRow] of legacyMap.entries()) {
      const jlmopsRow = jlmopsMap.get(key);
      if (!jlmopsRow) {
        discrepancies.push(`Key ${key} from legacy file not found in jlmops file.`);
        continue;
      }

      for (const column of columnsToCompare) {
        if (legacyRow[column] !== jlmopsRow[column]) {
          discrepancies.push(`Key ${key}, Column ${column}: Legacy value '${legacyRow[column]}' differs from jlmops value '${jlmopsRow[column]}'.`);
        }
      }
    }

    for (const key of jlmopsMap.keys()) {
      if (!legacyMap.has(key)) {
        discrepancies.push(`Key ${key} from jlmops file not found in legacy file.`);
      }
    }

    if (discrepancies.length === 0) {
      const message = `${validationName} validation successful. Data is equivalent.`;
      logger.info(serviceName, functionName, message);
      return message;
    } else {
      const message = `${validationName} validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
      logger.info(serviceName, functionName, message.replace(/\n/g, ' ')); // Log as a single line
      return message;
    }
  },

  /**
   * Gets the latest file from a Google Drive folder that matches a pattern.
   * @param {string} folderId
   * @param {RegExp} fileNamePattern
   * @returns {GoogleAppsScript.Drive.File | null}
   */
  _getLatestFile(folderId, fileNamePattern) {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    let latestFile = null;
    let latestDate = new Date(0);

    while (files.hasNext()) {
      const file = files.next();
      if (fileNamePattern.test(file.getName())) {
        const dateModified = file.getLastUpdated();
        if (dateModified > latestDate) {
          latestFile = file;
          latestDate = dateModified;
        }
      }
    }
    return latestFile;
  },

  /**
   * Compares the highest order number between jlmops and the legacy system.
   */
  validateHighestOrderNumber() {
    const serviceName = 'ValidationService';
    const functionName = 'validateHighestOrderNumber';
    try {
      const legacyData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrdersM');
      const jlmopsData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebOrdM');

      const legacyOrderNumbers = legacyData.map(row => parseInt(row['order_number'])).filter(num => !isNaN(num));
      const jlmopsOrderNumbers = jlmopsData.map(row => parseInt(row.wom_OrderNumber)).filter(num => !isNaN(num));

      const maxLegacyOrderNumber = legacyOrderNumbers.length > 0 ? Math.max(...legacyOrderNumbers) : 0;
      const maxJlmopsOrderNumber = jlmopsOrderNumbers.length > 0 ? Math.max(...jlmopsOrderNumbers) : 0;

      let message;
      if (maxLegacyOrderNumber === maxJlmopsOrderNumber) {
        message = `Highest Order Number validation successful. Both systems report ${maxJlmopsOrderNumber}.`;
        logger.info(serviceName, functionName, message);
      } else {
        message = `Highest Order Number validation failed. Legacy: ${maxLegacyOrderNumber}, JLMops: ${maxJlmopsOrderNumber}.`;
        logger.info(serviceName, functionName, message);
      }
      return message;

    } catch (e) {
      const errorMessage = `Error during Highest Order Number validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Compares order statuses ('on-hold', 'processing') between jlmops and legacy.
   */
  validateOrderStatusMatch() {
    const serviceName = 'ValidationService';
    const functionName = 'validateOrderStatusMatch';
    try {
      const legacyData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'OrdersM');
      const jlmopsData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebOrdM');

      const statusesToCompare = ['on-hold', 'processing'];
      let discrepancies = [];

      for (const status of statusesToCompare) {
        const legacyOrders = new Set(legacyData.filter(row => row['status'] === status).map(row => row['order_number']));
        const jlmopsOrders = new Set(jlmopsData.filter(row => row['wom_Status'] === status).map(row => row.wom_OrderNumber));

        const legacyOnly = [...legacyOrders].filter(order => !jlmopsOrders.has(order));
        const jlmopsOnly = [...jlmopsOrders].filter(order => !legacyOrders.has(order));

        if (legacyOnly.length > 0) {
          discrepancies.push(`Status '${status}': Orders found only in legacy system: ${legacyOnly.join(', ')}.`);
        }
        if (jlmopsOnly.length > 0) {
          discrepancies.push(`Status '${status}': Orders found only in JLMops system: ${jlmopsOnly.join(', ')}.`);
        }
        if (legacyOnly.length === 0 && jlmopsOnly.length === 0) {
           discrepancies.push(`Status '${status}': Order lists match successfully.`);
        }
      }

      if (discrepancies.some(d => d.includes('only in'))) {
        const message = `Order Status validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' '));
        return message;
      } else {
        const message = `Order Status validation successful.\n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' '));
        return message;
      }

    } catch (e) {
      const errorMessage = `Error during Order Status validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  /**
   * Compares the prepared packing slip data between jlmops and the legacy system.
   */
  validatePackingSlipData() {
    const serviceName = 'ValidationService';
    const functionName = 'validatePackingSlipData';
    try {
      // 1. Read data from all sheets
      const legacyQueueData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'PackingQueue');
      const legacyRowsData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'PackingRows');
      const jlmopsCacheData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'SysPackingCache');

      // 2. Normalize Legacy Data
      const legacyOrders = new Map();
      for (const item of legacyRowsData) {
        const orderNumber = item['Order Number'];
        if (!legacyOrders.has(orderNumber)) {
          legacyOrders.set(orderNumber, []);
        }
        legacyOrders.get(orderNumber).push({
          sku: item.SKU,
          quantity: Number(item.Quantity)
        });
      }

      // 3. Normalize JLMops Data
      const jlmopsOrders = new Map();
      for (const item of jlmopsCacheData) {
        const orderId = item.spc_OrderId;
        if (!jlmopsOrders.has(orderId)) {
          jlmopsOrders.set(orderId, []);
        }
        jlmopsOrders.get(orderId).push({
          sku: item.spc_SKU,
          quantity: Number(item.spc_Quantity)
        });
      }

      // 4. Find order number to order ID map from legacy queue
      const orderNumberToIdMap = new Map(legacyQueueData.map(row => [row['Order Number'], row['order_id']]));

      // 5. Compare
      let discrepancies = [];
      for (const [legacyOrderNumber, legacyItems] of legacyOrders.entries()) {
        const jlmopsOrderId = orderNumberToIdMap.get(legacyOrderNumber);
        if (!jlmopsOrderId) {
            discrepancies.push(`Legacy Order Number ${legacyOrderNumber} not found in legacy PackingQueue.`);
            continue;
        }

        const jlmopsItems = jlmopsOrders.get(jlmopsOrderId);
        if (!jlmopsItems) {
          discrepancies.push(`Order ${jlmopsOrderId} (Legacy #${legacyOrderNumber}) found in legacy data but not in JLMops SysPackingCache.`);
          continue;
        }

        // Sort items by SKU for consistent comparison
        legacyItems.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
        jlmopsItems.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));

        if (legacyItems.length !== jlmopsItems.length) {
          discrepancies.push(`Order ${jlmopsOrderId}: Item count mismatch. Legacy: ${legacyItems.length}, JLMops: ${jlmopsItems.length}`);
          continue;
        }

        for (let i = 0; i < legacyItems.length; i++) {
          const legacyItem = legacyItems[i];
          const jlmopsItem = jlmopsItems[i];

          if (legacyItem.sku !== jlmopsItem.sku) {
            discrepancies.push(`Order ${jlmopsOrderId}: Item SKU mismatch at index ${i}. Legacy: ${legacyItem.sku}, JLMops: ${jlmopsItem.sku}`);
          } else if (legacyItem.quantity !== jlmopsItem.quantity) {
            discrepancies.push(`Order ${jlmopsOrderId}, SKU ${legacyItem.sku}: Quantity mismatch. Legacy: ${legacyItem.quantity}, JLMops: ${jlmopsItem.quantity}`);
          }
        }
         jlmopsOrders.delete(jlmopsOrderId); // Remove from map to track extra JLMops orders
      }

      // Check for any orders left in the jlmops map
      for (const orderId of jlmopsOrders.keys()) {
        discrepancies.push(`Order ${orderId} found in JLMops SysPackingCache but not in legacy data.`);
      }

      if (discrepancies.length === 0) {
        const message = 'Packing Slip Data validation successful. Data matches.';
        logger.info(serviceName, functionName, message);
        return message;
      } else {
        const message = `Packing Slip Data validation failed. Discrepancies found: \n- ${discrepancies.join('\n- ')}`;
        logger.info(serviceName, functionName, message.replace(/\n/g, ' ')); // Log as a single line
        return message;
      }

    } catch (e) {
      const errorMessage = `Error during Packing Slip Data validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },

  validateProductMasterData() {
    const serviceName = 'ValidationService';
    const functionName = 'validateProductMasterData';
    const results = [];

    try {
      // 1. Fetch Data
      const legacyWebMData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'WebM');
      const legacyWeHeData = this.readSheetData(LEGACY_REFERENCE_SPREADSHEET_ID, 'WeHe');
      const jlmopsProdMData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebProdM');
      const jlmopsXltMData = this.readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, 'WebXltM');

      // 2. Perform Product Count Comparison
      results.push(`Product Counts: Legacy (WebM) has ${legacyWebMData.length} products, JLMops (WebProdM) has ${jlmopsProdMData.length} products.`);

      // 3. Perform Translation Count Comparison
      results.push(`Translation Counts: Legacy (WeHe) has ${legacyWeHeData.length} translations, JLMops (WebXltM) has ${jlmopsXltMData.length} translations.`);

      // 4. Perform Product ID, SKU, and Description Matching Validation
      const jlmopsProdMap = new Map(jlmopsProdMData.map(row => [row.wpm_SKU, row]));
      const mismatches = [];

      for (const legacyProd of legacyWebMData) {
        const legacySku = legacyProd['SKU'];
        const legacyId = legacyProd['ID'];
        const legacyDesc = legacyProd['post_title']; // Assuming this is the English description column

        if (!jlmopsProdMap.has(legacySku)) {
          mismatches.push(`Legacy SKU '${legacySku}' (ID: ${legacyId}) not found in JLMops.`);
        } else {
          const jlmopsProd = jlmopsProdMap.get(legacySku);
          if (legacyId != jlmopsProd.wpm_WebIdEn) { // Use '!=' for potential type differences
            mismatches.push(`SKU '${legacySku}': Legacy ID '${legacyId}' does not match JLMops ID '${jlmopsProd.wpm_WebIdEn}'.`);
          }
          if (legacyDesc !== jlmopsProd.wpm_Description) {
            mismatches.push(`SKU '${legacySku}': Description mismatch. Legacy: "${legacyDesc}" | JLMops: "${jlmopsProd.wpm_Description}".`);
          }
        }
      }

      if (mismatches.length > 0) {
        results.push('ID/SKU/Description Mismatches Found:');
        results.push(...mismatches.map(m => `- ${m}`));
      } else {
        results.push('ID/SKU/Description Matching: All legacy SKUs, IDs, and Descriptions match JLMops.');
      }

      const message = `Product Master Data Validation Results:\n- ${results.join('\n- ')}`;
      logger.info(serviceName, functionName, message.replace(/\n/g, ' '));
      return message;

    } catch (e) {
      const errorMessage = `Error during Product Master Data validation: ${e.message}`;
      logger.error(serviceName, functionName, errorMessage, e);
      return errorMessage;
    }
  },
};

// =================================================================
//  RUNNER FUNCTIONS (for execution from Apps Script Editor)
// =================================================================

function run_validateOnHoldInventory() {
  ValidationService.validateOnHoldInventory();
}

function run_validateComaxOrderExport() {
  ValidationService.validateComaxOrderExport();
}

function run_validateWebProductUpdate() {
  ValidationService.validateWebProductUpdate();
}

function run_validateHighestOrderNumber() {
  ValidationService.validateHighestOrderNumber();
}

function run_validateOrderStatusMatch() {
  ValidationService.validateOrderStatusMatch();
}

function run_validatePackingSlipData() {
  ValidationService.validatePackingSlipData();
}
