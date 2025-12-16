/**
 * @file WebAppTasks.js
 * @description This script acts as a Data Provider for all task-related data.
 * It contains reusable functions for fetching and preparing task data from the
 * backend services (e.g., TaskService) for consumption by UI View Controllers.
 *
 * PERFORMANCE: Implements in-memory caching with 60-second TTL to reduce
 * expensive spreadsheet reads during dashboard loading.
 */

// eslint-disable-next-line no-unused-vars
const WebAppTasks = (() => {
  // ===== CACHING LAYER =====
  let taskCache = null;
  let taskCacheTime = null;
  const CACHE_TTL_MS = 60000; // 60 seconds

  /**
   * Invalidates the task cache. Should be called after any task modification.
   */
  const invalidateCache = () => {
    taskCache = null;
    taskCacheTime = null;
    LoggerService.info('WebAppTasks', 'invalidateCache', 'Task cache invalidated.');
  };

  /**
   * Checks if the cache is still valid.
   * @returns {boolean} True if cache exists and is not expired.
   */
  const isCacheValid = () => {
    if (!taskCache || !taskCacheTime) {
      return false;
    }
    const now = Date.now();
    const age = now - taskCacheTime;
    return age < CACHE_TTL_MS;
  };

  /**
   * Fetches tasks from the spreadsheet (bypasses cache).
   * @returns {Array<Object>} An array of open task objects.
   */
  const fetchTasksFromSheet = () => {
    const allConfig = ConfigService.getAllConfig();
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const sheetNames = allConfig['system.sheet_names'];
    const taskSheet = SpreadsheetApp.openById(dataSpreadsheetId).getSheetByName(sheetNames.SysTasks);

    if (!taskSheet || taskSheet.getLastRow() <= 1) {
      return [];
    }

    const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
    const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];

    const openTasks = taskData.map(row => {
      const task = {};
      taskHeaders.forEach((header, index) => {
        task[header] = row[index];
      });
      return task;
    }).filter(task => {
      const status = task.st_Status;
      return status !== 'Done' && status !== 'Cancelled';
    });

    return openTasks;
  };

  /**
   * Retrieves all tasks that are not in a 'Done' or 'Cancelled' state.
   * Uses an in-memory cache with 60-second TTL to improve performance.
   * @param {boolean} forceRefresh - If true, bypasses cache and fetches fresh data.
   * @returns {Array<Object>} An array of open task objects, where each object is a map of header names to values.
   */
  const getOpenTasks = (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && isCacheValid()) {
        LoggerService.info('WebAppTasks', 'getOpenTasks', 'Returning cached tasks.', { cacheAge: Date.now() - taskCacheTime });
        return taskCache;
      }

      // Cache miss or expired - fetch from sheet
      LoggerService.info('WebAppTasks', 'getOpenTasks', 'Cache miss - fetching tasks from sheet.');
      const openTasks = fetchTasksFromSheet();

      // Update cache
      taskCache = openTasks;
      taskCacheTime = Date.now();

      return openTasks;
    } catch (e) {
      LoggerService.error('WebAppTasks', 'getOpenTasks', e.message, e);
      return []; // Return empty array on error to prevent UI crashes
    }
  };

  /**
   * Retrieves open tasks of a specific type.
   * @param {string} typeId - The exact task type ID to filter by.
   * @returns {Array<Object>} An array of open task objects of the specified type.
   */
  const getOpenTasksByTypeId = (typeId) => {
    const allOpenTasks = getOpenTasks();
    return allOpenTasks.filter(task => task.st_TaskTypeId === typeId);
  };

  /**
   * Retrieves open tasks where the type ID starts with a given prefix.
   * @param {string} prefix - The prefix to filter task type IDs by.
   * @returns {Array<Object>} An array of open task objects matching the prefix.
   */
  const getOpenTasksByPrefix = (prefix) => {
    const allOpenTasks = getOpenTasks();
    return allOpenTasks.filter(task => task.st_TaskTypeId.startsWith(prefix));
  };

  /**
   * Wraps the TaskService.createTask function and invalidates cache.
   * @param {string} typeId - The type of task to create.
   * @param {string} entityId - The ID of the entity this task relates to.
   * @param {string} linkedEntityName - The human-readable name of the entity.
   * @param {string} title - The title of the task.
   * @param {string} notes - The notes for the task.
   * @returns {Object} The created task object.
   */
  const createTask = (typeId, entityId, linkedEntityName, title, notes) => {
    const result = TaskService.createTask(typeId, entityId, linkedEntityName, title, notes);

    // Invalidate cache after task creation
    invalidateCache();

    return result;
  };

  /**
   * Retrieves a single open task of a specific type.
   * @param {string} typeId - The exact task type ID to filter by.
   * @returns {Object|null} The first open task object of the specified type, or null if none exist.
   */
  const getOpenTaskByTypeId = (typeId) => {
    const allOpenTasks = getOpenTasks();
    const task = allOpenTasks.find(task => task.st_TaskTypeId === typeId);
    return task || null;
  };

  /**
   * Retrieves a single task by its ID, regardless of its status.
   * @param {string} taskId - The ID of the task to retrieve.
   * @returns {Object|null} The task object if found, or null.
   */
  const getTaskById = (taskId) => {
    try {
      const allConfig = ConfigService.getAllConfig();
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const sheetNames = allConfig['system.sheet_names'];
      const taskSheet = SpreadsheetApp.openById(dataSpreadsheetId).getSheetByName(sheetNames.SysTasks);

      if (!taskSheet || taskSheet.getLastRow() <= 1) {
        return null;
      }

      const taskData = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues();
      const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
      const taskIdCol = taskHeaders.indexOf('st_TaskId');

      if (taskIdCol === -1) {
        LoggerService.error('WebAppTasks', 'getTaskById', "Required column 'st_TaskId' not found in SysTasks sheet.");
        return null;
      }
      
      const foundTaskRow = taskData.find(row => row[taskIdCol] === taskId);

      if (foundTaskRow) {
        const task = {};
        taskHeaders.forEach((header, index) => {
          task[header] = foundTaskRow[index];
        });
        return task;
      }
      return null;
    } catch (e) {
      LoggerService.error('WebAppTasks', 'getTaskById', e.message, e);
      return null;
    }
  };

  /**
   * Retrieves open tasks of a specific type and status.
   * @param {string} typeId - The exact task type ID to filter by.
   * @param {string} status - The exact status to filter by (e.g., 'Review').
   * @returns {Array<Object>} An array of open task objects of the specified type and status.
   */
  const getOpenTasksByTypeIdAndStatus = (typeId, status) => {
    const allOpenTasks = getOpenTasks();
    return allOpenTasks.filter(task => task.st_TaskTypeId === typeId && task.st_Status === status);
  };

  return {
    getOpenTasks,
    getOpenTasksByTypeId,
    getOpenTasksByPrefix,
    createTask,
    getOpenTaskByTypeId,
    getTaskById,
    getOpenTasksByTypeIdAndStatus,
    invalidateCache, // Export cache invalidation for external use
  };
})();

