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

      // Last order date range filter
      if (options.lastOrderAfter || options.lastOrderBefore) {
        const lastOrder = c.sc_LastOrderDate;
        if (!lastOrder) return false;
        const lastOrderDate = lastOrder instanceof Date ? lastOrder : new Date(lastOrder);
        if (options.lastOrderAfter) {
          const afterDate = new Date(options.lastOrderAfter);
          if (lastOrderDate < afterDate) return false;
        }
        if (options.lastOrderBefore) {
          const beforeDate = new Date(options.lastOrderBefore);
          if (lastOrderDate > beforeDate) return false;
        }
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
      wooUserId: c.sc_WooUserId || '',
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

  // =============================================
  // GOOGLE SHEET EXPORT FOR CAMPAIGNS
  // =============================================

  /**
   * Exports audience to a Google Spreadsheet with multiple sheets per channel.
   * @param {Object} options - Export options
   * @param {Object} options.filters - Contact filters (same as getTargetSegment)
   * @param {string} options.campaignCode - Campaign code (e.g., 'YIW25VIP')
   * @param {string} options.projectId - Project ID to link tasks to (optional)
   * @param {Object} options.dataGroups - Which data groups to include
   * @param {boolean} options.dataGroups.preferences - Include preferences columns
   * @param {boolean} options.dataGroups.purchaseBehavior - Include purchase behavior columns
   * @param {Object} options.tags - Which tags to generate
   * @param {boolean} options.tags.category - Include category tag
   * @param {boolean} options.tags.priceTier - Include price tier tag
   * @param {boolean} options.tags.winery - Include winery tag
   * @param {boolean} options.tags.status - Include status tag
   * @param {boolean} options.tags.campaign - Include campaign code as tag
   * @param {string} options.additionalTags - Additional comma-separated tags
   * @returns {Object} { success, spreadsheetUrl, spreadsheetId, sheets, taskIds }
   */
  function exportAudienceToSheet(options = {}) {
    const fnName = 'exportAudienceToSheet';
    LoggerService.info(SERVICE_NAME, fnName, `Starting export with options: ${JSON.stringify(options)}`);

    // Get filtered contacts
    const result = getTargetSegment(options.filters || {});
    if (result.contacts.length === 0) {
      return { success: false, error: 'No contacts match the criteria' };
    }

    // Split by channel
    const subscribers = result.contacts.filter(c => c.isSubscribed);
    const nonSubscribers = result.contacts.filter(c => !c.isSubscribed);
    const wooUsers = result.contacts.filter(c => c.wooUserId);

    LoggerService.info(SERVICE_NAME, fnName,
      `Split: ${subscribers.length} subscribers, ${nonSubscribers.length} non-subscribers, ${wooUsers.length} woo users`);

    // Create spreadsheet
    const campaignCode = options.campaignCode || 'EXPORT';
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm');
    const spreadsheetName = `${campaignCode}-Export-${timestamp}`;

    const spreadsheet = SpreadsheetApp.create(spreadsheetName);
    const spreadsheetId = spreadsheet.getId();

    // Move to exports folder
    const allConfig = ConfigService.getAllConfig();
    const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
    const file = DriveApp.getFileById(spreadsheetId);
    DriveApp.getFolderById(exportFolderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);

    const sheets = [];
    const taskIds = [];

    // Build column configuration
    const dataGroups = options.dataGroups || {};
    const tagConfig = options.tags || {};

    // Create Mailchimp sheet (subscribers)
    if (subscribers.length > 0) {
      const sheetName = `${campaignCode}-Mailchimp`;
      const sheet = spreadsheet.getSheets()[0];
      sheet.setName(sheetName);
      _populateExportSheet(sheet, subscribers, dataGroups, tagConfig, options.campaignCode, options.additionalTags);
      sheets.push({ name: sheetName, count: subscribers.length, channel: 'Mailchimp' });
    }

    // Create WhatsApp sheet (non-subscribers)
    if (nonSubscribers.length > 0) {
      const sheetName = `${campaignCode}-WhatsApp`;
      const sheet = spreadsheet.insertSheet(sheetName);
      _populateExportSheet(sheet, nonSubscribers, dataGroups, tagConfig, options.campaignCode, options.additionalTags);
      sheets.push({ name: sheetName, count: nonSubscribers.length, channel: 'WhatsApp' });
    }

    // Create WooCoupons sheet (registered users only)
    if (wooUsers.length > 0) {
      const sheetName = `${campaignCode}-WooCoupons`;
      const sheet = spreadsheet.insertSheet(sheetName);
      _populateWooCouponsSheet(sheet, wooUsers, options.campaignCode);
      sheets.push({ name: sheetName, count: wooUsers.length, channel: 'WooCoupons' });
    }

    // Remove default sheet if it wasn't used
    if (subscribers.length === 0) {
      const defaultSheet = spreadsheet.getSheets()[0];
      if (defaultSheet.getName() === 'Sheet1') {
        spreadsheet.deleteSheet(defaultSheet);
      }
    }

    // Create tracking task for each sheet
    if (options.projectId) {
      sheets.forEach(sheetInfo => {
        try {
          const taskId = TaskService.createTask(
            'task.crm.activity_import',
            spreadsheetId,
            sheetInfo.name,
            `Import activity for ${sheetInfo.name}`,
            `Export contains ${sheetInfo.count} contacts for ${sheetInfo.channel}. Import activity after campaign execution.`,
            options.projectId
          );
          taskIds.push(taskId);
        } catch (e) {
          LoggerService.warn(SERVICE_NAME, fnName, `Failed to create task for ${sheetInfo.name}: ${e.message}`);
        }
      });
    }

    LoggerService.info(SERVICE_NAME, fnName, `Export complete: ${spreadsheet.getUrl()}`);

    return {
      success: true,
      spreadsheetUrl: spreadsheet.getUrl(),
      spreadsheetId: spreadsheetId,
      sheets: sheets,
      taskIds: taskIds,
      totalContacts: result.contacts.length
    };
  }

  /**
   * Populates an export sheet with contact data.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet
   * @param {Array} contacts - Contact data
   * @param {Object} dataGroups - Which data groups to include
   * @param {Object} tagConfig - Tag configuration
   * @param {string} campaignCode - Campaign code
   * @param {string} additionalTags - Additional comma-separated tags
   */
  function _populateExportSheet(sheet, contacts, dataGroups, tagConfig, campaignCode, additionalTags) {
    // Build headers based on configuration
    const headers = ['email', 'name', 'phone', 'language', 'is_woo_user', 'is_subscribed'];

    if (dataGroups.preferences) {
      headers.push('categories', 'wineries', 'price_range', 'intensity', 'grapes');
    }

    if (dataGroups.purchaseBehavior) {
      headers.push('order_count', 'total_spend', 'avg_order', 'first_order', 'last_order', 'days_since');
    }

    // Tags column
    headers.push('tags');

    // Content fields
    headers.push('content_1', 'content_2', 'content_3', 'content_4');

    // Activity columns (pre-seeded)
    headers.push('activity_type', 'activity_summary', 'activity_date');

    // Build rows
    const rows = [headers];

    contacts.forEach(c => {
      const row = [
        c.email || '',
        c.name || '',
        c.phone || '',
        c.language || 'en',
        c.wooUserId ? 'Yes' : 'No',
        c.isSubscribed ? 'Yes' : 'No'
      ];

      if (dataGroups.preferences) {
        row.push(
          c.frequentCategories || '',
          c.topWineries || '',
          c.priceRange || '',
          '', // intensity (could add if available)
          '' // grapes (could add if available)
        );
      }

      if (dataGroups.purchaseBehavior) {
        row.push(
          c.orderCount || 0,
          c.totalSpend || 0,
          c.avgOrderValue || 0,
          c.firstOrderDate || '',
          c.lastOrderDate || '',
          c.daysSinceOrder || ''
        );
      }

      // Generate tags
      const tags = _generateTags(c, tagConfig, campaignCode, additionalTags);
      row.push(tags);

      // Content fields - populate with bundle links based on preferences
      const bundleLinks = _generateBundleLinks(c, campaignCode);
      row.push(bundleLinks.content_1, bundleLinks.content_2, bundleLinks.content_3, bundleLinks.content_4);

      // Pre-seeded activity columns
      row.push(
        'comm.campaign', // activity_type
        `${campaignCode} campaign`, // activity_summary
        '' // activity_date (user fills after send)
      );

      rows.push(row);
    });

    // Write to sheet
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f3f3f3');

    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }

  /**
   * Populates WooCoupons sheet for coupon restriction upload.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet
   * @param {Array} contacts - Contact data (only those with wooUserId)
   * @param {string} campaignCode - Campaign code to use as coupon code
   */
  function _populateWooCouponsSheet(sheet, contacts, campaignCode) {
    const headers = ['woo_user_id', 'email', 'coupon_code'];

    const rows = [headers];
    contacts.forEach(c => {
      if (c.wooUserId) {
        rows.push([c.wooUserId, c.email || '', campaignCode || '']);
      }
    });

    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f3f3f3');
  }

  /**
   * Generates tags string for a contact.
   * @param {Object} contact - Contact data
   * @param {Object} tagConfig - Tag configuration
   * @param {string} campaignCode - Campaign code
   * @param {string} additionalTags - Additional tags
   * @returns {string} Comma-separated tags
   */
  function _generateTags(contact, tagConfig, campaignCode, additionalTags) {
    const tags = [];

    // Campaign code tag
    if (tagConfig.campaign && campaignCode) {
      tags.push(campaignCode);
    }

    // Category tag - use first category
    if (tagConfig.category && contact.frequentCategories) {
      const firstCat = contact.frequentCategories.split(',')[0].trim();
      if (firstCat) {
        // Normalize category name for tag (remove spaces, special chars)
        const catTag = firstCat.replace(/[^a-zA-Z0-9]/g, '');
        tags.push(catTag);
      }
    }

    // Price tier tag
    if (tagConfig.priceTier && contact.priceRange) {
      const parts = contact.priceRange.split('-');
      const maxPrice = parts.length > 1 ? parseInt(parts[1]) : parseInt(parts[0]);
      if (maxPrice >= 150) {
        tags.push('Premium');
      } else if (maxPrice >= 80) {
        tags.push('Mid');
      } else {
        tags.push('Budget');
      }
    }

    // Winery tag - use first winery
    if (tagConfig.winery && contact.topWineries) {
      const firstWinery = contact.topWineries.split(',')[0].trim();
      if (firstWinery) {
        tags.push(firstWinery.replace(/[^a-zA-Z0-9]/g, ''));
      }
    }

    // Status tag
    if (tagConfig.status && contact.lifecycleStatus) {
      tags.push(contact.lifecycleStatus);
    }

    // Registration status
    if (contact.wooUserId) {
      tags.push('WooUser');
    } else {
      tags.push('Guest');
    }

    // Language
    tags.push(contact.language === 'he' ? 'HE' : 'EN');

    // Additional tags
    if (additionalTags) {
      additionalTags.split(',').forEach(t => {
        const trimmed = t.trim();
        if (trimmed) tags.push(trimmed);
      });
    }

    return tags.join(',');
  }

  /**
   * Generates bundle links based on contact preferences.
   * @param {Object} contact - Contact data
   * @param {string} campaignCode - Campaign code for coupon link
   * @returns {Object} { content_1, content_2, content_3, content_4 }
   */
  function _generateBundleLinks(contact, campaignCode) {
    // TODO: Replace with actual bundle URLs from config
    const baseUrl = 'https://wineshop.co.il';
    const lang = contact.language === 'he' ? 'he' : 'en';
    const couponParam = campaignCode ? `?coupon=${campaignCode}` : '';

    const links = {
      content_1: '',
      content_2: '',
      content_3: '',
      content_4: ''
    };

    // Match bundles based on preferences (from bundleMatches calculation)
    const matches = contact.bundleMatches ? contact.bundleMatches.split(',').map(m => m.trim()) : [];

    let linkIndex = 1;
    matches.slice(0, 4).forEach(match => {
      let bundleSlug = '';
      if (match.includes('Red')) {
        bundleSlug = 'special-reds';
      } else if (match.includes('White') || match.includes('Rosé')) {
        bundleSlug = 'special-whites';
      } else if (match.includes('Variety')) {
        bundleSlug = 'special-variety';
      } else if (match.includes('Premium')) {
        bundleSlug = 'premium-value';
      }

      if (bundleSlug) {
        links[`content_${linkIndex}`] = `${baseUrl}/${lang}/product/${bundleSlug}${couponParam}`;
        linkIndex++;
      }
    });

    return links;
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
    // Sheet export
    exportAudienceToSheet: exportAudienceToSheet,
    // Expose for testing
    _deriveCampaignType: _deriveCampaignType,
    _calculateBundleMatches: _calculateBundleMatches,
    _generateTags: _generateTags
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
 * Get H1 2025 lapsed core customers - ordered Jan-Jun 2025, not since.
 * Returns counts by language and exports to files.
 */
function getH1_2025_LapsedCore() {
  const baseOptions = {
    customerType: ['core.new', 'core.repeat', 'core.vip'],
    lastOrderAfter: '2025-01-01',
    lastOrderBefore: '2025-06-30',
    sortBy: 'totalSpend',
    sortOrder: 'desc'
  };

  // Get English segment
  const enResult = CampaignService.getTargetSegment(Object.assign({}, baseOptions, { language: 'en' }));

  // Get Hebrew segment
  const heResult = CampaignService.getTargetSegment(Object.assign({}, baseOptions, { language: 'he' }));

  // Log counts
  LoggerService.info('CampaignService', 'getH1_2025_LapsedCore',
    `English: ${enResult.contacts.length}, Hebrew: ${heResult.contacts.length}`);

  // Export to files
  CampaignService.saveSegmentExport(Object.assign({}, baseOptions, { language: 'en' }), 'h1-2025-lapsed-en');
  CampaignService.saveSegmentExport(Object.assign({}, baseOptions, { language: 'he' }), 'h1-2025-lapsed-he');

  return {
    english: {
      count: enResult.contacts.length,
      stats: enResult.stats,
      emails: enResult.contacts.map(c => c.email)
    },
    hebrew: {
      count: heResult.contacts.length,
      stats: heResult.stats,
      emails: heResult.contacts.map(c => c.email)
    }
  };
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

// =============================================
// YEAR IN WINE 2025 EXPORT
// =============================================

/**
 * Generate referral code from email.
 * Takes prefix before @, removes dots, uppercases.
 * @param {string} email - Email address
 * @param {Set} existingCodes - Set of already-used codes for duplicate checking
 * @returns {string} Referral code
 */
function _generateReferralCode(email, existingCodes) {
  if (!email) return '';

  // Extract prefix (before @)
  const prefix = email.split('@')[0] || '';

  // Remove dots, uppercase
  let code = prefix.replace(/\./g, '').toUpperCase();

  // Handle duplicates
  if (existingCodes.has(code)) {
    let counter = 1;
    while (existingCodes.has(code + counter)) {
      counter++;
    }
    code = code + counter;
  }

  existingCodes.add(code);
  return code;
}

/**
 * Calculate spend per contact from orders for the past 12 months.
 * @returns {Object} Plain object of email -> spend (not Map, for reliable lookups)
 */
function _calculateRecentSpend() {
  const fnName = '_calculateRecentSpend';

  // Get all orders from data spreadsheet
  const allConfig = ConfigService.getAllConfig();
  const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
  const ss = SpreadsheetApp.openById(dataSpreadsheetId);
  const orderSheet = ss.getSheetByName(allConfig['system.sheet_names'].WebOrdM);

  if (!orderSheet) {
    LoggerService.error('CampaignService', fnName, 'WebOrdM sheet not found');
    return {};
  }

  const data = orderSheet.getDataRange().getValues();
  if (data.length < 2) return {};

  const headers = data[0];
  const dateIdx = headers.indexOf('wom_OrderDate');
  const emailIdx = headers.indexOf('wom_BillingEmail');
  const totalIdx = headers.indexOf('wom_OrderTotal');
  const statusIdx = headers.indexOf('wom_Status');

  // 12 months ago from today
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);

  const spendByEmail = {};  // Plain object instead of Map
  let totalOrders = 0;
  let completedOrders = 0;
  let periodMatchOrders = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const orderDate = row[dateIdx];
    const email = (row[emailIdx] || '').toLowerCase().trim();
    const total = parseFloat(row[totalIdx]) || 0;
    const status = (row[statusIdx] || '').toLowerCase();

    totalOrders++;

    // Skip non-completed orders
    if (status !== 'completed' && status !== 'processing') continue;
    completedOrders++;

    // Check if order is within past 12 months
    if (!orderDate) continue;
    const date = orderDate instanceof Date ? orderDate : new Date(orderDate);
    if (date < cutoffDate) continue;
    periodMatchOrders++;

    // Sum spend
    if (email) {
      spendByEmail[email] = (spendByEmail[email] || 0) + total;
    }
  }

  const contactCount = Object.keys(spendByEmail).length;
  LoggerService.info('CampaignService', fnName, `Orders: ${totalOrders} total, ${completedOrders} completed, ${periodMatchOrders} in past 12 months. Contacts with spend: ${contactCount}`);
  return spendByEmail;
}

/**
 * Calculate spend per contact from orders for 2025.
 * @param {Object} allConfig - Config object (passed to avoid duplicate fetch)
 * @returns {Object} Plain object of email -> 2025 spend
 */
function _calculate2025Spend(allConfig) {
  const fnName = '_calculate2025Spend';

  const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
  const ss = SpreadsheetApp.openById(dataSpreadsheetId);
  const orderSheet = ss.getSheetByName(allConfig['system.sheet_names'].WebOrdM);

  if (!orderSheet) {
    LoggerService.error('CampaignService', fnName, 'WebOrdM sheet not found');
    return {};
  }

  const data = orderSheet.getDataRange().getValues();
  LoggerService.info('CampaignService', fnName, `WebOrdM has ${data.length} rows`);
  if (data.length < 2) return {};

  const headers = data[0];
  const dateIdx = headers.indexOf('wom_OrderDate');
  const emailIdx = headers.indexOf('wom_BillingEmail');
  const totalIdx = headers.indexOf('wom_OrderTotal');
  const statusIdx = headers.indexOf('wom_Status');

  LoggerService.info('CampaignService', fnName, `Column indices: date=${dateIdx}, email=${emailIdx}, total=${totalIdx}, status=${statusIdx}`);

  // Log first 3 data rows to prove data is readable
  for (let i = 1; i <= 3 && i < data.length; i++) {
    const row = data[i];
    LoggerService.info('CampaignService', fnName, `Row ${i}: date=${row[dateIdx]}, email=${row[emailIdx]}, total=${row[totalIdx]}, status=${row[statusIdx]}`);
  }

  const spendByEmail = {};
  let totalOrders = 0;
  let completedOrders = 0;
  let orders2025 = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const orderDate = row[dateIdx];
    const email = (row[emailIdx] || '').toLowerCase().trim();
    const total = parseFloat(row[totalIdx]) || 0;
    const status = (row[statusIdx] || '').toLowerCase();

    totalOrders++;

    // Skip non-completed orders
    if (status !== 'completed' && status !== 'processing') continue;
    completedOrders++;

    // Check if order is in 2025
    if (!orderDate) continue;
    const date = orderDate instanceof Date ? orderDate : new Date(orderDate);
    if (date.getFullYear() !== 2025) continue;
    orders2025++;

    // Sum spend
    if (email) {
      spendByEmail[email] = (spendByEmail[email] || 0) + total;
    }
  }

  const contactCount = Object.keys(spendByEmail).length;
  LoggerService.info('CampaignService', fnName, `Orders: ${totalOrders} total, ${completedOrders} completed, ${orders2025} in 2025. Contacts with spend: ${contactCount}`);

  return spendByEmail;
}

