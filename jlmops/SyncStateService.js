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
    // WAITING_WEB_CONFIRM is the post-CSV decision point. Two outgoing edges:
    // manual confirm → COMPLETE, or API push → PUSHING_WEB_INVENTORY.
    WAITING_WEB_CONFIRM:    'WAITING_WEB_CONFIRM',
    PUSHING_WEB_INVENTORY:  'PUSHING_WEB_INVENTORY',
    COMPLETE:               'COMPLETE',
    FAILED:                 'FAILED'
  };

  /**
   * Valid transitions: from -> [allowed next stages].
   */
  const TRANSITIONS = {
    IDLE:                   ['IMPORTING_PRODUCTS', 'WAITING_ORDER_EXPORT', 'WAITING_COMAX_IMPORT'],
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
    WAITING_WEB_CONFIRM:    ['COMPLETE', 'PUSHING_WEB_INVENTORY'],
    PUSHING_WEB_INVENTORY:  ['COMPLETE', 'FAILED'],
    COMPLETE:               ['IDLE'],
    FAILED:                 [] // Special: retry restores failedAtStage
  };

  /**
   * Thrown by mutateSyncState's fn when the fresh, locked state no longer
   * matches the stage the caller expected -- it lost a race to a concurrent
   * process. Carries the fresh (unwritten) state so mutateSyncStateBestEffort
   * can return it without a second, unlocked read. Never a sync failure.
   */
  class SyncStageStaleError extends Error {
    constructor(message, state) {
      super(message);
      this.name = 'SyncStageStaleError';
      this.state = state;
    }
  }

  /**
   * Thrown by mutateSyncState when withScriptLock could not acquire the lock
   * in time. Message is fixed here, at construction, so every caller gets
   * the same clear text whether it re-throws this or lets it propagate as-is.
   */
  class SyncLockContentionError extends Error {
    constructor() {
      super('The sync system is busy — please wait a moment and try again.');
      this.name = 'SyncLockContentionError';
    }
  }

  /**
   * Runs fn(state) against a freshly-read, locked copy of sync state, then
   * persists it. fn must mutate state's own properties in place (never
   * reassign the state parameter) and may throw SyncStageStaleError to abort
   * without writing. Use for the first stage-changing write in a caller.
   * @param {function(object)} fn
   * @returns {{applied: true, state: object}}
   * @throws {SyncStageStaleError} if fn rejects the guard it checked.
   * @throws {SyncLockContentionError} if the lock could not be acquired.
   */
  function mutateSyncState(fn) {
    const result = LockHelpers.withScriptLock('sync-state', 30000, function() {
      const state = getSyncState();
      fn(state);
      setSyncState(state);
      return { applied: true, state: state };
    });
    if (result === null) {
      throw new SyncLockContentionError();
    }
    return result;
  }

  /**
   * Same fn contract as mutateSyncState, but never throws: a guard mismatch
   * or lock contention both silently no-apply (logged, not surfaced) since
   * either means a concurrent process is already handling this state. Use
   * for every write after a caller's first, for non-stage-changing writes,
   * and for idempotent background pollers.
   * @param {function(object)} fn
   * @returns {{applied: boolean, state: object}}
   */
  function mutateSyncStateBestEffort(fn) {
    const functionName = 'mutateSyncStateBestEffort';
    try {
      return mutateSyncState(fn);
    } catch (e) {
      if (e instanceof SyncStageStaleError) {
        logger.warn(SERVICE_NAME, functionName, `Guard mismatch -- no-applying: ${e.message}`);
        return { applied: false, state: e.state };
      }
      if (e instanceof SyncLockContentionError) {
        logger.warn(SERVICE_NAME, functionName, `Lock contention -- no-applying: ${e.message}`);
        return { applied: false, state: getSyncState() };
      }
      throw e;
    }
  }

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
      // Many callers save state without changing the stage (progress fields,
      // timestamps, etc. within the same stage) -- only log when the stage
      // itself actually moved, instead of once per save (2026-08-25, log
      // volume reduction alongside the 2026-08-21 cell-limit fix).
      let previousStage = null;
      try {
        const existing = ConfigService.getConfig(SYNC_STATE_CONFIG_KEY);
        if (existing && existing.json) {
          previousStage = JSON.parse(existing.json).stage;
        }
      } catch (readErr) {
        // Non-fatal -- if we can't tell, just log this save like before.
      }

      ConfigService.setConfig(SYNC_STATE_CONFIG_KEY, 'json', JSON.stringify(newState));
      ConfigService.forceReload();

      if (newState.stage !== previousStage) {
        logger.info(SERVICE_NAME, functionName, `State saved. Stage: ${newState.stage}`, { stage: newState.stage, sessionId: newState.sessionId });
      }
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
    return mutateSyncState(function(state) {
      const currentStage = state.stage;

      // FAILED -> failedAtStage is handled by retryFailedStep, not here
      if (newStage !== 'FAILED') {
        const allowed = TRANSITIONS[currentStage] || [];
        if (!allowed.includes(newStage)) {
          throw new SyncStageStaleError(
            `Invalid transition: ${currentStage} -> ${newStage}. Allowed: [${allowed.join(', ')}]`,
            state
          );
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

      // Fire-and-forget: schedule a one-off trigger to run bundle health check
      // when sync reaches COMPLETE. Must not block the transition (UI advances
      // to COMPLETE on this call's return). checkBundleHealth's own gate
      // (skip if no sync since last check) is the dedup guard.
      if (newStage === 'COMPLETE') {
        try {
          ScriptApp.newTrigger('runPostSyncBundleHealth')
            .timeBased()
            .after(1)
            .create();
        } catch (e) {
          logger.warn(SERVICE_NAME, functionName,
            'Could not schedule post-sync bundle health trigger: ' + e.message);
        }
      }
    }).state;
  }

  /**
   * Updates a step's status and message in the current state.
   * @param {number} stepNum Step number (1-5)
   * @param {string} status Step status: 'waiting', 'processing', 'completed', 'skipped', 'failed'
   * @param {string} [message] Optional message for display
   * @returns {object} The updated state.
   */
  function updateStep(stepNum, status, message) {
    // Non-stage-changing write (touches only its own step field) -- best-effort
    // per the guard rule: on contention or an unrelated concurrent stage change,
    // silently skip rather than throw and break the caller's pipeline.
    const result = mutateSyncStateBestEffort(function(state) {
      if (!state.steps) state.steps = {};
      state.steps['step' + stepNum] = {
        status: status,
        message: message || null
      };
      state.lastUpdated = new Date().toISOString();
    });
    return result.state;
  }

  /**
   * Resets the sync state to its default empty/initial state.
   * Unconditional: always allowed by design, so contention (via
   * mutateSyncState throwing) is the only failure case -- an admin override
   * should fail loudly, not silently no-op.
   */
  function resetSyncState() {
    const functionName = 'resetSyncState';
    mutateSyncState(function(state) {
      Object.assign(state, getDefaultState());
    });
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

  /**
   * True if a sync session is mid-flight (not IDLE/COMPLETE/FAILED) --
   * the single check every destructive maintenance/pull function must gate
   * on before touching sheets a sync can be actively writing to
   * (D2, SYNC_HARDENING_PLAN.md). Centralized here so the stage-list check
   * (and its field name) exists in exactly one place -- hand-copied
   * duplicates of this same check drifted at least twice before
   * (`WooProductPullService.pullProducts`/`.pullBundleProducts` both
   * checked a nonexistent `.currentStage` field instead of `.stage`,
   * silently never firing).
   */
  function isSyncActive() {
    const stage = getActiveSession().stage;
    return !!(stage && stage !== STAGES.IDLE && stage !== STAGES.COMPLETE && stage !== STAGES.FAILED);
  }

  return {
    STAGES: STAGES,
    TRANSITIONS: TRANSITIONS,
    getSyncState: getSyncState,
    getState: getSyncState, // Alias for convenience
    setSyncState: setSyncState,
    mutateSyncState: mutateSyncState,
    mutateSyncStateBestEffort: mutateSyncStateBestEffort,
    SyncStageStaleError: SyncStageStaleError,
    SyncLockContentionError: SyncLockContentionError,
    transition: transition,
    updateStep: updateStep,
    resetSyncState: resetSyncState,
    getDefaultState: getDefaultState,
    isSessionStale: isSessionStale,
    getActiveSession: getActiveSession,
    isSyncActive: isSyncActive
  };

})();

// Global instance for easy access
const syncStateService = SyncStateService;

/**
 * Trigger handler — runs bundle health check after sync reaches COMPLETE.
 * Scheduled via SyncStateService.transition; self-cleans by deleting all
 * pending instances of this trigger on first fire (collapses bursts of
 * COMPLETE transitions into a single check).
 */
function runPostSyncBundleHealth() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === 'runPostSyncBundleHealth') {
        try { ScriptApp.deleteTrigger(t); } catch (_) {}
      }
    });
  } catch (e) {
    LoggerService.warn('runPostSyncBundleHealth', 'cleanup',
      'Could not clean up triggers: ' + e.message);
  }

  try {
    housekeepingService.checkBundleHealth();
  } catch (e) {
    LoggerService.error('runPostSyncBundleHealth', 'run',
      'Bundle health check failed: ' + e.message, e);
  }
}
