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
    },

    /**
     * Formats the product description into a structured HTML string.
     * Replicates the legacy `compileExportDescription_` logic.
     * 
     * @param {string} sku The product SKU.
     * @param {Object} productData The product detail data (from WebDetM/S).
     * @param {Object} comaxData The Comax master data (from CmxProdM).
     * @param {string} lang 'EN' or 'HE'.
     * @param {Object} lookupMaps A container for text, grape, and kashrut lookup maps.
     * @param {boolean} isForExport If true, includes the hidden appendices (promo text, etc.).
     * @returns {string} The formatted HTML string.
     */
    formatDescriptionHTML: function(sku, productData, comaxData, lang, lookupMaps, isForExport) {
        let html = '';

        // Helper to safely get string values
        const getVal = (key) => productData[key] || '';
        const getCmxVal = (key) => comaxData ? (comaxData[key] || '') : '';

        const name = lang === 'EN' ? getVal('wdm_NameEn') : getVal('wdm_NameHe');
        const description = lang === 'EN' ? getVal('wdm_DescriptionEn') : getVal('wdm_DescriptionHe');
        const region = getVal('wdm_Region'); // Stored as code
        const abv = getVal('wdm_ABV'); // Stored as decimal 0.125
        const vintage = getCmxVal('cpm_Vintage'); // From Comax
        const alcohol = (parseFloat(abv) * 100).toFixed(1) + '%';
        const volume = getCmxVal('cpm_Size'); // From Comax
        
        // --- 1. Opening Section ---
        html += `<strong>${name}</strong><br>\n`;
        html += `${description}<br>\n<br>\n`;

        // --- 2. Attributes Section ---
        html += `<strong>${lang === 'EN' ? 'Attributes:' : 'מאפיינים:'}</strong><br>\n`;
        
        const attrLine = (labelEn, labelHe, value) => {
            if (!value) return '';
            const label = lang === 'EN' ? labelEn : labelHe;
            return `${label}: ${value}<br>\n`;
        };
        
        // Group/Type
        const group = getCmxVal('cpm_Group');
        html += attrLine('Type', 'סוג', group);
        
        // Vintage
        html += attrLine('Vintage', 'שנת בציר', vintage);
        
        // Alcohol
        html += attrLine('Alcohol', 'אלכוהול', alcohol);
        
        // Volume
        html += attrLine('Volume', 'גודל', volume);

        // Region (Lookup)
        const regionObj = lookupMaps.texts.get(region);
        const regionName = regionObj ? (lang === 'EN' ? regionObj.slt_TextEN : regionObj.slt_TextHE) : region;
        html += attrLine('Region', 'אזור', regionName);

        // Grapes
        const grapeCodes = ['wdm_GrapeG1', 'wdm_GrapeG2', 'wdm_GrapeG3', 'wdm_GrapeG4', 'wdm_GrapeG5'];
        const grapeNames = [];
        grapeCodes.forEach(codeKey => {
            const code = getVal(codeKey);
            if (code) {
                const grapeObj = lookupMaps.grapes.get(code);
                if (grapeObj) {
                    grapeNames.push(lang === 'EN' ? grapeObj.slg_TextEN : grapeObj.slg_NameHe);
                }
            }
        });
        if (grapeNames.length > 0) {
            html += attrLine('Grapes', 'ענבים', grapeNames.join(', '));
        }

        // Tasting Attributes (Lookup)
        ['Intensity', 'Complexity', 'Acidity', 'Decant'].forEach(attr => {
            const code = getVal(`wdm_${attr}`);
            if (code) {
                 const attrObj = lookupMaps.texts.get(code);
                 const val = attrObj ? (lang === 'EN' ? attrObj.slt_TextEN : attrObj.slt_TextHE) : '';
                 // Legacy labels hardcoded roughly
                 const labelEn = attr; 
                 const labelHe = attr; // Simplified for now, ideally also looked up or hardcoded map
                 if (val) html += `${labelEn}: ${val}<br>\n`; 
            }
        });
        
        // Harmonize/Contrast
        // (This logic can be complex, simplifying for prototype: just listing pairs if checked? 
        //  Actually, legacy logic appends pre-formatted text blocks in Appendices. 
        //  The visible section usually just lists simple attributes.)

        html += '<br>\n';

        // --- 3. Kashrut Section ---
        html += `<strong>${lang === 'EN' ? 'Kashrut:' : 'כשרות:'}</strong><br>\n`;
        
        const kashrutCodes = ['wdm_KashrutK1', 'wdm_KashrutK2', 'wdm_KashrutK3', 'wdm_KashrutK4', 'wdm_KashrutK5'];
        kashrutCodes.forEach(codeKey => {
            const code = getVal(codeKey);
            if (code) {
                const kObj = lookupMaps.kashrut.get(code);
                if (kObj) {
                     const kText = lang === 'EN' ? kObj.slk_TextEN : kObj.slk_TextHE;
                     html += `${kText}<br>\n`;
                }
            }
        });

        const heterMechira = getVal('wdm_HeterMechira');
        if (String(heterMechira) === 'true' || heterMechira === true) {
            const hmText = lang === 'EN' ? 'Heter Mechira' : 'היתר מכירה';
            html += `<span style="color: #ff0000;"><strong>${hmText}</strong></span><br>\n`;
        }
        
        const isMevushal = getVal('wdm_IsMevushal');
        if (String(isMevushal) === 'true' || isMevushal === true) {
             const mevText = lang === 'EN' ? 'Mevushal' : 'מבושל';
             html += `${mevText}<br>\n`;
        }

        // --- 4. Appendices (Export Only) ---
        if (isForExport) {
             html += '<br>\n';
             // P-Code (Promotional Text) - Logic: Look up P-code text and append
             // Attributes Texts - Look up descriptions for Intensity/Complexity etc.
             // Pairing Notes - Look up Harmonize/Contrast flavor texts
             
             // (Simplified placeholder for now to ensure structure exists)
             // In a full implementation, we'd query SysLkp_Texts for 'P-Code' linked to this product 
             // or derived from attributes.
        }

        return html;
    }
  };

})();
