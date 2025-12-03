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
  logger.info('WebAppSync', 'getSyncStateFromBackend', 'Retrieving sync state.');
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
    OrchestratorService.run('hourly'); // Force immediate processing
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
    
    currentState.currentStage = 'READY_FOR_WEB_EXPORT'; // Transition to new stage for manual trigger
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Only queue Validation job. Web Export is now manually triggered.
    OrchestratorService.finalizeSync(currentState.sessionId); 

    logger.info(serviceName, functionName, `Daily Sync finalization started (Validation queued). Session ID: ${currentState.sessionId}`, { sessionId: currentState.sessionId, newState: currentState });
    OrchestratorService.run('hourly'); // Force immediate processing
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
    OrchestratorService.run('hourly'); // Force immediate processing
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
 * Manually starts the Comax import process after the user confirms readiness.
 * Accessible from frontend via `google.script.run.startComaxImportBackend()`.
 * @returns {object} The updated sync state.
 */
function startComaxImportBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'startComaxImportBackend';
  logger.info(serviceName, functionName, 'Starting Comax import process.');

  try {
    const currentState = SyncStateService.getSyncState();
    if (currentState.currentStage !== 'READY_FOR_COMAX_IMPORT') {
      throw new Error(`Cannot start Comax import. Current stage is ${currentState.currentStage}, expected READY_FOR_COMAX_IMPORT.`);
    }

    currentState.currentStage = 'COMAX_IMPORT_PROCESSING';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Queue Comax import job with the current session ID
    OrchestratorService.queueComaxFileForSync(currentState.sessionId); 

    logger.info(serviceName, functionName, `Comax import started. Session ID: ${currentState.sessionId}`, { sessionId: currentState.sessionId, newState: currentState });
    OrchestratorService.run('hourly'); // Force immediate processing
    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error starting Comax import: ${e.message}`, e);
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

/**
 * Exports orders to Comax and returns the file URL.
 * Accessible from frontend via `google.script.run.exportComaxOrdersBackend()`.
 * @returns {object} { success: true, fileUrl: '...' }
 */
function exportComaxOrdersBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'exportComaxOrdersBackend';
  
  try {
    const currentState = SyncStateService.getSyncState();
    const sessionId = currentState.sessionId;
    logger.info(serviceName, functionName, `Exporting Comax orders for session: ${sessionId}`);
    
    const orderService = new OrderService(ProductService);
    const result = orderService.exportOrdersToComax(sessionId);

    // After successful export, update the state to indicate readiness for confirmation
    if (result.success) {
      const newState = SyncStateService.getSyncState();
      newState.comaxOrdersExported = true; // New state property
      newState.lastUpdated = new Date().toISOString();
      SyncStateService.setSyncState(newState);
    }
    
    return result;
  } catch (e) {
    logger.error(serviceName, functionName, `Error exporting Comax orders: ${e.message}`, e);
    throw e;
  }
}

/**
 * Confirms that Comax orders have been updated/uploaded externally.
 * Accessible from frontend via `google.script.run.confirmComaxUpdateBackend()`.
 * @returns {object} The updated sync state.
 */
function confirmComaxUpdateBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'confirmComaxUpdateBackend';
  logger.info(serviceName, functionName, 'Confirming Comax update and moving to Comax import stage.');

  try {
    const currentState = SyncStateService.getSyncState();
    if (currentState.currentStage !== 'WAITING_FOR_COMAX' || !currentState.comaxOrdersExported) {
      throw new Error(`Cannot confirm Comax update. Current stage is ${currentState.currentStage} or Comax orders not exported.`);
    }

    currentState.currentStage = 'READY_FOR_COMAX_IMPORT'; // Move to intermediate stage
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Orchestrator is NOT run here. User must click "Start Import".
    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error confirming Comax update: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED'; // Mark as failed if confirmation fails
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

/**
 * Confirms that Comax orders have been updated/uploaded externally.
 * Accessible from frontend via `google.script.run.confirmComaxUpdateBackend()`.
 * @returns {object} The updated sync state.
 */
function confirmComaxUpdateBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'confirmComaxUpdateBackend';
  logger.info(serviceName, functionName, 'Confirming Comax update and moving to Comax import stage.');

  try {
    const currentState = SyncStateService.getSyncState();
    if (currentState.currentStage !== 'WAITING_FOR_COMAX' || !currentState.comaxOrdersExported) {
      throw new Error(`Cannot confirm Comax update. Current stage is ${currentState.currentStage} or Comax orders not exported.`);
    }

    currentState.currentStage = 'READY_FOR_COMAX_IMPORT'; // Move to intermediate stage
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Orchestrator is NOT run here. User must click "Start Import".
    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error confirming Comax update: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED'; // Mark as failed if confirmation fails
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

/**
 * Manually starts the process of generating the Web Inventory Export.
 * Accessible from frontend via `google.script.run.generateWebExportBackend()`.
 * @returns {object} The updated sync state.
 */
function generateWebExportBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'generateWebExportBackend';
  logger.info(serviceName, functionName, 'Manually starting Web Inventory Export generation.');

  try {
    const currentState = SyncStateService.getSyncState();
    if (currentState.currentStage !== 'READY_FOR_WEB_EXPORT') {
      throw new Error(`Cannot generate Web Export. Current stage is ${currentState.currentStage}, expected READY_FOR_WEB_EXPORT.`);
    }

    currentState.currentStage = 'WEB_EXPORT_PROCESSING';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Queue Web Inventory Export job
    OrchestratorService.queueWebInventoryExport(currentState.sessionId); // New Orchestrator function

    logger.info(serviceName, functionName, `Web Export generation started. Session ID: ${currentState.sessionId}`, { sessionId: currentState.sessionId, newState: currentState });
    OrchestratorService.run('hourly'); // Force immediate processing
    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error generating Web Export: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

/**
 * Confirms that the Web Inventory Update has been completed externally.
 * Accessible from frontend via `google.script.run.confirmWebInventoryUpdateBackend()`.
 * @returns {object} The updated sync state.
 */
function confirmWebInventoryUpdateBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'confirmWebInventoryUpdateBackend';
  logger.info(serviceName, functionName, 'Confirming Web Inventory Update and completing sync cycle.');

  try {
    const currentState = SyncStateService.getSyncState();
    // Assuming WEB_EXPORT_GENERATED means the file is ready and we just need user confirmation
    // Or we can check if the job for export.web.inventory is COMPLETED for this session
    const webExportJobStatus = OrchestratorService.getJobStatusInSession('export.web.inventory', currentState.sessionId);

    if (webExportJobStatus !== 'COMPLETED') {
        throw new Error(`Cannot confirm Web Inventory Update. Export job status is ${webExportJobStatus}, expected COMPLETED.`);
    }

    currentState.currentStage = 'COMPLETE';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error confirming Web Inventory Update: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);
    return errorState;
  }
}

/**
 * Generates/Retrieves the Web Inventory Export file URL.
 * Accessible from frontend via `google.script.run.getWebInventoryExportBackend()`.
 * @returns {object} { success: true, fileUrl: '...' }
 */
function getWebInventoryExportBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'getWebInventoryExportBackend';
  
  try {
    logger.info(serviceName, functionName, `Retrieving Web Inventory Export...`);
    const result = ProductService.exportWebInventory();
    return result;
  } catch (e) {
    logger.error(serviceName, functionName, `Error retrieving Web Inventory Export: ${e.message}`, e);
    throw e;
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
