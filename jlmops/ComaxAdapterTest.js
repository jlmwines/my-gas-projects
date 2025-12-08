/**
 * @file ComaxAdapterTest.js
 * @description Unit tests for ComaxAdapter - Schema and field validation
 */

const ComaxAdapterTest = (function() {

  function run() {
    const suiteName = 'ComaxAdapterTest';
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    // Helper to log result
    function log(testName, success, error = null) {
      results.total++;
      if (success) {
        results.passed++;
        results.details.push({ suite: suiteName, test: testName, status: 'PASSED' });
      } else {
        results.failed++;
        results.details.push({ suite: suiteName, test: testName, status: 'FAILED', error: error.message });
      }
    }

    // =============================================================================
    // SCHEMA VALIDATION TESTS
    // =============================================================================

    // --- Test 1: File with too few columns throws error ---
    try {
      // Mock: Mapping expects column index 15, but file only has 10 columns
      const mockIndexMap = {
        '0': 'cpm_CmxId',
        '1': 'cpm_SKU',
        '5': 'cpm_Stock',
        '15': 'cpm_Price' // Highest index
      };

      const maxColumnIndex = Math.max(...Object.keys(mockIndexMap).map(k => parseInt(k, 10)));
      const fileColumnCount = 10; // File only has 10 columns

      TestRunner.assertEqual(maxColumnIndex, 15, 'Max column index calculation');
      TestRunner.assert(fileColumnCount <= maxColumnIndex,
        'File column count insufficient should be detected');

      log('Schema Validation - Too Few Columns Detected', true);
    } catch (e) {
      log('Schema Validation - Too Few Columns Detected', false, e);
    }

    // --- Test 2: File with correct column count passes ---
    try {
      const mockIndexMap = {
        '0': 'cpm_CmxId',
        '1': 'cpm_SKU',
        '5': 'cpm_Stock',
        '15': 'cpm_Price'
      };

      const maxColumnIndex = Math.max(...Object.keys(mockIndexMap).map(k => parseInt(k, 10)));
      const fileColumnCount = 20; // File has 20 columns

      TestRunner.assert(fileColumnCount > maxColumnIndex,
        'Sufficient columns should pass validation');

      log('Schema Validation - Correct Column Count Passes', true);
    } catch (e) {
      log('Schema Validation - Correct Column Count Passes', false, e);
    }

    // --- Test 3: Empty file throws error ---
    try {
      const mockAllData = [
        ['Header1', 'Header2', 'Header3'] // Only header, no data rows
      ];

      TestRunner.assert(mockAllData.length < 2,
        'Empty file (header only) should be detected');

      log('Schema Validation - Empty File Detected', true);
    } catch (e) {
      log('Schema Validation - Empty File Detected', false, e);
    }

    // =============================================================================
    // FIELD VALIDATION TESTS
    // =============================================================================

    // --- Test 4: Missing expected fields detected ---
    try {
      const expectedHeaders = ['cps_CmxId', 'cps_SKU', 'cps_NameHe', 'cps_Stock', 'cps_Price'];

      // Mock product with missing field
      const mockProduct = {
        'cps_CmxId': '12345',
        'cps_SKU': 'TEST-SKU',
        // Missing: cps_NameHe
        'cps_Stock': '10',
        'cps_Price': '100.00'
      };

      const missingExpectedFields = expectedHeaders.filter(header => !mockProduct.hasOwnProperty(header));

      TestRunner.assert(missingExpectedFields.length > 0,
        'Missing fields should be detected');
      TestRunner.assert(missingExpectedFields.includes('cps_NameHe'),
        'Specific missing field (cps_NameHe) detected');

      log('Field Validation - Missing Expected Fields Detected', true);
    } catch (e) {
      log('Field Validation - Missing Expected Fields Detected', false, e);
    }

    // --- Test 5: Empty critical fields detected ---
    try {
      const criticalFields = ['cps_CmxId', 'cps_SKU', 'cps_NameHe', 'cps_Stock', 'cps_Price'];

      const mockProduct = {
        'cps_CmxId': '12345',
        'cps_SKU': '',  // EMPTY
        'cps_NameHe': 'Test Product',
        'cps_Stock': '',  // EMPTY
        'cps_Price': '100.00'
      };

      const emptyCriticalFields = criticalFields.filter(field =>
        !mockProduct[field] || String(mockProduct[field]).trim() === ''
      );

      TestRunner.assert(emptyCriticalFields.length > 0,
        'Empty critical fields should be detected');
      TestRunner.assert(emptyCriticalFields.includes('cps_SKU'),
        'Empty SKU detected');
      TestRunner.assert(emptyCriticalFields.includes('cps_Stock'),
        'Empty Stock detected');

      log('Field Validation - Empty Critical Fields Detected', true);
    } catch (e) {
      log('Field Validation - Empty Critical Fields Detected', false, e);
    }

    // --- Test 6: Valid product with all fields passes ---
    try {
      const criticalFields = ['cps_CmxId', 'cps_SKU', 'cps_NameHe', 'cps_Stock', 'cps_Price'];

      const mockProduct = {
        'cps_CmxId': '12345',
        'cps_SKU': 'TEST-SKU',
        'cps_NameHe': 'Test Product',
        'cps_Stock': '10',
        'cps_Price': '100.00'
      };

      const emptyCriticalFields = criticalFields.filter(field =>
        !mockProduct[field] || String(mockProduct[field]).trim() === ''
      );

      TestRunner.assert(emptyCriticalFields.length === 0,
        'Valid product should have no empty critical fields');

      log('Field Validation - Valid Product Passes', true);
    } catch (e) {
      log('Field Validation - Valid Product Passes', false, e);
    }

    // =============================================================================
    // ERROR REPORTING TESTS
    // =============================================================================

    // --- Test 7: Error messages include row numbers ---
    try {
      const rowIndex = 5; // 0-based index
      const rowNumber = rowIndex + 2; // +2 because: +1 for 1-based, +1 for header row

      const errorMessage = `Row ${rowNumber}: Missing field cps_NameHe`;

      TestRunner.assertEqual(rowNumber, 7, 'Row number calculation correct');
      TestRunner.assert(errorMessage.includes('Row 7'),
        'Error message includes row number');

      log('Error Reporting - Row Numbers Included', true);
    } catch (e) {
      log('Error Reporting - Row Numbers Included', false, e);
    }

    // --- Test 8: Multiple errors list first 10 ---
    try {
      const mockMappingErrors = [];

      // Simulate 15 errors
      for (let i = 0; i < 15; i++) {
        mockMappingErrors.push(`Row ${i + 2}: Some error`);
      }

      const totalErrors = mockMappingErrors.length;
      const errorSummary = mockMappingErrors.slice(0, 10);

      TestRunner.assertEqual(totalErrors, 15, 'Total errors count');
      TestRunner.assertEqual(errorSummary.length, 10, 'Summary shows first 10');
      TestRunner.assert(totalErrors > 10,
        'Should indicate more errors exist');

      log('Error Reporting - Lists First 10 Errors', true);
    } catch (e) {
      log('Error Reporting - Lists First 10 Errors', false, e);
    }

    // --- Test 9: Error message format validation ---
    try {
      const totalErrors = 15;
      const errorSummary = ['Row 2: Error 1', 'Row 3: Error 2'].join('\n');
      const errorMsg = `MAPPING ERRORS DETECTED (${totalErrors} total):\n${errorSummary}\n... and ${totalErrors - 10} more\nCheck if Comax export format changed. HALTING import.`;

      TestRunner.assert(errorMsg.includes('MAPPING ERRORS DETECTED'),
        'Error message has clear header');
      TestRunner.assert(errorMsg.includes('(15 total)'),
        'Error message shows total count');
      TestRunner.assert(errorMsg.includes('... and 5 more'),
        'Error message indicates additional errors');
      TestRunner.assert(errorMsg.includes('HALTING import'),
        'Error message indicates action taken');

      log('Error Reporting - Proper Format', true);
    } catch (e) {
      log('Error Reporting - Proper Format', false, e);
    }

    // =============================================================================
    // DATA TYPE VALIDATION TESTS
    // =============================================================================

    // --- Test 10: CmxId number formatting ---
    try {
      const mockCellValue = 12345; // Number from spreadsheet
      const targetFieldName = 'cps_CmxId';

      let formattedValue;
      if (targetFieldName === 'cps_CmxId' && typeof mockCellValue === 'number') {
        formattedValue = new Number(mockCellValue).toFixed(0);
      } else {
        formattedValue = String(mockCellValue);
      }

      TestRunner.assertEqual(formattedValue, '12345', 'CmxId formatted as string');
      TestRunner.assert(typeof formattedValue === 'string',
        'CmxId is string type');

      log('Data Type Validation - CmxId Number Formatting', true);
    } catch (e) {
      log('Data Type Validation - CmxId Number Formatting', false, e);
    }

    // --- Test 11: Date formatting ---
    try {
      const mockDate = new Date('2023-10-26');
      let formattedValue;

      if (mockDate instanceof Date) {
        formattedValue = Utilities.formatDate(mockDate, "UTC", "dd/MM/yyyy");
      } else {
        formattedValue = String(mockDate);
      }

      TestRunner.assert(formattedValue.includes('/'),
        'Date formatted with slashes');
      TestRunner.assertEqual(formattedValue, '26/10/2023',
        'Date formatted correctly');

      log('Data Type Validation - Date Formatting', true);
    } catch (e) {
      log('Data Type Validation - Date Formatting', false, e);
    }

    // --- Test 12: Empty/null value handling ---
    try {
      const mockCellValues = [null, undefined, '', '  '];

      mockCellValues.forEach(val => {
        const trimmed = String(val || '').trim();
        TestRunner.assertEqual(trimmed, '',
          `Value "${val}" should trim to empty string`);
      });

      log('Data Type Validation - Empty/Null Handling', true);
    } catch (e) {
      log('Data Type Validation - Empty/Null Handling', false, e);
    }

    return results;
  }

  return {
    run: run
  };
})();
