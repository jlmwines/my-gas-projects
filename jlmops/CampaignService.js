/**
 * @file CampaignService.js
 * @description Service for managing Mailchimp campaign history and performance tracking.
 * Imports campaign data from Mailchimp export and provides analytics.
 */

const CampaignService = (function () {
  const SERVICE_NAME = 'CampaignService';

  // Campaign type detection keywords
  const CAMPAIGN_TYPES = {
    seasonal: ['rosh', 'pesach', 'chanukah', 'purim', 'shavuot', 'sukkot', 'seder', 'year', 'holiday'],
    value: ['value', 'bargain', 'deal', 'sale'],
    explore: ['explore', 'discover', 'new'],
    bundle: ['bundle', 'package'],
    news: ['news', 'update', 'announcement']
  };

  // Cache
  let _campaignCache = null;
  let _cacheTimestamp = null;
  const CACHE_TTL_MS = 60000;

  /**
   * Clears the internal cache.
   */
  function clearCache() {
    _campaignCache = null;
    _cacheTimestamp = null;
  }

  /**
   * Gets the SysCampaigns sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getCampaignsSheet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
    return spreadsheet.getSheetByName(sheetNames.SysCampaigns);
  }

  /**
   * Gets column indices for SysCampaigns sheet.
   * @returns {Object} Map of column names to 0-based indices
   */
  function _getCampaignColumnIndices() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysCampaigns'];
    if (!schema || !schema.headers) {
      throw new Error('Schema for SysCampaigns not found in configuration.');
    }
    const headers = schema.headers.split(',');
    const indices = {};
    headers.forEach((h, i) => indices[h] = i);
    return indices;
  }

  /**
   * Derives campaign type from title.
   * @param {string} title - Campaign title
   * @returns {string} Campaign type
   */
  function _deriveCampaignType(title) {
    const t = (title || '').toLowerCase();

    // Check each type's keywords
    for (const [type, keywords] of Object.entries(CAMPAIGN_TYPES)) {
      if (keywords.some(k => t.includes(k))) {
        return type;
      }
    }

    return 'general';
  }

  /**
   * Parses a Mailchimp date string.
   * Format: "Jun 29, 2021 05:16 pm"
   * @param {string} dateStr - Date string
   * @returns {Date|null}
   */
  function _parseMailchimpDate(dateStr) {
    if (!dateStr) return null;
    try {
      return new Date(dateStr);
    } catch (e) {
      return null;
    }
  }

  /**
   * Parses a percentage string to decimal.
   * Format: "47.54%"
   * @param {string} pctStr - Percentage string
   * @returns {number|null}
   */
  function _parsePercent(pctStr) {
    if (!pctStr || pctStr === 'n/a') return null;
    const num = parseFloat(String(pctStr).replace('%', ''));
    return isNaN(num) ? null : num / 100;
  }

  /**
   * Loads all campaigns into cache.
   * @returns {Array<Object>} Array of campaign objects
   */
  function _loadCampaigns() {
    const now = Date.now();
    if (_campaignCache && _cacheTimestamp && (now - _cacheTimestamp) < CACHE_TTL_MS) {
      return _campaignCache;
    }

    const sheet = _getCampaignsSheet();
    if (!sheet) {
      LoggerService.warn(SERVICE_NAME, '_loadCampaigns', 'SysCampaigns sheet not found');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      _campaignCache = [];
      _cacheTimestamp = now;
      return [];
    }

    const indices = _getCampaignColumnIndices();
    const campaigns = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const campaign = {};
      Object.keys(indices).forEach(col => {
        campaign[col] = row[indices[col]];
      });
      campaigns.push(campaign);
    }

    _campaignCache = campaigns;
    _cacheTimestamp = now;
    return campaigns;
  }

  /**
   * Gets a campaign by ID.
   * @param {string} campaignId - Campaign ID
   * @returns {Object|null} Campaign object or null
   */
  function getCampaignById(campaignId) {
    if (!campaignId) return null;
    const campaigns = _loadCampaigns();
    return campaigns.find(c => c.scm_CampaignId === campaignId) || null;
  }

  /**
   * Gets all campaigns, optionally filtered.
   * @param {Object} filters - Filter criteria
   * @returns {Array<Object>} Filtered campaigns
   */
  function getCampaigns(filters = {}) {
    const campaigns = _loadCampaigns();

    let result = campaigns.filter(c => {
      if (filters.type && c.scm_CampaignType !== filters.type) return false;
      if (filters.year) {
        const sendDate = c.scm_SendDate instanceof Date ? c.scm_SendDate : new Date(c.scm_SendDate);
        if (sendDate.getFullYear() !== filters.year) return false;
      }
      return true;
    });

    // Sort by send date descending by default
    result.sort((a, b) => {
      const dateA = a.scm_SendDate instanceof Date ? a.scm_SendDate : new Date(a.scm_SendDate);
      const dateB = b.scm_SendDate instanceof Date ? b.scm_SendDate : new Date(b.scm_SendDate);
      return dateB - dateA;
    });

    return result;
  }

  /**
   * Creates or updates a campaign record.
   * @param {Object} campaignData - Campaign data with scm_CampaignId required
   * @returns {Object} Updated campaign
   */
  function upsertCampaign(campaignData) {
    if (!campaignData.scm_CampaignId) {
      throw new Error('scm_CampaignId is required for upsert');
    }

    const sheet = _getCampaignsSheet();
    const indices = _getCampaignColumnIndices();
    const headers = Object.keys(indices);
    const data = sheet.getDataRange().getValues();

    // Derive campaign type if not provided
    if (!campaignData.scm_CampaignType && campaignData.scm_Title) {
      campaignData.scm_CampaignType = _deriveCampaignType(campaignData.scm_Title);
    }

    campaignData.scm_LastImported = new Date();

    // Find existing row
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][indices.scm_CampaignId] === campaignData.scm_CampaignId) {
        rowIndex = i;
        break;
      }
    }

    // Build row array
    const rowArray = new Array(headers.length).fill('');
    headers.forEach((h, i) => {
      if (campaignData[h] !== undefined) {
        rowArray[i] = campaignData[h];
      } else if (rowIndex >= 0) {
        rowArray[i] = data[rowIndex][i];
      }
    });

    if (rowIndex >= 0) {
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([rowArray]);
    } else {
      sheet.appendRow(rowArray);
    }

    clearCache();
    return campaignData;
  }

  /**
   * Gets aggregate campaign statistics.
   * @param {Object} options - Options like year filter
   * @returns {Object} Stats object
   */
  function getStats(options = {}) {
    const campaigns = getCampaigns(options);

    if (campaigns.length === 0) {
      return { count: 0 };
    }

    const stats = {
      count: campaigns.length,
      totalRecipients: 0,
      totalDelivered: 0,
      totalOpens: 0,
      totalClicks: 0,
      totalOrders: 0,
      totalRevenue: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      byType: {}
    };

    campaigns.forEach(c => {
      stats.totalRecipients += c.scm_Recipients || 0;
      stats.totalDelivered += c.scm_Delivered || 0;
      stats.totalOpens += c.scm_UniqueOpens || 0;
      stats.totalClicks += c.scm_UniqueClicks || 0;
      stats.totalOrders += c.scm_TotalOrders || 0;
      stats.totalRevenue += c.scm_Revenue || 0;

      const type = c.scm_CampaignType || 'general';
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, revenue: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].revenue += c.scm_Revenue || 0;
    });

    if (stats.totalDelivered > 0) {
      stats.avgOpenRate = Math.round((stats.totalOpens / stats.totalDelivered) * 100);
      stats.avgClickRate = Math.round((stats.totalClicks / stats.totalDelivered) * 100);
    }

    return stats;
  }

  /**
   * Imports campaigns from a Mailchimp campaign export CSV.
   * @param {string} csvContent - CSV content
   * @returns {Object} Import results
   */
  function importFromCsv(csvContent) {
    const fnName = 'importFromCsv';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting campaign import');

    const lines = Utilities.parseCsv(csvContent);
    if (lines.length <= 1) {
      return { imported: 0, errors: ['No data rows found'] };
    }

    const csvHeaders = lines[0];
    const headerMap = {};
    csvHeaders.forEach((h, i) => headerMap[h.trim()] = i);

    // Mapping from Mailchimp export columns to our schema
    const mapping = {
      'Unique Id': 'scm_CampaignId',
      'Title': 'scm_Title',
      'Subject': 'scm_Subject',
      'Send Date': 'scm_SendDate',
      'Send Weekday': 'scm_SendWeekday',
      'Total Recipients': 'scm_Recipients',
      'Successful Deliveries': 'scm_Delivered',
      'Total Bounces': 'scm_Bounces',
      'Unique Opens': 'scm_UniqueOpens',
      'Open Rate': 'scm_OpenRate',
      'Total Opens': 'scm_TotalOpens',
      'Unique Clicks': 'scm_UniqueClicks',
      'Click Rate': 'scm_ClickRate',
      'Total Clicks': 'scm_TotalClicks',
      'Unsubscribes': 'scm_Unsubscribes',
      'Total Orders': 'scm_TotalOrders',
      'Total Gross Sales': 'scm_GrossSales',
      'Total Revenue': 'scm_Revenue'
    };

    let imported = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = lines[i];
        const campaignData = {};

        // Map fields
        Object.keys(mapping).forEach(csvCol => {
          if (headerMap[csvCol] !== undefined) {
            let value = row[headerMap[csvCol]];
            const targetCol = mapping[csvCol];

            // Type conversions
            if (targetCol === 'scm_SendDate') {
              value = _parseMailchimpDate(value);
            } else if (targetCol === 'scm_OpenRate' || targetCol === 'scm_ClickRate') {
              value = _parsePercent(value);
            } else if (['scm_Recipients', 'scm_Delivered', 'scm_Bounces', 'scm_UniqueOpens',
                        'scm_TotalOpens', 'scm_UniqueClicks', 'scm_TotalClicks',
                        'scm_Unsubscribes', 'scm_TotalOrders'].includes(targetCol)) {
              value = parseInt(value, 10) || 0;
            } else if (targetCol === 'scm_GrossSales' || targetCol === 'scm_Revenue') {
              // Handle currency formatting ($1,234.56)
              value = parseFloat(String(value).replace(/[$,]/g, '')) || 0;
            }

            campaignData[targetCol] = value;
          }
        });

        if (campaignData.scm_CampaignId) {
          upsertCampaign(campaignData);
          imported++;
        }
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    LoggerService.info(SERVICE_NAME, fnName, `Imported ${imported} campaigns, ${errors.length} errors`);
    return { imported, errors };
  }

  // =============================================
  // SEGMENT TARGETING FOR CAMPAIGN PLANNING
  // =============================================

  /**
   * Gets contacts matching segment criteria for campaign targeting.
   * @param {Object} options - Targeting options
   * @param {Array<string>} [options.customerType] - Filter by customer types (e.g., ['core.vip', 'core.repeat'])
   * @param {Array<string>} [options.lifecycleStatus] - Filter by lifecycle status (e.g., ['Cooling', 'Lapsed'])
   * @param {string} [options.language] - Filter by language ('en', 'he', or null for all)
   * @param {boolean} [options.hasOrderIn2025] - Filter by whether they ordered in 2025
   * @param {boolean} [options.isSubscribed] - Filter by subscription status
   * @param {Object} [options.preferences] - Filter by preferences
   * @param {Array<string>} [options.preferences.categories] - Must have purchased these categories
   * @param {number} [options.preferences.priceMin] - Minimum price range
   * @param {number} [options.preferences.priceMax] - Maximum price range
   * @param {number} [options.limit] - Maximum contacts to return
   * @param {string} [options.sortBy] - Sort field: 'totalSpend', 'orderCount', 'daysSince', 'lastOrder'
   * @param {string} [options.sortOrder] - 'asc' or 'desc' (default 'desc')
   * @returns {Object} { contacts: Array, stats: Object }
   */
  function getTargetSegment(options = {}) {
    const fnName = 'getTargetSegment';
    LoggerService.info(SERVICE_NAME, fnName, `Getting segment with options: ${JSON.stringify(options)}`);

    // Load all contacts
    const allContacts = ContactService.getContacts();
    LoggerService.info(SERVICE_NAME, fnName, `Loaded ${allContacts.length} total contacts`);

    // Apply filters
    let filtered = allContacts.filter(c => {
      // Customer type filter
      if (options.customerType && options.customerType.length > 0) {
        if (!options.customerType.includes(c.sc_CustomerType)) return false;
      }

      // Lifecycle status filter
      if (options.lifecycleStatus && options.lifecycleStatus.length > 0) {
        if (!options.lifecycleStatus.includes(c.sc_LifecycleStatus)) return false;
      }

      // Language filter
      if (options.language) {
        const contactLang = (c.sc_Language || 'en').toLowerCase();
        if (contactLang !== options.language.toLowerCase()) return false;
      }

      // Subscription filter
      if (options.isSubscribed !== undefined) {
        if (options.isSubscribed && !c.sc_IsSubscribed) return false;
        if (!options.isSubscribed && c.sc_IsSubscribed) return false;
      }

      // 2025 order filter
      if (options.hasOrderIn2025 !== undefined) {
        const lastOrder = c.sc_LastOrderDate;
        let orderedIn2025 = false;
        if (lastOrder) {
          const lastOrderDate = lastOrder instanceof Date ? lastOrder : new Date(lastOrder);
          orderedIn2025 = lastOrderDate.getFullYear() === 2025;
        }
        if (options.hasOrderIn2025 && !orderedIn2025) return false;
        if (!options.hasOrderIn2025 && orderedIn2025) return false;
      }

      // Preference filters
      if (options.preferences) {
        // Category filter
        if (options.preferences.categories && options.preferences.categories.length > 0) {
          const contactCategories = (c.sc_FrequentCategories_En || '').toLowerCase();
          const hasCategory = options.preferences.categories.some(cat =>
            contactCategories.includes(cat.toLowerCase())
          );
          if (!hasCategory) return false;
        }

        // Price range filter
        if (options.preferences.priceMin !== undefined) {
          if ((c.sc_PriceMax || 0) < options.preferences.priceMin) return false;
        }
        if (options.preferences.priceMax !== undefined) {
          if ((c.sc_PriceMin || 999999) > options.preferences.priceMax) return false;
        }
      }

      return true;
    });

    LoggerService.info(SERVICE_NAME, fnName, `After filtering: ${filtered.length} contacts`);

    // Sort
    const sortBy = options.sortBy || 'totalSpend';
    const sortOrder = options.sortOrder || 'desc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'totalSpend':
          valA = a.sc_TotalSpend || 0;
          valB = b.sc_TotalSpend || 0;
          break;
        case 'orderCount':
          valA = a.sc_OrderCount || 0;
          valB = b.sc_OrderCount || 0;
          break;
        case 'daysSince':
          valA = a.sc_DaysSinceOrder || 9999;
          valB = b.sc_DaysSinceOrder || 9999;
          break;
        case 'lastOrder':
          valA = a.sc_LastOrderDate ? new Date(a.sc_LastOrderDate).getTime() : 0;
          valB = b.sc_LastOrderDate ? new Date(b.sc_LastOrderDate).getTime() : 0;
          break;
        default:
          valA = a.sc_TotalSpend || 0;
          valB = b.sc_TotalSpend || 0;
      }
      return (valA - valB) * multiplier;
    });

    // Apply limit
    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    // Calculate stats
    const stats = {
      total: filtered.length,
      byLanguage: { en: 0, he: 0 },
      byType: {},
      byStatus: {},
      totalSpend: 0,
      avgSpend: 0
    };

    filtered.forEach(c => {
      const lang = (c.sc_Language || 'en').toLowerCase();
      stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;

      const type = c.sc_CustomerType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      const status = c.sc_LifecycleStatus || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      stats.totalSpend += c.sc_TotalSpend || 0;
    });

    stats.avgSpend = stats.total > 0 ? Math.round(stats.totalSpend / stats.total) : 0;

    // Format contacts for export
    const contacts = filtered.map(c => ({
      email: c.sc_Email || '',
      name: c.sc_Name || '',
      phone: c.sc_Phone || '',
      language: c.sc_Language || 'en',
      customerType: c.sc_CustomerType || '',
      lifecycleStatus: c.sc_LifecycleStatus || '',
      isSubscribed: c.sc_IsSubscribed || false,
      orderCount: c.sc_OrderCount || 0,
      totalSpend: c.sc_TotalSpend || 0,
      avgOrderValue: c.sc_AvgOrderValue || 0,
      daysSinceOrder: c.sc_DaysSinceOrder || null,
      lastOrderDate: c.sc_LastOrderDate ? _formatDate(c.sc_LastOrderDate) : '',
      firstOrderDate: c.sc_FirstOrderDate ? _formatDate(c.sc_FirstOrderDate) : '',
      frequentCategories: c.sc_FrequentCategories_En || '',
      topWineries: c.sc_TopWineries_En || '',
      priceRange: c.sc_PriceMin && c.sc_PriceMax ? `${c.sc_PriceMin}-${c.sc_PriceMax}` : '',
      churnRisk: c.sc_ChurnRisk || '',
      // Bundle matching hints
      bundleMatches: _calculateBundleMatches(c)
    }));

    LoggerService.info(SERVICE_NAME, fnName, `Returning ${contacts.length} contacts`);
    return { contacts, stats };
  }

  /**
   * Formats a date value to YYYY-MM-DD string.
   * @param {Date|string} dateVal - Date value
   * @returns {string} Formatted date
   */
  function _formatDate(dateVal) {
    if (!dateVal) return '';
    try {
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } catch (e) {
      return '';
    }
  }

  /**
   * Calculates which bundle types match a contact's preferences.
   * @param {Object} contact - Contact object
   * @returns {string} Comma-separated bundle matches
   */
  function _calculateBundleMatches(contact) {
    const matches = [];
    const categories = (contact.sc_FrequentCategories_En || '').toLowerCase();
    const priceMax = contact.sc_PriceMax || 0;

    // Special Reds
    if (categories.includes('dry red')) {
      matches.push('Special Reds');
    }

    // Special Whites/Rosés
    if (categories.includes('dry white') || categories.includes('rosé') || categories.includes('rose')) {
      matches.push('Special Whites/Rosés');
    }

    // Special Variety (3+ categories - check by counting commas)
    const categoryCount = categories ? (categories.match(/,/g) || []).length + 1 : 0;
    if (categoryCount >= 3) {
      matches.push('Special Variety');
    }

    // Premium Value
    if (priceMax >= 150) {
      matches.push('Premium Value');
    }

    return matches.join(', ');
  }

  /**
   * Exports a segment to CSV format.
   * @param {Object} options - Same options as getTargetSegment
   * @returns {string} CSV content
   */
  function exportSegmentToCsv(options = {}) {
    const fnName = 'exportSegmentToCsv';
    const result = getTargetSegment(options);

    if (result.contacts.length === 0) {
      return 'No contacts match the criteria';
    }

    // CSV headers
    const headers = [
      'email', 'name', 'phone', 'language', 'customerType', 'lifecycleStatus',
      'isSubscribed', 'orderCount', 'totalSpend', 'avgOrderValue', 'daysSinceOrder',
      'lastOrderDate', 'firstOrderDate', 'frequentCategories', 'topWineries',
      'priceRange', 'churnRisk', 'bundleMatches'
    ];

    // Build CSV rows
    const rows = [headers.join(',')];

    result.contacts.forEach(c => {
      const row = headers.map(h => {
        let val = c[h];
        if (val === null || val === undefined) val = '';
        val = String(val);
        // Escape commas and quotes
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      });
      rows.push(row.join(','));
    });

    LoggerService.info(SERVICE_NAME, fnName, `Generated CSV with ${result.contacts.length} rows`);
    return rows.join('\n');
  }

  /**
   * Saves segment export to Google Drive.
   * @param {Object} options - Segment options
   * @param {string} fileName - File name (without extension)
   * @returns {Object} { success, fileUrl, fileName, contactCount }
   */
  function saveSegmentExport(options = {}, fileName = null) {
    const fnName = 'saveSegmentExport';
    const csvContent = exportSegmentToCsv(options);

    if (csvContent === 'No contacts match the criteria') {
      return { success: false, error: 'No contacts match the criteria' };
    }

    // Generate file name if not provided
    if (!fileName) {
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm');
      fileName = `segment-export-${timestamp}`;
    }

    // Get export folder
    const allConfig = ConfigService.getAllConfig();
    const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
    const exportFolder = DriveApp.getFolderById(exportFolderId);

    // Create file
    const file = exportFolder.createFile(fileName + '.csv', csvContent, MimeType.CSV);

    LoggerService.info(SERVICE_NAME, fnName, `Saved segment export: ${file.getName()}`);

    return {
      success: true,
      fileUrl: file.getUrl(),
      fileName: file.getName(),
      contactCount: csvContent.split('\n').length - 1 // minus header row
    };
  }

  // Public API
  return {
    clearCache: clearCache,
    getCampaignById: getCampaignById,
    getCampaigns: getCampaigns,
    upsertCampaign: upsertCampaign,
    getStats: getStats,
    importFromCsv: importFromCsv,
    // Segment targeting
    getTargetSegment: getTargetSegment,
    exportSegmentToCsv: exportSegmentToCsv,
    saveSegmentExport: saveSegmentExport,
    // Expose for testing
    _deriveCampaignType: _deriveCampaignType,
    _calculateBundleMatches: _calculateBundleMatches
  };
})();

