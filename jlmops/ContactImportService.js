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
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

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
        mappedRow[womIdx['wom_CustomerUser']] = row[womaIdx['woma_CustomerUser']];
        mappedRow[womIdx['wom_MetaWpmlLanguage']] = row[womaIdx['woma_MetaWpmlLanguage']];
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
      const customerUser = row[womIdx['wom_CustomerUser']] || '';
      const orderLanguage = (row[womIdx['wom_MetaWpmlLanguage']] || '').toLowerCase().trim() || 'en';

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
          sc_Language: orderLanguage,
          sc_Country: 'IL', // Default
          sc_WooUserId: customerUser || null,
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
        // Update from most recent order
        if (billingPhone) contact.sc_Phone = billingPhone;
        if (shippingCity) contact.sc_City = shippingCity;
        if (customerUser) contact.sc_WooUserId = customerUser;
        if (orderLanguage) contact.sc_Language = orderLanguage;
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
          // Only set language if contact doesn't already have one (order language takes precedence)
          if (language && !existing.sc_Language) existing.sc_Language = language.toLowerCase();
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

  /**
   * Updates contacts from current orders in WebOrdM.
   * Creates new contacts for first-time customers.
   * Updates existing contacts with latest phone, city, WooUserId.
   * Called from nightly housekeeping.
   * @returns {Object} Result with created/updated counts
   */
  function updateContactsFromOrders() {
    const fnName = 'updateContactsFromOrders';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting contact update from orders');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

    // Load existing contacts by email
    const existingContacts = ContactService.getContacts();
    const contactsByEmail = new Map();
    existingContacts.forEach(c => {
      if (c.sc_Email) contactsByEmail.set(c.sc_Email.toLowerCase(), c);
    });
    LoggerService.info(SERVICE_NAME, fnName, `Loaded ${contactsByEmail.size} existing contacts`);

    // Load WebOrdM (current orders only - archive is historical)
    const orderMasterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (!orderMasterSheet || orderMasterSheet.getLastRow() <= 1) {
      LoggerService.info(SERVICE_NAME, fnName, 'No orders in WebOrdM');
      return { created: 0, updated: 0, errors: [] };
    }

    const orderData = orderMasterSheet.getDataRange().getValues();
    const orderHeaders = orderData.shift();
    const womIdx = {};
    orderHeaders.forEach((h, i) => womIdx[h] = i);

    // Load order items for totals
    const orderItemsSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
    const itemsData = orderItemsSheet ? orderItemsSheet.getDataRange().getValues() : [];
    const itemHeaders = itemsData.length > 0 ? itemsData.shift() : [];
    const woiIdx = {};
    itemHeaders.forEach((h, i) => woiIdx[h] = i);

    // Build items by order for totals
    const itemsByOrder = new Map();
    itemsData.forEach(row => {
      const orderId = String(row[woiIdx['woi_OrderId']]);
      if (!itemsByOrder.has(orderId)) itemsByOrder.set(orderId, []);
      itemsByOrder.get(orderId).push({
        quantity: parseInt(row[woiIdx['woi_Quantity']], 10) || 1,
        total: parseFloat(row[woiIdx['woi_ItemTotal']]) || 0
      });
    });

    // Load order log for status
    const orderLogSheet = spreadsheet.getSheetByName(sheetNames.SysOrdLog);
    const orderStatusMap = new Map();
    if (orderLogSheet && orderLogSheet.getLastRow() > 1) {
      const logData = orderLogSheet.getDataRange().getValues();
      const logHeaders = logData.shift();
      const solIdx = {};
      logHeaders.forEach((h, i) => solIdx[h] = i);
      logData.forEach(row => {
        orderStatusMap.set(String(row[solIdx['sol_OrderId']]), row[solIdx['sol_OrderStatus']]);
      });
    }

    // Aggregate orders by email
    const contactUpdates = new Map();
    const today = new Date();

    orderData.forEach(row => {
      const orderId = String(row[womIdx['wom_OrderId']]);
      const orderDate = row[womIdx['wom_OrderDate']];
      const email = (row[womIdx['wom_BillingEmail']] || '').toLowerCase().trim();
      const status = orderStatusMap.get(orderId) || row[womIdx['wom_Status']] || '';

      if (!email || !orderDate) return;
      if (['cancelled', 'refunded', 'failed'].includes(status.toLowerCase())) return;

      const orderDateObj = new Date(orderDate);
      const billingFirstName = row[womIdx['wom_BillingFirstName']] || '';
      const billingLastName = row[womIdx['wom_BillingLastName']] || '';
      const billingPhone = row[womIdx['wom_BillingPhone']] || '';
      const shippingCity = row[womIdx['wom_ShippingCity']] || '';
      const customerUser = row[womIdx['wom_CustomerUser']] || '';
      const customerNote = row[womIdx['wom_CustomerNote']] || '';
      const shippingLastName = row[womIdx['wom_ShippingLastName']] || '';
      const couponItems = row[womIdx['wom_CouponItems']] || '';
      const orderLanguage = (row[womIdx['wom_MetaWpmlLanguage']] || '').toLowerCase().trim() || 'en';

      const items = itemsByOrder.get(orderId) || [];
      const orderTotal = items.reduce((sum, item) => sum + item.total, 0);
      const bottleCount = items.reduce((sum, item) => sum + item.quantity, 0);

      const isGift = ContactService._isGiftOrder({
        customerNote: customerNote,
        billingLastName: billingLastName,
        shippingLastName: shippingLastName
      });

      if (!contactUpdates.has(email)) {
        contactUpdates.set(email, {
          email: email,
          name: `${billingFirstName} ${billingLastName}`.trim(),
          phone: billingPhone,
          city: shippingCity,
          wooUserId: customerUser,
          language: orderLanguage,
          firstOrderDate: orderDateObj,
          lastOrderDate: orderDateObj,
          orders: [],
          giftOrders: 0,
          warSupportOrders: 0
        });
      }

      const update = contactUpdates.get(email);

      // Track first/last order dates
      if (orderDateObj < update.firstOrderDate) {
        update.firstOrderDate = orderDateObj;
      }
      if (orderDateObj > update.lastOrderDate) {
        update.lastOrderDate = orderDateObj;
        if (billingPhone) update.phone = billingPhone;
        if (shippingCity) update.city = shippingCity;
        if (customerUser) update.wooUserId = customerUser;
        if (orderLanguage) update.language = orderLanguage;
      }

      update.orders.push({ total: orderTotal, bottles: bottleCount, isGift: isGift });
      if (isGift) update.giftOrders++;

      const coupons = ContactService._extractCoupons(couponItems);
      if (ContactService._hasWarSupportCoupon(coupons)) {
        update.warSupportOrders++;
      }
    });

    LoggerService.info(SERVICE_NAME, fnName, `Found ${contactUpdates.size} unique emails in orders`);

    // Build contacts to save
    const contactsToSave = [];
    let created = 0;
    let updated = 0;

    contactUpdates.forEach((update, email) => {
      const existing = contactsByEmail.get(email);

      if (existing) {
        // Update existing contact
        let changed = false;

        // Update WooUserId if we have one and existing doesn't
        if (update.wooUserId && !existing.sc_WooUserId) {
          existing.sc_WooUserId = update.wooUserId;
          changed = true;
        }

        // Update phone/city from most recent order if newer
        const existingLastOrder = existing.sc_LastOrderDate ? new Date(existing.sc_LastOrderDate) : null;
        if (!existingLastOrder || update.lastOrderDate > existingLastOrder) {
          if (update.phone && update.phone !== existing.sc_Phone) {
            existing.sc_Phone = update.phone;
            changed = true;
          }
          if (update.city && update.city !== existing.sc_City) {
            existing.sc_City = update.city;
            changed = true;
          }
          if (update.wooUserId && update.wooUserId !== existing.sc_WooUserId) {
            existing.sc_WooUserId = update.wooUserId;
            changed = true;
          }
          if (update.language && update.language !== existing.sc_Language) {
            existing.sc_Language = update.language;
            changed = true;
          }
          if (update.lastOrderDate > existingLastOrder) {
            existing.sc_LastOrderDate = update.lastOrderDate;
            changed = true;
          }
        }

        // Update order metrics
        const newOrderCount = update.orders.length;
        const newTotalSpend = update.orders.reduce((sum, o) => sum + o.total, 0);
        if (newOrderCount !== existing.sc_OrderCount || Math.abs(newTotalSpend - (existing.sc_TotalSpend || 0)) > 1) {
          existing.sc_OrderCount = newOrderCount;
          existing.sc_TotalSpend = newTotalSpend;
          existing.sc_AvgOrderValue = newOrderCount > 0 ? Math.round(newTotalSpend / newOrderCount) : 0;
          changed = true;
        }

        if (changed) {
          contactsToSave.push(existing);
          updated++;
        }
      } else {
        // Create new contact
        const orderCount = update.orders.length;
        const totalSpend = update.orders.reduce((sum, o) => sum + o.total, 0);
        const totalBottles = update.orders.reduce((sum, o) => sum + o.bottles, 0);

        const newContact = {
          sc_Email: email,
          sc_Name: update.name,
          sc_Phone: update.phone,
          sc_City: update.city,
          sc_Language: update.language || 'en',
          sc_Country: 'IL',
          sc_WooUserId: update.wooUserId || null,
          sc_IsCustomer: true,
          sc_IsCore: true,
          sc_IsSubscribed: false,
          sc_FirstOrderDate: update.firstOrderDate,
          sc_LastOrderDate: update.lastOrderDate,
          sc_OrderCount: orderCount,
          sc_TotalSpend: totalSpend,
          sc_AvgOrderValue: orderCount > 0 ? Math.round(totalSpend / orderCount) : 0,
          sc_AvgBottlesPerOrder: orderCount > 0 ? Math.round(totalBottles / orderCount * 10) / 10 : 0,
          sc_DaysSinceOrder: Math.floor((today - update.lastOrderDate) / (1000 * 60 * 60 * 24))
        };

        // Determine customer type
        if (update.giftOrders === orderCount) {
          newContact.sc_IsCore = false;
          newContact.sc_CustomerType = 'noncore.gift';
        } else if (update.warSupportOrders === orderCount) {
          newContact.sc_IsCore = false;
          newContact.sc_CustomerType = 'noncore.support';
        } else {
          newContact.sc_CustomerType = ContactService._classifyCustomerType(newContact);
        }

        newContact.sc_LifecycleStatus = ContactService._calculateLifecycleStatus(newContact.sc_DaysSinceOrder);

        contactsToSave.push(newContact);
        created++;
      }
    });

    // Batch save
    if (contactsToSave.length > 0) {
      LoggerService.info(SERVICE_NAME, fnName, `Saving ${contactsToSave.length} contacts (${created} new, ${updated} updated)`);
      ContactService.batchUpsertContacts(contactsToSave);
    }

    LoggerService.info(SERVICE_NAME, fnName, `Complete: ${created} created, ${updated} updated`);
    return { created, updated, errors: [] };
  }

  /**
   * Backfills WooCommerce customer user IDs into order sheets.
   * Reads user export CSV, matches by email, updates order rows.
   * @param {string} userExportFileName - Partial name of user export file in import folder
   * @returns {Object} Result with counts
   */
  function backfillOrderCustomerIds(userExportFileName) {
    const fnName = 'backfillOrderCustomerIds';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting order customer ID backfill');

    // Load user export file
    const rows = getImportFileData(userExportFileName || 'user_export');
    if (!rows || rows.length <= 1) {
      LoggerService.warn(SERVICE_NAME, fnName, 'User export file not found or empty');
      return { error: 'User export file not found', master: 0, archive: 0 };
    }

    // Build email → userId map from user export
    const headers = rows[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[String(h).toLowerCase().trim()] = i);

    const idCol = headerMap['id'] ?? headerMap['customer_id'];
    const emailCol = headerMap['user_email'] ?? headerMap['email'];

    if (idCol === undefined || emailCol === undefined) {
      LoggerService.error(SERVICE_NAME, fnName, 'Required columns (ID, user_email) not found in export');
      return { error: 'Required columns not found', master: 0, archive: 0 };
    }

    const userIdByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const email = (rows[i][emailCol] || '').toLowerCase().trim();
      const userId = String(rows[i][idCol] || '').trim();
      if (email && userId) {
        userIdByEmail.set(email, userId);
      }
    }
    LoggerService.info(SERVICE_NAME, fnName, `Loaded ${userIdByEmail.size} user IDs from export`);

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

    let masterUpdated = 0;
    let archiveUpdated = 0;

    // Update WebOrdM
    const masterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (masterSheet && masterSheet.getLastRow() > 1) {
      masterUpdated = _backfillSheetCustomerIds(masterSheet, 'wom_BillingEmail', 'wom_CustomerUser', userIdByEmail);
      LoggerService.info(SERVICE_NAME, fnName, `Updated ${masterUpdated} rows in WebOrdM`);
    }

    // Update WebOrdM_Archive
    const archiveSheet = spreadsheet.getSheetByName('WebOrdM_Archive');
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      archiveUpdated = _backfillSheetCustomerIds(archiveSheet, 'woma_BillingEmail', 'woma_CustomerUser', userIdByEmail);
      LoggerService.info(SERVICE_NAME, fnName, `Updated ${archiveUpdated} rows in WebOrdM_Archive`);
    }

    LoggerService.info(SERVICE_NAME, fnName, `Complete: ${masterUpdated} master, ${archiveUpdated} archive`);
    return { master: masterUpdated, archive: archiveUpdated };
  }

  /**
   * Helper to backfill customer IDs in a single sheet.
   */
  function _backfillSheetCustomerIds(sheet, emailColName, userIdColName, userIdByEmail) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return 0;

    const headers = data[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    const emailIdx = headerMap[emailColName];
    const userIdIdx = headerMap[userIdColName];

    if (emailIdx === undefined || userIdIdx === undefined) {
      LoggerService.warn(SERVICE_NAME, '_backfillSheetCustomerIds',
        `Columns not found: ${emailColName}=${emailIdx}, ${userIdColName}=${userIdIdx}`);
      return 0;
    }

    let updated = 0;
    const updates = []; // [row, col, value]

    for (let i = 1; i < data.length; i++) {
      const email = (data[i][emailIdx] || '').toLowerCase().trim();
      const existingUserId = data[i][userIdIdx];

      if (email && !existingUserId) {
        const userId = userIdByEmail.get(email);
        if (userId) {
          updates.push([i + 1, userIdIdx + 1, userId]); // 1-indexed for sheet
          updated++;
        }
      }
    }

    // Batch update
    if (updates.length > 0) {
      updates.forEach(([row, col, value]) => {
        sheet.getRange(row, col).setValue(value);
      });
    }

    return updated;
  }

  /**
   * Backfills sc_WooUserId in SysContacts from user export.
   * @param {string} userExportFileName - Partial name of user export file
   * @returns {Object} Result with counts
   */
  function backfillContactData(userExportFileName) {
    const fnName = 'backfillContactData';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting contact data backfill');

    // Load user export file
    const rows = getImportFileData(userExportFileName || 'user_export');
    if (!rows || rows.length <= 1) {
      LoggerService.warn(SERVICE_NAME, fnName, 'User export file not found or empty');
      return { error: 'User export file not found', updated: 0 };
    }

    // Build email → userId map
    const headers = rows[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[String(h).toLowerCase().trim()] = i);

    const idCol = headerMap['id'] ?? headerMap['customer_id'];
    const emailCol = headerMap['user_email'] ?? headerMap['email'];

    if (idCol === undefined || emailCol === undefined) {
      return { error: 'Required columns not found', updated: 0 };
    }

    const userIdByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const email = (rows[i][emailCol] || '').toLowerCase().trim();
      const userId = String(rows[i][idCol] || '').trim();
      if (email && userId) {
        userIdByEmail.set(email, userId);
      }
    }
    LoggerService.info(SERVICE_NAME, fnName, `Loaded ${userIdByEmail.size} user IDs from export`);

    // Load contacts
    const contacts = ContactService.getContacts();
    const contactsToUpdate = [];

    contacts.forEach(contact => {
      if (!contact.sc_Email) return;
      const email = contact.sc_Email.toLowerCase();

      // Update WooUserId if missing
      if (!contact.sc_WooUserId) {
        const userId = userIdByEmail.get(email);
        if (userId) {
          contact.sc_WooUserId = userId;
          contactsToUpdate.push(contact);
        }
      }
    });

    // Batch update
    if (contactsToUpdate.length > 0) {
      LoggerService.info(SERVICE_NAME, fnName, `Updating ${contactsToUpdate.length} contacts with WooUserId`);
      ContactService.batchUpsertContacts(contactsToUpdate);
    }

    LoggerService.info(SERVICE_NAME, fnName, `Complete: ${contactsToUpdate.length} contacts updated`);
    return { updated: contactsToUpdate.length };
  }

  /**
   * Backfills WPML language into master order sheets from multiple sources.
   * Reads from staging sheet and/or multiple import files.
   * Use after adding wom_MetaWpmlLanguage column to master sheets.
   * @param {Object} options - Options
   * @param {boolean} options.fromStaging - If true, reads from WebOrdS staging sheet (default: true)
   * @param {string|string[]} options.fileNames - File name(s) to read from import folder
   * @returns {Object} Result with counts
   */
  function backfillOrderLanguage(options = {}) {
    const fnName = 'backfillOrderLanguage';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting order language backfill');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

    // Build orderId → language map from all sources
    const languageByOrderId = new Map();

    // Source 1: Staging sheet
    if (options.fromStaging !== false) {
      const stagingSheet = spreadsheet.getSheetByName(sheetNames.WebOrdS);
      if (stagingSheet && stagingSheet.getLastRow() > 1) {
        const stagingData = stagingSheet.getDataRange().getValues();
        const stagingHeaders = stagingData.shift();
        const wosIdx = {};
        stagingHeaders.forEach((h, i) => wosIdx[h] = i);

        const orderIdIdx = wosIdx['wos_OrderId'];
        const langIdx = wosIdx['wos_MetaWpmlLanguage'];

        if (orderIdIdx !== undefined && langIdx !== undefined) {
          let count = 0;
          stagingData.forEach(row => {
            const orderId = String(row[orderIdIdx] || '').trim();
            const lang = (row[langIdx] || '').toLowerCase().trim();
            if (orderId && lang) {
              languageByOrderId.set(orderId, lang);
              count++;
            }
          });
          LoggerService.info(SERVICE_NAME, fnName, `Loaded ${count} languages from staging`);
        }
      }
    }

    // Source 2: Import files (can be single string or array)
    const fileNames = options.fileNames
      ? (Array.isArray(options.fileNames) ? options.fileNames : [options.fileNames])
      : [];

    // Also support legacy 'fileName' option
    if (options.fileName && !fileNames.includes(options.fileName)) {
      fileNames.push(options.fileName);
    }

    for (const fileName of fileNames) {
      const loaded = _loadLanguageFromFile(fileName, languageByOrderId);
      LoggerService.info(SERVICE_NAME, fnName, `Loaded ${loaded} languages from "${fileName}"`);
    }

    LoggerService.info(SERVICE_NAME, fnName, `Total unique order languages: ${languageByOrderId.size}`);

    if (languageByOrderId.size === 0) {
      LoggerService.warn(SERVICE_NAME, fnName, 'No language data found');
      return { error: 'No language data found', master: 0, archive: 0, totalLanguages: 0 };
    }

    let masterUpdated = 0;
    let archiveUpdated = 0;

    // Update WebOrdM
    const masterSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (masterSheet && masterSheet.getLastRow() > 1) {
      masterUpdated = _backfillSheetLanguage(masterSheet, 'wom_OrderId', 'wom_MetaWpmlLanguage', languageByOrderId);
      LoggerService.info(SERVICE_NAME, fnName, `Updated ${masterUpdated} rows in WebOrdM`);
    }

    // Update WebOrdM_Archive
    const archiveSheet = spreadsheet.getSheetByName('WebOrdM_Archive');
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      archiveUpdated = _backfillSheetLanguage(archiveSheet, 'woma_OrderId', 'woma_MetaWpmlLanguage', languageByOrderId);
      LoggerService.info(SERVICE_NAME, fnName, `Updated ${archiveUpdated} rows in WebOrdM_Archive`);
    }

    LoggerService.info(SERVICE_NAME, fnName, `Complete: ${masterUpdated} master, ${archiveUpdated} archive`);
    return { master: masterUpdated, archive: archiveUpdated, totalLanguages: languageByOrderId.size };
  }

  /**
   * Helper to load language data from an import file.
   * @returns {number} Count of languages loaded from this file
   */
  function _loadLanguageFromFile(fileName, languageByOrderId) {
    const rows = getImportFileData(fileName);
    if (!rows || rows.length <= 1) {
      LoggerService.warn(SERVICE_NAME, '_loadLanguageFromFile', `File "${fileName}" not found or empty`);
      return 0;
    }

    const headers = rows[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[String(h).toLowerCase().trim()] = i);

    // Try common column names for order ID
    const orderIdCol = headerMap['order_id'] ?? headerMap['orderid'] ?? headerMap['wos_orderid'] ?? headerMap['id'];
    // Try common column names for language
    const langCol = headerMap['meta:wpml_language'] ?? headerMap['wpml_language'] ?? headerMap['language']
      ?? headerMap['wos_metawpmllanguage'] ?? headerMap['meta_wpml_language'];

    if (orderIdCol === undefined || langCol === undefined) {
      LoggerService.warn(SERVICE_NAME, '_loadLanguageFromFile',
        `Required columns not found in "${fileName}". Expected: order_id/id + meta:wpml_language/language`);
      return 0;
    }

    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const orderId = String(rows[i][orderIdCol] || '').trim();
      const lang = (rows[i][langCol] || '').toLowerCase().trim();
      if (orderId && lang) {
        languageByOrderId.set(orderId, lang);
        count++;
      }
    }
    return count;
  }

  /**
   * Helper to backfill language in a single sheet.
   */
  function _backfillSheetLanguage(sheet, orderIdColName, langColName, languageByOrderId) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return 0;

    const headers = data[0];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h] = i);

    const orderIdIdx = headerMap[orderIdColName];
    const langIdx = headerMap[langColName];

    if (orderIdIdx === undefined || langIdx === undefined) {
      LoggerService.warn(SERVICE_NAME, '_backfillSheetLanguage',
        `Columns not found: ${orderIdColName}=${orderIdIdx}, ${langColName}=${langIdx}`);
      return 0;
    }

    let updated = 0;
    const updates = []; // [row, col, value]

    for (let i = 1; i < data.length; i++) {
      const orderId = String(data[i][orderIdIdx] || '').trim();
      const existingLang = (data[i][langIdx] || '').trim();

      if (orderId && !existingLang) {
        const lang = languageByOrderId.get(orderId);
        if (lang) {
          updates.push([i + 1, langIdx + 1, lang]); // 1-indexed for sheet
          updated++;
        }
      }
    }

    // Batch update
    if (updates.length > 0) {
      updates.forEach(([row, col, value]) => {
        sheet.getRange(row, col).setValue(value);
      });
    }

    return updated;
  }

  // Public API
  return {
    importFromOrderHistory: importFromOrderHistory,
    importFromMailchimpCsv: importFromMailchimpCsv,
    runFullImport: runFullImport,
    updateContactsFromOrders: updateContactsFromOrders,
    backfillOrderCustomerIds: backfillOrderCustomerIds,
    backfillContactData: backfillContactData,
    backfillOrderLanguage: backfillOrderLanguage
  };
})();

