/**
 * @file WebAdapter.js
 * @description This adapter handles the cleaning and transformation of raw data from WooCommerce product exports.
 */

const WebAdapter = (function() {

  /**
   * Parses the raw CSV content of a Web Products file.
   * @param {string} csvContent The raw string content of the CSV file.
   * @param {string} mapName The name of the configuration map to use (e.g., 'map.web.product_columns').
   * @returns {Array<Object>} An array of clean, standardized product objects.
   */
  function processProductCsv(csvContent, mapName) {
    const serviceName = 'WebAdapter';
    const functionName = 'processProductCsv';
    logger.info(serviceName, functionName, `Starting product CSV processing using map: ${mapName}`);

    const columnMap = ConfigService.getConfig(mapName);
    if (!columnMap) {
        throw new Error(`Web product column map '${mapName}' not found in configuration. Please run setup.`);
    }

    const parsedData = Utilities.parseCsv(csvContent);
    if (parsedData.length < 2) {
      logger.error(serviceName, functionName, 'File is empty or contains only a header.');
      return [];
    }
    
    const headerRow = parsedData[0].map(h => String(h).trim().toLowerCase()); // Convert CSV headers to lowercase for case-insensitive matching

    // Strict Header Validation
    const missingHeaders = Object.keys(columnMap).filter(expectedHeader => 
        headerRow.indexOf(expectedHeader.toLowerCase()) === -1
    );

    if (missingHeaders.length > 0) {
        const errorMessage = `Critical: Input CSV is missing required headers: ${missingHeaders.join(', ')}. Check file format.`;
        logger.error(serviceName, functionName, errorMessage);
        throw new Error(errorMessage);
    }

    const productObjects = [];

    // Start from row 1 to skip the header
    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (row.join('').trim() === '') continue; // Skip empty rows

      const product = {};
      Object.keys(columnMap).forEach(csvHeader => {
        const internalFieldName = columnMap[csvHeader];
        // Convert csvHeader from config to lowercase for comparison
        const columnIndex = headerRow.indexOf(csvHeader.toLowerCase());
        
        if (columnIndex !== -1) {
          product[internalFieldName] = row[columnIndex];
        }
      });
      productObjects.push(product);
    }

    logger.info(serviceName, functionName, `Successfully processed ${productObjects.length} products.`);
    return productObjects;
  }

  function processTranslationCsv(csvContent, mapName) {
    const serviceName = 'WebAdapter';
    const functionName = 'processTranslationCsv';
    logger.info(serviceName, functionName, `Starting translation CSV processing using map: ${mapName}`);

    const columnMap = ConfigService.getConfig(mapName);
    if (!columnMap) {
        throw new Error(`Web translation column map '${mapName}' not found in configuration. Please run setup.`);
    }

    const parsedData = Utilities.parseCsv(csvContent);
    if (parsedData.length < 2) {
      logger.error(serviceName, functionName, 'File is empty or contains only a header.');
      return [];
    }
    
    const headerRow = parsedData[0].map(h => String(h).trim().toLowerCase()); // Convert CSV headers to lowercase for case-insensitive matching
    const translationObjects = [];

    // Start from row 1 to skip the header
    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (row.join('').trim() === '') continue; // Skip empty rows

      const translation = {};
      Object.keys(columnMap).forEach(csvHeader => {
        const internalFieldName = columnMap[csvHeader];
        // Convert csvHeader from config to lowercase for comparison
        const columnIndex = headerRow.indexOf(csvHeader.toLowerCase());
        
        if (columnIndex !== -1) {
          translation[internalFieldName] = row[columnIndex];
        }
      });
      translationObjects.push(translation);
    }

    logger.info(serviceName, functionName, `Successfully processed ${translationObjects.length} translations.`);
    return translationObjects;
  }

  function processOrderCsv(csvContent, orderMapName, lineItemSchemaName) {
    const serviceName = 'WebAdapter';
    const functionName = 'processOrderCsv';
    logger.info(serviceName, functionName, `Starting order CSV processing using order map: ${orderMapName} and line item schema: ${lineItemSchemaName}`);

    const orderColumnMap = ConfigService.getConfig(orderMapName);
    if (!orderColumnMap) {
        throw new Error(`Web order column map '${orderMapName}' not found in configuration.`);
    }

    const lineItemSchema = ConfigService.getConfig(lineItemSchemaName);
    if (!lineItemSchema) {
        throw new Error(`Line item schema '${lineItemSchemaName}' not found in configuration.`);
    }

    const parsedData = Utilities.parseCsv(csvContent);
    if (parsedData.length < 2) {
      logger.error(serviceName, functionName, 'File is empty or contains only a header.');
      return [];
    }
    
    const headerRow = parsedData[0].map(h => String(h).trim().toLowerCase());
    const orderObjects = [];

    const lineItemPrefix = lineItemSchema.line_item_prefix;
    const maxLineItems = parseInt(lineItemSchema.max_line_items, 10);

    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (row.join('').trim() === '') continue;

      // Step 1: Build the full order object with all flat properties from the CSV
      const order = {};
      Object.keys(orderColumnMap).forEach(csvHeader => {
        const internalFieldName = orderColumnMap[csvHeader];
        const columnIndex = headerRow.indexOf(csvHeader.toLowerCase());
        
        if (columnIndex !== -1) {
          order[internalFieldName] = row[columnIndex];
        }
      });

      // Step 2: Parse line items using the configuration-driven schema
      order.lineItems = [];
      const productItemFields = lineItemSchema.product_item_fields.split(',');

      for (let j = 1; j <= maxLineItems; j++) {
        const propName = `${lineItemPrefix}${j}`;
        
        if (order.hasOwnProperty(propName) && order[propName]) {
          const lineItemString = order[propName];
          const lineItemData = {};
          
          const attributes = lineItemString.split('|');
          attributes.forEach(attr => {
            const firstColon = attr.indexOf(':');
            if (firstColon > -1) {
              const key = attr.substring(0, firstColon).trim().toLowerCase();
              const value = attr.substring(firstColon + 1).trim();
              lineItemData[key] = value;
            }
          });

          // Use the schema from SysConfig to build the line item object
          const lineItem = {};
          let hasRequiredFields = true;
          productItemFields.forEach(field => {
            const fieldKey = field.trim().toLowerCase();
            if (lineItemData.hasOwnProperty(fieldKey)) {
              lineItem[field] = lineItemData[fieldKey];
            } else {
              // SKU and Quantity are essential
              if (field === 'SKU' || field === 'Quantity') {
                hasRequiredFields = false;
              }
            }
          });

          // Basic validation to ensure it's a real item
          if (hasRequiredFields && lineItem[productItemFields[2]] && lineItem[productItemFields[3]]) {
            order.lineItems.push(lineItem);
          }
        } else {
          // Stop if a line item property is missing, assuming no more items.
          break;
        }
      }
      orderObjects.push(order);
    }

    logger.info(serviceName, functionName, `Successfully processed ${orderObjects.length} orders.`);
    return orderObjects;
  }

  // Public interface for the adapter
  return {
    processProductCsv: processProductCsv,
    processTranslationCsv: processTranslationCsv,
    processOrderCsv: processOrderCsv
  };

})();
