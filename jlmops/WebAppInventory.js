/**
 * @file WebAppInventory.js
 * @description This script acts as a Data Provider for all inventory-related data,
 * following the architecture plan.
 */

/**
 * Gets all data required for the Admin Inventory Widget.
 * @param {Object} [injectedSystemHealth] Optional: Pre-calculated system health data to avoid redundant calls.
 * @returns {Object} An object containing counts and tasks for the inventory widget.
 */
function WebAppInventory_getInventoryWidgetData(injectedSystemHealth) {
  try {
    const inventoryManagementService = InventoryManagementService;
    // 1. Get Brurya stats from the backend service
    const bruryaSummary = inventoryManagementService.getBruryaSummaryStatistic();
    LoggerService.info('WebAppInventory', 'getInventoryWidgetData', 'Got Brurya stats.');
    
    // 2. Get task counts from the tasks data provider
    const openNegativeInventoryTasksCount = WebAppTasks.getOpenTasksByTypeId('task.validation.comax_internal_audit').length;
    const openInventoryCountTasksCount = WebAppTasks.getOpenTasksByTypeId('task.inventory.count').length;
    const openInventoryCountReviewTasksCount = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.comax_internal_audit', 'Review').length;
    LoggerService.info('WebAppInventory', 'getInventoryWidgetData', 'Got task counts.');

    // 3. Check for Web Inventory Export tasks
    const webInventoryExportReadyTask = WebAppTasks.getOpenTaskByTypeId('task.export.web_inventory_ready');
    const webInventoryConfirmationTask = WebAppTasks.getOpenTaskByTypeId('task.confirmation.web_inventory_export');
    LoggerService.info('WebAppInventory', 'getInventoryWidgetData', 'Got export tasks.');
    
    // 4. Check System Health for Export Readiness (The "Green Light")
    let isSystemReadyForExport = false;
    try {
        const systemHealth = injectedSystemHealth || WebAppSystem_getSystemHealthDashboardData();
        isSystemReadyForExport = systemHealth.isInventoryExportReady;
        LoggerService.info('WebAppInventory', 'getInventoryWidgetData', `Got system health (Injected: ${!!injectedSystemHealth}). Ready: ${isSystemReadyForExport}`);
    } catch (healthError) {
        LoggerService.warn('WebAppInventory', 'getInventoryWidgetData', `Failed to get system health: ${healthError.message}`);
        // Default to false if health check fails
    }

    // 5. Get Comax Export Data
    const comaxInventoryExportCount = inventoryManagementService.getComaxInventoryExportCount();
    
    // Robust search for the confirmation task
    const allOpenTasks = WebAppTasks.getOpenTasks();
    const openComaxInventoryConfirmationTask = allOpenTasks.find(t => {
        // Find key that matches 'st_TaskTypeId' ignoring whitespace
        const typeKey = Object.keys(t).find(k => k.trim() === 'st_TaskTypeId');
        return typeKey && String(t[typeKey]).trim() === 'task.confirmation.comax_inventory_export';
    });
    
    LoggerService.info('WebAppInventory', 'getInventoryWidgetData', `Comax Confirmation Task found: ${openComaxInventoryConfirmationTask ? 'YES' : 'null'}`);

    // Helper to sanitize task objects for client
    const sanitizeTask = (task) => {
      if (!task) return null;
      // Find keys for ID and Notes robustly
      const idKey = Object.keys(task).find(k => k.trim() === 'st_TaskId');
      const notesKey = Object.keys(task).find(k => k.trim() === 'st_Notes');
      
      return {
        id: (idKey && task[idKey]) ? String(task[idKey]) : '',
        notes: (notesKey && task[notesKey]) ? String(task[notesKey]) : ''
      };
    };

    const cleanExportReadyTask = sanitizeTask(webInventoryExportReadyTask);
    const cleanConfirmationTask = sanitizeTask(webInventoryConfirmationTask);
    const cleanComaxConfirmationTask = sanitizeTask(openComaxInventoryConfirmationTask);

    LoggerService.info('WebAppInventory', 'getInventoryWidgetData', 'Returning data object.');
    return {
      bruryaProductCount: bruryaSummary.productCount,
      bruryaTotalStock: bruryaSummary.totalStock,
      openNegativeInventoryTasksCount: openNegativeInventoryTasksCount,
      openInventoryCountTasksCount: openInventoryCountTasksCount,
      openInventoryCountReviewTasksCount: openInventoryCountReviewTasksCount,
      comaxInventoryExportCount: comaxInventoryExportCount,
      openComaxInventoryConfirmationTask: cleanComaxConfirmationTask,
      webInventoryExportReadyTask: cleanExportReadyTask,
      webInventoryConfirmationTask: cleanConfirmationTask,
      canWebInventoryExport: !webInventoryConfirmationTask && isSystemReadyForExport,
      error: null
    };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getInventoryWidgetData', e.message, e);
    return { error: `Could not load inventory widget data: ${e.message}` };
  }
}

/**
 * Gets data specifically for the Admin Comax Inventory Synchronization card.
 * @returns {Object} An object containing Comax inventory export count and confirmation task.
 */
