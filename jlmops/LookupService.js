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
            // Was SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next()) — a
            // Drive-wide filename search on every cold call (this in-memory _cache never
            // survives across separate google.script.run invocations). system.spreadsheet.data
            // is this same file's ID; SheetAccessor already opens it by ID and caches the
            // handle. Confirmed the dominant cost in the 15-18s product-editor load
            // (BUG_FIX_SEQUENCE Session J item 1).
            const spreadsheet = SheetAccessor.getDataSpreadsheet();
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

            const projection = _getCmxProdMSearchIndex(sheetName);
            if (!projection.length) {
                return [];
            }

            const results = [];
            for (const item of projection) {
                if (String(item.sku).toLowerCase().includes(lowerCaseSearchTerm) ||
                    String(item.name).toLowerCase().includes(lowerCaseSearchTerm)) {
                    results.push({ sku: item.sku, name: item.name });
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

    const CMX_SEARCH_CACHE_KEY = 'lookup.cmxprodm.search_index';
    const CMX_SEARCH_CACHE_TTL_SEC = 300; // 5 minutes

    /**
     * Returns a small projection of CmxProdM (sku + nameHe + lowercased variants
     * for case-insensitive search) for the Brurya autocomplete. Cached for 5 min
     * to amortize the sheet-read across keystrokes. Replaces the former per-call
     * SpreadsheetApp.open(DriveApp.getFilesByName(...)) + full-sheet scan.
     *
     * @param {string} sheetName CmxProdM sheet name from config.
     * @returns {Array<{sku: string, name: string}>}
     */
    function _getCmxProdMSearchIndex(sheetName) {
        const cache = CacheService.getScriptCache();
        const cached = cache.get(CMX_SEARCH_CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
        const spreadsheet = SheetAccessor.getDataSpreadsheet();
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
        const projection = [];
        for (const row of data) {
            const sku = row[skuIndex] ? String(row[skuIndex]) : '';
            const name = row[nameHeIndex] ? String(row[nameHeIndex]) : '';
            if (!sku && !name) continue;
            projection.push({ sku: sku, name: name });
        }
        // Cache to amortize the sheet read across keystrokes. A full catalog can
        // exceed the CacheService 100KB per-value limit — that put() throwing
        // "Argument too large: value" was breaking the search entirely. Degrade
        // gracefully: if the payload won't fit, serve uncached (re-reads per call,
        // slower but correct — same as the pre-cache behavior).
        try {
            cache.put(CMX_SEARCH_CACHE_KEY, JSON.stringify(projection), CMX_SEARCH_CACHE_TTL_SEC);
        } catch (cacheErr) {
            Logger.log(`CmxProdM search index too large to cache (${projection.length} rows): ${cacheErr.message}. Serving uncached.`);
        }
        return projection;
    }

    /**
     * Detects EN/HE pair column names by suffix (`*TextEN` / `*TextHE`).
     * @param {string[]} headers - Sheet header row.
     * @returns {{en: string[], he: string[]}} Lists of matching header names.
     */
    function _detectTextColumns(headers) {
        const en = headers.filter(h => /TextEN$/.test(String(h)));
        const he = headers.filter(h => /TextHE$/.test(String(h)));
        return { en: en, he: he };
    }

    /**
     * Resolves the JLMops_Data sheet for a given map name.
     * Throws if config or sheet is missing.
     * @param {string} mapName - The map config name (e.g. 'map.grape_lookups').
     * @returns {{sheet: Sheet, mapConfig: Object}}
     */
    function _openLookupSheet(mapName) {
        const mapConfig = ConfigService.getConfig(mapName);
        if (!mapConfig || !mapConfig.sheet_name || !mapConfig.key_col) {
            throw new Error(`Lookup map configuration for '${mapName}' is invalid or missing.`);
        }
        const spreadsheet = SheetAccessor.getDataSpreadsheet();
        const sheet = spreadsheet.getSheetByName(mapConfig.sheet_name);
        if (!sheet) {
            throw new Error(`Lookup sheet '${mapConfig.sheet_name}' not found.`);
        }
        return { sheet: sheet, mapConfig: mapConfig };
    }

    /**
     * Validates a row object against lookup invariants: key non-empty + every
     * detected EN/HE column non-empty. Throws on first failure.
     * @param {Object} row - Submitted row values keyed by header.
     * @param {string[]} headers - Sheet headers.
     * @param {string} keyCol - The key column name.
     */
    function _validateRow(row, headers, keyCol) {
        const keyVal = row[keyCol];
        if (keyVal === undefined || keyVal === null || String(keyVal).trim() === '') {
            throw new Error(`Key column '${keyCol}' is required.`);
        }
        const text = _detectTextColumns(headers);
        text.en.concat(text.he).forEach(col => {
            const v = row[col];
            if (v === undefined || v === null || String(v).trim() === '') {
                throw new Error(`Column '${col}' is required.`);
            }
        });
    }

    /**
     * Appends a new row to the lookup sheet. Enforces key uniqueness +
     * EN/HE required. Submitted column values are written; columns absent
     * from `row` are written empty.
     * @param {string} mapName - The map config name.
     * @param {Object} row - Row data keyed by header name.
     * @returns {Object} The persisted row object.
     */
    function addLookupValue(mapName, row) {
        const { sheet, mapConfig } = _openLookupSheet(mapName);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const keyCol = mapConfig.key_col;
        const keyColIndex = headers.indexOf(keyCol);
        if (keyColIndex === -1) {
            throw new Error(`Key column '${keyCol}' not found in sheet '${mapConfig.sheet_name}'.`);
        }

        _validateRow(row, headers, keyCol);

        const newKey = String(row[keyCol]).trim();
        if (sheet.getLastRow() > 1) {
            const existingKeys = sheet.getRange(2, keyColIndex + 1, sheet.getLastRow() - 1, 1).getValues();
            const duplicate = existingKeys.some(r => String(r[0]).trim() === newKey);
            if (duplicate) {
                throw new Error(`Key '${newKey}' already exists in '${mapConfig.sheet_name}'.`);
            }
        }

        const newRow = headers.map(h => {
            const v = row[h];
            return (v === undefined || v === null) ? '' : v;
        });
        // Append per feedback_schema_append_only
        sheet.appendRow(newRow);
        SpreadsheetApp.flush();

        _cache.delete(mapName);

        const persisted = {};
        headers.forEach((h, i) => { persisted[h] = newRow[i]; });
        return persisted;
    }

    /**
     * Updates an existing lookup row identified by key. Preserves columns
     * not present in `row`. Enforces EN/HE required.
     * @param {string} mapName - The map config name.
     * @param {string} key - Existing key (immutable on update).
     * @param {Object} row - Row data keyed by header name.
     * @returns {Object} The persisted row object.
     */
    function updateLookupRow(mapName, key, row) {
        const { sheet, mapConfig } = _openLookupSheet(mapName);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const keyCol = mapConfig.key_col;
        const keyColIndex = headers.indexOf(keyCol);
        if (keyColIndex === -1) {
            throw new Error(`Key column '${keyCol}' not found in sheet '${mapConfig.sheet_name}'.`);
        }

        const targetKey = String(key).trim();
        if (sheet.getLastRow() <= 1) {
            throw new Error(`Sheet '${mapConfig.sheet_name}' is empty; key '${targetKey}' not found.`);
        }

        const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
        const dataValues = dataRange.getValues();
        const rowIndex = dataValues.findIndex(r => String(r[keyColIndex]).trim() === targetKey);
        if (rowIndex === -1) {
            throw new Error(`Key '${targetKey}' not found in '${mapConfig.sheet_name}'.`);
        }

        // Build merged row: preserve existing values for headers absent from `row`,
        // force key column to original value (immutable on update).
        const existing = dataValues[rowIndex];
        const merged = headers.map((h, i) => {
            if (h === keyCol) return existing[i];
            if (Object.prototype.hasOwnProperty.call(row, h)) {
                const v = row[h];
                return (v === undefined || v === null) ? '' : v;
            }
            return existing[i];
        });

        // Validate against the merged shape (covers the case where row omits EN/HE).
        const mergedRowObj = {};
        headers.forEach((h, i) => { mergedRowObj[h] = merged[i]; });
        _validateRow(mergedRowObj, headers, keyCol);

        const sheetRowNumber = rowIndex + 2; // +1 for header, +1 to 1-index
        sheet.getRange(sheetRowNumber, 1, 1, headers.length).setValues([merged]);
        SpreadsheetApp.flush();

        _cache.delete(mapName);

        return mergedRowObj;
    }

    return {
        getLookupMap: getLookupMap,
        searchComaxProducts: searchComaxProducts,
        addLookupValue: addLookupValue,
        updateLookupRow: updateLookupRow
    };
})();