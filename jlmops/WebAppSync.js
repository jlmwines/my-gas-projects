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

  // Get sync state (includes job statuses, currentStage, etc.)
  const syncState = SyncStateService.getSyncState();

  // Get step-based status data (includes timestamps per step)
  let statusData;
  if (syncState.sessionId) {
    statusData = SyncStatusService.getSessionStatus(syncState.sessionId);
  } else {
    statusData = SyncStatusService.getDefaultStatus(null);
  }

  // Merge both data sources - syncState has job statuses, statusData has step timestamps
  return {
    ...syncState,
    ...statusData,
    // Ensure currentStage from syncState takes precedence
    currentStage: syncState.currentStage
  };
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

    // Write Step 4 processing status
    SyncStatusService.writeStatus(currentState.sessionId, {
      step: 4,
      stepName: 'Comax Products',
      status: 'processing',
      message: 'Importing Comax product data...'
    });

    // Queue Comax import job
    OrchestratorService.queueComaxFileForSync(currentState.sessionId);

    logger.info(serviceName, functionName, `Comax import started. Session ID: ${currentState.sessionId}`, { sessionId: currentState.sessionId });

    // Process queued jobs for this session
    const result = OrchestratorService.processSessionJobs(currentState.sessionId);
    if (!result.success) {
      logger.error(serviceName, functionName, `Comax import failed: ${result.error}`, null, { sessionId: currentState.sessionId });
    }

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
      step: 3,
      stepName: 'Order Export',
      status: 'processing',
      message: 'Generating order export file...'
    });

    const orderService = new OrderService(ProductService);
    const result = orderService.exportOrdersToComax(sessionId);

    // After successful export, update the state
    if (result.success) {
      const newState = SyncStateService.getSyncState();
      const exportedCount = result.exportedCount || 0;

      if (exportedCount === 0) {
        // No orders to export - mark step 3 complete and move to step 4
        SyncStatusService.writeStatus(sessionId, {
          step: 3,
          stepName: 'Order Export',
          status: 'completed',
          message: 'No orders to export'
        });

        // Set up step 4 as ready
        SyncStatusService.writeStatus(sessionId, {
          step: 4,
          stepName: 'Comax Products',
          status: 'waiting',
          message: 'Ready to import Comax product data'
        });

        // Update state - skip confirmation since nothing was exported
        newState.comaxOrdersExported = true; // Mark as done (nothing to do)
        newState.currentStage = 'READY_FOR_COMAX_IMPORT';
        newState.lastUpdated = new Date().toISOString();
        SyncStateService.setSyncState(newState);
      } else {
        // Orders were exported - need confirmation
        newState.comaxOrdersExported = true;
        newState.lastUpdated = new Date().toISOString();
        SyncStateService.setSyncState(newState);

        // Write waiting status - ready for confirmation
        SyncStatusService.writeStatus(sessionId, {
          step: 3,
          stepName: 'Order Export',
          status: 'waiting',
          message: `Export complete. ${exportedCount} orders exported. Ready to confirm upload.`
        });
      }
    } else {
      // Write failure status
      SyncStatusService.writeStatus(sessionId, {
        step: 3,
        stepName: 'Order Export',
        status: 'failed',
        message: `Export failed: ${result.message || 'Unknown error'}`
      });
    }

    return SyncStatusService.getSessionStatus(sessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error exporting Comax orders: ${e.message}`, e);
    const currentState = SyncStateService.getSyncState();

    SyncStatusService.writeStatus(currentState.sessionId, {
      step: 3,
      stepName: 'Order Export',
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

    // Write Step 3 completed status
    SyncStatusService.writeStatus(sessionId, {
      step: 3,
      stepName: 'Order Export',
      status: 'completed',
      message: 'Orders exported and uploaded to Comax'
    });

    // Write Step 4 waiting status
    SyncStatusService.writeStatus(sessionId, {
      step: 4,
      stepName: 'Comax Products',
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
      step: 3,
      stepName: 'Order Export',
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
//  NEW SYNC WIDGET FUNCTIONS (v2)
// =================================================================

/**
 * Checks the freshness of web product files before importing.
 * Returns file info for UI to display/warn user if files are stale.
 * @returns {object} Freshness info for English products and translations files
 */
function checkWebProductFilesFreshness() {
  const serviceName = 'WebAppSync';
  const functionName = 'checkWebProductFilesFreshness';

  try {
    const allConfig = ConfigService.getAllConfig();
    const registry = OrchestratorService.getFileRegistry();

    // Check English products file
    const enConfig = allConfig['import.drive.web_products_en'];
    const enFolder = DriveApp.getFolderById(enConfig.source_folder_id);
    const enFiles = OrchestratorService.getFilesByPattern(enFolder, enConfig.file_pattern || 'product_export*');
    let enFile = null;
    let latestEnDate = new Date(0);

    // Find latest file matching pattern
    while (enFiles.hasNext()) {
      const file = enFiles.next();
      if (file.getLastUpdated() > latestEnDate) {
        latestEnDate = file.getLastUpdated();
        enFile = file;
      }
    }

    if (enFile) {
      logger.info(serviceName, functionName, `Found English products file: ${enFile.getName()}`);
    } else {
      logger.warn(serviceName, functionName, `No English products file found matching pattern: ${enConfig.file_pattern}`);
    }

    // Check translations file
    const heConfig = allConfig['import.drive.web_translations_he'];
    const heFolder = DriveApp.getFolderById(heConfig.source_folder_id);
    const heFiles = OrchestratorService.getFilesByPattern(heFolder, heConfig.file_pattern || 'he_product_export*');
    let heFile = null;
    let latestHeDate = new Date(0);

    while (heFiles.hasNext()) {
      const file = heFiles.next();
      if (file.getLastUpdated() > latestHeDate) {
        latestHeDate = file.getLastUpdated();
        heFile = file;
      }
    }

    if (heFile) {
      logger.info(serviceName, functionName, `Found translations file: ${heFile.getName()}`);
    } else {
      logger.warn(serviceName, functionName, `No translations file found matching pattern: ${heConfig.file_pattern}`);
    }

    const enRegistryEntry = enFile ? registry.get(enFile.getId()) : null;
    const heRegistryEntry = heFile ? registry.get(heFile.getId()) : null;

    return {
      englishProducts: {
        fileName: enFile ? enFile.getName() : null,
        missing: !enFile,
        lastModified: enFile ? enFile.getLastUpdated().toISOString() : null,
        isNew: enFile ? OrchestratorService.isNewFile(enFile, registry) : false,
        lastImported: enRegistryEntry ? enRegistryEntry.lastUpdated : null
      },
      translations: {
        fileName: heFile ? heFile.getName() : null,
        missing: !heFile,
        lastModified: heFile ? heFile.getLastUpdated().toISOString() : null,
        isNew: heFile ? OrchestratorService.isNewFile(heFile, registry) : false,
        lastImported: heRegistryEntry ? heRegistryEntry.lastUpdated : null
      }
    };
  } catch (e) {
    logger.error(serviceName, functionName, `Error checking file freshness: ${e.message}`, e);
    return {
      error: e.message,
      englishProducts: { fileName: null, missing: true, lastModified: null, isNew: true, lastImported: null },
      translations: { fileName: null, missing: true, lastModified: null, isNew: true, lastImported: null }
    };
  }
}

/**
 * Imports web products (translations first, then English products).
 * Accessible from frontend via `google.script.run.importWebProductsBackend()`.
 * @returns {object} The updated sync status
 */
function importWebProductsBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'importWebProductsBackend';
  logger.info(serviceName, functionName, 'Starting web products import.');

  try {
    const sessionId = OrchestratorService.generateSessionId();

    // IMMEDIATE status update
    SyncStatusService.writeStatus(sessionId, {
      step: 1,
      stepName: 'Import Web Products',
      status: 'processing',
      message: 'Importing translations and products...'
    });

    // Update sync state
    const newState = SyncStateService.getDefaultState();
    newState.sessionId = sessionId;
    newState.currentStage = 'WEB_PRODUCTS_IMPORTING';
    newState.lastUpdated = new Date().toISOString();
    SyncStateService.setSyncState(newState);

    // Queue jobs: translations first, then products
    OrchestratorService.queueWebProductsImport(sessionId);

    // Process jobs for this session (stops on first failure)
    const result = OrchestratorService.processSessionJobs(sessionId);

    if (!result.success) {
      logger.error(serviceName, functionName, `Web products import failed: ${result.error}`, null, { sessionId });
      // Status already written by processJob catch block
    } else {
      logger.info(serviceName, functionName, `Web products import completed. ${result.jobsProcessed} jobs processed.`, { sessionId });
    }

    return SyncStatusService.getSessionStatus(sessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error starting web products import: ${e.message}`, e);
    const sessionId = OrchestratorService.generateSessionId();

    SyncStatusService.writeStatus(sessionId, {
      step: 1,
      stepName: 'Import Web Products',
      status: 'failed',
      message: `Error: ${e.message}`
    });

    return SyncStatusService.getSessionStatus(sessionId);
  }
}

