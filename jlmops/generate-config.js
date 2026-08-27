
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, 'config');
const outputFile = path.join(__dirname, 'SetupConfig.js');

/**
 * Runtime-mutable keys: their value is written at runtime via
 * ConfigService.setConfig/setConfigLocked and must survive rebuildSysConfigFromSource
 * (which otherwise wipes SysConfig back to this file's shipped defaults). Each entry
 * names the SettingName plus the key field whose value is preserved, and the value
 * that key resets to right after the sheet is cleared and rewritten from
 * masterConfig -- used by the restore-time race guard in rebuildSysConfigFromSource.
 * 'system.kpi.gsc_last_snapshot' and 'system.bundles.needs_update_status' have no
 * masterConfig row at all (created dynamically at runtime), so their reset state is
 * the row not existing (default left undefined), not an empty string.
 *
 * This is the single source of truth -- embedded verbatim into the generated
 * SetupConfig.js (see fileContent below) and checked against every live
 * ConfigService.setConfig(Locked) call site by checkRuntimeKeysCompleteness()
 * (D3, SYNC_HARDENING_PLAN.md) so a future runtime-written setting can't drift
 * out of this list unnoticed the way these 10 did.
 */
const RUNTIME_KEYS = [
    { name: 'system.brurya.last_update', key: 'value', default: '' },
    { name: 'system.mailchimp.subscribers_last_update', key: 'value', default: '' },
    { name: 'system.mailchimp.campaigns_last_update', key: 'value', default: '' },
    { name: 'system.crm.last_refresh', key: 'value', default: '' },
    { name: 'system.bundle_health.last_check', key: 'value', default: '' },
    { name: 'system.crm_intelligence.last_run', key: 'value', default: '' },
    { name: 'system.sync.state', key: 'json', default: '{}' },
    { name: 'woo.api', key: 'products_last_pull', default: '' },
    { name: 'woo.api', key: 'orders_last_pull', default: '' },
    { name: 'system.kpi.gsc_last_snapshot', key: 'value' },
    // Added 2026-08-27 (D3) -- found via checkRuntimeKeysCompleteness() against
    // every live ConfigService.setConfig(Locked) call site, not hand-enumerated.
    { name: 'system.woocommerce.coupons_last_update', key: 'value', default: '' },
    { name: 'crm.frequent_pipeline.last_modified_floor', key: 'value', default: '' },
    { name: 'system.crm.welcome_floor_date', key: 'value', default: '' },
    { name: 'crm.pending_payment_followup.floor_date', key: 'value', default: '' },
    { name: 'crm.pending_payment_followup.last_pending_ids', key: 'value', default: '[]' },
    { name: 'crm.pending_payment_followup.sent_order_ids', key: 'value', default: '[]' },
    { name: 'system.product_costs.last_recompute', key: 'value', default: '' },
    { name: 'system.bundles.push_status', key: 'value', default: '' },
    { name: 'system.category_stock.health', key: 'value', default: '' },
    { name: 'system.bundles.needs_update_status', key: 'value' },
    // Added 2026-08-27 (CONTACT_MANAGER_PLAN.md "Known issue -- welcome-outreach
    // recency + dedup gap"), same run as the fix in HousekeepingService.js.
    { name: 'system.crm.welcomed_emails', key: 'value', default: '[]' }
];

/**
 * Fails the build loudly if any live ConfigService.setConfig(Locked) call site
 * writes a (settingName, key) pair covered by neither RUNTIME_KEYS nor a real
 * (non-blank) default already in masterConfig -- such a pair would be silently
 * wiped back to blank on the next rebuildSysConfigFromSource() (D3, SYNC_HARDENING_PLAN.md).
 *
 * Two known, accepted limitations (not fixed here, stated so they aren't mistaken
 * for covered): (1) only call sites whose first two arguments are BOTH string
 * literals are detected -- a variable-keyed call (e.g. SyncStateService.js's
 * `ConfigService.setConfig(SYNC_STATE_CONFIG_KEY, 'json', ...)`) can't be resolved
 * by a regex scan and is silently skipped; it happens to already be covered by
 * RUNTIME_KEYS today, so there's no live gap, but this check doesn't actually
 * verify that call site. (2) this only catches a setting missing registration
 * today -- it can't catch a setting that currently has a real masterConfig default
 * and later, in some other change, starts being written at runtime without ever
 * being added here.
 */
