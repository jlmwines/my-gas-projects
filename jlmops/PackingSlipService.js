/**
 * @file PackingSlipService.js
 * @description Service for preparing and managing packing slip data.
 */

const PackingSlipService = (function() {

  /**
   * Enriches the data in SysPackingCache with detailed, human-readable text.
   * This function is triggered after the initial packing data has been prepared.
   *
   * @param {Array<string>} orderIds - An array of Order IDs to process.
   */
  function preparePackingData(orderIds) {
    const serviceName = 'PackingSlipService';
    const functionName = 'preparePackingData';
    try {
        logger.info(serviceName, functionName, `Starting for ${orderIds.length} orders.`);
        if (!orderIds || orderIds.length === 0) {
            logger.info(serviceName, functionName, 'No order IDs provided for packing data enrichment. Exiting.');
            return;
        }

        // 1. Get all necessary lookup maps and configurations
        // (Lookup maps removed as per new requirement)

        // 2. Get all necessary sheets
        const allConfig = ConfigService.getAllConfig();
        const sheetNames = allConfig['system.sheet_names'];
        const spreadsheet = SheetAccessor.getDataSpreadsheet();
        const cacheSheet = spreadsheet.getSheetByName(sheetNames.SysPackingCache);
        const detailSheet = spreadsheet.getSheetByName(sheetNames.WebDetM);

        if (!cacheSheet || !detailSheet) {
            throw new Error('One or more required sheets (SysPackingCache, WebDetM) are missing.');
        }

        // 3. Create a lookup map for WebDetM
        const webDetMData = detailSheet.getDataRange().getValues();
        const webDetMHeaders = webDetMData.shift();
        const webDetMMap = new Map(webDetMData.map(row => [row[webDetMHeaders.indexOf('wdm_WebIdEn')], row]));

        // 4. Get the rows from SysPackingCache to be updated
        const cacheRange = cacheSheet.getDataRange();
        const cacheData = cacheRange.getValues();
        const cacheHeaders = cacheData.shift();
        const cacheHeaderMap = Object.fromEntries(cacheHeaders.map((h, i) => [h, i]));
        const orderIdSet = new Set(orderIds.map(String));

        // 5. Enrich the rows
        const finalData = cacheData.map(row => {
            const orderId = String(row[cacheHeaderMap['spc_OrderId']]);
            if (!orderIdSet.has(orderId)) {
                return row; // Return row as-is if not in the list of orders to process
            }

            const webIdEn = row[cacheHeaderMap['spc_WebIdEn']];
            const productDetails = webDetMMap.get(webIdEn);

            if (productDetails) {
                // (Enrichment using lookup maps removed as per new requirement)

                // --- Direct Fields ---
                row[cacheHeaderMap['spc_NameEn']] = productDetails[webDetMHeaders.indexOf('wdm_NameEn')];
                row[cacheHeaderMap['spc_NameHe']] = productDetails[webDetMHeaders.indexOf('wdm_NameHe')];
                row[cacheHeaderMap['spc_Intensity']] = productDetails[webDetMHeaders.indexOf('wdm_Intensity')];
                row[cacheHeaderMap['spc_Complexity']] = productDetails[webDetMHeaders.indexOf('wdm_Complexity')];
                row[cacheHeaderMap['spc_Acidity']] = productDetails[webDetMHeaders.indexOf('wdm_Acidity')];
                row[cacheHeaderMap['spc_Decant']] = productDetails[webDetMHeaders.indexOf('wdm_Decant')];

                // --- Build Pairing Text from Flags ---
                const getFlag = (field) => {
                    const idx = webDetMHeaders.indexOf(field);
                    if (idx === -1) return false;
                    const val = productDetails[idx];
                    return val == 1 || val === true || val === '1' || val === 'true' || val === 'yes';
                };

                // Helper to join flavors with "or" / "או"
                const joinWithOr = (arr, isEn) => {
                    if (arr.length === 0) return '';
                    if (arr.length === 1) return arr[0];
                    return arr.slice(0, -1).join(', ') + (isEn ? ' or ' : ' או ') + arr[arr.length - 1];
                };

                // Build pairing text - matching WooCommerceFormatter pattern exactly
                const harFlavorsEn = [];
                const harFlavorsHe = [];
                if (getFlag('wdm_PairHarMild')) { harFlavorsEn.push('mild'); harFlavorsHe.push('עדינים'); }
                if (getFlag('wdm_PairHarRich')) { harFlavorsEn.push('rich'); harFlavorsHe.push('עשירים'); }
                if (getFlag('wdm_PairHarIntense')) { harFlavorsEn.push('intense'); harFlavorsHe.push('עזים'); }
                if (getFlag('wdm_PairHarSweet')) { harFlavorsEn.push('sweet'); harFlavorsHe.push('מתוקים'); }

                row[cacheHeaderMap['spc_HarmonizeEn']] = harFlavorsEn.length > 0
                    ? `Harmonize with ${joinWithOr(harFlavorsEn, true)} flavors` : '';
                row[cacheHeaderMap['spc_HarmonizeHe']] = harFlavorsHe.length > 0
                    ? `הרמוניה עם טעמים ${joinWithOr(harFlavorsHe, false)}` : '';

                const conFlavorsEn = [];
                const conFlavorsHe = [];
                if (getFlag('wdm_PairConMild')) { conFlavorsEn.push('mild'); conFlavorsHe.push('עדינים'); }
                if (getFlag('wdm_PairConRich')) { conFlavorsEn.push('rich'); conFlavorsHe.push('עשירים'); }
                if (getFlag('wdm_PairConIntense')) { conFlavorsEn.push('intense'); conFlavorsHe.push('עזים'); }
                if (getFlag('wdm_PairConSweet')) { conFlavorsEn.push('sweet'); conFlavorsHe.push('מתוקים'); }

                row[cacheHeaderMap['spc_ContrastEn']] = conFlavorsEn.length > 0
                    ? `Contrast with ${joinWithOr(conFlavorsEn, true)} flavors` : '';
                row[cacheHeaderMap['spc_ContrastHe']] = conFlavorsHe.length > 0
                    ? `קונטרסט עם טעמים ${joinWithOr(conFlavorsHe, false)}` : '';

                // --- Build Product Details String ---
                // Helper to convert number to circles
                const numToCircles = (num) => {
                    const n = parseInt(num, 10);
                    if (isNaN(n) || n < 1 || n > 5) return '';
                    return '●'.repeat(n) + '○'.repeat(5 - n);
                };

                const detailsEn = [];
                const intensity = row[cacheHeaderMap['spc_Intensity']];
                const complexity = row[cacheHeaderMap['spc_Complexity']];
                const acidity = row[cacheHeaderMap['spc_Acidity']];
                if (intensity || complexity || acidity) {
                    detailsEn.push(`Intensity: ${numToCircles(intensity)}  Complexity: ${numToCircles(complexity)}  Acidity: ${numToCircles(acidity)}`);
                }
                const decant = row[cacheHeaderMap['spc_Decant']];
                if (decant) {
                    detailsEn.push(`Recommended decanting: ${decant}`);
                }
                const harmonizeEn = row[cacheHeaderMap['spc_HarmonizeEn']];
                if (harmonizeEn) {
                    detailsEn.push(harmonizeEn);
                }
                const contrastEn = row[cacheHeaderMap['spc_ContrastEn']];
                if (contrastEn) {
                    detailsEn.push(contrastEn);
                }
                row[cacheHeaderMap['spc_productDetailsEn']] = detailsEn.join('<br>');

                const detailsHe = [];
                const harmonizeHe = row[cacheHeaderMap['spc_HarmonizeHe']];
                if (harmonizeHe) {
                    detailsHe.push(harmonizeHe);
                }
                const contrastHe = row[cacheHeaderMap['spc_ContrastHe']];
                if (contrastHe) {
                    detailsHe.push(contrastHe);
                }
                row[cacheHeaderMap['spc_productDetailsHe']] = detailsHe.join('<br>');
            }
            return row;
        });

        // 6. Update the sheet
        if (finalData.length > 0) {
            cacheSheet.getRange(2, 1, finalData.length, finalData[0].length).setValues(finalData);
        }

        logger.info(serviceName, functionName, `Successfully enriched packing data for ${orderIds.length} orders.`);

        // 7. Update SysOrdLog status to 'Ready'
        const orderLogSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
        if (orderLogSheet) {
            const logRange = orderLogSheet.getDataRange();
            const orderLogData = logRange.getValues();
            const logHeaders = orderLogData.shift();
            const logHeaderMap = Object.fromEntries(logHeaders.map((h, i) => [h, i]));
            const logOrderIdCol = logHeaderMap['sol_OrderId'];
            const logStatusCol = logHeaderMap['sol_PackingStatus'];

            const processedOrderIds = new Set(orderIds.map(String));
            let updatedCount = 0;

            // Modify the array in memory
            orderLogData.forEach(row => {
                const currentOrderId = String(row[logOrderIdCol]);
                if (processedOrderIds.has(currentOrderId)) {
                    row[logStatusCol] = 'Ready';
                    updatedCount++;
                }
            });

            // Write the entire updated data array back to the sheet
            if (updatedCount > 0) {
                orderLogSheet.getRange(2, 1, orderLogData.length, logHeaders.length).setValues(orderLogData);
                logger.info(serviceName, functionName, `Updated ${updatedCount} orders to 'Ready' status in SysOrdLog.`);

                // Create packing available task (de-duplication handled by TaskService)
                try {
                  TaskService.createTask(
                    'task.order.packing_available',
                    'PACKING',
                    'Packing Slips',
                    `${updatedCount} order(s) ready for packing`,
                    `${updatedCount} order(s) are ready for packing slip generation.`,
                    null
                  );
                } catch (taskError) {
                  // De-duplication will throw if task already exists - that's expected
                  if (!taskError.message.includes('already exists')) {
                    logger.warn(serviceName, functionName, `Could not create packing task: ${taskError.message}`);
                  }
                }
            }
        } else {
            logger.warn(serviceName, functionName, 'SysOrdLog sheet not found. Could not update packing statuses.');
        }

    } catch (error) {
        logger.error(serviceName, functionName, `An error occurred: ${error.message}`, error);
    }
  }

  return {
    preparePackingData: preparePackingData
  };

})();
