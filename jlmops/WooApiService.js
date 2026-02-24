/**
 * @file WooApiService.js
 * @description GAS-native WooCommerce REST API client.
 * Single responsibility: HTTP communication with WooCommerce.
 * Read-only — no writes to WooCommerce.
 *
 * Auth: HTTP Basic Auth (consumer key as username, consumer secret as password).
 * Credentials stored in SysConfig under 'woo.api'.
 * Pagination: follows X-WP-TotalPages header.
 * Retry: exponential backoff on 429/5xx, configurable max retries.
 */

const WooApiService = (function() {
  const SERVICE_NAME = 'WooApiService';

  /** SysEnv spreadsheet ID — stores API keys separate from code-managed SysConfig. */
  const SYSENV_SPREADSHEET_ID = '1ESV9fJHKykPzy3kS88S9FWF46YodTuJ35O8MvfVModM';

  /**
   * Read WooCommerce API credentials from the SysEnv sheet.
   * SysEnv lives in a separate spreadsheet so credentials are never overwritten
   * by rebuildSysConfigFromSource().
   * Sheet columns: scf_SettingName | ... | scf_P01 (key type) | scf_P02 (key value)
   * @returns {{ consumer_key: string, consumer_secret: string }}
   */
  function _getCredentialsFromSysEnv() {
    var ss = SpreadsheetApp.openById(SYSENV_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('SysEnv');
    if (!sheet) {
      throw new Error('SysEnv sheet not found in spreadsheet ' + SYSENV_SPREADSHEET_ID);
    }
    var data = sheet.getDataRange().getValues();
    var creds = {};
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === 'woo.api') {
        creds[String(data[i][3]).trim()] = String(data[i][4]).trim();
      }
    }
    return creds;
  }

  /**
   * Get API configuration.
   * Non-secret settings (base_url, retry) from SysConfig.
   * Credentials (consumer_key, consumer_secret) from SysEnv sheet.
   * @returns {object} { baseUrl, consumerKey, consumerSecret, retryMax, retryDelayMs }
   */
  function _getApiConfig() {
    const config = ConfigService.getConfig('woo.api');
    if (!config) {
      throw new Error('WooCommerce API configuration (woo.api) not found in SysConfig.');
    }

    const baseUrl = config.base_url;
    if (!baseUrl) {
      throw new Error('woo.api.base_url not set in SysConfig.');
    }

    // Credentials from SysEnv (separate spreadsheet, safe from rebuildSysConfigFromSource)
    var creds = _getCredentialsFromSysEnv();
    var consumerKey = creds.consumer_key;
    var consumerSecret = creds.consumer_secret;

    if (!consumerKey || !consumerSecret) {
      throw new Error('WooCommerce API credentials not found in SysEnv sheet. Expected woo.api rows with consumer_key and consumer_secret in scf_P01/scf_P02.');
    }

    return {
      baseUrl: baseUrl.replace(/\/+$/, ''), // Strip trailing slash
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      retryMax: parseInt(config.retry_max, 10) || 3,
      retryDelayMs: parseInt(config.retry_delay_ms, 10) || 2000
    };
  }

  /**
   * Core HTTP fetch wrapper for WooCommerce REST API.
   * Handles auth, query params, retries with exponential backoff.
   *
   * @param {string} method - HTTP method (GET)
   * @param {string} endpoint - API endpoint path (e.g., '/wc/v3/products')
   * @param {object} [params={}] - Query parameters
   * @returns {object} { data: parsed JSON, headers: response headers }
   */
  function _fetch(method, endpoint, params) {
    params = params || {};
    const config = _getApiConfig();

    // Build query string
    const queryParts = [];
    Object.keys(params).forEach(function(key) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    });
    const queryString = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
    const url = config.baseUrl + '/wp-json' + endpoint + queryString;

    // HTTP Basic Auth
    const authHeader = 'Basic ' + Utilities.base64Encode(config.consumerKey + ':' + config.consumerSecret);

    const options = {
      method: method.toLowerCase(),
      headers: {
        'Authorization': authHeader
      },
      muteHttpExceptions: true
    };

    // Retry logic with exponential backoff
    let lastError = null;
    for (let attempt = 0; attempt <= config.retryMax; attempt++) {
      if (attempt > 0) {
        const delay = config.retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn(SERVICE_NAME, '_fetch', 'Retrying after ' + delay + 'ms (attempt ' + (attempt + 1) + '/' + (config.retryMax + 1) + ')');
        Utilities.sleep(delay);
      }

      try {
        var response = UrlFetchApp.fetch(url, options);
        var statusCode = response.getResponseCode();

        // Success
        if (statusCode >= 200 && statusCode < 300) {
          var data = JSON.parse(response.getContentText());
          return {
            data: data,
            headers: response.getHeaders()
          };
        }

        // Rate limited or server error — retry
        if (statusCode === 429 || statusCode >= 500) {
          lastError = new Error('HTTP ' + statusCode + ': ' + response.getContentText().substring(0, 200));
          logger.warn(SERVICE_NAME, '_fetch', 'HTTP ' + statusCode + ' on ' + endpoint + ' — will retry', { data: { attempt: attempt + 1, url: url } });
          continue;
        }

        // Client error (4xx except 429) — don't retry
        throw new Error('HTTP ' + statusCode + ': ' + response.getContentText().substring(0, 500));

      } catch (e) {
        if (e.message && e.message.indexOf('HTTP ') === 0 && e.message.indexOf('HTTP 429') === -1 && e.message.indexOf('HTTP 5') === -1) {
          // Non-retryable HTTP error — throw immediately
          throw e;
        }
        lastError = e;
        // Network error or retryable HTTP error — continue retry loop
      }
    }

    // All retries exhausted
    throw new Error('WooCommerce API request failed after ' + (config.retryMax + 1) + ' attempts: ' + (lastError ? lastError.message : 'Unknown error'));
  }

  /**
   * Fetch all pages of a paginated WooCommerce API endpoint.
   * Follows X-WP-TotalPages header until all pages are consumed.
   *
   * @param {string} endpoint - API endpoint path
   * @param {object} [params={}] - Query parameters (per_page defaults to 100)
   * @returns {Array} All items across all pages
   */
  function _fetchAllPages(endpoint, params) {
    params = params || {};
    if (!params.per_page) {
      params.per_page = 100; // Woo API max
    }

    var allItems = [];
    var page = 1;
    var totalPages = 1;

    while (page <= totalPages) {
      params.page = page;
      var result = _fetch('GET', endpoint, params);

      if (result.data && result.data.length > 0) {
        allItems = allItems.concat(result.data);
      }

      // Parse total pages from response header
      var headerTotalPages = result.headers['x-wp-totalpages'] || result.headers['X-WP-TotalPages'];
      if (headerTotalPages) {
        totalPages = parseInt(headerTotalPages, 10);
      }

      var headerTotalItems = result.headers['x-wp-total'] || result.headers['X-WP-Total'];

      if (page === 1) {
        logger.info(SERVICE_NAME, '_fetchAllPages', 'Fetching ' + endpoint + ': page 1/' + totalPages + ' (total items: ' + (headerTotalItems || '?') + ')');
      }

      // If we got fewer items than per_page, we're done
      if (!result.data || result.data.length < params.per_page) {
        break;
      }

      page++;
    }

    logger.info(SERVICE_NAME, '_fetchAllPages', 'Completed ' + endpoint + ': ' + allItems.length + ' items across ' + page + ' pages');
    return allItems;
  }

  /**
   * Fetch products from WooCommerce REST API.
   *
   * @param {string} [lang='en'] - Language code for WPML ('en' or 'he')
   * @param {string} [modifiedAfter] - ISO timestamp to fetch only products modified after this date
   * @returns {Array} Array of WooCommerce product objects
   */
  function fetchProducts(lang, modifiedAfter) {
    var functionName = 'fetchProducts';
    lang = lang || 'en';

    var params = {
      lang: lang,
      status: 'any',
      orderby: 'id',
      order: 'asc'
    };

    if (modifiedAfter) {
      params.modified_after = modifiedAfter;
    }

    logger.info(SERVICE_NAME, functionName, 'Fetching ' + lang.toUpperCase() + ' products' + (modifiedAfter ? ' modified after ' + modifiedAfter : ' (full pull)'));

    var products = _fetchAllPages('/wc/v3/products', params);

    logger.info(SERVICE_NAME, functionName, 'Fetched ' + products.length + ' ' + lang.toUpperCase() + ' products');
    return products;
  }

  /**
   * Fetch orders from WooCommerce REST API.
   *
   * @param {string} [modifiedAfter] - ISO timestamp to fetch only orders modified after this date
   * @param {string|Array} [status] - Order status(es) to filter. Defaults to processing,on-hold,completed,cancelled,refunded.
   * @returns {Array} Array of WooCommerce order objects
   */
  function fetchOrders(modifiedAfter, status) {
    var functionName = 'fetchOrders';

    var params = {
      orderby: 'date',
      order: 'desc'
    };

    if (modifiedAfter) {
      params.modified_after = modifiedAfter;
    }

    // Default statuses to pull
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    } else {
      params.status = 'processing,on-hold,completed,cancelled,refunded';
    }

    logger.info(SERVICE_NAME, functionName, 'Fetching orders' + (modifiedAfter ? ' modified after ' + modifiedAfter : ' (full pull)') + ' with status: ' + params.status);

    var orders = _fetchAllPages('/wc/v3/orders', params);

    logger.info(SERVICE_NAME, functionName, 'Fetched ' + orders.length + ' orders');
    return orders;
  }

  /**
   * Test the WooCommerce API connection.
   * Verifies credentials work and returns basic store info.
   *
   * @returns {object} { success: boolean, message: string, productCount: number, orderCount: number }
   */
  function testConnection() {
    var functionName = 'testConnection';
    logger.info(SERVICE_NAME, functionName, 'Testing WooCommerce API connection...');

    try {
      // Test basic auth with a minimal products request
      var enResult = _fetch('GET', '/wc/v3/products', { per_page: 1, lang: 'en' });
      var enTotal = parseInt(enResult.headers['x-wp-total'] || enResult.headers['X-WP-Total'] || '0', 10);

      // Test Hebrew language parameter
      var heResult = _fetch('GET', '/wc/v3/products', { per_page: 1, lang: 'he' });
      var heTotal = parseInt(heResult.headers['x-wp-total'] || heResult.headers['X-WP-Total'] || '0', 10);

      // Test orders endpoint
      var orderResult = _fetch('GET', '/wc/v3/orders', { per_page: 1 });
      var orderTotal = parseInt(orderResult.headers['x-wp-total'] || orderResult.headers['X-WP-Total'] || '0', 10);

      var message = 'Connection successful. EN products: ' + enTotal + ', HE products: ' + heTotal + ', Orders: ' + orderTotal;
      logger.info(SERVICE_NAME, functionName, message);

      return {
        success: true,
        message: message,
        productCountEN: enTotal,
        productCountHE: heTotal,
        orderCount: orderTotal
      };
    } catch (e) {
      var errorMsg = 'Connection failed: ' + e.message;
      logger.error(SERVICE_NAME, functionName, errorMsg, e);
      return {
        success: false,
        message: errorMsg,
        productCountEN: 0,
        productCountHE: 0,
        orderCount: 0
      };
    }
  }

  return {
    fetchProducts: fetchProducts,
    fetchOrders: fetchOrders,
    testConnection: testConnection,
    // Exposed for use by pull services that need single-page fetches
    _fetch: _fetch,
    _fetchAllPages: _fetchAllPages
  };
})();

/**
 * Global function to test WooCommerce API connection from Apps Script editor.
 * @returns {object} Connection test result
 */
function testWooApiConnection() {
  return WooApiService.testConnection();
}
