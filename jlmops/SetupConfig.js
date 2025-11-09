/**
 * @file SetupConfig.js
 * @description Contains functions for managing the master SysConfig sheet.
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
        ['system.spreadsheet.data', 'ID of the JLMops_Data spreadsheet', 'stable', 'id', '1a4aAreab8IdSZjgpNDf0Wj8Rl2UOTwlD525d4Zpc874', '', '', '', '', '', '', '', ''],
        ['system.spreadsheet.logs', 'ID of the JLMops_Logs spreadsheet', 'stable', 'id', '1G2vDKRaYMDdHoHiYSUaSKWgOKQgViBLjxalHIi57lpE', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Names of the sheets in the spreadsheets', 'stable', 'WebOrdM', 'WebOrdM', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Names of the sheets in the spreadsheets', 'stable', 'WebOrdItemsM', 'WebOrdItemsM', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Names of the sheets in the spreadsheets', 'stable', 'SysOrdLog', 'SysOrdLog', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Names of the sheets in the spreadsheets', 'stable', 'SysPackingCache', 'SysPackingCache', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Names of the sheets in the spreadsheets', 'stable', 'SysJobQueue', 'SysJobQueue', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Names of the sheets in the spreadsheets', 'stable', 'SysLog', 'SysLog', '', '', '', '', '', '', '', ''],
        ['system.sheet_names', 'Names of the sheets in the spreadsheets', 'stable', 'WebOrdS', 'WebOrdS', '', '', '', '', '', '', '', ''],

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

        ['import.drive.web_orders', 'Configuration for the Web Orders CSV import from Google Drive.', 'stable', 'source_folder_id', '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j', '', '', '', '', '', '', '', ''],
        ['import.drive.web_orders', 'Configuration for the Web Orders CSV import from Google Drive.', 'stable', 'file_pattern', 'WebOrders.csv', '', '', '', '', '', '', '', ''],
        ['import.drive.web_orders', 'Configuration for the Web Orders CSV import from Google Drive.', 'stable', 'processing_service', 'OrderService', '', '', '', '', '', '', '', ''],
        ['import.drive.web_orders', 'Configuration for the Web Orders CSV import from Google Drive.', 'stable', 'file_encoding', 'UTF-8', '', '', '', '', '', '', '', ''],

        // Schemas
        ['_section.03_Schemas', 'Schema definitions for staging and master sheets.', '', '', '', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdM', 'Schema for Comax Products Master sheet.', 'stable', 'headers', 'cpm_CmxId,cpm_SKU,cpm_NameHe,cpm_Division,cpm_Group,cpm_Vendor,cpm_Brand,cpm_Color,cpm_Size,cpm_Dryness,cpm_Vintage,cpm_IsNew,cpm_IsArchived,cpm_IsActive,cpm_Price,cpm_Stock,cpm_IsWeb,cpm_Exclude', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdM', 'Schema for Comax Products Master sheet.', 'stable', 'key_column', 'cpm_CmxId', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdS', 'Schema for Comax Products Staging sheet.', 'stable', 'headers', 'cps_CmxId,cps_SKU,cps_NameHe,cps_Division,cps_Group,cps_Vendor,cps_Brand,cps_Color,cps_Size,cps_Dryness,cps_Vintage,cps_IsNew,cps_IsArchived,cps_IsActive,cps_Price,cps_Stock,cps_IsWeb,cps_Exclude', '', '', '', '', '', '', '', ''],
        ['schema.data.CmxProdS', 'Schema for Comax Products Staging sheet.', 'stable', 'key_column', 'cps_CmxId', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdM', 'Schema for Web Products Master sheet.', 'stable', 'headers', 'wpm_WebIdEn,wpm_SKU,wpm_NameEn,wpm_PublishStatusEn,wpm_Stock,wpm_Price', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdM', 'Schema for Web Products Master sheet.', 'stable', 'key_column', 'wpm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['schema.data.WebDetM', 'Schema for Web Details Master sheet.', 'stable', 'headers', 'wdm_WebIdEn,wdm_SKU,wdm_NameEn,wdm_NameHe,wdm_ShortDescrEn,wdm_ShortDescrHe,wdm_DescriptionEn,wdm_DescriptionHe,wdm_Region,wdm_Intensity,wdm_Complexity,wdm_Acidity,wdm_Decant,wdm_PairHarMild,wdm_PairHarRich,wdm_PairHarIntense,wdm_PairHarSweet,wdm_PairConMild,wdm_PairConRich,wdm_PairConIntense,wdm_PairConSweet,wdm_GrapeG1,wdm_GrapeG2,wdm_GrapeG3,wdm_GrapeG4,wdm_GrapeG5,wdm_KashrutK1,wdm_KashrutK2,wdm_KashrutK3,wdm_KashrutK4,wdm_KashrutK5,wdm_HeterMechira,wdm_IsMevushal,wdm_IsSoldIndividually', '', '', '', '', '', '', '', ''],
        ['schema.data.WebDetM', 'Schema for Web Details Master sheet.', 'stable', 'key_column', 'wdm_WebIdEn', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdS_EN', 'Schema for Web Products Staging sheet (EN).', 'stable', 'headers', 'wps_ID,wps_Type,wps_SKU,wps_Name,wps_Published,wps_IsFeatured,wps_VisibilityInCatalog,wps_ShortDescription,wps_Description,wps_DateSalePriceStarts,wps_DateSalePriceEnds,wps_TaxStatus,wps_TaxClass,wps_InStock,wps_Stock,wps_BackordersAllowed,wps_SoldIndividually,wps_Weight,wps_Length,wps_Width,wps_Height,wps_AllowCustomerReviews,wps_PurchaseNote,wps_SalePrice,wps_RegularPrice,wps_Categories,wps_Tags,wps_ShippingClass,wps_Images,wps_DownloadLimit,wps_DownloadExpiry,wps_Parent,wps_GroupedProducts,wps_Upsells,wps_CrossSells,wps_ExternalURL,wps_ButtonText,wps_Position,wps_Attribute1Name,wps_Attribute1Value,wps_Attribute1Visible,wps_Attribute1Global,wps_Attribute2Name,wps_Attribute2Value,wps_Attribute2Visible,wps_Attribute2Global,wps_MetaWpmlTranslationHash,wps_MetaWpmlLanguage,wps_MetaWpmlSourceId', '', '', '', '', '', '', '', ''],
        ['schema.data.WebProdS_EN', 'Schema for Web Products Staging sheet (EN).', 'stable', 'key_column', 'wps_ID', '', '', '', '', '', '', '', ''],
        ['schema.data.WebXltM', 'Schema for Web Translate Master sheet.', 'stable', 'headers', 'wxl_WebIdHe,wxl_NameHe,wxl_WebIdEn,wxl_SKU', '', '', '', '', '', '', '', ''],
        ['schema.data.WebXltM', 'Schema for Web Translate Master sheet.', 'stable', 'key_column', 'wxl_WebIdHe', '', '', '', '', '', '', '', ''],
        ['schema.data.WebXltS', 'Schema for Web Translate Staging sheet.', 'stable', 'headers', 'wxs_WebIdHe,wxs_NameHe,wxs_WebIdEn,wxs_SKU', '', '', '', '', '', '', '', ''],
        ['schema.data.WebXltS', 'Schema for Web Translate Staging sheet.', 'stable', 'key_column', 'wxs_WebIdHe', '', '', '', '', '', '', '', ''],
        ['schema.log.SysFileRegistry', 'Schema for the file registry.', 'stable', 'headers', 'source_file_id,source_file_name,last_processed_timestamp', '', '', '', '', '', '', '', ''],
        ['schema.log.SysJobQueue', 'Schema for the job queue.', 'stable', 'headers', 'job_id,job_type,status,archive_file_id,created_timestamp,processed_timestamp,error_message', '', '', '', '', '', '', '', ''],
        ['schema.log.SysLog', 'Schema for the main system log sheet.', 'stable', 'headers', 'timestamp,level,service,function,message,details', '', '', '', '', '', '', '', ''],
        ['schema.data.SysTasks', 'Schema for the master task list.', 'stable', 'headers', 'st_TaskId,st_TaskTypeId,st_Topic,st_Title,st_Status,st_Priority,st_AssignedTo,st_LinkedEntityId,st_CreatedDate,st_DueDate,st_DoneDate,st_Notes', '', '', '', '', '', '', '', ''],
        ['schema.data.WebOrdS', 'Schema for Web Order Staging sheet.', 'stable', 'headers', 'wos_OrderId,wos_OrderNumber,wos_OrderDate,wos_PaidDate,wos_Status,wos_ShippingTotal,wos_ShippingTaxTotal,wos_FeeTotal,wos_FeeTaxTotal,wos_TaxTotal,wos_CartDiscount,wos_OrderDiscount,wos_DiscountTotal,wos_OrderTotal,wos_OrderSubtotal,wos_OrderCurrency,wos_PaymentMethod,wos_PaymentMethodTitle,wos_TransactionId,wos_CustomerIpAddress,wos_CustomerUserAgent,wos_ShippingMethod,wos_CustomerId,wos_CustomerUser,wos_CustomerEmail,wos_BillingFirstName,wos_BillingLastName,wos_BillingCompany,wos_BillingEmail,wos_BillingPhone,wos_BillingAddress1,wos_BillingAddress2,wos_BillingPostcode,wos_BillingCity,wos_BillingState,wos_BillingCountry,wos_ShippingFirstName,wos_ShippingLastName,wos_ShippingCompany,wos_ShippingPhone,wos_ShippingAddress1,wos_ShippingAddress2,wos_ShippingPostcode,wos_ShippingCity,wos_ShippingState,wos_ShippingCountry,wos_CustomerNote,wos_WtImportKey,wos_ShippingItems,wos_FeeItems,wos_TaxItems,wos_CouponItems,wos_RefundItems,wos_OrderNotes,wos_DownloadPermissions,wos_MetaWpmlLanguage,wos_LineItem1,wos_LineItem2,wos_LineItem3,wos_LineItem4,wos_LineItem5,wos_LineItem6,wos_LineItem7,wos_LineItem8,wos_LineItem9,wos_LineItem10,wos_LineItem11,wos_LineItem12,wos_LineItem13,wos_LineItem14,wos_LineItem15,wos_LineItem16,wos_LineItem17,wos_LineItem18,wos_LineItem19,wos_LineItem20,wos_LineItem21,wos_LineItem22,wos_LineItem23,wos_LineItem24,wos_Product_Item_1_Name,wos_Product_Item_1_id,wos_Product_Item_1_SKU,wos_Product_Item_1_Quantity,wos_Product_Item_1_Total,wos_Product_Item_1_Subtotal,wos_Product_Item_2_Name,wos_Product_Item_2_id,wos_Product_Item_2_SKU,wos_Product_Item_2_Quantity,wos_Product_Item_2_Total,wos_Product_Item_2_Subtotal,wos_Product_Item_3_Name,wos_Product_Item_3_id,wos_Product_Item_3_SKU,wos_Product_Item_3_Quantity,wos_Product_Item_3_Total,wos_Product_Item_3_Subtotal,wos_Product_Item_4_Name,wos_Product_Item_4_id,wos_Product_Item_4_SKU,wos_Product_Item_4_Quantity,wos_Product_Item_4_Total,wos_Product_Item_4_Subtotal,wos_Product_Item_5_Name,wos_Product_Item_5_id,wos_Product_Item_5_SKU,wos_Product_Item_5_Quantity,wos_Product_Item_5_Total,wos_Product_Item_5_Subtotal,wos_Product_Item_6_Name,wos_Product_Item_6_id,wos_Product_Item_6_SKU,wos_Product_Item_6_Quantity,wos_Product_Item_6_Total,wos_Product_Item_6_Subtotal,wos_Product_Item_7_Name,wos_Product_Item_7_id,wos_Product_Item_7_SKU,wos_Product_Item_7_Quantity,wos_Product_Item_7_Total,wos_Product_Item_7_Subtotal,wos_Product_Item_8_Name,wos_Product_Item_8_id,wos_Product_Item_8_SKU,wos_Product_Item_8_Quantity,wos_Product_Item_8_Total,wos_Product_Item_8_Subtotal,wos_Product_Item_9_Name,wos_Product_Item_9_id,wos_Product_Item_9_SKU,wos_Product_Item_9_Quantity,wos_Product_Item_9_Total,wos_Product_Item_9_Subtotal,wos_Product_Item_10_Name,wos_Product_Item_10_id,wos_Product_Item_10_SKU,wos_Product_Item_10_Quantity,wos_Product_Item_10_Total,wos_Product_Item_10_Subtotal,wos_Product_Item_11_Name,wos_Product_Item_11_id,wos_Product_Item_11_SKU,wos_Product_Item_11_Quantity,wos_Product_Item_11_Total,wos_Product_Item_11_Subtotal,wos_Product_Item_12_Name,wos_Product_Item_12_id,wos_Product_Item_12_SKU,wos_Product_Item_12_Quantity,wos_Product_Item_12_Total,wos_Product_Item_12_Subtotal,wos_Product_Item_13_Name,wos_Product_Item_13_id,wos_Product_Item_13_SKU,wos_Product_Item_13_Quantity,wos_Product_Item_13_Total,wos_Product_Item_13_Subtotal,wos_Product_Item_14_Name,wos_Product_Item_14_id,wos_Product_Item_14_SKU,wos_Product_Item_14_Quantity,wos_Product_Item_14_Total,wos_Product_Item_14_Subtotal,wos_Product_Item_15_Name,wos_Product_Item_15_id,wos_Product_Item_15_SKU,wos_Product_Item_15_Quantity,wos_Product_Item_15_Total,wos_Product_Item_15_Subtotal,wos_Product_Item_16_Name,wos_Product_Item_16_id,wos_Product_Item_16_SKU,wos_Product_Item_16_Quantity,wos_Product_Item_16_Total,wos_Product_Item_16_Subtotal,wos_Product_Item_17_Name,wos_Product_Item_17_id,wos_Product_Item_17_SKU,wos_Product_Item_17_Quantity,wos_Product_Item_17_Total,wos_Product_Item_17_Subtotal,wos_Product_Item_18_Name,wos_Product_Item_18_id,wos_Product_Item_18_SKU,wos_Product_Item_18_Quantity,wos_Product_Item_18_Total,wos_Product_Item_18_Subtotal,wos_Product_Item_19_Name,wos_Product_Item_19_id,wos_Product_Item_19_SKU,wos_Product_Item_19_Quantity,wos_Product_Item_19_Total,wos_Product_Item_19_Subtotal,wos_Product_Item_20_Name,wos_Product_Item_20_id,wos_Product_Item_20_SKU,wos_Product_Item_20_Quantity,wos_Product_Item_20_Total,wos_Product_Item_20_Subtotal,wos_Product_Item_21_Name,wos_Product_Item_21_id,wos_Product_Item_21_SKU,wos_Product_Item_21_Quantity,wos_Product_Item_21_Total,wos_Product_Item_21_Subtotal,wos_Product_Item_22_Name,wos_Product_Item_22_id,wos_Product_Item_22_SKU,wos_Product_Item_22_Quantity,wos_Product_Item_22_Total,wos_Product_Item_22_Subtotal,wos_Product_Item_23_Name,wos_Product_Item_23_id,wos_Product_Item_23_SKU,wos_Product_Item_23_Quantity,wos_Product_Item_23_Total,wos_Product_Item_23_Subtotal,wos_Product_Item_24_Name,wos_Product_Item_24_id,wos_Product_Item_24_SKU,wos_Product_Item_24_Quantity,wos_Product_Item_24_Total,wos_Product_Item_24_Subtotal', '', '', '', '', '', '', '', ''],
        ['schema.data.WebOrdM', 'Schema for Web Orders Master sheet.', 'stable', 'headers', 'wom_OrderId,wom_OrderNumber,wom_OrderDate,wom_Status,wom_CustomerNote,wom_BillingFirstName,wom_BillingLastName,wom_BillingEmail,wom_BillingPhone,wom_ShippingFirstName,wom_ShippingLastName,wom_ShippingAddress1,wom_ShippingAddress2,wom_ShippingCity,wom_ShippingPhone', '', '', '', '', '', '', '', ''],
        ['schema.data.WebOrdItemsM', 'Schema for Web Order Items Master sheet.', 'stable', 'headers', 'woi_OrderItemId,woi_OrderId,woi_WebIdEn,woi_SKU,woi_Name,woi_Quantity,woi_ItemTotal', '', '', '', '', '', '', '', ''],
        ['schema.data.SysInventoryOnHold', 'Schema for System On-Hold Inventory sheet.', 'stable', 'headers', 'sio_SKU,sio_OnHoldQuantity', '', '', '', '', '', '', '', ''],
        ['schema.data.SysOrdLog', 'Schema for System Order Log sheet.', 'stable', 'headers', 'sol_OrderId,sol_OrderDate,sol_OrderStatus,sol_PackingStatus,sol_PackingPrintedTimestamp,sol_ComaxExportStatus,sol_ComaxExportTimestamp', '', '', '', '', '', '', '', ''],
        ['schema.data.SysPackingCache', 'Schema for System Packing Cache sheet.', 'stable', 'headers', 'spc_OrderId,spc_WebIdEn,spc_SKU,spc_Quantity,spc_NameEn,spc_NameHe,spc_Intensity,spc_Complexity,spc_Acidity,spc_Decant,spc_HarmonizeEn,spc_ContrastEn,spc_HarmonizeHe,spc_ContrastHe,spc_GrapeG1Text,spc_GrapeG2Text,spc_GrapeG3Text,spc_GrapeG4Text,spc_GrapeG5Text,spc_KashrutK1Text,spc_KashrutK2Text,spc_KashrutK3Text,spc_KashrutK4Text,spc_KashrutK5Text,spc_HeterMechiraText,spc_IsMevushalText,spc_PrintedFlag,spc_PrintedTimestamp,spc_ReprintCount', '', '', '', '', '', '', '', ''],
        ['schema.data.OrderLogArchive', 'Schema for Order Log Archive sheet.', 'stable', 'headers', 'sol_OrderId,sol_PackingStatus,sol_PackingPrintedTimestamp,sol_ComaxExportStatus,sol_ComaxExportTimestamp', '', '', '', '', '', '', '', ''],
        ['schema.data.WebOrdM_Archive', 'Schema for Web Orders Master Archive sheet.', 'stable', 'headers', 'woma_OrderId,woma_OrderNumber,woma_OrderDate,woma_Status,woma_CustomerNote,woma_BillingFirstName,woma_BillingLastName,woma_BillingEmail,woma_BillingPhone,woma_ShippingFirstName,woma_ShippingLastName,woma_ShippingAddress1,woma_ShippingAddress2,woma_ShippingCity,woma_ShippingPhone', '', '', '', '', '', '', '', ''],
        ['schema.data.WebOrdItemsM_Archive', 'Schema for Web Order Items Master Archive sheet.', 'stable', 'headers', 'woia_OrderItemId,woia_OrderId,woia_WebIdEn,woia_SKU,woia_Name,woia_Quantity,woia_ItemTotal', '', '', '', '', '', '', '', ''],

        // New Schema for DetailsC (inferred from usage)
        ['schema.data.DetailsC', 'Schema for DetailsC sheet (legacy pairing text). Inferred.', 'stable', 'headers', 'dc_SKU,dc_Unknown1,dc_Unknown2,dc_HarmonizeEn,dc_ContrastEn,dc_HarmonizeHe,dc_ContrastHe', '', '', '', '', '', '', '', ''],
        ['schema.data.DetailsC', 'Schema for DetailsC sheet (legacy pairing text). Inferred.', 'stable', 'key_column', 'dc_SKU', '', '', '', '', '', '', '', ''],

        // New Mappings for Coded Values (Sheet-based)
        ['map.grape_codes', 'Pointer to the grape codes lookup sheet.', 'stable', 'sheet_name', 'SysLkp_Grapes', '', '', '', '', '', '', '', ''],
        ['map.grape_codes', 'Pointer to the grape codes lookup sheet.', 'stable', 'key_col', 'slg_Code', '', '', '', '', '', '', '', ''],
        ['map.grape_codes', 'Pointer to the grape codes lookup sheet.', 'stable', 'val_col_en', 'slg_TextEN', '', '', '', '', '', '', '', ''],
        ['map.grape_codes', 'Pointer to the grape codes lookup sheet.', 'stable', 'val_col_he', 'slg_TextHE', '', '', '', '', '', '', '', ''],
        ['map.kashrut_codes', 'Pointer to the kashrut codes lookup sheet.', 'stable', 'sheet_name', 'SysLkp_Kashrut', '', '', '', '', '', '', '', ''],
        ['map.kashrut_codes', 'Pointer to the kashrut codes lookup sheet.', 'stable', 'key_col', 'slk_Code', '', '', '', '', '', '', '', ''],
        ['map.kashrut_codes', 'Pointer to the kashrut codes lookup sheet.', 'stable', 'val_col_en', 'slk_TextEN', '', '', '', '', '', '', '', ''],
        ['map.kashrut_codes', 'Pointer to the kashrut codes lookup sheet.', 'stable', 'val_col_he', 'slk_TextHE', '', '', '', '', '', '', '', ''],
        ['map.boolean_codes', 'Pointer to the boolean text lookup sheet.', 'stable', 'sheet_name', 'SysLkp_Texts', '', '', '', '', '', '', '', ''],
        ['map.boolean_codes', 'Pointer to the boolean text lookup sheet.', 'stable', 'key_col', 'slt_Code', '', '', '', '', '', '', '', ''],
        ['map.boolean_codes', 'Pointer to the boolean text lookup sheet.', 'stable', 'val_col_en', 'slt_TextEN', '', '', '', '', '', '', '', ''],
        ['map.boolean_codes', 'Pointer to the boolean text lookup sheet.', 'stable', 'val_col_he', 'slt_TextHE', '', '', '', '', '', '', '', ''],
        ['map.pairing_codes', 'Pointer to the pairing text lookup sheet.', 'stable', 'sheet_name', 'SysLkp_Texts', '', '', '', '', '', '', '', ''],
        ['map.pairing_codes', 'Pointer to the pairing text lookup sheet.', 'stable', 'key_col', 'slt_Code', '', '', '', '', '', '', '', ''],
        ['map.pairing_codes', 'Pointer to the pairing text lookup sheet.', 'stable', 'val_col_en', 'slt_TextEN', '', '', '', '', '', '', '', ''],
        ['map.pairing_codes', 'Pointer to the pairing text lookup sheet.', 'stable', 'val_col_he', 'slt_TextHE', '', '', '', '', '', '', '', ''],

        // Keys for Conditional Lookups in SysLkp_Texts
        ['pairing.harmonize.mild.key', 'SysLkp_Texts key for mild harmonize pairing.', 'stable', 'key', 'PAIR_HAR_MILD', '', '', '', '', '', '', '', ''],
        ['pairing.harmonize.rich.key', 'SysLkp_Texts key for rich harmonize pairing.', 'stable', 'key', 'PAIR_HAR_RICH', '', '', '', '', '', '', '', ''],
        ['pairing.harmonize.intense.key', 'SysLkp_Texts key for intense harmonize pairing.', 'stable', 'key', 'PAIR_HAR_INTENSE', '', '', '', '', '', '', '', ''],
        ['pairing.harmonize.sweet.key', 'SysLkp_Texts key for sweet harmonize pairing.', 'stable', 'key', 'PAIR_HAR_SWEET', '', '', '', '', '', '', '', ''],
        ['pairing.contrast.mild.key', 'SysLkp_Texts key for mild contrast pairing.', 'stable', 'key', 'PAIR_CON_MILD', '', '', '', '', '', '', '', ''],
        ['pairing.contrast.rich.key', 'SysLkp_Texts key for rich contrast pairing.', 'stable', 'key', 'PAIR_CON_RICH', '', '', '', '', '', '', '', ''],
        ['pairing.contrast.intense.key', 'SysLkp_Texts key for intense contrast pairing.', 'stable', 'key', 'PAIR_CON_INTENSE', '', '', '', '', '', '', '', ''],
        ['pairing.contrast.sweet.key', 'SysLkp_Texts key for sweet contrast pairing.', 'stable', 'key', 'PAIR_CON_SWEET', '', '', '', '', '', '', '', ''],
        ['boolean.is_mevushal.key', 'SysLkp_Texts key for is_mevushal flag.', 'stable', 'key', 'IS_MEVUSHAL', '', '', '', '', '', '', '', ''],
        ['migration.sync.tasks', 'Configuration for migrating SysOrdLog.', 'stable', 'column_mappings', 'order_id:sol_OrderId,order_date:sol_OrderDate,packing_slip_status:sol_PackingStatus,packing_print_date:sol_PackingPrintedTimestamp', '', '', '', '', '', '', '', ''],

        // Printing
        ['_section.08_Printing', 'Configurations for printing documents.', '', '', '', '', '', '', '', '', '', '', ''],
        ['printing.templates.folder_id', 'The Google Drive Folder ID for printing templates.', 'stable', 'id', '1dUSbbkNCrGbVUpZnmoa0D_e5zib9HaXe', '', '', '', '', '', '', '', ''],
        ['printing.packingslip.default_template_id', 'The Google Doc ID for the default packing slip template.', 'stable', 'id', '1z3VocTeR_PbLMtQp94dg2JuIb-Z3EOVoZVgS0zMmAMw', '', '', '', '', '', '', '', ''],
        ['printing.note.default_template_id', 'The Google Doc ID for the default note template.', 'stable', 'id', '1_E2uUq0b5jsIfrdvMorUDF2Hweqm4JFvS-GkliEFXKg', '', '', '', '', '', '', '', ''],
        ['printing.output.folder_id', 'The Google Drive Folder ID for printed documents output.', 'stable', 'id', '1eUQtr15O_NT0Ow4GUi1icBvpDwGJQf23', '', '', '', '', '', '', '', '']
    ];
}