/**
 * Global function to run CRM import from Apps Script editor.
 */
function runCrmImport() {
  return ContactImportService.runFullImport();
}

/**
 * Global function to run WooCommerce user ID backfill.
 * Backfills customer IDs in order sheets and contacts from user export file.
 * Run once after adding wom_CustomerUser/woma_CustomerUser/sc_WooUserId columns.
 */
function runWooUserIdBackfill() {
  const SERVICE_NAME = 'ContactImportService';
  const fnName = 'runWooUserIdBackfill';

  LoggerService.info(SERVICE_NAME, fnName, 'Starting WooCommerce user ID backfill');

  // Step 1: Backfill order sheets with customer IDs from user export
  const orderResult = ContactImportService.backfillOrderCustomerIds('user_export');
  LoggerService.info(SERVICE_NAME, fnName,
    `Order backfill: ${orderResult.master} master, ${orderResult.archive} archive`);

  // Step 2: Rebuild all contacts from order history (fills gap of missing contacts)
  // This reads both WebOrdM and WebOrdM_Archive
  LoggerService.info(SERVICE_NAME, fnName, 'Rebuilding contacts from full order history...');
  const importResult = ContactImportService.importFromOrderHistory();
  LoggerService.info(SERVICE_NAME, fnName,
    `Contact rebuild: ${importResult.imported} contacts from ${importResult.total} unique emails`);

  // Step 3: Backfill any remaining contacts with WooUserId from user export
  // (catches contacts that exist but weren't in order history, e.g., subscribers)
  const contactResult = ContactImportService.backfillContactData('user_export');
  LoggerService.info(SERVICE_NAME, fnName,
    `WooUserId backfill: ${contactResult.updated} contacts updated`);

  LoggerService.info(SERVICE_NAME, fnName, 'WooCommerce user ID backfill complete');

  return {
    orders: orderResult,
    contactsRebuilt: importResult,
    contactsBackfilled: contactResult
  };
}

