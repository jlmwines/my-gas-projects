/**
 * @file TestRunner.js
 * @description Manages the execution of unit tests and reporting of results.
 */

const TestRunner = (function() {
  
  /**
   * Executes all registered test suites.
   * @returns {Object} The test results summary.
   */
  function runAllTests() {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    // Register suites here
    const suites = [
      OrderServiceTest,
      ProductServiceTest,
      ComaxAdapterTest,
      WebAdapterTest
    ];

    suites.forEach(suite => {
      if (suite && typeof suite.run === 'function') {
        const suiteResults = suite.run();
        results.total += suiteResults.total;
        results.passed += suiteResults.passed;
        results.failed += suiteResults.failed;
        results.details.push(...suiteResults.details);
      }
    });

    return results;
  }

  /**
   * Assertion helper: Checks if a value is strictly equal to expected.
   */
  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message} - Expected: ${expected}, Actual: ${actual}`);
    }
  }

  /**
   * Assertion helper: Checks if a value is truthy.
   */
  function assert(condition, message) {
    if (!condition) {
      throw new Error(`${message} - Condition was false.`);
    }
  }

  return {
    runAllTests: runAllTests,
    assertEqual: assertEqual,
    assert: assert
  };
})();
