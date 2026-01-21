/**
 * @file ContactService.js
 * @description Service for managing CRM contacts. Handles import from orders and Mailchimp,
 * metric calculation, customer classification, and activity logging.
 */

const ContactService = (function () {
  const SERVICE_NAME = 'ContactService';

  // Config cache (loaded once per execution)
  let _crmConfig = null;

  /**
   * Gets CRM config values, loading from ConfigService if not cached.
   * @returns {Object} CRM configuration object
   */
  function _getCrmConfig() {
    if (_crmConfig) return _crmConfig;

    const allConfig = ConfigService.getAllConfig();
    _crmConfig = {
      lifecycle: {
        active: parseInt(allConfig['crm.lifecycle.thresholds']?.active, 10) || 30,
        recent: parseInt(allConfig['crm.lifecycle.thresholds']?.recent, 10) || 90,
        cooling: parseInt(allConfig['crm.lifecycle.thresholds']?.cooling, 10) || 180,
        lapsed: parseInt(allConfig['crm.lifecycle.thresholds']?.lapsed, 10) || 365
      },
      prospect: {
        freshMax: parseInt(allConfig['crm.prospect.thresholds']?.fresh_max, 10) || 30,
        staleMin: parseInt(allConfig['crm.prospect.thresholds']?.stale_min, 10) || 180
      },
      vip: {
        minOrders: parseInt(allConfig['crm.vip.thresholds']?.min_orders, 10) || 5,
        minSpend: parseInt(allConfig['crm.vip.thresholds']?.min_spend, 10) || 3000
      },
      churn: {
        lowRiskDays: parseInt(allConfig['crm.churn.thresholds']?.low_risk_days, 10) || 60,
        lowRiskMinOrders: parseInt(allConfig['crm.churn.thresholds']?.low_risk_min_orders, 10) || 2,
        lowRiskMinSpend: parseInt(allConfig['crm.churn.thresholds']?.low_risk_min_spend, 10) || 1000,
        highRiskDays: parseInt(allConfig['crm.churn.thresholds']?.high_risk_days, 10) || 120,
        singleOrderRiskDays: parseInt(allConfig['crm.churn.thresholds']?.single_order_risk_days, 10) || 90
      },
      orderInterval: {
        defaultDays: parseInt(allConfig['crm.order_interval']?.default_days, 10) || 48
      },
      warSupportCoupons: (allConfig['crm.war_support_coupons']?.codes || 'efrat,roshtzurim,gushwarriors,gush,tekoa').split(',').map(c => c.trim().toLowerCase()),
      customerTypes: allConfig['crm.customer_types'] || {}
    };
    return _crmConfig;
  }

  // Cache for contacts within a session
  let _contactCache = null;
  let _cacheTimestamp = null;
  const CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Clears the internal cache.
   */
  function clearCache() {
    _contactCache = null;
    _cacheTimestamp = null;
  }

  /**
   * Gets the SysContacts sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getContactsSheet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    return SheetAccessor.getDataSheet(sheetNames.SysContacts, false);
  }

  /**
   * Gets the SysContactActivity sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getActivitySheet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    return SheetAccessor.getDataSheet(sheetNames.SysContactActivity, false);
  }

  /**
   * Gets column indices for SysContacts sheet.
   * @returns {Object} Map of column names to 0-based indices
   */
  function _getContactColumnIndices() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysContacts'];
    if (!schema || !schema.headers) {
      throw new Error('Schema for SysContacts not found in configuration.');
    }
    const headers = schema.headers.split(',');
    const indices = {};
    headers.forEach((h, i) => indices[h] = i);
    return indices;
  }

  /**
   * Gets column indices for SysContactActivity sheet.
   * @returns {Object} Map of column names to 0-based indices
   */
  function _getActivityColumnIndices() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysContactActivity'];
    if (!schema || !schema.headers) {
      throw new Error('Schema for SysContactActivity not found in configuration.');
    }
    const headers = schema.headers.split(',');
    const indices = {};
    headers.forEach((h, i) => indices[h] = i);
    return indices;
  }

  /**
   * Formats an Israeli phone number for WhatsApp.
   * @param {string} phone - The phone number
   * @param {string} country - Country code (default 'IL')
   * @returns {string|null} Formatted phone or null
   */
  function formatPhoneForWhatsApp(phone, country = 'IL') {
    if (!phone) return null;

    // Remove all non-digits
    let digits = String(phone).replace(/\D/g, '');

    // Israeli number handling
    if (country === 'IL') {
      // 05x... → +9725x...
      if (digits.startsWith('05')) {
        digits = '972' + digits.substring(1);
      }
      // Already has country code
      else if (digits.startsWith('9725')) {
        // Good as is
      }
    }

    return digits.length >= 10 ? '+' + digits : null;
  }

  // Keywords in customer note that suggest customer is directing their OWN delivery (not a gift)
  const DELIVERY_KEYWORDS = [
    'please', 'deliver', 'call', 'phone', 'outside', 'floor', 'door', 'gate',
    'code', 'buzzer', 'leave', 'ring', 'knock', 'entrance', 'building'
  ];

  /**
   * Determines if an order appears to be a gift (different billing/shipping).
   * If customer note contains delivery instructions, assume it's NOT a gift
   * (customer is directing their own delivery).
   * @param {Object} order - Order object with billing/shipping fields and customerNote
   * @returns {boolean}
   */
  function _isGiftOrder(order) {
    // Check customer note for delivery keywords - suggests NOT a gift
    const note = (order.customerNote || '').toLowerCase();
    if (note && DELIVERY_KEYWORDS.some(kw => note.includes(kw))) {
      return false;
    }

    // Different last names = gift
    const billName = (order.billingLastName || '').toLowerCase().trim();
    const shipName = (order.shippingLastName || '').toLowerCase().trim();
    if (billName && shipName && billName !== shipName) {
      return true;
    }

    return false;
  }

  /**
   * Extracts coupon codes from coupon_items string.
   * Format: "code:SHIPFREE|amount:0.00;code:WELCOME10|amount:44.03"
   * @param {string} couponItems - The coupon items string
   * @returns {Array<{code: string, amount: number}>}
   */
  function _extractCoupons(couponItems) {
    if (!couponItems) return [];
    return String(couponItems).split(';').map(item => {
      const codeMatch = item.match(/code:([^|]+)/);
      const amountMatch = item.match(/amount:([^|;]+)/);
      if (codeMatch) {
        return {
          code: codeMatch[1].trim(),
          amount: amountMatch ? parseFloat(amountMatch[1]) : 0
        };
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Checks if any coupon in the list is a war-support coupon.
   * @param {Array<{code: string}>} coupons - Array of coupon objects
   * @returns {boolean}
   */
  function _hasWarSupportCoupon(coupons) {
    const { warSupportCoupons } = _getCrmConfig();
    return coupons.some(c =>
      warSupportCoupons.some(w => c.code.toLowerCase().includes(w))
    );
  }

  /**
   * Calculates lifecycle status based on days since last order.
   * @param {number} daysSinceOrder - Days since last order
   * @returns {string} Lifecycle status
   */
  function _calculateLifecycleStatus(daysSinceOrder) {
    if (daysSinceOrder === null || daysSinceOrder === undefined) return 'Unknown';
    const { lifecycle } = _getCrmConfig();
    if (daysSinceOrder <= lifecycle.active) return 'Active';
    if (daysSinceOrder <= lifecycle.recent) return 'Recent';
    if (daysSinceOrder <= lifecycle.cooling) return 'Cooling';
    if (daysSinceOrder <= lifecycle.lapsed) return 'Lapsed';
    return 'Dormant';
  }

  /**
   * Determines customer type based on order count, spend, and flags.
   * @param {Object} contact - Contact object with metrics
   * @returns {string} Customer type
   */
  function _classifyCustomerType(contact) {
    const config = _getCrmConfig();

    // Non-customers
    if (!contact.sc_IsCustomer) {
      if (!contact.sc_IsSubscribed) return 'prospect.fresh';
      const daysSubscribed = contact.sc_DaysSubscribed || 0;
      if (daysSubscribed < config.prospect.freshMax) return 'prospect.fresh';
      if (daysSubscribed >= config.prospect.staleMin) return 'prospect.stale';
      return 'prospect.subscriber';
    }

    // Non-core (gift/war-support)
    if (!contact.sc_IsCore) {
      // Could refine further, but for now just noncore
      return 'noncore.gift';
    }

    // Core customers
    const orderCount = contact.sc_OrderCount || 0;
    const totalSpend = contact.sc_TotalSpend || 0;

    // VIP: Top spend OR N+ orders
    if (orderCount >= config.vip.minOrders || totalSpend >= config.vip.minSpend) {
      return 'core.vip';
    }

    // Repeat: 2+ orders
    if (orderCount >= 2) {
      return 'core.repeat';
    }

    // New: 1 order
    return 'core.new';
  }

  /**
   * Calculates churn risk based on order patterns.
   * @param {Object} contact - Contact object with metrics
   * @returns {string} 'low', 'medium', or 'high'
   */
  function _calculateChurnRisk(contact) {
    const daysSince = contact.sc_DaysSinceOrder;
    const orderCount = contact.sc_OrderCount || 0;
    const totalSpend = contact.sc_TotalSpend || 0;

    if (daysSince === null || daysSince === undefined) return 'unknown';

    const { churn } = _getCrmConfig();

    // Low risk: Recent activity with good engagement
    if (daysSince < churn.lowRiskDays && (orderCount > churn.lowRiskMinOrders || totalSpend > churn.lowRiskMinSpend)) {
      return 'low';
    }

    // High risk: Long gap OR single order + moderate gap
    if (daysSince > churn.highRiskDays || (orderCount === 1 && daysSince > churn.singleOrderRiskDays)) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Calculates expected next order date based on historical frequency.
   * @param {Object} contact - Contact object with metrics
   * @returns {Date|null} Expected next order date
   */
  function _calculateNextOrderExpected(contact) {
    const lastOrderDate = contact.sc_LastOrderDate;
    if (!lastOrderDate) return null;

    const orderCount = contact.sc_OrderCount || 0;
    const { orderInterval } = _getCrmConfig();

    // For repeat customers, use their average interval
    // For single-order, use global median from config
    let interval;
    if (orderCount >= 2) {
      const firstOrder = contact.sc_FirstOrderDate;
      if (firstOrder && lastOrderDate) {
        const totalDays = Math.floor((lastOrderDate - firstOrder) / (1000 * 60 * 60 * 24));
        interval = Math.round(totalDays / (orderCount - 1));
      } else {
        interval = orderInterval.defaultDays; // Fallback
      }
    } else {
      interval = orderInterval.defaultDays; // Global median
    }

    const expected = new Date(lastOrderDate);
    expected.setDate(expected.getDate() + interval);
    return expected;
  }

  /**
   * Loads all contacts into cache.
   * @returns {Array<Object>} Array of contact objects
   */
  function _loadContacts() {
    const fnName = '_loadContacts';
    const now = Date.now();
    if (_contactCache && _cacheTimestamp && (now - _cacheTimestamp) < CACHE_TTL_MS) {
      return _contactCache;  // Silent cache hit
    }

    LoggerService.info(SERVICE_NAME, fnName, 'Loading contacts from sheet...');
    const sheet = _getContactsSheet();
    if (!sheet) {
      LoggerService.warn(SERVICE_NAME, fnName, 'SysContacts sheet not found');
      return [];
    }

    LoggerService.info(SERVICE_NAME, fnName, 'Getting data range...');
    const data = sheet.getDataRange().getValues();
    LoggerService.info(SERVICE_NAME, fnName, `Got ${data.length} rows`);
    if (data.length <= 1) {
      _contactCache = [];
      _cacheTimestamp = now;
      return [];
    }

    LoggerService.info(SERVICE_NAME, fnName, 'Getting column indices...');
    const indices = _getContactColumnIndices();
    LoggerService.info(SERVICE_NAME, fnName, 'Processing rows...');
    const contacts = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const contact = {};
      Object.keys(indices).forEach(col => {
        contact[col] = row[indices[col]];
      });
      contacts.push(contact);
    }

    _contactCache = contacts;
    _cacheTimestamp = now;
    return contacts;
  }

  /**
   * Gets a contact by email.
   * @param {string} email - Email address
   * @returns {Object|null} Contact object or null
   */
  function getContactByEmail(email) {
    if (!email) return null;
    const normalizedEmail = email.toLowerCase().trim();
    const contacts = _loadContacts();
    return contacts.find(c => c.sc_Email === normalizedEmail) || null;
  }

  /**
   * Gets all contacts matching filter criteria.
   * @param {Object} filters - Filter criteria
   * @returns {Array<Object>} Filtered contacts
   */
  function getContacts(filters = {}) {
    const contacts = _loadContacts();

    return contacts.filter(c => {
      if (filters.type && c.sc_CustomerType !== filters.type) return false;
      if (filters.status && c.sc_LifecycleStatus !== filters.status) return false;
      if (filters.language && c.sc_Language !== filters.language) return false;
      if (filters.subscribed !== undefined) {
        if (filters.subscribed && !c.sc_IsSubscribed) return false;
        if (!filters.subscribed && c.sc_IsSubscribed) return false;
      }
      if (filters.isCore !== undefined) {
        if (filters.isCore && !c.sc_IsCore) return false;
        if (!filters.isCore && c.sc_IsCore) return false;
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const name = (c.sc_Name || '').toLowerCase();
        const email = (c.sc_Email || '').toLowerCase();
        if (!name.includes(search) && !email.includes(search)) return false;
      }
      return true;
    });
  }

  /**
   * Gets CRM statistics for dashboard.
   * @returns {Object} Stats object
   */
  function getStats() {
    const contacts = _loadContacts();

    const stats = {
      total: contacts.length,
      customers: 0,
      subscribers: 0,
      byStatus: { Active: 0, Recent: 0, Cooling: 0, Lapsed: 0, Dormant: 0 },
      byType: {}
    };

    contacts.forEach(c => {
      if (c.sc_IsCustomer) stats.customers++;
      if (c.sc_IsSubscribed) stats.subscribers++;
      if (c.sc_LifecycleStatus && stats.byStatus[c.sc_LifecycleStatus] !== undefined) {
        stats.byStatus[c.sc_LifecycleStatus]++;
      }
      const type = c.sc_CustomerType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Creates or updates a contact.
   * @param {Object} contactData - Contact data with sc_Email required
   * @param {boolean} skipCacheClear - Skip cache clear for batch operations (caller must clear when done)
   * @returns {Object} Updated contact
   */
  function upsertContact(contactData, skipCacheClear) {
    if (!contactData.sc_Email) {
      throw new Error('sc_Email is required for upsert');
    }

    const email = contactData.sc_Email.toLowerCase().trim();
    contactData.sc_Email = email;
    contactData.sc_LastUpdated = new Date();

    const sheet = _getContactsSheet();
    const indices = _getContactColumnIndices();
    const headers = Object.keys(indices);
    const data = sheet.getDataRange().getValues();

    // Find existing row
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][indices.sc_Email] === email) {
        rowIndex = i;
        break;
      }
    }

    // Build row array
    const rowArray = new Array(headers.length).fill('');
    headers.forEach((h, i) => {
      if (contactData[h] !== undefined) {
        rowArray[i] = contactData[h];
      } else if (rowIndex >= 0) {
        // Keep existing value
        rowArray[i] = data[rowIndex][i];
      }
    });

    if (rowIndex >= 0) {
      // Update existing
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([rowArray]);
    } else {
      // Append new
      contactData.sc_CreatedDate = new Date();
      rowArray[indices.sc_CreatedDate] = contactData.sc_CreatedDate;
      sheet.appendRow(rowArray);
    }

    if (!skipCacheClear) {
      clearCache();
    }
    return contactData;
  }

  /**
   * Batch upserts multiple contacts efficiently.
   * Loads sheet once, processes all in memory, writes in batch.
   * @param {Array<Object>} contacts - Array of contact objects with sc_Email
   * @param {Function} progressCallback - Optional callback(processed, total) for progress
   * @returns {Object} Results { inserted, updated, errors }
   */
  function batchUpsertContacts(contacts, progressCallback) {
    const fnName = 'batchUpsertContacts';
    LoggerService.info(SERVICE_NAME, fnName, `Starting batch upsert of ${contacts.length} contacts`);

    const sheet = _getContactsSheet();
    const indices = _getContactColumnIndices();
    const headers = Object.keys(indices);
    const data = sheet.getDataRange().getValues();

    // Build email-to-row index (1-based for sheet rows)
    const emailToRow = new Map();
    for (let i = 1; i < data.length; i++) {
      const email = (data[i][indices.sc_Email] || '').toLowerCase().trim();
      if (email) {
        emailToRow.set(email, i + 1); // 1-based row number
      }
    }
    LoggerService.info(SERVICE_NAME, fnName, `Indexed ${emailToRow.size} existing contacts`);

    const updates = []; // { row, values }
    const inserts = []; // [values]
    const errors = [];
    const now = new Date();

    for (let i = 0; i < contacts.length; i++) {
      try {
        const contactData = contacts[i];
        if (!contactData.sc_Email) continue;

        const email = contactData.sc_Email.toLowerCase().trim();
        contactData.sc_Email = email;
        contactData.sc_LastUpdated = now;

        const existingRow = emailToRow.get(email);

        // Build row array
        const rowArray = new Array(headers.length).fill('');
        headers.forEach((h, idx) => {
          if (contactData[h] !== undefined) {
            rowArray[idx] = contactData[h];
          } else if (existingRow) {
            // Keep existing value
            rowArray[idx] = data[existingRow - 1][idx];
          }
        });

        if (existingRow) {
          updates.push({ row: existingRow, values: rowArray });
        } else {
          contactData.sc_CreatedDate = now;
          rowArray[indices.sc_CreatedDate] = now;
          inserts.push(rowArray);
          // Add to index so duplicates in batch are handled
          emailToRow.set(email, data.length + inserts.length);
        }

        if (progressCallback && (i + 1) % 100 === 0) {
          progressCallback(i + 1, contacts.length);
        }
      } catch (e) {
        errors.push({ email: contacts[i]?.sc_Email, error: e.message });
      }
    }

    // Write updates in batch
    LoggerService.info(SERVICE_NAME, fnName, `Writing ${updates.length} updates, ${inserts.length} inserts`);

    // Updates - write each row (could optimize further with range writes for consecutive rows)
    for (const upd of updates) {
      sheet.getRange(upd.row, 1, 1, headers.length).setValues([upd.values]);
    }

    // Inserts - append all at once
    if (inserts.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, inserts.length, headers.length).setValues(inserts);
    }

    clearCache();
    LoggerService.info(SERVICE_NAME, fnName, `Batch complete: ${updates.length} updated, ${inserts.length} inserted, ${errors.length} errors`);

    return {
      updated: updates.length,
      inserted: inserts.length,
      errors: errors
    };
  }

  /**
   * Creates an activity record.
   * @param {Object} activity - Activity data
   * @returns {string} Activity ID
   */
  function createActivity(activity) {
    const sheet = _getActivitySheet();
    if (!sheet) {
      throw new Error('SysContactActivity sheet not found');
    }

    const indices = _getActivityColumnIndices();
    const headers = Object.keys(indices);

    // Use passed activityId if provided (for deduplication), otherwise generate new
    const activityId = activity.sca_ActivityId || Utilities.getUuid();
    const rowArray = new Array(headers.length).fill('');

    rowArray[indices.sca_ActivityId] = activityId;
    rowArray[indices.sca_Email] = (activity.sca_Email || '').toLowerCase().trim();
    rowArray[indices.sca_Timestamp] = activity.sca_Timestamp || new Date();
    rowArray[indices.sca_Type] = activity.sca_Type || '';
    rowArray[indices.sca_Summary] = activity.sca_Summary || '';
    rowArray[indices.sca_Details] = typeof activity.sca_Details === 'object'
      ? JSON.stringify(activity.sca_Details)
      : (activity.sca_Details || '');
    rowArray[indices.sca_CreatedBy] = activity.sca_CreatedBy || 'system';

    sheet.appendRow(rowArray);

    // Update LastContactDate/Type for manual contact activities
    const actType = activity.sca_Type || '';
    if (actType.startsWith('contact.') || actType.startsWith('note.')) {
      const email = (activity.sca_Email || '').toLowerCase().trim();
      const contact = getContactByEmail(email);
      if (contact) {
        contact.sc_LastContactDate = activity.sca_Timestamp || new Date();
        contact.sc_LastContactType = actType;
        upsertContact(contact);
      }
    }

    return activityId;
  }

  /**
   * Gets activities for a contact.
   * @param {string} email - Contact email
   * @param {string} typeFilter - Optional activity type filter
   * @returns {Array<Object>} Activities
   */
  function getActivities(email, typeFilter = null) {
    const sheet = _getActivitySheet();
    if (!sheet) return [];

    const normalizedEmail = email.toLowerCase().trim();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const indices = _getActivityColumnIndices();
    const activities = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[indices.sca_Email] !== normalizedEmail) continue;

      const actType = row[indices.sca_Type];
      if (typeFilter) {
        // Support partial matching (e.g., 'order' matches 'order.placed')
        if (!actType.startsWith(typeFilter)) continue;
      }

      const activity = {};
      Object.keys(indices).forEach(col => {
        activity[col] = row[indices[col]];
      });

      // Parse details JSON
      if (activity.sca_Details && typeof activity.sca_Details === 'string') {
        try {
          activity.sca_Details = JSON.parse(activity.sca_Details);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }

      activities.push(activity);
    }

    // Sort by timestamp descending
    activities.sort((a, b) => {
      const dateA = a.sca_Timestamp instanceof Date ? a.sca_Timestamp : new Date(a.sca_Timestamp);
      const dateB = b.sca_Timestamp instanceof Date ? b.sca_Timestamp : new Date(b.sca_Timestamp);
      return dateB - dateA;
    });

    return activities;
  }

  /**
   * Gets all activities from the activity sheet.
   * Used for backfill deduplication checks.
   * @returns {Array<Object>} All activity records
   */
  function getAllActivities() {
    const sheet = _getActivitySheet();
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const indices = _getActivityColumnIndices();
    const activities = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const activity = {};
      Object.keys(indices).forEach(col => {
        activity[col] = row[indices[col]];
      });
      activities.push(activity);
    }

    return activities;
  }

  /**
   * Refreshes calculated fields for all contacts.
   * Run during daily housekeeping.
   */
  function refreshAllContacts() {
    const fnName = 'refreshAllContacts';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting contact refresh');

    const sheet = _getContactsSheet();
    if (!sheet) {
      LoggerService.warn(SERVICE_NAME, fnName, 'SysContacts sheet not found');
      return;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      LoggerService.info(SERVICE_NAME, fnName, 'No contacts to refresh');
      return;
    }

    const indices = _getContactColumnIndices();
    const today = new Date();
    let updateCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let changed = false;

      // Calculate days since last order
      const lastOrderDate = row[indices.sc_LastOrderDate];
      if (lastOrderDate) {
        const daysSince = Math.floor((today - new Date(lastOrderDate)) / (1000 * 60 * 60 * 24));
        if (row[indices.sc_DaysSinceOrder] !== daysSince) {
          row[indices.sc_DaysSinceOrder] = daysSince;
          changed = true;
        }

        // Update lifecycle status
        const newStatus = _calculateLifecycleStatus(daysSince);
        if (row[indices.sc_LifecycleStatus] !== newStatus) {
          // Log status change activity
          const oldStatus = row[indices.sc_LifecycleStatus];
          if (oldStatus && oldStatus !== newStatus) {
            createActivity({
              sca_Email: row[indices.sc_Email],
              sca_Type: 'status.changed',
              sca_Summary: `Status: ${oldStatus} → ${newStatus}`,
              sca_Details: { from: oldStatus, to: newStatus }
            });
          }
          row[indices.sc_LifecycleStatus] = newStatus;
          changed = true;
        }
      }

      // Calculate days subscribed
      const subscribedDate = row[indices.sc_SubscribedDate];
      if (subscribedDate) {
        const daysSubscribed = Math.floor((today - new Date(subscribedDate)) / (1000 * 60 * 60 * 24));
        if (row[indices.sc_DaysSubscribed] !== daysSubscribed) {
          row[indices.sc_DaysSubscribed] = daysSubscribed;
          changed = true;
        }
      }

      // Warn if sc_IsCore is not set for customers (should be set by ContactImportService)
      // DO NOT default sc_IsCore here - it must be calculated from order analysis during import
      const currentIsCore = row[indices.sc_IsCore];
      if (currentIsCore === '' || currentIsCore === null || currentIsCore === undefined) {
        const isCustomer = row[indices.sc_IsCustomer] === true || row[indices.sc_IsCustomer] === 'TRUE';
        if (isCustomer) {
          const email = row[indices.sc_Email] || 'unknown';
          LoggerService.warn(SERVICE_NAME, fnName,
            `Contact ${email} is customer but sc_IsCore not set - run import to fix`);
        }
      }

      // Recalculate customer type (uses sc_IsCore, so must be after IsCore defaulting)
      const contact = {};
      Object.keys(indices).forEach(col => contact[col] = row[indices[col]]);
      const newType = _classifyCustomerType(contact);
      if (row[indices.sc_CustomerType] !== newType) {
        const oldType = row[indices.sc_CustomerType];
        if (oldType && oldType !== newType) {
          createActivity({
            sca_Email: row[indices.sc_Email],
            sca_Type: 'type.changed',
            sca_Summary: `Type: ${oldType} → ${newType}`,
            sca_Details: { from: oldType, to: newType }
          });
        }
        row[indices.sc_CustomerType] = newType;
        changed = true;
      }

      // Recalculate churn risk
      const newRisk = _calculateChurnRisk(contact);
      if (row[indices.sc_ChurnRisk] !== newRisk) {
        row[indices.sc_ChurnRisk] = newRisk;
        changed = true;
      }

      // Recalculate next order expected
      const nextExpected = _calculateNextOrderExpected(contact);
      if (nextExpected) {
        row[indices.sc_NextOrderExpected] = nextExpected;
        changed = true;
      }

      if (changed) {
        row[indices.sc_LastUpdated] = today;
        updateCount++;
      }
    }

    // Write all changes back
    if (updateCount > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      LoggerService.info(SERVICE_NAME, fnName, `Refreshed ${updateCount} contacts`);
    }

    clearCache();
  }

  /**
   * Removes duplicate contacts, keeping the most complete record for each email.
   * @returns {Object} Results with count of duplicates removed
   */
  function deduplicateContacts() {
    const fnName = 'deduplicateContacts';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting contact deduplication');

    const sheet = _getContactsSheet();
    const indices = _getContactColumnIndices();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Group rows by email
    const emailGroups = new Map();
    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][indices.sc_Email] || '').toLowerCase().trim();
      if (!email) continue;

      if (!emailGroups.has(email)) {
        emailGroups.set(email, []);
      }
      emailGroups.get(email).push({ rowIndex: i, data: data[i] });
    }

    // Find duplicates and pick best record
    const rowsToDelete = [];
    let duplicateCount = 0;

    emailGroups.forEach((rows, email) => {
      if (rows.length <= 1) return;

      duplicateCount += rows.length - 1;

      // Score each row by completeness (non-empty fields)
      rows.forEach(row => {
        row.score = row.data.filter(cell => cell !== '' && cell !== null && cell !== undefined).length;
        // Bonus for having order data
        if (row.data[indices.sc_OrderCount] > 0) row.score += 10;
        if (row.data[indices.sc_FirstOrderDate]) row.score += 5;
      });

      // Sort by score descending - keep the best one
      rows.sort((a, b) => b.score - a.score);

      // Mark all but the best for deletion
      for (let i = 1; i < rows.length; i++) {
        rowsToDelete.push(rows[i].rowIndex);
      }
    });

    // Delete rows from bottom up to preserve indices
    rowsToDelete.sort((a, b) => b - a);
    rowsToDelete.forEach(rowIndex => {
      sheet.deleteRow(rowIndex + 1); // +1 because sheet rows are 1-based
    });

    clearCache();
    LoggerService.info(SERVICE_NAME, fnName, `Removed ${duplicateCount} duplicates from ${emailGroups.size} unique emails`);
    return { duplicatesRemoved: duplicateCount, uniqueEmails: emailGroups.size };
  }

  /**
   * Corrects contact data for IsCore/CustomerType consistency.
   * Re-analyzes order history to fix gift/war-support classification.
   * @returns {Object} Result with correction counts
   */
  function correctContactData() {
    const fnName = 'correctContactData';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting contact data correction');

    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheet = SheetAccessor.getDataSpreadsheet();

    // Load contacts
    const contacts = getContacts();
    LoggerService.info(SERVICE_NAME, fnName, `Loaded ${contacts.length} contacts`);

    // Load all orders from WebOrdM and WebOrdM_Archive with required fields
    const womSheet = dataSpreadsheet.getSheetByName(sheetNames.WebOrdM);
    const womaSheet = dataSpreadsheet.getSheetByName(sheetNames.WebOrdM_Archive);

    const ordersByEmail = new Map();

    // Helper to process order rows
    function processOrderSheet(sheet, prefix) {
      if (!sheet || sheet.getLastRow() <= 1) return;
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idx = {};
      headers.forEach((h, i) => { idx[h] = i; });

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const emailField = prefix === 'wom_' ? 'wom_BillingEmail' : 'woma_BillingEmail';
        const email = String(row[idx[emailField]] || '').toLowerCase().trim();
        if (!email) continue;

        const order = {
          billingLastName: row[idx[prefix + 'BillingLastName']] || '',
          shippingLastName: row[idx[prefix + 'ShippingLastName']] || '',
          customerNote: row[idx[prefix + 'CustomerNote']] || '',
          couponItems: row[idx[prefix + 'CouponItems']] || ''
        };

        if (!ordersByEmail.has(email)) {
          ordersByEmail.set(email, []);
        }
        ordersByEmail.get(email).push(order);
      }
    }

    processOrderSheet(womSheet, 'wom_');
    processOrderSheet(womaSheet, 'woma_');
    LoggerService.info(SERVICE_NAME, fnName, `Loaded orders for ${ordersByEmail.size} unique emails`);

    let corrected = 0;
    let checked = 0;
    const corrections = [];

    for (const contact of contacts) {
      if (!contact.sc_IsCustomer) continue;
      checked++;

      const email = String(contact.sc_Email || '').toLowerCase().trim();
      const customerOrders = ordersByEmail.get(email) || [];
      if (customerOrders.length === 0) continue;

      // Re-analyze with corrected logic
      let giftCount = 0;
      let warSupportCount = 0;

      for (const order of customerOrders) {
        if (_isGiftOrder(order)) giftCount++;
        const coupons = _extractCoupons(order.couponItems);
        if (_hasWarSupportCoupon(coupons)) warSupportCount++;
      }

      // Determine correct IsCore value
      const allGifts = giftCount === customerOrders.length && giftCount > 0;
      const allWarSupport = warSupportCount === customerOrders.length && warSupportCount > 0;
      const shouldBeCore = !allGifts && !allWarSupport;

      const currentIsCore = contact.sc_IsCore === true || contact.sc_IsCore === 'TRUE';

      // Check for mismatch
      if (currentIsCore !== shouldBeCore) {
        contact.sc_IsCore = shouldBeCore;
        contact.sc_CustomerType = _classifyCustomerType(contact);

        upsertContact(contact);
        corrected++;
        corrections.push({
          email: contact.sc_Email,
          oldIsCore: currentIsCore,
          newIsCore: shouldBeCore,
          newType: contact.sc_CustomerType,
          orders: customerOrders.length,
          gifts: giftCount,
          warSupport: warSupportCount
        });

        LoggerService.info(SERVICE_NAME, fnName,
          `Fixed ${contact.sc_Email}: IsCore=${shouldBeCore}, Type=${contact.sc_CustomerType}`);
      }
    }

    LoggerService.info(SERVICE_NAME, fnName,
      `Correction complete: ${corrected} fixed out of ${checked} customers checked`);

    return {
      checked: checked,
      corrected: corrected,
      corrections: corrections.slice(0, 20) // Return first 20 for display
    };
  }

  // Public API
  return {
    clearCache: clearCache,
    getContactByEmail: getContactByEmail,
    getContacts: getContacts,
    getStats: getStats,
    upsertContact: upsertContact,
    batchUpsertContacts: batchUpsertContacts,
    createActivity: createActivity,
    getActivities: getActivities,
    getAllActivities: getAllActivities,
    refreshAllContacts: refreshAllContacts,
    deduplicateContacts: deduplicateContacts,
    formatPhoneForWhatsApp: formatPhoneForWhatsApp,
    correctContactData: correctContactData,
    // Expose for import services
    _extractCoupons: _extractCoupons,
    _hasWarSupportCoupon: _hasWarSupportCoupon,
    _isGiftOrder: _isGiftOrder,
    _classifyCustomerType: _classifyCustomerType,
    _calculateLifecycleStatus: _calculateLifecycleStatus
  };
})();

