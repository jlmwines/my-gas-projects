/**
 * @file WebAppProducts.js
 * @description This file contains functions for the products widget.
 */

/**
 * Gets the counts of various product-related tasks for the Admin Widget.
 * Organized into Detail Updates, New Products, and Other Validations.
 *
 * @returns {object} An object containing the organized counts.
 */
function WebAppProducts_getProductsWidgetData() {
  try {
    const result = {
      detailUpdates: {
        edit: 0,
        review: 0
      },
      newProducts: {
        suggested: 0,
        review: 0
      },
      otherValidations: 0
    };

    const allTasks = WebAppTasks.getOpenTasks();

    if (allTasks && allTasks.length > 0) {
      allTasks.forEach(t => {
        const type = t.st_TaskTypeId;
        const status = t.st_Status;

        // 1. Detail Updates (Vintage Mismatch)
        if (type === 'task.validation.vintage_mismatch') {
          if (status === 'New' || status === 'Assigned') {
            result.detailUpdates.edit++;
          } else if (status === 'Review') {
            result.detailUpdates.review++;
          }
        }
        // 2. New Products
        else if (type === 'task.onboarding.suggestion' && (status === 'New' || status === 'Assigned')) {
          result.newProducts.suggested++;
        }
        else if (type === 'task.onboarding.add_product' && status === 'Review') {
          result.newProducts.review++;
        }
        // 3. Other Validations
        else if (type.startsWith('task.validation.') && type !== 'task.validation.comax_internal_audit') {
           result.otherValidations++;
        }
      });
    }

    return {
      error: null,
      data: result
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
    
    const reviewTasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.vintage_mismatch', 'Review');
    
    LoggerService.info('WebAppProducts', 'getAdminReviewTasks', `Fetched ${reviewTasks.length} review tasks.`);
    
    return reviewTasks.map(t => ({
        taskId: t.st_TaskId,
        sku: t.st_LinkedEntityId,
        productName: t.st_LinkedEntityName,
        title: t.st_Title,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate)
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
    
    const acceptedTasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.vintage_mismatch', 'Accepted');
    
    LoggerService.info('WebAppProducts', 'getAcceptedTasks', `Fetched ${acceptedTasks.length} accepted tasks.`);
    
    return acceptedTasks.map(t => ({
        taskId: t.st_TaskId,
        sku: t.st_LinkedEntityId,
        productName: t.st_LinkedEntityName,
        title: t.st_Title,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate)
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
    LoggerService.info('WebAppProducts', 'getManagerProductTasks', 'Opening SysTasks sheet');
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = SheetAccessor.getDataSheet('SysTasks', false);

    if (!sheet) {
      throw new Error("Sheet 'SysTasks' not found");
    }

    const headers = taskSchema.headers.split(',');
    const typeIdCol = headers.indexOf('st_TaskTypeId');
    const statusCol = headers.indexOf('st_Status');
    const titleCol = headers.indexOf('st_Title');
    const linkedEntityIdCol = headers.indexOf('st_LinkedEntityId');
    const linkedEntityNameCol = headers.indexOf('st_LinkedEntityName');
    const taskIdCol = headers.indexOf('st_TaskId');
    const createdDateCol = headers.indexOf('st_CreatedDate');
    const assignedToCol = headers.indexOf('st_AssignedTo');

    const tasks = [];
    if (sheet.getLastRow() > 1) {
      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      
      existingRows.forEach((row, index) => {
        const taskType = String(row[typeIdCol] || '').trim();
        const status = String(row[statusCol] || '').trim();
        const title = String(row[titleCol] || '');

        // Include vintage_mismatch and onboarding tasks for manager
        const isManagerTask = (taskType === 'task.validation.vintage_mismatch' ||
                               taskType === 'task.onboarding.add_product') &&
                              (status === 'New' || status === 'Assigned' || status === 'In Progress');

        if (isManagerTask) {
          const productName = (linkedEntityNameCol > -1) ? String(row[linkedEntityNameCol]) : '';
          tasks.push({
            taskId: row[taskIdCol],
            sku: row[linkedEntityIdCol],
            productName: productName,
            title: title,
            status: status,
            createdDate: String(row[createdDateCol]),
            assignedTo: row[assignedToCol]
          });
        }
      });
    }

    // Sort by productName
    tasks.sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));

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
    WebAppTasks.invalidateCache();
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


// --- Manager Widget Functions (Re-added) ---

/**
 * Gets the consolidated data for the Manager Products Widget.
 * Aggregates task counts and category health status.
 *
 * @returns {Object} { 
 *   newDetailUpdatesCount: number, 
 *   reviewDetailUpdatesCount: number,
 *   pendingSuggestionsCount: number,
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
      pendingSuggestionsCount: 0, // NEW: Suggestions pending admin approval
      newProductEditsCount: 0,    // NEW: Products needing details from manager
      deficientCategoriesCount: 0,
      deficientCategories: [],
      allCategories: []
    };

    // 1. Fetch Task Counts
    const allTasks = WebAppTasks.getOpenTasks(); 
    
    if (allTasks && allTasks.length > 0) {
      allTasks.forEach(t => {
        const type = t.st_TaskTypeId;
        const status = t.st_Status;
        const title = String(t.st_Title || '').toLowerCase();

        if (type === 'task.validation.vintage_mismatch') {
          if (status === 'New' || status === 'Assigned') {
            result.newDetailUpdatesCount++;
          } else if (status === 'Review') {
            result.reviewDetailUpdatesCount++;
          }
        }
        
        // Suggestions Pending Approval
        if (type === 'task.onboarding.suggestion' && (status === 'New' || status === 'Assigned')) {
             result.pendingSuggestionsCount++;
        }

        // New Products Needing Edits
        if (type === 'task.onboarding.add_product' && status === 'New') {
             result.newProductEditsCount++;
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

                    // Create deficiency task (de-duplication handled by TaskService)
                    try {
                      TaskService.createTask(
                        'task.deficiency.category_stock',
                        rule.category,
                        rule.category,
                        `Low stock: ${rule.category}`,
                        `Category "${rule.category}" has ${currentCount} products (minimum: ${rule.min}).`,
                        null
                      );
                    } catch (taskError) {
                      LoggerService.warn('WebAppProducts', 'getManagerWidgetData', `Could not create deficiency task: ${taskError.message}`);
                    }
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
 * Searches for products by SKU or name across all Comax products.
 * Filters by category if provided, and applies same eligibility criteria as getPotentialProducts.
 *
 * @param {string} searchTerm The search term (SKU or name fragment), minimum 2 characters
 * @param {string} category Optional category filter
 * @returns {Array<Object>} List of matching products {sku, name, price, stock, category}
 */
function WebAppProducts_searchProducts(searchTerm, category) {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const cmxDataMap = ConfigService._getSheetDataAsMap(
      'CmxProdM',
      ConfigService.getConfig('schema.data.CmxProdM').headers.split(','),
      'cpm_CmxId'
    );

    const matchingProducts = [];

    // Helper for strict boolean check
    const isTrue = (val) => {
      const s = String(val || '').trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'כן';
    };

    // Map category to division if applicable
    const divisionMap = {
      'ליקר': '3',
      'אביזרים': '5',
      'פריטי מתנה': '9'
    };
    const targetDivision = category ? (divisionMap[category] || null) : null;

    cmxDataMap.map.forEach(product => {
      // Filter: Not Archived, Not on Web, Has Stock
      const isArchived = String(product.cpm_IsArchived || '').trim();
      if (isArchived !== '') {
        return;
      }

      if (isTrue(product.cpm_IsWeb)) {
        return;
      }

      const stock = parseInt(product.cpm_Stock, 10) || 0;
      if (stock <= 0) {
        return;
      }

      // Category filter (if provided)
      if (category) {
        const prodGroup = String(product.cpm_Group || '').trim();
        const prodDiv = String(product.cpm_Division || '').trim();

        if (targetDivision) {
          // Category is mapped to division
          if (prodDiv !== targetDivision) {
            return;
          }
        } else {
          // Category is a group name
          if (prodGroup !== category) {
            return;
          }
        }
      }

      // Search filter: Match SKU or Name
      const sku = String(product.cpm_SKU || '').toLowerCase();
      const nameHe = String(product.cpm_NameHe || '').toLowerCase();

      if (sku.includes(lowerSearchTerm) || nameHe.includes(lowerSearchTerm)) {
        matchingProducts.push({
          sku: product.cpm_SKU,
          name: product.cpm_NameHe,
          price: product.cpm_Price,
          stock: stock,
          category: product.cpm_Group || category
        });
      }
    });

    // Sort by Name
    matchingProducts.sort((a, b) => a.name.localeCompare(b.name));

    // Limit to 100 to prevent UI overload
    return matchingProducts.slice(0, 100);

  } catch (e) {
    LoggerService.error('WebAppProducts', 'searchProducts', `Error: ${e.message}`, e);
    throw e;
  }
}


/**
 * Gets a list of pending detail tasks (New/Assigned) for the Admin view.
 * @returns {Array<Object>} List of tasks.
 */
function WebAppProducts_getPendingDetailTasks() {
  try {
    const tasks = WebAppTasks.getOpenTasks();
    const pendingTasks = tasks.filter(t => 
      t.st_TaskTypeId === 'task.validation.vintage_mismatch' && 
      (t.st_Status === 'New' || t.st_Status === 'Assigned')
    );
    
    return pendingTasks.map(t => ({
      taskId: t.st_TaskId,
      sku: t.st_LinkedEntityId,
      productName: t.st_LinkedEntityName,
      title: t.st_Title,
      createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate)
    }));
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getPendingDetailTasks', e.message);
    return [];
  }
}

/**
 * Gets a list of pending new product tasks (New/Assigned) for the Admin view.
 * @returns {Array<Object>} List of tasks.
 */
function WebAppProducts_getPendingNewTasks() {
  try {
    const tasks = WebAppTasks.getOpenTasks();
    const pendingTasks = tasks.filter(t => 
      t.st_TaskTypeId === 'task.onboarding.add_product' && 
      (t.st_Status === 'New' || t.st_Status === 'Assigned')
    );
    
    return pendingTasks.map(t => ({
      taskId: t.st_TaskId,
      sku: t.st_LinkedEntityId,
      productName: t.st_LinkedEntityName,
      title: t.st_Title,
      createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate)
    }));
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getPendingNewTasks', e.message);
    return [];
  }
}

/**
 * Gets a list of product suggestion tasks for the admin.
 */
function WebAppProducts_getSuggestionTasks() {
  try {
    const allTasks = WebAppTasks.getOpenTasks();
    // With admin_direct flow, status is 'Assigned' (not 'New') when assigned to admin
    const tasks = allTasks.filter(t =>
        t.st_TaskTypeId === 'task.onboarding.suggestion' &&
        (t.st_Status === 'New' || t.st_Status === 'Assigned')
    );

    return tasks.map(t => {
      const sku = t.st_LinkedEntityId;
      let comax = null;
      try {
        const lookup = ProductService.lookupProductBySku(sku);
        if (lookup && lookup.comax) {
          comax = lookup.comax;
        }
      } catch (e) {
        // Ignore lookup errors - just show task without product details
      }
      return {
        taskId: t.st_TaskId,
        sku: sku,
        title: t.st_Title,
        status: t.st_Status,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate),
        notes: t.st_Notes,
        // Comax product details
        division: comax ? comax.division : '',
        group: comax ? comax.group : '',
        price: comax ? comax.price : '',
        stock: comax ? comax.stock : ''
      };
    });
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getSuggestionTasks', `Error: ${e.message}`, e);
    throw e;
  }
}

/**
 * Gets a list of onboarding tasks ready for review (Status: Review).
 */
function WebAppProducts_getSubmissionsTasks() {
  try {
    const tasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.onboarding.add_product', 'Review');
    
    return tasks.map(t => ({
        taskId: t.st_TaskId,
        sku: t.st_LinkedEntityId,
        productName: t.st_LinkedEntityName,
        title: t.st_Title,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate)
    }));
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getSubmissionsTasks', `Error: ${e.message}`, e);
    throw e;
  }
}

