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

  // --- Stage guard (cheap pre-check; the authoritative check is the locked write below) ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'IDLE') {
    throw new Error(`Cannot start import: sync is at stage ${currentState.stage}, expected IDLE.`);
  }

  logger.info(serviceName, functionName, 'Starting web products import.');
  let write1Done = false;
  let expectedCurrentStage = 'IDLE';

  try {
    const sessionId = OrchestratorService.generateSessionId();

    // Create sync session tracking task
    try {
      TaskService.createTask(
        'task.sync.daily_session',
        sessionId,
        `Sync ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`,
        `Daily Sync - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`,
        'Sync session initiated',
        sessionId
      );
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not create sync session task: ${taskError.message}`);
    }

    // Initialize state: IDLE -> IMPORTING_PRODUCTS. User-initiated (IDLE button click) --
    // this is this function's first stage-changing write, so it throws on contention.
    SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot start import: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      Object.assign(state, SyncStateService.getDefaultState());
      state.sessionId = sessionId;
      state.stage = 'IMPORTING_PRODUCTS';
      state.lastUpdated = new Date().toISOString();
      state.steps.step1 = { status: 'processing', message: 'Importing translations and products...' };
    });
    write1Done = true;
    expectedCurrentStage = 'IMPORTING_PRODUCTS';

    // Queue jobs: translations first, then products
    OrchestratorService.queueWebProductsImport(sessionId);

    // Process jobs for this session (stops on first failure)
    const result = OrchestratorService.processSessionJobs(sessionId);

    if (!result.success) {
      logger.error(serviceName, functionName, `Web products import failed: ${result.error}`, null, { sessionId });
      const failResult = SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before failure could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'IMPORTING_PRODUCTS';
        state.errorMessage = result.error;
        state.lastUpdated = new Date().toISOString();
        state.steps.step1 = { status: 'failed', message: `Import failed: ${result.error}` };
      });
      if (!failResult.applied) {
        NotificationService.reportFailure(
          'sync.import_web_products',
          `Web products import failed (${result.error}) but the FAILED state write did not apply.`,
          'High',
          { error: result.error },
          sessionId
        );
      }
    } else {
      logger.info(serviceName, functionName, `Web products import completed. ${result.jobsProcessed} jobs processed.`, { sessionId });
      SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before completion could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.stage = 'IMPORTING_ORDERS';
        state.lastUpdated = new Date().toISOString();
        state.steps.step1 = { status: 'completed', message: 'Products and translations imported' };
        state.steps.step2 = { status: 'waiting', message: 'Ready to import orders' };
      });
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error starting web products import: ${e.message}`, e);
    try {
      const recoveryFn = function(state) {
        state.stage = 'FAILED';
        state.failedAtStage = 'IMPORTING_PRODUCTS';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        if (!state.steps) state.steps = {};
        state.steps.step1 = { status: 'failed', message: `Error: ${e.message}` };
      };
      if (!write1Done) {
        SyncStateService.mutateSyncState(function(state) {
          if (state.stage !== 'IDLE') {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      } else {
        SyncStateService.mutateSyncStateBestEffort(function(state) {
          if (state.stage !== expectedCurrentStage) {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      }
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
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
  const expectedCurrentStage = 'IMPORTING_ORDERS';

  try {
    // Update step status
    SyncStateService.updateStep(2, 'processing', 'Pulling orders from WooCommerce...');

    // Pull orders from WooCommerce API — this fetches, transforms, validates,
    // and processes orders through the existing OrderService pipeline.
    const pullResult = WooOrderPullService.pullOrders();
    if (!pullResult.success) {
      logger.error(serviceName, functionName, `API order pull failed: ${pullResult.message}`);
      // Auto-continuation (no button click waiting on this) -- best-effort, and
      // surface via NotificationService if the FAILED write itself doesn't land.
      const failResult = SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before failure could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'IMPORTING_ORDERS';
        state.errorMessage = pullResult.message;
        state.lastUpdated = new Date().toISOString();
        state.steps.step2 = { status: 'failed', message: `Import failed: ${pullResult.message}` };
      });
      if (!failResult.applied) {
        NotificationService.reportFailure(
          'sync.import_web_orders',
          `Web orders import failed (${pullResult.message}) but the FAILED state write did not apply.`,
          'High',
          { error: pullResult.message },
          sessionId
        );
      }
    } else {
      logger.info(serviceName, functionName, `API order pull complete: ${pullResult.message}`);

      // Calculate pending orders and set up step 3
      const ordersToExportCount = (new OrderService(ProductService)).getComaxExportOrderCount();
      const invoiceCount = OrchestratorService.getInvoiceFileCount();

      SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before completion could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.ordersPendingExportCount = ordersToExportCount;
        state.invoiceFileCount = invoiceCount;
        state.lastUpdated = new Date().toISOString();
        state.steps.step2 = { status: 'completed', message: `${pullResult.orderCount} orders imported` };

        if (ordersToExportCount > 0) {
          state.stage = 'WAITING_ORDER_EXPORT';
          state.steps.step3 = { status: 'waiting', message: `${ordersToExportCount} orders ready for export` };
        } else {
          // Skip step 3 entirely — go straight to Comax import
          state.stage = 'WAITING_COMAX_IMPORT';
          state.steps.step3 = { status: 'skipped', message: 'No new web orders to export' };
          state.steps.step4 = { status: 'waiting', message: 'Ready to import Comax product data' };
        }
      });
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    logger.error(serviceName, functionName, `Error importing web orders: ${e.message}`, e);
    // Best-effort recovery write -- never throws, so no surrounding try/catch
    // needed. The underlying failure is already logged above regardless of
    // whether this write applies.
    SyncStateService.mutateSyncStateBestEffort(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
      }
      state.stage = 'FAILED';
      state.failedAtStage = 'IMPORTING_ORDERS';
      state.errorMessage = e.message;
      state.lastUpdated = new Date().toISOString();
      if (!state.steps) state.steps = {};
      state.steps.step2 = { status: 'failed', message: `Error: ${e.message}` };
    });
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
  let write1Done = false;
  let expectedCurrentStage = 'WAITING_ORDER_EXPORT';

  try {
    // Transition to EXPORTING_ORDERS. User-initiated (WAITING_ORDER_EXPORT
    // button click) -- this function's first stage-changing write.
    SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot export orders: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      state.stage = 'EXPORTING_ORDERS';
      state.lastUpdated = new Date().toISOString();
      state.steps.step3 = { status: 'processing', message: 'Generating order export file...' };
    });
    write1Done = true;
    expectedCurrentStage = 'EXPORTING_ORDERS';

    const orderService = new OrderService(ProductService);
    const result = orderService.exportOrdersToComax(sessionId);

    if (result.success) {
      const exportedCount = result.exportedCount || 0;
      SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before completion could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        if (exportedCount === 0) {
          // No orders — skip confirmation, go to Comax import
          state.stage = 'WAITING_COMAX_IMPORT';
          state.lastUpdated = new Date().toISOString();
          state.steps.step3 = { status: 'completed', message: 'No orders to export' };
          state.steps.step4 = { status: 'waiting', message: 'Ready to import Comax product data' };
        } else {
          // Orders exported — need user confirmation
          state.stage = 'WAITING_ORDER_CONFIRM';
          state.comaxOrderExportFilename = result.fileName || '';
          state.lastUpdated = new Date().toISOString();
          state.steps.step3 = { status: 'waiting', message: `Export ready: ${result.fileName || ''} (${exportedCount} orders)` };
        }
      });
    } else {
      const failResult = SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before failure could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'EXPORTING_ORDERS';
        state.errorMessage = result.message || 'Export failed';
        state.lastUpdated = new Date().toISOString();
        state.steps.step3 = { status: 'failed', message: `Export failed: ${result.message || 'Unknown error'}` };
      });
      if (!failResult.applied) {
        NotificationService.reportFailure(
          'sync.export_comax_orders',
          `Comax order export failed (${result.message || 'Unknown error'}) but the FAILED state write did not apply.`,
          'High',
          { error: result.message },
          sessionId
        );
      }
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error exporting Comax orders: ${e.message}`, e);
    try {
      const recoveryFn = function(state) {
        state.stage = 'FAILED';
        state.failedAtStage = 'EXPORTING_ORDERS';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        if (!state.steps) state.steps = {};
        state.steps.step3 = { status: 'failed', message: `Error: ${e.message}` };
      };
      if (!write1Done) {
        SyncStateService.mutateSyncState(function(state) {
          if (state.stage !== 'WAITING_ORDER_EXPORT') {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      } else {
        SyncStateService.mutateSyncStateBestEffort(function(state) {
          if (state.stage !== expectedCurrentStage) {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      }
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
    }
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
  const expectedCurrentStage = 'WAITING_ORDER_CONFIRM';

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

    // User-initiated (WAITING_ORDER_CONFIRM button click) -- this function's
    // only write, so it throws on contention.
    SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot confirm Comax update: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      state.stage = 'WAITING_COMAX_IMPORT';
      state.lastUpdated = new Date().toISOString();
      state.steps.step3 = { status: 'completed', message: 'Orders exported and uploaded to Comax' };
      state.steps.step4 = { status: 'waiting', message: 'Ready to import Comax product data' };
    });

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error confirming Comax update: ${e.message}`, e);
    try {
      SyncStateService.mutateSyncState(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'WAITING_ORDER_CONFIRM';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        state.steps.step3 = { status: 'failed', message: `Confirmation failed: ${e.message}` };
      });
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
    }
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
  let write1Done = false;
  let expectedCurrentStage = 'WAITING_COMAX_IMPORT';

  try {
    // Transition to IMPORTING_COMAX. User-initiated (WAITING_COMAX_IMPORT
    // button click) -- this function's first stage-changing write.
    SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot start Comax import: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      state.stage = 'IMPORTING_COMAX';
      state.lastUpdated = new Date().toISOString();
      state.steps.step4 = { status: 'processing', message: 'Importing Comax product data...' };
    });
    write1Done = true;
    expectedCurrentStage = 'IMPORTING_COMAX';

    // Queue Comax import job
    OrchestratorService.queueComaxFileForSync(sessionId);

    // Process queued jobs for this session
    const result = OrchestratorService.processSessionJobs(sessionId);

    if (!result.success) {
      logger.error(serviceName, functionName, `Comax import failed: ${result.error}`, null, { sessionId });
      const failResult = SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before failure could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'IMPORTING_COMAX';
        state.errorMessage = result.error;
        state.lastUpdated = new Date().toISOString();
        state.steps.step4 = { status: 'failed', message: `Import failed: ${result.error}` };
      });
      if (!failResult.applied) {
        NotificationService.reportFailure(
          'sync.start_comax_import',
          `Comax import failed (${result.error}) but the FAILED state write did not apply.`,
          'High',
          { error: result.error },
          sessionId
        );
      }
    }
    // On success, _checkAndAdvanceSyncState will handle the transition
    // to VALIDATING and then WAITING_WEB_EXPORT

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error starting Comax import: ${e.message}`, e);
    try {
      const recoveryFn = function(state) {
        state.stage = 'FAILED';
        state.failedAtStage = 'IMPORTING_COMAX';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        if (!state.steps) state.steps = {};
        state.steps.step4 = { status: 'failed', message: `Error: ${e.message}` };
      };
      if (!write1Done) {
        SyncStateService.mutateSyncState(function(state) {
          if (state.stage !== 'WAITING_COMAX_IMPORT') {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      } else {
        SyncStateService.mutateSyncStateBestEffort(function(state) {
          if (state.stage !== expectedCurrentStage) {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      }
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
    }
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

  logger.info(serviceName, functionName, 'Starting Web Inventory Export generation (inline).');
  const sessionId = currentState.sessionId;
  let expectedCurrentStage = 'WAITING_WEB_EXPORT';

  try {
    // Write 1: claim the action before starting the long-running export, so a
    // concurrent repaint (second tab, remounted widget) sees GENERATING_WEB_EXPORT
    // instead of a still-guard-passing WAITING_WEB_EXPORT for the whole export
    // duration -- the gap that let a real double-submit happen (2026-09-01,
    // SYNC_HARDENING_PLAN.md Bug 2). Same shape as startComaxImportBackend/
    // pushWebInventoryBackend's own first write.
    SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot generate Web Export: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      state.stage = 'GENERATING_WEB_EXPORT';
      state.lastUpdated = new Date().toISOString();
      if (!state.steps) state.steps = {};
      state.steps.step5 = { status: 'processing', message: 'Generating export...' };
    });
    expectedCurrentStage = 'GENERATING_WEB_EXPORT';

    // Run the export inline. Decide changes-vs-none from the RETURN VALUE, not a
    // re-read of state.webExportFilename — a concurrent writer can clobber that
    // field and make a real export look like "no changes" (2026-06-14 incident;
    // RELIABILITY_AUDIT §1.4). The race itself is closed separately in §1.3.
    const result = ProductService.exportWebInventory(sessionId) || {};
    const changed = result.changed === true;

    // Write 2: this function's terminal stage-changing write, so it throws on
    // contention. Side effects (task completion, file registration) run after
    // the write succeeds, not inside the lock hold.
    const writeResult = SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot generate Web Export: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      if (!state.steps) state.steps = {};

      if (!changed) {
        state.stage = 'COMPLETE';
        state.steps.step5 = { status: 'skipped', message: 'No inventory changes detected' };
      } else {
        // The export created a file. If shared state lost the filename, a concurrent
        // writer clobbered it — repair from the return value and flag it loudly so a
        // real export is never again silently dropped.
        if (state.webExportFilename !== result.fileName) {
          logger.warn(serviceName, functionName, `webExportFilename clobbered in state (state='${state.webExportFilename}', export='${result.fileName}') — repairing from return value.`);
          NotificationService.reportFailure(
            'sync.web_export.state_clobber',
            `Web export state lost the filename (state='${state.webExportFilename}', file='${result.fileName}'). Recovered from the export return value; file is NOT lost.`,
            'High',
            { fileName: result.fileName, fileId: result.fileId, count: result.count },
            sessionId
          );
        }
        state.webExportFilename = result.fileName;
        state.stage = 'WAITING_WEB_CONFIRM';
        state.steps.step5 = { status: 'waiting', message: `Export ready: ${result.fileName}` };
      }

      state.lastUpdated = new Date().toISOString();
      state.errorMessage = null;
    });

    if (!changed) {
      try {
        TaskService.completeTaskByTypeAndEntity('task.sync.daily_session', writeResult.state.sessionId);
      } catch (taskError) {
        logger.warn(serviceName, functionName, `Could not complete sync session task: ${taskError.message}`);
      }
      _registerSessionFiles(writeResult.state);
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error generating Web Export: ${e.message}`, e);
    try {
      SyncStateService.mutateSyncState(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'GENERATING_WEB_EXPORT';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        if (!state.steps) state.steps = {};
        state.steps.step5 = { status: 'failed', message: `Error: ${e.message}` };
      });
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
    }
    return SyncStateService.getSyncState();
  }
}