// =============================================
// GLOBAL FUNCTIONS FOR SEGMENT EXPORT
// =============================================

/**
 * Export Year in Wine segment - all customers with 2025 orders.
 * Saves CSV to exports folder.
 */
function exportYearInWineSegment() {
  return CampaignService.saveSegmentExport({
    hasOrderIn2025: true,
    sortBy: 'totalSpend',
    sortOrder: 'desc'
  }, 'year-in-wine-2025');
}

/**
 * Export Year in Wine subscribers - subscribers without 2025 orders.
 * These get the "We don't have history with you yet" variant.
 */
function exportYearInWineSubscribers() {
  return CampaignService.saveSegmentExport({
    hasOrderIn2025: false,
    isSubscribed: true,
    customerType: ['prospect.subscriber', 'prospect.fresh', 'prospect.stale'],
    sortBy: 'daysSince',
    sortOrder: 'asc'
  }, 'year-in-wine-subscribers');
}

/**
 * Export Comeback segment - lapsed/dormant customers (no 2025 orders).
 */
function exportComebackSegment() {
  return CampaignService.saveSegmentExport({
    hasOrderIn2025: false,
    lifecycleStatus: ['Lapsed', 'Dormant'],
    sortBy: 'totalSpend',
    sortOrder: 'desc'
  }, 'comeback-targets');
}