/**
 * Filter contacts for Year in Wine campaign.
 * Returns emails of contacts with minimum spend in past 12 months.
 *
 * @param {Object} options - Filter options
 * @param {number} options.minSpend - Minimum spend (default 1000)
 * @returns {Object} { emails: string[] }
 */
function filterYearInWine(options = {}) {
  const fnName = 'filterYearInWine';
  const minSpend = options.minSpend || 1000;

  LoggerService.info('CampaignService', fnName, `Filtering for minSpend=${minSpend}`);

  // Get all contacts - use stored sc_Spend12Month
  const allContacts = ContactService.getContacts();

  // Filter by spend
  const emails = [];
  allContacts.forEach(c => {
    const email = (c.sc_Email || '').toLowerCase().trim();
    const contactSpend = parseFloat(c.sc_Spend12Month) || 0;

    if (contactSpend >= minSpend && !c.sc_DoNotContact) {
      emails.push(email);
    }
  });

  LoggerService.info('CampaignService', fnName, `Found ${emails.length} qualifying contacts`);

  return { emails: emails };
}

/**
 * Assign reward tier based on spend.
 * @param {number} spend - Total 2025 spend
 * @returns {string} Reward tier: fgr01, fgr02, fgr03, or empty
 */
function _assignRewardTier(spend) {
  if (spend >= 4000) return 'fgr03';
  if (spend >= 2000) return 'fgr02';
  if (spend >= 1000) return 'fgr01';
  return '';
}