function WebAppInventory_getAdminComaxSyncData() {
  try {
    const inventoryManagementService = InventoryManagementService;

    // 1. Get Comax Export Data
    const comaxInventoryExportCount = inventoryManagementService.getComaxInventoryExportCount();
    
    // 2. Get Detailed Accepted Tasks for Display
    const acceptedTasks = inventoryManagementService.getAcceptedSyncTasks();

    // Robust search for the confirmation task
    const allOpenTasks = WebAppTasks.getOpenTasks();
    const openComaxInventoryConfirmationTask = allOpenTasks.find(t => {
        // Find key that matches 'st_TaskTypeId' ignoring whitespace
        const typeKey = Object.keys(t).find(k => k.trim() === 'st_TaskTypeId');
        return typeKey && String(t[typeKey]).trim() === 'task.confirmation.comax_inventory_export';
    });
    
    LoggerService.info('WebAppInventory', 'getAdminComaxSyncData', `Comax Confirmation Task found: ${openComaxInventoryConfirmationTask ? 'YES' : 'null'}`);

    // Helper to sanitize task objects for client
    const sanitizeTask = (task) => {
      if (!task) return null;
      const idKey = Object.keys(task).find(k => k.trim() === 'st_TaskId');
      const notesKey = Object.keys(task).find(k => k.trim() === 'st_Notes');
      
      return {
        id: (idKey && task[idKey]) ? String(task[idKey]) : '',
        notes: (notesKey && task[notesKey]) ? String(task[notesKey]) : ''
      };
    };

    const cleanComaxConfirmationTask = sanitizeTask(openComaxInventoryConfirmationTask);

    return {
      comaxInventoryExportCount: comaxInventoryExportCount,
      acceptedTasks: acceptedTasks,
      openComaxInventoryConfirmationTask: cleanComaxConfirmationTask,
      error: null
    };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getAdminComaxSyncData', e.message, e);
    return { error: `Could not load Comax sync data: ${e.message}` };
  }
}

/**
 * Wraps the InventoryManagementService.generateComaxInventoryExport function for client-side access.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_generateComaxInventoryExport() {
  try {
    return InventoryManagementService.generateComaxInventoryExport();
  } catch (error) {
    LoggerService.error('WebAppInventory', 'generateComaxInventoryExport', error.message, error);
    throw error;
  }
}

/**
 * Gets data for the manager inventory view.
 * @returns {Object} An object with inventory data for the manager.
 */
function WebAppInventory_getManagerInventoryData() {
  return { isInventoryCountNeeded: true }; // Placeholder
}

/**
 * Wraps the ProductService.exportWebInventory function so it can be called from the UI.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_exportWebInventory() {
  return ProductService.exportWebInventory();
}

/**
 * Retrieves the full list of Brurya stock for display.
 * @returns {Array<Object>} An array of stock items, each with SKU and quantity.
 */
function WebAppInventory_getBruryaStockList() {
  try {
    const inventoryManagementService = InventoryManagementService;
    return inventoryManagementService.getBruryaStockList();
  } catch (error) {
    LoggerService.error('WebAppInventory', 'getBruryaStockList', error.message, error);
    throw error; // Re-throw to be caught by the client-side failure handler
  }
}

/**
 * Wraps the LookupService.searchComaxProducts function for client-side access.
 * @param {string} searchTerm The term to search for.
 * @returns {Array<Object>} A list of matching products.
 */
function WebAppInventory_searchComaxProducts(searchTerm) {
  try {
    // LookupService is a singleton object, not a class.
    return LookupService.searchComaxProducts(searchTerm);
  } catch (error) {
    LoggerService.error('WebAppInventory', 'searchComaxProducts', error.message, error);
    throw error;
  }
}

/**
 * Wraps the InventoryManagementService.setBruryaQuantity function for client-side access.
 * @param {string} sku The SKU of the product to update.
 * @param {number} quantity The new quantity to set.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_setBruryaQuantity(sku, quantity) {
  try {
    const inventoryManagementService = InventoryManagementService;
    return inventoryManagementService.setBruryaQuantity(sku, quantity);
  } catch (error) {
    LoggerService.error('WebAppInventory', 'setBruryaQuantity', error.message, error);
    throw error;
  }
}

/**
 * Retrieves the number of open inventory count tasks for the current manager.
 * This is used to display a count badge in the Manager's inventory view.
 * @returns {number} The number of open 'task.inventory.count' tasks.
 */
function WebAppInventory_getManagerTaskCount() {
  try {
    // This assumes the task type 'task.inventory.count' corresponds to tasks assigned to managers.
    return WebAppTasks.getOpenTasksByTypeId('task.inventory.count').length;
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getManagerTaskCount', e.message, e);
    return 0; // Return 0 on error to prevent UI issues.
  }
}

/**
 * Retrieves the list of products that a manager needs to count, based on open 'task.inventory.count' tasks.
 * Includes product details (name) and any existing count from SysProductAudit.
 * @param {boolean} [forExport=false] If true, returns audit quantities for Storage, Office, Shop and includes them in totalQty.
 *                                   If false (default), sets Storage, Office, Shop to 0 for initial manager input, and totalQty is only Brurya.
 * @returns {Array<Object>} An array of product objects to count, e.g., [{ taskId, sku, productName, currentCount }]
 */