/**
 * Gets a list of onboarding tasks ready for linkage (Status: Accepted).
 */
function WebAppProducts_getLinkageTasks() {
  try {
    const tasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.onboarding.add_product', 'Accepted');
    
    return tasks.map(t => ({
        taskId: t.st_TaskId,
        sku: t.st_LinkedEntityId,
        title: t.st_Title,
        status: t.st_Status,
        createdDate: String(t.st_CreatedDate instanceof Date ? t.st_CreatedDate.toISOString() : t.st_CreatedDate)
    }));
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getLinkageTasks', `Error: ${e.message}`, e);
    throw e;
  }
}

/**
 * Accepts a suggestion and creates the onboarding task.
 */
function WebAppProducts_acceptSuggestion(taskId, sku, nameEn, nameHe) {
    try {
        return ProductService.acceptProductSuggestion(taskId, sku, nameEn, nameHe);
    } catch (e) {
        LoggerService.error('WebAppProducts', 'acceptSuggestion', `Error: ${e.message}`, e);
        throw e;
    }
}

/**
 * Finalizes the new product by linking Woo IDs and hot-inserting.
 */
function WebAppProducts_finalizeProduct(taskId, sku, wooIdEn, wooIdHe) {
    try {
        return ProductService.linkAndFinalizeNewProduct(taskId, sku, wooIdEn, wooIdHe);
    } catch (e) {
        LoggerService.error('WebAppProducts', 'finalizeProduct', `Error: ${e.message}`, e);
        throw e;
    }
}

