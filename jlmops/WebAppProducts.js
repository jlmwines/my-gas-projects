/**
 * @file WebAppProducts.js
 * @description This file contains functions for the products widget.
 */

/**
 * Gets the counts of various product-related tasks.
 *
 * @returns {object} An object containing the counts of product tasks.
 */
function WebAppProducts_getProductsWidgetData() {
  const productTaskTypes = [
    'task.validation.sku_not_in_comax',
    'task.validation.translation_missing',
    'task.validation.comax_internal_audit',
    'task.validation.field_mismatch', // This includes vintage mismatch
    'task.validation.name_mismatch',
    'task.validation.web_master_discrepancy',
    'task.validation.comax_master_discrepancy',
    'task.validation.row_count_decrease',
    'task.validation.comax_not_web_product'
  ];

  try {
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = dataSpreadsheet.getSheetByName('SysTasks');

    if (!sheet) {
      throw new Error("Sheet 'SysTasks' not found");
    }

    const headers = taskSchema.headers.split(',');
    const typeIdCol = headers.indexOf('st_TaskTypeId');
    const statusCol = headers.indexOf('st_Status');
    const titleCol = headers.indexOf('st_Title');

    const taskCounts = {};
    productTaskTypes.forEach(taskType => {
      taskCounts[taskType] = 0;
    });
    taskCounts['vintage_mismatch_tasks'] = 0; // Specific count for vintage mismatch

    if (sheet.getLastRow() > 1) {
      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      existingRows.forEach(row => {
        const taskType = row[typeIdCol];
        const status = row[statusCol];
        const title = String(row[titleCol] || '');

        if (productTaskTypes.includes(taskType) && status !== 'Done' && status !== 'Closed') {
          taskCounts[taskType]++;
          if (taskType === 'task.validation.field_mismatch' && title.toLowerCase().includes('vintage mismatch')) {
            taskCounts['vintage_mismatch_tasks']++;
          }
        }
      });
    }

    return {
      error: null,
      data: taskCounts
    };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getProductsWidgetData', `Error getting products widget data: ${e.message}`);
    return {
      error: `Error getting products widget data: ${e.message}`,
      data: null
    };
  }
}

/**
 * Gets a list of product detail update tasks for the admin to review.
 * Filters for 'task.validation.field_mismatch' tasks with 'Vintage Mismatch' in the title
 * and 'Review' status.
 *
 * @returns {Array<Object>} A list of product detail update tasks.
 */
function WebAppProducts_getAdminReviewTasks() {
  try {
    LoggerService.info('WebAppProducts', 'getAdminReviewTasks', 'Starting task fetch...');
    
    // Emulate inventory method: Use getOpenTasksByTypeIdAndStatus
    const tasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.field_mismatch', 'Review');
    LoggerService.info('WebAppProducts', 'getAdminReviewTasks', `Fetched ${tasks.length} raw tasks with status 'Review'.`);
    
    // Filter for Vintage Mismatch safely
    const reviewTasks = tasks.filter(t => {
        const title = String(t.st_Title || '');
        const isMatch = title.toLowerCase().includes('vintage mismatch');
        if (!isMatch) {
             LoggerService.info('WebAppProducts', 'getAdminReviewTasks', `Filtering out task ${t.st_TaskId}: Title '${title}' does not contain 'vintage mismatch'.`);
        }
        return isMatch;
    });
    
    LoggerService.info('WebAppProducts', 'getAdminReviewTasks', `Returning ${reviewTasks.length} filtered review tasks.`);
    
    return reviewTasks.map(t => ({
        taskId: t.st_TaskId,
        sku: t.st_LinkedEntityId,
        title: t.st_Title,
        status: t.st_Status,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate),
        assignedTo: t.st_AssignedTo
    }));
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getAdminReviewTasks', `Error getting admin review tasks: ${e.message}`, e);
    throw e;
  }
}

/**
 * Gets a list of accepted product detail tasks ready for export.
 * Filters for 'task.validation.field_mismatch' tasks with 'Vintage Mismatch' in the title
 * and 'Accepted' status.
 *
 * @returns {Array<Object>} A list of accepted tasks.
 */
