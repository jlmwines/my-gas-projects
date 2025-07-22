/**
 * @file PackingSlipCreator.gs
 * @description Functions for generating Google Docs packing slips from template. Product table insertion fixed.
 * @version 25-07-21-1818
 */

/**
 * Creates a Google Docs packing slip for a single order using a template.
 * The function expects pre-processed data specific to one order.
 *
 * @param {Array} orderQueueEntry - A single row from PackingQueue: [Order Number, Order Date, Customer Name, Phone, Email, Address (multi-line), Customer Note, Order ID]
 * @param {Array[]} orderRowsEntries - An array of product rows from PackingRows for this specific order.
 * @returns {string} The File ID of the newly created packing slip Google Doc.
 */
function createPackingSlipDoc(orderQueueEntry, orderRowsEntries) {
  if (!activeConfig.packingSlipTemplateId || !activeConfig.packingSlipFolderId) {
    throw new Error("Packing slip template ID or folder ID not configured in Globals.gs.");
  }

  const templateFile = DriveApp.getFileById(activeConfig.packingSlipTemplateId);
  const outputFolder = DriveApp.getFolderById(activeConfig.packingSlipFolderId);

  const orderNumber = orderQueueEntry[0];
  const orderDate = orderQueueEntry[1];
  const customerName = orderQueueEntry[2];
  const phone = orderQueueEntry[3];
  const email = orderQueueEntry[4];
  const shippingAddressMultiLine = orderQueueEntry[5];
  const customerNote = orderQueueEntry[6];

  const docFileName = `PackingSlip_${orderNumber}_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss")}`;
  const docFile = templateFile.makeCopy(docFileName, outputFolder);
  const doc = DocumentApp.openById(docFile.getId());
  const body = doc.getBody();

  body.replaceText('{{ORDER_NUMBER}}', orderNumber || '');
  body.replaceText('{{ORDER_DATE}}', Utilities.formatDate(new Date(orderDate), Session.getScriptTimeZone(), "yyyy-MM-dd") || '');
  body.replaceText('{{SHIPPING_NAME}}', customerName || '');
  body.replaceText('{{SHIPPING_ADDRESS}}', shippingAddressMultiLine || '');
  body.replaceText('{{SHIPPING_PHONE}}', phone || '');
  body.replaceText('{{SHIPPING_EMAIL}}', email || '');
  body.replaceText('{{COMPANY_CONTACT_INFO}}', 'JLM Wines | info@jlmwines.com | +972-5X-XXXXXXX');
  body.replaceText('{{PRINT_DATE}}', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"));

  const tablePlaceholder = '{{PRODUCT_TABLE}}';
  const foundTextRange = body.findText(tablePlaceholder);
  const elementFound = foundTextRange?.getElement();
  const placeholderParagraph = elementFound?.getParent();

  if (placeholderParagraph && placeholderParagraph.getType() === DocumentApp.ElementType.PARAGRAPH) {
    const parent = placeholderParagraph.getParent();
    const insertIndex = parent.getChildIndex(placeholderParagraph);

    if (typeof insertIndex === 'number') {
      const table = parent.insertTable(insertIndex, []);
      placeholderParagraph.removeFromParent();

      const headerRow = table.appendTableRow();
            ['Product', '#', 'פריט'].forEach(header => {
                headerRow.appendTableCell(header).setBold(false);
            });

            orderRowsEntries.forEach(itemRow => {
                const row = table.appendTableRow();

                // English description block, built from relevant itemRow data
                const englishDetailsCombined = [
                    itemRow[4] || '', // Name EN
                    itemRow[5] || '', // Short EN
                    (itemRow[6] || itemRow[7] || itemRow[8]) ? `Intensity (1-5): ${itemRow[6] || 'N/A'}, Complexity (1-5): ${itemRow[7] || 'N/A'}, Acidity (1-5): ${itemRow[8] || 'N/A'}` : '',
                    itemRow[9] ? `Recommended decanting ${itemRow[9]} minutes.` : '', // Decant
                    itemRow[10] ? `Harmonize with ${String(itemRow[10]).trim().toLowerCase().includes('flavors') ? String(itemRow[10]).trim() : `${String(itemRow[10]).trim()} flavors`}.` : '', // Harmonize EN
                    itemRow[11] ? `Contrast with ${String(itemRow[11]).trim().toLowerCase().includes('flavors') ? String(itemRow[11]).trim() : `${String(itemRow[11]).trim()} flavors`}.` : ''  // Contrast EN
                ].filter(line => line.trim()).join('\n');

                // Hebrew description block, built from relevant itemRow data
                const hebrewDetailsCombined = [
                    itemRow[12] || '', // Name HE
                    itemRow[13] || '', // Short HE
                    (itemRow[6] || itemRow[7] || itemRow[8]) ? `עוצמה (1-5): ${itemRow[6] || 'N/A'}, מורכבות (1-5): ${itemRow[7] || 'N/A'}, חומציות (1-5): ${itemRow[8] || 'N/A'}` : '', // Reusing EN attributes for HE
                    itemRow[9] ? `מומלץ ליהנות לאחר דיקנטציה של ${itemRow[9]} דקות.` : '', // Decant HE (translated)
                    itemRow[14] ? `הרמוניה עם ${String(itemRow[14]).trim().toLowerCase().includes('טעמים') ? String(itemRow[14]).trim() : `${String(itemRow[14]).trim()} טעמים`}.` : '', // Harmonize HE
                    itemRow[15] ? `קונטרסט עם ${String(itemRow[15]).trim().toLowerCase().includes('טעמים') ? String(itemRow[15]).trim() : `${String(itemRow[15]).trim()} טעמים`}.` : ''  // Contrast HE
                ].filter(line => line.trim()).join('\n');

                const quantity = itemRow[3]?.toString() || '1'; // Quantity

                row.appendTableCell(englishDetailsCombined);
                row.appendTableCell(quantity);
                row.appendTableCell(hebrewDetailsCombined);
            });

    } else {
      SpreadsheetApp.getUi().alert(`Error: Unable to determine insert index for packing table.`);
      return;
    }
  } else {
    SpreadsheetApp.getUi().alert(`Error: Placeholder '${tablePlaceholder}' must be in its own paragraph.`);
    Logger.log(`Error: Invalid placeholder element type for '${tablePlaceholder}': ${placeholderParagraph?.getType()}`);
    return;
  }

  const optionalSecondPagePlaceholder = '{{OPTIONAL_SECOND_PAGE}}';
  const hasCustomerNote = customerNote && String(customerNote).trim() !== '';

  if (hasCustomerNote) {
    const secondPageContent = `\n\f\n\n----------------------------------------------------------------------------------------------------\n\nOrder # ${orderNumber} (Continued)\n\nCUSTOMER NOTE:\n${customerNote}\n\n----------------------------------------------------------------------------------------------------\n\nPage 2 of X\n\nJLM Wines | info@jlmwines.com | +972-5X-XXXXXXX | Printed: ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")}`;
    body.replaceText(optionalSecondPagePlaceholder, secondPageContent);
  } else {
    body.replaceText(optionalSecondPagePlaceholder, '');
  }

  doc.saveAndClose();
  return docFile.getId();
}
