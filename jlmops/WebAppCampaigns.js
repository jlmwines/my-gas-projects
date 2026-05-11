/**
 * @file WebAppCampaigns.js
 * @description Controller functions for the marketing-campaign admin views
 *   (AdminCampaignsView, AdminCampaignDetailView, AdminCampaignServiceView)
 *   AND for the "Generate Outputs" button on Project Detail.
 *
 * Called from HTML views via google.script.run.
 *
 * Notes:
 *   - This file is the Campaigns / Campaign-Service controller — the
 *     attribution layer.
 *   - It is NOT to be confused with CampaignService.js (which pulls
 *     per-send metrics from Mailchimp into SysCampaigns). SysCampaigns
 *     rows are children of SysMarketingCampaigns via scm_MarketingCampaignId.
 */

/**
 * Convert Date objects to ISO strings for JSON serialization.
 */
function _wac_sanitizeForClient(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(_wac_sanitizeForClient);
  if (typeof obj === 'object') {
    const out = {};
    for (const k in obj) out[k] = _wac_sanitizeForClient(obj[k]);
    return out;
  }
  return obj;
}

// =====================================================================
// Campaign list / detail (AdminCampaignsView, AdminCampaignDetailView)
// =====================================================================

/**
 * List all marketing campaigns.
 * @returns {Object} { error: string|null, data: Array<Object> }
 */
function WebAppCampaigns_listCampaigns() {
  try {
    const campaigns = MarketingCampaignService.listCampaigns();
    return { error: null, data: _wac_sanitizeForClient(campaigns) };
  } catch (e) {
    logger.error('WebAppCampaigns', 'listCampaigns', e.message, e);
    return { error: e.message, data: [] };
  }
}

/**
 * Get a single campaign with its linked Projects and short URLs.
 * @param {string} campaignId
 * @returns {Object} { error, data: { campaign, projects, shortUrls } }
 */
function WebAppCampaigns_getCampaignDetail(campaignId) {
  try {
    if (!campaignId) throw new Error('campaignId is required');
    const campaign = MarketingCampaignService.getCampaign(campaignId);
    if (!campaign) {
      return { error: 'Campaign not found: ' + campaignId, data: null };
    }
    const projects = ProjectService.getAllProjects()
      .filter(p => p.spro_CampaignId === campaignId);
    const shortUrls = MarketingCampaignService.listShortUrls({ campaignId: campaignId });
    return {
      error: null,
      data: _wac_sanitizeForClient({
        campaign: campaign,
        projects: projects,
        shortUrls: shortUrls
      })
    };
  } catch (e) {
    logger.error('WebAppCampaigns', 'getCampaignDetail', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Provide options for dropdowns (Campaign list for Add-Project / Generate-Outputs forms).
 * @returns {Object} { error, data: Array<{id, name, status}> }
 */
function WebAppCampaigns_getCampaignOptions() {
  try {
    const campaigns = MarketingCampaignService.listCampaigns();
    return {
      error: null,
      data: campaigns
        .filter(c => (c.sm_Status || '').toUpperCase() !== 'ARCHIVED')
        .map(c => ({
          id: c.sm_CampaignId,
          name: c.sm_Name,
          status: c.sm_Status
        }))
    };
  } catch (e) {
    logger.error('WebAppCampaigns', 'getCampaignOptions', e.message, e);
    return { error: e.message, data: [] };
  }
}

// =====================================================================
// Campaign Service: Generate Outputs (Project Detail button + standalone)
// =====================================================================

/**
 * Generate Campaign Service outputs for a Distribution: utm-tagged URL +
 * short URL + QR image URL. Writes one row to SysShortUrls per language
 * (1 or 2 calls; caller passes language).
 *
 * @param {Object} params - { campaignId, projectId, language, slug,
 *                            targetUrl, medium, source, content, notes }
 * @returns {Object} { error, data: { shortCode, shortUrl, utmUrl, qrImageUrl } }
 */
function WebAppCampaigns_generateOutputs(params) {
  try {
    if (!params) throw new Error('params required');
    const result = MarketingCampaignService.createShortCode(params);
    return { error: null, data: _wac_sanitizeForClient(result) };
  } catch (e) {
    logger.error('WebAppCampaigns', 'generateOutputs', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * List short URLs filtered by project (used in Project Detail to show what's
 * been generated so far for this Distribution).
 *
 * @param {string} projectId
 * @returns {Object} { error, data: Array<Object> }
 */
function WebAppCampaigns_listShortUrlsForProject(projectId) {
  try {
    if (!projectId) throw new Error('projectId is required');
    const rows = MarketingCampaignService.listShortUrls({ projectId: projectId });
    return { error: null, data: _wac_sanitizeForClient(rows) };
  } catch (e) {
    logger.error('WebAppCampaigns', 'listShortUrlsForProject', e.message, e);
    return { error: e.message, data: [] };
  }
}

/**
 * List short URLs filtered by campaign (used in Campaign Detail view).
 *
 * @param {string} campaignId
 * @returns {Object} { error, data: Array<Object> }
 */
function WebAppCampaigns_listShortUrlsForCampaign(campaignId) {
  try {
    if (!campaignId) throw new Error('campaignId is required');
    const rows = MarketingCampaignService.listShortUrls({ campaignId: campaignId });
    return { error: null, data: _wac_sanitizeForClient(rows) };
  } catch (e) {
    logger.error('WebAppCampaigns', 'listShortUrlsForCampaign', e.message, e);
    return { error: e.message, data: [] };
  }
}
