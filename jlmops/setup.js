// Forcing a change for git detection.
/**
 * @file setup.js
 * @description Contains functions for setup, migration, and diagnostics of the SysConfig sheet.
 */

// =================================================================
//  MASTER CONFIGURATION FUNCTION
// =================================================================

/**
 * Overwrites the live SysConfig sheet with the master configuration defined in this script.
 * This is the authoritative source of truth for the system configuration.
 */
function rebuildSysConfigFromSource() {
    const functionName = 'rebuildSysConfigFromSource';
    const masterConfig = getMasterConfiguration();

    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheet = spreadsheet.getSheetByName('SysConfig');
        if (!sheet) {
            throw new Error('SysConfig sheet not found in JLMops_Data spreadsheet.');
        }
        console.log('Target SysConfig sheet located.');

        // Clear and write data
        sheet.clear();
        console.log('Cleared existing content from SysConfig sheet.');

        const numRows = masterConfig.length;
        const numCols = masterConfig[0].length;
        sheet.getRange(1, 1, numRows, numCols).setValues(masterConfig);
        console.log(`Wrote ${numRows} rows and ${numCols} columns to SysConfig.`);

        // Format header
        sheet.getRange(1, 1, 1, numCols).setFontWeight('bold');
        console.log('Formatted header row.');

        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
    }
}


// =================================================================
//  MASTER CONFIGURATION DATA
// =================================================================

/**
 * Contains the master source of truth for the SysConfig sheet.
 * @returns {Array<Array<string>>} A 2D array representing the SysConfig data.
 */
