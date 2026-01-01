/**
 * @file NotificationService.js
 * @description Unified failure reporting service. Centralizes all system failure handling
 * to ensure consistent logging, task creation, and dashboard visibility.
 */

const NotificationService = (function() {
  const SERVICE_NAME = 'NotificationService';

  /**
   * Reports a failure through the unified notification system.
   *
   * @param {string} context - Failure context (e.g., 'job.web_products', 'validation.master_master', 'sync.step3')
   * @param {string} message - Human-readable failure message
   * @param {string} severity - One of SeverityService.SEVERITY values (Critical, High, Normal)
   * @param {object} details - Additional failure details for task notes
   * @param {string} sessionId - Optional sync session ID for correlation
   * @returns {{shouldStop: boolean, taskId: string|null}} Result indicating whether caller should stop and task ID if created
   */
  function reportFailure(context, message, severity, details, sessionId) {
    const fnName = 'reportFailure';
    const behavior = SeverityService.getBehavior(severity);
    let taskId = null;

    try {
      // 1. Always log to SysLog
      const logLevel = severity === 'Critical' ? 'error' : (severity === 'High' ? 'warn' : 'info');
      logger[logLevel](SERVICE_NAME, context, message, details);

      // 2. Create task if behavior requires it
      if (behavior.createTask) {
        taskId = _createFailureTask(context, message, severity, details, sessionId);
      }

      // 3. Update health status for urgent items
      if (behavior.updateHealthStatus) {
        _updateHealthStatusWithAlert(context, message, severity, taskId, sessionId);
      }

      return {
        shouldStop: behavior.shouldStop,
        taskId: taskId
      };

    } catch (e) {
      // Notification system failure should not break the caller
      logger.error(SERVICE_NAME, fnName, `Failed to report failure: ${e.message}`, { originalContext: context, originalMessage: message });
      return {
        shouldStop: behavior.shouldStop,
        taskId: null
      };
    }
  }

  /**
   * Creates a failure task, with de-duplication.
   * @private
   */
  function _createFailureTask(context, message, severity, details, sessionId) {
    const fnName = '_createFailureTask';

    // Build entity ID from context for de-duplication
    // e.g., 'job.web_products' -> 'web_products', 'validation.master_master' -> 'master_master'
    const entityId = context.includes('.') ? context.split('.').slice(1).join('.') : context;

    // Check for existing open task (de-duplication)
    const existingTask = TaskService.findOpenTaskByType('task.system.failure', entityId);
    if (existingTask) {
      // Update existing task notes with new failure info
      const existingNotes = _parseNotes(existingTask.notes);
      existingNotes.failures = existingNotes.failures || [];
      existingNotes.failures.push({
        timestamp: new Date().toISOString(),
        message: message,
        details: details
      });
      existingNotes.lastUpdated = new Date().toISOString();
      existingNotes.occurrenceCount = (existingNotes.occurrenceCount || 1) + 1;

      TaskService.updateTaskNotes(existingTask.id, JSON.stringify(existingNotes));
      logger.info(SERVICE_NAME, fnName, `Updated existing failure task ${existingTask.id} (occurrence #${existingNotes.occurrenceCount})`);
      return existingTask.id;
    }

    // Create new task
    const notesData = {
      context: context,
      severity: severity,
      sessionId: sessionId,
      firstOccurrence: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      occurrenceCount: 1,
      failures: [{
        timestamp: new Date().toISOString(),
        message: message,
        details: details
      }]
    };

    // Get step name if this is a sync-related failure
    const stepName = _getStepNameFromContext(context);
    const title = stepName ? `${stepName} Failed` : `System Failure: ${context}`;

    try {
      const taskId = TaskService.createTask(
        'task.system.failure',
        entityId,
        stepName || context,
        title,
        JSON.stringify(notesData),
        sessionId,
        { priority: severity }
      );
      logger.info(SERVICE_NAME, fnName, `Created failure task ${taskId} for context '${context}'`);
      return taskId;
    } catch (taskError) {
      if (!taskError.message.includes('already exists')) {
        logger.warn(SERVICE_NAME, fnName, `Could not create failure task: ${taskError.message}`);
      }
      return null;
    }
  }

  /**
   * Updates the health status singleton with an urgent alert.
   * @private
   */
  function _updateHealthStatusWithAlert(context, message, severity, taskId, sessionId) {
    const fnName = '_updateHealthStatusWithAlert';

    try {
      const healthTask = TaskService.findOpenTaskByType('task.system.health_status', '_SYSTEM');
      let notes = {};

      if (healthTask && healthTask.notes) {
        notes = _parseNotes(healthTask.notes);
      }

      // Initialize urgentAlerts array if needed
      notes.urgentAlerts = notes.urgentAlerts || [];

      // Add new alert (keep last 10)
      const newAlert = {
        context: context,
        message: message,
        severity: severity,
        timestamp: new Date().toISOString(),
        taskId: taskId
      };

      notes.urgentAlerts.unshift(newAlert);
      notes.urgentAlerts = notes.urgentAlerts.slice(0, 10);

      // Update sync status if this is a sync failure
      if (context.startsWith('sync.') || context.startsWith('job.')) {
        const stepName = _getStepNameFromContext(context);
        notes.syncStatus = {
          sessionId: sessionId,
          currentStepName: stepName || context,
          status: severity === 'Critical' ? 'failed' : 'warning',
          lastUpdate: new Date().toISOString()
        };
      }

      notes.updated = new Date().toISOString();

      // Upsert the health status task
      TaskService.upsertSingletonTask(
        'task.system.health_status',
        '_SYSTEM',
        'System Health',
        'System Health Status',
        notes
      );

      logger.info(SERVICE_NAME, fnName, `Updated health status with ${severity} alert for '${context}'`);

    } catch (e) {
      logger.warn(SERVICE_NAME, fnName, `Could not update health status: ${e.message}`);
    }
  }

  /**
   * Clears urgent alerts from health status (call after issues are resolved).
   * @param {string} context - Optional: only clear alerts matching this context
   */
  function clearAlerts(context) {
    const fnName = 'clearAlerts';

    try {
      const healthTask = TaskService.findOpenTaskByType('task.system.health_status', '_SYSTEM');
      if (!healthTask || !healthTask.notes) return;

      const notes = _parseNotes(healthTask.notes);
      if (!notes.urgentAlerts || notes.urgentAlerts.length === 0) return;

      if (context) {
        notes.urgentAlerts = notes.urgentAlerts.filter(a => a.context !== context);
      } else {
        notes.urgentAlerts = [];
      }

      notes.updated = new Date().toISOString();

      TaskService.upsertSingletonTask(
        'task.system.health_status',
        '_SYSTEM',
        'System Health',
        'System Health Status',
        notes
      );

      logger.info(SERVICE_NAME, fnName, `Cleared alerts${context ? ` for '${context}'` : ''}`);

    } catch (e) {
      logger.warn(SERVICE_NAME, fnName, `Could not clear alerts: ${e.message}`);
    }
  }

  /**
   * Reports sync step completion (clears any failure state for that step).
   * @param {string} stepName - Canonical step name
   * @param {string} sessionId - Sync session ID
   */
  function reportStepSuccess(stepName, sessionId) {
    const context = `sync.${stepName.toLowerCase().replace(/\s+/g, '_')}`;
    clearAlerts(context);
  }

  /**
   * Helper to get step name from context.
   * @private
   */
  function _getStepNameFromContext(context) {
    // Extract job type from context like 'job.web_products_en'
    if (context.startsWith('job.')) {
      const jobType = context.replace('job.', '');
      return SeverityService.getStepName(jobType);
    }

    // Map sync step contexts
    const stepMappings = {
      'sync.web_product_import': SeverityService.SYNC_STEPS.WEB_PRODUCT_IMPORT,
      'sync.web_order_import': SeverityService.SYNC_STEPS.WEB_ORDER_IMPORT,
      'sync.comax_order_export': SeverityService.SYNC_STEPS.COMAX_ORDER_EXPORT,
      'sync.comax_product_import': SeverityService.SYNC_STEPS.COMAX_PRODUCT_IMPORT,
      'sync.web_inventory_export': SeverityService.SYNC_STEPS.WEB_INVENTORY_EXPORT
    };

    return stepMappings[context] || null;
  }

  /**
   * Helper to safely parse JSON notes.
   * @private
   */
  function _parseNotes(notes) {
    if (!notes) return {};
    if (typeof notes === 'object') return notes;
    try {
      return JSON.parse(notes);
    } catch (e) {
      return {};
    }
  }

  return {
    reportFailure: reportFailure,
    clearAlerts: clearAlerts,
    reportStepSuccess: reportStepSuccess
  };
})();
