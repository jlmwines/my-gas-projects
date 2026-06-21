/**
 * @file WebAppPublishing.js
 * @description Data endpoints for PublishingView — campaigns, projects, short URLs, distribution.
 */

const DISTRIBUTE_CAMPAIGNS = ['newsletter-print', 'email-broadcast', 'flyer-acquisition'];

const UTM_MAP = {
  'newsletter-print':  { medium: 'print', source: 'newsletter' },
  'email-broadcast':   { medium: 'email', source: 'mailchimp' },
  'flyer-acquisition': { medium: 'print', source: 'flyer' }
};

/**
 * Returns SysMarketingCampaigns + SysProjects + SysShortUrls for PublishingView.
 * @returns {Object} { success, data: { campaigns[], projects[], shortUrls[] } }
 */
function WebAppPublishing_getCampaignsAndProjects() {
  const serviceName = 'WebAppPublishing';
  const functionName = 'getCampaignsAndProjects';
  try {
    const rawCampaigns = MarketingCampaignService.listCampaigns();
    const campaigns = (rawCampaigns || []).map(function(c) {
      return {
        campaignId: c.sm_CampaignId || '',
        name: c.sm_Name || '',
        status: c.sm_Status || '',
        startDate: c.sm_StartDate ? String(c.sm_StartDate) : '',
        primaryGoal: c.sm_PrimaryGoal || '',
        notes: c.sm_Notes || '',
        projectId: c.sm_ProjectId || ''
      };
    }).filter(function(c) { return c.campaignId; });

    const rawProjects = ProjectService.getAllProjects();
    const projects = (rawProjects || []).map(function(p) {
      return {
        projectId: p.projectId || p.spro_ProjectId || '',
        name: p.name || p.spro_Name || '',
        type: p.type || p.spro_Type || '',
        status: p.status || p.spro_Status || ''
      };
    }).filter(function(p) { return p.projectId; });

    const shortUrls = _loadShortUrls();

    return { success: true, data: { campaigns: campaigns, projects: projects, shortUrls: shortUrls } };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

function _loadShortUrls() {
  try {
    const sheet = SheetAccessor.getDataSheet('SysShortUrls');
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];
    const headers = values[0];
    return values.slice(1).map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return {
        shortCode:   obj.ssu_ShortCode || '',
        campaignId:  obj.ssu_CampaignId || '',
        entitySlug:  obj.ssu_EntitySlug || '',
        language:    obj.ssu_Language || '',
        targetUrl:   obj.ssu_TargetUrl || '',
        createdDate: obj.ssu_CreatedDate ? String(obj.ssu_CreatedDate) : ''
      };
    }).filter(function(r) { return r.shortCode; });
  } catch (e) {
    return [];
  }
}

/**
 * Sets slb_CampaignId on a Library entity (admin-only field update).
 * @param {Object} params - { entityId, campaignId }
 * @returns {Object} { success, data: { entity }, error? }
 */