function WebAppInventory_getProductsForCount(forExport = false) {
  try {
    const allConfig = ConfigService.getAllConfig();

    const cmxProdMHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
    const sysProductAuditHeaders = allConfig['schema.data.SysProductAudit'].headers.split(',');
    
    // Get both types of inventory count tasks
    const inventoryCountTasks = WebAppTasks.getOpenTasksByTypeId('task.inventory.count');
    const negativeInventoryTasks = WebAppTasks.getOpenTasksByTypeId('task.validation.comax_internal_audit');
    
    // Combine the task lists
    const allCountTasks = inventoryCountTasks.concat(negativeInventoryTasks).filter(t => 
      t.st_Status === 'New' || t.st_Status === 'Assigned'
    );
    
    // Load CmxProdM (Comax Product Master) to get stock by SKU
    const cmxProdMData = ConfigService._getSheetDataAsMap('CmxProdM', cmxProdMHeaders, 'cpm_SKU');
    const cmxProdMMap = cmxProdMData.map;

    // Load SysProductAudit to get any existing counts by SKU
    const sysProductAuditData = ConfigService._getSheetDataAsMap('SysProductAudit', sysProductAuditHeaders, 'pa_SKU');
    const sysProductAuditMap = sysProductAuditData.map;

    const productsToCount = allCountTasks.map(task => {
      const sku = String(task.st_LinkedEntityId).trim();
      // Use LinkedEntityName from task if available, otherwise fallback or 'Unknown'
      const productName = task.st_LinkedEntityName || (cmxProdMMap.has(sku) ? cmxProdMMap.get(sku).cpm_NameHe : 'Unknown Product');
      
      if (!task.st_LinkedEntityName && !cmxProdMMap.has(sku)) {
        LoggerService.warn('WebAppInventory', 'getProductsForCount', `SKU from task not found in CmxProdM and no name in task: ${sku}`);
      }

      const auditEntry = sysProductAuditMap.has(sku) ? sysProductAuditMap.get(sku) : {};
      
      const comaxStockFromMaster = cmxProdMMap.has(sku) ? cmxProdMMap.get(sku).cpm_Stock || 0 : 0;
      const bruryaQty = auditEntry.pa_BruryaQty || 0; // BruryaQty should still default to 0 if not present.

      // These should not default to 0 if empty, to distinguish null/uncounted from counted-as-zero.
      const storageQty = auditEntry.pa_StorageQty; 
      const officeQty = auditEntry.pa_OfficeQty;
      const shopQty = auditEntry.pa_ShopQty;
      
      // Calculate total treating nulls as 0
      const totalQty = bruryaQty + (storageQty || 0) + (officeQty || 0) + (shopQty || 0);

      return {
        taskId: task.st_TaskId,
        sku: sku,
        productName: productName,
        comaxQty: comaxStockFromMaster,
        totalQty: totalQty,
        bruryaQty: bruryaQty,
        storageQty: storageQty,
        officeQty: officeQty,
        shopQty: shopQty
      };
    });

    // Sort by product name for consistent display
    productsToCount.sort((a, b) => a.productName.localeCompare(b.productName));

    return productsToCount;
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getProductsForCount', e.message, e);
    return { error: `Could not load products for count: ${e.message}` };
  }
}

/**
 * Submits inventory counts for multiple products and completes their associated tasks.
 * @param {Array<Object>} selectedCounts An array of objects, each containing { taskId, sku, storageQty, officeQty, shopQty }.
 * @returns {Object} A result object indicating success and number of updated items.
 */
function WebAppInventory_submitInventoryCounts(selectedCounts) {
  try {
    const inventoryManagementService = InventoryManagementService;
    let updatedCount = 0;
    
    selectedCounts.forEach(item => {
      // Pass the complete item object including taskId, sku, and all quantities
      const updateResult = inventoryManagementService.updatePhysicalCounts(item);
      if (updateResult.success) {
        TaskService.updateTaskStatus(item.taskId, 'Review'); // Mark the task as 'Review' for admin
        updatedCount++;
      } else {
        LoggerService.warn('WebAppInventory', 'submitInventoryCounts', `Failed to update count for SKU ${item.sku}. Task ${item.taskId} not completed.`);
      }
    });

    // Invalidate task cache after status updates
    if (updatedCount > 0) {
      WebAppTasks.invalidateCache();
    }

    return { success: true, updated: updatedCount };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'submitInventoryCounts', e.message, e);
    throw e;
  }
}

/**
 * Gets all data required for the Admin Inventory View, specifically the tasks for review.
 * @returns {Object} An object containing tasks for review and any errors.
 */
