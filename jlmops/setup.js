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
        headers: 'wpm_WebIdEn,wpm_SKU,wpm_NameEn,wpm_PublishStatusEn,wpm_Stock,wpm_Price'
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
    },

    // ---------------------------------------------------------------------------------
    // NEW TASK TYPES FOR VALIDATION ENGINE
    // ---------------------------------------------------------------------------------
    'task.validation.web_new_product': {
        _description: 'Task for a new web product found in staging that needs to be added to the master sheet.',
        topic: 'Products',
        default_priority: 'Medium',
        initial_status: 'New'
    },
    'task.validation.web_missing_product': {
        _description: 'Task for a web product in master that is missing from the latest web import.',
        topic: 'Products',
        default_priority: 'High',
        initial_status: 'New'
    },
    'task.validation.field_mismatch': {
        _description: 'Generic task for when a field does not match between a staging and master record.',
        topic: 'Products',
        default_priority: 'Medium',
        initial_status: 'New'
    },
    'task.validation.comax_missing_product': {
        _description: 'Task for a Comax product in master that is missing from the latest Comax import.',
        topic: 'Products',
        default_priority: 'Medium',
        initial_status: 'New'
    },
    'task.validation.comax_internal_audit': {
        _description: 'Generic task for data integrity issues within the Comax import file.',
        topic: 'Products',
        default_priority: 'Medium',
        initial_status: 'New'
    },
    'task.validation.cross_file_error': {
        _description: 'Generic task for reconciliation errors between Web and Comax data.',
        topic: 'Products',
        default_priority: 'High',
        initial_status: 'New'
    },

    // ---------------------------------------------------------------------------------
    // VALIDATION RULES (Based on legacy Compare.js)
    // ---------------------------------------------------------------------------------

    // --- A Rules: WebS vs WebM ---
    'validation.rule.A1_WebS_NotIn_WebM': {
        _description: '[A1] Checks for items in Web Staging (EN) that are missing from Web Master.',
        enabled: 'TRUE',
        test_type: 'EXISTENCE_CHECK',
        source_sheet: 'WebProdS_EN',
        target_sheet: 'WebProdM',
        source_key: 'wps_ID',
        target_key: 'wpm_WebIdEn',
        invert_result: 'TRUE', // Fire if key is NOT found
        on_failure_task_type: 'task.validation.web_new_product',
        on_failure_title: 'New Web Product: ${wps_Name}',
        on_failure_notes: 'Product ID ${wps_ID} (${wps_Name}) was found in the latest web import but does not exist in the master product list. It may need to be added.'
    },
    'validation.rule.A2_WebM_NotIn_WebS': {
        _description: '[A2] Checks for items in Web Master that are missing from Web Staging (EN).',
        enabled: 'TRUE',
        test_type: 'EXISTENCE_CHECK',
        source_sheet: 'WebProdM',
        target_sheet: 'WebProdS_EN',
        source_key: 'wpm_WebIdEn',
        target_key: 'wps_ID',
        invert_result: 'TRUE', // Fire if key is NOT found
        on_failure_task_type: 'task.validation.web_missing_product',
        on_failure_title: 'Missing Web Product: ${wpm_NameEn}',
        on_failure_notes: 'Product ID ${wpm_WebIdEn} (${wpm_NameEn}) exists in the master list but was not found in the latest web import. It may have been deleted or its ID changed.'
    },
    'validation.rule.A3_Web_SkuMismatch': {
        _description: '[A3] Compares the SKU for matching products in Web Master and Web Staging.',
        enabled: 'TRUE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'WebProdM',
        sheet_B: 'WebProdS_EN',
        key_A: 'wpm_WebIdEn',
        key_B: 'wps_ID',
        compare_fields: 'wpm_SKU,wps_SKU',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Web SKU Mismatch: ${wpm_NameEn}',
        on_failure_notes: 'Product ID ${wpm_WebIdEn} has a different SKU in master (${wpm_SKU}) versus staging (${wps_SKU}).'
    },

    // --- C Rules: ComaxS vs ComaxM ---
    'validation.rule.C1_ComaxM_NotIn_ComaxS': {
        _description: '[C1] Checks for active Comax Master products missing from Comax Staging.',
        enabled: 'TRUE',
        test_type: 'EXISTENCE_CHECK',
        source_sheet: 'CmxProdM',
        target_sheet: 'CmxProdS',
        source_key: 'cpm_SKU',
        target_key: 'cps_SKU',
        source_filter: 'cpm_IsActive,כן', // Only check active products
        invert_result: 'TRUE',
        on_failure_task_type: 'task.validation.comax_missing_product',
        on_failure_title: 'Missing Comax Product: ${cpm_NameHe}',
        on_failure_notes: 'Active SKU ${cpm_SKU} (${cpm_NameHe}) exists in Comax master but was not in the latest import.'
    },
    'validation.rule.C3_Comax_NameMismatch': {
        _description: '[C3] Compares the Name for matching products in Comax Master and Staging.',
        enabled: 'TRUE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'CmxProdM',
        sheet_B: 'CmxProdS',
        key_A: 'cpm_SKU',
        key_B: 'cps_SKU',
        compare_fields: 'cpm_NameHe,cps_NameHe',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Comax Name Mismatch: ${cpm_SKU}',
        on_failure_notes: 'SKU ${cpm_SKU} has a different name in master (${cpm_NameHe}) versus staging (${cps_NameHe}).'
    },

    // --- D Rules: ComaxS Internal Audit ---
    'validation.rule.D2_ComaxS_NegativeStock': {
        _description: '[D2] Checks for products with negative stock in Comax Staging.',
        enabled: 'TRUE',
        test_type: 'INTERNAL_AUDIT',
        source_sheet: 'CmxProdS',
        condition: 'cps_Stock,<,0',
        on_failure_task_type: 'task.validation.comax_internal_audit',
        on_failure_title: 'Negative Stock: ${cps_NameHe}',
        on_failure_notes: 'SKU ${cps_SKU} (${cps_NameHe}) has a negative stock value of ${cps_Stock} in the latest Comax import.'
    },
    'validation.rule.D3_ComaxS_ArchivedWithStock': {
        _description: '[D3] Checks for archived products with positive stock in Comax Staging.',
        enabled: 'TRUE',
        test_type: 'INTERNAL_AUDIT',
        source_sheet: 'CmxProdS',
        condition: 'cps_IsArchived,כן,AND,cps_Stock,>,0',
        on_failure_task_type: 'task.validation.comax_internal_audit',
        on_failure_title: 'Archived item with stock: ${cps_NameHe}',
        on_failure_notes: 'SKU ${cps_SKU} (${cps_NameHe}) is marked as archived but has ${cps_Stock} units in stock.'
    },

    // --- E Rules: Cross-File WebS vs ComaxS ---
    'validation.rule.E1_NewComaxOnline_NotIn_WebS': {
        _description: '[E1] New Comax SKU is sell online but not in Web Staging.',
        enabled: 'TRUE',
        test_type: 'CROSS_EXISTENCE_CHECK',
        source_sheet: 'CmxProdS',
        target_sheet: 'WebProdS_EN',
        source_key: 'cps_SKU',
        target_key: 'wps_SKU',
        source_condition: 'cps_IsWeb,כן', // Is sell online
        join_against: 'CmxProdM', // ...and is new (not in master)
        join_key_source: 'cps_SKU',
        join_key_target: 'cpm_SKU',
        join_invert: 'TRUE', // Fire if NOT in master
        invert_result: 'TRUE', // Fire if NOT in target
        on_failure_task_type: 'task.validation.cross_file_error',
        on_failure_title: 'New online SKU missing from Web: ${cps_NameHe}',
        on_failure_notes: 'New SKU ${cps_SKU} is marked \'Sell Online\' in Comax but does not exist in the web products import.'
    },
    'validation.rule.E2_WebS_SKU_NotIn_ComaxS': {
        _description: '[E2] SKU from Web Staging is missing from Comax Staging.',
        enabled: 'TRUE',
        test_type: 'EXISTENCE_CHECK',
        source_sheet: 'WebProdS_EN',
        target_sheet: 'CmxProdS',
        source_key: 'wps_SKU',
        target_key: 'cps_SKU',
        invert_result: 'TRUE',
        on_failure_task_type: 'task.validation.sku_not_in_comax',
        on_failure_title: 'Web SKU not in Comax: ${wps_Name}',
        on_failure_notes: 'SKU ${wps_SKU} (${wps_Name}) exists in the web import but is missing from the Comax import.'
    },
    'validation.rule.E3_WebPublished_ComaxNotOnline': {
        _description: '[E3] Web product is published but not marked Sell Online in Comax.',
        enabled: 'TRUE',
        test_type: 'CROSS_CONDITION_CHECK',
        sheet_A: 'WebProdS_EN',
        sheet_B: 'CmxProdS',
        key_A: 'wps_SKU',
        key_B: 'cps_SKU',
        condition_A: 'wps_Published,published',
        condition_B: 'cps_IsWeb,<>כן', // Not equal to 'Yes'
        on_failure_task_type: 'task.validation.cross_file_error',
        on_failure_title: 'Published item not for sale: ${wps_Name}',
        on_failure_notes: 'SKU ${wps_SKU} (${wps_Name}) is published on the web, but is not marked \'Sell Online\' in Comax.'
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