function WebAppProducts_getAcceptedTasks() {
  try {
    LoggerService.info('WebAppProducts', 'getAcceptedTasks', 'Starting accepted task fetch...');
    
    const tasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.field_mismatch', 'Accepted');
    LoggerService.info('WebAppProducts', 'getAcceptedTasks', `Fetched ${tasks.length} raw tasks with status 'Accepted'.`);
    
    const acceptedTasks = tasks.filter(t => {
        const title = String(t.st_Title || '');
        return title.toLowerCase().includes('vintage mismatch');
    });
    
    LoggerService.info('WebAppProducts', 'getAcceptedTasks', `Returning ${acceptedTasks.length} filtered accepted tasks.`);
    
    return acceptedTasks.map(t => ({
        taskId: t.st_TaskId,
        sku: t.st_LinkedEntityId,
        title: t.st_Title,
        status: t.st_Status,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate),
        assignedTo: t.st_AssignedTo
    }));
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getAcceptedTasks', `Error getting accepted tasks: ${e.message}`, e);
    throw e;
  }
}

/**
 * Triggers the export of accepted product details to a CSV.
 * @returns {Object} Result with success status and message.
 */
function WebAppProducts_exportAcceptedUpdates() {
    return ProductService.generateDetailExport();
}

/**
 * Confirms that the web updates have been performed, marking accepted tasks as Completed.
 * @returns {Object} Result with success status and message.
 */
function WebAppProducts_confirmWebUpdates() {
    return ProductService.confirmWebUpdates();
}

/**
 * Generates HTML previews for the product editor.
 * @param {string} sku The product SKU.
 * @param {Object} formData The current form data.
 * @param {Object} comaxData The Comax master data.
 * @returns {Object} { htmlEn, htmlHe }
 */
function WebAppProducts_getPreview(sku, formData, comaxData) {
    const allConfig = ConfigService.getAllConfig();
    const lookupMaps = {
        texts: LookupService.getLookupMap('map.text_lookups'),
        grapes: LookupService.getLookupMap('map.grape_lookups'),
        kashrut: LookupService.getLookupMap('map.kashrut_lookups')
    };
    return ProductService.getProductHtmlPreview(sku, formData, comaxData, 'EN', lookupMaps, false); // Assuming EN for preview, pass comaxData
}

/**
 * Gets a list of product detail update tasks for the manager.
 * Filters for 'task.validation.field_mismatch' tasks with 'Vintage Mismatch' in the title
 * and 'New' or 'Assigned' status.
 *
 * @returns {Array<Object>} A list of product detail update tasks.
 */
