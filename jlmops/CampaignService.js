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

  // Public API
  return {
    clearCache: clearCache,
    getCampaignById: getCampaignById,
    getCampaigns: getCampaigns,
    upsertCampaign: upsertCampaign,
    getStats: getStats,
    importFromCsv: importFromCsv,
    // Expose for testing
    _deriveCampaignType: _deriveCampaignType
  };
})();

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
