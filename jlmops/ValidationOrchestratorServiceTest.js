/**
 * @file ValidationOrchestratorServiceTest.js
 * @description Unit tests for ValidationOrchestratorService.processValidationResults --
 * Tier 3 of `jlmops/plans/TEST_SUITE_EXTENSION_PLAN.md`. Locks in Bug 6 (SYNC_HARDENING_PLAN.md):
 * a rule that returns 'ERROR' never actually ran, so it must quarantine unconditionally,
 * regardless of its own on_failure_quarantine flag. Fixtures use only 'ERROR'/'PASSED'
 * statuses and never set skip_if_open_task_type, so the function takes zero I/O paths
 * (no WebAppTasks.getOpenTasksByTypeId, no TaskService.createTask) -- see the plan's Tier 3
 * section for why that's true of the current code, not just this fixture.
 */
const ValidationOrchestratorServiceTest = (function() {

  function run() {
    const suiteName = 'ValidationOrchestratorServiceTest';
    const results = { total: 0, passed: 0, failed: 0, details: [] };
    function log(test, ok, err) {
      results.total++;
      if (ok) { results.passed++; results.details.push({ suite: suiteName, test: test, status: 'PASSED' }); }
      else { results.failed++; results.details.push({ suite: suiteName, test: test, status: 'FAILED', error: err && err.message }); }
    }

    // --- all PASSED: no quarantine, no failures ---
    try {
      const analysisResult = { results: [
        { status: 'PASSED', rule: {} },
        { status: 'PASSED', rule: {} }
      ] };
      const outcome = ValidationOrchestratorService.processValidationResults(analysisResult, 'test-session');
      TestRunner.assert(outcome.quarantineTriggered === false, 'all-PASSED results should not quarantine');
      TestRunner.assertEqual(outcome.failureCount, 0, 'all-PASSED results should have zero failureCount');
      log('processValidationResults: all PASSED -> no quarantine', true);
    } catch (e) { log('processValidationResults: all PASSED -> no quarantine', false, e); }

    // --- single ERROR, on_failure_quarantine explicitly FALSE: quarantines anyway (Bug 6) ---
    try {
      const analysisResult = { results: [
        { status: 'ERROR', rule: { on_failure_quarantine: 'FALSE' } }
      ] };
      const outcome = ValidationOrchestratorService.processValidationResults(analysisResult, 'test-session');
      TestRunner.assert(outcome.quarantineTriggered === true, 'ERROR result quarantines even when rule.on_failure_quarantine is FALSE (Bug 6)');
      TestRunner.assertEqual(outcome.failureCount, 1, 'ERROR result counts as one failure');
      log('processValidationResults: ERROR quarantines unconditionally (Bug 6)', true);
    } catch (e) { log('processValidationResults: ERROR quarantines unconditionally (Bug 6)', false, e); }

    // --- mixed ERROR + PASSED: failureCount counts only ERROR entries ---
    try {
      const analysisResult = { results: [
        { status: 'PASSED', rule: {} },
        { status: 'ERROR', rule: {} },
        { status: 'PASSED', rule: {} },
        { status: 'ERROR', rule: { on_failure_quarantine: 'FALSE' } }
      ] };
      const outcome = ValidationOrchestratorService.processValidationResults(analysisResult, 'test-session');
      TestRunner.assert(outcome.quarantineTriggered === true, 'any ERROR among mixed results still quarantines');
      TestRunner.assertEqual(outcome.failureCount, 2, 'failureCount counts only the ERROR entries, not PASSED');
      log('processValidationResults: mixed ERROR/PASSED counts only ERROR', true);
    } catch (e) { log('processValidationResults: mixed ERROR/PASSED counts only ERROR', false, e); }

    // --- empty results: no quarantine, no failures ---
    try {
      const analysisResult = { results: [] };
      const outcome = ValidationOrchestratorService.processValidationResults(analysisResult, 'test-session');
      TestRunner.assert(outcome.quarantineTriggered === false, 'empty results should not quarantine');
      TestRunner.assertEqual(outcome.failureCount, 0, 'empty results should have zero failureCount');
      log('processValidationResults: empty results -> no quarantine', true);
    } catch (e) { log('processValidationResults: empty results -> no quarantine', false, e); }

    return results;
  }

  return { run: run };
})();