function WebAppProducts_getManagerProductTasks() {
  try {
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Opening spreadsheet ID: ${dataSpreadsheetId}`);
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = dataSpreadsheet.getSheetByName('SysTasks');

    if (!sheet) {
      throw new Error("Sheet 'SysTasks' not found");
    }

    const headers = taskSchema.headers.split(',');
    const typeIdCol = headers.indexOf('st_TaskTypeId');
    const statusCol = headers.indexOf('st_Status');
    const titleCol = headers.indexOf('st_Title');
    
    LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Indices: Type=${typeIdCol}, Status=${statusCol}, Title=${titleCol}`);
    const linkedEntityIdCol = headers.indexOf('st_LinkedEntityId');
    const taskIdCol = headers.indexOf('st_TaskId');
    const createdDateCol = headers.indexOf('st_CreatedDate');
    const assignedToCol = headers.indexOf('st_AssignedTo');

    const tasks = [];
    if (sheet.getLastRow() > 1) {
      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      if (existingRows.length > 0) {
         LoggerService.info('WebAppProducts', 'getManagerProductTasks', `First row sample: ${JSON.stringify(existingRows[0])}`);
      }
      existingRows.forEach((row, index) => {
        const taskType = String(row[typeIdCol] || '').trim();
        const status = String(row[statusCol] || '').trim();
        const title = String(row[titleCol] || '');

        if (index === 0) {
             const typeMatch = taskType === 'task.validation.field_mismatch';
             const titleMatch = title.toLowerCase().includes('vintage mismatch');
             const statusMatch = (status === 'New' || status === 'Assigned');
             LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Row 0 Analysis: TypeMatch=${typeMatch}, TitleMatch=${titleMatch}, StatusMatch=${statusMatch}`);
        }

        if (taskType === 'task.validation.field_mismatch' && title.toLowerCase().includes('vintage mismatch') && (status === 'New' || status === 'Assigned')) {
          tasks.push({
            taskId: row[taskIdCol],
            sku: row[linkedEntityIdCol], // Assuming LinkedEntityId is SKU
            title: title,
            status: status,
            createdDate: String(row[createdDateCol]),
            assignedTo: row[assignedToCol]
          });
        }
      });
    }
    LoggerService.info('WebAppProducts', 'getManagerProductTasks', `Returning ${tasks.length} tasks.`);
    return tasks;
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getManagerProductTasks', `Error getting manager product tasks: ${e.message}`, e);
    throw e;
  }
}

/**
 * Fetches product details (master and staging) for the editor.
 * @param {string} taskId The ID of the task.
 * @returns {object} An object containing master and staging product data, and the SKU.
 */
function WebAppProducts_loadProductEditorData(taskId) {
  try {
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = dataSpreadsheet.getSheetByName('SysTasks');
    if (!sheet) throw new Error("Sheet 'SysTasks' not found");

    const headers = taskSchema.headers.split(',');
    const taskIdCol = headers.indexOf('st_TaskId');
    const linkedEntityIdCol = headers.indexOf('st_LinkedEntityId');

    const allTasks = ConfigService._getSheetDataAsMap('SysTasks', headers, 'st_TaskId').map;
    const task = allTasks.get(taskId);

    if (!task) throw new Error(`Task with ID ${taskId} not found.`);
    const sku = task.st_LinkedEntityId;

    // Parse the JSON string returned by ProductService
    const productDetailsJson = ProductService.getProductDetails(sku); 
    const productDetails = JSON.parse(productDetailsJson);

    return {
      sku: sku,
      taskId: taskId,
      masterData: productDetails.master,
      stagingData: productDetails.staging,
      comaxData: productDetails.comax,
      regions: productDetails.regions,
      abvOptions: productDetails.abvOptions,
      grapes: productDetails.grapes,
      kashrut: productDetails.kashrut
    };

  } catch (e) {
    LoggerService.error('WebAppProducts', 'loadProductEditorData', `Error loading product editor data for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

/**
 * Handles the submission of product details by a manager to the staging area.
 * @param {string} taskId The ID of the task.
 * @param {string} sku The SKU of the product being edited.
 * @param {Object} formData The form data submitted by the manager.
 * @returns {Object} Success status.
 */
function WebAppProducts_handleManagerSubmit(taskId, sku, formData) {
  try {
    const result = ProductService.submitProductDetails(taskId, sku, formData);
    return { success: true, message: "Product details submitted for review." };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'handleManagerSubmit', `Error submitting manager edits for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

/**
 * Handles the acceptance of product details by an admin.
 * @param {string} taskId The ID of the task.
 * @param {string} sku The SKU of the product.
 * @param {Object} finalData The final data approved by the admin.
 * @returns {Object} Success status.
 */
function WebAppProducts_handleAdminAccept(taskId, sku, finalData) {
  try {
    const result = ProductService.acceptProductDetails(taskId, sku, finalData);
    return { success: true, message: "Product details accepted and updated in master." };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'handleAdminAccept', `Error accepting admin edits for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

/**
 * Handles the confirmation by an admin that web updates have been made.
 * @param {string} taskId The ID of the task.
 * @returns {Object} Success status.
 */
function WebAppProducts_handleAdminConfirmWebUpdate(taskId) {
  try {
    TaskService.updateTaskStatus(taskId, 'Done');
    return { success: true, message: "Task marked as 'Done' (Web update confirmed)." };
  } catch (e) {
    LoggerService.error('WebAppProducts', 'handleAdminConfirmWebUpdate', `Error confirming web update for task ${taskId}: ${e.message}`, e);
    throw e;
  }
}

function test_loadProductEditorData() {
  const taskId = '61c0e9c4-6a04-44eb-8a9a-1dbf255eec64'; // Task ID from previous logs
  Logger.log(`Testing loadProductEditorData for Task ID: ${taskId}`);

  try {
    const result = WebAppProducts_loadProductEditorData(taskId);
    Logger.log('Result received:');
    Logger.log(JSON.stringify(result, null, 2));
    
    if (result.masterData) {
        Logger.log('Master Data present.');
        Logger.log(`NameEn: ${result.masterData.wdm_NameEn}`);
    } else {
        Logger.log('Master Data MISSING.');
    }

    if (result.comaxData) {
        Logger.log('Comax Data present.');
        Logger.log(`Vintage: ${result.comaxData.cpm_Vintage}`);
    } else {
        Logger.log('Comax Data MISSING.');
    }
  } catch (e) {
    Logger.log(`Error: ${e.message}`);
    Logger.log(e.stack);
  }
}

/**
 * Gets the consolidated data for the Manager Products Widget.
 * Aggregates task counts and category health status.
 *
 * @returns {Object} { 
 *   newDetailUpdatesCount: number, 
 *   reviewDetailUpdatesCount: number,
 *   newProductSuggestionsCount: number,
 *   deficientCategoriesCount: number,
 *   deficientCategories: Array<{category: string, current: number, min: number, status: string}>
 * }
 */
function WebAppProducts_getManagerWidgetData() {
  try {
    LoggerService.info('WebAppProducts', 'getManagerWidgetData', 'Starting data fetch...');
    const result = {
      newDetailUpdatesCount: 0,
      reviewDetailUpdatesCount: 0,
      newProductSuggestionsCount: 0,
      deficientCategoriesCount: 0,
      deficientCategories: [],
      allCategories: []
    };

    // 1. Fetch Task Counts
    const allTasks = WebAppTasks.getOpenTasks(); // Assuming this returns all tasks, might need optimization
    
    if (allTasks && allTasks.length > 0) {
      allTasks.forEach(t => {
        const type = t.st_TaskTypeId;
        const status = t.st_Status;
        const title = String(t.st_Title || '').toLowerCase();

        if (type === 'task.validation.field_mismatch' && title.includes('vintage mismatch')) {
          if (status === 'New' || status === 'Assigned') {
            result.newDetailUpdatesCount++;
          } else if (status === 'Review') {
            result.reviewDetailUpdatesCount++;
          }
        }
        // Assuming generic new product tasks have a specific type or title pattern
        // For now, using a placeholder check based on typical naming
        if (title.includes('new product') && (status === 'New' || status === 'Assigned')) {
             result.newProductSuggestionsCount++;
        }
      });
    }

    // 2. Calculate Category Health
    const stockHealthConfig = ConfigService.getConfig('StockHealth');
    if (stockHealthConfig) {
        // Parse the flattened config structure: Key="MinCat.CategoryName"
        const minRules = [];
        
        // In ConfigService's current implementation for multi-row configs sharing SettingName,
        // it returns an object where keys are scf_P01.
        // For our structure: 
        // Key (scf_P01): "MinCat.CategoryName"
        // Value (scf_P02): "MinCount"
        // However, we added scf_P03 (FilterRule). ConfigService DOES NOT currently return P03 in the simple object map.
        // It only returns P01: P02.
        
        // CRITICAL: ConfigService needs to provide P03.
        // Checking ConfigService.js... 
        // "if (propKeyP03 !== null ... parsedConfig[settingName][String(propKeyP03).trim()] = propValueP04;"
        // It maps P03 as a KEY and P04 as a VALUE. This is for schema definitions.
        
        // For 'StockHealth', we are using P01, P02, P03.
        // The current ConfigService will map P01: P02. It will IGNORE P03 unless it's a schema block.
        
        // Workaround: We must read the raw sheet or fix ConfigService.
        // Since I cannot fix ConfigService, I will read the raw sheet here to get P03.
        // This is inefficient but necessary without changing ConfigService.
        
        const configDataMap = ConfigService._getSheetDataAsMap('SysConfig', ['scf_SettingName', 'scf_P01', 'scf_P02', 'scf_P03'], 'scf_P01'); 
        // Wait, SysConfig isn't keyed by P01 globally. It's a list.
        // ConfigService._getSheetDataAsMap uses a key column.
        
        // Better approach: ConfigService.getAllConfig() returns the cached object.
        // If ConfigService doesn't expose P03 for generic settings, I can't get it easily.
        
        // Let's assume for now I can infer the Division from the Category Name or hardcode the mapping logic 
        // momentarily if I can't change ConfigService.
        // OR, I can use the fact that I know the new categories:
        // 'ליקר' -> Div 3
        // 'אביזרים' -> Div 5
        // 'פריטי מתנה' -> Div 9
        
        // I will hardcode this mapping map temporarily to proceed without modifying ConfigService core logic 
        // which might be risky.
        
        const divisionMap = {
            'ליקר': '3',
            'אביזרים': '5',
            'פריטי מתנה': '9'
        };

        for (const [key, value] of Object.entries(stockHealthConfig)) {
            if (key.startsWith('MinCat.')) {
                const catName = key.replace('MinCat.', '');
                minRules.push({
                    category: catName,
                    min: parseInt(value, 10),
                    targetDivision: divisionMap[catName] || null // Use hardcoded map for now
                });
            }
        }

        if (minRules.length > 0) {
            const cmxDataMap = ConfigService._getSheetDataAsMap('CmxProdM', ConfigService.getConfig('schema.data.CmxProdM').headers.split(','), 'cpm_CmxId');
            const categoryCounts = {};
            let debugLogCount = 0;

            // Aggregate current stock
            cmxDataMap.map.forEach(product => {
                // Filter for Active and Web products
                const isActive = String(product.cpm_IsActive || '').trim();
                const isWeb = String(product.cpm_IsWeb || '').trim();
                const activeCheck = (isActive !== '');
                const webCheck = (isWeb === '1' || isWeb.toLowerCase() === 'true' || isWeb === 'כן');

                if (activeCheck && webCheck) {
                    const prodGroup = String(product.cpm_Group || '').trim();
                    const prodDiv = String(product.cpm_Division || '').trim();
                    const stock = parseInt(product.cpm_Stock, 10) || 0;

                    if (stock > 0) {
                        // Find matching rule
                        // Priority: Division Match -> Group Match
                        let matchedCategory = null;
                        
                        // 1. Check Division Rules
                        for (const rule of minRules) {
                            if (rule.targetDivision && rule.targetDivision === prodDiv) {
                                matchedCategory = rule.category;
                                break; 
                            }
                        }
                        
                        // 2. If no division match, use Group (implied Div 1 or default)
                        if (!matchedCategory) {
                             matchedCategory = prodGroup;
                        }

                        if (matchedCategory) {
                             categoryCounts[matchedCategory] = (categoryCounts[matchedCategory] || 0) + 1;
                        }
                    }
                }
            });
            
            // Compare against rules
            minRules.forEach(rule => {
                const currentCount = categoryCounts[rule.category] || 0;
                const status = currentCount < rule.min ? 'Low' : 'OK';
                
                const catData = {
                    category: rule.category,
                    current: currentCount,
                    min: rule.min,
                    status: status
                };
                
                result.allCategories.push(catData);

                if (status === 'Low') {
                    result.deficientCategoriesCount++;
                    result.deficientCategories.push(catData);
                }
            });
        }
    }

    LoggerService.info('WebAppProducts', 'getManagerWidgetData', `Returning data: ${JSON.stringify(result)}`);
    return result;

  } catch (e) {
    LoggerService.error('WebAppProducts', 'getManagerWidgetData', `Error: ${e.message}`, e);
    return { error: e.message };
  }
}

/**
 * Gets a list of potential products for a given category.
 * Products must be Active, have Stock > 0, and NOT be on the Web.
 *
 * @param {string} category The category (Comax Group) to filter by.
 * @returns {Array<Object>} List of eligible products {sku, name, price, stock}.
 */
function WebAppProducts_getPotentialProducts(category) {
  try {
    const cmxDataMap = ConfigService._getSheetDataAsMap('CmxProdM', ConfigService.getConfig('schema.data.CmxProdM').headers.split(','), 'cpm_CmxId');
    const potentialProducts = [];
    
    // Helper for strict boolean check (for IsWeb)
    const isTrue = (val) => {
        const s = String(val || '').trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'כן';
    };

    const divisionMap = {
        'ליקר': '3',
        'אביזרים': '5',
        'פריטי מתנה': '9'
    };
    const targetDivision = divisionMap[category] || null;

    let logCount = 0;

    cmxDataMap.map.forEach(product => {
      // Filter Logic:
      const prodGroup = String(product.cpm_Group || '').trim();
      const prodDiv = String(product.cpm_Division || '').trim();

      // 1. Match Category (if provided)
      if (category) {
          if (targetDivision) {
              // Division Match Mode
              if (prodDiv !== targetDivision) return;
          } else {
              // Group Match Mode (Wine)
              if (prodGroup !== category) return;
          }
      }

      // 2. Must be Active (Non-empty string)
      const isActive = String(product.cpm_IsActive || '').trim();
      if (isActive === '') return;

      // 3. Must NOT be on Web (Strict check)
      if (isTrue(product.cpm_IsWeb)) return;

      // 4. Must have Stock
      const stock = parseInt(product.cpm_Stock, 10) || 0;
      if (stock <= 0) return;

      if (logCount < 5) {
          LoggerService.info('WebAppProducts', 'getPotentialProducts', `Found candidate: ${product.cpm_SKU} (${product.cpm_NameHe})`);
          logCount++;
      }

      // Determine display category (Group for wines, mapped name for others)
      let displayCategory = prodGroup;
      if (['3', '5', '9'].includes(prodDiv)) {
          // Reverse lookup for display if possible, or just use Group if it exists?
          // Comax often puts generic names in Group for these.
          // Let's use the requested Category name if it matches, or Group.
          displayCategory = prodGroup || category; 
      }

      potentialProducts.push({
        sku: product.cpm_SKU,
        name: product.cpm_NameHe,
        price: product.cpm_Price,
        stock: stock,
        category: displayCategory
      });
    });

    // Sort by Name
    potentialProducts.sort((a, b) => a.name.localeCompare(b.name));

    // Limit to 100 to prevent payload issues
    return potentialProducts.slice(0, 100);

  } catch (e) {
    LoggerService.error('WebAppProducts', 'getPotentialProducts', `Error: ${e.message}`, e);
    throw e;
  }
}

/**
 * Creates 'New Product' tasks for the selected products.
 *
 * @param {Array<Object>} products List of objects {sku, name}.
 * @returns {Object} Success message.
 */
function WebAppProducts_suggestProducts(products) {
  try {
    if (!products || products.length === 0) {
      throw new Error("No products provided for suggestion.");
    }

    const taskType = 'task.validation.sku_not_in_comax'; // Using a generic type or creating a new one?
    // Re-reading taskDefinitions.json suggests 'task.validation.comax_not_web_product' fits best,
    // OR we can use a generic 'New Product' type if defined.
    // For now, let's use a standard title format that the system recognizes.
    
    // Checking SysTaskTypes...
    // Let's use a generic approach: creating tasks in SysTasks directly via TaskService
    
    const userEmail = Session.getActiveUser().getEmail();
    
    products.forEach(p => {
      TaskService.createTask({
        typeId: 'task.validation.comax_not_web_product', // This seems most appropriate for "Exists in Comax, needs to be on Web"
        topic: 'Products',
        title: `New Product Suggestion: ${p.name}`,
        priority: 'Normal',
        linkedEntityId: p.sku,
        assignedTo: '', // Unassigned initially, or assign to Manager?
        notes: `Suggested by ${userEmail}`
      });
    });

    return { success: true, message: `Successfully suggested ${products.length} products.` };

  } catch (e) {
    LoggerService.error('WebAppProducts', 'suggestProducts', `Error: ${e.message}`, e);
    throw e;
  }
}