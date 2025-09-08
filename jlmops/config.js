function saveInitialConfig() {
  const spreadsheetId = "1a4aAreab8IdSZjgpNDf0Wj8Rl2UOTwlD525d4Zpc874";
  PropertiesService.getScriptProperties().setProperty("spreadsheetId", spreadsheetId);
  setConfigValue("spreadsheetId", spreadsheetId);
  console.log("Initial configuration saved and spreadsheetId stored in script properties.");
}

function setConfigValue(key, value) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("spreadsheetId");
  if (!spreadsheetId) {
    console.error("Spreadsheet ID not found in script properties. Please run saveInitialConfig() first.");
    return;
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName("SysConfig");

  const data = sheet.getDataRange().getValues();
  let keyFound = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      keyFound = true;
      break;
    }
  }

  if (!keyFound) {
    sheet.appendRow([key, value]);
  }
}

function getConfigValue(key) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("spreadsheetId");
  if (!spreadsheetId) {
    console.error("Spreadsheet ID not found in script properties. Please run saveInitialConfig() first.");
    return null;
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName("SysConfig");

  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return null;
}