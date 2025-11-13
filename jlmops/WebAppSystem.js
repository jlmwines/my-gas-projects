/**
 * @file WebAppSystem.js
 * @description Provides backend functions for the System Health dashboard widget and view.
 */

const WebAppSystem = (function() {

  /**
   * Gathers various system health metrics.
   * @returns {Object} An object containing system health metrics.
   */
  function getSystemHealthMetrics() {
    const logSpreadsheetId = ConfigService.getConfig('system.spreadsheet.logs').id;
    const dataSpreadsheetId = ConfigService.getConfig('system.spreadsheet.data').id;
    const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
    const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    // --- Task-related metrics ---
    const taskSheetName = ConfigService.getConfig('system.sheet_names').SysTasks;
    const taskSheet = dataSpreadsheet.getSheetByName(taskSheetName);
    if (!taskSheet) throw new Error(`Sheet not found: ${taskSheetName}`);
    const taskData = taskSheet.getLastRow() > 1 ? taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, taskSheet.getLastColumn()).getValues() : [];
    const taskHeaders = taskSheet.getRange(1, 1, 1, taskSheet.getLastColumn()).getValues()[0];
    const taskHeaderMap = Object.fromEntries(taskHeaders.map((h, i) => [h, i]));

    let translationMissing = 0;
    let skuNotInComax = 0;
    let notOnWebInComax = 0; // This will now be populated from tasks

    taskData.forEach(row => {
      const status = row[taskHeaderMap['st_Status']];
      const typeId = row[taskHeaderMap['st_TaskTypeId']];
      if (status !== 'Done' && status !== 'Cancelled') {
        if (typeId === 'task.validation.translation_missing') {
          translationMissing++;
        }
        if (typeId === 'task.validation.sku_not_in_comax') {
          skuNotInComax++;
        }
        if (typeId === 'task.validation.comax_not_web_product') { // New task type
          notOnWebInComax++;
        }
      }
    });

    // --- Job Queue metrics ---
    const jobQueueSheet = logSpreadsheet.getSheetByName('SysJobQueue');
    if (!jobQueueSheet) throw new Error(`Sheet not found: SysJobQueue`);
    const jobStatuses = jobQueueSheet.getRange('C2:C').getValues().flat();
    const quarantinedJobs = jobStatuses.filter(s => s === 'QUARANTINED').length;

    return {
      translationMissing,
      skuNotInComax,
      notOnWebInComax,
      quarantinedJobs
    };
  }

  return {
    getSystemHealthMetrics: getSystemHealthMetrics
  };
})();