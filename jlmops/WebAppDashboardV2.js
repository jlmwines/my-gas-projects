/**
 * @file WebAppDashboardV2.js
 * @description New consolidated dashboard - efficient, fast, clear.
 * Single API call returns all project data with task summaries.
 */

/**
 * Gets consolidated dashboard data in a single call.
 * Optimized for minimal round trips and fast loading.
 * @returns {Object} Complete dashboard state
 */
function WebAppDashboardV2_getData() {
  const serviceName = 'WebAppDashboardV2';
  const functionName = 'getData';

  try {
    const result = {
      timestamp: new Date().toISOString(),
      projects: _getProjectSummaries(),
      taskCounts: _getTaskCountsByType(),
      alerts: _getSystemAlerts(),
      brurya: _getBruryaStatus()
    };

    return { success: true, data: result };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Gets project summaries with task counts.
 * @private
 */
function _getProjectSummaries() {
  const projects = ProjectService.getAllProjects();
  const allTasks = WebAppTasks.getOpenTasks();

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
 * Gets task counts grouped by type.
 * @private
 */
function _getTaskCountsByType() {
  const allTasks = WebAppTasks.getOpenTasks();
  const counts = {};

  allTasks.forEach(task => {
    const type = task.st_TaskTypeId || 'unknown';
    counts[type] = (counts[type] || 0) + 1;
  });

  return counts;
}

/**
 * Gets system alerts - bundles with issues, deficiencies, etc.
 * @private
 */
function _getSystemAlerts() {
  const alerts = [];

  try {
    // Bundle alerts
    const bundleStats = BundleService.getBundleStats();
    if (bundleStats.needsAttention > 0) {
      alerts.push({
        type: 'bundle',
        severity: 'warning',
        message: `${bundleStats.needsAttention} bundle(s) need attention`,
        count: bundleStats.needsAttention
      });
    }
    if (bundleStats.lowInventoryCount > 0) {
      alerts.push({
        type: 'bundle_inventory',
        severity: 'critical',
        message: `${bundleStats.lowInventoryCount} bundle slot(s) with low inventory`,
        count: bundleStats.lowInventoryCount
      });
    }
  } catch (e) {
    // Bundle service may not be available
  }

  return alerts;
}

/**
 * Gets Brurya warehouse status and reminder info.
 * @private
 */
function _getBruryaStatus() {
  try {
    const allConfig = ConfigService.getAllConfig();
    const bruryaConfig = allConfig['system.brurya.last_update'];
    const lastUpdate = bruryaConfig?.value ? new Date(bruryaConfig.value) : null;

    let daysSinceUpdate = null;
    let needsUpdate = false;

    if (lastUpdate) {
      daysSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      needsUpdate = daysSinceUpdate >= 7;
    } else {
      needsUpdate = true;
    }

    // Get Brurya stats
    const bruryaSummary = inventoryManagementService.getBruryaSummaryStatistic();

    return {
      productCount: bruryaSummary.productCount || 0,
      totalStock: bruryaSummary.totalStock || 0,
      lastUpdate: lastUpdate?.toISOString() || null,
      daysSinceUpdate: daysSinceUpdate,
      needsUpdate: needsUpdate
    };
  } catch (e) {
    return {
      productCount: 0,
      totalStock: 0,
      lastUpdate: null,
      daysSinceUpdate: null,
      needsUpdate: true,
      error: e.message
    };
  }
}

/**
 * Updates the Brurya last update timestamp and closes reminder task.
 * Call this when Brurya inventory is updated.
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
