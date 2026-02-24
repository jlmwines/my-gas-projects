/**
 * @file WebAppSync.js
 * @description Backend functions exposed to the frontend UI for managing the Daily Sync workflow.
 * Every function has a stage guard — it rejects calls from wrong stages.
 * All state lives in SyncStateService (single JSON in SysConfig).
 */

// =========================================================================
//  STATE RETRIEVAL
// =========================================================================

/**
 * Retrieves the current sync state for the frontend.
 * Also checks if any background jobs completed and advances stage if needed.
 * @returns {object} The current sync state.
 */
function getSyncStateFromBackend() {
  try {
    OrchestratorService.checkAndAdvanceSyncState();
  } catch (e) {
    logger.warn('WebAppSync', 'getSyncStateFromBackend', `State advancement check failed: ${e.message}`);
  }
  return SyncStateService.getActiveSession();
}

// =========================================================================
//  STEP 1: IMPORT WEB PRODUCTS (translations + products)
// =========================================================================

/**
 * Stage guard: IDLE
 * Imports web products (translations first, then English products).
 * @returns {object} The updated sync state.
 */
function importWebProductsBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'importWebProductsBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'IDLE') {
    throw new Error(`Cannot start import: sync is at stage ${currentState.stage}, expected IDLE.`);
  }

  logger.info(serviceName, functionName, 'Starting web products import.');

  try {
    const sessionId = OrchestratorService.generateSessionId();

    // Create sync session tracking task
    try {
      TaskService.createTask(
        'task.sync.daily_session',
        sessionId,
        `Sync ${new Date().toISOString().split('T')[0]}`,
        `Daily Sync - ${new Date().toLocaleDateString()}`,
        'Sync session initiated',
        sessionId
      );
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not create sync session task: ${taskError.message}`);
    }

    // Initialize state: IDLE -> IMPORTING_PRODUCTS
    const newState = SyncStateService.getDefaultState();
    newState.sessionId = sessionId;
    newState.stage = 'IMPORTING_PRODUCTS';
    newState.lastUpdated = new Date().toISOString();
    newState.steps.step1 = { status: 'processing', message: 'Importing translations and products...' };
    SyncStateService.setSyncState(newState);

    // Queue jobs: translations first, then products
    OrchestratorService.queueWebProductsImport(sessionId);

    // Process jobs for this session (stops on first failure)
    const result = OrchestratorService.processSessionJobs(sessionId);

    if (!result.success) {
      logger.error(serviceName, functionName, `Web products import failed: ${result.error}`, null, { sessionId });
      const failState = SyncStateService.getSyncState();
      failState.stage = 'FAILED';
      failState.failedAtStage = 'IMPORTING_PRODUCTS';
      failState.errorMessage = result.error;
      failState.lastUpdated = new Date().toISOString();
      failState.steps.step1 = { status: 'failed', message: `Import failed: ${result.error}` };
      SyncStateService.setSyncState(failState);
    } else {
      logger.info(serviceName, functionName, `Web products import completed. ${result.jobsProcessed} jobs processed.`, { sessionId });
      const doneState = SyncStateService.getSyncState();
      doneState.stage = 'IMPORTING_ORDERS';
      doneState.lastUpdated = new Date().toISOString();
      doneState.steps.step1 = { status: 'completed', message: 'Products and translations imported' };
      doneState.steps.step2 = { status: 'waiting', message: 'Ready to import orders' };
      SyncStateService.setSyncState(doneState);
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error starting web products import: ${e.message}`, e);
    // If we already wrote state, mark it failed
    const errState = SyncStateService.getSyncState();
    if (errState.stage !== 'IDLE') {
      errState.stage = 'FAILED';
      errState.failedAtStage = 'IMPORTING_PRODUCTS';
      errState.errorMessage = e.message;
      errState.lastUpdated = new Date().toISOString();
      errState.steps.step1 = { status: 'failed', message: `Error: ${e.message}` };
      SyncStateService.setSyncState(errState);
    }
    return SyncStateService.getSyncState();
  }
}

