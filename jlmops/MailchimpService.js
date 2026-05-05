/**
 * @file MailchimpService.js
 * @description GAS-native Mailchimp Marketing API client.
 * Single responsibility: HTTP communication with Mailchimp.
 *
 * Auth: HTTP Basic (any username, API key as password).
 * Credentials stored in SysEnv sheet under setting 'mailchimp.api', p01='api_key'.
 * Datacenter parsed from key suffix (e.g. '...-us5' → 'us5').
 * Pagination: Mailchimp uses count + offset query params; response carries total_items.
 */

const MailchimpService = (function() {
  const SERVICE_NAME = 'MailchimpService';

  // SysEnv lives in a separate spreadsheet so credentials are never overwritten
  // by rebuildSysConfigFromSource(). Same spreadsheet ID as WooApiService.
  const SYSENV_SPREADSHEET_ID = '1ESV9fJHKykPzy3kS88S9FWF46YodTuJ35O8MvfVModM';

  const PAGE_SIZE_DEFAULT = 1000;
  const RETRY_MAX = 3;
  const RETRY_DELAY_MS = 2000;

  function _getApiKey() {
    const ss = SpreadsheetApp.openById(SYSENV_SPREADSHEET_ID);
    const sheet = ss.getSheetByName('SysEnv');
    if (!sheet) {
      throw new Error('SysEnv sheet not found in spreadsheet ' + SYSENV_SPREADSHEET_ID);
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === 'mailchimp.api'
          && String(data[i][3]).trim() === 'api_key') {
        return String(data[i][4]).trim();
      }
    }
    throw new Error('Mailchimp API key not found in SysEnv. Expected setting "mailchimp.api", scf_P01="api_key".');
  }

  function _parseDc(apiKey) {
    const idx = apiKey.lastIndexOf('-');
    if (idx === -1 || idx === apiKey.length - 1) {
      throw new Error('Mailchimp API key missing datacenter suffix (expected format <hex>-<dc>).');
    }
    return apiKey.substring(idx + 1);
  }

  function _baseUrl(apiKey) {
    return 'https://' + _parseDc(apiKey) + '.api.mailchimp.com/3.0';
  }

  function _fetch(method, path, params, body) {
    params = params || {};
    const apiKey = _getApiKey();

    const queryParts = [];
    Object.keys(params).forEach(function(key) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    });
    const queryString = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
    const url = _baseUrl(apiKey) + path + queryString;

    const authHeader = 'Basic ' + Utilities.base64Encode('jlmops:' + apiKey);

    const options = {
      method: method.toLowerCase(),
      headers: { 'Authorization': authHeader },
      muteHttpExceptions: true
    };
    if (body !== undefined && body !== null) {
      options.contentType = 'application/json';
      options.payload = JSON.stringify(body);
    }

    let lastError = null;
    for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
      if (attempt > 0) {
        Utilities.sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
        LoggerService.warn(SERVICE_NAME, '_fetch', 'Retry attempt ' + (attempt + 1) + '/' + (RETRY_MAX + 1) + ' for ' + path);
      }
      try {
        const response = UrlFetchApp.fetch(url, options);
        const statusCode = response.getResponseCode();
        if (statusCode >= 200 && statusCode < 300) {
          return JSON.parse(response.getContentText());
        }
        if (statusCode === 429 || statusCode >= 500) {
          lastError = new Error('HTTP ' + statusCode + ': ' + response.getContentText().substring(0, 200));
          LoggerService.warn(SERVICE_NAME, '_fetch', 'HTTP ' + statusCode + ' on ' + path + ' — will retry');
          continue;
        }
        throw new Error('HTTP ' + statusCode + ': ' + response.getContentText().substring(0, 500));
      } catch (e) {
        if (e.message && e.message.indexOf('HTTP ') === 0
            && e.message.indexOf('HTTP 429') === -1
            && e.message.indexOf('HTTP 5') === -1) {
          throw e;
        }
        lastError = e;
      }
    }
    throw new Error('Mailchimp API request failed after ' + (RETRY_MAX + 1) + ' attempts: ' + (lastError ? lastError.message : 'Unknown error'));
  }

  /**
   * GET a single Mailchimp endpoint.
   * @param {string} path - e.g. '/lists/8a3c6dd69c'
   * @param {Object} [params] - query string parameters
   * @returns {Object} parsed JSON response
   */
  function get(path, params) {
    return _fetch('GET', path, params, null);
  }

  /**
   * Paginate a Mailchimp collection endpoint via count + offset.
   * @param {string} path - e.g. '/lists/8a3c6dd69c/members'
   * @param {Object} [params] - additional query parameters (count is set automatically)
   * @param {string} collectionKey - response key holding the array (e.g. 'members', 'campaigns')
   * @returns {Array} concatenated items across all pages
   */
  function paginate(path, params, collectionKey) {
    if (!collectionKey) {
      throw new Error('paginate() requires a collectionKey argument.');
    }
    params = params || {};
    const count = params.count || PAGE_SIZE_DEFAULT;
    let offset = 0;
    let totalItems = null;
    const all = [];

    while (true) {
      const pageParams = Object.assign({}, params, { count: count, offset: offset });
      const response = _fetch('GET', path, pageParams, null);
      const items = response[collectionKey];
      if (!Array.isArray(items)) {
        throw new Error('paginate(): response key "' + collectionKey + '" is not an array on ' + path);
      }
      if (offset === 0) {
        totalItems = response.total_items;
        LoggerService.info(SERVICE_NAME, 'paginate', 'Fetching ' + path + ': total ' + (totalItems != null ? totalItems : '?') + ' items');
      }
      all.push.apply(all, items);
      if (items.length < count) break;
      offset += count;
      if (totalItems != null && offset >= totalItems) break;
    }

    LoggerService.info(SERVICE_NAME, 'paginate', 'Completed ' + path + ': ' + all.length + ' items');
    return all;
  }

  // JLM Wines audience identifiers — single audience, immutable in practice.
  const AUDIENCE = {
    listId: '8a3c6dd69c',
    langGroupId: '8b945481c0',
    interestEnId: '17072990c9',
    interestHeId: '962feef4ab'
  };

  return {
    get: get,
    paginate: paginate,
    AUDIENCE: AUDIENCE
  };
})();

/**
 * Editor smoke test — verify SysEnv key + DC parsing + auth.
 * Selectable from Apps Script function picker.
 */
function smokeMailchimp() {
  const list = MailchimpService.get('/lists/8a3c6dd69c');
  Logger.log(list.name + ' — ' + list.stats.member_count + ' members');
  return list;
}
