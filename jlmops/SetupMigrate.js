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

        const webOrdMSheet = targetSpreadsheet.getSheetByName('WebOrdM');
        const webOrdItemsMSheet = targetSpreadsheet.getSheetByName('WebOrdItemsM');
        const sysOrdLogSheet = targetSpreadsheet.getSheetByName('SysOrdLog');
        const webOrdMArchiveSheet = targetSpreadsheet.getSheetByName('WebOrdM_Archive');
        const webOrdItemsMArchiveSheet = targetSpreadsheet.getSheetByName('WebOrdItemsM_Archive');
        const orderLogArchiveJLMopsSheet = targetSpreadsheet.getSheetByName('OrderLogArchive');

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
                    const itemRow = [itemMasterIdCounter++, orderId, '', sku, name, quantity, total]; // woi_WebIdEn is blank for now
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
 * This function is a placeholder and needs to be implemented based on the specific legacy product data structure.
 */
function populateInitialProductData() {
    const functionName = 'populateInitialProductData';
    try {
        console.log(`Running ${functionName}...`);
        console.warn(`Function ${functionName} is a placeholder and needs to be implemented.`);
        // TODO: Implement product data migration logic here.
        // Refer to IMPLEMENTATION_PLAN.md for details on source sheets (e.g., DetailsM, WeHe, ComaxM)
        // and target sheets (WebProdM, WebDetM, WebXltM).
    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        console.error(error.stack);
    }
}
