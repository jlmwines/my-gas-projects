/**
 * @file DetailsReview.gs
 * @description Backend script to populate/process product detail updates.
 * @version 25-08-07-13-05 ABV % fixed - add CODE column
 */

// --- CONFIGURATION CONSTANTS ---
const PR_SHEETS = {
    REVIEW: 'Product Detail Review',
    TASKQ: 'TaskQ',
    DETAILS_S: 'DetailsS',
    DETAILS_M: 'DetailsM',
    WEHE: 'WeHe',
    COMAX_M: 'ComaxM',
    GRAPES: 'Grapes',
    KASHRUT: 'Kashrut',
    TEXTS: 'Texts'
};

/**
 * Main function to load pending product detail reviews into a dedicated sheet.
 */
function loadProductDetailReviews() {
    const ui = SpreadsheetApp.getUi();
    try {
        SpreadsheetApp.flush();
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetName = PR_SHEETS.REVIEW;
        let reviewSheet = ss.getSheetByName(sheetName);

        if (!reviewSheet) {
            const allSheets = ss.getSheets();
            for (let i = 0; i < allSheets.length; i++) {
                if (allSheets[i].getName().trim() === sheetName) {
                    reviewSheet = allSheets[i];
                    break;
                }
            }
        }

        // 1. Create or clear the review sheet
        if (!reviewSheet) {
            reviewSheet = ss.insertSheet(expectedSheetName);
            const headers = ["Approve", "SKU", "Product Name", "Short Description", "English Preview", "Hebrew Preview", "תיאור קצר"];
            reviewSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        } else {
            reviewSheet.getRange(2, 1, reviewSheet.getMaxRows() - 1, reviewSheet.getMaxColumns()).clearContent();
        }
        reviewSheet.setFrozenRows(1);
        reviewSheet.setFrozenColumns(2);

        SpreadsheetApp.setActiveSheet(reviewSheet);

        // 2. Get data from all necessary reference sheets
        const referenceSs = SpreadsheetApp.openById(activeConfig.referenceFileId);
        const taskqSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.TASKQ);
        const detailsSSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.DETAILS_S);
        const comaxMSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.COMAX_M);
        
        const taskqData = taskqSheet.getDataRange().getValues();
        const detailsSData = detailsSSheet.getDataRange().getValues();
        const comaxMData = comaxMSheet.getDataRange().getValues();
        
        const taskqHeaders = taskqData.shift();
        const detailsSHeaders = detailsSData.shift();
        const comaxMHeaders = comaxMData.shift();
        
        // 3. Filter for relevant tasks
        const statusCol = taskqHeaders.indexOf('Status');
        const typeCol = taskqHeaders.indexOf('Type');
        const skuColTaskq = taskqHeaders.indexOf('RelatedEntity');

        const reviewTasks = taskqData.filter(row => 
            row[statusCol] === 'Review' && (row[typeCol] === 'Product Exception C6' || row[typeCol] === 'New Product')
        );

        if (reviewTasks.length === 0) {
            reviewSheet.getRange("A2").setValue("No product detail updates are currently awaiting review.");
            SpreadsheetApp.setActiveSheet(reviewSheet);
            return 'No product detail updates are currently awaiting review.';
        }

        // 4. Prepare all lookup data
        const lookupMaps = _getLookupMaps(referenceSs);
        const skuColDetailsS = detailsSHeaders.indexOf('SKU');
        const detailsSMap = new Map(detailsSData.map(row => [String(row[skuColDetailsS]).trim(), row]));
        const skuColComaxM = comaxMHeaders.indexOf('CMX SKU');
        const comaxMMap = new Map(comaxMData.map(row => [String(row[skuColComaxM]).trim(), row]));

        // 5. Build the rows for the review sheet
        const rowsToWrite = reviewTasks.map(taskRow => {
            const sku = String(taskRow[skuColTaskq]).trim();
            const submittedDataRow = detailsSMap.get(sku);
            const comaxDataRow = comaxMMap.get(sku);
            if (!submittedDataRow || !comaxDataRow) return null;

            const getSVal = (header) => submittedDataRow[detailsSHeaders.indexOf(header)] || '';

            let shortDescEn = getSVal('Short');
            let shortDescHe = getSVal('קצר');

            if (getSVal('היתר מכירה') == 1) {
                shortDescEn += ' *** Heter Mechira ***';
                shortDescHe += ' *** היתר מכירה ***';
            }

            return [
                false, 
                sku,
                getSVal('NAME') || 'N/A',
                shortDescEn,
                compileReviewDescription_(submittedDataRow, detailsSHeaders, comaxDataRow, comaxMHeaders, 'en', lookupMaps),
                compileReviewDescription_(submittedDataRow, detailsSHeaders, comaxDataRow, comaxMHeaders, 'he', lookupMaps),
                shortDescHe
            ];
        }).filter(Boolean);

        // 6. Write data and apply formatting
        if (rowsToWrite.length > 0) {
            const startRow = 2;
            const numRows = rowsToWrite.length;
            
            // Step A: Write the data
            reviewSheet.getRange(startRow, 1, numRows, rowsToWrite[0].length).setValues(rowsToWrite);
            SpreadsheetApp.flush(); // Force spreadsheet to apply pending changes

            // Step B: Apply formatting to the range that now has data
            const dataRange = reviewSheet.getRange(startRow, 1, numRows, rowsToWrite[0].length);
            dataRange.setWrap(true).setVerticalAlignment('top');
            reviewSheet.setRowHeights(startRow, numRows, 250);

            // Step C: Apply other specific formatting
            reviewSheet.getRange(startRow, 6, numRows, 1).setHorizontalAlignment('right'); // Hebrew
            const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
            reviewSheet.getRange(startRow, 1, numRows).setDataValidation(rule);
            reviewSheet.autoResizeColumns(1, 4);
            reviewSheet.setColumnWidth(5, 400); 
            reviewSheet.setColumnWidth(6, 400); 
        }
        
        SpreadsheetApp.setActiveSheet(reviewSheet);
        return `${rowsToWrite.length} item(s) have been loaded for review.`;

    } catch (e) {
        Logger.log(`CRITICAL ERROR: ${e.message}\nStack: ${e.stack}`);
        ui.alert(`Error`, `Failed to build the review sheet: ${e.message}`, ui.ButtonSet.OK);
    }
}

