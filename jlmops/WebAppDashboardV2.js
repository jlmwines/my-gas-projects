/**
 * @file WebAppDashboardV2.js
 * @description Consolidated dashboard - efficient, fast, clear.
 * Single API call returns all widget data with task details.
 */

/**
 * Gets consolidated dashboard data in a single call.
 * OPTIMIZED: Reads each sheet exactly once, then computes all widgets from memory.
 * @returns {Object} Complete dashboard state
 */
function WebAppDashboardV2_getData() {
  const serviceName = 'WebAppDashboardV2';
  const functionName = 'getData';

  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];

    // ========== READ SHEETS ONCE ==========
    const tasksSheet = SheetAccessor.getDataSheet(sheetNames.SysTasks, false);
    const tasksRaw = tasksSheet ? tasksSheet.getDataRange().getValues() : [];

    const ordLogSheet = SheetAccessor.getDataSheet(sheetNames.SysOrdLog, false);
    const ordLogRaw = ordLogSheet ? ordLogSheet.getDataRange().getValues() : [];

    const webOrdMSheet = SheetAccessor.getDataSheet(sheetNames.WebOrdM, false);
    const webOrdMRaw = webOrdMSheet ? webOrdMSheet.getDataRange().getValues() : [];

    const jobQueueSheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue, false);
    const jobQueueRaw = jobQueueSheet ? jobQueueSheet.getDataRange().getValues() : [];

    // ========== CONVERT TO OBJECTS ==========
    const allTasks = _rowsToObjects(tasksRaw);
    const ordLog = _rowsToObjects(ordLogRaw);
    const webOrdM = _rowsToObjects(webOrdMRaw);
    const jobQueue = _rowsToObjects(jobQueueRaw);

    // ========== DERIVE COMMON FILTERS ==========
    const openTasks = allTasks.filter(t =>
      t.st_Status !== 'Completed' && t.st_Status !== 'Done' && t.st_Status !== 'Cancelled'
    );

    // ========== BUILD WIDGETS FROM MEMORY ==========
    const result = {
      timestamp: new Date().toISOString(),
      systemHealth: _getSystemHealthData_v2(allTasks, jobQueue, allConfig),
      orders: _getOrdersData_v2(ordLog, webOrdM),
      inventory: _getInventoryData(openTasks),
      products: _getProductsData(openTasks),
      projects: _getProjectSummaries(openTasks),
      adminTasks: _getAdminTasksList(openTasks)
    };

    return { success: true, data: result };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Converts 2D array (with header row) to array of objects.
 * @private
 */
function _rowsToObjects(data) {
  if (!data || data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    headers.forEach((h, j) => obj[h] = data[i][j]);
    rows.push(obj);
  }
  return rows;
}

/**
 * Safely converts a date value to ISO string for JSON serialization.
 * @param {*} val - Date, string, or null
 * @returns {string|null} ISO string or null
 * @private
 */
function _safeDate(val) {
  if (!val) return null;
  try {
    if (val instanceof Date) {
      return val.toISOString();
    }
    return String(val);
  } catch (e) {
    return String(val);
  }
}

/**
 * Gets system health data from pre-loaded task and job data.
 * OPTIMIZED: No sheet reads - works with data passed in.
 * @private
 */
