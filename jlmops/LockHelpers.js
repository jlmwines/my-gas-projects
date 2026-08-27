/**
 * @file LockHelpers.js
 * @description Script-lock helper for serializing critical sections. Stage A of the
 * sync-state race fix (jlmops/plans/SYNC_HARDENING_PLAN.md #1.3) — ships the primitive
 * only, no call sites migrated onto it yet.
 */

const LockHelpers = (function() {
  const SERVICE_NAME = 'LockHelpers';

  /**
   * Runs fn() while holding the Apps Script lock, always releasing it afterward.
   * @param {string} context - Caller-supplied label for the contention log.
   * @param {number} timeoutMs - Max time to wait for the lock, in ms (default 30000).
   * @param {function} fn - Function to run while holding the lock.
   * @returns {*} fn()'s return value, or null if the lock could not be acquired.
   */
  function withScriptLock(context, timeoutMs, fn) {
    const fnName = 'withScriptLock';
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(timeoutMs || 30000)) {
      logger.info(SERVICE_NAME, fnName, 'lock-contention', { context: context });
      return null;
    }
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  return {
    withScriptLock: withScriptLock
  };
})();

/**
 * Editor smoke test for LockHelpers (Smoke A, SYNC_HARDENING_PLAN.md).
 *
 * Manual test: the Apps Script editor's Run button is disabled per-tab during an
 * active execution, so two overlapping runs require two separate browser tabs, both
 * with this function selected. Click Run in tab 1, then immediately switch to tab 2
 * and click Run while tab 1 is still sleeping (8s window). Expect one execution to
 * log 'completed' and the other to log 'lock-contention' and return null. While
 * tab 1 is sleeping, confirm the admin dashboard (doGet) stays responsive.
 */
function smokeLockHelpers() {
  const result = LockHelpers.withScriptLock('smokeLockHelpers', 30000, function() {
    Utilities.sleep(8000);
    return 'completed';
  });
  Logger.log(result === null ? 'lock-contention (this execution did not acquire the lock)' : result);
  return result;
}

/**
 * Editor smoke test for the lock-contention/reject branch (Smoke A, SYNC_HARDENING_PLAN.md).
 *
 * Run smokeLockHelpers() in tab 1 first (holds the lock 8s). Then, within that 8s
 * window, run THIS function in tab 2 — its timeoutMs (2s) is shorter than tab 1's
 * remaining hold, so tryLock cannot succeed in time. Expect this to log
 * 'lock-contention' and return null immediately (~2s), not wait the full 8s.
 */
function smokeLockHelpersShortTimeout() {
  const result = LockHelpers.withScriptLock('smokeLockHelpersShortTimeout', 2000, function() {
    return 'completed';
  });
  Logger.log(result === null ? 'lock-contention (this execution did not acquire the lock)' : result);
  return result;
}