/**
 * Imports web orders. Can be called manually or by auto-polling.
 * Accessible from frontend via `google.script.run.importWebOrdersBackend()`.
 * @returns {object} The updated sync status
 */
function importWebOrdersBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'importWebOrdersBackend';
  logger.info(serviceName, functionName, 'Starting web orders import.');

  try {
    // Use existing session OR create new one
    let state = SyncStateService.getSyncState();
    const sessionId = state.sessionId || OrchestratorService.generateSessionId();

    // If no session existed, create state
    if (!state.sessionId) {
      const newState = SyncStateService.getDefaultState();
      newState.sessionId = sessionId;
      newState.currentStage = 'WEB_ORDERS_IMPORTING';
      newState.lastUpdated = new Date().toISOString();
      SyncStateService.setSyncState(newState);
    }

    // IMMEDIATE status update
    SyncStatusService.writeStatus(sessionId, {
      step: 2,
      stepName: 'Import Web Orders',
      status: 'processing',
      message: 'Processing orders...'
    });

    // Queue orders import job
    OrchestratorService.queueWebOrdersImport(sessionId);

    // Process jobs for this session (stops on first failure)
    const result = OrchestratorService.processSessionJobs(sessionId);

    if (!result.success) {
      logger.error(serviceName, functionName, `Web orders import failed: ${result.error}`, null, { sessionId });
    } else {
      logger.info(serviceName, functionName, `Web orders import completed. ${result.jobsProcessed} jobs processed.`, { sessionId });
    }

    return SyncStatusService.getSessionStatus(sessionId);
  } catch (e) {
    logger.error(serviceName, functionName, `Error starting web orders import: ${e.message}`, e);
    const state = SyncStateService.getSyncState();
    const sessionId = state.sessionId || 'ERROR';

    SyncStatusService.writeStatus(sessionId, {
      step: 2,
      stepName: 'Import Web Orders',
      status: 'failed',
      message: `Error: ${e.message}`
    });

    return SyncStatusService.getSessionStatus(sessionId);
  }
}

/**
 * Gets recent failures for the current session.
 * Accessible from frontend via `google.script.run.getRecentFailures(sessionId)`.
 * @param {string} sessionId - The sync session ID
 * @returns {Array} Array of failure objects { jobType, error }
 */
function getRecentFailures(sessionId) {
  return SyncStatusService.getRecentFailures(sessionId);
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
