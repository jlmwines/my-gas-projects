/**
 * @file AuthService.js
 * @description Handles user authentication and impersonation for testing.
 */

const AuthService = (function() {

  /**
   * Gets the email of the active user, allowing for impersonation for testing.
   * Checks UserProperties for an 'impersonated_user' value first.
   * @returns {string} The email of the active or impersonated user.
   */
  function getActiveUserEmail() {
    try {
      const impersonatedUser = PropertiesService.getUserProperties().getProperty('impersonated_user');
      if (impersonatedUser) {
        // Using console.log for immediate feedback in the editor logs during testing.
        console.log(`IMPERSONATION: Running as ${impersonatedUser}`);
        return impersonatedUser;
      }
      return Session.getActiveUser().getEmail();
    } catch (e) {
      // This will fail when run outside of a user session (e.g. from a time-based trigger)
      // In that case, we can return a system user or handle appropriately.
      console.warn("Could not retrieve active user's email. This may be expected in a trigger-based execution.");
      return 'system@jlmops.com'; // Fallback for non-interactive executions
    }
  }

  /**
   * Sets or clears the impersonated user for the current session based on URL parameters.
   * To be called from doGet(e).
   * @param {Object} e - The event object from doGet, which may contain URL parameters.
   */
  function handleImpersonation(e) {
    // Ensure 'e' and 'e.parameter' are defined to prevent errors
    if (!e || !e.parameter) {
      return;
    }

    const userProperties = PropertiesService.getUserProperties();
    const testUser = e.parameter.test_user;

    if (testUser) {
      userProperties.setProperty('impersonated_user', testUser);
      console.log(`IMPERSONATION: Session set to run as ${testUser}. Remove '?test_user' from URL to clear.`);
    } else {
      // Only clear the property if the parameter is NOT present on page load.
      // This allows navigation within the app without losing impersonation.
      if (e.parameter.hasOwnProperty('clear_impersonation')) {
         userProperties.deleteProperty('impersonated_user');
         console.log('IMPERSONATION: Cleared.');
      }
    }
  }

  return {
    getActiveUserEmail: getActiveUserEmail,
    handleImpersonation: handleImpersonation
  };

})();