function checkRuntimeKeysCompleteness(masterConfigArray, runtimeKeys) {
    const covered = new Set(runtimeKeys.map(function(rk) { return rk.name + '::' + rk.key; }));

    const masterDefaults = new Map();
    masterConfigArray.forEach(function(row) {
        if (row.length >= 5) {
            masterDefaults.set(row[0] + '::' + row[3], row[4]);
        }
    });

    const callSitePattern = /ConfigService\.(?:setConfig|setConfigLocked)\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g;
    const checkedPairs = new Set();
    const missing = [];

    fs.readdirSync(__dirname)
        .filter(function(f) { return f.endsWith('.js') && f !== 'generate-config.js' && f !== 'SetupConfig.js'; })
        .forEach(function(file) {
            const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
            let match;
            while ((match = callSitePattern.exec(source)) !== null) {
                const pairKey = match[1] + '::' + match[2];
                if (checkedPairs.has(pairKey)) continue;
                checkedPairs.add(pairKey);

                const defaultVal = masterDefaults.get(pairKey);
                const hasRealDefault = defaultVal !== undefined && defaultVal !== '';
                if (!covered.has(pairKey) && !hasRealDefault) {
                    missing.push(pairKey + '  (' + file + ')');
                }
            }
        });

    if (missing.length > 0) {
        console.error('RUNTIME_KEYS completeness check FAILED -- the following ConfigService.setConfig(Locked) call site(s) write a runtime key with no RUNTIME_KEYS registration and no real masterConfig default (rebuildSysConfigFromSource would silently wipe them back to blank/undefined):');
        missing.forEach(function(m) { console.error('  - ' + m); });
        console.error('Fix: add a RUNTIME_KEYS entry above, or give the setting a real default in config/*.json if wipe-on-rebuild is actually correct for it.');
        process.exit(1);
    }
    console.log('RUNTIME_KEYS completeness check passed -- ' + checkedPairs.size + ' distinct setConfig(Locked) call-site pair(s) checked.');
}

function processTemplates(data) {
    const output = [];
    for (const row of data) {
        const settingName = row[0] || '';

        if (settingName.startsWith('map.web.order_columns.template')) {
            // Existing mapping template logic
            const nameTemplate = row[3];
            const valueTemplate = row[4];
            const range = row[5].split('-').map(Number);
            const fields = row[6].split(',');

            for (let i = range[0]; i <= range[1]; i++) {
                for (const field of fields) {
                    const newRow = JSON.parse(JSON.stringify(row)); // Deep copy
                    newRow[0] = settingName.replace('.template', '');
                    newRow[3] = nameTemplate.replace('{i}', i).replace('{field}', field);
                    newRow[4] = valueTemplate.replace('{i}', i).replace('{field}', field.replace(/ /g, ''));
                    newRow[5] = ''; // Clear template-specific fields
                    newRow[6] = ''; // Clear template-specific fields
                    output.push(newRow);
                }
            }
                    } else if (settingName.startsWith('validation.rule.template') || settingName.startsWith('task.template')) {
                        const ruleName = row[1];
                        const description = row[2];
                        const status = row[3];
        
                        let finalSettingName = '';
                        if (settingName.startsWith('validation.rule.template')) {
                            finalSettingName = 'validation.rule.' + ruleName;
                        } else if (settingName.startsWith('task.template')) {
                            finalSettingName = ruleName; // ruleName already contains the full prefix
                        }
        
                        for (let i = 4; i < row.length; i += 2) {
                            const key = row[i];
                            const value = row[i + 1];
        
                            if (key === undefined || value === undefined) {
                                break;
                            }
        
                            const newRow = [finalSettingName, description, status, key, value];
                            // Ensure the newRow has enough empty strings to match the expected column count
                            while (newRow.length < 13) { // Assuming max 13 columns in SysConfig
                                newRow.push('');
                            }
                            output.push(newRow);
                        }        } else {
            // This is a regular row, just add it
            output.push(row);
        }
    }
    return output;
}

