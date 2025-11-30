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
     * Replicates the legacy `compileExportDescription_` logic and manager preview requirements.
     * 
     * @param {string} sku The product SKU.
     * @param {Object} productData The product detail data (from WebDetM/S or formData).
     * @param {Object} comaxData The Comax master data (from CmxProdM).
     * @param {string} lang 'EN' or 'HE'.
     * @param {Object} lookupMaps A container for text, grape, and kashrut lookup maps.
     * @param {boolean} isForExport If true, includes the hidden appendices (promo text, etc.).
     * @returns {string} The formatted HTML string.
     */
    formatDescriptionHTML: function(sku, productData, comaxData, lang, lookupMaps, isForExport) {
        let html = '';

        // Helper to safely get string values from productData
        const getVal = (key) => productData[key] || '';
        // Helper to safely get string values from comaxData
        const getCmxVal = (key) => comaxData ? (comaxData[key] || '') : '';

        const isEn = lang === 'EN';

        // --- Data Extraction ---
        const name = isEn ? getVal('wdm_NameEn') : getVal('wdm_NameHe');
        const shortDescription = isEn ? getVal('wdm_ShortDescrEn') : getVal('wdm_ShortDescrHe');
        const longDescription = isEn ? getVal('wdm_DescriptionEn') : getVal('wdm_DescriptionHe');

        const regionCode = getVal('wdm_Region');
        const abv = getVal('wdm_ABV'); // Stored as decimal 0.125
        const intensityCode = getVal('wdm_Intensity');
        const complexityCode = getVal('wdm_Complexity');
        const acidityCode = getVal('wdm_Acidity');
        const decant = getVal('wdm_Decant');
        const heterMechira = getVal('wdm_HeterMechira');
        const isMevushal = getVal('wdm_IsMevushal');
        
        // Comax-specific data
        const group = getCmxVal('cpm_Group');
        const vintage = getCmxVal('cpm_Vintage');
        const size = getCmxVal('cpm_Size');

        // --- Formatting Helpers ---
        const getLookupText = (code, lookupType, fallback = '') => {
            if (!code) return fallback;
            const map = lookupMaps[lookupType];
            const item = map ? map.get(String(code).trim().toUpperCase()) : null;
            if (!item) {
                // LoggerService.warn('WooCommerceFormatter', 'formatDescriptionHTML', `Lookup failed for code: ${code}, type: ${lookupType}`);
                return fallback;
            }
            if (lookupType === 'texts') return isEn ? item.slt_TextEN : item.slt_TextHE;
            if (lookupType === 'grapes') return isEn ? item.slg_TextEN : item.slg_NameHe;
            if (lookupType === 'kashrut') return isEn ? item.slk_TextEN : item.slk_TextHE;
            return fallback;
        };

                const addDetailLine = (labelEn, labelHe, value) => {
                    if (!value) return '';
                    const label = isEn ? labelEn : labelHe;
                    return `${label}: ${value}<br>\n`;
                };
        
                // --- HTML Construction ---
        
                // 1. Product Title
                if (name) html += `<b>${name}</b><br>\n`;
                html += '<hr>\n'; // Divider
        
                // 2. Short Description
                if (shortDescription) html += `${shortDescription}<br>\n`;
                html += '<hr>\n'; // Divider
        
                // 3. Product Title & Long Description
                if (name || longDescription) {
                    html += (name ? `${name}` : '') + (name && longDescription ? ' ' : '') + (longDescription ? `${longDescription}` : '');
                    html += '<br>\n';
                }
                
                html += '<br>\n'; // Blank line after description block as requested
        
                // 4. Details List
                // Order: Category, Vintage, ABV, Volume, Region, Grapes, Intensity, Complexity, Acidity, Harmonize, Contrast, Kashrut, Heter Mechira, Mevushal
                
                        // Category (Group from Comax)
                        if (group) html += addDetailLine('Category', 'קטגוריה', getLookupText(group, 'texts', group));
                        // Vintage
                        if (vintage) html += addDetailLine('Vintage', 'שנת בציר', vintage);
                        // ABV
                        if (abv) {
                             // Ensure abv is a number
                             const abvNum = parseFloat(abv);
                             if (!isNaN(abvNum)) {
                                  html += addDetailLine('Alcohol', 'אלכוהול', `${(abvNum * 100).toFixed(1)}%`);
                             } else {
                                  // Fallback if it's already formatted or text
                                  html += addDetailLine('Alcohol', 'אלכוהול', abv);
                             }
                        }
                        // Volume (Size from Comax)
                        if (size) html += addDetailLine('Volume', 'גודל', `${size} ${isEn ? 'ML' : 'מ”ל'}`);
                        // Region
                        if (regionCode) html += addDetailLine('Region', 'אזור', getLookupText(regionCode, 'texts', regionCode));
                
                        // Grapes
                        const grapeCodes = ['wdm_GrapeG1', 'wdm_GrapeG2', 'wdm_GrapeG3', 'wdm_GrapeG4', 'wdm_GrapeG5'];
                        const grapeNames = [];
                        grapeCodes.forEach(codeKey => {
                            const code = getVal(codeKey);
                            if (code) grapeNames.push(getLookupText(code, 'grapes', code));
                        });
                        if (grapeNames.length > 0) html += addDetailLine('Grapes', 'זנים', grapeNames.join(', '));
                
                        // Intensity
                        if (intensityCode) html += addDetailLine('Intensity', 'עוצמה', intensityCode);
                        // Complexity
                        if (complexityCode) html += addDetailLine('Complexity', 'מורכבות', complexityCode);
                        // Acidity
                        if (acidityCode) html += addDetailLine('Acidity', 'חומציות', acidityCode);
                                
                // Pairing - Harmonize
                const harFlavors = [];
                if (getVal('wdm_PairHarMild') == 1) harFlavors.push(isEn ? 'Mild' : 'עדין');
                if (getVal('wdm_PairHarRich') == 1) harFlavors.push(isEn ? 'Rich' : 'עשיר');
                if (getVal('wdm_PairHarIntense') == 1) harFlavors.push(isEn ? 'Intense' : 'עוצמתי');
                if (getVal('wdm_PairHarSweet') == 1) harFlavors.push(isEn ? 'Sweet' : 'מתוק');
                if (harFlavors.length > 0) html += addDetailLine('Harmonize with', 'הרמוניה עם טעמים', harFlavors.join(isEn ? ' or ' : ' או ') + (isEn ? ' flavors' : ''));
        
                // Pairing - Contrast
                const conFlavors = [];
                if (getVal('wdm_PairConMild') == 1) conFlavors.push(isEn ? 'Mild' : 'עדין');
                if (getVal('wdm_PairConRich') == 1) conFlavors.push(isEn ? 'Rich' : 'עשיר');
                if (getVal('wdm_PairConIntense') == 1) conFlavors.push(isEn ? 'Intense' : 'עוצמתי');
                if (getVal('wdm_PairConSweet') == 1) conFlavors.push(isEn ? 'Sweet' : 'מתוק');
                if (conFlavors.length > 0) html += addDetailLine('Contrast with', 'קונטרסט עם טעמים', conFlavors.join(isEn ? ' or ' : ' או ') + (isEn ? ' flavors' : ''));

                // Decant
                if (decant) {
                    const decantText = isEn ? `Recommending decanting - ${decant} minutes` : `מומלץ לאוורור – ${decant} דקות`;
                    html += `${decantText}<br>\n`;
                }
                
                // Blank row
                html += '<br>\n';
        
                // Kashrut
                const kashrutCodes = ['wdm_KashrutK1', 'wdm_KashrutK2', 'wdm_KashrutK3', 'wdm_KashrutK4', 'wdm_KashrutK5'];
                const kashrutNames = [];
                kashrutCodes.forEach(codeKey => {
                    const code = getVal(codeKey);
                    if (code) kashrutNames.push(getLookupText(code, 'kashrut', code));
                });
                if (kashrutNames.length > 0) html += addDetailLine('Kashrut', 'כשרות', kashrutNames.join(', '));
        
                // Heter Mechira
                if (String(heterMechira) === 'true' || heterMechira === true) {
                    const hmText = isEn ? 'Heter Mechira' : 'היתר מכירה';
                    html += `<span style="color: #ff0000;"><b>${hmText}</b></span><br>\n`;
                }
                // Mevushal
                if (String(isMevushal) === 'true' || isMevushal === true) {
                     const mevText = isEn ? 'Mevushal' : 'מבושל';
                     html += `${mevText}<br>\n`;
                }
        
                // --- Appendices (Export Only) ---
                if (isForExport) {
                     const appendedParagraphs = [];
                     const lastDigit = String(sku).slice(-1);
                     const promoKey = 'P' + lastDigit;
                     const promoText = getLookupText(promoKey, 'texts');
                     if (promoText) appendedParagraphs.push(`<b>* ${promoText}</b>`);
        
                     if (intensityCode) {
                         const intensityKey = 'IN0' + intensityCode;
                         const text = getLookupText(intensityKey, 'texts');
                         if (text) appendedParagraphs.push(text);
                     }
                     if (complexityCode) {
                         const complexityKey = 'CO0' + complexityCode;
                         const text = getLookupText(complexityKey, 'texts');
                         if (text) appendedParagraphs.push(text);
                     }
                     if (acidityCode) {
                         const match = String(acidityCode).match(/\d+/);
                         if (match) {
                              const acidityKey = 'AC0' + match[0];
                              const text = getLookupText(acidityKey, 'texts');
                              if (text) appendedParagraphs.push(text);
                         }
                     }
        
                     const flavorDefinitions = [
                         { code: 'MILD', har: 'wdm_PairHarMild', con: 'wdm_PairConMild', labelEn: 'Mild', labelHe: 'עדין' },
                         { code: 'RICH', har: 'wdm_PairHarRich', con: 'wdm_PairConRich', labelEn: 'Rich', labelHe: 'עשיר' },
                         { code: 'INTENSE', har: 'wdm_PairHarIntense', con: 'wdm_PairConIntense', labelEn: 'Intense', labelHe: 'עוצמתי' },
                         { code: 'SWEET', har: 'wdm_PairHarSweet', con: 'wdm_PairConSweet', labelEn: 'Sweet', labelHe: 'מתוק' }
                     ];
        
                     // Harmonize Bullets
                     const activeHar = flavorDefinitions.filter(def => getVal(def.har) == 1);
                     if (activeHar.length > 0) {
                         const block = [];
                         const header = getLookupText('HARMONIZE', 'texts');
                         if (header) block.push(header);
                         
                         const bullets = [];
                         activeHar.forEach(def => {
                             const desc = getLookupText(def.code, 'texts');
                             if (desc) {
                                 // For export, we use the full text from the lookup, no prefix
                                 bullets.push(`• ${desc}`);
                             }
                         });
                         if (bullets.length > 0) block.push(bullets.join('<br>\n'));
                         if (block.length > 0) appendedParagraphs.push(block.join('<br>\n'));
                     }
        
                     // Contrast Bullets
                     const activeCon = flavorDefinitions.filter(def => getVal(def.con) == 1);
                     if (activeCon.length > 0) {
                         const block = [];
                         const header = getLookupText('CONTRAST', 'texts');
                         if (header) block.push(header);
                         
                         const bullets = [];
                         activeCon.forEach(def => {
                             const desc = getLookupText(def.code, 'texts');
                             if (desc) {
                                 // For export, we use the full text from the lookup, no prefix
                                 bullets.push(`• ${desc}`);
                             }
                         });
                         if (bullets.length > 0) block.push(bullets.join('<br>\n'));
                         if (block.length > 0) appendedParagraphs.push(block.join('<br>\n'));
                     }
        
                     if (appendedParagraphs.length > 0) {
                         html += '<br>\n';
                         html += appendedParagraphs.join('<br>\n'); 
                     }
                }
        
                return html;
            }  };

})();