function WebAppInventory_getAdminInventoryViewData() {
  try {
    const allConfig = ConfigService.getAllConfig();

    const cmxProdMHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
    const sysProductAuditHeaders = allConfig['schema.data.SysProductAudit'].headers.split(',');
    
    const reviewTasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.comax_internal_audit', 'Review');
    LoggerService.info('WebAppInventory', 'getAdminInventoryViewData', `Found ${reviewTasks.length} tasks in 'Review' status.`);

    // Fetch Open Tasks for Manager Queue (New & Assigned status)
    const allCountTasks = WebAppTasks.getOpenTasksByTypeId('task.inventory.count');
    const allAuditTasks = WebAppTasks.getOpenTasksByTypeId('task.validation.comax_internal_audit');
    
    // Filter for tasks that are either 'New' or 'Assigned'
    const managerQueueTasks = allCountTasks.concat(allAuditTasks).filter(t => 
      t.st_Status === 'New' || t.st_Status === 'Assigned'
    );
    
    LoggerService.info('WebAppInventory', 'getAdminInventoryViewData', `Found ${managerQueueTasks.length} tasks for manager queue (New/Assigned).`);
    
    const cmxProdMData = ConfigService._getSheetDataAsMap('CmxProdM', cmxProdMHeaders, 'cpm_SKU');
    const cmxProdMMap = cmxProdMData.map;

    const sysProductAuditData = ConfigService._getSheetDataAsMap('SysProductAudit', sysProductAuditHeaders, 'pa_SKU');
    const sysProductAuditMap = sysProductAuditData.map;

    LoggerService.info('WebAppInventory', 'getAdminInventoryViewData', 'Starting to process review tasks...');

    const tasksForReview = reviewTasks.map(task => {
      const sku = String(task.st_LinkedEntityId).trim();
      const productName = task.st_LinkedEntityName || (cmxProdMMap.has(sku) ? cmxProdMMap.get(sku).cpm_NameHe : 'Unknown Product');
      
      if (!task.st_LinkedEntityName && !cmxProdMMap.has(sku)) {
        LoggerService.warn('WebAppInventory', 'getAdminInventoryViewData', `SKU from task not found in CmxProdM and no name in task: ${sku}`);
      }

      const auditEntry = sysProductAuditMap.has(sku) ? sysProductAuditMap.get(sku) : {};
      
      const comaxStockFromMaster = cmxProdMMap.has(sku) ? cmxProdMMap.get(sku).cpm_Stock || 0 : 0;
      const bruryaQty = auditEntry.pa_BruryaQty || 0;
      const storageQty = auditEntry.pa_StorageQty || 0;
      const officeQty = auditEntry.pa_OfficeQty || 0;
      const shopQty = auditEntry.pa_ShopQty || 0;

      const totalQty = bruryaQty + storageQty + officeQty + shopQty;

      return {
        taskId: task.st_TaskId,
        sku: sku,
        productName: productName,
        comaxQty: comaxStockFromMaster,
        totalQty: totalQty,
        bruryaQty: bruryaQty,
        storageQty: storageQty,
        officeQty: officeQty,
        shopQty: shopQty
      };
    });

    tasksForReview.sort((a, b) => a.productName.localeCompare(b.productName));
    LoggerService.info('WebAppInventory', 'getAdminInventoryViewData', 'Finished processing review tasks. Starting open tasks...');

    // Process Open Tasks for Manager Queue
    const openTasks = managerQueueTasks.map(task => {
       let dateStr = '';
       if (task.st_CreatedDate instanceof Date) {
         dateStr = task.st_CreatedDate.toISOString();
       } else {
         dateStr = String(task.st_CreatedDate);
       }

       const productName = task.st_LinkedEntityName || 'Unknown Product'; // Use LinkedEntityName

       return {
         taskId: task.st_TaskId,
         title: task.st_Title,
         productName: productName, // New: Add product name
         sku: task.st_LinkedEntityId, // New: Add SKU/LinkedEntityId
         createdDate: dateStr
       };
    });
    
    // Sort open tasks by product name
    openTasks.sort((a, b) => a.productName.localeCompare(b.productName));
    
    LoggerService.info('WebAppInventory', 'getAdminInventoryViewData', 'Finished processing open tasks (Enhanced).');

    return {
      reviewTasks: tasksForReview,
      openTasks: openTasks
    };

  } catch (e) {
    LoggerService.error('WebAppInventory', 'getAdminInventoryViewData', e.message, e);
    return { error: `Could not load data for Admin Inventory View: ${e.message}` };
  }
}

/**
 * Accepts and completes a list of inventory count review tasks.
 * @param {Array<string>} taskIds An array of task IDs to be completed.
 * @returns {Object} A result object indicating success and the number of tasks processed.
 */
