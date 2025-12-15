/**
 * @file WebAppProjects.js
 * @description Controller functions for the Admin Projects view.
 * These functions are called from AdminProjectsView.html via google.script.run.
 */

/**
 * Converts Date objects to ISO strings for JSON serialization.
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function _sanitizeForClient(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(_sanitizeForClient);
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      sanitized[key] = _sanitizeForClient(obj[key]);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Gets all projects for the project list.
 * @returns {Object} { error: string|null, data: Object[] }
 */
function WebAppProjects_getAllProjects() {
  try {
    console.log('WebAppProjects_getAllProjects: Starting');
    const projects = ProjectService.getAllProjects();
    console.log('WebAppProjects_getAllProjects: Got ' + projects.length + ' projects');

    // Enrich with task counts
    const enrichedProjects = projects.map(project => {
      const projectId = project.projectid || project.spro_ProjectId;
      console.log('WebAppProjects_getAllProjects: Getting tasks for project ' + projectId);
      const tasks = ProjectService.getTasksForProject(projectId);
      const completedTasks = tasks.filter(t => t.st_Status === 'Done' || t.st_Status === 'Closed').length;

      return {
        ...project,
        taskCount: tasks.length,
        completedTaskCount: completedTasks
      };
    });

    console.log('WebAppProjects_getAllProjects: Returning ' + enrichedProjects.length + ' enriched projects');
    return { error: null, data: _sanitizeForClient(enrichedProjects) };
  } catch (e) {
    console.log('WebAppProjects_getAllProjects: ERROR - ' + e.message);
    logger.error('WebAppProjects', 'getAllProjects', e.message, e);
    return { error: e.message, data: [] };
  }
}

/**
 * Gets a single project by ID.
 * @param {string} projectId
 * @returns {Object} { error: string|null, data: Object|null }
 */
function WebAppProjects_getProject(projectId) {
  try {
    const project = ProjectService.getProject(projectId);
    return { error: null, data: project };
  } catch (e) {
    logger.error('WebAppProjects', 'getProject', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Creates a new project.
 * @param {Object} projectData - { name, type, status, startDate, endDate }
 * @returns {Object} { error: string|null, data: Object|null }
 */
function WebAppProjects_createProject(projectData) {
  try {
    const project = ProjectService.createProject(projectData);
    return { error: null, data: project };
  } catch (e) {
    logger.error('WebAppProjects', 'createProject', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Updates an existing project.
 * @param {string} projectId
 * @param {Object} updates - Fields to update
 * @returns {Object} { error: string|null, success: boolean }
 */
function WebAppProjects_updateProject(projectId, updates) {
  try {
    const success = ProjectService.updateProject(projectId, updates);
    return { error: null, success: success };
  } catch (e) {
    logger.error('WebAppProjects', 'updateProject', e.message, e);
    return { error: e.message, success: false };
  }
}

/**
 * Deletes (archives) a project.
 * @param {string} projectId
 * @returns {Object} { error: string|null, success: boolean }
 */
function WebAppProjects_deleteProject(projectId) {
  try {
    const success = ProjectService.deleteProject(projectId);
    return { error: null, success: success };
  } catch (e) {
    logger.error('WebAppProjects', 'deleteProject', e.message, e);
    return { error: e.message, success: false };
  }
}

/**
 * Gets project statistics.
 * @returns {Object} { error: string|null, data: Object }
 */
function WebAppProjects_getStats() {
  try {
    console.log('WebAppProjects_getStats: Starting');
    const stats = ProjectService.getProjectStats();
    console.log('WebAppProjects_getStats: Got stats - total: ' + stats.total);
    return { error: null, data: stats };
  } catch (e) {
    console.log('WebAppProjects_getStats: ERROR - ' + e.message);
    logger.error('WebAppProjects', 'getStats', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Gets a project with all its tasks.
 * @param {string} projectId
 * @returns {Object} { error: string|null, data: Object|null }
 */
function WebAppProjects_getProjectWithTasks(projectId) {
  try {
    const project = ProjectService.getProjectWithTasks(projectId);
    return { error: null, data: project };
  } catch (e) {
    logger.error('WebAppProjects', 'getProjectWithTasks', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Gets available project types and statuses for dropdowns.
 * @returns {Object} { types: string[], statuses: string[] }
 */
function WebAppProjects_getOptions() {
  return {
    types: Object.values(ProjectService.PROJECT_TYPES),
    statuses: Object.values(ProjectService.PROJECT_STATUSES)
  };
}
