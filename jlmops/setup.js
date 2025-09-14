/**
 * @file setup.js
 * @description Contains one-time setup functions for the JLM Operations Hub.
 */

// =================================================================================
// MASTER CONFIGURATION DEFINITION
// =================================================================================
// This constant is the single source of truth for the initial state of SysConfig.
const SYS_CONFIG_DEFINITIONS = {
    'system.spreadsheet.logs': {
        'description': 'The Google Sheet ID for the JLMops_Logs spreadsheet.',
        'id': '1G2vDKRaYMDdHoHiYSUaSKWgOKQgViBLjxalHIi57lpE'
    },
    'system.folder.archive': {
        'description': 'The Google Drive Folder ID for archiving processed files.',
        'id': '15klv4UL_7KCKkMsneCwx4B56bH2tL7Zd'
    },
    'system.sheet_names': {
        'description': 'Canonical names for all system-managed sheets.',
        'SysLog': 'SysLog',
        'SysJobQueue': 'SysJobQueue',
        'SysFileRegistry': 'SysFileRegistry'
    },
    'import.drive.comax_products': {
        'description': 'Configuration for the Comax Products CSV import from Google Drive.',
        'source_folder_id': '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j',
        'file_pattern': 'ComaxProducts.csv',
        'processing_service': 'ProductService',
        'file_encoding': 'Windows-1255'
    },
    'map.comax.product_columns': {
        'description': 'Maps column index to field name for the raw Comax Product CSV.',
        '0': 'cpm_CmxId', '1': 'cpm_SKU', '2': 'cpm_NameHe', '3': 'cpm_Division',
        '4': 'cpm_Group', '5': 'cpm_Vendor', '6': 'cpm_Brand', '7': 'cpm_Color',
        '8': 'cpm_Size', '9': 'cpm_Dryness', '10': 'cpm_Vintage', '14': 'cpm_Price',
        '15': 'cpm_Stock', '16': 'cpm_IsNew', '17': 'cpm_IsArchived', '18': 'cpm_IsActive',
        '19': 'cpm_IsWeb', '20': 'cpm_Exclude'
    },
    'schema.log.SysLog': {
        'description': 'Schema for the main system log sheet.',
        'headers': 'timestamp,level,service,function,message,details'
    },
    'schema.log.SysJobQueue': {
        'description': 'Schema for the job queue.',
        'headers': 'job_id,job_type,status,archive_file_id,created_timestamp,processed_timestamp,error_message'
    },
    'schema.log.SysFileRegistry': {
        'description': 'Schema for the file registry.',
        'headers': 'source_file_id,source_file_name,last_processed_timestamp'
    },
    'schema.data.CmxProdS': {
        'description': 'Schema for Comax Products Staging sheet.',
        'headers': 'cps_CmxId,cps_SKU,cps_NameHe,cps_Division,cps_Group,cps_Vendor,cps_Brand,cps_Color,cps_Size,cps_Dryness,cps_Vintage,cps_Price,cps_Stock,cps_IsNew,cps_IsArchived,cps_IsActive,cps_IsWeb,cps_Exclude'
    },
    'schema.data.CmxProdM': {
        'description': 'Schema for Comax Products Master sheet.',
        'headers': 'cpm_CmxId,cpm_SKU,cpm_NameHe,cpm_Division,cpm_Group,cpm_Vendor,cpm_Brand,cpm_Color,cpm_Size,cpm_Dryness,cpm_Vintage,cpm_Price,cpm_Stock,cpm_IsNew,cpm_IsArchived,cpm_IsActive,cpm_IsWeb,cpm_Exclude'
    },
    'schema.data.WebProdM': {
        'description': 'Schema for Web Products Master sheet.',
        'headers': 'wpm_WebIdEn,wpm_ProductType,wpm_SKU,wpm_NameEn,wpm_PublishStatusEn,wpm_Stock,wpm_Price'
    }
};
// =================================================================================

/**
 * Main setup entry point. Runs all setup functions in order.
 */
function runSetup() {
  console.log('--- Starting Full System Setup ---');
  const config = rebuildSysConfig(); // Rebuilds and returns the config object
  rebuildDataSheets(config);
  setupLogSheets(config);
  console.log('--- Full System Setup Complete ---');
}