function WebAppInventory_acceptInventoryCounts(taskIds) {
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return { success: false, message: 'No task IDs provided.' };
  }
  try {
    let completedCount = 0;
    for (const taskId of taskIds) {
      try {
        const task = WebAppTasks.getTaskById(taskId);
        if (!task || !task.st_LinkedEntityId) {
          LoggerService.warn('WebAppInventory', 'acceptInventoryCounts', `Task ${taskId} not found or missing LinkedEntityId.`);
          continue; // Skip to next task
        }
        const sku = task.st_LinkedEntityId;

        // Update pa_LastCount in SysProductAudit
        InventoryManagementService.updateLastCount(sku, new Date());

        // Update task status to 'Accepted' so it is picked up by the export workflow
        TaskService.updateTaskStatus(taskId, 'Accepted');
        completedCount++;
      } catch (innerError) {
        LoggerService.error('WebAppInventory', 'acceptInventoryCounts', `Error processing task ${taskId}: ${innerError.message}`, innerError);
        // Continue to process other tasks even if one fails
      }
    }
    SpreadsheetApp.flush();

    // Invalidate task cache after status updates
    if (completedCount > 0) {
      WebAppTasks.invalidateCache();
    }

    return { success: true, completed: completedCount };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'acceptInventoryCounts', e.message, e);
    throw e;
  }
}

/**
 * Wraps the InventoryManagementService.updateBruryaInventory function for client-side access.
 * @param {Array<Object>} inventoryData The inventory data to save.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_updateBruryaInventory(inventoryData) {
  try {
    const inventoryManagementService = InventoryManagementService;
    return inventoryManagementService.updateBruryaInventory(inventoryData);
  } catch (error) {
    LoggerService.error('WebAppInventory', 'updateBruryaInventory', error.message, error);
    throw error;
  }
}

/**
 * Wraps the InventoryManagementService.previewBulkCountTasks function.
 * @param {Object} formObject The form data from the client.
 * @returns {Object} Result object { success: true, count: number }.
 */
function WebAppInventory_previewBulkTasks(formObject) {
  try {
    const criteria = {
      daysSinceLastCount: formObject.days ? parseInt(formObject.days, 10) : null,
      maxStockLevel: formObject.stock ? parseInt(formObject.stock, 10) : null,
      isWebOnly: formObject.webOnly,
      isWineOnly: formObject.wineOnly,
      includeZeroStock: formObject.zeroStock
    };
    
    return InventoryManagementService.previewBulkCountTasks(criteria);
  } catch (e) {
    LoggerService.error('WebAppInventory', 'previewBulkTasks', e.message, e);
    throw e;
  }
}

/**
 * Wraps the InventoryManagementService.generateBulkCountTasks function.
 * @param {Object} formObject The form data from the client.
 * @returns {Object} Result object { success: true, count: number }.
 */
function WebAppInventory_generateBulkTasks(formObject) {
  try {
    const criteria = {
      daysSinceLastCount: formObject.days ? parseInt(formObject.days, 10) : null,
      maxStockLevel: formObject.stock ? parseInt(formObject.stock, 10) : null,
      isWebOnly: formObject.webOnly,
      isWineOnly: formObject.wineOnly,
      includeZeroStock: formObject.zeroStock
    };
    
    return InventoryManagementService.generateBulkCountTasks(criteria);
  } catch (e) {
    LoggerService.error('WebAppInventory', 'generateBulkTasks', e.message, e);
    throw e;
  }
}

/**
 * Wraps the InventoryManagementService.createSpotCheckTask function.
 * @param {string} sku The SKU.
 * @param {string} note Optional note.
 * @returns {Object} Result object { success: true, taskId: string }.
 */
function WebAppInventory_createSpotCheckTask(sku, note) {
  try {
    return InventoryManagementService.createSpotCheckTask(sku, note);
  } catch (e) {
     LoggerService.error('WebAppInventory', 'createSpotCheckTask', e.message, e);
     throw e;
  }
}

/**
 * Exports the current list of products awaiting count to a new Google Sheet.
 * The new sheet will have a specific naming convention and pre-populated headers.
 *
 * @returns {string} The URL of the newly created Google Sheet.
 */
