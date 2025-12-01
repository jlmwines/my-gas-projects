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

        const sheetNames = ConfigService.getConfig('system.sheet_names');

        const webOrdMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebOrdM);
        const webOrdItemsMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
        const sysOrdLogSheet = targetSpreadsheet.getSheetByName(sheetNames.SysOrdLog);

        // 2. Read data from legacy sheets
        const ordersMData = ordersMSheet.getDataRange().getValues();
        const orderLogData = orderLogSheet.getDataRange().getValues();

        const ordersMHeaders = ordersMData.shift();
        const orderLogHeaders = orderLogData.shift();

        console.log(`Read ${ordersMData.length} rows from OrdersM.`);
        console.log(`Read ${orderLogData.length} rows from OrderLog.`);
        // 4. Process data
        const webOrdM_Data = [];
        const webOrdItemsM_Data = [];
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

            const orderHeader = [
                orderId, orderRow[headerMap['order_number']], orderRow[headerMap['order_date']],
                orderRow[headerMap['status']], orderRow[headerMap['customer_note']],
                orderRow[headerMap['billing_first_name']], orderRow[headerMap['billing_last_name']],
                orderRow[headerMap['billing_email']], orderRow[headerMap['billing_phone']],
                orderRow[headerMap['shipping_first_name']], orderRow[headerMap['shipping_last_name']],
                orderRow[headerMap['shipping_address_1']], orderRow[headerMap['shipping_address_2']],
                orderRow[headerMap['shipping_city']], orderRow[headerMap['shipping_phone']]
            ];

            webOrdM_Data.push(orderHeader);

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
                    webOrdItemsM_Data.push(itemRow);
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
        // Transform and write SysOrdLog data
        const transformedOrderLogData = [];
        const legacyStatusIndex = orderLogHeaders.indexOf('comax_export_status');
        const legacyPackingStatusIndex = orderLogHeaders.indexOf('packing_slip_status'); // New
        const legacyPackingPrintDateIndex = orderLogHeaders.indexOf('packing_print_date'); // New
        const legacyTimestampIndex = orderLogHeaders.indexOf('comax_export_timestamp'); // This might not exist, but good to check

        // Define target indices based on SysConfig schema for SysOrdLog
        const sysOrdLogSchema = ConfigService.getConfig('schema.data.SysOrdLog').headers.split(',');
        const targetComaxStatusIndex = sysOrdLogSchema.indexOf('sol_ComaxExportStatus');
        const targetComaxTimestampIndex = sysOrdLogSchema.indexOf('sol_ComaxExportTimestamp');
        const targetPackingStatusIndex = sysOrdLogSchema.indexOf('sol_PackingStatus'); // New: Packing Status Index
        const targetOrderStatusIndex = sysOrdLogSchema.indexOf('sol_OrderStatus'); // New: Order Status Index

        const ordersMOrderIdCol = headerMap['order_id']; // For looking up original order status
        const ordersMStatusCol = headerMap['status']; // For looking up original order status

        // Create a map for quick lookup of order status from ordersMData
        const orderStatusMap = ordersMData.reduce((map, row) => {
            map[row[ordersMOrderIdCol]] = row[ordersMStatusCol];
            return map;
        }, {});

        orderLogData.forEach(legacyRow => {
            // Need to create a newRow that is long enough to hold all SysOrdLog columns
            const newRow = new Array(sysOrdLogSchema.length).fill('');
            const orderId = legacyRow[orderLogHeaders.indexOf('order_id')]; // Assuming order_id is in orderLogHeaders

            // Populate base order information
            newRow[sysOrdLogSchema.indexOf('sol_OrderId')] = orderId;
            newRow[sysOrdLogSchema.indexOf('sol_OrderDate')] = legacyRow[orderLogHeaders.indexOf('order_date')];

            // Comax Export Status and Timestamp
            const legacyComaxStatusValue = legacyRow[legacyStatusIndex]; // This is 'comax_export_status' from legacy OrderLog
            if (legacyComaxStatusValue instanceof Date || (typeof legacyComaxStatusValue === 'string' && legacyComaxStatusValue.trim() !== '')) {
                newRow[targetComaxStatusIndex] = 'Exported';
                newRow[targetComaxTimestampIndex] = legacyComaxStatusValue;
            } else {
                newRow[targetComaxStatusIndex] = 'Pending';
                newRow[targetComaxTimestampIndex] = '';
            }

            // Packing Status and Printed Timestamp
            const legacyPackingStatus = legacyRow[legacyPackingStatusIndex];
            const legacyPackingPrintDate = legacyRow[legacyPackingPrintDateIndex];

            if (legacyPackingStatus && legacyPackingStatus.toString().trim() !== '') {
                newRow[targetPackingStatusIndex] = legacyPackingStatus; // Use legacy status if available
            } else {
                // If no legacy packing status, determine from original order status
                const originalOrderStatus = orderStatusMap[orderId];
                if (originalOrderStatus && (originalOrderStatus.toLowerCase().includes('cancelled') || originalOrderStatus.toLowerCase().includes('refunded'))) {
                    newRow[targetPackingStatusIndex] = 'Ineligible';
                } else {
                    newRow[targetPackingStatusIndex] = 'Eligible'; // Default to eligible
                }
            }
            newRow[sysOrdLogSchema.indexOf('sol_PackingPrintedTimestamp')] = legacyPackingPrintDate || ''; // Set legacy print date

            // Set the original order status from OrdersM
            newRow[targetOrderStatusIndex] = orderStatusMap[orderId] || '';

            transformedOrderLogData.push(newRow);
        });

        writeData(sysOrdLogSheet, transformedOrderLogData, 'SysOrdLog');

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
        const legacyWebMSheet = legacySpreadsheet.getSheetByName('WebM');
        const legacyAuditSheet = legacySpreadsheet.getSheetByName('Audit'); // Added

        if (!legacyDetailsMSheet || !legacyWeHeSheet || !legacyComaxMSheet || !legacyWebMSheet || !legacyAuditSheet) {
            throw new Error('One or more legacy product sheets (DetailsM, WeHe, ComaxM, WebM, Audit) not found.');
        }

        // 3. Get JLMops target sheets from SysConfig
        const sheetNames = ConfigService.getConfig('system.sheet_names');
        const webProdMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebProdM);
        const webDetMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebDetM);
        const webXltMSheet = targetSpreadsheet.getSheetByName(sheetNames.WebXltM);
        const sysProductAuditSheet = targetSpreadsheet.getSheetByName(sheetNames.SysProductAudit);
        const cmxProdMSheet = targetSpreadsheet.getSheetByName(sheetNames.CmxProdM); // Added

        if (!webProdMSheet || !webDetMSheet || !webXltMSheet || !sysProductAuditSheet || !cmxProdMSheet) {
            throw new Error('One or more JLMops target product sheets (WebProdM, WebDetM, WebXltM, SysProductAudit, CmxProdM) not found.');
        }

        // 4. Read data from legacy sheets
        const legacyDetailsMData = legacyDetailsMSheet.getDataRange().getValues();
        const legacyWeHeData = legacyWeHeSheet.getDataRange().getValues();
        const legacyComaxMData = legacyComaxMSheet.getDataRange().getValues();
        const legacyWebMData = legacyWebMSheet.getDataRange().getValues();
        const legacyAuditData = legacyAuditSheet.getDataRange().getValues(); // Added

        const legacyDetailsMHeaders = legacyDetailsMData.shift();
        const legacyWeHeHeaders = legacyWeHeData.shift();
        const legacyComaxMHeaders = legacyComaxMData.shift();
        const legacyWebMHeaders = legacyWebMData.shift();
        const legacyAuditHeaders = legacyAuditData.shift(); // Added

        Logger.log(`legacyDetailsMHeaders: ${JSON.stringify(legacyDetailsMHeaders)}`);

        console.log(`Read ${legacyDetailsMData.length} rows from legacy DetailsM.`);
        console.log(`Read ${legacyWeHeData.length} rows from legacy WeHe.`);
        console.log(`Read ${legacyComaxMData.length} rows from legacy ComaxM.`);
        console.log(`Read ${legacyWebMData.length} rows from legacy WebM.`);
        console.log(`Read ${legacyAuditData.length} rows from legacy Audit.`); // Added

        // 5. Process and map data
        const webProdM_Data = [];
        const webDetM_Data = [];
        const webXltM_Data = [];
        const sysProductAudit_Data = [];
        const cmxProdM_Data = [];

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
                row[legacyDetailsMHeaders.indexOf('ABV')],
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

        // Populate SysProductAudit
        const sysProductAuditSchema = ConfigService.getConfig('schema.data.SysProductAudit').headers.split(',');
        // Legacy Audit columns based on frontend-scripts/Globals.js:
        // ID: 0, SKU: 1, LastCount: 2, ComaxQty: 3, NewQty: 4, BruryaQty: 5, StorageQty: 6, OfficeQty: 7, ShopQty: 8
        
        legacyAuditData.forEach(row => {
            const newAuditRow = new Array(sysProductAuditSchema.length).fill('');
            newAuditRow[sysProductAuditSchema.indexOf('pa_CmxId')] = row[0]; // ID
            newAuditRow[sysProductAuditSchema.indexOf('pa_SKU')] = row[1]; // SKU
            newAuditRow[sysProductAuditSchema.indexOf('pa_LastCount')] = row[2]; // LastCount
            newAuditRow[sysProductAuditSchema.indexOf('pa_ComaxQty')] = row[3]; // ComaxQty
            newAuditRow[sysProductAuditSchema.indexOf('pa_NewQty')] = row[4]; // NewQty
            newAuditRow[sysProductAuditSchema.indexOf('pa_BruryaQty')] = row[5]; // BruryaQty
            newAuditRow[sysProductAuditSchema.indexOf('pa_StorageQty')] = row[6]; // StorageQty
            newAuditRow[sysProductAuditSchema.indexOf('pa_OfficeQty')] = row[7]; // OfficeQty
            newAuditRow[sysProductAuditSchema.indexOf('pa_ShopQty')] = row[8]; // ShopQty
            
            // Attempt to read extra columns if they exist, otherwise empty
            newAuditRow[sysProductAuditSchema.indexOf('pa_LastDetailUpdate')] = row[9] || ''; 
            newAuditRow[sysProductAuditSchema.indexOf('pa_LastDetailAudit')] = row[10] || '';
            
            sysProductAudit_Data.push(newAuditRow);
        });

        // Populate CmxProdM
        const cmxProdMSchema = ConfigService.getConfig('schema.data.CmxProdM').headers.split(',');
        const legacyComaxMHeaderMap = legacyComaxMHeaders.reduce((map, header, index) => {
            map[header] = index;
            return map;
        }, {});

        legacyComaxMData.forEach(row => {
            const newCmxProdMRow = new Array(cmxProdMSchema.length).fill('');
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_CmxId')] = row[legacyComaxMHeaderMap['CMX ID']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_SKU')] = row[legacyComaxMHeaderMap['CMX SKU']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_NameHe')] = row[legacyComaxMHeaderMap['CMX NAME']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Division')] = row[legacyComaxMHeaderMap['CMX DIV']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Group')] = row[legacyComaxMHeaderMap['CMX GROUP']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Vendor')] = row[legacyComaxMHeaderMap['CMX VENDOR']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Brand')] = row[legacyComaxMHeaderMap['CMX BRAND']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Color')] = row[legacyComaxMHeaderMap['CMX COLOR']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Size')] = row[legacyComaxMHeaderMap['CMX SIZE']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Dryness')] = row[legacyComaxMHeaderMap['CMX DRY']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Vintage')] = row[legacyComaxMHeaderMap['CMX YEAR']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_IsNew')] = row[legacyComaxMHeaderMap['CMX NEW']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_IsArchived')] = row[legacyComaxMHeaderMap['CMX ARCHIVE']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_IsActive')] = row[legacyComaxMHeaderMap['CMX ACTIVE']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Price')] = row[legacyComaxMHeaderMap['CMX PRICE']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Stock')] = row[legacyComaxMHeaderMap['CMX STOCK']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_IsWeb')] = row[legacyComaxMHeaderMap['CMX WEB']];
            newCmxProdMRow[cmxProdMSchema.indexOf('cpm_Exclude')] = row[legacyComaxMHeaderMap['EXCLUDE']];
            cmxProdM_Data.push(newCmxProdMRow);
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
        writeData(sysProductAuditSheet, sysProductAudit_Data, 'SysProductAudit');
        writeData(cmxProdMSheet, cmxProdM_Data, 'CmxProdM');

        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        console.error(error.stack);
    }
}