// =========================================================================
//  STEP 2: IMPORT WEB ORDERS
// =========================================================================

/**
 * Stage guard: IMPORTING_ORDERS
 * Imports web orders. Auto-called after products succeed.
 * @returns {object} The updated sync state.
 */
function importWebOrdersBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'importWebOrdersBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'IMPORTING_ORDERS') {
    throw new Error(`Cannot import orders: sync is at stage ${currentState.stage}, expected IMPORTING_ORDERS.`);
  }

  logger.info(serviceName, functionName, 'Starting web orders import.');
  const sessionId = currentState.sessionId;

  try {
    // Update step status
    SyncStateService.updateStep(2, 'processing', 'Processing orders...');

    // Queue orders import job
    OrchestratorService.queueWebOrdersImport(sessionId);

    // Process jobs for this session
    const result = OrchestratorService.processSessionJobs(sessionId);

    if (!result.success) {
      logger.error(serviceName, functionName, `Web orders import failed: ${result.error}`, null, { sessionId });
      const failState = SyncStateService.getSyncState();
      failState.stage = 'FAILED';
      failState.failedAtStage = 'IMPORTING_ORDERS';
      failState.errorMessage = result.error;
      failState.lastUpdated = new Date().toISOString();
      failState.steps.step2 = { status: 'failed', message: `Import failed: ${result.error}` };
      SyncStateService.setSyncState(failState);
    } else {
      logger.info(serviceName, functionName, `Web orders import completed.`, { sessionId });

      // Calculate pending orders and set up step 3
      const ordersToExportCount = (new OrderService(ProductService)).getComaxExportOrderCount();
      const invoiceCount = OrchestratorService.getInvoiceFileCount();

      const doneState = SyncStateService.getSyncState();
      doneState.ordersPendingExportCount = ordersToExportCount;
      doneState.invoiceFileCount = invoiceCount;
      doneState.lastUpdated = new Date().toISOString();
      doneState.steps.step2 = { status: 'completed', message: `Orders imported` };

      if (ordersToExportCount > 0) {
        doneState.stage = 'WAITING_ORDER_EXPORT';
        doneState.steps.step3 = { status: 'waiting', message: `${ordersToExportCount} orders ready for export` };
      } else {
        // Skip step 3 entirely — go straight to Comax import
        doneState.stage = 'WAITING_COMAX_IMPORT';
        doneState.steps.step3 = { status: 'skipped', message: 'No new web orders to export' };
        doneState.steps.step4 = { status: 'waiting', message: 'Ready to import Comax product data' };
      }

      SyncStateService.setSyncState(doneState);
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error importing web orders: ${e.message}`, e);
    const errState = SyncStateService.getSyncState();
    errState.stage = 'FAILED';
    errState.failedAtStage = 'IMPORTING_ORDERS';
    errState.errorMessage = e.message;
    errState.lastUpdated = new Date().toISOString();
    errState.steps.step2 = { status: 'failed', message: `Error: ${e.message}` };
    SyncStateService.setSyncState(errState);
    return SyncStateService.getSyncState();
  }
}

// =========================================================================
//  STEP 3: EXPORT ORDERS TO COMAX
// =========================================================================

/**
 * Stage guard: WAITING_ORDER_EXPORT
 * Exports orders to Comax file.
 * @returns {object} The updated sync state.
 */
function exportComaxOrdersBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'exportComaxOrdersBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'WAITING_ORDER_EXPORT') {
    throw new Error(`Cannot export orders: sync is at stage ${currentState.stage}, expected WAITING_ORDER_EXPORT.`);
  }

  const sessionId = currentState.sessionId;
  logger.info(serviceName, functionName, `Exporting Comax orders for session: ${sessionId}`);

  try {
    // Transition to EXPORTING_ORDERS
    currentState.stage = 'EXPORTING_ORDERS';
    currentState.lastUpdated = new Date().toISOString();
    currentState.steps.step3 = { status: 'processing', message: 'Generating order export file...' };
    SyncStateService.setSyncState(currentState);

    const orderService = new OrderService(ProductService);
    const result = orderService.exportOrdersToComax(sessionId);

    if (result.success) {
      const newState = SyncStateService.getSyncState();
      const exportedCount = result.exportedCount || 0;

      if (exportedCount === 0) {
        // No orders — skip confirmation, go to Comax import
        newState.stage = 'WAITING_COMAX_IMPORT';
        newState.lastUpdated = new Date().toISOString();
        newState.steps.step3 = { status: 'completed', message: 'No orders to export' };
        newState.steps.step4 = { status: 'waiting', message: 'Ready to import Comax product data' };
      } else {
        // Orders exported — need user confirmation
        newState.stage = 'WAITING_ORDER_CONFIRM';
        newState.comaxOrderExportFilename = result.fileName || '';
        newState.lastUpdated = new Date().toISOString();
        newState.steps.step3 = { status: 'waiting', message: `Export ready: ${result.fileName || ''} (${exportedCount} orders)` };
      }
      SyncStateService.setSyncState(newState);
    } else {
      const failState = SyncStateService.getSyncState();
      failState.stage = 'FAILED';
      failState.failedAtStage = 'EXPORTING_ORDERS';
      failState.errorMessage = result.message || 'Export failed';
      failState.lastUpdated = new Date().toISOString();
      failState.steps.step3 = { status: 'failed', message: `Export failed: ${result.message || 'Unknown error'}` };
      SyncStateService.setSyncState(failState);
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error exporting Comax orders: ${e.message}`, e);
    const errState = SyncStateService.getSyncState();
    errState.stage = 'FAILED';
    errState.failedAtStage = 'EXPORTING_ORDERS';
    errState.errorMessage = e.message;
    errState.lastUpdated = new Date().toISOString();
    errState.steps.step3 = { status: 'failed', message: `Error: ${e.message}` };
    SyncStateService.setSyncState(errState);
    return SyncStateService.getSyncState();
  }
}

