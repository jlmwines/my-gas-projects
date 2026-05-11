/**
 * @file MarketingCampaignService.js
 * @description Top-level marketing campaign management — the attribution layer.
 *
 * Owns SysMarketingCampaigns (the campaign container) and SysShortUrls (short
 * code → utm-tagged URL mappings). Distribution Projects link to campaigns via
 * spro_CampaignId. See jlmops/plans/CAMPAIGN_ARCHITECTURE.md.
 *
 * NOT the same as CampaignService.js (which pulls Mailchimp send metrics into
 * SysCampaigns — a child of SysMarketingCampaigns via scm_MarketingCampaignId).
 */

const MarketingCampaignService = (function () {
  const SERVICE_NAME = 'MarketingCampaignService';

  // Seed Campaigns at launch — only the channel programs that are active today.
  // Additional ongoing programs (flyer-acquisition, social-organic) get seeded
  // when those channels actually go live, not pre-emptively.
  const SEED_CAMPAIGNS = [
    {
      sm_CampaignId: 'newsletter-print',
      sm_Name: 'Print Newsletter — Wine Talk',
      sm_Status: 'ACTIVE',
      sm_StartDate: '',
      sm_EndDate: '',
      sm_PrimaryGoal: 'Build editorial trust + drive engagement via monthly print insert.',
      sm_Notes: 'Ongoing channel program. Each issue is a Distribution Project (PROJ-NL-...). utm_source=wine-talk, utm_medium=print.'
    },
    {
      sm_CampaignId: 'email-broadcast',
      sm_Name: 'Email Broadcast — Mailchimp',
      sm_Status: 'ACTIVE',
      sm_StartDate: '',
      sm_EndDate: '',
      sm_PrimaryGoal: 'Reach subscribed audience with editorial content and offers.',
      sm_Notes: 'Ongoing channel program. Each send is a Distribution Project (PROJ-CMP-...). utm_source=mailchimp, utm_medium=email; per-send utm_content distinguishes individual sends.'
    }
  ];

  function _getSheet(sheetKey) {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const name = sheetNames[sheetKey] || sheetKey;
    return SheetAccessor.getDataSheet(name, true);
  }

  function _getHeaders(sheet) {
    const data = sheet.getDataRange().getValues();
    return data.length ? data[0] : [];
  }

  function _rowToObject(headers, row) {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }

  function _objectToRow(headers, obj) {
    return headers.map(h => obj[h] !== undefined ? obj[h] : '');
  }

  /**
   * Returns all rows from SysMarketingCampaigns as objects.
   * @returns {Array<Object>}
   */
  function listCampaigns() {
    const sheet = _getSheet('SysMarketingCampaigns');
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    return data.slice(1)
      .filter(row => row[0])
      .map(row => _rowToObject(headers, row));
  }

  /**
   * Returns one campaign by ID, or null.
   * @param {string} campaignId
   * @returns {Object|null}
   */
  function getCampaign(campaignId) {
    if (!campaignId) return null;
    return listCampaigns().find(c => c.sm_CampaignId === campaignId) || null;
  }

  /**
   * Seeds the two launch campaigns (newsletter-print, email-broadcast).
   * Idempotent — skips any row whose CampaignId already exists.
   * Intended for one-time manual invocation from the Apps Script editor after
   * rebuildSysConfigFromSource() creates the sheet.
   *
   * @returns {Object} Summary { inserted, skipped, errors }
   */
  function seedDefaultCampaigns() {
    const fnName = 'seedDefaultCampaigns';
    LoggerService.info(SERVICE_NAME, fnName, 'Starting seed of default campaigns');

    const sheet = _getSheet('SysMarketingCampaigns');
    const data = sheet.getDataRange().getValues();
    let headers = data.length ? data[0] : [];

    // If sheet is empty (no header row), write headers first using the schema.
    if (!headers.length || !headers[0]) {
      const allConfig = ConfigService.getAllConfig();
      const schemaCfg = allConfig['schema.data.SysMarketingCampaigns'];
      if (!schemaCfg || !schemaCfg.headers) {
        const msg = 'Cannot resolve SysMarketingCampaigns schema headers; aborting seed.';
        LoggerService.warn(SERVICE_NAME, fnName, msg);
        return { inserted: 0, skipped: 0, errors: [msg] };
      }
      headers = schemaCfg.headers.split(',').map(h => h.trim());
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      LoggerService.info(SERVICE_NAME, fnName, `Wrote header row: ${headers.join(', ')}`);
    }

    const existing = new Set(
      data.slice(1)
        .map(row => row[0])
        .filter(v => v)
    );

    const summary = { inserted: 0, skipped: 0, errors: [] };
    const rowsToAppend = [];

    for (const campaign of SEED_CAMPAIGNS) {
      if (existing.has(campaign.sm_CampaignId)) {
        LoggerService.info(SERVICE_NAME, fnName, `Skipping ${campaign.sm_CampaignId} — already exists`);
        summary.skipped++;
        continue;
      }
      rowsToAppend.push(_objectToRow(headers, campaign));
      summary.inserted++;
    }

    if (rowsToAppend.length) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
      LoggerService.info(SERVICE_NAME, fnName, `Inserted ${rowsToAppend.length} campaign row(s)`);
    }

    LoggerService.info(SERVICE_NAME, fnName, `Seed complete: ${summary.inserted} inserted, ${summary.skipped} skipped`);
    return summary;
  }

  // ============================================================
  // UTM Builder
  // ============================================================

  /**
   * Build a utm-tagged URL from inputs.
   *
   * @param {Object} params
   * @param {string} params.targetUrl - Destination URL (the content being linked to).
   * @param {string} params.campaignId - sm_CampaignId (e.g., 'newsletter-print').
   * @param {string} params.medium    - utm_medium (e.g., 'print', 'email', 'social', 'flyer').
   * @param {string} params.source    - utm_source vehicle (e.g., 'wine-talk', 'mailchimp', 'flyer-frenchhill').
   * @param {string} [params.content] - utm_content asset marker (optional; e.g., issue date or content variant).
   * @returns {string} utm-tagged URL
   */
  function buildUtmUrl(params) {
    const { targetUrl, campaignId, medium, source, content } = params || {};
    if (!targetUrl) throw new Error('buildUtmUrl: targetUrl is required');
    if (!campaignId) throw new Error('buildUtmUrl: campaignId is required');
    if (!medium) throw new Error('buildUtmUrl: medium is required');
    if (!source) throw new Error('buildUtmUrl: source is required');

    const parts = [
      'utm_campaign=' + encodeURIComponent(campaignId),
      'utm_medium=' + encodeURIComponent(medium),
      'utm_source=' + encodeURIComponent(source)
    ];
    if (content) parts.push('utm_content=' + encodeURIComponent(content));

    const sep = targetUrl.indexOf('?') === -1 ? '?' : '&';
    return targetUrl + sep + parts.join('&');
  }

  // ============================================================
  // Short URL Service
  // ============================================================

  const SHORT_URL_BASE = 'https://jlmwines.com/n/';

  /**
   * Build the public-facing short URL from a stored ShortCode (which includes
   * the language path segment, e.g. 'en/context-202605').
   * @param {string} shortCode
   * @returns {string}
   */
  function buildShortUrl(shortCode) {
    return SHORT_URL_BASE + shortCode;
  }

  /**
   * Slugify a string for use in a short code (lowercase, alphanumeric + hyphens).
   * @param {string} s
   * @returns {string}
   */
  function _slugify(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 60);
  }

  /**
   * Generate a short code for a (language, slug) pair.
   * Result: '<lang>/<slug>' — used as ssu_ShortCode (PK) and appended to SHORT_URL_BASE.
   * @param {string} language - 'en' or 'he'
   * @param {string} slug - base slug; if empty, a random suffix is used
   * @returns {string}
   */
  function _composeShortCode(language, slug) {
    const lang = (language === 'he') ? 'he' : 'en';
    const baseSlug = _slugify(slug) || _randomCode(6);
    return lang + '/' + baseSlug;
  }

  /**
   * Produce a 6-char random alphanumeric code (lowercase). Used as fallback
   * when no slug is provided.
   * @param {number} length
   * @returns {string}
   */
  function _randomCode(length) {
    const alpha = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alpha.charAt(Math.floor(Math.random() * alpha.length));
    }
    return out;
  }

  /**
   * Create a short URL entry: builds the utm-tagged target URL, generates the
   * short code, stores the row in SysShortUrls, and (TODO) pushes the redirect
   * rule to RankMath. Returns a bundle the partner uses in print/email/social.
   *
   * @param {Object} params
   * @param {string} params.campaignId
   * @param {string} [params.projectId] - link to the Distribution Project (nullable for ad-hoc)
   * @param {string} params.language    - 'en' or 'he'
   * @param {string} params.slug        - base slug (e.g., 'context-202605')
   * @param {string} params.targetUrl   - destination URL (the content being linked to)
   * @param {string} params.medium
   * @param {string} params.source
   * @param {string} [params.content]
   * @param {string} [params.notes]
   * @returns {Object} { shortCode, shortUrl, utmUrl, qrImageUrl }
   */
  function createShortCode(params) {
    const fnName = 'createShortCode';
    const { campaignId, projectId, language, slug, targetUrl, medium, source, content, notes } = params || {};

    if (!campaignId) throw new Error(fnName + ': campaignId is required');
    if (!language)   throw new Error(fnName + ': language is required');
    if (!targetUrl)  throw new Error(fnName + ': targetUrl is required');
    if (!medium)     throw new Error(fnName + ': medium is required');
    if (!source)     throw new Error(fnName + ': source is required');

    const utmUrl = buildUtmUrl({ targetUrl, campaignId, medium, source, content });

    // Ensure a unique short code (retry with a random suffix on collision).
    let shortCode = _composeShortCode(language, slug);
    const existing = listShortUrls();
    const taken = new Set(existing.map(r => r.ssu_ShortCode));
    let attempt = 0;
    while (taken.has(shortCode) && attempt < 10) {
      shortCode = _composeShortCode(language, (slug ? slug + '-' : '') + _randomCode(4));
      attempt++;
    }
    if (taken.has(shortCode)) {
      throw new Error(fnName + ': could not generate unique short code after 10 attempts');
    }

    const row = {
      ssu_ShortCode:  shortCode,
      ssu_CampaignId: campaignId,
      ssu_ProjectId:  projectId || '',
      ssu_Language:   language,
      ssu_TargetUrl:  utmUrl,
      ssu_CreatedDate: new Date().toISOString(),
      ssu_Notes:      notes || ''
    };

    _writeShortUrlRow(row);
    _pushToRankMath(shortCode, utmUrl);

    const shortUrl = buildShortUrl(shortCode);
    return {
      shortCode:   shortCode,
      shortUrl:    shortUrl,
      utmUrl:      utmUrl,
      qrImageUrl:  getQrImageUrl(shortUrl)
    };
  }

  /**
   * Append a row to SysShortUrls. Writes the header row if the sheet is empty.
   * @param {Object} row - keys matching ssu_* columns
   */
  function _writeShortUrlRow(row) {
    const sheet = _getSheet('SysShortUrls');
    const data = sheet.getDataRange().getValues();
    let headers = data.length ? data[0] : [];

    if (!headers.length || !headers[0]) {
      const allConfig = ConfigService.getAllConfig();
      const schemaCfg = allConfig['schema.data.SysShortUrls'];
      if (!schemaCfg || !schemaCfg.headers) {
        throw new Error('_writeShortUrlRow: SysShortUrls schema headers not found in config');
      }
      headers = schemaCfg.headers.split(',').map(h => h.trim());
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const rowArr = _objectToRow(headers, row);
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, 1, headers.length).setValues([rowArr]);
  }

  /**
   * List all SysShortUrls rows (optionally filtered).
   * @param {Object} [filter] - { campaignId, projectId, language }
   * @returns {Array<Object>}
   */
  function listShortUrls(filter) {
    const sheet = _getSheet('SysShortUrls');
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    let rows = data.slice(1)
      .filter(row => row[0])
      .map(row => _rowToObject(headers, row));
    if (filter) {
      if (filter.campaignId) rows = rows.filter(r => r.ssu_CampaignId === filter.campaignId);
      if (filter.projectId)  rows = rows.filter(r => r.ssu_ProjectId === filter.projectId);
      if (filter.language)   rows = rows.filter(r => r.ssu_Language === filter.language);
    }
    return rows;
  }

  /**
   * Look up one row by short code, or null.
   * @param {string} shortCode
   * @returns {Object|null}
   */
  function getShortUrl(shortCode) {
    if (!shortCode) return null;
    return listShortUrls().find(r => r.ssu_ShortCode === shortCode) || null;
  }

  // ============================================================
  // QR Image Helper
  // ============================================================

  const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

  /**
   * Build a QR image URL for a target URL. Returns a URL the partner can
   * download or embed as an <img>. SVG format by default so it scales to
   * print resolution cleanly.
   *
   * @param {string} url - The URL to encode in the QR.
   * @param {Object} [opts]
   * @param {number} [opts.sizePx=300] - pixel dimension (square).
   * @param {string} [opts.format='svg'] - 'svg' or 'png'.
   * @param {string} [opts.ecc='Q'] - error correction level: L / M / Q / H.
   * @returns {string}
   */
  function getQrImageUrl(url, opts) {
    const o = opts || {};
    const sizePx = o.sizePx || 300;
    const format = o.format || 'svg';
    const ecc    = o.ecc    || 'Q';
    const params = [
      'data=' + encodeURIComponent(url),
      'size=' + sizePx + 'x' + sizePx,
      'format=' + format,
      'ecc=' + ecc
    ];
    return QR_API_BASE + '?' + params.join('&');
  }

  // ============================================================
  // RankMath Redirect Push (TODO — integration pending verification)
  // ============================================================

  /**
   * Push a new redirect rule to RankMath so /n/<shortCode> redirects to
   * <targetUrl>. Stubbed pending verification of RankMath's integration
   * surface (API/hook vs direct DB write). Currently logs the intent so the
   * row can be hand-created in wp-admin until the integration ships.
   *
   * @param {string} shortCode
   * @param {string} targetUrl
   */
  function _pushToRankMath(shortCode, targetUrl) {
    const fnName = '_pushToRankMath';
    const sourcePath = '/n/' + shortCode;
    LoggerService.warn(SERVICE_NAME, fnName,
      'TODO: push RankMath redirect rule — source=' + sourcePath + ' → target=' + targetUrl +
      '. Integration pending. Create manually in wp-admin → RankMath → Redirections until then.'
    );
  }

  return {
    listCampaigns:        listCampaigns,
    getCampaign:          getCampaign,
    seedDefaultCampaigns: seedDefaultCampaigns,
    buildUtmUrl:          buildUtmUrl,
    buildShortUrl:        buildShortUrl,
    createShortCode:      createShortCode,
    listShortUrls:        listShortUrls,
    getShortUrl:          getShortUrl,
    getQrImageUrl:        getQrImageUrl
  };
})();

/**
 * Top-level wrapper for manual invocation from Apps Script editor.
 */
function seedMarketingCampaigns() {
  return MarketingCampaignService.seedDefaultCampaigns();
}
