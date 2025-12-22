/**
 * @file CrmIntelligenceService.js
 * @description Analyzes CRM data to suggest marketing projects and campaigns.
 * Monitors thresholds and creates suggestion tasks when triggers are met.
 */

const CrmIntelligenceService = (function () {
  const SERVICE_NAME = 'CrmIntelligenceService';

  // Config cache (loaded once per execution)
  let _intelligenceConfig = null;

  /**
   * Gets intelligence config values from CRM config.
   * @returns {Object} Intelligence thresholds
   */
  function _getIntelligenceConfig() {
    if (_intelligenceConfig) return _intelligenceConfig;

    const allConfig = ConfigService.getAllConfig();
    const cfg = allConfig['crm.intelligence.thresholds'] || {};
    _intelligenceConfig = {
      coolingCustomers: parseInt(cfg.cooling_customers, 10) || 5,
      unconvertedSubscribers: parseInt(cfg.unconverted_subscribers, 10) || 10,
      wineryCluster: parseInt(cfg.winery_cluster, 10) || 5,
      holidayLeadDays: parseInt(cfg.holiday_lead_days, 10) || 21,
      subscriberConversionDays: parseInt(cfg.subscriber_conversion_days, 10) || 30
    };
    return _intelligenceConfig;
  }

  // Hebrew holidays to track (dates approximate, updated annually)
  const HOLIDAYS = [
    { name: 'Rosh Hashanah', month: 9, day: 15 },
    { name: 'Sukkot', month: 9, day: 22 },
    { name: 'Hanukkah', month: 12, day: 1 },
    { name: 'Purim', month: 3, day: 14 },
    { name: 'Passover', month: 4, day: 10 },
    { name: 'Shavuot', month: 6, day: 1 }
  ];

  /**
   * Gets all contacts from SysContacts.
   * @returns {Array} Contact records
   */
  function _getContacts() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
    const spreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);

    const sheet = spreadsheet.getSheetByName(sheetNames.SysContacts || 'SysContacts');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0];
    const contacts = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const contact = {};
      headers.forEach((h, j) => {
        contact[h] = row[j];
      });
      contacts.push(contact);
    }

    return contacts;
  }

  /**
   * Checks for cooling customers who need win-back outreach.
   * @param {Array} contacts - All contacts
   * @returns {Object|null} Suggestion if threshold met
   */
  function _checkCoolingCustomers(contacts) {
    const cooling = contacts.filter(c => {
      const status = (c.sc_LifecycleStatus || '').toLowerCase();
      const isCustomer = c.sc_IsCustomer === true || c.sc_IsCustomer === 'TRUE';
      return isCustomer && status === 'cooling';
    });

    const config = _getIntelligenceConfig();
    if (cooling.length >= config.coolingCustomers) {
      return {
        type: 'winback_campaign',
        title: 'Win-Back Campaign Needed',
        description: `${cooling.length} customers are in "Cooling" status (91-180 days since last order). Consider launching a win-back campaign with personalized offers.`,
        count: cooling.length,
        contacts: cooling.slice(0, 10).map(c => c.sc_Email)
      };
    }
    return null;
  }

  /**
   * Checks for subscribers who haven't converted after 30+ days.
   * @param {Array} contacts - All contacts
   * @returns {Object|null} Suggestion if threshold met
   */
  function _checkUnconvertedSubscribers(contacts) {
    const config = _getIntelligenceConfig();

    const unconverted = contacts.filter(c => {
      const isSubscribed = c.sc_IsSubscribed === true || c.sc_IsSubscribed === 'TRUE';
      const isCustomer = c.sc_IsCustomer === true || c.sc_IsCustomer === 'TRUE';
      const daysSubscribed = parseInt(c.sc_DaysSubscribed, 10) || 0;

      return isSubscribed && !isCustomer && daysSubscribed > config.subscriberConversionDays;
    });

    if (unconverted.length >= config.unconvertedSubscribers) {
      return {
        type: 'conversion_campaign',
        title: 'Subscriber Conversion Campaign',
        description: `${unconverted.length} email subscribers have been subscribed for ${config.subscriberConversionDays}+ days without placing an order. Consider a first-order incentive campaign.`,
        count: unconverted.length,
        contacts: unconverted.slice(0, 10).map(c => c.sc_Email)
      };
    }
    return null;
  }

  /**
   * Checks for winery clusters where multiple customers share a favorite winery.
   * @param {Array} contacts - All contacts
   * @returns {Object|null} Suggestion if threshold met
   */
  function _checkWineryClusters(contacts) {
    const config = _getIntelligenceConfig();
    const wineryCounts = {};

    contacts.forEach(c => {
      const wineries = (c.sc_TopWineries || '').split(',').map(w => w.trim()).filter(w => w);
      // Count the first (top) winery
      if (wineries.length > 0) {
        const topWinery = wineries[0];
        wineryCounts[topWinery] = wineryCounts[topWinery] || [];
        wineryCounts[topWinery].push(c.sc_Email);
      }
    });

    // Find wineries with enough customers
    const clusters = [];
    for (const winery in wineryCounts) {
      if (wineryCounts[winery].length >= config.wineryCluster) {
        clusters.push({
          winery: winery,
          count: wineryCounts[winery].length,
          customers: wineryCounts[winery].slice(0, 10)
        });
      }
    }

    if (clusters.length > 0) {
      const topCluster = clusters.sort((a, b) => b.count - a.count)[0];
      return {
        type: 'winery_campaign',
        title: `${topCluster.winery} Winery Campaign`,
        description: `${topCluster.count} customers have ${topCluster.winery} as their top winery. Consider a themed campaign featuring new releases or exclusive offers from this winery.`,
        winery: topCluster.winery,
        count: topCluster.count,
        contacts: topCluster.customers
      };
    }
    return null;
  }

  /**
   * Checks for upcoming holidays that need seasonal campaigns.
   * @returns {Object|null} Suggestion if holiday is within lead time
   */
  function _checkUpcomingHolidays() {
    const config = _getIntelligenceConfig();
    const now = new Date();
    const currentYear = now.getFullYear();

    for (const holiday of HOLIDAYS) {
      // Check both current and next year
      for (const year of [currentYear, currentYear + 1]) {
        const holidayDate = new Date(year, holiday.month - 1, holiday.day);
        const daysUntil = Math.ceil((holidayDate - now) / (1000 * 60 * 60 * 24));

        if (daysUntil > 0 && daysUntil <= config.holidayLeadDays) {
          return {
            type: 'seasonal_campaign',
            title: `${holiday.name} Campaign`,
            description: `${holiday.name} is in ${daysUntil} days. Consider launching a seasonal campaign with gift bundles and holiday-themed offerings.`,
            holiday: holiday.name,
            daysUntil: daysUntil,
            date: holidayDate.toISOString().split('T')[0]
          };
        }
      }
    }
    return null;
  }

  /**
   * Creates a task for a campaign suggestion.
   * @param {Object} suggestion - The suggestion object
   * @returns {boolean} True if task was created
   */
  function _createSuggestionTask(suggestion) {
    try {
      const taskId = `suggestion.${suggestion.type}.${new Date().toISOString().split('T')[0]}`;

      // Check if task already exists (avoid duplicates)
      if (typeof TaskService !== 'undefined' && TaskService.getTaskById) {
        const existing = TaskService.getTaskById(taskId);
        if (existing && existing.st_Status !== 'Completed') {
          LoggerService.info(SERVICE_NAME, '_createSuggestionTask', `Task ${taskId} already exists, skipping`);
          return false;
        }
      }

      const notes = JSON.stringify({
        suggestionType: suggestion.type,
        count: suggestion.count,
        contacts: suggestion.contacts || [],
        generatedDate: new Date().toISOString()
      });

      TaskService.createTask(
        'task.crm.suggestion',
        taskId,
        suggestion.title,
        suggestion.description,
        suggestion.description,
        notes
      );

      LoggerService.info(SERVICE_NAME, '_createSuggestionTask', `Created suggestion task: ${suggestion.title}`);
      return true;
    } catch (e) {
      LoggerService.warn(SERVICE_NAME, '_createSuggestionTask', `Failed to create task: ${e.message}`);
      return false;
    }
  }

  /**
   * Runs all intelligence checks and creates suggestion tasks.
   * @returns {Object} Results with suggestions found
   */
  function runAnalysis() {
    const fnName = 'runAnalysis';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting CRM intelligence analysis');

    const contacts = _getContacts();
    LoggerService.info(SERVICE_NAME, fnName, `Loaded ${contacts.length} contacts`);

    const suggestions = [];
    let tasksCreated = 0;

    // Check cooling customers
    const coolingSuggestion = _checkCoolingCustomers(contacts);
    if (coolingSuggestion) {
      suggestions.push(coolingSuggestion);
      if (_createSuggestionTask(coolingSuggestion)) tasksCreated++;
    }

    // Check unconverted subscribers
    const conversionSuggestion = _checkUnconvertedSubscribers(contacts);
    if (conversionSuggestion) {
      suggestions.push(conversionSuggestion);
      if (_createSuggestionTask(conversionSuggestion)) tasksCreated++;
    }

    // Check winery clusters
    const winerySuggestion = _checkWineryClusters(contacts);
    if (winerySuggestion) {
      suggestions.push(winerySuggestion);
      if (_createSuggestionTask(winerySuggestion)) tasksCreated++;
    }

    // Check upcoming holidays
    const holidaySuggestion = _checkUpcomingHolidays();
    if (holidaySuggestion) {
      suggestions.push(holidaySuggestion);
      if (_createSuggestionTask(holidaySuggestion)) tasksCreated++;
    }

    LoggerService.info(SERVICE_NAME, fnName, `Analysis complete: ${suggestions.length} suggestions, ${tasksCreated} tasks created`);

    return {
      contactsAnalyzed: contacts.length,
      suggestions: suggestions,
      tasksCreated: tasksCreated
    };
  }

  /**
   * Gets current intelligence insights without creating tasks.
   * Useful for dashboard display.
   * @returns {Object} Current insights
   */
  function getInsights() {
    const fnName = 'getInsights';
    const config = _getIntelligenceConfig();
    const contacts = _getContacts();

    const insights = {
      timestamp: new Date().toISOString(),
      contacts: contacts.length,
      cooling: 0,
      unconverted: 0,
      wineryTop: null,
      upcomingHoliday: null
    };

    // Count cooling customers
    insights.cooling = contacts.filter(c => {
      const status = (c.sc_LifecycleStatus || '').toLowerCase();
      const isCustomer = c.sc_IsCustomer === true || c.sc_IsCustomer === 'TRUE';
      return isCustomer && status === 'cooling';
    }).length;

    // Count unconverted subscribers
    insights.unconverted = contacts.filter(c => {
      const isSubscribed = c.sc_IsSubscribed === true || c.sc_IsSubscribed === 'TRUE';
      const isCustomer = c.sc_IsCustomer === true || c.sc_IsCustomer === 'TRUE';
      const daysSubscribed = parseInt(c.sc_DaysSubscribed, 10) || 0;
      return isSubscribed && !isCustomer && daysSubscribed > config.subscriberConversionDays;
    }).length;

    // Find top winery cluster
    const wineryCounts = {};
    contacts.forEach(c => {
      const wineries = (c.sc_TopWineries || '').split(',').map(w => w.trim()).filter(w => w);
      if (wineries.length > 0) {
        const topWinery = wineries[0];
        wineryCounts[topWinery] = (wineryCounts[topWinery] || 0) + 1;
      }
    });

    let maxWinery = null;
    let maxCount = 0;
    for (const winery in wineryCounts) {
      if (wineryCounts[winery] > maxCount) {
        maxCount = wineryCounts[winery];
        maxWinery = winery;
      }
    }
    if (maxWinery) {
      insights.wineryTop = { name: maxWinery, count: maxCount };
    }

    // Check upcoming holiday
    const holidaySuggestion = _checkUpcomingHolidays();
    if (holidaySuggestion) {
      insights.upcomingHoliday = {
        name: holidaySuggestion.holiday,
        daysUntil: holidaySuggestion.daysUntil
      };
    }

    return insights;
  }

  // Public API
  return {
    runAnalysis: runAnalysis,
    getInsights: getInsights,
    getConfig: _getIntelligenceConfig
  };
})();

/**
 * Global function to run CRM intelligence analysis.
 * Run from Apps Script editor or scheduled trigger.
 */
function runCrmIntelligence() {
  return CrmIntelligenceService.runAnalysis();
}

/**
 * Global function to get current CRM insights.
 * Returns summary without creating tasks.
 */
function getCrmInsights() {
  return CrmIntelligenceService.getInsights();
}
