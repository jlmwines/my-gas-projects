/**
 * @file SyncSessionService.js
 * @description Single source of truth for sync workflow status.
 * Replaces the scattered state across SysConfig, SysSyncStatus, etc.
 *
 * All sync status reads and writes should go through this service.
 */

const SyncSessionService = (function() {
  const SERVICE_NAME = 'SyncSessionService';
  const SHEET_NAME = 'SysSyncSession';

  /**
   * Stage constants - clear names that say exactly what's happening.
   * These are displayed directly to users, so they must be readable.
   */
  const STAGES = {
    IDLE: 'IDLE',
    IMPORTING_WEB_PRODUCTS: 'IMPORTING_WEB_PRODUCTS',
    IMPORTING_WEB_ORDERS: 'IMPORTING_WEB_ORDERS',
    IMPORTING_WEB_DATA: 'IMPORTING_WEB_DATA',
    READY_TO_EXPORT_ORDERS: 'READY_TO_EXPORT_ORDERS',
    EXPORTING_ORDERS: 'EXPORTING_ORDERS',
    WAITING_ORDER_EXPORT_CONFIRM: 'WAITING_ORDER_EXPORT_CONFIRM',
    READY_TO_IMPORT_COMAX_PRODUCTS: 'READY_TO_IMPORT_COMAX_PRODUCTS',
    IMPORTING_COMAX_PRODUCTS: 'IMPORTING_COMAX_PRODUCTS',
    VALIDATING: 'VALIDATING',
    READY_TO_EXPORT_WEB_INVENTORY: 'READY_TO_EXPORT_WEB_INVENTORY',
    EXPORTING_WEB_INVENTORY: 'EXPORTING_WEB_INVENTORY',
    WAITING_WEB_EXPORT_CONFIRM: 'WAITING_WEB_EXPORT_CONFIRM',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED'
  };

  /**
   * Next action text for each stage - tells user what to do.
   */
  const NEXT_ACTIONS = {
    IDLE: 'Click Start to begin sync',
    IMPORTING_WEB_PRODUCTS: 'Please wait...',
    IMPORTING_WEB_ORDERS: 'Please wait...',
    IMPORTING_WEB_DATA: 'Please wait...',
    READY_TO_EXPORT_ORDERS: 'Click Export Orders',
    EXPORTING_ORDERS: 'Please wait...',
    WAITING_ORDER_EXPORT_CONFIRM: 'Upload file to Comax, then click Confirm',
    READY_TO_IMPORT_COMAX_PRODUCTS: 'Click Import Comax',
    IMPORTING_COMAX_PRODUCTS: 'Please wait...',
    VALIDATING: 'Please wait...',
    READY_TO_EXPORT_WEB_INVENTORY: 'Click Generate Export',
    EXPORTING_WEB_INVENTORY: 'Please wait...',
    WAITING_WEB_EXPORT_CONFIRM: 'Upload file to website, then click Confirm',
    COMPLETE: 'Sync complete',
    FAILED: 'Check error and retry'
  };

  /**
   * Gets the logs spreadsheet and SysSyncSession sheet.
   * Creates the sheet if it doesn't exist.
   */
  function _getSheet() {
    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();

    let sheet = logSpreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = logSpreadsheet.insertSheet(SHEET_NAME);
      // Add headers
      sheet.appendRow([
        'sss_SessionId',
        'sss_Stage',
        'sss_StageStartTime',
        'sss_NextAction',
        'sss_LastUpdate',
        'sss_ErrorMessage',
        'sss_StepDetails'
      ]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  /**
   * Gets the current sync status.
   * @returns {object} Status object with stage, nextAction, stepDetails, etc.
   */
  function getStatus() {
    const functionName = 'getStatus';
    try {
      const sheet = _getSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        // No session exists - return idle state
        return {
          sessionId: null,
          stage: STAGES.IDLE,
          stageStartTime: null,
          nextAction: NEXT_ACTIONS.IDLE,
          lastUpdate: null,
          errorMessage: null,
          stepDetails: { step1: null, step2: null, step3: null, step4: null, step5: null }
        };
      }

      // Get the last row (current session)
      const row = sheet.getRange(lastRow, 1, 1, 7).getValues()[0];

      return {
        sessionId: row[0],
        stage: row[1] || STAGES.IDLE,
        stageStartTime: row[2],
        nextAction: row[3] || NEXT_ACTIONS[row[1]] || '',
        lastUpdate: row[4],
        errorMessage: row[5] || null,
        stepDetails: row[6] ? JSON.parse(row[6]) : { step1: null, step2: null, step3: null, step4: null, step5: null }
      };
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error getting status: ${e.message}`, e);
      return {
        sessionId: null,
        stage: STAGES.IDLE,
        stageStartTime: null,
        nextAction: NEXT_ACTIONS.IDLE,
        lastUpdate: null,
        errorMessage: null,
        stepDetails: { step1: null, step2: null, step3: null, step4: null, step5: null }
      };
    }
  }

  /**
   * Starts a new sync session.
   * @param {string} sessionId - The session ID
   * @returns {object} The new status
   */
  function startSession(sessionId) {
    const functionName = 'startSession';
    try {
      const sheet = _getSheet();
      const now = new Date().toISOString();

      sheet.appendRow([
        sessionId,
        STAGES.IMPORTING_WEB_DATA,
        now,
        NEXT_ACTIONS.IMPORTING_WEB_DATA,
        now,
        '',
        JSON.stringify({ step1: 'processing', step2: null, step3: null, step4: null, step5: null })
      ]);

      logger.info(SERVICE_NAME, functionName, `Started new sync session: ${sessionId}`);
      return getStatus();
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error starting session: ${e.message}`, e);
      throw e;
    }
  }

  /**
   * Updates the current stage.
   * @param {string} stage - The new stage (use STAGES constants)
   * @returns {object} The updated status
   */
  function setStage(stage) {
    const functionName = 'setStage';
    try {
      const sheet = _getSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        throw new Error('No active session');
      }

      const now = new Date().toISOString();
      const nextAction = NEXT_ACTIONS[stage] || '';

      // Update stage, stageStartTime, nextAction, lastUpdate
      sheet.getRange(lastRow, 2).setValue(stage);
      sheet.getRange(lastRow, 3).setValue(now);
      sheet.getRange(lastRow, 4).setValue(nextAction);
      sheet.getRange(lastRow, 5).setValue(now);

      // Clear error message if not failed
      if (stage !== STAGES.FAILED) {
        sheet.getRange(lastRow, 6).setValue('');
      }

      SpreadsheetApp.flush();
      logger.info(SERVICE_NAME, functionName, `Stage updated to: ${stage}`);
      return getStatus();
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error setting stage: ${e.message}`, e);
      throw e;
    }
  }

  /**
   * Marks a step as completed, processing, or failed.
   * @param {number} stepNum - Step number (1-5)
   * @param {string} status - 'processing', 'completed', 'failed', 'waiting'
   * @returns {object} The updated status
   */
  function setStepStatus(stepNum, status) {
    const functionName = 'setStepStatus';
    try {
      const sheet = _getSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        throw new Error('No active session');
      }

      const now = new Date().toISOString();

      // Get current step details
      const stepDetailsCell = sheet.getRange(lastRow, 7).getValue();
      const stepDetails = stepDetailsCell ? JSON.parse(stepDetailsCell) : {};

      // Update the step
      stepDetails['step' + stepNum] = status;

      // Update stepDetails and lastUpdate
      sheet.getRange(lastRow, 7).setValue(JSON.stringify(stepDetails));
      sheet.getRange(lastRow, 5).setValue(now);

      SpreadsheetApp.flush();
      logger.info(SERVICE_NAME, functionName, `Step ${stepNum} status: ${status}`);
      return getStatus();
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error setting step status: ${e.message}`, e);
      throw e;
    }
  }

  /**
   * Marks the sync as failed with an error message.
   * @param {string} errorMessage - The error message
   * @returns {object} The updated status
   */
  function fail(errorMessage) {
    const functionName = 'fail';
    try {
      const sheet = _getSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        throw new Error('No active session');
      }

      const now = new Date().toISOString();

      // Update stage, nextAction, lastUpdate, errorMessage
      sheet.getRange(lastRow, 2).setValue(STAGES.FAILED);
      sheet.getRange(lastRow, 4).setValue(NEXT_ACTIONS.FAILED);
      sheet.getRange(lastRow, 5).setValue(now);
      sheet.getRange(lastRow, 6).setValue(errorMessage);

      SpreadsheetApp.flush();
      logger.error(SERVICE_NAME, functionName, `Sync failed: ${errorMessage}`);
      return getStatus();
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error marking failed: ${e.message}`, e);
      throw e;
    }
  }

  /**
   * Completes the current sync session.
   * @returns {object} The updated status
   */
  function complete() {
    const functionName = 'complete';
    try {
      const sheet = _getSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        throw new Error('No active session');
      }

      const now = new Date().toISOString();

      // Update stage, nextAction, lastUpdate
      sheet.getRange(lastRow, 2).setValue(STAGES.COMPLETE);
      sheet.getRange(lastRow, 4).setValue(NEXT_ACTIONS.COMPLETE);
      sheet.getRange(lastRow, 5).setValue(now);

      SpreadsheetApp.flush();
      logger.info(SERVICE_NAME, functionName, 'Sync completed successfully');
      return getStatus();
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error completing: ${e.message}`, e);
      throw e;
    }
  }

  /**
   * Resets to idle state.
   * @returns {object} The idle status
   */
  function reset() {
    const functionName = 'reset';
    try {
      const sheet = _getSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow >= 2) {
        const now = new Date().toISOString();

        // Update the current row to IDLE
        sheet.getRange(lastRow, 2).setValue(STAGES.IDLE);
        sheet.getRange(lastRow, 4).setValue(NEXT_ACTIONS.IDLE);
        sheet.getRange(lastRow, 5).setValue(now);
        sheet.getRange(lastRow, 6).setValue('');

        SpreadsheetApp.flush();
      }

      logger.info(SERVICE_NAME, functionName, 'Sync state reset to IDLE');
      return getStatus();
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error resetting: ${e.message}`, e);
      throw e;
    }
  }

  return {
    STAGES: STAGES,
    NEXT_ACTIONS: NEXT_ACTIONS,
    getStatus: getStatus,
    startSession: startSession,
    setStage: setStage,
    setStepStatus: setStepStatus,
    fail: fail,
    complete: complete,
    reset: reset
  };

})();
