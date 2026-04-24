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
    const openInventoryCountReviewTasksCount =
      WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.comax_internal_audit', 'Review').length +
      WebAppTasks.getOpenTasksByTypeIdAndStatus('task.inventory.count', 'Review').length;
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
    const webProdMHeaders = allConfig['schema.data.WebProdM'].headers.split(',');

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

    // Load WebProdM for image + page URL (joined by SKU)
    const webProdMData = ConfigService._getSheetDataAsMap('WebProdM', webProdMHeaders, 'wpm_SKU');
    const webProdMMap = webProdMData.map;

    const productsToCount = allCountTasks.map(task => {
      const sku = String(task.st_LinkedEntityId).trim();
      const cmxRow = cmxProdMMap.get(sku);
      // Use LinkedEntityName from task if available, otherwise fallback or 'Unknown'
      const productName = task.st_LinkedEntityName || (cmxRow ? cmxRow.cpm_NameHe : 'Unknown Product');

      if (!task.st_LinkedEntityName && !cmxRow) {
        LoggerService.warn('WebAppInventory', 'getProductsForCount', `SKU from task not found in CmxProdM and no name in task: ${sku}`);
      }

      const auditEntry = sysProductAuditMap.has(sku) ? sysProductAuditMap.get(sku) : {};
      const webRow = webProdMMap.get(sku);

      const comaxStockFromMaster = cmxRow ? (cmxRow.cpm_Stock || 0) : 0;
      const bruryaQty = auditEntry.pa_BruryaQty || 0; // BruryaQty should still default to 0 if not present.

      // These should not default to 0 if empty, to distinguish null/uncounted from counted-as-zero.
      const storageQty = auditEntry.pa_StorageQty;
      const officeQty = auditEntry.pa_OfficeQty;
      const shopQty = auditEntry.pa_ShopQty;

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
        shopQty: shopQty,
        vintage: cmxRow ? (cmxRow.cpm_Vintage || '') : '',
        pageUrl: webRow ? (webRow.wpm_ProductPageUrl || '') : '',
        imageUrl: webRow ? (webRow.wpm_Images || '') : ''
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
    let vintageTasksCreated = 0;

    selectedCounts.forEach(item => {
      const updateResult = inventoryManagementService.updatePhysicalCounts(item);
      if (updateResult.success) {
        TaskService.updateTaskStatus(item.taskId, 'Review');
        updatedCount++;
      } else {
        LoggerService.warn('WebAppInventory', 'submitInventoryCounts', `Failed to update count for SKU ${item.sku}. Task ${item.taskId} not completed.`);
        return;
      }

      const vintageActual = item.vintageActual ? String(item.vintageActual).trim() : '';
      const vintageRef = item.vintageRef ? String(item.vintageRef).trim() : '';
      const comment = item.comment ? String(item.comment).trim() : '';
      const vintageMismatch = vintageActual && vintageActual !== vintageRef;

      if (vintageMismatch || comment) {
        let note;
        if (vintageMismatch && comment) {
          note = `Update Comax vintage to ${vintageActual}. ${comment}`;
        } else if (vintageMismatch) {
          note = `Update Comax vintage to ${vintageActual}`;
        } else {
          note = comment;
        }
        try {
          TaskService.createTask(
            'task.validation.vintage_mismatch',
            item.sku,
            item.productName || '',
            'Vintage Update (Count)',
            note,
            null,
            { allowDuplicate: true }
          );
          vintageTasksCreated++;
        } catch (tErr) {
          LoggerService.error('WebAppInventory', 'submitInventoryCounts', `Vintage task create failed for ${item.sku}: ${tErr.message}`, tErr);
        }
      }
    });

    if (updatedCount > 0) {
      WebAppTasks.invalidateCache();
    }

    return { success: true, updated: updatedCount, vintageTasksCreated: vintageTasksCreated };
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
    
    const reviewTasks = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.comax_internal_audit', 'Review')
      .concat(WebAppTasks.getOpenTasksByTypeIdAndStatus('task.inventory.count', 'Review'));
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

       const sku = String(task.st_LinkedEntityId || '').trim();
       const productName = task.st_LinkedEntityName || (cmxProdMMap.has(sku) ? cmxProdMMap.get(sku).cpm_NameHe : 'Unknown Product');
       const auditEntry = sysProductAuditMap.has(sku) ? sysProductAuditMap.get(sku) : {};
       const bruryaQty = auditEntry.pa_BruryaQty || 0;
       const storageQty = auditEntry.pa_StorageQty || 0;
       const officeQty = auditEntry.pa_OfficeQty || 0;
       const shopQty = auditEntry.pa_ShopQty || 0;
       const totalQty = bruryaQty + storageQty + officeQty + shopQty;

       return {
         taskId: task.st_TaskId,
         title: task.st_Title,
         productName: productName,
         sku: sku,
         totalQty: totalQty,
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
 * Also updates the last update timestamp and closes any open Brurya reminder task.
 * @param {Array<Object>} inventoryData The inventory data to save.
 * @returns {Object} A result object from the service.
 */
function WebAppInventory_updateBruryaInventory(inventoryData) {
  try {
    const inventoryManagementService = InventoryManagementService;
    const result = inventoryManagementService.updateBruryaInventory(inventoryData);

    // If quantities were updated, also update timestamp and close task
    if (result.success && result.updated > 0) {
      // Update last update timestamp
      ConfigService.setConfig('system.brurya.last_update', 'value', new Date().toISOString());

      // Close any open brurya update task
      try {
        TaskService.completeTaskByTypeAndEntity('task.inventory.brurya_update', 'BRURYA');
      } catch (taskErr) {
        // No task to close - that's fine
      }

      LoggerService.info('WebAppInventory', 'updateBruryaInventory',
        `Updated ${result.updated} items, timestamp updated, task closed.`);
    }

    return result;
  } catch (error) {
    LoggerService.error('WebAppInventory', 'updateBruryaInventory', error.message, error);
    throw error;
  }
}

/**
 * Wraps InventoryManagementService.createCountTasksBulk. Client passes a
 * pre-filtered list of SKUs and an optional note.
 * @param {Array<string>} skus
 * @param {string} [note]
 */
function WebAppInventory_createCountTasksBulk(skus, note) {
  try {
    return InventoryManagementService.createCountTasksBulk(skus, note);
  } catch (e) {
    LoggerService.error('WebAppInventory', 'createCountTasksBulk', e.message, e);
    throw e;
  }
}

/**
 * Returns a single payload for the Admin Inventory view's count task
 * planning card: every non-archived CmxProdM product joined with its
 * SysProductAudit last-count date, open-count-task flag, and WebProdM
 * image/permalink where available. All filtering, sorting, and preview
 * limiting happens client-side on this array.
 */
function WebAppInventory_getCountPlanningData() {
  try {
    const allConfig = ConfigService.getAllConfig();

    const cmxHeaders = allConfig['schema.data.CmxProdM'].headers.split(',');
    const auditHeaders = allConfig['schema.data.SysProductAudit'].headers.split(',');
    const webHeaders = allConfig['schema.data.WebProdM'].headers.split(',');

    const cmxObj = ConfigService._getSheetDataAsMap('CmxProdM', cmxHeaders, 'cpm_SKU');
    const auditObj = ConfigService._getSheetDataAsMap('SysProductAudit', auditHeaders, 'pa_SKU');
    const webObj = ConfigService._getSheetDataAsMap('WebProdM', webHeaders, 'wpm_SKU');

    const openCountSkus = new Set(
      WebAppTasks.getOpenTasksByTypeId('task.inventory.count')
        .map(t => String(t.st_LinkedEntityId || '').trim())
    );

    const products = [];
    const cmxRows = cmxObj.map.values();
    for (const row of cmxRows) {
      const isArchived = String(row.cpm_IsArchived || '').trim() === 'כן';
      if (isArchived) continue;

      const sku = String(row.cpm_SKU || '').trim();
      if (!sku) continue;

      const audit = auditObj.map.get(sku);
      const web = webObj.map.get(sku);

      let lastCountIso = null;
      if (audit && audit.pa_LastCount) {
        const lc = new Date(audit.pa_LastCount);
        if (!isNaN(lc.getTime())) lastCountIso = lc.toISOString();
      }

      products.push({
        sku: sku,
        nameHe: row.cpm_NameHe || '',
        stock: (row.cpm_Stock === '' || row.cpm_Stock === null || row.cpm_Stock === undefined)
          ? null
          : parseFloat(row.cpm_Stock),
        isWeb: String(row.cpm_IsWeb || '').trim() === 'כן',
        isWine: String(row.cpm_Division || '').trim() === '1',
        vintage: row.cpm_Vintage || '',
        vendor: row.cpm_Vendor || '',
        brand: row.cpm_Brand || '',
        lastCount: lastCountIso,
        pageUrl: web ? (web.wpm_ProductPageUrl || '') : '',
        imageUrl: web ? (web.wpm_Images || '') : '',
        hasOpenTask: openCountSkus.has(sku)
      });
    }

    products.sort((a, b) => (a.nameHe || '').localeCompare(b.nameHe || ''));

    return {
      products: products,
      loadedAt: new Date().toISOString()
    };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getCountPlanningData', e.message, e);
    return { error: `Could not load count planning data: ${e.message}` };
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

    // Column layout (1-indexed):
    //  A SKU   B Product Name   C Vintage (ref)   D Product Page
    //  E Comax Qty   F Brurya Qty   G Storage Qty   H Office Qty   I Shop Qty
    //  J Total Count   K Vintage (actual)   L Comments   M Task ID
    const headers = [
      "SKU",
      "Product Name",
      "Vintage",
      "Product Page",
      "Comax Quantity",
      "Brurya Quantity",
      "Storage Quantity",
      "Office Quantity",
      "Shop Quantity",
      "Total Count",
      "Vintage (actual)",
      "Comments",
      "Task ID"
    ];
    sheet.appendRow(headers);

    const data = productsToCount.map((product, index) => {
      const rowNum = index + 2;
      const pageCell = product.pageUrl
        ? `=HYPERLINK("${String(product.pageUrl).replace(/"/g, '""')}","view")`
        : '';
      return [
        product.sku,
        product.productName,
        product.vintage || '',
        pageCell,
        product.comaxQty,
        product.bruryaQty,
        product.storageQty,
        product.officeQty,
        product.shopQty,
        `=G${rowNum}+H${rowNum}+I${rowNum}+F${rowNum}`, // Brurya + Storage + Office + Shop
        '', // Vintage (actual) - user input
        '', // Comments - user input
        product.taskId
      ];
    });

    const dataRange = sheet.getRange(2, 1, data.length, data[0].length);
    dataRange.setValues(data);

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);

    // Highlight input columns (light yellow): Storage/Office/Shop, Vintage (actual), Comments
    const inputColor = '#FFF2CC';
    sheet.getRange(2, 7, data.length, 3).setBackground(inputColor);  // Storage/Office/Shop (G,H,I)
    sheet.getRange(2, 11, data.length, 2).setBackground(inputColor); // Vintage (actual) + Comments (K,L)

    // Bold the Total column
    sheet.getRange(2, 10, data.length, 1).setFontWeight('bold'); // J

    // Protection: lock everything except user-input columns
    const protection = sheet.protect().setDescription('System Data - Do Not Edit Locked Fields');
    const inputRangeQty = sheet.getRange(2, 7, data.length, 3);  // G-I
    const inputRangeNotes = sheet.getRange(2, 11, data.length, 2); // K-L
    protection.setUnprotectedRanges([inputRangeQty, inputRangeNotes]);

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

    if (!sheetIdOrUrl) {
      const config = ConfigService.getConfig('system.folder.jlmops_exports');
      const inventoryFolderId = config ? config.id : null;
      if (!inventoryFolderId) {
        return { success: false, message: 'Inventory exports folder not configured.' };
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
        return { success: false, message: 'No "ProductCount_" sheets found in the export folder.' };
      }
      ss = SpreadsheetApp.open(latestFile);
      LoggerService.info('WebAppInventory', 'importCountsFromSheet', `Auto-selected latest sheet: ${latestFile.getName()}`);
    } else {
      try {
        if (sheetIdOrUrl.startsWith('https://docs.google.com/spreadsheets/d/')) {
          const match = sheetIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (!match) return { success: false, message: 'Invalid Google Sheet URL.' };
          ss = SpreadsheetApp.openById(match[1]);
        } else {
          ss = SpreadsheetApp.openById(sheetIdOrUrl);
        }
      } catch (e) {
        return { success: false, message: `Could not open spreadsheet: ${e.message}` };
      }
    }

    const sheet = ss.getSheets()[0];
    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return { success: false, message: 'Sheet is empty or only contains headers.' };
    }

    const headers = values[0];
    const dataRows = values.slice(1);

    const skuCol = headers.indexOf("SKU");
    const productNameCol = headers.indexOf("Product Name");
    const storageCol = headers.indexOf("Storage Quantity");
    const officeCol = headers.indexOf("Office Quantity");
    const shopCol = headers.indexOf("Shop Quantity");
    const vintageRefCol = headers.indexOf("Vintage");
    const vintageActualCol = headers.indexOf("Vintage (actual)");
    const commentsCol = headers.indexOf("Comments");
    const taskIdCol = headers.indexOf("Task ID");

    if (skuCol === -1 || taskIdCol === -1 || storageCol === -1 || officeCol === -1 || shopCol === -1) {
      return { success: false, message: 'Missing required headers: SKU, Storage Quantity, Office Quantity, Shop Quantity, Task ID.' };
    }

    const isBlank = (v) => v === '' || v === null || v === undefined;

    // --- Pre-scan (strict atomic): collect all issues before writing anything ---
    const preScanErrors = [];
    const parsedRows = [];

    dataRows.forEach((row, index) => {
      const rowNum = index + 2;
      const rawStorage = row[storageCol];
      const rawOffice = row[officeCol];
      const rawShop = row[shopCol];
      const rawVintageActual = vintageActualCol !== -1 ? row[vintageActualCol] : '';
      const rawComment = commentsCol !== -1 ? row[commentsCol] : '';
      const vintageRef = vintageRefCol !== -1 ? row[vintageRefCol] : '';

      const anyQty = !isBlank(rawStorage) || !isBlank(rawOffice) || !isBlank(rawShop);
      const anyAux = !isBlank(rawVintageActual) || !isBlank(rawComment);

      if (!anyQty && !anyAux) return; // silently skipped — unchanged row

      const sku = String(row[skuCol] || '').trim();

      if (!anyQty && anyAux) {
        preScanErrors.push({ row: rowNum, sku: sku, reason: 'Vintage or Comment entered without a quantity' });
        return;
      }

      const parsedStorage = isBlank(rawStorage) ? null : parseInt(rawStorage, 10);
      const parsedOffice = isBlank(rawOffice) ? null : parseInt(rawOffice, 10);
      const parsedShop = isBlank(rawShop) ? null : parseInt(rawShop, 10);

      if ((parsedStorage !== null && isNaN(parsedStorage)) ||
          (parsedOffice !== null && isNaN(parsedOffice)) ||
          (parsedShop !== null && isNaN(parsedShop))) {
        preScanErrors.push({ row: rowNum, sku: sku, reason: 'Non-numeric quantity' });
        return;
      }

      const taskId = String(row[taskIdCol] || '').trim();
      const productName = productNameCol !== -1 ? String(row[productNameCol] || '').trim() : '';
      parsedRows.push({
        rowNum: rowNum,
        sku: sku,
        taskId: taskId,
        productName: productName,
        storageQty: parsedStorage,
        officeQty: parsedOffice,
        shopQty: parsedShop,
        vintageActual: String(rawVintageActual || '').trim(),
        vintageRef: String(vintageRef || '').trim(),
        comment: String(rawComment || '').trim()
      });
    });

    if (preScanErrors.length > 0) {
      LoggerService.warn('WebAppInventory', 'importCountsFromSheet', `Pre-scan rejected: ${preScanErrors.length} issue(s).`);
      return {
        success: false,
        message: `Import rejected: ${preScanErrors.length} row(s) need attention.`,
        errors: preScanErrors
      };
    }

    // --- Write phase ---
    let processed = 0;
    let vintageTasksCreated = 0;
    const writeErrors = [];

    parsedRows.forEach(r => {
      try {
        const updateResult = InventoryManagementService.updatePhysicalCounts({
          taskId: r.taskId,
          sku: r.sku,
          storageQty: r.storageQty,
          officeQty: r.officeQty,
          shopQty: r.shopQty
        });
        if (updateResult.success) {
          processed++;
        } else {
          writeErrors.push({ row: r.rowNum, sku: r.sku, reason: updateResult.message || 'Count write failed' });
          return;
        }
      } catch (e) {
        LoggerService.error('WebAppInventory', 'importCountsFromSheet', `SKU ${r.sku} row ${r.rowNum}: ${e.message}`, e);
        writeErrors.push({ row: r.rowNum, sku: r.sku, reason: e.message });
        return;
      }

      const vintageMismatch = r.vintageActual && r.vintageActual !== r.vintageRef;
      const hasComment = !!r.comment;

      if (vintageMismatch || hasComment) {
        let note;
        if (vintageMismatch && hasComment) {
          note = `Update Comax vintage to ${r.vintageActual}. ${r.comment}`;
        } else if (vintageMismatch) {
          note = `Update Comax vintage to ${r.vintageActual}`;
        } else {
          note = r.comment;
        }
        try {
          TaskService.createTask(
            'task.validation.vintage_mismatch',
            r.sku,
            r.productName || '',
            'Vintage Update (Count)',
            note,
            null,
            { allowDuplicate: true }
          );
          vintageTasksCreated++;
        } catch (tErr) {
          LoggerService.error('WebAppInventory', 'importCountsFromSheet', `Vintage task create failed for ${r.sku}: ${tErr.message}`, tErr);
          writeErrors.push({ row: r.rowNum, sku: r.sku, reason: `Count saved; vintage task creation failed: ${tErr.message}` });
        }
      }
    });

    SpreadsheetApp.flush();
    LoggerService.info('WebAppInventory', 'importCountsFromSheet', `Imported ${processed} counts; ${vintageTasksCreated} vintage tasks; ${writeErrors.length} errors.`);

    return {
      success: true,
      processed: processed,
      vintageTasksCreated: vintageTasksCreated,
      errors: writeErrors,
      message: `Imported ${processed} counts` +
        (vintageTasksCreated ? `, created ${vintageTasksCreated} vintage task(s)` : '') +
        (writeErrors.length ? `, ${writeErrors.length} issue(s)` : '') + '.'
    };
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
      ConfigService.setConfig('system.brurya.last_update', 'value', new Date().toISOString());
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
