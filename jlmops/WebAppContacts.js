/**
 * @file WebAppContacts.js
 * @description Data provider for CRM Contact views.
 * Provides functions for the Admin Contacts UI.
 */

/**
 * Gets contact list data for the admin view.
 * @param {Object} filters - Optional filters
 * @returns {Object} Contact list data with stats
 */
function WebAppContacts_getContactList(filters = {}) {
  try {
    LoggerService.info('WebAppContacts', 'getContactList', 'Loading contacts...');
    const contacts = ContactService.getContacts(filters);
    LoggerService.info('WebAppContacts', 'getContactList', `Loaded ${contacts.length} contacts`);
    LoggerService.info('WebAppContacts', 'getContactList', 'Getting stats...');
    const stats = ContactService.getStats();
    LoggerService.info('WebAppContacts', 'getContactList', `Got stats: ${JSON.stringify(stats).substring(0, 200)}`);
    LoggerService.info('WebAppContacts', 'getContactList', 'Formatting contacts...');

    // Safe date formatter
    function formatDate(val) {
      if (!val) return '';
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } catch (e) {
        return '';
      }
    }

    // Format contacts for display with per-contact error handling
    const formatted = [];
    for (let i = 0; i < contacts.length; i++) {
      try {
        const c = contacts[i];
        formatted.push({
          email: c.sc_Email || '',
          name: c.sc_Name || (c.sc_Email ? c.sc_Email.split('@')[0] : ''),
          phone: c.sc_Phone || '',
          city: c.sc_City || '',
          type: c.sc_CustomerType || 'unknown',
          status: c.sc_LifecycleStatus || 'Unknown',
          isCore: c.sc_IsCore || false,
          isSubscribed: c.sc_IsSubscribed || false,
          orderCount: c.sc_OrderCount || 0,
          totalSpend: c.sc_TotalSpend || 0,
          avgOrder: c.sc_AvgOrderValue || 0,
          daysSince: c.sc_DaysSinceOrder || null,
          lastOrderDate: formatDate(c.sc_LastOrderDate),
          churnRisk: c.sc_ChurnRisk || 'unknown',
          language: c.sc_Language || 'en'
        });
      } catch (formatError) {
        LoggerService.warn('WebAppContacts', 'getContactList', `Error formatting contact ${i}: ${formatError.message}`);
      }
    }
    LoggerService.info('WebAppContacts', 'getContactList', `Formatted ${formatted.length} contacts`);

    // Sort by last order date desc by default
    formatted.sort((a, b) => {
      if (!a.lastOrderDate) return 1;
      if (!b.lastOrderDate) return -1;
      return b.lastOrderDate.localeCompare(a.lastOrderDate);
    });

    const result = {
      contacts: formatted,
      stats: stats,
      filters: _getFilterOptions()
    };

    // Force clean serialization to avoid Date object issues
    LoggerService.info('WebAppContacts', 'getContactList', 'Serializing result...');
    const serialized = JSON.parse(JSON.stringify(result));
    LoggerService.info('WebAppContacts', 'getContactList', `Returning ${serialized.contacts.length} contacts`);
    return serialized;
  } catch (e) {
    LoggerService.error('WebAppContacts', 'getContactList', e.message, e);
    return { error: e.message };
  }
}

/**
 * Gets contact detail with activity history.
 * @param {string} email - Contact email
 * @returns {Object} Contact detail data
 */
