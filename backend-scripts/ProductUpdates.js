/**
 * Processes the identified product updates, writing them to the sheets
 * and providing a summary alert.
 * This function is intended to be called after `compareAllChangesCombined`.
 */
function processProductUpdates() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCNew = ss.getSheetByName('C New');
  const productsSheet = ss.getSheetByName('Products');

  // Initial confirmation for the user before applying updates
  const confirmResponse = ui.alert(
    'Apply Updates',
    'Do you want to apply the detected product updates to the sheets?',
    ui.ButtonSet.YES_NO
  );

  if (confirmResponse === ui.Button.NO) {
    Logger.log("Update application cancelled by user.");
    return;
  }

  // Call the identification function to get all the prepared data
  const comparisonResults = compareAllChangesCombined();

  if (!comparisonResults) {
    Logger.log("Comparison failed or sheets not found. Aborting update process.");
    return;
  }

  const {
    productsData,
    columnRValuesCNew,
    cNewDataRowCount,
    productsFlaggedForUpdateInPQRT,
    productsRowsModifiedForOrphanThisRun,
    newCount,
    vintageChangeCount,
    archiveUnarchiveChangeCount,
    priceChangeCount,
    stockChangeCount,
    nameChangeCount,
    webExcludeChangeCount,
    totalRowsWithChangesCNew,
    orphanedProductsCount,
    archivedWithStockAlerts,
    comaxOnlineMissingFromProductsAlerts
  } = comparisonResults;

  Logger.log('--- Starting Final Write Operations for Product Updates ---');

  // Write all collected flags to Column R in 'C New'.
  if (cNewDataRowCount > 0) {
      const targetColumnRRange = sheetCNew.getRange(2, 18, cNewDataRowCount, 1);
      targetColumnRRange.setValues(columnRValuesCNew);
      Logger.log(`Wrote ${totalRowsWithChangesCNew} changes to C New!R.`);
  }

  // Write the updated Products data back to the sheet.
  if (productsFlaggedForUpdateInPQRT > 0 || productsRowsModifiedForOrphanThisRun > 0) {
    // Calculate max columns needed for Products sheet to ensure U (index 20) is included
    // Get existing header row length to determine initial max columns.
    const productsHeaderRow = productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).getValues()[0];
    const PRODUCTS_ORPHAN_NOTE_COL = 20; // Column U is index 20
    let maxColsNeeded = Math.max(productsHeaderRow.length, PRODUCTS_ORPHAN_NOTE_COL + 1);

    productsSheet.getRange(1, 1, productsData.length, maxColsNeeded).setValues(productsData);
    Logger.log(`Updated ${productsFlaggedForUpdateInPQRT + productsRowsModifiedForOrphanThisRun} rows in 'Products' sheet.`);
  } else {
    Logger.log('No direct updates made to the Products sheet based on comparison logic.');
  }

  // --- FINAL SUMMARY ALERT ---
  Logger.log('--- Product Update Application Finished ---');

  let finalSummary = `Product Update Process Complete!\n\n`;
  finalSummary += `Detected changes in 'C New' during comparison:\n`;
  finalSummary += `  - ${newCount} new records ('NEW')\n`;
  finalSummary += `  - ${vintageChangeCount} vintage changes ('VINTAGE')\n`;
  finalSummary += `  - ${archiveUnarchiveChangeCount} archive/unarchive changes\n`;
  finalSummary += `  - ${priceChangeCount} price changes ('PRICE_CHANGE')\n`;
  finalSummary += `  - ${stockChangeCount} stock changes ('STOCK_CHANGE')\n`;
  finalSummary += `  - ${nameChangeCount} name changes ('NAME_CHANGE')\n`;
  finalSummary += `  - ${webExcludeChangeCount} web exclude changes ('WEBEXCLUDE_CHANGE')\n`;
  finalSummary += `Total ${totalRowsWithChangesCNew} rows marked in Column R of 'C New'.\n\n`;

  finalSummary += `Products sheet updates:\n`;
  finalSummary += `  - ${productsFlaggedForUpdateInPQRT} products flagged for update in P, Q, R, T columns.\n`;
  finalSummary += `  - ${orphanedProductsCount} SKUs found in Products!B but not in C New!A (marked 'ORPHAN' in Products!U).\n\n`;

  if (archivedWithStockAlerts.length > 0) {
    finalSummary += `*** CRITICAL ALERTS: Products ARCHIVED but still have online stock! ***\n`;
    archivedWithStockAlerts.forEach(sku => finalSummary += `  - SKU: ${sku}\n`);
    finalSummary += `\n`;
  }

  if (comaxOnlineMissingFromProductsAlerts.length > 0) {
    finalSummary += `*** CRITICAL ALERTS: Online Products in Comax MISSING from Products sheet (online, unarchived, with stock)! ***\n`;
    comaxOnlineMissingFromProductsAlerts.forEach(sku => finalSummary += `  - SKU: ${sku}\n`);
    finalSummary += `\n`;
  }

  ui.alert('Product Updates Complete', finalSummary, ui.ButtonSet.OK);
}