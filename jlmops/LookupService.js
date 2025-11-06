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
        if (_cache.has(mapName)) {
            return _cache.get(mapName);
        }

        const mapConfig = ConfigService.getConfig(mapName);
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

    return {
        getLookupMap: getLookupMap
    };
})();