// =========================================================================
//  STEP 3b: CONFIRM COMAX ORDER UPLOAD
// =========================================================================

/**
 * Stage guard: WAITING_ORDER_CONFIRM
 * Confirms that orders have been uploaded to Comax externally.
 * @returns {object} The updated sync state.
 */
function confirmComaxUpdateBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'confirmComaxUpdateBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'WAITING_ORDER_CONFIRM') {
    throw new Error(`Cannot confirm Comax update: sync is at stage ${currentState.stage}, expected WAITING_ORDER_CONFIRM.`);
  }

  logger.info(serviceName, functionName, 'Confirming Comax update.');

  try {
    // Complete the Comax order export confirmation task
    try {
      const openTask = TaskService.findOpenTaskByType('task.confirmation.comax_order_export');
      if (openTask) {
        TaskService.completeTask(openTask.id);
      }
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not complete confirmation task: ${taskError.message}`);
    }

    currentState.stage = 'WAITING_COMAX_IMPORT';
    currentState.lastUpdated = new Date().toISOString();
    currentState.steps.step3 = { status: 'completed', message: 'Orders exported and uploaded to Comax' };
    currentState.steps.step4 = { status: 'waiting', message: 'Ready to import Comax product data' };
    SyncStateService.setSyncState(currentState);

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error confirming Comax update: ${e.message}`, e);
    const errState = SyncStateService.getSyncState();
    errState.stage = 'FAILED';
    errState.failedAtStage = 'WAITING_ORDER_CONFIRM';
    errState.errorMessage = e.message;
    errState.lastUpdated = new Date().toISOString();
    errState.steps.step3 = { status: 'failed', message: `Confirmation failed: ${e.message}` };
    SyncStateService.setSyncState(errState);
    return SyncStateService.getSyncState();
  }
}

