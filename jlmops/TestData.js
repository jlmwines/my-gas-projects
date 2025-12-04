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
        { "wpm_SKU": "SKU-A", "wpm_WebIdEn": "WEB-101", "wpm_Stock": 10 },
        { "wpm_SKU": "SKU-B", "wpm_WebIdEn": "WEB-102", "wpm_Stock": 0 },
        { "wpm_SKU": "SKU-C", "wpm_WebIdEn": "WEB-103", "wpm_Stock": 50 }
      ]
    }
  };
})();
