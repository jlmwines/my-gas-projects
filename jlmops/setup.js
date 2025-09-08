function createSpreadsheet() {
  const spreadsheet = SpreadsheetApp.create("JLM Operations Hub - Reference Spreadsheet");
  const spreadsheetId = spreadsheet.getId();
  console.log(`Spreadsheet created with ID: ${spreadsheetId}`);

  const sheetNames = [
    "WebProdM",
    "WebDetM",
    "CmxProdM",
    "WebXlt",
    "WebBundles",
    "WebOrdS",
    "WebOrdM",
    "WebOrdItemsM",
    "SysOrdLog",
    "SysPackingCache",
    "SysInventoryOnHold",
    "SysConfig",
    "SysTasks",
    "SysTaskTypes",
    "SysTaskStatusWorkflow"
  ];

  sheetNames.forEach(sheetName => {
    spreadsheet.insertSheet(sheetName);
  });

  spreadsheet.deleteSheet(spreadsheet.getSheetByName("Sheet1"));

  console.log("Sheets created successfully.");
}
