/**
 * @file WebAppLookups.js
 * @description Controller for the Lookups card on AdminProductsView.
 *
 * Wraps LookupService read/write methods in the `{ error, data }` envelope
 * used across the WebApp controllers. Called from HTML via google.script.run.
 *
 * Supported map names:
 *   - 'map.grape_lookups'   → SysLkp_Grapes
 *   - 'map.kashrut_lookups' → SysLkp_Kashrut
 *   - 'map.text_lookups'    → SysLkp_Texts
 */

const _WAL_ALLOWED_MAPS = ['map.grape_lookups', 'map.kashrut_lookups', 'map.text_lookups'];

/**
 * Guards against arbitrary mapName values reaching LookupService.
 * @param {string} mapName
 */
function _wal_assertAllowedMap(mapName) {
  if (_WAL_ALLOWED_MAPS.indexOf(mapName) === -1) {
    throw new Error(`Map '${mapName}' is not exposed via WebAppLookups.`);
  }
}

/**
 * Returns the lookup as { headers, rows } where headers come from the sheet
 * row 1 and rows is an ordered array of row objects. Headers preserve sheet
 * order so the frontend can render columns in the same order they appear in
 * the sheet without hardcoding.
 *
 * @param {string} mapName
 * @returns {Object} { error, data: { headers: string[], rows: Object[] } }
 */
function WebAppLookups_getMap(mapName) {
  try {
    _wal_assertAllowedMap(mapName);
    const map = LookupService.getLookupMap(mapName);
    const rows = Array.from(map.values());
    // Derive header order from the first row (LookupService preserved sheet order
    // when building row objects).
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { error: null, data: { headers: headers, rows: rows } };
  } catch (e) {
    logger.error('WebAppLookups', 'getMap', e.message, e);
    return { error: e.message, data: { headers: [], rows: [] } };
  }
}

/**
 * Adds a new row to the lookup. Returns the refreshed map after write.
 * @param {string} mapName
 * @param {Object} row - Column values keyed by header name.
 * @returns {Object} { error, data: { headers, rows } }
 */
function WebAppLookups_addRow(mapName, row) {
  try {
    _wal_assertAllowedMap(mapName);
    if (!row || typeof row !== 'object') throw new Error('row payload is required');
    LookupService.addLookupValue(mapName, row);
    return WebAppLookups_getMap(mapName);
  } catch (e) {
    logger.error('WebAppLookups', 'addRow', e.message, e);
    return { error: e.message, data: { headers: [], rows: [] } };
  }
}

/**
 * Updates an existing row identified by key. Returns the refreshed map.
 * @param {string} mapName
 * @param {string} key - Existing key (immutable on update).
 * @param {Object} row - Column values keyed by header name.
 * @returns {Object} { error, data: { headers, rows } }
 */
function WebAppLookups_updateRow(mapName, key, row) {
  try {
    _wal_assertAllowedMap(mapName);
    if (!key && key !== 0) throw new Error('key is required');
    if (!row || typeof row !== 'object') throw new Error('row payload is required');
    LookupService.updateLookupRow(mapName, key, row);
    return WebAppLookups_getMap(mapName);
  } catch (e) {
    logger.error('WebAppLookups', 'updateRow', e.message, e);
    return { error: e.message, data: { headers: [], rows: [] } };
  }
}