/**
 * Triggers the export of new products to a Google Sheet.
 */
function WebAppProducts_exportNewProducts() {
    return ProductService.generateNewProductExport();
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

    const userEmail = Session.getActiveUser().getEmail();

    products.forEach(p => {
      TaskService.createTask(
        'task.onboarding.suggestion',
        p.sku,
        p.name,
        `Suggestion: ${p.name}`,
        `Suggested by ${userEmail}`
      );
    });

    return { success: true, message: `Successfully suggested ${products.length} products.` };

  } catch (e) {
    LoggerService.error('WebAppProducts', 'suggestProducts', `Error: ${e.message}`, e);
    throw e;
  }
}

// --- SKU Management Functions ---

/**
 * Performs a vendor SKU update across all product master sheets.
 * @param {string} oldSku The old SKU to replace.
 * @param {string} newSku The new SKU value.
 * @returns {Object} { success: boolean, message: string }
 */
function WebAppProducts_vendorSkuUpdate(oldSku, newSku) {
  try {
    return ProductService.vendorSkuUpdate(oldSku, newSku);
  } catch (e) {
    LoggerService.error('WebAppProducts', 'vendorSkuUpdate', `Error: ${e.message}`, e);
    return { success: false, message: e.message };
  }
}

/**
 * Reassigns a web product to a new Comax SKU, with optional IsWeb flag updates.
 * @param {string} webProductId The WooCommerce Product ID (EN or HE).
 * @param {string} oldSku The old Comax SKU being replaced.
 * @param {string} newSku The new Comax SKU to assign.
 * @param {boolean} updateOldIsWeb If true, set old product's cpm_IsWeb to empty.
 * @param {boolean} updateNewIsWeb If true, set new product's cpm_IsWeb to '1'.
 * @returns {Object} { success: boolean, message: string }
 */
