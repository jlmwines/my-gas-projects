/**
 * @file WebAppDashboardV2.js
 * @description Consolidated dashboard - efficient, fast, clear.
 * Single API call returns all widget data with task details.
 */

/**
 * Gets consolidated dashboard data in a single call.
 * @returns {Object} Complete dashboard state
 */
function WebAppDashboardV2_getData() {
  const serviceName = 'WebAppDashboardV2';
  const functionName = 'getData';

  try {
    // Get all open tasks once for efficiency
    const allTasks = WebAppTasks.getOpenTasks();

    const result = {
      timestamp: new Date().toISOString(),
      systemHealth: _getSystemHealthData(),
      orders: _getOrdersData(),
      inventory: _getInventoryData(allTasks),
      products: _getProductsData(allTasks),
      projects: _getProjectSummaries(allTasks),
      adminTasks: _getAdminTasksList(allTasks)
    };

    return { success: true, data: result };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Gets system health data from the singleton task.
 * Shows time and result of housekeeping, schema validation, data validation, unit testing.
 * @private
 */
function _getSystemHealthData() {
  try {
    const healthTask = TaskService.findOpenTaskByType('task.system.health_status', '_SYSTEM');

    // Get sync state
    const syncSession = SyncStateService.getActiveSession();
    const syncStatus = _getSyncStatus(syncSession);

    if (!healthTask || !healthTask.notes) {
      return {
        available: true,
        housekeeping: { status: 'unknown', timestamp: null },
        schemaValidation: { status: 'unknown', timestamp: null },
        dataValidation: { status: 'unknown', timestamp: null, issues: null },
        unitTests: { status: 'unknown', timestamp: null, result: null },
        dailySync: syncStatus
      };
    }

    const notes = typeof healthTask.notes === 'string' ? JSON.parse(healthTask.notes) : healthTask.notes;
    const hk = notes.last_housekeeping || {};

    // Determine individual statuses
    const hasIssues = hk.validation_issues > 0;
    const testsOk = hk.unit_tests && !hk.unit_tests.includes('error');

    return {
      available: true,
      housekeeping: {
        status: hk.status === 'success' ? 'ok' : 'partial',
        timestamp: hk.timestamp || null
      },
      schemaValidation: {
        status: 'ok', // Schema validation runs as part of housekeeping
        timestamp: hk.timestamp || null
      },
      dataValidation: {
        status: hasIssues ? 'issues' : 'ok',
        timestamp: hk.timestamp || null,
        issues: hk.validation_issues ?? 0
      },
      unitTests: {
        status: testsOk ? 'ok' : 'error',
        timestamp: hk.timestamp || null,
        result: hk.unit_tests || null
      },
      dailySync: syncStatus
    };
  } catch (e) {
    return {
      available: false,
      error: e.message
    };
  }
}

/**
 * Gets sync status for dashboard display.
 * @private
 */
function _getSyncStatus(syncSession) {
  if (!syncSession || !syncSession.sessionId) {
    return { status: 'unknown', timestamp: null, stage: null };
  }

  const stage = syncSession.currentStage;
  let status = 'unknown';

  if (stage === 'COMPLETE') {
    status = 'ok';
  } else if (stage === 'FAILED') {
    status = 'error';
  } else if (stage === 'IDLE') {
    status = 'unknown';
  } else {
    status = 'partial'; // In progress
  }

  return {
    status: status,
    timestamp: syncSession.lastUpdated || null,
    stage: stage
  };
}

/**
 * Gets orders widget data.
 * @private
 */
function _getOrdersData() {
  try {
    const orderService = new OrderService(ProductService);
    return {
      packingSlipsReady: orderService.getPackingSlipsReadyCount(),
      ordersToExport: orderService.getComaxExportOrderCount(),
      onHold: orderService.getOnHoldOrderCount(),
      processing: orderService.getProcessingOrderCount()
    };
  } catch (e) {
    return {
      packingSlipsReady: 0,
      ordersToExport: 0,
      onHold: 0,
      processing: 0,
      error: e.message
    };
  }
}

/**
 * Gets inventory widget data.
 * @private
 */
function _getInventoryData(allTasks) {
  try {
    // Brurya last update
    const allConfig = ConfigService.getAllConfig();
    const bruryaConfig = allConfig['system.brurya.last_update'];
    const bruryaLastUpdate = bruryaConfig?.value ? new Date(bruryaConfig.value).toISOString() : null;

    // Count tasks by type
    const negativeInventory = _countTasksByType(allTasks, 'task.validation.comax_internal_audit');
    const inventoryCountTasks = _countTasksByType(allTasks, 'task.confirmation.comax_inventory_export');
    const inventoryAwaitingReview = _countTasksByType(allTasks, 'task.validation.archived_comax_stock_mismatch');
    const bruryaReminder = _countTasksByType(allTasks, 'task.inventory.brurya_update');

    return {
      bruryaLastUpdate: bruryaLastUpdate,
      bruryaReminder: bruryaReminder,
      negativeInventory: negativeInventory,
      inventoryCountTasks: inventoryCountTasks,
      inventoryAwaitingReview: inventoryAwaitingReview
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Gets products widget data.
 * @private
 */
function _getProductsData(allTasks) {
  try {
    return {
      vintageUpdate: _countTasksByType(allTasks, 'task.validation.vintage_mismatch'),
      detailReview: _countTasksByType(allTasks, 'task.validation.field_mismatch'),
      newProductSuggestion: _countTasksByType(allTasks, 'task.onboarding.suggestion'),
      newProductEdit: _countTasksByTypeAndStatus(allTasks, 'task.onboarding.add_product', ['New', 'In Progress']),
      newProductReview: _countTasksByTypeAndStatus(allTasks, 'task.onboarding.add_product', ['Review', 'Assigned']),
      bundleCritical: _countTasksByType(allTasks, 'task.bundle.critical_inventory'),
      bundleLow: _countTasksByType(allTasks, 'task.bundle.low_inventory'),
      categoryLow: _countTasksByType(allTasks, 'task.deficiency.category_stock')
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Gets project summaries with task counts.
 * @private
 */
function _getProjectSummaries(allTasks) {
  const projects = ProjectService.getAllProjects();

  // Group tasks by project
  const tasksByProject = {};
  allTasks.forEach(task => {
    const projId = task.st_ProjectId || 'UNASSIGNED';
    if (!tasksByProject[projId]) {
      tasksByProject[projId] = { total: 0, critical: 0, new: 0 };
    }
    tasksByProject[projId].total++;
    if (task.st_Priority === 'Critical' || task.st_Priority === 'High') {
      tasksByProject[projId].critical++;
    }
    if (task.st_Status === 'New') {
      tasksByProject[projId].new++;
    }
  });

  return projects.map(p => {
    const id = p.spro_ProjectId;
    const counts = tasksByProject[id] || { total: 0, critical: 0, new: 0 };
    return {
      id: id,
      name: p.spro_Name,
      type: p.spro_Type,
      status: p.spro_Status,
      taskCount: counts.total,
      criticalCount: counts.critical,
      newCount: counts.new
    };
  });
}

/**
 * Gets admin tasks list with details.
 * @private
 */
function _getAdminTasksList(allTasks) {
  // Filter to admin-relevant tasks and sort by due date
  const adminTasks = allTasks
    .filter(task => task.st_Status !== 'Done' && task.st_Status !== 'Cancelled')
    .map(task => ({
      id: task.st_TaskId,
      typeId: task.st_TaskTypeId,
      name: task.st_Title || _formatTaskTypeName(task.st_TaskTypeId),
      entityId: task.st_LinkedEntityId || '',
      entityName: task.st_LinkedEntityName || '',
      dueDate: task.st_DueDate || null,
      status: task.st_Status,
      priority: task.st_Priority
    }))
    .sort((a, b) => {
      // Critical/High first, then by due date
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Normal': 2, 'Low': 3 };
      const pA = priorityOrder[a.priority] ?? 2;
      const pB = priorityOrder[b.priority] ?? 2;
      if (pA !== pB) return pA - pB;

      // Then by due date (nulls last)
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

  return adminTasks.slice(0, 20); // Limit to 20 tasks
}

/**
 * Counts tasks by type.
 * @private
 */
function _countTasksByType(allTasks, typeId) {
  return allTasks.filter(t => t.st_TaskTypeId === typeId).length;
}

/**
 * Counts tasks by type and status.
 * @private
 */
function _countTasksByTypeAndStatus(allTasks, typeId, statuses) {
  return allTasks.filter(t =>
    t.st_TaskTypeId === typeId && statuses.includes(t.st_Status)
  ).length;
}

/**
 * Formats task type ID into readable name.
 * @private
 */
function _formatTaskTypeName(typeId) {
  if (!typeId) return 'Unknown';
  return typeId
    .replace('task.', '')
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Updates the Brurya last update timestamp and closes reminder task.
 * @returns {Object} { success: boolean, message: string }
 */
function WebAppDashboardV2_confirmBruryaUpdate() {
  const serviceName = 'WebAppDashboardV2';
  const functionName = 'confirmBruryaUpdate';

  try {
    // Update timestamp
    ConfigService.setConfig('system.brurya.last_update', 'value', new Date().toISOString());

    // Close any open brurya update task
    try {
      TaskService.completeTaskByTypeAndEntity('task.inventory.brurya_update', 'BRURYA');
    } catch (taskErr) {
      // No task to close - that's fine
    }

    LoggerService.info(serviceName, functionName, 'Brurya update confirmed.');
    return { success: true, message: 'Brurya update confirmed' };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, message: e.message };
  }
}
