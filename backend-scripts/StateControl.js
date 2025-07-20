/**
 * @file StateControl.gs
 * @version 25-07-09-1100
 * @description Provides functions for setting the workflow state to specific points, callable from the main menu.
 */

/**
 * A private helper function to construct and save a specific state.
 * @param {object} stateFlags - An object with the flags to set to true (e.g., { lastBackupDate: true, reviewComplete: true }).
 * @param {string} confirmationMessage - The message to show the user upon successful state change.
 */
function _setWorkflowState(stateFlags = {}, confirmationMessage) {
  const ui = SpreadsheetApp.getUi();
  try {
    const today = new Date().toISOString().split('T')[0];
    const newState = {
      lastBackupDate: stateFlags.lastBackupDate ? today : null,
      ordersProcessed: stateFlags.ordersProcessed || false,
      productsImported: stateFlags.productsImported || false,
      reviewComplete: stateFlags.reviewComplete || false,
      finalizeComplete: stateFlags.finalizeComplete || false,
      exportComplete: stateFlags.exportComplete || false
    };

    saveUiState(newState); // This function is defined in State.gs
    
    ui.alert('State Updated', confirmationMessage, ui.ButtonSet.OK);
    return true; // Return true on success

  } catch (e) {
    Logger.log(`Failed to set workflow state. Error: ${e.message}`);
    ui.alert('Error', `Could not set the workflow state: ${e.message}`, ui.ButtonSet.OK);
    return false; // Return false on failure
  }
}

/**
 * Resets the entire workflow state to its initial default.
 */
function resetStateToStart() {
  // FIX: Added a confirmation dialog to prevent accidental resets.
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Confirm Reset',
    'Are you sure you want to start a new batch? This will reset all workflow progress.',
    ui.ButtonSet.YES_NO
  );

  if (response == ui.Button.YES) {
    return _setWorkflowState({}, 'Workflow state has been reset. The sidebar will now refresh.');
  } else {
    return false; // User cancelled the operation
  }
}

/**
 * Sets the state to after the 'Backup' step is complete.
 */
function resetStatePostBackup() {
  _setWorkflowState(
    { lastBackupDate: true }, 
    'State set to: Backup complete. Please refresh the sidebar.'
  );
}

/**
 * Sets the state to after both 'Process Orders' and 'Import Products' are complete.
 * This implies Backup is also complete.
 */
function resetStatePostImportsAndOrders() {
  _setWorkflowState(
    { lastBackupDate: true, ordersProcessed: true, productsImported: true },
    'State set to: Imports and Orders complete. Please refresh the sidebar.'
  );
}

/**
 * Sets the state to after the 'Review Data' step is complete.
 * This implies all preceding steps are also complete.
 */
function resetStatePostReview() {
  _setWorkflowState(
    { lastBackupDate: true, ordersProcessed: true, productsImported: true, reviewComplete: true },
    'State set to: Review complete. Please refresh the sidebar.'
  );
}

/**
 * Sets the state to after the 'Finalize' step is complete.
 * This implies all preceding steps are also complete.
 */
function resetStatePostFinalize() {
  _setWorkflowState(
    { lastBackupDate: true, ordersProcessed: true, productsImported: true, reviewComplete: true, finalizeComplete: true },
    'State set to: Finalize complete. Please refresh the sidebar.'
  );
}
