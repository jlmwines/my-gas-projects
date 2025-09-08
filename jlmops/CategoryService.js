/**
 * @file CategoryService.js
 * @description This service manages categories.
 */

/**
 * CategoryService provides methods for managing category data.
 */
function CategoryService() {
  const CATEGORY_SHEET_NAME = "CategoryM"; // Assuming a master category sheet

  /**
   * Retrieves all categories from the category sheet.
   * @returns {Array<Object>} An array of category objects.
   */
  this.getAllCategories = function() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(CATEGORY_SHEET_NAME);

      if (!sheet) {
        logger.error(`Category sheet '${CATEGORY_SHEET_NAME}' not found.`);
        return [];
      }

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length === 0) {
        logger.info(`No data found in category sheet '${CATEGORY_SHEET_NAME}'.`);
        return [];
      }

      const headers = values[0];
      const categories = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const category = {};
        headers.forEach((header, index) => {
          category[header] = row[index];
        });
        categories.push(category);
      }

      logger.info(`Successfully retrieved ${categories.length} categories from '${CATEGORY_SHEET_NAME}'.`);
      return categories;

    } catch (e) {
      logger.error(`Error getting all categories: ${e.message}`, e);
      return [];
    }
  };

  /**
   * Retrieves a single category by its ID or name.
   * @param {string} categoryIdentifier The ID or name of the category to retrieve.
   * @returns {Object|null} The category object if found, otherwise null.
   */
  this.getCategoryByIdentifier = function(categoryIdentifier) {
    try {
      const categories = this.getAllCategories(); // For simplicity, fetch all and filter
      const category = categories.find(c => c.ID === categoryIdentifier || c.Name === categoryIdentifier); // Assuming 'ID' or 'Name' as identifier

      if (category) {
        logger.info(`Found category with ID/Name: ${categoryIdentifier}`);
      } else {
        logger.warn(`Category with ID/Name: ${categoryIdentifier} not found.`);
      }
      return category || null;

    } catch (e) {
      logger.error(`Error getting category by identifier ${categoryIdentifier}: ${e.message}`, e);
      return null;
    }
  };

  // TODO: Add methods for creating, updating, and deleting categories
  // this.createCategory = function(categoryData) { ... };
  // this.updateCategory = function(categoryId, categoryData) { ... };
  // this.deleteCategory = function(categoryId) { ... };
}

// Global instance for easy access throughout the project
const categoryService = new CategoryService();