/**
 * Recreates the SysConfig sheet from the master definition object.
 * @returns {object} The newly built configuration object.
 */
function rebuildSysConfig() {
    console.log('Starting SysConfig rebuild...');
    try {
        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        let sheet = spreadsheet.getSheetByName('SysConfig');
        if (!sheet) {
            sheet = spreadsheet.insertSheet('SysConfig', 0);
            console.log("Sheet 'SysConfig' created.");
        }

        sheet.clear();
        const headers = ['scf_SettingName', 'scf_P01', 'scf_P02'];
        sheet.getRange(1, 1, 1, 3).setValues([headers]).setFontWeight('bold');

        const rows = [];
        for (const settingName in SYS_CONFIG_DEFINITIONS) {
            for (const propName in SYS_CONFIG_DEFINITIONS[settingName]) {
                const propValue = SYS_CONFIG_DEFINITIONS[settingName][propName];
                rows.push([settingName, propName, propValue]);
            }
        }

        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 3).setValues(rows);
            console.log(`Wrote ${rows.length} rows to SysConfig.`);
        }

        console.log('SysConfig rebuild complete.');
        // Invalidate the cache and return the newly built config
        ConfigService.forceReload();
        return ConfigService.getAllConfig();
    } catch (e) {
        console.error(`Failed during SysConfig rebuild: ${e.message}`);
        throw e;
    }
}

/**
 * Recreates data sheets based on the provided configuration.
 * @param {object} config The system configuration object.
 */
function rebuildDataSheets(config) {
  console.log('Starting Data Sheet rebuild...');
  try {
    const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    console.log(`Opened JLMops_Data spreadsheet: ${spreadsheet.getName()}`);

    for (const key in config) {
      if (key.startsWith('schema.data.')) {
        const sheetName = key.substring('schema.data.'.length);
        const headers = config[key].headers;
        
        if (!headers) {
            console.warn(`No headers found for schema '${key}'. Skipping sheet.`);
            continue;
        }

        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
          sheet = spreadsheet.insertSheet(sheetName);
          console.log(`Sheet '${sheetName}' created.`);
        }
        sheet.clear();
        ensureHeaderRow(sheet, headers.split(','));
      }
    }
    console.log('Data Sheet rebuild complete.');
  } catch (e) {
    console.error(`Failed during Data Sheet rebuild: ${e.message}`);
  }
}

/**
 * Creates log sheets based on the provided configuration.
 * @param {object} config The system configuration object.
 */
function setupLogSheets(config) {
  console.log('Starting Log Sheet setup...');
  const logSheetConfig = config['system.spreadsheet.logs'];
  if (!logSheetConfig || !logSheetConfig.id) {
    console.error("Log Spreadsheet ID not found in SysConfig.");
    return;
  }
  
  try {
    const spreadsheet = SpreadsheetApp.openById(logSheetConfig.id);
    console.log(`Opened JLMops_Logs spreadsheet: ${spreadsheet.getName()}`);

    const sheetNames = config['system.sheet_names'];
    for (const key in sheetNames) {
        const sheetName = sheetNames[key];
        if (sheetName) {
            const schemaKey = `schema.log.${sheetName}`;
            const schema = config[schemaKey];

            if (!schema || !schema.headers) {
                console.warn(`No schema found for log sheet '${sheetName}'. Skipping.`);
                continue;
            }

            let sheet = spreadsheet.getSheetByName(sheetName);
            if (!sheet) {
              sheet = spreadsheet.insertSheet(sheetName);
              console.log(`Sheet '${sheetName}' created.`);
            }
            sheet.clear();
            ensureHeaderRow(sheet, schema.headers.split(','));
        }
    }
    console.log("Log sheets setup completed successfully.");
  } catch (e) {
    console.error(`Failed to open or modify the log spreadsheet: ${e.message}`);
  }
}

/**
 * Ensures the header row for a given sheet exists and matches the expected headers.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to check.
 * @param {Array<string>} expectedHeaders An array of the expected header strings.
 */
function ensureHeaderRow(sheet, expectedHeaders) {
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  console.log(`Header row for sheet '${sheet.getName()}' has been set.`);
}