/**
 * Returns the Drive URL of the CSV named in current sync state, so the widget
 * can open it in a new tab for inspection. Used by the "Open in Drive" link
 * at WAITING_WEB_CONFIRM and COMPLETE.
 * @returns {{success: boolean, url?: string, message?: string}}
 */
function getWebExportFileUrlBackend() {
  try {
    const state = SyncStateService.getSyncState();
    if (!state.webExportFilename || state.webExportFilename === 'No Changes Detected') {
      return { success: false, message: 'No CSV file in current sync state.' };
    }
    const allConfig = ConfigService.getAllConfig();
    const folderConfig = allConfig['system.folder.jlmops_exports'];
    if (!folderConfig || !folderConfig.id) {
      return { success: false, message: 'system.folder.jlmops_exports not configured.' };
    }
    const folder = DriveApp.getFolderById(folderConfig.id);
    const filesIter = folder.getFilesByName(state.webExportFilename);
    if (!filesIter.hasNext()) {
      return { success: false, message: `File not found in exports folder: ${state.webExportFilename}` };
    }
    const file = filesIter.next();
    return { success: true, url: file.getUrl(), filename: state.webExportFilename };
  } catch (e) {
    logger.error('WebAppSync', 'getWebExportFileUrlBackend', `Error: ${e.message}`, e);
    return { success: false, message: e.message };
  }
}