function WebAppProducts_webProductReassign(webProductId, oldSku, newSku, updateOldIsWeb, updateNewIsWeb) {
  try {
    return ProductService.webProductReassign(webProductId, oldSku, newSku, updateOldIsWeb, updateNewIsWeb);
  } catch (e) {
    LoggerService.error('WebAppProducts', 'webProductReassign', `Error: ${e.message}`, e);
    return { success: false, message: e.message };
  }
}

/**
 * Gets recent SKU updates for the audit trail display.
 * @returns {Array<Object>} Array of { date, type, oldSku, newSku, updatedBy }
 */
function WebAppProducts_getRecentSkuUpdates() {
  try {
    return ProductService.getRecentSkuUpdates(10);
  } catch (e) {
    LoggerService.error('WebAppProducts', 'getRecentSkuUpdates', `Error: ${e.message}`, e);
    return [];
  }
}

/**
 * Looks up a product by SKU and returns comprehensive data from both Comax and Web.
 * @param {string} sku The product SKU to lookup.
 * @returns {Object} { comax: {...}, web: {...} | null }
 */
function WebAppProducts_lookupProductBySku(sku) {
  try {
    return ProductService.lookupProductBySku(sku);
  } catch (e) {
    LoggerService.error('WebAppProducts', 'lookupProductBySku', `Error: ${e.message}`, e);
    return null;
  }
}

/**
 * Searches web products (products linked to WooCommerce) by SKU or name.
 * @param {string} searchTerm The search term (min 2 chars).
 * @returns {Array<Object>} Array of { sku, webIdEn, webIdHe, nameEn, nameHe }
 */
function WebAppProducts_searchWebProducts(searchTerm) {
  try {
    return ProductService.searchWebProducts(searchTerm);
  } catch (e) {
    LoggerService.error('WebAppProducts', 'searchWebProducts', `Error: ${e.message}`, e);
    return [];
  }
}

/**
 * Searches Comax products that are NOT linked to web (for replacement).
 * @param {string} searchTerm The search term (min 2 chars).
 * @returns {Array<Object>} Array of { sku, name }
 */
function WebAppProducts_searchProductsForReplacement(searchTerm) {
  try {
    return ProductService.searchProductsForReplacement(searchTerm);
  } catch (e) {
    LoggerService.error('WebAppProducts', 'searchProductsForReplacement', `Error: ${e.message}`, e);
    return [];
  }
}

