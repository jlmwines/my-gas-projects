/**
 * @file SetupMigrate.js
 * @description Contains functions for migrating initial data from legacy systems to JLMops master sheets.
 */

/**
 * Populates the JLMops master order sheets with existing web order data from a legacy spreadsheet.
 */
function populateInitialOrderData() {
    const functionName = 'populateInitialOrderData';
    const legacyDataSpreadsheetId = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc'; // This ID should ideally come from SysConfig

    try {
        console.log(`Running ${functionName}...`);

        // 1. Read all source and target sheets
        const legacySpreadsheet = SpreadsheetApp.openById(legacyDataSpreadsheetId);
        const targetSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        console.log('Opened legacy and target spreadsheets.');

        const ordersMSheet = legacySpreadsheet.getSheetByName('OrdersM');
        const orderLogSheet = legacySpreadsheet.getSheetByName('OrderLog');
        const orderLogArchiveSheet = legacySpreadsheet.getSheetByName('OrderLogArchive');

        const sheetNames = ConfigService.getConfig('system.sheet_names');

        const webOrdMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebOrdM);
        const webOrdItemsMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
        const sysOrdLogSheet = targetSpreadsheet.getSheetByName(sheetNames.SysOrdLog);
        const webOrdMArchiveSheet = targetSpreadsheet.getSheetByName(sheetNames.WebOrdM_Archive);
        const webOrdItemsMArchiveSheet = targetSpreadsheet.getSheetByName(sheetNames.WebOrdItemsM_Archive);
        const orderLogArchiveJLMopsSheet = targetSpreadsheet.getSheetByName(sheetNames.OrderLogArchive);

        // 2. Read data from legacy sheets
        const ordersMData = ordersMSheet.getDataRange().getValues();
        const orderLogData = orderLogSheet.getDataRange().getValues();
        const orderLogArchiveData = orderLogArchiveSheet.getDataRange().getValues();

        const ordersMHeaders = ordersMData.shift();
        const orderLogHeaders = orderLogData.shift();
        const orderLogArchiveHeaders = orderLogArchiveData.shift();

        console.log(`Read ${ordersMData.length} rows from OrdersM.`);
        console.log(`Read ${orderLogData.length} rows from OrderLog.`);
        console.log(`Read ${orderLogArchiveData.length} rows from OrderLogArchive.`);

        // 3. Create a lookup set of archived order IDs
        const archivedOrderIdCol = orderLogArchiveHeaders.indexOf('order_id');
        const archivedOrderIds = new Set(orderLogArchiveData.map(row => row[archivedOrderIdCol]));

        // 4. Process data
        const webOrdM_Data = [];
        const webOrdItemsM_Data = [];
        const webOrdM_Archive_Data = [];
        const webOrdItemsM_Archive_Data = [];
        let itemMasterIdCounter = 1;

        const headerMap = Object.fromEntries(ordersMHeaders.map((h, i) => [h, i]));

        // Read WebProdM to create a lookup for woi_WebIdEn
        const webProdMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebProdM);
        if (!webProdMSheet) {
            throw new Error(`JLMops target sheet ${sheetNames.WebProdM} not found.`);
        }
        const webProdMData = webProdMSheet.getDataRange().getValues();
        const webProdMHeaders = webProdMData.shift();
        console.log(`WebProdM Headers: ${JSON.stringify(webProdMHeaders)}`);

        const wpmSkuCol = webProdMHeaders.indexOf('wpm_SKU');
        const wpmWebIdEnCol = webProdMHeaders.indexOf('wpm_WebIdEn');

        if (wpmSkuCol === -1) {
            throw new Error(`Column 'wpm_SKU' not found in WebProdM headers.`);
        }
        if (wpmWebIdEnCol === -1) {
            throw new Error(`Column 'wpm_WebIdEn' not found in WebProdM headers.`);
        }

        const skuToWebIdEnMap = new Map();
        webProdMData.forEach((row, index) => {
            const sku = row[wpmSkuCol];
            const webIdEn = row[wpmWebIdEnCol];
            if (sku) {
                skuToWebIdEnMap.set(sku.toString().trim(), webIdEn);
            } else {
                console.warn(`WebProdM row ${index + 2} has no SKU. Skipping.`);
            }
        });
        console.log(`Created SKU to WebIdEn map with ${skuToWebIdEnMap.size} entries.`);

        for (const orderRow of ordersMData) {
            const orderId = orderRow[headerMap['order_id']];
            const isArchived = archivedOrderIds.has(orderId);

            const orderHeader = [
                orderId, orderRow[headerMap['order_number']], orderRow[headerMap['order_date']],
                orderRow[headerMap['status']], orderRow[headerMap['customer_note']],
                orderRow[headerMap['billing_first_name']], orderRow[headerMap['billing_last_name']],
                orderRow[headerMap['billing_email']], orderRow[headerMap['billing_phone']],
                orderRow[headerMap['shipping_first_name']], orderRow[headerMap['shipping_last_name']],
                orderRow[headerMap['shipping_address_1']], orderRow[headerMap['shipping_address_2']],
                orderRow[headerMap['shipping_city']], orderRow[headerMap['shipping_phone']]
            ];

            if (isArchived) {
                webOrdM_Archive_Data.push(orderHeader);
            } else {
                webOrdM_Data.push(orderHeader);
            }

            for (let i = 1; i <= 24; i++) {
                const sku = orderRow[headerMap[`Product Item ${i} SKU`]];
                const quantity = orderRow[headerMap[`Product Item ${i} Quantity`]];
                const name = orderRow[headerMap[`Product Item ${i} Name`]];
                const total = orderRow[headerMap[`Product Item ${i} Total`]];

                if (sku && quantity > 0) {
                    const trimmedSku = sku.toString().trim(); // Trim SKU from order item for lookup
                    const webIdEn = skuToWebIdEnMap.get(trimmedSku) || ''; // Lookup woi_WebIdEn, default to empty if not found
                    if (!webIdEn) {
                        console.warn(`SKU "${trimmedSku}" not found in WebProdM for order item ${itemMasterIdCounter}. woi_WebIdEn will be blank.`);
                    }
                    const itemRow = [itemMasterIdCounter++, orderId, webIdEn, sku, name, quantity, total];
                    if (isArchived) {
                        webOrdItemsM_Archive_Data.push(itemRow);
                    } else {
                        webOrdItemsM_Data.push(itemRow);
                    }
                }
            }
        }

        // 5. Write data to new sheets
        const writeData = (sheet, data, name) => {
            console.log(`Writing ${data.length} rows to ${name}...`);
            sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns()).clearContent();
            if (data.length > 0) {
                sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
            }
            console.log(`Finished writing to ${name}.`);
        };

        writeData(webOrdMSheet, webOrdM_Data, 'WebOrdM');
        writeData(webOrdItemsMSheet, webOrdItemsM_Data, 'WebOrdItemsM');
        writeData(webOrdMArchiveSheet, webOrdM_Archive_Data, 'WebOrdM_Archive');
        writeData(webOrdItemsMArchiveSheet, webOrdItemsM_Archive_Data, 'WebOrdItemsM_Archive');
        writeData(sysOrdLogSheet, orderLogData, 'SysOrdLog');
        writeData(orderLogArchiveJLMopsSheet, orderLogArchiveData, 'OrderLogArchive (JLMops)');

        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        console.error(error.stack);
    }
}