/**
 * Export Year in Wine 2025 data for Mailchimp.
 *
 * Filters:
 * - Year spend >= minSpend
 * - Excludes do-not-contact
 *
 * Includes:
 * - Identity (email, name, language)
 * - Preferences (wineries, grapes, attributes)
 * - Generated (referral code, referral URL, reward tier)
 *
 * Does NOT include spend/order stats.
 *
 * @param {Object} options - Export options
 * @param {string} options.couponExpiry - Coupon expiry date YYYY-MM-DD (default 2026-02-01)
 * @param {number} options.couponAmount - Coupon discount amount (default 50)
 * @param {string} options.shopUrl - Base shop URL (default from config or https://shop.jlmwines.com)
 * @param {boolean} options.testMode - If true, skip task creation (default false)
 * @returns {Object} Export result with file URLs and testMode flag
 */
function exportYearInWine2025(options = {}) {
  const fnName = 'exportYearInWine2025';
  const minSpend = options.minSpend || 1000;
  const couponExpiry = options.couponExpiry || '2026-02-01';
  const couponAmount = options.couponAmount || 50;
  const testMode = options.testMode || false;

  // Get shop URL from config or use default
  const allConfig = ConfigService.getAllConfig();
  const shopUrl = options.shopUrl || allConfig['system.website.shop_url'] || 'https://shop.jlmwines.com';

  LoggerService.info('CampaignService', fnName, `Starting export: minSpend=${minSpend}, testMode=${testMode}`);

  // Get all contacts - spend is stored in sc_Spend12Month
  const allContacts = ContactService.getContacts();
  LoggerService.info('CampaignService', fnName, `Loaded ${allContacts.length} contacts`);

  // Filter contacts
  const existingCodes = new Set();
  const qualifyingContacts = [];

  allContacts.forEach(c => {
    if (c.sc_DoNotContact) return;

    const email = (c.sc_Email || '').toLowerCase().trim();
    if (!email) return;

    // Use stored 12-month spend and tier from contact
    const spend = parseFloat(c.sc_Spend12Month) || 0;
    const rewardTier = c.sc_Tier || '';

    // Filter: minimum 12-month spend threshold
    if (spend < minSpend) return;

    const referralCode = _generateReferralCode(email, existingCodes);

    qualifyingContacts.push({
      contact: c,
      spend2025: spend,
      rewardTier: rewardTier,
      referralCode: referralCode
    });
  });

  LoggerService.info('CampaignService', fnName, `Exporting ${qualifyingContacts.length} contacts (minSpend=${minSpend})`);

  // Create export spreadsheet
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm');
  const spreadsheet = SpreadsheetApp.create(`YearInWine2025-Export-${timestamp}`);
  const spreadsheetId = spreadsheet.getId();

  // Move to exports folder
  const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
  const file = DriveApp.getFileById(spreadsheetId);
  DriveApp.getFolderById(exportFolderId).addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // Split contacts by language
  const contactsEN = qualifyingContacts.filter(item => (item.contact.sc_Language || 'en').toLowerCase() === 'en');
  const contactsHE = qualifyingContacts.filter(item => (item.contact.sc_Language || 'en').toLowerCase() === 'he');

  LoggerService.info('CampaignService', fnName, `By language: EN=${contactsEN.length}, HE=${contactsHE.length}`);

  // Sheet 1: Mailchimp data - English
  const mailchimpSheetEN = spreadsheet.getSheets()[0];
  mailchimpSheetEN.setName('YIW25-Mailchimp-EN');
  _populateYIWMailchimpSheet(mailchimpSheetEN, contactsEN, shopUrl);

  // Sheet 2: Mailchimp data - Hebrew
  const mailchimpSheetHE = spreadsheet.insertSheet('YIW25-Mailchimp-HE');
  _populateYIWMailchimpSheet(mailchimpSheetHE, contactsHE, shopUrl);

  // Sheet 3: Referral coupons only (new coupons to create)
  const couponSheet = spreadsheet.insertSheet('YIW25-Referrals');
  _populateYIWReferralCouponSheet(couponSheet, qualifyingContacts, couponExpiry, couponAmount);

  // Sheet 4: Reward coupon updates (fgr01/02/03 with new allowed_users)
  const rewardSheet = spreadsheet.insertSheet('YIW25-RewardUpdates');
  _populateYIWRewardCouponSheet(rewardSheet, qualifyingContacts, couponExpiry);

  LoggerService.info('CampaignService', fnName, `Export complete: ${spreadsheet.getUrl()}`);

  return {
    success: true,
    testMode: testMode,
    totalContacts: qualifyingContacts.length,
    byTier: {
      fgr01: qualifyingContacts.filter(c => c.rewardTier === 'fgr01').length,
      fgr02: qualifyingContacts.filter(c => c.rewardTier === 'fgr02').length,
      fgr03: qualifyingContacts.filter(c => c.rewardTier === 'fgr03').length
    },
    spreadsheetUrl: spreadsheet.getUrl(),
    spreadsheetId: spreadsheetId
  };
}

