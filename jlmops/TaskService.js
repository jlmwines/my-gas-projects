/**
 * @file TaskService.js
 * @description This service manages tasks, including creation with de-duplication.
 */

const TaskService = (function() {

  /**
   * Creates a new task if an identical open task does not already exist.
   * @param {string} taskTypeId The configuration name of the task type (e.g., 'task.validation.sku_not_in_comax').
   * @param {string} linkedEntityId The primary identifier of the item this task is about (e.g., a SKU or Product ID).
   * @param {string} title A short, descriptive title for the task.
   * @param {string} notes Additional details or context for the task.
   * @returns {Object|null} The created task object, or null if a duplicate existed or creation failed.
   */
  function createTask(taskTypeId, linkedEntityId, title, notes) {
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

      // --- De-duplication Check ---
      if (sheet.getLastRow() > 1) {
        const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        const duplicateRow = existingRows.find(row => 
          row[typeIdCol] === taskTypeId &&
          String(row[entityIdCol]).trim() === String(linkedEntityId).trim() &&
          (row[statusCol] !== 'Done' && row[statusCol] !== 'Closed')
        );

        if (duplicateRow) {
          const duplicateRowObject = {};
          headers.forEach((header, index) => {
              duplicateRowObject[header] = duplicateRow[index];
          });
          LoggerService.warn('TaskService', 'createTask', `Duplicate task detected. Aborting creation.`, {
              newTask: { type: taskTypeId, entity: linkedEntityId },
              existingDuplicate: duplicateRowObject
          });
          return null;
        }
      }

      // --- Create New Task ---
      const taskId = Utilities.getUuid();
      const newRow = new Array(headers.length).fill('');
      
      newRow[headers.indexOf('st_TaskId')] = taskId;
      newRow[headers.indexOf('st_TaskTypeId')] = taskTypeId;
      newRow[headers.indexOf('st_Topic')] = taskTypeConfig.topic;
      newRow[headers.indexOf('st_Title')] = title;
      newRow[headers.indexOf('st_Status')] = taskTypeConfig.initial_status;
      newRow[headers.indexOf('st_Priority')] = taskTypeConfig.default_priority;
      newRow[headers.indexOf('st_LinkedEntityId')] = linkedEntityId;
      newRow[headers.indexOf('st_CreatedDate')] = new Date();
      newRow[headers.indexOf('st_Notes')] = notes;

      sheet.appendRow(newRow);
      SpreadsheetApp.flush(); // Force the changes to be saved immediately.
      LoggerService.info('TaskService', 'createTask', `Task created. Type: ${taskTypeId}, Entity: ${linkedEntityId}.`);
      
      return { id: taskId };

    } catch (e) {
      LoggerService.error('TaskService', 'createTask', `CRITICAL: Error creating task: ${e.message}`, e);
      throw e; // Re-throw the error to halt execution and notify admin
    }
  }

  return {
    createTask: createTask
  };

})();