// =========================================================================
//  STEP 5 (alt): PUSH WEB INVENTORY VIA API
// =========================================================================

/**
 * Stage guard: WAITING_WEB_CONFIRM
 * Alternate to the manual upload + confirm flow. Reads the CSV that
 * generateWebExportBackend wrote and PUTs each row to WooCommerce. Both
 * delivery routes share the same WAITING_WEB_CONFIRM fork point — see
 * jlmops/plans/INVENTORY_API_PUSH_PLAN.md.
 *
 * @returns {object} The updated sync state.
 */
function pushWebInventoryBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'pushWebInventoryBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'WAITING_WEB_CONFIRM') {
    throw new Error(`Cannot push web inventory: sync is at stage ${currentState.stage}, expected WAITING_WEB_CONFIRM.`);
  }
  if (!currentState.webExportFilename || currentState.webExportFilename === 'No Changes Detected') {
    throw new Error(`Cannot push: no CSV file in sync state (webExportFilename is "${currentState.webExportFilename || ''}").`);
  }

  logger.info(serviceName, functionName, `Starting Web Inventory API push. Source CSV: ${currentState.webExportFilename}`);
  const sessionId = currentState.sessionId;
  const expectedCurrentStage = 'WAITING_WEB_CONFIRM';

  try {
    // Transition to PUSHING_WEB_INVENTORY. User-initiated (WAITING_WEB_CONFIRM
    // "Push via API" button) -- this function's only write.
    SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot push web inventory: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      state.stage = 'PUSHING_WEB_INVENTORY';
      state.lastUpdated = new Date().toISOString();
      if (!state.steps) state.steps = {};
      state.steps.step5 = { status: 'processing', message: 'Pushing inventory updates via API...' };
    });

    // Queue + run. _checkAndAdvanceSyncState handles transition to COMPLETE/FAILED on poll.
    OrchestratorService.queueWebInventoryPush(sessionId);
    OrchestratorService.run('hourly');

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error during Web Inventory push: ${e.message}`, e);
    try {
      SyncStateService.mutateSyncState(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'PUSHING_WEB_INVENTORY';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        if (!state.steps) state.steps = {};
        state.steps.step5 = { status: 'failed', message: `Error: ${e.message}` };
      });
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
    }
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
  const expectedCurrentStage = 'WAITING_WEB_CONFIRM';

  try {
    // Verify the export actually produced a CSV. WAITING_WEB_CONFIRM is only
    // reached when generateWebExportBackend set webExportFilename to a real
    // filename, so this is a tighter guard than checking job status (and
    // works after the export queue was removed).
    const exportFilename = currentState.webExportFilename || '';
    if (!exportFilename || exportFilename === 'No Changes Detected') {
      throw new Error(`Cannot confirm: webExportFilename not set on state.`);
    }

    // Transition to COMPLETE. User-initiated (WAITING_WEB_CONFIRM "Confirm"
    // button) -- this function's only write. Side effects run after it
    // succeeds, not inside the lock hold.
    const writeResult = SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot confirm Web Inventory Update: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      state.stage = 'COMPLETE';
      state.lastUpdated = new Date().toISOString();
      state.steps.step5 = { status: 'completed', message: 'Web inventory exported and uploaded successfully' };
    });

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
    _registerSessionFiles(writeResult.state);

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error confirming Web Inventory Update: ${e.message}`, e);
    try {
      SyncStateService.mutateSyncState(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'WAITING_WEB_CONFIRM';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        state.steps.step5 = { status: 'failed', message: `Confirmation failed: ${e.message}` };
      });
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
    }
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

  // User-initiated (FAILED "Retry" button) -- this function's only write.
  SyncStateService.mutateSyncState(function(state) {
    if (state.stage !== 'FAILED') {
      throw new SyncStateService.SyncStageStaleError('Cannot retry: sync is not in FAILED state.', state);
    }
    if (!state.failedAtStage) {
      throw new SyncStateService.SyncStageStaleError('Cannot retry: no failedAtStage recorded. Please use Reset.', state);
    }

    // Special case: a failed PUSHING_WEB_INVENTORY returns the user to the
    // pre-fork WAITING_WEB_CONFIRM stage rather than back to PUSHING. The CSV
    // is still on Drive — the user can either retry the API push or fall back
    // to manual upload of the same file.
    // Special case: a failed IMPORTING_COMAX returns the user to WAITING_COMAX_IMPORT
    // (the upload UI) so a corrected CSV can be uploaded instead of re-running the
    // import against the same bad file.
    // The three cases below (added 2026-08-26, Bug 4 fix candidate #4) are the
    // same fix extended to every other spinner-only stage (STAGE_CONFIG button:
    // null) that can appear in failedAtStage. Without this, the default branch
    // sends the user right back into a stage with no button and no queued job
    // driving it forward -- a dead end recoverable only via Reset, not Retry.
    // Every WAITING_* stage (has a button) is left to the default branch as-is.
    if (state.failedAtStage === 'PUSHING_WEB_INVENTORY') {
      state.stage = 'WAITING_WEB_CONFIRM';
    } else if (state.failedAtStage === 'IMPORTING_COMAX') {
      state.stage = 'WAITING_COMAX_IMPORT';
    } else if (state.failedAtStage === 'VALIDATING') {
      // Validation runs as a job chained after Comax import -- re-running the
      // import re-queues both, same target as the IMPORTING_COMAX case above.
      state.stage = 'WAITING_COMAX_IMPORT';
    } else if (state.failedAtStage === 'IMPORTING_PRODUCTS') {
      state.stage = 'IDLE';
    } else if (state.failedAtStage === 'EXPORTING_ORDERS') {
      state.stage = 'WAITING_ORDER_EXPORT';
    } else if (state.failedAtStage === 'GENERATING_WEB_EXPORT') {
      // Re-running the export is just re-clicking Generate.
      state.stage = 'WAITING_WEB_EXPORT';
    } else {
      state.stage = state.failedAtStage;
    }
    state.errorMessage = null;
    state.lastUpdated = new Date().toISOString();
    // Don't clear failedAtStage — it stays as a breadcrumb until next successful transition
  });

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

    // Flush any file registrations deferred while the session was active
    // (finalizeJobCompletion defers these into archiveFileIds rather than
    // registering immediately — normally flushed at COMPLETE, but Reset
    // overwrites state directly and would otherwise silently drop them,
    // causing the next sync to re-process a file that already succeeded).
    try {
      _registerSessionFiles(oldState);
    } catch (registerError) {
      logger.warn(serviceName, functionName, `Could not flush deferred file registrations before reset: ${registerError.message}`);
    }

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
  // Dead code -- zero live callers anywhere in the repo (grep-confirmed,
  // SYNC_HARDENING_PLAN.md Stage B point 3). Migrated for completeness only.
  const serviceName = 'WebAppSync';
  const functionName = 'updateSyncStateFromOrchestrator';
  try {
    const result = SyncStateService.mutateSyncStateBestEffort(function(state) {
      if (state.sessionId !== sessionId) {
        throw new SyncStateService.SyncStageStaleError('Orchestrator tried to update state for non-current session.', state);
      }
      Object.assign(state, statusUpdate);
      state.lastUpdated = new Date().toISOString();
    });
    if (result.applied) {
      logger.info(serviceName, functionName, `Sync state updated by Orchestrator.`, { sessionId, statusUpdate });
    } else {
      logger.warn(serviceName, functionName, `Orchestrator tried to update state for non-current or busy session.`, { attemptedSessionId: sessionId });
    }
  } catch (e) {
    logger.error(serviceName, functionName, `Error updating sync state from Orchestrator: ${e.message}`, e, { sessionId, statusUpdate });
  }
}