// =========================================================================
//  STEP 4: IMPORT COMAX PRODUCTS
// =========================================================================

/**
 * Stage guard: WAITING_COMAX_IMPORT
 * Starts the Comax product import.
 * @returns {object} The updated sync state.
 */
function startComaxImportBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'startComaxImportBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'WAITING_COMAX_IMPORT') {
    throw new Error(`Cannot start Comax import: sync is at stage ${currentState.stage}, expected WAITING_COMAX_IMPORT.`);
  }

  logger.info(serviceName, functionName, 'Starting Comax import process.');
  const sessionId = currentState.sessionId;

  try {
    // Transition to IMPORTING_COMAX
    currentState.stage = 'IMPORTING_COMAX';
    currentState.lastUpdated = new Date().toISOString();
    currentState.steps.step4 = { status: 'processing', message: 'Importing Comax product data...' };
    SyncStateService.setSyncState(currentState);

    // Queue Comax import job
    OrchestratorService.queueComaxFileForSync(sessionId);

    // Process queued jobs for this session
    const result = OrchestratorService.processSessionJobs(sessionId);

    if (!result.success) {
      logger.error(serviceName, functionName, `Comax import failed: ${result.error}`, null, { sessionId });
      const failState = SyncStateService.getSyncState();
      failState.stage = 'FAILED';
      failState.failedAtStage = 'IMPORTING_COMAX';
      failState.errorMessage = result.error;
      failState.lastUpdated = new Date().toISOString();
      failState.steps.step4 = { status: 'failed', message: `Import failed: ${result.error}` };
      SyncStateService.setSyncState(failState);
    }
    // On success, _checkAndAdvanceSyncState will handle the transition
    // to VALIDATING and then WAITING_WEB_EXPORT

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error starting Comax import: ${e.message}`, e);
    const errState = SyncStateService.getSyncState();
    errState.stage = 'FAILED';
    errState.failedAtStage = 'IMPORTING_COMAX';
    errState.errorMessage = e.message;
    errState.lastUpdated = new Date().toISOString();
    errState.steps.step4 = { status: 'failed', message: `Error: ${e.message}` };
    SyncStateService.setSyncState(errState);
    return SyncStateService.getSyncState();
  }
}

// =========================================================================
//  STEP 5: GENERATE WEB INVENTORY EXPORT
// =========================================================================

/**
 * Stage guard: WAITING_WEB_EXPORT
 * Generates the web inventory export file.
 * @returns {object} The updated sync state.
 */
function generateWebExportBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'generateWebExportBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'WAITING_WEB_EXPORT') {
    throw new Error(`Cannot generate Web Export: sync is at stage ${currentState.stage}, expected WAITING_WEB_EXPORT.`);
  }

  logger.info(serviceName, functionName, 'Starting Web Inventory Export generation.');
  const sessionId = currentState.sessionId;

  try {
    // Transition to GENERATING_WEB_EXPORT
    currentState.stage = 'GENERATING_WEB_EXPORT';
    currentState.lastUpdated = new Date().toISOString();
    currentState.steps.step5 = { status: 'processing', message: 'Generating web inventory export file...' };
    SyncStateService.setSyncState(currentState);

    // Queue Web Inventory Export job
    OrchestratorService.queueWebInventoryExport(sessionId);

    // Trigger immediate job processing
    OrchestratorService.run('hourly');

    // The job runs asynchronously — _checkAndAdvanceSyncState will handle
    // the transition to WAITING_WEB_CONFIRM or COMPLETE

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error generating Web Export: ${e.message}`, e);
    const errState = SyncStateService.getSyncState();
    errState.stage = 'FAILED';
    errState.failedAtStage = 'GENERATING_WEB_EXPORT';
    errState.errorMessage = e.message;
    errState.lastUpdated = new Date().toISOString();
    errState.steps.step5 = { status: 'failed', message: `Error: ${e.message}` };
    SyncStateService.setSyncState(errState);
    return SyncStateService.getSyncState();
  }
}

