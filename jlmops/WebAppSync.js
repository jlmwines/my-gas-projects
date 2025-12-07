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
  // Check if any jobs completed and advance stage if needed
  OrchestratorService.checkAndAdvanceSyncState();

  // Get current session ID from old state
  const oldState = SyncStateService.getSyncState();

  // Return new status-based data
  if (oldState.sessionId) {
    return SyncStatusService.getSessionStatus(oldState.sessionId);
  } else {
    return SyncStatusService.getDefaultStatus(null);
  }
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
    const newSessionId = OrchestratorService.generateSessionId();

    // Write initial status for Step 1
    SyncStatusService.writeStatus(newSessionId, {
      step: 1,
      stepName: 'Import Web Data',
      status: 'processing',
      message: 'Queueing import jobs...'
    });

    // Keep old state for backward compatibility during transition
    const newState = SyncStateService.getDefaultState();
    newState.sessionId = newSessionId;
    newState.currentStage = 'WEB_IMPORT_PROCESSING';
    newState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(newState);

    // Queue import jobs
    OrchestratorService.queueWebFilesForSync(newSessionId);

    // Update status
    SyncStatusService.writeStatus(newSessionId, {
      step: 1,
      stepName: 'Import Web Data',
      status: 'processing',
      message: 'Processing orders, products, and translations...'
    });

    // Trigger immediate job processing
    OrchestratorService.run('hourly');

    logger.info(serviceName, functionName, `Daily Sync started. Session ID: ${newSessionId}`, { sessionId: newSessionId });

    // Return status for UI
    return SyncStatusService.getSessionStatus(newSessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error starting Daily Sync: ${e.message}`, e);
    const sessionId = OrchestratorService.generateSessionId();

    SyncStatusService.writeStatus(sessionId, {
      step: 1,
      stepName: 'Import Web Data',
      status: 'failed',
      message: `Error: ${e.message}`
    });

    return SyncStatusService.getSessionStatus(sessionId);
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

    // Allow starting from WAITING_FOR_COMAX if there are no orders (skip confirmation step)
    const validStages = ['READY_FOR_COMAX_IMPORT'];
    const canSkipFromWaiting = currentState.currentStage === 'WAITING_FOR_COMAX' && currentState.ordersPendingExportCount === 0;

    if (!validStages.includes(currentState.currentStage) && !canSkipFromWaiting) {
      throw new Error(`Cannot start Comax import. Current stage is ${currentState.currentStage}, expected READY_FOR_COMAX_IMPORT.`);
    }

    currentState.currentStage = 'COMAX_IMPORT_PROCESSING';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Write Step 3 processing status
    SyncStatusService.writeStatus(currentState.sessionId, {
      step: 3,
      stepName: 'Import Comax Data',
      status: 'processing',
      message: 'Importing Comax product data...'
    });

    // Queue Comax import job
    OrchestratorService.queueComaxFileForSync(currentState.sessionId);

    logger.info(serviceName, functionName, `Comax import started. Session ID: ${currentState.sessionId}`, { sessionId: currentState.sessionId });

    // Trigger immediate job processing
    OrchestratorService.run('hourly');

    // Return current status for UI
    return SyncStatusService.getSessionStatus(currentState.sessionId);
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
    // Get current session ID before clearing
    const oldState = SyncStateService.getSyncState();
    const sessionId = oldState.sessionId;

    // Clear old state service
    SyncStateService.resetSyncState();

    // Clear sync status entries for this session
    if (sessionId) {
      SyncStatusService.clearSession(sessionId);
      logger.info(serviceName, functionName, `Cleared sync status for session ${sessionId}`);
    }

    // Return default status (no session)
    return SyncStatusService.getDefaultStatus(null);
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

    // Write processing status
    SyncStatusService.writeStatus(sessionId, {
      step: 2,
      stepName: 'Export Orders to Comax',
      status: 'processing',
      message: 'Generating order export file...'
    });

    const orderService = new OrderService(ProductService);
    const result = orderService.exportOrdersToComax(sessionId);

    // After successful export, update the state to indicate readiness for confirmation
    if (result.success) {
      const newState = SyncStateService.getSyncState();
      newState.comaxOrdersExported = true; // New state property
      newState.lastUpdated = new Date().toISOString();
      SyncStateService.setSyncState(newState);

      // Write waiting status - ready for confirmation
      SyncStatusService.writeStatus(sessionId, {
        step: 2,
        stepName: 'Export Orders to Comax',
        status: 'waiting',
        message: `Export complete. ${result.exportedCount || 0} orders exported. Ready to confirm upload.`
      });
    } else {
      // Write failure status
      SyncStatusService.writeStatus(sessionId, {
        step: 2,
        stepName: 'Export Orders to Comax',
        status: 'failed',
        message: `Export failed: ${result.message || 'Unknown error'}`
      });
    }

    return SyncStatusService.getSessionStatus(sessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error exporting Comax orders: ${e.message}`, e);
    const currentState = SyncStateService.getSyncState();

    SyncStatusService.writeStatus(currentState.sessionId, {
      step: 2,
      stepName: 'Export Orders to Comax',
      status: 'failed',
      message: `Error: ${e.message}`
    });

    return SyncStatusService.getSessionStatus(currentState.sessionId);
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
    const sessionId = currentState.sessionId;

    if (currentState.currentStage !== 'WAITING_FOR_COMAX' || !currentState.comaxOrdersExported) {
      throw new Error(`Cannot confirm Comax update. Current stage is ${currentState.currentStage} or Comax orders not exported.`);
    }

    // Write Step 2 completed status
    SyncStatusService.writeStatus(sessionId, {
      step: 2,
      stepName: 'Export Orders to Comax',
      status: 'completed',
      message: 'Orders exported and uploaded to Comax'
    });

    // Write Step 3 waiting status
    SyncStatusService.writeStatus(sessionId, {
      step: 3,
      stepName: 'Import Comax Data',
      status: 'waiting',
      message: 'Ready to import Comax product data'
    });

    currentState.currentStage = 'READY_FOR_COMAX_IMPORT'; // Move to intermediate stage
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Return updated status for UI
    return SyncStatusService.getSessionStatus(sessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error confirming Comax update: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();

    SyncStatusService.writeStatus(errorState.sessionId, {
      step: 2,
      stepName: 'Export Orders to Comax',
      status: 'failed',
      message: `Confirmation failed: ${e.message}`
    });

    errorState.currentStage = 'FAILED'; // Mark as failed if confirmation fails
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);

    return SyncStatusService.getSessionStatus(errorState.sessionId);
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
    const sessionId = currentState.sessionId;

    if (currentState.currentStage !== 'READY_FOR_WEB_EXPORT') {
      throw new Error(`Cannot generate Web Export. Current stage is ${currentState.currentStage}, expected READY_FOR_WEB_EXPORT.`);
    }

    // Write processing status
    SyncStatusService.writeStatus(sessionId, {
      step: 5,
      stepName: 'Export Web Inventory',
      status: 'processing',
      message: 'Generating web inventory export file...'
    });

    currentState.currentStage = 'WEB_EXPORT_PROCESSING';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    // Queue Web Inventory Export job
    OrchestratorService.queueWebInventoryExport(sessionId);

    logger.info(serviceName, functionName, `Web Export generation started. Session ID: ${sessionId}. Jobs queued and processing...`, { sessionId: sessionId });

    // Trigger immediate job processing
    OrchestratorService.run('hourly');

    // Return status for UI
    return SyncStatusService.getSessionStatus(sessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error generating Web Export: ${e.message}`, e);
    const currentState = SyncStateService.getSyncState();

    SyncStatusService.writeStatus(currentState.sessionId, {
      step: 5,
      stepName: 'Export Web Inventory',
      status: 'failed',
      message: `Error: ${e.message}`
    });

    const errorState = SyncStateService.getSyncState();
    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);

    return SyncStatusService.getSessionStatus(errorState.sessionId);
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
    const sessionId = currentState.sessionId;
    const webExportJobStatus = OrchestratorService.getJobStatusInSession('export.web.inventory', sessionId);

    if (webExportJobStatus !== 'COMPLETED') {
        throw new Error(`Cannot confirm Web Inventory Update. Export job status is ${webExportJobStatus}, expected COMPLETED.`);
    }

    // Write Step 5 completion status
    SyncStatusService.writeStatus(sessionId, {
      step: 5,
      stepName: 'Export Web Inventory',
      status: 'completed',
      message: 'Web inventory exported and uploaded successfully'
    });

    currentState.currentStage = 'COMPLETE';
    currentState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(currentState);

    return SyncStatusService.getSessionStatus(sessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error confirming Web Inventory Update: ${e.message}`, e);
    const errorState = SyncStateService.getSyncState();

    SyncStatusService.writeStatus(errorState.sessionId, {
      step: 5,
      stepName: 'Export Web Inventory',
      status: 'failed',
      message: `Confirmation failed: ${e.message}`
    });

    errorState.currentStage = 'FAILED';
    errorState.errorMessage = e.message;
    errorState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(errorState);

    return SyncStatusService.getSessionStatus(errorState.sessionId);
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

/**
 * Retrieves the count of inventory receipts files and the URL of the receipts folder.
 * Accessible from frontend via `google.script.run.getInventoryReceiptsInfo()`.
 * @returns {object} An object containing { count: number, folderUrl: string|null }.
 */
function getInventoryReceiptsInfo() {
  const serviceName = 'WebAppSync';
  const functionName = 'getInventoryReceiptsInfo';
  try {
    const count = OrchestratorService.getInvoiceFileCount();
    const allConfig = ConfigService.getAllConfig();
    const receiptsFolderConfig = allConfig['system.folder.invoices'];
    let folderUrl = null;
    if (receiptsFolderConfig && receiptsFolderConfig.id) {
      folderUrl = `https://drive.google.com/drive/folders/${receiptsFolderConfig.id}`;
    }
    logger.info(serviceName, functionName, `Found ${count} inventory receipts files. Folder URL: ${folderUrl}`);
    return { count: count, folderUrl: folderUrl };
  } catch (e) {
    logger.error(serviceName, functionName, `Error getting inventory receipts info: ${e.message}`, e);
    return { count: 0, folderUrl: null, error: e.message };
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