function _getSystemHealthData_v2(allTasks, jobQueue, allConfig) {
  try {
    // Find health status task from pre-loaded tasks
    const healthTask = allTasks.find(t =>
      t.st_TaskTypeId === 'task.system.health_status' &&
      t.st_LinkedEntityId === '_SYSTEM' &&
      t.st_Status !== 'Done' && t.st_Status !== 'Cancelled'
    );

    // Get sync status from pre-loaded tasks
    const syncStatus = _getLastSyncStatus_v2(allTasks);

    if (!healthTask || !healthTask.st_Notes) {
      return {
        available: true,
        housekeeping: { status: 'unknown', timestamp: null },
        schemaValidation: { status: 'unknown', timestamp: null },
        dataValidation: { status: 'unknown', timestamp: null, issues: null },
        unitTests: { status: 'unknown', timestamp: null, result: null },
        dailySync: syncStatus,
        urgentAlerts: []
      };
    }

    const notes = typeof healthTask.st_Notes === 'string' ? JSON.parse(healthTask.st_Notes) : healthTask.st_Notes;
    const urgentAlerts = notes.urgentAlerts || [];
    const hk = notes.last_housekeeping || {};

    // Determine individual statuses
    const hasIssues = hk.validation_issues > 0;
    const testsOk = hk.unit_tests && !hk.unit_tests.includes('error');

    // Map housekeeping status to display status
    let hkStatus = 'ok';
    if (hk.status === 'failed') {
      hkStatus = 'error';
    } else if (hk.status === 'partial') {
      hkStatus = 'partial';
    } else if (hk.status !== 'success') {
      hkStatus = 'unknown';
    }

    return {
      available: true,
      housekeeping: {
        status: hkStatus,
        timestamp: hk.timestamp || null,
        failures: hk.phase3_failures || null
      },
      schemaValidation: {
        status: (hk.schema_status === 'OK' || hk.schema_status === 'PASSED') ? 'ok' : (hk.schema_critical > 0 ? 'error' : 'partial'),
        timestamp: hk.timestamp || null,
        critical: hk.schema_critical ?? 0
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
      dailySync: syncStatus,
      urgentAlerts: urgentAlerts
    };
  } catch (e) {
    return {
      available: false,
      error: e.message
    };
  }
}

/**
 * Gets sync status from pre-loaded tasks.
 * OPTIMIZED: No sheet reads.
 * @private
 */
function _getLastSyncStatus_v2(allTasks) {
  try {
    // Check for an open (in-progress) sync task
    const openSyncTask = allTasks.find(t =>
      t.st_TaskTypeId === 'task.sync.daily_session' &&
      t.st_Status !== 'Done' && t.st_Status !== 'Cancelled'
    );

    if (openSyncTask) {
      return {
        status: 'partial',
        timestamp: openSyncTask.st_Notes ? _parseTimestamp(openSyncTask.st_Notes) : null,
        stage: 'IN_PROGRESS'
      };
    }

    // Find the most recent completed sync task (search from end)
    let lastSyncDate = null;
    let lastSyncStatus = 'unknown';

    for (let i = allTasks.length - 1; i >= 0; i--) {
      const task = allTasks[i];
      if (task.st_TaskTypeId === 'task.sync.daily_session') {
        if (task.st_Status === 'Done' && task.st_DoneDate) {
          lastSyncDate = new Date(task.st_DoneDate);
          lastSyncStatus = 'ok';
          break;
        } else if (task.st_Status === 'Cancelled') {
          lastSyncDate = task.st_DoneDate ? new Date(task.st_DoneDate) : null;
          lastSyncStatus = 'error';
          break;
        }
      }
    }

    return {
      status: lastSyncStatus,
      timestamp: lastSyncDate ? lastSyncDate.toISOString() : null,
      stage: lastSyncStatus === 'ok' ? 'COMPLETE' : (lastSyncStatus === 'error' ? 'FAILED' : null)
    };

  } catch (e) {
    LoggerService.warn('WebAppDashboardV2', '_getLastSyncStatus_v2', 'Error: ' + e.message);
    return { status: 'unknown', timestamp: null, stage: null };
  }
}

/**
 * Gets orders widget data from pre-loaded order data.
 * OPTIMIZED: No sheet reads - computes from passed-in data.
 * @private
 */
function _getOrdersData_v2(ordLog, webOrdM) {
  try {
    // Count by status from SysOrdLog
    let packingReady = 0;
    let onHold = 0;
    let processing = 0;
    let newOrders = 0;

    ordLog.forEach(order => {
      const packingStatus = order.sol_PackingStatus;
      const orderStatus = order.sol_Status;

      if (packingStatus === 'Ready') packingReady++;
      if (orderStatus === 'on-hold') onHold++;
      if (orderStatus === 'processing') processing++;
      if (orderStatus === 'new' || orderStatus === 'pending') newOrders++;
    });

    // Count orders to export: processing status + not yet exported
    // An order needs export if it's processing and sol_ComaxExported is not 'Yes'
    const ordersToExport = ordLog.filter(o =>
      o.sol_Status === 'processing' &&
      o.sol_ComaxExported !== 'Yes' &&
      o.sol_ComaxExported !== 'TRUE' &&
      o.sol_ComaxExported !== true
    ).length;

    return {
      newOrders: newOrders,
      ordersToExport: ordersToExport,
      onHold: onHold,
      processing: processing,
      packingReady: packingReady
    };
  } catch (e) {
    return {
      newOrders: 0,
      ordersToExport: 0,
      onHold: 0,
      processing: 0,
      packingReady: 0,
      error: e.message
    };
  }
}

/**
 * Gets system health data from the singleton task.
 * Shows time and result of housekeeping, schema validation, data validation, unit testing.
 * @private
 * @deprecated Use _getSystemHealthData_v2 with pre-loaded data
 */
function _getSystemHealthData() {
  try {
    const healthTask = TaskService.findOpenTaskByType('task.system.health_status', '_SYSTEM');

    // Get sync status from the daily sync task (not active session)
    const syncStatus = _getLastSyncStatus();

    if (!healthTask || !healthTask.notes) {
      return {
        available: true,
        housekeeping: { status: 'unknown', timestamp: null },
        schemaValidation: { status: 'unknown', timestamp: null },
        dataValidation: { status: 'unknown', timestamp: null, issues: null },
        unitTests: { status: 'unknown', timestamp: null, result: null },
        dailySync: syncStatus,
        urgentAlerts: []
      };
    }

    const notes = typeof healthTask.notes === 'string' ? JSON.parse(healthTask.notes) : healthTask.notes;
    const urgentAlerts = notes.urgentAlerts || [];
    const hk = notes.last_housekeeping || {};

    // Determine individual statuses
    const hasIssues = hk.validation_issues > 0;
    const testsOk = hk.unit_tests && !hk.unit_tests.includes('error');

    // Map housekeeping status to display status
    let hkStatus = 'ok';
    if (hk.status === 'failed') {
      hkStatus = 'error';
    } else if (hk.status === 'partial') {
      hkStatus = 'partial';
    } else if (hk.status !== 'success') {
      hkStatus = 'unknown';
    }

    return {
      available: true,
      housekeeping: {
        status: hkStatus,
        timestamp: hk.timestamp || null,
        failures: hk.phase3_failures || null
      },
      schemaValidation: {
        status: (hk.schema_status === 'OK' || hk.schema_status === 'PASSED') ? 'ok' : (hk.schema_critical > 0 ? 'error' : 'partial'),
        timestamp: hk.timestamp || null,
        critical: hk.schema_critical ?? 0
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
      dailySync: syncStatus,
      urgentAlerts: urgentAlerts
    };
  } catch (e) {
    return {
      available: false,
      error: e.message
    };
  }
}

/**
 * Gets sync status from the daily sync task.
 * Checks for both open (in progress) and recently completed sync tasks.
 * @private
 */
function _getLastSyncStatus() {
  try {
    // First check for an open (in-progress) sync task
    const openSyncTask = TaskService.findOpenTaskByType('task.sync.daily_session', null);
    if (openSyncTask) {
      return {
        status: 'partial',
        timestamp: openSyncTask.notes ? _parseTimestamp(openSyncTask.notes) : null,
        stage: 'IN_PROGRESS'
      };
    }

    // No open task - find the most recently completed sync task
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const taskSheet = SheetAccessor.getDataSheet(sheetNames.SysTasks, false);

    if (!taskSheet || taskSheet.getLastRow() <= 1) {
      return { status: 'unknown', timestamp: null, stage: null };
    }

    const data = taskSheet.getDataRange().getValues();
    const headers = data[0];
    const typeIdx = headers.indexOf('st_TaskTypeId');
    const statusIdx = headers.indexOf('st_Status');
    const doneIdx = headers.indexOf('st_DoneDate');

    // Find the most recent completed sync task
    let lastSyncDate = null;
    let lastSyncStatus = 'unknown';

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (row[typeIdx] === 'task.sync.daily_session') {
        const taskStatus = row[statusIdx];
        const doneDate = row[doneIdx];

        if (taskStatus === 'Done' && doneDate) {
          lastSyncDate = new Date(doneDate);
          lastSyncStatus = 'ok';
          break;
        } else if (taskStatus === 'Cancelled') {
          lastSyncDate = doneDate ? new Date(doneDate) : null;
          lastSyncStatus = 'error';
          break;
        }
      }
    }

    return {
      status: lastSyncStatus,
      timestamp: lastSyncDate ? lastSyncDate.toISOString() : null,
      stage: lastSyncStatus === 'ok' ? 'COMPLETE' : (lastSyncStatus === 'error' ? 'FAILED' : null)
    };

  } catch (e) {
    LoggerService.warn('WebAppDashboardV2', '_getLastSyncStatus', 'Error getting sync status: ' + e.message);
    return { status: 'unknown', timestamp: null, stage: null };
  }
}

/**
 * Helper to parse timestamp from task notes.
 * @private
 */
function _parseTimestamp(notes) {
  if (!notes) return null;
  try {
    const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
    return parsed.timestamp || parsed.startTime || null;
  } catch (e) {
    return null;
  }
}

/**
 * Gets orders widget data.
 * @private
 */
function _getOrdersData() {
  try {
    const orderService = new OrderService(ProductService);

    // Get packing slips count from SysOrdLog
    let packingReady = 0;
    try {
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const ordLogSheet = SheetAccessor.getDataSheet(sheetNames.SysOrdLog, false);

      if (ordLogSheet && ordLogSheet.getLastRow() > 1) {
        const data = ordLogSheet.getDataRange().getValues();
        const headers = data[0];
        const statusIdx = headers.indexOf('sol_PackingStatus');

        if (statusIdx !== -1) {
          for (let i = 1; i < data.length; i++) {
            if (data[i][statusIdx] === 'Ready') {
              packingReady++;
            }
          }
        }
      }
    } catch (packErr) {
      LoggerService.warn('WebAppDashboardV2', '_getOrdersData', 'Could not get packing count: ' + packErr.message);
    }

    return {
      newOrders: orderService.getNewOrdersCount(),
      ordersToExport: orderService.getComaxExportOrderCount(),
      onHold: orderService.getOnHoldOrderCount(),
      processing: orderService.getProcessingOrderCount(),
      packingReady: packingReady
    };
  } catch (e) {
    return {
      newOrders: 0,
      ordersToExport: 0,
      onHold: 0,
      processing: 0,
      packingReady: 0,
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
    // Brurya days since update - read from task notes
    let bruryaDaysSince = null;
    const bruryaTask = allTasks.find(t => t.st_TaskTypeId === 'task.inventory.brurya_update');
    if (bruryaTask && bruryaTask.st_Notes) {
      try {
        const notes = typeof bruryaTask.st_Notes === 'string'
          ? JSON.parse(bruryaTask.st_Notes)
          : bruryaTask.st_Notes;
        bruryaDaysSince = notes.daysSinceUpdate;
      } catch (parseErr) {
        // Notes not valid JSON, ignore
      }
    }

    // Count tasks by type
    const negativeInventory = _countTasksByType(allTasks, 'task.validation.comax_internal_audit');
    const inventoryCountTasks = _countTasksByType(allTasks, 'task.confirmation.comax_inventory_export');
    const inventoryAwaitingReview = _countTasksByType(allTasks, 'task.validation.archived_comax_stock_mismatch');

    return {
      bruryaDaysSince: bruryaDaysSince,
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
      vintageUpdate: _countTasksByTypeAndStatus(allTasks, 'task.validation.vintage_mismatch', ['New', 'Assigned']),
      detailReview: _countTasksByTypeAndStatus(allTasks, 'task.validation.vintage_mismatch', ['Review']),
      newProductSuggestion: _countTasksByTypeAndStatus(allTasks, 'task.onboarding.suggestion', ['New', 'Assigned']),
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

  // Group tasks by project (normalize IDs for consistent matching)
  const tasksByProject = {};
  allTasks.forEach(task => {
    const projId = task.st_ProjectId ? String(task.st_ProjectId).trim() : 'UNASSIGNED';
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
    const id = p.spro_ProjectId ? String(p.spro_ProjectId).trim() : '';
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
    .map(task => {
      // Safely convert dates to ISO strings for serialization
      let dueDate = null;
      if (task.st_DueDate) {
        try {
          dueDate = task.st_DueDate instanceof Date
            ? task.st_DueDate.toISOString()
            : String(task.st_DueDate);
        } catch (e) {
          dueDate = String(task.st_DueDate);
        }
      }

      return {
        id: task.st_TaskId,
        typeId: task.st_TaskTypeId,
        name: task.st_Title || _formatTaskTypeName(task.st_TaskTypeId),
        entityId: task.st_LinkedEntityId || '',
        entityName: task.st_LinkedEntityName || '',
        projectId: task.st_ProjectId || '',
        dueDate: dueDate,
        status: task.st_Status,
        priority: task.st_Priority
      };
    })
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
      try {
        return new Date(a.dueDate) - new Date(b.dueDate);
      } catch (e) {
        return 0;
      }
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

/**
 * Gets manager-specific dashboard data.
 * Returns summary widgets (dimmed for context) and manager tasks.
 * Manager tasks: content.edit, content.translate_edit, plus tasks from inventory/product workflows.
 * OPTIMIZED: Reads each sheet exactly once.
 * @returns {Object} Dashboard data for manager view
 */
function WebAppDashboardV2_getManagerData() {
  const serviceName = 'WebAppDashboardV2';
  const functionName = 'getManagerData';

  try {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];

    // ========== READ SHEETS ONCE ==========
    const tasksSheet = SheetAccessor.getDataSheet(sheetNames.SysTasks, false);
    const tasksRaw = tasksSheet ? tasksSheet.getDataRange().getValues() : [];

    const ordLogSheet = SheetAccessor.getDataSheet(sheetNames.SysOrdLog, false);
    const ordLogRaw = ordLogSheet ? ordLogSheet.getDataRange().getValues() : [];

    const webOrdMSheet = SheetAccessor.getDataSheet(sheetNames.WebOrdM, false);
    const webOrdMRaw = webOrdMSheet ? webOrdMSheet.getDataRange().getValues() : [];

    // ========== CONVERT TO OBJECTS ==========
    const allTasksIncludingDone = _rowsToObjects(tasksRaw);
    const ordLog = _rowsToObjects(ordLogRaw);
    const webOrdM = _rowsToObjects(webOrdMRaw);

    // Filter for open tasks (used by context widgets)
    const allOpenTasks = allTasksIncludingDone.filter(t =>
      t.st_Status !== 'Completed' && t.st_Status !== 'Done' && t.st_Status !== 'Cancelled'
    );

    // Manager task types - content review, inventory, and product tasks
    const managerTaskTypes = [
      // Content review
      'task.content.edit',
      'task.content.translate_edit',
      // Inventory
      'task.inventory.brurya_update',
      'task.validation.comax_internal_audit',  // Negative inventory counts
      // Products
      'task.validation.vintage_mismatch',
      'task.onboarding.add_product'
    ];

    // Return manager tasks including Done (frontend filters by status)
    const managerTasks = allTasksIncludingDone
      .filter(task => managerTaskTypes.includes(task.st_TaskTypeId))
      .filter(task => task.st_Status !== 'Cancelled')
      .map(task => ({
        id: task.st_TaskId,
        typeId: task.st_TaskTypeId,
        topic: _getTopicFromType(task.st_TaskTypeId),  // Always derive topic from type for consistency
        name: task.st_Title || _formatTaskTypeName(task.st_TaskTypeId),
        entityId: task.st_LinkedEntityId || '',
        entityName: task.st_LinkedEntityName || '',
        sessionId: task.st_SessionId || '',
        projectId: task.st_ProjectId || '',
        startDate: _safeDate(task.st_StartDate),
        dueDate: _safeDate(task.st_DueDate),
        doneDate: _safeDate(task.st_DoneDate),
        status: task.st_Status,
        priority: task.st_Priority,
        notes: task.st_Notes || ''
      }))
      .sort((a, b) => {
        // Sort by due date, then priority
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        try {
          const dateDiff = new Date(a.dueDate) - new Date(b.dueDate);
          if (dateDiff !== 0) return dateDiff;
        } catch (e) { /* ignore */ }

        const priorityOrder = { 'Critical': 0, 'High': 1, 'Normal': 2, 'Low': 3 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      });

    // Get summary data for context widgets (using open tasks only)
    // OPTIMIZED: Use pre-loaded data instead of calling methods that read sheets
    const result = {
      timestamp: new Date().toISOString(),
      orders: _getOrdersData_v2(ordLog, webOrdM),
      inventory: _getInventoryData(allOpenTasks),
      products: _getProductsData(allOpenTasks),
      projects: _getProjectSummaries(allOpenTasks),
      managerTasks: managerTasks
    };

    return { success: true, data: result };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Gets topic from task type ID.
 * @private
 */
function _getTopicFromType(typeId) {
  if (!typeId) return 'Other';
  if (typeId.includes('.content.')) return 'Content';
  if (typeId.includes('.inventory.') || typeId.includes('.deficiency.')) return 'Inventory';
  if (typeId.includes('.validation.') || typeId.includes('.onboarding.')) return 'Products';
  if (typeId.includes('.order.')) return 'Orders';
  if (typeId.includes('.crm.')) return 'CRM';
  return 'Other';
}

/**
 * Updates a manager task - limited to notes and status changes.
 * @param {string} taskId - The task ID
 * @param {Object} updates - { notes, status }
 * @returns {Object} { success, error }
 */
function WebAppDashboardV2_updateManagerTask(taskId, updates) {
  const serviceName = 'WebAppDashboardV2';
  const functionName = 'updateManagerTask';

  try {
    // Only allow notes and status updates for manager
    const allowedUpdates = {};
    if (updates.notes !== undefined) allowedUpdates.notes = updates.notes;
    if (updates.status !== undefined) {
      // Restrict status changes
      const allowedStatuses = ['New', 'In Progress', 'Done'];
      if (allowedStatuses.includes(updates.status)) {
        allowedUpdates.status = updates.status;
        // Set done date if marking as Done
        if (updates.status === 'Done') {
          allowedUpdates.doneDate = new Date().toISOString().split('T')[0];
        }
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return { success: false, error: 'No valid updates provided' };
    }

    return WebAppTasks_updateTask(taskId, allowedUpdates);
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Reverts a task to Admin by reassigning it.
 * Used by manager to send a task back for admin handling (e.g., rejected draft).
 * @param {string} taskId The task ID.
 * @returns {Object} Result object with success and error.
 */
function WebAppDashboardV2_revertTaskToAdmin(taskId) {
  const serviceName = 'WebAppDashboardV2';
  const functionName = 'revertTaskToAdmin';

  try {
    // Update task assignee to admin using role label (matches getInitialAssignee pattern)
    const updates = {
      assignedTo: 'Administrator',
      status: 'Assigned'
    };

    LoggerService.info(serviceName, functionName, `Reverting task ${taskId} to Administrator`);
    return WebAppTasks_updateTask(taskId, updates);
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}
