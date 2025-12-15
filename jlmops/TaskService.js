/**
 * @file TaskService.js
 * @description This service manages tasks, including creation with de-duplication.
 *
 * PERFORMANCE: Automatically invalidates WebAppTasks cache after task modifications
 * to ensure dashboard displays fresh data.
 */

const TaskService = (function() {

  /**
   * Helper function to invalidate WebAppTasks cache after task modifications.
   * This ensures dashboard data stays fresh without manual cache management.
   */
  function invalidateTaskCache() {
    try {
      if (typeof WebAppTasks !== 'undefined' && WebAppTasks.invalidateCache) {
        WebAppTasks.invalidateCache();
      }
    } catch (e) {
      // Silent failure - cache invalidation is a performance optimization, not critical
      console.log('TaskService: Could not invalidate WebAppTasks cache:', e.message);
    }
  }

  /**
   * Creates a new task if an identical open task does not already exist.
   * @param {string} taskTypeId The configuration name of the task type (e.g., 'task.validation.sku_not_in_comax').
   * @param {string} linkedEntityId The primary identifier of the item this task is about (e.g., a SKU or Product ID).
   * @param {string} linkedEntityName The human-readable name of the entity this task is about (e.g., product name).
   * @param {string} title A short, descriptive title for the task.
   * @param {string} notes Additional details or context for the task.
   * @param {string} [sessionId=null] The session ID associated with this task.
   * @param {Object} [options={}] Additional options: { projectId, startDate }
   * @returns {Object|null} The created task object, or null if a duplicate existed or creation failed.
   */
  function createTask(taskTypeId, linkedEntityId, linkedEntityName, title, notes, sessionId = null, options = {}) {
    try {
      const taskTypeConfig = ConfigService.getConfig(taskTypeId);
      if (!taskTypeConfig) {
        throw new Error(`Task type configuration for '${taskTypeId}' not found.`);
      }

      const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
      const sheetName = 'SysTasks';

      const sheet = dataSpreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Task sheet '${sheetName}' not found in spreadsheet JLMops_Data.`);
      }

      const headers = taskSchema.headers.split(',');
      const typeIdCol = headers.indexOf('st_TaskTypeId');
      const entityIdCol = headers.indexOf('st_LinkedEntityId');
      const statusCol = headers.indexOf('st_Status');

      // --- SKU Validation for Product Tasks ---
      // Product-related tasks should use SKU (numeric) as linkedEntityId
      if (taskTypeId.includes('product') || taskTypeId.includes('vintage') || taskTypeId.includes('onboarding')) {
        const trimmedEntityId = String(linkedEntityId).trim();
        if (!/^\d+$/.test(trimmedEntityId)) {
          logger.warn('TaskService', 'createTask',
            `Product-related task '${taskTypeId}' has non-SKU entityId: '${linkedEntityId}'. Expected numeric SKU.`);
        }
      }

      // --- De-duplication Check ---
      if (sheet.getLastRow() > 1) {
        const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        const duplicateRow = existingRows.find(row => 
          row[typeIdCol] === taskTypeId &&
          String(row[entityIdCol]).trim() === String(linkedEntityId).trim() &&
          (row[statusCol] !== 'Done' && row[statusCol] !== 'Closed')
        );

        if (duplicateRow) {
          logger.info('TaskService', 'createTask', `Duplicate task detected for type '${taskTypeId}' and entity '${linkedEntityId}'. Aborting creation.`);
          return null;
        }
      }

      // --- Create New Task ---
      const taskId = Utilities.getUuid();
      const newRow = new Array(headers.length).fill('');
      
      newRow[headers.indexOf('st_TaskId')] = taskId;
      newRow[headers.indexOf('st_TaskTypeId')] = taskTypeId;
      if (sessionId) {
          const sessionIdIdx = headers.indexOf('st_SessionId');
          if (sessionIdIdx > -1) newRow[sessionIdIdx] = sessionId;
      }
      newRow[headers.indexOf('st_Topic')] = taskTypeConfig.topic;
      newRow[headers.indexOf('st_Title')] = title;
      newRow[headers.indexOf('st_Status')] = taskTypeConfig.initial_status;
      newRow[headers.indexOf('st_Priority')] = taskTypeConfig.default_priority;
      newRow[headers.indexOf('st_LinkedEntityId')] = linkedEntityId;
      const linkedEntityNameIdx = headers.indexOf('st_LinkedEntityName');
      if (linkedEntityNameIdx > -1) newRow[linkedEntityNameIdx] = linkedEntityName;
      newRow[headers.indexOf('st_CreatedDate')] = new Date();
      newRow[headers.indexOf('st_Notes')] = notes;

      // Auto-route to project based on topic (if not explicitly provided)
      if (!options.projectId) {
        const routing = ConfigService.getConfig('task.routing.topic_to_project');
        if (routing && taskTypeConfig.topic && routing[taskTypeConfig.topic]) {
          options.projectId = routing[taskTypeConfig.topic];
        }
      }

      // Handle optional project and start date
      if (options.projectId) {
        const projectIdIdx = headers.indexOf('st_ProjectId');
        if (projectIdIdx > -1) newRow[projectIdIdx] = options.projectId;
      }
      if (options.startDate) {
        const startDateIdx = headers.indexOf('st_StartDate');
        if (startDateIdx > -1) newRow[startDateIdx] = options.startDate;
      }

      sheet.appendRow(newRow);
      SpreadsheetApp.flush(); // Force the changes to be saved immediately.
      logger.info('TaskService', 'createTask', `Task created. Type: ${taskTypeId}, Entity: ${linkedEntityId}, Name: ${linkedEntityName}.`, { sessionId: sessionId });

      // Invalidate cache after task creation
      invalidateTaskCache();

      return { id: taskId };

    } catch (e) {
      logger.error('TaskService', 'createTask', `CRITICAL: Error creating task: ${e.message}`, e);
      throw e; // Re-throw the error to halt execution and notify admin
    }
  }

  function hasOpenTasks(taskTypeId) {
    try {
      const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
      const sheetName = 'SysTasks';

      const sheet = dataSpreadsheet.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) {
        return false;
      }

      const headers = taskSchema.headers.split(',');
      const typeIdCol = headers.indexOf('st_TaskTypeId');
      const statusCol = headers.indexOf('st_Status');

      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      return existingRows.some(row => 
        row[typeIdCol] === taskTypeId &&
        row[statusCol] !== 'Done' && row[statusCol] !== 'Closed'
      );

    } catch (e) {
      logger.error('TaskService', 'hasOpenTasks', `Error checking for open tasks of type ${taskTypeId}: ${e.message}`, e);
      return false; // Assume no open tasks on error to avoid blocking workflows
    }
  }

  /**
   * Marks a specific task as 'Done'.
   * @param {string} taskId The UUID of the task to complete.
   * @returns {boolean} True if the task was found and updated, otherwise false.
   */
  function completeTask(taskId) {
    try {
      const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
      const sheetName = 'SysTasks';

      const sheet = dataSpreadsheet.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) {
        logger.warn('TaskService', 'completeTask', `Task sheet '${sheetName}' not found or is empty.`);
        return false;
      }

      const headers = taskSchema.headers.split(',');
      const taskIdCol = headers.indexOf('st_TaskId');
      const statusCol = headers.indexOf('st_Status');
      const doneDateCol = headers.indexOf('st_DoneDate'); // Corrected from st_CompletedDate

      if (taskIdCol === -1) throw new Error("Required column 'st_TaskId' not found in SysTasks sheet.");
      if (statusCol === -1) throw new Error("Required column 'st_Status' not found in SysTasks sheet.");
      if (doneDateCol === -1) throw new Error("Required column 'st_DoneDate' not found in SysTasks sheet.");


      const taskIds = sheet.getRange(2, taskIdCol + 1, sheet.getLastRow() - 1, 1).getValues().flat();
      const rowIndex = taskIds.findIndex(id => id === taskId);

      if (rowIndex === -1) {
        logger.warn('TaskService', 'completeTask', `Task with ID '${taskId}' not found.`);
        return false;
      }

      const sheetRow = rowIndex + 2; // +1 for 1-based index, +1 for header row
      sheet.getRange(sheetRow, statusCol + 1).setValue('Done');
      sheet.getRange(sheetRow, doneDateCol + 1).setValue(new Date());

      logger.info('TaskService', 'completeTask', `Task '${taskId}' marked as 'Done'.`);

      // Invalidate cache after task completion
      invalidateTaskCache();

      return true;

    } catch (e) {
      logger.error('TaskService', 'completeTask', `Error completing task '${taskId}': ${e.message}`, e);
      return false;
    }
  }

  /**
   * Updates the status of a specific task.
   * @param {string} taskId The UUID of the task to update.
   * @param {string} newStatus The new status to set for the task (e.g., 'Review', 'In Progress', 'Done').
   * @returns {boolean} True if the task was found and updated, otherwise false.
   */
  function updateTaskStatus(taskId, newStatus) {
    try {
      const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
      const sheetName = 'SysTasks';

      const sheet = dataSpreadsheet.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) {
        logger.warn('TaskService', 'updateTaskStatus', `Task sheet '${sheetName}' not found or is empty.`);
        return false;
      }

      const headers = taskSchema.headers.split(',');
      const taskIdCol = headers.indexOf('st_TaskId');
      const statusCol = headers.indexOf('st_Status');
      const doneDateCol = headers.indexOf('st_DoneDate'); // Corrected from st_CompletedDate

      if (taskIdCol === -1) throw new Error("Required column 'st_TaskId' not found in SysTasks sheet.");
      if (statusCol === -1) throw new Error("Required column 'st_Status' not found in SysTasks sheet.");
      // DoneDate is optional if not setting to 'Done'

      const taskIds = sheet.getRange(2, taskIdCol + 1, sheet.getLastRow() - 1, 1).getValues().flat();
      const rowIndex = taskIds.findIndex(id => id === taskId);

      if (rowIndex === -1) {
        logger.warn('TaskService', 'updateTaskStatus', `Task with ID '${taskId}' not found.`);
        return false;
      }

      const sheetRow = rowIndex + 2; // +1 for 1-based index, +1 for header row
      sheet.getRange(sheetRow, statusCol + 1).setValue(newStatus);

      // If the new status is 'Done' or 'Closed', also set the DoneDate
      if ((newStatus === 'Done' || newStatus === 'Closed') && doneDateCol !== -1) {
        sheet.getRange(sheetRow, doneDateCol + 1).setValue(new Date());
      } else if ((newStatus !== 'Done' && newStatus !== 'Closed') && doneDateCol !== -1) {
        // If status is changed from a 'Done/Closed' state to active, clear the DoneDate
        sheet.getRange(sheetRow, doneDateCol + 1).clearContent();
      }

      logger.info('TaskService', 'updateTaskStatus', `Task '${taskId}' status updated to '${newStatus}'.`);

      // Invalidate cache after task status update
      invalidateTaskCache();

      return true;

    } catch (e) {
      logger.error('TaskService', 'updateTaskStatus', `Error updating task status for '${taskId}' to '${newStatus}': ${e.message}`, e);
      return false;
    }
  }

  /**
   * Gets all tasks linked to a specific project.
   * @param {string} projectId The project ID to filter by
   * @returns {Object[]} Array of task objects
   */
  function getTasksByProject(projectId) {
    try {
      const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
      const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
      const sheetName = 'SysTasks';

      const sheet = dataSpreadsheet.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) {
        return [];
      }

      const headers = taskSchema.headers.split(',');
      const projectIdCol = headers.indexOf('st_ProjectId');

      if (projectIdCol === -1) {
        logger.warn('TaskService', 'getTasksByProject', 'st_ProjectId column not found in schema');
        return [];
      }

      const dataRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      const tasks = [];

      dataRows.forEach(row => {
        if (row[projectIdCol] === projectId) {
          const task = {};
          headers.forEach((header, idx) => {
            task[header] = row[idx];
          });
          tasks.push(task);
        }
      });

      return tasks;

    } catch (e) {
      logger.error('TaskService', 'getTasksByProject', `Error getting tasks for project '${projectId}': ${e.message}`, e);
      return [];
    }
  }

  return {
    createTask: createTask,
    hasOpenTasks: hasOpenTasks,
    completeTask: completeTask,
    updateTaskStatus: updateTaskStatus,
    getTasksByProject: getTasksByProject
  };

})();