/**
 * Export Cooling segment - customers who may be at risk.
 */
function exportCoolingSegment() {
  return CampaignService.saveSegmentExport({
    lifecycleStatus: ['Cooling'],
    sortBy: 'daysSince',
    sortOrder: 'desc'
  }, 'cooling-customers');
}

/**
 * Export segment by language.
 * @param {string} language - 'en' or 'he'
 * @param {Object} additionalOptions - Additional filter options
 */
function exportSegmentByLanguage(language, additionalOptions = {}) {
  const options = Object.assign({ language }, additionalOptions);
  return CampaignService.saveSegmentExport(options, `segment-${language}`);
}

/**
 * Preview a segment without saving (returns stats and first 10 contacts).
 * @param {Object} options - Segment options
 */
function previewSegment(options = {}) {
  const result = CampaignService.getTargetSegment(options);
  return {
    stats: result.stats,
    sampleContacts: result.contacts.slice(0, 10).map(c => ({
      email: c.email,
      name: c.name,
      type: c.customerType,
      status: c.lifecycleStatus,
      language: c.language,
      spend: c.totalSpend,
      bundles: c.bundleMatches
    }))
  };
}

/**
 * Get segment counts for all major segments (dashboard overview).
 */
function getSegmentOverview() {
  const allContacts = ContactService.getContacts();

  // Year in Wine (2025 customers)
  const yearInWine = allContacts.filter(c => {
    const lastOrder = c.sc_LastOrderDate;
    if (!lastOrder) return false;
    const d = lastOrder instanceof Date ? lastOrder : new Date(lastOrder);
    return d.getFullYear() === 2025;
  });

  // Subscribers without 2025 orders
  const subscribers = allContacts.filter(c => {
    const lastOrder = c.sc_LastOrderDate;
    const orderedIn2025 = lastOrder && (lastOrder instanceof Date ? lastOrder : new Date(lastOrder)).getFullYear() === 2025;
    return c.sc_IsSubscribed && !orderedIn2025 &&
           ['prospect.subscriber', 'prospect.fresh', 'prospect.stale'].includes(c.sc_CustomerType);
  });

  // Comeback targets
  const comeback = allContacts.filter(c => {
    const lastOrder = c.sc_LastOrderDate;
    const orderedIn2025 = lastOrder && (lastOrder instanceof Date ? lastOrder : new Date(lastOrder)).getFullYear() === 2025;
    return !orderedIn2025 && ['Lapsed', 'Dormant'].includes(c.sc_LifecycleStatus);
  });

  // Cooling
  const cooling = allContacts.filter(c => c.sc_LifecycleStatus === 'Cooling');

  // Language breakdown for Year in Wine
  const yearInWineEn = yearInWine.filter(c => (c.sc_Language || 'en').toLowerCase() === 'en');
  const yearInWineHe = yearInWine.filter(c => (c.sc_Language || 'en').toLowerCase() === 'he');

  return {
    total: allContacts.length,
    yearInWine: {
      total: yearInWine.length,
      en: yearInWineEn.length,
      he: yearInWineHe.length
    },
    subscribers: subscribers.length,
    comeback: comeback.length,
    cooling: cooling.length
  };
}

/**
 * Import campaigns from file in import folder.
 * Looks for file containing 'campaign' in name.
 */
function importCampaignsFromFolder() {
  const rows = getImportFileData('campaign');
  if (!rows) {
    return { error: 'Campaign export file not found in import folder' };
  }

  // Convert rows back to CSV for existing import function
  const csvContent = rows.map(row => row.map(cell => {
    const str = String(cell);
    if (str.includes(',') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }).join(',')).join('\n');

  return CampaignService.importFromCsv(csvContent);
}