/**
 * Processes all approved product detail submissions from the review sheet.
 */
function processProductDetailApprovals() {
    const ui = SpreadsheetApp.getUi();
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const currentActiveSheet = ss.getActiveSheet();
        const currentActiveSheetName = currentActiveSheet.getName();
        const reviewSheet = ss.getSheetByName(PR_SHEETS.REVIEW);

        if (!reviewSheet) {
            return `Error: The expected sheet "${PR_SHEETS.REVIEW}" was not found. Please re-run the report.`;
        }

        if (currentActiveSheetName !== PR_SHEETS.REVIEW) {
            SpreadsheetApp.setActiveSheet(reviewSheet);
            // Note: We can't show an alert here as it would interrupt the flow.
            // The calling function in the sidebar should handle this.
        }

        // 1. Get approved rows from review sheet
        if (reviewSheet.getLastRow() < 2) {
            return 'Review sheet is empty.';
        }
        const reviewData = reviewSheet.getRange(2, 1, reviewSheet.getLastRow() - 1, reviewSheet.getLastColumn()).getValues();
        const reviewHeaders = reviewSheet.getRange(1, 1, 1, reviewSheet.getLastColumn()).getValues()[0];

        const approveColIdx = reviewHeaders.indexOf('Approve');
        const skuColIdx = reviewHeaders.indexOf('SKU');
        const approvedRows = reviewData.filter(row => row[approveColIdx] === true);

        if (approvedRows.length === 0) {
            return 'No items were selected for approval.';
        }

        // 2. Prepare all data sources
        let webOutSheet = ss.getSheetByName('WebOut');
        if (!webOutSheet) {
            webOutSheet = ss.insertSheet('WebOut');
        } else {
            webOutSheet.clear();
        }
        webOutSheet.getRange('A1:D1').setValues([['CODE', 'ID', 'Short Description', 'Description']]);
        
        const referenceSs = SpreadsheetApp.openById(activeConfig.referenceFileId);
        const detailsSSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.DETAILS_S);
        const detailsMSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.DETAILS_M);
        const comaxMSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.COMAX_M);
        const weheSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.WEHE);

        const detailsSData = detailsSSheet.getDataRange().getValues();
        const detailsMData = detailsMSheet.getDataRange().getValues();
        const comaxMData = comaxMSheet.getDataRange().getValues();
        const weheData = weheSheet.getDataRange().getValues();

        const detailsSHeaders = detailsSData.shift();
        const detailsMHeaders = detailsMData.shift();
        const comaxMHeaders = comaxMData.shift();
        const weheHeaders = weheData.shift();
        const taskqSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.TASKQ);
        const taskqData = taskqSheet.getDataRange().getValues();
        const taskqHeaders = taskqData.shift();
        const lookupMaps = _getLookupMaps(referenceSs);

        const weheSkuCol = _findHeaderIndex(weheHeaders, 'wpml:original_product_sku');
        const weheEnIdCol = _findHeaderIndex(weheHeaders, 'wpml:original_product_id');
        const weheHeIdCol = _findHeaderIndex(weheHeaders, 'ID');
        
        if (weheSkuCol === -1 || weheEnIdCol === -1 || weheHeIdCol === -1) {
          throw new Error('Could not find all required SKU/ID columns in the WeHe sheet. Verify headers: "wpml:original_product_sku", "ID", and "wpml:original_product_id".');
        }
        const weheMap = new Map(weheData.map(r => [ parseFloat(r[weheSkuCol]), { en: r[weheEnIdCol], he: r[weheHeIdCol] } ]));

        // 3. Process each approved item
        const approvedSKUs = new Set(approvedRows.map(row => row[skuColIdx]));
        let exportRows = [];

        const approvedSRowIndices = new Set();
        const skuColDetailsS = _findHeaderIndex(detailsSHeaders, 'SKU');
        const skuColDetailsM = _findHeaderIndex(detailsMHeaders, 'SKU');
        const taskqSkuCol = _findHeaderIndex(taskqHeaders, 'RelatedEntity');
        const taskqStatusCol = _findHeaderIndex(taskqHeaders, 'Status');
        const comaxSkuCol = _findHeaderIndex(comaxMHeaders, 'CMX SKU');
        
        for (const sku of approvedSKUs) {
            const sRowIndex = detailsSData.findIndex(r => String(r[skuColDetailsS]).trim() === String(sku).trim());
            const mRowIndex = detailsMData.findIndex(r => String(r[skuColDetailsM]).trim() === String(sku).trim());

            if (mRowIndex === -1 || sRowIndex === -1) {
                Logger.log(`Warning: Approved SKU "${sku}" not found in DetailsM and/or DetailsS. Skipping.`);
                continue;
            }

            // --- Perform in-memory updates ---
            
            // A. Update master record from submission record
            const sourceRow = detailsSData[sRowIndex];
            detailsSHeaders.forEach((header, i) => {
                const targetColIndex = detailsMHeaders.indexOf(header);
                if (targetColIndex > -1) {
                    detailsMData[mRowIndex][targetColIndex] = sourceRow[i];
                }
            });

            // B. Update task status to Accepted
            const taskqRowIndex = taskqData.findIndex(r => String(r[taskqSkuCol]).trim() === String(sku).trim() && r[taskqStatusCol] === 'Review');
            if (taskqRowIndex > -1) {
                taskqData[taskqRowIndex][taskqStatusCol] = 'Accepted';
            }

            // C. Mark submission row for deletion
            approvedSRowIndices.add(sRowIndex);

            // --- Generate export content using the newly updated master data ---
            const masterRowForExport = detailsMData[mRowIndex];
            const comaxRow = comaxMData.find(r => String(r[comaxSkuCol]).trim() === String(sku).trim());
            
            if (comaxRow) {
                exportRows.push(..._generateExportContent(sku, masterRowForExport, detailsMHeaders, comaxRow, comaxMHeaders, lookupMaps, weheMap));
            } else {
                Logger.log(`Warning: SKU "${sku}" not found in ComaxM for export generation. Skipping export for this item.`);
            }
        }

        // --- Save all in-memory changes back to the spreadsheets ---
        if (approvedSKUs.size > 0) {
            // A. Save updated master records to DetailsM sheet
            detailsMSheet.getRange(1, 1, detailsMData.length + 1, detailsMHeaders.length).setValues([detailsMHeaders, ...detailsMData]);

            // B. Save updated task statuses to TaskQ sheet
            taskqSheet.getRange(1, 1, taskqData.length + 1, taskqHeaders.length).setValues([taskqHeaders, ...taskqData]);

            // C. Remove processed rows from DetailsS sheet
            const newDetailsSData = detailsSData.filter((_, index) => !approvedSRowIndices.has(index));
            detailsSSheet.clear();
            if (newDetailsSData.length > 0) {
                detailsSSheet.getRange(1, 1, newDetailsSData.length + 1, detailsSHeaders.length).setValues([detailsSHeaders, ...newDetailsSData]);
            } else {
                // If all rows were processed, just write the headers back
                detailsSSheet.getRange(1, 1, 1, detailsSHeaders.length).setValues([detailsSHeaders]);
            }
        }

        // 4. Write to WebOut sheet and create CSV export
        let createdFileName = null;
        if (exportRows.length > 0) {
            // Part A: Write to WebOut for testing
            const startRow = webOutSheet.getLastRow() + 1;
            const numRows = exportRows.length;
            const numCols = exportRows[0].length;
            const dataRange = webOutSheet.getRange(startRow, 1, numRows, numCols);
            dataRange.setValues(exportRows);
            dataRange.setWrap(true).setVerticalAlignment('top');
            webOutSheet.setRowHeights(startRow, numRows, 250);
            webOutSheet.autoResizeColumn(1);
            webOutSheet.autoResizeColumn(2);
            webOutSheet.setColumnWidth(3, 400);
            webOutSheet.setColumnWidth(4, 400);

            // Part B: Create the CSV export from the in-memory array
            createdFileName = _createCsvExport(exportRows);
        }

        // --- Refresh the review sheet to show remaining items ---
        loadProductDetailReviews();
        let successMessage = `${approvedSKUs.size} item(s) were approved and processed:

` +
                           `• Master records were updated.
` +
                           `• Submission rows were removed.
` +
                           `• Task statuses were set to 'Accepted'.`;

        if (createdFileName) {
            successMessage += `

A CSV export file named "${createdFileName}" was also created.`;
        } else if (approvedSKUs.size > 0) {
            successMessage += `

No CSV file was created as there was no exportable data.`;
        }
        ui.alert('Approval Process Complete', successMessage, ui.ButtonSet.OK);

    } catch (e) {
        Logger.log(`Failed to process approvals: ${e.message}\nStack: ${e.stack}`);
        ui.alert('Error', `An error occurred during the approval process: ${e.message}`, ui.ButtonSet.OK);
    }
}


