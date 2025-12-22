/**
 * @file ContactImportService.js
 * @description Service for importing contacts from order history and external sources.
 * Handles initial population and incremental updates of SysContacts.
 */

// Import folder for CSV/Sheet data files
const IMPORT_FOLDER_ID = '1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j';

/**
 * Finds a file by name in the import folder and returns its data as rows.
 * Works with both Google Sheets and CSV files.
 * @param {string} fileName - File name to search for (partial match)
 * @returns {Array} 2D array of rows, or null if not found
 */
function getImportFileData(fileName) {
  const folder = DriveApp.getFolderById(IMPORT_FOLDER_ID);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();

    if (name.toLowerCase().includes(fileName.toLowerCase())) {
      const mimeType = file.getMimeType();

      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Google Sheet
        const sheet = SpreadsheetApp.openById(file.getId()).getActiveSheet();
        return sheet.getDataRange().getValues();
      } else if (mimeType === 'text/csv' || name.endsWith('.csv')) {
        // CSV file
        const content = file.getBlob().getDataAsString();
        return Utilities.parseCsv(content);
      }
    }
  }

  return null;
}

const ContactImportService = (function () {
  const SERVICE_NAME = 'ContactImportService';

  /**
   * Imports contacts from order history (WebOrdM + WebOrdItemsM).
   * Creates or updates contacts based on billing email.
   * @param {Object} options - Import options
   * @param {boolean} options.fullRebuild - If true, clears existing data first
   * @returns {Object} Import results
   */
  function importFromOrderHistory(options = {}) {
    const fnName = 'importFromOrderHistory';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting order history import');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    // Get order data from current and archive sheets
    const orderMasterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    const orderItemsSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
    const orderArchiveSheet = spreadsheet.getSheetByName('WebOrdM_Archive');
    const itemsArchiveSheet = spreadsheet.getSheetByName('WebOrdItemsM_Archive');
    const orderLogSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);

    if (!orderMasterSheet || !orderItemsSheet) {
      throw new Error('Required sheets not found (WebOrdM, WebOrdItemsM)');
    }

    // Load order master data from current sheet
    const orderData = orderMasterSheet.getDataRange().getValues();
    const orderHeaders = orderData.shift();
    const womIdx = {};
    orderHeaders.forEach((h, i) => womIdx[h] = i);

    // Also load from archive if exists
    if (orderArchiveSheet && orderArchiveSheet.getLastRow() > 1) {
      const archiveData = orderArchiveSheet.getDataRange().getValues();
      const archiveHeaders = archiveData.shift();
      const womaIdx = {};
      archiveHeaders.forEach((h, i) => womaIdx[h] = i);

      // Map archive columns to current column names
      archiveData.forEach(row => {
        const mappedRow = [];
        mappedRow[womIdx['wom_OrderId']] = row[womaIdx['woma_OrderId']];
        mappedRow[womIdx['wom_OrderDate']] = row[womaIdx['woma_OrderDate']];
        mappedRow[womIdx['wom_Status']] = row[womaIdx['woma_Status']];
        mappedRow[womIdx['wom_BillingEmail']] = row[womaIdx['woma_BillingEmail']];
        mappedRow[womIdx['wom_BillingFirstName']] = row[womaIdx['woma_BillingFirstName']];
        mappedRow[womIdx['wom_BillingLastName']] = row[womaIdx['woma_BillingLastName']];
        mappedRow[womIdx['wom_BillingPhone']] = row[womaIdx['woma_BillingPhone']];
        mappedRow[womIdx['wom_ShippingFirstName']] = row[womaIdx['woma_ShippingFirstName']];
        mappedRow[womIdx['wom_ShippingLastName']] = row[womaIdx['woma_ShippingLastName']];
        mappedRow[womIdx['wom_ShippingCity']] = row[womaIdx['woma_ShippingCity']];
        mappedRow[womIdx['wom_ShippingPhone']] = row[womaIdx['woma_ShippingPhone']];
        mappedRow[womIdx['wom_CustomerNote']] = row[womaIdx['woma_CustomerNote']];
        mappedRow[womIdx['wom_CouponItems']] = row[womaIdx['woma_CouponItems']];
        orderData.push(mappedRow);
      });
      LoggerService.info(SERVICE_NAME, fnName, `Added ${archiveData.length} orders from archive`);
    }

    // Load order items for product analysis
    const itemsData = orderItemsSheet.getDataRange().getValues();
    const itemHeaders = itemsData.shift();
    const woiIdx = {};
    itemHeaders.forEach((h, i) => woiIdx[h] = i);

    // Also load items from archive if exists
    if (itemsArchiveSheet && itemsArchiveSheet.getLastRow() > 1) {
      const archiveItemsData = itemsArchiveSheet.getDataRange().getValues();
      const archiveItemHeaders = archiveItemsData.shift();
      const woiaIdx = {};
      archiveItemHeaders.forEach((h, i) => woiaIdx[h] = i);

      // Map archive columns to current column names
      archiveItemsData.forEach(row => {
        const mappedRow = [];
        mappedRow[woiIdx['woi_OrderId']] = row[woiaIdx['woia_OrderId']];
        mappedRow[woiIdx['woi_SKU']] = row[woiaIdx['woia_SKU']];
        mappedRow[woiIdx['woi_Name']] = row[woiaIdx['woia_Name']];
        mappedRow[woiIdx['woi_Quantity']] = row[woiaIdx['woia_Quantity']];
        mappedRow[woiIdx['woi_ItemTotal']] = row[woiaIdx['woia_ItemTotal']];
        itemsData.push(mappedRow);
      });
      LoggerService.info(SERVICE_NAME, fnName, `Added ${archiveItemsData.length} items from archive`);
    }

    // Load order log for status info
    LoggerService.info(SERVICE_NAME, fnName, 'Loading order status log...');
    let orderStatusMap = new Map();
    if (orderLogSheet) {
      const logData = orderLogSheet.getDataRange().getValues();
      const logHeaders = logData.shift();
      const solIdx = {};
      logHeaders.forEach((h, i) => solIdx[h] = i);
      logData.forEach(row => {
        orderStatusMap.set(String(row[solIdx['sol_OrderId']]), row[solIdx['sol_OrderStatus']]);
      });
      LoggerService.info(SERVICE_NAME, fnName, `Loaded ${orderStatusMap.size} order statuses`);
    }

    // Build items by order map
    LoggerService.info(SERVICE_NAME, fnName, `Building item index from ${itemsData.length} items...`);
    const itemsByOrder = new Map();
    itemsData.forEach(row => {
      const orderId = String(row[woiIdx['woi_OrderId']]);
      if (!itemsByOrder.has(orderId)) {
        itemsByOrder.set(orderId, []);
      }
      itemsByOrder.get(orderId).push({
        sku: row[woiIdx['woi_SKU']],
        name: row[woiIdx['woi_Name']],
        quantity: parseInt(row[woiIdx['woi_Quantity']], 10) || 1,
        total: parseFloat(row[woiIdx['woi_ItemTotal']]) || 0
      });
    });
    LoggerService.info(SERVICE_NAME, fnName, `Built index for ${itemsByOrder.size} orders`);

    // Aggregate by email
    LoggerService.info(SERVICE_NAME, fnName, `Aggregating ${orderData.length} orders by email...`);
    const contactMap = new Map();
    const today = new Date();

    orderData.forEach(row => {
      const orderId = String(row[womIdx['wom_OrderId']]);
      const orderDate = row[womIdx['wom_OrderDate']];
      const email = (row[womIdx['wom_BillingEmail']] || '').toLowerCase().trim();
      const status = orderStatusMap.get(orderId) || row[womIdx['wom_Status']] || '';

      if (!email || !orderDate) return;

      // Skip cancelled/refunded orders
      if (['cancelled', 'refunded', 'failed'].includes(status.toLowerCase())) return;

      const orderDateObj = new Date(orderDate);
      const billingFirstName = row[womIdx['wom_BillingFirstName']] || '';
      const billingLastName = row[womIdx['wom_BillingLastName']] || '';
      const shippingFirstName = row[womIdx['wom_ShippingFirstName']] || '';
      const shippingLastName = row[womIdx['wom_ShippingLastName']] || '';
      const billingPhone = row[womIdx['wom_BillingPhone']] || '';
      const shippingPhone = row[womIdx['wom_ShippingPhone']] || '';
      const shippingCity = row[womIdx['wom_ShippingCity']] || '';
      const customerNote = row[womIdx['wom_CustomerNote']] || '';
      const couponItems = row[womIdx['wom_CouponItems']] || '';

      // Get order items
      const items = itemsByOrder.get(orderId) || [];
      const orderTotal = items.reduce((sum, item) => sum + item.total, 0);
      const bottleCount = items.reduce((sum, item) => sum + item.quantity, 0);

      // Check if gift order using ContactService logic (considers delivery keywords in note)
      const isGift = ContactService._isGiftOrder({
        customerNote: customerNote,
        billingLastName: billingLastName,
        shippingLastName: shippingLastName
      });

      // Initialize or update contact
      if (!contactMap.has(email)) {
        contactMap.set(email, {
          sc_Email: email,
          sc_Name: `${billingFirstName} ${billingLastName}`.trim(),
          sc_Phone: billingPhone || shippingPhone,
          sc_City: shippingCity,
          sc_Language: 'en', // Default, can be enriched from Mailchimp
          sc_Country: 'IL', // Default
          sc_IsCustomer: true,
          sc_IsCore: true,
          sc_IsSubscribed: false,
          sc_FirstOrderDate: orderDateObj,
          sc_LastOrderDate: orderDateObj,
          sc_OrderCount: 0,
          sc_TotalSpend: 0,
          sc_AvgOrderValue: 0,
          sc_AvgBottlesPerOrder: 0,
          _orders: [],
          _items: [],
          _giftOrders: 0,
          _warSupportOrders: 0
        });
      }

      const contact = contactMap.get(email);

      // Update dates
      if (orderDateObj < contact.sc_FirstOrderDate) {
        contact.sc_FirstOrderDate = orderDateObj;
      }
      if (orderDateObj > contact.sc_LastOrderDate) {
        contact.sc_LastOrderDate = orderDateObj;
        // Update phone from most recent order
        if (billingPhone) contact.sc_Phone = billingPhone;
        if (shippingCity) contact.sc_City = shippingCity;
      }

      // Track orders
      contact._orders.push({
        orderId: orderId,
        date: orderDateObj,
        total: orderTotal,
        bottles: bottleCount,
        isGift: isGift
      });

      // Track items for preference analysis
      contact._items = contact._items.concat(items);

      if (isGift) contact._giftOrders++;

      // Check for war-support coupon in coupon items (not customer note)
      const coupons = ContactService._extractCoupons(couponItems);
      if (ContactService._hasWarSupportCoupon(coupons)) {
        contact._warSupportOrders++;
      }
    });

    // Calculate final metrics
    LoggerService.info(SERVICE_NAME, fnName, `Aggregated ${contactMap.size} unique contacts. Calculating metrics...`);
    const contactsToSave = [];
    let calcErrors = [];

    contactMap.forEach((contact, email) => {
      try {
        // Calculate metrics
        contact.sc_OrderCount = contact._orders.length;
        contact.sc_TotalSpend = contact._orders.reduce((sum, o) => sum + o.total, 0);
        contact.sc_AvgOrderValue = contact.sc_OrderCount > 0
          ? Math.round(contact.sc_TotalSpend / contact.sc_OrderCount)
          : 0;

        const totalBottles = contact._orders.reduce((sum, o) => sum + o.bottles, 0);
        contact.sc_AvgBottlesPerOrder = contact.sc_OrderCount > 0
          ? Math.round(totalBottles / contact.sc_OrderCount * 10) / 10
          : 0;

        // Determine if core customer
        // Non-core if: all orders are gifts OR all orders used war-support coupons
        if (contact._giftOrders === contact.sc_OrderCount) {
          contact.sc_IsCore = false;
          contact.sc_CustomerType = 'noncore.gift';
        } else if (contact._warSupportOrders === contact.sc_OrderCount) {
          contact.sc_IsCore = false;
          contact.sc_CustomerType = 'noncore.support';
        }

        // Days since order
        contact.sc_DaysSinceOrder = Math.floor(
          (today - contact.sc_LastOrderDate) / (1000 * 60 * 60 * 24)
        );

        // Lifecycle status
        contact.sc_LifecycleStatus = ContactService._calculateLifecycleStatus(contact.sc_DaysSinceOrder);

        // Customer type (if not already set as noncore)
        if (!contact.sc_CustomerType) {
          contact.sc_CustomerType = ContactService._classifyCustomerType(contact);
        }

        // Bundle buyer detection
        contact.sc_BundleBuyer = contact._items.some(item =>
          (item.name || '').toLowerCase().includes('bundle') ||
          (item.name || '').toLowerCase().includes('package')
        );

        // Clean up temp fields
        delete contact._orders;
        delete contact._items;
        delete contact._giftOrders;
        delete contact._warSupportOrders;

        contactsToSave.push(contact);
      } catch (e) {
        calcErrors.push(`${email}: ${e.message}`);
      }
    });

    // Batch save all contacts
    LoggerService.info(SERVICE_NAME, fnName, `Saving ${contactsToSave.length} contacts in batch...`);
    const batchResult = ContactService.batchUpsertContacts(contactsToSave, (processed, total) => {
      LoggerService.info(SERVICE_NAME, fnName, `Processing: ${processed}/${total}`);
    });

    const allErrors = calcErrors.concat(batchResult.errors.map(e => `${e.email}: ${e.error}`));
    LoggerService.info(SERVICE_NAME, fnName, `Import complete: ${batchResult.inserted} new, ${batchResult.updated} updated, ${allErrors.length} errors`);
    return { imported: batchResult.inserted + batchResult.updated, errors: allErrors, total: contactMap.size };
  }

  /**
   * Imports subscribers from Mailchimp export CSV.
   * Updates existing contacts or creates prospect records.
   * @param {string} csvContent - CSV content from Mailchimp export
   * @returns {Object} Import results
   */
  function importFromMailchimpCsv(csvContent) {
    const fnName = 'importFromMailchimpCsv';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting Mailchimp import');

    const lines = Utilities.parseCsv(csvContent);
    if (lines.length <= 1) {
      return { imported: 0, updated: 0, errors: ['No data rows found'] };
    }

    const csvHeaders = lines[0];
    const headerMap = {};
    csvHeaders.forEach((h, i) => headerMap[h.trim()] = i);

    // Expected Mailchimp columns
    const emailCol = headerMap['Email Address'] ?? headerMap['email'];
    const fnameCol = headerMap['First Name'] ?? headerMap['FNAME'];
    const lnameCol = headerMap['Last Name'] ?? headerMap['LNAME'];
    const statusCol = headerMap['MEMBER_RATING'] ?? headerMap['Status'];
    const optsCol = headerMap['OPTIN_TIME'] ?? headerMap['Opt-in Date'];
    const langCol = headerMap['LANGUAGE'] ?? headerMap['Language'];

    if (emailCol === undefined) {
      return { imported: 0, updated: 0, errors: ['Email column not found'] };
    }

    // Load existing contacts once for lookup
    LoggerService.info(SERVICE_NAME, fnName, 'Loading existing contacts for lookup...');
    const existingContacts = ContactService.getContacts();
    const existingByEmail = new Map();
    existingContacts.forEach(c => {
      if (c.sc_Email) existingByEmail.set(c.sc_Email.toLowerCase(), c);
    });
    LoggerService.info(SERVICE_NAME, fnName, `Indexed ${existingByEmail.size} existing contacts`);

    const contactsToSave = [];
    const errors = [];
    const today = new Date();
    let newCount = 0;
    let updateCount = 0;

    LoggerService.info(SERVICE_NAME, fnName, `Processing ${lines.length - 1} Mailchimp rows...`);
    for (let i = 1; i < lines.length; i++) {
      try {
        const row = lines[i];
        const email = (row[emailCol] || '').toLowerCase().trim();
        if (!email) continue;

        const firstName = fnameCol !== undefined ? row[fnameCol] : '';
        const lastName = lnameCol !== undefined ? row[lnameCol] : '';
        const optinTime = optsCol !== undefined ? row[optsCol] : '';
        const language = langCol !== undefined ? row[langCol] : '';

        const existing = existingByEmail.get(email);

        if (existing) {
          // Update subscription info
          existing.sc_IsSubscribed = true;
          if (optinTime && !existing.sc_SubscribedDate) {
            existing.sc_SubscribedDate = new Date(optinTime);
            existing.sc_SubscriptionSource = 'mailchimp';
          }
          if (language) existing.sc_Language = language.toLowerCase();
          contactsToSave.push(existing);
          updateCount++;
        } else {
          // Create prospect record
          const subscribedDate = optinTime ? new Date(optinTime) : today;
          const daysSubscribed = Math.floor((today - subscribedDate) / (1000 * 60 * 60 * 24));

          const contact = {
            sc_Email: email,
            sc_Name: `${firstName} ${lastName}`.trim(),
            sc_Language: language ? language.toLowerCase() : 'en',
            sc_IsCustomer: false,
            sc_IsCore: false,
            sc_IsSubscribed: true,
            sc_SubscribedDate: subscribedDate,
            sc_DaysSubscribed: daysSubscribed,
            sc_SubscriptionSource: 'mailchimp',
            sc_LifecycleStatus: 'Prospect'
          };
          contact.sc_CustomerType = ContactService._classifyCustomerType(contact);
          contactsToSave.push(contact);
          newCount++;
        }
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    // Batch save
    LoggerService.info(SERVICE_NAME, fnName, `Saving ${contactsToSave.length} contacts (${newCount} new, ${updateCount} updates)...`);
    const batchResult = ContactService.batchUpsertContacts(contactsToSave);

    LoggerService.info(SERVICE_NAME, fnName, `Mailchimp import complete: ${batchResult.inserted} new, ${batchResult.updated} updated`);
    return { imported: batchResult.inserted, updated: batchResult.updated, errors };
  }

  /**
   * Runs full CRM data import from all sources.
   * Call this to initialize CRM data.
   */
  function runFullImport() {
    const fnName = 'runFullImport';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting full CRM import');

    const results = {
      orders: null,
      mailchimp: null,
      coupons: null,
      campaigns: null
    };

    // Import from order history
    LoggerService.info(SERVICE_NAME, fnName, 'Step 1/2: Importing from order history...');
    try {
      results.orders = importFromOrderHistory();
      LoggerService.info(SERVICE_NAME, fnName, `Order import done: ${results.orders.imported} contacts`);
    } catch (e) {
      LoggerService.error(SERVICE_NAME, fnName, `Order import failed: ${e.message}`);
      results.orders = { error: e.message };
    }

    // Import Mailchimp subscribers
    LoggerService.info(SERVICE_NAME, fnName, 'Step 2/2: Looking for Mailchimp file...');
    try {
      results.mailchimp = importMailchimpFromFolder();
      if (results.mailchimp.error) {
        LoggerService.info(SERVICE_NAME, fnName, `Mailchimp: ${results.mailchimp.error}`);
      } else {
        LoggerService.info(SERVICE_NAME, fnName, `Mailchimp done: ${results.mailchimp.imported} new, ${results.mailchimp.updated} updated`);
      }
    } catch (e) {
      LoggerService.error(SERVICE_NAME, fnName, `Mailchimp import failed: ${e.message}`);
      results.mailchimp = { error: e.message };
    }

    LoggerService.info(SERVICE_NAME, fnName, 'Full CRM import completed');
    return results;
  }

  // Public API
  return {
    importFromOrderHistory: importFromOrderHistory,
    importFromMailchimpCsv: importFromMailchimpCsv,
    runFullImport: runFullImport
  };
})();

/**
 * Global function to run CRM import from Apps Script editor.
 */
function runCrmImport() {
  return ContactImportService.runFullImport();
}

/**
 * Import Mailchimp subscribers from file in import folder.
 * Looks for file containing 'subscribed', 'subscriber', or 'audience_export' in name.
 * (Avoids matching 'mailchimp campaigns' file)
 */
function importMailchimpFromFolder() {
  const SERVICE_NAME = 'ContactImportService';
  const fnName = 'importMailchimpFromFolder';

  try {
    LoggerService.info(SERVICE_NAME, fnName, 'Looking for subscriber file...');
    const rows = getImportFileData('subscribed') || getImportFileData('subscriber') || getImportFileData('audience_export');
    if (!rows) {
      return { error: 'Mailchimp subscriber file not found in import folder' };
    }
    LoggerService.info(SERVICE_NAME, fnName, `Found file with ${rows.length} rows`);

    // Convert rows back to CSV for existing import function
    const csvContent = rows.map(row => row.map(cell => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',')).join('\n');

    LoggerService.info(SERVICE_NAME, fnName, `CSV content: ${csvContent.length} bytes`);
    return ContactImportService.importFromMailchimpCsv(csvContent);

  } catch (e) {
    LoggerService.error(SERVICE_NAME, fnName, `Error: ${e.message}`);
    return { error: e.message, stack: e.stack };
  }
}