/**
 * Generate referral URL with apply_coupon and UTM params.
 * @param {string} shopUrl - Base shop URL
 * @param {string} code - Referral coupon code
 * @param {string} lang - Language code (he = Hebrew, uses /he path)
 * @returns {string} Full referral URL
 */
function _generateReferralUrl(shopUrl, code, lang) {
  // Hebrew speakers get /he path
  const baseUrl = lang === 'he' ? `${shopUrl}/he` : shopUrl;
  return `${baseUrl}?apply_coupon=${code}&utm_source=link&utm_medium=referral`;
}

/**
 * Populate Mailchimp sheet with contact data.
 * Identity, preferences, referral info, reward tier - NO coupon creation columns.
 */
function _populateYIWMailchimpSheet(sheet, contacts, shopUrl) {
  const headers = [
    'email', 'name', 'language', 'woo_user_id',
    'top_wineries', 'red_grapes', 'white_grapes',
    'red_intensity', 'red_complexity', 'white_complexity', 'white_acidity',
    'referral_code', 'referral_url', 'reward_tier'
  ];

  const rows = [headers];

  contacts.forEach(item => {
    const c = item.contact;
    const lang = (c.sc_Language || 'en').toLowerCase();
    const referralUrl = _generateReferralUrl(shopUrl, item.referralCode, lang);

    rows.push([
      c.sc_Email || '',
      c.sc_Name || '',
      lang,
      c.sc_WooUserId || '',
      lang === 'he' ? (c.sc_TopWineries_He || '') : (c.sc_TopWineries_En || ''),
      lang === 'he' ? (c.sc_TopRedGrapes_He || '') : (c.sc_TopRedGrapes_En || ''),
      lang === 'he' ? (c.sc_TopWhiteGrapes_He || '') : (c.sc_TopWhiteGrapes_En || ''),
      c.sc_RedIntensityRange || '',
      c.sc_RedComplexityRange || '',
      c.sc_WhiteComplexityRange || '',
      c.sc_WhiteAcidityRange || '',
      item.referralCode,
      referralUrl,
      item.rewardTier
    ]);
  });

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Populate referral coupon sheet (new coupons to create).
 */
function _populateYIWReferralCouponSheet(sheet, contacts, expiry, amount) {
  const headers = [
    'post_title', 'post_status', 'discount_type', 'coupon_amount',
    'usage_limit_per_user', 'date_expires', 'meta:_wjecf_first_purchase_only'
  ];

  const rows = [headers];

  contacts.forEach(item => {
    rows.push([
      item.referralCode,
      'publish',
      'fixed_cart',
      amount,
      1,
      expiry,
      'yes'
    ]);
  });

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Populate reward coupon update sheet (fgr01/02/03 with merged allowed_users).
 * Outputs full coupon records ready for WooCommerce import, preserving all original fields.
 */
function _populateYIWRewardCouponSheet(sheet, contacts, expiry) {
  // Get existing coupon data (full rows)
  const existingData = _getExistingCouponData();

  if (!existingData.headers || existingData.headers.length === 0) {
    // Fallback if no CSV found
    sheet.getRange(1, 1).setValue('No coupon_export CSV found in imports folder');
    return;
  }

  // Group new users by tier
  const byTier = { FGR01: [], FGR02: [], FGR03: [] };
  contacts.forEach(item => {
    const wooUserId = item.contact.sc_WooUserId;
    if (wooUserId && item.rewardTier) {
      const tierUpper = item.rewardTier.toUpperCase();
      if (byTier[tierUpper]) {
        byTier[tierUpper].push(String(wooUserId));
      }
    }
  });

  const headers = existingData.headers;
  const customerIdsIdx = headers.indexOf('meta:_wjecf_customer_ids');
  const freeProductIdsIdx = headers.indexOf('meta:_wjecf_free_product_ids');
  const rows = [headers];

  ['FGR01', 'FGR02', 'FGR03'].forEach(tier => {
    const couponData = existingData.coupons[tier];
    if (!couponData) {
      LoggerService.warn('CampaignService', '_populateYIWRewardCouponSheet', `${tier} not found in coupon CSV`);
      return;
    }

    // Clone the row
    const row = [...couponData.row];

    // Get existing user IDs
    const existingIds = customerIdsIdx >= 0 ? (row[customerIdsIdx] || '') : '';
    const existingUsers = existingIds.split(',').map(id => id.trim()).filter(id => id);

    // Merge with new users
    const newUsers = byTier[tier];
    const mergedSet = new Set([...existingUsers, ...newUsers]);
    const mergedUsers = [...mergedSet];

    // Update the customer_ids field (prefix with ' to prevent scientific notation)
    if (customerIdsIdx >= 0) {
      row[customerIdsIdx] = "'" + mergedUsers.join(',');
    }

    // Prefix free_product_ids with ' to prevent scientific notation
    if (freeProductIdsIdx >= 0 && row[freeProductIdsIdx]) {
      const val = String(row[freeProductIdsIdx]);
      if (!val.startsWith("'")) {
        row[freeProductIdsIdx] = "'" + val;
      }
    }

    rows.push(row);

    LoggerService.info('CampaignService', '_populateYIWRewardCouponSheet',
      `${tier}: ${existingUsers.length} existing + ${newUsers.length} new = ${mergedUsers.length} total`);
  });

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Get existing coupon data from most recent coupon export CSV.
 * Looks for coupon_export_*.csv in imports folder.
 * @returns {Object} Map of coupon code -> full row data with headers
 */
function _getExistingCouponData() {
  const fnName = '_getExistingCouponData';
  const result = { headers: [], coupons: {} };

  try {
    const allConfig = ConfigService.getAllConfig();

    // Use the imports folder (same as other import configs)
    const importFolderId = allConfig['import.drive.web_orders']?.source_folder_id;
    if (!importFolderId) {
      LoggerService.warn('CampaignService', fnName, 'No imports folder configured');
      return result;
    }
    const folder = DriveApp.getFolderById(importFolderId);

    // Find most recent coupon_export CSV
    const files = folder.getFilesByName('coupon_export');
    let latestFile = null;
    let latestDate = null;

    // Search for files starting with 'coupon_export'
    const allFiles = folder.getFiles();
    while (allFiles.hasNext()) {
      const file = allFiles.next();
      const name = file.getName();
      if (name.startsWith('coupon_export') && name.endsWith('.csv')) {
        const created = file.getDateCreated();
        if (!latestDate || created > latestDate) {
          latestDate = created;
          latestFile = file;
        }
      }
    }

    if (!latestFile) {
      LoggerService.info('CampaignService', fnName, 'No coupon_export CSV found in imports folder');
      return result;
    }

    LoggerService.info('CampaignService', fnName, `Reading coupon data from: ${latestFile.getName()}`);

    // Parse CSV
    const content = latestFile.getBlob().getDataAsString();
    const lines = Utilities.parseCsv(content);

    if (lines.length < 2) return result;

    const headers = lines[0];
    result.headers = headers;

    const codeIdx = headers.indexOf('post_title');
    const customerIdsIdx = headers.indexOf('meta:_wjecf_customer_ids');

    if (codeIdx === -1) {
      LoggerService.warn('CampaignService', fnName, 'post_title column not found in CSV');
      return result;
    }

    // Extract fgr01/02/03 full row data
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      const code = (row[codeIdx] || '').toUpperCase();

      if (code === 'FGR01' || code === 'FGR02' || code === 'FGR03') {
        result.coupons[code] = {
          row: row,
          customerIdsIdx: customerIdsIdx
        };
        const existingIds = customerIdsIdx >= 0 ? (row[customerIdsIdx] || '') : '';
        LoggerService.info('CampaignService', fnName, `${code}: existing customer_ids = "${existingIds}"`);
      }
    }

  } catch (e) {
    LoggerService.error('CampaignService', fnName, `Error reading coupon data: ${e.message}`);
  }

  return result;
}

/**
 * Simple Year in Wine export - contacts and preferences only.
 * No tiers, referral codes, or coupons. For simpler marketing campaigns.
 *
 * Run updateContactSpend12Month(year) first to set spend data.
 *
 * @param {Object} options - Export options
 * @param {number} options.minSpend - Minimum spend threshold (default 1000)
 * @param {number} options.year - Year label for filename (default 2024)
 * @returns {Object} Export result with spreadsheet URL
 */
function exportYearInWineSimple(options = {}) {
  const fnName = 'exportYearInWineSimple';
  const minSpend = options.minSpend || 1000;
  const year = options.year || 2024;

  LoggerService.info('CampaignService', fnName, `Starting simple export: year=${year}, minSpend=${minSpend}`);

  // Get all contacts - use stored sc_Spend12Month
  const allContacts = ContactService.getContacts();

  // Filter by spend
  const qualifyingContacts = [];
  allContacts.forEach(c => {
    if (c.sc_DoNotContact) return;

    const email = (c.sc_Email || '').toLowerCase().trim();
    if (!email) return;

    const spend = parseFloat(c.sc_Spend12Month) || 0;
    if (spend < minSpend) return;

    qualifyingContacts.push(c);
  });

  // Split by language
  const contactsEN = qualifyingContacts.filter(c => (c.sc_Language || 'en').toLowerCase() === 'en');
  const contactsHE = qualifyingContacts.filter(c => (c.sc_Language || 'en').toLowerCase() === 'he');

  LoggerService.info('CampaignService', fnName, `Found ${qualifyingContacts.length} contacts (EN=${contactsEN.length}, HE=${contactsHE.length})`);

  // Create export spreadsheet
  const allConfig = ConfigService.getAllConfig();
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm');
  const spreadsheet = SpreadsheetApp.create(`YearInWine${year}-Simple-${timestamp}`);
  const spreadsheetId = spreadsheet.getId();

  // Move to exports folder
  const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
  const file = DriveApp.getFileById(spreadsheetId);
  DriveApp.getFolderById(exportFolderId).addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // Headers for simple export
  const headers = [
    'email', 'name', 'language', 'spend', 'order_count',
    'top_wineries', 'red_grapes', 'white_grapes',
    'red_intensity', 'red_complexity', 'white_complexity', 'white_acidity',
    'kashrut_prefs', 'price_range', 'categories'
  ];

  // Helper to build row
  function buildRow(c) {
    const lang = (c.sc_Language || 'en').toLowerCase();
    return [
      c.sc_Email || '',
      c.sc_Name || '',
      lang,
      Math.round(parseFloat(c.sc_Spend12Month) || 0),
      c.sc_OrderCount || 0,
      lang === 'he' ? (c.sc_TopWineries_He || '') : (c.sc_TopWineries_En || ''),
      lang === 'he' ? (c.sc_TopRedGrapes_He || '') : (c.sc_TopRedGrapes_En || ''),
      lang === 'he' ? (c.sc_TopWhiteGrapes_He || '') : (c.sc_TopWhiteGrapes_En || ''),
      c.sc_RedIntensityRange || '',
      c.sc_RedComplexityRange || '',
      c.sc_WhiteComplexityRange || '',
      c.sc_WhiteAcidityRange || '',
      lang === 'he' ? (c.sc_KashrutPrefs_He || '') : (c.sc_KashrutPrefs_En || ''),
      c.sc_PriceAvg ? `${c.sc_PriceMin || ''}-${c.sc_PriceMax || ''}` : '',
      lang === 'he' ? (c.sc_FrequentCategories_He || '') : (c.sc_FrequentCategories_En || '')
    ];
  }

  // Sheet 1: English contacts
  const sheetEN = spreadsheet.getSheets()[0];
  sheetEN.setName(`YIW${year}-EN`);
  const rowsEN = [headers].concat(contactsEN.map(buildRow));
  sheetEN.getRange(1, 1, rowsEN.length, headers.length).setValues(rowsEN);
  sheetEN.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheetEN.setFrozenRows(1);

  // Sheet 2: Hebrew contacts
  const sheetHE = spreadsheet.insertSheet(`YIW${year}-HE`);
  const rowsHE = [headers].concat(contactsHE.map(buildRow));
  sheetHE.getRange(1, 1, rowsHE.length, headers.length).setValues(rowsHE);
  sheetHE.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheetHE.setFrozenRows(1);

  LoggerService.info('CampaignService', fnName, `Export complete: ${spreadsheet.getUrl()}`);

  return {
    success: true,
    year: year,
    totalContacts: qualifyingContacts.length,
    english: contactsEN.length,
    hebrew: contactsHE.length,
    spreadsheetUrl: spreadsheet.getUrl(),
    spreadsheetId: spreadsheetId
  };
}

/**
 * Export 2024 customers who didn't purchase in 2025 - preferences only.
 * @returns {Object} Export result with spreadsheet URL
 */
function exportLapsed2024Customers() {
  const fnName = 'exportLapsed2024Customers';

  LoggerService.info('CampaignService', fnName, 'Starting lapsed 2024 customer export');

  const allContacts = ContactService.getContacts();
  LoggerService.info('CampaignService', fnName, `Got ${allContacts.length} contacts, filtering...`);

  // Filter: last order in 2024 (purchased in 2024, not in 2025)
  const lapsedContacts = [];
  allContacts.forEach(c => {
    try {
      if (c.sc_DoNotContact) return;
      if (!c.sc_LastOrderDate) return;

      const lastOrder = c.sc_LastOrderDate instanceof Date
        ? c.sc_LastOrderDate
        : new Date(c.sc_LastOrderDate);

      if (!isNaN(lastOrder.getTime()) && lastOrder.getFullYear() === 2024) {
        lapsedContacts.push(c);
      }
    } catch (e) {
      // Skip contacts with invalid dates
    }
  });

  // Split by language
  const contactsEN = lapsedContacts.filter(c => (c.sc_Language || 'en').toLowerCase() === 'en');
  const contactsHE = lapsedContacts.filter(c => (c.sc_Language || 'en').toLowerCase() === 'he');

  LoggerService.info('CampaignService', fnName, `Found ${lapsedContacts.length} lapsed 2024 customers (EN=${contactsEN.length}, HE=${contactsHE.length})`);

  // Create export spreadsheet
  const allConfig = ConfigService.getAllConfig();
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmm');
  const spreadsheet = SpreadsheetApp.create(`Lapsed2024-Customers-${timestamp}`);
  const spreadsheetId = spreadsheet.getId();

  // Move to exports folder
  const exportFolderId = allConfig['system.folder.jlmops_exports'].id;
  const file = DriveApp.getFileById(spreadsheetId);
  DriveApp.getFolderById(exportFolderId).addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // Headers - preferences only
  const headers = [
    'email', 'name', 'language', 'last_order_date',
    'top_wineries', 'red_grapes', 'white_grapes',
    'red_intensity', 'red_complexity', 'white_complexity', 'white_acidity',
    'kashrut_prefs', 'categories'
  ];

  function buildRow(c) {
    const lang = (c.sc_Language || 'en').toLowerCase();
    return [
      c.sc_Email || '',
      c.sc_Name || '',
      lang,
      c.sc_LastOrderDate || '',
      lang === 'he' ? (c.sc_TopWineries_He || '') : (c.sc_TopWineries_En || ''),
      lang === 'he' ? (c.sc_TopRedGrapes_He || '') : (c.sc_TopRedGrapes_En || ''),
      lang === 'he' ? (c.sc_TopWhiteGrapes_He || '') : (c.sc_TopWhiteGrapes_En || ''),
      c.sc_RedIntensityRange || '',
      c.sc_RedComplexityRange || '',
      c.sc_WhiteComplexityRange || '',
      c.sc_WhiteAcidityRange || '',
      lang === 'he' ? (c.sc_KashrutPrefs_He || '') : (c.sc_KashrutPrefs_En || ''),
      lang === 'he' ? (c.sc_FrequentCategories_He || '') : (c.sc_FrequentCategories_En || '')
    ];
  }

  // Sheet 1: English
  const sheetEN = spreadsheet.getSheets()[0];
  sheetEN.setName('Lapsed2024-EN');
  const rowsEN = [headers].concat(contactsEN.map(buildRow));
  sheetEN.getRange(1, 1, rowsEN.length, headers.length).setValues(rowsEN);
  sheetEN.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheetEN.setFrozenRows(1);

  // Sheet 2: Hebrew
  const sheetHE = spreadsheet.insertSheet('Lapsed2024-HE');
  const rowsHE = [headers].concat(contactsHE.map(buildRow));
  sheetHE.getRange(1, 1, rowsHE.length, headers.length).setValues(rowsHE);
  sheetHE.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheetHE.setFrozenRows(1);

  LoggerService.info('CampaignService', fnName, `Export complete: ${spreadsheet.getUrl()}`);

  return {
    success: true,
    totalContacts: lapsedContacts.length,
    english: contactsEN.length,
    hebrew: contactsHE.length,
    spreadsheetUrl: spreadsheet.getUrl()
  };
}
