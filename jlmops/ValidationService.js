const ValidationService = {
  /**
   * Compares the on-hold inventory data between jlmops and the legacy system.
   */
  validateOnHoldInventory() {
    const legacySpreadsheetId = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc';
    const legacySheetName = 'OnHoldInventory';
    const jlmopsSheetName = 'SysInventoryOnHold'; // From DATA_MODEL.md

    try {
      const legacyData = this._readSheetData(legacySpreadsheetId, legacySheetName);
      const jlmopsData = this._readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, jlmopsSheetName); // Assuming jlmops data spreadsheet ID is configured

      // Convert arrays of objects to maps for easier comparison
      const legacyMap = new Map(legacyData.map(row => [row['product SKU'], row['on hold quantity']]));
      const jlmopsMap = new Map(jlmopsData.map(row => [row.sio_SKU, row.sio_OnHoldQuantity]));

      let discrepancies = [];

      // Check for discrepancies in legacyMap
      for (const [sku, legacyQuantity] of legacyMap.entries()) {
        const jlmopsQuantity = jlmopsMap.get(sku);
        if (jlmopsQuantity === undefined) {
          discrepancies.push(`Legacy SKU ${sku} with quantity ${legacyQuantity} not found in JLMops.`);
        } else if (jlmopsQuantity !== legacyQuantity) {
          discrepancies.push(`SKU ${sku}: Legacy quantity ${legacyQuantity} differs from JLMops quantity ${jlmopsQuantity}.`);
        }
      }

      // Check for SKUs present only in jlmopsMap
      for (const [sku, jlmopsQuantity] of jlmopsMap.entries()) {
        if (!legacyMap.has(sku)) {
          discrepancies.push(`JLMops SKU ${sku} with quantity ${jlmopsQuantity} not found in Legacy.`);
        }
      }

      if (discrepancies.length === 0) {
        Logger.log('ValidationService: On-Hold Inventory validation successful. Data matches.');
      } else {
        Logger.log('ValidationService: On-Hold Inventory validation failed. Discrepancies found:');
        discrepancies.forEach(d => Logger.log(d));
      }

    } catch (e) {
      Logger.log(`ValidationService: Error during On-Hold Inventory validation: ${e.message}`);
    }
  },

  /**
   * Helper function to read data from a Google Sheet.
   * @param {string} spreadsheetId
   * @param {string} sheetName
   * @returns {Array<Object>}
   */
  _readSheetData(spreadsheetId, sheetName) {
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
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[i][j];
      }
      data.push(row);
    }
    return data;
  },

  /**
   * Compares the Comax order export from jlmops with the latest one from the legacy system.
   */
  validateComaxOrderExport() {
    const legacyFolderId = '1cyvZ2ngdBLEoXGB-ckxl-JWHwrJXS0mp';
    const jlmopsFolderId = ConfigService.getConfig('system.folder.jlmops_exports').id; // Assuming this is configured
    const legacyFileNamePattern = /OrderEx-\d{2}-\d{2}-\d{2}-\d{2}\.csv/;
    const jlmopsFileNamePattern = /OrderEx-\d{2}-\d{2}-\d{2}-\d{2}\.csv/; // Assuming same pattern

    this._validateCsvExport(legacyFolderId, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, 'Comax Order Export', 'SKU', ['Quantity']);
  },

  /**
   * Compares the web product update export from jlmops with the latest one from the legacy system.
   */
  validateWebProductUpdate() {
    const legacyFolderId = '1cyvZ2ngdBLEoXGB-ckxl-JWHwrJXS0mp';
    const jlmopsFolderId = ConfigService.getConfig('system.folder.jlmops_exports').id; // Assuming this is configured
    const legacyFileNamePattern = /ProductInventory-\d{2}-\d{2}-\d{2}\.csv/;
    const jlmopsFileNamePattern = /ProductInventory-\d{2}-\d{2}-\d{2}\.csv/; // Assuming same pattern

    this._validateCsvExport(legacyFolderId, legacyFileNamePattern, jlmopsFolderId, jlmopsFileNamePattern, 'Web Product Update', 'SKU', ['Stock', 'Regular Price']);
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
    try {
      const legacyFile = this._getLatestFile(legacyFolderId, legacyFileNamePattern);
      const jlmopsFile = this._getLatestFile(jlmopsFolderId, jlmopsFileNamePattern);

      if (!legacyFile) {
        Logger.log(`ValidationService: No legacy file found for ${validationName}`);
        return;
      }
      if (!jlmopsFile) {
        Logger.log(`ValidationService: No jlmops file found for ${validationName}`);
        return;
      }

      const legacyContent = legacyFile.getBlob().getDataAsString();
      const jlmopsContent = jlmopsFile.getBlob().getDataAsString();

      this._compareCsvData(legacyContent, jlmopsContent, validationName, keyColumn, columnsToCompare);

    } catch (e) {
      Logger.log(`ValidationService: Error during ${validationName} validation: ${e.message}`);
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
      Logger.log(`ValidationService: ${validationName} validation successful. Data is equivalent.`);
    } else {
      Logger.log(`ValidationService: ${validationName} validation failed. Discrepancies found:`);
      discrepancies.forEach(d => Logger.log(d));
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
    const legacySpreadsheetId = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc'; // This ID should ideally come from SysConfig
    const legacySheetName = 'OrdersM';
    const jlmopsSheetName = 'WebOrdM'; // From DATA_MODEL.md

    try {
      const legacyData = this._readSheetData(legacySpreadsheetId, legacySheetName);
      const jlmopsData = this._readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, jlmopsSheetName);

      const legacyOrderNumbers = legacyData.map(row => parseInt(row['order_number'])).filter(num => !isNaN(num));
      const jlmopsOrderNumbers = jlmopsData.map(row => parseInt(row.wom_OrderNumber)).filter(num => !isNaN(num));

      const maxLegacyOrderNumber = legacyOrderNumbers.length > 0 ? Math.max(...legacyOrderNumbers) : 0;
      const maxJlmopsOrderNumber = jlmopsOrderNumbers.length > 0 ? Math.max(...jlmopsOrderNumbers) : 0;

      if (maxLegacyOrderNumber === maxJlmopsOrderNumber) {
        Logger.log(`ValidationService: Highest Order Number validation successful. Both systems report ${maxJlmopsOrderNumber}.`);
      } else {
        Logger.log(`ValidationService: Highest Order Number validation failed. Legacy: ${maxLegacyOrderNumber}, JLMops: ${maxJlmopsOrderNumber}.`);
      }

    } catch (e) {
      Logger.log(`ValidationService: Error during Highest Order Number validation: ${e.message}`);
    }
  },

  /**
   * Compares the prepared packing slip data between jlmops and the legacy system.
   */
  validatePackingSlipData() {
    const legacySpreadsheetId = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc';
    const legacyQueueSheetName = 'PackingQueue';
    const legacyRowsSheetName = 'PackingRows';
    const jlmopsCacheSheetName = 'SysPackingCache';

    try {
      // 1. Read data from all sheets
      const legacyQueueData = this._readSheetData(legacySpreadsheetId, legacyQueueSheetName);
      const legacyRowsData = this._readSheetData(legacySpreadsheetId, legacyRowsSheetName);
      const jlmopsCacheData = this._readSheetData(ConfigService.getConfig('system.spreadsheet.data').id, jlmopsCacheSheetName);

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
        legacyItems.sort((a, b) => a.sku.localeCompare(b.sku));
        jlmopsItems.sort((a, b) => a.sku.localeCompare(b.sku));

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
        Logger.log('ValidationService: Packing Slip Data validation successful. Data matches.');
      } else {
        Logger.log('ValidationService: Packing Slip Data validation failed. Discrepancies found:');
        discrepancies.forEach(d => Logger.log(d));
      }

    } catch (e) {
      Logger.log(`ValidationService: Error during Packing Slip Data validation: ${e.message}`);
      Logger.log(e.stack);
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

function run_validatePackingSlipData() {
  ValidationService.validatePackingSlipData();
}