function WebAppContacts_getContactDetail(email) {
  try {
    const contact = ContactService.getContactByEmail(email);
    if (!contact) {
      return { error: 'Contact not found' };
    }

    const activities = ContactService.getActivities(email);

    // Format for display
    const detail = {
      email: contact.sc_Email,
      name: contact.sc_Name || '',
      phone: contact.sc_Phone || '',
      whatsappPhone: contact.sc_WhatsAppPhone || ContactService.formatPhoneForWhatsApp(contact.sc_Phone),
      city: contact.sc_City || '',
      country: contact.sc_Country || 'IL',
      language: contact.sc_Language || 'en',
      type: contact.sc_CustomerType || 'unknown',
      typeLabel: _getTypeLabel(contact.sc_CustomerType),
      status: contact.sc_LifecycleStatus || 'Unknown',
      isCore: contact.sc_IsCore,
      isCustomer: contact.sc_IsCustomer,
      isSubscribed: contact.sc_IsSubscribed,
      // Order metrics
      orderCount: contact.sc_OrderCount || 0,
      totalSpend: contact.sc_TotalSpend || 0,
      avgOrderValue: contact.sc_AvgOrderValue || 0,
      avgBottles: contact.sc_AvgBottlesPerOrder || 0,
      firstOrderDate: contact.sc_FirstOrderDate ? Utilities.formatDate(new Date(contact.sc_FirstOrderDate), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      lastOrderDate: contact.sc_LastOrderDate ? Utilities.formatDate(new Date(contact.sc_LastOrderDate), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      daysSinceOrder: contact.sc_DaysSinceOrder,
      // Subscription
      subscribedDate: contact.sc_SubscribedDate ? Utilities.formatDate(new Date(contact.sc_SubscribedDate), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      daysSubscribed: contact.sc_DaysSubscribed || 0,
      subscriptionSource: contact.sc_SubscriptionSource || '',
      // Engagement
      lastContactDate: contact.sc_LastContactDate ? Utilities.formatDate(new Date(contact.sc_LastContactDate), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      lastContactType: contact.sc_LastContactType || '',
      churnRisk: contact.sc_ChurnRisk || 'unknown',
      // Preferences - dual language (_En for admin UI, _He available)
      preferredCategory: contact.sc_FrequentCategories_En ? contact.sc_FrequentCategories_En.split(',')[0]?.trim() : '',
      secondaryCategory: contact.sc_FrequentCategories_En ? contact.sc_FrequentCategories_En.split(',')[1]?.trim() : '',
      frequentCategories: contact.sc_FrequentCategories_En || '',
      frequentCategoriesHe: contact.sc_FrequentCategories_He || '',
      priceRange: contact.sc_PriceMin && contact.sc_PriceMax ? `₪${contact.sc_PriceMin}-${contact.sc_PriceMax}` : '',
      bundleBuyer: contact.sc_BundleBuyer || false,
      topWineries: contact.sc_TopWineries_En || '',
      topWineriesHe: contact.sc_TopWineries_He || '',
      topRedGrapes: contact.sc_TopRedGrapes_En || '',
      topRedGrapesHe: contact.sc_TopRedGrapes_He || '',
      topWhiteGrapes: contact.sc_TopWhiteGrapes_En || '',
      topWhiteGrapesHe: contact.sc_TopWhiteGrapes_He || '',
      kashrutPrefs: contact.sc_KashrutPrefs_En || '',
      kashrutPrefsHe: contact.sc_KashrutPrefs_He || '',
      // Red wine preferences - ensure string type (sheet may store as other types)
      redComplexityRange: String(contact.sc_RedComplexityRange || ''),
      redIntensityRange: String(contact.sc_RedIntensityRange || ''),
      // White wine preferences
      whiteComplexityRange: String(contact.sc_WhiteComplexityRange || ''),
      whiteAcidityRange: String(contact.sc_WhiteAcidityRange || ''),
      // Notes
      tags: contact.sc_Tags || '',
      notes: contact.sc_Notes || '',
      // Activity - format all records (no limit)
      activities: activities.map(a => {
        let timestamp = '';
        try {
          if (a.sca_Timestamp) {
            timestamp = Utilities.formatDate(new Date(a.sca_Timestamp), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
          }
        } catch (e) {
          timestamp = '';
        }
        // Ensure details is serializable (could be JSON object)
        let details = a.sca_Details || '';
        if (typeof details === 'object') {
          try {
            details = JSON.stringify(details);
          } catch (e) {
            details = '';
          }
        }
        return {
          id: a.sca_ActivityId || '',
          timestamp: timestamp,
          type: a.sca_Type || '',
          summary: a.sca_Summary || '',
          details: details,
          createdBy: a.sca_CreatedBy || ''
        };
      })
    };

    // Force clean serialization to avoid Date object issues
    return JSON.parse(JSON.stringify(detail));
  } catch (e) {
    LoggerService.error('WebAppContacts', 'getContactDetail', e.message, e);
    return { error: e.message };
  }
}

/**
 * Logs a manual activity for a contact.
 * @param {string} email - Contact email
 * @param {string} type - Activity type
 * @param {string} summary - Activity summary
 * @param {string} details - Additional details (optional)
 * @returns {Object} Result
 */
function WebAppContacts_logActivity(email, type, summary, details) {
  try {
    const activityId = ContactService.createActivity({
      sca_Email: email,
      sca_Timestamp: new Date(),
      sca_Type: type,
      sca_Summary: summary,
      sca_Details: details || '',
      sca_CreatedBy: 'admin'
    });

    // Update last contact date
    const contact = ContactService.getContactByEmail(email);
    if (contact) {
      contact.sc_LastContactDate = new Date();
      contact.sc_LastContactType = type;
      ContactService.upsertContact(contact);
    }

    return { success: true, activityId: activityId };
  } catch (e) {
    LoggerService.error('WebAppContacts', 'logActivity', e.message, e);
    return { error: e.message };
  }
}

/**
 * Sends an email to a contact and logs the activity.
 * @param {string} email - Contact email
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text)
 * @returns {Object} Result with activityId
 */
function WebAppContacts_sendEmail(email, subject, body) {
  try {
    // Send email via GmailApp
    GmailApp.sendEmail(email, subject, body);

    // Log the activity
    const activityId = ContactService.createActivity({
      sca_Email: email,
      sca_Timestamp: new Date(),
      sca_Type: 'contact.email',
      sca_Summary: `Sent: ${subject}`,
      sca_Details: body,
      sca_CreatedBy: 'admin'
    });

    return { success: true, activityId: activityId };
  } catch (e) {
    LoggerService.error('WebAppContacts', 'sendEmail', e.message, e);
    return { error: e.message };
  }
}

/**
 * Updates contact notes or tags.
 * @param {string} email - Contact email
 * @param {Object} updates - Fields to update (notes, tags)
 * @returns {Object} Result
 */
function WebAppContacts_updateContact(email, updates) {
  try {
    const contact = ContactService.getContactByEmail(email);
    if (!contact) {
      return { error: 'Contact not found' };
    }

    if (updates.notes !== undefined) contact.sc_Notes = updates.notes;
    if (updates.tags !== undefined) contact.sc_Tags = updates.tags;

    ContactService.upsertContact(contact);
    return { success: true };
  } catch (e) {
    LoggerService.error('WebAppContacts', 'updateContact', e.message, e);
    return { error: e.message };
  }
}

/**
 * Creates a task for a contact.
 * @param {string} email - Contact email
 * @param {string} taskType - Task type ID
 * @param {string} title - Task title
 * @param {string} notes - Task notes
 * @returns {Object} Result with task ID
 */
function WebAppContacts_createTask(email, taskType, title, notes) {
  try {
    const contact = ContactService.getContactByEmail(email);
    const contactName = contact ? contact.sc_Name : email;

    const taskId = TaskService.createTask(
      taskType,
      email,
      contactName,
      title,
      notes,
      null
    );

    // Log activity
    ContactService.createActivity({
      sca_Email: email,
      sca_Timestamp: new Date(),
      sca_Type: 'task.created',
      sca_Summary: `Task created: ${title}`,
      sca_Details: { taskId: taskId, taskType: taskType },
      sca_CreatedBy: 'admin'
    });

    return { success: true, taskId: taskId };
  } catch (e) {
    LoggerService.error('WebAppContacts', 'createTask', e.message, e);
    return { error: e.message };
  }
}

/**
 * Gets WhatsApp link for a contact.
 * @param {string} email - Contact email
 * @param {string} message - Optional pre-filled message
 * @returns {Object} WhatsApp URL
 */
function WebAppContacts_getWhatsAppLink(email, message) {
  try {
    const contact = ContactService.getContactByEmail(email);
    if (!contact) {
      return { error: 'Contact not found' };
    }

    const phone = contact.sc_WhatsAppPhone || ContactService.formatPhoneForWhatsApp(contact.sc_Phone);
    if (!phone) {
      return { error: 'No valid phone number' };
    }

    let url = `https://wa.me/${phone.replace('+', '')}`;
    if (message) {
      url += `?text=${encodeURIComponent(message)}`;
    }

    return { success: true, url: url, phone: phone };
  } catch (e) {
    LoggerService.error('WebAppContacts', 'getWhatsAppLink', e.message, e);
    return { error: e.message };
  }
}

/**
 * Gets filter options for the contact list.
 */
function _getFilterOptions() {
  return {
    types: [
      { value: 'core.vip', label: 'VIP' },
      { value: 'core.repeat', label: 'Repeat' },
      { value: 'core.new', label: 'New Customer' },
      { value: 'noncore.gift', label: 'Gift Recipient' },
      { value: 'noncore.support', label: 'Support Order' },
      { value: 'prospect.subscriber', label: 'Subscriber' },
      { value: 'prospect.fresh', label: 'Fresh Prospect' }
    ],
    statuses: [
      { value: 'Active', label: 'Active' },
      { value: 'Recent', label: 'Recent' },
      { value: 'Cooling', label: 'Cooling' },
      { value: 'Lapsed', label: 'Lapsed' },
      { value: 'Dormant', label: 'Dormant' },
      { value: 'Prospect', label: 'Prospect' }
    ],
    languages: [
      { value: 'en', label: 'English' },
      { value: 'he', label: 'Hebrew' }
    ]
  };
}

/**
 * Hebrew to English category translation map.
 */
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
 * Translates a Hebrew category to English.
 * @param {string} category - Category name (possibly Hebrew)
 * @returns {string} English category name
 */
function _translateCategory(category) {
  if (!category) return '';
  return CATEGORY_TRANSLATIONS[category] || category;
}

/**
 * Formats a min-max range or average value for display.
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} avg - Average value (fallback if min/max not available)
 * @returns {string} Formatted range like "2-4" or "3" or empty string
 */
function _formatRange(min, max, avg) {
  if (min && max && min !== max) {
    return `${min}-${max}`;
  }
  if (min && max && min === max) {
    return String(min);
  }
  if (avg) {
    return String(Math.round(avg));
  }
  return '';
}

/**
 * Gets human-readable label for customer type.
 */
function _getTypeLabel(type) {
  const labels = {
    'core.vip': 'VIP Customer',
    'core.repeat': 'Repeat Customer',
    'core.new': 'New Customer',
    'noncore.gift': 'Gift Recipient',
    'noncore.support': 'Support Order',
    'prospect.subscriber': 'Newsletter Subscriber',
    'prospect.fresh': 'New Subscriber',
    'prospect.stale': 'Inactive Subscriber'
  };
  return labels[type] || type || 'Unknown';
}

// =============================================
// CAMPAIGN EXPORT FUNCTIONS
// =============================================

/**
 * Gets audience breakdown for current filters.
 * @param {Object} filters - Current filter state
 * @returns {Object} Audience breakdown stats
 */
function WebAppContacts_getAudienceBreakdown(filters = {}) {
  try {
    const contacts = ContactService.getContacts(filters);

    const breakdown = {
      total: contacts.length,
      byType: { vip: 0, repeat: 0, new: 0, prospect: 0, noncore: 0 },
      byLanguage: { en: 0, he: 0 },
      bySubscription: { subscribed: 0, notSubscribed: 0 },
      byStatus: {}
    };

    contacts.forEach(c => {
      // By type
      const type = c.sc_CustomerType || '';
      if (type.includes('vip')) breakdown.byType.vip++;
      else if (type.includes('repeat')) breakdown.byType.repeat++;
      else if (type.includes('new')) breakdown.byType.new++;
      else if (type.includes('prospect')) breakdown.byType.prospect++;
      else if (type.includes('noncore')) breakdown.byType.noncore++;

      // By language
      const lang = (c.sc_Language || 'en').toLowerCase();
      if (lang === 'he') breakdown.byLanguage.he++;
      else breakdown.byLanguage.en++;

      // By subscription
      if (c.sc_IsSubscribed) breakdown.bySubscription.subscribed++;
      else breakdown.bySubscription.notSubscribed++;

      // By status
      const status = c.sc_LifecycleStatus || 'Unknown';
      breakdown.byStatus[status] = (breakdown.byStatus[status] || 0) + 1;
    });

    return breakdown;
  } catch (e) {
    LoggerService.error('WebAppContacts', 'getAudienceBreakdown', e.message, e);
    return { error: e.message };
  }
}

/**
 * Gets CAMPAIGN projects for dropdown.
 * @returns {Object} { projects: Array }
 */
function WebAppContacts_getProjects() {
  try {
    const projects = ProjectService.getProjectsByType('CAMPAIGN');

    // Filter to active/planning only and format for dropdown
    const formatted = projects
      .filter(p => {
        const status = p.status || p.spro_Status;
        return status === 'ACTIVE' || status === 'PLANNING';
      })
      .map(p => ({
        id: p.projectid || p.spro_ProjectId,
        name: p.name || p.spro_Name,
        status: p.status || p.spro_Status
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { projects: formatted };
  } catch (e) {
    LoggerService.error('WebAppContacts', 'getProjects', e.message, e);
    return { error: e.message };
  }
}

/**
 * Creates a new campaign project.
 * @param {string} name - Project name
 * @returns {Object} { project } or { error }
 */
function WebAppContacts_createProject(name) {
  try {
    if (!name || !name.trim()) {
      return { error: 'Project name is required' };
    }

    const project = ProjectService.createProject({
      name: name.trim(),
      type: 'CAMPAIGN',
      status: 'ACTIVE'
    });

    return {
      project: {
        id: project.spro_ProjectId,
        name: project.spro_Name,
        status: project.spro_Status
      }
    };
  } catch (e) {
    LoggerService.error('WebAppContacts', 'createProject', e.message, e);
    return { error: e.message };
  }
}

/**
 * Exports audience to Google Sheet.
 * @param {Object} options - Export options
 * @returns {Object} Export result
 */
function WebAppContacts_exportAudience(options) {
  try {
    LoggerService.info('WebAppContacts', 'exportAudience', `Options: ${JSON.stringify(options)}`);

    // Build filter options from UI filters
    const filters = {};

    if (options.filters) {
      if (options.filters.customerType) {
        filters.customerType = [options.filters.customerType];
      }
      if (options.filters.lifecycleStatus) {
        filters.lifecycleStatus = [options.filters.lifecycleStatus];
      }
      if (options.filters.language) {
        filters.language = options.filters.language;
      }
      if (options.filters.isSubscribed !== undefined) {
        filters.isSubscribed = options.filters.isSubscribed;
      }
    }

    // Build export options
    const exportOptions = {
      filters: filters,
      campaignCode: options.campaignCode || '',
      projectId: options.projectId || null,
      dataGroups: {
        preferences: options.includePreferences || false,
        purchaseBehavior: options.includePurchaseBehavior || false
      },
      tags: {
        category: options.tagCategory || false,
        priceTier: options.tagPriceTier || false,
        winery: options.tagWinery || false,
        status: options.tagStatus || false,
        campaign: options.tagCampaign || false
      },
      additionalTags: options.additionalTags || ''
    };

    const result = CampaignService.exportAudienceToSheet(exportOptions);

    return result;
  } catch (e) {
    LoggerService.error('WebAppContacts', 'exportAudience', e.message, e);
    return { error: e.message };
  }
}

/**
 * Filter contacts for Year in Wine campaign.
 * Returns list of emails that qualify based on year spend.
 *
 * @param {Object} options - Filter options
 * @param {number} options.year - Year to check (default 2025)
 * @param {number} options.minSpend - Minimum spend for year (default 1000)
 * @returns {Object} Result with emails array
 */
function WebAppContacts_filterYearInWine(options = {}) {
  try {
    LoggerService.info('WebAppContacts', 'filterYearInWine', `Options: ${JSON.stringify(options)}`);
    return filterYearInWine(options);
  } catch (e) {
    LoggerService.error('WebAppContacts', 'filterYearInWine', e.message, e);
    return { error: e.message };
  }
}

/**
 * Export Year in Wine data.
 * Creates spreadsheet with:
 * - Mailchimp sheet (preferences, referral codes, reward tiers) - split by language
 * - Coupons sheet (WooCommerce import format)
 *
 * @param {Object} options - Export options
 * @param {number} options.year - Year to export (default 2025)
 * @param {number} options.minSpend - Minimum spend (default 1000)
 * @param {string} options.couponExpiry - Expiry date YYYY-MM-DD (default 2026-02-01)
 * @param {number} options.couponAmount - Discount amount (default 50)
 * @param {boolean} options.testMode - Skip task creation (default false)
 * @returns {Object} Result with spreadsheetUrl and counts
 */
function WebAppContacts_exportYearInWine2025(options = {}) {
  try {
    LoggerService.info('WebAppContacts', 'exportYearInWine2025', `Options: ${JSON.stringify(options)}`);
    return exportYearInWine2025(options);
  } catch (e) {
    LoggerService.error('WebAppContacts', 'exportYearInWine2025', e.message, e);
    return { error: e.message };
  }
}
