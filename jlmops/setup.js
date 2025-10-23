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

        ConfigService.forceReload(); // Invalidate the cache

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

        ['import.drive.web_translations_he', 'Configuration for the Hebrew Web Translations CSV import from Google Drive.', 'stable', 'source_folder_id', '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j', '', '', '', '', '', '', '', ''],
        ['import.drive.web_translations_he', 'Configuration for the Hebrew Web Translations CSV import from Google Drive.', 'stable', 'file_pattern', 'wehe.csv', '', '', '', '', '', '', '', ''],
        ['import.drive.web_translations_he', 'Configuration for the Hebrew Web Translations CSV import from Google Drive.', 'stable', 'processing_service', 'ProductService', '', '', '', '', '', '', '', ''],
        ['import.drive.web_translations_he', 'Configuration for the Hebrew Web Translations CSV import from Google Drive.', 'stable', 'file_encoding', 'UTF-8', '', '', '', '', '', '', '', ''],

        // Schemas
        ['_section.03_Schemas', 'Schema definitions for staging and master sheets.', '', '', '', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdM', 'Schema for Comax Products Master sheet.', 'stable', 'headers', 'cpm_CmxId,cpm_SKU,cpm_NameHe,cpm_Division,cpm_Group,cpm_Vendor,cpm_Brand,cpm_Color,cpm_Size,cpm_Dryness,cpm_Vintage,cpm_IsNew,cpm_IsArchived,cpm_IsActive,cpm_Price,cpm_Stock,cpm_IsWeb,cpm_Exclude', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdS', 'Schema for Comax Products Staging sheet.', 'stable', 'headers', 'cps_CmxId,cps_SKU,cps_NameHe,cps_Division,cps_Group,cps_Vendor,cps_Brand,cps_Color,cps_Size,cps_Dryness,cps_Vintage,cps_IsNew,cps_IsArchived,cps_IsActive,cps_Price,cps_Stock,cps_IsWeb,cps_Exclude', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdM', 'Schema for Web Products Master sheet.', 'stable', 'headers', 'wpm_WebIdEn,wpm_SKU,wpm_NameEn,wpm_PublishStatusEn,wpm_Stock,wpm_Price', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdS_EN', 'Schema for Web Products Staging sheet (EN).', 'stable', 'headers', 'wps_ID,wps_Type,wps_SKU,wps_Name,wps_Published,wps_IsFeatured,wps_VisibilityInCatalog,wps_ShortDescription,wps_Description,wps_DateSalePriceStarts,wps_DateSalePriceEnds,wps_TaxStatus,wps_TaxClass,wps_InStock,wps_Stock,wps_BackordersAllowed,wps_SoldIndividually,wps_Weight,wps_Length,wps_Width,wps_Height,wps_AllowCustomerReviews,wps_PurchaseNote,wps_SalePrice,wps_RegularPrice,wps_Categories,wps_Tags,wps_ShippingClass,wps_Images,wps_DownloadLimit,wps_DownloadExpiry,wps_Parent,wps_GroupedProducts,wps_Upsells,wps_CrossSells,wps_ExternalURL,wps_ButtonText,wps_Position,wps_Attribute1Name,wps_Attribute1Value,wps_Attribute1Visible,wps_Attribute1Global,wps_Attribute2Name,wps_Attribute2Value,wps_Attribute2Visible,wps_Attribute2Global,wps_MetaWpmlTranslationHash,wps_MetaWpmlLanguage,wps_MetaWpmlSourceId', '', '', '', '', '', '', '', ''],
        ['schema.data.WebXltM', 'Schema for Web Translate Master sheet.', 'stable', 'headers', 'wxl_WebIdHe,wxl_NameHe,wxl_WebIdEn,wxl_SKU', '', '', '', '', '', '', '', ''],
        ['schema.data.WebXltS', 'Schema for Web Translate Staging sheet.', 'stable', 'headers', 'wxs_WebIdHe,wxs_NameHe,wxs_WebIdEn,wxs_SKU', '', '', '', '', '', '', '', ''],
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

        ['map.web.translation_columns', 'Maps wehe.csv headers to internal field names for staging.', 'stable', 'id', 'wxs_WebIdHe', '', '', '', '', '', '', '', ''],
        ['map.web.translation_columns', 'Maps wehe.csv headers to internal field names for staging.', 'stable', 'post_title', 'wxs_NameHe', '', '', '', '', '', '', '', ''],
        ['map.web.translation_columns', 'Maps wehe.csv headers to internal field names for staging.', 'stable', 'wpml:original_product_id', 'wxs_WebIdEn', '', '', '', '', '', '', '', ''],
        ['map.web.translation_columns', 'Maps wehe.csv headers to internal field names for staging.', 'stable', 'sku', 'wxs_SKU', '', '', '', '', '', '', '', ''],

        // Validation
        ['_section.05_Validation', 'Rules for the data validation engine.', '', '', '', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'validation_suite', 'comax_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'test_type', 'INTERNAL_AUDIT', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'source_sheet', 'CmxProdS', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'condition', 'cps_Stock,<,0', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'on_failure_task_type', 'task.validation.comax_internal_audit', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'on_failure_title', 'Negative Stock: ${cps_NameHe}', '', '', '', '', '', '', '', ''],
        ['validation.rule.D2_ComaxS_NegativeStock', '[D2] Negative inventory in Comax Staging.', 'stable', 'on_failure_notes', 'SKU ${cps_SKU} (${cps_NameHe}) has a negative stock value of ${cps_Stock} in the latest Comax import.', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.C6_Comax_VintageMismatch', '[C6] Vintage mismatch between Comax Master and Staging.', 'stable', 'validation_suite', 'comax_staging', '', '', '', '', '', '', '', ''],
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
        ['validation.rule.A1_WebS_NotIn_WebM', '[A1] Web Staging product not in Web Master.', 'stable', 'validation_suite', 'web_staging', '', '', '', '', '', '', '', ''],
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
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'validation_suite', 'web_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'test_type', 'FIELD_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'sheet_A', 'WebProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'sheet_B', 'WebProdS_EN', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'key_A', 'wpm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'key_B', 'wps_ID', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'compare_fields', 'wpm_SKU,wps_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'on_failure_task_type', 'task.validation.web_master_discrepancy', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'on_failure_title', 'Web SKU Mismatch: ${wps_Name}', '', '', '', '', '', '', '', ''],
        ['validation.rule.A3_Web_SKUMismatch', '[A3] SKU mismatch between Web Master and Staging.', 'stable', 'on_failure_notes', "Product '${wps_Name}' (ID: ${wps_ID}) has a SKU mismatch. Master SKU: '${wpm_SKU}', Staging SKU: '${wps_SKU}'.", '', '', '', '', '', '', '', ''],

        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'validation_suite', 'web_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'test_type', 'FIELD_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'sheet_A', 'WebDetM', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'sheet_B', 'WebProdS_EN', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'key_A', 'wdm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'key_B', 'wps_ID', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'compare_fields', 'wdm_NameEn,wps_Name', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'on_failure_task_type', 'task.validation.name_mismatch', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'on_failure_title', 'Web Name Mismatch: ${wps_Name}', '', '', '', '', '', '', '', ''],
        ['validation.rule.A4_Web_NameMismatch', '[A4] Name mismatch between Web Master and Staging.', 'stable', 'on_failure_notes', "Product '${wps_Name}' (ID: ${wps_ID}) has a name mismatch. Master: '${wdm_NameEn}', Staging: '${wps_Name}'.", '', '', '', '', '', '', '', ''],

        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'validation_suite', 'master_master', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'test_type', 'EXISTENCE_CHECK', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'source_sheet', 'WebProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'source_key', 'wpm_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'target_sheet', 'CmxProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'target_key', 'cpm_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'invert_result', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'on_failure_task_type', 'task.validation.sku_not_in_comax', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'on_failure_title', 'SKU ${wpm_SKU} not in Comax', '', '', '', '', '', '', '', ''],
        ['validation.rule.B1_WebM_SKU_NotIn_ComaxM', '[B1] Web Master SKU not in Comax Master.', 'stable', 'on_failure_notes', "Web product '${wpm_NameEn}' (SKU: ${wpm_SKU}) does not have a corresponding entry in the Comax master product list.", '', '', '', '', '', '', '', ''],

        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'validation_suite', 'master_master', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'test_type', 'EXISTENCE_CHECK', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'source_sheet', 'WebProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'source_key', 'wpm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'target_sheet', 'WebXltM', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'target_key', 'wxl_WebIdEn', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'invert_result', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'on_failure_task_type', 'task.validation.translation_missing', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'on_failure_title', 'Translation missing for ${wpm_NameEn}', '', '', '', '', '', '', '', ''],
        ['validation.rule.B2_WebM_Translation_Missing', '[B2] Web Master product missing translation.', 'stable', 'on_failure_notes', "Web product '${wpm_NameEn}' (ID: ${wpm_WebIdEn}) does not have a corresponding entry in the translation mapping sheet (WebXltM).", '', '', '', '', '', '', '', ''],

        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'validation_suite', 'web_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'test_type', 'EXISTENCE_CHECK', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'source_sheet', 'WebProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'source_key', 'wpm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'target_sheet', 'WebProdS_EN', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'target_key', 'wps_ID', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'invert_result', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'on_failure_task_type', 'task.validation.web_master_discrepancy', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'on_failure_title', 'Web Product Missing from Import: ${wpm_NameEn}', '', '', '', '', '', '', '', ''],
        ['validation.rule.A2_WebM_NotIn_WebS', '[A2] Web Master product not in Web Staging.', 'stable', 'on_failure_notes', 'Product SKU ${wpm_SKU} (ID: ${wpm_WebIdEn}) exists in the Web Master sheet but was not found in the latest web import.', '', '', '', '', '', '', '', ''],

        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'enabled', 'FALSE', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'validation_suite', 'comax_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'test_type', 'EXISTENCE_CHECK', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'source_sheet', 'CmxProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'source_key', 'cpm_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'source_filter', 'cpm_IsActive,1', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'target_sheet', 'CmxProdS', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'target_key', 'cps_SKU', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'invert_result', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'on_failure_task_type', 'task.validation.comax_master_discrepancy', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'on_failure_title', 'Active Comax Product Missing from Import: ${cpm_NameHe}', '', '', '', '', '', '', '', ''],
        ['validation.rule.C1_CmxM_NotIn_CmxS', '[C1] Active Comax Master product not in Comax Staging.', 'stable', 'on_failure_notes', 'Active product SKU ${cpm_SKU} from Comax Master is missing from the latest Comax import.', '', '', '', '', '', '', '', ''],

        // New Row Count Validation Rules
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'validation_suite', 'comax_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'test_type', 'ROW_COUNT_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'source_sheet', 'CmxProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'target_sheet', 'CmxProdS', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'on_failure_quarantine', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'on_failure_task_type', 'task.validation.row_count_decrease', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'on_failure_title', 'Comax Import Row Count Decreased', '', '', '', '', '', '', '', ''],
        ['validation.rule.C_ComaxS_RowCountDecrease', '[C] Comax Staging row count decreased compared to Master.', 'stable', 'on_failure_notes', 'The number of rows in CmxProdS (${targetRowCount}) is less than the number of rows in CmxProdM (${sourceRowCount}). This may indicate a partial or damaged Comax import file.', '', '', '', '', '', '', '', ''],

        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'validation_suite', 'web_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'test_type', 'ROW_COUNT_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'source_sheet', 'WebProdM', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'target_sheet', 'WebProdS_EN', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'on_failure_quarantine', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'on_failure_task_type', 'task.validation.row_count_decrease', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'on_failure_title', 'Web Products Import Row Count Decreased', '', '', '', '', '', '', '', ''],
        ['validation.rule.W_WebS_RowCountDecrease', '[W] Web Products Staging row count decreased compared to Master.', 'stable', 'on_failure_notes', 'The number of rows in WebProdS_EN (${targetRowCount}) is less than the number of rows in WebProdM (${sourceRowCount}). This may indicate a partial or damaged Web Products import file.', '', '', '', '', '', '', '', ''],

        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'validation_suite', 'web_xlt_staging', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'test_type', 'ROW_COUNT_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'source_sheet', 'WebXltM', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'target_sheet', 'WebXltS', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'on_failure_quarantine', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'on_failure_task_type', 'task.validation.row_count_decrease', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'on_failure_title', 'Web Translations Import Row Count Decreased', '', '', '', '', '', '', '', ''],
        ['validation.rule.X_WebXltS_RowCountDecrease', '[X] Web Translations Staging row count decreased compared to Master.', 'stable', 'on_failure_notes', 'The number of rows in WebXltS (${targetRowCount}) is less than the number of rows in WebXltM (${sourceRowCount}). This may indicate a partial or damaged Web Translations import file.', '', '', '', '', '', '', '', ''],

        // WebXlt Validation Rules
        ['validation.rule.WebXlt_ColumnMismatch', '[WebXlt] Column mismatch between WebXltM and WebXltS.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_ColumnMismatch', '[WebXlt] Column mismatch between WebXltM and WebXltS.', 'stable', 'test_type', 'SCHEMA_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_ColumnMismatch', '[WebXlt] Column mismatch between WebXltM and WebXltS.', 'stable', 'source_schema', 'schema.data.WebXltM', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_ColumnMismatch', '[WebXlt] Column mismatch between WebXltM and WebXltS.', 'stable', 'target_schema', 'schema.data.WebXltS', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_ColumnMismatch', '[WebXlt] Column mismatch between WebXltM and WebXltS.', 'stable', 'on_failure_task_type', 'task.validation.webxlt_data_integrity', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_ColumnMismatch', '[WebXlt] Column mismatch between WebXltM and WebXltS.', 'stable', 'on_failure_title', 'WebXlt Schema Mismatch: Columns', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_ColumnMismatch', '[WebXlt] Column mismatch between WebXltM and WebXltS.', 'stable', 'on_failure_notes', 'The columns in WebXltS do not match the expected schema from WebXltM.', '', '', '', '', '', '', '', ''],

        ['validation.rule.WebXlt_RowCountMismatch', '[WebXlt] Row count mismatch between WebXltS and WebXltM.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_RowCountMismatch', '[WebXlt] Row count mismatch between WebXltS and WebXltM.', 'stable', 'test_type', 'ROW_COUNT_COMPARISON', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_RowCountMismatch', '[WebXlt] Row count mismatch between WebXltS and WebXltM.', 'stable', 'source_sheet', 'WebXltM', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_RowCountMismatch', '[WebXlt] Row count mismatch between WebXltS and WebXltM.', 'stable', 'target_sheet', 'WebXltS', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_RowCountMismatch', '[WebXlt] Row count mismatch between WebXltS and WebXltM.', 'stable', 'on_failure_task_type', 'task.validation.webxlt_data_integrity', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_RowCountMismatch', '[WebXlt] Row count mismatch between WebXltS and WebXltM.', 'stable', 'on_failure_title', 'WebXlt Row Count Mismatch', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_RowCountMismatch', '[WebXlt] Row count mismatch between WebXltS and WebXltM.', 'stable', 'on_failure_notes', 'The number of rows in WebXltS is less than the number of rows in WebXltM.', '', '', '', '', '', '', '', ''],

        ['validation.rule.WebXlt_EmptyCells', '[WebXlt] Empty cells found in populated columns of WebXltS.', 'stable', 'enabled', 'TRUE', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_EmptyCells', '[WebXlt] Empty cells found in populated columns of WebXltS.', 'stable', 'test_type', 'DATA_COMPLETENESS', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_EmptyCells', '[WebXlt] Empty cells found in populated columns of WebXltS.', 'stable', 'source_sheet', 'WebXltS', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_EmptyCells', '[WebXlt] Empty cells found in populated columns of WebXltS.', 'stable', 'on_failure_task_type', 'task.validation.webxlt_data_integrity', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_EmptyCells', '[WebXlt] Empty cells found in populated columns of WebXltS.', 'stable', 'on_failure_title', 'WebXlt Data Incompleteness', '', '', '', '', '', '', '', ''],
        ['validation.rule.WebXlt_EmptyCells', '[WebXlt] Empty cells found in populated columns of WebXltS.', 'stable', 'on_failure_notes', 'Empty cells were found in populated columns of the WebXltS sheet.', '', '', '', '', '', '', '', ''],

        // Other
        ['_section.99_Other', 'Uncategorized settings.', '', '', '', '', '', '', '', '', '', '', ''],
        ['system.webxlt.validation_status', 'Status of the latest WebXlt validation (OK, QUARANTINED).', 'stable', 'status', 'OK', '', '', '', '', '', '', '', ''],
        ['task.validation.webxlt_data_integrity', 'Task definition for WebXlt data integrity issues.', 'stable', 'topic', 'WebXlt', '', '', '', '', '', '', '', ''],
        ['task.validation.webxlt_data_integrity', 'Task definition for WebXlt data integrity issues.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
        ['task.validation.webxlt_data_integrity', 'Task definition for WebXlt data integrity issues.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],
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
        ['task.validation.web_master_discrepancy', 'Task for when a web product exists in staging but not in the master sheet.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],

        ['task.validation.comax_master_discrepancy', 'Task for when an active Comax product is missing from staging.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.comax_master_discrepancy', 'Task for when an active Comax product is missing from staging.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
        ['task.validation.comax_master_discrepancy', 'Task for when an active Comax product is missing from staging.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],

        ['task.validation.row_count_decrease', 'Task for when a row count decreases in a staging sheet compared to its master.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.row_count_decrease', 'Task for when a row count decreases in a staging sheet compared to its master.', 'stable', 'default_priority', 'High', '', '', '', '', '', '', '', ''],
        ['task.validation.row_count_decrease', 'Task for when a row count decreases in a staging sheet compared to its master.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', ''],

        ['task.validation.name_mismatch', 'Task for when a product name in a staging sheet does not match the master sheet.', 'stable', 'topic', 'Products', '', '', '', '', '', '', '', ''],
        ['task.validation.name_mismatch', 'Task for when a product name in a staging sheet does not match the master sheet.', 'stable', 'default_priority', 'Normal', '', '', '', '', '', '', '', ''],
        ['task.validation.name_mismatch', 'Task for when a product name in a staging sheet does not match the master sheet.', 'stable', 'initial_status', 'New', '', '', '', '', '', '', '', '']
    ];
}

function createWebXltHeaders() {
    const functionName = 'createWebXltHeaders';
    try {
        console.log(`Running ${functionName}...`);

        const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
        const sheetNames = ['WebXltS', 'WebXltM'];
        
        // This assumes that rebuildSysConfigFromSource has been run and the config is available.
        const allConfig = ConfigService.getAllConfig();

        sheetNames.forEach(sheetName => {
            let sheet = spreadsheet.getSheetByName(sheetName);
            if (!sheet) {
                sheet = spreadsheet.insertSheet(sheetName);
                console.log(`Sheet '${sheetName}' was not found and has been created.`);
            } else {
                console.log(`Sheet '${sheetName}' found.`);
            }

            const schema = allConfig[`schema.data.${sheetName}`];
            if (!schema || !schema.headers) {
                throw new Error(`Schema for sheet '${sheetName}' not found in configuration. Please run rebuildSysConfigFromSource first.`);
            }
            const headers = schema.headers.split(',');

            sheet.clear();
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
            console.log(`Headers written to '${sheetName}'.`);
        });

        console.log(`${functionName} completed successfully.`);

    } catch (error) {
        console.error(`A critical error occurred in ${functionName}: ${error.message}`);
        SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
    }
}
