function moveNegativeRows() {
  var ui = SpreadsheetApp.getUi(); // Get the UI instance for the active spreadsheet

  // Display a confirmation dialog
  var response = ui.alert(
    'Confirm Action',
    'Process negative inventory?',
    ui.ButtonSet.YES_NO
  );

  // Check the user's response
  if (response == ui.Button.NO) {
    Logger.log("Action cancelled by user.");
    return; // Stop the function if the user clicks 'No'
  }

  // If the user clicks 'Yes', proceed with the original logic
  var sourceSS = SpreadsheetApp.getActiveSpreadsheet(); // Current file
  var sourceSheet = sourceSS.getSheetByName("Comax"); // Source sheet

  if (!sourceSheet) {
    Logger.log("Error: Sheet 'Comax' not found.");
    ui.alert("Error", "Sheet 'Comax' not found.", ui.ButtonSet.OK); // Inform the user
    return;
  }

  // Open the "Frontend" spreadsheet using its ID
  var targetSS = SpreadsheetApp.openById("1addkn2WXhOCCdI9pw76PndVL_8xvOUy-xEcEXbKcuh4");
  var targetSheet = targetSS.getSheetByName("Negative");

  // If the 'Negative' sheet doesn't exist, create it in "Frontend"
  if (!targetSheet) {
    targetSheet = targetSS.insertSheet("Negative");
  } else {
    targetSheet.clear(); // Remove all existing rows before execution
  }

  var data = sourceSheet.getDataRange().getValues();
  var headers = data[0]; // First row is the header
  var columnIndex = 14; // Column O (zero-based index)

  var negativeRows = [headers]; // Start with headers

  for (var i = 1; i < data.length; i++) {
    // Ensure the value is indeed a number before comparison
    if (typeof data[i][columnIndex] === 'number' && data[i][columnIndex] < 0) {
      negativeRows.push(data[i]);
    }
  }

  if (negativeRows.length > 1) {
    targetSheet.getRange(1, 1, negativeRows.length, negativeRows[0].length).setValues(negativeRows);
    Logger.log("Rows with negative values copied successfully.");
    ui.alert("Success", "Rows with negative values copied successfully.", ui.ButtonSet.OK);
  } else {
    Logger.log("No negative values found.");
    ui.alert("Info", "No negative values found in the 'Comax' sheet.", ui.ButtonSet.OK);
  }
}