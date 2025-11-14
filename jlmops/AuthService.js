/**
 * @file AuthService.js
 * @description Handles user authentication and role management.
 */

const AuthService = (function() {

  let _roleMap = null;

  /**
   * Loads the role map from SysConfig.
   */
  function _loadRoleMapFromConfig() {
    if (_roleMap) {
      return;
    }
    
    const allConfig = ConfigService.getAllConfig();
    const userConfigs = allConfig['system.users'];
    
    _roleMap = {};
    if (userConfigs && Array.isArray(userConfigs)) {
      userConfigs.forEach(userConfig => {
        if (userConfig.email && userConfig.role) {
          _roleMap[userConfig.email.toLowerCase()] = userConfig.role.toLowerCase();
        }
      });
    }
  }

  /**
   * Gets the email of the active user.
   * @returns {string} The email of the active user.
   */
  function getActiveUserEmail() {
    try {
      return Session.getActiveUser().getEmail();
    } catch (e) {
      console.warn("Could not retrieve active user's email. This may be expected in a trigger-based execution.");
      return 'system@jlmops.com'; // Fallback for non-interactive executions
    }
  }

  /**
   * Gets the role of the active user.
   * @returns {string} The user's role.
   */
  function getActiveUserRole() {
    const email = getActiveUserEmail().toLowerCase();
    _loadRoleMapFromConfig();
    return _roleMap[email] || 'viewer'; // Default to 'viewer' if not in the map
  }

  /**
   * Returns a map of all users and their roles for the UI.
   * @returns {Object} An object where keys are emails and values are roles.
   */
  function getUsersAndRoles() {
    _loadRoleMapFromConfig();
    return _roleMap;
  }

  /**
   * Returns a list of unique, available roles.
   * @returns {Array<string>} A list of unique roles.
   */
  function getAvailableRoles() {
    _loadRoleMapFromConfig();
    const roles = Object.values(_roleMap);
    return [...new Set(roles)]; // Return unique roles
  }

  return {
    getActiveUserEmail: getActiveUserEmail,
    getActiveUserRole: getActiveUserRole,
    getUsersAndRoles: getUsersAndRoles,
    getAvailableRoles: getAvailableRoles
  };

})();
