/**
 * @file PrintService.js
 * @description Service for generating printable documents, such as packing slips.
 */

/**
 * @file PrintService.js
 * @description Service for generating printable documents, such as packing slips.
 */

const PrintService = (function() {

  /**
   * Generates a printable document for the given order IDs.
   *
   * @param {Array<string>} orderIds - An array of Order IDs to print.
   * @returns {string} The URL of the generated Google Doc.
   */
  function printPackingSlips(orderIds) {
    const functionName = 'printPackingSlips';
    try {
      logger.info(`Starting ${functionName} for ${orderIds.length} orders.`);

      if (!orderIds || orderIds.length === 0) {
        throw new Error('No order IDs provided to print.');
      }

      const allConfig = ConfigService.getAllConfig();
      const sheetNames = allConfig['system.sheet_names'];
      const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
      const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

      // 1. Read data from SysPackingCache for the selected orders
      const cacheSheet = spreadsheet.getSheetByName(sheetNames.SysPackingCache);
      if (!cacheSheet) throw new Error('Sheet SysPackingCache not found.');

      const cacheData = cacheSheet.getDataRange().getValues();
      const cacheHeaders = cacheData.shift();
      const cacheHeaderMap = Object.fromEntries(cacheHeaders.map((h, i) => [h, i]));
      const orderIdSet = new Set(orderIds.map(String));

      const dataForPrinting = cacheData.filter(row => orderIdSet.has(String(row[cacheHeaderMap['spc_OrderId']])));

      if (dataForPrinting.length === 0) {
        throw new Error('No data found in SysPackingCache for the selected order IDs.');
      }
      
      // Group data by order ID
      const ordersData = dataForPrinting.reduce((acc, row) => {
        const orderId = row[cacheHeaderMap['spc_OrderId']];
        if (!acc[orderId]) {
          acc[orderId] = [];
        }
        acc[orderId].push(row);
        return acc;
      }, {});


      // 2. Read and parse the packing slip template from SysConfig
      const templateRows = allConfig['template.packing_slip'];
      if (!templateRows) throw new Error('Packing slip template not found in SysConfig.');

      const headerContent = templateRows.find(r => r[3] === 'HEADER')?.[4] || 'Packing Slip';
      const footerContent = templateRows.find(r => r[3] === 'FOOTER')?.[4] || 'Thank you for your order!';
      const tableHeaders = templateRows.filter(r => r[3] === 'TABLE_COLUMN_HEADER').map(r => ({ label: r[4], field: r[5] }));

      // 3. Generate a rich HTML string for the packing slips
      let fullHtml = '<html><head><style>body { font-family: Arial, sans-serif; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #dddddd; text-align: left; padding: 8px; } th { background-color: #f2f2f2; }</style></head><body>';

      for (const orderId in ordersData) {
        const items = ordersData[orderId];
        fullHtml += `<h1>${headerContent}</h1>`;
        fullHtml += `<h2>Order #${orderId}</h2>`;
        
        fullHtml += '<table>';
        fullHtml += '<tr>';
        tableHeaders.forEach(header => {
            fullHtml += `<th>${header.label}</th>`;
        });
        fullHtml += '</tr>';

        items.forEach(itemRow => {
            fullHtml += '<tr>';
            tableHeaders.forEach(header => {
                 const cellValue = itemRow[cacheHeaderMap[header.field]] || '';
                 fullHtml += `<td>${cellValue}</td>`;
            });
            fullHtml += '</tr>';
        });

        fullHtml += '</table>';
        fullHtml += `<p>${footerContent}</p>`;
        fullHtml += '<hr>';
      }
      fullHtml += '</body></html>';


      // 4. Create a new Google Doc and insert the HTML
      const docName = `PackingSlips_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss')}`;
      
      const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
      const exportFolder = DriveApp.getFolderById(exportFolderId);

      const htmlFile = exportFolder.createFile(`${docName}.html`, fullHtml, MimeType.HTML);
      
      const blob = htmlFile.getBlob();
      const resource = {
        title: docName,
        mimeType: MimeType.GOOGLE_DOCS,
        parents: [{ id: exportFolderId }]
      };
      const newDocFile = Drive.Files.insert(resource, blob);
      const docUrl = newDocFile.alternateLink;
      
      htmlFile.setTrashed(true);

      // 5. Update SysOrdLog to 'Printed' status
      const now = new Date();
      const logSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
      if (!logSheet) {
          logger.warn('SysOrdLog sheet not found. Could not update packing statuses to Printed.');
      } else {
          const logRange = logSheet.getDataRange();
          const logData = logRange.getValues();
          const logHeaders = logData.shift();
          const logHeaderMap = Object.fromEntries(logHeaders.map((h, i) => [h, i]));
          const logOrderIdCol = logHeaderMap['sol_OrderId'];
          const logStatusCol = logHeaderMap['sol_PackingStatus'];
          const logTimestampCol = logHeaderMap['sol_PackingPrintedTimestamp'];

          let updatedCount = 0;
          logData.forEach(row => {
              if (orderIdSet.has(String(row[logOrderIdCol]))) {
                  row[logStatusCol] = 'Printed';
                  row[logTimestampCol] = now;
                  updatedCount++;
              }
          });

          if (updatedCount > 0) {
              logSheet.getRange(2, 1, logData.length, logHeaders.length).setValues(logData);
              logger.info(`Updated ${updatedCount} orders to 'Printed' status in SysOrdLog.`);
          }
      }


      logger.info(`${functionName} completed successfully. Document URL: ${docUrl}`);
      return docUrl;

    } catch (error) {
      logger.error(`An error occurred in ${functionName}: ${error.message}`, error.stack);
      LoggerService.logError(functionName, error.message, error.stack);
      throw error;
    }
  }

  return {
    printPackingSlips: printPackingSlips
  };

})();
