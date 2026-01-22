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

        // ========== TOGGLE: Set to false to use original formatting ==========
        const USE_NEW_FORMATTING = true;
        // =====================================================================

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
                return fallback;
            }
            if (lookupType === 'texts') return isEn ? item.slt_TextEN : item.slt_TextHE;
            if (lookupType === 'grapes') return isEn ? item.slg_TextEN : item.slg_TextHE;
            if (lookupType === 'kashrut') return isEn ? item.slk_TextEN : item.slk_TextHE;
            return fallback;
        };

        const addDetailLine = (labelEn, labelHe, value) => {
            if (!value) return '';
            const label = isEn ? labelEn : labelHe;
            return `${label}: ${value}\n`;
        };

        // Helper: join array with commas and 'or'/'או' before last item
        const joinWithOr = (arr) => {
            if (arr.length <= 1) return arr.join('');
            if (arr.length === 2) return arr.join(isEn ? ' or ' : ' או ');
            return arr.slice(0, -1).join(', ') + (isEn ? ' or ' : ' או ') + arr[arr.length - 1];
        };

        // --- HTML Construction ---

        // Preview-only: Title and Short Description with HR dividers
        if (!isForExport) {
            if (name) {
                html += `<b>${name}</b>`;
                html += '<hr>';
            }
            if (shortDescription) {
                html += `${shortDescription}`;
                html += '<hr>';
            }
        }

        // Long Description
        if (name || longDescription) {
            html += (name ? name : '') + (name && longDescription ? ' ' : '') + (longDescription ? longDescription : '');
            html += '<br>';
        }

        // ========== NEW FORMATTING ==========
        if (USE_NEW_FORMATTING) {
            // Build detail data
            const col1Lines = [];
            const col2Lines = [];

            // Column 1: Category, Vintage, ABV, Volume, Region, Grapes
            if (group) {
                const categoryName = getLookupText(group, 'texts', group);
                if (categoryName) col1Lines.push(categoryName);
            }
            if (vintage) col1Lines.push(`${isEn ? 'Vintage' : 'שנת בציר'}: ${vintage}`);
            if (abv) {
                const abvNum = parseFloat(abv);
                const abvDisplay = !isNaN(abvNum) ? `${(abvNum * 100).toFixed(1)}%` : abv;
                col1Lines.push(`${isEn ? 'Alcohol' : 'אלכוהול'}: ${abvDisplay}`);
            }
            if (size) col1Lines.push(`${isEn ? 'Volume' : 'גודל'}: ${size} ${isEn ? 'ML' : 'מ"ל'}`);
            if (regionCode) col1Lines.push(`${isEn ? 'Region' : 'אזור'}: ${getLookupText(regionCode, 'texts', regionCode)}`);

            const grapeCodes = ['wdm_GrapeG1', 'wdm_GrapeG2', 'wdm_GrapeG3', 'wdm_GrapeG4', 'wdm_GrapeG5'];
            const grapeNames = [];
            grapeCodes.forEach(codeKey => {
                const code = getVal(codeKey);
                if (code) grapeNames.push(getLookupText(code, 'grapes', code));
            });
            if (grapeNames.length > 0) col1Lines.push(`${isEn ? 'Grapes' : 'ענב(ים)'}: ${grapeNames.join(', ')}`);

            // Column 2: Intensity, Complexity, Acidity, Pairing, Decant, Kashrut
            if (intensityCode) {
                const circles = getLookupText('CIRCLES' + intensityCode, 'texts', '');
                const label = getLookupText('LABEL_IN' + intensityCode, 'texts', intensityCode);
                col2Lines.push(`${isEn ? 'Intensity' : 'עוצמה'}: ${circles} ${label}`);
            }
            if (complexityCode) {
                const circles = getLookupText('CIRCLES' + complexityCode, 'texts', '');
                const label = getLookupText('LABEL_CO' + complexityCode, 'texts', complexityCode);
                col2Lines.push(`${isEn ? 'Complexity' : 'מורכבות'}: ${circles} ${label}`);
            }
            if (acidityCode) {
                const circles = getLookupText('CIRCLES' + acidityCode, 'texts', '');
                const label = getLookupText('LABEL_AC' + acidityCode, 'texts', acidityCode);
                col2Lines.push(`${isEn ? 'Acidity' : 'חומציות'}: ${circles} ${label}`);
            }

            // Pairing
            const harFlavors = [];
            if (getVal('wdm_PairHarMild') == 1) harFlavors.push(isEn ? 'mild' : 'עדינים');
            if (getVal('wdm_PairHarRich') == 1) harFlavors.push(isEn ? 'rich' : 'עשירים');
            if (getVal('wdm_PairHarIntense') == 1) harFlavors.push(isEn ? 'intense' : 'עזים');
            if (getVal('wdm_PairHarSweet') == 1) harFlavors.push(isEn ? 'sweet' : 'מתוקים');
            if (harFlavors.length > 0) {
                col2Lines.push(`${isEn ? 'Harmonize with' : 'הרמוניה עם טעמים'}: ${joinWithOr(harFlavors)}${isEn ? ' flavors' : ''}`);
            }

            const conFlavors = [];
            if (getVal('wdm_PairConMild') == 1) conFlavors.push(isEn ? 'mild' : 'עדינים');
            if (getVal('wdm_PairConRich') == 1) conFlavors.push(isEn ? 'rich' : 'עשירים');
            if (getVal('wdm_PairConIntense') == 1) conFlavors.push(isEn ? 'intense' : 'עזים');
            if (getVal('wdm_PairConSweet') == 1) conFlavors.push(isEn ? 'sweet' : 'מתוקים');
            if (conFlavors.length > 0) {
                col2Lines.push(`${isEn ? 'Contrast with' : 'קונטרסט עם טעמים'}: ${joinWithOr(conFlavors)}${isEn ? ' flavors' : ''}`);
            }

            if (decant) {
                col2Lines.push(isEn ? `Decant: ${decant} minutes` : `אוורור: ${decant} דקות`);
            }

            // Kashrut
            const kashrutCodes = ['wdm_KashrutK1', 'wdm_KashrutK2', 'wdm_KashrutK3', 'wdm_KashrutK4', 'wdm_KashrutK5'];
            const kashrutNames = [];
            kashrutCodes.forEach(codeKey => {
                const code = getVal(codeKey);
                if (code) kashrutNames.push(getLookupText(code, 'kashrut', code));
            });
            if (kashrutNames.length > 0) {
                col2Lines.push(`${isEn ? 'Kashrut' : 'כשרות'}: ${kashrutNames.join(', ')}`);
            }
            if (String(heterMechira) === 'true' || heterMechira === true) {
                col2Lines.push(`<span style="color:#c00;"><b>${isEn ? 'Heter Mechira' : 'היתר מכירה'}</b></span>`);
            }
            if (String(isMevushal) === 'true' || isMevushal === true) {
                col2Lines.push(isEn ? 'Mevushal' : 'מבושל');
            }

            // Build two-column table
            if (col1Lines.length > 0 || col2Lines.length > 0) {
                const dir = isEn ? 'ltr' : 'rtl';
                const textAlign = isEn ? 'left' : 'right';
                const borderSide = isEn ? 'border-right' : 'border-left';
                html += `<br><table style="width:100%; border:1px solid #e0e0e0; background:#fafafa; border-collapse:collapse; margin:10px 0;" dir="${dir}">`;
                html += `<tr>`;
                html += `<td style="vertical-align:top; padding:12px; width:50%; ${borderSide}:1px solid #e0e0e0; text-align:${textAlign};">${col1Lines.join('<br>')}</td>`;
                html += `<td style="vertical-align:top; padding:12px; width:50%; text-align:${textAlign};">${col2Lines.join('<br>')}</td>`;
                html += `</tr></table>`;
            }

            // --- Appendices (Export Only) - NEW FORMAT ---
            if (isForExport) {
                const appendedParagraphs = [];

                // 1. Promo text with styled box
                const lastDigit = String(sku).slice(-1);
                const promoKey = 'P' + lastDigit;
                const promoText = getLookupText(promoKey, 'texts');
                if (promoText) {
                    appendedParagraphs.push(`<div style="background:#f8f4e6; border-left:4px solid #c9a227; padding:12px; margin:10px 0;"><strong>★</strong> ${promoText}</div>`);
                }

                // 2. Attribute paragraphs with styled headers
                // Header style: wine color, bold (matches Harmonize/Contrast)
                const headerStyle = 'color:#722f37;';
                // Link style: slightly smaller, wine color, bold
                const linkStyle = 'font-size:0.9em; color:#722f37; font-weight:600; text-decoration:none;';
                // Arrow direction: right for LTR (EN), left for RTL (HE)
                const arrow = isEn ? '→' : '←';

                if (intensityCode) {
                    const intensityKey = 'IN0' + intensityCode;
                    const text = getLookupText(intensityKey, 'texts');
                    const url = getLookupText('URL_INTENSITY', 'texts');
                    const label = getLookupText('LABEL_IN' + intensityCode, 'texts', intensityCode);
                    if (text) {
                        const header = `<strong style="${headerStyle}">${isEn ? 'Intensity:' : 'עוצמה:'}</strong> ${label} (${intensityCode} ${isEn ? 'of' : 'מתוך'} 5)`;
                        const readMore = url ? ` <a href="${url}" style="${linkStyle}">${isEn ? 'Read more' : 'קראו עוד'} ${arrow}</a>` : '';
                        appendedParagraphs.push(`<p>${header} – ${text}${readMore}</p>`);
                    }
                }
                if (complexityCode) {
                    const complexityKey = 'CO0' + complexityCode;
                    const text = getLookupText(complexityKey, 'texts');
                    const url = getLookupText('URL_COMPLEXITY', 'texts');
                    const label = getLookupText('LABEL_CO' + complexityCode, 'texts', complexityCode);
                    if (text) {
                        const header = `<strong style="${headerStyle}">${isEn ? 'Complexity:' : 'מורכבות:'}</strong> ${label} (${complexityCode} ${isEn ? 'of' : 'מתוך'} 5)`;
                        const readMore = url ? ` <a href="${url}" style="${linkStyle}">${isEn ? 'Read more' : 'קראו עוד'} ${arrow}</a>` : '';
                        appendedParagraphs.push(`<p>${header} – ${text}${readMore}</p>`);
                    }
                }
                if (acidityCode) {
                    const match = String(acidityCode).match(/\d+/);
                    if (match) {
                        const level = match[0];
                        const acidityKey = 'AC0' + level;
                        const text = getLookupText(acidityKey, 'texts');
                        const url = getLookupText('URL_ACIDITY', 'texts');
                        const label = getLookupText('LABEL_AC' + level, 'texts', level);
                        if (text) {
                            const header = `<strong style="${headerStyle}">${isEn ? 'Acidity:' : 'חומציות:'}</strong> ${label} (${level} ${isEn ? 'of' : 'מתוך'} 5)`;
                            const readMore = url ? ` <a href="${url}" style="${linkStyle}">${isEn ? 'Read more' : 'קראו עוד'} ${arrow}</a>` : '';
                            appendedParagraphs.push(`<p>${header} – ${text}${readMore}</p>`);
                        }
                    }
                }

                // 3. Pairing sections with bold headers and flavor terms
                const flavorDefinitions = [
                    { code: 'MILD', har: 'wdm_PairHarMild', con: 'wdm_PairConMild', labelEn: 'Mild flavors', labelHe: 'טעמים עדינים' },
                    { code: 'RICH', har: 'wdm_PairHarRich', con: 'wdm_PairConRich', labelEn: 'Rich flavors', labelHe: 'טעמים עשירים' },
                    { code: 'INTENSE', har: 'wdm_PairHarIntense', con: 'wdm_PairConIntense', labelEn: 'Intense flavors', labelHe: 'טעמים עזים' },
                    { code: 'SWEET', har: 'wdm_PairHarSweet', con: 'wdm_PairConSweet', labelEn: 'Sweet flavors', labelHe: 'טעמים מתוקים' }
                ];

                // Harmonize section
                const activeHar = flavorDefinitions.filter(def => getVal(def.har) == 1);
                if (activeHar.length > 0) {
                    const header = getLookupText('HARMONIZE', 'texts');
                    let block = `<p><strong style="${headerStyle}">${isEn ? 'Harmonizing:' : 'הרמוניה:'}</strong> ${header || ''}</p>`;

                    const bullets = activeHar.map(def => {
                        const desc = getLookupText(def.code, 'texts');
                        const flavorLabel = isEn ? def.labelEn : def.labelHe;
                        return `• <strong>${flavorLabel}:</strong> ${desc}`;
                    });
                    block += `<p>${bullets.join('<br>')}</p>`;
                    appendedParagraphs.push(block);
                }

                // Contrast section
                const activeCon = flavorDefinitions.filter(def => getVal(def.con) == 1);
                if (activeCon.length > 0) {
                    const header = getLookupText('CONTRAST', 'texts');
                    let block = `<p><strong style="${headerStyle}">${isEn ? 'Contrasting:' : 'קונטרסט:'}</strong> ${header || ''}</p>`;

                    const bullets = activeCon.map(def => {
                        const desc = getLookupText(def.code, 'texts');
                        const flavorLabel = isEn ? def.labelEn : def.labelHe;
                        return `• <strong>${flavorLabel}:</strong> ${desc}`;
                    });
                    block += `<p>${bullets.join('<br>')}</p>`;
                    appendedParagraphs.push(block);
                }

                // Single "Read more" link after pairing sections
                if (activeHar.length > 0 || activeCon.length > 0) {
                    const pairingUrl = getLookupText('URL_PAIRING', 'texts');
                    if (pairingUrl) {
                        appendedParagraphs.push(`<p><a href="${pairingUrl}" style="${linkStyle}">${isEn ? 'Read more about food pairing' : 'קראו עוד על התאמה'} ${arrow}</a></p>`);
                    }
                }

                if (appendedParagraphs.length > 0) {
                    html += '<br>\n';
                    html += appendedParagraphs.join('\n');
                }
            }
        }
        // ========== END NEW FORMATTING ==========

        // ========== ORIGINAL FORMATTING (disabled when USE_NEW_FORMATTING = true) ==========
        if (!USE_NEW_FORMATTING) {
            const hasDetailFields = group || vintage || abv || size || regionCode || intensityCode || complexityCode || acidityCode || decant ||
                getVal('wdm_GrapeG1') || getVal('wdm_GrapeG2') || getVal('wdm_GrapeG3') || getVal('wdm_GrapeG4') || getVal('wdm_GrapeG5') ||
                getVal('wdm_PairHarMild') || getVal('wdm_PairHarRich') || getVal('wdm_PairHarIntense') || getVal('wdm_PairHarSweet') ||
                getVal('wdm_PairConMild') || getVal('wdm_PairConRich') || getVal('wdm_PairConIntense') || getVal('wdm_PairConSweet');

            if (hasDetailFields) {
                html += '<br>';
            }

            if (group) {
                const categoryName = getLookupText(group, 'texts', group);
                if (categoryName) html += `${categoryName}\n`;
            }
            if (vintage) html += addDetailLine('Vintage', 'שנת בציר', vintage);
            if (abv) {
                const abvNum = parseFloat(abv);
                if (!isNaN(abvNum)) {
                    html += addDetailLine('Alcohol', 'אלכוהול', `${(abvNum * 100).toFixed(1)}%`);
                } else {
                    html += addDetailLine('Alcohol', 'אלכוהול', abv);
                }
            }
            if (size) html += addDetailLine('Volume', 'גודל', `${size} ${isEn ? 'ML' : 'מ"ל'}`);
            if (regionCode) html += addDetailLine('Region', 'אזור', getLookupText(regionCode, 'texts', regionCode));

            const grapeCodes = ['wdm_GrapeG1', 'wdm_GrapeG2', 'wdm_GrapeG3', 'wdm_GrapeG4', 'wdm_GrapeG5'];
            const grapeNames = [];
            grapeCodes.forEach(codeKey => {
                const code = getVal(codeKey);
                if (code) grapeNames.push(getLookupText(code, 'grapes', code));
            });
            if (grapeNames.length > 0) html += addDetailLine('Grapes', 'ענב(ים)', grapeNames.join(', '));

            if (intensityCode) {
                const circles = getLookupText('CIRCLES' + intensityCode, 'texts', '');
                const label = getLookupText('LABEL_IN' + intensityCode, 'texts', intensityCode);
                html += addDetailLine('Intensity', 'עוצמה', circles + ' ' + label);
            }
            if (complexityCode) {
                const circles = getLookupText('CIRCLES' + complexityCode, 'texts', '');
                const label = getLookupText('LABEL_CO' + complexityCode, 'texts', complexityCode);
                html += addDetailLine('Complexity', 'מורכבות', circles + ' ' + label);
            }
            if (acidityCode) {
                const circles = getLookupText('CIRCLES' + acidityCode, 'texts', '');
                const label = getLookupText('LABEL_AC' + acidityCode, 'texts', acidityCode);
                html += addDetailLine('Acidity', 'חומציות', circles + ' ' + label);
            }

            const harFlavors = [];
            if (getVal('wdm_PairHarMild') == 1) harFlavors.push(isEn ? 'mild' : 'עדינים');
            if (getVal('wdm_PairHarRich') == 1) harFlavors.push(isEn ? 'rich' : 'עשירים');
            if (getVal('wdm_PairHarIntense') == 1) harFlavors.push(isEn ? 'intense' : 'עזים');
            if (getVal('wdm_PairHarSweet') == 1) harFlavors.push(isEn ? 'sweet' : 'מתוקים');
            if (harFlavors.length > 0) html += addDetailLine('Harmonize with', 'הרמוניה עם טעמים', joinWithOr(harFlavors) + (isEn ? ' flavors' : ''));

            const conFlavors = [];
            if (getVal('wdm_PairConMild') == 1) conFlavors.push(isEn ? 'mild' : 'עדינים');
            if (getVal('wdm_PairConRich') == 1) conFlavors.push(isEn ? 'rich' : 'עשירים');
            if (getVal('wdm_PairConIntense') == 1) conFlavors.push(isEn ? 'intense' : 'עזים');
            if (getVal('wdm_PairConSweet') == 1) conFlavors.push(isEn ? 'sweet' : 'מתוקים');
            if (conFlavors.length > 0) html += addDetailLine('Contrast with', 'קונטרסט עם טעמים', joinWithOr(conFlavors) + (isEn ? ' flavors' : ''));

            if (decant) {
                const decantText = isEn ? `Recommending decanting - ${decant} minutes` : `מומלץ לאוורור – ${decant} דקות`;
                html += `${decantText}\n`;
            }

            const kashrutCodes = ['wdm_KashrutK1', 'wdm_KashrutK2', 'wdm_KashrutK3', 'wdm_KashrutK4', 'wdm_KashrutK5'];
            const kashrutNames = [];
            kashrutCodes.forEach(codeKey => {
                const code = getVal(codeKey);
                if (code) kashrutNames.push(getLookupText(code, 'kashrut', code));
            });

            const hasKashrutSection = kashrutNames.length > 0 ||
                (String(heterMechira) === 'true' || heterMechira === true) ||
                (String(isMevushal) === 'true' || isMevushal === true);

            if (hasKashrutSection) {
                html += '<br>';
            }

            if (kashrutNames.length > 0) html += addDetailLine('Kashrut', 'כשרות', kashrutNames.join(', '));

            if (String(heterMechira) === 'true' || heterMechira === true) {
                const hmText = isEn ? 'Heter Mechira' : 'היתר מכירה';
                html += `<span style="color: #ff0000;"><b>${hmText}</b></span>\n`;
            }
            if (String(isMevushal) === 'true' || isMevushal === true) {
                const mevText = isEn ? 'Mevushal' : 'מבושל';
                html += `${mevText}\n`;
            }

            // --- Appendices (Export Only) - ORIGINAL ---
            if (isForExport) {
                const appendedParagraphs = [];
                const lastDigit = String(sku).slice(-1);
                const promoKey = 'P' + lastDigit;
                const promoText = getLookupText(promoKey, 'texts');
                if (promoText) appendedParagraphs.push(`<b>* ${promoText}</b>`);

                if (intensityCode) {
                    const intensityKey = 'IN0' + intensityCode;
                    const text = getLookupText(intensityKey, 'texts');
                    const url = getLookupText('URL_INTENSITY', 'texts');
                    if (text) {
                        const linkedText = url ? `<a href="${url}">${text}</a>` : text;
                        appendedParagraphs.push(linkedText);
                    }
                }
                if (complexityCode) {
                    const complexityKey = 'CO0' + complexityCode;
                    const text = getLookupText(complexityKey, 'texts');
                    const url = getLookupText('URL_COMPLEXITY', 'texts');
                    if (text) {
                        const linkedText = url ? `<a href="${url}">${text}</a>` : text;
                        appendedParagraphs.push(linkedText);
                    }
                }
                if (acidityCode) {
                    const match = String(acidityCode).match(/\d+/);
                    if (match) {
                        const acidityKey = 'AC0' + match[0];
                        const text = getLookupText(acidityKey, 'texts');
                        const url = getLookupText('URL_ACIDITY', 'texts');
                        if (text) {
                            const linkedText = url ? `<a href="${url}">${text}</a>` : text;
                            appendedParagraphs.push(linkedText);
                        }
                    }
                }

                const flavorDefinitions = [
                    { code: 'MILD', har: 'wdm_PairHarMild', con: 'wdm_PairConMild', labelEn: 'Mild', labelHe: 'עדין' },
                    { code: 'RICH', har: 'wdm_PairHarRich', con: 'wdm_PairConRich', labelEn: 'Rich', labelHe: 'עשיר' },
                    { code: 'INTENSE', har: 'wdm_PairHarIntense', con: 'wdm_PairConIntense', labelEn: 'Intense', labelHe: 'עוצמתי' },
                    { code: 'SWEET', har: 'wdm_PairHarSweet', con: 'wdm_PairConSweet', labelEn: 'Sweet', labelHe: 'מתוק' }
                ];

                const activeHar = flavorDefinitions.filter(def => getVal(def.har) == 1);
                if (activeHar.length > 0) {
                    const block = [];
                    const header = getLookupText('HARMONIZE', 'texts');
                    if (header) block.push(header);
                    const bullets = [];
                    activeHar.forEach(def => {
                        const desc = getLookupText(def.code, 'texts');
                        if (desc) bullets.push(`• ${desc}`);
                    });
                    if (bullets.length > 0) block.push(bullets.join('<br>\n'));
                    if (block.length > 0) appendedParagraphs.push(block.join('<br>\n'));
                }

                const activeCon = flavorDefinitions.filter(def => getVal(def.con) == 1);
                if (activeCon.length > 0) {
                    const block = [];
                    const header = getLookupText('CONTRAST', 'texts');
                    if (header) block.push(header);
                    const bullets = [];
                    activeCon.forEach(def => {
                        const desc = getLookupText(def.code, 'texts');
                        if (desc) bullets.push(`• ${desc}`);
                    });
                    if (bullets.length > 0) block.push(bullets.join('<br>\n'));
                    if (block.length > 0) appendedParagraphs.push(block.join('<br>\n'));
                }

                if (appendedParagraphs.length > 0) {
                    html += '<br>\n';
                    html += appendedParagraphs.join('<br>\n<br>\n');
                }
            }
        }
        // ========== END ORIGINAL FORMATTING ==========

                // Cleanup: Remove excessive consecutive <br> tags and trailing blanks
                html = html.replace(/(<br>\s*\n){3,}/g, '<br>\n<br>\n'); // Max 2 consecutive blank lines
                html = html.replace(/(<br>\s*\n)+$/, ''); // Remove trailing <br> tags

                return html;
            }  };

})();