/**
 * Completes a task by its ID. This is a global function callable from the client-side.
 * @param {string} taskId The ID of the task to complete.
 * @returns {boolean} True if successful.
 */
function WebAppTasks_completeTaskById(taskId) {
  if (!taskId) {
    throw new Error('Task ID is required to complete a task.');
  }
  const result = TaskService.completeTask(taskId);

  // Invalidate cache after task modification
  if (result) {
    WebAppTasks.invalidateCache();
  }

  return result;
}

/**
 * Gets all open tasks for the Tasks view.
 * @returns {Object} { error: string|null, data: Array }
 */
function WebAppTasks_getAllOpenTasks() {
  try {
    const tasks = WebAppTasks.getOpenTasks(true); // Force refresh
    return { error: null, data: tasks };
  } catch (e) {
    LoggerService.error('WebAppTasks', 'getAllOpenTasks', e.message, e);
    return { error: e.message, data: [] };
  }
}

/**
 * Updates a task's status.
 * @param {string} taskId The task ID.
 * @param {string} newStatus The new status.
 * @returns {Object} { error: string|null, success: boolean }
 */
function WebAppTasks_updateTaskStatus(taskId, newStatus) {
  try {
    const result = TaskService.updateTaskStatus(taskId, newStatus);
    if (result) {
      WebAppTasks.invalidateCache();
    }
    return { error: null, success: result };
  } catch (e) {
    LoggerService.error('WebAppTasks', 'updateTaskStatus', e.message, e);
    return { error: e.message, success: false };
  }
}

/**
 * Gets task statistics for dashboard.
 * @returns {Object} { error: string|null, data: Object }
 */
function WebAppTasks_getStats() {
  try {
    const tasks = WebAppTasks.getOpenTasks();
    const stats = {
      total: tasks.length,
      byStatus: {},
      byPriority: {},
      byType: {}
    };

    tasks.forEach(task => {
      const status = task.st_Status || 'Unknown';
      const priority = task.st_Priority || 'Normal';
      const type = task.st_TaskTypeId || 'unknown';

      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return { error: null, data: stats };
  } catch (e) {
    LoggerService.error('WebAppTasks', 'getStats', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Gets valid task statuses for dropdown.
 * @returns {Array<string>} List of valid statuses.
 */
function WebAppTasks_getStatusOptions() {
  return ['New', 'In Progress', 'Review', 'Blocked', 'Done', 'Cancelled'];
}