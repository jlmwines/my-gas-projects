/**
 * @file WebAppTasks.js
 * @description This script acts as a Data Provider for all task-related data.
 * It contains reusable functions for fetching and preparing task data from the
 * backend services (e.g., TaskService) for consumption by UI View Controllers.
 *
 * As per the architecture, this script should not be called directly from the HTML.
 * It should only be called by View Controller scripts (e.g., WebAppDashboard.js).
 */

// eslint-disable-next-line no-unused-vars
const WebAppTasks = (() => {
  /**
   * Retrieves all tasks that are not in a 'Done' or 'Cancelled' state.
   * @returns {Array<Object>} An array of open task objects, where each object is a map of header names to values.
   */
  const getOpenTasks = () => {
    try {
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
   * Wraps the TaskService.createTask function.
   * @param {string} typeId - The type of task to create.
   * @param {string} entityId - The ID of the entity this task relates to.
   * @param {string} title - The title of the task.
   * @param {string} notes - The notes for the task.
   * @returns {Object} The created task object.
   */
  const createTask = (typeId, entityId, title, notes) => {
    return TaskService.createTask(typeId, entityId, title, notes);
  };

  /**
   * Wraps the TaskService.completeTask function.
   * @param {string} taskId - The ID of the task to complete.
   * @returns {boolean} True if the task was completed successfully.
   */
  const completeTask = (taskId) => {
    if (!taskId) {
      throw new Error('Task ID is required to complete a task.');
    }
    return TaskService.completeTask(taskId);
  };

  return {
    getOpenTasks,
    getOpenTasksByTypeId,
    getOpenTasksByPrefix,
    createTask,
    completeTask,
  };
})();
