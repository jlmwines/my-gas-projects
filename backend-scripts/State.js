/**
 * @file State.gs
 * @description Manages UI state persistence using PropertiesService.
 * @version 25-07-08-1223
 */

const UI_STATE_KEY = 'VINSYNC_UI_STATE';

/**
 * Retrieves the UI state from user properties.
 */
function getUiState() {
  try {
    const properties = PropertiesService.getUserProperties();
    const stateString = properties.getProperty(UI_STATE_KEY);
    if (stateString) {
      return JSON.parse(stateString);
    }
  } catch (e) {
    Logger.log("Could not parse UI state: " + e.message);
  }
  // Return default state if nothing is stored or on error
  return {
    lastBackupDate: null,
    ordersProcessed: false,
    productsImported: false,
    reviewComplete: false,
    finalizeComplete: false,
    exportComplete: false
  };
}

/**
 * Saves the UI state to user properties.
 */
function saveUiState(state) {
  try {
    const properties = PropertiesService.getUserProperties();
    properties.setProperty(UI_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    Logger.log("Could not save UI state: " + e.message);
  }
}

/**
 * Resets the UI state to its default values.
 * This is intended to be called after a data restore operation.
 */
function resetUiState() {
  try {
    const defaultState = {
      lastBackupDate: null,
      ordersProcessed: false,
      productsImported: false,
      reviewComplete: false,
      finalizeComplete: false,
      exportComplete: false
    };
    const properties = PropertiesService.getUserProperties();
    properties.setProperty(UI_STATE_KEY, JSON.stringify(defaultState));
    Logger.log('UI state has been reset to default.');
  } catch (e) {
    Logger.log("Could not reset UI state: " + e.message);
  }
}

/**
 * WORKER: Resets the UI state without any popups.
 * This is the function our new Admin Sidebar will call.
 */
function _executeAdminReset() {
    resetUiState();
}