/**
 * Global function to deduplicate contacts.
 */
function runContactDeduplication() {
  return ContactService.deduplicateContacts();
}

/**
 * Global function to refresh all contact calculated fields.
 * Updates DaysSinceOrder, LifecycleStatus, CustomerType, ChurnRisk, etc.
 */
function runContactRefresh() {
  ContactService.refreshAllContacts();
  return 'Contact refresh completed';
}

/**
 * Global function to run CRM validation rules.
 * Runs the master_master validation suite and returns CRM-related results.
 */
function runCrmValidation() {
  const fnName = 'runCrmValidation';
  const sessionId = 'crm_validation_' + Date.now();

  LoggerService.info('ContactService', fnName, 'Starting CRM validation...');
  const result = ValidationLogic.runValidationSuite('master_master', sessionId);
  LoggerService.info('ContactService', fnName, `Validation complete: ${result.results.length} total rules`);

  // Filter to CRM-related rules
  const crmResults = result.results.filter(r =>
    r.ruleId && r.ruleId.includes('.crm.')
  );

  const failures = crmResults.filter(r => r.status === 'FAILED');
  LoggerService.info('ContactService', fnName, `CRM: ${crmResults.length} rules, ${failures.length} failures`);

  return {
    suite: 'master_master',
    totalRules: result.results.length,
    crmRules: crmResults.length,
    crmPassed: crmResults.filter(r => r.status === 'PASSED').length,
    crmFailed: failures.length,
    failures: failures.map(f => ({
      rule: f.ruleId,
      message: f.message,
      failedItems: f.failedItems ? f.failedItems.slice(0, 10) : []
    }))
  };
}

/**
 * Global function to correct contact data for Bug 7.
 * Re-analyzes order history to fix IsCore/CustomerType mismatches.
 */
function runContactDataCorrection() {
  return ContactService.correctContactData();
}