// --- HELPER FUNCTIONS ---

/**
 * Generates the enriched export content for the WebOut file.
 */
function _generateExportContent(sku, masterRow, masterHeaders, comaxRow, comaxHeaders, lookupMaps, weheMap) {
    const getVal = (header) => masterRow[masterHeaders.indexOf(header)] || '';

    let shortDescEn = getVal('Short') || '';
    let shortDescHe = getVal('קצר') || '';
    if (getVal('היתר מכירה') == 1) {
    shortDescEn += ' <span style="color: red; font-weight: bold;">Heter Mechira</span>';
    shortDescHe += ' <span style="color: red; font-weight: bold;">היתר מכירה</span>';
}
    
    // Call the new export-specific description generator
    const longDescEn = compileExportDescription_(sku, masterRow, masterHeaders, comaxRow, comaxHeaders, 'en', lookupMaps);
    const longDescHe = compileExportDescription_(sku, masterRow, masterHeaders, comaxRow, comaxHeaders, 'he', lookupMaps);

    const ids = weheMap.get(parseFloat(sku));
    if (!ids) {
        Logger.log(`Warning: SKU "${sku}" not found in WeHe sheet. Cannot export.`);
        return [];
    }

    const enRow = [sku, ids.en, shortDescEn, longDescEn];
    const heRow = [sku, ids.he, shortDescHe, longDescHe];

    return [enRow, heRow];
}


/**
 * Gets a sheet by name or throws an error.
 */