// =========================================================================
//  UTILITY FUNCTIONS (existing, kept)
// =========================================================================

/**
 * Retrieves pre-sync review-queue info for the pre-sync card.
 * @returns {object} { reviewCount }
 */
function getInventoryReceiptsInfo() {
  const serviceName = 'WebAppSync';
  const functionName = 'getInventoryReceiptsInfo';
  try {
    // Invoice count/folder link dropped 2026-07-14 — the role responsible for
    // invoices changed and this widget no longer needs to track them. Review
    // count (task.validation.comax_internal_audit) is unrelated and stays.
    const reviewCount = WebAppTasks.getOpenTasksByTypeIdAndStatus('task.validation.comax_internal_audit', 'Review').length;
    return { reviewCount: reviewCount };
  } catch (e) {
    logger.error(serviceName, functionName, `Error getting inventory receipts info: ${e.message}`, e);
    return { reviewCount: 0, error: e.message };
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
 * Stage guard: IDLE
 * Full API pull pipeline: EN products → HE translations → orders.
 * Replaces manual CSV import with direct WooCommerce API pull.
 * After completion, continues into normal sync flow (Comax import, web export).
 * @returns {object} The updated sync state.
 */
function apiPullAllBackend() {
  const serviceName = 'WebAppSync';
  const functionName = 'apiPullAllBackend';

  // --- Stage guard ---
  const currentState = SyncStateService.getSyncState();
  if (currentState.stage !== 'IDLE') {
    throw new Error(`Cannot start API pull: sync is at stage ${currentState.stage}, expected IDLE.`);
  }

  logger.info(serviceName, functionName, 'Starting full API pull pipeline.');
  let write1Done = false;
  let expectedCurrentStage = 'IDLE';

  try {
    const sessionId = OrchestratorService.generateSessionId();

    // Create sync session tracking task
    try {
      TaskService.createTask(
        'task.sync.daily_session',
        sessionId,
        `Sync ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`,
        `Daily Sync (API Pull) - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`,
        'API pull session initiated',
        sessionId
      );
    } catch (taskError) {
      logger.warn(serviceName, functionName, `Could not create sync session task: ${taskError.message}`);
    }

    // Initialize state: IDLE → IMPORTING_PRODUCTS. User-initiated (IDLE "API
    // Pull" button) -- this function's first stage-changing write.
    SyncStateService.mutateSyncState(function(state) {
      if (state.stage !== expectedCurrentStage) {
        throw new SyncStateService.SyncStageStaleError(
          `Cannot start API pull: sync is at stage ${state.stage}, expected ${expectedCurrentStage}.`, state);
      }
      Object.assign(state, SyncStateService.getDefaultState());
      state.sessionId = sessionId;
      state.stage = 'IMPORTING_PRODUCTS';
      state.lastUpdated = new Date().toISOString();
      state.steps.step1 = { status: 'processing', message: 'Pulling EN products...' };
    });
    write1Done = true;
    expectedCurrentStage = 'IMPORTING_PRODUCTS';

    // Run the full pipeline — updates step1 and step2 internally, via
    // updateStep(), already routed through mutateSyncStateBestEffort.
    const result = WooProductPullService.pullAndImportAll();

    if (!result.success) {
      const failResult = SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before failure could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.stage = 'FAILED';
        state.failedAtStage = 'IMPORTING_PRODUCTS';
        state.errorMessage = result.message;
        state.lastUpdated = new Date().toISOString();
      });
      if (!failResult.applied) {
        NotificationService.reportFailure(
          'sync.api_pull_all',
          `API pull pipeline failed (${result.message}) but the FAILED state write did not apply.`,
          'High',
          { error: result.message },
          sessionId
        );
      }
    } else {
      // Pipeline complete — determine next stage based on pending orders
      const ordersToExportCount = (new OrderService(ProductService)).getComaxExportOrderCount();
      const invoiceCount = OrchestratorService.getInvoiceFileCount();

      SyncStateService.mutateSyncStateBestEffort(function(state) {
        if (state.stage !== expectedCurrentStage) {
          throw new SyncStateService.SyncStageStaleError(
            `Stage moved on before completion could be recorded (expected ${expectedCurrentStage}, found ${state.stage}).`, state);
        }
        state.ordersPendingExportCount = ordersToExportCount;
        state.invoiceFileCount = invoiceCount;
        state.lastUpdated = new Date().toISOString();

        if (ordersToExportCount > 0) {
          state.stage = 'WAITING_ORDER_EXPORT';
          state.steps.step3 = { status: 'waiting', message: `${ordersToExportCount} orders ready for export` };
        } else {
          state.stage = 'WAITING_COMAX_IMPORT';
          state.steps.step3 = { status: 'skipped', message: 'No new web orders to export' };
          state.steps.step4 = { status: 'waiting', message: 'Ready to import Comax product data' };
        }
      });
    }

    return SyncStateService.getSyncState();
  } catch (e) {
    if (e instanceof SyncStateService.SyncStageStaleError) {
      logger.warn(serviceName, functionName, `Lost the race before this action began -- no failure to record: ${e.message}`);
      return SyncStateService.getSyncState();
    }
    if (e instanceof SyncStateService.SyncLockContentionError) {
      logger.warn(serviceName, functionName, `Lock contention: ${e.message}`);
      throw e;
    }
    logger.error(serviceName, functionName, `Error in API pull pipeline: ${e.message}`, e);
    try {
      const recoveryFn = function(state) {
        state.stage = 'FAILED';
        state.failedAtStage = 'IMPORTING_PRODUCTS';
        state.errorMessage = e.message;
        state.lastUpdated = new Date().toISOString();
        // Mark whichever step was processing as failed
        if (!state.steps) state.steps = {};
        if (!state.steps.step2 || state.steps.step2.status !== 'processing') {
          state.steps.step1 = { status: 'failed', message: `Failed: ${e.message}` };
        } else {
          state.steps.step2 = { status: 'failed', message: `Failed: ${e.message}` };
        }
      };
      if (!write1Done) {
        SyncStateService.mutateSyncState(function(state) {
          if (state.stage !== 'IDLE') {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      } else {
        SyncStateService.mutateSyncStateBestEffort(function(state) {
          if (state.stage !== expectedCurrentStage) {
            throw new SyncStateService.SyncStageStaleError('Stage moved on before recovery could run.', state);
          }
          recoveryFn(state);
        });
      }
    } catch (recoveryError) {
      if (!(recoveryError instanceof SyncStateService.SyncStageStaleError) && !(recoveryError instanceof SyncStateService.SyncLockContentionError)) {
        logger.error(serviceName, functionName, `Recovery write also failed: ${recoveryError.message}`, recoveryError);
      }
    }
    return SyncStateService.getSyncState();
  }
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