function WebAppPublishing_setEntityCampaign(params) {
  const serviceName = 'WebAppPublishing';
  const functionName = 'setEntityCampaign';
  try {
    const result = LibraryService.setEntityCampaign(params);
    return { success: true, data: result };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Creates a new campaign row in SysMarketingCampaigns.
 * @param {Object} params - { campaignId, name, status, primaryGoal, projectId }
 * @returns {Object} { success, error? }
 */
function WebAppPublishing_createCampaign(params) {
  const serviceName = 'WebAppPublishing';
  const functionName = 'createCampaign';
  try {
    const cid = (params.campaignId || '').trim();
    const name = (params.name || '').trim();
    if (!cid || !name) {
      return { success: false, error: 'Campaign ID and Name are required.' };
    }
    const existing = MarketingCampaignService.listCampaigns();
    if ((existing || []).some(function(c) { return c.sm_CampaignId === cid; })) {
      return { success: false, error: 'Campaign ID already exists: ' + cid };
    }
    const sheet = SheetAccessor.getDataSheet('SysMarketingCampaigns');
    const allConfig = ConfigService.getAllConfig();
    const headers = allConfig['schema.data.SysMarketingCampaigns'].headers.split(',');
    const row = headers.map(function(h) {
      if (h === 'sm_CampaignId') return cid;
      if (h === 'sm_Name') return name;
      if (h === 'sm_Status') return params.status || 'active';
      if (h === 'sm_PrimaryGoal') return params.primaryGoal || '';
      if (h === 'sm_ProjectId') return params.projectId || '';
      if (h === 'sm_StartDate') return '';
      if (h === 'sm_EndDate') return '';
      if (h === 'sm_Notes') return '';
      return '';
    });
    sheet.appendRow(row);
    LoggerService.info(serviceName, functionName, 'Created campaign: ' + cid);
    return { success: true };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Generates distribution outputs for a library entity:
 * - Builds UTM-tagged URL
 * - Derives short code from entity slug + language
 * - Writes one SysShortUrls row
 * - Returns { shortCode, utmUrl, shortUrl }
 *
 * @param {Object} params - { entitySlug, campaignId, language, targetUrl, contentMarker }
 * @returns {Object} { success, data: { shortCode, utmUrl, shortUrl }, error? }
 */
function WebAppPublishing_generateDistributeOutputs(params) {
  const serviceName = 'WebAppPublishing';
  const functionName = 'generateDistributeOutputs';
  try {
    const slug       = (params.entitySlug || '').trim();
    const campaignId = (params.campaignId || '').trim();
    const language   = (params.language || 'en').trim();
    const targetUrl  = (params.targetUrl || '').trim();
    const marker     = (params.contentMarker || '').trim();

    if (!slug || !campaignId || !targetUrl) {
      return { success: false, error: 'entitySlug, campaignId, and targetUrl are required.' };
    }

    const utm = UTM_MAP[campaignId];
    if (!utm) {
      return { success: false, error: 'Campaign "' + campaignId + '" is not a distribution campaign.' };
    }

    // Build UTM URL
    const sep = targetUrl.indexOf('?') === -1 ? '?' : '&';
    const utmUrl = targetUrl + sep +
      'utm_campaign=' + encodeURIComponent(campaignId) +
      '&utm_medium='  + encodeURIComponent(utm.medium) +
      '&utm_source='  + encodeURIComponent(utm.source) +
      (marker ? '&utm_content=' + encodeURIComponent(marker) : '');

    // Derive short code: strip type prefix + lang suffix from slug
    const topic = _extractTopic(slug);
    const shortCode = language === 'he' ? 'he/' + topic : topic;
    const shortUrl  = 'https://jlmwines.com/n/' + shortCode;

    // Write SysShortUrls row
    const sheet = SheetAccessor.getDataSheet('SysShortUrls');
    const allConfig = ConfigService.getAllConfig();
    const headers = allConfig['schema.data.SysShortUrls'].headers.split(',');
    const today = new Date().toISOString().slice(0, 10);
    const row = headers.map(function(h) {
      if (h === 'ssu_ShortCode')   return shortCode;
      if (h === 'ssu_CampaignId')  return campaignId;
      if (h === 'ssu_EntitySlug')  return slug;
      if (h === 'ssu_Language')    return language;
      if (h === 'ssu_TargetUrl')   return utmUrl;
      if (h === 'ssu_CreatedDate') return today;
      if (h === 'ssu_Notes')       return marker || '';
      return '';
    });
    sheet.appendRow(row);

    LoggerService.info(serviceName, functionName, 'Generated short URL: ' + shortCode + ' → ' + utmUrl);
    return { success: true, data: { shortCode: shortCode, utmUrl: utmUrl, shortUrl: shortUrl } };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/** Strips type prefix and language suffix from a library slug to get the topic. */
function _extractTopic(slug) {
  // Remove known type prefixes
  const prefixes = ['blog-', 'news-', 'email-', 'flyer-', 'template-', 'image-', 'other-', 'customer-', 'social-'];
  let s = slug;
  for (let i = 0; i < prefixes.length; i++) {
    if (s.indexOf(prefixes[i]) === 0) { s = s.slice(prefixes[i].length); break; }
  }
  // Remove trailing -en / -he
  if (s.slice(-3) === '-en' || s.slice(-3) === '-he') s = s.slice(0, -3);
  return s;
}