// =========================================================================
//  STEP 5b: CONFIRM WEB INVENTORY UPLOAD
// =========================================================================

/**
 * Stage guard: WAITING_WEB_CONFIRM
 * Confirms that the web inventory update has been uploaded externally.
 * @returns {object} The updated sync state.
 */
function confirmWebInventoryUpdateBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'confirmWebInventoryUpdateBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'WAITING_WEB_CONFIRM') {
    throw new Error(`Cannot confirm Web Inventory Update: sync is at stage ${currentState.stage}, expected WAITING_WEB_CONFIRM.`);
  }

  logger.info(serviceName, functionName, 'Confirming Web Inventory Update and completing sync cycle.');
  const sessionId = currentState.sessionId;

  try {
    // Verify export job actually completed
    const webExportJobStatus = OrchestratorService.getJobStatusInSession('export.web.inventory', sessionId);
    if (webExportJobStatus !== 'COMPLETED') {
      throw new Error(`Cannot confirm: export job status is ${webExportJobStatus}, expected COMPLETED.`);
    }

    // Transition to COMPLETE
    currentState.stage = 'COMPLETE';
    currentState.lastUpdated = new Date().toISOString();
    currentState.steps.step5 = { status: 'completed', message: 'Web inventory exported and uploaded successfully' };
    SyncStateService.setSyncState(currentState);

    // Complete the sync session task
    try {
      TaskService.completeTaskByTypeAndEntity('task.sync.daily_session', sessionId);
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not complete sync session task: ${taskError.message}`);
    }

    // Complete web inventory export confirmation tasks
    try {
      const confirmTasks = WebAppTasks.getOpenTasksByTypeId('task.confirmation.web_inventory_export');
      if (confirmTasks && confirmTasks.length > 0) {
        confirmTasks.forEach(function(task) {
          TaskService.completeTask(task.st_TaskId);
        });
      }
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not complete web inventory confirmation task: ${taskError.message}`);
    }

    // Register all session files in registry (deferred registration)
    _registerSessionFiles(currentState);

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error confirming Web Inventory Update: ${e.message}`, e);
    const errState = SyncStateService.getSyncState();
    errState.stage = 'FAILED';
    errState.failedAtStage = 'WAITING_WEB_CONFIRM';
    errState.errorMessage = e.message;
    errState.lastUpdated = new Date().toISOString();
    errState.steps.step5 = { status: 'failed', message: `Confirmation failed: ${e.message}` };
    SyncStateService.setSyncState(errState);
    return SyncStateService.getSyncState();
  }
}

// =========================================================================
//  RETRY & RESET
// =========================================================================

/**
 * Stage guard: FAILED
 * Retries the failed step by returning to the stage before failure.
 * @returns {object} The updated sync state.
 */
function retryFailedStepBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'retryFailedStepBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'FAILED') {
    throw new Error('Cannot retry: sync is not in FAILED state.');
  }

  if (!currentState.failedAtStage) {
    throw new Error('Cannot retry: no failedAtStage recorded. Please use Reset.');
  }

  logger.info(serviceName, functionName, `Retrying from stage: ${currentState.failedAtStage}`);

  currentState.stage = currentState.failedAtStage;
  currentState.errorMessage = null;
  currentState.lastUpdated = new Date().toISOString();
  // Don't clear failedAtStage — it stays as a breadcrumb until next successful transition
  SyncStateService.setSyncState(currentState);

  return SyncStateService.getSyncState();
}

/**
 * Stage guard: Any (always allowed)
 * Resets the sync state to IDLE.
 * @returns {object} The default (reset) sync state.
 */
function resetSyncStateBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'resetSyncStateBackend';
  logger.info(serviceName, functionName, 'Resetting Daily Sync state.');

  try {
    const oldState = SyncStateService.getSyncState();
    const sessionId = oldState.sessionId;

    // Reset state to IDLE
    SyncStateService.resetSyncState();

    // Close any open sync session task
    if (sessionId) {
      try {
        TaskService.completeTaskByTypeAndEntity('task.sync.daily_session', sessionId);
      } catch (taskError) {
        logger.warn(serviceName, functionName, `Could not complete sync session task: ${taskError.message}`);
      }
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error resetting Daily Sync state: ${e.message}`, e);
    throw e;
  }
}

