/**
 * @file AuditLowProducts.gs
 * @version 25-07-08-1100
 * @description Exports a checklist of Division 1, non-archived, low-stock products from ComaxM in the Reference file to a CSV file in the Export folder.
 */

function AuditLowProducts() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Confirm Audit Export',
    'This will export Division 1 products with stock below 12 (but not zero), excluding archived items. Proceed?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  try {
    // ✅ Open the correct file that contains the ComaxM sheet
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const comaxSheet = referenceSS.getSheetByName('ComaxM');
    if (!comaxSheet) throw new Error('ComaxM sheet not found in Reference file.');

    // 📊 Read data
    const data = comaxSheet.getRange(2, 1, comaxSheet.getLastRow() - 1, comaxSheet.getLastColumn()).getValues();
    const headers = comaxSheet.getRange(1, 1, 1, comaxSheet.getLastColumn()).getValues()[0];

    // 🔍 Filter for Division 1, not archived, stock < 12 but not 0
    const filtered = data.filter(row => {
      const division = row[3];     // CMX DIV (col D)
      const archived = row[12];    // CMX ARCHIVE (col M)
      const stock = row[15];       // CMX STOCK (col P)
      return division === 1 && archived === '' && stock !== '' && stock !== 0 && stock < 12;
    });

    if (filtered.length === 0) {
      ui.alert('No Matching Products', 'No products matched the criteria. No file created.', ui.ButtonSet.OK);
      return;
    }

    // 🧩 Select and export specific columns
    const selectedColumns = [0, 1, 2, 4, 8, 10, 14, 15, 16]; // A, B, C, E, I, K, O, P, Q
    const exportData = [
      selectedColumns.map(i => headers[i]),
      ...filtered.map(row => selectedColumns.map(i => row[i]))
    ];

    // 🕒 Generate filename and CSV content
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
    const filename = `Audit-${timestamp}.csv`;
    const csvContent = convertToCSV(exportData);
    const blob = Utilities.newBlob(csvContent, 'text/csv', filename);

    // 📁 Export to folder
    Logger.log('Export Folder ID: ' + activeConfig.comaxExportFolderId); // Debug
    const exportFolder = DriveApp.getFolderById(activeConfig.comaxExportFolderId);
    exportFolder.createFile(blob);

    ui.alert('Audit Export Complete', `${filtered.length} products exported to file: ${filename}`, ui.ButtonSet.OK);
  } catch (e) {
    Logger.log(e);
    ui.alert('Export Failed', `Error occurred: ${e.message}`, ui.ButtonSet.OK);
  }
}

// 🔄 CSV conversion helper
function convertToCSV(rows) {
  return rows.map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}
