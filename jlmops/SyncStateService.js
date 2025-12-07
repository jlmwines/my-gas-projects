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

    // Always fetch invoice count (it's fast and informational for Step 0)
    try {
      state.invoiceFileCount = OrchestratorService.getInvoiceFileCount();
    } catch (e) {
      logger.warn(SERVICE_NAME, functionName, `Could not fetch invoice count: ${e.message}`);
      state.invoiceFileCount = -1; // Indicate error
    }

    // If there's an active session (even if completed/failed), refresh granular job statuses
    if (state.sessionId && state.currentStage !== 'IDLE') {
      try {
        const ordersStatus = OrchestratorService.getJobStatusInSession('import.drive.web_orders', state.sessionId);
        const productsStatus = OrchestratorService.getJobStatusInSession('import.drive.web_products_en', state.sessionId);
        const translationsStatus = OrchestratorService.getJobStatusInSession('import.drive.web_translations_he', state.sessionId);

        state.webOrdersJobStatus = mapNotFoundToNotStarted(ordersStatus);
        state.webProductsJobStatus = mapNotFoundToNotStarted(productsStatus);
        state.webTranslationsJobStatus = mapNotFoundToNotStarted(translationsStatus);
        state.comaxProductsJobStatus = mapNotFoundToNotStarted(OrchestratorService.getJobStatusInSession('import.drive.comax_products', state.sessionId));
        state.masterValidationJobStatus = mapNotFoundToNotStarted(OrchestratorService.getJobStatusInSession('job.periodic.validation.master', state.sessionId));
        state.webInventoryExportJobStatus = mapNotFoundToNotStarted(OrchestratorService.getJobStatusInSession('export.web.inventory', state.sessionId));

        // Don't log routine status refresh - creates noise during UI polling

        // --- NEW: Fetch latest log for UI feedback ---
        const latestLog = logger.getLatestLogForSession(state.sessionId);
        if (latestLog) {
            state.latestLogMessage = `${new Date(latestLog.timestamp).toLocaleTimeString()} - ${latestLog.message}`;
            // Use latest log timestamp as lastUpdated if state timestamp is older or missing
            if (!state.lastUpdated || new Date(latestLog.timestamp) > new Date(state.lastUpdated)) {
                 state.lastUpdated = latestLog.timestamp;
            }
        }

      } catch (e) {
        logger.error(SERVICE_NAME, functionName, `Error refreshing granular job statuses: ${e.message}`, e, { sessionId: state.sessionId });
        state.errorMessage = state.errorMessage ? state.errorMessage + "; Error refreshing job statuses." : "Error refreshing job statuses.";
      }
    }
    
    // Ensure lastUpdated has a value for UI if it's still missing
    if (!state.lastUpdated) {
        state.lastUpdated = new Date().toISOString();
    }

    return state;
  }

  function mapNotFoundToNotStarted(status) {
      return status === 'NOT_FOUND' ? 'NOT_STARTED' : status;
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
