/**
 * @file PackingSlipFlow.gs
 * @description Orchestrates the user-initiated flow for refreshing packing data and creating a consolidated document batch.
 * @version 25-07-23-0800
 * @environment Frontend
 */

/**
 * Executes a full cycle of data polling, display refresh, and batch document creation.
 */
function manualBatchCreationCycle() {
    const ui = SpreadsheetApp.getUi();
    const props = PropertiesService.getUserProperties();
    const lastBackendUpdate = getReferenceSetting(G.SETTINGS.PACKING_DATA_CREATED);

    const lastRunTimestampKey = "lastPackingFlowRun";
    const lastRunTimestamp = props.getProperty(lastRunTimestampKey);

    let shouldUpdate = false;
    if (!lastRunTimestamp || (new Date(lastBackendUpdate)).getTime() > (new Date(lastRunTimestamp)).getTime()) {
        shouldUpdate = true;
    }

    if (shouldUpdate) {
        ui.alert("New packing data detected. The display will be refreshed and new documents will be created.");
        
        // Refresh the display with the latest data
        updatePackingDisplay();
        
        // Create the consolidated documents
        createConsolidatedPackingDocs();
        
        // Record the timestamp of this run to prevent immediate re-creation
        props.setProperty(lastRunTimestampKey, new Date().toString());
    } else {
        ui.alert("The packing data is already up to date. No new documents were created.");
    }
}