function _getSheetOrThrow(spreadsheet, sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Required sheet "${sheetName}" was not found in spreadsheet "${spreadsheet.getName()}".`);
    }
    return sheet;
}

/**
 * Finds a header in an array, ignoring whitespace.
 */
function _findHeaderIndex(headers, targetName) {
  const target = targetName.trim();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === target) {
      return i;
    }
  }
  return -1;
}

/**
 * Formats a list of items with a separator.
 */
function formatList_(items, isEn) {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    const separator = isEn ? ' or ' : ' או ';
    const allButLast = items.slice(0, -1).join(', ');
    return `${allButLast}${separator}${items.slice(-1)[0]}`;
}

/**
 * Builds and returns an object containing all necessary lookup maps.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} referenceSs The reference spreadsheet object.
 * @returns {Object} An object containing all the lookup maps.
 */
function _getLookupMaps(referenceSs) {
    const grapesData = _getSheetOrThrow(referenceSs, PR_SHEETS.GRAPES).getDataRange().getValues();
    const kashrutData = _getSheetOrThrow(referenceSs, PR_SHEETS.KASHRUT).getDataRange().getValues();
    const textsData = _getSheetOrThrow(referenceSs, PR_SHEETS.TEXTS).getDataRange().getValues();

    return {
        grapes_en: new Map(grapesData.map(d => [String(d[0]).toUpperCase(), d[1]])),
        grapes_he: new Map(grapesData.map(d => [String(d[0]).toUpperCase(), d[2]])),
        kashrut_en: new Map(kashrutData.map(d => [String(d[1]).toUpperCase(), d[2]])),
        kashrut_he: new Map(kashrutData.map(d => [String(d[1]).toUpperCase(), d[3]])),
        regions_en: new Map(textsData.filter(r => r[3] === 'Region').map(d => [d[0], d[1]])),
        regions_he: new Map(textsData.filter(r => r[3] === 'Region').map(d => [d[0], d[0]])),
        texts_en: new Map(textsData.map(d => [d[0], d[1]])),
        texts_he: new Map(textsData.map(d => [d[0], d[2]]))
    };
}

/**
         * Returns an object containing all language-specific labels and suffixes.
         * @param {string} lang The language code ('en' or 'he').
         * @returns {Object} An object of labels and suffixes.
         */
        function _getLabelsAndSuffixes(lang) {
            const isEn = lang === 'en';
            return {
                vintageLabel: isEn ? 'Vintage' : 'בציר',
                abvLabel: isEn ? 'ABV' : 'כוהל בנפח',
                volumeLabel: isEn ? 'Volume' : 'נפח',
                regionLabel: isEn ? 'Region' : 'אזור',
                grapeLabel: isEn ? 'Grape(s)' : 'ענב(ים)',
                intensityLabel: isEn ? 'Intensity (1-5)' : 'עוצמה (מ-1 עד 5)',
                complexityLabel: isEn ? 'Complexity (1-5)' : 'מורכבות (מ-1 עד 5)',
                acidityLabel: isEn ? 'Acidity (1-5)' : 'חומציות (מ-1 עד 5)',
                harmonizeLabel: isEn ? 'Harmonize with' : 'הרמוניה עם טעמים',
                contrastLabel: isEn ? 'Contrast with' : 'קונטרסט עם טעמים',
                decantLabel: isEn ? 'Recommended decanting' : 'מומלץ לאוורור',
                kashrutLabel: isEn ? 'Kashrut' : 'כשרות',
                flavorsSuffix: isEn ? ' flavors' : '',
                minutesSuffix: isEn ? ' minutes' : ' דקות',
                volumeSuffix: isEn ? ' ML' : ' מ”ל'
            };
        }

/**
 * Compiles the description string for the review sheet ONLY.
 * This function's output should remain stable.
 */
function compileReviewDescription_(detailsRow, detailsHeaders, comaxRow, comaxHeaders, lang, lookupMaps) {
    const getDetailsVal = (headerName) => {
        const index = detailsHeaders.indexOf(headerName);
        return index > -1 ? detailsRow[index] : undefined;
    };
    // --- START: CORRECTED CODE ---
    const getComaxVal = (headerName) => {
        const index = comaxHeaders.indexOf(headerName);
        return index > -1 ? comaxRow[index] : undefined;
    };
    // --- END: CORRECTED CODE ---

    let compiledLines = [];
    const isEn = lang === 'en';

    const {
        vintageLabel, abvLabel, volumeLabel, regionLabel, grapeLabel,
        intensityLabel, complexityLabel, acidityLabel, harmonizeLabel, contrastLabel,
        decantLabel, kashrutLabel, flavorsSuffix, minutesSuffix, volumeSuffix
    } = _getLabelsAndSuffixes(lang);

    // --- Language-specific maps ---
    const textMap = isEn ? lookupMaps.texts_en : lookupMaps.texts_he;
    const regionMap = isEn ? lookupMaps.regions_en : lookupMaps.regions_he;
    const grapeMap = isEn ? lookupMaps.grapes_en : lookupMaps.grapes_he;
    const kashrutMap = isEn ? lookupMaps.kashrut_en : lookupMaps.kashrut_he;
    const harMapping = isEn ? {'Sweet Har':'sweet', 'Intense Har':'intense', 'Rich Har':'rich', 'Mild Har':'mild'}
                                 : {'Sweet Har':'מתוקים', 'Intense Har':'עזים', 'Rich Har':'עשירים', 'Mild Har':'עדינים'};
    const conMapping = isEn ? {'Sweet Con':'sweet', 'Intense Con':'intense', 'Rich Con':'rich', 'Mild Con':'mild'}
                                 : {'Sweet Con':'מתוקים', 'Intense Con':'עזים', 'Rich Con':'עשירים', 'Mild Con':'עדינים'};

    // --- Section 1: Opening Paragraph ---
    const productName = isEn ? getDetailsVal('NAME') : getDetailsVal('שם היין');
    const longDesc = isEn ? getDetailsVal('Description') : getDetailsVal('תיאור ארוך');
    if (productName || longDesc) {
        compiledLines.push((productName ? `${productName} ` : '') + (longDesc || ''));
    }

    const addSectionBreak = () => { if (compiledLines.length > 0 && compiledLines[compiledLines.length - 1] !== '') compiledLines.push(''); };
    
    // --- Section 2: Detailed Attributes ---
    let combinedDetails = [];
    
    const groupKey = getComaxVal('CMX GROUP');
    if (groupKey && textMap.has(groupKey)) combinedDetails.push(textMap.get(groupKey));

    const vintage = getComaxVal('CMX YEAR');
    if (vintage) combinedDetails.push(`${vintageLabel}: ${vintage}`);
    
    const abv = getDetailsVal('ABV');
    if (abv) {
        const abvFormatted = (Number(abv) * 100).toFixed(1) + '%';
        combinedDetails.push(`${abvLabel}: ${abvFormatted}`);
    }

    const volume = getComaxVal('CMX SIZE');
    if (volume) combinedDetails.push(`${volumeLabel}: ${volume}${volumeSuffix}`);

    const regionKey = getDetailsVal('אזור');
    if (regionKey && regionMap.has(regionKey)) combinedDetails.push(`${regionLabel}: ${regionMap.get(regionKey)}`);
    
    const grapeKeys = [getDetailsVal('G1'), getDetailsVal('G2'), getDetailsVal('G3'), getDetailsVal('G4'), getDetailsVal('G5')]
        .map(g => String(g || '').toUpperCase()).filter(g => g && grapeMap.has(g)).map(g => grapeMap.get(g));
    if (grapeKeys.length > 0) combinedDetails.push(`${grapeLabel}: ${grapeKeys.join(', ')}`);

    const intensity = getDetailsVal('Intensity');
    if (intensity) combinedDetails.push(`${intensityLabel}: ${intensity}`);
    
    const complexity = getDetailsVal('Complexity');
    if (complexity) combinedDetails.push(`${complexityLabel}: ${complexity}`);

    const acidity = getDetailsVal('Acidity');
    if (acidity) combinedDetails.push(`${acidityLabel}: ${acidity}`);

    const harmonizes = Object.keys(harMapping).filter(f => getDetailsVal(f) == 1).map(f => harMapping[f]);
    if (harmonizes.length > 0) combinedDetails.push(`${harmonizeLabel}: ${formatList_(harmonizes, isEn)}${flavorsSuffix}`);
    
    const contrasts = Object.keys(conMapping).filter(f => getDetailsVal(f) == 1).map(f => conMapping[f]);
    if (contrasts.length > 0) combinedDetails.push(`${contrastLabel}: ${formatList_(contrasts, isEn)}${flavorsSuffix}`);

    const decant = getDetailsVal('Decant');
    if (decant) combinedDetails.push(`${decantLabel} – ${decant}${minutesSuffix}`);
    
    if (combinedDetails.length > 0) {
        addSectionBreak();
        compiledLines.push(...combinedDetails);
    }
    
    // --- Section 3: Kashrut ---
    let kashrutSection = [];
    const kashrutNames = [getDetailsVal('K1'), getDetailsVal('K2'), getDetailsVal('K3'), getDetailsVal('K4'), getDetailsVal('K5')]
        .map(k => String(k || '').toUpperCase()).filter(k => k && kashrutMap.has(k)).map(k => kashrutMap.get(k));
    if (kashrutNames.length > 0) {
        kashrutSection.push(`${kashrutLabel}: ${kashrutNames.join(', ')}`);
    }
    const heterMechira = getDetailsVal('היתר מכירה') == 1;
    if (heterMechira) {
        const heterMechiraText = isEn ? '*** Heter Mechira ***' : '*** היתר מכירה ***';
        if (kashrutSection.length > 0) {
            kashrutSection[0] += ` ${heterMechiraText}`;
        } else {
            kashrutSection.push(heterMechiraText);
        }
    }
    if (kashrutSection.length > 0) {
        addSectionBreak();
        compiledLines.push(...kashrutSection);
    }

    return compiledLines.join('\n');
}

/**
 * Compiles the enhanced description string for the final export output.
 */
function compileExportDescription_(sku, detailsRow, detailsHeaders, comaxRow, comaxHeaders, lang, lookupMaps) {
    const getDetailsVal = (headerName) => {
        const index = detailsHeaders.indexOf(headerName);
        return index > -1 ? detailsRow[index] : undefined;
    };
    const getComaxVal = (headerName) => {
        const index = comaxHeaders.indexOf(headerName);
        return index > -1 ? comaxRow[index] : undefined;
    };

    let compiledLines = [];
    const isEn = lang === 'en';

    // --- Labels and Suffixes ---
    const {
        vintageLabel, abvLabel, volumeLabel, regionLabel, grapeLabel,
        intensityLabel, complexityLabel, acidityLabel, harmonizeLabel, contrastLabel, // <-- ADD acidityLabel HERE
        decantLabel, kashrutLabel, flavorsSuffix, minutesSuffix, volumeSuffix
    } = _getLabelsAndSuffixes(lang);

    // --- Language-specific maps ---
    const textMap = isEn ? lookupMaps.texts_en : lookupMaps.texts_he;
    const regionMap = isEn ? lookupMaps.regions_en : lookupMaps.regions_he;
    const grapeMap = isEn ? lookupMaps.grapes_en : lookupMaps.grapes_he;
    const kashrutMap = isEn ? lookupMaps.kashrut_en : lookupMaps.kashrut_he;
    const harMapping = isEn ? {'Sweet Har':'sweet', 'Intense Har':'intense', 'Rich Har':'rich', 'Mild Har':'mild'}
                                 : {'Sweet Har':'מתוקים', 'Intense Har':'עזים', 'Rich Har':'עשירים', 'Mild Har':'עדינים'};
    const conMapping = isEn ? {'Sweet Con':'sweet', 'Intense Con':'intense', 'Rich Con':'rich', 'Mild Con':'mild'}
                                 : {'Sweet Con':'מתוקים', 'Intense Con':'עזים', 'Rich Con':'עשירים', 'Mild Con':'עדינים'};

    // --- Section 1: Opening Paragraph ---
    const productName = isEn ? getDetailsVal('NAME') : getDetailsVal('שם היין');
    const longDesc = isEn ? getDetailsVal('Description') : getDetailsVal('תיאור ארוך');
    if (productName || longDesc) {
        compiledLines.push((productName ? `${productName} ` : '') + (longDesc || ''));
    }

    const addSectionBreak = () => { if (compiledLines.length > 0 && compiledLines[compiledLines.length - 1] !== '') compiledLines.push(''); };
    
    // --- Section 2: Detailed Attributes ---
    let combinedDetails = [];
    
    const groupKey = getComaxVal('CMX GROUP');
    if (groupKey && textMap.has(groupKey)) combinedDetails.push(textMap.get(groupKey));

    const vintage = getComaxVal('CMX YEAR');
    if (vintage) combinedDetails.push(`${vintageLabel}: ${vintage}`);
    
    const abv = getDetailsVal('ABV');
    if (abv) {
        const abvFormatted = (Number(abv) * 100).toFixed(1) + '%';
        combinedDetails.push(`${abvLabel}: ${abvFormatted}`);
    }

    const volume = getComaxVal('CMX SIZE');
    if (volume) combinedDetails.push(`${volumeLabel}: ${volume} ML`);

    const regionKey = getDetailsVal('אזור');
    if (regionKey && regionMap.has(regionKey)) combinedDetails.push(`${regionLabel}: ${regionMap.get(regionKey)}`);
    
    const grapeKeys = [getDetailsVal('G1'), getDetailsVal('G2'), getDetailsVal('G3'), getDetailsVal('G4'), getDetailsVal('G5')]
        .map(g => String(g || '').toUpperCase()).filter(g => g && grapeMap.has(g)).map(g => grapeMap.get(g));
    if (grapeKeys.length > 0) combinedDetails.push(`${grapeLabel}: ${grapeKeys.join(', ')}`);

    const intensity = getDetailsVal('Intensity');
    if (intensity) combinedDetails.push(`${intensityLabel}: ${intensity}`);
    
    const complexity = getDetailsVal('Complexity');
    if (complexity) combinedDetails.push(`${complexityLabel}: ${complexity}`);

    // --- START: ADDED CODE ---
    const acidity = getDetailsVal('Acidity');
    if (acidity) combinedDetails.push(`${acidityLabel}: ${acidity}`);
    // --- END: ADDED CODE ---

    const harmonizes = Object.keys(harMapping).filter(f => getDetailsVal(f) == 1).map(f => harMapping[f]);
    if (harmonizes.length > 0) combinedDetails.push(`${harmonizeLabel}: ${formatList_(harmonizes, isEn)}${flavorsSuffix}`);
    
    const contrasts = Object.keys(conMapping).filter(f => getDetailsVal(f) == 1).map(f => conMapping[f]);
    if (contrasts.length > 0) combinedDetails.push(`${contrastLabel}: ${formatList_(contrasts, isEn)}${flavorsSuffix}`);

    const decant = getDetailsVal('Decant');
    if (decant) combinedDetails.push(`${decantLabel} – ${decant}${minutesSuffix}`);
    
    if (combinedDetails.length > 0) {
        addSectionBreak();
        compiledLines.push(...combinedDetails);
    }
    
    // --- Section 3: Kashrut ---
    // ... (rest of the function is unchanged)
    let kashrutSection = [];
    const kashrutNames = [getDetailsVal('K1'), getDetailsVal('K2'), getDetailsVal('K3'), getDetailsVal('K4'), getDetailsVal('K5')]
        .map(k => String(k || '').toUpperCase()).filter(k => k && kashrutMap.has(k)).map(k => kashrutMap.get(k));
    if (kashrutNames.length > 0) {
        kashrutSection.push(`${kashrutLabel}: ${kashrutNames.join(', ')}`);
    }
    const heterMechira = getDetailsVal('היתר מכירה') == 1;
    if (heterMechira) {
        const heterMechiraText = isEn ? '<span style="color: red; font-weight: bold;">Heter Mechira</span>' : '<span style="color: red; font-weight: bold;">היתר מכירה</span>';
        if (kashrutSection.length > 0) {
            kashrutSection[0] += ` ${heterMechiraText}`;
        } else {
            kashrutSection.push(heterMechiraText);
        }
    }
    if (kashrutSection.length > 0) {
        addSectionBreak();
        compiledLines.push(...kashrutSection);
    }

    // --- Section 4: Appended Export-Only Data ---
    // ... (rest of the function is unchanged)
    let appendedParagraphs = [];
        
    const lastDigit = String(sku).slice(-1);
    const promoKey = 'P' + lastDigit;
    if (textMap.has(promoKey)) appendedParagraphs.push(`<b>* ${textMap.get(promoKey)}</b>`);

    if (intensity) {
        const intensityKey = 'IN0' + intensity;
        if (textMap.has(intensityKey)) appendedParagraphs.push(textMap.get(intensityKey));
    }
    if (complexity) {
        const complexityKey = 'CO0' + complexity;
        if (textMap.has(complexityKey)) appendedParagraphs.push(textMap.get(complexityKey));
    }
    const acidityVal = getDetailsVal('Acidity');
    if (acidityVal) {
         const acidityNum = String(acidityVal).match(/\d+/);
         if (acidityNum) {
              const acidityKey = 'AC0' + acidityNum[0];
              if (textMap.has(acidityKey)) appendedParagraphs.push(textMap.get(acidityKey));
         }
    }

    if (harmonizes.length > 0) {
        let block = [];
        if (textMap.has('HARMONIZE')) block.push(textMap.get('HARMONIZE'));
        let bullets = [];
        harmonizes.forEach(flavor => {
            const flavorKey = flavor.toUpperCase();
            if(textMap.has(flavorKey)) {
                const flavorTitle = isEn ? `${flavor.charAt(0).toUpperCase() + flavor.slice(1)} flavors` : `טעמים ${flavor}`;
                bullets.push(`• ${flavorTitle}: ${textMap.get(flavorKey)}`);
            }
        });
        block.push(bullets.join('\n'));
        appendedParagraphs.push(block.join('\n'));
    }
    if (contrasts.length > 0) {
        let block = [];
        if (textMap.has('CONTRAST')) block.push(textMap.get('CONTRAST'));
        let bullets = [];
        contrasts.forEach(flavor => {
            const flavorKey = flavor.toUpperCase();
            if(textMap.has(flavorKey)) {
                const flavorTitle = isEn ? `${flavor.charAt(0).toUpperCase() + flavor.slice(1)} flavors` : `טעמים ${flavor}`;
                bullets.push(`• ${flavorTitle}: ${textMap.get(flavorKey)}`);
            }
        });
        block.push(bullets.join('\n'));
        appendedParagraphs.push(block.join('\n'));
    }

    if (appendedParagraphs.length > 0) {
        addSectionBreak();
        compiledLines.push(appendedParagraphs.join('\n\n'));
    }

    return compiledLines.join('\n');
}

/**
 * Creates a timestamped CSV file from a 2D array of data in the designated export folder.
 * @param {Array<Array<*>>} dataRows The 2D array of data rows to export.
 * @returns {string|null} The name of the created file or null if no data was provided.
 */
function _createCsvExport(dataRows) {
    if (!dataRows || dataRows.length === 0) {
        return null;
    }

    const headers = ['CODE', 'ID', 'Short Description', 'Description'];
    const dataWithHeaders = [headers, ...dataRows];

    // Convert array to a properly escaped CSV string
    const csvContent = dataWithHeaders.map(row => 
        row.map(cell => {
            const cellStr = String(cell || '');
            // Escape quotes, commas, and newlines for CSV compatibility
            if (cellStr.includes('"') || cellStr.includes(',') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(',')
    ).join('\n');

    // Generate timestamped filename, e.g., ProductDetails-08-06-13-55.csv
    const timestamp = Utilities.formatDate(new Date(), "Asia/Jerusalem", "MM-dd-HH-mm");
    const fileName = `ProductDetails-${timestamp}.csv`;

    try {
        const exportFolder = DriveApp.getFolderById(activeConfig.comaxExportFolderId);
        exportFolder.createFile(fileName, csvContent, MimeType.CSV);
        Logger.log(`Successfully created CSV export: ${fileName}`);
        return fileName;
    } catch (e) {
        Logger.log(`Failed to create CSV export. Error: ${e.message}`);
        throw new Error(`Failed to create CSV file in folder ID ${activeConfig.comaxExportFolderId}. Verify configuration and permissions.`);
    }
}

/**
 * Creates a new sheet to display details for 'Accepted' tasks,
 * allowing a final review and status change to 'Closed'.
 */
function loadAcceptedDetailReviews() {
    const ui = SpreadsheetApp.getUi();
    const FINAL_REVIEW_SHEET_NAME = 'CloseAccepted';

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let reviewSheet = ss.getSheetByName(FINAL_REVIEW_SHEET_NAME);

        if (!reviewSheet) {
            const allSheets = ss.getSheets();
            for (let i = 0; i < allSheets.length; i++) {
                if (allSheets[i].getName().trim() === FINAL_REVIEW_SHEET_NAME) {
                    reviewSheet = allSheets[i];
                    break;
                }
            }
        }

        if (!reviewSheet) {
            reviewSheet = ss.insertSheet(FINAL_REVIEW_SHEET_NAME);
        } else {
            // Delete all rows after the header to ensure a clean slate, including validations
            if (reviewSheet.getLastRow() > 1) {
                reviewSheet.deleteRows(2, reviewSheet.getLastRow() - 1);
            }
        }

        SpreadsheetApp.setActiveSheet(reviewSheet);

        const referenceSs = SpreadsheetApp.openById(activeConfig.referenceFileId);

        // 1. Get data from TaskQ and DetailsM (master)
        const taskqSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.TASKQ);
        const detailsMSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.DETAILS_M);
        
        const taskqData = taskqSheet.getDataRange().getValues();
        const detailsMData = detailsMSheet.getDataRange().getValues();
        
        const taskqHeaders = taskqData.shift();
        const detailsMHeaders = detailsMData.shift();

        // 2. Find all 'Accepted' tasks
        const statusCol = _findHeaderIndex(taskqHeaders, 'Status');
        const typeCol = _findHeaderIndex(taskqHeaders, 'Type');
        const skuColTaskq = _findHeaderIndex(taskqHeaders, 'RelatedEntity');

        const acceptedTasks = taskqData.filter(row => 
            row[statusCol] === 'Accepted' && (row[typeCol] === 'Product Exception C6' || row[typeCol] === 'New Product')
        );

        if (acceptedTasks.length === 0) {
            return 'No "Accepted" tasks found to load for final review.';
        }

        const acceptedSkus = new Set(acceptedTasks.map(row => String(row[skuColTaskq]).trim()));

        // 3. Prepare DetailsM data for quick lookup
        const skuColDetailsM = _findHeaderIndex(detailsMHeaders, 'SKU');
        const detailsMMap = new Map(detailsMData.map(row => [String(row[skuColDetailsM]).trim(), row]));
        
        // 4. Build rows for the new review sheet
        const headers = ['SKU', 'Product Name', 'Intensity', 'Complexity', 'Acidity', 'Harmonize With', 'Contrast With', 'Status'];
        const rowsToWrite = [];

        const nameIdx = _findHeaderIndex(detailsMHeaders, 'NAME');
        const intensityIdx = _findHeaderIndex(detailsMHeaders, 'Intensity');
        const complexityIdx = _findHeaderIndex(detailsMHeaders, 'Complexity');
        const acidityIdx = _findHeaderIndex(detailsMHeaders, 'Acidity');
        
        const harFields = {'Mild Har': 'mild', 'Rich Har': 'rich', 'Intense Har': 'intense', 'Sweet Har': 'sweet'};
        const conFields = {'Mild Con': 'mild', 'Rich Con': 'rich', 'Intense Con': 'intense', 'Sweet Con': 'sweet'};
        const harIndices = Object.fromEntries(Object.keys(harFields).map(key => [key, _findHeaderIndex(detailsMHeaders, key)]));
        const conIndices = Object.fromEntries(Object.keys(conFields).map(key => [key, _findHeaderIndex(detailsMHeaders, key)]));


        for (const sku of acceptedSkus) {
            const masterRow = detailsMMap.get(sku);
            if (!masterRow) continue;

            const getHarmonize = Object.keys(harFields).filter(key => harIndices[key] > -1 && masterRow[harIndices[key]] == 1).map(key => harFields[key]).join(', ');
            const getContrast = Object.keys(conFields).filter(key => conIndices[key] > -1 && masterRow[conIndices[key]] == 1).map(key => conFields[key]).join(', ');

            rowsToWrite.push([
                sku,
                masterRow[nameIdx] || 'N/A',
                masterRow[intensityIdx] || '',
                masterRow[complexityIdx] || '',
                masterRow[acidityIdx] || '',
                getHarmonize,
                getContrast,
                'Accepted' // Initial status
            ]);
        }
        
        // Sort data by Product Name (column index 1)
        rowsToWrite.sort((a, b) => a[1].localeCompare(b[1]));

        // 5. Create/clear and populate the sheet
        
        reviewSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        if (rowsToWrite.length > 0) {
            reviewSheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
            
            // 6. Apply formatting
            const statusColNum = headers.indexOf('Status') + 1;
            const statusRange = reviewSheet.getRange(2, statusColNum, rowsToWrite.length);
            const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Accepted', 'Closed'], true).build();
            statusRange.setDataValidation(rule);
        }
        
        reviewSheet.setFrozenRows(1);
        reviewSheet.autoResizeColumns(1, headers.length);
        
        SpreadsheetApp.setActiveSheet(reviewSheet);
        return `${rowsToWrite.length} "Accepted" item(s) loaded for final review and closure.`;

    } catch (e) {
        Logger.log(`CRITICAL ERROR in loadAcceptedDetailReviews: ${e.message}\nStack: ${e.stack}`);
        ui.alert('Error', `Failed to build the final review sheet: ${e.message}`, ui.ButtonSet.OK);
    }
}


/**
 * Processes items marked as 'Closed' in the 'CloseAccepted' sheet.
 * Updates TaskQ status and cleans up the DetailsS staging sheet.
 */
function processFinalDetailClosures() {
    const ui = SpreadsheetApp.getUi();
    const FINAL_REVIEW_SHEET_NAME = 'CloseAccepted';

    try {
        SpreadsheetApp.flush();
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const reviewSheet = ss.getSheetByName(FINAL_REVIEW_SHEET_NAME);

        if (!reviewSheet) {
            return `Error: The expected sheet "${FINAL_REVIEW_SHEET_NAME}" was not found. Please re-run the report.`;
        }

        SpreadsheetApp.setActiveSheet(reviewSheet);

        if (reviewSheet.getLastRow() < 2) {
            return 'The final review sheet is empty or not found. Nothing to process.';
        }

        // 1. Find rows marked for closure
        const reviewData = reviewSheet.getDataRange().getValues();
        const reviewHeaders = reviewData.shift();
        const statusColIdx = _findHeaderIndex(reviewHeaders, 'Status');
        const skuColIdx = _findHeaderIndex(reviewHeaders, 'SKU');
        
        const skusToClose = new Set();
        reviewData.forEach(row => {
            if (row[statusColIdx] === 'Closed' && row[skuColIdx]) {
                skusToClose.add(String(row[skuColIdx]).trim());
            }
        });

        if (skusToClose.size === 0) {
            return 'No items were marked as "Closed". Nothing to process.';
        }

        // 2. Prepare reference sheets for updates
        const referenceSs = SpreadsheetApp.openById(activeConfig.referenceFileId);
        const taskqSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.TASKQ);
        const detailsSSheet = _getSheetOrThrow(referenceSs, PR_SHEETS.DETAILS_S);

        const taskqData = taskqSheet.getDataRange().getValues();
        const detailsSData = detailsSSheet.getDataRange().getValues();

        const taskqHeaders = taskqData.shift();
        const detailsSHeaders = detailsSData.shift();

        // 3. Perform in-memory updates
        // A. Update TaskQ status from 'Accepted' to 'Closed'
        const tqStatusCol = _findHeaderIndex(taskqHeaders, 'Status');
        const tqSkuCol = _findHeaderIndex(taskqHeaders, 'RelatedEntity');
        let updatedTaskCount = 0;

        const updatedTaskqData = taskqData.map(row => {
            const sku = String(row[tqSkuCol]).trim();
            if (row[tqStatusCol] === 'Accepted' && skusToClose.has(sku)) {
                row[tqStatusCol] = 'Closed';
                updatedTaskCount++;
            }
            return row;
        });

        // B. Filter DetailsS to remove closed records
        const dsSkuCol = _findHeaderIndex(detailsSHeaders, 'SKU');
        const newDetailsSData = detailsSData.filter(row => {
            const sku = String(row[dsSkuCol]).trim();
            return !skusToClose.has(sku);
        });

        // 4. Write all changes back to the sheets
        taskqSheet.getRange(2, 1, updatedTaskqData.length, taskqHeaders.length).setValues(updatedTaskqData);
        
        detailsSSheet.clear();
        detailsSSheet.getRange(1, 1, 1, detailsSHeaders.length).setValues([detailsSHeaders]);
        if (newDetailsSData.length > 0) {
            detailsSSheet.getRange(2, 1, newDetailsSData.length, detailsSHeaders.length).setValues(newDetailsSData);
        }
         SpreadsheetApp.flush(); // Force all pending changes to be written

        // 5. Refresh the final review sheet to show remaining items
        loadAcceptedDetailReviews();

        return `${updatedTaskCount} item(s) were successfully closed and cleaned up.`;

    } catch (e) {
        Logger.log(`CRITICAL ERROR in processFinalDetailClosures: ${e.message}\nStack: ${e.stack}`);
        return `An error occurred while closing tasks: ${e.message}`;
    }
}