function WebAppInventory_exportCountsToSheet() {
  try {
    // Use false to get data for UI display (reset user inputs), 
    // as we want the export sheet to be a blank slate for new counts, just like the UI.
    const productsToCount = WebAppInventory_getProductsForCount(false);

    if (productsToCount.error) {
      throw new Error(productsToCount.error);
    }
    
    if (productsToCount.length === 0) {
      throw new Error('No products available for export.');
    }

    const config = ConfigService.getConfig('system.folder.jlmops_exports');
    const inventoryFolderId = config ? config.id : null;
    if (!inventoryFolderId) {
      throw new Error('Inventory exports folder ID (inventory.exports.folder_id) not configured in SysConfig.');
    }

    const folder = DriveApp.getFolderById(inventoryFolderId);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
    const sheetName = `ProductCount_${timestamp}`;

    const newSpreadsheet = SpreadsheetApp.create(sheetName);
    const sheet = newSpreadsheet.getSheets()[0]; // Get the first sheet

    // Set headers with Total Count
    const headers = [
      "SKU", 
      "Product Name", 
      "Comax Quantity", 
      "Brurya Quantity", 
      "Storage Quantity", 
      "Office Quantity", 
      "Shop Quantity", 
      "Total Count",  // New Column
      "Comments", 
      "Task ID"
    ];
    sheet.appendRow(headers);

    // Populate data
    const data = productsToCount.map((product, index) => {
      const rowNum = index + 2; // Data starts at row 2
      return [
        product.sku,
        product.productName,
        product.comaxQty,
        product.bruryaQty,
        product.storageQty, // WIP Value
        product.officeQty,  // WIP Value
        product.shopQty,    // WIP Value
        `=D${rowNum}+E${rowNum}+F${rowNum}+G${rowNum}`, // Formula: Brurya + Storage + Office + Shop
        '', // Comments - Empty for input
        product.taskId // Task ID
      ];
    });
    
    // Write data starting at row 2
    const dataRange = sheet.getRange(2, 1, data.length, data[0].length);
    dataRange.setValues(data);

    // Formatting
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    
    // Highlight Input Columns (Optional but helpful: Light Yellow)
    const inputColor = '#FFF2CC';
    const storageCol = sheet.getRange(2, 5, data.length, 3); // Cols E, F, G
    storageCol.setBackground(inputColor);
    const commentsCol = sheet.getRange(2, 9, data.length, 1); // Col I
    commentsCol.setBackground(inputColor);
    
    // Bold the Total Column
    const totalCol = sheet.getRange(2, 8, data.length, 1); // Col H
    totalCol.setFontWeight('bold');

    // --- Protection Logic ---
    // 1. Protect the entire sheet first
    const protection = sheet.protect().setDescription('System Data - Do Not Edit Locked Fields');
    
    // 2. Define the ranges for User Input
    // Range 1: Storage, Office, Shop (Cols 5, 6, 7)
    const inputRange1 = sheet.getRange(2, 5, data.length, 3);
    // Range 2: Comments (Col 9)
    const inputRange2 = sheet.getRange(2, 9, data.length, 1);
    
    // 3. Set unprotected ranges
    protection.setUnprotectedRanges([inputRange1, inputRange2]);

    // Move the new spreadsheet to the designated folder
    const file = DriveApp.getFileById(newSpreadsheet.getId());
    file.moveTo(folder);

    LoggerService.info('WebAppInventory', 'exportCountsToSheet', `Exported ${productsToCount.length} products to sheet: ${newSpreadsheet.getUrl()}`);
    return newSpreadsheet.getUrl();

  } catch (e) {
    LoggerService.error('WebAppInventory', 'exportCountsToSheet', e.message, e);
    throw e;
  }
}

/**
 * Imports inventory counts from a specified Google Sheet.
 * Expected sheet format: Headers "SKU", "Storage Quantity", "Office Quantity", "Shop Quantity", "Task ID".
 *
 * @param {string} [sheetIdOrUrl] The ID or URL of the Google Sheet to import from. If omitted, finds the latest export.
 * @returns {Object} An object indicating success, updated count, and any errors.
 */
