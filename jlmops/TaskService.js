/**
 * @file TaskService.js
 * @description This service manages tasks.
 */

/**
 * TaskService provides methods for managing tasks within the system.
 */
function TaskService() {
  const TASK_SHEET_NAME = "SysTasks"; // Assuming SysTasks is the master task sheet

  /**
   * Creates a new task.
   * @param {Object} taskData The data for the new task (e.g., { title: "...", description: "...", assignee: "...", type: "..." }).
   * @returns {Object|null} The created task object with an ID, or null if creation fails.
   */
  this.createTask = function(taskData) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(TASK_SHEET_NAME);

      if (!sheet) {
        logger.error(`Task sheet '${TASK_SHEET_NAME}' not found.`);
        return null;
      }

      // Get headers to ensure correct column order
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow = [];

      // Map taskData to the correct column order
      headers.forEach(header => {
        newRow.push(taskData[header] !== undefined ? taskData[header] : '');
      });

      // Assign a simple unique ID (for demonstration, in real app use Utilities.getUuid() or similar)
      const taskId = Utilities.getUuid();
      // Assuming 'ID' is one of the headers
      const idIndex = headers.indexOf('ID');
      if (idIndex !== -1) {
        newRow[idIndex] = taskId;
      } else {
        // If no 'ID' column, append it or handle as per sheet structure
        newRow.push(taskId);
        logger.warn("No 'ID' column found in task sheet. Appending ID to the end.");
      }

      sheet.appendRow(newRow);
      logger.info(`Task '${taskData.title}' created successfully with ID: ${taskId}.`);

      // Return the created task data including the new ID
      return { ...taskData, ID: taskId };

    } catch (e) {
      logger.error(`Error creating task: ${e.message}`, e, taskData);
      return null;
    }
  };

  /**
   * Retrieves all tasks from the task sheet.
   * @returns {Array<Object>} An array of task objects.
   */
  this.getAllTasks = function() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(TASK_SHEET_NAME);

      if (!sheet) {
        logger.error(`Task sheet '${TASK_SHEET_NAME}' not found.`);
        return [];
      }

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length === 0) {
        logger.info(`No data found in task sheet '${TASK_SHEET_NAME}'.`);
        return [];
      }

      const headers = values[0];
      const tasks = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const task = {};
        headers.forEach((header, index) => {
          task[header] = row[index];
        });
        tasks.push(task);
      }

      logger.info(`Successfully retrieved ${tasks.length} tasks from '${TASK_SHEET_NAME}'.`);
      return tasks;

    } catch (e) {
      logger.error(`Error getting all tasks: ${e.message}`, e);
      return [];
    }
  };

  /**
   * Updates the status of a specific task.
   * @param {string} taskId The ID of the task to update.
   * @param {string} newStatus The new status for the task.
   * @returns {boolean} True if the task was updated successfully, false otherwise.
   */
  this.updateTaskStatus = function(taskId, newStatus) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(TASK_SHEET_NAME);

      if (!sheet) {
        logger.error(`Task sheet '${TASK_SHEET_NAME}' not found.`);
        return false;
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const idColumnIndex = headers.indexOf('ID');
      const statusColumnIndex = headers.indexOf('Status');

      if (idColumnIndex === -1 || statusColumnIndex === -1) {
        logger.error("Required 'ID' or 'Status' column not found in task sheet.");
        return false;
      }

      const data = sheet.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) { // Start from 1 to skip headers
        if (data[i][idColumnIndex] === taskId) {
          sheet.getRange(i + 1, statusColumnIndex + 1).setValue(newStatus);
          logger.info(`Task ${taskId} status updated to: ${newStatus}.`);
          updated = true;
          break;
        }
      }

      if (!updated) {
        logger.warn(`Task with ID ${taskId} not found for status update.`);
      }
      return updated;

    } catch (e) {
      logger.error(`Error updating task status for ID ${taskId}: ${e.message}`, e);
      return false;
    }
  };

  // TODO: Add methods for getting tasks by assignee/type, deleting tasks, etc.
}

// Global instance for easy access throughout the project
const taskService = new TaskService();