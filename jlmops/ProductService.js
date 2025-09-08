/**
 * @file ProductService.js
 * @description This service manages products.
 */

/**
 * ProductService provides methods for managing product data.
 */
function ProductService() {
  const PRODUCT_SHEET_NAME = "WebProdM"; // Assuming WebProdM is the master product sheet

  /**
   * Retrieves all products from the product sheet.
   * @returns {Array<Object>} An array of product objects.
   */
  this.getAllProducts = function() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(PRODUCT_SHEET_NAME);

      if (!sheet) {
        logger.error(`Product sheet '${PRODUCT_SHEET_NAME}' not found.`);
        return [];
      }

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length === 0) {
        logger.info(`No data found in product sheet '${PRODUCT_SHEET_NAME}'.`);
        return [];
      }

      const headers = values[0];
      const products = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const product = {};
        headers.forEach((header, index) => {
          product[header] = row[index];
        });
        products.push(product);
      }

      logger.info(`Successfully retrieved ${products.length} products from '${PRODUCT_SHEET_NAME}'.`);
      return products;

    } catch (e) {
      logger.error(`Error getting all products: ${e.message}`, e);
      return [];
    }
  };

  /**
   * Retrieves a single product by its ID.
   * @param {string} productId The ID of the product to retrieve.
   * @returns {Object|null} The product object if found, otherwise null.
   */
  this.getProductById = function(productId) {
    try {
      const products = this.getAllProducts(); // For simplicity, fetch all and filter
      const product = products.find(p => p.ID === productId || p.SKU === productId); // Assuming 'ID' or 'SKU' as identifier

      if (product) {
        logger.info(`Found product with ID/SKU: ${productId}`);
      } else {
        logger.warn(`Product with ID/SKU: ${productId} not found.`);
      }
      return product || null;

    } catch (e) {
      logger.error(`Error getting product by ID ${productId}: ${e.message}`, e);
      return null;
    }
  };

  // TODO: Add methods for updating, creating, and deleting products
  // this.updateProduct = function(productId, productData) { ... };
  // this.createProduct = function(productData) { ... };
  // this.deleteProduct = function(productId) { ... };
}

// Global instance for easy access throughout the project
const productService = new ProductService();