function getMasterConfiguration() {
    return [
        // Headers
        ['scf_SettingName', 'scf_Description', 'scf_status', 'scf_P01', 'scf_P02', 'scf_P03', 'scf_P04', 'scf_P05', 'scf_P06', 'scf_P07', 'scf_P08', 'scf_P09', 'scf_P10'],

        // System
        ['_section.01_System', 'High-level system settings and versioning.', '', '', '', '', '', '', '', '', '', '', ''],
        ['sys.schema.version', 'The current schema version of the SysConfig sheet.', 'stable', 'value', '2', '', '', '', '', '', '', '', ''],

        // Imports
        ['_section.02_Imports', 'Configurations for importing data from external sources.', '', '', '', '', '', '', '', '', '', '', ''],
        ['import.drive.comax_products', 'Configuration for the Comax Products CSV import from Google Drive.', 'stable', 'source_folder_id', '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j', '', '', '', '', '', '', '', ''],
        ['import.drive.comax_products', 'Configuration for the Comax Products CSV import from Google Drive.', 'stable', 'file_pattern', 'ComaxProducts.csv', '', '', '', '', '', '', '', ''],
        ['import.drive.comax_products', 'Configuration for the Comax Products CSV import from Google Drive.', 'stable', 'processing_service', 'ProductService', '', '', '', '', '', '', '', ''],
        ['import.drive.comax_products', 'Configuration for the Comax Products CSV import from Google Drive.', 'stable', 'file_encoding', 'Windows-1255', '', '', '', '', '', '', '', ''],
        ['import.drive.web_products_en', 'Configuration for the English Web Products CSV import from Google Drive.', 'stable', 'source_folder_id', '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j', '', '', '', '', '', '', '', ''],
        ['import.drive.web_products_en', 'Configuration for the English Web Products CSV import from Google Drive.', 'stable', 'file_pattern', 'WebProducts.csv', '', '', '', '', '', '', '', ''],
        ['import.drive.web_products_en', 'Configuration for the English Web Products CSV import from Google Drive.', 'stable', 'processing_service', 'ProductService', '', '', '', '', '', '', '', ''],
        ['import.drive.web_products_en', 'Configuration for the English Web Products CSV import from Google Drive.', 'stable', 'file_encoding', 'UTF-8', '', '', '', '', '', '', '', ''],

        // Schemas
        ['_section.03_Schemas', 'Schema definitions for staging and master sheets.', '', '', '', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdM', 'Schema for Comax Products Master sheet.', 'stable', 'headers', 'cpm_CmxId,cpm_SKU,cpm_NameHe,cpm_Division,cpm_Group,cpm_Vendor,cpm_Brand,cpm_Color,cpm_Size,cpm_Dryness,cpm_Vintage,cpm_IsNew,cpm_IsArchived,cpm_IsActive,cpm_Price,cpm_Stock,cpm_IsWeb,cpm_Exclude', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdS', 'Schema for Comax Products Staging sheet.', 'stable', 'headers', 'cps_CmxId,cps_SKU,cps_NameHe,cps_Division,cps_Group,cps_Vendor,cps_Brand,cps_Color,cps_Size,cps_Dryness,cps_Vintage,cps_IsNew,cps_IsArchived,cps_IsActive,cps_Price,cps_Stock,cps_IsWeb,cps_Exclude', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdM', 'Schema for Web Products Master sheet.', 'stable', 'headers', 'wpm_WebIdEn,wpm_SKU,wpm_NameEn,wpm_PublishStatusEn,wpm_Stock,wpm_Price', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdS_EN', 'Schema for Web Products Staging sheet (EN).', 'stable', 'headers', 'wps_ID,wps_Type,wps_SKU,wps_Name,wps_Published,wps_IsFeatured,wps_VisibilityInCatalog,wps_ShortDescription,wps_Description,wps_DateSalePriceStarts,wps_DateSalePriceEnds,wps_TaxStatus,wps_TaxClass,wps_InStock,wps_Stock,wps_BackordersAllowed,wps_SoldIndividually,wps_Weight,wps_Length,wps_Width,wps_Height,wps_AllowCustomerReviews,wps_PurchaseNote,wps_SalePrice,wps_RegularPrice,wps_Categories,wps_Tags,wps_ShippingClass,wps_Images,wps_DownloadLimit,wps_DownloadExpiry,wps_Parent,wps_GroupedProducts,wps_Upsells,wps_CrossSells,wps_ExternalURL,wps_ButtonText,wps_Position,wps_Attribute1Name,wps_Attribute1Value,wps_Attribute1Visible,wps_Attribute1Global,wps_Attribute2Name,wps_Attribute2Value,wps_Attribute2Visible,wps_Attribute2Global,wps_MetaWpmlTranslationHash,wps_MetaWpmlLanguage,wps_MetaWpmlSourceId', '', '', '', '', '', '', '', ''],
        ['schema.log.SysFileRegistry', 'Schema for the file registry.', 'stable', 'headers', 'source_file_id,source_file_name,last_processed_timestamp', '', '', '', '', '', '', '', ''],
        ['schema.log.SysJobQueue', 'Schema for the job queue.', 'stable', 'headers', 'job_id,job_type,status,archive_file_id,created_timestamp,processed_timestamp,error_message', '', '', '', '', '', '', '', ''],
        ['schema.log.SysLog', 'Schema for the main system log sheet.', 'stable', 'headers', 'timestamp,level,service,function,message,details', '', '', '', '', '', '', '', ''],
        ['schema.data.SysTasks', 'Schema for the master task list.', 'stable', 'headers', 'st_TaskId,st_TaskTypeId,st_Topic,st_Title,st_Status,st_Priority,st_AssignedTo,st_LinkedEntityId,st_CreatedDate,st_DueDate,st_DoneDate,st_Notes', '', '', '', '', '', '', '', ''],

        // Mappings
        ['_section.04_Mappings', 'Header and value mappings for data transformation.', '', '', '', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '0', 'cpm_CmxId', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '1', 'cpm_SKU', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '2', 'cpm_NameHe', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '3', 'cpm_Division', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '4', 'cpm_Group', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '5', 'cpm_Vendor', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '6', 'cpm_Brand', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '7', 'cpm_Color', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '8', 'cpm_Size', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '9', 'cpm_Dryness', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '10', 'cpm_Vintage', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '11', 'cpm_IsNew', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '12', 'cpm_IsArchived', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '13', 'cpm_IsActive', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '14', 'cpm_Price', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '15', 'cpm_Stock', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '16', 'cpm_IsWeb', '', '', '', '', '', '', '', ''],
        ['map.comax.product_columns', 'Maps column index to field name for the raw Comax Product CSV.', 'stable', '17', 'cpm_Exclude', '', '', '', '', '', '', '', ''],
        ['map.web.product_columns', 'Maps WooCommerce CSV headers to internal field names for staging.', 'stable', 'ID', 'wps_ID', '', '', '', '', '', '', '', ''],
        ['map.web.product_columns', 'Maps WooCommerce CSV headers to internal field names for staging.', 'stable', 'SKU', 'wps_SKU', '', '', '', '', '', '', '', ''],
        ['map.web.product_columns', 'Maps WooCommerce CSV headers to internal field names for staging.', 'stable', 'Name', 'wps_Name', '', '', '', '', '', '', '', ''],
        ['map.web.product_columns', 'Maps WooCommerce CSV headers to internal field names for staging.', 'stable', 'Published', 'wps_Published', '', '', '', '', '', '', '', ''],
        ['map.web.product_columns', 'Maps WooCommerce CSV headers to internal field names for staging.', 'stable', 'Stock', 'wps_Stock', '', '', '', '', '', '', '', ''],
        ['map.web.product_columns', 'Maps WooCommerce CSV headers to internal field names for staging.', 'stable', 'Regular Price', 'wps_RegularPrice', '', '', '', '', '', '', '', ''],

        // Validation
        ['_section.05_Validation', 'Rules for the data validation engine.', '', '', '', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'test_type', 'INTERNAL_AUDIT', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'source_sheet', 'CmxProdS', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'condition', 'cps_Stock,<,0', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'on_failure_task_type', 'task.validation.comax_internal_audit', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'on_failure_title', 'Negative Stock: ${cps_NameHe}', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'on_failure_notes', 'SKU ${cps_SKU} (${cps_NameHe}) has a negative stock value of ${cps_Stock} in the latest Comax import.', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'test_type', 'FIELD_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'sheet_A', 'CmxProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'sheet_B', 'CmxProdS', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'key_A', 'cpm_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'key_B', 'cps_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'compare_fields', 'cpm_Vintage,cps_Vintage', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'on_failure_task_type', 'task.validation.field_mismatch', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'on_failure_title', 'Comax Vintage Mismatch: ${cpm_NameHe}', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'on_failure_notes', 'SKU ${cpm_SKU} has a different vintage in master (${cpm_Vintage}) versus staging (${cps_Vintage}).', '', '', '', '', '', '', '', ''],

        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'test_type', 'EXISTENCE_CHECK', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'source_sheet', 'WebProdS_EN', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'source_key', 'wps_ID', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'target_sheet', 'WebProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'target_key', 'wpm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'invert_result', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'on_failure_task_type', 'task.validation.web_master_discrepancy', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'on_failure_title', 'New Web Product: ${wps_Name}', '', '', '', '', '', '', '', ''],
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'on_failure_notes', 'Product SKU ${wps_SKU} exists in the web import but not in the Web Master sheet.', '', '', '', '', '', '', '', ''],

        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'test_type', 'FIELD_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'sheet_A', 'WebProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'sheet_B', 'WebProdS_EN', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'key_A', 'wpm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'key_B', 'wps_ID', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'compare_fields', 'wpm_SKU,wps_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'on_failure_task_type', 'task.validation.web_master_discrepancy', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'on_failure_title', 'Web SKU Mismatch: ${wps_Name}', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'on_failure_notes', "Product '${wps_Name}' (ID: ${wps_ID}) has a SKU mismatch. Master SKU: '${wpm_SKU}', Staging SKU: '${wps_SKU}'.", '', '', '', '', '', '', '', ''],

        // Other
        ['_section.99_Other', 'Uncategorized settings.', '', '', '', '', '', '', '', '', '', '', ''],
        ['system.folder.archive', 'The Google Drive Folder ID for archiving processed files.', 'stable', 'id', '15klv4UL_7KCKkMsneCwx4B56bH2tL7Zd', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Canonical names for all system-managed sheets.', 'stable', 'SysLog', 'SysLog', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Canonical names for all system-managed sheets.', 'stable', 'SysJobQueue', 'SysJobQueue', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Canonical names for all system-managed sheets.', 'stable', 'SysFileRegistry', 'SysFileRegistry', '', '', '', '', '', '', '', ''],
        ['system.spreadsheet.logs', 'The Google Sheet ID for the JLMops_Logs spreadsheet.', 'stable', 'id', '1G2vDKRaYMDdHoHiYSUaSKWgOKQgViBLjxalHIi57lpE', '', '', '', '', '', '', '', ''],
        ['task.validation.sku_not_in_comax', 'Task definition for when a SKU from a web import does not exist in the Comax master data.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.sku_not_in_comax', 'Task definition for when a SKU from a web import does not exist in the Comax master data.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
        ['task.validation.sku_not_in_comax', 'Task definition for when a SKU from a web import does not exist in the Comax master data.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],
        ['task.validation.translation_missing', 'Task definition for when a product is missing its counterpart in the other language.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.translation_missing', 'Task definition for when a product is missing its counterpart in the other language.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
        ['task.validation.translation_missing', 'Task definition for when a product is missing its counterpart in the other language.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],

        ['task.validation.comax_internal_audit', 'Task for internal data consistency issues in Comax staging.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.comax_internal_audit', 'Task for internal data consistency issues in Comax staging.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
        ['task.validation.comax_internal_audit', 'Task for internal data consistency issues in Comax staging.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],
        ['task.validation.field_mismatch', 'Task for when a field in a staging sheet does not match the master sheet.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.field_mismatch', 'Task for when a field in a staging sheet does not match the master sheet.', 'stable', 'default_priority', 'Normal', '', '', '', '', '', '', '', ''],
        ['task.validation.field_mismatch', 'Task for when a field in a staging sheet does not match the master sheet.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],

        ['task.validation.web_master_discrepancy', 'Task for when a web product exists in staging but not in the master sheet.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.web_master_discrepancy', 'Task for when a web product exists in staging but not in the master sheet.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
        ['task.validation.web_master_discrepancy', 'Task for when a web product exists in staging but not in the master sheet.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', '']
    ];
}
