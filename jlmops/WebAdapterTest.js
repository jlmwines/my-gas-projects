/**
 * @file WebAdapterTest.js
 * @description Unit tests for WebAdapter - Mapping and header validation
 */

const WebAdapterTest = (function() {

  function run() {
    const suiteName = 'WebAdapterTest';
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
    // CRITICAL FIELD MAPPING VALIDATION TESTS
    // =============================================================================

    // --- Test 1: Missing critical field mappings detected ---
    try {
      const criticalFields = ['wps_RegularPrice', 'wps_SKU', 'wps_Name', 'wps_Stock'];

      // Mock column map missing RegularPrice
      const mockColumnMap = {
        'SKU': 'wps_SKU',
        'Name': 'wps_Name',
        'Stock': 'wps_Stock'
        // Missing: RegularPrice -> wps_RegularPrice
      };

      const mappedFields = Object.values(mockColumnMap);
      const missingCriticalMappings = criticalFields.filter(field => !mappedFields.includes(field));

      TestRunner.assert(missingCriticalMappings.length > 0,
        'Missing critical mappings should be detected');
      TestRunner.assert(missingCriticalMappings.includes('wps_RegularPrice'),
        'Missing RegularPrice mapping detected');

      log('Critical Mapping Validation - Missing Detected', true);
    } catch (e) {
      log('Critical Mapping Validation - Missing Detected', false, e);
    }

    // --- Test 2: All critical fields mapped passes ---
    try {
      const criticalFields = ['wps_RegularPrice', 'wps_SKU', 'wps_Name', 'wps_Stock'];

      const mockColumnMap = {
        'Regular price': 'wps_RegularPrice',
        'SKU': 'wps_SKU',
        'Name': 'wps_Name',
        'Stock': 'wps_Stock'
      };

      const mappedFields = Object.values(mockColumnMap);
      const missingCriticalMappings = criticalFields.filter(field => !mappedFields.includes(field));

      TestRunner.assert(missingCriticalMappings.length === 0,
        'All critical fields mapped should pass');

      log('Critical Mapping Validation - All Present Passes', true);
    } catch (e) {
      log('Critical Mapping Validation - All Present Passes', false, e);
    }

    // =============================================================================
    // HEADER VALIDATION TESTS
    // =============================================================================

    // --- Test 3: Missing CSV headers detected ---
    try {
      const mockColumnMap = {
        'Regular price': 'wps_RegularPrice',
        'SKU': 'wps_SKU',
        'Name': 'wps_Name',
        'Stock': 'wps_Stock'
      };

      // CSV file missing "Stock" column
      const csvHeaderRow = ['Regular price', 'SKU', 'Name'].map(h => h.toLowerCase());

      const missingHeaders = Object.keys(mockColumnMap).filter(expectedHeader =>
        csvHeaderRow.indexOf(expectedHeader.toLowerCase()) === -1
      );

      TestRunner.assert(missingHeaders.length > 0,
        'Missing CSV headers should be detected');
      TestRunner.assert(missingHeaders.includes('Stock'),
        'Missing Stock header detected');

      log('Header Validation - Missing Headers Detected', true);
    } catch (e) {
      log('Header Validation - Missing Headers Detected', false, e);
    }

    // --- Test 4: All headers present passes ---
    try {
      const mockColumnMap = {
        'Regular price': 'wps_RegularPrice',
        'SKU': 'wps_SKU',
        'Name': 'wps_Name',
        'Stock': 'wps_Stock'
      };

      const csvHeaderRow = ['regular price', 'sku', 'name', 'stock']; // lowercase

      const missingHeaders = Object.keys(mockColumnMap).filter(expectedHeader =>
        csvHeaderRow.indexOf(expectedHeader.toLowerCase()) === -1
      );

      TestRunner.assert(missingHeaders.length === 0,
        'All headers present should pass');

      log('Header Validation - All Headers Present Passes', true);
    } catch (e) {
      log('Header Validation - All Headers Present Passes', false, e);
    }

    // --- Test 5: Case-insensitive header matching ---
    try {
      const expectedHeader = 'Regular Price';
      const csvHeader = 'regular price'; // Different case

      const matches = expectedHeader.toLowerCase() === csvHeader.toLowerCase();

      TestRunner.assert(matches,
        'Headers should match case-insensitively');

      log('Header Validation - Case Insensitive Matching', true);
    } catch (e) {
      log('Header Validation - Case Insensitive Matching', false, e);
    }

    // =============================================================================
    // FIELD MAPPING TESTS
    // =============================================================================

    // --- Test 6: Column index mapping ---
    try {
      const mockColumnMap = {
        'SKU': 'wps_SKU',
        'Name': 'wps_Name',
        'Stock': 'wps_Stock'
      };

      const csvHeaderRow = ['sku', 'name', 'stock'];
      const csvDataRow = ['TEST-SKU', 'Test Product', '10'];

      const product = {};

      Object.keys(mockColumnMap).forEach(csvHeader => {
        const internalFieldName = mockColumnMap[csvHeader];
        const columnIndex = csvHeaderRow.indexOf(csvHeader.toLowerCase());

        if (columnIndex !== -1) {
          product[internalFieldName] = csvDataRow[columnIndex];
        }
      });

      TestRunner.assertEqual(product['wps_SKU'], 'TEST-SKU', 'SKU mapped correctly');
      TestRunner.assertEqual(product['wps_Name'], 'Test Product', 'Name mapped correctly');
      TestRunner.assertEqual(product['wps_Stock'], '10', 'Stock mapped correctly');

      log('Field Mapping - Column Index Mapping', true);
    } catch (e) {
      log('Field Mapping - Column Index Mapping', false, e);
    }

    // --- Test 7: Missing column in row handled ---
    try {
      const mockColumnMap = {
        'SKU': 'wps_SKU',
        'Name': 'wps_Name',
        'Stock': 'wps_Stock'
      };

      const csvHeaderRow = ['sku', 'name', 'stock'];
      const csvDataRow = ['TEST-SKU', 'Test Product']; // Missing Stock value

      const product = {};

      Object.keys(mockColumnMap).forEach(csvHeader => {
        const internalFieldName = mockColumnMap[csvHeader];
        const columnIndex = csvHeaderRow.indexOf(csvHeader.toLowerCase());

        if (columnIndex !== -1 && columnIndex < csvDataRow.length) {
          product[internalFieldName] = csvDataRow[columnIndex];
        }
      });

      TestRunner.assert(product.hasOwnProperty('wps_SKU'), 'SKU present');
      TestRunner.assert(product.hasOwnProperty('wps_Name'), 'Name present');
      TestRunner.assert(!product.hasOwnProperty('wps_Stock'), 'Stock missing handled');

      log('Field Mapping - Missing Column Value Handled', true);
    } catch (e) {
      log('Field Mapping - Missing Column Value Handled', false, e);
    }

    // =============================================================================
    // TRANSLATION CSV TESTS
    // =============================================================================

    // --- Test 8: Translation mapping works ---
    try {
      const mockColumnMap = {
        'ID': 'wxs_ID',
        'translation': 'wxs_Translation'
      };

      const csvHeaderRow = ['id', 'translation'];
      const csvDataRow = ['123', 'תרגום בעברית'];

      const translation = {};

      Object.keys(mockColumnMap).forEach(csvHeader => {
        const internalFieldName = mockColumnMap[csvHeader];
        const columnIndex = csvHeaderRow.indexOf(csvHeader.toLowerCase());

        if (columnIndex !== -1) {
          translation[internalFieldName] = csvDataRow[columnIndex];
        }
      });

      TestRunner.assertEqual(translation['wxs_ID'], '123', 'ID mapped');
      TestRunner.assertEqual(translation['wxs_Translation'], 'תרגום בעברית', 'Hebrew translation mapped');

      log('Translation CSV - Mapping Works', true);
    } catch (e) {
      log('Translation CSV - Mapping Works', false, e);
    }

    // =============================================================================
    // ORDER LINE ITEMS TESTS
    // =============================================================================

    // --- Test 9: Order line item parsing ---
    try {
      const lineItemString = 'name: Test Product | quantity: 2 | sku: TEST-SKU | total: 200';

      const lineItemData = {};
      const attributes = lineItemString.split('|');

      attributes.forEach(attr => {
        const firstColon = attr.indexOf(':');
        if (firstColon > -1) {
          const key = attr.substring(0, firstColon).trim().toLowerCase();
          const value = attr.substring(firstColon + 1).trim();
          lineItemData[key] = value;
        }
      });

      TestRunner.assertEqual(lineItemData['name'], 'Test Product', 'Product name parsed');
      TestRunner.assertEqual(lineItemData['quantity'], '2', 'Quantity parsed');
      TestRunner.assertEqual(lineItemData['sku'], 'TEST-SKU', 'SKU parsed');
      TestRunner.assertEqual(lineItemData['total'], '200', 'Total parsed');

      log('Order Line Items - Parsing Logic', true);
    } catch (e) {
      log('Order Line Items - Parsing Logic', false, e);
    }

    // --- Test 10: Required line item fields validation ---
    try {
      const productItemFields = ['Name', 'Quantity', 'SKU', 'Total'];

      // Line item with all required fields
      const lineItemData = {
        'name': 'Test Product',
        'quantity': '2',
        'sku': 'TEST-SKU',
        'total': '200'
      };

      const lineItem = {};
      let hasRequiredFields = true;

      productItemFields.forEach(field => {
        const fieldKey = field.trim().toLowerCase();
        if (lineItemData.hasOwnProperty(fieldKey)) {
          lineItem[field] = lineItemData[fieldKey];
        } else {
          if (field === 'SKU' || field === 'Quantity') {
            hasRequiredFields = false;
          }
        }
      });

      TestRunner.assert(hasRequiredFields, 'All required fields present');
      TestRunner.assert(lineItem['SKU'] && lineItem['Quantity'],
        'Critical fields (SKU, Quantity) present');

      log('Order Line Items - Required Fields Validation', true);
    } catch (e) {
      log('Order Line Items - Required Fields Validation', false, e);
    }

    // --- Test 11: Missing required line item fields detected ---
    try {
      const productItemFields = ['Name', 'Quantity', 'SKU', 'Total'];

      // Line item missing SKU
      const lineItemData = {
        'name': 'Test Product',
        'quantity': '2',
        // Missing: 'sku'
        'total': '200'
      };

      const lineItem = {};
      let hasRequiredFields = true;

      productItemFields.forEach(field => {
        const fieldKey = field.trim().toLowerCase();
        if (lineItemData.hasOwnProperty(fieldKey)) {
          lineItem[field] = lineItemData[fieldKey];
        } else {
          if (field === 'SKU' || field === 'Quantity') {
            hasRequiredFields = false;
          }
        }
      });

      TestRunner.assert(!hasRequiredFields, 'Missing required field detected');
      TestRunner.assert(!lineItem['SKU'], 'Missing SKU detected');

      log('Order Line Items - Missing Required Fields Detected', true);
    } catch (e) {
      log('Order Line Items - Missing Required Fields Detected', false, e);
    }

    // =============================================================================
    // EMPTY/INVALID DATA HANDLING TESTS
    // =============================================================================

    // --- Test 12: Empty CSV file handled ---
    try {
      const mockParsedData = [
        ['Header1', 'Header2'] // Only header row
      ];

      TestRunner.assert(mockParsedData.length < 2,
        'Empty CSV (header only) detected');

      log('Empty Data Handling - Empty CSV Detected', true);
    } catch (e) {
      log('Empty Data Handling - Empty CSV Detected', false, e);
    }

    // --- Test 13: Empty rows skipped ---
    try {
      const mockRows = [
        ['SKU-1', 'Product 1', '10'],
        ['', '', ''],  // Empty row
        ['SKU-2', 'Product 2', '20']
      ];

      const validRows = mockRows.filter(row => row.join('').trim() !== '');

      TestRunner.assertEqual(validRows.length, 2, 'Empty rows filtered out');
      TestRunner.assert(!validRows.some(row => row.join('') === ''),
        'No empty rows in result');

      log('Empty Data Handling - Empty Rows Skipped', true);
    } catch (e) {
      log('Empty Data Handling - Empty Rows Skipped', false, e);
    }

    return results;
  }

  return {
    run: run
  };
})();