// =========================================================================
//  HELPER FUNCTIONS
// =========================================================================

/**
 * Registers all archived files from the session in SysFileRegistry.
 * Called at COMPLETE transition (deferred registration).
 * @param {object} state The current sync state with archiveFileIds.
 */
function _registerSessionFiles(state) {
  const serviceName = 'WebAppSync';
  const functionName = '_registerSessionFiles';

  if (!state.archiveFileIds || Object.keys(state.archiveFileIds).length === 0) {
    logger.info(serviceName, functionName, 'No archive file IDs to register.');
    return;
  }

  try {
    const allConfig = ConfigService.getAllConfig();
    const logSpreadsheet = SheetAccessor.getLogSpreadsheet();
    const fileRegistrySheet = logSpreadsheet.getSheetByName(allConfig['system.sheet_names'].SysFileRegistry);

    const registry = OrchestratorService.getFileRegistry();

    for (const [configName, fileInfo] of Object.entries(state.archiveFileIds)) {
      if (fileInfo && fileInfo.originalFileId && fileInfo.originalFileLastUpdated) {
        registry.set(fileInfo.originalFileId, {
          name: fileInfo.originalFileName || configName,
          lastUpdated: new Date(fileInfo.originalFileLastUpdated)
        });
        logger.info(serviceName, functionName, `Registered file: ${fileInfo.originalFileName || configName} (${fileInfo.originalFileId})`);
      }
    }

    // Write updated registry back
    const schema = allConfig['schema.log.SysFileRegistry'];
    fileRegistrySheet.clear();
    const headers = schema.headers.split(',');
    fileRegistrySheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

    if (registry.size > 0) {
      const data = Array.from(registry, function([fileId, entry]) {
        return [fileId, entry.name, entry.lastUpdated];
      });
      fileRegistrySheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }

    logger.info(serviceName, functionName, `Registered ${Object.keys(state.archiveFileIds).length} files in SysFileRegistry.`);
  } catch (e) {
    logger.error(serviceName, functionName, `Error registering session files: ${e.message}`, e);
    // Don't throw — file registration failure shouldn't break COMPLETE
  }
}

/**
 * Helper to update sync state from the Orchestrator.
 * Used when background jobs complete and need to advance state.
 */
function updateSyncStateFromOrchestrator(sessionId, statusUpdate) {
  const serviceName = 'WebAppSync';
  const functionName = 'updateSyncStateFromOrchestrator';
  try {
    const currentState = SyncStateService.getSyncState();
    if (currentState.sessionId === sessionId) {
      Object.assign(currentState, statusUpdate);
      currentState.lastUpdated = new Date().toISOString();
      SyncStateService.setSyncState(currentState);
      logger.info(serviceName, functionName, `Sync state updated by Orchestrator.`, { sessionId, statusUpdate });
    } else {
      logger.warn(serviceName, functionName, `Orchestrator tried to update state for non-current session.`, { currentSessionId: currentState.sessionId, attemptedSessionId: sessionId });
    }
  } catch (e) {
    logger.error(serviceName, functionName, `Error updating sync state from Orchestrator: ${e.message}`, e, { sessionId, statusUpdate });
  }
}

// =========================================================================
//  UTILITY FUNCTIONS (existing, kept)
// =========================================================================

