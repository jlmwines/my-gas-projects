/**
 * @file TestScript.gs
 * @description Isolated test to verify Google Docs placeholder access using live config IDs.
 * @version 25-07-21-1728
 */

function testPlaceholderAccess() {
  // Using IDs directly from activeConfig, so no manual editing needed here.
  const TEMPLATE_ID = activeConfig.packingSlipTemplateId;
  const FOLDER_ID = activeConfig.packingSlipFolderId;
  const TEST_PLACEHOLDER = '[PLACE TABLE HERE - SCRIPT WILL GENERATE]';

  try {
    // Ensure permissions are requested for DocumentApp and DriveApp.
    // This function will force authorization if not already granted.
    const tempDocFile = DriveApp.getFileById(TEMPLATE_ID).makeCopy("TempTestDoc", DriveApp.getFolderById(FOLDER_ID));
    const doc = DocumentApp.openById(tempDocFile.getId());
    const body = doc.getBody();

    Logger.log('Successfully opened document and body.');

    const foundTextRange = body.findText(TEST_PLACEHOLDER);

    if (foundTextRange) {
      Logger.log('Placeholder text found in document.');
      const elementFound = foundTextRange.getElement();
      Logger.log('Element found by getElement(): ' + elementFound.getType());

      // This is the critical line that has been causing the error.
      // It correctly gets the parent paragraph of the found text.
      const parentElement = elementFound.getParent();
      Logger.log('Parent element: ' + parentElement.getType());

      const index = parentElement.getIndex();
      Logger.log('Index of parent element: ' + index);

      // Clean up the temporary document
      doc.saveAndClose();
      DriveApp.getFileById(tempDocFile.getId()).setTrashed(true);
      Logger.log('Test successful. Temporary document trashed.');
    } else {
      Logger.log(`Error: Placeholder '${TEST_PLACEHOLDER}' NOT found in the template.`);
      SpreadsheetApp.getUi().alert(`Error: Test failed. Placeholder '${TEST_PLACEHOLDER}' not found in template. Please verify your template.`);
    }

  } catch (e) {
    Logger.log(`Test failed with error: ${e.message}`);
    SpreadsheetApp.getUi().alert(`Isolated test failed: ${e.message}. Check logs for details.`);
  }
}