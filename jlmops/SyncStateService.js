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
    try {
      const stateConfig = ConfigService.getConfig(SYNC_STATE_CONFIG_KEY);
      if (stateConfig && stateConfig.json) {
        const state = JSON.parse(stateConfig.json);
        logger.info(SERVICE_NAME, functionName, 'Successfully retrieved sync state.', { state: state });
        return state;
      }
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error retrieving or parsing sync state: ${e.message}`, e);
    }
    return getDefaultState();
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
      currentStage: 'IDLE', // IDLE, WEB_IMPORT_PROCESSING, WAITING_FOR_COMAX, COMAX_IMPORT_PROCESSING, VALIDATING, COMPLETE, FAILED
      lastUpdated: null,
      webImportStatus: 'PENDING',
      comaxImportStatus: 'PENDING',
      ordersImportStatus: 'PENDING',
      validationStatus: 'PENDING',
      exportStatus: 'PENDING',
      errorMessage: null
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

  return {
    getSyncState: getSyncState,
    setSyncState: setSyncState,
    resetSyncState: resetSyncState,
    isSessionStale: isSessionStale,
    getDefaultState: getDefaultState // Expose for testing/initialization
  };

})();

// Global instance for easy access
const syncStateService = SyncStateService;
