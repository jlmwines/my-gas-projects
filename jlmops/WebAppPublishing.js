/**
 * @file WebAppPublishing.js
 * @description Data endpoints for PublishingView — campaigns, projects.
 * Part of PUBLISHING_VIEW_PLAN.md Deploy 2.
 */

/**
 * Returns SysMarketingCampaigns + SysProjects rows for PublishingView tabs.
 * Uses the existing service layer (same as WebAppCampaigns + WebAppProjects).
 * @returns {Object} { success, data: { campaigns[], projects[] } }
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

    return { success: true, data: { campaigns: campaigns, projects: projects } };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}
