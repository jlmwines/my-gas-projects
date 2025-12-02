/**
 * @file WebAppSync.js
 * @description Backend functions exposed to the frontend UI for managing the Daily Sync workflow.
 */

/**
 * Retrieves the current sync state.
 * Accessible from frontend via `google.script.run.getSyncStateFromBackend()`.
 * @returns {object} The current sync state.
 */
function getSyncStateFromBackend() {
  return SyncStateService.getSyncState();
}

/**
 * Initiates the first stage of the Daily Sync workflow.
 * Generates a new Session ID, updates state, and queues initial import jobs.
 * Accessible from frontend via `google.script.run.startDailySyncBackend()`.
 * @returns {object} The updated sync state.
 */
function startDailySyncBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'startDailySyncBackend';
  logger.info(serviceName, functionName, 'Starting new Daily Sync workflow.');

  try {
    const newSessionId = OrchestratorService.generateSessionId(); // Reuse Orchestrator's ID generation
    const newState = SyncStateService.getDefaultState();
    newState.sessionId = newSessionId;
    newState.currentStage = 'WEB_IMPORT_PROCESSING';
    newState.lastUpdated = new Date().toISOString();
    
    // Save state before queuing jobs
    SyncStateService.setSyncState(newState);

    // Queue import jobs for WebProducts, WebTranslations, WebOrders with the new session ID
    OrchestratorService.queueWebFilesForSync(newSessionId); 

    logger.info(serviceName, functionName, `Daily Sync started. Session ID: ${newSessionId}`, { sessionId: newSessionId, newState: newState });
    return SyncStateService.getSyncState(); // Return current state after queuing
  } catch (e) {
    logger.error(serviceName, functionName, `Error starting Daily Sync: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState(); // Get current state
    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

/**
 * Initiates the final stage of the Daily Sync workflow (Validation & Export).
 * Accessible from frontend via `google.script.run.finalizeDailySyncBackend()`.
 * @returns {object} The updated sync state.
 */
function finalizeDailySyncBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'finalizeDailySyncBackend';
  logger.info(serviceName, functionName, 'Finalizing Daily Sync workflow.');

  try {
    const currentState = SyncStateService.getSyncState();
    // Validation: Ensure we are in a valid state to finalize (e.g., COMAX_IMPORT_PROCESSING completed)
    // For now, we'll be permissive to allow manual advancement if needed, but ideally check job status.
    
    currentState.currentStage = 'VALIDATING';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Queue Validation and Export jobs
    OrchestratorService.finalizeSync(currentState.sessionId); 

    logger.info(serviceName, functionName, `Daily Sync finalization started. Session ID: ${currentState.sessionId}`, { sessionId: currentState.sessionId, newState: currentState });
    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error finalizing Daily Sync: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

/**
 * Resumes the Daily Sync workflow by processing Comax data.
 * Accessible from frontend via `google.script.run.resumeDailySyncBackend()`.
 * @returns {object} The updated sync state.
 */
function resumeDailySyncBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'resumeDailySyncBackend';
  logger.info(serviceName, functionName, 'Resuming Daily Sync workflow for Comax import.');

  try {
    const currentState = SyncStateService.getSyncState();
    if (currentState.currentStage !== 'WAITING_FOR_COMAX') {
      throw new Error(`Cannot resume sync. Current stage is ${currentState.currentStage}, expected WAITING_FOR_COMAX.`);
    }

    currentState.currentStage = 'COMAX_IMPORT_PROCESSING';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Queue Comax import job with the current session ID
    OrchestratorService.queueComaxFileForSync(currentState.sessionId); // New Orchestrator function

    logger.info(serviceName, functionName, `Daily Sync resumed. Session ID: ${currentState.sessionId}`, { sessionId: currentState.sessionId, newState: currentState });
    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error resuming Daily Sync: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

/**
 * Resets the current Daily Sync state to IDLE.
 * Accessible from frontend via `google.script.run.resetSyncStateBackend()`.
 * @returns {object} The default (reset) sync state.
 */
function resetSyncStateBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'resetSyncStateBackend';
  logger.info(serviceName, functionName, 'Resetting Daily Sync state.');
  try {
    SyncStateService.resetSyncState();
    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error resetting Daily Sync state: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

// Helper function that the Orchestrator will call to update the UI state
function updateSyncStateFromOrchestrator(sessionId, statusUpdate) {
  const serviceName = 'WebAppSync';
  const functionName = 'updateSyncStateFromOrchestrator';
  try {
    const currentState = SyncStateService.getSyncState();
    if (currentState.sessionId === sessionId) {
      Object.assign(currentState, statusUpdate); // Merge updates
      currentState.lastUpdated = new Date().toISOString();
      SyncStateService.setSyncState(currentState);
      logger.info(serviceName, functionName, `Sync state updated by Orchestrator.`, { sessionId: sessionId, statusUpdate: statusUpdate });
    } else {
      logger.warn(SERVICE_NAME, functionName, `Orchestrator tried to update state for a non-current session.`, { currentSessionId: currentState.sessionId, attemptedSessionId: sessionId, statusUpdate: statusUpdate });
    }
  } catch (e) {
    logger.error(serviceName, functionName, `Error updating sync state from Orchestrator: ${e.message}`, e, { sessionId: sessionId, statusUpdate: statusUpdate });
  }
}

// =================================================================
//  GLOBAL RUNNER FUNCTIONS (for manual execution from Editor)
// =================================================================

function run_startDailySync() {
  startDailySyncBackend();
}

function run_resumeDailySync() {
  resumeDailySyncBackend();
}

function run_finalizeDailySync() {
  finalizeDailySyncBackend();
}

function run_resetSyncState() {
  resetSyncStateBackend();
}
