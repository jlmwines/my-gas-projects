/**
 * @file SyncStateService.js
 * @description Single source of truth for the Daily Sync workflow state.
 * Stores one JSON object in SysConfig with stage, step statuses, and session context.
 */

const SyncStateService = (function() {
  const SYNC_STATE_CONFIG_KEY = 'system.sync.state';
  const SERVICE_NAME = 'SyncStateService';

  /**
   * All valid stages in the sync state machine.
   * WAITING_* = user action needed, *ING_* = system processing.
   */
  const STAGES = {
    IDLE:                   'IDLE',
    IMPORTING_PRODUCTS:     'IMPORTING_PRODUCTS',
    IMPORTING_ORDERS:       'IMPORTING_ORDERS',
    WAITING_ORDER_EXPORT:   'WAITING_ORDER_EXPORT',
    EXPORTING_ORDERS:       'EXPORTING_ORDERS',
    WAITING_ORDER_CONFIRM:  'WAITING_ORDER_CONFIRM',
    WAITING_COMAX_IMPORT:   'WAITING_COMAX_IMPORT',
    IMPORTING_COMAX:        'IMPORTING_COMAX',
    VALIDATING:             'VALIDATING',
    WAITING_WEB_EXPORT:     'WAITING_WEB_EXPORT',
    GENERATING_WEB_EXPORT:  'GENERATING_WEB_EXPORT',
    WAITING_WEB_CONFIRM:    'WAITING_WEB_CONFIRM',
    COMPLETE:               'COMPLETE',
    FAILED:                 'FAILED'
  };

  /**
   * Valid transitions: from -> [allowed next stages].
   */
  const TRANSITIONS = {
    IDLE:                   ['IMPORTING_PRODUCTS'],
    IMPORTING_PRODUCTS:     ['IMPORTING_ORDERS', 'FAILED'],
    IMPORTING_ORDERS:       ['WAITING_ORDER_EXPORT', 'WAITING_COMAX_IMPORT', 'FAILED'],
    WAITING_ORDER_EXPORT:   ['EXPORTING_ORDERS'],
    EXPORTING_ORDERS:       ['WAITING_ORDER_CONFIRM', 'WAITING_COMAX_IMPORT', 'FAILED'],
    WAITING_ORDER_CONFIRM:  ['WAITING_COMAX_IMPORT'],
    WAITING_COMAX_IMPORT:   ['IMPORTING_COMAX'],
    IMPORTING_COMAX:        ['VALIDATING', 'FAILED'],
    VALIDATING:             ['WAITING_WEB_EXPORT', 'FAILED'],
    WAITING_WEB_EXPORT:     ['GENERATING_WEB_EXPORT'],
    GENERATING_WEB_EXPORT:  ['WAITING_WEB_CONFIRM', 'COMPLETE', 'FAILED'],
    WAITING_WEB_CONFIRM:    ['COMPLETE'],
    COMPLETE:               ['IDLE'],
    FAILED:                 [] // Special: retry restores failedAtStage
  };

  /**
   * Retrieves the current sync state from SysConfig.
   * @returns {object} The current sync state object.
   */
  function getSyncState() {
    const functionName = 'getSyncState';
    let state = getDefaultState();
    try {
      ConfigService.forceReload();
      const stateConfig = ConfigService.getConfig(SYNC_STATE_CONFIG_KEY);
      if (stateConfig && stateConfig.json) {
        state = { ...state, ...JSON.parse(stateConfig.json) };
      }
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error retrieving sync state: ${e.message}`, e);
    }
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
      ConfigService.forceReload();
      logger.info(SERVICE_NAME, functionName, `State saved. Stage: ${newState.stage}`, { stage: newState.stage, sessionId: newState.sessionId });
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error saving sync state: ${e.message}`, e, { newState });
      throw e;
    }
  }

  /**
   * Transitions the sync state to a new stage with validation.
   * @param {string} newStage The target stage.
   * @param {object} [updates={}] Additional fields to merge into state.
   * @returns {object} The updated state.
   */
  function transition(newStage, updates) {
    const functionName = 'transition';
    const state = getSyncState();
    const currentStage = state.stage;

    // FAILED -> failedAtStage is handled by retryFailedStep, not here
    if (newStage !== 'FAILED') {
      const allowed = TRANSITIONS[currentStage] || [];
      if (!allowed.includes(newStage)) {
        throw new Error(`Invalid transition: ${currentStage} -> ${newStage}. Allowed: [${allowed.join(', ')}]`);
      }
    }

    // When transitioning to FAILED, record where we failed
    if (newStage === 'FAILED') {
      state.failedAtStage = currentStage;
    }

    state.stage = newStage;
    state.lastUpdated = new Date().toISOString();

    if (updates) {
      // Merge updates but don't overwrite stage/lastUpdated
      const { stage: _s, lastUpdated: _l, ...safeUpdates } = updates;
      Object.assign(state, safeUpdates);
    }

    setSyncState(state);
    return state;
  }

  /**
   * Updates a step's status and message in the current state.
   * @param {number} stepNum Step number (1-5)
   * @param {string} status Step status: 'waiting', 'processing', 'completed', 'skipped', 'failed'
   * @param {string} [message] Optional message for display
   * @returns {object} The updated state.
   */
  function updateStep(stepNum, status, message) {
    const state = getSyncState();
    if (!state.steps) state.steps = {};
    state.steps['step' + stepNum] = {
      status: status,
      message: message || null
    };
    state.lastUpdated = new Date().toISOString();
    setSyncState(state);
    return state;
  }

  /**
   * Resets the sync state to its default empty/initial state.
   */
  function resetSyncState() {
    const functionName = 'resetSyncState';
    const defaultState = getDefaultState();
    setSyncState(defaultState);
    logger.info(SERVICE_NAME, functionName, 'Sync state reset to default.');
  }

  /**
   * Gets the default empty state for the sync workflow.
   * @returns {object} The default sync state.
   */
  function getDefaultState() {
    return {
      sessionId: null,
      stage: STAGES.IDLE,
      lastUpdated: null,
      errorMessage: null,
      failedAtStage: null,

      steps: {
        step1: null,
        step2: null,
        step3: null,
        step4: null,
        step5: null
      },

      // Data context for UI display and guards
      ordersPendingExportCount: 0,
      comaxOrderExportFilename: null,
      webExportFilename: null,
      invoiceFileCount: 0,

      // Archive file IDs for retry (stored when files are archived)
      archiveFileIds: {}
    };
  }

  /**
   * Checks if the current sync session is stale based on a configurable timeout.
   * @param {number} [staleThresholdHours=12] Hours before a session is considered stale.
   * @returns {boolean} True if the session is stale.
   */
  function isSessionStale(staleThresholdHours) {
    if (staleThresholdHours === undefined) staleThresholdHours = 12;
    const state = getSyncState();
    if (!state.sessionId || !state.lastUpdated || state.stage === STAGES.IDLE || state.stage === STAGES.COMPLETE) {
      return false;
    }
    const lastUpdated = new Date(state.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return hoursDiff > staleThresholdHours;
  }

  /**
   * Lightweight read for polling — returns just the essential fields.
   * @returns {object} Minimal state for UI polling.
   */
  function getActiveSession() {
    const functionName = 'getActiveSession';
    try {
      ConfigService.forceReload();
      const stateConfig = ConfigService.getConfig(SYNC_STATE_CONFIG_KEY);
      if (stateConfig && stateConfig.json) {
        return JSON.parse(stateConfig.json);
      }
    } catch (e) {
      logger.error(SERVICE_NAME, functionName, `Error reading active session: ${e.message}`, e);
    }
    return getDefaultState();
  }

  return {
    STAGES: STAGES,
    TRANSITIONS: TRANSITIONS,
    getSyncState: getSyncState,
    setSyncState: setSyncState,
    transition: transition,
    updateStep: updateStep,
    resetSyncState: resetSyncState,
    getDefaultState: getDefaultState,
    isSessionStale: isSessionStale,
    getActiveSession: getActiveSession
  };

})();

// Global instance for easy access
const syncStateService = SyncStateService;
