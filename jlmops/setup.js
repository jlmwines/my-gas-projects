/**
 * @file setup.js
 * @description Contains tactical functions for implementation steps.
 */

/**
 * ONE-TIME-USE: Adds/cleans essential schemas and maps in SysConfig.
 * This function is additive and will not create duplicates, but will remove specific incorrect configs.
 */
function addMissingConfigs() {
  const configsToDelete = [
    'import.drive.web_products_he',
    'map.web.product_columns_he',
    'schema.data.WebProdS_HE'
  ];

  const configsToManage = {
    'schema.data.CmxProdM': {
        _description: 'Schema for Comax Products Master sheet.',
        headers: 'cpm_CmxId,cpm_SKU,cpm_NameHe,cpm_Division,cpm_Group,cpm_Vendor,cpm_Brand,cpm_Color,cpm_Size,cpm_Dryness,cpm_Vintage,cpm_IsNew,cpm_IsArchived,cpm_IsActive,cpm_Price,cpm_Stock,cpm_IsWeb,cpm_Exclude'
    },
    'schema.data.CmxProdS': {
        _description: 'Schema for Comax Products Staging sheet.',
        headers: 'cps_CmxId,cps_SKU,cps_NameHe,cps_Division,cps_Group,cps_Vendor,cps_Brand,cps_Color,cps_Size,cps_Dryness,cps_Vintage,cps_IsNew,cps_IsArchived,cps_IsActive,cps_Price,cps_Stock,cps_IsWeb,cps_Exclude'
    },
    'schema.data.WebProdS_EN': {
        _description: 'Schema for Web Products Staging sheet (EN).',
        headers: 'wps_ID,wps_SKU,wps_Name,wps_Published,wps_Stock,wps_Price'
    },
    'map.web.product_columns': {
        _description: 'Maps WooCommerce CSV headers to internal field names for staging.',
        'ID': 'wps_ID',
        'SKU': 'wps_SKU',
        'Name': 'wps_Name',
        'Published': 'wps_Published',
        'Stock': 'wps_Stock',
        'Regular Price': 'wps_Price'
    }
  };

  try {
    console.log('Resetting essential schemas and maps in SysConfig...');
    const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = spreadsheet.getSheetByName('SysConfig');
    if (!sheet) throw new Error('SysConfig sheet not found.');

    // --- 1. Delete existing managed configurations ---
    const configKeysToDelete = Object.keys(configsToManage);
    const range = sheet.getDataRange();
    const values = range.getValues();
    let rowsDeleted = 0;
    for (let i = values.length - 1; i >= 1; i--) { // i >= 1 to skip header
      const settingName = values[i][0]; // Column A
      if (configKeysToDelete.includes(settingName)) {
        sheet.deleteRow(i + 1); // i is 0-based, deleteRow is 1-based
        rowsDeleted++;
      }
    }
    if (rowsDeleted > 0) console.log(`Removed ${rowsDeleted} old schema/map configuration rows.`);

    // --- 2. Add the new configurations ---
    const rowsToAppend = [];
    for (const settingName in configsToManage) {
      const settingBlock = configsToManage[settingName];
      const description = settingBlock._description || '';
      for (const propName in settingBlock) {
        if (propName === '_description') continue;
        const propValue = settingBlock[propName];
        const row = new Array(12).fill('');
        row[0] = settingName;
        row[1] = description;
        row[2] = propName;
        row[3] = propValue;
        rowsToAppend.push(row);
      }
    }

    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 12).setValues(rowsToAppend);
      console.log(`Successfully added ${rowsToAppend.length} fresh schema/map configuration rows.`);
    } else {
      console.log('No new configurations to add.');
    }
  } catch (e) {
    console.error(`A critical error occurred in addMissingConfigs: ${e.message}`);
  }
}


/**
 * Sets up the validation rules in SysConfig.
 * This function is DESTRUCTIVE for validation rules only. It will delete all
 * existing rules and replace them with the configuration below.
 */
