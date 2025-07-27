/**
 * @file ComaxSync.gs
 * @description Clears and repopulates frontend Comax sheet from reference ComaxM.
 * @version 25-07-24-0723
 */

/**
 * Syncs frontend Comax sheet with filtered, sorted data from reference ComaxM.
 */
function syncComaxDirectory() {
  const frontendSS = SpreadsheetApp.getActiveSpreadsheet();
  const comaxSheet = frontendSS.getSheetByName(G.SHEET_NAMES.COMAX_DIRECTORY);
  if (!comaxSheet) throw new Error('Frontend sheet "Comax" not found.');

  const refSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);
  const data = refSheet.getDataRange().getValues();

  // Define column indices (0-based)
  const CMX_SKU_COL = 1;     // Col B
  const CMX_NAME_COL = 2;    // Col C
  const CMX_ARCHIVE_COL = 12; // Col M

  // Prepare filtered and sorted rows
  const rows = data.slice(1)
    .filter(row => row[CMX_ARCHIVE_COL] === '') // not archived
    .map(row => [row[CMX_NAME_COL], row[CMX_SKU_COL]]) // [Name, SKU]
    .sort((a, b) => a[0].localeCompare(b[0])); // sort by Name

  // Write header
  comaxSheet.clearContents();
  comaxSheet.getRange(1, 1, 1, 2).setValues([['CMX NAME', 'CMX SKU']]);

  // Write filtered data starting from row 2
  if (rows.length > 0) {
    comaxSheet.getRange(2, 1, rows.length, 2).setValues(rows);
    frontendSS.setActiveSheet(comaxSheet);
  }
}