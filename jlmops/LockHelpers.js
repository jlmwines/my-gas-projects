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
 * Manual test: from the Apps Script editor, invoke this function twice within
 * ~1 second of each other (two separate "Run" clicks). Expect one execution to
 * complete after ~100ms and the other to log 'lock-contention' and return null.
 * While the first is sleeping, confirm the admin dashboard (doGet) stays responsive.
 */
function smokeLockHelpers() {
  const result = LockHelpers.withScriptLock('smokeLockHelpers', 30000, function() {
    Utilities.sleep(100);
    return 'completed';
  });
  Logger.log(result === null ? 'lock-contention (this execution did not acquire the lock)' : result);
  return result;
}
