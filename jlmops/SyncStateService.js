/**
 * @file SyncStateService.js
 * @description Manages the persistent state of the Periodic Sync workflow in SysConfig.
 */

const SyncStateService = (function() {
  const SYNC_STATE_CONFIG_KEY = 'system.sync.state';
  const SERVICE_NAME = 'SyncStateService';

  /**
   * Retrieves the current sync state from SysConfig.
   * @returns {object} The current sync state object. Returns a default empty state if not found or invalid.
   */
  function getSyncState() {
    const functionName = 'getSyncState';
    let state = getDefaultState(); // Initialize with default state
    try {
      // Force reload to get fresh state from database, not cache
      ConfigService.forceReload();
      const stateConfig = ConfigService.getConfig(SYNC_STATE_CONFIG_KEY);
      if (stateConfig && stateConfig.json) {
        // Merge stored state with default state to ensure new properties exist
        state = { ...state, ...JSON.parse(stateConfig.json) };
      }
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error retrieving or parsing sync state: ${e.message}`, e);
    }

    // Invoice count and job statuses are now stored in state JSON
    // - Invoice count: fetched once after web orders import
    // - Job statuses: checked by OrchestratorService.getJobStatusesBatch() when needed
    // No per-call lookups needed here anymore.

    // Ensure lastUpdated has a value for UI if it's still missing
    if (!state.lastUpdated) {
        state.lastUpdated = new Date().toISOString();
    }

    return state;
  }

  /**
   * Sets (overwrites) the entire sync state object in SysConfig.
   * @param {object} newState The new state object to save.
   */
  function setSyncState(newState) {
    const functionName = 'setSyncState';
    try {
      ConfigService.setConfig(SYNC_STATE_CONFIG_KEY, 'json', JSON.stringify(newState));
      ConfigService.forceReload(); // Ensure cache is updated
      logger.info(SERVICE_NAME, functionName, 'Successfully saved new sync state.', { newState: newState });
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error saving sync state: ${e.message}`, e, { newState: newState });
      throw e;
    }
  }

  /**
   * Resets the sync state to its default empty/initial state.
   */
  function resetSyncState() {
    const functionName = 'resetSyncState';
    const defaultState = getDefaultState();
    setSyncState(defaultState);
    logger.info(SERVICE_NAME, functionName, 'Sync state reset to default.', { defaultState: defaultState });
  }

  /**
   * Gets the default empty state for the sync workflow.
   * @returns {object} The default sync state.
   */
  function getDefaultState() {
    return {
      sessionId: null,
      currentStage: 'IDLE', // IDLE, WEB_IMPORT_PROCESSING, WAITING_FOR_COMAX, READY_FOR_COMAX_IMPORT, COMAX_IMPORT_PROCESSING, VALIDATING, READY_FOR_WEB_EXPORT, WEB_EXPORT_PROCESSING, WEB_EXPORT_GENERATED, COMPLETE, FAILED
      lastUpdated: null,
      errorMessage: null,
      // Granular job statuses for frontend feedback
      webOrdersJobStatus: 'NOT_STARTED',
      webProductsJobStatus: 'NOT_STARTED',
      webTranslationsJobStatus: 'NOT_STARTED',
      comaxProductsJobStatus: 'NOT_STARTED',
      masterValidationJobStatus: 'NOT_STARTED',
      webInventoryExportJobStatus: 'NOT_STARTED',
      // Counts
      ordersPendingExportCount: -1,
      comaxOrdersExported: false, // Initialize the flag as well
      invoiceFileCount: 0, // Invoice receipts awaiting processing

      // Filenames
      comaxOrderExportFilename: null,
      webExportFilename: null
    };
  }

  /**
   * Checks if the current sync session is stale based on a configurable timeout.
   * @param {number} [staleThresholdHours=12] How many hours before a session is considered stale.
   * @returns {boolean} True if the session is stale, false otherwise.
   */
  function isSessionStale(staleThresholdHours = 12) {
    const state = getSyncState();
    if (!state.sessionId || !state.lastUpdated || state.currentStage === 'IDLE' || state.currentStage === 'COMPLETE') {
      return false; // No active session or already complete
    }
    const lastUpdated = new Date(state.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return hoursDiff > staleThresholdHours;
  }

  /**
   * Lightweight read - just sessionId and currentStage from config.
   * No job queue lookups, no invoice count, no log fetch.
   * Use this for polling instead of getSyncState().
   */
  function getActiveSession() {
    const functionName = 'getActiveSession';
    try {
      ConfigService.forceReload();
      const stateConfig = ConfigService.getConfig(SYNC_STATE_CONFIG_KEY);
      if (stateConfig && stateConfig.json) {
        const parsed = JSON.parse(stateConfig.json);
        return {
          sessionId: parsed.sessionId || null,
          currentStage: parsed.currentStage || 'IDLE',
          lastUpdated: parsed.lastUpdated || null,
          errorMessage: parsed.errorMessage || null,
          ordersPendingExportCount: parsed.ordersPendingExportCount || 0,
          comaxOrdersExported: parsed.comaxOrdersExported || false,
          comaxOrderExportFilename: parsed.comaxOrderExportFilename || null,
          webExportFilename: parsed.webExportFilename || null,
          invoiceFileCount: parsed.invoiceFileCount || 0
        };
      }
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error reading active session: ${e.message}`, e);
    }
    return { sessionId: null, currentStage: 'IDLE', lastUpdated: null, errorMessage: null, comaxOrdersExported: false };
  }

  return {
    getSyncState: getSyncState,
    setSyncState: setSyncState,
    resetSyncState: resetSyncState,
    isSessionStale: isSessionStale,
    getDefaultState: getDefaultState,
    getActiveSession: getActiveSession
  };

})();

// Global instance for easy access
const syncStateService = SyncStateService;
