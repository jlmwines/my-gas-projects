/**
 * @file CampaignService.js
 * @description This service manages campaigns.
 * It handles the creation, management, and retrieval of marketing campaigns.
 */

/**
 * CampaignService provides methods for managing marketing campaigns.
 */
function CampaignService() {
  const CAMPAIGN_SHEET_NAME = "Campaigns"; // Assuming a sheet for campaign definitions

  /**
   * Creates a new marketing campaign.
   * @param {Object} campaignData The data for the new campaign (e.g., { name: "...", startDate: "...", endDate: "...", status: "..." }).
   * @returns {Object|null} The created campaign object with an ID, or null if creation fails.
   */
  this.createCampaign = function(campaignData) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(CAMPAIGN_SHEET_NAME);

      if (!sheet) {
        logger.error(`Campaign sheet '${CAMPAIGN_SHEET_NAME}' not found.`);
        return null;
      }

      // Get headers to ensure correct column order
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow = [];

      // Map campaignData to the correct column order
      headers.forEach(header => {
        newRow.push(campaignData[header] !== undefined ? campaignData[header] : '');
      });

      // Assign a simple unique ID (for demonstration, in real app use Utilities.getUuid() or similar)
      const campaignId = Utilities.getUuid();
      // Assuming 'ID' is one of the headers
      const idIndex = headers.indexOf('ID');
      if (idIndex !== -1) {
        newRow[idIndex] = campaignId;
      } else {
        // If no 'ID' column, append it or handle as per sheet structure
        newRow.push(campaignId);
        logger.warn("No 'ID' column found in campaign sheet. Appending ID to the end.");
      }

      sheet.appendRow(newRow);
      logger.info(`Campaign '${campaignData.name}' created successfully with ID: ${campaignId}.`);

      // Return the created campaign data including the new ID
      return { ...campaignData, ID: campaignId };

    } catch (e) {
      logger.error(`Error creating campaign: ${e.message}`, e, campaignData);
      return null;
    }
  };

  /**
   * Retrieves all campaigns from the campaign sheet.
   * @returns {Array<Object>} An array of campaign objects.
   */
  this.getAllCampaigns = function() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(CAMPAIGN_SHEET_NAME);

      if (!sheet) {
        logger.error(`Campaign sheet '${CAMPAIGN_SHEET_NAME}' not found.`);
        return [];
      }

      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      if (values.length === 0) {
        logger.info(`No data found in campaign sheet '${CAMPAIGN_SHEET_NAME}'.`);
        return [];
      }

      const headers = values[0];
      const campaigns = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const campaign = {};
        headers.forEach((header, index) => {
          campaign[header] = row[index];
        });
        campaigns.push(campaign);
      }

      logger.info(`Successfully retrieved ${campaigns.length} campaigns from '${CAMPAIGN_SHEET_NAME}'.`);
      return campaigns;

    } catch (e) {
      logger.error(`Error getting all campaigns: ${e.message}`, e);
      return [];
    }
  };

  // TODO: Add methods for updating campaign status, getting campaigns by date range, etc.
  // this.updateCampaignStatus = function(campaignId, newStatus) { ... };
  // this.getCampaignsByDateRange = function(startDate, endDate) { ... };
}

// Global instance for easy access throughout the project
const campaignService = new CampaignService();