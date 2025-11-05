const WooCommerceFormatter = (function() {

  /**
   * Escapes a string for CSV output.
   * @param {*} value The value to escape.
   * @returns {string} The CSV-escaped string.
   */
  function _csvEscape(value) {
    if (value === null || value === undefined) {
      return '';
    }
    let stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('\" ') || stringValue.includes('\n')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
  }

  /**
   * Generates a WooCommerce product CSV from an array of product objects.
   * @param {Array<Object>} products An array of product objects.
   * @returns {string} The CSV content as a string.
   */
  function formatProductsForExport(products) {
    const csvRows = [];
    const headers = [
      'ID', 'Type', 'SKU', 'Name', 'Published', 'Is featured?', 'Visibility in catalog',
      'Short description', 'Description', 'Date sale price starts', 'Date sale price ends',
      'Tax status', 'Tax class', 'In stock?', 'Stock', 'Low stock amount',
      'Backorders allowed?', 'Sold individually?', 'Weight (kg)', 'Length (cm)',
      'Width (cm)', 'Height (cm)', 'Allow customer reviews?', 'Purchase note',
      'Sale price', 'Regular price', 'Categories', 'Tags', 'Shipping class',
      'Images', 'Download limit', 'Download expiry days', 'Parent',
      'Grouped products', 'Upsells', 'Cross-sells', 'External URL',
      'Button text', 'Position', 'Attribute 1 name', 'Attribute 1 value(s)',
      'Attribute 1 visible', 'Attribute 1 global', 'Attribute 2 name',
      'Attribute 2 value(s)', 'Attribute 2 visible', 'Attribute 2 global',
      'Meta: _wpml_translation_hash', 'Meta: _wpml_language', 'Meta: _wpml_source_id'
    ];
    csvRows.push(headers.map(_csvEscape).join(','));

    products.forEach(product => {
      const row = [];
      row.push(_csvEscape(product.wps_ID));
      row.push(_csvEscape(product.wps_Type));
      row.push(_csvEscape(product.wps_SKU));
      row.push(_csvEscape(product.wps_Name));
      row.push(_csvEscape(product.wps_Published ? 1 : 0));
      row.push(_csvEscape(product.wps_IsFeatured ? 1 : 0));
      row.push(_csvEscape(product.wps_VisibilityInCatalog));
      row.push(_csvEscape(product.wps_ShortDescription));
      row.push(_csvEscape(product.wps_Description));
      row.push(_csvEscape(product.wps_DateSalePriceStarts));
      row.push(_csvEscape(product.wps_DateSalePriceEnds));
      row.push(_csvEscape(product.wps_TaxStatus));
      row.push(_csvEscape(product.wps_TaxClass));
      row.push(_csvEscape(product.wps_InStock ? 1 : 0));
      row.push(_csvEscape(product.wps_Stock));
      row.push(_csvEscape(product.wps_LowStockAmount));
      row.push(_csvEscape(product.wps_BackordersAllowed ? 1 : 0));
      row.push(_csvEscape(product.wps_SoldIndividually ? 1 : 0));
      row.push(_csvEscape(product.wps_WeightKg));
      row.push(_csvEscape(product.wps_LengthCm));
      row.push(_csvEscape(product.wps_WidthCm));
      row.push(_csvEscape(product.wps_HeightCm));
      row.push(_csvEscape(product.wps_AllowCustomerReviews ? 1 : 0));
      row.push(_csvEscape(product.wps_PurchaseNote));
      row.push(_csvEscape(product.wps_SalePrice));
      row.push(_csvEscape(product.wps_RegularPrice));
      row.push(_csvEscape(Array.isArray(product.wps_Categories) ? product.wps_Categories.join(', ') : product.wps_Categories));
      row.push(_csvEscape(Array.isArray(product.wps_Tags) ? product.wps_Tags.join(', ') : product.wps_Tags));
      row.push(_csvEscape(product.wps_ShippingClass));
      row.push(_csvEscape(Array.isArray(product.wps_Images) ? product.wps_Images.join(', ') : product.wps_Images));
      row.push(_csvEscape(product.wps_DownloadLimit));
      row.push(_csvEscape(product.wps_DownloadExpiryDays));
      row.push(_csvEscape(product.wps_Parent));
      row.push(_csvEscape(product.wps_GroupedProducts));
      row.push(_csvEscape(product.wps_Upsells));
      row.push(_csvEscape(product.wps_CrossSells));
      row.push(_csvEscape(product.wps_ExternalURL));
      row.push(_csvEscape(product.wps_ButtonText));
      row.push(_csvEscape(product.wps_Position));
      row.push(_csvEscape(product.wps_Attribute1Name));
      row.push(_csvEscape(Array.isArray(product.wps_Attribute1Value) ? product.wps_Attribute1Value.join(' | ') : product.wps_Attribute1Value));
      row.push(_csvEscape(product.wps_Attribute1Visible ? 1 : 0));
      row.push(_csvEscape(product.wps_Attribute1Global ? 1 : 0));
      row.push(_csvEscape(product.wps_Attribute2Name));
      row.push(_csvEscape(Array.isArray(product.wps_Attribute2Value) ? product.wps_Attribute2Value.join(' | ') : product.wps_Attribute2Value));
      row.push(_csvEscape(product.wps_Attribute2Visible ? 1 : 0));
      row.push(_csvEscape(product.wps_Attribute2Global ? 1 : 0));
      row.push(_csvEscape(product.wps_MetaWpmlTranslationHash));
      row.push(_csvEscape(product.wps_MetaWpmlLanguage));
      row.push(_csvEscape(product.wps_MetaWpmlSourceId));
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }

  return {
    formatProductsForExport: formatProductsForExport,

    /**
     * Generates a simple WooCommerce inventory update CSV matching the legacy format.
     * @param {Array<Object>} products An array of simple product objects with ID, SKU, WName, Stock, and RegularPrice.
     * @returns {string} The CSV content as a string.
     */
    formatInventoryUpdate: function(products) {
      const headers = ['ID', 'SKU', 'WName', 'Stock', 'Regular Price'];
      const csvRows = [headers.join(',')];

      products.forEach(product => {
        const row = [
          _csvEscape(product.ID),
          _csvEscape(product.SKU),
          _csvEscape(product.WName),
          _csvEscape(product.Stock),
          _csvEscape(product.RegularPrice)
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    }
  };

})();
