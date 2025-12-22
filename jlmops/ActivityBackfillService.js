/**
 * @file ActivityBackfillService.js
 * @description Populates SysContactActivity with historical events from order data.
 * Run once to backfill history, then ongoing activity is logged through normal flows.
 */

const ActivityBackfillService = (function () {
  const SERVICE_NAME = 'ActivityBackfillService';

  // Hebrew to English category mapping
  const CATEGORY_TRANSLATIONS = {
    'יין אדום יבש': 'Dry Red',
    'יין לבן יבש': 'Dry White',
    'רוזה': 'Rosé',
    'יין חצי יבש': 'Semi-Dry',
    'יין קינוח': 'Dessert',
    'יין מבוצר': 'Fortified',
    'יין מבעבע': 'Sparkling',
    'ליקר': 'Liqueur',
    'אביזרים': 'Accessories',
    'מתנות': 'Gifts'
  };

  /**
   * Backfills order.placed activities from order history.
   * Calculates totals from order items since order master doesn't have them.
   * @returns {Object} Result with counts
   */
  function backfillOrderActivity() {
    const fnName = 'backfillOrderActivity';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting order activity backfill');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    // Get existing activity IDs to avoid duplicates
    const existingIds = _getExistingActivityIds('order.placed');
    LoggerService.info(SERVICE_NAME, fnName, `Found ${existingIds.size} existing order.placed activities`);

    // Build order totals from items (current + archive)
    const orderTotals = _buildOrderTotals(spreadsheet, sheetNames);
    LoggerService.info(SERVICE_NAME, fnName, `Calculated totals for ${orderTotals.size} orders`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process archive orders first (historical)
    const archiveSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM_Archive);
    if (archiveSheet) {
      const result = _processOrderSheet(archiveSheet, 'woma_', existingIds, orderTotals);
      created += result.created;
      skipped += result.skipped;
      errors += result.errors;
    }

    // Process current orders
    const currentSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (currentSheet) {
      const result = _processOrderSheet(currentSheet, 'wom_', existingIds, orderTotals);
      created += result.created;
      skipped += result.skipped;
      errors += result.errors;
    }

    LoggerService.info(SERVICE_NAME, fnName, `Order activity backfill complete: created=${created}, skipped=${skipped}, errors=${errors}`);
    return { created, skipped, errors };
  }

  /**
   * Builds order totals from order items sheets.
   * @param {Spreadsheet} spreadsheet
   * @param {Object} sheetNames
   * @returns {Map} orderId -> { itemCount, total }
   */
  function _buildOrderTotals(spreadsheet, sheetNames) {
    const totals = new Map();

    // Process current items
    const itemsSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
    if (itemsSheet) {
      _processItemsSheet(itemsSheet, 'woi_', totals);
    }

    // Process archive items
    const archiveItemsSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM_Archive);
    if (archiveItemsSheet) {
      _processItemsSheet(archiveItemsSheet, 'woia_', totals);
    }

    return totals;
  }

  /**
   * Processes order items to calculate totals per order.
   */
  function _processItemsSheet(sheet, prefix, totals) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0];
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);

    const orderIdCol = colMap[prefix + 'OrderId'];
    const qtyCol = colMap[prefix + 'Quantity'];
    const totalCol = colMap[prefix + 'ItemTotal'];

    if (orderIdCol === undefined) return;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const orderId = String(row[orderIdCol] || '');
      if (!orderId) continue;

      const qty = parseInt(row[qtyCol], 10) || 0;
      const itemTotal = parseFloat(row[totalCol]) || 0;

      if (!totals.has(orderId)) {
        totals.set(orderId, { itemCount: 0, total: 0 });
      }
      const t = totals.get(orderId);
      t.itemCount += qty;
      t.total += itemTotal;
    }
  }

  /**
   * Processes orders from a sheet and creates activities.
   * @param {Sheet} sheet - Order sheet
   * @param {string} prefix - Column prefix (wom_ or woma_)
   * @param {Set} existingIds - Set of existing activity IDs
   * @param {Map} orderTotals - Calculated totals from items
   * @returns {Object} Counts
   */
  function _processOrderSheet(sheet, prefix, existingIds, orderTotals) {
    const fnName = '_processOrderSheet';
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { created: 0, skipped: 0, errors: 0 };

    const headers = data[0];
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        const orderId = String(row[colMap[prefix + 'OrderId']] || '');
        const email = row[colMap[prefix + 'BillingEmail']];
        const orderNumber = row[colMap[prefix + 'OrderNumber']];
        const orderDate = row[colMap[prefix + 'OrderDate']];
        const status = String(row[colMap[prefix + 'Status']] || '').toLowerCase();

        if (!email || !orderId) {
          skipped++;
          continue;
        }

        // Skip non-completed orders
        if (status && status !== 'completed' && status !== 'processing') {
          skipped++;
          continue;
        }

        // Check for existing activity
        const activityId = `order.placed.${orderId}`;
        if (existingIds.has(activityId)) {
          skipped++;
          continue;
        }

        // Get totals from calculated map
        const totals = orderTotals.get(orderId) || { itemCount: 0, total: 0 };

        // Create activity
        ContactService.createActivity({
          sca_ActivityId: activityId,
          sca_Email: email.toLowerCase().trim(),
          sca_Timestamp: orderDate || new Date(),
          sca_Type: 'order.placed',
          sca_Summary: `Order #${orderNumber}: ${totals.itemCount} items, ₪${Math.round(totals.total)}`,
          sca_Details: JSON.stringify({
            orderId: orderId,
            orderNumber: orderNumber,
            total: totals.total,
            itemCount: totals.itemCount
          }),
          sca_CreatedBy: 'import'
        });

        created++;
        existingIds.add(activityId);
      } catch (e) {
        errors++;
        if (errors < 5) {
          LoggerService.warn(SERVICE_NAME, fnName, `Error at row ${i + 1}: ${e.message}`);
        }
      }
    }

    return { created, skipped, errors };
  }

  /**
   * Backfills coupon.used activities from order data.
   * Uses WebOrdM + WebOrdM_Archive for full history.
   * Format: "code:SHIPFREE|amount:0.00;code:WELCOME10|amount:44.03"
   * @returns {Object} Result with counts
   */
  function backfillCouponActivity() {
    const fnName = 'backfillCouponActivity';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting coupon activity backfill');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    // Get existing activity IDs
    const existingIds = _getExistingActivityIds('coupon.used');
    LoggerService.info(SERVICE_NAME, fnName, `Found ${existingIds.size} existing coupon.used activities`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process archive orders first (historical)
    const archiveSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM_Archive);
    if (archiveSheet) {
      const result = _processCouponSheet(archiveSheet, 'woma_', existingIds);
      created += result.created;
      skipped += result.skipped;
      errors += result.errors;
    }

    // Process current orders
    const currentSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (currentSheet) {
      const result = _processCouponSheet(currentSheet, 'wom_', existingIds);
      created += result.created;
      skipped += result.skipped;
      errors += result.errors;
    }

    LoggerService.info(SERVICE_NAME, fnName, `Coupon activity backfill complete: created=${created}, skipped=${skipped}, errors=${errors}`);
    return { created, skipped, errors };
  }

  /**
   * Processes coupon data from an order sheet.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Order sheet
   * @param {string} prefix - Column prefix (wos_)
   * @param {Set} existingIds - Set of existing activity IDs
   * @returns {Object} Counts
   */
  function _processCouponSheet(sheet, prefix, existingIds) {
    const fnName = '_processCouponSheet';
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { created: 0, skipped: 0, errors: 0 };

    const headers = data[0];
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);

    const couponColName = prefix + 'CouponItems';
    const couponColIndex = colMap[couponColName];

    if (couponColIndex === undefined) {
      LoggerService.warn(SERVICE_NAME, fnName, `Coupon column ${couponColName} not found in headers`);
      return { created: 0, skipped: 0, errors: 0 };
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        const orderId = row[colMap[prefix + 'OrderId']];
        const email = row[colMap[prefix + 'BillingEmail']];
        const orderDate = row[colMap[prefix + 'OrderDate']];
        const status = row[colMap[prefix + 'Status']];
        const couponData = row[couponColIndex];

        if (!email || !couponData) continue;
        if (status && ['cancelled', 'refunded', 'failed'].includes(String(status).toLowerCase())) continue;

        // Parse coupon format: "code:SHIPFREE|amount:0.00;code:WELCOME10|amount:44.03"
        const coupons = _parseCouponItems(couponData);

        for (const coupon of coupons) {
          // Skip free shipping coupons - too frequent to be meaningful
          const codeLower = coupon.code.toLowerCase();
          if (codeLower.includes('ship') || codeLower.includes('delivery')) {
            skipped++;
            continue;
          }

          const activityId = `coupon.used.${orderId}.${coupon.code}`;
          if (existingIds.has(activityId)) {
            skipped++;
            continue;
          }

          ContactService.createActivity({
            sca_ActivityId: activityId,
            sca_Email: email.toLowerCase().trim(),
            sca_Timestamp: orderDate || new Date(),
            sca_Type: 'coupon.used',
            sca_Summary: `Used coupon ${coupon.code} (-₪${coupon.amount})`,
            sca_Details: JSON.stringify({
              code: coupon.code,
              discount: coupon.amount,
              orderId: orderId
            }),
            sca_CreatedBy: 'import'
          });

          created++;
          existingIds.add(activityId);
        }
      } catch (e) {
        errors++;
        if (errors < 5) {
          LoggerService.warn(SERVICE_NAME, fnName, `Error at row ${i + 1}: ${e.message}`);
        }
      }
    }

    return { created, skipped, errors };
  }

  /**
   * Backfills subscription.started activities from SysContacts.
   * Creates activity for each contact with sc_SubscribedDate.
   * @returns {Object} Result with counts
   */
  function backfillSubscriptionActivity() {
    const fnName = 'backfillSubscriptionActivity';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting subscription activity backfill');

    const existingIds = _getExistingActivityIds('subscription.started');
    LoggerService.info(SERVICE_NAME, fnName, `Found ${existingIds.size} existing subscription.started activities`);

    const contacts = ContactService.getContacts({});
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        if (!contact.sc_IsSubscribed || !contact.sc_SubscribedDate) {
          continue;
        }

        const email = contact.sc_Email;
        const activityId = `subscription.started.${email}`;

        if (existingIds.has(activityId)) {
          skipped++;
          continue;
        }

        const source = contact.sc_SubscriptionSource || 'Unknown';
        ContactService.createActivity({
          sca_ActivityId: activityId,
          sca_Email: email,
          sca_Timestamp: contact.sc_SubscribedDate,
          sca_Type: 'subscription.started',
          sca_Summary: `Subscribed to newsletter (${source})`,
          sca_Details: JSON.stringify({
            source: source,
            language: contact.sc_Language || 'en'
          }),
          sca_CreatedBy: 'import'
        });

        created++;
        existingIds.add(activityId);
      } catch (e) {
        errors++;
        if (errors < 5) {
          LoggerService.warn(SERVICE_NAME, fnName, `Error for ${contact.sc_Email}: ${e.message}`);
        }
      }
    }

    LoggerService.info(SERVICE_NAME, fnName, `Subscription activity backfill complete: created=${created}, skipped=${skipped}, errors=${errors}`);
    return { created, skipped, errors };
  }

  /**
   * Backfills campaign.received activities based on subscriber language.
   * English subscribers receive English campaigns, Hebrew subscribers receive Hebrew campaigns.
   * Only campaigns sent after the subscriber's subscribe date are included.
   * @returns {Object} Result with counts
   */
  function backfillCampaignActivity() {
    const fnName = 'backfillCampaignActivity';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting campaign activity backfill');

    // Get existing activity IDs
    const existingIds = _getExistingActivityIds('campaign.received');
    LoggerService.info(SERVICE_NAME, fnName, `Found ${existingIds.size} existing campaign.received activities`);

    // Load all campaigns
    const campaigns = CampaignService.getCampaigns({});
    LoggerService.info(SERVICE_NAME, fnName, `Found ${campaigns.length} campaigns`);

    if (campaigns.length === 0) {
      return { created: 0, skipped: 0, errors: 0, note: 'No campaigns found' };
    }

    // Categorize campaigns by language (Hebrew has Hebrew chars, else English)
    const hebrewCampaigns = [];
    const englishCampaigns = [];
    const hebrewPattern = /[\u0590-\u05FF]/;

    for (const campaign of campaigns) {
      const title = campaign.scm_Title || '';
      const subject = campaign.scm_Subject || '';
      const sendDate = campaign.scm_SendDate;

      if (!sendDate) continue;

      const campaignData = {
        id: campaign.scm_CampaignId,
        title: title,
        sendDate: sendDate instanceof Date ? sendDate : new Date(sendDate)
      };

      if (hebrewPattern.test(title) || hebrewPattern.test(subject)) {
        hebrewCampaigns.push(campaignData);
      } else {
        englishCampaigns.push(campaignData);
      }
    }

    LoggerService.info(SERVICE_NAME, fnName, `Categorized: ${englishCampaigns.length} English, ${hebrewCampaigns.length} Hebrew campaigns`);

    // Load subscribers with language and subscribe date
    const contacts = ContactService.getContacts({});
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        if (!contact.sc_IsSubscribed || !contact.sc_SubscribedDate) {
          continue;
        }

        const email = contact.sc_Email;
        // Normalize language: handle full words, two-letter codes, and unexpected values
        const rawLang = String(contact.sc_Language || 'en').toLowerCase().trim();
        let language = 'en';  // default
        if (rawLang === 'he' || rawLang === 'hebrew' || rawLang.includes('hebrew')) {
          language = 'he';
        } else if (rawLang === 'en' || rawLang === 'english' || rawLang.includes('english')) {
          language = 'en';
        } else {
          // Unknown language, skip for campaign matching
          continue;
        }
        const subscribeDate = contact.sc_SubscribedDate instanceof Date
          ? contact.sc_SubscribedDate
          : new Date(contact.sc_SubscribedDate);

        // Get campaigns for this language
        const relevantCampaigns = language === 'he' ? hebrewCampaigns : englishCampaigns;

        for (const campaign of relevantCampaigns) {
          // Only include campaigns sent after subscribe date
          if (campaign.sendDate <= subscribeDate) {
            continue;
          }

          const activityId = `campaign.received.${campaign.id}.${email}`;
          if (existingIds.has(activityId)) {
            skipped++;
            continue;
          }

          ContactService.createActivity({
            sca_ActivityId: activityId,
            sca_Email: email,
            sca_Timestamp: campaign.sendDate,
            sca_Type: 'campaign.received',
            sca_Summary: `Received campaign: ${campaign.title}`,
            sca_Details: JSON.stringify({
              campaignId: campaign.id,
              title: campaign.title,
              language: language
            }),
            sca_CreatedBy: 'import'
          });

          created++;
          existingIds.add(activityId);
        }
      } catch (e) {
        errors++;
        if (errors < 5) {
          LoggerService.warn(SERVICE_NAME, fnName, `Error for ${contact.sc_Email}: ${e.message}`);
        }
      }
    }

    LoggerService.info(SERVICE_NAME, fnName, `Campaign activity backfill complete: created=${created}, skipped=${skipped}, errors=${errors}`);
    return { created, skipped, errors };
  }

  /**
   * Parses coupon items string.
   * Format: "code:SHIPFREE|amount:0.00;code:WELCOME10|amount:44.03"
   * @param {string} couponStr - Coupon string
   * @returns {Array<Object>} Array of {code, amount}
   */
  function _parseCouponItems(couponStr) {
    if (!couponStr || typeof couponStr !== 'string') return [];

    const coupons = [];
    const items = couponStr.split(';');

    for (const item of items) {
      if (!item.trim()) continue;

      const parts = item.split('|');
      let code = '';
      let amount = 0;

      for (const part of parts) {
        const [key, val] = part.split(':');
        if (key === 'code') code = val;
        if (key === 'amount') amount = parseFloat(val) || 0;
      }

      if (code) {
        coupons.push({ code, amount });
      }
    }

    return coupons;
  }

  /**
   * Gets existing activity IDs of a specific type.
   * @param {string} activityType - Activity type to filter
   * @returns {Set} Set of activity IDs
   */
  function _getExistingActivityIds(activityType) {
    const activities = ContactService.getAllActivities();
    const ids = new Set();

    for (const a of activities) {
      if (a.sca_Type === activityType && a.sca_ActivityId) {
        ids.add(a.sca_ActivityId);
      }
    }

    return ids;
  }

  /**
   * Translates a Hebrew category to English.
   * @param {string} hebrewCategory - Hebrew category name
   * @returns {string} English category name
   */
  function translateCategory(hebrewCategory) {
    if (!hebrewCategory) return '';
    return CATEGORY_TRANSLATIONS[hebrewCategory] || hebrewCategory;
  }

  /**
   * Runs full activity backfill.
   * @returns {Object} Combined results
   */
  function runFullBackfill() {
    const fnName = 'runFullBackfill';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting full activity backfill');

    const orderResult = backfillOrderActivity();
    const subscriptionResult = backfillSubscriptionActivity();
    const couponResult = backfillCouponActivity();
    const campaignResult = backfillCampaignActivity();

    const result = {
      orders: orderResult,
      subscriptions: subscriptionResult,
      coupons: couponResult,
      campaigns: campaignResult,
      totalCreated: orderResult.created + subscriptionResult.created + couponResult.created + campaignResult.created,
      totalSkipped: orderResult.skipped + subscriptionResult.skipped + couponResult.skipped + campaignResult.skipped,
      totalErrors: orderResult.errors + subscriptionResult.errors + couponResult.errors + campaignResult.errors
    };

    LoggerService.info(SERVICE_NAME, fnName, `Full backfill complete: ${result.totalCreated} activities created`);
    return result;
  }

  return {
    backfillOrderActivity: backfillOrderActivity,
    backfillCouponActivity: backfillCouponActivity,
    backfillSubscriptionActivity: backfillSubscriptionActivity,
    backfillCampaignActivity: backfillCampaignActivity,
    runFullBackfill: runFullBackfill,
    translateCategory: translateCategory,
    CATEGORY_TRANSLATIONS: CATEGORY_TRANSLATIONS
  };
})();

/**
 * Global function to run activity backfill.
 * Run from Apps Script UI or triggers.
 */
function runActivityBackfill() {
  return ActivityBackfillService.runFullBackfill();
}
