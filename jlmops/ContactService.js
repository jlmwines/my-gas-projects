/**
 * @file ContactService.js
 * @description Service for managing CRM contacts. Handles import from orders and Mailchimp,
 * metric calculation, customer classification, and activity logging.
 */

const ContactService = (function () {
  const SERVICE_NAME = 'ContactService';

  // War-support coupon codes (lowercase)
  const WAR_SUPPORT_COUPONS = ['efrat', 'roshtzurim', 'gushwarriors', 'gush', 'tekoa'];

  // Lifecycle status thresholds (days since last order)
  const LIFECYCLE_THRESHOLDS = {
    ACTIVE: 30,
    RECENT: 90,
    COOLING: 180,
    LAPSED: 365
  };

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
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    return spreadsheet.getSheetByName(sheetNames.SysContacts);
  }

  /**
   * Gets the SysContactActivity sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getActivitySheet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    return spreadsheet.getSheetByName(sheetNames.SysContactActivity);
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

  /**
   * Determines if an order appears to be a gift (different billing/shipping).
   * @param {Object} order - Order object with billing/shipping fields
   * @returns {boolean}
   */
  function _isGiftOrder(order) {
    // Different countries
    if (order.billingCountry && order.shippingCountry &&
        order.billingCountry !== order.shippingCountry) {
      return true;
    }

    // Different last names (fuzzy)
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
    return coupons.some(c =>
      WAR_SUPPORT_COUPONS.some(w => c.code.toLowerCase().includes(w))
    );
  }

  /**
   * Calculates lifecycle status based on days since last order.
   * @param {number} daysSinceOrder - Days since last order
   * @returns {string} Lifecycle status
   */
  function _calculateLifecycleStatus(daysSinceOrder) {
    if (daysSinceOrder === null || daysSinceOrder === undefined) return 'Unknown';
    if (daysSinceOrder <= LIFECYCLE_THRESHOLDS.ACTIVE) return 'Active';
    if (daysSinceOrder <= LIFECYCLE_THRESHOLDS.RECENT) return 'Recent';
    if (daysSinceOrder <= LIFECYCLE_THRESHOLDS.COOLING) return 'Cooling';
    if (daysSinceOrder <= LIFECYCLE_THRESHOLDS.LAPSED) return 'Lapsed';
    return 'Dormant';
  }

  /**
   * Determines customer type based on order count, spend, and flags.
   * @param {Object} contact - Contact object with metrics
   * @returns {string} Customer type
   */
  function _classifyCustomerType(contact) {
    // Non-customers
    if (!contact.sc_IsCustomer) {
      if (!contact.sc_IsSubscribed) return 'prospect.fresh';
      const daysSubscribed = contact.sc_DaysSubscribed || 0;
      if (daysSubscribed < 30) return 'prospect.fresh';
      if (daysSubscribed >= 180) return 'prospect.stale';
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

    // VIP: Top spend OR 5+ orders
    if (orderCount >= 5 || totalSpend >= 3000) {
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

    // Low risk: Recent activity with good engagement
    if (daysSince < 60 && (orderCount > 2 || totalSpend > 1000)) {
      return 'low';
    }

    // High risk: Long gap OR single order + moderate gap
    if (daysSince > 120 || (orderCount === 1 && daysSince > 90)) {
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

    // For repeat customers, use their average interval
    // For single-order, use global median (48 days from analysis)
    let interval;
    if (orderCount >= 2) {
      const firstOrder = contact.sc_FirstOrderDate;
      if (firstOrder && lastOrderDate) {
        const totalDays = Math.floor((lastOrderDate - firstOrder) / (1000 * 60 * 60 * 24));
        interval = Math.round(totalDays / (orderCount - 1));
      } else {
        interval = 48; // Fallback
      }
    } else {
      interval = 48; // Global median
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
      LoggerService.info(SERVICE_NAME, fnName, `Returning ${_contactCache.length} cached contacts`);
      return _contactCache;
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
   * @returns {Object} Updated contact
   */
  function upsertContact(contactData) {
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

    clearCache();
    return contactData;
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

      // Recalculate customer type
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

  // Public API
  return {
    clearCache: clearCache,
    getContactByEmail: getContactByEmail,
    getContacts: getContacts,
    getStats: getStats,
    upsertContact: upsertContact,
    createActivity: createActivity,
    getActivities: getActivities,
    getAllActivities: getAllActivities,
    refreshAllContacts: refreshAllContacts,
    deduplicateContacts: deduplicateContacts,
    formatPhoneForWhatsApp: formatPhoneForWhatsApp,
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
