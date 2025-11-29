/**
 * @file LookupService.js
 * @description Service for loading and caching data from lookup sheets.
 */

const LookupService = (function() {
    const _cache = new Map(); // Cache for loaded lookup maps

    /**
     * Gets a lookup map, from cache if available, otherwise loads it from the sheet.
     * @param {string} mapName - The name of the map configuration in SysConfig (e.g., 'map.grape_codes').
     * @returns {Map<string, Object>} A map where keys are codes and values are objects containing the row data.
     */
    function getLookupMap(mapName) {
        Logger.log(`LookupService: Attempting to get map '${mapName}'`); // Added log
        if (_cache.has(mapName)) {
            Logger.log(`LookupService: Map '${mapName}' found in cache.`); // Added log
            return _cache.get(mapName);
        }

        const mapConfig = ConfigService.getConfig(mapName);
        Logger.log(`LookupService: Config for '${mapName}': ${JSON.stringify(mapConfig)}`); // Added log
        if (!mapConfig || !mapConfig.sheet_name || !mapConfig.key_col) {
            Logger.log(`Lookup map configuration for '${mapName}' is invalid or missing in SysConfig.`);
            return new Map();
        }

        try {
            const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
            const sheet = spreadsheet.getSheetByName(mapConfig.sheet_name);
            if (!sheet) {
                Logger.log(`Lookup sheet '${mapConfig.sheet_name}' not found.`);
                return new Map();
            }

            const data = sheet.getDataRange().getValues();
            const headers = data.shift();
            const keyColIndex = headers.indexOf(mapConfig.key_col);

            if (keyColIndex === -1) {
                Logger.log(`Key column '${mapConfig.key_col}' not found in lookup sheet '${mapConfig.sheet_name}'.`);
                return new Map();
            }

            const newMap = new Map();
            data.forEach(row => {
                const key = row[keyColIndex];
                if (key !== null && key !== '') {
                    const rowObject = {};
                    headers.forEach((header, index) => {
                        rowObject[header] = row[index];
                    });
                    newMap.set(String(key), rowObject);
                }
            });

            _cache.set(mapName, newMap);
            Logger.log(`Successfully loaded and cached lookup map '${mapName}' from sheet '${mapConfig.sheet_name}'.`);
            return newMap;

        } catch (e) {
            Logger.log(`Error loading lookup map '${mapName}': ${e.message}`);
            return new Map(); // Return empty map on error
        }
    }

    /**
     * Searches products in the comaxprodm sheet by name or SKU.
     * @param {string} searchTerm - The term to search for.
     * @returns {Array<Object>} A list of matching products, limited to 15 results.
     */
    function searchComaxProducts(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        
        try {
            const allConfig = ConfigService.getAllConfig();
            const sheetName = allConfig['system.sheet_names'].CmxProdM;
            if (!sheetName) {
                throw new Error("Sheet name for 'CmxProdM' not found in configuration.");
            }

            const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
            const sheet = spreadsheet.getSheetByName(sheetName);
            if (!sheet) {
                Logger.log(`Sheet '${sheetName}' not found.`);
                return [];
            }

            const data = sheet.getDataRange().getValues();
            const headers = data.shift();
            const skuIndex = headers.indexOf('cpm_SKU');
            const nameHeIndex = headers.indexOf('cpm_NameHe');

            if (skuIndex === -1 || nameHeIndex === -1) {
                Logger.log(`Required columns 'cpm_SKU' or 'cpm_NameHe' not found in sheet '${sheetName}'.`);
                return [];
            }

            const results = [];
            for (const row of data) {
                const sku = row[skuIndex] ? String(row[skuIndex]).toLowerCase() : '';
                const nameHe = row[nameHeIndex] ? String(row[nameHeIndex]).toLowerCase() : '';

                if (sku.includes(lowerCaseSearchTerm) || nameHe.includes(lowerCaseSearchTerm)) {
                    results.push({
                        sku: row[skuIndex],
                        name: row[nameHeIndex]
                    });
                    if (results.length >= 15) {
                        break;
                    }
                }
            }
            return results;
        } catch (e) {
            Logger.log(`Error searching products: ${e.message}`);
            // Let's rethrow to be caught by the client's failure handler
            throw new Error(`Error searching products: ${e.message}`);
        }
    }

    return {
        getLookupMap: getLookupMap,
        searchComaxProducts: searchComaxProducts
    };
})();