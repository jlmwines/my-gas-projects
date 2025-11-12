/**
 * @file WebAppInventory.js
 * @description This file contains functions for the inventory widget.
 */

/**
 * Gets the counts of various inventory-related tasks.
 *
 * @returns {object} An object containing the counts of inventory tasks.
 */
function getInventoryWidgetData() {
  const inventoryTaskTypes = [
    'task.validation.sku_not_in_comax',
    'task.validation.translation_missing',
    'task.validation.comax_internal_audit',
    'task.validation.field_mismatch',
    'task.validation.name_mismatch',
    'task.validation.web_master_discrepancy',
    'task.validation.comax_master_discrepancy',
    'task.validation.row_count_decrease',
    'task.validation.comax_not_web_product'
  ];

  try {
    const dataSpreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName('JLMops_Data').next());
    const taskSchema = ConfigService.getConfig('schema.data.SysTasks');
    const sheet = dataSpreadsheet.getSheetByName('SysTasks');

    if (!sheet) {
      throw new Error("Sheet 'SysTasks' not found");
    }

    const headers = taskSchema.headers.split(',');
    const typeIdCol = headers.indexOf('st_TaskTypeId');
    const statusCol = headers.indexOf('st_Status');

    const taskCounts = {};
    inventoryTaskTypes.forEach(taskType => {
      taskCounts[taskType] = 0;
    });

    if (sheet.getLastRow() > 1) {
      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      existingRows.forEach(row => {
        const taskType = row[typeIdCol];
        const status = row[statusCol];
        if (inventoryTaskTypes.includes(taskType) && status !== 'Done' && status !== 'Closed') {
          taskCounts[taskType]++;
        }
      });
    }

    return {
      error: null,
      data: taskCounts
    };
  } catch (e) {
    LoggerService.error('WebAppInventory', 'getInventoryWidgetData', `Error getting inventory widget data: ${e.message}`);
    return {
      error: `Error getting inventory widget data: ${e.message}`,
      data: null
    };
  }
}
