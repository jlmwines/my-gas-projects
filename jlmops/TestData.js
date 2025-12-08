/**
 * @file TestData.js
 * @description Contains static mock data for unit testing.
 */

const TestData = (function() {
  return {
    // --- Order Service Mocks ---
    orders: {
      valid: [
        {
          "wom_OrderId": "1001",
          "wom_OrderNumber": "ORD-001",
          "wom_Status": "processing",
          "wom_OrderDate": "2023-10-26",
          "wom_CustomerNote": "Please pack carefully."
        },
        {
          "wom_OrderId": "1002",
          "wom_OrderNumber": "ORD-002",
          "wom_Status": "completed",
          "wom_OrderDate": "2023-10-25",
          "wom_CustomerNote": ""
        }
      ],
      invalid: [
        {
          "wom_OrderId": "", // Missing ID
          "wom_OrderNumber": "ORD-003",
          "wom_Status": "processing"
        }
      ],
      sad_path: [
        {
          "wom_OrderId": "1003", 
          "wom_OrderNumber": "ORD-004",
          "wom_Status": "Processing " // Trailing space - common error
        },
        {
          "wom_OrderId": "1004",
          "wom_OrderNumber": "ORD-005",
          "wom_Status": null // Null status
        }
      ]
    },
    orderItems: {
      valid: [
        { "woi_OrderId": "1001", "woi_SKU": "SKU-A", "woi_Quantity": 2 },
        { "woi_OrderId": "1001", "woi_SKU": "SKU-B", "woi_Quantity": 1 },
        { "woi_OrderId": "1002", "woi_SKU": "SKU-C", "woi_Quantity": 5 }
      ],
      empty: [] // No items
    },

    // --- Product Service Mocks ---
    products: {
      valid: [
        { "wpm_SKU": "SKU-A", "wpm_WebIdEn": "WEB-101", "wpm_Stock": 10, "wpm_Price": "100.00", "wpm_NameEn": "Product A" },
        { "wpm_SKU": "SKU-B", "wpm_WebIdEn": "WEB-102", "wpm_Stock": 0, "wpm_Price": "50.00", "wpm_NameEn": "Product B" },
        { "wpm_SKU": "SKU-C", "wpm_WebIdEn": "WEB-103", "wpm_Stock": 50, "wpm_Price": "200.00", "wpm_NameEn": "Product C" }
      ],
      missing_critical_fields: [
        { "wpm_SKU": "SKU-D", "wpm_WebIdEn": "WEB-104", "wpm_Stock": "", "wpm_Price": "", "wpm_NameEn": "" }, // Empty critical fields
        { "wpm_SKU": "", "wpm_WebIdEn": "WEB-105", "wpm_Stock": "10", "wpm_Price": "100.00", "wpm_NameEn": "Product E" } // Missing SKU
      ]
    },

    // --- Comax Product Mocks ---
    comaxProducts: {
      valid: [
        { "cps_CmxId": "12345", "cps_SKU": "SKU-A", "cps_NameHe": "מוצר א", "cps_Stock": "10", "cps_Price": "100.00" },
        { "cps_CmxId": "12346", "cps_SKU": "SKU-B", "cps_NameHe": "מוצר ב", "cps_Stock": "20", "cps_Price": "200.00" }
      ],
      missing_critical_fields: [
        { "cps_CmxId": "12347", "cps_SKU": "", "cps_NameHe": "מוצר ג", "cps_Stock": "30", "cps_Price": "300.00" }, // Missing SKU
        { "cps_CmxId": "12348", "cps_SKU": "SKU-D", "cps_NameHe": "", "cps_Stock": "", "cps_Price": "400.00" } // Missing Name & Stock
      ]
    },

    // --- Schema/Mapping Mocks ---
    schemas: {
      valid_comax_mapping: {
        "0": "cpm_CmxId",
        "1": "cpm_SKU",
        "2": "cpm_NameHe",
        "5": "cpm_Stock",
        "7": "cpm_Price"
      },
      invalid_comax_mapping_too_few_columns: {
        "0": "cpm_CmxId",
        "1": "cpm_SKU",
        "15": "cpm_Price" // Expects column 15, but file only has 10
      },
      valid_web_mapping: {
        "wps_Stock": "wpm_Stock",
        "wps_RegularPrice": "wpm_Price",
        "wps_SKU": "wpm_SKU",
        "wps_Name": "wpm_NameEn"
      },
      invalid_web_mapping_missing_critical: {
        "wps_Stock": "wpm_Stock",
        "wps_SKU": "wpm_SKU",
        "wps_Name": "wpm_NameEn"
        // Missing: wps_RegularPrice
      },
      invalid_web_mapping_wrong_field: {
        "wps_Stock": "wpm_Stock",
        "wps_RegularPrice": "wpm_WRONG_FIELD", // Wrong target field
        "wps_SKU": "wpm_SKU",
        "wps_Name": "wpm_NameEn"
      }
    },

    // --- CSV Data Mocks ---
    csvData: {
      valid_web_products: [
        ['SKU', 'Name', 'Regular price', 'Stock'],
        ['SKU-A', 'Product A', '100.00', '10'],
        ['SKU-B', 'Product B', '50.00', '5']
      ],
      missing_headers: [
        ['SKU', 'Name', 'Regular price'], // Missing Stock header
        ['SKU-A', 'Product A', '100.00'],
        ['SKU-B', 'Product B', '50.00']
      ],
      empty_file: [
        ['SKU', 'Name', 'Regular price', 'Stock'] // Header only, no data
      ]
    },

    // --- Validation Result Mocks ---
    validationResults: {
      quarantine_triggered: {
        results: [
          { status: 'FAILED', message: 'Row count decreased' },
          { status: 'FAILED', message: 'Schema mismatch' }
        ]
      },
      all_passed: {
        results: [
          { status: 'PASSED', message: 'Schema validation passed' },
          { status: 'PASSED', message: 'Row count validation passed' }
        ]
      },
      warnings_only: {
        results: [
          { status: 'WARNING', message: 'Minor field mismatch' }
        ]
      }
    }
  };
})();
