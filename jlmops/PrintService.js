/**
 * @file PrintService.js
 * @description Service for generating printable documents from Google Sheet templates.
 */
const PrintService = (function() {

  /**
   * Replicates the logic of the legacy getProductDetails function using jlmops data.
   * @param {Object} item - A row object from SysPackingCache.
   * @param {Object} cacheHeaderMap - A map of header names to column indices.
   * @returns {Object} An object containing formatted englishDetails and hebrewDetails strings.
   */
  function _getJLMopsProductDetails(item, cacheHeaderMap) {
    const isValidLine = (line) => line && line.trim().replace(/\u200E|\u200F/g, '').length > 0;

    // Order: Name, Harmonize (if exists), Contrast (if exists), Decant, combined I/C/A
    // Pairing text comes pre-formatted from PackingSlipService (e.g. "Harmonize with: rich or intense flavors")
    const hebrewDetails = [
        item[cacheHeaderMap['spc_NameHe']] || '',
        item[cacheHeaderMap['spc_HarmonizeHe']] || '',
        item[cacheHeaderMap['spc_ContrastHe']] || '',
        item[cacheHeaderMap['spc_Decant']] ? `מומלץ לאוורור - ${item[cacheHeaderMap['spc_Decant']]} דקות` : '',
        [
            item[cacheHeaderMap['spc_Intensity']] ? `עוצמה (1-5): ${item[cacheHeaderMap['spc_Intensity']]}` : null,
            item[cacheHeaderMap['spc_Complexity']] ? `מורכבות (1-5): ${item[cacheHeaderMap['spc_Complexity']]}` : null,
            item[cacheHeaderMap['spc_Acidity']] ? `חומציות (1-5): ${item[cacheHeaderMap['spc_Acidity']]}` : null
        ].filter(p => p).join(', ')
    ].filter(isValidLine).join('\n');

    const englishDetails = [
        item[cacheHeaderMap['spc_NameEn']] || '',
        item[cacheHeaderMap['spc_HarmonizeEn']] || '',
        item[cacheHeaderMap['spc_ContrastEn']] || '',
        item[cacheHeaderMap['spc_Decant']] ? `Recommended decanting – ${item[cacheHeaderMap['spc_Decant']]} minutes.` : '',
        [
            item[cacheHeaderMap['spc_Intensity']] ? `Intensity (1-5): ${item[cacheHeaderMap['spc_Intensity']]}` : null,
            item[cacheHeaderMap['spc_Complexity']] ? `Complexity (1-5): ${item[cacheHeaderMap['spc_Complexity']]}` : null,
            item[cacheHeaderMap['spc_Acidity']] ? `Acidity (1-5): ${item[cacheHeaderMap['spc_Acidity']]}` : null
        ].filter(p => p).join(', ')
    ].filter(isValidLine).join('\n');

    return { englishDetails, hebrewDetails };
  }

  /**
   * Generates printable packing slips for the given order IDs using a Google Doc template.
   *
   * @param {Array<string>} orderIds - An array of Order IDs to print.
   * @returns {string} The URL of the folder containing the generated Google Docs.
   */
  function printPackingSlips(orderIds) {
    const serviceName = 'PrintService';
    const functionName = 'printPackingSlips';
    try {
      logger.info(serviceName, functionName, `Starting for ${orderIds.length} orders.`);

      if (!orderIds || orderIds.length === 0) {
        throw new Error('No order IDs provided to print.');
      }

      // --- 1. Get Config and Data ---
      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const spreadsheet = SheetAccessor.getDataSpreadsheet();

      const orderIdSet = new Set(orderIds.map(String));

      const printConfig = {
        templateId: allConfig['printing.packingslip.default_template_id'].id,
        outputFolderId: allConfig['printing.output.folder_id'].id
      };

      if (!printConfig.templateId || !printConfig.outputFolderId) {
        throw new Error('Printing template or output folder IDs are not configured in SysConfig.');
      }

      const outputFolder = DriveApp.getFolderById(printConfig.outputFolderId);
      const templateFile = DriveApp.getFileById(printConfig.templateId); // This should now be a Google Doc template

      // --- 2. Get Data for Printing ---
      const cacheSheet = spreadsheet.getSheetByName(sheetNames.SysPackingCache);
      if (!cacheSheet) throw new Error('Sheet SysPackingCache not found.');
      const cacheData = cacheSheet.getDataRange().getValues();
      const cacheHeaders = cacheData.shift();
      const cacheHeaderMap = Object.fromEntries(cacheHeaders.map((h, i) => [h, i]));
      const dataForPrinting = cacheData.filter(row => orderIdSet.has(String(row[cacheHeaderMap['spc_OrderId']])));

      if (dataForPrinting.length === 0) {
        throw new Error('No data found in SysPackingCache for the selected order IDs.');
      }

      const orderMasterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
      if (!orderMasterSheet) throw new Error('Sheet WebOrdM not found.');
      const orderMasterData = orderMasterSheet.getDataRange().getValues();
      const orderMasterHeaders = orderMasterData.shift();
      const womHeaderMap = Object.fromEntries(orderMasterHeaders.map((h, i) => [h, i]));
      const orderMasterMap = new Map(orderMasterData.map(row => [String(row[womHeaderMap['wom_OrderId']]), row]));

      // Load WebProdM to identify bundle products (type 'woosb') - bundles don't count toward packing total
      const webProdMSheet = spreadsheet.getSheetByName(sheetNames.WebProdM);
      const bundleProductIds = new Set();
      if (webProdMSheet) {
        const webProdMData = webProdMSheet.getDataRange().getValues();
        const webProdMHeaders = webProdMData.shift();
        const wpmIdCol = webProdMHeaders.indexOf('wpm_ID');
        const wpmTypeCol = webProdMHeaders.indexOf('wpm_TaxProductType');
        if (wpmIdCol !== -1 && wpmTypeCol !== -1) {
          webProdMData.forEach(row => {
            const productType = String(row[wpmTypeCol] || '').toLowerCase().trim();
            if (productType === 'woosb') {
              bundleProductIds.add(String(row[wpmIdCol]));
            }
          });
        }
        logger.info(serviceName, functionName, `Identified ${bundleProductIds.size} bundle products to exclude from packing totals.`);
      }

      const ordersData = dataForPrinting.reduce((acc, row) => {
        const orderId = String(row[cacheHeaderMap['spc_OrderId']]);
        if (!acc[orderId]) {
          acc[orderId] = {
            items: [],
            orderInfo: orderMasterMap.get(orderId)
          };
        }
        acc[orderId].items.push(row);
        return acc;
      }, {});

      const MAX_PRODUCTS_PER_PAGE = 6;
      const ordersPageSplits = new Map();
      for (const orderId in ordersData) {
        const allProductsForOrder = ordersData[orderId].items;
        const orderPages = [];
        for (let i = 0; i < allProductsForOrder.length; i += MAX_PRODUCTS_PER_PAGE) {
            orderPages.push(allProductsForOrder.slice(i, i + MAX_PRODUCTS_PER_PAGE));
        }
        if (orderPages.length === 0) orderPages.push([]);
        ordersPageSplits.set(orderId, orderPages);
      }

      const sortedOrderIds = Object.keys(ordersData).sort((a, b) => a - b);

      // --- 3. Generate a Google Doc for each order ---
      const namePattern = allConfig['system.files.output_names']?.packing_slips || 'Packing-{timestamp}';
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd-HH-mm');
      const fileName = namePattern.replace('{timestamp}', timestamp);

      const finalPackingSlipDocFile = templateFile.makeCopy(fileName, outputFolder);
      const packingSlipDoc = DocumentApp.openById(finalPackingSlipDocFile.getId());
      const packingSlipBody = packingSlipDoc.getBody();
      
      packingSlipBody.clear(); 

      let firstOrder = true;
      for (const orderId of sortedOrderIds) {
        const orderData = ordersData[orderId];
        const orderInfo = orderData.orderInfo;
        const splitsForThisOrder = ordersPageSplits.get(orderId);

        splitsForThisOrder.forEach((productsForThisPage, pageNumIndex) => {
            if (!firstOrder) {
              packingSlipBody.appendPageBreak();
            }
            firstOrder = false;

            const shippingFirstName = orderInfo[womHeaderMap['wom_ShippingFirstName']] || '';
            const shippingLastName = orderInfo[womHeaderMap['wom_ShippingLastName']] || '';
            const shippingAddress1 = orderInfo[womHeaderMap['wom_ShippingAddress1']] || '';
            const shippingAddress2 = orderInfo[womHeaderMap['wom_ShippingAddress2']] || '';
            const shippingCity = orderInfo[womHeaderMap['wom_ShippingCity']] || '';
            const shippingPhone = orderInfo[womHeaderMap['wom_ShippingPhone']] || '';
            const orderNumber = orderInfo[womHeaderMap['wom_OrderNumber']] || '';
            const orderDate = new Date(orderInfo[womHeaderMap['wom_OrderDate']]);
            const formattedOrderDate = !isNaN(orderDate) ? Utilities.formatDate(orderDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : 'Invalid Date';

            // Compact header: 2 rows, RTL layout
            // Value BEFORE Hebrew label, colon at end of label
            const fullAddress = `${shippingAddress1}` + (shippingAddress2 ? `, ${shippingAddress2}` : '') + `, ${shippingCity}`;
            const fullName = `${shippingFirstName} ${shippingLastName}`;

            // Row 1: Date (left) | Order# (center) | Name (right)
            // Row 2: Address (2/3) | Phone (1/3)
            const headerTable = packingSlipBody.appendTable([
                [`${formattedOrderDate} :תאריך`, `${orderNumber} :הזמנה`, `${fullName} :לכבוד`],
                [`${fullAddress} :כתובת`, '', `${shippingPhone} :טלפון`]
            ]);
            headerTable.setBorderWidth(0);
            // Col 0: 320 (address), Col 1: 100 (order# wider), Col 2: 130 (phone/name)
            headerTable.setColumnWidth(0, 320).setColumnWidth(1, 100).setColumnWidth(2, 130);
            // Right-align all cells for RTL, minimize spacing
            for (let r = 0; r < headerTable.getNumRows(); r++) {
                const row = headerTable.getRow(r);
                for (let c = 0; c < row.getNumCells(); c++) {
                    const para = row.getCell(c).getChild(0).asParagraph();
                    para.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
                    para.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
                }
            }

            const table = packingSlipBody.appendTable([["Item", "Qty.כמ", "פריט"]]);
            const tableWidth = 550;
            const indent = (packingSlipBody.getPageWidth() - tableWidth) / 2;
            const attrs = {};
            attrs[DocumentApp.Attribute.INDENT_START] = indent;
            table.setAttributes(attrs);
            table.setBorderWidth(0).setColumnWidth(0, 250).setColumnWidth(1, 50).setColumnWidth(2, 250);
            const headerRow = table.getRow(0).setBold(true);
            // Reduce spacing on header row
            for (let c = 0; c < 3; c++) {
              const para = headerRow.getCell(c).getChild(0).asParagraph();
              para.setSpacingBefore(0).setSpacingAfter(2);
              para.setAlignment(c === 0 ? DocumentApp.HorizontalAlignment.LEFT : c === 1 ? DocumentApp.HorizontalAlignment.CENTER : DocumentApp.HorizontalAlignment.RIGHT);
            }

            productsForThisPage.forEach(item => {
              const { englishDetails, hebrewDetails } = _getJLMopsProductDetails(item, cacheHeaderMap);
              const webIdEn = String(item[cacheHeaderMap['spc_WebIdEn']] || '');
              const isBundle = bundleProductIds.has(webIdEn);
              const quantity = isBundle ? '' : String(item[cacheHeaderMap['spc_Quantity']] || '0');

              const newRow = table.appendTableRow();
              const cellEN = newRow.appendTableCell();
              const cellQTY = newRow.appendTableCell();
              const cellHE = newRow.appendTableCell();

              // Helper to add paragraph with minimal spacing
              const addLine = (cell, text, align, bold) => {
                const p = cell.appendParagraph(text).setAlignment(align).setBold(bold);
                p.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
                return p;
              };

              cellEN.clear();
              const enLines = englishDetails.trim().split('\n');
              if (enLines.length > 0) {
                  addLine(cellEN, enLines[0], DocumentApp.HorizontalAlignment.LEFT, true);
                  enLines.slice(1).forEach(line => addLine(cellEN, line, DocumentApp.HorizontalAlignment.LEFT, false));
              }

              cellQTY.clear();
              addLine(cellQTY, quantity, DocumentApp.HorizontalAlignment.CENTER, false);

              cellHE.clear();
              const heLines = hebrewDetails.trim().split('\n');
              if (heLines.length > 0) {
                  addLine(cellHE, heLines[0], DocumentApp.HorizontalAlignment.RIGHT, true);
                  heLines.slice(1).forEach(line => addLine(cellHE, line, DocumentApp.HorizontalAlignment.RIGHT, false));
              }
            });

            if (pageNumIndex + 1 === splitsForThisOrder.length) {
              // Calculate total excluding bundle products (woosb) - only count packable items
              const totalQuantity = orderData.items.reduce((sum, item) => {
                const webIdEn = String(item[cacheHeaderMap['spc_WebIdEn']] || '');
                // Skip bundle products - they don't get packed, only their components do
                if (bundleProductIds.has(webIdEn)) {
                  return sum;
                }
                return sum + (Number(item[cacheHeaderMap['spc_Quantity']]) || 0);
              }, 0);
              const totalsRow = table.appendTableRow();
              totalsRow.appendTableCell().appendParagraph(`Total`).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setBold(true);
              totalsRow.appendTableCell().appendParagraph(String(totalQuantity)).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);
              totalsRow.appendTableCell().appendParagraph("סה\"כ").setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setBold(true);
            }
        });
      }

      packingSlipDoc.saveAndClose();
      
      // --- 4. Update SysOrdLog ---
      const now = new Date();
      const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
      if (logSheet) {
        const logRange = logSheet.getDataRange();
        const logData = logRange.getValues();
        const logHeaders = logData.shift();
        const logHeaderMap = Object.fromEntries(logHeaders.map((h, i) => [h, i]));
        let updatedCount = 0;
        const logValuesToUpdate = logData.map(row => {
          if (orderIdSet.has(String(row[logHeaderMap['sol_OrderId']]))) {
            row[logHeaderMap['sol_PackingStatus']] = 'Printed';
            row[logHeaderMap['sol_PackingPrintedTimestamp']] = now;
            updatedCount++;
          }
          return row;
        });
        if (updatedCount > 0) {
          logSheet.getRange(2, 1, logValuesToUpdate.length, logHeaders.length).setValues(logValuesToUpdate);
          logger.info(serviceName, functionName, `Updated ${updatedCount} orders to 'Printed' status in SysOrdLog.`);

          // Check if any orders still ready - if not, close the packing task
          const remainingReady = logValuesToUpdate.filter(row => row[logHeaderMap['sol_PackingStatus']] === 'Ready').length;
          if (remainingReady === 0) {
            try {
              TaskService.completeTaskByTypeAndEntity('task.order.packing_available', 'PACKING');
              logger.info(serviceName, functionName, 'Closed packing available task - no orders remaining.');
            } catch (taskError) {
              // No task to close - that's fine
            }
          }
        }
      } else {
        logger.warn(serviceName, functionName, 'SysOrdLog sheet not found. Could not update packing statuses to Printed.');
      }

      logger.info(serviceName, functionName, `Completed successfully. Document URL: ${packingSlipDoc.getUrl()}`);
      return packingSlipDoc.getUrl();

    } catch (error) {
      logger.error(serviceName, functionName, error.message, error);
      throw error;
    }
  }

  return {
    printPackingSlips: printPackingSlips
  };

})();