/**
 * Global function to backfill order language from multiple sources.
 * Use after adding wom_MetaWpmlLanguage/woma_MetaWpmlLanguage columns.
 *
 * Usage examples:
 *   // From staging only
 *   backfillOrderLanguage()
 *
 *   // From full history file + recent export (recommended)
 *   backfillOrderLanguage({ fileNames: ['order_history', 'order_export'] })
 *
 *   // From files only (skip staging)
 *   backfillOrderLanguage({ fromStaging: false, fileNames: ['order_history', 'order_export'] })
 *
 * Expected file columns: order_id (or id) + meta:wpml_language (or language)
 */
function backfillOrderLanguage(options) {
  return ContactImportService.backfillOrderLanguage(options || {});
}

/**
 * Full backfill including language. Run after adding all new columns.
 * Reads language from full order history file + recent order export.
 *
 * Prerequisites:
 * - user_export file in import folder (for customer IDs)
 * - order_history file in import folder (full historical orders with language)
 * - order_export file in import folder (recent orders with language)
 *
 * Steps:
 * 1. Backfill customer IDs in orders from user export
 * 2. Backfill language in orders from history + recent export files
 * 3. Rebuild contacts from order history (captures language)
 * 4. Backfill WooUserId in contacts from user export
 */
function runFullBackfill() {
  const SERVICE_NAME = 'ContactImportService';
  const fnName = 'runFullBackfill';

  LoggerService.info(SERVICE_NAME, fnName, 'Starting full backfill');

  // Step 1: Backfill customer IDs
  const orderResult = ContactImportService.backfillOrderCustomerIds('user_export');
  LoggerService.info(SERVICE_NAME, fnName,
    `Customer ID backfill: ${orderResult.master} master, ${orderResult.archive} archive`);

  // Step 2: Backfill language from full history + recent export
  const langResult = ContactImportService.backfillOrderLanguage({
    fromStaging: true,
    fileNames: ['order_history', 'order_export']
  });
  LoggerService.info(SERVICE_NAME, fnName,
    `Language backfill: ${langResult.master} master, ${langResult.archive} archive (${langResult.totalLanguages} total)`);

  // Step 3: Rebuild contacts from order history
  LoggerService.info(SERVICE_NAME, fnName, 'Rebuilding contacts from order history...');
  const importResult = ContactImportService.importFromOrderHistory();
  LoggerService.info(SERVICE_NAME, fnName,
    `Contact rebuild: ${importResult.imported} contacts from ${importResult.total} unique emails`);

  // Step 4: Backfill WooUserId in contacts
  const contactResult = ContactImportService.backfillContactData('user_export');
  LoggerService.info(SERVICE_NAME, fnName,
    `WooUserId backfill: ${contactResult.updated} contacts updated`);

  LoggerService.info(SERVICE_NAME, fnName, 'Full backfill complete');

  return {
    orderCustomerIds: orderResult,
    orderLanguage: langResult,
    contactsRebuilt: importResult,
    contactsBackfilled: contactResult
  };
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