/**
 * Retrieves the Web Inventory Export file URL.
 * @returns {object} { success: true, fileUrl: '...' }
 */
function getWebInventoryExportBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'getWebInventoryExportBackend';
  try {
    logger.info(serviceName, functionName, `Retrieving Web Inventory Export...`);
    return ProductService.exportWebInventory();
  } catch (e) {
    logger.error(serviceName, functionName, `Error retrieving Web Inventory Export: ${e.message}`, e);
    throw e;
  }
}

/**
 * Retrieves invoice/receipt info for the pre-sync card.
 * @returns {object} { count, folderUrl, reviewCount }
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
    const reviewCount = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.comax_internal_audit', 'Review').length;
    return { count: count, folderUrl: folderUrl, reviewCount: reviewCount };
  } catch (e) {
    logger.error(serviceName, functionName, `Error getting inventory receipts info: ${e.message}`, e);
    return { count: 0, folderUrl: null, reviewCount: 0, error: e.message };
  }
}

/**
 * Checks freshness of web product files before importing.
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

    while (enFiles.hasNext()) {
      const file = enFiles.next();
      if (file.getLastUpdated() > latestEnDate) {
        latestEnDate = file.getLastUpdated();
        enFile = file;
      }
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

// =========================================================================
//  GLOBAL RUNNER FUNCTIONS (for manual execution from Editor)
// =========================================================================

function run_resetSyncState() {
  resetSyncStateBackend();
}

/**
 * Debug: View current sync state.
 */
function DEBUG_inspectSyncState() {
  const state = SyncStateService.getSyncState();
  console.log('Current sync state:', JSON.stringify(state, null, 2));
  return state;
}

// =========================================================================
//  WOO API PULL BACKEND FUNCTIONS
// =========================================================================

/**
 * Skip steps 1+2 and jump to Comax step.
 * For use when products and orders are auto-pulled via API.
 * @returns {object} Updated sync state.
 */
function skipToComaxBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'skipToComaxBackend';
  logger.info(serviceName, functionName, 'Skipping product/order import — jumping to Comax step');

  const sessionId = generateSessionId();
  const state = SyncStateService.transition('WAITING_ORDER_EXPORT', {
    sessionId: sessionId,
    steps: {
      step1: { status: 'skipped', message: 'Auto-pulled via API' },
      step2: { status: 'skipped', message: 'Auto-pulled via API' },
      step3: null,
      step4: null,
      step5: null
    }
  });

  return state;
}

/**
 * Pull products from WooCommerce API (manual trigger from dashboard).
 * Runs outside the sync state machine.
 * @returns {object} Updated sync state (for UI consistency).
 */
function pullWooProductsBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'pullWooProductsBackend';
  logger.info(serviceName, functionName, 'Manual product pull triggered from dashboard');

  const result = WooProductPullService.pullProducts();

  if (!result.success) {
    throw new Error(result.message);
  }

  // Return current sync state for UI update
  return SyncStateService.getSyncState();
}

/**
 * Pull orders from WooCommerce API (manual trigger from dashboard).
 * Runs outside the sync state machine.
 * @returns {object} Updated sync state (for UI consistency).
 */
function pullWooOrdersBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'pullWooOrdersBackend';
  logger.info(serviceName, functionName, 'Manual order pull triggered from dashboard');

  const result = WooOrderPullService.pullOrders();

  if (!result.success) {
    throw new Error(result.message);
  }

  // Return current sync state for UI update
  return SyncStateService.getSyncState();
}

/**
 * Get WooCommerce API pull timestamps for dashboard display.
 * @returns {object} { productsLastPull, ordersLastPull }
 */
function getWooApiPullStatus() {
  const config = ConfigService.getConfig('woo.api');
  return {
    productsLastPull: config ? config.products_last_pull || '' : '',
    ordersLastPull: config ? config.orders_last_pull || '' : ''
  };
}