/**
 * Populates the JLMops master product sheets with existing product data from a legacy spreadsheet.
 */
function populateInitialProductData() {
    const functionName = 'populateInitialProductData';
    const legacyDataSpreadsheetId = '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc'; // Legacy Reference spreadsheet ID

    try {
        console.log(`Running ${functionName}...`);

        // 1. Open legacy and target spreadsheets
        const legacySpreadsheet = SpreadsheetApp.openById(legacyDataSpreadsheetId);
        const targetSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        console.log('Opened legacy and target spreadsheets.');

        // 2. Get legacy sheets
        const legacyDetailsMSheet = legacySpreadsheet.getSheetByName('DetailsM');
        const legacyWeHeSheet = legacySpreadsheet.getSheetByName('WeHe');
        const legacyComaxMSheet = legacySpreadsheet.getSheetByName('ComaxM');
        const legacyWebMSheet = legacySpreadsheet.getSheetByName('WebM'); // Added

        if (!legacyDetailsMSheet || !legacyWeHeSheet || !legacyComaxMSheet || !legacyWebMSheet) {
            throw new Error('One or more legacy product sheets (DetailsM, WeHe, ComaxM, WebM) not found.');
        }

        // 3. Get JLMops target sheets from SysConfig
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const webProdMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebProdM);
        const webDetMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebDetM);
        const webXltMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebXltM);

        if (!webProdMSheet || !webDetMSheet || !webXltMSheet) {
            throw new Error('One or more JLMops target product sheets (WebProdM, WebDetM, WebXltM) not found.');
        }

        // 4. Read data from legacy sheets
        const legacyDetailsMData = legacyDetailsMSheet.getDataRange().getValues();
        const legacyWeHeData = legacyWeHeSheet.getDataRange().getValues();
        const legacyComaxMData = legacyComaxMSheet.getDataRange().getValues();
        const legacyWebMData = legacyWebMSheet.getDataRange().getValues(); // Added

        const legacyDetailsMHeaders = legacyDetailsMData.shift();
        const legacyWeHeHeaders = legacyWeHeData.shift();
        const legacyComaxMHeaders = legacyComaxMData.shift();
        const legacyWebMHeaders = legacyWebMData.shift(); // Added

        Logger.log(`legacyDetailsMHeaders: ${JSON.stringify(legacyDetailsMHeaders)}`);

        console.log(`Read ${legacyDetailsMData.length} rows from legacy DetailsM.`);
        console.log(`Read ${legacyWeHeData.length} rows from legacy WeHe.`);
        console.log(`Read ${legacyComaxMData.length} rows from legacy ComaxM.`);
        console.log(`Read ${legacyWebMData.length} rows from legacy WebM.`); // Added

        // 5. Process and map data
        const webProdM_Data = [];
        const webDetM_Data = [];
        const webXltM_Data = [];

        // Build lookup maps for efficient data access
        const legacyComaxMMap = legacyComaxMData.reduce((map, row) => {
            const sku = row[legacyComaxMHeaders.indexOf('SKU')];
            if (sku) map[sku] = row;
            return map;
        }, {});

        const legacyWeHeMap = legacyWeHeData.reduce((map, row) => {
            const webIdEn = row[legacyWeHeHeaders.indexOf('WebIdEn')];
            if (webIdEn) map[webIdEn] = row;
            return map;
        }, {});

        const legacyWebMMap = legacyWebMData.reduce((map, row) => {
            const sku = row[legacyWebMHeaders.indexOf('SKU')];
            const id = row[legacyWebMHeaders.indexOf('ID')];
            const wPubl = row[legacyWebMHeaders.indexOf('W Publ')];
            const wStock = row[legacyWebMHeaders.indexOf('W Stock')];
            const wPrice = row[legacyWebMHeaders.indexOf('W Price')];
            if (sku) map[sku] = { id: id, wPubl: wPubl, wStock: wStock, wPrice: wPrice };
            return map;
        }, {});

        // Populate WebProdM by iterating over legacyWebMData and directly mapping columns by index
        legacyWebMData.forEach(row => {
            // Assuming the order of columns in legacyWebMData is: ID, SKU, W Name, W Publ, W Stock, W Price
            // And the order in WebProdM is: wpm_WebIdEn, wpm_SKU, wpm_NameEn, wpm_PublishStatusEn, wpm_Stock, wpm_Price
            webProdM_Data.push([
                row[legacyWebMHeaders.indexOf('ID')], // wpm_WebIdEn
                row[legacyWebMHeaders.indexOf('SKU')], // wpm_SKU
                row[legacyWebMHeaders.indexOf('W Name')], // wpm_NameEn
                row[legacyWebMHeaders.indexOf('W Publ')], // wpm_PublishStatusEn
                row[legacyWebMHeaders.indexOf('W Stock')], // wpm_Stock
                row[legacyWebMHeaders.indexOf('W Price')] // wpm_Price
            ]);
        });

        // Populate WebDetM (remains largely the same, iterating over legacyDetailsMData)
        legacyDetailsMData.forEach(row => {
            const sku = row[legacyDetailsMHeaders.indexOf('SKU')];
            const webMProduct = legacyWebMMap[sku] || {}; // Still need this for webIdEn if not in DetailsM
            const webIdEn = webMProduct.id || ''; // Derived from WebM
            const nameEn = row[legacyDetailsMHeaders.indexOf('NAME')];
            const isSoldIndividually = ''; // Not found in provided legacy headers

            // WebDetM: wdm_WebIdEn, wdm_SKU, wdm_NameEn, wdm_NameHe, wdm_ShortDescrEn, wdm_ShortDescrHe, ...
            webDetM_Data.push([
                webIdEn, // Assuming WebIdEn is derived or will be added to legacy sheet
                sku,
                nameEn, // Mapped from 'NAME'
                row[legacyDetailsMHeaders.indexOf('שם היין')],
                row[legacyDetailsMHeaders.indexOf('Short')],
                row[legacyDetailsMHeaders.indexOf('קצר')],
                row[legacyDetailsMHeaders.indexOf('Description')],
                row[legacyDetailsMHeaders.indexOf('תיאור ארוך')],
                row[legacyDetailsMHeaders.indexOf('אזור')],
                row[legacyDetailsMHeaders.indexOf('Intensity')],
                row[legacyDetailsMHeaders.indexOf('Complexity')],
                row[legacyDetailsMHeaders.indexOf('Acidity')],
                row[legacyDetailsMHeaders.indexOf('Decant')],
                row[legacyDetailsMHeaders.indexOf('Mild Har')],
                row[legacyDetailsMHeaders.indexOf('Rich Har')],
                row[legacyDetailsMHeaders.indexOf('Intense Har')],
                row[legacyDetailsMHeaders.indexOf('Sweet Har')],
                row[legacyDetailsMHeaders.indexOf('Mild Con')],
                row[legacyDetailsMHeaders.indexOf('Rich Con')],
                row[legacyDetailsMHeaders.indexOf('Intense Con')],
                row[legacyDetailsMHeaders.indexOf('Sweet Con')],
                row[legacyDetailsMHeaders.indexOf('G1')],
                row[legacyDetailsMHeaders.indexOf('G2')],
                row[legacyDetailsMHeaders.indexOf('G3')],
                row[legacyDetailsMHeaders.indexOf('G4')],
                row[legacyDetailsMHeaders.indexOf('G5')],
                row[legacyDetailsMHeaders.indexOf('K1')],
                row[legacyDetailsMHeaders.indexOf('K2')],
                row[legacyDetailsMHeaders.indexOf('K3')],
                row[legacyDetailsMHeaders.indexOf('K4')],
                row[legacyDetailsMHeaders.indexOf('K5')],
                row[legacyDetailsMHeaders.indexOf('היתר מכירה')],
                '', // IsMevushal - not found in legacy headers
                isSoldIndividually // Assuming IsSoldIndividually is derived or will be added to legacy sheet
            ]);
        });

        // Populate WebXltM
        const translationMapConfig = ConfigService.getConfig('map.web.translation_columns');
        const weheHeaderMap = {};
        for (const legacyHeader in translationMapConfig) {
            const internalHeader = translationMapConfig[legacyHeader];
            weheHeaderMap[internalHeader] = legacyHeader;
        }

        legacyWeHeData.forEach(row => {
            // wxl_WebIdHe, wxl_NameHe, wxl_WebIdEn, wxl_SKU
            webXltM_Data.push([
                row[legacyWeHeHeaders.indexOf(weheHeaderMap['wxs_WebIdHe'])],
                row[legacyWeHeHeaders.indexOf(weheHeaderMap['wxs_NameHe'])],
                row[legacyWeHeHeaders.indexOf(weheHeaderMap['wxs_WebIdEn'])],
                row[legacyWeHeHeaders.indexOf(weheHeaderMap['wxs_SKU'])]
            ]);
        });

        // 6. Write data to JLMops sheets
        const writeData = (sheet, data, name) => {
            console.log(`Writing ${data.length} rows to ${name}...`);
            sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns()).clearContent();
            if (data.length > 0) {
                sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
            }
            console.log(`Finished writing to ${name}.`);
        };

        writeData(webProdMSheet, webProdM_Data, 'WebProdM');
        writeData(webDetMSheet, webDetM_Data, 'WebDetM');
        writeData(webXltMSheet, webXltM_Data, 'WebXltM');

        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        console.error(error.stack);
    }
}