function WebAppInventory_importCountsFromSheet(sheetIdOrUrl) {
  try {
    let ss;
    
    // 1. Auto-discover latest sheet if no ID provided
    if (!sheetIdOrUrl) {
        const config = ConfigService.getConfig('system.folder.jlmops_exports');
        const inventoryFolderId = config ? config.id : null;
        if (!inventoryFolderId) {
            throw new Error('Inventory exports folder not configured.');
        }
        const folder = DriveApp.getFolderById(inventoryFolderId);
        const files = folder.getFiles();
        let latestFile = null;
        
        while (files.hasNext()) {
            const file = files.next();
            if (file.getName().startsWith('ProductCount_') && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
                if (!latestFile || file.getDateCreated() > latestFile.getDateCreated()) {
                    latestFile = file;
                }
            }
        }
        
        if (!latestFile) {
            throw new Error('No "ProductCount_" sheets found in the export folder.');
        }
        ss = SpreadsheetApp.open(latestFile);
        LoggerService.info('WebAppInventory', 'importCountsFromSheet', `Auto-selected latest sheet: ${latestFile.getName()}`);
    } else {
        // Existing logic for provided ID/URL
        try {
          if (sheetIdOrUrl.startsWith('https://docs.google.com/spreadsheets/d/')) {
            const match = sheetIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (!match) throw new Error('Invalid Google Sheet URL.');
            ss = SpreadsheetApp.openById(match[1]);
          } else {
            ss = SpreadsheetApp.openById(sheetIdOrUrl);
          }
        } catch (e) {
          throw new Error(`Could not open spreadsheet. Please check the ID/URL: ${e.message}`);
        }
    }

    const sheet = ss.getSheets()[0];
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length < 2) {
      throw new Error('Sheet is empty or only contains headers.');
    }

    const headers = values[0];
    const dataRows = values.slice(1);

    const skuCol = headers.indexOf("SKU");
    const storageCol = headers.indexOf("Storage Quantity");
    const officeCol = headers.indexOf("Office Quantity");
    const shopCol = headers.indexOf("Shop Quantity");
    const taskIdCol = headers.indexOf("Task ID");

    if (skuCol === -1 || taskIdCol === -1 || storageCol === -1 || officeCol === -1 || shopCol === -1) {
      throw new Error('Missing one or more required headers: SKU, Storage Quantity, Office Quantity, Shop Quantity, Task ID.');
    }

    const inventoryManagementService = InventoryManagementService;
    let updatedCount = 0;
    const errors = [];

    // --- Validation: Pre-fetch allowed tasks ---
    // Only allow updates for tasks in 'New' or 'Assigned' status.
    // This prevents overwriting data for tasks that are already in 'Review' or 'Done'.
    const openTasks = WebAppTasks.getOpenTasks();
    const allowedTaskIds = new Set();
    
    openTasks.forEach(t => {
        if (t.st_Status === 'New' || t.st_Status === 'Assigned') {
            allowedTaskIds.add(String(t.st_TaskId).trim());
        }
    });
    // -------------------------------------------

    dataRows.forEach((row, index) => {
      // 2. Check for "Unchanged" rows (all input fields are empty strings)
      const rawStorage = row[storageCol];
      const rawOffice = row[officeCol];
      const rawShop = row[shopCol];

      if (rawStorage === "" && rawOffice === "" && rawShop === "") {
          // Skip this row as the user entered no data
          return;
      }

      const sku = String(row[skuCol]).trim();
      const taskId = String(row[taskIdCol]).trim();
      
      // Treat empty strings as null, otherwise parse as integer
      const storageQty = rawStorage === "" ? null : parseInt(rawStorage, 10);
      const officeQty = rawOffice === "" ? null : parseInt(rawOffice, 10);
      const shopQty = rawShop === "" ? null : parseInt(rawShop, 10);

      if (!sku || !taskId) {
        errors.push(`Row ${index + 2}: SKU or Task ID missing.`);
        return;
      }

      // --- Validation Check ---
      if (!allowedTaskIds.has(taskId)) {
          errors.push(`Row ${index + 2}: Task is not active (Status must be 'New' or 'Assigned'). Skipping.`);
          return;
      }
      // ------------------------
      
      // Validate only if not null (null is valid for clearing)
      if ((storageQty !== null && isNaN(storageQty)) || 
          (officeQty !== null && isNaN(officeQty)) || 
          (shopQty !== null && isNaN(shopQty))) {
        errors.push(`Row ${index + 2}: Invalid quantity for SKU ${sku}.`);
        return;
      }

      try {
        const item = { taskId, sku, storageQty, officeQty, shopQty }; // Comax Stock is not imported here, only physical counts
        const updateResult = inventoryManagementService.updatePhysicalCounts(item);
        if (updateResult.success) {
          // Task status is NOT updated here. Import is just data entry.
          updatedCount++;
        } else {
          errors.push(`Row ${index + 2}: Failed to update for SKU ${sku}. Message: ${updateResult.message}`);
        }
      } catch (innerE) {
        errors.push(`Row ${index + 2}: Error processing SKU ${sku}: ${innerE.message}`);
        LoggerService.error('WebAppInventory', 'importCountsFromSheet', `Error for SKU ${sku} at row ${index + 2}: ${innerE.message}`, innerE);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Import completed with ${updatedCount} updates and ${errors.length} errors. First error: ${errors[0]}`);
    }

    SpreadsheetApp.flush();
    LoggerService.info('WebAppInventory', 'importCountsFromSheet', `Successfully imported counts. Updated ${updatedCount} items.`);
    return { success: true, updated: updatedCount, message: `Successfully imported ${updatedCount} counts.` };

  } catch (e) {
    LoggerService.error('WebAppInventory', 'importCountsFromSheet', e.message, e);
    return { success: false, message: `Error importing counts: ${e.message}` };
  }
}

/**
 * Exports Brurya inventory to a new Google Sheet for mobile editing.
 * Includes all products with Brurya stock plus option to add new SKUs.
 * @returns {string} The URL of the newly created Google Sheet.
 */
function WebAppInventory_exportBruryaToSheet() {
  const fnName = 'exportBruryaToSheet';
  try {
    const inventoryManagementService = InventoryManagementService;
    // Get current Brurya stock
    const bruryaStock = inventoryManagementService.getBruryaStockList();

    const config = ConfigService.getConfig('system.folder.jlmops_exports');
    const exportFolderId = config ? config.id : null;
    if (!exportFolderId) {
      throw new Error('Export folder not configured (system.folder.jlmops_exports).');
    }

    const folder = DriveApp.getFolderById(exportFolderId);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
    const sheetName = `BruryaCount_${timestamp}`;

    const newSpreadsheet = SpreadsheetApp.create(sheetName);
    const sheet = newSpreadsheet.getSheets()[0];

    // Headers
    const headers = ['SKU', 'Product Name', 'Current Qty', 'New Qty'];
    sheet.appendRow(headers);

    // Populate with current Brurya stock
    if (bruryaStock.length > 0) {
      const data = bruryaStock.map(item => [
        item.sku,
        item.Name || '',
        item.bruryaQty || 0,
        '' // New Qty - empty for input
      ]);
      sheet.getRange(2, 1, data.length, 4).setValues(data);
    }

    // Add 20 blank rows for new SKUs
    const startRow = bruryaStock.length + 2;
    const blankRows = Array(20).fill(['', '', '', '']);
    sheet.getRange(startRow, 1, 20, 4).setValues(blankRows);

    // Formatting
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 4);

    // Highlight input columns (New Qty and blank SKU rows)
    const inputColor = '#FFF2CC';
    const newQtyRange = sheet.getRange(2, 4, bruryaStock.length + 20, 1); // Col D
    newQtyRange.setBackground(inputColor);

    // Highlight blank rows for new SKUs
    if (bruryaStock.length > 0) {
      const blankRowsRange = sheet.getRange(startRow, 1, 20, 4);
      blankRowsRange.setBackground('#E8F5E9'); // Light green for new entries
    }

    // Protection - protect columns A-C for existing rows, allow D and new rows
    const protection = sheet.protect().setDescription('Brurya Inventory - Edit New Qty or Add New SKUs');
    const unprotectedRanges = [
      sheet.getRange(2, 4, bruryaStock.length + 20, 1), // New Qty column
      sheet.getRange(startRow, 1, 20, 4) // New SKU rows
    ];
    protection.setUnprotectedRanges(unprotectedRanges);

    // Move to export folder
    const file = DriveApp.getFileById(newSpreadsheet.getId());
    file.moveTo(folder);

    LoggerService.info('WebAppInventory', fnName, `Exported ${bruryaStock.length} Brurya products to sheet: ${newSpreadsheet.getUrl()}`);
    return newSpreadsheet.getUrl();

  } catch (e) {
    LoggerService.error('WebAppInventory', fnName, e.message, e);
    throw e;
  }
}

/**
 * Imports Brurya inventory from a Google Sheet.
 * Updates existing SKUs and creates new entries for new SKUs (if found in CmxProdM).
 * @param {string} [sheetIdOrUrl] Sheet ID or URL. If omitted, finds latest BruryaCount_* file.
 * @returns {Object} Result with counts of updates, creates, and errors.
 */
function WebAppInventory_importBruryaFromSheet(sheetIdOrUrl) {
  const fnName = 'importBruryaFromSheet';
  try {
    const inventoryManagementService = InventoryManagementService;
    let ss;

    if (!sheetIdOrUrl) {
      // Auto-discover latest BruryaCount_* file
      const config = ConfigService.getConfig('system.folder.jlmops_exports');
      const exportFolderId = config ? config.id : null;
      if (!exportFolderId) {
        throw new Error('Export folder not configured.');
      }

      const folder = DriveApp.getFolderById(exportFolderId);
      const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

      let latestFile = null;
      let latestDate = new Date(0);

      while (files.hasNext()) {
        const file = files.next();
        if (file.getName().startsWith('BruryaCount_')) {
          const fileDate = file.getLastUpdated();
          if (fileDate > latestDate) {
            latestFile = file;
            latestDate = fileDate;
          }
        }
      }

      if (!latestFile) {
        throw new Error('No BruryaCount_* file found in export folder.');
      }

      ss = SpreadsheetApp.openById(latestFile.getId());
      LoggerService.info('WebAppInventory', fnName, `Auto-discovered file: ${latestFile.getName()}`);
    } else {
      // Parse sheet ID from URL if needed
      let sheetId = sheetIdOrUrl;
      if (sheetIdOrUrl.includes('/')) {
        const match = sheetIdOrUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) sheetId = match[1];
      }
      ss = SpreadsheetApp.openById(sheetId);
    }

    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return { success: true, updated: 0, created: 0, message: 'Sheet is empty.' };
    }

    const headers = data[0];
    const skuCol = headers.indexOf('SKU');
    const newQtyCol = headers.indexOf('New Qty');

    if (skuCol === -1 || newQtyCol === -1) {
      throw new Error('Required columns not found. Expected: SKU, New Qty');
    }

    let updated = 0;
    let created = 0;
    const errors = [];
    const dataRows = data.slice(1);

    dataRows.forEach((row, index) => {
      const rowNum = index + 2;
      const sku = String(row[skuCol] || '').trim();
      const newQtyRaw = row[newQtyCol];

      // Skip if no SKU or New Qty is empty string (user didn't enter data)
      if (!sku || newQtyRaw === '') {
        return;
      }

      const newQty = parseInt(newQtyRaw, 10);
      if (isNaN(newQty) || newQty < 0) {
        errors.push(`Row ${rowNum}: Invalid quantity for SKU ${sku}`);
        return;
      }

      try {
        const result = inventoryManagementService.setBruryaQuantity(sku, newQty);
        if (result.action === 'updated') {
          updated++;
        } else if (result.action === 'created') {
          created++;
        }
      } catch (itemError) {
        errors.push(`Row ${rowNum}: ${itemError.message}`);
      }
    });

    // Update last Brurya update timestamp
    if (updated > 0 || created > 0) {
      ConfigService.setConfig('system.brurya.last_update', new Date().toISOString());
    }

    const message = `Brurya import complete: ${updated} updated, ${created} created.`;
    LoggerService.info('WebAppInventory', fnName, message);

    if (errors.length > 0) {
      return {
        success: true,
        updated,
        created,
        errors: errors.length,
        message: `${message} ${errors.length} errors. First: ${errors[0]}`
      };
    }

    return { success: true, updated, created, message };

  } catch (e) {
    LoggerService.error('WebAppInventory', fnName, e.message, e);
    return { success: false, message: `Error importing Brurya: ${e.message}` };
  }
}