function generateSetupConfig() {
    const configOrder = [
        'headers', 'system', 'crm', 'jobs', 'schemas', 'mappings', 'validation',
        'taskDefinitions', 'migrationColumnMapping', 'orders', 'migrationSyncTasks',
        'printing', 'users', 'otherSettings'
    ];

    let masterConfigArray = [];

    try {
        // First pass: collect all rows and find max column count
        let allRows = [];
        for (const fileName of configOrder) {
            const filePath = path.join(inputDir, `${fileName}.json`);
            const rawData = fs.readFileSync(filePath, 'utf8');
            let jsonData = JSON.parse(rawData);
            const processedData = processTemplates(jsonData);
            allRows.push(...processedData);
        }

        // Find max column count
        const maxCols = Math.max(...allRows.map(row => row.length));
        console.log(`Max column count: ${maxCols}`);

        // Second pass: pad all rows to max column count
        masterConfigArray = allRows.map(row => {
            const newRow = [...row];
            while (newRow.length < maxCols) {
                newRow.push('');
            }
            return newRow;
        });
    } catch (error) {
        console.error(`Error reading or parsing JSON files from ${inputDir}:`, error);
        process.exit(1);
    }

    checkRuntimeKeysCompleteness(masterConfigArray, RUNTIME_KEYS);

    // Convert the JavaScript array to a string representation for the file
    const arrayString = JSON.stringify(masterConfigArray, null, 4);

    // Create the content for the new SetupConfig.js file
    const fileContent = `/**
 * @file SetupConfig.js
 * @description Contains functions for managing the master SysConfig sheet.
 * IMPORTANT: This file is auto-generated. Do not edit it manually.
 * Instead, edit the JSON files in the /config directory and run generate-config.js.
 */

// =================================================================
//  MASTER CONFIGURATION FUNCTION
// =================================================================

/**
 * Overwrites the live SysConfig sheet with the master configuration defined in this script.
 * Runtime-mutable values (timestamps, sync state, etc. — see RUNTIME_KEYS) are
 * snapshotted before the wipe and restored after, so a rebuild does not destroy
 * state written at runtime by setConfig. The masterConfig is otherwise the
 * authoritative source for every row's structure and defaults.
 */
function rebuildSysConfigFromSource() {
    const functionName = 'rebuildSysConfigFromSource';
    const masterConfig = getMasterConfiguration();

    // RUNTIME_KEYS is generate-config.js's own const of the same name (top of
    // file) -- embedded here verbatim at generation time so this function's
    // copy can never drift from the one checkRuntimeKeysCompleteness() checks
    // against (D3, SYNC_HARDENING_PLAN.md). See that const's own comment for
    // what each entry means and the restore-time race guard below for how it's used.
    const RUNTIME_KEYS = ${JSON.stringify(RUNTIME_KEYS, null, 8)};

    try {
        console.log('Running ' + functionName + '...');

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheet = spreadsheet.getSheetByName('SysConfig');
        if (!sheet) {
            throw new Error('SysConfig sheet not found in JLMops_Data spreadsheet.');
        }
        console.log('Target SysConfig sheet located.');

        // ----- Snapshot runtime-mutable values BEFORE clearing -----
        const snapshot = {};
        try {
            ConfigService.forceReload();
            RUNTIME_KEYS.forEach(function(rk) {
                try {
                    const cfg = ConfigService.getConfig(rk.name);
                    if (cfg && cfg[rk.key]) {
                        snapshot[rk.name + '::' + rk.key] = cfg[rk.key];
                    }
                } catch (snapErr) {
                    console.warn('Snapshot skipped for ' + rk.name + ' / ' + rk.key + ': ' + snapErr.message);
                }
            });
            console.log('Snapshotted ' + Object.keys(snapshot).length + ' runtime-mutable value(s).');
        } catch (snapshotPhaseErr) {
            // Abort before any destructive action — we will not partially wipe.
            throw new Error('Snapshot phase failed, aborting before clear: ' + snapshotPhaseErr.message);
        }

        // ----- Destructive rewrite from masterConfig -----
        sheet.clear();
        console.log('Cleared existing content from SysConfig sheet.');

        const numRows = masterConfig.length;
        const numCols = masterConfig[0].length;
        sheet.getRange(1, 1, numRows, numCols).setValues(masterConfig);
        console.log('Wrote ' + numRows + ' rows and ' + numCols + ' columns to SysConfig.');

        // Format header
        sheet.getRange(1, 1, 1, numCols).setFontWeight('bold');
        console.log('Formatted header row.');

        ConfigService.forceReload(); // Invalidate cache so the restore reads fresh rows

        // ----- Restore runtime-mutable values -----
        // Each restore acquires a short lock, re-reads the CURRENT live value with
        // the same raw (undefaulted) read the snapshot phase used, and compares it
        // to this key's own known reset value. If the live value still matches --
        // nothing wrote real state during the clear/rewrite window -- it's safe to
        // restore the snapshot. If it doesn't match, a real write landed during the
        // window; skip the restore and leave that live write in place. The compare
        // and the restore write happen inside the same lock hold so this can't
        // itself become a check-then-write race (SYNC_HARDENING_PLAN.md Stage B
        // point 5 -- closes the one path Bug 5's write-site migration can't reach,
        // since this rewrite touches system.sync.state via a variable key, not a
        // SyncStateService call).
        let restored = 0;
        let restoreErrors = 0;
        let skippedLiveWrite = 0;
        RUNTIME_KEYS.forEach(function(rk) {
            const value = snapshot[rk.name + '::' + rk.key];
            if (!value) return; // nothing snapshotted for this key
            try {
                const applied = LockHelpers.withScriptLock('rebuild-sysconfig-restore:' + rk.name + ':' + rk.key, 30000, function() {
                    const liveConfig = ConfigService.getConfig(rk.name);
                    const liveValue = liveConfig ? liveConfig[rk.key] : undefined;
                    if (liveValue !== rk.default) {
                        console.warn('Restore skipped for ' + rk.name + ' / ' + rk.key + ': live value changed since clear (a real write landed during the window).');
                        return false;
                    }
                    ConfigService.setConfig(rk.name, rk.key, value);
                    return true;
                });
                if (applied === null) {
                    console.warn('Restore skipped for ' + rk.name + ' / ' + rk.key + ': could not acquire lock.');
                    skippedLiveWrite++;
                } else if (applied) {
                    restored++;
                } else {
                    skippedLiveWrite++;
                }
            } catch (restErr) {
                console.error('Restore failed for ' + rk.name + ' / ' + rk.key + ': ' + restErr.message);
                restoreErrors++;
            }
        });
        ConfigService.forceReload();
        console.log('Restored ' + restored + ' runtime-mutable value(s), skipped ' + skippedLiveWrite + ' due to a live write/contention, ' + restoreErrors + ' error(s).');

        console.log(functionName + ' completed successfully.');

    } catch (error) {
        console.error('A critical error occurred in ' + functionName + ': ' + error.message);
        try {
            SpreadsheetApp.getUi().alert('Error: ' + error.message);
        } catch (e) {
            // getUi() fails in web app context - error already logged above
        }
    }
}

/**
 * Contains the master source of truth for the SysConfig sheet.
 * @returns {Array<Array<string>>} A 2D array representing the SysConfig data.
 */
function getMasterConfiguration() {
    return ${arrayString};
}
`;

    try {
        fs.writeFileSync(outputFile, fileContent, 'utf8');
        console.log(`Successfully generated ${outputFile}`);
    } catch (error) {
        console.error(`Error writing to ${outputFile}:`, error);
        process.exit(1);
    }
}

generateSetupConfig();
