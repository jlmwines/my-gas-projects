/**
 * @file SeverityService.js
 * @description Defines severity levels and their behaviors for the notification system.
 */

const SeverityService = (function() {

  /**
   * Severity levels for system notifications.
   * These map to task priority and determine system behavior.
   */
  const SEVERITY = {
    CRITICAL: 'Critical',  // Stop processing, urgent dashboard notification
    HIGH: 'High',          // Continue processing, create urgent task
    NORMAL: 'Normal'       // Continue processing, routine task
  };

  /**
   * Behavior configuration for each severity level.
   */
  const BEHAVIOR = {
    Critical: {
      shouldStop: true,
      createTask: true,
      updateHealthStatus: true,
      taskPriority: 'Critical'
    },
    High: {
      shouldStop: false,
      createTask: true,
      updateHealthStatus: true,
      taskPriority: 'High'
    },
    Normal: {
      shouldStop: false,
      createTask: true,
      updateHealthStatus: false,
      taskPriority: 'Normal'
    }
  };

  /**
   * Canonical sync step names.
   * Format: [Source] [Type] [Import/Export]
   */
  const SYNC_STEPS = {
    WEB_PRODUCT_IMPORT: 'Web Product Import',
    WEB_ORDER_IMPORT: 'Web Order Import',
    COMAX_ORDER_EXPORT: 'Comax Order Export',
    COMAX_PRODUCT_IMPORT: 'Comax Product Import',
    WEB_INVENTORY_EXPORT: 'Web Inventory Export'
  };

  /**
   * Maps job types to canonical step names.
   */
  const JOB_TYPE_TO_STEP = {
    'web_products_en': SYNC_STEPS.WEB_PRODUCT_IMPORT,
    'web_products_he': SYNC_STEPS.WEB_PRODUCT_IMPORT,
    'web_orders': SYNC_STEPS.WEB_ORDER_IMPORT,
    'comax_orders': SYNC_STEPS.COMAX_ORDER_EXPORT,
    'comax_products': SYNC_STEPS.COMAX_PRODUCT_IMPORT,
    'web_inventory': SYNC_STEPS.WEB_INVENTORY_EXPORT
  };

  /**
   * Get behavior configuration for a severity level.
   * @param {string} severity - One of SEVERITY values
   * @returns {object} Behavior configuration
   */
  function getBehavior(severity) {
    return BEHAVIOR[severity] || BEHAVIOR.Normal;
  }

  /**
   * Get canonical step name for a job type.
   * @param {string} jobType - The job type identifier
   * @returns {string} Canonical step name
   */
  function getStepName(jobType) {
    return JOB_TYPE_TO_STEP[jobType] || jobType;
  }

  /**
   * Determine severity based on failure context.
   * @param {string} context - Failure context (e.g., 'quarantine', 'job.failed')
   * @param {object} details - Additional details about the failure
   * @returns {string} Appropriate severity level
   */
  function determineSeverity(context, details) {
    // Quarantine always critical
    if (context.includes('quarantine') || details?.quarantined) {
      return SEVERITY.CRITICAL;
    }

    // Row count decrease is critical
    if (details?.rowCountDecrease) {
      return SEVERITY.CRITICAL;
    }

    // Job failures are high priority
    if (context.startsWith('job.')) {
      return SEVERITY.HIGH;
    }

    // Validation failures (non-quarantine) are high
    if (context.startsWith('validation.')) {
      return SEVERITY.HIGH;
    }

    // Schema mismatches are high
    if (context.includes('schema')) {
      return SEVERITY.HIGH;
    }

    // Default to normal
    return SEVERITY.NORMAL;
  }

  return {
    SEVERITY: SEVERITY,
    BEHAVIOR: BEHAVIOR,
    SYNC_STEPS: SYNC_STEPS,
    getBehavior: getBehavior,
    getStepName: getStepName,
    determineSeverity: determineSeverity
  };
})();