function runImplementationStep() {
  const newRules = {
    'validation.rule.A1_WebS_NotIn_WebM': {
        _description: '[A1] Web Staging product not in Web Master.',
        enabled: 'FALSE',
        test_type: 'EXISTENCE_CHECK',
        source_sheet: 'WebProdS_EN',
        target_sheet: 'WebProdM',
        source_key: 'wps_ID',
        target_key: 'wpm_WebIdEn',
        invert_result: 'TRUE',
        on_failure_task_type: 'task.validation.web_new_product',
        on_failure_title: 'New Web Product: ${wps_Name}',
        on_failure_notes: 'Product ID ${wps_ID} (${wps_Name}) was found in the latest web import but does not exist in the master product list. It may need to be added.'
    },
    'validation.rule.A2_WebM_NotIn_WebS': {
        _description: '[A2] Web Master product not in Web Staging.',
        enabled: 'FALSE',
        test_type: 'EXISTENCE_CHECK',
        source_sheet: 'WebProdM',
        target_sheet: 'WebProdS_EN',
        source_key: 'wpm_WebIdEn',
        target_key: 'wps_ID',
        invert_result: 'TRUE',
        on_failure_task_type: 'task.validation.web_missing_product',
        on_failure_title: 'Missing Web Product: ${wpm_NameEn}',
        on_failure_notes: 'Product ID ${wpm_WebIdEn} (${wpm_NameEn}) exists in the master list but was not found in the latest web import. It may have been deleted or its ID changed.'
    },
    'validation.rule.A3_Web_SkuMismatch': {
        _description: '[A3] SKU mismatch between Web Master and Staging.',
        enabled: 'FALSE',
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
    'validation.rule.A4_Web_NameMismatch': {
        _description: '[A4] Name mismatch between Web Master and Staging.',
        enabled: 'FALSE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'WebProdM',
        sheet_B: 'WebProdS_EN',
        key_A: 'wpm_WebIdEn',
        key_B: 'wps_ID',
        compare_fields: 'wpm_NameEn,wps_Name',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Web Name Mismatch: ${wpm_NameEn}',
        on_failure_notes: 'Product ID ${wpm_WebIdEn} has a different name in master (${wpm_NameEn}) versus staging (${wps_Name}).'
    },
    'validation.rule.A5_Web_PublishStatusMismatch': {
        _description: '[A5] Publish status mismatch between Web Master and Staging.',
        enabled: 'FALSE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'WebProdM',
        sheet_B: 'WebProdS_EN',
        key_A: 'wpm_WebIdEn',
        key_B: 'wps_ID',
        compare_fields: 'wpm_PublishStatusEn,wps_Published',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Web Publish Status Mismatch: ${wpm_NameEn}',
        on_failure_notes: 'Product ID ${wpm_WebIdEn} has a different publish status in master (${wpm_PublishStatusEn}) versus staging (${wps_Published}).'
    },
    'validation.rule.C1_ComaxM_NotIn_ComaxS': {
        _description: '[C1] Active Comax Master product not in Comax Staging.',
        enabled: 'FALSE',
        test_type: 'EXISTENCE_CHECK',
        source_sheet: 'CmxProdM',
        target_sheet: 'CmxProdS',
        source_key: 'cpm_SKU',
        target_key: 'cps_SKU',
        source_filter: 'cpm_IsActive,כן',
        invert_result: 'TRUE',
        on_failure_task_type: 'task.validation.comax_missing_product',
        on_failure_title: 'Missing Comax Product: ${cpm_NameHe}',
        on_failure_notes: 'Active SKU ${cpm_SKU} (${cpm_NameHe}) exists in Comax master but was not in the latest import.'
    },
    'validation.rule.C2_Comax_IdMismatch': {
        _description: '[C2] ID mismatch between Comax Master and Staging.',
        enabled: 'FALSE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'CmxProdM',
        sheet_B: 'CmxProdS',
        key_A: 'cpm_SKU',
        key_B: 'cps_SKU',
        compare_fields: 'cpm_CmxId,cps_CmxId',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Comax ID Mismatch: ${cpm_NameHe}',
        on_failure_notes: 'SKU ${cpm_SKU} has a different Comax ID in master (${cpm_CmxId}) versus staging (${cps_CmxId}).'
    },
    'validation.rule.C3_Comax_NameMismatch': {
        _description: '[C3] Name mismatch between Comax Master and Staging.',
        enabled: 'FALSE',
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
    'validation.rule.C4_Comax_GroupMismatch': {
        _description: '[C4] Group mismatch between Comax Master and Staging.',
        enabled: 'FALSE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'CmxProdM',
        sheet_B: 'CmxProdS',
        key_A: 'cpm_SKU',
        key_B: 'cps_SKU',
        compare_fields: 'cpm_Group,cps_Group',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Comax Group Mismatch: ${cpm_NameHe}',
        on_failure_notes: 'SKU ${cpm_SKU} has a different group in master (${cpm_Group}) versus staging (${cps_Group}).'
    },
    'validation.rule.C5_Comax_SizeMismatch': {
        _description: '[C5] Size mismatch between Comax Master and Staging.',
        enabled: 'FALSE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'CmxProdM',
        sheet_B: 'CmxProdS',
        key_A: 'cpm_SKU',
        key_B: 'cps_SKU',
        compare_fields: 'cpm_Size,cps_Size',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Comax Size Mismatch: ${cpm_NameHe}',
        on_failure_notes: 'SKU ${cpm_SKU} has a different size in master (${cpm_Size}) versus staging (${cps_Size}).'
    },
    'validation.rule.C6_Comax_VintageMismatch': {
        _description: '[C6] Vintage mismatch between Comax Master and Staging.',
        enabled: 'TRUE',
        test_type: 'FIELD_COMPARISON',
        sheet_A: 'CmxProdM',
        sheet_B: 'CmxProdS',
        key_A: 'cpm_SKU',
        key_B: 'cps_SKU',
        compare_fields: 'cpm_Vintage,cps_Vintage',
        on_failure_task_type: 'task.validation.field_mismatch',
        on_failure_title: 'Comax Vintage Mismatch: ${cpm_NameHe}',
        on_failure_notes: 'SKU ${cpm_SKU} has a different vintage in master (${cpm_Vintage}) versus staging (${cps_Vintage}).'
    },
    'validation.rule.D1_Comax_ExcludedNotSellOnline': {
        _description: '[D1] \'Excluded\' but not \'Sell Online\' in Comax Staging.',
        enabled: 'FALSE',
        test_type: 'INTERNAL_AUDIT',
        source_sheet: 'CmxProdS',
        condition: 'cps_Exclude,TRUE,AND,cps_IsWeb,<>,כן',
        on_failure_task_type: 'task.validation.comax_internal_audit',
        on_failure_title: 'Excluded item not marked Sell Online: ${cps_NameHe}',
        on_failure_notes: 'SKU ${cps_SKU} (${cps_NameHe}) is marked as excluded but is not marked as \'Sell Online\'.'
    },
    'validation.rule.D2_ComaxS_NegativeStock': {
        _description: '[D2] Negative inventory in Comax Staging.',
        enabled: 'TRUE',
        test_type: 'INTERNAL_AUDIT',
        source_sheet: 'CmxProdS',
        condition: 'cps_Stock,<,0',
        on_failure_task_type: 'task.validation.comax_internal_audit',
        on_failure_title: 'Negative Stock: ${cps_NameHe}',
        on_failure_notes: 'SKU ${cps_SKU} (${cps_NameHe}) has a negative stock value of ${cps_Stock} in the latest Comax import.'
    },
    'validation.rule.D3_ComaxS_ArchivedWithStock': {
        _description: '[D3] Archived item with positive stock in Comax Staging.',
        enabled: 'FALSE',
        test_type: 'INTERNAL_AUDIT',
        source_sheet: 'CmxProdS',
        condition: 'cps_IsArchived,כן,AND,cps_Stock,>,0',
        on_failure_task_type: 'task.validation.comax_internal_audit',
        on_failure_title: 'Archived item with stock: ${cps_NameHe}',
        on_failure_notes: 'SKU ${cps_SKU} (${cps_NameHe}) is marked as archived but has ${cps_Stock} units in stock.'
    },
    'validation.rule.E1_NewComaxOnline_NotIn_WebS': {
        _description: '[E1] New \'Sell Online\' Comax SKU not in Web Staging.',
        enabled: 'FALSE',
        test_type: 'CROSS_EXISTENCE_CHECK',
        source_sheet: 'CmxProdS',
        target_sheet: 'WebProdS_EN',
        source_key: 'cps_SKU',
        target_key: 'wps_SKU',
        source_condition: 'cps_IsWeb,כן',
        join_against: 'CmxProdM',
        join_key_source: 'cps_SKU',
        join_key_target: 'cpm_SKU',
        join_invert: 'TRUE',
        invert_result: 'TRUE',
        on_failure_task_type: 'task.validation.cross_file_error',
        on_failure_title: 'New online SKU missing from Web: ${cps_NameHe}',
        on_failure_notes: 'New SKU ${cps_SKU} is marked \'Sell Online\' in Comax but does not exist in the web products import.'
    },
    'validation.rule.E2_WebS_SKU_NotIn_ComaxS': {
        _description: '[E2] Web Staging SKU not in Comax Staging.',
        enabled: 'FALSE',
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
        _description: '[E3] Published web product not \'Sell Online\' in Comax.',
        enabled: 'FALSE',
        test_type: 'CROSS_CONDITION_CHECK',
        sheet_A: 'WebProdS_EN',
        sheet_B: 'CmxProdS',
        key_A: 'wps_SKU',
        key_B: 'cps_SKU',
        condition_A: 'wps_Published,published',
        condition_B: 'cps_IsWeb,<>,כן',
        on_failure_task_type: 'task.validation.cross_file_error',
        on_failure_title: 'Published item not for sale: ${wps_Name}',
        on_failure_notes: 'SKU ${wps_SKU} (${wps_Name}) is published on the web, but is not marked \'Sell Online\' in Comax.'
    }
  };

  try {
    console.log('Resetting validation rules in SysConfig...');
    const spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const sheet = spreadsheet.getSheetByName('SysConfig');
    if (!sheet) throw new Error('SysConfig sheet not found.');

    // --- 1. Delete existing validation rules ---
    const range = sheet.getDataRange();
    const values = range.getValues();
    let rowsDeleted = 0;
    // Iterate backwards to safely delete rows
    for (let i = values.length - 1; i >= 1; i--) { // i >= 1 to skip header
      const settingName = values[i][0]; // Column A
      if (settingName && String(settingName).startsWith('validation.rule.')) {
        sheet.deleteRow(i + 1); // i is 0-based, deleteRow is 1-based
        rowsDeleted++;
      }
    }
    console.log(`Removed ${rowsDeleted} existing validation rule rows.`);

    // --- 2. Add the new rules ---
    const rowsToAppend = [];
    for (const settingName in newRules) {
      const settingBlock = newRules[settingName];
      const description = settingBlock._description || '';
      for (const propName in settingBlock) {
        if (propName === '_description') continue;
        const propValue = settingBlock[propName];
        const row = new Array(12).fill('');
        row[0] = settingName;
        row[1] = description;
        row[2] = propName;
        row[3] = propValue;
        rowsToAppend.push(row);
      }
    }

    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 12).setValues(rowsToAppend);
      console.log(`Successfully added ${Object.keys(newRules).length} validation rules.`);
    } else {
      console.log('No new rules to add.');
    }

  } catch (e) {
    console.error(`A critical error occurred in runImplementationStep: ${e.message}`);
  }
}