/**
 * @file DownloadDetails.gs
 * @description Provides functionality to download specific details from the 'Details' sheet
 * to the 'Download' sheet, clearing previous data and activating the 'Download' sheet.
 */

/**
 * Copies specific columns from the 'Details' sheet to the 'Download' sheet,
 * with an option to filter by 'in stock' (Column M > 0).
 * It first asks for user confirmation, clears the destination sheet, adds headers,
 * and then activates the 'Download' sheet after the copy operations.
 *
 * This version includes a check for '#N/A' values in columns B and C of the 'Details' sheet
 * and halts the script if found.
 */
function downloadDetails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Get the 'Details' and 'Download' sheets
  const detailsSheet = ss.getSheetByName('Details');
  const downloadSheet = ss.getSheetByName('Download');
  const ui = SpreadsheetApp.getUi(); // Get the user interface object for alerts and prompts.

  // --- Confirmation Step 1: Proceed with Download ---
  const initialResponse = ui.alert(
    'Confirm Action',
    'This action will clear all existing data in the "Download" sheet ' +
    'and copy new data. Do you want to proceed?',
    ui.ButtonSet.YES_NO
  );

  if (initialResponse == ui.Button.NO) {
    ui.alert('Action Cancelled', 'The download operation has been cancelled.', ui.ButtonSet.OK);
    return;
  }

  // Check if both sheets exist. If not, log an error and return.
  if (!detailsSheet) {
    ui.alert('Error', 'Sheet "Details" not found. Please ensure it exists.', ui.ButtonSet.OK);
    console.error('Sheet "Details" not found.');
    return;
  }
  if (!downloadSheet) {
    ui.alert('Error', 'Sheet "Download" not found. Please ensure it exists.', ui.ButtonSet.OK);
    console.error('Sheet "Download" not found.');
    return;
  }

  // Get the last row with data in the 'Details' sheet for accurate range selection.
  const lastRowDetails = detailsSheet.getLastRow();

  // If 'Details' sheet has no data rows (only headers or empty), inform the user and return.
  if (lastRowDetails <= 1) {
    ui.alert('Info', 'The "Details" sheet is empty or only contains headers. No data to copy.', ui.ButtonSet.OK);
    return;
  }

  // --- NEW STEP: Check for #N/A in Columns B and C of 'Details' sheet ---
  // Read values from columns B and C, starting from row 2 (assuming row 1 is header).
  const rangeToCheck = detailsSheet.getRange(2, 2, lastRowDetails - 1, 2); // Columns B and C
  const valuesToCheck = rangeToCheck.getValues();

  let nACellFound = false;
  let firstNACellLocation = '';

  for (let r = 0; r < valuesToCheck.length; r++) {
    for (let c = 0; c < valuesToCheck[r].length; c++) {
      // Google Apps Script retrieves #N/A errors as the string "#N/A"
      if (valuesToCheck[r][c] === '#N/A') {
        nACellFound = true;
        // Calculate the actual row and column number for the alert message
        const actualRow = r + 2; // +2 because we started from row 2 and arrays are 0-indexed
        const actualCol = c === 0 ? 'B' : 'C'; // 0 is B, 1 is C
        firstNACellLocation = `${actualCol}${actualRow}`;
        break; // Stop checking columns in this row
      }
    }
    if (nACellFound) {
      break; // Stop checking rows
    }
  }

  if (nACellFound) {
    ui.alert(
      'Error: #N/A Value Found',
      `The script cannot proceed because an #N/A value was found in Column ${firstNACellLocation} ` +
      `of the "Details" sheet. Please correct this error before running the script again.`,
      ui.ButtonSet.OK
    );
    return; // Halt the script
  }
  console.log('No #N/A values found in columns B and C. Proceeding with download.');
  // --- END NEW STEP ---

  // --- Confirmation Step 2: Filtering Option ---
  // Ask the user if they want to filter for in-stock products.
  const filterResponse = ui.alert(
    'Filter Data',
    'Do you want to copy ONLY products that are "in stock" (Column M > 0)?\n\n' +
    '• Yes: Only copy rows where Column M value is greater than 0.\n' +
    '• No: Copy ALL records regardless of Column M value.',
    ui.ButtonSet.YES_NO
  );

  const filterInStock = (filterResponse == ui.Button.YES);
  console.log(`User chose to filter for in-stock products: ${filterInStock}`);


  // --- Clear Existing Data from Destination Sheet ---
  const lastRowDownload = downloadSheet.getLastRow();
  if (lastRowDownload > 0) {
    downloadSheet.getRange(1, 1, lastRowDownload, downloadSheet.getLastColumn()).clearContent();
  }
  console.log('Existing data in "Download" sheet cleared.');

  // --- Add Headers to Download Sheet ---
  const headers = [['ID', 'Short Description', 'Description']];
  downloadSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  console.log('Headers added to "Download" sheet.');


  // Define the range to read from 'Details' sheet to cover all required source columns (B to BB) and M.
  // B=2, M=13, AY=51, AZ=52, BA=53, BB=54
  // Smallest column index is 2 (B), largest is 54 (BB).
  // numRows is lastRowDetails - 1 (to skip header).
  // numColumns is 54 - 2 + 1 = 53 columns (from B to BB inclusive).
  const sourceDataRange = detailsSheet.getRange(2, 2, lastRowDetails - 1, 53); // Read from column B to BB
  const allDetailsValues = sourceDataRange.getValues(); // Get all values as a 2D array.
  console.log(`Read ${allDetailsValues.length} rows from "Details" sheet.`);

  // Prepare arrays to hold the filtered data for each set
  const filteredDataSet1 = []; // For columns C, BB, AY
  const filteredDataSet2 = []; // For columns B, BA, AZ

  // Define the column indices within the `allDetailsValues` array (0-indexed)
  // based on reading from column B (index 2) to BB (index 54).
  const COL_B_INDEX_IN_ARRAY = 0;   // Original column B (2) -> array index 0
  const COL_C_INDEX_IN_ARRAY = 1;   // Original column C (3) -> array index 1
  const COL_M_INDEX_IN_ARRAY = 11;  // Original column M (13) -> array index 11
  const COL_AY_INDEX_IN_ARRAY = 49; // Original column AY (51) -> array index 49
  const COL_AZ_INDEX_IN_ARRAY = 50; // Original column AZ (52) -> array index 50
  const COL_BA_INDEX_IN_ARRAY = 51; // Original column BA (53) -> array index 51
  const COL_BB_INDEX_IN_ARRAY = 52; // Original column BB (54) -> array index 52

  // Iterate through each row of the read data to filter and extract values
  allDetailsValues.forEach(row => {
    const columnMValue = parseFloat(row[COL_M_INDEX_IN_ARRAY]); // Get value from Column M for filtering

    // Apply filtering logic if user chose to filter
    if (filterInStock && (isNaN(columnMValue) || columnMValue <= 0)) {
      // If filtering for in-stock and M is not a positive number, skip this row.
      return;
    }

    // Extract values for the first set (C, BB, AY)
    filteredDataSet1.push([
      row[COL_C_INDEX_IN_ARRAY],   // Value from Column C
      row[COL_BB_INDEX_IN_ARRAY],  // Value from Column BB
      row[COL_AY_INDEX_IN_ARRAY]   // Value from Column AY
    ]);

    // Extract values for the second set (B, BA, AZ)
    filteredDataSet2.push([
      row[COL_B_INDEX_IN_ARRAY],   // Value from Column B
      row[COL_BA_INDEX_IN_ARRAY],  // Value from Column BA
      row[COL_AZ_INDEX_IN_ARRAY]   // Value from Column AZ
    ]);
  });

  // Check if any data was copied after filtering
  if (filteredDataSet1.length === 0) {
    ui.alert('Info', 'No data found to copy based on the selected filter (or sheet is empty).', ui.ButtonSet.OK);
    return;
  }

  // --- Write First Set of Data (C, BB, AY) to Download Sheet ---
  console.log('Writing first set of data (C, BB, AY) to "Download" sheet.');
  // Data starts from row 2 on the 'Download' sheet (after headers)
  downloadSheet.getRange(2, 1, filteredDataSet1.length, 3).setValues(filteredDataSet1);

  // --- Write Second Set of Data (B, BA, AZ) to Download Sheet ---
  // The second set of data will start immediately after the first set.
  const startRowForSecondSet = 2 + filteredDataSet1.length;
  console.log(`Writing second set of data (B, BA, AZ) starting at row ${startRowForSecondSet}.`);
  downloadSheet.getRange(startRowForSecondSet, 1, filteredDataSet2.length, 3).setValues(filteredDataSet2);

  // --- Switch Focus to Sheet 'Download' ---
  ss.setActiveSheet(downloadSheet);
  console.log('Focus switched to "Download" sheet.');

  ui.alert('Success', 'Details have been successfully downloaded to the "Download" sheet with updated headers and data based on your selection.', ui.ButtonSet.OK);
}
