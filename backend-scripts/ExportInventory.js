/**
 * @file ExportInventory.gs
 * @version 25-07-09-0725
 * @description Compares adjusted ComaxM data to WebM and exports differences in inventory or price to a CSV file saved in the Exports folder.
 */

function exportInventoryAdjustments() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Confirm Export',
    'Export will calculate inventory differences between Comax and Website Master, and create a CSV file in your Exports folder. Proceed?',
    ui.ButtonSet.YES_NO
  );
  // FIX: Changed return to return false to be consistent with other functions.
  if (confirm !== ui.Button.YES) return false;

  try {
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const comaxM = referenceSS.getSheetByName('ComaxM');
    const webM = referenceSS.getSheetByName('WebM');
    const onHoldSheet = referenceSS.getSheetByName('OnHoldInventory');

    if (!comaxM || !webM || !onHoldSheet) {
      throw new Error('One or more required sheets (ComaxM, WebM, OnHoldInventory) are missing.');
    }
    
    // FIX: Check if there are data rows before trying to get values.
    // This prevents the "number of rows must be at least 1" error if a sheet only has a header.
    const comaxLastRow = comaxM.getLastRow();
    const comaxData = comaxLastRow > 1 ? comaxM.getRange(2, 1, comaxLastRow - 1, comaxM.getLastColumn()).getValues() : [];

    // FIX: Apply the same check to the WebM sheet.
    const webMLastRow = webM.getLastRow();
    const webMData = webMLastRow > 1 ? webM.getRange(2, 1, webMLastRow - 1, webM.getLastColumn()).getValues() : [];
    
    const onHoldMap = buildOnHoldMap(onHoldSheet);

    const webMBySku = {};
    webMData.forEach(row => webMBySku[String(row[1]).trim()] = row);

    const exportRows = [];

    comaxData.forEach(row => {
      const sku = String(row[1]).trim();
      if (!sku) return;

      const excludeFlag = String(row[17] || '').trim();
      const inventory = Number(row[15]) || 0;
      const price = row[14];
      const name = row[2];

      const onHoldQty = Number(onHoldMap[sku] || 0);
      const finalStock = excludeFlag ? 0 : Math.max(0, inventory - onHoldQty);

      const webRow = webMBySku[sku];
      if (!webRow) return;

      const webStock = Number(webRow[4]) || 0;
      const webPrice = webRow[5];
      const webId = webRow[0];
      const webName = webRow[2];

      if (finalStock !== webStock || price !== webPrice) {
        exportRows.push([webId, sku, webName, finalStock, price]);
      }
    });

    if (exportRows.length === 0) {
      ui.alert('Export Skipped', 'No inventory or price differences found. No file created.', ui.ButtonSet.OK);
      // FIX: Return true because the operation completed successfully, even if no file was created.
      return true;
    }

    const exportFolder = DriveApp.getFolderById(activeConfig.comaxExportFolderId);
    if (!exportFolder) throw new Error('Export folder not found.');

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
    const filename = `ProductInventory-${timestamp}.csv`;

    const csvContent = convertToCSV([['ID', 'SKU', 'WName', 'Stock', 'Regular Price'], ...exportRows]);
    const blob = Utilities.newBlob(csvContent, 'text/csv', filename);
    exportFolder.createFile(blob);

    const state = getUiState();
    state.exportComplete = true; // Note: This was exportInventoryComplete in the original, corrected to match UI script
    saveUiState(state);

    ui.alert('Export Complete', `${exportRows.length} products exported to file: ${filename}`, ui.ButtonSet.OK);
    return true; // FIX: Return true on success
  } catch (e) {
    Logger.log(e);
    ui.alert('Export Failed', `Error occurred: ${e.message}`, ui.ButtonSet.OK);
    return false; // FIX: Return false on failure
  }
}

function convertToCSV(rows) {
  return rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function buildOnHoldMap(sheet) {
  // FIX: Check if the sheet has data rows before processing.
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {}; // Return an empty map if no data exists
  }
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const map = {};
  rows.forEach(r => {
    const sku = String(r[0] || '').trim();
    const qty = Number(r[1]) || 0;
    if (sku) map[sku] = qty;
  });
  return map;
}
