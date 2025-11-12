/**
 * @file AuthService.js
 * @description Handles user authentication and impersonation for testing.
 */

const AuthService = (function() {

  // This map defines the roles for specific test users.
  // In a production system, this would be replaced by a lookup from a user/group directory.
  const ROLE_MAP = {
    'accounts@jlmwines.com': 'admin',
    'info@jlmwines.com': 'manager'
  };

  /**
   * Gets the role for a given email address.
   * @param {string} email The email of the user.
   * @returns {string} The user's role ('admin', 'manager', or 'viewer').
   */
  function _getRoleForEmail(email) {
    return ROLE_MAP[email] || 'viewer'; // Default to 'viewer' if not in the map
  }

  /**
   * Gets the email of the active user, allowing for impersonation for testing.
   * Checks UserProperties for an 'impersonated_user' value first.
   * @returns {string} The email of the active or impersonated user.
   */
  function getActiveUserEmail() {
    // --- TEMPORARY WORKAROUND ---
    // Force user to be admin to unblock frontend development.
    return 'accounts@jlmwines.com';
    
    try {
      const impersonatedUser = PropertiesService.getUserProperties().getProperty('impersonated_user');
      if (impersonatedUser) {
        console.log(`IMPERSONATION: Running as ${impersonatedUser}`);
        return impersonatedUser;
      }
      return Session.getActiveUser().getEmail();
    } catch (e) {
      console.warn("Could not retrieve active user's email. This may be expected in a trigger-based execution.");
      return 'system@jlmops.com'; // Fallback for non-interactive executions
    }
  }

  /**
   * Gets the role of the active user (real or impersonated).
   * @returns {string} The user's role.
   */
  function getActiveUserRole() {
    // --- TEMPORARY WORKAROUND ---
    // Force user to be admin to unblock frontend development.
    return 'admin';

    const email = getActiveUserEmail();
    // For the actual system owner, grant admin role regardless of the map.
    if (email === Session.getEffectiveUser().getEmail() && !PropertiesService.getUserProperties().getProperty('impersonated_user')) {
        const ownerRole = _getRoleForEmail(email);
        // If the owner is not in the map, default them to admin.
        return ownerRole === 'viewer' ? 'admin' : ownerRole;
    }
    return _getRoleForEmail(email);
  }

  /**
   * Clears any active impersonation.
   */
  function clearImpersonation() {
    PropertiesService.getUserProperties().deleteProperty('impersonated_user');
    console.log('IMPERSONATION: Cleared.');
  }

  /**
   * Sets or clears the impersonated user for the current session based on URL parameters.
   * To be called from doGet(e).
   * @param {Object} e - The event object from doGet, which may contain URL parameters.
   */
  function handleImpersonation(e) {
    if (!e || !e.parameter) {
      return;
    }

    const userProperties = PropertiesService.getUserProperties();
    const testUser = e.parameter.test_user;
    const shouldClear = e.parameter.clear_impersonation;

    if (shouldClear) {
      clearImpersonation();
    } else if (testUser) {
      userProperties.setProperty('impersonated_user', testUser);
      console.log(`IMPERSONATION: Session set to run as ${testUser}.`);
    }
  }

  return {
    getActiveUserEmail: getActiveUserEmail,
    getActiveUserRole: getActiveUserRole,
    handleImpersonation: handleImpersonation,
    clearImpersonation: clearImpersonation
  };

})();
