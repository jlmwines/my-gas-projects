/**
 * @file WebAppPublishing.js
 * @description Data endpoints for PublishingView — campaigns, projects.
 * Part of PUBLISHING_VIEW_PLAN.md Deploy 2.
 */

/**
 * Returns SysMarketingCampaigns + SysProjects rows for PublishingView tabs.
 * @returns {Object} { success, data: { campaigns[], projects[] } }
 */
function WebAppPublishing_getCampaignsAndProjects() {
  const serviceName = 'WebAppPublishing';
  const functionName = 'getCampaignsAndProjects';
  try {
    const cfg = ConfigService.getConfig();
    const sheetNames = cfg.sheetNames || {};

    const campaignsSheet = SheetAccessor.getDataSheet(sheetNames.SysMarketingCampaigns || 'SysMarketingCampaigns', false);
    const campaigns = campaignsSheet ? _sheetToObjects(campaignsSheet).map(function(row) {
      return {
        campaignId: row.sm_CampaignId || '',
        name: row.sm_Name || '',
        status: row.sm_Status || '',
        startDate: row.sm_StartDate ? String(row.sm_StartDate) : '',
        endDate: row.sm_EndDate ? String(row.sm_EndDate) : '',
        primaryGoal: row.sm_PrimaryGoal || '',
        notes: row.sm_Notes || '',
        projectId: row.sm_ProjectId || ''
      };
    }).filter(function(c) { return c.campaignId; }) : [];

    const projectsSheet = SheetAccessor.getDataSheet(sheetNames.SysProjects || 'SysProjects', false);
    const projects = projectsSheet ? _sheetToObjects(projectsSheet).map(function(row) {
      return {
        projectId: row.spro_ProjectId || '',
        name: row.spro_Name || '',
        type: row.spro_Type || '',
        status: row.spro_Status || '',
        startDate: row.spro_StartDate ? String(row.spro_StartDate) : '',
        endDate: row.spro_EndDate ? String(row.spro_EndDate) : ''
      };
    }).filter(function(p) { return p.projectId; }) : [];

    return { success: true, data: { campaigns: campaigns, projects: projects } };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

function _sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}
