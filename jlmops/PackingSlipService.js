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
    const functionName = 'preparePackingData';
    try {
        logger.info(`Starting ${functionName} for ${orderIds.length} orders.`);
        if (!orderIds || orderIds.length === 0) {
            logger.info('No order IDs provided for packing data enrichment. Exiting.');
            return;
        }

        // 1. Get all necessary lookup maps and configurations
        const grapesMap = LookupService.getLookupMap('map.grape_codes');
        const kashrutMap = LookupService.getLookupMap('map.kashrut_codes');
        const textsMap = LookupService.getLookupMap('map.pairing_codes'); // Points to SysLkp_Texts

        const pairingConfig = {
            harmonize: {
                mild: ConfigService.getConfig('pairing.harmonize.mild.key')?.key,
                rich: ConfigService.getConfig('pairing.harmonize.rich.key')?.key,
                intense: ConfigService.getConfig('pairing.harmonize.intense.key')?.key,
                sweet: ConfigService.getConfig('pairing.harmonize.sweet.key')?.key,
            },
            contrast: {
                mild: ConfigService.getConfig('pairing.contrast.mild.key')?.key,
                rich: ConfigService.getConfig('pairing.contrast.rich.key')?.key,
                intense: ConfigService.getConfig('pairing.contrast.intense.key')?.key,
                sweet: ConfigService.getConfig('pairing.contrast.sweet.key')?.key,
            }
        };
        const booleanConfig = {
            isMevushal: ConfigService.getConfig('boolean.is_mevushal.key')?.key,
            heterMechira: ConfigService.getConfig('boolean.heter_mechira.key')?.key,
        };

        // 2. Get all necessary sheets
        const allConfig = ConfigService.getAllConfig();
        const sheetNames = allConfig['system.sheet_names'];
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
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
                // --- Direct Lookups (Grapes, Kashrut) ---
                for (let i = 1; i <= 5; i++) {
                    const grapeCode = productDetails[webDetMHeaders.indexOf(`wdm_GrapeG${i}`)];
                    const grapeData = grapesMap.get(grapeCode);
                    row[cacheHeaderMap[`spc_GrapeG${i}Text`]] = grapeData ? grapeData.slg_TextEN : '';

                    const kashrutCode = productDetails[webDetMHeaders.indexOf(`wdm_KashrutK${i}`)];
                    const kashrutData = kashrutMap.get(kashrutCode);
                    row[cacheHeaderMap[`spc_KashrutK${i}Text`]] = kashrutData ? kashrutData.slk_TextEN : '';
                }

                // --- Conditional & Compounding Lookups (Pairing) ---
                const formatFlavorListEN = (flavors) => {
                    if (flavors.length === 0) return '';
                    if (flavors.length === 1) return flavors[0];
                    if (flavors.length === 2) return flavors.join(' or ');
                    return `${flavors.slice(0, -1).join(', ')} or ${flavors[flavors.length - 1]}`;
                };

                const formatFlavorListHE = (flavors) => {
                    if (flavors.length === 0) return '';
                    if (flavors.length === 1) return flavors[0];
                    if (flavors.length === 2) return flavors.join(' או ');
                    return `${flavors.slice(0, -1).join(', ')} או ${flavors[flavors.length - 1]}`;
                };

                const flavorProfile = [
                    { flag: 'Mild', en: 'mild', he: 'עדינים' },
                    { flag: 'Rich', en: 'rich', he: 'עשירים' },
                    { flag: 'Intense', en: 'intense', he: 'עזים' },
                    { flag: 'Sweet', en: 'sweet', he: 'מתוקים' }
                ];

                // --- Harmonize ---
                const harmonizeFlavorsEN = [];
                const harmonizeFlavorsHE = [];
                flavorProfile.forEach(flavor => {
                    if (productDetails[webDetMHeaders.indexOf(`wdm_PairHar${flavor.flag}`)]) {
                        harmonizeFlavorsEN.push(flavor.en);
                        harmonizeFlavorsHE.push(flavor.he);
                    }
                });

                if (harmonizeFlavorsEN.length > 0) {
                    row[cacheHeaderMap['spc_HarmonizeEn']] = `Harmonize with: ${formatFlavorListEN(harmonizeFlavorsEN)} flavors`;
                    row[cacheHeaderMap['spc_HarmonizeHe']] = `הרמוניה עם: טעמי ${formatFlavorListHE(harmonizeFlavorsHE)}`;
                }

                // --- Contrast ---
                const contrastFlavorsEN = [];
                const contrastFlavorsHE = [];
                flavorProfile.forEach(flavor => {
                    if (productDetails[webDetMHeaders.indexOf(`wdm_PairCon${flavor.flag}`)]) {
                        contrastFlavorsEN.push(flavor.en);
                        contrastFlavorsHE.push(flavor.he);
                    }
                });
                
                if (contrastFlavorsEN.length > 0) {
                    row[cacheHeaderMap['spc_ContrastEn']] = `Contrast with: ${formatFlavorListEN(contrastFlavorsEN)} flavors`;
                    row[cacheHeaderMap['spc_ContrastHe']] = `קונטרסט עם: טעמי ${formatFlavorListHE(contrastFlavorsHE)}`;
                }

                // --- Conditional Lookups for Boolean Flags ---
                const heterMechiraFlag = productDetails[webDetMHeaders.indexOf('wdm_HeterMechira')];
                if (heterMechiraFlag) {
                    const textData = textsMap.get(booleanConfig.heterMechira);
                    row[cacheHeaderMap['spc_HeterMechiraText']] = textData ? textData.slt_TextEN : '';
                }

                const isMevushalFlag = productDetails[webDetMHeaders.indexOf('wdm_IsMevushal')];
                if (isMevushalFlag) {
                    const textData = textsMap.get(booleanConfig.isMevushal);
                    row[cacheHeaderMap['spc_IsMevushalText']] = textData ? textData.slt_TextEN : '';
                }

                // --- Direct Fields ---
                row[cacheHeaderMap['spc_NameEn']] = productDetails[webDetMHeaders.indexOf('wdm_NameEn')];
                row[cacheHeaderMap['spc_NameHe']] = productDetails[webDetMHeaders.indexOf('wdm_NameHe')];
                row[cacheHeaderMap['spc_Intensity']] = productDetails[webDetMHeaders.indexOf('wdm_Intensity')];
                row[cacheHeaderMap['spc_Complexity']] = productDetails[webDetMHeaders.indexOf('wdm_Complexity')];
                row[cacheHeaderMap['spc_Acidity']] = productDetails[webDetMHeaders.indexOf('wdm_Acidity')];
                row[cacheHeaderMap['spc_Decant']] = productDetails[webDetMHeaders.indexOf('wdm_Decant')];

                // --- Build Product Details String ---
                const detailsEn = [];
                const intensity = row[cacheHeaderMap['spc_Intensity']];
                const complexity = row[cacheHeaderMap['spc_Complexity']];
                const acidity = row[cacheHeaderMap['spc_Acidity']];
                if (intensity || complexity || acidity) {
                    detailsEn.push(`Intensity: ${intensity || 'N/A'}, Complexity: ${complexity || 'N/A'}, Acidity: ${acidity || 'N/A'}`);
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

        logger.info(`Successfully enriched packing data for ${orderIds.length} orders.`);

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
                logger.info(`Updated ${updatedCount} orders to 'Ready' status in SysOrdLog.`);
            }
        } else {
            logger.warn('SysOrdLog sheet not found. Could not update packing statuses.');
        }

    } catch (error) {
        logger.error(`An error occurred in ${functionName}: ${error.message}`, error.stack);
    }
  }

  return {
    preparePackingData: preparePackingData
  };

})();
