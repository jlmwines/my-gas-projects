/**
 * @file setup.js
 * @description Contains one-time setup functions for the JLM Operations Hub.
 */

// =================================================================================
// MASTER CONFIGURATION DEFINITION
// =================================================================================
// This constant is the single source of truth for the initial state of SysConfig.
// It is structured to be written into the 12-column SysConfig sheet.
const SYS_CONFIG_DEFINITIONS = {
    'system.spreadsheet.logs': {
        _description: 'The Google Sheet ID for the JLMops_Logs spreadsheet.',
        id: '1G2vDKRaYMDdHoHiYSUaSKWgOKQgViBLjxalHIi57lpE'
    },
    'system.folder.archive': {
        _description: 'The Google Drive Folder ID for archiving processed files.',
        id: '15klv4UL_7KCKkMsneCwx4B56bH2tL7Zd'
    },
    'system.sheet_names': {
        _description: 'Canonical names for all system-managed sheets.',
        SysLog: 'SysLog',
        SysJobQueue: 'SysJobQueue',
        SysFileRegistry: 'SysFileRegistry'
    },
    'import.drive.comax_products': {
        _description: 'Configuration for the Comax Products CSV import from Google Drive.',
        source_folder_id: '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j',
        file_pattern: 'ComaxProducts.csv',
        processing_service: 'ProductService',
        file_encoding: 'Windows-1255'
    },
    'import.drive.web_products_en': {
        _description: 'Configuration for the English Web Products CSV import from Google Drive.',
        source_folder_id: '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j',
        file_pattern: 'WebProducts.csv',
        processing_service: 'ProductService',
        file_encoding: 'UTF-8'
    },
    'import.drive.web_products_he': {
        _description: 'Configuration for the Hebrew Web Products CSV import from Google Drive.',
        source_folder_id: '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j',
        file_pattern: 'WeHe.csv',
        processing_service: 'ProductService',
        file_encoding: 'UTF-8'
    },
    'map.comax.product_columns': {
        _description: 'Maps column index to field name for the raw Comax Product CSV.',
        '0': 'cpm_CmxId', '1': 'cpm_SKU', '2': 'cpm_NameHe', '3': 'cpm_Division',
        '4': 'cpm_Group', '5': 'cpm_Vendor', '6': 'cpm_Brand', '7': 'cpm_Color',
        '8': 'cpm_Size', '9': 'cpm_Dryness', '10': 'cpm_Vintage', '14': 'cpm_Price',
        '15': 'cpm_Stock', '16': 'cpm_IsNew', '17': 'cpm_IsArchived', '18': 'cpm_IsActive',
        '19': 'cpm_IsWeb', '20': 'cpm_Exclude'
    },
    'schema.log.SysLog': {
        _description: 'Schema for the main system log sheet.',
        headers: 'timestamp,level,service,function,message,details'
    },
    'schema.log.SysJobQueue': {
        _description: 'Schema for the job queue.',
        headers: 'job_id,job_type,status,archive_file_id,created_timestamp,processed_timestamp,error_message'
    },
    'schema.log.SysFileRegistry': {
        _description: 'Schema for the file registry.',
        headers: 'source_file_id,source_file_name,last_processed_timestamp'
    },
    'schema.data.CmxProdS': {
        _description: 'Schema for Comax Products Staging sheet.',
        headers: 'cps_CmxId,cps_SKU,cps_NameHe,cps_Division,cps_Group,cps_Vendor,cps_Brand,cps_Color,cps_Size,cps_Dryness,cps_Vintage,cps_Price,cps_Stock,cps_IsNew,cps_IsArchived,cps_IsActive,cps_IsWeb,cps_Exclude'
    },
    'schema.data.CmxProdM': {
        _description: 'Schema for Comax Products Master sheet.',
        headers: 'cpm_CmxId,cpm_SKU,cpm_NameHe,cpm_Division,cpm_Group,cpm_Vendor,cpm_Brand,cpm_Color,cpm_Size,cpm_Dryness,cpm_Vintage,cpm_Price,cpm_Stock,cpm_IsNew,cpm_IsArchived,cpm_IsActive,cpm_IsWeb,cpm_Exclude'
    },
    'schema.data.WebProdM': {
        _description: 'Schema for Web Products Master sheet.',
        headers: 'wpm_WebIdEn,wpm_ProductType,wpm_SKU,wpm_NameEn,wpm_PublishStatusEn,wpm_Stock,wpm_Price'
    },
    'schema.data.WebProdS_EN': {
        _description: 'Schema for English Web Products Staging sheet.',
        headers: 'wps_ID,wps_Type,wps_SKU,wps_Name,wps_Published,wps_IsFeatured,wps_VisibilityInCatalog,wps_ShortDescription,wps_Description,wps_DateSalePriceStarts,wps_DateSalePriceEnds,wps_TaxStatus,wps_TaxClass,wps_InStock,wps_Stock,wps_BackordersAllowed,wps_SoldIndividually,wps_Weight,wps_Length,wps_Width,wps_Height,wps_AllowCustomerReviews,wps_PurchaseNote,wps_SalePrice,wps_RegularPrice,wps_Categories,wps_Tags,wps_ShippingClass,wps_Images,wps_DownloadLimit,wps_DownloadExpiry,wps_Parent,wps_GroupedProducts,wps_Upsells,wps_CrossSells,wps_ExternalURL,wps_ButtonText,wps_Position,wps_Attribute1Name,wps_Attribute1Value,wps_Attribute1Visible,wps_Attribute1Global,wps_Attribute2Name,wps_Attribute2Value,wps_Attribute2Visible,wps_Attribute2Global,wps_MetaWpmlTranslationHash,wps_MetaWpmlLanguage,wps_MetaWpmlSourceId'
    },
    'schema.data.WebProdS_HE': {
        _description: 'Schema for Hebrew Web Products Staging sheet.',
        headers: 'wps_ID,wps_Type,wps_SKU,wps_Name,wps_Published,wps_IsFeatured,wps_VisibilityInCatalog,wps_ShortDescription,wps_Description,wps_DateSalePriceStarts,wps_DateSalePriceEnds,wps_TaxStatus,wps_TaxClass,wps_InStock,wps_Stock,wps_BackordersAllowed,wps_SoldIndividually,wps_Weight,wps_Length,wps_Width,wps_Height,wps_AllowCustomerReviews,wps_PurchaseNote,wps_SalePrice,wps_RegularPrice,wps_Categories,wps_Tags,wps_ShippingClass,wps_Images,wps_DownloadLimit,wps_DownloadExpiry,wps_Parent,wps_GroupedProducts,wps_Upsells,wps_CrossSells,wps_ExternalURL,wps_ButtonText,wps_Position,wps_Attribute1Name,wps_Attribute1Value,wps_Attribute1Visible,wps_Attribute1Global,wps_Attribute2Name,wps_Attribute2Value,wps_Attribute2Visible,wps_Attribute2Global,wps_MetaWpmlTranslationHash,wps_MetaWpmlLanguage,wps_MetaWpmlSourceId'
    },
    'task.validation.sku_not_in_comax': {
        _description: 'Task definition for when a SKU from a web import does not exist in the Comax master data.',
        topic: 'Products',
        default_priority: 'High',
        initial_status: 'New'
    },
    'task.validation.translation_missing': {
        _description: 'Task definition for when a product is missing its counterpart in the other language.',
        topic: 'Products',
        default_priority: 'High',
        initial_status: 'New'
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
        const headers = ['scf_SettingName', 'scf_Description', 'scf_P01', 'scf_P02', 'scf_P03', 'scf_P04', 'scf_P05', 'scf_P06', 'scf_P07', 'scf_P08', 'scf_P09', 'scf_P10'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

        const rows = [];
        for (const settingName in SYS_CONFIG_DEFINITIONS) {
            const settingBlock = SYS_CONFIG_DEFINITIONS[settingName];
            const description = settingBlock._description || '';

            for (const propName in settingBlock) {
                if (propName === '_description') continue;

                const propValue = settingBlock[propName];
                // Create a row with 12 columns, matching the header
                const row = new Array(12).fill('');
                row[0] = settingName;
                row[1] = description; // Description is the same for all properties in a block
                row[2] = propName;    // scf_P01
                row[3] = propValue;   // scf_P02
                rows.push(row);
            }
        }

        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 12).setValues(rows);
            console.log(`Wrote ${rows.length} rows to SysConfig.`);
        }

        console.log('SysConfig rebuild complete.');
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
        if (key === '_description') continue;

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
