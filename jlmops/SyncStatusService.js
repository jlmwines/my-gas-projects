/**
 * @file SyncStatusService.js
 * @description Simple, event-driven status tracking for sync workflow.
 * Each job writes its own status as it happens. UI just reads and displays.
 */

const SyncStatusService = (function() {
  const SERVICE_NAME = 'SyncStatusService';
  const STATUS_SHEET_NAME = 'SysSyncStatus';

  // Simple in-memory cache for status queries
  let _statusCache = null;
  let _statusCacheTime = 0;
  const STATUS_CACHE_TTL = 2000; // 2 seconds

  /**
   * Writes a status update for a specific step in the sync workflow.
   * @param {string} sessionId - The sync session ID
   * @param {object} statusData - Status information
   *   {
   *     step: number (1-5),
   *     stepName: string,
   *     status: "waiting" | "processing" | "completed" | "failed",
   *     message: string,
   *     details: object (optional)
   *   }
   */
  function writeStatus(sessionId, statusData) {
    const functionName = 'writeStatus';

    try {
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();

      // Get or create status sheet
      let statusSheet = logSpreadsheet.getSheetByName(STATUS_SHEET_NAME);
      if (!statusSheet) {
        statusSheet = logSpreadsheet.insertSheet(STATUS_SHEET_NAME);
        // Add headers
        statusSheet.appendRow(['Timestamp', 'SessionID', 'Step', 'StepName', 'Status', 'Message', 'Details']);
      }

      const timestamp = new Date().toISOString();
      const details = statusData.details ? JSON.stringify(statusData.details) : '';

      statusSheet.appendRow([
        timestamp,
        sessionId,
        statusData.step,
        statusData.stepName,
        statusData.status,
        statusData.message || '',
        details
      ]);

      // Don't log to execution log - status is already written to SysSyncStatus sheet

    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error writing status: ${e.message}`, e, { sessionId, statusData });
    }
  }

  /**
   * Gets the latest status for each step in a session.
   * Uses caching to reduce sheet reads on frequent polls.
   * @param {string} sessionId - The sync session ID
   * @returns {object} Status object with step1-5 and metadata
   */
  function getSessionStatus(sessionId) {
    const functionName = 'getSessionStatus';

    // Check cache first
    const now = Date.now();
    if (_statusCache && _statusCache.sessionId === sessionId && (now - _statusCacheTime) < STATUS_CACHE_TTL) {
      return _statusCache;
    }

    try {
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();

      const statusSheet = logSpreadsheet.getSheetByName(STATUS_SHEET_NAME);
      if (!statusSheet) {
        return getDefaultStatus(sessionId);
      }

      const data = statusSheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);

      // Filter for this session
      const sessionRows = rows.filter(row => row[1] === sessionId);

      if (sessionRows.length === 0) {
        return getDefaultStatus(sessionId);
      }

      // Get latest status for each step
      const stepStatuses = {};
      for (let step = 1; step <= 5; step++) {
        const stepRows = sessionRows.filter(row => row[2] === step);
        if (stepRows.length > 0) {
          const latest = stepRows[stepRows.length - 1]; // Last entry for this step
          stepStatuses[`step${step}`] = {
            step: latest[2],
            stepName: latest[3],
            status: latest[4],
            message: latest[5],
            details: latest[6] ? JSON.parse(latest[6]) : null,
            timestamp: latest[0]
          };
        } else {
          stepStatuses[`step${step}`] = null;
        }
      }

      // Determine current active step
      let currentStep = 1;
      for (let step = 1; step <= 5; step++) {
        const status = stepStatuses[`step${step}`];
        if (!status || status.status === 'waiting' || status.status === 'processing') {
          currentStep = step;
          break;
        }
        if (status.status === 'failed') {
          currentStep = step;
          break;
        }
        if (step === 5 && status.status === 'completed') {
          currentStep = 6; // All done
        }
      }

      const result = {
        sessionId,
        currentStep,
        step1: stepStatuses.step1,
        step2: stepStatuses.step2,
        step3: stepStatuses.step3,
        step4: stepStatuses.step4,
        step5: stepStatuses.step5,
        lastUpdated: sessionRows[sessionRows.length - 1][0]
      };

      // Update cache
      _statusCache = result;
      _statusCacheTime = Date.now();

      return result;

    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error getting session status: ${e.message}`, e, { sessionId });
      return getDefaultStatus(sessionId);
    }
  }

  /**
   * Returns a default empty status object.
   */
  function getDefaultStatus(sessionId) {
    return {
      sessionId: sessionId || null,
      currentStep: 1,
      step1: null,
      step2: null,
      step3: null,
      step4: null,
      step5: null,
      lastUpdated: null
    };
  }

  /**
   * Clears all status entries for a session (used on reset).
   */
  function clearSession(sessionId) {
    const functionName = 'clearSession';

    try {
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();

      const statusSheet = logSpreadsheet.getSheetByName(STATUS_SHEET_NAME);
      if (!statusSheet) return;

      const data = statusSheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);

      // Find rows to delete (in reverse to maintain indices)
      const rowsToDelete = [];
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i][1] === sessionId) {
          rowsToDelete.push(i + 2); // +2 because: 0-indexed array + 1 for header row
        }
      }

      // Delete rows
      rowsToDelete.forEach(rowIndex => {
        statusSheet.deleteRow(rowIndex);
      });

      // Don't log to execution log - status clearing is routine maintenance

    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error clearing session status: ${e.message}`, e, { sessionId });
    }
  }

  /**
   * Clears status entries for steps >= fromStep in a session.
   * Used when a step fails to clear all subsequent step statuses.
   * @param {string} sessionId - The sync session ID
   * @param {number} fromStep - Clear steps from this number onwards (inclusive)
   */
  function clearStepsFromSession(sessionId, fromStep) {
    const functionName = 'clearStepsFromSession';

    try {
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();

      const statusSheet = logSpreadsheet.getSheetByName(STATUS_SHEET_NAME);
      if (!statusSheet) return;

      const data = statusSheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);

      // Find rows to delete (in reverse to maintain indices)
      const rowsToDelete = [];
      for (let i = rows.length - 1; i >= 0; i--) {
        const rowSessionId = rows[i][1];
        const rowStep = rows[i][2];
        if (rowSessionId === sessionId && rowStep >= fromStep) {
          rowsToDelete.push(i + 2); // +2 because: 0-indexed array + 1 for header row
        }
      }

      // Delete rows
      rowsToDelete.forEach(rowIndex => {
        statusSheet.deleteRow(rowIndex);
      });

      // Don't log to execution log - status clearing is routine maintenance

    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error clearing steps from session: ${e.message}`, e, { sessionId, fromStep });
    }
  }

  /**
   * Gets recent failures from SysJobQueue for a session.
   * Used to show failure alerts to users.
   * @param {string} sessionId - The sync session ID
   * @returns {Array} Array of failure objects { jobType, error }
   */
  function getRecentFailures(sessionId) {
    const functionName = 'getRecentFailures';

    try {
      const logSpreadsheet = SheetAccessor.getLogSpreadsheet();

      const jobQueueSheet = logSpreadsheet.getSheetByName('SysJobQueue');
      if (!jobQueueSheet) {
        return [];
      }

      const data = jobQueueSheet.getDataRange().getValues();
      const headers = data[0];

      // Find column indices
      const statusCol = headers.indexOf('status');
      const sessionCol = headers.indexOf('session_id');
      const jobTypeCol = headers.indexOf('job_type');
      const errorCol = headers.indexOf('error_message');

      if (statusCol === -1 || sessionCol === -1) {
        logger.warn(SERVICE_NAME, functionName, 'SysJobQueue missing required columns');
        return [];
      }

      const failures = data.slice(1)
        .filter(row => row[sessionCol] === sessionId && row[statusCol] === 'FAILED')
        .map(row => ({
          jobType: row[jobTypeCol] || 'Unknown',
          error: row[errorCol] || 'No error message'
        }));

      return failures;

    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error getting recent failures: ${e.message}`, e, { sessionId });
      return [];
    }
  }

  return {
    writeStatus,
    getSessionStatus,
    clearSession,
    clearStepsFromSession,
    getDefaultStatus,
    getRecentFailures
  };
})();
