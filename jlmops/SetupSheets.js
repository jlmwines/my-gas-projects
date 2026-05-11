/**
 * @file SetupSheets.js
 * @description Header synchronization helpers for JLMops_Data sheets.
 *
 * These functions write/refresh row 1 of each sheet from its config schema
 * (`schema.data.<SheetName>`). Data rows are never touched. Run after a
 * schema change in `config/schemas.json` (after `rebuildSysConfigFromSource()`).
 *
 * Historical note: this file previously contained 38 per-sheet
 * `create*Headers()` functions plus 4 hand-coded master orchestrators
 * (`createJlmopsSystemSheets`, `createCrmSheets`, `createLookupSheets`,
 * `setupMarketingSheets`). They were near-identical and required manual
 * upkeep whenever a sheet was added. Replaced by `syncHeaders(name)` +
 * `syncAllHeaders()` which discovers sheets from `schema.data.*` config keys.
 */

/**
 * Sync the header row of a single sheet to match its schema in config.
 *
 * @param {string} sheetName - The sheet name (e.g., 'WebProdM', 'SysContacts').
 * @param {Object} [options]
 * @param {boolean} [options.preserveExtraColumns=false] - If true, only
 *   overwrites the first N cells of row 1 (where N = schema column count),
 *   leaving columns beyond N intact. Used by `SysProductAudit`, which carries
 *   physical-count columns beyond what the schema declares.
 * @returns {void}
 */
function syncHeaders(sheetName, options) {
    const functionName = 'syncHeaders';
    options = options || {};

    if (!sheetName) {
        throw new Error("syncHeaders requires a sheetName argument. Use syncAllHeaders() to refresh every sheet, or syncHeaders('SheetName') for a single sheet.");
    }

    try {
        console.log(`${functionName}: ${sheetName}...`);

        const allConfig = ConfigService.getAllConfig();
        const schema = allConfig[`schema.data.${sheetName}`];
        if (!schema || !schema.headers) {
            throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Run rebuildSysConfigFromSource() first.`);
        }
        const headers = schema.headers.split(',');

        const spreadsheet = SheetAccessor.getDataSpreadsheet();
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            console.log(`Sheet '${sheetName}' was not found and has been created.`);
        }

        if (!options.preserveExtraColumns) {
            const maxCols = sheet.getMaxColumns();
            if (maxCols > 0) {
                sheet.getRange(1, 1, 1, maxCols).clearContent().setFontWeight('normal');
            }
        }

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        console.log(`Headers written to '${sheetName}' (${headers.length} columns).`);
    } catch (error) {
        console.error(`Error in ${functionName} for '${sheetName}': ${error.message}`);
        throw error;
    }
}

/**
 * Sync headers for every data sheet declared in config, then apply header
 * protection across data + log sheets. Discovers sheets from `schema.data.*`
 * keys — no manual list to maintain.
 *
 * @returns {{synced: number, failed: number}}
 */
function syncAllHeaders() {
    console.log('Syncing all data-sheet headers...');
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = Object.keys(allConfig)
        .filter(k => k.startsWith('schema.data.'))
        .map(k => k.replace('schema.data.', ''));

    let synced = 0;
    let failed = 0;
    for (const name of sheetNames) {
        try {
            const options = (name === 'SysProductAudit') ? { preserveExtraColumns: true } : {};
            syncHeaders(name, options);
            synced++;
        } catch (e) {
            console.error(`Failed to sync '${name}': ${e.message}`);
            failed++;
        }
    }
    console.log(`syncAllHeaders complete: ${synced} synced, ${failed} failed.`);
    protectAllSheetHeaders();
    return { synced: synced, failed: failed };
}

/**
 * Setup helper for the Campaign Architecture sheets specifically. Pairs with
 * `seedMarketingCampaigns()` — run this first, then seed. Kept as a named
 * helper because the Campaign Architecture spin-up is a documented sequence.
 * See `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`.
 */
function setupMarketingSheets() {
    console.log('Setting up Campaign Architecture sheets...');
    syncHeaders('SysMarketingCampaigns');
    syncHeaders('SysShortUrls');
    syncHeaders('SysProjects');   // refreshes header — picks up spro_CampaignId
    syncHeaders('SysCampaigns');  // refreshes header — picks up scm_MarketingCampaignId
    console.log('Marketing sheets setup complete. Now run seedMarketingCampaigns().');
}

// ============================================================================
// Header Protection
// ============================================================================

/**
 * Public function called from the UI (Development view → Protect Headers button).
 * @returns {string} Success message; throws on failure.
 */
function protectAllSheetHeadersFromUI() {
    try {
        protectAllSheetHeaders();
        return 'All sheet headers have been protected.';
    } catch (error) {
        console.error('Error protecting all sheet headers from UI: ' + error.message);
        throw new Error('Failed to protect sheet headers: ' + error.message);
    }
}

/**
 * Freeze row 1 and apply WARNING-only header-row protection across every
 * data and log sheet declared in config.
 *
 * @returns {{protected: number, skipped: number}}
 */
function protectAllSheetHeaders() {
    const functionName = 'protectAllSheetHeaders';
    try {
        console.log(`Running ${functionName}...`);
        const allConfig = ConfigService.getAllConfig();

        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;

        const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
        const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);

        const sheetSchemas = Object.keys(allConfig).filter(key =>
            key.startsWith('schema.data.') || key.startsWith('schema.log.')
        );

        let protectedCount = 0;
        let skippedCount = 0;

        for (const schemaKey of sheetSchemas) {
            const schema = allConfig[schemaKey];
            if (!schema || !schema.headers) {
                console.warn(`Skipping ${schemaKey}: schema or headers not found.`);
                skippedCount++;
                continue;
            }

            const sheetName = schemaKey.replace('schema.data.', '').replace('schema.log.', '');
            const targetSpreadsheet = schemaKey.startsWith('schema.data.')
                ? dataSpreadsheet
                : logSpreadsheet;

            const sheet = targetSpreadsheet.getSheetByName(sheetName);
            if (!sheet) {
                console.warn(`Sheet '${sheetName}' not found. Skipping.`);
                skippedCount++;
                continue;
            }

            sheet.setFrozenRows(1);

            // Remove existing header-row protections to prevent stacking.
            const existingProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
            for (const p of existingProtections) {
                const range = p.getRange();
                if (range.getRow() === 1 && range.getNumRows() === 1) {
                    p.remove();
                }
            }

            const lastCol = Math.max(1, sheet.getLastColumn());
            const protection = sheet.getRange(1, 1, 1, lastCol).protect();
            protection.setDescription(`Header protection: ${sheetName}`);
            protection.setWarningOnly(true);

            protectedCount++;
            console.log(`Protected header row for: ${sheetName}`);
        }

        console.log(`${functionName} complete: ${protectedCount} protected, ${skippedCount} skipped.`);
        return { protected: protectedCount, skipped: skippedCount };

    } catch (error) {
        console.error(`Error in ${functionName}: ${error.message}`);
        throw error;
    }
}
